import Header from "@/components/Header";
import Hero from "@/components/Hero";
import ListingCard from "@/components/ListingCard";
import HowItWorks from "@/components/HowItWorks";
import TrustSection from "@/components/TrustSection";
import Footer from "@/components/Footer";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";

import listing1 from "@/assets/listing-1.jpg";
import listing2 from "@/assets/listing-2.jpg";
import listing3 from "@/assets/listing-3.jpg";
import listing4 from "@/assets/listing-4.jpg";
import listing5 from "@/assets/listing-5.jpg";
import listing6 from "@/assets/listing-6.jpg";

const fallbackListings = [
  { id: "sunny-backyard-haven", image: listing1, title: "Sunny Backyard Haven", location: "Portland, OR", rating: 4.9, reviews: 127, price: 45, verified: true, tags: ["Fenced Yard", "Small Dogs"] },
  { id: "downtown-dog-friendly-loft", image: listing2, title: "Downtown Dog-Friendly Loft", location: "Austin, TX", rating: 4.8, reviews: 89, price: 55, verified: true, tags: ["All Sizes", "Daycare"] },
  { id: "country-farmhouse-retreat", image: listing3, title: "Country Farmhouse Retreat", location: "Asheville, NC", rating: 5.0, reviews: 203, price: 38, verified: true, tags: ["Large Yard", "Multiple Dogs"] },
  { id: "luxury-pool-villa", image: listing4, title: "Luxury Pool Villa", location: "Scottsdale, AZ", rating: 4.9, reviews: 156, price: 75, verified: true, tags: ["Pool", "Premium"] },
  { id: "coastal-beach-cottage", image: listing5, title: "Coastal Beach Cottage", location: "Malibu, CA", rating: 4.7, reviews: 64, price: 65, verified: false, tags: ["Beach Access", "Medium Dogs"] },
  { id: "english-garden-cottage", image: listing6, title: "English Garden Cottage", location: "Denver, CO", rating: 4.9, reviews: 198, price: 42, verified: true, tags: ["Garden", "Small Dogs"] },
];

const Index = () => {
  const { data: dbListings, isLoading } = useQuery({
    queryKey: ["listings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("listings")
        .select("id, title, city, price_per_night, amenities, max_dogs, is_active, listing_photos(url, sort_order)")
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const hasDbListings = dbListings && dbListings.length > 0;

  const listings = hasDbListings
    ? dbListings.map((l) => {
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
        };
      })
    : fallbackListings;

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
            className="mb-12"
          >
            <h2 className="font-serif text-3xl sm:text-4xl font-bold text-foreground mb-3">
              Top-Rated Hosts Near You
            </h2>
            <p className="text-muted-foreground">
              Loving homes vetted by our team and trusted by thousands of dog parents.
            </p>
          </motion.div>

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
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {listings.map((listing) => (
                <ListingCard key={listing.id} {...listing} />
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
