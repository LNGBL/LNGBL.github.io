drop table if exists langblue_internal.admin_workflow_events;
create index if not exists admin_workflow_events_actor_idx on public.admin_workflow_events(actor_user_id);
create index if not exists teacher_profiles_reviewed_by_idx on public.teacher_profiles(reviewed_by) where reviewed_by is not null;
create index if not exists teacher_class_offers_reviewed_by_idx on public.teacher_class_offers(reviewed_by) where reviewed_by is not null;
create index if not exists teacher_content_reviewed_by_idx on public.teacher_content(reviewed_by) where reviewed_by is not null;
create index if not exists content_contributions_reviewed_by_idx on public.content_contributions(reviewed_by) where reviewed_by is not null;
