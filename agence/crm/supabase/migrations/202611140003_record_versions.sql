begin;
alter table public.crm_records add column if not exists revision bigint not null default 1;
create or replace function public.crm_increment_record_revision() returns trigger language plpgsql set search_path=public as $$
begin new.revision=old.revision+1;return new;end$$;
drop trigger if exists crm_record_revision on public.crm_records;
create trigger crm_record_revision before update on public.crm_records for each row execute function public.crm_increment_record_revision();
create or replace function public.crm_save_record(w uuid,kind text,record_id uuid,payload jsonb,expected_revision bigint default null) returns public.crm_records language plpgsql security definer set search_path=public as $$
declare result public.crm_records; current_row public.crm_records; clean jsonb; base jsonb; merged jsonb; k text;begin
 if not public.crm_is_member(w) then raise exception 'Accès refusé' using errcode='42501';end if;
 clean:=payload-'_revision'-'_base';
 if expected_revision is null then
  begin
   insert into public.crm_records(id,workspace_id,entity,data) values(record_id,w,kind,clean) returning * into result;
  exception when unique_violation then
   raise exception 'Cette fiche existe déjà ou a été modifiée. Rechargez les données avant de réessayer.' using errcode='P0001';
  end;
 else
  select * into current_row from public.crm_records where id=record_id and workspace_id=w and entity=kind for update;
  if not found then raise exception 'Cette fiche a été supprimée. Rechargez les données.' using errcode='P0001';end if;
  if current_row.revision<>expected_revision then
   base:=payload->'_base';
   if jsonb_typeof(base) is distinct from 'object' then raise exception 'Cette fiche a été modifiée. Rechargez la dernière version.' using errcode='P0001';end if;
   merged:=current_row.data;
   for k in select jsonb_object_keys(base||clean) loop
    if k in ('id','created_at','_base','_revision') then continue;end if;
    if (clean->k) is distinct from (base->k) or (clean?k)<>(base?k) then
     if ((current_row.data->k) is distinct from (base->k) or (current_row.data?k)<>(base?k))
       and ((current_row.data->k) is distinct from (clean->k) or (current_row.data?k)<>(clean?k)) then
      raise exception 'Le champ « % » a été modifié par un autre membre. Votre saisie reste dans le formulaire ; rechargez la fiche pour comparer.',k using errcode='P0001';
     end if;
     if clean?k then merged:=merged||jsonb_build_object(k,clean->k);else merged:=merged-k;end if;
    end if;
   end loop;
   clean:=merged;
  end if;
  update public.crm_records set data=clean where id=record_id and workspace_id=w and entity=kind returning * into result;
 end if;
 return result;
end$$;
create or replace function public.crm_delete_record(w uuid,kind text,record_id uuid,expected_revision bigint) returns void language plpgsql security definer set search_path=public as $$
begin
 if not public.crm_is_member(w) then raise exception 'Accès refusé' using errcode='42501';end if;
 delete from public.crm_records where id=record_id and workspace_id=w and entity=kind and revision=expected_revision;
 if not found then raise exception 'Cette fiche a été modifiée ou supprimée. Rechargez avant de confirmer sa suppression.' using errcode='P0001';end if;
end$$;
revoke insert,update,delete on public.crm_records from public,anon,authenticated;
revoke all on function public.crm_save_record(uuid,text,uuid,jsonb,bigint),public.crm_delete_record(uuid,text,uuid,bigint) from public,anon;
grant execute on function public.crm_save_record(uuid,text,uuid,jsonb,bigint),public.crm_delete_record(uuid,text,uuid,bigint) to authenticated,service_role;
create or replace function public.crm_save_note_bundle(w uuid,note_id uuid,note_payload jsonb,note_revision bigint,task_id uuid,task_payload jsonb,task_revision bigint) returns jsonb language plpgsql security definer set search_path=public as $$
declare note public.crm_records; task public.crm_records;begin
 if not public.crm_is_member(w) then raise exception 'Accès refusé' using errcode='42501';end if;
 note:=public.crm_save_record(w,'notes',note_id,(note_payload-'_revision')||jsonb_build_object('follow_up_id',task_id),note_revision);
 task:=public.crm_save_record(w,'tasks',task_id,(task_payload-'_revision')||jsonb_build_object('note_id',note_id),task_revision);
 return jsonb_build_object('note',to_jsonb(note),'task',to_jsonb(task));
end$$;
revoke all on function public.crm_save_note_bundle(uuid,uuid,jsonb,bigint,uuid,jsonb,bigint) from public,anon;
grant execute on function public.crm_save_note_bundle(uuid,uuid,jsonb,bigint,uuid,jsonb,bigint) to authenticated,service_role;
do $$begin
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='crm_members') then alter publication supabase_realtime add table public.crm_members;end if;
end$$;
commit;
