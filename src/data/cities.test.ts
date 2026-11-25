import { describe, expect, it } from "vitest";
import { CITIES, getCityBySlug } from "./cities";

describe("worldwide city directory", () => {
  it("includes dog boarding destinations in Kenya and other regions", () => {
    expect(getCityBySlug("nairobi")?.country).toBe("Kenya");
    expect(getCityBySlug("mombasa")?.country).toBe("Kenya");
    expect(getCityBySlug("london")?.country).toBe("United Kingdom");
    expect(getCityBySlug("sydney")?.country).toBe("Australia");
    expect(getCityBySlug("tokyo")?.country).toBe("Japan");
  });

  it("gives every destination a country name", () => {
    expect(CITIES.length).toBeGreaterThan(20);
    expect(CITIES.every((city) => city.country.trim().length > 0)).toBe(true);
  });

  it("keeps existing U.S. city URLs working", () => {
    expect(getCityBySlug("portland-or")?.country).toBe("United States");
    expect(getCityBySlug("austin-tx")?.name).toBe("Austin");
  });
});