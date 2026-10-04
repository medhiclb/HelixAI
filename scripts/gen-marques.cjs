/*
 * Engendre `src/components/ui/marques.ts` depuis les logos officiels rangés
 * dans `scripts/marques/`.
 *
 *   node scripts/gen-marques.cjs             vérifie les empreintes, puis engendre
 *   node scripts/gen-marques.cjs --noter     réécrit les empreintes (après un relevé)
 *   node scripts/gen-marques.cjs --verifier  n'écrit rien : dit si marques.ts est à jour
 *                                            (appelé par scripts/securite.mjs)
 *
 * D'où viennent les fichiers : `scripts/marques/sources.json` donne, pour
 * chaque marque, l'adresse du fichier officiel, la page de marque de la
 * société et la règle d'usage retenue. Refaire un relevé, c'est retélécharger
 * ces fichiers aux mêmes adresses, les poser à la place des anciens, lancer
 * `--noter`, puis relire le changement à l'écran.
 *
 * Jusqu'au 28/09/2026, ce script recopiait les tracés de Simple Icons : une
 * seule couleur par marque, Gmail et Drive ramenés à un aplat, et rien pour
 * les sociétés absentes de la collection. On part désormais du fichier que la
 * société publie, en couleur, et de sa version pour fond sombre quand elle en
 * livre une.
 *
 * Troisième tournée du 28/09/2026 (décision de Medhi : « mets les vrais ») :
 * plus aucune marque neutre par choix. Quand la société ne publie pas de kit
 * téléchargeable sans case à cocher, la source est, dans l'ordre : le fichier
 * servi par son site (souvent l'icône du site), son dépôt officiel, puis une
 * reproduction fidèle sur Wikimedia Commons. Les PNG officiels restent admis,
 * et un logo sombre sans version pour fond sombre reçoit une `pastille`.
 *
 * Pourquoi un arbre de données plutôt que le SVG brut : un SVG est un document
 * qui peut porter du script, des liens, des feuilles de style. Injecter le
 * fichier tel quel (`dangerouslySetInnerHTML`) ferait confiance à chaque kit de
 * marque. On n'en garde que les éléments de dessin d'une liste fermée, et
 * les attributs de présentation d'une autre ; le reste fait échouer le script,
 * pour qu'un kit qui change se voie.
 */
const { readFileSync, writeFileSync } = require("node:fs");
const { createHash } = require("node:crypto");
const { join } = require("node:path");

const DOSSIER = join(__dirname, "marques");
const SORTIE = join(__dirname, "..", "src", "components", "ui", "marques.ts");
const NOTER = process.argv.includes("--noter");
const VERIFIER = process.argv.includes("--verifier");

const sources = JSON.parse(readFileSync(join(DOSSIER, "sources.json"), "utf8"));

/* --- Lecture d'un SVG ------------------------------------------------------ */

/** Éléments de dessin admis. Tout autre élément arrête le script. */
const ELEMENTS = new Set([
  "svg", "g", "path", "rect", "circle", "ellipse", "polygon", "polyline", "line",
  "defs", "linearGradient", "radialGradient", "stop", "clipPath", "mask",
]);
/** Éléments sans dessin, ignorés avec leur contenu. */
const IGNORES = new Set(["title", "desc", "metadata"]);

/** Attributs admis, avec leur nom React. */
const ATTRIBUTS = {
  d: "d", x: "x", y: "y", x1: "x1", y1: "y1", x2: "x2", y2: "y2", cx: "cx", cy: "cy",
  r: "r", rx: "rx", ry: "ry", fx: "fx", fy: "fy", width: "width", height: "height",
  points: "points", transform: "transform", offset: "offset", id: "id",
  fill: "fill", stroke: "stroke", opacity: "opacity",
  "fill-rule": "fillRule", "clip-rule": "clipRule", "fill-opacity": "fillOpacity",
  "stroke-width": "strokeWidth", "stroke-linecap": "strokeLinecap",
  "stroke-linejoin": "strokeLinejoin", "stroke-miterlimit": "strokeMiterlimit",
  "stroke-opacity": "strokeOpacity", "stop-color": "stopColor", "stop-opacity": "stopOpacity",
  "clip-path": "clipPath", mask: "mask",
  gradientUnits: "gradientUnits", gradientTransform: "gradientTransform",
  clipPathUnits: "clipPathUnits", maskUnits: "maskUnits",
};
/**
 * Attributs sans effet sur le dessin, ignorés (jamais recopiés). Les
 * métadonnées d'éditeur `sodipodi:` et `inkscape:` s'y ajoutent à la troisième
 * tournée (28/09/2026, fichier de Square repris de Wikimedia Commons).
 */
const SANS_EFFET = /^(xmlns(:.*)?|version|xml:space|data-.*|enable-background|role|aria-.*|style|class|xmlns:xlink|preserveAspectRatio|viewBox|focusable|(sodipodi|inkscape):[-A-Za-z]+)$/;

/**
 * Fonctions admises dans une valeur : les transformations, les couleurs, et
 * `url(#…)` vers un élément du dessin lui-même.
 */
const FONCTIONS = new Set(["matrix", "translate", "scale", "rotate", "skewx", "skewy", "rgb", "rgba", "hsl", "hsla", "hwb", "lab", "lch", "oklab", "oklch", "color", "url"]);

/**
 * Une valeur d'attribut sans rien qui sorte du dessin.
 *
 * Tournée de la 2026.928.3 (SECURITE.md § 43) : le contrôle ne cherchait que
 * `url(` en minuscules. Le navigateur lit une valeur de présentation comme du
 * CSS, où les noms de fonction ignorent la casse et s'écrivent aussi avec des
 * échappements : `URL(https://…)`, `u\72l(…)`, `\75rl(//…)`, ou une classe
 * `.a{fill:URL(…)}`, passaient jusqu'à marques.ts (essayé sur des fichiers
 * piégés, dans un dossier temporaire), de même qu'`image-set(…)`. Refusés :
 * tout échappement, toute entité, toute fonction hors de la liste, toute
 * `url()` qui ne désigne pas un identifiant du dessin, quelle que soit la casse.
 */
function valeurSure(v, fichier) {
  if (/[\\&<>`]/.test(v)) throw new Error(`${fichier} : échappement ou caractère non admis dans « ${v} »`);
  for (const m of v.matchAll(/([A-Za-z_-][-A-Za-z0-9_]*)\s*\(/g)) {
    if (!FONCTIONS.has(m[1].toLowerCase())) throw new Error(`${fichier} : fonction non admise « ${m[1]}( » dans « ${v} »`);
  }
  if (/url\(\s*['"]?(?!#)/i.test(v) || /javascript:/i.test(v)) throw new Error(`${fichier} : référence externe « ${v} »`);
}

function attributsBruts(texte) {
  const a = {};
  for (const m of texte.matchAll(/([A-Za-z_:][-A-Za-z0-9_:.]*)\s*=\s*("([^"]*)"|'([^']*)')/g)) {
    a[m[1]] = m[3] ?? m[4];
  }
  return a;
}

/** `fill:#fff; stroke-width:2` → { fill: "#fff", "stroke-width": "2" } */
function declarations(texte) {
  const d = {};
  for (const morceau of texte.split(";")) {
    const i = morceau.indexOf(":");
    if (i < 0) continue;
    const nom = morceau.slice(0, i).trim();
    const valeur = morceau.slice(i + 1).trim();
    if (nom) d[nom] = valeur;
  }
  return d;
}

/** Règles `.cls-1 { fill: … }` d'une balise <style>, sélecteurs de classe seulement. */
function reglesDeStyle(css, fichier) {
  const regles = {};
  /*
   * Règles réservées au thème du système (`@media (prefers-color-scheme: …)`),
   * que des icônes de site portent (Scaleway, Zendesk, troisième tournée du
   * 28/09/2026) : Helix choisit son thème lui-même et pose, s'il le faut, un
   * dessin « sombre » distinct. Elles sont retirées, jamais appliquées. Toute
   * autre règle @ (import, font-face…) reste refusée par le contrôle des
   * sélecteurs ci-dessous.
   */
  const propre = css
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/@media\s*\(\s*prefers-color-scheme\s*:\s*(dark|light)\s*\)\s*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, "");
  // Ce qui reste hors des règles (`@import …;`, une accolade d'un bloc @ non géré) arrête le script au lieu d'être ignoré en silence.
  const horsRegles = propre.replace(/([^{}]+)\{([^{}]*)\}/g, "").trim();
  if (horsRegles) throw new Error(`${fichier} : CSS non géré « ${horsRegles.slice(0, 60)} »`);
  for (const m of propre.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const decl = declarations(m[2]);
    for (const sel of m[1].split(",").map((s) => s.trim()).filter(Boolean)) {
      if (!/^\.[-A-Za-z0-9_]+$/.test(sel)) throw new Error(`${fichier} : sélecteur CSS non géré « ${sel} »`);
      regles[sel.slice(1)] = { ...(regles[sel.slice(1)] ?? {}), ...decl };
    }
  }
  return regles;
}

/** Applique `f` jusqu'à ce que le texte ne change plus. */
function jusquAStable(texte, f) {
  let avant;
  do {
    avant = texte;
    texte = f(texte);
  } while (texte !== avant);
  return texte;
}

/** Lit un SVG en arbre `[balise, attributs, enfants]`. */
function lireSvg(fichier) {
  // Jusqu'à ce que rien ne bouge : un retrait peut en faire apparaître un autre (« <!-<!---->- »), CodeQL 04/10/2026.
  const texte = jusquAStable(readFileSync(join(DOSSIER, fichier), "utf8"), (s) =>
    s.replace(/<\?xml[\s\S]*?\?>/g, "").replace(/<!DOCTYPE[\s\S]*?>/gi, "").replace(/<!--[\s\S]*?-->/g, ""),
  );

  // Feuilles de style d'abord : elles s'appliquent partout dans le document.
  let classes = {};
  const sansStyle = jusquAStable(texte, (s) =>
    s.replace(/<style[^>]*>([\s\S]*?)<\/style>/g, (_, css) => {
      classes = { ...classes, ...reglesDeStyle(css, fichier) };
      return "";
    }),
  );

  const racine = { balise: "#", attributs: {}, enfants: [] };
  const pile = [racine];
  let ignorer = 0;
  for (const m of sansStyle.matchAll(/<(\/?)([A-Za-z][-A-Za-z0-9:]*)([^>]*?)(\/?)>/g)) {
    const [, fermante, balise, reste, auto] = m;
    if (IGNORES.has(balise)) {
      if (fermante) ignorer--;
      else if (!auto) ignorer++;
      continue;
    }
    if (ignorer) continue;
    if (fermante) {
      const haut = pile.pop();
      if (haut.balise !== balise) throw new Error(`${fichier} : </${balise}> ferme <${haut.balise}>`);
      continue;
    }
    if (!ELEMENTS.has(balise)) throw new Error(`${fichier} : élément non admis <${balise}>`);
    const brut = attributsBruts(reste);
    // Ordre de priorité du SVG : attribut, puis classe, puis style en ligne.
    const fusion = { ...brut };
    for (const c of (brut.class ?? "").split(/\s+/).filter(Boolean)) Object.assign(fusion, classes[c] ?? {});
    if (brut.style) Object.assign(fusion, declarations(brut.style));
    const attributs = {};
    for (const [nom, valeur] of Object.entries(fusion)) {
      if (nom === "viewBox" && balise === "svg") attributs.viewBox = valeur;
      else if ((nom === "width" || nom === "height") && balise === "svg") attributs[nom] = valeur;
      else if (ATTRIBUTS[nom]) attributs[ATTRIBUTS[nom]] = valeur;
      else if (nom === "href" || nom === "xlink:href") throw new Error(`${fichier} : lien non géré (${nom})`);
      else if (!SANS_EFFET.test(nom)) throw new Error(`${fichier} : attribut non admis « ${nom} » sur <${balise}>`);
    }
    for (const v of Object.values(attributs)) valeurSure(v, fichier);
    const noeud = { balise, attributs, enfants: [] };
    pile[pile.length - 1].enfants.push(noeud);
    if (!auto) pile.push(noeud);
  }
  if (pile.length !== 1) throw new Error(`${fichier} : balises non refermées`);
  const svg = racine.enfants[0];
  if (!svg || svg.balise !== "svg") throw new Error(`${fichier} : pas de <svg> à la racine`);
  return svg;
}

/**
 * Identifiants courts (a, b, c…) : le rendu les préfixe à chaque dessin pour
 * que deux logos sur la même page ne se volent pas leurs dégradés.
 */
function renommerIds(svg) {
  const table = new Map();
  const noter = (n) => {
    if (n.attributs.id) {
      if (!table.has(n.attributs.id)) table.set(n.attributs.id, String.fromCharCode(97 + table.size));
      n.attributs.id = table.get(n.attributs.id);
    }
    n.enfants.forEach(noter);
  };
  const remplacer = (n) => {
    for (const [k, v] of Object.entries(n.attributs)) {
      if (k === "id") continue;
      n.attributs[k] = v.replace(/url\(\s*['"]?#([^'")\s]+)['"]?\s*\)/g, (tout, id) => {
        if (!table.has(id)) throw new Error(`référence à un identifiant absent : #${id}`);
        return `url(#${table.get(id)})`;
      });
    }
    n.enfants.forEach(remplacer);
  };
  svg.enfants.forEach(noter);
  svg.enfants.forEach(remplacer);
  return table.size > 0;
}

/** Arbre compact : [balise, attributs] ou [balise, attributs, enfants]. */
function compacter(n) {
  const a = { ...n.attributs };
  return n.enfants.length ? [n.balise, a, n.enfants.map(compacter)] : [n.balise, a];
}

function dessin(fichier, cadre) {
  /*
   * Un PNG officiel, quand la société ne publie son logo qu'en image (le glyphe
   * en dégradé d'Instagram, 28/09/2026 : même son SVG n'est qu'une image
   * découpée). Intégré en données, sans appel réseau ; seule la signature PNG
   * est admise. Même cas pour les icônes de produit Google redessinées en
   * 2026 (seconde tournée du 28/09/2026) : leur version 2, celle que la charte
   * de l'API Drive désigne, n'est publiée qu'en PNG.
   */
  if (fichier.endsWith(".png")) {
    const octets = readFileSync(join(DOSSIER, fichier));
    if (!octets.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
      throw new Error(`${fichier} : ce n'est pas un PNG`);
    }
    return { viewBox: "0 0 1 1", ids: false, corps: [], image: `data:image/png;base64,${octets.toString("base64")}` };
  }
  const svg = lireSvg(fichier);
  const viewBox = cadre ?? svg.attributs.viewBox ?? `0 0 ${parseFloat(svg.attributs.width)} ${parseFloat(svg.attributs.height)}`;
  if (!/^-?[\d.]+(\s+-?[\d.]+){3}$/.test(viewBox.trim())) throw new Error(`${fichier} : viewBox illisible « ${viewBox} »`);
  // Les attributs du <svg> racine (fill="none", par exemple) passent à un <g>
  // qui enveloppe le dessin : le rendu pose son propre <svg>.
  // Son `id` (« Layer_1 » chez GitLab et Together) n'était ni renommé ni
  // préfixé : deux logos sur la page portaient le même, et un kit pouvait y
  // mettre « root » (tournée de la 2026.928.3, § 43). Rien ne le désigne : il
  // est retiré, et une référence vers lui ferait échouer `renommerIds`.
  const { viewBox: _v, width: _w, height: _h, id: _id, ...heritage } = svg.attributs;
  const ids = renommerIds(svg);
  const enfants = svg.enfants.map(compacter);
  const corps = Object.keys(heritage).length ? [["g", heritage, enfants]] : enfants;
  return { viewBox: viewBox.trim().split(/\s+/).map(Number).join(" "), ids, corps };
}

/* --- Empreintes ------------------------------------------------------------ */

const empreinte = (f) => createHash("sha256").update(readFileSync(join(DOSSIER, f))).digest("hex");
let ecarts = 0;
for (const [cle, m] of Object.entries(sources.marques)) {
  m.empreintes ??= {};
  for (const f of [m.clair, m.sombre].filter(Boolean)) {
    const e = empreinte(f);
    if (NOTER) m.empreintes[f] = e;
    else if (m.empreintes[f] !== e) {
      console.error(`${cle} : ${f} ne correspond plus à l'empreinte notée (${m.empreintes[f] ?? "aucune"}).`);
      ecarts++;
    }
  }
}
if (NOTER) {
  writeFileSync(join(DOSSIER, "sources.json"), JSON.stringify(sources, null, 2) + "\n", "utf8");
  console.log("Empreintes réécrites dans scripts/marques/sources.json.");
} else if (ecarts) {
  console.error("Un fichier officiel a changé : relire le changement, puis relancer avec --noter.");
  process.exit(1);
}

/* --- Écriture de marques.ts ------------------------------------------------ */

const entrees = [];
for (const [cle, m] of Object.entries(sources.marques)) {
  const clair = dessin(m.clair, m.cadre);
  const sombre = m.sombre ? dessin(m.sombre, m.cadreSombre ?? m.cadre) : null;
  const champs = [
    `    titre: ${JSON.stringify(m.titre)},`,
    `    clair: ${JSON.stringify(clair)},`,
  ];
  if (sombre) champs.push(`    sombre: ${JSON.stringify(sombre)},`);
  if (m.grand) {
    // Hauteur minimale imposée par la charte (YouTube : 100 px) : voir `CleMarqueGrande`.
    const { hauteurMin, hauteurLogo } = m.grand;
    const hauteurCadre = Number(clair.viewBox.split(" ")[3]);
    if (!(hauteurMin > 0 && hauteurLogo > 0 && hauteurLogo <= hauteurCadre)) throw new Error(`${cle} : « grand » illisible`);
    champs.push(`    grand: ${JSON.stringify({ hauteurMin, hauteurLogo })},`);
  }
  /*
   * Taille minimale et zone de protection écrites dans la charte (28/09/2026,
   * seconde tournée) : GitLab jamais sous 20 px, Todoist sous 16 px, Canva
   * avec 8 px libres autour, Tavily avec la hauteur du logo… LogoMarque les
   * applique (voir `degagement`) au lieu de les laisser dans un commentaire.
   * `marge.part` est une part de la hauteur affichée, `marge.px` un minimum
   * en pixels ; la plus grande des deux s'applique.
   */
  if (m.tailleMin !== undefined) {
    if (!(Number.isFinite(m.tailleMin) && m.tailleMin > 0 && m.tailleMin < 100)) throw new Error(`${cle} : « tailleMin » illisible`);
    champs.push(`    tailleMin: ${m.tailleMin},`);
  }
  if (m.marge !== undefined) {
    const { part = 0, px = 0, ...reste } = m.marge;
    if (Object.keys(reste).length || !(part >= 0 && part <= 2 && px >= 0 && px <= 40) || !(part > 0 || px > 0)) throw new Error(`${cle} : « marge » illisible`);
    champs.push(`    marge: ${JSON.stringify({ part, px })},`);
  }
  /*
   * Pastille claire en thème sombre (troisième tournée, 28/09/2026) : pour un
   * logo sombre sans version pour fond sombre (Square, OVHcloud…), qui s'y
   * perdrait. Le dessin n'est pas recoloré ; LogoMarque pose un fond clair
   * derrière lui, en thème sombre seulement.
   */
  if (m.pastille !== undefined) {
    if (m.pastille !== true) throw new Error(`${cle} : « pastille » illisible`);
    if (m.sombre) throw new Error(`${cle} : « pastille » avec un dessin sombre, l'un des deux est de trop`);
    champs.push(`    pastille: true,`);
  }
  entrees.push(`  ${cle}: {\n${champs.join("\n")}\n  },`);
}
const grandes = Object.entries(sources.marques).filter(([, m]) => m.grand).map(([cle]) => JSON.stringify(cle));

const neutres = Object.keys(sources.neutres).join(", ");
const phraseNeutres = neutres
  ? ` * Gardent une icône neutre, faute de source officielle : ${neutres}.
 * Les raisons sont dans scripts/marques/sources.json.`
  : ` * Aucune marque ne garde d'icône neutre par choix : décision de Medhi du
 * 28/09/2026 (« mets les vrais »), qui assume le risque lié aux marques.
 * Chaque service et chaque fournisseur affiché porte son vrai logo ; seuls
 * les services qui ne sont la marque de personne (fichiers, mémoire…) gardent
 * une icône neutre.`;

const entete = `/**
 * Logos des services et des fournisseurs de modèles, en couleur, tels que les
 * sociétés les publient.
 *
 * D'où ils viennent : chaque dessin est tiré du fichier officiel rangé dans
 * scripts/marques/, relevé le ${sources.releve.split("-").reverse().join("/")} sur le kit ou la page de marque de la
 * société (adresse, date et règle d'usage dans scripts/marques/sources.json,
 * et résumé dans THIRD_PARTY_NOTICES.md, « Marques et logos »). Les logos
 * appartiennent à leurs sociétés ; Helix ne les montre que pour désigner le
 * service qu'on branche ou le modèle qu'on choisit.
 *
 * EXCEPTION ASSUMÉE À LA RÈGLE DES TOKENS : ces couleurs sont en hexadécimal.
 * Ce ne sont pas des couleurs d'interface mais des données, celles que ces
 * sociétés imposent pour leur marque, et leurs chartes interdisent de les
 * changer. Les rendre aux couleurs de Helix les rendrait méconnaissables, et
 * fautives.
 *
 * Chaque marque a un dessin « clair » et, quand la société en livre un, un
 * dessin « sombre » (logo blanc de GitHub, X, Vercel…) : LogoMarque montre
 * l'un ou l'autre selon le thème. Sans dessin sombre, le même sert aux deux.
 *
${phraseNeutres}
 *
 * Marques « grandes » (\`grand\`) : le logo complet, dessiné en grand dans un
 * panneau (YouTube : 100 px de logo). Elles ne passent que par
 * LogoMarqueGrand ; en petit, dans une liste, c'est une autre clé qui sert
 * (\`youtubeIcone\`, l'icône seule).
 *
 * Pastille (\`pastille\`) : logo sombre sans version pour fond sombre ;
 * LogoMarque pose un fond clair derrière lui en thème sombre.
 *
 * Taille minimale (\`tailleMin\`) et zone de protection (\`marge\`) : celles
 * que la charte écrit en chiffres. LogoMarque les applique à l'affichage.
 *
 * Une marque peut figurer ici sans paraître nulle part : ce sont les tables
 * de src/components/settings/marquesConnecteurs.ts qui la branchent à un écran.
 *
 * Fichier engendré par scripts/gen-marques.cjs, à ne pas modifier à la main.
 */

/** Un nœud de dessin : balise, attributs de présentation, enfants. */
export type NoeudMarque = [string, Record<string, string>] | [string, Record<string, string>, NoeudMarque[]];

export interface DessinMarque {
  viewBox: string;
  /** Le dessin porte des identifiants (dégradés, découpes) à rendre uniques. */
  ids: boolean;
  corps: NoeudMarque[];
  /** Logo publié seulement en image : un PNG officiel, en données. */
  image?: string;
}

export interface Marque {
  titre: string;
  clair: DessinMarque;
  sombre?: DessinMarque;
  /**
   * Hauteur minimale du logo imposée par la charte, en pixels, et hauteur du
   * logo lui-même dans le cadre (viewBox), marge de protection du kit exclue.
   */
  grand?: { hauteurMin: number; hauteurLogo: number };
  /** Hauteur d'affichage minimale imposée par la charte, en pixels. En dessous, LogoMarque montre l'icône neutre. */
  tailleMin?: number;
  /**
   * Zone de protection de la charte : \`part\` de la hauteur affichée, \`px\`
   * minimum en pixels. LogoMarque ajoute la marge qui manque au dégagement
   * que l'écran garantit déjà autour du logo.
   */
  marge?: { part: number; px: number };
  /** Fond clair derrière le logo en thème sombre, pour un logo sombre sans version pour fond sombre. */
  pastille?: true;
}

export const MARQUES = {
`;

const pied = `} satisfies Record<string, Marque>;

export type CleMarque = keyof typeof MARQUES;

/** Marques à hauteur minimale (\`grand\`) : seulement par LogoMarqueGrand. */
export type CleMarqueGrande = ${grandes.join(" | ") || "never"};

/** Marques qu'on peut montrer à la taille d'une ligne de liste. */
export type CleMarquePetite = Exclude<CleMarque, CleMarqueGrande>;
`;

const contenu = entete + entrees.join("\n") + "\n" + pied;
if (VERIFIER) {
  // Pour scripts/securite.mjs : marques.ts doit être exactement ce que ces fichiers donnent.
  if (readFileSync(SORTIE, "utf8") !== contenu) {
    console.error("src/components/ui/marques.ts ne correspond pas à scripts/marques/ : relancer node scripts/gen-marques.cjs.");
    process.exit(1);
  }
  console.log(`marques.ts à jour : ${entrees.length} marques, ${Object.keys(sources.neutres).length} laissées neutres.`);
} else {
  writeFileSync(SORTIE, contenu, "utf8");
  console.log(`marques.ts engendré : ${entrees.length} marques, ${Object.keys(sources.neutres).length} laissées neutres.`);
}
