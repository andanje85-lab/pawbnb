import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { reportError } from "../_shared/observability.ts";
import { buildIcal, expandNights, groupRanges, parseIcal } from "../_shared/ical.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const admin = () =>
  createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

/**
 * GET  ?token=<export_token>   → public .ics feed of a listing's unavailable nights
 * POST { listing_id }          → import the host's external .ics into blocked dates
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const db = admin();

    if (req.method === "GET") {
      const token = new URL(req.url).searchParams.get("token")?.trim();
      if (!token || token.length < 16) return json({ error: "Invalid token" }, 400);

      const { data: sync, error } = await db
        .from("listing_calendar_sync")
        .select("listing_id")
        .eq("export_token", token)
        .maybeSingle();
      if (error) throw error;
      if (!sync) return json({ error: "Calendar not found" }, 404);

      const listingId = sync.listing_id as string;

      const [{ data: listing }, { data: blocked }, { data: bookings }] = await Promise.all([
        db.from("listings").select("title").eq("id", listingId).maybeSingle(),
        db.from("listing_blocked_dates").select("blocked_date").eq("listing_id", listingId),
        db
          .from("bookings")
          .select("id, check_in, check_out, status")
          .eq("listing_id", listingId)
          .in("status", ["pending", "confirmed"]),
      ]);

      const events = groupRanges((blocked ?? []).map((b) => b.blocked_date as string)).map((r) => ({
        uid: `block-${listingId}-${r.start}@pawbnb`,
        start: r.start,
        end: r.end,
        summary: "Unavailable",
      }));

      for (const b of bookings ?? []) {
        events.push({
          uid: `booking-${b.id}@pawbnb`,
          start: b.check_in as string,
          end: b.check_out as string,
          summary: b.status === "confirmed" ? "Booked stay" : "Pending request",
        });
      }

      const ics = buildIcal(`${listing?.title ?? "Listing"} — availability`, events);
      return new Response(ics, {
        headers: {
          ...corsHeaders,
          "Content-Type": "text/calendar; charset=utf-8",
          "Cache-Control": "public, max-age=900",
          "Content-Disposition": 'attachment; filename="pawbnb-availability.ics"',
        },
      });
    }

    if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

    // --- Import: requires the signed-in host who owns the listing ---
    const authHeader = req.headers.get("Authorization") ?? "";
    const jwt = authHeader.replace(/^Bearer\s+/i, "");
    if (!jwt) return json({ error: "Not authenticated" }, 401);

    const { data: userData, error: userErr } = await db.auth.getUser(jwt);
    if (userErr || !userData?.user) return json({ error: "Not authenticated" }, 401);
    const userId = userData.user.id;

    const body = await req.json().catch(() => ({}));
    const listingId = typeof body?.listing_id === "string" ? body.listing_id : "";
    if (!/^[0-9a-f-]{36}$/i.test(listingId)) return json({ error: "listing_id is required" }, 400);

    const { data: listing, error: lErr } = await db
      .from("listings")
      .select("id, host_id")
      .eq("id", listingId)
      .maybeSingle();
    if (lErr) throw lErr;
    if (!listing || listing.host_id !== userId) return json({ error: "Listing not found" }, 403);

    const { data: sync, error: sErr } = await db
      .from("listing_calendar_sync")
      .select("import_url")
      .eq("listing_id", listingId)
      .maybeSingle();
    if (sErr) throw sErr;

    const importUrl = (sync?.import_url ?? "").trim();
    if (!importUrl) return json({ error: "No calendar link saved for this listing" }, 400);

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(importUrl.replace(/^webcal:/i, "https:"));
    } catch {
      return json({ error: "That calendar link is not a valid URL" }, 400);
    }
    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      return json({ error: "Calendar link must start with http(s) or webcal" }, 400);
    }

    let ics = "";
    try {
      const res = await fetch(parsedUrl.toString(), { headers: { Accept: "text/calendar,*/*" } });
      if (!res.ok) {
        const detail = (await res.text()).slice(0, 300);
        await db
          .from("listing_calendar_sync")
          .update({ last_synced_at: new Date().toISOString(), last_sync_status: `error: ${res.status}` })
          .eq("listing_id", listingId);
        return json({ error: `Calendar link returned ${res.status}`, details: detail }, 502);
      }
      ics = await res.text();
    } catch (e) {
      await db
        .from("listing_calendar_sync")
        .update({ last_synced_at: new Date().toISOString(), last_sync_status: "error: unreachable" })
        .eq("listing_id", listingId);
      return json({ error: "Could not reach that calendar link" }, 502);
    }

    const events = parseIcal(ics);
    const today = new Date().toISOString().slice(0, 10);
    const nights = new Map<string, string>(); // date -> external uid
    for (const ev of events) {
      for (const night of expandNights(ev)) {
        if (night >= today) nights.set(night, ev.uid);
      }
    }

    // Replace previously imported dates so removals upstream are reflected too.
    const { error: delErr } = await db
      .from("listing_blocked_dates")
      .delete()
      .eq("listing_id", listingId)
      .eq("source", "ical");
    if (delErr) throw delErr;

    const { data: existing } = await db
      .from("listing_blocked_dates")
      .select("blocked_date")
      .eq("listing_id", listingId);
    const already = new Set((existing ?? []).map((r) => r.blocked_date as string));

    const rows = [...nights.entries()]
      .filter(([date]) => !already.has(date))
      .map(([date, uid]) => ({
        listing_id: listingId,
        blocked_date: date,
        source: "ical",
        external_uid: uid,
        reason: "Imported from external calendar",
      }));

    if (rows.length) {
      const { error: insErr } = await db.from("listing_blocked_dates").insert(rows);
      if (insErr) throw insErr;
    }

    await db
      .from("listing_calendar_sync")
      .update({
        last_synced_at: new Date().toISOString(),
        last_sync_status: "ok",
        imported_count: rows.length,
      })
      .eq("listing_id", listingId);

    return json({ imported: rows.length, events: events.length });
  } catch (error) {
    await reportError("calendar-sync", error, { url: req.url });
    return json({ error: error instanceof Error ? error.message : "Unexpected error" }, 500);
  }
});
