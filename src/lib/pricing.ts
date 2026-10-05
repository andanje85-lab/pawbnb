import { supabase } from "@/integrations/supabase/client";

export interface ListingPricingInputs {
  price_per_night: number;
  max_dogs: number;
  extra_dog_price?: number | null;
  repeat_guest_discount_pct?: number | null;
  long_stay_min_nights?: number | null;
  long_stay_discount_pct?: number | null;
  booking_type?: string | null;
  /** Nightly rate for Friday & Saturday nights; falls back to price_per_night. */
  weekend_price?: number | null;
  seasonal_rates?: SeasonalRate[] | null;
}

export interface SeasonalRate {
  name: string;
  start_date: string; // yyyy-mm-dd, inclusive
  end_date: string; // yyyy-mm-dd, inclusive
  price_per_night: number;
}

const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Price for one night starting on `date`: season beats weekend beats base. */
export function nightlyRateFor(listing: ListingPricingInputs, date: Date): { price: number; kind: "base" | "weekend" | "season"; label?: string } {
  const key = ymd(date);
  const season = (listing.seasonal_rates || []).find((r) => key >= r.start_date && key <= r.end_date);
  if (season) return { price: Number(season.price_per_night) || 0, kind: "season", label: season.name };
  const dow = date.getDay();
  const wk = Number(listing.weekend_price ?? 0);
  if ((dow === 5 || dow === 6) && wk > 0) return { price: wk, kind: "weekend" };
  return { price: Number(listing.price_per_night) || 0, kind: "base" };
}

export interface PricingBreakdown {
  nights: number;
  baseNightly: number;
  /** Sum of nightly rates across the stay (before extra-dog fees). */
  baseTotal: number;
  weekendNights: number;
  seasonNights: number;
  extraDogNightly: number;
  subtotal: number;
  discountPct: number;
  discountAmount: number;
  discountReason: string | null;
  total: number;
  isRepeatGuest: boolean;
  qualifiesLongStay: boolean;
}

export function computePricing(
  listing: ListingPricingInputs,
  nights: number,
  numDogs: number,
  opts: { isRepeatGuest?: boolean; checkIn?: Date | null } = {},
): PricingBreakdown {
  const isRepeatGuest = !!opts.isRepeatGuest;
  const baseNightly = Number(listing.price_per_night) || 0;
  const extraDogPrice = Number(listing.extra_dog_price ?? 0) || 0;
  const extraDogs = Math.max(0, numDogs - 1);
  const extraDogNightly = extraDogs * extraDogPrice;
  const n = Math.max(0, nights);
  let baseTotal = baseNightly * n;
  let weekendNights = 0;
  let seasonNights = 0;
  if (opts.checkIn && n > 0) {
    baseTotal = 0;
    for (let i = 0; i < n; i++) {
      const d = new Date(opts.checkIn.getFullYear(), opts.checkIn.getMonth(), opts.checkIn.getDate() + i);
      const r = nightlyRateFor(listing, d);
      baseTotal += r.price;
      if (r.kind === "weekend") weekendNights++;
      if (r.kind === "season") seasonNights++;
    }
  }
  const subtotal = baseTotal + extraDogNightly * n;

  const longMin = listing.long_stay_min_nights ?? null;
  const longPct = Number(listing.long_stay_discount_pct ?? 0) || 0;
  const repeatPct = Number(listing.repeat_guest_discount_pct ?? 0) || 0;

  const qualifiesLongStay = !!(longMin && longPct > 0 && nights >= longMin);
  const longApplied = qualifiesLongStay ? longPct : 0;
  const repeatApplied = isRepeatGuest ? repeatPct : 0;

  // Use the larger discount (don't stack)
  let discountPct = 0;
  let discountReason: string | null = null;
  if (longApplied >= repeatApplied && longApplied > 0) {
    discountPct = longApplied;
    discountReason = `${longApplied}% long-stay discount (${longMin}+ nights)`;
  } else if (repeatApplied > 0) {
    discountPct = repeatApplied;
    discountReason = `${repeatApplied}% repeat-guest discount`;
  }

  const discountAmount = Math.round((subtotal * discountPct) / 100 * 100) / 100;
  const total = Math.max(0, subtotal - discountAmount);

  return {
    nights,
    baseNightly,
    baseTotal,
    weekendNights,
    seasonNights,
    extraDogNightly,
    subtotal,
    discountPct,
    discountAmount,
    discountReason,
    total,
    isRepeatGuest,
    qualifiesLongStay,
  };
}

/** Returns true if guest has a prior confirmed booking with this host. */
export async function isRepeatGuestFor(guestId: string, hostId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("bookings")
    .select("id, listings!inner(host_id)")
    .eq("guest_id", guestId)
    .eq("status", "confirmed")
    .eq("listings.host_id", hostId)
    .limit(1);
  if (error) return false;
  return (data || []).length > 0;
}
