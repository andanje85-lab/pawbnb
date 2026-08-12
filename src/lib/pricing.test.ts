import { describe, it, expect, vi } from "vitest";
import { computePricing, type ListingPricingInputs } from "./pricing";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

const base: ListingPricingInputs = {
  price_per_night: 50,
  max_dogs: 3,
  extra_dog_price: 20,
  repeat_guest_discount_pct: 10,
  long_stay_min_nights: 7,
  long_stay_discount_pct: 15,
};

describe("computePricing", () => {
  it("prices a single dog with no discounts", () => {
    const r = computePricing({ ...base, repeat_guest_discount_pct: 0, long_stay_discount_pct: 0 }, 3, 1);
    expect(r.subtotal).toBe(150);
    expect(r.extraDogNightly).toBe(0);
    expect(r.discountPct).toBe(0);
    expect(r.total).toBe(150);
  });

  it("charges the extra-dog surcharge per additional dog per night", () => {
    const r = computePricing({ ...base, repeat_guest_discount_pct: 0, long_stay_discount_pct: 0 }, 2, 3);
    expect(r.extraDogNightly).toBe(40);
    expect(r.subtotal).toBe((50 + 40) * 2);
  });

  it("applies the repeat-guest discount only for repeat guests", () => {
    const once = computePricing(base, 2, 1);
    expect(once.discountPct).toBe(0);

    const again = computePricing(base, 2, 1, { isRepeatGuest: true });
    expect(again.discountPct).toBe(10);
    expect(again.discountAmount).toBe(10);
    expect(again.total).toBe(90);
    expect(again.discountReason).toContain("repeat-guest");
  });

  it("applies the long-stay discount at the minimum night threshold", () => {
    const short = computePricing(base, 6, 1);
    expect(short.qualifiesLongStay).toBe(false);

    const long = computePricing(base, 7, 1);
    expect(long.qualifiesLongStay).toBe(true);
    expect(long.discountPct).toBe(15);
    expect(long.total).toBe(350 - 52.5);
  });

  it("never stacks discounts — the larger one wins", () => {
    const r = computePricing(base, 7, 1, { isRepeatGuest: true });
    expect(r.discountPct).toBe(15);
    expect(r.discountReason).toContain("long-stay");

    const repeatBigger = computePricing(
      { ...base, repeat_guest_discount_pct: 25 },
      7,
      1,
      { isRepeatGuest: true },
    );
    expect(repeatBigger.discountPct).toBe(25);
    expect(repeatBigger.discountReason).toContain("repeat-guest");
  });

  it("handles missing/null pricing fields without producing NaN", () => {
    const r = computePricing(
      { price_per_night: 40, max_dogs: 1, extra_dog_price: null, repeat_guest_discount_pct: null, long_stay_min_nights: null, long_stay_discount_pct: null },
      4,
      2,
      { isRepeatGuest: true },
    );
    expect(Number.isNaN(r.total)).toBe(false);
    expect(r.total).toBe(160);
  });

  it("clamps negative nights to a zero subtotal", () => {
    const r = computePricing(base, -3, 1);
    expect(r.subtotal).toBe(0);
    expect(r.total).toBe(0);
  });
});
