import { execFileSync } from "node:child_process";
import { homedir } from "node:os";
import { delimiter, join, dirname } from "node:path";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import {
  StdioClientTransport,
  getDefaultEnvironment,
} from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport, StreamableHTTPError } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { UnauthorizedError } from "@modelcontextprotocol/sdk/client/auth.js";
import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { deployment } from "./deployment.ts";
import { lister, t, tf } from "./langue.ts";
import { cheminProtegeDans, filtrerResultat } from "./zonesProtegees.ts";
import { assurerNodePrive, DEPENDANCES_NPM_AVANT, nodePriveInstallable, npxPrive } from "./installationOpenClaw.ts";
import { retenirOutils } from "./natifs/projetsRegles.ts";
import { arreterPidArbre } from "./processus.ts";
import { interne } from "./sortieReseau.ts";

/**
 * Gestionnaire de serveurs MCP auto-hébergés (ARCHITECTURE.md, ADR-004).
 *
 * Les serveurs tournent en local, lancés par la passerelle, et communiquent en
 * JSON-RPC sur stdio. Aucune donnée ne transite par un service tiers.
 */

export interface McpServerConfig {
  id: string;
  label: string;
  description: string;
  /**
   * Commande à exécuter, pour un serveur qui tourne sur cette machine.
   * Absente pour un serveur distant, qui a une `url` à la place.
   */
  command?: string;
  args?: string[];
  /**
   * Adresse d'un serveur MCP **distant**, en HTTP (transport « streamable »).
   *
   * C'est ce que publient les services qui offrent un branchement en un clic :
   * rien à installer sur la machine du client, et l'autorisation se fait dans
   * le navigateur de la personne (voir oauthMcp.ts). HTTPS exigé : un jeton
   * d'accès part à chaque appel. En http, seulement avec `local` ci-dessous.
   */
  url?: string;
  /** Fournisseur d'autorisation OAuth, pour un serveur distant qui en demande. */
  auth?: unknown;
  /**
   * Serveur d'une application ouverte sur cette machine, en HTTP sur la boucle
   * (Palmier Pro, 29/09/2026) : `url` doit être `http://127.0.0.1:<port>/…`,
   * ce port et aucun autre, et `reconnaitre` est appelé avant **chaque**
   * requête (connexion, liste d'outils, appel) : il rend la raison d'un refus
   * quand le programme à l'écoute n'est pas l'application attendue, et rien
   * n'est alors envoyé. Posé par le catalogue (connecteurs.ts), jamais par une
   * requête.
   */
  local?: { port: number; reconnaitre: () => Promise<string | null> };
  /**
   * Serveur stdio d'une application de cette machine (Roblox Studio, Blender,
   * 12/10/2026) : `avantLancement` est appelé avant de lancer la commande, et
   * `avantAppel` avant **chaque** appel d'outil ; chacun rend la raison d'un
   * refus (l'application introuvable, fermée, un autre programme sur le port
   * de Blender…), et rien n'est alors lancé ni envoyé. Posés par le catalogue
   * (connecteurs.ts), jamais par une requête.
   */
  avantLancement?: () => Promise<string | null>;
  avantAppel?: () => Promise<string | null>;
  /**
   * Un appel à la fois vers ce serveur (16/10/2026) : Unreal Editor exécute
   * ses outils un par un sur le fil du jeu et demande qu'on ne les superpose
   * pas ; le serveur de Blender bloque sa boucle sur chaque commande. La
   * vérification `avantAppel` fait partie du tour : elle ne croise jamais un
   * appel en cours.
   */
  serie?: boolean;
  /**
   * Après un délai dépassé, le processus est arrêté et relancé à l'appel
   * suivant (Blender, 16/10/2026 : son serveur reste bloqué jusqu'à 180 s sur
   * la commande sans réponse, et chaque appel suivant attendait derrière).
   */
  relancerApresDelai?: boolean;
  /** Dossier de lancement d'un serveur local (un serveur ajouté par l'administrateur : son dossier personnel). */
  cwd?: string;
  /**
   * Variables d'environnement du processus serveur.
   *
   * C'est par ici, et uniquement par ici, que passe un jeton d'accès. Le mettre
   * en argument de ligne de commande le rendrait lisible par n'importe quel
   * compte de la machine dans la table des processus (`ps`), et il finirait
   * dans l'historique du shell d'un intégrateur qui reproduit la commande.
   */
  env?: Record<string, string>;
  /**
   * Réglages de l'environnement qui ne sont pas des secrets (le chemin du
   * carnet de la mémoire de travail) : ils ne sont pas masqués dans le journal.
   */
  envPublic?: Record<string, string>;
  /** Serveur démarré automatiquement au lancement. */
  autoStart: boolean;
  /**
   * Commande libre, hors catalogue (instance qui l'autorise, connecteurs.ts) :
   * ses dépendances ne sont pas tenues à la date du catalogue, qui refuserait
   * un paquet publié après elle.
   */
  libre?: boolean;
}

export interface McpTool {
  /** Nom qualifié exposé au modèle : "<serveur>__<outil>". */
  name: string;
  serverId: string;
  toolName: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface McpServerStatus {
  id: string;
  label: string;
  description: string;
  running: boolean;
  toolCount: number;
  error?: string;
  tools: { name: string; description: string }[];
}

/**
 * Espace de travail auquel l'agent a accès.
 * Priorité : variable d'environnement, puis profil de déploiement client,
 * puis dossier par défaut.
 */
/**
 * Espace de travail de Cowork : le seul endroit où l'agent peut lire et écrire.
 *
 * Il n'est plus figé à l'installation. Une PME range ses dossiers là où elle
 * veut, et un agent cantonné à un seul répertoire imposé ne sert qu'à moitié.
 * Le changer relance le serveur de fichiers avec le nouveau périmètre — c'est
 * un argument de lancement, pas un réglage à chaud.
 */
/**
 * Emplacements de travail, et leur persistance.
 *
 * Le choix était gardé **en mémoire seulement** : changer de dossier depuis
 * l'écran marchait, jusqu'au redémarrage de l'application, qui revenait
 * silencieusement au dossier par défaut. Personne ne fait le lien, et on
 * conclut que le réglage « n'a pas tenu ». Il est maintenant écrit à côté des
 * données de l'instance.
 *
 * L'ordre de priorité ne change pas : la variable d'environnement d'abord (un
 * essai, un conteneur), puis le profil de déploiement (le choix de
 * l'intégrateur, qui n'a pas à être écrasé par un écran), puis le choix
 * enregistré, puis le dossier par défaut.
 */
function fichierEspace(): string {
  const base = process.env.HELIX_DATA_DIR ?? join(homedir(), ".helix", "data");
  return join(base, "espace.json");
}

function lireEspace(): string[] | null {
  try {
    const brut = JSON.parse(readFileSync(fichierEspace(), "utf8")) as { chemins?: unknown };
    const liste = Array.isArray(brut?.chemins)
      ? brut.chemins.filter((c): c is string => typeof c === "string" && c.length > 0)
      : [];
    return liste.length > 0 ? liste : null;
  } catch {
    return null;
  }
}

function ecrireEspace(chemins: string[]): void {
  try {
    const chemin = fichierEspace();
    mkdirSync(dirname(chemin), { recursive: true });
    writeFileSync(chemin, JSON.stringify({ chemins }, null, 2), "utf8");
  } catch (err) {
    // Le choix vaut pour cette session : on le dit plutôt que de le taire.
    console.error("[mcp] espace de travail non enregistré :", err);
  }
}

const espaceInitial: string[] = process.env.HELIX_WORKSPACE
  ? [process.env.HELIX_WORKSPACE]
  : deployment().workspace
    ? [deployment().workspace as string]
    : (lireEspace() ?? [join(homedir(), "Helix")]);

let espaceCourant = espaceInitial[0];
let espacesCourants = espaceInitial;

export const workspace = (): string => espaceCourant;

/**
 * **Tous** les emplacements ouverts à l'agent, le principal en tête.
 *
 * Il y en a plusieurs depuis que Cowork peut travailler sur l'ensemble du
 * poste : le dossier personnel **et** les disques montés, qui ne sont pas
 * dedans (`/Volumes` sur macOS, `/media` et `/mnt` sur Linux). Une clé USB ou
 * un partage réseau doit pouvoir être traité sans que l'utilisateur ait à
 * comprendre pourquoi son dossier personnel ne le couvre pas.
 */
export const workspaces = (): string[] => espacesCourants;

/** Conservé pour les appels existants ; préférez `workspace()`. */
export const WORKSPACE = espaceCourant;

/*
 * Au tout premier lancement, le dossier de travail n'existe pas encore et le
 * serveur de fichiers refuserait de démarrer. On le crée : l'utilisateur ne
 * doit rien avoir à préparer.
 */
try {
  if (!existsSync(espaceCourant)) {
    mkdirSync(espaceCourant, { recursive: true });
    console.log(`[mcp] espace de travail créé : ${espaceCourant}`);
  }
} catch (err) {
  console.error(
    `[mcp] impossible de créer l'espace de travail ${espaceCourant} :`,
    err instanceof Error ? err.message : err,
  );
}

/**
 * Serveurs par défaut. Volontairement minimal et sûr : accès fichiers limité à
 * un dossier de travail explicite. Les connecteurs SaaS (Composio) viendront
 * s'ajouter ici comme fournisseur alternatif.
 */
export const DEFAULT_SERVERS: McpServerConfig[] = [
  {
    id: "fichiers",
    label: "Fichiers",
    description: `Lecture et écriture dans ${espaceCourant}`,
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-filesystem@2026.8.31", ...espaceInitial],
    autoStart: true,
  },
];

interface Live {
  config: McpServerConfig;
  client?: Client;
  tools: McpTool[];
  error?: string;
  /** Processus du serveur local, pour arrêter aussi ce qu'il a lancé (`npx` lance `node`). */
  pid?: number;
  /** Le dernier appel en file, pour un serveur `serie` : le suivant attend sa fin. */
  file?: Promise<void>;
  /** Démarrage en cours : un second appel l'attend au lieu de lancer un second processus. */
  demarrage?: Promise<{ ok: boolean; error?: string }>;
  /** Arrêté par la passerelle (retrait, bascule, dossier changé) : on ne le relance pas de soi-même. */
  arrete?: boolean;
  /** Relances après un arrêt inattendu, pour ne pas relancer en boucle un serveur qui plante au démarrage. */
  relances?: number[];
  /**
   * Pourquoi il est arrêté, s'il l'est de lui-même : dit dans la langue de qui
   * lit l'état (`status`), pas figé dans celle du moment où il s'est arrêté,
   * souvent hors de toute requête, donc en anglais.
   */
  arret?: "relance" | "boucle";
}

const servers = new Map<string, Live>();

for (const config of DEFAULT_SERVERS) {
  servers.set(config.id, { config, tools: [] });
}

/** Nom qualifié : évite les collisions entre serveurs. */
const qualify = (serverId: string, tool: string) => `${serverId}__${tool}`;

/**
 * Nom d'outil tel que le modèle le reçoit : `<serveur>__<outil>`, ramené aux
 * caractères et à la longueur que les API compatibles OpenAI acceptent
 * (`^[a-zA-Z0-9_-]{1,64}$`), et unique sur toute l'instance.
 *
 * Mesuré le 28/09/2026 (scripts/essai-mcp.mjs) : un serveur qui nomme un outil
 * `get.weather`, `a/b c` ou d'un nom de 80 caractères le voyait passer tel
 * quel, et un fournisseur qui applique la règle refuse alors la demande
 * entière : plus aucune réponse dans le Chat tant que ce serveur était branché.
 * Et deux serveurs pouvaient produire le même nom qualifié (« a_ » + « x » et
 * « a » + « _x » donnent tous deux `a___x`) : l'appel partait chez le premier.
 * Le nom d'origine reste celui qu'on envoie au serveur (`toolName`).
 */
function nomPourModele(serverId: string, outil: string, pris: Set<string>): string {
  const brut = qualify(serverId, outil);
  let nom = brut.replace(/[^A-Za-z0-9_-]/g, "_");
  if (nom.length > 64 || nom !== brut) {
    // Un suffixe tiré du nom d'origine : deux noms voisins, ramenés au même, restent distincts.
    let h = 0;
    for (const c of brut) h = (h * 31 + c.codePointAt(0)!) >>> 0;
    const suffixe = `_${h.toString(36)}`;
    nom = nom.length > 64 ? nom.slice(0, 64 - suffixe.length) + suffixe : nom;
  }
  for (let n = 2; pris.has(nom); n++) {
    const suffixe = `_${n}`;
    nom = (nom.length + suffixe.length > 64 ? nom.slice(0, 64 - suffixe.length) : nom.replace(/_\d+$/, "")) + suffixe;
  }
  pris.add(nom);
  return nom;
}

/** Les noms déjà donnés au modèle par les **autres** serveurs. */
const nomsPris = (sauf: string): Set<string> =>
  new Set([...servers.values()].filter((s) => s.config.id !== sauf).flatMap((s) => s.tools.map((t) => t.name)));

type OutilListe = { name: string; description?: string; inputSchema?: unknown };

/**
 * Tous les outils d'un serveur, page après page.
 *
 * `tools/list` est paginé par le protocole (`nextCursor`) : on ne lisait que la
 * première page. Mesuré le 28/09/2026 : un serveur de sept outils servis par
 * trois n'en montrait que trois à l'agent, sans rien dire. Borné, pour qu'un
 * serveur qui rend toujours un curseur ne fasse pas tourner la passerelle.
 */
async function listerOutils(client: Client): Promise<OutilListe[]> {
  const tous: OutilListe[] = [];
  let curseur: string | undefined;
  for (let page = 0; page < 50; page++) {
    const r = await client.listTools(curseur ? { cursor: curseur } : undefined);
    tous.push(...(r.tools as OutilListe[]));
    if (!r.nextCursor || r.nextCursor === curseur || tous.length >= 2000) break;
    curseur = r.nextCursor;
  }
  return tous;
}

/** Range la liste d'outils d'un serveur sous les noms donnés au modèle. */
function retenirListe(id: string, entry: Live, liste: OutilListe[]): void {
  const pris = nomsPris(id);
  const vus = new Set<string>();
  const noms = new Map<string, string>();
  // Un outil listé deux fois par le serveur n'est gardé qu'une : deux fonctions du même nom font refuser la demande.
  const uniques = liste.filter((o) => typeof o?.name === "string" && o.name && !vus.has(o.name) && Boolean(vus.add(o.name)));
  for (const o of uniques) noms.set(o.name, nomPourModele(id, o.name, pris));
  /*
   * Trello, Monday, ClickUp, Todoist, Calendly, Zoom (SECURITE.md § 48) : les
   * lectures sont relevées, les écritures retirées si l'administrateur ne les
   * a pas cochées. Un autre serveur passe tel quel.
   */
  entry.tools = retenirOutils(id, uniques, (nom) => noms.get(nom) ?? qualify(id, nom)).map((t) => ({
    name: noms.get(t.name)!,
    serverId: id,
    toolName: t.name,
    description: t.description ?? "",
    inputSchema: (t.inputSchema && typeof t.inputSchema === "object" ? t.inputSchema : { type: "object", properties: {} }) as Record<string, unknown>,
  }));
}

/**
 * Le serveur annonce que sa liste d'outils a changé (`notifications/tools/list_changed`) :
 * on la relit. Sans cela, un outil ajouté en cours de route restait invisible
 * jusqu'au redémarrage de la passerelle (mesuré le 28/09/2026).
 */
function surListeChangee(id: string): (err: Error | null) => void {
  return () => {
    const entry = servers.get(id);
    const client = entry?.client;
    if (!entry || !client) return;
    listerOutils(client)
      .then((liste) => {
        if (entry.client !== client) return;
        retenirListe(id, entry, liste);
        console.log(`[mcp] ${entry.config.label} : liste d'outils relue (${entry.tools.length} outils)`);
      })
      .catch((err) => console.error(`[mcp] ${id} : liste d'outils illisible après changement :`, masquer(err instanceof Error ? err.message : String(err), entry.config.env)));
  };
}

const nouveauClient = (id: string) =>
  new Client(
    { name: "helix-gateway", version: "1.0.0" },
    { capabilities: {}, listChanged: { tools: { autoRefresh: false, debounceMs: 300, onChanged: surListeChangee(id) } } },
  );

/**
 * Les processus lancés par un processus, et ceux qu'ils ont lancés (macOS,
 * Linux). `npx` ne sert qu'à démarrer : c'est un `node` qu'il a lancé qui
 * répond, et arrêter `npx` ne l'arrête pas toujours.
 */
function descendants(pid: number): number[] {
  if (process.platform === "win32") return [];
  try {
    const table = execFileSync("ps", ["-A", "-o", "pid=,ppid="], { encoding: "utf8", timeout: 5000, stdio: ["ignore", "pipe", "ignore"] })
      .split("\n")
      .map((l) => l.trim().split(/\s+/).map(Number))
      .filter((c) => c.length === 2 && c.every(Number.isFinite));
    const trouves: number[] = [];
    const file = [pid];
    while (file.length > 0) {
      const p = file.shift()!;
      for (const [enfant, parent] of table) if (parent === p && !trouves.includes(enfant)) (trouves.push(enfant), file.push(enfant));
    }
    return trouves;
  } catch {
    return [];
  }
}

const vivant = (pid: number): boolean => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

/**
 * Retire d'un texte les secrets qu'il pourrait avoir emportés.
 *
 * Un serveur qui refuse un jeton recopie parfois ce jeton dans son message
 * d'erreur, et ce message part vers l'interface **et** vers la console. Un
 * secret n'a rien à faire ni dans l'une ni dans l'autre : c'est justement au
 * moment où quelque chose échoue qu'on colle une trace dans un ticket.
 */
function masquer(texte: string, env?: Record<string, string>): string {
  let sortie = texte;
  for (const valeur of Object.values(env ?? {})) {
    // Un secret court ou vide produirait un remplacement absurde sur tout le
    // texte : en dessous de huit caractères, ce n'en est pas un.
    if (valeur.length < 8) continue;
    sortie = sortie.split(valeur).join("[secret masqué]");
  }
  return sortie;
}

/**
 * Démarre un serveur MCP **distant**, en HTTP.
 *
 * Rien n'est lancé sur la machine : on se connecte, avec le jeton obtenu par
 * l'autorisation OAuth s'il en faut un. Un serveur qui refuse faute
 * d'autorisation le dit clairement, plutôt que d'échouer sans motif — c'est
 * l'interface qui proposera alors « Se connecter ».
 */
/*
 * Deux renouvellements du même jeton n'en font qu'un (revue du 28/09/2026).
 *
 * Deux appels d'outil simultanés sur un jeton d'accès expiré (deux Chats, deux
 * collègues) reçoivent chacun un 401, et le SDK renouvelle pour chacun, avec
 * le même jeton d'actualisation. Chez un service qui le fait tourner (un seul
 * usage : Atlassian, Linear…), le second renouvellement reçoit
 * `invalid_grant`, et le SDK efface alors les jetons, y compris ceux que le
 * premier venait d'obtenir : les deux appels échouaient, et le service restait
 * à reconnecter (reproduit par scripts/essai-mcp.mjs, partie C). Le même
 * renouvellement (même adresse, même corps, même en-tête d'identification)
 * part donc une seule fois ; les suivants, pendant trente secondes, reçoivent
 * la même réponse. Rien d'autre ne passe par ici : tout le reste va à `fetch`
 * tel quel. En mémoire seulement, et oublié au bout de ces trente secondes.
 */
type ReponseGardee = { statut: number; texte: string; entetes: [string, string][] };
const renouvellements = new Map<string, { quand: number; reponse: Promise<ReponseGardee> }>();
const PARTAGE_RENOUVELLEMENT_MS = 30_000;

const fetchAutorisation = async (entree: string | URL | Request, init?: RequestInit): Promise<Response> => {
  const corps = init?.body;
  const texte = typeof corps === "string" ? corps : corps instanceof URLSearchParams ? corps.toString() : null;
  const methode = String(init?.method ?? (entree instanceof Request ? entree.method : "GET")).toUpperCase();
  if (methode !== "POST" || texte === null || !texte.includes("grant_type") || new URLSearchParams(texte).get("grant_type") !== "refresh_token") {
    return fetch(entree, init);
  }
  const maintenant = Date.now();
  for (const [cle, r] of renouvellements) if (maintenant - r.quand > PARTAGE_RENOUVELLEMENT_MS) renouvellements.delete(cle);
  const adresse = entree instanceof Request ? entree.url : String(entree);
  const cle = `${adresse}\n${new Headers(init?.headers).get("authorization") ?? ""}\n${texte}`;
  let enCours = renouvellements.get(cle);
  if (!enCours) {
    const reponse = fetch(entree, init).then(async (r) => ({ statut: r.status, texte: await r.text(), entetes: [...r.headers] as [string, string][] }));
    enCours = { quand: maintenant, reponse };
    renouvellements.set(cle, enCours);
    // Une coupure réseau n'est pas une réponse : le suivant réessaie.
    reponse.catch(() => renouvellements.delete(cle));
  }
  const r = await enCours.reponse;
  return new Response(r.texte, { status: r.statut, headers: r.entetes });
};

/**
 * L'adresse d'un serveur HTTP est-elle permise ? (29/09/2026, Palmier Pro)
 *
 * Jusqu'ici, toute adresse en http sur 127.0.0.1 ou `localhost` passait, « pour
 * les essais ». Le catalogue ne donnait que des adresses publiques en https,
 * mais une adresse glissée dans le magasin (son hôte PostgreSQL compte parmi
 * les menaces, SECURITE.md § 3) aurait fait parler l'instance à n'importe quel
 * service de la machine ou du réseau interne. Désormais :
 *  - en https, jamais un hôte interne écrit en adresse IP, ni `localhost`
 *    (même règle que pour les modèles ajoutés par clé, sortieReseau.ts) ;
 *  - en http, seulement un serveur déclaré `local` : 127.0.0.1 exactement, et
 *    le port que son entrée du catalogue déclare, aucun autre.
 */
export function adresseServeurPermise(config: Pick<McpServerConfig, "url" | "local">): string | null {
  let adresse: URL;
  try {
    adresse = new URL(config.url ?? "");
  } catch {
    return t("Adresse de serveur illisible.");
  }
  const hote = adresse.hostname.replace(/^\[|\]$/g, "");
  if (adresse.protocol === "https:") {
    if (hote === "localhost" || hote.endsWith(".localhost") || interne(hote)) return t("Adresse de serveur refusée : une adresse interne n'est permise qu'à une application locale déclarée par le catalogue.");
    return null;
  }
  if (adresse.protocol !== "http:" || !config.local) return t("Adresse de serveur distant refusée : https est exigé.");
  if (hote !== "127.0.0.1" || Number(adresse.port) !== config.local.port || adresse.username || adresse.password) {
    return tf("Adresse de serveur local refusée : seul http://127.0.0.1:{0} est permis.", config.local.port);
  }
  return null;
}

/**
 * Chaque requête vers une application locale : l'adresse redite (127.0.0.1 et
 * son port), l'écouteur reconnu juste avant, et aucune redirection suivie. Un
 * refus lève une erreur sans rien envoyer.
 */
function fetchLocal(local: NonNullable<McpServerConfig["local"]>): typeof fetch {
  return (async (entree: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const adresse = new URL(entree instanceof Request ? entree.url : String(entree));
    if (adresse.protocol !== "http:" || adresse.hostname !== "127.0.0.1" || Number(adresse.port) !== local.port) {
      throw new Error(tf("Adresse de serveur local refusée : seul http://127.0.0.1:{0} est permis.", local.port));
    }
    const refus = await local.reconnaitre();
    if (refus) throw new Error(refus);
    return fetch(entree, { ...init, redirect: "error" });
  }) as typeof fetch;
}

async function demarrerDistant(id: string, entry: Live): Promise<{ ok: boolean; error?: string }> {
  const refus = adresseServeurPermise(entry.config);
  if (refus) {
    entry.error = refus;
    return { ok: false, error: entry.error };
  }
  const adresse = new URL(entry.config.url!);

  const autorisation = entry.config.local
    ? { fetch: fetchLocal(entry.config.local) }
    : entry.config.auth
      ? { authProvider: entry.config.auth as never, fetch: fetchAutorisation }
      : {};
  let client = nouveauClient(id);
  try {
    await client.connect(new StreamableHTTPClientTransport(adresse, autorisation));
  } catch (err) {
    /*
     * Revérification des connecteurs du 28/09/2026 : Webflow ne documente que
     * son adresse `/sse`, c'est-à-dire l'ancien transport « HTTP + SSE » du
     * protocole (2024-11-05). Helix ne parlait que le transport « streamable » :
     * un POST sur `/sse` y est refusé (4xx), et le connecteur ne pouvait pas
     * démarrer, quoi que dise l'autorisation. La spécification prévoit le
     * repli : sur un 4xx autre qu'un refus d'autorisation (401, 403), rouvrir
     * en SSE à la même adresse. Un refus d'autorisation, lui, reste un refus :
     * c'est « Se connecter » qu'il faut, pas un autre transport.
     */
    const code = err instanceof StreamableHTTPError ? (err.code ?? 0) : 0;
    if (err instanceof UnauthorizedError || code < 400 || code >= 500 || code === 401 || code === 403) throw err;
    await client.close().catch(() => undefined);
    client = nouveauClient(id);
    await client.connect(new SSEClientTransport(adresse, autorisation));
  }

  let liste: OutilListe[];
  try {
    liste = await listerOutils(client);
  } catch (err) {
    // Connecté mais muet : la connexion ne reste pas ouverte derrière un échec.
    await client.close().catch(() => undefined);
    throw err;
  }
  entry.client = client;
  entry.error = undefined;
  entry.arret = undefined;
  retenirListe(id, entry, liste);
  console.log(`[mcp] ${entry.config.label} branché à distance (${entry.tools.length} outils)`);
  return { ok: true };
}

/*
 * `npx`, là où il n'est pas directement lançable (27/09/2026, essai sous
 * Ubuntu et audit Windows) : une machine sans Node n'en a pas, et sous Windows
 * c'est un `.cmd`, que Node refuse de lancer sans interpréteur de commandes.
 * Dans l'ordre : `npx` du système (macOS et Linux, comme avant) ; le Node du
 * système sous Windows, avec le script de `npx` ; le Node que Helix pose
 * (installationOpenClaw.ts, empreinte vérifiée), installé au besoin. Son
 * dossier passe en tête du PATH : les paquets lancés par `npx` y trouvent
 * `node`.
 */
async function resoudreNpx(): Promise<{ command: string; prefixe: string[]; path?: string } | null> {
  const dansLePath = (nom: string) =>
    (process.env.PATH ?? "")
      .split(delimiter)
      .filter(Boolean)
      .map((d) => join(d, nom))
      .find((c) => existsSync(c));
  /*
   * Le Node du système, seulement s'il est assez récent (revue Linux du
   * 27/09/2026 : `apt install nodejs` donne Node 12 sur Ubuntu 22.04, où les
   * serveurs d'outils ne démarrent pas).
   */
  const assezRecent = (node: string) => {
    try {
      const v = /v(\d+)/.exec(execFileSync(node, ["--version"], { encoding: "utf8", timeout: 10_000, stdio: ["ignore", "pipe", "ignore"] }))?.[1];
      return Number(v) >= 18;
    } catch {
      return false;
    }
  };
  if (process.platform !== "win32") {
    /*
     * Par son chemin complet, son dossier en tête du PATH (revue du
     * 27/09/2026) : une application ouverte depuis le Finder n'a pas celui de
     * Homebrew, et `npx` y échouait (« env: node »).
     */
    /*
     * Le premier dont le Node démarre, pas seulement le premier présent
     * (24/10/2026) : sur le Mac de Medhi, une mise à jour de Homebrew avait
     * remplacé simdjson, et `/opt/homebrew/bin/node` ne démarrait plus
     * (« Library not loaded: libsimdjson.30.dylib ») ; Helix téléchargeait
     * alors son propre Node, alors que celui de `/usr/local` marchait.
     */
    const candidats = [dansLePath("npx"), "/opt/homebrew/bin/npx", "/usr/local/bin/npx"].filter((c): c is string => Boolean(c) && existsSync(c as string));
    const npx = [...new Set(candidats)].find((c) => assezRecent(join(dirname(c), "node")));
    if (npx) return { command: npx, prefixe: [], path: dirname(npx) };
  } else {
    const node = dansLePath("node.exe");
    const script = node ? join(dirname(node), "node_modules", "npm", "bin", "npx-cli.js") : null;
    if (node && script && existsSync(script) && assezRecent(node)) return { command: node, prefixe: [script], path: dirname(node) };
  }
  let prive = npxPrive();
  if (!prive && nodePriveInstallable() === null) {
    console.log("[mcp] npx absent de cette machine : installation du Node de Helix (nodejs.org, empreinte vérifiée)...");
    await assurerNodePrive().catch((err) => console.error(`[mcp] Node non installé : ${(err as Error).message}`));
    prive = npxPrive();
  }
  return prive ? { command: prive.node, prefixe: [prive.script], path: prive.dossier } : null;
}

export async function startServer(id: string): Promise<{ ok: boolean; error?: string }> {
  const entry = servers.get(id);
  if (!entry) return { ok: false, error: `Serveur inconnu : ${id}` };
  if (entry.client) return { ok: true };
  entry.arrete = false;
  /*
   * Deux démarrages en même temps (le lancement de la passerelle et une
   * relance, deux appels d'outil après un plantage) lançaient deux processus,
   * dont un restait orphelin : le second attend le premier.
   */
  if (entry.demarrage) return entry.demarrage;
  entry.demarrage = demarrer(id, entry).finally(() => {
    entry.demarrage = undefined;
  });
  return entry.demarrage;
}

async function demarrer(id: string, entry: Live): Promise<{ ok: boolean; error?: string }> {
  let clientLocal: Client | undefined;
  try {
    if (entry.config.url) return await demarrerDistant(id, entry);
    // Une application de la machine (Roblox Studio, Blender) : rien n'est lancé tant qu'elle n'est pas reconnue.
    const refus = entry.config.avantLancement ? await entry.config.avantLancement() : null;
    if (refus) throw new Error(refus);
    const npx = entry.config.command === "npx" ? await resoudreNpx() : null;
    if (entry.config.command === "npx" && !npx) throw new Error(t("npx est absent de cette machine, et Node n'a pas pu être installé."));
    const defaut = getDefaultEnvironment();
    const transport = new StdioClientTransport({
      command: npx ? npx.command : entry.config.command!,
      args: [...(npx?.prefixe ?? []), ...(entry.config.args ?? [])],
      ...(entry.config.cwd ? { cwd: entry.config.cwd } : {}),
      /*
       * `getDefaultEnvironment()` d'abord : sans PATH ni HOME, `npx` ne trouve
       * ni Node ni son cache et le serveur ne démarre jamais. Les secrets du
       * connecteur viennent ensuite, et priment.
       */
      env: {
        ...defaut,
        ...(npx?.path ? { PATH: [npx.path, defaut.PATH ?? process.env.PATH ?? ""].filter(Boolean).join(delimiter) } : {}),
        ...(entry.config.envPublic ?? {}),
        ...(entry.config.env ?? {}),
        /*
         * Aucun script d'installation : `npx` télécharge le paquet épinglé et ses
         * dépendances, et un script `postinstall` d'une dépendance compromise
         * s'exécuterait sans que personne l'ait voulu (ajouté le 26/09/2026,
         * revue des connecteurs). Les serveurs du catalogue n'en ont pas besoin.
         */
        ...(entry.config.command === "npx" ? { npm_config_ignore_scripts: "true", npm_config_update_notifier: "false", npm_config_fund: "false", npm_config_audit: "false" } : {}),
        /*
         * Et ses dépendances publiées avant la date du catalogue
         * (DEPENDANCES_NPM_AVANT, installationOpenClaw.ts) : le paquet est
         * épinglé, pas ses dépendances, et aucun de ces paquets ne publie de
         * fichier de verrouillage. Essayé le 28/09/2026 avec npx 11.19 : la
         * variable est honorée (une date antérieure au paquet le fait refuser,
         * `ETARGET`), le serveur de mémoire répond à `initialize`.
         */
        ...(entry.config.command === "npx" && !entry.config.libre ? { npm_config_before: DEPENDANCES_NPM_AVANT } : {}),
      },
      /*
       * Par défaut, le SDK laisse le serveur écrire sur la sortie d'erreur de
       * la passerelle. C'est une fuite mesurée, pas une hypothèse : un serveur
       * qui recopie sa configuration au démarrage — ce que font plusieurs, pour
       * aider au diagnostic — dépose alors son jeton en clair dans le journal
       * de l'instance, hors de tout chiffrement. On l'intercepte pour le
       * relayer masqué : le diagnostic reste lisible, le secret ne sort pas.
       */
      stderr: "pipe",
    });

    // Avant `connect()`, qui démarre le processus : sinon les premières lignes,
    // justement celles qui disent pourquoi un démarrage échoue, sont perdues.
    transport.stderr?.on("data", (morceau: Buffer) => {
      const texte = masquer(morceau.toString("utf8"), entry.config.env).trimEnd();
      if (texte) console.error(`[mcp:${id}] ${texte}`);
    });

    const client = nouveauClient(id);
    clientLocal = client;
    /*
     * Le délai d'`initialize` court dès le lancement du processus. Par `npx`,
     * il couvre donc le premier téléchargement du paquet et de ses dépendances :
     * soixante secondes, celles du SDK, sur une connexion lente, et l'ajout
     * échouait au premier essai, le téléchargement interrompu avec le
     * processus. Cinq minutes pour `npx` ; un serveur déjà sur la machine garde
     * le délai ordinaire.
     */
    await client.connect(transport, { timeout: entry.config.command === "npx" ? Math.max(DELAI_APPEL_MS, 5 * 60_000) : DELAI_APPEL_MS });
    const pid = transport.pid ?? undefined;
    entry.pid = pid;

    const liste = await listerOutils(client);
    // Arrêté pendant qu'il démarrait (retrait, dossier changé) : il ne reste pas derrière.
    if (entry.arrete) {
      await fermer(client, pid);
      if (entry.pid === pid) entry.pid = undefined;
      return { ok: false, error: t("Serveur arrêté pendant son démarrage.") };
    }
    entry.client = client;
    entry.error = undefined;
    entry.arret = undefined;
    retenirListe(id, entry, liste);
    client.onclose = () => arretInattendu(id, client);
    console.log(`[mcp] ${entry.config.label} démarré (${entry.tools.length} outils)`);
    return { ok: true };
  } catch (err) {
    /*
     * Démarré mais incapable de lister ses outils : le processus tournait
     * encore, sans que plus rien ne le référence (mesuré le 28/09/2026). Il est
     * arrêté avec ce qu'il a lancé.
     */
    if (clientLocal && entry.client !== clientLocal) {
      await fermer(clientLocal, entry.pid);
      entry.pid = undefined;
    }
    entry.error = masquer(err instanceof Error ? err.message : String(err), entry.config.env);
    entry.arret = undefined;
    /*
     * Les outils ne sont pas effacés : un premier démarrage n'en a pas encore
     * (et `stopServer` les efface), et une relance manquée après une connexion
     * perdue doit laisser l'appel suivant réessayer. Effacés, ils ne revenaient
     * plus, même une fois le serveur distant de nouveau joignable.
     */
    console.error(`[mcp] échec du démarrage de ${id} :`, entry.error);
    return { ok: false, error: entry.error };
  }
}

/**
 * Ferme un client, et arrête le processus local avec **tout ce qu'il a lancé**.
 *
 * Le SDK ferme l'entrée du serveur, puis envoie SIGTERM, puis SIGKILL, mais au
 * seul processus qu'il a lancé. Mesuré le 28/09/2026 : un serveur qui avait
 * lancé un processus à lui (un navigateur, un interpréteur, ou le `node` que
 * lance `npx`) le laissait tourner après le retrait du connecteur, rattaché à
 * personne. La liste est relevée avant la fermeture : après, ces processus
 * n'ont plus de parent qui les désigne.
 */
async function fermer(client: Client, pid: number | undefined): Promise<void> {
  const enfants = pid ? descendants(pid) : [];
  // Windows : pas de signal, et `kill()` n'arrête pas l'arbre (processus.ts).
  if (process.platform === "win32" && pid) arreterPidArbre(pid);
  await client.close().catch(() => undefined);
  const restants = [...enfants, ...(pid ? [pid] : [])].filter(vivant);
  if (restants.length === 0) return;
  for (const p of restants) arreterPidArbre(p, "SIGTERM");
  await new Promise((r) => setTimeout(r, 500));
  for (const p of restants.filter(vivant)) arreterPidArbre(p, "SIGKILL");
}

/**
 * Le serveur local s'est arrêté sans qu'on le lui demande (il a planté, ou
 * quelqu'un l'a tué).
 *
 * Jusqu'ici rien ne le remarquait : l'écran le disait « en marche », ses outils
 * restaient proposés, et chaque appel répondait « Not connected » jusqu'au
 * redémarrage de la passerelle (mesuré le 28/09/2026). Il est maintenant dit
 * arrêté, relancé une seconde plus tard, et au plus trois fois en dix minutes :
 * un serveur qui plante au démarrage ne tourne pas en boucle. Ses outils restent
 * proposés : l'appel suivant le relance, s'il ne l'est pas déjà.
 */
function arretInattendu(id: string, client: Client): void {
  const entry = servers.get(id);
  if (!entry || entry.client !== client) return;
  entry.client = undefined;
  entry.pid = undefined;
  if (entry.arrete) return;
  const maintenant = Date.now();
  entry.relances = (entry.relances ?? []).filter((d) => maintenant - d < 10 * 60_000);
  if (entry.relances.length >= 3) {
    entry.error = undefined;
    entry.arret = "boucle";
    console.error(`[mcp] ${id} : arrêté trois fois en dix minutes, plus de relance automatique`);
    return;
  }
  entry.relances.push(maintenant);
  entry.error = undefined;
  entry.arret = "relance";
  console.error(`[mcp] ${id} : arrêt inattendu, relance dans une seconde`);
  setTimeout(() => {
    if (!entry.arrete && !entry.client && servers.get(id) === entry) void startServer(id);
  }, 1000).unref();
}

export async function stopServer(id: string): Promise<void> {
  const entry = servers.get(id);
  if (!entry) return;
  entry.arrete = true;
  entry.arret = undefined;
  if (entry.demarrage) await entry.demarrage.catch(() => undefined);
  const client = entry.client;
  const pid = entry.pid;
  entry.client = undefined;
  entry.pid = undefined;
  entry.tools = [];
  if (client) await fermer(client, pid);
}

/**
 * À la sortie de la passerelle : chaque serveur local, et ce qu'il a lancé,
 * reçoit SIGTERM, puis SIGKILL s'il est encore là une demi-seconde plus tard.
 * Synchrone : l'événement `exit` n'attend rien. Sans cela, un serveur qui ne
 * lit pas la fin de son entrée, ou ce qu'il avait lancé, restait en mémoire
 * après la fermeture de l'application (mesuré le 28/09/2026).
 */
export function arreterTousEnPartant(): void {
  const cibles: number[] = [];
  for (const entry of servers.values()) {
    const pid = entry.pid;
    if (!pid) continue;
    entry.arrete = true;
    if (process.platform === "win32") {
      arreterPidArbre(pid);
      continue;
    }
    cibles.push(...descendants(pid), pid);
  }
  if (cibles.length === 0) return;
  for (const p of cibles) arreterPidArbre(p, "SIGTERM");
  const attente = new Int32Array(new SharedArrayBuffer(4));
  for (let i = 0; i < 10 && cibles.some(vivant); i++) Atomics.wait(attente, 0, 0, 50);
  for (const p of cibles.filter(vivant)) arreterPidArbre(p, "SIGKILL");
}

/**
 * Déclare un serveur, sans le démarrer.
 *
 * La liste des serveurs n'est plus figée à la compilation : `connecteurs.ts` y
 * ajoute ce que l'utilisateur a branché. Ce module reste volontairement bête —
 * il exécute la commande qu'on lui donne. **C'est l'appelant qui répond de sa
 * provenance**, et le seul appelant est le catalogue, jamais une requête HTTP.
 */
export function declarer(config: McpServerConfig): void {
  const existant = servers.get(config.id);
  if (existant) {
    existant.config = config;
    return;
  }
  servers.set(config.id, { config, tools: [] });
}

/** Un serveur porte-t-il déjà cet identifiant ? Évite d'en écraser un autre. */
export const estDeclare = (id: string): boolean => servers.has(id);

/**
 * Un serveur déclaré, arrêté, que la passerelle n'a pas arrêté elle-même
 * (bascule, retrait) et qui ne démarre pas déjà : on peut retenter de le
 * brancher (une application locale ouverte après la passerelle, 29/09/2026).
 */
export function relancable(id: string): boolean {
  const s = servers.get(id);
  return Boolean(s && !s.client && !s.arrete && !s.demarrage);
}

/**
 * Arrête un serveur et le retire complètement.
 *
 * `stopServer` seul laisserait l'entrée en place : le connecteur retiré
 * réapparaîtrait dans la liste, éteint, comme s'il attendait d'être rallumé.
 * Retirer veut dire disparaître.
 */
export async function retirerServeur(id: string): Promise<void> {
  await stopServer(id);
  servers.delete(id);
}

/** Démarre les serveurs marqués `autoStart`. */
export async function startAutoServers(): Promise<void> {
  await Promise.all(
    [...servers.values()]
      .filter((s) => s.config.autoStart)
      .map((s) => startServer(s.config.id)),
  );
}

export function status(): McpServerStatus[] {
  return [...servers.values()].map((s) => ({
    id: s.config.id,
    label: t(s.config.label),
    /*
     * Le serveur de fichiers se décrit par le dossier qu'il ouvre : la
     * description est donc écrite au moment de la lire, dans la langue de
     * qui la lit et avec le dossier du moment — pas figée au démarrage.
     */
    description:
      s.config.id === "fichiers"
        ? tf("Lecture et écriture dans {0}", lister(espacesCourants))
        : t(s.config.description),
    running: Boolean(s.client),
    toolCount: s.tools.length,
    error:
      s.arret === "boucle"
        ? t("Le serveur s'est arrêté trois fois en dix minutes : il n'est plus relancé de lui-même. Il le sera au prochain appel d'un de ses outils.")
        : s.arret === "relance"
          ? t("Le serveur s'est arrêté de lui-même : il est relancé.")
          : s.error,
    tools: s.tools.map((t) => ({ name: t.toolName, description: t.description })),
  }));
}

/**
 * `status()`, avec la raison d'une application locale arrêtée relue maintenant
 * (Palmier Pro, 29/09/2026) : celle que garde `error` date souvent du
 * démarrage de la passerelle, hors de toute requête, donc dans la langue par
 * défaut, et l'application a pu être ouverte ou fermée depuis.
 */
export async function statusFrais(): Promise<McpServerStatus[]> {
  const liste = status();
  return Promise.all(
    liste.map(async (s) => {
      const config = servers.get(s.id)?.config;
      const reconnaitre = config?.local?.reconnaitre ?? config?.avantLancement;
      if (!reconnaitre || s.running || !s.error) return s;
      const refus = await reconnaitre().catch(() => null);
      return refus ? { ...s, error: refus } : s;
    }),
  );
}

/** Tous les outils disponibles, au format « fonction » attendu par le modèle. */
export function toolsForModel(): {
  type: "function";
  function: { name: string; description: string; parameters: Record<string, unknown> };
}[] {
  return [...servers.values()]
    .flatMap((s) => s.tools)
    .map((t) => ({
      type: "function" as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: t.inputSchema,
      },
    }));
}

export function hasTools(): boolean {
  return [...servers.values()].some((s) => s.tools.length > 0);
}

/** Le serveur et le nom d'origine d'un outil, d'après le nom donné au modèle ; `null` s'il n'est pas proposé. */
export function outilDuModele(qualifie: string): { serverId: string; toolName: string } | null {
  const tool = [...servers.values()].flatMap((s) => s.tools).find((t) => t.name === qualifie);
  return tool ? { serverId: tool.serverId, toolName: tool.toolName } : null;
}

/**
 * Le résultat d'un appel. `injoignable` : l'application ou le serveur n'a pas
 * pu être atteint (refus avant l'appel, ou délai dépassé) ; la boucle du Chat
 * s'en sert pour ne pas relancer ses outils dans la même réponse (chat.ts).
 */
export type ResultatAppel = { ok: boolean; content: string; injoignable?: true };

/**
 * Exécute un outil qualifié et renvoie son résultat en texte.
 *
 * `ecriture` (16/10/2026) : l'appelant dit si l'outil modifie (la barrière
 * d'approbation, `modifie`). Sur un délai dépassé, « il a pu être exécuté
 * quand même » n'est dit que d'une écriture : une lecture, comme
 * `get_addon_status` de Blender, n'a rien pu changer. Absent : on le dit,
 * par prudence.
 */
export async function callTool(
  qualifiedName: string,
  args: Record<string, unknown>,
  options: { ecriture?: boolean } = {},
): Promise<ResultatAppel> {
  const tool = [...servers.values()].flatMap((s) => s.tools).find((t) => t.name === qualifiedName);
  if (!tool) return { ok: false, content: `Outil inconnu : ${qualifiedName}` };

  const entry = servers.get(tool.serverId);
  if (!entry) return { ok: false, content: `Serveur ${tool.serverId} arrêté.` };
  if (!entry.config.serie) return appelerOutil(tool, entry, args, options);
  /*
   * Un appel à la fois (Unreal Editor, Blender, 16/10/2026) : le suivant
   * attend la fin du précédent, vérification comprise.
   */
  const precedent = entry.file ?? Promise.resolve();
  let liberer: () => void = () => undefined;
  const tour = new Promise<void>((r) => (liberer = r));
  entry.file = precedent.then(() => tour);
  await precedent;
  try {
    return await appelerOutil(tool, entry, args, options);
  } finally {
    liberer();
  }
}

async function appelerOutil(tool: McpTool, entry: Live, args: Record<string, unknown>, options: { ecriture?: boolean }): Promise<ResultatAppel> {
  /*
   * Blender (12/10/2026) : le programme qui tient le port de son module est
   * relu avant chaque appel, comme Palmier Pro avant chaque requête. Fermé, ou
   * remplacé par un autre programme, rien n'est envoyé. Depuis le 16/10/2026,
   * son module doit aussi répondre (blender.ts, `sondeBlender`), et le refus
   * est marqué `injoignable`.
   */
  if (entry.config.avantAppel) {
    const refus = await entry.config.avantAppel().catch((err: unknown) => (err instanceof Error ? err.message : String(err)));
    if (refus) return { ok: false, content: `${refus} Rien n'a été envoyé. Ne relance pas cet outil ni un autre de ${entry.config.label} dans cette réponse : dis à l'utilisateur ce qu'il doit faire, avec ce message.`, injoignable: true };
  }
  /*
   * Une application en HTTP sur la boucle (Palmier Pro, Unreal Editor) : sa
   * reconnaissance est refaite avant chaque requête (`fetchLocal`) ; faite ici
   * d'abord, son refus se dit en clair, sans le détour d'une erreur de
   * transport (16/10/2026).
   */
  if (entry.config.local) {
    const refus = await entry.config.local.reconnaitre().catch((err: unknown) => (err instanceof Error ? err.message : String(err)));
    if (refus) return { ok: false, content: `${refus} Rien n'a été envoyé. Ne relance pas cet outil ni un autre de ${entry.config.label} dans cette réponse : dis à l'utilisateur ce qu'il doit faire, avec ce message.`, injoignable: true };
  }
  /*
   * Arrêté de lui-même (plantage, serveur distant qui a redémarré) : on le
   * relance ici, au moment où l'on en a besoin. Arrêté par la passerelle
   * (bascule, retrait), il le reste.
   */
  if (!entry.client) {
    if (entry.arrete) return { ok: false, content: `Serveur ${tool.serverId} arrêté.` };
    const relance = await startServer(tool.serverId);
    if (!relance.ok || !entry.client) {
      return { ok: false, content: `Le serveur ${entry.config.label} ne répond pas et n'a pas pu être relancé : ${relance.error ?? "cause inconnue"}. Dis-le à l'utilisateur.`, injoignable: true };
    }
  }

  /*
   * Serveur de fichiers : les zones protégées d'abord (zonesProtegees.ts). Le
   * serveur ne sait borner que par ses dossiers de lancement ; avec « Tout mon
   * poste », c'est le dossier personnel entier, données de l'instance, clés
   * SSH et conversations des autres assistants comprises. Mesuré le
   * 25/09/2026 avant cette barrière : `read_text_file` rendait
   * `~/.helix/data/instance-token`.
   */
  const fichiers = tool.serverId === "fichiers";
  if (fichiers || tool.serverId === "rea") {
    const fautif = cheminProtegeDans(args, espaceCourant);
    if (fautif) {
      return {
        ok: false,
        content:
          `Accès refusé : « ${fautif} » est dans un emplacement protégé (données de l'instance, clés, ` +
          `réglages et historiques d'autres logiciels). Ni l'agent ni l'équipe n'y ont accès, quel que ` +
          `soit le dossier ouvert. Ne réessaie pas par un autre chemin.`,
      };
    }
  }

  const appeler = (client: Client) =>
    client.callTool({ name: tool.toolName, arguments: args }, undefined, {
      /*
       * Soixante secondes sans nouvelles, comme le SDK ; mais un serveur qui
       * dit où il en est (`notifications/progress`) n'est plus coupé à la
       * soixantième seconde d'une opération longue, jusqu'à dix minutes.
       */
      timeout: DELAI_APPEL_MS,
      resetTimeoutOnProgress: true,
      maxTotalTimeout: 10 * 60_000,
      onprogress: () => undefined,
    });
  // Pour les fichiers seulement : ailleurs, « not allowed » vient d'un service, pas du dossier de travail.
  const expliquerSi = (texte: string) => (fichiers ? expliquer(texte) : texte);

  let client = entry.client!;
  for (let essai = 0; ; essai++) {
    try {
      const result = await appeler(client);
      const brut = rendreResultat(result as ResultatOutil);
      const filtre = fichiers ? filtrerResultat(tool.toolName, args, brut, espaceCourant) : brut;
      const text = tool.serverId === "rea" && filtre.length > 64000 ? filtre.slice(0,64000)+"\n\n"+t("Résultat REA abrégé : affinez la requête ou demandez une vue plus ciblée.") : filtre;
      return { ok: !result.isError, content: expliquerSi(text) || "(résultat vide)" };
    } catch (err) {
      const message = masquer(err instanceof Error ? err.message : String(err), entry.config.env);
      if (err instanceof UnauthorizedError) {
        return { ok: false, content: `L'autorisation donnée à ${entry.config.label} n'est plus valable (${message}). Dis à l'utilisateur de le reconnecter depuis l'écran des connecteurs.` };
      }
      if (err instanceof McpError && err.code === ErrorCode.RequestTimeout) {
        /*
         * Blender (16/10/2026) : son serveur reste bloqué sur la commande sans
         * réponse ; il est arrêté, et l'appel suivant en relance un neuf au
         * lieu d'attendre derrière celui-ci.
         */
        if (entry.config.relancerApresDelai && entry.client === client) {
          entry.client = undefined;
          const pid = entry.pid;
          entry.pid = undefined;
          await fermer(client, pid);
        }
        // Une lecture n'a rien pu changer : seule une écriture « a pu être exécutée quand même » (16/10/2026).
        const suite =
          options.ecriture === false
            ? "C'était une lecture : rien n'a été modifié."
            : "Il a pu être exécuté quand même : vérifie avant de le refaire.";
        return { ok: false, content: `${entry.config.label} n'a pas répondu à temps (${message}) : l'appel est abandonné. ${suite} Ne relance pas le même appel dans cette réponse : dis à l'utilisateur ce qui bloque.`, injoignable: true };
      }
      /*
       * Un 401 reçu pendant qu'un autre appel venait de renouveler le jeton
       * (revue du 28/09/2026) : le SDK le prend pour un refus après une
       * autorisation réussie, alors que la demande était partie avec l'ancien
       * jeton. Le service l'a refusée, donc rien n'a été exécuté : on la
       * refait une fois, avec le jeton neuf.
       */
      if (err instanceof StreamableHTTPError && err.code === 401 && essai === 0) continue;
      /*
       * La connexion est perdue (serveur distant redémarré, session oubliée,
       * processus disparu). Mesuré le 28/09/2026 : chaque appel suivant
       * échouait (« No valid session ID », « Not connected ») jusqu'au
       * redémarrage de la passerelle. On rouvre la connexion ; et l'appel est
       * refait une fois, seulement quand il est sûr que le serveur ne l'a pas
       * exécuté (refusé avant, ou jamais parvenu).
       */
      const perdue = connexionPerdue(err);
      if (!perdue.perdue || essai > 0) return { ok: false, content: expliquerSi(message) };
      if (entry.client === client) {
        entry.client = undefined;
        const pid = entry.pid;
        entry.pid = undefined;
        await fermer(client, pid);
      }
      const relance = await startServer(tool.serverId);
      if (!relance.ok || !entry.client) {
        return { ok: false, content: `${entry.config.label} ne répond plus (${message}) et la connexion n'a pas pu être rouverte : ${relance.error ?? "cause inconnue"}.` };
      }
      if (!perdue.nonExecute) {
        return { ok: false, content: `La connexion à ${entry.config.label} a été perdue pendant l'appel (${message}). Elle est rouverte, mais l'appel a pu être exécuté : vérifie avant de le refaire.` };
      }
      client = entry.client;
    }
  }
}

/** Délai d'un appel d'outil sans nouvelles du serveur (réglable pour les essais). */
const DELAI_APPEL_MS = Number(process.env.HELIX_MCP_DELAI_MS) > 0 ? Number(process.env.HELIX_MCP_DELAI_MS) : 60_000;

/**
 * Une erreur d'appel dit-elle que la connexion est perdue, et que le serveur
 * n'a sûrement pas exécuté l'appel ?
 */
function connexionPerdue(err: unknown): { perdue: boolean; nonExecute: boolean } {
  const message = err instanceof Error ? err.message : String(err);
  // Le processus n'était plus là : rien n'est parti.
  if (/^Not connected$/.test(message)) return { perdue: true, nonExecute: true };
  if (err instanceof StreamableHTTPError) {
    /*
     * 404 : la session est inconnue du serveur (il a redémarré), et la
     * spécification demande d'en ouvrir une nouvelle. Plusieurs serveurs
     * répondent 400 « No valid session ID » pour la même raison.
     */
    if (err.code === 404 || (err.code === 400 && /session/i.test(message))) return { perdue: true, nonExecute: true };
    return { perdue: false, nonExecute: false };
  }
  const cause = (err as { cause?: { code?: string } })?.cause?.code;
  if (/fetch failed/i.test(message)) return { perdue: true, nonExecute: cause === "ECONNREFUSED" };
  if (err instanceof McpError && err.code === ErrorCode.ConnectionClosed) return { perdue: true, nonExecute: false };
  return { perdue: false, nonExecute: false };
}

type ResultatOutil = { content?: unknown; structuredContent?: unknown; isError?: boolean };

/**
 * Le résultat d'un outil, en texte pour le modèle.
 *
 * Seul le texte passait : une ressource renvoyée par le serveur (le contenu
 * d'un fichier, d'une page) devenait « [resource] », un lien « [resource_link] »
 * sans son adresse, et un résultat seulement structuré « (résultat vide) ».
 * Mesuré le 28/09/2026 avec @modelcontextprotocol/server-everything. Les images
 * et le son ne sont pas transmis au modèle : il le sait, au lieu de croire que
 * le serveur n'a rien rendu.
 */
function rendreResultat(result: ResultatOutil): string {
  const parts = Array.isArray(result.content) ? (result.content as Record<string, unknown>[]) : [];
  const chaine = (v: unknown) => (typeof v === "string" ? v : "");
  const morceaux = parts.map((p) => {
    switch (p?.type) {
      case "text":
        return chaine(p.text);
      case "image":
      case "audio":
        return `[${p.type === "image" ? "image" : "son"} ${chaine(p.mimeType)} rendu par l'outil, non transmis au modèle]`;
      case "resource": {
        const r = (p.resource ?? {}) as Record<string, unknown>;
        if (typeof r.text === "string") return `[ressource ${chaine(r.uri)}]\n${r.text}`;
        return `[ressource binaire ${chaine(r.uri)} ${chaine(r.mimeType)}, non transmise au modèle]`;
      }
      case "resource_link":
        return `[lien vers une ressource : ${chaine(p.name) || chaine(p.title)} ${chaine(p.uri)}]`.replace(/\s+\]$/, "]");
      default:
        return `[${chaine(p?.type) || "contenu"}]`;
    }
  });
  const texte = morceaux.join("\n").trim();
  if (texte) return texte;
  if (result.structuredContent !== undefined) return JSON.stringify(result.structuredContent, null, 2);
  return "";
}

/**
 * Traduit les refus du serveur de fichiers en quelque chose d'actionnable.
 *
 * Le serveur MCP de fichiers ne voit que le dossier de travail, et refuse tout
 * le reste par « Access denied - path outside allowed directories ». Le modèle
 * relaie cette phrase telle quelle, en anglais, sans dire quel est ce dossier
 * ni comment en changer : l'utilisateur en conclut que l'agent « est
 * restreint » et n'a aucune piste. Signalé par le client le 20/09/2026.
 *
 * On ne lève pas la limite — c'est elle qui empêche un agent de se promener
 * dans tout le disque. On explique où elle est et comment la déplacer.
 */
function expliquer(texte: string): string {
  if (!/access denied|outside allowed directories|not allowed/i.test(texte)) return texte;
  return (
    `${texte}\n\n` +
    `Ce chemin est hors des emplacements ouverts à l'agent, qui sont ` +
    `${workspaces().map((c) => `« ${c} »`).join(", ")}. L'agent ne voit que ` +
    `cela. Pour travailler ailleurs, changez le dossier depuis l'écran Cowork ` +
    `(panneau de droite, « Dossier ») — « Tout mon poste » ouvre le dossier ` +
    `personnel et les disques montés d'un coup.`
  );
}


/**
 * Change l'espace de travail de Cowork et relance le serveur de fichiers.
 *
 * Le périmètre est un argument de lancement du serveur : il faut donc l'arrêter
 * et le relancer. L'opération est brève, et c'est le prix d'une garantie forte —
 * l'agent ne peut rien atteindre en dehors de ce qui lui a été désigné.
 */
export async function setWorkspace(
  chemins: string | string[],
): Promise<{ ok: boolean; error?: string }> {
  const liste = (Array.isArray(chemins) ? chemins : [chemins]).filter(Boolean);
  if (liste.length === 0) return { ok: false, error: "Aucun dossier fourni." };

  espaceCourant = liste[0];
  espacesCourants = liste;

  const entree = servers.get("fichiers");
  if (!entree) return { ok: false, error: "Serveur de fichiers introuvable." };

  entree.config = {
    ...entree.config,
    description:
      liste.length === 1
        ? `Lecture et écriture dans ${liste[0]}`
        : `Lecture et écriture dans ${liste.length} emplacements, à partir de ${liste[0]}`,
    args: ["-y", "@modelcontextprotocol/server-filesystem@2026.8.31", ...liste],
  };

  await stopServer("fichiers");
  const resultat = await startServer("fichiers");
  if (resultat.ok) ecrireEspace(liste);
  return resultat;
}
