begin;
create table public.crm_allowed_emails (
 email text primary key check (email = lower(trim(email)))
);
alter table public.crm_allowed_emails enable row level security;
revoke all on public.crm_allowed_emails from public,anon,authenticated;
insert into public.crm_allowed_emails values ('medhi.clabaut@gmail.com');
create or replace function public.crm_email_allowed(addr text) returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from crm_allowed_emails where email=lower(trim(addr)))
$$;
create or replace function public.crm_access_allowed() returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from auth.users where id=auth.uid() and crm_email_allowed(email) and email_confirmed_at is not null)
$$;
create or replace function public.crm_is_member(w uuid) returns boolean language sql stable security definer set search_path=public as $$
 select w='71ce7dd5-5f52-48e0-b1c6-ae32597f6e30'::uuid and crm_access_allowed() and exists(select 1 from crm_members where workspace_id=w and user_id=auth.uid())
$$;
create or replace function public.crm_is_admin(w uuid) returns boolean language sql stable security definer set search_path=public as $$
 select crm_is_member(w) and exists(select 1 from crm_members where workspace_id=w and user_id=auth.uid() and role='admin')
$$;
insert into crm_workspaces(id,name) values('71ce7dd5-5f52-48e0-b1c6-ae32597f6e30','Helix') on conflict(id) do nothing;
create or replace function public.crm_join_invitations() returns void language plpgsql security definer set search_path=public as $$
declare addr text;begin
 if not crm_access_allowed() then raise exception 'Accès réservé à l’équipe Helix';end if;
 select lower(email) into addr from auth.users where id=auth.uid();
 insert into crm_members(workspace_id,user_id,email,display_name,role) values('71ce7dd5-5f52-48e0-b1c6-ae32597f6e30',auth.uid(),addr,split_part(addr,'@',1),case when addr='medhi.clabaut@gmail.com' then 'admin' else 'member' end)
 on conflict(workspace_id,user_id) do nothing;
end$$;
create or replace function public.crm_create_workspace(workspace_name text) returns uuid language plpgsql security definer set search_path=public as $$
begin
 perform crm_join_invitations();
 return '71ce7dd5-5f52-48e0-b1c6-ae32597f6e30'::uuid;
end$$;
-- Reject other registrations and changes of address at the authentication boundary.
create or replace function public.crm_guard_auth_email() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if not crm_email_allowed(new.email) then raise exception 'Accès réservé à l’équipe Helix';end if;
 return new;
end$$;
drop trigger if exists crm_guard_auth_email on auth.users;
create trigger crm_guard_auth_email before insert or update of email on auth.users for each row execute function public.crm_guard_auth_email();
-- Existing approved and verified users join the same workspace without an invitation.
insert into crm_members(workspace_id,user_id,email,display_name,role)
select '71ce7dd5-5f52-48e0-b1c6-ae32597f6e30',id,lower(email),split_part(email,'@',1),case when lower(email)='medhi.clabaut@gmail.com' then 'admin' else 'member' end from auth.users where crm_email_allowed(email) and email_confirmed_at is not null
on conflict(workspace_id,user_id) do nothing;
-- Commercial mail imported into this dedicated three-person workspace is common.
alter table crm_connections alter column share_emails set default true;
update crm_connections set share_emails=true where workspace_id='71ce7dd5-5f52-48e0-b1c6-ae32597f6e30';
update crm_messages set shared=true where workspace_id='71ce7dd5-5f52-48e0-b1c6-ae32597f6e30';
alter table crm_connections drop constraint if exists crm_team_mail_shared;
alter table crm_connections add constraint crm_team_mail_shared check(workspace_id<>'71ce7dd5-5f52-48e0-b1c6-ae32597f6e30'::uuid or share_emails);
alter table crm_messages drop constraint if exists crm_team_message_shared;
alter table crm_messages add constraint crm_team_message_shared check(workspace_id<>'71ce7dd5-5f52-48e0-b1c6-ae32597f6e30'::uuid or shared);
alter table crm_connections drop constraint if exists crm_connections_provider_check;
alter table crm_connections add constraint crm_connections_provider_check check(provider in('google','microsoft','imap'));
revoke all on function crm_guard_auth_email() from public,anon,authenticated;
revoke all on function crm_email_allowed(text) from public,anon,authenticated;
revoke all on function crm_access_allowed() from public,anon;
grant execute on function crm_email_allowed(text) to service_role;
grant execute on function crm_access_allowed() to authenticated,service_role;
commit;
