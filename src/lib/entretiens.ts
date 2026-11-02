import { apiFetch } from "./endpoint";
import { t } from "./i18n";
export interface TourEntretien {id:string;question:string;explication?:string;correction?:string;reponse?:string;secondes?:number}
export interface BilanEntretien {clarte:number;exemples:number;pertinence:number;forces:string[];progres:string[];exercice:string}
export interface ProfilProf {style:"patient"|"socratique"|"pratique"|"personnalise";niveau:string;objectif:string;preferences:string;difficultes:string}
export interface Entretien {mode?:"entretien"|"cours";profil?:ProfilProf;precedent?:string;id:string;nom:string;poste:string;cv:string;langue:string;difficulte:string;nombre:number;tours:TourEntretien[];bilan?:BilanEntretien;modele?:string;cree:string;maj:string;supprimeLe?:string;enCours?:boolean}
export async function listerEntretiens():Promise<Entretien[]>{const r=await apiFetch('/helix/services/entretiens');const d=await r.json();if(!r.ok||!Array.isArray(d.entretiens))throw Error(d.error?.message??t("L'instance n'a pas répondu."));return d.entretiens}
export async function actionEntretien(b:Record<string,unknown>):Promise<Entretien|null>{const r=await apiFetch('/helix/services/entretiens',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)});const d=await r.json();if(!r.ok)throw Error(d?.error?.message??t("L'instance n'a pas répondu."));return d}
/** La voix doit être annoncée locale par le système. Aucun repli sur une voix distante. */
export function voixLocale(langue:string):SpeechSynthesisVoice|undefined{return typeof speechSynthesis==='undefined'?undefined:speechSynthesis.getVoices().find(v=>v.localService&&v.lang.toLowerCase().startsWith(langue.toLowerCase()))}
export function lireQuestion(texte:string,langue:string){const voix=voixLocale(langue);if(!voix)throw Error(t("Aucune voix locale disponible pour cette langue."));speechSynthesis.cancel();const phrase=new SpeechSynthesisUtterance(texte);phrase.voice=voix;phrase.lang=voix.lang;phrase.rate=0.95;speechSynthesis.speak(phrase)}
