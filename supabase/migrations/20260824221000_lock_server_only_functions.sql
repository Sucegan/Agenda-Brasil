-- Supabase can preserve explicit role grants independently of PUBLIC defaults.
-- Keep every server-only maintenance function inaccessible to browser roles.

begin;

revoke all on function public.consume_api_rate_limit(text, integer, integer) from public, anon, authenticated;
revoke all on function public.claim_due_notifications(integer, uuid, integer) from public, anon, authenticated;
revoke all on function public.cleanup_operational_data() from public, anon, authenticated;

grant execute on function public.consume_api_rate_limit(text, integer, integer) to service_role;
grant execute on function public.claim_due_notifications(integer, uuid, integer) to service_role;
grant execute on function public.cleanup_operational_data() to service_role;

commit;
