import { delaiVeilleSecondes } from "./contextesModeles.ts";
import { lireCarteNonNvidia, type CarteGraphique } from "./cartesGraphiques.ts";
import { execFileSync, spawn } from "node:child_process";
import os from "node:os";
import { existsSync, readdirSync, statSync, type Dirent } from "node:fs";
import { join } from "node:path";
import { backendById, ensureLmStudioServer, faireLaPlace, findLms, lmStudioRepond, optionsDeChargement } from "./backends.ts";
import { nomProduit } from "./marque.ts";
import { locale, t, tf } from "./langue.ts";
import { noteDuModele } from "./notesModeles.ts";
import { diagnosticInstallation, dossierLmStudio, dossierModelesLmStudio, moteurAPoser, preparerDossiersLlmster } from "./engine.ts";
import { applicationEnAttenteDeChoix } from "./reglagesMoteur.ts";
import { aEssayer, essayerModele, estDefaillant, nomDuModele, noterCoupure, noterEssai, type Verdict } from "./santeModeles.ts";
import { autoProvisionEnabled } from "./deployment.ts";
import { cleLlamaCpp, moteurOuvert, urlLlamaCpp } from "./llamaCppBase.ts";
import { chargerModeleLlama, dechargerModeleLlama, installerModeleLlama, llamaCppInstalle, modelesLlamaCpp, telechargerGgufVerifie, MODELES_GGUF } from "./llamaCpp.ts";
import { invalidate, resolve } from "./router.ts";
import { moteurDeLaMachine, type ModelInfo } from "./types.ts";

/**
 * Provisionnement automatique du modèle local (ARCHITECTURE.md, ADR-009).
 *
 * Objectif produit : si l'utilisateur choisit « local », il ne doit rien avoir
 * à configurer. La passerelle profile la machine, choisit un modèle adapté,
 * le télécharge et le charge — avec une progression visible.
 */

export interface Hardware {
  gpuFabricant?: "nvidia" | "amd" | "intel";
  gpuNom?: string;
  gpuDedie?: boolean;
  platform: NodeJS.Platform;
  arch: string;
  /** Mémoire totale, en gigaoctets. */
  totalMemoryGb: number;
  cpuCount: number;
  /** Apple Silicon : mémoire unifiée, donc utilisable par le GPU. */
  appleSilicon: boolean;
  /**
   * Mémoire dédiée de la carte, en Go. NVIDIA par nvidia-smi, AMD/Intel par
   * le pilote du système. Une mémoire illisible reste inconnue.
   */
  gpuVramGb?: number;
}

/*
 * Lue une fois par démarrage (audit Windows du 27/09/2026) : `detectHardware`
 * est appelé d'une quinzaine d'endroits, et chaque appel attendait
 * `nvidia-smi` (jusqu'à 3 s), la passerelle entière bloquée pendant ce temps.
 * La mémoire d'une carte ne change pas en cours de route.
 */
let vramLue: { valeur: number | undefined } | null = null;

/** Mémoire de la carte NVIDIA, lue par `nvidia-smi`. Indéfinie si absente. */
function memoireGraphique(platform: NodeJS.Platform): number | undefined {
  if (platform !== "win32" && platform !== "linux") return undefined;
  if (vramLue) return vramLue.valeur;
  vramLue = { valeur: lireMemoireGraphique() };
  return vramLue.valeur;
}

function lireMemoireGraphique(): number | undefined {
  try {
    const sortie = execFileSync("nvidia-smi", ["--query-gpu=memory.total", "--format=csv,noheader,nounits"], {
      timeout: 3000,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    // Plusieurs cartes : on retient la plus grosse, c'est elle qui portera le modèle.
    const mo = Math.max(...sortie.split("\n").map((l) => Number(l.trim())).filter((n) => Number.isFinite(n) && n > 0));
    return Number.isFinite(mo) ? Math.round((mo / 1024) * 10) / 10 : undefined;
  } catch {
    return undefined;
  }
}

let autreCarte: {carte:CarteGraphique|undefined}|null=null;
export function detectHardware(): Hardware {
  const platform = os.platform();
  const arch = os.arch();
  const vram = memoireGraphique(platform);
  if(vram===undefined&&!autreCarte)autreCarte={carte:lireCarteNonNvidia(platform)};
  const carte=vram===undefined?autreCarte?.carte:undefined;
  return {
    platform,
    arch,
    totalMemoryGb: Math.round((os.totalmem() / 1024 ** 3) * 10) / 10,
    cpuCount: os.cpus().length,
    appleSilicon: platform === "darwin" && arch === "arm64",
    ...(vram !== undefined ? { gpuVramGb: vram, gpuFabricant: "nvidia" as const, gpuDedie:true } : carte??{}),
  };
}

/**
 * Le modèle doit-il calculer au processeur ? Windows ou Linux sans carte
 * dédiée identifiée : c'est ainsi que `tientSur` choisit déjà le
 * modèle, et c'est là qu'il est chargé (`--gpu off`, backends.ts, 27/09/2026).
 */
export function calculSurProcesseur(hw: Hardware): boolean {
  return (hw.platform === "win32" || hw.platform === "linux") && hw.gpuVramGb === undefined && !hw.gpuDedie;
}

export interface CatalogEntry {
  /** Identifiant de téléchargement compris par `lms get` (catalogue LM Studio). */
  key: string;
  label: string;
  /** Qui publie les poids. */
  editeur: string;
  licence: string;
  /** Taille approximative du téléchargement (les poids), en Go. */
  downloadGb: number;
  /**
   * Note ECI d'Epoch AI (notesModeles.ts, relevé du 27/09/2026), lue par le
   * nom du modèle. Absente quand Epoch ne note pas ce modèle : c'est le cas des
   * plus petits (Qwen3 4B, Qwen3.5 4B, Ministral 3…), et rien ne la remplace.
   */
  eci?: number;
  /** Architecture à experts : seule une petite partie des poids calcule, donc rapide même sans carte graphique. */
  moe?: boolean;
  /**
   * Mémoire du cache de conversation à 32 768 jetons (en Gio, f16), calculée
   * sur le `config.json` publié du modèle (couches à attention pleine × têtes
   * K/V × taille de tête × 2 × 2 octets), relevé le 28/09/2026. Absente :
   * pas mesurée, et l'ancienne règle (30 % des poids) s'applique.
   */
  kvGo?: number;
  /** Lit les images (captures, photos, documents scannés). */
  vision?: boolean;
  /** Appelle des outils : badge « Trained for tool use » de la fiche LM Studio (relevé du 28/09/2026). */
  outils?: boolean;
  /** Raisonne avant de répondre : badge « Reasoning » de la fiche LM Studio, ou fiche du modèle (28/09/2026). */
  raisonne?: boolean;
  /**
   * Proposé au choix seulement (28/09/2026, page « Modèles ») : jamais
   * installé d'office, ni conseillé, ni pris en repli, ni dans la courte liste
   * du sélecteur. Voir `FICHES_AU_CHOIX`.
   */
  auChoix?: boolean;
  /**
   * Essayé avec Helix : niveaux de raisonnement, outils, découpage des tâches.
   * Seul un modèle vérifié est installé d'office ; les autres sont proposés,
   * en le disant.
   */
  verifie: boolean;
  /** Texte d'accompagnement, calculé dans la langue de la personne. */
  description: string;
}

type Fiche = Omit<CatalogEntry, "description">;

/*
 * Le catalogue.
 *
 * Choisi sur trois sources, relevées le 23/09/2026 (la note, le 27/09/2026) :
 *  - le catalogue de LM Studio (lmstudio.ai/models) : ce qu'on peut installer
 *    d'un clic, avec la mémoire minimale publiée et les capacités (outils,
 *    raisonnement, images) ;
 *  - l'indice ECI d'Epoch AI (CC BY 4.0, notesModeles.ts) : une seule échelle
 *    pour tous, quand le modèle y figure ;
 *  - la licence de chaque modèle : seulement des licences libres (Apache 2.0,
 *    MIT). Gemma, Llama et les licences « ouvertes » à conditions sont écartées :
 *    elles obligent à répercuter leurs restrictions dans chaque contrat client.
 *
 * Aucun éditeur n'est privilégié : à chaque taille de machine, c'est la note
 * qui départage. Qwen domine aujourd'hui presque toutes les tailles, mais
 * Mistral (France), OpenAI (gpt-oss), IBM et Meta sont au catalogue et
 * gagneront leur place s'ils dépassent. Modèles écartés parce qu'un autre fait
 * mieux pour la même mémoire : Qwen3.5 27B et Qwen3.6 27B (Qwen3.8 27B les
 * dépasse), Granite 4.1 30B, OLMo 3, LFM2, MiniMax M2 (121 Go),
 * Nemotron 3 (licence NVIDIA).
 */
/*
 * Tailles relevées sur lmstudio.ai/models le 28/09/2026 (revue du catalogue) :
 * six fiches annonçaient moins que le téléchargement réel (Qwen3.5 9B 6 Go au
 * lieu de 7, Ministral 3 8B 5,5 au lieu de 6,5, OLMo 3 7B Think 4,5 au lieu de
 * 6 et son cache sans les couches à fenêtre glissante…). Corrigé, parce que
 * `tientSur` juge sur ces chiffres : trop bas, un modèle passait pour tenir
 * sur une machine qu'il sature (Medhi : « pas de modèles trop puissants qui
 * vont tout faire crasher »). Conséquence voulue : Qwen3.5 9B n'est plus
 * conseillé sur une carte NVIDIA de 8 Go.
 */
const FICHES: Fiche[] = [
  /*
   * Pour les très grosses machines (Mac Studio de 256 Go et plus). Kimi K3
   * (ECI 157,7), GLM-5.3 (155,6) et MiniMax, plus forts encore, pèsent plusieurs
   * centaines de Go : ils ne tournent que sur un serveur à plusieurs cartes, et
   * s'utilisent dans Helix par un prestataire ou une clé, pas en local.
   */
  { key: "deepseek/deepseek-v4-flash", label: "DeepSeek V4 Flash", editeur: "DeepSeek", licence: "MIT", downloadGb: 150, moe: true, outils: true, raisonne: true, verifie: false },
  { key: "qwen/qwen3.8-27b", label: "Qwen3.8 27B", editeur: "Alibaba (Qwen)", licence: "Apache 2.0", downloadGb: 16, vision: true, outils: true, raisonne: true, verifie: false },
  { key: "qwen/qwen3.5-35b-a3b", label: "Qwen3.5 35B A3B", editeur: "Alibaba (Qwen)", licence: "Apache 2.0", downloadGb: 20, moe: true, vision: true, outils: true, raisonne: true, verifie: false },
  { key: "zai-org/glm-4.7-flash", label: "GLM-4.7 Flash", editeur: "Zhipu (Z.ai)", licence: "MIT", downloadGb: 16, moe: true, outils: true, raisonne: true, verifie: false },
  { key: "meta/muse-glimmer", label: "Muse Glimmer", editeur: "Meta", licence: "Apache 2.0", downloadGb: 25, vision: true, outils: true, raisonne: true, verifie: false },
  { key: "qwen/qwen3.5-9b", label: "Qwen3.5 9B", editeur: "Alibaba (Qwen)", licence: "Apache 2.0", downloadGb: 7, vision: true, kvGo: 1.0, outils: true, raisonne: true, verifie: true },
  { key: "qwen/qwen3.5-4b", label: "Qwen3.5 4B", editeur: "Alibaba (Qwen)", licence: "Apache 2.0", downloadGb: 3.75, vision: true, kvGo: 1.0, outils: true, raisonne: true, verifie: false },
  { key: "openai/gpt-oss-20b", label: "gpt-oss 20B", editeur: "OpenAI", licence: "Apache 2.0", downloadGb: 12, moe: true, outils: true, raisonne: true, verifie: false },
  { key: "mistralai/magistral-small-2509", label: "Magistral Small", editeur: "Mistral AI", licence: "Apache 2.0", downloadGb: 15.35, vision: true, outils: true, raisonne: true, verifie: false },
  { key: "qwen/qwen3-32b", label: "Qwen3 32B", editeur: "Alibaba (Qwen)", licence: "Apache 2.0", downloadGb: 19, outils: true, raisonne: true, verifie: true },
  { key: "qwen/qwen3-14b", label: "Qwen3 14B", editeur: "Alibaba (Qwen)", licence: "Apache 2.0", downloadGb: 9, outils: true, raisonne: true, verifie: true },
  { key: "qwen/qwen3-30b-a3b", label: "Qwen3 30B A3B", editeur: "Alibaba (Qwen)", licence: "Apache 2.0", downloadGb: 18, moe: true, outils: true, raisonne: true, verifie: true },
  { key: "qwen3-8b", label: "Qwen3 8B", editeur: "Alibaba (Qwen)", licence: "Apache 2.0", downloadGb: 5, kvGo: 4.5, outils: true, raisonne: true, verifie: true },
  { key: "qwen3-4b", label: "Qwen3 4B", editeur: "Alibaba (Qwen)", licence: "Apache 2.0", downloadGb: 2.5, kvGo: 4.5, outils: true, raisonne: true, verifie: true },
  { key: "qwen/qwen3.5-2b", label: "Qwen3.5 2B", editeur: "Alibaba (Qwen)", licence: "Apache 2.0", downloadGb: 1.6, vision: true, kvGo: 0.38, outils: true, raisonne: true, verifie: false },
  { key: "ibm/granite-4.1-8b", label: "Granite 4.1 8B", editeur: "IBM", licence: "Apache 2.0", downloadGb: 5, kvGo: 5.0, outils: true, verifie: false },
  { key: "mistralai/ministral-3-14b-reasoning", label: "Ministral 3 14B", editeur: "Mistral AI", licence: "Apache 2.0", downloadGb: 9, vision: true, outils: true, raisonne: true, verifie: false },
  { key: "qwen3-1.7b", label: "Qwen3 1.7B", editeur: "Alibaba (Qwen)", licence: "Apache 2.0", downloadGb: 1.9, kvGo: 3.5, outils: true, raisonne: true, verifie: true },
  { key: "mistralai/ministral-3-8b", label: "Ministral 3 8B", editeur: "Mistral AI", licence: "Apache 2.0", downloadGb: 6.5, vision: true, kvGo: 4.25, outils: true, verifie: false },
  { key: "allenai/olmo-3-7b-think", label: "OLMo 3 7B Think", editeur: "Ai2", licence: "Apache 2.0", downloadGb: 6, kvGo: 5.5, raisonne: true, verifie: false },
  { key: "mistralai/ministral-3-3b", label: "Ministral 3 3B", editeur: "Mistral AI", licence: "Apache 2.0", downloadGb: 2.5, vision: true, kvGo: 3.25, outils: true, verifie: false },
];

/*
 * Au choix seulement (28/09/2026, demandé par Medhi : « je veux laisser le
 * choix comme avec LM Studio », et des modèles plus petits si on veut). Ces
 * modèles s'installent depuis la page « Modèles » et l'écran de mise en
 * route ; ils ne sont jamais installés d'office, conseillés, pris en repli
 * ni mis dans la courte liste du sélecteur (`auChoix`). Le conseil et les
 * replis restent ceux du catalogue ci-dessus, choisi et en partie essayé :
 * certains d'ici sont mieux notés (Qwen3.6 35B A3B, Qwen3 30B A3B Thinking 2507), et les y
 * faire entrer changerait ce que Helix installe sur chaque machine. C'est à
 * Medhi d'en décider (PROJET.md § 3.22). Aucun n'a été chargé avec Helix.
 *
 * Relevé le 28/09/2026, pour chacun :
 *  - l'identifiant, la taille et les capacités (outils, raisonnement, images)
 *    sur sa fiche de lmstudio.ai/models : c'est ce que `lms get` télécharge ;
 *  - la licence sur la fiche Hugging Face du dépôt d'origine (celui que cite
 *    le GGUF de lmstudio-community comme `base_model`) : Apache 2.0 ou MIT ;
 *  - `kvGo` sur le `config.json` de ce dépôt, comme plus haut, en comptant
 *    aussi les couches à fenêtre glissante (OLMo 3 : 4 096 jetons, gpt-oss :
 *    128) pour ce qu'elles gardent.
 *
 * Écartés : Phi-4 (16 384 jetons au plus, Helix charge à 32 768), Bonsai 27B
 * (poids à 1 bit, noyaux encore dans les copies de l'éditeur), Laguna S 2.1
 * (licence OpenMDW), LFM2 (licence LFM), Nemotron 3 (licence NVIDIA),
 * Codestral (licence non commerciale), Devstral 2 123B (licence « other »),
 * les distillations Llama de DeepSeek R1 (licence Llama), Gemma et Llama,
 * GLM-5.3 Flash (seulement dans le cloud de LM Studio), Qwen3 0.6B et
 * SmolLM3 (absents du catalogue de LM Studio).
 *
 * Deux notes sont données ici parce que la clé de LM Studio ne porte pas le
 * mot « Instruct » sous lequel Epoch AI les publie : Qwen3 30B A3B 2507
 * (« Qwen3-30B-A3B-Instruct (Jul 2025) », 137,42) et Qwen3 235B A22B 2507
 * (« Qwen3-235B-A22B-Instruct (Jul 2025) », 138,93). Les autres se lisent par
 * le nom (notesModeles.ts).
 */
const AU_CHOIX = { auChoix: true, verifie: false } as const;
const FICHES_AU_CHOIX: Fiche[] = [
  // Alibaba (Qwen), Apache 2.0.
  { key: "qwen/qwen3-4b-2507", label: "Qwen3 4B Instruct 2507", editeur: "Alibaba (Qwen)", licence: "Apache 2.0", downloadGb: 2.3, kvGo: 4.5, outils: true, ...AU_CHOIX },
  { key: "qwen/qwen3-4b-thinking-2507", label: "Qwen3 4B Thinking 2507", editeur: "Alibaba (Qwen)", licence: "Apache 2.0", downloadGb: 2.3, kvGo: 4.5, outils: true, raisonne: true, ...AU_CHOIX },
  { key: "qwen/qwen3-30b-a3b-2507", label: "Qwen3 30B A3B Instruct 2507", editeur: "Alibaba (Qwen)", licence: "Apache 2.0", downloadGb: 17.4, moe: true, kvGo: 3.0, eci: 137.42, outils: true, ...AU_CHOIX },
  { key: "qwen/qwen3-30b-a3b-thinking-2507", label: "Qwen3 30B A3B Thinking 2507", editeur: "Alibaba (Qwen)", licence: "Apache 2.0", downloadGb: 17.4, moe: true, kvGo: 3.0, outils: true, raisonne: true, ...AU_CHOIX },
  { key: "qwen/qwen3-coder-30b", label: "Qwen3 Coder 30B A3B", editeur: "Alibaba (Qwen)", licence: "Apache 2.0", downloadGb: 15, moe: true, kvGo: 3.0, outils: true, ...AU_CHOIX },
  { key: "qwen/qwen3.5-27b", label: "Qwen3.5 27B", editeur: "Alibaba (Qwen)", licence: "Apache 2.0", downloadGb: 17, vision: true, kvGo: 2.0, outils: true, raisonne: true, ...AU_CHOIX },
  { key: "qwen/qwen3.6-27b", label: "Qwen3.6 27B", editeur: "Alibaba (Qwen)", licence: "Apache 2.0", downloadGb: 16.1, vision: true, kvGo: 2.0, outils: true, raisonne: true, ...AU_CHOIX },
  { key: "qwen/qwen3.6-35b-a3b", label: "Qwen3.6 35B A3B", editeur: "Alibaba (Qwen)", licence: "Apache 2.0", downloadGb: 20.4, moe: true, vision: true, kvGo: 0.63, outils: true, raisonne: true, ...AU_CHOIX },
  { key: "qwen/qwen3-next-80b", label: "Qwen3 Next 80B A3B", editeur: "Alibaba (Qwen)", licence: "Apache 2.0", downloadGb: 42, moe: true, kvGo: 0.75, outils: true, ...AU_CHOIX },
  { key: "qwen/qwen3-235b-a22b-2507", label: "Qwen3 235B A22B Instruct 2507", editeur: "Alibaba (Qwen)", licence: "Apache 2.0", downloadGb: 134.3, moe: true, kvGo: 5.9, eci: 138.93, outils: true, ...AU_CHOIX },
  { key: "qwen/qwen3-235b-a22b-thinking-2507", label: "Qwen3 235B A22B Thinking 2507", editeur: "Alibaba (Qwen)", licence: "Apache 2.0", downloadGb: 134.3, moe: true, kvGo: 5.9, outils: true, raisonne: true, ...AU_CHOIX },
  // Mistral AI (France), Apache 2.0.
  { key: "mistralai/ministral-3-3b-reasoning", label: "Ministral 3 3B Reasoning", editeur: "Mistral AI", licence: "Apache 2.0", downloadGb: 2, vision: true, kvGo: 3.25, outils: true, raisonne: true, ...AU_CHOIX },
  { key: "mistralai/mistral-7b-instruct-v0.3", label: "Mistral 7B Instruct v0.3", editeur: "Mistral AI", licence: "Apache 2.0", downloadGb: 4.1, kvGo: 4.0, ...AU_CHOIX },
  { key: "mistralai/ministral-3-8b-reasoning", label: "Ministral 3 8B Reasoning", editeur: "Mistral AI", licence: "Apache 2.0", downloadGb: 6.5, vision: true, kvGo: 4.25, outils: true, raisonne: true, ...AU_CHOIX },
  { key: "mistralai/mistral-nemo-instruct-2407", label: "Mistral NeMo 12B", editeur: "Mistral AI", licence: "Apache 2.0", downloadGb: 6.9, kvGo: 5.0, ...AU_CHOIX },
  { key: "mistralai/ministral-3-14b", label: "Ministral 3 14B Instruct", editeur: "Mistral AI", licence: "Apache 2.0", downloadGb: 9.5, vision: true, kvGo: 5.0, outils: true, ...AU_CHOIX },
  { key: "mistralai/mistral-small-3.2", label: "Mistral Small 3.2", editeur: "Mistral AI", licence: "Apache 2.0", downloadGb: 14.3, vision: true, kvGo: 5.0, ...AU_CHOIX },
  { key: "mistralai/devstral-small-2507", label: "Devstral Small 2507", editeur: "Mistral AI", licence: "Apache 2.0", downloadGb: 14.5, kvGo: 5.0, outils: true, ...AU_CHOIX },
  { key: "mistralai/devstral-small-2-2512", label: "Devstral Small 2", editeur: "Mistral AI", licence: "Apache 2.0", downloadGb: 16.3, vision: true, kvGo: 5.0, outils: true, ...AU_CHOIX },
  // Microsoft, MIT.
  { key: "microsoft/phi-4-mini", label: "Phi-4 mini", editeur: "Microsoft", licence: "MIT", downloadGb: 2.1, kvGo: 4.0, ...AU_CHOIX },
  { key: "microsoft/phi-4-mini-reasoning", label: "Phi-4 mini Reasoning", editeur: "Microsoft", licence: "MIT", downloadGb: 3, kvGo: 4.0, outils: true, raisonne: true, ...AU_CHOIX },
  { key: "microsoft/phi-4-reasoning", label: "Phi-4 Reasoning", editeur: "Microsoft", licence: "MIT", downloadGb: 8, kvGo: 6.25, outils: true, raisonne: true, ...AU_CHOIX },
  { key: "microsoft/phi-4-reasoning-plus", label: "Phi-4 Reasoning Plus", editeur: "Microsoft", licence: "MIT", downloadGb: 8, kvGo: 6.25, outils: true, raisonne: true, ...AU_CHOIX },
  // IBM, Apache 2.0. Les « H » sont hybrides (Mamba) : un cache presque nul.
  { key: "ibm/granite-4-h-micro", label: "Granite 4.0 H Micro", editeur: "IBM", licence: "Apache 2.0", downloadGb: 2.08, kvGo: 0.25, outils: true, ...AU_CHOIX },
  { key: "ibm/granite-4.1-3b", label: "Granite 4.1 3B", editeur: "IBM", licence: "Apache 2.0", downloadGb: 2.1, kvGo: 2.5, outils: true, ...AU_CHOIX },
  { key: "ibm/granite-4-micro", label: "Granite 4.0 Micro", editeur: "IBM", licence: "Apache 2.0", downloadGb: 2.25, kvGo: 2.5, outils: true, ...AU_CHOIX },
  { key: "ibm/granite-4-h-tiny", label: "Granite 4.0 H Tiny", editeur: "IBM", licence: "Apache 2.0", downloadGb: 4.54, moe: true, kvGo: 0.25, outils: true, ...AU_CHOIX },
  { key: "ibm/granite-4.1-30b", label: "Granite 4.1 30B", editeur: "IBM", licence: "Apache 2.0", downloadGb: 17.5, kvGo: 8.0, outils: true, ...AU_CHOIX },
  { key: "ibm/granite-4-h-small", label: "Granite 4.0 H Small", editeur: "IBM", licence: "Apache 2.0", downloadGb: 20.94, moe: true, kvGo: 0.5, outils: true, ...AU_CHOIX },
  // DeepSeek, MIT. Les distillations raisonnent (fiche du modèle), sans badge chez LM Studio.
  { key: "deepseek/deepseek-r1-distill-qwen-7b", label: "DeepSeek R1 Distill Qwen 7B", editeur: "DeepSeek", licence: "MIT", downloadGb: 4.3, kvGo: 1.75, raisonne: true, ...AU_CHOIX },
  { key: "deepseek/deepseek-r1-0528-qwen3-8b", label: "DeepSeek R1 0528 Qwen3 8B", editeur: "DeepSeek", licence: "MIT", downloadGb: 4.3, kvGo: 4.5, outils: true, raisonne: true, ...AU_CHOIX },
  { key: "deepseek/deepseek-r1-distill-qwen-14b", label: "DeepSeek R1 Distill Qwen 14B", editeur: "DeepSeek", licence: "MIT", downloadGb: 8.4, kvGo: 6.0, raisonne: true, ...AU_CHOIX },
  { key: "deepseek/deepseek-r1-distill-qwen-32b", label: "DeepSeek R1 Distill Qwen 32B", editeur: "DeepSeek", licence: "MIT", downloadGb: 18.7, kvGo: 8.0, raisonne: true, ...AU_CHOIX },
  // OpenAI, Apache 2.0 : pour les très grosses machines.
  { key: "openai/gpt-oss-120b", label: "gpt-oss 120B", editeur: "OpenAI", licence: "Apache 2.0", downloadGb: 65, moe: true, kvGo: 1.13, outils: true, raisonne: true, ...AU_CHOIX },
  // Ai2, Apache 2.0.
  { key: "allenai/olmo-3-7b", label: "OLMo 3 7B Instruct", editeur: "Ai2", licence: "Apache 2.0", downloadGb: 6, kvGo: 5.5, outils: true, ...AU_CHOIX },
  { key: "allenai/olmo-3-32b-think", label: "OLMo 3 32B Think", editeur: "Ai2", licence: "Apache 2.0", downloadGb: 19, kvGo: 2.75, raisonne: true, ...AU_CHOIX },
  // Zhipu (Z.ai), MIT.
  { key: "zai-org/glm-4.6v-flash", label: "GLM-4.6V Flash", editeur: "Zhipu (Z.ai)", licence: "MIT", downloadGb: 8, vision: true, kvGo: 1.25, outils: true, raisonne: true, ...AU_CHOIX },
  // Baidu, Apache 2.0.
  { key: "baidu/ernie-4.5-21b-a3b", label: "ERNIE 4.5 21B A3B", editeur: "Baidu", licence: "Apache 2.0", downloadGb: 12, moe: true, kvGo: 1.75, ...AU_CHOIX },
  // ByteDance (Seed), Apache 2.0.
  { key: "bytedance/seed-oss-36b", label: "Seed-OSS 36B", editeur: "ByteDance (Seed)", licence: "Apache 2.0", downloadGb: 21, kvGo: 8.0, outils: true, raisonne: true, ...AU_CHOIX },
  // Essential AI, Apache 2.0 : entraîné de zéro (architecture proche de Gemma 3, pas ses poids), 32 768 jetons au plus.
  { key: "essentialai/rnj-1", label: "Rnj-1 8B", editeur: "Essential AI", licence: "Apache 2.0", downloadGb: 5.5, kvGo: 4.0, outils: true, raisonne: true, ...AU_CHOIX },
];

/**
 * Modèles capables de désigner un élément sur une capture d'écran (rôle
 * « gui »), pour le contrôle de l'écran. Qwen3-VL est le seul essayé à ce
 * geste ; les Qwen3.5 et suivants lisent les images mais n'ont pas encore été
 * éprouvés au pointage.
 */
const FICHES_ECRAN: Fiche[] = [
  { key: "qwen/qwen3-vl-30b", label: "Qwen3-VL 30B A3B", editeur: "Alibaba (Qwen)", licence: "Apache 2.0", downloadGb: 18, moe: true, vision: true, outils: true, verifie: true },
  { key: "qwen3-vl-8b", label: "Qwen3-VL 8B", editeur: "Alibaba (Qwen)", licence: "Apache 2.0", downloadGb: 6, vision: true, outils: true, verifie: true },
  { key: "qwen3-vl-4b", label: "Qwen3-VL 4B", editeur: "Alibaba (Qwen)", licence: "Apache 2.0", downloadGb: 3.5, vision: true, outils: true, verifie: true },
  { key: "qwen3-vl-2b", label: "Qwen3-VL 2B", editeur: "Alibaba (Qwen)", licence: "Apache 2.0", downloadGb: 3, vision: true, outils: true, verifie: true },
  /*
   * Au choix seulement (28/09/2026) : même famille que les essayés, pas
   * essayée au pointage. Dense, 20 Go (lmstudio.ai/models/qwen/qwen3-vl-32b),
   * cache de 8 Gio à 32 768 jetons (config.json de Qwen/Qwen3-VL-32B-Instruct).
   * Hors du conseil : sans note, le plus lourd passe devant, et il aurait
   * remplacé Qwen3-VL 30B A3B sur les grosses machines.
   */
  { key: "qwen/qwen3-vl-32b", label: "Qwen3-VL 32B", editeur: "Alibaba (Qwen)", licence: "Apache 2.0", downloadGb: 20, vision: true, kvGo: 8.0, outils: true, ...AU_CHOIX },
];

/**
 * Fiche plus description. La description est un accesseur : elle se calcule à
 * chaque lecture, donc dans la langue de la demande en cours. Calculée une fois
 * au chargement du module, elle resterait figée en français.
 */
function decrire(f: Fiche, ecran = false): CatalogEntry {
  const eci = f.eci ?? noteDuModele(f.key)?.eci;
  return {
    ...f,
    ...(eci !== undefined ? { eci } : {}),
    get description() {
      // Sans outils (badge absent chez LM Studio, 28/09/2026) : on ne les promet pas.
      const usage = ecran
        ? t("Lit l'écran et désigne les éléments à cliquer.")
        : f.vision
          ? f.outils
            ? t("Conversation, rédaction, outils et images.")
            : t("Conversation, rédaction et images.")
          : f.outils
            ? t("Conversation, rédaction et outils.")
            : t("Conversation et rédaction.");
      const note =
        eci !== undefined
          ? tf("Note ECI d'Epoch AI : {0}.", eci.toLocaleString(locale()))
          : t("Pas de note publiée par Epoch AI pour ce modèle.");
      const rapide = f.moe ? ` ${t("Rapide, même sans carte graphique.")}` : "";
      // La note sur sa propre ligne (Medhi, 27/09/2026) : collée à la phrase, elle se coupait au milieu.
      return `${usage}${rapide}\n${note}`;
    },
  };
}

/*
 * Les modèles au choix sont dans le même catalogue (28/09/2026) : c'est lui
 * que la mise en route lit pour installer le modèle demandé
 * (`ensureLocalModel`). `auChoix` les tient à l'écart du conseil et des replis.
 */
export const CATALOG: CatalogEntry[] = [...FICHES, ...FICHES_AU_CHOIX].map((f) => decrire(f));
export const VISION_CATALOG: CatalogEntry[] = FICHES_ECRAN.map((f) => decrire(f, true));

/**
 * Pourquoi un modèle ne tient pas sur cette machine, chiffré pour l'écran
 * (page « Modèles », 28/09/2026) ; `null` s'il tient. Mêmes calculs que
 * `tientSur`, qui reste la seule règle : `npm run securite` (§ 32) vérifie
 * que les deux disent la même chose sur tout le catalogue et plusieurs
 * machines.
 *
 *  - « memoire » : il faut `demandeGo` de mémoire (poids, cache, réserve du
 *    système), la machine en a `disponibleGo` ;
 *  - « carte » : un modèle dense doit tenir sur la carte NVIDIA ;
 *  - « processeur » : sans carte graphique, un modèle dense de plus de 5 Go
 *    répond trop lentement (`disponibleGo` vaut alors 5).
 */
export function pourquoiTropLourd(
  hw: Hardware,
  f: { downloadGb: number; moe?: boolean; kvGo?: number },
): { raison: "memoire" | "carte" | "processeur"; demandeGo: number; disponibleGo: number } | null {
  if (tientSur(hw, f)) return null;
  const vram = hw.gpuVramGb ?? 0;
  const memeMemoire = hw.appleSilicon || vram < 6;
  const besoin =
    f.kvGo !== undefined && memeMemoire && hw.totalMemoryGb <= 36 ? f.downloadGb + f.kvGo + 0.5 : f.downloadGb * 1.3;
  const reserve = Math.min(8, Math.max(3, hw.totalMemoryGb * 0.3));
  const arrondi = (n: number) => Math.ceil(n * 10) / 10;
  if (!hw.appleSilicon && vram >= 6 && !f.moe) return { raison: "carte", demandeGo: arrondi(besoin), disponibleGo: vram };
  if (!hw.appleSilicon && vram < 6 && !f.moe && f.downloadGb > 5) return { raison: "processeur", demandeGo: f.downloadGb, disponibleGo: 5 };
  return { raison: "memoire", demandeGo: arrondi(besoin + reserve), disponibleGo: hw.totalMemoryGb };
}

/**
 * Ce modèle tourne-t-il confortablement sur cette machine ?
 *
 * « Confortablement » : sans que l'ordinateur bascule sur le disque, ce qui le
 * fige tout entier (constaté chez le client le 23/09/2026). On compte les
 * poids plus 30 % pour le contexte, et on laisse au système et aux autres
 * applications 30 % de la mémoire (au moins 3 Go, au plus 8).
 *
 *  - Mac Apple Silicon : mémoire unifiée, la carte graphique s'en sert.
 *  - PC avec carte NVIDIA : un modèle dense doit tenir dans la mémoire de la
 *    carte ; un modèle à experts peut déborder sur la mémoire vive.
 *  - PC sans carte graphique : le processeur calcule, lentement. Seuls les
 *    petits modèles et ceux à experts restent utilisables.
 */
export function tientSur(hw: Hardware, f: { downloadGb: number; moe?: boolean; kvGo?: number }): boolean {
  const vram = hw.gpuVramGb ?? 0;
  /*
   * Le cache de conversation, compté pour ce qu'il pèse (28/09/2026). Sur
   * 36 Go ou moins, Helix charge toujours avec 32 768 jetons
   * (`optionsDeChargement`, backends.ts) ; au processeur et sur un Mac, ce
   * cache prend la même mémoire que les poids. Les 30 % comptés jusqu'ici
   * valaient pour Qwen3.5 (1 Gio pour 3 Go de poids : trois couches sur
   * quatre sans cache), pas pour un modèle dense : Qwen3 4B en demande 4,5
   * Gio pour 2,5 Go de poids, Ministral 3 3B 3,25 Gio. Sur un PC ou un Mac de
   * 8 Go, les deux passaient pour tenir, et étaient les replis de Qwen3.5 4B.
   * 0,5 Go de plus pour les tampons de calcul (estimation, pas une mesure).
   * Avec une carte NVIDIA, rien ne change : LM Studio répartit lui-même.
   */
  const memeMemoire = hw.appleSilicon || vram < 6;
  const besoin =
    f.kvGo !== undefined && memeMemoire && hw.totalMemoryGb <= 36 ? f.downloadGb + f.kvGo + 0.5 : f.downloadGb * 1.3;
  const reserve = Math.min(8, Math.max(3, hw.totalMemoryGb * 0.3));
  if (hw.appleSilicon) return besoin + reserve <= hw.totalMemoryGb;
  if (vram >= 6) {
    /*
     * Un modèle à experts ne compte plus sur la carte pour tenir (28/09/2026,
     * demandé par Medhi : « pas de modèles trop puissants qui vont tout faire
     * crasher »). En additionnant la carte et la mémoire vive, un PC de 32 Go
     * avec 8 Go de carte se voyait conseiller Qwen3.5 35B A3B (20 Go, 34 Go
     * avec son cache et la réserve), et un PC de 16 Go gpt-oss 20B : la machine
     * au bord de la saturation. Il doit maintenant tenir dans la mémoire vive
     * seule, réserve comprise ; la carte n'est qu'une marge.
     */
    if (f.moe) return besoin + reserve <= hw.totalMemoryGb;
    return besoin <= vram;
  }
  if (f.moe) return besoin + reserve <= hw.totalMemoryGb;
  return f.downloadGb <= 5 && besoin + reserve <= hw.totalMemoryGb;
}

/**
 * Ce que la machine peut faire tourner, du mieux noté au moins bien noté.
 *
 * Un modèle noté passe devant un modèle sans note (27/09/2026, passage à
 * l'indice d'Epoch AI) : on ne lui prête pas une note qu'il n'a pas. Entre
 * deux modèles sans note, le plus lourd d'abord, comme le fait déjà le
 * sélecteur (« la note si elle existe, le poids sinon ») : à famille égale, un
 * modèle plus gros répond mieux. Conséquence mesurée sur le catalogue : sur un
 * PC de 16 Go sans carte graphique, Qwen3 8B (noté 136,2) passe devant
 * Qwen3.5 4B (non noté), qui passait devant avec l'ancien relevé ; sur un Mac
 * ou un PC de 8 Go, où aucun modèle noté ne tient, Qwen3.5 4B reste le premier.
 *
 * Sans les modèles qui ont mal répondu sur cette machine (santeModeles.ts,
 * 27/09/2026) : ils ne sont plus installés, recommandés ni proposés d'office.
 * On peut toujours les choisir à la main.
 *
 * Sans les modèles au choix (`auChoix`, 28/09/2026), sauf pour les listes où
 * la personne choisit elle-même (`avecAuChoix`) : ils ne sont ni conseillés
 * ni pris en repli.
 */
function classement(hw: Hardware, catalogue: CatalogEntry[], verifiesSeulement: boolean, avecAuChoix = false): CatalogEntry[] {
  return catalogue
    .filter((e) => (avecAuChoix || !e.auChoix) && (!verifiesSeulement || e.verifie) && tientSur(hw, e) && !estDefaillant(e.key))
    .sort((a, b) => {
      if (a.eci !== undefined && b.eci !== undefined) return b.eci - a.eci || a.downloadGb - b.downloadGb;
      if (a.eci !== undefined) return -1;
      if (b.eci !== undefined) return 1;
      return b.downloadGb - a.downloadGb;
    });
}

/** Le plus léger des modèles vérifiés, hors ceux qui ont mal répondu ici (tous, s'ils ont tous mal répondu). */
function legerVerifie(catalogue: CatalogEntry[]): CatalogEntry | undefined {
  const verifies = catalogue.filter((e) => e.verifie).sort((a, b) => a.downloadGb - b.downloadGb);
  return verifies.find((e) => !estDefaillant(e.key)) ?? verifies[0];
}

/**
 * Le modèle installé d'office : le mieux noté parmi ceux qui tiennent sur la
 * machine. À défaut, le plus léger vérifié.
 *
 * Pour converser, la note seule décide depuis le 25/09/2026, essayé avec
 * Helix ou non. Demandé par Medhi : « le but du logiciel est d'installer, en
 * fonction du PC, le meilleur modèle », même quand on n'a pas la machine pour
 * l'essayer. Avant, seuls les modèles essayés ici comptaient : sur un Mac de
 * 32 Go ou plus, Helix installait Qwen3.5 9B alors que Qwen3.8 27B, mieux
 * noté, tenait. Un modèle pas encore essayé le reste (`verifie`), sans que
 * l'écran le dise depuis le 28/09/2026 (PROJET.md § 3.16) ; s'il ne se charge
 * pas, les suivants du classement prennent le relais (`replis`), jusqu'au plus
 * léger vérifié, et l'accueil le dit.
 *
 * Pour piloter l'écran, même règle depuis le 26/09/2026 (Medhi : « pour tout,
 * tout doit s'adapter, et au pire toujours plusieurs modèles proposés ») : le
 * mieux noté qui tient est installé, et s'il ne se charge pas, les suivants,
 * jusqu'au plus léger essayé (Qwen3-VL). Un modèle qui lit les images sans
 * savoir désigner un point à l'écran clique à côté ; les autres restent
 * proposés. Le badge « pas encore vérifié avec Helix » du sélecteur a été
 * retiré le 28/09/2026 (PROJET.md § 3.16).
 */
function best(hw: Hardware, catalogue: CatalogEntry[], verifiesSeulement = false): CatalogEntry {
  const dernier = catalogue.filter((e) => !e.auChoix).at(-1) ?? catalogue[catalogue.length - 1]!;
  return classement(hw, catalogue, verifiesSeulement)[0] ?? legerVerifie(catalogue) ?? dernier;
}

/**
 * Modèles de repli si le conseillé ne se charge pas, ou répond mal à l'essai :
 * les suivants du classement, puis le plus léger vérifié. Ceux qui ont déjà
 * mal répondu sur cette machine n'y sont pas (sauf le départ, s'il a été
 * demandé nommément : il est alors réessayé).
 */
export function replis(hw: Hardware, catalogue: CatalogEntry[], depart: CatalogEntry): CatalogEntry[] {
  const suite = classement(hw, catalogue, false).filter((e) => e.key !== depart.key);
  const leger = legerVerifie(catalogue);
  const garderLeger = leger && leger.key !== depart.key && !suite.includes(leger) && !estDefaillant(leger.key);
  return [depart, ...suite, ...(garderLeger ? [leger] : [])];
}

/**
 * Modèles que cette machine peut faire tourner, pour qu'on puisse en ajouter
 * un sans rien savoir des tailles ni de la mémoire.
 *
 * Voulu par le client : l'installation pose UN modèle adapté (plus la dictée),
 * pas « 150 modèles » ; les autres sont seulement proposés, et seulement ceux
 * qui conviennent à la machine : les trois mieux notés et le meilleur de
 * chaque autre éditeur pour converser, et le meilleur pour piloter l'écran.
 */
export function adaptesALaMachine(hw: Hardware): (CatalogEntry & { role: "chat" | "gui"; recommande: boolean })[] {
  // Mac Intel : ce que le moteur ouvert sait poser, et aucun modèle d'écran (llamaCpp.ts).
  if (moteurOuvert()) {
    const conseil = best(hw, catalogueOuvert()).key;
    return classement(hw, catalogueOuvert(), false).map((e) => ({ ...e, role: "chat" as const, recommande: e.key === conseil }));
  }
  const conseilChat = best(hw, CATALOG).key;
  const conseilEcran = best(hw, VISION_CATALOG).key;
  /*
   * Du choix, pas six variantes du même éditeur. Classés à la note seule, les
   * six premiers étaient presque tous des Qwen (le client : « ils proposent pas
   * des modèles Mistral ? »). On garde donc les trois mieux notés, puis le
   * meilleur de chaque autre éditeur que la machine peut faire tourner.
   */
  const tous = classement(hw, CATALOG, false);
  const tete = tous.slice(0, 3);
  const editeursVus = new Set(tete.map((e) => e.editeur));
  const unParEditeur = tous.filter((e) => {
    if (tete.includes(e) || editeursVus.has(e.editeur)) return false;
    editeursVus.add(e.editeur);
    return true;
  });
  return [
    ...[...tete, ...unParEditeur].map((e) => ({ ...e, role: "chat" as const, recommande: e.key === conseilChat })),
    // Plusieurs modèles d'écran proposés, pas un seul : si le conseillé déçoit, on en installe un autre d'un clic.
    ...classement(hw, VISION_CATALOG, false)
      .slice(0, 3)
      .map((e) => ({ ...e, role: "gui" as const, recommande: e.key === conseilEcran })),
  ];
}

/**
 * Les modèles de conversation que cette machine fait tourner sans risque,
 * pour l'écran de mise en route (28/09/2026, demandé par Medhi : pouvoir
 * choisir plus petit, comme pour un modèle cloud, mais jamais un modèle trop
 * lourd pour la machine). Tous ceux qui tiennent (`tientSur`), du mieux noté
 * au moins bien noté, avec le moteur qui sert ici ; aucun autre n'est proposé.
 */
export function modelesQuiTiennent(hw: Hardware): CatalogEntry[] {
  // Les modèles au choix aussi : c'est la personne qui choisit (28/09/2026).
  return classement(hw, moteurOuvert() ? catalogueOuvert() : CATALOG, false, true);
}

export function recommend(hw: Hardware): CatalogEntry {
  return best(hw, CATALOG);
}

/**
 * Modèle d'écran conseillé. La contrainte mémoire s'ajoute à celle du modèle de
 * conversation : les deux tournent en même temps quand Cowork pilote l'écran.
 */
export function recommendVision(hw: Hardware): CatalogEntry {
  return best(hw, VISION_CATALOG);
}

/** Un nombre de gigaoctets, écrit comme on l'écrit dans la langue de la demande. */
function go(n: number): string {
  return n.toLocaleString(locale(), { maximumFractionDigits: 1 });
}

/** La raison, en une phrase, pour laquelle ce modèle n'est pas proposé ici. */
function phraseTropLourd(label: string, r: NonNullable<ReturnType<typeof pourquoiTropLourd>>): string {
  if (r.raison === "carte") {
    return tf("{0} demande environ {1} Go sur la carte graphique, celle de cette machine en a {2}.", label, go(r.demandeGo), go(r.disponibleGo));
  }
  if (r.raison === "processeur") {
    return tf("{0} pèse {1} Go : sans carte graphique, seuls les modèles de {2} Go au plus, ou à experts, répondent assez vite.", label, go(r.demandeGo), go(r.disponibleGo));
  }
  return tf("{0} demande environ {1} Go de mémoire, cette machine en a {2}.", label, go(r.demandeGo), go(r.disponibleGo));
}

export type ModeleDuCatalogue = CatalogEntry & {
  role: "chat" | "gui";
  recommande: boolean;
  /** Pourquoi il ne tient pas ici, chiffré ; absent s'il tient. */
  tropLourd?: NonNullable<ReturnType<typeof pourquoiTropLourd>> & { texte: string };
};

/**
 * Tout le catalogue, pour la page « Modèles » (28/09/2026) : ce qui tient sur
 * la machine, installable, et le reste, visible avec la raison chiffrée.
 * Mac Intel : le seul catalogue GGUF épinglé du moteur ouvert (llamaCpp.ts),
 * à la taille de ses fichiers, et aucun modèle d'écran.
 *
 * Copies faites à la lecture : la description et la phrase se calculent dans
 * la langue de la demande.
 */
export function catalogueComplet(hw: Hardware): ModeleDuCatalogue[] {
  const avecRaison = (e: CatalogEntry, role: "chat" | "gui", conseil: string): ModeleDuCatalogue => {
    const r = pourquoiTropLourd(hw, e);
    return { ...e, role, recommande: e.key === conseil, ...(r ? { tropLourd: { ...r, texte: phraseTropLourd(e.label, r) } } : {}) };
  };
  if (moteurOuvert()) {
    const liste = catalogueOuvert();
    const conseil = best(hw, liste).key;
    return liste.map((e) => avecRaison(e, "chat", conseil));
  }
  const conseilChat = best(hw, CATALOG).key;
  const conseilEcran = best(hw, VISION_CATALOG).key;
  return [...CATALOG.map((e) => avecRaison(e, "chat", conseilChat)), ...VISION_CATALOG.map((e) => avecRaison(e, "gui", conseilEcran))];
}

/**
 * Une demande d'installation nommée, refusée si le modèle ne tient pas sur la
 * machine (28/09/2026, Medhi : « il ne faut pas proposer des modèles trop
 * puissants qui vont tout faire crasher »). L'écran ne le propose pas ; la
 * passerelle le refuse aussi, pour une demande faite à la main. Le modèle
 * conseillé passe toujours : sur une machine où rien ne tient, c'est le plus
 * léger essayé, que la mise en route installe déjà sans qu'on le nomme.
 * Un nom hors catalogue garde l'ancien comportement (le conseillé est pris).
 */
export function refusTropLourd(hw: Hardware, key: string, role: "chat" | "gui"): string | null {
  const liste = role === "gui" ? VISION_CATALOG : CATALOG;
  const choix = moteurOuvert() ? catalogueOuvert(liste) : liste;
  const fiche = choix.find((e) => e.key === key);
  if (!fiche || fiche.key === best(hw, choix).key) return null;
  const r = pourquoiTropLourd(hw, fiche);
  return r ? phraseTropLourd(fiche.label, r) : null;
}

/** Délai d'inactivité au bout duquel un modèle libère la mémoire. */
// Délai d’inactivité relu au chargement, commun aux modèles locaux.

export type ProvisionPhase =
  | "idle"
  | "checking"
  | "downloading"
  | "loading"
  | "ready"
  | "error";

export interface ProvisionState {
  /** Échec du démarrage, distinct d’un téléchargement de modèle. */
  code?: "moteur_demarrage";
  phase: ProvisionPhase;
  message: string;
  /** Progression du téléchargement, de 0 à 100 quand elle est connue. */
  percent?: number;
  model?: string;
  error?: string;
}

// Message vide au repos : il est écrit au moment de le lire, dans la langue de qui le lit.
let state: ProvisionState = { phase: "idle", message: "" };
const listeners = new Set<(s: ProvisionState) => void>();

export function getProvisionState(): ProvisionState {
  if (state.phase === "idle" && !state.message) return { ...state, message: t("En attente.") };
  return state;
}

export function onProvisionChange(fn: (s: ProvisionState) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Permet aux autres étapes de mise en route (moteur) de publier leur progression. */
export function setProvisionState(next: Partial<ProvisionState>): void {
  setState(next);
}

function setState(next: Partial<ProvisionState>): void {
  state = { ...state, ...next, ...(next.phase ? { code: next.code } : {}) };
  for (const fn of listeners) fn(state);
}

/** Extrait un pourcentage d'une ligne de sortie de `lms get`. */
function parsePercent(line: string): number | undefined {
  const match = line.match(/(\d{1,3}(?:[.,]\d+)?)\s*%/);
  if (!match) return undefined;
  const value = Number(match[1].replace(",", "."));
  return Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : undefined;
}

/** Commandes courtes de `lms` (`ps`, `ls`, `unload`) : au-delà, le moteur ne répond plus (24/10/2026). */
const DELAI_LMS_COURT_MS = 90_000;
/** Un chargement en mémoire, comme dans backends.ts. */
const DELAI_LMS_CHARGEMENT_MS = 300_000;
/** Un téléchargement sans progrès pendant ce temps est relancé, et LM Studio le reprend où il en était. */
const SANS_PROGRES_MS = 3 * 60_000;

function run(
  command: string,
  args: string[],
  onLine: (line: string) => void,
  options: { silenceMaxMs?: number; progres?: () => string; totalMaxMs?: number } = {},
): Promise<{ ok: boolean; output: string; muet?: boolean }> {
  const { silenceMaxMs, progres } = options;
  // Une commande sans garde ne bloque plus la mise en route : sans réponse du moteur, l'écran restait sur « Vérification... » (24/10/2026).
  const totalMaxMs = options.totalMaxMs ?? (silenceMaxMs ? undefined : DELAI_LMS_COURT_MS);
  return new Promise((resolve) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    /*
     * `silenceMaxMs` : rien n'avance pendant ce temps, la commande est
     * arrêtée. Un `lms get` bloqué par une coupure du réseau gardait sinon
     * l'écran sur le même pourcentage, et toute nouvelle tentative attendait
     * derrière lui (revue du 27/09/2026).
     */
    let muet = false;
    let garde: NodeJS.Timeout | undefined;
    const armer = () => {
      if (!silenceMaxMs) return;
      clearTimeout(garde);
      garde = setTimeout(() => {
        muet = true;
        child.kill();
      }, silenceMaxMs);
    };
    armer();
    const plafond = totalMaxMs
      ? setTimeout(() => {
          muet = true;
          child.kill();
        }, totalMaxMs)
      : undefined;
    /*
     * `progres` : une mesure qui bouge tant que le travail avance (taille des
     * fichiers du modèle, pourcentage annoncé). Avec elle, c'est elle seule qui
     * réarme la garde, pas la sortie : vu sur l'essai Windows du 24/10/2026,
     * `lms get` redessine son animation dix fois par seconde à « 0.00% », et
     * la garde, réarmée à chaque image, laissait l'écran treize minutes sur
     * 0 % avant que LM Studio n'abandonne de lui-même (« Timed-out »).
     */
    let derniere = progres?.();
    const sonde = progres
      ? setInterval(() => {
          const v = progres();
          if (v !== derniere) {
            derniere = v;
            armer();
          }
        }, 15_000)
      : undefined;
    const handle = (chunk: Buffer) => {
      if (!progres) armer();
      const text = chunk.toString();
      output += text;
      for (const line of text.split(/\r?\n|\r/)) {
        const trimmed = line.trim();
        if (trimmed) onLine(trimmed);
      }
    };
    child.stdout.on("data", handle);
    child.stderr.on("data", handle);
    child.on("close", (code) => {
      clearTimeout(garde);
      clearTimeout(plafond);
      clearInterval(sonde);
      resolve({ ok: code === 0 && !muet, output, muet });
    });
    child.on("error", (err) => {
      clearTimeout(garde);
      clearTimeout(plafond);
      clearInterval(sonde);
      resolve({ ok: false, output: String(err) });
    });
  });
}

/**
 * Installe et charge un modèle de conversation si aucun n'est disponible.
 * Idempotent : si un modèle est déjà chargé, l'appel se termine aussitôt.
 */
/** Le message d'échec traduit-il un manque de mémoire plutôt qu'une panne ? */
function isResourceError(output: string): boolean {
  return /insufficient system resources|not enough memory|overload/i.test(output);
}

/**
 * Décharge les modèles résidents autres que celui demandé, et renvoie combien
 * ont été libérés. Les embarquements sont épargnés : ils pèsent quelques
 * dizaines de mégaoctets et servent à la recherche documentaire.
 */
async function unloadOthers(lms: string, garder: string): Promise<number> {
  const { output } = await run(lms, ["ps", "--json"], () => {});
  let charges: { modelKey?: string; path?: string; type?: string }[] = [];
  try {
    const parsed = JSON.parse(output);
    if (Array.isArray(parsed)) charges = parsed;
  } catch {
    return 0;
  }

  let liberes = 0;
  for (const entree of charges) {
    const cle = entree.modelKey ?? entree.path;
    if (!cle || cle === garder) continue;
    if (/embed/i.test(cle) || entree.type === "embedding") continue;
    const res = await run(lms, ["unload", cle], () => {});
    if (res.ok) {
      liberes += 1;
      console.log(`[helix] ${cle} déchargé pour libérer la mémoire.`);
    }
  }
  return liberes;
}

/**
 * Un seul provisionnement à la fois.
 *
 * Deux téléchargements du même modèle se ralentissent l'un l'autre sans jamais
 * finir : c'est arrivé en développement, où un double clic suffisait.
 */
let enCours: Promise<ProvisionState> | null = null;

/** Une mise en route tourne-t-elle (téléchargement, chargement, essai) ? Les modèles ne changent pas d'emplacement pendant ce temps. */
export const miseEnRouteEnCours = (): boolean => enCours !== null;

/** Taille totale, en octets, des modèles et téléchargements en cours du moteur : elle grossit tant qu'un téléchargement avance. */
function tailleDesModeles(): number {
  let total = 0;
  const parcourir = (dossier: string, profondeur: number) => {
    let entrees: Dirent[] = [];
    try {
      entrees = readdirSync(dossier, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entrees) {
      const chemin = join(dossier, e.name);
      if (e.isDirectory() && profondeur < 4) parcourir(chemin, profondeur + 1);
      else if (e.isFile()) {
        try {
          total += statSync(chemin).size;
        } catch {
          /* disparu entre-temps */
        }
      }
    }
  };
  const racine = dossierLmStudio();
  // Le dossier des modèles de LM Studio, ou celui de son réglage « My Models › Change » (28/09/2026).
  parcourir(dossierModelesLmStudio(), 0);
  parcourir(join(racine, ".internal", "temp-downloads"), 0);
  return total;
}

/**
 * Ce que l'écran dit d'un téléchargement raté (24/10/2026). La sortie de
 * `lms get` est surtout sa barre de progression, couleurs et retours chariot
 * compris : vu sur la machine Windows de l'essai, l'écran affichait
 * « 24% | 4.08 MB / 1.67 GB | 154.72 KB/s | ETA 02:59:47 » suivi de codes de
 * terminal. On retire les codes, on écarte les lignes de progression, et s'il
 * ne reste rien, c'est que la connexion s'est arrêtée en route.
 */
export function raisonTelechargement(sortie: string): string {
  const propre = sortie
    .replace(/\u001b\[[0-9;?]*[A-Za-z]/g, "")
    .replace(/\u001b[78su]/g, "")
    .split(/\r?\n|\r/)
    .map((l) => l.trim())
    .filter((l) => l && !/^[⠀-⣿]?\s*\[?[▏▎▍▌▋▊▉█\s]*\]?\s*\d+(?:\.\d+)?%\s*\|/.test(l) && !/^\d+(?:\.\d+)?%\s*\|/.test(l));
  const erreurs=propre.filter(l=>/\b(error|failed|timed.?out|connection|ENOSPC|ECONN|EAI_AGAIN)\b/i.test(l)).map(l=>{const i=l.search(/\b(?:Error|Erreur)\s*:|\b(?:Download failed|Timed.out|ECONN\w*|EAI_AGAIN|ENOSPC)\b/i);return i>=0?l.slice(i):l});
  const utiles=erreurs.length?erreurs:propre.filter(l=>!/%|[⠀-⣿▏▎▍▌▋▊▉█]|\bETA\b/.test(l));
  const reste = [...new Set(utiles)].join(" ").slice(-300).trim();
  return reste || t("La connexion s'est arrêtée pendant le téléchargement, ou elle est trop lente : vérifiez-la, puis réessayez.");
}

/** Un `lms get` tourne-t-il déjà pour ce modèle, lancé par une session passée ? */
async function dejaEnTelechargement(key: string): Promise<boolean> {
  /*
   * Pas de `pgrep` sous Windows : un `lms get` y est l'enfant de la passerelle,
   * et meurt sans doute avec elle (supposé, pas vu sur un vrai PC). On n'y
   * reprend donc rien (revue Windows du 27/09/2026).
   */
  if (process.platform === "win32") return false;
  const { ok } = await run("/usr/bin/pgrep", ["-f", `lms get ${key}`], () => {});
  return ok;
}

/**
 * Le nom sous lequel LM Studio range (`ls`) ou sert (`ps`) un modèle du
 * catalogue, ou `key` s'il n'en connaît pas d'autre.
 *
 * Pourquoi (essai Windows de bout en bout, 28/09/2026, llmster 0.0.25) :
 * `lms get qwen3-1.7b` range le modèle sous « qwen/qwen3-1.7b ». La mise en
 * route le chargeait par `lms load qwen3-1.7b` (servi sous
 * « qwen/qwen3-1.7b », 32 768 jetons, TTL de 20 min), puis posait la question
 * d'essai au nom « qwen3-1.7b » : le serveur, qui ne sert rien sous ce nom, en
 * chargeait une SECONDE copie à sa façon (chargement à la demande :
 * 8 192 jetons, quatre réponses en parallèle, une heure avant de libérer la
 * mémoire). Deux copies en mémoire après chaque mise en route (`lms ps`), et
 * deux fois le modèle au sélecteur du Chat ; avec Qwen3 8B sur un PC de
 * 16 Go, de quoi saturer la machine. Chargé, essayé et déchargé désormais
 * sous le nom que LM Studio lui donne.
 */
async function nomChezLmStudio(lms: string, key: string, commande: "ls" | "ps"): Promise<string> {
  const { ok, output } = await run(lms, [commande, "--json"], () => {});
  if (!ok) return key;
  let entrees: { modelKey?: unknown; identifier?: unknown; type?: unknown }[] = [];
  try {
    const lu = JSON.parse(output);
    if (Array.isArray(lu)) entrees = lu;
  } catch {
    return key;
  }
  const noms = entrees
    .filter((e) => e.type !== "embedding")
    .map((e) => (commande === "ps" ? (e.identifier ?? e.modelKey) : e.modelKey))
    .filter((n): n is string => typeof n === "string");
  return noms.find((n) => n === key) ?? noms.find((n) => memeModele(n, key)) ?? key;
}

/** Le nom sous lequel LM Studio sert déjà ce modèle (`lms ps`), ou null s'il n'est pas en mémoire. */
async function chargeSous(lms: string, key: string): Promise<string | null> {
  const { ok, output } = await run(lms, ["ps", "--json"], () => {});
  if (!ok) return null;
  try {
    const lu = JSON.parse(output) as unknown;
    if (!Array.isArray(lu)) return null;
    const noms = (lu as { identifier?: unknown; modelKey?: unknown; type?: unknown }[])
      .filter((e) => e.type !== "embedding")
      .map((e) => e.identifier ?? e.modelKey)
      .filter((n): n is string => typeof n === "string");
    return noms.find((n) => n === key) ?? noms.find((n) => memeModele(n, key)) ?? null;
  } catch {
    return null;
  }
}

/**
 * L'essai du modèle qu'on vient de charger (santeModeles.ts, 27/09/2026) :
 * une courte question, un verdict, noté pour cette machine. Réussi : l'écran
 * dit « prêt ». Raté : le modèle est déchargé et l'écran dit lequel suit.
 */
async function essaiReussi(lms: string, choice: CatalogEntry, suivant: CatalogEntry | undefined, servi = choice.key): Promise<boolean> {
  setState({
    phase: "loading",
    message: tf("Vérification de {0} : une courte question d'essai...", choice.label),
    percent: undefined,
  });
  const backend = backendById("lmstudio");
  // Sans serveur connu, rien à essayer : le modèle est pris tel quel, comme avant.
  // Sous le nom où il est chargé (`servi`) : sous un autre, LM Studio en chargeait une seconde copie (`nomChezLmStudio`).
  const verdict: Verdict = backend ? await essayerModele(backend.baseUrl, servi, backend.apiKey) : { ok: true, indecis: "sans serveur" };
  noterEssai(choice.key, verdict);
  if (verdict.ok) {
    setState({ phase: "ready", message: tf("{0} est prêt.", choice.label), percent: 100 });
    return true;
  }
  await run(lms, ["unload", servi], () => {});
  invalidate();
  if (suivant) {
    setState({
      phase: "checking",
      message: tf("{0} ne répond pas correctement sur cette machine, essai de {1}...", choice.label, suivant.label),
    });
  }
  return false;
}

/**
 * Poste déjà installé (27/09/2026) : le modèle conseillé pour cette machine,
 * s'il est déjà là mais n'a jamais été essayé, passe l'essai une fois, au
 * démarrage de la passerelle. S'il répond mal, la mise en route prend le
 * suivant d'elle-même, téléchargement compris : c'est ce qui fait basculer le
 * PC de Medhi, où Qwen3.5 4B était installé, sans rien réinstaller.
 *
 * Rien si le modèle conseillé n'est pas installé (on n'installe rien de neuf
 * au démarrage), ni sans serveur local qui réponde, ni quand l'intégrateur
 * prépare les modèles.
 */
export async function verifierModeleEnPlace(): Promise<void> {
  if (enCours || !autoProvisionEnabled()) return;
  if (moteurOuvert()) {
    const conseil = best(detectHardware(), catalogueOuvert());
    if (!aEssayer(conseil.key) || !modelesLlamaCpp().includes(conseil.key)) return;
    console.log(`[helix] ${conseil.key} n'a jamais été essayé sur cette machine : essai au démarrage.`);
    await ensureLocalModel();
    invalidate();
    return;
  }
  if (!backendById("lmstudio")?.enabled || !(await lmStudioRepond())) return;
  const lms = await findLms();
  if (!lms || moteurAPoser()) return;
  const conseil = best(detectHardware(), CATALOG);
  if (!aEssayer(conseil.key)) return;
  const installes = await run(lms, ["ls"], () => {});
  if (!installes.ok || !installes.output.includes(conseil.key)) return;
  console.log(`[helix] ${conseil.key} n'a jamais été essayé sur cette machine : essai au démarrage.`);
  await ensureLocalModel();
  invalidate();
}

/** Deux identifiants désignent-ils le même modèle (avec ou sans éditeur, copie « :2 ») ? */
const memeModele = (a: string, b: string) => nomDuModele(a) === nomDuModele(b);

/**
 * Ce qui prend le relais d'un modèle qui vient d'être noté défaillant sur
 * cette machine, dit en une phrase pour le Chat.
 *
 *  - Un autre modèle est là : en « Auto », c'est lui qui répondra ensuite ;
 *    avec un modèle choisi à la main, la personne garde son choix, et on lui
 *    dit comment en changer.
 *  - Aucun autre : la mise en route en installe un adapté à la machine, en
 *    arrière-plan (hors déploiement piloté par l'intégrateur).
 */
export async function relaisApresDefaillance(modele: string, auto: boolean): Promise<string> {
  invalidate();
  const r = await resolve({ role: "chat" });
  const autre = "error" in r || memeModele(r.model.id, modele) || estDefaillant(r.model.id) ? null : r.model;
  if (autre) {
    return auto
      ? tf("En « Auto », {0} n'est plus choisi sur cette machine : la prochaine réponse viendra de {1}.", modele, autre.id)
      : tf("{0} n'est plus choisi d'office sur cette machine ; il reste sélectionné pour ce Chat : passez en « Auto » ou choisissez un autre modèle.", modele);
  }
  if (autoProvisionEnabled() && !enCours) {
    void ensureLocalModel()
      .then(() => invalidate())
      .catch((err: unknown) => console.error("[helix] relais après défaillance", err));
    return tf("{0} n'est plus choisi d'office sur cette machine, et {1} installe un modèle qui lui convient : les réponses suivantes viendront de lui dès qu'il sera prêt.", modele, nomProduit());
  }
  return tf("{0} n'est plus choisi d'office sur cette machine, et aucun autre modèle n'y est installé.", modele);
}

/**
 * Une réponse d'un modèle local vient d'être coupée par le garde-fou (chat.ts) :
 * noté pour cette machine. La phrase rendue complète le message du Chat.
 */
export async function apresCoupure(model: ModelInfo, auto: boolean): Promise<string> {
  if (!moteurDeLaMachine(model.backendKind)) return "";
  const etat = noterCoupure(model.id);
  if (etat === "douteux") return tf("Si cela se reproduit, {0} ne sera plus choisi d'office sur cette machine.", model.id);
  if (etat !== "defaillant") return "";
  console.warn(`[helix] ${model.id} noté défaillant sur cette machine : deux réponses parties en boucle.`);
  return `${t("C'est la deuxième fois sur cette machine.")} ${await relaisApresDefaillance(model.id, auto)}`;
}

export function ensureLocalModel(
  requested?: string,
  catalogue: CatalogEntry[] = CATALOG,
): Promise<ProvisionState> {
  if (enCours) return enCours;
  /*
   * « En cours » dès l'appel, avant la première attente (28/09/2026) : sous
   * LM Studio, `provision` cherche d'abord `lms` avant de rien publier, et
   * l'écran qui relisait l'état juste après sa demande y trouvait encore
   * l'échec précédent. Il cessait alors de suivre, et restait sur cet
   * échec pendant que la nouvelle installation tournait.
   */
  setState({ phase: "checking", message: t("Vérification des modèles disponibles..."), percent: undefined, error: undefined });
  enCours = provision(requested, catalogue)
    // Un rejet ne laisse pas l'écran sur « en cours » : l'essai au démarrage et le relais après défaillance ne font que le journaliser.
    .catch((err: unknown) => {
      setState({ phase: "error", message: t("L'installation du modèle a échoué."), error: err instanceof Error ? err.message : String(err) });
      throw err;
    })
    .finally(() => {
      enCours = null;
    });
  return enCours;
}

async function provision(
  requested?: string,
  catalogue: CatalogEntry[] = CATALOG,
): Promise<ProvisionState> {
  // Mac Intel : le moteur ouvert, sans `lms` (llamaCpp.ts, 28/09/2026).
  if (moteurOuvert()) return provisionOuverte(requested, catalogue);
  /*
   * LM Studio coupé par le profil (28/09/2026) : rien à installer, et `lms`
   * n'est pas lancé. Avant, une demande de mise en route cherchait quand même
   * le `lms` de la machine (`lms version`, puis `lms get`), comme la
   * découverte jusqu'au 27/09 (backends.ts).
   */
  if (!backendById("lmstudio")?.enabled) {
    setState({
      phase: "error",
      message: t("LM Studio est coupé sur cette instance : aucun modèle local n'y est installé."),
      error: t("Les modèles sont ceux que le profil de l'instance déclare."),
    });
    return state;
  }
  const lms = await findLms();
  // L'application LM Studio de la personne, fermée, que Helix ne démarre pas sans son accord (23/10/2026, engine.ts).
  if (!lms && (await applicationEnAttenteDeChoix())) {
    setState({
      phase: "error",
      message: t("L'application LM Studio est fermée."),
      error: tf("Ouvrez LM Studio, ou choisissez dans les réglages, Modèles locaux, le moteur que {0} peut démarrer lui-même.", nomProduit()),
    });
    return state;
  }
  // `lms` sans moteur qu'il sache démarrer (Mac à puce Apple, engine.ts) : le moteur est à installer.
  if (!lms || moteurAPoser()) {
    setState({
      phase: "error",
      message: t("LM Studio est introuvable sur cette machine."),
      error: tf("Installez le moteur depuis l'écran de mise en route, ou LM Studio depuis lmstudio.ai (ouvrez-le une fois), puis relancez : {0} s'occupe du reste.", nomProduit()),
    });
    return state;
  }

  /*
   * Le service de LM Studio d'abord, par la voie de l'application sous Windows
   * (backends.ts, `lancerLms`, 28/09/2026) : sans lui, `lms get` le démarrait
   * lui-même depuis la passerelle, là où il ne démarrait pas (« Timed out
   * waiting for LM Studio daemon to start »). Sans effet s'il tourne déjà.
   */
  await ensureLmStudioServer().catch(() => false);

  const hw = detectHardware();
  const start = requested
    ? (catalogue.find((c) => c.key === requested) ?? best(hw, catalogue))
    : best(hw, catalogue);

  setState({
    phase: "checking",
    message: t("Vérification des modèles disponibles..."),
    model: start.key,
    percent: undefined,
    error: undefined,
  });

  /*
   * Un modèle déjà chargé en mémoire suffit : ne rien refaire. Sauf s'il n'a
   * jamais été essayé sur cette machine (poste installé avant l'essai, comme
   * le PC de Medhi, 27/09/2026) : l'essai se fait alors une fois, sans le
   * recharger, et un modèle qui répond mal cède la place au suivant.
   */
  const loadedNow = await run(lms, ["ps"], () => {});
  const dejaCharge = loadedNow.output.includes(start.key);
  if (dejaCharge && !aEssayer(start.key)) {
    setState({ phase: "ready", message: tf("{0} est déjà prêt.", start.label), percent: 100 });
    return state;
  }

  let installed = await run(lms, ["ls"], () => {});
  /*
   * Le moteur ne répond plus du tout (`lms ps` ou `lms ls` sans réponse en
   * une minute et demie) : dit tout de suite, au lieu de laisser l'écran sur
   * « Vérification des modèles disponibles... » (24/10/2026).
   */
  if (loadedNow.muet || installed.muet) {
    console.error(`[helix] moteur LM Studio sans réponse à « lms ${loadedNow.muet ? "ps" : "ls"} » : ${diagnosticInstallation()}`);
    setState({
      phase: "error",
      message: t("Le moteur des modèles ne démarre pas sur cette machine."),
      error: tf("Quittez {0} puis rouvrez-le : l'écran de mise en route proposera de réinstaller le moteur. Si cela se répète, installez LM Studio depuis lmstudio.ai, ouvrez-le une fois, puis revenez.", nomProduit()),
    });
    return state;
  }

  // On tente le modèle recommandé, puis les plus légers si la machine refuse ou s'il répond mal.
  const candidates = replis(hw, catalogue, start);
  /** Le prochain qui sera vraiment essayé après `apres`, pour le dire à l'écran. */
  const suivantDe = (apres: CatalogEntry): CatalogEntry | undefined =>
    candidates.slice(candidates.indexOf(apres) + 1).find((c) => c.downloadGb < plafondGo && !estDefaillant(c.key));

  /*
   * Après un refus faute de mémoire, seuls les modèles plus légers que celui
   * refusé : le classement suit la note, pas la taille, et sur un Mac de
   * 24 Go le « plus léger » après Qwen3.5 4B (3 Go) était gpt-oss 20B (12 Go),
   * téléchargé pour rien (revue du 27/09/2026).
   */
  let plafondGo = Infinity;
  /*
   * Le dernier échec autre que la mémoire (téléchargement, chargement refusé) :
   * le modèle suivant est essayé, comme le promet `replis`, et c'est cet échec
   * que l'écran montre si aucun ne passe. Avant, seul un manque de mémoire
   * faisait passer au suivant (revue du 27/09/2026).
   */
  let echec: { message: string; error: string } | null = null;
  /** Un téléchargement a cessé d'avancer : la connexion est arrêtée, les modèles à télécharger ne sont plus tentés. */
  let reseauArrete = false;
  let secoursEchoue=false;
  for (const choice of candidates) {
    if (choice.downloadGb >= plafondGo) continue;
    // Noté défaillant pendant cette mise en route, ou avant : pas réessayé d'office.
    if (choice !== start && estDefaillant(choice.key)) continue;
    setState({ model: choice.key, error: undefined });

    // Déjà en mémoire, jamais essayé : directement à l'essai.
    if (choice === start && dejaCharge) {
      if (await essaiReussi(lms, choice, suivantDe(choice), await nomChezLmStudio(lms, choice.key, "ps"))) return state;
      echec = {
        message: tf("{0} ne répond pas correctement sur cette machine.", choice.label),
        error: t("Aucun autre modèle adapté à cette machine ne reste à essayer. Choisissez-en un dans le sélecteur de modèles du Chat, ou branchez un modèle par une clé."),
      };
      continue;
    }

    if (!installed.output.includes(choice.key)) {
      /*
       * Un redémarrage de la passerelle laisse le téléchargement précédent
       * tourner tout seul : en relancer un second doublerait la charge réseau
       * pour le même fichier.
       */
      if (await dejaEnTelechargement(choice.key)) {
        setState({
          phase: "downloading",
          message: tf("Téléchargement de {0} déjà en cours, reprise du suivi...", choice.label),
          percent: undefined,
        });
        /*
         * Celui d'un lancement précédent, que personne ne suit plus : il est
         * arrêté, et un nouveau `lms get` repart avec sa progression à l'écran
         * (le suivre sans rien voir laissait l'écran sur « reprise du suivi »
         * pour toujours, 27/09/2026). Que LM Studio reprenne là où l'ancien
         * s'était arrêté n'a pas été vérifié ; au pire, il recommence.
         */
        await run("/usr/bin/pkill", ["-f", `lms get ${choice.key}`], () => {});
        await new Promise((r) => setTimeout(r, 2000));
        installed = await run(lms, ["ls"], () => {});
      }
    }

    if (!installed.output.includes(choice.key)) {
      // Connexion arrêtée sur un modèle précédent : seuls les modèles déjà là sont encore essayés.
      if (reseauArrete && (!MODELES_GGUF[choice.key] || secoursEchoue)) continue;
      setState({
        phase: "downloading",
        message: tf("Téléchargement de {0} (~{1} Go)...", choice.label, choice.downloadGb),
        percent: 0,
      });

      /*
       * Trois minutes sans progrès (ni pourcentage, ni octets sur le disque) :
       * `lms get` est arrêté et relancé, et LM Studio reprend où il en était.
       * Vu sur l'essai Windows du 24/10/2026 : son téléchargeur reste parfois
       * à 0 % puis abandonne de lui-même au bout de treize minutes
       * (« Timed-out. Please try to resume »), et la reprise suivante a fini
       * Qwen3 1.7B en deux secondes, ce qui était déjà reçu étant gardé. Deux
       * essais de suite sans rien gagner : la connexion est arrêtée, dit
       * comme tel, au lieu de laisser l'écran sur 0 % une demi-heure.
       *
       * Reprendre le même modèle plutôt que passer au suivant (16/10/2026) :
       * sur la machine Linux de l'essai GitHub, Qwen3 1.7B s'était arrêté à
       * 40 %, et Helix passait à Qwen3 8B (5 Go), puis Granite 4.1 8B, encore
       * plus longs à venir sur la même connexion.
       */
      const ESSAIS = MODELES_GGUF[choice.key] ? 2 : 5;
      let got: { ok: boolean; output: string; muet?: boolean } = { ok: false, output: "" };
      let meilleur = 0;
      let affiche = -1;
      let lu = 0;
      let sansProgres = 0;
      for (let essai = 0; !reseauArrete && essai < ESSAIS; essai++) {
        if (essai > 0) {
          setState({ message: tf("Téléchargement de {0} interrompu, reprise ({1} sur {2})...", choice.label, essai, ESSAIS - 1) });
          await new Promise((r) => setTimeout(r, Math.min(essai * 5_000, 15_000)));
        }
        const tailleAvant = tailleDesModeles();
        const meilleurAvant = meilleur;
        lu = 0;
        got = await run(lms, ["get", choice.key, "--yes"], (line) => {
          const percent = parsePercent(line);
          if (percent === undefined) return;
          lu = percent;
          meilleur = Math.max(meilleur, percent);
          // Une fois par point gagné : l'animation de `lms` redessine la même valeur dix fois par seconde.
          if (Math.floor(percent) === affiche) return;
          affiche = Math.floor(percent);
          setState({ percent, message: tf("Téléchargement de {0}... {1}%", choice.label, affiche) });
        }, { silenceMaxMs: SANS_PROGRES_MS, ...(MODELES_GGUF[choice.key] ? {totalMaxMs:5*60_000} : {}), progres: () => `${tailleDesModeles()}|${lu}` });
        // Réussi ou moteur absent (dit plus bas) : rien à reprendre.
        if (got.ok || /daemon is not running|no valid installation|failed to start or connect to local LM Studio/i.test(got.output)) break;
        sansProgres = meilleur > meilleurAvant || tailleDesModeles() > tailleAvant ? 0 : sansProgres + 1;
        if (sansProgres >= 2) break;
      }

      // Le catalogue distant de LM Studio peut expirer malgré un réseau disponible.
      // Le secours reste limité aux modèles Apache-2.0 déjà épinglés par empreinte.
      if(!got.ok&&MODELES_GGUF[choice.key]&&!secoursEchoue&&!/daemon is not running|no valid installation|failed to start or connect to local LM Studio/i.test(got.output)){
       try{
        const racine=dossierModelesLmStudio();if(!existsSync(racine))throw Error(t("L'emplacement des modèles est introuvable."));
        const fichier=join(racine,'.helix-telechargements',MODELES_GGUF[choice.key]!.fichier);
        for(let tentative=0;;tentative++){try{await telechargerGgufVerifie(choice.key,fichier,p=>setState({phase:'downloading',percent:p,message:tf("Téléchargement de {0}... {1}%",choice.label,p)}));break}catch(e){if(tentative>=2)throw e;await new Promise(r=>setTimeout(r,5000))}}
        await run(lms,['import',fichier,'--user-repo',`qwen/${choice.key.split('/').at(-1)}`,'--yes'],()=>{}, {totalMaxMs:DELAI_LMS_CHARGEMENT_MS});
        const liste=await run(lms,['ls','--json'],()=>{});
        const modeles=liste.ok?JSON.parse(liste.output):[];
        if(!Array.isArray(modeles)||!modeles.some(m=>typeof m?.modelKey==='string'&&memeModele(m.modelKey,choice.key)))throw Error(t("Le modèle téléchargé n'a pas pu être importé dans le moteur."));
        got={ok:true,output:liste.output};reseauArrete=false;
       }catch(e){secoursEchoue=true;console.error('[helix] téléchargement de secours :',e instanceof Error?e.message:String(e))}
      }
      if (!got.ok) {
        const message = tf("Le téléchargement de {0} a échoué.", choice.label);
        /*
         * Connexion arrêtée : un autre modèle à télécharger n'irait pas mieux.
         * Un modèle plus léger déjà sur la machine est encore essayé ; sinon,
         * l'échec est dit à la fin, avec ce message.
         */
        if (sansProgres >= 2) {
          console.error(`[helix] téléchargement de ${choice.key} arrêté, sans progrès : ${raisonTelechargement(got.output)}`);
          reseauArrete = true;
          echec = { message, error: t("Le téléchargement n'avance plus depuis plusieurs minutes : vérifiez la connexion, puis réessayez. Ce qui a déjà été reçu est gardé.") };
          plafondGo = Math.min(plafondGo, choice.downloadGb + 0.01);
          continue;
        }
        console.error(`[helix] téléchargement de ${choice.key} refusé : ${got.output.slice(-400)}`);
        /*
         * Le moteur lui-même ne démarre pas (vu sous Windows le 28/09/2026 :
         * « daemon is not running and no valid installation »). Un autre modèle
         * n'irait pas mieux : on s'arrête au premier, en disant quoi faire,
         * au lieu d'essayer tous les modèles jusqu'au plus léger.
         */
        if (/daemon is not running|no valid installation|failed to start or connect to local LM Studio/i.test(got.output)) {
          console.error(`[helix] moteur LM Studio injoignable : ${diagnosticInstallation()}`);
          setState({
            phase: "error",
            message: t("Le moteur des modèles ne démarre pas sur cette machine."),
            error: tf("Quittez {0} puis rouvrez-le : l'écran de mise en route proposera de réinstaller le moteur. Si cela se répète, installez LM Studio depuis lmstudio.ai, ouvrez-le une fois, puis revenez.", nomProduit()),
          });
          return state;
        }
        echec = { message, error: raisonTelechargement(got.output) };
        // Après un téléchargement raté, jamais un modèle plus lourd à télécharger : il échouerait plus sûrement encore.
        plafondGo = Math.min(plafondGo, choice.downloadGb + 0.01);
        continue;
      }
    }

    setState({
      phase: "loading",
      message: tf("Chargement de {0} en mémoire...", choice.label),
      percent: undefined,
    });

    /*
     * `--ttl` : un modèle inutilisé pendant 20 minutes se décharge tout seul.
     *
     * Sans cela les modèles s'empilent — conversation, vision, embarquements —
     * et une machine de 16 Go bascule en mémoire virtuelle : le modèle de
     * vision met alors plusieurs minutes à lire une capture au lieu d'une
     * vingtaine de secondes.
     */
    // Le nom sous lequel LM Studio a rangé le modèle (« qwen/qwen3-1.7b » pour « qwen3-1.7b », `nomChezLmStudio`).
    const cle = await nomChezLmStudio(lms, choice.key, "ls");
    const charger = () =>
      run(lms, ["load", cle, "--yes", "--ttl", delaiVeilleSecondes(), ...optionsDeChargement(cle)], () => {}, { totalMaxMs: DELAI_LMS_CHARGEMENT_MS });

    /*
     * Déjà en mémoire (le modèle de repli, chargé par une mise en route
     * précédente) : directement à l'essai. Vu sur l'essai Windows du
     * 24/10/2026 : après l'échec de Qwen3.5 2B, Qwen3 1.7B, déjà servi, était
     * chargé une seconde fois, et le sélecteur du Chat montrait
     * « qwen/qwen3-1.7b » et « qwen/qwen3-1.7b:2 ».
     */
    const servi = await chargeSous(lms, choice.key);
    if (servi) {
      if (await essaiReussi(lms, choice, suivantDe(choice), servi)) return state;
      echec = {
        message: tf("{0} ne répond pas correctement sur cette machine.", choice.label),
        error: t("Aucun autre modèle adapté à cette machine ne reste à essayer. Choisissez-en un dans le sélecteur de modèles du Chat, ou branchez un modèle par une clé."),
      };
      continue;
    }

    // Pas à côté d'un autre modèle si les deux ne tiennent pas : le Mac se figerait (voir backends.ts).
    await faireLaPlace(lms, cle);
    /*
     * Le dossier interne du moteur sans interface, juste avant de charger
     * (27/09/2026) : ce chemin appelait `lms load` sans passer par le
     * démarrage du moteur, qui seul le recréait, et le chargement échouait
     * (`ENOENT … .internal/temp`) quand la mise en route arrivait la première.
     */
    preparerDossiersLlmster();
    let loaded = await charger();
    // Échec sans manque de mémoire (moteur encore en train de démarrer) : une seconde tentative, et la vraie réponse au journal.
    if (!loaded.ok && !isResourceError(loaded.output)) {
      console.error(`[helix] chargement de ${choice.key} refusé : ${loaded.output.slice(-400)}`);
      await new Promise((r) => setTimeout(r, 3000));
      preparerDossiersLlmster();
      loaded = await charger();
    }

    /*
     * Mémoire refusée alors qu'un autre modèle occupe la place : sur une
     * machine de 16 Go, conversation et vision ne tiennent pas ensemble. On
     * libère les autres avant d'abandonner — sinon l'utilisateur qui revient
     * de Cowork vers le Chat se heurterait à un refus qu'il ne peut pas
     * comprendre ni résoudre.
     */
    if (!loaded.ok && isResourceError(loaded.output)) {
      const liberes = await unloadOthers(lms, cle);
      if (liberes > 0) {
        setState({
          phase: "loading",
          message: tf("Libération de la mémoire, puis chargement de {0}...", choice.label),
        });
        loaded = await charger();
      }
    }

    if (loaded.ok) {
      if (await essaiReussi(lms, choice, suivantDe(choice), await nomChezLmStudio(lms, cle, "ps"))) return state;
      // Mal répondu : noté, déchargé, et le suivant est essayé (ou l'échec dit, s'il n'y en a plus).
      echec = {
        message: tf("{0} ne répond pas correctement sur cette machine.", choice.label),
        error: t("Aucun autre modèle adapté à cette machine ne reste à essayer. Choisissez-en un dans le sélecteur de modèles du Chat, ou branchez un modèle par une clé."),
      };
      continue;
    }

    // Mémoire toujours insuffisante : on redescend d'un cran plutôt que d'échouer.
    if (isResourceError(loaded.output)) {
      // Dans tous les cas : après un refus faute de mémoire, jamais plus lourd (relu le 27/09/2026).
      plafondGo = Math.min(plafondGo, choice.downloadGb);
    }
    if (isResourceError(loaded.output) && candidates.some((c) => c.downloadGb < choice.downloadGb)) {
      setState({
        phase: "checking",
        message: tf("{0} est trop lourd pour cette machine, essai d'un modèle plus léger...", choice.label),
      });
      continue;
    }

    console.error(`[helix] chargement de ${choice.key} refusé : ${loaded.output.slice(-400)}`);
    echec = {
      message: isResourceError(loaded.output) ? t("Aucun modèle n'a pu être chargé sur cette machine.") : t("Le chargement du modèle a échoué."),
      error: loaded.output.slice(-400),
    };
  }

  setState({
    phase: "error",
    message: echec?.message ?? t("Aucun modèle n'a pu être chargé sur cette machine."),
    error: echec?.error,
  });
  return state;
}


/* ── Le moteur ouvert (llama.cpp), sur un Mac Intel ─────────────────────── */

/**
 * Les modèles du catalogue que le moteur ouvert sait poser (llamaCpp.ts), à
 * la taille de leur fichier GGUF : c'est elle que `tientSur` doit juger, pas
 * celle du paquet de LM Studio (Qwen3 1.7B : 1,8 Go en Q8_0 contre 1,2).
 * Copiés avec leurs accesseurs : la description se calcule à la lecture,
 * dans la langue de la personne (`decrire`).
 */
export function catalogueOuvert(catalogue: CatalogEntry[] = CATALOG): CatalogEntry[] {
  return catalogue
    .filter((e) => MODELES_GGUF[e.key])
    .map((e) => {
      const copie = Object.defineProperties({}, Object.getOwnPropertyDescriptors(e)) as CatalogEntry;
      copie.downloadGb = Math.round(MODELES_GGUF[e.key]!.octets / 1e8) / 10;
      return copie;
    });
}

/** Le modèle conseillé pour cette machine, avec le moteur qui y sert. */
export function conseilPourLaMachine(hw: Hardware): CatalogEntry {
  return moteurOuvert() ? best(hw, catalogueOuvert()) : recommend(hw);
}

/**
 * Même parcours que pour LM Studio, par llama.cpp : le mieux noté qui tient
 * sur la machine, téléchargé (vérifié par son empreinte), chargé, puis passé
 * à l'essai de santé ; s'il se charge mal ou répond mal, le suivant.
 */
async function provisionOuverte(requested: string | undefined, catalogue: CatalogEntry[]): Promise<ProvisionState> {
  if (catalogue === VISION_CATALOG) {
    setState({
      phase: "error",
      message: t("Aucun modèle pour piloter l'écran n'est proposé avec le moteur de ce Mac."),
      error: t("Branchez un modèle qui voit les images par une clé d'un fournisseur."),
    });
    return state;
  }
  if (!llamaCppInstalle()) {
    setState({
      phase: "error",
      message: t("Le moteur des modèles n'est pas encore installé sur ce Mac."),
      error: t("Installez-le depuis l'écran de mise en route."),
    });
    return state;
  }
  const liste = catalogueOuvert(catalogue);
  const hw = detectHardware();
  const start = (requested ? liste.find((c) => c.key === requested) : undefined) ?? best(hw, liste);
  const candidates = replis(hw, liste, start);
  const suivantDe = (apres: CatalogEntry): CatalogEntry | undefined =>
    candidates.slice(candidates.indexOf(apres) + 1).find((c) => !estDefaillant(c.key));
  const url = urlLlamaCpp();
  const cle = cleLlamaCpp();

  let echec: { message: string; error?: string } | null = null;
  for (const choice of candidates) {
    if (choice !== start && estDefaillant(choice.key)) continue;
    setState({ phase: "checking", message: t("Vérification des modèles disponibles..."), model: choice.key, percent: undefined, error: undefined });

    if (!modelesLlamaCpp().includes(choice.key)) {
      setState({ phase: "downloading", message: tf("Téléchargement de {0} (~{1} Go)...", choice.label, choice.downloadGb), percent: 0 });
      try {
        await installerModeleLlama(choice.key, (a) =>
          setState({ phase: "downloading", message: tf("Téléchargement de {0}... {1}%", choice.label, a.percent ?? 0), percent: a.percent }),
        );
      } catch (err) {
        // Réseau, disque plein, empreinte fausse : un autre modèle n'irait pas mieux, on le dit tout de suite.
        setState({
          phase: "error",
          message: tf("Le téléchargement de {0} a échoué.", choice.label),
          error: err instanceof Error ? err.message : String(err),
        });
        return state;
      }
    }

    setState({ phase: "loading", message: tf("Chargement de {0} en mémoire...", choice.label), percent: undefined });
    const charge = await chargerModeleLlama(choice.key);
    /*
     * Le moteur lui-même en panne (il ne démarre pas, port pris par un autre
     * programme, liste des modèles pas relue) : le modèle suivant n'irait pas
     * mieux. Avant le 28/09/2026, la mise en route passait quand même au
     * suivant, le téléchargeait (plusieurs Go) pour rien, et disait « trop
     * lourd pour cette machine ».
     */
    if (!charge.ok && charge.moteur) {
      console.error(`[helix] llama.cpp : ${charge.message}`);
      setState({ phase: "error", message: t("Le chargement du modèle a échoué."), error: charge.message });
      return state;
    }
    if (!charge.ok) {
      console.error(`[helix] llama.cpp : chargement de ${choice.key} refusé : ${charge.message}`);
      echec = { message: t("Le chargement du modèle a échoué."), error: charge.message };
      const suivant = suivantDe(choice);
      if (suivant) setState({ phase: "checking", message: tf("{0} est trop lourd pour cette machine, essai d'un modèle plus léger...", choice.label) });
      continue;
    }

    setState({ phase: "loading", message: tf("Vérification de {0} : une courte question d'essai...", choice.label), percent: undefined });
    const verdict: Verdict = await essayerModele(url, choice.key, cle);
    noterEssai(choice.key, verdict);
    if (verdict.ok) {
      setState({ phase: "ready", message: tf("{0} est prêt.", choice.label), percent: 100 });
      return state;
    }
    /*
     * Mal répondu : déchargé, comme sous LM Studio (`essaiReussi`). Le
     * routeur n'en garde qu'un à la fois, mais le dernier essayé restait sinon
     * vingt minutes en mémoire, jusqu'à 5 Go sur un Mac de 8 Go (28/09/2026).
     */
    await dechargerModeleLlama(choice.key);
    invalidate();
    echec = {
      message: tf("{0} ne répond pas correctement sur cette machine.", choice.label),
      error: t("Aucun autre modèle adapté à cette machine ne reste à essayer. Choisissez-en un dans le sélecteur de modèles du Chat, ou branchez un modèle par une clé."),
    };
    const suivant = suivantDe(choice);
    if (suivant) {
      setState({ phase: "checking", message: tf("{0} ne répond pas correctement sur cette machine, essai de {1}...", choice.label, suivant.label) });
    }
  }
  setState({
    phase: "error",
    message: echec?.message ?? t("Aucun modèle n'a pu être chargé sur cette machine."),
    error: echec?.error,
  });
  return state;
}
