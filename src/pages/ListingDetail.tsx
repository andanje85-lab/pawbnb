import { useState, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Star, Heart, Shield, MapPin, ArrowLeft, ChevronLeft, ChevronRight, Dog, Users, Calendar as CalendarIcon, MessageSquare } from "lucide-react";
import ReviewsList from "@/components/ReviewsList";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { differenceInDays } from "date-fns";
import type { DateRange } from "react-day-picker";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import LocationMap from "@/components/LocationMap";

import listing1 from "@/assets/listing-1.jpg";
import listing2 from "@/assets/listing-2.jpg";
import listing3 from "@/assets/listing-3.jpg";
import listing4 from "@/assets/listing-4.jpg";
import listing5 from "@/assets/listing-5.jpg";
import listing6 from "@/assets/listing-6.jpg";

const mockListings: Record<string, {
  images: string[];
  title: string;
  location: string;
  rating: number;
  reviews: number;
  price: number;
  verified: boolean;
  hostName: string;
  description: string;
  amenities: string[];
  maxDogs: number;
}> = {
  "sunny-backyard-haven": {
    images: [listing1, listing2, listing3], title: "Sunny Backyard Haven", location: "Portland, OR", rating: 4.9, reviews: 127, price: 45, verified: true, hostName: "Sarah M.",
    description: "A bright, spacious home with a fully fenced backyard perfect for small dogs. Your pup will enjoy fresh air, sunshine, and plenty of room to play.",
    amenities: ["Fenced Yard", "Dog Beds", "Treats Provided", "Daily Photos", "Webcam Access", "Medication Admin"], maxDogs: 2,
  },
  "downtown-dog-friendly-loft": {
    images: [listing2, listing1, listing4], title: "Downtown Dog-Friendly Loft", location: "Austin, TX", rating: 4.8, reviews: 89, price: 55, verified: true, hostName: "Mike R.",
    description: "A modern loft in the heart of downtown with easy access to parks and walking trails.",
    amenities: ["All Dog Sizes", "Daily Walks", "Daycare Available", "City Park Access", "Dog Toys", "Climate Controlled"], maxDogs: 3,
  },
  "country-farmhouse-retreat": {
    images: [listing3, listing5, listing6], title: "Country Farmhouse Retreat", location: "Asheville, NC", rating: 5.0, reviews: 203, price: 38, verified: true, hostName: "Emma K.",
    description: "A peaceful farmhouse on 5 acres of land where your dogs can run free.",
    amenities: ["5 Acre Property", "Multiple Dog Friendly", "Hiking Trails", "Swimming Pond", "Dog Beds", "Home Cooked Meals"], maxDogs: 5,
  },
  "luxury-pool-villa": {
    images: [listing4, listing2, listing3], title: "Luxury Pool Villa", location: "Scottsdale, AZ", rating: 4.9, reviews: 156, price: 75, verified: true, hostName: "David L.",
    description: "A premium dog-sitting experience in a luxury villa with a dog-friendly pool area.",
    amenities: ["Dog Pool", "Premium Treats", "Grooming Service", "Webcam Access", "AC Throughout", "Night Walks"], maxDogs: 2,
  },
  "coastal-beach-cottage": {
    images: [listing5, listing1, listing6], title: "Coastal Beach Cottage", location: "Malibu, CA", rating: 4.7, reviews: 64, price: 65, verified: false, hostName: "Lisa W.",
    description: "Steps from the beach, this cozy cottage is perfect for water-loving dogs.",
    amenities: ["Beach Access", "Outdoor Shower", "Dog Beds", "Daily Photos", "Medium Dogs Only", "Treats Provided"], maxDogs: 2,
  },
  "english-garden-cottage": {
    images: [listing6, listing3, listing1], title: "English Garden Cottage", location: "Denver, CO", rating: 4.9, reviews: 198, price: 42, verified: true, hostName: "Rachel T.",
    description: "A charming cottage with a beautiful English garden where small dogs can explore safely.",
    amenities: ["Private Garden", "Small Dogs Only", "Gentle Care", "Medication Admin", "Daily Updates", "Dog Beds"], maxDogs: 2,
  },
};

const ListingDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();

  const [currentPhoto, setCurrentPhoto] = useState(0);
  const [liked, setLiked] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [numDogs, setNumDogs] = useState(1);
  const [message, setMessage] = useState("");
  const [booking, setBooking] = useState(false);

  // Check if id looks like a UUID (database listing) or a slug (mock listing)
  const isUuid = id ? /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) : false;

  const { data: dbListing, isLoading } = useQuery({
    queryKey: ["listing", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("listings")
        .select("*, listing_photos(url, sort_order)")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      // Fetch host profile separately
      let hostName = "Host";
      if (data) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("user_id", data.host_id)
          .maybeSingle();
        hostName = profile?.full_name || "Host";
      }
      return data ? { ...data, _hostName: hostName } : null;
      if (error) throw error;
      return data;
    },
    enabled: isUuid,
  });

  // Fetch reviews for DB listings
  const { data: reviewStats } = useQuery({
    queryKey: ["reviews-stats", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reviews")
        .select("rating")
        .eq("listing_id", id!);
      if (error) throw error;
      if (!data || data.length === 0) return { avg: 0, count: 0 };
      const avg = data.reduce((s, r) => s + r.rating, 0) / data.length;
      return { avg: parseFloat(avg.toFixed(1)), count: data.length };
    },
    enabled: isUuid,
  });

  // Resolve listing data: DB or mock
  const mock = !isUuid && id ? mockListings[id] : null;

  const listing = useMemo(() => {
    if (isUuid && dbListing) {
      const photos = (dbListing.listing_photos || [])
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((p) => p.url);
      return {
        id: dbListing.id,
        images: photos.length > 0 ? photos : [listing1],
        title: dbListing.title,
        location: dbListing.city || "Unknown",
        rating: reviewStats?.avg || 0,
        reviews: reviewStats?.count || 0,
        price: dbListing.price_per_night,
        verified: true,
        hostName: (dbListing as any)._hostName || "Host",
        description: dbListing.description || "",
        amenities: dbListing.amenities || [],
        maxDogs: dbListing.max_dogs,
        latitude: (dbListing as any).latitude as number | null,
        longitude: (dbListing as any).longitude as number | null,
        isDb: true,
      };
    }
    if (mock) {
      return { ...mock, id: id!, isDb: false, latitude: null, longitude: null };
    }
    return null;
  }, [isUuid, dbListing, mock, id, reviewStats]);

  const nights = useMemo(() => {
    if (dateRange?.from && dateRange?.to) {
      return differenceInDays(dateRange.to, dateRange.from);
    }
    return 0;
  }, [dateRange]);

  if (isUuid && isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="pt-20 pb-24">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="aspect-[16/9] rounded-2xl" />
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="h-4 w-1/3" />
          </div>
        </main>
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="font-serif text-2xl font-bold text-foreground mb-2">Listing not found</h1>
          <Link to="/" className="text-primary hover:underline">Back to home</Link>
        </div>
      </div>
    );
  }

  const handleBook = async () => {
    if (!user) {
      toast.error("Please sign in to book a stay");
      return;
    }
    if (!dateRange?.from || !dateRange?.to) {
      toast.error("Please select check-in and check-out dates");
      return;
    }
    if (!listing.isDb) {
      toast.info("This is a demo listing. Create a real listing to enable bookings!");
      return;
    }
    setBooking(true);
    try {
      const { error } = await supabase.from("bookings").insert({
        listing_id: listing.id,
        guest_id: user.id,
        check_in: dateRange.from.toISOString().split("T")[0],
        check_out: dateRange.to.toISOString().split("T")[0],
        number_of_dogs: numDogs,
        total_price: nights * listing.price,
        message: message || null,
      });
      if (error) throw error;
      toast.success(`Booking request sent for ${nights} night${nights > 1 ? "s" : ""}!`);

      // Fire-and-forget admin notification
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", user.id)
        .maybeSingle();

      // Fire-and-forget admin notification
      supabase.functions.invoke("send-booking-notification", {
        body: {
          type: "new_booking",
          bookingId: "new",
          listingTitle: listing.title,
          listingCity: listing.location,
          checkIn: dateRange.from!.toISOString().split("T")[0],
          checkOut: dateRange.to!.toISOString().split("T")[0],
          numDogs,
          totalPrice: nights * listing.price,
          guestEmail: user.email,
          guestName: profile?.full_name || user.email,
          message: message || null,
        },
      });

      // Fire-and-forget guest confirmation email
      supabase.functions.invoke("send-booking-notification", {
        body: {
          type: "booking_submitted",
          bookingId: "new",
          listingTitle: listing.title,
          listingCity: listing.location,
          checkIn: dateRange.from!.toISOString().split("T")[0],
          checkOut: dateRange.to!.toISOString().split("T")[0],
          numDogs,
          totalPrice: nights * listing.price,
          guestEmail: user.email,
          guestName: profile?.full_name || user.email,
          message: message || null,
        },
      });

      // Fire-and-forget host notification email
      if (dbListing?.host_id) {
        supabase.functions.invoke("send-booking-notification", {
          body: {
            type: "new_booking_host",
            bookingId: "new",
            hostId: dbListing.host_id,
            listingTitle: listing.title,
            listingCity: listing.location,
            checkIn: dateRange.from!.toISOString().split("T")[0],
            checkOut: dateRange.to!.toISOString().split("T")[0],
            numDogs,
            totalPrice: nights * listing.price,
            guestName: profile?.full_name || user.email,
            message: message || null,
          },
        });
      }

      setDateRange(undefined);
      setMessage("");
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setBooking(false);
    }
  };

  const totalPrice = nights * listing.price;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="pt-20 pb-24">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Back to listings
          </Link>

          {/* Photo Gallery */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative aspect-[16/9] sm:aspect-[2/1] rounded-2xl overflow-hidden mb-8"
          >
            <img
              src={listing.images[currentPhoto]}
              alt={`${listing.title} photo ${currentPhoto + 1}`}
              className="w-full h-full object-cover"
            />
            <button
              onClick={() => setLiked(!liked)}
              className="absolute top-4 right-4 w-10 h-10 rounded-full bg-card/80 backdrop-blur-sm flex items-center justify-center hover:bg-card transition-colors"
            >
              <Heart className={`w-5 h-5 ${liked ? "fill-primary text-primary" : "text-foreground"}`} />
            </button>
            {listing.verified && (
              <div className="absolute top-4 left-4 flex items-center gap-1 px-3 py-1.5 rounded-full bg-accent text-accent-foreground text-sm font-medium">
                <Shield className="w-4 h-4" />
                Verified Host
              </div>
            )}
            {listing.images.length > 1 && (
              <>
                <button
                  onClick={() => setCurrentPhoto((p) => (p === 0 ? listing.images.length - 1 : p - 1))}
                  className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-card/80 backdrop-blur-sm flex items-center justify-center hover:bg-card transition-colors"
                >
                  <ChevronLeft className="w-5 h-5 text-foreground" />
                </button>
                <button
                  onClick={() => setCurrentPhoto((p) => (p === listing.images.length - 1 ? 0 : p + 1))}
                  className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-card/80 backdrop-blur-sm flex items-center justify-center hover:bg-card transition-colors"
                >
                  <ChevronRight className="w-5 h-5 text-foreground" />
                </button>
              </>
            )}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
              {listing.images.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentPhoto(i)}
                  className={`w-2 h-2 rounded-full transition-colors ${i === currentPhoto ? "bg-primary-foreground" : "bg-primary-foreground/40"}`}
                />
              ))}
            </div>
          </motion.div>

          {/* Thumbnail strip */}
          <div className="flex gap-2 mb-10 overflow-x-auto">
            {listing.images.map((img, i) => (
              <button
                key={i}
                onClick={() => setCurrentPhoto(i)}
                className={`shrink-0 w-20 h-14 rounded-lg overflow-hidden border-2 transition-colors ${i === currentPhoto ? "border-primary" : "border-transparent"}`}
              >
                <img src={img} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>

          <div className="grid lg:grid-cols-[1fr_380px] gap-10">
            {/* Left: Details */}
            <div>
              <div className="flex items-start justify-between mb-2">
                <h1 className="font-serif text-2xl sm:text-3xl font-bold text-foreground">{listing.title}</h1>
                {listing.rating > 0 && (
                  <div className="flex items-center gap-1 shrink-0 ml-4">
                    <Star className="w-5 h-5 fill-warm-gold text-warm-gold" />
                    <span className="font-semibold text-foreground">{listing.rating}</span>
                    <span className="text-muted-foreground text-sm">({listing.reviews} reviews)</span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1 text-muted-foreground mb-6">
                <MapPin className="w-4 h-4" />
                <span className="text-sm">{listing.location}</span>
              </div>

              <div className="flex items-center gap-3 p-4 rounded-xl bg-secondary mb-8">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Dog className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-foreground text-sm">Hosted by {listing.hostName}</p>
                  <p className="text-xs text-muted-foreground">Up to {listing.maxDogs} dog{listing.maxDogs > 1 ? "s" : ""} welcome</p>
                </div>
              </div>

              <div className="mb-8">
                <h2 className="font-serif text-xl font-bold text-foreground mb-3">About this stay</h2>
                <p className="text-muted-foreground leading-relaxed">{listing.description}</p>
              </div>

              <div>
                <h2 className="font-serif text-xl font-bold text-foreground mb-4">What's included</h2>
                <div className="grid grid-cols-2 gap-3">
                  {listing.amenities.map((amenity) => (
                    <div key={amenity} className="flex items-center gap-2 text-sm text-foreground">
                      <div className="w-2 h-2 rounded-full bg-accent shrink-0" />
                      {amenity}
                    </div>
                  ))}
                </div>
              </div>

              {/* Location Map */}
              {listing.latitude != null && listing.longitude != null && (
                <div className="mt-10">
                  <h2 className="font-serif text-xl font-bold text-foreground mb-2">Where you'll be</h2>
                  <p className="text-sm text-muted-foreground mb-4 flex items-center gap-1">
                    <MapPin className="w-4 h-4" />
                    {listing.location}
                  </p>
                  <LocationMap lat={listing.latitude} lng={listing.longitude} />
                </div>
              )}

              {/* Reviews */}
              {isUuid && id && <ReviewsList listingId={id} />}
            </div>

            {/* Right: Booking Card */}
            <div className="lg:sticky lg:top-24 h-fit">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="rounded-2xl border border-border bg-card p-6 shadow-sm"
              >
                <div className="flex items-baseline gap-1 mb-6">
                  <span className="font-serif text-2xl font-bold text-foreground">${listing.price}</span>
                  <span className="text-muted-foreground">/ night</span>
                </div>

                <div className="mb-4">
                  <Label className="text-sm font-medium mb-2 flex items-center gap-1">
                    <CalendarIcon className="w-4 h-4" />
                    Select dates
                  </Label>
                  <Calendar
                    mode="range"
                    selected={dateRange}
                    onSelect={setDateRange}
                    disabled={{ before: new Date() }}
                    numberOfMonths={1}
                    className="rounded-xl border border-border p-0 [&_.rdp-months]:p-3"
                  />
                </div>

                <div className="mb-4">
                  <Label htmlFor="numDogs" className="text-sm font-medium mb-2 flex items-center gap-1">
                    <Users className="w-4 h-4" />
                    Number of dogs
                  </Label>
                  <Input
                    id="numDogs"
                    type="number"
                    min={1}
                    max={listing.maxDogs}
                    value={numDogs}
                    onChange={(e) => setNumDogs(Math.min(listing.maxDogs, Math.max(1, parseInt(e.target.value) || 1)))}
                  />
                </div>

                <div className="mb-6">
                  <Label htmlFor="message" className="text-sm font-medium mb-2 flex items-center gap-1">
                    <MessageSquare className="w-4 h-4" />
                    Message to host (optional)
                  </Label>
                  <Textarea
                    id="message"
                    placeholder="Tell the host about your dog..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={3}
                  />
                </div>

                {nights > 0 && (
                  <div className="border-t border-border pt-4 mb-4 space-y-2">
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span>${listing.price} × {nights} night{nights > 1 ? "s" : ""}</span>
                      <span>${totalPrice}</span>
                    </div>
                    <div className="flex justify-between font-semibold text-foreground">
                      <span>Total</span>
                      <span>${totalPrice}</span>
                    </div>
                  </div>
                )}

                <Button
                  className="w-full"
                  size="lg"
                  onClick={handleBook}
                  disabled={booking || nights === 0}
                >
                  {!user ? "Sign in to book" : nights === 0 ? "Select dates" : `Request to Book · $${totalPrice}`}
                </Button>
              </motion.div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default ListingDetail;
