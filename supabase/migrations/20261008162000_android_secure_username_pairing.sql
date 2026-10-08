alter table public.android_pairings add column if not exists pair_code_hash text;
create index if not exists android_pairings_user_status_created_idx
  on public.android_pairings(user_id,status,created_at desc);
