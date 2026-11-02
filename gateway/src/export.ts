import { listerEntretiens } from "./entretiens.ts";
import { projetsVps } from "./vps.ts";
import { db } from "./db.ts";
import type { Demandeur } from "./authz.ts";
import { publicAccounts, etatDeuxFacteurs } from "./accounts.ts";
import { listSessions } from "./usersession.ts";
import { consommationDe } from "./usage.ts";
import { jours as joursDuJournal, lire as lireJournal, journaliser } from "./audit.ts";
import { listerGroupes } from "./groupes.ts";
import { elementsDe } from "./bibliotheque.ts";
import { reunionsDe } from "./reunions.ts";
import { connaissancesPourExport } from "./connaissances.ts";
import { pourExport as memoiresPourExport } from "./memoireConversation.ts";
import { imagesDe } from "./images.ts";
import { projetsPourExport } from "./entrainement.ts";
import { clesDe as clesApiDe } from "./clesApi.ts";
import { lister as tachesProgrammeesDe } from "./tachesProgrammees.ts";

/**
 * Export des données d'une personne (RGPD, articles 15 et 20).
 *
 * Le droit d'accès porte sur tout ce que l'instance détient **sur** la
 * personne ; le droit à la portabilité, sur ce qu'elle a fourni, dans un
 * format structuré et lisible par une machine. Un seul fichier JSON couvre les
 * deux, et chaque rubrique dit d'où elle vient.
 *
 * Règles de périmètre, les mêmes que partout ailleurs :
 *  - la personne est celle de la séance, jamais un identifiant envoyé ;
 *  - rien de ce qui appartient à un collègue n'y entre, sauf ce qu'il lui a
 *    explicitement partagé (conversations) ou ce qu'ils ont en commun
 *    (projets dont elle est membre), et c'est alors marqué comme tel ;
 *  - aucun secret : ni empreinte de mot de passe, ni secret du second facteur,
 *    ni codes de secours, ni jeton de séance, ni mot de passe de connecteur.
 */

const FORMAT = "helix-export";
const VERSION = 1;

const tableau = (v: unknown): Record<string, unknown>[] =>
  Array.isArray(v) ? v.filter((x): x is Record<string, unknown> => typeof x === "object" && x !== null) : [];

const memeEmail = (a: unknown, b: string) =>
  typeof a === "string" && a.trim().toLowerCase() === b.trim().toLowerCase();

const designe = (liste: unknown, qui: Demandeur) =>
  Array.isArray(liste) &&
  liste.some(
    (p) =>
      (p as { userId?: string }).userId === qui.userId ||
      memeEmail((p as { email?: string }).email, qui.email),
  );

export interface ExportDonnees {
  format: typeof FORMAT;
  version: typeof VERSION;
  genereLe: string;
  compte: unknown;
  profil: unknown;
  conversations: { role: "proprietaire" | "partagee-avec-vous"; conversation: unknown }[];
  projets: { role: "proprietaire" | "membre"; projet: unknown }[];
  taches: unknown[];
  agents: unknown[];
  competences: unknown[];
  tachesProgrammees: unknown[];
  /** Employés OpenClaw qu'elle a déployés, et ce qu'elle a dit à chacun (les siens et ceux des collègues). */
  employes: unknown[];
  echangesAvecLesEmployes: unknown;
  clesModeles: unknown[];
  /** Ses clés d'API personnelles : nom, fin, dates, portée. Jamais la clé ni son empreinte. */
  clesApi: unknown[];
  /** Groupes dont elle est membre, et si elle en est responsable. */
  groupes: { nom: string; description: string; responsable: boolean; membres: number }[];
  /** Ses dossiers et documents de la bibliothèque (le contenu se télécharge depuis l'écran). */
  bibliotheque: unknown[];
  /** Ses réunions : compte rendu et transcription (le son, s'il est gardé, s'écoute depuis l'écran). */
  reunions: unknown[];
  /** Ses bases de connaissances, et ses documents ajoutés aux bases des autres (sans vecteurs). */
  basesDeConnaissances: unknown;
  /**
   * Mémoire de ses longues conversations (memoireConversation.ts, 16/10/2026) :
   * ce qui est sorti de la place du modèle, Chat par Chat, tel que rangé (sans vecteurs).
   */
  memoireDesConversations: unknown[];
  /** Les images qu'elle a créées, avec leur demande (le fichier se télécharge depuis le Chat). */
  imagesCreees: unknown[];
  projetsVps: unknown[];
  entretiens: unknown[];
  /** Ses projets d'entraînement : les exemples, et le modèle installé s'il l'a été. */
  modelesEntraines: unknown[];
  consommation: unknown;
  seances: unknown[];
  journal: unknown[];
  nonInclus: string[];
}

export async function exporterDonnees(qui: Demandeur): Promise<ExportDonnees> {
  const compte = (await publicAccounts()).find((a) => a.id === qui.userId) ?? null;
  const deuxFacteurs = await etatDeuxFacteurs(qui.userId);

  const profils = (await db().read("profiles")) as Record<string, unknown> | null;
  const profil = profils && typeof profils === "object" ? (profils[`profile:${qui.userId}`] ?? null) : null;

  /*
   * Conversations : les siennes, et celles qu'un collègue lui a partagées
   * nommément. Pas celles simplement ouvertes à toute l'organisation : elles
   * sont lisibles, mais ce ne sont pas des données sur elle.
   */
  const conversations: ExportDonnees["conversations"] = [];
  for (const c of tableau(await db().read("sessions"))) {
    if (c.ownerId === qui.userId) conversations.push({ role: "proprietaire", conversation: c });
    else if (designe(c.sharedWith, qui)) conversations.push({ role: "partagee-avec-vous", conversation: c });
  }

  const projets: ExportDonnees["projets"] = [];
  for (const p of tableau(await db().read("projects"))) {
    if (p.ownerId === qui.userId) projets.push({ role: "proprietaire", projet: p });
    else if (designe(p.members, qui)) projets.push({ role: "membre", projet: p });
  }

  const taches = tableau(await db().read("tasks")).filter((t) => t.ownerId === qui.userId);
  // Ses agents seulement : un agent d'organisation écrit par un collègue est à lui.
  const agents = tableau(await db().read("agents")).filter((a) => a.ownerId === qui.userId);
  // Ses compétences et ses tâches programmées, oubliées de l'export jusqu'au 26/09/2026.
  const competences = tableau(await db().read("competences")).filter((c) => c.ownerId === qui.userId);
  const tachesProgrammees = await tachesProgrammeesDe(qui.userId);
  const employes = tableau(await db().read("employes")).filter((e) => e.ownerId === qui.userId);
  // Ses clés de modèles cloud : le fournisseur et les modèles, jamais la clé elle-même.
  const clesModeles = tableau(await db().read("clesModeles"))
    .filter((c) => c.ownerId === qui.userId)
    .map(({ cle: _cle, ...reste }) => ({ ...reste, fin: typeof _cle === "string" ? _cle.slice(-4) : "" }));
  const groupes = (await listerGroupes())
    .filter((g) => g.membres.includes(qui.userId))
    .map((g) => ({ nom: g.nom, description: g.description, responsable: g.responsables.includes(qui.userId), membres: g.membres.length }));
  const bibliotheque = (await elementsDe(qui.userId)).map(({ favoris: _f, ...e }) => e);
  const tousEchanges = (await db().read("echangesEmployes")) as Record<string, unknown> | null;
  const echangesAvecLesEmployes =
    tousEchanges && typeof tousEchanges === "object" ? (tousEchanges[qui.userId] ?? {}) : {};

  /*
   * Journal : les entrées dont elle est l'auteur. Tout le journal conservé,
   * pas seulement les cinquante dernières lignes de l'écran Sécurité.
   */
  const journal: unknown[] = [];
  for (const jour of [...joursDuJournal()].reverse()) {
    for (const e of lireJournal(Number.MAX_SAFE_INTEGER, jour).reverse()) {
      if (e.qui === qui.userId) journal.push(e);
    }
  }

  const images = imagesDe(qui.userId);
  const memoires = memoiresPourExport(qui.userId);

  const resultat: ExportDonnees = {
    entretiens: await listerEntretiens(qui.userId),
    projetsVps: await projetsVps(qui.userId),
    format: FORMAT,
    version: VERSION,
    genereLe: new Date().toISOString(),
    compte: compte ? { ...compte, deuxFacteurs } : null,
    profil,
    conversations,
    projets,
    taches,
    agents,
    competences,
    tachesProgrammees,
    employes,
    echangesAvecLesEmployes,
    clesModeles,
    clesApi: await clesApiDe(qui.userId),
    groupes,
    bibliotheque,
    reunions: (await reunionsDe(qui.userId)).map(({ reunion, segments }) => ({ ...reunion, transcription: segments })),
    basesDeConnaissances: await connaissancesPourExport({ userId: qui.userId, groupes: qui.groupes ?? [] }),
    memoireDesConversations: memoires.chats,
    imagesCreees: images.images,
    modelesEntraines: projetsPourExport(qui.userId),
    consommation: await consommationDe(qui.userId),
    seances: await listSessions(qui.userId),
    journal,
    nonInclus: [
      "Mot de passe, secret du second facteur et codes de secours : l'instance n'en garde que des empreintes, qui ne se relisent pas.",
      "Jetons de séance : ce sont des clés d'accès, un export ne doit pas en transporter.",
      "Clés d'API : leur liste figure ici ; la clé elle-même n'a été montrée qu'à sa création, l'instance n'en garde qu'une empreinte.",
      "Réglages de l'instance (connecteurs, boîte de courrier, agenda, tarifs des modèles) : ils appartiennent à l'instance, pas à une personne.",
      "Fichiers de votre dossier de travail : ils sont restés sur le disque, là où vous les avez rangés.",
      "Contenu des documents de votre bibliothèque : leur liste figure ici ; chacun se télécharge depuis la Bibliothèque, tel que vous l'avez déposé.",
      "Conversations d'autres personnes ouvertes à toute l'organisation : lisibles par vous, mais ce ne sont pas des données vous concernant.",
      "Index des bases de connaissances (passages et vecteurs) : des calculs tirés de vos documents, qui figurent déjà ici.",
      "Fichiers des images créées et poids des modèles entraînés : les images se téléchargent depuis leur Chat, les modèles se retrouvent dans LM Studio.",
      ...(images.lisible ? [] : ["Images créées : leur registre est illisible sur l'instance, leur liste n'a pas pu être lue."]),
      "Vecteurs de la mémoire des conversations : des calculs tirés du texte rangé, qui figure déjà ici.",
      ...(memoires.illisibles > 0 ? [`Mémoire des conversations : ${memoires.illisibles} mémoire(s) illisible(s) sur l'instance, leur contenu n'a pas pu être lu.`] : []),
    ],
  };

  journaliser("donnees.exportees", qui.userId, {
    conversations: conversations.length,
    projets: projets.length,
    taches: taches.length,
    agents: agents.length,
    employes: employes.length,
    entreesDeJournal: journal.length,
  });
  return resultat;
}
