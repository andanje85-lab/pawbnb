import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, subDays, startOfDay, parseISO } from "date-fns";
import { Eye, Search, MousePointerClick, CalendarCheck } from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

interface HostAnalyticsProps {
  hostId: string;
}

const RANGES = [
  { label: "7 days", days: 7 },
  { label: "30 days", days: 30 },
  { label: "90 days", days: 90 },
];

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

export function HostAnalytics({ hostId }: HostAnalyticsProps) {
  const [days, setDays] = useState(30);
  const since = useMemo(() => startOfDay(subDays(new Date(), days - 1)), [days]);

  const { data, isLoading } = useQuery({
    queryKey: ["host-analytics", hostId, days],
    queryFn: async () => {
      const { data: listings, error: lErr } = await supabase
        .from("listings")
        .select("id, title")
        .eq("host_id", hostId);
      if (lErr) throw lErr;
      const ids = (listings ?? []).map((l) => l.id);
      if (ids.length === 0) return { listings: [], events: [], bookings: [] };

      const [events, bookings] = await Promise.all([
        supabase
          .from("listing_events")
          .select("listing_id, event_type, created_at")
          .in("listing_id", ids)
          .gte("created_at", since.toISOString()),
        supabase
          .from("bookings")
          .select("id, listing_id, status, created_at")
          .in("listing_id", ids)
          .gte("created_at", since.toISOString()),
      ]);
      if (events.error) throw events.error;
      if (bookings.error) throw bookings.error;

      return {
        listings: listings ?? [],
        events: events.data ?? [],
        bookings: bookings.data ?? [],
      };
    },
  });

  const totals = useMemo(() => {
    const events = data?.events ?? [];
    const impressions = events.filter((e) => e.event_type === "impression").length;
    const views = events.filter((e) => e.event_type === "view").length;
    const bookingCount = (data?.bookings ?? []).length;
    const confirmed = (data?.bookings ?? []).filter((b) => b.status === "confirmed").length;
    return {
      impressions,
      views,
      bookingCount,
      confirmed,
      ctr: impressions > 0 ? views / impressions : 0,
      conversion: views > 0 ? bookingCount / views : 0,
    };
  }, [data]);

  const chartData = useMemo(() => {
    const buckets: Record<string, { label: string; views: number; impressions: number }> = {};
    for (let i = days - 1; i >= 0; i--) {
      const d = subDays(new Date(), i);
      const key = format(d, "yyyy-MM-dd");
      buckets[key] = { label: format(d, days > 31 ? "MMM d" : "MMM d"), views: 0, impressions: 0 };
    }
    for (const e of data?.events ?? []) {
      const key = format(parseISO(e.created_at), "yyyy-MM-dd");
      const b = buckets[key];
      if (!b) continue;
      if (e.event_type === "view") b.views += 1;
      else b.impressions += 1;
    }
    return Object.values(buckets);
  }, [data, days]);

  const perListing = useMemo(() => {
    const rows = (data?.listings ?? []).map((l) => {
      const events = (data?.events ?? []).filter((e) => e.listing_id === l.id);
      const impressions = events.filter((e) => e.event_type === "impression").length;
      const views = events.filter((e) => e.event_type === "view").length;
      const bookings = (data?.bookings ?? []).filter((b) => b.listing_id === l.id).length;
      return {
        id: l.id,
        title: l.title,
        impressions,
        views,
        bookings,
        conversion: views > 0 ? bookings / views : 0,
      };
    });
    return rows.sort((a, b) => b.views - a.views);
  }, [data]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const cards = [
    { label: "Search impressions", value: totals.impressions.toLocaleString(), icon: Search },
    { label: "Listing views", value: totals.views.toLocaleString(), icon: Eye },
    { label: "View rate", value: pct(totals.ctr), icon: MousePointerClick, hint: "views / impressions" },
    {
      label: "Booking conversion",
      value: pct(totals.conversion),
      icon: CalendarCheck,
      hint: `${totals.bookingCount} requests · ${totals.confirmed} confirmed`,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        {RANGES.map((r) => (
          <Button
            key={r.days}
            size="sm"
            variant={days === r.days ? "default" : "outline"}
            onClick={() => setDays(r.days)}
          >
            {r.label}
          </Button>
        ))}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <c.icon className="w-4 h-4" />
                <span className="text-xs">{c.label}</span>
              </div>
              <p className="text-2xl font-semibold text-foreground">{c.value}</p>
              {c.hint && <p className="text-[11px] text-muted-foreground mt-1">{c.hint}</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Traffic over time</CardTitle>
        </CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Area
                type="monotone"
                dataKey="impressions"
                name="Impressions"
                stroke="hsl(var(--muted-foreground))"
                fill="hsl(var(--muted))"
              />
              <Area
                type="monotone"
                dataKey="views"
                name="Views"
                stroke="hsl(var(--primary))"
                fill="hsl(var(--primary) / 0.25)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Per listing</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {perListing.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">No listings yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground border-b border-border">
                    <th className="py-2 px-4 font-medium">Listing</th>
                    <th className="py-2 px-4 font-medium text-right">Impressions</th>
                    <th className="py-2 px-4 font-medium text-right">Views</th>
                    <th className="py-2 px-4 font-medium text-right">Requests</th>
                    <th className="py-2 px-4 font-medium text-right">Conversion</th>
                  </tr>
                </thead>
                <tbody>
                  {perListing.map((r) => (
                    <tr key={r.id} className="border-b border-border/50 last:border-0">
                      <td className="py-2.5 px-4 text-foreground">{r.title}</td>
                      <td className="py-2.5 px-4 text-right text-muted-foreground">{r.impressions}</td>
                      <td className="py-2.5 px-4 text-right text-muted-foreground">{r.views}</td>
                      <td className="py-2.5 px-4 text-right text-muted-foreground">{r.bookings}</td>
                      <td className="py-2.5 px-4 text-right font-medium text-foreground">{pct(r.conversion)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default HostAnalytics;
