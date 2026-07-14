import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import ListingCard from "@/components/ListingCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Heart } from "lucide-react";
import listing1 from "@/assets/listing-1.jpg";

const FavoritesList = () => {
  const { user } = useAuth();

  const { data: listings, isLoading } = useQuery({
    queryKey: ["favorite-listings", user?.id],
    queryFn: async () => {
      const { data: favs, error: fe } = await supabase
        .from("favorites")
        .select("listing_id, created_at")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (fe) throw fe;
      const ids = (favs || []).map((f) => f.listing_id);
      if (ids.length === 0) return [];
      const { data, error } = await supabase
        .from("listings")
        .select("id, title, city, price_per_night, amenities, listing_photos(url, sort_order)")
        .in("id", ids)
        .eq("is_active", true);
      if (error) throw error;
      // preserve fav order
      const map = new Map((data || []).map((l) => [l.id, l]));
      return ids.map((id) => map.get(id)).filter(Boolean) as any[];
    },
    enabled: !!user,
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="aspect-[4/3] rounded-2xl" />
        ))}
      </div>
    );
  }

  if (!listings || listings.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mx-auto mb-4">
          <Heart className="w-7 h-7 text-muted-foreground" />
        </div>
        <h3 className="font-serif text-lg font-bold text-foreground mb-1">No favorites yet</h3>
        <p className="text-sm text-muted-foreground">Tap the heart on any listing to save it here.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {listings.map((l) => {
        const photos = (l.listing_photos || []).sort((a: any, b: any) => a.sort_order - b.sort_order);
        return (
          <ListingCard
            key={l.id}
            id={l.id}
            image={photos[0]?.url || listing1}
            title={l.title}
            location={l.city || "Unknown"}
            rating={0}
            reviews={0}
            price={l.price_per_night}
            verified={true}
            tags={(l.amenities || []).slice(0, 2)}
          />
        );
      })}
    </div>
  );
};

export default FavoritesList;
