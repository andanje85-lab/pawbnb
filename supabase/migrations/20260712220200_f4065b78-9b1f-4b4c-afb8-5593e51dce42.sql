
-- Add lifecycle columns
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_by uuid,
  ADD COLUMN IF NOT EXISTS cancellation_reason text,
  ADD COLUMN IF NOT EXISTS refund_percentage numeric,
  ADD COLUMN IF NOT EXISTS refund_amount numeric;

-- Trigger: set expires_at = created_at + 48h on new pending bookings
CREATE OR REPLACE FUNCTION public.set_booking_expiry()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.expires_at IS NULL AND COALESCE(NEW.status, 'pending') = 'pending' THEN
    NEW.expires_at := COALESCE(NEW.created_at, now()) + interval '48 hours';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_booking_expiry_trg ON public.bookings;
CREATE TRIGGER set_booking_expiry_trg
BEFORE INSERT ON public.bookings
FOR EACH ROW EXECUTE FUNCTION public.set_booking_expiry();

-- updated_at trigger (if not already present)
DROP TRIGGER IF EXISTS update_bookings_updated_at ON public.bookings;
CREATE TRIGGER update_bookings_updated_at
BEFORE UPDATE ON public.bookings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-expire function
CREATE OR REPLACE FUNCTION public.expire_stale_bookings()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.bookings
  SET status = 'expired',
      updated_at = now()
  WHERE status = 'pending'
    AND expires_at IS NOT NULL
    AND expires_at < now();
$$;

-- Backfill expires_at for existing pending bookings
UPDATE public.bookings
SET expires_at = created_at + interval '48 hours'
WHERE status = 'pending' AND expires_at IS NULL;

-- Schedule via pg_cron every 5 minutes
CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'expire-stale-bookings') THEN
    PERFORM cron.unschedule('expire-stale-bookings');
  END IF;
  PERFORM cron.schedule(
    'expire-stale-bookings',
    '*/5 * * * *',
    $cron$ SELECT public.expire_stale_bookings(); $cron$
  );
END;
$$;
