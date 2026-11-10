alter table public.subscription_guardian_consents
  drop column if exists guardian_family_name;

create table if not exists public.guardian_consent_annual_reports (
  id uuid primary key default gen_random_uuid(),
  report_year integer not null unique check (report_year >= 2020),
  storage_path text not null unique,
  record_count integer not null default 0 check (record_count >= 0),
  generated_at timestamptz not null default now()
);
alter table public.guardian_consent_annual_reports enable row level security;
revoke all on public.guardian_consent_annual_reports from anon, authenticated;
grant all on public.guardian_consent_annual_reports to service_role;

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('langblue-guardian-consent-reports','langblue-guardian-consent-reports',false,20971520,array['application/pdf'])
on conflict (id) do update set public=false,file_size_limit=20971520,allowed_mime_types=excluded.allowed_mime_types;
