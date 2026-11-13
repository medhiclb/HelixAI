/** Régressions du 13/11/2026 : auth MCP, ouverture Code, formats texte libres. Données fictives seulement. */
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {createServer} from 'node:http';
import {build} from 'esbuild';
const dossier=mkdtempSync(join(tmpdir(),'helix-1113-'));
const avant={...process.env};
writeFileSync(join(dossier,'config.json'),JSON.stringify({chiffrement:'fichier'}));
Object.assign(process.env,{HELIX_DATA_DIR:join(dossier,'data'),HELIX_CONFIG:join(dossier,'config.json'),HELIX_WORKSPACE:dossier});
let serveur;const fetchOriginal=globalThis.fetch;
try {
 const regles=await import('../gateway/src/mcpPersoRegles.ts');
 assert.equal(regles.jugerEntetes({Authorization:'Bearer secret-1113-ne-pas-enregistrer','X-Api-Key':'cle-1113-ne-pas-enregistrer'}).ok,true);
 for(const e of [{Authorization:'cle\r\nInjected: yes'},{Host:'ailleurs.test'},{'Proxy-Authorization':'secret'},{Cookie:'secret'},{'Mcp-Session-Id':'autre'},{'bad name':'valeur'},{Authorization:'a',authorization:'b'},Array(20).fill('a')])assert.equal(regles.jugerEntetes(e).ok,false);
 const {outilsNecessairesPourQuestion}=await import('../gateway/src/choixOutils.ts');
 const outils=[{function:{name:'facebook__pages'}},{function:{name:'agenda__prochains'}}];
 assert.equal(outilsNecessairesPourQuestion('Quel est mon mot secret ?',[],outils),false);
 for(const q of ['Quelles pages gère-t-on ?','AGENDA-PROCHAINS : et maintenant ?','Quelles sont mes commandes ?','Et maintenant ?'])assert.equal(outilsNecessairesPourQuestion(q,[],outils),true,q);
 const {ouvrirSessionCode:ouvrir}=await import('../gateway/src/creationSessionCode.ts');
 const {dansLaLangue}=await import('../gateway/src/langue.ts');
 const ouvrirSessionCode=(...args)=>dansLaLangue('fr',()=>ouvrir(...args));
 let appels=0;
 const reprise=await ouvrirSessionCode('/projet à lire',async(p,i)=>{assert.ok(p.endsWith(encodeURIComponent('/projet à lire')));assert.equal(i.method,'POST');return ++appels===1?new Response('{}',{status:503}):Response.json({id:'ses_fictive'})});
 assert.deepEqual(reprise,{id:'ses_fictive'});assert.equal(appels,2);
 for(const [message,attendu] of [['ENOSPC','plein'],['EACCES','droits'],['SQLITE_BUSY','occupée']]){
  const r=await ouvrirSessionCode('/projet',async()=>Response.json({data:{message}},{status:500}));assert.match(r.erreur,new RegExp(attendu));assert.equal(r.statut,502);
 }
 appels=0;await ouvrirSessionCode('/projet',async()=>{appels++;throw Error('secret de diagnostic')});assert.equal(appels,1);
 const html=await ouvrirSessionCode('/projet',async()=>new Response('<html>page</html>'));assert.ok(html.erreur);assert.equal(html.statut,502);
 // Le vrai gestionnaire MCP parle HTTP à un serveur factice qui exige les deux clés.
 const requetes=[];let fuite=0;
 serveur=createServer(async(q,r)=>{
  if(q.url==='/fuite'){fuite++;r.end();return}
  if(q.url==='/redirect'){r.writeHead(302,{Location:'/fuite'});r.end();return}
  if(q.method==='DELETE'){r.writeHead(200);r.end();return}
  assert.equal(q.headers.authorization,'Bearer secret-1113-ne-pas-enregistrer');assert.equal(q.headers['x-api-key'],'cle-1113-ne-pas-enregistrer');
  let brut='';for await(const b of q)brut+=b;
  if(!brut){r.writeHead(405);r.end();return}
  const d=JSON.parse(brut);requetes.push(d.method);
  if(d.id===undefined){r.writeHead(202);r.end();return}
  if(d.method==='tools/call'&&d.params?.arguments?.erreur){r.writeHead(200,{'Content-Type':'application/json'});r.end(JSON.stringify({jsonrpc:'2.0',id:d.id,error:{code:-32603,message:'Refus secret-1113-ne-pas-enregistrer cle-1113-ne-pas-enregistrer'}}));return}
  const result=d.method==='initialize'?{protocolVersion:'2024-11-05',capabilities:{tools:{}},serverInfo:{name:'fictif',version:'1'}}:d.method==='tools/list'?{tools:[{name:'lire',description:'Lecture fictive',inputSchema:{type:'object'}}]}:{content:[{type:'text',text:'lecture authentifiée'}]};
  r.writeHead(200,{'Content-Type':'application/json'});r.end(JSON.stringify({jsonrpc:'2.0',id:d.id,result}));
 });await new Promise(r=>serveur.listen(0,'127.0.0.1',r));
 const base=`http://127.0.0.1:${serveur.address().port}`;
 globalThis.fetch=(u,i)=>{const v=new URL(u instanceof Request?u.url:String(u));assert.equal(v.origin,'https://mcp.exemple.test');return fetchOriginal(base+v.pathname,i)};
 const m=await import('../gateway/src/mcp.ts');
 m.declarer({id:'prive-fictif',label:'Privé fictif',description:'Essai',url:'https://mcp.exemple.test/mcp',entetes:{authorization:'Bearer secret-1113-ne-pas-enregistrer','x-api-key':'cle-1113-ne-pas-enregistrer'}});
 assert.equal((await m.startServer('prive-fictif')).ok,true);
 const resultat=await m.callTool('prive-fictif__lire',{});assert.match(JSON.stringify(resultat),/lecture authentifiée/);
 const refuse=await m.callTool('prive-fictif__lire',{erreur:true});assert.equal(refuse.ok,false);assert.ok(!JSON.stringify(refuse).includes('secret-1113-ne-pas-enregistrer')&&!JSON.stringify(refuse).includes('cle-1113-ne-pas-enregistrer'));
 await m.stopServer('prive-fictif');
 const c=await import('../gateway/src/connecteurs.ts');
 const ajout=await c.ajouterPersonnalise({mode:'adresse',id:'prive-enregistre',label:'Privé enregistré',url:'https://mcp.exemple.test/mcp',entetes:{Authorization:'Bearer secret-1113-ne-pas-enregistrer','X-Api-Key':'cle-1113-ne-pas-enregistrer'}},'fictif',{depuisCePoste:true,base:'http://127.0.0.1:19999'});
 assert.equal(ajout.ok,true,JSON.stringify(ajout));
 const {readdirSync}=await import('node:fs');
 const verifierFichiers=p=>{for(const e of readdirSync(p,{withFileTypes:true})){const f=join(p,e.name);if(e.isDirectory())verifierFichiers(f);else{const v=readFileSync(f).toString();assert.ok(!v.includes('secret-1113-ne-pas-enregistrer')&&!v.includes('cle-1113-ne-pas-enregistrer'),f)}}};
 verifierFichiers(join(dossier,'data'));assert.ok(!JSON.stringify(m.status()).includes('secret-1113-ne-pas-enregistrer'));
 await m.stopServer('prive-enregistre');
 assert.ok(requetes.includes('initialize')&&requetes.includes('tools/list')&&requetes.includes('tools/call'));
 m.declarer({id:'redirect-fictif',label:'Redirection fictive',description:'Essai',url:'https://mcp.exemple.test/redirect',entetes:{authorization:'Bearer secret-1113-ne-pas-enregistrer'}});
 assert.equal((await m.startServer('redirect-fictif')).ok,false);assert.equal(fuite,0);await m.stopServer('redirect-fictif');
 // Le sélecteur n'écarte plus un fichier que le lecteur reconnaît comme texte.
 await build({stdin:{contents:'export {lireFichiers} from "./src/lib/attachments.ts"',resolveDir:resolve('.'),loader:'ts'},bundle:true,format:'esm',platform:'browser',outfile:join(dossier,'fichiers.mjs'),alias:{'@':resolve('src')},define:{'import.meta.env':'{}',__HELIX_VERSION__:'"essai"'},loader:{'.png':'empty','.svg':'empty'},logLevel:'silent'});
 const {lireFichiers}=await import(join(dossier,'fichiers.mjs'));
 const fichiers=await lireFichiers([new File(['Texte de configuration'],'projet.extension-inhabituelle'),new File(['FROM node:24'],'Dockerfile'),new File([new Uint8Array([0,0,1,0,255])],'inconnu.bin')]);
 assert.equal(fichiers.pieces.length,2);assert.equal(fichiers.erreurs.length,1);
 assert.ok(!/accept=\{ACCEPT\}/.test(readFileSync('src/components/chat/Composer.tsx','utf8')));
 console.log('Correctifs 13/11 : clés MCP sur connexion/liste/appel, refus des redirections et injections, session Code reprise seulement sur refus explicite, diagnostics, textes sans extension connue.');
}finally{
 globalThis.fetch=fetchOriginal;
 if(serveur){serveur.closeAllConnections();await new Promise(r=>serveur.close(r))}
 for(const k of Object.keys(process.env))if(!(k in avant))delete process.env[k];Object.assign(process.env,avant);
 rmSync(dossier,{recursive:true,force:true});
}
