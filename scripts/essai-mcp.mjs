/*
 * Serveurs MCP et outils intégrés, essayés de bout en bout (28/09/2026).
 *
 *   node scripts/essai-mcp.mjs                (lancé aussi par npm run securite, section 20)
 *   node scripts/essai-mcp.mjs --sans-reseau  (sans les serveurs de référence tirés par npx)
 *
 * Pourquoi cet essai : `mcp-essai.mjs` n'était qu'un petit serveur pour la
 * ligne de commande, et `essai-connecteurs.mjs` éprouve l'autorisation des
 * services distants jusqu'à un premier outil. Rien n'éprouvait le protocole
 * lui-même : la pagination de `tools/list`, les contenus autres que du texte,
 * `isError`, `notifications/tools/list_changed`, un serveur qui plante, qui ne
 * répond pas, qui redémarre, l'arrêt des processus. La tournée du 28/09/2026 y
 * a trouvé une dizaine de défauts (mcp.ts, connecteurs.ts) ; chacun a ici la
 * vérification qui l'aurait attrapé.
 *
 *  A. Le gestionnaire (gateway/src/mcp.ts), importé dans ce processus, contre
 *     de faux serveurs stdio écrits ici pour les cas limites.
 *  B. Les serveurs de référence (@modelcontextprotocol/server-everything et
 *     server-memory, versions épinglées, tirés par npx) : stdio, HTTP
 *     « streamable » et SSE, et un serveur distant qui redémarre.
 *  C. Un MCP distant avec OAuth, par la passerelle : faux serveur
 *     d'autorisation et faux MCP protégé (renvoyés depuis mcp.linear.app par un
 *     module préalable) ; découverte, inscription automatique, PKCE, jeton
 *     expiré puis rafraîchi, y compris après un redémarrage.
 *  D. La passerelle, comme l'écran s'en sert : un MCP personnalisé ajouté (sur
 *     une instance qui l'autorise), en ligne avec ses outils, utilisé dans un
 *     Chat par un faux modèle compatible OpenAI, carte d'approbation acceptée
 *     puis refusée, résultat, retrait ; identifiants refusés ; aucun orphelin
 *     à l'arrêt de la passerelle ; aucune variable sensible transmise.
 *  E. Les connecteurs intégrés sans compte : fichiers (hors espace, lien
 *     symbolique, zone protégée), mémoire de travail, réflexion.
 */
import { execFileSync, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { createServer as serveurHttp } from "node:http";
import { createServer as serveurTcp } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const RACINE = join(dirname(fileURLToPath(import.meta.url)), "..");
const SANS_RESEAU = process.argv.includes("--sans-reseau");

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
// Bornée : une durée venue d'un faux serveur ne fige pas l'essai (CodeQL, 04/10/2026).
const attendre = (ms) => new Promise((r) => setTimeout(r, Math.min(Math.max(0, Number(ms) || 0), 120_000)));
const vivant = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};
/** Attend qu'une condition devienne vraie (au plus `ms`). */
async function jusqua(condition, ms = 5000) {
  for (let t = 0; t < ms; t += 100) {
    if (await condition()) return true;
    await attendre(100);
  }
  return Boolean(await condition());
}

const AUX = mkdtempSync(join(tmpdir(), "helix-essai-mcp-"));
/** Ce que ce processus porte de sensible : rien ne doit en arriver à un serveur MCP. */
const FUITES = { OPENAI_API_KEY: "sk-ESSAI-FUITE-1234567890", HELIX_ESSAI_JETON: "SECRET-FUITE-0987654321", AWS_SECRET_ACCESS_KEY: "AWS-FUITE-111122223333" };
Object.assign(process.env, FUITES);

/* ------------------------------------------------------------------------- */
/* Le faux serveur stdio, un mode par argument                                */
/* ------------------------------------------------------------------------- */

const FAUX = join(AUX, "faux-mcp.mjs");
writeFileSync(
  FAUX,
  String.raw`import { createInterface } from "node:readline";
import { appendFileSync, writeFileSync } from "node:fs";
import { spawn } from "node:child_process";
const mode = process.argv[2] ?? "base";
const trace = process.argv[3];
if (trace) writeFileSync(trace + ".pid", String(process.pid));
const envoyer = (m) => process.stdout.write(JSON.stringify(m) + "\n");
const note = (s) => trace && appendFileSync(trace, s + "\n");
const simple = (name) => ({ name, description: "outil " + name, inputSchema: { type: "object", properties: {} } });
let outils = [
  { name: "echo", description: "Renvoie le texte donné.", inputSchema: { type: "object", properties: { texte: { type: "string" } }, required: ["texte"] } },
  ...["env", "planter", "lent", "progres", "erreur", "contenus", "structure", "ajouter"].map(simple),
];
if (mode === "pages") outils = Array.from({ length: 7 }, (_, i) => simple("outil_" + i));
if (mode === "noms") outils = [simple("get.weather"), simple("a/b c"), simple("x".repeat(80)), simple("echo"), simple("echo")];
if (mode === "collision-a") outils = [simple("x")];
if (mode === "collision-b") outils = [simple("_x")];
if (mode === "orphelin") {
  // Il lance un processus à lui, et tous deux ignorent SIGTERM et la fin de leur entrée.
  const p = spawn(process.execPath, ["-e", "process.on('SIGTERM',()=>{});setInterval(()=>{},1000)"], { stdio: "ignore" });
  if (trace) writeFileSync(trace + ".enfant", String(p.pid));
  process.on("SIGTERM", () => note("SIGTERM ignoré"));
  setInterval(() => {}, 1000);
}
createInterface({ input: process.stdin }).on("line", async (ligne) => {
  let m;
  try { m = JSON.parse(ligne); } catch { return; }
  if (m.method) note("<- " + m.method);
  if (m.method === "initialize") {
    if (mode === "muet") return;
    return envoyer({ jsonrpc: "2.0", id: m.id, result: { protocolVersion: m.params?.protocolVersion ?? "2025-06-18", capabilities: { tools: { listChanged: true } }, serverInfo: { name: "faux", version: "1" } } });
  }
  if (m.method === "tools/list") {
    if (mode === "liste-plante") process.exit(4);
    if (mode === "pages") {
      const debut = Number(m.params?.cursor ?? 0);
      const suite = debut + 3 < outils.length ? String(debut + 3) : undefined;
      return envoyer({ jsonrpc: "2.0", id: m.id, result: { tools: outils.slice(debut, debut + 3), ...(suite ? { nextCursor: suite } : {}) } });
    }
    return envoyer({ jsonrpc: "2.0", id: m.id, result: { tools: outils } });
  }
  if (m.method === "tools/call") {
    const { name, arguments: args = {} } = m.params ?? {};
    note("appel " + name + " " + JSON.stringify(args));
    const texte = (t, extra = {}) => envoyer({ jsonrpc: "2.0", id: m.id, result: { content: [{ type: "text", text: t }], ...extra } });
    if (name === "echo" || name === "x" || name === "_x") return texte("echo[" + mode + "]:" + (args.texte ?? ""));
    if (name === "env") return texte(JSON.stringify(process.env));
    if (name === "planter") process.exit(3);
    if (name === "lent") { await new Promise((r) => setTimeout(r, Number(args.ms ?? 4000))); return texte("fini"); }
    if (name === "progres") {
      const jeton = m.params?._meta?.progressToken;
      for (let i = 1; i <= 6; i++) {
        await new Promise((r) => setTimeout(r, 500));
        if (jeton !== undefined) envoyer({ jsonrpc: "2.0", method: "notifications/progress", params: { progressToken: jeton, progress: i, total: 6 } });
      }
      return texte("fini avec progression");
    }
    if (name === "erreur") return texte("ça a raté", { isError: true });
    if (name === "contenus") return envoyer({ jsonrpc: "2.0", id: m.id, result: { content: [
      { type: "text", text: "avant" },
      { type: "image", data: "iVBORw0KGgo=", mimeType: "image/png" },
      { type: "resource", resource: { uri: "file:///x.txt", mimeType: "text/plain", text: "TEXTE-DE-LA-RESSOURCE" } },
      { type: "resource_link", uri: "file:///y.txt", name: "y.txt" },
    ] } });
    if (name === "structure") return envoyer({ jsonrpc: "2.0", id: m.id, result: { content: [], structuredContent: { total: 42 } } });
    if (name === "ajouter") {
      outils.push(simple("nouveau"));
      envoyer({ jsonrpc: "2.0", method: "notifications/tools/list_changed" });
      return texte("ajouté");
    }
    return envoyer({ jsonrpc: "2.0", id: m.id, error: { code: -32602, message: "outil inconnu " + name } });
  }
  if (m.id !== undefined && m.method) envoyer({ jsonrpc: "2.0", id: m.id, result: {} });
});
`,
);
const faux = (mode, trace) => ({ command: process.execPath, args: [FAUX, mode, ...(trace ? [trace] : [])] });
const pidDe = (trace) => Number(readFileSync(`${trace}.pid`, "utf8"));

/* ------------------------------------------------------------------------- */
/* A. Le gestionnaire, contre de faux serveurs                                */
/* ------------------------------------------------------------------------- */

const DONNEES_A = join(AUX, "donnees-a");
const ESPACE_A = join(AUX, "espace-a");
mkdirSync(ESPACE_A, { recursive: true });
const PROFIL_A = join(AUX, "profil-a.json");
writeFileSync(PROFIL_A, JSON.stringify({ chiffrement: "fichier" }));
Object.assign(process.env, { HELIX_DATA_DIR: DONNEES_A, HELIX_WORKSPACE: ESPACE_A, HELIX_CONFIG: PROFIL_A, HELIX_MCP_DELAI_MS: "1500" });
// Ce que le gestionnaire écrit sur la sortie d'erreur (les lignes des serveurs y passent, masquées).
const journalA = [];
const erreurOrigine = console.error;
const logOrigine = console.log;
console.error = (...a) => journalA.push(a.map(String).join(" "));
// Les lignes « [mcp] … démarré » du gestionnaire, importé ici, ne se mêlent pas au compte rendu.
console.log = (...a) => (String(a[0]).startsWith("[mcp]") ? journalA.push(a.map(String).join(" ")) : logOrigine(...a));
const mcp = await import(pathToFileURL(join(RACINE, "gateway", "src", "mcp.ts")).href);
const statut = (id) => mcp.status().find((s) => s.id === id);
const nomsModele = (id) => mcp.toolsForModel().map((o) => o.function.name).filter((n) => n.startsWith(`${id}__`));

console.log("\nA. Le gestionnaire MCP contre de faux serveurs stdio");
try {
  mcp.declarer({ id: "pages", label: "Pages", description: "", ...faux("pages"), autoStart: false });
  const rp = await mcp.startServer("pages");
  verifier("tools/list paginé : les sept outils servis par pages de trois sont tous relevés", rp.ok && statut("pages")?.toolCount === 7, `${JSON.stringify(rp)} ${statut("pages")?.toolCount}`);

  const tNoms = join(AUX, "trace-noms");
  mcp.declarer({ id: "noms", label: "Noms", description: "", ...faux("noms", tNoms), autoStart: false });
  await mcp.startServer("noms");
  const noms = nomsModele("noms");
  verifier(
    "noms d'outils ramenés à ^[A-Za-z0-9_-]{1,64}$ (point, barre, espace, 80 caractères), sans doublon, l'outil listé deux fois gardé une fois",
    noms.length === 4 && noms.every((n) => /^[A-Za-z0-9_-]{1,64}$/.test(n)) && new Set(noms).size === 4,
    noms,
  );
  const meteo = noms.find((n) => n.startsWith("noms__get_weather"));
  await mcp.callTool(meteo, {});
  verifier("l'appel part au serveur sous le nom d'origine (get.weather)", readFileSync(tNoms, "utf8").includes("appel get.weather"), readFileSync(tNoms, "utf8"));

  // « a_ » + « x » et « a » + « _x » donnaient tous deux a___x : l'appel partait chez le premier.
  mcp.declarer({ id: "a_", label: "A souligné", description: "", ...faux("collision-a"), autoStart: false });
  mcp.declarer({ id: "a", label: "A", description: "", ...faux("collision-b"), autoStart: false });
  await mcp.startServer("a_");
  await mcp.startServer("a");
  const tousNoms = mcp.toolsForModel().map((o) => o.function.name);
  const deA = tousNoms.filter((n) => /^a_+x/.test(n));
  const reponses = await Promise.all(deA.map((n) => mcp.callTool(n, { texte: "?" })));
  verifier(
    "deux serveurs dont les noms qualifiés se rencontraient (a___x) : deux noms distincts, chacun mène à son serveur",
    new Set(tousNoms).size === tousNoms.length && deA.length === 2 && reponses.some((r) => r.content.includes("[collision-a]")) && reponses.some((r) => r.content.includes("[collision-b]")),
    `${JSON.stringify(deA)} ${JSON.stringify(reponses)}`,
  );

  const tBase = join(AUX, "trace-base");
  mcp.declarer({ id: "base", label: "Base", description: "", ...faux("base", tBase), env: { JETON_DU_CONNECTEUR: "JETON-CONNECTEUR-4242" }, autoStart: false });
  const rb = await mcp.startServer("base");
  verifier("serveur stdio démarré, ses neuf outils listés", rb.ok && statut("base")?.running && statut("base")?.toolCount === 9, JSON.stringify(statut("base")));
  const echo = await mcp.callTool("base__echo", { texte: "bonjour" });
  verifier("tools/call : texte rendu", echo.ok && echo.content === "echo[base]:bonjour", JSON.stringify(echo));
  const contenus = await mcp.callTool("base__contenus", {});
  verifier(
    "contenus : le texte d'une ressource et l'adresse d'un lien arrivent au modèle ; l'image est annoncée, pas tue",
    contenus.ok && contenus.content.includes("TEXTE-DE-LA-RESSOURCE") && contenus.content.includes("file:///y.txt") && /image image\/png/.test(contenus.content),
    contenus.content,
  );
  const structure = await mcp.callTool("base__structure", {});
  verifier("résultat seulement structuré (structuredContent) rendu en JSON, pas « (résultat vide) »", structure.ok && /"total": 42/.test(structure.content), structure.content);
  const erreur = await mcp.callTool("base__erreur", {});
  verifier("isError : l'appel est un échec, le message du serveur est rendu", erreur.ok === false && erreur.content === "ça a raté", JSON.stringify(erreur));
  const inconnu = await mcp.callTool("base__nexistepas", {});
  verifier("outil inconnu de la passerelle : refusé sans appel au serveur", inconnu.ok === false && !readFileSync(tBase, "utf8").includes("nexistepas"), JSON.stringify(inconnu));

  const env = JSON.parse((await mcp.callTool("base__env", {})).content);
  verifier(
    "environnement du serveur : ni les clés de la passerelle (OPENAI_API_KEY, AWS_SECRET_ACCESS_KEY, HELIX_*), seulement PATH, HOME… et le secret du connecteur",
    !Object.keys(FUITES).some((k) => k in env) && !Object.keys(env).some((k) => k.startsWith("HELIX_")) && env.JETON_DU_CONNECTEUR === "JETON-CONNECTEUR-4242" && typeof env.PATH === "string",
    Object.keys(env),
  );

  await mcp.callTool("base__ajouter", {});
  const change = await jusqua(() => nomsModele("base").includes("base__nouveau"), 3000);
  verifier("notifications/tools/list_changed : la liste est relue, le nouvel outil est proposé au modèle", change, nomsModele("base"));

  const t0 = Date.now();
  const lent = await mcp.callTool("base__lent", { ms: 4000 });
  verifier("délai : un outil muet au-delà du délai est abandonné, en le disant (et vite)", lent.ok === false && /pas répondu à temps/.test(lent.content) && Date.now() - t0 < 3500, `${Date.now() - t0} ms ${lent.content}`);
  const apresLent = await mcp.callTool("base__echo", { texte: "encore" });
  verifier("après un délai dépassé, le serveur sert toujours", apresLent.ok, JSON.stringify(apresLent));
  const progres = await mcp.callTool("base__progres", {});
  verifier("un outil qui dit où il en est (notifications/progress) n'est pas coupé au délai (3 s pour 1,5 s de délai)", progres.ok && progres.content === "fini avec progression", JSON.stringify(progres));

  const pid1 = pidDe(tBase);
  const plante = await mcp.callTool("base__planter", {});
  verifier("serveur qui plante pendant un appel : échec dit, sans prétendre que rien n'a été fait", plante.ok === false && /a pu être exécuté/.test(plante.content), plante.content);
  const relance = await jusqua(() => statut("base")?.running && pidDe(tBase) !== pid1, 5000);
  const apresPlantage = await mcp.callTool("base__echo", { texte: "revenu" });
  verifier("relancé tout seul : en marche, nouveau processus, les appels suivants passent", relance && apresPlantage.ok && apresPlantage.content.endsWith("revenu"), `${JSON.stringify(statut("base"))} ${JSON.stringify(apresPlantage)}`);

  const pid2 = pidDe(tBase);
  process.kill(pid2, "SIGKILL");
  const vuArrete = await jusqua(() => !statut("base")?.running, 2000);
  verifier("un serveur tué de l'extérieur n'est plus dit « en marche »", vuArrete, JSON.stringify(statut("base")));
  const relance2 = await jusqua(() => statut("base")?.running && pidDe(tBase) !== pid2, 5000);
  verifier("puis il est relancé, sans que personne ait à redémarrer la passerelle", relance2, JSON.stringify(statut("base")));

  /*
   * Deux arrêts inattendus déjà (le plantage, le SIGKILL) : un troisième est relancé, le quatrième ne
   * l'est plus. Un arrêt de plus est toléré (30/09/2026) : le plantage pendant un appel peut être
   * rattrapé par la relance à la demande de l'appel suivant avant d'être compté, et sous charge
   * (batterie complète) le serveur avait alors droit à une relance de plus ; l'essai échouait une
   * fois sur quatre sans que rien ne tourne en boucle.
   */
  const tues = [];
  for (let i = 0; i < 3; i++) {
    const p = pidDe(tBase);
    tues.push(p);
    process.kill(p, "SIGKILL");
    await jusqua(() => !statut("base")?.running, 2000);
    // Relancé une seconde plus tard s'il doit l'être : on laisse le temps de le voir.
    const relance = await jusqua(() => statut("base")?.running && pidDe(tBase) !== p, 4000);
    if (!relance) break;
  }
  verifier("un serveur qui plante en boucle n'est pas relancé indéfiniment", !statut("base")?.running && /trois fois|three times/.test(statut("base")?.error ?? "") && tues.length >= 2, `tués ${tues.join(", ")} ${JSON.stringify({ ...statut("base"), tools: undefined })}`);
  const surDemande = await mcp.callTool("base__echo", { texte: "à la demande" });
  verifier("…mais l'appel suivant d'un de ses outils le relance", surDemande.ok && statut("base")?.running, JSON.stringify(surDemande));

  // Démarrages simultanés : un seul processus.
  const tDouble = join(AUX, "trace-double");
  mcp.declarer({ id: "double", label: "Double", description: "", ...faux("base", tDouble), autoStart: false });
  await Promise.all([mcp.startServer("double"), mcp.startServer("double"), mcp.startServer("double")]);
  const inits = (readFileSync(tDouble, "utf8").match(/<- initialize/g) ?? []).length;
  verifier("trois démarrages simultanés : un seul processus lancé", inits === 1, `${inits} initialize`);

  // Arrêté pendant qu'il démarre : il ne reste pas derrière.
  const tCourse = join(AUX, "trace-course");
  mcp.declarer({ id: "course", label: "Course", description: "", ...faux("base", tCourse), autoStart: false });
  const enCours = mcp.startServer("course");
  await jusqua(() => existsSync(`${tCourse}.pid`), 3000);
  await mcp.stopServer("course");
  await enCours;
  await attendre(300);
  verifier("arrêté pendant son démarrage : ni en marche, ni processus restant", !statut("course")?.running && !vivant(pidDe(tCourse)), `${JSON.stringify(statut("course"))} vivant=${vivant(pidDe(tCourse))}`);

  const tMuet = join(AUX, "trace-muet");
  mcp.declarer({ id: "muet", label: "Muet", description: "", ...faux("muet", tMuet), autoStart: false });
  const t1 = Date.now();
  const rm = await mcp.startServer("muet");
  await attendre(300);
  verifier("serveur qui ne répond pas à initialize : échec dans le délai, processus arrêté", rm.ok === false && Date.now() - t1 < 6000 && !vivant(pidDe(tMuet)), `${JSON.stringify(rm)} ${Date.now() - t1} ms`);

  const tListe = join(AUX, "trace-liste");
  mcp.declarer({ id: "liste", label: "Liste", description: "", ...faux("liste-plante", tListe), autoStart: false });
  const rl = await mcp.startServer("liste");
  verifier("serveur qui meurt en listant ses outils : échec dit, aucun outil proposé", rl.ok === false && statut("liste")?.toolCount === 0 && !statut("liste")?.running, JSON.stringify(statut("liste")));

  const tOrph = join(AUX, "trace-orphelin");
  mcp.declarer({ id: "orphelin", label: "Orphelin", description: "", ...faux("orphelin", tOrph), autoStart: false });
  await mcp.startServer("orphelin");
  const pidO = pidDe(tOrph);
  const enfantO = Number(readFileSync(`${tOrph}.enfant`, "utf8"));
  await mcp.retirerServeur("orphelin");
  await attendre(300);
  verifier("retrait d'un serveur qui ignore SIGTERM et a lancé un processus à lui : aucun des deux ne reste", !vivant(pidO) && !vivant(enfantO), `serveur ${vivant(pidO)} enfant ${vivant(enfantO)}`);
  if (vivant(enfantO)) process.kill(enfantO, "SIGKILL");
  verifier("retiré : il disparaît de la liste et ses outils du modèle", !statut("orphelin") && nomsModele("orphelin").length === 0, JSON.stringify(statut("orphelin")));

  // Un serveur qui recopie son jeton sur sa sortie d'erreur : masqué dans le journal.
  const BAVARD = join(AUX, "bavard.mjs");
  writeFileSync(BAVARD, `console.error("config: jeton=" + process.env.JETON_BAVARD); process.exit(1);`);
  mcp.declarer({ id: "bavard", label: "Bavard", description: "", command: process.execPath, args: [BAVARD], env: { JETON_BAVARD: "JETON-BAVARD-777777" }, autoStart: false });
  const rbv = await mcp.startServer("bavard");
  await attendre(200);
  verifier(
    "un jeton recopié par le serveur sur sa sortie d'erreur est masqué dans le journal",
    rbv.ok === false && journalA.some((l) => l.includes("[secret masqué]")) && !journalA.some((l) => l.includes("JETON-BAVARD-777777")) && !String(rbv.error).includes("JETON-BAVARD"),
    journalA.filter((l) => /bavard/i.test(l)).join(" | "),
  );

  for (const id of ["pages", "noms", "a_", "a", "base", "double", "muet", "liste", "bavard"]) await mcp.retirerServeur(id);
} catch (err) {
  verifier("partie A sans exception", false, err?.stack ?? String(err));
}

/* ------------------------------------------------------------------------- */
/* B. Les serveurs de référence                                               */
/* ------------------------------------------------------------------------- */

const EVERYTHING = "@modelcontextprotocol/server-everything@2026.8.31";
const MEMORY = "@modelcontextprotocol/server-memory@2026.8.31";

/** Les processus lancés par ce processus, et leurs descendants. */
function descendantsDe(pid) {
  const table = execFileSync("ps", ["-A", "-o", "pid=,ppid=,command="], { encoding: "utf8" })
    .trim()
    .split("\n")
    .map((l) => /^\s*(\d+)\s+(\d+)\s+(.*)$/.exec(l))
    .filter(Boolean)
    .map((m) => ({ pid: Number(m[1]), ppid: Number(m[2]), cmd: m[3] }));
  const res = [];
  const file = [pid];
  while (file.length) {
    const p = file.shift();
    for (const e of table) if (e.ppid === p && !/\bps -A\b/.test(e.cmd)) (res.push(e), file.push(e.pid));
  }
  return res;
}

/** server-everything en HTTP (« streamableHttp » ou « sse »), sur un port donné. */
function everythingHttp(mode, port) {
  const p = spawn("npx", ["-y", EVERYTHING, mode], { env: { ...process.env, PORT: String(port), npm_config_update_notifier: "false" }, stdio: ["ignore", "ignore", "pipe"] });
  return new Promise((ok, ko) => {
    const minuterie = setTimeout(() => ko(new Error(`server-everything ${mode} n'a pas démarré`)), 120_000);
    p.stderr.on("data", (b) => {
      if (/listening|running/i.test(String(b))) {
        clearTimeout(minuterie);
        ok(p);
      }
    });
  });
}
/** Arrête un serveur lancé par `npx`, avec le `node` qu'il a lancé. */
async function arreterNpx(p) {
  for (const d of descendantsDe(p.pid)) {
    try {
      process.kill(d.pid, "SIGTERM");
    } catch {}
  }
  p.kill("SIGTERM");
  await attendre(800);
}

if (SANS_RESEAU) {
  console.log("\nB. Serveurs de référence : sautés (--sans-reseau)");
} else {
  console.log("\nB. Les serveurs de référence (server-everything, server-memory), en stdio, HTTP « streamable » et SSE");
  const aArreter = [];
  try {
    mcp.declarer({ id: "everything", label: "Everything", description: "", command: "npx", args: ["-y", EVERYTHING, "stdio"], autoStart: false });
    const re = await mcp.startServer("everything");
    const outilsE = statut("everything")?.tools.map((o) => o.name) ?? [];
    verifier("server-everything (stdio, par npx) : démarré, ses outils listés (echo, get-sum, get-tiny-image…)", re.ok && ["echo", "get-sum", "get-tiny-image", "get-resource-reference"].every((n) => outilsE.includes(n)), `${JSON.stringify(re)} ${outilsE.join(",")}`);
    const somme = await mcp.callTool("everything__get-sum", { a: 2, b: 3 });
    verifier("get-sum : 2 + 3 = 5", somme.ok && /5/.test(somme.content), JSON.stringify(somme));
    const image = await mcp.callTool("everything__get-tiny-image", {});
    verifier("get-tiny-image : l'image est annoncée au modèle (type image/png), le texte autour est rendu", image.ok && /image image\/png/.test(image.content), image.content);
    const ressource = await mcp.callTool("everything__get-resource-reference", { resourceType: "Text", resourceId: 1 });
    verifier("get-resource-reference : le texte de la ressource embarquée arrive au modèle, avec son adresse", ressource.ok && /\[ressource demo:\/\/resource\/[^\]]+\]\n\S/.test(ressource.content), ressource.content);
    const liens = await mcp.callTool("everything__get-resource-links", { count: 2 });
    verifier("get-resource-links : les adresses des liens arrivent au modèle", liens.ok && (liens.content.match(/demo:\/\//g) ?? []).length >= 2, liens.content);
    const envE = await mcp.callTool("everything__get-env", {});
    verifier("get-env : aucune clé de la passerelle dans l'environnement du serveur", envE.ok && !Object.values(FUITES).some((v) => envE.content.includes(v)) && !/HELIX_/.test(envE.content), envE.content.slice(0, 300));
    const invalide = await mcp.callTool("everything__get-sum", { a: "deux" });
    verifier("arguments refusés par le serveur : échec rendu, le message dit pourquoi", invalide.ok === false && /a|number|valid/i.test(invalide.content), JSON.stringify(invalide));
    const long = await mcp.callTool("everything__trigger-long-running-operation", { duration: 3, steps: 3 });
    verifier("opération longue avec progression (3 s pour un délai de 1,5 s) : menée à son terme", long.ok && /completed/i.test(long.content), JSON.stringify(long));
    const avant = descendantsDe(process.pid).filter((d) => /server-everything|mcp-server-everything/.test(d.cmd));
    await mcp.retirerServeur("everything");
    await attendre(500);
    const restes = avant.filter((d) => vivant(d.pid));
    verifier("retrait : `npm exec` et le `node` du serveur sont arrêtés, rien ne reste", avant.length >= 1 && restes.length === 0, `${avant.map((d) => d.cmd.slice(0, 60)).join(" | ")} / restes : ${restes.map((d) => d.pid).join(",")}`);

    const carnet = join(AUX, "memoire.jsonl");
    mcp.declarer({ id: "memoire", label: "Mémoire", description: "", command: "npx", args: ["-y", MEMORY], envPublic: { MEMORY_FILE_PATH: carnet }, autoStart: false });
    const rmem = await mcp.startServer("memoire");
    const cree = await mcp.callTool("memoire__create_entities", { entities: [{ name: "Martin", entityType: "client", observations: ["préfère le mail"] }] });
    const graphe = await mcp.callTool("memoire__read_graph", {});
    verifier("server-memory : une entité créée puis relue, rangée dans le carnet donné par l'environnement", rmem.ok && cree.ok && /Martin/.test(graphe.content) && existsSync(carnet) && readFileSync(carnet, "utf8").includes("Martin"), `${JSON.stringify(cree)} ${graphe.content?.slice(0, 200)}`);
    await mcp.retirerServeur("memoire");

    // HTTP « streamable » et SSE, puis un serveur distant qui redémarre (sa session est perdue).
    const portH = await portLibre();
    const portS = await portLibre();
    let http = await everythingHttp("streamableHttp", portH);
    aArreter.push(http);
    const sse = await everythingHttp("sse", portS);
    aArreter.push(sse);
    /*
     * En http sur la boucle, un serveur doit être déclaré `local`, avec son port
     * (mcp.ts, `adresseServeurPermise`, 29/09/2026) ; ici, tout écouteur est
     * accepté : c'est le serveur de référence lancé juste au-dessus.
     */
    const reconnu = async () => null;
    mcp.declarer({ id: "http", label: "HTTP", description: "", url: `http://127.0.0.1:${portH}/mcp`, local: { port: portH, reconnaitre: reconnu }, autoStart: false });
    mcp.declarer({ id: "sse", label: "SSE", description: "", url: `http://127.0.0.1:${portS}/sse`, local: { port: portS, reconnaitre: reconnu }, autoStart: false });
    const rh = await mcp.startServer("http");
    const rs = await mcp.startServer("sse");
    verifier("HTTP « streamable » : branché, outils listés", rh.ok && (statut("http")?.toolCount ?? 0) >= 10, JSON.stringify(rh));
    verifier("SSE (l'ancien transport) : le POST refusé, repli sur SSE à la même adresse, outils listés", rs.ok && (statut("sse")?.toolCount ?? 0) >= 10, JSON.stringify(rs));
    const eh = await mcp.callTool("http__echo", { message: "par http" });
    const es = await mcp.callTool("sse__echo", { message: "par sse" });
    verifier("tools/call par HTTP et par SSE", eh.ok && /par http/.test(eh.content) && es.ok && /par sse/.test(es.content), `${JSON.stringify(eh)} ${JSON.stringify(es)}`);

    await arreterNpx(http);
    http = await everythingHttp("streamableHttp", portH);
    aArreter.push(http);
    const apresRedemarrage = await mcp.callTool("http__echo", { message: "session neuve" });
    verifier("le serveur HTTP a redémarré (session inconnue de lui) : la session est rouverte et l'appel refait, il passe", apresRedemarrage.ok && /session neuve/.test(apresRedemarrage.content), JSON.stringify(apresRedemarrage));

    await arreterNpx(http);
    const coupe = await mcp.callTool("http__echo", { message: "coupé" });
    verifier("serveur HTTP injoignable : échec dit clairement, ses outils restent (pour l'appel suivant)", coupe.ok === false && /ne répond plus|injoignable|fetch failed/.test(coupe.content) && nomsModele("http").length > 0, JSON.stringify(coupe));
    http = await everythingHttp("streamableHttp", portH);
    aArreter.push(http);
    const revenu = await mcp.callTool("http__echo", { message: "revenu" });
    verifier("…et dès qu'il répond à nouveau, l'appel suivant passe, sans redémarrer la passerelle", revenu.ok && /revenu/.test(revenu.content), JSON.stringify(revenu));

    await arreterNpx(sse);
    const sse2 = await everythingHttp("sse", portS);
    aArreter.push(sse2);
    await attendre(500);
    let apresSse = await mcp.callTool("sse__echo", { message: "sse revenu" });
    // Le premier appel peut constater la coupure, pendant l'appel : le suivant doit passer.
    if (!apresSse.ok) apresSse = await mcp.callTool("sse__echo", { message: "sse revenu" });
    verifier("le serveur SSE a redémarré : la connexion est rouverte, l'appel passe", apresSse.ok && /sse revenu/.test(apresSse.content), JSON.stringify(apresSse));
    await mcp.retirerServeur("http");
    await mcp.retirerServeur("sse");
  } catch (err) {
    verifier("partie B sans exception", false, err?.stack ?? String(err));
  }
  for (const p of aArreter) await arreterNpx(p).catch(() => undefined);
}
console.error = erreurOrigine;
console.log = logOrigine;

/* ------------------------------------------------------------------------- */
/* Le faux web : serveur d'autorisation, MCP protégé, modèle                  */
/* ------------------------------------------------------------------------- */

const b64url = (b) => Buffer.from(b).toString("base64url");
const s256 = (v) => b64url(createHash("sha256").update(v).digest());
const RESSOURCE = "https://mcp.linear.app/mcp";
const EMETTEUR = "https://auth.essai.example";
const HOTES = ["mcp.linear.app", "auth.essai.example"];
/** Ce que le faux web a reçu : hôte, méthode, chemin, corps. */
const recues = [];
const inscrits = new Map();
const codes = new Map();
/** Jetons d'accès valables, et jetons d'actualisation valables (chacun ne sert qu'une fois : rotation). */
const acces = new Set();
const actualisations = new Set();
let compteur = 0;
/** Délai ajouté à chaque renouvellement de jeton (commande `/__lent`). */
let lenteurRenouvellement = 0;
/** Chaque demande reçue par le faux modèle. */
const auModele = [];

const json = (res, statut, corps, entetes = {}) => {
  res.writeHead(statut, { "Content-Type": "application/json", ...entetes });
  res.end(JSON.stringify(corps));
};
const texteDe = (m) => (typeof m?.content === "string" ? m.content : Array.isArray(m?.content) ? m.content.map((p) => p.text ?? "").join(" ") : "");

/**
 * Le faux modèle : la question porte son plan, `PLAN:[["outil",{…}],…]`. Il
 * appelle les outils dans l'ordre, un par tour, puis répond en recopiant les
 * résultats. Un outil qu'on ne lui a pas proposé, il le dit au lieu de l'appeler.
 */
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

function fauxModele(res, demande) {
  auModele.push(demande);
  const delta = { role: "assistant", ...decision(demande) };
  const fin = delta.tool_calls ? "tool_calls" : "stop";
  res.writeHead(200, { "Content-Type": "text/event-stream" });
  const morceau = (o) => res.write(`data: ${JSON.stringify({ id: "essai", object: "chat.completion.chunk", created: 1, model: demande.model, ...o })}\n\n`);
  morceau({ choices: [{ index: 0, delta }] });
  morceau({ choices: [{ index: 0, delta: {}, finish_reason: fin }] });
  morceau({ choices: [], usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 } });
  res.end("data: [DONE]\n\n");
}

/** Le faux MCP de Linear : JSON-RPC en réponse JSON, derrière un jeton porteur. */
function fauxLinear(req, res, corps) {
  const p = new URL(req.url, "http://faux").pathname;
  if (req.method === "GET" && p === "/.well-known/oauth-protected-resource/mcp") {
    return json(res, 200, { resource: RESSOURCE, authorization_servers: [EMETTEUR], bearer_methods_supported: ["header"] });
  }
  if (p !== "/mcp") return json(res, 404, { error: "not_found" });
  const porteur = /^Bearer (.+)$/.exec(String(req.headers.authorization ?? ""))?.[1];
  if (!porteur || !acces.has(porteur)) {
    return json(res, 401, { error: "invalid_token" }, { "WWW-Authenticate": `Bearer resource_metadata="https://mcp.linear.app/.well-known/oauth-protected-resource/mcp"` });
  }
  if (req.method !== "POST") return json(res, 405, { error: "method_not_allowed" });
  const m = JSON.parse(corps || "{}");
  if (m.id === undefined) {
    res.writeHead(202);
    return res.end();
  }
  if (m.method === "initialize") return json(res, 200, { jsonrpc: "2.0", id: m.id, result: { protocolVersion: m.params?.protocolVersion ?? "2025-06-18", capabilities: { tools: {} }, serverInfo: { name: "faux linear", version: "1" } } });
  if (m.method === "tools/list") return json(res, 200, { jsonrpc: "2.0", id: m.id, result: { tools: [{ name: "get_issue", description: "Lit un ticket Linear.", inputSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] } }] } });
  if (m.method === "tools/call") return json(res, 200, { jsonrpc: "2.0", id: m.id, result: { content: [{ type: "text", text: `Ticket ${m.params?.arguments?.id} : réparer la passerelle (REPERE-LINEAR)` }] } });
  return json(res, 200, { jsonrpc: "2.0", id: m.id, result: {} });
}

/** Le faux serveur d'autorisation : métadonnées, inscription, autorisation, jetons. */
function fauxAutorisation(req, res, corps) {
  const url = new URL(req.url, "http://faux");
  const p = url.pathname;
  if (req.method === "GET" && p === "/.well-known/oauth-authorization-server") {
    return json(res, 200, {
      issuer: EMETTEUR,
      authorization_endpoint: `${EMETTEUR}/authorize`,
      token_endpoint: `${EMETTEUR}/token`,
      registration_endpoint: `${EMETTEUR}/register`,
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code", "refresh_token"],
      code_challenge_methods_supported: ["S256"],
      token_endpoint_auth_methods_supported: ["client_secret_post", "client_secret_basic", "none"],
    });
  }
  if (req.method === "GET" && p.startsWith("/.well-known/")) return json(res, 404, { error: "not_found" });
  if (req.method === "POST" && p === "/register") {
    const meta = JSON.parse(corps || "{}");
    const client = { ...meta, client_id: `client-${++compteur}`, client_secret: `SECRET-CLIENT-${compteur}`, client_id_issued_at: Math.floor(Date.now() / 1000) };
    inscrits.set(client.client_id, client);
    return json(res, 201, client);
  }
  if (req.method === "GET" && p === "/authorize") {
    const q = url.searchParams;
    const client = inscrits.get(q.get("client_id") ?? "");
    if (!client || !client.redirect_uris?.includes(q.get("redirect_uri")) || q.get("code_challenge_method") !== "S256" || !q.get("code_challenge") || q.get("response_type") !== "code") {
      return json(res, 400, { error: "invalid_request" });
    }
    const code = `CODE-${++compteur}`;
    codes.set(code, { client: client.client_id, defi: q.get("code_challenge"), retour: q.get("redirect_uri"), ressource: q.get("resource") });
    res.writeHead(302, { Location: `${q.get("redirect_uri")}?code=${code}&state=${encodeURIComponent(q.get("state") ?? "")}` });
    return res.end();
  }
  if (req.method === "POST" && p === "/token") {
    const f = new URLSearchParams(corps);
    let clientId = f.get("client_id") ?? "";
    let secret = f.get("client_secret") ?? "";
    const basic = /^Basic (.+)$/.exec(String(req.headers.authorization ?? ""))?.[1];
    if (basic) [clientId, secret] = Buffer.from(basic, "base64").toString("utf8").split(":").map(decodeURIComponent);
    const client = inscrits.get(clientId);
    if (!client || client.client_secret !== secret) return json(res, 401, { error: "invalid_client" });
    if (f.get("grant_type") === "refresh_token") {
      if (!actualisations.delete(f.get("refresh_token") ?? "")) return json(res, 400, { error: "invalid_grant" });
    } else {
      const c = codes.get(f.get("code") ?? "");
      codes.delete(f.get("code") ?? "");
      if (!c || c.client !== clientId) return json(res, 400, { error: "invalid_grant" });
      if (s256(f.get("code_verifier") ?? "") !== c.defi) return json(res, 400, { error: "invalid_grant", error_description: "PKCE" });
      if (f.get("redirect_uri") !== c.retour) return json(res, 400, { error: "invalid_grant", error_description: "redirect_uri" });
    }
    const jeton = `ACCES-${++compteur}`;
    const actu = `ACTU-${compteur}`;
    acces.add(jeton);
    actualisations.add(actu);
    return json(res, 200, { access_token: jeton, token_type: "Bearer", expires_in: 3600, refresh_token: actu });
  }
  return json(res, 404, { error: "not_found" });
}

const fauxWeb = serveurHttp(async (req, res) => {
  const morceaux = [];
  for await (const m of req) morceaux.push(m);
  const corps = Buffer.concat(morceaux).toString("utf8");
  const url = new URL(req.url ?? "/", "http://faux");
  const hote = String(req.headers["x-hote"] ?? "");
  if (!hote) {
    if (url.pathname === "/v1/models") return json(res, 200, { object: "list", data: [{ id: "essai-outils", object: "model" }] });
    if (url.pathname === "/v1/chat/completions") return fauxModele(res, JSON.parse(corps || "{}"));
    // Commandes de l'essai : les jetons d'accès expirent, ou tout est révoqué.
    if (url.pathname === "/__expirer") return (acces.clear(), json(res, 200, {}));
    if (url.pathname === "/__revoquer") return (acces.clear(), actualisations.clear(), json(res, 200, {}));
    // Un renouvellement lent, pour que deux appels simultanés se croisent (28/09/2026).
    if (url.pathname === "/__lent") return ((lenteurRenouvellement = Number(url.searchParams.get("ms")) || 0), json(res, 200, {}));
    return json(res, 404, {});
  }
  recues.push({ hote, methode: req.method, chemin: url.pathname + url.search, corps });
  if (hote === "mcp.linear.app") return fauxLinear(req, res, corps);
  if (hote === "auth.essai.example") {
    if (lenteurRenouvellement && /grant_type=refresh_token/.test(corps)) await attendre(lenteurRenouvellement);
    return fauxAutorisation(req, res, corps);
  }
  return json(res, 404, {});
});
const PORT_FAUX = await portLibre();
await new Promise((ok) => fauxWeb.listen(PORT_FAUX, "127.0.0.1", ok));

/* ------------------------------------------------------------------------- */
/* La passerelle d'essai                                                      */
/* ------------------------------------------------------------------------- */

const PREALABLE = join(AUX, "prealable.mjs");
const SORTIES = join(AUX, "sorties-refusees.log");
// Ce qui part vers les hôtes de l'essai revient au faux web ; toute autre sortie est refusée, et notée.
writeFileSync(
  PREALABLE,
  `import { appendFileSync } from "node:fs";
const HOTES = new Set(${JSON.stringify(HOTES)});
const fetchOrigine = globalThis.fetch;
globalThis.fetch = async (entree, options = {}) => {
  const brute = typeof entree === "string" || entree instanceof URL ? String(entree) : entree.url;
  const a = new URL(brute);
  if (["127.0.0.1", "localhost", "[::1]"].includes(a.hostname)) return fetchOrigine(entree, options);
  if (a.protocol !== "https:" || !HOTES.has(a.hostname)) {
    appendFileSync(${JSON.stringify(SORTIES)}, a.href + "\\n");
    throw new TypeError("fetch failed (essai : aucune sortie vers " + a.hostname + ")");
  }
  let init = options;
  if (typeof entree === "object" && !(entree instanceof URL)) {
    init = { method: entree.method, headers: entree.headers, body: ["GET", "HEAD"].includes(entree.method) ? undefined : await entree.arrayBuffer(), ...options };
  }
  const entetes = new Headers(init.headers ?? {});
  entetes.set("x-hote", a.hostname);
  return fetchOrigine("http://127.0.0.1:${PORT_FAUX}" + a.pathname + a.search, { ...init, headers: entetes, redirect: "manual" });
};
`,
);
const ESPACE = join(AUX, "espace");
mkdirSync(ESPACE, { recursive: true });
// Les données de l'instance sont DANS le dossier de travail : c'est la zone protégée qu'on essaie d'atteindre en E.
const DONNEES = join(ESPACE, "donnees-instance");
const PROFIL = join(AUX, "profil.json");
writeFileSync(
  PROFIL,
  JSON.stringify({
    chiffrement: "fichier",
    // Le régime qui permet d'ajouter un serveur interne (un MCP personnalisé), posé par l'intégrateur.
    connecteursLibres: true,
    backends: [{ id: "lmstudio", enabled: false }, { id: "exo", enabled: false }, { id: "essai", label: "Essai", baseUrl: `http://127.0.0.1:${PORT_FAUX}/v1` }],
  }),
);

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
  };
  delete env.HELIX_MCP_DELAI_MS;
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
let compte = "";
async function ouvrirSeance(inst, creer) {
  const r = await fetch(`${inst.G}/helix/auth/${creer ? "create" : "verify"}`, { method: "POST", headers: inst.J, body: JSON.stringify(creer ? IDENTITE : { accountId: compte, password: IDENTITE.password }) });
  const corps = await r.json();
  if (creer) compte = corps.session?.userId ?? corps.account?.id ?? corps.user?.id ?? "";
  inst.A = { ...inst.J, "X-Helix-Session": corps.session?.token };
  return Boolean(corps.session?.token);
}
const api = async (inst, chemin, corps) => {
  const r = await fetch(`${inst.G}${chemin}`, corps === undefined ? { headers: inst.A } : { method: "POST", headers: inst.A, body: JSON.stringify(corps) });
  return { statut: r.status, ...(await r.json().catch(() => ({}))) };
};

/**
 * Une question au Chat, comme l'écran l'envoie, avec les outils. Pendant le
 * flux, les cartes d'approbation qui arrivent reçoivent la réponse de
 * `accorder(carte)` (true, false), comme si la personne cliquait.
 */
async function chat(inst, plan, accorder = () => true) {
  const enCours = fetch(`${inst.G}/v1/chat/completions`, {
    method: "POST",
    headers: inst.A,
    body: JSON.stringify({ model: "essai-outils", stream: true, tools: true, effort: "aucun", messages: [{ role: "user", content: `PLAN:${JSON.stringify(plan)}` }] }),
  }).then((r) => r.text());
  let fini = false;
  enCours.finally(() => (fini = true));
  const cartes = [];
  while (!fini) {
    const e = await api(inst, "/helix/approbation");
    for (const c of e.enAttente ?? []) {
      if (cartes.some((x) => x.id === c.id)) continue;
      cartes.push(c);
      await api(inst, "/helix/approbation/repondre", { id: c.id, accord: accorder(c) });
    }
    await attendre(150);
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
  return { texte, fins: evenements.filter((e) => e.type === "tool_end"), cartes, brut };
}

let passerelle = await lancerPasserelle();
const seance = await ouvrirSeance(passerelle, true);
if (!seance) verifier("la passerelle d'essai démarre et ouvre une séance", false, passerelle.journal.slice(-1500));

/* ------------------------------------------------------------------------- */
/* C. MCP distant avec OAuth                                                  */
/* ------------------------------------------------------------------------- */

console.log("\nC. MCP distant avec OAuth (faux Linear, faux serveur d'autorisation)");
try {
  const r = await api(passerelle, "/helix/connecteurs/connecter", { id: "linear" });
  const adresse = r.adresse ? new URL(r.adresse) : null;
  const q = adresse?.searchParams;
  verifier(
    "découverte : métadonnées de la ressource (RFC 9728) puis du serveur d'autorisation (RFC 8414), lues avant tout",
    recues.some((x) => x.hote === "mcp.linear.app" && x.chemin === "/.well-known/oauth-protected-resource/mcp") && recues.some((x) => x.hote === "auth.essai.example" && x.chemin === "/.well-known/oauth-authorization-server"),
    recues.map((x) => `${x.hote}${x.chemin}`),
  );
  const inscription = recues.find((x) => x.chemin === "/register");
  const meta = inscription ? JSON.parse(inscription.corps) : {};
  verifier(
    "inscription automatique (RFC 7591) : code d'autorisation et actualisation, adresse de retour de l'instance",
    meta.redirect_uris?.[0] === `${passerelle.G}/helix/oauth/retour` && meta.grant_types?.includes("refresh_token"),
    meta,
  );
  verifier(
    "page d'autorisation : chez le serveur d'autorisation, PKCE S256, state, ressource demandée",
    r.statut === 200 && adresse?.origin === EMETTEUR && q.get("code_challenge_method") === "S256" && (q.get("code_challenge") ?? "").length >= 43 && (q.get("state") ?? "").length >= 20 && q.get("resource") === RESSOURCE,
    JSON.stringify(r).slice(0, 400),
  );
  // Le navigateur de la personne : la page d'autorisation, puis le retour vers l'instance.
  const accord = await fetch(`http://127.0.0.1:${PORT_FAUX}${adresse.pathname}${adresse.search}`, { headers: { "x-hote": "auth.essai.example" }, redirect: "manual" });
  const retour = accord.headers.get("location");
  const retourInvente = retour.replace(/state=[^&]+/, "state=etat-invente");
  const refuse = await fetch(retourInvente);
  verifier("un retour dont le state n'est pas celui de la demande est refusé", refuse.status === 400, refuse.status);
  const page = await fetch(retour);
  const echange = recues.find((x) => x.chemin === "/token" && /grant_type=authorization_code/.test(x.corps));
  verifier("le bon retour aboutit : code échangé avec le vérificateur PKCE", page.status === 200 && Boolean(echange) && /code_verifier=/.test(echange.corps), `${page.status} ${echange?.corps}`);
  const etat = await api(passerelle, "/helix/connecteurs");
  const lin = (etat.installes ?? []).find((c) => c.id === "linear");
  verifier("Linear branché : en marche, un outil, autorisé", lin?.running && lin.toolCount === 1 && lin.distant && Boolean(lin.autoriseDepuis), lin);

  const c1 = await chat(passerelle, [["linear__get_issue", { id: "LIN-1" }]]);
  verifier("dans un Chat : carte d'approbation pour l'outil distant, acceptée, le ticket est lu par le jeton", c1.cartes.some((c) => c.detail?.outil === "linear__get_issue") && c1.fins[0]?.ok && /REPERE-LINEAR/.test(c1.texte), `${JSON.stringify(c1.fins)} ${c1.texte}`);

  // Le jeton d'accès expire : le serveur répond 401, l'instance le renouvelle et refait la demande.
  await fetch(`http://127.0.0.1:${PORT_FAUX}/__expirer`);
  const avantRenouv = recues.length;
  const c2 = await chat(passerelle, [["linear__get_issue", { id: "LIN-2" }]]);
  const renouv = recues.slice(avantRenouv).find((x) => x.chemin === "/token" && /grant_type=refresh_token/.test(x.corps));
  verifier("jeton d'accès expiré : renouvelé par le jeton d'actualisation, l'appel passe", Boolean(renouv) && c2.fins[0]?.ok && /LIN-2/.test(c2.texte), `${renouv?.corps} ${JSON.stringify(c2.fins)}`);

  /*
   * Deux Chats en même temps sur un jeton expiré (revue du 28/09/2026). Le
   * serveur d'autorisation fait tourner le jeton d'actualisation (un seul
   * usage), comme Atlassian ou Linear. Avant la correction, les deux appels
   * renouvelaient chacun avec le même jeton ; le second recevait
   * `invalid_grant`, et le SDK effaçait alors les jetons neufs que le premier
   * venait d'enregistrer : les deux appels échouaient, et le service restait
   * à reconnecter.
   */
  await fetch(`http://127.0.0.1:${PORT_FAUX}/__expirer`);
  await fetch(`http://127.0.0.1:${PORT_FAUX}/__lent?ms=800`);
  const avantCroise = recues.length;
  const [x1, x2] = await Promise.all([chat(passerelle, [["linear__get_issue", { id: "LIN-X1" }]]), chat(passerelle, [["linear__get_issue", { id: "LIN-X2" }]])]);
  await fetch(`http://127.0.0.1:${PORT_FAUX}/__lent?ms=0`);
  const renouvCroises = recues.slice(avantCroise).filter((x) => x.chemin === "/token" && /grant_type=refresh_token/.test(x.corps));
  verifier(
    "deux appels simultanés sur un jeton expiré : un seul renouvellement part, et les deux appels passent",
    renouvCroises.length === 1 && x1.fins[0]?.ok && /LIN-X1/.test(x1.texte) && x2.fins[0]?.ok && /LIN-X2/.test(x2.texte),
    `${renouvCroises.length} renouvellement(s) ; ${JSON.stringify(x1.fins)} ${JSON.stringify(x2.fins)}`,
  );
  const x3 = await chat(passerelle, [["linear__get_issue", { id: "LIN-X3" }]]);
  verifier("après ces deux appels, l'accès est toujours là : un troisième appel passe", x3.fins[0]?.ok && /LIN-X3/.test(x3.texte), JSON.stringify(x3.fins));

  // Redémarrage de la passerelle : tout est relu du magasin chiffré.
  passerelle.processus.kill("SIGTERM");
  await attendre(1500);
  await fetch(`http://127.0.0.1:${PORT_FAUX}/__expirer`);
  const avantRedem = recues.length;
  passerelle = await lancerPasserelle();
  await ouvrirSeance(passerelle, false);
  await jusqua(async () => ((await api(passerelle, "/helix/connecteurs")).installes ?? []).find((c) => c.id === "linear")?.running, 15000);
  const c3 = await chat(passerelle, [["linear__get_issue", { id: "LIN-3" }]]);
  const renouv2 = recues.slice(avantRedem).find((x) => x.chemin === "/token" && /grant_type=refresh_token/.test(x.corps));
  verifier("après redémarrage, jeton expiré : renouvelé avec l'inscription relue, l'outil passe", Boolean(renouv2) && c3.fins[0]?.ok && /LIN-3/.test(c3.texte), `${renouv2?.corps ?? "pas de renouvellement"} ${JSON.stringify(c3.fins)} ${passerelle.journal.slice(-600)}`);

  // Tout est révoqué chez le service : l'appel échoue en disant de reconnecter.
  await fetch(`http://127.0.0.1:${PORT_FAUX}/__revoquer`);
  const c4 = await chat(passerelle, [["linear__get_issue", { id: "LIN-4" }]]);
  verifier("accès révoqué chez le service : l'appel échoue et dit de reconnecter le service", c4.fins[0]?.ok === false && /reconnect/i.test(c4.fins[0]?.preview ?? ""), JSON.stringify(c4.fins));

  const ret = await api(passerelle, "/helix/connecteurs/retirer", { id: "linear" });
  const apres = await api(passerelle, "/helix/connecteurs");
  verifier("retiré : plus dans la liste, plus d'outil proposé", ret.ok && !(apres.installes ?? []).some((c) => c.id === "linear"), ret);
} catch (err) {
  verifier("partie C sans exception", false, err?.stack ?? String(err));
}

/* ------------------------------------------------------------------------- */
/* D. Un MCP personnalisé, comme l'écran s'en sert                            */
/* ------------------------------------------------------------------------- */

console.log("\nD. Un MCP personnalisé : ajouté, en ligne, utilisé dans un Chat, carte d'approbation, retiré");
try {
  const CARNET = join(AUX, "carnet.txt");
  const TRACE = join(AUX, "carnet-trace.txt");
  const ajout = await api(passerelle, "/helix/connecteurs/ajouter", { id: "carnet", label: "Carnet d'essai", command: process.execPath, args: [join(RACINE, "scripts", "mcp-essai.mjs"), CARNET, TRACE] });
  verifier("ajouté (instance qui autorise les serveurs internes) : démarré, deux outils", ajout.statut === 200 && ajout.ok && /2 outil/.test(ajout.message), ajout.message);
  const etat = await api(passerelle, "/helix/connecteurs");
  const carnet = (etat.installes ?? []).find((c) => c.id === "carnet");
  verifier("l'écran des connecteurs le voit : en ligne, hors catalogue, deux outils", carnet?.running && carnet.libre && carnet.toolCount === 2, carnet);
  const outils = await api(passerelle, "/helix/outils");
  verifier("le menu « Outils » du Chat le compte parmi les groupes actifs", (outils.groupes ?? []).some((g) => g.id === "carnet" && g.actif && g.outils === 2), outils.groupes?.map((g) => g.id));

  const oui = await chat(passerelle, [["carnet__noter", { texte: "acheter du pain" }]]);
  verifier(
    "Chat : le modèle appelle l'outil, une carte d'approbation le montre avec ses arguments, acceptée, l'outil est exécuté et le résultat affiché",
    oui.cartes.length === 1 && oui.cartes[0].detail?.outil === "carnet__noter" && /acheter du pain/.test(JSON.stringify(oui.cartes[0].detail)) && oui.fins[0]?.ok && /Note ajoutée/.test(oui.texte) && readFileSync(CARNET, "utf8").includes("acheter du pain"),
    `${JSON.stringify(oui.cartes)} ${JSON.stringify(oui.fins)} ${oui.texte}`,
  );
  const traceAvant = readFileSync(TRACE, "utf8");
  const non = await chat(passerelle, [["carnet__noter", { texte: "ne pas écrire" }]], () => false);
  verifier("carte refusée : l'outil n'est pas exécuté, l'échec est dit", non.cartes.length === 1 && non.fins[0]?.ok === false && readFileSync(TRACE, "utf8") === traceAvant && !readFileSync(CARNET, "utf8").includes("ne pas écrire"), `${JSON.stringify(non.fins)}`);

  // L'environnement d'un serveur lancé par la passerelle : ni ses clés, ni les nôtres.
  const TRACE_ESPION = join(AUX, "espion");
  await api(passerelle, "/helix/connecteurs/ajouter", { id: "espion", command: process.execPath, args: [FAUX, "base", TRACE_ESPION] });
  const vu = await chat(passerelle, [["espion__env", {}]]);
  const envVu = auModele.flatMap((d) => d.messages ?? []).filter((m) => m.role === "tool" && /"PATH"/.test(texteDe(m))).map(texteDe).at(-1) ?? "";
  verifier(
    "un serveur lancé par la passerelle ne reçoit ni les clés de la passerelle ni ses réglages (HELIX_*)",
    vu.fins[0]?.ok && envVu.length > 0 && !Object.values(FUITES).some((v) => envVu.includes(v)) && !/HELIX_/.test(envVu),
    envVu.slice(0, 300),
  );

  for (const [id, pourquoi] of [["a__b", "« __ »"], ["fin_", "souligné final"], ["courrier", "nom réservé"], ["fichiers", "serveur livré"], ["../x", "caractères"]]) {
    const r = await api(passerelle, "/helix/connecteurs/ajouter", { id, command: process.execPath, args: [FAUX, "base"] });
    verifier(`identifiant refusé (${pourquoi}) : ${id}`, r.statut === 400 && !r.ok, r.message);
  }

  const pidCarnet = Number(execFileSync("ps", ["-A", "-o", "pid=,command="], { encoding: "utf8" }).split("\n").find((l) => l.includes("mcp-essai.mjs") && l.includes(CARNET))?.trim().split(/\s+/)[0]);
  const retrait = await api(passerelle, "/helix/connecteurs/retirer", { id: "carnet" });
  await attendre(300);
  const apres = await api(passerelle, "/helix/connecteurs");
  const outilsApres = await api(passerelle, "/helix/outils");
  verifier(
    "retiré depuis l'écran : son processus est arrêté, il disparaît des connecteurs et du menu « Outils »",
    retrait.ok && pidCarnet > 0 && !vivant(pidCarnet) && !(apres.installes ?? []).some((c) => c.id === "carnet") && !(outilsApres.groupes ?? []).some((g) => g.id === "carnet"),
    `${retrait.message} pid ${pidCarnet} vivant=${vivant(pidCarnet)}`,
  );
  const plusLa = await chat(passerelle, [["carnet__noter", { texte: "après retrait" }]]);
  verifier("après le retrait, l'outil n'est plus proposé au modèle", /OUTIL-ABSENT carnet__noter/.test(plusLa.texte), plusLa.texte);
} catch (err) {
  verifier("partie D sans exception", false, err?.stack ?? String(err));
}

/* ------------------------------------------------------------------------- */
/* E. Les connecteurs intégrés sans compte                                    */
/* ------------------------------------------------------------------------- */

if (SANS_RESEAU) {
  console.log("\nE. Connecteurs intégrés : sautés (--sans-reseau, ils sont tirés par npx)");
} else {
  console.log("\nE. Connecteurs intégrés sans compte : fichiers, mémoire de travail, réflexion");
  try {
    const DEHORS = mkdtempSync(join(tmpdir(), "helix-essai-mcp-dehors-"));
    writeFileSync(join(DEHORS, "secret.txt"), "CONTENU-HORS-ESPACE");
    writeFileSync(join(ESPACE, "lisible.txt"), "CONTENU-DANS-ESPACE");
    symlinkSync(DEHORS, join(ESPACE, "lien-dehors"));
    const pret = await jusqua(async () => ((await api(passerelle, "/helix/outils")).groupes ?? []).some((g) => g.id === "fichiers" && g.actif), 60000);
    verifier("le serveur de fichiers est en marche", pret, JSON.stringify((await api(passerelle, "/helix/outils")).groupes?.find((g) => g.id === "fichiers")));
    const lire = (chemin) => ["fichiers__read_text_file", { path: chemin }];
    const f = await chat(passerelle, [lire(join(ESPACE, "lisible.txt")), lire(join(ESPACE, "..", "..", DEHORS.split("/").pop())), lire(join(DEHORS, "secret.txt")), lire(join(ESPACE, "lien-dehors", "secret.txt")), lire(join(DONNEES, "instance-token"))]);
    const [dans, remonte, absolu, lien, protege] = f.fins;
    verifier("dans l'espace de travail : lu, sans carte (lecture)", dans?.ok && f.cartes.length === 0 && /CONTENU-DANS-ESPACE/.test(f.texte), JSON.stringify(dans));
    verifier("« .. » pour sortir de l'espace : refusé", remonte?.ok === false, JSON.stringify(remonte));
    verifier("chemin absolu hors de l'espace : refusé, avec l'explication du dossier ouvert", absolu?.ok === false && /hors des emplacements|protégé|denied/i.test(absolu.preview ?? ""), JSON.stringify(absolu));
    verifier("lien symbolique dans l'espace qui mène dehors : refusé", lien?.ok === false, JSON.stringify(lien));
    verifier("données de l'instance (jeton), même dans l'espace : refusé comme zone protégée", protege?.ok === false && /protégé/.test(protege.preview ?? ""), JSON.stringify(protege));
    verifier("rien de ce qui est dehors, ni le jeton de l'instance, n'est arrivé au modèle", !/CONTENU-HORS-ESPACE/.test(JSON.stringify(auModele.slice(-6))) && !JSON.stringify(auModele.slice(-6)).includes(readFileSync(join(DONNEES, "instance-token"), "utf8").trim()), "fuite");

    const mem = await api(passerelle, "/helix/connecteurs/ajouter", { id: "memoire" });
    verifier("mémoire de travail branchée depuis le catalogue (sans compte)", mem.statut === 200 && mem.ok, mem.message);
    const m = await chat(passerelle, [["memoire__create_entities", { entities: [{ name: "Client Martin", entityType: "client", observations: ["préfère être appelé le matin"] }] }], ["memoire__read_graph", {}]]);
    verifier("mémoire : écrire passe par une carte, puis relire rend l'entité", m.cartes.some((c) => c.detail?.outil === "memoire__create_entities") && m.fins.every((x) => x.ok) && /Client Martin/.test(m.texte), `${JSON.stringify(m.fins)} ${m.texte.slice(0, 200)}`);
    verifier("le carnet de la mémoire est dans le dossier de données de l'instance, pas dans le cache de npx", existsSync(join(DONNEES, "memoire.jsonl")) && readFileSync(join(DONNEES, "memoire.jsonl"), "utf8").includes("Client Martin"), existsSync(join(DONNEES, "memoire.jsonl")));

    const ref = await api(passerelle, "/helix/connecteurs/ajouter", { id: "reflexion" });
    const rr = await chat(passerelle, [["reflexion__sequentialthinking", { thought: "Découper la question en deux.", thoughtNumber: 1, totalThoughts: 1, nextThoughtNeeded: false }]]);
    verifier("réflexion par étapes : branchée, une étape enregistrée", ref.ok && rr.fins[0]?.ok && /thoughtNumber|1/.test(rr.texte), `${ref.message} ${JSON.stringify(rr.fins)}`);
  } catch (err) {
    verifier("partie E sans exception", false, err?.stack ?? String(err));
  }
}

/* ------------------------------------------------------------------------- */
/* Arrêt de la passerelle : aucun orphelin                                    */
/* ------------------------------------------------------------------------- */

console.log("\nF. Arrêt de la passerelle");
try {
  const TRACE_O = join(AUX, "orphelin-passerelle");
  const r = await api(passerelle, "/helix/connecteurs/ajouter", { id: "orphelin", command: process.execPath, args: [FAUX, "orphelin", TRACE_O] });
  const pid = pidDe(TRACE_O);
  const enfant = Number(readFileSync(`${TRACE_O}.enfant`, "utf8"));
  const tous = descendantsDe(passerelle.processus.pid).map((d) => d.pid);
  passerelle.processus.kill("SIGTERM");
  await attendre(2500);
  const restes = [...tous, pid, enfant].filter(vivant);
  verifier("à l'arrêt de la passerelle (SIGTERM), aucun serveur MCP ni rien de ce qu'ils ont lancé ne reste, même ce qui ignore SIGTERM", r.ok && restes.length === 0, `${r.message} restes : ${restes.join(",")}`);
  for (const p of restes) process.kill(p, "SIGKILL");
  // Hors du registre npm (la passerelle y lit la version d'OpenClaw, sans rapport avec les connecteurs).
  const sorties = (existsSync(SORTIES) ? readFileSync(SORTIES, "utf8").trim().split("\n") : []).filter((l) => l && !l.startsWith("https://registry.npmjs.org/"));
  verifier("aucune sortie réseau des connecteurs hors des hôtes de l'essai", sorties.length === 0, sorties.join(" "));
  verifier("aucun jeton d'accès ni secret d'inscription dans la sortie de la passerelle", !/ACCES-\d|ACTU-\d|SECRET-CLIENT/.test(passerelle.journal), passerelle.journal.match(/ACCES-\d+|ACTU-\d+|SECRET-CLIENT-\d+/)?.[0]);
} catch (err) {
  verifier("partie F sans exception", false, err?.stack ?? String(err));
}

// Une partie interrompue avant l'arrêt ne laisse pas la passerelle d'essai tourner derrière elle.
if (passerelle.processus.exitCode === null && passerelle.processus.signalCode === null) {
  passerelle.processus.kill("SIGTERM");
  await attendre(1500);
}
fauxWeb.close();
console.log(`\n${reussis} vérification(s) réussie(s), ${echecs.length} échec(s).`);
if (echecs.length) console.log(`Échecs :\n - ${echecs.join("\n - ")}`);
process.exit(echecs.length ? 1 : 0);
