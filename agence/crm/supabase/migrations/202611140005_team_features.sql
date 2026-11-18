begin;
create table public.crm_activity(id uuid primary key default gen_random_uuid(),workspace_id uuid not null references crm_workspaces(id),actor_id uuid,action text not null,record_id uuid,entity text,title text,details jsonb not null default '{}',created_at timestamptz not null default now());
create index on crm_activity(workspace_id,created_at desc);
create function crm_record_activity() returns trigger language plpgsql security definer set search_path=public as $$
declare r crm_records; delta jsonb; who uuid;
begin
 if TG_OP='DELETE' then r:=old;else r:=new;end if;
 who:=auth.uid();
 if TG_OP='UPDATE' then select coalesce(jsonb_object_agg(k,jsonb_build_object('before',old.data->k,'after',new.data->k)),'{}') into delta from (select jsonb_object_keys(old.data || new.data) k) x where old.data->k is distinct from new.data->k and k not in ('sync_generation','remote_etag','_base','_revision');if delta='{}' then return new;end if;else delta:='{}';end if;
 insert into crm_activity(workspace_id,actor_id,action,record_id,entity,title,details) values(r.workspace_id,who,lower(TG_OP),r.id,r.entity,coalesce(r.data->>'name',r.data->>'subject','Fiche'),delta);
 if TG_OP='DELETE' then return old;else return new;end if;
end $$;
create trigger crm_activity_record after insert or update or delete on crm_records for each row execute function crm_record_activity();
create table public.crm_files(id uuid primary key default gen_random_uuid(),workspace_id uuid not null references crm_workspaces(id),record_id uuid references crm_records(id) on delete set null,name text not null check(length(name) between 1 and 180),size bigint not null check(size between 1 and 10485760),mime text not null,path text not null unique,created_by uuid not null,created_at timestamptz not null default now(),status text not null default 'pending' check(status in ('pending','ready','deleted')),deleted_at timestamptz);
create table public.crm_notifications(id uuid primary key default gen_random_uuid(),workspace_id uuid not null references crm_workspaces(id),user_id uuid not null,title text not null,body text not null default '',record_id uuid,created_at timestamptz not null default now(),read_at timestamptz,dedupe_key text not null,unique(workspace_id,user_id,dedupe_key));
create index on crm_notifications(workspace_id,user_id,created_at desc);
create table public.crm_mail_work(workspace_id uuid not null references crm_workspaces(id),message_key text not null,assigned_to uuid,status text not null default 'new' check(status in('new','in_progress','done')),revision bigint not null default 1,updated_by uuid,updated_at timestamptz not null default now(),primary key(workspace_id,message_key));
alter table crm_messages add column collaboration_key text generated always as (md5(coalesce(nullif(trim(internet_message_id),''),provider||':'||user_id::text||':'||external_id))) stored;
create table public.crm_mail_reads(workspace_id uuid not null references crm_workspaces(id),message_key text not null,user_id uuid not null,read_at timestamptz not null default now(),primary key(workspace_id,message_key,user_id));
create table public.crm_calendar_accounts(id uuid primary key default gen_random_uuid(),workspace_id uuid not null references crm_workspaces(id),user_id uuid not null,name text not null,kind text not null check(kind in('caldav','ics')),encrypted_credentials text not null,calendar_url text not null,share_details boolean not null default false,last_sync_at timestamptz,last_error text,created_at timestamptz not null default now());
create table public.crm_external_slots(id uuid primary key default gen_random_uuid(),workspace_id uuid not null references crm_workspaces(id),account_id uuid not null references crm_calendar_accounts(id) on delete cascade,user_id uuid not null,external_id text not null,starts_at timestamptz not null,ends_at timestamptz not null,title text,unique(account_id,external_id));
do $$declare t text;begin foreach t in array array['crm_activity','crm_files','crm_notifications','crm_mail_work','crm_mail_reads','crm_calendar_accounts','crm_external_slots'] loop execute format('alter table %I enable row level security',t);execute format('revoke all on %I from anon, authenticated',t);execute format('grant all on %I to service_role',t);end loop;end $$;
grant select on crm_activity,crm_files,crm_notifications,crm_mail_work,crm_mail_reads,crm_external_slots to authenticated;
grant select(id,workspace_id,user_id,name,kind,share_details,last_sync_at,last_error,created_at) on crm_calendar_accounts to authenticated;
create policy team_read on crm_activity for select to authenticated using(crm_is_member(workspace_id));
create policy team_read on crm_files for select to authenticated using(crm_is_member(workspace_id) and status='ready');
create policy own_read on crm_notifications for select to authenticated using(crm_is_member(workspace_id) and user_id=auth.uid());
create policy team_read on crm_mail_work for select to authenticated using(crm_is_member(workspace_id));
create policy own_read on crm_mail_reads for select to authenticated using(crm_is_member(workspace_id) and user_id=auth.uid());
create policy own_read on crm_calendar_accounts for select to authenticated using(crm_is_member(workspace_id) and user_id=auth.uid());
create policy team_read on crm_external_slots for select to authenticated using(crm_is_member(workspace_id));
create function crm_mail_assign(w uuid,m uuid,assignee uuid,new_status text,expected bigint) returns crm_mail_work language plpgsql security definer set search_path=public as $$
declare k text;r crm_mail_work;
begin
 if not crm_is_member(w) then raise exception 'Accès refusé';end if;
 select collaboration_key into k from crm_messages where id=m and workspace_id=w and (shared or user_id=auth.uid());if k is null then raise exception 'Message introuvable';end if;
 if assignee is not null and not exists(select 1 from crm_members where workspace_id=w and user_id=assignee) then raise exception 'Collaborateur invalide';end if;
 insert into crm_mail_work(workspace_id,message_key) values(w,k) on conflict do nothing;
 select * into r from crm_mail_work where workspace_id=w and message_key=k for update;
 if r.revision is distinct from expected then raise exception 'Ce message a été modifié. Actualisez avant de réessayer.';end if;
 update crm_mail_work set assigned_to=assignee,status=new_status,revision=revision+1,updated_by=auth.uid(),updated_at=now() where workspace_id=w and message_key=k returning * into r;
 insert into crm_activity(workspace_id,actor_id,action,entity,title,details) values(w,auth.uid(),'mail_assignment','mail','Traitement d’un message',jsonb_build_object('status',new_status,'assigned_to',assignee));
 if assignee is not null and assignee<>auth.uid() then insert into crm_notifications(workspace_id,user_id,title,body,dedupe_key) values(w,assignee,'Un message vous est attribué','Consultez la boîte commune.','mail:'||k||':'||r.revision) on conflict do nothing;end if;
 return r;
end $$;
revoke all on function crm_mail_assign(uuid,uuid,uuid,text,bigint) from public,anon;
grant execute on function crm_mail_assign(uuid,uuid,uuid,text,bigint) to authenticated;
create function crm_refresh_reminders(w uuid) returns void language plpgsql security definer set search_path=public as $$
declare r record;d timestamptz;
begin
 if not crm_is_member(w) then raise exception 'Accès refusé';end if;
 delete from crm_notifications n where n.workspace_id=w and n.user_id=auth.uid() and n.record_id is not null and (not exists(select 1 from crm_records x where x.id=n.record_id) or exists(select 1 from crm_records x where x.id=n.record_id and (x.data->>'done'='true' or x.data->>'status' in('Annulé','Réalisé','Terminé','Terminée'))));
 for r in select id,data,entity from crm_records where workspace_id=w and entity in('tasks','meetings') loop
 begin d:=coalesce(r.data->>'due_at',r.data->>'starts_at')::timestamptz;exception when others then continue;end;
 if coalesce(r.data->>'done','false')<>'true' and d between now()-interval '1 day' and now()+interval '1 day' and coalesce(r.data->>'status','') not in('Terminé','Terminée','Fait','Annulé','Réalisé') then
 insert into crm_notifications(workspace_id,user_id,title,body,record_id,dedupe_key) select w,user_id,case when r.entity='tasks' then 'Relance à prévoir' else 'Rendez-vous à venir' end,coalesce(r.data->>'name','Échéance'),r.id,r.id::text||':'||d::text from crm_members where workspace_id=w and (user_id::text=r.data->>'owner' or coalesce(r.data->>'owner','')='') on conflict do nothing;
 end if;
 end loop;
end $$;
revoke all on function crm_refresh_reminders(uuid) from public,anon;
grant execute on function crm_refresh_reminders(uuid) to authenticated;
create function crm_mark_notification(n uuid) returns void language sql security definer set search_path=public as $$update crm_notifications set read_at=now() where user_id=auth.uid() and crm_is_member(workspace_id) and (id=n or n is null)$$;
revoke all on function crm_mark_notification(uuid) from public,anon;
grant execute on function crm_mark_notification(uuid) to authenticated;
commit;
begin;
create function crm_replace_external_slots(account uuid,slots jsonb,expected_sync timestamptz default null) returns void language plpgsql security definer set search_path=public as $$
begin
 perform 1 from crm_calendar_accounts where id=account for update;if not found then raise exception 'Agenda absent';end if;
 if (select last_sync_at from crm_calendar_accounts where id=account) is distinct from expected_sync then raise exception 'Une synchronisation plus récente existe. Actualisez.';end if;
 if jsonb_typeof(slots)<>'array' or jsonb_array_length(slots)>3000 then raise exception 'Créneaux invalides';end if;
 delete from crm_external_slots where account_id=account;
 insert into crm_external_slots(id,workspace_id,account_id,user_id,external_id,starts_at,ends_at,title) select s.id,a.workspace_id,a.id,a.user_id,s.external_id,s.starts_at,s.ends_at,s.title from jsonb_to_recordset(slots) as s(id uuid,external_id text,starts_at timestamptz,ends_at timestamptz,title text) join crm_calendar_accounts a on a.id=account;
 update crm_calendar_accounts set last_sync_at=now(),last_error=null where id=account;
end $$;
revoke all on function crm_replace_external_slots(uuid,jsonb,timestamptz) from public,anon,authenticated;
grant execute on function crm_replace_external_slots(uuid,jsonb,timestamptz) to service_role;
commit;
