import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ChatWindow from "@/components/ChatWindow";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";
import { MessageSquare, Dog } from "lucide-react";
import { format } from "date-fns";

interface Conversation {
  bookingId: string;
  otherUserId: string;
  otherUserName: string;
  listingTitle: string;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
}

const Messages = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeBookingId = searchParams.get("booking");
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);

  // Fetch all conversations (bookings where user is guest or host)
  const { data: conversations, isLoading } = useQuery({
    queryKey: ["conversations", user?.id],
    queryFn: async () => {
      // Get bookings as guest
      const { data: guestBookings } = await supabase
        .from("bookings")
        .select("id, guest_id, listing_id, listings(title, host_id)")
        .eq("guest_id", user!.id);

      // Get bookings as host
      const { data: hostBookings } = await supabase
        .from("bookings")
        .select("id, guest_id, listing_id, listings!inner(title, host_id)")
        .eq("listings.host_id", user!.id);

      const allBookings = [
        ...(guestBookings || []).map((b: any) => ({
          bookingId: b.id,
          otherUserId: b.listings?.host_id,
          listingTitle: b.listings?.title || "Listing",
          role: "guest" as const,
        })),
        ...(hostBookings || []).map((b: any) => ({
          bookingId: b.id,
          otherUserId: b.guest_id,
          listingTitle: b.listings?.title || "Listing",
          role: "host" as const,
        })),
      ];

      // Deduplicate by bookingId
      const unique = Array.from(new Map(allBookings.map((b) => [b.bookingId, b])).values());

      // Fetch profiles for other users
      const otherIds = [...new Set(unique.map((b) => b.otherUserId).filter(Boolean))];
      let profileMap: Record<string, string> = {};
      if (otherIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, full_name")
          .in("user_id", otherIds);
        profileMap = Object.fromEntries((profiles || []).map((p) => [p.user_id, p.full_name || "User"]));
      }

      // Fetch last message + unread count for each booking
      const convos: Conversation[] = [];
      for (const b of unique) {
        const { data: lastMsg } = await supabase
          .from("messages")
          .select("content, created_at")
          .eq("booking_id", b.bookingId)
          .order("created_at", { ascending: false })
          .limit(1);

        const { count } = await supabase
          .from("messages")
          .select("id", { count: "exact", head: true })
          .eq("booking_id", b.bookingId)
          .eq("recipient_id", user!.id)
          .is("read_at", null);

        convos.push({
          bookingId: b.bookingId,
          otherUserId: b.otherUserId,
          otherUserName: profileMap[b.otherUserId] || "User",
          listingTitle: b.listingTitle,
          lastMessage: lastMsg?.[0]?.content || "",
          lastMessageAt: lastMsg?.[0]?.created_at || "",
          unreadCount: count || 0,
        });
      }

      // Sort by last message time, conversations with messages first
      return convos.sort((a, b) => {
        if (!a.lastMessageAt && !b.lastMessageAt) return 0;
        if (!a.lastMessageAt) return 1;
        if (!b.lastMessageAt) return -1;
        return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
      });
    },
    enabled: !!user,
  });

  // Set active conversation from URL param
  useEffect(() => {
    if (activeBookingId && conversations) {
      const convo = conversations.find((c) => c.bookingId === activeBookingId);
      if (convo) setActiveConversation(convo);
    }
  }, [activeBookingId, conversations]);

  if (authLoading) return null;

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="pt-20 pb-24 flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <h1 className="font-serif text-2xl font-bold text-foreground mb-2">Sign in to view messages</h1>
            <Button onClick={() => navigate("/auth")}>Sign In</Button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const openConversation = (convo: Conversation) => {
    setActiveConversation(convo);
    setSearchParams({ booking: convo.bookingId });
  };

  const closeConversation = () => {
    setActiveConversation(null);
    setSearchParams({});
  };

  const totalUnread = conversations?.reduce((sum, c) => sum + c.unreadCount, 0) || 0;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <main className="pt-16 flex-1 flex flex-col">
        <div className="max-w-5xl mx-auto w-full flex-1 flex flex-col md:flex-row">
          {/* Conversation list */}
          <div
            className={`w-full md:w-80 lg:w-96 border-r border-border flex flex-col shrink-0 ${
              activeConversation ? "hidden md:flex" : "flex"
            }`}
          >
            <div className="p-4 border-b border-border">
              <h1 className="font-serif text-xl font-bold text-foreground flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-primary" />
                Messages
                {totalUnread > 0 && (
                  <Badge className="bg-primary text-primary-foreground text-xs">{totalUnread}</Badge>
                )}
              </h1>
            </div>

            <div className="flex-1 overflow-y-auto">
              {isLoading ? (
                <div className="p-4 space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex gap-3">
                      <Skeleton className="w-10 h-10 rounded-full" />
                      <div className="flex-1">
                        <Skeleton className="h-4 w-24 mb-2" />
                        <Skeleton className="h-3 w-40" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : !conversations || conversations.length === 0 ? (
                <div className="p-8 text-center">
                  <Dog className="w-12 h-12 mx-auto text-muted-foreground/40 mb-3" />
                  <p className="text-sm text-muted-foreground">No conversations yet</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Book a stay or receive a booking to start chatting
                  </p>
                </div>
              ) : (
                conversations.map((convo) => (
                  <motion.button
                    key={convo.bookingId}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => openConversation(convo)}
                    className={`w-full text-left p-4 border-b border-border hover:bg-secondary/50 transition-colors ${
                      activeConversation?.bookingId === convo.bookingId ? "bg-secondary" : ""
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm text-foreground truncate">
                            {convo.otherUserName}
                          </span>
                          {convo.unreadCount > 0 && (
                            <Badge className="bg-primary text-primary-foreground text-[10px] px-1.5 py-0">
                              {convo.unreadCount}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">{convo.listingTitle}</p>
                        {convo.lastMessage && (
                          <p className="text-xs text-muted-foreground truncate mt-1">{convo.lastMessage}</p>
                        )}
                      </div>
                      {convo.lastMessageAt && (
                        <span className="text-[10px] text-muted-foreground shrink-0">
                          {format(new Date(convo.lastMessageAt), "MMM d")}
                        </span>
                      )}
                    </div>
                  </motion.button>
                ))
              )}
            </div>
          </div>

          {/* Chat area */}
          <div
            className={`flex-1 flex flex-col ${
              !activeConversation ? "hidden md:flex" : "flex"
            }`}
          >
            {activeConversation ? (
              <ChatWindow
                bookingId={activeConversation.bookingId}
                recipientId={activeConversation.otherUserId}
                recipientName={activeConversation.otherUserName}
                listingTitle={activeConversation.listingTitle}
                onBack={closeConversation}
              />
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <MessageSquare className="w-16 h-16 mx-auto text-muted-foreground/20 mb-4" />
                  <p className="text-muted-foreground">Select a conversation to start chatting</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Messages;
