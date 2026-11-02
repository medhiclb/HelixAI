/*
 * L'application LM Studio (ou Bionic) qui s'ouvrait toute seule (signalé le
 * 23/10/2026) : de bout en bout contre une passerelle jetable.
 *
 *   node scripts/essai-moteur-lmstudio.mjs   (lancé aussi par npm run securite, section 53)
 *
 * Tout vit dans un dossier temporaire : dossier personnel neuf, données neuves,
 * une « application LM Studio » déclarée (`app-install-location.json` vers un
 * faux `LM Studio.app`), un faux `lms` qui note chaque commande et, quand on
 * lui demande de démarrer quelque chose, fait « tourner » le faux service ; un
 * faux service de LM Studio (`/lms-status`, sur un port d'essai donné par
 * `HELIX_PORTS_SERVICE_LMSTUDIO`) et un faux serveur compatible OpenAI. Aucun
 * vrai LM Studio (ni ~/.lmstudio, ni les ports 1234 et 41343), aucun réseau.
 *
 * A. Application déclarée, fermée, rien de choisi : aucune commande `lms`, l'écran le dit.
 * B. Le service tourne (ouvert par la personne) : Helix s'y branche, rien de ce qui démarre.
 * C. « Application » choisie par l'administrateur : Helix la démarre, comme avant.
 * D. « Sans fenêtre » choisi : le moteur est à poser ; une fois llmster déclaré, c'est lui qu'on lève.
 */
import { spawn } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { createServer as serveurHttp } from "node:http";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const RACINE = join(dirname(fileURLToPath(import.meta.url)), "..");
let reussis = 0;
const echecs = [];
const verifier = (nom, ok, obtenu) => {
  if (ok) {
    reussis++;
    console.log(`  ✓ ${nom}`);
  } else {
    echecs.push(nom);
    console.log(`  ✗ ${nom}  —  obtenu : ${String(obtenu).slice(0, 400)}`);
  }
};
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
const portLibre = () =>
  new Promise((ok) => {
    const s = createServer();
    s.listen(0, "127.0.0.1", () => {
      const { port } = s.address();
      s.close(() => ok(port));
    });
  });

const TMP = realpathSync(mkdtempSync(join(tmpdir(), "helix-essai-moteur-lmstudio-")));
const MAISON = join(TMP, "maison");
const BIN = join(TMP, "bin");
const DONNEES = join(TMP, "donnees");
const APPS = join(TMP, "Applications");
const LMSTUDIO = join(MAISON, ".lmstudio");
const APPELS = join(TMP, "lms-appels.log");
// Présent : le faux service « tourne » (écrit par le faux `lms` quand il démarre quelque chose, ou par l'essai).
const EN_MARCHE = join(TMP, "service-en-marche");
for (const d of [MAISON, BIN, DONNEES, join(TMP, "espace"), join(APPS, "LM Studio.app"), join(LMSTUDIO, "bin"), join(LMSTUDIO, ".internal"), join(LMSTUDIO, "models")]) mkdirSync(d, { recursive: true });
writeFileSync(APPELS, "");
// L'application de bureau, déclarée comme après son premier lancement (lmstudio-js, findOrStartLlmster.ts).
writeFileSync(join(LMSTUDIO, ".internal", "app-install-location.json"), JSON.stringify({ path: join(APPS, "LM Studio.app"), argv: [], cwd: MAISON }));
writeFileSync(
  join(LMSTUDIO, "bin", "lms"),
  `#!${process.execPath}
const fs = require("node:fs");
const a = process.argv.slice(2);
fs.appendFileSync(${JSON.stringify(APPELS)}, a.join(" ") + "\\n");
const json = a.includes("--json");
// Comme le vrai : démarrer, c'est faire tourner le service (ici, le fichier que lisent les faux serveurs).
if ((a[0] === "server" && a[1] === "start") || (a[0] === "daemon" && a[1] === "up")) { fs.writeFileSync(${JSON.stringify(EN_MARCHE)}, "1"); process.exit(0); }
if (a[0] === "server" && a[1] === "status") { console.log(JSON.stringify({ running: fs.existsSync(${JSON.stringify(EN_MARCHE)}) })); process.exit(0); }
if (a[0] === "daemon" && a[1] === "status") { console.log(JSON.stringify({ status: fs.existsSync(${JSON.stringify(EN_MARCHE)}) ? "running" : "stopped" })); process.exit(0); }
if (a[0] === "version") { console.log("lms 0.0.47 (essai)"); process.exit(0); }
if (a[0] === "ls" || a[0] === "ps") { console.log(json ? "[]" : ""); process.exit(0); }
process.exit(0);
`,
);
chmodSync(join(LMSTUDIO, "bin", "lms"), 0o755);
for (const [nom, corps] of [
  ["security", "#!/bin/sh\nexit 44\n"],
  ["opencode", "#!/bin/sh\necho 1.18.32\n"],
  ["rtk", "#!/bin/sh\necho rtk 0.50.0\n"],
  // `open` ne doit jamais servir à lancer l'application : noté s'il est appelé.
  ["open", `#!/bin/sh\necho "open $@" >> "${APPELS}"\n`],
]) {
  writeFileSync(join(BIN, nom), corps);
  chmodSync(join(BIN, nom), 0o755);
}
writeFileSync(join(TMP, "profil.json"), JSON.stringify({ chiffrement: "fichier" }));
const PREALABLE = join(TMP, "prealable.mjs");
writeFileSync(
  PREALABLE,
  `const fetchOrigine = globalThis.fetch;
globalThis.fetch = async (entree, options) => {
  const a = new URL(typeof entree === "string" || entree instanceof URL ? String(entree) : entree.url);
  if (["127.0.0.1", "localhost", "[::1]"].includes(a.hostname)) return fetchOrigine(entree, options);
  throw new TypeError("fetch failed (essai : aucune sortie vers " + a.hostname + ")");
};
`,
);

const enMarche = () => existsSync(EN_MARCHE);
// Le faux serveur compatible OpenAI : un modèle, seulement quand le service tourne.
const faux = serveurHttp((req, res) => {
  req.resume();
  if (!enMarche()) {
    res.writeHead(503);
    res.end();
    return;
  }
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify(req.url?.endsWith("/models") ? { data: [{ id: "qwen/qwen3-4b", object: "model" }] } : {}));
});
// Le faux service de LM Studio : ce que `lms` interroge avant de rien lancer.
const service = serveurHttp((req, res) => {
  req.resume();
  if (!enMarche() || req.url !== "/lms-status") {
    res.writeHead(404);
    res.end();
    return;
  }
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ package: "essai", version: "0.0.0" }));
});
const portLms = await portLibre();
const portService = await portLibre();
await new Promise((ok) => faux.listen(portLms, "127.0.0.1", ok));
await new Promise((ok) => service.listen(portService, "127.0.0.1", ok));

const port = await portLibre();
const G = `http://127.0.0.1:${port}`;
let journal = "";
const passerelle = spawn(process.execPath, ["--import", PREALABLE, join(RACINE, "gateway", "src", "index.ts")], {
  env: {
    PATH: [BIN, "/usr/bin", "/bin", "/usr/sbin", "/sbin"].join(":"),
    HOME: MAISON,
    USERPROFILE: MAISON,
    LANG: "C",
    HTTPS_PROXY: "http://127.0.0.1:9",
    HTTP_PROXY: "http://127.0.0.1:9",
    HELIX_CONFIG: join(TMP, "profil.json"),
    HELIX_DATA_DIR: DONNEES,
    HELIX_GATEWAY_PORT: String(port),
    HELIX_WORKSPACE: join(TMP, "espace"),
    HELIX_MOTEUR: "lmstudio",
    HELIX_LMSTUDIO_URL: `http://127.0.0.1:${portLms}/v1`,
    HELIX_PORTS_SERVICE_LMSTUDIO: String(portService),
    HELIX_EXO_URL: "http://127.0.0.1:9/v1",
    HELIX_APPS_DIR: APPS,
    HELIX_OPENCODE_BIN: join(BIN, "opencode"),
    HELIX_RTK_BIN: join(BIN, "rtk"),
  },
  stdio: ["ignore", "pipe", "pipe"],
});
passerelle.stdout.on("data", (b) => (journal += b));
passerelle.stderr.on("data", (b) => (journal += b));

const appels = () => readFileSync(APPELS, "utf8").split("\n").filter(Boolean);
// Ce qui ferait démarrer un moteur (`lms` lance le service déclaré pour toute commande qui en a besoin quand rien ne tourne).
const demarre = (l) => /^(server start|daemon up)/.test(l) || l.startsWith("open ");

try {
  let JETON = "";
  for (let i = 0; i < 160 && !JETON; i++) {
    try {
      await fetch(`${G}/health`);
      JETON = readFileSync(join(DONNEES, "instance-token"), "utf8").trim();
    } catch {
      await attendre(250);
    }
  }
  if (!JETON) throw new Error(`passerelle muette :\n${journal.slice(-2000)}`);
  const entetes = (seance) => ({ "Content-Type": "application/json", Authorization: `Bearer ${JETON}`, "X-Helix-Langue": "fr", ...(seance ? { "X-Helix-Session": seance } : {}) });
  const appel = async (chemin, seance, corps) => {
    const r = await fetch(`${G}${chemin}`, corps === undefined ? { headers: entetes(seance) } : { method: "POST", headers: entetes(seance), body: JSON.stringify(corps) });
    return { statut: r.status, json: await r.json().catch(() => ({})) };
  };
  // Le suivi répond pendant le réveil depuis le 02/11/2026 : attendre le modèle,
  // pas une durée arbitraire ni le premier instantané encore en cours de démarrage.
  const provisionPrete = async (seance) => {
    let etat = {};
    for (let i = 0; i < 100; i++) {
      etat = (await appel("/helix/provision", seance)).json;
      if (etat.hasChatModel) return etat;
      await attendre(100);
    }
    return etat;
  };
  // Compte d'essai sur la passerelle jetable (valeurs d'essai).
  const admin = await appel("/helix/auth/create", null, { fullName: "Admin Essai", email: "admin@example.test", password: "Admin2Essai!Solide42" });
  const seance = admin.json.session?.token ?? "";

  console.log("A. Application déclarée, fermée, rien de choisi");
  const a1 = (await appel("/helix/provision", seance)).json;
  await appel("/helix/provision", seance);
  await fetch(`${G}/health`).catch(() => undefined);
  await attendre(500);
  verifier("aucune commande `lms` lancée, pas même `lms version` (rien qui réveille l'application)", appels().length === 0, appels().join(" | "));
  verifier("l'écran de mise en route le sait : LM Studio fermé, moteur bien installé (rien à retélécharger)", a1.lmStudioFerme === true && a1.moteurInstalle === true, JSON.stringify({ ferme: a1.lmStudioFerme, installe: a1.moteurInstalle }));
  const etatA = await appel("/helix/moteur-lmstudio", seance);
  verifier("l'état du moteur : application déclarée, pas de llmster, aucun choix, service arrêté", etatA.statut === 200 && etatA.json.concerne === true && etatA.json.applicationDeclaree === true && etatA.json.llmsterDeclare === false && etatA.json.choix === null && etatA.json.serviceEcoute === false && etatA.json.admin === true, JSON.stringify(etatA.json));
  const miseEnRoute = await appel("/helix/provision/start", seance, {});
  let finA = {};
  for (let i = 0; i < 40; i++) {
    finA = (await appel("/helix/provision", seance)).json.state ?? {};
    if (["ready", "error"].includes(finA.phase)) break;
    await attendre(250);
  }
  verifier("une mise en route demandée dit « L'application LM Studio est fermée », sans rien lancer", miseEnRoute.statut === 202 && finA.phase === "error" && /application LM Studio est fermée/.test(finA.message ?? "") && appels().length === 0, `${miseEnRoute.statut} ${JSON.stringify(finA)} ${appels().join(" | ")}`);
  const sansSeanceEtat = await appel("/helix/moteur-lmstudio", null);
  const sansSeanceChoix = await appel("/helix/moteur-lmstudio", null, { choix: "application" });
  verifier("sans séance, ni l'état ni le choix (401)", sansSeanceEtat.statut === 401 && sansSeanceChoix.statut === 401, `${sansSeanceEtat.statut} ${sansSeanceChoix.statut}`);
  const inconnu = await appel("/helix/moteur-lmstudio", seance, { choix: "autre" });
  verifier("un choix inconnu est refusé (400), rien n'est retenu", inconnu.statut === 400 && (await appel("/helix/moteur-lmstudio", seance)).json.choix === null, `${inconnu.statut}`);

  console.log("B. Le service tourne déjà (LM Studio ouvert par la personne)");
  writeFileSync(EN_MARCHE, "1");
  writeFileSync(APPELS, "");
  const b1 = (await appel("/helix/provision", seance)).json;
  await appel("/helix/provision", seance);
  verifier("Helix s'y branche : le modèle de LM Studio est vu, plus d'écran « fermé »", b1.lmStudioFerme === false && b1.hasChatModel === true, JSON.stringify({ ferme: b1.lmStudioFerme, chat: b1.hasChatModel }));
  verifier("aucune commande qui démarre (`server start`, `daemon up`, `open`) ; seulement des lectures", appels().length > 0 && !appels().some(demarre), appels().join(" | "));

  console.log("C. « Application LM Studio » choisie par l'administrateur");
  unlinkSync(EN_MARCHE);
  writeFileSync(APPELS, "");
  const c0 = await appel("/helix/moteur-lmstudio", seance, { choix: "application" });
  verifier("le choix est retenu (200)", c0.statut === 200 && c0.json.choix === "application", `${c0.statut} ${JSON.stringify(c0.json)}`);
  const c1 = await provisionPrete(seance);
  verifier("Helix démarre alors le service de l'application (`lms server start`), comme avant le 23/10/2026", appels().some((l) => l.startsWith("server start")) && c1.hasChatModel === true && c1.lmStudioFerme === false, `${appels().join(" | ")} ${JSON.stringify({ chat: c1.hasChatModel })}`);
  verifier("jamais par `open` (l'application n'est pas ouverte à la main)", !appels().some((l) => l.startsWith("open ")), appels().join(" | "));
  verifier("rangé dans les réglages de l'instance (collection `reglages`, chiffrée)", existsSync(join(DONNEES, "reglages.json")), "reglages.json absent");

  console.log("D. « Moteur sans fenêtre » choisi");
  unlinkSync(EN_MARCHE);
  writeFileSync(APPELS, "");
  const d0 = await appel("/helix/moteur-lmstudio", seance, { choix: "sansFenetre" });
  const d1 = (await appel("/helix/provision", seance)).json;
  verifier("tant que llmster n'est pas posé : le moteur est « à installer », aucune commande lancée", d0.statut === 200 && d1.moteurInstalle === false && d1.lmStudioFerme === false && appels().length === 0, `${d0.statut} ${JSON.stringify({ installe: d1.moteurInstalle, ferme: d1.lmStudioFerme })} ${appels().join(" | ")}`);
  // llmster déclaré, comme après `llmster bootstrap` (engine.ts) : `lms` le préfère à l'application.
  mkdirSync(join(LMSTUDIO, "llmster"), { recursive: true });
  writeFileSync(join(LMSTUDIO, ".internal", "llmster-install-location.json"), JSON.stringify({ path: join(LMSTUDIO, "llmster"), argv: [], cwd: MAISON }));
  await appel("/helix/moteur-lmstudio", seance, { choix: "sansFenetre" });
  const d2 = await provisionPrete(seance);
  const etatD = (await appel("/helix/moteur-lmstudio", seance)).json;
  verifier("llmster déclaré : moteur installé, et c'est le moteur sans interface qui est levé (`lms daemon up`)", d2.moteurInstalle === true && appels().some((l) => l.startsWith("daemon up")) && etatD.llmsterDeclare === true, `${JSON.stringify({ installe: d2.moteurInstalle })} ${appels().join(" | ")}`);
  verifier("jamais par `open`", !appels().some((l) => l.startsWith("open ")), appels().join(" | "));
} catch (err) {
  echecs.push(String(err));
  console.log(`  ✗ ${err instanceof Error ? err.stack : err}`);
} finally {
  const fin = new Promise((r) => passerelle.once("exit", r));
  passerelle.kill("SIGTERM");
  await Promise.race([fin, attendre(10_000)]);
  if (passerelle.exitCode === null) passerelle.kill("SIGKILL");
  faux.close();
  service.close();
  if (echecs.length && process.env.HELIX_ESSAI_BAVARD) console.log(journal.slice(-4000));
  await attendre(1000);
  try {
    rmSync(TMP, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 });
  } catch (err) {
    console.log(`  (dossier temporaire laissé : ${TMP}, ${err instanceof Error ? err.message : err})`);
  }
}
console.log(`\n${reussis} vérification(s) réussie(s), ${echecs.length} échec(s).`);
process.exit(echecs.length ? 1 : 0);
