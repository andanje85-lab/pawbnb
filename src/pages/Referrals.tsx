import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Copy, Gift, Loader2, Share2, Users, CheckCircle2, Clock } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const REWARD_PER_REFERRAL = 20;

const makeCode = (seed: string) => {
  const base = (seed || "PAW").replace(/[^a-zA-Z]/g, "").slice(0, 4).toUpperCase() || "PAW";
  const rand = Math.random().toString(36).replace(/[^a-z0-9]/gi, "").slice(0, 5).toUpperCase();
  return `${base}${rand}`;
};

const Referrals = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [authLoading, user, navigate]);

  const { data: codeRow, isLoading: codeLoading } = useQuery({
    queryKey: ["referral-code", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("referral_codes")
        .select("code")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: profile } = useQuery({
    queryKey: ["profile-name", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const { data: referrals = [] } = useQuery({
    queryKey: ["my-referrals", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("referrals")
        .select("id, status, reward_amount, created_at, completed_at")
        .eq("referrer_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
  });

  // Auto-create a code the first time the page is opened
  useEffect(() => {
    if (!user || codeLoading || codeRow || creating) return;
    let cancelled = false;
    const create = async () => {
      setCreating(true);
      for (let attempt = 0; attempt < 4; attempt++) {
        const code = makeCode(profile?.full_name ?? "PAW");
        const { error } = await supabase
          .from("referral_codes")
          .insert({ user_id: user.id, code });
        if (!error) break;
        if (!error.message.toLowerCase().includes("duplicate")) break;
      }
      if (!cancelled) {
        setCreating(false);
        queryClient.invalidateQueries({ queryKey: ["referral-code", user.id] });
      }
    };
    create();
    return () => {
      cancelled = true;
    };
  }, [user, codeLoading, codeRow, creating, profile, queryClient]);

  const code = codeRow?.code ?? "";
  const link = code ? `${window.location.origin}/?ref=${code}` : "";

  const pending = referrals.filter((r) => r.status === "pending").length;
  const completed = referrals.filter((r) => r.status !== "pending").length;
  const earned = referrals.reduce((sum, r) => sum + Number(r.reward_amount ?? 0), 0);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(link);
      toast.success("Referral link copied!");
    } catch {
      toast.error("Couldn't copy — select the link and copy manually.");
    }
  };

  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Join me on PawBnB",
          text: `Find loving dog sitters near you — sign up with my link and we both get $${REWARD_PER_REFERRAL} off.`,
          url: link,
        });
        return;
      } catch {
        /* user dismissed */
      }
    }
    copyLink();
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Refer a friend & earn rewards | PawBnB</title>
        <meta
          name="description"
          content={`Invite dog parents to PawBnB and earn $${REWARD_PER_REFERRAL} in credit for every friend whose first stay is confirmed.`}
        />
      </Helmet>
      <Header />
      <main className="pt-24 pb-16 px-4 max-w-3xl mx-auto">
        <div className="mb-8">
          <h1 className="font-serif text-3xl font-bold text-foreground flex items-center gap-2">
            <Gift className="w-7 h-7 text-primary" />
            Refer a friend
          </h1>
          <p className="text-muted-foreground mt-1">
            Share your link. When a friend's first stay is confirmed, you earn ${REWARD_PER_REFERRAL} in credit.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-xl">Your referral link</CardTitle>
            <CardDescription>Anyone who signs up through this link is credited to you.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {code ? (
              <>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Input readOnly value={link} className="font-mono text-xs sm:text-sm" />
                  <div className="flex gap-2">
                    <Button onClick={copyLink} className="flex-1 sm:flex-none">
                      <Copy className="w-4 h-4 mr-2" />
                      Copy
                    </Button>
                    <Button variant="outline" onClick={share} className="flex-1 sm:flex-none">
                      <Share2 className="w-4 h-4 mr-2" />
                      Share
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Your code: <span className="font-mono font-semibold text-foreground">{code}</span>
                </p>
              </>
            ) : (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                Creating your referral code…
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Users className="w-4 h-4" /> Signed up
              </div>
              <p className="font-serif text-3xl font-bold mt-1">{referrals.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <CheckCircle2 className="w-4 h-4" /> Rewards unlocked
              </div>
              <p className="font-serif text-3xl font-bold mt-1">{completed}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Gift className="w-4 h-4" /> Credit earned
              </div>
              <p className="font-serif text-3xl font-bold mt-1">${earned}</p>
            </CardContent>
          </Card>
        </div>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="font-serif text-xl">Your referrals</CardTitle>
            <CardDescription>
              {pending > 0
                ? `${pending} friend${pending > 1 ? "s" : ""} still need a confirmed booking to unlock your reward.`
                : "Rewards unlock once a friend's first booking is confirmed."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {referrals.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No referrals yet — share your link to get started.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {referrals.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-3 py-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        Friend joined {format(new Date(r.created_at), "MMM d, yyyy")}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {r.completed_at
                          ? `Reward unlocked ${format(new Date(r.completed_at), "MMM d, yyyy")}`
                          : "Waiting on their first confirmed booking"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {Number(r.reward_amount) > 0 && (
                        <span className="text-sm font-semibold text-foreground">
                          ${Number(r.reward_amount)}
                        </span>
                      )}
                      <Badge variant={r.status === "pending" ? "secondary" : "default"} className="gap-1">
                        {r.status === "pending" ? (
                          <Clock className="w-3 h-3" />
                        ) : (
                          <CheckCircle2 className="w-3 h-3" />
                        )}
                        {r.status === "pending" ? "Pending" : "Earned"}
                      </Badge>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="font-serif text-xl">How it works</CardTitle>
          </CardHeader>
          <CardContent className="grid sm:grid-cols-3 gap-4 text-sm">
            <div>
              <p className="font-medium text-foreground mb-1">1. Share your link</p>
              <p className="text-muted-foreground">Send it to friends with dogs who need trusted care.</p>
            </div>
            <div>
              <p className="font-medium text-foreground mb-1">2. They book a stay</p>
              <p className="text-muted-foreground">Your friend signs up and books their first stay.</p>
            </div>
            <div>
              <p className="font-medium text-foreground mb-1">3. You earn credit</p>
              <p className="text-muted-foreground">
                ${REWARD_PER_REFERRAL} lands in your account once the host confirms it.
              </p>
            </div>
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
};

export default Referrals;
