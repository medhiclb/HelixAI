import { outilsVps, executerVps, projetsVps } from "./vps.ts";
import type http from "node:http";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { toolsForModel as outilsMcp } from "./mcp.ts";
import * as courrier from "./courrier.ts";
import * as agenda from "./agenda.ts";
import * as drive from "./drive.ts";
import * as slack from "./slack.ts";
import * as bibliotheque from "./bibliotheque.ts";
import * as reunions from "./reunions.ts";
import { groupesDe } from "./groupes.ts";
import { executerOutil, cibleDe, refusApplication, type DefinitionOutil } from "./outils.ts";
import { verifierOutil } from "./approbation.ts";
import { journaliser } from "./audit.ts";
import { api, cleOutilsValide, portEnCours } from "./opencode.ts";
import { destinataireDe } from "./fluxCode.ts";
import { sessionCode } from "./sessionsCode.ts";
import { estEcritureMcpProjet } from "./natifs/projetsRegles.ts";
import { estEcriturePalmier } from "./palmierRegles.ts";

/**
 * Les connecteurs de l'instance, servis par MCP à l'agent de code (OpenCode).
 *
 * Jusqu'ici, Helix Code n'avait que les outils d'OpenCode : lire, écrire,
 * chercher, lancer une commande dans le dossier du projet. Les connecteurs
 * branchés dans Paramètres (Google Drive, Slack, courrier, agenda, serveurs
 * MCP du catalogue) n'existaient que pour le Chat et Cowork, parce que c'est
 * la boucle de `chat.ts` qui les exécute, et qu'OpenCode tient sa propre
 * boucle. Demandé le 25/09/2026 : « les différents MCP » doivent marcher aussi
 * depuis le terminal, c'est-à-dire dans Helix Code.
 *
 * OpenCode sait parler à un serveur MCP distant (`mcp` de sa configuration,
 * type « remote », en-têtes fixes). Vérifié le 25/09/2026 sur OpenCode
 * 1.18.32 : il s'y connecte en HTTP « streamable », avec les en-têtes écrits
 * dans sa configuration. On ne lui donne pas les serveurs eux-mêmes, on lui
 * donne **cette route**, et c'est ce qui rend la chose sûre :
 *
 *  - chaque appel passe par la barrière d'approbation (`verifierOutil`), au
 *    niveau choisi pour l'instance, comme dans le Chat. Donner à OpenCode la
 *    commande des serveurs MCP l'aurait laissé les appeler sans jamais
 *    demander, c'est-à-dire contourner la barrière ;
 *  - chaque appel est scellé au journal, au nom de la personne ;
 *  - les secrets des connecteurs restent dans la passerelle : OpenCode ne voit
 *    que des noms d'outils.
 *
 * **Le serveur de fichiers de Cowork n'y est pas**, ni le contrôle du code
 * web, ni l'écran, ni la bureautique. Ils agissent sur le dossier de travail de
 * Cowork, pas sur celui du projet : les donner à l'agent de code l'aurait fait
 * sortir du dossier du projet, que sa configuration lui interdit de quitter
 * (`external_directory: deny`, opencode.ts). Pour les fichiers du projet, il a
 * déjà les siens.
 *
 * **Pourquoi Helix Code passe par l'ancienne API d'OpenCode.** Les sessions de
 * sa nouvelle API (`/api/session`) ne proposent au modèle que les outils
 * livrés avec OpenCode : son registre d'outils « v2 » n'a aucune place pour
 * ceux des serveurs MCP (lu dans le code d'OpenCode 1.18.32, voir
 * fluxCode.ts), et le modèle répondait que l'outil n'existait pas. Les
 * sessions de l'ancienne API (`/session`), elles, reçoivent les outils MCP.
 * Depuis le 25/09/2026, Helix Code ouvre donc ses sessions par l'ancienne API,
 * et la passerelle traduit son flux pour les clients (fluxCode.ts). Vérifié le
 * même jour avec Qwen3 8B, un serveur MCP d'essai (scripts/mcp-essai.mjs) et
 * `helix code` comme la route de l'écran : l'outil est proposé et appelé, la
 * carte d'accord arrive chez la personne qui a envoyé la demande, le refus
 * empêche l'appel, l'accord le laisse partir, le journal le note
 * (`surface: "code"`), et deux personnes au travail en même temps font
 * refuser sans carte.
 *
 * **Pour qui l'agent travaille.** OpenCode ne dit pas, dans un appel d'outil,
 * de quelle session il vient : un seul client MCP sert toutes ses sessions
 * (vérifié : aucun en-tête ni champ ne la porte). La passerelle, elle, sait qui
 * a envoyé chaque demande à Helix Code (`noterDemande`), et OpenCode dit
 * quelles sessions travaillent en ce moment (voir `titulaire`). Un appel
 * d'outil vient forcément d'une session au travail : si toutes celles qui
 * travaillent appartiennent à la même personne, c'est elle. Sinon — deux
 * personnes au même instant, ou personne de connu — l'outil est **refusé**,
 * sans carte : une carte envoyée à la mauvaise personne lui ferait approuver
 * l'action d'un autre. Un contrôle qui ne sait pas refuse.
 */

/** Demandes envoyées à Helix Code : session OpenCode → personne et dossier. */
const demandes = new Map<string, { userId: string; dossier: string; depuis: number }>();

/** Une demande part : la session appartient, pour ce tour, à cette personne. */
export function noterDemande(sessionID: string, userId: string, dossier: string): void {
  demandes.set(sessionID, { userId, dossier, depuis: Date.now() });
  // Borne de mémoire : les plus anciennes s'oublient d'abord.
  if (demandes.size > 500) {
    const plusAncienne = [...demandes.entries()].sort((a, b) => a[1].depuis - b[1].depuis)[0];
    if (plusAncienne) demandes.delete(plusAncienne[0]);
  }
}

/**
 * La personne pour qui l'agent de code travaille en ce moment, ou `null` si on
 * ne peut pas le dire sans ambiguïté.
 */
async function titulaire(): Promise<{userId:string;vps?:string} | null> {
  const dossiers = new Set([...demandes.values()].map((d) => d.dossier));
  const auTravail = new Set<string>();
  /*
   * Deux listes, parce qu'OpenCode tient deux familles de sessions : celles de
   * l'ancienne API (`/session`, celles de Helix Code depuis le 25/09/2026),
   * actives dans `/session/status` (mesuré : `{"ses_…":{"type":"busy"}}`
   * pendant un tour), et celles de la nouvelle, dans `/api/session/active`
   * (`{"data":{"ses_…":{"type":"running"}}}`), que la première ne voit pas.
   * Helix n'ouvre plus de session de la nouvelle API : une session active qui
   * n'est pas dans `demandes`, de l'une ou l'autre famille, n'a pas été
   * ouverte par Helix, compte comme inconnue, donc fait refuser.
   */
  for (const dossier of dossiers) {
    const d = encodeURIComponent(dossier);
    for (const [chemin, lire] of [
      [`/api/session/active?directory=${d}`, (c: unknown) => (c as { data?: unknown })?.data],
      [`/session/status?directory=${d}`, (c: unknown) => c],
    ] as const) {
      try {
        const r = await api(chemin, { signal: AbortSignal.timeout(3000) });
        if (!r.ok) continue;
        const etat = lire(await r.json()) as Record<string, { type?: string } | undefined> | undefined;
        for (const [id, s] of Object.entries(etat ?? {})) {
          // « idle » ne travaille pas ; « running », « busy » et « retry », si.
          if (s && s.type !== "idle") auTravail.add(id);
        }
      } catch {
        /* illisible : ce dossier ne compte pour personne, ce qui fait refuser plutôt qu'attribuer */
      }
    }
  }
  const personnes = new Set<string>();
  const cibles = new Set<string>();
  for (const id of auTravail) {
    /*
     * La session elle-même, sinon celle qui a lancé ce sous-agent, sinon le
     * registre (les sous-sessions y sont inscrites sous la propriétaire du
     * parent). Revue du 25/09/2026 : pendant une sous-tâche, la session du
     * sous-agent travaillait sans être dans `demandes`, et tout connecteur
     * était refusé.
     */
    const racine = destinataireDe(id)?.session;
    let qui = demandes.get(id)?.userId ?? (racine ? demandes.get(racine)?.userId : undefined);
    if (!qui) qui = (await sessionCode(id).catch(() => undefined))?.userId;
    // Une session au travail que Helix n'a pas lancée (ouverte hors de la passerelle) : inconnue, donc ambiguë.
    personnes.add(qui ?? "?");
    const s = await sessionCode(id).catch(()=>undefined) ?? (racine ? await sessionCode(racine).catch(()=>undefined) : undefined);
    cibles.add(s?.vps ?? "");
  }
  if (personnes.size !== 1) return null;
  const [seule] = [...personnes];
  return seule === "?" || !seule ? null : {userId:seule,vps:cibles.size===1 ? [...cibles][0] || undefined : undefined};
}

/**
 * La bibliothèque de l'équipe et les réunions ont-elles quelque chose pour la
 * personne qui a envoyé la dernière demande ? Leurs outils existent toujours
 * (ce ne sont pas des connecteurs qu'on branche), mais servis à vide ils
 * coûtaient 718 jetons à chaque lecture de la demande par le modèle, mesuré le
 * 25/09/2026 sur une instance sans document ni réunion. Relevé avant chaque
 * demande (`rafraichirOutilsCode`), gardé ici parce que la liste d'outils se
 * lit sans savoir pour qui.
 */
const contenus = { bibliotheque: false, reunions: false };

/** Outils offerts à l'agent de code : les connecteurs, sans ce qui agit hors du projet. */
export function outilsPourCode(): DefinitionOutil[] {
  return [
    ...outilsVps(),
    // Ni les écritures de Trello, Monday, ClickUp, Todoist, Calendly et Zoom : réservées au Chat de l'administrateur (SECURITE.md § 48).
    // Ni celles de Palmier Pro (29/09/2026) : modifier un montage ou générer n'a rien à faire dans un projet de code.
    // Celles de Roblox Studio et de Blender restent (12/10/2026, demande de Medhi) : un script Luau ou Python est du code ; carte à chaque appel, administrateur seul (outils.ts).
    ...outilsMcp().filter((o) => !o.function.name.startsWith("fichiers__") && !estEcritureMcpProjet(o.function.name) && !estEcriturePalmier(o.function.name)),
    ...courrier.toolsForModel(),
    ...agenda.toolsForModel(),
    ...drive.toolsForModel(),
    ...slack.toolsForModel(),
    ...(contenus.bibliotheque ? bibliotheque.toolsForModel() : []),
    ...(contenus.reunions ? reunions.toolsForModel() : []),
  ];
}

/** Relève ce que la bibliothèque et les réunions montrent à cette personne (voir `contenus`). */
async function releverContenus(userId: string | undefined): Promise<void> {
  if (!userId) {
    contenus.bibliotheque = false;
    contenus.reunions = false;
    return;
  }
  try {
    const qui = { userId, groupes: await groupesDe(userId) };
    const [documents, seances] = await Promise.all([
      bibliotheque.documentsVisibles(qui).catch(() => null),
      reunions.lister(qui).catch(() => null),
    ]);
    // Illisible : on garde les outils, mieux vaut quelques jetons de trop qu'un outil qui manque.
    contenus.bibliotheque = documents === null || documents.length > 0;
    contenus.reunions = seances === null || seances.length > 0;
  } catch {
    contenus.bibliotheque = true;
    contenus.reunions = true;
  }
}

/**
 * Liste d'outils vue par OpenCode, par serveur OpenCode et par dossier.
 *
 * OpenCode lit la liste des outils d'un serveur MCP **une fois**, quand il s'y
 * connecte, et la garde (lu dans son code, 1.18.32 : `defs`, remplis à la
 * connexion). Cette route est sans état : elle ne peut pas lui annoncer un
 * changement. Mesuré le 25/09/2026 : un connecteur ajouté pendant qu'OpenCode
 * tournait n'existait pas pour l'agent de code (« Aucun outil disponible pour
 * ajouter des notes »), jusqu'au redémarrage d'OpenCode. Avant chaque demande,
 * si la liste a changé depuis la dernière connexion, on demande à OpenCode de
 * se reconnecter (`POST /mcp/helix/connect`), ce qui la lui fait relire.
 */
const listesVues = new Map<string, string>();

export async function rafraichirOutilsCode(dossier: string, userId?: string): Promise<void> {
  await releverContenus(userId);
  const serveur = portEnCours();
  if (!serveur) return;
  const cle = `${serveur}|${dossier}`;
  const signature = outilsPourCode()
    .map((o) => o.function.name)
    .sort()
    .join(",");
  if (listesVues.get(cle) === signature) return;
  try {
    const r = await api(`/mcp/helix/connect?directory=${encodeURIComponent(dossier)}`, {
      method: "POST",
      signal: AbortSignal.timeout(10_000),
    });
    await r.text().catch(() => "");
    if (r.ok) listesVues.set(cle, signature);
  } catch {
    /* OpenCode n'a pas répondu : on réessaiera à la demande suivante */
  }
}

/**
 * Sert une requête MCP d'OpenCode. Rend `false` si la clé manque ou ne va pas :
 * l'appelant répond alors 403. Sans état, comme `serveurOutils.ts` : un
 * transport par requête, réponses JSON.
 */
export async function servirOutilsCode(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  corps: unknown,
): Promise<boolean> {
  const cle = req.headers["x-helix-cle"];
  if (!cleOutilsValide(cle)) return false;

  const serveur = new Server({ name: "helix-code-outils", version: "1.0.0" }, { capabilities: { tools: {} } });

  serveur.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: outilsPourCode().map((o) => ({
      name: o.function.name,
      description: o.function.description,
      inputSchema: o.function.parameters as { type: "object"; [k: string]: unknown },
    })),
  }));

  /*
   * OpenCode abandonne l'appel (arrêt demandé, délai dépassé) : la requête se
   * ferme. Une approbation accordée **après** ne doit pas faire partir une
   * action que l'agent tient déjà pour échouée.
   */
  const controle = new AbortController();
  let ferme = false;
  res.on("close", () => {
    ferme = true;controle.abort();
  });

  serveur.setRequestHandler(CallToolRequestSchema, async (demande) => {
    const nom = demande.params.name;
    let args = (demande.params.arguments ?? {}) as Record<string, unknown>;
    const texte = (t: string, erreur = false) => ({ content: [{ type: "text" as const, text: t }], isError: erreur });

    // Relu à chaque appel : un connecteur débranché entre-temps ne part plus.
    if (!outilsPourCode().some((o) => o.function.name === nom)) {
      return texte(`L'outil ${nom} n'est pas disponible pour l'agent de code.`, true);
    }

    const cibleCode = await titulaire();
    const qui = cibleCode?.userId;
    if (!qui) {
      journaliser("outil.refuse", "systeme", { outil: nom, surface: "code", cause: "titulaire-inconnu" });
      return texte(
        "Outil refusé par l'instance : elle ne peut pas dire avec certitude pour qui tu travailles " +
          "(plusieurs personnes utilisent l'agent de code en même temps). Réessaie plus tard ou fais sans cet outil, et dis-le.",
        true,
      );
    }

    if (nom === "vps__executer" && (!cibleCode?.vps || args.serveur !== cibleCode.vps)) return texte("Ce serveur ne correspond pas à la session distante active.",true);
    if (nom === "vps__executer") { const projet=(await projetsVps(qui)).find(p=>p.id===args.serveur);if(!projet)return texte("Serveur introuvable.",true);args={...args,serveur_nom:projet.nom,hote:projet.hote,dossier:projet.dossier}; }
    // Roblox Studio, Blender : le droit d'agir avant la carte (12/10/2026), refait par executerOutil.
    const refusAppli = await refusApplication(nom, args, { userId: qui });
    if (refusAppli) return texte(refusAppli, true);
    const verdict = await verifierOutil(null, nom, args, qui, undefined, false, "code");
    if (!verdict.autorise) return texte(verdict.message, true);
    if (ferme) {
      journaliser("outil.refuse", qui, { outil: nom, surface: "code", cause: "appel-abandonne" });
      return texte("Appel abandonné avant l'accord : l'action n'a pas été faite.", true);
    }

    const pour = { userId: qui, groupes: await groupesDe(qui) };
    const r = nom === "vps__executer" ? await executerVps(qui,args,controle.signal) : nom.startsWith("reunions__") ? await reunions.callTool(nom, args, pour) : await executerOutil(nom, args, pour);
    journaliser("outil.appele", qui, { outil: nom, cible: cibleDe(args), ok: r.ok, surface: "code" });
    return texte(r.content, !r.ok);
  });

  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  res.on("close", () => {
    void transport.close();
    void serveur.close();
  });
  await serveur.connect(transport);
  await transport.handleRequest(req, res, corps);
  return true;
}
