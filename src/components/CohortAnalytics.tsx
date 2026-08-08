import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO, startOfMonth, subMonths, differenceInDays, subDays, startOfDay } from "date-fns";
import { UserPlus, Repeat, CalendarRange, Percent } from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

const RANGES = [
  { label: "3 months", months: 3 },
  { label: "6 months", months: 6 },
  { label: "12 months", months: 12 },
];

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

interface CohortRow {
  key: string;
  label: string;
  hosts: number;
  activated: number;
  retained7: number;
  retained30: number;
  listings: number;
  views: number;
  bookings: number;
}

export function CohortAnalytics() {
  const [months, setMonths] = useState(6);
  const since = useMemo(() => startOfMonth(subMonths(new Date(), months - 1)), [months]);

  const { data, isLoading } = useQuery({
    queryKey: ["cohort-analytics", months],
    queryFn: async () => {
      const [listings, bookings, events] = await Promise.all([
        supabase.from("listings").select("id, host_id, created_at"),
        supabase.from("bookings").select("id, listing_id, guest_id, status, created_at"),
        supabase.from("listing_events").select("listing_id, event_type, created_at"),
      ]);
      if (listings.error) throw listings.error;
      if (bookings.error) throw bookings.error;
      if (events.error) throw events.error;
      return {
        listings: listings.data ?? [],
        bookings: bookings.data ?? [],
        events: events.data ?? [],
      };
    },
  });

  const model = useMemo(() => {
    const listings = data?.listings ?? [];
    const bookings = data?.bookings ?? [];
    const events = data?.events ?? [];

    // Host cohort = month their first listing went up.
    const firstListingAt = new Map<string, Date>();
    for (const l of listings) {
      const d = parseISO(l.created_at);
      const prev = firstListingAt.get(l.host_id);
      if (!prev || d < prev) firstListingAt.set(l.host_id, d);
    }

    const hostOfListing = new Map(listings.map((l) => [l.id, l.host_id]));
    const listingCreatedAt = new Map(listings.map((l) => [l.id, parseISO(l.created_at)]));

    // Bookings received per host, sorted by time.
    const hostBookings = new Map<string, Date[]>();
    for (const b of bookings) {
      const host = hostOfListing.get(b.listing_id);
      if (!host) continue;
      const arr = hostBookings.get(host) ?? [];
      arr.push(parseISO(b.created_at));
      hostBookings.set(host, arr);
    }
    for (const arr of hostBookings.values()) arr.sort((a, b) => a.getTime() - b.getTime());

    // Build cohort buckets for the selected window.
    const rows: CohortRow[] = [];
    for (let i = months - 1; i >= 0; i--) {
      const d = startOfMonth(subMonths(new Date(), i));
      rows.push({
        key: format(d, "yyyy-MM"),
        label: format(d, "MMM yy"),
        hosts: 0,
        activated: 0,
        retained7: 0,
        retained30: 0,
        listings: 0,
        views: 0,
        bookings: 0,
      });
    }
    const byKey = new Map(rows.map((r) => [r.key, r]));

    for (const [hostId, joinedAt] of firstListingAt) {
      const row = byKey.get(format(joinedAt, "yyyy-MM"));
      if (!row) continue;
      row.hosts += 1;
      const received = hostBookings.get(hostId) ?? [];
      if (received.length > 0) row.activated += 1;
      if (received.some((d) => differenceInDays(d, joinedAt) <= 7)) row.retained7 += 1;
      if (received.some((d) => differenceInDays(d, joinedAt) <= 30)) row.retained30 += 1;
    }

    // Listing cohort = month the listing was created; conversion = bookings / views.
    for (const l of listings) {
      const row = byKey.get(format(parseISO(l.created_at), "yyyy-MM"));
      if (row) row.listings += 1;
    }
    for (const e of events) {
      if (e.event_type !== "view") continue;
      const created = listingCreatedAt.get(e.listing_id);
      if (!created) continue;
      const row = byKey.get(format(created, "yyyy-MM"));
      if (row) row.views += 1;
    }
    for (const b of bookings) {
      const created = listingCreatedAt.get(b.listing_id);
      if (!created) continue;
      const row = byKey.get(format(created, "yyyy-MM"));
      if (row) row.bookings += 1;
    }

    // New vs returning hosts in the selected window.
    const windowStart = since;
    let newHosts = 0;
    let returningHosts = 0;
    for (const [hostId, joinedAt] of firstListingAt) {
      if (joinedAt >= windowStart) {
        newHosts += 1;
        continue;
      }
      const received = hostBookings.get(hostId) ?? [];
      if (received.some((d) => d >= windowStart)) returningHosts += 1;
    }

    const last30 = startOfDay(subDays(new Date(), 29));
    const cohortHosts = rows.reduce((s, r) => s + r.hosts, 0);
    const cohortRet7 = rows.reduce((s, r) => s + r.retained7, 0);
    const cohortRet30 = rows.reduce((s, r) => s + r.retained30, 0);

    const chart = rows.map((r) => ({
      label: r.label,
      retention7: r.hosts > 0 ? Number(((r.retained7 / r.hosts) * 100).toFixed(1)) : 0,
      retention30: r.hosts > 0 ? Number(((r.retained30 / r.hosts) * 100).toFixed(1)) : 0,
      conversion: r.views > 0 ? Number(((r.bookings / r.views) * 100).toFixed(1)) : 0,
    }));

    return {
      rows,
      chart,
      newHosts,
      returningHosts,
      activeRecently: [...hostBookings.entries()].filter(([, ds]) => ds.some((d) => d >= last30)).length,
      retention7: cohortHosts > 0 ? cohortRet7 / cohortHosts : 0,
      retention30: cohortHosts > 0 ? cohortRet30 / cohortHosts : 0,
    };
  }, [data, months, since]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  const cards = [
    {
      label: "New hosts",
      value: String(model.newHosts),
      icon: UserPlus,
      hint: `first listing in last ${months} months`,
    },
    {
      label: "Returning hosts",
      value: String(model.returningHosts),
      icon: Repeat,
      hint: "older hosts with new bookings",
    },
    {
      label: "7-day retention",
      value: pct(model.retention7),
      icon: CalendarRange,
      hint: "booked within 7 days of joining",
    },
    {
      label: "30-day retention",
      value: pct(model.retention30),
      icon: Percent,
      hint: "booked within 30 days of joining",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        {RANGES.map((r) => (
          <Button
            key={r.months}
            size="sm"
            variant={months === r.months ? "default" : "outline"}
            onClick={() => setMonths(r.months)}
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
              <p className="text-[11px] text-muted-foreground mt-1">{c.hint}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Retention & conversion by cohort</CardTitle>
          <CardDescription className="text-xs">
            Hosts grouped by the month of their first listing (%)
          </CardDescription>
        </CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={model.chart} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} unit="%" />
              <Tooltip formatter={(v: number) => `${v}%`} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="retention7" name="7-day retention" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
              <Bar
                dataKey="retention30"
                name="30-day retention"
                fill="hsl(var(--primary) / 0.45)"
                radius={[6, 6, 0, 0]}
              />
              <Bar
                dataKey="conversion"
                name="View → booking"
                fill="hsl(var(--muted-foreground))"
                radius={[6, 6, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Cohort table</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground border-b border-border">
                  <th className="py-2 px-4 font-medium">Cohort</th>
                  <th className="py-2 px-4 font-medium text-right">New hosts</th>
                  <th className="py-2 px-4 font-medium text-right">Activated</th>
                  <th className="py-2 px-4 font-medium text-right">7-day</th>
                  <th className="py-2 px-4 font-medium text-right">30-day</th>
                  <th className="py-2 px-4 font-medium text-right">Listings</th>
                  <th className="py-2 px-4 font-medium text-right">Views</th>
                  <th className="py-2 px-4 font-medium text-right">Conversion</th>
                </tr>
              </thead>
              <tbody>
                {model.rows.map((r) => (
                  <tr key={r.key} className="border-b border-border/50 last:border-0">
                    <td className="py-2.5 px-4 text-foreground">{r.label}</td>
                    <td className="py-2.5 px-4 text-right text-muted-foreground">{r.hosts}</td>
                    <td className="py-2.5 px-4 text-right text-muted-foreground">
                      {r.activated}
                      {r.hosts > 0 && (
                        <span className="text-[11px] ml-1">({pct(r.activated / r.hosts)})</span>
                      )}
                    </td>
                    <td className="py-2.5 px-4 text-right text-muted-foreground">
                      {r.hosts > 0 ? pct(r.retained7 / r.hosts) : "—"}
                    </td>
                    <td className="py-2.5 px-4 text-right text-muted-foreground">
                      {r.hosts > 0 ? pct(r.retained30 / r.hosts) : "—"}
                    </td>
                    <td className="py-2.5 px-4 text-right text-muted-foreground">{r.listings}</td>
                    <td className="py-2.5 px-4 text-right text-muted-foreground">{r.views}</td>
                    <td className="py-2.5 px-4 text-right font-medium text-foreground">
                      {r.views > 0 ? pct(r.bookings / r.views) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default CohortAnalytics;
