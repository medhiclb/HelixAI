import { jetonsEstimes } from "./documentsJoints.ts";

/**
 * Choisir les outils utiles à la demande quand la place du modèle ne les tient
 * pas tous (23/10/2026).
 *
 * Signalé par Medhi (captures du 23/10/2026) : Roblox Studio branché (28
 * outils), qwen/qwen3.5-9b chargé à 32 768 jetons, demande « crée un sol en
 * bois dans Roblox Studio ». Les descriptions de tous les outils branchés
 * (fichiers, Roblox, bureautique, bibliothèque…) ne tenaient pas dans la place,
 * et chat.ts les retirait **tous** : le modèle répondait qu'il n'avait pas
 * accès à Roblox Studio. Désormais, quand la place manque, on garde d'abord :
 *  1. les outils déjà appelés dans cette conversation ;
 *  2. ceux du service nommé dans la demande (« Roblox », « Studio »,
 *     « Blender », « Unreal », le nom d'un connecteur) ;
 *  3. les plus courants (fichiers, bibliothèque, bureautique, réunions,
 *     tâches) ;
 *  4. le reste, dans l'ordre où il arrive ;
 * chacun gardé s'il tient encore dans la place réservée aux outils. Seuls les
 * deux premiers rangs comptent comme « vraiment utiles » : l'écran ne prévient
 * que si l'un d'eux a dû être retiré.
 *
 * Module sans dépendance (sauf l'estimation des jetons), pour être essayé
 * seul (securite.mjs, section 50).
 */

export interface OutilNomme {
  function?: { name?: string };
}

/** Le service d'un outil : le préfixe avant `__` (`roblox__execute_luau` → `roblox`), sinon le nom entier. */
export function serviceDe(nom: string): string {
  const i = nom.indexOf("__");
  return i > 0 ? nom.slice(0, i) : nom;
}

/** Minuscules sans accents, pour comparer des mots dans les six langues de l'écran. */
const plat = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

/*
 * Mots qui désignent un service sans porter son identifiant. Des noms propres
 * surtout, les mêmes dans toutes les langues ; quelques noms communs pour les
 * familles de l'instance. « studio » seul vaut Roblox Studio (demande de
 * Medhi) : « LM Studio » dans une question ne fait que garder ces outils en
 * tête, rien de plus.
 */
const ALIAS: Record<string, string[]> = {
  roblox: ["roblox", "studio", "luau"],
  blender: ["blender"],
  unreal: ["unreal", "ue5", "ue 5"],
  fichiers: ["fichier", "fichiers", "dossier", "file", "files", "folder"],
  courrier: ["mail", "mails", "e-mail", "email", "courriel", "courriels"],
  agenda: ["agenda", "calendrier", "calendar", "rendez-vous"],
  drive: ["drive"],
  slack: ["slack"],
  bureau: ["word", "excel", "powerpoint", "pdf", "docx", "xlsx", "pptx", "tableur"],
  bibliotheque: ["bibliotheque", "library"],
};

/** Familles tenues pour courantes, dans cet ordre, après le service nommé. */
const COURANTS = ["fichiers", "controle", "bibliotheque", "bureau", "reunions", "taches"];

/**
 * Les services nommés dans un texte : identifiant, libellé du connecteur
 * (`libelles`, « Roblox Studio », « Trello »…) ou mot de la liste ci-dessus.
 * Mot entier seulement : « drive » ne se trouve pas dans « drivers ».
 */
export function servicesNommes(texte: string, services: Iterable<string>, libelles: Record<string, string> = {}): Set<string> {
  const t = ` ${plat(texte).replace(/[^\p{L}\p{N}-]+/gu, " ")} `;
  const trouve = new Set<string>();
  for (const s of services) {
    const mots = [s, ...(ALIAS[s] ?? []), ...(libelles[s] ? [libelles[s]] : [])]
      .map((m) => plat(m).replace(/[^\p{L}\p{N}-]+/gu, " ").trim())
      .filter((m) => m.length >= 3);
    if (mots.some((m) => t.includes(` ${m} `))) trouve.add(s);
  }
  return trouve;
}

/** Les noms d'outils déjà appelés dans la conversation (messages `assistant` à `tool_calls`). */
export function outilsDejaAppeles(messages: unknown[]): Set<string> {
  const noms = new Set<string>();
  for (const m of messages) {
    const appels = (m as { tool_calls?: unknown })?.tool_calls;
    if (!Array.isArray(appels)) continue;
    for (const a of appels) {
      const n = (a as { function?: { name?: unknown } })?.function?.name;
      if (typeof n === "string") noms.add(n);
    }
  }
  return noms;
}

/**
 * Dit si une question courte a une intention qui justifie d'envoyer des outils.
 * Une question conversationnelle sans service nommé peut garder l'historique
 * complet : injecter les outils de tous les connecteurs ne doit pas lui faire
 * perdre les premiers échanges faute de place.
 */
export function outilsNecessairesPourQuestion(
  texte: string,
  messages: unknown[],
  outils: Iterable<OutilNomme>,
  libelles: Record<string, string> = {},
): boolean {
  if (outilsDejaAppeles(messages).size > 0) return true;
  const services = new Set<string>();
  for (const outil of outils) services.add(serviceDe(outil.function?.name ?? ""));
  return servicesNommes(texte, services, libelles).size > 0;
}

/** Le texte d'un message, contenu simple ou en parties. */
function texte(m: unknown): string {
  const c = (m as { content?: unknown })?.content;
  if (typeof c === "string") return c;
  if (Array.isArray(c)) return c.map((p) => (typeof (p as { text?: unknown })?.text === "string" ? (p as { text: string }).text : "")).join(" ");
  return "";
}

export interface ChoixOutils<T> {
  gardes: T[];
  retires: T[];
  /** Outils des rangs 1 et 2 (déjà appelés, service nommé) qui n'ont pas tenu. */
  utilesRetires: string[];
  /** Services nommés dans la demande. */
  nommes: string[];
  jetonsAvant: number;
  jetonsApres: number;
}

/**
 * Garde, dans l'ordre de priorité, chaque outil qui tient encore dans
 * `place` (jetons estimés). Les outils gardés restent dans l'ordre d'origine.
 */
export function choisirOutils<T extends OutilNomme>(
  outils: T[],
  { messages, place, libelles = {} }: { messages: unknown[]; place: number; libelles?: Record<string, string> },
): ChoixOutils<T> {
  const noms = outils.map((o) => o.function?.name ?? "");
  const couts = outils.map((o) => jetonsEstimes(JSON.stringify(o)));
  const jetonsAvant = couts.reduce((a, b) => a + b, 0);
  const services = new Set(noms.map(serviceDe));
  // La dernière question de la personne, et la précédente si elle ne dit presque rien (« et dans Blender ? »).
  const questions = messages.filter((m) => (m as { role?: string })?.role === "user").map(texte);
  const derniere = questions[questions.length - 1] ?? "";
  const cherche = derniere.trim().length < 25 && questions.length > 1 ? `${questions[questions.length - 2]}\n${derniere}` : derniere;
  const nommes = servicesNommes(cherche, services, libelles);
  const appeles = outilsDejaAppeles(messages);

  const rang = (i: number): number => {
    const n = noms[i]!;
    if (appeles.has(n)) return 0;
    const s = serviceDe(n);
    if (nommes.has(s)) return 1;
    const c = COURANTS.indexOf(s);
    return c >= 0 ? 2 + c / 10 : 3;
  };
  /*
   * Dans un même rang, l'ordre du serveur. Essayé le 23/10/2026 : les plus
   * courts d'abord en faisaient tenir un de plus sur 4 096 jetons (5 outils
   * sur 14 au lieu de 4, essai-contexte.mjs), mais retiraient de Roblox ceux
   * aux noms les plus longs, `list_roblox_studios` compris, sans lequel aucun
   * autre ne sait à quel Studio parler (essai-roblox-blender.mjs).
   */
  const ordre = outils.map((_, i) => i).sort((a, b) => rang(a) - rang(b) || a - b);
  const garde = new Set<number>();
  let reste = place;
  for (const i of ordre) {
    if (couts[i]! <= reste) {
      garde.add(i);
      reste -= couts[i]!;
    }
  }
  const gardes = outils.filter((_, i) => garde.has(i));
  const retires = outils.filter((_, i) => !garde.has(i));
  return {
    gardes,
    retires,
    utilesRetires: outils.map((_, i) => i).filter((i) => !garde.has(i) && rang(i) < 2).map((i) => noms[i]!),
    nommes: [...nommes],
    jetonsAvant,
    jetonsApres: [...garde].reduce((a, i) => a + couts[i]!, 0),
  };
}

/**
 * La place réservée aux outils, sur ce que la conversation peut occuper sans
 * eux : on laisse à la conversation au moins la consigne et la question plus
 * 1 024 jetons, et jamais moins du quart de la place. Mesuré le 23/10/2026 :
 * à 32 768 jetons (modèle qui réfléchit), 24 321 de place sans outils, donc
 * au plus 18 241 pour les outils.
 */
export function placeDesOutils(placeSansOutils: number, essentiel: number): number {
  return Math.max(0, placeSansOutils - Math.max(essentiel + 1_024, Math.floor(placeSansOutils * 0.25)));
}
