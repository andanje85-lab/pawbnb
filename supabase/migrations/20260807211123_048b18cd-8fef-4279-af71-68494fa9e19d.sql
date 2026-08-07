CREATE TABLE public.listing_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  listing_id uuid NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('view', 'impression')),
  user_id uuid,
  session_id text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.listing_events TO authenticated;
GRANT INSERT ON public.listing_events TO anon;
GRANT ALL ON public.listing_events TO service_role;

ALTER TABLE public.listing_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can record listing events"
ON public.listing_events FOR INSERT TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Hosts can view events for their listings"
ON public.listing_events FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.listings l
  WHERE l.id = listing_events.listing_id AND l.host_id = auth.uid()
));

CREATE POLICY "Staff can view all listing events"
ON public.listing_events FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'worker'::app_role));

CREATE INDEX idx_listing_events_listing_created ON public.listing_events (listing_id, created_at DESC);
CREATE INDEX idx_listing_events_created ON public.listing_events (created_at DESC);