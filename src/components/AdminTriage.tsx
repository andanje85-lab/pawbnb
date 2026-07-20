import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Flag, ShieldAlert, ClipboardList, Calendar, DollarSign, Mail, Phone, User } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { Link } from "react-router-dom";

const REPORT_STATUSES = ["open", "reviewing", "resolved", "dismissed"] as const;
const CLAIM_STATUSES = ["submitted", "reviewing", "approved", "denied", "paid"] as const;

const statusColor = (status: string) => {
  switch (status) {
    case "open":
    case "submitted":
      return "bg-yellow-100 text-yellow-800 border-yellow-200";
    case "reviewing":
      return "bg-blue-100 text-blue-800 border-blue-200";
    case "resolved":
    case "approved":
    case "paid":
      return "bg-green-100 text-green-800 border-green-200";
    case "dismissed":
    case "denied":
      return "bg-red-100 text-red-800 border-red-200";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
};

type ResolveTarget =
  | { kind: "report"; id: string; status: string; notes: string }
  | { kind: "claim"; id: string; status: string; notes: string }
  | null;

export const ReportsTriage = ({ search }: { search: string }) => {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [resolve, setResolve] = useState<ResolveTarget>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-reports"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("reports")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      const ids = [...new Set((data || []).map((r: any) => r.reporter_id))];
      const { data: profiles } = await supabase
        .from("profiles").select("user_id, full_name").in("user_id", ids as string[]);
      const map: Record<string, string> = {};
      (profiles || []).forEach((p) => { map[p.user_id] = p.full_name || "Unknown"; });
      return (data || []).map((r: any) => ({ ...r, reporterName: map[r.reporter_id] || "Unknown" }));
    },
  });

  const filtered = useMemo(() => (data || []).filter((r: any) => {
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    if (typeFilter !== "all" && r.target_type !== typeFilter) return false;
    const s = search.toLowerCase();
    if (s && !r.reason?.toLowerCase().includes(s) && !r.reporterName?.toLowerCase().includes(s) && !r.details?.toLowerCase().includes(s)) return false;
    return true;
  }), [data, statusFilter, typeFilter, search]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: (data || []).length };
    REPORT_STATUSES.forEach((s) => { c[s] = (data || []).filter((r: any) => r.status === s).length; });
    return c;
  }, [data]);

  const updateStatus = async (id: string, status: string, notes?: string) => {
    const patch: any = { status, updated_at: new Date().toISOString() };
    if (notes !== undefined) patch.resolution_notes = notes;
    const { error } = await (supabase as any).from("reports").update(patch).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(`Report marked ${status}`);
    qc.invalidateQueries({ queryKey: ["admin-reports"] });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        {(["all", ...REPORT_STATUSES] as string[]).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1 rounded-full text-xs font-medium border capitalize transition-colors ${
              statusFilter === s ? "bg-primary text-primary-foreground border-primary" : "bg-background text-muted-foreground border-border hover:border-primary/50"
            }`}
          >
            {s} ({counts[s] ?? 0})
          </button>
        ))}
        <div className="ml-auto">
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="h-8 w-36 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All targets</SelectItem>
              <SelectItem value="listing">Listings</SelectItem>
              <SelectItem value="user">Users</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <Skeleton className="h-32 w-full rounded-xl" />
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <Flag className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">No reports match these filters</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((r: any) => (
            <div key={r.id} className="p-4 rounded-xl border border-border bg-card">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="text-xs capitalize">{r.target_type}</Badge>
                    <h3 className="font-serif font-bold text-foreground text-sm">{r.reason}</h3>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    By <Link to={`/u/${r.reporter_id}`} className="hover:underline">{r.reporterName}</Link> · {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                    {" · Target: "}
                    {r.target_type === "listing"
                      ? <Link to={`/listing/${r.target_id}`} className="hover:underline">view listing</Link>
                      : <Link to={`/u/${r.target_id}`} className="hover:underline">view user</Link>}
                  </p>
                </div>
                <Badge variant="outline" className={`${statusColor(r.status)} text-xs capitalize shrink-0`}>{r.status}</Badge>
              </div>
              {r.details && <p className="text-sm text-foreground/90 mb-2 whitespace-pre-wrap">{r.details}</p>}
              {r.resolution_notes && (
                <p className="text-xs text-muted-foreground bg-muted/40 rounded-md p-2 mb-2">
                  <span className="font-medium">Resolution:</span> {r.resolution_notes}
                </p>
              )}
              <div className="flex items-center gap-2 flex-wrap">
                <Select value={r.status} onValueChange={(v) => updateStatus(r.id, v)}>
                  <SelectTrigger className="h-8 w-36 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {REPORT_STATUSES.map((s) => (
                      <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button size="sm" variant="outline" onClick={() => setResolve({ kind: "report", id: r.id, status: r.status, notes: r.resolution_notes || "" })}>
                  Add notes
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <ResolveDialog
        target={resolve}
        onClose={() => setResolve(null)}
        onSave={async (notes, status) => {
          if (!resolve) return;
          await updateStatus(resolve.id, status, notes);
          setResolve(null);
        }}
        statuses={REPORT_STATUSES as unknown as string[]}
      />
    </div>
  );
};

export const ClaimsTriage = ({ search }: { search: string }) => {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [resolve, setResolve] = useState<ResolveTarget>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-claims"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("insurance_claims")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      const ids = [...new Set((data || []).map((c: any) => c.claimant_id))];
      const { data: profiles } = await supabase
        .from("profiles").select("user_id, full_name").in("user_id", ids as string[]);
      const map: Record<string, string> = {};
      (profiles || []).forEach((p) => { map[p.user_id] = p.full_name || "Unknown"; });
      return (data || []).map((c: any) => ({ ...c, claimantName: map[c.claimant_id] || "Unknown" }));
    },
  });

  const filtered = useMemo(() => (data || []).filter((c: any) => {
    if (statusFilter !== "all" && c.status !== statusFilter) return false;
    const s = search.toLowerCase();
    if (s && !c.claim_type?.toLowerCase().includes(s) && !c.claimantName?.toLowerCase().includes(s) && !c.description?.toLowerCase().includes(s) && !c.contact_email?.toLowerCase().includes(s)) return false;
    return true;
  }), [data, statusFilter, search]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: (data || []).length };
    CLAIM_STATUSES.forEach((s) => { c[s] = (data || []).filter((r: any) => r.status === s).length; });
    return c;
  }, [data]);

  const updateStatus = async (id: string, status: string, notes?: string) => {
    const patch: any = { status, updated_at: new Date().toISOString() };
    if (notes !== undefined) patch.resolution_notes = notes;
    const { error } = await (supabase as any).from("insurance_claims").update(patch).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(`Claim marked ${status}`);
    qc.invalidateQueries({ queryKey: ["admin-claims"] });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        {(["all", ...CLAIM_STATUSES] as string[]).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1 rounded-full text-xs font-medium border capitalize transition-colors ${
              statusFilter === s ? "bg-primary text-primary-foreground border-primary" : "bg-background text-muted-foreground border-border hover:border-primary/50"
            }`}
          >
            {s} ({counts[s] ?? 0})
          </button>
        ))}
      </div>

      {isLoading ? (
        <Skeleton className="h-32 w-full rounded-xl" />
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <ShieldAlert className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">No claims match these filters</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((c: any) => (
            <div key={c.id} className="p-4 rounded-xl border border-border bg-card">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="text-xs capitalize">{c.claim_type}</Badge>
                    <h3 className="font-serif font-bold text-foreground text-sm">
                      {c.amount_requested ? `$${Number(c.amount_requested).toLocaleString()} requested` : "No amount"}
                    </h3>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-x-3 gap-y-1">
                    <span className="flex items-center gap-1"><User className="w-3 h-3" /><Link to={`/u/${c.claimant_id}`} className="hover:underline">{c.claimantName}</Link></span>
                    <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />Incident {format(new Date(c.incident_date), "MMM d, yyyy")}</span>
                    <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{c.contact_email}</span>
                    {c.contact_phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{c.contact_phone}</span>}
                  </p>
                </div>
                <Badge variant="outline" className={`${statusColor(c.status)} text-xs capitalize shrink-0`}>{c.status}</Badge>
              </div>
              <p className="text-sm text-foreground/90 mb-2 whitespace-pre-wrap">{c.description}</p>
              {Array.isArray(c.evidence_urls) && c.evidence_urls.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2">
                  {c.evidence_urls.map((u: string, i: number) => (
                    <a key={i} href={u} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline">
                      Evidence {i + 1}
                    </a>
                  ))}
                </div>
              )}
              {c.resolution_notes && (
                <p className="text-xs text-muted-foreground bg-muted/40 rounded-md p-2 mb-2">
                  <span className="font-medium">Resolution:</span> {c.resolution_notes}
                </p>
              )}
              <div className="flex items-center gap-2 flex-wrap">
                <Select value={c.status} onValueChange={(v) => updateStatus(c.id, v)}>
                  <SelectTrigger className="h-8 w-36 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CLAIM_STATUSES.map((s) => (
                      <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button size="sm" variant="outline" onClick={() => setResolve({ kind: "claim", id: c.id, status: c.status, notes: c.resolution_notes || "" })}>
                  Add notes
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <ResolveDialog
        target={resolve}
        onClose={() => setResolve(null)}
        onSave={async (notes, status) => {
          if (!resolve) return;
          await updateStatus(resolve.id, status, notes);
          setResolve(null);
        }}
        statuses={CLAIM_STATUSES as unknown as string[]}
      />
    </div>
  );
};

const ResolveDialog = ({
  target, onClose, onSave, statuses,
}: {
  target: ResolveTarget;
  onClose: () => void;
  onSave: (notes: string, status: string) => Promise<void>;
  statuses: string[];
}) => {
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<string>("");
  const open = !!target;

  // sync when target changes
  useMemo(() => {
    if (target) { setNotes(target.notes); setStatus(target.status); }
  }, [target]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-serif">Update resolution</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 pt-2">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Status</label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {statuses.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Resolution notes</label>
            <Textarea rows={5} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Add internal notes about how this was resolved..." />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onSave(notes, status)}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
