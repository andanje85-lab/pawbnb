import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  ShieldCheck, ShieldAlert, Mail, Search, UserPlus, ArrowLeft, Users, Loader2, X,
} from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type StaffRole = "admin" | "worker";

const RoleManagement = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<StaffRole>("worker");
  const [inviting, setInviting] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<{ userId: string; name: string; role: string } | null>(null);

  const { data: myRole, isLoading: roleLoading } = useQuery({
    queryKey: ["my-role", user?.id],
    queryFn: async () => {
      const { data } = await (supabase as any).rpc("get_my_role");
      return (data as string | null) ?? null;
    },
    enabled: !!user,
  });

  const isAdmin = myRole === "admin";

  const { data: people, isLoading: peopleLoading } = useQuery({
    queryKey: ["role-management-people"],
    queryFn: async () => {
      const { data: profiles, error } = await supabase
        .from("profiles")
        .select("user_id, full_name, city, is_host, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      const { data: roles } = await (supabase as any).from("user_roles").select("user_id, role");
      const roleMap: Record<string, string> = {};
      ((roles || []) as any[]).forEach((r) => { roleMap[r.user_id] = r.role; });
      return (profiles || []).map((p) => ({ ...p, staffRole: roleMap[p.user_id] || null }));
    },
    enabled: isAdmin,
  });

  const matches = (p: any) =>
    !search ||
    (p.full_name || "").toLowerCase().includes(search.toLowerCase()) ||
    (p.city || "").toLowerCase().includes(search.toLowerCase());

  const staff = useMemo(() => (people || []).filter((p) => p.staffRole).filter(matches), [people, search]);
  const others = useMemo(() => (people || []).filter((p) => !p.staffRole).filter(matches), [people, search]);
  const adminCount = (people || []).filter((p) => p.staffRole === "admin").length;

  const logAudit = async (action: string, targetUserId: string, role: string) => {
    if (!user) return;
    await (supabase as any).from("audit_logs").insert({
      action, actor_id: user.id, target_user_id: targetUserId, role,
    });
  };

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["role-management-people"] });
    qc.invalidateQueries({ queryKey: ["admin-users"] });
    qc.invalidateQueries({ queryKey: ["audit-logs"] });
  };

  const grantRole = async (userId: string, role: StaffRole) => {
    const { error } = await (supabase as any).from("user_roles").insert({ user_id: userId, role });
    if (error) return toast.error(error.message);
    await logAudit("role_assigned", userId, role);
    toast.success(`${role === "admin" ? "Admin" : "Worker"} access granted`);
    refresh();
  };

  const changeRole = async (userId: string, role: StaffRole) => {
    const { error: delErr } = await (supabase as any).from("user_roles").delete().eq("user_id", userId);
    if (delErr) return toast.error(delErr.message);
    await grantRole(userId, role);
  };

  const revokeRole = async (userId: string, role: string) => {
    const { error } = await (supabase as any).from("user_roles").delete().eq("user_id", userId);
    if (error) return toast.error(error.message);
    await logAudit("role_removed", userId, role);
    toast.success("Staff access revoked");
    refresh();
  };

  const invite = async () => {
    if (!inviteEmail.trim()) return;
    setInviting(true);
    try {
      const { data, error } = await supabase.functions.invoke("invite-staff", {
        body: { email: inviteEmail.trim(), role: inviteRole },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success((data as any).message || "Invitation sent");
      setInviteEmail("");
      setInviteOpen(false);
      refresh();
    } catch (err: any) {
      toast.error(err.message || "Failed to invite");
    } finally {
      setInviting(false);
    }
  };

  if (authLoading || roleLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="max-w-4xl mx-auto px-4 pt-28 space-y-3">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </main>
      </div>
    );
  }

  if (!user || !isAdmin) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="max-w-md mx-auto px-4 pt-32 text-center space-y-4">
          <ShieldAlert className="w-10 h-10 mx-auto text-muted-foreground" />
          <h1 className="font-serif text-2xl font-bold text-foreground">Admins only</h1>
          <p className="text-sm text-muted-foreground">
            You need an admin role to manage staff access.
          </p>
          <Button variant="outline" onClick={() => navigate(user ? "/dashboard" : "/auth")}>
            {user ? "Back to dashboard" : "Sign in"}
          </Button>
        </main>
      </div>
    );
  }

  const RoleBadge = ({ role }: { role: string }) => (
    <Badge variant={role === "admin" ? "default" : "outline"} className="text-xs capitalize">
      {role}
    </Badge>
  );

  const PersonRow = ({ p }: { p: any }) => {
    const isSelf = p.user_id === user.id;
    const lastAdmin = p.staffRole === "admin" && adminCount <= 1;
    return (
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        className="flex flex-wrap items-center gap-3 p-4 rounded-xl border border-border bg-card"
      >
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <Users className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm text-foreground truncate">
              {p.full_name || "Unnamed user"}
            </span>
            {p.staffRole && <RoleBadge role={p.staffRole} />}
            {isSelf && <Badge variant="secondary" className="text-xs">You</Badge>}
            {p.is_host && <Badge variant="secondary" className="text-xs">Host</Badge>}
          </div>
          <p className="text-xs text-muted-foreground">
            {p.city || "No city"} · joined {format(new Date(p.created_at), "MMM d, yyyy")}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Select
            value={p.staffRole ?? undefined}
            onValueChange={(role) =>
              p.staffRole ? changeRole(p.user_id, role as StaffRole) : grantRole(p.user_id, role as StaffRole)
            }
          >
            <SelectTrigger className="h-8 text-xs w-32">
              <SelectValue placeholder="Grant role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="worker">Worker</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
            </SelectContent>
          </Select>
          {p.staffRole && (
            <Button
              variant="ghost"
              size="icon"
              title={lastAdmin ? "Cannot revoke the last admin" : "Revoke staff access"}
              disabled={lastAdmin}
              onClick={() =>
                setRevokeTarget({ userId: p.user_id, name: p.full_name || "this user", role: p.staffRole })
              }
            >
              <X className="w-4 h-4 text-destructive" />
            </Button>
          )}
        </div>
      </motion.div>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Staff & Roles | PawBnB Admin</title>
        <meta name="description" content="Invite, list, and revoke worker and admin roles for PawBnB users." />
        <meta name="robots" content="noindex,nofollow" />
      </Helmet>
      <Header />
      <main className="pt-20 pb-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <Link to="/admin" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
            <ArrowLeft className="w-4 h-4" /> Back to staff dashboard
          </Link>

          <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
            <div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-6 h-6 text-primary" />
                <h1 className="font-serif text-3xl font-bold text-foreground">Staff & roles</h1>
              </div>
              <p className="text-muted-foreground text-sm mt-1">
                Invite staff by email, change roles, and revoke access. {adminCount} admin
                {adminCount === 1 ? "" : "s"} · {staff.length} staff shown.
              </p>
            </div>
            <Button className="gap-2" onClick={() => setInviteOpen(true)}>
              <Mail className="w-4 h-4" /> Invite staff
            </Button>
          </div>

          <div className="relative mb-6">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or city…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <Tabs defaultValue="staff">
            <TabsList className="mb-6">
              <TabsTrigger value="staff">Current staff ({staff.length})</TabsTrigger>
              <TabsTrigger value="users">All users ({others.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="staff">
              {peopleLoading ? (
                <Skeleton className="h-24 w-full" />
              ) : staff.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-10">
                  No staff members match your search.
                </p>
              ) : (
                <div className="space-y-3">{staff.map((p) => <PersonRow key={p.user_id} p={p} />)}</div>
              )}
            </TabsContent>

            <TabsContent value="users">
              {peopleLoading ? (
                <Skeleton className="h-24 w-full" />
              ) : others.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-10">No users match your search.</p>
              ) : (
                <div className="space-y-3">{others.map((p) => <PersonRow key={p.user_id} p={p} />)}</div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </main>
      <Footer />

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-primary" /> Invite a staff member
            </DialogTitle>
            <DialogDescription>
              They receive an email invitation and get the selected role immediately. Existing
              accounts are granted the role without a new invite.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              type="email"
              placeholder="name@example.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
            />
            <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as StaffRole)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="worker">Worker — triage and support access</SelectItem>
                <SelectItem value="admin">Admin — full access incl. roles</SelectItem>
              </SelectContent>
            </Select>
            <Button className="w-full" onClick={invite} disabled={inviting || !inviteEmail.trim()}>
              {inviting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Send invitation
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!revokeTarget} onOpenChange={(open) => !open && setRevokeTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke staff access?</AlertDialogTitle>
            <AlertDialogDescription>
              {revokeTarget?.name} will lose the {revokeTarget?.role} role and all staff tools. They
              keep their regular guest and host access.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (revokeTarget) revokeRole(revokeTarget.userId, revokeTarget.role);
                setRevokeTarget(null);
              }}
            >
              Revoke
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default RoleManagement;
