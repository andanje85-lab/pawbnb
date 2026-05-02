-- Function to expose exact address only when caller is allowed:
-- - the host of the listing
-- - admin or worker staff
-- - a guest with a confirmed booking on the listing
CREATE OR REPLACE FUNCTION public.get_listing_address(_listing_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT l.address
  FROM public.listings l
  WHERE l.id = _listing_id
    AND (
      l.host_id = auth.uid()
      OR public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'worker'::app_role)
      OR EXISTS (
        SELECT 1 FROM public.bookings b
        WHERE b.listing_id = l.id
          AND b.guest_id = auth.uid()
          AND b.status = 'confirmed'
      )
    )
$$;

GRANT EXECUTE ON FUNCTION public.get_listing_address(uuid) TO anon, authenticated;

-- Helper: returns true if current user can see exact location for a listing
CREATE OR REPLACE FUNCTION public.can_view_exact_location(_listing_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.listings l
    WHERE l.id = _listing_id
      AND (
        l.host_id = auth.uid()
        OR public.has_role(auth.uid(), 'admin'::app_role)
        OR public.has_role(auth.uid(), 'worker'::app_role)
        OR EXISTS (
          SELECT 1 FROM public.bookings b
          WHERE b.listing_id = l.id
            AND b.guest_id = auth.uid()
            AND b.status = 'confirmed'
        )
      )
  )
$$;

GRANT EXECUTE ON FUNCTION public.can_view_exact_location(uuid) TO anon, authenticated;

-- Revoke direct address column access from public roles via column-level privileges.
-- Public SELECT on listings stays, but address column is restricted.
REVOKE SELECT (address) ON public.listings FROM anon, authenticated;
GRANT SELECT (address) ON public.listings TO service_role;