import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { AlertTriangle, RefreshCw, ChevronDown, CheckCircle2 } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";

interface FunctionError {
  id: string;
  function_name: string;
  message: string;
  stack: string | null;
  context: Record<string, unknown> | null;
  created_at: string;
}

const WINDOWS = [
  { value: "24", label: "Last 24 hours" },
  { value: "168", label: "Last 7 days" },
  { value: "720", label: "Last 30 days" },
];

export const ErrorMonitor = () => {
  const [hours, setHours] = useState("168");
  const [fnFilter, setFnFilter] = useState("all");

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["function-errors", hours],
    queryFn: async () => {
      const since = new Date(Date.now() - Number(hours) * 3600_000).toISOString();
      const { data, error } = await (supabase as any)
        .from("function_errors")
        .select("*")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(300);
      if (error) throw error;
      return (data || []) as FunctionError[];
    },
    refetchInterval: 60_000,
  });

  const errors = data || [];

  const byFunction = useMemo(() => {
    const map: Record<string, number> = {};
    errors.forEach((e) => { map[e.function_name] = (map[e.function_name] || 0) + 1; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [errors]);

  const visible = fnFilter === "all" ? errors : errors.filter((e) => e.function_name === fnFilter);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[0, 1, 2].map((i) => <Skeleton key={i} className="h-20 w-full" />)}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <Select value={hours} onValueChange={setHours}>
          <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {WINDOWS.map((w) => <SelectItem key={w.value} value={w.value}>{w.label}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={fnFilter} onValueChange={setFnFilter}>
          <SelectTrigger className="w-[220px]"><SelectValue placeholder="All functions" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All functions</SelectItem>
            {byFunction.map(([name]) => <SelectItem key={name} value={name}>{name}</SelectItem>)}
          </SelectContent>
        </Select>

        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isRefetching} className="gap-1.5">
          <RefreshCw className={`w-3.5 h-3.5 ${isRefetching ? "animate-spin" : ""}`} />
          Refresh
        </Button>

        <span className="text-sm text-muted-foreground ml-auto">
          {errors.length} error{errors.length === 1 ? "" : "s"} in window
        </span>
      </div>

      {byFunction.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {byFunction.slice(0, 8).map(([name, count]) => (
            <div key={name} className="rounded-xl border border-border bg-card p-3">
              <p className="text-xs text-muted-foreground truncate" title={name}>{name}</p>
              <p className="text-2xl font-semibold">{count}</p>
            </div>
          ))}
        </div>
      )}

      {visible.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-border bg-muted/30 py-12 text-center">
          <CheckCircle2 className="w-8 h-8 text-emerald-500" />
          <p className="font-medium">No backend errors in this window</p>
          <p className="text-sm text-muted-foreground">All functions are running cleanly.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {visible.map((e) => (
            <Collapsible key={e.id} className="rounded-xl border border-border bg-card">
              <CollapsibleTrigger className="flex w-full items-start gap-3 p-4 text-left">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-destructive" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{e.function_name}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(e.created_at), { addSuffix: true })} ·{" "}
                      {format(new Date(e.created_at), "d MMM HH:mm")}
                    </span>
                  </div>
                  <p className="mt-1 break-words text-sm font-medium">{e.message}</p>
                </div>
                <ChevronDown className="w-4 h-4 shrink-0 text-muted-foreground" />
              </CollapsibleTrigger>
              <CollapsibleContent className="border-t border-border px-4 py-3">
                {e.context && Object.keys(e.context).length > 0 && (
                  <>
                    <p className="mb-1 text-xs font-medium text-muted-foreground">Context</p>
                    <pre className="mb-3 overflow-x-auto rounded-lg bg-muted p-3 text-xs">
                      {JSON.stringify(e.context, null, 2)}
                    </pre>
                  </>
                )}
                <p className="mb-1 text-xs font-medium text-muted-foreground">Stack trace</p>
                <pre className="overflow-x-auto rounded-lg bg-muted p-3 text-xs whitespace-pre-wrap">
                  {e.stack || "No stack trace captured."}
                </pre>
              </CollapsibleContent>
            </Collapsible>
          ))}
        </div>
      )}
    </div>
  );
};

export default ErrorMonitor;
