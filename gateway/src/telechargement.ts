import { execFile } from "node:child_process";
import { createReadStream, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join } from "node:path";
import { promisify } from "node:util";
import type http from "node:http";
import { nomProduit } from "./marque.ts";
import { t, tf } from "./langue.ts";

const exec = promisify(execFile);

/**
 * Téléchargement direct de l'application, servi par l'instance elle-même.
 *
 * ── Pourquoi l'instance, et pas un site ─────────────────────────────────────
 *
 * Le bouton « Télécharger » était grisé : aucun paquet n'était publié nulle
 * part, et le seul chemin qui aboutissait était une page de versions sur
 * GitHub. Or l'instance **fait tourner** l'application : elle l'a sous la
 * main, dans la bonne version, pour la bonne machine. Elle la sert donc
 * directement, à qui a le droit de la demander.
 *
 * Trois conséquences qui sont des qualités :
 *
 *  - un collègue invité récupère **la version de son instance**, pas la
 *    dernière publiée quelque part — les deux ne se parlent pas forcément ;
 *  - rien ne passe par Internet : sur un réseau d'entreprise fermé, ça marche ;
 *  - il n'y a rien à publier ni à tenir à jour ailleurs.
 *
 * ── Ce que ce module ne sait pas faire, et le dit ───────────────────────────
 *
 * Il ne sert que la plateforme sur laquelle l'instance tourne : une instance
 * sur Mac ne peut pas fabriquer l'application Windows. Les paquets Windows et
 * Linux sont publiés avec chaque version depuis le 27/09/2026 : pour eux,
 * l'écran mène au paquet de la même version sur la page de publication.
 *
 * Tant que l'application n'est pas signée par Apple, macOS la bloque au
 * premier lancement après un téléchargement. L'écran explique le geste
 * (clic droit, Ouvrir) ; il disparaîtra avec la signature (SIGNATURE.md).
 */

export type Plateforme = "macos" | "windows" | "linux";

export interface EtatPaquet {
  plateforme: Plateforme;
  disponible: boolean;
  /** Le paquet est-il déjà prêt, ou faut-il le préparer (une minute environ) ? */
  pret: boolean;
  version?: string;
  architecture?: string;
  taille?: number;
  /** Pourquoi ce n'est pas disponible, dit à la personne. */
  raison?: string;
}

/** Le dossier `.app` qui contient ce processus, s'il y en a un. */
function applicationEnCours(): string | null {
  const force = process.env.HELIX_APP_BUNDLE;
  if (force) return existsSync(force) ? force : null;
  /*
   * Le `.app` le plus extérieur (28/09/2026) : la passerelle tourne désormais
   * dans un `utilityProcess`, dont le binaire est l'assistant rangé dans
   * l'application (`Helix.app/Contents/Frameworks/Helix Helper.app/…`). Le
   * premier `.app` rencontré en remontant était celui de l'assistant, et
   * c'est lui qu'on aurait servi.
   */
  let dossier = dirname(process.execPath);
  let trouve: string | null = null;
  for (let i = 0; i < 9; i++) {
    if (dossier.endsWith(".app")) trouve = dossier;
    const parent = dirname(dossier);
    if (parent === dossier) break;
    dossier = parent;
  }
  return trouve;
}

/** La version inscrite dans l'application elle-même, pas dans le code source. */
function versionDe(app: string): string | undefined {
  try {
    const plist = readFileSync(join(app, "Contents", "Info.plist"), "utf8");
    return /<key>CFBundleShortVersionString<\/key>\s*<string>([^<]+)<\/string>/.exec(plist)?.[1];
  } catch {
    return undefined;
  }
}

const dossierPaquets = (): string => {
  const base = process.env.HELIX_DATA_DIR ?? join(homedir(), ".helix", "data");
  const dossier = join(base, "telechargements");
  if (!existsSync(dossier)) mkdirSync(dossier, { recursive: true });
  return dossier;
};

/**
 * Le nom du fichier : celui de l'application elle-même (« Helix.app » donne
 * « Helix-0.26.0-mac-arm64.zip »). Le nom de marque réglé dans l'instance
 * pouvait valoir « l'application » tant qu'aucune marque n'était posée, et
 * donnait un fichier « lapplication-… » que personne ne reconnaît.
 */
function cheminPaquet(version: string): string {
  const app = applicationEnCours();
  const depuisApp = app ? basename(app).replace(/\.app$/, "") : "";
  const nom = (depuisApp || nomProduit()).replace(/[^A-Za-z0-9._-]/g, "") || "Application";
  return join(dossierPaquets(), `${nom}-${version}-mac-${process.arch}.zip`);
}

export function etat(plateforme: Plateforme): EtatPaquet {
  if (plateforme !== "macos") {
    return {
      plateforme,
      disponible: false,
      pret: false,
      /*
       * Phrase sans « Pour Windows et Linux » (04/10/2026) : sous Windows,
       * l'onglet Windows disait « l'instance ne sert que l'application macOS »,
       * qui se lisait comme une erreur de système. L'écran propose à la suite
       * le paquet de la même version sur la page de publication (TelechargerApps.tsx).
       */
      raison: t("Votre instance ne sert elle-même que l'application macOS, et seulement quand elle tourne sur un Mac."),
    };
  }
  if (process.platform !== "darwin") {
    return {
      plateforme,
      disponible: false,
      pret: false,
      raison: t("L'instance ne tourne pas sur un Mac : elle ne peut pas servir l'application macOS."),
    };
  }
  const app = applicationEnCours();
  if (!app) {
    return {
      plateforme,
      disponible: false,
      pret: false,
      raison: t("L'instance tourne depuis les sources, pas depuis l'application installée : il n'y a pas de paquet à servir."),
    };
  }
  const version = versionDe(app) ?? "inconnue";
  const chemin = cheminPaquet(version);
  /*
   * Prêt seulement s'il est plus récent que l'application elle-même : mesuré le
   * 26/09/2026, une application reconstruite sous le même numéro de version
   * servait encore l'archive de la veille, donc l'ancienne application, à la
   * fenêtre de mise à jour des postes.
   */
  let pret = existsSync(chemin);
  if (pret) {
    try {
      pret = statSync(chemin).mtimeMs >= statSync(join(app, "Contents", "Info.plist")).mtimeMs;
    } catch {
      pret = false;
    }
  }
  return {
    plateforme,
    disponible: true,
    pret,
    version,
    architecture: process.arch === "arm64" ? "Apple Silicon" : "Intel",
    ...(pret ? { taille: statSync(chemin).size } : {}),
  };
}

/** Une seule préparation à la fois : deux clics ne lancent pas deux compressions. */
let enCours: Promise<{ ok: boolean; message: string }> | null = null;

/**
 * Prépare le paquet macOS : une archive de l'application en cours, faite par
 * `ditto`, l'outil d'Apple qui conserve ce qu'un zip ordinaire perd (liens
 * symboliques des frameworks, attributs étendus) — une application archivée
 * autrement ne se lance plus.
 */
export function preparer(): Promise<{ ok: boolean; message: string }> {
  if (enCours) return enCours;
  enCours = (async () => {
    const e = etat("macos");
    if (!e.disponible) return { ok: false, message: e.raison ?? t("Indisponible.") };
    if (e.pret) return { ok: true, message: t("Le paquet est prêt.") };
    const app = applicationEnCours()!;
    const chemin = cheminPaquet(e.version!);
    const provisoire = `${chemin}.partiel`;
    try {
      rmSync(provisoire, { force: true });
      await exec("/usr/bin/ditto", ["-c", "-k", "--sequesterRsrc", "--keepParent", app, provisoire], {
        timeout: 10 * 60_000,
      });
      renameSync(provisoire, chemin);
      // Les paquets des versions précédentes ne servent plus à personne.
      ancienPaquets(chemin);
      return { ok: true, message: t("Le paquet est prêt.") };
    } catch (erreur) {
      rmSync(provisoire, { force: true });
      return {
        ok: false,
        message: tf("La préparation du paquet a échoué : {0}", erreur instanceof Error ? erreur.message : String(erreur)),
      };
    }
  })().finally(() => {
    enCours = null;
  });
  return enCours;
}

function ancienPaquets(garder: string): void {
  try {
    const dossier = dirname(garder);
    for (const nom of readdirSync(dossier)) {
      if (nom.endsWith(".zip") && join(dossier, nom) !== garder) rmSync(join(dossier, nom), { force: true });
    }
  } catch {
    /* un ménage raté ne gêne personne */
  }
}

/** Envoie le paquet, prêt ou non : s'il ne l'est pas, on le prépare d'abord. */
export async function servir(res: http.ServerResponse, plateforme: Plateforme): Promise<void> {
  if (plateforme !== "macos") {
    const e = etat(plateforme);
    res.writeHead(404, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ error: { message: e.raison } }));
    return;
  }
  const preparation = await preparer();
  const e = etat("macos");
  if (!preparation.ok || !e.pret) {
    res.writeHead(503, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ error: { message: preparation.message } }));
    return;
  }
  const chemin = cheminPaquet(e.version!);
  res.writeHead(200, {
    "Content-Type": "application/zip",
    "Content-Length": String(statSync(chemin).size),
    "Content-Disposition": `attachment; filename="${basename(chemin)}"`,
    "Cache-Control": "no-store",
  });
  createReadStream(chemin).pipe(res);
}

/* ------------------------------------------------------------------ */
/* Mises à jour des postes, servies par l'instance                     */
/* ------------------------------------------------------------------ */

/*
 * Décidé par Medhi le 26/09/2026 : pas de mise à jour automatique (il faudrait
 * un certificat Apple et un serveur), mais une fenêtre « Nouvelle version,
 * Installer » sur chaque poste. La source est l'instance à laquelle le poste
 * est rattaché : elle a déjà l'application dans sa version exacte (ci-dessus).
 * Elle la décrit au format que lit electron-updater (`latest-mac.yml`, avec
 * l'empreinte SHA-512 de l'archive), et la sert. Rien ne passe par Internet.
 */
let empreinteGardee: { chemin: string; mtime: number; sha512: string } | null = null;

async function sha512Base64(chemin: string): Promise<string> {
  const mtime = statSync(chemin).mtimeMs;
  if (empreinteGardee && empreinteGardee.chemin === chemin && empreinteGardee.mtime === mtime) return empreinteGardee.sha512;
  const { createHash } = await import("node:crypto");
  const hash = createHash("sha512");
  await new Promise<void>((resolve, reject) => {
    createReadStream(chemin).on("data", (d) => hash.update(d)).on("end", () => resolve()).on("error", reject);
  });
  const sha512 = hash.digest("base64");
  empreinteGardee = { chemin, mtime, sha512 };
  return sha512;
}

/** `latest-mac.yml` de l'application que fait tourner l'instance, ou la raison de son absence. */
export async function fluxMiseAJour(): Promise<{ yml: string } | { erreur: string }> {
  const preparation = await preparer();
  const e = etat("macos");
  if (!preparation.ok || !e.pret || !e.version) return { erreur: e.raison ?? preparation.message };
  const chemin = cheminPaquet(e.version);
  const nom = basename(chemin);
  const sha512 = await sha512Base64(chemin);
  const taille = statSync(chemin).size;
  const date = new Date(statSync(chemin).mtimeMs).toISOString();
  return {
    yml: [
      `version: ${e.version}`,
      "files:",
      `  - url: ${nom}`,
      `    sha512: ${sha512}`,
      `    size: ${taille}`,
      `path: ${nom}`,
      `sha512: ${sha512}`,
      `releaseDate: '${date}'`,
      "",
    ].join("\n"),
  };
}

/** Le nom de l'archive servie pour les mises à jour (pour vérifier la demande). */
export function nomArchiveMiseAJour(): string | null {
  const e = etat("macos");
  return e.disponible && e.version ? basename(cheminPaquet(e.version)) : null;
}
