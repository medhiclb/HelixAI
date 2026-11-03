import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync, statfsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, delimiter } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { assurerNodePrive, npxPrive, nodePriveInstallable } from './installationOpenClaw.ts';
import { autoProvisionEnabled } from './deployment.ts';
import { t } from './langue.ts';
import { VERROU_KOKORO, SHA_VERROU_KOKORO, MOTEUR_KOKORO, NOTICES_KOKORO } from './kokoroRessources.ts';

export const REVISION_KOKORO='1939ad2a8e416c0acfeecc08a694d14ef25f2231';
export const FICHIERS_KOKORO=[
 {source:'onnx/model_quantized.onnx',nom:'model_quantized.onnx',taille:92361116,sha:'fbae9257e1e05ffc727e951ef9b9c98418e6d79f1c9b6b13bd59f5c9028a1478'},
 {source:'voices/ff_siwis.bin',nom:'ff_siwis.bin',taille:522240,sha:'a35f5675ad08948e326ae75fd0ea16ba5d0042e4f76b5f3d1df77d0a48c54861'},
 {source:'tokenizer.json',nom:'tokenizer.json',taille:3497,sha:'77a02c8e164413299b4b4c403b14f8e0e1c1b727db4d46a09d6327b861060a34'},
] as const;
const empreinte=(b:Uint8Array|string)=>createHash('sha256').update(b).digest('hex');
const racine=()=>join(process.env.HELIX_DATA_DIR??join(homedir(),'.helix','data'),'kokoro');
const dossier=()=>join(racine(),'v1-fr-1');
let installation:Promise<void>|null=null,actif=false;
export class ErreurVoix extends Error { readonly statut:number; constructor(statut:number,message:string){super(message);this.statut=statut} }
export function kokoroInstalle(){try{const m=JSON.parse(readFileSync(join(dossier(),'installation.json'),'utf8'));return m.revision===REVISION_KOKORO&&m.verrou===SHA_VERROU_KOKORO&&m.moteur===empreinte(MOTEUR_KOKORO)&&FICHIERS_KOKORO.every(f=>existsSync(join(dossier(),f.nom)))&&existsSync(join(dossier(),'node_modules','onnxruntime-web','dist','ort.node.min.mjs'))}catch{return false}}
export function etatKokoro(){return{installee:kokoroInstalle()&&Boolean(npxPrive()),installationEnCours:Boolean(installation),installable:autoProvisionEnabled()&&nodePriveInstallable()===null,langues:['fr'],telechargementMo:150,placeMo:300}}
/** Bornes avant tout calcul ; aucune conversion implicite des objets reçus. */
export function validerParole(b:Record<string,unknown>):{texte:string;vitesse:number}{
 if(typeof b.texte!=='string'||!b.texte.trim()||b.texte.length>3000||b.langue!=='fr'||typeof b.vitesse!=='number'||!Number.isFinite(b.vitesse)||b.vitesse<0.8||b.vitesse>1.2)throw new ErreurVoix(400,t("Paramètres de lecture vocale invalides."));
 return{texte:b.texte.trim(),vitesse:b.vitesse};
}
function environnement(temp:string):NodeJS.ProcessEnv {const node=npxPrive();return{HOME:temp,USERPROFILE:temp,APPDATA:join(temp,'AppData'),XDG_CONFIG_HOME:temp,XDG_CACHE_HOME:temp,PATH:(node?.dossier??'')+delimiter+(process.env.SystemRoot?join(process.env.SystemRoot,'System32'):''),...(process.env.SystemRoot?{SystemRoot:process.env.SystemRoot}:{}),TMPDIR:temp,TMP:temp,TEMP:temp,NO_COLOR:'1',OMP_NUM_THREADS:'1'}}
/** Entrée privée par stdin ; rien n'est conservé après le processus. Une annulation le tue. */
function calculer(d:string,texte:string,vitesse:number,signal?:AbortSignal):Promise<Buffer>{
 const node=npxPrive();if(!node)throw new ErreurVoix(409,t("Préparez la voix locale avant de l'utiliser."));
 return new Promise((ok,non)=>{if(signal?.aborted)return non(new ErreurVoix(499,t("Lecture annulée.")));
 const p=spawn(node.node,[join(d,'moteur.mjs'),d],{cwd:d,env:environnement(d),windowsHide:true,stdio:['pipe','pipe','pipe']});
 let taille=0,sorties:Buffer[]=[],fini=false;const finir=(e?:Error)=>{if(fini)return;fini=true;clearTimeout(delai);signal?.removeEventListener('abort',annuler);p.kill('SIGKILL');if(e)non(e);else ok(Buffer.concat(sorties));sorties=[];};
 const annuler=()=>finir(new ErreurVoix(499,t("Lecture annulée.")));const delai=setTimeout(()=>finir(new ErreurVoix(504,t("La préparation de la voix a pris trop de temps. Réessayez."))),180000);
 signal?.addEventListener('abort',annuler,{once:true});p.on('error',()=>finir(new ErreurVoix(503,t("Le moteur vocal n'a pas pu démarrer."))));
 p.stdout.on('data',(b:Buffer)=>{taille+=b.length;if(taille>12*1024*1024)return finir(new ErreurVoix(413,t("Le son généré est trop long.")));sorties.push(b)});
 // Le moteur peut écrire des diagnostics ; ne jamais journaliser un fragment du texte privé.
 p.stderr.resume();p.stdin.on('error',()=>{});p.stdin.end(JSON.stringify({texte,vitesse}));
 p.on('close',code=>{if(code!==0||taille<44||sorties[0]?.subarray(0,4).toString()!=='RIFF')return finir(new ErreurVoix(422,t("La génération de la voix a échoué. Réessayez.")));finir()});
 });
}
async function telecharger(f:typeof FICHIERS_KOKORO[number],d:string){
 const r=await fetch(`https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX/resolve/${REVISION_KOKORO}/${f.source}`,{signal:AbortSignal.timeout(180000)});
 if(!r.ok||!r.body)throw Error(t("Le téléchargement de la voix a échoué."));const parties:Uint8Array[]=[];let taille=0;
 for await(const b of r.body){taille+=b.length;if(taille>f.taille)throw Error(t("Le téléchargement de la voix est invalide."));parties.push(b)}
 const contenu=Buffer.concat(parties);if(taille!==f.taille||empreinte(contenu)!==f.sha)throw Error(t("L'empreinte de la voix ne correspond pas à la version attendue."));writeFileSync(join(d,f.nom),contenu,{mode:0o600});
}
export function preparerKokoro():Promise<void>{if(etatKokoro().installee)return Promise.resolve();if(installation)return installation;installation=installer().finally(()=>{installation=null});return installation}
async function installer(){
 if(!etatKokoro().installable)throw new ErreurVoix(409,t("L'installation de la voix locale est désactivée sur cette instance."));
 mkdirSync(racine(),{recursive:true,mode:0o700});const place=statfsSync(racine());if(place.bavail*place.bsize<700*1024*1024)throw new ErreurVoix(507,t("Libérez au moins 700 Mo pour préparer la voix locale."));
 const npm=await assurerNodePrive(),node=npxPrive();if(!node)throw Error(t("Le moteur vocal n'a pas pu démarrer."));
 const d=mkdtempSync(join(racine(),'installation-'));
 try{
 const verrou=gunzipSync(Buffer.from(VERROU_KOKORO,'base64'));if(empreinte(verrou)!==SHA_VERROU_KOKORO)throw Error('verrou Kokoro');
 const paquet=JSON.parse(verrou.toString()).packages[''];writeFileSync(join(d,'package.json'),JSON.stringify({private:true,...paquet}));writeFileSync(join(d,'package-lock.json'),verrou);writeFileSync(join(d,'moteur.mjs'),MOTEUR_KOKORO);writeFileSync(join(d,'NOTICES.md'),NOTICES_KOKORO);
 const npmrc=join(d,'npmrc'),global=join(d,'npm-global');writeFileSync(npmrc,'registry=https://registry.npmjs.org/\nignore-scripts=true\n');writeFileSync(global,'');
 await new Promise<void>((ok,non)=>{const p=spawn(node.node,[npm,'ci','--ignore-scripts','--omit=dev','--no-audit','--no-fund','--registry=https://registry.npmjs.org/'],{cwd:d,env:{...environnement(d),NPM_CONFIG_USERCONFIG:npmrc,NPM_CONFIG_GLOBALCONFIG:global,NPM_CONFIG_CACHE:join(d,'cache')},stdio:'ignore',windowsHide:true});const timer=setTimeout(()=>{p.kill('SIGKILL');non(Error(t("Le téléchargement de la voix a échoué.")))},300000);p.on('error',e=>{clearTimeout(timer);non(e)});p.on('exit',c=>{clearTimeout(timer);c===0?ok():non(Error(t("Le téléchargement de la voix a échoué.")))})});
 for(const f of FICHIERS_KOKORO)await telecharger(f,d);
 // Un vrai WAV avant de rendre le bouton disponible. Aucun texte personnel.
 await calculer(d,'Bonjour, votre séance peut commencer.',1);
 rmSync(join(d,'cache'),{recursive:true,force:true});
 writeFileSync(join(d,'installation.json'),JSON.stringify({revision:REVISION_KOKORO,verrou:SHA_VERROU_KOKORO,moteur:empreinte(MOTEUR_KOKORO)}),{mode:0o600});
 // La destination n'est jamais supprimée avant qu'une nouvelle installation ait réussi.
 const ancien=join(racine(),'precedent');if(existsSync(dossier())){if(existsSync(ancien))throw Error('installation précédente à conserver');renameSync(dossier(),ancien)}
 try{renameSync(d,dossier())}catch(e){if(existsSync(ancien))renameSync(ancien,dossier());throw e}rmSync(ancien,{recursive:true,force:true});
 }finally{rmSync(d,{recursive:true,force:true})}
}
export async function parlerKokoro(corps:Record<string,unknown>,signal?:AbortSignal){const {texte,vitesse}=validerParole(corps);
 if(!etatKokoro().installee)throw new ErreurVoix(409,t("Préparez la voix locale avant de l'utiliser."));
 if(actif||installation)throw new ErreurVoix(429,t("Le moteur vocal est occupé. Réessayez dans un instant."));actif=true;
 try{for(const f of FICHIERS_KOKORO)if(empreinte(readFileSync(join(dossier(),f.nom)))!==f.sha)throw new ErreurVoix(409,t("L'empreinte de la voix ne correspond pas à la version attendue."));
 if(empreinte(readFileSync(join(dossier(),'moteur.mjs')))!==empreinte(MOTEUR_KOKORO))throw new ErreurVoix(409,t("Le moteur vocal n'a pas pu démarrer."));return await calculer(dossier(),texte,vitesse,signal);
 }finally{actif=false}
}
