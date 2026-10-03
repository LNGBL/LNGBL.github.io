begin;

insert into public.products (id,label,active)
values ('langjp','LangBlue Japanese',true)
on conflict (id) do update set label=excluded.label,active=true;

insert into public.plans(id,label,days,months,price_irt,active)
values ('trial_4d','۴ روز آزمایشی',4,null,0,true)
on conflict (id) do update set label=excluded.label,days=4,months=null,price_irt=0,active=true;

update public.subscriptions
set plan_id='trial_4d',
    product_ids=array['grammar','vocabulary','deutsch','arabic','langjp'],
    expires_at=greatest(expires_at,starts_at+interval '4 days'),
    updated_at=now()
where plan_id='trial_48h';

update public.profiles
set trial_expires_at=case when trial_started_at is null then null else trial_started_at+interval '4 days' end,
    updated_at=now()
where trial_started_at is not null;

update public.plans set active=false where id='trial_48h';

update public.plans set price_irt=case id
  when 'irt_7d' then 150999
  when 'irt_14d' then 313999
  when 'irt_21d' then 506999
  when 'irt_3m' then 784999
  when 'irt_6m' then 880999
  when 'irt_12m' then 1000999
  else price_irt end
where id in ('irt_7d','irt_14d','irt_21d','irt_3m','irt_6m','irt_12m');

create or replace function public.grant_4d_trial(p_user_id uuid) returns void
language plpgsql security definer set search_path=public as $$
declare v_start timestamptz; v_exp timestamptz;
begin
  select trial_started_at,trial_expires_at into v_start,v_exp
  from public.profiles where id=p_user_id for update;
  if not found then raise exception 'PROFILE_NOT_FOUND'; end if;
  if v_start is null then
    v_start=now(); v_exp=v_start+interval '4 days';
    update public.profiles set trial_started_at=v_start,trial_expires_at=v_exp,updated_at=now() where id=p_user_id;
    insert into public.subscriptions(user_id,plan_id,product_ids,status,starts_at,expires_at)
    values(p_user_id,'trial_4d',array['grammar','vocabulary','deutsch','arabic','langjp'],'active',v_start,v_exp);
  end if;
end; $$;

revoke execute on function public.grant_4d_trial(uuid) from public,anon,authenticated;
grant execute on function public.grant_4d_trial(uuid) to service_role;
revoke execute on function public.grant_48h_trial(uuid) from public,anon,authenticated;
drop function if exists public.grant_48h_trial(uuid);

commit;
