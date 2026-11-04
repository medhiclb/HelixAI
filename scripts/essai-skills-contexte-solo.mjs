import {createHash} from "node:crypto";
import assert from 'node:assert/strict';
import {build,transform} from 'esbuild';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {createRequire} from 'node:module';
import {EventEmitter} from 'node:events';
import vm from 'node:vm';
const dossier=mkdtempSync(join(tmpdir(),'helix-import-skills-')),require=createRequire(import.meta.url);
let donnees={autre:{garde:true}},ecritures=0,refuserEcriture=false,skills=[];
globalThis.__skillsDb={read:async nom=>nom==='profiles'?{'profile:alice':{modeTravail:'solo'},'profile:bob':{modeTravail:'equipe'}}:nom==='competences'?skills:donnees,write:async(_nom,valeur)=>{if(refuserEcriture)throw Error('illisible');donnees=valeur;ecritures++}};
globalThis.__skillsLookup=async()=>[{address:'140.82.112.3',family:4}];
const reponses=new Map();let connexions=0;
globalThis.__skillsGet=(url,options,callback)=>{
 connexions++;const req=new EventEmitter();
 options.lookup(url.hostname,{all:true},(err,ips)=>{assert.equal(err,null);assert.ok(ips.every(x=>x.address==='140.82.112.3'))});
 queueMicrotask(()=>{const r=new EventEmitter();r.statusCode=reponses.get(url.href)?.statut??200;r.destroy=e=>{if(e)r.emit('error',e)};callback(r);if(r.statusCode===200){r.emit('data',Buffer.from(reponses.get(url.href)?.corps??''));r.emit('end')}});return req;
};
const plugin={name:'doublures-isolees',setup(b){
 b.onResolve({filter:/^(node:https|node:dns\/promises|\.\/db\.ts|\.\/audit\.ts|\.\/langue\.ts|@\/lib\/i18n|\.\/storage)$/},a=>({path:a.path,namespace:'essai'}));
 b.onLoad({filter:/.*/,namespace:'essai'},a=>({contents:a.path==='node:https'?'export default {get:(...a)=>globalThis.__skillsGet(...a)}':a.path==='node:dns/promises'?'export const lookup=(...a)=>globalThis.__skillsLookup(...a)':a.path==='./db.ts'?'export const db=()=>globalThis.__skillsDb':a.path==='./audit.ts'?'export const journaliser=()=>{}':a.path==='./storage'?'export const storage={get:(_k,d)=>d,set(){}};export const newId=()=>"id"':'export const t=x=>x;export const tf=(s,...v)=>s.replace(/\\{(\\d+)\\}/g,(_,n)=>v[n])'}));
}};
const charger=async(chemin,nom)=>{const sortie=join(dossier,nom+'.cjs');await build({entryPoints:[resolve(chemin)],outfile:sortie,bundle:true,platform:'node',format:'cjs',logLevel:'silent',plugins:[plugin]});return require(sortie)};
try{
 const i=await charger('gateway/src/importCompetences.ts','import');
 await assert.rejects(i.lireLienPublic('http://public.test/a.md',100,AbortSignal.timeout(1000)));
 await assert.rejects(i.lireLienPublic('https://nom:secret@public.test/a.md',100,AbortSignal.timeout(1000)));
 globalThis.__skillsLookup=async()=>[{address:'127.0.0.1',family:4}];await assert.rejects(i.lireLienPublic('https://public.test/a.md',100,AbortSignal.timeout(1000)));assert.equal(connexions,0);
 globalThis.__skillsLookup=async()=>[{address:'140.82.112.3',family:4},{address:'10.0.0.1',family:4}];await assert.rejects(i.lireLienPublic('https://public.test/a.md',100,AbortSignal.timeout(1000)));assert.equal(connexions,0);
 globalThis.__skillsLookup=async()=>[{address:'140.82.112.3',family:4}];
 reponses.set('https://public.test/a.md',{statut:302});await assert.rejects(i.lireLienPublic('https://public.test/a.md',100,AbortSignal.timeout(1000)),/302/);
 reponses.set('https://public.test/a.md',{corps:'x'.repeat(101)});await assert.rejects(i.lireLienPublic('https://public.test/a.md',100,AbortSignal.timeout(1000)),/grand/);
 reponses.set('https://public.test/a.md',{corps:'# Exemple\nInstructions'});const direct=await i.importerCompetenceLien('https://public.test/a.md');assert.equal(Buffer.from(direct.fichiers[0].base64,'base64').toString(),'# Exemple\nInstructions');
 const sha='a'.repeat(40),api='https://api.github.com/repos/auteur/depot';
 reponses.set(api,{corps:JSON.stringify({default_branch:'main'})});reponses.set(api+'/commits/main',{corps:JSON.stringify({sha})});reponses.set(api+'/commits/'+sha,{corps:JSON.stringify({sha})});
 reponses.set(api+'/git/trees/'+sha+'?recursive=1',{corps:JSON.stringify({tree:[{path:'skills/un/SKILL.md',type:'blob',mode:'100644'},{path:'skills/deux/SKILL.md',type:'blob',mode:'100644'},{path:'skills/un/exemple.py',type:'blob',mode:'100644',size:20},{path:'skills/un/lien.md',type:'blob',mode:'120000',size:10}]})});
 reponses.set('https://raw.githubusercontent.com/auteur/depot/'+sha+'/skills/un/SKILL.md',{corps:'---\nname: un\ndescription: Exemple\n---\n# Exemple\nMéthode'});
 reponses.set('https://raw.githubusercontent.com/auteur/depot/'+sha+'/skills/un/exemple.py',{corps:'raise Exception("ne pas exécuter")'});
 const arbre=JSON.parse(reponses.get(api+'/git/trees/'+sha+'?recursive=1').corps);for(const e of arbre.tree){const contenu=Buffer.from(reponses.get('https://raw.githubusercontent.com/auteur/depot/'+sha+'/'+e.path)?.corps??'');e.sha=createHash('sha1').update('blob '+contenu.length+'\0').update(contenu).digest('hex')}reponses.set(api+'/git/trees/'+sha+'?recursive=1',{corps:JSON.stringify(arbre)});
 const liste=await i.importerCompetenceLien('https://github.com/auteur/depot');assert.equal(liste.candidats.length,2);assert.ok(liste.source.includes(sha));
 const choisi=await i.importerCompetenceLien(liste.source,'skills/un/SKILL.md');assert.equal(choisi.fichiers.length,3);assert.ok(choisi.fichiers.some(f=>f.nom==='SOURCE.txt'));assert.ok(!choisi.fichiers.some(f=>f.nom.includes('lien')));
 await assert.rejects(i.importerCompetenceLien(liste.source,'../secret'));
 const regles=await charger('gateway/src/competencesRegles.ts','commandes');const skill={id:'a',nom:'Frontend Design',quand:'Créer une interface',instructions:'Méthode de création',active:true};
 assert.equal(regles.competenceExplicite([skill],'/frontend-design Fais une page').id,'a');assert.equal(regles.competenceExplicite([{...skill,active:false}],'/frontend-design Fais une page'),undefined);assert.equal(regles.competenceExplicite([skill],'/inconnue'),undefined);assert.equal(regles.competenceExplicite([skill,{...skill,id:'b'}],'/frontend-design'),undefined);assert.equal(regles.competenceExplicite([skill,{...skill,id:'b'}],'/frontend-design:b').id,'b');
 assert.equal(regles.choisirCompetences([skill],'/frontend-design Autre vocabulaire',2000).appliquees[0]?.id,'a');assert.equal(regles.choisirCompetences([skill],'Explique les volcans',2000).appliquees.length,0);
 const competences=await charger('gateway/src/competences.ts','skills-demande');skills=[{...skill,id:'long',ownerId:'alice',visibilite:'personnel',instructions:'METHODE-LONGUE '+ 'x'.repeat(9300),fichiers:[{nom:'LICENSE.txt',contenu:'licence'.repeat(1500)}]}];const forcee=await competences.consignePourCode('alice','/frontend-design Fais une page');assert.ok(forcee.includes(skills[0].instructions));assert.equal(await competences.consignePourCode('bob','/frontend-design Fais une page'),'');skills=[{...skills[0],active:false}];assert.equal(await competences.consignePourCode('alice','/frontend-design Fais une page'),'');
 const contexte=await charger('gateway/src/contextesModeles.ts','contextes');assert.equal(contexte.tailleValide(65536),true);for(const n of [NaN,Infinity,100,262145,4096.5,'65536'])assert.equal(contexte.tailleValide(n),false);
 assert.equal(contexte.contexteSouhaite('constructor'),undefined);
 await contexte.enregistrerContexte('modele',65536,'alice');assert.deepEqual(donnees.autre,{garde:true});assert.equal(contexte.contexteSouhaite('modele'),65536);assert.deepEqual(contexte.optionsContexte(['--context-length','32768','--gpu','max'],'modele'),['--gpu','max','--context-length','65536']);assert.deepEqual(contexte.optionsContexte(['--parallel','1'],'autre'),['--parallel','1']);
 refuserEcriture=true;await assert.rejects(contexte.enregistrerContexte('modele',131072,'alice'));assert.equal(contexte.contexteSouhaite('modele'),65536);assert.equal(ecritures,1);refuserEcriture=false;donnees=[];await assert.rejects(contexte.enregistrerContexte('modele',8192,'alice'));assert.equal(ecritures,1);
 donnees={autre:{garde:true}};await contexte.enregistrerVeille(10,'alice');assert.equal(contexte.delaiVeilleSecondes(),'600');assert.deepEqual(donnees.autre,{garde:true});await assert.rejects(contexte.enregistrerVeille(0,'alice'));assert.equal(contexte.delaiVeilleMinutes(),10);
 await Promise.all([contexte.enregistrerContexte('second',32768,'alice'),contexte.enregistrerVeille(30,'alice')]);assert.equal(donnees.contextesModeles.second,32768);assert.equal(donnees.veilleModelesMinutes,30);
 const profil=await charger('src/lib/store/profile.ts','profil');const base=profil.emptyProfile('alice');assert.ok(!profil.buildSystemPrompt(base,'Produit').includes("l'assistant IA de l'entreprise"));assert.ok(profil.buildSystemPrompt({...base,modeTravail:'solo'},'Produit').includes('La personne travaille seule.'));assert.ok(!profil.buildSystemPrompt({...base,modeTravail:'equipe'},'Produit').includes('La personne travaille seule.'));
 const prive=await charger('gateway/src/profilTravail.ts','prive');assert.ok((await prive.consigneModeTravail('alice')).includes('travaille seule'));assert.ok((await prive.consigneModeTravail('bob')).includes('travaille en équipe'));assert.equal(await prive.consigneModeTravail('inconnu'),'');
 const source=readFileSync('gateway/src/backends.ts','utf8');const debut=source.indexOf('export async function changerContexteLocal(');assert.ok(debut>0);
 const code=(await transform('let rechargementContexte=false;'+source.slice(debut),{loader:'ts',format:'cjs'})).code;
 for(const cas of ['ok','occupe','file','alias','double','inconnu','echec','non-confirme']){
  const module={exports:{}},actions=[];let actuel=32768;
  const contexteVm={module,exports:module.exports,t:x=>x,tailleValide:contexte.tailleValide,moteurOuvert:()=>false,findLms:async()=>'/faux/lms',chargesParHelix:new Set(),delaiVeilleSecondes:contexte.delaiVeilleSecondes,optionsDeChargement:()=>['--context-length','32768','--gpu','max'],exec:async(_lms,args)=>{actions.push(args);if(args[0]==='ps'){const etat={modelKey:'modele',identifier:cas==='alias'?'autre':'modele',status:cas==='occupe'?'generating':'idle',queued:cas==='file'?1:0,contextLength:cas==='inconnu'?undefined:actuel};return{stdout:JSON.stringify(cas==='double'?[etat,etat]:[etat])}}if(args[0]==='load'){assert.equal(args[args.indexOf('--ttl')+1],'1800');const taille=Number(args[args.indexOf('--context-length')+1]);if(cas==='echec'&&taille===65536)throw Error('mémoire');actuel=cas==='non-confirme'?32768:taille;}return{stdout:''}}};
  vm.runInNewContext(code,contexteVm);const f=module.exports.changerContexteLocal,m={id:'modele',backendId:'lmstudio',backendKind:'lmstudio',contexteMax:131072};
  if(cas==='ok'){assert.equal(await f(m,65536),65536);assert.deepEqual(actions.filter(a=>a[0]==='unload').map(a=>a[1]),['modele'])}else{await assert.rejects(f(m,65536));if(['occupe','file','alias','double','inconnu'].includes(cas))assert.equal(actions.some(a=>a[0]==='unload'),false);if(cas==='echec')assert.equal(actuel,32768)}
  await assert.rejects(f(m,262144));await assert.rejects(f({...m,backendId:'distant'},65536));
 }
 console.log('Skills : choix GitHub épinglé, liens publics bornés sans rebinding ni redirection, aucune exécution. Contexte : persistance, isolation, modèle occupé refusé, restauration après échec et taille relue. Solo/équipe : préférences personnelles distinctes.');
}finally{for(const k of ['__skillsDb','__skillsLookup','__skillsGet'])delete globalThis[k];rmSync(dossier,{recursive:true,force:true})}
