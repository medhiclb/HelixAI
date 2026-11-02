import { execFile, spawn, type ChildProcess } from "node:child_process";
import { promisify } from "node:util";
import { createHash, randomBytes } from "node:crypto";
import { copyFileSync, createReadStream, createWriteStream, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync, renameSync, readdirSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { detectHardware, type Hardware } from "./provision.ts";
import { libererPourImage } from "./backends.ts";
import { completer } from "./completion.ts";
import { journaliser } from "./audit.ts";
import { t, tf } from "./langue.ts";
import { db } from "./db.ts";
import { voitConversation, type Demandeur } from "./authz.ts";
import { arreterArbre } from "./processus.ts";

const exec = promisify(execFile);

/**
 * Création d'images, sur la machine, avec un modèle ouvert.
 *
 * Le bouton « Image » du Chat, comme dans ChatGPT ou Gemini, sans qu'aucune
 * description ni aucune image ne quitte l'instance.
 *
 * - **Moteur** : stable-diffusion.cpp (licence MIT), un seul programme, publié
 *   pour Mac (Metal), Windows (NVIDIA, carte quelconque par Vulkan, processeur)
 *   et Linux. Pas de Python, rien à compiler. Version épinglée, archive
 *   vérifiée par empreinte.
 * - **Modèle** : Z-Image Turbo (Tongyi-MAI, Alibaba, licence Apache 2.0), le
 *   meilleur modèle d'images ouvert de sa taille ; 8 étapes suffisent. Son
 *   encodeur de texte est Qwen3 4B (Apache 2.0). Trois tailles selon la
 *   mémoire de la machine : plus de mémoire, image plus fine.
 * - Chaque fichier est pris à une révision précise et vérifié par empreinte :
 *   ce qui tourne est ce qui a été essayé.
 *
 * Essayé le 24/09/2026 sur un Mac M4 de 16 Go : Z-Image Turbo (768 px, 2 min 45)
 * et FLUX.2 klein 4B (1 min 42, image nette, texte écrit dans l'image
 * illisible : c'est à cela que sert Qwen-Image, pas essayé faute de mémoire).
 * Windows et Linux : mêmes fichiers et mêmes options, pas essayés sur place.
 */

/* ------------------------------------------------------------------ */
/* Ce qui s'installe                                                   */
/* ------------------------------------------------------------------ */

interface Fichier {
  depot: string;
  revision: string;
  chemin: string;
  taille: number;
  sha256: string;
  /** Hors de Hugging Face (le décodeur allégé des vidéos, publié sur GitHub) : l'adresse exacte, à une révision fixe. */
  url?: string;
}

const hf = (f: Fichier) => f.url ?? `https://huggingface.co/${f.depot}/resolve/${f.revision}/${f.chemin}`;
const nomLocal = (f: Fichier) => f.chemin.split("/").pop()!;

const Z = "leejet/Z-Image-Turbo-GGUF";
const ZR = "c61c0e422dc8b541b7548cf33a4ef8302b0f8085";
const Q = "unsloth/Qwen3-4B-Instruct-2507-GGUF";
const QR = "a06e946bb6b655725eafa393f4a9745d460374c9";
const K = "leejet/FLUX.2-klein-4B-GGUF";
const KR = "3b1f5a9dc3abb32238b053aeb3d823c30afdacbd";
const QB = "unsloth/Qwen3-4B-GGUF";
const QBR = "22c9fc8a8c7700b76a1789366280a6a5a1ad1120";

const VAE_Z: Fichier = {
  depot: "Comfy-Org/z_image_turbo",
  revision: "6fc90a3b1b653e935a0d175e260736de25b84df5",
  chemin: "split_files/vae/ae.safetensors",
  taille: 335_304_388,
  sha256: "afc8e28272cd15db3919bacdb6918ce9c1ed22e96cb12c4d5ed0fba823529e38",
};
const VAE_FLUX2: Fichier = {
  depot: "Comfy-Org/vae-text-encorder-for-flux-klein-4b",
  revision: "5f526678002e43af5551dadb73ce2e8c91b43afe",
  chemin: "split_files/vae/flux2-vae.safetensors",
  taille: 336_211_292,
  sha256: "868fe7b343cc8f3a19dbcfcafbc3d5f888802be3f89bd81b65b3621a066ce8f3",
};
const VAE_QWEN: Fichier = {
  depot: "Comfy-Org/Qwen-Image_ComfyUI",
  revision: "1f12b17be14c89b026c51a91d67c32f84bb047bc",
  chemin: "split_files/vae/qwen_image_vae.safetensors",
  taille: 253_806_246,
  sha256: "a70580f0213e67967ee9c95f05bb400e8fb08307e017a924bf3441223e023d1f",
};

export type IdModele = "z-image" | "flux2-klein" | "qwen-image";

interface Variante {
  id: string;
  diffusion: Fichier;
  texte: Fichier;
  vae: Fichier;
  /** Mémoire nécessaire : unifiée sur Mac, de la carte graphique sur PC. */
  memoireMac: number;
  vramPc: number;
  /** Côté de l'image carrée, en pixels (voir FORMATS). */
  cote: 640 | 768 | 1024;
}

interface ModeleImage {
  id: IdModele;
  nom: string;
  editeur: string;
  licence: string;
  etapes: number;
  cfg: number;
  options: string[];
  /** Plus fine d'abord : on prend la première qui tient sur la machine. */
  variantes: Variante[];
  /** Essayé de bout en bout avec Helix. Les autres sont proposés, marqués comme tels. */
  verifie: boolean;
  readonly atout: string;
}

const ZF = (chemin: string, taille: number, sha256: string): Fichier => ({ depot: Z, revision: ZR, chemin, taille, sha256 });
const QF = (chemin: string, taille: number, sha256: string): Fichier => ({ depot: Q, revision: QR, chemin, taille, sha256 });

/*
 * Tous sous licence Apache 2.0, comme leurs encodeurs de texte.
 *  - Z-Image Turbo (Alibaba) : le meilleur rendu photo de sa taille ; conseillé
 *    dès 16 Go ;
 *  - FLUX.2 klein 4B (Black Forest Labs) : quatre étapes seulement, le plus
 *    rapide ; conseillé sous 16 Go ;
 *  - Qwen-Image (Alibaba) : 20 milliards de paramètres, le seul à bien écrire
 *    du texte dans l'image ; pour les grosses machines, et lent.
 */
const MODELES: ModeleImage[] = [
  {
    id: "z-image",
    nom: "Z-Image Turbo",
    editeur: "Alibaba (Tongyi-MAI)",
    licence: "Apache 2.0",
    etapes: 8,
    cfg: 1,
    options: [],
    verifie: true,
    get atout() {
      return t("Rendu photo très réaliste. Le meilleur compromis qualité et vitesse.");
    },
    variantes: [
      { id: "fin", memoireMac: 32, vramPc: 12, cote: 1024, vae: VAE_Z,
        diffusion: ZF("z_image_turbo-Q8_0.gguf", 6_577_440_704, "df1c5baa86d1398c979495a6072dbcee79444fdb884a2445582ba0769c44e9a1"),
        texte: QF("Qwen3-4B-Instruct-2507-Q6_K.gguf", 3_306_261_600, "cd7b21b38b3e71400587c184b6a9b04d3beb4d13fdae6464d4075dee4f1bc5ad") },
      { id: "standard", memoireMac: 16, vramPc: 8, cote: 768, vae: VAE_Z,
        diffusion: ZF("z_image_turbo-Q4_K.gguf", 3_864_250_304, "14b375ab4f226bc5378f68f37e899ef3c2242b8541e61e2bc1aff40976086fbd"),
        texte: QF("Qwen3-4B-Instruct-2507-Q4_K_M.gguf", 2_497_281_120, "3605803b982cb64aead44f6c1b2ae36e3acdb41d8e46c8a94c6533bc4c67e597") },
      { id: "leger", memoireMac: 8, vramPc: 4, cote: 640, vae: VAE_Z,
        diffusion: ZF("z_image_turbo-Q3_K.gguf", 3_143_559_104, "4b44bdaa7814f20d7cf144e3939bd93aa32f50660204dd0c2aea5c5376232980"),
        texte: QF("Qwen3-4B-Instruct-2507-Q3_K_M.gguf", 2_075_618_400, "9c6e0763577125a994a9bea0bbd7a737ac4498b8a6a4e0f788727553af1806c9") },
    ],
  },
  {
    id: "flux2-klein",
    nom: "FLUX.2 klein 4B",
    editeur: "Black Forest Labs",
    licence: "Apache 2.0",
    etapes: 4,
    cfg: 1,
    options: [],
    verifie: true,
    get atout() {
      return t("Le plus rapide : quatre étapes seulement. Idéal sur une petite machine.");
    },
    variantes: [
      { id: "fin", memoireMac: 32, vramPc: 12, cote: 1024, vae: VAE_FLUX2,
        diffusion: { depot: K, revision: KR, chemin: "flux-2-klein-4b-Q8_0.gguf", taille: 4_300_629_440, sha256: "0bba6951258ec8f92d51114a8fa13e66828297bfff58a738f52729b3ef66fa28" },
        texte: { depot: QB, revision: QBR, chemin: "Qwen3-4B-Q6_K.gguf", taille: 3_306_261_792, sha256: "002b8b61c298976afc2c9c3ca65f9dbb28deba22c4b6381853dfaa92b5690022" } },
      { id: "standard", memoireMac: 8, vramPc: 4, cote: 768, vae: VAE_FLUX2,
        diffusion: { depot: K, revision: KR, chemin: "flux-2-klein-4b-Q4_0.gguf", taille: 2_460_378_560, sha256: "d1023499ef3f2f82ff7c50e6778495195c1b6cc34835741778868428111f9ff4" },
        texte: { depot: QB, revision: QBR, chemin: "Qwen3-4B-Q4_K_M.gguf", taille: 2_497_281_312, sha256: "f6f851777709861056efcdad3af01da38b31223a3ba26e61a4f8bf3a2195813a" } },
    ],
  },
  {
    id: "qwen-image",
    nom: "Qwen-Image",
    editeur: "Alibaba (Qwen)",
    licence: "Apache 2.0",
    etapes: 20,
    cfg: 2.5,
    options: ["--flow-shift", "3", "--sampling-method", "euler"],
    verifie: false,
    get atout() {
      return t("Écrit du texte lisible dans l'image (affiches, logos, menus). Plus lent, pour les grosses machines.");
    },
    variantes: [
      { id: "standard", memoireMac: 48, vramPc: 24, cote: 1024, vae: VAE_QWEN,
        diffusion: { depot: "QuantStack/Qwen-Image-GGUF", revision: "257f261fa92593bed760aa6fa3f7921a49fea00f", chemin: "Qwen_Image-Q4_K_M.gguf", taille: 13_065_746_976, sha256: "645473886d7dbb0103f84c563c798f7b0867293d919752d4d6be6a432b0bc988" },
        texte: { depot: "mradermacher/Qwen2.5-VL-7B-Instruct-GGUF", revision: "cfa2baa09946b211c107e6e104948987a64dd2c1", chemin: "Qwen2.5-VL-7B-Instruct.Q4_K_M.gguf", taille: 4_683_072_512, sha256: "0f00a930ba3108b6861ddadf74d8ebbd82e257c63eba728e62c3e8970f5eed94" } },
    ],
  },
];

const fichiersDe = (v: Variante) => [v.diffusion, v.texte, v.vae];
const tailleVariante = (v: Variante) => fichiersDe(v).reduce((s, f) => s + f.taille, 0);
const go = (octets: number) => Math.round((octets / 1e9) * 10) / 10;
const modele = (id: string) => MODELES.find((m) => m.id === id);

/**
 * La variante qui convient à cette machine. Mac : mémoire unifiée, que la
 * carte graphique partage. PC : la mémoire de la carte NVIDIA décide ; sans
 * elle, le processeur calcule, et seule la plus légère reste raisonnable
 * (et seulement avec 16 Go de mémoire vive).
 */
function varianteFor(m: ModeleImage, hw: Hardware): Variante | null {
  const vram = hw.gpuVramGb ?? 0;
  for (const v of m.variantes) {
    if (hw.appleSilicon ? hw.totalMemoryGb >= v.memoireMac : vram >= v.vramPc) return v;
  }
  const plusLegere = m.variantes[m.variantes.length - 1]!;
  if (!hw.appleSilicon && vram < plusLegere.vramPc && plusLegere.vramPc <= 4 && hw.totalMemoryGb >= 16) return plusLegere;
  return null;
}

/** Le modèle conseillé pour cette machine : le plus rapide en dessous de 16 Go, Z-Image au-delà. */
function conseille(hw: Hardware): IdModele {
  const petit = hw.appleSilicon ? hw.totalMemoryGb < 16 : (hw.gpuVramGb ?? 0) < 8;
  return petit ? "flux2-klein" : "z-image";
}

interface Moteur {
  id: string;
  version: string;
  archive: string;
  sha256: string;
  taille: number;
  /** Bibliothèques CUDA publiées à part (Windows avec carte NVIDIA). */
  complement?: { archive: string; sha256: string; taille: number };
  /** Processeur seul : très lent, on le dit. */
  lent?: boolean;
  /** Carte à peu de mémoire : les poids restent en mémoire vive. */
  delester?: boolean;
}

const REL = (tag: string, fichier: string) => `https://github.com/leejet/stable-diffusion.cpp/releases/download/${tag}/${fichier}`;
const T908 = "master-908-88411ef";

/**
 * Le moteur qui convient à ce poste. Le programme Mac récent exige macOS 26 :
 * pour macOS 15, une version de juillet 2026 construite pour lui, qui gère
 * déjà Z-Image.
 */
function moteurPour(hw: Hardware, versionMac: number | null): Moteur | null {
  if (hw.platform === "darwin" && hw.appleSilicon) {
    if ((versionMac ?? 0) >= 26) {
      return { id: "mac", version: T908, archive: REL(T908, "sd-master-88411ef-bin-Darwin-macOS-26.6.2-arm64.zip"), sha256: "acf9cd2219e69bdfc0faa0d6daaafa696d9551c723b74d6e37f2cd78da386d5a", taille: 34_000_000 };
    }
    if ((versionMac ?? 0) >= 15) {
      const tag = "master-746-2574f59";
      return { id: "mac15", version: tag, archive: REL(tag, "sd-master-2574f59-bin-Darwin-macOS-15.7.7-arm64.zip"), sha256: "570213614f4021ee99f832169da5c0abb73b53d48c8be2252eda30e4df3c4a1d", taille: 48_852_338 };
    }
    return null;
  }
  const vram = hw.gpuVramGb ?? 0;
  if (hw.platform === "win32" && hw.arch === "x64") {
    if (vram >= 4) {
      return {
        id: "win-cuda",
        version: T908,
        archive: REL(T908, "sd-master-88411ef-bin-win-cuda12-x64.zip"),
        sha256: "f55f8a2c1c873895f7466928fa7da82a5bb39de789af7d7755a65a9799dfccdb",
        taille: 334_000_000,
        complement: { archive: REL(T908, "cudart-sd-bin-win-cu12-x64.zip"), sha256: "fe20366827d357c00797eebb58244dddab7fd9a348d70090c3871004c320f38d", taille: 563_000_000 },
        delester: vram < 10,
      };
    }
    return { id: "win-vulkan", version: T908, archive: REL(T908, "sd-master-88411ef-bin-win-vulkan-x64.zip"), sha256: "e9d089361a00bd30b1e23cc39d2a98745536688acbf5e9e68ce2498a548d07e1", taille: 32_000_000, lent: true };
  }
  /*
   * Le programme Linux publié est construit sur Ubuntu 24.04 : il demande la
   * glibc 2.38 (relevé le 27/09/2026 dans `sd-cli` et `libggml-base.so`). Sur
   * Ubuntu 22.04 ou Debian 12 (2.35, 2.36), il ne démarrerait pas, et on ne
   * l'apprendrait qu'après plusieurs gigaoctets de modèles : il n'est pas
   * proposé, et l'écran dit pourquoi (`glibcTropAncienne`).
   */
  if (hw.platform === "linux" && hw.arch === "x64" && !glibcTropAncienne()) {
    return { id: "linux-vulkan", version: T908, archive: REL(T908, "sd-master-88411ef-bin-Linux-Ubuntu-24.04-x86_64-vulkan.zip"), sha256: "3f898579f384a97368fed42daebc4ed81e65798c633ed09b84cb27812a65ba33", taille: 39_000_000, lent: vram < 4, delester: vram > 0 && vram < 10 };
  }
  return null;
}


/** La glibc de ce Linux est-elle plus ancienne que 2.38 ? (faux ailleurs, ou si on ne sait pas la lire) */
function glibcTropAncienne(): boolean {
  if (process.platform !== "linux") return false;
  try {
    const v = (process.report?.getReport() as { header?: { glibcVersionRuntime?: string } } | undefined)?.header?.glibcVersionRuntime;
    const [maj = 0, min = 0] = String(v ?? "").split(".").map(Number);
    return Boolean(v) && (maj < 2 || (maj === 2 && min < 38));
  } catch {
    return false;
  }
}

const RAISON_GLIBC = () =>
  t("Le moteur d'images publié pour Linux demande un système récent (glibc 2.38 : Ubuntu 24.04, Debian 13, Fedora 39 ou plus récents). Ce système est plus ancien.");

/* ------------------------------------------------------------------ */
/* Emplacements                                                        */
/* ------------------------------------------------------------------ */

const racine = () => process.env.HELIX_IMAGES_DIR ?? join(homedir(), ".helix", "images");
const dossierMoteur = (m: Moteur) => join(racine(), "moteur", m.version);
const dossierModeles = () => join(racine(), "modeles");
const donnees = () => process.env.HELIX_DATA_DIR ?? join(homedir(), ".helix", "data");
const dossierCreees = () => join(donnees(), "images");
const index = () => join(dossierCreees(), "index.json");

function programme(m: Moteur): string | null {
  const nom = process.platform === "win32" ? "sd-cli.exe" : "sd-cli";
  const chercher = (d: string, profondeur: number): string | null => {
    if (!existsSync(d)) return null;
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isFile() && e.name === nom) return p;
      if (e.isDirectory() && profondeur > 0) {
        const trouve = chercher(p, profondeur - 1);
        if (trouve) return trouve;
      }
    }
    return null;
  };
  return chercher(dossierMoteur(m), 3);
}

const fichierPresent = (f: Fichier) => {
  try {
    return statSync(join(dossierModeles(), nomLocal(f))).size === f.taille;
  } catch {
    return false;
  }
};

async function versionMac(): Promise<number | null> {
  if (process.platform !== "darwin") return null;
  try {
    const { stdout } = await exec("sw_vers", ["-productVersion"], { timeout: 5000 });
    return Number(stdout.trim().split(".")[0]) || null;
  } catch {
    return null;
  }
}

/** La variante de ce modèle présente en entier sur le disque, s'il y en a une. */
function installee(m: ModeleImage): Variante | null {
  return m.variantes.find((v) => fichiersDe(v).every(fichierPresent)) ?? null;
}

const fichierChoix = () => join(racine(), "choix.json");

/** Le modèle choisi dans le Chat, s'il est installé ; sinon le premier installé. */
function modeleActif(hw: Hardware): { m: ModeleImage; v: Variante } | null {
  let voulu: string | undefined;
  try {
    voulu = (JSON.parse(readFileSync(fichierChoix(), "utf8")) as { modele?: string }).modele;
  } catch {
    /* rien de choisi */
  }
  const ordre = [modele(voulu ?? ""), modele(conseille(hw)), ...MODELES].filter(Boolean) as ModeleImage[];
  for (const m of ordre) {
    const v = installee(m);
    if (v) return { m, v };
  }
  return null;
}

export function choisirModele(id: string): boolean {
  const m = modele(id);
  if (!m || !installee(m)) return false;
  mkdirSync(racine(), { recursive: true, mode: 0o700 });
  writeFileSync(fichierChoix(), JSON.stringify({ modele: id }), { mode: 0o600 });
  return true;
}

/* ------------------------------------------------------------------ */
/* Diagnostic                                                          */
/* ------------------------------------------------------------------ */

export interface ModeleProposé {
  id: IdModele;
  nom: string;
  editeur: string;
  licence: string;
  atout: string;
  /** Tient sur cette machine ; sinon, pourquoi pas. */
  possible: boolean;
  telechargementGo: number;
  installe: boolean;
  conseille: boolean;
  verifie: boolean;
}

export interface EtatImages {
  possible: boolean;
  raison: string;
  /** Prêt à créer : moteur et au moins un modèle en place. */
  pret: boolean;
  /** Le modèle qui créera la prochaine image. */
  actif: IdModele | null;
  modeles: ModeleProposé[];
  lent: boolean;
  installation: { modele: IdModele; etape: string; message: string; fait: number; total: number; erreur?: string } | null;
}

let installation: EtatImages["installation"] = null;
let enCours: Promise<void> | null = null;

export async function etatImages(): Promise<EtatImages> {
  const hw = detectHardware();
  const moteur = moteurPour(hw, await versionMac());
  const actif = modeleActif(hw);
  const moteurPret = Boolean(moteur && programme(moteur));
  const modeles = MODELES.map((m): ModeleProposé => {
    const v = varianteFor(m, hw);
    const deja = installee(m);
    return {
      id: m.id,
      nom: m.nom,
      editeur: m.editeur,
      licence: m.licence,
      atout: m.atout,
      possible: Boolean(moteur && v),
      telechargementGo: v ? go(tailleVariante(v) + (moteurPret ? 0 : (moteur?.taille ?? 0) + (moteur?.complement?.taille ?? 0))) : 0,
      installe: Boolean(deja),
      conseille: m.id === conseille(hw),
      verifie: m.verifie,
    };
  });
  const possible = modeles.some((m) => m.possible);
  let raison: string;
  if (!moteur) raison = glibcTropAncienne() ? RAISON_GLIBC() : t("Aucun moteur d'images n'est publié pour ce système (Mac à puce Apple sous macOS 15 ou plus, Windows ou Linux 64 bits).");
  else if (!possible) raison = tf("{0} Go de mémoire : il en faut 8 au moins pour créer des images sur cette machine.", hw.totalMemoryGb);
  else if (moteur.lent) raison = t("Sans carte graphique reconnue, l'image est calculée par le processeur : comptez plusieurs minutes par image.");
  else raison = t("Les images sont créées sur cette machine, par un modèle ouvert : rien ne part sur internet.");
  return { possible, raison, pret: moteurPret && Boolean(actif), actif: actif?.m.id ?? null, modeles, lent: Boolean(moteur?.lent), installation };
}

/* ------------------------------------------------------------------ */
/* Installation                                                        */
/* ------------------------------------------------------------------ */

async function empreinte(chemin: string): Promise<string> {
  const h = createHash("sha256");
  await new Promise<void>((ok, ko) => createReadStream(chemin).on("data", (d) => h.update(d)).on("end", () => ok()).on("error", ko));
  return h.digest("hex");
}

/**
 * Télécharge un fichier en reprenant là où il s'était arrêté (un modèle de
 * plusieurs Go ne recommence pas de zéro après une coupure), puis vérifie son
 * empreinte. Mauvaise empreinte : le fichier est effacé, jamais utilisé.
 * Sert aussi aux modèles de base de l'entraînement (entrainement.ts).
 */
export async function telecharger(url: string, destination: string, sha256: string, taille: number, avancer: (fait: number) => void): Promise<void> {
  const partiel = `${destination}.partiel`;
  let deja = 0;
  try {
    deja = statSync(partiel).size;
  } catch {
    /* rien encore */
  }
  if (deja > taille) {
    rmSync(partiel, { force: true });
    deja = 0;
  }
  if (deja < taille) {
    const res = await fetch(url, { headers: deja > 0 ? { Range: `bytes=${deja}-` } : {}, redirect: "follow" });
    if (!res.ok || !res.body) throw new Error(tf("Téléchargement refusé ({0}).", res.status));
    // Le serveur ignore la reprise : on repart de zéro.
    if (deja > 0 && res.status !== 206) deja = 0;
    const sortie = createWriteStream(partiel, { flags: deja > 0 ? "a" : "w", mode: 0o600 });
    let fait = deja;
    const lecteur = res.body.getReader();
    try {
      for (;;) {
        const { done, value } = await lecteur.read();
        if (done) break;
        if (!sortie.write(value)) await new Promise<void>((r) => sortie.once("drain", () => r()));
        fait += value.length;
        avancer(fait);
      }
    } finally {
      await new Promise<void>((r) => sortie.end(() => r()));
    }
  }
  if ((await empreinte(partiel)) !== sha256) {
    rmSync(partiel, { force: true });
    throw new Error(t("Le fichier téléchargé ne correspond pas à la version attendue : il a été effacé. Réessayez."));
  }
  renameSync(partiel, destination);
}

async function extraire(archive: string, dossier: string): Promise<void> {
  mkdirSync(dossier, { recursive: true });
  if (process.platform === "linux") {
    /*
     * `unzip` manque aux installations minimales (audit du 27/09/2026) : le
     * module `zipfile` de Python, présent presque partout, le remplace. Les
     * droits d'exécution sont remis ensuite (`chmod`, plus bas).
     */
    try {
      await exec("unzip", ["-o", "-q", archive, "-d", dossier], { timeout: 120_000 });
    } catch {
      try {
        await exec("python3", ["-m", "zipfile", "-e", archive, dossier], { timeout: 120_000 });
      } catch {
        throw new Error(t("Impossible d'ouvrir l'archive du moteur d'images : installez unzip (sudo apt install unzip), puis réessayez."));
      }
    }
    return;
  }
  /*
   * `tar` lit les .zip sur Mac (bsdtar) comme sur Windows 10 et plus. Sous
   * Windows, celui du système lui-même : celui de Git, s'il passe avant dans
   * le PATH, ne sait pas lire `C:`.
   */
  const tar = process.platform === "win32" ? join(process.env.SystemRoot ?? "C:\\Windows", "System32", "tar.exe") : "tar";
  await exec(tar, ["-xf", archive, "-C", dossier], { timeout: 120_000 });
}

export function installerImages(qui: string, id: string): Promise<void> {
  if (enCours) return enCours;
  const m = modele(id);
  if (!m) return Promise.reject(new Error(t("Modèle d'images inconnu.")));
  /*
   * Posée tout de suite, avant la première attente : la route répond 202 avec
   * l'état du moment, et l'écran ne suit l'installation (relecture toutes les
   * 1,5 s, ImageChip.tsx) que s'il la voit en cours. Posée après la lecture
   * de la version de macOS, elle pouvait manquer à cette réponse : l'écran
   * restait sur le bouton de téléchargement, sans progression, jusqu'à ce
   * qu'on rouvre le menu.
   */
  installation = { modele: m.id, etape: "telechargement", message: t("Téléchargement du moteur d'images..."), fait: 0, total: 0 };
  enCours = (async () => {
    const hw = detectHardware();
    const moteur = moteurPour(hw, await versionMac());
    const v = varianteFor(m, hw);
    if (!moteur || !v) throw new Error(tf("Cette machine ne peut pas faire tourner {0}.", m.nom));
    const aFaire = fichiersDe(v).filter((f) => !fichierPresent(f));
    const archives = programme(moteur) ? [] : [{ url: moteur.archive, sha256: moteur.sha256, taille: moteur.taille }, ...(moteur.complement ? [{ url: moteur.complement.archive, sha256: moteur.complement.sha256, taille: moteur.complement.taille }] : [])];
    const total = aFaire.reduce((s, f) => s + f.taille, 0) + archives.reduce((s, a) => s + a.taille, 0);
    let precedents = 0;
    const suivre = (message: string) => (fait: number) => (installation = { modele: m.id, etape: "telechargement", message, fait: precedents + fait, total });
    installation = { modele: m.id, etape: "telechargement", message: t("Téléchargement du moteur d'images..."), fait: 0, total };

    for (const a of archives) {
      const tmp = join(tmpdir(), `helix-images-${randomBytes(4).toString("hex")}.zip`);
      await telecharger(a.url, tmp, a.sha256, a.taille, suivre(t("Téléchargement du moteur d'images...")));
      try {
        await extraire(tmp, dossierMoteur(moteur));
      } finally {
        rmSync(tmp, { force: true });
      }
      precedents += a.taille;
    }
    const bin = programme(moteur);
    if (!bin) throw new Error(t("Le moteur d'images est installé, mais son programme est introuvable."));
    if (process.platform !== "win32") await exec("chmod", ["755", bin]).catch(() => undefined);

    mkdirSync(dossierModeles(), { recursive: true, mode: 0o700 });
    for (const f of aFaire) {
      await telecharger(hf(f), join(dossierModeles(), nomLocal(f)), f.sha256, f.taille, suivre(tf("Téléchargement de {0} ({1} Go)...", m.nom, go(total))));
      precedents += f.taille;
    }
    // Une autre variante du même modèle, laissée par une machine d'avant : elle ne sert plus, elle prend de la place.
    for (const autre of m.variantes) {
      if (autre.id === v.id) continue;
      for (const f of [autre.diffusion, autre.texte]) if (!fichiersDe(v).includes(f)) rmSync(join(dossierModeles(), nomLocal(f)), { force: true });
    }
    installation = null;
    choisirModele(m.id);
    journaliser("images.installees", qui, { modele: m.id, variante: v.id, moteur: moteur.version });
  })()
    .catch((err: unknown) => {
      installation = { modele: m.id, etape: "erreur", message: t("L'installation n'a pas abouti."), fait: 0, total: 0, erreur: err instanceof Error ? err.message : String(err) };
      throw err;
    })
    .finally(() => {
      enCours = null;
    });
  return enCours;
}

/**
 * Retire un modèle (ou tout, moteur compris, sans modèle précisé) : la place
 * revient, les images déjà créées restent.
 */
export async function desinstallerImages(qui: string, id?: string): Promise<void> {
  /*
   * `travailActif` n'existe que pendant le calcul : pendant la préparation de
   * la description (jusqu'à deux minutes), retirer le modèle passait, et la
   * création échouait ensuite sur des fichiers disparus.
   */
  const creationEnCours = [...travaux.values()].some((x) => x.etat === "preparation" || x.etat === "encours");
  if (enCours || travailActif || creationEnCours) throw new Error(t("Une installation ou une création est en cours : attendez qu'elle finisse."));
  const m = id ? modele(id) : undefined;
  if (m) {
    const gardes = new Set(MODELES.filter((x) => x.id !== m.id).flatMap((x) => x.variantes.flatMap(fichiersDe)).map(nomLocal));
    for (const f of m.variantes.flatMap(fichiersDe)) if (!gardes.has(nomLocal(f))) rmSync(join(dossierModeles(), nomLocal(f)), { force: true });
  } else {
    rmSync(racine(), { recursive: true, force: true });
  }
  installation = null;
  journaliser("images.desinstallees", qui, { modele: m?.id ?? "tout" });
}

/* ------------------------------------------------------------------ */
/* Création                                                            */
/* ------------------------------------------------------------------ */

export type Format = "carre" | "portrait" | "paysage";
/*
 * Taille de l'image selon la puissance. Mesuré le 24/09/2026 sur un Mac M4 de
 * 16 Go (niveau « standard ») : 1024 x 1024 prenait 6 min 15 (30 s par étape,
 * et la mémoire graphique ne suffisait plus pour la dernière passe) ; 768 x 768,
 * 2 min 27 (15 s par étape), pour une image encore nette. Les machines du
 * niveau « fin » (32 Go et plus, puces Pro et Max, cartes de 12 Go) gardent
 * le grand format.
 */
const FORMATS: Record<Variante["cote"], Record<Format, [number, number]>> = {
  640: { carre: [640, 640], portrait: [512, 768], paysage: [768, 512] },
  768: { carre: [768, 768], portrait: [640, 960], paysage: [960, 640] },
  1024: { carre: [1024, 1024], portrait: [832, 1216], paysage: [1216, 832] },
};

export interface Travail {
  id: string;
  pour: string;
  etat: "preparation" | "encours" | "fait" | "echec";
  message: string;
  etape: number;
  total: number;
  image?: { id: string; largeur: number; hauteur: number; description: string; video?: boolean };
  erreur?: string;
  debut: number;
}

const travaux = new Map<string, Travail>();
let travailActif: ChildProcess | null = null;

export function travail(id: string, pour: string): Travail | null {
  const tr = travaux.get(id);
  return tr && tr.pour === pour ? tr : null;
}

/**
 * La description, en anglais et un peu étoffée : Z-Image rend mieux en
 * anglais (ou en chinois), et une demande de trois mots donne une image
 * plate. Par le modèle de conversation local, sans raisonnement. S'il ne
 * répond pas, la description part telle quelle : l'image se fait quand même.
 */
async function preparerDescription(texte: string, qui: string, video = false): Promise<string> {
  const r = await completer(
    [
      {
        role: "system",
        content: video
          ? "You turn a request for a short video into a prompt for a video model. Reply with the prompt only, in English, one paragraph, " +
            "under 80 words: subject, what moves and how, camera movement, setting, style, lighting. Keep every detail the person gave, " +
            "invent nothing contradictory. Two seconds of video: one simple continuous action."
          : "You turn a request for an image into a prompt for an image model. Reply with the prompt only, in English, one paragraph, " +
            "under 90 words: subject, setting, style, lighting, framing. Keep every detail the person gave, invent nothing contradictory. " +
            "If the person wants text written in the image, keep that text exactly, in its original language, between quotes.",
      },
      { role: "user", content: texte },
    ],
    // Le modèle peut être occupé par un autre programme (LM Studio est partagé) : on lui laisse le temps.
    { qui, maxTokens: 220, delaiMs: 120_000, localSeulement: video },
  );
  if (!r.ok) return texte;
  const propre = r.texte.replace(/^["'«\s]+|["'»\s]+$/g, "").trim();
  return propre.length >= 8 && propre.length <= 1500 ? propre : texte;
}

/**
 * `chat` : le Chat où l'image est demandée. Retenu avec l'image, il décide qui
 * d'autre que son auteur peut la voir (`imageVisible`).
 */
export async function lancerCreation(description: string, format: Format, qui: string, chat?: string): Promise<Travail> {
  if (travailActif || [...travaux.values()].some((x) => x.etat === "preparation" || x.etat === "encours")) {
    throw new Error(t("Une image est déjà en cours de création sur cette machine : attendez qu'elle soit finie."));
  }
  const hw = detectHardware();
  const moteur = moteurPour(hw, await versionMac());
  const actif = modeleActif(hw);
  const bin = moteur ? programme(moteur) : null;
  if (!moteur || !bin || !actif) throw new Error(t("La création d'images n'est pas encore installée sur cette machine."));

  const tr: Travail = { id: randomBytes(12).toString("hex"), pour: qui, etat: "preparation", message: t("Préparation de la description..."), etape: 0, total: actif.m.etapes, debut: Date.now() };
  travaux.set(tr.id, tr);
  // Les travaux finis depuis plus d'une heure ne servent plus à personne.
  for (const [k, v] of travaux) if (Date.now() - v.debut > 3_600_000) travaux.delete(k);

  void (async () => {
    const { m: mod, v: niveau } = actif;
    const [largeur, hauteur] = FORMATS[niveau.cote][format] ?? FORMATS[niveau.cote].carre;
    const invite = await preparerDescription(description, qui);
    tr.message = t("Place faite en mémoire...");
    // Le modèle d'images prend environ 1,5 fois ses fichiers pendant le calcul.
    await libererPourImage(tailleVariante(niveau) * 1.5);

    mkdirSync(dossierCreees(), { recursive: true, mode: 0o700 });
    const imageId = randomBytes(16).toString("hex");
    const sortie = join(dossierCreees(), `${imageId}.png`);
    const m = (f: Fichier) => join(dossierModeles(), nomLocal(f));
    const args = [
      "--diffusion-model", m(niveau.diffusion),
      "--vae", m(niveau.vae),
      "--llm", m(niveau.texte),
      "-p", invite,
      "--cfg-scale", String(mod.cfg),
      "--steps", String(mod.etapes),
      ...mod.options,
      "-W", String(largeur),
      "-H", String(hauteur),
      "--seed", String(Math.floor(Math.random() * 2 ** 31)),
      "--diffusion-fa",
      // Dernière passe par morceaux : sans cela, sur 16 Go, elle manquait de mémoire et recommençait (81 s perdues).
      ...(niveau.cote === 1024 && hw.totalMemoryGb >= 32 ? [] : ["--vae-tiling"]),
      "-o", sortie,
      ...(moteur.delester ? ["--offload-to-cpu"] : []),
    ];
    tr.etat = "encours";
    tr.message = t("Création de l'image...");
    const code = await new Promise<number | null>((ok) => {
      const p = spawn(bin, args, { stdio: ["ignore", "pipe", "pipe"], cwd: dossierCreees() });
      travailActif = p;
      let journal = "";
      const lire = (d: Buffer) => {
        const s = d.toString();
        journal = (journal + s).slice(-3000);
        /*
         * Barre de progression du moteur : « |=====>    | 3/8 - 2.41s/it ».
         * Le chargement des poids a la même barre (« 12/386 ») : seules
         * comptent celles qui vont jusqu'au nombre d'étapes demandé.
         */
        const toutes = [...s.matchAll(/\|\s*(\d+)\/(\d+)\s*-/g)].filter((x) => Number(x[2]) === mod.etapes);
        const derniere = toutes[toutes.length - 1];
        if (derniere) {
          tr.etape = Number(derniere[1]);
          tr.total = Number(derniere[2]);
          tr.message = tf("Création de l'image : étape {0} sur {1}", tr.etape, tr.total);
        }
      };
      p.stdout.on("data", lire);
      p.stderr.on("data", lire);
      const garde = setTimeout(() => arreterArbre(p), moteur.lent ? 30 * 60_000 : 10 * 60_000);
      p.on("close", (c) => {
        clearTimeout(garde);
        travailActif = null;
        if (c !== 0) tr.erreur = journal.trim().split("\n").slice(-3).join(" ");
        ok(c);
      });
      p.on("error", (e) => {
        clearTimeout(garde);
        travailActif = null;
        tr.erreur = e.message;
        ok(-1);
      });
    });
    if (code === 0 && existsSync(sortie)) {
      const registre = lireIndex() ?? mettreDeCoteIndex();
      registre[imageId] = { pour: qui, ...(chat ? { chat } : {}), description, invite, date: new Date().toISOString(), largeur, hauteur };
      ecrireIndex(registre);
      tr.image = { id: imageId, largeur, hauteur, description };
      tr.etat = "fait";
      tr.message = t("Image créée.");
      journaliser("images.creee", qui, { modele: mod.id, variante: niveau.id, secondes: Math.round((Date.now() - tr.debut) / 1000) });
    } else {
      rmSync(sortie, { force: true });
      tr.etat = "echec";
      tr.message = t("L'image n'a pas pu être créée.");
    }
  })().catch((err: unknown) => {
    tr.etat = "echec";
    tr.message = t("L'image n'a pas pu être créée.");
    tr.erreur = err instanceof Error ? err.message : String(err);
  });
  return tr;
}

/* ------------------------------------------------------------------ */
/* Vidéos                                                              */
/* ------------------------------------------------------------------ */

/*
 * Demandé par Medhi le 27/09/2026 : « générer des vidéos, comme les images,
 * avec un modèle en fonction du PC ». Le même moteur (stable-diffusion.cpp,
 * mode `vid_gen`, qui écrit directement une vidéo WebM, lisible par
 * l'interface sans outil de plus ; vérifié dans les sources des deux
 * versions épinglées), les mêmes téléchargements vérifiés, le même rangement
 * que les images (registre, droits par Chat, effacement, export).
 *
 * Modèles Wan d'Alibaba, sous licence Apache 2.0, comme leur encodeur de
 * texte (umt5-xxl, Google) et leurs décodeurs : chaque fichier à une
 * révision précise, avec son empreinte, relevées sur Hugging Face le
 * 27/09/2026.
 *  - Wan 2.1, 1,3 milliard de paramètres : le plus léger, 832 x 480, deux
 *    secondes (33 images à 16 par seconde) ; dès 16 Go (Mac) ou une carte de
 *    8 Go ;
 *  - Wan 2.2 TI2V, 5 milliards : plus net, 1024 x 576, deux secondes à 24
 *    images par seconde ; dès 32 Go ou une carte de 16 Go.
 * Pas sur le processeur seul : il y passerait des heures.
 *
 * Pas encore essayés de bout en bout avec Helix (il faut les télécharger) :
 * `verifie: false`. L'écran ne le dit plus depuis le 28/09/2026 (PROJET.md
 * § 3.16).
 */

export type IdModeleVideo = "wan21-1.3b" | "wan22-5b";

interface VarianteVideo {
  id: string;
  diffusion: Fichier;
  texte: Fichier;
  vae: Fichier;
  /**
   * Décodeur allégé (TAEHV, madebyollin, licence MIT), à la place du décodeur
   * complet. Mesuré le 27/09/2026 sur un Mac M4 de 16 Go : les 20 étapes d'une
   * vidéo de deux secondes prennent 31 minutes, puis le décodeur complet
   * tournait encore 45 minutes plus tard, carte graphique à 100 %. Le moteur
   * le recommande lui-même quand la mémoire graphique manque ; l'image est un
   * peu moins fine.
   */
  allege?: boolean;
  memoireMac: number;
  vramPc: number;
  /** En paysage ; le portrait les échange. Multiples de 32. */
  largeur: number;
  hauteur: number;
  /** Nombre d'images, de la forme 4n + 1 comme l'exigent les modèles Wan. */
  images: number;
  ips: number;
}

interface ModeleVideo {
  id: IdModeleVideo;
  nom: string;
  editeur: string;
  licence: string;
  atout: string;
  etapes: number;
  cfg: number;
  /** `--flow-shift` : 3 pour Wan 2.1 en 480p, 5 pour Wan 2.2 (valeurs des exemples du moteur et des auteurs). */
  decalage: number;
  verifie: boolean;
  variantes: VarianteVideo[];
}

const W21 = "Comfy-Org/Wan_2.1_ComfyUI_repackaged";
const W21R = "123acf1cc74bccbb9bfff8ac1ee72edc08c2341d";
const W22 = "Comfy-Org/Wan_2.2_ComfyUI_Repackaged";
const W22R = "ee6f4a40737a995bf5818954cfce6d59443b0f04";
const U5 = "city96/umt5-xxl-encoder-gguf";
const U5R = "b535255bee98c2b0a59ea7c0ae2dcd0c6657b3b7";
const W5 = "QuantStack/Wan2.2-TI2V-5B-GGUF";
const W5R = "57437632ddd08bdcbd1508c866aa22e126ed51d2";

const UMT5_Q4: Fichier = { depot: U5, revision: U5R, chemin: "umt5-xxl-encoder-Q4_K_M.gguf", taille: 3_655_145_312, sha256: "17cf97a5bbbc60a646d6105b832b6f657ce904a8a1ad970e4b59df0c67584a40" };
const UMT5_Q8: Fichier = { depot: U5, revision: U5R, chemin: "umt5-xxl-encoder-Q8_0.gguf", taille: 6_043_068_256, sha256: "2521d4de0bf9e1cc6549866463ceae85e4ec3239bc6063f7488810be39033bbc" };
const TAEHV = "madebyollin/taehv";
const TAEHV_R = "011dfc2112197741c540e0bdd5b7b67bcc930771";
// Relevée en téléchargeant le fichier ; son empreinte Git est celle que publie GitHub pour cette révision.
const TAE_WAN21: Fichier = { depot: TAEHV, revision: TAEHV_R, chemin: "taew2_1.safetensors", taille: 22_642_902, sha256: "04766eac0221b5390b985ae3fdcca652cbb4b1e8b82b28ea7ff89dfad1b1a93f", url: `https://raw.githubusercontent.com/${TAEHV}/${TAEHV_R}/safetensors/taew2_1.safetensors` };
const VAE_WAN22: Fichier = { depot: W22, revision: W22R, chemin: "split_files/vae/wan2.2_vae.safetensors", taille: 1_409_400_960, sha256: "e40321bd36b9709991dae2530eb4ac303dd168276980d3e9bc4b6e2b75fed156" };

const MODELES_VIDEO: ModeleVideo[] = [
  {
    id: "wan21-1.3b",
    nom: "Wan 2.1 (1,3 milliard)",
    editeur: "Alibaba (Wan-AI)",
    licence: "Apache 2.0",
    atout: t("Le plus léger : deux secondes de vidéo, sur une machine de 16 Go."),
    /*
     * 15 étapes et 624 x 352 (27/09/2026, demandé par Medhi : « 90 minutes
     * c'est trop ») : mesuré sur un Mac M4 de 16 Go, 832 x 480 en 20 étapes
     * prenait 80 secondes par étape, puis le décodeur complet ne finissait pas
     * en 45 minutes. Environ deux fois moins de calcul par étape, un quart
     * d'étapes en moins, et le décodeur allégé.
     */
    etapes: 15,
    cfg: 6,
    decalage: 3,
    verifie: false,
    variantes: [
      {
        id: "standard",
        memoireMac: 16,
        vramPc: 8,
        diffusion: { depot: W21, revision: W21R, chemin: "split_files/diffusion_models/wan2.1_t2v_1.3B_fp16.safetensors", taille: 2_838_303_560, sha256: "be531024cd9018cb5b48c40cfbb6a6191645b1c792eb8bf4f8c1c6e10f924dc5" },
        texte: UMT5_Q4,
        vae: TAE_WAN21,
        allege: true,
        largeur: 624,
        hauteur: 352,
        images: 33,
        ips: 16,
      },
    ],
  },
  {
    id: "wan22-5b",
    nom: "Wan 2.2 (5 milliards)",
    editeur: "Alibaba (Wan-AI)",
    licence: "Apache 2.0",
    atout: t("Plus net et plus fluide, à 24 images par seconde ; pour les machines de 32 Go et plus."),
    etapes: 20,
    cfg: 5,
    decalage: 5,
    verifie: false,
    variantes: [
      {
        id: "fin",
        memoireMac: 32,
        vramPc: 16,
        diffusion: { depot: W5, revision: W5R, chemin: "Wan2.2-TI2V-5B-Q8_0.gguf", taille: 5_400_179_040, sha256: "57bece983817ab2f957546683bb670f13be7d99022d45674840cd999a050ea8f" },
        texte: UMT5_Q8,
        vae: VAE_WAN22,
        largeur: 1024,
        hauteur: 576,
        images: 49,
        ips: 24,
      },
    ],
  },
];

/** Ce que les modèles Wan évitent, tel que leurs auteurs le donnent (en chinois dans leurs exemples). */
const NEGATIF_WAN =
  "色调艳丽，过曝，静态，细节模糊不清，字幕，风格，作品，画作，画面，静止，整体发灰，最差质量，低质量，JPEG压缩残留，丑陋的，残缺的，多余的手指，画得不好的手部，画得不好的脸部，畸形的，毁容的，形态畸形的肢体，手指融合，静止不动的画面，杂乱的背景，三条腿，背景人很多，倒着走";

const fichiersVideo = (v: VarianteVideo) => [v.diffusion, v.texte, v.vae];
const tailleVideo = (v: VarianteVideo) => fichiersVideo(v).reduce((s, f) => s + f.taille, 0);
const modeleVideo = (id: string) => MODELES_VIDEO.find((m) => m.id === id);

/** Sur Mac, la mémoire unifiée ; sur PC, celle de la carte. Jamais le processeur seul. */
function varianteVideo(m: ModeleVideo, hw: Hardware): VarianteVideo | null {
  const vram = hw.gpuVramGb ?? 0;
  return m.variantes.find((v) => (hw.appleSilicon ? hw.totalMemoryGb >= v.memoireMac : vram >= v.vramPc)) ?? null;
}

const conseilleVideo = (hw: Hardware): IdModeleVideo =>
  (hw.appleSilicon ? hw.totalMemoryGb >= 32 : (hw.gpuVramGb ?? 0) >= 16) ? "wan22-5b" : "wan21-1.3b";

const installeeVideo = (m: ModeleVideo) => m.variantes.find((v) => fichiersVideo(v).every(fichierPresent)) ?? null;
const fichierChoixVideo = () => join(racine(), "choix-video.json");

function modeleVideoActif(hw: Hardware): { m: ModeleVideo; v: VarianteVideo } | null {
  let voulu: string | undefined;
  try {
    voulu = (JSON.parse(readFileSync(fichierChoixVideo(), "utf8")) as { modele?: string }).modele;
  } catch {
    /* rien de choisi */
  }
  const ordre = [modeleVideo(voulu ?? ""), modeleVideo(conseilleVideo(hw)), ...MODELES_VIDEO].filter(Boolean) as ModeleVideo[];
  for (const m of ordre) {
    const v = installeeVideo(m);
    if (v) return { m, v };
  }
  return null;
}

export function choisirModeleVideo(id: string): boolean {
  const m = modeleVideo(id);
  if (!m || !installeeVideo(m)) return false;
  mkdirSync(racine(), { recursive: true, mode: 0o700 });
  writeFileSync(fichierChoixVideo(), JSON.stringify({ modele: id }), { mode: 0o600 });
  return true;
}

let installationVideo: EtatImages["installation"] = null;

/** Même forme que l'état des images : l'écran se sert du même panneau. */
export async function etatVideos(): Promise<Omit<EtatImages, "actif" | "modeles"> & { actif: string | null; modeles: (Omit<ModeleProposé, "id"> & { id: string })[] }> {
  const hw = detectHardware();
  const moteur = moteurPour(hw, await versionMac());
  const moteurPret = Boolean(moteur && programme(moteur));
  const actif = modeleVideoActif(hw);
  const modeles = MODELES_VIDEO.map((m) => {
    const v = varianteVideo(m, hw);
    return {
      id: m.id,
      nom: m.nom,
      editeur: m.editeur,
      licence: m.licence,
      // Traduit à la demande : la constante est lue au chargement, dans la langue de l'instance.
      atout: t(m.atout),
      possible: Boolean(moteur && !moteur.lent && v),
      telechargementGo: v ? go(tailleVideo(v) + (moteurPret ? 0 : (moteur?.taille ?? 0) + (moteur?.complement?.taille ?? 0))) : 0,
      installe: Boolean(installeeVideo(m)),
      conseille: m.id === conseilleVideo(hw),
      verifie: m.verifie,
    };
  });
  const possible = modeles.some((m) => m.possible);
  let raison: string;
  if (!moteur) raison = glibcTropAncienne() ? RAISON_GLIBC() : t("Aucun moteur vidéo n'est publié pour ce système (Mac à puce Apple sous macOS 15 ou plus, Windows ou Linux 64 bits).");
  else if (moteur.lent) raison = t("Sans carte graphique reconnue, la vidéo n'est pas proposée : le processeur y passerait des heures.");
  // Sur un PC, c'est la mémoire de la carte graphique qui compte, pas la mémoire vive (revue du 27/09/2026).
  else if (!possible && hw.appleSilicon) raison = tf("{0} Go de mémoire : il en faut 16 au moins pour créer des vidéos sur cette machine.", hw.totalMemoryGb);
  else if (!possible) raison = tf("La carte graphique a {0} Go de mémoire : il en faut 8 au moins pour créer des vidéos.", hw.gpuVramGb ?? 0);
  else raison = t("Les vidéos sont créées sur cette machine, par un modèle ouvert : rien ne part sur internet. Comptez plusieurs minutes pour deux secondes de vidéo.");
  return { possible, raison, pret: moteurPret && Boolean(actif), actif: actif?.m.id ?? null, modeles, lent: false, installation: installationVideo };
}

/** Le moteur, s'il manque (partagé avec les images). Rend les octets téléchargés. */
async function installerMoteurSiBesoin(moteur: Moteur, avancer: (fait: number) => void): Promise<number> {
  if (programme(moteur)) return 0;
  const archives = [{ url: moteur.archive, sha256: moteur.sha256, taille: moteur.taille }, ...(moteur.complement ? [{ url: moteur.complement.archive, sha256: moteur.complement.sha256, taille: moteur.complement.taille }] : [])];
  let fait = 0;
  for (const a of archives) {
    const tmp = join(tmpdir(), `helix-images-${randomBytes(4).toString("hex")}.zip`);
    await telecharger(a.url, tmp, a.sha256, a.taille, (f) => avancer(fait + f));
    try {
      await extraire(tmp, dossierMoteur(moteur));
    } finally {
      rmSync(tmp, { force: true });
    }
    fait += a.taille;
  }
  const bin = programme(moteur);
  if (!bin) throw new Error(t("Le moteur d'images est installé, mais son programme est introuvable."));
  if (process.platform !== "win32") await exec("chmod", ["755", bin]).catch(() => undefined);
  return fait;
}

export function installerVideos(qui: string, id: string): Promise<void> {
  // Une installation à la fois, images ou vidéos : elles partagent le moteur et le dossier des modèles.
  if (enCours) return Promise.reject(new Error(t("Une installation est déjà en cours : attendez qu'elle finisse.")));
  const m = modeleVideo(id);
  if (!m) return Promise.reject(new Error(t("Modèle vidéo inconnu.")));
  installationVideo = { modele: m.id as unknown as IdModele, etape: "telechargement", message: t("Téléchargement du moteur vidéo..."), fait: 0, total: 0 };
  enCours = (async () => {
    const hw = detectHardware();
    const moteur = moteurPour(hw, await versionMac());
    const v = varianteVideo(m, hw);
    if (!moteur || moteur.lent || !v) throw new Error(tf("Cette machine ne peut pas faire tourner {0}.", m.nom));
    const aFaire = fichiersVideo(v).filter((f) => !fichierPresent(f));
    const moteurTaille = programme(moteur) ? 0 : moteur.taille + (moteur.complement?.taille ?? 0);
    const total = aFaire.reduce((s, f) => s + f.taille, 0) + moteurTaille;
    let precedents = 0;
    const suivre = (message: string) => (fait: number) => (installationVideo = { modele: m.id as unknown as IdModele, etape: "telechargement", message, fait: precedents + fait, total });
    precedents += await installerMoteurSiBesoin(moteur, suivre(t("Téléchargement du moteur vidéo...")));
    mkdirSync(dossierModeles(), { recursive: true, mode: 0o700 });
    for (const f of aFaire) {
      await telecharger(hf(f), join(dossierModeles(), nomLocal(f)), f.sha256, f.taille, suivre(tf("Téléchargement de {0} ({1} Go)...", m.nom, go(total))));
      precedents += f.taille;
    }
    installationVideo = null;
    choisirModeleVideo(m.id);
    journaliser("images.installees", qui, { modele: m.id, variante: v.id, moteur: moteur.version, video: true });
  })()
    .catch((err: unknown) => {
      installationVideo = { modele: m.id as unknown as IdModele, etape: "erreur", message: t("L'installation n'a pas abouti."), fait: 0, total: 0, erreur: err instanceof Error ? err.message : String(err) };
      throw err;
    })
    .finally(() => {
      enCours = null;
    });
  return enCours;
}

/** Retire un modèle vidéo (ou tous) ; ce que partagent d'autres modèles reste, les vidéos créées aussi. */
export async function desinstallerVideos(qui: string, id?: string): Promise<void> {
  const creationEnCours = [...travaux.values()].some((x) => x.etat === "preparation" || x.etat === "encours");
  if (enCours || travailActif || creationEnCours) throw new Error(t("Une installation ou une création est en cours : attendez qu'elle finisse."));
  const cibles = id ? MODELES_VIDEO.filter((x) => x.id === id) : MODELES_VIDEO;
  const gardes = new Set(
    [...MODELES.flatMap((x) => x.variantes.flatMap(fichiersDe)), ...MODELES_VIDEO.filter((x) => !cibles.includes(x)).flatMap((x) => x.variantes.flatMap(fichiersVideo))].map(nomLocal),
  );
  for (const f of cibles.flatMap((x) => x.variantes.flatMap(fichiersVideo))) if (!gardes.has(nomLocal(f))) rmSync(join(dossierModeles(), nomLocal(f)), { force: true });
  installationVideo = null;
  journaliser("images.desinstallees", qui, { modele: id ?? "videos", video: true });
}

/** Lance une vidéo ; elle se suit comme une image (`travail`). */
export async function lancerVideo(description: string, format: "paysage" | "portrait", qui: string, chat?: string): Promise<Travail> {
  if (travailActif || [...travaux.values()].some((x) => x.etat === "preparation" || x.etat === "encours")) {
    throw new Error(t("Une image ou une vidéo est déjà en cours de création sur cette machine : attendez qu'elle soit finie."));
  }
  const hw = detectHardware();
  const moteur = moteurPour(hw, await versionMac());
  const actif = modeleVideoActif(hw);
  const bin = moteur ? programme(moteur) : null;
  if (!moteur || !bin || !actif) throw new Error(t("La création de vidéos n'est pas encore installée sur cette machine."));

  const tr: Travail = { id: randomBytes(12).toString("hex"), pour: qui, etat: "preparation", message: t("Préparation de la description..."), etape: 0, total: actif.m.etapes, debut: Date.now() };
  travaux.set(tr.id, tr);
  for (const [k, v] of travaux) if (Date.now() - v.debut > 3_600_000 * 3) travaux.delete(k);

  void (async () => {
    const { m: mod, v: niveau } = actif;
    const [largeur, hauteur] = format === "portrait" ? [niveau.hauteur, niveau.largeur] : [niveau.largeur, niveau.hauteur];
    const invite = await preparerDescription(description, qui, true);
    tr.message = t("Place faite en mémoire...");
    await libererPourImage(tailleVideo(niveau) * 1.5);
    mkdirSync(dossierCreees(), { recursive: true, mode: 0o700 });
    const videoId = randomBytes(16).toString("hex");
    const sortie = join(dossierCreees(), `${videoId}.webm`);
    const f = (x: Fichier) => join(dossierModeles(), nomLocal(x));
    const args = [
      "-M", "vid_gen",
      "--diffusion-model", f(niveau.diffusion),
      ...(niveau.allege ? ["--tae", f(niveau.vae)] : ["--vae", f(niveau.vae)]),
      "--t5xxl", f(niveau.texte),
      "-p", invite,
      "-n", NEGATIF_WAN,
      "--cfg-scale", String(mod.cfg),
      "--sampling-method", "euler",
      "--steps", String(mod.etapes),
      "-W", String(largeur),
      "-H", String(hauteur),
      "--video-frames", String(niveau.images),
      "--fps", String(niveau.ips),
      "--flow-shift", String(mod.decalage),
      "--seed", String(Math.floor(Math.random() * 2 ** 31)),
      "--diffusion-fa",
      // Le décodage des images demande beaucoup de mémoire (le moteur le dit lui-même) : par morceaux.
      "--vae-tiling",
      "-o", sortie,
      ...(moteur.delester ? ["--offload-to-cpu"] : []),
    ];
    tr.etat = "encours";
    tr.message = t("Création de la vidéo...");
    const code = await new Promise<number | null>((ok) => {
      const p = spawn(bin, args, { stdio: ["ignore", "pipe", "pipe"], cwd: dossierCreees() });
      travailActif = p;
      let journal = "";
      const lire = (d: Buffer) => {
        const s = d.toString();
        journal = (journal + s).slice(-3000);
        const toutes = [...s.matchAll(/\|\s*(\d+)\/(\d+)\s*-/g)].filter((x) => Number(x[2]) === mod.etapes);
        const derniere = toutes[toutes.length - 1];
        if (derniere) {
          tr.etape = Number(derniere[1]);
          tr.total = Number(derniere[2]);
          tr.message = tr.etape >= tr.total ? t("Assemblage des images de la vidéo...") : tf("Création de la vidéo : étape {0} sur {1}", tr.etape, tr.total);
        }
      };
      p.stdout.on("data", lire);
      p.stderr.on("data", lire);
      // 45 minutes au plus : au-delà, la machine n'est pas faite pour, et on le dit plutôt que de la bloquer.
      const garde = setTimeout(() => {
        tr.erreur = t("Arrêtée au bout de 45 minutes : cette machine est trop juste pour ce réglage.");
        arreterArbre(p);
      }, 45 * 60_000);
      p.on("close", (c) => {
        clearTimeout(garde);
        travailActif = null;
        if (c !== 0) tr.erreur = journal.trim().split("\n").slice(-3).join(" ");
        ok(c);
      });
      p.on("error", (e) => {
        clearTimeout(garde);
        travailActif = null;
        tr.erreur = e.message;
        ok(-1);
      });
    });
    if (code === 0 && existsSync(sortie)) {
      const registre = lireIndex() ?? mettreDeCoteIndex();
      const secondes = Math.round((niveau.images / niveau.ips) * 10) / 10;
      registre[videoId] = { pour: qui, ...(chat ? { chat } : {}), description, invite, date: new Date().toISOString(), largeur, hauteur, video: true, secondes };
      ecrireIndex(registre);
      tr.image = { id: videoId, largeur, hauteur, description, video: true };
      tr.etat = "fait";
      tr.message = t("Vidéo créée.");
      journaliser("images.creee", qui, { modele: mod.id, variante: niveau.id, secondes: Math.round((Date.now() - tr.debut) / 1000), video: true });
    } else {
      rmSync(sortie, { force: true });
      tr.etat = "echec";
      tr.message = t("La vidéo n'a pas pu être créée.");
    }
  })().catch((err: unknown) => {
    tr.etat = "echec";
    tr.message = t("La vidéo n'a pas pu être créée.");
    tr.erreur = err instanceof Error ? err.message : String(err);
  });
  return tr;
}

/* ------------------------------------------------------------------ */
/* Images créées                                                       */
/* ------------------------------------------------------------------ */

type Registre = Record<string, { pour: string; chat?: string; description: string; invite: string; date: string; largeur: number; hauteur: number; video?: boolean; secondes?: number; audio?: boolean; mime?: string; supprimeLe?: string }>;

/** Le fichier d'une création : image PNG, ou vidéo WebM (27/09/2026). */
const EXTENSIONS_MEDIA: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif", "video/webm": "webm", "video/mp4": "mp4", "audio/mpeg": "mp3", "audio/wav": "wav", "audio/ogg": "ogg" };
const fichierCree = (id: string, e: { video?: boolean; mime?: string }) => join(dossierCreees(), `${id}.${e.mime ? EXTENSIONS_MEDIA[e.mime] ?? "bin" : e.video ? "webm" : "png"}`);

/**
 * Le registre des images, `{}` s'il n'existe pas encore, `null` s'il existe
 * mais ne se lit pas. Les deux étaient confondus : un registre abîmé (écriture
 * coupée, disque plein) valait `{}`, et l'image suivante réécrivait le
 * registre avec elle seule. Toutes les images d'avant devenaient
 * introuvables, pour leur auteur même.
 */
function lireIndex(): Registre | null {
  let brut: string;
  try {
    brut = readFileSync(index(), "utf8");
  } catch (err) {
    return (err as NodeJS.ErrnoException).code === "ENOENT" ? {} : null;
  }
  try {
    const r = JSON.parse(brut) as unknown;
    return r && typeof r === "object" && !Array.isArray(r) ? (r as Registre) : null;
  } catch {
    return null;
  }
}

/** Un registre illisible est gardé à côté, jamais écrasé ; on repart d'un registre neuf. */
function mettreDeCoteIndex(): Registre {
  try {
    copyFileSync(index(), join(dossierCreees(), `index.${new Date().toISOString().replace(/[:.]/g, "-")}.illisible.json`));
  } catch {
    /* rien à garder */
  }
  return {};
}

function ecrireIndex(r: Registre): void {
  const tmp = `${index()}.tmp`;
  writeFileSync(tmp, JSON.stringify(r), { mode: 0o600 });
  renameSync(tmp, index());
}

/* ------------------------------------------------------------------ */
/* Qui voit une image                                                  */
/* ------------------------------------------------------------------ */

/*
 * Une image se voit par son auteur, et par qui voit le Chat où elle a été
 * créée : les mêmes personnes, selon la même règle que le Chat lui-même
 * (`voitConversation`, authz.ts). Personne d'autre, même avec l'identifiant.
 *
 * Il faut donc savoir quels Chats contiennent une image. Relire et déchiffrer
 * toute la collection à chaque image affichée coûterait cher (un Chat ouvert
 * peut en montrer dix) : on tient un relevé « image → Chats », refait seulement
 * quand la collection a changé (sa révision, ou une écriture de cette
 * passerelle : `oublierChatsDesImages`). Le relevé ne garde des Chats que ce
 * qui décide de leur visibilité, pas leurs messages.
 */
type VueChat = { id: unknown; ownerId: unknown; sharedWith: unknown; sharedGroupIds: unknown; visibility: unknown };
let releve: { revision: number; parImage: Map<string, VueChat[]> } | null = null;

export function oublierChatsDesImages(): void {
  releve = null;
}

/*
 * Lire la révision coûte presque autant que lire la collection avec le
 * magasin de fichiers (il relit l'enveloppe entière). Mesuré le 25/09/2026 sur
 * 2 000 Chats de 40 messages (164 Mo) : 930 ms pour refaire le relevé, 240 ms
 * encore pour seulement vérifier la révision. Les écritures de cette
 * passerelle effacent déjà le relevé (`oublierChatsDesImages`) ; la révision
 * n'est donc relue qu'au-delà de cinq secondes, pour ce qu'un autre processus
 * aurait écrit (plusieurs instances sur une même base PostgreSQL).
 */
const VERIFIER_REVISION_MS = 5_000;
let verifieLe = 0;

async function chatsContenant(id: string): Promise<VueChat[]> {
  if (releve && Date.now() - verifieLe < VERIFIER_REVISION_MS) return releve.parImage.get(id) ?? [];
  // La révision d'abord, le contenu ensuite : un relevé peut être plus récent que sa révision, jamais plus ancien.
  const revision = await db().revision("sessions");
  verifieLe = Date.now();
  if (!releve || releve.revision !== revision) {
    const parImage = new Map<string, VueChat[]>();
    const sessions = await db().read("sessions");
    for (const s of Array.isArray(sessions) ? sessions : []) {
      if (!s || typeof s !== "object") continue;
      const chat = s as Record<string, unknown>;
      const vue: VueChat = { id: chat.id, ownerId: chat.ownerId, sharedWith: chat.sharedWith, sharedGroupIds: chat.sharedGroupIds, visibility: chat.visibility };
      for (const m of Array.isArray(chat.messages) ? chat.messages : []) {
        const im = (m as { image?: { id?: unknown } } | null)?.image?.id;
        if (typeof im !== "string" || !/^[0-9a-f]{32}$/.test(im)) continue;
        const liste = parImage.get(im) ?? [];
        if (!liste.includes(vue)) liste.push(vue);
        parImage.set(im, liste);
      }
    }
    releve = { revision, parImage };
  }
  return releve.parImage.get(id) ?? [];
}

/**
 * Chemin d'une image créée, pour qui a le droit de la voir ; sinon null
 * (l'appelant répond 404, sans dire si l'image existe).
 *
 * - son auteur, toujours ;
 * - qui voit le Chat où elle a été créée, tant que ce Chat la contient ;
 * - image d'avant le 25/09/2026 (sans Chat retenu) : qui voit un Chat de son
 *   auteur qui la contient. Un Chat d'une autre personne où l'identifiant
 *   aurait été recopié ne l'ouvre pas.
 */
export async function imageVisible(id: string, qui: Demandeur): Promise<{ chemin: string; auteur: boolean; type: string } | null> {
  if (!/^[0-9a-f]{32}$/.test(id)) return null;
  const e = lireIndex()?.[id];
  if (!e) return null;
  const p = fichierCree(id, e);
  if (!existsSync(p)) return null;
  const type = e.mime ?? (e.video ? "video/webm" : "image/png");
  if (e.pour === qui.userId) return { chemin: p, auteur: true, type };
  const chats = await chatsContenant(id);
  const autorise = chats.some(
    (c) => (e.chat ? c.id === e.chat : c.ownerId === e.pour) && voitConversation(c as unknown as Record<string, unknown>, qui),
  );
  return autorise ? { chemin: p, auteur: false, type } : null;
}

/**
 * Effacement d'un compte (effacement.ts) : ses images partent avec lui. Elles
 * restaient sur le disque, servies à personne mais gardées.
 */
/**
 * Pour l'export RGPD (export.ts) : les images créées par la personne, avec la
 * demande qui les a produites. Le fichier se télécharge depuis son Chat. Un
 * registre illisible rend une liste vide, que l'export signale.
 */
export function imagesDe(userId: string): { lisible: boolean; images: { id: string; description: string; invite: string; date: string; largeur: number; hauteur: number; video?: boolean; audio?: boolean; mime?: string; secondes?: number }[] } {
  const registre = lireIndex();
  if (!registre) return { lisible: false, images: [] };
  return {
    lisible: true,
    images: Object.entries(registre)
      .filter(([, e]) => e.pour === userId)
      .map(([id, e]) => ({ id, description: e.description, invite: e.invite, date: e.date, largeur: e.largeur, hauteur: e.hauteur, ...(e.video ? { video: true } : {}), ...(e.audio ? { audio: true } : {}), mime: e.mime, secondes: e.secondes })),
  };
}

export function oublierImagesDe(userId: string): number {
  const registre = lireIndex();
  // Registre illisible : on ne réécrit rien par-dessus (voir `lireIndex`).
  if (!registre) return 0;
  let n = 0;
  for (const [id, e] of Object.entries(registre)) {
    if (e.pour !== userId) continue;
    rmSync(fichierCree(id, e), { force: true });
    delete registre[id];
    n++;
  }
  if (n > 0) ecrireIndex(registre);
  return n;
}


/** Médiathèque privée du Studio : jamais les créations d'un autre compte. */
export function mediasStudio(userId: string) {
  const registre = lireIndex();
  if (!registre) throw new Error(t("Le registre des créations est illisible. Aucun fichier n'a été modifié."));
  return Object.entries(registre).filter(([, e]) => e.pour === userId).map(([id, e]) => ({ id, description: e.description, date: e.date, largeur: e.largeur, hauteur: e.hauteur, video: e.video, audio: e.audio, mime: e.mime ?? (e.video ? "video/webm" : "image/png"), secondes: e.secondes, supprimeLe: e.supprimeLe }));
}

/** Formats binaires seulement, contrôlés par signature : ni HTML, ni SVG, ni chemin du poste. */
export function importerMediaStudio(userId: string, corps: { contenu?: unknown; nom?: unknown; largeur?: unknown; hauteur?: unknown; secondes?: unknown }) {
  const m = typeof corps.contenu === "string" ? /^data:([a-z0-9/+.-]+);base64,([A-Za-z0-9+/]*={0,2})$/.exec(corps.contenu) : null;
  if (!m || !EXTENSIONS_MEDIA[m[1]!]) throw new Error(t("Ce format de média n'est pas pris en charge."));
  const mime = m[1]!; const b = Buffer.from(m[2]!, "base64");
  const texte = (debut: number, fin: number) => b.subarray(debut, fin).toString("ascii");
  const valide = mime === "image/png" ? b.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))
    : mime === "image/jpeg" ? b[0] === 255 && b[1] === 216 && b[2] === 255
    : mime === "image/gif" ? ["GIF87a", "GIF89a"].includes(texte(0,6))
    : mime === "image/webp" ? texte(0,4) === "RIFF" && texte(8,12) === "WEBP"
    : mime === "video/webm" ? b.subarray(0,4).equals(Buffer.from([26,69,223,163]))
    : mime === "video/mp4" ? texte(4,8) === "ftyp"
    : mime === "audio/wav" ? texte(0,4) === "RIFF" && texte(8,12) === "WAVE"
    : mime === "audio/ogg" ? texte(0,4) === "OggS"
    : texte(0,3) === "ID3" || (b[0] === 255 && ((b[1] ?? 0) & 224) === 224);
  if (!valide || b.length === 0 || b.length > 40 * 1024 * 1024) throw new Error(t("Le média est invalide ou dépasse 40 Mo."));
  const registre = lireIndex();
  if (!registre) throw new Error(t("Le registre des créations est illisible. Aucun fichier n'a été modifié."));
  const borne = (n: unknown, max: number) => typeof n === "number" && Number.isFinite(n) ? Math.max(0, Math.min(max, n)) : 0;
  const id = randomBytes(16).toString("hex");
  const e = { pour: userId, description: typeof corps.nom === "string" ? corps.nom.slice(0,180) : "", invite: "", date: new Date().toISOString(), largeur: borne(corps.largeur, 8192), hauteur: borne(corps.hauteur, 8192), secondes: borne(corps.secondes, 600), mime, video: mime.startsWith("video/"), audio: mime.startsWith("audio/") };
  mkdirSync(dossierCreees(), { recursive: true, mode: 0o700 });
  const fichier = fichierCree(id, e); writeFileSync(fichier, b, { flag: "wx", mode: 0o600 });
  try { registre[id] = e; ecrireIndex(registre); } catch (err) { rmSync(fichier, { force: true }); throw err; }
  return { id, ...e, pour: undefined, invite: undefined };
}

/** Corbeille réversible ; purge seulement sur demande explicite de l'auteur. */
export function modifierMediaStudio(userId: string, id: string, action: "corbeille" | "restaurer" | "supprimer") {
  if (!/^[0-9a-f]{32}$/.test(id)) return false;
  const registre = lireIndex();
  if (!registre) throw new Error(t("Le registre des créations est illisible. Aucun fichier n'a été modifié."));
  const e = registre[id]; if (!e || e.pour !== userId) return false;
  if (action === "supprimer") {
    if (!e.supprimeLe) return false;
    delete registre[id]; ecrireIndex(registre);
    try { rmSync(fichierCree(id, e), { force: true }); } catch (err) { registre[id] = e; ecrireIndex(registre); throw err; }
  } else { registre[id] = { ...e, supprimeLe: action === "corbeille" ? new Date().toISOString() : undefined }; ecrireIndex(registre); }
  return true;
}
