-- Align the source-controlled catalog with the live pricing model.
-- 7d is the base plan at 220,000 Toman; longer plans reduce effective monthly cost.
begin;

update public.plans set price_irt = case id
  when 'irt_7d' then 220000
  when 'irt_14d' then 330000
  when 'irt_21d' then 440000
  when 'irt_3m' then 770000
  when 'irt_6m' then 990000
  when 'irt_12m' then 1320000
  else price_irt
end
where id in ('irt_7d','irt_14d','irt_21d','irt_3m','irt_6m','irt_12m');

update public.activation_codes
set product_ids = array_remove(product_ids, 'kurmanci')
where 'kurmanci' = any(product_ids);

delete from public.usage_sessions where product_id = 'kurmanci';
delete from public.subscriptions where 'kurmanci' = any(product_ids);
delete from public.products where id = 'kurmanci';

commit;
