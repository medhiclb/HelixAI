import { apiFetch } from "./endpoint";
import { t, tf } from "@/lib/i18n";

/**
 * Connecteurs, côté interface.
 *
 * Un guichet, et rien de plus. Pour un service du catalogue, ce module n'a
 * jamais connaissance d'une commande à exécuter : il envoie un identifiant et
 * les secrets saisis, l'instance retrouve la commande dans le sien. C'est ce
 * qui fait que l'interface ne peut pas choisir ce qui tourne sur la machine de
 * l'entreprise, même modifiée par quelqu'un qui la contrôlerait. Seule
 * exception (16/10/2026, `ajouterPersonnalise`) : un serveur ajouté par
 * l'administrateur, que l'instance juge elle-même (administrateur, depuis sa
 * propre machine, instance fermée aux collègues, sans interpréteur de
 * commandes).
 *
 * Règle miroir de celle du courrier : le secret part vers l'instance et n'en
 * revient jamais. L'état renvoyé ne porte que le **nom** des variables
 * renseignées.
 */

export interface ChampSecret {
  nom: string;
  libelle: string;
  aide: string;
}

export type Categorie = string;

export interface EntreeCatalogue {
  id: string;
  label: string;
  description: string;
  categorie: Categorie;
  secrets: ChampSecret[];
  documentation?: string;
  /** Service qui publie son propre serveur : branchement par le navigateur. */
  url?: string;
  /**
   * `auto` : l'instance s'enregistre elle-même auprès du service, il n'y a
   * rien à préparer. `appli` : une application doit être créée une fois chez
   * le service, et son identifiant collé ici.
   */
  oauth?: "auto" | "appli";
  /** Où créer cette application, quand `oauth` vaut « appli ». */
  console?: string;
  /** Lecture seule par défaut, l'écriture se coche à la connexion (Trello, Monday… : ConnecteurProjets.tsx). */
  ecritureAuChoix?: true;
  /**
   * Application ouverte sur la machine de l'instance (Palmier Pro, 29/09/2026) :
   * « Brancher » la relie d'un clic, sans navigateur ni jeton. L'adresse n'en
   * vient jamais d'ici : l'instance la tire de son catalogue.
   */
  local?: { port: number; chemin: string };
  /**
   * Application installée sur la machine de l'instance, dont l'instance lance
   * le serveur d'outils elle-même (Roblox Studio, Blender, 12/10/2026) : même
   * « Brancher » que `local`, la commande ne vient jamais d'ici.
   */
  lanceur?: true;
  /** Page officielle où la personne télécharge l'application elle-même. */
  telechargement?: string;
  /** Livré avec Helix : déjà là, ne s'ajoute ni ne se retire. */
  integre?: true;
}

export interface ConnecteurInstalle {
  id: string;
  label: string;
  description: string;
  /** Noms des variables renseignées. Jamais leur valeur. */
  secretsFournis: string[];
  depuis: string;
  libre: boolean;
  running: boolean;
  toolCount: number;
  error?: string;
  /** Branché par autorisation dans le navigateur. */
  distant?: boolean;
  autoriseDepuis?: string;
  /** Application ouverte sur la machine de l'instance : « Réessayer » la rebranche après qu'elle a été fermée. */
  local?: true;
  /** Serveur ajouté par l'administrateur (16/10/2026). `cible` : la commande ou l'adresse, montrée à l'administrateur seulement. */
  personnalise?: { mode: "programme" | "adresse"; cible?: string; lectures: string[]; outils: { nom: string; description: string }[] };
}

export interface EtatConnecteurs {
  catalogue: EntreeCatalogue[];
  categories: Categorie[];
  installes: ConnecteurInstalle[];
  chiffrementDonnees: boolean;
  commandeLibre: boolean;
  /** Ce que la personne peut ajouter elle-même (16/10/2026). Absent d'une instance plus ancienne. */
  personnalise?: { ajouter: boolean; programme: boolean };
  /**
   * Issue du dernier retour d'autorisation, par connecteur (28/09/2026) : un
   * refus dans la page du service se lit ici, au lieu d'attendre en vain.
   * Absent d'une instance plus ancienne.
   */
  issues?: Record<string, { ok: boolean; message: string; quand: string }>;
  /**
   * L'adresse de retour que « Se connecter » enverra au service (28/09/2026),
   * montrée avant le premier essai pour les services à application déclarée.
   * Absente d'une instance plus ancienne.
   */
  retour?: string;
  /** La même, pour un service qui la veut autrement (Zoom : 127.0.0.1 plutôt que « localhost »). */
  retours?: Record<string, string>;
}

export interface Resultat {
  ok: boolean;
  message: string;
  etat?: EtatConnecteurs;
}

/** Groupe d'outils tel que l'instance le voit. */
export interface GroupeOutils {
  id: string;
  label: string;
  description: string;
  actif: boolean;
  outils: number;
  obstacle?: string;
  /** Service branché par quelqu'un, pas un outil livré d'office (connecteurs.ts, `groupes`). */
  branche?: true;
}

/**
 * Signal interne : la liste des connecteurs vient de changer.
 *
 * L'écran des réglages et la puce du composeur lisent la même chose à deux
 * endroits. Sans ce signal, brancher Notion depuis les réglages laissait le
 * menu du composeur afficher l'ancienne liste jusqu'au prochain rechargement.
 */
export const CONNECTEURS_CHANGE = "helix:connecteurs-change";

export function signalerChangement(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(CONNECTEURS_CHANGE));
  }
}

/** `null` si l'instance ne répond pas : l'écran le dit plutôt que d'afficher du vide. */
export async function etat(): Promise<EtatConnecteurs | null> {
  try {
    const res = await apiFetch("/helix/connecteurs");
    if (!res.ok) return null;
    return (await res.json()) as EtatConnecteurs;
  } catch {
    return null;
  }
}

/** Groupes d'outils réellement proposés au modèle. `null` si instance muette. */
export async function outils(): Promise<GroupeOutils[] | null> {
  try {
    const res = await apiFetch("/helix/outils");
    if (!res.ok) return null;
    const corps = (await res.json()) as { groupes: GroupeOutils[] };
    return corps.groupes;
  } catch {
    return null;
  }
}

async function poster(chemin: string, corps: unknown): Promise<Resultat> {
  try {
    const res = await apiFetch(chemin, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(corps),
    });
    const recu = (await res.json().catch(() => ({}))) as Partial<Resultat> & {
      error?: { message?: string };
    };
    if (recu.error?.message) return { ok: false, message: recu.error.message };
    return {
      ok: recu.ok === true,
      message: recu.message ?? tf("L'opération a échoué ({0}).", res.status),
      etat: recu.etat,
      ...("adresse" in recu ? { adresse: (recu as { adresse?: string }).adresse } : {}),
      ...("pret" in recu ? { pret: (recu as { pret?: boolean }).pret } : {}),
    };
  } catch {
    return {
      ok: false,
      message: t("L'instance n'a pas répondu. Vérifiez qu'elle est démarrée, puis recommencez."),
    };
  }
}

/**
 * Branche un connecteur du catalogue.
 *
 * On n'envoie que l'identifiant et les secrets. L'instance démarre le serveur
 * avant d'enregistrer quoi que ce soit : un refus n'a donc rien laissé derrière
 * lui, et le message rendu dit ce qui a manqué.
 */
export async function ajouter(
  id: string,
  secrets: Record<string, string>,
): Promise<Resultat> {
  const resultat = await poster("/helix/connecteurs/ajouter", { id, secrets });
  if (resultat.ok) signalerChangement();
  return resultat;
}

/**
 * Lance l'autorisation d'un service distant, ou branche une application
 * ouverte sur la machine de l'instance (`local` : Palmier Pro, qui rend `pret`
 * ou dit pourquoi elle n'a pas pu l'être).
 *
 * Rend soit `pret` (l'instance était déjà autorisée), soit `adresse`, la page
 * du service à ouvrir dans le navigateur. Cette page est celle du service,
 * chez lui : le mot de passe de la personne n'est jamais vu par Helix.
 */
export async function connecter(
  id: string,
  identifiants?: { clientId?: string; clientSecret?: string },
  /** L'écriture cochée, pour un service qui la propose (`ecritureAuChoix`). */
  ecriture?: boolean,
): Promise<Resultat & { adresse?: string; pret?: boolean }> {
  const resultat = (await poster("/helix/connecteurs/connecter", {
    id,
    ...identifiants,
    ...(ecriture ? { ecriture: true } : {}),
  })) as Resultat & { adresse?: string; pret?: boolean };
  if (resultat.pret) signalerChangement();
  return resultat;
}

/** Retire un connecteur : ses outils disparaissent, son secret est effacé. */
export async function retirer(id: string): Promise<Resultat> {
  const resultat = await poster("/helix/connecteurs/retirer", { id });
  if (resultat.ok) signalerChangement();
  return resultat;
}

/**
 * Un serveur MCP ajouté par l'administrateur (16/10/2026, « Ajouter un serveur
 * MCP »). L'écran envoie ce que l'administrateur a saisi ; c'est l'instance
 * qui juge (administrateur, cette machine, pas d'interpréteur de commandes ni
 * de code en ligne, adresse en https ou sur la boucle locale), et qui refuse.
 */
export type DemandePersonnalise =
  | { mode: "programme"; id: string; label: string; description?: string; command: string; args: string[]; variables: Record<string, string> }
  | { mode: "adresse"; id: string; label: string; description?: string; url: string; entetes?: Record<string, string> };

export async function ajouterPersonnalise(demande: DemandePersonnalise): Promise<Resultat & { adresse?: string }> {
  const resultat = (await poster("/helix/connecteurs/personnalise", demande)) as Resultat & { adresse?: string };
  if (resultat.ok && !resultat.adresse) signalerChangement();
  return resultat;
}

/** Les outils d'un serveur ajouté que l'administrateur marque « lecture seule » (les autres demandent l'accord). */
export async function definirLectures(id: string, lectures: string[]): Promise<Resultat> {
  const resultat = await poster("/helix/connecteurs/personnalise/lectures", { id, lectures });
  if (resultat.ok) signalerChangement();
  return resultat;
}
