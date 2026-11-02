import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { CalendarDays, Check, Handshake, MapPin, User, X } from "lucide-react";

const statusStyles: Record<string, string> = {
  proposed: "bg-yellow-100 text-yellow-800 border-yellow-200",
  accepted: "bg-green-100 text-green-800 border-green-200",
  declined: "bg-red-100 text-red-800 border-red-200",
  completed: "bg-blue-100 text-blue-800 border-blue-200",
  cancelled: "bg-muted text-muted-foreground border-border",
};

const statusLabel: Record<string, string> = {
  proposed: "Awaiting reply",
  accepted: "Accepted",
  declined: "Declined",
  completed: "Completed",
  cancelled: "Cancelled",
};

interface MeetGreetRow {
  id: string;
  listing_id: string;
  guest_id: string;
  proposed_at: string;
  location_note: string | null;
  message: string | null;
  status: string;
  host_response: string | null;
  created_at: string;
  listingTitle?: string;
  listingCity?: string;
  otherName?: string;
}

const MeetGreets = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [responseNote, setResponseNote] = useState("");

  // Requests guests sent to this user's listings
  const { data: hostRequests, isLoading: hostLoading } = useQuery({
    queryKey: ["meet-greets", "host", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("meet_greets")
        .select("*, listings(title, city)")
        .eq("host_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const rows = (data || []) as any[];
      const guestIds = [...new Set(rows.map((r) => r.guest_id))];
      const nameMap: Record<string, string> = {};
      if (guestIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, full_name")
          .in("user_id", guestIds);
        (profiles || []).forEach((p: any) => {
          nameMap[p.user_id] = p.full_name || "A guest";
        });
      }
      return rows.map((r) => ({
        ...r,
        listingTitle: r.listings?.title,
        listingCity: r.listings?.city,
        otherName: nameMap[r.guest_id] || "A guest",
      })) as MeetGreetRow[];
    },
  });

  // Requests this user sent as a guest
  const { data: guestRequests, isLoading: guestLoading } = useQuery({
    queryKey: ["meet-greets", "guest", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("meet_greets")
        .select("*, listings(title, city)")
        .eq("guest_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return ((data || []) as any[]).map((r) => ({
        ...r,
        listingTitle: r.listings?.title,
        listingCity: r.listings?.city,
      })) as MeetGreetRow[];
    },
  });

  const respond = async (
    request: MeetGreetRow,
    action: "accepted" | "declined" | "completed",
  ) => {
    setRespondingId(null);
    const note = responseNote.trim();
    setResponseNote("");
    const { data: updated, error } = await (supabase as any)
      .from("meet_greets")
      .update({ status: action, host_response: note || null })
      .eq("id", request.id)
      .eq("host_id", user!.id)
      .eq("status", "proposed")
      .select("id");
    if (error || !updated || updated.length === 0) {
      toast.error("Could not update the request — it may already be answered");
      return;
    }
    toast.success(
      action === "accepted"
        ? "Meet & greet accepted"
        : action === "completed"
        ? "Marked as completed"
        : "Meet & greet declined",
    );

    await supabase.from("notifications").insert({
      user_id: request.guest_id,
      title:
        action === "accepted"
          ? "🤝 Meet & greet accepted!"
          : action === "declined"
          ? "🤝 Meet & greet declined"
          : "🤝 Meet & greet completed",
      body:
        action === "declined" && note
          ? note
          : `${request.listingTitle || "Your stay"} · ${format(new Date(request.proposed_at), "EEE, MMM d 'at' h:mm a")}`,
      type: "meet_greet",
      reference_id: request.id,
    });

    queryClient.invalidateQueries({ queryKey: ["meet-greets"] });
  };

  const cancelRequest = async (id: string) => {
    const { error } = await (supabase as any)
      .from("meet_greets")
      .update({ status: "cancelled" })
      .eq("id", id)
      .eq("guest_id", user!.id);
    if (error) {
      toast.error("Could not cancel the request");
      return;
    }
    toast.success("Request cancelled");
    queryClient.invalidateQueries({ queryKey: ["meet-greets"] });
  };

  const renderCard = (r: MeetGreetRow, role: "host" | "guest") => (
    <motion.div
      key={r.id}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="p-4 rounded-xl border border-border bg-card"
    >
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div className="min-w-0">
          <h3 className="font-serif font-bold text-foreground truncate">
            {r.listingTitle || "Listing"}
          </h3>
          <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
            <MapPin className="w-3.5 h-3.5" /> {r.listingCity || "Unknown"}
          </p>
        </div>
        <Badge variant="outline" className={statusStyles[r.status] || ""}>
          {statusLabel[r.status] || r.status}
        </Badge>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm text-muted-foreground">
        <span className="flex items-center gap-1">
          <CalendarDays className="w-3.5 h-3.5" />
          {format(new Date(r.proposed_at), "EEE, MMM d 'at' h:mm a")}
        </span>
        <span className="flex items-center gap-1">
          <User className="w-3.5 h-3.5" />
          {role === "host" ? `Guest: ${r.otherName}` : "You"}
        </span>
      </div>
      {r.location_note && (
        <p className="text-sm text-muted-foreground mt-1">Spot: {r.location_note}</p>
      )}
      {r.message && (
        <p className="text-sm text-muted-foreground mt-1 italic">"{r.message}"</p>
      )}
      {r.host_response && r.status !== "proposed" && (
        <p className="text-xs text-muted-foreground mt-2 rounded-md bg-muted/50 px-2 py-1.5">
          Host reply: {r.host_response}
        </p>
      )}

      {role === "host" && r.status === "proposed" && (
        <div className="flex flex-wrap gap-2 mt-3">
          <Button size="sm" onClick={() => respond(r, "accepted")}>
            <Check className="w-3.5 h-3.5 mr-1" /> Accept
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setRespondingId(respondingId === r.id ? null : r.id);
              setResponseNote("");
            }}
          >
            <X className="w-3.5 h-3.5 mr-1" /> Decline
          </Button>
          {respondingId === r.id && (
            <div className="w-full space-y-2">
              <Textarea
                placeholder="Optional note to the guest (e.g. a reason, or a better time)..."
                value={responseNote}
                onChange={(e) => setResponseNote(e.target.value)}
                rows={2}
              />
              <Button size="sm" variant="destructive" onClick={() => respond(r, "declined")}>
                Confirm decline
              </Button>
            </div>
          )}
        </div>
      )}
      {role === "host" && r.status === "accepted" && (
        <Button size="sm" variant="outline" className="mt-3" onClick={() => respond(r, "completed")}>
          <Check className="w-3.5 h-3.5 mr-1" /> Mark as completed
        </Button>
      )}
      {role === "guest" && r.status === "proposed" && (
        <Button size="sm" variant="ghost" className="mt-3 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => cancelRequest(r.id)}>
          <X className="w-3.5 h-3.5 mr-1" /> Cancel request
        </Button>
      )}
    </motion.div>
  );

  const hostPending = (hostRequests || []).filter((r) => r.status === "proposed");
  const hostOthers = (hostRequests || []).filter((r) => r.status !== "proposed");

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-serif text-lg font-bold text-foreground mb-1">
          Requests to host
        </h2>
        <p className="text-sm text-muted-foreground mb-3">
          Guests who want to visit your place before booking. Accept, decline, or
          mark visits done.
        </p>
        {hostLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-32 rounded-xl" />
            <Skeleton className="h-32 rounded-xl" />
          </div>
        ) : !hostRequests || hostRequests.length === 0 ? (
          <p className="text-sm text-muted-foreground rounded-xl border border-border bg-card p-4">
            No meet &amp; greet requests yet. Guests can request one from your
            stay's page.
          </p>
        ) : (
          <div className="space-y-4">
            {hostPending.map((r) => renderCard(r, "host"))}
            {hostOthers.map((r) => renderCard(r, "host"))}
          </div>
        )}
      </div>

      <div>
        <h2 className="font-serif text-lg font-bold text-foreground mb-1">
          Your requests as a guest
        </h2>
        <p className="text-sm text-muted-foreground mb-3">
          Visits you proposed before booking, and the host's replies.
        </p>
        {guestLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-32 rounded-xl" />
          </div>
        ) : !guestRequests || guestRequests.length === 0 ? (
          <p className="text-sm text-muted-foreground rounded-xl border border-border bg-card p-4">
            No requests yet. Use "Request a Meet &amp; Greet" on any stay's page.
          </p>
        ) : (
          <div className="space-y-4">
            {guestRequests.map((r) => renderCard(r, "guest"))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MeetGreets;
