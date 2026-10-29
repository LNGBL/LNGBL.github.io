drop policy if exists teacher_content_select_own on public.teacher_content;
drop policy if exists teacher_content_select_published on public.teacher_content;

create policy teacher_content_select_public_published
on public.teacher_content
for select
to anon
using (status = 'published');

create policy teacher_content_select_authenticated
on public.teacher_content
for select
to authenticated
using (
  (select auth.uid()) = teacher_id
  or status = 'published'
);