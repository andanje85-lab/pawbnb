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

/** ISO-style year + week reference used to make weekly digests idempotent. */
export function weekRef(now: Date): string {
  const week = Math.ceil(
    ((now.getTime() - Date.UTC(now.getUTCFullYear(), 0, 1)) / 86400000 + 1) / 7,
  );
  return `${now.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}
