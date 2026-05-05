-- One review per booking, validate rating + comment length
ALTER TABLE public.reviews
  ADD CONSTRAINT reviews_booking_unique UNIQUE (booking_id);

ALTER TABLE public.reviews
  ADD CONSTRAINT reviews_rating_range CHECK (rating >= 1 AND rating <= 5);

ALTER TABLE public.reviews
  ADD CONSTRAINT reviews_comment_length CHECK (comment IS NULL OR char_length(comment) <= 1000);

CREATE INDEX IF NOT EXISTS idx_reviews_listing_id ON public.reviews(listing_id);