-- Keep the public leaderboard view invoker-secured and column-limited.
ALTER VIEW public.leaderboard_public SET (security_invoker = true, security_barrier = true);

-- Revoke the broad table privileges added during the initial repair.
REVOKE SELECT, INSERT, UPDATE ON TABLE public.leaderboard FROM authenticated;

-- Public leaderboard readers can access display/statistic columns only.
-- user_id is intentionally excluded from all client SELECT grants.
GRANT SELECT (
  username, display_name, points, tokens, grammar_score,
  vocabulary_count, grammar_count, updated_at,
  practice_languages, practice_sections, last_active_at
) ON TABLE public.leaderboard TO anon, authenticated;

-- The sync RPC is SECURITY INVOKER and writes only the caller's own row,
-- enforced by the existing leaderboard_self_insert / leaderboard_self_update RLS policies.
GRANT INSERT (
  user_id, username, display_name, points, tokens, grammar_score,
  vocabulary_count, grammar_count, practice_languages, practice_sections,
  last_active_at, updated_at
) ON TABLE public.leaderboard TO authenticated;

GRANT UPDATE (
  username, display_name, points, tokens, grammar_score,
  vocabulary_count, grammar_count, practice_languages, practice_sections,
  last_active_at, updated_at
) ON TABLE public.leaderboard TO authenticated;

-- Avoid returning the leaderboard composite type (which would require SELECT on user_id).
-- Return only a safe JSON projection after the caller-scoped upsert.
DROP FUNCTION public.sync_leaderboard(integer, integer, integer, integer, integer, text, text);

CREATE FUNCTION public.sync_leaderboard(
  p_points integer,
  p_tokens integer,
  p_grammar_score integer,
  p_vocabulary_count integer,
  p_grammar_count integer,
  p_practice_language text DEFAULT NULL,
  p_practice_section text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'pg_catalog', 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
  END IF;

  RETURN langblue_internal.sync_leaderboard_secure(
    p_points, p_tokens, p_grammar_score, p_vocabulary_count,
    p_grammar_count, p_practice_language, p_practice_section
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.sync_leaderboard(integer, integer, integer, integer, integer, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sync_leaderboard(integer, integer, integer, integer, integer, text, text) TO authenticated;
