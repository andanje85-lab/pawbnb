import { assert, assertAlmostEquals, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { distanceKm, matches, weekRef } from "./searchMatch.ts";

const base = {
  city: "Nairobi",
  price_per_night: 40,
  max_dogs: 3,
  amenities: ["Fenced yard", "Daily walks"],
  latitude: -1.2921,
  longitude: 36.8219,
};

Deno.test("distanceKm returns zero for identical points", () => {
  assertEquals(distanceKm({ lat: 1, lng: 2 }, { lat: 1, lng: 2 }), 0);
});

Deno.test("distanceKm approximates a known distance", () => {
  // Nairobi -> Mombasa is roughly 440 km
  const d = distanceKm({ lat: -1.2921, lng: 36.8219 }, { lat: -4.0435, lng: 39.6682 });
  assertAlmostEquals(d, 440, 25);
});

Deno.test("distanceKm is symmetric", () => {
  const a = { lat: -1.29, lng: 36.82 };
  const b = { lat: 0.51, lng: 35.27 };
  assertAlmostEquals(distanceKm(a, b), distanceKm(b, a), 1e-9);
});

Deno.test("matches passes with no filters", () => {
  assert(matches(base, {}));
});

Deno.test("matches does a case-insensitive partial city match", () => {
  assert(matches(base, { city: "nairo" }));
  assertEquals(matches(base, { city: "Kisumu" }), false);
});

Deno.test("matches respects the price range inclusively", () => {
  assert(matches(base, { priceRange: [40, 40] }));
  assertEquals(matches(base, { priceRange: [41, 90] }), false);
  assertEquals(matches(base, { priceRange: [10, 39] }), false);
});

Deno.test("matches requires capacity of at least maxDogs", () => {
  assert(matches(base, { maxDogs: 3 }));
  assertEquals(matches(base, { maxDogs: 4 }), false);
  assertEquals(matches({ ...base, max_dogs: null }, { maxDogs: 1 }), false);
});

Deno.test("matches requires every requested amenity", () => {
  assert(matches(base, { amenities: ["fenced", "walks"] }));
  assertEquals(matches(base, { amenities: ["fenced", "pool"] }), false);
  assertEquals(matches({ ...base, amenities: null }, { amenities: ["fenced"] }), false);
});

Deno.test("matches filters by radius around a center", () => {
  const center = { lat: -1.2921, lng: 36.8219 };
  assert(matches(base, { center, radiusKm: 5 }));
  assertEquals(matches({ ...base, latitude: -4.0435, longitude: 39.6682 }, { center, radiusKm: 50 }), false);
});

Deno.test("matches rejects listings without coordinates when radius is set", () => {
  assertEquals(
    matches({ ...base, latitude: null, longitude: null }, { center: { lat: 0, lng: 0 }, radiusKm: 100 }),
    false,
  );
});

Deno.test("matches ignores radius when no center is provided", () => {
  assert(matches({ ...base, latitude: null, longitude: null }, { radiusKm: 10 }));
});

Deno.test("weekRef pads single-digit weeks and is stable within a week", () => {
  assertEquals(weekRef(new Date("2026-01-02T00:00:00Z")), "2026-W01");
  const a = weekRef(new Date("2026-09-01T00:00:00Z"));
  const b = weekRef(new Date("2026-09-02T23:59:00Z"));
  assertEquals(a, b);
  assert(/^\d{4}-W\d{2}$/.test(a));
});
