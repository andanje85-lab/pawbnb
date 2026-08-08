CREATE TABLE public.booking_modifications (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  requested_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  original_check_in date NOT NULL,
  original_check_out date NOT NULL,
  original_total_price numeric NOT NULL,
  requested_check_in date NOT NULL,
  requested_check_out date NOT NULL,
  requested_total_price numeric NOT NULL,
  reason text,
  status text NOT NULL DEFAULT 'pending',
  host_response text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

GRANT SELECT, INSERT, UPDATE ON public.booking_modifications TO authenticated;
GRANT ALL ON public.booking_modifications TO service_role;

ALTER TABLE public.booking_modifications ENABLE ROW LEVEL SECURITY;

-- Guests can see requests for their own bookings
CREATE POLICY "Guests view own modification requests"
  ON public.booking_modifications FOR SELECT
  TO authenticated
  USING (
    requested_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.bookings b
      JOIN public.listings l ON l.id = b.listing_id
      WHERE b.id = booking_modifications.booking_id
        AND l.host_id = auth.uid()
    )
  );

-- Guests can create requests for their own bookings
CREATE POLICY "Guests create own modification requests"
  ON public.booking_modifications FOR INSERT
  TO authenticated
  WITH CHECK (requested_by = auth.uid());

-- Guests can cancel their own pending requests; hosts can approve/decline
CREATE POLICY "Guests and hosts update modification requests"
  ON public.booking_modifications FOR UPDATE
  TO authenticated
  USING (
    requested_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.bookings b
      JOIN public.listings l ON l.id = b.listing_id
      WHERE b.id = booking_modifications.booking_id
        AND l.host_id = auth.uid()
    )
  )
  WITH CHECK (
    requested_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.bookings b
      JOIN public.listings l ON l.id = b.listing_id
      WHERE b.id = booking_modifications.booking_id
        AND l.host_id = auth.uid()
    )
  );

-- updated_at trigger
CREATE TRIGGER update_booking_modifications_updated_at
  BEFORE UPDATE ON public.booking_modifications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Index for quick lookups by booking
CREATE INDEX idx_booking_modifications_booking ON public.booking_modifications(booking_id);
CREATE INDEX idx_booking_modifications_status ON public.booking_modifications(status);