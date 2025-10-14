-- Allow authenticated users to delete their own votes
CREATE POLICY "Authenticated users can delete their own votes"
ON votes
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Allow authenticated users to delete their own rankings
CREATE POLICY "Authenticated users can delete their own rankings"
ON rankings
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Allow authenticated users to delete their own sessions
CREATE POLICY "Authenticated users can delete their own sessions"
ON comparison_sessions
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Allow authenticated users to delete their own completions
CREATE POLICY "Authenticated users can delete their own completions"
ON prompt_completions
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);