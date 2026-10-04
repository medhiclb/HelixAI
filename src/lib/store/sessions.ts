import { storage, newId } from "./storage";
import type { User } from "./identity";
import { allAccounts } from "./accounts";
import { visibleTo as projetsVisibles } from "./projects";
import { t } from "@/lib/i18n";

const accountByEmail = (email: string) =>
  allAccounts().find((a) => a.email.trim().toLowerCase() === email);

/**
 * Sessions de conversation.
 *
 * Privées par défaut, partageables ensuite (Privé / Groupes / Organisation),
 * comme la Bibliothèque et les Agents.
 *
 * Distinction importante : une session menée sur un modèle **local** est liée à
 * la machine qui l'a produite ; une session **cloud** peut être reprise et
 * partagée depuis un autre poste. C'est `origin` qui porte cette nuance.
 */

export type Visibility = "prive" | "groupes" | "organisation";
export type SessionOrigin = "local" | "cloud";

export interface StoredMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  reasoning?: string;
  /** Image créée sur la machine (images.ts) : on garde sa référence, pas ses octets. */
  image?: { id: string; largeur: number; hauteur: number; description: string };
  /**
   * Pièces jointes à la question (27/09/2026) : nom, type, poids, et si seul
   * le début a été lu. Ce que le message montre ; le contenu n'est pas gardé.
   */
  pieces?: { nom: string; type: "texte" | "image"; taille?: number; tronque?: boolean }[];
  /**
   * Passages des bases de connaissances cités sous la réponse (nom du
   * document, extrait de 600 caractères au plus). Gardés avec le Chat : qui le
   * rouvre, ou à qui on le partage, voit d'où venait la réponse, comme il en
   * voit le texte.
   */
  sources?: { n: number; base: string; document: string; documentId: string; extrait: string; debut: number; fin: number; similarite: number }[];
  /**
   * Sources de la recherche sur le web (28/09/2026) : numéro, titre, adresse,
   * page ouverte ou non. Gardées avec la réponse comme celles des bases.
   */
  sourcesWeb?: { n: number; titre: string; adresse: string; lue: boolean }[];
  /**
   * Ce que la réponse a pris de temps, en millisecondes, mesuré à l'écran qui
   * l'a reçue (hooks/useChat.ts, `DureesReponse`), depuis le 27/09/2026.
   * Absent sur une réponse plus ancienne, ou qui n'a pas été mesurée : rien
   * ne s'affiche, rien n'est reconstitué.
   */
  durees?: { premierMot?: number; reflexion?: number; reponse?: number };
  /**
   * Étapes d'outils de la réponse, telles qu'elles s'affichent (nom, cible,
   * issue, durée en ms). Ni les arguments ni l'aperçu du résultat : ils
   * peuvent porter un document entier. Depuis le 27/09/2026.
   */
  outils?: { name: string; libelle?: string; cible?: string; ok: boolean; duree?: number }[];
  createdAt: string;
}

/** Personne avec qui une conversation est partagée, invitée par email. */
export interface SessionShare {
  email: string;
  /** Renseigné dès que la personne possède un compte sur l'instance. */
  userId?: string;
  status: "actif" | "invite";
  sharedAt: string;
}

export interface Session {
  id: string;
  title: string;
  /**
   * Agent avec lequel ce Chat est mené, et son nom au moment du choix (pour
   * pouvoir dire lequel c'était s'il a été supprimé depuis). Absent : l'agent
   * par défaut.
   */
  agentId?: string;
  agentNom?: string;
  /** Bases de connaissances choisies dans la zone de saisie pour ce Chat (en plus de celles de l'agent et du projet). */
  connaissances?: string[];
  ownerId: string;
  visibility: Visibility;
  /** Groupes destinataires quand `visibility === "groupes"`. */
  sharedGroupIds: string[];
  /** Partage nominatif, à la manière d'une conversation partagée. */
  sharedWith: SessionShare[];
  organisationId: string;
  origin: SessionOrigin;
  /** Modèle utilisé (uid passerelle), à titre indicatif. */
  modelUid?: string;
  /**
   * Projet dans lequel la personne qui a ouvert la conversation l'a rangée.
   *
   * ── Classement personnel, pas partage ─────────────────────────────────────
   *
   * Ce champ **ne donne accès à rien**. La passerelle décide seule qui voit une
   * conversation (`voitConversation`, gateway/src/authz.ts) : le propriétaire,
   * les personnes invitées nominativement (`shareSession`), et toute
   * l'organisation si la visibilité le dit. Le projet n'entre dans aucune de
   * ces règles, et ne doit jamais y entrer sans décision explicite.
   *
   * Pourquoi : ranger un chat dans un projet est un geste d'organisation, fait
   * en deux clics dans le composer. Si ce geste ouvrait la conversation aux
   * membres du projet, il deviendrait un partage déguisé, sans l'adresse, la
   * liste des destinataires ni la révocation que `shareSession` impose. Une
   * question posée en privé (un salaire, un litige) finirait sous les yeux de
   * toute l'équipe parce qu'on l'a classée au bon endroit. Qui veut montrer un
   * chat aux membres d'un projet le partage avec eux, explicitement.
   *
   * Conséquence visible : dans un projet, chacun ne voit que les conversations
   * qu'il voyait déjà, qu'elles soient à lui ou qu'on les lui ait partagées.
   * Seul le propriétaire range ou retire (`rattacherProjet`) ; une personne à
   * qui la conversation est partagée voit le classement sans pouvoir le changer.
   *
   * L'identifiant peut désigner un projet que le lecteur ne voit pas (projet
   * supprimé, ou dont on l'a retiré) : l'interface le traite alors comme « sans
   * projet », et n'affiche jamais un nom qu'elle ne connaît pas.
   */
  projectId?: string;
  /**
   * Personnes qui ont rangé cette conversation dans leurs archives.
   *
   * Archiver n'est pas supprimer : le chat sort de la barre latérale, garde
   * ses messages, et revient d'un clic. C'est un rangement **personnel**, par
   * identifiant de personne : une conversation partagée qu'une collègue
   * archive de son côté reste dans la liste des autres. Comme `projectId`,
   * ce champ ne donne et ne retire aucun droit ; la passerelle décide seule
   * qui voit quoi (`voitConversation`, gateway/src/authz.ts).
   */
  archivedBy?: string[];
  messages: StoredMessage[];
  createdAt: string;
  updatedAt: string;
  /**
   * Dernière modification qui ne touche pas `updatedAt` (renommer, archiver,
   * ranger, choisir un agent ou des bases), pour que la synchronisation sache
   * laquelle de deux copies est la plus récente (sync.ts, `quand`). Avant le
   * 28/09/2026, un Chat renommé pendant que l'instance ne répondait pas, puis la
   * page rechargée, reprenait son ancien nom : à `updatedAt` égal, la copie de
   * l'instance l'emportait. `updatedAt` garde son rôle : l'ordre de la liste.
   */
  modifieLe?: string;
  /**
   * Chat repris d'un export ou d'un logiciel du poste (ImporterChats.tsx) :
   * la source, la clé de la conversation d'origine, et combien de messages
   * elle avait. Importer deux fois le même export ne crée pas de doublons
   * (28/09/2026) ; un export plus récent de la même conversation, plus
   * longue, se propose sans rien écrire par-dessus le Chat déjà là.
   */
  importe?: { source: string; cle: string; messages: number };
  /**
   * Écran où la conversation est menée (04/10/2026). Absent : un Chat ;
   * « cowork » : une session de Cowork, qui se liste et se rouvre dans
   * Cowork, avec ses outils, et ne se mélange plus aux Chats. Avant, une
   * conversation de Cowork était un Chat comme un autre : elle apparaissait
   * dans la liste des Chats et s'y rouvrait sans outils ni dossier, et rien
   * ne la retrouvait depuis Cowork (signalé par Medhi le 04/10/2026). Les
   * conversations de Cowork plus anciennes n'ont pas ce champ : rien ne
   * permet de les distinguer, elles restent dans les Chats.
   *
   * Classement seulement, comme `projectId` : ce champ ne donne et ne retire
   * aucun droit (`voitConversation`, gateway/src/authz.ts).
   */
  surface?: "cowork";
  /**
   * Session de Cowork : le dossier où l'agent travaillait à la dernière
   * demande, ou « poste » pour tout le poste. Le dossier de travail est un
   * réglage de l'instance, commun à tous ses agents : rouvrir la session ne le
   * change pas d'office, l'écran propose de le reprendre (CoworkPage).
   */
  dossier?: string;
}

/** Session de Cowork (voir `surface`). */
export const estCowork = (s: Pick<Session, "surface">): boolean => s.surface === "cowork";

/** Marque une modification qui ne fait pas remonter le Chat dans la liste (voir `modifieLe`). */
const touche = <T extends Session>(s: T): T => ({ ...s, modifieLe: new Date().toISOString() });

const KEY = "sessions";

function all(): Session[] {
  return storage.get<Session[]>(KEY, []);
}

function persist(sessions: Session[]): void {
  storage.set(KEY, sessions);
}

/**
 * Sessions visibles par un utilisateur : les siennes, plus celles qu'on lui a
 * partagées via un groupe ou l'organisation.
 */
export function visibleTo(user: User): Session[] {
  const email = user.email.trim().toLowerCase();
  return all()
    .filter((s) => {
      if (s.ownerId === user.id) return true;
      // Partage nominatif : la personne a été invitée sur cette conversation.
      if (
        (s.sharedWith ?? []).some(
          (p) => p.status === "actif" && (p.userId === user.id || p.email === email),
        )
      ) {
        return true;
      }
      if (s.visibility === "organisation") return s.organisationId === user.organisationId;
      if (s.visibility === "groupes") {
        return s.sharedGroupIds.some((g) => user.groupIds.includes(g));
      }
      return false;
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getSession(id: string): Session | undefined {
  return all().find((s) => s.id === id);
}

/** Titre dérivé du premier message, tronqué proprement. */
export function deriveTitle(firstMessage: string): string {
  const clean = firstMessage.trim().replace(/\s+/g, " ");
  if (clean.length <= 48) return clean || t("Nouveau Chat");
  return `${clean.slice(0, 48).trimEnd()}...`;
}

export function createSession(opts: {
  owner: User;
  title: string;
  origin: SessionOrigin;
  modelUid?: string;
  surface?: Session["surface"];
  dossier?: string;
}): Session {
  const now = new Date().toISOString();
  const session: Session = {
    id: newId(),
    title: opts.title,
    ownerId: opts.owner.id,
    visibility: "prive",
    sharedGroupIds: [],
    sharedWith: [],
    organisationId: opts.owner.organisationId,
    origin: opts.origin,
    modelUid: opts.modelUid,
    // Champs absents plutôt que vides : la forme d'un Chat ordinaire, celle que les anciens postes attendent.
    ...(opts.surface ? { surface: opts.surface } : {}),
    ...(opts.dossier ? { dossier: opts.dossier } : {}),
    messages: [],
    createdAt: now,
    updatedAt: now,
  };
  persist([session, ...all()]);
  return session;
}

export function updateSession(id: string, changes: Partial<Session>): void {
  persist(
    all().map((s) =>
      s.id === id ? { ...s, ...changes, updatedAt: new Date().toISOString() } : s,
    ),
  );
}

/**
 * Renomme une conversation. Comme l'archivage, `updatedAt` n'est pas touché :
 * changer le nom n'écrit pas dans la conversation et ne doit pas la faire
 * remonter en tête de liste. Un nom vide est refusé (on garde l'ancien).
 */
export function renommerSession(id: string, titre: string): void {
  const propre = titre.replace(/\s+/g, " ").trim().slice(0, 120);
  if (!propre) return;
  persist(all().map((s) => (s.id === id ? touche({ ...s, title: propre }) : s)));
}

/**
 * Retient l'agent d'un Chat. Comme le renommage, `updatedAt` n'est pas touché :
 * choisir un agent n'écrit rien dans la conversation.
 */
export function memoriserAgent(id: string, agentId: string, agentNom: string): void {
  persist(all().map((s) => (s.id === id && s.agentId !== agentId ? touche({ ...s, agentId, agentNom }) : s)));
}

/** Retient les bases de connaissances choisies pour un Chat ; même règle que l'agent pour `updatedAt`. */
export function memoriserConnaissances(id: string, connaissances: string[]): void {
  const cle = (l?: string[]) => [...(l ?? [])].sort().join(",");
  persist(all().map((s) => (s.id === id && cle(s.connaissances) !== cle(connaissances) ? touche({ ...s, connaissances }) : s)));
}

/** Retient le dossier d'une session de Cowork ; même règle que l'agent pour `updatedAt`. */
export function memoriserDossier(id: string, dossier: string): void {
  const sessions = all();
  // Appelé à chaque demande : rien à écrire quand le dossier n'a pas changé, ni quand la session n'est pas là.
  if (!sessions.some((s) => s.id === id && s.dossier !== dossier)) return;
  persist(sessions.map((s) => (s.id === id ? touche({ ...s, dossier }) : s)));
}

/**
 * Range des Chats importés (ChatGPT, Claude) en une seule écriture, puis relit
 * ce qui a réellement été gardé. Le stockage du poste a une limite, et une
 * écriture qui la dépasse est ignorée sans erreur (storage.ts) : relire est le
 * seul moyen de dire honnêtement combien de Chats ont été repris.
 */
export function ajouterSessionsImportees(nouvelles: Session[]): number {
  const avant = all();
  const ids = new Set(avant.map((s) => s.id));
  persist([...nouvelles.filter((s) => !ids.has(s.id)), ...avant]);
  const gardes = new Set(all().map((s) => s.id));
  return nouvelles.filter((s) => gardes.has(s.id)).length;
}

/**
 * Chats déjà repris d'une source par cette personne : clé d'origine vers le
 * plus grand nombre de messages importé pour elle. Un Chat supprimé depuis
 * n'y est plus, et peut être importé de nouveau.
 */
export function chatsDejaImportes(ownerId: string, source: string): Map<string, number> {
  const deja = new Map<string, number>();
  for (const s of all()) {
    if (s.ownerId !== ownerId || s.importe?.source !== source) continue;
    deja.set(s.importe.cle, Math.max(deja.get(s.importe.cle) ?? 0, s.importe.messages));
  }
  return deja;
}

/** Place occupée par les Chats dans le stockage du poste, en caractères. */
export function placeOccupeeParLesChats(): number {
  return JSON.stringify(all()).length;
}

export function deleteSession(id: string): void {
  persist(all().filter((s) => s.id !== id));
}

/** Cette conversation est-elle archivée par cette personne ? */
export function estArchivee(session: Session, user: User): boolean {
  return (session.archivedBy ?? []).includes(user.id);
}

/**
 * Range une conversation dans les archives de cette personne, ou l'en sort.
 *
 * `updatedAt` n'est pas touché : archiver n'écrit pas dans la conversation, et
 * la désarchiver n'a pas à la propulser en tête de liste.
 */
export function archiverSession(id: string, user: User, archivee: boolean): void {
  persist(
    all().map((s) => {
      if (s.id !== id) return s;
      const gens = (s.archivedBy ?? []).filter((u) => u !== user.id);
      const suite = archivee ? [...gens, user.id] : gens;
      // Un champ absent vaut mieux qu'un tableau vide : c'est la forme d'une
      // conversation jamais archivée, et celle que les anciens postes attendent.
      if (suite.length === 0) {
        const { archivedBy: _ancien, ...reste } = s;
        return touche(reste);
      }
      return touche({ ...s, archivedBy: suite });
    }),
  );
}

/**
 * Range une conversation dans un projet, ou l'en retire (`projectId` nul).
 *
 * Classement personnel : voir le commentaire du champ `projectId`. Deux
 * vérifications, côté poste, parce que le classement est le choix d'une
 * personne sur ce qui lui appartient :
 *  - seule la personne qui a ouvert la conversation la range. Une invitée la
 *    lit, elle n'a pas à réorganiser le travail de sa collègue ;
 *  - on ne range que dans un projet qu'on voit soi-même, sans quoi le chat
 *    disparaîtrait de l'écran de son propre propriétaire.
 *
 * Ce contrôle n'est pas une barrière de sécurité, et n'a pas besoin de l'être :
 * le champ ne donnant accès à rien, un poste qui le forcerait ne montrerait la
 * conversation à personne de plus. La barrière reste dans la passerelle.
 *
 * `updatedAt` n'est pas touché : classer n'est pas écrire dans la
 * conversation, et elle n'a pas à remonter en tête de la barre latérale.
 */
export function rattacherProjet(
  id: string,
  projectId: string | null,
  user: User,
): { ok: boolean; reason?: string } {
  const session = getSession(id);
  if (!session) return { ok: false, reason: t("Conversation introuvable.") };
  if (session.ownerId !== user.id) {
    return {
      ok: false,
      reason: t("Seule la personne qui a ouvert ce chat peut le ranger dans un projet."),
    };
  }
  if (projectId && !projetsVisibles(user).some((p) => p.id === projectId)) {
    return { ok: false, reason: t("Ce projet n'existe plus, ou vous n'en faites plus partie.") };
  }
  persist(
    all().map((s) => {
      if (s.id !== id) return s;
      // Un champ absent vaut mieux qu'un champ vide : c'est la forme d'une
      // conversation jamais rangée, et la seule que les filtres attendent.
      const { projectId: _ancien, ...reste } = s;
      return touche(projectId ? { ...reste, projectId } : reste);
    }),
  );
  return { ok: true };
}

/**
 * Conversations d'un projet, telles que la personne a le droit de les voir.
 *
 * On part de `visibleTo`, jamais de la collection entière : le projet filtre
 * ce qu'on voyait déjà, il n'ajoute rien.
 */
export function sessionsDuProjet(user: User, projectId: string): Session[] {
  return visibleTo(user).filter((s) => s.projectId === projectId && !estArchivee(s, user));
}

/**
 * Partage une conversation avec une personne, par email.
 * Si un compte existe déjà sur l'instance, l'accès est immédiat ; sinon
 * l'invitation attend la création du compte.
 */
export function shareSession(
  id: string,
  email: string,
): { ok: boolean; reason?: string; immediate?: boolean } {
  const address = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) {
    return { ok: false, reason: "Adresse email invalide." };
  }

  const session = getSession(id);
  if (!session) return { ok: false, reason: "Conversation introuvable." };

  const shares = session.sharedWith ?? [];
  if (shares.some((p) => p.email === address)) {
    return { ok: false, reason: t("Cette conversation est déjà partagée avec cette personne.") };
  }

  const existing = accountByEmail(address);
  updateSession(id, {
    sharedWith: [
      ...shares,
      {
        email: address,
        userId: existing?.id,
        status: existing ? "actif" : "invite",
        sharedAt: new Date().toISOString(),
      },
    ],
  });
  return { ok: true, immediate: Boolean(existing) };
}

export function unshareSession(id: string, email: string): void {
  const session = getSession(id);
  if (!session) return;
  const address = email.trim().toLowerCase();
  updateSession(id, {
    sharedWith: (session.sharedWith ?? []).filter((p) => p.email !== address),
  });
}

/** Active les partages reçus avant la création du compte. */
export function claimSessionShares(user: User): number {
  const address = user.email.trim().toLowerCase();
  let claimed = 0;
  const next = all().map((session) => {
    const shares = session.sharedWith ?? [];
    let touched = false;
    const updated = shares.map((p) => {
      if (p.email === address && p.status === "invite") {
        touched = true;
        claimed += 1;
        return { ...p, userId: user.id, status: "actif" as const };
      }
      return p;
    });
    return touched ? { ...session, sharedWith: updated } : session;
  });
  if (claimed > 0) persist(next);
  return claimed;
}

/**
 * Partage une conversation avec un groupe : chacun de ses membres la retrouve
 * dans sa barre latérale, et la perd s'il quitte le groupe. L'instance le
 * vérifie de son côté (`gateway/src/authz.ts`).
 */
export function shareWithGroup(id: string, groupId: string): void {
  const session = getSession(id);
  if (!session || session.sharedGroupIds.includes(groupId)) return;
  updateSession(id, {
    sharedGroupIds: [...session.sharedGroupIds, groupId],
    visibility: session.visibility === "prive" ? "groupes" : session.visibility,
  });
}

export function unshareGroup(id: string, groupId: string): void {
  const session = getSession(id);
  if (!session) return;
  const restants = session.sharedGroupIds.filter((g) => g !== groupId);
  updateSession(id, {
    sharedGroupIds: restants,
    visibility: session.visibility === "groupes" && restants.length === 0 ? "prive" : session.visibility,
  });
}
