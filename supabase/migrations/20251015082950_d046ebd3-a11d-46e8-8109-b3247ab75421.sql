-- Add admin DELETE policies to voting-related tables
-- This allows admins to delete any records, not just their own

-- Allow admins to delete any vote
CREATE POLICY "Admins can delete any votes"
ON votes
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to delete any ranking
CREATE POLICY "Admins can delete any rankings"
ON rankings
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to delete any comparison session
CREATE POLICY "Admins can delete any sessions"
ON comparison_sessions
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to delete any prompt completion
CREATE POLICY "Admins can delete any completions"
ON prompt_completions
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));