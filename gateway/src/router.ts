import { discover, backendById } from "./backends.ts";
import { pinnedModel } from "./deployment.ts";
import { moteurDeLaMachine, type BackendConfig, type ModelInfo, type Role } from "./types.ts";
// Ces refus s'affichent tels quels dans le Chat : ils suivent la langue de la personne.
import { t, tf } from "./langue.ts";
import { estDefaillant } from "./santeModeles.ts";

/**
 * Un modèle local qui a mal répondu sur cette machine (santeModeles.ts,
 * 27/09/2026) n'est plus choisi d'office, tant qu'il en reste un autre. S'il
 * n'y a que lui, on le garde : une réponse coupée et dite vaut mieux que
 * « aucun modèle ».
 */
function sansDefaillants(list: ModelInfo[]): ModelInfo[] {
  const sains = list.filter((m) => !(moteurDeLaMachine(m.backendKind) && estDefaillant(m.id)));
  return sains.length > 0 ? sains : list;
}

/** Cache court : évite d'interroger les backends à chaque message. */
const TTL_MS = 5000;
let cache: { at: number; models: ModelInfo[] } | null = null;

export async function models(force = false): Promise<ModelInfo[]> {
  if (!force && cache && Date.now() - cache.at < TTL_MS) return cache.models;
  const { models } = await discover();
  cache = { at: Date.now(), models };
  return models;
}

export function invalidate(): void {
  cache = null;
}

export interface Resolution {
  model: ModelInfo;
  backend: BackendConfig;
}

/**
 * Résout la cible d'une requête (ADR-001).
 * Priorité : modèle explicite (uid puis identifiant brut), sinon meilleur
 * modèle du rôle demandé. Un modèle déjà chargé est préféré (évite un
 * chargement à froid), puis le backend le plus prioritaire.
 */
export async function resolve(opts: {
  model?: string;
  role?: Role;
  /**
   * Compte au nom duquel on demande (celui d'un employé : son propriétaire).
   * Un modèle branché par une clé personnelle n'est servi qu'à ce compte.
   */
  acces?: string;
  /**
   * Requête sans séance : la passerelle sait que la machine a le droit de
   * parler, pas qui parle. Les modèles branchés par clé sont alors écartés —
   * y compris ceux de portée « équipe ». Ils se facturent à l'entreprise, et
   * une dépense doit avoir un nom en face. Les modèles locaux et ceux de
   * l'instance restent servis : c'est tout l'intérêt de l'API compatible.
   */
  anonyme?: boolean;
  /**
   * La demande contient une image. Sans modèle imposé, elle doit aller à un
   * modèle qui sait la lire : l'envoyer à un modèle de texte ne produit pas
   * d'erreur, il répond à côté — « je n'ai pas l'information » — ce qui est
   * pire qu'un refus.
   */
  images?: boolean;
}): Promise<Resolution | { error: string }> {
  const all = (await models())
    .filter((m) => !m.proprietaire || m.proprietaire === opts.acces)
    .filter((m) => !(opts.anonyme && m.origine === "cle"));
  if (all.length === 0) {
    return {
      error: t(
        "Aucun modèle disponible. Vérifiez que LM Studio est démarré (serveur local) ou que le cluster exo est joignable.",
      ),
    };
  }

  let candidate: ModelInfo | undefined;

  if (opts.model) {
    candidate =
      all.find((m) => m.uid === opts.model) ??
      all.find((m) => m.id === opts.model);
    if (!candidate) {
      return { error: tf("Modèle inconnu ou réservé à la personne qui a branché sa clé : {0}", opts.model) };
    }
  } else {
    const role: Role = opts.role ?? "chat";

    // Le profil de déploiement client prime sur toute détection automatique.
    const pinned = pinnedModel(role);
    if (pinned) {
      candidate = all.find((m) => m.uid === pinned) ?? all.find((m) => m.id === pinned);
      if (!candidate) {
        return {
          error: tf("Le modèle « {0} », imposé pour le rôle « {1} » par le profil de déploiement, n'est pas disponible.", pinned, role),
        };
      }
    } else {
      /*
       * Un modèle cloud branché par une clé coûte à quelqu'un : il n'est jamais
       * choisi d'office. Un modèle entraîné ici non plus : 1,7 milliard de
       * paramètres appris sur les faits d'un projet ; chargé, il passait
       * devant le modèle de conversation (vu le 25/09/2026, il devenait le
       * choix « Rapide » du sélecteur).
       */
      let eligible = sansDefaillants(all.filter((m) => m.roles.includes(role) && m.origine !== "cle" && !m.entraine));
      // 02/11/2026 : un modèle de Chat local reste utilisable dans Code même si son
      // nom ne contient pas « coder ». Le profil imposé et les clés payantes gardent leurs règles.
      if (role === "code" && eligible.length === 0) eligible = sansDefaillants(all.filter(m => m.roles.includes("chat") && m.origine !== "cle" && !m.entraine));
      if (eligible.length === 0) {
        /*
         * Des modèles branchés par clé, mais rien d'autre : le mode Auto ne les
         * prendra jamais (ci-dessus). Le dire, et nommer celui qu'on peut
         * choisir, plutôt que « aucun modèle » à quelqu'un qui en voit dans son
         * sélecteur (27/09/2026, parcours d'une personne qui n'a qu'une clé).
         */
        const parCle = all.find((m) => (m.roles.includes(role) || (role === "code" && m.roles.includes("chat"))) && m.origine === "cle");
        if (parCle) {
          return {
            error: tf(
              "Le mode Auto ne choisit jamais un modèle branché par une clé : il est facturé à quelqu'un. Choisissez-le dans le sélecteur de modèle (par exemple {0}), ou installez un modèle sur cette machine.",
              parCle.id,
            ),
          };
        }
        return { error: tf("Aucun modèle disponible pour le rôle « {0} ».", role) };
      }
      // 04/11/2026 : revenir au Chat après Code ne doit pas garder le Coder
      // uniquement parce qu’il est déjà chargé. On reste sur le même moteur,
      // sans changer de fournisseur ni ignorer un modèle choisi explicitement.
      if (role === "chat") {
        const moteur = pickBest(eligible).backendId;
        const generalistes = eligible.filter(m => m.backendId === moteur && !/coder|codestral|devstral|starcoder/i.test(m.id));
        if (generalistes.length) eligible = generalistes;
      }
      candidate = pickBest(eligible);

      /*
       * Une image : on cherche parmi les modèles qui voient. S'il n'y en a
       * aucun, on garde le choix ordinaire — la passerelle prévient alors la
       * personne (chat.ts) au lieu de faire semblant.
       */
      if (opts.images && !peutVoir(candidate)) {
        const voyants = sansDefaillants(all.filter((m) => peutVoir(m) && m.origine !== "cle"));
        if (voyants.length > 0) candidate = voyantLePlusProche(voyants);
      }
    }
  }

  const backend = backendById(candidate.backendId);
  if (!backend) return { error: tf("Backend introuvable : {0}", candidate.backendId) };
  return { model: candidate, backend };
}

export const peutVoir = (m: ModelInfo) => m.roles.includes("vision") || m.roles.includes("gui");

/**
 * Le modèle de vision à retenir : un déjà chargé d'abord, sinon le plus léger.
 *
 * Le plus léger, et pas le meilleur : il faut le charger avant de répondre, et
 * la personne attend. Lire une capture d'écran de réglages ne demande pas le
 * plus gros modèle de la machine ; quelques secondes de chargement de moins,
 * si.
 */
function voyantLePlusProche(list: ModelInfo[]): ModelInfo {
  const charges = list.filter((m) => m.loaded);
  if (charges.length > 0) return pickBest(charges);
  /*
   * Parmi ceux qu'il faut charger : d'abord ceux qui savent appeler des
   * outils — le Chat leur en propose, et un modèle qui ne sait pas s'en
   * servir écrit parfois l'appel en toutes lettres au lieu de répondre —,
   * puis le plus léger.
   */
  return [...list].sort(
    (a, b) =>
      Number(b.outils === true) - Number(a.outils === true) ||
      (a.sizeBytes ?? Infinity) - (b.sizeBytes ?? Infinity),
  )[0]!;
}

function pickBest(list: ModelInfo[]): ModelInfo {
  const score = (m: ModelInfo) => {
    const backend = backendById(m.backendId);
    // Un modèle chargé économise un chargement à froid ; sinon on suit la priorité.
    return (m.loaded ? 0 : 100) + (backend?.priority ?? 50);
  };
  return [...list].sort((a, b) => score(a) - score(b))[0];
}
