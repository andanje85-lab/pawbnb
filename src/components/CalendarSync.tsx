import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { CalendarSync as SyncIcon, Copy, Download, Link2, Loader2, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";

interface CalendarSyncProps {
  listingId: string;
  listingTitle: string;
}

const FUNCTIONS_BASE = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1`;

export function CalendarSync({ listingId, listingTitle }: CalendarSyncProps) {
  const qc = useQueryClient();
  const [importUrl, setImportUrl] = useState("");

  const { data: sync, isLoading } = useQuery({
    queryKey: ["calendar-sync", listingId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("listing_calendar_sync")
        .select("id, import_url, export_token, last_synced_at, last_sync_status, imported_count")
        .eq("listing_id", listingId)
        .maybeSingle();
      if (error) throw error;
      if (data) return data;
      const { data: created, error: cErr } = await supabase
        .from("listing_calendar_sync")
        .insert({ listing_id: listingId })
        .select("id, import_url, export_token, last_synced_at, last_sync_status, imported_count")
        .single();
      if (cErr) throw cErr;
      return created;
    },
  });

  useEffect(() => {
    setImportUrl(sync?.import_url ?? "");
  }, [sync?.import_url, listingId]);

  const feedUrl = sync?.export_token ? `${FUNCTIONS_BASE}/calendar-sync?token=${sync.export_token}` : "";

  const saveUrl = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("listing_calendar_sync")
        .update({ import_url: importUrl.trim() || null })
        .eq("listing_id", listingId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["calendar-sync", listingId] });
      toast({ title: "Calendar link saved" });
    },
    onError: (e: any) => toast({ title: "Could not save", description: e.message, variant: "destructive" }),
  });

  const runImport = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("calendar-sync", {
        body: { listing_id: listingId },
      });
      if (error) {
        const detail = (error as any)?.context?.text ? await (error as any).context.text() : error.message;
        throw new Error(detail || error.message);
      }
      return data as { imported: number; events: number };
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["calendar-sync", listingId] });
      qc.invalidateQueries({ queryKey: ["blocked-dates", listingId] });
      toast({
        title: "Calendar imported",
        description: `${res.imported} new date${res.imported === 1 ? "" : "s"} blocked from ${res.events} calendar entr${res.events === 1 ? "y" : "ies"}.`,
      });
    },
    onError: (e: any) => toast({ title: "Import failed", description: e.message, variant: "destructive" }),
  });

  const copyFeed = async () => {
    try {
      await navigator.clipboard.writeText(feedUrl);
      toast({ title: "Link copied", description: "Paste it into the other calendar app." });
    } catch {
      toast({ title: "Copy failed", description: "Select the link and copy it manually.", variant: "destructive" });
    }
  };

  const rotate = useMutation({
    mutationFn: async () => {
      const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "").slice(0, 8);
      const { error } = await supabase
        .from("listing_calendar_sync")
        .update({ export_token: token })
        .eq("listing_id", listingId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["calendar-sync", listingId] });
      toast({ title: "New share link created", description: "The old link no longer works." });
    },
  });

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Link2 className="h-4 w-4" /> Import from another calendar
          </CardTitle>
          <CardDescription>
            Paste the calendar link (.ics) from Airbnb, Google Calendar or another site. Their booked dates
            get blocked here automatically.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ical-url">Calendar link</Label>
            <Input
              id="ical-url"
              value={importUrl}
              placeholder="https://example.com/calendar.ics"
              onChange={(e) => setImportUrl(e.target.value)}
              disabled={isLoading}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => saveUrl.mutate()}
              disabled={saveUrl.isPending || isLoading || importUrl === (sync?.import_url ?? "")}
            >
              {saveUrl.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save link
            </Button>
            <Button
              onClick={() => runImport.mutate()}
              disabled={runImport.isPending || !sync?.import_url}
            >
              {runImport.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Sync now
            </Button>
          </div>
          {sync?.last_synced_at && (
            <p className="text-xs text-muted-foreground flex items-center gap-2">
              <Badge variant={sync.last_sync_status === "ok" ? "secondary" : "destructive"}>
                {sync.last_sync_status === "ok" ? "Last sync OK" : sync.last_sync_status}
              </Badge>
              {format(parseISO(sync.last_synced_at), "MMM d, yyyy 'at' h:mm a")}
              {sync.last_sync_status === "ok" && ` · ${sync.imported_count} date(s) blocked`}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <SyncIcon className="h-4 w-4" /> Share this calendar
          </CardTitle>
          <CardDescription>
            Add this private link to any other calendar app to see {listingTitle}'s booked and blocked
            nights there.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input readOnly value={feedUrl} onFocus={(e) => e.currentTarget.select()} className="text-xs" />
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={copyFeed} disabled={!feedUrl}>
              <Copy className="mr-2 h-4 w-4" /> Copy link
            </Button>
            <Button variant="outline" asChild disabled={!feedUrl}>
              <a href={feedUrl} download="pawbnb-availability.ics">
                <Download className="mr-2 h-4 w-4" /> Download file
              </a>
            </Button>
            <Button variant="ghost" onClick={() => rotate.mutate()} disabled={rotate.isPending}>
              Reset link
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Keep this link private — anyone with it can see when you're busy (no guest names or addresses).
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
