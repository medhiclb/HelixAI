import { redirectionPour, refusSortie } from "./sortieReseau.ts";
import { execFile, execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { promisify } from "node:util";
import { homedir, totalmem } from "node:os";
import { join } from "node:path";
import { assurerServeurLlama, chargerModeleLlama, dechargerModeleLlama, infoGguf } from "./llamaCpp.ts";
import { cleLlamaCpp, moteurOuvert, urlLlamaCpp } from "./llamaCppBase.ts";
import { applicationLmStudio, lmsDeLlmster, moteurAPoser, moteurGereParHelix, moteurSansInterface, preparerDossiersLlmster } from "./engine.ts";
import { BACKENDS, classifyRoles, isReasoningModel, tousLesBackends } from "./config.ts";
import type { BackendConfig, BackendStatus, ModelInfo } from "./types.ts";
import { t, tf } from "./langue.ts";
import { capacitesDistantes, contexteConnuParNom, entetesAvecCle, listerModelesDistants, type ModeleDistant } from "./modelesCloud.ts";
import { fournisseurDuBackend } from "./prixPublies.ts";
// Cycle voulu (provision.ts importe ce module) : `detectHardware` n'est appelée qu'au chargement d'un modèle, jamais à l'import.
import { calculSurProcesseur, detectHardware, relaisApresDefaillance } from "./provision.ts";
import { aEssayer, essayerModele, noterEssai } from "./santeModeles.ts";
import { canalOuvert, ecouterLApplication, envoyerALApplication } from "./canalApplication.ts";
import { optionsOptimisees } from "./optimisationLocale.ts";
import { reveilPermis } from "./reglagesMoteur.ts";

const exec = promisify(execFile);

/*
 * Emplacements usuels du binaire `lms` (LM Studio l'ajoute rarement au PATH).
 * Sous Windows, `lms.exe` (un nom sans extension n'y est pas trouvé), et le
 * dossier que désigne `~/.lmstudio-home-pointer` s'il existe (engine.ts).
 */
const extensionLms = process.platform === "win32" ? ".exe" : "";
const LMS_CANDIDATES = () => [
  ...new Set([
    lmsDeLlmster(),
    join(homedir(), ".lmstudio", "bin", `lms${extensionLms}`),
    join(homedir(), ".cache", "lm-studio", "bin", `lms${extensionLms}`),
    ...(process.platform === "win32" && process.env.LOCALAPPDATA ? [join(process.env.LOCALAPPDATA, "lm-studio", "bin", "lms.exe")] : []),
    "lms",
  ]),
];

let lmsPathCache: string | null | undefined;

/**
 * Oublie l'emplacement mémorisé de `lms`.
 *
 * Indispensable après l'installation du moteur : au démarrage, `findLms` a
 * mémorisé « absent », et sans cet oubli l'étape suivante croirait encore que
 * LM Studio n'est pas là — juste après l'avoir installé.
 */
export function oublierLms(): void {
  lmsPathCache = undefined;
  dernierEssai = 0;
}

/**
 * Localise le binaire `lms`, ou `null` s'il est absent, ou si Helix ne doit
 * pas s'en servir maintenant : seule l'application LM Studio de la personne
 * est déclarée, son service ne tourne pas, et elle n'a pas choisi que Helix la
 * démarre (23/10/2026, signalement « il ouvre automatiquement Bionic ») :
 * n'importe quelle commande (`ls`, `ps`, `server status`, `get`, `load`)
 * lancerait alors l'application (engine.ts, reglagesMoteur.ts). La garde vaut
 * pour tous les appels de la passerelle, qui passent tous par ici ; `lms
 * version` lui-même n'est pas lancé tant qu'elle refuse.
 */
export async function findLms(): Promise<string | null> {
  if (!(await reveilPermis())) {
    if (!attenteDite) console.log("[helix] application LM Studio fermée, et pas de choix de moteur : aucune commande `lms` lancée (Réglages, Modèles locaux).");
    attenteDite = true;
    return null;
  }
  attenteDite = false;
  return lmsInstalle();
}

/** Dit une fois au journal, pas à chaque découverte. */
let attenteDite = false;

/** Le binaire `lms`, sans la garde de `findLms` (seulement pour savoir s'il est là). */
async function lmsInstalle(): Promise<string | null> {
  if (lmsPathCache !== undefined) return lmsPathCache;
  for (const candidate of LMS_CANDIDATES()) {
    try {
      /*
       * 30 s pour un fichier présent à sa place connue (essai sous Ubuntu du
       * 27/09/2026) : le `lms` du moteur sans interface pèse 109 Mo et mettait
       * plus de 5 s à répondre sur une machine lente, et Helix le déclarait
       * absent juste après l'avoir installé. Présent et exécutable, il compte
       * même si sa réponse tarde : les appels suivants diront s'il est cassé.
       */
      const connu = candidate !== "lms" && existsSync(candidate);
      await exec(candidate, ["version"], { timeout: connu ? 30_000 : 5000 }).catch((err) => {
        if (!(connu && (err as { killed?: boolean }).killed)) throw err;
      });
      lmsPathCache = candidate;
      return candidate;
    } catch {
      /* candidat suivant */
    }
  }
  lmsPathCache = null;
  return null;
}

interface LmsModelEntry {
  modelKey?: string;
  /** « idle » au repos ; autre chose pendant un calcul. */
  status?: string;
  path?: string;
  sizeBytes?: number;
  paramsString?: string;
  architecture?: string;
  type?: string;
  /** Déclaré par LM Studio : le modèle lit-il les images ? */
  vision?: boolean;
  /** Déclaré par LM Studio : le modèle a-t-il appris à appeler des outils ? */
  trainedForToolUse?: boolean;
  /** `lms ls` : plus grande taille de conversation acceptée ; `lms ps` : celle du chargement en cours. */
  maxContextLength?: number;
  contextLength?: number;
  /** `lms ps` : le nom sous lequel le serveur sert ce chargement (« qwen3-8b:2 » pour une seconde copie). */
  identifier?: string;
}

/**
 * Métadonnées enrichies des modèles LM Studio (taille, paramètres, archi, chargé).
 * Utilise `lms ls --json` et `lms ps --json`. Échec silencieux : la passerelle
 * fonctionne sans, avec moins d'informations. `enMemoireLu` dit si `lms ps` a
 * répondu : c'est lui, et non la liste du serveur, qui dit ce qui est chargé
 * (voir `discover`).
 */
async function lmStudioMetadata(): Promise<{ meta: Map<string, Partial<ModelInfo>>; enMemoireLu: boolean }> {
  const meta = new Map<string, Partial<ModelInfo>>();
  const lms = await findLms();
  if (!lms) return { meta, enMemoireLu: false };

  /** `null` : la commande n'a pas répondu, ce qui ne dit rien de la mémoire. */
  const parse = async (args: string[]): Promise<LmsModelEntry[] | null> => {
    try {
      const { stdout } = await exec(lms, args, { timeout: 8000, maxBuffer: 4 * 1024 * 1024 });
      const parsed = JSON.parse(stdout);
      return Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  };

  for (const entry of (await parse(["ls", "--json"])) ?? []) {
    const key = entry.modelKey ?? entry.path;
    if (!key) continue;
    meta.set(key, {
      sizeBytes: entry.sizeBytes,
      params: entry.paramsString,
      arch: entry.architecture,
      loaded: false,
      ...(entry.type ? { nature: entry.type } : {}),
      ...(typeof entry.vision === "boolean" ? { voit: entry.vision } : {}),
      ...(typeof entry.trainedForToolUse === "boolean" ? { outils: entry.trainedForToolUse } : {}),
      ...(typeof entry.maxContextLength === "number" ? { contexteMax: entry.maxContextLength } : {}),
      // Rangé par l'entraînement sous son propre éditeur (entrainement.ts).
      ...((entry.path ?? "").startsWith("helix-entrainement/") ? { entraine: true } : {}),
    });
  }

  const enMemoire = await parse(["ps", "--json"]);
  for (const entry of enMemoire ?? []) {
    const key = entry.modelKey ?? entry.path;
    if (!key) continue;
    const charge = {
      ...(meta.get(key) ?? {}),
      loaded: true,
      ...(typeof entry.contextLength === "number" ? { contexteCharge: entry.contextLength } : {}),
    };
    meta.set(key, charge);
    // Une seconde copie (« qwen3-8b:2 ») est servie sous son propre nom : elle est chargée elle aussi.
    if (entry.identifier && entry.identifier !== key) meta.set(entry.identifier, charge);
  }

  return { meta, enMemoireLu: enMemoire !== null };
}

async function fetchJson(
  url: string,
  apiKey?: string,
  timeoutMs = 4000,
  entetes: Record<string, string> = {},
  redirect: "error" | "follow" = "follow",
): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      redirect,
      signal: controller.signal,
      headers: { ...entetes, ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}) },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

/* ------------------------- démarrage de LM Studio -------------------------- */

/**
 * Le serveur local de LM Studio ne tourne pas toujours : il s'arrête quand
 * l'utilisateur quitte l'application, et ne revient pas seul après un
 * redémarrage. Sans lui, Helix n'a plus aucun modèle et l'utilisateur devrait
 * aller le relancer à la main — exactement ce qu'un logiciel installé ne doit
 * pas demander.
 *
 * On le démarre donc nous-mêmes, sans bruit.
 */
const LMSTUDIO_URL = BACKENDS.find((b) => b.id === "lmstudio")?.baseUrl ?? "";

/** Ne pas relancer en boucle quand la machine n'a tout simplement pas LM Studio. */
let dernierEssai = 0;
const DELAI_ENTRE_ESSAIS_MS = 30_000;

/** Le serveur de LM Studio répond-il ? (après un démarrage, pour le dire à l'écran). */
export const lmStudioRepond = (): Promise<boolean> => (LMSTUDIO_URL ? repond(LMSTUDIO_URL) : Promise.resolve(false));

async function repond(url: string): Promise<boolean> {
  try {
    const res = await fetch(`${url}/models`, { signal: AbortSignal.timeout(1500) });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * S'assure que le serveur LM Studio écoute. Renvoie `true` s'il répond à la
 * sortie, que ce soit parce qu'il tournait déjà ou parce qu'on l'a démarré.
 */
let numeroLancement = 0;

/**
 * `lms daemon up` et `lms server start`, lancés sous Windows par le processus
 * principal de l'application (electron/moteurWindows.cjs, 28/09/2026) : lancé
 * d'ici, dans le `utilityProcess` d'Electron, le service de LM Studio ne
 * démarrait pas chez plusieurs personnes (« Timed out waiting for LM Studio
 * daemon to start »), alors qu'il démarrait jusqu'à la 2026.928.5, quand la
 * passerelle était un processus ordinaire. Ailleurs, ou sans application
 * (serveur, essais), comme avant. Rejette comme `execFile` en cas d'échec.
 */
async function lancerLms(lms: string, commande: "daemon up" | "server start", delaiMs: number): Promise<void> {
  if (process.platform === "win32" && canalOuvert()) {
    const id = ++numeroLancement;
    const r = await new Promise<{ code?: unknown; fin?: unknown } | null>((resolve) => {
      const minuterie = setTimeout(() => {
        arreter();
        resolve(null);
      }, delaiMs + 15_000);
      const arreter = ecouterLApplication((m) => {
        const msg = m as { type?: unknown; id?: unknown; code?: unknown; fin?: unknown } | null;
        if (!msg || msg.type !== "lancer-lms" || msg.id !== id) return;
        clearTimeout(minuterie);
        arreter();
        resolve(msg);
      });
      if (!envoyerALApplication({ type: "lancer-lms", id, lms, commande })) {
        clearTimeout(minuterie);
        arreter();
        resolve(null);
      }
    });
    // Une application trop ancienne pour ce message (aucune réponse) : lancé d'ici, comme avant.
    if (r) {
      if (r.code === 0) return;
      throw Object.assign(new Error(`lms ${commande} : code ${String(r.code)}`), { stderr: typeof r.fin === "string" ? r.fin : "" });
    }
  }
  await exec(lms, commande.split(" "), { timeout: delaiMs });
}

/** Le service de LM Studio tourne-t-il ? (`lms daemon status`, sans rien démarrer.) */
async function serviceLmStudioEnMarche(lms: string): Promise<boolean> {
  try {
    const { stdout } = await exec(lms, ["daemon", "status", "--json"], { timeout: 15_000 });
    const etat = JSON.parse(String(stdout).trim() || "{}") as { running?: unknown; status?: unknown };
    return etat.running === true || etat.status === "running";
  } catch {
    return false;
  }
}

/*
 * Un seul démarrage à la fois (essai Windows du 28/09/2026, application
 * rouverte le lendemain) : `daemon up` peut prendre plus de trente secondes,
 * et la garde de `dernierEssai` ne tenait plus. La découverte du démarrage,
 * la sonde de l'application (`/health`) et l'écran lançaient chacun leur
 * `lms server start` (trois « démarrage... » en deux secondes au journal) ;
 * or un `server start` sur un serveur qui tourne le redémarre, et coupe ce
 * qu'il sert. Les appels suivants attendent le démarrage en cours.
 */
let demarrageServeur: Promise<boolean> | null = null;

export function ensureLmStudioServer(): Promise<boolean> {
  demarrageServeur ??= demarrerServeurLmStudio().finally(() => {
    demarrageServeur = null;
  });
  return demarrageServeur;
}

async function demarrerServeurLmStudio(): Promise<boolean> {
  if (!LMSTUDIO_URL) return false;
  // Avant tout, même serveur déjà en marche : sans ce dossier, llmster ne charge aucun modèle (engine.ts).
  preparerDossiersLlmster();
  if (await repond(LMSTUDIO_URL)) return true;
  /*
   * Mac à puce Apple sans moteur que `lms` sache démarrer (engine.ts) : rien à
   * allumer, le moteur est à installer. Sans ce garde, la simple lecture de
   * l'état ouvrait l'application LM Studio jamais servie, et réessayait une
   * minute, avant même que les conditions de LM Studio soient acceptées (revue
   * du 27/09/2026).
   */
  if (moteurAPoser()) return false;

  const maintenant = Date.now();
  if (maintenant - dernierEssai < DELAI_ENTRE_ESSAIS_MS) return false;
  dernierEssai = maintenant;

  const lms = await findLms();
  if (!lms) return false;

  /*
   * Ne rien démarrer si le serveur tourne déjà. `/models` peut ne pas
   * répondre en 1,5 s alors que le serveur est bien là : occupé à lire un long
   * contexte, ou servant une autre adresse que celle-ci. `lms server start`
   * sur un serveur en marche le **redémarre** : toutes les réponses en cours
   * sont coupées net (« Client disconnected. Stopping generation »). Vu le
   * 23/09/2026 : des Chats coupés en plein plan, avec « terminated ».
   */
  try {
    const { stdout } = await exec(lms, ["server", "status", "--json"], { timeout: 10_000 });
    const etat = JSON.parse(String(stdout).trim() || "{}") as { running?: boolean };
    if (etat.running) return false;
  } catch {
    /*
     * Statut illisible (ancienne version de `lms`, ou commande en échec quand
     * le serveur est arrêté) : on garde le comportement d'avant, démarrer.
     */
  }

  /*
   * Le moteur sans interface (llmster, engine.ts : Windows, Linux, Mac à puce
   * Apple) tourne comme un service, qu'on allume avant son serveur. Sans
   * effet s'il tourne déjà. Trois minutes : au premier démarrage, llmster
   * extrait ses outils et ses modules avant d'écouter (vu sur macOS le
   * 27/09/2026 : plus de 25 s). Là où l'application LM Studio a servi, c'est
   * elle, partagée, qui sert.
   */
  if (moteurSansInterface()) {
    const leve = await lancerLms(lms, "daemon up", 180_000).then(
      () => true,
      (err) => {
        console.error("[helix] `lms daemon up` en échec :", String((err as { stderr?: unknown }).stderr ?? (err as Error).message ?? err).slice(-300));
        return false;
      },
    );
    /*
     * Premier démarrage lent (28/09/2026) : `lms` abandonne au bout d'une
     * minute (« Timed out waiting for LM Studio daemon to start »), alors que
     * le service, sous Windows, peut mettre plus longtemps (l'antivirus lit
     * ses milliers de fichiers). On attend encore, jusqu'à trois minutes.
     */
    if (!leve) {
      for (let i = 0; i < 36 && !(await serviceLmStudioEnMarche(lms)); i++) await new Promise((r) => setTimeout(r, 5000));
    }
  }
  try {
    console.log("[helix] serveur LM Studio arrêté, démarrage...");
    /*
     * Le moteur sans interface juste posé ou juste levé peut refuser le
     * premier `server start` (essai Windows de bout en bout du 28/09/2026,
     * application empaquetée, scripts/essai-windows-ci.mjs : « Error:
     * WebSocket connection closed », code 1, une seconde après `daemon up`,
     * pendant que le service redémarrait). Helix abandonnait alors, et la
     * mise en route finissait sur « Le moteur est installé, mais il n'a pas
     * démarré » ; l'essai n'était passé que parce qu'il relisait l'état
     * toutes les trois secondes, ce qui relançait le serveur. Quatre essais,
     * cinq secondes d'écart, tant que le serveur ne répond pas.
     */
    const essais = moteurSansInterface() ? 4 : 1;
    for (let n = 1; ; n++) {
      try {
        await lancerLms(lms, "server start", 60_000);
        break;
      } catch (err) {
        // Refusé, mais le serveur écoute quand même (lancé entre-temps) : c'est ce qui compte.
        if (await repond(LMSTUDIO_URL)) break;
        if (n >= essais) throw err;
        const detail = `${(err as { stderr?: unknown }).stderr ?? ""}${(err as Error).message ?? ""}`;
        console.warn(`[helix] \`lms server start\` refusé (essai ${n}/${essais}), nouvel essai dans 5 s :`, detail.slice(-200));
        await new Promise((r) => setTimeout(r, 5000));
      }
    }
  } catch (err) {
    /*
     * macOS : l'application LM Studio posée mais jamais ouverte (vu sur un
     * MacBook le 27/09/2026 : « daemon is not running and no valid
     * installation could be found »). `lms` ne sait où elle est qu'après son
     * premier lancement : on l'ouvre une fois, en arrière-plan et sans lui
     * donner la main, puis on réessaie.
     */
    const application = applicationLmStudio();
    const detail = `${(err as { stdout?: unknown }).stdout ?? ""}${(err as { stderr?: unknown }).stderr ?? ""}${(err as Error).message ?? ""}`;
    console.error("[helix] `lms server start` en échec :", detail.slice(-300));
    if (!application || moteurSansInterface() || !/no valid installation|daemon is not running|failed to start or connect/i.test(detail)) return false;
    console.log("[helix] LM Studio jamais ouvert sur ce Mac : premier lancement en arrière-plan...");
    await exec("/usr/bin/open", ["-g", "-j", "-a", application], { timeout: 30_000 }).catch(() => undefined);
    let demarre = false;
    for (let i = 0; i < 12 && !demarre; i++) {
      await new Promise((r) => setTimeout(r, 5000));
      demarre = await exec(lms, ["server", "start"], { timeout: 60_000 }).then(() => true, () => false);
    }
    if (!demarre) return false;
  }

  // Le serveur met un instant à écouter : on lui laisse le temps.
  for (let i = 0; i < 10; i++) {
    if (await repond(LMSTUDIO_URL)) {
      console.log("[helix] serveur LM Studio démarré.");
      return true;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

/** Modèles que cette instance a chargés elle-même (loadModel). */
const chargesParHelix = new Set<string>();

/**
 * La taille de conversation qu'un service publie dans sa liste de modèles,
 * sous l'un des noms en usage : `context_length` (OpenRouter et d'autres),
 * `max_context_length` (Mistral, API de LM Studio), `max_model_len` (vLLM).
 */
function contexteDeLaListe(entree: Record<string, unknown>): number | undefined {
  for (const champ of ["context_length", "max_context_length", "max_model_len", "context_window"]) {
    const v = entree[champ];
    if (typeof v === "number" && Number.isFinite(v) && v >= 1024) return Math.floor(v);
  }
  return undefined;
}

/**
 * Taille de conversation d'un modèle, en jetons : ce qu'un document joint
 * peut occuper en dépend (documentsJoints.ts, 27/09/2026).
 *
 * Ce qui est su l'emporte sur ce qui est supposé :
 *  1. LM Studio, modèle en mémoire : la taille du chargement en cours, relue
 *     par `lms ps` au besoin (le modèle vient peut-être d'être chargé, ou l'a
 *     été par un autre programme avec une taille plus petite) ;
 *  2. ce que le profil de déploiement dit du service, puis ce que le service
 *     publie ;
 *  3. à défaut : pour LM Studio, la taille que Helix pose lui-même à chaque
 *     chargement (32 768 sur un poste de 36 Go ou moins), sinon 4 096, le
 *     défaut de LM Studio quand rien n'est précisé ;
 *     un autre serveur de la machine (Ollama, llama.cpp), 8 192 : Ollama
 *     coupe en silence au-delà de sa taille, qu'il ne publie pas ; un service
 *     distant, 32 768, ce que tiennent tous les modèles de conversation
 *     actuels. Un chiffre bas ne perd rien : le document est alors lu en
 *     parties au lieu d'être refusé ou coupé par le moteur.
 */
export async function contexteDuModele(model: ModelInfo, backend: BackendConfig): Promise<number> {
  const borne = (n: number) => (model.contexteMax ? Math.min(n, model.contexteMax) : n);
  if (model.backendKind === "lmstudio") {
    if (model.contexteCharge) return model.contexteCharge;
    const lms = await findLms();
    if (lms) {
      try {
        const { stdout } = await exec(lms, ["ps", "--json"], { timeout: 8000, maxBuffer: 4 * 1024 * 1024 });
        const lu = JSON.parse(stdout) as LmsModelEntry[];
        const entree = Array.isArray(lu) ? lu.find((e) => (e.modelKey ?? e.path) === model.id) : undefined;
        if (typeof entree?.contextLength === "number" && entree.contextLength >= 512) return entree.contextLength;
      } catch {
        /* LM Studio occupé : on se rabat sur ce qu'on sait */
      }
    }
    if (backend.contexte) return borne(backend.contexte);
    const options = optionsDeChargement();
    const i = options.indexOf("--context-length");
    const parHelix = i >= 0 ? Number(options[i + 1]) : NaN;
    // Helix charge toujours avec sa taille (loadModel, provision.ts) ; `chargesParHelix` ne survit pas à un redémarrage.
    if (Number.isFinite(parHelix)) return borne(parHelix);
    return borne(4096);
  }
  if (backend.contexte) return backend.contexte;
  if (model.contextePublie) return model.contextePublie;
  let local = false;
  try {
    local = ["localhost", "127.0.0.1", "[::1]", "::1"].includes(new URL(backend.baseUrl).hostname);
  } catch {
    local = false;
  }
  return local ? 8192 : 32_768;
}

/**
 * À la fermeture : rendre la mémoire, sans casser le travail des autres.
 *
 * On arrêtait le serveur LM Studio s'il avait été démarré par Helix. Mais il
 * est partagé : l'agent personnel de la personne (OpenClaw), une seconde
 * instance, LM Studio lui-même s'en servent. Mesuré le 24/09/2026 : une
 * instance qui s'arrêtait a coupé le serveur sous les autres, et leurs
 * réponses en cours ont été perdues. On ne décharge donc que les modèles
 * chargés par cette instance, et seulement s'ils sont au repos ; le serveur
 * reste allumé.
 */
/*
 * Synchrone : à l'arrêt du processus, une promesse n'aurait pas le temps
 * d'aboutir.
 */
export function stopLmStudioIfStarted(): void {
  if (!lmsPathCache || chargesParHelix.size === 0) return;
  let enMemoire: LmsModelEntry[] = [];
  try {
    enMemoire = JSON.parse(execFileSync(lmsPathCache, ["ps", "--json"], { timeout: 8000, encoding: "utf8" })) as LmsModelEntry[];
  } catch {
    return;
  }
  for (const e of enMemoire) {
    const cle = e.modelKey ?? e.path ?? "";
    if (!chargesParHelix.has(cle) || (e.status && e.status !== "idle")) continue;
    try {
      execFileSync(lmsPathCache, ["unload", cle], { timeout: 10_000, stdio: "ignore" });
      console.log(`[helix] ${cle} déchargé à la fermeture.`);
    } catch {
      /* déjà parti */
    }
  }
}

export interface Discovery {
  backends: BackendStatus[];
  models: ModelInfo[];
}

/*
 * Listes des fournisseurs cloud, gardées dix minutes (voir `discover`). La clé
 * du cache porte l'adresse et les modèles retenus : changer les modèles d'une
 * clé, ou en brancher une autre, relit la liste.
 */
const DUREE_LISTE_DISTANTE_MS = 10 * 60_000;
const listesDistantes = new Map<string, { at: number; modeles: ModeleDistant[] }>();
const cleListe = (b: BackendConfig) => `${b.id}|${b.baseUrl}|${(b.modeles ?? []).join(",")}`;

async function listeDistante(backend: BackendConfig): Promise<ModeleDistant[]> {
  const cle = cleListe(backend);
  const garde = listesDistantes.get(cle);
  if (garde && Date.now() - garde.at < DUREE_LISTE_DISTANTE_MS) return garde.modeles;
  const modeles = await listerModelesDistants(backend.baseUrl, entetesAvecCle(backend, true), {
    redirect: redirectionPour(backend),
    delaiMs: 8000,
  });
  listesDistantes.set(cle, { at: Date.now(), modeles });
  return modeles;
}

/**
 * Interroge tous les backends activés et agrège leurs modèles.
 *
 * `attendreLmStudio` (vrai par défaut) : un LM Studio muet est réveillé, et
 * la découverte attend qu'il réponde. Faux pour la sonde `/health` (essai
 * Windows du 28/09/2026) : l'application rouverte le lendemain, service de
 * LM Studio arrêté, la sonde attendait `daemon up` (70 s mesurées), et
 * l'application, qui attend une réponse à cette sonde avant d'ouvrir sa
 * fenêtre (main.cjs, `startGateway`, un peu plus d'une minute au plus),
 * restait sans fenêtre tout ce temps. Le réveil est alors lancé sans être
 * attendu, et LM Studio compte comme éteint pour cette réponse ; `lms` n'est
 * pas appelé tant que le serveur ne répond pas : `lms ls` lèverait le service
 * lui-même, depuis la passerelle, en même temps que l'application.
 */
export async function discover(options: { attendreLmStudio?: boolean } = {}): Promise<Discovery> {
  const enabled = tousLesBackends()
    .filter((b) => b.enabled)
    .sort((a, b) => a.priority - b.priority);

  // Un backend LM Studio activé mais muet : on tente de le réveiller avant de
  // conclure qu'il n'y a aucun modèle.
  let lmStudioEnReveil = false;
  if (enabled.some((b) => b.id === "lmstudio")) {
    if (options.attendreLmStudio !== false) await ensureLmStudioServer();
    else if (!(await lmStudioRepond())) {
      lmStudioEnReveil = true;
      void ensureLmStudioServer().catch(() => false);
    }
  }
  // Le moteur ouvert (Mac Intel, llamaCpp.ts) : démarré s'il a de quoi servir.
  /*
   * Faux s'il n'est pas reconnu à l'écoute (un autre programme sur son port,
   * test d'intrusion du 28/09/2026, SECURITE.md § 58) : il n'est alors pas
   * interrogé ci-dessous, la clé et les Chats ne partent pas chez cet autre.
   */
  const llamaSur = enabled.some((b) => b.kind === "llamacpp") ? await assurerServeurLlama() : false;

  /*
   * `lms` seulement si une source LM Studio est activée : ses réponses ne
   * servent qu'à elles (`toModelInfo`). Avant le 27/09/2026, une instance qui
   * avait coupé LM Studio lançait quand même `lms ls` et `lms ps` à chaque
   * découverte, et interrogeait le LM Studio de la machine (vu dans la batterie
   * de sécurité, qui tournait à côté d'un LM Studio en service).
   */
  const { meta: lmMeta, enMemoireLu } = enabled.some((b) => b.kind === "lmstudio") && !lmStudioEnReveil
    ? await lmStudioMetadata()
    : { meta: new Map<string, Partial<ModelInfo>>(), enMemoireLu: false };

  const results = await Promise.all(
    enabled.map(async (backend): Promise<{ status: BackendStatus; models: ModelInfo[] }> => {
      const started = Date.now();
      try {
        // Un fournisseur cloud répond moins vite qu'un serveur local, et rend des centaines de modèles.
        const distant = backend.origine === "agence" || backend.origine === "cle";
        const refus = await refusSortie(backend);
        if (refus) throw new Error(refus);
        if (backend.kind === "llamacpp" && !llamaSur) throw new Error(t("Le moteur llama.cpp ne répond pas."));
        const retenus = backend.modeles ? new Set(backend.modeles) : null;
        /*
         * Un fournisseur cloud : sa liste lue dans son dialecte, pages
         * comprises, avec ce qu'elle déclare des modèles (modelesCloud.ts), et
         * gardée dix minutes. Relue à chaque message (le routeur ne la garde
         * que cinq secondes), elle coûtait un aller-retour chez le fournisseur
         * avant chaque réponse, et pesait sur la limite de débit de la clé.
         */
        const distants = distant ? (await listeDistante(backend)).filter((m) => !retenus || retenus.has(m.id)) : [];
        const entries: ({ id: string } & Record<string, unknown>)[] = distant
          ? distants.map((m) => ({ id: m.id }))
          : (
              ((await fetchJson(`${backend.baseUrl}/models`, backend.apiKey, 4000, backend.entetes, redirectionPour(backend))) as {
                data?: ({ id: string } & Record<string, unknown>)[];
              }).data ?? []
            )
              .map((m) => ({ ...m, id: m.id.replace(/^models\//, "") }))
              .filter((m) => !retenus || retenus.has(m.id));
        /*
         * Ce que l'API de LM Studio liste passait pour **chargé**, sans
         * s'en remettre à `lms ps`.
         *
         * Pourquoi : `lms ps` a un délai de huit secondes, et un LM Studio
         * occupé à répondre le dépasse. La commande échouait alors en silence,
         * tous les modèles passaient pour « non chargés », et la passerelle
         * rechargeait celui qui tournait déjà — LM Studio en ouvrait une
         * seconde copie (« qwen3-8b:2 », 5 Go de plus) et la machine saturait.
         * Observé chez le client le 23/09/2026. Cela reste vrai quand `lms ps`
         * ne répond pas.
         *
         * Mais quand il répond, c'est lui qui dit ce qui est en mémoire
         * (27/09/2026, « le modèle répond des fois un truc qui n'a rien à
         * voir », PC Windows de Medhi). Le chargement à la demande de LM
         * Studio (JIT) est actif par défaut, et sa documentation prévient que
         * `/v1/models` peut alors lister **tous** les modèles téléchargés
         * (lmstudio.ai/docs/developer/openai-compat/models). Pris pour
         * chargés, ils n'étaient jamais chargés par Helix : LM Studio les
         * chargeait seul à la première question, avec ses propres réglages
         * (sa taille de conversation par défaut, quatre réponses en parallèle,
         * la puce graphique à sa guise, et une heure avant de libérer la
         * mémoire), au lieu de ceux de `optionsDeChargement` et de l'essai de
         * santeModeles.ts ; et `contexteDuModele` supposait 32 768 jetons que
         * le moteur n'avait pas. Mesuré le 27/09/2026 contre un faux LM Studio
         * qui liste ainsi : huit questions, aucun `lms load`. Un nom servi qui
         * n'est pas un modèle téléchargé (une seconde copie « …:2 ») reste
         * chargé : seul le serveur le connaît.
         */
        const charge = (id: string) => !enMemoireLu || lmMeta.get(id)?.loaded === true || !lmMeta.has(id);
        const models = entries.map((m, i) => {
          // Un fournisseur cloud : ce que sa liste déclare, lu dans son dialecte (modelesCloud.ts).
          const capacites = distant ? capacitesDistantes(distants[i]!) : null;
          // Fournisseur qui ne publie pas la taille (OpenAI, Anthropic, Google…) : celle de la famille (modelesCloud.ts, 16/10/2026).
          const publie = capacites ? (capacites.contexteMax ?? contexteConnuParNom(m.id)) : contexteDeLaListe(m);
          return {
            ...toModelInfo(m.id, backend, lmMeta),
            ...(backend.kind === "lmstudio" ? { loaded: charge(m.id) } : {}),
            // Le routeur de llama.cpp dit lui-même ce qui est en mémoire (`status.value`).
            ...(backend.kind === "llamacpp" ? { loaded: (m.status as { value?: unknown } | undefined)?.value === "loaded" } : {}),
            ...(capacites ?? {}),
            ...(publie && publie >= 1024 ? { contextePublie: Math.floor(publie) } : {}),
          };
        });

        /*
         * LM Studio ne liste par son API que les modèles **chargés** en
         * mémoire. Ceux qui dorment sur le disque restaient donc invisibles —
         * et le Chat ne pouvait pas s'en servir, même quand ils étaient les
         * seuls capables de faire ce qu'on lui demandait.
         *
         * Cas réel qui l'a montré : une capture d'écran envoyée en mode Auto.
         * Trois modèles de vision étaient téléchargés sur la machine ; aucun
         * n'était chargé ; l'image est partie vers le seul modèle chargé, qui
         * ne voit pas les images, et il a répondu « je n'ai pas
         * l'information ». On ajoute donc les modèles relevés par `lms ls`,
         * marqués non chargés : la passerelle les charge au moment de s'en
         * servir (chat.ts), et le sélecteur les montre.
         */
        if (backend.kind === "lmstudio") {
          const deja = new Set(models.map((m) => m.id));
          for (const [cle, info] of lmMeta) {
            if (deja.has(cle)) continue;
            if (info.nature === "embedding" || /embed/i.test(cle)) continue;
            models.push(toModelInfo(cle, backend, lmMeta));
          }
        }
        return {
          status: {
            id: backend.id,
            label: backend.label,
            kind: backend.kind,
            baseUrl: backend.baseUrl,
            online: true,
            latencyMs: Date.now() - started,
            modelCount: models.length,
          },
          models,
        };
      } catch (err) {
        /*
         * Une clé dont la liste ne répond plus (clé révoquée, fournisseur en
         * panne, réseau coupé) : ses modèles restent proposés, tels que la
         * personne les a retenus. Avant le 27/09/2026 ils disparaissaient, et
         * le Chat ouvert sur l'un d'eux répondait « modèle inconnu ou réservé à
         * la personne qui a branché sa clé » : faux, et sans piste. Le message
         * part maintenant chez le fournisseur, et c'est son refus (« clé
         * refusée », « quota épuisé ») que la personne lit (chat.ts).
         */
        const gardes =
          backend.origine === "cle" && backend.modeles?.length
            ? backend.modeles.map((id) => ({
                ...toModelInfo(id, backend, lmMeta),
                ...capacitesDistantes(listesDistantes.get(cleListe(backend))?.modeles.find((m) => m.id === id) ?? { id }),
              }))
            : [];
        return {
          status: {
            id: backend.id,
            label: backend.label,
            kind: backend.kind,
            baseUrl: backend.baseUrl,
            online: false,
            error: err instanceof Error ? err.message : String(err),
            modelCount: gardes.length,
          },
          models: gardes,
        };
      }
    }),
  );

  return {
    backends: results.map((r) => r.status),
    models: results.flatMap((r) => r.models),
  };
}

function toModelInfo(
  id: string,
  backend: BackendConfig,
  lmMeta: Map<string, Partial<ModelInfo>>,
): ModelInfo {
  const extra: Partial<ModelInfo> =
    backend.kind === "lmstudio" ? lmMeta.get(id) ?? {} : backend.kind === "llamacpp" ? (infoGguf(id) ?? {}) : {};
  /*
   * Ce que LM Studio déclare l'emporte sur ce que le nom laisse deviner.
   *
   * Les rôles viennent d'abord de motifs sur l'identifiant (« -vl- » veut
   * dire vision). C'est une supposition ; LM Studio, lui, **sait** — il lit
   * les fichiers du modèle. Quand il se prononce, on le suit, dans les deux
   * sens : un « gemma-3 » sans projecteur d'images n'est pas un modèle de
   * vision, quoi qu'en dise son nom.
   */
  let roles = classifyRoles(id);
  if (extra.voit === true && !roles.includes("vision")) roles = [...roles, "vision"];
  if (extra.voit === false) roles = roles.filter((r) => r !== "vision" && r !== "gui");
  /*
   * Le code aussi : un modèle de conversation que LM Studio déclare entraîné à
   * appeler des outils (`trainedForToolUse`) sait travailler en agent de code,
   * quel que soit son nom. Vu le 26/09/2026 : le rôle ne venait que du nom
   * (« coder », « qwen3 », « glm »…), et un poste qui n'avait que Mistral,
   * gpt-oss ou Granite, pourtant installés par Helix, n'avait « aucun modèle
   * disponible » dans Code.
   */
  // Sauf un modèle fait pour l'écran (Qwen3-VL, UI-TARS…) : LM Studio le déclare lui aussi « outils », et il code mal.
  if (extra.outils === true && roles.includes("chat") && !roles.includes("code") && !/-vl-|\bvl\b|ui-?tars|open-?cua|embed|nomic|rerank/i.test(id)) {
    roles = [...roles, "code"];
  }
  return {
    id,
    uid: `${backend.id}/${id}`,
    backendId: backend.id,
    backendLabel: backend.label,
    backendKind: backend.kind,
    roles,
    reasoning: isReasoningModel(id),
    origine: backend.origine ?? "local",
    ...(backend.proprietaire ? { proprietaire: backend.proprietaire } : {}),
    ...(backend.pays ? { pays: backend.pays } : {}),
    ...(backend.fournisseur ? { fournisseur: backend.fournisseur } : {}),
    // Le fournisseur au sens des prix et des renvois de noms (prixPublies.ts, 27/09/2026) : un modèle cloud seulement.
    ...(backend.origine === "cle" || backend.origine === "agence"
      ? (() => {
          const f = fournisseurDuBackend(backend);
          return f ? { catalogue: f.id } : {};
        })()
      : {}),
    ...extra,
  };
}

export function backendById(id: string): BackendConfig | undefined {
  return tousLesBackends().find((b) => b.id === id);
}

/** Durée d'inactivité au bout de laquelle un modèle libère la mémoire. */
const TTL_SECONDES = "1200";

/**
 * Taille de conversation et parallélisme au chargement, selon la mémoire.
 *
 * Sans rien préciser, LM Studio prenait de grands défauts : Qwen3 8B chargé
 * avec 28 160 jetons de contexte occupait 12 Go pour 5 Go de poids, et le
 * modèle de vision avait 4 réponses en parallèle, chacune avec sa mémoire.
 * Mesuré le 24/09/2026 sur un Mac de 16 Go : la machine saturait dès que
 * Cowork et un Chat tournaient ensemble. 16 384 jetons suffisent à une
 * conversation avec outils et à une tâche d'écran (une capture en coûte
 * environ 1 000) ; au-delà de 32 Go, on laisse les défauts.
 */
/*
 * Jamais moins de 32 768 jetons : mesuré le 24/09/2026, les consignes de
 * l'agent de code (OpenCode, outils compris) en font à elles seules environ
 * 18 000. Avec 16 384, réglé le matin même pour gagner de la mémoire, Code ne
 * pouvait plus rien faire sur un Mac de 16 Go. La mémoire se gagne par la
 * requête unique, pas par un contexte trop court.
 */
/*
 * Au processeur seul (Windows ou Linux sans carte NVIDIA, 27/09/2026) : une
 * seule réponse à la fois, quelle que soit la mémoire. Deux réponses en
 * parallèle s'y partagent les mêmes cœurs, chacune deux fois plus lente, et
 * chaque emplacement garde sa part de mémoire ; sur un PC de 32 Go sans carte
 * graphique, `--parallel 2` n'apportait que cela. Sans `--parallel`, LM Studio
 * en ouvre quatre (« Max Concurrent Predictions », 4 par défaut,
 * lmstudio.ai/docs/app/advanced/parallel-requests). Les requêtes suivantes
 * attendent leur tour dans le moteur, sans rien mêler.
 */
export function optionsDeChargement(): string[] {
  return optionsOptimisees(optionsStandard());
}

function optionsStandard(): string[] {
  const go = totalmem() / 1024 ** 3;
  const gpu = optionGpu();
  const processeur = calculSurProcesseur(detectHardware());
  if (go <= 18) return ["--context-length", "32768", "--parallel", "1", ...gpu];
  if (go <= 36) return ["--context-length", "32768", "--parallel", processeur ? "1" : "2", ...gpu];
  return processeur ? ["--parallel", "1", ...gpu] : gpu;
}

/*
 * Où le modèle calcule, dit à LM Studio au lieu de le lui laisser deviner.
 *
 * Vu par Medhi le 27/09/2026 sur un PC Windows sans carte graphique (16 Go,
 * llmster 0.0.25, Qwen3.5 4B) : une réflexion « 不 時////… » sans fin, là où
 * le même Helix répond juste sur un Mac. Sans `--gpu`, LM Studio choisit seul
 * combien de couches confier à la carte graphique ; sur un PC sans carte
 * dédiée, la seule qu'il puisse voir est la puce graphique intégrée (Intel,
 * AMD), par Vulkan. Or les défauts publiés de llama.cpp qui rendent une
 * sortie illisible avec Qwen3.5 (architecture hybride, « Gated DeltaNet »)
 * sont presque tous du côté Vulkan, iGPU Intel compris, et « correct sur le
 * processeur » (llama.cpp #21888, #28648, #20610, #27237, relevés le
 * 27/09/2026). LM Studio dit laisser l'iGPU de côté depuis sa 0.4.17
 * (« disabled by default ») ; ce qui se passe quand c'est la seule puce du
 * poste n'est écrit nulle part, et n'a pas été vu sur ce PC.
 *
 * Helix traite déjà une telle machine comme calculant au processeur : c'est
 * pour lui qu'il a choisi le modèle (`tientSur`, provision.ts). On le charge
 * donc là aussi, `--gpu off`, sans rien laisser au hasard. Une carte NVIDIA
 * (vue par `nvidia-smi`) garde le choix de LM Studio, par CUDA ; un Mac aussi.
 *
 * Contrepartie assumée : une carte AMD ou Intel dédiée, que Helix ne sait pas
 * encore reconnaître, calcule elle aussi au processeur (plus lent, mais juste).
 * `HELIX_DECHARGEMENT_GPU` rend la main : « auto » laisse LM Studio décider,
 * « max », « off » ou une part entre 0 et 1 sont passés tels quels à `lms load`.
 */
function optionGpu(): string[] {
  const reglage = (process.env.HELIX_DECHARGEMENT_GPU ?? "").trim().toLowerCase();
  if (reglage === "auto") return [];
  if (reglage === "off" || reglage === "max" || (/^(0(\.\d+)?|1(\.0+)?)$/.test(reglage))) return ["--gpu", reglage];
  return calculSurProcesseur(detectHardware()) ? ["--gpu", "off"] : [];
}

/**
 * Échantillonnage explicite pour la famille Qwen3.5 (3.5, 3.6, 3.8) servie
 * par llama.cpp, quand l'appelant n'a rien demandé (27/09/2026).
 *
 * Sans rien préciser, LM Studio applique le préréglage du modèle, celui que
 * Qwen conseille pour réfléchir : température 1,0, top_p 0,95, top_k 20 et
 * une pénalité de présence de 1,5 (fiche lmstudio.ai/models/qwen/qwen3.5-4b).
 * Sur un Mac, le moteur MLX de LM Studio n'a pas de pénalité de présence
 * (mlx-engine relu le 27/09/2026 : absente de sa génération, refusée par son
 * serveur) : la réponse juste vue sur le MacBook a donc, selon toute
 * vraisemblance, été produite **sans** elle. Sous Windows et Linux, llama.cpp l'applique, et
 * la fiche de Qwen prévient qu'une valeur haute « peut mêler les langues »,
 * ce qui ressemble au « 不 » qui ouvrait la réflexion cassée.
 *
 * On aligne donc le PC sur ce qui marche, dans les réglages que Qwen publie :
 * pour réfléchir, son profil « précis » (0,6, 0,95, 20, présence 0) ; sans
 * réflexion, son profil général (0,7, 0,8, 20), présence 0 aussi ; et aucune
 * pénalité de répétition (1,0, comme Qwen le demande). Les boucles que la
 * pénalité aurait freinées, le garde-fou les coupe (gardeBoucle.ts).
 *
 * Rien pour un Mac à puce Apple (le moteur est MLX, qui répond juste avec son
 * préréglage), ni pour les autres modèles, dont les réglages ont été essayés
 * tels quels. Pas essayé sur le PC de Medhi : c'est une hypothèse raisonnée,
 * pas une mesure.
 */
export function echantillonnageLocal(modele: string, raisonner: boolean): Record<string, number> {
  /*
   * Ministral 3 (3B, 8B, 14B, version « instruct ») : Mistral conseille une
   * température de 0,1 (« We recommend starting with a Temperature of 0.1 for
   * most use cases », carte de mistralai/Ministral-3-3B-Instruct-2512, relue
   * le 27/09/2026 ; « below 0.1 » en production). Helix n'envoyait rien : le
   * moteur appliquait sa propre température, plus haute, et un 3B tiré au
   * hasard s'écarte plus volontiers de la question (« des fois un truc qui
   * n'a rien à voir », Medhi, PC Windows, Ministral 3B). Le conseil vaut
   * pour tout moteur, Mac compris. La version « reasoning » garde le sien.
   */
  if (/ministral-?3(?![\d.])/i.test(modele) && !/reason/i.test(modele)) return { temperature: 0.1 };
  if (process.platform === "darwin" && process.arch === "arm64") return {};
  if (!/qwen3\.(?:[5-9]|\d{2,})/i.test(modele)) return {};
  return raisonner
    ? { temperature: 0.6, top_p: 0.95, top_k: 20, presence_penalty: 0, repeat_penalty: 1 }
    : { temperature: 0.7, top_p: 0.8, top_k: 20, presence_penalty: 0, repeat_penalty: 1 };
}

/** Le refus vient-il d'un manque de mémoire plutôt que d'une panne ? */
const manqueDeMemoire = (texte: string) =>
  /insufficient system resources|not enough memory|overload/i.test(texte);

/**
 * Décharge les modèles résidents autres que celui demandé.
 *
 * Les modèles d'embarquement sont épargnés : quelques dizaines de mégaoctets,
 * et ils servent à la recherche documentaire.
 */
async function unloadOthers(lms: string, garder: string): Promise<number> {
  let charges: LmsModelEntry[] = [];
  try {
    const { stdout } = await exec(lms, ["ps", "--json"], { timeout: 8000 });
    const parsed = JSON.parse(stdout);
    if (Array.isArray(parsed)) charges = parsed;
  } catch {
    return 0;
  }

  /*
   * Un modèle en train de répondre n'est pas déchargé sous les pieds de qui
   * s'en sert : LM Studio est partagé (autre instance, agent personnel de la
   * personne). Mesuré le 24/09/2026 : des déchargements pendant les réponses
   * d'un autre programme. On attend qu'il ait fini, 45 s au plus ; au-delà,
   * on le laisse, et le chargement se fera à côté.
   */
  const occupe = (e: LmsModelEntry) => Boolean(e.status && e.status !== "idle");
  for (let i = 0; i < 15 && charges.some((e) => (e.modelKey ?? e.path) !== garder && occupe(e)); i++) {
    await new Promise((r) => setTimeout(r, 3000));
    try {
      const { stdout } = await exec(lms, ["ps", "--json"], { timeout: 8000 });
      const relu = JSON.parse(stdout);
      if (Array.isArray(relu)) charges = relu;
    } catch {
      break;
    }
  }

  let liberes = 0;
  for (const entree of charges) {
    const cle = entree.modelKey ?? entree.path;
    if (!cle || cle === garder) continue;
    if (/embed/i.test(cle) || entree.type === "embedding") continue;
    if (occupe(entree)) {
      console.log(`[helix] ${cle} est en train de répondre : il n'est pas déchargé.`);
      continue;
    }
    try {
      await exec(lms, ["unload", cle], { timeout: 30_000 });
      liberes += 1;
      console.log(`[helix] ${cle} déchargé pour libérer la mémoire.`);
    } catch {
      /* déjà parti, ou refus : on continue */
    }
  }
  return liberes;
}

/**
 * Libère la mémoire avant de charger `modelKey`, si les deux ne tiennent pas
 * ensemble. Sert au chargement à la demande et à l'installation.
 */
export async function faireLaPlace(lms: string, modelKey: string, enMemoire?: LmsModelEntry[]): Promise<void> {
  let charges = enMemoire;
  if (!charges) {
    try {
      const { stdout } = await exec(lms, ["ps", "--json"], { timeout: 15_000 });
      const lu = JSON.parse(stdout);
      charges = Array.isArray(lu) ? lu : [];
    } catch {
      charges = [];
    }
  }
  /*
   * Place d'abord, chargement ensuite.
   *
   * Avant, le nouveau modèle était chargé À CÔTÉ de celui déjà en mémoire, et
   * on ne libérait la place que si LM Studio refusait. Or LM Studio refuse
   * rarement : il accepte, puis la machine bascule sur le disque (swap) et
   * tout l'ordinateur se fige, pas seulement Helix. Constaté sur un Mac de
   * 16 Go : Qwen3 8B résident + Qwen3-VL 8B chargé pour lire une image.
   *
   * On estime donc l'empreinte (poids + environ 30 % pour le contexte) et on
   * vide la mémoire avant de charger si l'ensemble dépasse 45 % de la RAM : le
   * système, le navigateur et les autres applications gardent le reste.
   */
  const empreinte = (octets: number) => octets * 1.3;
  let tailleNouveau = 0;
  try {
    const { stdout } = await exec(lms, ["ls", "--json"], { timeout: 8000, maxBuffer: 4 * 1024 * 1024 });
    const liste = JSON.parse(stdout) as LmsModelEntry[];
    // Le catalogue dit « qwen3-vl-4b », LM Studio range « qwen/qwen3-vl-4b » : le suffixe suffit.
    const meme = (cle?: string) => Boolean(cle) && (cle === modelKey || cle!.endsWith(`/${modelKey}`));
    tailleNouveau = liste.find((e) => meme(e.modelKey) || meme(e.path))?.sizeBytes ?? 0;
  } catch {
    /* inconnue : on raisonne comme si le modèle était gros */
  }
  const resident = charges
    .filter((e) => e.type !== "embedding" && !/embed/i.test(e.modelKey ?? e.path ?? ""))
    .reduce((somme, e) => somme + empreinte(e.sizeBytes ?? 0), 0);
  const budget = totalmem() * 0.45;
  const nouveau = tailleNouveau > 0 ? empreinte(tailleNouveau) : budget;
  if (resident > 0 && resident + nouveau > budget) {
    await unloadOthers(lms, modelKey);
  }
}

/**
 * Fait de la place avant une création d'image (images.ts) : le modèle
 * d'images ne passe pas par LM Studio, qui ne sait donc pas qu'il arrive.
 * Même règle que `faireLaPlace` : si les modèles de conversation résidents
 * plus l'image dépassent 80 % de la mémoire, on décharge ceux qui sont au
 * repos, jamais un modèle en train de répondre. LM Studio les rechargera à la
 * prochaine question.
 */
export async function libererPourImage(octets: number): Promise<number> {
  const lms = await findLms();
  if (!lms) return 0;
  let charges: LmsModelEntry[] = [];
  try {
    const { stdout } = await exec(lms, ["ps", "--json"], { timeout: 15_000 });
    const lu = JSON.parse(stdout);
    charges = Array.isArray(lu) ? lu : [];
  } catch {
    return 0;
  }
  const resident = charges
    .filter((e) => e.type !== "embedding" && !/embed/i.test(e.modelKey ?? e.path ?? ""))
    .reduce((somme, e) => somme + (e.sizeBytes ?? 0) * 1.3, 0);
  if (resident === 0 || resident + octets <= totalmem() * 0.8) return 0;
  return unloadOthers(lms, "");
}

/**
 * Charge un modèle en mémoire via `lms load` (provisionnement transparent).
 *
 * Premier chargement d'un modèle sur cette machine : la même courte question
 * d'essai que la mise en route (santeModeles.ts, 27/09/2026), avant de lui
 * confier la vraie demande. C'est là qu'un poste installé avant l'essai passe
 * le sien, à la première réponse. Un modèle qui répond mal est déchargé, noté,
 * et la demande échoue en le disant ; en « Auto » (`auto`), la suivante va à
 * un autre modèle.
 */
export async function loadModel(modelKey: string, options: { auto?: boolean } = {}): Promise<{ ok: boolean; message: string }> {
  if (moteurOuvert()) return chargerSurMoteurOuvert(modelKey, options);
  const essaye = aEssayer(modelKey) && !/embed|nomic|rerank|bge-|e5-/i.test(modelKey);
  const r = await chargerModele(modelKey);
  if (!r.ok || !r.neuf || !essaye) return r;
  const verdict = await essayerModele(LMSTUDIO_URL, modelKey);
  noterEssai(modelKey, verdict);
  if (verdict.ok) return r;
  const lms = await findLms();
  if (lms) await exec(lms, ["unload", modelKey], { timeout: 30_000 }).catch(() => {});
  chargesParHelix.delete(modelKey);
  const relais = await relaisApresDefaillance(modelKey, options.auto === true);
  return {
    ok: false,
    message: `${tf("{0} ne répond pas correctement sur cette machine (réponse d'essai illisible) : il a été déchargé.", modelKey)} ${relais} ${t("Renvoyez votre message.")}`,
  };
}

/**
 * Mac Intel (llamaCpp.ts, 28/09/2026) : le routeur de llama.cpp charge le
 * modèle, et le premier chargement sur cette machine passe l'essai de santé,
 * comme sous LM Studio. Raté : déchargé, et le relais est dit.
 */
async function chargerSurMoteurOuvert(modelKey: string, options: { auto?: boolean }): Promise<{ ok: boolean; message: string }> {
  const r = await chargerModeleLlama(modelKey);
  if (!r.ok || !aEssayer(modelKey)) return r;
  const verdict = await essayerModele(urlLlamaCpp(), modelKey, cleLlamaCpp());
  noterEssai(modelKey, verdict);
  if (verdict.ok) return r;
  await dechargerModeleLlama(modelKey);
  const relais = await relaisApresDefaillance(modelKey, options.auto === true);
  return {
    ok: false,
    message: `${tf("{0} ne répond pas correctement sur cette machine (réponse d'essai illisible) : il a été déchargé.", modelKey)} ${relais} ${t("Renvoyez votre message.")}`,
  };
}

async function chargerModele(modelKey: string): Promise<{ ok: boolean; message: string; neuf?: boolean }> {
  const lms = await findLms();
  if (!lms) return { ok: false, message: t("LM Studio (lms) introuvable sur cette machine.") };

  /*
   * Déjà en mémoire ? Alors on ne charge rien : `lms load` sur un modèle
   * chargé n'échoue pas, il en ouvre une **copie** (« qwen3-8b:2 »). Et si on
   * ne peut pas le vérifier — LM Studio trop occupé pour répondre à `lms ps` —
   * on s'abstient aussi : mieux vaut que la demande échoue et le dise qu'une
   * copie de plusieurs gigaoctets qui fait tomber tout le reste.
   */
  /*
   * Un nom qui commence par « - » serait lu par `lms` comme une option (revue
   * du 26/09/2026) ; et rien d'autre qu'un nom de modèle n'a à passer ici.
   */
  if (!/^[A-Za-z0-9@_./:+-]{1,300}$/.test(modelKey) || modelKey.startsWith("-")) {
    return { ok: false, message: t("Nom de modèle invalide.") };
  }
  let enMemoire: LmsModelEntry[] | null = null;
  try {
    const { stdout } = await exec(lms, ["ps", "--json"], { timeout: 15_000 });
    const lu = JSON.parse(stdout);
    enMemoire = Array.isArray(lu) ? lu : null;
  } catch {
    enMemoire = null;
  }
  if (enMemoire === null) {
    return { ok: true, message: tf("Modèle {0} non rechargé : LM Studio n'a pas pu confirmer son état.", modelKey) };
  }
  if (enMemoire.some((e) => (e.modelKey ?? e.path) === modelKey)) {
    return { ok: true, message: tf("Modèle {0} déjà chargé.", modelKey) };
  }

  const charger = () =>
    exec(lms, ["load", modelKey, "--yes", "--ttl", TTL_SECONDES, ...optionsDeChargement()], { timeout: 300_000 });

  await faireLaPlace(lms, modelKey, enMemoire);
  // Sans ce dossier, llmster ne charge aucun modèle (engine.ts) : garanti avant chaque chargement, pas seulement au démarrage.
  preparerDossiersLlmster();

  try {
    await charger();
    chargesParHelix.add(modelKey);
    // Au journal, avec ses options : sur un poste, c'est ce qui dit que le modèle a été chargé par Helix, et comment (27/09/2026).
    console.log(`[helix] ${modelKey} chargé par Helix : ${optionsDeChargement().join(" ")}`);
    return { ok: true, message: tf("Modèle {0} chargé.", modelKey), neuf: true };
  } catch (err) {
    const detail = err instanceof Error ? `${err.message}` : String(err);

    /*
     * Sur une machine modeste, conversation et vision ne tiennent pas ensemble
     * en mémoire. Plutôt que de renvoyer un refus que l'utilisateur ne peut ni
     * comprendre ni résoudre, on libère la place et on réessaie une fois.
     */
    if (manqueDeMemoire(detail)) {
      const liberes = await unloadOthers(lms, modelKey);
      if (liberes > 0) {
        try {
          await charger();
          return {
            ok: true,
            message: tf("Modèle {0} chargé (mémoire libérée au préalable).", modelKey),
            neuf: true,
          };
        } catch (second) {
          return {
            ok: false,
            message: second instanceof Error ? second.message : String(second),
          };
        }
      }
      return {
        ok: false,
        message: tf("Mémoire insuffisante pour {0} sur cette machine, même après libération. Choisissez un modèle plus léger.", modelKey),
      };
    }
    return { ok: false, message: detail };
  }
}

/** Taille de conversation que Helix vise pour un modèle de LM Studio : la sienne au chargement, 32 768 à défaut. */
export function tailleVisee(): number {
  const options = optionsDeChargement();
  const i = options.indexOf("--context-length");
  const n = i >= 0 ? Number(options[i + 1]) : NaN;
  return Number.isFinite(n) && n > 0 ? n : 32_768;
}

/** Modèles déjà rechargés plus grands par cette instance : une seule tentative chacun (pas de boucle si `lms` n'en fait rien). */
const agrandissementsTentes = new Set<string>();

export type Agrandissement =
  | { fait: true; avant: number; apres: number }
  | { fait: false; avant: number; raison: "assez" | "application" | "occupe" | "inconnu" | "echec" | "deja" };

/**
 * Un modèle de LM Studio chargé avec une petite taille de conversation
 * (16/10/2026, « des fois ça se coupe chez certaines personnes ») : 4 096
 * jetons, le défaut de LM Studio quand il charge un modèle seul (chargement à
 * la demande, ou depuis son application). Helix le prenait tel quel
 * (`contexteCharge`) : ses consignes et ses outils dépassaient souvent cette
 * place à eux seuls, et le moteur refusait la demande (« greater than the
 * context length ») ou la coupait.
 *
 * Rechargé ici avec la taille de Helix (`optionsDeChargement`), seulement
 * quand c'est sûr :
 *  - le moteur est celui de Helix (`moteurGereParHelix`, engine.ts), ou c'est
 *    Helix qui a chargé ce modèle ; jamais un modèle chargé par l'application
 *    LM Studio de la personne, qui l'a peut-être réglé ainsi exprès et s'en
 *    sert peut-être ailleurs ;
 *  - le modèle est au repos (`lms ps` : `idle`) : on ne décharge pas sous une
 *    réponse en cours ;
 *  - une fois par modèle et par démarrage.
 * Sinon rien n'est touché, et l'appelant réduit ce qui part et le dit (chat.ts).
 */
export async function agrandirLaConversation(model: ModelInfo, auRechargement?: () => void): Promise<Agrandissement> {
  const avant = model.contexteCharge ?? 0;
  const visee = model.contexteMax ? Math.min(tailleVisee(), model.contexteMax) : tailleVisee();
  if (model.backendKind !== "lmstudio" || !avant || moteurOuvert()) return { fait: false, avant, raison: "inconnu" };
  if (avant >= Math.min(visee, 16_384)) return { fait: false, avant, raison: "assez" };
  /*
   * Hors du moteur de Helix, seulement un modèle que Helix a chargé sans
   * préciser de taille (poste de plus de 36 Go, `optionsDeChargement`) : la
   * petite taille est alors de son fait. Chargé par Helix avec sa taille et
   * revenu plus petit, c'est qu'un autre programme l'a rechargé : on n'y touche pas.
   */
  const parHelixSansTaille = chargesParHelix.has(model.id) && !optionsDeChargement().includes("--context-length");
  if (!moteurGereParHelix() && !parHelixSansTaille) return { fait: false, avant, raison: "application" };
  if (agrandissementsTentes.has(model.id)) return { fait: false, avant, raison: "deja" };
  if (!/^[A-Za-z0-9@_./:+-]{1,300}$/.test(model.id) || model.id.startsWith("-")) return { fait: false, avant, raison: "inconnu" };
  const lms = await findLms();
  if (!lms) return { fait: false, avant, raison: "inconnu" };
  let entree: LmsModelEntry | undefined;
  try {
    const { stdout } = await exec(lms, ["ps", "--json"], { timeout: 8000, maxBuffer: 4 * 1024 * 1024 });
    const lu = JSON.parse(stdout) as LmsModelEntry[];
    entree = Array.isArray(lu) ? lu.find((e) => (e.modelKey ?? e.path) === model.id) : undefined;
  } catch {
    return { fait: false, avant, raison: "inconnu" };
  }
  if (!entree) return { fait: false, avant, raison: "inconnu" };
  if (entree.status && entree.status !== "idle") return { fait: false, avant, raison: "occupe" };
  // Une seconde copie (« …:2 ») sert peut-être quelqu'un d'autre : on ne s'y risque pas.
  if (entree.identifier && entree.identifier !== model.id) return { fait: false, avant, raison: "application" };
  agrandissementsTentes.add(model.id);
  auRechargement?.();
  const options = optionsDeChargement().filter((_, i, tout) => tout[i] !== "--context-length" && tout[i - 1] !== "--context-length");
  try {
    await exec(lms, ["unload", model.id], { timeout: 30_000 });
    chargesParHelix.delete(model.id);
    preparerDossiersLlmster();
    await exec(lms, ["load", model.id, "--yes", "--ttl", TTL_SECONDES, "--context-length", String(visee), ...options], { timeout: 300_000 });
    chargesParHelix.add(model.id);
  } catch (err) {
    console.warn(`[helix] ${model.id} : rechargement avec ${visee} jetons raté (${err instanceof Error ? err.message.slice(0, 200) : String(err)})`);
    return { fait: false, avant, raison: "echec" };
  }
  let apres = visee;
  try {
    const { stdout } = await exec(lms, ["ps", "--json"], { timeout: 8000, maxBuffer: 4 * 1024 * 1024 });
    const lu = JSON.parse(stdout) as LmsModelEntry[];
    const relu = Array.isArray(lu) ? lu.find((e) => (e.modelKey ?? e.path) === model.id) : undefined;
    if (typeof relu?.contextLength === "number") apres = relu.contextLength;
  } catch {
    /* on garde la taille demandée */
  }
  console.log(`[helix] ${model.id} rechargé par Helix : conversation de ${avant} à ${apres} jetons`);
  return apres > avant ? { fait: true, avant, apres } : { fait: false, avant, raison: "echec" };
}
