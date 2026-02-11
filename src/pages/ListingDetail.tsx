import { useState, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Star, Heart, Shield, MapPin, ArrowLeft, ChevronLeft, ChevronRight, Dog, Users, Calendar as CalendarIcon, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { differenceInDays, addDays } from "date-fns";
import type { DateRange } from "react-day-picker";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

import listing1 from "@/assets/listing-1.jpg";
import listing2 from "@/assets/listing-2.jpg";
import listing3 from "@/assets/listing-3.jpg";
import listing4 from "@/assets/listing-4.jpg";
import listing5 from "@/assets/listing-5.jpg";
import listing6 from "@/assets/listing-6.jpg";

const mockListings = [
  {
    id: "sunny-backyard-haven",
    images: [listing1, listing2, listing3],
    title: "Sunny Backyard Haven",
    location: "Portland, OR",
    rating: 4.9,
    reviews: 127,
    price: 45,
    verified: true,
    tags: ["Fenced Yard", "Small Dogs"],
    hostName: "Sarah M.",
    hostAvatar: null,
    description: "A bright, spacious home with a fully fenced backyard perfect for small dogs. Your pup will enjoy fresh air, sunshine, and plenty of room to play. I've been caring for dogs for over 8 years and treat every guest like my own.",
    amenities: ["Fenced Yard", "Dog Beds", "Treats Provided", "Daily Photos", "Webcam Access", "Medication Admin"],
    maxDogs: 2,
  },
  {
    id: "downtown-dog-friendly-loft",
    images: [listing2, listing1, listing4],
    title: "Downtown Dog-Friendly Loft",
    location: "Austin, TX",
    rating: 4.8,
    reviews: 89,
    price: 55,
    verified: true,
    tags: ["All Sizes", "Daycare"],
    hostName: "Mike R.",
    hostAvatar: null,
    description: "A modern loft in the heart of downtown with easy access to parks and walking trails. I welcome dogs of all sizes and provide structured daycare routines including walks, playtime, and rest.",
    amenities: ["All Dog Sizes", "Daily Walks", "Daycare Available", "City Park Access", "Dog Toys", "Climate Controlled"],
    maxDogs: 3,
  },
  {
    id: "country-farmhouse-retreat",
    images: [listing3, listing5, listing6],
    title: "Country Farmhouse Retreat",
    location: "Asheville, NC",
    rating: 5.0,
    reviews: 203,
    price: 38,
    verified: true,
    tags: ["Large Yard", "Multiple Dogs"],
    hostName: "Emma K.",
    hostAvatar: null,
    description: "A peaceful farmhouse on 5 acres of land where your dogs can run free. Perfect for multiple dogs who love outdoor adventures. I have experience with all breeds and temperaments.",
    amenities: ["5 Acre Property", "Multiple Dog Friendly", "Hiking Trails", "Swimming Pond", "Dog Beds", "Home Cooked Meals"],
    maxDogs: 5,
  },
  {
    id: "luxury-pool-villa",
    images: [listing4, listing2, listing3],
    title: "Luxury Pool Villa",
    location: "Scottsdale, AZ",
    rating: 4.9,
    reviews: 156,
    price: 75,
    verified: true,
    tags: ["Pool", "Premium"],
    hostName: "David L.",
    hostAvatar: null,
    description: "A premium dog-sitting experience in a luxury villa with a dog-friendly pool area. Your pup will enjoy the finer things — gourmet treats, spa grooming, and plenty of attention.",
    amenities: ["Dog Pool", "Premium Treats", "Grooming Service", "Webcam Access", "AC Throughout", "Night Walks"],
    maxDogs: 2,
  },
  {
    id: "coastal-beach-cottage",
    images: [listing5, listing1, listing6],
    title: "Coastal Beach Cottage",
    location: "Malibu, CA",
    rating: 4.7,
    reviews: 64,
    price: 65,
    verified: false,
    tags: ["Beach Access", "Medium Dogs"],
    hostName: "Lisa W.",
    hostAvatar: null,
    description: "Steps from the beach, this cozy cottage is perfect for water-loving dogs. Morning beach walks and sunset play sessions are part of every stay.",
    amenities: ["Beach Access", "Outdoor Shower", "Dog Beds", "Daily Photos", "Medium Dogs Only", "Treats Provided"],
    maxDogs: 2,
  },
  {
    id: "english-garden-cottage",
    images: [listing6, listing3, listing1],
    title: "English Garden Cottage",
    location: "Denver, CO",
    rating: 4.9,
    reviews: 198,
    price: 42,
    verified: true,
    tags: ["Garden", "Small Dogs"],
    hostName: "Rachel T.",
    hostAvatar: null,
    description: "A charming cottage with a beautiful English garden where small dogs can explore safely. I provide gentle, loving care with structured routines and lots of cuddle time.",
    amenities: ["Private Garden", "Small Dogs Only", "Gentle Care", "Medication Admin", "Daily Updates", "Dog Beds"],
    maxDogs: 2,
  },
];

const ListingDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const listing = mockListings.find((l) => l.id === id);

  const [currentPhoto, setCurrentPhoto] = useState(0);
  const [liked, setLiked] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [numDogs, setNumDogs] = useState(1);
  const [message, setMessage] = useState("");
  const [booking, setBooking] = useState(false);

  const nights = useMemo(() => {
    if (dateRange?.from && dateRange?.to) {
      return differenceInDays(dateRange.to, dateRange.from);
    }
    return 0;
  }, [dateRange]);

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
    setBooking(true);
    try {
      // For now, show success since we're using mock listings (no real listing_id in DB)
      toast.success(`Booking request sent for ${nights} night${nights > 1 ? "s" : ""}!`);
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
          {/* Back link */}
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
            {/* Dots */}
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
                <div className="flex items-center gap-1 shrink-0 ml-4">
                  <Star className="w-5 h-5 fill-warm-gold text-warm-gold" />
                  <span className="font-semibold text-foreground">{listing.rating}</span>
                  <span className="text-muted-foreground text-sm">({listing.reviews} reviews)</span>
                </div>
              </div>
              <div className="flex items-center gap-1 text-muted-foreground mb-6">
                <MapPin className="w-4 h-4" />
                <span className="text-sm">{listing.location}</span>
              </div>

              {/* Host */}
              <div className="flex items-center gap-3 p-4 rounded-xl bg-secondary mb-8">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Dog className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-foreground text-sm">Hosted by {listing.hostName}</p>
                  <p className="text-xs text-muted-foreground">Up to {listing.maxDogs} dog{listing.maxDogs > 1 ? "s" : ""} welcome</p>
                </div>
              </div>

              {/* Description */}
              <div className="mb-8">
                <h2 className="font-serif text-xl font-bold text-foreground mb-3">About this stay</h2>
                <p className="text-muted-foreground leading-relaxed">{listing.description}</p>
              </div>

              {/* Amenities */}
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

                {/* Date Picker */}
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

                {/* Number of dogs */}
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

                {/* Message */}
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

                {/* Price breakdown */}
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
