import { currentUser } from "./store/identity";
import { getProject, updateProject } from "./store/projects";
import { apiFetch } from "./endpoint";
import type { ImageCreee, Travail } from "./images";
import { t } from "./i18n";

export interface SceneVideo { id: string; description: string; clip?: ImageCreee; travail?: string; erreur?: string }
export interface StudioVideo { brief?: string; format: "portrait" | "paysage"; scenes: SceneVideo[] }
const suivis = new Set<string>();
export const STUDIO_CHANGE = "helix:studio-video";
export function enregistrerStudio(id: string, studioVideo: StudioVideo) {
  const p = getProject(id);
  if (!p || p.ownerId !== currentUser().id) throw new Error(t("Projet introuvable."));
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
      if (tr.etat === "fait" && tr.image) { modifier({ clip: tr.image, travail: undefined, erreur: undefined }); return; }
      if (tr.etat === "echec") throw new Error(tr.erreur || tr.message);
      await new Promise(r => setTimeout(r, 2000));
    }
  } catch (e) { modifier({ travail: undefined, erreur: e instanceof Error ? e.message : String(e) }); }
  finally { suivis.delete(travail); }
}
export async function genererScene(projet: string, scene: string) {
  const p = getProject(projet);
  const s = p?.studioVideo?.scenes.find(x => x.id === scene);
  if (!p?.studioVideo || p.ownerId !== currentUser().id || !s?.description.trim()) throw new Error(t("Décrivez cette scène avant de la générer."));
  const r = await apiFetch("/helix/videos/creer", { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ description: s.description, format: p.studioVideo.format }) });
  const tr = await r.json() as Travail & { error?: { message?: string } };
  if (!r.ok) throw new Error(tr.error?.message ?? t("L'instance n'a pas répondu."));
  enregistrerStudio(projet, { ...p.studioVideo, scenes: p.studioVideo.scenes.map(x => x.id === scene ? { ...x, travail: tr.id, erreur: undefined } : x) });
  void suivreScene(projet, scene, tr.id);
}

export function telechargerBlob(blob: Blob, nom: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = nom; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** Assemble les clips sur le poste, sans bibliothèque ni service externe.
 * Réencodage WebM en temps réel, sans piste audio (Wan produit des clips muets).
 * Une erreur de lecture arrête l'export au lieu de produire une vidéo partielle.
 */
export async function assemblerClips(ids: string[], format: StudioVideo["format"], suivre: (rang: number) => void, signal: AbortSignal): Promise<Blob> {
  if (!ids.length || !window.MediaRecorder || !HTMLCanvasElement.prototype.captureStream) throw new Error(t("L'assemblage vidéo n'est pas disponible dans ce navigateur."));
  const mime = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"].find(x => MediaRecorder.isTypeSupported(x));
  if (!mime) throw new Error(t("L'assemblage vidéo n'est pas disponible dans ce navigateur."));
  const canevas = document.createElement("canvas");
  canevas.width = format === "portrait" ? 480 : 832; canevas.height = format === "portrait" ? 832 : 480;
  const contexte = canevas.getContext("2d");
  if (!contexte) throw new Error(t("L'assemblage vidéo n'est pas disponible dans ce navigateur."));
  const flux = canevas.captureStream(24);
  const enregistreur = new MediaRecorder(flux, { mimeType: mime });
  const morceaux: Blob[] = [];
  let frame = 0;
  let video: HTMLVideoElement | null = null;
  let url: string | null = null;
  const fini = new Promise<Blob>((ok, non) => {
    enregistreur.ondataavailable = e => { if (e.data.size) morceaux.push(e.data); };
    enregistreur.onerror = () => non(new Error(t("L'export vidéo a échoué.")));
    enregistreur.onstop = () => ok(new Blob(morceaux, { type: "video/webm" }));
  });
  // La promesse de fin peut être rejetée pendant la lecture d'un clip.
  void fini.catch(() => undefined);
  try {
    for (const [i, id] of ids.entries()) {
      signal.throwIfAborted(); suivre(i + 1);
      const r = await apiFetch(`/helix/images/fichier/${encodeURIComponent(id)}`, { signal });
      if (!r.ok) throw new Error(t("Un clip n'a pas pu être lu. L'export est arrêté."));
      url = URL.createObjectURL(await r.blob());
      video = document.createElement("video"); video.muted = true; video.playsInline = true; video.src = url;
      const v = video;
      await new Promise<void>((ok, non) => {
        const nettoyer = () => { clearTimeout(garde); signal.removeEventListener("abort", arret); v.onloadeddata = null; v.onerror = null; };
        const arret = () => { nettoyer(); non(new DOMException("arrêt", "AbortError")); };
        const erreur = () => { nettoyer(); non(new Error(t("Un clip n'a pas pu être lu. L'export est arrêté."))); };
        const garde = setTimeout(erreur, 30_000);
        v.onloadeddata = () => { nettoyer(); ok(); }; v.onerror = erreur;
        signal.addEventListener("abort", arret, { once: true });
        if (signal.aborted) arret();
      });
      contexte.drawImage(v, 0, 0, canevas.width, canevas.height);
      if (enregistreur.state === "inactive") enregistreur.start(1000);
      await new Promise<void>((ok, non) => {
        const arret = () => { terminer(); non(new DOMException("arrêt", "AbortError")); };
        const garde = setTimeout(() => { terminer(); non(new Error(t("Un clip n'a pas pu être lu. L'export est arrêté."))); }, 120_000);
        const terminer = () => { clearTimeout(garde); signal.removeEventListener("abort", arret); cancelAnimationFrame(frame); v.onended = null; v.onerror = null; };
        signal.addEventListener("abort", arret, { once: true });
        v.onended = () => { terminer(); ok(); };
        v.onerror = () => { terminer(); non(new Error(t("Un clip n'a pas pu être lu. L'export est arrêté."))); };
        const dessiner = () => { contexte.drawImage(v, 0, 0, canevas.width, canevas.height); frame = requestAnimationFrame(dessiner); };
        frame = requestAnimationFrame(dessiner);
        if (signal.aborted) { arret(); return; }
        void v.play().catch(e => { terminer(); non(e); });
      });
      video.pause(); video.removeAttribute("src"); URL.revokeObjectURL(url); url = null;
    }
    enregistreur.stop();
    return await fini;
  } finally {
    cancelAnimationFrame(frame); video?.pause();
    if (url) URL.revokeObjectURL(url);
    if (enregistreur.state !== "inactive") enregistreur.stop();
    flux.getTracks().forEach(p => p.stop());
  }
}
