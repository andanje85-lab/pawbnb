ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS rule_max_size text,
  ADD COLUMN IF NOT EXISTS rule_require_neutered boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS rule_require_vaccinated boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS rule_min_age_months integer;