-- Track origin of blocked dates so iCal imports don't clobber manual blocks
ALTER TABLE public.listing_blocked_dates
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'host',
  ADD COLUMN IF NOT EXISTS external_uid text;

CREATE UNIQUE INDEX IF NOT EXISTS listing_blocked_dates_unique
  ON public.listing_blocked_dates (listing_id, blocked_date);

-- Calendar sync settings per listing
CREATE TABLE IF NOT EXISTS public.listing_calendar_sync (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL UNIQUE REFERENCES public.listings(id) ON DELETE CASCADE,
  import_url text,
  export_token text NOT NULL DEFAULT replace(gen_random_uuid()::text, '-', ''),
  last_synced_at timestamptz,
  last_sync_status text,
  imported_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS listing_calendar_sync_token_idx
  ON public.listing_calendar_sync (export_token);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.listing_calendar_sync TO authenticated;
GRANT ALL ON public.listing_calendar_sync TO service_role;
ALTER TABLE public.listing_calendar_sync ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Hosts manage their listing calendar sync"
ON public.listing_calendar_sync FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.listings l WHERE l.id = listing_id AND l.host_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.listings l WHERE l.id = listing_id AND l.host_id = auth.uid()));

CREATE POLICY "Staff can view calendar sync"
ON public.listing_calendar_sync FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'worker'::app_role));

CREATE TRIGGER listing_calendar_sync_updated_at
BEFORE UPDATE ON public.listing_calendar_sync
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Payout methods (owner-only visibility)
CREATE TABLE IF NOT EXISTS public.payout_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  method_type text NOT NULL DEFAULT 'bank_account',
  account_holder_name text NOT NULL,
  bank_name text,
  account_last4 text,
  routing_number text,
  paypal_email text,
  country text NOT NULL DEFAULT 'US',
  currency text NOT NULL DEFAULT 'USD',
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS payout_methods_user_idx ON public.payout_methods (user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.payout_methods TO authenticated;
GRANT ALL ON public.payout_methods TO service_role;
ALTER TABLE public.payout_methods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own payout methods"
ON public.payout_methods FOR ALL TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE TRIGGER payout_methods_updated_at
BEFORE UPDATE ON public.payout_methods
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();