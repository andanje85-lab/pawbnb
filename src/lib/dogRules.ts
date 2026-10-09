export type DogRules = {
  maxSize: string | null; // small | medium | large
  requireNeutered: boolean;
  requireVaccinated: boolean;
  minAgeMonths: number | null;
};

export type RuleDog = {
  name: string;
  size: string | null;
  spayed_neutered: boolean | null;
  vaccination_status: string | null;
  date_of_birth: string | null;
};

const SIZE_RANK: Record<string, number> = { small: 1, medium: 2, large: 3 };

export const hasAnyRule = (r: DogRules) =>
  !!r.maxSize || r.requireNeutered || r.requireVaccinated || (r.minAgeMonths ?? 0) > 0;

export function describeRules(r: DogRules): string[] {
  const out: string[] = [];
  if (r.maxSize) out.push(r.maxSize === "small" ? "Small dogs only" : `Up to ${r.maxSize} dogs`);
  if (r.requireNeutered) out.push("Spayed / neutered only");
  if (r.requireVaccinated) out.push("Vaccines must be up to date");
  if ((r.minAgeMonths ?? 0) > 0) out.push(`At least ${r.minAgeMonths} months old`);
  return out;
}

function ageInMonths(dob: string, now: Date): number {
  const d = new Date(dob + "T00:00");
  let m = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
  if (now.getDate() < d.getDate()) m -= 1;
  return m;
}

/** Returns human-readable reasons the dog doesn't fit the house rules (empty = fits). */
export function checkDog(dog: RuleDog, r: DogRules, now = new Date()): string[] {
  const issues: string[] = [];
  if (r.maxSize && dog.size && SIZE_RANK[dog.size] && SIZE_RANK[dog.size] > SIZE_RANK[r.maxSize]) {
    issues.push(`${dog.name} is ${dog.size}; this host accepts up to ${r.maxSize}`);
  }
  if (r.requireNeutered && !dog.spayed_neutered) issues.push(`${dog.name} isn't spayed/neutered`);
  if (r.requireVaccinated && dog.vaccination_status !== "up_to_date") {
    issues.push(`${dog.name}'s vaccines aren't marked up to date`);
  }
  if ((r.minAgeMonths ?? 0) > 0) {
    if (!dog.date_of_birth) issues.push(`${dog.name} has no birth date — the host needs dogs ${r.minAgeMonths}+ months`);
    else if (ageInMonths(dog.date_of_birth, now) < r.minAgeMonths!) {
      issues.push(`${dog.name} is younger than ${r.minAgeMonths} months`);
    }
  }
  return issues;
}
