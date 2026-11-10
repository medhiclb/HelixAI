import { execFile } from "node:child_process";
import { createReadStream, existsSync, readFileSync, readdirSync } from "node:fs";
import { stat } from "node:fs/promises";
import { homedir, platform } from "node:os";
import { basename, join } from "node:path";
import { promisify } from "node:util";
import { t } from "./langue.ts";
import { baseCode, messagesCodeLocaux, sessionsCodeLocales, type SourceCode } from "./importCodeLocal.ts";

const exec = promisify(execFile);

/**
 * Import sans export : ce que les autres logiciels d'IA laissent sur ce poste.
 *
 * Demandé le 24/09/2026 : « sur Codex ou Claude, on importe automatiquement ».
 * Codex reprend, à son installation, la configuration de Claude Code ; Helix
 * fait de même, et plus : il trouve les logiciels d'IA installés, dit ce
 * qu'il peut en reprendre, et le reprend au clic.
 *
 * Ce qui se lit, mesuré sur le poste du client ce jour-là :
 *  - Claude Code : un fichier JSONL par conversation (~/.claude/projects),
 *    avec le dossier de travail et un titre ; instructions ~/.claude/CLAUDE.md ;
 *  - Codex : un JSONL par session (~/.codex/sessions), messages de la personne
 *    et de l'agent, dossier de travail ; instructions ~/.codex/AGENTS.md ;
 *  - Cursor : conversations dans sa base SQLite (state.vscdb), lue par
 *    l'outil `sqlite3` du système en lecture seule ; format relevé sur la
 *    version 14 de ses données, mais le poste du client n'avait que des
 *    brouillons vides : lecture pas encore éprouvée sur de vraies conversations ;
 * Ce qui ne se lit pas, et qu'on dit :
 *  - l'application ChatGPT : conversations chiffrées sur le disque ;
 *  - l'application Claude : conversations sur les serveurs d'Anthropic.
 *    Pour ces deux-là, l'export officiel (Paramètres > Importer) reste la voie.
 *
 * Rien n'est envoyé nulle part : la passerelle lit, l'écran choisit, le poste
 * range (même chemin que l'import d'une archive). Seulement sur un poste
 * autonome : sur une instance d'entreprise, ces fichiers seraient ceux du
 * serveur, pas ceux de la personne (index.ts le refuse).
 *
 * ── Par morceaux (25/09/2026) ─────────────────────────────────────────────
 *
 * La première version lisait tout d'un coup, fichiers entiers en mémoire, et
 * rendait tous les messages en une réponse. Mesuré sur un jeu factice de
 * 2 000 conversations Claude Code (4,7 Go de fichiers) : 1,6 s pendant
 * lesquelles la passerelle ne répondait à rien, 695 Mo de mémoire, 18 Mo de
 * réponse, et seulement 500 conversations, prises dans l'ordre du disque et
 * non les plus récentes. Désormais, en deux temps :
 *
 *  1. **la liste** (`pageLogiciel`), page par page : titres, dates, taille et
 *     nombre de messages, sans les messages. Chaque fichier est lu ligne à
 *     ligne (`lignesDe`), la boucle d'évènements rendue entre deux fichiers ;
 *     l'écran affiche l'avancement entre deux pages ;
 *  2. **le contenu** (`contenuLogiciel`) des seuls Chats choisis, par lots
 *     bornés, au moment d'importer.
 *
 * La mémoire ne dépend plus du nombre de conversations : une ligne à la fois,
 * une page de résumés, un lot de Chats choisis.
 */

export interface MessageLu {
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}
export interface ChatLu {
  cle: string;
  titre: string;
  creeLe: string;
  modifieLe: string;
  messages: MessageLu[];
  projet?: string;
  taille: number;
  /** Nombre de messages : seul renseigné dans la liste, où `messages` reste vide. */
  nbMessages: number;
}
export interface ProjetLu {
  dossierCode?: string;
  cle: string;
  nom: string;
  description: string;
  instructions: string;
  documents: { nom: string; contenu: string }[];
}
type Source = "claude-code" | "codex" | "cursor" | SourceCode;

/** Une page de la liste : des résumés (`messages` vide), et où reprendre. */
export interface PageImport {
  source: Source;
  chats: ChatLu[];
  projets: ProjetLu[];
  /** Instructions générales de la personne pour ce logiciel (CLAUDE.md, AGENTS.md), sur la première page. */
  instructions: string;
  /** Conversations à parcourir en tout, et la position de la page suivante (null : c'était la dernière). */
  total: number;
  suivant: number | null;
}

/** Le contenu de Chats choisis ; `restantes` : ce qui n'a pas tenu dans ce lot, à redemander. */
export interface ContenuImport {
  chats: ChatLu[];
  restantes: string[];
}

export interface Logiciel {
  id: "claude-code" | "codex" | "cursor" | "chatgpt" | "claude" | SourceCode;
  nom: string;
  present: boolean;
  /** Ce que Helix peut en reprendre. */
  lisible: boolean;
  conversations: number;
  instructions: boolean;
  /** Pourquoi ce qui manque manque, dans les mots de la personne. */
  note: string;
}

const MAISON = homedir();
const TEXTE_MAX = 20_000;
/** Conversations proposées au plus, les plus récentes (la première version en prenait 500, au hasard du disque). */
const LISTE_MAX = 5_000;
/*
 * Une page de la liste : 50 conversations ou 64 Mo de fichiers, le premier
 * atteint. Mesuré le 25/09/2026 sur le jeu factice : une page de 64 Mo se lit
 * en environ 0,3 s ; l'écran avance donc plusieurs fois par seconde.
 */
const PAGE_FICHIERS = 50;
const PAGE_OCTETS = 64_000_000;
/** Contenu rendu par lot au plus, en caractères : l'écran redemande le reste. */
const CONTENU_MAX = 16_000_000;
/*
 * Une ligne plus longue est sautée : chez Claude Code, ce sont des résultats
 * d'outils (fichiers lus, images en base64), jamais le texte de la
 * conversation, que `TEXTE_MAX` couperait de toute façon.
 */
const LIGNE_MAX = 16 * 1024 * 1024;

function lireTexte(f: string, max = 50_000): string {
  try {
    return readFileSync(f, "utf8").slice(0, max);
  } catch {
    return "";
  }
}

function fichiers(dossier: string, extension: string, profondeur: number): string[] {
  const sortie: string[] = [];
  const parcourir = (d: string, p: number) => {
    let entrees: import("node:fs").Dirent[] = [];
    try {
      entrees = readdirSync(d, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entrees) {
      const chemin = join(d, e.name);
      if (e.isDirectory() && p > 0) parcourir(chemin, p - 1);
      else if (e.isFile() && e.name.endsWith(extension)) sortie.push(chemin);
    }
  };
  parcourir(dossier, profondeur);
  return sortie;
}

/**
 * Les lignes d'un fichier, lues par blocs d'1 Mo : jamais le fichier entier en
 * mémoire (la première version le chargeait d'un bloc, 60 Mo et plus).
 */
async function* lignesDe(chemin: string): AsyncGenerator<string> {
  const flux = createReadStream(chemin, { highWaterMark: 1 << 20 });
  let morceaux: Buffer[] = [];
  let longueur = 0;
  let tropLongue = false;
  try {
    for await (const bloc of flux as AsyncIterable<Buffer>) {
      let debut = 0;
      for (;;) {
        const fin = bloc.indexOf(10, debut);
        if (fin < 0) break;
        if (!tropLongue) {
          morceaux.push(bloc.subarray(debut, fin));
          yield Buffer.concat(morceaux).toString("utf8");
        }
        morceaux = [];
        longueur = 0;
        tropLongue = false;
        debut = fin + 1;
      }
      if (debut < bloc.length && !tropLongue) {
        longueur += bloc.length - debut;
        if (longueur > LIGNE_MAX) {
          tropLongue = true;
          morceaux = [];
        } else {
          morceaux.push(bloc.subarray(debut));
        }
      }
    }
    if (!tropLongue && morceaux.length > 0) yield Buffer.concat(morceaux).toString("utf8");
  } finally {
    flux.destroy();
  }
}

const iso = (v: unknown) => (typeof v === "string" && !Number.isNaN(Date.parse(v)) ? new Date(v).toISOString() : new Date().toISOString());
const couper = (s: string) => (s.length > TEXTE_MAX ? `${s.slice(0, TEXTE_MAX)}\n[…]` : s);
// Appelée pendant une requête : le titre de repli est dans la langue de la personne (langue.ts).
const titreDe = (premier: string) => premier.replace(/\s+/g, " ").trim().slice(0, 70) || t("Conversation importée");
const rendreLaMain = () => new Promise<void>((r) => setImmediate(r));

/**
 * Ce qu'on retient des messages d'une conversation pendant sa lecture. Pour la
 * liste, seulement des comptes (le nombre, la taille, les dates, la première
 * demande pour le titre) ; pour le contenu, les messages eux-mêmes.
 */
class Collecte {
  readonly messages: MessageLu[] | null;
  n = 0;
  /** Taille une fois rangée, hors titre, comme la calculait la première version. */
  taille = 200;
  premiereDemande: string | null = null;
  premier: string | null = null;
  dernier: string | null = null;
  constructor(garder: boolean) {
    this.messages = garder ? [] : null;
  }
  ajouter(m: MessageLu): void {
    this.n += 1;
    this.taille += m.content.length + 80;
    if (this.premiereDemande === null && m.role === "user") this.premiereDemande = m.content;
    this.premier ??= m.createdAt;
    this.dernier = m.createdAt;
    this.messages?.push(m);
  }
}

/** Ce qu'une lecture apprend en plus des messages. */
interface Entete {
  titre: string;
  dossier?: string;
  creeLe?: string;
  modifieLe?: string;
}

/** Une conversation à lire : un fichier (Claude Code, Codex), ou une entrée de la base de Cursor. */
interface Entree {
  cle: string;
  /** Chemin du fichier, ou identifiant de la conversation Cursor. */
  ou: string;
  octets: number;
  date: number;
}

/** Les dossiers de travail deviennent des projets Helix, avec leurs instructions (CLAUDE.md, AGENTS.md). */
function projetDe(dossier: string | undefined, projets: Map<string, ProjetLu> | null): string | undefined {
  if (!dossier) return undefined;
  if (projets && !projets.has(dossier)) {
    const instructions = ["CLAUDE.md", "AGENTS.md"].map((f) => lireTexte(join(dossier, f), 20_000)).filter(Boolean).join("\n\n");
    projets.set(dossier, { cle: dossier, nom: basename(dossier) || dossier, description: dossier, instructions, documents: [], dossierCode: dossier });
  }
  return dossier;
}

/* ------------------------------------------------------------------ */
/* Claude Code                                                         */
/* ------------------------------------------------------------------ */

function texteClaude(contenu: unknown): string {
  if (typeof contenu === "string") return contenu;
  if (!Array.isArray(contenu)) return "";
  // Seul le texte : les appels d'outils et leurs résultats n'ont pas de sens hors de Claude Code.
  return contenu
    .filter((p) => (p as { type?: string }).type === "text")
    .map((p) => String((p as { text?: string }).text ?? ""))
    .join("\n");
}

async function lireClaudeCode(chemin: string, c: Collecte): Promise<Entete> {
  let titre = "";
  let dossier: string | undefined;
  for await (const ligne of lignesDe(chemin)) {
    if (!ligne.trim()) continue;
    let d: Record<string, unknown>;
    try {
      d = JSON.parse(ligne) as Record<string, unknown>;
    } catch {
      continue;
    }
    if (d.type === "custom-title" || d.type === "ai-title") {
      titre = String(d.customTitle ?? d.title ?? d.aiTitle ?? titre);
      continue;
    }
    if ((d.type !== "user" && d.type !== "assistant") || d.isSidechain || d.isCompactSummary || d.isMeta) continue;
    dossier ??= typeof d.cwd === "string" ? d.cwd : undefined;
    const texte = texteClaude((d.message as { content?: unknown } | undefined)?.content).trim();
    // Les messages système de Claude Code (commandes, rappels) ne sont pas la conversation.
    if (!texte || /^<(command|local-command|system-reminder)/.test(texte)) continue;
    c.ajouter({ role: d.type as "user" | "assistant", content: couper(texte), createdAt: iso(d.timestamp) });
  }
  return { titre, dossier };
}

/* ------------------------------------------------------------------ */
/* Codex                                                               */
/* ------------------------------------------------------------------ */

interface EnregistrementCodex {
  type?: string;
  timestamp?: unknown;
  payload?: Record<string, unknown>;
}

/** Même lecture bornée pour le repérage du format et pour les messages. */
async function* enregistrementsCodex(chemin: string): AsyncGenerator<EnregistrementCodex> {
  for await (const ligne of lignesDe(chemin)) {
    if (!ligne.trim()) continue;
    try {
      const d: unknown = JSON.parse(ligne);
      if (d && typeof d === "object" && !Array.isArray(d)) yield d as EnregistrementCodex;
    } catch { /* Une ligne interrompue ne condamne pas le reste de la session. */ }
  }
}

/** Le texte public seulement : ni raisonnement privé, ni appels d'outils. */
function messageCodex(d: EnregistrementCodex, moderne: boolean): MessageLu | null {
  const p = d.payload;
  if (!p || typeof p !== "object" || Array.isArray(p)) return null;
  let role: "user" | "assistant";
  let texte = "";
  if (moderne) {
    if (d.type !== "response_item" || p.type !== "message" || (p.role !== "user" && p.role !== "assistant")) return null;
    role = p.role;
    if (role === "assistant" && p.channel != null && p.channel !== "final" && p.channel !== "commentary") return null;
    if (typeof p.content === "string") texte = p.content;
    else if (Array.isArray(p.content)) texte = p.content.flatMap((bloc: unknown) => {
      if (!bloc || typeof bloc !== "object" || Array.isArray(bloc)) return [];
      const b = bloc as Record<string, unknown>;
      return (b.type === "input_text" || b.type === "output_text" || b.type === "text") && typeof b.text === "string" ? [b.text] : [];
    }).join("\n");
  } else {
    if (d.type !== "event_msg" || (p.type !== "user_message" && p.type !== "agent_message")) return null;
    role = p.type === "user_message" ? "user" : "assistant";
    texte = typeof p.message === "string" ? p.message : "";
  }
  texte = texte.trim();
  if (role === "user") {
    // Les deux en-têtes de l'application (ancien et actuel), sans les fichiers et le contexte qui précèdent.
    const demande = /^##\s*My request(?: for Codex)?:[ \t]*\s*([\s\S]*)$/im.exec(texte);
    if (demande) texte = demande[1]!.trim();
    else if (/^# Files mentioned by the user/.test(texte) || (texte.startsWith("# AGENTS.md instructions for ") && texte.includes("<INSTRUCTIONS>"))) texte = "";
    else {
      // Retrait linéaire des enveloppes techniques en tête : une longue suite
      // de balises non fermées ne doit pas bloquer la lecture du poste.
      for (;;) {
        const contexte = /^<(environment_context|in-app-browser-context|external_codex_apps_open_page|external_codex_apps_selected_page_part_\d+_of_\d+)\b[^>]*>/.exec(texte);
        if (!contexte) break;
        const fermeture = `</${contexte[1]}>`;
        const fin = texte.indexOf(fermeture, contexte[0].length);
        if (fin < 0) { texte = ""; break; }
        texte = texte.slice(fin + fermeture.length).trimStart();
      }
    }
  }
  return texte ? { role, content: couper(texte), createdAt: iso(d.timestamp) } : null;
}

async function lireCodex(chemin: string, c: Collecte): Promise<Entete> {
  // 10/11/2026 : les sessions récentes n'émettent plus user_message/agent_message.
  // Choisir le format par rôle évite leurs copies quand les deux sont présents,
  // tout en conservant un rôle qui ne serait disponible que dans l'ancien format.
  const modernes = new Set<"user" | "assistant">();
  for await (const d of enregistrementsCodex(chemin)) {
    const m = messageCodex(d, true);
    if (m) modernes.add(m.role);
    if (modernes.size === 2) break;
  }
  let dossier: string | undefined;
  for await (const d of enregistrementsCodex(chemin)) {
    if (d.type === "session_meta" && typeof d.payload?.cwd === "string") dossier ??= d.payload.cwd;
    const moderne = d.type === "response_item";
    const m = messageCodex(d, moderne);
    if (m && moderne === modernes.has(m.role)) c.ajouter(m);
  }
  return { titre: "", dossier };
}

/* ------------------------------------------------------------------ */
/* Cursor                                                              */
/* ------------------------------------------------------------------ */

/*
 * La base de Cursor, lue en lecture seule par l'outil `sqlite3` du système
 * (livré avec macOS et la plupart des Linux) : la passerelle tourne sur un
 * Node sans module SQLite. Sans l'outil (Windows), Cursor n'est pas lisible,
 * et on le dit. Appelé sans attendre la fin (la première version bloquait la
 * passerelle jusqu'à 60 s par requête).
 */
const baseCursor = () => join(appSupport("Cursor"), "User", "globalStorage", "state.vscdb");

async function sqlite(base: string, requete: string): Promise<Record<string, unknown>[]> {
  try {
    const { stdout } = await exec("sqlite3", ["-readonly", "-json", base, requete], { encoding: "utf8", maxBuffer: 512 * 1024 * 1024, timeout: 60_000 });
    return stdout.trim() ? (JSON.parse(stdout) as Record<string, unknown>[]) : [];
  } catch {
    return [];
  }
}

async function sqliteDisponible(): Promise<boolean> {
  try {
    await exec("sqlite3", ["-version"], { timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

/** Texte d'une bulle Cursor : `text`, sinon le texte brut de `richText` (éditeur Lexical). */
function texteBulle(b: Record<string, unknown>): string {
  if (typeof b.text === "string" && b.text.trim()) return b.text;
  if (typeof b.richText === "string" && b.richText.startsWith("{")) {
    try {
      const arbre = JSON.parse(b.richText) as { root?: unknown };
      const pile: unknown[] = [arbre.root ?? arbre];
      const morceaux: string[] = [];
      while (pile.length) {
        const n = pile.pop() as { text?: unknown; children?: unknown[] } | null;
        if (!n || typeof n !== "object") continue;
        if (typeof n.text === "string") morceaux.push(n.text);
        if (Array.isArray(n.children)) pile.push(...[...n.children].reverse());
      }
      return morceaux.join(" ");
    } catch {
      return "";
    }
  }
  return "";
}

const dateCursor = (v: unknown) => (typeof v === "number" ? new Date(v).toISOString() : iso(v));
/** Un identifiant de conversation Cursor sûr à placer dans une requête (lettres, chiffres, tirets). */
const idCursorSur = (id: string) => /^[\w-]+$/.test(id);

/** Les conversations Cursor qui ont des messages, les plus récentes d'abord. */
async function entreesCursor(): Promise<Entree[]> {
  const entrees: Entree[] = [];
  for (const l of await sqlite(baseCursor(), "select key, value from cursorDiskKV where key like 'composerData:%'")) {
    let d: Record<string, unknown>;
    try {
      d = JSON.parse(String(l.value)) as Record<string, unknown>;
    } catch {
      continue;
    }
    const id = String(d.composerId ?? String(l.key).split(":")[1] ?? "");
    const aDesMessages =
      (Array.isArray(d.conversation) && d.conversation.length > 0) ||
      (Array.isArray(d.fullConversationHeadersOnly) && d.fullConversationHeadersOnly.length > 0);
    if (!aDesMessages || !idCursorSur(id)) continue;
    const date = Date.parse(dateCursor(d.lastUpdatedAt ?? d.createdAt));
    entrees.push({ cle: `cursor:${id}`, ou: id, octets: String(l.value).length, date: Number.isNaN(date) ? 0 : date });
  }
  return entrees.sort((a, b) => b.date - a.date).slice(0, LISTE_MAX);
}

async function lireCursor(id: string, c: Collecte): Promise<Entete | null> {
  if (!idCursorSur(id)) return null;
  const base = baseCursor();
  const [l] = await sqlite(base, `select value from cursorDiskKV where key = 'composerData:${id}'`);
  if (!l) return null;
  let d: Record<string, unknown>;
  try {
    d = JSON.parse(String(l.value)) as Record<string, unknown>;
  } catch {
    return null;
  }
  let bulles: Record<string, unknown>[] = [];
  if (Array.isArray(d.conversation) && d.conversation.length > 0) {
    bulles = d.conversation as Record<string, unknown>[];
  } else if (Array.isArray(d.fullConversationHeadersOnly) && d.fullConversationHeadersOnly.length > 0) {
    // Format récent : chaque bulle est rangée à part, sous « bubbleId:<conversation>:<bulle> ».
    const parId = new Map(
      (await sqlite(base, `select key, value from cursorDiskKV where key like 'bubbleId:${id}:%'`)).map((b) => [String(b.key).split(":")[2], b.value]),
    );
    for (const h of d.fullConversationHeadersOnly as { bubbleId?: string }[]) {
      const brut = h.bubbleId ? parId.get(h.bubbleId) : undefined;
      if (typeof brut !== "string") continue;
      try {
        bulles.push(JSON.parse(brut) as Record<string, unknown>);
      } catch {
        /* bulle illisible */
      }
    }
  }
  for (const b of bulles) {
    // 1 : la personne, 2 : l'agent.
    const role = b.type === 1 ? "user" : b.type === 2 ? "assistant" : null;
    const texte = texteBulle(b).trim();
    if (role && texte) c.ajouter({ role, content: couper(texte), createdAt: dateCursor(b.createdAt ?? d.createdAt) });
  }
  return {
    titre: typeof d.name === "string" ? d.name.trim() : "",
    creeLe: dateCursor(d.createdAt),
    modifieLe: dateCursor(d.lastUpdatedAt ?? d.createdAt),
  };
}

/* ------------------------------------------------------------------ */
/* Liste et contenu                                                    */
/* ------------------------------------------------------------------ */

const DOSSIERS: Record<Exclude<Source, "cursor" | SourceCode>, { dossiers: string[]; profondeur: number }> = {
  "claude-code": { dossiers: [join(MAISON, ".claude", "projects")], profondeur: 1 },
  codex: { dossiers: [join(MAISON, ".codex", "sessions"), join(MAISON, ".codex", "archived_sessions")], profondeur: 4 },
};

/** Les fichiers de conversation d'une source, les plus récents d'abord (date de modification). */
async function entreesFichiers(source: Exclude<Source, "cursor" | SourceCode>): Promise<Entree[]> {
  const { dossiers, profondeur } = DOSSIERS[source];
  const chemins = dossiers.flatMap((d) => fichiers(d, ".jsonl", profondeur));
  const entrees: Entree[] = [];
  // Par lots : quelques milliers de `stat` d'un coup ouvriraient autant de fichiers à la fois.
  for (let i = 0; i < chemins.length; i += 64) {
    const lot = await Promise.all(
      chemins.slice(i, i + 64).map(async (ou) => {
        try {
          const s = await stat(ou);
          return { cle: `${source}:${basename(ou, ".jsonl")}`, ou, octets: s.size, date: s.mtimeMs };
        } catch {
          return null;
        }
      }),
    );
    for (const e of lot) if (e) entrees.push(e);
  }
  return entrees.sort((a, b) => b.date - a.date).slice(0, LISTE_MAX);
}

/*
 * La liste d'une source est relevée au début de chaque parcours (page 0) et
 * gardée pour les pages suivantes et le contenu : sans cela, une conversation
 * qui s'allonge pendant l'import changerait de rang, et une page en sauterait
 * une autre.
 */
const sessionsLocales = new Map<SourceCode, Map<string, Record<string, unknown>>>();
const releves = new Map<Source, { quand: number; entrees: Entree[] }>();
const RELEVE_MS = 30 * 60_000;

async function entreesDe(source: Source, neuf: boolean): Promise<Entree[]> {
  const deja = releves.get(source);
  if (!neuf && deja && Date.now() - deja.quand < RELEVE_MS) return deja.entrees;
  let entrees: Entree[];
  if (source === "opencode" || source === "zcode") {
    const sessions = await sessionsCodeLocales(source);
    const metadonnees = new Map<string, Record<string, unknown>>();
    entrees = sessions.filter(s => typeof s.id === "string" && /^[\w-]{1,160}$/.test(s.id)).map(s => {
      const id = String(s.id);
      metadonnees.set(id, s);
      return { cle: `${source}:${id}`, ou: id, octets: 1, date: Number(s.time_updated) || 0 };
    });
    sessionsLocales.set(source, metadonnees);
  } else entrees = source === "cursor" ? await entreesCursor() : await entreesFichiers(source);
  releves.set(source, { quand: Date.now(), entrees });
  return entrees;
}

async function lire(source: Source, e: Entree, c: Collecte): Promise<Entete | null> {
  try {
    if (source === "opencode" || source === "zcode") {
      const s = sessionsLocales.get(source)?.get(e.ou);
      if (!s) return null;
      if (c.messages === null) {
        c.n = Number(s.messages) || 0;
        c.taille = Number(s.taille) || 200;
        return { titre: String(s.title ?? ""), dossier: typeof s.directory === "string" ? s.directory : undefined,
          creeLe: dateCursor(s.time_created), modifieLe: dateCursor(s.time_updated) };
      }
      const parMessage = new Map<string, { role: "user" | "assistant"; content: string; createdAt: string }>();
      for (const m of await messagesCodeLocaux(source, e.ou)) {
        if ((m.role !== "user" && m.role !== "assistant") || typeof m.text !== "string" || !m.text.trim()) continue;
        const id = String(m.id);
        const deja = parMessage.get(id);
        if (deja) deja.content = couper(`${deja.content}\n${m.text}`);
        else parMessage.set(id, { role: m.role, content: couper(m.text), createdAt: dateCursor(m.time_created) });
      }
      for (const message of parMessage.values()) c.ajouter(message);
      return { titre: String(s.title ?? ""), dossier: typeof s.directory === "string" ? s.directory : undefined,
        creeLe: dateCursor(s.time_created), modifieLe: dateCursor(s.time_updated) };
    }
    if (source === "claude-code") return await lireClaudeCode(e.ou, c);
    if (source === "codex") return await lireCodex(e.ou, c);
    return await lireCursor(e.ou, c);
  } catch {
    if (source === "opencode" || source === "zcode") throw new Error(t("L'historique local n'a pas pu être lu. Fermez le logiciel d'origine, puis réessayez."));
    // Fichier disparu ou illisible entre le relevé et la lecture : on passe au suivant.
    return null;
  }
}

function chatDe(e: Entree, entete: Entete, c: Collecte, projets: Map<string, ProjetLu> | null): ChatLu | null {
  if (c.n === 0) return null;
  const titre = entete.titre || titreDe(c.premiereDemande ?? "");
  return {
    cle: e.cle,
    titre,
    creeLe: entete.creeLe ?? c.premier ?? new Date().toISOString(),
    modifieLe: entete.modifieLe ?? c.dernier ?? new Date().toISOString(),
    messages: c.messages ?? [],
    projet: projetDe(entete.dossier, projets),
    taille: titre.length + c.taille,
    nbMessages: c.n,
  };
}

const estSource = (id: string): id is Source => id === "claude-code" || id === "codex" || id === "cursor" || id === "opencode" || id === "zcode";

function instructionsDe(source: Source): string {
  if (source === "claude-code") return lireTexte(join(MAISON, ".claude", "CLAUDE.md"));
  if (source === "codex") return lireTexte(join(MAISON, ".codex", "AGENTS.md"));
  if (source === "opencode" || source === "zcode") return "";
  return lireTexte(join(MAISON, ".cursorrules"));
}

/**
 * Une page de la liste, à partir de la conversation `depuis` (0 : relève la
 * liste à neuf). Des résumés seulement : `messages` vide, `nbMessages` et
 * `taille` renseignés.
 */
export async function pageLogiciel(id: string, depuis: number): Promise<PageImport | null> {
  if (!estSource(id)) return null;
  const entrees = await entreesDe(id, depuis === 0);
  const projets = new Map<string, ProjetLu>();
  const chats: ChatLu[] = [];
  let i = Math.max(0, Math.floor(depuis));
  const debut = i;
  let octets = 0;
  while (i < entrees.length && i - debut < PAGE_FICHIERS && octets < PAGE_OCTETS) {
    const e = entrees[i++]!;
    octets += e.octets;
    const c = new Collecte(false);
    const entete = await lire(id, e, c);
    const chat = entete ? chatDe(e, entete, c, projets) : null;
    if (chat) chats.push(chat);
    // Entre deux conversations, la passerelle répond aux autres demandes.
    await rendreLaMain();
  }
  return {
    source: id,
    chats,
    projets: [...projets.values()],
    instructions: debut === 0 ? instructionsDe(id) : "",
    total: entrees.length,
    suivant: i < entrees.length ? i : null,
  };
}

/**
 * Le contenu des Chats choisis, désignés par leur clé. Une clé inconnue de la
 * liste relevée est ignorée : on ne lit que ce que la liste a montré, jamais
 * un chemin venu de la requête.
 */
export async function contenuLogiciel(id: string, cles: string[]): Promise<ContenuImport | null> {
  if (!estSource(id)) return null;
  const parCle = new Map((await entreesDe(id, false)).map((e) => [e.cle, e]));
  const chats: ChatLu[] = [];
  const restantes: string[] = [];
  let taille = 0;
  for (const [k, cle] of cles.entries()) {
    if (taille >= CONTENU_MAX) {
      restantes.push(...cles.slice(k));
      break;
    }
    const e = parCle.get(cle);
    if (!e) continue;
    const c = new Collecte(true);
    const entete = await lire(id, e, c);
    const chat = entete ? chatDe(e, entete, c, null) : null;
    if (chat) {
      chats.push(chat);
      taille += chat.taille;
    }
    await rendreLaMain();
  }
  return { chats, restantes };
}

/* ------------------------------------------------------------------ */
/* Ce qui est installé                                                 */
/* ------------------------------------------------------------------ */

const appSupport = (nom: string) =>
  platform() === "darwin"
    ? join(MAISON, "Library", "Application Support", nom)
    : platform() === "win32"
      ? join(process.env.APPDATA ?? join(MAISON, "AppData", "Roaming"), nom)
      : join(MAISON, ".config", nom);

const compter = (dossier: string, profondeur: number) => fichiers(dossier, ".jsonl", profondeur).length;

export async function logicielsTrouves(): Promise<Logiciel[]> {
  const claudeCode = existsSync(join(MAISON, ".claude"));
  const codex = existsSync(join(MAISON, ".codex"));
  const cursor = existsSync(join(MAISON, ".cursor")) || existsSync(baseCursor());
  const cursorLisible = cursor && existsSync(baseCursor()) && (await sqliteDisponible());
  const chatgpt = existsSync(appSupport("com.openai.chat")) || existsSync(appSupport("ChatGPT"));
  const claude = existsSync(appSupport("Claude"));
  const code = await Promise.all((["opencode", "zcode"] as const).filter(source => existsSync(baseCode(source))).map(async source => {
    let lisible = true;
    let conversations = 0;
    try { conversations = (await sessionsCodeLocales(source)).length; } catch { lisible = false; }
    return { id: source, nom: source === "opencode" ? "OpenCode" : "Zcode", present: true, lisible, conversations, instructions: false,
      note: lisible ? t("Conversations, dossiers de projet et instructions.") : t("L'historique local n'a pas pu être lu. Fermez le logiciel d'origine, puis réessayez.") };
  }));
  return [
    ...code,
    {
      id: "claude-code",
      nom: "Claude Code",
      present: claudeCode,
      lisible: claudeCode,
      conversations: claudeCode ? compter(join(MAISON, ".claude", "projects"), 1) : 0,
      instructions: existsSync(join(MAISON, ".claude", "CLAUDE.md")),
      note: t("Conversations, dossiers de projet et instructions."),
    },
    {
      id: "codex",
      nom: "Codex",
      present: codex,
      lisible: codex,
      conversations: codex ? compter(join(MAISON, ".codex", "sessions"), 4) + compter(join(MAISON, ".codex", "archived_sessions"), 4) : 0,
      instructions: existsSync(join(MAISON, ".codex", "AGENTS.md")),
      note: t("Conversations, dossiers de projet et instructions."),
    },
    {
      id: "cursor",
      nom: "Cursor",
      present: cursor,
      lisible: cursorLisible,
      conversations: cursorLisible ? (await entreesDe("cursor", true)).length : 0,
      instructions: existsSync(join(MAISON, ".cursorrules")),
      note: cursorLisible
        ? t("Conversations de l'agent et du Chat.")
        : t("Ses conversations sont dans sa propre base, que Helix ne peut pas lire sur cet ordinateur."),
    },
    {
      id: "chatgpt",
      nom: "ChatGPT",
      present: chatgpt,
      lisible: false,
      conversations: 0,
      instructions: false,
      note: t("L'application chiffre ses conversations sur le disque : passez par l'export de ChatGPT, ci-dessous."),
    },
    {
      id: "claude",
      nom: "Claude",
      present: claude,
      lisible: false,
      conversations: 0,
      instructions: false,
      note: t("Les conversations sont sur les serveurs d'Anthropic : passez par l'export de Claude, ci-dessous."),
    },
  ].filter((l) => l.present) as Logiciel[];
}
