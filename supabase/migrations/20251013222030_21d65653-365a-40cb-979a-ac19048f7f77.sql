-- Add consistency and quality metrics columns to rankings table
ALTER TABLE public.rankings
  ADD COLUMN consistency_score NUMERIC,
  ADD COLUMN transitivity_violations INTEGER DEFAULT 0,
  ADD COLUMN vote_certainty NUMERIC,
  ADD COLUMN average_vote_time_seconds NUMERIC,
  ADD COLUMN quality_flags TEXT[] DEFAULT '{}';

-- Add comment for documentation
COMMENT ON COLUMN public.rankings.consistency_score IS 'Percentage of votes that follow transitive logic (0-100)';
COMMENT ON COLUMN public.rankings.transitivity_violations IS 'Number of A>B>C but C>A violations detected';
COMMENT ON COLUMN public.rankings.vote_certainty IS 'Average confidence in votes (based on time and tie rate)';
COMMENT ON COLUMN public.rankings.average_vote_time_seconds IS 'Average time per vote in seconds';
COMMENT ON COLUMN public.rankings.quality_flags IS 'Array of quality issues: random_voting, too_fast, too_slow, etc.';