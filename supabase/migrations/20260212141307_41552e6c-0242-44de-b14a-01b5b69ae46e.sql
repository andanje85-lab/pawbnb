
-- Create storage bucket for listing photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('listing-photos', 'listing-photos', true);

-- Anyone can view listing photos
CREATE POLICY "Listing photos are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'listing-photos');

-- Authenticated users can upload listing photos
CREATE POLICY "Authenticated users can upload listing photos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'listing-photos' AND auth.role() = 'authenticated');

-- Users can delete their own uploaded photos
CREATE POLICY "Users can delete their own listing photos"
ON storage.objects FOR DELETE
USING (bucket_id = 'listing-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
