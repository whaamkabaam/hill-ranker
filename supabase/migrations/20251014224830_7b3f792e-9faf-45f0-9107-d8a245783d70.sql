-- Create pending_profile_images table to pre-stage images for future signups
CREATE TABLE public.pending_profile_images (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  image_url TEXT NOT NULL,
  uploaded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Enable RLS
ALTER TABLE public.pending_profile_images ENABLE ROW LEVEL SECURITY;

-- Admins can manage pending images
CREATE POLICY "Admins can view pending images"
ON public.pending_profile_images
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert pending images"
ON public.pending_profile_images
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete pending images"
ON public.pending_profile_images
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Function to apply pending profile image on signup
CREATE OR REPLACE FUNCTION public.apply_pending_profile_image()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  pending_image TEXT;
BEGIN
  -- Check if there's a pending image for this email
  SELECT image_url INTO pending_image
  FROM public.pending_profile_images
  WHERE LOWER(TRIM(email)) = LOWER(TRIM(NEW.email))
  LIMIT 1;
  
  -- If found, apply it to the new profile
  IF pending_image IS NOT NULL THEN
    NEW.profile_image_url := pending_image;
    
    -- Delete the pending record
    DELETE FROM public.pending_profile_images
    WHERE LOWER(TRIM(email)) = LOWER(TRIM(NEW.email));
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger to apply pending images when profiles are created
CREATE TRIGGER apply_pending_image_on_profile_creation
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.apply_pending_profile_image();