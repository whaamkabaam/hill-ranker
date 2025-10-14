-- Create storage bucket for prompt images
INSERT INTO storage.buckets (id, name, public)
VALUES ('prompt-images', 'prompt-images', true);

-- RLS policies for bucket
CREATE POLICY "Admins can upload images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'prompt-images' AND
  has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Anyone can view images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'prompt-images');

CREATE POLICY "Admins can delete images"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'prompt-images' AND
  has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admins can update images"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'prompt-images' AND
  has_role(auth.uid(), 'admin'::app_role)
);