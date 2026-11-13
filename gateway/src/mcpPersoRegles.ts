import { existsSync, statSync } from "node:fs";
import { basename, delimiter, extname, isAbsolute, join } from "node:path";
import { t, tf } from "./langue.ts";

/**
 * Un serveur MCP ajouté par l'administrateur (16/10/2026, demande de Medhi :
 * « créer son propre MCP »). Ce module ne fait que juger ce qui est demandé :
 * la commande d'un programme de la machine, ou l'adresse d'un serveur. Le
 * branchement est dans connecteurs.ts (`ajouterPersonnalise`), la règle de qui
 * peut le faire dans index.ts. SECURITE.md § 67.
 *
 * Ce qui est refusé, et pourquoi :
 *  - **tout interpréteur de commandes** (sh, bash, zsh, cmd.exe, PowerShell…)
 *    et les scripts qui en demandent un (.sh, .bat, .cmd, .ps1…) : la
 *    commande est lancée sans shell (pas d'expansion, pas de `&&`, pas de
 *    redirection), et un shell la rouvrirait ;
 *  - **du code passé en ligne** à un interpréteur (`node -e`, `python -c`,
 *    `npx -c`…) : c'est un shell par un autre nom. Un fichier de script, lui,
 *    est accepté (`node serveur.js`, `python3 -m paquet`) ;
 *  - une commande qui ne mène à aucun fichier : un nom est cherché dans le
 *    PATH de la passerelle, et le chemin trouvé est celui qui est enregistré.
 */

/** Les interpréteurs de commandes, et ce qui lance une commande arbitraire à leur place. */
const SHELLS = new Set([
  "sh", "bash", "zsh", "dash", "ksh", "mksh", "csh", "tcsh", "fish", "ash", "busybox",
  "cmd", "command", "powershell", "pwsh", "wsl", "bash.exe", "conhost",
  "env", "sudo", "doas", "su", "runas", "nohup", "xargs", "script", "osascript", "open", "start", "launchctl", "systemd-run", "eval", "exec", "time", "nice", "timeout", "watch", "screen", "tmux",
]);

/** Les fichiers qui ne s'exécutent qu'à travers un interpréteur de commandes. */
const EXTENSIONS_SHELL = new Set([".sh", ".bash", ".zsh", ".ksh", ".csh", ".fish", ".command", ".bat", ".cmd", ".ps1", ".psm1", ".vbs", ".vbe", ".wsf", ".scpt", ".applescript", ".lnk", ".url"]);

/** Les interpréteurs, et les options par lesquelles on leur passe du code en ligne. */
const CODE_EN_LIGNE: Array<{ nom: RegExp; options: Set<string> }> = [
  { nom: /^node$/, options: new Set(["-e", "--eval", "-p", "--print", "-pe", "-ep"]) },
  { nom: /^(python|python\d+(\.\d+)?|py|pypy\d*)$/, options: new Set(["-c"]) },
  { nom: /^(ruby|perl|php|lua|luajit)$/, options: new Set(["-e", "-E", "-r"]) },
  { nom: /^(deno|bun)$/, options: new Set(["-e", "--eval", "eval", "-p", "--print"]) },
  { nom: /^(npx|pnpx|bunx)$/, options: new Set(["-c", "--call", "--shell", "-s"]) },
  { nom: /^(npm|pnpm|yarn)$/, options: new Set(["exec", "x", "run", "run-script", "dlx", "-c", "--call"]) },
  { nom: /^(uv|uvx)$/, options: new Set(["-c", "--command"]) },
  { nom: /^(tclsh|wish|Rscript|R|julia|osascript|awk|gawk|sed)$/, options: new Set(["-e", "-c", "--eval", "-E"]) },
];

/** Le nom d'un programme, sans dossier ni extension d'exécutable (« cmd.exe » → « cmd »). */
export function nomDeProgramme(commande: string): string {
  return basename(commande.replace(/\\/g, "/")).replace(/\.(exe|com)$/i, "");
}

/** Un nom de programme cherché dans le PATH de la passerelle (sous Windows, avec `.exe` ou `.com` seulement). */
function dansLePath(nom: string): string | null {
  const extensions = process.platform === "win32" ? ["", ".exe", ".com"] : [""];
  for (const d of (process.env.PATH ?? "").split(delimiter)) {
    if (!d) continue;
    for (const ext of extensions) {
      const chemin = join(d, nom + ext);
      try {
        if (existsSync(chemin) && statSync(chemin).isFile()) return chemin;
      } catch {
        /* suivant */
      }
    }
  }
  return null;
}

/**
 * La commande d'un programme de la machine est-elle acceptable ? Rend la
 * commande à enregistrer (son chemin complet, ou `npx`, que mcp.ts résout
 * lui-même), ou le refus, dans la langue de qui lit.
 */
export function jugerCommande(brute: unknown, argsBruts: unknown): { ok: true; command: string; args: string[] } | { ok: false; message: string } {
  const commande = typeof brute === "string" ? brute.trim() : "";
  if (!commande) return { ok: false, message: t("Indiquez le programme à lancer.") };
  if (commande.length > 1024 || /[\0\r\n]/.test(commande)) return { ok: false, message: t("Ce programme a un nom illisible.") };
  if (argsBruts !== undefined && !Array.isArray(argsBruts)) return { ok: false, message: t("Les arguments doivent être une liste.") };
  const args = (argsBruts as unknown[] | undefined) ?? [];
  if (args.length > 64 || args.some((a) => typeof a !== "string" || a.length > 2000 || a.includes("\0"))) {
    return { ok: false, message: t("Arguments refusés : 64 au plus, du texte de 2 000 caractères au plus chacun.") };
  }
  const liste = args as string[];
  const nom = nomDeProgramme(commande);
  const nomBas = nom.toLowerCase();
  if (SHELLS.has(nomBas) || SHELLS.has(nomBas.replace(/\d+(\.\d+)*$/, ""))) {
    return { ok: false, message: tf("« {0} » est un interpréteur de commandes : il est refusé. Indiquez directement le programme du serveur MCP et ses arguments ; ils sont lancés sans interpréteur de commandes.", nom) };
  }
  if (EXTENSIONS_SHELL.has(extname(nomBas))) {
    return { ok: false, message: tf("« {0} » est un script qui passe par un interpréteur de commandes : il est refusé. Indiquez le programme lui-même (par exemple node, python3 ou l'exécutable du serveur) et ses arguments.", nom) };
  }
  for (const regle of CODE_EN_LIGNE) {
    if (!regle.nom.test(nomBas.replace(/\.(exe|com)$/i, ""))) continue;
    const option = liste.find((a) => regle.options.has(a) || [...regle.options].some((o) => o.startsWith("--") && a.startsWith(`${o}=`)));
    if (option) return { ok: false, message: tf("« {0} {1} » passe du code en ligne au programme : refusé, c'est un interpréteur de commandes par un autre nom. Donnez plutôt le fichier du serveur (par exemple « node serveur.js »).", nom, option) };
  }
  if (nomBas === "npx") return { ok: true, command: "npx", args: liste };
  if (/[\\/]/.test(commande)) {
    if (!isAbsolute(commande)) return { ok: false, message: t("Indiquez le chemin complet du programme (qui commence par / ou par une lettre de lecteur), ou seulement son nom s'il est dans le PATH.") };
    try {
      if (!statSync(commande).isFile()) return { ok: false, message: tf("« {0} » n'est pas un fichier.", commande) };
    } catch {
      return { ok: false, message: tf("Programme introuvable : « {0} ».", commande) };
    }
    return { ok: true, command: commande, args: liste };
  }
  const trouve = dansLePath(commande);
  if (!trouve) return { ok: false, message: tf("Programme introuvable dans le PATH de cette machine : « {0} ». Indiquez son chemin complet.", commande) };
  // Le chemin trouvé a pu mener à un script de shell (`npm` sous Windows est un .cmd) : il est jugé à son tour.
  if (EXTENSIONS_SHELL.has(extname(trouve).toLowerCase())) return { ok: false, message: tf("« {0} » mène à un script qui passe par un interpréteur de commandes : il est refusé.", trouve) };
  return { ok: true, command: trouve, args: liste };
}

/**
 * Les ports de la boucle locale où un serveur ajouté ne peut pas être cherché :
 * ceux de l'instance elle-même et de ses moteurs, pour que l'instance ne se
 * parle pas à elle-même par ce détour (sa passerelle, LM Studio, OpenClaw,
 * l'interface en développement, le débogueur de Node).
 */
export function portsReserves(portPasserelle: number): Set<number> {
  return new Set([portPasserelle, 1234, 18789, 18800, 5173, 5174, 9229]);
}

/**
 * L'adresse d'un serveur MCP est-elle acceptable ? https, ou la boucle locale
 * (127.0.0.1, `localhost`, ::1) en http avec un port explicite qui n'est pas
 * l'un de ceux de l'instance. Les adresses internes en https sont jugées par
 * mcp.ts (`adresseServeurPermise`), comme pour les services du catalogue.
 */
export function jugerAdresse(brute: unknown, portPasserelle: number): { ok: true; url: string; locale: false } | { ok: true; url: string; locale: true; port: number } | { ok: false; message: string } {
  const texte = typeof brute === "string" ? brute.trim() : "";
  if (!texte) return { ok: false, message: t("Indiquez l'adresse du serveur MCP.") };
  let adresse: URL;
  try {
    adresse = new URL(texte);
  } catch {
    return { ok: false, message: t("Adresse de serveur illisible.") };
  }
  if (adresse.username || adresse.password) return { ok: false, message: t("Pas d'identifiant ni de mot de passe dans l'adresse : si le serveur en demande, il les demandera lui-même.") };
  adresse.hash = "";
  const hote = adresse.hostname.replace(/^\[|\]$/g, "");
  const boucle = hote === "127.0.0.1" || hote === "localhost" || hote === "::1";
  if (adresse.protocol === "https:" && !boucle) return { ok: true, url: adresse.toString(), locale: false };
  if (!boucle) return { ok: false, message: t("Adresse refusée : https est exigé, sauf pour un serveur de cette machine (http://127.0.0.1:port/…).") };
  if (adresse.protocol !== "http:") return { ok: false, message: t("Un serveur de cette machine s'indique en http://127.0.0.1:port/…") };
  const port = Number(adresse.port);
  if (!Number.isInteger(port) || port < 1 || port > 65535 || !adresse.port) return { ok: false, message: t("Indiquez le port du serveur de cette machine (http://127.0.0.1:port/…).") };
  if (portsReserves(portPasserelle).has(port)) return { ok: false, message: tf("Le port {0} est celui d'un service de cette instance : choisissez le port de votre serveur MCP.", port) };
  // Toujours 127.0.0.1 : mcp.ts n'accepte que cette forme pour un serveur de la machine.
  return { ok: true, url: `http://127.0.0.1:${port}${adresse.pathname}${adresse.search}`, locale: true, port };
}

/** Les variables d'environnement données au programme : des noms de variables, jamais celles de l'instance. */
export function jugerVariables(brutes: unknown): { ok: true; variables: Record<string, string> } | { ok: false; message: string } {
  if (brutes === undefined || brutes === null) return { ok: true, variables: {} };
  if (typeof brutes !== "object" || Array.isArray(brutes)) return { ok: false, message: t("Les variables doivent être des paires NOM=valeur.") };
  const variables: Record<string, string> = {};
  for (const [nom, valeur] of Object.entries(brutes as Record<string, unknown>)) {
    if (!/^[A-Za-z_][A-Za-z0-9_]{0,63}$/.test(nom)) return { ok: false, message: tf("Nom de variable refusé : « {0} » (lettres, chiffres et souligné).", nom) };
    if (/^HELIX_/i.test(nom)) return { ok: false, message: tf("« {0} » : les variables qui commencent par HELIX_ sont celles de l'instance, elles ne se transmettent pas.", nom) };
    if (typeof valeur !== "string" || valeur.length > 8000 || valeur.includes("\0")) return { ok: false, message: tf("Valeur refusée pour « {0} ».", nom) };
    if (valeur) variables[nom] = valeur;
  }
  if (Object.keys(variables).length > 32) return { ok: false, message: t("32 variables au plus.") };
  return { ok: true, variables };
}

/** 13/11/2026 : clés HTTP scellées avec le serveur, jamais dans son adresse. */
export function jugerEntetes(brut: unknown): { ok: true; entetes: Record<string, string> } | { ok: false; message: string } {
  const refus = () => ({ ok: false as const, message: t("En-têtes refusés : 16 au plus, noms HTTP valides, valeurs sans saut de ligne et 8 000 caractères au plus.") });
  if (brut === undefined) return { ok: true, entetes: {} };
  if (!brut || typeof brut !== "object" || Array.isArray(brut)) return refus();
  const liste = Object.entries(brut);
  if (liste.length > 16) return refus();
  const entetes: Record<string, string> = Object.create(null);
  const interdits = /^(host|connection|content-length|transfer-encoding|proxy-.*|cookie|set-cookie|origin|referer|accept|content-type|mcp-.*|sec-.*|upgrade|te|trailer)$/i;
  for (const [nom, valeur] of liste) {
    const cle = nom.toLowerCase();
    if (!/^[!#$%&'*+.^_`|~0-9a-z-]{1,128}$/i.test(nom) || interdits.test(nom) || typeof valeur !== "string" || !valeur.trim() || valeur.length > 8000 || /[^\t\x20-\x7e\x80-\xff]/.test(valeur) || cle in entetes) return refus();
    entetes[cle] = valeur.trim();
  }
  return { ok: true, entetes };
}
