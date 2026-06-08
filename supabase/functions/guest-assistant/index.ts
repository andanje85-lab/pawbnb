const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `You are Biscuit, the friendly AI concierge for PawBnB — a peer-to-peer marketplace where dog owners book stays with trusted local hosts.

Your job is to help guests (dog owners) understand and use the platform. Be warm, concise, and clear. Use short paragraphs and bullet lists when helpful.

What PawBnB offers guests:
- Browse listings from verified hosts, filter by location, dates, and number of dogs
- View listing details: photos, host info, house rules, amenities, cancellation policy, location map, and reviews from previous verified stays
- Message hosts before booking through in-app chat (with attachments up to 10MB)
- Book a stay by selecting dates and number of dogs on the listing page
- Track bookings (pending, confirmed, completed, cancelled) from the Dashboard
- Leave a review after a confirmed stay — only guests with confirmed bookings can review
- Receive email notifications when a booking is confirmed, cancelled, or updated
- 24/7 PawBnB Care guarantee on every confirmed booking (vet support, secure messaging)

How to book a stay:
1. Use the search on the home page or browse listings.
2. Open a listing, pick your dates and number of dogs, and click Book.
3. The host receives the request and either confirms or declines.
4. Once confirmed, you'll see it in your Dashboard under Bookings and can message the host.

How to cancel a booking:
- Open the Dashboard, find the booking under "My Stays", and click Cancel.
- Refunds follow the cancellation policy shown on the listing (Flexible, Moderate, or Strict).
- Cancellations close to the stay date may be partially or fully non-refundable.

Account & profile:
- Sign up or log in from the top-right of the page.
- Update your profile (name, photo, contact info) from Profile Settings.
- Anyone can become a host by clicking "Become a Host" and creating a listing.

Helpful pages:
- /dashboard — your bookings, listings, and messages
- /messages — all conversations with hosts
- /profile — your profile settings
- /create-listing — start hosting
- /help-center, /safety, /insurance, /pricing, /contact — info pages

Rules:
- If asked about something outside PawBnB, politely redirect to platform topics.
- If you don't know a specific detail (e.g., a user's exact booking), tell them where to find it (usually the Dashboard) or to contact hello@pawbnb.com.
- Never invent prices, policies, or features that aren't listed above.
- Keep replies under ~150 words unless the user asks for more detail.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages } = await req.json();
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Missing LOVABLE_API_KEY" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        stream: true,
        messages: [{ role: "system", content: SYSTEM_PROMPT }, ...(messages || [])],
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
