-- Remove public execution from internal SECURITY DEFINER helpers.
revoke execute on function public.handle_new_user() from public;
revoke execute on function public.rls_auto_enable() from public;