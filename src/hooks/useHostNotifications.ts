import { useEffect, useRef, useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import type { Notification } from "@/components/NotificationPanel";

export function useHostNotifications() {
  const { user } = useAuth();
  const [permissionState, setPermissionState] = useState<NotificationPermission>(
    typeof Notification !== "undefined" ? Notification.permission : "denied"
  );
  const [notifications, setNotifications] = useState<Notification[]>([]);
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

  // Load existing notifications
  useEffect(() => {
    if (!user) return;
    supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(30)
      .then(({ data }) => {
        if (data) setNotifications(data as unknown as Notification[]);
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
          if (!hostListingIdsRef.current.includes(booking.listing_id)) return;
          if (booking.guest_id === user.id) return;

          const { data: listing } = await supabase
            .from("listings")
            .select("title")
            .eq("id", booking.listing_id)
            .maybeSingle();

          const title = listing?.title || "your listing";
          const notifTitle = `🐾 New booking request for ${title}`;
          const notifBody = `${booking.number_of_dogs} dog(s) · $${booking.total_price}`;

          // Persist to database
          const { data: inserted } = await supabase
            .from("notifications")
            .insert({
              user_id: user.id,
              title: notifTitle,
              body: notifBody,
              type: "booking",
              reference_id: booking.id,
            })
            .select()
            .single();

          if (inserted) {
            setNotifications((prev) => [inserted as unknown as Notification, ...prev].slice(0, 30));
          }

          // Play notification sound
          try {
            const audio = new Audio("/notification.wav");
            audio.volume = 0.6;
            audio.play().catch(() => {});
          } catch {}

          // In-app toast
          toast.info(notifTitle, { description: notifBody, duration: 8000 });

          // Browser notification
          if (window.Notification?.permission === "granted") {
            new window.Notification("🐾 New Booking Request", {
              body: `${title} — ${notifBody}`,
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
    if (typeof window.Notification === "undefined") return;
    const result = await window.Notification.requestPermission();
    setPermissionState(result);
  }, []);

  const markRead = useCallback(async (id: string) => {
    await supabase.from("notifications").update({ is_read: true }).eq("id", id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    );
  }, []);

  const markAllRead = useCallback(async () => {
    if (!user) return;
    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", user.id)
      .eq("is_read", false);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  }, [user]);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return { permissionState, requestPermission, notifications, unreadCount, markRead, markAllRead };
}
