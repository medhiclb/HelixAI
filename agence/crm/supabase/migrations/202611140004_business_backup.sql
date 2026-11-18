begin;
create or replace function public.crm_business_backup() returns jsonb language sql security definer set search_path=public as $$
 select jsonb_build_object(
'crm_workspaces',coalesce((select jsonb_agg(to_jsonb(t)) from public.crm_workspaces t),'[]'::jsonb),
'crm_members',coalesce((select jsonb_agg(to_jsonb(t)) from public.crm_members t),'[]'::jsonb),
'crm_records',coalesce((select jsonb_agg(to_jsonb(t)) from public.crm_records t),'[]'::jsonb),
'crm_connections',coalesce((select jsonb_agg(to_jsonb(t)) from public.crm_connections t),'[]'::jsonb),
'crm_invites',coalesce((select jsonb_agg(to_jsonb(t)) from public.crm_invites t),'[]'::jsonb),
'crm_oauth_states',coalesce((select jsonb_agg(to_jsonb(t)) from public.crm_oauth_states t),'[]'::jsonb),
'crm_messages',coalesce((select jsonb_agg(to_jsonb(t)) from public.crm_messages t),'[]'::jsonb),
'crm_busy_slots',coalesce((select jsonb_agg(to_jsonb(t)) from public.crm_busy_slots t),'[]'::jsonb),
'crm_outbox',coalesce((select jsonb_agg(to_jsonb(t)) from public.crm_outbox t),'[]'::jsonb),
'crm_login_limits',coalesce((select jsonb_agg(to_jsonb(t)) from public.crm_login_limits t),'[]'::jsonb),
'_auth_identities',coalesce((select jsonb_agg(jsonb_build_object('id',id,'email',email,'email_confirmed_at',email_confirmed_at)) from auth.users where id in(select user_id from public.crm_members)),'[]'::jsonb)
);
$$;
revoke all on function public.crm_business_backup() from public,anon,authenticated;
grant execute on function public.crm_business_backup() to service_role;
commit;
