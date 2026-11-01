-- Keep the physical leaderboard table private to each authenticated owner.
DROP POLICY IF EXISTS leaderboard_public_read ON public.leaderboard;
CREATE POLICY leaderboard_self_select
ON public.leaderboard
FOR SELECT
TO authenticated
USING ((SELECT auth.uid()) = user_id);

GRANT SELECT, INSERT, UPDATE ON TABLE public.leaderboard TO authenticated;

-- The public view exposes display/statistic columns only; it omits user_id.
-- Execute the safe projection with its trusted owner privileges.
ALTER VIEW public.leaderboard_public RESET (security_invoker);
ALTER VIEW public.leaderboard_public SET (security_barrier = true);
