import { describe, it, expect } from "vitest";
import { checkDog, describeRules, hasAnyRule } from "./dogRules";

const rules = { maxSize: "medium", requireNeutered: true, requireVaccinated: true, minAgeMonths: 12 };
const now = new Date("2026-10-09T12:00:00");
const good = { name: "Rex", size: "small", spayed_neutered: true, vaccination_status: "up_to_date", date_of_birth: "2024-01-01" };

describe("checkDog", () => {
  it("passes a fitting dog", () => expect(checkDog(good, rules, now)).toEqual([]));
  it("flags each mismatch", () => {
    const bad = { name: "Pup", size: "large", spayed_neutered: false, vaccination_status: "partial", date_of_birth: "2026-06-01" };
    expect(checkDog(bad, rules, now)).toHaveLength(4);
  });
  it("flags missing birth date when age rule set", () =>
    expect(checkDog({ ...good, date_of_birth: null }, rules, now)).toHaveLength(1));
  it("no rules = no issues", () => {
    const none = { maxSize: null, requireNeutered: false, requireVaccinated: false, minAgeMonths: null };
    expect(hasAnyRule(none)).toBe(false);
    expect(checkDog({ ...good, size: "large", spayed_neutered: false }, none, now)).toEqual([]);
  });
  it("describes rules", () => expect(describeRules(rules)).toHaveLength(4));
});
