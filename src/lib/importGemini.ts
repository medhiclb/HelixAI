/**
 * Reprendre ses Chats de Gemini, depuis l'export de Google Takeout.
 *
 * Demandé par Medhi le 28/09/2026 : « je veux qu'on puisse importer Gemini
 * aussi ». Google n'exporte pas des conversations : Takeout rend « Mes
 * activités », filtré sur « Applications Gemini », c'est-à-dire le même
 * journal que celui d'une recherche ou d'une vidéo vue. Une ligne par
 * question posée, avec la réponse quand Google l'a gardée, et une date.
 * Google ne publie aucun schéma de ce fichier ; ce qui suit a été relevé le
 * 28/09/2026 (voir PROJET.md, entrée du jour) :
 *
 *  - l'aide de Google (support.google.com/gemini/answer/16920332) : Takeout,
 *    « Mes activités », « Applications Gemini » ; le produit « Gemini » seul
 *    ne contient que les Gems ; archive .zip ou .tgz, prête en quelques heures
 *    à quelques jours, lien valable 7 jours ;
 *  - le format **JSON** (au choix, dans « Plusieurs formats ») : un tableau
 *    d'activités, `header` (« Gemini Apps », traduit selon la langue du
 *    compte), `title` (la question, derrière un préfixe traduit : « Prompted »),
 *    `time` (ISO 8601 en UTC), `products`, `safeHtmlItem[].html` (la réponse,
 *    en HTML), `attachedFiles` / `imageFile` (noms des pièces jointes). Relevé
 *    d'après le code d'une vingtaine de lecteurs publics qui lisent de vrais
 *    exports (docs/formats/gemini.md du projet panchat, qui les recense) ;
 *  - le format **HTML** (celui que Takeout propose par défaut) : une carte
 *    `outer-cell` par activité ; en tête le produit, puis la question, la date
 *    écrite dans la langue du compte (« Sep 2, 2026, 12:12:52 PM PDT »), la
 *    réponse en HTML, et en pied, sous « Details », le lien de la conversation
 *    (`https://gemini.google.com/app/<id>`). Relevé sur l'archive d'essai
 *    publique du projet gemini-exporter (tests/fixtures, septembre 2026).
 *
 * Ce que l'export ne contient pas, et ce qu'on en fait :
 *  - pas de titre de conversation : le Chat prend sa première question ;
 *  - pas toujours la réponse (une question dont Google n'a pas gardé la
 *    réponse reste seule, et le bilan le compte) ;
 *  - pas d'objet « conversation » : on regroupe par le lien de conversation
 *    quand Google le donne ; sans lui, par proximité dans le temps (moins de
 *    30 minutes entre deux questions), et l'écran le dit, parce que ce
 *    regroupement-là est une reconstitution ;
 *  - pas les fichiers eux-mêmes : les images et pièces jointes ne sont pas
 *    reprises, leur nom est noté dans la question ;
 *  - les activités qui ne sont pas des messages (retour donné, brouillon
 *    choisi, Canvas créé) sont écartées et comptées.
 *
 * Aucun vrai export Gemini n'a pu être lu ici (ni compte, ni archive du
 * client) : le lecteur suit les relevés ci-dessus et les fixtures fictives de
 * scripts/essai-import-gemini.mjs. À refaire avec une vraie archive.
 *
 * Sécurité : le HTML de l'export n'est jamais interprété. Il est parcouru
 * balise par balise, en temps linéaire (`parcourirBalises`,
 * gateway/src/texteBrut.ts), sans DOM : aucune balise ne passe dans le texte
 * repris, `script`, `style`, `iframe`… sont retirés avec leur contenu, les
 * liens deviennent du texte (« libellé (adresse) », http, https et mailto
 * seulement), les images leur texte de remplacement. Ce qui ressemble encore
 * à du HTML après décodage des entités (`&lt;div&gt;` d'un exemple de code)
 * est du texte écrit par Gemini, et s'affiche comme tel (TexteRiche
 * n'interprète aucun HTML).
 */

import { parcourirBalises } from "../../gateway/src/texteBrut.ts";
import { t, tf } from "@/lib/i18n";
import type { ChatImporte, MessageImporte } from "./importChats";

/* ------------------------------------------------------------------ */
/* Bornes                                                               */
/* ------------------------------------------------------------------ */

/** Taille d'un fichier d'activité lu en une fois (décompressé). Un an de questions quotidiennes au format HTML pèse de l'ordre de 50 Mo. */
export const GEMINI_FICHIER_MAX = 300 * 1024 * 1024;
/** Activités lues au plus, tous fichiers confondus. */
const ACTIVITES_MAX = 500_000;
/** Longueur gardée d'un message : au-delà, la suite est coupée et marquée. */
const MESSAGE_MAX = 100_000;
/** Écart au-delà duquel deux questions sans lien de conversation ouvrent deux Chats. */
const ECART_PROXIMITE = 30 * 60 * 1000;

/* ------------------------------------------------------------------ */
/* Du HTML au texte                                                     */
/* ------------------------------------------------------------------ */

const ENTITES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", emsp: " ", ensp: " ", thinsp: " ",
  hellip: "…", mdash: "—", ndash: "–", laquo: "«", raquo: "»", lsquo: "‘", rsquo: "’", ldquo: "“", rdquo: "”",
  bull: "•", middot: "·", copy: "©", reg: "®", trade: "™", euro: "€", deg: "°", times: "×", divide: "÷", plusmn: "±",
  eacute: "é", egrave: "è", ecirc: "ê", euml: "ë", agrave: "à", acirc: "â", auml: "ä", ccedil: "ç", icirc: "î", iuml: "ï",
  ocirc: "ô", ouml: "ö", ugrave: "ù", ucirc: "û", uuml: "ü", Eacute: "É", Egrave: "È", Agrave: "À", Ccedil: "Ç", szlig: "ß",
  ntilde: "ñ", aacute: "á", iacute: "í", oacute: "ó", uacute: "ú",
};

/** Décode les entités HTML (nommées courantes, décimales, hexadécimales). Un code hors d'Unicode reste tel quel. */
export function decoderEntites(s: string): string {
  if (!s.includes("&")) return s;
  return s.replace(/&(#x[0-9a-f]{1,6}|#\d{1,7}|[a-z]{2,8});/gi, (tout, corps: string) => {
    if (corps[0] === "#") {
      const code = corps[1] === "x" || corps[1] === "X" ? parseInt(corps.slice(2), 16) : Number(corps.slice(1));
      return code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff) ? String.fromCodePoint(code) : tout;
    }
    return ENTITES[corps] ?? ENTITES[corps.toLowerCase()] ?? tout;
  });
}

/** Blocs retirés avec tout leur contenu : rien de ce qu'ils portent n'est du texte à lire. */
const IGNORES = new Set(["script", "style", "noscript", "template", "iframe", "object", "embed", "svg", "head", "title", "select", "button"]);

/** Valeur d'un attribut dans l'intérieur d'une balise (`a href="…"`). */
function attribut(interieur: string, nom: string): string | undefined {
  const m = new RegExp(`\\s${nom}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'>]+))`, "i").exec(interieur.slice(0, 4096));
  const v = m ? (m[1] ?? m[2] ?? m[3]) : undefined;
  return v === undefined ? undefined : decoderEntites(v).trim();
}

/** Adresse gardée en texte : web ou mail seulement (`javascript:`, `data:`… disparaissent). */
const lienGarde = (href: string | undefined): string | undefined =>
  href && /^(https?:\/\/|mailto:)/i.test(href) ? href.replace(/[\u0000-\u001f\s]+/g, "") : undefined;

/**
 * Le HTML d'une réponse (ou d'une question) en texte, dans le sous-ensemble
 * de Markdown que l'écran sait rendre (TexteRiche) : paragraphes, titres,
 * listes, blocs de code, gras, italique ; les tableaux en lignes « a | b ».
 */
export function texteDepuisHtml(html: string): string {
  const sortie: string[] = [];
  const listes: { ordonnee: boolean; n: number }[] = [];
  const liens: { href?: string; debut: number }[] = [];
  let pre = 0;
  let premiereCellule = true;
  /** Dans une cellule de tableau : un saut de ligne y couperait la ligne du tableau. */
  let cellule = false;
  const pousser = (s: string) => {
    sortie.push(s);
    return "";
  };
  const texteDepuis = (debut: number) => sortie.slice(debut).join("");
  parcourirBalises(
    html,
    (nom, interieur) => {
      switch (nom) {
        case "br":
          return pousser(cellule ? " " : "\n");
        case "p": case "/p": case "div": case "/div": case "section": case "/section": case "article": case "/article":
        case "blockquote": case "/blockquote": case "hr": case "figure": case "/figure":
          return pousser(cellule ? " " : "\n\n");
        case "h1": case "h2": case "h3": case "h4": case "h5": case "h6":
          return pousser(`\n\n${"#".repeat(Math.min(4, Number(nom[1])))} `);
        case "/h1": case "/h2": case "/h3": case "/h4": case "/h5": case "/h6":
          return pousser("\n\n");
        case "ul": case "ol":
          listes.push({ ordonnee: nom === "ol", n: 0 });
          return pousser("\n");
        case "/ul": case "/ol":
          listes.pop();
          return pousser("\n");
        case "li": {
          // Les sauts laissés par `</p>` dans l'élément précédent couperaient la liste en deux.
          while (sortie.length && /^\s*$/.test(sortie[sortie.length - 1] ?? "x")) sortie.pop();
          const l = listes[listes.length - 1];
          const retrait = "  ".repeat(Math.max(0, listes.length - 1));
          if (l?.ordonnee) return pousser(`\n${retrait}${++l.n}. `);
          return pousser(`\n${retrait}- `);
        }
        case "pre":
          pre++;
          return pousser("\n\n```\n");
        case "/pre":
          pre = Math.max(0, pre - 1);
          return pousser("\n```\n\n");
        case "code": case "/code":
          return pre ? "" : pousser("`");
        case "strong": case "/strong": case "b": case "/b":
          return pre ? "" : pousser("**");
        case "em": case "/em": case "i": case "/i":
          return pre ? "" : pousser("*");
        case "a":
          liens.push({ href: lienGarde(attribut(interieur, "href")), debut: sortie.length });
          return "";
        case "/a": {
          const l = liens.pop();
          if (!l?.href) return "";
          const libelle = texteDepuis(l.debut).trim();
          // Un lien dont le libellé est déjà l'adresse ne la répète pas.
          if (libelle === l.href || libelle === l.href.replace(/^mailto:/i, "")) return "";
          return pousser(libelle ? ` (${l.href})` : l.href);
        }
        case "img": {
          const alt = attribut(interieur, "alt");
          return pousser(alt ? `[image : ${alt}]` : "[image]");
        }
        case "table": case "/table":
          return pousser("\n\n");
        case "tr":
          premiereCellule = true;
          cellule = false;
          return pousser("\n");
        case "/td": case "/th": case "/tr":
          cellule = false;
          return "";
        case "td": case "th":
          cellule = true;
          if (premiereCellule) {
            premiereCellule = false;
            return "";
          }
          return pousser(" | ");
        default:
          return "";
      }
    },
    {
      ignores: IGNORES,
      surTexte: (morceau) => pousser(pre ? decoderEntites(morceau) : decoderEntites(morceau.replace(/\s+/g, " "))),
    },
  );
  return sortie
    .join("")
    .replace(/ /g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+(?=\n)/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    // `<li><p>…</p></li>` : le paragraphe reste sur la ligne de sa puce.
    .replace(/(^|\n)([ ]*(?:-|\d{1,3}\.))[ \t]*\n+[ \t]*(?=\S)/g, "$1$2 ")
    .trim();
}

const borner = (s: string) => (s.length > MESSAGE_MAX ? `${s.slice(0, MESSAGE_MAX)}\n\n[...]` : s);

/* ------------------------------------------------------------------ */
/* Question, date, conversation                                         */
/* ------------------------------------------------------------------ */

/**
 * Préfixes de la question, selon la langue du compte. Relevés chez les
 * lecteurs publics (voir l'en-tête) ; la liste n'est pas complète. Un préfixe
 * inconnu n'est pas deviné : la question est gardée entière, préfixe compris.
 */
const PREFIXES = [
  /^Prompted[\s ]+/i,
  /^Asked[\s ]+/i,
  /^Said[\s ]+/i,
  /^Submitted query[\s ]+/i,
  /^送信したメッセージ[:：][\s ]*/,
  /^プロンプト[:：]?[\s ]+/,
  /^已提示[:：]?[\s ]*/,
  /^Υποβλήθηκε το ερώτημα[\s ]+/,
  /^Has dicho[:：][\s ]*/i,
  /^Hiciste la petición[\s ]+/i,
  /^Preguntado[:：]?[\s ]+/i,
];

export function question(titre: string): { texte: string; reconnue: boolean } {
  const brut = titre.replace(/^[\s ]+/, "");
  for (const p of PREFIXES) {
    if (p.test(brut)) return { texte: brut.replace(p, "").trim(), reconnue: true };
  }
  return { texte: brut.trim(), reconnue: false };
}

/** Lien de conversation que Google range avec l'activité (`gemini.google.com/app/<id>`). */
const LIEN_CONVERSATION = /https?:\/\/(?:gemini|bard)\.google\.com\/(?:u\/\d+\/)?(?:app|chat)\/(?:c\/)?([A-Za-z0-9_-]{6,64})/;

export const conversationDe = (texte: string): string | null => LIEN_CONVERSATION.exec(texte)?.[1] ?? null;

const MOIS: Record<string, number> = {};
[
  ["jan", "january", "janv", "janvier", "januar", "jän", "enero", "ene", "gennaio", "gen", "janeiro", "januari"],
  ["feb", "february", "fevr", "fev", "fevrier", "februar", "febrero", "febbraio", "fevereiro", "februari"],
  ["mar", "march", "mars", "marz", "marzo", "marco", "maart"],
  ["apr", "april", "avr", "avril", "abril", "abr", "aprile"],
  ["may", "mai", "mayo", "maggio", "maio", "mei", "mag"],
  ["jun", "june", "juin", "juni", "junio", "giugno", "giu", "junho"],
  ["jul", "july", "juil", "juillet", "juli", "julio", "luglio", "lug", "julho"],
  ["aug", "august", "aout", "agosto", "ago", "augustus"],
  ["sep", "sept", "september", "septembre", "septiembre", "settembre", "set", "setembro"],
  ["oct", "october", "octobre", "oktober", "okt", "octubre", "ottobre", "ott", "outubro", "out"],
  ["nov", "november", "novembre", "noviembre", "novembro"],
  ["dec", "december", "decembre", "dezember", "dez", "diciembre", "dic", "dicembre", "dezembro"],
].forEach((noms, i) => noms.forEach((n) => (MOIS[n] = i + 1)));

/** Décalage des fuseaux que Google écrit en abréviation, en minutes. Un fuseau inconnu : l'heure de ce poste. */
const FUSEAUX: Record<string, number> = {
  UTC: 0, GMT: 0, Z: 0, WET: 0, WEST: 60, BST: 60, CET: 60, CEST: 120, MEZ: 60, MESZ: 120, EET: 120, EEST: 180, MSK: 180,
  PST: -480, PDT: -420, MST: -420, MDT: -360, CST: -360, CDT: -300, EST: -300, EDT: -240, AKST: -540, AKDT: -480, HST: -600,
  IST: 330, JST: 540, KST: 540, HKT: 480, SGT: 480, AEST: 600, AEDT: 660, NZST: 720, NZDT: 780,
};

const sansAccents = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");

/**
 * La date d'une carte HTML, écrite dans la langue du compte. Rend `null` si
 * le texte n'a pas l'air d'une date, `{ iso: null }` si c'en est une qu'on ne
 * sait pas lire (elle sert encore à séparer la question de la réponse).
 */
export function dateActivite(brut: string): { iso: string | null } | null {
  const s = brut.replace(/[   ]/g, " ").trim();
  if (s.length > 80 || !/(?:19|20)\d{2}/.test(s) || !/\d{1,2}\s*[:：時]\s*\d{2}/.test(s)) return null;
  const iso = /(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?)(Z|[+-]\d{2}:?\d{2})?/.exec(s);
  if (iso) {
    const d = Date.parse(`${iso[1]}T${iso[2]}${iso[3] ?? ""}`);
    return { iso: Number.isNaN(d) ? null : new Date(d).toISOString() };
  }
  let annee: number | undefined;
  let mois: number | undefined;
  let jour: number | undefined;
  const cjk = /(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/.exec(s);
  const ymd = /\b(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\b/.exec(s);
  const dmy = /\b(\d{1,2})[./](\d{1,2})[./](\d{4})\b/.exec(s);
  if (cjk) [annee, mois, jour] = [Number(cjk[1]), Number(cjk[2]), Number(cjk[3])];
  else if (ymd) [annee, mois, jour] = [Number(ymd[1]), Number(ymd[2]), Number(ymd[3])];
  else if (dmy) {
    const a = Number(dmy[1]);
    const b = Number(dmy[2]);
    annee = Number(dmy[3]);
    // Jour d'abord, sauf si le premier nombre ne peut pas être un jour du mois suivant.
    [jour, mois] = b > 12 ? [b, a] : [a, b];
  } else {
    // « Sep 2, 2026 », « 2 sept. 2026 », « 2. September 2026 », « 2 de septiembre de 2026 »
    const avantHeure = s.split(/\d{1,2}\s*[:：]\s*\d{2}/)[0] ?? s;
    const mots = sansAccents(avantHeure.toLowerCase()).split(/[^a-zäöü]+/).filter(Boolean);
    mois = mots.map((m) => MOIS[m] ?? MOIS[m.slice(0, 4)] ?? MOIS[m.slice(0, 3)]).find((m) => m !== undefined);
    const nombres = [...avantHeure.matchAll(/\d+/g)].map((m) => Number(m[0]));
    annee = nombres.find((n) => n >= 1990 && n <= 2100);
    jour = nombres.find((n) => n >= 1 && n <= 31);
  }
  const heure = /(\d{1,2})\s*[:：時]\s*(\d{2})(?:\s*[:：分]\s*(\d{2}))?/.exec(s);
  if (!annee || !mois || !jour || !heure || mois > 12 || jour > 31) return { iso: null };
  let h = Number(heure[1]);
  const pm = /\b(PM|p\.\s?m\.)|午後|下午|오후/i.test(s);
  const am = /\b(AM|a\.\s?m\.)|午前|上午|오전/i.test(s);
  if (pm && h < 12) h += 12;
  if (am && h === 12) h = 0;
  let decalage: number | undefined;
  // « [+-−] » était une plage, du « + » au « − » (U+2212) : des milliers de caractères (CodeQL, 04/10/2026). Trois signes, rien d'autre.
  const numerique = /(?:UTC|GMT)\s*([+\-−])\s*(\d{1,2})(?::?(\d{2}))?/.exec(s);
  if (numerique) decalage = (numerique[1] === "+" ? 1 : -1) * (Number(numerique[2]) * 60 + Number(numerique[3] ?? 0));
  else {
    const abr = /\b([A-Z]{1,5})\s*$/.exec(s)?.[1];
    if (abr && abr in FUSEAUX) decalage = FUSEAUX[abr];
  }
  const secondes = Number(heure[3] ?? 0);
  const ms =
    decalage === undefined
      ? new Date(annee, mois - 1, jour, h, Number(heure[2]), secondes).getTime()
      : Date.UTC(annee, mois - 1, jour, h, Number(heure[2]), secondes) - decalage * 60_000;
  return { iso: Number.isNaN(ms) ? null : new Date(ms).toISOString() };
}

/* ------------------------------------------------------------------ */
/* Activités                                                            */
/* ------------------------------------------------------------------ */

/** Une activité Gemini : une question, sa réponse si Google l'a gardée. */
export interface ActiviteGemini {
  quand: string | null;
  question: string;
  reponse: string;
  /** Identifiant de conversation tiré du lien de Google, s'il y en a un. */
  fil: string | null;
  piecesJointes: string[];
  images: number;
  /** Rang dans le fichier (Takeout range les plus récentes d'abord). */
  rang: number;
}

export interface LectureGemini {
  activites: ActiviteGemini[];
  /** Activités Gemini qui ne sont pas des messages (retour donné, brouillon choisi…). */
  ignorees: number;
  /** Le fichier a-t-il au moins une activité de Gemini (même ignorée) ? */
  gemini: boolean;
  /** Le fichier a-t-il la forme d'un journal d'activité Google, de n'importe quel produit ? */
  journal: boolean;
}

const deGemini = (s: unknown) => typeof s === "string" && /gemini|bard/i.test(s);

function nomsDe(v: unknown): string[] {
  const liste = Array.isArray(v) ? v : v ? [v] : [];
  return liste
    .map((x) => (typeof x === "string" ? x : typeof x === "object" && x ? String((x as { name?: unknown; path?: unknown }).name ?? (x as { path?: unknown }).path ?? "") : ""))
    .map((x) => x.replace(/^.*[\\/]/, "").trim())
    .filter(Boolean)
    .slice(0, 50);
}

/** Un journal d'activité au format JSON (`MyActivity.json`). */
export function activitesDepuisJson(donnees: unknown, depuisRang = 0): LectureGemini {
  const liste = Array.isArray(donnees) ? donnees : [];
  const activites: ActiviteGemini[] = [];
  let ignorees = 0;
  let gemini = false;
  let journal = false;
  for (let i = 0; i < liste.length && activites.length < ACTIVITES_MAX; i++) {
    const r = liste[i];
    if (!r || typeof r !== "object" || Array.isArray(r)) continue;
    const a = r as Record<string, unknown>;
    if (typeof a.title === "string" && ("header" in a || "time" in a || "products" in a)) journal = true;
    const produits = Array.isArray(a.products) ? a.products : [];
    const titreUrl = typeof a.titleUrl === "string" ? a.titleUrl : "";
    if (!deGemini(a.header) && !produits.some(deGemini) && !/^https?:\/\/(gemini|bard)\.google\.com\//i.test(titreUrl)) continue;
    gemini = true;
    const q = question(typeof a.title === "string" ? a.title : "");
    const reponse = (Array.isArray(a.safeHtmlItem) ? a.safeHtmlItem : [])
      .map((x) => (typeof x === "object" && x && typeof (x as { html?: unknown }).html === "string" ? texteDepuisHtml((x as { html: string }).html) : ""))
      .filter(Boolean)
      .join("\n\n");
    if (!reponse && !q.reconnue) {
      ignorees++;
      continue;
    }
    // Le lien de conversation : dans `titleUrl`, ou dans les détails (le HTML le range sous « Details »). Jamais dans la question ni la réponse.
    const { title: _t, safeHtmlItem: _s, ...pied } = a;
    const quand = typeof a.time === "string" && !Number.isNaN(Date.parse(a.time)) ? new Date(a.time).toISOString() : null;
    activites.push({
      quand,
      question: borner(q.texte),
      reponse: borner(reponse),
      fil: conversationDe(JSON.stringify(pied).slice(0, 20_000)),
      piecesJointes: [...nomsDe(a.attachedFiles), ...nomsDe(a.imageFile), ...nomsDe(a.attachmentInfo)],
      images: 0,
      rang: depuisRang + i,
    });
  }
  return { activites, ignorees, gemini, journal };
}

const DEBUT_CORPS = "mdl-typography--body-1";
const BALISE_BLOC = /<(p|pre|table|ul|ol|h[1-6]|div|blockquote)[\s>]/i;

/** Un journal d'activité au format HTML (`MyActivity.html`, format par défaut de Takeout). */
export function activitesDepuisHtml(html: string, depuisRang = 0): LectureGemini {
  const cartes = html.split(/<div class="outer-cell/);
  const activites: ActiviteGemini[] = [];
  let ignorees = 0;
  let gemini = false;
  const journal = cartes.length > 1;
  for (let i = 1; i < cartes.length && activites.length < ACTIVITES_MAX; i++) {
    const carte = cartes[i] ?? "";
    const debutTitre = carte.indexOf("mdl-typography--title");
    const finTitre = debutTitre < 0 ? -1 : carte.indexOf("</p>", debutTitre);
    const entete = debutTitre < 0 ? "" : texteDepuisHtml(carte.slice(carte.indexOf(">", debutTitre) + 1, finTitre < 0 ? debutTitre + 300 : finTitre));
    if (!deGemini(entete)) continue;
    gemini = true;
    const d = carte.indexOf(DEBUT_CORPS);
    if (d < 0) {
      ignorees++;
      continue;
    }
    const debut = carte.indexOf(">", d) + 1;
    // Le corps s'arrête à la cellule suivante (colonne de droite, puis pied) : la réponse peut contenir ses propres `</div>`.
    let fin = carte.indexOf('<div class="content-cell', debut);
    if (fin < 0) fin = carte.length;
    const corps = carte.slice(debut, fin);
    const pied = carte.slice(fin);
    const morceaux = corps.split(/<br\s*\/?>/i);
    let iDate = -1;
    let quand: string | null = null;
    for (let k = 1; k < morceaux.length; k++) {
      const m = morceaux[k] ?? "";
      if (BALISE_BLOC.test(m)) break;
      const lu = dateActivite(texteDepuisHtml(m));
      if (lu) {
        iDate = k;
        quand = lu.iso;
        break;
      }
    }
    // Sans date reconnue, la réponse commence au premier bloc (paragraphe, liste, code…).
    if (iDate < 0) {
      const b = morceaux.findIndex((m, k) => k > 0 && BALISE_BLOC.test(m));
      iDate = b < 0 ? morceaux.length : b - 1;
    }
    const lignesQuestion: string[] = [];
    let images = 0;
    let fichiers = 0;
    for (let k = 0; k < Math.min(iDate, morceaux.length); k++) {
      const ligne = texteDepuisHtml(morceaux[k] ?? "");
      // Lignes d'information entre la question et la date : « 1 generated image. », « Attached 2 files. »
      if (k > 0 && /^\d+\s+[^\n]{1,40}\.?$/.test(ligne) && /image|图片|画像/i.test(ligne)) images += Number(/^\d+/.exec(ligne)?.[0] ?? 0);
      else if (k > 0 && /^(?:Attached\s+)?\d+\s+(?:files?|fichiers?)\b/i.test(ligne)) fichiers += Number(/\d+/.exec(ligne)?.[0] ?? 0);
      else if (ligne) lignesQuestion.push(ligne);
    }
    const q = question(lignesQuestion.join("\n"));
    const reponse = texteDepuisHtml(morceaux.slice(iDate + 1).join("<br>"));
    // Pièces jointes : liens vers un fichier de l'archive (adresse relative), dans la question.
    const piecesJointes: string[] = [];
    for (const m of morceaux.slice(0, Math.max(1, iDate)).join("<br>").matchAll(/\s(?:href|src)\s*=\s*"([^"#]+)"/gi)) {
      const v = decoderEntites(m[1] ?? "");
      if (/^[a-z][a-z0-9+.-]*:|^\/\//i.test(v)) continue;
      let nom = v.replace(/^.*[\\/]/, "");
      try {
        nom = decodeURIComponent(nom);
      } catch {
        /* nom tel quel */
      }
      if (nom && !piecesJointes.includes(nom)) piecesJointes.push(nom);
    }
    if (!reponse && !q.reconnue) {
      ignorees++;
      continue;
    }
    activites.push({
      quand,
      question: borner(q.texte),
      reponse: borner(reponse),
      fil: conversationDe(pied),
      piecesJointes: piecesJointes.length ? piecesJointes.slice(0, 50) : fichiers ? [tf("{0} fichier(s)", fichiers)] : [],
      images,
      rang: depuisRang + i - 1,
    });
  }
  return { activites, ignorees, gemini, journal };
}

/* ------------------------------------------------------------------ */
/* Des activités aux Chats                                              */
/* ------------------------------------------------------------------ */

export interface ChatsGemini {
  chats: ChatImporte[];
  /** Ce que l'écran doit dire de la lecture : regroupements, réponses absentes, activités écartées. */
  remarques: string[];
}

/** Empreinte courte et stable d'un texte (FNV-1a), pour la clé d'un Chat reconstitué. */
function empreinte(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

const titreDe = (q: string) => {
  const ligne = q.replace(/\s+/g, " ").trim();
  return ligne.length > 80 ? `${ligne.slice(0, 77).trimEnd()}...` : ligne;
};

/**
 * Range les activités en Chats : par conversation quand Google donne le lien,
 * sinon par proximité dans le temps. Ordre des messages : celui des dates,
 * puis celui du fichier (les plus récentes d'abord chez Takeout).
 */
export function chatsDepuisActivites(lues: ActiviteGemini[], ignorees: number): ChatsGemini {
  // Deux fichiers du même export (ou le même relu) : une activité identique ne compte qu'une fois.
  const vues = new Set<string>();
  const activites = lues.filter((a) => {
    const cle = `${a.quand ?? `#${a.rang}`}\u0000${a.question}\u0000${a.reponse.length}`;
    if (vues.has(cle)) return false;
    vues.add(cle);
    return true;
  });
  // Une activité sans date prend celle de sa voisine plus ancienne dans le fichier, sinon de la plus récente.
  const parRang = [...activites].sort((a, b) => a.rang - b.rang);
  let sansDate = 0;
  const datees = new Map<ActiviteGemini, number>();
  for (let i = 0; i < parRang.length; i++) {
    const a = parRang[i]!;
    if (a.quand) {
      datees.set(a, Date.parse(a.quand));
      continue;
    }
    sansDate++;
    const plusAncienne = parRang.slice(i + 1).find((x) => x.quand);
    const plusRecente = [...parRang.slice(0, i)].reverse().find((x) => x.quand);
    const voisine = plusAncienne?.quand ?? plusRecente?.quand;
    datees.set(a, voisine ? Date.parse(voisine) : Date.now());
  }
  const quand = (a: ActiviteGemini) => datees.get(a) ?? 0;
  const ordre = (a: ActiviteGemini, b: ActiviteGemini) => quand(a) - quand(b) || b.rang - a.rang;

  const groupes: { fil: string | null; activites: ActiviteGemini[] }[] = [];
  const parFil = new Map<string, ActiviteGemini[]>();
  const seules: ActiviteGemini[] = [];
  for (const a of activites) {
    if (a.fil) {
      if (!parFil.has(a.fil)) parFil.set(a.fil, []);
      parFil.get(a.fil)!.push(a);
    } else seules.push(a);
  }
  for (const [fil, liste] of parFil) groupes.push({ fil, activites: liste.sort(ordre) });
  let courant: ActiviteGemini[] = [];
  for (const a of seules.sort(ordre)) {
    const derniere = courant[courant.length - 1];
    if (derniere && quand(a) - quand(derniere) > ECART_PROXIMITE) {
      groupes.push({ fil: null, activites: courant });
      courant = [];
    }
    courant.push(a);
  }
  if (courant.length) groupes.push({ fil: null, activites: courant });

  let sansReponse = 0;
  let avecPieces = 0;
  const chats: ChatImporte[] = [];
  for (const g of groupes) {
    const messages: MessageImporte[] = [];
    for (const a of g.activites) {
      const createdAt = new Date(quand(a)).toISOString();
      const notes = a.piecesJointes.map((n) => `[${t("pièce jointe")} : ${n}]`);
      if (notes.length || a.images) avecPieces++;
      const texte = [a.question, notes.join("\n")].filter(Boolean).join("\n\n");
      if (texte) messages.push({ role: "user", content: texte, createdAt });
      // Une image créée par Gemini : la réponse, c'est elle (le fichier reste dans l'archive).
      const image = a.images ? (a.images > 1 ? tf("[{0} images générées]", a.images) : t("[image générée]")) : "";
      const reponse = [a.reponse, image].filter(Boolean).join("\n\n");
      if (reponse) messages.push({ role: "assistant", content: reponse, createdAt });
      else sansReponse++;
    }
    if (messages.length === 0) continue;
    const premiere = g.activites[0]!;
    const derniere = g.activites[g.activites.length - 1]!;
    const base = {
      cle: g.fil ? `fil:${g.fil}` : `temps:${new Date(quand(premiere)).toISOString()}:${empreinte(premiere.question)}`,
      titre: titreDe(premiere.question) || t("Chat Gemini"),
      creeLe: new Date(quand(premiere)).toISOString(),
      modifieLe: new Date(quand(derniere)).toISOString(),
      messages,
    };
    chats.push({ ...base, taille: base.titre.length + messages.reduce((s, m) => s + m.content.length + 80, 200) });
  }

  const parLien = groupes.filter((g) => g.fil).length;
  const parTemps = groupes.length - parLien;
  const remarques: string[] = [];
  if (parLien && !parTemps) remarques.push(tf("{0} Chat(s) regroupé(s) par conversation, d'après le lien que Google range avec chaque question.", parLien));
  else if (parTemps && !parLien)
    remarques.push(tf("L'export ne dit pas à quelle conversation appartient chaque question : {0} Chat(s) reconstitué(s) en regroupant les questions posées à moins de 30 minutes d'écart.", parTemps));
  else if (parLien && parTemps)
    remarques.push(tf("{0} Chat(s) regroupé(s) par conversation ; {1} autre(s) reconstitué(s) en regroupant les questions posées à moins de 30 minutes d'écart, faute de lien de conversation.", parLien, parTemps));
  remarques.push(t("L'export n'a pas de titres : chaque Chat prend sa première question."));
  if (sansReponse) remarques.push(tf("{0} question(s) sans réponse : Google ne l'a pas gardée dans l'export.", sansReponse));
  if (avecPieces) remarques.push(tf("{0} question(s) avec des fichiers ou des images : seul leur nom est repris, pas le fichier.", avecPieces));
  if (sansDate) remarques.push(tf("{0} activité(s) sans date lisible : datée(s) d'après leur voisine dans le fichier.", sansDate));
  if (ignorees) remarques.push(tf("{0} activité(s) qui ne sont pas des messages (retour donné, brouillon choisi, Canvas…) laissée(s) de côté.", ignorees));
  return { chats, remarques };
}
