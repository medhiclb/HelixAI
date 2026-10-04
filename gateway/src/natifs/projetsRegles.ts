import type { Definition, ReponseApi } from "../oauthNatif.ts";

/**
 * Projets et rendez-vous (28/09/2026, SECURITE.md § 48) : Trello, Monday,
 * ClickUp, Todoist, Calendly, Zoom, Brevo et Mailchimp. Les règles, sans rien
 * d'autre.
 *
 * Pourquoi un module à part de `projets.ts` : la barrière (approbation.ts), le
 * gestionnaire des serveurs MCP (mcp.ts), les connexions natives
 * (oauthNatif.ts) et les listes d'outils (outils.ts, outilsCode.ts) ont besoin
 * de ces règles, et `projets.ts` a besoin d'eux (jetons, carte). Écrites ici,
 * sans aucune importation qui s'exécute, elles se chargent en premier et ne
 * forment aucun cycle ; la barrière reste chargeable seule, ce que la batterie
 * de sécurité fait (section 16 sexies).
 *
 * ── Choix, service par service (documentation lue le 28/09/2026) ─────────────
 *
 * Ordre imposé par Medhi : un serveur MCP officiel distant avec OAuth d'abord
 * (catalogue de connecteurs.ts, comme Notion ou Linear), sinon un connecteur
 * natif (oauthNatif.ts), sinon une clé d'API d'administrateur.
 *
 *  - Trello : serveur officiel d'Atlassian, `https://mcp.trello.com/v1`, OAuth
 *    2.0 avec enregistrement automatique chez Atlassian
 *    (https://support.atlassian.com/trello/docs/connect-trello-to-ai-assistants-with-trello-mcp/,
 *    https://github.com/atlassian/trello-mcp-server, Apache 2.0). Portées
 *    publiées par ses métadonnées : `read:board:trello`, `write:board:trello`…
 *  - Monday : `https://mcp.monday.com/mcp`, OAuth 2.0, enregistrement
 *    automatique (https://developer.monday.com/api-reference/docs/mondaycom-mcp,
 *    https://developer.monday.com/api-reference/docs/monday-mcp-security-overview).
 *    Aucune portée publiée : la lecture seule est tenue ici, outil par outil.
 *  - ClickUp : `https://mcp.clickup.com/mcp`, OAuth 2.1 avec PKCE, client
 *    public enregistré automatiquement, portées `read` et `write`
 *    (https://developer.clickup.com/docs/connect-an-ai-assistant-to-clickups-mcp-server).
 *    Limite de ClickUp : 50 appels par 24 heures en offre gratuite, 300 à
 *    partir d'Unlimited.
 *  - Todoist : `https://ai.todoist.net/mcp`, OAuth avec enregistrement
 *    automatique (https://github.com/Doist/todoist-mcp, MIT). Portées de
 *    todoist.com : `data:read`, `data:read_write`.
 *  - Calendly : `https://mcp.calendly.com`, OAuth 2.1, PKCE S256, client
 *    public enregistré automatiquement (`token_endpoint_auth_method: none`),
 *    portées `mcp:scheduling:read` et `mcp:scheduling:write`
 *    (https://developer.calendly.com/docs/mcp/calendly-mcp-server).
 *  - Zoom : `https://mcp.zoom.us/mcp/zoom/streamable`, OAuth avec PKCE, mais
 *    **pas** d'enregistrement automatique : une « General app » à créer sur le
 *    Zoom App Marketplace (https://developers.zoom.us/docs/mcp/servers/connect-to-zoom-mcp-servers/,
 *    https://github.com/zoom/zoom-plugin/blob/main/skills/zoom-mcp/concepts/oauth-setup.md).
 *    Portées publiées par ses métadonnées : lecture (`meeting:read:search`…)
 *    et écriture (`meeting:write:meeting`…).
 *  - Brevo : son serveur MCP (`https://mcp.brevo.com/v1/brevo/mcp`) ne prend
 *    qu'un jeton collé, sans OAuth (https://developers.brevo.com/docs/mcp-protocol).
 *    Brevo a en revanche un OAuth 2.0 avec PKCE et des portées fines, pour une
 *    application « privée » de l'organisation (https://developers.brevo.com/docs/oauth,
 *    https://developers.brevo.com/docs/oauth-integration-guide) : connecteur
 *    natif, qui permet la lecture seule chez Brevo lui-même.
 *  - Mailchimp : aucun serveur MCP officiel pour l'API Marketing (celui de
 *    Mailchimp ne couvre que Mandrill, l'envoi transactionnel, par clé).
 *    Mailchimp a un OAuth 2 documenté (https://mailchimp.com/developer/marketing/guides/access-user-data-oauth-2/) :
 *    connecteur natif. Mailchimp n'a **pas de portées** : un accès vaut tout le
 *    compte ; la lecture seule est tenue ici, outil par outil.
 *
 * Aucune clé d'API n'a donc été nécessaire.
 */

/* ------------------------------------------------------------------ */
/* Serveurs MCP de la famille                                          */
/* ------------------------------------------------------------------ */

export type IdMcpProjet = "trello" | "monday" | "clickup" | "todoist" | "calendly" | "zoom";

interface RegleMcp {
  nom: string;
  /** Portées demandées pour lire ; `null` : le service n'en publie pas, la lecture est tenue outil par outil. */
  lecture: string[] | null;
  /** Portées en plus, si l'administrateur coche l'écriture. */
  ecriture: string[];
  /** Le service n'accepte qu'un client public (sans secret), PKCE seul. */
  clientPublic?: boolean;
}

export const REGLES_MCP: Record<IdMcpProjet, RegleMcp> = {
  /*
   * Métadonnées lues le 28/09/2026 (`/.well-known/oauth-protected-resource/v1`) :
   * `read:board:trello`, `write:board:trello`, `read:organization:trello`,
   * `read:member:trello`, `read:me`, `read:account`, `offline_access`, et des
   * portées d'écriture de l'espace de travail, de la boîte de réception et du
   * planning, qu'on ne demande pas. Écrire ne demande que les tableaux.
   */
  trello: {
    nom: "Trello",
    lecture: ["offline_access", "read:me", "read:account", "read:board:trello", "read:organization:trello", "read:member:trello"],
    ecriture: ["write:board:trello"],
  },
  monday: { nom: "Monday", lecture: null, ecriture: [] },
  clickup: { nom: "ClickUp", lecture: ["read"], ecriture: ["write"], clientPublic: true },
  /*
   * Todoist : `data:read_write` contient la lecture ; on le demande seul pour
   * écrire, et `data:read` seul pour lire. `data:delete` et `project:delete`
   * ne sont jamais demandés.
   */
  todoist: { nom: "Todoist", lecture: ["data:read"], ecriture: ["data:read_write"] },
  calendly: { nom: "Calendly", lecture: ["mcp:scheduling:read"], ecriture: ["mcp:scheduling:write"], clientPublic: true },
  /*
   * Zoom : les portées de lecture de ses métadonnées. En écriture : créer et
   * modifier une réunion, déposer un document ; jamais supprimer une réunion
   * (`meeting:delete:meeting`), ni piloter une réunion en cours, ni changer
   * les collaborateurs d'un document.
   */
  zoom: {
    nom: "Zoom",
    lecture: [
      "meeting:read:search",
      "meeting:read:assets",
      "cloud_recording:read:list_user_recordings",
      "cloud_recording:read:content",
      "docs:read:export",
      "docs:read:list_file_collaborators",
      "hub:read:content",
      "my_notes:read:content",
      "agentic_search:read:search",
      "agentic_search:read:ask",
    ],
    ecriture: ["meeting:write:meeting", "meeting:update:meeting", "docs:write:import", "hub:write:content"],
  },
};

export const IDS_MCP_PROJETS = Object.keys(REGLES_MCP) as IdMcpProjet[];
export const estMcpProjet = (id: unknown): id is IdMcpProjet => typeof id === "string" && id in REGLES_MCP;

/** Portées à demander, `undefined` si le service n'en publie pas. Pour Todoist, l'écriture remplace la lecture. */
export function porteesDemandees(id: IdMcpProjet, ecriture: boolean): string | undefined {
  const r = REGLES_MCP[id];
  if (!r.lecture) return undefined;
  if (id === "todoist") return (ecriture ? r.ecriture : r.lecture).join(" ");
  return [...r.lecture, ...(ecriture ? r.ecriture : [])].join(" ");
}

export const clientPublic = (id: string): boolean => estMcpProjet(id) && REGLES_MCP[id].clientPublic === true;

const decouper = (v: unknown): string[] =>
  typeof v === "string" ? v.split(/[\s,]+/).filter(Boolean) : Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];

/**
 * Ce que le service a accordé en plus de ce qui était demandé.
 *
 * Une réponse sans `scope` vaut la portée demandée (RFC 6749 § 5.1 : le champ
 * n'est obligatoire que s'il en diffère). Ce qui manque n'est pas refusé : un
 * outil de moins, pas un accès de trop ; Zoom, par exemple, n'accorde que les
 * portées cochées dans l'application. Ce qui déborde l'est : c'est la règle
 * du § 40 (un accès en trop fait tout refuser).
 */
export function porteesEnTrop(demandees: string | undefined, rendue: unknown): string[] {
  if (demandees === undefined) return [];
  const accordees = decouper(rendue);
  const voulues = new Set(decouper(demandees));
  return accordees.filter((p) => !voulues.has(p));
}

/* ---- Écriture choisie à la connexion, et classement des outils ---- */

const ecritures = new Map<string, boolean>();
/** Posé par connecteurs.ts à la connexion et au démarrage : l'écriture a-t-elle été cochée ? */
export function definirEcriture(id: string, oui: boolean): void {
  if (estMcpProjet(id)) ecritures.set(id, oui);
}
export const ecritureAutorisee = (id: string): boolean => ecritures.get(id) === true;

/**
 * Verbes qui modifient, dans un nom d'outil mis en minuscules et en mots
 * séparés (`addTasks`, `add-tasks` et `add_tasks` donnent `add_tasks`).
 */
const ECRIT =
  /(^|_)(create|add|update|edit|delete|remove|move|archive|unarchive|send|set|assign|unassign|post|complete|uncomplete|close|reopen|cancel|schedule|reschedule|book|invite|start|stop|attach|upload|import|write|modify|change|duplicate|copy|mark|rename|link|unlink|share|publish|submit|approve|reject|convert|merge|restore|reorder|toggle|enable|disable|join|leave|end|mute|unmute|record|register|subscribe|unsubscribe|reply|comment|react|like|follow|pin|unpin|lock|unlock|transfer|clone|apply|save|put|patch|insert|replace|clear|reset|run|execute|trigger|accept|decline|resolve|manage|make|new|generate|batch)(_|$)/;
/** Verbes qui ne font que lire, en tête du nom. */
const LIT = /^(get|list|search|find|fetch|read|query|describe|show|view|lookup|count|retrieve|whoami|user_info|me|export|summarize|preview)(_|$)/;

const motsDe = (nom: string) =>
  nom
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[^A-Za-z0-9]+/g, "_")
    .toLowerCase()
    .replace(/^_+|_+$/g, "");

export interface OutilListe {
  name: string;
  annotations?: { readOnlyHint?: unknown; destructiveHint?: unknown } | undefined;
}

/**
 * Lire ou écrire, pour un outil d'un serveur MCP de la famille.
 *
 * Échoue fermé : n'est une lecture que ce qui n'a aucun verbe qui modifie
 * **et** qui le dit (annotation `readOnlyHint`, spécification MCP du
 * 18/06/2025) ou commence par un verbe de lecture. Une annotation qui dit
 * écrire, ou détruire, l'emporte. Tout le reste est une écriture : carte à
 * chaque appel, administrateur seul, et invisible si l'écriture n'a pas été
 * cochée.
 */
export function classer(o: OutilListe, serveur = ""): "lecture" | "ecriture" {
  const a = o.annotations ?? {};
  if (a.readOnlyHint === false || a.destructiveHint === true) return "ecriture";
  // Un nom qui répète celui du service (`clickup_search`) se lit sans lui : c'est le verbe qui suit qui compte.
  // Sans expression régulière : le nom du service y entrait tel quel, ses caractères spéciaux compris (CodeQL, 04/10/2026).
  const nom = motsDe(o.name);
  const mots = serveur && nom.startsWith(`${serveur}_`) ? nom.slice(serveur.length + 1) : nom;
  if (!mots || ECRIT.test(mots)) return "ecriture";
  if (a.readOnlyHint === true || LIT.test(mots)) return "lecture";
  return "ecriture";
}

/** Noms qualifiés (`trello__get_board`) des lectures reconnues, relevés quand le serveur liste ses outils. */
const lectures = new Set<string>();

/**
 * Trie les outils d'un serveur de la famille quand il les liste (mcp.ts) :
 * note les lectures, et retire les écritures si l'écriture n'a pas été cochée.
 * Un outil retiré n'existe pas pour la passerelle : aucun appel ne l'atteint.
 * Un serveur hors de la famille n'est pas touché.
 */
export function retenirOutils<T extends OutilListe>(serveur: string, outils: T[], qualifier: (nom: string) => string): T[] {
  if (!estMcpProjet(serveur)) return outils;
  for (const nom of [...lectures]) if (nom.startsWith(`${serveur}__`)) lectures.delete(nom);
  const gardes: T[] = [];
  for (const o of outils) {
    if (classer(o, serveur) === "lecture") {
      lectures.add(qualifier(o.name));
      gardes.push(o);
    } else if (ecritureAutorisee(serveur)) gardes.push(o);
  }
  return gardes;
}

const PREFIXES_MCP = IDS_MCP_PROJETS.map((id) => `${id}__`);
const deLaFamilleMcp = (outil: string) => PREFIXES_MCP.some((p) => outil.startsWith(p));

/** Un outil MCP de la famille reconnu comme lecture. */
export const estLectureMcpProjet = (outil: string): boolean => lectures.has(outil);
/** Un outil MCP de la famille qui n'est pas une lecture reconnue : il écrit, jusqu'à preuve du contraire. */
export const estEcritureMcpProjet = (outil: string): boolean => deLaFamilleMcp(outil) && !lectures.has(outil);

/* ------------------------------------------------------------------ */
/* Brevo et Mailchimp : connecteurs natifs                             */
/* ------------------------------------------------------------------ */

export const LECTURES_PROJETS = [
  "brevo__compte",
  "brevo__listes",
  "brevo__campagnes",
  "brevo__campagne",
  "mailchimp__compte",
  "mailchimp__audiences",
  "mailchimp__campagnes",
  "mailchimp__campagne",
];
export const ECRITURES_PROJETS = ["brevo__creer_brouillon", "brevo__envoyer_campagne", "mailchimp__creer_brouillon", "mailchimp__envoyer_campagne"];
/** La carte de ces outils est préparée par projets.ts (destinataires comptés, campagne relue) : sans elle, rien ne part. */
export const APERCU_REQUIS = new Set(ECRITURES_PROJETS);

/** Hôte de l'API Mailchimp d'un compte : `<dc>.api.mailchimp.com`, où `dc` est rendu par Mailchimp (us6, eu1…). */
export const HOTE_MAILCHIMP = /^[a-z]{2,4}[0-9]{1,3}\.api\.mailchimp\.com$/;

export const DEFINITIONS_PROJETS: Record<"brevo" | "mailchimp", Definition> = {
  /*
   * Brevo, OAuth 2.0 d'une application « privée » (réservée aux personnes de
   * l'organisation qui la crée), lu le 28/09/2026 :
   * https://developers.brevo.com/docs/oauth, https://developers.brevo.com/docs/oauth-integration-guide,
   * https://developers.brevo.com/docs/oauth-scopes et les métadonnées de
   * https://oauth.brevo.com/realms/partner/.well-known/oauth-authorization-server
   * (PKCE S256, `client_secret_post`, révocation). Jeton d'accès d'une heure,
   * jeton d'actualisation de 30 jours. « `:write` n'implique pas `:read` » :
   * les deux sont demandées. L'application se crée avec l'outil en ligne de
   * commande de Brevo (`brevo app init`, https://developers.brevo.com/docs/apps-getting-started),
   * qui déclare les adresses de retour (`auth.redirect_uris`). Limites
   * (https://developers.brevo.com/docs/api-limits) : contacts 36 000 requêtes
   * par heure et 10 par seconde ; les autres points d'accès, dont les
   * campagnes, 100 par heure en offre générale.
   */
  brevo: {
    id: "brevo",
    nom: "Brevo",
    google: false,
    consentement: "https://oauth.brevo.com/realms/partner/oauth/authorize",
    jetons: { hote: "oauth.brevo.com", chemin: "/realms/partner/oauth/token", methode: "POST" },
    lecture: ["account:read", "contacts:read", "campaigns.email:read"],
    choix: [
      // Un brouillon comme un envoi demandent `campaigns.email:write` chez Brevo ; l'envoi se coche en plus, ici.
      { id: "ecriture", portees: ["campaigns.email:write"], revue: false },
      { id: "envoi", portees: ["campaigns.email:write"], revue: false },
    ],
    // Portées d'identité qu'un serveur Keycloak (celui de Brevo : `realms/partner`) ajoute souvent de lui-même.
    implicites: ["openid", "profile", "email", "offline_access"],
    separateur: " ",
    pkce: "S256",
    retour: "instance",
    cheminBoucle: "",
    cleClient: "client_id",
    formeIdentifiant: /^[A-Za-z0-9._:-]{4,100}$/,
    extras: {},
    hotes: ["oauth.brevo.com", "api.brevo.com"],
    documentation: [
      "https://developers.brevo.com/docs/oauth",
      "https://developers.brevo.com/docs/oauth-integration-guide",
      "https://developers.brevo.com/docs/apps-getting-started",
      "https://developers.brevo.com/docs/api-limits",
    ],
  },
  /*
   * Mailchimp, OAuth 2 (https://mailchimp.com/developer/marketing/guides/access-user-data-oauth-2/,
   * lu le 28/09/2026) : consentement sur login.mailchimp.com, échange avec le
   * secret de l'application (aucun PKCE documenté), jeton **qui n'expire
   * pas**, aucune portée, puis `GET /oauth2/metadata` (en-tête
   * `Authorization: OAuth <jeton>`) pour le centre de données du compte
   * (`dc`), qui fixe l'hôte de l'API (`<dc>.api.mailchimp.com`). Aucune
   * révocation documentée : l'écran dit de retirer l'accès dans Mailchimp.
   * Application à déclarer dans le compte (Profil, Extras, « Registered apps »).
   * Limite : 10 connexions simultanées (https://mailchimp.com/developer/marketing/docs/fundamentals/).
   */
  mailchimp: {
    id: "mailchimp",
    nom: "Mailchimp",
    google: false,
    consentement: "https://login.mailchimp.com/oauth2/authorize",
    jetons: { hote: "login.mailchimp.com", chemin: "/oauth2/token", methode: "POST" },
    lecture: [],
    choix: [
      { id: "ecriture", portees: [], revue: false },
      { id: "envoi", portees: [], revue: false },
    ],
    implicites: [],
    separateur: " ",
    pkce: null,
    retour: "instance",
    cheminBoucle: "",
    cleClient: "client_id",
    formeIdentifiant: /^[A-Za-z0-9]{6,40}$/,
    sansPortees: true,
    // La documentation de Mailchimp montre 127.0.0.1 pour les essais sur un poste.
    sansLocalhost: true,
    motifHote: HOTE_MAILCHIMP,
    extras: {},
    hotes: ["login.mailchimp.com"],
    documentation: [
      "https://mailchimp.com/developer/marketing/guides/access-user-data-oauth-2/",
      "https://mailchimp.com/developer/marketing/docs/fundamentals/",
      "https://mailchimp.com/developer/marketing/api/campaigns/",
    ],
  },
};

type Envoyer = (id: "brevo" | "mailchimp", d: { methode: "GET" | "POST"; hote: string; chemin: string; entetes?: Record<string, string>; corps?: string; octets?: number }) => Promise<ReponseApi>;

const court = (v: unknown, max = 200) => (typeof v === "string" ? v.replace(/[\u0000-\u001F\u007F-\u009F]/g, " ").trim().slice(0, max) : "");

/**
 * Le compte, lu avec le jeton obtenu : l'essai qui précède l'enregistrement
 * (oauthNatif.ts, `identite`). `envoyer` est passé par l'appelant, pour que ce
 * module n'importe rien.
 */
export async function identiteProjet(
  id: "brevo" | "mailchimp",
  acces: string,
  envoyer: Envoyer,
  echec: (r: ReponseApi) => Error,
): Promise<{ compte: string; ids: Record<string, string> }> {
  if (id === "brevo") {
    // https://developers.brevo.com/reference/get-account.md (`account:read`).
    const r = await envoyer(id, { methode: "GET", hote: "api.brevo.com", chemin: "/v3/account", entetes: { Authorization: `Bearer ${acces}` } });
    if (r.statut !== 200) throw echec(r);
    return { compte: court(r.json.companyName) || court(r.json.email) || "Brevo", ids: {} };
  }
  const r = await envoyer(id, { methode: "GET", hote: "login.mailchimp.com", chemin: "/oauth2/metadata", entetes: { Authorization: `OAuth ${acces}` } });
  const dc = typeof r.json.dc === "string" ? r.json.dc : "";
  // L'hôte de l'API vient de Mailchimp : il doit avoir la forme d'un centre de données, et rien d'autre.
  if (r.statut !== 200 || !HOTE_MAILCHIMP.test(`${dc}.api.mailchimp.com`)) throw echec(r);
  const login = (r.json.login ?? {}) as { email?: unknown; login_name?: unknown };
  return { compte: court(r.json.accountname) || court(login.email) || "Mailchimp", ids: { dc } };
}

/** Révoque chez Brevo (RFC 7009, point publié par ses métadonnées) ; Mailchimp n'en documente pas. */
export async function revocationProjet(
  id: "brevo" | "mailchimp",
  jetons: { acces: string; actualisation?: string },
  client: { clientId: string; clientSecret: string },
  envoyer: Envoyer,
): Promise<boolean> {
  if (id !== "brevo") return false;
  let tous = true;
  for (const jeton of [jetons.actualisation, jetons.acces].filter((v): v is string => Boolean(v))) {
    const corps = new URLSearchParams({ token: jeton, client_id: client.clientId, client_secret: client.clientSecret }).toString();
    const r = await envoyer(id, { methode: "POST", hote: "oauth.brevo.com", chemin: "/realms/partner/oauth/revoke", entetes: { "Content-Type": "application/x-www-form-urlencoded" }, corps }).catch(() => null);
    tous = tous && r?.statut === 200;
  }
  return tous;
}

/* ------------------------------------------------------------------ */
/* Ce que dit la carte                                                 */
/* ------------------------------------------------------------------ */

/**
 * La phrase de la carte (approbation.ts, `resumerOutil`). Le détail entier
 * (campagne relue, destinataires comptés) est préparé par projets.ts.
 */
export function resumeProjet(outil: string, args: Record<string, unknown>): string | null {
  const extrait = (v: unknown, n = 120) => {
    const s = typeof v === "string" ? v.trim().replace(/\s+/g, " ") : "";
    return s ? ` « ${s.slice(0, n)}${s.length > n ? " …" : ""} »` : "";
  };
  switch (outil) {
    case "brevo__compte":
    case "brevo__listes":
    case "brevo__campagnes":
    case "brevo__campagne":
      return "consulter le compte Brevo";
    case "mailchimp__compte":
    case "mailchimp__audiences":
    case "mailchimp__campagnes":
    case "mailchimp__campagne":
      return "consulter le compte Mailchimp";
    case "brevo__creer_brouillon":
    case "mailchimp__creer_brouillon":
      return `préparer dans ${outil.startsWith("brevo") ? "Brevo" : "Mailchimp"} le brouillon de campagne${extrait(args.objet)} (rien ne sera envoyé)`;
    case "brevo__envoyer_campagne":
    case "mailchimp__envoyer_campagne":
      return `envoyer maintenant la campagne ${outil.startsWith("brevo") ? "Brevo" : "Mailchimp"} ${typeof args.campagne === "string" || typeof args.campagne === "number" ? String(args.campagne).slice(0, 40) : "?"} (un envoi ne se reprend pas)`;
  }
  if (estEcritureMcpProjet(outil)) {
    const i = outil.indexOf("__");
    const service = REGLES_MCP[outil.slice(0, i) as IdMcpProjet]?.nom ?? outil.slice(0, i);
    return `modifier ${service}, au nom du compte connecté, par son outil « ${outil.slice(i + 2)} »`;
  }
  return null;
}
