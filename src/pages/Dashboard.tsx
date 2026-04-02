import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ReviewForm from "@/components/ReviewForm";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { CalendarDays, Dog, MapPin, Plus, ToggleLeft, ToggleRight, Trash2, Star, XCircle } from "lucide-react";
import { format } from "date-fns";
import listing1 from "@/assets/listing-1.jpg";

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
  confirmed: "bg-green-100 text-green-800 border-green-200",
  cancelled: "bg-red-100 text-red-800 border-red-200",
};

const Dashboard = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [reviewingBookingId, setReviewingBookingId] = useState<string | null>(null);
  const [cancelBookingId, setCancelBookingId] = useState<string | null>(null);

  // Fetch profile to check host status
  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Fetch guest bookings with existing reviews
  const { data: bookings, isLoading: bookingsLoading } = useQuery({
    queryKey: ["my-bookings", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select("*, listings(title, city, price_per_night, listing_photos(url, sort_order))")
        .eq("guest_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      // Fetch reviews for these bookings
      const bookingIds = (data || []).map((b) => b.id);
      let reviewedSet = new Set<string>();
      if (bookingIds.length > 0) {
        const { data: reviews } = await supabase
          .from("reviews")
          .select("booking_id")
          .in("booking_id", bookingIds);
        reviewedSet = new Set((reviews || []).map((r) => r.booking_id));
      }
      const reviewedSet = new Set((reviews || []).map((r) => r.booking_id));
      return (data || []).map((b) => ({ ...b, hasReview: reviewedSet.has(b.id) }));
    },
    enabled: !!user,
  });

  // Fetch host listings
  const { data: listings, isLoading: listingsLoading } = useQuery({
    queryKey: ["my-listings", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("listings")
        .select("*, listing_photos(url, sort_order)")
        .eq("host_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user && !!profile?.is_host,
  });

  // Fetch bookings for host's listings (with guest email)
  const { data: hostBookings, isLoading: hostBookingsLoading } = useQuery({
    queryKey: ["host-bookings", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select("*, listings!inner(title, city, host_id), profiles:guest_id(full_name, phone)")
        .eq("listings.host_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      // Fetch guest emails via auth — we need them for notifications
      const guestIds = [...new Set((data || []).map((b) => b.guest_id))];
      const { data: guestProfiles } = await supabase
        .from("profiles")
        .select("user_id, full_name, phone")
        .in("user_id", guestIds.length > 0 ? guestIds : ["__none__"]);
      const profileMap = Object.fromEntries((guestProfiles || []).map((p) => [p.user_id, p]));
      return (data || []).map((b) => ({ ...b, guestProfile: profileMap[b.guest_id] }));
    },
    enabled: !!user && !!profile?.is_host,
  });

  if (authLoading) return null;

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="pt-20 pb-24 flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <h1 className="font-serif text-2xl font-bold text-foreground mb-2">Sign in to view your dashboard</h1>
            <Button onClick={() => navigate("/auth")}>Sign In</Button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const toggleListingActive = async (listingId: string, currentlyActive: boolean) => {
    const { error } = await supabase
      .from("listings")
      .update({ is_active: !currentlyActive })
      .eq("id", listingId);
    if (error) {
      toast.error("Failed to update listing");
    } else {
      toast.success(currentlyActive ? "Listing deactivated" : "Listing activated");
      queryClient.invalidateQueries({ queryKey: ["my-listings"] });
    }
  };

  const deleteListing = async (listingId: string) => {
    const { error } = await supabase
      .from("listings")
      .delete()
      .eq("id", listingId);
    if (error) {
      toast.error("Failed to delete listing");
    } else {
      toast.success("Listing deleted");
      queryClient.invalidateQueries({ queryKey: ["my-listings"] });
    }
  };

  const updateBookingStatus = async (bookingId: string, status: string, booking?: any) => {
    const { error } = await supabase
      .from("bookings")
      .update({ status })
      .eq("id", bookingId);
    if (error) {
      toast.error("Failed to update booking");
      return;
    }
    toast.success(status === "confirmed" ? "Booking confirmed" : "Booking declined");
    queryClient.invalidateQueries({ queryKey: ["host-bookings"] });

    // Send email notification to guest
    if (booking && (status === "confirmed" || status === "cancelled")) {
      const listingData = booking.listings as any;
      const guestProfile = booking.guestProfile as any;
      // Get guest email from auth
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        // Fetch guest email via admin lookup (using service role isn't available client-side)
        // We'll use the guest_id to look up their email from auth metadata stored in profile or use their user id
        // Since we can't access auth.users client-side, we pass what we have and the edge fn uses it
        try {
          await supabase.functions.invoke("send-booking-notification", {
            body: {
              type: status === "confirmed" ? "booking_confirmed" : "booking_declined",
              bookingId: booking.id,
              guestId: booking.guest_id,
              listingTitle: listingData?.title || "your listing",
              listingCity: listingData?.city || "",
              checkIn: booking.check_in,
              checkOut: booking.check_out,
              numDogs: booking.number_of_dogs,
              totalPrice: booking.total_price,
              guestEmail: "",
              guestName: guestProfile?.full_name || "there",
              message: booking.message,
            },
          });
        } catch (e) {
          // Notification failure is non-blocking
          console.warn("Failed to send booking notification email", e);
        }
      }
    }
  };

  const cancelBooking = async (bookingId: string) => {
    const { error } = await supabase
      .from("bookings")
      .update({ status: "cancelled" })
      .eq("id", bookingId)
      .eq("guest_id", user!.id);
    if (error) {
      toast.error("Failed to cancel booking");
    } else {
      toast.success("Booking cancelled");
      queryClient.invalidateQueries({ queryKey: ["my-bookings"] });
    }
    setCancelBookingId(null);
  };

  const getListingPhoto = (listing: any) => {
    const photos = (listing?.listing_photos || []).sort((a: any, b: any) => a.sort_order - b.sort_order);
    return photos[0]?.url || listing1;
  };

  const isHost = profile?.is_host;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="pt-20 pb-24">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <h1 className="font-serif text-3xl font-bold text-foreground mb-1">
              Welcome back{profile?.full_name ? `, ${profile.full_name}` : ""}
            </h1>
            <p className="text-muted-foreground mb-8">Manage your bookings{isHost ? " and listings" : ""}.</p>

            <Tabs defaultValue="bookings">
              <TabsList className="mb-6">
                <TabsTrigger value="bookings">My Bookings</TabsTrigger>
                {isHost && <TabsTrigger value="listings">My Listings</TabsTrigger>}
                {isHost && <TabsTrigger value="requests">Booking Requests</TabsTrigger>}
              </TabsList>

              {/* My Bookings Tab */}
              <TabsContent value="bookings">
                {bookingsLoading ? (
                  <LoadingCards />
                ) : !bookings || bookings.length === 0 ? (
                  <EmptyState
                    title="No bookings yet"
                    description="Find a loving host for your pup and make your first booking."
                    action={<Button onClick={() => navigate("/")}>Explore Listings</Button>}
                  />
                ) : (
                  <div className="space-y-4">
                    {bookings.map((booking) => {
                      const listing = booking.listings as any;
                      return (
                        <motion.div
                          key={booking.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="p-4 rounded-xl border border-border bg-card"
                        >
                          <div className="flex gap-4">
                            <img
                              src={getListingPhoto(listing)}
                              alt={listing?.title}
                              className="w-24 h-24 rounded-lg object-cover shrink-0"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2">
                                <h3 className="font-serif font-bold text-foreground truncate">{listing?.title}</h3>
                                <Badge variant="outline" className={statusColors[booking.status] || ""}>
                                  {booking.status}
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                                <MapPin className="w-3.5 h-3.5" /> {listing?.city || "Unknown"}
                              </p>
                              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <CalendarDays className="w-3.5 h-3.5" />
                                  {format(new Date(booking.check_in), "MMM d")} – {format(new Date(booking.check_out), "MMM d, yyyy")}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Dog className="w-3.5 h-3.5" />
                                  {booking.number_of_dogs} dog{booking.number_of_dogs > 1 ? "s" : ""}
                                </span>
                                <span className="font-medium text-foreground">${booking.total_price}</span>
                              </div>
                              <div className="flex flex-wrap gap-2 mt-2">
                                {booking.status === "confirmed" && !booking.hasReview && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setReviewingBookingId(reviewingBookingId === booking.id ? null : booking.id)}
                                  >
                                    <Star className="w-3.5 h-3.5 mr-1" />
                                    Leave a Review
                                  </Button>
                                )}
                                {booking.hasReview && (
                                  <p className="text-xs text-muted-foreground flex items-center gap-1 self-center">
                                    <Star className="w-3 h-3 fill-amber-400 text-amber-400" /> Reviewed
                                  </p>
                                )}
                                {(booking.status === "pending" || booking.status === "confirmed") && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                    onClick={() => setCancelBookingId(booking.id)}
                                  >
                                    <XCircle className="w-3.5 h-3.5 mr-1" />
                                    Cancel
                                  </Button>
                                )}
                              </div>
                            </div>
                          </div>
                          {reviewingBookingId === booking.id && (
                            <ReviewForm
                              bookingId={booking.id}
                              listingId={booking.listing_id}
                              reviewerId={user!.id}
                              onClose={() => setReviewingBookingId(null)}
                            />
                          )}
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </TabsContent>

              {/* My Listings Tab */}
              {isHost && (
                <TabsContent value="listings">
                  <div className="flex justify-end mb-4">
                    <Button onClick={() => navigate("/create-listing")} size="sm">
                      <Plus className="w-4 h-4 mr-1" /> New Listing
                    </Button>
                  </div>
                  {listingsLoading ? (
                    <LoadingCards />
                  ) : !listings || listings.length === 0 ? (
                    <EmptyState
                      title="No listings yet"
                      description="Create your first listing to start hosting dogs."
                      action={<Button onClick={() => navigate("/create-listing")}>Create Listing</Button>}
                    />
                  ) : (
                    <div className="space-y-4">
                      {listings.map((listing) => (
                        <motion.div
                          key={listing.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="flex gap-4 p-4 rounded-xl border border-border bg-card"
                        >
                          <img
                            src={getListingPhoto(listing)}
                            alt={listing.title}
                            className="w-24 h-24 rounded-lg object-cover shrink-0 cursor-pointer"
                            onClick={() => navigate(`/listing/${listing.id}`)}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <h3
                                className="font-serif font-bold text-foreground truncate cursor-pointer hover:text-primary transition-colors"
                                onClick={() => navigate(`/listing/${listing.id}`)}
                              >
                                {listing.title}
                              </h3>
                              <Badge variant={listing.is_active ? "default" : "secondary"}>
                                {listing.is_active ? "Active" : "Inactive"}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                              <MapPin className="w-3.5 h-3.5" /> {listing.city || "Unknown"}
                            </p>
                            <div className="flex items-center gap-2 mt-3">
                              <span className="text-sm font-medium text-foreground">${listing.price_per_night}/night</span>
                              <span className="text-muted-foreground">·</span>
                              <span className="text-sm text-muted-foreground">Max {listing.max_dogs} dogs</span>
                            </div>
                          </div>
                          <div className="flex flex-col gap-2 shrink-0">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => toggleListingActive(listing.id, listing.is_active)}
                              title={listing.is_active ? "Deactivate" : "Activate"}
                            >
                              {listing.is_active ? <ToggleRight className="w-5 h-5 text-accent" /> : <ToggleLeft className="w-5 h-5 text-muted-foreground" />}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => deleteListing(listing.id)}
                              title="Delete listing"
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </TabsContent>
              )}

              {/* Booking Requests Tab (Host) */}
              {isHost && (
                <TabsContent value="requests">
                  {hostBookingsLoading ? (
                    <LoadingCards />
                  ) : !hostBookings || hostBookings.length === 0 ? (
                    <EmptyState
                      title="No booking requests"
                      description="When guests book your listings, their requests will appear here."
                    />
                  ) : (
                    <div className="space-y-4">
                      {hostBookings.map((booking) => {
                        const guestProfile = booking.profiles as any;
                        const listingData = booking.listings as any;
                        return (
                          <motion.div
                            key={booking.id}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="p-4 rounded-xl border border-border bg-card"
                          >
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <div>
                                <h3 className="font-serif font-bold text-foreground">{listingData?.title}</h3>
                                <p className="text-sm text-muted-foreground">
                                  Guest: {guestProfile?.full_name || "Unknown"}
                                </p>
                              </div>
                              <Badge variant="outline" className={statusColors[booking.status] || ""}>
                                {booking.status}
                              </Badge>
                            </div>
                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground mb-3">
                              <span className="flex items-center gap-1">
                                <CalendarDays className="w-3.5 h-3.5" />
                                {format(new Date(booking.check_in), "MMM d")} – {format(new Date(booking.check_out), "MMM d, yyyy")}
                              </span>
                              <span className="flex items-center gap-1">
                                <Dog className="w-3.5 h-3.5" /> {booking.number_of_dogs} dog{booking.number_of_dogs > 1 ? "s" : ""}
                              </span>
                              <span className="font-medium text-foreground">${booking.total_price}</span>
                            </div>
                            {booking.message && (
                              <p className="text-sm text-muted-foreground italic mb-3">"{booking.message}"</p>
                            )}
                            {booking.status === "pending" && (
                              <div className="flex gap-2">
                                <Button size="sm" onClick={() => updateBookingStatus(booking.id, "confirmed", booking)}>
                                  Confirm
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => updateBookingStatus(booking.id, "cancelled", booking)}>
                                  Decline
                                </Button>
                              </div>
                            )}
                          </motion.div>
                        );
                      })}
                    </div>
                  )}
                </TabsContent>
              )}
            </Tabs>
          </motion.div>
        </div>
      </main>
      <Footer />

      {/* Cancel Booking Confirmation Dialog */}
      <AlertDialog open={!!cancelBookingId} onOpenChange={(open) => !open && setCancelBookingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this booking?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The booking will be marked as cancelled and the host will be notified.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Booking</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => cancelBookingId && cancelBooking(cancelBookingId)}
            >
              Yes, Cancel Booking
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

const LoadingCards = () => (
  <div className="space-y-4">
    {[1, 2, 3].map((i) => (
      <div key={i} className="flex gap-4 p-4 rounded-xl border border-border">
        <Skeleton className="w-24 h-24 rounded-lg" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </div>
    ))}
  </div>
);

const EmptyState = ({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) => (
  <div className="text-center py-16">
    <Dog className="w-12 h-12 text-muted-foreground/40 mx-auto mb-4" />
    <h3 className="font-serif text-lg font-bold text-foreground mb-1">{title}</h3>
    <p className="text-muted-foreground text-sm mb-4">{description}</p>
    {action}
  </div>
);

export default Dashboard;
