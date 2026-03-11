import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } =
      await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    const body = await req.json();
    const { bookingId, listingTitle, listingCity, checkIn, checkOut, numDogs, totalPrice, guestEmail, guestName, message } = body;

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY is not configured");
    }

    const adminEmail = "andanje85@gmail.com";

    const emailHtml = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #1a1a1a; margin-bottom: 4px;">🐾 New Booking Request</h2>
        <p style="color: #666; margin-top: 0;">A new booking has just been submitted on PawStay.</p>
        
        <div style="background: #f9f9f9; border-radius: 12px; padding: 20px; margin: 24px 0;">
          <h3 style="color: #1a1a1a; margin: 0 0 16px 0;">Booking Details</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="padding: 6px 0; color: #555; width: 140px;"><strong>Listing</strong></td><td style="padding: 6px 0; color: #1a1a1a;">${listingTitle}${listingCity ? ` — ${listingCity}` : ""}</td></tr>
            <tr><td style="padding: 6px 0; color: #555;"><strong>Check-in</strong></td><td style="padding: 6px 0; color: #1a1a1a;">${checkIn}</td></tr>
            <tr><td style="padding: 6px 0; color: #555;"><strong>Check-out</strong></td><td style="padding: 6px 0; color: #1a1a1a;">${checkOut}</td></tr>
            <tr><td style="padding: 6px 0; color: #555;"><strong>Dogs</strong></td><td style="padding: 6px 0; color: #1a1a1a;">${numDogs}</td></tr>
            <tr><td style="padding: 6px 0; color: #555;"><strong>Total Price</strong></td><td style="padding: 6px 0; color: #1a1a1a; font-weight: bold;">$${totalPrice}</td></tr>
          </table>
        </div>

        <div style="background: #f0f7ff; border-radius: 12px; padding: 20px; margin: 24px 0;">
          <h3 style="color: #1a1a1a; margin: 0 0 16px 0;">Guest Info</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="padding: 6px 0; color: #555; width: 140px;"><strong>Name</strong></td><td style="padding: 6px 0; color: #1a1a1a;">${guestName || "Unknown"}</td></tr>
            <tr><td style="padding: 6px 0; color: #555;"><strong>Email</strong></td><td style="padding: 6px 0; color: #1a1a1a;">${guestEmail || "N/A"}</td></tr>
            ${message ? `<tr><td style="padding: 6px 0; color: #555; vertical-align: top;"><strong>Message</strong></td><td style="padding: 6px 0; color: #1a1a1a;">${message}</td></tr>` : ""}
          </table>
        </div>

        <p style="color: #888; font-size: 13px; margin-top: 32px;">Booking ID: ${bookingId}</p>
      </div>
    `;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "PawStay <onboarding@resend.dev>",
        to: [adminEmail],
        subject: `🐾 New Booking: ${listingTitle}`,
        html: emailHtml,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Resend error: ${err}`);
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("send-booking-notification error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
