-- Remove the retired Kurmancî product from the live catalog.
-- LangBlue commerce is intentionally limited to Grammar, Vocabulary and Deutsch.
begin;

update public.activation_codes
set product_ids = array_remove(product_ids, 'kurmanci')
where 'kurmanci' = any(product_ids);

delete from public.usage_sessions
where product_id = 'kurmanci';

delete from public.subscriptions
where product_id = 'kurmanci';

delete from public.products
where id = 'kurmanci';

commit;
