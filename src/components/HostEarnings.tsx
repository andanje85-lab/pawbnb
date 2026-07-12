import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO, startOfMonth, subMonths, isAfter, isBefore } from "date-fns";
import { DollarSign, TrendingUp, CalendarCheck, Clock } from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  LineChart,
  Line,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface HostEarningsProps {
  hostId: string;
}

interface BookingRow {
  id: string;
  status: string;
  total_price: number;
  check_in: string;
  check_out: string;
  created_at: string;
}

const currency = (n: number) =>
  n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export function HostEarnings({ hostId }: HostEarningsProps) {
  const { data: bookings = [], isLoading } = useQuery({
    queryKey: ["host-earnings", hostId],
    queryFn: async (): Promise<BookingRow[]> => {
      const { data, error } = await supabase
        .from("bookings")
        .select("id, status, total_price, check_in, check_out, created_at, listings!inner(host_id)")
        .eq("listings.host_id", hostId);
      if (error) throw error;
      return (data as any) ?? [];
    },
  });

  const stats = useMemo(() => {
    const now = new Date();
    let earned = 0;
    let upcoming = 0;
    let pending = 0;
    let completedCount = 0;
    for (const b of bookings) {
      if (b.status === "confirmed") {
        const end = parseISO(b.check_out);
        if (isBefore(end, now)) {
          earned += Number(b.total_price);
          completedCount += 1;
        } else {
          upcoming += Number(b.total_price);
        }
      } else if (b.status === "pending") {
        pending += Number(b.total_price);
      }
    }
    return { earned, upcoming, pending, completedCount };
  }, [bookings]);

  const monthlyData = useMemo(() => {
    const months: { key: string; label: string; earnings: number; bookings: number }[] = [];
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = startOfMonth(subMonths(now, i));
      months.push({ key: format(d, "yyyy-MM"), label: format(d, "MMM"), earnings: 0, bookings: 0 });
    }
    for (const b of bookings) {
      if (b.status !== "confirmed") continue;
      const key = format(parseISO(b.check_in), "yyyy-MM");
      const m = months.find((x) => x.key === key);
      if (m) {
        m.earnings += Number(b.total_price);
        m.bookings += 1;
      }
    }
    return months;
  }, [bookings]);

  const cards = [
    { label: "Total earned", value: currency(stats.earned), icon: DollarSign, tone: "text-primary" },
    { label: "Upcoming payouts", value: currency(stats.upcoming), icon: TrendingUp, tone: "text-accent-foreground" },
    { label: "Pending requests", value: currency(stats.pending), icon: Clock, tone: "text-muted-foreground" },
    { label: "Completed stays", value: stats.completedCount.toString(), icon: CalendarCheck, tone: "text-primary" },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">{c.label}</span>
                <c.icon className={`h-4 w-4 ${c.tone}`} />
              </div>
              <p className="font-serif text-2xl font-semibold">{isLoading ? "—" : c.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Earnings — last 12 months</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={(v) => `$${v}`} />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    color: "hsl(var(--foreground))",
                  }}
                  formatter={(value: number) => currency(value)}
                />
                <Bar dataKey="earnings" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Bookings per month</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    color: "hsl(var(--foreground))",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="bookings"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
