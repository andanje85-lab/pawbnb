import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Star, MessageSquare, Loader2, EyeOff, Eye, Flag } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { Link } from "react-router-dom";

const STATUSES = ["published", "flagged", "hidden"] as const;

const statusColor = (s: string) => {
  switch (s) {
    case "published": return "bg-green-100 text-green-800 border-green-200";
    case "flagged": return "bg-yellow-100 text-yellow-800 border-yellow-200";
    case "hidden": return "bg-red-100 text-red-800 border-red-200";
    default: return "bg-muted text-muted-foreground border-border";
  }
};

export const ReviewModeration = ({ search }: { search: string }) => {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [statusFilter, setStatusFilter] = useState<string>("flagged");
  const [decision, setDecision] = useState<{ id: string; status: string; notes: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-reviews"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("reviews")
        .select("*, listings:listing_id(title)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      const ids = [...new Set((data || []).map((r: any) => r.reviewer_id))];
      const { data: profiles } = await supabase
        .from("profiles").select("user_id, full_name").in("user_id", ids as string[]);
      const map = new Map((profiles || []).map((p) => [p.user_id, p.full_name]));
      return (data || []).map((r: any) => ({ ...r, reviewer_name: map.get(r.reviewer_id) || "Guest" }));
    },
  });

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data || []).filter((r: any) => {
      if (statusFilter !== "all" && r.moderation_status !== statusFilter) return false;
      if (!q) return true;
      return (
        (r.comment || "").toLowerCase().includes(q) ||
        (r.reviewer_name || "").toLowerCase().includes(q) ||
        (r.listings?.title || "").toLowerCase().includes(q)
      );
    });
  }, [data, statusFilter, search]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: (data || []).length };
    for (const s of STATUSES) c[s] = (data || []).filter((r: any) => r.moderation_status === s).length;
    return c;
  }, [data]);

  const save = async () => {
    if (!decision) return;
    setSaving(true);
    const { error } = await (supabase as any)
      .from("reviews")
      .update({
        moderation_status: decision.status,
        moderation_notes: decision.notes.trim() || null,
        moderated_by: user?.id ?? null,
        moderated_at: new Date().toISOString(),
      })
      .eq("id", decision.id);
    setSaving(false);
    if (error) {
      toast.error("Couldn't update review", { description: error.message });
      return;
    }
    toast.success(`Review marked ${decision.status}`);
    setDecision(null);
    qc.invalidateQueries({ queryKey: ["admin-reviews"] });
    qc.invalidateQueries({ queryKey: ["reviews"] });
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All reviews ({counts.all})</SelectItem>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s} className="capitalize">{s} ({counts[s] ?? 0})</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-sm text-muted-foreground">{rows.length} shown</p>
      </div>

      {rows.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">No reviews in this state.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((r: any) => (
            <div key={r.id} className="border border-border rounded-lg p-4 bg-card">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className={`capitalize ${statusColor(r.moderation_status)}`}>
                      {r.moderation_status}
                    </Badge>
                    <span className="inline-flex items-center gap-0.5">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star key={s} className={`w-3.5 h-3.5 ${s <= r.rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/25"}`} />
                      ))}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                    </span>
                  </div>
                  <p className="text-sm mt-2 text-foreground">{r.comment || <span className="italic text-muted-foreground">No written comment</span>}</p>
                  <p className="text-xs text-muted-foreground mt-2">
                    By <Link to={`/u/${r.reviewer_id}`} className="hover:underline">{r.reviewer_name}</Link>
                    {" · "}
                    <Link to={`/listing/${r.listing_id}`} className="hover:underline">{r.listings?.title || "Listing"}</Link>
                  </p>
                  {r.moderation_notes && (
                    <p className="text-xs text-muted-foreground mt-1.5 italic">Note: {r.moderation_notes}</p>
                  )}
                </div>
                <div className="flex gap-2 shrink-0">
                  {r.moderation_status !== "flagged" && (
                    <Button variant="outline" size="sm" onClick={() => setDecision({ id: r.id, status: "flagged", notes: r.moderation_notes || "" })}>
                      <Flag className="w-3.5 h-3.5 mr-1.5" />Flag
                    </Button>
                  )}
                  {r.moderation_status !== "hidden" && (
                    <Button variant="outline" size="sm" onClick={() => setDecision({ id: r.id, status: "hidden", notes: r.moderation_notes || "" })}>
                      <EyeOff className="w-3.5 h-3.5 mr-1.5" />Hide
                    </Button>
                  )}
                  {r.moderation_status !== "published" && (
                    <Button size="sm" onClick={() => setDecision({ id: r.id, status: "published", notes: r.moderation_notes || "" })}>
                      <Eye className="w-3.5 h-3.5 mr-1.5" />Publish
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!decision} onOpenChange={(o) => !o && setDecision(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="capitalize">Mark review {decision?.status}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Textarea
              value={decision?.notes ?? ""}
              onChange={(e) => setDecision((d) => (d ? { ...d, notes: e.target.value } : d))}
              placeholder="Internal moderation note (optional)"
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDecision(null)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ReviewModeration;
