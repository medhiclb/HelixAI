/*
 * OpenClaw natif sous Windows : ce qui s'essaie depuis un Mac.
 *
 *   node scripts/essai-openclaw-windows.mjs                 (lancé aussi par npm run securite)
 *   node scripts/essai-openclaw-windows.mjs --installation  (en plus : vraie installation sur ce poste, voir la fin)
 *
 * Écrit le 28/09/2026, quand Helix est passé d'un refus (« sous Windows,
 * OpenClaw demande WSL ») à un OpenClaw natif. Il n'y a pas de Windows ici :
 * on essaie la logique telle que Windows la verra, en passant `win32` aux
 * fonctions de plateformeOpenClaw.ts (chemins en `path.win32`), et, dans un
 * Node à part où `process.platform` vaut `win32`, l'arrêt d'un arbre de
 * processus (taskkill intercepté, jamais lancé). Ce qui ne s'essaie qu'avec
 * un vrai Windows (l'archive posée, npm, OpenClaw qui démarre, PowerShell qui
 * lit une ligne de commande) est dit dans PROJET.md § 3.4.
 *
 * Aucun OpenClaw n'est lancé par défaut, ni celui de la personne (port
 * 18789), ni celui de Helix (18800). Avec `--installation`, une instance
 * jetable : dossier personnel et données dans un dossier temporaire, un port
 * libre, arrêtée par son numéro.
 */
import { spawnSync, spawn } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { createServer } from "node:net";
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
    console.log(`  ✗ ${nom}  —  obtenu : ${String(obtenu).slice(0, 400)}`);
  }
}
const lire = (...c) => readFileSync(join(RACINE, ...c), "utf8");
const sansCommentaires = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const P = await import(pathToFileURL(join(RACINE, "gateway", "src", "plateformeOpenClaw.ts")).href);
const W = "win32";

console.log("A. Node officiel pour Windows");
{
  const x64 = P.archiveNode({ platform: W, arch: "x64", release: "10.0.26100" });
  const arm = P.archiveNode({ platform: W, arch: "arm64", release: "10.0.26100" });
  verifier("Windows x64 : l'archive .zip officielle, plus aucun refus", x64.dossier === "win-x64" && x64.extension === ".zip" && !("erreur" in x64), JSON.stringify(x64));
  verifier("Windows arm64 : l'archive .zip officielle", arm.dossier === "win-arm64" && arm.extension === ".zip", JSON.stringify(arm));
  const ia32 = P.archiveNode({ platform: W, arch: "ia32", release: "10.0" });
  verifier("Windows 32 bits : refusé, avec le processeur nommé", "erreur" in ia32 && ia32.erreur.includes("ia32"), JSON.stringify(ia32));
  const autre = P.archiveNode({ platform: "freebsd", arch: "x64", release: "14" });
  verifier("système sans archive : le refus ne parle plus de WSL", "erreur" in autre && !/WSL/.test(autre.erreur), JSON.stringify(autre));
  const vieuxMac = P.archiveNode({ platform: "darwin", arch: "arm64", release: "22.5.0" });
  const mac = P.archiveNode({ platform: "darwin", arch: "arm64", release: "25.0.0" });
  verifier("macOS inchangé : 13.5 au moins, archive tar.gz", "erreur" in vieuxMac && mac.dossier === "darwin-arm64" && mac.extension === ".tar.gz", JSON.stringify([vieuxMac, mac]));
  const source = lire("gateway", "src", "installationOpenClaw.ts");
  const empreinte = (nom) => new RegExp(`"node-v24\\.21\\.0-${nom}\\.zip": "[0-9a-f]{64}"`).test(source);
  verifier("les deux archives Windows de Node 24.21.0 ont leur empreinte SHA-256 écrite dans le code", empreinte("win-x64") && empreinte("win-arm64"), "empreinte manquante");
  const tar = P.commandeExtraction("C:\\Users\\Jean Dupont\\.helix\\a.zip", "C:\\Users\\Jean Dupont\\.helix\\x", ".zip", W, { SystemRoot: "D:\\WINDOWS" });
  verifier("extraction : le tar.exe de System32 (lu dans SystemRoot), `-xf` pour un .zip, chemins avec espaces en un seul argument", tar.fichier === "D:\\WINDOWS\\System32\\tar.exe" && tar.args[0] === "-xf" && tar.args[1] === "C:\\Users\\Jean Dupont\\.helix\\a.zip", JSON.stringify(tar));
}

console.log("B. Disposition du Node privé et installation par npm");
{
  const dossier = "C:\\Users\\Hélène Dupont\\.helix\\data\\openclaw-moteur\\node";
  const d = P.dispositionNode(dossier, W);
  verifier("Windows : node.exe à la racine, npm-cli.js sous node_modules\\npm\\bin, openclaw.cmd à la racine", d.node === `${dossier}\\node.exe` && d.npmCli === `${dossier}\\node_modules\\npm\\bin\\npm-cli.js` && d.lanceurOpenClaw === `${dossier}\\openclaw.cmd` && d.dossierBin === dossier && d.paquets === `${dossier}\\node_modules`, JSON.stringify(d));
  const m = P.dispositionNode("/u/.helix/data/openclaw-moteur/node", "darwin");
  verifier("macOS et Linux inchangés : bin/node, lib/node_modules, bin/openclaw", m.node === "/u/.helix/data/openclaw-moteur/node/bin/node" && m.lanceurOpenClaw === "/u/.helix/data/openclaw-moteur/node/bin/openclaw" && m.npmCli === "/u/.helix/data/openclaw-moteur/node/lib/node_modules/npm/bin/npm-cli.js", JSON.stringify(m));
  const env = P.envInstallation(
    { Path: "C:\\Program Files\\Git\\cmd;C:\\Windows\\system32", SystemRoot: "C:\\Windows", ComSpec: "C:\\Windows\\system32\\cmd.exe", NPM_CONFIG_PREFIX: "D:\\ailleurs", npm_config_registry: "http://registre.piege", HELIX_CONFIG: "x", Electron_Run_As_Node: "1", APPDATA: "C:\\Users\\a\\AppData\\Roaming", TEMP: "C:\\T" },
    dossier,
    W,
  );
  const cles = Object.keys(env);
  verifier("environnement de npm : un seul PATH (le `Path` d'origine retiré), qui commence par le Node privé", cles.filter((k) => k.toLowerCase() === "path").length === 1 && env.PATH.startsWith(`${dossier};`), JSON.stringify(env.PATH));
  verifier("environnement de npm : System32 et Windows PowerShell dans le PATH (cmd.exe fait tourner les scripts d'installation)", env.PATH.split(";").includes("C:\\Windows\\System32") && env.PATH.includes("WindowsPowerShell\\v1.0"), env.PATH);
  verifier("environnement de npm : ni NPM_CONFIG_PREFIX ni npm_config_registry, quelle que soit la casse ; ni HELIX_ ni Electron_", !cles.some((k) => /^(npm_|helix_|electron_)/i.test(k)), cles.join(","));
  verifier("environnement de npm : ComSpec, APPDATA et TEMP gardés", env.ComSpec && env.APPDATA && env.TEMP, cles.join(","));
  const args = P.argumentsInstallation("2026.9.4", dossier, { avant: "2026-09-27T00:00:00.000Z" });
  const i = args.indexOf("--prefix");
  verifier("npm install : préfixe global explicite, chemin avec espace et accent en un seul argument", args[0] === "install" && args[1] === "-g" && i > 0 && args[i + 1] === dossier, JSON.stringify(args));
  // 29/09/2026 : `--allow-scripts=openclaw` laissait tourner (par cmd.exe) les scripts de quatre dépendances, npm 11.19 ne faisant qu'avertir.
  verifier("npm install : version épinglée, dépendances à date fixe, aucun script d'installation (ceux d'OpenClaw lancés à part, par Node)", args.includes("openclaw@2026.9.4") && args.includes("--before=2026-09-27T00:00:00.000Z") && args.includes("--ignore-scripts") && !args.some((a) => a.startsWith("--allow-scripts")), JSON.stringify(args));
  const paquetOc = `${dossier}\\node_modules\\openclaw`;
  const sc = P.scriptsOpenClaw({ scripts: { preinstall: "node scripts/preinstall-package-manager-warning.mjs", postinstall: "node scripts/postinstall-bundled-plugins.mjs", test: "vitest" } }, paquetOc, W);
  verifier(
    "scripts d'OpenClaw 2026.9.4 : preinstall puis postinstall, chacun un fichier du paquet lancé par Node (les autres scripts ignorés)",
    Array.isArray(sc) && sc.length === 2 && sc[0].etape === "preinstall" && sc[0].fichier === `${paquetOc}\\scripts\\preinstall-package-manager-warning.mjs` && sc[1].etape === "postinstall" && sc[1].fichier === `${paquetOc}\\scripts\\postinstall-bundled-plugins.mjs`,
    JSON.stringify(sc),
  );
  const refuses = [
    { postinstall: "node scripts/a.mjs && del /q C:\\x" },
    { postinstall: "node ..\\..\\ailleurs.mjs" },
    { install: "node-gyp rebuild" },
    { preinstall: "node C:\\autre\\x.mjs" },
    { postinstall: "powershell -c evil" },
  ].map((scripts) => P.scriptsOpenClaw({ scripts }, paquetOc, W));
  verifier("scripts d'OpenClaw : tout ce qui n'est pas « node <fichier du paquet> » est refusé avec sa raison (&&, .., chemin absolu, autre programme)", refuses.every((r) => !Array.isArray(r) && "erreur" in r), JSON.stringify(refuses));
  verifier("scripts d'OpenClaw : lancés par le Node privé, dans le dossier du paquet, sans shell", /executer\(d\.node, \[s\.fichier\], env, 5 \* 60_000, dossierPaquet\)/.test(sansCommentaires(lire("gateway", "src", "installationOpenClaw.ts"))), "autrement");
  const source = sansCommentaires(lire("gateway", "src", "installationOpenClaw.ts"));
  verifier("installation : npm lancé par node et npm-cli.js (jamais npm.cmd, jamais bin/npm)", /executer\(d\.node, \[d\.npmCli, \.\.\.args\]/.test(source) && !/join\(binNode, "npm"\)/.test(source) && !/npm\.cmd/.test(source), "npm lancé autrement");
  verifier("installation : la vérification lance OpenClaw comme il sera lancé (node.exe openclaw.mjs sous Windows)", /executer\(lancement\.fichier, \[\.\.\.lancement\.prefixe, "--version"\]/.test(source), "vérification autrement");
  const msg = P.sansChemins("EPERM: operation not permitted, rename 'C:\\Users\\Jean Dupont\\.helix\\data\\x' -> \\\\serveur\\partage\\y (/Users/jean/.npm/_logs) https://registry.npmjs.org/openclaw");
  verifier("message de npm à l'écran : sans chemin de la machine (Windows, UNC, Unix), l'adresse du registre gardée", !/Users\\|serveur|\/Users\/jean/.test(msg) && /https:\/\/registry\.npmjs\.org\//.test(msg), msg);
}

console.log("C. Trouver OpenClaw et le lancer sans cmd.exe");
{
  const existe = (fichiers) => (f) => fichiers.includes(f);
  const prefixe = "C:\\Users\\Jean Dupont\\.helix\\data\\openclaw-moteur\\node";
  const gere = `${prefixe}\\openclaw.cmd`;
  const script = `${prefixe}\\node_modules\\openclaw\\openclaw.mjs`;
  const l = P.lancementOpenClaw(gere, W, existe([gere, script, `${prefixe}\\node.exe`]), () => "C:\\autre\\node.exe");
  verifier("le Node privé : node.exe à côté du lanceur, openclaw.mjs en premier argument, le .cmd jamais lancé", l && l.fichier === `${prefixe}\\node.exe` && l.prefixe.length === 1 && l.prefixe[0] === script && l.node === l.fichier && !l.fichier.endsWith(".cmd"), JSON.stringify(l));
  const npmGlobal = "C:\\Users\\a\\AppData\\Roaming\\npm";
  const l2 = P.lancementOpenClaw(`${npmGlobal}\\openclaw.cmd`, W, existe([`${npmGlobal}\\openclaw.cmd`, `${npmGlobal}\\node_modules\\openclaw\\openclaw.mjs`]), () => "C:\\Program Files\\nodejs\\node.exe");
  verifier("un OpenClaw déjà installé par npm (%APPDATA%\\npm) : le Node du PATH, comme le fait le .cmd de npm", l2 && l2.fichier === "C:\\Program Files\\nodejs\\node.exe" && l2.paquet === `${npmGlobal}\\node_modules\\openclaw`, JSON.stringify(l2));
  verifier("sans Node nulle part : pas de lancement (candidat écarté, pas d'erreur)", P.lancementOpenClaw(`${npmGlobal}\\openclaw.cmd`, W, existe([`${npmGlobal}\\openclaw.cmd`, `${npmGlobal}\\node_modules\\openclaw\\openclaw.mjs`]), () => null) === null, "lancé");
  verifier("lanceur sans paquet à côté (un .cmd écrit à la main) : écarté", P.lancementOpenClaw("C:\\outils\\openclaw.cmd", W, existe(["C:\\outils\\openclaw.cmd", "C:\\outils\\node.exe"]), () => null) === null, "lancé");
  const l3 = P.lancementOpenClaw("D:\\oc\\openclaw.mjs", W, existe(["D:\\oc\\openclaw.mjs"]), () => "C:\\n\\node.exe");
  verifier("chemin imposé vers openclaw.mjs : lancé par Node", l3 && l3.fichier === "C:\\n\\node.exe" && l3.prefixe[0] === "D:\\oc\\openclaw.mjs", JSON.stringify(l3));
  verifier("un .exe inconnu : écarté", P.lancementOpenClaw("C:\\x\\openclaw.exe", W, () => true, () => "node") === null, "lancé");
  const l4 = P.lancementOpenClaw(gere, W, existe([gere, `${prefixe}\\node_modules\\openclaw\\bin\\oc.mjs`, `${prefixe}\\node.exe`]), () => null, "bin\\oc.mjs");
  verifier("point d'entrée déclaré par le package.json : c'est lui qui est lancé", l4 && l4.prefixe[0] === `${prefixe}\\node_modules\\openclaw\\bin\\oc.mjs`, JSON.stringify(l4));
  verifier(
    "le paquet derrière un lanceur de npm (openclaw.cmd, .ps1, sans extension), rien derrière un script ni hors de Windows",
    P.paquetDerriereLanceur(gere, W) === `${prefixe}\\node_modules\\openclaw` && P.paquetDerriereLanceur(`${prefixe}\\openclaw.ps1`, W) === `${prefixe}\\node_modules\\openclaw` && P.paquetDerriereLanceur(`${prefixe}\\openclaw`, W) === `${prefixe}\\node_modules\\openclaw` && P.paquetDerriereLanceur(script, W) === null && P.paquetDerriereLanceur("/u/node/bin/openclaw", "darwin") === null,
    "mauvais paquet",
  );
  const employesSource = sansCommentaires(lire("gateway", "src", "employes.ts"));
  verifier("détection : sous Windows, le package.json est lu avant le lancement, pour lancer le point d'entrée qu'il déclare", /const derriere = paquetDerriereLanceur\(bin, p\);[\s\S]{0,200}lancementOpenClaw\(bin, p, existsSync, nodeDuPath, avant\?\.entree\)/.test(employesSource), "ordre inversé");
  const lm = P.lancementOpenClaw("/u/node/bin/openclaw", "darwin", existe(["/u/node/bin/node"]), () => null);
  verifier("macOS inchangé : le lanceur lui-même, le node posé à côté", lm.fichier === "/u/node/bin/openclaw" && lm.prefixe.length === 0 && lm.node === "/u/node/bin/node", JSON.stringify(lm));
  verifier("PATH d'OpenClaw sous Windows : le dossier de son Node, puis celui du lanceur", JSON.stringify(P.dossiersDuLancement(`${npmGlobal}\\openclaw.cmd`, l2, W)) === JSON.stringify(["C:\\Program Files\\nodejs", npmGlobal]), JSON.stringify(P.dossiersDuLancement(`${npmGlobal}\\openclaw.cmd`, l2, W)));

  const env = { Path: `C:\\Windows\\system32;"C:\\Program Files\\nodejs";C:\\WINDOWS\\SYSTEM32;C:\\Users\\a\\AppData\\Local\\Microsoft\\WindowsApps`, APPDATA: "C:\\Users\\a\\AppData\\Roaming" };
  const c = P.candidatsOpenClaw({ platform: W, env, maison: "C:\\Users\\a", impose: undefined, gere, versionsNvm: () => ["v24.0.0"] });
  verifier("candidats Windows : celui de Helix d'abord, puis openclaw.cmd de chaque dossier du PATH (guillemets retirés, doublons de casse écartés), puis %APPDATA%\\npm", c[0] === gere && c.includes("C:\\Program Files\\nodejs\\openclaw.cmd") && c.filter((x) => x.toLowerCase() === "c:\\windows\\system32\\openclaw.cmd").length === 1 && c[c.length - 1] === `${npmGlobal}\\openclaw.cmd`, JSON.stringify(c));
  verifier("candidats Windows : ni Homebrew, ni nvm, ni un chemin Unix", !c.some((x) => x.startsWith("/") || x.includes("homebrew") || x.includes(".nvm")), JSON.stringify(c));
  const cm = P.candidatsOpenClaw({ platform: "darwin", env: { PATH: "/usr/bin:/bin" }, maison: "/Users/a", impose: "/opt/oc", gere: "/g/bin/openclaw", versionsNvm: () => ["v24.21.0"] });
  verifier("candidats macOS inchangés : imposé, celui de Helix, PATH, nvm, Homebrew, ~/.local/bin", JSON.stringify(cm) === JSON.stringify(["/opt/oc", "/g/bin/openclaw", "/usr/bin/openclaw", "/bin/openclaw", "/Users/a/.nvm/versions/node/v24.21.0/bin/openclaw", "/opt/homebrew/bin/openclaw", "/usr/local/bin/openclaw", "/Users/a/.local/bin/openclaw"]), JSON.stringify(cm));
  const n = P.chercherDansPath("node", env, W, existe(["C:\\Users\\a\\AppData\\Local\\Microsoft\\WindowsApps\\node.exe", "C:\\Program Files\\nodejs\\node.exe"]));
  verifier("Node du PATH sous Windows : node.exe, lu dans `Path`, sans l'alias du Microsoft Store", n === "C:\\Program Files\\nodejs\\node.exe", String(n));
}

console.log("D. Environnement d'OpenClaw sous Windows");
{
  const source = { Path: "C:\\Windows\\system32", Temp: "C:\\T", COMSPEC: "C:\\Windows\\system32\\cmd.exe", ProgramFiles: "C:\\Program Files", AWS_SECRET_ACCESS_KEY: "secret", OPENAI_API_KEY: "sk-x", LC_ALL: "fr_FR.UTF-8", USERPROFILE: "C:\\Users\\a" };
  const noms = ["TEMP", "ComSpec", "ProgramFiles", "USERPROFILE", "PATHEXT"];
  const garde = P.garderVariables(source, noms, ["LC_"], W);
  verifier("variables transmises : sous Windows sans tenir compte de la casse (Temp, COMSPEC), les clés de l'hôte écartées", garde.Temp && garde.COMSPEC && garde.ProgramFiles && garde.LC_ALL && !garde.AWS_SECRET_ACCESS_KEY && !garde.OPENAI_API_KEY && !garde.Path, JSON.stringify(Object.keys(garde)));
  const gardeMac = P.garderVariables({ Temp: "x", TEMP: "y" }, ["TEMP"], [], "darwin");
  verifier("variables transmises : macOS et Linux restent sensibles à la casse", !gardeMac.Temp && gardeMac.TEMP === "y", JSON.stringify(gardeMac));
  const env = P.poserPath({ Path: "C:\\a", PATH: "C:\\b" }, P.joindrePath(["C:\\node", "C:\\a;c:\\NODE;;C:\\b"], W), W);
  verifier("PATH sous Windows : `;`, un seul PATH, doublons de casse écartés", JSON.stringify(env) === JSON.stringify({ PATH: "C:\\node;C:\\a;C:\\b" }), JSON.stringify(env));
  verifier("PATH sous macOS : `:`", P.joindrePath(["/a/bin", "/usr/bin:/bin"], "darwin") === "/a/bin:/usr/bin:/bin", P.joindrePath(["/a/bin", "/usr/bin:/bin"], "darwin"));
  const employes = sansCommentaires(lire("gateway", "src", "employes.ts"));
  verifier("employes.ts : OpenClaw reçoit ce qu'il faut pour trouver PowerShell (ProgramFiles, ProgramW6432, PSModulePath)", /"ProgramFiles", "ProgramFiles\(x86\)", "ProgramW6432"/.test(employes) && /"PSModulePath"/.test(employes), "variables absentes");
  verifier("employes.ts : le PATH d'OpenClaw passe par joindrePath (plus de `:` écrit en dur)", /poserPath\(env, joindrePath\(\[\.\.\.dossiersDuLancement\(moteur\.bin, moteur\.lancement, p\)/.test(employes) && !/PATH: `\$\{dirname\(moteur\.bin\)\}:/.test(employes), "PATH écrit en dur");
}

console.log("E. Lancer, piloter, arrêter l'instance de Helix");
{
  const employes = sansCommentaires(lire("gateway", "src", "employes.ts"));
  verifier("la passerelle OpenClaw est lancée par son lancement (node.exe openclaw.mjs sous Windows)", /spawn\(moteur\.lancement\.fichier, \[\.\.\.moteur\.lancement\.prefixe, "gateway", "run", "--port"/.test(employes), "spawn(moteur.bin)");
  verifier("les commandes openclaw de Helix passent par le même lancement", /executer\(moteur\.lancement\.fichier, \[\.\.\.moteur\.lancement\.prefixe, \.\.\.args\]/.test(employes), "oc() autrement");
  verifier("la base de l'agent est ouverte par le Node d'OpenClaw (node.exe sous Windows), pas par `<dossier>/node`", /const node = moteur\.lancement\.node;/.test(employes) && !/join\(dirname\(moteur\.bin\), "node"\)/.test(employes), "node en dur");
  verifier("orphelin : plus de /bin/ps ni de process.kill en dur ; arrêt de tout son arbre", !/"\/bin\/ps"/.test(employes) && !/process\.kill\(pid/.test(employes) && /arreterPidArbre\(pid, "SIGTERM"\)/.test(employes), "POSIX en dur");
  verifier("mise à jour annulée : les données remises par un renommage réessayé (Windows), et l'effacement réessayé", /renommerSur\(miseDeCote\(\), dossier\(\)\)/.test(employes) && /maxRetries: 10/.test(employes), "renameSync");
  verifier("configuration d'OpenClaw : remplacée par un renommage réessayé", /renommerSur\(tmp, fichierConfig\(\)\)/.test(employes), "renameSync");
  verifier("mémoire restaurée : un morceau de chemin avec `\\` ou `:` est refusé (il sortirait de l'espace sous Windows)", /p === "\.\." \|\| \/\[\\\\:\]\/\.test\(p\)/.test(employes), "garde absente");
  verifier("fiche de poste d'un employé Libre sous Windows : ses commandes sont à écrire en PowerShell", /process\.platform === "win32"[\s\S]{0,200}tes commandes passent par PowerShell/.test(employes), "consigne absente");

  const lp = P.commandeLigneDeProcessus(4242, W, { SystemRoot: "C:\\Windows" });
  const script = Buffer.from(lp.args[lp.args.indexOf("-EncodedCommand") + 1], "base64").toString("utf16le");
  verifier("ligne de commande d'un processus sous Windows : Windows PowerShell de System32, script encodé qui ne porte que le numéro", lp.fichier === "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" && lp.args.includes("-NoProfile") && /Win32_Process -Filter 'ProcessId = 4242'/.test(script) && !/"/.test(script), `${lp.fichier} ${script}`);
  let refus = false;
  try {
    P.commandeLigneDeProcessus(Number("4242; Stop-Computer"), W, {});
  } catch {
    refus = true;
  }
  verifier("un numéro de processus qui n'est pas un entier est refusé avant toute commande", refus, "accepté");
  verifier("macOS : `ps -p <pid> -o command=` comme avant", JSON.stringify(P.commandeLigneDeProcessus(12, "darwin", {})) === JSON.stringify({ fichier: "/bin/ps", args: ["-p", "12", "-o", "command="] }), "autre");
  const ligne = '"C:\\Users\\Jean Dupont\\.helix\\data\\openclaw-moteur\\node\\node.exe" "C:\\Users\\Jean Dupont\\.helix\\data\\openclaw-moteur\\node\\node_modules\\openclaw\\openclaw.mjs" gateway run --port 18800';
  verifier("reconnaître l'OpenClaw de Helix sous Windows (node.exe … openclaw.mjs gateway run), pas un autre Node", P.estPasserelleOpenClaw(ligne, W) && !P.estPasserelleOpenClaw('"C:\\nodejs\\node.exe" serveur.js', W) && !P.estPasserelleOpenClaw("node.exe openclaw.mjs doctor", W) && P.estPasserelleOpenClaw("openclaw-gateway", "darwin"), "mauvais verdict");
  const tk = P.commandeArretArbre(4242, { SystemRoot: "C:\\Windows" });
  verifier("arrêt de l'arbre : taskkill.exe de System32, /PID /T /F, jamais /IM", tk.fichier === "C:\\Windows\\System32\\taskkill.exe" && JSON.stringify(tk.args) === JSON.stringify(["/PID", "4242", "/T", "/F"]) && !tk.args.includes("/IM"), JSON.stringify(tk));

  /*
   * L'arrêt réel de processus.ts, dans un Node où `process.platform` vaut
   * `win32` : `spawnSync` est intercepté avant l'import (processus.ts le lit
   * par liaison vivante), rien n'est lancé. Un processus enfant « vivant »
   * (exitCode null) doit partir par taskkill, pas par kill().
   */
  const code = `Object.defineProperty(process, "platform", { value: "win32" });
    process.env.SystemRoot = "C:\\\\Windows";
    const cp = (await import("node:module")).createRequire(import.meta.url)("node:child_process");
    const vus = [];
    cp.spawnSync = (f, a, o) => { vus.push({ f, a, cache: o?.windowsHide === true }); return { status: 0 }; };
    const pr = await import("./gateway/src/processus.ts");
    let tue = false;
    pr.arreterArbre({ pid: 5151, exitCode: null, signalCode: null, kill() { tue = true; } });
    pr.arreterPidArbre(6161);
    pr.arreterArbre({ pid: 7171, exitCode: 0, signalCode: null, kill() { tue = true; } });
    console.log(JSON.stringify({ vus, tue }));`;
  const r = spawnSync(process.execPath, ["--experimental-strip-types", "--no-warnings", "--input-type=module", "-e", code], { cwd: RACINE, encoding: "utf8", timeout: 60_000 });
  let resultat = null;
  try {
    resultat = JSON.parse((r.stdout ?? "").trim().split("\n").pop());
  } catch {
    /* sortie illisible : dite plus bas */
  }
  const attendu = (pid) => resultat?.vus.some((v) => /[\\/]System32[\\/]taskkill\.exe$/.test(v.f) && JSON.stringify(v.a) === JSON.stringify(["/pid", String(pid), "/T", "/F"]) && v.cache);
  verifier("Windows (simulé) : l'instance s'arrête par taskkill de System32 sur son numéro, tout l'arbre, sans console, jamais par kill()", resultat && attendu(5151) && attendu(6161) && !resultat.tue, `${r.stdout} ${r.stderr}`.slice(0, 400));
  verifier("Windows (simulé) : un processus déjà terminé n'est pas visé (son numéro a pu être repris)", resultat && !resultat.vus.some((v) => v.a.includes("7171")), JSON.stringify(resultat));
}

console.log("F. Ce que l'écran et la documentation disent");
{
  const catalogues = ["en", "zh", "ja", "es", "de", "ar"].map((l) => lire("gateway", "i18n", `${l}.json`)).join("") + lire("gateway", "src", "installationOpenClaw.ts") + lire("gateway", "src", "plateformeOpenClaw.ts").replace(/\/\*[\s\S]*?\*\//g, "");
  verifier("plus aucun message qui dit que Windows demande WSL (passerelle, catalogues)", !/demande WSL|requires WSL|需要 WSL|WSL が必要|(requiere|necesita) WSL|(erfordert|benötigt|verlangt) WSL|(يتطلب|يحتاج إلى) WSL/.test(catalogues), "reste un texte WSL");
  const public_ = ["README.md", "README.fr.md", "README.zh.md", "README.ja.md", "README.es.md", "README.de.md", "README.ar.md", "docs/GUIDE.md"].map((f) => lire(f)).join("\n");
  verifier("vitrine et guide : plus de « OpenClaw y demande WSL »", !/OpenClaw (y demande|needs) WSL|OpenClaw 在 Windows 上需要 WSL|OpenClaw に WSL が必要|OpenClaw (requiere|necesita|erfordert|benötigt) WSL|OpenClaw (يتطلب|يحتاج إلى) WSL/.test(public_), "reste un texte WSL");
  const ecran = lire("src", "components", "agents", "Employes.tsx");
  verifier("écran : au palier Libre, sur une instance Windows, il est dit que les commandes passent par PowerShell (cette capacité seulement)", /windows && <>\{" "\}\{t\("Sur cette instance \(Windows\), ses commandes passent par PowerShell/.test(ecran) && /windows=\{etat\.moteur\.plateforme === "win32"\}/.test(ecran), "absent");
  const cle = "Sur cette instance (Windows), ses commandes passent par PowerShell : une commande écrite pour macOS ou Linux peut ne pas y marcher.";
  verifier("écran : cette phrase est traduite dans les six catalogues (en, zh, ja, es, de, ar)", ["en", "zh", "ja", "es", "de", "ar"].every((l) => (JSON.parse(lire("src", "i18n", `${l}.json`))[cle] ?? "").length > 10), "traduction manquante");
  verifier("passerelle : le système de l'instance est donné à l'écran (moteur.plateforme)", /plateforme: process\.platform,/.test(lire("gateway", "src", "employes.ts")), "absent");
}

console.log("H. Bibliothèques Visual C++ de Microsoft (29/09/2026)");
{
  const V = await import(pathToFileURL(join(RACINE, "gateway", "src", "visualCpp.ts")).href);
  for (const arch of ["x64", "arm64"]) {
    const p = V.paquetVisualCpp(arch);
    const m = /^https:\/\/download\.visualstudio\.microsoft\.com\/download\/pr\/[0-9a-f-]{36}\/([0-9A-F]{64})\/VC_redist\.(x64|arm64)\.exe$/.exec(p?.adresse ?? "");
    verifier(`${arch} : adresse versionnée de Microsoft (pas le lien permanent), empreinte SHA-256 et taille écrites dans le code, égales au nom de dossier de Microsoft`, m && m[2] === arch && m[1].toLowerCase() === p.sha256 && p.octets > 1_000_000 && /^14\.\d+\.\d+\.\d+$/.test(p.version), JSON.stringify(p));
  }
  verifier("Windows 32 bits : aucun paquet (Helix n'y pose pas de Node)", V.paquetVisualCpp("ia32") === null, "paquet");
  const installation = sansCommentaires(lire("gateway", "src", "installationOpenClaw.ts"));
  verifier("installation : les bibliothèques de Microsoft passent avant Node, sous Windows seulement (la détection rend null ailleurs)", installation.indexOf("await assurerVisualCpp(qui)") > 0 && installation.indexOf("await assurerVisualCpp(qui)") < installation.indexOf("const node = await installerNode()") && /if \(process\.platform !== "win32"\) return null;/.test(lire("gateway", "src", "visualCpp.ts")), "ordre");
}

/*
 * --installation : la vraie installation, sur ce poste, pour vérifier que le
 * chemin commun (npm par node et npm-cli.js, `--prefix` explicite,
 * vérification par le lancement) n'a rien cassé. Données et dossier personnel
 * jetables, réseau requis (nodejs.org, registry.npmjs.org), plusieurs minutes.
 * Puis une passerelle OpenClaw jetable sur un port libre, arrêtée par son
 * numéro (sous Windows, par taskkill sur tout l'arbre, comme Helix). Jamais
 * lancé par la batterie.
 *
 * Sur un vrai Windows depuis le 29/09/2026 (GitHub Actions,
 * .github/workflows/essai-openclaw-windows.yml), après « npm a échoué
 * (code 1) » chez Medhi : c'est `installerOpenClaw` de installationOpenClaw.ts
 * lui-même qui tourne (Node privé téléchargé et vérifié, mêmes arguments de
 * npm, même `envInstallation`), rien n'est refait à côté. Avec
 * `--sortie <dossier>`, tout ce qu'il faut pour comprendre un échec y est
 * copié avant l'effacement du dossier jetable : la sortie complète de
 * l'installation (ce que la passerelle écrit dans passerelle.log), les
 * journaux de npm (`_logs` de son cache) et la liste du préfixe.
 */
const argument = (nom) => {
  const i = process.argv.indexOf(nom);
  return i > 0 ? process.argv[i + 1] : undefined;
};
if (process.argv.includes("--installation")) {
  console.log("G. Installation réelle sur ce poste (jetable)");
  const windows = process.platform === "win32";
  const sortieEssai = argument("--sortie") ? join(process.cwd(), argument("--sortie")) : null;
  if (sortieEssai) mkdirSync(sortieEssai, { recursive: true });
  const racine = mkdtempSync(join(tmpdir(), "helix-oc-win-"));
  /*
   * `--compte-accentue` : un compte Windows nommé « Hélène Dupont », comme
   * chez une vraie personne (espace et accents dans tout ce qui est rangé sous
   * son dossier : données de Helix, dossier temporaire, cache de npm). Sur la
   * machine de GitHub, le compte est `runneradmin` et le dossier temporaire
   * un nom court sans espace (`RUNNER~1`) : c'est ce qui les distingue le plus
   * d'un poste ordinaire. Le nom est écrit ici plutôt que passé en argument :
   * PowerShell l'aurait transmis dans un autre encodage.
   */
  const accentue = process.argv.includes("--compte-accentue");
  const maison = accentue ? join(racine, "Users", "H\u00e9l\u00e8ne Dupont") : join(racine, "maison");
  const donnees = accentue ? join(maison, ".helix", "data") : join(racine, "donnees");
  mkdirSync(maison, { recursive: true });
  mkdirSync(donnees, { recursive: true });
  writeFileSync(join(racine, "profil.json"), JSON.stringify({ chiffrement: "fichier" }));
  const env = { ...process.env, HOME: maison, USERPROFILE: maison, HELIX_DATA_DIR: donnees, HELIX_CONFIG: join(racine, "profil.json") };
  if (accentue && windows) {
    const local = join(maison, "AppData", "Local");
    for (const d of [join(local, "Temp"), join(maison, "AppData", "Roaming")]) mkdirSync(d, { recursive: true });
    for (const k of Object.keys(env)) if (/^(temp|tmp|localappdata|appdata)$/i.test(k)) delete env[k];
    Object.assign(env, { TEMP: join(local, "Temp"), TMP: join(local, "Temp"), LOCALAPPDATA: local, APPDATA: join(maison, "AppData", "Roaming") });
  }
  console.log(`  (dossier personnel : ${maison})`);
  /*
   * `--deux-fois` : une seconde installation par-dessus la première, comme
   * quand la personne clique « Réessayer » ou qu'une mise à jour réinstalle
   * (Node déjà posé, OpenClaw déjà dans le préfixe). La dernière fait foi.
   */
  const passes = process.argv.includes("--deux-fois") ? 2 : 1;
  const V = await import(pathToFileURL(join(RACINE, "gateway", "src", "visualCpp.ts")).href);
  /*
   * Windows : le relevé des bibliothèques Visual C++ (29/09/2026). Ce que la
   * détection de Helix lit sur cette machine (registre, DLL de System32), puis
   * chaque paquet épinglé (x64 et arm64) téléchargé à son adresse, son
   * empreinte, sa taille, sa version et sa signature Authenticode, lues ici,
   * par les scripts PowerShell de visualCpp.ts. Gardé en artefact
   * (`releve-visual-cpp.json`).
   */
  const ps = (script, variables) => {
    const e = V.envPowerShell(process.env, variables);
    const c = V.commandePowerShell(script, e);
    const r = spawnSync(c.fichier, c.args, { env: e, encoding: "utf8", timeout: 120_000, windowsHide: true });
    return { status: r.status, sortie: r.stdout ?? "", erreur: r.stderr ?? "" };
  };
  if (windows) {
    const releve = { machine: process.arch, paquets: {} };
    const brut = ps(V.SCRIPT_RELEVE, { HELIX_VC_ARCH: process.arch, HELIX_VC_DLL: V.DLL_VISUAL_CPP.join(";") });
    releve.detection = { brut: brut.sortie, erreur: brut.erreur.slice(0, 500), verdict: V.lireReleve(brut.sortie) ? V.verdictVisualCpp(V.lireReleve(brut.sortie), process.arch) : null };
    // Les autres DLL du Visual C++ que l'on aurait pu attendre : présentes ou non sur cette machine, pour mémoire.
    releve.autres = V.lireReleve(ps(V.SCRIPT_RELEVE, { HELIX_VC_ARCH: process.arch, HELIX_VC_DLL: "VCRUNTIME140_1.dll;MSVCP140.dll;ucrtbase.dll" }).sortie);
    verifier(`relevé de cette machine (${process.arch}) : lisible, bibliothèques présentes (machine de GitHub)`, releve.detection.verdict?.etat === "present", JSON.stringify(releve.detection));
    const { createHash } = await import("node:crypto");
    const dossierVc = mkdtempSync(join(tmpdir(), "helix-vc-"));
    for (const arch of ["x64", "arm64"]) {
      const p = V.PAQUETS_VISUAL_CPP[arch];
      const r = await fetch(p.adresse, { redirect: "error" });
      const octets = Buffer.from(await r.arrayBuffer());
      const f = join(dossierVc, `VC_redist.${arch}.exe`);
      writeFileSync(f, octets);
      const sha256 = createHash("sha256").update(octets).digest("hex");
      const s = ps(V.SCRIPT_SIGNATURE, { HELIX_VC_FICHIER: f });
      let signature = null;
      try {
        signature = JSON.parse(s.sortie.trim());
      } catch {
        /* dit plus bas */
      }
      releve.paquets[arch] = { adresse: p.adresse, http: r.status, octets: octets.length, sha256, signature, erreurSignature: s.erreur.slice(0, 500) };
      verifier(`paquet ${arch} : téléchargé à l'adresse épinglée, taille et empreinte SHA-256 égales à celles du code`, r.status === 200 && octets.length === p.octets && sha256 === p.sha256, `${r.status} ${octets.length} ${sha256}`);
      verifier(`paquet ${arch} : signature Authenticode valide, « Microsoft Corporation », racine de Microsoft ; version du produit égale à celle du code`, V.refusSignature(signature) === null && signature?.version === p.version, `${V.refusSignature(signature)} ${JSON.stringify(signature)}`);
    }
    rmSync(dossierVc, { recursive: true, force: true });
    if (sortieEssai) writeFileSync(join(sortieEssai, "releve-visual-cpp.json"), JSON.stringify(releve, null, 2));
    console.log(`  (relevé Visual C++ : ${JSON.stringify(releve.detection.verdict)} ; autres DLL : ${JSON.stringify(releve.autres?.dll)})`);
  }
  /*
   * `--visual-cpp-absent` : la détection dit « absentes » (variable réservée
   * aux essais, visualCpp.ts), et tout le chemin passe : téléchargement,
   * vérifications, installeur réel de Microsoft (sur la machine de GitHub,
   * déjà installé : 1638 ou 0 attendu ; pas d'UAC, l'élévation passe), puis
   * OpenClaw qui s'installe et démarre.
   */
  const vcAbsent = windows && process.argv.includes("--visual-cpp-absent");
  if (vcAbsent) env.HELIX_ESSAI_VISUAL_CPP = "absent";
  const code = `const i = await import("./gateway/src/installationOpenClaw.ts");
    for (let k = 0; k < ${passes}; k++) {
      i.installerOpenClaw("essai", { apres: async () => {} });
      let vue = false;
      for (;;) { await new Promise((r) => setTimeout(r, 500)); const e = i.etatInstallation(); if (e.etape === "visualcpp" && !vue) { vue = true; console.log("ETAPE_VISUALCPP " + JSON.stringify(e)); } if (e.etape === "termine" || e.etape === "erreur") { console.log("PASSE " + k + " " + JSON.stringify(e)); if (k === ${passes} - 1) { console.log("ETAT " + JSON.stringify(e)); console.log("LANCEMENT " + JSON.stringify(i.lancementGere())); } break; } }
    }`;
  const debutInstallation = Date.now();
  const r = spawnSync(process.execPath, ["--experimental-strip-types", "--no-warnings", "--input-type=module", "-e", code], { cwd: RACINE, env, encoding: "utf8", timeout: 30 * 60_000, maxBuffer: 64 * 1024 * 1024 });
  const sortie = `${r.stdout ?? ""}${r.stderr ?? ""}`;
  console.log(`  (installation : ${Math.round((Date.now() - debutInstallation) / 1000)} s)`);
  const etat = JSON.parse(/ETAT (.*)/.exec(sortie)?.[1] ?? "null");
  const lancement = JSON.parse(/LANCEMENT (.*)/.exec(sortie)?.[1] ?? "null");
  const reussie = etat?.etape === "termine" && etat.version === "2026.9.4";
  if (vcAbsent) {
    const etape = JSON.parse(/ETAPE_VISUALCPP (.*)/.exec(sortie)?.[1] ?? "null");
    const code = /\[visual-cpp\] installeur terminé : code (\S+)/.exec(sortie)?.[1];
    verifier("Visual C++ déclaré absent : l'étape « visualcpp » est affichée, avec l'explication de la demande d'autorisation de Windows", etape?.etape === "visualcpp" && /autorisation d'administrateur|administrator permission/.test(etape.message), JSON.stringify(etape));
    verifier("Visual C++ déclaré absent : paquet vérifié (empreinte, signature) puis installeur réel de Microsoft lancé avec élévation, code 0, 1638 ou 3010", /empreinte et signature de Microsoft vérifiées/.test(sortie) && ["0", "1638", "3010"].includes(code ?? ""), `code ${code} ${sortie.split(/\r?\n/).filter((l) => /visual-cpp/.test(l)).join(" | ").slice(0, 600)}`);
  }
  if (sortieEssai) {
    writeFileSync(join(sortieEssai, "installation.txt"), sortie);
    // Les journaux de npm : ceux que sa sortie nomme, et tout `_logs` du cache (%LOCALAPPDATA%\npm-cache sous Windows).
    const journaux = new Set([...sortie.matchAll(/complete log of this run can be found in:\s*(\S.*?)\s*$/gim)].map((m) => dirname(m[1].trim())));
    const cache = spawnSync(process.execPath, [join(donnees, "openclaw-moteur", "node", ...(windows ? [] : ["lib"]), "node_modules", "npm", "bin", "npm-cli.js"), "config", "get", "cache"], { env, encoding: "utf8" });
    if (cache.status === 0 && cache.stdout.trim()) journaux.add(join(cache.stdout.trim(), "_logs"));
    for (const e of [env, process.env]) if (e.LOCALAPPDATA) journaux.add(join(e.LOCALAPPDATA, "npm-cache", "_logs"));
    console.log(`  (journaux de npm cherchés : ${[...journaux].map((d) => `${d} ${existsSync(d) ? "présent" : "absent"}`).join(" ; ")} ; cache : ${cache.status} ${cache.stdout.trim()} ${String(cache.stderr ?? "").trim().slice(0, 200)})`);
    let n = 0;
    for (const d of journaux) {
      if (!existsSync(d)) continue;
      cpSync(d, join(sortieEssai, "npm-logs", String(n++)), { recursive: true });
    }
    const prefixe = join(donnees, "openclaw-moteur", "node");
    if (existsSync(prefixe)) writeFileSync(join(sortieEssai, "prefixe.txt"), lister(prefixe, 3).join("\n"));
    // Les modules natifs (binaire précompilé trouvé, ou compilé sur place : `build\Release`) et les scripts d'installation d'OpenClaw.
    const dependances = join(prefixe, "node_modules", "openclaw", "node_modules");
    const natifs = ["tree-sitter-bash", "koffi", "@lydell", "protobufjs", "@google"].flatMap((m) => [`== ${m}`, ...lister(join(dependances, m), 3).filter((l) => !/\.(d\.ts|md|ts|map)$/.test(l))]);
    writeFileSync(join(sortieEssai, "modules-natifs.txt"), natifs.join("\n"));
    /*
     * Le plus long chemin posé, compté depuis le dossier de données : sans
     * « chemins longs » activés (réglage de Windows, éteint d'office), un
     * chemin de plus de 260 caractères ne s'ouvre pas. Chez une personne, le
     * dossier de données est `C:\Users\<nom>\.helix\data`.
     */
    let plusLong = "";
    const parcourir = (d) => {
      let entrees = [];
      try {
        entrees = readdirSync(d, { withFileTypes: true });
      } catch {
        return;
      }
      for (const e of entrees) {
        const f = join(d, e.name);
        if (f.length > plusLong.length) plusLong = f;
        if (e.isDirectory() && !e.isSymbolicLink()) parcourir(f);
      }
    };
    // Par la jonction `node`, comme npm y écrit (le dossier réel porte la version, 17 caractères de plus).
    parcourir(prefixe);
    const relatif = plusLong.slice(donnees.length);
    const chezUnePersonne = "C:\\Users\\Jean-Baptiste Dupont\\.helix\\data".length + relatif.length;
    const mesure = `plus long chemin posé : ${plusLong.length} caractères ici, ${relatif.length} sous le dossier de données, soit ${chezUnePersonne} pour « C:\\Users\\Jean-Baptiste Dupont\\.helix\\data »\n${relatif}`;
    console.log(`  (${mesure.split("\n")[0]})`);
    writeFileSync(join(sortieEssai, "chemins.txt"), mesure);
    const scripts = join(prefixe, "node_modules", "openclaw", "scripts");
    mkdirSync(join(sortieEssai, "scripts-openclaw"), { recursive: true });
    for (const f of ["preinstall-package-manager-warning.mjs", "postinstall-bundled-plugins.mjs"]) if (existsSync(join(scripts, f))) cpSync(join(scripts, f), join(sortieEssai, "scripts-openclaw", f));
    if (existsSync(join(dependances, "koffi", "cnoke.cjs"))) cpSync(join(dependances, "koffi", "cnoke.cjs"), join(sortieEssai, "scripts-openclaw", "koffi-cnoke.cjs"));
    /*
     * Chaque module natif (`.node`) posé : les DLL dont il a besoin (table
     * d'import du fichier PE), et s'il se charge dans le Node privé. Une DLL
     * du Visual C++ (`VCRUNTIME140.dll`, `MSVCP140.dll`) est là sur la machine
     * de GitHub (Visual Studio y est installé), pas forcément chez une
     * personne ; et un module qui ne se charge pas fait recompiler
     * (node-gyp-build, cnoke), ce qui échoue sans outils de compilation.
     */
    if (windows) {
      const modules = [];
      const chercher = (d) => {
        let entrees = [];
        try {
          entrees = readdirSync(d, { withFileTypes: true });
        } catch {
          return;
        }
        for (const e of entrees) {
          const f = join(d, e.name);
          if (e.isDirectory() && !e.isSymbolicLink()) chercher(f);
          else if (e.name.endsWith(".node")) modules.push(f);
        }
      };
      chercher(join(prefixe, "node_modules", "openclaw"));
      const nodePrive = join(prefixe, "node.exe");
      // L'éditeur de liens (en-tête PE) : la bibliothèque de Microsoft en place doit être au moins de cette version (29/09/2026).
      const decrire = (f) => {
        try {
          const b = readFileSync(f);
          return `  imports : ${importsPE(b).join(", ")}\n  éditeur de liens : ${lieurPE(b)}`;
        } catch (err) {
          return `  imports : illisible (${err instanceof Error ? err.message : err})`;
        }
      };
      const lignes = modules.map((m) => {
        const charge = spawnSync(nodePrive, ["-e", "require(process.argv[1])", m], { encoding: "utf8", timeout: 30_000, windowsHide: true });
        return `${m.slice(prefixe.length)}\n${decrire(m)}\n  chargement : ${charge.status === 0 ? "oui" : `non (${String(charge.stderr).trim().split(/\r?\n/).slice(0, 3).join(" | ")})`}`;
      });
      lignes.unshift(`\\node.exe (Node privé)\n${decrire(nodePrive)}`);
      writeFileSync(join(sortieEssai, "modules-dll.txt"), lignes.join("\n"));
      const vc = modules.filter((_, i) => /VCRUNTIME|MSVCP/i.test(lignes[i].split("\n")[1] ?? ""));
      console.log(`  (${modules.length} modules natifs posés ; ${vc.length} demandent le Visual C++ : ${vc.map((m) => m.split(/[\\/]node_modules[\\/]/).pop()).join(", ") || "aucun"})`);
    }
  }
  // Toute la sortie à l'écran quand l'installation échoue : c'est elle qu'on lit dans le journal de GitHub.
  if (!reussie) console.log(sortie.split(/\r?\n/).map((l) => `    | ${l}`).join("\n"));
  verifier("installation réelle : Node épinglé, puis openclaw@2026.9.4 par npm-cli.js avec --prefix, vérifié", reussie, sortie.slice(-600));
  verifier("installation réelle : rien hors du dossier de données jetable (dossier personnel vide de .openclaw et de .npm-global)", !existsSync(join(maison, ".openclaw")) && !existsSync(join(maison, ".npm-global")), "écrit hors du dossier");
  if (lancement) {
    const port = await new Promise((ok) => {
      const s = createServer();
      s.listen(0, "127.0.0.1", () => {
        const { port: p } = s.address();
        s.close(() => ok(p));
      });
    });
    const etatOc = join(racine, "etat-openclaw");
    mkdirSync(etatOc, { recursive: true });
    writeFileSync(join(etatOc, "openclaw.json"), JSON.stringify({ gateway: { mode: "local", bind: "loopback", port, auth: { mode: "token", token: "jeton-" + "essai-" + port } }, discovery: { mdns: { mode: "off" } }, telemetry: { enabled: false }, update: { checkOnStart: false } }));
    // L'environnement que Helix donne à OpenClaw (employes.ts, envOpenClaw), en plus court : sous Windows, SystemRoot, ComSpec, TEMP et le PATH en `;`.
    const plateforme = process.platform;
    const envOc = windows
      ? P.garderVariables(process.env, ["SystemRoot", "windir", "ComSpec", "PATHEXT", "TEMP", "TMP", "APPDATA", "LOCALAPPDATA", "ProgramFiles", "ProgramFiles(x86)", "ProgramW6432", "ProgramData", "SystemDrive", "PSModulePath", "USERNAME", "COMPUTERNAME", "OS", "PROCESSOR_ARCHITECTURE", "NUMBER_OF_PROCESSORS"], [], plateforme)
      : { TMPDIR: tmpdir() };
    P.poserPath(envOc, P.joindrePath([dirname(lancement.node), P.pathSysteme(plateforme, process.env)], plateforme), plateforme);
    Object.assign(envOc, { HOME: maison, USERPROFILE: maison, OPENCLAW_STATE_DIR: etatOc, OPENCLAW_CONFIG_PATH: join(etatOc, "openclaw.json") });
    const version = spawnSync(lancement.fichier, [...lancement.prefixe, "--version"], { env: envOc, encoding: "utf8", timeout: 120_000, windowsHide: true });
    verifier("OpenClaw installé répond à --version, lancé comme Helix le lance (node.exe openclaw.mjs sous Windows)", /2026\.9\.4/.test(version.stdout ?? ""), `${version.status} ${version.stdout} ${version.stderr}`);
    const p = spawn(lancement.fichier, [...lancement.prefixe, "gateway", "run", "--port", String(port)], { env: envOc, stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
    let journal = "";
    p.stdout.on("data", (b) => (journal += b));
    p.stderr.on("data", (b) => (journal += b));
    let ouvert = false;
    const debutOuverture = Date.now();
    for (let i = 0; i < 240 && !ouvert && p.exitCode === null; i++) {
      try {
        await fetch(`http://127.0.0.1:${port}/`, { signal: AbortSignal.timeout(1000) });
        ouvert = true;
      } catch {
        await new Promise((ok) => setTimeout(ok, 500));
      }
    }
    verifier(`OpenClaw jetable lancé comme Helix le lance (port ${port}, jamais 18789 ni 18800) : il ouvre son port`, ouvert, journal.slice(-600));
    // Mesuré pour régler l'attente de Helix (employes.ts, OUVERTURE_ESSAIS) : 45 s ne suffisaient pas sur un vrai PC.
    console.log(`   port ouvert en ${Math.round((Date.now() - debutOuverture) / 1000)} s (premier démarrage)`);
    // Arrêt par son numéro : sous Windows, taskkill de System32 sur tout l'arbre, comme processus.ts.
    if (windows) {
      const tk = P.commandeArretArbre(p.pid, process.env);
      spawnSync(tk.fichier, tk.args, { windowsHide: true });
    } else p.kill("SIGTERM");
    await new Promise((ok) => {
      const m = setTimeout(() => {
        p.kill("SIGKILL");
        ok();
      }, 10_000);
      p.once("exit", () => {
        clearTimeout(m);
        ok();
      });
    });
    if (sortieEssai) writeFileSync(join(sortieEssai, "passerelle-openclaw.txt"), journal);

    /*
     * `--sans-vcruntime` (machine jetable seulement) : `VCRUNTIME140.dll`
     * retirée de System32 le temps de l'essai (renommée, puis remise), pour
     * voir de nos yeux ce qu'un PC sans Visual C++ ferait : la détection de
     * Helix doit dire « absentes », les deux modules qui l'importent ne se
     * chargent plus, et l'on note si OpenClaw démarre quand même. Un Windows
     * où le renommage est refusé passe l'essai sans le faire (dit).
     */
    if (windows && process.argv.includes("--sans-vcruntime")) {
      const { renameSync } = await import("node:fs");
      const dll = join(process.env.SystemRoot ?? "C:\\Windows", "System32", "vcruntime140.dll");
      const mise = `${dll}.helix-essai`;
      let retiree = false;
      try {
        renameSync(dll, mise);
        retiree = true;
      } catch (err) {
        console.log(`  (VCRUNTIME140.dll non retirée : ${err instanceof Error ? err.message : err} ; essai sans la DLL sauté)`);
      }
      if (retiree) {
        const rapport = [];
        try {
          const r = V.lireReleve(ps(V.SCRIPT_RELEVE, { HELIX_VC_ARCH: process.arch, HELIX_VC_DLL: V.DLL_VISUAL_CPP.join(";") }).sortie);
          const verdict = r ? V.verdictVisualCpp(r, process.arch) : null;
          rapport.push(`détection : ${JSON.stringify(verdict)}`);
          verifier("sans VCRUNTIME140.dll : la détection de Helix dit « absentes » (registre ignoré : c'est la DLL que Windows charge)", verdict?.etat === "absent", JSON.stringify(verdict));
          const nodePrive = lancement.node;
          const dependances = join(donnees, "openclaw-moteur", "node", "node_modules", "openclaw", "node_modules");
          const modulesVc = [join("@openclaw", `fs-safe-win32-${process.arch}-msvc`, "fs-safe-native.node"), join("@ubjs", `node-win32-${process.arch}-msvc`, `uniffi-runtime-napi.win32-${process.arch}-msvc.node`)]
            .map((m) => join(dependances, m))
            .filter((m) => existsSync(m));
          /*
           * Windows cherche une DLL aussi dans le dossier du programme et dans
           * chaque dossier du PATH : sur la machine de GitHub, bien des
           * programmes (Python, Git, outils) en posent une copie (premier essai
           * du 29/09/2026 : les modules se chargeaient encore). On les liste, et
           * les modules sont chargés avec le PATH que Helix donne à OpenClaw
           * (le Node privé, puis System32 et Windows PowerShell).
           */
          const copies = [...new Set([dirname(nodePrive), process.env.SystemRoot ?? "C:\\Windows", ...(process.env.PATH ?? "").split(";")].filter(Boolean))].filter((d) => existsSync(join(d, "vcruntime140.dll")));
          rapport.push(`copies de vcruntime140.dll hors de System32 (PATH de la machine de GitHub) : ${copies.join(" ; ") || "aucune"}`);
          const envMinimal = P.garderVariables(process.env, ["SystemRoot", "windir", "TEMP", "TMP", "USERPROFILE"], [], "win32");
          P.poserPath(envMinimal, P.joindrePath([dirname(nodePrive), P.pathSysteme("win32", process.env)], "win32"), "win32");
          const charges = modulesVc.map((m) => {
            const c = spawnSync(nodePrive, ["-e", "require(process.argv[1])", m], { env: envMinimal, encoding: "utf8", timeout: 30_000, windowsHide: true });
            rapport.push(`${m.slice(dependances.length)} : ${c.status === 0 ? "se charge" : `ne se charge pas (${String(c.stderr).trim().split(/\r?\n/).find((l) => /Error|module/i.test(l)) ?? c.status})`}`);
            return c.status === 0;
          });
          verifier("sans VCRUNTIME140.dll : les modules d'OpenClaw qui l'importent ne se chargent plus", modulesVc.length > 0 && charges.every((c) => !c), rapport.join(" | "));
          const v = spawnSync(lancement.fichier, [...lancement.prefixe, "--version"], { env: envOc, encoding: "utf8", timeout: 120_000, windowsHide: true });
          rapport.push(`openclaw --version : code ${v.status}, ${String(v.stdout).trim().slice(0, 80)} ${String(v.stderr).trim().split(/\r?\n/).slice(0, 3).join(" | ").slice(0, 400)}`);
          const g = spawn(lancement.fichier, [...lancement.prefixe, "gateway", "run", "--port", String(port)], { env: envOc, stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
          let jg = "";
          g.stdout.on("data", (b) => (jg += b));
          g.stderr.on("data", (b) => (jg += b));
          let ouvre = false;
          for (let i = 0; i < 120 && !ouvre && g.exitCode === null; i++) {
            try {
              await fetch(`http://127.0.0.1:${port}/`, { signal: AbortSignal.timeout(1000) });
              ouvre = true;
            } catch {
              await new Promise((ok) => setTimeout(ok, 500));
            }
          }
          rapport.push(`passerelle OpenClaw sans la DLL : ${ouvre ? "ouvre son port" : `n'ouvre pas son port (code ${g.exitCode})`}\n${jg.slice(-3000)}`);
          if (g.exitCode === null) {
            const tk = P.commandeArretArbre(g.pid, process.env);
            spawnSync(tk.fichier, tk.args, { windowsHide: true });
          }
          await new Promise((ok) => setTimeout(ok, 2000));
        } finally {
          renameSync(mise, dll);
        }
        const apres = V.lireReleve(ps(V.SCRIPT_RELEVE, { HELIX_VC_ARCH: process.arch, HELIX_VC_DLL: V.DLL_VISUAL_CPP.join(";") }).sortie);
        verifier("VCRUNTIME140.dll remise : la détection redit « présentes »", apres && V.verdictVisualCpp(apres, process.arch).etat === "present", JSON.stringify(apres));
        console.log(`  (sans VCRUNTIME140.dll : ${rapport.map((l) => l.split("\n")[0]).join(" ; ")})`);
        if (sortieEssai) writeFileSync(join(sortieEssai, "sans-vcruntime.txt"), rapport.join("\n"));
      }
    }
  }
  try {
    rmSync(racine, { recursive: true, force: true, maxRetries: 10 });
  } catch (err) {
    // Windows : un fichier encore tenu (antivirus, processus qui finit de s'arrêter) ; le dossier temporaire de la machine jetable part avec elle.
    console.log(`  (dossier jetable non effacé : ${err instanceof Error ? err.message : err})`);
  }
}

/**
 * Les DLL qu'un fichier PE (un `.node` de Windows) importe : table d'import
 * (répertoire 1) et imports différés (répertoire 13), lus dans le fichier.
 */
function importsPE(b) {
  const pe = b.readUInt32LE(0x3c);
  if (b.readUInt32LE(pe) !== 0x4550) throw new Error("pas un fichier PE");
  const sections = b.readUInt16LE(pe + 6);
  const tailleOptionnel = b.readUInt16LE(pe + 20);
  const optionnel = pe + 24;
  const pe32plus = b.readUInt16LE(optionnel) === 0x20b;
  const repertoires = optionnel + (pe32plus ? 112 : 96);
  const table = optionnel + tailleOptionnel;
  const versFichier = (rva) => {
    for (let i = 0; i < sections; i++) {
      const s = table + i * 40;
      const va = b.readUInt32LE(s + 12);
      const taille = Math.max(b.readUInt32LE(s + 8), b.readUInt32LE(s + 16));
      if (rva >= va && rva < va + taille) return rva - va + b.readUInt32LE(s + 20);
    }
    return -1;
  };
  const chaine = (rva) => {
    const o = versFichier(rva);
    return o < 0 ? "?" : b.toString("latin1", o, b.indexOf(0, o));
  };
  const noms = [];
  for (const [rep, pas, champ] of [[1, 20, 12], [13, 32, 4]]) {
    const rva = b.readUInt32LE(repertoires + rep * 8);
    if (!rva) continue;
    for (let o = versFichier(rva); o >= 0 && o + pas <= b.length; o += pas) {
      const nom = b.readUInt32LE(o + champ);
      if (!nom) break;
      noms.push(rep === 13 ? `${chaine(nom)} (différé)` : chaine(nom));
    }
  }
  return noms;
}

/** La version de l'éditeur de liens qui a produit un fichier PE (octets 2 et 3 de l'en-tête optionnel), et sa machine. */
function lieurPE(b) {
  const pe = b.readUInt32LE(0x3c);
  const machine = { 0x8664: "x64", 0xaa64: "arm64", 0x14c: "x86" }[b.readUInt16LE(pe + 4)] ?? b.readUInt16LE(pe + 4).toString(16);
  return `${b.readUInt8(pe + 24 + 2)}.${String(b.readUInt8(pe + 24 + 3)).padStart(2, "0")} (${machine})`;
}

/** Les fichiers d'un dossier, sur quelques niveaux (pour voir ce que npm a posé). */
function lister(dossier, profondeur, prefixe = "") {
  if (profondeur < 0) return [];
  let entrees = [];
  try {
    entrees = readdirSync(dossier, { withFileTypes: true });
  } catch {
    return [];
  }
  return entrees.flatMap((e) => [`${prefixe}${e.name}${e.isDirectory() ? "/" : ""}`, ...(e.isDirectory() ? lister(join(dossier, e.name), profondeur - 1, `${prefixe}${e.name}/`) : [])]);
}

console.log(`\n${reussis} vérification(s) réussie(s), ${echecs.length} échec(s).`);
if (echecs.length) process.exit(1);
