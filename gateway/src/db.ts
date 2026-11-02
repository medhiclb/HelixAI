import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  renameSync,
  chmodSync,
  readdirSync,
  unlinkSync,
} from "node:fs";
import { randomBytes } from "node:crypto";
import { join, dirname } from "node:path";
import { homedir } from "node:os";
import { deployment } from "./deployment.ts";
import { chiffrer, dechiffrer, chiffrementActif, estChiffreLie } from "./secret.ts";

/**
 * Base de données partagée de l'instance (ARCHITECTURE.md, ADR-007/010).
 *
 * C'est ce qui rend le multi-postes possible : les comptes, projets,
 * conversations, tâches et agents ne vivent plus dans un navigateur mais dans
 * l'instance, à laquelle plusieurs postes se connectent.
 *
 * Deux implémentations derrière la même interface :
 *  - **fichier JSON** (défaut) : zéro configuration, adapté à une PME ;
 *  - **PostgreSQL** (`database` dans le profil de déploiement) : pour un usage
 *    concurrent réel, plusieurs dizaines d'utilisateurs.
 */

/** Collections synchronisées entre les postes. */
export const COLLECTIONS = [
  "accounts",
  "projects",
  "sessions",
  "tasks",
  "agents",
  "profiles",
  /*
   * Compétences : des procédures écrites en français, que le modèle applique
   * quand la situation s'y prête. Synchronisées comme le reste, et partageables
   * à l'organisation comme un agent — une bonne procédure n'a aucune raison de
   * rester dans un seul poste.
   */
  "competences",
] as const;

export type Collection = (typeof COLLECTIONS)[number];

/**
 * Collections internes à l'instance : elles vivent dans le même magasin, mais
 * ne sont **jamais** exposées par les routes de synchronisation. Les séances
 * d'authentification en font partie — les distribuer reviendrait à distribuer
 * des clés d'accès. Le compte de courrier aussi : il porte le mot de passe
 * chiffré de la boîte de l'entreprise, qui n'a rien à faire dans une réponse
 * de synchronisation vers un poste. Les connecteurs pour la même raison : ils
 * portent les jetons d'accès aux services branchés à l'instance.
 */
export const COLLECTIONS_INTERNES = [
  "authSessions",
  "courrierCompte",
  // Le compte d'agenda est dans le même cas que celui du courrier : son mot de
  // passe ouvre le CalDAV, et bien souvent la messagerie du même compte.
  "agendaCompte",
  // Jeton d'actualisation Google Drive et jeton de bot Slack (drive.ts,
  // slack.ts) : chacun ouvre les documents ou les conversations de l'entreprise.
  "driveCompte",
  "slackCompte",
  /*
   * Client OAuth Google saisi à l'écran (clientGoogle.ts), partagé par Drive et
   * Google Agenda, et jeton d'actualisation de Google Agenda (agendaGoogle.ts) :
   * internes pour la même raison que le Drive (26/09/2026).
   */
  "clientGoogle",
  "agendaGoogle",
  /*
   * Google Sheets, Slides, YouTube, LinkedIn, Facebook, Instagram, TikTok
   * (oauthNatif.ts, 28/09/2026) : les applications saisies à l'écran (secret
   * chiffré) et les jetons de chaque compte branché. Un jeton qui publie au nom
   * de l'organisation ne se recopie sur aucun poste.
   */
  "connecteursNatifs",
  // Telegram, Discord, WhatsApp (natifs/messageries.ts, 28/09/2026) : jetons de bot et messages reçus, jamais sur un poste.
  "messageries",
  // Stripe, Shopify, WooCommerce, Salesforce, Pipedrive, Zendesk (natifs/commerce.ts) : clés et jetons, même raison.
  "connecteursCommerce",
  // Tâches programmées (tachesProgrammees.ts) : exécutées par l'instance, jamais recopiées sur les postes.
  "tachesProgrammees",
  "connecteurs",
  /*
   * Autorisations OAuth des services distants (oauthMcp.ts) : jetons d'accès
   * et de rafraîchissement, et l'enregistrement de l'instance auprès du
   * service. Interne pour la même raison que les connecteurs — un jeton
   * recopié sur chaque poste du parc n'est plus un secret.
   */
  "oauth",
  /*
   * Invitations d'un collègue (invitations.ts) : chaque code y est gardé sous
   * forme d'empreinte, avec l'adresse invitée. Interne parce qu'un code vaut,
   * le temps de sa vie, le droit de rattacher un poste et d'ouvrir un compte.
   */
  "invitations",
  /*
   * Consommation des modèles, par jour, par compte et par modèle (usage.ts).
   * Interne parce que chaque personne ne doit voir que la sienne : distribuée
   * par la synchronisation, elle dirait à chaque poste qui travaille, quand et
   * combien. La route `GET /helix/usage` la filtre sur le demandeur.
   */
  "usage",
  // Tarifs des modèles distants, renseignés à la main : c'est la configuration
  // de l'instance, pas une donnée à recopier sur les postes.
  "tarifs",
  // Réglages de l'instance changés depuis l'interface (contrôle de l'écran).
  "reglages",
  /*
   * Employés OpenClaw (employes.ts), et ce que chacun leur a dit. La liste
   * passe par des routes dédiées, qui déploient, planifient et vérifient qui
   * a le droit de modifier ; les échanges ne se lisent que par leur auteur.
   */
  "employes",
  "echangesEmployes",
  /*
   * Clés de fournisseurs de modèles cloud branchées depuis l'interface
   * (fournisseurs.ts). Une clé engage une carte bancaire : elle ne se
   * distribue pas aux postes, elle ne ressort jamais.
   */
  "clesModeles",
  // Jetons des canaux des employés (Telegram, Discord…) : ils ne vont qu'à l'environnement du processus OpenClaw.
  "secretsCanaux",
  // Dernier message vu dans la boîte, pour les missions « à chaque mail reçu » (courrier.ts).
  "curseurCourrier",
  // Ce qu'ont donné ces missions, par employé : résumés de courriers, donc chiffrés et jamais distribués.
  "executionsEmployes",
  // Groupes de l'équipe (groupes.ts) : leurs membres décident de ce que chacun voit, l'instance fait foi.
  "groupes",
  // Bibliothèque (bibliotheque.ts) : dossiers, documents et leur visibilité ; les contenus sont à part, chiffrés.
  "bibliotheque",
  // Réunions (reunions.ts) et leurs réglages : titres, comptes rendus ; transcriptions et son sont à part, chiffrés.
  "reunions",
  "reglagesReunions",
  /*
   * Bases de connaissances (connaissances.ts) : noms, visibilité, documents
   * rattachés et état de leur indexation. Les vecteurs et le texte des
   * morceaux sont à part, un fichier chiffré par document.
   */
  "connaissances",
  /*
   * Sessions de Helix Code (sessionsCode.ts) : propriétaire, dossier, titre et
   * dates. Leur contenu reste chez OpenCode ; chacun ne liste que les siennes.
   */
  "sessionsCode",
  "projetsVps",
  /*
   * Clés d'API personnelles (clesApi.ts) : empreintes salées, noms, dates.
   * Interne parce qu'une empreinte n'a rien à faire sur un poste, et que la
   * liste dit qui interroge l'instance par programme.
   */
  "clesApi",
] as const;

export type StoredCollection = Collection | (typeof COLLECTIONS_INTERNES)[number];

export function isCollection(value: string): value is Collection {
  return (COLLECTIONS as readonly string[]).includes(value);
}

export interface Store {
  read(collection: StoredCollection): Promise<unknown>;
  write(collection: StoredCollection, value: unknown): Promise<void>;
  /** Valeur telle qu'elle est stockée, chiffrée ou non : pour la migration seule. */
  readRaw(collection: StoredCollection): Promise<unknown>;
  /** Horodatage de dernière écriture, pour la détection de changement. */
  revision(collection: StoredCollection): Promise<number>;
  describe(): string;
  /**
   * Range une collection abîmée à côté (sans l'effacer) pour repartir d'une
   * collection vide. Rend le nom de la copie gardée, ou null si ce stockage ne
   * sait pas le faire.
   */
  mettreDeCote?(collection: StoredCollection): Promise<string | null>;
}

/* ------------------------------ fichier JSON ------------------------------- */

interface Envelope {
  value: unknown;
  revision: number;
}

class JsonStore implements Store {
  private readonly dir: string;

  constructor(dir: string) {
    this.dir = dir;
    // 700 : le dossier contient comptes, conversations et clés de séance.
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true, mode: 0o700 });
    this.durcirExistant();
  }

  /**
   * Resserre les permissions des fichiers déjà là.
   *
   * Les premières versions écrivaient en 644 : sur une machine partagée, tout
   * autre compte pouvait lire les empreintes de mots de passe et les
   * conversations. Un correctif qui ne vaut que pour les nouveaux fichiers
   * laisserait les installations existantes exposées.
   */
  private durcirExistant(): void {
    try {
      chmodSync(this.dir, 0o700);
      for (const nom of readdirSync(this.dir)) {
        if (!nom.endsWith(".json")) continue;
        chmodSync(join(this.dir, nom), 0o600);
      }
    } catch {
      /* permissions non ajustables : on continue, sans prétendre le contraire */
    }
  }

  private path(collection: StoredCollection): string {
    return join(this.dir, `${collection}.json`);
  }

  /**
   * « Jamais écrit » et « illisible » ne se confondent pas (revue de sécurité
   * du 26/09/2026) : un fichier présent qu'on ne sait pas lire (droits,
   * disque, fichier tronqué) rendait `null`, comme une collection vide, et la
   * prochaine écriture d'un poste effaçait tout ce qu'il ne contenait pas
   * (les Chats des autres, les comptes, les employés). Seul un fichier absent
   * vaut « rien » ; le reste lève, et personne n'écrit par-dessus ce qu'on n'a
   * pas pu lire (règle du projet, pertes du 20/09 et du 24/09).
   */
  private load(collection: StoredCollection): Envelope {
    const file = this.path(collection);
    let texte: string;
    try {
      texte = readFileSync(file, "utf8");
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return { value: null, revision: 0 };
      throw new Error(`collection « ${collection} » illisible (${(err as NodeJS.ErrnoException).code ?? "erreur"}) : rien n'est écrit par-dessus`);
    }
    try {
      return JSON.parse(texte) as Envelope;
    } catch {
      throw new Error(`collection « ${collection} » abîmée (JSON illisible) : rien n'est écrit par-dessus`);
    }
  }

  async read(collection: StoredCollection): Promise<unknown> {
    // Une installation antérieure au chiffrement se relit telle quelle, puis
    // bascule au démarrage suivant (`migrerChiffrement`) : pas de perte.
    return dechiffrer(this.load(collection).value, collection);
  }

  async readRaw(collection: StoredCollection): Promise<unknown> {
    return this.load(collection).value;
  }

  async revision(collection: StoredCollection): Promise<number> {
    return this.load(collection).revision;
  }

  /**
   * Écriture atomique : on écrit à côté puis on renomme, pour qu'un poste qui
   * lit pendant une écriture ne tombe jamais sur un fichier tronqué.
   */
  async write(collection: StoredCollection, value: unknown): Promise<void> {
    const file = this.path(collection);
    // Un nom à chaque écriture : deux écritures proches ne se partagent plus le même fichier provisoire (audit Windows du 27/09/2026).
    const temp = `${file}.${process.pid}.${randomBytes(4).toString("hex")}.tmp`;
    const envelope: Envelope = { value: chiffrer(value, collection), revision: Date.now() };
    mkdirSync(dirname(file), { recursive: true, mode: 0o700 });
    /*
     * Une écriture ratée ne laisse rien derrière elle (28/09/2026) : disque
     * plein au milieu de l'écriture, ou renommage refusé, le fichier
     * provisoire restait dans le dossier des données, une copie de plus de la
     * collection (chiffrée, mais à chaque échec un nom neuf, jamais repris).
     * L'erreur remonte telle quelle ; l'ancienne version reste en place.
     */
    try {
      // 600 dès l'écriture : ces fichiers ne regardent que le compte hôte.
      writeFileSync(temp, JSON.stringify(envelope), { encoding: "utf8", mode: 0o600 });
      /*
       * Sous Windows, un antivirus ou l'indexation tiennent parfois le fichier
       * un instant : le renommage échoue (EPERM, EBUSY), puis passe. Quelques
       * essais rapprochés, puis l'erreur, telle quelle (audit du 27/09/2026).
       */
      for (let essai = 0; ; essai++) {
        try {
          renameSync(temp, file);
          return;
        } catch (err) {
          const code = (err as NodeJS.ErrnoException).code;
          if (process.platform !== "win32" || essai >= 8 || (code !== "EPERM" && code !== "EBUSY" && code !== "EACCES")) throw err;
          await new Promise((r) => setTimeout(r, 50 * (essai + 1)));
        }
      }
    } catch (err) {
      try {
        unlinkSync(temp);
      } catch {
        /* jamais créé, ou déjà parti */
      }
      throw err;
    }
  }

  describe(): string {
    return `fichiers JSON (${this.dir})${chiffrementActif() ? ", chiffrés" : ", EN CLAIR"}`;
  }

  async mettreDeCote(collection: StoredCollection): Promise<string | null> {
    const file = this.path(collection);
    if (!existsSync(file)) return null;
    const garde = `${file}.abimee-${new Date().toISOString().replace(/[:.]/g, "-")}`;
    renameSync(file, garde);
    return garde;
  }
}

/* ------------------------------- PostgreSQL -------------------------------- */

/**
 * Implémentation PostgreSQL, activée par `database` dans le profil de
 * déploiement. Le pilote `pg` est compilé dans la passerelle, donc livré avec
 * l'application, mais n'est **chargé** que si la configuration l'exige : une
 * installation mono-poste ne l'exécute jamais.
 *
 * Chiffrée comme le magasin fichiers, avec la même clé et la même enveloppe :
 * la colonne `value` ne contient que des coffres AES-256-GCM. C'est ici que le
 * chiffrement compte le plus, parce qu'un PostgreSQL vit souvent ailleurs que
 * l'instance (autre serveur, hébergeur, sauvegardes automatiques) : quiconque
 * lit la base, ses sauvegardes ou ses journaux de réplication n'y trouve ni
 * conversation ni empreinte. La clé, elle, reste sur la machine de l'instance.
 *
 * Restent lisibles, et c'est assumé : le nom des collections et l'heure de
 * dernière écriture (`revision`), qui servent à la synchronisation.
 */
class PostgresStore implements Store {
  private client: {
    query: (text: string, values?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>;
  } | null = null;
  private readonly connectionString: string;

  // Champ explicite : Node exécute le TypeScript en retirant simplement les
  // types, et ne gère pas les propriétés déclarées dans la signature.
  constructor(connectionString: string) {
    this.connectionString = connectionString;
  }

  private async connect() {
    if (this.client) return this.client;
    const pg = (await import("pg")) as unknown as {
      default?: { Client: new (c: unknown) => unknown };
      Client?: new (c: unknown) => unknown;
    };
    const Ctor = pg.Client ?? pg.default?.Client;
    // Le pilote est compilé dans la passerelle (voir `build:gateway`) : son
    // absence ne peut venir que d'une construction faite à la main.
    if (!Ctor) throw new Error("Pilote PostgreSQL absent de cette construction de la passerelle.");
    const client = new Ctor({ connectionString: this.connectionString }) as {
      connect: () => Promise<void>;
      query: (text: string, values?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>;
    };
    await client.connect();
    await client.query(
      `CREATE TABLE IF NOT EXISTS helix_state (
         collection TEXT PRIMARY KEY,
         value JSONB,
         revision BIGINT NOT NULL
       )`,
    );
    this.client = client;
    return client;
  }

  async read(collection: StoredCollection): Promise<unknown> {
    return dechiffrer(await this.readRaw(collection), collection);
  }

  async readRaw(collection: StoredCollection): Promise<unknown> {
    const client = await this.connect();
    const { rows } = await client.query(
      "SELECT value FROM helix_state WHERE collection = $1",
      [collection],
    );
    return rows[0]?.value ?? null;
  }

  async revision(collection: StoredCollection): Promise<number> {
    const client = await this.connect();
    const { rows } = await client.query(
      "SELECT revision FROM helix_state WHERE collection = $1",
      [collection],
    );
    return Number(rows[0]?.revision ?? 0);
  }

  async write(collection: StoredCollection, value: unknown): Promise<void> {
    const client = await this.connect();
    await client.query(
      `INSERT INTO helix_state (collection, value, revision)
       VALUES ($1, $2, $3)
       ON CONFLICT (collection)
       DO UPDATE SET value = EXCLUDED.value, revision = EXCLUDED.revision`,
      [collection, JSON.stringify(chiffrer(value, collection)), Date.now()],
    );
  }

  describe(): string {
    return `PostgreSQL${chiffrementActif() ? ", chiffré" : ", EN CLAIR"}`;
  }
}

/* --------------------------------- fabrique -------------------------------- */

let store: Store | null = null;

export function db(): Store {
  if (store) return store;
  const configured = deployment().database;
  store = configured
    ? new PostgresStore(configured)
    : new JsonStore(
        process.env.HELIX_DATA_DIR ?? join(homedir(), ".helix", "data"),
      );
  console.log(`[helix] données de l'instance : ${store.describe()}`);
  return store;
}

/**
 * Réécrit sous la forme chiffrée actuelle tout ce qui ne l'est pas encore :
 * données d'avant le chiffrement, ou coffres de la première version, non liés
 * à leur collection.
 *
 * Sans ce passage, une collection qui n'est plus jamais écrite resterait en
 * clair indéfiniment : le chiffrement ne s'applique qu'à l'écriture. C'était
 * vrai des comptes (d'où l'ancienne `migrerComptes`), c'est vrai de toute
 * collection, et d'une base PostgreSQL existante tout entière.
 *
 * Appelée **avant** que la passerelle n'accepte des requêtes : une réécriture
 * concurrente d'une écriture de poste pourrait sinon remettre l'ancienne
 * valeur par-dessus la nouvelle.
 */
export async function migrerChiffrement(): Promise<{ reecrites: StoredCollection[] }> {
  const reecrites: StoredCollection[] = [];
  if (!chiffrementActif()) return { reecrites };
  const magasin = db();
  for (const collection of [...COLLECTIONS, ...COLLECTIONS_INTERNES]) {
    let brut: unknown;
    try {
      brut = await magasin.readRaw(collection);
    } catch (err) {
      // Illisible : on la laisse telle quelle, sans bloquer le démarrage ; ce qui la lira le dira.
      console.error("[db]", err instanceof Error ? err.message : err);
      continue;
    }
    if (brut === null || brut === undefined || estChiffreLie(brut)) continue;
    await magasin.write(collection, await magasin.read(collection));
    reecrites.push(collection);
  }
  return { reecrites };
}
