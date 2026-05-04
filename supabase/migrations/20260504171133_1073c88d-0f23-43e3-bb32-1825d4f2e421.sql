ALTER TABLE public.listings
ADD COLUMN IF NOT EXISTS cancellation_policy text NOT NULL DEFAULT 'moderate'
CHECK (cancellation_policy IN ('flexible', 'moderate', 'strict'));