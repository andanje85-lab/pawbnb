import { useState, useMemo } from "react";
import Header from "@/components/Header";
import Hero from "@/components/Hero";
import ListingCard from "@/components/ListingCard";
import ListingFilters, { FilterValues } from "@/components/ListingFilters";
import HowItWorks from "@/components/HowItWorks";
import TrustSection from "@/components/TrustSection";
import Footer from "@/components/Footer";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowUpDown, LayoutGrid, Map as MapIcon } from "lucide-react";
import ListingsMap from "@/components/ListingsMap";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

type SortOption = "newest" | "price_asc" | "price_desc" | "rating_desc" | "distance";
type ViewMode = "list" | "map";

import listing1 from "@/assets/listing-1.jpg";
import listing2 from "@/assets/listing-2.jpg";
import listing3 from "@/assets/listing-3.jpg";
import listing4 from "@/assets/listing-4.jpg";
import listing5 from "@/assets/listing-5.jpg";
import listing6 from "@/assets/listing-6.jpg";

const fallbackListings = [
  { id: "sunny-backyard-haven", image: listing1, title: "Sunny Backyard Haven", location: "Portland, OR", rating: 4.9, reviews: 127, price: 45, verified: true, tags: ["Fenced Yard", "Small Dogs"], maxDogs: 2, amenities: ["Fenced Yard"] },
  { id: "downtown-dog-friendly-loft", image: listing2, title: "Downtown Dog-Friendly Loft", location: "Austin, TX", rating: 4.8, reviews: 89, price: 55, verified: true, tags: ["All Sizes", "Daycare"], maxDogs: 3, amenities: ["Daycare"] },
  { id: "country-farmhouse-retreat", image: listing3, title: "Country Farmhouse Retreat", location: "Asheville, NC", rating: 5.0, reviews: 203, price: 38, verified: true, tags: ["Large Yard", "Multiple Dogs"], maxDogs: 5, amenities: ["Fenced Yard"] },
  { id: "luxury-pool-villa", image: listing4, title: "Luxury Pool Villa", location: "Scottsdale, AZ", rating: 4.9, reviews: 156, price: 75, verified: true, tags: ["Pool", "Premium"], maxDogs: 2, amenities: ["Pool"] },
  { id: "coastal-beach-cottage", image: listing5, title: "Coastal Beach Cottage", location: "Malibu, CA", rating: 4.7, reviews: 64, price: 65, verified: false, tags: ["Beach Access", "Medium Dogs"], maxDogs: 2, amenities: ["Beach Access"] },
  { id: "english-garden-cottage", image: listing6, title: "English Garden Cottage", location: "Denver, CO", rating: 4.9, reviews: 198, price: 42, verified: true, tags: ["Garden", "Small Dogs"], maxDogs: 1, amenities: ["Garden"] },
];

// Haversine distance in km
const distanceKm = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
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

const Index = () => {
  const [filters, setFilters] = useState<FilterValues>({
    city: "",
    priceRange: [0, 200],
    maxDogs: null,
    amenities: [],
    center: null,
    radiusKm: null,
    dateRange: null,
  });
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const [viewMode, setViewMode] = useState<ViewMode>("list");

  const { data: dbListings, isLoading } = useQuery({
    queryKey: ["listings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("listings")
        .select("id, title, city, price_per_night, amenities, max_dogs, latitude, longitude, is_active, created_at, listing_photos(url, sort_order)")
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Fetch bookings overlapping the requested date range to exclude unavailable listings
  const { data: conflictingListingIds } = useQuery({
    queryKey: [
      "booking-conflicts",
      filters.dateRange?.from?.toISOString(),
      filters.dateRange?.to?.toISOString(),
    ],
    enabled: !!(filters.dateRange?.from && filters.dateRange?.to),
    queryFn: async () => {
      const from = filters.dateRange!.from.toISOString().split("T")[0];
      const to = filters.dateRange!.to.toISOString().split("T")[0];
      // A booking conflicts when it overlaps the window: check_in < to AND check_out > from
      const { data, error } = await supabase
        .from("bookings")
        .select("listing_id, check_in, check_out, status")
        .in("status", ["pending", "confirmed"])
        .lt("check_in", to)
        .gt("check_out", from);
      if (error) throw error;
      return new Set((data || []).map((b) => b.listing_id));
    },
  });

  const hasDbListings = dbListings && dbListings.length > 0;

  const allListings = useMemo(() => {
    if (hasDbListings) {
      return dbListings.map((l) => {
        const photos = (l.listing_photos || []).sort((a, b) => a.sort_order - b.sort_order);
        return {
          id: l.id,
          image: photos[0]?.url || listing1,
          title: l.title,
          location: l.city || "Unknown",
          rating: 0,
          reviews: 0,
          price: l.price_per_night,
          verified: true,
          tags: (l.amenities || []).slice(0, 2),
          maxDogs: l.max_dogs,
          amenities: l.amenities || [],
          latitude: (l as any).latitude as number | null,
          longitude: (l as any).longitude as number | null,
          createdAt: (l as any).created_at as string | null,
        };
      });
    }
    return fallbackListings.map((l) => ({ ...l, latitude: null, longitude: null, createdAt: null }));
  }, [dbListings, hasDbListings]);

  const filteredListings = useMemo(() => {
    return allListings.filter((listing) => {
      // City filter (case-insensitive partial match)
      if (filters.city && !listing.location.toLowerCase().includes(filters.city.toLowerCase())) {
        return false;
      }
      // Price range
      if (listing.price < filters.priceRange[0] || listing.price > filters.priceRange[1]) {
        return false;
      }
      // Dog capacity
      if (filters.maxDogs !== null && listing.maxDogs < filters.maxDogs) {
        return false;
      }
      // Amenities (all selected must be present)
      if (filters.amenities.length > 0) {
        const listingAmenities = listing.amenities.map((a) => a.toLowerCase());
        const allMatch = filters.amenities.every((a) =>
          listingAmenities.some((la) => la.includes(a.toLowerCase()))
        );
        if (!allMatch) return false;
      }
      // Distance filter — only applied when both center and radius are set;
      // listings missing coordinates are excluded.
      if (filters.center && filters.radiusKm !== null) {
        if (listing.latitude == null || listing.longitude == null) return false;
        const d = distanceKm(filters.center, {
          lat: listing.latitude,
          lng: listing.longitude,
        });
        if (d > filters.radiusKm) return false;
      }
      // Availability filter — exclude listings with overlapping bookings
      if (filters.dateRange && conflictingListingIds?.has(listing.id)) {
        return false;
      }
      return true;
    });
  }, [allListings, filters, conflictingListingIds]);

  const listingsWithDistance = useMemo(() => {
    return filteredListings.map((l) => {
      let d: number | null = null;
      if (filters.center && l.latitude != null && l.longitude != null) {
        d = distanceKm(filters.center, { lat: l.latitude, lng: l.longitude });
      }
      return { ...l, distanceKm: d };
    });
  }, [filteredListings, filters.center]);

  const sortedListings = useMemo(() => {
    const list = [...listingsWithDistance];
    switch (sortBy) {
      case "price_asc":
        return list.sort((a, b) => a.price - b.price);
      case "price_desc":
        return list.sort((a, b) => b.price - a.price);
      case "rating_desc":
        return list.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
      case "distance":
        return list.sort((a, b) => {
          const da = a.distanceKm ?? Number.POSITIVE_INFINITY;
          const db = b.distanceKm ?? Number.POSITIVE_INFINITY;
          return da - db;
        });
      case "newest":
      default:
        return list.sort((a, b) => {
          const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return tb - ta;
        });
    }
  }, [listingsWithDistance, sortBy]);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <Hero />

      <section id="listings" className="py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-8"
          >
            <h2 className="font-serif text-3xl sm:text-4xl font-bold text-foreground mb-3">
              Top-Rated Hosts Near You
            </h2>
            <p className="text-muted-foreground">
              Loving homes vetted by our team and trusted by thousands of dog parents.
            </p>
          </motion.div>

          {/* Filters */}
          <div className="mb-6">
            <ListingFilters onFilterChange={setFilters} />
          </div>

          {/* Sort + view toggle + result count */}
          <div className="mb-6 flex items-center justify-between gap-3 flex-wrap">
            <p className="text-sm text-muted-foreground">
              {isLoading ? "Loading…" : `${sortedListings.length} ${sortedListings.length === 1 ? "stay" : "stays"}`}
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              <ToggleGroup
                type="single"
                value={viewMode}
                onValueChange={(v) => v && setViewMode(v as ViewMode)}
                className="rounded-xl border border-border bg-card p-0.5"
              >
                <ToggleGroupItem value="list" className="rounded-lg gap-1.5 data-[state=on]:bg-secondary">
                  <LayoutGrid className="w-4 h-4" />
                  <span className="text-xs">List</span>
                </ToggleGroupItem>
                <ToggleGroupItem value="map" className="rounded-lg gap-1.5 data-[state=on]:bg-secondary">
                  <MapIcon className="w-4 h-4" />
                  <span className="text-xs">Map</span>
                </ToggleGroupItem>
              </ToggleGroup>

              <div className="flex items-center gap-2">
                <ArrowUpDown className="w-4 h-4 text-muted-foreground" />
                <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
                  <SelectTrigger className="w-[200px] rounded-xl">
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="newest">Newest availability</SelectItem>
                    <SelectItem value="price_asc">Price: low to high</SelectItem>
                    <SelectItem value="price_desc">Price: high to low</SelectItem>
                    <SelectItem value="rating_desc">Top rated</SelectItem>
                    <SelectItem value="distance" disabled={!filters.center}>
                      Distance{!filters.center ? " (set location)" : ""}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {isLoading ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="space-y-3">
                  <Skeleton className="aspect-[4/3] rounded-2xl" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              ))}
            </div>
          ) : sortedListings.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-16"
            >
              <p className="text-lg font-medium text-foreground mb-2">No listings match your filters</p>
              <p className="text-muted-foreground text-sm">Try adjusting your search criteria or clearing filters.</p>
            </motion.div>
          ) : viewMode === "map" ? (
            <ListingsMap
              listings={sortedListings
                .filter((l) => l.latitude != null && l.longitude != null)
                .map((l) => ({
                  id: l.id,
                  title: l.title,
                  image: l.image,
                  price: l.price,
                  location: l.location,
                  latitude: l.latitude as number,
                  longitude: l.longitude as number,
                }))}
              center={filters.center}
            />
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {sortedListings.map((listing) => (
                <ListingCard
                  key={listing.id}
                  {...listing}
                  distanceKm={listing.distanceKm}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      <HowItWorks />
      <TrustSection />
      <Footer />
    </div>
  );
};

export default Index;
