import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useNavigate } from "react-router-dom";
import {
  ShieldCheck,
  Loader2,
  CheckCircle2,
  Lock,
  DoorOpen,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import Header from "@/components/Header";

type Status = "loading" | "available" | "closed" | "error" | "done";

const REDIRECT_SECONDS = 5;

const AdminSetup = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState<Status>("loading");
  const [claiming, setClaiming] = useState(false);
  const [countdown, setCountdown] = useState(REDIRECT_SECONDS);

  useEffect(() => {
    const check = async () => {
      const { data, error } = await supabase.functions.invoke("bootstrap-admin", {
        method: "GET",
      });
      if (error) {
        setStatus("error");
        return;
      }
      setStatus(
        (data as { setup_available: boolean })?.setup_available ? "available" : "closed",
      );
    };
    check();
  }, []);

  // Auto-redirect with a visible countdown when seeding is closed.
  useEffect(() => {
    if (status !== "closed") return;
    if (countdown <= 0) {
      navigate("/", { replace: true });
      return;
    }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [status, countdown, navigate]);

  const claim = async () => {
    setClaiming(true);
    const { data, error } = await supabase.functions.invoke("bootstrap-admin", { body: {} });
    setClaiming(false);
    const message = (data as { error?: string; message?: string })?.error;
    if (error || message) {
      toast.error(message || "Could not complete setup. Please try again.");
      if (message?.includes("Setup already completed")) setStatus("closed");
      return;
    }
    setStatus("done");
    toast.success("Admin access granted");
  };

  const StatusBadge = () => {
    const map = {
      loading: {
        label: "Checking…",
        className: "bg-muted text-muted-foreground",
        Icon: Loader2,
        spin: true,
      },
      available: {
        label: "Open",
        className: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
        Icon: DoorOpen,
        spin: false,
      },
      closed: {
        label: "Closed",
        className: "bg-rose-500/15 text-rose-600 dark:text-rose-400",
        Icon: Lock,
        spin: false,
      },
      error: {
        label: "Unavailable",
        className: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
        Icon: AlertTriangle,
        spin: false,
      },
      done: {
        label: "Completed",
        className: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
        Icon: CheckCircle2,
        spin: false,
      },
    } as const;

    const s = map[status];
    const Icon = s.Icon;
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${s.className}`}
      >
        <Icon className={`w-3.5 h-3.5 ${s.spin ? "animate-spin" : ""}`} />
        {s.label}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Admin Setup | PawBnB</title>
        <meta name="description" content="One-time setup to create the first PawBnB admin account." />
        <meta name="robots" content="noindex,nofollow" />
      </Helmet>
      <Header />
      <main className="max-w-lg mx-auto px-4 pt-28 pb-16">
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-3">
              <ShieldCheck className="w-6 h-6 text-primary" />
            </div>
            <div className="flex items-center justify-center mb-1">
              <StatusBadge />
            </div>
            <CardTitle className="font-serif text-2xl">First-admin setup</CardTitle>
            <CardDescription>
              This one-time workflow grants admin access to the signed-in account. It closes
              permanently once the first admin exists.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {status === "loading" && (
              <div className="flex items-center justify-center gap-2 text-muted-foreground py-6">
                <Loader2 className="w-4 h-4 animate-spin" /> Checking setup status…
              </div>
            )}

            {status === "error" && (
              <div className="text-center space-y-4 py-2">
                <AlertTriangle className="w-8 h-8 mx-auto text-amber-500" />
                <p className="text-sm text-muted-foreground">
                  We couldn't reach the setup service. Check your connection and try again.
                </p>
                <Button
                  variant="outline"
                  onClick={() => {
                    setStatus("loading");
                    supabase.functions
                      .invoke("bootstrap-admin", { method: "GET" })
                      .then(({ data, error }) =>
                        setStatus(
                          error
                            ? "error"
                            : (data as { setup_available: boolean })?.setup_available
                            ? "available"
                            : "closed",
                        ),
                      );
                  }}
                >
                  Retry
                </Button>
              </div>
            )}

            {status === "closed" && (
              <div className="space-y-4 py-2">
                <div className="flex flex-col items-center text-center gap-2">
                  <Lock className="w-8 h-8 text-rose-500" />
                  <p className="text-sm text-muted-foreground">
                    Setup is <span className="font-medium text-foreground">closed</span> — an admin
                    account already exists. Ask an existing admin to grant you access from the admin
                    dashboard.
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-center text-sm text-muted-foreground">
                  Redirecting you home in{" "}
                  <span className="font-semibold text-foreground">{countdown}</span>{" "}
                  second{countdown === 1 ? "" : "s"}…
                  <div className="mt-2 flex justify-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => navigate("/", { replace: true })}>
                      Go now
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => navigate("/admin")}>
                      Go to admin dashboard
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {status === "done" && (
              <div className="text-center space-y-4 py-2">
                <CheckCircle2 className="w-8 h-8 mx-auto text-primary" />
                <p className="text-sm text-muted-foreground">
                  You now have admin access. Open the admin dashboard to invite staff.
                </p>
                <Link to="/admin"><Button>Go to admin dashboard</Button></Link>
              </div>
            )}

            {status === "available" && (
              <>
                <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">
                  Admin seeding is <span className="font-semibold">open</span> — no admin accounts
                  exist yet. The signed-in user can claim the role below.
                </div>

                {authLoading ? (
                  <div className="flex items-center justify-center gap-2 text-muted-foreground py-6">
                    <Loader2 className="w-4 h-4 animate-spin" />
                  </div>
                ) : user ? (
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Signed in as <span className="font-medium text-foreground">{user.email}</span>.
                      Claim admin access for this account.
                    </p>
                    <Button className="w-full" onClick={claim} disabled={claiming}>
                      {claiming && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      Make me the first admin
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Sign in (or create the account you want to use for admin) first, then return to
                      this page.
                    </p>
                    <Link to="/auth"><Button className="w-full">Sign in to continue</Button></Link>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default AdminSetup;
