/*
 * Import des Chats de Gemini (src/lib/importGemini.ts, src/lib/importChats.ts).
 *
 *   node scripts/essai-import-gemini.mjs
 *   node scripts/essai-import-gemini.mjs --fixtures <dossier>   écrit aussi les fixtures (essai à l'écran)
 *
 * Écrit le 28/09/2026. Le vrai lecteur de l'interface, empaqueté par esbuild,
 * lit des exports Google Takeout **fictifs**, construits ici d'après ce que
 * les relevés publics disent du format (voir l'en-tête d'importGemini.ts) :
 * aucune vraie conversation, aucun vrai export. Ce qui est vérifié :
 *  - JSON (`MyActivity.json`) et HTML (`MyActivity.html`), seuls ou dans
 *    l'archive .zip de Takeout (chemins en anglais et en français) ;
 *  - regroupement par lien de conversation, sinon par proximité dans le
 *    temps ; ordre des messages, dates d'origine, titre ;
 *  - activités qui ne sont pas des messages écartées, journal de la
 *    Recherche écarté même s'il parle de « gemini » ;
 *  - HTML piégé : aucune balise ne passe, `script`/`style`/`iframe` retirés
 *    avec leur contenu, `javascript:` jamais gardé, liens en texte ;
 *  - cas limites : fichier vide, mauvais fichier, Takeout sans Gemini, Gems
 *    seuls, .tgz, très gros fichier (en temps borné), taille annoncée ou
 *    décompressée au-delà de la limite, texte fait de `<` sans `>` ;
 *  - double import : mêmes clés d'une lecture à l'autre, et d'un export plus
 *    récent à l'ancien ; le magasin des Chats dit ce qui est déjà importé.
 */
import { build } from "esbuild";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { crc32, deflateRawSync } from "node:zlib";

const RACINE = join(dirname(fileURLToPath(import.meta.url)), "..");
const iFixtures = process.argv.indexOf("--fixtures");
const DOSSIER_FIXTURES = iFixtures > 0 ? process.argv[iFixtures + 1] : null;

let reussis = 0;
const echecs = [];
function verifier(nom, ok, detail = "") {
  if (ok) {
    reussis++;
    console.log(`  ok   ${nom}`);
  } else {
    echecs.push(`${nom}${detail ? ` (${detail})` : ""}`);
    console.log(`  ÉCHEC ${nom}${detail ? ` : ${detail}` : ""}`);
  }
}

/* ------------------------------------------------------------------ */
/* Le vrai lecteur, empaqueté                                           */
/* ------------------------------------------------------------------ */

const TMP = mkdtempSync(join(tmpdir(), "helix-essai-gemini-"));
await build({
  stdin: {
    contents:
      'export { lireExport } from "./src/lib/importChats.ts";\n' +
      'export { texteDepuisHtml, dateActivite, question } from "./src/lib/importGemini.ts";\n' +
      'export { ajouterSessionsImportees, chatsDejaImportes } from "./src/lib/store/sessions.ts";',
    resolveDir: RACINE,
    loader: "ts",
  },
  bundle: true,
  format: "esm",
  platform: "browser",
  outfile: join(TMP, "lecteur.mjs"),
  alias: { "@": join(RACINE, "src") },
  define: { "import.meta.env": "{}", __HELIX_VERSION__: '"essai"' },
  loader: { ".png": "empty", ".svg": "empty", ".css": "empty" },
  logLevel: "error",
  plugins: [
    {
      // L'accès à l'instance n'a rien à faire ici : le lecteur d'archive ne s'en sert pas.
      name: "sans-instance",
      setup(b) {
        b.onResolve({ filter: /^\.\/endpoint$/ }, () => ({ path: "endpoint", namespace: "doublure" }));
        b.onLoad({ filter: /.*/, namespace: "doublure" }, () => ({
          contents: "export const apiFetch = async () => { throw new Error('pas d\\'instance dans cet essai'); };",
          loader: "js",
        }));
      },
    },
  ],
});
const magasin = new Map([["helix:langue", "fr"]]);
globalThis.localStorage = {
  getItem: (k) => (magasin.has(k) ? magasin.get(k) : null),
  setItem: (k, v) => void magasin.set(k, String(v)),
  removeItem: (k) => void magasin.delete(k),
  key: (i) => [...magasin.keys()][i] ?? null,
  get length() {
    return magasin.size;
  },
  clear: () => magasin.clear(),
};
globalThis.window = globalThis;
globalThis.location = { protocol: "http:", search: "", href: "http://127.0.0.1/", hostname: "127.0.0.1" };
const L = await import(pathToFileURL(join(TMP, "lecteur.mjs")).href);

/* ------------------------------------------------------------------ */
/* Fabriques : archive ZIP, fichiers d'activité fictifs                 */
/* ------------------------------------------------------------------ */

/** Une archive ZIP minimale (méthode 8 ou 0), avec au besoin une taille décompressée annoncée fausse. */
function zip(fichiers) {
  const locaux = [];
  const central = [];
  let position = 0;
  for (const f of fichiers) {
    const nom = Buffer.from(f.nom, "utf8");
    const donnees = Buffer.isBuffer(f.contenu) ? f.contenu : Buffer.from(f.contenu, "utf8");
    const methode = f.stocke ? 0 : 8;
    const comprime = f.stocke ? donnees : deflateRawSync(donnees);
    const crc = crc32(donnees);
    const annoncee = f.tailleAnnoncee ?? donnees.length;
    const loc = Buffer.alloc(30);
    loc.writeUInt32LE(0x04034b50, 0);
    loc.writeUInt16LE(20, 4);
    loc.writeUInt16LE(0x0800, 6);
    loc.writeUInt16LE(methode, 8);
    loc.writeUInt32LE(crc, 14);
    loc.writeUInt32LE(comprime.length, 18);
    loc.writeUInt32LE(annoncee, 22);
    loc.writeUInt16LE(nom.length, 26);
    locaux.push(loc, nom, comprime);
    const cen = Buffer.alloc(46);
    cen.writeUInt32LE(0x02014b50, 0);
    cen.writeUInt16LE(20, 4);
    cen.writeUInt16LE(20, 6);
    cen.writeUInt16LE(0x0800, 8);
    cen.writeUInt16LE(methode, 10);
    cen.writeUInt32LE(crc, 16);
    cen.writeUInt32LE(comprime.length, 20);
    cen.writeUInt32LE(annoncee, 24);
    cen.writeUInt16LE(nom.length, 28);
    cen.writeUInt32LE(position, 42);
    central.push(cen, nom);
    position += 30 + nom.length + comprime.length;
  }
  const rep = Buffer.concat(central);
  const fin = Buffer.alloc(22);
  fin.writeUInt32LE(0x06054b50, 0);
  fin.writeUInt16LE(fichiers.length, 8);
  fin.writeUInt16LE(fichiers.length, 10);
  fin.writeUInt32LE(rep.length, 12);
  fin.writeUInt32LE(position, 16);
  return Buffer.concat([...locaux, rep, fin]);
}

const fichier = (contenu, nom) => new File([contenu], nom);

/*
 * Export JSON fictif, le plus récent d'abord (comme Takeout). Deux
 * conversations avec lien (« fil-cuisine », « fil-velo »), trois questions
 * sans lien dont deux à 10 minutes d'écart et une le lendemain, une question
 * sans réponse gardée, des activités qui ne sont pas des messages, une
 * question en japonais, une réponse piégée.
 */
const PIEGE =
  '<p>Voici <strong>la réponse</strong>.</p><script>alert("vole")</script><style>p{color:red}</style>' +
  '<img src="x" onerror="alert(1)" alt="schéma"><iframe src="https://exemple.invalid/"></iframe>' +
  '<p><a href="javascript:alert(2)">cliquez ici</a> et <a href="https://example.org/doc">la doc</a>.</p>' +
  '<pre><code>&lt;div class="x"&gt;bonjour&lt;/div&gt;\n  retrait gardé</code></pre>' +
  "<ul><li><p>premier</p></li><li>second</li></ul><table><tr><th>A</th><th>B</th></tr><tr><td>1</td><td>2</td></tr></table>" +
  "<scr<script>ipt>alert(3)</script>";
const enregistrement = (titre, quand, reponse, extra = {}) => ({
  header: "Gemini Apps",
  title: titre,
  time: quand,
  products: ["Gemini Apps"],
  activityControls: ["Gemini Apps Activity"],
  ...(reponse === null ? {} : { safeHtmlItem: [{ html: reponse }] }),
  ...extra,
});
const lien = (id) => ({ titleUrl: `https://gemini.google.com/app/${id}` });
const JOURNAL_JSON = [
  enregistrement("Prompted Et pour la sauce ?", "2026-07-20T15:20:00.100Z", "<p>Une sauce <em>fictive</em> au citron.</p>", lien("filcuisine01")),
  enregistrement("Selected preferred draft", "2026-07-20T15:19:00.000Z", null),
  enregistrement("Prompted Une recette de tarte inventée", "2026-07-20T15:15:21.568Z", PIEGE, { ...lien("filcuisine01"), attachedFiles: [{ name: "liste-courses.pdf" }] }),
  enregistrement("Prompted Question sans réponse gardée", "2026-07-19T09:05:00.000Z", null, lien("filvelo0002")),
  enregistrement("Prompted Comment régler un vélo imaginaire ?", "2026-07-19T09:00:00.000Z", "<p>Réglage fictif.</p>", lien("filvelo0002")),
  enregistrement("Cleared previous feedback", "2026-07-18T12:00:00.000Z", null),
  enregistrement("Prompted Deuxième question du matin", "2026-07-18T08:10:00.000Z", "<p>Réponse deux.</p>"),
  enregistrement("Prompted Première question du matin", "2026-07-18T08:00:00.000Z", "<p>Réponse un.</p>"),
  enregistrement("Prompted Question du soir, seule", "2026-07-17T21:00:00.000Z", "<p>Réponse du soir.</p>"),
  {
    header: "Gemini アプリ",
    title: "送信したメッセージ: これは作り話です",
    titleUrl: null,
    time: "2026-07-16T11:02:03.000Z",
    products: ["Gemini アプリ"],
    safeHtmlItem: [{ html: "<p>これも作り話です。</p>" }],
  },
];
/** Journal de la Recherche du même export : il parle de Gemini, mais ce n'en est pas. */
const JOURNAL_RECHERCHE = [
  { header: "Search", title: "Searched for gemini recette", titleUrl: "https://www.google.com/search?q=gemini", time: "2026-07-20T10:00:00.000Z", products: ["Search"] },
];

/** Carte `outer-cell` telle que Takeout l'écrit (structure relevée sur l'archive d'essai publique de gemini-exporter). */
const carte = (corps, lienConversation) =>
  '<div class="outer-cell mdl-cell mdl-cell--12-col mdl-shadow--2dp"><div class="mdl-grid"><div class="header-cell mdl-cell mdl-cell--12-col"><p class="mdl-typography--title">Gemini Apps<br></p></div>' +
  `<div class="content-cell mdl-cell mdl-cell--6-col mdl-typography--body-1">${corps}</div>` +
  '<div class="content-cell mdl-cell mdl-cell--6-col mdl-typography--body-1 mdl-typography--text-right"></div>' +
  '<div class="content-cell mdl-cell mdl-cell--12-col mdl-typography--caption"><b>Products:</b><br>&emsp;Gemini Apps<br>' +
  (lienConversation ? `<b>Details:</b><br>&emsp;${lienConversation}: <a href="${lienConversation}">${lienConversation}</a><br>` : "") +
  '<b>Why is this here?</b><br>&emsp;This activity was saved to your Google Account because the following settings were on:&nbsp;Gemini Apps Activity.&nbsp;You can control these settings &nbsp;<a href="https://myaccount.google.com/activitycontrols">here</a>.</div></div></div>';
const PAGE = (cartes) =>
  `<html><head><title>My Activity History</title><style type="text/css">body{font-family:sans-serif}</style></head><body><div class="mdl-grid">${cartes.join("")}</div></body></html>`;
const JOURNAL_HTML = PAGE([
  carte("Cleared previous feedback<br>Sep 2, 2026, 1:26:27 PM PDT<br>", null),
  carte(
    "Prompted Et la suite de l&#39;histoire ?<br>Sep 2, 2026, 12:12:52 PM PDT<br><p>La suite <strong>inventée</strong>.</p>\n<h3>Titre</h3>\n<ol><li>un</li><li>deux</li></ol>",
    "https://gemini.google.com/app/7b0000000000aaaa",
  ),
  carte(
    `Prompted Raconte une histoire fictive<br>Sep 2, 2026, 12:05:26 PM PDT<br>${PIEGE}`,
    "https://gemini.google.com/app/7b0000000000aaaa",
  ),
  carte("Prompted Dessine un chat astronaute imaginaire<br>1 generated image.<br>Sep 2, 2026, 11:36:40 AM PDT<br><p></p>\n<br>", "https://gemini.google.com/app/1b0000000000cccc"),
  carte("Prompted Question en heure de Paris<br>2 sept. 2026, 09:00:00 UTC+02:00<br><p>Réponse datée en français.</p>", "https://gemini.google.com/app/2c0000000000dddd"),
  carte("Prompted Question à la date illisible<br>2 Smarch 2026, 25:99 XYZ<br><p>Réponse sans date lisible.</p>", null),
]);

const takeoutJson = () =>
  zip([
    { nom: "Takeout/archive_browser.html", contenu: "<html><body>Archive fictive</body></html>" },
    { nom: "Takeout/My Activity/Search/MyActivity.json", contenu: JSON.stringify(JOURNAL_RECHERCHE) },
    { nom: "Takeout/My Activity/Gemini Apps/MyActivity.json", contenu: JSON.stringify(JOURNAL_JSON) },
  ]);
const takeoutHtmlFr = () =>
  zip([
    { nom: "Takeout/archive_browser.html", contenu: "<html><body>Archive fictive</body></html>" },
    { nom: "Takeout/Mes activités/Applications Gemini/MonActivité.html", contenu: JOURNAL_HTML },
    { nom: "Takeout/Mes activités/Applications Gemini/image_generee-1b.png", contenu: Buffer.from([0x89, 0x50, 0x4e, 0x47]), stocke: true },
  ]);

if (DOSSIER_FIXTURES) {
  mkdirSync(DOSSIER_FIXTURES, { recursive: true });
  writeFileSync(join(DOSSIER_FIXTURES, "MyActivity.json"), JSON.stringify(JOURNAL_JSON, null, 1));
  writeFileSync(join(DOSSIER_FIXTURES, "MyActivity.html"), JOURNAL_HTML);
  writeFileSync(join(DOSSIER_FIXTURES, "takeout-gemini-json.zip"), takeoutJson());
  writeFileSync(join(DOSSIER_FIXTURES, "takeout-gemini-html-fr.zip"), takeoutHtmlFr());
  writeFileSync(join(DOSSIER_FIXTURES, "takeout-sans-gemini.zip"), zip([{ nom: "Takeout/My Activity/Search/MyActivity.json", contenu: JSON.stringify(JOURNAL_RECHERCHE) }]));
  console.log(`Fixtures écrites dans ${DOSSIER_FIXTURES}`);
}

const erreurDe = async (f) => {
  try {
    await L.lireExport(f);
    return null;
  } catch (e) {
    return String(e?.message ?? e);
  }
};
const aucuneBalise = (texte) => !/<\s*\/?\s*(script|style|iframe|img|a|p|div|table|strong|em|li|ul|ol|h\d)\b[^<]*>/i.test(texte.replace(/```[\s\S]*?```/g, ""));

/* ------------------------------------------------------------------ */
console.log("\n1. Export JSON (MyActivity.json), seul et dans l'archive Takeout");
{
  const seul = await L.lireExport(fichier(JSON.stringify(JOURNAL_JSON), "MyActivity.json"));
  const archive = await L.lireExport(fichier(takeoutJson(), "takeout-20260720T000000Z-001.zip"));
  verifier("la source est Gemini", seul.source === "gemini" && archive.source === "gemini");
  verifier("mêmes Chats du fichier seul et de l'archive (le journal de la Recherche est écarté)", JSON.stringify(seul.chats) === JSON.stringify(archive.chats), `${seul.chats.length} / ${archive.chats.length}`);
  const par = new Map(seul.chats.map((c) => [c.cle, c]));
  verifier("5 Chats : 2 par lien de conversation, 3 par proximité (matin groupé, soir seul, japonais seul)", seul.chats.length === 5, seul.chats.map((c) => c.cle).join(", "));
  const cuisine = par.get("fil:filcuisine01");
  verifier("conversation « cuisine » : 2 questions et 2 réponses, dans l'ordre des dates", cuisine?.messages.map((m) => m.role).join(",") === "user,assistant,user,assistant" && cuisine.messages[0].content.startsWith("Une recette de tarte inventée") && cuisine.messages[2].content === "Et pour la sauce ?");
  verifier("titre : la première question, sans le préfixe « Prompted »", cuisine?.titre === "Une recette de tarte inventée");
  verifier("dates d'origine : création à la première question, modification à la dernière", cuisine?.creeLe === "2026-07-20T15:15:21.568Z" && cuisine?.modifieLe === "2026-07-20T15:20:00.100Z" && cuisine?.messages[1].createdAt === "2026-07-20T15:15:21.568Z");
  verifier("pièce jointe : son nom est noté dans la question, pas le fichier", /\[pièce jointe : liste-courses\.pdf\]/.test(cuisine?.messages[0].content ?? ""));
  const velo = par.get("fil:filvelo0002");
  verifier("question sans réponse gardée : la question seule, dans la bonne conversation", velo?.messages.map((m) => m.role).join(",") === "user,assistant,user" && velo.messages[2].content === "Question sans réponse gardée");
  const matin = seul.chats.find((c) => c.titre === "Première question du matin");
  verifier("sans lien : deux questions à 10 minutes d'écart dans un même Chat", matin?.messages.length === 4 && matin.messages[2].content === "Deuxième question du matin");
  verifier("sans lien : la question du soir précédent reste seule", seul.chats.some((c) => c.titre === "Question du soir, seule" && c.messages.length === 2));
  verifier("préfixe japonais retiré", seul.chats.some((c) => c.titre === "これは作り話です"));
  const r = (seul.remarques ?? []).join(" | ");
  verifier("l'écran dit comment les Chats ont été reconstitués", /2 Chat\(s\) regroupé\(s\) par conversation/.test(r) && /3 autre\(s\) reconstitué\(s\).*30 minutes/.test(r), r);
  verifier("l'écran dit ce qui manque : titres, réponse non gardée, fichiers, activités écartées", /pas de titres/.test(r) && /1 question\(s\) sans réponse/.test(r) && /1 question\(s\) avec des fichiers/.test(r) && /2 activité\(s\) qui ne sont pas des messages/.test(r), r);
}

console.log("\n2. HTML piégé : rien ne passe, rien ne s'exécute");
{
  const { chats } = await L.lireExport(fichier(JSON.stringify(JOURNAL_JSON), "MyActivity.json"));
  const texte = chats.find((c) => c.cle === "fil:filcuisine01")?.messages[1].content ?? "";
  verifier("aucune balise dans la réponse reprise", aucuneBalise(texte), texte.slice(0, 200));
  verifier("`script`, `style` et `iframe` retirés avec leur contenu", !/alert\("vole"\)|alert\([12]\)|color:red|exemple\.invalid/.test(texte), texte);
  verifier("`<scr<script>ipt>` ne recompose rien", !/<script/i.test(texte.replace(/```[\s\S]*?```/g, "")));
  verifier("un lien `javascript:` ne garde que son libellé", /cliquez ici/.test(texte) && !/javascript/i.test(texte));
  verifier("un lien web devient « libellé (adresse) »", texte.includes("la doc (https://example.org/doc)"));
  verifier("une image devient son texte de remplacement", texte.includes("[image : schéma]") && !/onerror/.test(texte));
  verifier("gras gardé en Markdown", texte.includes("**la réponse**"));
  verifier("bloc de code : entités décodées en texte, retrait gardé", texte.includes('```\n<div class="x">bonjour</div>\n  retrait gardé\n```'), texte);
  verifier("liste et tableau en texte", /- premier\n- second/.test(texte) && texte.includes("A | B") && texte.includes("1 | 2"), texte);
  const lent = "<p>" + "<".repeat(400_000) + "</p>";
  const t0 = Date.now();
  L.texteDepuisHtml(lent);
  verifier("400 000 `<` sans `>` : lu en temps linéaire (moins de 2 s)", Date.now() - t0 < 2000, `${Date.now() - t0} ms`);
}

console.log("\n3. Export HTML (MyActivity.html, format par défaut de Takeout), seul et dans une archive aux chemins français");
{
  const seul = await L.lireExport(fichier(JOURNAL_HTML, "MyActivity.html"));
  const archive = await L.lireExport(fichier(takeoutHtmlFr(), "takeout-fr.zip"));
  verifier("mêmes Chats du fichier seul et de l'archive « Mes activités/Applications Gemini »", JSON.stringify(seul.chats) === JSON.stringify(archive.chats), `${seul.chats.length} / ${archive.chats.length}`);
  const par = new Map(seul.chats.map((c) => [c.cle, c]));
  const histoire = par.get("fil:7b0000000000aaaa");
  verifier("conversation reconnue au lien rangé sous « Details »", histoire?.messages.length === 4, String(histoire?.messages.length));
  verifier("ordre : la plus ancienne question d'abord (Takeout range les plus récentes en tête)", histoire?.messages[0].content === "Raconte une histoire fictive" && histoire.messages[2].content === "Et la suite de l'histoire ?");
  verifier("date anglaise avec fuseau (PDT) lue exactement", histoire?.creeLe === "2026-09-02T19:05:26.000Z", histoire?.creeLe);
  verifier("date française avec décalage (UTC+02:00) lue exactement", par.get("fil:2c0000000000dddd")?.creeLe === "2026-09-02T07:00:00.000Z", par.get("fil:2c0000000000dddd")?.creeLe);
  const reponse = histoire?.messages[1].content ?? "";
  verifier("réponse HTML piégée : aucune balise, rien d'exécutable", aucuneBalise(reponse) && !/alert\("vole"\)|alert\([12]\)|javascript|onerror/i.test(reponse), reponse.slice(0, 200));
  verifier("titres et listes numérotées de la réponse en Markdown", /### Titre/.test(histoire?.messages[3].content ?? "") && /1\. un\n2\. deux/.test(histoire?.messages[3].content ?? ""), histoire?.messages[3].content);
  const image = par.get("fil:1b0000000000cccc");
  verifier("image générée : la réponse le dit, la question n'emporte pas « 1 generated image. »", image?.messages[0].content === "Dessine un chat astronaute imaginaire" && image.messages[1]?.content === "[image générée]", JSON.stringify(image?.messages));
  const illisible = seul.chats.find((c) => c.titre === "Question à la date illisible");
  verifier("date illisible : la question et la réponse restent séparées, datées d'après la voisine", illisible?.messages.length === 2 && illisible.messages[1].content === "Réponse sans date lisible.", JSON.stringify(illisible?.messages));
  verifier("« Cleared previous feedback » écarté", !seul.chats.some((c) => /Cleared/.test(c.titre)));
  const r = (seul.remarques ?? []).join(" | ");
  verifier("l'écran dit la date reconstituée et l'activité écartée", /1 activité\(s\) sans date lisible/.test(r) && /1 activité\(s\) qui ne sont pas des messages/.test(r), r);
}

console.log("\n4. Dates dans d'autres langues");
{
  const cas = [
    ["Sep 2, 2026, 1:26:27 PM PDT", "2026-09-02T20:26:27.000Z"],
    ["2 sept. 2026, 13:26:27 CEST", "2026-09-02T11:26:27.000Z"],
    ["02.09.2026, 13:26:27 MESZ", "2026-09-02T11:26:27.000Z"],
    ["2026年9月2日 13:26:27 JST", "2026-09-02T04:26:27.000Z"],
    ["2 de septiembre de 2026, 13:26:27 GMT+2", "2026-09-02T11:26:27.000Z"],
    ["2026-09-02T13:26:27Z", "2026-09-02T13:26:27.000Z"],
  ];
  for (const [texte, attendu] of cas) verifier(`« ${texte} »`, L.dateActivite(texte)?.iso === attendu, L.dateActivite(texte)?.iso);
  verifier("une phrase sans heure n'est pas une date", L.dateActivite("Raconte une histoire sur 2026") === null);
}

console.log("\n5. Mauvais fichiers : un message clair, jamais d'erreur brute");
{
  const cas = [
    ["fichier vide", fichier("", "MyActivity.json"), /Ce fichier est vide/],
    ["JSON coupé", fichier('[{"header":"Gemini Apps","title":"Prom', "MyActivity.json"), /pas un JSON lisible/],
    ["JSON d'autre chose", fichier('{"a":1}', "autre.json"), /Format non reconnu : ni ChatGPT, ni Claude, ni Gemini/],
    ["tableau vide", fichier("[]", "MyActivity.json"), /aucune conversation/],
    ["journal de la Recherche seul", fichier(JSON.stringify(JOURNAL_RECHERCHE), "MyActivity.json"), /aucune activité Gemini/],
    ["Gemini sans aucune question", fichier(JSON.stringify([enregistrement("Cleared previous feedback", "2026-07-18T12:00:00.000Z", null)]), "MyActivity.json"), /aucune question/],
    ["page HTML quelconque", fichier("<html><body><p>Bonjour</p></body></html>", "page.html"), /pas un journal d'activité de Google Takeout/],
    ["Takeout sans Gemini", fichier(zip([{ nom: "Takeout/My Activity/Search/MyActivity.json", contenu: JSON.stringify(JOURNAL_RECHERCHE) }]), "takeout.zip"), /ne contient pas d'activité Gemini/],
    ["Takeout avec les Gems seuls", fichier(zip([{ nom: "Takeout/Gemini/gems.json", contenu: '[{"name":"Gem fictif"}]' }]), "takeout.zip"), /ne contient que vos Gems/],
    ["archive .tgz", fichier("x", "takeout-001.tgz"), /\.tgz ne sont pas lues/],
    ["ZIP sans rien de connu", fichier(zip([{ nom: "notes.txt", contenu: "rien" }]), "divers.zip"), /ni activité Gemini/],
    ["pas un ZIP", fichier("ceci n'est pas une archive", "faux.zip"), /pas une archive ZIP lisible.*Google/],
  ];
  for (const [nom, f, attendu] of cas) {
    const e = await erreurDe(f);
    verifier(nom, e !== null && attendu.test(e), e ?? "aucune erreur");
  }
}

console.log("\n6. Très gros fichiers : lus en temps borné, ou refusés avant de remplir la mémoire");
{
  const gros = [];
  const debut = Date.parse("2026-01-01T00:00:00Z");
  for (let i = 0; i < 20_000; i++) {
    gros.push(enregistrement(`Prompted Question fictive numéro ${i}`, new Date(debut + (20_000 - i) * 3_600_000).toISOString(), `<p>Réponse fictive ${i} ${"texte ".repeat(100)}</p>`, i % 2 ? lien(`fil${String(i % 500).padStart(6, "0")}`) : {}));
  }
  const brut = JSON.stringify(gros);
  const t0 = Date.now();
  const lu = await L.lireExport(fichier(zip([{ nom: "Takeout/My Activity/Gemini Apps/MyActivity.json", contenu: brut }]), "gros.zip"));
  const duree = Date.now() - t0;
  const messages = lu.chats.reduce((n, c) => n + c.messages.length, 0);
  verifier(`${(brut.length / 1e6).toFixed(0)} Mo, 20 000 activités : toutes reprises (40 000 messages) en moins de 20 s`, messages === 40_000 && duree < 20_000, `${messages} messages, ${duree} ms`);
  // Les rangs impairs portent un lien (250 conversations distinctes) ; les pairs, deux heures d'écart entre eux, restent seuls.
  verifier("250 conversations par lien, et 10 000 questions sans lien en Chats d'une question (deux heures d'écart)", lu.chats.filter((c) => c.cle.startsWith("fil:")).length === 250 && lu.chats.length === 250 + 10_000, String(lu.chats.length));
  const long = await L.lireExport(fichier(JSON.stringify([enregistrement("Prompted longue", "2026-07-18T08:00:00.000Z", `<p>${"x".repeat(150_000)}</p>`)]), "MyActivity.json"));
  verifier("un message au-delà de 100 000 caractères est coupé et marqué", long.chats[0].messages[1].content.length < 100_020 && long.chats[0].messages[1].content.endsWith("[...]"));
  const annonce = zip([{ nom: "Takeout/My Activity/Gemini Apps/MyActivity.json", contenu: "[]", tailleAnnoncee: 400 * 1024 * 1024 }]);
  const e1 = await erreurDe(fichier(annonce, "annonce.zip"));
  verifier("taille annoncée au-delà de 300 Mo : refusée sans rien décompresser", /dépasse 300 Mo/.test(e1 ?? ""), e1 ?? "aucune erreur");
  const bombe = zip([{ nom: "Takeout/My Activity/Gemini Apps/MyActivity.json", contenu: Buffer.alloc(301 * 1024 * 1024, 0x20), tailleAnnoncee: 1000 }]);
  const t1 = Date.now();
  const e2 = await erreurDe(fichier(bombe, "bombe.zip"));
  verifier(`archive qui ment sur sa taille (${(bombe.length / 1e6).toFixed(1)} Mo compressés, 301 Mo décompressés) : lecture arrêtée à la limite`, /dépasse 300 Mo/.test(e2 ?? ""), `${e2 ?? "aucune erreur"}, ${Date.now() - t1} ms`);
  const e3 = await erreurDe(new File([new Uint8Array(301 * 1024 * 1024)], "MyActivity.html"));
  verifier("fichier HTML seul de plus de 300 Mo : refusé avant lecture", /dépasse 300 Mo/.test(e3 ?? ""), e3 ?? "aucune erreur");
}

console.log("\n7. Double import : aucun doublon, rien d'écrit par-dessus");
{
  const a = await L.lireExport(fichier(takeoutJson(), "a.zip"));
  const b = await L.lireExport(fichier(takeoutJson(), "b.zip"));
  verifier("deux lectures du même export : mêmes clés", JSON.stringify(a.chats.map((c) => c.cle).sort()) === JSON.stringify(b.chats.map((c) => c.cle).sort()));
  // Export plus récent : deux activités de plus en tête (une dans « cuisine », une nouvelle question seule).
  const plusRecent = [
    enregistrement("Prompted Nouvelle question, un mois plus tard", "2026-08-20T10:00:00.000Z", "<p>Nouvelle réponse.</p>"),
    enregistrement("Prompted Et le dessert ?", "2026-07-20T15:30:00.000Z", "<p>Dessert fictif.</p>", lien("filcuisine01")),
    ...JOURNAL_JSON,
  ];
  const c = await L.lireExport(fichier(JSON.stringify(plusRecent), "MyActivity.json"));
  const clesA = new Set(a.chats.map((x) => x.cle));
  verifier("export plus récent : les anciens Chats gardent leur clé, un seul nouveau", a.chats.every((x) => c.chats.some((y) => y.cle === x.cle)) && c.chats.filter((y) => !clesA.has(y.cle)).length === 1, c.chats.map((x) => x.cle).join(", "));
  verifier("la conversation « cuisine » a grandi (6 messages au lieu de 4)", c.chats.find((x) => x.cle === "fil:filcuisine01")?.messages.length === 6);
  const moi = "u-essai";
  const session = (ch) => ({
    id: `s-${ch.cle}`,
    title: ch.titre,
    ownerId: moi,
    visibility: "prive",
    sharedGroupIds: [],
    sharedWith: [],
    organisationId: "o",
    origin: "local",
    messages: [],
    createdAt: ch.creeLe,
    updatedAt: ch.modifieLe,
    importe: { source: "gemini", cle: ch.cle, messages: ch.messages.length },
  });
  const existant = { ...session(a.chats[0]), id: "s-existant", title: "Chat de la personne", importe: undefined };
  L.ajouterSessionsImportees([existant]);
  L.ajouterSessionsImportees(a.chats.map(session));
  const deja = L.chatsDejaImportes(moi, "gemini");
  verifier("le magasin des Chats retient ce qui a été importé, par clé d'origine", a.chats.every((x) => deja.get(x.cle) === x.messages.length), [...deja].join(" "));
  verifier("rien d'importé pour une autre personne ou une autre source", L.chatsDejaImportes("quelqu-un-d-autre", "gemini").size === 0 && L.chatsDejaImportes(moi, "chatgpt").size === 0);
  const avant = JSON.parse(localStorage.getItem("helix:sessions") ?? "[]");
  verifier("le Chat déjà là est intact après l'import", avant.some((s) => s.id === "s-existant" && s.title === "Chat de la personne"), String(avant.length));
  const aReprendre = c.chats.filter((x) => !deja.has(x.cle) || x.messages.length > deja.get(x.cle));
  verifier("second import : seuls le nouveau Chat et la conversation qui a grandi sont à reprendre", aReprendre.length === 2, aReprendre.map((x) => x.cle).join(", "));
}

/*
 * Une vraie archive, quand on en a une : `--archive <takeout.zip>` la lit
 * avec le même lecteur et n'affiche que des comptes et des formes (jamais le
 * texte des questions ni des réponses), pour vérifier le lecteur sans rien
 * divulguer de la conversation.
 */
const iArchive = process.argv.indexOf("--archive");
if (iArchive > 0) {
  const { readFileSync } = await import("node:fs");
  const chemin = process.argv[iArchive + 1];
  console.log(`\n8. Archive fournie : ${chemin}`);
  try {
    const lu = await L.lireExport(new File([readFileSync(chemin)], chemin.replace(/^.*\//, "")));
    const messages = lu.chats.reduce((n, c) => n + c.messages.length, 0);
    const reponses = lu.chats.reduce((n, c) => n + c.messages.filter((m) => m.role === "assistant").length, 0);
    console.log(`  source ${lu.source}, ${lu.chats.length} Chat(s), ${messages} message(s) dont ${reponses} réponse(s)`);
    console.log(`  Chats par lien : ${lu.chats.filter((c) => c.cle.startsWith("fil:")).length}, reconstitués : ${lu.chats.filter((c) => !c.cle.startsWith("fil:")).length}`);
    console.log(`  période : ${lu.chats.map((c) => c.creeLe).sort()[0]} → ${lu.chats.map((c) => c.modifieLe).sort().pop()}`);
    const balises = lu.chats.flatMap((c) => c.messages).filter((m) => !aucuneBalise(m.content)).length;
    verifier("archive fournie : aucune balise dans les messages repris", balises === 0, `${balises} message(s)`);
    for (const r of lu.remarques ?? []) console.log(`  remarque : ${r}`);
  } catch (e) {
    verifier("archive fournie : lue", false, String(e?.message ?? e));
  }
}

// 10/11/2026 : les autres exports passent par le même lecteur que Gemini.
// Des données fictives protègent aussi la branche active et les projets repris.
{
  const claude = [{ uuid: "claude-fictif", name: "Cours fictif", created_at: "2026-11-10T12:00:00Z", project_uuid: "projet-fictif", chat_messages: [
    { sender: "human", created_at: "2026-11-10T12:00:00Z", text: "Question ancienne", attachments: [{ file_name: "cours.txt", extracted_content: "Le cours joint" }] },
    { sender: "assistant", created_at: "2026-11-10T12:00:00Z", content: [{ type: "thinking", text: "Privé" }, { type: "text", text: "Réponse visible" }, { type: "tool_use", text: "Outil" }] },
    { sender: "human", created_at: "2026-11-10T12:00:00Z", content: [{ type: "text", text: "Suite" }] },
  ] }];
  const projets = [{ uuid: "projet-fictif", name: "Formation", prompt_template: "Instructions fictives", docs: [{ filename: "fiche.md", content: "Fiche de cours" }] }];
  const json = await L.lireExport(fichier(JSON.stringify(claude), "conversations.json"));
  const archive = await L.lireExport(fichier(zip([{ nom: "export/conversations.json", contenu: JSON.stringify(claude) }, { nom: "export/projects.json", contenu: JSON.stringify(projets) }]), "claude.zip"));
  verifier("Claude JSON et ZIP : mêmes Chats et messages publics", JSON.stringify(json.chats) === JSON.stringify(archive.chats) && json.source === "claude" && json.chats[0].messages.length === 3);
  verifier("Claude : pièces jointes textuelles conservées, raisonnement et outils exclus", json.chats[0].messages[0].content.includes("Le cours joint") && json.chats[0].messages[1].content === "Réponse visible");
  verifier("Claude ZIP : projet, instructions et documents reliés", archive.chats[0].projet === archive.projets[0].cle && archive.projets[0].instructions === "Instructions fictives" && archive.projets[0].documents[0].contenu === "Fiche de cours");
  const noeud = (parent, role, texte, masque = false) => ({ parent, message: { author: { role }, content: { parts: [texte] }, metadata: { is_visually_hidden_from_conversation: masque } } });
  const gpt = [{ id: "gpt-fictif", title: "Branche choisie", current_node: "final", gizmo_id: "g-p-fictif", mapping: {
    racine: noeud(null, "system", "Consigne"), question: noeud("racine", "user", "Question"),
    autre: noeud("question", "assistant", "Ancienne réponse abandonnée"),
    cache: noeud("question", "assistant", "Caché", true), final: noeud("cache", "assistant", "Réponse choisie"),
  } }];
  for (const f of [fichier(JSON.stringify(gpt), "conversations.json"), fichier(zip([{ nom: "conversations.json", contenu: JSON.stringify(gpt) }]), "chatgpt.zip")]) {
    const lu = await L.lireExport(f);
    verifier(`ChatGPT ${f.name} : branche choisie, sans système ni messages cachés`, lu.source === "chatgpt" && JSON.stringify(lu.chats[0].messages.map(m => m.content)) === JSON.stringify(["Question", "Réponse choisie"]) && lu.chats[0].projet === lu.projets[0].cle);
  }
}

rmSync(TMP, { recursive: true, force: true });
console.log(`\n${reussis} vérification(s) réussie(s), ${echecs.length} échec(s).`);
if (echecs.length) {
  for (const e of echecs) console.log(`  - ${e}`);
  process.exit(1);
}
