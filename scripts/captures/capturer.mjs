/*
 * Les captures du README, refaites d'une commande (28/09/2026).
 *
 * Mode d'emploi
 * ─────────────
 *   node scripts/captures/capturer.mjs --langue ja            les 8 images et l'animation
 *   node scripts/captures/capturer.mjs --langue en            (en : docs/images/, sinon docs/images/<langue>/)
 *   node scripts/captures/capturer.mjs --langue fr --seulement chat,home
 *   node scripts/captures/capturer.mjs --langue zh --sortie /tmp/essai
 *   … --explorer                                              garde le dossier temporaire (journaux, écrans d'échec)
 *
 * Langues : en, fr, zh, ja, es, de, ar (scenes/<langue>.mjs). Sorties : agents, chat,
 * code, compare, home, knowledge, training, usage (PNG 2560 × 1600, fenêtre
 * 1280 × 800 en densité 2, thème clair) et demo (GIF 1280 × 800, 18,6 s,
 * moins de 500 Ko, avec ffmpeg). Il faut Google Chrome (ou `CHROME`), ffmpeg
 * pour l'animation, et les dépendances du dépôt installées (`npm install`).
 *
 * Ce qui tourne, tout sur 127.0.0.1, sur des ports libres :
 *  - une passerelle d'essai (gateway/src/index.ts) : dossier personnel,
 *    données et profil jetables (`"chiffrement": "fichier"`), faux
 *    `security`, `lms`, `rtk` et `opencode` en tête du PATH, et un module
 *    préalable (prealable.mjs) qui l'empêche de sortir de la machine ;
 *  - le faux modèle de la scène (faux-modele.mjs), en guise de LM Studio et
 *    de Mistral AI (clé factice) ;
 *  - un faux OpenCode (faux-opencode.mjs) qui joue la séance de Helix Code ;
 *  - le serveur de développement de l'interface (Vite), relié à cette passerelle ;
 *  - un Chrome sans fenêtre, au profil jetable (cdp.mjs).
 * Rien ne touche au LM Studio de la machine, à ~/.lmstudio, ni aux ports
 * 1234, 41343, 18789, 18800 et 8787. L'application empaquetée n'est jamais lancée.
 *
 * Les données sont fictives : la boulangerie Maple & Rye, Alex Morgan,
 * Priya, le moulin Millstone Mills, leurs documents, sous une adresse en
 * `.example` et un mot de passe écrit dans la scène. Tout est créé par la
 * passerelle elle-même, par son API ou par l'écran (compte, documents et
 * base de connaissances indexée, Chats, agents, exemples d'entraînement, clé
 * Mistral factice, question de la démonstration, séance de Code), sauf une
 * chose qui ne peut pas tourner ici et que Chrome reçoit de la scène à la
 * place de la réponse de la passerelle : la fiche des agents toujours actifs
 * et leurs comptes rendus (ils vivent dans OpenClaw, qu'on ne lance pas).
 * Voir `intercepter` plus bas.
 */
import { spawn } from "node:child_process";
import { chmodSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createServer as serveurNet } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { enJs, lancerChrome } from "./cdp.mjs";
import { demarrerFauxModele } from "./faux-modele.mjs";

const ICI = dirname(fileURLToPath(import.meta.url));
const RACINE = join(ICI, "..", "..");

/* ── Arguments ─────────────────────────────────────────────────────────── */

const arg = (nom, defaut) => {
  const i = process.argv.indexOf(`--${nom}`);
  return i > 0 ? process.argv[i + 1] : defaut;
};
const LANGUE = arg("langue", "en");
const LANGUES = ["en", "fr", "zh", "ja", "es", "de", "ar"];
if (!LANGUES.includes(LANGUE)) throw new Error(`Langue inconnue : ${LANGUE} (${LANGUES.join(", ")})`);
const SORTIE = arg("sortie", join(RACINE, "docs", "images", ...(LANGUE === "en" ? [] : [LANGUE])));
const TOUTES = ["home", "chat", "compare", "knowledge", "agents", "code", "training", "usage", "demo"];
const SEULEMENT = arg("seulement", TOUTES.join(",")).split(",").map((s) => s.trim()).filter(Boolean);
const EXPLORER = process.argv.includes("--explorer");
const { default: scene } = await import(`./scenes/${LANGUE}.mjs`);

const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
const portLibre = () =>
  new Promise((ok) => {
    const s = serveurNet();
    s.listen(0, "127.0.0.1", () => {
      const { port } = s.address();
      s.close(() => ok(port));
    });
  });
const INTERDITS = new Set([1234, 41343, 18789, 18800, 8787]);
const port = async () => {
  for (;;) {
    const p = await portLibre();
    if (!INTERDITS.has(p)) return p;
  }
};
const journal = (...m) => console.log(`[captures ${LANGUE}]`, ...m);

/* ── L'environnement jetable ───────────────────────────────────────────── */

const TMP = realpathSync(mkdtempSync(join(tmpdir(), `helix-captures-${LANGUE}-`)));
const MAISON = join(TMP, "maison");
const BIN = join(TMP, "bin");
const DONNEES = join(TMP, "donnees");
const ESPACE = join(TMP, "espace");
const PROJETS = join(TMP, "projets");
for (const d of [MAISON, BIN, DONNEES, ESPACE, PROJETS, join(TMP, "Applications")]) mkdirSync(d, { recursive: true });

const PORT_MODELE = await port();
const PORT_PASSERELLE = await port();
const PORT_VITE = await port();
const FAUX = `http://127.0.0.1:${PORT_MODELE}`;
const G = `http://127.0.0.1:${PORT_PASSERELLE}`;

/*
 * Faux `lms` : ce que LM Studio dirait de ses modèles (`ls`, `ps`), et rien
 * d'autre. Il ne charge rien, ne démarre aucun serveur : le « serveur » est
 * le faux modèle, déjà en marche.
 */
const LMS = `#!/bin/sh
case "$1" in
  ls) echo '${JSON.stringify([
    { modelKey: scene.modeleChat, path: `${scene.modeleChat}/model.gguf`, type: "llm", sizeBytes: 6_600_000_000, paramsString: "9B", architecture: "qwen35", trainedForToolUse: true, vision: false, maxContextLength: 262144 },
    { modelKey: scene.modeleEmbed, path: "nomic-ai/nomic-embed-text-v1.5.gguf", type: "embedding", sizeBytes: 84_000_000, architecture: "nomic-bert" },
  ])}' ;;
  ps) echo '${JSON.stringify([{ modelKey: scene.modeleChat, identifier: scene.modeleChat, contextLength: 32768 }])}' ;;
  version|--version) echo "lms 0.0.47" ;;
  *) exit 0 ;;
esac
`;
for (const [nom, corps] of [
  ["security", "#!/bin/sh\nexit 44\n"],
  ["lms", LMS],
  ["rtk", "#!/bin/sh\ncase \"$1\" in --version) echo rtk 0.50.0 ;; rewrite) exit 1 ;; *) exec \"$@\" ;; esac\n"],
  ["opencode", `#!/bin/sh\nexec "${process.execPath}" "${join(ICI, "faux-opencode.mjs")}" "$@" --scene "${join(TMP, "code.json")}"\n`],
  ["node", `#!/bin/sh\nexec "${process.execPath}" "$@"\n`],
]) {
  writeFileSync(join(BIN, nom), corps);
  chmodSync(join(BIN, nom), 0o755);
}
/*
 * La séance de Helix Code que joue le faux OpenCode : liste de tâches, deux
 * lectures, une recherche, deux modifications, puis la commande de tests,
 * laissée en cours (c'est pendant qu'elle tourne que la capture est prise).
 */
const PROJET = join(PROJETS, scene.code.projet);
mkdirSync(PROJET, { recursive: true });
const taches = (k) => scene.code.taches.map((content, i) => ({ id: String(i + 1), content, status: i < k ? "completed" : i === k ? "in_progress" : "pending", priority: "high" }));
const fichierCode = join(PROJET, "src", "orders", "deliverySlot.ts");
const fichierTest = join(PROJET, "src", "orders", "deliverySlot.test.ts");
writeFileSync(
  join(TMP, "code.json"),
  JSON.stringify({
    avantMs: 900,
    reflexion: scene.code.reflexion,
    etapes: [
      { outil: "todowrite", entree: { todos: taches(0) }, dureeMs: 120 },
      { outil: "read", entree: { filePath: fichierCode }, dureeMs: 180, sortie: scene.code.fichiers["src/orders/deliverySlot.ts"] },
      { outil: "read", entree: { filePath: fichierTest }, dureeMs: 160, sortie: scene.code.fichiers["src/orders/deliverySlot.test.ts"] },
      { outil: "grep", entree: { pattern: "CUTOFF_HOUR", path: PROJET }, dureeMs: 140, sortie: "src/orders/deliverySlot.ts:2" },
      { outil: "todowrite", entree: { todos: taches(1) }, dureeMs: 120 },
      { outil: "edit", entree: { filePath: fichierCode, oldString: "slot.setDate(slot.getDate() + 1);", newString: "slot.setDate(slot.getDate() + (orderedAt.getHours() >= CUTOFF_HOUR ? 2 : 1));" }, dureeMs: 1150 },
      { outil: "todowrite", entree: { todos: taches(2) }, dureeMs: 120 },
      { outil: "edit", entree: { filePath: fichierTest, oldString: "});\n", newString: `});\n\ntest(${JSON.stringify(scene.code.nouveauTest)}, () => {});\n` }, dureeMs: 1150 },
      { outil: "todowrite", entree: { todos: taches(3) }, dureeMs: 120 },
      { outil: "bash", entree: { command: "npm test -- deliverySlot", description: "npm test -- deliverySlot" }, enCours: true },
    ],
  }),
);
/*
 * Le profil de l'instance jetable : chiffrement dans un fichier (pas de
 * trousseau), exo coupé, et OpenClaw sur un port libre où rien n'écoute :
 * la passerelle ne sonde ni ne touche jamais l'OpenClaw de Helix (18800).
 */
writeFileSync(
  join(TMP, "profil.json"),
  JSON.stringify({ chiffrement: "fichier", backends: [{ id: "exo", enabled: false }], openclaw: { port: await port() } }),
);
const SORTIES = join(TMP, "sorties.log");

const processus = [];
const arreterTout = async () => {
  for (const p of processus.reverse()) {
    try {
      p.kill("SIGTERM");
    } catch {
      /* déjà parti */
    }
  }
  await attendre(1500);
  for (const p of processus) if (p.exitCode === null && p.signalCode === null) p.kill("SIGKILL");
};

/* ── Démarrage ─────────────────────────────────────────────────────────── */

const faux = await demarrerFauxModele(scene, PORT_MODELE);

let journalPasserelle = "";
const passerelle = spawn(process.execPath, ["--import", join(ICI, "prealable.mjs"), join(RACINE, "gateway", "src", "index.ts")], {
  cwd: TMP,
  env: {
    PATH: [BIN, "/usr/bin", "/bin", "/usr/sbin", "/sbin"].join(":"),
    HOME: MAISON,
    LANG: "C",
    TMPDIR: join(TMP, "tmp"),
    HELIX_CONFIG: join(TMP, "profil.json"),
    HELIX_DATA_DIR: DONNEES,
    HELIX_GATEWAY_PORT: String(PORT_PASSERELLE),
    HELIX_GATEWAY_HOST: "127.0.0.1",
    HELIX_WORKSPACE: ESPACE,
    HELIX_CODE_DIR: PROJET,
    HELIX_MOTEUR: "lmstudio",
    HELIX_LMSTUDIO_URL: `${FAUX}/v1`,
    HELIX_EXO_URL: "http://127.0.0.1:9/v1",
    HELIX_APPS_DIR: join(TMP, "Applications"),
    HELIX_OPENCODE_BIN: join(BIN, "opencode"),
    HELIX_RTK_BIN: join(BIN, "rtk"),
    HELIX_CAPTURES_FAUX: FAUX,
    HELIX_CAPTURES_SORTIES: SORTIES,
    HELIX_CAPTURES_SCENE: join(ICI, "scenes", `${LANGUE}.mjs`),
  },
  stdio: ["ignore", "pipe", "pipe"],
});
mkdirSync(join(TMP, "tmp"), { recursive: true });
processus.push(passerelle);
passerelle.stdout.on("data", (b) => (journalPasserelle += b));
passerelle.stderr.on("data", (b) => (journalPasserelle += b));

let JETON = "";
for (let i = 0; i < 200 && !JETON; i++) {
  try {
    await fetch(`${G}/health`);
    JETON = readFileSync(join(DONNEES, "instance-token"), "utf8").trim();
  } catch {
    await attendre(250);
  }
}
if (!JETON) {
  console.log(journalPasserelle.slice(-3000));
  await arreterTout();
  throw new Error("La passerelle d'essai ne répond pas.");
}
journal(`passerelle ${G}, faux modèle ${FAUX}`);

/** Appel à la passerelle, avec le jeton d'instance et, s'il y en a une, la séance. */
let SEANCE = "";
async function api(chemin, corps, methode) {
  const r = await fetch(`${G}${chemin}`, {
    method: methode ?? (corps === undefined ? "GET" : "POST"),
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${JETON}`,
      "X-Helix-Langue": LANGUE,
      ...(SEANCE ? { "X-Helix-Session": SEANCE } : {}),
    },
    ...(corps === undefined ? {} : { body: JSON.stringify(corps) }),
  });
  const json = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${methode ?? "POST"} ${chemin} → ${r.status} ${JSON.stringify(json).slice(0, 400)}`);
  return json;
}

/* ── Le serveur de l'interface ─────────────────────────────────────────── */

process.env.HELIX_GATEWAY_URL = G;
const { createServer: serveurVite } = await import("vite");
const vite = await serveurVite({
  configFile: join(RACINE, "vite.config.ts"),
  root: RACINE,
  cacheDir: join(TMP, "vite"),
  logLevel: "warn",
  server: { port: PORT_VITE, strictPort: true, host: "127.0.0.1" },
});
await vite.listen();
const V = `http://127.0.0.1:${PORT_VITE}`;
journal(`interface ${V}`);

/* ── La scène ──────────────────────────────────────────────────────────── */

/** Connexion par l'écran, comme une personne : le compte, puis son mot de passe (valeurs de la scène, factices). */
async function connecter() {
  await chrome.attendreTexte(scene.personne.email);
  await chrome.cliquer(scene.personne.email, { contient: true });
  await chrome.attendreQue(`document.querySelector('input[type=password]')`);
  await chrome.cliquerSelecteur("input[type=password]");
  await chrome.taper(scene.personne.motDePasse);
  await chrome.touche("Enter");
  await chrome.attendreQue(`!document.querySelector('input[type=password]')`, { quoi: "fin de la connexion" });
}

/** Le libellé affiché d'un texte de l'interface (la clé est la phrase française, src/lib/i18n.ts). */
// Les clés gardent les espaces insécables du français (« travailler ? ») : on les compare sans elles.
const sansInsecable = (s) => s.replace(/[  ]/g, " ");
const CATALOGUE = Object.fromEntries(
  Object.entries(LANGUE === "fr" ? {} : JSON.parse(readFileSync(join(RACINE, "src", "i18n", `${LANGUE}.json`), "utf8"))).map(([k, v]) => [sansInsecable(k), v]),
);
const T = (fr) => CATALOGUE[sansInsecable(fr)] ?? fr.replace(/ ([?!:;])/g, " $1");

/** Dépose un document dans « Fichiers », comme l'écran (src/lib/televersement.ts) : [longueur][en-tête JSON][fichier]. */
async function deposer(nom, texte) {
  const octets = Buffer.from(texte, "utf8");
  const entete = Buffer.from(JSON.stringify({ nom, taille: octets.length, texte, parentId: null, visibilite: "organisation", groupes: [] }), "utf8");
  const longueur = Buffer.alloc(4);
  longueur.writeUInt32BE(entete.length);
  const r = await fetch(`${G}/helix/bibliotheque/documents`, {
    method: "POST",
    headers: { "Content-Type": "application/x-helix-document", Authorization: `Bearer ${JETON}`, "X-Helix-Session": SEANCE, "X-Helix-Langue": LANGUE },
    body: Buffer.concat([longueur, entete, octets]),
  });
  const json = await r.json();
  if (!r.ok) throw new Error(`dépôt de ${nom} : ${JSON.stringify(json)}`);
  return json.element;
}

/** L'agent toujours actif de la démonstration, puis les autres, avec leurs identifiants. */
const agentsDeLaScene = () =>
  [{ ...scene.agents.employe, instructions: scene.agents.employe.poste, visibility: "organisation", principal: true }, ...scene.agents.autres].map((a, i) => ({
    ...a,
    id: `agent_scene_${i}`,
  }));

/** Tout ce que la passerelle peut créer elle-même, par son API, avant d'ouvrir l'écran. */
async function preparer(utilisateur) {
  const ids = {};
  // La base de connaissances et ses documents, indexés par le faux modèle d'embeddings.
  const documents = [];
  for (const d of scene.base.documents) documents.push(await deposer(d.nom, d.texte));
  const { base } = await api("/helix/connaissances", { nom: scene.base.nom, description: scene.base.description, visibilite: "organisation", groupes: [] });
  await api(`/helix/connaissances/${base.id}/documents`, { documents: documents.map((d) => d.id) });
  for (let i = 0; i < 120; i++) {
    const { bases } = await api("/helix/connaissances");
    const b = bases.find((x) => x.id === base.id);
    if (b && b.documents.length === documents.length && b.documents.every((d) => d.etat === "pret")) break;
    if (b?.documents.some((d) => d.etat === "erreur")) throw new Error(`indexation : ${JSON.stringify(b.documents)}`);
    await attendre(250);
  }
  ids.base = base.id;
  const essai = await api("/helix/connaissances/chercher", { bases: [base.id], question: scene.demo.question, nombre: 5 });
  journal("recherche de la question :", essai.passages.map((p) => `[${p.n}] ${p.document} ${p.similarite}`).join(", "));

  // Les Chats plus anciens, rangés comme l'écran les range (src/lib/store/sessions.ts).
  const maintenant = Date.now();
  const sessions = scene.chats.map((c, i) => {
    const quand = new Date(maintenant - c.ilYaHeures * 3600_000).toISOString();
    const apres = new Date(maintenant - c.ilYaHeures * 3600_000 + 9000).toISOString();
    const propre = c.question.trim().replace(/\s+/g, " ");
    return {
      id: `sess_scene_${i}`,
      title: propre.length <= 48 ? propre : `${propre.slice(0, 48).trimEnd()}...`,
      ownerId: utilisateur.id,
      visibility: "prive",
      sharedGroupIds: [],
      sharedWith: [],
      organisationId: utilisateur.organisationId,
      origin: "local",
      messages: [
        { id: `msg_scene_${i}_q`, role: "user", content: c.question, createdAt: quand },
        { id: `msg_scene_${i}_r`, role: "assistant", content: c.reponse, createdAt: apres, durees: { premierMot: 900, reponse: 4200 } },
      ],
      createdAt: quand,
      updatedAt: apres,
    };
  });
  await api("/helix/data/sessions", { value: sessions }, "PUT");

  /*
   * Les agents (collection « agents »), avec le modèle de la machine et la
   * base de connaissances. Chacun est aussi un agent toujours actif : sa
   * fiche d'OpenClaw vient de la scène (`intercepter`), sans quoi l'écran des
   * agents lancerait sa mise en service (installation d'OpenClaw). Rangés du
   * plus récent au plus ancien, comme l'écran les montre.
   */
  const { models } = await api("/helix/models");
  const qwen = models.find((m) => (m.uid ?? m.id).endsWith(scene.modeleChat));
  await api(
    "/helix/data/agents",
    {
      value: agentsDeLaScene().map((a, i) => {
        const quand = new Date(maintenant - (30 + i * 24) * 3600_000).toISOString();
        return {
          id: a.id,
          name: a.nom,
          description: a.description,
          instructions: a.instructions,
          visibility: a.visibility,
          hidePrompt: false,
          ownerId: utilisateur.id,
          organisationId: utilisateur.organisationId,
          toolsEnabled: true,
          ...(qwen ? { modelUid: qwen.uid } : {}),
          connaissances: [base.id],
          createdAt: quand,
          updatedAt: quand,
        };
      }),
    },
    "PUT",
  );

  // La clé Mistral factice : la passerelle croit parler à api.mistral.ai, le module préalable la renvoie au faux modèle.
  await api("/helix/fournisseurs", { fournisseur: "mistral", cle: "captures-cle-factice-0000", modeles: scene.modelesMistral, portee: "moi" });

  // Le jeu d'exemples de l'entraînement.
  const projet = await api("/helix/entrainement/projets", { nom: scene.entrainement.nom });
  await api("/helix/entrainement/exemples", { projet: projet.id, exemples: scene.entrainement.exemples.map(([question, reponse]) => ({ question, reponse })) });
  ids.projet = projet.id;

  // Le projet de Helix Code (quelques fichiers, jamais exécutés).
  for (const [chemin, contenu] of Object.entries(scene.code.fichiers)) {
    const f = join(PROJET, chemin);
    mkdirSync(dirname(f), { recursive: true });
    writeFileSync(f, contenu);
  }
  return ids;
}

/** Une question à Mistral (faux serveur), au nom de la personne : la ligne « distant » de « Mon usage ». */
async function questionMistral() {
  const { models } = await api("/helix/models");
  const m = models.find((x) => /mistral-medium-latest$/.test(x.uid ?? x.id));
  if (!m) throw new Error(`modèle Mistral absent : ${models.map((x) => x.uid).join(", ")}`);
  const qwen = models.find((x) => (x.uid ?? x.id).endsWith(scene.modeleChat));
  const demander = async (modele, question) => {
    const r = await fetch(`${G}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${JETON}`, "X-Helix-Session": SEANCE },
      body: JSON.stringify({ model: modele, stream: true, messages: [{ role: "user", content: question }] }),
    });
    await r.text();
  };
  await demander(m.uid, scene.questionMistral);
  // Les quatre Chats plus anciens, posés au modèle de la machine : avec la démonstration, « Mon usage » compte six requêtes, comme ailleurs.
  if (qwen) for (const c of scene.chats) await demander(qwen.uid, c.question);
}

/*
 * Ce que Chrome reçoit de la scène à la place de la réponse de la passerelle.
 *
 * Seulement l'agent toujours actif : il vit dans OpenClaw (le port 18800 de
 * Helix), qu'on ne lance pas pour une capture, et ses comptes rendus datent
 * des jours passés. La vraie réponse de la passerelle est lue d'abord (les
 * modèles, les canaux, les familles d'outils restent les siens) ; la scène y
 * ajoute l'agent, OpenClaw en service, et son activité.
 */
async function intercepter(utilisateur, ids) {
  const cree = new Date(Date.now() - 6 * 86400_000).toISOString();
  await chrome.intercepter(/\/api\/helix\/employes(\?.*)?$/, (url, reelle, methode) => {
    if (methode !== "GET" || !reelle) return undefined;
    const modele = (reelle.modeles ?? []).find((m) => m.nom === scene.modeleChat || m.uid?.endsWith(scene.modeleChat));
    return {
      ...reelle,
      moteur: { ...reelle.moteur, installe: true, version: "2026.9.4", enMarche: true, gere: true, installation: { etape: "termine", message: "" }, plateforme: "darwin" },
      employes: agentsDeLaScene().map((a) => ({
        id: `emp_${a.id}`,
        nom: a.nom,
        poste: a.poste ?? a.instructions,
        description: a.description,
        outils: a.principal ? ["courrier", "bibliotheque", "fichiers"] : ["bibliotheque"],
        missions: (a.missions ?? []).map((m, i) => ({ id: `mis_${i}`, planifiee: true, ...m })),
        enPause: false,
        autonome: Boolean(a.principal),
        liberte: "encadre",
        canaux: [],
        agentId: a.id,
        visibilite: a.visibility,
        groupes: [],
        toutesLesFamilles: true,
        connaissances: [ids.base],
        ownerId: utilisateur.id,
        createdAt: cree,
        updatedAt: cree,
        modele: modele?.uid ?? scene.modeleChat,
        modeleEtat: { nom: scene.modeleChat, disponible: true, origine: "local" },
        proprietaire: utilisateur.fullName,
        estProprietaire: true,
        jetons30Jours: 0,
      })),
    };
  });
  // Ce qui touche à l'agent lui-même ne part jamais vers la passerelle : elle irait le chercher chez OpenClaw.
  await chrome.intercepter(
    /\/api\/helix\/employes\/[^?]+/,
    (url) => {
      const chemin = new URL(url).pathname.replace(/^\/api\/helix\/employes\/[^/]+/, "");
      if (chemin === "/activite") {
        const principal = /\/employes\/emp_agent_scene_0\//.test(url);
        return { executions: principal ? scene.agents.activite.map((x) => ({ statut: "ok", ...x })) : [] };
      }
      if (chemin === "/echanges") return { echanges: [], enCours: null };
      if (chemin.startsWith("/canaux")) return { canaux: [] };
      if (chemin.startsWith("/memoire")) return { copies: [] };
      if (chemin.startsWith("/documents")) return { documents: [] };
      if (chemin.startsWith("/demandes")) return { demandes: [] };
      journal("agent : demande non prévue par la scène", chemin);
      return {};
    },
    { sansPasserelle: true },
  );
  await chrome.activerInterceptions([
    { urlPattern: "*/api/helix/employes", requestStage: "Response" },
    { urlPattern: "*/api/helix/employes?*", requestStage: "Response" },
    { urlPattern: "*/api/helix/employes/*", requestStage: "Request" },
  ]);
}

const pause = (ms) => attendre(ms);

/** Capture PNG de la fenêtre (2560 × 1600), rangée sous son nom. */
const produites = [];
async function prendre(nom) {
  const f = join(SORTIE, `${nom}.png`);
  // La souris hors de tout bouton : sans quoi le dernier élément cliqué garde son survol sur l'image.
  await chrome.envoyer("Input.dispatchMouseEvent", { type: "mouseMoved", x: 1279, y: 799 });
  await pause(250);
  const brute = join(TMP, `${nom}-brute.png`);
  const image = await chrome.capture();
  /*
   * Une page encore blanche donne un PNG de quelques Ko : c'est ce qui a été
   * publié pour « Entraîner un modèle » en français le 29/09/2026 (8 Ko, au
   * lieu de 160). En dessous de 40 Ko, la capture est refusée plutôt que
   * posée dans le README.
   */
  if (image.length < 40_000) throw new Error(`capture ${nom} : page vide ou pas encore affichée (${Math.round(image.length / 1024)} Ko)`);
  writeFileSync(brute, image);
  // En 256 couleurs, comme les images des autres langues (deux fois plus légères, rien de visible perdu sur une interface).
  const palette = await new Promise((ok) => {
    const p = spawn("ffmpeg", ["-v", "error", "-y", "-i", brute, "-vf", "split[a][b];[a]palettegen=max_colors=256:reserve_transparent=0[p];[b][p]paletteuse=dither=none", "-pix_fmt", "pal8", f], { stdio: ["ignore", "ignore", "inherit"] });
    p.on("exit", (code) => ok(code === 0));
    p.on("error", () => ok(false));
  });
  if (!palette) copyFileSync(brute, f);
  produites.push(f);
  journal(`→ ${f} (${Math.round(statSync(f).size / 1024)} Ko)`);
}

/**
 * Une étape de la scène. Un échec : l'étape est rejouée une fois, dans un
 * Chrome relancé. Au second échec, une capture de l'écran, son texte et les
 * requêtes de la page restées sans réponse, pour comprendre.
 */
async function etape(nom, travail) {
  if (!SEULEMENT.includes(nom)) return;
  journal(`étape ${nom}`);
  try {
    await travail();
    return;
  } catch (err) {
    journal(`étape ${nom} : ${err instanceof Error ? err.message : err} ; nouvel essai`);
    await nouveauChrome();
  }
  try {
    await travail();
  } catch (err) {
    const f = join(TMP, `echec-${nom}.png`);
    writeFileSync(f, await chrome.capture().catch(() => Buffer.alloc(0)));
    journal(`échec de l'étape ${nom} (écran : ${f}) :`, (await chrome.eval("document.body.innerText").catch(() => "")).slice(0, 1200));
    // La passerelle, d'ici puis depuis la page : si seule la page reste sans réponse, c'est Chrome qui retient ses requêtes.
    const sante = await fetch(`${G}/health`, { signal: AbortSignal.timeout(5000) }).then((r) => r.status, (e) => String(e));
    const depuisLaPage = await chrome
      .eval(`fetch("/api/health", { signal: AbortSignal.timeout(5000) }).then((r) => r.status, (e) => String(e))`)
      .catch((e) => String(e));
    journal(`la passerelle répond-elle ? d'ici : ${sante} ; depuis la page : ${depuisLaPage}`);
    const requetes = chrome.requetes ?? [];
    const depuis = requetes.findLastIndex((r) => r.navigation);
    journal(
      "requêtes de cette page sans réponse, ou en flux :\n" +
        requetes
          .slice(depuis + 1)
          .filter((r) => !r.statut || /evenements|events|stream|flux=/.test(r.quoi))
          .map((r) => `  ${r.statut || "…"} ${r.quoi}`)
          .join("\n"),
    );
    throw err;
  }
}

/*
 * Filme l'écran pendant `action` : des captures en densité 1 (1280 × 800),
 * aussi vite que Chrome les rend, chacune datée. `marque(nom)` note un
 * instant (l'envoi) pour caler le minutage de l'animation.
 */
async function enregistrer(action, dureeMs) {
  const dossier = join(TMP, "film");
  mkdirSync(dossier, { recursive: true });
  const images = [];
  const marques = {};
  const debut = Date.now();
  let fini = false;
  const film = (async () => {
    while (!fini) {
      const t = Date.now() - debut;
      const f = join(dossier, `${String(images.length).padStart(5, "0")}.png`);
      writeFileSync(f, await chrome.capture({ densite: 1 }));
      images.push({ t, f });
    }
  })();
  try {
    await action((nom) => (marques[nom] = Date.now() - debut));
  } finally {
    fini = true;
    await film;
  }
  journal(`film : ${images.length} images en ${((Date.now() - debut) / 1000).toFixed(1)} s, envoi à ${((marques.envoi ?? 0) / 1000).toFixed(1)} s`);
  return { images, marques, dureeMs };
}

/*
 * L'animation, à cadence fixe (95/12 images par seconde, celle des autres
 * langues) : chaque image montre la dernière capture prise à cet instant, la
 * dernière est tenue jusqu'à la fin. Palette de 256 couleurs, puis moins
 * jusqu'à passer sous 500 Ko.
 */
async function fabriquerGif({ images, dureeMs }, sortie) {
  const cadence = 95 / 12;
  const n = Math.round((dureeMs / 1000) * cadence);
  const seq = join(TMP, "sequence");
  mkdirSync(seq, { recursive: true });
  let j = 0;
  for (let k = 0; k < n; k++) {
    const t = (k / cadence) * 1000;
    while (j + 1 < images.length && images[j + 1].t <= t) j++;
    copyFileSync(images[j].f, join(seq, `${String(k).padStart(5, "0")}.png`));
  }
  for (const couleurs of [256, 192, 128, 96, 64]) {
    await new Promise((ok, ko) => {
      const p = spawn("ffmpeg", [
        "-v", "error", "-y", "-framerate", "95/12", "-i", join(seq, "%05d.png"),
        "-vf", `split[a][b];[a]palettegen=max_colors=${couleurs}:stats_mode=diff[p];[b][p]paletteuse=dither=none:diff_mode=rectangle`,
        "-loop", "0", sortie,
      ], { stdio: ["ignore", "ignore", "inherit"] });
      p.on("exit", (code) => (code === 0 ? ok() : ko(new Error(`ffmpeg : ${code}`))));
      p.on("error", ko);
    });
    const poids = statSync(sortie).size;
    journal(`→ ${sortie} (${n} images, ${couleurs} couleurs, ${Math.round(poids / 1024)} Ko)`);
    if (poids < 500 * 1024) break;
  }
  produites.push(sortie);
}

/*
 * Un Chrome neuf (profil jetable), connecté au compte de la scène. Au
 * départ, et pour rejouer une étape qui a échoué.
 *
 * Vu le 28/09/2026 : au fil des écrans, les requêtes de la page vers
 * l'interface ne partaient plus (« Entraîner un modèle » et Code restés à
 * « Chargement », la passerelle répondant tout de suite aux mêmes requêtes
 * envoyées d'ici, un autre Chrome aussi). Chrome gardait les pages quittées
 * dans son cache de navigation, avec leurs flux (EventSource) ouverts, et
 * les six connexions qu'il ouvre au plus vers une même adresse finissaient
 * prises. Ce cache est coupé au lancement (cdp.mjs) : deux passages complets
 * sans échec ensuite, là où « Entraîner un modèle » échouait presque à coup sûr.
 */
let chrome = null;
async function nouveauChrome() {
  if (chrome) await chrome.fermerTout();
  chrome = await lancerChrome({ langue: scene.localeNavigateur });
  await chrome.noterRequetes();
  await chrome.avantChaquePage(`try {
    localStorage.setItem("helix:langue", ${JSON.stringify(LANGUE)});
    localStorage.setItem("helix:apparence", "clair");
    if (!localStorage.getItem("helix:instance")) localStorage.setItem("helix:instance", ${JSON.stringify(JSON.stringify({ url: G, remote: false, token: JETON }))});
  } catch {}`);
  await chrome.aller(`${V}/?token=${JETON}`);
  await connecter();
  await chrome.attendreTexte(scene.chats[0].question.slice(0, 6));
  // Rouvert une fois les données relues : les suggestions de l'accueil tiennent alors compte des agents.
  await pause(1500);
  await chrome.aller(`${V}/`);
  await chrome.attendreTexte(scene.chats[0].question.slice(0, 6));
  await pause(1500);
}

try {
  mkdirSync(SORTIE, { recursive: true });
  const compte = await api("/helix/auth/create", { fullName: scene.personne.nom, email: scene.personne.email, password: scene.personne.motDePasse });
  SEANCE = compte.session?.token ?? "";
  const ids = await preparer(compte.account);
  await questionMistral();
  journal("données de la scène prêtes");
  await nouveauChrome();

  // Le modèle de la machine plutôt que « Auto », comme sur les captures d'origine.
  await chrome.cliquer(T("Auto"), { selecteur: "button" });
  await pause(600);
  await chrome.cliquer(scene.modeleChat, { selecteur: "button, [role=option], li", contient: true });
  await pause(600);

  /*
   * L'animation : la base choisie et le devis joint, la question tapée, la
   * réponse qui arrive avec ses sources. Même minutage que les autres
   * langues (18,6 s, 7,9 images par seconde).
   */
  /** La base choisie dans la zone de saisie et le devis joint, prêts à envoyer. */
  const preparerQuestion = async () => {
    await chrome.cliquer(T("Connaissances"), { selecteur: "button" });
    await pause(600);
    await chrome.cliquer(scene.base.nom, { selecteur: "button, label, li, [role=menuitemcheckbox], [role=option]", contient: true });
    await pause(400);
    await chrome.touche("Escape");
    const pj = join(TMP, scene.demo.pieceJointe.nom);
    writeFileSync(pj, scene.demo.pieceJointe.texte);
    await chrome.fichiers("input[type=file]", [pj]);
    await pause(1200);
    await chrome.cliquerSelecteur("textarea");
  };
  const attendreReponse = async () => {
    await chrome.attendreTexte(T("Sources"), 30_000);
    // La fin de la réponse : le bouton d'arrêt redevient « Envoyer ».
    await chrome.attendreQue(`!document.querySelector('[aria-label=${JSON.stringify(T("Arrêter la génération"))}]')`, { delai: 30_000, quoi: "fin de la réponse" });
  };
  const poserQuestion = async () => {
    await preparerQuestion();
    await chrome.taper(scene.demo.question);
    await chrome.touche("Enter");
    await attendreReponse();
    await pause(800);
  };
  /** Le Chat de la démonstration à l'écran : déjà ouvert, rouvert depuis la barre latérale, ou posé (sans l'animation). */
  const ouvrirChatDemo = async () => {
    const sources = `document.body.innerText.includes(${JSON.stringify(T("Sources"))})`;
    if (await chrome.eval(sources).catch(() => false)) return;
    await chrome.aller(`${V}/`);
    await chrome.attendreTexte(T("Sur quoi voulez-vous travailler ?"));
    await pause(1000);
    const debut = scene.demo.question.slice(0, 8);
    if (await chrome.eval(`[...document.querySelectorAll("aside li button, nav li button, li button")].some((b) => (b.getAttribute("title") ?? "").startsWith(${enJs(debut)}))`)) {
      await chrome.cliquerSelecteur(`li button[title^=${JSON.stringify(debut)}]`);
      await chrome.attendreQue(sources, { quoi: "le Chat de la démonstration" });
      await pause(800);
    } else {
      await poserQuestion();
    }
  };

  await etape("demo", async () => {
    if (!(await chrome.eval(`document.body.innerText.includes(${JSON.stringify(T("Sur quoi voulez-vous travailler ?"))})`).catch(() => false))) await chrome.aller(`${V}/`);
    await chrome.attendreTexte(T("Sur quoi voulez-vous travailler ?"));
    await preparerQuestion();
    const images = await enregistrer(async (marque) => {
      await pause(700);
      await chrome.taper(scene.demo.question, Math.round(4300 / [...scene.demo.question].length));
      await pause(450);
      await chrome.touche("Enter");
      marque("envoi");
      await attendreReponse();
      await pause(1200);
    }, 18_610);
    await fabriquerGif(images, join(SORTIE, "demo.gif"));
  });

  // Le Chat de la démonstration, fini (sans l'animation, il est posé de la même façon, sans filmer).
  await etape("chat", async () => {
    await ouvrirChatDemo();
    await chrome.eval(`document.querySelectorAll(".overflow-y-auto").forEach((e) => (e.scrollTop = 0))`);
    await pause(800);
    await prendre("chat");
  });

  // « Comparer intelligence et prix », ouvert depuis le choix du modèle, par-dessus le Chat.
  await etape("compare", async () => {
    await ouvrirChatDemo();
    await chrome.cliquer(scene.modeleChat, { selecteur: "button", contient: true });
    await pause(700);
    await chrome.cliquer(T("Comparer intelligence et prix"), { selecteur: "button" });
    await chrome.attendreTexte(T("Comparer les modèles"));
    await pause(2500);
    await prendre("compare");
    await chrome.touche("Escape");
    await pause(500);
  });

  // L'accueil, après un « Nouveau Chat ».
  await etape("home", async () => {
    // Depuis l'application, comme une personne ; après un nouvel essai (page vide), en rouvrant l'accueil.
    if (await chrome.eval(`location.protocol.startsWith("http")`)) await chrome.cliquer(T("Nouveau Chat"), { selecteur: "button, a" });
    else await chrome.aller(`${V}/`);
    await chrome.attendreTexte(T("Sur quoi voulez-vous travailler ?"));
    await pause(1500);
    await prendre("home");
  });

  // « Fichiers », vue des bases de connaissances, la base ouverte.
  await etape("knowledge", async () => {
    await chrome.aller(`${V}/bibliotheque?vue=connaissances`);
    await chrome.attendreTexte(scene.base.nom);
    await pause(800);
    await chrome.cliquer(scene.base.nom, { selecteur: "li button", contient: true });
    await chrome.attendreTexte(scene.base.documents.at(-1).nom);
    await pause(1200);
    await prendre("knowledge");
  });

  // « Entraîner un modèle » : le jeu d'exemples de la scène.
  await etape("training", async () => {
    await chrome.aller(`${V}/parametres/entrainement`);
    await chrome.attendreTexte(scene.entrainement.nom);
    await pause(600);
    await chrome.cliquer(scene.entrainement.nom, { selecteur: "button, a, p, span, div", contient: true });
    await chrome.attendreQue(`[...document.querySelectorAll("textarea, input")].some((e) => e.value === ${enJs(scene.entrainement.exemples[0][0])})`, { quoi: "les exemples" });
    await pause(1000);
    // Même cadrage que les autres langues : « Tous les modèles » en haut, le titre de la page au-dessus, hors champ.
    await chrome.eval(`(() => {
      const retour = [...document.querySelectorAll("button, a")].find((e) => e.textContent.trim() === ${JSON.stringify(T("Tous les modèles"))});
      const boite = retour?.closest(".overflow-y-auto");
      if (retour && boite) boite.scrollTop += retour.getBoundingClientRect().top - 62;
    })()`);
    await pause(600);
    await prendre("training");
  });

  // « Mon usage » : les compteurs en haut de l'écran, comme sur les autres langues.
  await etape("usage", async () => {
    await chrome.aller(`${V}/parametres/usage`);
    await chrome.attendreTexte(T("Par modèle"));
    await pause(1500);
    await chrome.eval(`(() => {
      const titre = [...document.querySelectorAll("p, span, div")].find((e) => e.childElementCount === 0 && e.textContent.trim() === ${JSON.stringify(T("Requêtes"))});
      const boite = titre?.closest(".overflow-y-auto");
      if (titre && boite) boite.scrollTop += titre.getBoundingClientRect().top - 114;
    })()`);
    await pause(800);
    await prendre("usage");
  });

  /*
   * Les agents : l'agent toujours actif (reçu de la scène, voir `intercepter`),
   * son activité. Le seul écran intercepté.
   */
  await etape("agents", async () => {
    await intercepter(compte.account, ids);
    await chrome.aller(`${V}/agents`);
    await chrome.attendreTexte(scene.agents.employe.nom);
    if (EXPLORER) writeFileSync(join(TMP, "agents-liste.png"), await chrome.capture());
    // La carte ne s'ouvre qu'une fois la fiche d'OpenClaw arrivée (bouton actif, « Ouvrir … »).
    const carte = `button[aria-label=${JSON.stringify(T("Ouvrir {0}").replace("{0}", scene.agents.employe.nom))}]:not([disabled])`;
    await chrome.attendreQue(`document.querySelector(${JSON.stringify(carte)})`, { quoi: "la carte de l'agent" });
    await pause(800);
    await chrome.cliquerSelecteur(carte);
    await chrome.attendreTexte(T("Activité"));
    await chrome.cliquer(T("Activité"), { selecteur: "button, [role=tab]" });
    await chrome.attendreTexte(scene.agents.activite[0].mission);
    await pause(1200);
    await prendre("agents");
  });
  // Helix Code, pendant que la commande de tests tourne (faux OpenCode).
  await etape("code", async () => {
    await chrome.aller(`${V}/code`);
    await chrome.attendreQue("document.querySelector('textarea')", { quoi: "zone de saisie de Code" });
    await pause(1500);
    await chrome.cliquerSelecteur("textarea");
    await chrome.taper(scene.code.demande);
    await pause(300);
    await chrome.touche("Enter");
    await chrome.attendreTexte("npm test -- deliverySlot", 40_000);
    // La commande tourne depuis 6 à 7 secondes, comme sur les captures des autres langues.
    await chrome.attendreQue(`Number((/deliverySlot\\s*(\\d+)/.exec(document.body.innerText) ?? [])[1] ?? 0) >= 6`, { quoi: "six secondes de commande" });
    await pause(400);
    await prendre("code");
  });

  journal(`${produites.length} fichier(s) :\n${produites.map((f) => `  ${f}  ${Math.round(statSync(f).size / 1024)} Ko`).join("\n")}`);

} catch (err) {
  console.log(err instanceof Error ? err.stack : err);
  console.log(journalPasserelle.slice(-3000));
  process.exitCode = 1;
} finally {
  if (chrome) await chrome.fermerTout();
  await vite.close();
  faux.serveur.close();
  await arreterTout();
  if (existsSync(SORTIES)) journal("adresses refusées à la passerelle :\n" + readFileSync(SORTIES, "utf8"));
  if (!EXPLORER && !process.exitCode) rmSync(TMP, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 });
}
