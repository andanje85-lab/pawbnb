-- Referral codes
CREATE TABLE public.referral_codes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE,
  code text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.referral_codes TO authenticated;
GRANT SELECT ON public.referral_codes TO anon;
GRANT ALL ON public.referral_codes TO service_role;

ALTER TABLE public.referral_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Referral codes are readable by everyone"
  ON public.referral_codes FOR SELECT USING (true);

CREATE POLICY "Users can create their own referral code"
  ON public.referral_codes FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Referrals
CREATE TABLE public.referrals (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  referrer_id uuid NOT NULL,
  referred_user_id uuid NOT NULL UNIQUE,
  code text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  reward_amount numeric NOT NULL DEFAULT 0,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT referrals_no_self CHECK (referrer_id <> referred_user_id),
  CONSTRAINT referrals_status_check CHECK (status IN ('pending','completed','rewarded'))
);

CREATE INDEX idx_referrals_referrer ON public.referrals(referrer_id);

GRANT SELECT, INSERT ON public.referrals TO authenticated;
GRANT ALL ON public.referrals TO service_role;

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own referrals"
  ON public.referrals FOR SELECT TO authenticated
  USING (auth.uid() = referrer_id OR auth.uid() = referred_user_id);

CREATE POLICY "Staff can view all referrals"
  ON public.referrals FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'worker'::app_role));

CREATE POLICY "New users can attach themselves to a referrer"
  ON public.referrals FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = referred_user_id AND status = 'pending');

CREATE POLICY "Staff can update referrals"
  ON public.referrals FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'worker'::app_role));

CREATE TRIGGER referrals_updated_at
  BEFORE UPDATE ON public.referrals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Credit a referral when the invited guest's booking gets confirmed
CREATE OR REPLACE FUNCTION public.complete_referral_on_booking()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'confirmed' AND COALESCE(OLD.status, '') <> 'confirmed' THEN
    UPDATE public.referrals
    SET status = 'completed',
        reward_amount = 20,
        completed_at = now()
    WHERE referred_user_id = NEW.guest_id
      AND status = 'pending';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER complete_referral_on_booking_trg
  AFTER UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.complete_referral_on_booking();