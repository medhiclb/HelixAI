-- Apply once in a dedicated Supabase project. Never reuse the ERP production database.
create table public.crm_workspaces(id uuid primary key default gen_random_uuid(),name text not null,created_at timestamptz not null default now());
create table public.crm_members(workspace_id uuid references public.crm_workspaces on delete cascade,user_id uuid references auth.users on delete cascade,email text not null,display_name text not null,role text not null default 'member' check(role in('admin','member')),primary key(workspace_id,user_id));
create table public.crm_invites(workspace_id uuid references public.crm_workspaces on delete cascade,email text not null,created_at timestamptz default now(),primary key(workspace_id,email));
create table public.crm_records(id uuid primary key default gen_random_uuid(),workspace_id uuid not null references public.crm_workspaces on delete cascade,entity text not null check(entity in('cabinets','contacts','opportunities','tasks','meetings','events','notes')),data jsonb not null default '{}',created_at timestamptz not null default now());
create index on public.crm_records(workspace_id,entity);
create table public.crm_connections(id uuid primary key default gen_random_uuid(),workspace_id uuid not null references public.crm_workspaces on delete cascade,user_id uuid not null references auth.users on delete cascade,provider text not null check(provider in('google','microsoft')),email text not null,encrypted_tokens text not null,last_sync_at timestamptz,unique(workspace_id,user_id,provider));
create table public.crm_oauth_states(state text primary key,workspace_id uuid not null,user_id uuid not null,provider text not null,expires_at timestamptz not null);
create table public.crm_messages(id uuid primary key default gen_random_uuid(),workspace_id uuid not null references public.crm_workspaces on delete cascade,user_id uuid not null,provider text not null,external_id text not null,cabinet_id uuid references public.crm_records on delete set null,subject text,sender text,sent_at timestamptz,snippet text,unique(workspace_id,user_id,provider,external_id));
create or replace function public.crm_is_member(w uuid) returns boolean language sql stable security definer set search_path=public as $$select exists(select 1 from crm_members where workspace_id=w and user_id=auth.uid())$$;
create or replace function public.crm_is_admin(w uuid) returns boolean language sql stable security definer set search_path=public as $$select exists(select 1 from crm_members where workspace_id=w and user_id=auth.uid() and role='admin')$$;
alter table public.crm_workspaces enable row level security;
alter table public.crm_members enable row level security;
alter table public.crm_invites enable row level security;
alter table public.crm_records enable row level security;
alter table public.crm_connections enable row level security;
alter table public.crm_oauth_states enable row level security;
alter table public.crm_messages enable row level security;
create policy workspace_read on public.crm_workspaces for select to authenticated using(public.crm_is_member(id));
create policy members_read on public.crm_members for select to authenticated using(public.crm_is_member(workspace_id));
create policy records_read on public.crm_records for select to authenticated using(public.crm_is_member(workspace_id));
create policy records_insert on public.crm_records for insert to authenticated with check(public.crm_is_member(workspace_id));
create policy records_update on public.crm_records for update to authenticated using(public.crm_is_member(workspace_id)) with check(public.crm_is_member(workspace_id));
create policy records_delete on public.crm_records for delete to authenticated using(public.crm_is_member(workspace_id));
create policy connections_read on public.crm_connections for select to authenticated using(public.crm_is_member(workspace_id) and user_id=auth.uid());
-- Token ciphertext is never exposed to browser users, even for their own connection.
revoke all on public.crm_connections from anon,authenticated;
grant select(id,workspace_id,user_id,provider,email,last_sync_at) on public.crm_connections to authenticated;
create policy messages_read on public.crm_messages for select to authenticated using(public.crm_is_member(workspace_id));
create or replace function public.crm_create_workspace(workspace_name text) returns uuid language plpgsql security definer set search_path=public as $$declare w uuid; addr text;begin
 if auth.uid() is null then raise exception 'Authentication required';end if;
 select email into addr from auth.users where id=auth.uid();
 select workspace_id into w from crm_members where user_id=auth.uid() limit 1;
 if w is not null then return w;end if;
 select workspace_id into w from crm_invites where email=lower(addr) order by created_at limit 1;
 if w is not null then
 insert into crm_members values(w,auth.uid(),addr,split_part(addr,'@',1),'member');
 delete from crm_invites where workspace_id=w and email=lower(addr);
 return w;
 end if;
 insert into crm_workspaces(name) values(left(workspace_name,100)) returning id into w;
 insert into crm_members values(w,auth.uid(),addr,split_part(addr,'@',1),'admin');return w;end$$;
revoke all on function public.crm_create_workspace(text) from public,anon;
grant execute on function public.crm_create_workspace(text) to authenticated;
alter publication supabase_realtime add table public.crm_records;
