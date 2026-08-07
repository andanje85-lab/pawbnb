import { supabase } from "@/integrations/supabase/client";

const SESSION_KEY = "pawbnb_session_id";

/** Stable-per-browser anonymous session id used to de-duplicate analytics events. */
export function getSessionId(): string {
  try {
    let id = localStorage.getItem(SESSION_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return "anonymous";
  }
}

// In-memory guard so a single page session doesn't spam duplicate rows
// (e.g. re-renders, scrolling a list in and out of view).
const seen = new Set<string>();

export type ListingEventType = "view" | "impression";

/**
 * Records a listing view (detail page) or impression (appeared in results).
 * Fire-and-forget: analytics must never break the UI.
 */
export async function trackListingEvent(listingId: string, eventType: ListingEventType) {
  if (!listingId) return;
  const key = `${eventType}:${listingId}`;
  if (seen.has(key)) return;
  seen.add(key);

  try {
    const { data } = await supabase.auth.getSession();
    await supabase.from("listing_events").insert({
      listing_id: listingId,
      event_type: eventType,
      user_id: data.session?.user?.id ?? null,
      session_id: getSessionId(),
    });
  } catch {
    // ignore analytics failures
  }
}
