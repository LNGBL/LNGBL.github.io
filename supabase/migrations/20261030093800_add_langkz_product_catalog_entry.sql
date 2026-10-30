insert into public.products (id, label, active)
values ('langkz', 'LangBlue Kazakh', true)
on conflict (id) do update
set label = excluded.label,
    active = true;
