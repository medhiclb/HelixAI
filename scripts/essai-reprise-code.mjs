/** Refus de lancement et registre périmé, sans processus ni modèle du poste (08/11/2026). */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {transform} from 'esbuild';
const source=readFileSync('gateway/src/opencode.ts','utf8');
const compiler=async(debut,fin)=>(await transform(source.slice(source.indexOf(debut),source.indexOf(fin)),{loader:'ts',format:'cjs'})).code;
const reprise=await compiler('export async function assurerModele(', '/** Anciens noms');
for(const [reponses,attendu,redemarrages] of [
 [[{helix:{modele:{}}}],true,0],
 [[{helix:{}},{helix:{modele:{}}}],true,1],
 [[{helix:{}},{helix:{}}],false,1],
]){
 let arrets=0,lectures=0;
 const mod={exports:{}};
 vm.runInNewContext(reprise,{module:mod,exports:mod.exports,console,port:null,child:null,modelesEcrits:new Set(),
  stopServer(){arrets++},ensureServer:async()=>1234,
  api:async()=>({ok:true,json:async()=>({providers:Object.entries(reponses[lectures++]).map(([id,models])=>({id,models}))})})});
 assert.equal(await mod.exports.assurerModele('modele'),attendu);
 assert.equal(arrets,redemarrages);
}
{
 const mod={exports:{}};let lectures=0;
 vm.runInNewContext(reprise,{module:mod,exports:mod.exports,console,port:null,child:null,modelesEcrits:new Set(),stopServer(){},ensureServer:async()=>1234,
 api:async()=>{if(lectures++)throw Error('connexion coupée après absence confirmée');return {ok:true,json:async()=>({providers:[{id:'helix',models:{}}]})}}});
 assert.equal(await mod.exports.assurerModele('modele'),false);
}
const demarrage=await compiler('export async function ensureServer()', '/**\n * Le serveur tourne-t-il');
{
 const mod={exports:{}};let preparations=0;
 vm.runInNewContext(demarrage,{module:mod,exports:mod.exports,port:null,child:null,starting:null,locate:async()=>'/opencode',
 dossierParDefaut:()=>'/projet',rtkEnFond(){},menageBases(){},writeConfig:async()=>{preparations++;throw Error('disque occupé')},});
 await assert.rejects(mod.exports.ensureServer(),/disque occupé/);
 await assert.rejects(mod.exports.ensureServer(),/disque occupé/);
 assert.equal(preparations,2,'un refus transitoire permet une nouvelle préparation');
}
{
 const mod={exports:{}};const evenements=new Map();let arrete=false;
 const proc={stdout:{on(){}},stderr:{on(){}},on(n,f){evenements.set(n,f)}};
 vm.runInNewContext(demarrage,{module:mod,exports:mod.exports,port:null,child:null,starting:null,lastError:undefined,console:{log(){},error(){}},
 locate:async()=>'/opencode.exe',dossierParDefaut:()=>'/projet',rtkEnFond(){},menageBases(){},writeConfig:async()=>{},portLibre:async()=>1234,
 spawn:()=>proc,environnementOpenCode:()=>({}),
 setTimeout(f){evenements.get('error')?.(Error('EACCES'));f()},arreterArbre(){arrete=true},});
 assert.equal(await mod.exports.ensureServer(),null);
 assert.equal(arrete,true,'le lancement refusé termine proprement sans sonde fantôme');
}
const backend=readFileSync('gateway/src/backends.ts','utf8');
const memoire=backend.slice(backend.indexOf('const manqueDeMemoire ='),backend.indexOf('/**\n * Décharge les modèles'));
const reconnaitre=vm.runInNewContext((await transform(`${memoire}; manqueDeMemoire`,{loader:"ts"})).code);
for(const erreur of ['unable to allocate Vulkan0 buffer','VK_ERROR_OUT_OF_DEVICE_MEMORY','out of device memory','not enough memory']) assert.equal(reconnaitre(erreur),true);
for(const erreur of ['model not found','connection refused','Vulkan driver incompatible']) assert.equal(reconnaitre(erreur),false);
console.log('Reprise Code : registre périmé relu une seule fois, échec conservé, préparation réessayable ; allocation Vulkan reconnue sans masquer les autres erreurs.');
// L'allocation échoue même après libération : l'écran reçoit le conseil utile,
// pas la commande brute et son chemin utilisateur, y compris au second essai.
const chargement=backend.slice(backend.indexOf('async function chargerModele('),backend.indexOf('/** Taille de conversation'));
for(const liberes of [0,1]){
 const mod={exports:{}};let essais=0;
 vm.runInNewContext((await transform(`${chargement}\nmodule.exports=chargerModele`,{loader:'ts'})).code,{
 module:mod,console,findLms:async()=>'/lms',
 exec:async(_lms,args)=>{if(args[0]==='ps')return {stdout:'[]'};essais++;throw Error('Command failed C:\\Utilisateur\\lms.exe: unable to allocate Vulkan0 buffer')},
 delaiVeilleSecondes:()=>1200,optionsDeChargement:()=>[],faireLaPlace:async()=>{},preparerDossiersLlmster(){},chargesParHelix:new Set(),
 manqueDeMemoire:reconnaitre,unloadOthers:async()=>liberes,t:x=>x,tf:(x,v)=>x.replace('{0}',v),
 });
 const resultat=await mod.exports('qwen/qwen3.5-9b');
 assert.equal(resultat.ok,false);assert.match(resultat.message,/Mémoire insuffisante/);
 assert.doesNotMatch(resultat.message,/Command failed|Utilisateur/);assert.equal(essais,liberes?2:1);
}
