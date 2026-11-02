import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { journaliser } from "./audit.ts";
import { apercuEnvoi, envoiSansAccord, presenterMessage } from "./courrier.ts";
import { ECRITURES_COMMERCE, LECTURES_COMMERCE, resumeCommerce } from "./natifs/commerceRegles.ts";
import { APERCU_REQUIS, ECRITURES_PROJETS, estEcritureMcpProjet, estLectureMcpProjet, LECTURES_PROJETS, resumeProjet } from "./natifs/projetsRegles.ts";
// Microsoft 365 (28/09/2026) : noms et phrases des cartes, dans un fichier sans autre dépendance que langue.ts.
import { ECRITURES_MICROSOFT, LECTURES_MICROSOFT, resumeMicrosoft } from "./natifs/microsoftBase.ts";
// Palmier Pro (29/09/2026) : ses lectures pures, par leur nom exact ; tout le reste se confirme à chaque appel.
import { estEcriturePalmier, estLecturePalmier, horsMachinePalmier, resumePalmier } from "./palmierRegles.ts";
// Roblox Studio et Blender (12/10/2026) : de même, leurs lectures par leur nom exact, tout le reste sur carte à chaque appel.
import { estEcritureRoblox, estLectureRoblox, horsMachineRoblox, resumeRoblox } from "./robloxRegles.ts";
import { estEcritureBlender, estLectureBlender, horsMachineBlender, lookHorsScene, resumeBlender } from "./blenderRegles.ts";
// Unreal Editor (16/10/2026) : ses deux lectures par leur nom exact ; `call_tool` et tout le reste sur carte à chaque appel.
import { estEcritureUnreal, estLectureUnreal, resumeUnreal } from "./unrealRegles.ts";

/** Une écriture d'une application de création ouverte sur la machine (Palmier Pro, Roblox Studio, Blender, Unreal Editor). */
const estEcritureApplication = (outil: string): boolean => estEcriturePalmier(outil) || estEcritureRoblox(outil) || estEcritureBlender(outil) || estEcritureUnreal(outil);

/**
 * Approbation des actions de l'agent.
 *
 * Le sélecteur « Approuver pour moi » de Cowork promettait un contrôle qui
 * n'existait pas : trois niveaux affichés, aucun appliqué. Ce module est la
 * chose réelle.
 *
 * Deux principes gouvernent tout ce qui suit.
 *
 * 1. **La barrière est ici, pas dans le navigateur.** Un contrôle posé dans
 *    l'interface ne protège de rien : il suffit d'appeler `/v1/chat/completions`
 *    avec `tools: true` pour le contourner. Le niveau est lu et appliqué par la
 *    passerelle, quel que soit le client ; l'interface ne fait que l'afficher.
 *
 * 2. **Un seul mécanisme.** Le contrôle de l'écran avait déjà tout ce qu'il
 *    faut : file d'attente, flux d'évènements vers l'interface, délai
 *    d'expiration, trace au journal. Le dupliquer pour les fichiers aurait donné
 *    deux files, deux flux et deux comportements qui divergent au premier
 *    correctif. Le noyau vit donc ici, et `computer.ts` s'en sert.
 */

/* ------------------------------------------------------------------ */
/* Niveau                                                              */
/* ------------------------------------------------------------------ */

export type Niveau = "tout" | "modifications" | "chaque";

export const NIVEAUX: Niveau[] = ["tout", "modifications", "chaque"];

export const estNiveau = (valeur: unknown): valeur is Niveau =>
  typeof valeur === "string" && (NIVEAUX as string[]).includes(valeur);

/**
 * Niveau à l'installation.
 *
 * Ni le plus permissif ni le plus bavard. Un agent qui explore librement mais
 * demande avant de toucher est utilisable dès la première minute, et ne peut
 * pas abîmer un dossier avant que son propriétaire ait compris ce qu'il fait.
 */
export const NIVEAU_DEFAUT: Niveau = "modifications";

/**
 * Où le niveau est conservé.
 *
 * Volontairement **hors** des collections de `db.ts`. Celles-ci se synchronisent
 * entre les postes par `PUT /helix/data/<collection>` : y ranger le niveau
 * aurait donné à n'importe quel poste authentifié le moyen de le remettre à
 * « tout » par une route générique, c'est-à-dire exactement le contournement
 * que ce module existe pour empêcher. Il se change par une route dédiée, qui
 * exige une séance et laisse une trace.
 */
const fichierNiveau = () =>
  join(process.env.HELIX_DATA_DIR ?? join(homedir(), ".helix", "data"), "approbation.json");

let niveauCourant: Niveau | null = null;

export function niveau(): Niveau {
  if (niveauCourant) return niveauCourant;
  try {
    const lu = JSON.parse(readFileSync(fichierNiveau(), "utf8")) as { niveau?: unknown };
    // Un fichier absent, illisible ou porteur d'une valeur inconnue ne doit pas
    // ouvrir les vannes : on retombe sur le niveau d'installation.
    niveauCourant = estNiveau(lu.niveau) ? lu.niveau : NIVEAU_DEFAUT;
  } catch {
    niveauCourant = NIVEAU_DEFAUT;
  }
  return niveauCourant;
}

/** Change le niveau et le grave sur disque. Le redémarrage le retrouve. */
export function definirNiveau(valeur: Niveau, qui: string): void {
  const ancien = niveau();
  niveauCourant = valeur;

  const fichier = fichierNiveau();
  try {
    const dir = dirname(fichier);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true, mode: 0o700 });
    // Écriture atomique, comme le magasin de db.ts : un poste qui lit pendant
    // l'écriture ne doit jamais tomber sur un fichier tronqué.
    const temp = `${fichier}.tmp`;
    writeFileSync(temp, JSON.stringify({ niveau: valeur }), { encoding: "utf8", mode: 0o600 });
    renameSync(temp, fichier);
  } catch (err) {
    console.error(
      "[approbation] niveau non conservé sur disque :",
      err instanceof Error ? err.message : err,
    );
  }

  journaliser("approbation.niveau", qui, { ancien, nouveau: valeur });
}

/* ------------------------------------------------------------------ */
/* Ce qui compte comme « modifier »                                    */
/* ------------------------------------------------------------------ */

/**
 * Outils du serveur de fichiers qui ne font qu'observer.
 *
 * Liste établie sur les noms réels rendus par
 * `@modelcontextprotocol/server-filesystem` (14 outils) et non sur une
 * supposition. Les quatre absents modifient : `write_file`, `edit_file`,
 * `create_directory`, `move_file`.
 *
 * Le sens de la liste est important : on énumère ce qui est **inoffensif**, et
 * tout le reste est traité comme modifiant. Une mise à jour du serveur qui
 * ajouterait `delete_file` serait donc soumise à approbation dès le premier
 * appel, sans que personne ait à y penser. L'inverse aurait laissé passer.
 */
const FICHIERS_LECTURE = new Set([
  "read_file",
  "read_text_file",
  "read_media_file",
  "read_multiple_files",
  "list_directory",
  "list_directory_with_sizes",
  "directory_tree",
  "search_files",
  "get_file_info",
  "list_allowed_directories",
]);

/** Outils bureautiques qui ne font que lire (`bureau.ts`). */
const BUREAU_LECTURE = new Set(["lire_document"]);

/** Outils des connecteurs Google Drive et Slack, tous de lecture (`drive.ts`, `slack.ts`). */
const DRIVE_LECTURE = new Set(["drive__chercher", "drive__recents", "drive__dossier", "drive__lire"]);
const SLACK_LECTURE = new Set(["slack__salons", "slack__messages", "slack__fil", "slack__chercher"]);

/**
 * Dit si un outil change quelque chose.
 *
 * Le connecteur de courrier (`courrier__`) lit, et dépose des brouillons :
 * consulter une boîte ne modifie rien et ne demande donc rien au niveau
 * « Demander avant de modifier » ; déposer un brouillon, si. Les lectures sont
 * reconnues par leur nom exact : un outil de courrier inconnu modifie.
 *
 * Les actions d'écran ne passent pas par ici : `computer.ts` a sa propre
 * classification, plus fine (une capture observe, un clic agit).
 *
 * **Un outil dont on ne sait rien modifie.** Depuis que l'instance peut se voir
 * ajouter des connecteurs, les noms qui arrivent ici ne sont plus connus
 * d'avance : Notion en apporte des dizaines, un serveur interne en apportera
 * d'autres. La liste de lecture ne vaut donc que pour le serveur qui l'a
 * inspirée, celui des fichiers. Sans cette restriction, un connecteur exposant
 * un outil nommé `search_files` ou `read_file` — noms parfaitement banals —
 * aurait hérité du laissez-passer du serveur de fichiers et agi sans rien
 * demander. On échoue fermé : ce qu'on ne reconnaît pas passe par l'approbation.
 */
const SERVEUR_FICHIERS = "fichiers";
const AGENDA_LECTURE = new Set(["agenda__prochains", "agenda__jour", "agenda__chercher"]);
const COURRIER_LECTURE = new Set(["courrier__derniers", "courrier__chercher", "courrier__lire"]);
const BIBLIOTHEQUE_LECTURE = new Set(["bibliotheque__chercher", "bibliotheque__lire", "reunions__chercher", "reunions__lire"]);
/** Recherche d'un employé dans les bases de connaissances de son agent (connaissances.ts) : ne touche à rien. */
const CONNAISSANCES_LECTURE = new Set(["connaissances__chercher"]);
/*
 * Le web gardé des employés (webGarde.ts) : chercher, et ouvrir une adresse
 * déjà vue pendant le traitement d'un mail. Traités comme des lectures : ils
 * ne font sortir que ce qui a été vu, pas ce que l'agent compose (27/09/2026).
 */
const WEB_LECTURE = new Set(["web__chercher", "web__lire"]);
/** Le contrôle du code web lit des fichiers et ne touche à rien (controleWeb.ts). */
const CONTROLE_LECTURE = new Set(["controle__site_web"]);

/**
 * Outils qui, par défaut, demandent à chaque fois, quel que soit le niveau,
 * même à un agent « autonome », et dont l'accord ne se retient jamais d'un
 * appel à l'autre.
 *
 * Un mail envoyé ne se reprend pas. Le niveau « Tout approuver » dit « fais ce
 * que tu veux dans mes dossiers », pas « écris à mes clients en mon nom » ; un
 * accord donné pour un premier mail ne couvre pas le suivant, qui n'a ni les
 * mêmes destinataires ni le même texte.
 *
 * Une personne peut choisir d'envoyer sans confirmation (Connecteurs, Courrier,
 * `envoiSansAccord`) : l'envoi suit alors les règles ordinaires, sans carte au
 * niveau « Tout approuver » ni pour un agent autonome. Aux autres niveaux,
 * chaque mail reste montré en entier.
 */
const ENVOI = new Set(["courrier__envoyer"]);
/**
 * Toujours une carte, à tout niveau, même « Tout approuver », et un accord qui
 * ne vaut que pour cet appel : supprimer un événement (ne se reprend pas), et
 * programmer une tâche (elle tournera ensuite seule, avec les outils de la
 * personne, sans que personne la relise : un texte venu du dehors qui en
 * crée une s'installe pour de bon). Revue de sécurité du 26/09/2026 : la
 * suppression passait par la vérification d'un mail (refusée sans envoi
 * activé, présentée comme un mail sinon) et suivait le choix « envoyer sans
 * confirmation » ; elle a désormais son propre chemin, que ce choix ne
 * touche pas.
 */
/*
 * Google Sheets, Slides, YouTube, LinkedIn, Facebook, Instagram, TikTok
 * (outilsNatifs.ts, 28/09/2026). Les lectures, par leur nom exact ; ce qui
 * écrit une feuille ou publie un post se confirme à chaque fois, à tout
 * niveau : un post ne se reprend pas, et il parle au nom de l'organisation.
 * Les listes vivent ici et non dans outilsNatifs.ts : la barrière se charge
 * seule (batterie de sécurité), sans le dossier de travail que ce module lit.
 */
export const LECTURES_NATIVES = new Set([
  "sheets__lire",
  "slides__lire",
  "youtube__chaine",
  "youtube__videos",
  "linkedin__profil",
  "linkedin__pages",
  "linkedin__publications",
  "linkedin__statistiques",
  "facebook__pages",
  "facebook__publications",
  "instagram__compte",
  "instagram__publications",
  "instagram__statistiques",
  "tiktok__profil",
  "tiktok__videos",
  // X (ex-Twitter), ajouté le 28/09/2026 sur le même modèle (SECURITE.md § 42).
  "x__profil",
  "x__publications",
  // Google Docs, Google Forms, Dropbox (natifs/documents.ts, 28/09/2026, SECURITE.md § 45).
  "docs__lire",
  "forms__lire",
  "forms__reponses",
  "dropbox__lister",
  "dropbox__chercher",
  "dropbox__lire",
  // Messageries (natifs/messageries.ts, 28/09/2026, SECURITE.md § 46) : lire une conversation.
  "telegram__conversations",
  "telegram__messages",
  "discord__salons",
  "discord__messages",
  "whatsapp__conversations",
  "whatsapp__messages",
  "whatsapp__modeles",
  // Commerce et relation client (natifs/commerce.ts, SECURITE.md § 47).
  ...LECTURES_COMMERCE,
  // Brevo et Mailchimp (natifs/projetsRegles.ts, SECURITE.md § 48).
  ...LECTURES_PROJETS,
  // Microsoft 365 (Outlook, OneDrive, SharePoint, Excel, Word, Teams), 28/09/2026 (SECURITE.md § 44).
  ...LECTURES_MICROSOFT,
]);
export const ECRITURES_NATIVES = new Set([
  "sheets__ecrire",
  "sheets__ajouter_lignes",
  "linkedin__publier",
  // Au nom d'une page d'entreprise, par la seconde application LinkedIn (29/09/2026).
  "linkedin__publier_page",
  "facebook__publier",
  "instagram__publier",
  "tiktok__publier_video",
  "x__publier",
  "docs__creer",
  "docs__ajouter_texte",
  "dropbox__envoyer",
  // Un message envoyé ne se reprend pas, et part au nom de l'organisation (SECURITE.md § 46).
  "telegram__envoyer",
  "discord__envoyer",
  "whatsapp__envoyer",
  "whatsapp__envoyer_modele",
  // Une note Salesforce ou Pipedrive, une réponse Zendesk : une carte à chaque fois (§ 47).
  ...ECRITURES_COMMERCE,
  ...ECRITURES_PROJETS,
  // Brouillon et envoi Outlook, événement, plage Excel, message Teams : une carte à chaque fois, même au niveau « Tout approuver ».
  ...ECRITURES_MICROSOFT,
]);

/**
 * Messageries (natifs/messageries.ts) : à qui part un envoi, tel que
 * l'instance le connaît (nom de la conversation, du salon, du numéro), et le
 * texte final d'un modèle WhatsApp. La barrière se charge sans ce module
 * (batterie de sécurité) : sans lui, la carte dit l'identifiant brut.
 */
type ApercuMessagerie = (outil: string, args: Record<string, unknown>) => { destinataire: string; texteFinal?: string; fenetre?: string } | null;
let apercuMessagerie: ApercuMessagerie | null = null;
export function definirApercuMessagerie(fn: ApercuMessagerie): void {
  apercuMessagerie = fn;
}

const TOUJOURS_CONFIRMER = new Set(["agenda__supprimer", "taches__programmer", ...ECRITURES_NATIVES]);
/*
 * Les serveurs MCP de Trello, Monday, ClickUp, Todoist, Calendly et Zoom
 * (SECURITE.md § 48) : tout outil qui n'est pas une lecture reconnue à la
 * liste de ses outils se confirme à chaque fois, à tout niveau. Reconnu par
 * préfixe, donc même barrière chargée seule : elle échoue fermé.
 */
/*
 * Et Palmier Pro (29/09/2026, SECURITE.md § 63) : ce qui n'est pas une lecture
 * reconnue (modifier la timeline, et surtout générer une vidéo ou une image,
 * payée sur les crédits de la personne chez Palmier) se confirme à chaque
 * appel, à tout niveau, y compris pour un employé « autonome ».
 */
/*
 * Roblox Studio et Blender (12/10/2026, SECURITE.md § 65) : de même. Exécuter
 * du Luau dans Studio ou du Python dans Blender, modifier un script, générer
 * chez Roblox ou chez un service de Blender : une carte à chaque appel.
 */
const toujoursConfirmer = (outil: string) => TOUJOURS_CONFIRMER.has(outil) || estEcritureMcpProjet(outil) || estEcritureApplication(outil);

/*
 * Ce qui se confirme à chaque fois selon les arguments de l'appel, pas
 * seulement son nom (12/10/2026) : `look` de Blender avec une image qui n'est
 * pas « Render Result » ni « Viewer Node » (un fichier de la machine, peut-être).
 */
const confirmerSelonArguments = (outil: string, args?: Record<string, unknown>) => lookHorsScene(outil, args);

/** Avec les arguments, aussi ce qui se confirme selon eux (`look` de Blender hors de la scène). */
export const demandeToujours = (outil: string, args?: Record<string, unknown>) =>
  toujoursConfirmer(outil) || confirmerSelonArguments(outil, args) || (ENVOI.has(outil) && !envoiSansAccord());

/**
 * Carte d'une campagne Brevo ou Mailchimp, préparée par natifs/projets.ts, qui
 * s'inscrit ici à son chargement (la barrière ne l'importe pas : elle reste
 * chargeable seule).
 */
type Apercu = (outil: string, args: Record<string, unknown>) => Promise<{ resume: string; affiche: string; empreinte?: string } | { refus: string }>;

/*
 * L'empreinte de ce qu'une carte **acceptée** a montré, attachée à l'appel
 * même (l'objet de ses arguments, que chat.ts passe tel quel de la barrière à
 * l'outil). Tournée des connecteurs du 28/09/2026 : projets.ts retenait
 * l'empreinte de la dernière carte **montrée** pour la campagne, acceptée ou
 * non, et de n'importe qui. Une carte montrée à un collègue (que l'outil
 * refuse ensuite) ou refusée remplaçait celle que l'administrateur allait
 * accepter : la campagne modifiée entre-temps partait, alors que la carte
 * acceptée en montrait une autre.
 */
const apercusAccordes = new WeakMap<object, string>();

/** L'empreinte montrée sur la carte acceptée pour cet appel, une seule fois ; `undefined` sans carte acceptée. */
export function empreinteAccordee(args: object): string | undefined {
  const v = apercusAccordes.get(args);
  apercusAccordes.delete(args);
  return v;
}
/*
 * Registre porté par une fonction, hissée avec ce module : un `let` ne l'est pas,
 * et natifs/projets.ts s'inscrit parfois avant que ce module ait fini de se
 * charger (imports croisés, vu le 28/09/2026 à la fusion des connecteurs).
 */
function registreApercu(): { fn: Apercu | null } {
  const porteur = registreApercu as unknown as { valeur?: { fn: Apercu | null } };
  return (porteur.valeur ??= { fn: null });
}
export function definirApercuNatif(fn: Apercu): void {
  registreApercu().fn = fn;
}

/*
 * Le nom lisible d'un connecteur (« Mémoire de travail » plutôt que
 * « memoire »), pour la carte d'accord (tournée à l'écran du 28/09/2026).
 * Donné par connecteurs.ts au chargement, comme l'aperçu natif : l'importer
 * d'ici refermerait un cycle d'import, avec les erreurs d'ordre de
 * chargement vues à la fusion du 28/09/2026.
 */
type NomConnecteur = (id: string) => string | undefined;
function registreNoms(): { fn: NomConnecteur | null } {
  const porteur = registreNoms as unknown as { valeur?: { fn: NomConnecteur | null } };
  return (porteur.valeur ??= { fn: null });
}
export function definirNomsConnecteurs(fn: NomConnecteur): void {
  registreNoms().fn = fn;
}

/*
 * Les outils qu'un administrateur a marqués « lecture seule » sur un serveur
 * MCP qu'il a ajouté lui-même (16/10/2026, connecteurs.ts,
 * `definirLecturesPersonnalisees`). Par défaut, tout outil d'un tel serveur
 * modifie (carte d'accord). Le registre ne répond que pour les serveurs
 * ajoutés ainsi, dont l'identifiant ne peut être ni un préfixe réservé ni une
 * entrée du catalogue ; barrière chargée seule : aucun outil n'y est lecture.
 */
type LecturePerso = (outil: string) => boolean;
function registreLecturesPerso(): { fn: LecturePerso | null } {
  const porteur = registreLecturesPerso as unknown as { valeur?: { fn: LecturePerso | null } };
  return (porteur.valeur ??= { fn: null });
}
export function definirLecturesPerso(fn: LecturePerso): void {
  registreLecturesPerso().fn = fn;
}

/**
 * Outils livrés d'OpenCode qui ne font que lire le dossier du projet
 * (permissionsCode.ts : `code__<permission>`). Tout le reste modifie ou sort :
 * `bash` (une commande peut tout faire), `edit` (écriture, correctif),
 * `webfetch` et `websearch` (le réseau), et toute permission qu'une version
 * future ajouterait.
 */
const CODE_LECTURE = new Set(["code__read", "code__glob", "code__grep", "code__list", "code__lsp"]);

export function modifie(outil: string): boolean {
  if (outil.startsWith("code__")) return !CODE_LECTURE.has(outil);
  if (outil.startsWith("courrier__")) return !COURRIER_LECTURE.has(outil);
  /*
   * Agenda : les trois lectures ne modifient rien. Depuis le 26/09/2026, Google
   * Agenda peut aussi écrire (agenda__creer, agenda__modifier,
   * agenda__supprimer, agendaGoogle.ts) : ce qui n'est pas une lecture
   * reconnue modifie, comme pour le courrier.
   */
  if (outil.startsWith("agenda__")) return !AGENDA_LECTURE.has(outil);
  // Programmer une tâche la fait tourner seule ensuite : elle se confirme ; lister ne touche à rien.
  if (outil === "taches__lister") return false;
  if (outil.startsWith("taches__")) return true;
  /*
   * Google Drive et Slack sont en lecture seule (drive.ts, slack.ts). Ils sont
   * reconnus par leurs noms exacts, pas par leur préfixe : un serveur MCP ajouté
   * sous l'identifiant « slack » apporterait des `slack__…` qui, eux, peuvent
   * écrire, et ne doivent pas hériter du laissez-passer.
   */
  if (LECTURES_NATIVES.has(outil)) return false;
  // Lectures reconnues des serveurs MCP de la famille « projets » (natifs/projetsRegles.ts, `classer`).
  if (estLectureMcpProjet(outil)) return false;
  // Lectures pures de Palmier Pro, par leur nom exact (palmierRegles.ts).
  if (estLecturePalmier(outil)) return false;
  // Et celles de Roblox Studio et de Blender (robloxRegles.ts, blenderRegles.ts).
  if (estLectureRoblox(outil) || estLectureBlender(outil) || estLectureUnreal(outil)) return false;
  if (DRIVE_LECTURE.has(outil) || SLACK_LECTURE.has(outil) || BIBLIOTHEQUE_LECTURE.has(outil) || CONNAISSANCES_LECTURE.has(outil) || CONTROLE_LECTURE.has(outil) || WEB_LECTURE.has(outil)) return false;
  if (outil.startsWith("bureau__")) return !BUREAU_LECTURE.has(outil.slice("bureau__".length));
  // Un serveur ajouté par l'administrateur : lecture seulement pour l'outil qu'il a marqué ainsi (16/10/2026).
  if (registreLecturesPerso().fn?.(outil) === true) return false;

  const separateur = outil.indexOf("__");
  // Un nom sans préfixe vient de la boucle d'outils d'origine, avant que les
  // noms ne soient qualifiés : il désignait déjà le serveur de fichiers.
  const serveur = separateur === -1 ? SERVEUR_FICHIERS : outil.slice(0, separateur);
  if (serveur !== SERVEUR_FICHIERS) return true;

  const court = separateur === -1 ? outil : outil.slice(separateur + 2);
  return !FICHIERS_LECTURE.has(court);
}

/* ------------------------------------------------------------------ */
/* Dire ce que l'agent veut faire, en français                         */
/* ------------------------------------------------------------------ */

/** `~/Comptabilite/bilan.txt` se lit ; `/Users/martine/...` s'oublie. */
function abreger(chemin: string): string {
  const maison = homedir();
  return chemin === maison || chemin.startsWith(`${maison}/`)
    ? `~${chemin.slice(maison.length)}`
    : chemin;
}

/** Les champs où un outil reçoit un chemin. */
const CLES_CHEMIN = ["path", "chemin", "source", "paths"];

/**
 * Le chemin sur lequel l'outil agit vraiment : celui du champ qu'il lit.
 *
 * Seconde tournée du 28/09/2026 : la barrière prenait le premier champ
 * rempli, `path` d'abord, quel que soit l'outil. Or `move_file` ne lit que
 * `source` et `destination`, les outils bureautiques que `chemin` (bureau.ts) :
 * un `path` en plus, que l'outil ignore, décidait de la carte et de la portée.
 * Essayé sur la barrière seule : « déplacer Secret/contrat.pdf » accompagné
 * d'un `path` dans Public passait sans carte après un renommage accordé dans
 * Public, et une carte neuve annonçait le déplacement du leurre, pas celui du
 * contrat ; un document créé dans Secret passait de même sur une écriture
 * accordée dans Public.
 */
function chemin(args: Record<string, unknown>, outil = ""): string | null {
  const nom = outil.includes("__") ? outil.slice(outil.indexOf("__") + 2) : outil;
  const premier = outil.startsWith("bureau__") ? "chemin" : nom === "move_file" ? "source" : "";
  for (const cle of premier ? [premier, ...CLES_CHEMIN.filter((c) => c !== premier)] : CLES_CHEMIN) {
    const valeur = args[cle];
    if (typeof valeur === "string" && valeur) return valeur;
    if (Array.isArray(valeur) && typeof valeur[0] === "string") return valeur[0];
  }
  return null;
}

const texteOu = (valeur: unknown, defaut: string) =>
  typeof valeur === "string" && valeur ? abreger(valeur) : defaut;

/**
 * Phrase soumise à l'utilisateur.
 *
 * « L'agent veut écrire dans ~/Comptabilite/bilan.txt » et non
 * « fichiers__write_file ». Personne n'approuve ce qu'il ne comprend pas, et un
 * utilisateur qui ne comprend pas finit par tout approuver par lassitude.
 */
export function resumerOutil(outil: string, args: Record<string, unknown>): string {
  if (outil === "vps__executer") return `exécuter sur le VPS ${String(args.serveur_nom ?? args.serveur ?? "?").slice(0,80)} : ${String(args.commande ?? "").slice(0,500)}`;
  const cible = chemin(args, outil);
  const ou = cible ? abreger(cible) : "un emplacement non précisé";

  // Outils livrés de l'agent de code (permissionsCode.ts) : la carte dit la commande, le fichier ou l'adresse.
  if (outil.startsWith("code__")) {
    const nom = outil.slice("code__".length);
    const commande = typeof args.commande === "string" ? args.commande : "";
    switch (nom) {
      case "bash":
        return `lancer la commande « ${commande.split("\n")[0]!.slice(0, 200)}${commande.includes("\n") || commande.length > 200 ? " …" : ""} » dans ${texteOu(args.dossier, "le dossier du projet")}`;
      case "edit":
      case "write":
      case "apply_patch": {
        // Un correctif de plusieurs fichiers le dit : la liste entière part dans le détail de la carte (`cibles`).
        const combien = Array.isArray(args.paths) ? args.paths.length : 0;
        return combien > 1 ? `modifier ${combien} fichiers, dont ${ou}` : `modifier ${ou}`;
      }
      case "webfetch":
        return `ouvrir l'adresse ${typeof args.url === "string" ? args.url.slice(0, 200) : "demandée"}`;
      case "websearch":
      case "codesearch":
        return `chercher sur internet « ${typeof args.requete === "string" ? args.requete.slice(0, 120) : ""} »`;
      case "read":
        return `lire ${ou}`;
      case "glob":
      case "grep":
      case "list":
        return `chercher dans ${ou}`;
      default:
        return `utiliser son outil « ${nom} »${cible ? ` sur ${ou}` : ""}`;
    }
  }

  if (outil.startsWith("bureau__")) {
    const nom = outil.slice("bureau__".length);
    /*
     * L'instance complète l'extension absente (bureau.ts, `cheminSur`) : la
     * carte nommait « rapport » un fichier qui s'écrira « rapport.docx ».
     */
    const ext = ({ creer_document: ".docx", creer_classeur: ".xlsx", creer_presentation: ".pptx", creer_pdf: ".pdf" } as Record<string, string>)[nom];
    const brut = typeof args.chemin === "string" ? args.chemin : "";
    const fichier = texteOu(ext && brut && !brut.toLowerCase().endsWith(ext) ? brut + ext : brut, "un fichier");
    switch (nom) {
      case "creer_document":
        return `créer le document Word ${fichier}`;
      case "creer_classeur":
        return `créer le classeur Excel ${fichier}`;
      case "creer_presentation":
        return `créer la présentation ${fichier}`;
      case "creer_pdf":
        return `créer le PDF ${fichier}`;
      case "lire_document":
        return `lire le document ${fichier}`;
      default:
        return `utiliser l'outil bureautique « ${nom} » sur ${fichier}`;
    }
  }

  if (outil.startsWith("courrier__")) {
    const nom = outil.slice("courrier__".length);
    if (nom === "derniers") return "consulter les derniers messages de votre boîte";
    if (nom === "chercher") return "chercher des messages dans votre boîte";
    if (nom === "lire") return "ouvrir un message de votre boîte";
    if (nom === "brouillon") {
      const objet = typeof args.objet === "string" && args.objet.trim() ? ` « ${args.objet.trim().slice(0, 80)} »` : "";
      const pour = typeof args.a === "string" && args.a.trim() ? ` pour ${args.a.trim().slice(0, 120)}` : args.en_reponse_a ? " en réponse à un message" : "";
      return `préparer le brouillon${objet}${pour} dans votre boîte (il ne sera pas envoyé)`;
    }
    if (nom === "envoyer") {
      const objet = typeof args.objet === "string" && args.objet.trim() ? ` « ${args.objet.trim().slice(0, 80)} »` : "";
      const pour = typeof args.a === "string" && args.a.trim() ? ` à ${args.a.trim().slice(0, 120)}` : "";
      return `envoyer le mail${objet}${pour} depuis votre boîte`;
    }
    return "utiliser votre messagerie";
  }

  if (outil.startsWith("agenda__")) {
    const nom = outil.slice("agenda__".length);
    const titre = typeof args.titre === "string" && args.titre.trim() ? ` « ${args.titre.trim().slice(0, 80)} »` : "";
    const quandTexte = typeof args.debut === "string" && args.debut.trim() ? ` le ${args.debut.trim().replace("T", " à ").slice(0, 20)}` : "";
    const ou = typeof args.calendrier === "string" && args.calendrier.trim() ? ` dans l'agenda « ${args.calendrier.trim().slice(0, 60)} »` : " dans votre agenda Google";
    if (nom === "prochains" || nom === "jour" || nom === "chercher") return "consulter votre agenda";
    if (nom === "creer") return `ajouter l'événement${titre}${quandTexte}${ou} (personne n'est invité)`;
    if (nom === "modifier") return `modifier un événement${ou}${titre ? ` : nouveau titre${titre}` : ""}${quandTexte ? ` ; nouvelle date${quandTexte}` : ""}`;
    if (nom === "supprimer") return `supprimer définitivement un événement${ou}`;
    return "utiliser votre agenda";
  }

  if (outil === "taches__lister") return "consulter vos tâches programmées";
  if (outil === "taches__programmer") {
    const titre = typeof args.titre === "string" && args.titre.trim() ? ` « ${args.titre.trim().slice(0, 80)} »` : "";
    const rythme = ({ "chaque-jour": "chaque jour", "jours-ouvres": "du lundi au vendredi", "chaque-semaine": "chaque semaine", "chaque-mois": "chaque mois" } as Record<string, string>)[String(args.rythme)] ?? "régulièrement";
    const heure = typeof args.heure === "string" ? ` à ${args.heure.slice(0, 5)}` : "";
    // La consigne entière : c'est elle qui tournera seule, chaque fois (la carte la montre aussi dans son détail).
    const consigne = typeof args.consigne === "string" && args.consigne.trim() ? ` : « ${args.consigne.trim()} »` : "";
    const agent = typeof args.agent === "string" && args.agent.trim() ? ` par l'agent « ${args.agent.trim().slice(0, 60)} »` : "";
    return `programmer la tâche${titre}, ${rythme}${heure}, exécutée seule${agent} avec vos outils${consigne}`;
  }
  if (outil === "web__chercher") return `chercher sur le web « ${texteOu(args.requete, "")} »`;
  if (outil === "web__lire") return `lire la page ${texteOu(args.adresse, "web")}`;
  if (outil === "controle__site_web") return `contrôler le code web du dossier ${texteOu(args.dossier, "de travail")}`;
  if (outil === "bibliotheque__chercher") return "chercher des documents dans la bibliothèque de l'équipe";
  if (outil === "bibliotheque__lire") return "lire un document de la bibliothèque de l'équipe";
  if (outil === "reunions__chercher") return "chercher parmi les réunions transcrites";
  if (outil === "connaissances__chercher") return "chercher dans les bases de connaissances de l'équipe";
  if (outil === "reunions__lire") return "lire le compte rendu et la transcription d'une réunion";

  // Au niveau « Demander pour tout », les lectures de Drive et de Slack passent ici.
  if (DRIVE_LECTURE.has(outil)) {
    if (outil === "drive__lire") return "lire un fichier de votre Google Drive";
    if (outil === "drive__chercher") return "chercher des fichiers dans votre Google Drive";
    return "consulter la liste des fichiers de votre Google Drive";
  }
  if (SLACK_LECTURE.has(outil)) {
    const salon = typeof args.salon === "string" && args.salon ? ` #${args.salon.replace(/^#/, "").slice(0, 80)}` : "";
    if (outil === "slack__salons") return "consulter la liste des salons Slack lisibles";
    if (outil === "slack__chercher") return `chercher des messages dans Slack${salon ? `, salon${salon}` : ""}`;
    return `lire les messages du salon Slack${salon || " demandé"}`;
  }

  const natif = resumeNatif(outil, args);
  if (natif) return natif;
  const palmier = resumePalmier(outil, args);
  if (palmier) return palmier;
  const creation = resumeRoblox(outil, args) ?? resumeBlender(outil, args) ?? resumeUnreal(outil, args);
  if (creation) return creation;

  /*
   * Outil d'un connecteur ajouté. On ne sait pas ce qu'il fait, mais on sait
   * d'où il vient, et c'est ce qui compte pour décider : « utiliser l'outil
   * API-post-page du connecteur notion » se comprend, là où la phrase de repli
   * du serveur de fichiers annonçait une action « sur un emplacement non
   * précisé », c'est-à-dire rien.
   */
  const prefixe = outil.indexOf("__");
  if (prefixe > 0 && outil.slice(0, prefixe) !== "fichiers") {
    const id = outil.slice(0, prefixe);
    const nom = registreNoms().fn?.(id) || id;
    return `utiliser l'outil « ${outil.slice(prefixe + 2)} » du connecteur « ${nom} »`;
  }

  const separateur = outil.indexOf("__");
  const nom = separateur === -1 ? outil : outil.slice(separateur + 2);

  switch (nom) {
    case "write_file":
      return `écrire dans ${ou}`;
    case "edit_file":
      return `modifier ${ou}`;
    case "create_directory":
      return `créer le dossier ${ou}`;
    case "move_file":
      return `déplacer ${ou} vers ${texteOu(args.destination, "un autre emplacement")}`;
    case "read_file":
    case "read_text_file":
      return `lire ${ou}`;
    case "read_media_file":
      return `ouvrir l'image ${ou}`;
    case "read_multiple_files": {
      const liste = args.paths;
      const combien = Array.isArray(liste) ? liste.length : 0;
      return combien > 1 ? `lire ${combien} fichiers, dont ${ou}` : `lire ${ou}`;
    }
    case "list_directory":
    case "list_directory_with_sizes":
      return `lister le contenu de ${ou}`;
    case "directory_tree":
      return `parcourir l'arborescence de ${ou}`;
    case "search_files":
      return `chercher des fichiers dans ${ou}`;
    case "get_file_info":
      return `consulter les informations de ${ou}`;
    case "list_allowed_directories":
      return "lister les dossiers auxquels il a accès";
    default:
      return `utiliser l'outil « ${nom} » sur ${ou}`;
  }
}

/**
 * Les cartes des connexions natives (outilsNatifs.ts). Le texte entier part
 * aussi dans le détail de la carte (`arguments`) : la phrase n'en montre que
 * le début, la carte le montre tel qu'il sera publié.
 */
function resumeNatif(outil: string, args: Record<string, unknown>): string | null {
  const projet = resumeProjet(outil, args);
  if (projet) return projet;
  const microsoft = resumeMicrosoft(outil, args);
  if (microsoft) return microsoft;
  const extrait = (v: unknown, n = 120) => {
    const s = typeof v === "string" ? v.trim().replace(/\s+/g, " ") : "";
    return s ? ` « ${s.slice(0, n)}${s.length > n ? " …" : ""} »` : "";
  };
  const page = typeof args.page === "string" && args.page.trim() ? ` « ${args.page.trim().slice(0, 80)} »` : "";
  switch (outil) {
    case "sheets__lire":
      return "lire une feuille Google Sheets";
    case "sheets__ecrire": {
      const n = Array.isArray(args.valeurs) ? args.valeurs.length : 0;
      return `écrire ${n} ligne(s) dans la feuille Google Sheets, plage ${typeof args.plage === "string" ? args.plage.slice(0, 80) : "?"}, en remplaçant ce qui s'y trouve`;
    }
    case "sheets__ajouter_lignes": {
      const n = Array.isArray(args.valeurs) ? args.valeurs.length : 0;
      return `ajouter ${n} ligne(s) à la feuille Google Sheets${typeof args.plage === "string" ? `, onglet ${args.plage.slice(0, 80)}` : ""}`;
    }
    case "slides__lire":
      return "lire une présentation Google Slides";
    case "youtube__chaine":
    case "youtube__videos":
      return "consulter une chaîne YouTube et ses statistiques";
    case "linkedin__profil":
    case "linkedin__pages":
    case "linkedin__publications":
    case "linkedin__statistiques":
      return "consulter LinkedIn";
    case "linkedin__publier":
      return `publier sur LinkedIn, au nom du profil connecté, le post${extrait(args.texte)} (une publication ne se reprend pas)`;
    case "linkedin__publier_page":
      return `publier sur LinkedIn, au nom de la page${page || " ?"}, le post${extrait(args.texte)} (une publication ne se reprend pas)`;
    case "facebook__pages":
    case "facebook__publications":
      return "consulter les pages Facebook";
    case "facebook__publier":
      return `publier sur la page Facebook${page} le post${extrait(args.message)}${typeof args.lien === "string" && args.lien ? `, avec le lien ${args.lien.slice(0, 200)}` : ""} (une publication ne se reprend pas)`;
    case "instagram__compte":
    case "instagram__publications":
    case "instagram__statistiques":
      return "consulter le compte Instagram";
    case "instagram__publier":
      return `publier sur Instagram la photo ${typeof args.image === "string" ? args.image.slice(0, 200) : "?"}${args.legende ? `, légende${extrait(args.legende)}` : ""} (une publication ne se reprend pas)`;
    case "tiktok__profil":
    case "tiktok__videos":
      return "consulter le compte TikTok";
    case "tiktok__publier_video":
      return `publier sur TikTok la vidéo ${typeof args.fichier === "string" ? abreger(args.fichier).slice(0, 200) : "?"}${extrait(args.titre)}, visibilité ${typeof args.confidentialite === "string" ? args.confidentialite : "SELF_ONLY (moi seul)"}`;
    case "x__profil":
    case "x__publications":
      return "consulter le compte X";
    case "telegram__conversations":
    case "telegram__messages":
      return "lire les messages reçus par le bot Telegram";
    case "discord__salons":
    case "discord__messages":
      return "lire les messages d'un salon Discord";
    case "whatsapp__conversations":
    case "whatsapp__messages":
    case "whatsapp__modeles":
      return "consulter les messages et modèles WhatsApp";
    case "telegram__envoyer":
    case "discord__envoyer":
    case "whatsapp__envoyer":
    case "whatsapp__envoyer_modele": {
      const a = apercuMessagerie?.(outil, args);
      const vers = a?.destinataire ?? String(args.conversation ?? args.salon ?? args.numero ?? "?").slice(0, 60);
      if (outil === "whatsapp__envoyer_modele") {
        return `envoyer sur WhatsApp à ${vers} le modèle « ${String(args.modele ?? "?").slice(0, 80)} » (${a?.fenetre ?? "fenêtre de 24 h inconnue"} ; Meta facture chaque modèle délivré) : « ${(a?.texteFinal ?? "?").replace(/\s+/g, " ").slice(0, 120)} » (un message envoyé ne se reprend pas)`;
      }
      return `envoyer à ${vers}${a?.fenetre ? ` (${a.fenetre})` : ""} le message${extrait(args.texte)} (un message envoyé ne se reprend pas)`;
    }
    case "x__publier": {
      // Une adresse dans le post : X le facture plus cher (0,20 $ au lieu de 0,015 $, tarifs du 20/04/2026) ; la carte le dit.
      const lien = typeof args.texte === "string" && /https?:\/\/|www\./i.test(args.texte);
      return `publier sur X, au nom du compte connecté, le post${extrait(args.texte)}${typeof args.image === "string" && args.image ? `, avec l'image ${abreger(args.image).slice(0, 200)}` : ""}${lien ? " (il contient une adresse, que X facture plus cher)" : ""} (une publication ne se reprend pas)`;
    }
    // Google Docs, Google Forms, Dropbox (natifs/documents.ts) : la carte dit où, et le détail montre le texte entier.
    case "docs__lire":
      return "lire un document Google Docs";
    case "docs__creer":
      return `créer dans le Google Docs du compte connecté le document « ${typeof args.titre === "string" ? args.titre.trim().slice(0, 150) : "?"} »${extrait(args.texte) ? `, avec le texte${extrait(args.texte)}` : ", vide"}`;
    case "docs__ajouter_texte":
      return `ajouter à la fin du document Google Docs ${typeof args.document === "string" ? args.document.trim().slice(0, 200) : "?"} le texte${extrait(args.texte)} (le reste du document n'est pas touché)`;
    case "forms__lire":
    case "forms__reponses":
      return "lire un formulaire Google Forms et ses réponses";
    case "dropbox__lister":
    case "dropbox__chercher":
    case "dropbox__lire":
      return "consulter le Dropbox connecté";
    case "dropbox__envoyer":
      return `envoyer vers le Dropbox connecté le fichier ${typeof args.fichier === "string" ? abreger(args.fichier).slice(0, 200) : "?"} du dossier de travail, dans le dossier ${typeof args.dossier === "string" && args.dossier.trim() ? args.dossier.trim().slice(0, 200) : "racine"} (un fichier du même nom n'est jamais remplacé)`;
  }
  return resumeCommerce(outil, args);
}

/* ------------------------------------------------------------------ */
/* Noyau : file d'attente, évènements, expiration                      */
/* ------------------------------------------------------------------ */

export type Nature = "ecran" | "outil";

export interface Demande {
  id: string;
  nature: Nature;
  /** Ce que l'agent veut faire, en français courant. */
  resume: string;
  /** Contexte pour l'interface et le journal. Jamais de contenu de fichier. */
  detail: Record<string, unknown>;
  createdAt: number;
  /**
   * Compte au nom duquel l'action est demandée.
   *
   * C'est **lui seul** qui voit la demande et qui y répond. Sans ce champ, la
   * file était commune : n'importe quelle séance de l'instance lisait le corps
   * entier d'un mail qu'un agent s'apprêtait à envoyer pour un collègue, et
   * pouvait répondre « oui » à sa place. Une approbation n'a de sens que si
   * c'est la personne concernée qui l'accorde.
   *
   * Absent pour une demande qui n'a pas de compte identifiable (essai depuis
   * un poste sans séance) : elle reste alors visible de toute séance, faute de
   * quelqu'un à qui la réserver.
   */
  pour?: string;
  /** Charge propre au contrôle d'écran, relayée telle quelle à l'interface. */
  action?: unknown;
}

export interface Evenement {
  type: string;
  [k: string]: unknown;
}

/** Issue d'une demande. L'expiration n'est pas un refus : on le dit autrement. */
export type Issue = "accord" | "refus" | "expiration";

/**
 * Issue et auteur de la réponse. Sans l'auteur, le journal consignait comme
 * « approuvé par » la personne qui avait **demandé** : sur une instance
 * partagée, impossible de dire qui avait réellement dit oui.
 */
export interface Reponse {
  issue: Issue;
  /** Compte qui a répondu ; absent si personne n'a répondu à temps. */
  par?: string;
}

/**
 * Deux minutes, comme le contrôle de l'écran.
 *
 * Assez pour revenir d'une autre fenêtre, trop court pour qu'une demande
 * oubliée laisse une tâche suspendue toute la nuit. Sans réponse, l'action
 * n'est pas faite.
 */
export const DELAI = 120_000;

interface Attente {
  demande: Demande;
  resoudre: (reponse: Reponse) => void;
}

const attentes = new Map<string, Attente>();
const abonnes = new Set<(evenement: Evenement) => void>();

export function surEvenement(fn: (evenement: Evenement) => void): () => void {
  abonnes.add(fn);
  return () => abonnes.delete(fn);
}

export function emettre(evenement: Evenement): void {
  for (const fn of abonnes) {
    try {
      fn(evenement);
    } catch {
      /* un abonné défaillant ne doit pas bloquer les autres */
    }
  }
}

/**
 * Demandes en attente, telles que `pour` a le droit de les voir.
 *
 * `pour` omis rend tout : réservé aux appels internes (journal, arrêt). Toute
 * route HTTP doit passer le compte de la séance.
 */
export function enAttente(nature?: Nature, pour?: string): Demande[] {
  return [...attentes.values()]
    .map((a) => a.demande)
    .filter((d) => nature === undefined || d.nature === nature)
    .filter((d) => pour === undefined || destineA(d, pour));
}

/** Cette demande concerne-t-elle ce compte ? */
export const destineA = (d: Demande, qui: string): boolean =>
  d.pour === undefined || d.pour === qui || d.pour === "agent";

/**
 * Réponse d'un humain.
 *
 * `nature` cloisonne les deux surfaces : la route du contrôle d'écran ne doit
 * pas pouvoir résoudre une demande d'outil, ni l'inverse.
 */
export function repondre(id: string, accord: boolean, nature: Nature, par: string): boolean {
  const attente = attentes.get(id);
  if (!attente) return false;
  if (attente.demande.nature !== nature) return false;
  /*
   * Et c'est la personne concernée qui répond, pas une autre. Le journal
   * nommait bien qui avait dit oui, mais il le nommait après coup : un
   * collègue pouvait autoriser l'envoi d'un mail préparé pour quelqu'un
   * d'autre. Une demande destinée à personne en particulier reste ouverte.
   */
  if (!destineA(attente.demande, par)) return false;

  attentes.delete(id);
  attente.resoudre({ issue: accord ? "accord" : "refus", par });
  emettre({ type: "approbation_resolue", id, accord, nature: attente.demande.nature });
  return true;
}

/**
 * Retire d'un texte ce qui peut tromper sur ce qu'on approuve : ESC et les
 * autres caractères de contrôle C0 et C1 (sauf retour à la ligne et
 * tabulation), et les caractères qui renversent l'ordre d'affichage
 * (U+202A–U+202E, U+2066–U+2069).
 *
 * Revue du 25/09/2026 : le résumé d'une carte, l'objet ou le corps d'un mail,
 * une commande, tous écrits par le modèle, arrivaient tels quels dans un
 * terminal (`helix`). Une séquence `\x1b[2K\r` y efface la ligne affichée et
 * en écrit une autre : on aurait approuvé autre chose que ce qu'on lisait.
 * Même règle dans la ligne de commande (`nettoyer`, cli/helix.mjs).
 */
export function nettoyer(texte: string): string {
  return texte.replace(/[\u0000-\u0008\u000B-\u001F\u007F-\u009F\u202A-\u202E\u2066-\u2069]/g, "");
}

/** `nettoyer`, appliqué à chaque texte d'un détail de carte, à toute profondeur. */
function nettoyerTout<T>(valeur: T, profondeur = 0): T {
  if (typeof valeur === "string") return nettoyer(valeur) as T;
  if (profondeur > 6 || valeur === null || typeof valeur !== "object") return valeur;
  if (Array.isArray(valeur)) return valeur.map((v) => nettoyerTout(v, profondeur + 1)) as T;
  return Object.fromEntries(Object.entries(valeur).map(([k, v]) => [k, nettoyerTout(v, profondeur + 1)])) as T;
}

/**
 * OpenCode a tranché lui-même (session arrêtée) : la carte disparaît, et la
 * demande se clôt comme une expiration (l'action n'est pas faite).
 */
export function annuler(id: string): void {
  const attente = attentes.get(id);
  if (!attente) return;
  attentes.delete(id);
  emettre({ type: "approbation_expiree", id, nature: attente.demande.nature });
  attente.resoudre({ issue: "expiration" });
}

/** Pose une demande et attend la réponse d'un humain. `surCarte` reçoit l'identifiant de la carte. */
export function demander(demande: Omit<Demande, "id" | "createdAt">, surCarte?: (id: string) => void): Promise<Reponse> {
  const id = `apr_${randomBytes(8).toString("base64url")}`;
  const complete: Demande = { ...nettoyerTout(demande), id, createdAt: Date.now() };
  surCarte?.(id);

  return new Promise<Reponse>((resoudre) => {
    attentes.set(id, { demande: complete, resoudre });
    emettre({ type: "approbation_demandee", ...complete });

    setTimeout(() => {
      if (attentes.delete(id)) {
        emettre({ type: "approbation_expiree", id, nature: complete.nature });
        resoudre({ issue: "expiration" });
      }
    }, DELAI).unref?.();
  });
}

/* ------------------------------------------------------------------ */
/* Portée d'une approbation                                            */
/* ------------------------------------------------------------------ */

/**
 * Le cas des tâches longues.
 *
 * Un plan découpé enchaîne vingt appels d'outils sur dix minutes. Demander
 * vingt fois, c'est obtenir vingt « oui » distraits puis l'abandon du réglage :
 * un garde-fou qu'on désactive ne garde rien.
 *
 * Une réponse vaut donc pour **les actions de même nature dans le même
 * dossier, jusqu'à la fin de la demande en cours**. Approuver l'écriture d'une
 * facture dans ~/Comptabilite couvre les suivantes du même lot ; écrire
 * ailleurs redemande. La mémoire meurt avec la requête HTTP : rien ne
 * survit d'une demande à l'autre, et surtout pas au redémarrage.
 *
 * Un refus se retient de la même façon. Sans cela, un agent qui insiste
 * reposerait vingt fois la question qu'on vient de refuser, et une absence de
 * réponse laisserait la tâche se cogner au délai d'expiration à chaque appel,
 * soit quarante minutes de blocage pour un utilisateur parti déjeuner.
 */
interface Souvenir {
  accord: boolean;
  /** Ce qui a produit la décision : une réponse, ou personne au bout. */
  issue: Issue;
}

const contextes = new Map<string, Map<string, Souvenir>>();

/** Ouvre la mémoire d'une demande. À refermer, sans faute, en `finally`. */
export function ouvrirDemande(): string {
  const id = `dem_${randomBytes(8).toString("base64url")}`;
  contextes.set(id, new Map());
  return id;
}

export function fermerDemande(id: string): void {
  contextes.delete(id);
}

/**
 * Les outils dont un accord peut couvrir un dossier : le serveur de fichiers
 * et l'atelier bureautique, qui écrivent vraiment à l'endroit de `path`. Les
 * autres (connecteurs, agenda, tâches, brouillons…) sont couverts appel par
 * appel, arguments compris. Revue de sécurité du 26/09/2026 : la clé ne
 * nommait pas l'outil, et tout outil acceptant un `path` qu'il ignore héritait
 * d'une écriture approuvée dans ce dossier (vérifié : une tâche programmée
 * créée sans carte après un fichier accordé) ; un appel d'un connecteur
 * approuvé couvrait aussi tous les suivants, quel que soit leur contenu.
 */
/*
 * Les modifications de fichiers de Helix Code aussi (relecture du 27/09/2026) :
 * sans elles, l'agent de code redemandait pour chaque fichier d'un même
 * dossier. Ses commandes et ses adresses, elles, gardent leur portée mot pour
 * mot (plus bas, avant ce test).
 */
const porteeParDossier = (outil: string) =>
  !outil.includes("__") || outil.startsWith(`${SERVEUR_FICHIERS}__`) || outil.startsWith("bureau__") || outil.startsWith("code__");

/**
 * Tous les chemins désignés, par tous les champs de chemin (un
 * `read_multiple_files` en porte plusieurs). Un champ que l'outil ignore
 * entre quand même dans la portée : il ne peut qu'ajouter un dossier à la clé,
 * donc faire redemander, jamais se substituer au vrai (voir `chemin`). Le
 * chemin que l'outil lit vient en tête.
 */
function chemins(args: Record<string, unknown>, outil = ""): string[] {
  const liste: string[] = [];
  const vrai = chemin(args, outil);
  if (vrai) liste.push(vrai);
  for (const cle of CLES_CHEMIN) {
    const v = args[cle];
    if (typeof v === "string" && v) liste.push(v);
    else if (Array.isArray(v)) liste.push(...v.filter((p): p is string => typeof p === "string" && p.length > 0));
  }
  return [...new Set(liste)];
}

/**
 * Le dossier où un déplacement dépose vraiment le fichier. Un `move_file`
 * vers un dossier existant y range le fichier (`adapterFichiers`, outils.ts) :
 * c'est ce dossier qui le reçoit, pas son parent. Test d'intrusion du
 * 27/09/2026 : la clé prenait le parent de « Archive » (le dossier de
 * travail), si bien qu'un accord pour « déplacer vers Archive » couvrait,
 * sans carte, un déplacement vers « Public » depuis le même dossier.
 */
/*
 * Le dossier de travail, donné par outils.ts (qui le tient de mcp.ts). Pas
 * d'import de mcp.ts ici : il fixe son dossier au chargement, et la barrière
 * est chargée seule par d'autres modules et par la batterie de sécurité.
 */
let espaceDeTravail: () => string = () => process.cwd();
export function definirEspaceDeTravail(fn: () => string): void {
  espaceDeTravail = fn;
}

function dossierDArrivee(destination: string): string {
  try {
    const cible = isAbsolute(destination) ? destination : resolve(espaceDeTravail(), destination);
    if (statSync(cible).isDirectory()) return cible;
  } catch {
    /* destination absente : un vrai renommage, son dossier est celui du chemin */
  }
  return dirname(destination);
}

/** Clé de portée : ce que couvre une réponse déjà donnée. */
function portee(outil: string, args: Record<string, unknown>, courant: Niveau): string {
  const cible = chemin(args, outil);
  /*
   * Sans chemin, l'outil lui-même est la portée : approuver un brouillon ne
   * doit pas couvrir l'outil d'un connecteur qui, lui non plus, n'a pas de
   * chemin. Pour un brouillon, le destinataire en fait partie.
   */
  /*
   * Une commande, une adresse, une recherche de l'agent de code : la portée
   * est la chose elle-même, mot pour mot. Approuver `npm test` ne doit pas
   * approuver `rm -rf .` au même endroit.
   */
  if (outil === "code__bash" || outil === "code__webfetch" || outil === "code__websearch" || outil === "code__codesearch") {
    return `${outil}|${String(args.commande ?? args.url ?? args.requete ?? "")}`;
  }
  if (!porteeParDossier(outil) || !cible) return `${outil}|${JSON.stringify(args)}`;
  // Plusieurs fichiers : tous leurs dossiers entrent dans la clé (le premier seul laissait passer les autres).
  const dossier = [...new Set(chemins(args, outil).map((c) => dirname(c)))].sort().join("+");

  /*
   * Un déplacement a deux extrémités. Autoriser « sortir un fichier de
   * ~/Comptabilite » ne dit rien de l'endroit où il atterrit : sans la
   * destination dans la clé, un second déplacement vers un tout autre dossier
   * passerait sur l'accord donné pour le premier.
   */
  const vers =
    typeof args.destination === "string" && args.destination
      ? `>${dossierDArrivee(args.destination)}`
      : "";

  /*
   * Au niveau « Demander pour tout », la portée est plus serrée : approuver une
   * lecture ne doit pas approuver une écriture. Au niveau « Demander avant de
   * modifier », seules les modifications passent ici : les regrouper par
   * dossier est précisément ce qui rend un lot de fichiers supportable.
   */
  return courant === "chaque" ? `${outil}|${dossier}${vers}` : `ecriture|${dossier}${vers}`;
}

/* ------------------------------------------------------------------ */
/* La barrière                                                         */
/* ------------------------------------------------------------------ */

/** Les arguments tels que l'outil les recevra, lisibles, et dits tronqués quand ils le sont. */
function argumentsLisibles(args: Record<string, unknown>, MAX = 8000): string {
  const texte = JSON.stringify(args, null, 2) ?? "{}";
  return texte.length > MAX ? `${texte.slice(0, MAX)}\n… (${texte.length - MAX} caractères de plus, non montrés)` : texte;
}

/**
 * Ce qu'une carte d'écriture native (un post, des cellules) montre au plus.
 * La carte le montre entier (zone qui défile, ToolApproval.tsx) ; au-delà,
 * l'appel est refusé sans carte.
 *
 * Tournée du 28/09/2026 (SECURITE.md § 41) : la carte coupait à 8 000
 * caractères, alors qu'un post Facebook en accepte 60 000 et une écriture
 * Sheets 10 000 cellules. Essayé : la fin d'un post de 10 000 caractères
 * n'était pas sur la carte, et partait avec l'accord. Un post ne se reprend
 * pas : on n'accepte que ce qu'on a pu lire en entier.
 */
const CARTE_NATIVE_MAX = 100_000;

/**
 * `parLaPersonne` : le refus vient d'elle (ou de son silence), pas d'une règle.
 * La boucle de travail ne réessaie pas une action que la personne a refusée.
 */
export type Verdict = { autorise: true } | { autorise: false; message: string; parLaPersonne?: boolean };

/** Formats binaires qu'un outil de texte ne sait pas produire. */
const FORMATS_BUREAU = /\.(docx|xlsx|pptx|pdf|doc|xls|ppt|odt|ods|odp)$/i;

/**
 * Un « document Word » écrit par l'outil de fichiers n'en est pas un.
 *
 * `write_file` écrit du texte brut. Un modèle qui n'a pas les outils
 * bureautiques (atelier non préparé) produisait ainsi un « rapport.docx » fait
 * de texte, que Word refuse d'ouvrir, et l'annonçait comme fait ; la personne
 * devait même l'approuver. Mesuré le 23/09/2026 avec qwen3-8b, consignes
 * contraires comprises : les consignes ne suffisent pas, d'où ce contrôle,
 * posé au seul point de passage de tous les appels d'outils.
 */
function fauxDocument(outil: string, args: Record<string, unknown>): string | null {
  // Un nom sans préfixe désigne déjà le serveur de fichiers (voir `modifie`).
  if (outil.includes("__") && !outil.startsWith(`${SERVEUR_FICHIERS}__`)) return null;
  const nom = outil.includes("__") ? outil.slice(outil.indexOf("__") + 2) : outil;
  if (nom !== "write_file" && nom !== "edit_file") return null;
  const cible = typeof args.path === "string" ? args.path : "";
  if (!FORMATS_BUREAU.test(cible)) return null;
  return (
    `Refusé : ${cible} est un format bureautique binaire, et l'outil de fichiers n'écrit que du texte brut. ` +
    "Le fichier obtenu ne s'ouvrirait pas. Utilise les outils « bureau__… » s'ils te sont proposés ; " +
    "sinon, dis à l'utilisateur que l'atelier bureautique n'est pas préparé (panneau de droite de Cowork) " +
    "et propose un fichier .md ou .txt à la place."
  );
}

/** Ce que reçoit le modèle quand l'action ne part pas. Il doit pouvoir enchaîner. */
function messageDeRefus(resume: string, issue: Issue, couvert: boolean): string {
  const base =
    issue === "expiration"
      ? `Personne n'a répondu à temps à la demande d'approbation pour ${resume} : ` +
        "l'action n'a pas été faite."
      : `L'utilisateur a refusé que tu puisses ${resume}. L'action n'a pas été faite.`;

  const etendue = couvert
    ? " Ce refus vaut pour les actions de même nature au même endroit, jusqu'à la fin de cette demande."
    : "";

  return (
    `${base}${etendue} Ne la retente pas à l'identique, ni sous un autre nom au même endroit. ` +
    "Poursuis avec ce que tu peux faire sans elle, et dis clairement à l'utilisateur ce qui n'a " +
    // Le modèle racontait « le système refuse toute écriture, vérifiez vos autorisations » :
    // la personne, qui venait de cliquer « Refuser », lisait une panne qui n'existait pas.
    "pas pu être fait et pourquoi : ce n'est ni une panne ni un problème de droits d'accès."
  );
}

/**
 * Point de passage obligé de tout appel d'outil de la boucle de conversation.
 *
 * Appelée depuis `chat.ts`, le seul endroit d'où les outils de fichiers, de
 * bureautique et de courrier sont exécutés. Un client qui appelle la route de
 * conversation en direct avec `tools: true` passe par la même boucle : il n'y a
 * pas de porte dérobée à côté.
 */
export async function verifierOutil(
  contexte: string | null,
  outil: string,
  args: Record<string, unknown>,
  qui: string,
  /** Nom de l'employé OpenClaw qui demande, pour que la carte dise qui veut agir. */
  employe?: string,
  /** Demander quoi qu'il arrive (un agent qui traite un mail reçu, voir serveurOutils.ts). */
  forcer = false,
  /** D'où vient l'action, dit par la carte (la ligne de commande l'affiche) : l'employé se déduit de `employe`. */
  surface: "chat" | "code" = "chat",
  /** Reçoit l'identifiant de la carte, si une carte est posée (permissionsCode.ts, pour la retirer). */
  surCarte?: (id: string) => void,
  /**
   * La tâche programmée qui fait l'appel : sa carte le dit, pour qu'on ne la
   * prenne pas pour une demande du Chat qu'on a sous les yeux.
   */
  tacheEnCours?: string,
): Promise<Verdict> {
  const origine = employe ? "employe" : surface;
  /*
   * Les actions d'écran gardent leur propre barrière, dans computer.ts : elle
   * connaît la différence entre une capture et un clic, et sait convertir les
   * coordonnées. Redemander ici produirait deux fenêtres pour un seul clic.
   */
  if (outil.startsWith("ecran__")) return { autorise: true };

  // Avant tout niveau et toute carte : on ne fait pas approuver un fichier voué à être illisible.
  const faux = fauxDocument(outil, args);
  if (faux) return { autorise: false, message: faux };

  const courant = niveau();
  if (ENVOI.has(outil)) {
    if (!forcer && !demandeToujours(outil) && courant === "tout") return { autorise: true };
    return verifierEnvoi(contexte, outil, args, qui, courant, employe, origine);
  }
  const toujours = toujoursConfirmer(outil) || confirmerSelonArguments(outil, args);
  // Les écritures des serveurs MCP de la famille « projets » : même carte, arguments entiers (SECURITE.md § 48).
  // Et celles de Palmier Pro : arguments montrés en entier, ou refusés s'ils ne tiennent pas sur la carte.
  // De même pour Roblox Studio et Blender : le code à exécuter se lit en entier sur la carte.
  const native = ECRITURES_NATIVES.has(outil) || estEcritureMcpProjet(outil) || estEcritureApplication(outil) || confirmerSelonArguments(outil, args);
  /*
   * Brevo et Mailchimp : la carte d'une campagne est préparée par projets.ts
   * (campagne relue chez le service, destinataires comptés). Sans cet aperçu,
   * rien ne part : la barrière chargée seule refuse, elle ne devine pas.
   */
  let apercu: { resume: string; affiche: string; empreinte?: string } | null = null;
  if (APERCU_REQUIS.has(outil)) {
    const apercuNatif = registreApercu().fn;
    const a = apercuNatif ? await apercuNatif(outil, args).catch((err: unknown) => ({ refus: err instanceof Error ? err.message : String(err) })) : { refus: "Refusé : la carte de cette campagne n'a pas pu être préparée. Rien n'a été fait." };
    if ("refus" in a) return { autorise: false, message: a.refus };
    if (a.affiche.length > CARTE_NATIVE_MAX) return { autorise: false, message: "Refusé sans rien demander : cette campagne est trop longue pour être montrée en entier sur la carte d'accord, et rien ne part sans avoir été lu en entier. Dis-le à l'utilisateur." };
    apercu = a;
  }
  if (native && (JSON.stringify(args, null, 2) ?? "").length > CARTE_NATIVE_MAX) {
    return {
      autorise: false,
      message:
        "Refusé sans rien demander : ce contenu est trop long pour être montré en entier sur la carte d'accord, et rien ne part sans avoir été lu en entier. " +
        "Écris-en moins à la fois (un post plus court, moins de lignes), et dis-le à l'utilisateur.",
    };
  }
  /*
   * « Tout approuver » vaut pour ce que l'entreprise demande elle-même, pas
   * pour ce qu'un texte venu du dehors fait faire : `forcer` traverse le
   * niveau. C'est le cas d'un agent déclenché par un mail reçu (serveurOutils.ts).
   */
  if (!toujours && courant === "tout" && !forcer) return { autorise: true };
  if (!toujours && courant === "modifications" && !modifie(outil)) return { autorise: true };

  let resume = apercu?.resume ?? resumerOutil(outil, args);
  // Une réponse se juge à ce qu'elle répond : la carte nomme l'expéditeur et l'objet du message.
  if (outil === "courrier__brouillon" && !args.a && args.en_reponse_a) {
    const origine = await presenterMessage(Math.trunc(Number(args.en_reponse_a)), typeof args.dossier === "string" && args.dossier ? args.dossier : undefined);
    if (origine) resume = `préparer une réponse à ${origine} dans votre boîte (elle ne sera pas envoyée)`;
  }
  const cle = portee(outil, args, courant);
  const memoire = contexte ? contextes.get(contexte) : undefined;

  const deja = memoire?.get(cle);
  // Un accord « toujours confirmé » ne se réutilise pas ; un refus, si : on ne repose pas la question qu'on vient de refuser.
  if (deja && !(toujours && deja.accord)) {
    return deja.accord
      ? { autorise: true }
      : { autorise: false, message: messageDeRefus(resume, deja.issue, true), parLaPersonne: true };
  }

  // Le journal dit ce que l'agent a voulu toucher, jamais ce qu'il y a dedans.
  journaliser("outil.demande", qui, { outil, cible: chemin(args, outil), niveau: courant, ...(employe ? { employe } : {}) });

  const { issue, par } = await demander(
    {
      nature: "outil",
      resume,
      pour: qui,
      detail: {
        outil,
        cible: chemin(args, outil),
        // Où un déplacement dépose le fichier : l'écran le montre hors du français, où il ne lit pas `resume`.
        ...(typeof args.destination === "string" && args.destination ? { destination: args.destination } : {}),
        niveau: courant,
        portee: cle,
        surface: origine,
        // Une commande se juge entière : la carte la montre telle qu'elle partira.
        ...(typeof args.commande === "string" ? { commande: args.commande } : {}),
        ...(typeof args.url === "string" ? { url: args.url } : {}),
        ...(employe ? { employe } : {}),
        // Ce que l'accord couvre : cet appel seul, ou les suivants au même endroit.
        // Une commande, une adresse, un appel sans chemin : mot pour mot, la carte ne promet pas plus (revue du 27/09/2026).
        unique: toujours || !porteeParDossier(outil) || !chemin(args, outil) || ["code__bash", "code__webfetch", "code__websearch", "code__codesearch"].includes(outil),
        ...(chemins(args, outil).length > 1 ? { cibles: chemins(args, outil).slice(0, 50) } : {}),
        /*
         * Hors fichiers, la carte montre ce que l'outil recevra (un connecteur,
         * un événement, une tâche) : le nom de l'outil ne dit pas ce qui part.
         */
        ...(!porteeParDossier(outil) && !outil.startsWith("code__") ? { arguments: apercu?.affiche ?? argumentsLisibles(args, native ? CARTE_NATIVE_MAX : undefined) } : {}),
        // Messageries : le destinataire résolu, et le texte final d'un modèle WhatsApp, dans toutes les langues de l'écran.
        ...(() => {
          const a = native ? apercuMessagerie?.(outil, args) : null;
          return a ? { destinataire: a.destinataire, ...(a.texteFinal ? { texteFinal: a.texteFinal } : {}) } : {};
        })(),
        ...(tacheEnCours ? { tache: tacheEnCours } : {}),
        // Ce qui sort de la machine (une génération chez Palmier…) : la carte le dit dans la langue de l'écran.
        ...(() => {
          const dehors = horsMachinePalmier(outil) ?? horsMachineRoblox(outil) ?? horsMachineBlender(outil);
          return dehors ? { horsMachine: dehors } : {};
        })(),
      },
    },
    surCarte,
  );

  const accord = issue === "accord";
  if (!(toujours && accord)) memoire?.set(cle, { accord, issue });
  if (accord && apercu?.empreinte) apercusAccordes.set(args, apercu.empreinte);

  // L'entrée est au nom de qui a répondu ; la personne pour qui l'agent
  // travaillait figure dans le détail. Sans réponse, personne n'a décidé.
  journaliser(accord ? "outil.approuve" : "outil.refuse", par ?? "personne", {
    outil,
    cible: chemin(args, outil),
    issue,
    pour: qui,
  });

  return accord
    ? { autorise: true }
    : { autorise: false, message: messageDeRefus(resume, issue, Boolean(memoire)), parLaPersonne: true };
}

/**
 * Envoi d'un mail : la carte montre le mail tel qu'il partira (destinataires
 * résolus, objet, texte entier), et chaque envoi redemande.
 *
 * Un refus se retient pour ce mail précis, à l'identique : un agent qui
 * insiste ne repose pas la question qu'on vient de refuser. Un autre texte ou
 * d'autres destinataires font un autre mail, donc une autre question.
 */
async function verifierEnvoi(
  contexte: string | null,
  outil: string,
  args: Record<string, unknown>,
  qui: string,
  courant: Niveau,
  employe?: string,
  origine: string = "chat",
): Promise<Verdict> {
  const prepare = await apercuEnvoi(args);
  // Un mail qu'on ne sait pas composer n'est pas soumis : le modèle lit pourquoi et corrige.
  if (!prepare.ok) return { autorise: false, message: prepare.content };
  const { apercu } = prepare;
  const resume = `${apercu.enReponse ? "envoyer une réponse" : "envoyer un mail"} à ${apercu.a.slice(0, 200)}, objet « ${apercu.objet.slice(0, 120)} »`;

  const cle = `${outil}|${JSON.stringify([apercu.a, apercu.cc, apercu.objet, apercu.corps])}`;
  const memoire = contexte ? contextes.get(contexte) : undefined;
  const deja = memoire?.get(cle);
  if (deja && !deja.accord) return { autorise: false, message: messageDeRefus(resume, deja.issue, false), parLaPersonne: true };

  // Ni adresses ni texte au journal : il dit qu'un envoi a été soumis, pas à qui ni quoi.
  journaliser("outil.demande", qui, { outil, niveau: courant });
  const { issue, par } = await demander({
    nature: "outil",
    resume,
    pour: qui,
    detail: { outil, niveau: courant, envoi: apercu, surface: origine, ...(employe ? { employe } : {}) },
  });
  const accord = issue === "accord";
  if (!accord) memoire?.set(cle, { accord, issue });
  journaliser(accord ? "outil.approuve" : "outil.refuse", par ?? "personne", { outil, issue, pour: qui });
  return accord ? { autorise: true } : { autorise: false, message: messageDeRefus(resume, issue, false), parLaPersonne: true };
}
