export type CancellationPolicy = "flexible" | "moderate" | "strict";

export interface PolicyPreset {
  id: CancellationPolicy;
  label: string;
  tagline: string;
  /** Days before check-in for full refund cut-off */
  freeDays: number;
  /** Days before check-in for 50% refund cut-off */
  partialDays: number;
  /** Partial refund percentage (0-100) */
  partialPct: number;
}

export const POLICY_PRESETS: Record<CancellationPolicy, PolicyPreset> = {
  flexible: {
    id: "flexible",
    label: "Flexible",
    tagline: "Full refund up to 1 day before check-in",
    freeDays: 1,
    partialDays: 0,
    partialPct: 0,
  },
  moderate: {
    id: "moderate",
    label: "Moderate",
    tagline: "Full refund 7 days out, 50% refund 3 days out",
    freeDays: 7,
    partialDays: 3,
    partialPct: 50,
  },
  strict: {
    id: "strict",
    label: "Strict",
    tagline: "Full refund 30 days out, 50% refund 14 days out",
    freeDays: 30,
    partialDays: 14,
    partialPct: 50,
  },
};

export const getPolicy = (id?: string | null): PolicyPreset =>
  POLICY_PRESETS[(id as CancellationPolicy) ?? "moderate"] ?? POLICY_PRESETS.moderate;
