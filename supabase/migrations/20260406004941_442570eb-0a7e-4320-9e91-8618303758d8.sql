
-- Create storage bucket for message attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('message-attachments', 'message-attachments', true);

-- Storage RLS: participants can upload attachments
CREATE POLICY "Authenticated users can upload message attachments"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'message-attachments');

-- Storage RLS: anyone can view (public bucket)
CREATE POLICY "Anyone can view message attachments"
ON storage.objects FOR SELECT
USING (bucket_id = 'message-attachments');

-- Storage RLS: uploaders can delete their own files
CREATE POLICY "Users can delete their own message attachments"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'message-attachments' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Add attachments JSONB column to messages table
ALTER TABLE public.messages ADD COLUMN attachments jsonb DEFAULT '[]'::jsonb;
