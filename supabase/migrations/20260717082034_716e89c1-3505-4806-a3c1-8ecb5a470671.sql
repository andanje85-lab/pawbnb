
-- Reports table
CREATE TABLE public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL,
  target_type TEXT NOT NULL CHECK (target_type IN ('user','listing')),
  target_id UUID NOT NULL,
  reason TEXT NOT NULL,
  details TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','reviewing','resolved','dismissed')),
  resolution_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.reports TO authenticated;
GRANT ALL ON public.reports TO service_role;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can create their own reports"
  ON public.reports FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY "Users can view their own reports"
  ON public.reports FOR SELECT TO authenticated
  USING (auth.uid() = reporter_id);

CREATE POLICY "Staff can view all reports"
  ON public.reports FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'worker'));

CREATE POLICY "Staff can update reports"
  ON public.reports FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'worker'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'worker'));

CREATE TRIGGER reports_updated_at BEFORE UPDATE ON public.reports
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Insurance claims table
CREATE TABLE public.insurance_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claimant_id UUID NOT NULL,
  booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
  claim_type TEXT NOT NULL CHECK (claim_type IN ('property_damage','veterinary','injury','other')),
  incident_date DATE NOT NULL,
  description TEXT NOT NULL,
  amount_requested NUMERIC(10,2),
  evidence_urls JSONB DEFAULT '[]'::jsonb,
  contact_email TEXT NOT NULL,
  contact_phone TEXT,
  status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted','reviewing','approved','denied','paid')),
  resolution_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.insurance_claims TO authenticated;
GRANT ALL ON public.insurance_claims TO service_role;
ALTER TABLE public.insurance_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can file their own claims"
  ON public.insurance_claims FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = claimant_id);

CREATE POLICY "Users can view their own claims"
  ON public.insurance_claims FOR SELECT TO authenticated
  USING (auth.uid() = claimant_id);

CREATE POLICY "Staff can view all claims"
  ON public.insurance_claims FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'worker'));

CREATE POLICY "Staff can update claims"
  ON public.insurance_claims FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'worker'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'worker'));

CREATE TRIGGER insurance_claims_updated_at BEFORE UPDATE ON public.insurance_claims
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
