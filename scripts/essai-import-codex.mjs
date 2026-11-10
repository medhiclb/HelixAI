/** Import Codex récent et ancien, sur un poste et des conversations fictifs (10/11/2026). */
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
const temporaire=mkdtempSync(join(tmpdir(),'helix-import-codex-'));
const maison=join(temporaire,'maison');const sessions=join(maison,'.codex/sessions/2026/11/10');
const projet=join(temporaire,'projet');mkdirSync(sessions,{recursive:true});mkdirSync(projet);
writeFileSync(join(projet,'AGENTS.md'),'Instructions du projet fictif.');writeFileSync(join(maison,'.codex/AGENTS.md'),'Instructions personnelles fictives.');
const date='2026-11-10T12:00:00.000Z';
const entree=(type,payload)=>({type,timestamp:date,payload});
const message=(role,texte,channel)=>entree('response_item',{type:'message',role,...(channel?{channel}:{}),content:[{type:role==='user'?'input_text':'output_text',text:texte}]});
const ancien=(role,texte)=>entree('event_msg',{type:role==='user'?'user_message':'agent_message',message:texte});
const entete=entree('session_meta',{cwd:projet});
function ecrire(nom,lignes,archive=false){const dossier=archive?join(maison,'.codex/archived_sessions'):sessions;mkdirSync(dossier,{recursive:true});writeFileSync(join(dossier,nom+'.jsonl'),lignes.map(x=>typeof x==='string'?x:JSON.stringify(x)).join('\n')+'\n')}
const fichiers=d=>readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?fichiers(join(d,e.name)):[join(d,e.name)]);
const empreintes=()=>Object.fromEntries(fichiers(maison).map(f=>[f,createHash('sha256').update(readFileSync(f)).digest('hex')]));
try{
 for(let i=0;i<33;i++)ecrire('moderne-'+i,[entete,message('developer','Ne jamais importer cette consigne.'),message('user',`# Files mentioned by the user:\nimage.png\n## My request:\nBonjour ${i}`),message('assistant','Raisonnement privé.','analysis'),message('assistant','Je prépare.','commentary'),message('assistant','Voici la réponse.','final'),entree('response_item',{type:'function_call',name:'outil',arguments:'secret à exclure'})]);
 await build({entryPoints:[resolve('gateway/src/importLocal.ts')],outfile:join(temporaire,'import.mjs'),bundle:true,platform:'node',format:'esm',logLevel:'silent',plugins:[{name:'poste-fictif',setup(b){
 b.onResolve({filter:/^node:os$/},()=>({path:'os',namespace:'double'}));
 b.onResolve({filter:/^\.\/(langue|importCodeLocal)\.ts$/},a=>({path:a.path,namespace:'double'}));
 b.onLoad({filter:/.*/,namespace:'double'},a=>({contents:a.path==='os'?`export const homedir=()=>${JSON.stringify(maison)};export const platform=()=>process.platform;`:a.path.includes('langue')?'export const t=x=>x;':`export const baseCode=()=>${JSON.stringify(join(temporaire,'absent'))};export const sessionsCodeLocales=async()=>[];export const messagesCodeLocaux=async()=>[];`}));
 }}]});
 const m=await import(join(temporaire,'import.mjs'));
 const logiciel=(await m.logicielsTrouves()).find(x=>x.id==='codex');assert.equal(logiciel.conversations,33);
 let page=await m.pageLogiciel('codex',0);assert.equal(page.total,33);assert.equal(page.chats.length,33,'33 sessions détectées doivent être proposées, pas zéro');assert.equal(page.projets.length,1);assert.equal(page.instructions,'Instructions personnelles fictives.');
 for(const c of page.chats){assert.equal(c.nbMessages,3);assert.equal(c.messages.length,0);assert.match(c.titre,/^Bonjour \d+$/)}
 const premier=await m.contenuLogiciel('codex',[page.chats[0].cle]);assert.deepEqual(premier.chats[0].messages.map(x=>x.role),['user','assistant','assistant']);assert.equal(premier.chats[0].messages[1].content,'Je prépare.');assert.equal(premier.chats[0].messages[2].content,'Voici la réponse.');
 ecrire('ancien',[entete,ancien('user','# Files mentioned by the user\nfichier\n## My request for Codex:\nAncienne demande.'),ancien('assistant','Ancienne réponse.')],true);
 ecrire('double',[entete,ancien('user','continue'),message('user','continue'),ancien('assistant','Fini.'),message('assistant','Fini.','final'),message('user','continue'),message('user','continue')]);
 ecrire('mixte',[entete,message('user','Demande moderne.'),ancien('assistant','Réponse ancienne.')]);
 ecrire('contexte',[entete,message('user','<environment_context>contexte</environment_context>'),message('user','# AGENTS.md instructions for /projet\n<INSTRUCTIONS>consigne</INSTRUCTIONS>'),message('developer','autre consigne'),message('assistant','pensée','analysis')]);
 ecrire('blocs',[entete,'{interrompu',entree('response_item',{type:'message',role:'user',content:[{type:'input_text',text:'Question publique.'},{type:'input_image',image_url:'data:image/png;base64,secret'}]}),entree('response_item',{type:'message',role:'assistant',channel:'final',content:[{type:'output_text',text:'Première ligne.'},{type:'output_text',text:'Deuxième ligne.'}]}),message('user','<external_codex_apps_open_page>contexte</external_codex_apps_open_page>'),message('user','<environment_context>machine</environment_context>\nMa vraie demande.')]);
 ecrire('long',[entete,message('user','x'.repeat(25000))]);
 const avant=empreintes();page=await m.pageLogiciel('codex',0);assert.equal(page.total,39);assert.equal(page.chats.length,38,'les sessions purement techniques restent exclues');
 const contenu=await m.contenuLogiciel('codex',page.chats.map(c=>c.cle));
 const lire=nom=>contenu.chats.find(c=>c.cle==='codex:'+nom);
 assert.deepEqual(lire('ancien').messages.map(x=>x.content),['Ancienne demande.','Ancienne réponse.']);
 assert.deepEqual(lire('double').messages.map(x=>x.content),['continue','Fini.','continue','continue'],'les miroirs ne doublent pas les messages, les demandes réellement répétées restent');
 assert.deepEqual(lire('mixte').messages.map(x=>x.content),['Demande moderne.','Réponse ancienne.']);
 assert.deepEqual(lire('blocs').messages.map(x=>x.content),['Question publique.','Première ligne.\nDeuxième ligne.','Ma vraie demande.']);
 assert.equal(lire('long').messages[0].content.length,20004);assert.ok(!JSON.stringify(contenu).includes('secret'));assert.ok(!JSON.stringify(contenu).includes('Raisonnement privé'));
 assert.deepEqual((await m.contenuLogiciel('codex',['../../secret'])).chats,[]);
 assert.deepEqual(empreintes(),avant,'les fichiers d’origine et leurs instructions restent inchangés');
 console.log('Import Codex : 33 sessions récentes proposées, anciens journaux et archives, formats mixtes sans miroirs, répétitions conservées, instructions/outils/raisonnement exclus, contenu borné, fichiers source inchangés.');
}finally{rmSync(temporaire,{recursive:true,force:true})}
