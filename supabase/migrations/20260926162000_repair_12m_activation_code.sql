-- Repair the legacy 12-month activation-code row that referenced a non-existent plan.
update public.activation_codes
set plan_id = 'irt_12m'
where id = 6
  and plan_id = 'irt_12d';
