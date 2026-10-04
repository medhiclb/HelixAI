/**
 * La ligne de commande `helix` (cli/helix.mjs), livrée avec l'application.
 *
 * Elle n'était pas dans le paquet : il fallait le dépôt et un Node installé.
 * Le paquet l'embarque maintenant (extraResources, `Resources/cli`), et un
 * bouton des Paramètres pose un petit lanceur dans `~/.local/bin/helix`.
 *
 * Le lanceur fait tourner le script avec un vrai Node (28/09/2026). Il le
 * faisait avec le binaire de l'application en mode Node (ELECTRON_RUN_AS_NODE),
 * ce qui obligeait à laisser ouvert le fusible RunAsNode, par lequel
 * n'importe quel programme du poste pouvait faire tourner son code sous
 * l'identité de Helix (SECURITE.md, « RunAsNode fermé »). Dans l'ordre :
 *  1. le Node que Helix pose lui-même (gateway/src/installationOpenClaw.ts :
 *     version épinglée, empreinte vérifiée), s'il est là ;
 *  2. sinon le Node du système, s'il est en version 20 ou plus (ce que
 *     demande cli/helix.mjs) ;
 *  3. sinon le lanceur le dit, et « Mettre en place » demande à la passerelle
 *     de poser le Node de Helix (par son canal, electron/main.cjs).
 * Le choix se fait à chaque lancement, dans le lanceur : un Node installé ou
 * retiré ensuite est pris en compte sans rien refaire.
 *
 * Aucun droit d'administrateur : rien n'est écrit hors du dossier personnel.
 * Si `~/.local/bin` n'est pas dans le PATH du shell de connexion, une ligne
 * marquée est ajoutée à `~/.zprofile` (macOS) ou `~/.profile` (Linux) ; le
 * bouton « Retirer » enlève le lanceur et cette ligne, et rien d'autre.
 *
 * Windows (04/10/2026, demande de Medhi : l'écran disait « pas encore prise
 * en charge ») : un `helix.cmd` dans `%USERPROFILE%\.helix\bin`, et ce dossier
 * ajouté au PATH du compte (registre `HKCU\Environment`), jamais à celui de la
 * machine : toujours sans droit d'administrateur. Détails plus bas, à
 * `contenuLanceurWindows` et `SCRIPT_PATH_WINDOWS`.
 *
 * Linux en AppImage : pas proposée (audit du 27/09/2026). L'application y tourne
 * depuis un dossier monté à un nouvel endroit à chaque lancement
 * (`/tmp/.mount_…`) : le lanceur aurait visé un chemin disparu au redémarrage
 * suivant. Le paquet .deb, installé à une place fixe, l'a.
 */

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFile } = require("node:child_process");

/*
 * `app` lu au moment de s'en servir : `contenuLanceur` et les essais
 * (scripts/securite.mjs) chargent ce fichier hors d'Electron.
 */
const app = () => require("electron").app;

const MARQUE = "# Ajouté par HelixAI (ligne de commande helix)";
/** La version de Node que demande cli/helix.mjs (fetch intégré, modules standard). */
const NODE_MINIMUM = 20;
const windows = () => process.platform === "win32";
/*
 * Sous Windows, un dossier à Helix dans le dossier du compte (à côté de ses
 * données, `~\.helix`), pas `~\.local\bin` : aucun usage n'y en fait un dossier
 * de commandes, et c'est nous qui l'ajoutons au PATH.
 */
const dossierLanceur = () => (windows() ? path.join(os.homedir(), ".helix", "bin") : path.join(os.homedir(), ".local", "bin"));
const lanceur = () => path.join(dossierLanceur(), windows() ? "helix.cmd" : "helix");
/*
 * Le fichier que lit vraiment le shell de connexion (revue Linux du
 * 27/09/2026) : zsh lit `~/.zprofile`, bash `~/.bash_profile` s'il existe, et
 * sinon `~/.profile`. Écrire toujours dans `~/.profile` ne servait à rien aux
 * utilisateurs de zsh.
 */
function profil() {
  const maison = os.homedir();
  if (process.platform === "darwin" || /zsh$/.test(process.env.SHELL ?? "")) return path.join(maison, ".zprofile");
  const bash = path.join(maison, ".bash_profile");
  return fs.existsSync(bash) ? bash : path.join(maison, ".profile");
}

/** Le script livré : dans le paquet, ou dans le dépôt en développement. */
function script() {
  return app().isPackaged
    ? path.join(process.resourcesPath, "cli", "helix.mjs")
    : path.join(__dirname, "..", "cli", "helix.mjs");
}

/**
 * Le Node que Helix pose : même règle que `racine()` de
 * gateway/src/installationOpenClaw.ts (la passerelle reçoit le même
 * environnement que ce processus). `node` y est un lien vers la version
 * installée : le chemin reste bon quand elle change.
 */
function nodePrive() {
  const donnees = process.env.HELIX_DATA_DIR ?? path.join(os.homedir(), ".helix", "data");
  // Windows : `node.exe` à la racine du dossier (dispositionNode, gateway/src/plateformeOpenClaw.ts), et `node` y est une « junction ».
  return windows() ? path.join(donnees, "openclaw-moteur", "node", "node.exe") : path.join(donnees, "openclaw-moteur", "node", "bin", "node");
}

/** Le nom affiché, dans le message du lanceur quand aucun Node ne convient. */
function nomProduit() {
  try {
    const nom = require("../package.json").nomAffiche;
    if (typeof nom === "string" && nom.trim()) return nom.trim();
  } catch {
    /* paquet sans nom affiché */
  }
  return "Helix";
}

const guillemets = (s) => `'${String(s).replace(/'/g, `'\\''`)}'`;

/**
 * Le lanceur. Il choisit le Node à chaque lancement (voir l'en-tête) : celui
 * de Helix, puis `node` du PATH du terminal, puis les emplacements usuels, le
 * premier en version 20 ou plus. Le message final est en français, comme toute
 * la ligne de commande (cli/textes.mjs, décision du 25/09/2026).
 */
function contenuLanceur({ script: scriptCli = script(), prive = nodePrive(), nom = nomProduit() } = {}) {
  const verifier = `process.exit(Number(process.versions.node.split(".")[0]) >= ${NODE_MINIMUM} ? 0 : 1)`;
  return [
    "#!/bin/sh",
    "# Lanceur de la ligne de commande helix, posé par l'application (Réglages).",
    `# Node : celui que l'application pose, sinon celui du système en version ${NODE_MINIMUM} ou plus.`,
    `for NODE in ${guillemets(prive)} "$(command -v node 2>/dev/null)" /opt/homebrew/bin/node /usr/local/bin/node /usr/bin/node; do`,
    `  [ -n "$NODE" ] && [ -x "$NODE" ] || continue`,
    `  "$NODE" -e ${guillemets(verifier)} 2>/dev/null || continue`,
    `  exec "$NODE" ${guillemets(scriptCli)} "$@"`,
    "done",
    `echo ${guillemets(`helix : Node ${NODE_MINIMUM} ou plus est introuvable sur cet ordinateur. Ouvrez ${nom}, Réglages › Installer les apps › CLI : « Mettre en place » pose le Node de ${nom}.`)} >&2`,
    "exit 127",
    "",
  ].join("\n");
}

/*
 * ── Windows ────────────────────────────────────────────────────────────────
 *
 * Le lanceur est un `helix.cmd` (04/10/2026). Un `.ps1` serait refusé par la
 * stratégie d'exécution par défaut des postes Windows ; un `.cmd` se lance
 * depuis PowerShell comme depuis l'Invite de commandes.
 *
 * Trois pièges d'un fichier de commandes, pour un dossier de compte comme
 * « C:\Users\Moumoune & Kiki » ou « C:\Users\Élodie » :
 *  - `&`, `(`, `)` coupent une ligne hors guillemets : chaque chemin est écrit
 *    entre guillemets, et seulement là ;
 *  - `%` est lu par cmd même entre guillemets : il est doublé ;
 *  - cmd lit le fichier dans la page de code de la console (850 en France),
 *    pas en UTF-8 : un « É » écrit en UTF-8 y devient deux caractères, et le
 *    chemin ne mène plus nulle part. Le début du chemin qui est celui du compte
 *    s'écrit donc par sa variable (`%USERPROFILE%`, `%LOCALAPPDATA%`), que cmd
 *    remplace par la vraie valeur ; et le lanceur passe la console en UTF-8
 *    (`chcp 65001`) le temps de son travail, puis remet la page d'avant, pour
 *    ce qui resterait d'accentué (application installée ailleurs, message).
 * Fins de ligne CRLF : avec des LF seuls, `goto` manque parfois son étiquette.
 *
 * Node, dans le même ordre qu'ailleurs : celui que Helix pose, puis ceux du
 * PATH (`where $PATH:node.exe` : le PATH seul, jamais le dossier courant, où
 * un projet téléchargé pourrait avoir mis un `node.exe`), en écartant
 * l'alias `WindowsApps\node.exe`, qui ouvre le Microsoft Store au lieu de
 * lancer Node. Le premier en version 20 ou plus.
 */

/** Les variables du compte dont le début d'un chemin peut s'écrire, de la plus longue à la plus courte. */
const VARIABLES_DU_COMPTE = ["LOCALAPPDATA", "APPDATA", "USERPROFILE"];

/** Un chemin pour un fichier `.cmd` (sans les guillemets, que l'appelant met) : début du compte en variable, `%` doublé. */
function cheminCmd(chemin, env = process.env) {
  const brut = String(chemin);
  for (const nom of VARIABLES_DU_COMPTE) {
    const valeur = String(env[nom] ?? "").replace(/[\\/]+$/, "");
    if (valeur && brut.toLowerCase().startsWith(`${valeur.toLowerCase()}\\`)) return `%${nom}%${brut.slice(valeur.length).replace(/%/g, "%%")}`;
  }
  return brut.replace(/%/g, "%%");
}

/** Un texte pour `echo` hors guillemets : les caractères que cmd lirait comme des ordres, neutralisés. */
const texteEcho = (s) => String(s).replace(/[\^&|<>()]/g, "^$&").replace(/%/g, "%%");

function contenuLanceurWindows({ script: scriptCli = script(), prive = nodePrive(), nom = nomProduit(), env = process.env } = {}) {
  const verifier = `process.exit(Number(process.versions.node.split('.')[0])<${NODE_MINIMUM}?1:0)`;
  const systeme = "%SystemRoot%\\System32";
  return [
    "@echo off",
    "rem Lanceur de la ligne de commande helix, posé par l'application (Réglages).",
    `rem Node : celui que l'application pose, sinon celui du PATH en version ${NODE_MINIMUM} ou plus.`,
    "setlocal DisableDelayedExpansion",
    // La page de code d'avant : le dernier mot de « Page de codes active : 850 » (« 850. » en allemand).
    `for /f "tokens=*" %%c in ('${systeme}\\chcp.com') do for %%d in (%%c) do set "HELIX_PAGE=%%d"`,
    'if defined HELIX_PAGE set "HELIX_PAGE=%HELIX_PAGE:.=%"',
    `${systeme}\\chcp.com 65001 >nul`,
    `set "HELIX_NODE=${cheminCmd(prive, env)}"`,
    `set "HELIX_SCRIPT=${cheminCmd(scriptCli, env)}"`,
    `if exist "%HELIX_NODE%" "%HELIX_NODE%" -e "${verifier}" >nul 2>&1 && goto lancer`,
    `for /f "delims=" %%n in ('${systeme}\\where.exe $PATH:node.exe 2^>nul ^| ${systeme}\\findstr.exe /v /i /l WindowsApps') do (`,
    `  "%%n" -e "${verifier}" >nul 2>&1 && (set "HELIX_NODE=%%n" & goto lancer)`,
    ")",
    `>&2 echo ${texteEcho(`helix : Node ${NODE_MINIMUM} ou plus est introuvable sur cet ordinateur. Ouvrez ${nom}, Réglages › Installer les apps › CLI : « Mettre en place » pose le Node de ${nom}.`)}`,
    `if defined HELIX_PAGE ${systeme}\\chcp.com %HELIX_PAGE% >nul`,
    "exit /b 127",
    ":lancer",
    '"%HELIX_NODE%" "%HELIX_SCRIPT%" %*',
    'set "HELIX_CODE=%ERRORLEVEL%"',
    `if defined HELIX_PAGE ${systeme}\\chcp.com %HELIX_PAGE% >nul`,
    "exit /b %HELIX_CODE%",
    "",
  ].join("\r\n");
}

/*
 * Le PATH du compte, par PowerShell (Windows PowerShell 5.1, présent sur tout
 * Windows 10 et 11), script passé encodé : aucun guillemet à échapper, et le
 * dossier arrive par une variable d'environnement, jamais dans le texte du
 * script (il peut contenir `&`, `'` ou des accents).
 *
 * Pas `setx` : il coupe la valeur à 1 024 caractères, et un PATH plus long
 * perdait sa fin. Pas `[Environment]::SetEnvironmentVariable('Path', …,
 * 'User')` sur la valeur lue par `GetEnvironmentVariable` non plus : celle-ci
 * rend les `%USERPROFILE%` déjà remplacés, et l'écriture se fait en REG_SZ ;
 * le PATH d'un compte Windows neuf commence justement par
 * `%USERPROFILE%\AppData\Local\Microsoft\WindowsApps`. On lit donc la valeur
 * brute du registre (DoNotExpandEnvironmentNames), on ajoute ou retire notre
 * seule entrée, et on réécrit en gardant le type (REG_EXPAND_SZ le plus
 * souvent). Ajouter ne fait que prolonger la valeur lue ; retirer n'enlève
 * que les entrées qui désignent notre dossier. Une lecture qui échoue arrête
 * tout avant d'écrire (règle des données, PROJET.md).
 *
 * Puis les fenêtres sont prévenues (WM_SETTINGCHANGE), pour que les terminaux
 * ouverts ensuite depuis le menu Démarrer ou l'Explorateur voient le nouveau
 * PATH : en posant puis en effaçant une variable témoin par
 * `SetEnvironmentVariable(…, 'User')`, qui envoie ce message, comme le fait
 * Chocolatey. Pas besoin de compiler un appel à SendMessageTimeout.
 */
const SCRIPT_PATH_WINDOWS = String.raw`
$ErrorActionPreference = 'Stop'
$cle = [Microsoft.Win32.Registry]::CurrentUser.CreateSubKey('Environment')
$brut = [string]$cle.GetValue('Path', '', [Microsoft.Win32.RegistryValueOptions]::DoNotExpandEnvironmentNames)
$action = $env:HELIX_CLI_ACTION
if ($action -eq 'lire') {
  $machine = [string][Environment]::GetEnvironmentVariable('Path', 'Machine')
  $b64 = { param($s) [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes([Environment]::ExpandEnvironmentVariables($s))) }
  [Console]::Out.Write((& $b64 $brut) + '|' + (& $b64 $machine))
  exit 0
}
$normal = { param($e) [Environment]::ExpandEnvironmentVariables($e.Trim().Trim('"')).TrimEnd('\').ToLowerInvariant() }
$dossier = [string]$env:HELIX_CLI_DOSSIER
$cible = & $normal $dossier
if (-not $cible) { throw 'dossier vide' }
$entrees = $brut -split ';'
$present = @($entrees | Where-Object { (& $normal $_) -eq $cible }).Count -gt 0
if ($action -eq 'ajouter') {
  if ($present) { [Console]::Out.Write('deja'); exit 0 }
  # Toujours ";" + dossier : « Retirer » rend alors exactement la valeur d'avant, ";" final compris.
  if ($brut -eq '') { $nouveau = $dossier } else { $nouveau = $brut + ';' + $dossier }
} elseif ($action -eq 'retirer') {
  if (-not $present) { [Console]::Out.Write('absent'); exit 0 }
  $nouveau = @($entrees | Where-Object { (& $normal $_) -ne $cible }) -join ';'
} else { throw 'action inconnue' }
$genre = [Microsoft.Win32.RegistryValueKind]::ExpandString
if (@($cle.GetValueNames()) -contains 'Path') {
  if ($cle.GetValueKind('Path') -eq [Microsoft.Win32.RegistryValueKind]::String) { $genre = [Microsoft.Win32.RegistryValueKind]::String }
}
if ($nouveau -eq '') { $cle.DeleteValue('Path', $false) } else { $cle.SetValue('Path', $nouveau, $genre) }
$cle.Close()
try {
  [Environment]::SetEnvironmentVariable('HELIX_CLI_DIFFUSION', '1', 'User')
  [Environment]::SetEnvironmentVariable('HELIX_CLI_DIFFUSION', [string]::Empty, 'User')
} catch { }
[Console]::Out.Write($action)
`;

/** Lance le script du PATH. `action` : lire, ajouter ou retirer. */
function pathWindows(action, dossier = dossierLanceur()) {
  const racine = process.env.SystemRoot || process.env.windir || "C:\\Windows";
  const powershell = path.join(racine, "System32", "WindowsPowerShell", "v1.0", "powershell.exe");
  const args = ["-NoLogo", "-NoProfile", "-NonInteractive", "-EncodedCommand", Buffer.from(SCRIPT_PATH_WINDOWS, "utf16le").toString("base64")];
  return new Promise((resolve) => {
    execFile(
      powershell,
      args,
      { encoding: "utf8", timeout: 60_000, windowsHide: true, env: { ...process.env, HELIX_CLI_ACTION: action, HELIX_CLI_DOSSIER: dossier } },
      (err, sortie, erreur) => resolve({ ok: !err, sortie: String(sortie).trim(), erreur: String(erreur || err?.message || "").trim() }),
    );
  });
}

/** Comparaison de deux dossiers Windows : sans casse, sans `\` final, variables remplacées. */
const memeDossierWindows = (a, b) => {
  const n = (s) =>
    String(s)
      .trim()
      .replace(/^"(.*)"$/, "$1")
      .replace(/%([^%]+)%/g, (tout, nom) => process.env[nom] ?? tout)
      .replace(/[\\/]+$/, "")
      .toLowerCase();
  return n(a) !== "" && n(a) === n(b);
};

/**
 * Le PATH du compte et celui de la machine, tels que les verra un terminal
 * ouvert maintenant (l'application, lancée plus tôt, a peut-être un PATH plus
 * ancien). Null si PowerShell n'a pas répondu. Gardé cinq minutes, comme
 * `pathDuShell`, et oublié après une modification.
 */
let registreGarde = null;
async function pathsWindows() {
  if (registreGarde && Date.now() - registreGarde.le < 5 * 60_000) return registreGarde.valeur;
  const r = await pathWindows("lire");
  let valeur = null;
  if (r.ok) {
    const [compte = "", machine = ""] = r.sortie.split("|").map((b) => Buffer.from(b, "base64").toString("utf8"));
    valeur = { compte: compte.split(";").filter((d) => d.trim()), machine: machine.split(";").filter((d) => d.trim()) };
  } else console.error(`[helix] PATH du compte illisible : ${r.erreur.slice(-400)}`);
  registreGarde = { le: Date.now(), valeur };
  return valeur;
}

/** `node --version` d'un exécutable, en nombre (22 pour v22.4.1), ou 0. */
function versionNode(chemin) {
  return new Promise((resolve) => {
    execFile(chemin, ["--version"], { encoding: "utf8", timeout: 5000 }, (err, sortie) => {
      resolve(err ? 0 : Number(/^v(\d+)/.exec(String(sortie).trim())?.[1] ?? 0));
    });
  });
}

/**
 * Le Node dont se servira le lanceur, vu depuis l'application : `prive`,
 * `systeme` (dans le PATH du shell de connexion ou aux emplacements usuels),
 * ou null. Même ordre que le lanceur.
 */
async function nodeUtilisable() {
  const prive = nodePrive();
  if (fs.existsSync(prive) && (await versionNode(prive)) >= NODE_MINIMUM) return "prive";
  let dossiers;
  if (windows()) {
    // Le PATH d'un terminal ouvert maintenant (registre), puis celui de l'application ; sans l'alias du Microsoft Store.
    const registre = await pathsWindows();
    dossiers = [...(registre?.compte ?? []), ...(registre?.machine ?? []), ...(process.env.PATH ?? "").split(";")]
      .map((d) => d.trim().replace(/^"(.*)"$/, "$1"))
      .filter((d) => d && !/[\\/]WindowsApps[\\/]?$/i.test(d));
  } else dossiers = [...(await pathDuShell()).split(":").filter(Boolean), "/opt/homebrew/bin", "/usr/local/bin", "/usr/bin"];
  for (const dossier of [...new Set(dossiers)]) {
    const candidat = path.join(dossier, windows() ? "node.exe" : "node");
    if (fs.existsSync(candidat) && (await versionNode(candidat)) >= NODE_MINIMUM) return "systeme";
  }
  return null;
}

/**
 * Le PATH du shell de connexion. Une application lancée depuis le Finder n'a
 * pas celui du terminal : on le demande au shell de la personne.
 *
 * Asynchrone, et gardé cinq minutes : revue du 26/09/2026, l'appel synchrone
 * gelait le processus principal jusqu'à 4 s à chaque ouverture de l'onglet, et
 * relançait .zprofile / .zlogin à chaque fois.
 */
let pathGarde = null;
function pathDuShell() {
  if (pathGarde && Date.now() - pathGarde.le < 5 * 60_000) return Promise.resolve(pathGarde.valeur);
  const shell = process.env.SHELL || (process.platform === "darwin" ? "/bin/zsh" : "/bin/sh");
  return new Promise((resolve) => {
    execFile(shell, ["-l", "-c", 'printf %s "$PATH"'], { encoding: "utf8", timeout: 4000 }, (err, sortie) => {
      const valeur = err ? "" : String(sortie);
      pathGarde = { le: Date.now(), valeur };
      resolve(valeur);
    });
  });
}

/** Le lanceur posé par l'application porte cette phrase ; un autre programme nommé helix, non. */
const estLeNotre = (contenu) => contenu.includes("posé par l'application");

/** Pourquoi la commande n'est pas proposée ici, ou null. Windows l'a depuis le 04/10/2026. */
const empechement = () => (process.env.APPIMAGE ? "appimage" : null);

/** Le contenu attendu du lanceur, selon le système. */
const contenuAttendu = (o) => (windows() ? contenuLanceurWindows(o) : contenuLanceur(o));

/**
 * `o.script` : le script de la ligne de commande, quand ce n'est pas celui de
 * l'application (l'essai Windows, scripts/essai-windows-ci.mjs, charge ce
 * fichier hors d'Electron et lui donne la copie qu'il a posée).
 */
async function etat(o = {}) {
  const scriptCli = o.script ?? script();
  const disponible = empechement() === null && fs.existsSync(scriptCli);
  let installe = false;
  let aJour = false;
  // Un fichier ~/.local/bin/helix (ou helix.cmd) qui n'est pas le nôtre : on ne le remplace pas (revue du 26/09/2026).
  let etranger = false;
  try {
    const actuel = fs.readFileSync(lanceur(), "utf8");
    etranger = !estLeNotre(actuel);
    installe = !etranger;
    // L'application a pu être déplacée ou mise à jour ailleurs : le lanceur viserait un binaire absent.
    aJour = installe && actuel === contenuAttendu({ script: scriptCli });
  } catch {
    etranger = fs.existsSync(lanceur());
  }
  let dansLePath;
  let ligneAjoutee = false;
  if (windows()) {
    // Le PATH du compte (registre) : celui des terminaux ouverts ensuite. Illisible : celui de l'application.
    const registre = await pathsWindows();
    ligneAjoutee = Boolean(registre?.compte.some((d) => memeDossierWindows(d, dossierLanceur())));
    dansLePath = ligneAjoutee || Boolean(registre?.machine.some((d) => memeDossierWindows(d, dossierLanceur())));
    if (!registre) dansLePath = (process.env.PATH ?? "").split(";").some((d) => memeDossierWindows(d, dossierLanceur()));
  } else {
    dansLePath = (await pathDuShell()).split(":").includes(dossierLanceur());
    try {
      ligneAjoutee = fs.readFileSync(profil(), "utf8").includes(MARQUE);
    } catch {
      /* pas de profil */
    }
  }
  return {
    disponible,
    empechement: empechement(),
    // L'écran adapte ses phrases (PATH du compte, PowerShell ou Invite de commandes).
    windows: windows(),
    installe,
    aJour,
    etranger,
    dansLePath: dansLePath || ligneAjoutee,
    chemin: lanceur(),
    dossier: dossierLanceur(),
    profil: windows() ? "" : profil(),
    // Windows : le dossier est dans le PATH du compte (c'est nous qui l'y mettons, et « Retirer » l'enlève).
    ligneAjoutee,
    // Le Node dont se servira le lanceur : « prive » (celui de Helix), « systeme », ou null (aucun en version 20 ou plus).
    node: disponible ? await nodeUtilisable() : null,
  };
}

/**
 * Pose le lanceur. `demanderNodePrive` (electron/main.cjs) : quand le poste
 * n'a aucun Node qui convienne, la passerelle pose celui de Helix (sous
 * Windows aussi : l'archive `.zip` officielle, empreinte épinglée,
 * gateway/src/installationOpenClaw.ts). Le lanceur est posé même si cela
 * échoue : il le dira à chaque lancement, et l'état rendu porte la raison
 * (`erreurNode`), que l'écran affiche. Sous Windows, `erreurPath` : le
 * lanceur est posé mais le PATH du compte n'a pas pu être modifié (l'écran
 * dit de le faire à la main).
 */
async function installer({ demanderNodePrive, script: scriptCli = script() } = {}) {
  if (empechement()) throw new Error("Pas avec l'AppImage : installez le paquet .deb.");
  if (!fs.existsSync(scriptCli)) throw new Error("La ligne de commande est absente de ce paquet.");
  if (fs.existsSync(lanceur())) {
    let actuel = "";
    try {
      actuel = fs.readFileSync(lanceur(), "utf8");
    } catch {
      /* illisible : traité comme étranger */
    }
    if (!estLeNotre(actuel)) return etat({ script: scriptCli });
  }
  let erreurNode;
  if (!(await nodeUtilisable()) && typeof demanderNodePrive === "function") {
    const r = await demanderNodePrive();
    if (!r.ok) erreurNode = r.erreur || "inconnue";
  }
  poser(scriptCli);
  let erreurPath = false;
  if (windows()) {
    const r = await pathWindows("ajouter");
    registreGarde = null;
    if (!r.ok) {
      erreurPath = true;
      console.error(`[helix] PATH du compte non modifié : ${r.erreur.slice(-400)}`);
    }
  } else if (!(await pathDuShell()).split(":").includes(dossierLanceur())) {
    let actuel = "";
    try {
      actuel = fs.readFileSync(profil(), "utf8");
    } catch {
      /* profil absent : il sera créé */
    }
    if (!actuel.includes(MARQUE)) {
      const ajout = `${actuel && !actuel.endsWith("\n") ? "\n" : ""}\n${MARQUE}\nexport PATH="$HOME/.local/bin:$PATH"\n`;
      fs.appendFileSync(profil(), ajout);
    }
  }
  return { ...(await etat({ script: scriptCli })), ...(erreurNode ? { erreurNode } : {}), ...(erreurPath ? { erreurPath } : {}) };
}

/** Écrit le lanceur (à côté, puis renommé). */
function poser(scriptCli = script()) {
  fs.mkdirSync(dossierLanceur(), { recursive: true });
  const tmp = `${lanceur()}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, contenuAttendu({ script: scriptCli }), { mode: 0o755 });
  fs.renameSync(tmp, lanceur());
}

/**
 * Au démarrage : un lanceur posé par une version d'avant le 28/09/2026
 * lançait le binaire de l'application avec ELECTRON_RUN_AS_NODE. Le fusible
 * RunAsNode étant fermé, il ouvrirait l'application au lieu de la ligne de
 * commande. Il est réécrit, seulement s'il est le nôtre et de cette forme
 * ancienne : rien n'est téléchargé ici, le lanceur dira s'il manque Node.
 * Rien à faire sous Windows, qui n'a jamais eu cette forme.
 */
function remplacerAncienLanceur() {
  if (empechement() || windows()) return false;
  try {
    const actuel = fs.readFileSync(lanceur(), "utf8");
    if (!estLeNotre(actuel) || !actuel.includes("ELECTRON_RUN_AS_NODE") || !fs.existsSync(script())) return false;
    poser();
    return true;
  } catch {
    return false;
  }
}

async function retirer(o = {}) {
  try {
    const actuel = fs.readFileSync(lanceur(), "utf8");
    // On ne retire qu'un lanceur posé par l'application, jamais un autre programme nommé helix.
    if (estLeNotre(actuel)) fs.rmSync(lanceur(), { force: true });
  } catch {
    /* déjà absent */
  }
  if (windows()) {
    // Le dossier est à Helix (`~\.helix\bin`) : son entrée du PATH du compte s'en va, et lui aussi s'il est vide.
    const r = await pathWindows("retirer");
    registreGarde = null;
    if (!r.ok) console.error(`[helix] PATH du compte non modifié : ${r.erreur.slice(-400)}`);
    try {
      if (fs.readdirSync(dossierLanceur()).length === 0) fs.rmdirSync(dossierLanceur());
    } catch {
      /* absent ou non vide : laissé tel quel */
    }
    return etat(o);
  }
  try {
    const actuel = fs.readFileSync(profil(), "utf8");
    if (actuel.includes(MARQUE)) {
      const nettoye = actuel.replace(new RegExp(`\\n${MARQUE.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\nexport PATH="\\$HOME/\\.local/bin:\\$PATH"\\n`), "");
      fs.writeFileSync(profil(), nettoye);
    }
  } catch {
    /* pas de profil */
  }
  return etat(o);
}

module.exports = { etat, installer, retirer, remplacerAncienLanceur, contenuLanceur, contenuLanceurWindows, cheminCmd, SCRIPT_PATH_WINDOWS, NODE_MINIMUM };
