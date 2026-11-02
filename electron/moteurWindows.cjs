/**
 * Deux aides pour le moteur de LM Studio sous Windows, et le journal de la
 * passerelle (28/09/2026).
 *
 * ── Le service de LM Studio lancé par l'application ─────────────────────────
 *
 * Vu chez plusieurs personnes sous Windows avec la 2026.928.6 : « Timed out
 * waiting for LM Studio daemon to start ». Jusqu'à la 2026.928.5, la
 * passerelle était un processus ordinaire, et le service de LM Studio qu'elle
 * lançait démarrait. Depuis la 2026.928.6, elle vit dans un `utilityProcess`
 * d'Electron (fusible RunAsNode fermé), et tout ce qu'elle lance en hérite ;
 * sous Windows, ce qui est lancé depuis un processus fils de Chromium peut
 * être tenu par son objet de tâche (job). Cause non vue (pas de PC Windows
 * ici) : on rend donc au service les conditions où il démarrait, en le faisant
 * lancer par le processus principal de l'application, comme avant.
 *
 * Seulement `lms.exe` du dossier de LM Studio de ce compte, et seulement
 * `daemon up` ou `server start` : la passerelle ne peut rien faire lancer
 * d'autre par ce canal.
 *
 * ── Le journal ──────────────────────────────────────────────────────────────
 *
 * La sortie de la passerelle n'allait qu'à la console de l'application,
 * invisible sur un poste : impossible de savoir ce qui se passait chez
 * quelqu'un. Elle est désormais gardée dans `passerelle.log`, dans le dossier
 * des journaux de l'application (5 Mo au plus, l'ancien gardé en `.1`).
 */
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");

const COMMANDES = { "daemon up": 180_000, "server start": 60_000 };

/** Le `lms.exe` de LM Studio pour ce compte : `~/.lmstudio`, ou le dossier que désigne `~/.lmstudio-home-pointer` (chemin absolu, local). */
function lmsDuCompte() {
  const maison = os.homedir();
  const dossiers = [path.join(maison, ".lmstudio")];
  try {
    const pointe = fs.readFileSync(path.join(maison, ".lmstudio-home-pointer"), "utf8").trim();
    if (pointe && path.isAbsolute(pointe) && !/^[\\/]{2}/.test(pointe)) dossiers.unshift(pointe);
  } catch {
    /* pas de pointeur */
  }
  return dossiers.map((d) => path.join(d, "bin", "lms.exe"));
}

/**
 * Lance `lms <commande>` pour la passerelle. `demande` : `{ id, lms, commande }`.
 * Rend `{ code, fin }` (fin : les 4 000 dernières lettres de la sortie).
 */
function lancerLms(demande) {
  return new Promise((resolve) => {
    const delai = COMMANDES[demande.commande];
    const permis = lmsDuCompte().map((c) => path.resolve(c).toLowerCase());
    const lms = typeof demande.lms === "string" ? path.resolve(demande.lms) : "";
    if (process.platform !== "win32" || typeof delai !== "number" || !permis.includes(lms.toLowerCase()) || !fs.existsSync(lms)) {
      resolve({ code: -1, fin: "refusé : commande ou programme non prévu" });
      return;
    }
    const port = demande.port;
    if (port !== undefined && (demande.commande !== "server start" || !Number.isInteger(port) || port < 1 || port > 65535)) {
      resolve({ code: -1, fin: "refusé : port non prévu" });
      return;
    }
    let fin = "";
    const garder = (b) => {
      fin = (fin + String(b)).slice(-4000);
    };
    const enfant = spawn(lms, [...demande.commande.split(" "), ...(port !== undefined ? ["--port", String(port)] : [])], { cwd: os.homedir(), stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
    enfant.stdout.on("data", garder);
    enfant.stderr.on("data", garder);
    const garde = setTimeout(() => enfant.kill(), delai);
    enfant.on("error", (err) => {
      clearTimeout(garde);
      resolve({ code: -1, fin: `${fin}\n${err.message}` });
    });
    enfant.on("close", (code) => {
      clearTimeout(garde);
      resolve({ code, fin });
    });
  });
}

/** Le flux d'écriture du journal de la passerelle (dans `dossier`), ou null s'il ne peut pas s'ouvrir. */
function ouvrirJournal(dossier) {
  try {
    fs.mkdirSync(dossier, { recursive: true });
    const fichier = path.join(dossier, "passerelle.log");
    try {
      if (fs.statSync(fichier).size > 5 * 1024 * 1024) fs.renameSync(fichier, `${fichier}.1`);
    } catch {
      /* pas encore de journal */
    }
    const flux = fs.createWriteStream(fichier, { flags: "a", mode: 0o600 });
    flux.on("error", () => {});
    return flux;
  } catch {
    return null;
  }
}

module.exports = { lancerLms, ouvrirJournal, lmsDuCompte };
