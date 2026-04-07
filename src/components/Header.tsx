import { useState, useEffect } from "react";
import { Dog, Menu, X, Heart, User, LogOut, ShieldCheck, MessageSquare, Bell, BellOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { useHostNotifications } from "@/hooks/useHostNotifications";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const Header = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, signOut } = useAuth();
  const [staffRole, setStaffRole] = useState<string | null>(null);
  const { permissionState, requestPermission } = useHostNotifications();

  useEffect(() => {
    if (!user) { setStaffRole(null); return; }
    (supabase as any)
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }: { data: { role: string } | null }) => {
        setStaffRole(data?.role ?? null);
      });
  }, [user]);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-2 group">
            <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center">
              <Dog className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="font-serif text-xl font-bold text-foreground">PawBnB</span>
          </Link>

          <nav className="hidden md:flex items-center gap-8">
            <a href="#listings" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Explore</a>
            <a href="#how-it-works" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">How It Works</a>
            <a href="#trust" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Trust & Safety</a>
          </nav>

          <div className="hidden md:flex items-center gap-3">
            <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
              <Heart className="w-5 h-5" />
            </Button>
            {user ? (
              <>
                <Link to="/dashboard"><Button variant="ghost" size="sm">Dashboard</Button></Link>
                <Link to="/messages"><Button variant="ghost" size="sm"><MessageSquare className="w-4 h-4 mr-1" />Messages</Button></Link>
                <Link to="/profile"><Button variant="ghost" size="sm">Profile</Button></Link>
                {staffRole && (
                  <Link to="/admin">
                    <Button variant="ghost" size="sm" className="gap-1">
                      <ShieldCheck className="w-4 h-4" />
                      Admin
                    </Button>
                  </Link>
                )}
                <Link to="/create-listing"><Button variant="outline" size="sm">Become a Host</Button></Link>
                <Button variant="ghost" size="sm" onClick={signOut}>
                  <LogOut className="w-4 h-4 mr-1" />
                  Sign Out
                </Button>
              </>
            ) : (
              <>
                <Link to="/create-listing"><Button variant="outline" size="sm">Become a Host</Button></Link>
                <Link to="/auth">
                  <Button size="sm">
                    <User className="w-4 h-4 mr-1" />
                    Sign In
                  </Button>
                </Link>
              </>
            )}
          </div>

          <button className="md:hidden p-2 text-foreground" onClick={() => setMobileOpen(!mobileOpen)}>
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="md:hidden border-t border-border bg-background overflow-hidden"
          >
            <div className="px-4 py-4 space-y-3">
              <a href="#listings" className="block text-sm font-medium text-muted-foreground">Explore</a>
              <a href="#how-it-works" className="block text-sm font-medium text-muted-foreground">How It Works</a>
              <a href="#trust" className="block text-sm font-medium text-muted-foreground">Trust & Safety</a>
              <div className="flex flex-col gap-2 pt-2">
                {user ? (
                  <>
                    <div className="flex gap-2">
                      <Link to="/dashboard" className="flex-1">
                        <Button variant="outline" size="sm" className="w-full">Dashboard</Button>
                      </Link>
                      <Link to="/messages" className="flex-1">
                        <Button variant="outline" size="sm" className="w-full"><MessageSquare className="w-4 h-4 mr-1" />Messages</Button>
                      </Link>
                    </div>
                    <Link to="/profile">
                      <Button variant="outline" size="sm" className="w-full">Profile</Button>
                    </Link>
                    {staffRole && (
                      <Link to="/admin">
                        <Button variant="outline" size="sm" className="w-full gap-1">
                          <ShieldCheck className="w-4 h-4" />
                          Admin
                        </Button>
                      </Link>
                    )}
                    <Button variant="outline" size="sm" className="w-full" onClick={signOut}>
                      <LogOut className="w-4 h-4 mr-1" />
                      Sign Out
                    </Button>
                  </>
                ) : (
                  <Link to="/auth" className="flex-1">
                    <Button size="sm" className="w-full">Sign In</Button>
                  </Link>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
};

export default Header;
