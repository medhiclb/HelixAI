import { currentUser } from "./store/identity";
import { getProject, updateProject, deleteProject } from "./store/projects";
import { apiFetch } from "./endpoint";
import { creerImage, type ImageCreee, type Travail } from "./images";
import { t } from "./i18n";

export interface SceneVideo { id: string; description: string; clip?: ImageCreee; image?: ImageCreee; travail?: string; travailImage?: boolean; erreur?: string; sources?: string[]; titre?: string; debut?: number; fin?: number; duree?: number }
export interface NoteStudio { id: string; texte: string }
export interface PositionStudio { x: number; y: number }
export interface MediaStudio extends ImageCreee { date?: string; secondes?: number; audio?: boolean; mime?: string; supprimeLe?: string }
export interface StudioVideo { brief?: string; format: "portrait" | "paysage" | "carre"; scenes: SceneVideo[]; notes?: NoteStudio[]; positions?: Record<string, PositionStudio>; supprimeLe?: string; archiveLe?: string; audio?: MediaStudio; volume?: number; style?: string }
const suivis = new Set<string>();
export const STUDIO_CHANGE = "helix:studio-video";
export function enregistrerStudio(id: string, studioVideo: StudioVideo) {
  const p = getProject(id);
  if (!p || p.ownerId !== currentUser().id || p.studioVideo?.supprimeLe) throw new Error(t("Projet introuvable."));
  updateProject(id, { studioVideo });
  window.dispatchEvent(new Event(STUDIO_CHANGE));
  window.dispatchEvent(new Event("helix:projects-changed"));
}
/** Le suivi vit hors de la page : naviguer ne coupe pas la génération. */
export async function suivreScene(projet: string, scene: string, travail: string) {
  if (suivis.has(travail)) return;
  suivis.add(travail);
  const auteur = currentUser().id;
  const modifier = (patch: Partial<SceneVideo>) => {
    const p = getProject(projet);
    if (currentUser().id !== auteur || p?.ownerId !== auteur || !p.studioVideo) return;
    enregistrerStudio(projet, { ...p.studioVideo, scenes: p.studioVideo.scenes.map(s => s.id === scene && s.travail === travail ? { ...s, ...patch } : s) });
  };
  try {
    for (;;) {
      if (currentUser().id !== auteur) return;
      const r = await apiFetch(`/helix/images/travail/${encodeURIComponent(travail)}`);
      if (!r.ok) throw new Error(t("Le suivi n'est plus disponible. Vous pouvez relancer cette scène."));
      const tr = await r.json() as Travail;
      window.dispatchEvent(new CustomEvent(STUDIO_CHANGE, { detail: tr }));
      if (tr.etat === "fait" && tr.image) { const image = getProject(projet)?.studioVideo?.scenes.find(s => s.id === scene)?.travailImage; modifier({ ...(image ? { image: tr.image, clip: undefined, debut: undefined, fin: undefined } : { clip: tr.image }), travail: undefined, travailImage: undefined, erreur: undefined }); return; }
      if (tr.etat === "echec") throw new Error(tr.erreur || tr.message);
      await new Promise(r => setTimeout(r, 2000));
    }
  } catch (e) { modifier({ travail: undefined, travailImage: undefined, erreur: e instanceof Error ? e.message : String(e) }); }
  finally { suivis.delete(travail); }
}
export async function genererScene(projet: string, scene: string) {
  const p = getProject(projet);
  const s = p?.studioVideo?.scenes.find(x => x.id === scene);
  if (!p?.studioVideo || p.studioVideo.supprimeLe || p.ownerId !== currentUser().id || !s?.description.trim()) throw new Error(t("Décrivez cette scène avant de la générer."));
  const r = await apiFetch("/helix/videos/creer", { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ description: descriptionScene(p.studioVideo, s), format: p.studioVideo.format === "portrait" ? "portrait" : "paysage" }) });
  const tr = await r.json() as Travail & { error?: { message?: string } };
  if (!r.ok) throw new Error(tr.error?.message ?? t("L'instance n'a pas répondu."));
  const actuel = getProject(projet);
  if (!actuel?.studioVideo || actuel.studioVideo.supprimeLe || actuel.ownerId !== currentUser().id || !actuel.studioVideo.scenes.some(x => x.id === scene)) return;
  enregistrerStudio(projet, { ...actuel.studioVideo, scenes: actuel.studioVideo.scenes.map(x => x.id === scene ? { ...x, travail: tr.id, erreur: undefined } : x) });
  void suivreScene(projet, scene, tr.id);
}

/** Les liens du canevas alimentent vraiment la demande du générateur. */
export function descriptionScene(studio: StudioVideo, scene: SceneVideo): string {
  const sources = scene.sources ?? ["brief"];
  const textes = sources.map(id => id === "brief" ? studio.brief : studio.notes?.find(n => n.id === id)?.texte).filter(Boolean);
  return [...textes, studio.style, scene.description].filter(Boolean).join("\n\n").slice(0, 2000);
}

export async function genererImageScene(projet: string, scene: string) {
  const p = getProject(projet); const s = p?.studioVideo?.scenes.find(x => x.id === scene);
  if (!p?.studioVideo || p.ownerId !== currentUser().id || p.studioVideo.supprimeLe || !s) throw new Error(t("Projet introuvable."));
  try {
    const auteur = currentUser().id;
    const image = await creerImage(descriptionScene(p.studioVideo, s), p.studioVideo.format, tr => {
      const actuel = getProject(projet);
      if (currentUser().id !== auteur || actuel?.ownerId !== auteur || !actuel.studioVideo || actuel.studioVideo.supprimeLe) return;
      enregistrerStudio(projet, { ...actuel.studioVideo, scenes: actuel.studioVideo.scenes.map(x => x.id === scene ? { ...x, travail: tr.id, travailImage: true, erreur: undefined } : x) });
    });
    const actuel = getProject(projet)?.studioVideo;
    if (actuel && !actuel.supprimeLe) enregistrerStudio(projet, { ...actuel, scenes: actuel.scenes.map(x => x.id === scene ? { ...x, image, clip: undefined, debut: undefined, fin: undefined, travail: undefined, travailImage: undefined } : x) });
  } catch (err) {
    const actuel = getProject(projet)?.studioVideo;
    if (actuel && !actuel.supprimeLe) enregistrerStudio(projet, { ...actuel, scenes: actuel.scenes.map(x => x.id === scene ? { ...x, travail: undefined, travailImage: undefined, erreur: err instanceof Error ? err.message : String(err) } : x) });
    throw err;
  }
}

export function statutProjetStudio(id: string, action: "corbeille" | "restaurer" | "archiver" | "desarchiver" | "supprimer") {
  const p = getProject(id);
  if (!p?.studioVideo || p.ownerId !== currentUser().id) throw new Error(t("Projet introuvable."));
  if (p.studioVideo.scenes.some(s => s.travail || s.travailImage)) throw new Error(t("Attendez la fin de la création en cours."));
  if (action === "supprimer") { if (!p.studioVideo.supprimeLe) return; deleteProject(id); }
  else updateProject(id, { studioVideo: { ...p.studioVideo,
    ...(action === "corbeille" || action === "restaurer" ? { supprimeLe: action === "corbeille" ? new Date().toISOString() : undefined } : {}),
    ...(action === "archiver" || action === "desarchiver" ? { archiveLe: action === "archiver" ? new Date().toISOString() : undefined } : {}) } });
  window.dispatchEvent(new Event(STUDIO_CHANGE)); window.dispatchEvent(new Event("helix:projects-changed"));
}

export async function lireMediasStudio(): Promise<MediaStudio[]> {
  const r = await apiFetch("/helix/studio/medias"); const d = await r.json();
  if (!r.ok) throw new Error(d.error?.message ?? t("L'instance n'a pas répondu."));
  if (!Array.isArray(d.medias)) throw new Error(t("L'instance n'a pas répondu."));
  return d.medias;
}
export async function modifierMedia(id: string, action: "corbeille" | "restaurer" | "supprimer") {
  const r = await apiFetch(`/helix/studio/medias/${encodeURIComponent(id)}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
  if (!r.ok) { const d = await r.json(); throw new Error(d.error?.message ?? t("L'instance n'a pas répondu.")); }
}
export async function importerMedia(fichier: File): Promise<MediaStudio> {
  if (fichier.size > 40 * 1024 * 1024) throw new Error(t("Le média est invalide ou dépasse 40 Mo."));
  let contenu = await new Promise<string>((ok, non) => { const l = new FileReader(); l.onload = () => ok(String(l.result)); l.onerror = () => non(new Error(t("Le média n'a pas pu être lu."))); l.readAsDataURL(fichier); });
  const alias: Record<string,string> = { "audio/x-wav":"audio/wav", "audio/wave":"audio/wav", "audio/mp3":"audio/mpeg", "image/jpg":"image/jpeg" };
  const mime = alias[fichier.type];
  if(mime) contenu=contenu.replace(/^data:[^;]+;/,`data:${mime};`);
  const r = await apiFetch("/helix/studio/medias", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contenu, nom: fichier.name }) });
  const d = await r.json(); if (!r.ok) throw new Error(d.error?.message ?? t("L'instance n'a pas répondu.")); return d;
}

export function telechargerBlob(blob: Blob, nom: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = nom; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** Assemble les clips sur le poste, sans bibliothèque ni service externe.
 * Réencodage WebM en temps réel avec titres et mixage audio local.
 * Une erreur de lecture arrête l'export au lieu de produire une vidéo partielle.
 */
export interface PlanMontage { id: string; video?: boolean; debut?: number; fin?: number; duree?: number; titre?: string }
export async function assemblerClips(
  entrees: string[] | PlanMontage[], format: StudioVideo["format"], suivre: (rang: number) => void, signal: AbortSignal,
  options: { audio?: string; volume?: number } = {},
): Promise<Blob> {
  if (!entrees.length || !window.MediaRecorder || !HTMLCanvasElement.prototype.captureStream) throw new Error(t("L'assemblage vidéo n'est pas disponible dans ce navigateur."));
  const mime = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"].find(x => MediaRecorder.isTypeSupported(x));
  if (!mime) throw new Error(t("L'assemblage vidéo n'est pas disponible dans ce navigateur."));
  const canevas = document.createElement("canvas");
  canevas.width = format === "portrait" ? 480 : 832; canevas.height = format === "paysage" ? 480 : 832;
  const c = canevas.getContext("2d"); if (!c) throw new Error(t("L'assemblage vidéo n'est pas disponible dans ce navigateur."));
  const flux = canevas.captureStream(24);
  let silence: AudioBufferSourceNode | null = null;
  let contexteAudio: AudioContext | null = null; let destination: MediaStreamAudioDestinationNode | null = null;
  let musique: HTMLAudioElement | null = null; let urlMusique: string | null = null;
  let enregistreur: MediaRecorder | null = null; let video: HTMLVideoElement | null = null; let adresse: string | null = null; let frame = 0;
  const morceaux: Blob[] = [];
  const charge = (element: HTMLMediaElement, url: string) => new Promise<void>((ok, non) => {
    const nettoyer = () => { clearTimeout(garde); element.removeEventListener("loadeddata", pret); element.removeEventListener("error", erreur); signal.removeEventListener("abort", arret); };
    const pret = () => { nettoyer(); ok(); }; const erreur = () => { nettoyer(); non(new Error(t("Un clip n'a pas pu être lu. L'export est arrêté."))); };
    const arret = () => { nettoyer(); non(new DOMException("arrêt", "AbortError")); }; const garde = setTimeout(erreur, 30000);
    element.addEventListener("loadeddata", pret); element.addEventListener("error", erreur); signal.addEventListener("abort", arret, { once: true }); element.src = url;
    if (signal.aborted) arret();
  });
  const dessiner = (source: CanvasImageSource, largeur: number, hauteur: number, titre?: string) => {
    c.fillStyle = "black"; c.fillRect(0,0,canevas.width,canevas.height);
    const ratio = Math.min(canevas.width / largeur, canevas.height / hauteur);
    c.drawImage(source, (canevas.width-largeur*ratio)/2, (canevas.height-hauteur*ratio)/2, largeur*ratio, hauteur*ratio);
    const demanderImage=()=> (flux.getVideoTracks()[0] as CanvasCaptureMediaStreamTrack | undefined)?.requestFrame?.();
    if (!titre?.trim()) { demanderImage(); return; }
    c.font = `600 ${Math.round(canevas.width*0.043)}px sans-serif`; c.textAlign = "center"; c.textBaseline = "middle";
    const lignes: string[] = []; let ligne = "";
    for (const mot of titre.slice(0,200).split(/\s+/)) { const essai = ligne ? ligne + " " + mot : mot; if (c.measureText(essai).width > canevas.width*0.86 && ligne) { lignes.push(ligne); ligne=mot; } else ligne=essai; }
    if(ligne) lignes.push(ligne); const retenues=lignes.slice(0,4); const pas=canevas.width*0.058;
    const haut = canevas.height - pas*(retenues.length+1.1);
    c.fillStyle="rgba(0,0,0,0.65)"; c.fillRect(canevas.width*0.04,haut,canevas.width*0.92,pas*(retenues.length+0.6)); c.fillStyle="white";
    retenues.forEach((texte,i) => c.fillText(texte,canevas.width/2,haut+pas*(i+0.8),canevas.width*0.86));
    demanderImage();
  };
  try {
    signal.throwIfAborted();
    if (typeof AudioContext !== "undefined") {
      contexteAudio = new AudioContext(); await contexteAudio.resume(); destination = contexteAudio.createMediaStreamDestination();
      // Un montage qui commence par une image n'a pas encore de source audio.
      // Sans horloge silencieuse, Chromium attend cette piste et peut rendre un fichier vide.
      silence=contexteAudio.createBufferSource();silence.buffer=contexteAudio.createBuffer(1,128,contexteAudio.sampleRate);silence.loop=true;silence.connect(destination);silence.start();
      for (const piste of destination.stream.getAudioTracks()) flux.addTrack(piste);
    }
    if (options.audio) {
      if (!contexteAudio || !destination) throw new Error(t("Le mixage audio n'est pas disponible dans ce navigateur."));
      const r=await apiFetch(`/helix/images/fichier/${encodeURIComponent(options.audio)}`,{signal}); if(!r.ok) throw new Error(t("Le média n'a pas pu être lu."));
      urlMusique=URL.createObjectURL(await r.blob()); musique=document.createElement("audio"); musique.loop=true;
      await charge(musique,urlMusique); const source=contexteAudio.createMediaElementSource(musique); const volume=contexteAudio.createGain();
      volume.gain.value=Math.max(0,Math.min(1,options.volume??0.3)); source.connect(volume); volume.connect(destination);
    }
    enregistreur=new MediaRecorder(flux,{mimeType:mime}); const rec=enregistreur;
    const fini=new Promise<Blob>((ok,non)=>{ rec.ondataavailable=e=>{if(e.data.size)morceaux.push(e.data)}; rec.onerror=()=>non(new Error(t("L'export vidéo a échoué."))); rec.onstop=()=>ok(new Blob(morceaux,{type:"video/webm"})); }); void fini.catch(()=>{});
    const demarrer=async()=>{if(rec.state==="inactive"){rec.start(1000);if(musique)await musique.play()}};
    for(const [i,entree] of entrees.entries()){
      signal.throwIfAborted(); suivre(i+1); const plan:PlanMontage=typeof entree==="string"?{id:entree,video:true}:entree;
      const r=await apiFetch(`/helix/images/fichier/${encodeURIComponent(plan.id)}`,{signal}); if(!r.ok)throw new Error(t("Un clip n'a pas pu être lu. L'export est arrêté."));
      const blob=await r.blob(); adresse=URL.createObjectURL(blob);
      if(plan.video===false || blob.type.startsWith("image/")){
        const image=await createImageBitmap(blob);
        try{
          await demarrer();
          dessiner(image,image.width,image.height,plan.titre);
          await new Promise<void>((ok,non)=>{
            const peindre=()=>dessiner(image,image.width,image.height,plan.titre);
            const intervalle=setInterval(peindre,1000/24);
            const nettoyer=()=>{clearInterval(intervalle);clearTimeout(timer);signal.removeEventListener("abort",arret)};
            const arret=()=>{nettoyer();non(new DOMException("arrêt","AbortError"))};
            const timer=setTimeout(()=>{peindre();nettoyer();ok()},Math.max(0.5,Math.min(30,plan.duree??3))*1000);
            signal.addEventListener("abort",arret,{once:true});if(signal.aborted)arret();
          });
        }finally{cancelAnimationFrame(frame);image.close()}
      }else{
        video=document.createElement("video"); const v=video;v.playsInline=true;v.muted=!contexteAudio;
        await charge(v,adresse);
        const debut=Math.max(0,plan.debut??0);const fin=Math.min(Number.isFinite(v.duration)?v.duration:120,plan.fin??Infinity);
        if(!Number.isFinite(fin)||fin<=debut)throw new Error(t("La fin du clip doit venir après son début."));
        if(debut>0)await new Promise<void>((ok,non)=>{const nettoyer=()=>{clearTimeout(timer);v.onseeked=null;signal.removeEventListener("abort",arret)};const arret=()=>{nettoyer();non(new DOMException("arrêt","AbortError"))};const timer=setTimeout(()=>{nettoyer();non(new Error(t("Le média n'a pas pu être lu.")))},15000);v.onseeked=()=>{nettoyer();ok()};signal.addEventListener("abort",arret,{once:true});v.currentTime=debut;if(signal.aborted)arret()});
        let source:MediaElementAudioSourceNode|null=null;if(contexteAudio&&destination){source=contexteAudio.createMediaElementSource(v);source.connect(destination)}
        await demarrer();dessiner(v,v.videoWidth,v.videoHeight,plan.titre);
        try{await new Promise<void>((ok,non)=>{
          const nettoyer=()=>{clearTimeout(timer);cancelAnimationFrame(frame);v.onended=null;v.onerror=null;signal.removeEventListener("abort",arret)};
          const termine=()=>{nettoyer();v.pause();ok()};const arret=()=>{nettoyer();v.pause();non(new DOMException("arrêt","AbortError"))};
          const timer=setTimeout(()=>{nettoyer();non(new Error(t("Un clip n'a pas pu être lu. L'export est arrêté.")))},Math.min(600,fin-debut+15)*1000);
          const boucle=()=>{if(v.currentTime>=fin){termine();return}dessiner(v,v.videoWidth,v.videoHeight,plan.titre);frame=requestAnimationFrame(boucle)};
          v.onended=termine;v.onerror=()=>{nettoyer();non(new Error(t("Le média n'a pas pu être lu.")))};signal.addEventListener("abort",arret,{once:true});frame=requestAnimationFrame(boucle);
          if(signal.aborted){arret();return}void v.play().catch(e=>{nettoyer();non(e)});
        })}finally{source?.disconnect();v.pause();v.removeAttribute("src");video=null}
      }
      URL.revokeObjectURL(adresse);adresse=null;
    }
    rec.stop();return await fini;
  }finally{
    cancelAnimationFrame(frame);video?.pause();musique?.pause();silence?.stop();if(adresse)URL.revokeObjectURL(adresse);if(urlMusique)URL.revokeObjectURL(urlMusique);
    if(enregistreur&&enregistreur.state!=="inactive")enregistreur.stop();flux.getTracks().forEach(p=>p.stop());await contexteAudio?.close();
  }
}
