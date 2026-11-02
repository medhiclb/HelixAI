import { ENTETE_RELANCE } from "./controleCode.ts";
import { t } from "./langue.ts";
import { db } from "./db.ts";

/**
 * Les sessions de Helix Code, séparées des Chats.
 *
 * ── Pourquoi ────────────────────────────────────────────────────────────────
 *
 * Demandé par Medhi le 25/09/2026, « comme dans Claude Code » : en ouvrant
 * Code, on retombait sur la dernière conversation, et rien ne permettait d'en
 * rouvrir une autre. Les sessions n'existaient que chez OpenCode (qui garde
 * leurs messages sur le disque) et dans la mémoire de la passerelle
 * (`modeleDeSession`, index.ts, perdu à chaque redémarrage) : on ne savait
 * même plus à qui elles étaient.
 *
 * Ce registre retient, pour chaque session ouverte par Helix Code, sa
 * propriétaire, son dossier, son titre (le début de la première demande, comme
 * le fait Claude Code) et ses dates. Le **contenu** reste chez OpenCode, relu à
 * l'ouverture (`GET /session/<id>/message`) : rien n'est recopié, rien ne peut
 * donc diverger ni se perdre ici. Collection interne (db.ts) : jamais
 * distribuée aux postes, chacun ne voit que les siennes, par la route.
 *
 * Les sessions ouvertes avant ce registre ne sont pas listées : on ne sait pas
 * à qui elles sont. Elles restent intactes chez OpenCode.
 *
 * ── Le registre fait foi pour l'accès (26/09/2026) ─────────────────────────
 *
 * Revue de sécurité du 25/09/2026 : le contrôle d'accès aux sessions
 * échouait ouvert. Une session absente du registre (ouverte avant lui, retirée
 * de la liste, sortie par la borne de 300, sous-agent jamais inscrit) ou un
 * registre illisible laissait toute séance y envoyer des demandes et lire son
 * flux. Désormais une session ne s'utilise que si le registre la connaît et la
 * donne à la personne (index.ts, `refusSessionCode`) ; les sessions d'avant le
 * 25/09/2026, qui n'ont pas de propriétaire, ne s'ouvrent plus par Helix
 * (voulu : on ne sait pas à qui elles sont). Pour que cela tienne :
 *  - « Retirer de la liste » **masque** la session, sans l'oublier : elle
 *    garde sa propriétaire ;
 *  - la borne de la liste masque les plus anciennes ; seule une borne bien
 *    plus haute (`INSCRITES_MAX`) en efface du registre, et une session effacée
 *    ne s'ouvre plus pour personne ;
 *  - les sous-sessions (sous-agents de l'outil `task`) sont inscrites sous la
 *    propriétaire de leur session parente, masquées (fluxCode.ts).
 */

export interface SessionCode {
  id: string;
  userId: string;
  dossier: string;
  titre: string;
  modele: string;
  variante?: string;
  vps?: string;
  creee: string;
  maj: string;
  /** Retirée de la liste (ou sortie par la borne) : toujours à sa propriétaire, mais plus affichée. */
  masquee?: boolean;
  /** Session d'un sous-agent : celle qui l'a lancée. Jamais listée. */
  parent?: string;
}

const COLLECTION = "sessionsCode";
/** Au-delà, les plus anciennes sont masquées de la liste (elles restent chez OpenCode, et à leur propriétaire). */
const PAR_PERSONNE_MAX = 300;
/**
 * Au-delà, les plus anciennes inscriptions d'une personne (sous-sessions
 * comprises) sortent du registre : la collection reste bornée. Une session
 * sortie ne s'ouvre plus pour personne, pas même pour sa propriétaire.
 */
const INSCRITES_MAX = 3000;
const TITRE_MAX = 80;

/**
 * Lecture du registre. Une valeur illisible **lève** : sans cela, la première
 * écriture remplacerait par une liste presque vide des sessions qu'on n'a pas
 * pu lire (règle du projet, pertes du 20/09 et du 24/09).
 */
async function charger(): Promise<SessionCode[]> {
  const v = await db().read(COLLECTION);
  if (v === undefined || v === null) return [];
  if (!Array.isArray(v)) throw new Error("Registre des sessions de Code illisible.");
  return v as SessionCode[];
}

let file: Promise<unknown> = Promise.resolve();
function enFile<T>(travail: () => Promise<T>): Promise<T> {
  const suite = file.then(travail, travail);
  file = suite.catch(() => undefined);
  return suite;
}

/** Première ligne utile d'une demande, pour titre. */
export function titreDe(demande: string): string {
  const ligne = demande.replace(/\s+/g, " ").trim();
  return ligne.length > TITRE_MAX ? `${ligne.slice(0, TITRE_MAX - 1)}…` : ligne;
}

/** Une session vient d'être ouverte par Helix Code pour cette personne. */
export function noterSession(s: Omit<SessionCode, "creee" | "maj" | "titre"> & { titre?: string }): Promise<void> {
  return enFile(async () => {
    const liste = await charger();
    if (liste.some((x) => x.id === s.id)) return;
    const maintenant = new Date().toISOString();
    liste.push({ ...s, titre: s.titre ?? "", creee: maintenant, maj: maintenant });
    await db().write(COLLECTION, borner(liste, s.userId));
  });
}

/**
 * Bornes par personne (voir `PAR_PERSONNE_MAX`, `INSCRITES_MAX`) : les plus
 * anciennes sont d'abord masquées, et seulement au-delà de la seconde borne
 * effacées du registre. Jamais de chez OpenCode.
 */
function borner(liste: SessionCode[], userId: string): SessionCode[] {
  const parAnciennete = (a: SessionCode, b: SessionCode) => a.maj.localeCompare(b.maj);
  const visibles = liste.filter((x) => x.userId === userId && !x.masquee && !x.parent).sort(parAnciennete);
  for (const x of visibles.slice(0, Math.max(0, visibles.length - PAR_PERSONNE_MAX))) x.masquee = true;
  const siennes = liste.filter((x) => x.userId === userId).sort(parAnciennete);
  const trop = new Set(siennes.slice(0, Math.max(0, siennes.length - INSCRITES_MAX)).map((x) => x.id));
  return trop.size ? liste.filter((x) => !trop.has(x.id)) : liste;
}

/**
 * Une sous-session (sous-agent) naît dans une session du registre : elle est
 * inscrite sous la même propriétaire, masquée. Sans elle, ses appels d'outils
 * et ses demandes d'autorisation n'avaient personne à qui revenir, et l'accès
 * à son flux n'était borné par rien. Une sous-session d'une sous-session
 * hérite de la même façon. Parent inconnu du registre : rien n'est inscrit.
 */
export function noterSousSession(id: string, parent: string): Promise<void> {
  return enFile(async () => {
    const liste = await charger();
    if (liste.some((x) => x.id === id)) return;
    const mere = liste.find((x) => x.id === parent);
    if (!mere) return;
    const maintenant = new Date().toISOString();
    liste.push({
      id,
      userId: mere.userId,
      dossier: mere.dossier,
      vps: mere.vps,
      titre: "",
      modele: mere.modele,
      ...(mere.variante ? { variante: mere.variante } : {}),
      creee: maintenant,
      maj: maintenant,
      masquee: true,
      parent,
    });
    await db().write(COLLECTION, borner(liste, mere.userId));
  });
}

/** Une demande part dans cette session : date, et titre si elle n'en a pas encore. */
export function toucherSession(id: string, demande: string, reglage?: { modele: string; variante?: string }): Promise<void> {
  return enFile(async () => {
    const liste = await charger();
    const s = liste.find((x) => x.id === id);
    if (!s) return;
    s.maj = new Date().toISOString();
    if (!s.titre && demande.trim()) s.titre = titreDe(demande);
    if (reglage) {
      s.modele = reglage.modele;
      s.variante = reglage.variante;
    }
    await db().write(COLLECTION, liste);
  });
}

export async function sessionCode(id: string): Promise<SessionCode | undefined> {
  return (await charger()).find((x) => x.id === id);
}

/** Les sessions de cette personne, la plus récente d'abord. */
export async function sessionsDe(userId: string): Promise<SessionCode[]> {
  return (await charger())
    .filter((x) => x.userId === userId && !x.masquee && !x.parent)
    .sort((a, b) => b.maj.localeCompare(a.maj));
}

/**
 * Retire une session de la liste de sa propriétaire : elle est **masquée**,
 * pas oubliée (voir l'en-tête), et sa conversation reste chez OpenCode.
 */
export function retirerSession(id: string, userId: string): Promise<boolean> {
  return enFile(async () => {
    const liste = await charger();
    const s = liste.find((x) => x.id === id && x.userId === userId && !x.parent);
    if (!s) return false;
    if (!s.masquee) {
      s.masquee = true;
      await db().write(COLLECTION, liste);
    }
    return true;
  });
}

/** Effacement d'un compte : ses sessions sortent du registre ; rend lesquelles, pour les effacer chez OpenCode (effacement.ts). */
export function oublierSessionsCode(userId: string): Promise<SessionCode[]> {
  return enFile(async () => {
    const liste = await charger();
    const reste = liste.filter((x) => x.userId !== userId);
    if (reste.length !== liste.length) await db().write(COLLECTION, reste);
    return liste.filter((x) => x.userId === userId);
  });
}

/* ------------------------ historique, depuis OpenCode ------------------------ */

export interface MessageHistorique {
  role: "user" | "assistant";
  texte: string;
  raisonnement?: string;
  outils: { callID: string; tool: string; input: Record<string, unknown>; etat: "encours" | "fini" | "echec"; apercu?: string }[];
}

const ARRET = /^\[La demande précédente a été arrêtée par la personne[^\]]*\]\s*/;
/*
 * Ce que Helix ajoute à la demande pour le modèle (index.ts, design.ts,
 * application.ts) : retiré de l'historique, qui montre ce que la personne a
 * écrit. Vu le 26/09/2026 : la consigne d'une application préparée
 * réapparaissait en entier dans la bulle de la personne à la réouverture.
 */
const AJOUTS = [
  "\n\n---\nDesign : ce projet a un design",
  "\n\n---\nHelix a déjà construit",
  "\n\n---\nMéthode de travail (Helix)",
  "\n\n---\nPlan de Helix",
  "\n\n---\nCarte du projet (Helix)",
];
/*
 * Une relance du contrôle automatique (controleCode.ts) est envoyée comme un
 * message de la personne : à la réouverture, elle s'affichait dans sa bulle,
 * comme si elle l'avait écrite. Reconnue à son début, en français ou dans la
 * langue de l'instance.
 */


/** Ce que la personne a écrit, sans ce que Helix y a ajouté pour le modèle (index.ts, useCode.ts). */
export function demandeAffichee(texte: string): string {
  let fin = texte.length;
  for (const a of AJOUTS) {
    const i = texte.indexOf(a);
    if (i >= 0 && i < fin) fin = i;
  }
  return texte.slice(0, fin).replace(ARRET, "");
}

const estRelance = (texte: string) => {
  const debut = texte.trimStart();
  const entete = (x: string) => x.slice(0, x.indexOf("]") + 1);
  // Les étapes d'un plan de Helix (sequenceCode.ts) commencent toutes par « [Helix ».
  return debut.startsWith("[Helix") || [entete(ENTETE_RELANCE), entete(t(ENTETE_RELANCE))].some((e) => e.length > 2 && debut.startsWith(e));
};
/** La ligne affichée à la place d'une relance : l'étape du plan, ou le contrôle automatique. */
const noteDeRelance = (texte: string) => {
  const premiere = texte.trimStart().split("\n")[0] ?? "";
  const controle = [entete(ENTETE_RELANCE), entete(t(ENTETE_RELANCE))].some((e) => e.length > 2 && premiere.startsWith(e));
  if (/^\[Helix\b/.test(premiere) && !controle) return premiere.replace(/^\[([^\]]+)\]\s*/, "$1 · ").slice(0, 200);
  return t("Contrôle automatique : problèmes trouvés, l'agent reprend son travail.");
};
const entete = (x: string) => x.slice(0, x.indexOf("]") + 1);

/** Ce qu'un outil a reçu, sans le contenu d'un fichier entier : de quoi le libeller. */
function entreeCourte(entree: unknown): Record<string, unknown> {
  const e = (entree ?? {}) as Record<string, unknown>;
  const garde: Record<string, unknown> = {};
  for (const [cle, v] of Object.entries(e)) {
    if (typeof v === "string") garde[cle] = v.length > 300 ? `${v.slice(0, 300)}…` : v;
    else if (cle === "todos" && Array.isArray(v)) garde[cle] = v.slice(0, 50);
  }
  return garde;
}

interface MessageOpenCode {
  info?: { role?: string };
  parts?: {
    type?: string;
    text?: string;
    synthetic?: boolean;
    time?: { end?: number };
    tool?: string;
    callID?: string;
    state?: { status?: string; input?: unknown; output?: unknown; error?: unknown };
  }[];
}

/**
 * Les messages d'OpenCode (ancienne API) mis dans la forme que l'écran
 * affiche. Un tour de l'agent fait plusieurs messages « assistant » (un par
 * étape) : ils sont regroupés en une seule réponse, comme à l'écran pendant le
 * travail.
 */
export function historiqueDe(
  messages: MessageOpenCode[],
  /*
   * Session où l'agent travaille encore (27/09/2026) : l'écran qui la rouvre
   * reçoit la suite par le flux, à partir du dernier numéro rendu avec cet
   * historique. Un texte encore en train de s'écrire n'est donc pas repris
   * ici : il arrive entier par le flux (`text.ended`), et l'écran l'aurait
   * montré deux fois, moitié puis entier.
   *
   * `demandeEnAttente` : la demande que la personne vient d'envoyer, pas
   * encore arrivée chez OpenCode (Helix prépare l'application ou le plan,
   * plusieurs minutes avec un petit modèle). Sans elle, l'écran qui revenait
   * sur la session n'y montrait plus le message envoyé.
   */
  options: { enCours?: boolean; demandeEnAttente?: string } = {},
): MessageHistorique[] {
  const rendu: MessageHistorique[] = [];
  for (const m of messages) {
    const role = m.info?.role === "user" ? "user" : m.info?.role === "assistant" ? "assistant" : undefined;
    if (!role) continue;
    const textes: string[] = [];
    const raisonnements: string[] = [];
    const outils: MessageHistorique["outils"] = [];
    for (const p of m.parts ?? []) {
      const enEcriture = options.enCours && role === "assistant" && (p.type === "text" || p.type === "reasoning") && !p.time?.end;
      if (enEcriture) continue;
      if (p.type === "text" && typeof p.text === "string" && !p.synthetic && p.text.trim()) textes.push(p.text);
      else if (p.type === "reasoning" && typeof p.text === "string" && p.text.trim()) raisonnements.push(p.text);
      else if (p.type === "tool" && typeof p.tool === "string") {
        /*
         * Un outil dont l'agent écrit encore les arguments n'est pas montré :
         * s'il travaille toujours, il arrivera par le flux, complet.
         */
        const statut = p.state?.status;
        if (statut !== "completed" && statut !== "error" && statut !== "running") continue;
        const sortie = typeof p.state?.output === "string" ? p.state.output : typeof p.state?.error === "string" ? p.state.error : "";
        outils.push({
          callID: typeof p.callID === "string" ? p.callID : "",
          tool: p.tool,
          input: entreeCourte(p.state?.input),
          etat: statut === "completed" ? "fini" : statut === "error" ? "echec" : "encours",
          ...(sortie ? { apercu: sortie.slice(0, 2000) } : {}),
        });
      }
    }
    if (role === "user") {
      // Une relance de Helix : la réponse continue, avec une ligne qui le dit (comme à l'écran pendant le travail).
      if (estRelance(textes.join("\n\n"))) {
        const precedent = rendu[rendu.length - 1];
        const note = `*${noteDeRelance(textes.join("\n\n"))}*`;
        if (precedent?.role === "assistant") precedent.texte = [precedent.texte, note].filter(Boolean).join("\n\n");
        continue;
      }
      const texte = demandeAffichee(textes.join("\n\n"));
      if (texte.trim()) rendu.push({ role, texte, outils: [] });
      continue;
    }
    const precedent = rendu[rendu.length - 1];
    const cible = precedent?.role === "assistant" ? precedent : undefined;
    if (cible) {
      if (textes.length) cible.texte = [cible.texte, ...textes].filter(Boolean).join("\n\n");
      if (raisonnements.length) cible.raisonnement = [cible.raisonnement, ...raisonnements].filter(Boolean).join("\n\n");
      cible.outils.push(...outils);
    } else {
      rendu.push({
        role,
        texte: textes.join("\n\n"),
        ...(raisonnements.length ? { raisonnement: raisonnements.join("\n\n") } : {}),
        outils,
      });
    }
  }
  const attendue = options.demandeEnAttente ? demandeAffichee(options.demandeEnAttente).trim() : "";
  if (attendue) rendu.push({ role: "user", texte: attendue, outils: [] });
  return rendu;
}
