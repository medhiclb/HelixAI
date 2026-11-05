import { useEffect, useRef, useState } from "react";
import { Mic, Pause, Play, Square, Volume2, Loader2, RotateCcw } from "lucide-react";
import { AvatarCoach } from "./AvatarCoach";
import { Button } from "@/components/ui/Button";
import { t, tf } from "@/lib/i18n";
import { lireQuestion, type Entretien } from "@/lib/entretiens";
import * as dictee from "@/lib/dictee";
import { SilenceOral } from "@/lib/silenceOral";
import { currentUser } from "@/lib/store/identity";

import { etatVoix, installerVoix, lireVoixNeurale, type EtatVoix } from "@/lib/voixNeurale";

type Phase = "repos" | "preparation" | "lecture" | "ouverture" | "ecoute" | "transcription" | "attente";
/** Aucun micro avant le clic initial. Le son est transcrit par l'instance, jamais par le navigateur. */
export function ConversationOrale({session,occupe,onReponse,onBilan}:{session:Entretien;occupe:boolean;onReponse:(texte:string)=>Promise<void>;onBilan:()=>Promise<void>}) {
 const [actif,setActif]=useState(false),[phase,setPhase]=useState<Phase>("repos"),[erreur,setErreur]=useState("");
 const [diag,setDiag]=useState<dictee.DiagnosticDictee|null>(null),[installation,setInstallation]=useState(false),[progres,setProgres]=useState("");
 const [voix,setVoix]=useState(""),[vitesse,setVitesse]=useState(0.95),[automatique,setAutomatique]=useState(true),[,rafraichir]=useState(0),[secondes,setSecondes]=useState(0);
 const [neurale,setNeurale]=useState<EtatVoix|null>(null),[poseVoix,setPoseVoix]=useState(false);
 const [dernierTexte,setDernierTexte]=useState("");
 const generation=useRef(0),enregistreur=useRef<dictee.Enregistreur|null>(null),contexte=useRef<AudioContext|null>(null),animation=useRef(0),controle=useRef<AbortController|null>(null),lu=useRef("");
 const auteur=useRef(currentUser().id),present=useRef(true),phaseRef=useRef<Phase>(phase);phaseRef.current=phase;
 const derniere=useRef({session,occupe,onReponse,automatique});derniere.current={session,occupe,onReponse,automatique};
 const tour=session.tours.at(-1),cle=session.bilan?"bilan":tour?.id??"";
 const voixLocales=typeof speechSynthesis==='undefined'?[]:speechSynthesis.getVoices().filter(v=>v.localService&&v.lang.toLowerCase().startsWith(session.langue.toLowerCase()));
 const choisie=voixLocales.find(v=>v.voiceURI===voix)??voixLocales[0];
 const kokoro=voix==='kokoro-fr'&&neurale?.installee&&session.langue==='fr';
 const voixDisponible=Boolean(kokoro||choisie);
 useEffect(()=>{let annule=false;void etatVoix().then(d=>{if(annule)return;setNeurale(d);if(d?.installee&&session.langue==='fr')setVoix('kokoro-fr')});return()=>{annule=true}},[session.langue]);
 const valable=(g:number)=>present.current&&generation.current===g&&auteur.current===currentUser().id;
 const fermerMicro=()=>{cancelAnimationFrame(animation.current);enregistreur.current?.abandonner();enregistreur.current=null;void contexte.current?.close().catch(()=>{});contexte.current=null;};
 const interrompre=()=>{generation.current++;controle.current?.abort();fermerMicro();window.speechSynthesis?.cancel();};
 const pause=()=>{interrompre();if(present.current){setActif(false);setPhase("repos");phaseRef.current="repos";}};
 useEffect(()=>{present.current=true;void dictee.etat().then(d=>{if(present.current)setDiag(d)});const changement=()=>rafraichir(v=>v+1);window.speechSynthesis?.addEventListener('voiceschanged',changement);const cacher=()=>{if(document.hidden)pause()};const changerCompte=()=>{pause();setDernierTexte("")};document.addEventListener('visibilitychange',cacher);window.addEventListener('helix:identite-changee',changerCompte);return()=>{present.current=false;interrompre();window.speechSynthesis?.removeEventListener('voiceschanged',changement);document.removeEventListener('visibilitychange',cacher);window.removeEventListener('helix:identite-changee',changerCompte)}},[]);
 const echouer=(e:unknown,g:number)=>{if(!valable(g))return;pause();setErreur(e instanceof Error?e.message:String(e));};
 const terminer=async()=>{
  if(phaseRef.current!=="ecoute")return;
  phaseRef.current="transcription";setPhase("transcription");cancelAnimationFrame(animation.current);void contexte.current?.close().catch(()=>{});contexte.current=null;
  const g=generation.current,r=enregistreur.current;enregistreur.current=null;
  try{
   if(!r)return;const son=await r.arreter();if(!valable(g))return;
   const abort=new AbortController();controle.current=abort;
   const resultat=await dictee.transcrire(son,derniere.current.session.langue,abort.signal);if(!valable(g))return;
   const texte=resultat.texte.trim().slice(0,6000);if(!texte)throw Error(t("Je n'ai pas entendu de réponse. Réessayez au micro."));
   setDernierTexte(texte);setPhase("attente");phaseRef.current="attente";await derniere.current.onReponse(texte);
   if(valable(g)){setPhase("repos");phaseRef.current="repos";}
  }catch(e){r?.abandonner();echouer(e,g)}
 };
 const terminerRef=useRef(terminer);terminerRef.current=terminer;
 const ecouter=async()=>{
  const s=derniere.current;if(auteur.current!==currentUser().id||s.occupe||s.session.enCours||s.session.bilan||s.session.tours.at(-1)?.reponse)return;
  interrompre();const g=generation.current;setErreur("");setPhase("ouverture");phaseRef.current="ouverture";
  const r=new dictee.Enregistreur();enregistreur.current=r;
  try{
   const silence=new SilenceOral();let debut=0;let analyseur:AnalyserNode|undefined;
   await r.demarrer(flux=>{if(!valable(g))return;const ctx=new AudioContext();contexte.current=ctx;analyseur=ctx.createAnalyser();analyseur.fftSize=1024;ctx.createMediaStreamSource(flux).connect(analyseur);void ctx.resume().catch(()=>{});});
   if(!valable(g)){r.abandonner();return;}debut=performance.now();setPhase("ecoute");phaseRef.current="ecoute";setSecondes(0);
   const donnees=new Uint8Array(1024);let affichage=-1;
   const observer=()=>{if(!valable(g)){r.abandonner();return;}const ms=performance.now();const sec=Math.floor((ms-debut)/1000);if(sec!==affichage){affichage=sec;setSecondes(sec)}
    let niveau=0;if(analyseur){analyseur.getByteTimeDomainData(donnees);niveau=Math.sqrt(donnees.reduce((n,x)=>n+((x-128)/128)**2,0)/donnees.length)}
    if(sec>=dictee.DICTEE_MAX_SECONDES||silence.observer(niveau,ms)){void terminerRef.current();return;}
    animation.current=requestAnimationFrame(observer);
   };observer();
  }catch(e){r.abandonner();echouer(new Error(dictee.messageErreurMicro(e)),g)}
 };
 const ecouterRef=useRef(ecouter);ecouterRef.current=ecouter;
 const prononcer=()=>{
  if(!voixDisponible)return;interrompre();const g=generation.current;setErreur("");setPhase("lecture");phaseRef.current="lecture";
  const texte=session.bilan?[t("Votre bilan d'entraînement"),...session.bilan.forces,...session.bilan.progres,session.bilan.exercice].join('. '):[tour?.correction,tour?.explication,tour?.question].filter(Boolean).join('\n');
  const fin=()=>{if(!valable(g))return;setPhase("repos");phaseRef.current="repos";if(derniere.current.automatique)void ecouterRef.current()};
  if(kokoro){const abort=new AbortController();controle.current=abort;setPhase('preparation');phaseRef.current='preparation';void lireVoixNeurale(texte,vitesse,abort.signal,()=>{if(valable(g)){setPhase('lecture');phaseRef.current='lecture'}},()=>{if(valable(g)){setPhase('preparation');phaseRef.current='preparation'}}).then(fin).catch(e=>echouer(e,g));return;}
  try{lireQuestion(texte,session.langue,{voix:choisie?.voiceURI,vitesse,fin,erreur:m=>echouer(new Error(m),g)})}catch(e){echouer(e,g)}
 };
 const prononcerRef=useRef(prononcer);prononcerRef.current=prononcer;
 useEffect(()=>{if(!actif||occupe||session.enCours||!cle||lu.current===cle)return;lu.current=cle;prononcerRef.current()},[actif,occupe,session.enCours,cle]);
 useEffect(()=>{if((occupe||session.enCours)&&["preparation","lecture","ecoute","ouverture"].includes(phaseRef.current)){interrompre();setPhase("attente");phaseRef.current="attente";}},[occupe,session.enCours]);
 const commencer=async()=>{if(auteur.current!==currentUser().id||!voixDisponible||(!session.bilan&&!diag?.installee))return;setErreur("");interrompre();const g=generation.current;if(session.bilan){lu.current="";setActif(true);return;}setPhase("ouverture");phaseRef.current="ouverture";
  // Le premier clic demande l'accès au micro ; les pistes sont libérées avant que le coach parle.
  const r=new dictee.Enregistreur();enregistreur.current=r;try{await r.demarrer();r.abandonner();if(enregistreur.current===r)enregistreur.current=null;if(!valable(g))return;lu.current="";setActif(true)}catch(e){r.abandonner();echouer(new Error(dictee.messageErreurMicro(e)),g)}
 };
 const installer=async()=>{setInstallation(true);setErreur("");try{const r=await dictee.installer(p=>{if(present.current)setProgres(p.message)});if(present.current){setDiag(r.diagnostic);if(!r.ok)setErreur(r.message)}}catch(e){if(present.current)setErreur(String(e))}finally{if(present.current)setInstallation(false)}};
 const reponses=session.tours.filter(x=>x.reponse).length;
 const cours=session.mode==='cours';
 const attente=occupe||session.enCours||phase==="attente";
 const statut=attente?t("Le coach prépare la suite..."):phase==="preparation"?t("Préparation de la voix..."):phase==="lecture"?t("Le recruteur vous parle"):phase==="ecoute"?t("Je vous écoute"):phase==="transcription"?t("Transcription de votre réponse..."):phase==="ouverture"?t("Ouverture du micro..."):actif?(session.bilan?t("Votre bilan d'entraînement"):t("À vous de parler")):t("Un entretien à voix haute");
 return <section className="relative overflow-hidden rounded-[2rem] border border-accent/25 bg-gradient-to-br from-accent/10 via-card to-info/10 p-5 text-center sm:p-6">
  <div className="mx-auto flex max-w-2xl flex-col items-center gap-5">
   <div className="w-full space-y-2"><p className="text-sm text-muted-foreground">{reponses===1?tf("{0} réponse sur {1} questions",reponses,session.nombre):tf("{0} réponses sur {1} questions",reponses,session.nombre)}</p><div role="progressbar" aria-label={t("Progression de la séance")} aria-valuemin={0} aria-valuemax={session.nombre} aria-valuenow={session.tours.filter(x=>x.reponse).length} className="h-1.5 overflow-hidden rounded-full bg-accent/10"><div className="h-full bg-accent" style={{width:`${session.tours.filter(x=>x.reponse).length/session.nombre*100}%`}}/></div></div>
   <div className={`rounded-full border border-accent/20 p-4 ${phase==='lecture'||phase==='ecoute'?'bg-accent/15 ring-8 ring-accent/5':'bg-card/60'}`}><AvatarCoach style={cours?(session.profil?.style??'patient'):'entretien'} className="h-32 w-28 sm:h-40 sm:w-36"/></div>
   <p role="status" aria-live="polite" className="flex items-center gap-2 text-xl font-semibold">{attente||phase==='transcription'||phase==='preparation'?<Loader2 className="animate-spin motion-reduce:animate-none"/>:phase==='ecoute'?<Mic className="text-accent"/>:<Volume2 className="text-accent"/>}{cours&&phase==='lecture'?t("Le prof vous parle"):statut}</p>
   {phase==='ecoute'&&<p className="text-sm text-muted-foreground">{tf("Micro ouvert : {0} s",secondes)}</p>}
   {!actif&&<p className="max-w-xl text-sm leading-relaxed text-muted-foreground">{t("Le coach parle, vous répondez. Votre réponse est transcrite par l'instance puis transmise au modèle de la séance. Le micro s'arrête après un silence ou avec le bouton Terminer.")}</p>}
   {erreur&&<p role="alert" className="rounded-2xl border border-destructive/30 bg-card p-4 text-sm text-destructive">{erreur}</p>}
   {!voixDisponible&&<p className="text-sm">{t("Aucune voix locale disponible pour cette langue.")} {t("Ajoutez une voix dans les réglages de langue de votre système, puis revenez ici.")}</p>}
   {!diag&&<Button variant="secondary" onClick={()=>void dictee.etat().then(setDiag)}>{t("Réessayer")}</Button>}
   {diag&&!diag.installee&&!session.bilan&&<div className="space-y-2"><p className="text-sm">{t("La transcription locale doit être préparée pour répondre au micro.")}</p><Button disabled={installation||!diag.installable} onClick={()=>void installer()} icon={installation?Loader2:Mic}>{t("Préparer la transcription locale")}</Button>{installation&&<p role="status" className="text-xs">{progres}</p>}</div>}
   <div className="flex flex-wrap justify-center gap-3">
    {!actif?<Button className="min-h-12" icon={Play} disabled={!voixDisponible||(!session.bilan&&!diag?.installee)||attente||installation||phase==='ouverture'||!cle} onClick={()=>void commencer()}>{session.bilan?t("Écouter le bilan"):t("Démarrer avec le micro")}</Button>:<>
     {!session.bilan&&(phase==='ecoute'?<Button className="min-h-12" icon={Square} onClick={()=>void terminer()}>{t("Terminer ma réponse")}</Button>:<Button className="min-h-12" icon={Mic} disabled={attente||phase==='transcription'||phase==='ouverture'||Boolean(session.bilan)} onClick={()=>void ecouter()}>{t("Répondre au micro")}</Button>)}
     <Button className="min-h-12" variant="secondary" icon={Pause} onClick={pause}>{t("Pause")}</Button>
     <Button className="min-h-12" variant="ghost" icon={RotateCcw} disabled={attente||phase==='transcription'||phase==='ouverture'} onClick={prononcer}>{t("Réécouter")}</Button>
    </>}
   </div>
   {dernierTexte&&<details className="w-full rounded-2xl border border-border bg-card/60 p-4 text-start"><summary className="cursor-pointer text-sm font-medium">{t("Ma dernière réponse transcrite")}</summary><p className="mt-3 whitespace-pre-wrap text-sm" dir="auto">{dernierTexte}</p></details>}
   <details className="w-full rounded-2xl border border-border bg-card/60 p-4 text-start"><summary className="cursor-pointer text-sm font-medium">{t("Voix et rythme")}</summary><div className="mt-4 grid gap-4 sm:grid-cols-2">
    <label className="text-sm">{t("Voix locale")}<select className="mt-2 w-full rounded-xl border border-border bg-card p-2" value={kokoro?'kokoro-fr':choisie?.voiceURI??''} disabled={actif} onChange={e=>setVoix(e.target.value)}>{neurale?.installee&&session.langue==='fr'&&<option value="kokoro-fr">{t("Voix neuronale française")}</option>}{voixLocales.map(v=><option key={v.voiceURI} value={v.voiceURI}>{v.name}</option>)}</select></label>
    {session.langue==='fr'&&!neurale?.installee&&<div className="space-y-2 text-sm"><p>{t("Une voix neuronale française peut être installée sur cette instance. Prévoyez 700 Mo d'espace libre.")}</p><Button variant="secondary" disabled={actif||poseVoix||!neurale?.installable} onClick={()=>{setPoseVoix(true);setErreur("");const compte=currentUser().id;void installerVoix().then(d=>{if(present.current&&compte===currentUser().id){setNeurale(d);setVoix('kokoro-fr')}}).catch(e=>{if(present.current&&compte===currentUser().id)setErreur(String(e))}).finally(()=>{if(present.current)setPoseVoix(false)})}}>{poseVoix?t("Préparation de la voix..."):t("Préparer la voix neuronale")}</Button></div>}
    <label className="text-sm">{t("Vitesse de la voix")}<input className="mt-3 block w-full accent-accent" type="range" min="0.8" max="1.2" step="0.05" disabled={actif} value={vitesse} onChange={e=>setVitesse(Number(e.target.value))}/></label>
    <label className="col-span-full flex items-start gap-3 text-sm"><input type="checkbox" className="mt-1 accent-accent" checked={automatique} onChange={e=>setAutomatique(e.target.checked)}/>{t("Ouvrir le micro après chaque question")}</label>
   </div></details>
   {!session.bilan&&session.tours.some(x=>x.reponse)&&<Button variant="ghost" disabled={Boolean(attente)||phase==='transcription'||phase==='ouverture'} onClick={()=>{interrompre();void onBilan()}}>{t("Terminer et recevoir le bilan")}</Button>}
  </div>
 </section>;
}
