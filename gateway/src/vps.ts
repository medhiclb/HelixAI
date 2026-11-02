import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { db } from "./db.ts";
import { estAdministrateur } from "./roles.ts";
import { t } from "./langue.ts";
import type { DefinitionOutil } from "./outils.ts";

export interface ProjetVps { id: string; userId: string; nom: string; hote: string; port: number; dossier: string }
const collection="projetsVps";
let file:Promise<unknown>=Promise.resolve();
async function charger():Promise<ProjetVps[]>{const v=await db().read(collection);if(v==null)return[];if(!Array.isArray(v))throw new Error(t("Le registre des serveurs est illisible."));return v as ProjetVps[]}
export async function projetsVps(userId:string){return(await charger()).filter(p=>p.userId===userId)}
export function validerVps(c:Record<string,unknown>){
  const nom=typeof c.nom==='string'?c.nom.trim():'';const hote=typeof c.hote==='string'?c.hote.trim():'';
  const dossier=typeof c.dossier==='string'?c.dossier.trim():'';const port=Number(c.port??22);
  if(!nom||nom.length>80||!/^([a-zA-Z0-9_.-]+@)?[a-zA-Z0-9][a-zA-Z0-9.-]{0,252}$/.test(hote)||!Number.isInteger(port)||port<1||port>65535||!dossier.startsWith('/')||dossier.length>1000||/[\x00-\x1f\x7f]/.test(dossier))throw new Error(t("Vérifiez le nom, l'hôte SSH, le port et le chemin absolu du projet."));
  return{nom,hote,port,dossier};
}
export function enregistrerVps(userId:string,corps:Record<string,unknown>):Promise<ProjetVps>{
 const suite=file.then(async()=>{if(!await estAdministrateur(userId))throw new Error(t("Seul l'administrateur peut connecter un VPS."));const c=validerVps(corps);const liste=await charger();if(liste.filter(p=>p.userId===userId).length>=30)throw new Error(t("La limite de serveurs est atteinte."));const p={...c,id:randomBytes(16).toString('hex'),userId};liste.push(p);await db().write(collection,liste);return p});file=suite.catch(()=>{});return suite;
}
export function retirerVps(userId:string,id:string):Promise<void>{const suite=file.then(async()=>{const liste=await charger();await db().write(collection,liste.filter(p=>p.userId!==userId||p.id!==id))});file=suite.catch(()=>{});return suite}
export const citerShell=(texte:string)=>"'"+texte.replace(/'/g,"'\\''")+"'";
export function argumentsSsh(p:ProjetVps,commande:string):string[]{return ['-T','-a','-x','-o','BatchMode=yes','-o','StrictHostKeyChecking=yes','-o','ClearAllForwardings=yes','-o','PermitLocalCommand=no','-o','ConnectTimeout=10','-o','ServerAliveInterval=15','-o','ServerAliveCountMax=2','-p',String(p.port),'--',p.hote,`cd -- ${citerShell(p.dossier)} && ${commande}`]}
/** SSH du système : aucun mot de passe ni clé privée ne passe par le modèle.
 * Le shell distant a les droits du compte SSH, sans prétendre le confiner au projet. */
async function lancer(p:ProjetVps,commande:string,signal?:AbortSignal){
 return new Promise<{ok:boolean;content:string}>((ok,non)=>{
  const proc=spawn(process.platform==='win32'?'ssh.exe':'/usr/bin/ssh',argumentsSsh(p,commande),{windowsHide:true,stdio:['ignore','pipe','pipe'],env:Object.fromEntries(['PATH','HOME','USERPROFILE','SystemRoot','SSH_AUTH_SOCK','LANG'].flatMap(k=>process.env[k]?[[k,process.env[k]!]]:[]))});
  let sortie='';let taille=0;let termine=false;let raison='';
  const arret=()=>{raison=t("Connexion SSH interrompue.");proc.kill()};const timer=setTimeout(()=>{raison=t("La commande distante a dépassé deux minutes.");proc.kill()},120000);
  const nettoyer=()=>{clearTimeout(timer);signal?.removeEventListener('abort',arret)};
  const lire=(b:Buffer)=>{taille+=b.length;if(taille>2*1024*1024){raison=t("La sortie distante dépasse la limite autorisée.");proc.kill();return}sortie+=b.toString('utf8')};proc.stdout.on('data',lire);proc.stderr.on('data',lire);
  proc.on('error',()=>{if(termine)return;termine=true;nettoyer();non(new Error(t("Le client SSH n'est pas disponible sur cette machine.")))});
  proc.on('close',code=>{if(termine)return;termine=true;nettoyer();ok({ok:code===0&&!raison,content:raison||sortie||t("La commande distante n'a renvoyé aucun texte.")})});signal?.addEventListener('abort',arret,{once:true});if(signal?.aborted)arret();
 });
}
export async function testerVps(userId:string,id:string,signal?:AbortSignal){if(!await estAdministrateur(userId))throw new Error(t("Seul l'administrateur peut connecter un VPS."));const p=(await projetsVps(userId)).find(p=>p.id===id);if(!p)throw new Error(t("Serveur introuvable."));return lancer(p,"pwd && (git status --short --branch 2>/dev/null || true)",signal)}
export function outilsVps():DefinitionOutil[]{return[{type:'function',function:{name:'vps__executer',description:"Exécuter une commande dans le projet d'un VPS enregistré par la personne, via SSH. Pour lire, modifier, chercher, lancer les tests et utiliser Git sur le serveur distant. Le compte SSH conserve ses droits complets ; ne jamais utiliser cet outil pour une cible non choisie par la personne.",parameters:{type:'object',properties:{serveur:{type:'string',description:'Identifiant du projet VPS choisi dans Code'},commande:{type:'string',description:'Commande shell exécutée sur le VPS, depuis le dossier du projet'}},required:['serveur','commande'],additionalProperties:false}}}]}
export async function executerVps(userId:string,args:Record<string,unknown>,signal?:AbortSignal){
 if(!await estAdministrateur(userId))return{ok:false,content:t("Seul l'administrateur peut connecter un VPS.")};
 const p=(await projetsVps(userId)).find(p=>p.id===args.serveur);if(!p)return{ok:false,content:t("Serveur introuvable.")};
 if(typeof args.commande!=='string'||!args.commande.trim()||args.commande.length>64000||args.commande.includes('\0'))return{ok:false,content:t("Commande distante invalide.")};
 return lancer(p,args.commande,signal);
}

export function oublierVps(userId:string):Promise<void>{const suite=file.then(async()=>{const liste=await charger();await db().write(collection,liste.filter(p=>p.userId!==userId))});file=suite.catch(()=>{});return suite}
