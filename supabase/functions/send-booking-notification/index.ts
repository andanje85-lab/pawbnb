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

    // Admin client to look up guest emails
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
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
    const {
      type, // "new_booking" | "booking_submitted" | "booking_confirmed" | "booking_declined"
      bookingId,
      guestId,
      listingTitle,
      listingCity,
      checkIn,
      checkOut,
      numDogs,
      totalPrice,
      guestEmail: guestEmailFromClient,
      guestName,
      message,
    } = body;

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY is not configured");
    }

    // Resolve guest email: prefer value from client, else look up via admin
    let guestEmail = guestEmailFromClient;
    if (!guestEmail && guestId) {
      const { data: userData } = await supabaseAdmin.auth.admin.getUserById(guestId);
      guestEmail = userData?.user?.email || "";
    }

    const adminEmail = "andanje85@gmail.com";


    let emailHtml = "";
    let subject = "";
    let toEmail = "";

    if (type === "booking_confirmed") {
      // Email to guest — booking confirmed
      toEmail = guestEmail;
      subject = `✅ Your booking at ${listingTitle} is confirmed!`;
      emailHtml = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #1a1a1a; margin-bottom: 4px;">🐾 Booking Confirmed!</h2>
          <p style="color: #444; margin-top: 4px;">Great news, ${guestName || "there"}! Your booking has been confirmed by the host.</p>

          <div style="background: #f0fff4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 20px; margin: 24px 0;">
            <h3 style="color: #166534; margin: 0 0 16px 0;">✅ Booking Details</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr><td style="padding: 6px 0; color: #555; width: 140px;"><strong>Listing</strong></td><td style="padding: 6px 0; color: #1a1a1a;">${listingTitle}${listingCity ? ` — ${listingCity}` : ""}</td></tr>
              <tr><td style="padding: 6px 0; color: #555;"><strong>Check-in</strong></td><td style="padding: 6px 0; color: #1a1a1a;">${checkIn}</td></tr>
              <tr><td style="padding: 6px 0; color: #555;"><strong>Check-out</strong></td><td style="padding: 6px 0; color: #1a1a1a;">${checkOut}</td></tr>
              <tr><td style="padding: 6px 0; color: #555;"><strong>Dogs</strong></td><td style="padding: 6px 0; color: #1a1a1a;">${numDogs}</td></tr>
              <tr><td style="padding: 6px 0; color: #555;"><strong>Total</strong></td><td style="padding: 6px 0; color: #1a1a1a; font-weight: bold;">$${totalPrice}</td></tr>
            </table>
          </div>

          <p style="color: #444;">We hope your pup has a wonderful stay! 🐕</p>
          <p style="color: #888; font-size: 13px; margin-top: 32px;">Booking ID: ${bookingId}</p>
        </div>
      `;
    } else if (type === "booking_declined") {
      // Email to guest — booking declined
      toEmail = guestEmail;
      subject = `❌ Your booking request for ${listingTitle} was declined`;
      emailHtml = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #1a1a1a; margin-bottom: 4px;">Booking Request Update</h2>
          <p style="color: #444; margin-top: 4px;">Hi ${guestName || "there"}, unfortunately the host was unable to accommodate your booking request at this time.</p>

          <div style="background: #fff5f5; border: 1px solid #fecaca; border-radius: 12px; padding: 20px; margin: 24px 0;">
            <h3 style="color: #991b1b; margin: 0 0 16px 0;">❌ Booking Details</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr><td style="padding: 6px 0; color: #555; width: 140px;"><strong>Listing</strong></td><td style="padding: 6px 0; color: #1a1a1a;">${listingTitle}${listingCity ? ` — ${listingCity}` : ""}</td></tr>
              <tr><td style="padding: 6px 0; color: #555;"><strong>Check-in</strong></td><td style="padding: 6px 0; color: #1a1a1a;">${checkIn}</td></tr>
              <tr><td style="padding: 6px 0; color: #555;"><strong>Check-out</strong></td><td style="padding: 6px 0; color: #1a1a1a;">${checkOut}</td></tr>
              <tr><td style="padding: 6px 0; color: #555;"><strong>Dogs</strong></td><td style="padding: 6px 0; color: #1a1a1a;">${numDogs}</td></tr>
            </table>
          </div>

          <p style="color: #444;">Don't be discouraged — there are plenty of other great hosts available. We hope to find the perfect match for your pup soon! 🐕</p>
          <p style="color: #888; font-size: 13px; margin-top: 32px;">Booking ID: ${bookingId}</p>
        </div>
      `;
    } else {
      // Default: new booking notification to admin
      toEmail = adminEmail;
      subject = `🐾 New Booking: ${listingTitle}`;
      emailHtml = `
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
    }

    if (!toEmail) {
      return new Response(JSON.stringify({ error: "No recipient email provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "PawStay <onboarding@resend.dev>",
        to: [toEmail],
        subject,
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
