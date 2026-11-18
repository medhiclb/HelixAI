import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {SHARED_WORKSPACE as W} from '../lib/access.mjs';
const A='10000000-0000-4000-a000-000000000001',B='10000000-0000-4000-a000-000000000002',N='30000000-0000-4000-a000-000000000001',T='30000000-0000-4000-a000-000000000002';
async function fixture(){
 const db=new PGlite();
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create publication supabase_realtime;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;alter default privileges in schema public grant all on tables to anon,authenticated,service_role;`);
 await db.exec(await readFile(new URL('../supabase/schema.sql',import.meta.url),'utf8'));
 for(const f of (await readdir(new URL('../supabase/migrations/',import.meta.url))).filter(f=>f.endsWith('.sql')).sort()) await db.exec(await readFile(new URL('../supabase/migrations/'+f,import.meta.url),'utf8'));
 await db.exec("set role authenticated");await assert.rejects(db.query("select crm_business_backup()"),/permission denied/);await db.exec("reset role");
 await db.exec(`insert into crm_allowed_emails values('collaborateur@example.test');insert into auth.users values('${A}','medhi.clabaut@gmail.com',now()),('${B}','collaborateur@example.test',now());insert into crm_members values('${W}','${A}','medhi.clabaut@gmail.com','Medhi','admin'),('${W}','${B}','collaborateur@example.test','Collaborateur','member');set role authenticated;select set_config('request.jwt.claim.sub','${A}',false);`);
 return db;
}
const save=(db,id,data,revision,kind='notes')=>db.query('select * from public.crm_save_record($1,$2,$3,$4,$5)',[W,kind,id,JSON.stringify(data),revision]).then(r=>r.rows[0]);
test('collaboration : fusion de champs distincts, refus du même champ et suppression obsolète',async()=>{
 const db=await fixture();try{
  const original=await save(db,N,{name:'Cabinet',phone:'01'},null);
  assert.equal(original.revision,1);
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[B]);
  const samy=await save(db,N,{name:'Cabinet Samy',phone:'01',_base:original.data},1);
  assert.equal(samy.revision,2);
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[A]);
  const medhi=await save(db,N,{name:'Cabinet',phone:'02',_base:original.data},1);
  assert.deepEqual(medhi.data,{name:'Cabinet Samy',phone:'02'});assert.equal(medhi.revision,3);
  await assert.rejects(save(db,N,{name:'Cabinet Medhi',phone:'01',_base:original.data},1),/modifié/);
  await assert.rejects(db.query('select crm_delete_record($1,$2,$3,$4)',[W,'notes',N,1]),/modifiée/);
  await assert.rejects(db.query("update crm_records set data='{}' where id=$1",[N]),/permission denied/);
  await db.query('select crm_delete_record($1,$2,$3,$4)',[W,'notes',N,3]);
  assert.equal((await db.query('select * from crm_records')).rows.length,0);
 }finally{await db.close();}
});
test('débrief et relance : transaction unique et absence de doublon',async()=>{
 const db=await fixture();try{
  const task=await save(db,T,{name:'Relance initiale'},null,'tasks');
  await save(db,T,{name:'Relance changée'},task.revision,'tasks');
  const bundle=(revision)=>db.query('select crm_save_note_bundle($1,$2,$3,$4,$5,$6,$7) bundle',[W,N,JSON.stringify({name:'Débrief'}),null,T,JSON.stringify({name:'Suivi'}),revision]);
  await assert.rejects(bundle(1),/modifiée/);
  assert.equal((await db.query('select * from crm_records where entity=\'notes\'')).rows.length,0,'le débrief est annulé aussi si la relance est en conflit');
  const result=(await bundle(2)).rows[0].bundle;
  assert.equal(result.note.data.follow_up_id,T);assert.equal(result.task.data.note_id,N);
  assert.equal((await db.query('select * from crm_records')).rows.length,2);
 }finally{await db.close();}
});
test('outils équipe : historique immuable, attribution concurrente, notifications privées et secrets agenda',async()=>{
 const db=await fixture();try{
  await save(db,N,{name:'Dossier commun'},null,'cabinets');
  const log=(await db.query('select * from crm_activity')).rows;
  assert.equal(log[0].actor_id,A);assert.equal(log[0].title,'Dossier commun');
  await assert.rejects(db.query('delete from crm_activity'),/permission denied/);
  await db.exec(`reset role;insert into crm_messages(id,workspace_id,user_id,provider,external_id,internet_message_id,shared) values('${T}','${W}','${A}','google','external','<one@example.com>',true);insert into crm_calendar_accounts(workspace_id,user_id,name,kind,encrypted_credentials,calendar_url) values('${W}','${A}','Secret','ics','encrypted','https://example.com/private.ics');set role authenticated;`);
  const assigned=(await db.query('select * from crm_mail_assign($1,$2,$3,$4,$5)',[W,T,B,'in_progress',1])).rows[0];
  assert.equal(assigned.revision,2);
  await assert.rejects(db.query('select crm_mail_assign($1,$2,$3,$4,$5)',[W,T,A,'done',1]),/modifié/);
  assert.equal((await db.query('select * from crm_notifications')).rows.length,0,'les alertes de Samy ne sont pas visibles par Medhi');
  await assert.rejects(db.query('select encrypted_credentials from crm_calendar_accounts'),/permission denied/);
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[B]);
  assert.equal((await db.query('select * from crm_notifications')).rows.length,1);
  assert.equal((await db.query('select id from crm_calendar_accounts')).rows.length,0);
  await db.query('select crm_mark_notification(null)');assert.ok((await db.query('select read_at from crm_notifications')).rows[0].read_at);
 }finally{await db.close();}
});
test('rappels : échéances réelles, dédoublonnage et exclusion des tâches terminées',async()=>{
 const db=await fixture();try{
  await save(db,N,{name:'À relancer',owner:A,due_at:new Date(Date.now()+3600000).toISOString()},null,'tasks');
  await save(db,T,{name:'Déjà fait',owner:A,done:true,due_at:new Date(Date.now()+3600000).toISOString()},null,'tasks');
  await db.query('select crm_refresh_reminders($1)',[W]);await db.query('select crm_refresh_reminders($1)',[W]);
  assert.equal((await db.query('select * from crm_notifications')).rows.length,1);
 }finally{await db.close();}
});
test('agendas partagés : remplacement atomique et refus d’une génération obsolète',async()=>{
 const db=await fixture();try{
  const C='40000000-0000-4000-a000-000000000001',S='50000000-0000-4000-a000-000000000001';
  await assert.rejects(db.query('select crm_replace_external_slots($1,$2,$3)',[C,'[]',null]),/permission denied/);
  await db.exec(`reset role;insert into crm_calendar_accounts(id,workspace_id,user_id,name,kind,encrypted_credentials,calendar_url) values('${C}','${W}','${A}','Agenda','ics','encrypted','https://example.com/calendar.ics');`);
  const slots=[{id:S,external_id:'event',starts_at:'2026-11-14T10:00:00Z',ends_at:'2026-11-14T11:00:00Z',title:null}];
  await db.query('select crm_replace_external_slots($1,$2,$3)',[C,JSON.stringify(slots),null]);
  assert.equal((await db.query('select * from crm_external_slots')).rows.length,1);
  await assert.rejects(db.query('select crm_replace_external_slots($1,$2,$3)',[C,'[]',null]),/plus récente/);
  assert.equal((await db.query('select * from crm_external_slots')).rows.length,1,'les anciens créneaux survivent à un import obsolète');
 }finally{await db.close();}
});
