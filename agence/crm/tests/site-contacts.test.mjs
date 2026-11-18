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
test('formulaire site : transaction, dédoublonnage, contact réutilisé et notifications',async()=>{
 const db=await fixture();try{
 await db.exec('reset role;set role anon');await assert.rejects(db.query("select crm_receive_site_contact($1,$2)",['a'.repeat(64),'{}']),/permission denied/);
 await db.exec('reset role;set role service_role');
 const p={nom:'Jeanne Martin',email:'jeanne@example.com',cabinet:'Martin',message:'Une démonstration',objet_label:'Démonstration'};
 const call=(key,payload=p)=>db.query('select crm_receive_site_contact($1,$2) result',[key.repeat(64),JSON.stringify(payload)]).then(r=>r.rows[0].result);
 const a=await call('a');assert.equal(a.duplicate,false);
 const again=await call('a');assert.equal(again.duplicate,true);assert.equal(a.note_id,again.note_id);
 const b=await call('b',{...p,message:'Autre question'});assert.equal(a.contact_id,b.contact_id);assert.equal(a.cabinet_id,b.cabinet_id);
 const counts=(await db.query("select entity,count(*)::int n from crm_records group by entity")).rows;
 assert.deepEqual(Object.fromEntries(counts.map(x=>[x.entity,x.n])),{cabinets:1,contacts:1,notes:2,tasks:2});
 assert.equal((await db.query('select * from crm_notifications')).rows.length,4);
 await assert.rejects(call('c',{...p,message:''}),/invalide/);
 assert.equal((await db.query('select * from crm_site_receipts')).rows.length,2);
 const task=(await db.query('select data from crm_records where id=$1',[a.task_id])).rows[0].data;
 assert.equal(task.note_id,a.note_id);assert.equal(task.owner,A);assert.equal(task.priority,'Normale');
 }finally{await db.close();}
});

test('demandes commerciales : pipeline entrant, dédoublonnage et question lisible dans la relance',async()=>{
 const db=await fixture();try{
 await db.exec('reset role;set role service_role');
 const call=(key,objet,email='pipeline@example.com')=>db.query('select crm_receive_site_contact($1,$2) result',[key.repeat(64),JSON.stringify({nom:'Test pipeline',email,objet,objet_label:objet,message:'Comment migrer mes dossiers ?'})]).then(r=>r.rows[0].result);
 const a=await call('1','migration');assert.ok(a.opportunity_id);
 const b=await call('2','tarifs');assert.equal(b.opportunity_id,a.opportunity_id);
 const opportunity=(await db.query('select data from crm_records where id=$1',[a.opportunity_id])).rows[0].data;
 assert.equal(opportunity.stage,'À qualifier');assert.equal(opportunity.lead_type,'Prospect entrant');
 const task=(await db.query('select data from crm_records where id=$1',[a.task_id])).rows[0].data;
 assert.match(task.description,/Comment migrer mes dossiers/);assert.equal(task.opportunity_id,a.opportunity_id);
 assert.equal((await call('3','autre','question@example.com')).opportunity_id,null);
 assert.equal((await call('4','association','partenaire@example.com')).opportunity_id,null);
 await db.query("update crm_records set data=jsonb_set(data,'{stage}','\"Gagné\"') where id=$1",[a.opportunity_id]);
 assert.notEqual((await call('5','demonstration')).opportunity_id,a.opportunity_id);
 }finally{await db.close();}
});
