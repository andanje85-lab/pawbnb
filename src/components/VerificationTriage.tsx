import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { BadgeCheck, FileText, ShieldCheck, ExternalLink, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { Link } from "react-router-dom";

const STATUSES = ["pending", "reviewing", "approved", "rejected", "more_info"] as const;

const statusColor = (s: string) => {
  switch (s) {
    case "pending": return "bg-yellow-100 text-yellow-800 border-yellow-200";
    case "reviewing": return "bg-blue-100 text-blue-800 border-blue-200";
    case "approved": return "bg-green-100 text-green-800 border-green-200";
    case "rejected": return "bg-red-100 text-red-800 border-red-200";
    default: return "bg-orange-100 text-orange-800 border-orange-200";
  }
};

const docLabel: Record<string, string> = {
  passport: "Passport",
  drivers_license: "Driver's licence",
  national_id: "National ID",
};

export const VerificationTriage = ({ search }: { search: string }) => {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [statusFilter, setStatusFilter] = useState<string>("pending");
  const [decision, setDecision] = useState<{ id: string; userId: string; status: string; notes: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-verifications"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("verification_requests")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      const ids = [...new Set((data || []).map((r: any) => r.user_id))];
      const { data: profiles } = await supabase
        .from("profiles").select("user_id, full_name, id_verified").in("user_id", ids as string[]);
      const map: Record<string, any> = {};
      (profiles || []).forEach((p) => { map[p.user_id] = p; });
      return (data || []).map((r: any) => ({
        ...r,
        profileName: map[r.user_id]?.full_name || "Unknown",
        alreadyVerified: !!map[r.user_id]?.id_verified,
      }));
    },
  });

  const filtered = useMemo(() => (data || []).filter((r: any) => {
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    const s = search.toLowerCase();
    if (s && !r.legal_name?.toLowerCase().includes(s) && !r.profileName?.toLowerCase().includes(s)) return false;
    return true;
  }), [data, statusFilter, search]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: (data || []).length };
    STATUSES.forEach((s) => { c[s] = (data || []).filter((r: any) => r.status === s).length; });
    return c;
  }, [data]);

  const openDoc = async (path: string) => {
    const { data, error } = await supabase.storage.from("verification-docs").createSignedUrl(path, 300);
    if (error || !data?.signedUrl) return toast.error(error?.message || "Couldn't open document");
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  const applyDecision = async () => {
    if (!decision) return;
    setSaving(true);
    const { error } = await (supabase as any)
      .from("verification_requests")
      .update({
        status: decision.status,
        review_notes: decision.notes.trim() || null,
        reviewed_by: user?.id ?? null,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", decision.id);

    if (!error && decision.status === "approved") {
      const { error: pErr } = await supabase
        .from("profiles")
        .update({ id_verified: true, id_verified_at: new Date().toISOString() })
        .eq("user_id", decision.userId);
      if (pErr) toast.error(`Badge not granted: ${pErr.message}`);
    }
    if (!error && decision.status === "rejected") {
      await supabase
        .from("profiles")
        .update({ id_verified: false, id_verified_at: null })
        .eq("user_id", decision.userId);
    }
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(`Verification marked ${decision.status.replace("_", " ")}`);
    setDecision(null);
    qc.invalidateQueries({ queryKey: ["admin-verifications"] });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        {(["all", ...STATUSES] as string[]).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1 rounded-full text-xs font-medium border capitalize transition-colors ${
              statusFilter === s ? "bg-primary text-primary-foreground border-primary" : "bg-background text-muted-foreground border-border hover:border-primary/50"
            }`}
          >
            {s.replace("_", " ")} ({counts[s] ?? 0})
          </button>
        ))}
      </div>

      {isLoading ? (
        <Skeleton className="h-32 w-full rounded-xl" />
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <ShieldCheck className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">No verification requests match these filters</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((r: any) => (
            <div key={r.id} className="p-4 rounded-xl border border-border bg-card">
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className={statusColor(r.status)}>{r.status.replace("_", " ")}</Badge>
                    <h3 className="font-serif font-bold text-sm text-foreground">{r.legal_name}</h3>
                    {r.alreadyVerified && (
                      <Badge variant="outline" className="text-xs gap-1"><BadgeCheck className="w-3 h-3" />Badge live</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {docLabel[r.document_type] ?? r.document_type} ·{" "}
                    <Link to={`/u/${r.user_id}`} className="hover:underline">{r.profileName}</Link>
                    {" · "}{formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                  </p>
                  {r.review_notes && (
                    <p className="text-xs text-foreground mt-2 border-l-2 border-primary/40 pl-2">{r.review_notes}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {(Array.isArray(r.document_urls) ? r.document_urls : []).map((p: string, i: number) => (
                    <Button key={p} size="sm" variant="outline" onClick={() => openDoc(p)} className="gap-1.5">
                      <FileText className="w-3.5 h-3.5" />Doc {i + 1}
                    </Button>
                  ))}
                  {r.selfie_url && (
                    <Button size="sm" variant="outline" onClick={() => openDoc(r.selfie_url)} className="gap-1.5">
                      <ExternalLink className="w-3.5 h-3.5" />Selfie
                    </Button>
                  )}
                  <Button
                    size="sm"
                    onClick={() => setDecision({ id: r.id, userId: r.user_id, status: "approved", notes: r.review_notes ?? "" })}
                  >
                    Decide
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!decision} onOpenChange={(o) => !o && setDecision(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Verification decision</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {STATUSES.filter((s) => s !== "pending").map((s) => (
                <button
                  key={s}
                  onClick={() => decision && setDecision({ ...decision, status: s })}
                  className={`px-3 py-1 rounded-full text-xs font-medium border capitalize ${
                    decision?.status === s ? "bg-primary text-primary-foreground border-primary" : "bg-background text-muted-foreground border-border hover:border-primary/50"
                  }`}
                >
                  {s.replace("_", " ")}
                </button>
              ))}
            </div>
            <Textarea
              rows={4}
              placeholder="Internal / applicant-facing note (e.g. document was blurry)"
              value={decision?.notes ?? ""}
              onChange={(e) => decision && setDecision({ ...decision, notes: e.target.value.slice(0, 1000) })}
            />
            <p className="text-xs text-muted-foreground">
              Approving grants the ID Verified badge. Rejecting removes it.
            </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDecision(null)}>Cancel</Button>
            <Button onClick={applyDecision} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save decision
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default VerificationTriage;
