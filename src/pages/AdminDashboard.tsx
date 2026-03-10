import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { motion } from "framer-motion";
import {
  ShieldCheck, Users, CalendarDays, MapPin, Dog, ToggleLeft,
  ToggleRight, Trash2, Search, UserCog, Plus, X, Mail, ClipboardList,
  UserPlus, UserMinus
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import listing1 from "@/assets/listing-1.jpg";

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
  confirmed: "bg-green-100 text-green-800 border-green-200",
  cancelled: "bg-red-100 text-red-800 border-red-200",
};

const AdminDashboard = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [removeRoleTarget, setRemoveRoleTarget] = useState<{ userId: string; name: string; role: string } | null>(null);

  const handleInviteStaff = async () => {
    if (!inviteEmail.trim()) return;
    setInviting(true);
    try {
      const { data, error } = await supabase.functions.invoke("invite-staff", {
        body: { email: inviteEmail.trim() },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(data.message || "Staff member invited!");
      setInviteEmail("");
      setInviteOpen(false);
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      queryClient.invalidateQueries({ queryKey: ["audit-logs"] });
    } catch (err: any) {
      toast.error(err.message || "Failed to invite staff member");
    } finally {
      setInviting(false);
    }
  };

  // Fetch current user role
  const { data: myRole, isLoading: roleLoading } = useQuery({
    queryKey: ["my-role", user?.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("get_my_role");
      if (error) return null;
      return data as string | null;
    },
    enabled: !!user,
  });

  // All listings (admin/worker)
  const { data: allListings, isLoading: listingsLoading } = useQuery({
    queryKey: ["admin-listings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("listings")
        .select("*, listing_photos(url, sort_order)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!myRole,
  });

  // All bookings (admin/worker)
  const { data: allBookings, isLoading: bookingsLoading } = useQuery({
    queryKey: ["admin-bookings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select("*, listings(title, city)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!myRole,
  });

  // All users/profiles (admin only)
  const { data: allUsers, isLoading: usersLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const { data: profiles, error } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      const { data: roles } = await (supabase as any).from("user_roles").select("user_id, role");
      const roleMap: Record<string, string> = {};
      ((roles || []) as any[]).forEach((r) => { roleMap[r.user_id] = r.role; });
      return (profiles || []).map((p) => ({ ...p, staffRole: roleMap[p.user_id] || null }));
    },
    enabled: myRole === "admin",
  });

  // Audit logs (admin only)
  const { data: auditLogs, isLoading: auditLoading } = useQuery({
    queryKey: ["audit-logs"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      // Enrich with profile names
      const userIds = [...new Set([
        ...(data || []).map((l: any) => l.actor_id),
        ...(data || []).map((l: any) => l.target_user_id),
      ])];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", userIds as string[]);
      const nameMap: Record<string, string> = {};
      (profiles || []).forEach((p) => { nameMap[p.user_id] = p.full_name || "Unknown"; });
      return (data || []).map((log: any) => ({
        ...log,
        actorName: nameMap[log.actor_id] || "Unknown",
        targetName: nameMap[log.target_user_id] || "Unknown",
      }));
    },
    enabled: myRole === "admin",
  });

  const writeAuditLog = async (action: string, targetUserId: string, role: string) => {
    if (!user) return;
    await (supabase as any).from("audit_logs").insert({
      action,
      actor_id: user.id,
      target_user_id: targetUserId,
      role,
    });
    queryClient.invalidateQueries({ queryKey: ["audit-logs"] });
  };

  const getListingPhoto = (listing: any) => {
    const photos = (listing?.listing_photos || []).sort((a: any, b: any) => a.sort_order - b.sort_order);
    return photos[0]?.url || listing1;
  };

  const toggleListingActive = async (listingId: string, currentlyActive: boolean) => {
    const { error } = await supabase.from("listings").update({ is_active: !currentlyActive }).eq("id", listingId);
    if (error) toast.error("Failed to update listing");
    else {
      toast.success(currentlyActive ? "Listing deactivated" : "Listing activated");
      queryClient.invalidateQueries({ queryKey: ["admin-listings"] });
    }
  };

  const deleteListing = async (listingId: string) => {
    if (!confirm("Are you sure you want to delete this listing?")) return;
    const { error } = await supabase.from("listings").delete().eq("id", listingId);
    if (error) toast.error("Failed to delete listing");
    else {
      toast.success("Listing deleted");
      queryClient.invalidateQueries({ queryKey: ["admin-listings"] });
    }
  };

  const updateBookingStatus = async (bookingId: string, status: string) => {
    const { error } = await supabase.from("bookings").update({ status }).eq("id", bookingId);
    if (error) toast.error("Failed to update booking");
    else {
      toast.success(`Booking ${status}`);
      queryClient.invalidateQueries({ queryKey: ["admin-bookings"] });
    }
  };

  const assignRole = async (userId: string, role: "admin" | "worker") => {
    const { error } = await (supabase as any).from("user_roles").insert({ user_id: userId, role });
    if (error) toast.error((error as any).message);
    else {
      toast.success(`Role '${role}' assigned`);
      await writeAuditLog("role_assigned", userId, role);
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    }
  };

  const removeRole = async (userId: string, role: string) => {
    const { error } = await (supabase as any).from("user_roles").delete().eq("user_id", userId);
    if (error) toast.error(error.message);
    else {
      toast.success("Role removed");
      await writeAuditLog("role_removed", userId, role);
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    }
  };

  if (authLoading || roleLoading) return null;

  if (!user || !myRole) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="pt-24 pb-16 flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <ShieldCheck className="w-12 h-12 text-muted-foreground/40 mx-auto mb-4" />
            <h1 className="font-serif text-2xl font-bold text-foreground mb-2">Access Denied</h1>
            <p className="text-muted-foreground mb-4">You need staff permissions to view this page.</p>
            <Button onClick={() => navigate("/auth")}>Sign In</Button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const filteredListings = (allListings || []).filter(
    (l) => !search || l.title?.toLowerCase().includes(search.toLowerCase()) || l.city?.toLowerCase().includes(search.toLowerCase())
  );

  const filteredBookings = (allBookings || []).filter(
    (b) => !search || (b.listings as any)?.title?.toLowerCase().includes(search.toLowerCase())
  );

  const filteredUsers = (allUsers || []).filter(
    (u) => !search || u.full_name?.toLowerCase().includes(search.toLowerCase()) || u.city?.toLowerCase().includes(search.toLowerCase())
  );

  const filteredAuditLogs = (auditLogs || []).filter(
    (l: any) => !search || l.actorName?.toLowerCase().includes(search.toLowerCase()) || l.targetName?.toLowerCase().includes(search.toLowerCase()) || l.role?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="pt-20 pb-24">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <div className="flex items-center gap-3 mb-1">
              <ShieldCheck className="w-6 h-6 text-primary" />
              <h1 className="font-serif text-3xl font-bold text-foreground">Staff Dashboard</h1>
              <Badge variant="outline" className="capitalize">{myRole}</Badge>
            </div>
            <p className="text-muted-foreground mb-6">Platform management for PawBnB staff</p>

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
              <StatCard icon={<Dog className="w-5 h-5 text-primary" />} label="Total Listings" value={allListings?.length ?? "—"} />
              <StatCard icon={<CalendarDays className="w-5 h-5 text-primary" />} label="Total Bookings" value={allBookings?.length ?? "—"} />
              {myRole === "admin" && (
                <StatCard icon={<Users className="w-5 h-5 text-primary" />} label="Total Users" value={allUsers?.length ?? "—"} />
              )}
            </div>

            {/* Search */}
            <div className="relative mb-6">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search listings, bookings, users..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            <Tabs defaultValue="listings">
              <TabsList className="mb-6">
                <TabsTrigger value="listings">Listings</TabsTrigger>
                <TabsTrigger value="bookings">Bookings</TabsTrigger>
                {myRole === "admin" && <TabsTrigger value="users">Users</TabsTrigger>}
                {myRole === "admin" && (
                  <TabsTrigger value="audit" className="gap-1.5">
                    <ClipboardList className="w-3.5 h-3.5" />
                    Audit Log
                  </TabsTrigger>
                )}
              </TabsList>

              {/* Listings Tab */}
              <TabsContent value="listings">
                {listingsLoading ? <LoadingCards /> : filteredListings.length === 0 ? (
                  <EmptyState label="No listings found" />
                ) : (
                  <div className="space-y-3">
                    {filteredListings.map((listing) => (
                      <motion.div key={listing.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        className="flex gap-4 p-4 rounded-xl border border-border bg-card items-center"
                      >
                        <img
                          src={getListingPhoto(listing)} alt={listing.title}
                          className="w-20 h-16 rounded-lg object-cover shrink-0 cursor-pointer"
                          onClick={() => navigate(`/listing/${listing.id}`)}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="font-serif font-bold text-foreground truncate text-sm">{listing.title}</h3>
                            <Badge variant={listing.is_active ? "default" : "secondary"} className="text-xs">
                              {listing.is_active ? "Active" : "Inactive"}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            <MapPin className="w-3 h-3" /> {listing.city || "Unknown"} · ${listing.price_per_night}/night · Max {listing.max_dogs} dogs
                          </p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button variant="ghost" size="icon" onClick={() => toggleListingActive(listing.id, listing.is_active)}
                            title={listing.is_active ? "Deactivate" : "Activate"}
                          >
                            {listing.is_active
                              ? <ToggleRight className="w-5 h-5 text-primary" />
                              : <ToggleLeft className="w-5 h-5 text-muted-foreground" />}
                          </Button>
                          {myRole === "admin" && (
                            <Button variant="ghost" size="icon" onClick={() => deleteListing(listing.id)}>
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* Bookings Tab */}
              <TabsContent value="bookings">
                {bookingsLoading ? <LoadingCards /> : filteredBookings.length === 0 ? (
                  <EmptyState label="No bookings found" />
                ) : (
                  <div className="space-y-3">
                    {filteredBookings.map((booking) => {
                      const listingData = booking.listings as any;
                      return (
                        <motion.div key={booking.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                          className="p-4 rounded-xl border border-border bg-card"
                        >
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <div>
                              <h3 className="font-serif font-bold text-foreground text-sm">{listingData?.title}</h3>
                              <p className="text-xs text-muted-foreground flex items-center gap-1">
                                <MapPin className="w-3 h-3" /> {listingData?.city || "Unknown"}
                              </p>
                            </div>
                            <Badge variant="outline" className={`${statusColors[booking.status] || ""} text-xs`}>
                              {booking.status}
                            </Badge>
                          </div>
                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground mt-2 mb-2">
                            <span className="flex items-center gap-1">
                              <CalendarDays className="w-3 h-3" />
                              {format(new Date(booking.check_in), "MMM d")} – {format(new Date(booking.check_out), "MMM d, yyyy")}
                            </span>
                            <span className="flex items-center gap-1">
                              <Dog className="w-3 h-3" /> {booking.number_of_dogs} dog{booking.number_of_dogs > 1 ? "s" : ""}
                            </span>
                            <span className="font-medium text-foreground">${booking.total_price}</span>
                          </div>
                          {booking.status === "pending" && (
                            <div className="flex gap-2">
                              <Button size="sm" onClick={() => updateBookingStatus(booking.id, "confirmed")}>Confirm</Button>
                              <Button size="sm" variant="outline" onClick={() => updateBookingStatus(booking.id, "cancelled")}>Cancel</Button>
                            </div>
                          )}
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </TabsContent>

              {/* Users Tab (Admin only) */}
              {myRole === "admin" && (
                <TabsContent value="users">
                  <div className="flex justify-end mb-4">
                    <Button size="sm" onClick={() => setInviteOpen(true)} className="gap-2">
                      <Mail className="w-4 h-4" />
                      Invite Staff by Email
                    </Button>
                  </div>
                  {usersLoading ? <LoadingCards /> : filteredUsers.length === 0 ? (
                    <EmptyState label="No users found" />
                  ) : (
                    <div className="space-y-3">
                      {filteredUsers.map((u) => (
                        <motion.div key={u.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                          className="flex items-center gap-4 p-4 rounded-xl border border-border bg-card"
                        >
                          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            <Users className="w-5 h-5 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm text-foreground truncate">{u.full_name || "Unnamed user"}</span>
                              {u.staffRole && (
                                <Badge variant="outline" className="text-xs capitalize">{u.staffRole}</Badge>
                              )}
                              {u.is_host && <Badge variant="secondary" className="text-xs">Host</Badge>}
                            </div>
                            <p className="text-xs text-muted-foreground">{u.city || "No city"}</p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {!u.staffRole ? (
                              <Select onValueChange={(role) => assignRole(u.user_id, role as "admin" | "worker")}>
                                <SelectTrigger className="h-8 text-xs w-32">
                                  <SelectValue placeholder="Assign role" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="worker">Worker</SelectItem>
                                  <SelectItem value="admin">Admin</SelectItem>
                                </SelectContent>
                              </Select>
                            ) : (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setRemoveRoleTarget({ userId: u.user_id, name: u.full_name || "this user", role: u.staffRole })}
                                title="Remove role"
                              >
                                <X className="w-4 h-4 text-destructive" />
                              </Button>
                            )}
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </TabsContent>
              )}

              {/* Audit Log Tab (Admin only) */}
              {myRole === "admin" && (
                <TabsContent value="audit">
                  {auditLoading ? (
                    <LoadingCards />
                  ) : filteredAuditLogs.length === 0 ? (
                    <EmptyState label="No audit log entries yet" />
                  ) : (
                    <div className="space-y-2">
                      {filteredAuditLogs.map((log: any) => {
                        const isAssign = log.action === "role_assigned";
                        return (
                          <motion.div
                            key={log.id}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="flex items-start gap-3 p-4 rounded-xl border border-border bg-card"
                          >
                            <div className={`mt-0.5 w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                              isAssign ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                            }`}>
                              {isAssign
                                ? <UserPlus className="w-4 h-4" />
                                : <UserMinus className="w-4 h-4" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-foreground">
                                <span className="font-medium">{log.actorName}</span>
                                {" "}
                                <span className="text-muted-foreground">
                                  {isAssign ? "assigned" : "removed"}
                                </span>
                                {" "}
                                <Badge variant="outline" className="text-xs capitalize mx-0.5">{log.role}</Badge>
                                {" "}
                                <span className="text-muted-foreground">
                                  {isAssign ? "role to" : "role from"}
                                </span>
                                {" "}
                                <span className="font-medium">{log.targetName}</span>
                              </p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                                {" · "}
                                {format(new Date(log.created_at), "MMM d, yyyy 'at' h:mm a")}
                              </p>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  )}
                </TabsContent>
              )}
            </Tabs>
          </motion.div>
        </div>
      </main>
      <Footer />

      {/* Invite Staff Dialog */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif">Invite Staff Member</DialogTitle>
            <DialogDescription>
              Enter an email address to invite someone as a worker. If they don't have an account yet, they'll receive an invitation email.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="email"
                  placeholder="colleague@example.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleInviteStaff()}
                  className="pl-9"
                  disabled={inviting}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setInviteOpen(false); setInviteEmail(""); }} disabled={inviting}>
                Cancel
              </Button>
              <Button onClick={handleInviteStaff} disabled={inviting || !inviteEmail.trim()} className="gap-2">
                {inviting ? "Sending..." : (
                  <><Mail className="w-4 h-4" /> Send Invite</>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Remove Role Confirmation */}
      <AlertDialog open={!!removeRoleTarget} onOpenChange={(open) => !open && setRemoveRoleTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove staff role?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the <span className="font-semibold capitalize">{removeRoleTarget?.role}</span> role from{" "}
              <span className="font-semibold">{removeRoleTarget?.name}</span>. They will lose all staff permissions immediately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (removeRoleTarget) removeRole(removeRoleTarget.userId, removeRoleTarget.role);
                setRemoveRoleTarget(null);
              }}
            >
              Remove Role
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

const StatCard = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: number | string }) => (
  <div className="p-4 rounded-xl border border-border bg-card">
    <div className="flex items-center gap-2 mb-1">{icon}<span className="text-xs text-muted-foreground">{label}</span></div>
    <p className="font-serif text-2xl font-bold text-foreground">{value}</p>
  </div>
);

const LoadingCards = () => (
  <div className="space-y-3">
    {[1, 2, 3].map((i) => (
      <div key={i} className="flex gap-4 p-4 rounded-xl border border-border">
        <Skeleton className="w-20 h-16 rounded-lg" />
        <div className="flex-1 space-y-2"><Skeleton className="h-4 w-2/3" /><Skeleton className="h-3 w-1/3" /></div>
      </div>
    ))}
  </div>
);

const EmptyState = ({ label }: { label: string }) => (
  <div className="text-center py-12">
    <ClipboardList className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
    <p className="text-muted-foreground text-sm">{label}</p>
  </div>
);

export default AdminDashboard;
