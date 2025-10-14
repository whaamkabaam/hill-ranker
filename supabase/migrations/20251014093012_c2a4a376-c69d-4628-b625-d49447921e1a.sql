-- Phase 1: Add content tracking columns to prompts table
ALTER TABLE public.prompts 
  ADD COLUMN is_active BOOLEAN DEFAULT true,
  ADD COLUMN is_placeholder BOOLEAN DEFAULT false,
  ADD COLUMN uploaded_by UUID REFERENCES public.profiles(id);

-- Add content tracking columns to images table  
ALTER TABLE public.images
  ADD COLUMN is_active BOOLEAN DEFAULT true,
  ADD COLUMN is_placeholder BOOLEAN DEFAULT false,
  ADD COLUMN uploaded_by UUID REFERENCES public.profiles(id);

-- Create index for faster filtering
CREATE INDEX idx_prompts_active ON public.prompts(is_active, is_placeholder);
CREATE INDEX idx_images_active ON public.images(is_active, is_placeholder);

-- Phase 5: Mark all existing data as placeholder and inactive
UPDATE public.prompts SET is_placeholder = true, is_active = false;
UPDATE public.images SET is_placeholder = true, is_active = false;

-- Add RLS policies for content management
CREATE POLICY "Admins can manage prompt content flags"
ON public.prompts FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage image content flags"
ON public.images FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));