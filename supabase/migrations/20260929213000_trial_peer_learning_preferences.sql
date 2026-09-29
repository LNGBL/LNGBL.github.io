begin;

-- LangBlue account trial + peer-learning + profile preferences.
alter table public.profiles
  add column if not exists english_level text,
  add column if not exists german_level text,
  add column if not exists peer_learning_consent boolean not null default false,
  add column if not exists peer_learning_consent_at timestamptz,
  add column if not exists peer_learning_notifications boolean not null default true,
  add column if not exists favorite_artists text[] not null default '{}',
  add column if not exists trial_started_at timestamptz,
  add column if not exists trial_expires_at timestamptz;

do $$ begin
  alter table public.profiles add constraint profiles_english_level_check check (english_level is null or english_level in ('A1','A2','B1','B2','C1','C2'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.profiles add constraint profiles_german_level_check check (german_level is null or german_level in ('A1','A2','B1','B2','C1','C2'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.profiles add constraint profiles_favorite_artists_check check (coalesce(array_length(favorite_artists,1),0) between 0 and 2);
exception when duplicate_object then null; end $$;

create table if not exists public.profile_music_catalog(
  artist_key text primary key, artist_name text not null, language text not null check(language='english'),
  track_ids text[] not null, active boolean not null default true
);

insert into public.profile_music_catalog(artist_key,artist_name,language,track_ids) values
('taylor_swift','Taylor Swift','english',array['3yWuTOYDztXjZxdE2cIRUa','53iuhJlwXhSER5J2IYYv1W','11hcBLPtbMp4aQI6zGQLub']),
('billie_eilish','Billie Eilish','english',array['6dOtVTDdiauQNBQEDOtlAB','7BRD7x5pt8Lqa1eGYC4dzj']),
('john_lennon','John Lennon','english',array['7pKfPomDEeI4TPT6EOYjn9','3D9iV6cYkYJRAPFO6DRKIE']),
('dua_lipa','Dua Lipa','english',array['5b5cPscqVEMChvDqscVw26','3PfIrDoz19wz7qK7tYeu62'])
on conflict(artist_key) do update set track_ids=excluded.track_ids,artist_name=excluded.artist_name,active=true;

create table if not exists public.peer_learning_deliveries(
  id uuid primary key default gen_random_uuid(), cycle_start date not null,
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  language text not null check(language in ('english','german')),
  language_level text not null check(language_level in ('A1','A2','B1','B2','C1','C2')),
  source_type text not null check(source_type in ('vocabulary','grammar')),
  content jsonb not null, source_hash text, delivered_at timestamptz not null default now(),
  seen_at timestamptz, notification_requested boolean not null default true,
  unique(cycle_start,recipient_user_id,language,source_type,source_hash)
);

create table if not exists public.peer_learning_notifications(
  id uuid primary key default gen_random_uuid(),
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  delivery_id uuid not null references public.peer_learning_deliveries(id) on delete cascade,
  created_at timestamptz not null default now(), read_at timestamptz
);

create table if not exists public.engagement_rewards(
  user_id uuid primary key references auth.users(id) on delete cascade,
  favorite_milestone_tokens integer not null default 0 check(favorite_milestone_tokens between 0 and 50),
  milestone_250_reached_at timestamptz, updated_at timestamptz not null default now()
);

alter table public.peer_learning_deliveries enable row level security;
alter table public.peer_learning_notifications enable row level security;
alter table public.engagement_rewards enable row level security;
alter table public.profile_music_catalog enable row level security;

drop policy if exists peer_delivery_owner on public.peer_learning_deliveries;
create policy peer_delivery_owner on public.peer_learning_deliveries for select to authenticated using((select auth.uid())=recipient_user_id);
drop policy if exists peer_notification_owner on public.peer_learning_notifications;
create policy peer_notification_owner on public.peer_learning_notifications for all to authenticated using((select auth.uid())=recipient_user_id) with check((select auth.uid())=recipient_user_id);
drop policy if exists engagement_reward_owner on public.engagement_rewards;
create policy engagement_reward_owner on public.engagement_rewards for select to authenticated using((select auth.uid())=user_id);
drop policy if exists music_catalog_public on public.profile_music_catalog;
create policy music_catalog_public on public.profile_music_catalog for select to anon,authenticated using(active=true);

revoke all on public.peer_learning_deliveries,public.peer_learning_notifications,public.engagement_rewards from anon;
grant select on public.peer_learning_deliveries,public.engagement_rewards to authenticated;
grant select,update on public.peer_learning_notifications to authenticated;
grant select on public.profile_music_catalog to anon,authenticated;

insert into public.plans(id,label,days,months,price_irt,active)
values('trial_48h','۴۸ ساعت آزمایشی',2,null,0,true)
on conflict(id) do update set label=excluded.label,days=2,price_irt=0,active=true;

update public.plans set price_irt=case id
 when 'irt_7d' then 330000 when 'irt_14d' then 440000 when 'irt_21d' then 550000
 when 'irt_3m' then 880000 when 'irt_6m' then 1100000 when 'irt_12m' then 1430000
 else price_irt end
where id in('irt_7d','irt_14d','irt_21d','irt_3m','irt_6m','irt_12m');

update public.profiles set trial_started_at=created_at,trial_expires_at=created_at+interval '48 hours' where trial_started_at is null;

create or replace function public.grant_48h_trial(p_user_id uuid) returns void
language plpgsql security definer set search_path=public as $$
declare v_start timestamptz; v_exp timestamptz;
begin
 select trial_started_at,trial_expires_at into v_start,v_exp from public.profiles where id=p_user_id for update;
 if v_start is null then
  v_start=now(); v_exp=v_start+interval '48 hours';
  update public.profiles set trial_started_at=v_start,trial_expires_at=v_exp,updated_at=now() where id=p_user_id;
  insert into public.subscriptions(user_id,plan_id,product_ids,status,starts_at,expires_at)
  values(p_user_id,'trial_48h',array['grammar','vocabulary','deutsch'],'active',v_start,v_exp);
 end if;
end; $$;

create or replace function public.save_profile_preferences(p_english_level text,p_german_level text,p_peer_consent boolean,p_notifications boolean,p_favorite_artists text[])
returns jsonb language plpgsql security invoker set search_path=public as $$
declare v_user uuid=(select auth.uid()); v_artists text[]=coalesce(p_favorite_artists,'{}');
begin
 if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
 if p_english_level not in('A1','A2','B1','B2','C1','C2') or p_german_level not in('A1','A2','B1','B2','C1','C2') then raise exception 'INVALID_LANGUAGE_LEVEL'; end if;
 if coalesce(array_length(v_artists,1),0)<1 or coalesce(array_length(v_artists,1),0)>2 then raise exception 'MAX_TWO_FAVORITES'; end if;
 if exists(select 1 from unnest(v_artists) a left join public.profile_music_catalog c on c.artist_key=a where c.artist_key is null or not c.active) then raise exception 'INVALID_FAVORITE_ARTIST'; end if;
 update public.profiles set english_level=p_english_level,german_level=p_german_level,
 peer_learning_consent=coalesce(p_peer_consent,false),
 peer_learning_consent_at=case when coalesce(p_peer_consent,false) then coalesce(peer_learning_consent_at,now()) else null end,
 peer_learning_notifications=coalesce(p_notifications,true),favorite_artists=v_artists,updated_at=now() where id=v_user;
 return jsonb_build_object('ok',true);
end; $$;

commit;
