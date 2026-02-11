
-- Listings table for host dog-sitting listings
CREATE TABLE public.listings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  host_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  price_per_night NUMERIC(10,2) NOT NULL DEFAULT 0,
  city TEXT,
  address TEXT,
  max_dogs INTEGER NOT NULL DEFAULT 1,
  amenities TEXT[] DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Listings are viewable by everyone"
  ON public.listings FOR SELECT
  USING (is_active = true);

CREATE POLICY "Hosts can view their own listings including inactive"
  ON public.listings FOR SELECT
  USING (auth.uid() = host_id);

CREATE POLICY "Hosts can create their own listings"
  ON public.listings FOR INSERT
  WITH CHECK (auth.uid() = host_id);

CREATE POLICY "Hosts can update their own listings"
  ON public.listings FOR UPDATE
  USING (auth.uid() = host_id);

CREATE POLICY "Hosts can delete their own listings"
  ON public.listings FOR DELETE
  USING (auth.uid() = host_id);

CREATE TRIGGER update_listings_updated_at
  BEFORE UPDATE ON public.listings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Listing photos
CREATE TABLE public.listing_photos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  listing_id UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.listing_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Listing photos are viewable by everyone"
  ON public.listing_photos FOR SELECT
  USING (true);

CREATE POLICY "Hosts can manage their listing photos"
  ON public.listing_photos FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.listings WHERE id = listing_id AND host_id = auth.uid())
  );

CREATE POLICY "Hosts can delete their listing photos"
  ON public.listing_photos FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM public.listings WHERE id = listing_id AND host_id = auth.uid())
  );

-- Bookings table
CREATE TABLE public.bookings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  listing_id UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  guest_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  check_in DATE NOT NULL,
  check_out DATE NOT NULL,
  number_of_dogs INTEGER NOT NULL DEFAULT 1,
  total_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Guests can view their own bookings"
  ON public.bookings FOR SELECT
  USING (auth.uid() = guest_id);

CREATE POLICY "Hosts can view bookings for their listings"
  ON public.bookings FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.listings WHERE id = listing_id AND host_id = auth.uid())
  );

CREATE POLICY "Guests can create bookings"
  ON public.bookings FOR INSERT
  WITH CHECK (auth.uid() = guest_id);

CREATE POLICY "Guests can update their pending bookings"
  ON public.bookings FOR UPDATE
  USING (auth.uid() = guest_id AND status = 'pending');

CREATE POLICY "Hosts can update booking status"
  ON public.bookings FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.listings WHERE id = listing_id AND host_id = auth.uid())
  );

CREATE TRIGGER update_bookings_updated_at
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
