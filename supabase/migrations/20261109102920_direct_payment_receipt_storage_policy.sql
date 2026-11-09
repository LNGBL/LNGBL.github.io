do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'langblue_receipts_insert_own_folder'
  ) then
    create policy langblue_receipts_insert_own_folder
      on storage.objects
      for insert
      to authenticated
      with check (
        bucket_id = 'langblue-payment-receipts'
        and (storage.foldername(name))[1] = (select auth.uid())::text
      );
  end if;
end
$$;
