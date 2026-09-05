/**
 * Pure matching helpers shared by saved-search alerts.
 * Kept free of Deno.serve / network access so they can be unit tested.
 */

export interface LatLng {
  lat: number;
  lng: number;
}

export interface SavedFilters {
  city?: string;
  priceRange?: [number, number];
  maxDogs?: number | null;
  amenities?: string[];
  center?: LatLng | null;
  radiusKm?: number | null;
}

export interface MatchableListing {
  city?: string | null;
  price_per_night?: number | null;
  max_dogs?: number | null;
  amenities?: string[] | null;
  latitude?: number | null;
  longitude?: number | null;
}

/** Great-circle distance between two coordinates, in kilometres. */
export const distanceKm = (a: LatLng, b: LatLng): number => {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(h));
};

/** True when a listing satisfies every constraint of a saved search. */
export function matches(listing: MatchableListing, f: SavedFilters): boolean {
  if (f.city && !(listing.city || "").toLowerCase().includes(f.city.toLowerCase())) return false;
  if (f.priceRange) {
    const price = Number(listing.price_per_night ?? 0);
    if (price < f.priceRange[0] || price > f.priceRange[1]) return false;
  }
  if (f.maxDogs != null && (listing.max_dogs ?? 0) < f.maxDogs) return false;
  if (f.amenities?.length) {
    const la = (listing.amenities || []).map((a: string) => a.toLowerCase());
    const ok = f.amenities.every((a) => la.some((x: string) => x.includes(a.toLowerCase())));
    if (!ok) return false;
  }
  if (f.center && f.radiusKm != null) {
    if (listing.latitude == null || listing.longitude == null) return false;
    if (distanceKm(f.center, { lat: listing.latitude, lng: listing.longitude }) > f.radiusKm) {
      return false;
    }
  }
  return true;
}

/** ISO-8601 year + week reference used to make weekly digests idempotent. */
export function weekRef(now: Date): string {
  // Thursday of the current ISO week determines the ISO year and week number.
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const dayNum = (d.getUTCDay() + 6) % 7; // Monday = 0
  d.setUTCDate(d.getUTCDate() - dayNum + 3);
  const isoYear = d.getUTCFullYear();
  const firstThursday = new Date(Date.UTC(isoYear, 0, 4));
  const firstDayNum = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNum + 3);
  const week = 1 + Math.round((d.getTime() - firstThursday.getTime()) / (7 * 86400000));
  return `${isoYear}-W${String(week).padStart(2, "0")}`;
}

