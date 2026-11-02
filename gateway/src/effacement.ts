import { oublierEntretiens } from "./entretiens.ts";
import { oublierVps } from "./vps.ts";
import { db } from "./db.ts";
import { publicAccounts, retirerCompte } from "./accounts.ts";
import { revokeAll } from "./usersession.ts";
import { oublierCompte } from "./usage.ts";
import { journaliser } from "./audit.ts";
import { oublierPersonneGroupes } from "./groupes.ts";
import { elementsDe, oublierPersonneBibliotheque } from "./bibliotheque.ts";
import { reunionsDe, oublierPersonneReunions } from "./reunions.ts";
import { oublierChatsDesImages, oublierImagesDe } from "./images.ts";
import { oublierPersonneConnaissances } from "./connaissances.ts";
import { oublierChatsPartout, oublierPersonne as oublierMemoiresConversations } from "./memoireConversation.ts";
import { oublierPersonneEntrainement } from "./entrainement.ts";
import { oublierSessionsCode } from "./sessionsCode.ts";
import { oublierClesDe } from "./clesApi.ts";
import { api, enMarche } from "./opencode.ts";
import { oublierPersonne as oublierTachesProgrammees } from "./tachesProgrammees.ts";

/**
 * Suppression d'un compte (RGPD, article 17).
 *
 * Ce qui disparaît : le compte, son profil (instructions, mémoire), ses
 * conversations, ses tâches, ses agents, les employés qu'il avait déployés et
 * ce qu'il a dit aux employés, sa consommation, ses séances, ses clés d'API, et toute mention
 * de lui dans les projets et les partages de ses collègues. (Côté OpenClaw,
 * conversations et agents sont retirés par `employes.oublierPersonne`, appelé
 * avant ; faute d'instance en marche, le balayage du démarrage s'en charge.)
 *
 * Ce qui ne disparaît pas, et pourquoi :
 *  - **les projets partagés dont il était propriétaire** : c'est le travail de
 *    toute une équipe. Ils sont confiés au premier membre actif, et l'écran le
 *    dit avant la confirmation. Un projet sans autre membre actif est supprimé ;
 *  - **le journal d'audit** : il est scellé et chaîné, le réécrire le rendrait
 *    invérifiable, et il sert à établir qui a fait quoi sur les données de
 *    l'entreprise. Il garde l'identifiant du compte, et l'adresse notée à la
 *    création. C'est une conservation pour motif de sécurité, à borner dans la
 *    politique de l'entreprise (voir SECURITE.md § 7.2).
 *
 * L'ordre compte. Les séances sont fermées **d'abord**, pour que le poste de
 * la personne ne renvoie pas ses données pendant qu'on les efface. Le compte
 * est retiré **en dernier** : si une étape échoue, il existe encore, et
 * l'effacement peut être relancé.
 */

type Enregistrement = Record<string, unknown>;

const tableau = (v: unknown): Enregistrement[] =>
  Array.isArray(v) ? v.filter((x): x is Enregistrement => typeof x === "object" && x !== null) : [];

const memeEmail = (a: unknown, b: string) =>
  typeof a === "string" && a.trim().toLowerCase() === b.trim().toLowerCase();

/** Cette entrée (membre, partage) désigne-t-elle la personne ? */
const designe = (entree: unknown, userId: string, email: string) =>
  typeof entree === "object" &&
  entree !== null &&
  ((entree as { userId?: string }).userId === userId ||
    memeEmail((entree as { email?: string }).email, email));

/** Membres actifs d'un projet, hors la personne : ceux à qui le confier. */
function successeurs(projet: Enregistrement, userId: string, email: string) {
  const membres = Array.isArray(projet.members) ? projet.members : [];
  return membres.filter(
    (m): m is { userId: string; email: string; role?: string; status?: string } =>
      typeof m === "object" &&
      m !== null &&
      typeof (m as { userId?: unknown }).userId === "string" &&
      // `invite` : invitation pas encore acceptée, on ne confie pas un projet à qui ne l'a pas rejoint.
      (m as { status?: string }).status === "actif" &&
      !designe(m, userId, email),
  );
}

export interface Apercu {
  conversations: number;
  taches: number;
  agents: number;
  /** Employés OpenClaw qu'il a déployés : ils sont retirés avec lui. */
  employes: string[];
  /** Clés de modèles cloud qu'il a branchées : retirées avec lui. */
  clesModeles: string[];
  /** Ses documents et dossiers de la bibliothèque : effacés, contenus compris. */
  bibliotheque: { documents: number; dossiers: number };
  /** Ses réunions : comptes rendus, transcriptions et son. */
  reunions: number;
  projetsSupprimes: string[];
  projetsConfies: { projet: string; a: string }[];
  /** Projets de collègues et conversations partagées d'où la personne sera retirée. */
  mentionsRetirees: number;
}

async function calculer(userId: string, email: string) {
  const comptes = await publicAccounts();
  const nomDe = (id: string) => comptes.find((c) => c.id === id)?.fullName ?? "un membre";

  const projets = tableau(await db().read("projects"));
  const sessions = tableau(await db().read("sessions"));
  const taches = tableau(await db().read("tasks"));
  const agents = tableau(await db().read("agents"));
  const employes = tableau(await db().read("employes"));

  const apercu: Apercu = {
    conversations: sessions.filter((s) => s.ownerId === userId).length,
    taches: taches.filter((t) => t.ownerId === userId).length,
    agents: agents.filter((a) => a.ownerId === userId).length,
    employes: employes.filter((e) => e.ownerId === userId).map((e) => String(e.nom ?? "Employé")),
    clesModeles: tableau(await db().read("clesModeles"))
      .filter((c) => c.ownerId === userId)
      .map((c) => String(c.nom ?? "Fournisseur")),
    bibliotheque: await (async () => {
      const siens = await elementsDe(userId);
      return { documents: siens.filter((e) => e.type === "document").length, dossiers: siens.filter((e) => e.type === "dossier").length };
    })(),
    reunions: (await reunionsDe(userId)).length,
    projetsSupprimes: [],
    projetsConfies: [],
    mentionsRetirees: 0,
  };

  const projetsApres: Enregistrement[] = [];
  for (const p of projets) {
    const membres = Array.isArray(p.members) ? p.members : [];
    if (p.ownerId === userId) {
      const suivant = successeurs(p, userId, email)[0];
      if (!suivant) {
        apercu.projetsSupprimes.push(String(p.name ?? "Projet"));
        continue;
      }
      apercu.projetsConfies.push({ projet: String(p.name ?? "Projet"), a: nomDe(suivant.userId) });
      projetsApres.push({
        ...p,
        ownerId: suivant.userId,
        // Le nouveau propriétaire n'est plus un simple membre de son projet.
        members: membres.filter((m) => !designe(m, userId, email) && !designe(m, suivant.userId, "")),
        updatedAt: new Date().toISOString(),
      });
      continue;
    }
    if (membres.some((m) => designe(m, userId, email))) {
      apercu.mentionsRetirees += 1;
      projetsApres.push({ ...p, members: membres.filter((m) => !designe(m, userId, email)) });
      continue;
    }
    projetsApres.push(p);
  }

  const sessionsApres: Enregistrement[] = [];
  for (const s of sessions) {
    if (s.ownerId === userId) continue;
    const partages = Array.isArray(s.sharedWith) ? s.sharedWith : [];
    if (partages.some((x) => designe(x, userId, email))) {
      apercu.mentionsRetirees += 1;
      sessionsApres.push({ ...s, sharedWith: partages.filter((x) => !designe(x, userId, email)) });
      continue;
    }
    sessionsApres.push(s);
  }

  return {
    apercu,
    projetsApres,
    sessionsApres,
    tachesApres: taches.filter((t) => t.ownerId !== userId),
    agentsApres: agents.filter((a) => a.ownerId !== userId),
    employesApres: employes.filter((e) => e.ownerId !== userId),
  };
}

/** Ce que la suppression ferait, pour que l'écran le dise avant la confirmation. */
export async function apercuEffacement(userId: string, email: string): Promise<Apercu> {
  return (await calculer(userId, email)).apercu;
}

/**
 * Supprime le compte et ses données. `email` est l'adresse **du compte**, pas
 * l'adresse de partage : c'est elle qui figure dans les invitations reçues.
 * L'identité doit avoir été confirmée par l'appelant.
 */
export async function effacerCompte(
  userId: string,
  email: string,
  par: "titulaire" | "outil local",
): Promise<Apercu> {
  await revokeAll(userId);
  // Ses clés d'API aussi, d'abord : un programme qui les porte ne doit plus rien obtenir pendant l'effacement.
  const clesApi = await oublierClesDe(userId);

  const { apercu, projetsApres, sessionsApres, tachesApres, agentsApres, employesApres } = await calculer(
    userId,
    email,
  );
  await db().write("projects", projetsApres);
  // Ses Chats partent : la mémoire qu'en gardaient les personnes avec qui il les partageait part avec eux.
  const chatsPartis = tableau(await db().read("sessions"))
    .map((s) => String(s.id))
    .filter((id) => !sessionsApres.some((s) => String(s.id) === id));
  await db().write("sessions", sessionsApres);
  await oublierChatsPartout(chatsPartis).catch(() => 0);
  await db().write("tasks", tachesApres);
  await db().write("agents", agentsApres);
  await db().write("employes", employesApres);
  /*
   * Ses compétences et ses tâches programmées (consignes et vingt derniers
   * comptes rendus, souvent des résumés de ses mails) : oubliées jusqu'à la
   * revue du 26/09/2026, elles survivaient à l'effacement du compte.
   */
  const competences = await db().read("competences");
  if (Array.isArray(competences)) await db().write("competences", tableau(competences).filter((c) => c.ownerId !== userId));
  const tachesProgrammees = await oublierTachesProgrammees(userId);
  // Ses clés de modèles cloud, personnelles comme partagées : elles engagent son moyen de paiement.
  const cles = await db().read("clesModeles");
  if (Array.isArray(cles)) await db().write("clesModeles", tableau(cles).filter((c) => c.ownerId !== userId));
  const echanges = await db().read("echangesEmployes");
  if (echanges && typeof echanges === "object" && !Array.isArray(echanges)) {
    const reste = { ...(echanges as Record<string, unknown>) };
    delete reste[userId];
    await db().write("echangesEmployes", reste);
  }

  const profils = await db().read("profiles");
  if (profils && typeof profils === "object" && !Array.isArray(profils)) {
    const sac = { ...(profils as Record<string, unknown>) };
    delete sac[`profile:${userId}`];
    await db().write("profiles", sac);
  }

  // Ses groupes : il en sort ; un groupe resté vide disparaît, un groupe sans responsable en reçoit un.
  const groupesQuittes = await oublierPersonneGroupes(userId);
  /*
   * Ses documents, relevés **avant** que la Bibliothèque ne les oublie : ils
   * quittent ensuite toutes les bases de connaissances, celles des collègues
   * comprises, index compris (connaissances.ts). Après, plus rien ne dit
   * qu'ils étaient à lui.
   */
  const sesDocuments = (await elementsDe(userId)).filter((e) => e.type === "document").map((e) => e.id);
  const elementsBibliotheque = await oublierPersonneBibliotheque(userId);
  const basesDeConnaissances = await oublierPersonneConnaissances(userId, sesDocuments);
  // Ses projets d'entraînement, et le modèle qu'il a pu ranger dans LM Studio (entrainement.ts).
  const entrainement = await oublierPersonneEntrainement(userId);
  const reunionsEffacees = await oublierPersonneReunions(userId);
  /*
   * Ses sessions de Helix Code : hors de la liste, et leur conversation
   * effacée chez OpenCode si son serveur tourne (sinon elle y reste, et le
   * journal le dit par le nombre).
   */
  await oublierEntretiens(userId);
  await oublierVps(userId);
  const sessionsCode = await oublierSessionsCode(userId).catch(() => []);
  let sessionsCodeEffacees = 0;
  if (enMarche()) {
    for (const s of sessionsCode) {
      const r = await api(`/session/${encodeURIComponent(s.id)}?directory=${encodeURIComponent(s.dossier)}`, { method: "DELETE" }).catch(() => undefined);
      if (r?.ok) sessionsCodeEffacees++;
    }
  }
  const lignesDeConsommation = await oublierCompte(userId);
  // Ses images créées : fichiers et registre (images.ts).
  const imagesEffacees = oublierImagesDe(userId);
  oublierChatsDesImages();
  // La mémoire de ses longues conversations, Chat par Chat (memoireConversation.ts, 16/10/2026).
  const memoiresDeChats = oublierMemoiresConversations(userId);
  await retirerCompte(userId);

  // Des nombres, jamais de contenu, et pas l'adresse une fois de plus.
  journaliser("compte.supprime", userId, {
    par,
    conversations: apercu.conversations,
    taches: apercu.taches,
    agents: apercu.agents,
    tachesProgrammees,
    employes: apercu.employes.length,
    projetsSupprimes: apercu.projetsSupprimes.length,
    projetsConfies: apercu.projetsConfies.length,
    mentionsRetirees: apercu.mentionsRetirees,
    groupesQuittes,
    elementsBibliotheque,
    basesDeConnaissances,
    projetsEntrainement: entrainement.projets,
    modelesEntrainesRestes: entrainement.modelesRestes,
    reunionsEffacees,
    sessionsCode: sessionsCode.length,
    sessionsCodeEffacees,
    lignesDeConsommation,
    imagesEffacees,
    memoiresDeChats,
    clesApi,
  });
  return apercu;
}

/**
 * Retire des membres de projet et des partages les comptes qui n'existent
 * plus. Appelé à chaque écriture d'un poste : le cache d'un collègue peut
 * contenir encore la personne supprimée, et la réinscrire en renvoyant sa
 * copie. Sans ce nettoyage, un nouveau compte créé plus tard avec la même
 * adresse hériterait de ses accès.
 */
export async function sansComptesDisparus(collection: string, valeur: unknown): Promise<unknown> {
  if (collection !== "projects" && collection !== "sessions") return valeur;
  const ids = new Set((await publicAccounts()).map((c) => c.id));
  const champ = collection === "projects" ? "members" : "sharedWith";
  return tableau(valeur).map((item) => {
    const liste = item[champ];
    if (!Array.isArray(liste)) return item;
    const garde = liste.filter((x) => {
      const id = (x as { userId?: unknown })?.userId;
      return typeof id !== "string" || ids.has(id);
    });
    return garde.length === liste.length ? item : { ...item, [champ]: garde };
  });
}
