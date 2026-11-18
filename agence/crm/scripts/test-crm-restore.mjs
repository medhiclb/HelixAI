// Restore a logical backup only into an isolated local PostgreSQL-compatible database.
import {readFile,writeFile,mkdtemp} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
const folder=resolve(process.argv[2] || '');
const snapshot=JSON.parse(await readFile(join(folder,'data.json'),'utf8'));
const manifest=JSON.parse(await readFile(join(folder,'manifest.json'),'utf8'));
const hash=createHash('sha256').update(await readFile(join(folder,'data.json'))).digest('hex');
if(hash!==manifest.snapshot_sha256)throw Error('Empreinte de sauvegarde invalide.');
const temp=await mkdtemp(join(tmpdir(),'helix-crm-restore-'));
let db=new PGlite(join(temp,'database'));
const canonical=x=>JSON.stringify(x,(_k,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b))):v);
const expected={};
try {
 await db.exec("set timezone='UTC'");
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create publication supabase_realtime;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;alter default privileges in schema public grant all on tables to anon,authenticated,service_role;`);
 await db.exec(await readFile(join(folder,'schema.sql'),'utf8'));
 const {readdir}=await import('node:fs/promises');
 for(const file of (await readdir(join(folder,'migrations'))).filter(f=>f.endsWith('.sql')).sort()) await db.exec(await readFile(join(folder,'migrations',file),'utf8'));
 for(const u of snapshot._auth_identities)await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,$3)',[u.id,u.email,u.email_confirmed_at]);
 await db.exec('delete from public.crm_workspaces');
 await db.exec("set session_replication_role='replica'");
 const order=['crm_workspaces','crm_members','crm_records','crm_connections','crm_invites','crm_oauth_states','crm_messages','crm_busy_slots','crm_outbox','crm_login_limits','crm_calendar_accounts','crm_external_slots','crm_files','crm_activity','crm_notifications','crm_mail_work','crm_mail_reads'];
 if(Object.keys(snapshot).some(k=>k!=='_auth_identities'&&!order.includes(k)))throw Error('Ordre de restauration incomplet.');
 for(const name of order){
  const rows=snapshot[name] || [];expected[name]=rows;
  for(const row of rows){
   const cols=Object.keys(row).filter(c=>c!=="collaboration_key");if(cols.some(k=>!/^[a-z_]+$/.test(k)))throw Error('Colonne invalide.');
   const selected=cols.map(c=>'"'+c+'"').join(',');
   await db.query(`insert into public."${name}"(${selected}) select ${selected} from jsonb_populate_record(null::public."${name}",$1::jsonb)`,[JSON.stringify(row)]);
  }
 }
 await db.exec("set session_replication_role='origin'");
 await db.close();db=new PGlite(join(temp,'database'));await db.exec("set timezone='UTC'");
 for(const [name,rows] of Object.entries(expected)){
  const restored=(await db.query(`select to_jsonb(t) row from public."${name}" t`)).rows.map(r=>r.row);
  const fields=rows[0]?Object.keys(rows[0]):[];
  const actual=restored.map(r=>Object.fromEntries(fields.map(k=>[k,r[k]]))).map(canonical).sort();
  const wanted=rows.map(canonical).sort();
  if(canonical(actual)!==canonical(wanted))throw Error('Écart de restauration : '+name);
 }
 const checked={date:new Date().toISOString(),tables:Object.keys(expected).length,rows:Object.values(expected).reduce((n,r)=>n+r.length,0),disk_reopen_verified:true,all_source_fields_equal:true,target:'isolated PGlite; production unchanged',scope:'CRM business tables and identity references; not a full Supabase Auth or secrets restore'};
 manifest.restore_test='passed_business_data';manifest.restore_validation=checked;
 await writeFile(join(folder,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
 console.log(JSON.stringify(checked));
}finally{await db.close();}
