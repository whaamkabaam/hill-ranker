-- Phase 4: Database Schema Improvements
-- Add comparison_sessions table, indices, and constraints

-- 1. Create comparison_sessions table to track session metadata
CREATE TABLE IF NOT EXISTS public.comparison_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  prompt_id UUID NOT NULL REFERENCES public.prompts(id) ON DELETE CASCADE,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  total_comparisons INTEGER NOT NULL DEFAULT 0,
  completed_comparisons INTEGER NOT NULL DEFAULT 0,
  consistency_score NUMERIC,
  vote_certainty NUMERIC,
  transitivity_violations INTEGER DEFAULT 0,
  average_vote_time_seconds NUMERIC,
  quality_flags TEXT[] DEFAULT '{}',
  session_metadata JSONB DEFAULT '{}'::jsonb,
  UNIQUE(user_id, prompt_id)
);

-- Enable RLS on comparison_sessions
ALTER TABLE public.comparison_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for comparison_sessions
CREATE POLICY "Users can view own sessions"
  ON public.comparison_sessions
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sessions"
  ON public.comparison_sessions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sessions"
  ON public.comparison_sessions
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all sessions"
  ON public.comparison_sessions
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- 2. Add performance indices

-- Votes table indices
CREATE INDEX IF NOT EXISTS idx_votes_user_prompt 
  ON public.votes(user_id, prompt_id);

CREATE INDEX IF NOT EXISTS idx_votes_prompt_created 
  ON public.votes(prompt_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_votes_images 
  ON public.votes(left_image_id, right_image_id);

-- Rankings table indices
CREATE INDEX IF NOT EXISTS idx_rankings_user 
  ON public.rankings(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_rankings_prompt 
  ON public.rankings(prompt_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_rankings_consistency 
  ON public.rankings(consistency_score DESC) 
  WHERE consistency_score IS NOT NULL;

-- Prompt completions indices
CREATE INDEX IF NOT EXISTS idx_prompt_completions_user 
  ON public.prompt_completions(user_id, prompt_id);

-- Images table indices
CREATE INDEX IF NOT EXISTS idx_images_prompt 
  ON public.images(prompt_id);

-- Comparison sessions indices
CREATE INDEX IF NOT EXISTS idx_sessions_user_prompt 
  ON public.comparison_sessions(user_id, prompt_id);

CREATE INDEX IF NOT EXISTS idx_sessions_completed 
  ON public.comparison_sessions(completed_at DESC) 
  WHERE completed_at IS NOT NULL;

-- 3. Add unique constraint to prevent duplicate votes on same pair
-- Note: We need to handle both orderings (left-right and right-left)
-- First, drop the constraint if it exists
ALTER TABLE public.votes DROP CONSTRAINT IF EXISTS votes_unique_pair;

-- Add the unique constraint
-- This prevents voting on the same pair twice (in either order)
CREATE UNIQUE INDEX IF NOT EXISTS votes_unique_pair_idx 
  ON public.votes(user_id, prompt_id, LEAST(left_image_id, right_image_id), GREATEST(left_image_id, right_image_id));

-- 4. Add check constraint to ensure winner is one of the images (when not a tie)
ALTER TABLE public.votes DROP CONSTRAINT IF EXISTS votes_winner_valid;

ALTER TABLE public.votes 
  ADD CONSTRAINT votes_winner_valid 
  CHECK (
    is_tie = true OR 
    winner_id = left_image_id OR 
    winner_id = right_image_id
  );

-- 5. Add helpful comments
COMMENT ON TABLE public.comparison_sessions IS 'Tracks metadata for comparison sessions including quality metrics';
COMMENT ON TABLE public.votes IS 'Stores individual pairwise comparisons in Round-Robin tournament';
COMMENT ON TABLE public.rankings IS 'Stores final rankings after all comparisons are complete';

COMMENT ON COLUMN public.comparison_sessions.session_metadata IS 'Additional session data like device info, browser, etc.';
COMMENT ON COLUMN public.comparison_sessions.quality_flags IS 'Array of quality issues detected (e.g., too_fast, random_voting)';
COMMENT ON COLUMN public.votes.is_tie IS 'True if user declared images equal quality';
COMMENT ON COLUMN public.rankings.quality_flags IS 'Quality issues detected during ranking (too_fast, low_consistency, etc.)';
