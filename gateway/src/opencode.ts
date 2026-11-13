import { spawn, type ChildProcess } from "node:child_process";
import http from "node:http";
import { createServer } from "node:net";
import { randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import {
  writeFileSync,
  readFileSync,
  unlinkSync,
  chmodSync,
  existsSync,
  mkdirSync,
  realpathSync,
  statSync,
  readdirSync,
} from "node:fs";
import { join, dirname, parse, sep } from "node:path";
import { homedir } from "node:os";
import { PORT, NIVEAUX_EFFORT } from "./config.ts";
import { instanceToken } from "./auth.ts";
import { etatInstallationOpencode, installerOpencode, opencodeDeHelix, opencodeInstallable, type EtatInstallationOpencode } from "./opencodePrive.ts";
import { models } from "./router.ts";
import { autoProvisionEnabled, deployment } from "./deployment.ts";
import { t, tf } from "./langue.ts";
import { CONSIGNES_CODE } from "./allegementCode.ts";
import { AGENT_PETIT, agentPetitOpenCode, agentPourModele, estPetitModele, noterPetitsModeles } from "./petitsModeles.ts";
import { optionsDeChargement } from "./backends.ts";
import { contientUneZone, estProtege } from "./zonesProtegees.ts";
import type { ModelInfo } from "./types.ts";
import { arreterArbre } from "./processus.ts";
import { codeGreffonRtk, ecrireEnveloppe, menageBases, rtkEnFond } from "./rtk.ts";

/**
 * Moteur de l'écran Code : OpenCode en mode serveur (ARCHITECTURE.md, ADR-003).
 *
 * OpenCode n'appelle jamais un fournisseur directement : il est configuré pour
 * passer par la passerelle Helix. Il hérite donc du routage par rôle, du profil
 * de déploiement client et des clés d'API — locale aujourd'hui, cloud européen
 * demain, sans rien changer ici.
 */

/*
 * `HELIX_OPENCODE_BIN` d'abord : un intégrateur peut ainsi fixer la version
 * d'OpenCode qu'il a éprouvée, indépendamment de celle que la personne a
 * installée pour son propre usage. C'est aussi ce qui permet d'essayer une
 * nouvelle version avant de l'adopter.
 */
/*
 * Sous Windows (audit du 27/09/2026) : `opencode.exe`, jamais le `.cmd` que
 * pose npm (Node refuse de le lancer sans interpréteur de commandes). Les
 * emplacements de scoop et de l'installation npm (paquet de la plateforme,
 * disposition relevée dans le paquet `opencode-ai`, pas essayée sur un vrai
 * Windows).
 */
/*
 * L'OpenCode posé par Helix (opencodePrive.ts) passe avant ceux de la
 * machine : c'est la version épinglée, avec laquelle Helix Code a été essayé.
 */
const CANDIDATES =
  process.platform === "win32"
    ? [
        ...(process.env.HELIX_OPENCODE_BIN ? [process.env.HELIX_OPENCODE_BIN] : []),
        opencodeDeHelix(),
        join(homedir(), ".opencode", "bin", "opencode.exe"),
        join(homedir(), "scoop", "shims", "opencode.exe"),
        ...(process.env.APPDATA
          ? [
              join(process.env.APPDATA, "npm", "node_modules", "opencode-ai", "node_modules", `opencode-windows-${process.arch === "arm64" ? "arm64" : "x64"}`, "bin", "opencode.exe"),
              join(process.env.APPDATA, "npm", "node_modules", `opencode-windows-${process.arch === "arm64" ? "arm64" : "x64"}`, "bin", "opencode.exe"),
            ]
          : []),
        "opencode.exe",
      ]
    : [...(process.env.HELIX_OPENCODE_BIN ? [process.env.HELIX_OPENCODE_BIN] : []), opencodeDeHelix(), `${homedir()}/.opencode/bin/opencode`, "opencode"];

/**
 * Mot de passe du serveur OpenCode, tiré à chaque démarrage de la passerelle.
 *
 * Sans lui, OpenCode écoute sur la boucle locale **sans aucune
 * authentification** — il l'annonce lui-même au démarrage : « server is
 * unsecured ». Vérifié au banc : un simple `curl -X POST
 * http://127.0.0.1:<port>/api/session` sans le moindre jeton ouvre une session
 * d'agent, donc l'accès aux outils de lecture, d'écriture et de commande
 * d'OpenCode dans le dossier de projet. Toute l'authentification de la
 * passerelle — jeton d'instance et séance — était contournable par n'importe
 * quel processus du poste, sans rien connaître de Helix.
 *
 * Le mot de passe ne vit qu'en mémoire, le temps de l'exécution : il n'est
 * écrit nulle part sur le disque. OpenCode l'attend en HTTP Basic, avec
 * l'utilisateur littéral « opencode » (mesuré : tout autre nom est refusé).
 */
const motDePasseServeur = randomBytes(24).toString("base64url");

const enteteServeur = (): string =>
  "Basic " + Buffer.from(`opencode:${motDePasseServeur}`).toString("base64");

/**
 * Clé que présente OpenCode au serveur d'outils de la passerelle
 * (`/helix/code/outils`, outilsCode.ts). Le jeton d'instance ne suffit pas :
 * il est sur chaque poste du parc, et cette route fait agir les connecteurs
 * sans séance. Tirée à chaque démarrage, gardée en mémoire, remise à OpenCode
 * par son environnement (voir `environnementOpenCode`) : depuis le 26/09/2026,
 * plus aucun secret n'est écrit en clair dans sa configuration.
 */
export const cleOutils = randomBytes(24).toString("base64url");

/**
 * Clé que joint OpenCode à chaque appel au modèle (en-tête `X-Helix-Relais`
 * du fournisseur « helix »). Revue du 25/09/2026 : le relais (chat.ts) croyait
 * l'en-tête `X-Session-Id` de n'importe quel porteur du jeton d'instance, qui
 * pouvait ainsi faire afficher des statuts dans la session de Code d'un
 * collègue. Seuls les appels qui présentent cette clé sont suivis
 * (attenteModele.ts).
 */
const cleRelais = randomBytes(24).toString("base64url");

/** La clé présentée est-elle celle remise à OpenCode ? Comparaison en temps constant. */
function memeCle(valeur: unknown, attendue: string): boolean {
  if (typeof valeur !== "string" || !valeur) return false;
  const a = Buffer.from(valeur);
  const b = Buffer.from(attendue);
  return a.length === b.length && timingSafeEqual(a, b);
}
export const cleOutilsValide = (valeur: unknown): boolean => memeCle(valeur, cleOutils);
export const cleRelaisValide = (valeur: unknown): boolean => memeCle(valeur, cleRelais);

/*
 * Noms des variables par lesquelles OpenCode reçoit les secrets que sa
 * configuration désigne (`{env:…}`, substitué par OpenCode à la lecture :
 * lu dans son code 1.18.32, `text.replace(/\{env:([^}]+)\}/g, …)`).
 */
const VAR_JETON = "HELIX_OPENCODE_JETON";
const VAR_CLE_OUTILS = "HELIX_OPENCODE_CLE_OUTILS";
const VAR_CLE_RELAIS = "HELIX_OPENCODE_CLE_RELAIS";
/** Ce qu'aucune commande lancée par OpenCode ne doit trouver dans son environnement. */
export const VARIABLES_SECRETES = ["OPENCODE_SERVER_PASSWORD", VAR_JETON, VAR_CLE_OUTILS, VAR_CLE_RELAIS];

let child: ChildProcess | null = null;
let port: number | null = null;
let starting: Promise<number | null> | null = null;
let lastError: string | undefined;
/** Les modèles écrits dans la configuration que le serveur en cours a lue. */
let modelesEcrits = new Set<string>();

/**
 * État rendu par `GET /helix/code`. Plus de port d'OpenCode depuis le
 * 26/09/2026 (revue du 25/09) : aucun client ne s'en servait, et la route ne
 * demande que le jeton d'instance.
 */
export interface CodeStatus {
  available: boolean;
  running: boolean;
  projectDir: string;
  error?: string;
  /** Helix sait-il poser OpenCode ici ? Sinon, la raison. */
  installable: boolean;
  raisonNonInstallable?: string;
  installation: EtatInstallationOpencode;
  /**
   * L'installation se fait-elle d'office, sans clic ? Non quand le profil de
   * déploiement réserve les installations à l'intégrateur (`autoProvision`).
   */
  installationAuto: boolean;
}

/** Après une installation : la prochaine recherche doit trouver le nouvel OpenCode, sans attendre. */
export function oublierOpencode(): void {
  binaireConnu = null;
  dernierEchec = 0;
}

/**
 * Dossier de l'instance par défaut : celui où démarre OpenCode, et celui d'une
 * personne qui n'en a encore choisi aucun. Validé comme un dossier choisi : un
 * profil qui désignerait le dossier personnel entier ne le fait pas devenir
 * dossier de projet (retour à ~/Helix).
 */
export function dossierParDefaut(): string {
  const voulu = process.env.HELIX_CODE_DIR ?? deployment().workspace;
  const repli = join(homedir(), "Helix");
  if (!voulu) return repli;
  if (!existsSync(voulu)) return voulu; // créé au démarrage d'OpenCode (writeConfig)
  const verdict = validerDossier(voulu);
  return verdict.ok ? verdict.chemin : repli;
}

/**
 * Dossier de projet d'une personne : le dernier qu'elle a choisi, sinon celui
 * de l'instance. Revue du 25/09/2026 : il était commun à toute l'instance
 * (`setProjectDir`), si bien que le choix d'une collègue devenait le dossier
 * de repli des sessions d'une autre. Une session existante, elle, garde
 * toujours le sien (registre, sessionsCode.ts) : ce dossier ne sert qu'à en
 * ouvrir une nouvelle.
 */
export function projectDir(userId?: string): string {
  return (userId ? dossiersChoisis.get(userId) : undefined) ?? dossierParDefaut();
}

async function chercherBinaire(): Promise<string | null> {
  for (const candidate of CANDIDATES) {
    try {
      const probe = spawn(candidate, ["--version"], { stdio: "ignore" });
      const ok = await new Promise<boolean>((resolve) => {
        probe.on("close", (code) => resolve(code === 0));
        probe.on("error", () => resolve(false));
      });
      if (ok) return candidate;
    } catch {
      /* candidat suivant */
    }
  }
  return null;
}

/**
 * Localisation d'OpenCode, mémorisée.
 *
 * `status()` appelle `locate()` à chaque `GET /helix/code`, et la recherche
 * lançait un `opencode --version` par appel. Mesuré au banc : 40 requêtes
 * simultanées ouvrent 40 processus enfants. Or cette route ne demande que le
 * jeton d'instance — présent sur chaque poste du parc — et sa réponse tient en
 * quatre champs : n'importe qui pouvait saturer la machine avec des requêtes
 * d'apparence anodine.
 *
 * Un binaire trouvé ne se déplace pas en cours d'exécution : la réponse est
 * gardée définitivement. Une absence, elle, peut être corrigée par une
 * installation pendant que Helix tourne — on la revérifie donc, mais pas plus
 * d'une fois par demi-minute. C'est la même mémorisation que `findLms` dans
 * backends.ts.
 */
const LOCALISATION_TTL = 30_000;
let binaireConnu: string | null = null;
let rechercheEnCours: Promise<string | null> | null = null;
let dernierEchec = 0;

function locate(): Promise<string | null> {
  if (binaireConnu) return Promise.resolve(binaireConnu);
  // Une recherche déjà lancée sert tous les appelants : c'est elle qui évite la
  // rafale de processus quand plusieurs requêtes arrivent ensemble.
  if (rechercheEnCours) return rechercheEnCours;
  if (dernierEchec && Date.now() - dernierEchec < LOCALISATION_TTL) {
    return Promise.resolve(null);
  }

  rechercheEnCours = chercherBinaire()
    .catch(() => null)
    .then((trouve) => {
      if (trouve) binaireConnu = trouve;
      else dernierEchec = Date.now();
      rechercheEnCours = null;
      return trouve;
    });
  return rechercheEnCours;
}

/**
 * Écrit la configuration OpenCode du projet : un fournisseur unique, la
 * passerelle Helix. Les modèles proposés sont ceux qu'elle expose réellement.
 */
/**
 * Où vit la configuration d'OpenCode, et pourquoi plus dans le dossier de
 * travail.
 *
 * Elle y était, et deux choses clochaient.
 *
 * **Elle n'était plus lue.** OpenCode 1.18 range les projets par dépôt : un
 * dossier qui n'est pas un dépôt Git devient le projet « global », et sa
 * configuration locale est ignorée. Mesuré le 20/09/2026 : le journal
 * d'OpenCode ne charge que les trois chemins globaux, jamais celui du dossier.
 * Le fournisseur « helix » n'existait donc pas pour lui, et chaque prompt
 * finissait en « Provider request failed with HTTP 401 : missing_api_key »
 * chez un fournisseur distant, puis en « Model unavailable » une fois le
 * modèle nommé.
 *
 * **Elle portait le jeton d'instance en clair dans le dossier de
 * l'utilisateur**, c'est-à-dire souvent un dépôt Git ou un partage réseau. Le
 * commentaire d'origine s'en remettait à un `.gitignore` posé par
 * l'intégrateur, ce qui revient à confier une clé à la vigilance d'un tiers.
 *
 * Le fichier vit désormais à côté des données de l'instance, et son chemin est
 * transmis au serveur par `OPENCODE_CONFIG` : lu à coup sûr, quel que soit le
 * dossier de travail, et hors de portée d'un `git add .`.
 */
function dossierConfig(): string {
  const base = process.env.HELIX_DATA_DIR ?? join(homedir(), ".helix", "data");
  const dossier = join(base, "opencode");
  if (!existsSync(dossier)) mkdirSync(dossier, { recursive: true });
  return dossier;
}

/**
 * Un **dossier**, et pas un fichier : `OPENCODE_CONFIG` ne produit aucun effet
 * mesurable en 1.18.3 (le fournisseur reste inconnu), là où
 * `OPENCODE_CONFIG_DIR` fonctionne. Vérifié en interrogeant le serveur
 * lui-même : `GET /api/provider` ne rend « helix » que dans le second cas.
 */
const cheminConfig = (): string => join(dossierConfig(), "opencode.json");

/**
 * Taille de conversation d'un modèle local, dite à OpenCode (`limit`).
 *
 * Sans elle, OpenCode ne résume jamais une conversation qui s'allonge : lu
 * dans son code (1.18.32), `limit.context` à 0 veut dire « pas de limite
 * connue », et le résumé automatique ne se déclenche que passé
 * `context - output`. Sur Qwen3 8B chargé à 28 160 jetons (constat du
 * 25/09/2026), une session longue finissait donc par dépasser ce que LM Studio
 * accepte, au lieu d'être résumée. Et `output` n'était pas donné non plus :
 * OpenCode demandait 32 000 jetons de réponse (relevé dans la demande), plus
 * que tout le contexte.
 *
 * Seulement quand on la connaît : celle du chargement en cours (`lms ps`), ou
 * celle avec laquelle Helix le chargera lui-même (`optionsDeChargement`). Un
 * chargement fait ensuite par un autre programme avec une taille plus petite
 * n'est pas vu avant le prochain démarrage d'OpenCode. La réponse est bornée
 * au quart du contexte, 8 192 jetons au plus : de quoi écrire un fichier, et
 * trois quarts pour la demande et l'historique avant le résumé.
 */
function limiteDe(m: ModelInfo): { context: number; output: number } | undefined {
  // Le moteur ouvert (Mac Intel) charge toujours à 32 768 jetons (llamaCpp.ts).
  if (m.backendKind === "llamacpp") return { context: 32_768, output: 8192 };
  if (m.backendKind !== "lmstudio") return undefined;
  const options = optionsDeChargement();
  const i = options.indexOf("--context-length");
  const parHelix = i >= 0 ? Number(options[i + 1]) : undefined;
  const contexte = m.contexteCharge ?? (m.loaded ? undefined : parHelix);
  if (!contexte || !Number.isFinite(contexte) || contexte < 4096) return undefined;
  const borne = m.contexteMax ? Math.min(contexte, m.contexteMax) : contexte;
  return { context: borne, output: Math.min(8192, Math.floor(borne / 4)) };
}

async function writeConfig(dir: string): Promise<void> {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  /*
   * Ménage de l'ancien emplacement : un `opencode.json` écrit par une version
   * précédente porte le jeton d'instance en clair dans le dossier de travail.
   * On ne l'efface que si c'est bien le nôtre — reconnaissable à son
   * fournisseur « helix » — pour ne jamais toucher à celui d'un utilisateur
   * qui aurait le sien.
   */
  const ancien = join(dir, "opencode.json");
  try {
    if (existsSync(ancien)) {
      const contenu = JSON.parse(readFileSync(ancien, "utf8")) as {
        provider?: Record<string, unknown>;
      };
      if (contenu?.provider && Object.keys(contenu.provider).length === 1 && contenu.provider.helix) {
        unlinkSync(ancien);
        console.log(`[opencode] ancienne configuration retirée du dossier de travail : ${ancien}`);
      }
    }
  } catch {
    /* illisible ou non supprimable : on n'insiste pas, la nouvelle prime */
  }

  // Une reconfiguration doit relire les modèles, pas recycler le cache du sélecteur.
  const available = await models(true);
  const usable = available.filter(
    (m) => m.roles.includes("code") || m.roles.includes("chat"),
  );

  /*
   * Une variante par niveau de raisonnement de l'écran (« faible », « eleve »…).
   * OpenCode recopie les options d'une variante dans le corps de chaque appel
   * au modèle : `effort` arrive donc à la passerelle, qui l'applique comme pour
   * le Chat (`basePayload`, chat.ts). Mesuré le 23/09/2026 contre un faux
   * fournisseur : la variante « faible » fait partir `"effort":"faible"`, sans
   * variante rien ne part. Sans cela, le sélecteur de niveau de l'écran Code
   * était décoratif.
   *
   * Toutes les variantes existent pour tous les modèles, et c'est nécessaire :
   * une session ouverte sur une variante inconnue d'OpenCode accepte la demande
   * puis se tait pour toujours (vérifié, même banc).
   */
  const variantes = Object.fromEntries(
    Object.keys(NIVEAUX_EFFORT).map((niveau) => [niveau, { effort: niveau }]),
  );
  const modelEntries: Record<
    string,
    { name: string; variants: Record<string, { effort: string }>; limit?: { context: number; output: number } }
  > = {};
  for (const m of usable) {
    const limite = limiteDe(m);
    modelEntries[m.id] = { name: `${m.id} (${m.backendLabel})`, variants: variantes, ...(limite ? { limit: limite } : {}) };
  }
  if (Object.keys(modelEntries).length === 0) {
    modelEntries["auto"] = { name: "Automatique", variants: variantes };
  }
  modelesEcrits = new Set(Object.keys(modelEntries));
  // Les petits modèles (8 milliards ou moins) travaillent avec l'agent `helix-petit` (petitsModeles.ts, 27/09/2026).
  noterPetitsModeles(usable.filter((m) => estPetitModele(m)).map((m) => m.id));

  const pinned = deployment().models?.code;
  const preferred = pinned?.includes("/") ? pinned.split("/").pop()! : pinned;
  const defaultModel = preferred ?? usable[0]?.id ?? "auto";

  const fichierConfig = cheminConfig();
  /*
   * RTK (rtk.ts, 28/09/2026) : les commandes de l'agent partent par une
   * enveloppe du shell, **après** la barrière d'approbation, qui les fait
   * passer par RTK dans les sessions où il sert, et les laisse telles quelles
   * ailleurs. Aucune sous Windows : OpenCode garde son propre choix.
   */
  let enveloppe: string | null = null;
  try {
    enveloppe = ecrireEnveloppe();
  } catch (err) {
    console.warn(`[rtk] enveloppe non écrite, commandes sans RTK : ${err instanceof Error ? err.message : String(err)}`);
  }
  writeFileSync(
    fichierConfig,
    JSON.stringify(
      {
        $schema: "https://opencode.ai/config.json",
        ...(enveloppe ? { shell: enveloppe } : {}),
        provider: {
          helix: {
            npm: "@ai-sdk/openai-compatible",
            // Nom affiché dans OpenCode : celui de la marque, pas celui du code.
            name: process.env.HELIX_NOM_PRODUIT?.trim() || "Instance",
            /*
             * La clé est le jeton d'instance : depuis que la passerelle exige
             * une authentification, un fournisseur sans clé se heurte à un 401
             * au premier prompt — et l'échec est silencieux côté interface.
             *
             * Depuis le 26/09/2026, le fichier ne le porte plus : `{env:…}`
             * le fait lire par OpenCode dans son environnement (voir
             * `environnementOpenCode`). Revue du 25/09 : une commande lancée
             * par l'agent n'a qu'à lire ce fichier pour tenir la clé de toute
             * la passerelle. `X-Helix-Relais` : voir `cleRelais`.
             */
            options: {
              baseURL: `http://localhost:${PORT}/v1`,
              apiKey: `{env:${VAR_JETON}}`,
              headers: { "X-Helix-Relais": `{env:${VAR_CLE_RELAIS}}` },
            },
            models: modelEntries,
          },
        },
        model: `helix/${defaultModel}`,
        /*
         * Le « petit modèle » sert aux travaux annexes : titre de session,
         * résumés. Sans cette ligne, OpenCode les confie à son propre
         * fournisseur hébergé, c'est-à-dire qu'un morceau du code du client
         * part chez un tiers pour écrire un titre.
         */
        small_model: `helix/${defaultModel}`,
        /*
         * Aucun repli sur le fournisseur distant d'OpenCode : sur une
         * plateforme vendue comme locale, un basculement silencieux vers un
         * service tiers enverrait le code du client hors de sa machine.
         *
         * ⚠ Mesuré le 20/09/2026 sur OpenCode 1.18.3 : cette liste **n'est
         * pas respectée**. `GET /api/provider` rend encore « opencode », avec
         * trente et un modèles hébergés. C'est la raison du 401 d'origine : la
         * session sans modèle tombait sur l'un d'eux. La vraie protection est
         * ailleurs, et elle tient en deux points : la passerelle nomme
         * toujours le modèle (`handleCodeSession`), et `small_model` ci-dessus
         * couvre les travaux annexes. La liste reste, pour le jour où elle
         * refonctionnera.
         */
        /*
         * Jamais de question en attente. OpenCode demande une autorisation
         * avant de sortir du dossier de travail (« external_directory »), ou
         * devant une boucle (« doom_loop »), et son outil « question » attend
         * une réponse de la personne. Aucune de ces demandes ne passe par le
         * flux que l'écran écoute : vérifié le 23/09/2026, une lecture de
         * /etc/hosts laissait la session bloquée pour toujours, l'outil
         * tournant à l'écran sans que personne puisse répondre. Refusées
         * d'office, elles deviennent un échec d'outil que le modèle lit et
         * explique (vérifié, même banc). C'est aussi la règle de Helix : une
         * fois le dossier choisi, l'agent n'en sort pas.
         */
        /*
         * `skill` refusé aussi (25/09/2026) : les compétences extérieures sont
         * coupées (OPENCODE_DISABLE_EXTERNAL_SKILLS), et la seule qui reste,
         * livrée avec OpenCode, sert à modifier sa propre configuration, que
         * Helix écrit. Un outil refusé disparaît de la liste envoyée au modèle :
         * 165 jetons de moins à chaque lecture (mesuré), plus sa présentation
         * dans les consignes.
         */
        /*
         * **Tout le reste demande**, et la réponse vient de la barrière de
         * Helix (fluxCode.ts, permissionsCode.ts, approbation.ts). Revue de
         * sécurité du 25/09/2026 : les défauts d'OpenCode 1.18.32 sont
         * `"*": "allow"`, si bien que `bash`, `edit`, `write`, `apply_patch` et
         * `webfetch` agissaient sans jamais passer par la barrière
         * d'approbation, alors que les connecteurs, eux, y passaient. Une
         * commande a les droits du compte qui fait tourner l'instance.
         *
         * OpenCode garde la dernière règle qui correspond (ordre des clés) :
         * `"*"` d'abord, les exceptions ensuite. Les lectures demandent aussi :
         * c'est le niveau de l'instance qui décide, à chaque demande, de les
         * laisser passer (« Demander avant de modifier ») ou non (« Demander
         * pour tout ») ; la configuration, elle, n'est lue qu'au démarrage.
         * Laissés libres : la liste de tâches, les sous-agents (leurs outils
         * redemandent), et les connecteurs de l'instance (`helix_*`), que la
         * passerelle soumet déjà elle-même à la barrière (outilsCode.ts) : les
         * faire demander aussi ici donnerait deux cartes pour un seul appel.
         */
        permission: {
          "*": "ask",
          read: "ask",
          glob: "ask",
          grep: "ask",
          list: "ask",
          lsp: "ask",
          edit: "ask",
          write: "ask",
          apply_patch: "ask",
          bash: "ask",
          webfetch: "ask",
          websearch: "ask",
          codesearch: "ask",
          todowrite: "allow",
          todoread: "allow",
          task: "allow",
          "helix_*": "allow",
          external_directory: "deny",
          doom_loop: "deny",
          question: "deny",
          skill: "deny",
        },
        /*
         * Des consignes courtes à la place de celles d'OpenCode, écrites pour
         * son terminal (allegementCode.ts) : 2 098 jetons relus à chaque appel
         * dont le modèle a perdu le début, mesuré le 25/09/2026. Pour l'agent
         * principal et le sous-agent généraliste ; l'explorateur a déjà les
         * siennes, courtes.
         */
        agent: { build: { prompt: CONSIGNES_CODE }, general: { prompt: CONSIGNES_CODE }, [AGENT_PETIT]: agentPetitOpenCode() },
        /*
         * Les connecteurs de l'instance (Drive, Slack, courrier, agenda,
         * serveurs MCP du catalogue), servis par la passerelle elle-même et non
         * par leurs serveurs : chaque appel repasse ainsi par la barrière
         * d'approbation et le journal (voir outilsCode.ts).
         *
         * `timeout` : OpenCode coupe un appel d'outil MCP au bout de ce délai
         * (5 secondes par défaut, d'après son schéma de configuration). Une
         * carte d'accord attend jusqu'à deux minutes (`DELAI`, approbation.ts) :
         * coupé avant, l'agent aurait tenu pour échouée une action que la
         * personne était en train d'approuver. `oauth: false` : un refus de la
         * passerelle ne doit pas lancer chez OpenCode une autorisation OAuth.
         */
        mcp: {
          helix: {
            type: "remote",
            url: `http://localhost:${PORT}/helix/code/outils`,
            headers: { Authorization: `Bearer {env:${VAR_JETON}}`, "X-Helix-Cle": `{env:${VAR_CLE_OUTILS}}` },
            enabled: true,
            oauth: false,
            timeout: 130_000,
          },
        },
        autoupdate: false,
        disabled_providers: ["opencode", "anthropic", "openai", "google", "openrouter"],
      },
      null,
      2,
    ),
    "utf8",
  );

  /*
   * Le fichier ne porte plus de secret (`{env:…}`), mais il dit comment
   * OpenCode joint la passerelle : il reste au seul propriétaire.
   */
  try {
    chmodSync(fichierConfig, 0o600);
  } catch {
    /* système de fichiers sans permissions (partage réseau) : on continue */
  }
  ecrireGreffonEnvironnement();
}

/**
 * Le greffon qui retire les secrets de l'environnement des commandes.
 *
 * OpenCode lance ses commandes (outil `bash`, terminal, commandes « ! ») avec
 * **tout son propre environnement** : lu dans son code 1.18.32,
 * `{ ...process.env, ...env }`, où `env` vient du crochet `shell.env` des
 * greffons. Son mot de passe de serveur ne peut lui être donné que par
 * l'environnement (`OPENCODE_SERVER_PASSWORD`, aucune option ni réglage), et
 * c'est aussi par l'environnement qu'il reçoit désormais le jeton d'instance
 * et les clés de la passerelle. Sans ce greffon, `env` dans une commande les
 * affichait (constat de la revue du 25/09/2026 pour le mot de passe).
 *
 * Le crochet ne peut pas retirer une variable, seulement la remplacer : elle
 * reste présente, vide. OpenCode charge les greffons `plugin/*.js` de son
 * dossier de configuration (`OPENCODE_CONFIG_DIR`).
 *
 * **Ce que cela ne ferme pas**, mesuré le 26/09/2026 sur ce Mac : un processus
 * du même compte lit l'environnement **de départ** d'un autre (`ps eww <pid>`,
 * `KERN_PROCARGS2`). Une commande approuvée peut donc retrouver ces valeurs
 * en lisant celui d'OpenCode, comme elle peut lire tout fichier du compte,
 * `instance-token` compris. Le greffon ferme la fuite ordinaire (une commande
 * qui affiche son environnement, et sa sortie qui part au modèle) ; la
 * barrière d'approbation reste ce qui décide qu'une commande s'exécute
 * (SECURITE.md § 11).
 */
function ecrireGreffonEnvironnement(): void {
  const dossier = join(dossierConfig(), "plugin");
  if (!existsSync(dossier)) mkdirSync(dossier, { recursive: true });
  const vides = { ...Object.fromEntries(VARIABLES_SECRETES.map((v) => [v, ""])), ...variablesRendues() };
  const fichier = join(dossier, "helix-environnement.js");
  writeFileSync(
    fichier,
    [
      // Les `import` en tête : le morceau de RTK en porte (rtk.ts, `codeGreffonRtk`).
      ...codeGreffonRtk(),
      "// Écrit par la passerelle Helix (gateway/src/opencode.ts) : ne pas modifier.",
      "// Les commandes lancées par l'agent ne reçoivent ni le mot de passe du serveur ni les clés de la passerelle.",
      `const VIDES = ${JSON.stringify(vides)};`,
      ...codeCheminHorsProjet(),
      "export const HelixEnvironnement = async (contexte) => ({",
      // `HELIX_RTK_DB` : seulement dans les sessions où RTK sert ; l'enveloppe du shell le lit (rtk.ts).
      '  "shell.env": async (entree, sortie) => {',
      "    sortie.env = { ...(sortie.env ?? {}), ...VIDES, HELIX_RTK_DB: baseRtk(entree?.sessionID) };",
      "  },",
      '  "tool.execute.before": async (entree, sortie) => {',
      "    const refus = helixHorsProjet(entree?.tool, sortie?.args, contexte?.directory, contexte?.worktree);",
      "    if (refus) throw new Error(refus);",
      "  },",
      "});",
      "",
    ].join("\n"),
    "utf8",
  );
  try {
    chmodSync(fichier, 0o600);
  } catch {
    /* sans permissions : on continue */
  }
}

/**
 * Un chemin hors du dossier du projet, dit au modèle pour qu'il se corrige
 * (23/10/2026).
 *
 * Capture d'un utilisateur sous Windows : l'agent écrivait `/app/metier.js`
 * (C:\app\metier.js, hors du projet). OpenCode le refusait
 * (`external_directory: deny`, plus haut) avec son message de règle : « The
 * user has specified a rule which prevents you from using this specific tool
 * call », suivi du JSON de toutes les règles, que le modèle lisait sans y
 * trouver quoi faire, et que l'écran affichait tel quel. Ce crochet passe
 * **avant** l'outil, pour les seuls outils de fichiers livrés (read, write,
 * edit, list, glob, grep : jamais un outil de connecteur, dont un argument
 * `path` peut désigner autre chose), et seulement pour un chemin absolu hors
 * du dossier et de l'arbre du projet (sauf un chemin qui passe par un dossier
 * `opencode` : `tool-output` de ses données et `opencode` du dossier
 * temporaire, qu'il se permet ; relevé dans ses règles le 23/10/2026) : ce
 * qu'OpenCode aurait refusé de toute façon. Il ne
 * permet rien de plus ; il refuse avec une phrase qui dit le dossier du projet
 * et, quand le fichier y existe, le bon chemin.
 */
export function codeCheminHorsProjet(): string[] {
  return [
    'import { existsSync as helixExiste } from "node:fs";',
    'import { isAbsolute as helixAbsolu, relative as helixRelatif, resolve as helixResoudre } from "node:path";',
    'const HELIX_CHEMINS = { read: "filePath", write: "filePath", edit: "filePath", list: "path", glob: "path", grep: "path" };',
    "const helixDedans = (racine, chemin) => {",
    '  if (typeof racine !== "string" || !racine || racine === "/") return false;',
    "  const r = helixRelatif(helixResoudre(racine), chemin);",
    '  return r === "" || (!/^\\.\\.([\\\\/]|$)/.test(r) && !helixAbsolu(r));',
    "};",
    "const helixHorsProjet = (outil, args, dossier, arbre) => {",
    "  const cle = HELIX_CHEMINS[outil];",
    '  const brut = cle && args && typeof args[cle] === "string" ? args[cle].trim() : "";',
    '  if (!brut || typeof dossier !== "string" || !dossier) return null;',
    "  if (!helixAbsolu(brut) && !/^[A-Za-z]:[\\\\/]/.test(brut)) return null;",
    "  const chemin = helixResoudre(dossier, brut);",
    "  if (helixDedans(dossier, chemin) || helixDedans(arbre, chemin)) return null;",
    // Les dossiers qu'OpenCode se permet (`tool-output` de ses données, `opencode` du dossier temporaire) : laissés à sa propre règle.
    "  if (/[\\\\/]opencode([\\\\/]|$)/.test(chemin)) return null;",
    '  const relatif = brut.replace(/^[A-Za-z]:/, "").replace(/^[\\\\/]+/, "");',
    "  const propose = relatif && helixExiste(helixResoudre(dossier, relatif)) ? helixResoudre(dossier, relatif) : \"\";",
    "  return \"This path is outside the project folder: \" + brut + \". The project folder is \" + dossier + \". \" +",
    '    (propose ? "Did you mean " + propose + "? " : "") +',
    '    "Use paths inside the project folder: an absolute path from another system (/app, /home, C:\\\\) is not the project. Nothing was done.";',
    "};",
  ];
}

/**
 * Variables de l'hôte transmises à OpenCode, et rien d'autre.
 *
 * Revue du 25/09/2026 : OpenCode recevait tout `process.env` de la passerelle,
 * c'est-à-dire, selon le poste, `HELIX_TOKEN`, des clés de fournisseurs, des
 * mots de passe de base de données, et le transmettait à chaque commande.
 * Une liste blanche : ce qu'un shell et les outils de développement habituels
 * attendent (chemins, langue, dossier temporaire, compte), plus, sous Windows,
 * ce sans quoi un processus ne démarre pas. Vérifié le 26/09/2026 : OpenCode
 * 1.18.32 démarre et répond avec ce seul environnement.
 */
const TRANSMISES = ["PATH", "HOME", "LANG", "TMPDIR", "USER", "LOGNAME", "SHELL", "TZ", "TERM",
  "SystemRoot", "SYSTEMROOT", "APPDATA", "LOCALAPPDATA", "USERPROFILE", "TEMP", "TMP", "ComSpec", "PATHEXT", "windir"];

export function environnementOpenCode(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [nom, valeur] of Object.entries(process.env)) {
    if (valeur === undefined) continue;
    // Sous Windows, les noms ne tiennent pas compte de la casse, et le PATH s'y appelle souvent `Path` : sans ce repli, OpenCode partait sans PATH.
    const transmise = process.platform === "win32" ? TRANSMISES.some((t) => t.toUpperCase() === nom.toUpperCase()) : TRANSMISES.includes(nom);
    if (transmise || nom.startsWith("LC_")) env[nom] = valeur;
  }
  return {
    ...env,
    // Le mot de passe ferme le serveur d'agent aux autres processus du poste.
    OPENCODE_SERVER_PASSWORD: motDePasseServeur,
    // Lus par la configuration (`{env:…}`), jamais écrits sur le disque.
    [VAR_JETON]: instanceToken(),
    [VAR_CLE_OUTILS]: cleOutils,
    [VAR_CLE_RELAIS]: cleRelais,
    // La configuration ne dépend plus du dossier de travail (voir dossierConfig).
    OPENCODE_CONFIG_DIR: dossierConfig(),
    /*
     * Rien vers l'extérieur, et rien d'autre que la configuration de Helix.
     *
     * OpenCode télécharge à chaque démarrage la liste des modèles de
     * models.dev — vérifié : il a appelé un faux serveur mis à sa place.
     * C'est un service tiers contacté sans que personne l'ait décidé, sur
     * un produit qui promet le contraire. Il sait aussi se mettre à jour
     * seul, publier une conversation en lien public, télécharger des
     * serveurs de langage, et lire la configuration personnelle de Claude
     * Code et d'autres outils présents sur le poste : autant de choses
     * qu'un agent de code d'entreprise n'a pas à faire dans le dos de la
     * personne. Vérifié : avec ces réglages, il répond normalement et
     * n'appelle plus rien.
     */
    OPENCODE_DISABLE_MODELS_FETCH: "true",
    OPENCODE_DISABLE_AUTOUPDATE: "true",
    OPENCODE_DISABLE_SHARE: "true",
    OPENCODE_DISABLE_LSP_DOWNLOAD: "true",
    OPENCODE_DISABLE_CLAUDE_CODE: "true",
    OPENCODE_DISABLE_EXTERNAL_SKILLS: "true",
    /*
     * Aucun réglage venu du projet (test d'intrusion du 27/09/2026). Sans
     * cette variable, OpenCode lit les `opencode.json` du dossier du projet
     * (jusqu'à la racine du dépôt) et ses dossiers `.opencode` : greffons
     * `plugin/*.js`, agents, commandes, serveurs MCP. Lu dans son code
     * 1.18.32 (`ConfigPaths.directories`) et essayé avec le vrai OpenCode,
     * dossier personnel jetable, aucun modèle : un dépôt cloné qui porte
     * `.opencode/plugin/x.js` faisait exécuter ce fichier dès l'ouverture
     * d'une session dans le projet, sans carte ; son `opencode.json` donnait
     * `"*": "allow"` à l'agent `build`, par-dessus la barrière de Helix. Avec
     * elle, ni l'un ni l'autre (même essai). Contrepartie : les `AGENTS.md`
     * du projet ne sont plus lus par OpenCode.
     */
    OPENCODE_DISABLE_PROJECT_CONFIG: "true",
    /*
     * Ni les réglages globaux du compte (seconde tournée du 28/09/2026). Même
     * sans ceux du projet, OpenCode lit `~/.config/opencode` (`Global.Path.config`,
     * tiré de `XDG_CONFIG_HOME`) et `~/.opencode` (`Global.Path.home`, que
     * `OPENCODE_TEST_HOME` remplace), avant le dossier de Helix : lu dans
     * `ConfigPaths.directories` de son code 1.18.32. Essayé avec le vrai
     * OpenCode 1.18.32, dossier personnel jetable, aucun modèle : un
     * `~/.config/opencode/opencode.json` portant
     * `agent.build.permission = { bash: "allow", edit: "allow", external_directory: "allow" }`
     * ajoutait ces règles **après** celles de Helix dans les permissions de
     * l'agent `build` (`GET /agent`), et la dernière règle qui correspond
     * l'emporte : commandes et écritures sans carte, sortie du projet permise.
     * Un greffon `~/.opencode/plugin/*.js` s'exécutait à l'ouverture d'une
     * session. Ce sont les réglages de la personne pour son propre terminal ;
     * dans Helix Code, ils valaient pour chaque compte de l'instance, membres
     * compris, et défaisaient ce que l'écran promet. Deux dossiers vides, à
     * Helix : même essai, permissions de `build` = celles de Helix, greffon non
     * exécuté. Les commandes de l'agent retrouvent le vrai `XDG_CONFIG_HOME`
     * par le greffon d'environnement (`ecrireGreffonEnvironnement`).
     */
    XDG_CONFIG_HOME: dossierPrive("global"),
    OPENCODE_TEST_HOME: dossierPrive("maison"),
  };
}

/** Un dossier vide, à Helix, pour ce qu'OpenCode ne doit pas lire chez la personne (voir `environnementOpenCode`). */
function dossierPrive(nom: string): string {
  const dossier = join(dossierConfig(), "prive", nom);
  if (!existsSync(dossier)) mkdirSync(dossier, { recursive: true, mode: 0o700 });
  return dossier;
}

/**
 * Ce que les commandes de l'agent retrouvent à la place des deux dossiers
 * privés : le `XDG_CONFIG_HOME` de la personne (ou celui que tout programme
 * prendrait sans lui, `~/.config`), pour que git, npm ou pip lisent leurs
 * propres réglages comme dans un terminal.
 */
function variablesRendues(): Record<string, string> {
  return {
    XDG_CONFIG_HOME: process.env.XDG_CONFIG_HOME || join(homedir(), ".config"),
    OPENCODE_TEST_HOME: "",
  };
}

/**
 * La session de chauffe, lancée une fois à chaque démarrage d'OpenCode.
 *
 * ── Pourquoi ────────────────────────────────────────────────────────────────
 *
 * OpenCode (1.18.3, et encore 1.18.32) rate au hasard la **première** session
 * qu'il exécute après son démarrage : « Model unavailable », alors que le
 * modèle est bien là, et la session se tait pour toujours. Mesuré : 2 à 3
 * démarrages sur 10. Jamais les sessions suivantes : 21 sur 21 réussies sur un
 * serveur déjà chaud.
 *
 * On donne donc cette première exécution à une session jetable. Elle vise un
 * modèle qui n'existe pas : elle échoue tout de suite, **sans appeler aucun
 * modèle** ni rien coûter, et absorbe le démarrage à froid. Mesuré ensuite :
 * 30 démarrages sur 30 réussis, contre un raté sur dix pour le témoin au même
 * moment. Elle est supprimée aussitôt, pour ne pas encombrer la liste des
 * sessions de la personne si elle se sert aussi d'OpenCode directement.
 *
 * Le guet de l'écran Code (useCode.ts) reste en place derrière : si une
 * demande ne démarre pas en 12 secondes, il la relance dans une session neuve.
 * La chauffe évite l'attente ; le guet couvre ce qu'elle n'aurait pas prévu.
 *
 * Depuis le 25/09/2026, Helix Code passe par l'ancienne API d'OpenCode (voir
 * fluxCode.ts) : la chauffe aussi, pour chauffer le moteur qui servira.
 * Mesuré le même jour : sur un modèle inconnu, la session échoue en quelques
 * millisecondes (« Model not found »), sans appeler de modèle.
 */
async function chauffer(sur: number, dossier: string): Promise<void> {
  const base = `http://127.0.0.1:${sur}`;
  const entetes = { Authorization: enteteServeur(), "Content-Type": "application/json" };
  const d = `?directory=${encodeURIComponent(dossier)}`;
  try {
    const creation = await fetch(`${base}/session${d}`, {
      method: "POST",
      headers: entetes,
      body: "{}",
      signal: AbortSignal.timeout(5000),
    });
    const corps = (await creation.json().catch(() => ({}))) as { id?: string };
    const id = corps.id;
    if (!id) return;
    await fetch(`${base}/session/${encodeURIComponent(id)}/prompt_async${d}`, {
      method: "POST",
      headers: entetes,
      body: JSON.stringify({
        model: { providerID: "helix", modelID: "chauffe-helix-sans-modele" },
        parts: [{ type: "text", text: "chauffe" }],
      }),
      signal: AbortSignal.timeout(5000),
    }).catch(() => {});
    // Le temps que l'exécution échoue, comme prévu.
    await new Promise((r) => setTimeout(r, 1000));
    await fetch(`${base}/session/${encodeURIComponent(id)}?directory=${encodeURIComponent(dossier)}`, {
      method: "DELETE",
      headers: entetes,
      signal: AbortSignal.timeout(5000),
    }).catch(() => {});
  } catch {
    /* une chauffe ratée ne doit jamais empêcher de travailler */
  }
}

/** Démarre le serveur OpenCode s'il ne tourne pas déjà. */
export async function ensureServer(): Promise<number | null> {
  if (port && child && !child.killed) return port;
  if (starting) return starting;

  starting = (async () => {
    const binary = await locate();
    if (!binary) {
      lastError = "OpenCode n'est pas installé sur cette machine.";
      return null;
    }

    // OpenCode démarre dans le dossier de l'instance ; chaque session porte le sien (`?directory=`).
    const dir = dossierParDefaut();
    // RTK posé en arrière-plan s'il manque (rtk.ts) ; en attendant, les commandes partent sans lui.
    rtkEnFond();
    menageBases();
    await writeConfig(dir);

    /*
     * Un port que le système garantit libre, plutôt qu'un tirage au hasard
     * entre 4096 et 4596. Le tirage pouvait tomber sur un port occupé — 4096
     * est justement celui qu'OpenCode prend par défaut quand la personne s'en
     * sert elle-même : notre serveur échouait alors à démarrer, et la sonde
     * ci-dessous pouvait obtenir sa réponse de **l'autre** serveur, sans mot de
     * passe s'il n'en a pas, et y adosser l'écran Code.
     */
    const chosen = await portLibre();
    const proc = spawn(binary, ["serve", "--port", String(chosen), "--hostname", "127.0.0.1"], {
      cwd: dir,
      stdio: ["ignore", "pipe", "pipe"],
      // Une liste blanche, plus jamais tout `process.env` (voir `environnementOpenCode`).
      env: environnementOpenCode(),
    });

    proc.stdout?.on("data", (b: Buffer) => console.log("[opencode]", b.toString().trim()));
    proc.stderr?.on("data", (b: Buffer) => {
      const text = b.toString().trim();
      if (text) console.error("[opencode]", text);
    });
    let sorti = false;
    // 08/11/2026 : un refus de création du processus (Windows compris) émet
    // « error », pas forcément « exit ». Ne pas laisser la passerelle tomber.
    proc.on("error", (erreur) => {
      sorti = true;
      console.error("[opencode] lancement refusé :", erreur.message);
      if (child === proc) {
        child = null;
        port = null;
      }
    });
    proc.on("exit", (code) => {
      sorti = true;
      console.log(`[opencode] serveur arrêté (code ${code})`);
      // Seulement si c'est bien lui qui tournait : un ancien serveur arrêté
      // après un redémarrage ne doit pas faire oublier le nouveau.
      if (child === proc) {
        child = null;
        port = null;
      }
    });

    // Attend que le serveur réponde.
    for (let attempt = 0; attempt < 40; attempt++) {
      await new Promise((r) => setTimeout(r, 500));
      // Notre serveur est mort (port pris entre-temps, binaire cassé) : ce qui
      // répondrait sur ce port n'est pas lui.
      if (sorti) break;
      try {
        const res = await fetch(`http://127.0.0.1:${chosen}/global/health`, {
          // Depuis que le serveur exige un mot de passe, une sonde sans en-tête
          // reçoit 401 : le serveur serait déclaré « jamais prêt ».
          headers: { Authorization: enteteServeur() },
          signal: AbortSignal.timeout(1500),
        });
        const sante = res.ok ? await res.json().catch(() => null) as { healthy?: boolean } | null : null;
        if (res.ok && sante?.healthy === true) {
          await chauffer(chosen, dir);
          child = proc;
          port = chosen;
          lastError = undefined;
          console.log(`[opencode] prêt sur le port ${chosen} (projet : ${dir})`);
          return chosen;
        }
      } catch {
        /* pas encore prêt */
      }
    }

    arreterArbre(proc);
    lastError = "Le serveur OpenCode n'a pas démarré à temps.";
    return null;
  })();

  try {
    return await starting;
  } finally {
    // Une préparation refusée ne doit pas condamner les tentatives suivantes
    // à réutiliser indéfiniment la même promesse rejetée.
    starting = null;
  }
}

/**
 * Le serveur tourne-t-il **déjà** ?
 *
 * Constat pur : aucune recherche de binaire, aucun démarrage. C'est ce qui
 * permet à une route de lecture — le relais du flux d'évènements — de se
 * contenter de relayer. `status()` ne convient pas pour cela : elle appelle
 * `locate()`, qui peut lancer un processus de sonde.
 */
export function enMarche(): boolean {
  return Boolean(port && child && !child.killed);
}

/** Port du serveur en cours, ou `null` : distingue un OpenCode redémarré du précédent. */
export const portEnCours = (): number | null => (enMarche() ? port : null);

/** `userId` : le dossier rendu est celui de cette personne (séance présentée), sinon celui de l'instance. */
export async function status(userId?: string): Promise<CodeStatus> {
  const binary = await locate();
  const raison = opencodeInstallable();
  return {
    available: Boolean(binary),
    running: Boolean(port && child && !child.killed),
    projectDir: projectDir(userId),
    error: lastError,
    installable: raison === null,
    ...(raison ? { raisonNonInstallable: raison } : {}),
    installation: etatInstallationOpencode(),
    installationAuto: autoProvisionEnabled(),
  };
}

/** Ce qu'a décidé `opencodeEnFond`, pour le journal et pour la batterie de sécurité. */
export type VerdictOpencodeEnFond = "profil" | "non-publie" | "en-cours" | "present" | "lancee";

/**
 * OpenCode posé de lui-même, en arrière-plan, sans clic.
 *
 * Demandé par Medhi le 27/09/2026, après l'avoir vu sur un PC Windows : le
 * bouton « Installer OpenCode » de l'écran Code restait une étape à franchir,
 * alors que « tout s'installe seul ». Même règle que la dictée (`dicteeEnFond`,
 * index.ts) : appelé au démarrage de la passerelle et après la mise en route
 * du modèle ; un échec (hors ligne) ne bloque rien, il reste dans
 * `etatInstallationOpencode()` et l'écran Code le montre, avec « Réessayer ».
 *
 * Rien n'est fait :
 * - si le profil de déploiement réserve les installations à l'intégrateur
 *   (`autoProvision: false`) : il fixe son OpenCode par `HELIX_OPENCODE_BIN` ;
 * - si Helix ne sait pas le poser ici (système sans archive épinglée) ;
 * - si un OpenCode existe déjà (celui de Helix, celui de la machine, ou celui
 *   que désigne `HELIX_OPENCODE_BIN`) : on n'en ajoute pas un second.
 *
 * Un poste rattaché à une instance distante n'est pas concerné : il ne lance
 * aucune passerelle locale (electron/main.cjs, `posteRattache`). C'est
 * l'instance qui pose OpenCode, chez elle.
 */
export async function opencodeEnFond(): Promise<VerdictOpencodeEnFond> {
  if (!autoProvisionEnabled()) return "profil";
  if (opencodeInstallable() !== null) return "non-publie";
  if (etatInstallationOpencode().enCours) return "en-cours";
  if (await locate()) return "present";
  console.log("[helix] Installation d'OpenCode en arrière-plan.");
  void installerOpencode()
    .then(() => oublierOpencode())
    .catch((err: unknown) => console.warn(`[helix] OpenCode non installé : ${err instanceof Error ? err.message : String(err)}`));
  return "lancee";
}

export function stopServer(): void {
  arreterArbre(child);
  child = null;
  port = null;
}

/**
 * S'assure que le serveur OpenCode connaît ce modèle, et le redémarre sinon.
 *
 * OpenCode ne lit sa configuration qu'à son démarrage. Helix l'écrit à ce
 * moment-là avec les modèles que la machine sert — et si LM Studio n'était pas
 * encore prêt, ou si un modèle a été téléchargé depuis, la liste est courte.
 * Le serveur refusait alors tout prompt : « Model unavailable: helix/qwen3-8b »
 * dans son journal, et rien du tout à l'écran. Observé sur le poste du client
 * le 22/09/2026, cinq fois depuis le 20. On réécrit donc la configuration et
 * on relance le serveur avant d'ouvrir une session sur un modèle qu'il ignore.
 */
export async function assurerModele(id: string): Promise<boolean> {
  if (port && child && !child.killed && !modelesEcrits.has(id)) {
    console.log(`[opencode] modèle « ${id} » absent de la configuration lue : redémarrage du serveur.`);
    stopServer();
  }
  if (!(await ensureServer())) return false;

  /*
   * Puis on le lui demande. Ouvrir une session sur un modèle qu'OpenCode ne
   * connaît pas ne produit **aucune** erreur visible : le prompt est accepté,
   * son flux annonce « admis », puis se tait pour toujours — l'échec ne part
   * que dans le journal d'OpenCode. Reproduit le 23/09/2026. C'était le
   * « je demande mais rien ne se passe » de l'écran Code. Mieux vaut refuser
   * la session avec une raison que l'ouvrir sur un silence.
   */
  let absenceConfirmee = false;
  try {
    const reponse = await api("/config/providers");
    if (!reponse.ok) return true; // on ne sait pas vérifier : on ne bloque pas
    const corps = (await reponse.json()) as {
      providers?: { id: string; models?: Record<string, unknown> }[];
    };
    const helix = corps.providers?.find((p) => p.id === "helix");
    if (helix?.models && Object.hasOwn(helix.models, id)) return true;
    // 08/11/2026 : le registre écrit ne prouve pas que le processus l'a lu.
    // Un seul redémarrage correctif, puis vérification effective, sans changer de modèle.
    absenceConfirmee = true;
    stopServer();
    if (!(await ensureServer())) return false;
    const relue = await api("/config/providers");
    if (!relue.ok) return false;
    const nouveau = await relue.json() as { providers?: { id: string; models?: Record<string, unknown> }[] };
    const fournisseur = nouveau.providers?.find((p) => p.id === "helix");
    return Boolean(fournisseur?.models && Object.hasOwn(fournisseur.models, id));
  } catch {
    return !absenceConfirmee;
  }
}

/** Anciens noms de niveaux, encore dans les préférences de certains postes. */
const ANCIENS_NIVEAUX: Record<string, string> = { rapide: "faible", auto: "moyen", approfondi: "eleve" };

/**
 * La variante OpenCode d'un niveau de raisonnement (voir `writeConfig`) : le
 * niveau lui-même s'il est connu, aucune sinon. Jamais un nom inventé : une
 * variante inconnue fait taire la session.
 */
export function varianteDe(effort?: string): string | undefined {
  const niveau = effort ? (ANCIENS_NIVEAUX[effort] ?? effort) : undefined;
  return niveau && niveau in NIVEAUX_EFFORT ? niveau : undefined;
}

/**
 * Modèle et variante d'une demande, au format de l'ancienne API d'OpenCode :
 * toujours le fournisseur de l'instance. Ils partent avec chaque demande
 * (`prompt_async`) ; la nouvelle API les fixait sur la session.
 */
export function refModele(
  id: string,
  variante?: string,
): { model: { providerID: string; modelID: string }; variant?: string; agent?: string } {
  // Un petit modèle : l'agent aux consignes courtes et aux outils essentiels (petitsModeles.ts).
  return { model: { providerID: "helix", modelID: id }, ...(variante ? { variant: variante } : {}), ...agentPourModele(id) };
}

/** Un port TCP libre sur la boucle locale, attribué par le système. */
function portLibre(): Promise<number> {
  return new Promise((resolve, reject) => {
    const serveur = createServer();
    serveur.unref();
    serveur.on("error", reject);
    serveur.listen(0, "127.0.0.1", () => {
      const adresse = serveur.address();
      const numero = typeof adresse === "object" && adresse ? adresse.port : 0;
      serveur.close(() => (numero ? resolve(numero) : reject(new Error("aucun port libre"))));
    });
  });
}

/**
 * Ouvre le flux d'événements de l'ancienne API pour un dossier (`/event`),
 * **sans délai d'inactivité**. C'est fluxCode.ts qui le lit et le traduit.
 *
 * `fetch` (undici) coupe une réponse qui ne reçoit rien pendant cinq minutes :
 * mesuré le 23/09/2026 sur le flux d'une session, fermé à 301 s pile, et
 * l'écran perdait son abonnement sans le savoir. `http.request` n'a pas ce
 * délai.
 */
export async function fluxEvenements(dossier: string): Promise<http.IncomingMessage> {
  const actif = await ensureServer();
  if (!actif) throw new Error(lastError ?? "OpenCode indisponible.");
  return new Promise((resolve, reject) => {
    const requete = http.request(
      {
        host: "127.0.0.1",
        port: actif,
        path: `/event?directory=${encodeURIComponent(dossier)}`,
        headers: { Authorization: enteteServeur(), Accept: "text/event-stream" },
      },
      resolve,
    );
    requete.on("error", reject);
    requete.end();
  });
}

/*
 * Identifiant de message au format d'OpenCode (`msg_` + 12 chiffres
 * hexadécimaux de temps + 14 caractères au hasard), croissant comme les
 * siens : OpenCode range les messages d'une session par identifiant, un nom
 * pris au hasard pouvait donc passer avant les messages précédents. Recopié de
 * packages/opencode/src/id/id.ts à la révision v1.18.32. La passerelle le
 * choisit elle-même pour le rendre aux clients à l'envoi : ils reconnaissent
 * ainsi dans le flux les évènements de LEUR demande (`session.next.prompted`).
 */
let dernierInstant = 0;
let compteur = 0;
export function idMessage(): string {
  const maintenant = Date.now();
  if (maintenant !== dernierInstant) {
    dernierInstant = maintenant;
    compteur = 0;
  }
  compteur++;
  const valeur = BigInt(maintenant) * 0x1000n + BigInt(compteur);
  const temps = Buffer.alloc(6);
  for (let i = 0; i < 6; i++) temps[i] = Number((valeur >> BigInt(40 - 8 * i)) & 0xffn);
  const signes = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
  // Sans biais (`randomInt`, pas `octet % 62`).
  const hasard = Array.from({ length: 14 }, () => signes[randomInt(62)]).join("");
  return `msg_${temps.toString("hex")}${hasard}`;
}

/** Appelle l'API OpenCode, en démarrant le serveur au besoin. */
export async function api(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const active = await ensureServer();
  if (!active) throw new Error(lastError ?? "OpenCode indisponible.");
  // On complète les en-têtes de l'appelant plutôt que de les remplacer : le
  // « Content-Type » des routes POST doit survivre.
  const entetes = new Headers(init?.headers);
  entetes.set("Authorization", enteteServeur());
  return fetch(`http://127.0.0.1:${active}${path}`, { ...init, headers: entetes });
}

/* ------------------------- choix du dossier de travail ------------------------ */

/**
 * Dernier dossier choisi par chaque personne pour une nouvelle session de
 * Code (voir `projectDir`). En mémoire : après un redémarrage, la dernière
 * session de la personne le redonne (index.ts, `dossierCodeDe`).
 */
const dossiersChoisis = new Map<string, string>();

/**
 * Emplacements qu'un dossier de travail ne peut jamais désigner.
 *
 * Ce ne sont pas des endroits où une entreprise range ses documents : ce sont
 * les organes du système. Y lâcher un agent ne rendrait service à personne et
 * suffirait à rendre la machine inutilisable. Tout le reste est permis, y
 * compris hors du dossier personnel.
 */
/**
 * Tout le poste, sauf ce qui appartient au système.
 *
 * Cowork doit pouvoir travailler là où sont les documents de la personne, et
 * pas seulement dans un dossier désigné : c'est la demande, et elle est juste.
 * Un assistant qui ne peut pas ouvrir le fichier qu'on lui montre ne sert à
 * rien.
 *
 * On rend donc le dossier personnel **et** les points de montage — une clé
 * USB, un disque externe, un partage réseau ne sont pas dans le dossier
 * personnel, et personne n'a à comprendre pourquoi.
 *
 * Ce qui reste fermé, et ne s'ouvrira pas par un réglage : les organes du
 * système (`INTERDITS`). Un agent n'a aucune raison d'écrire dans `/System` ou
 * `/usr`, et une erreur y est irréparable. La barrière qui compte vraiment
 * n'est pas celle-ci de toute façon : c'est la barrière d'approbation
 * (approbation.ts), qui demande avant chaque modification.
 */
export function toutLePoste(): string[] {
  const lieux = [homedir()];
  /*
   * Points de montage, selon le système. Seuls ceux qui existent sont ouverts :
   * un chemin inexistant fait refuser le serveur de fichiers au démarrage.
   * `/run/media` : là où Fedora et Arch montent une clé USB. Sous Windows, les
   * autres disques (D:, E:…), comme `/Volumes` sur macOS ; pas celui du système.
   */
  const disques =
    process.platform === "win32"
      ? "DEFGHIJKLMNOPQRSTUVWXYZ".split("").map((l) => `${l}:\\`).filter((d) => d.toUpperCase() !== `${(process.env.SystemDrive ?? "C:").toUpperCase()}\\`)
      : ["/Volumes", "/media", "/mnt", "/run/media"];
  for (const montage of disques) {
    try {
      if (statSync(montage).isDirectory()) lieux.push(montage);
    } catch {
      /* absent sur ce système */
    }
  }
  return lieux;
}

/*
 * Selon le système (audit Windows et Linux du 27/09/2026 : la liste ne
 * connaissait que macOS, et `C:\Windows` ou `/etc` passaient). Sous Linux,
 * pas `/var` entier ni `/opt` ni `/srv` : on y range parfois des projets
 * (`/var/www`) ; leurs parties du système, si.
 */
const INTERDITS =
  process.platform === "win32"
    ? (() => {
        const disque = process.env.SystemDrive ?? "C:";
        return [
          process.env.SystemRoot ?? `${disque}\\Windows`,
          process.env.ProgramFiles ?? `${disque}\\Program Files`,
          process.env["ProgramFiles(x86)"] ?? `${disque}\\Program Files (x86)`,
          process.env.ProgramData ?? `${disque}\\ProgramData`,
          `${disque}\\$Recycle.Bin`,
          `${disque}\\System Volume Information`,
          `${disque}\\Recovery`,
        ];
      })()
    : process.platform === "linux"
      ? ["/bin", "/sbin", "/usr", "/lib", "/lib32", "/lib64", "/libx32", "/etc", "/boot", "/dev", "/proc", "/sys", "/run", "/root", "/snap", "/var/lib", "/var/log", "/var/cache", "/var/spool", "/var/db", "/var/run"]
      : ["/System", "/usr", "/bin", "/sbin", "/private/etc", "/private/var/db", "/Library/Security", "/Applications"];

/** Chemin réel, noms courts de Windows développés (`realpathSync` en JavaScript ne le fait pas). */
const cheminReelNatif = (p: string) => (process.platform === "win32" ? realpathSync.native(p) : realpathSync(p));

/**
 * Forme repliée d'un chemin, pour comparer à la liste des interdits.
 *
 * `realpath` résout les liens symboliques mais ne corrige pas la casse : sur un
 * système de fichiers insensible à la casse — celui de macOS par défaut, et
 * celui de Windows —, `realpath("/system")` rend « /system », qui ne
 * correspondait à aucune entrée de la liste alors qu'il désigne bien `/System`.
 * « /private/ETC » et « /USR » passaient de la même façon. La comparaison se
 * fait donc sur une forme repliée, jamais sur la chaîne telle qu'elle a été
 * saisie.
 *
 * `toLowerCase` et non `toLocaleLowerCase` : le repli ne doit pas dépendre de
 * la langue du poste.
 */
const replier = (chemin: string) => chemin.normalize("NFC").toLowerCase();

/**
 * Valide un dossier proposé par l'interface.
 *
 * Le périmètre était borné au dossier personnel. C'était trop serré : les
 * documents d'une PME vivent souvent sur un disque externe ou un partage
 * réseau, et refuser ces emplacements revenait à refuser le cas d'usage. La
 * personne désigne son dossier elle-même, par le sélecteur du système ; c'est
 * elle qui décide, pas nous.
 *
 * Ce qui reste interdit tient en deux points : les organes du système, et les
 * chemins atteints par un lien symbolique qui les contourne. On résout donc
 * les liens avant de comparer, sinon un lien suffirait à désigner `/etc`.
 *
 * Cette barrière borne le CHOIX de la personne. Une fois le dossier fixé,
 * l'agent, lui, ne sort plus de ce dossier : c'est le serveur de fichiers qui
 * l'y tient.
 */
/**
 * Pour quoi le dossier est demandé.
 *  - `code` (défaut) : dossier de projet de Helix Code, dont l'agent lance des
 *    commandes avec les droits du compte. Revue du 25/09/2026 : le dossier
 *    personnel lui-même était accepté, et il contient `~/.helix/data`. Refusés
 *    désormais : le dossier personnel, et tout dossier qui est une zone
 *    protégée (zonesProtegees.ts : données de l'instance, `~/.helix`, clés,
 *    réglages d'autres logiciels) ou qui en contient une.
 *  - `cowork` : espace de travail de Cowork (serveur de fichiers, tenu par la
 *    barrière d'approbation) : le dossier personnel reste permis (« Tout mon
 *    poste » l'ouvre de toute façon), l'intérieur des données de l'instance non.
 *  - `parcours` : seulement parcourir, pour choisir (sélecteur de dossier).
 */
export type UsageDossier = "code" | "cowork" | "parcours";

export function validerDossier(chemin: string, usage: UsageDossier = "code"): { ok: true; chemin: string } | { ok: false; raison: string } {
  let resolu: string;
  try {
    resolu = cheminReelNatif(chemin);
  } catch {
    return { ok: false, raison: t("Ce dossier n'existe pas.") };
  }

  try {
    if (!statSync(resolu).isDirectory()) {
      return { ok: false, raison: t("Ce chemin n'est pas un dossier.") };
    }
  } catch {
    return { ok: false, raison: t("Ce dossier n'est pas lisible.") };
  }

  // La racine du disque contient tout : la désigner reviendrait à ne rien borner (`/`, `C:\`, `\\serveur\partage\`).
  if (resolu === "/" || parse(resolu).root === resolu) {
    return {
      ok: false,
      raison: t("Choisissez un dossier précis plutôt que la racine du disque."),
    };
  }

  const cible = replier(resolu);
  /*
   * Linux : les clés USB (`/run/media/<compte>`, Fedora, Arch) et les partages
   * montés par GNOME (`/run/user/<uid>/gvfs`) vivent sous `/run`, qui reste
   * interdit pour le reste (audit Linux du 27/09/2026).
   */
  const montageLinux = process.platform === "linux" && (/^\/run\/media\/[^/]+\/./.test(resolu) || /^\/run\/user\/\d+\/gvfs\/./.test(resolu));
  for (const interdit of montageLinux ? INTERDITS.filter((i) => i !== "/run") : INTERDITS) {
    const organe = replier(interdit);

    // Le dossier EST un organe du système, ou se trouve à l'intérieur.
    if (cible === organe || cible.startsWith(organe + sep)) {
      return {
        ok: false,
        raison: t(
          "Ce dossier appartient au système. Choisissez un dossier de documents, de projets ou de travail.",
        ),
      };
    }

    /*
     * Le dossier CONTIENT un organe du système. Refuser « /private/etc » sans
     * refuser « /private » ne protégeait rien : l'agent lâché sur le parent y
     * descend au premier appel. Même raisonnement que pour la racine du disque,
     * appliqué à chaque interdit.
     */
    if (organe.startsWith(cible.endsWith(sep) ? cible : cible + sep)) {
      return {
        ok: false,
        raison: tf(
          "Ce dossier est trop large : il contient {0}, qui appartient au système. Choisissez un dossier de documents, de projets ou de travail.",
          interdit,
        ),
      };
    }
  }

  if (usage !== "parcours") {
    if (estProtege(resolu)) {
      return { ok: false, raison: t("Ce dossier est protégé (données de l'instance, clés, réglages d'autres logiciels). Choisissez un dossier de documents, de projets ou de travail.") };
    }
    if (usage === "code" && contientUneZone(resolu)) {
      return {
        ok: false,
        raison: t("Ce dossier est trop large : il contient des dossiers protégés (données de l'instance, clés) que l'agent de code pourrait lire. Choisissez le dossier d'un projet."),
      };
    }
    if (usage === "code") {
      let maison = homedir();
      try {
        maison = cheminReelNatif(maison);
      } catch {
        /* dossier personnel introuvable : comparé tel quel */
      }
      if (cible === replier(maison)) {
        return { ok: false, raison: t("Choisissez le dossier d'un projet plutôt que votre dossier personnel entier.") };
      }
    }
  }

  return { ok: true, chemin: resolu };
}

/** Retient le dossier choisi par cette personne. `null` revient au dossier de l'instance. */
export function setProjectDir(userId: string, chemin: string | null): void {
  if (chemin) dossiersChoisis.set(userId, chemin);
  else dossiersChoisis.delete(userId);
}

/**
 * Sous-dossiers d'un chemin, pour que l'interface puisse le parcourir.
 * Les dossiers cachés sont écartés : ils n'intéressent personne ici et
 * encombrent la liste.
 */
export interface Raccourci {
  nom: string;
  chemin: string;
}

/** Emplacements usuels, filtrés sur ce qui existe réellement sur ce poste. */
function raccourcis(): Raccourci[] {
  const maison = homedir();
  const candidats: Raccourci[] = [
    { nom: "Dossier personnel", chemin: maison },
    { nom: "Bureau", chemin: join(maison, "Desktop") },
    { nom: "Documents", chemin: join(maison, "Documents") },
    { nom: "Téléchargements", chemin: join(maison, "Downloads") },
    { nom: "Disques externes", chemin: "/Volumes" },
  ];
  return candidats.filter((c) => {
    try {
      return statSync(c.chemin).isDirectory();
    } catch {
      return false;
    }
  });
}

export function listerDossiers(chemin: string): {
  chemin: string;
  parent: string | null;
  dossiers: string[];
  raccourcis: Raccourci[];
} {
  const verdict = validerDossier(chemin, "parcours");
  const base = verdict.ok ? verdict.chemin : realpathSync(homedir());

  let dossiers: string[] = [];
  try {
    dossiers = readdirSync(base, { withFileTypes: true })
      .filter((e) => e.isDirectory() && !e.name.startsWith("."))
      .map((e) => e.name)
      .sort((a, b) => a.localeCompare(b, "fr"))
      .slice(0, 500);
  } catch {
    /* dossier illisible : on renvoie une liste vide plutôt qu'une erreur */
  }

  return {
    chemin: base,
    // On remonte jusqu'à la racine : s'arrêter au dossier personnel empêchait
    // d'atteindre un disque externe monté sous « /Volumes ».
    parent: base === "/" ? null : dirname(base),
    dossiers,
    // Raccourcis vers les endroits où l'on range vraiment ses documents, pour
    // éviter d'avoir à remonter le chemin dossier par dossier.
    raccourcis: raccourcis(),
  };
}
