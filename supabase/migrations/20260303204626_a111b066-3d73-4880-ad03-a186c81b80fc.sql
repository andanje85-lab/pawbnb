
-- Create app_role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'worker');

-- Create user_roles table
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Only admins can view/manage roles
CREATE POLICY "Staff can view roles" ON public.user_roles
  FOR SELECT USING (true);

CREATE POLICY "Admins can insert roles" ON public.user_roles
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Admins can delete roles" ON public.user_roles
  FOR DELETE USING (true);

-- Security definer function: check if a user has a role
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Security definer function: get current user's role
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT role::text FROM public.user_roles
  WHERE user_id = auth.uid()
  LIMIT 1
$$;

-- Staff RLS policies for listings (workers + admins can view all)
CREATE POLICY "Staff can view all listings" ON public.listings
  FOR SELECT USING (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'worker')
  );

CREATE POLICY "Staff can update listings" ON public.listings
  FOR UPDATE USING (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'worker')
  );

CREATE POLICY "Admins can delete listings" ON public.listings
  FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- Staff RLS policies for bookings
CREATE POLICY "Staff can view all bookings" ON public.bookings
  FOR SELECT USING (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'worker')
  );

CREATE POLICY "Staff can update bookings" ON public.bookings
  FOR UPDATE USING (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'worker')
  );
