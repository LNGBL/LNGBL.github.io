create table if not exists public.android_app_releases (
 id uuid primary key default gen_random_uuid(),
 version_code integer not null,
 version_name text not null,
 min_version_code integer not null default 1,
 apk_path text not null,
 apk_sha256 text,
 release_notes text not null default '',
 force_update boolean not null default false,
 published_at timestamptz not null default now(),
 created_at timestamptz not null default now()
);
create unique index if not exists android_app_releases_version_code_uidx on public.android_app_releases(version_code);
create table if not exists public.android_maintenance_windows (
 id uuid primary key default gen_random_uuid(),
 maintenance_date date not null,
 start_time time not null default '00:00',
 end_time time not null default '00:05',
 message text not null default 'LangBlue برای تعمیرات کوتاه‌مدت در دسترس نیست.',
 enabled boolean not null default true,
 created_at timestamptz not null default now()
);
create unique index if not exists android_maintenance_windows_date_uidx on public.android_maintenance_windows(maintenance_date);
create table if not exists public.android_content_items (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 item_id text not null,
 kind text not null check (kind in ('grammar','vocabulary')),
 language text not null default 'english',
 content jsonb not null default '{}'::jsonb,
 deleted_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(user_id,kind,item_id)
);
create index if not exists android_content_items_user_kind_idx on public.android_content_items(user_id,kind,updated_at desc);
alter table public.android_app_releases enable row level security;
alter table public.android_maintenance_windows enable row level security;
alter table public.android_content_items enable row level security;
revoke all on public.android_app_releases from anon, authenticated;
revoke all on public.android_maintenance_windows from anon, authenticated;
revoke all on public.android_content_items from anon, authenticated;
drop policy if exists android_app_releases_deny on public.android_app_releases;
drop policy if exists android_maintenance_windows_deny on public.android_maintenance_windows;
drop policy if exists android_content_items_deny on public.android_content_items;
create policy android_app_releases_deny on public.android_app_releases for all to anon, authenticated using (false) with check (false);
create policy android_maintenance_windows_deny on public.android_maintenance_windows for all to anon, authenticated using (false) with check (false); 
create policy android_content_items_deny on public.android_content_items for all to anon, authenticated using (false) with check (false);