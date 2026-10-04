import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { streamChat, type ChatTurn } from "@/lib/gateway";
import { notifySessionsChanged, SESSIONS_CHANGED } from "./useSessions";
import { contexteTexte, documentsDe, images, type Attachment, type DocumentEnvoye } from "@/lib/attachments";
import { currentUser } from "@/lib/store/identity";
import { t, tf } from "@/lib/i18n";
import { creerImage as creerSurLaMachine, creerVideo as creerVideoSurLaMachine, type Format, type ImageCreee } from "@/lib/images";
import type { NiveauRaisonnement } from "@/lib/store/profile";
import type { Citation } from "@/lib/connaissances";
import type { SourceWeb } from "@/lib/rechercheWeb";
import {
  createSession,
  getSession,
  updateSession,
  deriveTitle,
  memoriserDossier,
  type Session,
  type SessionOrigin,
  type StoredMessage,
} from "@/lib/store/sessions";
import { aleatoire } from "@/lib/store/storage";
import { cibleAffichee } from "@/lib/libellesOutils";
import { creerFiles, type Ajout, type IssueReponse } from "@/lib/fileAttente";

/** Trace d'un outil utilisé par l'agent pendant sa réponse. */
export interface ToolTrace {
  name: string;
  args: Record<string, unknown>;
  running: boolean;
  ok?: boolean;
  preview?: string;
  /**
   * Libellé et cible déjà mis en mots par qui connaît l'outil (l'écran Code,
   * `actionOutil`) : « Sous-tâche : explorer le dossier src » plutôt que
   * « task ». Absents, l'affichage les tire du nom et des arguments.
   */
  libelle?: string;
  cible?: string;
  /**
   * Quand l'outil a commencé (horloge de cet écran, en ms), pour montrer le
   * temps qu'il tourne ; puis ce qu'il a duré, une fois fini. Mesuré à la
   * réception des évènements `tool_start` et `tool_end` du flux, jamais
   * estimé. Absents sur une trace d'avant le 27/09/2026 : rien ne s'affiche.
   */
  debut?: number;
  duree?: number;
}

/**
 * Ce qu'une réponse a pris de temps (demandé par Medhi le 27/09/2026), en ms.
 *
 * Mesuré ici, à la réception du flux : la passerelle n'horodate pas ses
 * évènements (gateway/src/chat.ts), mais elle les relaie au fil de l'eau, si
 * bien que l'heure d'arrivée est celle du moteur, au réseau près. Ce qui n'a
 * pas été mesuré reste absent : une réponse ancienne n'affiche rien.
 */
export interface DureesReponse {
  /** Envoi de la question : l'origine des autres mesures (réponse en cours seulement). */
  debut?: number;
  /** De l'envoi au premier mot de la réponse : ce qui pèse sur un processeur lent. */
  premierMot?: number;
  /** Réflexion du modèle, toutes ses phases additionnées (il peut réfléchir avant chaque outil). */
  reflexion?: number;
  /** Phase de réflexion en cours : son début, pour le compteur (réponse en cours seulement). */
  reflexionDepuis?: number;
  /** De l'envoi à la fin de la réponse, seulement si elle est allée à son terme. */
  reponse?: number;
}

/** Une étape du plan suivi par l'agent, et où il en est. */
export interface EtapePlan {
  titre: string;
  /** « découpée » : trop grosse, elle a été redécoupée en parties (qui suivent dans la liste). */
  etat: "attente" | "encours" | "fait" | "echec" | "decoupee";
  /** L'étape a dû être redemandée : elle n'avait rien modifié. */
  reprise?: boolean;
  /** Son résultat a été contrôlé sur l'état réel, après coup. */
  controlee?: boolean;
  /** « 2 », ou « 2.1 » pour une partie de l'étape 2. */
  chemin?: string;
  /** 0 pour une étape du plan, 1 pour une partie, 2 pour une partie de partie. */
  profondeur?: number;
}

/** L'étape visée par un évènement : par son chemin, ou par son rang (passerelle plus ancienne). */
function etapeDe(plan: EtapePlan[], ev: { index?: number; chemin?: string }): EtapePlan | undefined {
  const chemin = ev.chemin ?? (ev.index !== undefined ? String(ev.index + 1) : undefined);
  return chemin ? plan.find((e) => (e.chemin ?? "") === chemin) ?? (ev.index !== undefined ? plan[ev.index] : undefined) : undefined;
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  /** Canal de raisonnement (modèles type Qwen3), affiché repliable. */
  reasoning?: string;
  /** Outils appelés pendant la génération de cette réponse. */
  tools?: ToolTrace[];
  /**
   * Plan suivi quand la demande a été découpée. Sans lui, une tâche longue
   * n'offre que du silence entre deux appels d'outils : l'utilisateur ne sait
   * ni où en est l'agent, ni combien il reste.
   */
  plan?: EtapePlan[];
  /** Revue finale de la demande entière, après les étapes. */
  revue?: "encours" | "fait" | "incomplet";
  /** Réponse en cours de génération. */
  streaming?: boolean;
  /** Ce qui se passe avant la réponse : « Chargement de qwen3-vl-4b en mémoire... ». */
  statut?: string;
  /**
   * Pièces jointes à la question, telles que le message les montre : nom,
   * poids, et si le fichier a été lu en entier. Gardées avec le Chat ; leur
   * contenu, non (voir `documents`).
   */
  pieces?: PieceMontree[];
  /**
   * Texte des documents joints, gardé tant que le Chat est ouvert (27/09/2026) :
   * il repart avec chaque question suivante, pour qu'« et la page 3 ? »
   * s'adresse encore au fichier. Il n'est pas enregistré avec le Chat : 200 000
   * caractères par fichier gonfleraient d'autant le stockage et la
   * synchronisation de tous les Chats.
   */
  documents?: DocumentEnvoye[];
  /** Image créée en réponse (bouton « Image » du composeur). */
  image?: ImageCreee;
  /**
   * Passages des bases de connaissances donnés au modèle pour cette réponse.
   * `ignorees` : bases choisies que la personne ne voit pas (l'instance les a
   * écartées) ; `erreur` : les bases n'ont pas pu être consultées.
   */
  sources?: { citations: Citation[]; ignorees?: number; aReindexer?: number; erreur?: string };
  /** Sources de la recherche sur le web pour cette réponse (numéro cité « [n] », titre, adresse, page ouverte ou non). */
  sourcesWeb?: SourceWeb[];
  /** Durées mesurées de la réponse (réflexion, premier mot, réponse entière). */
  durees?: DureesReponse;
  error?: string;
}

const newId = () => aleatoire(11);

/** Les durées qui valent d'être gardées : les mesures finies, pas les repères de la réponse en cours. */
function dureesGardees(d: DureesReponse | undefined): StoredMessage["durees"] {
  if (!d) return undefined;
  const garde: NonNullable<StoredMessage["durees"]> = {};
  if (d.premierMot !== undefined) garde.premierMot = d.premierMot;
  if (d.reflexion !== undefined) garde.reflexion = d.reflexion;
  if (d.reponse !== undefined) garde.reponse = d.reponse;
  return Object.keys(garde).length > 0 ? garde : undefined;
}

/** Une étape telle qu'elle s'affiche, sans ses arguments ni son aperçu. */
function etapeGardee(trace: ToolTrace): NonNullable<StoredMessage["outils"]>[number] {
  // La cible calculée comme à l'écran (MessageList) : rouverte, l'étape se lit pareil.
  const cible = trace.cible ?? (trace.libelle ? undefined : cibleAffichee(trace.args));
  return {
    name: trace.name,
    ...(trace.libelle ? { libelle: trace.libelle } : {}),
    ...(cible ? { cible: cible.slice(0, 300) } : {}),
    ok: !trace.running && trace.ok === true,
    ...(trace.duree !== undefined ? { duree: trace.duree } : {}),
  };
}

/** Une pièce jointe dans le message de la personne (PiecesJointesMessage.tsx). */
export interface PieceMontree {
  nom: string;
  type: "texte" | "image";
  /** Poids du fichier, en octets. */
  taille?: number;
  /** Seul le début du fichier a été lu (trop long pour l'écran). */
  tronque?: boolean;
}

/** Le texte que le message affiche quand la personne n'a rien écrit : les noms des pièces. */
const etiquetteDes = (pieces: { nom: string }[]) => `(${pieces.map((p) => p.nom).join(", ")})`;

/**
 * Ce que le modèle reçoit d'un message de la personne : ses documents dans
 * leur balise (attachments.ts, `enveloppe`), puis ce qu'elle a écrit. Un Chat
 * rouvert n'a plus le texte des fichiers : le modèle le sait, au lieu de
 * croire qu'on ne lui a rien joint.
 */
function contenuPourLeModele(m: Message): string {
  const question = m.pieces && m.content === etiquetteDes(m.pieces) ? "" : m.content;
  if (m.documents && m.documents.length > 0) return [contexteTexte(m.documents), question].filter(Boolean).join("\n\n");
  const textes = (m.pieces ?? []).filter((p) => p.type === "texte").map((p) => `« ${p.nom} »`);
  if (textes.length === 0) return m.content;
  return [`[Document joint à ce message : ${textes.join(", ")}. Son contenu n'est plus disponible dans ce Chat rouvert : s'il faut le relire, demande à la personne de le joindre de nouveau.]`, question].filter(Boolean).join("\n\n");
}

/*
 * Réponses en cours, par Chat, hors de l'écran.
 *
 * Signalé par Medhi le 26/09/2026 : « si dans le Chat je pars de la
 * discussion, tout s'arrête au lieu de continuer ». La réponse vivait dans
 * l'écran : ouvrir un autre Chat ou en commencer un nouveau appelait
 * « Arrêter ». Elle vit maintenant ici, rattachée à son Chat : l'écran s'y
 * abonne quand il affiche ce Chat, s'en détache quand il en affiche un autre,
 * et la réponse continue, puis s'enregistre dans son Chat. Seul le bouton
 * « Arrêter » l'arrête. Une page rechargée ou l'application fermée, elle, la
 * coupe : ce qui était écrit n'est gardé qu'à la fin de la réponse.
 *
 * Depuis le 29/09/2026, la réponse elle-même s'écrit ici aussi (`repondre`,
 * `creer`), hors du crochet : un message mis en file (`filesDesChats`) doit
 * pouvoir partir à la fin de la réponse précédente même quand l'écran montre
 * un autre Chat, ou une autre page. L'écran suit par l'évènement
 * `CHATS_EN_COURS` : une réponse qui naît dans le Chat affiché, il s'y abonne ;
 * une réponse qui finit, il rend la main.
 */
interface ReponseEnCours {
  history: Message[];
  controller: AbortController;
  abonnes: Set<(history: Message[]) => void>;
}
const reponsesEnCours = new Map<string, ReponseEnCours>();
export const CHATS_EN_COURS = "helix:chats-en-cours";

/** Un Chat a-t-il une réponse en train de s'écrire (pour la barre latérale) ? */
export const chatEnCours = (sessionId: string) => reponsesEnCours.has(sessionId);

function signalerEnCours() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(CHATS_EN_COURS));
}

/** Arrête la réponse en cours d'un Chat, par exemple quand il est supprimé. */
export function arreterReponse(sessionId: string) {
  reponsesEnCours.get(sessionId)?.controller.abort();
}

/**
 * Un message mis en file pendant une réponse (29/09/2026), avec ce qui était
 * choisi **au moment où il y est entré** : pièces jointes, modèle, niveau,
 * outils, bases, agent, recherche sur le web, ou création d'une image. Changer
 * de modèle ensuite ne change pas ce qu'il emportera.
 */
export interface EnvoiEnFile {
  texte: string;
  pieces: Attachment[];
  options: Options;
  /** Le menu « + » demandait une image ou une vidéo plutôt qu'une réponse. */
  creation?: { format: Format; video: boolean };
}

/*
 * Une file par Chat (lib/fileAttente.ts), en mémoire de cette page : ni
 * enregistrée ni synchronisée. Les messages qui en partent, eux, suivent le
 * chemin ordinaire (enregistrés dans leur Chat, synchronisés comme les autres).
 */
export const filesDesChats = creerFiles<EnvoiEnFile>();

/*
 * Un Chat supprimé emporte sa file, qu'il soit affiché ou non (supprimé depuis
 * la barre latérale, ou sur un autre poste et arrivé par la synchronisation).
 * On n'arrête pas de réponse ici : le Chat affiché s'en charge (HomePage), et
 * une réponse d'un Chat disparu ne relance rien à sa fin (`terminer`).
 */
if (typeof window !== "undefined") {
  window.addEventListener(SESSIONS_CHANGED, () => {
    for (const cle of filesDesChats.cles()) if (!getSession(cle)) filesDesChats.oublier(cle);
  });
}

/**
 * Ce que la personne lit quand l'envoi échoue.
 *
 * Une panne réseau remonte du navigateur en anglais technique (« Failed to
 * fetch », « Load failed » sur Safari, « fetch failed » sous Node) : elle ne
 * dit ni quoi ni que faire. Les refus de la passerelle, eux, sont déjà écrits
 * pour la personne et dans sa langue : on les laisse tels quels.
 */
function messageDErreur(err: unknown): string {
  // Seulement l'échec du transport : une autre TypeError serait un défaut du code, à montrer tel quel.
  if (err instanceof TypeError && /fetch|network|load failed|terminated/i.test(err.message)) {
    return t("L'instance ne répond pas : la réponse n'a pas pu être obtenue. Vérifiez que l'application est ouverte, puis réessayez.");
  }
  return err instanceof Error ? err.message : String(err);
}

interface Options {
  model?: string;
  effort?: NiveauRaisonnement;
  /** Message système construit depuis le profil privé de l'utilisateur. */
  systemPrompt?: string | null;
  /** Origine du modèle : conditionne le partage de la session. */
  origin?: SessionOrigin;
  /** Autoriser l'agent à utiliser les outils MCP. */
  tools?: boolean;
  /** Bases de connaissances consultées à chaque question : celles de l'agent, du projet, et le choix de la zone de saisie. */
  connaissances?: string[];
  /** L'agent choisi, pour que l'instance ajoute ses instructions masquées (store/agents.ts, `INSTRUCTIONS_MASQUEES`). */
  agent?: string;
  /** La bascule « Rechercher sur le web » du menu « + » (28/09/2026). */
  web?: boolean;
  /** Écran qui mène la conversation : « cowork » la range dans les sessions de Cowork (store/sessions.ts, `surface`). */
  surface?: Session["surface"];
  /** Session de Cowork : le dossier de travail du moment, retenu à chaque demande (store/sessions.ts, `dossier`). */
  dossier?: string;
}

/** Enregistre l'historique d'un Chat : celui de l'écran, ou celui d'une réponse qui a continué sans lui. */
function persisterDans(session: Session, history: Message[], model: string | undefined) {
  const stored: StoredMessage[] = history
    .filter((m) => !m.error && m.content.trim().length > 0)
    .map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      reasoning: m.reasoning,
      ...(m.image ? { image: m.image } : {}),
      // Les pièces jointes restent visibles quand on rouvre le Chat : nom, poids, lu en entier ou non (pas le contenu).
      ...(m.pieces && m.pieces.length > 0 ? { pieces: m.pieces } : {}),
      // Les citations restent avec la réponse : rouvert, le Chat dit encore d'où elle venait.
      ...(m.sources && m.sources.citations.length > 0 ? { sources: m.sources.citations } : {}),
      ...(m.sourcesWeb && m.sourcesWeb.length > 0 ? { sourcesWeb: m.sourcesWeb } : {}),
      /*
       * Les durées et les étapes restent avec la réponse (27/09/2026) : rouvert,
       * ou relu sur un autre poste après synchronisation, le Chat dit encore
       * combien de temps chaque chose a pris. Des étapes, on garde ce qui
       * s'affiche (nom, cible, issue, durée), pas les arguments ni l'aperçu :
       * un fichier écrit par l'agent n'a pas à se recopier dans le Chat.
       */
      ...(dureesGardees(m.durees) ? { durees: dureesGardees(m.durees) } : {}),
      ...(m.tools && m.tools.length > 0 ? { outils: m.tools.map(etapeGardee) } : {}),
      createdAt: new Date().toISOString(),
    }));
  updateSession(session.id, { messages: stored, modelUid: model });
  notifySessionsChanged();
}

/** Ouvre la réponse d'un Chat : enregistrée hors de l'écran, suivie par qui s'y abonne. */
function ouvrirReponse(session: Session, base: Message[], model: string | undefined) {
  const controller = new AbortController();
  const enCours: ReponseEnCours = { history: base, controller, abonnes: new Set() };
  reponsesEnCours.set(session.id, enCours);
  // Tout passe par la réponse en cours ; l'écran la suit tant qu'il montre ce Chat.
  const ecrire = (next: Message[]) => {
    enCours.history = next;
    for (const f of enCours.abonnes) f(next);
  };
  const patch = (id: string, changes: Partial<Message> | ((actuel: Message) => Partial<Message>)) =>
    ecrire(enCours.history.map((m) => (m.id === id ? { ...m, ...(typeof changes === "function" ? changes(m) : changes) } : m)));
  const persist = () => persisterDans(session, enCours.history, model);
  return { enCours, controller, ecrire, patch, persist };
}

/**
 * La réponse d'un Chat est finie : l'écran rend la main, et si elle s'est
 * finie normalement, le message suivant de la file part (29/09/2026). Pas
 * après une erreur ni un arrêt : la file se met en pause (lib/fileAttente.ts).
 */
function terminer(session: Session, enCours: ReponseEnCours, issue: IssueReponse) {
  if (reponsesEnCours.get(session.id) === enCours) reponsesEnCours.delete(session.id);
  const toujours = getSession(session.id);
  // Un Chat supprimé entre-temps n'a plus de file, et rien ne part.
  if (!toujours) filesDesChats.oublier(session.id);
  else if (issue !== "terminee") filesDesChats.apresReponse(session.id, issue);
  /*
   * Une autre réponse s'écrit déjà dans ce Chat (arrêtée puis renvoyée
   * aussitôt) : c'est à sa fin à elle que la file partira, pas maintenant.
   */
  else if (!reponsesEnCours.has(session.id)) {
    const suivant = filesDesChats.apresReponse(session.id, issue);
    if (suivant) lancerEnvoi(toujours, enCours.history, suivant.contenu);
  }
  signalerEnCours();
}

/** Envoie un message sorti de la file, sur l'historique où il arrive. */
function lancerEnvoi(session: Session, base: Message[], envoi: EnvoiEnFile) {
  // La partie synchrone ouvre la réponse (`reponsesEnCours`) avant que l'écran ne soit prévenu.
  if (envoi.creation) void creer(session, base, envoi.texte, envoi.creation.format, envoi.creation.video, envoi.options);
  else void repondre(session, base, envoi.texte, envoi.pieces, envoi.options);
}

/** Une question envoyée au modèle, et sa réponse écrite au fil du flux dans le Chat. */
async function repondre(
  session: Session,
  base: Message[],
  text: string,
  pieces: Attachment[],
  options: Options,
): Promise<void> {
  const prompt = text.trim();

  /*
   * Le contenu des documents joints part avec la question, mais n'encombre
   * pas la conversation affichée : on garde à l'écran ce que la personne a
   * écrit, plus le nom des pièces.
   */
  const documents = documentsDe(pieces);
  const vues = images(pieces);

  const userMsg: Message = {
    id: newId(),
    role: "user",
    content: prompt || (pieces.length > 0 ? etiquetteDes(pieces) : ""),
    pieces:
      pieces.length > 0
        ? pieces.map((p) => ({ nom: p.nom, type: p.type, taille: p.taille, ...(p.type === "texte" && p.tronque ? { tronque: true } : {}) }))
        : undefined,
    ...(documents.length > 0 ? { documents } : {}),
  };
  const replyId = newId();

  // Historique envoyé : message système du profil + tours valides.
  const turns: ChatTurn[] = [...base, userMsg]
    .filter((m) => !m.error && m.content.trim().length > 0)
    /*
     * Une question restée sans réponse (arrêtée, ou refusée par une
     * erreur) n'est pas renvoyée. Elle suivait la précédente sans réponse
     * entre les deux, et le modèle répondait à la première : arrêté sur
     * « écris un essai de 2000 mots », puis « réponds seulement OK »,
     * il a écrit l'essai dans un fichier (essai réel, qwen3-8b). Deux
     * questions de suite, c'est la dernière qui compte.
     */
    .filter((m, i, liste) => !(m.role === "user" && liste[i + 1]?.role === "user"))
    // Chaque question garde ses documents, tant que le Chat est ouvert : l'instance mesure la place et décide (documentsJoints.ts).
    .map((m) => ({ role: m.role, content: m.role === "user" ? contenuPourLeModele(m) : m.content }));

  // Le dernier tour porte les images de cette question.
  if (turns.length > 0 && vues.length > 0) {
    const dernier = turns[turns.length - 1];
    const texte = typeof dernier.content === "string" ? dernier.content : "";
    turns[turns.length - 1] = {
      role: "user",
      content: [
        ...(texte.trim() ? [{ type: "text" as const, text: texte }] : []),
        ...vues.map((v) => ({
          type: "image_url" as const,
          image_url: { url: v.dataUrl },
        })),
      ],
    };
  }

  const payload: ChatTurn[] = options.systemPrompt
    ? [{ role: "system", content: options.systemPrompt }, ...turns]
    : turns;

  const { enCours, controller, ecrire, patch, persist } = ouvrirReponse(session, base, options.model);
  ecrire([...enCours.history, userMsg, { id: replyId, role: "assistant", content: "", streaming: true }]);
  /*
   * La question est gardée dès l'envoi, pas seulement à la fin de la
   * réponse (parcours du 28/09/2026) : une page rechargée pendant que le
   * modèle écrivait laissait un Chat dont le titre était dans la liste et
   * qui s'ouvrait vide, question comprise, ici comme sur l'instance. La
   * réponse vide en cours d'écriture n'est pas enregistrée (persisterDans).
   */
  persist();
  // L'écran qui montre ce Chat s'y abonne (réponse partie de la file sans lui).
  signalerEnCours();

  /** Comment la réponse s'est finie : seule une fin normale fait partir la file. */
  let issue: IssueReponse = "terminee";

  let content = "";
  let reasoning = "";
  const traces: ToolTrace[] = [];
  let plan: EtapePlan[] = [];

  /*
   * Durées de la réponse (27/09/2026), prises à l'arrivée de chaque
   * morceau du flux. La réflexion se compte par phases : un modèle à
   * outils réfléchit avant chaque appel, et le texte ou l'outil qui suit
   * clôt la phase. Sa fin est le dernier morceau de réflexion reçu, pas
   * l'arrivée de ce qui suit : l'écriture des arguments d'un outil, qui ne
   * se voit pas, n'est pas de la réflexion.
   */
  const debut = Date.now();
  const durees: DureesReponse = { debut };
  let dernierMorceauReflexion = debut;
  const finirReflexion = () => {
    if (durees.reflexionDepuis === undefined) return;
    durees.reflexion = (durees.reflexion ?? 0) + Math.max(0, dernierMorceauReflexion - durees.reflexionDepuis);
    durees.reflexionDepuis = undefined;
  };
  patch(replyId, { durees: { ...durees } });

  try {
    await streamChat(
      {
        messages: payload,
        model: options.model,
        effort: options.effort,
        tools: options.tools,
        connaissances: options.connaissances,
        agent: options.agent,
        web: options.web,
        signal: controller.signal,
      },
      {
        onContent: (chunk) => {
          content += chunk;
          finirReflexion();
          /*
           * Le premier mot, pas le premier morceau : la passerelle glisse
           * des sauts de ligne entre deux étapes, et un moteur qui ne
           * sépare pas la réflexion la livre entre balises dans le texte
           * (retirée à l'affichage, voir MessageList).
           */
          if (durees.premierMot === undefined && content.replace(/<think>[\s\S]*?(?:<\/think>|$)/g, "").trim()) {
            durees.premierMot = Date.now() - debut;
          }
          patch(replyId, { content, durees: { ...durees } });
        },
        onReasoning: (chunk) => {
          reasoning += chunk;
          dernierMorceauReflexion = Date.now();
          durees.reflexionDepuis ??= dernierMorceauReflexion;
          patch(replyId, { reasoning, durees: { ...durees } });
        },
        onEvent: (event) => {
          if (event.type === "plan") {
            plan = event.etapes.map((titre, i) => ({ titre, etat: "attente" as const, chemin: String(i + 1), profondeur: 0 }));
            patch(replyId, { plan: [...plan] });
          } else if (event.type === "plan_sous") {
            // Les parties d'une étape redécoupée s'insèrent juste après elle.
            const i = plan.findIndex((e) => e.chemin === event.chemin);
            if (i >= 0) {
              const parent = plan[i]!;
              parent.etat = "decoupee";
              const parties = event.etapes.map((titre, k) => ({
                titre,
                etat: "attente" as const,
                chemin: `${event.chemin}.${k + 1}`,
                profondeur: (parent.profondeur ?? 0) + 1,
              }));
              plan.splice(i + 1, 0, ...parties);
              patch(replyId, { plan: [...plan] });
            }
          } else if (event.type === "etape") {
            const e = etapeDe(plan, event);
            if (e) e.etat = "encours";
            patch(replyId, { plan: [...plan] });
          } else if (event.type === "plan_ajout") {
            plan.push(
              { titre: event.titre, etat: "decoupee" as const, chemin: event.chemin, profondeur: 0 },
              ...event.etapes.map((titre, k) => ({ titre, etat: "attente" as const, chemin: `${event.chemin}.${k + 1}`, profondeur: 1 })),
            );
            patch(replyId, { plan: [...plan] });
          } else if (event.type === "revue") {
            patch(replyId, { revue: event.etat });
          } else if (event.type === "etape_verification") {
            const e = etapeDe(plan, event);
            if (e) e.controlee = true;
            patch(replyId, { plan: [...plan] });
          } else if (event.type === "etape_reprise") {
            const e = etapeDe(plan, event);
            if (e) e.reprise = true;
            patch(replyId, { plan: [...plan] });
          } else if (event.type === "etape_fin") {
            const e = etapeDe(plan, event);
            if (e) e.etat = event.ok ? "fait" : "echec";
            patch(replyId, { plan: [...plan] });
          } else if (event.type === "tool_start") {
            finirReflexion();
            traces.push({ name: event.name, args: event.args, running: true, debut: Date.now() });
            patch(replyId, { tools: [...traces], durees: { ...durees } });
          } else if (event.type === "tool_end") {
            const last = [...traces].reverse().find((t) => t.name === event.name && t.running);
            if (last) {
              last.running = false;
              last.ok = event.ok;
              last.preview = event.preview;
              if (last.debut !== undefined) last.duree = Date.now() - last.debut;
            }
            patch(replyId, { tools: traces.map((trace) => ({ ...trace })) });
          } else if (event.type === "sources_web") {
            patch(replyId, { sourcesWeb: event.sources ?? [] });
          } else if (event.type === "sources") {
            patch(replyId, {
              sources: { citations: event.sources ?? [], ignorees: event.ignorees, aReindexer: event.aReindexer, erreur: event.erreur },
            });
          } else if (event.type === "reflexion_requalifiee") {
            /*
             * Réflexion écrite dans le texte sans balise ouvrante (29/09/2026,
             * gateway/src/reflexionEnLigne.ts) : le gabarit du modèle avait
             * ouvert `<think>`, et seul `</think>` a dit que ce qui venait
             * d'arriver comme réponse était sa réflexion. Déplacé, avec son
             * temps, compté depuis l'arrivée du premier morceau.
             */
            const n = Math.max(0, Math.min(event.caracteres, content.length));
            if (n > 0) {
              const deplace = content.slice(content.length - n);
              content = content.slice(0, content.length - n);
              reasoning = reasoning ? `${reasoning}\n\n${deplace}` : deplace;
              dernierMorceauReflexion = Date.now();
              durees.reflexionDepuis ??= dernierMorceauReflexion - Math.max(0, event.depuisMs ?? 0);
              // Ce n'était pas le premier mot de la réponse.
              if (!content.trim()) durees.premierMot = undefined;
              patch(replyId, { content, reasoning, durees: { ...durees } });
            }
          } else if (event.type === "error") {
            patch(replyId, { error: event.message });
          } else if (event.type === "statut") {
            patch(replyId, { statut: event.message || undefined });
          }
        },
      },
    );
    /*
     * Une réponse vide, sans erreur, sans rien : c'est « il n'a jamais
     * répondu ». La cause la plus fréquente était un modèle qui épuisait
     * son budget à réfléchir (gateway/src/chat.ts, `basePayload`) ; il en
     * reste d'autres, et aucune ne doit laisser une bulle blanche. On le
     * dit, avec ce qu'on peut y faire.
     */
    finirReflexion();
    patch(replyId, (actuel) =>
      !actuel.content.trim() && !actuel.error && !(actuel.plan && actuel.plan.length > 0)
        ? {
            streaming: false,
            statut: undefined,
            durees: { ...durees },
            error: t(
              "Le modèle n'a rien répondu. Réessayez ; si cela recommence, baissez le niveau de raisonnement ou choisissez un autre modèle.",
            ),
          }
        : {
            streaming: false,
            statut: undefined,
            // La durée de la réponse entière, seulement pour une réponse allée à son terme.
            durees: actuel.error ? { ...durees } : { ...durees, reponse: Date.now() - debut },
          },
    );
    persist();
    // Une erreur dite par la passerelle, ou « le modèle n'a rien répondu » : la file ne part pas dessus.
    if (enCours.history.find((m) => m.id === replyId)?.error) issue = "erreur";
  } catch (err) {
    // Coupée : la réflexion déjà faite est une mesure réelle ; la réponse entière, elle, n'a pas de durée.
    finirReflexion();
    patch(replyId, { durees: { ...durees } });
    issue = controller.signal.aborted ? "arretee" : "erreur";
    if (controller.signal.aborted) {
      /*
       * Arrêtée avant le premier mot : la bulle restait blanche, sans
       * rien qui dise pourquoi. Elle le dit. Ce qui était déjà écrit,
       * lui, reste tel quel, et est gardé dans le Chat.
       */
      patch(replyId, (actuel) => ({
        // Un outil en cours ne recevra plus sa fin : sa roue tournait pour toujours (Cowork).
        tools: actuel.tools?.map((trace) =>
          trace.running ? { ...trace, running: false, ok: false, preview: t("Interrompu à votre demande.") } : trace,
        ),
        ...(!actuel.content.trim() && !actuel.error
          ? { streaming: false, statut: undefined, error: t("Réponse arrêtée à votre demande, avant d'avoir été écrite.") }
          : { streaming: false, statut: undefined }),
      }));
    } else {
      patch(replyId, {
        streaming: false,
        statut: undefined,
        error: messageDErreur(err),
      });
    }
    /*
     * Gardé dans tous les cas, erreur comprise : la question de la
     * personne n'était enregistrée qu'en cas de succès. Un modèle
     * inconnu ou un moteur éteint laissait un Chat dont le titre
     * existait dans la liste, et qui s'ouvrait vide.
     */
    persist();
  } finally {
    /*
     * Le plan ne doit pas continuer de tourner à l'écran une fois le flux
     * fini. Arrêté par la personne ou coupé par une erreur, l'étape en
     * cours ne recevra jamais sa fin : sa roue tournait pour toujours,
     * comme si l'agent travaillait encore. Arrêtée, elle redevient « à
     * faire » ; coupée par une panne, elle est marquée en échec.
     */
    patch(replyId, (actuel) =>
      actuel.plan?.some((e) => e.etat === "encours") || actuel.revue === "encours"
        ? {
            plan: actuel.plan?.map((e) =>
              e.etat === "encours" ? { ...e, etat: controller.signal.aborted ? ("attente" as const) : ("echec" as const) } : e,
            ),
            revue: actuel.revue === "encours" ? undefined : actuel.revue,
          }
        : {},
    );
    terminer(session, enCours, issue);
  }
}

/**
 * Crée une image au lieu de répondre (bouton « Image »). La demande et
 * l'image restent dans le Chat, comme un échange ordinaire ; la réponse
 * garde une phrase de texte, pour que la suite de la conversation sache
 * qu'une image a été faite, et de quoi.
 *
 * `video` : une courte vidéo plutôt qu'une image, par le même moteur (27/09/2026).
 */
async function creer(
  session: Session,
  base: Message[],
  texte: string,
  format: Format,
  video: boolean,
  options: Options,
): Promise<void> {
  const userMsg: Message = { id: newId(), role: "user", content: texte };
  const replyId = newId();
  const { enCours, controller, ecrire, patch, persist } = ouvrirReponse(session, base, options.model);
  ecrire([
    ...enCours.history,
    userMsg,
    { id: replyId, role: "assistant", content: "", streaming: true, statut: t("Préparation de la description...") },
  ]);
  signalerEnCours();
  let issue: IssueReponse = "terminee";
  // Le temps de la création, de la demande à l'image reçue (27/09/2026) : sur un processeur, c'est long, et bon à savoir.
  const debut = Date.now();
  try {
    const creerLa = video ? creerVideoSurLaMachine : creerSurLaMachine;
    const image = await creerLa(texte, format, (tr) => patch(replyId, { statut: tr.message }), controller.signal, session.id);
    patch(replyId, {
      content: video ? tf("Vidéo créée : « {0} »", texte) : tf("Image créée : « {0} »", texte),
      image,
      streaming: false,
      statut: undefined,
      durees: { reponse: Date.now() - debut },
    });
    persist();
  } catch (err) {
    if (controller.signal.aborted) {
      issue = "arretee";
      patch(replyId, { streaming: false, statut: undefined, error: video ? t("Suivi arrêté : la vidéo se termine quand même sur la machine, mais n'apparaîtra pas ici.") : t("Suivi arrêté : l'image se termine quand même sur la machine, mais n'apparaîtra pas ici.") });
    } else {
      issue = "erreur";
      patch(replyId, { streaming: false, statut: undefined, error: messageDErreur(err) });
    }
  } finally {
    terminer(session, enCours, issue);
  }
}

/** État d'une conversation branchée sur la passerelle, persistée en session. */
export function useChat(options: Options) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [busy, setBusy] = useState(false);
  const sessionRef = useRef<Session | null>(null);
  /**
   * Miroir synchrone de `messages`. Les mises à jour d'état React ne sont pas
   * appliquées immédiatement : on ne peut donc pas construire l'historique
   * depuis l'intérieur d'un updater.
   */
  const historyRef = useRef<Message[]>([]);
  // Les choix du moment, lus à la mise en file : c'est eux que le message emportera.
  const optionsRef = useRef(options);
  optionsRef.current = options;

  /** L'abonnement de l'écran à la réponse en cours du Chat affiché. */
  const detacherRef = useRef<(() => void) | null>(null);
  const attacheA = useRef<ReponseEnCours | null>(null);
  const detacher = useCallback(() => {
    detacherRef.current?.();
    detacherRef.current = null;
    attacheA.current = null;
  }, []);
  const attacher = useCallback((sessionId: string) => {
    detacher();
    const r = reponsesEnCours.get(sessionId);
    if (!r) return false;
    const suivre = (history: Message[]) => {
      historyRef.current = history;
      setMessages(history);
    };
    r.abonnes.add(suivre);
    attacheA.current = r;
    detacherRef.current = () => r.abonnes.delete(suivre);
    suivre(r.history);
    setBusy(true);
    return true;
  }, [detacher]);
  // L'écran qui disparaît se détache ; la réponse, elle, continue.
  useEffect(() => detacher, [detacher]);

  /*
   * L'écran suit les réponses de son Chat (29/09/2026) : une réponse qui
   * finit lui rend la main, et celle qui part ensuite de la file, qu'il n'a
   * pas lancée lui-même, il s'y abonne. Terminée ailleurs : rien à faire ici,
   * elle est déjà enregistrée.
   */
  useEffect(() => {
    const suivreLeChat = () => {
      const id = sessionRef.current?.id;
      if (!id) return;
      const r = reponsesEnCours.get(id);
      if (r) {
        if (attacheA.current !== r) attacher(id);
      } else if (attacheA.current) {
        detacher();
        setBusy(false);
      }
    };
    window.addEventListener(CHATS_EN_COURS, suivreLeChat);
    return () => window.removeEventListener(CHATS_EN_COURS, suivreLeChat);
  }, [attacher, detacher]);

  const commit = useCallback((next: Message[]) => {
    historyRef.current = next;
    setMessages(next);
  }, []);

  /** « Arrêter » : la réponse du Chat affiché, et elle seule. Sa file, elle, se met en pause. */
  const stop = useCallback(() => {
    const id = sessionRef.current?.id;
    if (id) reponsesEnCours.get(id)?.controller.abort();
    setBusy(false);
  }, []);

  /** Ouvre une session à la première question. */
  const sessionPour = useCallback((titre: string) => {
    if (!sessionRef.current) {
      sessionRef.current = createSession({
        owner: currentUser(),
        title: deriveTitle(titre),
        origin: options.origin ?? "local",
        modelUid: options.model,
        surface: options.surface,
        dossier: options.dossier,
      });
      notifySessionsChanged();
    } else if (options.dossier && sessionRef.current.ownerId === currentUser().id) {
      // Le dossier a pu changer depuis la demande précédente : la session retient celui où elle travaille maintenant.
      memoriserDossier(sessionRef.current.id, options.dossier);
    }
    return sessionRef.current;
  }, [options.origin, options.model, options.surface, options.dossier]);

  const send = useCallback(
    async (text: string, pieces: Attachment[] = []) => {
      const prompt = text.trim();
      if ((!prompt && pieces.length === 0) || busy) return;
      const session = sessionPour(prompt);
      const reponse = repondre(session, historyRef.current, text, pieces, { ...options });
      // La réponse est ouverte (partie synchrone de `repondre`) : l'écran la suit.
      attacher(session.id);
      await reponse;
    },
    [busy, options, sessionPour, attacher],
  );

  /** Nouvelle conversation : la session courante est close, pas supprimée. */
  const reset = useCallback(() => {
    // Nouvelle conversation : la réponse en cours de l'autre Chat continue, et sa file aussi.
    detacher();
    setBusy(false);
    sessionRef.current = null;
    commit([]);
  }, [detacher, commit]);

  /** Reprend une session existante (partagée ou personnelle). */
  const open = useCallback(
    (session: Session) => {
      detacher();
      setBusy(false);
      sessionRef.current = session;
      // Une réponse s'écrit encore dans ce Chat : on la suit en direct.
      if (attacher(session.id)) return;
      commit(
        session.messages.map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          reasoning: m.reasoning,
          image: m.image,
          ...(Array.isArray(m.pieces) && m.pieces.length > 0 ? { pieces: m.pieces } : {}),
          ...(m.sources && m.sources.length > 0 ? { sources: { citations: m.sources } } : {}),
          ...(Array.isArray(m.sourcesWeb) && m.sourcesWeb.length > 0 ? { sourcesWeb: m.sourcesWeb } : {}),
          ...(m.durees ? { durees: { ...m.durees } } : {}),
          ...(m.outils && m.outils.length > 0
            ? {
                tools: m.outils.map((o) => ({
                  name: o.name,
                  args: {},
                  running: false,
                  ok: o.ok,
                  ...(o.libelle ? { libelle: o.libelle } : {}),
                  ...(o.cible ? { cible: o.cible } : {}),
                  ...(o.duree !== undefined ? { duree: o.duree } : {}),
                })),
              }
            : {}),
        })),
      );
    },
    [detacher, attacher, commit],
  );

  /** Crée une image au lieu de répondre (bouton « Image »), ou une courte vidéo. */
  const creerImage = useCallback(
    async (description: string, format: Format, video = false) => {
      const texte = description.trim();
      if (!texte || busy) return;
      const session = sessionPour(texte);
      const creation = creer(session, historyRef.current, texte, format, video, { ...options });
      attacher(session.id);
      await creation;
    },
    [busy, options, sessionPour, attacher],
  );

  /* --- File d'attente (29/09/2026) -------------------------------------- */

  const file = useSyncExternalStore(filesDesChats.abonner, () => filesDesChats.lire(sessionRef.current?.id));

  /**
   * Pendant une réponse : le message entre dans la file de ce Chat, avec les
   * choix du moment. Il n'y a de file que dans un Chat qui existe déjà (une
   * réponse s'y écrit), jamais pour le premier message.
   */
  const mettreEnFile = useCallback(
    (texte: string, pieces: Attachment[] = [], creation?: EnvoiEnFile["creation"]): Ajout | null => {
      const id = sessionRef.current?.id;
      if (!id) return null;
      if (creation ? !texte.trim() : !texte.trim() && pieces.length === 0) return null;
      return filesDesChats.ajouter(id, {
        texte,
        pieces,
        options: { ...optionsRef.current, connaissances: [...(optionsRef.current.connaissances ?? [])] },
        ...(creation ? { creation } : {}),
      });
    },
    [],
  );

  /** Envoie un message que la file vient de rendre, sur l'historique affiché. */
  const partir = useCallback((sorti: { contenu: EnvoiEnFile } | null) => {
    const session = sessionRef.current;
    if (!sorti || !session) return;
    lancerEnvoi(session, historyRef.current, sorti.contenu);
    attacher(session.id);
  }, [attacher]);

  const retirerDeFile = useCallback((idMessage: string) => {
    const id = sessionRef.current?.id;
    if (id) filesDesChats.retirer(id, idMessage);
  }, []);

  const commencerEdition = useCallback((idMessage: string) => {
    const id = sessionRef.current?.id;
    if (id) filesDesChats.commencerEdition(id, idMessage);
  }, []);

  /** Fin de « Modifier » : `texte` absent, la modification est abandonnée. */
  const finirEdition = useCallback((idMessage: string, texte?: string) => {
    const id = sessionRef.current?.id;
    if (!id) return;
    const actuel = filesDesChats.lire(id).messages.find((m) => m.id === idMessage);
    if (!actuel) return;
    const contenu = texte !== undefined ? { ...actuel.contenu, texte } : undefined;
    partir(filesDesChats.finirEdition(id, idMessage, contenu, reponsesEnCours.has(id)));
  }, [partir]);

  /** « Envoyer maintenant » (rien ne s'écrit) ou « Reprendre » (le premier partira à la fin de la réponse en cours). */
  const reprendreFile = useCallback(() => {
    const id = sessionRef.current?.id;
    if (id) partir(filesDesChats.reprendre(id, reponsesEnCours.has(id)));
  }, [partir]);

  return {
    messages,
    busy,
    send,
    creerImage,
    stop,
    reset,
    open,
    session: sessionRef.current,
    file,
    mettreEnFile,
    retirerDeFile,
    commencerEdition,
    finirEdition,
    reprendreFile,
  };
}
