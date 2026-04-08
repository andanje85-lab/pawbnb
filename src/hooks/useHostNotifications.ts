import { useEffect, useRef, useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export function useHostNotifications() {
  const { user } = useAuth();
  const [permissionState, setPermissionState] = useState<NotificationPermission>(
    typeof Notification !== "undefined" ? Notification.permission : "denied"
  );
  const hostListingIdsRef = useRef<string[]>([]);

  // Fetch the host's listing IDs once
  useEffect(() => {
    if (!user) return;
    supabase
      .from("listings")
      .select("id")
      .eq("host_id", user.id)
      .then(({ data }) => {
        hostListingIdsRef.current = data?.map((l) => l.id) || [];
      });
  }, [user]);

  // Subscribe to realtime booking inserts
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("host-booking-notifications")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "bookings" },
        async (payload) => {
          const booking = payload.new as any;
          // Only notify if this booking is for one of the host's listings
          if (!hostListingIdsRef.current.includes(booking.listing_id)) return;
          // Don't notify if the host made the booking themselves
          if (booking.guest_id === user.id) return;

          // Fetch listing title for the notification
          const { data: listing } = await supabase
            .from("listings")
            .select("title")
            .eq("id", booking.listing_id)
            .maybeSingle();

          const title = listing?.title || "your listing";

          // Play notification sound
          try {
            const audio = new Audio("/notification.mp3");
            audio.volume = 0.6;
            audio.play().catch(() => {});
          } catch {}

          // In-app toast
          toast.info(`🐾 New booking request for ${title}`, {
            description: `${booking.number_of_dogs} dog(s) · $${booking.total_price}`,
            duration: 8000,
          });

          // Browser notification
          if (Notification.permission === "granted") {
            new Notification(`🐾 New Booking Request`, {
              body: `${title} — ${booking.number_of_dogs} dog(s) · $${booking.total_price}`,
              icon: "/placeholder.svg",
              tag: `booking-${booking.id}`,
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const requestPermission = useCallback(async () => {
    if (typeof Notification === "undefined") return;
    const result = await Notification.requestPermission();
    setPermissionState(result);
  }, []);

  return { permissionState, requestPermission };
}
