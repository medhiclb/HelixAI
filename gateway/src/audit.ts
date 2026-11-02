import { createHmac, randomBytes } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, unlinkSync } from "node:fs";
import { join, basename } from "node:path";
import { homedir } from "node:os";
import { deployment } from "./deployment.ts";
import { cleDonnees } from "./secret.ts";
import { t } from "./langue.ts";

/**
 * Journal d'audit.
 *
 * Après un incident, la première question est « qui a fait quoi, et quand ». Un
 * historique en mémoire n'y répond pas : il disparaît au redémarrage, c'est-à-
 * dire précisément quand on en aurait besoin.
 *
 * Chaque évènement est écrit sur disque, une ligne JSON par évènement, et
 * **chaîné au précédent par une empreinte**. Retirer une ligne, en modifier une
 * ou en insérer une casse la chaîne, et `verifier()` le signale.
 *
 * ⚠ Le journal est *inviolable à la lecture*, pas *inviolable tout court* :
 * quelqu'un qui a accès au disque peut supprimer le fichier entier. La chaîne
 * rend la falsification détectable, elle n'empêche pas la destruction. Pour un
 * client soumis à un audit, recopier le journal vers un stockage distinct.
 */

export type AuditAction =
  | "connexion.reussie"
  | "connexion.refusee"
  | "connexion.bloquee"
  /** Mot de passe juste, code encore attendu : la séance n'est pas ouverte. */
  | "connexion.second_facteur_demande"
  /** Instance qui impose le second facteur : mot de passe juste, activation attendue. */
  | "connexion.second_facteur_a_activer"
  /*
   * Second facteur. Le secret et les codes de secours ne figurent jamais dans
   * le journal ; seul le fait est consigné, et par qui il a été retiré.
   */
  | "deuxfacteurs.active"
  | "deuxfacteurs.desactive"
  | "deuxfacteurs.codes_regeneres"
  /** Export RGPD : qui, quand, et combien d'éléments. Jamais le contenu. */
  | "donnees.exportees"
  | "compte.cree"
  /**
   * Invitation d'un collègue : l'adresse invitée, et la date de péremption du
   * code. Jamais le code lui-même, qui vaut rattachement d'un poste.
   */
  | "compte.invite"
  | "seance.ouverte"
  | "seance.fermee"
  | "donnees.ecrites"
  | "ecran.demande"
  | "ecran.approuve"
  | "ecran.refuse"
  | "ecran.execute"
  /** Contrôle de l'écran activé ou désactivé depuis l'interface. */
  | "ecran.mode_modifie"
  | "machine.demarree"
  | "machine.arretee"
  | "machine.effacee"
  | "images.installees"
  | "images.desinstallees"
  | "images.creee"
  /* Entraînement d'un modèle sur ses propres exemples (entrainement.ts). */
  | "entrainement.installe"
  | "entrainement.desinstalle"
  | "entrainement.projet_cree"
  | "entrainement.projet_supprime"
  | "entrainement.paires_generees"
  | "entrainement.termine"
  | "entrainement.publie"
  | "entrainement.retire"
  | "import.logiciel"
  | "outil.appele"
  /*
   * Approbation des outils. La demande, la réponse et le niveau en vigueur sont
   * consignés séparément : après coup, « l'agent a écrit ce fichier » ne vaut
   * rien si l'on ne peut pas dire qui l'a autorisé, ni sous quel régime.
   */
  | "outil.demande"
  | "outil.approuve"
  | "outil.refuse"
  /** Un réglage de toute l'instance tenté par qui n'en est pas l'administrateur (index.ts). */
  | "reglage.refuse"
  | "approbation.niveau"
  /*
   * Connecteurs. Brancher un connecteur fait tourner un programme de plus sur
   * la machine de l'entreprise et ouvre aux agents un service extérieur : après
   * coup, il faut pouvoir dire qui l'a branché, quand, et avec quelle commande.
   * Le jeton d'accès, lui, ne figure jamais dans le journal.
   */
  | "connecteur.ajoute"
  | "connecteur.retire"
  /*
   * Google Drive et Slack (drive.ts, slack.ts). Qui a branché quel compte
   * Google ou quel espace Slack, qui l'a débranché, et quand le service a
   * refusé l'accès enregistré (jeton révoqué ou expiré). Aucun jeton, aucun nom
   * de fichier ni de salon, aucun contenu n'y figure.
   */
  | "drive.branche"
  | "drive.debranche"
  | "drive.acces_perdu"
  | "google.client_enregistre"
  | "google.client_efface"
  | "agenda_google.branche"
  | "agenda_google.debranche"
  | "agenda_google.acces_perdu"
  | "tache_programmee.creee"
  | "tache_programmee.supprimee"
  | "tache_programmee.executee"
  | "slack.branche"
  | "slack.debranche"
  | "slack.acces_perdu"
  /*
   * Connexions natives de 2026.928.2 (oauthNatif.ts, outilsNatifs.ts) : qui a
   * enregistré l'application d'un fournisseur, qui a branché ou débranché un
   * service, quand le service a refusé l'accès, et qu'une écriture ou une
   * publication a eu lieu (le service et l'outil, jamais le texte ni les jetons).
   */
  | "natif.application_enregistree"
  | "natif.application_effacee"
  | "natif.branche"
  | "natif.debranche"
  | "natif.acces_perdu"
  | "natif.publie"
  /*
   * Dictée. L'installation pose un logiciel et télécharge un modèle : il faut
   * pouvoir dire qui l'a demandée. Une transcription est consignée par sa
   * taille et sa durée, **jamais par son texte** : le journal ne garde pas de
   * contenu, et ce qu'on dicte en est un.
   */
  | "dictee.installee"
  /** Installation de LM Studio : qui a accepté ses conditions, et lesquelles. */
  | "moteur.conditions_acceptees"
  | "moteur.llamacpp_installation"
  /** Emplacement du moteur et des modèles choisi par l'administrateur (emplacementModeles.ts, 28/09/2026) : le dossier, l'ancien, un déplacement. */
  | "moteur.emplacement"
  | "moteur.choix_lmstudio"
  | "moteur.optimisation"
  | "code.opencode_installe"
  /*
   * Codex avec le compte ChatGPT du propriétaire (codex.ts, 27/09/2026) : qui
   * a lancé la connexion, et chaque tâche (dossier, bac à sable, reprise).
   * Jamais la demande elle-même : le journal ne garde pas de contenu.
   */
  | "code.codex_connexion"
  | "code.codex_tache"
  | "dictee.transcrite"
  /*
   * Tarif d'un modèle distant. C'est lui qui transforme des jetons en euros sur
   * l'écran de consommation : un tarif changé en silence changerait après coup
   * tous les coûts affichés. Il faut pouvoir dire qui l'a saisi, et ce qu'il
   * remplaçait.
   */
  | "tarif.modifie"
  | "motdepasse.redefini"
  | "motdepasse.defini"
  /*
   * Mot de passe oublié (23/10/2026) : réinitialisé par un administrateur
   * (écrit au nom du compte réinitialisé, l'administrateur dans le détail),
   * refusé pour un compte qui administre aussi, et codes de récupération
   * tirés. La redéfinition par l'application de bureau ou par un code de
   * récupération reste `motdepasse.redefini`, avec `par`. Jamais un mot de
   * passe ni un code dans le détail.
   */
  | "motdepasse.reinitialise"
  | "motdepasse.reinitialisation_refusee"
  | "recuperation.codes_crees"
  | "compte.supprime"
  /*
   * Clés d'API personnelles (clesApi.ts) : créée, renommée, révoquée, par qui,
   * avec son nom et ses quatre derniers caractères. Chaque appel fait avec une
   * clé est consigné sous `api.appel` : la route, le modèle demandé, l'issue,
   * jamais les messages ni la réponse. La clé elle-même n'y figure jamais.
   */
  | "cleapi.creee"
  | "cleapi.renommee"
  | "cleapi.revoquee"
  | "api.appel"
  /*
   * Identité du compte. L'adresse est un identifiant de connexion et une clé
   * de partage : après coup, il faut pouvoir dire qui portait quelle adresse,
   * et depuis quand. Une tentative refusée faute du bon mot de passe est
   * consignée aussi, c'est le signe d'une séance utilisée par un autre. Le mot
   * de passe, lui, n'y figure jamais.
   */
  | "compte.nom_modifie"
  | "compte.adresse_modifiee"
  | "compte.adresse_refusee"
  /** Photo de profil changée ou retirée (sa taille, jamais l'image). */
  | "compte.photo_modifiee"
  /*
   * Employés OpenClaw. Leurs appels d'outils sont consignés sous
   * `outil.appele`, au nom de « employe:<id> » ; ce qu'on leur dit n'y figure
   * jamais, seulement qu'un message a été traité et en combien de temps.
   */
  | "employe.deploye"
  | "employe.modifie"
  | "employe.supprime"
  | "employe.message"
  | "employe.mission_lancee"
  /** Un mail reçu confié à une mission « à chaque mail » : ni l'expéditeur ni le contenu, seulement l'issue. */
  | "employe.mission_courrier"
  | "courrier.envoye"
  /** Palier de liberté d'un employé changé (le passage à « libre » exige le mot de passe). */
  | "employe.liberte"
  /** Canaux des employés : quel canal, jamais les jetons ni les messages. */
  | "employe.canal_branche"
  | "employe.canal_retire"
  /**
   * Sa mémoire OpenClaw mise de côté et vidée avant que son audience
   * s'élargisse (ou l'étape qui a échoué), restaurée, ou une copie supprimée :
   * des nombres et des noms de réglages, jamais une note ni une conversation.
   */
  | "employe.memoire_videe"
  | "employe.memoire_non_videe"
  | "employe.memoire_restauree"
  | "employe.memoire_copie_supprimee"
  | "employe.whatsapp_lie"
  | "employe.acces_accepte"
  /** Outil propre à OpenClaw utilisé par un employé (recopié de son registre : l'outil et l'issue, pas le contenu). */
  | "employe.outil_openclaw"
  /** Documents de référence confiés à un agent : leur nom et leur taille, jamais leur contenu. */
  | "employe.document_ajoute"
  | "employe.document_retire"
  /** OpenClaw installé depuis l'interface (Node officiel vérifié, puis le paquet npm). */
  /** Groupes de l'équipe : qui les crée, les change, les quitte ; des nombres, pas de noms. */
  | "groupe.cree"
  | "groupe.modifie"
  | "groupe.quitte"
  | "groupe.supprime"
  /** Bibliothèque : ce qui entre, change de visibilité, part, et qui consulte le document d'un autre. */
  | "bibliotheque.dossier_cree"
  | "bibliotheque.importe"
  | "bibliotheque.modifie"
  | "bibliotheque.supprime"
  | "bibliotheque.consulte"
  /** Bases de connaissances : ce qui est créé, rattaché, retiré ; des identifiants et des nombres, jamais de texte. */
  | "connaissances.base_creee"
  /** « Effacer la mémoire de ce Chat » (memoireConversation.ts) : si elle existait, jamais son contenu. */
  | "memoire.chat_effacee"
  | "connaissances.base_modifiee"
  | "connaissances.base_supprimee"
  | "connaissances.documents_ajoutes"
  | "connaissances.document_retire"
  /** Réunions : ce qui est enregistré, transcrit, partagé, supprimé ; jamais ce qui s'y dit. */
  | "reunion.creee"
  | "reunion.bot_envoye"
  | "reunion.bot_echec"
  | "reunion.bot_auto"
  | "reunion.transcrite"
  | "reunion.partagee"
  | "reunion.consultee"
  | "reunion.supprimee"
  | "openclaw.installe"
  | "openclaw.mis_a_jour"
  | "openclaw.installation_echouee"
  /** Windows : le paquet Visual C++ de Microsoft installé pour OpenClaw (version, redémarrage conseillé), ou son échec (29/09/2026). */
  | "visual_cpp.installe"
  | "visual_cpp.echec"
  /** Clés de modèles cloud : quel fournisseur, pour qui, jamais la clé. */
  | "fournisseur.ajoute"
  | "fournisseur.modifie"
  | "fournisseur.retire";

export interface AuditEntry {
  /** Horodatage ISO, en temps universel. */
  quand: string;
  action: AuditAction;
  /** Qui : identifiant de compte, ou « anonyme » avant authentification. */
  qui: string;
  /** Détail utile au diagnostic. Ne contient jamais de secret. */
  detail: Record<string, unknown>;
  /** Empreinte de l'entrée précédente : c'est ce qui forme la chaîne. */
  precedent: string;
  /** Empreinte de cette entrée, precedent compris. */
  empreinte: string;
}

const dossier = () =>
  join(process.env.HELIX_DATA_DIR ?? join(homedir(), ".helix", "data"), "audit");

const fichierDuJour = () =>
  join(dossier(), `audit-${new Date().toISOString().slice(0, 10)}.jsonl`);

/**
 * Journée dont on veut relire le journal.
 *
 * `jour` arrive d'un paramètre d'URL (`GET /helix/audit?jour=…`). Assemblé tel
 * quel dans un chemin, « x/../../../ailleurs/fichier » sortait du dossier
 * d'audit : n'importe quel `.jsonl` lisible par le compte qui fait tourner
 * Helix était alors renvoyé à l'appelant. Seule une date AAAA-MM-JJ désigne un
 * journal ; tout le reste retombe sur celui du jour.
 */
const FORMAT_JOUR = /^\d{4}-\d{2}-\d{2}$/;
const journeeSure = (jour?: string) =>
  jour && FORMAT_JOUR.test(jour) ? jour : jourCourant();

/**
 * Ancre de la chaîne, conservée hors du journal.
 *
 * Elle retient deux choses : la dernière empreinte écrite (pour détecter une
 * troncature par la fin) **et** l'empreinte qui précède la première ligne de
 * chaque journée (pour détecter une troncature par le début). Sans ce second
 * point, retirer les premières lignes donne un fichier cohérent avec lui-même.
 */
const fichierChaine = () => join(dossier(), "chaine.json");

interface Ancre {
  empreinte: string;
  /** Empreinte précédant la première ligne, par journée. */
  debuts?: Record<string, string>;
}

function lireAncreComplete(): Ancre | null {
  try {
    return JSON.parse(readFileSync(fichierChaine(), "utf8")) as Ancre;
  } catch {
    return null;
  }
}

const jourCourant = () => new Date().toISOString().slice(0, 10);

let derniere: string | null = null;

function chargerDerniere(): string {
  if (derniere !== null) return derniere;
  try {
    const { empreinte } = JSON.parse(readFileSync(fichierChaine(), "utf8")) as {
      empreinte: string;
    };
    derniere = empreinte;
  } catch {
    // Premier démarrage : on part d'une graine aléatoire plutôt que d'une
    // valeur fixe, pour qu'une chaîne ne puisse pas être reconstruite ailleurs.
    derniere = randomBytes(16).toString("hex");
  }
  return derniere;
}

/**
 * Empreinte d'une entrée, **scellée par une clé**.
 *
 * Un SHA-256 nu ne protégeait rien : qui peut écrire le fichier peut recalculer
 * toute la chaîne et produire un journal parfaitement cohérent. Avec un HMAC
 * dont la clé vit dans le trousseau — jamais à côté du journal — reforger la
 * chaîne demande la clé, pas seulement l'accès au fichier.
 *
 * Sans clé disponible, on scelle avec une valeur propre au processus : la
 * chaîne reste vérifiable au sein d'une exécution, et `chiffrementActif()` dit
 * déjà honnêtement que la protection au repos n'est pas là.
 */
const secretDeSceau = (() => {
  let valeur: Buffer | null = null;
  return () => (valeur ??= cleDonnees() ?? randomBytes(32));
})();

const empreinteDe = (entree: Omit<AuditEntry, "empreinte">) =>
  createHmac("sha256", secretDeSceau()).update(JSON.stringify(entree)).digest("hex");

/**
 * Nombre de jours de journal conservés. Au-delà, les journées sont effacées.
 *
 * 90 jours par défaut ; l'entreprise fixe sa propre durée dans le profil
 * (`journalConservationJours`), entre 30 jours (en deçà, un incident découvert
 * tard n'a plus de trace) et 10 ans. La copie (`journalCopie`) n'est jamais
 * purgée : c'est l'archive, à la charge de l'intégrateur.
 */
export function conservationJours(): number {
  const voulu = Number(deployment().journalConservationJours ?? 90);
  return Number.isFinite(voulu) ? Math.min(3650, Math.max(30, Math.round(voulu))) : 90;
}

function purger(): void {
  try {
    // La journée se lit dans le nom du fichier, pas dans sa date de modification (qu'une copie ou un « touch » change).
    const limite = new Date(Date.now() - conservationJours() * 24 * 3600 * 1000).toISOString().slice(0, 10);
    const effacees: string[] = [];
    for (const nom of readdirSync(dossier())) {
      const jour = /^audit-(\d{4}-\d{2}-\d{2})\.jsonl$/.exec(nom)?.[1];
      if (!jour || jour >= limite) continue;
      unlinkSync(join(dossier(), nom));
      effacees.push(jour);
    }
    // L'ancre ne garde pas le point de départ de journées qui n'existent plus.
    const ancre = lireAncreComplete();
    if (ancre?.debuts && effacees.some((j) => j in (ancre.debuts ?? {}))) {
      for (const j of effacees) delete ancre.debuts[j];
      writeFileSync(fichierChaine(), JSON.stringify(ancre), { mode: 0o600 });
    }
  } catch {
    /* la purge est un confort, pas une obligation */
  }
}

let dernierePurge = 0;

/**
 * Enregistre un évènement.
 *
 * Volontairement synchrone et sans exception : un journal qui ralentit ou fait
 * échouer l'opération qu'il observe finit par être désactivé.
 */
export function journaliser(
  action: AuditAction,
  qui: string,
  detail: Record<string, unknown> = {},
): void {
  try {
    const dir = dossier();
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true, mode: 0o700 });

    const sans: Omit<AuditEntry, "empreinte"> = {
      quand: new Date().toISOString(),
      action,
      qui: qui || "anonyme",
      detail,
      precedent: chargerDerniere(),
    };
    const entree: AuditEntry = { ...sans, empreinte: empreinteDe(sans) };

    const ligne = JSON.stringify(entree) + "\n";
    appendFileSync(fichierDuJour(), ligne, { mode: 0o600 });

    /*
     * Recopie vers un second emplacement, quand l'intégrateur en désigne un.
     *
     * La chaîne rend une falsification détectable, elle n'empêche pas la
     * suppression du fichier : qui efface le journal efface la preuve. Une
     * copie sur un autre volume — partage réseau, disque de sauvegarde — est
     * ce qui rend le journal réellement opposable.
     */
    const copie = deployment().journalCopie;
    if (copie) {
      try {
        if (!existsSync(copie)) mkdirSync(copie, { recursive: true, mode: 0o700 });
        appendFileSync(join(copie, basename(fichierDuJour())), ligne, { mode: 0o600 });
      } catch {
        /* la copie est un renfort : son échec ne doit pas bloquer le journal */
      }
    }
    // On note le point de départ de la journée à sa première entrée.
    const ancre = lireAncreComplete() ?? { empreinte: "", debuts: {} };
    const debuts = ancre.debuts ?? {};
    if (!(jourCourant() in debuts)) debuts[jourCourant()] = sans.precedent;

    derniere = entree.empreinte;
    writeFileSync(
      fichierChaine(),
      JSON.stringify({ empreinte: derniere, debuts }),
      { mode: 0o600 },
    );

    // Une fois par jour au plus : la purge lit tout le dossier.
    if (Date.now() - dernierePurge > 24 * 3600 * 1000) {
      dernierePurge = Date.now();
      purger();
    }
  } catch {
    /* le journal ne doit jamais faire échouer l'action qu'il observe */
  }
}

export interface Verification {
  entrees: number;
  intact: boolean;
  /** Première anomalie rencontrée, s'il y en a une. */
  anomalie?: { ligne: number; raison: string };
}

/**
 * Relit un journal et vérifie sa chaîne.
 *
 * La vérification part de l'**ancre** (`chaine.json`, écrite hors du journal et
 * en 600) : sans elle, une chaîne entièrement reforgée serait cohérente avec
 * elle-même et passerait — de même qu'un journal amputé de ses premières
 * lignes. C'est ce qui distingue une chaîne vérifiable d'une chaîne
 * décorative.
 *
 * Ce qui reste hors de portée : la suppression pure et simple du fichier. C'est
 * l'objet de `journalCopie`.
 */
export function verifier(jour?: string): Verification {
  const journee = journeeSure(jour);
  const fichier = join(dossier(), `audit-${journee}.jsonl`);

  let lignes: string[];
  try {
    lignes = readFileSync(fichier, "utf8").split("\n").filter(Boolean);
  } catch {
    return { entrees: 0, intact: true };
  }

  /*
   * Point de départ attendu : sans lui, la première ligne restante est acceptée
   * quelle qu'elle soit, et amputer le début du journal ne se voit pas.
   */
  const ancreComplete = lireAncreComplete();
  let attendu: string | null = ancreComplete?.debuts?.[journee] ?? null;

  for (let i = 0; i < lignes.length; i++) {
    let entree: AuditEntry;
    try {
      entree = JSON.parse(lignes[i]) as AuditEntry;
    } catch {
      return { entrees: i, intact: false, anomalie: { ligne: i + 1, raison: t("ligne illisible") } };
    }

    const { empreinte, ...sans } = entree;
    if (empreinteDe(sans) !== empreinte) {
      return { entrees: i, intact: false, anomalie: { ligne: i + 1, raison: t("entrée modifiée") } };
    }
    if (attendu !== null && entree.precedent !== attendu) {
      return {
        entrees: i,
        intact: false,
        anomalie: {
          ligne: i + 1,
          raison:
            i === 0
              ? "début du journal manquant : premières entrées retirées"
              : "chaîne rompue : entrée retirée ou insérée",
        },
      };
    }
    attendu = empreinte;
  }

  /*
   * La dernière empreinte du fichier doit être celle que porte l'ancre. Sinon
   * le journal a été tronqué par la fin, ou réécrit en entier.
   */
  const ancre = lireAncre();
  if (ancre && attendu && ancre !== attendu) {
    return {
      entrees: lignes.length,
      intact: false,
      anomalie: {
        ligne: lignes.length,
        raison: t("ne correspond pas à l'ancre : journal tronqué ou réécrit"),
      },
    };
  }

  return { entrees: lignes.length, intact: true };
}

/** Dernière empreinte scellée, conservée hors du journal. */
const lireAncre = (): string | null => lireAncreComplete()?.empreinte ?? null;

/** Dernières entrées, les plus récentes en tête. */
export function lire(limite = 200, jour?: string): AuditEntry[] {
  const fichier = join(dossier(), `audit-${journeeSure(jour)}.jsonl`);
  try {
    return readFileSync(fichier, "utf8")
      .split("\n")
      .filter(Boolean)
      .slice(-limite)
      /*
       * Une ligne illisible ne doit pas emporter tout le journal. Le `map`
       * précédent laissait remonter l'exception jusqu'au `catch` global :
       * une seule ligne tronquée — une écriture interrompue par une coupure de
       * courant suffit — et l'écran d'audit se retrouvait vide, alors que
       * `verifier()` signale déjà l'anomalie ligne par ligne.
       */
      .flatMap((l) => {
        try {
          return [JSON.parse(l) as AuditEntry];
        } catch {
          return [];
        }
      })
      .reverse();
  } catch {
    return [];
  }
}

/** Jours pour lesquels un journal existe. */
export function jours(): string[] {
  try {
    return readdirSync(dossier())
      .filter((n) => n.startsWith("audit-") && n.endsWith(".jsonl"))
      .map((n) => n.slice("audit-".length, -".jsonl".length))
      .sort()
      .reverse();
  } catch {
    return [];
  }
}
