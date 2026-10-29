create table if not exists public.learning_review_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  local_id text not null check (char_length(local_id) between 1 and 80),
  product_id text not null default 'other' check (product_id in ('grammar','vocabulary','deutsch','arabic','japanese','other')),
  title text not null check (char_length(title) between 1 and 180),
  prompt text not null default '' check (char_length(prompt) <= 1000),
  answer text not null default '' check (char_length(answer) <= 2000),
  created_at timestamptz not null default now(),
  due_at timestamptz not null,
  stage smallint not null default 0 check (stage between 0 and 6),
  interval_hours integer not null default 4 check (interval_hours > 0),
  attempts integer not null default 0 check (attempts >= 0),
  correct_count integer not null default 0 check (correct_count >= 0),
  misses integer not null default 0 check (misses >= 0),
  last_rating text check (last_rating in ('again','hard','good','easy')),
  last_reviewed_at timestamptz,
  unique (user_id, local_id)
);

create index if not exists learning_review_items_due_idx
  on public.learning_review_items (user_id, due_at);

alter table public.learning_review_items enable row level security;
grant select, insert, update, delete on public.learning_review_items to authenticated;
drop policy if exists learning_review_items_owner_all on public.learning_review_items;
create policy learning_review_items_owner_all
on public.learning_review_items
for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);