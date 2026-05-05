import { useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { CheckCircle2, Calendar as CalendarIcon, Dog, MapPin, MessageSquare, Receipt, Home, ArrowRight, Shield } from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { toast } from "sonner";
import { getPolicy } from "@/lib/cancellationPolicy";

const DEPOSIT_PCT = 0.25;

export default function BookingSuccess() {
  const [params] = useSearchParams();
  const { user } = useAuth();
  const bookingId = params.get("booking_id");
  const paymentType = (params.get("payment") ?? "deposit") as "deposit" | "full";

  const { data, isLoading, error } = useQuery({
    queryKey: ["booking-success", bookingId],
    enabled: !!bookingId,
    queryFn: async () => {
      const { data: booking, error: bErr } = await supabase
        .from("bookings")
        .select("*, listings(id, title, city, address, cancellation_policy, host_id)")
        .eq("id", bookingId!)
        .maybeSingle();
      if (bErr) throw bErr;
      return booking;
    },
  });

  useEffect(() => {
    if (data) toast.success("Payment confirmed — your booking is secured!");
  }, [data]);

  const listing = (data as any)?.listings;
  const nights = data ? Math.max(1, differenceInDays(new Date(data.check_out), new Date(data.check_in))) : 0;
  const total = Number(data?.total_price ?? 0);
  const paid = paymentType === "full" ? total : Math.round(total * DEPOSIT_PCT * 100) / 100;
  const remaining = Math.max(0, total - paid);
  const policy = listing ? getPolicy(listing.cancellation_policy) : null;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-10">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="text-center mb-8"
        >
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 mb-4">
            <CheckCircle2 className="w-9 h-9 text-emerald-600 dark:text-emerald-400" />
          </div>
          <h1 className="font-serif text-3xl md:text-4xl font-semibold mb-2">Booking confirmed!</h1>
          <p className="text-muted-foreground">
            {paymentType === "full" ? "You're all paid up." : "Your deposit secured the dates."} A receipt has been emailed to you.
          </p>
        </motion.div>

        {isLoading && (
          <Card><CardContent className="p-6 space-y-3">
            <Skeleton className="h-6 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-24 w-full" />
          </CardContent></Card>
        )}

        {error && (
          <Card><CardContent className="p-6 text-center text-destructive">
            Couldn't load booking details. Check your dashboard for confirmation.
          </CardContent></Card>
        )}

        {data && listing && (
          <div className="space-y-6">
            <Card>
              <CardContent className="p-6 space-y-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-serif text-xl font-semibold">{listing.title}</h2>
                    <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                      <MapPin className="w-3.5 h-3.5" />
                      {listing.city ?? "Location shared after check-in"}
                    </p>
                  </div>
                  <Badge variant="secondary" className="shrink-0">
                    #{String(data.id).slice(0, 8).toUpperCase()}
                  </Badge>
                </div>

                <Separator />

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground flex items-center gap-1.5"><CalendarIcon className="w-3.5 h-3.5" /> Check-in</p>
                    <p className="font-medium mt-0.5">{format(new Date(data.check_in), "EEE, MMM d, yyyy")}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground flex items-center gap-1.5"><CalendarIcon className="w-3.5 h-3.5" /> Check-out</p>
                    <p className="font-medium mt-0.5">{format(new Date(data.check_out), "EEE, MMM d, yyyy")}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Nights</p>
                    <p className="font-medium mt-0.5">{nights}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground flex items-center gap-1.5"><Dog className="w-3.5 h-3.5" /> Dogs</p>
                    <p className="font-medium mt-0.5">{data.number_of_dogs}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6 space-y-4">
                <h3 className="font-serif text-lg font-semibold flex items-center gap-2">
                  <Receipt className="w-4 h-4" /> Payment summary
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total stay</span>
                    <span className="font-medium">${total.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      {paymentType === "full" ? "Paid in full today" : `Deposit paid (${Math.round(DEPOSIT_PCT * 100)}%)`}
                    </span>
                    <span className="font-medium text-emerald-600 dark:text-emerald-400">−${paid.toFixed(2)}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between text-base">
                    <span className="font-medium">{remaining > 0 ? "Balance due at check-in" : "Balance"}</span>
                    <span className="font-semibold">${remaining.toFixed(2)}</span>
                  </div>
                </div>
                {remaining > 0 && (
                  <p className="text-xs text-muted-foreground bg-muted/40 rounded-md p-3">
                    The remaining ${remaining.toFixed(2)} will be automatically charged to your card 7 days before check-in.
                    You'll receive a reminder email beforehand.
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6 space-y-4">
                <h3 className="font-serif text-lg font-semibold">What's next</h3>
                <ol className="space-y-3 text-sm">
                  <li className="flex gap-3">
                    <span className="shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-semibold flex items-center justify-center">1</span>
                    <span>Your host will reach out within 24 hours to coordinate drop-off details and answer any questions.</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-semibold flex items-center justify-center">2</span>
                    <span>Share your dog's routine, feeding schedule, and any medical needs through the in-app chat.</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-semibold flex items-center justify-center">3</span>
                    <span>The exact address will unlock 48 hours before check-in.</span>
                  </li>
                </ol>

                {policy && (
                  <div className="flex gap-3 items-start rounded-md border border-border bg-muted/30 p-3 text-xs">
                    <Shield className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                    <p>
                      <span className="font-medium">{policy.label} cancellation:</span>{" "}
                      Free cancellation up to {policy.freeDays} day{policy.freeDays === 1 ? "" : "s"} before check-in
                      {policy.partialPct > 0 ? `, ${policy.partialPct}% refund up to ${policy.partialDays} days before.` : "."}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="flex flex-col sm:flex-row gap-3">
              <Button asChild className="flex-1">
                <Link to="/messages">
                  <MessageSquare className="w-4 h-4" /> Message host
                </Link>
              </Button>
              <Button asChild variant="outline" className="flex-1">
                <Link to="/dashboard">
                  View booking <ArrowRight className="w-4 h-4" />
                </Link>
              </Button>
              <Button asChild variant="ghost" className="flex-1">
                <Link to="/">
                  <Home className="w-4 h-4" /> Back home
                </Link>
              </Button>
            </div>
          </div>
        )}

        {!bookingId && !isLoading && (
          <Card><CardContent className="p-6 text-center text-muted-foreground">
            No booking reference provided. <Link to="/dashboard" className="text-primary underline">Go to dashboard</Link>.
          </CardContent></Card>
        )}
      </main>
      <Footer />
    </div>
  );
}
