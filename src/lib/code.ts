/**
 * Client de l'écran Code : pilote OpenCode à travers la passerelle Helix
 * (ARCHITECTURE.md, ADR-003). Le front ne connaît ni OpenCode ni le modèle :
 * il parle à la passerelle, qui choisit le moteur et le fournisseur.
 */

import { apiFetch } from "@/lib/endpoint";
import { lister, locale, t, tf } from "@/lib/i18n";
import { libelleOutil } from "@/lib/libellesOutils";
import { dureeCourte } from "@/lib/durees";

export interface CodeStatus {
  available: boolean;
  running: boolean;
  /** Dossier proposé pour une nouvelle session : celui de la personne connectée. */
  projectDir: string;
  error?: string;
  /** Helix sait-il poser OpenCode sur cette machine ? */
  installable?: boolean;
  raisonNonInstallable?: string;
  /** Installation d'OpenCode par Helix (opencodePrive.ts). */
  installation?: { enCours: boolean; pourcent: number | null; erreur: string | null };
  /** Faux quand le profil de déploiement réserve les installations à l'intégrateur. */
  installationAuto?: boolean;
  /** La personne connectée administre-t-elle l'instance ? Elle seule installe. */
  administrateur?: boolean;
}

/**
 * Demande à l'instance de poser OpenCode. Rend le message de refus, ou null.
 * `ouverture` : lancée d'office à l'ouverture de l'écran, pas par un clic (le journal le distingue).
 */
export async function installerOpencode(ouverture = false): Promise<string | null> {
  const res = await apiFetch(`/helix/code/installer`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ouverture }),
  });
  if (res.ok) return null;
  const corps = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
  return corps.error?.message ?? tf("Demande refusée ({0}).", res.status);
}

export async function fetchCodeStatus(): Promise<CodeStatus> {
  const res = await apiFetch(`/helix/code`);
  if (!res.ok) throw new Error(`Passerelle injoignable (${res.status})`);
  return res.json();
}

/** Réglages choisis à l'écran : modèle (identifiant d'interface) et niveau de raisonnement. */
export interface ReglagesCode {
  vps?: string;
  model?: string;
  effort?: string;
  /** RTK : « cloud », « toujours » ou « jamais » (gateway/src/rtk.ts). */
  rtk?: string;
}

/** Ce que l'instance dit de RTK, et ce qu'il a épargné dans une session (GET /helix/code/rtk). */
export interface EtatRtk {
  etat: {
    version: string;
    branchable: boolean;
    raison: string | null;
    installe: boolean;
    installation: { enCours: boolean; pourcent: number | null; erreur: string | null };
  };
  session?: { actif: boolean; economies: { commandes: number; jetons: number } | null };
}

export async function fetchRtk(sessionID?: string | null): Promise<EtatRtk | null> {
  const res = await apiFetch(`/helix/code/rtk${sessionID ? `?sessionID=${encodeURIComponent(sessionID)}` : ""}`).catch(() => null);
  if (!res?.ok) return null;
  return (await res.json().catch(() => null)) as EtatRtk | null;
}

export async function createCodeSession(
  reglages: ReglagesCode,
  /** Dossier de travail ; l'instance le valide avant de l'accepter. */
  dossier?: string,
): Promise<string> {
  const res = await apiFetch(`/helix/code/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: reglages.model, effort: reglages.effort, vps: reglages.vps, dossier }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error?.message ?? tf("Impossible d'ouvrir une session ({0})", res.status));
  }
  const payload = await res.json();
  const id = payload?.data?.id ?? payload?.id;
  if (!id) throw new Error(t("Session sans identifiant."));
  return id as string;
}

/**
 * Envoie une demande. Rend l'identifiant d'une **nouvelle** session quand
 * l'instance a dû relancer la demande ailleurs (la première n'avait jamais
 * atteint le modèle : voir `handleCodePrompt`, gateway/src/index.ts), et
 * l'identifiant du message, qui permet de reconnaître dans le flux les
 * événements de CETTE demande (voir `useCode`).
 */
export async function sendCodePrompt(
  sessionID: string,
  text: string,
  reglages: ReglagesCode,
): Promise<{ relance?: string; messageID?: string }> {
  const res = await apiFetch(`/helix/code/prompt`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionID, text, model: reglages.model, effort: reglages.effort, rtk: reglages.rtk }),
  });
  const body = (await res.json().catch(() => ({}))) as {
    error?: { message?: string };
    data?: { id?: string };
    helixRelance?: { sessionID?: string };
  };
  if (!res.ok) throw new Error(body?.error?.message ?? tf("Envoi refusé ({0})", res.status));
  return { relance: body.helixRelance?.sessionID, messageID: body.data?.id };
}

/** Une session de Code dans la liste de la personne (gateway/src/sessionsCode.ts). */
export interface SessionCodeResume {
  vps?: string;
  id: string;
  titre: string;
  dossier: string;
  creee: string;
  maj: string;
  /** L'agent ou Helix y travaille encore, d'après l'instance (27/09/2026). */
  enCours?: boolean;
}

/** Une session rouverte : son historique, relu chez OpenCode par l'instance. */
export interface HistoriqueCode {
  session: SessionCodeResume;
  messages: {
    role: "user" | "assistant";
    texte: string;
    raisonnement?: string;
    outils: { callID: string; tool: string; input: Record<string, unknown>; etat: "encours" | "fini" | "echec"; apercu?: string }[];
  }[];
  /** L'agent y travaille encore. */
  enCours: boolean;
  /** Dernier numéro d'évènement vu par l'instance : pour suivre la suite sans rien rejouer. */
  dernier: number;
}

/**
 * Évènement de fenêtre : la liste des sessions de Code a changé (une session
 * ouverte, une demande envoyée, une session retirée). La barre latérale et
 * l'accueil de Code s'y rafraîchissent.
 */
export const SESSIONS_CODE_CHANGEES = "helix:sessions-code";
export const signalerSessionsCode = () => window.dispatchEvent(new Event(SESSIONS_CODE_CHANGEES));

export async function listerSessionsCode(): Promise<SessionCodeResume[]> {
  const res = await apiFetch(`/helix/code/sessions`);
  if (!res.ok) throw new Error(tf("Sessions de code indisponibles ({0})", res.status));
  const corps = (await res.json()) as { sessions?: SessionCodeResume[] };
  return Array.isArray(corps.sessions) ? corps.sessions : [];
}

export async function historiqueSessionCode(id: string): Promise<HistoriqueCode> {
  const res = await apiFetch(`/helix/code/sessions/${encodeURIComponent(id)}`);
  const corps = (await res.json().catch(() => ({}))) as HistoriqueCode & { error?: { message?: string } };
  if (!res.ok) throw new Error(corps?.error?.message ?? tf("Session introuvable ({0})", res.status));
  return corps;
}

/** Retire une session de la liste. Sa conversation reste chez l'agent de code. */
export async function retirerSessionCode(id: string): Promise<boolean> {
  const res = await apiFetch(`/helix/code/sessions/${encodeURIComponent(id)}`, { method: "DELETE" });
  return res.ok;
}

/** Demande l'arrêt. Rend `false` si l'instance ne l'a pas confirmé. */
export async function interruptCode(sessionID: string): Promise<boolean> {
  try {
    const res = await apiFetch(`/helix/code/interrupt`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionID }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Événement OpenCode traduit en langage Helix. */
export type CodeEvent =
  /** Une demande commence à être traitée : `messageID` dit laquelle. */
  /** `relance` : envoyée par Helix lui-même (contrôle automatique), la suite du même tour. */
  | { kind: "demande"; messageID: string; relance?: boolean }
  /** Une étape du modèle commence : l'agent travaille (encore). */
  | { kind: "etape" }
  | { kind: "reasoning"; text: string }
  | { kind: "text"; text: string }
  | { kind: "tool_start"; callID: string; tool: string; input: Record<string, unknown> }
  | { kind: "tool_end"; callID: string; ok: boolean; preview: string }
  /** Ce qui se passe sans être une réponse : nouvelle tentative, résumé… */
  | { kind: "statut"; text: string; controle?: boolean; preparation?: boolean }
  /**
   * Le modèle n'a encore rien rendu : il lit la demande, attend son tour ou se
   * charge (`helix.statut`, envoyé par l'instance toutes les dix secondes,
   * voir gateway/src/attenteModele.ts). « fin » : il commence à répondre.
   * `depuis` est déjà ramené à l'horloge de cet écran.
   */
  | {
      kind: "attente";
      etat: "lecture" | "attente" | "chargement" | "fin";
      depuis: number;
      jetons?: number;
      progression?: number;
      file?: number;
      sousTache: boolean;
    }
  /** Signe de vie : l'agent réfléchit, écrit, ou prépare un outil (sans numéro, jamais rejoué). */
  | { kind: "activite"; phase?: "reflexion" | "ecriture" | "outil"; tool?: string; sousTache: boolean }
  /** Un outil d'un sous-agent (outil `task`), rapporté à la session qui l'a lancé. */
  | {
      kind: "sous_outil";
      parentCallID?: string;
      /** La session du sous-agent : de quoi l'arrêter seule (panneau de suivi). */
      sousSession?: string;
      callID: string;
      tool: string;
      input: Record<string, unknown>;
      etat: "encours" | "fini" | "echec";
    }
  /** Le moteur a échoué : sans cet événement, l'écran attend indéfiniment. */
  | { kind: "error"; message: string }
  /**
   * Le tour est fini, mais pas normalement (longueur, filtre, arrêt sans
   * motif) : ce qui a été écrit reste affiché, avec la raison.
   */
  | { kind: "fin"; note: string }
  | { kind: "done" };

/** Message d'erreur d'un événement OpenCode, quelle que soit sa forme. */
function messageErreur(erreur: unknown): string {
  if (typeof erreur === "string") return erreur;
  /*
   * Un chemin hors du dossier du projet (23/10/2026, capture sous Windows :
   * le message de règle d'OpenCode et le JSON de ses règles, affichés tels
   * quels). `horsProjet` vient de la passerelle (fluxCode.ts) ; le texte
   * d'OpenCode est aussi reconnu, pour une instance plus ancienne.
   */
  const e = erreur as { message?: unknown; horsProjet?: { chemin?: unknown } } | undefined;
  const message = typeof e?.message === "string" ? e.message : "";
  const regle = /The user has specified a rule which prevents you from using this specific tool call/.test(message);
  if (e?.horsProjet || regle) {
    const chemin = typeof e?.horsProjet?.chemin === "string" ? e.horsProjet.chemin : "";
    return chemin
      ? tf("Ce chemin est hors du dossier du projet : {0}. L'agent ne lit et n'écrit que dans le dossier du projet.", chemin)
      : t("Action refusée par les règles de Code : l'agent ne sort pas du dossier du projet.");
  }
  return message;
}

/**
 * Traduit un événement brut d'OpenCode. Renvoie `null` si sans intérêt pour l'UI.
 *
 * La liste des événements vient du schéma du flux d'OpenCode 1.18.32
 * (`SessionDurableEvent`, lu dans `/doc`) ; les fins de tour ont été
 * provoquées une à une contre un faux fournisseur pour voir ce qu'OpenCode
 * émet réellement (23/09/2026).
 */
export function translate(raw: unknown): CodeEvent | null {
  const event = raw as { type?: string; data?: Record<string, unknown> };
  const type = event.type ?? "";
  const data = event.data ?? {};

  if (type === "session.next.prompted" && typeof data.messageID === "string") {
    return { kind: "demande", messageID: data.messageID, ...(data.relanceHelix === true ? { relance: true } : {}) };
  }
  if (type === "helix.statut") {
    const etat = data.etat;
    // Contrôle automatique de fin de tour (gateway/src/controleCode.ts) : une ligne d'état, texte déjà traduit.
    if (etat === "controle") return typeof data.message === "string" ? { kind: "statut", text: data.message, controle: true } : null;
    // Préparation d'une application en plusieurs étapes (gateway/src/application.ts), avant que la demande parte à l'agent.
    if (etat === "preparation") return typeof data.message === "string" ? { kind: "statut", text: data.message, preparation: true } : null;
    if (etat !== "lecture" && etat !== "attente" && etat !== "chargement" && etat !== "fin") return null;
    const nombre = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
    /*
     * Le temps écoulé se compte sur l'horloge de l'instance (`timestamp` de
     * l'évènement moins `depuis`), puis se reporte sur celle de l'écran : une
     * instance distante dont l'horloge avance n'affiche pas une attente fausse.
     */
    const ecoule = Math.max(0, (nombre(data.timestamp) ?? Date.now()) - (nombre(data.depuis) ?? Date.now()));
    return {
      kind: "attente",
      etat,
      depuis: Date.now() - ecoule,
      jetons: nombre(data.jetons),
      progression: nombre(data.progression),
      file: nombre(data.file),
      sousTache: data.sousTache === true,
    };
  }
  if (type === "helix.activite") {
    const phase = data.phase === "reflexion" || data.phase === "ecriture" || data.phase === "outil" ? data.phase : undefined;
    return { kind: "activite", phase, tool: typeof data.tool === "string" ? data.tool : undefined, sousTache: data.sousTache === true };
  }
  if (type === "helix.soustache") {
    const etat = data.etat === "fini" || data.etat === "echec" ? data.etat : "encours";
    return {
      kind: "sous_outil",
      parentCallID: typeof data.parentCallID === "string" ? data.parentCallID : undefined,
      sousSession: typeof data.sousSession === "string" && /^ses_[A-Za-z0-9]{1,64}$/.test(data.sousSession) ? data.sousSession : undefined,
      callID: String(data.callID ?? ""),
      tool: String(data.tool ?? "outil"),
      input: (data.input as Record<string, unknown>) ?? {},
      etat,
    };
  }
  if (type === "session.next.step.started") return { kind: "etape" };
  if (type === "session.next.reasoning.ended" && typeof data.text === "string") {
    return { kind: "reasoning", text: data.text };
  }
  if (type === "session.next.text.ended" && typeof data.text === "string") {
    return { kind: "text", text: data.text };
  }
  if (type === "session.next.tool.called") {
    return {
      kind: "tool_start",
      callID: String(data.callID ?? ""),
      tool: String(data.tool ?? "outil"),
      input: (data.input as Record<string, unknown>) ?? {},
    };
  }
  /*
   * Échec d'une étape : le tour s'arrête là. Sans traduction, l'interface ne
   * recevait rien : la réponse restait « en cours » pour toujours, et tout
   * envoi suivant était ignoré. Un moteur qui échoue doit le dire.
   */
  if (type === "session.next.step.failed") {
    return {
      kind: "error",
      message: messageErreur(data.error) || t("Le moteur de code a interrompu la tâche."),
    };
  }
  /*
   * Échec d'un OUTIL, pas du tour : un fichier introuvable, une commande en
   * erreur. Le modèle reçoit l'échec et continue — il essaie autre chose, ou
   * explique. Le traiter comme la fin du tour (ce qui était fait) rendait la
   * main pendant que l'agent travaillait encore, laissait l'outil tourner à
   * l'écran pour toujours, et cachait sa réponse finale derrière le message
   * d'erreur de l'outil.
   */
  if (type === "session.next.tool.failed") {
    return {
      kind: "tool_end",
      callID: String(data.callID ?? ""),
      ok: false,
      preview: messageErreur(data.error) || t("L'outil a échoué."),
    };
  }
  if (type === "session.next.tool.success") {
    const parts = (data.content as { type: string; text?: string }[] | undefined) ?? [];
    const preview = parts
      .map((p) => p.text ?? "")
      .join("\n")
      .trim();
    return {
      kind: "tool_end",
      callID: String(data.callID ?? ""),
      ok: true,
      preview: preview || String((data.structured as { target?: string })?.target ?? ""),
    };
  }
  /*
   * Le fournisseur n'a pas répondu et OpenCode réessaie : sans ce statut,
   * l'écran restait muet pendant les tentatives.
   */
  if (type === "session.next.retried") {
    const motif = messageErreur(data.error);
    return {
      kind: "statut",
      text: motif
        ? tf("Le modèle n'a pas répondu ({0}). Nouvelle tentative...", motif)
        : t("Le modèle n'a pas répondu. Nouvelle tentative..."),
    };
  }
  if (type === "session.next.compaction.started") {
    return { kind: "statut", text: t("La conversation est longue : l'agent la résume pour continuer...") };
  }
  if (type === "session.next.step.ended") {
    /*
     * « tool-calls » n'est pas une fin : l'étape s'arrête pour laisser l'outil
     * travailler, et l'étape suivante reprend avec son résultat. La traiter
     * comme une interruption arrêtait l'écran après la première action (vu par
     * le client le 23/09/2026 : « write index.html » puis « Tâche interrompue
     * par le moteur (tool-calls) », alors que le travail continuait).
     */
    if (data.finish === "tool-calls" || data.finish === "tool_calls") return null;
    if (data.finish === "stop") return { kind: "done" };
    /*
     * Toute autre valeur termine le tour : vérifié contre un faux fournisseur,
     * OpenCode ne relance pas d'étape après « length », « content-filter » ou
     * « unknown ». Ce qui a été écrit reste affiché ; on dit pourquoi ça
     * s'arrête, en mots, jamais avec le code brut du moteur.
     */
    if (typeof data.finish === "string") {
      return {
        kind: "fin",
        note:
          data.finish === "length"
            ? t("Réponse interrompue : la limite de longueur du modèle est atteinte.")
            : data.finish === "content-filter"
              ? t("Réponse bloquée par le filtre de contenu du modèle.")
              : data.finish === "error"
                ? t("Le modèle a signalé une erreur et s'est arrêté.")
                : t("Le modèle s'est arrêté sans indiquer qu'il avait fini : la réponse peut être incomplète."),
      };
    }
  }
  return null;
}

/*
 * Noms des outils d'OpenCode rapprochés de ceux que l'affichage sait déjà dire
 * en français (libellesOutils.ts). Les autres gardent leur nom.
 */
const OUTILS_CONNUS: Record<string, string> = {
  read: "read_text_file",
  write: "write_file",
  edit: "edit_file",
  list: "list_directory",
  glob: "search_files",
};

/** Nom affichable d'un outil d'OpenCode, au format « serveur__outil » de l'affichage. */
export function nomOutil(tool: string): string {
  /*
   * Connecteurs de l'instance servis à l'agent de code (outilsCode.ts) :
   * OpenCode les nomme « helix_<serveur>__<outil> ». Sans le préfixe, c'est le
   * nom que l'affichage connaît déjà depuis le Chat (« drive__chercher »…).
   */
  if (tool.startsWith("helix_") && tool.includes("__")) return tool.slice("helix_".length);
  return OUTILS_CONNUS[tool] ? `fichiers__${OUTILS_CONNUS[tool]}` : `code__${tool}`;
}

/** « 14:32 » aujourd'hui, « 24 sept. » cette année, « 24/09/2025 » avant. */
export function dateCourte(iso: string, maintenant = new Date()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  if (d.toDateString() === maintenant.toDateString()) return d.toLocaleTimeString(locale(), { hour: "2-digit", minute: "2-digit" });
  if (d.getFullYear() === maintenant.getFullYear()) return d.toLocaleDateString(locale(), { day: "numeric", month: "short" });
  return d.toLocaleDateString(locale());
}

/** Dernier élément d'un chemin : le nom du dossier du projet. */
export const nomDossier = (chemin: string) => chemin.replace(/\/+$/, "").split("/").pop() || chemin;

/* « 45 s », « 2 min 05 s » : la façon commune d'écrire une durée (lib/durees.ts, depuis le 27/09/2026). */
export { dureeCourte };

/** « 18 000 » : une taille de demande arrondie, pour dire un ordre de grandeur. */
const environ = (jetons: number) => (jetons >= 1000 ? Math.round(jetons / 1000) * 1000 : Math.round(jetons / 100) * 100).toLocaleString(locale());

/**
 * Ce que l'on dit pendant que le modèle n'a encore rien rendu. Le temps
 * écoulé, toujours ; la progression, seulement quand l'instance a pu la lire
 * de façon sûre (voir gateway/src/attenteModele.ts).
 */
export function texteAttente(
  e: { etat: "lecture" | "attente" | "chargement" | "fin"; depuis: number; jetons?: number; progression?: number; sousTache?: boolean },
  maintenant = Date.now(),
): string {
  const duree = dureeCourte(maintenant - e.depuis);
  if (e.etat === "chargement") return tf("Le modèle se charge en mémoire ({0})...", duree);
  if (e.etat === "attente") return tf("Le modèle termine une autre demande avant celle-ci ({0})...", duree);
  if (e.etat === "fin") return t("Le modèle commence à répondre...");
  const detail = lister([
    duree,
    e.progression !== undefined ? tf("{0} %", e.progression) : undefined,
    e.jetons ? tf("environ {0} jetons", environ(e.jetons)) : undefined,
  ]);
  return e.sousTache ? tf("Le modèle lit la demande de la sous-tâche ({0})...", detail) : tf("Le modèle lit la demande ({0})...", detail);
}

/**
 * Chemin montré à la personne : relatif au dossier du projet quand il y est,
 * entier sinon (l'affichage le coupe).
 */
export function cheminCourt(chemin: string, dossier?: string): string {
  if (dossier && chemin.startsWith(`${dossier.replace(/\/$/, "")}/`)) return chemin.slice(dossier.replace(/\/$/, "").length + 1);
  return chemin;
}

/**
 * Ce que fait un outil de l'agent de code, en mots, et sur quoi.
 *
 * Constat de Medhi le 25/09/2026 : pendant le travail, l'écran n'affichait que
 * des lignes « ✓ task », et l'on croyait que tout plantait. Chaque outil a
 * maintenant un libellé, et sa cible : le fichier lu ou écrit, la commande
 * lancée, le motif cherché, le connecteur appelé ; une sous-tâche dit ce
 * qu'elle fait (sa `description`, que l'agent écrit pour la personne).
 */
export function actionOutil(tool: string, input: Record<string, unknown> = {}, dossier?: string): { libelle: string; cible?: string } {
  const texte = (cle: string) => (typeof input[cle] === "string" && (input[cle] as string).trim() ? (input[cle] as string).trim() : undefined);
  const fichier = texte("filePath") ?? texte("path");
  const cible = fichier ? cheminCourt(fichier, dossier) : undefined;
  switch (tool) {
    case "read":
      return { libelle: t("Lecture"), cible };
    case "write":
      return { libelle: t("Écriture"), cible };
    case "edit":
    case "multiedit":
    case "patch":
    case "apply_patch":
      return { libelle: t("Modification"), cible };
    case "list":
      return { libelle: t("Contenu d'un dossier"), cible };
    case "glob":
      return { libelle: t("Recherche de fichiers"), cible: texte("pattern") };
    case "grep":
      return { libelle: t("Recherche dans le code"), cible: texte("pattern") };
    case "bash": {
      const commande = texte("command")?.split("\n")[0];
      return { libelle: t("Commande"), cible: commande && commande.length > 120 ? `${commande.slice(0, 119)}…` : commande };
    }
    case "task": {
      const description = texte("description");
      return description ? { libelle: tf("Sous-tâche : {0}", description) } : { libelle: t("Sous-tâche") };
    }
    case "todowrite":
      return { libelle: t("Liste de tâches mise à jour") };
    case "todoread":
      return { libelle: t("Lecture de la liste de tâches") };
    case "webfetch":
      return { libelle: t("Lecture d'une page web"), cible: texte("url") };
    case "skill":
      return { libelle: t("Chargement d'une procédure") };
  }
  // Connecteurs de l'instance (« helix_drive__chercher ») : le libellé déjà connu du Chat.
  if (tool.startsWith("helix_") && tool.includes("__")) {
    return { libelle: libelleOutil(tool.slice("helix_".length)), cible: texte("query") ?? texte("texte") ?? cible };
  }
  return { libelle: tool.replace(/_/g, " "), cible };
}

/**
 * Arguments affichables : l'affichage montre `path`, `query`, `pattern`… et
 * OpenCode nomme parfois le chemin `filePath`, et une commande `command`.
 */
export function argumentsOutil(input: Record<string, unknown>): Record<string, unknown> {
  const extra: Record<string, unknown> = {};
  if (typeof input.path !== "string" && typeof input.filePath === "string") extra.path = input.filePath;
  if (typeof input.command === "string" && typeof input.source !== "string") extra.source = input.command;
  return { ...input, ...extra };
}
