-- Add UPDATE policy for rankings table to allow users to update their own rankings
CREATE POLICY "Users can update own rankings"
ON public.rankings
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Add UPDATE policy for prompt_completions table to allow users to update their own completions
CREATE POLICY "Users can update own completions"
ON public.prompt_completions
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);