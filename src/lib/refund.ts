import { differenceInCalendarDays } from "date-fns";
import { getPolicy, type CancellationPolicy } from "./cancellationPolicy";

export interface RefundQuote {
  percentage: number; // 0-100
  amount: number;
  tier: "free" | "partial" | "none";
  reason: string;
  daysUntilCheckIn: number;
}

/**
 * Compute the refund a guest is entitled to if they cancel right now,
 * based on the listing's cancellation policy preset and check-in date.
 */
export function computeRefund(
  policyId: string | null | undefined,
  checkInISO: string,
  totalPrice: number,
  now: Date = new Date(),
): RefundQuote {
  const policy = getPolicy(policyId as CancellationPolicy | undefined);
  const checkIn = new Date(checkInISO);
  const days = differenceInCalendarDays(checkIn, now);

  if (days >= policy.freeDays) {
    return {
      percentage: 100,
      amount: Math.round(totalPrice * 100) / 100,
      tier: "free",
      reason: `Free cancellation window — ${days} day${days === 1 ? "" : "s"} before check-in.`,
      daysUntilCheckIn: days,
    };
  }

  if (policy.partialPct > 0 && days >= policy.partialDays) {
    const amt = Math.round(((totalPrice * policy.partialPct) / 100) * 100) / 100;
    return {
      percentage: policy.partialPct,
      amount: amt,
      tier: "partial",
      reason: `${policy.partialPct}% refund — within the partial-refund window.`,
      daysUntilCheckIn: days,
    };
  }

  return {
    percentage: 0,
    amount: 0,
    tier: "none",
    reason:
      days < 0
        ? "Check-in date has passed — no refund available."
        : "Inside the non-refundable window — no refund available.",
    daysUntilCheckIn: days,
  };
}
