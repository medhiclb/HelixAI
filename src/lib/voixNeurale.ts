import { apiFetch } from './endpoint';
import { t } from './i18n';
export interface EtatVoix {installee:boolean;installationEnCours:boolean;installable:boolean;langues:string[];telechargementMo:number;placeMo:number}
export async function etatVoix():Promise<EtatVoix|null>{try{const r=await apiFetch('/helix/voix',{signal:AbortSignal.timeout(10000)});return r.ok?await r.json():null}catch{return null}}
export async function installerVoix():Promise<EtatVoix>{const r=await apiFetch('/helix/voix/installer',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({accord:true}),signal:AbortSignal.timeout(600000)});const b=await r.json();if(!r.ok)throw Error(b.error?.message??t("La préparation de la voix a échoué. Réessayez."));return b}
/** Le WAV n'est présent qu'en mémoire, et son URL cesse d'exister après lecture ou annulation. */
export async function lireVoixNeurale(texte:string,vitesse:number,signal:AbortSignal,debut?:()=>void):Promise<void>{
 const r=await apiFetch('/helix/voix',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({texte,langue:'fr',vitesse}),signal});
 if(!r.ok){const b=await r.json().catch(()=>({}));throw Error(b.error?.message??t("La génération de la voix a échoué. Réessayez."))}
 const son=await r.blob();signal.throwIfAborted();const url=URL.createObjectURL(son),audio=new Audio(url);
 try{await new Promise<void>((ok,non)=>{let fini=false;const nettoyer=()=>{audio.onplaying=null;audio.onended=null;audio.onerror=null;signal.removeEventListener('abort',annuler)};const terminer=(e?:unknown)=>{if(fini)return;fini=true;nettoyer();e?non(e):ok()};const annuler=()=>{audio.pause();audio.removeAttribute('src');audio.load();terminer(new DOMException('Aborted','AbortError'))};audio.onplaying=()=>debut?.();audio.onended=()=>terminer();audio.onerror=()=>terminer(Error(t("La lecture vocale s'est interrompue. Réessayez.")));signal.addEventListener('abort',annuler,{once:true});if(signal.aborted)return annuler();void audio.play().catch(terminer)})}finally{audio.pause();audio.removeAttribute('src');audio.load();URL.revokeObjectURL(url)}
}
