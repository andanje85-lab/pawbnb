import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { Calendar as CalendarIcon, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";

interface Listing {
  id: string;
  title: string;
}

interface HostAvailabilityProps {
  listings: Listing[];
}

const toISO = (d: Date) => format(d, "yyyy-MM-dd");

export function HostAvailability({ listings }: HostAvailabilityProps) {
  const qc = useQueryClient();
  const [selectedListingId, setSelectedListingId] = useState<string>(listings[0]?.id ?? "");

  const { data: blocked = [], isLoading } = useQuery({
    queryKey: ["blocked-dates", selectedListingId],
    queryFn: async () => {
      if (!selectedListingId) return [];
      const { data, error } = await supabase
        .from("listing_blocked_dates")
        .select("id, blocked_date")
        .eq("listing_id", selectedListingId)
        .order("blocked_date");
      if (error) throw error;
      return data;
    },
    enabled: !!selectedListingId,
  });

  const { data: bookedDates = [] } = useQuery({
    queryKey: ["confirmed-booking-dates", selectedListingId],
    queryFn: async () => {
      if (!selectedListingId) return [];
      const { data, error } = await supabase
        .from("bookings")
        .select("check_in, check_out")
        .eq("listing_id", selectedListingId)
        .in("status", ["confirmed", "pending"]);
      if (error) throw error;
      const dates: string[] = [];
      for (const b of data) {
        const start = parseISO(b.check_in);
        const end = parseISO(b.check_out);
        for (let d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
          dates.push(toISO(d));
        }
      }
      return dates;
    },
    enabled: !!selectedListingId,
  });

  const toggleBlock = useMutation({
    mutationFn: async (date: Date) => {
      const iso = toISO(date);
      const existing = blocked.find((b) => b.blocked_date === iso);
      if (existing) {
        const { error } = await supabase
          .from("listing_blocked_dates")
          .delete()
          .eq("id", existing.id);
        if (error) throw error;
        return { action: "unblocked", iso };
      } else {
        const { error } = await supabase
          .from("listing_blocked_dates")
          .insert({ listing_id: selectedListingId, blocked_date: iso });
        if (error) throw error;
        return { action: "blocked", iso };
      }
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["blocked-dates", selectedListingId] });
      toast({ title: res.action === "blocked" ? "Date blocked" : "Date unblocked" });
    },
    onError: (e: any) => toast({ title: "Update failed", description: e.message, variant: "destructive" }),
  });

  const removeBlock = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("listing_blocked_dates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["blocked-dates", selectedListingId] }),
  });

  const blockedDateObjs = blocked.map((b) => parseISO(b.blocked_date));
  const bookedDateObjs = bookedDates.map((d) => parseISO(d));

  if (!listings.length) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground">
          Create a listing to manage its availability.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="max-w-sm">
        <Select value={selectedListingId} onValueChange={setSelectedListingId}>
          <SelectTrigger>
            <SelectValue placeholder="Select a listing" />
          </SelectTrigger>
          <SelectContent>
            {listings.map((l) => (
              <SelectItem key={l.id} value={l.id}>
                {l.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-6 md:grid-cols-[auto_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarIcon className="h-4 w-4" /> Tap a date to block or unblock
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Calendar
              mode="single"
              onSelect={(d) => d && toggleBlock.mutate(d)}
              disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
              modifiers={{ blocked: blockedDateObjs, booked: bookedDateObjs }}
              modifiersClassNames={{
                blocked: "bg-destructive/20 text-destructive font-semibold",
                booked: "bg-primary/20 text-primary font-semibold",
              }}
              className="p-3 pointer-events-auto"
            />
            <div className="flex gap-3 mt-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <span className="h-3 w-3 rounded bg-destructive/30" /> Blocked
              </span>
              <span className="flex items-center gap-1">
                <span className="h-3 w-3 rounded bg-primary/30" /> Booked
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Blocked dates</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : blocked.length === 0 ? (
              <p className="text-sm text-muted-foreground">No dates blocked. Guests can book any open date.</p>
            ) : (
              <ul className="space-y-2 max-h-[360px] overflow-y-auto">
                {blocked.map((b) => (
                  <li key={b.id} className="flex items-center justify-between rounded-md border p-2">
                    <Badge variant="secondary">{format(parseISO(b.blocked_date), "EEE, MMM d, yyyy")}</Badge>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => removeBlock.mutate(b.id)}
                      aria-label="Unblock date"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
