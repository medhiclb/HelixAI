import { createHash } from "node:crypto";
import https from "node:https";
import { lookup } from "node:dns/promises";
import { interne } from "./sortieReseau.ts";
import { t, tf } from "./langue.ts";

export interface FichierImporte { nom: string; base64: string }
export interface ImportCompetence { source: string; candidats?: string[]; fichiers?: FichierImporte[]; avertissements?: string[] }

/** Lecture seule, sans cookies ni jetons GitHub, sans redirection ni extraction sur disque.
 * L'adresse publique résolue est fixée à la connexion pour fermer le rebinding DNS. */
export async function lireLienPublic(adresse: string, maximum: number, signal: AbortSignal): Promise<Buffer> {
  const url = new URL(adresse);
  if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443")) throw Error(t("Donnez un lien HTTPS public sans identifiants."));
  const adresses = await lookup(url.hostname, { all: true });
  if (!adresses.length || adresses.some(a => interne(a.address))) throw Error(t("Donnez un lien HTTPS public sans identifiants."));
  const ip = adresses[0]!;
  return new Promise((ok, non) => {
    const req = https.get(url, { signal, headers: { "User-Agent": "skill-import", Accept: "application/vnd.github+json" },
      lookup: (_hote, options, retour) => options.all ? retour(null, adresses) : retour(null, ip.address, ip.family),
    }, res => {
      if (res.statusCode !== 200) { res.destroy(); non(Error(tf("Le téléchargement a été refusé (HTTP {0}). Utilisez un dépôt public ou importez un fichier local.", res.statusCode ?? 0))); return; }
      let taille = 0; const morceaux: Buffer[] = [];
      res.on("data", (b: Buffer) => { taille += b.length; if (taille > maximum) res.destroy(Error(t("Ce fichier est trop grand pour une compétence."))); else morceaux.push(b); });
      res.on("end", () => ok(Buffer.concat(morceaux)));
      res.on("error", non);
    });
    req.on("error", non);
  });
}

/** GitHub : branche résolue en commit avant de montrer les choix. Aucun clone, script ou sous-module. */
export async function importerCompetenceLien(adresse: string, selection?: string): Promise<ImportCompetence> {
  const signal = AbortSignal.timeout(45_000);
  const lire = (u: string, max = 5 * 1024 * 1024) => lireLienPublic(u, max, signal);
  const url = new URL(adresse);
  if (url.protocol !== "https:" || url.username || url.password) throw Error(t("Donnez un lien HTTPS public sans identifiants."));
  if (url.hostname !== "github.com") {
    const nom = decodeURIComponent(url.pathname.split("/").at(-1) ?? "");
    if (!/\.(md|markdown|txt|zip)$/i.test(nom)) throw Error(t("Donnez un dépôt GitHub, un fichier SKILL.md ou une archive ZIP."));
    return { source: url.href, fichiers: [{ nom, base64: (await lire(url.href)).toString("base64") }] };
  }
  const parties = url.pathname.split("/").filter(Boolean).map(decodeURIComponent);
  const [auteur, depotBrut, genre, ref, ...suite] = parties;
  const depot = depotBrut?.replace(/\.git$/, "");
  if (!auteur || !depot || !/^[\w.-]+$/.test(auteur) || !/^[\w.-]+$/.test(depot) || (genre && !["tree", "blob"].includes(genre))) throw Error(t("Donnez un dépôt GitHub, un fichier SKILL.md ou une archive ZIP."));
  const api = `https://api.github.com/repos/${auteur}/${depot}`;
  const json = async (u: string) => JSON.parse((await lire(u, 8 * 1024 * 1024)).toString("utf8"));
  const reference = ref ?? (await json(api)).default_branch;
  const commit = await json(`${api}/commits/${encodeURIComponent(reference)}`);
  if (!/^[a-f0-9]{40}$/.test(commit.sha)) throw Error(t("Ce dépôt n'a pas pu être lu."));
  const arbre = await json(`${api}/git/trees/${commit.sha}?recursive=1`);
  if (arbre.truncated || !Array.isArray(arbre.tree)) throw Error(t("Ce dépôt est trop grand. Importez directement le fichier SKILL.md ou une archive locale."));
  const prefixe = suite.join("/");
  const blobs = arbre.tree.filter((e: { type?: string; mode?: string; path?: string }) => e.type === "blob" && e.mode !== "120000" && typeof e.path === "string");
  const candidats: string[] = blobs.map((e: { path: string }) => e.path).filter((p: string) => /(^|\/)SKILL\.md$/i.test(p) && (!prefixe || p === prefixe || p.startsWith(prefixe + "/"))).sort();
  if (!candidats.length) throw Error(t("L'archive ne contient pas de fichier SKILL.md."));
  const source = `https://github.com/${auteur}/${depot}/tree/${commit.sha}${prefixe ? "/" + suite.map(encodeURIComponent).join("/") : ""}`;
  if (!selection && candidats.length > 1) return { source, candidats };
  const chemin = selection ?? candidats[0]!;
  if (!candidats.includes(chemin)) throw Error(t("Choisissez une compétence de la liste."));
  const dossier = chemin.includes("/") ? chemin.slice(0, chemin.lastIndexOf("/") + 1) : "";
  const licence = (p: string) => /(^|\/)(licen[cs]e|notice|copyright)(\.[^/]*)?$/i.test(p);
  const voisins = blobs.filter((e: { path: string; size?: number }) => e.path !== chemin && (e.path.startsWith(dossier) || (!e.path.includes("/") && licence(e.path))) && !/(^|\/)SKILL\.md$/i.test(e.path) && (/\.(md|txt|json|yaml|yml|csv|py|sh|js|ts)$/i.test(e.path) || licence(e.path)) && (e.size ?? Infinity) <= 80_000)
    .sort((a: { path: string }, b: { path: string }) => Number(licence(b.path)) - Number(licence(a.path)) || a.path.localeCompare(b.path));
  const fichiers: FichierImporte[] = [];
  for (const p of [chemin, ...voisins.slice(0, 4).map((e: { path: string }) => e.path)]) {
    const contenu = await lire(`https://raw.githubusercontent.com/${auteur}/${depot}/${commit.sha}/${p.split("/").map(encodeURIComponent).join("/")}`, p === chemin ? 60_000 : 80_000);
    const attendu = blobs.find((e: { path: string }) => e.path === p)?.sha;
    const empreinte = createHash("sha1").update(`blob ${contenu.length}\0`).update(contenu).digest("hex");
    if (attendu !== empreinte) throw Error(t("Le fichier reçu ne correspond pas à la révision choisie."));
    fichiers.push({ nom: p === chemin ? "SKILL.md" : (p.startsWith(dossier) ? p.slice(dossier.length) : p).replaceAll("/", "__"), base64: contenu.toString("base64") });
  }
  fichiers.push({ nom: "SOURCE.txt", base64: Buffer.from(source + "\n" + commit.sha + "\n").toString("base64") });
  return { source, fichiers, avertissements: voisins.length > 4 ? [t("Certains fichiers joints ne sont pas repris. Relisez les références de la compétence.")] : [] };
}
