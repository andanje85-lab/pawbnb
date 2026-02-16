
CREATE TABLE public.reviews (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  listing_id UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Unique: one review per booking
CREATE UNIQUE INDEX idx_reviews_booking ON public.reviews(booking_id);

-- For listing average queries
CREATE INDEX idx_reviews_listing ON public.reviews(listing_id);

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- Anyone can read reviews
CREATE POLICY "Reviews are viewable by everyone"
ON public.reviews FOR SELECT
USING (true);

-- Only the guest of a confirmed booking can leave a review
CREATE POLICY "Guests can create reviews for their bookings"
ON public.reviews FOR INSERT
WITH CHECK (
  auth.uid() = reviewer_id
  AND EXISTS (
    SELECT 1 FROM public.bookings
    WHERE bookings.id = reviews.booking_id
      AND bookings.guest_id = auth.uid()
      AND bookings.status = 'confirmed'
  )
);

-- Reviewers can update their own review
CREATE POLICY "Reviewers can update their own reviews"
ON public.reviews FOR UPDATE
USING (auth.uid() = reviewer_id);

-- Reviewers can delete their own review
CREATE POLICY "Reviewers can delete their own reviews"
ON public.reviews FOR DELETE
USING (auth.uid() = reviewer_id);
