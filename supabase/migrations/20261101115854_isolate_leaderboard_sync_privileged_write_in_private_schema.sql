-- Keep the public leaderboard view invoker-secured and column-limited.
ALTER VIEW public.leaderboard_public SET (security_invoker = true, security_barrier = true);

-- The sync helper writes only for auth.uid(); it accepts no target user id.
-- It is kept in the non-exposed internal schema and is called by the public invoker wrapper.
CREATE OR REPLACE FUNCTION langblue_internal.sync_leaderboard_secure(
  p_points integer,
  p_tokens integer,
  p_grammar_score integer,
  p_vocabulary_count integer,
  p_grammar_count integer,
  p_practice_language text,
  p_practice_section text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'auth'
AS $function$
DECLARE
  v_user public.profiles%rowtype;
  v_reward_tokens integer := 0;
  v_reward_points integer := 0;
  v_engagement_tokens integer := 0;
  v_result jsonb;
  v_languages text[] := '{}'::text[];
  v_sections text[] := '{}'::text[];
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
  END IF;

  SELECT * INTO v_user FROM public.profiles WHERE id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'PROFILE_NOT_FOUND'; END IF;

  SELECT coalesce(sum(tokens), 0), coalesce(sum(leaderboard_points), 0)
    INTO v_reward_tokens, v_reward_points
    FROM public.account_annual_rewards WHERE user_id = auth.uid();

  SELECT coalesce((SELECT favorite_milestone_tokens FROM public.engagement_rewards WHERE user_id = auth.uid()), 0)
    INTO v_engagement_tokens;

  IF nullif(trim(p_practice_language), '') IS NOT NULL THEN
    v_languages := ARRAY[lower(trim(p_practice_language))];
  END IF;
  IF nullif(trim(p_practice_section), '') IS NOT NULL THEN
    v_sections := ARRAY[lower(trim(p_practice_section))];
  END IF;

  INSERT INTO public.leaderboard (
    user_id, username, display_name, points, tokens, grammar_score,
    vocabulary_count, grammar_count, practice_languages, practice_sections,
    last_active_at, updated_at
  )
  VALUES (
    auth.uid(), coalesce(v_user.username, ''), coalesce(v_user.name, ''),
    greatest(coalesce(p_points, 0), 0) + v_reward_points,
    greatest(coalesce(p_tokens, 0), 0) + v_reward_tokens + v_engagement_tokens,
    greatest(coalesce(p_grammar_score, 0), 0),
    greatest(coalesce(p_vocabulary_count, 0), 0),
    greatest(coalesce(p_grammar_count, 0), 0),
    v_languages, v_sections, now(), now()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    username = excluded.username,
    display_name = excluded.display_name,
    points = excluded.points,
    tokens = excluded.tokens,
    grammar_score = excluded.grammar_score,
    vocabulary_count = excluded.vocabulary_count,
    grammar_count = excluded.grammar_count,
    practice_languages = CASE
      WHEN nullif(trim(p_practice_language), '') IS NOT NULL
       AND NOT (lower(trim(p_practice_language)) = ANY(coalesce(leaderboard.practice_languages, '{}'::text[])))
      THEN array_append(coalesce(leaderboard.practice_languages, '{}'::text[]), lower(trim(p_practice_language)))
      ELSE coalesce(leaderboard.practice_languages, '{}'::text[])
    END,
    practice_sections = CASE
      WHEN nullif(trim(p_practice_section), '') IS NOT NULL
       AND NOT (lower(trim(p_practice_section)) = ANY(coalesce(leaderboard.practice_sections, '{}'::text[])))
      THEN array_append(coalesce(leaderboard.practice_sections, '{}'::text[]), lower(trim(p_practice_section)))
      ELSE coalesce(leaderboard.practice_sections, '{}'::text[])
    END,
    last_active_at = now(),
    updated_at = now()
  RETURNING jsonb_build_object(
    'username', username, 'display_name', display_name, 'points', points,
    'tokens', tokens, 'grammar_score', grammar_score,
    'vocabulary_count', vocabulary_count, 'grammar_count', grammar_count,
    'practice_languages', practice_languages, 'practice_sections', practice_sections,
    'updated_at', updated_at
  ) INTO v_result;

  RETURN v_result;
END;
$function$;

REVOKE ALL ON FUNCTION langblue_internal.sync_leaderboard_secure(integer, integer, integer, integer, integer, text, text) FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA langblue_internal TO authenticated;
GRANT EXECUTE ON FUNCTION langblue_internal.sync_leaderboard_secure(integer, integer, integer, integer, integer, text, text) TO authenticated;

REVOKE INSERT (
  user_id, username, display_name, points, tokens, grammar_score,
  vocabulary_count, grammar_count, practice_languages, practice_sections,
  last_active_at, updated_at
) ON TABLE public.leaderboard FROM authenticated;
REVOKE UPDATE (
  username, display_name, points, tokens, grammar_score,
  vocabulary_count, grammar_count, practice_languages, practice_sections,
  last_active_at, updated_at
) ON TABLE public.leaderboard FROM authenticated;

CREATE OR REPLACE FUNCTION public.sync_leaderboard(
  p_points integer, p_tokens integer, p_grammar_score integer,
  p_vocabulary_count integer, p_grammar_count integer,
  p_practice_language text DEFAULT NULL, p_practice_section text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'pg_catalog', 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  RETURN langblue_internal.sync_leaderboard_secure(
    p_points, p_tokens, p_grammar_score, p_vocabulary_count,
    p_grammar_count, p_practice_language, p_practice_section
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.sync_leaderboard(integer, integer, integer, integer, integer, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sync_leaderboard(integer, integer, integer, integer, integer, text, text) TO authenticated;
