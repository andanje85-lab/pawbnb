import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { format, isBefore } from "date-fns";
import { Handshake, MapPin, XCircle } from "lucide-react";

const statusStyles: Record<string, string> = {
  proposed: "bg-yellow-100 text-yellow-800 border-yellow-200",
  accepted: "bg-green-100 text-green-800 border-green-200",
  declined: "bg-red-100 text-red-800 border-red-200",
  completed: "bg-blue-100 text-blue-800 border-blue-200",
  cancelled: "bg-muted text-muted-foreground border-border",
};

const statusLabel: Record<string, string> = {
  proposed: "Awaiting host reply",
  accepted: "Accepted",
  declined: "Declined",
  completed: "Completed",
  cancelled: "Cancelled",
};

interface MeetGreetDialogProps {
  listingId: string;
}

const MeetGreetDialog = ({ listingId }: MeetGreetDialogProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [proposedAt, setProposedAt] = useState("");
  const [locationNote, setLocationNote] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // The guest's existing requests for this stay
  const { data: requests } = useQuery({
    queryKey: ["my-meet-greets", listingId, user?.id],
    enabled: !!user && !!listingId && open,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("meet_greets")
        .select("*")
        .eq("listing_id", listingId)
        .eq("guest_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const activeRequests = (requests || []).filter((r: any) =>
    ["proposed", "accepted"].includes(r.status),
  );

  const submit = async () => {
    if (!user) {
      toast.error("Please sign in first");
      return;
    }
    if (!proposedAt) {
      toast.error("Pick a date and time for the visit");
      return;
    }
    if (isBefore(new Date(proposedAt), new Date())) {
      toast.error("Pick a time in the future");
      return;
    }
    setSubmitting(true);
    try {
      // Host id comes from the listing so we can notify them in-app
      const { data: listing } = await supabase
        .from("listings")
        .select("host_id")
        .eq("id", listingId)
        .maybeSingle();

      const { data: created, error } = await (supabase as any)
        .from("meet_greets")
        .insert({
          listing_id: listingId,
          guest_id: user.id,
          proposed_at: new Date(proposedAt).toISOString(),
          location_note: locationNote.trim() || null,
          message: message.trim() || null,
          status: "proposed",
        })
        .select("id")
        .single();
      if (error) throw error;

      if (listing?.host_id) {
        await supabase.from("notifications").insert({
          user_id: listing.host_id,
          title: "🤝 Meet & greet request",
          body: `A guest proposed a visit on ${format(new Date(proposedAt), "MMM d 'at' h:mm a")}${locationNote.trim() ? ` — ${locationNote.trim()}` : ""}. Reply from your dashboard.`,
          type: "meet_greet",
          reference_id: created?.id ?? null,
        });
      }

      toast.success("Meet & greet request sent! The host will accept or decline.");
      setProposedAt("");
      setLocationNote("");
      setMessage("");
      setOpen(false);
      queryClient.invalidateQueries({ queryKey: ["my-meet-greets", listingId] });
      queryClient.invalidateQueries({ queryKey: ["meet-greets"] });
    } catch (error: any) {
      toast.error(error.message || "Could not send the request");
    } finally {
      setSubmitting(false);
    }
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
    queryClient.invalidateQueries({ queryKey: ["my-meet-greets", listingId] });
    queryClient.invalidateQueries({ queryKey: ["meet-greets"] });
  };

  return (
    <div className="space-y-2">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" className="w-full">
            <Handshake className="w-4 h-4 mr-2" />
            Request a Meet &amp; Greet
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Request a Meet &amp; Greet</DialogTitle>
            <DialogDescription>
              Meet the host and their space before you commit. Suggest a short
              visit — the host accepts or declines.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="mg-datetime" className="text-sm font-medium mb-2">
                Date &amp; time
              </Label>
              <Input
                id="mg-datetime"
                type="datetime-local"
                value={proposedAt}
                onChange={(e) => setProposedAt(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="mg-location" className="text-sm font-medium mb-2 flex items-center gap-1">
                <MapPin className="w-4 h-4" />
                Suggested spot (optional)
              </Label>
              <Input
                id="mg-location"
                placeholder="e.g. the dog park on Main St"
                value={locationNote}
                onChange={(e) => setLocationNote(e.target.value)}
                maxLength={200}
              />
            </div>
            <div>
              <Label htmlFor="mg-message" className="text-sm font-medium mb-2">
                Message to host (optional)
              </Label>
              <Textarea
                id="mg-message"
                placeholder="Hi! I'd love to introduce Rex before booking..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={submitting}>
              {submitting ? "Sending..." : "Send request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {activeRequests.length > 0 && (
        <div className="space-y-1.5">
          {activeRequests.map((r: any) => (
            <div
              key={r.id}
              className="flex items-center justify-between gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs"
            >
              <div className="min-w-0">
                <span className="font-medium text-foreground">
                  Visit {format(new Date(r.proposed_at), "EEE, MMM d 'at' h:mm a")}
                </span>
                {r.location_note && (
                  <span className="text-muted-foreground truncate block">{r.location_note}</span>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge variant="outline" className={statusStyles[r.status] || ""}>
                  {statusLabel[r.status] || r.status}
                </Badge>
                {r.status === "proposed" && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 text-muted-foreground hover:text-destructive"
                    onClick={() => cancelRequest(r.id)}
                    title="Cancel request"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MeetGreetDialog;
