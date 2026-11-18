import { execFile } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { isAbsolute, join } from "node:path";
import { promisify } from "node:util";
import { t, tf } from "./langue.ts";

/**
 * Roblox Studio, par le serveur MCP intégré à Studio (12/10/2026, demande de
 * Medhi).
 *
 * Lu le 12/10/2026 sur https://create.roblox.com/docs/studio/mcp : Studio sert
 * ses outils par un programme lancé en stdio, `StudioMCP`, rangé dans
 * l'application (macOS : `/Applications/RobloxStudio.app/Contents/MacOS/StudioMCP`)
 * ou par `%LOCALAPPDATA%\Roblox\mcp.bat` (Windows, par `cmd.exe /d /c`). Il faut
 * l'activer dans Studio : Assistant, « … », Manage MCP Servers, « Enable
 * Studio as MCP server ». Roblox Studio n'existe pas sous Linux. L'ancien
 * serveur `Roblox/studio-rust-mcp-server` (MIT) est archivé depuis avril 2026 :
 * Helix ne s'en sert pas.
 *
 * Rien n'est téléchargé : Helix lance le programme de l'installation de Studio
 * que la personne a faite elle-même, à son chemin fixe, jamais un chemin reçu
 * d'une requête ni relu du magasin. Sur macOS, la signature de `StudioMCP` et
 * celle de `RobloxStudio.app` sont vérifiées avant chaque lancement
 * (`codesign --verify --strict`) : certificat Developer ID d'Apple, équipe de
 * Roblox Corporation `2CFABCH843`. Équipe relue le 12/10/2026 sur
 * l'installateur officiel (https://www.roblox.com/download/studio, redirigé
 * vers setup.rbxcdn.com/mac/RobloxStudio.dmg, 10,6 Mo, publié le 07/10/2026) :
 * « Developer ID Application: Roblox Corporation (2CFABCH843) », notarié ;
 * pas encore sur un Studio installé (PROJET.md, 12/10). Si Studio était signé
 * par une autre équipe, Helix refuse de le lancer : échec fermé. Sous Windows, le fichier de commandes est
 * dans le dossier de l'utilisateur, sans signature à lire : c'est le chemin
 * que donne Roblox, rien de plus (SECURITE.md § 65).
 */

const executer = promisify(execFile);

export const TELECHARGEMENT_ROBLOX = "https://create.roblox.com/docs/studio/setup";
export const DOCUMENTATION_ROBLOX = "https://create.roblox.com/docs/studio/mcp";

/*
 * Pour les essais seulement (scripts/essai-roblox-blender.mjs) :
 * `HELIX_ESSAI_ROBLOX_EXECUTABLE` (chemin absolu) remplace le programme et sa
 * vérification de signature (le faux serveur est un script Node). Posée par
 * qui lance la passerelle, jamais par une requête.
 */
const executableEssai = (): string | null => {
  const brut = process.env.HELIX_ESSAI_ROBLOX_EXECUTABLE;
  return brut && isAbsolute(brut) ? brut : null;
};

/** Roblox Studio tourne sur macOS et Windows : la fiche ne se montre que là. */
export const robloxProposable = (): boolean => process.platform === "darwin" || process.platform === "win32";

const appMac = (): string =>
  ["/Applications/RobloxStudio.app", join(homedir(), "Applications", "RobloxStudio.app")].find((c) => existsSync(c)) ?? "/Applications/RobloxStudio.app";
const batWindows = (): string => join(process.env.LOCALAPPDATA ?? join(homedir(), "AppData", "Local"), "Roblox", "mcp.bat");

/*
 * `cmd.exe /d /c <chemin>` : `/d` pour ne pas exécuter les commandes
 * « AutoRun » du registre. `cmd` relit la ligne : un chemin qui contient l'un
 * de ses caractères spéciaux (un nom de compte « Jean & Cie »…) pourrait y
 * enchaîner une autre commande. Un tel chemin est refusé (`refusRoblox`),
 * jamais échappé à la main (relecture du 12/10/2026).
 */
const SPECIAUX_CMD = /[&|<>()^%!"]/;
export const cheminPourCmd = (chemin: string): boolean => !SPECIAUX_CMD.test(chemin);
export const argumentsCmd = (bat: string): string[] => ["/d", "/c", bat];

/** La commande, toujours tirée des chemins que donne Roblox. */
export function commandeRoblox(): { command: string; args: string[] } {
  const essai = executableEssai();
  if (essai) return { command: essai, args: [] };
  if (process.platform === "win32") {
    return { command: join(process.env.SystemRoot ?? "C:\\Windows", "System32", "cmd.exe"), args: argumentsCmd(batWindows()) };
  }
  return { command: join(appMac(), "Contents", "MacOS", "StudioMCP"), args: [] };
}

/** Signature vérifiée tant que les fichiers ne changent pas (taille, date, inœud du programme et de l'application). */
let signatureVue: { cle: string; ok: boolean } | null = null;

/** L'équipe de Roblox Corporation chez Apple (relue le 12/10/2026, voir plus haut). */
export const EQUIPE_ROBLOX = "2CFABCH843";

/** Exigence : Developer ID d'Apple (certificat d'application et feuille Developer ID), équipe de Roblox. */
export const EXIGENCE_ROBLOX = `anchor apple generic and certificate 1[field.1.2.840.113635.100.6.2.6] exists and certificate leaf[field.1.2.840.113635.100.6.1.13] exists and certificate leaf[subject.OU] = "${EQUIPE_ROBLOX}"`;

async function signatureMac(programme: string): Promise<boolean> {
  const app = appMac();
  let cle = "";
  try {
    const s = statSync(programme);
    const a = statSync(join(app, "Contents", "Info.plist"));
    cle = `${programme}:${s.size}:${s.mtimeMs}:${s.ino}:${a.size}:${a.mtimeMs}:${a.ino}`;
  } catch {
    return false;
  }
  if (signatureVue?.cle === cle) return signatureVue.ok;
  let ok = false;
  try {
    // L'application entière (ses ressources scellées comprises), puis le programme lancé.
    await executer("/usr/bin/codesign", ["--verify", "--strict", `-R=${EXIGENCE_ROBLOX}`, app], { timeout: 120_000 });
    await executer("/usr/bin/codesign", ["--verify", "--strict", `-R=${EXIGENCE_ROBLOX}`, programme], { timeout: 30_000 });
    ok = true;
  } catch {
    ok = false;
  }
  signatureVue = { cle, ok };
  return ok;
}

/** Avant chaque lancement du serveur : `null` si tout va, sinon la raison, dans la langue de qui lit. */
export async function refusRoblox(): Promise<string | null> {
  if (!robloxProposable() && !executableEssai()) return t("Roblox Studio ne fonctionne que sous macOS et Windows : il ne peut pas tourner sur la machine de cette instance.");
  const essai = executableEssai();
  if (essai) return existsSync(essai) ? null : t("Roblox Studio est introuvable sur cette machine.");
  if (process.platform === "win32") {
    if (!cheminPourCmd(batWindows())) {
      return tf("Le chemin du serveur MCP de Roblox Studio ({0}) contient un caractère que l'invite de commandes de Windows interprète (& | < > ( ) ^ % ! \") : rien n'a été lancé, par sécurité. Ce chemin vient du nom du dossier de votre compte Windows.", batWindows());
    }
    if (existsSync(batWindows())) return null;
    return tf("Le serveur MCP de Roblox Studio est introuvable sur cette machine ({0}). Installez Roblox Studio ({1}), ouvrez-le, puis activez son serveur MCP : Assistant, « … », Manage MCP Servers, « Enable Studio as MCP server ». Puis réessayez.", batWindows(), TELECHARGEMENT_ROBLOX);
  }
  if (!existsSync(appMac())) {
    return tf("Roblox Studio est introuvable sur cette machine. Installez-le ({0}) dans le dossier Applications, ouvrez-le, puis réessayez.", TELECHARGEMENT_ROBLOX);
  }
  const programme = commandeRoblox().command;
  if (!existsSync(programme)) {
    return t("Roblox Studio est installé, mais sans son serveur MCP (StudioMCP) : mettez Roblox Studio à jour, puis réessayez.");
  }
  if (!(await signatureMac(programme))) {
    return tf("Roblox Studio ou son serveur MCP n'a pas la signature de Roblox Corporation ({0}), ou l'application a été modifiée : rien n'a été lancé. Réinstallez Roblox Studio depuis son site officiel ({1}), puis réessayez.", EQUIPE_ROBLOX, TELECHARGEMENT_ROBLOX);
  }
  return null;
}

/**
 * Après le démarrage : un Studio répond-il ? `list_roblox_studios` (une
 * lecture) le dit. Le format exact de sa réponse n'a pas pu être lu ici, sans
 * Studio : on ne dit « aucun Studio » que sur une liste manifestement vide
 * (ou une réponse qui le dit) ; un échec de la demande elle-même est dit
 * comme tel, sans conclure (relecture du 12/10/2026).
 */
export function conseilRoblox(reponse: { ok: boolean; content: string } | null): string | null {
  if (!reponse || !reponse.ok) {
    const detail = (reponse?.content ?? "").replace(/\s+/g, " ").trim().slice(0, 200);
    return detail
      ? tf("La liste des Roblox Studio ouverts n'a pas pu être lue ({0}). Vérifiez que Roblox Studio est ouvert avec une place, et que son serveur MCP est activé : Assistant, « … », Manage MCP Servers, « Enable Studio as MCP server ».", detail)
      : t("La liste des Roblox Studio ouverts n'a pas pu être lue. Vérifiez que Roblox Studio est ouvert avec une place, et que son serveur MCP est activé : Assistant, « … », Manage MCP Servers, « Enable Studio as MCP server ».");
  }
  const vide = /^\s*(\[\s*\]|\{\s*\}|\(résultat vide\))?\s*$/.test(reponse.content) || /\bno (roblox )?studio|not connected|no instances?\b/i.test(reponse.content);
  return vide
    ? t("Aucun Roblox Studio ne répond pour l'instant. Ouvrez Roblox Studio et une place, puis activez son serveur MCP : Assistant, « … », Manage MCP Servers, « Enable Studio as MCP server » (un témoin vert le confirme).")
    : null;
}

/** Un délai dépassé ne prouve pas une mauvaise installation : rendre le parcours de connexion explicite. */
export function echecConnexionRoblox(detail: string): string {
  if (/timed?\s*out|timeout|délai|32001/i.test(detail)) {
    return t("Roblox Studio n'a pas répondu dans le délai prévu. Ouvrez Studio et un jeu, puis Assistant → … → Settings → MCP Servers (ou Manage MCP Servers) et activez Enable Studio as MCP server. Revenez ici et cliquez sur Réessayer. Si cela persiste, redémarrez Studio et l'application, puis vérifiez le témoin vert de connexion dans Studio.");
  }
  return tf("Le serveur MCP de Roblox Studio n'a pas démarré : {0}. Ouvrez Studio avec un jeu et vérifiez Enable Studio as MCP server dans les réglages MCP de l'Assistant.", detail);
}
