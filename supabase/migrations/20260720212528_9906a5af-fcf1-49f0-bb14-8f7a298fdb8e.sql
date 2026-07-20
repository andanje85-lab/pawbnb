
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS booking_type text NOT NULL DEFAULT 'request',
  ADD COLUMN IF NOT EXISTS extra_dog_price numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS repeat_guest_discount_pct integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS long_stay_min_nights integer,
  ADD COLUMN IF NOT EXISTS long_stay_discount_pct integer NOT NULL DEFAULT 0;

ALTER TABLE public.listings
  DROP CONSTRAINT IF EXISTS listings_booking_type_check;
ALTER TABLE public.listings
  ADD CONSTRAINT listings_booking_type_check CHECK (booking_type IN ('instant','request'));

ALTER TABLE public.listings
  DROP CONSTRAINT IF EXISTS listings_repeat_pct_check;
ALTER TABLE public.listings
  ADD CONSTRAINT listings_repeat_pct_check CHECK (repeat_guest_discount_pct BETWEEN 0 AND 100);

ALTER TABLE public.listings
  DROP CONSTRAINT IF EXISTS listings_long_pct_check;
ALTER TABLE public.listings
  ADD CONSTRAINT listings_long_pct_check CHECK (long_stay_discount_pct BETWEEN 0 AND 100);

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS meet_greet_at timestamptz,
  ADD COLUMN IF NOT EXISTS meet_greet_status text,
  ADD COLUMN IF NOT EXISTS discount_applied numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_reason text;

ALTER TABLE public.bookings
  DROP CONSTRAINT IF EXISTS bookings_meet_greet_status_check;
ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_meet_greet_status_check
  CHECK (meet_greet_status IS NULL OR meet_greet_status IN ('proposed','accepted','declined'));
