
-- Create audit_logs table
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action text NOT NULL,           -- 'role_assigned' | 'role_removed'
  actor_id uuid NOT NULL,         -- admin who performed the action
  target_user_id uuid NOT NULL,   -- user affected
  role text NOT NULL,             -- role that was assigned/removed
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Admins can view all logs
CREATE POLICY "Admins can view audit logs"
  ON public.audit_logs FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can insert audit logs
CREATE POLICY "Admins can insert audit logs"
  ON public.audit_logs FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
