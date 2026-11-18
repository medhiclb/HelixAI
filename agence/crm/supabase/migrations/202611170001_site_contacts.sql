begin;
create table public.crm_site_receipts(delivery_id text primary key check(length(delivery_id)=64),result jsonb not null,created_at timestamptz not null default now());
alter table public.crm_site_receipts enable row level security;
revoke all on public.crm_site_receipts from public,anon,authenticated;
grant all on public.crm_site_receipts to service_role;
create function public.crm_receive_site_contact(delivery text,payload jsonb) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare w constant uuid := '71ce7dd5-5f52-48e0-b1c6-ae32597f6e30'; c uuid; person uuid; note uuid; task uuid; responsible uuid; result jsonb; addr text:=lower(trim(payload->>'email')); firm text:=trim(coalesce(payload->>'cabinet','')); subject text:=left(payload->>'objet_label',150);
begin
 if delivery !~ '^[a-f0-9]{64}$' or jsonb_typeof(payload)<>'object' or coalesce(length(payload->>'nom'),0) not between 1 and 120 or coalesce(length(addr),0) not between 3 and 200 or addr not like '%@%.%' or coalesce(length(payload->>'message'),0) not between 1 and 5000 or length(firm)>160 then raise exception 'Demande invalide';end if;
 perform pg_advisory_xact_lock(hashtext(w::text));
 select r.result into result from crm_site_receipts r where delivery_id=delivery;
 if result is not null then return result||'{"duplicate":true}'::jsonb;end if;
 select user_id into responsible from crm_members where workspace_id=w order by (email='medhi.clabaut@gmail.com') desc, (role='admin') desc,user_id limit 1;
 if responsible is null then raise exception 'Équipe non configurée';end if;
 select id,nullif(data->>'cabinet_id','')::uuid into person,c from crm_records where workspace_id=w and entity='contacts' and lower(trim(data->>'email'))=addr order by created_at,id limit 1;
 if c is not null and not exists(select 1 from crm_records where workspace_id=w and entity='cabinets' and id=c) then c:=null;end if;
 if c is null and firm<>'' then
  select id into c from crm_records where workspace_id=w and entity='cabinets' and lower(trim(data->>'name'))=lower(firm) order by created_at,id limit 1;
  if c is null then insert into crm_records(workspace_id,entity,data) values(w,'cabinets',jsonb_build_object('name',firm,'source','Formulaire du site','owner',responsible,'description','Taille déclarée : '||coalesce(payload->>'taille','Non renseignée'))) returning id into c;end if;
 end if;
 if person is null then insert into crm_records(workspace_id,entity,data) values(w,'contacts',jsonb_build_object('name',payload->>'nom','email',addr,'phone',left(coalesce(payload->>'telephone',''),40),'cabinet_id',c,'owner',responsible,'source','Formulaire du site')) returning id into person;
 elsif c is not null then update crm_records set data=data||jsonb_build_object('cabinet_id',c) where id=person and coalesce(data->>'cabinet_id','')='';end if;
 insert into crm_records(workspace_id,entity,data) values(w,'notes',jsonb_build_object('name','Demande site · '||subject,'cabinet_id',c,'contact_id',person,'owner',responsible,'source','Site Helix','description','Contact : '||(payload->>'nom')||E'\nEmail : '||addr||E'\nObjet : '||subject||E'\n\n'||(payload->>'message'),'site_delivery_id',delivery)) returning id into note;
 insert into crm_records(workspace_id,entity,data) values(w,'tasks',jsonb_build_object('name','Répondre à '||(payload->>'nom')||' · '||subject,'cabinet_id',c,'contact_id',person,'owner',responsible,'priority','Normale','due_at',to_char((now()+interval '1 day') at time zone 'Europe/Paris','YYYY-MM-DD"T"HH24:MI'),'description','Nouvelle demande reçue sur helix-agence.fr. Consulter le débrief associé.','note_id',note,'done',false,'site_delivery_id',delivery)) returning id into task;
 update crm_records set data=data||jsonb_build_object('follow_up_id',task) where id=note;
 insert into crm_notifications(workspace_id,user_id,title,body,record_id,dedupe_key) select w,user_id,'Nouvelle demande du site',left((payload->>'nom')||' · '||subject,220),note,'site:'||delivery from crm_members where workspace_id=w on conflict do nothing;
 result:=jsonb_build_object('contact_id',person,'cabinet_id',c,'note_id',note,'task_id',task,'duplicate',false);
 insert into crm_site_receipts values(delivery,result,now());
 return result;
end $$;
revoke all on function public.crm_receive_site_contact(text,jsonb) from public,anon,authenticated;
grant execute on function public.crm_receive_site_contact(text,jsonb) to service_role;
commit;
