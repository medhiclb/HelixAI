import { apiFetch } from './endpoint';
import { t } from './i18n';
export interface EtatVoix {installee:boolean;installationEnCours:boolean;installable:boolean;langues:string[];telechargementMo:number;placeMo:number}
export async function etatVoix():Promise<EtatVoix|null>{try{const r=await apiFetch('/helix/voix',{signal:AbortSignal.timeout(10000)});return r.ok?await r.json():null}catch{return null}}
export async function installerVoix():Promise<EtatVoix>{const r=await apiFetch('/helix/voix/installer',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({accord:true}),signal:AbortSignal.timeout(600000)});const b=await r.json();if(!r.ok)throw Error(b.error?.message??t("La préparation de la voix a échoué. Réessayez."));return b}
/** Le WAV n'est présent qu'en mémoire, et son URL cesse d'exister après lecture ou annulation. */
export function passagesVoix(texte:string):string[]{
 const passages:string[]=[];let reste=texte.trim();
 while(reste.length>300){let fin=reste.lastIndexOf(' ',300);if(fin<1)fin=300;if(/[\uD800-\uDBFF]/.test(reste.charAt(fin-1)))fin--;passages.push(reste.slice(0,fin));reste=reste.slice(fin).trimStart()}
 if(reste)passages.push(reste);return passages;
}
/** Un seul calcul en avance : il accompagne la lecture sans empiler les sons en mémoire. */
export async function lireVoixNeurale(texte:string,vitesse:number,signal:AbortSignal,debut?:()=>void,attente?:()=>void):Promise<void>{
 const passages=passagesVoix(texte);if(!passages.length)return;
 const controle=new AbortController();const annuler=()=>controle.abort();signal.addEventListener('abort',annuler,{once:true});if(signal.aborted)annuler();
 // La promesse anticipée ne rejette jamais sans lecteur, même si Pause intervient pendant le son courant.
 const preparer=(texte:string)=>genererPassage(texte,vitesse,controle.signal).then(son=>({son,erreur:null}),erreur=>({son:null,erreur}));
 let suivant=preparer(passages[0]);
 try{for(let i=0;i<passages.length;i++){controle.signal.throwIfAborted();attente?.();const resultat=await suivant;if(resultat.erreur)throw resultat.erreur;if(!resultat.son)throw Error(t("La génération de la voix a échoué. Réessayez."));controle.signal.throwIfAborted();if(i+1<passages.length)suivant=preparer(passages[i+1]);await lireSon(resultat.son,controle.signal,debut)}}
 finally{controle.abort();signal.removeEventListener('abort',annuler)}
}
async function genererPassage(texte:string,vitesse:number,signal:AbortSignal):Promise<Blob>{
 const r=await apiFetch('/helix/voix',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({texte,langue:'fr',vitesse}),signal});
 if(!r.ok){const b=await r.json().catch(()=>({}));throw Error(b.error?.message??t("La génération de la voix a échoué. Réessayez."))}
 return r.blob();
}
async function lireSon(son:Blob,signal:AbortSignal,debut?:()=>void):Promise<void>{
 signal.throwIfAborted();const url=URL.createObjectURL(son),audio=new Audio(url);
 try{await new Promise<void>((ok,non)=>{let fini=false;const nettoyer=()=>{audio.onplaying=null;audio.onended=null;audio.onerror=null;signal.removeEventListener('abort',annuler)};const terminer=(e?:unknown)=>{if(fini)return;fini=true;nettoyer();e?non(e):ok()};const annuler=()=>{audio.pause();audio.removeAttribute('src');audio.load();terminer(new DOMException('Aborted','AbortError'))};audio.onplaying=()=>debut?.();audio.onended=()=>terminer();audio.onerror=()=>terminer(Error(t("La lecture vocale s'est interrompue. Réessayez.")));signal.addEventListener('abort',annuler,{once:true});if(signal.aborted)return annuler();void audio.play().catch(terminer)})}finally{audio.pause();audio.removeAttribute('src');audio.load();URL.revokeObjectURL(url)}
}
