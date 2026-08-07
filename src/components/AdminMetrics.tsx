import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO, startOfMonth, subMonths, subDays, startOfDay } from "date-fns";
import { DollarSign, Users, XCircle, Percent, Home, CalendarCheck } from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

const RANGES = [
  { label: "30 days", days: 30 },
  { label: "90 days", days: 90 },
  { label: "12 months", days: 365 },
];

const currency = (n: number) =>
  n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export function AdminMetrics() {
  const [days, setDays] = useState(30);
  const since = useMemo(() => startOfDay(subDays(new Date(), days - 1)), [days]);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-metrics", days],
    queryFn: async () => {
      const [bookings, listings, profiles] = await Promise.all([
        supabase
          .from("bookings")
          .select("id, listing_id, status, total_price, created_at")
          .gte("created_at", since.toISOString()),
        supabase.from("listings").select("id, host_id, is_active, created_at"),
        supabase.from("profiles").select("user_id, is_host, created_at"),
      ]);
      if (bookings.error) throw bookings.error;
      if (listings.error) throw listings.error;
      if (profiles.error) throw profiles.error;
      return {
        bookings: bookings.data ?? [],
        listings: listings.data ?? [],
        profiles: profiles.data ?? [],
      };
    },
  });

  const stats = useMemo(() => {
    const bookings = data?.bookings ?? [];
    const listings = data?.listings ?? [];
    const confirmed = bookings.filter((b) => b.status === "confirmed");
    const cancelled = bookings.filter((b) => b.status === "cancelled");
    const decided = bookings.filter((b) => ["confirmed", "cancelled"].includes(b.status));
    const gmv = confirmed.reduce((s, b) => s + Number(b.total_price), 0);

    const bookedListingIds = new Set(confirmed.map((b) => b.listing_id));
    const activeHostIds = new Set(
      listings.filter((l) => l.is_active && bookedListingIds.has(l.id)).map((l) => l.host_id)
    );
    const listingHostIds = new Set(listings.filter((l) => l.is_active).map((l) => l.host_id));

    return {
      gmv,
      bookingCount: bookings.length,
      confirmedCount: confirmed.length,
      cancellationRate: decided.length > 0 ? cancelled.length / decided.length : 0,
      activeHosts: activeHostIds.size,
      listedHosts: listingHostIds.size,
      activeListings: listings.filter((l) => l.is_active).length,
      avgBookingValue: confirmed.length > 0 ? gmv / confirmed.length : 0,
      newGuests: (data?.profiles ?? []).filter((p) => parseISO(p.created_at) >= since).length,
    };
  }, [data, since]);

  const monthly = useMemo(() => {
    const months: { key: string; label: string; gmv: number; bookings: number; cancelled: number }[] = [];
    const monthCount = days > 90 ? 12 : days > 30 ? 3 : 1;
    for (let i = monthCount - 1; i >= 0; i--) {
      const d = startOfMonth(subMonths(new Date(), i));
      months.push({ key: format(d, "yyyy-MM"), label: format(d, "MMM"), gmv: 0, bookings: 0, cancelled: 0 });
    }
    for (const b of data?.bookings ?? []) {
      const key = format(parseISO(b.created_at), "yyyy-MM");
      const m = months.find((x) => x.key === key);
      if (!m) continue;
      m.bookings += 1;
      if (b.status === "confirmed") m.gmv += Number(b.total_price);
      if (b.status === "cancelled") m.cancelled += 1;
    }
    return months;
  }, [data, days]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const cards = [
    { label: "GMV (confirmed)", value: currency(stats.gmv), icon: DollarSign },
    { label: "Active hosts", value: String(stats.activeHosts), icon: Users, hint: `${stats.listedHosts} with live listings` },
    { label: "Cancellation rate", value: `${(stats.cancellationRate * 100).toFixed(1)}%`, icon: XCircle, hint: "of confirmed + cancelled" },
    { label: "Avg booking value", value: currency(stats.avgBookingValue), icon: Percent },
    { label: "Active listings", value: String(stats.activeListings), icon: Home },
    { label: "Bookings", value: String(stats.bookingCount), icon: CalendarCheck, hint: `${stats.confirmedCount} confirmed` },
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

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
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
          <CardTitle className="text-base">GMV by month</CardTitle>
        </CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthly} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number, n) => (n === "gmv" ? currency(v) : v)} />
              <Bar dataKey="gmv" name="GMV" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
              <Bar dataKey="cancelled" name="Cancelled" fill="hsl(var(--muted-foreground))" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}

export default AdminMetrics;
