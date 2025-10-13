-- Create prompt_completions table to track completed prompts
CREATE TABLE public.prompt_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  prompt_id UUID NOT NULL REFERENCES public.prompts(id) ON DELETE CASCADE,
  completed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, prompt_id)
);

-- Enable RLS
ALTER TABLE public.prompt_completions ENABLE ROW LEVEL SECURITY;

-- Users can view their own completions
CREATE POLICY "Users can view own completions"
ON public.prompt_completions
FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own completions
CREATE POLICY "Users can insert own completions"
ON public.prompt_completions
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Admins can view all completions
CREATE POLICY "Admins can view all completions"
ON public.prompt_completions
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add confidence_score and completion_time to rankings table
ALTER TABLE public.rankings
ADD COLUMN confidence_score NUMERIC,
ADD COLUMN completion_time_seconds INTEGER;