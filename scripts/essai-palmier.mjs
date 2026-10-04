/*
 * Palmier Pro, connecteur local, essayé de bout en bout (29/09/2026).
 *
 *   npm run essai:palmier        (lancé aussi par npm run securite, section 38)
 *
 * Palmier Pro (monteur vidéo pour Mac) sert un serveur MCP en HTTP sur
 * 127.0.0.1:19789 quand il est ouvert, sans authentification. Helix ne lui
 * parle qu'après avoir reconnu le programme qui écoute (gateway/src/palmier.ts)
 * et fait passer par la carte d'accord tout ce qui n'est pas une lecture pure
 * (gateway/src/palmierRegles.ts). Cet essai ne touche jamais au vrai port de
 * Palmier Pro, ni à une vraie application : un faux serveur MCP, dans ce
 * processus, écoute sur un port libre.
 *
 * Deux variables d'environnement, réservées aux essais (palmier.ts), sont
 * posées pour la passerelle d'essai :
 *  - HELIX_ESSAI_PALMIER_PORT : le port libre du faux serveur ;
 *  - HELIX_ESSAI_PALMIER_EXECUTABLE : l'exécutable qui doit écouter, lu par
 *    `lsof`, à la place de la signature de Palmier, Inc. (le faux serveur est
 *    ce processus-ci, donc Node). « Un autre programme » est `nc`, qui écoute
 *    sur le même port et note tout ce qu'il reçoit.
 *
 *  A. Règles, dans ce processus : machine, adresses permises, lecture ou
 *     écriture, catalogue, enregistrement relu.
 *  B. La passerelle, comme l'écran s'en sert : application fermée, un autre
 *     programme sur le port, le vrai (faux) Palmier Pro reconnu, lecture sans
 *     carte, génération derrière la carte (même au niveau « Tout approuver »),
 *     refus, collègue non administrateur, adresse glissée dans la requête,
 *     programme remplacé en cours de route, application fermée puis rouverte,
 *     retrait.
 */
import { execFileSync, spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { createServer as serveurHttp } from "node:http";
import { createServer as serveurTcp } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const RACINE = join(dirname(fileURLToPath(import.meta.url)), "..");

let reussis = 0;
const echecs = [];
function verifier(nom, condition, obtenu) {
  if (condition) {
    reussis++;
    console.log(`  ✓ ${nom}`);
  } else {
    echecs.push(nom);
    console.log(`  ✗ ${nom}  —  obtenu : ${String(typeof obtenu === "string" ? obtenu : JSON.stringify(obtenu)).slice(0, 500)}`);
  }
}
const portLibre = () =>
  new Promise((ok) => {
    const s = serveurTcp();
    s.listen(0, "127.0.0.1", () => {
      const { port } = s.address();
      s.close(() => ok(port));
    });
  });
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
const importer = (...p) => import(pathToFileURL(join(RACINE, ...p)).href);
const AUX = mkdtempSync(join(tmpdir(), "helix-essai-palmier-"));
// Les modules importés dans ce processus (partie A) : des dossiers jetables, jamais ~/.helix ni ~/Helix.
mkdirSync(join(AUX, "espace-a"), { recursive: true });
writeFileSync(join(AUX, "profil-a.json"), JSON.stringify({ chiffrement: "fichier" }));
Object.assign(process.env, { HELIX_DATA_DIR: join(AUX, "donnees-a"), HELIX_WORKSPACE: join(AUX, "espace-a"), HELIX_CONFIG: join(AUX, "profil-a.json") });

/*
 * Les outils de Palmier Pro 0.7.6, tels que son serveur MCP les liste
 * (ToolDefinitions.swift, branche last-gpl-source, lue le 29/09/2026), plus un
 * outil qu'une version propriétaire aurait ajouté.
 */
const OUTILS_PALMIER = [
  "manage_project", "get_timeline", "inspect_timeline", "create_timeline", "set_active_timeline", "manage_markers",
  "set_project_settings", "export_project", "manage_exports", "get_media", "inspect_media", "search_media",
  "import_media", "capture_frame", "organize_media", "manage_tracks", "manage_clip_links", "add_clips", "insert_clips",
  "move_clips", "remove_clips", "split_clips", "ripple_delete_ranges", "swap_clip_media", "set_clip_properties",
  "copy_clip_settings", "set_keyframes", "apply_layout", "sync_clips", "undo", "manage_multicam", "change_cam",
  "get_multicam", "get_transcript", "remove_words", "remove_silence", "detect_beats", "add_texts", "update_text",
  "add_captions", "apply_color", "apply_effect", "inspect_color", "denoise_audio", "list_models", "generate_video",
  "generate_image", "generate_audio", "upscale_media", "send_feedback", "read_skill", "manage_skills",
  "nouvel_outil_inconnu",
];
const LECTURES = ["get_timeline", "inspect_timeline", "get_media", "inspect_media", "get_multicam", "detect_beats", "inspect_color", "list_models", "read_skill"];

if (process.platform !== "darwin") {
  // Palmier Pro n'existe que sur Mac : ailleurs, on vérifie seulement que la fiche n'est pas proposée.
  const { plateformePalmier } = await importer("gateway", "src", "palmier.ts");
  verifier("hors macOS : Palmier Pro n'est pas proposé sur cette machine", plateformePalmier() === "autre-systeme", plateformePalmier());
  console.log(`\n${reussis} vérification(s) réussie(s), ${echecs.length} échec(s).`);
  process.exit(echecs.length ? 1 : 0);
}

/* ------------------------------------------------------------------------- */
/* A. Les règles, dans ce processus                                           */
/* ------------------------------------------------------------------------- */

console.log("\nA. Règles : machine, adresses permises, lecture ou écriture, catalogue");
try {
  const { plateformePalmier, EXIGENCE_PALMIER, TELECHARGEMENT_PALMIER } = await importer("gateway", "src", "palmier.ts");
  verifier(
    "machine : Mac à puce Apple et macOS 26 (Darwin 25) ou plus, sinon « macOS trop ancien » ; ni Linux, ni Windows, ni Mac Intel",
    plateformePalmier({ systeme: "darwin", appleSilicon: true, noyau: "25.0.0" }) === "ok" &&
      plateformePalmier({ systeme: "darwin", appleSilicon: true, noyau: "27.1.0" }) === "ok" &&
      plateformePalmier({ systeme: "darwin", appleSilicon: true, noyau: "24.6.0" }) === "macos-ancien" &&
      plateformePalmier({ systeme: "darwin", appleSilicon: false, noyau: "25.0.0" }) === "autre-systeme" &&
      plateformePalmier({ systeme: "linux", appleSilicon: false, noyau: "6.8.0" }) === "autre-systeme" &&
      plateformePalmier({ systeme: "win32", appleSilicon: false, noyau: "10.0.26100" }) === "autre-systeme",
    "plateformePalmier",
  );
  verifier(
    "signature exigée : Developer ID d'Apple, identifiant io.palmier.pro, équipe MMFLRC7562 ; téléchargement vers la page officielle",
    /anchor apple generic/.test(EXIGENCE_PALMIER) && /identifier "io\.palmier\.pro"/.test(EXIGENCE_PALMIER) && /leaf\[subject\.OU\] = "MMFLRC7562"/.test(EXIGENCE_PALMIER) && TELECHARGEMENT_PALMIER === "https://github.com/palmier-io/palmier-pro/releases/latest",
    EXIGENCE_PALMIER,
  );

  /*
   * La vraie reconnaissance, sans variable d'essai : ce processus (Node, signé
   * par un autre que Palmier, Inc.) écoute sur un port libre. `codesign` doit le
   * refuser ; personne à l'écoute, l'application est dite fermée.
   */
  const { ecouteurPalmier } = await importer("gateway", "src", "palmier.ts");
  delete process.env.HELIX_ESSAI_PALMIER_EXECUTABLE;
  const portSigne = await portLibre();
  const absent = await ecouteurPalmier(portSigne);
  const ecouteur = serveurTcp().listen(portSigne, "127.0.0.1");
  await attendre(200);
  const nonSigne = await ecouteurPalmier(portSigne);
  ecouteur.close();
  verifier(
    "reconnaissance réelle (signature) : personne à l'écoute, « fermé » ; un programme qui n'a pas la signature de Palmier, Inc. (Node), « un autre programme »",
    absent.ok === false && absent.raison === "absent" && nonSigne.ok === false && nonSigne.raison === "autre",
    `${JSON.stringify(absent)} ${JSON.stringify(nonSigne)}`,
  );

  const { adresseServeurPermise } = await importer("gateway", "src", "mcp.ts");
  const local = { port: 45678, reconnaitre: async () => null };
  const permis = (url, loc) => adresseServeurPermise({ url, local: loc }) === null;
  verifier("adresse locale permise : http://127.0.0.1 et le port déclaré, et seulement pour un serveur déclaré « local »", permis("http://127.0.0.1:45678/mcp", local), adresseServeurPermise({ url: "http://127.0.0.1:45678/mcp", local }));
  const refusees = [
    ["http://127.0.0.1:8787/mcp", local],
    ["http://127.0.0.1:19789/mcp", local],
    ["http://localhost:45678/mcp", local],
    ["http://[::1]:45678/mcp", local],
    ["http://0.0.0.0:45678/mcp", local],
    ["http://127.0.0.2:45678/mcp", local],
    ["http://utilisateur:motdepasse@127.0.0.1:45678/mcp", local],
    ["http://127.0.0.1:45678/mcp", undefined],
    ["http://192.168.1.10:45678/mcp", local],
    ["https://127.0.0.1/mcp", undefined],
    ["https://localhost/mcp", undefined],
    ["https://[::1]/mcp", undefined],
    ["https://10.0.0.1/mcp", undefined],
    ["https://169.254.169.254/latest/meta-data", undefined],
    ["https://[::ffff:7f00:1]/mcp", undefined],
    ["file:///etc/passwd", local],
  ];
  const passees = refusees.filter(([u, l]) => permis(u, l)).map(([u]) => u);
  verifier("toute autre adresse locale ou interne est refusée (autre port, localhost, ::1, 0.0.0.0, réseau interne, métadonnées, https sur la boucle, sans « local »)", passees.length === 0, passees);
  verifier("un service public en https reste permis", permis("https://mcp.notion.com/mcp", undefined), adresseServeurPermise({ url: "https://mcp.notion.com/mcp" }));

  const regles = await importer("gateway", "src", "palmierRegles.ts");
  const { modifie, demandeToujours, resumerOutil } = await importer("gateway", "src", "approbation.ts");
  const q = (n) => `palmier__${n}`;
  const lecturesMal = LECTURES.filter((n) => modifie(q(n)) || demandeToujours(q(n)));
  verifier("lectures pures (état du projet, rendu, mesures, catalogue des modèles) : sans carte, sauf au niveau « Demander pour tout »", lecturesMal.length === 0 && LECTURES.every((n) => regles.estLecturePalmier(q(n))), lecturesMal);
  const ecritures = OUTILS_PALMIER.filter((n) => !LECTURES.includes(n));
  const ecrituresMal = ecritures.filter((n) => !modifie(q(n)) || !demandeToujours(q(n)));
  verifier(`toutes les autres (${ecritures.length}, dont l'outil inconnu, search_media, get_transcript, manage_project, manage_exports) : carte à chaque appel, à tout niveau`, ecrituresMal.length === 0 && ecritures.includes("nouvel_outil_inconnu"), ecrituresMal);
  verifier(
    "génération : la carte dit qu'elle part vers les services de Palmier, hors de la machine, sur les crédits du compte",
    ["generate_video", "generate_image", "generate_audio", "upscale_media"].every((n) => regles.horsMachinePalmier(q(n)) === "generation" && /services de Palmier, hors de cette machine/.test(resumerOutil(q(n), { prompt: "un coucher de soleil" })) && /crédits/.test(resumerOutil(q(n), {}))) &&
      regles.horsMachinePalmier(q("get_transcript")) === "transcription" && regles.horsMachinePalmier(q("send_feedback")) === "retour" && regles.horsMachinePalmier(q("add_clips")) === null,
    resumerOutil(q("generate_video"), { prompt: "un coucher de soleil" }),
  );
  verifier("un outil d'un autre serveur n'est pas pris pour un outil de Palmier (préfixe exact)", !regles.estEcriturePalmier("palmierx__generate_video") && !regles.estLecturePalmier("autre__get_timeline") && !regles.estEcriturePalmier("generate_video"), "palmierRegles");

  const { CATALOGUE, aligner } = await importer("gateway", "src", "connecteurs.ts");
  const fiche = CATALOGUE.find((e) => e.id === "palmier");
  verifier(
    "catalogue : une fiche « Palmier Pro », locale sur le port 19789 et le chemin /mcp, sans adresse, sans commande, sans OAuth ni secret",
    fiche && fiche.local?.port === 19789 && fiche.local?.chemin === "/mcp" && !fiche.url && !fiche.command && !fiche.oauth && fiche.secrets.length === 0 && fiche.telechargement === "https://github.com/palmier-io/palmier-pro/releases/latest" && fiche.categorie === "Documents et données",
    fiche,
  );
  let garde;
  try {
    garde = aligner({ id: "palmier", label: "x", description: "x", local: true, url: "http://127.0.0.1:8787/", command: "/bin/sh", args: ["-c", "id"], secrets: { A: "b" }, depuis: "2026-09-29" });
  } catch (e) {
    garde = { erreur: e.message };
  }
  verifier("enregistrement relu : une adresse, une commande ou des secrets glissés dans le magasin sont oubliés ; seule l'entrée du catalogue compte", garde?.local === true && !garde.url && !garde.command && !garde.args && Object.keys(garde.secrets).length === 0 && garde.label === "Palmier Pro", garde);
  let refusAdresse = "";
  try {
    aligner({ id: "palmier", label: "x", description: "x", url: "http://127.0.0.1:8787/mcp", secrets: {}, depuis: "" });
  } catch (e) {
    refusAdresse = e.message;
  }
  // Hors de toute requête, le message est dans la langue par défaut de la passerelle : on vérifie le refus, pas sa langue.
  verifier("une adresse enregistrée sous l'identifiant « palmier », sans « local » : refusée, pas déclarée", /hors catalogue|not in the catalogue/.test(refusAdresse), refusAdresse);
} catch (err) {
  verifier("partie A sans exception", false, err?.stack ?? String(err));
}

/* ------------------------------------------------------------------------- */
/* Les faux : Palmier Pro, un modèle, un autre programme                      */
/* ------------------------------------------------------------------------- */

const json = (res, statut, corps, entetes = {}) => {
  res.writeHead(statut, { "Content-Type": "application/json", ...entetes });
  res.end(JSON.stringify(corps));
};
const texteDe = (m) => (typeof m?.content === "string" ? m.content : Array.isArray(m?.content) ? m.content.map((p) => p.text ?? "").join(" ") : "");

/** Ce que le faux Palmier Pro a reçu : méthode, chemin, en-têtes, message JSON-RPC. */
const recuPalmier = [];
const appelsPalmier = () => recuPalmier.filter((r) => r.message?.method === "tools/call").map((r) => r.message.params?.name);

/** Le faux Palmier Pro : JSON-RPC en réponse JSON, comme un serveur « streamable » sans flux. */
function fauxPalmier(port) {
  const s = serveurHttp(async (req, res) => {
    const morceaux = [];
    for await (const m of req) morceaux.push(m);
    const corps = Buffer.concat(morceaux).toString("utf8");
    let message = null;
    try {
      message = JSON.parse(corps || "null");
    } catch {
      message = null;
    }
    recuPalmier.push({ methode: req.method, chemin: req.url, entetes: req.headers, message, port });
    if (new URL(req.url ?? "/", "http://x").pathname !== "/mcp") return json(res, 404, {});
    if (req.method !== "POST") return json(res, 405, { error: "method_not_allowed" });
    if (!message || message.id === undefined) {
      res.writeHead(202);
      return res.end();
    }
    const repondre = (result) => json(res, 200, { jsonrpc: "2.0", id: message.id, result });
    if (message.method === "initialize") return repondre({ protocolVersion: message.params?.protocolVersion ?? "2025-06-18", capabilities: { tools: { listChanged: true } }, serverInfo: { name: "palmier-pro", version: "1.0.0" } });
    if (message.method === "tools/list") {
      return repondre({ tools: OUTILS_PALMIER.map((name) => ({ name, description: `Outil ${name} de Palmier Pro (faux).`, inputSchema: { type: "object", properties: { prompt: { type: "string" } } } })) });
    }
    if (message.method === "tools/call") {
      return repondre({ content: [{ type: "text", text: `REPERE-PALMIER ${message.params?.name} ${JSON.stringify(message.params?.arguments ?? {})}` }] });
    }
    return repondre({});
  });
  return new Promise((ok) => s.listen(port, "127.0.0.1", () => ok(s)));
}
const fermerServeur = (s) => new Promise((ok) => (s.closeAllConnections?.(), s.close(() => ok())));

/** « Un autre programme » sur le port : `nc`, qui note tout ce qu'il reçoit. */
async function autreProgramme(port) {
  const p = spawn("/usr/bin/nc", ["-l", "127.0.0.1", String(port)], { stdio: ["ignore", "pipe", "ignore"] });
  const etat = { processus: p, recu: "" };
  p.stdout.on("data", (b) => (etat.recu += b));
  for (let i = 0; i < 40; i++) {
    try {
      if (execFileSync("/usr/sbin/lsof", ["-nP", "-a", `-iTCP:${port}`, "-sTCP:LISTEN", "-t"], { encoding: "utf8" }).trim()) break;
    } catch {
      /* pas encore à l'écoute */
    }
    await attendre(100);
  }
  return etat;
}
const arreterAutre = async (a) => {
  a.processus.kill("SIGKILL");
  await attendre(300);
};

/** Le faux modèle : la question porte son plan, `PLAN:[["outil",{…}],…]`, appelé dans l'ordre. */
const auModele = [];
function decision(demande) {
  const messages = Array.isArray(demande.messages) ? demande.messages : [];
  const question = texteDe([...messages].reverse().find((m) => m.role === "user"));
  const resultats = messages.filter((m) => m.role === "tool").map(texteDe);
  const noms = (demande.tools ?? []).map((o) => o.function?.name);
  const plan = /PLAN:(\[.*\])/s.exec(question);
  if (!plan) return { content: "Réponse sans outil." };
  const appels = JSON.parse(plan[1]);
  if (resultats.length < appels.length) {
    const [nom, args] = appels[resultats.length];
    if (!noms.includes(nom)) return { content: `OUTIL-ABSENT ${nom}` };
    return { tool_calls: [{ index: 0, id: `appel-${resultats.length}`, type: "function", function: { name: nom, arguments: JSON.stringify(args) } }] };
  }
  return { content: `FIN ${resultats.join(" || ")}` };
}
const fauxModele = serveurHttp(async (req, res) => {
  const morceaux = [];
  for await (const m of req) morceaux.push(m);
  const corps = Buffer.concat(morceaux).toString("utf8");
  const url = new URL(req.url ?? "/", "http://x");
  if (url.pathname === "/v1/models") return json(res, 200, { object: "list", data: [{ id: "essai-outils", object: "model" }] });
  if (url.pathname !== "/v1/chat/completions") return json(res, 404, {});
  const demande = JSON.parse(corps || "{}");
  auModele.push(demande);
  const delta = { role: "assistant", ...decision(demande) };
  const fin = delta.tool_calls ? "tool_calls" : "stop";
  res.writeHead(200, { "Content-Type": "text/event-stream" });
  const morceau = (o) => res.write(`data: ${JSON.stringify({ id: "essai", object: "chat.completion.chunk", created: 1, model: demande.model, ...o })}\n\n`);
  morceau({ choices: [{ index: 0, delta }] });
  morceau({ choices: [{ index: 0, delta: {}, finish_reason: fin }] });
  morceau({ choices: [], usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 } });
  res.end("data: [DONE]\n\n");
});
const PORT_MODELE = await portLibre();
await new Promise((ok) => fauxModele.listen(PORT_MODELE, "127.0.0.1", ok));

/* ------------------------------------------------------------------------- */
/* La passerelle d'essai                                                      */
/* ------------------------------------------------------------------------- */

const PORT_PALMIER = await portLibre();
// Un second port, où l'on essaie d'envoyer la passerelle par la requête : rien ne doit y arriver.
const PORT_LEURRE = await portLibre();
const PREALABLE = join(AUX, "prealable.mjs");
const SORTIES = join(AUX, "sorties-refusees.log");
// Aucune sortie hors de la boucle locale pendant l'essai : notée, et refusée.
writeFileSync(
  PREALABLE,
  `import { appendFileSync } from "node:fs";
const fetchOrigine = globalThis.fetch;
globalThis.fetch = async (entree, options = {}) => {
  const brute = typeof entree === "string" || entree instanceof URL ? String(entree) : entree.url;
  const a = new URL(brute);
  if (["127.0.0.1", "localhost", "[::1]"].includes(a.hostname)) return fetchOrigine(entree, options);
  appendFileSync(${JSON.stringify(SORTIES)}, a.href + "\\n");
  throw new TypeError("fetch failed (essai : aucune sortie vers " + a.hostname + ")");
};
`,
);
const ESPACE = join(AUX, "espace");
mkdirSync(ESPACE, { recursive: true });
const DONNEES = join(AUX, "donnees");
const PROFIL = join(AUX, "profil.json");
writeFileSync(
  PROFIL,
  JSON.stringify({
    chiffrement: "fichier",
    backends: [{ id: "lmstudio", enabled: false }, { id: "exo", enabled: false }, { id: "essai", label: "Essai", baseUrl: `http://127.0.0.1:${PORT_MODELE}/v1` }],
  }),
);
const EXECUTABLE = realpathSync(process.execPath);

async function lancerPasserelle() {
  const port = await portLibre();
  const env = {
    ...process.env,
    HELIX_CONFIG: PROFIL,
    HELIX_GATEWAY_PORT: String(port),
    HELIX_DATA_DIR: DONNEES,
    HELIX_WORKSPACE: ESPACE,
    HELIX_CODE_DIR: ESPACE,
    HELIX_LMSTUDIO_URL: "http://127.0.0.1:9/v1",
    HELIX_EXO_URL: "http://127.0.0.1:9/v1",
    HELIX_GATEWAY_HOST: "127.0.0.1",
    HELIX_ESSAI_PALMIER_PORT: String(PORT_PALMIER),
    HELIX_ESSAI_PALMIER_EXECUTABLE: EXECUTABLE,
  };
  const processus = spawn(process.execPath, ["--import", PREALABLE, join(RACINE, "gateway", "src", "index.ts")], { env, stdio: ["ignore", "pipe", "pipe"] });
  const inst = { port, processus, journal: "", G: `http://127.0.0.1:${port}` };
  processus.stdout.on("data", (b) => (inst.journal += b));
  processus.stderr.on("data", (b) => (inst.journal += b));
  for (let i = 0; i < 160; i++) {
    try {
      await fetch(`${inst.G}/health`);
      break;
    } catch {
      await attendre(250);
    }
  }
  const jeton = readFileSync(join(DONNEES, "instance-token"), "utf8").trim();
  inst.J = { "Content-Type": "application/json", Authorization: `Bearer ${jeton}`, "X-Helix-Langue": "fr" };
  return inst;
}
const IDENTITE = { fullName: "Alice Essai", email: "alice@example.test", password: "Mot2PasseSolide!42" };
async function ouvrirSeance(inst) {
  const r = await fetch(`${inst.G}/helix/auth/create`, { method: "POST", headers: inst.J, body: JSON.stringify(IDENTITE) });
  const corps = await r.json();
  inst.A = { ...inst.J, "X-Helix-Session": corps.session?.token };
  return Boolean(corps.session?.token);
}
const api = async (inst, chemin, corps, entetes = inst.A) => {
  const r = await fetch(`${inst.G}${chemin}`, corps === undefined ? { headers: entetes } : { method: "POST", headers: entetes, body: JSON.stringify(corps) });
  return { statut: r.status, ...(await r.json().catch(() => ({}))) };
};

/** Une question au Chat, avec les outils ; les cartes reçoivent `accorder(carte)`, comme un clic. */
async function chat(inst, plan, accorder = () => true, entetes = inst.A) {
  const enCours = fetch(`${inst.G}/v1/chat/completions`, {
    method: "POST",
    headers: entetes,
    body: JSON.stringify({ model: "essai-outils", stream: true, tools: true, effort: "aucun", messages: [{ role: "user", content: `PLAN:${JSON.stringify(plan)}` }] }),
  }).then((r) => r.text());
  let fini = false;
  enCours.finally(() => (fini = true));
  const cartes = [];
  while (!fini) {
    const e = await api(inst, "/helix/approbation", undefined, entetes);
    for (const c of e.enAttente ?? []) {
      if (cartes.some((x) => x.id === c.id)) continue;
      cartes.push(c);
      await api(inst, "/helix/approbation/repondre", { id: c.id, accord: accorder(c) }, entetes);
    }
    await attendre(120);
  }
  const brut = await enCours;
  const evenements = [];
  let texte = "";
  for (const ligne of brut.split("\n")) {
    if (!ligne.startsWith("data: ") || ligne === "data: [DONE]") continue;
    try {
      const j = JSON.parse(ligne.slice(6));
      if (j.helix) evenements.push(j.helix);
      const d = j.choices?.[0]?.delta?.content;
      if (typeof d === "string") texte += d;
    } catch {
      /* ligne partielle */
    }
  }
  return { texte, fins: evenements.filter((e) => e.type === "tool_end"), cartes };
}

console.log("\nB. La passerelle : reconnaissance, branchement, cartes d'accord, retrait");
const passerelle = await lancerPasserelle();
let palmier = null;
try {
  const seance = await ouvrirSeance(passerelle);
  verifier("la passerelle d'essai démarre et ouvre une séance (premier compte : administrateur)", seance, passerelle.journal.slice(-1500));

  const etat0 = await api(passerelle, "/helix/connecteurs");
  const fiche = (etat0.catalogue ?? []).find((e) => e.id === "palmier");
  verifier("sur ce Mac, la fiche « Palmier Pro » est proposée, locale, sans adresse", Boolean(fiche?.local) && !fiche.url && fiche.label === "Palmier Pro", fiche);

  // 1. Application fermée : personne n'écoute sur son port.
  const ferme = await api(passerelle, "/helix/connecteurs/connecter", { id: "palmier" });
  verifier(
    "application fermée : refus clair « Ouvrez Palmier Pro, puis réessayez », avec la page de téléchargement officielle, rien n'est branché",
    ferme.statut === 400 && /Ouvrez Palmier Pro, puis réessayez/.test(ferme.message) && /(^|[\s«(])https:\/\/github\.com\/palmier-io\/palmier-pro\/releases\/latest(?=$|[\s».,;)])/.test(ferme.message) && !(ferme.etat?.installes ?? []).some((c) => c.id === "palmier"),
    ferme.message,
  );

  // 2. Un autre programme écoute sur le port.
  const autre = await autreProgramme(PORT_PALMIER);
  const refus = await api(passerelle, "/helix/connecteurs/connecter", { id: "palmier" });
  await attendre(300);
  verifier(
    "un autre programme sur le port : refus « Un autre programme occupe le port de Palmier Pro », et il n'a rien reçu (ni requête, ni donnée)",
    refus.statut === 400 && /Un autre programme occupe le port de Palmier Pro/.test(refus.message) && autre.recu === "" && !(refus.etat?.installes ?? []).some((c) => c.id === "palmier"),
    `${refus.message} | reçu par l'autre : ${JSON.stringify(autre.recu.slice(0, 200))}`,
  );
  await arreterAutre(autre);

  // 3. Le (faux) Palmier Pro, reconnu : branché d'un clic.
  palmier = await fauxPalmier(PORT_PALMIER);
  const leurre = await fauxPalmier(PORT_LEURRE);
  const branche = await api(passerelle, "/helix/connecteurs/connecter", { id: "palmier", url: `http://127.0.0.1:${PORT_LEURRE}/mcp`, port: PORT_LEURRE, command: "/bin/sh" });
  const inst = (branche.etat?.installes ?? []).find((c) => c.id === "palmier");
  verifier(
    `Palmier Pro reconnu : branché d'un clic, en marche, ses ${OUTILS_PALMIER.length} outils listés, marqué local`,
    branche.statut === 200 && branche.pret && inst?.running && inst.toolCount === OUTILS_PALMIER.length && inst.local === true,
    `${branche.message} ${JSON.stringify(inst)}`,
  );
  verifier(
    "l'adresse, le port et la commande glissés dans la requête sont ignorés : rien n'est arrivé au second port",
    !recuPalmier.some((r) => r.port === PORT_LEURRE) && recuPalmier.some((r) => r.port === PORT_PALMIER),
    recuPalmier.map((r) => r.port),
  );
  const auPort = recuPalmier.filter((r) => r.port === PORT_PALMIER);
  verifier(
    "ce qui part vers Palmier Pro : 127.0.0.1 et son port, chemin /mcp, sans jeton d'accès, sans en-tête Origin",
    auPort.length > 0 && auPort.every((r) => r.entetes.host === `127.0.0.1:${PORT_PALMIER}` && new URL(r.chemin, "http://x").pathname === "/mcp" && !r.entetes.authorization && !r.entetes.cookie && !r.entetes.origin),
    auPort.map((r) => `${r.methode} ${r.chemin} ${r.entetes.host} ${r.entetes.authorization ?? ""}`),
  );
  const ajout = await api(passerelle, "/helix/connecteurs/ajouter", { id: "palmier", command: "/bin/sh", args: ["-c", "id"] });
  verifier("la route « ajouter » (par jeton, avec commande) refuse Palmier Pro : il se branche d'un clic", ajout.statut === 400 && /se branche d'un clic/.test(ajout.message), ajout.message);

  // 4. Lecture sans carte, génération derrière la carte.
  const lecture = await chat(passerelle, [["palmier__get_timeline", {}]]);
  verifier("Chat : lire la timeline passe sans carte, le résultat revient", lecture.cartes.length === 0 && lecture.fins[0]?.ok && /REPERE-PALMIER get_timeline/.test(lecture.texte), `${JSON.stringify(lecture.cartes)} ${lecture.texte}`);

  const avantGen = appelsPalmier().length;
  const gen = await chat(passerelle, [["palmier__generate_video", { prompt: "un coucher de soleil sur la mer" }]]);
  const carteGen = gen.cartes[0];
  verifier(
    "Chat : générer une vidéo montre une carte (arguments entiers, hors de la machine, crédits, cet appel seulement), acceptée, puis l'appel part",
    gen.cartes.length === 1 && carteGen.detail?.outil === "palmier__generate_video" && carteGen.detail?.horsMachine === "generation" && carteGen.detail?.unique === true && /coucher de soleil sur la mer/.test(carteGen.detail?.arguments ?? "") && /services de Palmier, hors de cette machine/.test(carteGen.resume) && gen.fins[0]?.ok && appelsPalmier().slice(avantGen).includes("generate_video"),
    `${JSON.stringify(gen.cartes)} ${JSON.stringify(gen.fins)}`,
  );
  const avantRefus = appelsPalmier().length;
  const non = await chat(passerelle, [["palmier__generate_image", { prompt: "à ne pas générer" }]], () => false);
  verifier("carte refusée : la génération d'image n'arrive jamais à Palmier Pro", non.cartes.length === 1 && non.fins[0]?.ok === false && appelsPalmier().length === avantRefus, `${JSON.stringify(non.fins)} ${appelsPalmier().slice(avantRefus)}`);

  const deux = await chat(passerelle, [["palmier__add_clips", { prompt: "plan 1" }], ["palmier__add_clips", { prompt: "plan 2" }], ["palmier__nouvel_outil_inconnu", {}]]);
  verifier("modifier la timeline : une carte à chaque appel (deux ajouts, deux cartes) ; un outil inconnu aussi", deux.cartes.length === 3 && deux.cartes.every((c) => c.detail?.unique === true) && deux.fins.every((f) => f.ok), `${deux.cartes.map((c) => c.detail?.outil)} ${JSON.stringify(deux.fins)}`);

  // 5. « Tout approuver » ne lève pas la carte d'une génération.
  const niveau = await api(passerelle, "/helix/approbation/niveau", { niveau: "tout" });
  const tout = await chat(passerelle, [["palmier__get_media", {}], ["palmier__generate_audio", { prompt: "une musique" }], ["palmier__move_clips", {}]]);
  verifier(
    "au niveau « Tout approuver » : la lecture passe seule, la génération et la modification demandent toujours",
    niveau.statut === 200 && tout.cartes.length === 2 && tout.cartes.map((c) => c.detail?.outil).join(",") === "palmier__generate_audio,palmier__move_clips" && tout.fins.every((f) => f.ok),
    `${niveau.statut} ${tout.cartes.map((c) => c.detail?.outil)} ${JSON.stringify(tout.fins)}`,
  );
  await api(passerelle, "/helix/approbation/niveau", { niveau: "modifications" });

  // 6. Un collègue (non administrateur) : il lit, mais ne dépense pas les crédits de la personne qui a ouvert Palmier Pro.
  const cree = await api(passerelle, "/helix/auth/create", { fullName: "Collègue", email: "collegue@example.test", password: "Provisoire2Collegue!7" });
  const connexion = await api(passerelle, "/helix/auth/mot-de-passe-provisoire", { accountId: cree.account?.id, password: "Provisoire2Collegue!7", nouveau: "Collegue2PasseSolide!9" }, passerelle.J);
  const B = { ...passerelle.J, "X-Helix-Session": connexion.session?.token };
  const avantB = appelsPalmier().length;
  const genB = await chat(passerelle, [["palmier__get_timeline", {}], ["palmier__generate_video", { prompt: "au nom d'un collègue" }]], () => true, B);
  verifier(
    "collègue non administrateur : il lit la timeline ; sa génération, même acceptée sur sa carte, est refusée (administrateur seul) et n'arrive pas à Palmier Pro",
    Boolean(connexion.session?.token) && genB.fins[0]?.ok && genB.fins[1]?.ok === false && /réservé à l'administrateur/.test(genB.fins[1]?.preview ?? genB.texte) && !appelsPalmier().slice(avantB).includes("generate_video"),
    `${cree.statut} ${JSON.stringify(genB.fins)} ${appelsPalmier().slice(avantB)}`,
  );

  // 7. Palmier Pro fermé, un autre programme prend le port : rien ne lui est envoyé.
  await fermerServeur(palmier);
  palmier = null;
  const intrus = await autreProgramme(PORT_PALMIER);
  const versIntrus = await chat(passerelle, [["palmier__get_timeline", {}]]);
  await attendre(300);
  verifier(
    "Palmier Pro remplacé par un autre programme en cours de route : l'appel échoue en le disant, et l'intrus ne reçoit rien",
    versIntrus.fins[0]?.ok === false && /Un autre programme occupe le port de Palmier Pro/.test(`${versIntrus.fins[0]?.preview ?? ""} ${versIntrus.texte}`) && intrus.recu === "",
    `${JSON.stringify(versIntrus.fins)} | reçu : ${JSON.stringify(intrus.recu.slice(0, 200))}`,
  );
  await arreterAutre(intrus);

  // 8. Fermé : l'appel dit de l'ouvrir ; rouvert, « Réessayer » le rebranche.
  const ferme2 = await chat(passerelle, [["palmier__get_timeline", {}]]);
  verifier("Palmier Pro fermé : l'appel échoue en disant de l'ouvrir", ferme2.fins[0]?.ok === false && /Ouvrez Palmier Pro/.test(`${ferme2.fins[0]?.preview ?? ""} ${ferme2.texte}`), JSON.stringify(ferme2.fins));
  palmier = await fauxPalmier(PORT_PALMIER);
  const reessai = await api(passerelle, "/helix/connecteurs/connecter", { id: "palmier" });
  const apres = await chat(passerelle, [["palmier__get_timeline", {}]]);
  verifier("rouvert : « Réessayer » le rebranche, et la lecture repasse", reessai.statut === 200 && reessai.pret && apres.fins[0]?.ok && /REPERE-PALMIER get_timeline/.test(apres.texte), `${reessai.message} ${JSON.stringify(apres.fins)}`);

  // 9. Retrait.
  const retrait = await api(passerelle, "/helix/connecteurs/retirer", { id: "palmier" });
  const plusLa = await chat(passerelle, [["palmier__get_timeline", {}]]);
  verifier("retiré : plus dans la liste, plus aucun outil proposé au modèle", retrait.ok && !(retrait.etat?.installes ?? []).some((c) => c.id === "palmier") && /OUTIL-ABSENT palmier__get_timeline/.test(plusLa.texte), `${retrait.message} ${plusLa.texte}`);
  await fermerServeur(leurre);

  const sorties = (() => {
    try {
      return readFileSync(SORTIES, "utf8").trim().split("\n").filter((l) => l && !l.startsWith("https://registry.npmjs.org/"));
    } catch {
      return [];
    }
  })();
  verifier("aucune sortie réseau hors de la machine pendant l'essai", sorties.length === 0, sorties.join(" "));
} catch (err) {
  verifier("partie B sans exception", false, `${err?.stack ?? String(err)} ${passerelle.journal.slice(-1200)}`);
}

passerelle.processus.kill("SIGTERM");
await attendre(1200);
if (palmier) await fermerServeur(palmier);
fauxModele.close();
console.log(`\n${reussis} vérification(s) réussie(s), ${echecs.length} échec(s).`);
if (echecs.length) console.log(`Échecs :\n - ${echecs.join("\n - ")}`);
process.exit(echecs.length ? 1 : 0);
