/** Imports OpenCode/Zcode et Cursor : bases jetables, aucun historique du poste (02/11 et 10/11/2026). */
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { build } from "esbuild";
const racine = resolve(import.meta.dirname, "..");
const dossier = mkdtempSync(join(tmpdir(), "helix-import-code-"));
try {
  const programme = join(dossier, "imports.cjs");
  await build({ entryPoints: [join(racine, "gateway/src/importLocal.ts")], outfile: programme, bundle: true, platform: "node", format: "cjs", external: ["pg-native"], logLevel: "silent" });
  const script = join(dossier, "essai.cjs");
  writeFileSync(script, `
const assert=require('node:assert/strict'),{DatabaseSync}=require('node:sqlite'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const home=process.env.HOME, projet=path.join(home,'projet');fs.mkdirSync(projet,{recursive:true});fs.writeFileSync(path.join(projet,'AGENTS.md'),'Instructions du projet témoin');
const bases=[];
const sqliteDisponible=require('node:child_process').spawnSync('sqlite3',['-version'],{encoding:'utf8'}).status===0;
if(sqliteDisponible){
 const support=process.platform==='darwin'?path.join(home,'Library','Application Support'):process.platform==='win32'?process.env.APPDATA:path.join(home,'.config');
 const p=path.join(support,'Cursor','User','globalStorage','state.vscdb');fs.mkdirSync(path.dirname(p),{recursive:true});const d=new DatabaseSync(p);d.exec('create table cursorDiskKV(key text primary key,value text)');
 const ajouter=(k,v)=>d.prepare('insert into cursorDiskKV values(?,?)').run(k,JSON.stringify(v));
 ajouter('composerData:ancien',{composerId:'ancien',name:'Ancien Cursor',createdAt:1700000000000,conversation:[{type:1,text:'Question ancienne'},{type:2,text:'Réponse ancienne'},{type:3,text:'Technique'}]});
 ajouter('composerData:recent',{composerId:'recent',name:'Cursor récent',createdAt:1700000001000,fullConversationHeadersOnly:[{bubbleId:'question'},{bubbleId:'reponse'}]});
 ajouter('bubbleId:recent:reponse',{type:2,text:'Réponse récente'});
 ajouter('bubbleId:recent:question',{type:1,richText:JSON.stringify({root:{children:[{children:[{text:'Question'},{text:'récente'}]}]}})});
 ajouter('composerData:vide',{composerId:'vide',conversation:[]});
 ajouter('composerData:invalide',{composerId:"id-interdit'",conversation:[{type:1,text:'Ne pas importer'}]});
 d.close();bases.push(p);fs.writeFileSync(path.join(home,'.cursorrules'),'Instructions Cursor fictives');
}
for(const [source,rel] of [['opencode','.local/share/opencode/opencode.db'],['zcode','.zcode/cli/db/db.sqlite']]) {
 const p=path.join(home,rel);fs.mkdirSync(path.dirname(p),{recursive:true});const d=new DatabaseSync(p);
 d.exec('create table session(id text, directory text,title text,time_created integer,time_updated integer,parent_id text,time_deleted integer);create table message(id text,session_id text,time_created integer,data text,sequence integer);create table part(id text,message_id text,session_id text,time_created integer,data text,sequence integer)');
 for(let i=0;i<53;i++) {
  const id='ses_'+i;d.prepare('insert into session values(?,?,?,?,?,?,?)').run(id,projet,'Projet '+i,1700000000000,1700000000000+i,null,null);
  d.prepare('insert into message values(?,?,?,?,?)').run('m_'+i,id,1700000000000,JSON.stringify({role:'user'}),0);
  d.prepare('insert into part values(?,?,?,?,?,?)').run('p_'+i,'m_'+i,id,1700000000000,JSON.stringify({type:'text',text:'Bonjour '+i}),0);
  d.prepare('insert into part values(?,?,?,?,?,?)').run('outil_'+i,'m_'+i,id,1700000000000,JSON.stringify({type:'tool',text:'NE-PAS-IMPORTER'}),1);
  d.prepare('insert into part values(?,?,?,?,?,?)').run('synth_'+i,'m_'+i,id,1700000000000,JSON.stringify({type:'text',synthetic:true,text:'INSTRUCTION-SYNTHETIQUE'}),2);
 }
 d.exec("insert into session values('sousagent','/secret','sous-agent',1,1,'ses_1',null)");d.close();bases.push(p);
}
const empreinte=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');const avant=bases.map(empreinte);
const imp=require(${JSON.stringify(programme)});
(async()=>{
 for(const source of ['opencode','zcode']) {
  const a=await imp.pageLogiciel(source,0);assert.equal(a.total,53);assert.equal(a.chats.length,50);assert.equal(a.suivant,50);assert.equal(a.chats[0].titre,'Projet 52');assert.equal(a.chats[0].messages.length,0);assert.equal(a.projets.length,1);assert.equal(a.projets[0].dossierCode,projet);assert.match(a.projets[0].instructions,/témoin/);
  const b=await imp.pageLogiciel(source,a.suivant);assert.equal(b.chats.length,3);assert.equal(b.suivant,null);
  const c=await imp.contenuLogiciel(source,[a.chats[0].cle,'../../secret']);assert.equal(c.chats.length,1);assert.equal(c.chats[0].messages.length,1);assert.equal(c.chats[0].messages[0].content,'Bonjour 52');
 }
 if(sqliteDisponible){
  const page=await imp.pageLogiciel('cursor',0);assert.equal(page.chats.length,2);assert.equal(page.chats[0].titre,'Cursor récent');assert.equal(page.instructions,'Instructions Cursor fictives');
  const contenu=await imp.contenuLogiciel('cursor',page.chats.map(c=>c.cle));
  assert.deepEqual(contenu.chats.find(c=>c.titre==='Cursor récent').messages.map(m=>m.content),['Question récente','Réponse récente']);
  assert.deepEqual(contenu.chats.find(c=>c.titre==='Ancien Cursor').messages.map(m=>m.content),['Question ancienne','Réponse ancienne']);
  assert.equal((await imp.contenuLogiciel('cursor',["cursor:id-interdit'"])).chats.length,0);
 }
 assert.deepEqual(bases.map(empreinte),avant);assert.equal(await imp.pageLogiciel('inconnu',0),null);
 const logiciels=await imp.logicielsTrouves();assert.equal(logiciels.filter(x=>['opencode','zcode'].includes(x.id)).length,2);
 console.log('Imports OpenCode/Zcode : contrôles réussis, bases intactes. Cursor : '+(sqliteDisponible?'anciens et nouveaux formats, ordre, instructions et base intacte.':'outil sqlite3 absent, essai non exécuté.'));
})().catch(e=>{console.error(e);process.exitCode=1});
`);
  const resultat = spawnSync(process.execPath, [script], { env: { ...process.env, HOME: dossier, USERPROFILE: dossier, APPDATA: join(dossier, "AppData", "Roaming"), XDG_DATA_HOME: join(dossier, ".local", "share"), HELIX_DATA_DIR: join(dossier, "data"), OPENCODE_DB: "" }, encoding: "utf8", timeout: 120_000 });
  assert.equal(resultat.status, 0, resultat.stderr + resultat.stdout);
  console.log(resultat.stdout.trim());
  assert.ok(readFileSync(programme).length > 0);
} finally { rmSync(dossier, { recursive: true, force: true }); }
