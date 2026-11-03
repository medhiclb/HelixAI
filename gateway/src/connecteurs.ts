import { reaProposable, commandeRea, envRea, refusRea, preparerRea, serveurReaAPoser } from "./rea.ts";
import { chmodSync, copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { chiffrer, dechiffrer, chiffrementActif, estChiffreLie } from "./secret.ts";
import { db, type StoredCollection } from "./db.ts";
import { deployment } from "./deployment.ts";
import { journaliser } from "./audit.ts";
import {
  adresseServeurPermise,
  callTool as appelerOutilMcp,
  outilDuModele,
  declarer,
  estDeclare,
  relancable,
  retirerServeur,
  startServer,
  status as mcpStatus,
  stopServer,
  type McpServerConfig,
} from "./mcp.ts";
import { ecouteurPalmier, palmierProposable, portPalmier, PORT_PALMIER, TELECHARGEMENT_PALMIER, type VerdictEcouteur } from "./palmier.ts";
import { commandeRoblox, conseilRoblox, DOCUMENTATION_ROBLOX, refusRoblox, robloxProposable, TELECHARGEMENT_ROBLOX } from "./roblox.ts";
import { CHEMIN_UNREAL, conseilUnreal, DOCUMENTATION_UNREAL, ecouteurUnreal, PORT_UNREAL, portUnreal, TELECHARGEMENT_UNREAL, unrealProposable } from "./unreal.ts";
import { blenderProposable, commandeBlender, effacerServeurBlender, envBlender, preparerBlender, refusBlender, refusBlenderRecent, serveurBlenderAPoser, TELECHARGEMENT_BLENDER } from "./blender.ts";
import * as bureau from "./bureau.ts";
import * as courrier from "./courrier.ts";
import * as agenda from "./agenda.ts";
import * as drive from "./drive.ts";
import * as slack from "./slack.ts";
import * as outilsNatifs from "./outilsNatifs.ts";
import * as messageries from "./natifs/messageries.ts";
import { NOMS_MICROSOFT } from "./natifs/microsoftBase.ts";
import * as computer from "./computer.ts";
import { nomProduit } from "./marque.ts";
import {
  choixDe,
  connecteurDuRetour,
  depuis as oauthDepuis,
  noterChoix,
  FournisseurAutorisation,
  noterDemandeur,
  oublier as oublierOauth,
  retoursEnregistres,
} from "./oauthMcp.ts";
import { auth } from "@modelcontextprotocol/sdk/client/auth.js";
import { definirEcriture, estMcpProjet, porteesDemandees, porteesEnTrop } from "./natifs/projetsRegles.ts";
import { t, tf } from "./langue.ts";
import { refusLisible } from "./refusOauth.ts";
import { sansLocalhost } from "./oauthNatif.ts";
import { definirLecturesPerso, definirNomsConnecteurs } from "./approbation.ts";
import { jugerAdresse, jugerCommande, jugerVariables } from "./mcpPersoRegles.ts";
import { PORT as PORT_PASSERELLE, surLeReseau } from "./config.ts";

/**
 * Catalogue de connecteurs.
 *
 * Jusqu'ici la liste des serveurs MCP était une constante d'une seule ligne :
 * on pouvait l'allumer ou l'éteindre, pas y ajouter quoi que ce soit. Brancher
 * Notion demandait de recompiler la passerelle.
 *
 * Ce module ouvre l'ajout, et pose en même temps la seule barrière qui compte.
 *
 * **Un serveur MCP est une commande exécutée sur la machine de l'entreprise.**
 * Si l'interface choisit cette commande, alors quiconque atteint la passerelle
 * choisit ce qui tourne sur le serveur : c'est de l'exécution de code à
 * distance, offerte à n'importe quel salarié d'une instance partagée. La
 * commande vient donc du catalogue ci-dessous, écrit dans Helix et livré avec
 * lui. La requête, elle, n'apporte que des secrets — jamais un exécutable.
 */

/* ------------------------------------------------------------------ */
/* Le catalogue                                                        */
/* ------------------------------------------------------------------ */

/** Un secret à demander à l'utilisateur, et à passer par l'environnement. */
export interface ChampSecret {
  /** Nom de la variable d'environnement attendue par le serveur. */
  nom: string;
  libelle: string;
  /** Comment l'obtenir, dit à quelqu'un qui n'est pas informaticien. */
  aide: string;
}

export interface EntreeCatalogue {
  id: string;
  label: string;
  description: string;
  /** Rubrique d'affichage, pour que la liste reste lisible quand elle s'allonge. */
  categorie: Categorie;
  /**
   * Commande et arguments, pour un serveur qui tourne sur cette machine.
   * Absents pour un serveur livré avec Helix (déjà déclaré dans `mcp.ts`, et
   * répéter sa définition ici garantirait qu'un jour les deux divergent) et
   * pour un service distant, qui a une `url`.
   */
  command?: string;
  args?: string[];
  /**
   * Adresse du serveur MCP **du service lui-même**, quand il en publie un.
   *
   * C'est ce qui rend le branchement en un clic possible : rien à installer,
   * et l'autorisation se donne dans le navigateur (voir oauthMcp.ts).
   */
  url?: string;
  /**
   * Serveur MCP d'une **application ouverte sur cette machine**, en HTTP sur la
   * boucle, sans OAuth ni jeton (Palmier Pro, 29/09/2026). L'adresse n'est
   * jamais écrite ni reçue : elle est `http://127.0.0.1:<port><chemin>`, avec
   * le port déclaré ici (`APPLICATIONS_LOCALES` le donne, et seul un essai le
   * change), et le programme à l'écoute est reconnu avant chaque requête
   * (mcp.ts, `local`). Aucune autre adresse locale n'est ouverte par là.
   */
  local?: { port: number; chemin: string };
  /**
   * Serveur MCP d'une **application installée sur cette machine**, lancé en
   * stdio par une commande que Helix tire de l'installation de l'application
   * (Roblox Studio, Blender, 12/10/2026) : ni adresse, ni commande écrite ici
   * ou reçue ; `APPLICATIONS_STDIO` la donne, et reconnaît l'application
   * avant de lancer quoi que ce soit.
   */
  lanceur?: true;
  /** Page officielle où la personne télécharge l'application elle-même (Helix ne la télécharge pas). */
  telechargement?: string;
  /**
   * Comment l'autorisation se fait :
   *  - `auto` : le service accepte que l'instance s'enregistre elle-même
   *    (RFC 7591). Rien à préparer : on clique, on autorise, c'est fini ;
   *  - `appli` : le service veut une application déclarée chez lui. Une
   *    personne la crée une fois, colle l'identifiant et le secret, et ensuite
   *    le bouton « Se connecter » suffit à tout le monde.
   */
  oauth?: "auto" | "appli";
  /** Où créer l'application, quand `oauth` vaut « appli ». */
  console?: string;
  /**
   * Le service refuse « localhost » dans l'adresse de retour : elle part avec
   * l'adresse de boucle où la passerelle écoute (127.0.0.1). Zoom : « Do not
   * use localhost. Register and send numeric loopback literals »
   * (https://developers.zoom.us/docs/integrations/oauth/, lu le 28/09/2026).
   */
  retourSansLocalhost?: true;
  /**
   * Lecture seule par défaut, l'écriture se coche à la connexion, et elle est
   * réservée à l'administrateur (Trello, Monday, ClickUp, Todoist, Calendly,
   * Zoom : natifs/projetsRegles.ts, SECURITE.md § 48).
   */
  ecritureAuChoix?: true;
  secrets: ChampSecret[];
  /** Page où l'utilisateur va chercher son secret, ou la documentation du service. */
  documentation?: string;
  /** Livré avec le produit : ne s'installe pas, ne se retire pas. */
  integre?: true;
}

/*
 * Une rubrique « Commerce et relation client » pour le catalogue comme pour les
 * services à panneau (tournée finale du 28/09/2026). Il y en avait trois :
 * « Commerce et relation client » (Stripe, Salesforce, Zendesk…, écran),
 * « Vente et relation client » (HubSpot, Intercom) et « Paiement et gestion »
 * (Square, PayPal) : on cherchait son CRM ou son moyen de paiement dans trois
 * listes. L'écran range sous un même titre les services à panneau et ceux du
 * catalogue (Connecteurs.tsx) : les deux traductions de la rubrique doivent
 * donc être identiques (gateway/i18n et src/i18n, contrôlé par npm run securite).
 * Box rejoint de même « Courrier, agenda et fichiers », où sont Drive et Dropbox :
 * il était seul, parmi Canva et Figma, sous « Documents et données ».
 */
export type Categorie =
  | "Livré avec le produit"
  | "Courrier, agenda et fichiers"
  | "Travail en équipe"
  | "Développement"
  | "Documents et données"
  | "Commerce et relation client"
  | "Web et recherche";

export const CATEGORIES: Categorie[] = [
  "Livré avec le produit",
  "Courrier, agenda et fichiers",
  "Travail en équipe",
  "Développement",
  "Documents et données",
  "Commerce et relation client",
  "Web et recherche",
];

/**
 * Ce que Helix sait brancher.
 *
 * ── Deux familles, et la différence compte ───────────────────────────────────
 *
 * **Les services qui publient leur propre serveur MCP** (`url`) : rien ne
 * s'installe sur la machine du client. On clique « Se connecter », le service
 * demande l'autorisation dans le navigateur, et le jeton revient chiffré dans
 * l'instance. C'est ce que font les plateformes qui vendent « mille outils en
 * un clic », à ceci près qu'elles gardent les jetons de leurs clients chez
 * elles : ici, ils ne quittent pas la machine du client.
 *
 * **Les serveurs à exécuter** (`command`) : un paquet npm lancé sur la machine
 * de l'entreprise. Pour ceux-là, la règle d'origine ne bouge pas — la commande
 * vient de ce catalogue, jamais de la requête, parce que laisser l'interface
 * choisir la commande reviendrait à offrir l'exécution de code à distance à
 * quiconque atteint la passerelle.
 *
 * ── Ce qui entre ici ─────────────────────────────────────────────────────────
 *
 * Rien sans vérification. Chaque adresse de cette liste a été interrogée :
 * elle répond, elle publie ses métadonnées d'autorisation, et l'on sait si
 * elle accepte l'enregistrement dynamique. Chaque nom de paquet a été vérifié
 * sur le registre npm, à l'orthographe exacte — une ligne écrite de mémoire,
 * avec un nom approchant, ferait installer au client un paquet que quelqu'un
 * d'autre a publié sous ce nom.
 *
 * Vérifié le 2026-09-18, revérifié le 2026-09-28 (SECURITE.md § 49) : pour
 * chaque service distant, la documentation officielle du jour et ses
 * métadonnées d'autorisation publiques (`/.well-known/oauth-protected-resource`
 * et `oauth-authorization-server`, lues sans compte ni identifiant) ; pour
 * chaque paquet, sa version et sa licence sur le registre npm.
 */
export const CATALOGUE: EntreeCatalogue[] = [
  {id:"rea",label:"REA",description:"Analyser un projet JavaScript, une application Electron ou des binaires avec les outils locaux de REA. Disponible dans Code pour l'administrateur, avec accord à chaque appel. Les moteurs externes se préparent séparément.",categorie:"Développement",lanceur:true,documentation:"https://github.com/morluto/rea",secrets:[]},
  {
    id: "fichiers",
    label: "Système de fichiers",
    /*
     * `{0}` : le nom du produit, posé au moment de servir (`catalogueTraduit`).
     * Écrit ici en dur, il était calculé au chargement du module, avant que la
     * marque ne soit lue — « Livré avec l'application » — et jamais traduit.
     */
    description: "Lecture et écriture dans l'espace de travail de l'instance. Livré avec {0}.",
    categorie: "Livré avec le produit",
    secrets: [],
    integre: true,
  },

  /* ---- Services distants : un clic, l'autorisation dans le navigateur ---- */
  {
    id: "notion",
    label: "Notion",
    description: "Pages, bases de données et commentaires de votre espace Notion.",
    categorie: "Travail en équipe",
    url: "https://mcp.notion.com/mcp",
    oauth: "auto",
    documentation: "https://www.notion.so",
    secrets: [],
  },
  {
    id: "linear",
    label: "Linear",
    description: "Tickets, projets et cycles Linear : lire, créer, commenter.",
    categorie: "Développement",
    url: "https://mcp.linear.app/mcp",
    oauth: "auto",
    documentation: "https://linear.app",
    secrets: [],
  },
  {
    id: "atlassian",
    label: "Jira et Confluence",
    description: "Tickets Jira et pages Confluence de votre organisation Atlassian.",
    categorie: "Travail en équipe",
    /*
     * 28/09/2026 : `/v1/sse` ne publiait plus aucune métadonnée d'autorisation
     * (404 partout), et c'est l'ancien transport SSE. La documentation
     * d'Atlassian donne `/v2/mcp` ; ses métadonnées renvoient au serveur
     * d'autorisation d'Atlassian (auth.atlassian.com), qui accepte
     * l'enregistrement automatique, avec PKCE S256.
     */
    url: "https://mcp.atlassian.com/v2/mcp",
    oauth: "auto",
    documentation: "https://support.atlassian.com/atlassian-rovo-mcp-server/docs/getting-started-with-the-atlassian-remote-mcp-server/",
    secrets: [],
  },
  {
    id: "asana",
    label: "Asana",
    description: "Tâches, projets et portefeuilles Asana.",
    categorie: "Travail en équipe",
    /*
     * 28/09/2026 : le serveur V1 (`/sse`) est arrêté par Asana depuis le
     * 11/05/2026 d'après sa documentation. Le V2 (`/v2/mcp`) n'accepte pas
     * l'enregistrement automatique (pas de `registration_endpoint` dans ses
     * métadonnées) : il faut une « MCP app » créée dans la console d'Asana,
     * avec un identifiant et un secret.
     */
    url: "https://mcp.asana.com/v2/mcp",
    oauth: "appli",
    console: "https://app.asana.com/0/my-apps",
    documentation: "https://developers.asana.com/docs/integrating-with-asanas-mcp-server",
    secrets: [],
  },
  {
    id: "sentry",
    label: "Sentry",
    description: "Erreurs, alertes et versions suivies par Sentry.",
    categorie: "Développement",
    url: "https://mcp.sentry.dev/mcp",
    oauth: "auto",
    documentation: "https://sentry.io",
    secrets: [],
  },
  {
    id: "intercom",
    label: "Intercom",
    description: "Conversations clients et articles d'aide Intercom.",
    categorie: "Commerce et relation client",
    // Espaces Intercom hébergés aux États-Unis ; ceux d'Europe ont une autre adresse (mcp.eu.intercom.com), pas au catalogue.
    url: "https://mcp.intercom.com/mcp",
    oauth: "auto",
    documentation: "https://developers.intercom.com/docs/guides/mcp",
    secrets: [],
  },
  {
    id: "canva",
    label: "Canva",
    description: "Créations et gabarits Canva : chercher, produire, exporter.",
    categorie: "Documents et données",
    /*
     * 28/09/2026 : Canva dit l'enregistrement automatique « déprécié au profit
     * de CIMD, mais toujours disponible » ; ses métadonnées le publient encore.
     */
    url: "https://mcp.canva.com/mcp",
    oauth: "auto",
    documentation: "https://www.canva.dev/docs/apps/mcp/access/",
    secrets: [],
  },
  /*
   * Figma et Vercel : leur documentation parle de clients « approuvés », et ils
   * avaient été retirés du catalogue le matin du 28/09/2026 pour cette raison.
   * Remis le même jour : Medhi a branché Helix à Vercel depuis l'écran, la page
   * d'autorisation de Vercel a accepté Helix et le compte est autorisé (capture
   * du 28/09/2026). Si un service refuse un jour, l'écran montre sa réponse.
   */
  {
    id: "figma",
    label: "Figma",
    description: "Fichiers et composants Figma, vus depuis l'agent.",
    categorie: "Documents et données",
    url: "https://mcp.figma.com/mcp",
    oauth: "auto",
    documentation: "https://www.figma.com",
    secrets: [],
  },
  {
    id: "vercel",
    label: "Vercel",
    description: "Projets, déploiements et journaux Vercel.",
    categorie: "Développement",
    url: "https://mcp.vercel.com",
    oauth: "auto",
    documentation: "https://vercel.com",
    secrets: [],
  },
  {
    id: "webflow",
    label: "Webflow",
    description: "Sites, collections et éléments Webflow.",
    categorie: "Web et recherche",
    /*
     * La seule adresse que Webflow documente (28/09/2026) : l'ancien transport
     * SSE, que mcp.ts rouvre quand le transport « streamable » est refusé.
     */
    url: "https://mcp.webflow.com/sse",
    oauth: "auto",
    documentation: "https://developers.webflow.com/data/docs/ai-tools",
    secrets: [],
  },
  {
    id: "wix",
    label: "Wix",
    description: "Sites Wix : contenu, boutique, réservations.",
    categorie: "Web et recherche",
    // 28/09/2026 : `/mcp`, l'adresse de la documentation de Wix ; `/sse` n'a plus de métadonnées à son chemin.
    url: "https://mcp.wix.com/mcp",
    oauth: "auto",
    documentation: "https://dev.wix.com/docs/sdk/articles/use-the-wix-mcp/about-the-wix-mcp",
    secrets: [],
  },
  {
    id: "square",
    label: "Square",
    description: "Catalogue, commandes et paiements Square.",
    categorie: "Commerce et relation client",
    // 28/09/2026 : `/mcp`, l'adresse de la documentation de Square (le transport « streamable »).
    url: "https://mcp.squareup.com/mcp",
    oauth: "auto",
    documentation: "https://developer.squareup.com/docs/mcp",
    secrets: [],
  },
  {
    id: "paypal",
    label: "PayPal",
    description: "Factures, commandes et remboursements PayPal.",
    categorie: "Commerce et relation client",
    // 28/09/2026 : PayPal documente `/http` (transport « streamable ») et `/sse`, pas `/mcp`.
    url: "https://mcp.paypal.com/http",
    oauth: "auto",
    documentation: "https://developer.paypal.com/tools/mcp-server/",
    secrets: [],
  },

  /*
   * ---- Projets et rendez-vous (28/09/2026, SECURITE.md § 48) ----
   * Les serveurs officiels des éditeurs, en lecture seule tant que
   * l'administrateur n'a pas coché l'écriture ; sources et portées dans
   * natifs/projetsRegles.ts. Zoom est plus bas : il veut une application.
   */
  {
    id: "trello",
    label: "Trello",
    description: "Tableaux, listes et cartes Trello : lire, et écrire après votre accord si l'administrateur l'a permis.",
    categorie: "Travail en équipe",
    url: "https://mcp.trello.com/v1",
    oauth: "auto",
    ecritureAuChoix: true,
    documentation: "https://support.atlassian.com/trello/docs/connect-trello-to-ai-assistants-with-trello-mcp/",
    secrets: [],
  },
  {
    id: "monday",
    label: "Monday",
    description: "Tableaux, éléments et mises à jour monday.com : lire, et écrire après votre accord si l'administrateur l'a permis.",
    categorie: "Travail en équipe",
    url: "https://mcp.monday.com/mcp",
    oauth: "auto",
    ecritureAuChoix: true,
    documentation: "https://developer.monday.com/api-reference/docs/mondaycom-mcp",
    secrets: [],
  },
  {
    id: "clickup",
    label: "ClickUp",
    description: "Tâches, listes et documents ClickUp : lire, et écrire après votre accord si l'administrateur l'a permis.",
    categorie: "Travail en équipe",
    url: "https://mcp.clickup.com/mcp",
    oauth: "auto",
    ecritureAuChoix: true,
    documentation: "https://developer.clickup.com/docs/connect-an-ai-assistant-to-clickups-mcp-server",
    secrets: [],
  },
  {
    id: "todoist",
    label: "Todoist",
    description: "Tâches, projets et étiquettes Todoist : lire, et écrire après votre accord si l'administrateur l'a permis.",
    categorie: "Travail en équipe",
    url: "https://ai.todoist.net/mcp",
    oauth: "auto",
    ecritureAuChoix: true,
    documentation: "https://github.com/Doist/todoist-mcp",
    secrets: [],
  },
  {
    id: "calendly",
    label: "Calendly",
    description: "Types de rendez-vous, disponibilités et rendez-vous pris sur Calendly : lire, et agir après votre accord si l'administrateur l'a permis.",
    categorie: "Travail en équipe",
    url: "https://mcp.calendly.com",
    oauth: "auto",
    ecritureAuChoix: true,
    documentation: "https://developer.calendly.com/docs/mcp/calendly-mcp-server",
    secrets: [],
  },

  /* ---- Services distants qui veulent une application déclarée chez eux ---- */
  {
    id: "zoom",
    label: "Zoom",
    description: "Réunions, enregistrements et résumés Zoom : lire, et créer ou modifier une réunion après votre accord si l'administrateur l'a permis.",
    categorie: "Travail en équipe",
    url: "https://mcp.zoom.us/mcp/zoom/streamable",
    oauth: "appli",
    ecritureAuChoix: true,
    console: "https://marketplace.zoom.us/develop/create",
    retourSansLocalhost: true,
    documentation: "https://developers.zoom.us/docs/mcp/servers/connect-to-zoom-mcp-servers/",
    secrets: [],
  },
  {
    id: "github",
    label: "GitHub",
    description: "Dépôts, issues, demandes de fusion et actions GitHub.",
    categorie: "Développement",
    url: "https://api.githubcopilot.com/mcp/",
    oauth: "appli",
    // La page exacte de création d'une OAuth App (https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/creating-an-oauth-app, lu le 28/09/2026).
    console: "https://github.com/settings/applications/new",
    documentation: "https://docs.github.com/apps/oauth-apps",
    secrets: [],
  },
  {
    id: "slack-mcp",
    label: "Slack",
    description: "Conversations, canaux et fichiers Slack, par le serveur de Slack.",
    categorie: "Travail en équipe",
    url: "https://mcp.slack.com/mcp",
    oauth: "appli",
    console: "https://api.slack.com/apps?new_app=1",
    // Une application interne à l'espace de travail, ou publiée dans l'annuaire de Slack : les autres n'ont pas droit au serveur MCP.
    documentation: "https://docs.slack.dev/ai/slack-mcp-server/",
    secrets: [],
  },
  {
    id: "box",
    label: "Box",
    description: "Fichiers et dossiers Box.",
    categorie: "Courrier, agenda et fichiers",
    url: "https://mcp.box.com/",
    oauth: "appli",
    /*
     * 28/09/2026 : l'identifiant et le secret ne se créent plus dans la console
     * des développeurs mais dans la console d'administration de Box
     * (« Integrations », « Box MCP server », « Add Integration Credentials ») :
     * on renvoie à la page qui le décrit.
     */
    console: "https://developer.box.com/guides/box-mcp/remote/",
    documentation: "https://developer.box.com/guides/box-mcp/remote/",
    secrets: [],
  },
  /*
   * Palmier Pro (29/09/2026, demande de Medhi) : un monteur vidéo pour Mac,
   * dont le serveur MCP n'existe que sur la machine où l'application est
   * ouverte. Rangé avec Canva et Figma, les autres outils de création. Les
   * versions récentes sont propriétaires : Helix ne les distribue pas, il parle
   * à celle que la personne a installée (palmier.ts, PROJET.md § 3.5).
   */
  {
    id: "palmier",
    label: "Palmier Pro",
    description:
      "Monter des vidéos sur la timeline de Palmier Pro, ouvert sur cette machine (Mac à puce Apple, macOS 26). Lire le projet est libre ; chaque modification et chaque génération demande votre accord, et la génération de vidéos ou d'images part vers les services de Palmier, sur les crédits de votre compte Palmier.",
    categorie: "Documents et données",
    local: { port: PORT_PALMIER, chemin: "/mcp" },
    telechargement: TELECHARGEMENT_PALMIER,
    documentation: "https://github.com/palmier-io/palmier-pro#mcp-server",
    secrets: [],
  },
  /*
   * Roblox Studio et Blender (12/10/2026, demande de Medhi : « on nous le
   * réclame »). Deux applications de création installées sur la machine de
   * l'instance, dont le serveur MCP se lance en stdio : celui de Roblox est
   * livré avec Studio (roblox.ts), celui de Blender est posé par Helix,
   * version et empreintes figées (blender.ts). Lire est libre ; modifier,
   * exécuter du code, générer se confirme à chaque appel (robloxRegles.ts,
   * blenderRegles.ts).
   */
  {
    id: "roblox",
    label: "Roblox Studio",
    description:
      "Lire et modifier la place ouverte dans Roblox Studio, sur cette machine (macOS ou Windows) : scripts, instances, essais de jeu. Lire est libre ; chaque modification, chaque code exécuté et chaque génération demande votre accord.",
    categorie: "Développement",
    lanceur: true,
    telechargement: TELECHARGEMENT_ROBLOX,
    documentation: DOCUMENTATION_ROBLOX,
    secrets: [],
  },
  {
    id: "blender",
    label: "Blender",
    description:
      "Lire et modifier la scène ouverte dans Blender, sur cette machine. Lire est libre ; chaque code exécuté, chaque import et chaque génération demande votre accord. Les bibliothèques et générateurs en ligne du module restent éteints tant que vous ne les allumez pas dans Blender.",
    categorie: "Documents et données",
    lanceur: true,
    telechargement: TELECHARGEMENT_BLENDER,
    documentation: "https://github.com/ahujasid/mcp-for-blender",
    secrets: [],
  },
  /*
   * Unreal Engine (16/10/2026, demande de Medhi) : le serveur MCP officiel
   * d'Epic, dans l'éditeur (plugin « Unreal MCP », expérimental, Unreal
   * Engine 5.8), en HTTP sur la boucle locale comme Palmier Pro. Rien n'est
   * téléchargé ni distribué ; l'éditeur est reconnu avant chaque requête
   * (unreal.ts), et tout ce qui n'est pas une lecture passe par la carte
   * (unrealRegles.ts).
   */
  {
    id: "unreal",
    label: "Unreal Engine",
    description:
      "Lire et modifier le projet ouvert dans Unreal Editor, sur cette machine, par le serveur MCP officiel d'Epic (plugin « Unreal MCP », Unreal Engine 5.8 ou plus récent). Lister les jeux d'outils est libre ; chaque action de l'éditeur (créer, modifier, exécuter, lancer des tests) demande votre accord.",
    categorie: "Développement",
    local: { port: PORT_UNREAL, chemin: CHEMIN_UNREAL },
    telechargement: TELECHARGEMENT_UNREAL,
    documentation: DOCUMENTATION_UNREAL,
    secrets: [],
  },
  {
    id: "airtable-mcp",
    label: "Airtable",
    description: "Bases, tables et enregistrements Airtable, par le serveur d'Airtable.",
    categorie: "Documents et données",
    url: "https://mcp.airtable.com/mcp",
    // Vérifié le 26/09/2026 : Airtable accepte désormais l'enregistrement automatique (un clic).
    oauth: "auto",
    documentation: "https://airtable.com/developers/web/guides/oauth-integrations",
    secrets: [],
  },

  /* ---- Serveurs exécutés sur la machine de l'instance, avec un jeton ---- */
  {
    id: "notion-jeton",
    label: "Notion (par jeton)",
    description:
      "Même service que « Notion », mais par un jeton d'intégration interne, sans passer par le navigateur.",
    categorie: "Travail en équipe",
    command: "npx",
    // 28/09/2026 : Notion dit ce serveur local « plus activement maintenu » et conseille son serveur distant (l'entrée « Notion »).
    args: ["-y", "@notionhq/notion-mcp-server@2.5.2"],
    documentation: "https://www.notion.so/profile/integrations",
    secrets: [
      {
        nom: "NOTION_TOKEN",
        libelle: "Jeton d'intégration interne",
        aide:
          "Dans Notion, ouvrez Paramètres puis Intégrations, et créez une « intégration " +
          "interne ». Copiez son jeton, puis ouvrez chaque page à partager et " +
          "utilisez « Connexions » pour y donner accès à cette intégration : Notion ne " +
          "montre au connecteur que ce que vous lui avez explicitement partagé.",
      },
    ],
  },
  {
    id: "gitlab",
    label: "GitLab",
    description: "Projets, issues et demandes de fusion GitLab.com, par le serveur de GitLab.",
    categorie: "Développement",
    /*
     * Le serveur officiel de GitLab, en un clic (vérifié le 26/09/2026 : il
     * répond 401 et son serveur d'autorisation accepte l'enregistrement
     * automatique, avec PKCE). Remplace @modelcontextprotocol/server-gitlab,
     * abandonné (« Package no longer supported »).
     */
    url: "https://gitlab.com/api/v4/mcp",
    oauth: "auto",
    documentation: "https://docs.gitlab.com/user/gitlab_duo/model_context_protocol/",
    secrets: [],
  },
  {
    id: "airtable-jeton",
    label: "Airtable (par jeton)",
    description: "Bases et enregistrements Airtable, par un jeton personnel.",
    categorie: "Documents et données",
    command: "npx",
    args: ["-y", "airtable-mcp-server@1.14.0"],
    documentation: "https://airtable.com/create/tokens",
    secrets: [
      {
        nom: "AIRTABLE_API_KEY",
        libelle: "Jeton d'accès personnel",
        aide:
          "Sur Airtable, créez un « personal access token » et ne lui donnez accès qu'aux " +
          "bases que l'agent doit voir.",
      },
    ],
  },
  {
    id: "hubspot",
    label: "HubSpot",
    description: "Contacts, entreprises et affaires HubSpot.",
    categorie: "Commerce et relation client",
    command: "npx",
    args: ["-y", "@hubspot/mcp-server@0.4.0"],
    documentation: "https://developers.hubspot.com/docs/api/private-apps",
    secrets: [
      {
        nom: "PRIVATE_APP_ACCESS_TOKEN",
        libelle: "Jeton d'application privée",
        aide:
          "Dans HubSpot, Paramètres, Intégrations, Applications privées : créez-en une et " +
          "ne cochez que les portées dont l'agent a besoin.",
      },
    ],
  },
  {
    id: "firecrawl",
    label: "Firecrawl",
    description: "Lecture et extraction de pages web, y compris celles qui demandent un rendu.",
    categorie: "Web et recherche",
    command: "npx",
    args: ["-y", "firecrawl-mcp@3.25.5"],
    documentation: "https://www.firecrawl.dev",
    secrets: [
      { nom: "FIRECRAWL_API_KEY", libelle: "Clé d'API", aide: "Elle se crée depuis votre compte Firecrawl." },
    ],
  },
  {
    id: "tavily",
    label: "Tavily",
    description: "Recherche web pensée pour les agents, avec extraits sourcés.",
    categorie: "Web et recherche",
    command: "npx",
    args: ["-y", "tavily-mcp@0.2.22"],
    documentation: "https://tavily.com",
    secrets: [
      { nom: "TAVILY_API_KEY", libelle: "Clé d'API", aide: "Elle se crée depuis votre tableau de bord Tavily." },
    ],
  },
  {
    id: "exa",
    label: "Exa",
    description: "Recherche web sémantique, et lecture du contenu trouvé.",
    categorie: "Web et recherche",
    command: "npx",
    args: ["-y", "exa-mcp-server@3.4.1"],
    documentation: "https://exa.ai",
    secrets: [
      { nom: "EXA_API_KEY", libelle: "Clé d'API", aide: "Elle se crée depuis votre tableau de bord Exa." },
    ],
  },
  {
    id: "brave",
    label: "Brave Search",
    description: "Recherche web et locale par l'API de Brave.",
    categorie: "Web et recherche",
    command: "npx",
    // Le paquet officiel de Brave (MIT) : @modelcontextprotocol/server-brave-search est abandonné.
    args: ["-y", "@brave/brave-search-mcp-server@2.1.4"],
    documentation: "https://brave.com/search/api/",
    secrets: [
      { nom: "BRAVE_API_KEY", libelle: "Clé d'API", aide: "Elle se crée sur le portail de l'API Brave Search." },
    ],
  },
  {
    id: "navigateur",
    label: "Navigateur (Playwright)",
    description:
      "Ouvre des pages dans un navigateur sans fenêtre, clique et lit. Rien ne sort de la machine.",
    categorie: "Web et recherche",
    command: "npx",
    /*
     * Playwright MCP, de Microsoft (Apache 2.0), sans fenêtre et en profil
     * isolé (rien de la navigation de la personne) : remplace
     * @modelcontextprotocol/server-puppeteer, abandonné.
     */
    args: ["-y", "@playwright/mcp@0.0.82", "--headless", "--isolated"],
    documentation: "https://github.com/microsoft/playwright-mcp",
    secrets: [],
  },
  {
    id: "documentation",
    label: "Documentation des bibliothèques",
    description:
      "Documentation à jour des bibliothèques de code, pour que le modèle cesse d'inventer des fonctions.",
    categorie: "Développement",
    command: "npx",
    args: ["-y", "@upstash/context7-mcp@4.1.1"],
    documentation: "https://context7.com",
    secrets: [],
  },
  {
    id: "memoire",
    label: "Mémoire de travail",
    description:
      "Un carnet de notes que l'agent relit d'une conversation à l'autre. Tout reste sur la machine.",
    categorie: "Livré avec le produit",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-memory@2026.8.31"],
    documentation: "https://modelcontextprotocol.io",
    secrets: [],
  },
  {
    id: "reflexion",
    label: "Réflexion par étapes",
    description:
      "Aide le modèle à poser un raisonnement en plusieurs temps avant de répondre. Rien ne sort de la machine.",
    categorie: "Livré avec le produit",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-sequential-thinking@2026.8.31"],
    documentation: "https://modelcontextprotocol.io",
    secrets: [],
  },
  {
    id: "kubernetes",
    label: "Kubernetes",
    description: "État d'un cluster Kubernetes : pods, journaux, déploiements.",
    categorie: "Développement",
    command: "npx",
    args: ["-y", "mcp-server-kubernetes@4.1.7"],
    documentation: "https://kubernetes.io/docs/",
    secrets: [
      {
        nom: "KUBECONFIG",
        libelle: "Chemin du fichier kubeconfig",
        aide:
          "Le chemin, sur la machine de l'instance, du fichier qui donne accès au cluster. " +
          "Utilisez de préférence un compte de service en lecture seule.",
      },
    ],
  },
];

export const entreeCatalogue = (id: string): EntreeCatalogue | undefined =>
  CATALOGUE.find((e) => e.id === id);

/**
 * Les applications locales du catalogue (`local`), et ce qui les concerne sur
 * cette machine : peut-elle y tourner (la fiche n'est montrée que là), sur
 * quel port elle écoute, et comment la reconnaître avant de lui parler
 * (palmier.ts). Une entrée `local` sans ligne ici n'est jamais branchée.
 */
interface ApplicationLocale {
  proposable: () => boolean;
  port: () => number;
  reconnaitre: (port: number) => Promise<VerdictEcouteur>;
  /** Un appel à la fois (Unreal Editor : outils exécutés un par un sur le fil du jeu, mcp.ts `serie`). */
  serie?: true;
  /** Ce qu'il faut dire après le branchement (Unreal Editor sans « All Toolsets »). */
  conseil?: (id: string) => Promise<string | null>;
}
const APPLICATIONS_LOCALES: Record<string, ApplicationLocale> = {
  palmier: { proposable: palmierProposable, port: portPalmier, reconnaitre: ecouteurPalmier },
  // Unreal Editor (16/10/2026) : une lecture faite par Helix au branchement, ses jeux d'outils.
  unreal: {
    proposable: unrealProposable,
    port: portUnreal,
    reconnaitre: ecouteurUnreal,
    serie: true,
    conseil: async (id) => {
      const nombre = mcpStatus().find((s) => s.id === id)?.toolCount ?? 0;
      const liste = nombre > 0 ? await appelerOutilMcp(`${id}__list_toolsets`, {}, { ecriture: false }).catch(() => null) : null;
      return conseilUnreal(liste, nombre);
    },
  },
};

/** L'application locale d'une entrée, si elle en est une et que Helix sait la reconnaître. */
function applicationLocale(entree: EntreeCatalogue | undefined) {
  return entree?.local ? APPLICATIONS_LOCALES[entree.id] : undefined;
}

/**
 * Les applications dont le serveur MCP se lance en stdio (`lanceur`, Roblox
 * Studio et Blender, 12/10/2026) : où la fiche se montre, la commande (tirée
 * de l'installation, jamais d'une requête), ce qui est vérifié avant de la
 * lancer et avant chaque appel, ce qui se prépare au clic (Blender : le
 * serveur posé par Helix), et ce qu'il faut dire après le démarrage (Roblox :
 * aucun Studio n'a activé son serveur). Une entrée `lanceur` sans ligne ici
 * n'est jamais lancée.
 */
interface ApplicationStdio {
  proposable: () => boolean;
  commande: () => { command: string; args: string[] };
  env?: () => Record<string, string>;
  avantLancement: () => Promise<string | null>;
  avantAppel?: () => Promise<string | null>;
  preparer?: () => Promise<{ ok: true } | { ok: false; message: string }>;
  /** La préparation va-t-elle remplacer des fichiers du serveur ? Il est alors arrêté avant (Blender, 12/10/2026). */
  remplaceServeur?: () => boolean;
  conseil?: (id: string) => Promise<string | null>;
  /** Pour l'écran seulement : un verdict récent suffit (Blender : pas deux PowerShell par rafraîchissement). */
  raisonPourEcran?: () => Promise<string | null>;
  /** Au retrait : ce que Helix efface, et ce qu'il faut dire de faire dans l'application. */
  retirer?: () => Promise<string | null>;
  /** Un appel à la fois, et relance du serveur après un délai dépassé (Blender, 16/10/2026 : mcp.ts, `serie`, `relancerApresDelai`). */
  serie?: true;
}
const APPLICATIONS_STDIO: Record<string, ApplicationStdio> = {
  rea:{proposable:reaProposable,commande:commandeRea,env:envRea,avantLancement:refusRea,avantAppel:refusRea,preparer:preparerRea,remplaceServeur:serveurReaAPoser,serie:true},
  roblox: {
    proposable: robloxProposable,
    commande: commandeRoblox,
    avantLancement: refusRoblox,
    // Une lecture, faite par Helix lui-même au branchement : un Studio a-t-il activé son serveur ?
    conseil: async (id) => conseilRoblox(await appelerOutilMcp(`${id}__list_roblox_studios`, {}).catch(() => null)),
  },
  blender: {
    proposable: blenderProposable,
    commande: commandeBlender,
    env: envBlender,
    avantLancement: refusBlender,
    avantAppel: refusBlender,
    preparer: preparerBlender,
    remplaceServeur: serveurBlenderAPoser,
    raisonPourEcran: refusBlenderRecent,
    serie: true,
    /*
     * Retirer Blender (relecture du 12/10/2026) : l'environnement posé par
     * Helix est effacé, et l'écran dit de décocher le module dans Blender. Tant
     * qu'il est coché, il rouvre son port (9876, sans authentification) à
     * chaque démarrage de Blender, que Helix soit branché ou non.
     */
    retirer: async () => {
      try {
        await effacerServeurBlender();
      } catch (err) {
        console.error("[blender] effacement de l'environnement :", err instanceof Error ? err.message : err);
      }
      return t("Dans Blender, décochez aussi le module « MCP for Blender » (Édition, Préférences, Modules complémentaires) : tant qu'il est coché, il garde un port ouvert sur cette machine, sans mot de passe, chaque fois que Blender tourne.");
    },
  },
};

function applicationStdio(entree: EntreeCatalogue | undefined): ApplicationStdio | undefined {
  return entree?.lanceur ? APPLICATIONS_STDIO[entree.id] : undefined;
}

/** Une application de cette machine, par la boucle locale (Palmier Pro) ou en stdio (Roblox Studio, Blender). */
const estApplication = (entree: EntreeCatalogue | undefined): boolean => Boolean(entree?.local || entree?.lanceur);

/** L'adresse d'une application locale : 127.0.0.1, son port, son chemin, rien venu d'ailleurs. */
function adresseLocale(entree: EntreeCatalogue, port: number): string {
  return `http://127.0.0.1:${port}${entree.local!.chemin}`;
}

/** Une entrée qui ne peut pas servir sur cette machine (Palmier Pro hors d'un Mac à puce Apple) n'est pas montrée. */
const visibleIci = (e: EntreeCatalogue): boolean =>
  e.lanceur ? applicationStdio(e)?.proposable() === true : !e.local || applicationLocale(e)?.proposable() === true;

/**
 * Une commande libre est-elle permise sur cette instance ?
 *
 * Non par défaut, et le défaut est le seul réglage que la plupart des
 * installations connaîtront. Le cas avancé existe — un client a son propre
 * serveur MCP interne — mais il passe par le profil de déploiement, un fichier
 * que seul l'intégrateur écrit sur la machine hôte, et non par une requête.
 */
export const commandeLibreAutorisee = (): boolean =>
  deployment().connecteursLibres === true;

/* ------------------------------------------------------------------ */
/* Persistance                                                         */
/* ------------------------------------------------------------------ */

/**
 * Collection **interne** du magasin de l'instance.
 *
 * Interne veut dire : absente de `COLLECTIONS`, donc jamais distribuée par les
 * routes de synchronisation `/helix/data/<collection>`. Un jeton Notion
 * recopié vers chaque poste du parc n'aurait plus rien d'un secret.
 *
 * Le secret est de plus chiffré **ici**, avant d'entrer dans le magasin, en
 * plus du chiffrement que le magasin en fichiers applique déjà. Ce n'est pas
 * de la superstition : l'implémentation PostgreSQL de db.ts, elle, n'appelle
 * pas `chiffrer`. Sans cette passe, un client déployé sur PostgreSQL verrait
 * ses jetons en clair dans une colonne JSONB. C'est le modèle du connecteur
 * courrier, et pour la même raison.
 */
const COLLECTION: StoredCollection = "connecteurs";

interface ConnecteurEnregistre {
  id: string;
  label: string;
  description: string;
  /** Commande locale, ou adresse distante : l'un ou l'autre, jamais les deux. */
  command?: string;
  args?: string[];
  /** Serveur MCP du service lui-même, autorisé par OAuth (oauthMcp.ts). */
  url?: string;
  /**
   * Application ouverte sur cette machine (Palmier Pro) : ni adresse ni port
   * enregistrés, ils sont relus au catalogue à chaque démarrage (`aligner`).
   */
  local?: true;
  /** Enveloppes produites par `chiffrer()`, par nom de variable. Jamais de clair. */
  secrets: Record<string, unknown>;
  depuis: string;
  /** Ajouté hors catalogue, sur une instance qui l'autorise explicitement. */
  libre?: boolean;
  /**
   * Serveur ajouté par l'administrateur depuis l'écran (16/10/2026) : la
   * commande ou l'adresse, et les outils marqués « lecture seule », **scellés**
   * par `chiffrer` à la place du connecteur (`specPerso`). Un enregistrement
   * glissé dans le magasin sans la clé de l'instance ne se déchiffre pas : il
   * n'est jamais lancé.
   */
  perso?: unknown;
}

/**
 * Connecteurs en mémoire.
 *
 * `toolsForModel()` de mcp.ts est synchrone — c'est le contrat de chat.ts, qui
 * monte la liste d'outils au début de chaque conversation — alors que la
 * lecture du magasin est asynchrone. On garde donc l'état sous la main, rempli
 * une fois au démarrage par `charger()`.
 */
let enMemoire: ConnecteurEnregistre[] = [];
/**
 * La liste n'a pas pu être lue : plus rien ne s'écrit tant qu'elle ne l'est
 * pas. Sans cela, ajouter un connecteur écrivait `[nouveau]` par-dessus tous
 * les autres et leurs secrets (revue du 26/09/2026, règle du projet).
 */
let listeIllisible = false;
let chargement: Promise<void> | null = null;

async function lire(): Promise<ConnecteurEnregistre[]> {
  const valeur = await db().read(COLLECTION);
  if (!Array.isArray(valeur)) return [];
  return valeur.filter(
    (c): c is ConnecteurEnregistre =>
      typeof c === "object" &&
      c !== null &&
      typeof (c as ConnecteurEnregistre).id === "string" &&
      (typeof (c as ConnecteurEnregistre).command === "string" ||
        typeof (c as ConnecteurEnregistre).url === "string" ||
        (c as ConnecteurEnregistre).local === true ||
        (c as ConnecteurEnregistre).perso !== undefined),
  );
}

/**
 * Place d'un secret de connecteur dans le magasin.
 *
 * Elle sert de données associées au chiffrement : l'enveloppe ne se déchiffre
 * qu'à l'endroit où elle a été écrite. Sans elle, une enveloppe recopiée
 * depuis une autre collection, ou d'un connecteur vers un autre, se serait
 * déchiffrée sans broncher. Les enveloppes d'avant (format v1, sans données
 * associées) continuent de se lire : `dechiffrer` ignore la place pour
 * celles-là, et la réclame pour les nouvelles.
 */
const placeDuSecret = (id: string, nom: string): string => `connecteurs#${id}#${nom}`;

/** Déchiffre les secrets d'un connecteur pour en faire l'environnement du serveur. */
function environnement(c: ConnecteurEnregistre): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [nom, coffre] of Object.entries(c.secrets ?? {})) {
    const clair = dechiffrer(coffre, placeDuSecret(c.id, nom));
    if (typeof clair === "string") env[nom] = clair;
  }
  if (c.id === "kubernetes" && env.KUBECONFIG) env.KUBECONFIG = kubeconfigVerifie(env.KUBECONFIG);
  return env;
}

/**
 * Un kubeconfig peut déclarer une commande (`users[].user.exec`, ou un
 * `auth-provider`) que la bibliothèque de Kubernetes lance d'elle-même au
 * premier appel. Revue de sécurité du 26/09/2026 : le champ était un chemin
 * libre, et un fichier écrit par l'agent dans l'espace de travail suffisait à
 * faire lancer n'importe quelle commande par l'instance (vérifié sur la
 * version épinglée). Le fichier est relu à chaque démarrage, refusé s'il
 * déclare une commande, et c'est une COPIE, gardée à part et lisible par
 * l'instance seule, que le serveur reçoit : changer l'original ensuite n'y
 * fait rien.
 */
function kubeconfigVerifie(chemin: string): string {
  let texte: string;
  try {
    if (statSync(chemin).size > 1_000_000) throw new Error("trop gros");
    texte = readFileSync(chemin, "utf8");
  } catch (err) {
    throw new Error(tf("kubeconfig illisible ({0}) : {1}", chemin, err instanceof Error ? err.message : String(err)));
  }
  if (/^\s*-?\s*["']?(exec|auth-provider)["']?\s*:/m.test(texte) || /"(exec|auth-provider)"\s*:/.test(texte)) {
    throw new Error(t("Ce kubeconfig déclare une commande à lancer (« exec » ou « auth-provider ») : refusé. Utilisez un compte de service avec un jeton ou un certificat."));
  }
  const dossier = join(process.env.HELIX_DATA_DIR ?? join(homedir(), ".helix", "data"), "kubeconfig");
  mkdirSync(dossier, { recursive: true, mode: 0o700 });
  const copie = join(dossier, "kubernetes.yaml");
  writeFileSync(copie, texte, { mode: 0o600 });
  chmodSync(copie, 0o600);
  return copie;
}

/*
 * Revue des connecteurs du 26/09/2026 : les serveurs locaux se lançaient par
 * `npx -y paquet`, sans version, donc avec la dernière publiée à chaque
 * démarrage, et sept de ces paquets sont abandonnés par leurs auteurs. Le
 * catalogue épingle maintenant chaque version. Un connecteur déjà installé
 * garde la commande enregistrée à son installation : on la réaligne sur le
 * catalogue, et un paquet sorti du catalogue est épinglé sur sa dernière
 * version publiée, plutôt que de suivre ce qu'on y publierait demain.
 */
const DERNIERES_VERSIONS: Record<string, string> = {
  "@modelcontextprotocol/server-github": "2025.4.8",
  "@modelcontextprotocol/server-gitlab": "2025.4.25",
  "@modelcontextprotocol/server-slack": "2025.4.25",
  "@modelcontextprotocol/server-postgres": "0.6.2",
  "@modelcontextprotocol/server-brave-search": "0.6.2",
  "@modelcontextprotocol/server-google-maps": "0.6.2",
  "@modelcontextprotocol/server-puppeteer": "2025.5.12",
};
/** Un nom de paquet npm sans version (« @portee/nom » ou « nom »). */
const sansVersion = (a: string) => /^(@[a-z0-9._-]+\/)?[a-z0-9._-]+$/i.test(a);
export function aligner(c: ConnecteurEnregistre): ConnecteurEnregistre {
  const e = CATALOGUE.find((x) => x.id === c.id);
  /*
   * Une application locale (Palmier Pro, 29/09/2026) : son entrée du catalogue
   * seule, et rien de ce que l'enregistrement porterait d'autre (une adresse ou
   * une commande glissées dans le magasin sont oubliées). Sans entrée locale
   * au catalogue, elle n'est pas déclarée.
   */
  if (c.local === true || (estApplication(e) && !c.url && !c.command)) {
    if (!applicationLocale(e) && !applicationStdio(e)) throw new Error(tf("connecteur « {0} » hors catalogue, ignoré (les connecteurs libres ne sont pas autorisés sur cette instance)", c.id));
    return { id: c.id, label: e!.label, description: e!.description, local: true, secrets: {}, depuis: c.depuis };
  }
  // Une adresse ou une commande enregistrées sous l'identifiant d'une application locale : refusées.
  if (estApplication(e)) throw new Error(tf("connecteur « {0} » hors catalogue, ignoré (les connecteurs libres ne sont pas autorisés sur cette instance)", c.id));
  /*
   * Hors régime libre, un connecteur local lance la commande du catalogue, et
   * elle seule, relue ici à chaque démarrage (revue du 26/09/2026) : le
   * chiffrement au repos accepte encore une valeur en clair (migration), et
   * qui pouvait écrire dans la base (l'hôte PostgreSQL, que SECURITE.md § 3
   * compte parmi les menaces) y aurait glissé `{command: "/bin/sh", …}`, lancé
   * au démarrage suivant. Une adresse distante n'exécute rien ici.
   */
  if (!c.url && !commandeLibreAutorisee()) {
    if (e?.command) return { ...c, command: e.command, args: [...(e.args ?? [])], libre: false };
    /*
     * Retiré du catalogue le 26/09/2026 mais encore installé ici : seulement
     * `npx -y` et son paquet connu, à sa dernière version publiée, plus des
     * arguments de position (une adresse, un dossier), jamais une option.
     */
    const args = c.args ?? [];
    const paquet = args.find((a) => DERNIERES_VERSIONS[a.replace(/(?<=.)@[^@/]+$/, "")]);
    const nom = paquet?.replace(/(?<=.)@[^@/]+$/, "");
    const autres = args.filter((a) => a !== "-y" && a !== paquet);
    if (c.command !== "npx" || !nom || autres.some((a) => a.startsWith("-"))) {
      throw new Error(tf("connecteur « {0} » hors catalogue, ignoré (les connecteurs libres ne sont pas autorisés sur cette instance)", c.id));
    }
    return { ...c, command: "npx", args: ["-y", `${nom}@${DERNIERES_VERSIONS[nom]}`, ...autres], libre: false };
  }
  /*
   * Revérification du 28/09/2026 : cinq adresses distantes ont changé
   * (Atlassian, Asana, Wix, Square, PayPal). Un connecteur branché avant garde
   * l'adresse enregistrée à son branchement, que le service ne sert plus (ou
   * plus dans le transport qu'on parle) : on le réaligne sur le catalogue,
   * qui seul décide où partent les jetons. L'autorisation obtenue pour
   * l'ancienne adresse n'est pas présentée à la nouvelle (oauthMcp.ts) : la
   * personne se reconnecte.
   */
  if (c.url) return e?.url && e.url !== c.url ? { ...c, url: e.url } : c;
  if (c.command !== "npx") return c;
  if (e?.command === "npx" && e.args) return { ...c, args: [...e.args] };
  const args = (c.args ?? []).map((a) => (sansVersion(a) && DERNIERES_VERSIONS[a] ? `${a}@${DERNIERES_VERSIONS[a]}` : a));
  return { ...c, args };
}

/**
 * Réglages non secrets d'un serveur du catalogue, passés par l'environnement.
 *
 * La mémoire de travail (`@modelcontextprotocol/server-memory`) range son
 * carnet, sans réglage, **à côté de son propre code**, c'est-à-dire dans le
 * cache de `npx` (`~/.npm/_npx/<empreinte>/…/dist/memory.jsonl`). Relevé le
 * 28/09/2026 : changer la version épinglée change l'empreinte, et le carnet
 * repartait vide sans rien dire ; vider le cache de npm l'effaçait ; et deux
 * instances du même compte partageaient le même carnet. Il est maintenant dans
 * le dossier de données de l'instance, et un carnet laissé dans le cache par
 * une version précédente y est recopié une fois.
 */
function envPublic(id: string): { envPublic?: Record<string, string> } {
  if (id !== "memoire") return {};
  const dossier = process.env.HELIX_DATA_DIR ?? join(homedir(), ".helix", "data");
  const carnet = join(dossier, "memoire.jsonl");
  try {
    mkdirSync(dossier, { recursive: true });
    if (!existsSync(carnet)) {
      const cache = join(homedir(), ".npm", "_npx");
      const anciens = (existsSync(cache) ? readdirSync(cache) : [])
        .map((d) => join(cache, d, "node_modules", "@modelcontextprotocol", "server-memory", "dist", "memory.jsonl"))
        .filter((f) => existsSync(f))
        .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
      if (anciens[0]) copyFileSync(anciens[0], carnet);
    }
  } catch (err) {
    console.error("[connecteurs] carnet de la mémoire de travail :", err instanceof Error ? err.message : err);
  }
  return { envPublic: { MEMORY_FILE_PATH: carnet } };
}

const versConfig = (brut: ConnecteurEnregistre): McpServerConfig => {
  // Un serveur ajouté par l'administrateur : tout vient de son enregistrement scellé, rien du reste (16/10/2026).
  if (brut.perso !== undefined) return configPerso(brut);
  const c = aligner(brut);
  const stdio = c.local ? applicationStdio(entreeCatalogue(c.id)) : undefined;
  if (stdio) {
    // La commande de l'application, relue maintenant ; l'environnement sans secret (Blender : la télémétrie coupée).
    const { command, args } = stdio.commande();
    return {
      id: c.id,
      label: c.label,
      description: c.description,
      command,
      args,
      env: {},
      ...(stdio.env ? { envPublic: stdio.env() } : {}),
      avantLancement: stdio.avantLancement,
      ...(stdio.avantAppel ? { avantAppel: stdio.avantAppel } : {}),
      ...(stdio.serie ? { serie: true, relancerApresDelai: true } : {}),
      autoStart: true,
    };
  }
  if (c.local) {
    const entree = entreeCatalogue(c.id)!;
    const appli = applicationLocale(entree)!;
    const port = appli.port();
    return {
      id: c.id,
      label: c.label,
      description: c.description,
      url: adresseLocale(entree, port),
      local: {
        port,
        reconnaitre: async () => {
          const v = await appli.reconnaitre(port);
          return v.ok ? null : v.message;
        },
      },
      ...(appli.serie ? { serie: true } : {}),
      autoStart: true,
    };
  }
  return c.url
    ? {
        id: c.id,
        label: c.label,
        description: c.description,
        url: c.url,
        auth: new FournisseurAutorisation(c.id, c.url, retourDe(c.id)),
        autoStart: true,
      }
    : {
        id: c.id,
        label: c.label,
        description: c.description,
        command: c.command!,
        args: c.args ?? [],
        env: environnement(c),
        autoStart: true,
        ...(c.libre === true ? { libre: true } : {}),
        ...envPublic(c.id),
      };
};

/**
 * Adresse de retour de l'autorisation, telle qu'elle a été enregistrée.
 *
 * Elle est fixée au moment où la personne clique « Se connecter », à partir de
 * l'adresse par laquelle son navigateur atteint l'instance : c'est la seule
 * qui puisse recevoir le retour. On la garde pour les rafraîchissements de
 * jeton, qui doivent présenter la même.
 */
let retoursConnus = new Map<string, string>();
const retourDe = (id: string): string => retoursConnus.get(id) ?? "";
export function memoriserRetour(id: string, retour: string): void {
  retoursConnus.set(id, retour);
}

/**
 * Relit les connecteurs enregistrés et les remet en service.
 *
 * À appeler une fois au démarrage, avant `startAutoServers()` : sans cela, la
 * première conversation après un redémarrage se verrait proposer les seuls
 * outils de fichiers, alors que l'utilisateur a bel et bien branché Notion la
 * veille et n'a aucune raison de le rebrancher.
 */
export async function charger(): Promise<void> {
  if (chargement) return chargement;
  chargement = (async () => {
    // Avant de déclarer quoi que ce soit : un connecteur distant a besoin de son
    // adresse de retour pour rafraîchir son jeton (voir `retourDe`).
    try {
      retoursConnus = await retoursEnregistres();
    } catch {
      retoursConnus = new Map();
    }
    try {
      enMemoire = await lire();
    } catch (err) {
      /*
       * Un magasin illisible — clé de chiffrement absente, par exemple — ne
       * doit pas empêcher la passerelle de démarrer : le reste de Helix
       * fonctionne sans connecteurs.
       */
      console.error(
        "[connecteurs] liste illisible :",
        err instanceof Error ? err.message : err,
      );
      enMemoire = [];
      listeIllisible = true;
      return;
    }
    listeIllisible = false;
    for (const c of enMemoire) {
      try {
        // L'écriture cochée à la connexion, avant que le serveur ne liste ses outils (SECURITE.md § 48).
        if (estMcpProjet(c.id)) definirEcriture(c.id, (await choixDe(c.id)).ecriture);
        declarer(versConfig(c));
      } catch (err) {
        console.error(
          `[connecteurs] ${c.id} non déclaré :`,
          err instanceof Error ? err.message : err,
        );
        if (c.perso !== undefined) erreursPerso.set(c.id, err instanceof Error ? err.message : String(err));
      }
    }
  })();
  return chargement;
}

async function ecrire(liste: ConnecteurEnregistre[]): Promise<void> {
  if (listeIllisible) throw new Error(t("La liste des connecteurs n'a pas pu être lue : rien n'est modifié tant qu'elle ne l'est pas. Redémarrez l'application ; si cela persiste, le trousseau ou la clé de chiffrement est en cause."));
  enMemoire = liste;
  await db().write(COLLECTION, liste);
}

/* ------------------------------------------------------------------ */
/* État affichable                                                     */
/* ------------------------------------------------------------------ */

export interface ConnecteurInstalle {
  id: string;
  label: string;
  description: string;
  /** Noms des variables renseignées. Jamais leur valeur. */
  secretsFournis: string[];
  depuis: string;
  libre: boolean;
  running: boolean;
  toolCount: number;
  error?: string;
  /** Branché par autorisation dans le navigateur, et non par un jeton collé. */
  distant?: boolean;
  /** Date de l'autorisation, pour un service distant. */
  autoriseDepuis?: string;
  /** Application ouverte sur cette machine (Palmier Pro) : « Réessayer » la rebranche quand elle a été fermée. */
  local?: true;
  /** Serveur ajouté par l'administrateur (16/10/2026) : sa sorte, ses outils et ceux marqués « lecture seule ». */
  personnalise?: DescriptionPerso;
}

export interface EtatConnecteurs {
  catalogue: EntreeCatalogue[];
  /** Rubriques, dans l'ordre d'affichage. */
  categories: Categorie[];
  installes: ConnecteurInstalle[];
  /** Le magasin chiffre-t-il réellement au repos sur cette machine ? */
  chiffrementDonnees: boolean;
  /** Le profil de déploiement autorise-t-il une commande hors catalogue ? */
  commandeLibre: boolean;
  /**
   * Ce que le demandeur peut ajouter lui-même (16/10/2026) : un serveur MCP à
   * une adresse en https (administrateur), et un programme de cette machine
   * ou un serveur sur sa boucle locale (administrateur, depuis cette machine,
   * instance fermée aux collègues ; ou instance qui autorise les serveurs
   * internes). Absent d'une instance plus ancienne.
   */
  personnalise?: { ajouter: boolean; programme: boolean };
  /** Issue du dernier retour d'autorisation, par connecteur (`issuesRetour`). */
  issues: Record<string, { ok: boolean; message: string; quand: string }>;
  /**
   * L'adresse de retour que « Se connecter » enverra au service, calculée comme
   * dans `connecter` à partir de l'adresse par laquelle ce navigateur atteint
   * l'instance (28/09/2026). Jusqu'ici, un service à application déclarée
   * (GitHub, Asana, Zoom, Slack, Box) ne la donnait que dans le message d'un
   * premier essai manqué : impossible de créer l'application avant d'avoir
   * échoué une fois.
   */
  retour?: string;
  /** La même, par service qui la réécrit (Zoom : 127.0.0.1 plutôt que « localhost »). */
  retours?: Record<string, string>;
}

/** L'adresse de retour des services distants : la route publique de l'instance, telle que le navigateur l'atteint. */
export const adresseDeRetour = (base: string, entree?: EntreeCatalogue): string =>
  `${entree?.retourSansLocalhost ? sansLocalhost(base) : base.replace(/\/+$/, "")}/helix/oauth/retour`;

/**
 * Le catalogue dans la langue de qui le lit.
 *
 * Il est écrit en français, comme constante du module : traduit au chargement,
 * il le serait une fois pour toutes, hors de toute requête, donc en français.
 * On le traduit donc ici, au moment de le servir. Les rubriques passent par la
 * même traduction que la `categorie` de chaque entrée : l'écran les rapproche
 * par égalité, les deux doivent rester identiques.
 *
 * Seuls les textes montrés changent. L'identifiant, la commande et l'adresse du
 * service restent tels quels : ce sont eux qui disent quoi exécuter.
 */
function catalogueTraduit(): EntreeCatalogue[] {
  return CATALOGUE.filter(visibleIci).map((e) => ({
    ...e,
    label: t(e.label),
    description: e.description.includes("{0}") ? tf(e.description, nomProduit()) : t(e.description),
    categorie: t(e.categorie) as Categorie,
    secrets: e.secrets.map((c) => ({ ...c, libelle: t(c.libelle), aide: t(c.aide) })),
  }));
}

/** Ce que l'interface affiche. Aucun secret n'y figure, sous aucune forme. */
export async function etat(base?: string, pour?: { administrateur: boolean; depuisCePoste: boolean }): Promise<EtatConnecteurs> {
  await charger();
  const serveurs = mcpStatus();
  relancerLocaux();

  return {
    catalogue: catalogueTraduit(),
    categories: CATEGORIES.map((c) => t(c) as Categorie),
    installes: await Promise.all(
      enMemoire.map(async (c) => {
        const vivant = serveurs.find((s) => s.id === c.id);
        /*
         * Une application locale arrêtée : sa raison est relue maintenant, dans la
         * langue de qui regarde (fermée, un autre programme sur son port…). Celle
         * que mcp.ts a gardée date du démarrage de la passerelle, souvent hors de
         * toute requête, donc dans la langue par défaut (vu à l'écran le 29/09/2026).
         */
        const arretee = c.local && vivant && !vivant.running;
        const appli = arretee ? applicationLocale(entreeCatalogue(c.id)) : undefined;
        const stdio = arretee ? applicationStdio(entreeCatalogue(c.id)) : undefined;
        const raison = appli
          ? await appli.reconnaitre(appli.port())
          : stdio
            ? await (stdio.raisonPourEcran ?? stdio.avantLancement)().then((m) => (m ? { ok: false as const, message: m } : null)).catch(() => null)
            : null;
        return {
          id: c.id,
          label: t(c.label),
          description: t(c.description),
          secretsFournis: Object.keys(c.secrets ?? {}),
          depuis: c.depuis,
          libre: c.libre === true,
          running: vivant?.running ?? false,
          toolCount: vivant?.toolCount ?? 0,
          error: raison && !raison.ok ? raison.message : (vivant?.error ?? erreursPerso.get(c.id)),
          ...(c.url ? { distant: true as const, autoriseDepuis: await oauthDepuis(c.id) } : {}),
          ...(c.local ? { local: true as const } : {}),
          ...(c.perso !== undefined ? { personnalise: descriptionPerso(c, vivant?.tools ?? [], pour?.administrateur === true) } : {}),
        };
      }),
    ),
    chiffrementDonnees: chiffrementActif(),
    commandeLibre: commandeLibreAutorisee(),
    personnalise: {
      ajouter: pour?.administrateur === true,
      programme: pour?.administrateur === true && programmePermis(pour.depuisCePoste),
    },
    issues: Object.fromEntries(issuesRetour),
    ...(base
      ? {
          retour: adresseDeRetour(base),
          retours: Object.fromEntries(CATALOGUE.filter((e) => e.retourSansLocalhost).map((e) => [e.id, adresseDeRetour(base, e)])),
        }
      : {}),
  };
}

/* ------------------------------------------------------------------ */
/* Ajout                                                               */
/* ------------------------------------------------------------------ */

export interface Resultat {
  ok: boolean;
  message: string;
}

/** Identifiant sûr : il devient un préfixe de nom d'outil et une clé de magasin. */
const ID_VALIDE = /^[a-z0-9][a-z0-9_-]{0,31}$/;

/*
 * Identifiants des connecteurs intégrés. Un serveur MCP libre qui prendrait
 * l'un d'eux emprunterait leur préfixe d'outils (`courrier__…`) et, avec lui,
 * leur classement « lecture seule » dans la barrière d'approbation, ou leur
 * place dans la puce « Outils ». Ils sont donc refusés à l'ajout.
 */
/*
 * Les préfixes des outils intégrés : un connecteur qui en prendrait un
 * hériterait de leur traitement par la barrière (approbation.ts, `modifie`).
 * `code`, `connaissances` et `taches` manquaient (revue du 26/09/2026) : un
 * connecteur libre nommé « code » voyait son outil `read` passer sans carte.
 */
/*
 * Et ceux des connexions natives (outilsNatifs.ts, 28/09/2026) : un serveur
 * nommé « linkedin » aurait apporté des `linkedin__profil` que la barrière
 * range parmi les lectures. Et ceux du commerce (natifs/commerce.ts, § 47).
 */
const IDS_RESERVES = new Set(["rea","vps","courrier", "agenda", "drive", "slack", "bureau", "ecran", "bibliotheque", "reunions", "controle", "code", "connaissances", "taches", "machine", "helix", "web", "sheets", "slides", "youtube", "linkedin", "facebook", "instagram", "tiktok", "x", "docs", "forms", "dropbox", "telegram", "discord", "whatsapp", "stripe", "shopify", "woocommerce", "salesforce", "pipedrive", "zendesk", "brevo", "mailchimp", "microsoft", "outlook", "onedrive", "sharepoint", "excel", "word", "teams"]);

/**
 * Ce que la requête a le droit d'apporter, selon le régime de l'instance.
 *
 * Deux chemins, et un seul est ouvert par défaut. Sur le chemin du catalogue,
 * `command` et `args` sont pris dans la constante de Helix et **ce que la
 * requête contient à ces noms est ignoré** : c'est la propriété qui rend la
 * route inoffensive, quelle que soit l'imagination de l'appelant.
 */
function resoudreCommande(
  brut: Record<string, unknown>,
):
  | { ok: true; id: string; label: string; description: string; command: string; args: string[]; libre: boolean; attendus: ChampSecret[] }
  | { ok: false; message: string } {
  const id = typeof brut.id === "string" ? brut.id.trim().toLowerCase() : "";
  /*
   * Ni `__` ni souligné final (28/09/2026) : `__` sépare le serveur de l'outil
   * dans le nom donné au modèle. Un serveur « fichiers_ » aurait produit des
   * `fichiers___…`, que la barrière lit comme des outils du serveur de fichiers.
   */
  if (!ID_VALIDE.test(id) || id.includes("__") || id.endsWith("_")) {
    return {
      ok: false,
      message: t("Identifiant de connecteur invalide : lettres minuscules, chiffres, tiret et souligné, 32 caractères au plus."),
    };
  }

  if (IDS_RESERVES.has(id)) {
    return {
      ok: false,
      message: tf("« {0} » est le nom d'un connecteur intégré : choisissez un autre identifiant.", id),
    };
  }

  const entree = entreeCatalogue(id);

  if (entree) {
    if (estApplication(entree)) {
      return {
        ok: false,
        message: tf("« {0} » se branche d'un clic, quand l'application est ouverte sur cette machine : utilisez « Brancher ».", entree.label),
      };
    }
    if (entree.url) {
      return {
        ok: false,
        message: tf("« {0} » se branche d'un clic : utilisez « Se connecter », rien n'est à installer.", entree.label),
      };
    }
    if (entree.integre || !entree.command) {
      return {
        ok: false,
        message: tf("« {0} » est livré avec {1} : il est déjà là et n'a pas à être ajouté.", entree.label, nomProduit()),
      };
    }
    return {
      ok: true,
      id,
      label: entree.label,
      description: entree.description,
      command: entree.command,
      args: entree.args ?? [],
      libre: false,
      attendus: entree.secrets,
    };
  }

  /*
   * Hors catalogue. C'est le point où la passerelle offrirait l'exécution de
   * code à distance si elle disait oui : le refus est donc le comportement
   * normal, et l'autorisation vient d'un fichier posé sur la machine hôte par
   * l'intégrateur, jamais d'un en-tête, d'un rôle ni d'un réglage d'interface.
   */
  if (!commandeLibreAutorisee()) {
    return {
      ok: false,
      message: tf(
        "Aucun connecteur « {0} » dans le catalogue de {1}, et cette instance n'autorise pas les commandes libres. Un serveur MCP est un programme exécuté sur cette machine : {1} ne lance que les commandes de son catalogue. Pour un serveur interne, l'intégrateur doit régler « connecteursLibres » sur true dans helix.config.json.",
        id,
        nomProduit(),
      ),
    };
  }

  const command = typeof brut.command === "string" ? brut.command.trim() : "";
  if (!command) {
    return { ok: false, message: t("Indiquez la commande à exécuter.") };
  }
  const args = Array.isArray(brut.args)
    ? brut.args.filter((a): a is string => typeof a === "string")
    : [];
  const label = typeof brut.label === "string" && brut.label.trim() ? brut.label.trim() : id;

  return {
    ok: true,
    id,
    label,
    description:
      typeof brut.description === "string" && brut.description.trim()
        ? brut.description.trim()
        : "Connecteur ajouté par l'intégrateur.",
    command,
    args,
    libre: true,
    /*
     * Une commande libre n'a pas de champs déclarés : on accepte les variables
     * telles qu'elles sont fournies. Elles resteront chiffrées et passeront
     * quand même par l'environnement, jamais par la ligne de commande.
     */
    attendus: [],
  };
}

/** Récupère les secrets de la requête, en n'acceptant que des chaînes non vides. */
function collecterSecrets(
  brut: Record<string, unknown>,
  attendus: ChampSecret[],
  libre: boolean,
): { ok: true; secrets: Record<string, string> } | { ok: false; message: string } {
  const fournis =
    typeof brut.secrets === "object" && brut.secrets !== null
      ? (brut.secrets as Record<string, unknown>)
      : {};

  const secrets: Record<string, string> = {};

  if (libre) {
    for (const [nom, valeur] of Object.entries(fournis)) {
      // Un nom de variable d'environnement, et rien d'autre : le reste n'a
      // aucune chance d'être lu par le serveur et brouillerait le diagnostic.
      if (!/^[A-Z][A-Z0-9_]*$/.test(nom)) continue;
      if (typeof valeur === "string" && valeur) secrets[nom] = valeur;
    }
    return { ok: true, secrets };
  }

  for (const champ of attendus) {
    const valeur = fournis[champ.nom];
    if (typeof valeur !== "string" || !valeur.trim()) {
      return { ok: false, message: tf("Renseignez « {0} ».", champ.libelle) };
    }
    secrets[champ.nom] = valeur.trim();
  }
  return { ok: true, secrets };
}

/**
 * Ajoute un connecteur, après l'avoir essayé.
 *
 * L'ordre compte, comme pour le courrier : on démarre le serveur et on liste
 * ses outils **avant** d'écrire quoi que ce soit. Un connecteur enregistré mais
 * incapable de démarrer est le pire des cas — l'utilisateur croit Notion
 * branché, l'agent ne voit aucun outil, et personne ne sait où est l'erreur.
 */
export async function ajouter(brut: unknown, qui: string): Promise<Resultat> {
  if (!brut || typeof brut !== "object") {
    return { ok: false, message: t("Aucun connecteur fourni.") };
  }
  await charger();

  const verdict = resoudreCommande(brut as Record<string, unknown>);
  if (!verdict.ok) return verdict;

  if (enMemoire.some((c) => c.id === verdict.id)) {
    return {
      ok: false,
      message: tf("« {0} » est déjà connecté. Retirez-le d'abord pour le reconfigurer.", verdict.label),
    };
  }
  /*
   * Un identifiant déjà porté par un serveur livré avec Helix serait écrasé :
   * les outils du nouveau venu prendraient la place de ceux des fichiers, sous
   * le même préfixe, et la barrière d'approbation les classerait avec les mauvais.
   */
  if (estDeclare(verdict.id)) {
    return {
      ok: false,
      message: tf("L'identifiant « {0} » est déjà utilisé par un serveur de cette instance.", verdict.id),
    };
  }

  const recolte = collecterSecrets(
    brut as Record<string, unknown>,
    verdict.attendus,
    verdict.libre,
  );
  if (!recolte.ok) return recolte;

  /*
   * Refus net plutôt que dégradation silencieuse. Un jeton d'intégration donne
   * accès à l'espace de travail de l'entreprise : l'écrire en clair sur le
   * disque, même en le disant, n'est pas un compromis acceptable.
   */
  if (Object.keys(recolte.secrets).length > 0 && !chiffrementActif()) {
    return {
      ok: false,
      message: tf(
        "Le chiffrement des données n'est pas actif sur cette machine : {0} refuse d'enregistrer un jeton d'accès en clair. Déverrouillez le trousseau du compte hôte, ou réglez « chiffrement » sur « fichier » dans helix.config.json, puis recommencez.",
        nomProduit(),
      ),
    };
  }

  const config: McpServerConfig = {
    id: verdict.id,
    label: verdict.label,
    description: verdict.description,
    command: verdict.command,
    args: verdict.args,
    env: recolte.secrets,
    autoStart: true,
    ...(verdict.libre ? { libre: true } : {}),
    ...envPublic(verdict.id),
  };

  declarer(config);
  const demarrage = await startServer(verdict.id);
  if (!demarrage.ok) {
    // Rien n'est écrit : un échec ne laisse aucune trace sur le disque.
    await retirerServeur(verdict.id);

    /*
     * La cause probable d'abord, le détail brut ensuite. L'utilisateur qui
     * branche Notion a besoin de savoir quoi reprendre ; le message du serveur,
     * en anglais et souvent obscur, ne sert qu'au diagnostic — et il a déjà été
     * débarrassé du secret par `mcp.ts` avant d'arriver ici.
     */
    // Traduits le 28/09/2026 (revérification des connecteurs) : ces messages étaient montrés en français dans toutes les langues.
    const conseil = verdict.attendus.length > 0 || verdict.libre
      ? t("Vérifiez que le jeton saisi est valide, et que cette machine a accès à Internet.")
      : t("Vérifiez que cette machine a accès à Internet.");

    return {
      ok: false,
      message:
        tf("« {0} » n'a pas démarré. {1}", t(verdict.label), conseil) +
        (demarrage.error ? ` ${tf("Détail technique : {0}", demarrage.error)}` : ""),
    };
  }

  const enregistre: ConnecteurEnregistre = {
    id: verdict.id,
    label: verdict.label,
    description: verdict.description,
    command: verdict.command,
    args: verdict.args,
    secrets: Object.fromEntries(
      Object.entries(recolte.secrets).map(([nom, valeur]) => [
        nom,
        chiffrer(valeur, placeDuSecret(verdict.id, nom)),
      ]),
    ),
    depuis: new Date().toISOString(),
    ...(verdict.libre ? { libre: true } : {}),
  };

  await ecrire([...enMemoire, enregistre]);

  /*
   * Le journal nomme qui a branché quoi, et avec quelle commande. Jamais le
   * secret, ni même les noms des variables suffiraient : ce sont les valeurs
   * qui sont sensibles, et elles ne sortent pas d'ici.
   */
  journaliser("connecteur.ajoute", qui, {
    connecteur: verdict.id,
    commande: `${verdict.command} ${verdict.args.join(" ")}`.trim(),
    horsCatalogue: verdict.libre,
    outils: mcpStatus().find((s) => s.id === verdict.id)?.toolCount ?? 0,
  });

  const outils = mcpStatus().find((s) => s.id === verdict.id)?.toolCount ?? 0;
  return {
    ok: true,
    // Une phrase par nombre, comme pour les services distants (28/09/2026) : « outil(s) » restait tel quel en chinois et en japonais.
    message:
      outils > 1
        ? tf("« {0} » est connecté : {1} outils disponibles pour vos agents.", t(verdict.label), outils)
        : tf("« {0} » est connecté : {1} outil disponible pour vos agents.", t(verdict.label), outils),
  };
}

/* ------------------------------------------------------------------ */
/* Retrait                                                             */
/* ------------------------------------------------------------------ */

/**
 * Retire un connecteur : son serveur s'arrête, ses outils disparaissent de la
 * conversation suivante, et son secret est effacé du disque.
 */
export async function retirer(id: string, qui: string): Promise<Resultat> {
  await charger();

  const connecteur = enMemoire.find((c) => c.id === id);
  if (!connecteur) {
    return {
      ok: false,
      message: entreeCatalogue(id)?.integre
        ? tf("Ce serveur est livré avec {0} et ne peut pas être retiré.", nomProduit())
        : tf("Aucun connecteur « {0} » sur cette instance.", id),
    };
  }

  await retirerServeur(id);
  await ecrire(enMemoire.filter((c) => c.id !== id));
  /*
   * Et l'autorisation avec. Retirer un service en gardant son jeton
   * d'accès reviendrait à laisser une clé dans une porte qu'on dit avoir
   * fermée : le jeton resterait valable chez le fournisseur.
   */
  if (connecteur.url) await oublierOauth(id, qui);
  // Un serveur ajouté par l'administrateur, à une adresse : son autorisation aussi (16/10/2026).
  if (connecteur.perso !== undefined) {
    if (lecturesPerso.get(id)?.adresse) await oublierOauth(id, qui);
    lecturesPerso.delete(id);
  }
  definirEcriture(id, false);
  // Une application en stdio (Blender) : ce que Helix avait posé pour elle, et ce qu'il reste à faire dans l'application.
  const stdio = connecteur.local ? applicationStdio(entreeCatalogue(id)) : undefined;
  const apres = stdio?.retirer ? await stdio.retirer().catch(() => null) : null;

  journaliser("connecteur.retire", qui, { connecteur: id, ...(connecteur.perso !== undefined ? { personnalise: true } : {}) });

  const retire = tf("« {0} » a été retiré de cette instance.", t(connecteur.label));
  return { ok: true, message: apres ? `${retire} ${apres}` : retire };
}

/* ------------------------------------------------------------------ */
/* Se connecter : l'autorisation dans le navigateur                     */
/* ------------------------------------------------------------------ */

/**
 * Lance, ou achève, l'autorisation d'un service distant.
 *
 * Trois issues possibles, et l'interface les distingue :
 *  - `pret` : l'instance est déjà autorisée, le service est branché ;
 *  - `adresse` : il faut ouvrir cette page dans le navigateur de la personne.
 *    C'est le service qui l'affiche, chez lui, avec son logo et sa liste de
 *    permissions ; Helix ne voit jamais le mot de passe ;
 *  - un message d'erreur.
 *
 * `base` est l'adresse par laquelle le navigateur atteint l'instance : elle
 * vient de la requête, parce que c'est la seule que le service pourra
 * rappeler. Sur un poste, c'est 127.0.0.1 ; sur une instance d'entreprise,
 * son nom de domaine.
 */
export async function connecter(
  id: string,
  qui: string,
  base: string,
  identifiants?: { clientId?: unknown; clientSecret?: unknown },
  /** Trello, Monday… : l'administrateur a coché l'écriture (SECURITE.md § 48). */
  ecriture?: unknown,
): Promise<{ ok: true; pret?: true; adresse?: string; message: string } | { ok: false; message: string }> {
  await charger();
  // Un serveur ajouté par l'administrateur : « Réessayer » ou « Se reconnecter » (16/10/2026).
  if (!entreeCatalogue(id) && enMemoire.some((c) => c.id === id && c.perso !== undefined)) return rebrancherPerso(id, qui, base);
  const entree = entreeCatalogue(id);
  // Une application ouverte sur cette machine : ni navigateur, ni jeton à garder (Palmier Pro, 29/09/2026).
  if (entree && estApplication(entree)) {
    const r = await brancherLocal(entree, qui);
    return r.ok ? { ok: true, pret: true, message: r.message } : r;
  }
  if (!entree?.url) {
    return { ok: false, message: t("Ce connecteur ne se branche pas par le navigateur.") };
  }

  /*
   * Un jeton d'accès va être conservé : s'il ne peut pas l'être chiffré, on
   * refuse, comme pour les connecteurs par jeton. Mieux vaut ne pas brancher
   * que brancher en laissant un secret en clair sur le disque.
   */
  if (!chiffrementActif()) {
    return {
      ok: false,
      message: tf(
        "Le chiffrement des données n'est pas actif sur cette machine : {0} refuse d'y conserver un jeton d'accès. Déverrouillez le trousseau du compte hôte, ou réglez « chiffrement » sur « fichier » dans helix.config.json.",
        nomProduit(),
      ),
    };
  }

  const retour = adresseDeRetour(base, entree);
  // Une nouvelle demande : l'issue de la précédente ne vaut plus pour elle.
  issuesRetour.delete(id);
  memoriserRetour(id, retour);
  await noterDemandeur(id, entree.url, qui);

  /*
   * Projets et rendez-vous (SECURITE.md § 48) : les portées de lecture, et
   * celles d'écriture si elles sont cochées, demandées explicitement (sans
   * elles, le SDK demanderait toutes celles que le service publie), et
   * retenues pour être relues au retour.
   */
  const projet = estMcpProjet(id);
  const avecEcriture = projet && ecriture === true;
  const portees = projet ? porteesDemandees(id, avecEcriture) : undefined;
  if (projet) await noterChoix(id, entree.url, avecEcriture, portees);

  const fournisseur = new FournisseurAutorisation(id, entree.url, retour);
  // Un accès gardé d'une connexion précédente aurait les portées d'alors : on redemande.
  if (projet) await fournisseur.invalidateCredentials("tokens");

  /*
   * Service qui n'accepte pas l'enregistrement dynamique : une personne a créé
   * une application chez lui et colle ici son identifiant. On l'enregistre une
   * fois pour toutes, et les fois suivantes il n'y a plus rien à saisir.
   */
  if (entree.oauth === "appli") {
    const dejaLa = await fournisseur.clientInformation();
    const donne = typeof identifiants?.clientId === "string" && identifiants.clientId.trim();
    if (!dejaLa && !donne) {
      return {
        ok: false,
        message: entree.console
          ? tf("{0} demande une application déclarée chez lui. Créez-la sur {1}, indiquez {2} comme adresse de retour, puis collez son identifiant ici.", t(entree.label), entree.console, retour)
          : tf("{0} demande une application déclarée chez lui. Créez-la, indiquez {1} comme adresse de retour, puis collez son identifiant ici.", t(entree.label), retour),
      };
    }
    if (donne) {
      await fournisseur.saveClientInformation({
        client_id: String(identifiants!.clientId).trim(),
        ...(typeof identifiants?.clientSecret === "string" && identifiants.clientSecret.trim()
          ? { client_secret: identifiants.clientSecret.trim() }
          : {}),
      });
    }
  }

  let resultat: string;
  try {
    resultat = await auth(fournisseur as never, { serverUrl: entree.url, ...(portees ? { scope: portees } : {}) });
  } catch (err) {
    return {
      ok: false,
      message: tf("{0} n'a pas pu être contacté : {1}", t(entree.label), err instanceof Error ? err.message : String(err)),
    };
  }

  if (resultat === "AUTHORIZED") {
    if (projet) definirEcriture(id, avecEcriture);
    const r = await brancherDistant(entree, qui);
    return r.ok ? { ok: true, pret: true, message: r.message } : r;
  }

  if (!fournisseur.adresseAutorisation) {
    return { ok: false, message: tf("{0} n'a pas indiqué de page d'autorisation.", t(entree.label)) };
  }
  journaliser("connecteur.ajoute", qui, { connecteur: id, etape: "autorisation demandée" });
  return {
    ok: true,
    adresse: fournisseur.adresseAutorisation,
    message: tf("Autorisez {0} dans la page qui vient de s'ouvrir.", t(entree.label)),
  };
}

/**
 * Achève l'autorisation : le service renvoie la personne ici avec un code.
 *
 * Route publique, par nécessité — c'est un navigateur qui arrive, sans jeton
 * d'instance ni séance. Ce qui la protège est le `state` : une valeur tirée au
 * hasard, retenue au départ, et sans laquelle le code ne mène à rien. Le code
 * lui-même ne vaut qu'avec le vérificateur PKCE, qui n'a jamais quitté
 * l'instance.
 */
export async function acheverAutorisation(
  code: string,
  etat: string,
): Promise<{ ok: boolean; message: string; label?: string }> {
  const attendu = await connecteurDuRetour(etat);
  if (!attendu) return { ok: false, message: t("Cette autorisation n'est plus en attente.") };
  const r = await achever(attendu, code);
  noterIssue(attendu.id, r);
  return r;
}

/**
 * Issue du dernier retour d'autorisation, par connecteur (revue du
 * 28/09/2026). L'écran qui attend l'accord (Connecteurs.tsx) ne voyait que
 * « branché » ou rien : un refus dans la page du service, un échange refusé ou
 * un serveur muet après l'accord laissaient « En attente de votre accord… »
 * cinq minutes, puis le bouton revenait sans un mot ; seule la page ouverte
 * dans le navigateur disait pourquoi. En mémoire seulement : rien de secret,
 * et rien à garder après un redémarrage.
 */
const issuesRetour = new Map<string, { ok: boolean; message: string; quand: string }>();
function noterIssue(id: string, r: { ok: boolean; message: string }): void {
  issuesRetour.set(id, { ok: r.ok, message: r.message, quand: new Date().toISOString() });
}

/**
 * Le service a renvoyé une erreur au lieu d'un code (`error=access_denied`…).
 * Un `state` qui n'attend rien ne touche à rien. Le message est celui que la
 * page de retour montre (index.ts), sans le texte du service : la cause
 * probable et le remède, lus au seul code du protocole (refusOauth.ts,
 * 28/09/2026). Rend `null` pour un `state` inconnu.
 */
export async function refuserAutorisation(etat: string, code: string): Promise<string | null> {
  if (!etat) return null;
  const attendu = await connecteurDuRetour(etat).catch(() => null);
  if (!attendu) return null;
  const nom = t(entreeCatalogue(attendu.id)?.label ?? attendu.id);
  const message = refusLisible(code, nom);
  noterIssue(attendu.id, { ok: false, message });
  return message;
}

async function achever(
  attendu: { id: string; url: string; retour: string; pour?: string },
  code: string,
): Promise<{ ok: boolean; message: string; label?: string }> {
  const entree = entreeCatalogue(attendu.id);
  if (!entree && enMemoire.some((c) => c.id === attendu.id && c.perso !== undefined)) return acheverPerso(attendu, code);
  if (!entree?.url) return { ok: false, message: t("Connecteur inconnu.") };

  const fournisseur = new FournisseurAutorisation(attendu.id, entree.url, attendu.retour);
  const choix = estMcpProjet(attendu.id) ? await choixDe(attendu.id) : null;
  try {
    const resultat = await auth(fournisseur as never, {
      serverUrl: entree.url,
      authorizationCode: code,
      ...(choix?.portees ? { scope: choix.portees } : {}),
    });
    if (resultat !== "AUTHORIZED") {
      return { ok: false, message: tf("{0} n'a pas accordé l'autorisation.", t(entree.label)) };
    }
  } catch (err) {
    return {
      ok: false,
      message: tf("Échange refusé par {0} : {1}", t(entree.label), err instanceof Error ? err.message : String(err)),
    };
  }

  /*
   * Projets et rendez-vous (SECURITE.md § 48) : la portée accordée est relue.
   * Un accès qui déborde de ce qui a été demandé (l'écriture sans l'avoir
   * cochée, par exemple) n'est pas gardé : règle du § 40.
   */
  if (choix) {
    const enTrop = porteesEnTrop(choix.portees, ((await fournisseur.tokens()) ?? {}).scope);
    if (enTrop.length > 0) {
      // Le jeton seulement : l'application déclarée (Zoom) reste, pour qu'on puisse recommencer sans la recoller.
      await fournisseur.invalidateCredentials("tokens");
      journaliser("connecteur.retire", attendu.pour ?? "systeme", { connecteur: attendu.id, motif: "portee en trop" });
      return { ok: false, message: tf("{0} a accordé plus que ce qui était demandé ({1}). Par prudence, rien n'a été enregistré : retirez aussi l'accès dans les réglages de votre compte {0}.", entree.label, enTrop.slice(0, 10).join(", ")) };
    }
    definirEcriture(attendu.id, choix.ecriture);
  }

  memoriserRetour(attendu.id, attendu.retour);
  const r = await brancherDistant(entree, attendu.pour ?? "systeme");
  return { ...r, label: t(entree.label) };
}

/** Enregistre et démarre un service distant, une fois l'autorisation obtenue. */
async function brancherDistant(
  entree: EntreeCatalogue,
  qui: string,
): Promise<{ ok: true; message: string } | { ok: false; message: string }> {
  await charger();
  const enregistre: ConnecteurEnregistre = {
    id: entree.id,
    label: entree.label,
    description: entree.description,
    url: entree.url!,
    secrets: {},
    depuis: new Date().toISOString(),
  };

  declarer(versConfig(enregistre));
  const demarrage = await startServer(entree.id);
  if (!demarrage.ok) {
    await retirerServeur(entree.id);
    return {
      ok: false,
      message: tf("{0} a autorisé l'accès, mais son serveur n'a pas répondu : {1}.", t(entree.label), demarrage.error ?? t("cause inconnue")),
    };
  }

  const sansDoublon = enMemoire.filter((c) => c.id !== entree.id);
  await ecrire([...sansDoublon, enregistre]);
  journaliser("connecteur.ajoute", qui, { connecteur: entree.id, distant: true });

  const outils = mcpStatus().find((s) => s.id === entree.id)?.toolCount ?? 0;
  // Une phrase par nombre (28/09/2026) : les « s » collés restaient tels quels en chinois.
  return {
    ok: true,
    message:
      outils > 1
        ? tf("{0} est branché : {1} outils disponibles.", t(entree.label), outils)
        : tf("{0} est branché : {1} outil disponible.", t(entree.label), outils),
  };
}

/**
 * Branche une application ouverte sur cette machine (Palmier Pro).
 *
 * Dans l'ordre, et rien n'est envoyé au port avant la fin du deuxième point :
 *  1. la machine peut-elle la faire tourner (Mac à puce Apple, macOS 26) ;
 *  2. le programme qui écoute sur son port est-il l'application, signée par
 *     son éditeur (palmier.ts) : fermée, on dit de l'ouvrir ; un autre
 *     programme, on le dit, sans lui parler ;
 *  3. le serveur démarre et liste ses outils, puis seulement on enregistre.
 * Déjà branchée (l'application avait été fermée) : la connexion est rouverte.
 */
async function brancherLocal(
  entree: EntreeCatalogue,
  qui: string,
): Promise<{ ok: true; message: string } | { ok: false; message: string }> {
  const appli = applicationLocale(entree);
  const stdio = applicationStdio(entree);
  if (!(appli?.proposable() || stdio?.proposable())) {
    return { ok: false, message: tf("{0} ne peut pas tourner sur la machine de cette instance.", t(entree.label)) };
  }
  if (appli) {
    const verdict = await appli.reconnaitre(appli.port());
    if (!verdict.ok) return { ok: false, message: verdict.message };
  } else if (stdio) {
    /*
     * Blender : le serveur posé au premier clic (empreintes vérifiées), puis
     * Blender doit répondre. Une mise à jour (autre version épinglée) remplace
     * les fichiers du serveur : celui qui tourne est arrêté d'abord (sous
     * Windows, il les tient ouverts), relecture du 12/10/2026.
     */
    if (stdio.remplaceServeur?.() && enMemoire.some((c) => c.id === entree.id)) await stopServer(entree.id);
    const prepare = stdio.preparer ? await stdio.preparer() : ({ ok: true } as const);
    if (!prepare.ok) return { ok: false, message: prepare.message };
    const refus = await stdio.avantLancement();
    if (refus) return { ok: false, message: refus };
  }

  const deja = enMemoire.find((c) => c.id === entree.id);
  const enregistre: ConnecteurEnregistre = deja ?? {
    id: entree.id,
    label: entree.label,
    description: entree.description,
    local: true,
    secrets: {},
    depuis: new Date().toISOString(),
  };
  if (deja) await stopServer(entree.id);
  declarer(versConfig(enregistre));
  const demarrage = await startServer(entree.id);
  if (!demarrage.ok) {
    if (!deja) await retirerServeur(entree.id);
    // En stdio (Roblox Studio, Blender), c'est le programme lancé par Helix qui a échoué : « est ouvert » n'est vérifié que pour Palmier Pro (relecture du 12/10/2026).
    return {
      ok: false,
      message: stdio
        ? tf("Le serveur d'outils de {0} n'a pas démarré : {1}", t(entree.label), demarrage.error ?? t("cause inconnue"))
        : tf("{0} est ouvert, mais son serveur d'outils n'a pas répondu : {1}", t(entree.label), demarrage.error ?? t("cause inconnue")),
    };
  }
  if (!deja) await ecrire([...enMemoire, enregistre]);
  const outils = mcpStatus().find((s) => s.id === entree.id)?.toolCount ?? 0;
  journaliser("connecteur.ajoute", qui, { connecteur: entree.id, local: true, outils, ...(deja ? { etape: "rebranché" } : {}) });
  const branche =
    outils > 1
      ? tf("{0} est branché : {1} outils disponibles.", t(entree.label), outils)
      : tf("{0} est branché : {1} outil disponible.", t(entree.label), outils);
  const conseil = stdio?.conseil ? await stdio.conseil(entree.id).catch(() => null) : appli?.conseil ? await appli.conseil(entree.id).catch(() => null) : null;
  return { ok: true, message: conseil ? `${branche} ${conseil}` : branche };
}

/**
 * Une application locale branchée mais arrêtée (fermée au démarrage de la
 * passerelle, ou depuis) : l'écran des connecteurs et le menu « Outils »
 * relancent sa connexion en passant, au plus une fois par quinze secondes.
 * Sans cela, Palmier Pro ouvert après la passerelle restait sans outils
 * jusqu'à « Réessayer ». Un serveur éteint par sa bascule ne l'est pas
 * (`relancable`, mcp.ts).
 */
const derniereRelance = new Map<string, number>();
function relancerLocaux(): void {
  const maintenant = Date.now();
  for (const c of enMemoire) {
    if (!c.local || !relancable(c.id)) continue;
    if (maintenant - (derniereRelance.get(c.id) ?? 0) < 15_000) continue;
    derniereRelance.set(c.id, maintenant);
    void startServer(c.id).catch(() => undefined);
  }
}

/* ------------------------------------------------------------------ */
/* Serveurs MCP ajoutés par l'administrateur                            */
/* ------------------------------------------------------------------ */

/*
 * « Créer son propre MCP » (16/10/2026, demande de Medhi). Jusqu'ici, un
 * serveur hors catalogue ne s'ajoutait que sur une instance réglée par
 * l'intégrateur (`connecteursLibres`), et l'écran n'avait aucun champ pour
 * cela. La règle d'origine tient (SECURITE.md § 6.1 : l'interface ne choisit
 * pas ce qui tourne sur la machine de l'entreprise), avec une porte étroite :
 *  - à une **adresse en https** (rien ne tourne ici) : l'administrateur ;
 *  - un **programme de cette machine**, ou un serveur sur sa **boucle locale** :
 *    l'administrateur, depuis cette machine même, sur une instance fermée aux
 *    collègues ; c'est alors la personne assise devant son poste, qui pourrait
 *    lancer ce programme elle-même. Une instance ouverte au réseau garde la
 *    règle d'avant : l'intégrateur seul (`connecteursLibres`). Même barrière
 *    que l'import depuis les logiciels du poste (index.ts, `depuisCePoste`).
 * Sans interpréteur de commandes ni code en ligne (mcpPersoRegles.ts), avec
 * l'environnement minimal du SDK (jamais celui de la passerelle) plus les
 * variables que l'administrateur donne, chiffrées. Tout outil demande l'accord
 * (`modifie`), sauf ceux que l'administrateur marque « lecture seule ».
 * L'enregistrement est scellé par la clé de l'instance : glissé dans le
 * magasin par qui n'a pas cette clé, il n'est jamais lancé. SECURITE.md § 67.
 */

type SpecPerso =
  | { mode: "programme"; command: string; args: string[]; lectures: string[] }
  | { mode: "adresse"; url: string; lectures: string[] };

export interface DescriptionPerso {
  mode: "programme" | "adresse";
  /** La commande et ses arguments, ou l'adresse : pour l'administrateur seulement. */
  cible?: string;
  /** Les outils marqués « lecture seule » par l'administrateur. */
  lectures: string[];
  outils: { nom: string; description: string }[];
}

/** Par serveur ajouté : ses outils « lecture seule », et s'il est à une adresse (son autorisation s'oublie au retrait). */
const lecturesPerso = new Map<string, { lectures: Set<string>; adresse: boolean }>();
/** Pourquoi un serveur ajouté n'a pas été déclaré au démarrage (programme disparu, instance ouverte depuis…). */
const erreursPerso = new Map<string, string>();

definirLecturesPerso((outil) => {
  const o = outilDuModele(outil);
  return Boolean(o && lecturesPerso.get(o.serverId)?.lectures.has(o.toolName));
});

const placePerso = (id: string): string => `connecteurs#${id}#personnalise`;

/** L'instance sert-elle d'autres personnes ? (même règle qu'index.ts, `instancePartagee`) */
const instanceOuverte = (): boolean => deployment().share === true || surLeReseau();

/** Ce connecteur est-il un serveur ajouté par l'administrateur ? */
export async function estConnecteurPersonnalise(id: string): Promise<boolean> {
  await charger();
  return enMemoire.some((c) => c.id === id && c.perso !== undefined);
}

/** Un programme de cette machine, ou un serveur sur sa boucle, peut-il être ajouté par cette demande ? */
export const programmePermis = (depuisCePoste: boolean): boolean => commandeLibreAutorisee() || (depuisCePoste && !instanceOuverte());

/** L'enregistrement scellé d'un serveur ajouté, déchiffré et relu ; une erreur s'il ne l'est pas, ou s'il est mal formé. */
function specPerso(c: ConnecteurEnregistre): SpecPerso {
  if (!estChiffreLie(c.perso)) throw new Error(tf("connecteur « {0} » : enregistrement non scellé par la clé de l'instance, ignoré", c.id));
  const v = dechiffrer(c.perso, placePerso(c.id)) as Record<string, unknown> | null;
  const lectures = Array.isArray(v?.lectures) ? (v!.lectures as unknown[]).filter((x): x is string => typeof x === "string") : [];
  if (v?.mode === "programme" && typeof v.command === "string" && Array.isArray(v.args) && v.args.every((a) => typeof a === "string")) {
    return { mode: "programme", command: v.command, args: v.args as string[], lectures };
  }
  if (v?.mode === "adresse" && typeof v.url === "string") return { mode: "adresse", url: v.url, lectures };
  throw new Error(tf("connecteur « {0} » : enregistrement illisible, ignoré", c.id));
}

/** La configuration d'un serveur ajouté, rejugée à chaque démarrage (règles du jour, régime de l'instance du moment). */
function configPerso(c: ConnecteurEnregistre): McpServerConfig {
  const spec = specPerso(c);
  lecturesPerso.set(c.id, { lectures: new Set(spec.lectures), adresse: spec.mode === "adresse" });
  const base = { id: c.id, label: c.label, description: c.description, autoStart: true };
  const surLaMachine = t("Un programme de cette machine, ou un serveur sur sa boucle locale, ne tourne que sur une instance fermée aux collègues (ou réglée par l'intégrateur pour les serveurs internes).");
  if (spec.mode === "programme") {
    if (!commandeLibreAutorisee() && instanceOuverte()) throw new Error(surLaMachine);
    const juge = jugerCommande(spec.command, spec.args);
    if (!juge.ok) throw new Error(juge.message);
    // L'environnement minimal du SDK (mcp.ts, `getDefaultEnvironment`) et les variables données par l'administrateur, rien de la passerelle.
    return { ...base, command: juge.command, args: juge.args, env: environnement(c), cwd: homedir(), libre: true };
  }
  const a = jugerAdresse(spec.url, PORT_PASSERELLE);
  if (!a.ok) throw new Error(a.message);
  if (a.locale) {
    if (!commandeLibreAutorisee() && instanceOuverte()) throw new Error(surLaMachine);
    // Le port déclaré, celui-là seul (mcp.ts, `adresseServeurPermise`) ; aucune redirection suivie (`fetchLocal`).
    return { ...base, url: a.url, local: { port: a.port, reconnaitre: async () => null } };
  }
  return { ...base, url: a.url, auth: new FournisseurAutorisation(c.id, a.url, retourDe(c.id)) };
}

/** Ce que l'écran montre d'un serveur ajouté. La commande ou l'adresse, à l'administrateur seulement. */
function descriptionPerso(c: ConnecteurEnregistre, outils: { name: string; description: string }[], administrateur: boolean): DescriptionPerso {
  try {
    const spec = specPerso(c);
    return {
      mode: spec.mode,
      ...(administrateur ? { cible: spec.mode === "programme" ? [spec.command, ...spec.args].join(" ") : spec.url } : {}),
      lectures: spec.lectures,
      outils: outils.map((o) => ({ nom: o.name, description: o.description.slice(0, 300) })),
    };
  } catch {
    return { mode: "programme", lectures: [], outils: [] };
  }
}

/** L'adresse d'un serveur pour le journal : sans ce qui suit le chemin (une clé glissée dans l'adresse n'y entre pas). */
const adressePourJournal = (url: string): string => {
  try {
    const u = new URL(url);
    return `${u.origin}${u.pathname}`.slice(0, 300);
  } catch {
    return "";
  }
};

const phraseOutils = (label: string, outils: number): string =>
  outils > 1
    ? tf("« {0} » est connecté : {1} outils disponibles pour vos agents. Chacun demande votre accord avant d'agir ; marquez ceux qui ne font que lire.", label, outils)
    : tf("« {0} » est connecté : {1} outil disponible pour vos agents. Il demande votre accord avant d'agir ; marquez-le s'il ne fait que lire.", label, outils);

/**
 * Ajoute un serveur MCP à la demande de l'administrateur (l'appelant, index.ts,
 * l'a vérifié, et dit si la demande vient de cette machine). Démarré et essayé
 * avant d'être écrit, comme `ajouter` ; un serveur à une adresse qui demande
 * une autorisation est écrit, et l'adresse d'autorisation rendue à l'écran.
 */
export async function ajouterPersonnalise(
  brut: unknown,
  qui: string,
  contexte: { depuisCePoste: boolean; base: string },
): Promise<Resultat & { adresse?: string }> {
  if (!brut || typeof brut !== "object") return { ok: false, message: t("Aucun connecteur fourni.") };
  await charger();
  const b = brut as Record<string, unknown>;
  const id = typeof b.id === "string" ? b.id.trim().toLowerCase() : "";
  if (!ID_VALIDE.test(id) || id.includes("__") || id.endsWith("_")) {
    return { ok: false, message: t("Identifiant de connecteur invalide : lettres minuscules, chiffres, tiret et souligné, 32 caractères au plus.") };
  }
  if (IDS_RESERVES.has(id)) return { ok: false, message: tf("« {0} » est le nom d'un connecteur intégré : choisissez un autre identifiant.", id) };
  if (entreeCatalogue(id)) return { ok: false, message: tf("« {0} » est le nom d'un connecteur du catalogue : choisissez un autre identifiant.", id) };
  if (enMemoire.some((c) => c.id === id) || estDeclare(id)) return { ok: false, message: tf("L'identifiant « {0} » est déjà utilisé par un serveur de cette instance.", id) };
  const label = typeof b.label === "string" ? b.label.trim().replace(/\s+/g, " ") : "";
  if (!label || label.length > 60) return { ok: false, message: t("Donnez un nom au serveur, 60 caractères au plus.") };
  const description = typeof b.description === "string" && b.description.trim() ? b.description.trim().replace(/\s+/g, " ").slice(0, 300) : t("Serveur MCP ajouté par l'administrateur.");
  // Scellé par la clé de l'instance, ou rien : un enregistrement en clair serait la porte d'entrée que la règle ferme.
  if (!chiffrementActif()) {
    return { ok: false, message: tf("Le chiffrement des données n'est pas actif sur cette machine : {0} refuse d'enregistrer un serveur ajouté sans le sceller. Déverrouillez le trousseau du compte hôte, ou réglez « chiffrement » sur « fichier » dans helix.config.json, puis recommencez.", nomProduit()) };
  }
  const refusMachine = t("Un programme de cette machine, ou un serveur sur sa boucle locale, ne s'ajoute que depuis cette machine même, sur une instance fermée aux collègues. Sur une instance ouverte au réseau, c'est l'intégrateur qui l'autorise (« connecteursLibres » dans helix.config.json).");

  let spec: SpecPerso;
  let variables: Record<string, string> = {};
  let distant = false;
  if (b.mode === "programme") {
    if (!programmePermis(contexte.depuisCePoste)) return { ok: false, message: refusMachine };
    const juge = jugerCommande(b.command, b.args);
    if (!juge.ok) return juge;
    const v = jugerVariables(b.variables);
    if (!v.ok) return v;
    spec = { mode: "programme", command: juge.command, args: juge.args, lectures: [] };
    variables = v.variables;
  } else if (b.mode === "adresse") {
    const a = jugerAdresse(b.url, PORT_PASSERELLE);
    if (!a.ok) return a;
    if (a.locale && !programmePermis(contexte.depuisCePoste)) return { ok: false, message: refusMachine };
    if (!a.locale) {
      const refus = adresseServeurPermise({ url: a.url });
      if (refus) return { ok: false, message: refus };
      distant = true;
    }
    spec = { mode: "adresse", url: a.url, lectures: [] };
  } else {
    return { ok: false, message: t("Choisissez « Programme de cette machine » ou « Adresse ».") };
  }

  const enregistre: ConnecteurEnregistre = {
    id,
    label,
    description,
    secrets: Object.fromEntries(Object.entries(variables).map(([nom, valeur]) => [nom, chiffrer(valeur, placeDuSecret(id, nom))])),
    depuis: new Date().toISOString(),
    perso: chiffrer(spec, placePerso(id)),
  };
  if (distant) {
    // L'autorisation, si le serveur en demande une : même chemin que « Se connecter » (oauthMcp.ts).
    const retour = adresseDeRetour(contexte.base);
    issuesRetour.delete(id);
    memoriserRetour(id, retour);
    await noterDemandeur(id, (spec as { url: string }).url, qui);
  }
  let config: McpServerConfig;
  try {
    config = configPerso(enregistre);
  } catch (err) {
    lecturesPerso.delete(id);
    return { ok: false, message: err instanceof Error ? err.message : String(err) };
  }
  declarer(config);
  const demarrage = await startServer(id);
  const fournisseur = config.auth as FournisseurAutorisation | undefined;
  const cible =
    spec.mode === "programme"
      ? { commande: [spec.command, ...spec.args].join(" ").slice(0, 500), variables: Object.keys(variables) }
      : { adresse: adressePourJournal(spec.url) };
  if (!demarrage.ok) {
    if (fournisseur?.adresseAutorisation) {
      await ecrire([...enMemoire, enregistre]);
      journaliser("connecteur.ajoute", qui, { connecteur: id, personnalise: spec.mode, ...cible, etape: "autorisation demandée" });
      return { ok: true, adresse: fournisseur.adresseAutorisation, message: tf("Autorisez {0} dans la page qui vient de s'ouvrir.", label) };
    }
    await retirerServeur(id);
    lecturesPerso.delete(id);
    if (distant) await oublierOauth(id, qui).catch(() => undefined);
    return { ok: false, message: tf("« {0} » n'a pas démarré : {1}", label, demarrage.error ?? t("cause inconnue")) };
  }
  await ecrire([...enMemoire, enregistre]);
  const outils = mcpStatus().find((s) => s.id === id)?.toolCount ?? 0;
  journaliser("connecteur.ajoute", qui, { connecteur: id, personnalise: spec.mode, ...cible, outils });
  return { ok: true, message: phraseOutils(label, outils) };
}

/** L'administrateur marque des outils d'un serveur ajouté « lecture seule » (les autres demandent l'accord). */
export async function definirLecturesPersonnalisees(id: string, brut: unknown, qui: string): Promise<Resultat> {
  await charger();
  const c = enMemoire.find((x) => x.id === id && x.perso !== undefined);
  if (!c) return { ok: false, message: tf("Aucun serveur ajouté « {0} » sur cette instance.", id) };
  if (!Array.isArray(brut) || brut.length > 2000 || brut.some((x) => typeof x !== "string")) return { ok: false, message: t("Liste d'outils illisible.") };
  let spec: SpecPerso;
  try {
    spec = specPerso(c);
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : String(err) };
  }
  // Seulement des outils que ce serveur annonce (ou déjà marqués) : un nom inventé ne sert à rien.
  const connus = new Set([...(mcpStatus().find((s) => s.id === id)?.tools ?? []).map((o) => o.name), ...spec.lectures]);
  const lectures = [...new Set(brut as string[])].filter((n) => connus.has(n));
  const enregistre: ConnecteurEnregistre = { ...c, perso: chiffrer({ ...spec, lectures }, placePerso(id)) };
  await ecrire(enMemoire.map((x) => (x.id === id ? enregistre : x)));
  lecturesPerso.set(id, { lectures: new Set(lectures), adresse: spec.mode === "adresse" });
  journaliser("connecteur.ajoute", qui, { connecteur: id, personnalise: spec.mode, etape: "lectures", lectures });
  if (lectures.length === 0) return { ok: true, message: tf("Tous les outils de « {0} » demandent votre accord avant d'agir.", t(c.label)) };
  return {
    ok: true,
    message:
      lectures.length > 1
        ? tf("{0} outils de « {1} » sont marqués « lecture seule » : ils ne demandent plus d'accord au niveau « Demander avant de modifier ».", lectures.length, t(c.label))
        : tf("Un outil de « {0} » est marqué « lecture seule » : il ne demande plus d'accord au niveau « Demander avant de modifier ».", t(c.label)),
  };
}

/** « Réessayer » ou « Se reconnecter » sur un serveur ajouté : relancé, ou renvoyé vers son autorisation. */
async function rebrancherPerso(
  id: string,
  qui: string,
  base: string,
): Promise<{ ok: true; pret?: true; adresse?: string; message: string } | { ok: false; message: string }> {
  const c = enMemoire.find((x) => x.id === id && x.perso !== undefined)!;
  let spec: SpecPerso;
  try {
    spec = specPerso(c);
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : String(err) };
  }
  const juge = spec.mode === "adresse" ? jugerAdresse(spec.url, PORT_PASSERELLE) : null;
  if (juge?.ok && !juge.locale && spec.mode === "adresse") {
    const retour = adresseDeRetour(base);
    issuesRetour.delete(id);
    memoriserRetour(id, retour);
    await noterDemandeur(id, spec.url, qui);
  }
  let config: McpServerConfig;
  try {
    config = configPerso(c);
  } catch (err) {
    erreursPerso.set(id, err instanceof Error ? err.message : String(err));
    return { ok: false, message: err instanceof Error ? err.message : String(err) };
  }
  erreursPerso.delete(id);
  await stopServer(id);
  declarer(config);
  const demarrage = await startServer(id);
  const fournisseur = config.auth as FournisseurAutorisation | undefined;
  if (!demarrage.ok && fournisseur?.adresseAutorisation) {
    journaliser("connecteur.ajoute", qui, { connecteur: id, personnalise: spec.mode, etape: "autorisation demandée" });
    return { ok: true, adresse: fournisseur.adresseAutorisation, message: tf("Autorisez {0} dans la page qui vient de s'ouvrir.", t(c.label)) };
  }
  if (!demarrage.ok) return { ok: false, message: tf("« {0} » n'a pas démarré : {1}", t(c.label), demarrage.error ?? t("cause inconnue")) };
  journaliser("connecteur.ajoute", qui, { connecteur: id, personnalise: spec.mode, etape: "rebranché" });
  return { ok: true, pret: true, message: phraseOutils(t(c.label), mcpStatus().find((s) => s.id === id)?.toolCount ?? 0) };
}

/** Le retour d'autorisation d'un serveur ajouté à une adresse : l'échange, puis le démarrage, sans toucher à son enregistrement scellé. */
async function acheverPerso(attendu: { id: string; url: string; retour: string; pour?: string }, code: string): Promise<{ ok: boolean; message: string; label?: string }> {
  const c = enMemoire.find((x) => x.id === attendu.id && x.perso !== undefined)!;
  let spec: SpecPerso;
  try {
    spec = specPerso(c);
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : String(err) };
  }
  // L'autorisation vaut pour l'adresse enregistrée, celle-là seule.
  if (spec.mode !== "adresse" || spec.url !== attendu.url) return { ok: false, message: t("Connecteur inconnu.") };
  const fournisseur = new FournisseurAutorisation(attendu.id, spec.url, attendu.retour);
  try {
    const resultat = await auth(fournisseur as never, { serverUrl: spec.url, authorizationCode: code });
    if (resultat !== "AUTHORIZED") return { ok: false, message: tf("{0} n'a pas accordé l'autorisation.", t(c.label)) };
  } catch (err) {
    return { ok: false, message: tf("Échange refusé par {0} : {1}", t(c.label), err instanceof Error ? err.message : String(err)) };
  }
  memoriserRetour(attendu.id, attendu.retour);
  await stopServer(attendu.id);
  declarer(configPerso(c));
  const demarrage = await startServer(attendu.id);
  if (!demarrage.ok) return { ok: false, message: tf("{0} a autorisé l'accès, mais son serveur n'a pas répondu : {1}.", t(c.label), demarrage.error ?? t("cause inconnue")), label: t(c.label) };
  journaliser("connecteur.ajoute", attendu.pour ?? "systeme", { connecteur: attendu.id, personnalise: "adresse", etape: "autorisé" });
  return { ok: true, message: phraseOutils(t(c.label), mcpStatus().find((s) => s.id === attendu.id)?.toolCount ?? 0), label: t(c.label) };
}

/* ------------------------------------------------------------------ */
/* Groupes d'outils, pour le composeur                                 */
/* ------------------------------------------------------------------ */

export interface GroupeOutils {
  id: string;
  label: string;
  /** Ce que ce groupe permet, en une phrase. */
  description: string;
  /** Les outils sont-ils réellement proposés au modèle en ce moment ? */
  actif: boolean;
  outils: number;
  /** Ce qu'il manque pour que le groupe serve, s'il ne sert pas. */
  obstacle?: string;
  /**
   * Un service que quelqu'un a branché (courrier, Stripe, un MCP ajouté…), pas
   * un outil livré d'office : c'est lui que le Chat nomme pour inviter à
   * allumer les outils quand ils sont éteints (HomePage.tsx, 28/09/2026).
   */
  branche?: true;
}

/**
 * Ce dont l'agent dispose vraiment, groupe par groupe.
 *
 * La puce « Outils » du composeur promettait « fichiers, connecteurs » sans
 * jamais dire lesquels : un interrupteur qui n'annonce rien laisse l'utilisateur
 * deviner. Cette liste est celle que `chat.ts` assemble pour le modèle, lue aux
 * mêmes sources, pour qu'elle ne puisse pas mentir.
 */
export async function groupes(): Promise<GroupeOutils[]> {
  await charger();
  relancerLocaux();

  const serveurs = mcpStatus();
  const liste: GroupeOutils[] = [];

  for (const s of serveurs) {
    const livre = CATALOGUE.some((e) => e.id === s.id && e.integre);
    liste.push({
      id: s.id,
      label: s.label,
      description: s.description,
      actif: s.running && s.toolCount > 0,
      outils: s.toolCount,
      obstacle: s.error ?? (s.running ? undefined : "Serveur arrêté."),
      ...(livre ? {} : { branche: true as const }),
    });
  }

  // La bibliothèque : toujours là, elle lit ce que la personne y voit.
  liste.push({
    id: "bibliotheque",
    // Le nom de l'onglet (« Fichiers »), précisé : « Fichiers » seul désigne déjà le dossier de travail.
    label: "Fichiers de l'équipe",
    description: "Chercher et lire les documents de la bibliothèque que vous voyez, en lecture seule.",
    actif: true,
    outils: 2,
  });
  liste.push({
    id: "reunions",
    label: "Réunions",
    description: "Retrouver ce qui s'est dit et décidé dans les réunions transcrites que vous voyez.",
    actif: true,
    outils: 2,
  });

  const outilsBureau = bureau.toolsForModel().length;
  liste.push({
    id: "bureau",
    label: "Bureautique",
    description: "Créer et lire des documents Word, Excel, PowerPoint et PDF.",
    actif: outilsBureau > 0,
    outils: outilsBureau,
    obstacle: outilsBureau > 0 ? undefined : "L'atelier bureautique n'est pas installé.",
  });

  const outilsCourrier = courrier.toolsForModel().length;
  liste.push({
    id: "courrier",
    label: "Courrier",
    description: courrier.envoiActif()
      ? "Consulter la boîte de courrier connectée, y préparer des brouillons, et envoyer des mails après votre accord."
      : "Consulter la boîte de courrier connectée, et y préparer des brouillons.",
    actif: outilsCourrier > 0,
    outils: outilsCourrier,
    ...(outilsCourrier > 0 ? { branche: true as const } : {}),
    obstacle: outilsCourrier > 0 ? undefined : "Aucune boîte connectée.",
  });

  // L'agenda manquait : ses outils étaient bien proposés au modèle, la puce ne le disait pas.
  const outilsAgenda = agenda.toolsForModel().length;
  liste.push({
    id: "agenda",
    label: "Agenda",
    description: "Consulter l'agenda connecté, en lecture seule.",
    actif: outilsAgenda > 0,
    outils: outilsAgenda,
    ...(outilsAgenda > 0 ? { branche: true as const } : {}),
    obstacle: outilsAgenda > 0 ? undefined : "Aucun agenda connecté.",
  });

  // Google Drive et Slack, lus aux mêmes sources que chat.ts (drive.ts, slack.ts).
  const outilsDrive = drive.toolsForModel().length;
  liste.push({
    id: "drive",
    label: "Google Drive",
    description: "Chercher et lire les fichiers du Drive connecté, en lecture seule.",
    actif: outilsDrive > 0,
    outils: outilsDrive,
    ...(outilsDrive > 0 ? { branche: true as const } : {}),
    obstacle: outilsDrive > 0 ? undefined : "Aucun Google Drive connecté.",
  });
  const outilsSlack = slack.toolsForModel().length;
  liste.push({
    id: "slack",
    label: "Slack",
    description: "Lire les salons où l'application Slack est invitée, en lecture seule.",
    actif: outilsSlack > 0,
    outils: outilsSlack,
    ...(outilsSlack > 0 ? { branche: true as const } : {}),
    obstacle: outilsSlack > 0 ? undefined : "Aucun Slack connecté.",
  });

  // Sheets, Slides, YouTube et réseaux sociaux (outilsNatifs.ts) : un groupe par service branché, lu à la même source que chat.ts.
  // Et les messageries (natifs/messageries.ts) : leurs envois s'appellent `__envoyer`.
  const natifs = [...outilsNatifs.toolsForModel(), ...messageries.toolsForModel()];
  const NOMS: Record<string, string> = { sheets: "Google Sheets", slides: "Google Slides", youtube: "YouTube", linkedin: "LinkedIn", facebook: "Facebook", instagram: "Instagram", tiktok: "TikTok", x: "X", docs: "Google Docs", forms: "Google Forms", dropbox: "Dropbox", telegram: "Telegram", discord: "Discord", whatsapp: "WhatsApp", stripe: "Stripe", shopify: "Shopify", woocommerce: "WooCommerce", salesforce: "Salesforce", pipedrive: "Pipedrive", zendesk: "Zendesk", brevo: "Brevo", mailchimp: "Mailchimp", ...NOMS_MICROSOFT };
  for (const [id, label] of Object.entries(NOMS)) {
    const n = natifs.filter((o) => o.function.name.startsWith(`${id}__`)).length;
    if (n === 0) continue;
    liste.push({
      id,
      label,
      // Par la liste des écritures de la barrière, pas par le nom : `dropbox__envoyer` écrit sans « publier » ni « ecrire » (28/09/2026).
      description: natifs.some((o) => o.function.name.startsWith(`${id}__`) && (outilsNatifs.ECRITURES_NATIVES.has(o.function.name) || /__(envoyer|noter|repondre|publier|ecrire|ajouter|creer|brouillon|poster)/.test(o.function.name)))
        ? "Lire, et écrire ou publier après votre accord, à chaque fois."
        : "Lire, sans rien modifier.",
      actif: true,
      outils: n,
      branche: true,
    });
  }

  /*
   * L'écran passe par `toolsForModel()` de computer.ts plutôt que par son
   * diagnostic complet : celui-ci prend une vraie capture d'écran, ce qui est
   * bien trop lourd et bien trop intrusif pour l'ouverture d'un menu.
   *
   * Une réserve à dire à l'utilisateur : ces outils ne sont proposés qu'à un
   * modèle qui sait lire une image. Le menu l'annonce plutôt que de laisser
   * croire à une capacité qui dépend du modèle choisi.
   */
  const outilsEcran = computer.toolsForModel().length;
  liste.push({
    id: "ecran",
    label: "Écran",
    description: "Voir l'écran et le piloter, avec approbation.",
    actif: outilsEcran > 0,
    outils: outilsEcran,
    obstacle:
      outilsEcran > 0
        ? "Réservé aux modèles capables de lire une image."
        : "Le contrôle de l'écran est désactivé sur cette instance.",
  });

  /*
   * Traduit au moment de servir, pour la même raison que le catalogue : ces
   * textes sont écrits en français ici, et la langue est celle de la requête.
   */
  return liste.map((g) => ({
    ...g,
    label: t(g.label),
    description: t(g.description),
    ...(g.obstacle ? { obstacle: t(g.obstacle) } : {}),
  }));
}

/*
 * Le nom lisible d'un connecteur pour la carte d'accord (approbation.ts,
 * 28/09/2026) : celui qu'il porte dans l'écran Connecteurs, dans la langue de
 * la demande, plutôt que son identifiant (« memoire »).
 */
definirNomsConnecteurs((id) => {
  const nom = enMemoire.find((c) => c.id === id)?.label ?? CATALOGUE.find((e) => e.id === id)?.label;
  return nom ? t(nom) : undefined;
});
