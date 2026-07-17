import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { KeyRound, ShieldCheck, Loader2, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Factor = { id: string; friendly_name?: string | null; status: string; factor_type: string };

const TwoFactorSettings = () => {
  const { toast } = useToast();
  const [factors, setFactors] = useState<Factor[]>([]);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);
  const [enrollment, setEnrollment] = useState<{ id: string; qr: string; secret: string } | null>(null);
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);

  const refresh = async () => {
    setLoading(true);
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (!error && data) {
      setFactors([...(data.totp || []), ...((data as any).phone || [])] as Factor[]);
    }
    setLoading(false);
  };

  useEffect(() => { refresh(); }, []);

  const startEnroll = async () => {
    setEnrolling(true);
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: `Authenticator ${new Date().toLocaleDateString()}`,
    });
    setEnrolling(false);
    if (error || !data) {
      toast({ title: "Couldn't start setup", description: error?.message, variant: "destructive" });
      return;
    }
    setEnrollment({
      id: data.id,
      qr: (data.totp as any).qr_code,
      secret: (data.totp as any).secret,
    });
  };

  const verifyEnroll = async () => {
    if (!enrollment) return;
    setVerifying(true);
    const { data: challenge, error: cErr } = await supabase.auth.mfa.challenge({ factorId: enrollment.id });
    if (cErr || !challenge) {
      setVerifying(false);
      toast({ title: "Challenge failed", description: cErr?.message, variant: "destructive" });
      return;
    }
    const { error: vErr } = await supabase.auth.mfa.verify({
      factorId: enrollment.id,
      challengeId: challenge.id,
      code: code.trim(),
    });
    setVerifying(false);
    if (vErr) {
      toast({ title: "Invalid code", description: vErr.message, variant: "destructive" });
      return;
    }
    toast({ title: "Two-factor enabled", description: "You'll be asked for a code on your next sign-in." });
    setEnrollment(null);
    setCode("");
    refresh();
  };

  const unenroll = async (factorId: string) => {
    const { error } = await supabase.auth.mfa.unenroll({ factorId });
    if (error) {
      toast({ title: "Couldn't remove", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Two-factor removed" });
    refresh();
  };

  const active = factors.filter((f) => f.status === "verified");

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="font-serif text-xl flex items-center gap-2">
          <KeyRound className="w-5 h-5 text-primary" />
          Two-factor authentication
        </CardTitle>
        <CardDescription>
          Add a second step to sign-in using an authenticator app like Google Authenticator, 1Password, or Authy.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        ) : active.length > 0 ? (
          <div className="space-y-3">
            {active.map((f) => (
              <div key={f.id} className="flex items-center justify-between rounded-lg border border-primary/30 bg-primary/5 p-4">
                <div className="flex items-start gap-3">
                  <ShieldCheck className="w-5 h-5 text-primary shrink-0" />
                  <div>
                    <p className="font-medium text-foreground">{f.friendly_name || "Authenticator app"}</p>
                    <p className="text-xs text-muted-foreground">Active · {f.factor_type.toUpperCase()}</p>
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => unenroll(f.id)}>
                  <Trash2 className="w-4 h-4 mr-1.5" /> Remove
                </Button>
              </div>
            ))}
          </div>
        ) : enrollment ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Scan this QR code in your authenticator app, then enter the 6-digit code below.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 items-start">
              <img src={enrollment.qr} alt="2FA QR code" className="w-40 h-40 rounded-lg border bg-white p-2" />
              <div className="space-y-2 flex-1 min-w-0">
                <Label className="text-xs">Or enter this secret manually</Label>
                <code className="block text-xs font-mono bg-muted rounded p-2 break-all">{enrollment.secret}</code>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="totp-code">6-digit code</Label>
              <Input
                id="totp-code"
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="123456"
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={verifyEnroll} disabled={code.length !== 6 || verifying}>
                {verifying && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Verify & enable
              </Button>
              <Button variant="ghost" onClick={() => { setEnrollment(null); setCode(""); }}>Cancel</Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
            <p className="text-sm text-muted-foreground">
              Two-factor is <span className="font-medium text-foreground">off</span>. Turn it on to protect your account.
            </p>
            <Button onClick={startEnroll} disabled={enrolling} className="shrink-0">
              {enrolling ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <KeyRound className="w-4 h-4 mr-2" />}
              Set up 2FA
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TwoFactorSettings;
