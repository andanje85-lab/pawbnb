import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: claims } = await userClient.auth.getClaims(
      authHeader.replace("Bearer ", "")
    );
    const senderId = claims?.claims?.sub as string | undefined;
    if (!senderId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { bookingId, recipientId, contentPreview } = await req.json();
    if (!bookingId || !recipientId) {
      return new Response(JSON.stringify({ error: "Missing bookingId/recipientId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Throttle: only send if this is a fresh unread burst (recipient has 1 unread — the just-sent message).
    const { count: unreadCount } = await admin
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("booking_id", bookingId)
      .eq("recipient_id", recipientId)
      .is("read_at", null);

    if ((unreadCount ?? 0) > 1) {
      return new Response(JSON.stringify({ skipped: "already_notified" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Recipient email
    const { data: recipUser } = await admin.auth.admin.getUserById(recipientId);
    const toEmail = recipUser?.user?.email;
    if (!toEmail) {
      return new Response(JSON.stringify({ error: "Recipient email not found" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Sender name + listing title
    const [{ data: senderProfile }, { data: booking }] = await Promise.all([
      admin.from("profiles").select("full_name").eq("user_id", senderId).maybeSingle(),
      admin
        .from("bookings")
        .select("id, listing_id, listings(title)")
        .eq("id", bookingId)
        .maybeSingle(),
    ]);

    const senderName = senderProfile?.full_name || "Someone";
    const listingTitle = (booking as any)?.listings?.title || "your booking";
    const origin =
      req.headers.get("origin") || Deno.env.get("PUBLIC_APP_URL") || "";
    const messagesUrl = origin ? `${origin}/messages?booking=${bookingId}` : "";

    const safePreview = (contentPreview || "")
      .toString()
      .slice(0, 240)
      .replace(/[<>&]/g, (c: string) =>
        c === "<" ? "&lt;" : c === ">" ? "&gt;" : "&amp;"
      );

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY is not configured");

    const emailHtml = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #1a1a1a; margin-bottom: 4px;">💬 New message from ${senderName}</h2>
        <p style="color: #666; margin-top: 4px;">About: <strong>${listingTitle}</strong></p>
        ${
          safePreview
            ? `<div style="background:#f8f5f0;border:1px solid #ecdfce;border-radius:12px;padding:16px;margin:20px 0;color:#333;white-space:pre-wrap;">${safePreview}</div>`
            : `<p style="color:#555;">You've received a new attachment.</p>`
        }
        ${
          messagesUrl
            ? `<p><a href="${messagesUrl}" style="display:inline-block;background:#c67c4e;color:#fff;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:600;">Open conversation</a></p>`
            : ""
        }
        <p style="color:#888;font-size:12px;margin-top:32px;">You're receiving this because you have an active booking conversation on PawBnB.</p>
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
        subject: `💬 New message from ${senderName}`,
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
    console.error("send-message-notification error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
