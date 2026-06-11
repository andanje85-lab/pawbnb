const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BASE_PROMPT = `You are Biscuit, the friendly AI concierge for PawBnB — a peer-to-peer marketplace where dog owners book stays with trusted local hosts.

Your job is to help guests (dog owners) understand and use the platform. Be warm, concise, and clear. Use short paragraphs and bullet lists when helpful. Keep replies under ~150 words unless asked for more detail.

What PawBnB offers guests:
- Browse listings from verified hosts, filter by location, dates, and number of dogs
- View listing details: photos, host info, house rules, amenities, cancellation policy, location map, and verified reviews
- Message hosts before booking through in-app chat
- Book a stay by selecting dates and number of dogs on the listing page
- Track bookings (pending, confirmed, completed, cancelled) from the Dashboard
- Leave a review after a confirmed stay
- 24/7 PawBnB Care guarantee on every confirmed booking

How to book a stay:
1. Open a listing, pick your dates and number of dogs, click Book.
2. The host receives the request and confirms or declines.
3. Once confirmed, the booking appears in your Dashboard and you can message the host.

How to cancel a booking:
- Open the Dashboard, find the booking under My Bookings, click Cancel.
- Refunds follow the cancellation policy on the listing (Flexible, Moderate, Strict).
- Cancellations close to the stay date may be partially or fully non-refundable.

Rules:
- If you don't know a specific detail, point users to the Dashboard or hello@pawbnb.com.
- Never invent prices, policies, or features.
- When the user has a CURRENT LISTING or CURRENT BOOKING context below, reference it specifically (use the title, dates, price, host, and cancellation policy from that context). Do not ask them to repeat info you already have.
- When SEARCH RESULTS are provided below, the user is looking for a listing. Recommend the top 1–3 best matches by name, briefly explain WHY each fits (location, price, amenities, max dogs), and include the listing link as a markdown link like [Title](/listing/<id>). If results don't fully match, say so and suggest filters to adjust (city, dates, amenities). Never invent listings that aren't in the SEARCH RESULTS.`;

function buildContextBlock(context: any): string {
  if (!context) return "";
  const lines: string[] = [];

  if (context.listing) {
    const l = context.listing;
    lines.push("CURRENT LISTING the user is viewing:");
    if (l.title) lines.push(`- Title: ${l.title}`);
    if (l.city) lines.push(`- Location: ${l.city}`);
    if (l.host_name) lines.push(`- Host: ${l.host_name}`);
    if (l.price_per_night != null) lines.push(`- Price: $${l.price_per_night}/night`);
    if (l.max_dogs != null) lines.push(`- Max dogs: ${l.max_dogs}`);
    if (l.cancellation_policy) lines.push(`- Cancellation policy: ${l.cancellation_policy}`);
    if (Array.isArray(l.amenities) && l.amenities.length) lines.push(`- Amenities: ${l.amenities.join(", ")}`);
    if (l.description) lines.push(`- Description: ${String(l.description).slice(0, 400)}`);
    lines.push("");
  }

  if (Array.isArray(context.bookings) && context.bookings.length) {
    lines.push("CURRENT USER'S BOOKINGS (most recent first):");
    context.bookings.slice(0, 5).forEach((b: any, i: number) => {
      lines.push(
        `${i + 1}. ${b.listing_title || "Stay"} — ${b.check_in} → ${b.check_out}, ${b.number_of_dogs} dog(s), $${b.total_price} total, status: ${b.status}${b.cancellation_policy ? `, cancellation: ${b.cancellation_policy}` : ""}`
      );
    });
    lines.push("");
  }

  if (context.selectedBooking) {
    const b = context.selectedBooking;
    lines.push("SELECTED BOOKING the user is asking about:");
    if (b.listing_title) lines.push(`- Listing: ${b.listing_title}`);
    if (b.host_name) lines.push(`- Host: ${b.host_name}`);
    lines.push(`- Dates: ${b.check_in} → ${b.check_out}`);
    if (b.number_of_dogs != null) lines.push(`- Dogs: ${b.number_of_dogs}`);
    if (b.total_price != null) lines.push(`- Total: $${b.total_price}`);
    if (b.status) lines.push(`- Status: ${b.status}`);
    if (b.cancellation_policy) lines.push(`- Cancellation policy: ${b.cancellation_policy}`);
    lines.push("");
  }

  if (Array.isArray(context.searchResults) && context.searchResults.length) {
    if (context.searchHints) {
      const h = context.searchHints;
      const parts: string[] = [];
      if (h.city) parts.push(`city~"${h.city}"`);
      if (h.maxPrice) parts.push(`max price $${h.maxPrice}`);
      if (h.dogs) parts.push(`${h.dogs}+ dogs`);
      if (Array.isArray(h.amenities) && h.amenities.length) parts.push(`amenities: ${h.amenities.join(", ")}`);
      if (parts.length) lines.push(`SEARCH HINTS detected from user message: ${parts.join("; ")}`);
    }
    lines.push("SEARCH RESULTS (active listings that may match the user's request):");
    context.searchResults.forEach((r: any, i: number) => {
      const amen = Array.isArray(r.amenities) && r.amenities.length ? `, amenities: ${r.amenities.join(", ")}` : "";
      lines.push(
        `${i + 1}. ${r.title} — ${r.city || "?"}, $${r.price_per_night}/night, up to ${r.max_dogs} dog(s)${amen}. Link: ${r.url}${r.excerpt ? `\n   "${r.excerpt}"` : ""}`
      );
    });
    lines.push("");
  }

  if (context.route) lines.push(`(User is currently on page: ${context.route})`);

  return lines.length ? `\n\n---\n${lines.join("\n")}` : "";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, context } = await req.json();
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Missing LOVABLE_API_KEY" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = BASE_PROMPT + buildContextBlock(context);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        stream: true,
        messages: [{ role: "system", content: systemPrompt }, ...(messages || [])],
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit reached. Please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please contact support." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: text || "AI gateway error" }), {
        status: response.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
