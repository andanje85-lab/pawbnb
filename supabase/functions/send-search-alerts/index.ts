import { reportError } from "../_shared/observability.ts";
import { matches, type SavedFilters } from "../_shared/searchMatch.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};


Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY is not configured");

    const { data: searches, error: sErr } = await admin
      .from("saved_searches")
      .select("*")
      .eq("email_alerts", true);
    if (sErr) throw sErr;

    let sent = 0;
    let skipped = 0;

    for (const s of searches || []) {
      const { data: newListings } = await admin
        .from("listings")
        .select("id, title, city, price_per_night, amenities, max_dogs, latitude, longitude, created_at")
        .eq("is_active", true)
        .gt("created_at", s.last_notified_at);

      const matched = (newListings || []).filter((l) => matches(l, s.filters as SavedFilters));

      if (matched.length === 0) {
        skipped++;
        continue;
      }

      const { data: userInfo } = await admin.auth.admin.getUserById(s.user_id);
      const toEmail = userInfo?.user?.email;
      if (!toEmail) {
        skipped++;
        continue;
      }

      const rows = matched
        .slice(0, 10)
        .map(
          (l) => `
          <div style="border:1px solid #eee;border-radius:12px;padding:12px 14px;margin-bottom:10px;">
            <div style="font-weight:600;color:#1a1a1a;">${l.title}</div>
            <div style="color:#666;font-size:13px;">${l.city || ""} · $${l.price_per_night}/night · up to ${l.max_dogs} dogs</div>
          </div>`
        )
        .join("");

      const html = `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;">
          <h2 style="color:#1a1a1a;">🐾 ${matched.length} new stay${matched.length > 1 ? "s" : ""} match "${s.name}"</h2>
          <p style="color:#444;">Here are the newest listings matching your saved search:</p>
          ${rows}
          <p style="margin-top:20px;">
            <a href="#" style="display:inline-block;background:#c67c4e;color:#fff;padding:12px 22px;border-radius:10px;text-decoration:none;font-weight:600;">Browse all matches</a>
          </p>
          <p style="color:#999;font-size:12px;margin-top:20px;">You can pause or delete this alert from your PawBnB dashboard.</p>
        </div>`;

      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: "PawBnB <onboarding@resend.dev>",
          to: [toEmail],
          subject: `🐾 ${matched.length} new match${matched.length > 1 ? "es" : ""} for "${s.name}"`,
          html,
        }),
      });

      if (!res.ok) {
        console.error("Resend failed for saved_search", s.id, await res.text());
        skipped++;
        continue;
      }

      await admin
        .from("saved_searches")
        .update({ last_notified_at: new Date().toISOString() })
        .eq("id", s.id);

      sent++;
    }

    return new Response(JSON.stringify({ success: true, sent, skipped }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    await reportError("send-search-alerts", error, { method: req.method, url: req.url });
    console.error("send-search-alerts error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
