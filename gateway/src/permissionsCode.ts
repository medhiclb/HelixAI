import { annuler, fermerDemande, modifie, ouvrirDemande, verifierOutil } from "./approbation.ts";
import { journaliser } from "./audit.ts";
import { sessionCode } from "./sessionsCode.ts";
import { t, tf } from "./langue.ts";
import { existsSync } from "node:fs";
import { dirname, isAbsolute, join, parse, resolve } from "node:path";
import { cheminReel, estProtege } from "./zonesProtegees.ts";

/**
 * Les demandes d'autorisation d'OpenCode, passées par la barrière de Helix.
 *
 * ── Pourquoi ────────────────────────────────────────────────────────────────
 *
 * Revue de sécurité du 25/09/2026, point critique : les outils livrés
 * d'OpenCode (`bash`, `edit`, `write`, `apply_patch`, `webfetch`) agissaient
 * sans jamais demander, parce que ses défauts sont « tout permis », et la
 * passerelle refusait d'office toute demande d'autorisation qui aurait pu
 * passer. Une commande lancée par l'agent a les droits du compte qui fait
 * tourner l'instance : c'était la plus grande porte de Helix, et la seule sans
 * barrière.
 *
 * Désormais la configuration d'OpenCode fait tout demander (opencode.ts,
 * `permission`), et chaque demande (`permission.asked`, lue par fluxCode.ts)
 * arrive ici :
 *
 *  1. sa session est cherchée au registre (sessionsCode.ts) : c'est **la
 *     propriétaire de la session** qui reçoit la carte, et personne d'autre.
 *     Session inconnue du registre, ou registre illisible : refus sans carte ;
 *  2. la demande devient un appel d'outil `code__<permission>` soumis à
 *     `verifierOutil`, au niveau choisi pour l'instance : en « Demander avant
 *     de modifier », lire et chercher passent sans carte, modifier, lancer une
 *     commande ou aller sur le réseau demandent ; en « Tout approuver », rien
 *     ne demande (sauf ce que la barrière demande toujours) ;
 *  3. la réponse revient à OpenCode par sa route de réponse
 *     (`POST /permission/<id>/reply`, relevée dans l'API de la version 1.18.32
 *     le 26/09/2026 : `{ reply: "once" | "always" | "reject", message? }` ;
 *     l'ancienne route `/session/<id>/permissions/<id>` y est marquée
 *     obsolète). Jamais « always » : un accord ne vaut que pour cette
 *     demande, OpenCode ne retient rien. Un refus part avec le message que lit
 *     l'agent, qui poursuit sans l'action.
 *
 * Portée d'un accord : la mémoire de la barrière (`ouvrirDemande`) dure un
 * tour de la session, comme une demande du Chat. Une écriture approuvée dans
 * un dossier couvre les suivantes du même dossier pendant ce tour ; une
 * commande ne couvre que la même commande, mot pour mot.
 */

/** Ce qu'OpenCode 1.18.32 met dans `permission.asked` (schéma `PermissionRequest` de son API). */
export interface DemandeOpenCode {
  id: string;
  sessionID: string;
  permission: string;
  patterns: string[];
  metadata: Record<string, unknown>;
}

/** Mémoire de la barrière pour le tour en cours de chaque session racine. */
const tours = new Map<string, string>();
const TOURS_MAX = 200;

/** Une nouvelle demande part dans cette session : les accords du tour précédent ne valent plus. */
export function nouveauTourCode(sessionID: string): void {
  const ancien = tours.get(sessionID);
  if (ancien) fermerDemande(ancien);
  tours.delete(sessionID);
  if (tours.size >= TOURS_MAX) {
    const [plusVieux, contexte] = tours.entries().next().value!;
    fermerDemande(contexte);
    tours.delete(plusVieux);
  }
  tours.set(sessionID, ouvrirDemande());
}

/** Demandes posées à la barrière et encore sans réponse : identifiant OpenCode → carte de Helix. */
const enCours = new Map<string, string>();

/** OpenCode a tranché lui-même (session arrêtée, demande abandonnée) : la carte n'a plus d'objet. */
export function permissionRepondueAilleurs(idOpenCode: string): void {
  const carte = enCours.get(idOpenCode);
  if (carte) annuler(carte);
}

const texte = (v: unknown, max = 4000): string => (typeof v === "string" ? v.slice(0, max) : "");

/**
 * Au-delà, une commande n'est pas soumise : refusée sans carte, l'agent la
 * découpe. Revue de sécurité du 26/09/2026 : la carte coupait à 4000
 * caractères, et un `curl` placé après un long texte partait sans avoir été
 * montré ; deux commandes au même début partageaient aussi le même accord.
 */
export const COMMANDE_MAX = 20_000;

/**
 * La racine qu'OpenCode prend pour le projet (`worktree`) : le dépôt Git qui
 * contient le dossier, sinon la racine du disque (lu dans son code 1.18.32 :
 * un projet sans Git a `worktree: "/"`). Ses motifs d'écriture y sont relatifs,
 * pas au dossier de la session.
 */
function racineDuProjet(dossier: string): string {
  let d = resolve(dossier);
  for (;;) {
    if (existsSync(join(d, ".git"))) return d;
    const parent = dirname(d);
    if (parent === d) return parse(d).root;
    d = parent;
  }
}

/**
 * Les fichiers qu'une modification d'OpenCode touche, en chemins absolus.
 *
 * Test d'intrusion du 27/09/2026 : pour `apply_patch` (proposé aux modèles
 * « gpt-… », les modèles branchés par une clé), OpenCode 1.18.32 demande
 * `edit` avec `patterns` = les fichiers relatifs à la racine du dépôt, et
 * `metadata.filepath` = ces noms **joints par des virgules** ; les chemins
 * absolus, destination d'un « Move to » comprise, ne sont que dans
 * `metadata.files` (lu dans son code). Helix lisait `filepath` : un seul
 * « chemin » fait de tous les noms, qui ne tombait jamais dans une zone
 * protégée ; le deuxième fichier d'un correctif, ou la destination d'un
 * déplacement par un lien du projet, passait donc le refus des zones, et au
 * niveau « Tout approuver » sans aucune carte.
 */
export function cheminsModifies(d: DemandeOpenCode, dossier: string): string[] {
  const m = d.metadata ?? {};
  const liste: string[] = [];
  const racine = racineDuProjet(dossier);
  // `isAbsolute`, pas `startsWith("/")` (audit Windows du 27/09/2026) : `C:\\projet\\app.ts` devenait `C:\\projet/C:\\projet\\app.ts`.
  const ajouter = (v: unknown, base: string) => {
    const c = texte(v);
    if (c) liste.push(isAbsolute(c) ? c : join(base, c));
  };
  if (Array.isArray(m.files)) {
    for (const f of m.files.slice(0, 500)) {
      if (!f || typeof f !== "object") continue;
      const fichier = f as Record<string, unknown>;
      ajouter(fichier.filePath, dossier);
      ajouter(fichier.movePath, dossier);
    }
  }
  if (liste.length === 0) {
    const motifs = (d.patterns ?? []).filter((p) => typeof p === "string" && p);
    const un = texte(m.filepath) || texte(m.filePath);
    // Un seul fichier (outils `edit` et `write`) : `filepath` est son chemin absolu. Plusieurs : les motifs, relatifs à la racine du dépôt.
    if (un && motifs.length <= 1) ajouter(un, dossier);
    else for (const p of motifs.slice(0, 500)) ajouter(p, racine);
  }
  return [...new Set(liste)];
}

/**
 * Traduit une demande d'OpenCode en appel d'outil pour la barrière :
 * `code__bash` + `{ commande }`, `code__edit` + `{ path }`, etc. Le chemin
 * visé passe par `path`, que la barrière sait lire (portée par dossier).
 */
export function outilDe(d: DemandeOpenCode, dossier: string): { outil: string; args: Record<string, unknown> } {
  const m = d.metadata ?? {};
  const motif = d.patterns?.[0];
  const outil = `code__${d.permission.replace(/[^A-Za-z0-9_]/g, "_").slice(0, 60)}`;
  switch (d.permission) {
    case "bash":
      // Entière (un caractère de plus que le maximum, pour savoir qu'elle le dépasse) : la carte et l'accord portent sur toute la commande.
      return { outil, args: { commande: texte(m.command, COMMANDE_MAX + 1) || texte(motif, COMMANDE_MAX + 1), dossier } };
    case "edit":
    case "write":
    case "apply_patch": {
      // Tous les fichiers touchés, destinations d'un déplacement comprises : la carte, la portée et les zones protégées portent sur chacun.
      const liste = cheminsModifies(d, dossier);
      return { outil, args: liste.length > 1 ? { paths: liste } : { path: liste[0] ?? "" } };
    }
    case "webfetch":
      return { outil, args: { url: texte(m.url) || texte(motif) } };
    case "websearch":
    case "codesearch":
      return { outil, args: { requete: texte(m.query) || texte(motif) } };
    default: {
      const chemin = texte(m.filepath) || texte(m.path) || texte(motif);
      // Un motif (`src/**/*.ts`) aussi, rattaché au dossier du projet : il se jugeait sinon depuis le dossier courant de la passerelle.
      return { outil, args: chemin ? { path: isAbsolute(chemin) ? chemin : join(dossier, chemin) } : {} };
    }
  }
}

/**
 * Traite une demande d'autorisation d'OpenCode. `racine` : la session suivie
 * qui a lancé celle-ci (elle-même, ou le parent d'un sous-agent) ;
 * `repondre` : envoie la réponse à OpenCode (fluxCode.ts).
 */
export async function traiterPermissionCode(
  d: DemandeOpenCode,
  racine: string,
  dossier: string,
  repondre: (reponse: { reply: "once" | "reject"; message?: string }) => void,
): Promise<void> {
  const refuser = (cause: string, message: string, qui = "systeme") => {
    journaliser("outil.refuse", qui, { surface: "code", cause, permission: d.permission, session: d.sessionID });
    repondre({ reply: "reject", message });
  };

  let proprietaire: string | undefined;
  try {
    const cible = await sessionCode(d.sessionID) ?? await sessionCode(racine);
    proprietaire = cible?.userId;
    if (cible?.vps && ["bash","read","edit","write","apply_patch","glob","grep","list","external_directory"].includes(d.permission)) return refuser("projet-vps",t("Ce projet est sur un VPS. Utilise vps__executer pour lire, modifier et exécuter sur le serveur distant."),proprietaire);
  } catch {
    return refuser("registre-illisible", t("Refusé par l'instance : son registre des sessions de code est illisible, elle ne sait pas pour qui tu travailles."));
  }
  if (!proprietaire) {
    return refuser("session-inconnue", t("Refusé par l'instance : cette session de code n'est inscrite au nom de personne."));
  }

  const { outil, args } = outilDe(d, dossier);
  if (typeof args.commande === "string" && args.commande.length > COMMANDE_MAX) {
    return refuser("commande-trop-longue", tf("Refusé par l'instance : cette commande dépasse {0} caractères, elle ne peut pas être montrée en entier pour accord. Découpe-la, ou écris d'abord un fichier puis lance-le.", String(COMMANDE_MAX)), proprietaire);
  }
  /*
   * Une zone protégée (zonesProtegees.ts : données de l'instance, `~/.helix`,
   * clés, réglages d'autres logiciels) ne se lit ni ne s'écrit, même avec un
   * accord : refus sans carte. Chemin réel, liens résolus : un lien posé dans
   * le projet vers `~/.ssh` est refusé comme sa cible. Une commande (`bash`)
   * ne se borne pas par des chemins : sa carte la montre entière.
   */
  const vises = Array.isArray(args.paths) ? (args.paths as string[]) : typeof args.path === "string" && args.path ? [args.path] : [];
  // Une modification dont on ne sait pas quel fichier elle touche ne se soumet pas : la carte ne saurait pas le dire, ni les zones le refuser.
  if (vises.length === 0 && ["edit", "write", "apply_patch"].includes(d.permission)) {
    return refuser("chemin-inconnu", t("Refusé par l'instance : elle ne sait pas quel fichier cette modification toucherait."), proprietaire);
  }
  for (const vise of vises) {
    const sansMotif = vise.split(/[*?[{]/)[0]!;
    if (estProtege(cheminReel(sansMotif ? resolve(dossier, sansMotif) : vise))) {
      return refuser("zone-protegee", t("Refusé par l'instance : ce chemin est dans une zone protégée (données de l'instance, clés, réglages d'autres logiciels). Aucun accord ne l'ouvre."), proprietaire);
    }
  }
  const contexte = tours.get(racine) ?? null;
  const promesse = verifierOutil(contexte, outil, args, proprietaire, undefined, false, "code", (carte) => enCours.set(d.id, carte));
  let verdict;
  try {
    verdict = await promesse;
  } finally {
    enCours.delete(d.id);
  }
  if (verdict.autorise) {
    // Au journal, ce qui agit (commande, écriture, réseau) ; pas chaque lecture accordée d'office.
    if (modifie(outil)) journaliser("outil.appele", proprietaire, { outil, surface: "code", session: d.sessionID });
    return repondre({ reply: "once" });
  }
  repondre({ reply: "reject", message: verdict.message });
}
