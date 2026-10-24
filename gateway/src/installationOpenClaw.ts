import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { createWriteStream, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, readlinkSync, unlinkSync } from "node:fs";
import { homedir, release, platform, arch } from "node:os";
import { join, resolve } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { deployment } from "./deployment.ts";
import { journaliser } from "./audit.ts";
import { t, tf } from "./langue.ts";
import { renommer } from "./processus.ts";
import {
  archiveNode,
  argumentsInstallation,
  commandeExtraction,
  dispositionNode,
  envInstallation,
  lancementOpenClaw,
  raisonNpm,
  scriptsOpenClaw,
  type Lancement,
} from "./plateformeOpenClaw.ts";
import { detecterVisualCpp, installerVisualCpp } from "./visualCpp.ts";

/**
 * Installe OpenClaw pour les employés, depuis l'interface, sans droits
 * d'administrateur et sans toucher au reste de la machine.
 *
 * Même chemin que l'installateur « sans root » documenté par OpenClaw
 * (`install-cli.sh`, docs.openclaw.ai/install/installer), refait ici pas à pas
 * plutôt que d'exécuter un script téléchargé :
 *
 *  1. un Node officiel (24.22.1 LTS, épinglé avec ses empreintes, ou la version
 *     du profil), dont l'archive est vérifiée avant d'être ouverte ;
 *  2. OpenClaw installé par le npm de ce Node, dans ce même dossier, à la
 *     version qu'Helix a éprouvée (ou celle du profil), sans aucun script
 *     d'installation (`--ignore-scripts`, depuis le 29/09/2026 : voir
 *     `argumentsInstallation`) ;
 *  3. les scripts d'installation d'OpenClaw lui-même, et eux seuls, lancés par
 *     ce Node sans interpréteur de commandes (`scriptsOpenClaw`) ;
 *  4. vérification : `openclaw --version`.
 *
 * Sous Windows, avant Node (29/09/2026, décision de Medhi) : les bibliothèques
 * Visual C++ de Microsoft, sans lesquelles deux modules natifs d'OpenClaw ne
 * se chargent pas, installées par le paquet officiel de Microsoft quand elles
 * manquent, avec l'autorisation d'administrateur que Windows demande
 * (visualCpp.ts). C'est la seule étape qui en demande une.
 *
 * Tout vit dans `<données>/openclaw-moteur`. Le Node du système, la
 * configuration du shell et toute installation personnelle d'OpenClaw restent
 * tels quels. Désinstaller, c'est supprimer ce dossier.
 *
 * Sous Windows aussi depuis le 28/09/2026, sans WSL (plateformeOpenClaw.ts
 * dit pourquoi et ce qui y change) : même Node officiel en `.zip`, même npm,
 * lancé par `node.exe npm-cli.js`, et OpenClaw lancé par `node.exe
 * openclaw.mjs`, jamais par son `.cmd`.
 */

/** Version d'OpenClaw sur laquelle la configuration écrite par Helix a été éprouvée. */
export const VERSION_OPENCLAW_EPROUVEE = "2026.10.7";

/**
 * Les dépendances que npm résout pour OpenClaw et pour les serveurs d'outils
 * lancés par `npx` (mcp.ts) : seulement des versions publiées avant cette date
 * (`--before` de npm, seconde tournée de l'audit, 28/09/2026).
 *
 * Aucun de ces paquets ne publie de fichier de verrouillage (`npm-shrinkwrap`,
 * relu sur le registre) : sans date, chaque installation prend la dernière
 * version de chaque dépendance, publiée peut-être la veille. C'est la porte
 * des paquets repris par un tiers, qui publie une version piégée et compte
 * sur les installations des heures suivantes. Mesuré ce jour-là :
 * `ansi-regex` 6.4.0, publiée le 27/09/2026 à 03:34 (UTC), entrait sans date
 * dans les arbres de Firecrawl et de Kubernetes ; avec la date, 6.3.0 (du
 * 12/08), et aucun autre écart dans les treize arbres. Le registre n'accepte
 * pas qu'une version publiée soit remplacée : à date fixe, l'arbre est le
 * même d'une installation à l'autre.
 *
 * Ce n'est pas une empreinte écrite dans le code : npm vérifie chaque archive
 * contre l'empreinte que le registre publie. **Monter la version d'un paquet
 * du catalogue, ou celle d'OpenClaw, c'est avancer cette date au jour de
 * l'essai** : une version publiée après elle est refusée (`ETARGET … with a
 * date before`), et le contrôle 14 bis de `npm run securite` le rappelle.
 */
export const DEPENDANCES_NPM_AVANT = "2026-10-24T08:00:00.000Z";

const racine = () =>
  join(process.env.HELIX_DATA_DIR ?? join(homedir(), ".helix", "data"), "openclaw-moteur");

/**
 * Lanceur d'OpenClaw installé par Helix (disposition « préfixe global » du
 * Node privé) : `node/bin/openclaw`, ou `node\openclaw.cmd` sous Windows. Il
 * sert à le reconnaître ; sous Windows, on lance `node.exe openclaw.mjs`
 * (`lancementGere`).
 */
export const binaireGere = () => dispositionNode(join(racine(), "node"), platform()).lanceurOpenClaw;

/** Comment lancer l'OpenClaw de Helix (null s'il n'est pas installé). */
export const lancementGere = (): Lancement | null => lancementOpenClaw(binaireGere(), platform(), existsSync, () => null);

export type Etape = "repos" | "preparation" | "visualcpp" | "node" | "openclaw" | "verification" | "termine" | "erreur";

export interface EtatInstallation {
  etape: Etape;
  message: string;
  /** Avancement du téléchargement de Node (ou du paquet de Microsoft, étape `visualcpp`), de 0 à 100. */
  avancement?: number;
  version?: string;
  /** Version remplacée, quand c'était une mise à jour. */
  de?: string;
  /** Windows conseille de redémarrer le PC pour finir l'installation des bibliothèques de Microsoft (code 3010). */
  redemarrage?: boolean;
}

let etat: EtatInstallation = { etape: "repos", message: "" };
let enCours: Promise<void> | null = null;

export function etatInstallation(): EtatInstallation {
  return etat;
}

function executer(bin: string, args: string[], env: NodeJS.ProcessEnv, delaiMs: number, cwd?: string): Promise<{ ok: boolean; sortie: string; erreur: string; code: string }> {
  return new Promise((resolve) => {
    execFile(bin, args, { env, timeout: delaiMs, maxBuffer: 32 * 1024 * 1024, windowsHide: true, ...(cwd ? { cwd } : {}) }, (err, sortie, erreur) => {
      const e = err as (Error & { code?: unknown; signal?: unknown; killed?: boolean }) | null;
      const code = !e ? "0" : e.killed ? `arrêté après ${Math.round(delaiMs / 1000)} s` : String(e.code ?? e.signal ?? "?");
      resolve({ ok: !err, sortie: String(sortie), erreur: String(erreur) || (err ? err.message : ""), code });
    });
  });
}

/**
 * Ce que npm a dit, en entier, dans le journal de la passerelle
 * (`passerelle.log` dans l'application) : l'écran n'en montre qu'une phrase,
 * et « npm a échoué (code 1) », seul, ne permettait pas de savoir chez la
 * personne ce qui s'était arrêté (29/09/2026). Les chemins de la machine
 * restent : ce journal ne quitte pas le poste. Borné, pour une sortie folle.
 */
function journaliserNpm(quoi: string, r: { code: string; sortie: string; erreur: string }): void {
  const tout = `${r.sortie}\n${r.erreur}`.trim();
  const journal = /complete log of this run can be found in:\s*(.+?)\s*$/im.exec(tout)?.[1];
  console.error(`[openclaw] ${quoi} (code ${r.code})${journal ? `, journal complet de npm : ${journal}` : ""}\n${tout.slice(-64_000)}`);
}

/**
 * Archive officielle de Node pour cette machine, ou la raison pour laquelle il
 * n'y en a pas. La même pour OpenClaw et pour l'atelier : sous Windows, elle
 * ne servait qu'à l'atelier (27/09/2026), OpenClaw y demandant WSL ; depuis
 * le 28/09/2026, OpenClaw s'y installe aussi, en natif.
 */
const plateformeNode = () => archiveNode({ platform: platform(), arch: arch(), release: release() });

/** Le Node privé : `node.exe` à la racine de son dossier sous Windows, dans `bin/` ailleurs. */
const executableNode = (dossier: string) => dispositionNode(dossier, platform()).node;

/**
 * Le npm du Node privé, s'il est installé : son script (`npm-cli.js`), que
 * l'atelier lance par Node (atelier.ts).
 */
export function npmPrive(): string | null {
  const dossier = join(racine(), "node");
  // Le script lui-même, lancé par Node (atelier.ts) : `bin/npm` passe par `env node`, introuvable sans Node sur la machine.
  const npm = dispositionNode(dossier, platform()).npmCli;
  return existsSync(npm) && existsSync(executableNode(dossier)) ? npm : null;
}

/**
 * Le Node privé pour lancer `npx` (serveurs MCP, mcp.ts) : son exécutable, son
 * dossier (à mettre en tête du PATH, pour que les paquets lancés trouvent
 * `node`) et le script de `npx`. Null s'il n'est pas installé.
 */
export function npxPrive(): { node: string; dossier: string; script: string } | null {
  const d = dispositionNode(join(racine(), "node"), platform());
  return existsSync(d.node) && existsSync(d.npxCli) ? { node: d.node, dossier: d.dossierBin, script: d.npxCli } : null;
}

/** Le Node privé peut-il être installé ici ? La raison sinon. */
export function nodePriveInstallable(): string | null {
  const p = plateformeNode();
  return "erreur" in p ? p.erreur : null;
}

/** Installe le Node privé seul (sans OpenClaw), pour l'atelier. Rend le chemin de son npm. */
export async function assurerNodePrive(): Promise<string> {
  const deja = npmPrive();
  if (deja) return deja;
  await installerNode();
  const npm = npmPrive();
  if (!npm) throw new Error(t("Node s'est installé, mais son npm est introuvable."));
  return npm;
}

/** `fetch`, avec une erreur en français quand le réseau manque (« fetch failed » sinon). */
async function telecharger(url: string, delaiMs: number): Promise<Response> {
  try {
    return await fetch(url, { signal: AbortSignal.timeout(delaiMs) });
  } catch {
    throw new Error(tf("{0} est injoignable : vérifiez l'accès à internet de cette machine.", new URL(url).host));
  }
}

/*
 * Node épinglé, avec l'empreinte SHA-256 de chaque archive écrite ici (revue
 * de sécurité du 27/09/2026, relevées ce jour-là dans `SHASUMS256.txt` de
 * nodejs.org ; 24.22.1 le 24/10/2026, correctif de sécurité des certificats
 * compromis d'octobre 2026, exigé par OpenClaw depuis sa 2026.10.6) : avant, Helix prenait la dernière 24 LTS publiée et son
 * empreinte sur le même serveur. Une version imposée par le profil
 * (`openclaw.node`) reste possible : c'est alors l'exploitant qui la choisit,
 * et son empreinte est lue dans `SHASUMS256.txt`.
 */
const NODE_EPINGLE = "24.22.1";
const EMPREINTES_NODE: Record<string, string> = {
  "node-v24.22.1-darwin-arm64.tar.gz": "89c682593d76cd44233fa53b1563264e7de9cbb189cad169135c5b4fadfbc0a7",
  "node-v24.22.1-darwin-x64.tar.gz": "d132557e7ee2b85af08b0c8c34338e65c6430f2238d01f727728ef42dc83b035",
  "node-v24.22.1-linux-x64.tar.gz": "eb6728e77c576a35162c122c45ccadf224d89ff00abc8dae46cc2897c6002d7c",
  "node-v24.22.1-linux-arm64.tar.gz": "33c37be234ba8bee041961047b19160f4d7d0f164e8e246f78bdd10feff148b3",
  "node-v24.22.1-win-x64.zip": "d2046d28c2c3dcd211ac5145c0bf30e2047ef9dfb306693c8c6e2eccd8b95fa5",
  "node-v24.22.1-win-arm64.zip": "a0c807319fede24c4a0d8f84564c82a619bd313b16b10c007c383c2609e99171",
};

const versionNode = (): string => deployment().openclaw?.node?.replace(/^v/, "") || NODE_EPINGLE;

/*
 * Une installation à la fois (revue de sécurité du 27/09/2026) : l'atelier et
 * deux serveurs d'outils pouvaient la demander ensemble, et chacune effaçait
 * puis remettait le dossier de Node sous l'autre, en train de s'en servir.
 * Une seule file depuis le 28/09/2026 : OpenClaw et l'atelier posent le même
 * Node, et deux files distinctes l'auraient posé deux fois en même temps.
 */
let nodeEnCours: Promise<string> | null = null;
function installerNode(): Promise<string> {
  nodeEnCours ??= installerNodeUneFois().finally(() => {
    nodeEnCours = null;
  });
  return nodeEnCours;
}

async function installerNodeUneFois(): Promise<string> {
  const p = plateformeNode();
  if ("erreur" in p) throw new Error(p.erreur);
  const version = versionNode();
  const nom = `node-v${version}-${p.dossier}`;
  const dossierNode = join(racine(), nom);
  const lien = join(racine(), "node");
  if (existsSync(executableNode(dossierNode))) {
    relier(lien, nom);
    return version;
  }

  const base = `https://nodejs.org/dist/v${version}`;
  let attendue: string | undefined = version === NODE_EPINGLE ? EMPREINTES_NODE[`${nom}${p.extension}`] : undefined;
  if (version !== NODE_EPINGLE) {
    const sommes = await telecharger(`${base}/SHASUMS256.txt`, 20_000);
    if (!sommes.ok) throw new Error(tf("Empreintes de Node introuvables ({0}).", sommes.status));
    attendue = (await sommes.text())
      .split("\n")
      .map((l) => l.trim().split(/\s+/))
      .find(([, f]) => f === `${nom}${p.extension}`)?.[0];
  }
  if (!attendue) throw new Error(t("Empreinte de l'archive de Node introuvable."));

  const r = await telecharger(`${base}/${nom}${p.extension}`, 10 * 60_000);
  if (!r.ok || !r.body) throw new Error(tf("Téléchargement de Node impossible ({0}).", r.status));
  /*
   * Dans un dossier à soi (0700), pas dans le dossier temporaire commun : sous
   * Linux, `/tmp` est partagé, et un autre compte pouvait y préparer le nom
   * de l'archive (lien vers un fichier de ce compte) ou la remplacer entre la
   * vérification de l'empreinte et l'extraction. Même règle que pythonPrive.ts
   * et opencodePrive.ts (audit de la chaîne d'approvisionnement du 27/09/2026).
   */
  mkdirSync(racine(), { recursive: true, mode: 0o700 });
  const dossierArchive = mkdtempSync(join(racine(), ".telechargement-"));
  const archive = join(dossierArchive, `${nom}${p.extension}`);
  const total = Number(r.headers.get("content-length") ?? 0);
  const empreinte = createHash("sha256");
  let recu = 0;
  const flux = Readable.fromWeb(r.body as import("node:stream/web").ReadableStream<Uint8Array>);
  flux.on("data", (morceau: Buffer) => {
    empreinte.update(morceau);
    recu += morceau.length;
    if (total > 0) etat = { ...etat, avancement: Math.round((recu / total) * 100) };
  });
  try {
    await pipeline(flux, createWriteStream(archive, { mode: 0o600, flags: "wx" }));
  } catch {
    rmSync(dossierArchive, { recursive: true, force: true });
    throw new Error(t("Le téléchargement de Node s'est interrompu : vérifiez la connexion, puis réessayez."));
  }
  if (empreinte.digest("hex") !== attendue) {
    rmSync(dossierArchive, { recursive: true, force: true });
    throw new Error(t("L'archive de Node ne correspond pas à son empreinte officielle : installation arrêtée."));
  }

  mkdirSync(racine(), { recursive: true, mode: 0o700 });
  const provisoire = join(racine(), `.extraction-${Date.now()}`);
  mkdirSync(provisoire, { recursive: true });
  // Le `tar` du système : sous Windows, celui de Windows, qui ouvre aussi les .zip (celui de Git ne sait pas lire `C:`).
  const tar = commandeExtraction(archive, provisoire, p.extension, platform(), process.env);
  const extraction = await executer(tar.fichier, tar.args, process.env, 5 * 60_000);
  rmSync(dossierArchive, { recursive: true, force: true });
  if (!extraction.ok) {
    rmSync(provisoire, { recursive: true, force: true });
    throw new Error(tf("Extraction de Node impossible : {0}", extraction.erreur.slice(-200)));
  }
  // Déjà posé entre-temps (autre processus) : on garde celui en place, on ne l'efface pas sous qui s'en sert.
  if (existsSync(executableNode(dossierNode))) {
    rmSync(provisoire, { recursive: true, force: true });
  } else {
    rmSync(dossierNode, { recursive: true, force: true });
    try {
      renommer(join(provisoire, nom), dossierNode);
    } finally {
      rmSync(provisoire, { recursive: true, force: true });
    }
  }
  relier(lien, nom);
  return version;
}

/** `<racine>/node` pointe sur la version installée : l'exécutable d'OpenClaw garde un chemin stable. */
function relier(lien: string, cible: string): void {
  try {
    const actuel = readlinkSync(lien);
    /*
     * Sous Windows, une « junction » se relit en chemin absolu : comparée au
     * nom relatif, elle paraissait toujours fausse, et était effacée puis
     * refaite à chaque appel, même sous qui s'en servait (revue Windows du
     * 27/09/2026).
     */
    const memeCible =
      platform() === "win32"
        ? resolve(actuel).replace(/[\\/]+$/, "").toLowerCase() === join(racine(), cible).toLowerCase()
        : actuel === cible;
    if (memeCible) return;
    unlinkSync(lien);
  } catch {
    /* pas encore de lien */
  }
  // Sous Windows, une « junction » (un lien de dossier ordinaire y demande les droits d'administration), vers un chemin absolu.
  if (platform() === "win32") symlinkSync(join(racine(), cible), lien, "junction");
  else symlinkSync(cible, lien);
}

async function installerPaquet(version: string): Promise<string> {
  /*
   * npm lancé par le Node privé, sur son script (`npm-cli.js`) : sous Windows,
   * `npm.cmd` ne se lance pas sans `cmd.exe` ; ailleurs, `bin/npm` faisait la
   * même chose en passant par `env node`. Préfixe global écrit en toutes
   * lettres (28/09/2026) : un `.npmrc` de la personne (`prefix=`), ou
   * `%APPDATA%\npm` sous Windows, aurait posé OpenClaw ailleurs que là où
   * Helix le cherche.
   */
  const prefixe = join(racine(), "node");
  const d = dispositionNode(prefixe, platform());
  const env = envInstallation(process.env, d.dossierBin, platform());
  const npm = (args: string[], delaiMs: number) => executer(d.node, [d.npmCli, ...args], env, delaiMs);
  const v = await npm(["--version"], 30_000);
  if (!v.ok) throw new Error(t("npm, livré avec Node, ne répond pas."));
  /*
   * Ses dépendances à la date de l'essai (DEPENDANCES_NPM_AVANT), pour la
   * version éprouvée seulement : une version choisie par le profil peut être
   * plus récente que la date, et serait refusée.
   */
  const args = argumentsInstallation(version, prefixe, {
    avant: version === VERSION_OPENCLAW_EPROUVEE ? DEPENDANCES_NPM_AVANT : undefined,
  });
  const r = await npm(args, 20 * 60_000);
  const lancement = lancementGere();
  if (!r.ok || !existsSync(binaireGere()) || !lancement) {
    journaliserNpm(`npm install openclaw@${version} a échoué`, r);
    // Où lire le reste : la phrase à l'écran ne remplace pas la sortie de npm, que la personne peut transmettre.
    throw new Error(tf("OpenClaw ne s'est pas installé : {0}. La sortie complète de npm est dans le journal de la passerelle (passerelle.log).", raisonNpm(`${r.erreur}\n${r.sortie}`, version)));
  }
  /*
   * Les scripts d'installation d'OpenClaw, et eux seuls (npm les a sautés,
   * `--ignore-scripts`) : par le Node privé, dans le dossier du paquet, sans
   * `cmd.exe` ni `sh`. Sans son `postinstall`, OpenClaw garde sa marque
   * « installation en cours ». Une erreur ici dit l'étape et la cause, pas
   * « npm a échoué (code 1) ».
   */
  const dossierPaquet = join(d.paquets, "openclaw");
  let manifeste: unknown = null;
  try {
    manifeste = JSON.parse(readFileSync(join(dossierPaquet, "package.json"), "utf8"));
  } catch {
    throw new Error(t("OpenClaw ne s'est pas installé : son package.json est illisible."));
  }
  const scripts = scriptsOpenClaw(manifeste, dossierPaquet, platform());
  if ("erreur" in scripts) throw new Error(tf("OpenClaw ne s'est pas installé : {0}", scripts.erreur));
  for (const s of scripts) {
    const rs = await executer(d.node, [s.fichier], env, 5 * 60_000, dossierPaquet);
    if (!rs.ok) {
      journaliserNpm(`script ${s.etape} d'openclaw@${version} a échoué`, rs);
      throw new Error(tf("OpenClaw ne s'est pas installé : son script d'installation ({0}) s'est arrêté ({1}). Sa sortie complète est dans le journal de la passerelle (passerelle.log).", s.etape, raisonNpm(`${rs.erreur}\n${rs.sortie}`, version, "script")));
    }
  }
  const verif = await executer(lancement.fichier, [...lancement.prefixe, "--version"], env, 60_000);
  const trouvee = /(\d{4}\.\d+\.\d+)/.exec(verif.sortie)?.[1];
  if (!verif.ok || !trouvee) {
    journaliserNpm("openclaw --version ne répond pas après l'installation", verif);
    throw new Error(t("OpenClaw s'est installé mais ne démarre pas."));
  }
  return trouvee;
}

/** Version d'OpenClaw qu'Helix installe : celle du profil, sinon celle qu'il a éprouvée. */
export const versionVisee = () => deployment().openclaw?.version ?? VERSION_OPENCLAW_EPROUVEE;

/** « 2026.9.10 » est plus récente que « 2026.9.4 » : comparaison nombre par nombre, pas en texte. */
export function plusRecente(a: string, b: string): boolean {
  const n = (v: string) => v.replace(/^v/, "").split(/[.-]/).slice(0, 3).map((x) => Number.parseInt(x, 10) || 0);
  const [x, y] = [n(a), n(b)];
  for (let i = 0; i < 3; i++) if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) > (y[i] ?? 0);
  return false;
}

let parue: { version: string | null; at: number } | null = null;
let releve: Promise<void> | null = null;

/**
 * Dernière version publiée d'OpenClaw (registre npm, étiquette « latest »),
 * pour dire à l'écran qu'elle existe. Relue en arrière-plan au plus deux fois
 * par jour, sans jamais faire attendre l'écran ; `null` tant qu'on ne sait pas
 * (ou hors ligne). Helix ne l'installe pas d'office : il installe la version
 * qu'il a éprouvée, et c'est une mise à jour d'Helix qui fait avancer celle-ci.
 */
export function versionParue(): string | null {
  if (!releve && (!parue || Date.now() - parue.at > 12 * 3_600_000)) {
    releve = (async () => {
      try {
        const r = await fetch("https://registry.npmjs.org/openclaw/latest", { signal: AbortSignal.timeout(8000) });
        const v = r.ok ? ((await r.json()) as { version?: unknown }).version : null;
        parue = { version: typeof v === "string" && /^\d{4}\.\d+\.\d+$/.test(v) ? v : null, at: Date.now() };
      } catch {
        parue = { version: parue?.version ?? null, at: Date.now() };
      } finally {
        releve = null;
      }
    })();
  }
  return parue?.version ?? null;
}

/** Ce que l'instance des agents fait autour de l'installation (voir employes.ts). */
export interface Crochets {
  /** Avant : arrêter l'instance et mettre ses données de côté (mise à jour seulement). */
  preparer?: () => Promise<void>;
  /** Une fois le paquet en place : (re)démarrer. Lève une erreur si l'instance ne repart pas. */
  apres: () => Promise<void>;
  /** La mise à jour a échoué : remettre les données mises de côté et relancer. */
  retablir?: () => Promise<void>;
}

/** Le message de l'étape `visualcpp` : ce qui se passe, et pourquoi Windows va demander une autorisation. */
const messageVisualCpp = () =>
  t("Installation des bibliothèques de Microsoft (Visual C++)… OpenClaw en a besoin, et elles manquent sur ce PC : Windows va demander une autorisation d'administrateur pour les installer (si la demande n'apparaît pas, regardez la barre des tâches).");

/**
 * Sous Windows, les bibliothèques Visual C++ : relevées, et installées par le
 * paquet de Microsoft si elles manquent ou sont trop anciennes. Rend `true`
 * quand Windows conseille un redémarrage. Rien ailleurs, rien quand elles
 * sont là.
 */
async function assurerVisualCpp(qui: string): Promise<boolean> {
  const avant = await detecterVisualCpp(true);
  if (!avant || avant.etat === "present") return false;
  console.log(`[openclaw] bibliothèques Visual C++ : ${JSON.stringify(avant)}, installation du paquet de Microsoft`);
  etat = { etape: "visualcpp", message: messageVisualCpp(), avancement: 0 };
  const r = await installerVisualCpp((pourcent) => {
    if (etat.etape === "visualcpp") etat = { ...etat, avancement: pourcent };
  });
  journaliser("visual_cpp.installe", qui, { version: r.version, redemarrage: r.redemarrage, avant: avant.etat });
  return r.redemarrage;
}

/**
 * Un OpenClaw déjà installé sans les bibliothèques Visual C++ (retirées
 * depuis, ou OpenClaw posé avant le 29/09/2026 sur un PC qui ne les avait
 * pas) : l'étape de Microsoft seule, puis le redémarrage de
 * l'instance. Même file que l'installation : une seule à la fois.
 */
export function reparerVisualCpp(qui: string, crochets: Crochets): void {
  if (enCours) return;
  enCours = (async () => {
    try {
      const redemarrage = await assurerVisualCpp(qui);
      etat = { etape: "verification", message: t("Redémarrage de vos agents…") };
      await crochets.apres();
      etat = {
        etape: "termine",
        message: t("Les bibliothèques Visual C++ de Microsoft sont installées.") + (redemarrage ? ` ${t("Windows conseille de redémarrer le PC pour finir l'installation des bibliothèques de Microsoft.")}` : ""),
        ...(redemarrage ? { redemarrage } : {}),
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      etat = { etape: "erreur", message };
      journaliser("visual_cpp.echec", qui, { raison: message.slice(0, 300) });
    } finally {
      enCours = null;
    }
  })();
}

/**
 * Lance l'installation (une seule à la fois) et rend la main aussitôt : l'écran
 * suit `etatInstallation()`.
 *
 * `avant` : la version en place, quand c'est une mise à jour. Une mise à jour
 * est réversible jusqu'au bout : une nouvelle version d'OpenClaw fait migrer
 * sa base sans retour possible (une version plus ancienne refuse ensuite de
 * l'ouvrir), les données sont donc mises de côté avant, et si la nouvelle
 * version ne démarre pas, l'ancienne est réinstallée et les données remises.
 */
export function installerOpenClaw(qui: string, crochets: Crochets, avant?: string): void {
  if (enCours) return;
  enCours = (async () => {
    let paquetChange = false;
    try {
      if (avant && crochets.preparer) {
        etat = { etape: "preparation", message: t("Mise de côté des données de vos agents…") };
        await crochets.preparer();
      }
      const redemarrage = await assurerVisualCpp(qui);
      etat = { etape: "node", message: t("Téléchargement de Node.js (environ 50 Mo)…"), avancement: 0 };
      const node = await installerNode();
      etat = {
        etape: "openclaw",
        message: avant ? tf("Mise à jour d'OpenClaw vers {0} (une à deux minutes)…", versionVisee()) : t("Installation d'OpenClaw (quelques minutes)…"),
      };
      paquetChange = true;
      const version = await installerPaquet(versionVisee());
      etat = { etape: "verification", message: avant ? t("Redémarrage de vos agents…") : t("Vérification…") };
      await crochets.apres();
      etat = {
        etape: "termine",
        message: avant ? tf("OpenClaw est passé de {0} à {1}.", avant, version) : tf("OpenClaw {0} est installé.", version),
        version,
        ...(avant ? { de: avant } : {}),
        ...(redemarrage ? { redemarrage } : {}),
      };
      if (redemarrage) etat.message += ` ${t("Windows conseille de redémarrer le PC pour finir l'installation des bibliothèques de Microsoft.")}`;
      if (avant) journaliser("openclaw.mis_a_jour", qui, { de: avant, a: version, node });
      else journaliser("openclaw.installe", qui, { version, node, dossier: racine() });
    } catch (err) {
      let message = err instanceof Error ? err.message : String(err);
      if (avant && crochets.retablir) {
        etat = { etape: "verification", message: tf("Retour à OpenClaw {0}…", avant) };
        try {
          if (paquetChange) await installerPaquet(avant);
          await crochets.retablir();
          message = tf("La mise à jour n'a pas abouti ({0}). Vos agents sont revenus à OpenClaw {1}, sans rien perdre.", message.replace(/\.$/, ""), avant);
        } catch (err2) {
          message = tf("La mise à jour n'a pas abouti, et le retour à OpenClaw {0} non plus : {1}", avant, err2 instanceof Error ? err2.message : String(err2));
        }
      }
      etat = { etape: "erreur", message };
      journaliser("openclaw.installation_echouee", qui, { raison: message.slice(0, 300), ...(avant ? { de: avant, vers: versionVisee() } : {}) });
    } finally {
      enCours = null;
    }
  })();
}
