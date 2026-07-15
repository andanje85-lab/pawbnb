import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Sends review reminder emails to guests whose stays completed 1-7 days ago
// and who haven't reviewed yet. Idempotent via `notifications` (type='review_reminder').
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY is not configured");

    // Confirmed bookings where check_out was 1-7 days ago
    const now = new Date();
    const upper = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const lower = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const { data: bookings, error: bErr } = await admin
      .from("bookings")
      .select("id, guest_id, listing_id, check_out, listings(title, host_id)")
      .eq("status", "confirmed")
      .gte("check_out", lower)
      .lte("check_out", upper);
    if (bErr) throw bErr;

    let sent = 0;
    let skipped = 0;

    for (const b of bookings || []) {
      // Skip if already reviewed
      const { data: existingReview } = await admin
        .from("reviews")
        .select("id")
        .eq("booking_id", b.id)
        .eq("reviewer_id", b.guest_id)
        .maybeSingle();
      if (existingReview) {
        skipped++;
        continue;
      }

      // Skip if reminder already sent
      const { data: existingNotif } = await admin
        .from("notifications")
        .select("id")
        .eq("user_id", b.guest_id)
        .eq("type", "review_reminder")
        .eq("reference_id", b.id)
        .maybeSingle();
      if (existingNotif) {
        skipped++;
        continue;
      }

      const { data: guestUser } = await admin.auth.admin.getUserById(b.guest_id);
      const toEmail = guestUser?.user?.email;
      if (!toEmail) {
        skipped++;
        continue;
      }

      const { data: guestProfile } = await admin
        .from("profiles")
        .select("full_name")
        .eq("user_id", b.guest_id)
        .maybeSingle();
      const guestName = guestProfile?.full_name?.split(" ")[0] || "there";
      const listingTitle = (b as any).listings?.title || "your recent stay";

      const emailHtml = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #1a1a1a;">🐕 How was your stay at ${listingTitle}?</h2>
          <p style="color: #444;">Hi ${guestName}, we hope your pup had a wonderful time! Would you take a moment to share how it went?</p>
          <p style="color: #444;">Your review helps the community find great hosts and helps hosts improve.</p>
          <p style="margin: 24px 0;">
            <a href="#" style="display:inline-block;background:#c67c4e;color:#fff;padding:12px 22px;border-radius:10px;text-decoration:none;font-weight:600;">Leave a review</a>
          </p>
          <p style="color:#888;font-size:12px;margin-top:32px;">You can leave a review from your PawBnB dashboard under "Trips".</p>
        </div>
      `;

      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: "PawBnB <onboarding@resend.dev>",
          to: [toEmail],
          subject: `🐾 How was your stay at ${listingTitle}?`,
          html: emailHtml,
        }),
      });

      if (!res.ok) {
        console.error("Resend failed for booking", b.id, await res.text());
        skipped++;
        continue;
      }

      await admin.from("notifications").insert({
        user_id: b.guest_id,
        type: "review_reminder",
        reference_id: b.id,
        title: `How was your stay at ${listingTitle}?`,
        body: "Share your experience to help other pet parents.",
      });
      sent++;
    }

    return new Response(JSON.stringify({ success: true, sent, skipped }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("send-review-reminders error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
