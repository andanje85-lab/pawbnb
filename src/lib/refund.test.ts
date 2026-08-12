import { describe, it, expect } from "vitest";
import { computeRefund } from "./refund";
import { getPolicy, POLICY_PRESETS } from "./cancellationPolicy";

const NOW = new Date("2026-06-01T12:00:00.000Z");
const inDays = (d: number) => new Date(NOW.getTime() + d * 86_400_000).toISOString();

describe("getPolicy", () => {
  it("defaults to moderate for unknown or missing ids", () => {
    expect(getPolicy(null).id).toBe("moderate");
    expect(getPolicy(undefined).id).toBe("moderate");
    expect(getPolicy("not-a-policy").id).toBe("moderate");
  });

  it("returns the matching preset", () => {
    expect(getPolicy("strict")).toEqual(POLICY_PRESETS.strict);
  });
});

describe("computeRefund", () => {
  it("gives a full refund outside the free window", () => {
    const r = computeRefund("moderate", inDays(10), 200, NOW);
    expect(r.tier).toBe("free");
    expect(r.percentage).toBe(100);
    expect(r.amount).toBe(200);
  });

  it("treats the free-window boundary as fully refundable", () => {
    const r = computeRefund("moderate", inDays(7), 200, NOW);
    expect(r.tier).toBe("free");
  });

  it("gives a partial refund inside the partial window", () => {
    const r = computeRefund("moderate", inDays(4), 200, NOW);
    expect(r.tier).toBe("partial");
    expect(r.percentage).toBe(50);
    expect(r.amount).toBe(100);
  });

  it("gives nothing inside the non-refundable window", () => {
    const r = computeRefund("moderate", inDays(1), 200, NOW);
    expect(r.tier).toBe("none");
    expect(r.amount).toBe(0);
  });

  it("flags past check-in dates", () => {
    const r = computeRefund("flexible", inDays(-2), 200, NOW);
    expect(r.tier).toBe("none");
    expect(r.reason).toMatch(/passed/i);
    expect(r.daysUntilCheckIn).toBe(-2);
  });

  it("flexible has no partial tier — it is full or nothing", () => {
    expect(computeRefund("flexible", inDays(1), 100, NOW).tier).toBe("free");
    expect(computeRefund("flexible", inDays(0), 100, NOW).tier).toBe("none");
  });

  it("strict requires 30 days for a full refund and 14 for half", () => {
    expect(computeRefund("strict", inDays(31), 100, NOW).tier).toBe("free");
    expect(computeRefund("strict", inDays(20), 100, NOW).percentage).toBe(50);
    expect(computeRefund("strict", inDays(13), 100, NOW).percentage).toBe(0);
  });

  it("rounds refund amounts to cents", () => {
    const r = computeRefund("moderate", inDays(4), 99.99, NOW);
    expect(r.amount).toBe(50);
  });
});
