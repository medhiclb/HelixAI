import { apiFetch } from "./endpoint";
/**
 * Reprendre ses Chats et ses projets depuis ChatGPT, Claude ou Gemini.
 *
 * Les trois services exportent les données d'un compte en une archive ZIP
 * (ChatGPT : Paramètres, Contrôle des données, Exporter ; Claude : Paramètres,
 * Confidentialité, Exporter les données ; Gemini : Google Takeout, « Mes
 * activités », « Applications Gemini », lu par importGemini.ts). On la lit
 * ici, sur le poste : rien ne part ailleurs que dans l'instance de la personne.
 *
 * L'archive peut peser des gigaoctets (ChatGPT y met les images) : on n'en lit
 * que le répertoire, puis les seuls fichiers JSON utiles, par tranches du
 * fichier (`Blob.slice`), jamais l'archive entière en mémoire. Décompression
 * par `DecompressionStream`, sans bibliothèque.
 */

import { t, tf } from "@/lib/i18n";
import { GEMINI_FICHIER_MAX, activitesDepuisHtml, activitesDepuisJson, chatsDepuisActivites, type LectureGemini } from "./importGemini";

/* ------------------------------------------------------------------ */
/* Lecture ZIP                                                          */
/* ------------------------------------------------------------------ */

export interface EntreeZip {
  nom: string;
  methode: number;
  tailleCompressee: number;
  /** Taille annoncée une fois décompressée (le répertoire peut mentir : `lireEntree` compte aussi). */
  tailleNormale: number;
  debutEnTete: number;
}

const u16 = (v: DataView, o: number) => v.getUint16(o, true);
const u32 = (v: DataView, o: number) => v.getUint32(o, true);
const u64 = (v: DataView, o: number) => Number(v.getBigUint64(o, true));

async function tranche(f: Blob, debut: number, fin: number): Promise<DataView> {
  return new DataView(await f.slice(debut, fin).arrayBuffer());
}

/** Le répertoire d'une archive ZIP (ZIP64 compris). */
export async function repertoire(f: Blob): Promise<EntreeZip[]> {
  const queue = Math.min(f.size, 65_557);
  const fin = await tranche(f, f.size - queue, f.size);
  let eocd = -1;
  for (let i = fin.byteLength - 22; i >= 0; i--) {
    if (u32(fin, i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error(t("Ce fichier n'est pas une archive ZIP lisible. Choisissez l'archive telle que ChatGPT, Claude ou Google l'a envoyée."));
  let nombre = u16(fin, eocd + 10);
  let tailleRep = u32(fin, eocd + 12);
  let debutRep = u32(fin, eocd + 16);
  // ZIP64 : le vrai répertoire est décrit juste avant.
  if (debutRep === 0xffffffff || nombre === 0xffff) {
    const loc = eocd - 20;
    if (loc >= 0 && u32(fin, loc) === 0x07064b50) {
      const ou = u64(fin, loc + 8);
      const z = await tranche(f, ou, ou + 56);
      nombre = u64(z, 32);
      tailleRep = u64(z, 40);
      debutRep = u64(z, 48);
    }
  }
  const rep = await tranche(f, debutRep, debutRep + tailleRep);
  const entrees: EntreeZip[] = [];
  const decodeur = new TextDecoder();
  let o = 0;
  for (let n = 0; n < nombre && o + 46 <= rep.byteLength; n++) {
    if (u32(rep, o) !== 0x02014b50) break;
    const methode = u16(rep, o + 10);
    let tailleCompressee = u32(rep, o + 20);
    let tailleNormale = u32(rep, o + 24);
    const lNom = u16(rep, o + 28);
    const lExtra = u16(rep, o + 30);
    const lComm = u16(rep, o + 32);
    let debutEnTete = u32(rep, o + 42);
    const nom = decodeur.decode(new Uint8Array(rep.buffer, rep.byteOffset + o + 46, lNom));
    // Champ ZIP64 : les valeurs à 0xffffffff y sont données en 64 bits, dans l'ordre.
    let e = o + 46 + lNom;
    const finExtra = e + lExtra;
    while (e + 4 <= finExtra) {
      const id = u16(rep, e);
      const taille = u16(rep, e + 2);
      if (id === 0x0001) {
        let p = e + 4;
        if (tailleNormale === 0xffffffff) {
          tailleNormale = u64(rep, p);
          p += 8;
        }
        if (tailleCompressee === 0xffffffff) {
          tailleCompressee = u64(rep, p);
          p += 8;
        }
        if (debutEnTete === 0xffffffff) debutEnTete = u64(rep, p);
      }
      e += 4 + taille;
    }
    entrees.push({ nom, methode, tailleCompressee, tailleNormale, debutEnTete });
    o += 46 + lNom + lExtra + lComm;
  }
  return entrees;
}

/**
 * Le contenu d'un fichier de l'archive, en texte. Avec `max`, la lecture
 * s'arrête dès que le fichier décompressé le dépasse (une archive qui annonce
 * une petite taille et se décompresse en gigaoctets ne remplit pas la
 * mémoire) : rend alors `null`.
 */
export async function lireEntree(f: Blob, e: EntreeZip): Promise<string>;
export async function lireEntree(f: Blob, e: EntreeZip, max: number): Promise<string | null>;
export async function lireEntree(f: Blob, e: EntreeZip, max?: number): Promise<string | null> {
  const entete = await tranche(f, e.debutEnTete, e.debutEnTete + 30);
  const debut = e.debutEnTete + 30 + u16(entete, 26) + u16(entete, 28);
  const brut = f.slice(debut, debut + e.tailleCompressee);
  if (e.methode !== 0 && e.methode !== 8) throw new Error(tf("Compression {0} non prise en charge dans cette archive.", e.methode));
  if (max === undefined) {
    if (e.methode === 0) return brut.text();
    return new Response(brut.stream().pipeThrough(new DecompressionStream("deflate-raw"))).text();
  }
  if (e.tailleNormale > max || (e.methode === 0 && brut.size > max)) return null;
  const flux = e.methode === 0 ? brut.stream() : brut.stream().pipeThrough(new DecompressionStream("deflate-raw"));
  const lecteur = flux.getReader();
  const decodeur = new TextDecoder();
  const morceaux: string[] = [];
  let lus = 0;
  for (;;) {
    const { done, value } = await lecteur.read();
    if (done) break;
    lus += value.byteLength;
    if (lus > max) {
      await lecteur.cancel().catch(() => undefined);
      return null;
    }
    morceaux.push(decodeur.decode(value, { stream: true }));
  }
  morceaux.push(decodeur.decode());
  return morceaux.join("");
}

/* ------------------------------------------------------------------ */
/* Ce qu'on importe                                                     */
/* ------------------------------------------------------------------ */

export interface MessageImporte {
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

export interface ChatImporte {
  cle: string;
  titre: string;
  creeLe: string;
  modifieLe: string;
  messages: MessageImporte[];
  /** Clé du projet d'origine, s'il y en a un. */
  projet?: string;
  /** Taille estimée une fois rangée, en caractères. */
  taille: number;
  /**
   * Nombre de messages, quand `messages` n'est pas encore là : un logiciel du
   * poste liste d'abord ses conversations, puis rend le contenu des seules
   * choisies (`completerChats`).
   */
  nbMessages?: number;
}

export interface ProjetImporte {
  dossierCode?: string;
  cle: string;
  nom: string;
  description: string;
  /** Instructions du projet (Claude : « prompt_template »). */
  instructions: string;
  documents: { nom: string; contenu: string }[];
}

export interface Import {
  source: "chatgpt" | "claude" | "gemini" | "claude-code" | "codex" | "cursor" | "opencode" | "zcode";
  chats: ChatImporte[];
  projets: ProjetImporte[];
  /** Instructions générales reprises d'un logiciel du poste (CLAUDE.md, AGENTS.md). */
  instructions?: string;
  /** Logiciel du poste dont les messages restent à demander pour les Chats choisis (`completerChats`). */
  aCompleter?: string;
  /** Ce que l'écran doit dire de la lecture (Gemini : comment les Chats ont été reconstitués, ce qui manque à l'export). */
  remarques?: string[];
}

/** Nom affiché d'une source d'import. */
export const NOM_SOURCE: Record<Import["source"], string> = {
  chatgpt: "ChatGPT",
  claude: "Claude",
  gemini: "Gemini",
  "claude-code": "Claude Code",
  codex: "Codex",
  opencode: "OpenCode",
  zcode: "Zcode",
  // Absent jusqu'ici : un import Cursor s'affichait « undefined : 3 Chat(s) » et créait l'agent « Comme dans undefined ».
  cursor: "Cursor",
};

/** Logiciel d'IA trouvé sur ce poste (gateway/src/importLocal.ts). */
export interface LogicielTrouve {
  id: "claude-code" | "codex" | "cursor" | "chatgpt" | "claude" | "opencode" | "zcode";
  nom: string;
  lisible: boolean;
  conversations: number;
  instructions: boolean;
  note: string;
}

export async function logicielsDuPoste(): Promise<LogicielTrouve[]> {
  try {
    const res = await apiFetch("/helix/import/logiciels");
    if (!res.ok) return [];
    return ((await res.json()) as { logiciels: LogicielTrouve[] }).logiciels;
  } catch {
    return [];
  }
}

interface PageLogiciel extends Import {
  total: number;
  suivant: number | null;
}

async function lireReponse<T>(res: Response): Promise<T> {
  const corps = (await res.json().catch(() => ({}))) as T & { error?: { message?: string } };
  if (!res.ok) throw new Error(corps.error?.message ?? t("L'instance n'a pas répondu."));
  return corps;
}

/**
 * La liste des conversations d'un logiciel du poste, page par page
 * (gateway/src/importLocal.ts) : titres, dates, tailles, sans les messages.
 * `suivre` reçoit l'avancement après chaque page. Des milliers de
 * conversations ne passent plus en une réponse, et l'écran ne se fige pas.
 */
export async function lireLogiciel(id: string, suivre?: (lues: number, total: number) => void): Promise<Import> {
  const chats = new Map<string, ChatImporte>();
  const projets = new Map<string, ProjetImporte>();
  let instructions = "";
  let source: Import["source"] = id as Import["source"];
  let depuis: number | null = 0;
  while (depuis !== null) {
    const page: PageLogiciel = await lireReponse<PageLogiciel>(await apiFetch(`/helix/import/logiciel/${id}?depuis=${depuis}`));
    source = page.source;
    if (depuis === 0) instructions = page.instructions ?? "";
    for (const c of page.chats) chats.set(c.cle, c);
    for (const p of page.projets) if (!projets.has(p.cle)) projets.set(p.cle, p);
    // Une page qui n'avance pas arrêterait la boucle pour toujours : on s'arrête là.
    depuis = page.suivant !== null && page.suivant > depuis ? page.suivant : null;
    suivre?.(depuis ?? page.total, page.total);
  }
  return { source, chats: [...chats.values()], projets: [...projets.values()], instructions, aCompleter: id };
}

/** Lot demandé à la fois : l'instance rend au plus 16 Mo par réponse, on reste en dessous. */
const LOT_CARACTERES = 6_000_000;

/**
 * Le contenu des Chats choisis d'un logiciel du poste, par lots. Rend les
 * Chats complets ; un Chat que l'instance n'a pas pu relire (fichier effacé
 * entre-temps) manque au résultat, et le bilan le dit.
 */
export async function completerChats(id: string, choisis: ChatImporte[], suivre?: (faits: number, total: number) => void): Promise<ChatImporte[]> {
  const complets: ChatImporte[] = [];
  let reste = [...choisis];
  let faits = 0;
  while (reste.length > 0) {
    const lot: string[] = [];
    let taille = 0;
    for (const c of reste) {
      if (lot.length > 0 && (taille + c.taille > LOT_CARACTERES || lot.length >= 200)) break;
      lot.push(c.cle);
      taille += c.taille;
    }
    const r = await lireReponse<{ chats: ChatImporte[]; restantes: string[] }>(
      await apiFetch(`/helix/import/logiciel/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cles: lot }),
      }),
    );
    complets.push(...r.chats);
    const aRedemander = new Set(r.restantes ?? []);
    // Rien de rendu ni de reporté : le lot est perdu, pas la peine de le redemander sans fin.
    if (r.chats.length === 0 && aRedemander.size === 0) {
      reste = reste.filter((c) => !lot.includes(c.cle));
    } else {
      reste = reste.filter((c) => !lot.includes(c.cle) || aRedemander.has(c.cle));
      if (r.chats.length === 0) break;
    }
    faits += lot.length - aRedemander.size;
    suivre?.(faits, choisis.length);
  }
  return complets;
}

const iso = (v: unknown): string => {
  if (typeof v === "number") return new Date(v * 1000).toISOString();
  if (typeof v === "string" && !Number.isNaN(Date.parse(v))) return new Date(v).toISOString();
  return new Date().toISOString();
};

const taille = (c: Omit<ChatImporte, "taille">) =>
  c.titre.length + c.messages.reduce((s, m) => s + m.content.length + 80, 200);

/* --- ChatGPT ---------------------------------------------------------- */

interface NoeudChatGpt {
  parent?: string | null;
  message?: {
    author?: { role?: string };
    content?: { content_type?: string; parts?: unknown[]; text?: string };
    create_time?: number | null;
    metadata?: { is_visually_hidden_from_conversation?: boolean };
  } | null;
}

/**
 * Une conversation ChatGPT est un arbre (chaque réponse régénérée ouvre une
 * branche). On suit la branche affichée : du dernier message (`current_node`)
 * jusqu'à la racine, puis on la remet dans l'ordre.
 */
function lireChatGpt(donnees: unknown): Import {
  const liste = Array.isArray(donnees) ? donnees : [];
  const chats: ChatImporte[] = [];
  const projets = new Map<string, ProjetImporte>();
  for (const c of liste as Record<string, unknown>[]) {
    const mapping = (c.mapping ?? {}) as Record<string, NoeudChatGpt>;
    let id = (c.current_node as string | undefined) ?? Object.keys(mapping).pop();
    const branche: NoeudChatGpt[] = [];
    const vus = new Set<string>();
    while (id && mapping[id] && !vus.has(id)) {
      vus.add(id);
      branche.push(mapping[id]);
      id = mapping[id].parent ?? undefined;
    }
    branche.reverse();
    const messages: MessageImporte[] = [];
    for (const n of branche) {
      const m = n.message;
      const role = m?.author?.role;
      if (!m || (role !== "user" && role !== "assistant") || m.metadata?.is_visually_hidden_from_conversation) continue;
      const parts = m.content?.parts ?? (m.content?.text ? [m.content.text] : []);
      const texte = parts
        .map((p) => (typeof p === "string" ? p : typeof p === "object" && p ? "[image]" : ""))
        .join("\n")
        .trim();
      if (!texte) continue;
      messages.push({ role, content: texte, createdAt: iso(m.create_time ?? c.create_time) });
    }
    if (messages.length === 0) continue;
    // Les projets ChatGPT (« g-p-… ») n'ont pas de nom dans l'export : on les numérote.
    const gizmo = typeof c.gizmo_id === "string" && c.gizmo_id.startsWith("g-p-") ? c.gizmo_id : undefined;
    if (gizmo && !projets.has(gizmo)) {
      projets.set(gizmo, { cle: gizmo, nom: tf("Projet ChatGPT {0}", projets.size + 1), description: "", instructions: "", documents: [] });
    }
    const base = {
      cle: String(c.id ?? c.conversation_id ?? chats.length),
      titre: String(c.title ?? "").trim() || t("Chat ChatGPT"),
      creeLe: iso(c.create_time),
      modifieLe: iso(c.update_time ?? c.create_time),
      messages,
      ...(gizmo ? { projet: gizmo } : {}),
    };
    chats.push({ ...base, taille: taille(base) });
  }
  return { source: "chatgpt", chats, projets: [...projets.values()] };
}

/* --- Claude ----------------------------------------------------------- */

function lireClaude(conversations: unknown, projetsBruts: unknown): Import {
  const chats: ChatImporte[] = [];
  for (const c of (Array.isArray(conversations) ? conversations : []) as Record<string, unknown>[]) {
    const messages: MessageImporte[] = [];
    for (const m of (Array.isArray(c.chat_messages) ? c.chat_messages : []) as Record<string, unknown>[]) {
      const role = m.sender === "human" ? "user" : m.sender === "assistant" ? "assistant" : null;
      if (!role) continue;
      const blocs = Array.isArray(m.content)
        ? (m.content as { type?: string; text?: string }[]).filter((b) => b.type === "text" && b.text).map((b) => b.text)
        : [];
      let texte = (blocs.length ? blocs.join("\n") : String(m.text ?? "")).trim();
      // Les pièces jointes lues par Claude : on garde leur texte, sinon la suite n'a plus de sens.
      for (const pj of (Array.isArray(m.attachments) ? m.attachments : []) as { file_name?: string; extracted_content?: string }[]) {
        if (pj.extracted_content) texte += `\n\n[${pj.file_name ?? t("pièce jointe")}]\n${pj.extracted_content}`;
      }
      if (texte) messages.push({ role, content: texte, createdAt: iso(m.created_at ?? c.created_at) });
    }
    if (messages.length === 0) continue;
    const projet = typeof c.project_uuid === "string" ? c.project_uuid : (c.project as { uuid?: string } | undefined)?.uuid;
    const base = {
      cle: String(c.uuid ?? chats.length),
      titre: String(c.name ?? "").trim() || t("Chat Claude"),
      creeLe: iso(c.created_at),
      modifieLe: iso(c.updated_at ?? c.created_at),
      messages,
      ...(projet ? { projet } : {}),
    };
    chats.push({ ...base, taille: taille(base) });
  }
  const projets: ProjetImporte[] = [];
  for (const p of (Array.isArray(projetsBruts) ? projetsBruts : []) as Record<string, unknown>[]) {
    projets.push({
      cle: String(p.uuid ?? projets.length),
      nom: String(p.name ?? "").trim() || t("Projet Claude"),
      description: String(p.description ?? "").trim(),
      instructions: String(p.prompt_template ?? "").trim(),
      documents: ((Array.isArray(p.docs) ? p.docs : []) as { filename?: string; content?: string }[])
        .filter((d) => d.content)
        .map((d) => ({ nom: d.filename || "document.md", contenu: String(d.content) })),
    });
  }
  return { source: "claude", chats, projets };
}

/* --- Gemini ----------------------------------------------------------- */

/** Rassemble les lectures de fichiers d'activité Gemini en Chats, ou dit clairement pourquoi il n'y en a pas. */
function importGemini(lectures: LectureGemini[]): Import {
  const activites = lectures.flatMap((l) => l.activites);
  const ignorees = lectures.reduce((n, l) => n + l.ignorees, 0);
  if (!lectures.some((l) => l.gemini)) {
    throw new Error(t("Ce journal d'activité Google ne contient aucune activité Gemini : dans Google Takeout, cochez « Mes activités », puis « Applications Gemini » seulement."));
  }
  if (activites.length === 0) {
    throw new Error(t("Ce fichier d'activité Gemini ne contient aucune question, seulement d'autres activités (retours donnés, brouillons choisis). Vérifiez que l'activité dans les applications Gemini était activée sur ce compte."));
  }
  const { chats, remarques } = chatsDepuisActivites(activites, ignorees);
  return { source: "gemini", chats, projets: [], remarques };
}

const tropGrand = () =>
  new Error(tf("Le fichier d'activité Gemini dépasse {0} Mo une fois décompressé : il est trop grand pour être lu dans cette fenêtre.", Math.round(GEMINI_FICHIER_MAX / 1024 / 1024)));

/** Un fichier lu en texte, refusé s'il est trop grand pour la mémoire de la fenêtre. */
async function texteBorne(fichier: File): Promise<string> {
  if (fichier.size > GEMINI_FICHIER_MAX) throw tropGrand();
  return fichier.text();
}

/** JSON illisible (fichier vide, coupé, pas du JSON) : un message clair, pas l'erreur brute du navigateur. */
function lireJson(texte: string): unknown {
  if (!texte.trim()) throw new Error(t("Ce fichier est vide."));
  try {
    return JSON.parse(texte);
  } catch {
    throw new Error(t("Ce fichier n'est pas un JSON lisible : il est peut-être incomplet. Choisissez-le tel que le service l'a envoyé."));
  }
}

/** Un journal d'activité Google au format JSON : un tableau d'objets à `title` et `header`, `time` ou `products`. */
const estJournal = (liste: unknown[]) =>
  liste.some((r) => typeof r === "object" && r !== null && typeof (r as { title?: unknown }).title === "string" && ("header" in r || "time" in r || "products" in r));

/**
 * Les fichiers d'activité Gemini d'une archive Takeout. Le chemin est traduit
 * selon la langue du compte (« Takeout/My Activity/Gemini Apps/MyActivity.json »,
 * « Takeout/Mes activités/Applications Gemini/… ») : on retient les fichiers
 * JSON ou HTML d'un dossier dont le nom parle de Gemini (ou de Bard, son ancien
 * nom), puis ceux nommés « MyActivity » ailleurs ; c'est leur contenu qui
 * décide (le journal d'un autre produit, comme la Recherche, est écarté).
 */
function fichiersGemini(entrees: EntreeZip[]): EntreeZip[] {
  const dossier = (nom: string) => nom.replace(/[^/]*$/, "");
  const lisible = (e: EntreeZip) => /\.(json|html?)$/i.test(e.nom);
  const parDossier = entrees.filter((e) => lisible(e) && /gemini|bard/i.test(dossier(e.nom)));
  const autres = entrees.filter((e) => lisible(e) && !parDossier.includes(e) && /(^|\/)MyActivity\.(json|html?)$/i.test(e.nom));
  // Le JSON d'abord : ses dates sont exactes, celles du HTML sont écrites dans la langue du compte.
  const html = (e: EntreeZip) => Number(/\.html?$/i.test(e.nom));
  return [...parDossier, ...autres].sort((a, b) => html(a) - html(b)).slice(0, 40);
}

/** Les activités Gemini d'une archive Takeout ; `null` s'il n'y en a aucune (le message d'erreur se choisit plus haut). */
async function lireGeminiDansArchive(fichier: File, entrees: EntreeZip[]): Promise<Import | null> {
  const lectures: LectureGemini[] = [];
  let rang = 0;
  let total = 0;
  for (const e of fichiersGemini(entrees)) {
    const texte = await lireEntree(fichier, e, GEMINI_FICHIER_MAX - total);
    if (texte === null) throw tropGrand();
    total += texte.length;
    let lecture: LectureGemini;
    if (/\.json$/i.test(e.nom)) {
      let donnees: unknown;
      try {
        donnees = JSON.parse(texte);
      } catch {
        continue;
      }
      if (!Array.isArray(donnees) || !estJournal(donnees)) continue;
      lecture = activitesDepuisJson(donnees, rang);
    } else {
      lecture = activitesDepuisHtml(texte, rang);
    }
    if (!lecture.gemini) continue;
    rang += lecture.activites.length + lecture.ignorees + 1;
    lectures.push(lecture);
    // Un journal JSON de Gemini suffit : le même en HTML ne ferait que le répéter.
    if (/\.json$/i.test(e.nom) && lecture.activites.length > 0) break;
  }
  return lectures.length ? importGemini(lectures) : null;
}

/* ------------------------------------------------------------------ */
/* Entrée                                                               */
/* ------------------------------------------------------------------ */

/**
 * Lit une archive d'export (ou un `conversations.json`, un `MyActivity.json`
 * ou un `MyActivity.html` seul) et reconnaît sa source à sa forme : un arbre
 * `mapping` pour ChatGPT, des `chat_messages` pour Claude, un journal
 * d'activité Google pour Gemini. Lève une erreur au message clair si rien
 * n'est reconnu.
 */
export async function lireExport(fichier: File): Promise<Import> {
  let conversations: unknown = null;
  let projets: unknown = null;
  if (fichier.size === 0) throw new Error(t("Ce fichier est vide."));
  if (/\.(tgz|tar\.gz|tar)$/i.test(fichier.name)) {
    throw new Error(t("Les archives .tgz ne sont pas lues : dans Google Takeout, choisissez le type de fichier .zip, puis refaites l'export."));
  }
  if (/\.html?$/i.test(fichier.name)) {
    const lecture = activitesDepuisHtml(await texteBorne(fichier));
    if (!lecture.journal) {
      throw new Error(t("Ce fichier HTML n'est pas un journal d'activité de Google Takeout. Choisissez MyActivity.html, dans le dossier de Gemini de l'archive."));
    }
    return importGemini([lecture]);
  }
  if (/\.json$/i.test(fichier.name)) {
    conversations = lireJson(await fichier.text());
  } else {
    let entrees: EntreeZip[];
    try {
      entrees = await repertoire(fichier);
    } catch {
      throw new Error(t("Ce fichier n'est pas une archive ZIP lisible. Choisissez l'archive telle que ChatGPT, Claude ou Google l'a envoyée."));
    }
    const trouver = (nom: string) => entrees.find((e) => e.nom === nom || e.nom.endsWith(`/${nom}`));
    const conv = trouver("conversations.json");
    if (!conv) {
      const gemini = await lireGeminiDansArchive(fichier, entrees);
      if (gemini) return gemini;
      const takeout = entrees.some((e) => /(^|\/)Takeout\//i.test(e.nom));
      if (takeout && entrees.some((e) => /(^|\/)Takeout\/(Gemini|Bard)\//i.test(e.nom))) {
        throw new Error(t("Cette archive Takeout ne contient que vos Gems, pas vos Chats : ils sont dans « Mes activités ». Refaites l'export en cochant « Mes activités », puis « Applications Gemini »."));
      }
      if (takeout) {
        throw new Error(t("Cette archive Google Takeout ne contient pas d'activité Gemini. Refaites l'export en cochant « Mes activités », puis, dans la liste des activités, « Applications Gemini »."));
      }
      throw new Error(t("Aucun fichier conversations.json ni activité Gemini dans cette archive : ce n'est pas un export ChatGPT, Claude ou Gemini."));
    }
    conversations = lireJson(await lireEntree(fichier, conv));
    const proj = trouver("projects.json");
    if (proj) projets = JSON.parse(await lireEntree(fichier, proj));
  }
  const premier = Array.isArray(conversations) ? (conversations[0] as Record<string, unknown> | undefined) : undefined;
  const objet = typeof premier === "object" && premier !== null;
  if (objet && "mapping" in premier) return lireChatGpt(conversations);
  if (objet && "chat_messages" in premier) return lireClaude(conversations, projets);
  if (Array.isArray(conversations) && estJournal(conversations)) return importGemini([activitesDepuisJson(conversations)]);
  if (Array.isArray(conversations) && conversations.length === 0) throw new Error(t("Ce fichier ne contient aucune conversation."));
  throw new Error(t("Format non reconnu : ni ChatGPT, ni Claude, ni Gemini."));
}
