import { apiFetch } from "./endpoint";
import { t } from "@/lib/i18n";

/**
 * Création d'images sur la machine (gateway/src/images.ts), vue de l'interface.
 */

export type Format = "carre" | "portrait" | "paysage";
export type IdModele = "z-image" | "flux2-klein" | "qwen-image";

export interface ModeleImage {
  id: IdModele;
  nom: string;
  editeur: string;
  licence: string;
  atout: string;
  possible: boolean;
  telechargementGo: number;
  installe: boolean;
  conseille: boolean;
  verifie: boolean;
}

export interface EtatImages {
  possible: boolean;
  raison: string;
  pret: boolean;
  actif: IdModele | null;
  modeles: ModeleImage[];
  lent: boolean;
  installation: { modele: IdModele; etape: string; message: string; fait: number; total: number; erreur?: string } | null;
}

export interface ImageCreee {
  id: string;
  largeur: number;
  hauteur: number;
  description: string;
  /** Une vidéo (WebM), créée par le même moteur (27/09/2026). */
  video?: boolean;
  audio?: boolean;
  mime?: string;
  secondes?: number;
}

export interface Travail {
  id: string;
  etat: "preparation" | "encours" | "fait" | "echec";
  message: string;
  etape: number;
  total: number;
  image?: ImageCreee;
  erreur?: string;
}

async function lireErreur(res: Response): Promise<string> {
  const corps = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
  return corps.error?.message ?? t("L'instance n'a pas répondu.");
}

export async function etatImages(): Promise<EtatImages | null> {
  try {
    const res = await apiFetch("/helix/images");
    return res.ok ? ((await res.json()) as EtatImages) : null;
  } catch {
    return null;
  }
}

async function action(chemin: string, modele?: IdModele): Promise<void> {
  const res = await apiFetch(chemin, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ modele }),
  });
  if (!res.ok) throw new Error(await lireErreur(res));
}

export const installerImages = (modele: IdModele) => action("/helix/images/installer", modele);
export const choisirModeleImage = (modele: IdModele) => action("/helix/images/choisir", modele);
export const retirerModeleImage = (modele: IdModele) => action("/helix/images/desinstaller", modele);

/**
 * Crée une image et suit la création jusqu'au bout. `suivre` reçoit chaque
 * étape ; l'arrêt (`signal`) cesse de suivre, la machine finit l'image de
 * son côté.
 */
export async function creerImage(
  description: string,
  format: Format,
  suivre: (tr: Travail) => void,
  signal?: AbortSignal,
  /** Le Chat de la demande : qui le voit verra l'image (gateway/src/images.ts, `imageVisible`). */
  chat?: string,
): Promise<ImageCreee> {
  const res = await apiFetch("/helix/images/creer", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ description, format, chat }),
  });
  if (!res.ok) throw new Error(await lireErreur(res));
  let tr = (await res.json()) as Travail;
  suivre(tr);
  while (tr.etat === "preparation" || tr.etat === "encours") {
    await new Promise((r) => setTimeout(r, 1000));
    if (signal?.aborted) throw new DOMException("arrêt", "AbortError");
    const r = await apiFetch(`/helix/images/travail/${tr.id}`);
    if (!r.ok) throw new Error(await lireErreur(r));
    tr = (await r.json()) as Travail;
    suivre(tr);
  }
  if (tr.etat !== "fait" || !tr.image) throw new Error(tr.message + (tr.erreur ? ` ${tr.erreur}` : ""));
  return tr.image;
}

/* ---- Vidéos (gateway/src/images.ts, même panneau, mêmes droits) ---- */

export async function etatVideos(): Promise<EtatImages | null> {
  try {
    const res = await apiFetch("/helix/videos");
    return res.ok ? ((await res.json()) as EtatImages) : null;
  } catch {
    return null;
  }
}
export const installerVideos = (modele: string) => action("/helix/videos/installer", modele as IdModele);
export const choisirModeleVideo = (modele: string) => action("/helix/videos/choisir", modele as IdModele);
export const retirerModeleVideo = (modele: string) => action("/helix/videos/desinstaller", modele as IdModele);

/** Crée une vidéo et suit sa création, comme une image. */
export async function creerVideo(
  description: string,
  format: Format,
  suivre: (tr: Travail) => void,
  signal?: AbortSignal,
  chat?: string,
): Promise<ImageCreee> {
  const res = await apiFetch("/helix/videos/creer", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ description, format: format === "portrait" ? "portrait" : "paysage", chat }),
  });
  if (!res.ok) throw new Error(await lireErreur(res));
  let tr = (await res.json()) as Travail;
  suivre(tr);
  while (tr.etat === "preparation" || tr.etat === "encours") {
    await new Promise((r) => setTimeout(r, 2000));
    if (signal?.aborted) throw new DOMException("arrêt", "AbortError");
    const r = await apiFetch(`/helix/images/travail/${tr.id}`);
    if (!r.ok) throw new Error(await lireErreur(r));
    tr = (await r.json()) as Travail;
    suivre(tr);
  }
  if (tr.etat !== "fait" || !tr.image) throw new Error(tr.message + (tr.erreur ? ` ${tr.erreur}` : ""));
  return tr.image;
}

/** L'image, en adresse locale à afficher. L'appelant libère l'adresse. */
export async function urlImage(id: string): Promise<string | null> {
  try {
    const res = await apiFetch(`/helix/images/fichier/${id}`);
    return res.ok ? URL.createObjectURL(await res.blob()) : null;
  } catch {
    return null;
  }
}
