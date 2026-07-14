import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { User, MapPin, Star, ShieldCheck, Dog } from "lucide-react";
import { format } from "date-fns";
import ListingCard from "@/components/ListingCard";
import listing1 from "@/assets/listing-1.jpg";

const PublicProfile = () => {
  const { userId } = useParams<{ userId: string }>();

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ["public-profile", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, full_name, bio, city, avatar_url, is_host, created_at")
        .eq("user_id", userId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });

  const { data: hostListings } = useQuery({
    queryKey: ["public-profile-listings", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("listings")
        .select("id, title, city, price_per_night, amenities, listing_photos(url, sort_order)")
        .eq("host_id", userId!)
        .eq("is_active", true);
      if (error) throw error;
      return data || [];
    },
    enabled: !!userId && !!profile?.is_host,
  });

  const listingIds = (hostListings || []).map((l) => l.id);

  // Reviews received as a host (on their listings)
  const { data: reviewsReceived } = useQuery({
    queryKey: ["public-profile-reviews-received", userId, listingIds],
    queryFn: async () => {
      if (listingIds.length === 0) return [];
      const { data, error } = await supabase
        .from("reviews")
        .select("id, rating, comment, created_at, listing_id, reviewer_id, listings(title), profiles:reviewer_id(full_name)")
        .in("listing_id", listingIds)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!userId && listingIds.length > 0,
  });

  // Reviews written by this user (as a guest)
  const { data: reviewsWritten } = useQuery({
    queryKey: ["public-profile-reviews-written", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reviews")
        .select("id, rating, comment, created_at, listing_id, listings(title, city)")
        .eq("reviewer_id", userId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!userId,
  });

  if (profileLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="pt-24 pb-16 px-4 max-w-4xl mx-auto space-y-6">
          <Skeleton className="h-40 w-full rounded-2xl" />
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-40 w-full" />
        </main>
        <Footer />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="pt-24 pb-16 px-4 max-w-2xl mx-auto text-center">
          <h1 className="font-serif text-2xl font-bold text-foreground mb-2">Profile not found</h1>
          <p className="text-muted-foreground">This user doesn't exist or hasn't set up their profile.</p>
        </main>
        <Footer />
      </div>
    );
  }

  const name = profile.full_name || "PawBnB member";
  const initials = name.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();
  const receivedAvg =
    reviewsReceived && reviewsReceived.length > 0
      ? (reviewsReceived.reduce((s, r) => s + r.rating, 0) / reviewsReceived.length).toFixed(1)
      : null;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="pt-24 pb-16 px-4 max-w-4xl mx-auto space-y-8">
        {/* Header card */}
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row gap-6 items-start">
              <Avatar className="w-24 h-24">
                <AvatarImage src={profile.avatar_url ?? undefined} />
                <AvatarFallback><User className="w-10 h-10" /></AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="font-serif text-2xl font-bold text-foreground">{name}</h1>
                  {profile.is_host && (
                    <Badge variant="secondary" className="gap-1">
                      <ShieldCheck className="w-3 h-3" />
                      Host
                    </Badge>
                  )}
                </div>
                {profile.city && (
                  <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                    <MapPin className="w-3.5 h-3.5" /> {profile.city}
                  </p>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  Joined {format(new Date(profile.created_at), "MMMM yyyy")}
                </p>
                {profile.bio && (
                  <p className="text-sm text-foreground leading-relaxed mt-4 whitespace-pre-wrap">{profile.bio}</p>
                )}
                {receivedAvg && (
                  <div className="mt-4 flex items-center gap-2">
                    <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                    <span className="text-sm font-medium text-foreground">
                      {receivedAvg} · {reviewsReceived!.length} review{reviewsReceived!.length !== 1 ? "s" : ""} as host
                    </span>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Host listings */}
        {profile.is_host && (hostListings?.length ?? 0) > 0 && (
          <section>
            <h2 className="font-serif text-xl font-bold text-foreground mb-4 flex items-center gap-2">
              <Dog className="w-5 h-5" /> {name}'s listings
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {hostListings!.map((l) => {
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
          </section>
        )}

        {/* Reviews received (host) */}
        {reviewsReceived && reviewsReceived.length > 0 && (
          <section>
            <h2 className="font-serif text-xl font-bold text-foreground mb-4">Reviews from guests</h2>
            <div className="space-y-4">
              {reviewsReceived.map((r: any) => {
                const reviewer = r.profiles as any;
                const listingTitle = (r.listings as any)?.title;
                return (
                  <Card key={r.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <Link to={`/u/${r.reviewer_id}`} className="text-sm font-medium hover:underline">
                          {reviewer?.full_name || "Guest"}
                        </Link>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(r.created_at), "MMM yyyy")}
                        </span>
                        {listingTitle && (
                          <span className="text-xs text-muted-foreground">· stayed at {listingTitle}</span>
                        )}
                      </div>
                      <div className="flex gap-0.5 mb-2">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star
                            key={s}
                            className={`w-3.5 h-3.5 ${s <= r.rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/20"}`}
                          />
                        ))}
                      </div>
                      {r.comment && <p className="text-sm text-muted-foreground leading-relaxed">{r.comment}</p>}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </section>
        )}

        {/* Reviews written (guest) */}
        {reviewsWritten && reviewsWritten.length > 0 && (
          <section>
            <h2 className="font-serif text-xl font-bold text-foreground mb-4">Reviews {name} has written</h2>
            <div className="space-y-4">
              {reviewsWritten.map((r: any) => {
                const listing = r.listings as any;
                return (
                  <Card key={r.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        {listing?.title && (
                          <Link to={`/listing/${r.listing_id}`} className="text-sm font-medium hover:underline">
                            {listing.title}
                          </Link>
                        )}
                        {listing?.city && (
                          <span className="text-xs text-muted-foreground">· {listing.city}</span>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(r.created_at), "MMM yyyy")}
                        </span>
                      </div>
                      <div className="flex gap-0.5 mb-2">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star
                            key={s}
                            className={`w-3.5 h-3.5 ${s <= r.rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/20"}`}
                          />
                        ))}
                      </div>
                      {r.comment && <p className="text-sm text-muted-foreground leading-relaxed">{r.comment}</p>}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </section>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default PublicProfile;
