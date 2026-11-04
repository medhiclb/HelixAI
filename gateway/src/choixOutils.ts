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
 *  1. ceux du service nommé dans la demande (« Roblox », « Studio »,
 *     « Blender », « Unreal », le nom d'un connecteur) ;
 *  2. les outils déjà appelés dans cette conversation ;
 *  3. les plus courants (fichiers, bibliothèque, bureautique, réunions,
 *     tâches) ;
 *  4. le reste, dans l'ordre où il arrive ;
 * chacun gardé s'il tient encore dans la place réservée aux outils. Seuls les
 * outils du service nommé comptent comme utiles ; sans service nommé, ce sont
 * les outils déjà appelés. L’écran prévient seulement si l’un d’eux est retiré.
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
 * Medhi), sauf les noms explicites des autres logiciels Studio.
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
    // « Studio » reste un raccourci Roblox, sauf dans le nom explicite d’un autre logiciel.
    const domaine=s==='roblox'?t.replace(/\b(?:lm studio|visual studio(?: code)?|android studio|studio video|video studio|ai studio)\b/g,' '):t;
    if (mots.some((m) => domaine.includes(` ${m} `))) trouve.add(s);
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
  /** Outils utiles au service demandé ou poursuivi, qui n’ont pas tenu. */
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
  // 04/11/2026 : repérer Studio ne suffit pas. Au tour suivant, ses outils de
  // lecture et d’écriture restent prioritaires même s’ils n’ont pas encore servi.
  // Un service explicitement demandé garde toujours la première place.
  let serviceActif: string | undefined;
  for (const message of messages) {
    if ((message as { role?: string })?.role !== "assistant") continue;
    const appels = (message as { tool_calls?: unknown })?.tool_calls;
    if (!Array.isArray(appels)) continue;
    for (const appel of appels) {
      const nom = appel?.function?.name;
      if (typeof nom === "string" && noms.includes(nom)) {
        const service = serviceDe(nom);
        // Lire un fichier intermédiaire ne termine pas le travail dans Studio.
        if (!COURANTS.includes(service) || serviceActif === undefined || COURANTS.includes(serviceActif)) serviceActif = service;
      }
    }
  }

  const serviceSpecialiseNomme = [...nommes].some((s) => !COURANTS.includes(s));
  const continuerService = serviceActif !== undefined && !COURANTS.includes(serviceActif) && !serviceSpecialiseNomme;
  const servicesUtiles = continuerService ? new Set([serviceActif]) : nommes;
  const rang = (i: number): number => {
    const n = noms[i]!;
    const s = serviceDe(n);
    // « Crée un dossier » dans le travail Studio ne doit pas faire passer
    // les fichiers du poste devant les dossiers du jeu.
    if (continuerService && s === serviceActif) return 0;
    if (nommes.has(s)) return continuerService ? 1 : 0;
    if (appeles.has(n)) return 1;
    if (s === serviceActif) return 1.5;
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
    utilesRetires: outils.map((_, i) => i).filter((i) => !garde.has(i) && (servicesUtiles.size>0?servicesUtiles.has(serviceDe(noms[i]!)):appeles.has(noms[i]!))).map((i) => noms[i]!),
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

/** Allège seulement la documentation du schéma, jamais ses contraintes ni les valeurs d'exemple. */
export function allegerOutilsConnectes<T extends OutilNomme>(outils:T[]):T[]{
 const court=(s:string,max:number)=>s.length<=max?s:s.slice(0,max).trimEnd()+'...';
 const schema=(v:unknown):unknown=>{
  if(!v||typeof v!=='object'||Array.isArray(v))return v;
  const r={...v as Record<string,unknown>};if(typeof r.description==='string')r.description=court(r.description,192);
  for(const k of ['properties','patternProperties','$defs','definitions','dependentSchemas'])if(r[k]&&typeof r[k]==='object'&&!Array.isArray(r[k]))r[k]=Object.fromEntries(Object.entries(r[k] as Record<string,unknown>).map(([n,x])=>[n,schema(x)]));
  for(const k of ['items','prefixItems','allOf','anyOf','oneOf','not','if','then','else','additionalProperties','unevaluatedProperties','contains','propertyNames'])if(r[k]&&typeof r[k]==='object')r[k]=Array.isArray(r[k])?(r[k] as unknown[]).map(schema):schema(r[k]);
  return r;
 };
 return outils.map(o=>{const copie=JSON.parse(JSON.stringify(o));if(copie.function){if(typeof copie.function.description==='string')copie.function.description=court(copie.function.description,640);if(copie.function.parameters)copie.function.parameters=schema(copie.function.parameters)}return copie as T});
}
