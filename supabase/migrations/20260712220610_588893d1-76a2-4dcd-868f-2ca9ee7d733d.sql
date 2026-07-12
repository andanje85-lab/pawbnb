
DROP POLICY IF EXISTS "Anyone can view blocked dates" ON public.listing_blocked_dates;

CREATE POLICY "Hosts view their own blocked dates"
  ON public.listing_blocked_dates FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.listings l
      WHERE l.id = listing_id AND l.host_id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'worker'::app_role)
  );

REVOKE SELECT ON public.listing_blocked_dates FROM anon;
