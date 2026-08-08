import { useState, useEffect, useMemo } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format, differenceInCalendarDays } from "date-fns";
import { computePricing, isRepeatGuestFor, type ListingPricingInputs } from "@/lib/pricing";
import { toast } from "sonner";
import { CalendarDays, Dog, ArrowRight, Loader2 } from "lucide-react";
import type { DateRange } from "react-day-picker";

interface Props {
  booking: any;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSubmitted?: () => void;
}

export default function BookingModificationDialog({ booking, open, onOpenChange, onSubmitted }: Props) {
  const { user } = useAuth();
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [repeatGuest, setRepeatGuest] = useState(false);
  const [loadingRepeat, setLoadingRepeat] = useState(false);

  const listing = booking?.listings as any;
  const originalCheckIn = booking ? new Date(booking.check_in) : new Date();
  const originalCheckOut = booking ? new Date(booking.check_out) : new Date();
  const originalNights = booking ? differenceInCalendarDays(originalCheckOut, originalCheckIn) : 0;
  const originalTotal = booking ? Number(booking.total_price) : 0;

  // Determine if guest is a repeat guest for this host (for pricing recompute)
  useEffect(() => {
    if (!open || !booking || !user) return;
    let active = true;
    setLoadingRepeat(true);
    isRepeatGuestFor(user.id, listing?.host_id)
      .then((v) => { if (active) setRepeatGuest(v); })
      .finally(() => { if (active) setLoadingRepeat(false); });
    return () => { active = false; };
  }, [open, booking, user, listing?.host_id]);

  const pricingInputs: ListingPricingInputs | null = listing
    ? {
        price_per_night: Number(listing.price_per_night),
        max_dogs: listing.max_dogs,
        extra_dog_price: listing.extra_dog_price,
        repeat_guest_discount_pct: listing.repeat_guest_discount_pct,
        long_stay_min_nights: listing.long_stay_min_nights,
        long_stay_discount_pct: listing.long_stay_discount_pct,
      }
    : null;

  const newNights = dateRange?.from && dateRange?.to
    ? differenceInCalendarDays(dateRange.to, dateRange.from)
    : 0;

  const newBreakdown = useMemo(() => {
    if (!pricingInputs || newNights <= 0) return null;
    return computePricing(pricingInputs, newNights, booking?.number_of_dogs ?? 1, { isRepeatGuest: repeatGuest });
  }, [pricingInputs, newNights, booking?.number_of_dogs, repeatGuest]);

  const priceDiff = newBreakdown ? newBreakdown.total - originalTotal : 0;

  const reset = () => {
    setDateRange(undefined);
    setReason("");
  };

  const handleSubmit = async () => {
    if (!dateRange?.from || !dateRange?.to || !booking || !user) {
      toast.error("Please select new check-in and check-out dates");
      return;
    }
    if (newNights <= 0) {
      toast.error("Check-out must be after check-in");
      return;
    }
    if (!newBreakdown) return;

    setSubmitting(true);
    try {
      // Prevent duplicate pending requests
      const { data: existing } = await supabase
        .from("booking_modifications")
        .select("id")
        .eq("booking_id", booking.id)
        .eq("status", "pending")
        .maybeSingle();
      if (existing) {
        toast.error("You already have a pending date-change request for this booking");
        setSubmitting(false);
        return;
      }

      const { error } = await supabase.from("booking_modifications").insert({
        booking_id: booking.id,
        requested_by: user.id,
        original_check_in: booking.check_in,
        original_check_out: booking.check_out,
        original_total_price: originalTotal,
        requested_check_in: dateRange.from!.toISOString().split("T")[0],
        requested_check_out: dateRange.to!.toISOString().split("T")[0],
        requested_total_price: newBreakdown.total,
        reason: reason.trim() || null,
        status: "pending",
      });
      if (error) throw error;

      // Notify the host in-app
      const hostId = listing?.host_id;
      if (hostId) {
        await supabase.from("notifications").insert({
          user_id: hostId,
          title: `📅 Date change requested — ${listing?.title || "your listing"}`,
          body: `${format(dateRange.from!, "MMM d")} → ${format(dateRange.to!, "MMM d, yyyy")} · $${newBreakdown.total.toFixed(2)}`,
          type: "modification",
          reference_id: booking.id,
        });
      }

      // Best-effort email to host
      try {
        await supabase.functions.invoke("send-booking-notification", {
          body: {
            type: "modification_requested",
            bookingId: booking.id,
            guestId: user.id,
            hostId,
            listingTitle: listing?.title || "your listing",
            listingCity: listing?.city || "",
            checkIn: format(dateRange.from!, "MMM d, yyyy"),
            checkOut: format(dateRange.to!, "MMM d, yyyy"),
            originalCheckIn: format(originalCheckIn, "MMM d, yyyy"),
            originalCheckOut: format(originalCheckOut, "MMM d, yyyy"),
            numDogs: booking.number_of_dogs,
            totalPrice: newBreakdown.total.toFixed(2),
            guestName: "",
            message: reason.trim() || "",
          },
        });
      } catch {}

      toast.success("Date-change request sent to your host");
      reset();
      onOpenChange(false);
      onSubmitted?.();
    } catch (e: any) {
      toast.error(e.message || "Failed to submit request");
    } finally {
      setSubmitting(false);
    }
  };

  if (!booking) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif flex items-center gap-2">
            <CalendarDays className="w-4 h-4" /> Request date change
          </DialogTitle>
          <DialogDescription>
            Ask your host to adjust the dates for "{listing?.title}".
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* Current dates */}
          <div className="rounded-lg border border-border bg-muted/30 p-3">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium mb-1">
              Current booking
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="font-medium">{format(originalCheckIn, "MMM d, yyyy")}</span>
              <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="font-medium">{format(originalCheckOut, "MMM d, yyyy")}</span>
            </div>
            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><CalendarDays className="w-3 h-3" />{originalNights} nights</span>
              <span className="flex items-center gap-1"><Dog className="w-3 h-3" />{booking.number_of_dogs} dog{booking.number_of_dogs > 1 ? "s" : ""}</span>
              <span className="font-medium text-foreground">${originalTotal.toFixed(2)}</span>
            </div>
          </div>

          {/* New dates */}
          <div>
            <Label className="text-sm font-medium mb-2 block">Select new dates</Label>
            <Calendar
              mode="range"
              selected={dateRange}
              onSelect={setDateRange}
              disabled={{ before: new Date() }}
              numberOfMonths={1}
              className="rounded-xl border border-border p-0 [&_.rdp-months]:p-3 mx-auto"
            />
          </div>

          {/* Price preview */}
          <div className="rounded-lg border border-border p-3 space-y-1.5">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">New stay ({newNights || 0} nights)</span>
              <span className="font-medium">
                {newBreakdown ? `$${newBreakdown.total.toFixed(2)}` : "—"}
              </span>
            </div>
            {newBreakdown && newBreakdown.discountReason && (
              <div className="text-xs text-emerald-700">{newBreakdown.discountReason}</div>
            )}
            {newBreakdown && priceDiff !== 0 && (
              <div className="flex justify-between text-xs pt-1 border-t border-border">
                <span className="text-muted-foreground">Price difference</span>
                <Badge variant="outline" className={priceDiff > 0 ? "border-amber-300 text-amber-700" : "border-emerald-300 text-emerald-700"}>
                  {priceDiff > 0 ? `+$${priceDiff.toFixed(2)}` : `−$${Math.abs(priceDiff).toFixed(2)}`}
                </Badge>
              </div>
            )}
          </div>

          {/* Reason */}
          <div>
            <Label className="text-sm font-medium mb-1.5 block">Reason (optional)</Label>
            <Textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. My travel plans changed and I need to extend by two days."
              maxLength={500}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => { reset(); onOpenChange(false); }}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={submitting || !newBreakdown}>
            {submitting && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
            Send request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
