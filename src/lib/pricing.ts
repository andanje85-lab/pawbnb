import { supabase } from "@/integrations/supabase/client";

export interface ListingPricingInputs {
  price_per_night: number;
  max_dogs: number;
  extra_dog_price?: number | null;
  repeat_guest_discount_pct?: number | null;
  long_stay_min_nights?: number | null;
  long_stay_discount_pct?: number | null;
  booking_type?: string | null;
}

export interface PricingBreakdown {
  nights: number;
  baseNightly: number;
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
  opts: { isRepeatGuest?: boolean } = {},
): PricingBreakdown {
  const isRepeatGuest = !!opts.isRepeatGuest;
  const baseNightly = Number(listing.price_per_night) || 0;
  const extraDogPrice = Number(listing.extra_dog_price ?? 0) || 0;
  const extraDogs = Math.max(0, numDogs - 1);
  const extraDogNightly = extraDogs * extraDogPrice;
  const perNight = baseNightly + extraDogNightly;
  const subtotal = perNight * Math.max(0, nights);

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
