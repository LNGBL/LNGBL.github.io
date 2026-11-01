create table if not exists public.teacher_admin_notifications (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 notification_type text not null,
 title text not null,
 message text not null default '',
 related_entity_type text,
 related_entity_id uuid,
 read_at timestamptz,
 created_at timestamptz not null default now(),
 constraint teacher_admin_notifications_type_check check (char_length(notification_type) between 1 and 60),
 constraint teacher_admin_notifications_title_check check (char_length(title) between 1 and 180),
 constraint teacher_admin_notifications_message_check check (char_length(message) <= 2000)
);
alter table public.teacher_admin_notifications enable row level security;
revoke all on public.teacher_admin_notifications from public, anon, authenticated;
grant select on public.teacher_admin_notifications to authenticated;
grant update (read_at) on public.teacher_admin_notifications to authenticated;
grant insert, select, update, delete on public.teacher_admin_notifications to service_role;
create policy teacher_admin_notifications_select_own
on public.teacher_admin_notifications for select to authenticated
using ((select auth.uid()) = user_id);
create policy teacher_admin_notifications_mark_own_read
on public.teacher_admin_notifications for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
create index if not exists teacher_admin_notifications_user_unread_idx
on public.teacher_admin_notifications(user_id, created_at desc) where read_at is null;
