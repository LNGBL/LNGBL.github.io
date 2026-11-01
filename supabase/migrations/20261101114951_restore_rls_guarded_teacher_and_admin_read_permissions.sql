-- Restore SQL privileges required by the existing RLS policies.
-- RLS remains enabled and continues to restrict rows and allowed status transitions.
GRANT SELECT, INSERT, UPDATE ON TABLE public.teacher_class_offers TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.teacher_content TO authenticated;

-- This control table remains inaccessible to anon/authenticated.
-- Only the server-side admin Edge Function receives read access.
GRANT SELECT ON TABLE public.langblue_maintenance_control TO service_role;
