/*
 * Test d'intrusion final de la 2026.928.6 (28/09/2026, SECURITE.md § 58) :
 * les trois failles trouvées, rejouées contre des passerelles jetables.
 *
 *   node scripts/essai-intrusion-928-6.mjs      (lancé aussi par npm run securite, section 25)
 *
 * Tout vit dans un dossier temporaire : dossier personnel neuf, données
 * neuves, faux `security`, faux `lms`, faux fichiers du moteur ouvert. Aucun
 * vrai LM Studio, aucun vrai llama-server, aucun réseau.
 *
 * A. Déplacer un dossier qui contient une zone protégée (serveur de fichiers).
 * B. Emplacement des modèles : un sous-dossier `LM Studio` ou
 *    `modeles-llamacpp` déjà posé en lien symbolique.
 * C. Moteur ouvert : un autre programme sur son port ne reçoit ni la clé ni
 *    les Chats ; un serveur resté de Helix (le même fichier exécuté) est arrêté et remplacé.
 */
import { spawn, spawnSync } from "node:child_process";
import { chmodSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { createServer as serveurTcp } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const RACINE = join(dirname(fileURLToPath(import.meta.url)), "..");
const portLibre = () =>
  new Promise((ok) => {
    const s = serveurTcp();
    s.listen(0, "127.0.0.1", () => {
      const { port } = s.address();
      s.close(() => ok(port));
    });
  });
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));

const TMP = realpathSync(mkdtempSync(join(tmpdir(), "helix-essai-intrusion-")));
const MAISON = join(TMP, "maison");
const BIN = join(TMP, "bin");
const ESPACE = join(TMP, "espace-agents");
const DISQUE = join(TMP, "disque-d");
for (const d of [MAISON, BIN, ESPACE, DISQUE, join(TMP, "Applications")]) mkdirSync(d, { recursive: true });
for (const [nom, corps] of [["security", "exit 44"], ["lms", "exit 1"], ["opencode", "echo 1.18.32"], ["rtk", "echo rtk 0.50.0"]]) {
  writeFileSync(join(BIN, nom), `#!/bin/sh\n${corps}\n`);
  chmodSync(join(BIN, nom), 0o755);
}
writeFileSync(join(TMP, "profil.json"), JSON.stringify({ chiffrement: "fichier" }));
const PATH = [BIN, "/usr/bin", "/bin", "/usr/sbin", "/sbin"].join(":");

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

let passerelle = null;
let G = "";
let JETON = "";
async function demarrer(donnees, env = {}) {
  const port = await portLibre();
  G = `http://127.0.0.1:${port}`;
  mkdirSync(donnees, { recursive: true });
  let journal = "";
  passerelle = spawn(process.execPath, [join(RACINE, "gateway", "src", "index.ts")], {
    env: {
      PATH,
      HOME: MAISON,
      USERPROFILE: MAISON,
      LANG: "C",
      HELIX_CONFIG: join(TMP, "profil.json"),
      HELIX_DATA_DIR: donnees,
      HELIX_GATEWAY_PORT: String(port),
      HELIX_WORKSPACE: ESPACE,
      HELIX_LLAMACPP_PORT: String(await portLibre()),
      HELIX_LMSTUDIO_URL: "http://127.0.0.1:9/v1",
      HELIX_EXO_URL: "http://127.0.0.1:9/v1",
      HELIX_APPS_DIR: join(TMP, "Applications"),
      HELIX_OPENCODE_BIN: join(BIN, "opencode"),
      HELIX_RTK_BIN: join(BIN, "rtk"),
      ...env,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  passerelle.stdout.on("data", (b) => (journal += b));
  passerelle.stderr.on("data", (b) => (journal += b));
  for (let i = 0; i < 160; i++) {
    try {
      await fetch(`${G}/health`);
      JETON = readFileSync(join(donnees, "instance-token"), "utf8").trim();
      return () => journal;
    } catch {
      await attendre(250);
    }
  }
  throw new Error(`passerelle muette :\n${journal.slice(-2000)}`);
}
async function arreter() {
  if (!passerelle || passerelle.exitCode !== null) return;
  const lui = passerelle;
  const fin = new Promise((r) => lui.once("exit", r));
  lui.kill("SIGTERM");
  await Promise.race([fin, attendre(10_000)]);
  if (lui.exitCode === null) lui.kill("SIGKILL");
}
const entetes = (seance) => ({ "Content-Type": "application/json", Authorization: `Bearer ${JETON}`, "X-Helix-Langue": "fr", ...(seance ? { "X-Helix-Session": seance } : {}) });
const appel = async (chemin, seance, corps) => {
  const r = await fetch(`${G}${chemin}`, corps === undefined ? { headers: entetes(seance) } : { method: "POST", headers: entetes(seance), body: JSON.stringify(corps) });
  return { statut: r.status, json: await r.json().catch(() => ({})) };
};
const administrateur = async () => (await appel("/helix/auth/create", null, { fullName: "Admin Essai", email: "admin@example.test", password: "Admin2Essai!Solide42" })).json.session?.token ?? "";

const intrus = [];
try {
  /* ── A. Déplacer un dossier qui contient une zone ─────────────────────── */
  console.log("A. Serveur de fichiers : déplacer un dossier qui contient une zone protégée");
  {
    const code = `
      const z = await import(${JSON.stringify(join(RACINE, "gateway", "src", "zonesProtegees.ts"))});
      const m = ${JSON.stringify(MAISON)};
      console.log(JSON.stringify({
        parentSource: z.cheminProtegeDans({ source: m + "/.local", destination: m + "/ailleurs" }, m),
        parentDestination: z.cheminProtegeDans({ source: m + "/prepare", destination: m + "/.cache" }, m),
        ordinaire: z.cheminProtegeDans({ source: m + "/Documents/a.txt", destination: m + "/Documents/b.txt" }, m),
        lectureMaison: z.cheminProtegeDans({ path: m }, m),
      }));`;
    const r = spawnSync(process.execPath, ["--input-type=module", "-e", code], {
      env: { PATH, HOME: MAISON, HELIX_DATA_DIR: join(TMP, "donnees-a"), HELIX_CONFIG: join(TMP, "profil.json") },
      encoding: "utf8",
    });
    let v = {};
    try {
      v = JSON.parse(r.stdout.trim().split("\n").pop());
    } catch {
      /* dit ci-dessous */
    }
    verifier("déplacer ~/.local (qui contient ~/.local/share/opencode) : refusé", typeof v.parentSource === "string", r.stdout + r.stderr);
    verifier("déplacer un dossier préparé vers ~/.cache (qui ferait naître ~/.cache/lm-studio) : refusé", typeof v.parentDestination === "string", r.stdout + r.stderr);
    verifier("déplacer un document ordinaire : permis", v.ordinaire === null, r.stdout + r.stderr);
    verifier("lister le dossier personnel (qui contient des zones) : toujours permis", v.lectureMaison === null, r.stdout + r.stderr);
  }

  /* ── B. Sous-dossier déjà posé en lien symbolique ────────────────────── */
  console.log("B. Emplacement des modèles : sous-dossier déjà posé en lien symbolique");
  {
    await demarrer(join(TMP, "donnees-b"), { HELIX_MOTEUR: "lmstudio" });
    const admin = await administrateur();
    mkdirSync(join(ESPACE, "cible"), { recursive: true });
    symlinkSync(join(ESPACE, "cible"), join(DISQUE, "LM Studio"));
    const r = await appel("/helix/emplacement-modeles", admin, { dossier: DISQUE });
    const pointeur = join(MAISON, ".lmstudio-home-pointer");
    verifier("LM Studio : `LM Studio` lien vers l'espace des agents, refusé (400), aucun pointeur", r.statut === 400 && /lien symbolique/.test(r.json.error?.message ?? "") && !existsSync(pointeur), `${r.statut} ${JSON.stringify(r.json)}`);
    // Un pointeur écrit à la main vers ce lien n'est pas suivi : `lms` ne se lance pas depuis l'espace des agents.
    writeFileSync(pointeur, join(DISQUE, "LM Studio"));
    const e = await appel("/helix/emplacement-modeles", admin);
    verifier("un pointeur vers un lien n'est pas suivi par la passerelle", e.json.dossier !== join(DISQUE, "LM Studio") || e.json.introuvable === true, JSON.stringify(e.json).slice(0, 300));
    rmSync(pointeur, { force: true });
    rmSync(join(DISQUE, "LM Studio"), { force: true });
    await arreter();

    const donnees = join(TMP, "donnees-c");
    await demarrer(donnees, { HELIX_MOTEUR: "llamacpp" });
    const admin2 = await administrateur();
    mkdirSync(join(donnees, "vide"), { recursive: true });
    symlinkSync(join(donnees, "vide"), join(DISQUE, "modeles-llamacpp"));
    const r2 = await appel("/helix/emplacement-modeles", admin2, { dossier: DISQUE });
    verifier("llama.cpp : `modeles-llamacpp` lien vers les données de l'instance, refusé (400)", r2.statut === 400 && /lien symbolique/.test(r2.json.error?.message ?? ""), `${r2.statut} ${JSON.stringify(r2.json)}`);
    rmSync(join(DISQUE, "modeles-llamacpp"), { force: true });
    await arreter();
  }

  /* ── C. Le port du moteur ouvert tenu par un autre ───────────────────── */
  console.log("C. Moteur ouvert : un autre programme sur son port");
  if (process.platform === "darwin") {
    const preparer = (donnees, binaire) => {
      mkdirSync(join(donnees, "llamacpp", "b11146"), { recursive: true });
      mkdirSync(join(donnees, "llamacpp", "modeles"), { recursive: true });
      if (binaire) copyFileSync(binaire, join(donnees, "llamacpp", "b11146", "llama-server"));
      else writeFileSync(join(donnees, "llamacpp", "b11146", "llama-server"), "#!/bin/sh\nexit 1\n");
      chmodSync(join(donnees, "llamacpp", "b11146", "llama-server"), 0o755);
      // Un fichier au nom du modèle : le moteur « a de quoi servir » (son contenu n'est jamais lu ici).
      writeFileSync(join(donnees, "llamacpp", "modeles", "Qwen3-1.7B-Q8_0.gguf"), "");
    };
    const reponse = JSON.stringify({ object: "list", data: [{ id: "qwen3-1.7b", object: "model" }] });

    // C1. Un programme quelconque tient le port avant la passerelle.
    const d1 = join(TMP, "donnees-d");
    preparer(d1, null);
    const portIntrus = await portLibre();
    const recus = [];
    const faux = createServer((req, res) => {
      recus.push(req.headers.authorization ?? "");
      res.setHeader("content-type", "application/json");
      res.end(reponse);
    }).listen(portIntrus, "127.0.0.1");
    intrus.push(() => faux.close());
    await demarrer(d1, { HELIX_MOTEUR: "llamacpp", HELIX_LLAMACPP_PORT: String(portIntrus) });
    const m1 = await fetch(`${G}/v1/models`, { headers: { Authorization: `Bearer ${JETON}` } }).then((r) => r.json()).catch(() => ({}));
    const cle1 = readFileSync(join(d1, "llamacpp", "cle"), "utf8").trim();
    verifier("un autre programme sur le port ne reçoit jamais la clé du moteur", !recus.includes(`Bearer ${cle1}`), `${recus.length} requêtes, ${recus.filter((a) => a).length} avec une clé`);
    verifier("ses « modèles » ne sont pas présentés comme le modèle local", !(m1.data ?? []).some((m) => String(m.id).startsWith("llamacpp/")), JSON.stringify(m1).slice(0, 200));
    await arreter();
    faux.close();

    // C2. Un serveur resté de Helix (le fichier posé par Helix, lancé avant la passerelle) : arrêté et remplacé (revue finale du 28/09/2026), jamais doublé.
    const d2 = join(TMP, "donnees-e");
    preparer(d2, process.execPath);
    const portReste = await portLibre();
    const script = `require("http").createServer((q, r) => { r.setHeader("content-type", "application/json"); r.end(${JSON.stringify(reponse).replace(/[<>/\u2028\u2029]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, "0")}`)}); }).listen(${Number(portReste)}, "127.0.0.1");`;
    const reste = spawn(join(d2, "llamacpp", "b11146", "llama-server"), ["-e", script], { stdio: "ignore" });
    intrus.push(() => reste.kill());
    // Qu'il écoute vraiment avant la passerelle (une copie de 100 Mo démarre lentement sur une machine chargée).
    for (let i = 0; i < 100; i++) {
      if (await fetch(`http://127.0.0.1:${portReste}/`).then(() => true, () => false)) break;
      await attendre(200);
    }
    await demarrer(d2, { HELIX_MOTEUR: "llamacpp", HELIX_LLAMACPP_PORT: String(portReste) });
    const m2 = await fetch(`${G}/v1/models`, { headers: { Authorization: `Bearer ${JETON}` } }).then((r) => r.json()).catch(() => ({}));
    // Il gardait le modèle en mémoire après la fermeture de Helix : il est arrêté par son PID, puis remplacé (ici par une copie de Node, qui ne sait pas servir : seul l'arrêt compte).
    for (let i = 0; i < 50 && reste.exitCode === null && reste.signalCode === null; i++) await attendre(200);
    verifier("un serveur resté de Helix (même fichier exécuté, lu par lsof) est arrêté puis remplacé, jamais gardé à côté d'un second", reste.exitCode !== null || reste.signalCode !== null, `code ${reste.exitCode} signal ${reste.signalCode} ${JSON.stringify(m2).slice(0, 120)}`);
    await arreter();
    reste.kill();

    // C3. Le serveur lancé par la passerelle elle-même (un faux llama-server qui écoute le port reçu) : reconnu par son numéro, il sert.
    const d3 = join(TMP, "donnees-f");
    preparer(d3, null);
    const serveurJs = join(TMP, "faux-llama.cjs");
    writeFileSync(
      serveurJs,
      `const a = process.argv; const port = Number(a[a.indexOf("--port") + 1]);
       const cle = require("fs").readFileSync(a[a.indexOf("--api-key-file") + 1], "utf8").trim();
       require("http").createServer((q, r) => { if (q.url !== "/" && q.headers.authorization !== "Bearer " + cle) { r.statusCode = 401; return r.end("{}"); } r.setHeader("content-type", "application/json"); r.end(${JSON.stringify(reponse)}); }).listen(port, "127.0.0.1");`,
    );
    // `exec` : le shell laisse la place à Node sous le même numéro, comme le vrai llama-server est lui-même le processus lancé.
    writeFileSync(join(d3, "llamacpp", "b11146", "llama-server"), `#!/bin/sh\nexec ${JSON.stringify(process.execPath)} ${JSON.stringify(serveurJs)} "$@"\n`);
    await demarrer(d3, { HELIX_MOTEUR: "llamacpp" });
    const m3 = await fetch(`${G}/v1/models`, { headers: { Authorization: `Bearer ${JETON}` } }).then((r) => r.json()).catch(() => ({}));
    verifier("le serveur lancé par la passerelle est reconnu (son numéro) et ses modèles servis", (m3.data ?? []).some((m) => m.id === "llamacpp/qwen3-1.7b"), JSON.stringify(m3).slice(0, 200));
    await arreter();
  } else {
    console.log("  (macOS seulement : le moteur ouvert ne sert que sur Mac)");
  }
} finally {
  await arreter();
  for (const f of intrus) {
    try {
      f();
    } catch {
      /* déjà arrêté */
    }
  }
  await attendre(300);
  rmSync(TMP, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
}

console.log(`\n${reussis} vérification(s) réussie(s), ${echecs.length} échec(s).`);
process.exit(echecs.length ? 1 : 0);
