import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { delimiter, join } from "node:path";
import { gunzipSync } from "node:zlib";
import { assurerNodePrive, npxPrive, nodePriveInstallable } from "./installationOpenClaw.ts";
import { autoProvisionEnabled } from "./deployment.ts";
import { tarDuSysteme } from "./pythonPrive.ts";
import { t } from "./langue.ts";
import { SHA256_VERROU_REA, VERROU_REA_GZIP } from "./reaVerrou.ts";

/** REA reste un serveur d'analyse distinct de RTK. Aucun `setup`, moteur externe ou module Frida. */
export const VERSION_REA="6.8.0";
export const SHA256_REA="8d542ec76a9cb350584b60a6c9c088706ff812d5bb5b094c20c95b6dc25698bb";
const ARCHIVE="https://registry.npmjs.org/rea-agents/-/rea-agents-6.8.0.tgz";
const racine=()=>join(process.env.HELIX_DATA_DIR??join(homedir(),'.helix','data'),'rea');
const dossier=()=>join(racine(),VERSION_REA);
const maison=()=>join(racine(),'maison');
const empreinte=(b:Uint8Array)=>createHash('sha256').update(b).digest('hex');
const marque=()=>join(dossier(),'helix-installation.json');
export const estOutilRea=(nom:string)=>nom.startsWith('rea__');
export function versionNodeReaCompatible(version:string){
 if(!/^\d+\.\d+\.\d+$/.test(version))return false;
 const [majeur=0,mineur=0,correctif=0]=version.split('.').map(Number);
 return majeur>26||majeur===26&&(mineur>12||mineur===12&&correctif>=1)||majeur===24&&(mineur>22||mineur===22&&correctif>=1)||majeur===22&&(mineur>23||mineur===23&&correctif>=4);
}
export const reaProposable=()=>nodePriveInstallable()===null;
export function reaInstalle(){try{const v=JSON.parse(readFileSync(marque(),'utf8'));return v.archive===SHA256_REA&&v.verrou===SHA256_VERROU_REA&&existsSync(join(dossier(),'scripts','rea.mjs'))}catch{return false}}
export const serveurReaAPoser=()=>!reaInstalle();
export function commandeRea(){const node=npxPrive();if(!node)throw Error(t("Le moteur nécessaire à REA est introuvable."));return{command:node.node,args:[join(dossier(),'scripts','rea.mjs'),'mcp']}}
/** HOME privé : REA ne découvre ni les comptes des autres agents ni leurs clés de configuration. */
export function envRea():Record<string,string>{return{HOME:maison(),USERPROFILE:maison(),APPDATA:join(maison(),'AppData'),XDG_CONFIG_HOME:join(maison(),'config'),XDG_CACHE_HOME:join(maison(),'cache'),REA_LOG_LEVEL:'error',REA_MCP_MAX_RESPONSE_BYTES:'10485760',NO_COLOR:'1'}}
export async function refusRea():Promise<string|null>{return reaInstalle()&&npxPrive()?null:t("Branchez REA dans les connecteurs pour installer son moteur d'analyse.")}
function lancer(command:string,args:string[],cwd:string,env:NodeJS.ProcessEnv,timeout=300000):Promise<string>{return new Promise((ok,non)=>execFile(command,args,{cwd,env,timeout,maxBuffer:4*1024*1024,windowsHide:true},(e,sortie,erreur)=>e?non(new Error((String(erreur)||e.message).slice(-2000))):ok(String(sortie))))}
let installation:Promise<{ok:true}|{ok:false;message:string}>|null=null;
export function preparerRea():Promise<{ok:true}|{ok:false;message:string}>{
 if(reaInstalle()&&npxPrive())return Promise.resolve({ok:true});
 if(!installation)installation=installer().then(()=>({ok:true as const})).catch(e=>({ok:false as const,message:e instanceof Error?e.message:String(e)})).finally(()=>{installation=null});return installation;
}
async function installer(){
 if(!autoProvisionEnabled())throw Error(t("L'installation automatique des outils est désactivée sur cette instance."));
 if(!reaProposable())throw Error(t("REA ne peut pas être installé sur cette machine."));
 const npm=await assurerNodePrive(true),node=npxPrive();if(!node)throw Error(t("Le moteur nécessaire à REA est introuvable."));
 mkdirSync(racine(),{recursive:true,mode:0o700});mkdirSync(maison(),{recursive:true,mode:0o700});
 const temporaire=mkdtempSync(join(racine(),'installation-'));
 try{
  const environnement:NodeJS.ProcessEnv={...envRea(),PATH:node.dossier+delimiter+(process.env.PATH??''),...(process.env.SystemRoot?{SystemRoot:process.env.SystemRoot}:{}),TMPDIR:temporaire,TMP:temporaire,TEMP:temporaire};
  const version=(await lancer(node.node,['-p','process.versions.node'],temporaire,environnement,10000)).trim();
  if(!versionNodeReaCompatible(version))throw Error(t("REA demande une version plus récente du moteur Node de l'instance."));
  const verrou=gunzipSync(Buffer.from(VERROU_REA_GZIP,'base64'));if(empreinte(verrou)!==SHA256_VERROU_REA)throw Error(t("Le verrou des dépendances de REA est invalide."));
  const r=await fetch(ARCHIVE,{signal:AbortSignal.timeout(120000)});if(!r.ok||!r.body)throw Error(t("Le téléchargement de REA a échoué."));const morceaux:Uint8Array[]=[];let taille=0;
  for await(const b of r.body){taille+=b.length;if(taille>15*1024*1024)throw Error(t("L'archive de REA dépasse la taille attendue."));morceaux.push(b)}
  const archive=Buffer.concat(morceaux);if(empreinte(archive)!==SHA256_REA)throw Error(t("L'empreinte de REA ne correspond pas à la version attendue."));
  const fichier=join(temporaire,'rea.tgz');writeFileSync(fichier,archive,{mode:0o600});const destination=join(temporaire,'paquet');mkdirSync(destination,{mode:0o700});const tar=tarDuSysteme();
  // Cette archive précise a été parcourue : fichiers ordinaires sous package/, aucun lien ni chemin remontant.
  const noms=await lancer(tar,['-tzf',fichier],temporaire,environnement,30000);
  if(noms.trim().split('\n').some(n=>!n.startsWith('package/')||n.split('/').includes('..')||n.includes('\\')))throw Error(t("L'archive de REA contient un chemin refusé."));
  await lancer(tar,['-xzf',fichier,'-C',destination,'--strip-components','1'],temporaire,environnement,30000);
  const paquet=JSON.parse(readFileSync(join(destination,'package.json'),'utf8'));
  if(paquet.name!=='rea-agents'||paquet.version!==VERSION_REA||JSON.stringify(paquet.dependencies)!==JSON.stringify(JSON.parse(verrou.toString()).packages[''].dependencies)){
   // L'ordre des clés ne porte pas de sens dans JSON.
   const attendu=JSON.parse(verrou.toString()).packages[''].dependencies;const reel=paquet.dependencies;
   if(paquet.name!=='rea-agents'||paquet.version!==VERSION_REA||Object.keys(attendu).length!==Object.keys(reel??{}).length||Object.entries(attendu).some(([k,v])=>reel[k]!==v))throw Error(t("Le paquet REA ne correspond pas à son verrou."));
  }
  delete paquet.scripts;writeFileSync(join(destination,'package.json'),JSON.stringify(paquet));writeFileSync(join(destination,'package-lock.json'),verrou);
  const npmrc=join(temporaire,'npmrc'),npmGlobal=join(temporaire,'npm-global');writeFileSync(npmGlobal,'');writeFileSync(npmrc,'registry=https://registry.npmjs.org/\nignore-scripts=true\n');
  await lancer(node.node,[npm,'ci','--omit=dev','--omit=optional','--ignore-scripts','--no-audit','--no-fund','--registry=https://registry.npmjs.org/'],destination,{...environnement,NPM_CONFIG_USERCONFIG:npmrc,NPM_CONFIG_GLOBALCONFIG:npmGlobal,NPM_CONFIG_CACHE:join(racine(),'npm-cache')});
  const sortie=await lancer(node.node,[join(destination,'scripts','rea.mjs'),'--version'],destination,environnement,30000);if(!sortie.includes(VERSION_REA))throw Error(t("REA n'a pas confirmé sa version après installation."));
  writeFileSync(join(destination,'helix-installation.json'),JSON.stringify({archive:SHA256_REA,verrou:SHA256_VERROU_REA}),{mode:0o600});
  if(existsSync(dossier()))rmSync(dossier(),{recursive:true,force:true});renameSync(destination,dossier());
 }finally{rmSync(temporaire,{recursive:true,force:true})}
}
