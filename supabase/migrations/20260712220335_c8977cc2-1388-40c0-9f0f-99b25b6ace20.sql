
CREATE TABLE public.listing_blocked_dates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  blocked_date date NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(listing_id, blocked_date)
);

GRANT SELECT ON public.listing_blocked_dates TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.listing_blocked_dates TO authenticated;
GRANT ALL ON public.listing_blocked_dates TO service_role;

ALTER TABLE public.listing_blocked_dates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view blocked dates"
  ON public.listing_blocked_dates FOR SELECT
  USING (true);

CREATE POLICY "Hosts manage their own blocked dates"
  ON public.listing_blocked_dates FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.listings l WHERE l.id = listing_id AND l.host_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.listings l WHERE l.id = listing_id AND l.host_id = auth.uid()));

CREATE INDEX idx_blocked_dates_listing ON public.listing_blocked_dates(listing_id, blocked_date);
