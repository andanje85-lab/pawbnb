import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { ShieldCheck, BadgeCheck, Loader2, Upload, FileCheck2, Clock, XCircle, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { z } from "zod";

const DOC_TYPES = [
  { value: "passport", label: "Passport" },
  { value: "drivers_license", label: "Driver's licence" },
  { value: "national_id", label: "National ID card" },
];

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

const schema = z.object({
  legalName: z.string().trim().min(2, "Enter your full legal name").max(120),
  documentType: z.enum(["passport", "drivers_license", "national_id"]),
});

const statusMeta: Record<string, { label: string; className: string; icon: typeof Clock; help: string }> = {
  pending: { label: "Pending review", className: "bg-yellow-100 text-yellow-800 border-yellow-200", icon: Clock, help: "Our trust & safety team usually reviews documents within 24 hours." },
  reviewing: { label: "In review", className: "bg-blue-100 text-blue-800 border-blue-200", icon: Clock, help: "A reviewer is checking your documents right now." },
  more_info: { label: "More info needed", className: "bg-orange-100 text-orange-800 border-orange-200", icon: AlertCircle, help: "Please submit a clearer document to continue." },
  rejected: { label: "Rejected", className: "bg-red-100 text-red-800 border-red-200", icon: XCircle, help: "You can submit a new request with valid documents." },
  approved: { label: "Approved", className: "bg-green-100 text-green-800 border-green-200", icon: BadgeCheck, help: "Your ID Verified badge is live." },
};

type Props = { verified: boolean; verifiedAt: string | null };

const IdVerification = ({ verified, verifiedAt }: Props) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [open, setOpen] = useState(false);
  const [legalName, setLegalName] = useState("");
  const [documentType, setDocumentType] = useState("");
  const [docFiles, setDocFiles] = useState<File[]>([]);
  const [selfie, setSelfie] = useState<File | null>(null);
  const [consent, setConsent] = useState(false);

  const { data: request, isLoading } = useQuery({
    queryKey: ["verification-request", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("verification_requests")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(1);
      if (error) throw error;
      return (data?.[0] as any) ?? null;
    },
  });

  const pickFiles = (files: FileList | null, setter: (f: File[]) => void, max: number) => {
    if (!files) return;
    const list = Array.from(files).slice(0, max);
    for (const f of list) {
      if (f.size > MAX_BYTES) {
        toast({ title: "File too large", description: `${f.name} is over 10 MB.`, variant: "destructive" });
        return;
      }
      if (!ALLOWED.includes(f.type)) {
        toast({ title: "Unsupported file", description: "Use JPG, PNG, WEBP or PDF.", variant: "destructive" });
        return;
      }
    }
    setter(list);
  };

  const submit = useMutation({
    mutationFn: async () => {
      const parsed = schema.safeParse({ legalName, documentType });
      if (!parsed.success) throw new Error(parsed.error.issues[0].message);
      if (docFiles.length === 0) throw new Error("Upload at least one photo of your ID document");

      const upload = async (file: File, tag: string) => {
        const ext = file.name.split(".").pop() ?? "jpg";
        const path = `${user!.id}/${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error } = await supabase.storage.from("verification-docs").upload(path, file, { upsert: false });
        if (error) throw error;
        return path;
      };

      const documentPaths: string[] = [];
      for (let i = 0; i < docFiles.length; i++) documentPaths.push(await upload(docFiles[i], `document-${i + 1}`));
      const selfiePath = selfie ? await upload(selfie, "selfie") : null;

      const { error } = await (supabase as any).from("verification_requests").insert({
        user_id: user!.id,
        legal_name: legalName.trim(),
        document_type: documentType,
        document_urls: documentPaths,
        selfie_url: selfiePath,
        status: "pending",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["verification-request", user?.id] });
      setOpen(false);
      setLegalName("");
      setDocumentType("");
      setDocFiles([]);
      setSelfie(null);
      setConsent(false);
      toast({ title: "Documents submitted", description: "We'll review your ID and update you shortly." });
    },
    onError: (e: any) =>
      toast({ title: "Submission failed", description: e.message ?? "Please try again.", variant: "destructive" }),
  });

  const canSubmit = legalName.trim().length > 1 && !!documentType && docFiles.length > 0 && consent && !submit.isPending;
  const pendingReview = request && ["pending", "reviewing"].includes(request.status);
  const meta = request ? statusMeta[request.status] : null;

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="font-serif text-xl flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-primary" />
          Identity verification
        </CardTitle>
        <CardDescription>
          Verified hosts book faster and earn more trust from guests. Documents are stored privately and only seen by our trust &amp; safety team.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {verified && (
          <div className="flex items-start gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
            <BadgeCheck className="w-6 h-6 text-primary shrink-0" />
            <div>
              <p className="font-medium text-foreground">You're verified</p>
              <p className="text-xs text-muted-foreground">
                Verified on {verifiedAt ? format(new Date(verifiedAt), "MMM d, yyyy") : "your profile"}
              </p>
            </div>
          </div>
        )}

        {!isLoading && request && meta && (
          <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className={meta.className}>
                <meta.icon className="w-3 h-3 mr-1" />
                {meta.label}
              </Badge>
              <span className="text-xs text-muted-foreground">
                Submitted {format(new Date(request.created_at), "MMM d, yyyy")}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">{meta.help}</p>
            {request.review_notes && (
              <p className="text-xs text-foreground border-l-2 border-primary/40 pl-2 mt-2">
                Reviewer note: {request.review_notes}
              </p>
            )}
          </div>
        )}

        {!verified && !pendingReview && (
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
            <p className="text-sm text-muted-foreground">
              Upload a government-issued ID to earn the ID Verified badge.
            </p>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button className="shrink-0">
                  <Upload className="w-4 h-4 mr-2" />
                  {request ? "Submit new documents" : "Start verification"}
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Verify your identity</DialogTitle>
                  <DialogDescription>
                    Your documents are uploaded to private storage and reviewed manually. They are never shown on your public profile.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-2">
                  <div className="space-y-2">
                    <Label htmlFor="legalName">Legal full name</Label>
                    <Input
                      id="legalName"
                      value={legalName}
                      onChange={(e) => setLegalName(e.target.value.slice(0, 120))}
                      placeholder="e.g. Jane A. Doe"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Document type</Label>
                    <Select value={documentType} onValueChange={setDocumentType}>
                      <SelectTrigger><SelectValue placeholder="Select document" /></SelectTrigger>
                      <SelectContent>
                        {DOC_TYPES.map((d) => (
                          <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="docs">Document photos (front &amp; back, max 2)</Label>
                    <Input
                      id="docs"
                      type="file"
                      accept="image/jpeg,image/png,image/webp,application/pdf"
                      multiple
                      onChange={(e) => pickFiles(e.target.files, setDocFiles, 2)}
                    />
                    {docFiles.length > 0 && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <FileCheck2 className="w-3 h-3" /> {docFiles.map((f) => f.name).join(", ")}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="selfie">Selfie holding your ID (optional but speeds up review)</Label>
                    <Input
                      id="selfie"
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={(e) => pickFiles(e.target.files, (f) => setSelfie(f[0] ?? null), 1)}
                    />
                    {selfie && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <FileCheck2 className="w-3 h-3" /> {selfie.name}
                      </p>
                    )}
                  </div>
                  <label className="flex items-start gap-2 cursor-pointer">
                    <Checkbox checked={consent} onCheckedChange={(v) => setConsent(!!v)} className="mt-0.5" />
                    <span className="text-sm text-muted-foreground leading-snug">
                      I confirm these documents are mine and authentic, and I consent to PawBnB storing them securely for verification purposes.
                    </span>
                  </label>
                </div>
                <DialogFooter>
                  <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
                  <Button onClick={() => submit.mutate()} disabled={!canSubmit}>
                    {submit.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                    Submit for review
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default IdVerification;
