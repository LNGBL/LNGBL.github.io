-- The public view is invoker-secured and exposes only columns granted below.
-- Allow anonymous and signed-in clients to read public leaderboard rows;
-- user_id remains unavailable through column-level privileges.
DROP POLICY IF EXISTS leaderboard_public_read ON public.leaderboard;
CREATE POLICY leaderboard_public_read
ON public.leaderboard
FOR SELECT
TO anon, authenticated
USING (true);
