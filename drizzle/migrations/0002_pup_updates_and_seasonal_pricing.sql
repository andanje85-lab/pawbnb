ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS weekend_price numeric;

CREATE TABLE public.listing_seasonal_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Peak season',
  start_date date NOT NULL,
  end_date date NOT NULL,
  price_per_night numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.listing_seasonal_rates TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.listing_seasonal_rates TO authenticated;
GRANT ALL ON public.listing_seasonal_rates TO service_role;
ALTER TABLE public.listing_seasonal_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view seasonal rates" ON public.listing_seasonal_rates FOR SELECT USING (true);
CREATE POLICY "Hosts manage own seasonal rates" ON public.listing_seasonal_rates FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.listings l WHERE l.id = listing_id AND l.host_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.listings l WHERE l.id = listing_id AND l.host_id = auth.uid()));

CREATE TABLE public.pup_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  author_id uuid NOT NULL,
  content text NOT NULL DEFAULT '',
  photo_urls jsonb NOT NULL DEFAULT '[]'::jsonb,
  mood text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.pup_updates TO authenticated;
GRANT ALL ON public.pup_updates TO service_role;
ALTER TABLE public.pup_updates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Host and guest view pup updates" ON public.pup_updates FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.bookings b JOIN public.listings l ON l.id = b.listing_id
    WHERE b.id = booking_id AND (b.guest_id = auth.uid() OR l.host_id = auth.uid())));
CREATE POLICY "Host posts pup updates on confirmed bookings" ON public.pup_updates FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid() AND EXISTS (SELECT 1 FROM public.bookings b JOIN public.listings l ON l.id = b.listing_id
    WHERE b.id = booking_id AND l.host_id = auth.uid() AND b.status = 'confirmed'));
CREATE POLICY "Host deletes own pup updates" ON public.pup_updates FOR DELETE TO authenticated USING (author_id = auth.uid());
CREATE INDEX pup_updates_booking_idx ON public.pup_updates(booking_id, created_at DESC);