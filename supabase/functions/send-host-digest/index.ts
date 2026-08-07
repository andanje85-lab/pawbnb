import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Weekly host digest: views, impressions, new requests, upcoming stays and earnings
// for the past 7 days. Idempotent per ISO week via `notifications` (type='host_digest').
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY is not configured");

    const now = new Date();
    const since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const weekRef = `${now.getUTCFullYear()}-W${String(
      Math.ceil(((now.getTime() - Date.UTC(now.getUTCFullYear(), 0, 1)) / 86400000 + 1) / 7)
    ).padStart(2, "0")}`;

    const { data: listings, error: lErr } = await admin
      .from("listings")
      .select("id, title, host_id, is_active");
    if (lErr) throw lErr;

    const byHost = new Map<string, { id: string; title: string }[]>();
    for (const l of listings || []) {
      if (!l.is_active) continue;
      const arr = byHost.get(l.host_id) ?? [];
      arr.push({ id: l.id, title: l.title });
      byHost.set(l.host_id, arr);
    }

    let sent = 0;
    let skipped = 0;

    for (const [hostId, hostListings] of byHost) {
      // Idempotency: one digest per host per ISO week
      const { data: existing } = await admin
        .from("notifications")
        .select("id")
        .eq("user_id", hostId)
        .eq("type", "host_digest")
        .eq("reference_id", weekRef)
        .maybeSingle();
      if (existing) {
        skipped++;
        continue;
      }

      const ids = hostListings.map((l) => l.id);

      const [{ data: events }, { data: bookings }] = await Promise.all([
        admin
          .from("listing_events")
          .select("event_type")
          .in("listing_id", ids)
          .gte("created_at", since.toISOString()),
        admin
          .from("bookings")
          .select("id, status, total_price, check_in, created_at")
          .in("listing_id", ids),
      ]);

      const impressions = (events || []).filter((e) => e.event_type === "impression").length;
      const views = (events || []).filter((e) => e.event_type === "view").length;

      const weekBookings = (bookings || []).filter((b) => new Date(b.created_at) >= since);
      const newRequests = weekBookings.length;
      const confirmedThisWeek = weekBookings.filter((b) => b.status === "confirmed");
      const weekEarnings = confirmedThisWeek.reduce((s, b) => s + Number(b.total_price), 0);
      const upcoming = (bookings || []).filter(
        (b) => b.status === "confirmed" && new Date(b.check_in) >= now
      ).length;
      const pending = (bookings || []).filter((b) => b.status === "pending").length;

      // Nothing happened at all — skip the email rather than send an empty digest
      if (impressions + views + newRequests + upcoming + pending === 0) {
        skipped++;
        continue;
      }

      const { data: hostUser } = await admin.auth.admin.getUserById(hostId);
      const toEmail = hostUser?.user?.email;
      if (!toEmail) {
        skipped++;
        continue;
      }

      const { data: profile } = await admin
        .from("profiles")
        .select("full_name")
        .eq("user_id", hostId)
        .maybeSingle();
      const firstName = profile?.full_name?.split(" ")[0] || "there";

      const row = (label: string, value: string) => `
        <tr>
          <td style="padding:8px 0;color:#555;font-size:14px;">${label}</td>
          <td style="padding:8px 0;text-align:right;font-weight:600;color:#1a1a1a;font-size:14px;">${value}</td>
        </tr>`;

      const emailHtml = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
          <h2 style="color:#1a1a1a;">🐾 Your weekly PawBnB summary</h2>
          <p style="color:#444;">Hi ${firstName}, here's how your ${hostListings.length} listing${
        hostListings.length === 1 ? "" : "s"
      } performed over the last 7 days.</p>
          <table style="width:100%;border-collapse:collapse;margin:16px 0;">
            ${row("Search impressions", String(impressions))}
            ${row("Listing views", String(views))}
            ${row("View rate", impressions > 0 ? `${((views / impressions) * 100).toFixed(1)}%` : "—")}
            ${row("New booking requests", String(newRequests))}
            ${row("Confirmed this week", String(confirmedThisWeek.length))}
            ${row("Earnings from new bookings", `$${weekEarnings.toFixed(0)}`)}
            ${row("Awaiting your response", String(pending))}
            ${row("Upcoming stays", String(upcoming))}
          </table>
          ${
            pending > 0
              ? `<p style="color:#b45309;font-size:14px;">You have ${pending} request${
                  pending === 1 ? "" : "s"
                } waiting — replying quickly boosts your response rate.</p>`
              : ""
          }
          <p style="color:#888;font-size:12px;margin-top:32px;">See full details under Analytics in your PawBnB dashboard.</p>
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
          subject: `🐾 Your weekly summary: ${views} views, ${newRequests} new request${
            newRequests === 1 ? "" : "s"
          }`,
          html: emailHtml,
        }),
      });

      if (!res.ok) {
        console.error("Resend failed for host", hostId, await res.text());
        skipped++;
        continue;
      }

      await admin.from("notifications").insert({
        user_id: hostId,
        type: "host_digest",
        reference_id: weekRef,
        title: "Your weekly hosting summary",
        body: `${views} views · ${newRequests} new request${newRequests === 1 ? "" : "s"} · ${pending} awaiting reply`,
      });
      sent++;
    }

    return new Response(JSON.stringify({ success: true, sent, skipped }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("send-host-digest error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
