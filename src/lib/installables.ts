import { apiFetch } from "./endpoint";
import { t } from "./i18n";

/** Un modèle que la machine peut faire tourner et qu'on peut encore ajouter. */
export interface ModeleInstallable {
  key: string;
  label: string;
  description: string;
  downloadGb: number;
  role: "chat" | "gui";
  recommande: boolean;
  editeur: string;
  licence: string;
  /** Note ECI d'Epoch AI (gateway/src/notesModeles.ts) ; absente quand Epoch ne note pas ce modèle. */
  eci?: number;
  vision?: boolean;
  /** Appelle des outils (fiche LM Studio). */
  outils?: boolean;
  /** Raisonne avant de répondre. */
  raisonne?: boolean;
  /** Architecture à experts : rapide même sans carte graphique. */
  moe?: boolean;
  /** Essayé avec Helix (raisonnement, outils) ; sinon proposé en le disant. */
  verifie: boolean;
}

/** Un modèle du catalogue complet, pour la page « Modèles » (gateway/src/provision.ts, `catalogueComplet`). */
export interface ModeleDuCatalogue extends ModeleInstallable {
  /** Déjà sur la machine. */
  installe: boolean;
  /** Pourquoi il ne tient pas ici, chiffré et dit dans la langue de la personne ; absent s'il tient. */
  tropLourd?: { raison: "memoire" | "carte" | "processeur"; demandeGo: number; disponibleGo: number; texte: string };
}

/** Ce que la page « Modèles » lit : la machine, le catalogue, l'état de l'installation. */
export interface EtatCatalogue {
  modeles: ModeleDuCatalogue[];
  etat?: EtatInstallation;
  /** L'intégrateur prépare les modèles : rien ne s'installe d'ici. */
  managed: boolean;
  moteurInstalle: boolean;
  /** « llamacpp » sur un Mac Intel (catalogue GGUF épinglé), « lmstudio » ailleurs. */
  moteur: "lmstudio" | "llamacpp";
  machine?: { totalMemoryGb: number; gpuVramGb?: number; gpuNom?:string; gpuFabricant?:string; gpuDedie?:boolean; appleSilicon: boolean; platform: string };
}

export interface EtatInstallation {
  phase: string;
  message: string;
  percent?: number;
  model?: string;
  error?: string;
}

interface Reponse {
  installables?: ModeleInstallable[];
  modeles?: ModeleDuCatalogue[];
  state?: EtatInstallation;
  managed?: boolean;
  moteurInstalle?: boolean;
  moteur?: "lmstudio" | "llamacpp";
  hardware?: EtatCatalogue["machine"];
}

/**
 * Modèles adaptés à la machine et pas encore installés, avec l'état de
 * l'installation en cours. Liste vide si l'intégrateur pilote les modèles
 * (profil client) ou si le moteur est absent : rien à proposer alors.
 */
export async function lireInstallables(): Promise<{ liste: ModeleInstallable[]; etat?: EtatInstallation; local: boolean }> {
  const res = await apiFetch("/helix/provision");
  if (!res.ok) return { liste: [], local: false };
  const corps = (await res.json().catch(() => ({}))) as Reponse;
  // `local` : les modèles s'installent sur cette machine (pas d'intégrateur qui les prépare).
  const local = corps.managed !== true;
  if (corps.managed || corps.moteurInstalle === false) return { liste: [], etat: corps.state, local };
  return { liste: corps.installables ?? [], etat: corps.state, local };
}

/**
 * Tout le catalogue, installé ou non, pour la page « Modèles ». Lève une
 * erreur si l'instance ne répond pas : la page le dit, au lieu d'afficher un
 * catalogue vide qu'on croirait réel.
 */
export async function lireCatalogue(): Promise<EtatCatalogue> {
  const res = await apiFetch("/helix/provision");
  if (!res.ok) throw new Error(t("L'instance n'a pas répondu."));
  const corps = (await res.json().catch(() => ({}))) as Reponse;
  return {
    modeles: corps.modeles ?? [],
    etat: corps.state,
    managed: corps.managed === true,
    moteurInstalle: corps.moteurInstalle !== false,
    moteur: corps.moteur === "llamacpp" ? "llamacpp" : "lmstudio",
    machine: corps.hardware,
  };
}

/**
 * Lance l'installation (téléchargement puis chargement) d'un modèle du
 * catalogue. Rend `null` si elle a démarré, sinon la raison du refus
 * (modèle trop lourd pour la machine, instance injoignable).
 */
export async function demanderInstallation(m: Pick<ModeleInstallable, "key" | "role">): Promise<string | null> {
  try {
    const res = await apiFetch("/helix/provision/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: m.key, role: m.role }),
    });
    if (res.ok) return null;
    const corps = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
    return corps.error?.message ?? t("L'installation du modèle n'a pas pu démarrer.");
  } catch {
    return t("L'instance n'a pas répondu.");
  }
}

/** Lance l'installation d'un modèle du catalogue ; vrai si elle a démarré. */
export async function installerModele(m: ModeleInstallable): Promise<boolean> {
  return (await demanderInstallation(m)) === null;
}
