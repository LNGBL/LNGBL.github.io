begin;
alter table public.profiles
  add column if not exists analytics_consent boolean not null default false,
  add column if not exists analytics_consent_updated_at timestamptz;

create temporary table lb_activity_compact on commit drop as
select user_id, lower(username) as username_key, min(id) as keep_id,
       lower((array_agg(username order by last_activity_at desc))[1]) as username,
       min(registered_at) as registered_at,
       min(first_activity_at) as first_activity_at,
       max(last_activity_at) as last_activity_at,
       max(active_seconds) as active_seconds,
       bool_or(qualified_24h) as qualified_24h,
       min(qualified_at) filter (where qualified_at is not null) as qualified_at,
       (array_agg(practice_language order by (practice_language is not null) desc, last_activity_at desc))[1] as practice_language,
       (array_agg(practice_section order by (practice_section is not null) desc, last_activity_at desc))[1] as practice_section
from public.account_activity_registry
group by user_id, lower(username);

update public.account_activity_registry a
set username=c.username, registered_at=c.registered_at,
    first_activity_at=c.first_activity_at, last_activity_at=c.last_activity_at,
    active_seconds=c.active_seconds, qualified_24h=c.qualified_24h,
    qualified_at=c.qualified_at, practice_language=c.practice_language,
    practice_section=c.practice_section, updated_at=now()
from lb_activity_compact c where a.id=c.keep_id;

delete from public.account_activity_registry a
using lb_activity_compact c
where a.user_id=c.user_id and lower(a.username)=c.username_key and a.id<>c.keep_id;

alter table public.account_activity_registry
  drop constraint if exists account_activity_registry_user_username_ip_uq;
alter table public.account_activity_registry drop column if exists ip_address;
create unique index if not exists account_activity_registry_user_username_uq
  on public.account_activity_registry (user_id, lower(username));
commit;
