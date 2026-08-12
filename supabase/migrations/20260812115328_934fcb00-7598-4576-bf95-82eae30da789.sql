CREATE TABLE public.function_errors (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  function_name text NOT NULL,
  message text NOT NULL,
  stack text,
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_function_errors_created_at ON public.function_errors (created_at DESC);
CREATE INDEX idx_function_errors_function_name ON public.function_errors (function_name);

GRANT SELECT ON public.function_errors TO authenticated;
GRANT ALL ON public.function_errors TO service_role;

ALTER TABLE public.function_errors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view function errors"
ON public.function_errors FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.purge_old_function_errors()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.function_errors WHERE created_at < now() - interval '30 days';
$$;