import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useNavigate } from "react-router-dom";
import { ShieldCheck, Loader2, CheckCircle2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import Header from "@/components/Header";

type Status = "loading" | "available" | "closed" | "done";

const AdminSetup = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState<Status>("loading");
  const [claiming, setClaiming] = useState(false);

  useEffect(() => {
    const check = async () => {
      const { data, error } = await supabase.functions.invoke("bootstrap-admin", {
        method: "GET",
      });
      if (error) {
        setStatus("closed");
        return;
      }
      setStatus((data as { setup_available: boolean })?.setup_available ? "available" : "closed");
    };
    check();
  }, []);

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

            {status === "closed" && (
              <div className="text-center space-y-4 py-2">
                <Lock className="w-8 h-8 mx-auto text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Setup is closed — an admin account already exists. Ask an existing admin to grant
                  you access from the admin dashboard.
                </p>
                <Button variant="outline" onClick={() => navigate("/")}>Back to home</Button>
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
