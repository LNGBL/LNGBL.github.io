-- Prevent a missing engagement_rewards row from turning leaderboard.tokens into NULL.
create or replace function public.sync_leaderboard(
  p_points integer,
  p_tokens integer,
  p_grammar_score integer,
  p_vocabulary_count integer,
  p_grammar_count integer,
  p_practice_language text default null,
  p_practice_section text default null
)
returns public.leaderboard
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_user public.profiles%rowtype;
  v_row public.leaderboard%rowtype;
  v_languages text[];
  v_sections text[];
  v_reward_tokens integer := 0;
  v_reward_points integer := 0;
  v_engagement_tokens integer := 0;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;

  select * into v_user from public.profiles where id=auth.uid();
  if not found then raise exception 'PROFILE_NOT_FOUND'; end if;

  select coalesce(sum(tokens),0), coalesce(sum(leaderboard_points),0)
    into v_reward_tokens, v_reward_points
    from public.account_annual_rewards
   where user_id=auth.uid();

  select coalesce((
    select favorite_milestone_tokens
      from public.engagement_rewards
     where user_id=auth.uid()
  ),0)
    into v_engagement_tokens;

  select coalesce(practice_languages,'{}'), coalesce(practice_sections,'{}')
    into v_languages, v_sections
    from public.leaderboard
   where user_id=auth.uid();

  v_languages := coalesce(v_languages,'{}');
  v_sections := coalesce(v_sections,'{}');

  if nullif(trim(p_practice_language),'') is not null
     and not (lower(trim(p_practice_language)) = any(v_languages))
  then
    v_languages := array_append(v_languages,lower(trim(p_practice_language)));
  end if;

  if nullif(trim(p_practice_section),'') is not null
     and not (lower(trim(p_practice_section)) = any(v_sections))
  then
    v_sections := array_append(v_sections,lower(trim(p_practice_section)));
  end if;

  insert into public.leaderboard(
    user_id, username, display_name, points, tokens, grammar_score,
    vocabulary_count, grammar_count, practice_languages, practice_sections,
    last_active_at, updated_at
  )
  values(
    auth.uid(), coalesce(v_user.username,''), coalesce(v_user.name,''),
    greatest(coalesce(p_points,0),0) + v_reward_points,
    greatest(coalesce(p_tokens,0),0) + v_reward_tokens + v_engagement_tokens,
    greatest(coalesce(p_grammar_score,0),0),
    greatest(coalesce(p_vocabulary_count,0),0),
    greatest(coalesce(p_grammar_count,0),0),
    v_languages, v_sections, now(), now()
  )
  on conflict(user_id) do update set
    username=excluded.username, display_name=excluded.display_name,
    points=excluded.points, tokens=excluded.tokens,
    grammar_score=excluded.grammar_score,
    vocabulary_count=excluded.vocabulary_count,
    grammar_count=excluded.grammar_count,
    practice_languages=excluded.practice_languages,
    practice_sections=excluded.practice_sections,
    last_active_at=now(), updated_at=now()
  returning * into v_row;

  return v_row;
end;
$function$;

revoke execute on function public.sync_leaderboard(integer,integer,integer,integer,integer,text,text) from public, anon;
grant execute on function public.sync_leaderboard(integer,integer,integer,integer,integer,text,text) to authenticated;
