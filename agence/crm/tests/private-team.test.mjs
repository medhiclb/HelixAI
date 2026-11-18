import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {PGlite} from "@electric-sql/pglite";
import {SHARED_WORKSPACE} from "../lib/access.mjs";
import {publicAddress,mailboxSettings,uidBatch,imapPage} from "../lib/imap.mjs";
const ALLOWED_EMAILS = ["medhi.clabaut@gmail.com","collaborateur@example.test","troisieme@example.test"];

test("IMAP : TLS obligatoire, hôtes publics et paramètres sans injection",()=>{
 for(const ip of ["127.0.0.1","169.254.169.254","10.0.0.1","100.64.0.1","192.168.1.1","::1","::ffff:127.0.0.1","fe80::1","fc00::1","2001:db8::1"]) assert.equal(publicAddress(ip),false,ip);
 assert.ok(publicAddress("8.8.8.8"));assert.ok(publicAddress("2606:4700:4700::1111"));
 const input={email:"contact@helix-agence.fr",password:"app-password",imap_host:"imap.example.com",smtp_host:"smtp.example.com"};
 assert.equal(mailboxSettings(input).imap.port,993);
 for(const override of [{imap_host:"127.0.0.1"},{smtp_host:"smtp.example.com\r\nEHLO injected"},{imap_port:143},{smtp_port:25},{password:""}]) assert.throws(()=>mailboxSettings({...input,...override}));
});
test("IMAP : reprise UID ordonnée sans réimporter le dernier UID retourné par *",()=>{
 assert.deepEqual(uidBatch([21,20,19,25],20,2),{ids:[21,25],pending:false});
 assert.deepEqual(uidBatch([20],20),{ids:[],pending:false});
 assert.deepEqual(uidBatch([30,22,21,23],20,2),{ids:[21,22],pending:true});
});
test("base réelle : trois emails vérifiés, espace commun, inscription étrangère refusée et ancienne session bloquée",async()=>{
 const db=new PGlite();
 const ids=ALLOWED_EMAILS.map((_,i)=>`10000000-0000-4000-a000-00000000000${i+1}`);
 const rogue="10000000-0000-4000-a000-000000000009";
 try {
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create publication supabase_realtime;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;alter default privileges in schema public grant all on tables to anon,authenticated,service_role;`);
  for(const file of ["schema.sql","migrations/202611130001_connected_crm.sql"]) await db.exec(await readFile(new URL("../supabase/"+file,import.meta.url),"utf8"));
  await db.query("insert into auth.users(id,email,email_confirmed_at) values($1,'outsider@example.com',now())",[rogue]);
  await db.exec(await readFile(new URL("../supabase/migrations/202611130002_private_team.sql",import.meta.url),"utf8"));
  await assert.rejects(db.query("insert into auth.users(id,email) values(gen_random_uuid(),'outsider2@example.com')"),/réservé/);
  await db.query("insert into crm_allowed_emails values($1),($2)",ALLOWED_EMAILS.slice(1));
  for(let i=0;i<3;i++) await db.query("insert into auth.users values($1,$2,$3)",[ids[i],ALLOWED_EMAILS[i],i===2?null:new Date()]);
  for(let i=0;i<2;i++) {
   await db.exec(`set role authenticated;select set_config('request.jwt.claim.sub','${ids[i]}',false)`);
   await db.query("select crm_join_invitations()");
   assert.equal((await db.query("select crm_create_workspace('autre') w")).rows[0].w,SHARED_WORKSPACE);
   await db.exec("reset role");
  }
  await db.exec(`set role authenticated;select set_config('request.jwt.claim.sub','${ids[2]}',false)`);
  await assert.rejects(db.query("select crm_join_invitations()"),/réservé/);
  await db.exec(`reset role;update auth.users set email_confirmed_at=now() where id='${ids[2]}';set role authenticated;select crm_join_invitations()`);
  assert.equal((await db.query("select * from crm_members")).rows.length,3);
  await db.query("insert into crm_records(workspace_id,entity,data) values($1,'notes','{\"name\":\"Commun\"}')",[SHARED_WORKSPACE]);
  for(const id of ids) {await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);assert.equal((await db.query("select * from crm_records")).rows.length,1);}
  await db.exec(`reset role;insert into crm_members values('${SHARED_WORKSPACE}','${rogue}','outsider@example.com','Rogue','admin');set role authenticated;select set_config('request.jwt.claim.sub','${rogue}',false)`);
  assert.equal((await db.query("select * from crm_records")).rows.length,0);
  await assert.rejects(db.query("select crm_create_workspace('forgé')"),/réservé/);
  await assert.rejects(db.query("insert into crm_records(workspace_id,entity,data) values($1,'notes','{}')",[SHARED_WORKSPACE]),/row-level security/);
  await db.exec("reset role");
  await assert.rejects(db.query("update auth.users set email='forged@example.com' where id=$1",[ids[0]]),/réservé/);
  await db.exec(await readFile(new URL("../supabase/migrations/202611140001_login_delivery.sql",import.meta.url),"utf8"));
  await db.exec(await readFile(new URL("../supabase/migrations/202611140002_token_refresh_lock.sql",import.meta.url),"utf8"));
  await db.exec("set role authenticated");
  await assert.rejects(db.query("select crm_claim_login('medhi.clabaut@gmail.com')"),/permission denied/);
  await db.exec("reset role;set role service_role");
  assert.equal((await db.query("select crm_claim_login('outsider@example.com') ok")).rows[0].ok,false);
  assert.equal((await db.query("select crm_claim_login('medhi.clabaut@gmail.com') ok")).rows[0].ok,true);
  assert.equal((await db.query("select crm_claim_login('medhi.clabaut@gmail.com') ok")).rows[0].ok,false);
  assert.equal((await db.query("select crm_claim_login('collaborateur@example.test') ok")).rows[0].ok,true);
  const connection='60000000-0000-4000-a000-000000000001',lock1='70000000-0000-4000-a000-000000000001',lock2='70000000-0000-4000-a000-000000000002';
  await db.query("insert into crm_connections(id,workspace_id,user_id,provider,email,encrypted_tokens,share_emails) values($1,$2,$3,'google','medhi.clabaut@gmail.com','encrypted',true)",[connection,SHARED_WORKSPACE,ids[0]]);
  assert.equal((await db.query("select crm_claim_token_refresh($1,$2) ok",[connection,lock1])).rows[0].ok,true);
  assert.equal((await db.query("select crm_claim_token_refresh($1,$2) ok",[connection,lock2])).rows[0].ok,false);
  await db.query("select crm_release_token_refresh($1,$2)",[connection,lock2]);
  assert.equal((await db.query("select crm_claim_token_refresh($1,$2) ok",[connection,lock2])).rows[0].ok,false);
  await db.query("select crm_release_token_refresh($1,$2)",[connection,lock1]);
  assert.equal((await db.query("select crm_claim_token_refresh($1,$2) ok",[connection,lock2])).rows[0].ok,true);
  await db.exec("reset role;set role authenticated");
  await assert.rejects(db.query("select crm_claim_token_refresh($1,$2)",[connection,lock1]),/permission denied/);


 } finally {await db.close();}
});

test("relève IMAP : corps personnels exclus, lecture seule, reprise et identifiant stable",async()=>{
 const opened=[],bodies=[],closed=[];
 const fake={
  connect:async()=>{},close:()=>closed.push(true),list:async()=>[{path:"INBOX"}],
  mailboxOpen:async(path,opts)=>{opened.push([path,opts]);return {uidValidity:42n};},
  search:async()=>[1,2,3],
  fetchOne:async(uid,what)=>{
   if(what.source){bodies.push(uid);return {source:Buffer.from("From: client@cabinet.fr\r\nTo: team@helix-agence.fr\r\nSubject: Test\r\nContent-Type: text/plain; charset=utf-8\r\n\r\nBonjour Helix")};}
   return {envelope:{from:[{address:uid==="2"?"client@cabinet.fr":"personal@example.com"}],to:[{address:"team@helix-agence.fr"}],subject:"Test",date:new Date(),messageId:`<${uid}@example.com>`},flags:new Set(),size:100};
  }
 };
 const state={INBOX:{validity:"42",last:1}};
 const page=await imapPage({email:"team@helix-agence.fr"},state,new Map([["client@cabinet.fr","cabinet"]]),async()=>fake);
 assert.equal(page.items.length,1);assert.equal(page.items[0].external_id,"<2@example.com>");assert.equal(page.items[0].body_text,"Bonjour Helix");
 assert.deepEqual(bodies,["2"]);assert.equal(page.state.INBOX.last,3);assert.equal(state.INBOX.last,1);assert.deepEqual(opened,[["INBOX",{readOnly:true}]]);assert.equal(closed.length,1);
 fake.fetchOne=async()=>{throw Error("Connexion interrompue");};
 await assert.rejects(imapPage({email:"team@helix-agence.fr"},state,new Map(),async()=>fake),/interrompue/);
 assert.equal(state.INBOX.last,1);assert.equal(closed.length,2);
});

test("API : un email hors liste ou non vérifié est refusé avant la lecture des membres",async()=>{
 const {authorize}=await import("../lib/server.mjs");
 const previous=globalThis.fetch,priorURL=process.env.SUPABASE_URL,priorKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
 process.env.SUPABASE_URL="https://crm-test.example.com";process.env.SUPABASE_SERVICE_ROLE_KEY="test-key";
 let profile={id:"10000000-0000-4000-a000-000000000001",email:"outsider@example.com",email_confirmed_at:new Date().toISOString()},memberReads=0;
 globalThis.fetch=async(input)=>{
  const url=String(input);
  if(url.includes("/auth/v1/user")) return new Response(JSON.stringify(profile),{status:200,headers:{"Content-Type":"application/json"}});
  if(url.includes("/rpc/crm_email_allowed")) return new Response(JSON.stringify(ALLOWED_EMAILS.includes(profile.email)),{status:200,headers:{"Content-Type":"application/json"}});
  memberReads++;return new Response(JSON.stringify({user_id:profile.id,workspace_id:SHARED_WORKSPACE,role:"member"}),{status:200,headers:{"Content-Type":"application/json"}});
 };
 const req={method:"POST",headers:{authorization:"Bearer test-token"},body:{workspace_id:SHARED_WORKSPACE}};
 try {
  await assert.rejects(authorize(req),/réservé/);assert.equal(memberReads,0);
  profile={...profile,email:ALLOWED_EMAILS[0],email_confirmed_at:null};await assert.rejects(authorize(req),/réservé/);assert.equal(memberReads,0);
  profile.email_confirmed_at=new Date().toISOString();
  await assert.rejects(authorize({...req,body:{workspace_id:"other"}}),/requis/);assert.equal(memberReads,0);
  const ctx=await authorize(req);assert.equal(ctx.workspace,SHARED_WORKSPACE);assert.equal(memberReads,1);
 } finally {globalThis.fetch=previous;if(priorURL===undefined)delete process.env.SUPABASE_URL;else process.env.SUPABASE_URL=priorURL;if(priorKey===undefined)delete process.env.SUPABASE_SERVICE_ROLE_KEY;else process.env.SUPABASE_SERVICE_ROLE_KEY=priorKey;}
});

test("IMAP : un même mail présent dans Réception et Envoyés ne bloque pas l’upsert",async()=>{
 let folder;
 const fake={connect:async()=>{},close:()=>{},list:async()=>[{path:"Sent",specialUse:"\\Sent"}],mailboxOpen:async(path)=>{folder=path;return{uidValidity:1n};},search:async()=>[1],fetchOne:async()=>({envelope:{from:[{address:"client@cabinet.fr"}],to:[{address:"team@helix-agence.fr"}],subject:"Même message",date:new Date(),messageId:"<same@cabinet.fr>"},flags:new Set(),size:2*1024*1024})};
 const page=await imapPage({email:"team@helix-agence.fr"},{},new Map([["client@cabinet.fr","cabinet"]]),async()=>fake);
 assert.equal(page.items.length,1);assert.equal(page.state.INBOX.last,1);assert.equal(page.state.Sent.last,1);
});

test("synchronisation : les contacts au-delà de la première page sont pris en compte",async()=>{
 const {recordsForSync}=await import('../lib/sync.mjs');
 const source=Array.from({length:1101},(_,i)=>({id:String(i),entity:'contacts',data:{email:`c${i}@cabinet.fr`}}));
 const ranges=[];let range;
 const q={select:()=>q,eq:()=>q,in:()=>q,order:()=>q,range:(a,b)=>{range=[a,b];ranges.push(range);return q;},then:(resolve)=>Promise.resolve({data:source.slice(range[0],range[1]+1),error:null}).then(resolve)};
 const result=await recordsForSync({from:()=>q},'workspace',['contacts']);
 assert.equal(result.length,1101);assert.equal(result.at(-1).data.email,'c1100@cabinet.fr');assert.equal(ranges.length,3);
});
