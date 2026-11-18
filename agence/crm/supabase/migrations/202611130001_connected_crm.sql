begin;
alter table public.crm_connections add column if not exists calendar_id text not null default 'primary';
alter table public.crm_connections add column if not exists share_emails boolean not null default false;
alter table public.crm_connections add column if not exists sync_state jsonb not null default '{}';
alter table public.crm_connections add column if not exists sync_error text;
alter table public.crm_connections add column if not exists sync_locked_until timestamptz;
alter table public.crm_connections add column if not exists sync_lock_id uuid;
alter table public.crm_connections add column if not exists capabilities jsonb not null default '{}';
alter table public.crm_connections add column if not exists next_sync_at timestamptz not null default now();
alter table public.crm_oauth_states add column if not exists verifier text;
alter table public.crm_invites add column if not exists expires_at timestamptz not null default now() + interval '7 days';
alter table public.crm_messages add column if not exists recipients text[] not null default '{}';
alter table public.crm_messages add column if not exists direction text not null default 'received';
alter table public.crm_messages add column if not exists body_text text;
alter table public.crm_messages add column if not exists thread_id text;
alter table public.crm_messages add column if not exists internet_message_id text;
alter table public.crm_messages add column if not exists shared boolean not null default false;
alter table public.crm_messages add column if not exists deleted boolean not null default false;
-- Legacy imports were shared by the first version. New imports are private by default.
drop policy if exists messages_read on public.crm_messages;
create policy messages_read on public.crm_messages for select to authenticated using(public.crm_is_member(workspace_id) and (user_id=auth.uid() or shared));
revoke all on public.crm_connections from authenticated;
grant select(id,workspace_id,user_id,provider,email,last_sync_at,calendar_id,share_emails,sync_error,capabilities,next_sync_at) on public.crm_connections to authenticated;

-- Personal event details never enter this table: only availability slots.
create table if not exists public.crm_busy_slots(
 id uuid primary key,workspace_id uuid not null references public.crm_workspaces on delete cascade,
 user_id uuid not null references auth.users on delete cascade,connection_id uuid not null references public.crm_connections on delete cascade,
 external_id text not null,starts_at timestamptz not null,ends_at timestamptz not null,
 generation text not null,unique(connection_id,external_id),check(ends_at>starts_at)
);
create index if not exists crm_busy_window on public.crm_busy_slots(workspace_id,starts_at,ends_at);
alter table public.crm_busy_slots enable row level security;
create policy busy_read on public.crm_busy_slots for select to authenticated using(public.crm_is_member(workspace_id));
create table if not exists public.crm_outbox(
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.crm_workspaces on delete cascade,
 user_id uuid not null references auth.users on delete cascade,request_key uuid not null,
 kind text not null check(kind in('mail','calendar')),status text not null default 'pending',
 result jsonb,error text,created_at timestamptz not null default now(),unique(user_id,request_key)
);
alter table public.crm_outbox enable row level security;
-- Only service code creates/updates operations. Browser can inspect its own outcomes.
create policy outbox_read on public.crm_outbox for select to authenticated using(user_id=auth.uid() and public.crm_is_member(workspace_id));
create policy invites_admin_read on public.crm_invites for select to authenticated using(public.crm_is_admin(workspace_id));

create or replace function public.crm_join_invitations() returns void language plpgsql security definer set search_path=public as $$
declare addr text;begin
 if auth.uid() is null then raise exception 'Authentication required';end if;
 select lower(email) into addr from auth.users where id=auth.uid();
 insert into crm_members(workspace_id,user_id,email,display_name,role)
 select workspace_id,auth.uid(),addr,split_part(addr,'@',1),'member' from crm_invites where email=addr and expires_at>now()
 on conflict(workspace_id,user_id) do nothing;
 delete from crm_invites where email=addr and expires_at>now();
end$$;
revoke all on function public.crm_join_invitations() from public,anon;
grant execute on function public.crm_join_invitations() to authenticated;

create or replace function public.crm_claim_sync(c uuid,lock_id uuid) returns boolean language plpgsql security definer set search_path=public as $$
begin
 update crm_connections set sync_locked_until=now()+interval '110 seconds',sync_lock_id=lock_id
 where id=c and (sync_locked_until is null or sync_locked_until<now());
 return found;
end$$;
revoke all on function public.crm_claim_sync(uuid,uuid) from public,anon,authenticated;
grant execute on function public.crm_claim_sync(uuid,uuid) to service_role;

do $$ begin
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename='crm_busy_slots') then
 alter publication supabase_realtime add table public.crm_busy_slots;
 end if;
end $$;
commit;

-- Use only valid invitations, including when this RPC is called directly.
create or replace function public.crm_create_workspace(workspace_name text) returns uuid language plpgsql security definer set search_path=public as $$
declare w uuid; addr text;begin
 if auth.uid() is null then raise exception 'Authentication required';end if;
 perform crm_join_invitations();
 select workspace_id into w from crm_members where user_id=auth.uid() limit 1;
 if w is not null then return w;end if;
 select email into addr from auth.users where id=auth.uid();
 insert into crm_workspaces(name) values(left(workspace_name,100)) returning id into w;
 insert into crm_members values(w,auth.uid(),addr,split_part(addr,'@',1),'admin');
 return w;
end$$;
revoke all on function public.crm_create_workspace(text) from public,anon;
grant execute on function public.crm_create_workspace(text) to authenticated;

-- Serialize preference changes with imports so revoking sharing cannot race a sync.
create or replace function public.crm_set_connection_settings(c uuid,calendar text,share boolean) returns void language plpgsql security definer set search_path=public as $$
declare account crm_connections%rowtype;begin
 select * into account from crm_connections where id=c for update;
 if not found then raise exception 'Compte introuvable';end if;
 if account.sync_locked_until>now() then raise exception 'Synchronisation en cours. Réessayez après son terme.';end if;
 if account.calendar_id<>calendar then
  delete from crm_busy_slots where connection_id=c;
  update crm_records set data=(data-'external_id'-'connection_id'-'calendar_id')||'{"calendar_linked":false,"status":"Annulé"}'::jsonb
  where workspace_id=account.workspace_id and entity='meetings' and data->>'connection_id'=c::text;
 end if;
 update crm_messages set shared=share where workspace_id=account.workspace_id and user_id=account.user_id and provider=account.provider;
 update crm_connections set calendar_id=calendar,share_emails=share,sync_state=case when calendar_id<>calendar then '{}'::jsonb else sync_state end,next_sync_at=now() where id=c;
end$$;
create or replace function public.crm_disconnect_connection(c uuid) returns void language plpgsql security definer set search_path=public as $$
declare account crm_connections%rowtype;begin
 select * into account from crm_connections where id=c for update;
 if not found then return;end if;
 if account.sync_locked_until>now() then raise exception 'Synchronisation en cours. Réessayez après son terme.';end if;
 update crm_records set data=(data-'external_id'-'connection_id'-'calendar_id')||'{"calendar_linked":false,"calendar_dirty":false}'::jsonb
 where workspace_id=account.workspace_id and entity='meetings' and data->>'connection_id'=c::text;
 delete from crm_connections where id=c;
end$$;
revoke all on function public.crm_set_connection_settings(uuid,text,boolean) from public,anon,authenticated;
revoke all on function public.crm_disconnect_connection(uuid) from public,anon,authenticated;
grant execute on function public.crm_set_connection_settings(uuid,text,boolean) to service_role;
grant execute on function public.crm_disconnect_connection(uuid) to service_role;
