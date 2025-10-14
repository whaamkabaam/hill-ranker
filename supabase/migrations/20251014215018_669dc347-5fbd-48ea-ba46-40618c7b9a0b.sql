-- Allow all authenticated users to view all rankings for global leaderboard
-- This is needed so the leaderboard shows aggregate data from all users
CREATE POLICY "Authenticated users can view all rankings for leaderboard"
ON rankings FOR SELECT
TO authenticated
USING (true);

-- Drop the old restrictive policy that only showed own rankings
DROP POLICY IF EXISTS "Authenticated users can view their own rankings" ON rankings;