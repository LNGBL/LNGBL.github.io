-- leaderboard_public_read already permits the intended safe public projection.
-- The self-only policy is redundant and causes duplicate permissive SELECT evaluation.
DROP POLICY IF EXISTS leaderboard_self_select ON public.leaderboard;
