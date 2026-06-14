import { useEffect, useRef, useState } from "react";
import { useLocation, matchPath, Link } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import { MessageCircle, X, Send, PawPrint } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

import BiscuitListingCard, { type BiscuitListingMeta } from "@/components/BiscuitListingCard";

interface Msg {
  role: "user" | "assistant";
  content: string;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const KNOWN_AMENITIES = [
  "fenced yard","yard","garden","pool","park","beach","walks","dog walk","walking",
  "grooming","training","pickup","drop off","pet sitter","sitter","cameras","camera",
  "ac","air conditioning","heating","crate","kennel","kitchen","wifi","parking","large dogs",
  "small dogs","puppy","senior","medication","vet","24/7","cat friendly","kids",
];

function extractSearchHints(text: string) {
  const t = text.toLowerCase();
  const amenities = KNOWN_AMENITIES.filter((a) => t.includes(a));
  // crude city: "in X" / "near X" / "around X"
  const cityMatch = t.match(/\b(?:in|near|around|at)\s+([a-zà-ÿ][a-zà-ÿ\s\-']{1,40}?)(?:[.,?!]|$| with| for| that| who| who's| under| over| less| more)/i);
  const city = cityMatch?.[1]?.trim();
  // budget
  const priceMatch = t.match(/(?:under|less than|below|max|<)\s*\$?\s*(\d{2,4})/);
  const maxPrice = priceMatch ? Number(priceMatch[1]) : undefined;
  // dogs count
  const dogsMatch = t.match(/(\d+)\s*dogs?/);
  const dogs = dogsMatch ? Number(dogsMatch[1]) : undefined;
  return { amenities, city, maxPrice, dogs, raw: text };
}

async function searchListings(latestUserMsg: string) {
  const hints = extractSearchHints(latestUserMsg);
  let q = supabase
    .from("listings")
    .select("id, title, city, price_per_night, max_dogs, amenities, description, cancellation_policy, listing_photos(url, sort_order)")
    .eq("is_active", true)
    .limit(6);

  if (hints.city) q = q.ilike("city", `%${hints.city}%`);
  if (hints.maxPrice) q = q.lte("price_per_night", hints.maxPrice);
  if (hints.dogs) q = q.gte("max_dogs", hints.dogs);
  if (hints.amenities.length) q = q.overlaps("amenities", hints.amenities);

  let { data } = await q;

  // Fallback: if nothing matched with strict filters, try broader text search
  if ((!data || data.length === 0) && (hints.city || hints.amenities.length)) {
    const term = hints.city || hints.amenities[0];
    const { data: fallback } = await supabase
      .from("listings")
      .select("id, title, city, price_per_night, max_dogs, amenities, description, cancellation_policy")
      .eq("is_active", true)
      .or(`title.ilike.%${term}%,description.ilike.%${term}%,city.ilike.%${term}%`)
      .limit(6);
    data = fallback || [];
  }

  return { hints, results: data || [] };
}

async function buildContext(pathname: string, userId: string | undefined, latestUserMsg: string) {
  const context: any = { route: pathname };

  // Listing detail page
  const listingMatch = matchPath("/listing/:id", pathname);
  if (listingMatch?.params?.id) {
    const { data } = await supabase
      .from("listings")
      .select("title, city, price_per_night, max_dogs, cancellation_policy, amenities, description, host_id")
      .eq("id", listingMatch.params.id)
      .maybeSingle();
    if (data) {
      let host_name: string | undefined;
      if (data.host_id) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("user_id", data.host_id)
          .maybeSingle();
        host_name = prof?.full_name || undefined;
      }
      context.listing = { ...data, host_name };
    }
  }

  // Search the listings catalog based on the user's latest message
  if (latestUserMsg && latestUserMsg.length > 3) {
    try {
      const { hints, results } = await searchListings(latestUserMsg);
      if (results.length) {
        context.searchHints = hints;
        context.searchResults = results.map((r: any) => ({
          id: r.id,
          url: `/listing/${r.id}`,
          title: r.title,
          city: r.city,
          price_per_night: r.price_per_night,
          max_dogs: r.max_dogs,
          amenities: r.amenities,
          cancellation_policy: r.cancellation_policy,
          excerpt: r.description ? String(r.description).slice(0, 160) : undefined,
        }));
      }
    } catch {
      // ignore search failures
    }
  }

  // Logged-in user: include their recent bookings so the agent can reference them
  if (userId) {
    const { data: bookings } = await supabase
      .from("bookings")
      .select("id, check_in, check_out, number_of_dogs, total_price, status, listing_id, listings(title, cancellation_policy, profiles:host_id(full_name))")
      .eq("guest_id", userId)
      .order("created_at", { ascending: false })
      .limit(5);

    if (bookings && bookings.length) {
      context.bookings = bookings.map((b: any) => ({
        check_in: b.check_in,
        check_out: b.check_out,
        number_of_dogs: b.number_of_dogs,
        total_price: b.total_price,
        status: b.status,
        listing_title: b.listings?.title,
        cancellation_policy: b.listings?.cancellation_policy,
        host_name: b.listings?.profiles?.full_name,
      }));
    }
  }

  return context;
}

const SUGGESTIONS = [
  "Find a stay in Austin with a fenced yard",
  "I need a host for 2 dogs under $80/night",
  "How do I book a stay?",
];


const GuestAssistant = () => {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "assistant",
      content:
        "Hi! I'm Biscuit 🐾 — your PawBnB assistant. Ask me anything about a listing you're viewing, one of your bookings, or how the platform works.",
    },
  ]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, streaming]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100);
  }, [open]);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || streaming) return;
    const next: Msg[] = [...messages, { role: "user", content: trimmed }];
    setMessages([...next, { role: "assistant", content: "" }]);
    setInput("");
    setStreaming(true);

    try {
      const context = await buildContext(pathname, user?.id, trimmed).catch(() => ({ route: pathname }));
      const res = await fetch(`${SUPABASE_URL}/functions/v1/guest-assistant`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_KEY}`,
        },
        body: JSON.stringify({ messages: next, context }),
      });


      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({ error: "Something went wrong" }));
        toast.error(err.error || "Assistant unavailable");
        setMessages(next);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let acc = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          const trimmedLine = line.trim();
          if (!trimmedLine.startsWith("data:")) continue;
          const data = trimmedLine.slice(5).trim();
          if (data === "[DONE]") continue;
          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              acc += delta;
              setMessages((prev) => {
                const copy = [...prev];
                copy[copy.length - 1] = { role: "assistant", content: acc };
                return copy;
              });
            }
          } catch {
            // ignore parse errors
          }
        }
      }
    } catch (e) {
      toast.error("Couldn't reach the assistant. Please try again.");
      setMessages(next);
    } finally {
      setStreaming(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  };

  return (
    <>
      {/* Floating button */}
      <motion.button
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.4, type: "spring" }}
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-5 right-5 z-50 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:scale-105 transition"
        aria-label={open ? "Close assistant" : "Open assistant"}
      >
        {open ? <X className="w-6 h-6" /> : <MessageCircle className="w-6 h-6" />}
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-24 right-5 z-50 w-[min(380px,calc(100vw-2.5rem))] h-[min(560px,calc(100vh-8rem))] bg-card border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center gap-3 p-4 border-b border-border bg-gradient-to-r from-primary/10 to-accent/20">
              <div className="w-9 h-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0">
                <PawPrint className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3 className="font-serif font-bold text-foreground leading-tight">Ask Biscuit</h3>
                <p className="text-xs text-muted-foreground">Your PawBnB assistant</p>
              </div>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm break-words ${
                      m.role === "user"
                        ? "bg-primary text-primary-foreground rounded-br-md whitespace-pre-wrap"
                        : "bg-secondary text-secondary-foreground rounded-bl-md"
                    }`}
                  >
                    {m.content ? (
                      m.role === "assistant" ? (
                        <div className="prose prose-sm max-w-none prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-a:text-primary prose-a:underline">
                          <ReactMarkdown
                            components={{
                              a: ({ href = "", children }) =>
                                href.startsWith("/") ? (
                                  <Link to={href} onClick={() => setOpen(false)}>{children}</Link>
                                ) : (
                                  <a href={href} target="_blank" rel="noreferrer">{children}</a>
                                ),
                            }}
                          >
                            {m.content}
                          </ReactMarkdown>
                        </div>
                      ) : (
                        m.content
                      )
                    ) : streaming && i === messages.length - 1 ? (
                      <span className="inline-flex gap-1">
                        <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                        <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                        <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                      </span>
                    ) : null}
                  </div>
                </div>
              ))}

              {messages.length === 1 && !streaming && (
                <div className="pt-2 flex flex-wrap gap-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      className="text-xs px-3 py-1.5 rounded-full bg-muted hover:bg-muted/70 text-foreground transition"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Input */}
            <div className="p-3 border-t border-border bg-card">
              <div className="flex gap-2 items-end">
                <Textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKey}
                  placeholder="Ask about booking, cancellations..."
                  className="min-h-[40px] max-h-[120px] resize-none text-sm"
                  rows={1}
                  disabled={streaming}
                />
                <Button size="icon" onClick={() => send(input)} disabled={!input.trim() || streaming} className="shrink-0">
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default GuestAssistant;
