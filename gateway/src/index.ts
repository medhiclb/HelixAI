import * as vps from "./vps.ts";
import { preparerScenario } from "./videosScenario.ts";
// En premier : sous Windows, rien de ce que lance la passerelle n'ouvre de console (processus.ts).
import "./processus.ts";
import http from "node:http";
import { once } from "node:events";
import { estEnvoiEnFlux, lireEnvoi, LIBELLE_DOCUMENT_MAX } from "./televersement.ts";
import { ENTETES_SECURITE, entetesOrigine, entetesFlux } from "./entetes.ts";
import { nomProduit } from "./marque.ts";
import { avecLangueDe, langue, t, tf } from "./langue.ts";
import * as telechargement from "./telechargement.ts";
import https from "node:https";
import { tlsMaterial } from "./tls.ts";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import * as debit from "./debit.ts";
import * as clesApi from "./clesApi.ts";
import * as flux from "./flux.ts";
import * as invitations from "./invitations.ts";
import {
  adressePourLesCollegues,
  adressesPourLesCollegues,
  etatReseau,
  propositions,
  reglerReseau,
} from "./reseau.ts";
import { estAdministrateur, origineDuRole } from "./roles.ts";
import { estProtege } from "./zonesProtegees.ts";
import { PORT, HOST, surLeReseau, tousLesBackends } from "./config.ts";
import {
  discover,
  loadModel,
  stopLmStudioIfStarted,
  findLms,
  oublierLms,
  ensureLmStudioServer,
  lmStudioRepond,
  conseilDemarrageLmStudio,
  backendById,
} from "./backends.ts";
import { models, invalidate, resolve } from "./router.ts";
import { agentAAppele, handleChatRequest } from "./chat.ts";
import {
  startAutoServers,
  startServer,
  stopServer,
  arreterTousEnPartant as arreterServeursMcp,
  status as mcpStatus,
  statusFrais as mcpStatusFrais,
  workspace,
  setWorkspace,
  workspaces,
} from "./mcp.ts";
import {
  detectHardware,
  recommendVision,
  adaptesALaMachine,
  CATALOG,
  VISION_CATALOG,
  ensureLocalModel,
  getProvisionState,
  setProvisionState,
  onProvisionChange,
  verifierModeleEnPlace,
  catalogueOuvert,
  conseilPourLaMachine,
  miseEnRouteEnCours,
  modelesQuiTiennent,
  catalogueComplet,
  refusTropLourd,
} from "./provision.ts";
import { choisirEmplacement, etatEmplacement, moteurLocal, placeNecessaire, verifierEmplacement, type MoteurLocal } from "./emplacementModeles.ts";
import { moteurOuvert } from "./llamaCppBase.ts";
import { arreterLlama, installerLlamaCpp, llamaCppInstalle, menageLlama } from "./llamaCpp.ts";
import { estDefaillant, etatSurCetteMachine } from "./santeModeles.ts";
import { deployment, autoProvisionEnabled } from "./deployment.ts";
import { etat as etatRechercheWeb } from "./rechercheWeb.ts";
import { db, isCollection, COLLECTIONS, migrerChiffrement, type Collection } from "./db.ts";
import { exporterDonnees } from "./export.ts";
import * as memoireConversation from "./memoireConversation.ts";
import * as competences from "./competences.ts";
import { chargerReglagesEcran, configEcran, definirModeEcran, modeModifiable } from "./reglagesEcran.ts";
import { applicationEnAttenteDeChoix, chargerChoixMoteur, definirChoixMoteur, etatChoixMoteur } from "./reglagesMoteur.ts";
import { chmodSync, readFileSync, writeFileSync } from "node:fs";
import { join as joindre } from "node:path";
import { homedir as dossierPersonnel } from "node:os";
import * as images from "./images.ts";
import * as optimisation from "./optimisationLocale.ts";
import { contenuLogiciel, logicielsTrouves, pageLogiciel } from "./importLocal.ts";
import * as entrainement from "./entrainement.ts";
import { choisirDesign, corrigerPages, estApplication, estDemandeDeSite, preparerDesign, projetDejaCommence } from "./design.ts";
import { METHODE_CODE, apresTourCode, consigneLangue, arretDemandeCode, demandeArretee, nouvelleDemandeCode } from "./controleCode.ts";
import { applicationPreparee, consigneApplication, ecrireApplication, planifierApplication } from "./application.ts";
import { blocCarte } from "./carteProjet.ts";
import { estQuestionSimple, estReplique, strategie } from "./plan.ts";
import { consignePremiereEtape, demarrerSequence, planifierCode } from "./sequenceCode.ts";
import { arreterMachine, arreterMachineEnPartant, choisirSysteme, demarrerMachine, diagnosticMachine, effacerMachine, preparationMachineEnCours, progressionMachine, systemeMachine } from "./machine.ts";
import { apercuEffacement, effacerCompte, sansComptesDisparus } from "./effacement.ts";
import { authorise, cheminDuJeton, hasValidToken, instanceToken } from "./auth.ts";
import * as employes from "./employes.ts";
import * as fournisseurs from "./fournisseurs.ts";
import * as groupes from "./groupes.ts";
import * as bibliotheque from "./bibliotheque.ts";
import * as connaissances from "./connaissances.ts";
import * as reunions from "./reunions.ts";
import { etat as etatAgenda } from "./agenda.ts";
import { installerOpenClaw, etatInstallation, assurerNodePrive, reparerVisualCpp } from "./installationOpenClaw.ts";
import { canalOuvert, ecouterLApplication, envoyerALApplication, surFinDuCanal } from "./canalApplication.ts";
import { listerEspace, lireFichierEspace } from "./espace.ts";
import { consommationDe } from "./usage.ts";
import { servirOutils, auteurEmploye } from "./serveurOutils.ts";
import { servirOutilsCode, noterDemande as noterDemandeCode, rafraichirOutilsCode } from "./outilsCode.ts";
import { FAMILLES, outilsDeFamille } from "./outils.ts";
import {
  publicAccounts,
  createAccount,
  verifyAccount,
  modifierProfil,
  definirPremierMotDePasse,
  remplacerMotDePasseProvisoire,
  validerSecondFacteur,
  etatDeuxFacteurs,
  preparerDeuxFacteurs,
  activerDeuxFacteurs,
  desactiverDeuxFacteurs,
  regenererCodesDeSecours,
  preparerInscription,
  activerInscription,
  defiInscription,
  deuxFacteursObligatoire,
  seanceAdmise,
  confirmerIdentite,
  adresseDePartage,
  definirMotDePasse,
  reinitialiserParAdministrateur,
  etatRecuperation,
  creerCodesRecuperation,
  recupererParCode,
} from "./accounts.ts";
import {
  openSession,
  resolveSession,
  listSessions,
  revokeSession,
  revokeAll,
} from "./usersession.ts";
import { filtrer, fusionner, type Demandeur } from "./authz.ts";
import { appInstallee, installerMoteur, llmsterPoseAilleurs, lmStudioEnPlace, moteurAPoser } from "./engine.ts";
import {
  diagnostic as atelierDiagnostic,
  preparer as preparerAtelier,
  verifier as verifierAtelier,
  diagnosticDictee,
  preparerDictee,
} from "./atelier.ts";
import { oublierAtelier } from "./bureau.ts";
import { lireAudio, transcrire, ErreurDictee } from "./dictee.ts";
import {
  etat as courrierEtat,
  configurer as configurerCourrier,
  oublier as oublierCourrier,
  reglerEnvoi as reglerEnvoiCourrier,
  reglerConfirmation as reglerConfirmationCourrier,
  fournisseursConnus,
  reglagesConnus,
  charger as chargerCourrier,
  brancherParOauth,
} from "./courrier.ts";
import {
  achever as acheverCourrier,
  demarrer as demarrerCourrier,
  estEtatCourrier,
  refuserCourrier,
  courrierEnAttente,
  retourEnvoye,
  retourADeclarer,
  surLaBoucle,
  ouvrirBoucle as ouvrirBoucleCourrier,
  collerRetourCourrier,
  boucleOuverte,
  issueCourrier,
  valider as validerOauthCourrier,
} from "./courrierOauth.ts";
import {
  etat as agendaEtat,
  configurer as configurerAgenda,
  oublier as oublierAgenda,
  serveursConnus,
  reglagesConnus as reglagesAgendaConnus,
  charger as chargerAgenda,
} from "./agenda.ts";
import * as connecteurs from "./connecteurs.ts";
import * as drive from "./drive.ts";
import * as agendaGoogle from "./agendaGoogle.ts";
import * as natifs from "./oauthNatif.ts";
import * as messageries from "./natifs/messageries.ts";
import * as commerce from "./natifs/commerce.ts";
import { estMcpProjet } from "./natifs/projetsRegles.ts";
import * as tachesProgrammees from "./tachesProgrammees.ts";
import { chargerClientGoogle, clientGoogle, effacerClientGoogle, enregistrerClientGoogle, etatClientGoogle } from "./clientGoogle.ts";
import * as slack from "./slack.ts";
import { conservationJours, journaliser, lire as lireAudit, verifier as verifierAudit, jours as joursAudit } from "./audit.ts";
import * as computer from "./computer.ts";
import * as approbation from "./approbation.ts";
import * as usage from "./usage.ts";
import { installerOpencode } from "./opencodePrive.ts";
import { economiesSession, etatRtk, lireReglageRtk, noterRtkSession, relayerReplis, rtkActifDans, rtkPourDemande } from "./rtk.ts";
import { routeCodex, arreterCodex, surLeBureau, depuisLaBoucle } from "./codex.ts";
import {
  oublierOpencode,
  opencodeEnFond,
  status as codeStatus,
  api as codeApi,
  enMarche as codeEnMarche,
  projectDir,
  dossierParDefaut as dossierCodeParDefaut,
  validerDossier,
  setProjectDir,
  listerDossiers,
  stopServer as stopCodeServer,
  assurerModele as assurerModeleCode,
  toutLePoste,
  varianteDe,
  refModele,
  idMessage as idMessageCode,
  cleRelaisValide,
} from "./opencode.ts";
import {
  suivreSession as suivreSessionCode,
  sessionSuivie as sessionCodeSuivie,
  ecouterDossier as ecouterDossierCode,
  abonner as abonnerCode,
  dernierNumero as dernierNumeroCode,
  surFinDeTour as surFinDeTourCode,
  noterRelanceHelix,
  publierStatut as publierStatutCode,
  travailHelix as travailHelixCode,
  ouvrirTour as ouvrirTourCode,
  fermerTour as fermerTourCode,
  reposConfirme as reposConfirmeCode,
  auTravail as auTravailCode,
  helixAuTravail as helixAuTravailCode,
  type EvenementCode,
} from "./fluxCode.ts";
import {
  noterSession as noterSessionCode,
  toucherSession as toucherSessionCode,
  sessionCode,
  sessionsDe,
  sessionsDe as sessionsCodeDe,
  retirerSession as retirerSessionCode,
  historiqueDe as historiqueCode,
  type SessionCode as SessionCodeInscrite,
} from "./sessionsCode.ts";
import { nouveauTourCode } from "./permissionsCode.ts";
import { moteurDeLaMachine, type ChatRequest } from "./types.ts";

/* --------------------------------- utilitaires --------------------------------- */








function send(res: http.ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(payload),
    // `res.req` est la requête qui a produit cette réponse : cela évite de
    // faire passer la requête en paramètre dans les quelque soixante appels de
    // `send`, alors qu'elle est déjà là.
    ...entetesOrigine(res.req),
    ...ENTETES_SECURITE,
  });
  res.end(payload);
}

/**
 * Taille maximale d'un corps de requête.
 *
 * Le corps était accumulé sans aucune borne. Mesuré sur le banc : une seule
 * requête de 400 Mo fait passer la passerelle de 108 à 1196 Mo de mémoire
 * résidente — le tampon, puis la chaîne, puis l'arbre JSON. Quelques requêtes
 * simultanées suffisent donc à tuer le processus, et un plantage de la
 * passerelle arrête le logiciel entier pour l'utilisateur.
 *
 * 32 Mo laisse de la marge au plus gros corps légitime : une conversation qui
 * rejoue plusieurs captures d'écran en base64 (quelques centaines de
 * kilo-octets chacune), tout en gardant la mémoire d'une requête bornée.
 */
const CORPS_MAX = 32 * 1024 * 1024;
/**
 * Ancien envoi d'un document (base64 dans un JSON), gardé pour un poste d'une
 * version antérieure : 25 Mo de fichier font 33,4 Mo en base64, plus le texte
 * extrait. Les envois actuels passent en flux (televersement.ts), sans cette
 * limite.
 */
const CORPS_DOCUMENT_MAX = 42 * 1024 * 1024;

/**
 * Envoie un flux en réponse, au rythme où le client le lit (sans remplir la
 * mémoire si le réseau est lent). Une erreur en cours de route coupe la
 * connexion : le client voit un téléchargement échoué, jamais un fichier
 * tronqué présenté comme complet (la longueur annoncée ne sera pas atteinte).
 */
async function envoyerFlux(res: http.ServerResponse, flux: AsyncIterable<Buffer>): Promise<void> {
  try {
    for await (const morceau of flux) {
      if (res.destroyed) return;
      if (!res.write(morceau)) await once(res, "drain");
    }
    res.end();
  } catch (err) {
    console.error("[flux] envoi interrompu :", err instanceof Error ? err.message : err);
    res.destroy();
  }
}

async function readJson(req: http.IncomingMessage, max = CORPS_MAX): Promise<unknown> {
  const chunks: Buffer[] = [];
  let taille = 0;
  for await (const chunk of req) {
    taille += (chunk as Buffer).length;
    /*
     * On s'arrête dès le dépassement, sans lire la suite : continuer à
     * accumuler un corps qu'on a déjà décidé de refuser serait précisément
     * l'épuisement mémoire qu'on cherche à empêcher. Sortir de la boucle par
     * une exception referme le flux entrant.
     */
    if (taille > max) {
      throw new Error(`Corps de requête trop volumineux (limite : ${Math.round(max / (1024 * 1024))} Mo).`);
    }
    chunks.push(chunk as Buffer);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

/* ---------------------------------- routes ------------------------------------ */

/**
 * Contrôle de présence. Cette route reste accessible sans jeton pour qu'un
 * poste puisse vérifier l'adresse saisie : elle ne révèle donc que le strict
 * nécessaire tant que l'appelant n'est pas authentifié.
 */
async function handleHealth(res: http.ServerResponse, authorised: boolean): Promise<void> {
  // Sans attendre le réveil de LM Studio : l'application attend cette réponse pour ouvrir sa fenêtre (backends.ts, `discover`).
  const { backends, models: found } = await discover({ attendreLmStudio: false });
  const online = backends.some((b) => b.online);

  if (!authorised) {
    return send(res, 200, {
      ok: online,
      helix: true,
      modelCount: found.length,
      requiresToken: true,
    });
  }

  const profile = deployment();
  send(res, 200, {
    ok: online,
    backends,
    modelCount: found.length,
    deployment: {
      client: profile.client ?? null,
      pinnedModels: profile.models ?? {},
      autoProvision: profile.autoProvision !== false,
      computerUse: configEcran().mode,
    },
  });
}

async function handleModels(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  url: URL,
  openaiShape: boolean,
): Promise<void> {
  // Un modèle branché par une clé personnelle ne se montre qu'à son titulaire.
  const qui = await demandeur(req, url);
  const list = (await models(true)).filter((m) => !m.proprietaire || m.proprietaire === qui?.userId);
  if (openaiShape) {
    send(res, 200, {
      object: "list",
      data: list.map((m) => ({
        id: m.uid,
        object: "model",
        owned_by: m.backendLabel,
        helix: {
          name: m.id,
          backend: m.backendId,
          roles: m.roles,
          loaded: m.loaded,
          params: m.params,
          arch: m.arch,
          sizeBytes: m.sizeBytes,
          reasoning: m.reasoning,
          origine: m.origine,
          pays: m.pays,
          fournisseur: m.fournisseur,
          personnel: Boolean(m.proprietaire),
        },
      })),
    });
    return;
  }
  // Un modèle local qui a mal répondu sur cette machine : le sélecteur l'avertit (santeModeles.ts, 27/09/2026).
  send(res, 200, {
    models: list.map((m) => {
      const etat = moteurDeLaMachine(m.backendKind) ? etatSurCetteMachine(m.id) : undefined;
      return etat ? { ...m, surCetteMachine: etat } : m;
    }),
  });
}

/**
 * /v1/chat/completions — routage par rôle + boucle d'outils MCP.
 * Le canal `reasoning_content` (modèles à raisonnement) est préservé, et
 * l'activité des outils est relayée par des événements `helix`.
 */
async function handleChat(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  url: URL,
): Promise<void> {
  let body: ChatRequest;
  try {
    body = (await readJson(req)) as ChatRequest;
  } catch (err) {
    // Un message trop gros (pièces jointes) était annoncé comme « JSON invalide » : faux, et sans issue.
    const tropGros = err instanceof Error && err.message.startsWith("Corps de requête trop volumineux");
    return send(res, tropGros ? 413 : 400, {
      error: {
        message: tropGros
          ? tf("Message trop volumineux pour l'instance (limite : {0} Mo). Retirez une pièce jointe ou raccourcissez le texte.", CORPS_MAX / (1024 * 1024))
          : t("Corps JSON invalide."),
      },
    });
  }

  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return send(res, 400, { error: { message: t("`messages` est requis.") } });
  }

  /*
   * Deux usages derrière la même route. Converser avec un modèle ne demande que
   * le jeton : c'est le point d'entrée compatible OpenAI, celui qu'utilisent
   * OpenCode et tout client tiers, qui exécutent leurs propres outils chez eux.
   *
   * Mais `tools: true` demande à *l'instance* d'agir — lire et écrire des
   * fichiers, piloter l'écran. Cela engage une personne, donc exige une séance.
   */
  /*
   * Appel par clé d'API (clesApi.ts) : la titulaire est déjà résolue, mais une
   * clé ne fait jamais agir l'instance. `tools: true` (fichiers, écran,
   * connecteurs de la personne, exécutés par la passerelle) est refusé ; les
   * outils que le programme fournit et exécute lui-même (`tools: [...]`)
   * passent, comme pour OpenCode. `tools: false` est l'interrupteur de
   * l'écran : il n'a pas de sens ici et ferait passer par le découpage des
   * tâches, dont les évènements ne sont pas du format OpenAI.
   */
  const idCle = parCleApi.get(req);
  if (idCle) {
    if (body.tools === true) {
      return send(res, 403, {
        error: {
          message: t(
            "Une clé d'API ne fait pas agir l'instance : les outils exécutés par elle (tools: true) sont refusés. Les outils que votre programme fournit et exécute lui-même restent possibles.",
          ),
        },
      });
    }
    if (typeof body.tools === "boolean") delete body.tools;
  }

  /*
   * Une tâche programmée (tachesProgrammees.ts) : la passerelle qui s'appelle
   * elle-même, depuis la boucle locale, avec la clé tirée au sort à ce
   * démarrage. L'agent agit alors au nom de la propriétaire de la tâche.
   */
  const tacheDe = req.headers["x-helix-tache"];
  const cleTache = req.headers["x-helix-cle-tache"];
  const parTache =
    typeof tacheDe === "string" &&
    typeof cleTache === "string" &&
    // Longueur en octets : un en-tête non ASCII faisait lever timingSafeEqual (erreur 500).
    Buffer.byteLength(cleTache) === Buffer.byteLength(CLE_TACHES) &&
    timingSafeEqual(Buffer.from(cleTache), Buffer.from(CLE_TACHES)) &&
    depuisCePoste(req)
      ? (await publicAccounts().catch(() => [])).some((c) => c.id === tacheDe)
        ? { userId: tacheDe }
        : null
      : null;
  const qui = parTache ?? (await demandeur(req, url));
  const titreDeTache = (r: http.IncomingMessage) => {
    const brut = r.headers["x-helix-tache-titre"];
    try {
      return typeof brut === "string" ? decodeURIComponent(brut).slice(0, 120) : undefined;
    } catch {
      return undefined;
    }
  };
  if (body.tools === true && !qui) {
    return send(res, 401, {
      error: {
        message: t("Faire agir l'agent sur vos fichiers ou votre écran demande une séance ouverte. Reconnectez-vous."),
      },
    });
  }
  /*
   * La recherche sur le web du Chat (rechercheWeb.ts) fait sortir des requêtes
   * de l'instance, vers DuckDuckGo et les pages qu'elle lit, au nom de qui la
   * demande : une séance, comme `tools: true`. Tournée finale de la
   * 2026.928.6 (SECURITE.md § 53) : `tools: false, web: true` suffisait avec
   * le seul jeton d'instance (un poste sans séance, un compte désactivé, un
   * programme qui détient le jeton), et l'instance cherchait et ouvrait pour
   * lui les adresses écrites dans « son » message, sans que personne ne soit
   * nommé au journal. Un employé OpenClaw ou OpenCode n'a pas de séance : il
   * n'y a pas droit non plus.
   */
  if (body.web === true && !qui) {
    return send(res, 401, {
      error: {
        message: t("La recherche sur le web du Chat demande une séance ouverte. Reconnectez-vous."),
      },
    });
  }

  /*
   * Un employé OpenClaw converse avec le modèle par cette même route, sans
   * séance : sa consommation est comptée à son nom. L'en-tête seul ne suffit
   * pas (n'importe quel poste pourrait l'écrire) : il faut aussi la clé que
   * seule l'instance OpenClaw lancée par la passerelle connaît.
   */
  const employe = req.headers["x-helix-employe"];
  const cle = req.headers["x-helix-cle"];
  const parEmploye =
    !qui && typeof employe === "string" && employes.cleValide(typeof cle === "string" ? cle : undefined, employe)
      ? auteurEmploye(employe)
      : undefined;

  /*
   * Un appel d'OpenCode pour une session de Helix Code : il joint la clé que la
   * passerelle lui a remise (`X-Helix-Relais`) et l'identifiant de sa session.
   * La session a une propriétaire (sessionsCode.ts) ; ses modèles branchés par
   * clé personnelle lui sont servis, comme dans le Chat. Avant le 27/09/2026,
   * OpenCode n'avait que le jeton d'instance, et un modèle de clé personnelle
   * choisi dans Code était refusé à sa propre titulaire.
   */
  const relais = req.headers["x-helix-relais"];
  let titulaireCode: string | undefined;
  if (!qui && !parEmploye && cleRelaisValide(Array.isArray(relais) ? relais[0] : relais)) {
    for (const nom of ["x-session-id", "x-session-affinity", "x-parent-session-id"]) {
      const valeur = req.headers[nom];
      const id = Array.isArray(valeur) ? valeur[0] : valeur;
      if (!id || !SESSION_CODE.test(id)) continue;
      titulaireCode = (await sessionCode(id).catch(() => undefined))?.userId;
      if (titulaireCode) break;
    }
  }

  const fiche = parEmploye && typeof employe === "string" ? await employes.employe(employe) : undefined;
  /*
   * Le modèle d'un employé est celui que Helix a enregistré pour lui
   * (27/09/2026, demandé par Medhi : « pas tous le même »), et non celui que
   * la requête nomme. La configuration d'OpenClaw le nomme déjà (un
   * fournisseur par employé, employes.ts) ; la passerelle le tient en plus,
   * pour deux raisons : un changement de modèle vaut dès l'appel suivant,
   * même si l'instance OpenClaw n'a pas encore relu sa configuration ; et un
   * employé ne répond jamais avec un autre modèle que le sien. Si le sien a
   * disparu, le refus le dit, et aucun autre ne répond à sa place.
   */
  if (fiche) {
    body.model = fiche.modele;
    const essai = await resolve({ model: fiche.modele, acces: fiche.ownerId });
    if ("error" in essai) {
      const etat = employes.etatDuModele(fiche, await discover().catch(() => ({ backends: [], models: [] })));
      /*
       * 404 « model_not_found », comme OpenAI, quand le modèle a disparu :
       * vu le 27/09/2026 avec OpenClaw 2026.9.4, un 503 est pris pour une
       * panne passagère et réessayé huit fois (plus de deux minutes) avant
       * que l'employé ne réponde. Seul un service qui ne répond pas reste en
       * 503 : il peut revenir, et l'attente a un sens.
       */
      const passager = etat.disponible || etat.raison === "hors-ligne";
      return send(res, passager ? 503 : 404, {
        error: {
          message: etat.disponible ? essai.error : employes.messageModeleIndisponible(fiche, etat),
          ...(passager ? {} : { type: "invalid_request_error", code: "model_not_found" }),
        },
      });
    }
  }

  // Un employé a accès aux modèles branchés par la clé personnelle de son propriétaire.
  const titulaire = qui?.userId ?? fiche?.ownerId ?? titulaireCode;

  // Le journal doit pouvoir dire au nom de qui l'agent a touché ces fichiers.
  await handleChatRequest(
    body,
    res,
    req,
    qui?.userId ?? parEmploye,
    titulaire,
    {
      ...(idCle ? { parCleApi: true, nonFlux: body.stream !== true } : {}),
      // Le titre n'est lu que d'un appel de tâche authentifié par sa clé : ailleurs, l'en-tête ne vaut rien.
      ...(parTache ? { tache: titreDeTache(req) } : {}),
    },
  );
  if (idCle && qui) {
    // Au journal de la titulaire : la route, le modèle demandé, l'issue. Jamais les messages ni la réponse.
    journaliser("api.appel", qui.userId, {
      cle: idCle,
      route: "/v1/chat/completions",
      modele: typeof body.model === "string" ? body.model.slice(0, 120) : null,
      flux: body.stream === true,
      bases: Array.isArray(body.connaissances) ? body.connaissances.length : 0,
      statut: res.statusCode,
    });
  }
}

/* --------------------------- routes provisionnement --------------------------- */

async function handleProvisionStatus(res: http.ServerResponse): Promise<void> {
  const hardware = detectHardware();
  // Le suivi doit répondre même pendant un long réveil du moteur (Windows, 02/11/2026).
  const { models: available } = await discover({ attendreLmStudio: false });
  const chatModels = available.filter((m) => m.roles.includes("chat"));
  /*
   * « Déjà là » se juge sur le nom sans le préfixe d'éditeur : LM Studio range
   * Qwen3-VL 4B sous « qwen/qwen3-vl-4b », le catalogue l'appelle « qwen3-vl-4b ».
   */
  const nomSansEditeur = (id: string) => id.toLowerCase().split("/").pop() ?? id;
  const presents = new Set(available.map((m) => nomSansEditeur(m.id)));
  /*
   * LM Studio coupé par le profil (28/09/2026) : pas de `lms` à chercher. Cet
   * écran lançait `lms version` sur la machine à chaque ouverture, comme la
   * découverte avant le 27/09 (backends.ts). Rien à installer d'ici : l'écran
   * de mise en route le dit comme pour un poste piloté par l'intégrateur.
   */
  const lmStudioActif = backendById("lmstudio")?.enabled === true;
  // Mac Intel : le moteur ouvert, llama.cpp (llamaCpp.ts, 28/09/2026), à la place de LM Studio.
  const ouvert = moteurOuvert();
  const moteurInstalle = ouvert
    ? llamaCppInstalle()
    : lmStudioActif && ((await appInstallee()) !== null || (await findLms()) !== null) && !moteurAPoser() && !llmsterPoseAilleurs();
  /*
   * L'application LM Studio de la personne est là mais fermée, et Helix ne la
   * démarre pas sans son accord (23/10/2026, engine.ts) : l'écran de mise en
   * route demande, une fois, plutôt que de proposer un modèle à installer.
   */
  const lmStudioFerme = !ouvert && lmStudioActif && autoProvisionEnabled() && (await applicationEnAttenteDeChoix());
  /*
   * L'échec d'installation du moteur ne vaut plus une fois le moteur là
   * (tournée à l'écran du 28/09/2026) : LM Studio posé à la main depuis
   * lmstudio.ai, comme l'encadré d'erreur le propose, puis « Vérifier à
   * nouveau ». L'écran passait au choix du modèle en affichant toujours
   * « L'installation du moteur a échoué » sous le modèle recommandé.
   */
  if (moteurInstalle && echecDuMoteur && getProvisionState() === echecDuMoteur) {
    echecDuMoteur = null;
    setProvisionState({ phase: "idle", message: "", error: undefined, percent: undefined, model: undefined });
  }
  send(res, 200, {
    hardware,
    recommended: conseilPourLaMachine(hardware),
    // Ce que la personne peut choisir à la place du conseillé : seulement ce qui tient sur la machine (provision.ts).
    possibles: modelesQuiTiennent(hardware),
    catalog: ouvert ? catalogueOuvert() : CATALOG,
    // Le moteur que l'écran de mise en route présente : LM Studio (conditions à accepter) ou llama.cpp (MIT, rien à accepter).
    moteur: ouvert ? "llamacpp" : "lmstudio",
    hasChatModel: chatModels.length > 0,
    /*
     * Helix a besoin d'un moteur pour faire tourner les modèles. Sans lui, il
     * n'y a rien à télécharger ni à charger : l'écran de mise en route doit le
     * dire et guider, au lieu de proposer une installation qui échouera.
     */
    /*
     * Moteur posé dans `~/.lmstudio` alors qu'un autre emplacement a été
     * choisi (28/09/2026) : `lms` suivrait le pointeur et n'y trouverait rien.
     * Compté comme absent : l'écran repropose l'installation, qui dit alors
     * le problème avant de rien télécharger (engine.ts).
     */
    moteurInstalle,
    lmStudioFerme,
    // Installation pilotée par l'intégrateur : l'écran de mise en route ne
    // propose rien, les modèles sont ceux du profil client.
    managed: !autoProvisionEnabled() || (!lmStudioActif && !ouvert),
    client: deployment().client ?? null,
    state: getProvisionState(),
    // Ce qu'on peut encore ajouter, adapté à la machine : la courte liste du sélecteur.
    installables: adaptesALaMachine(hardware).filter((e) => !presents.has(nomSansEditeur(e.key))),
    /*
     * Tout le catalogue, pour la page « Modèles » (28/09/2026) : installé ou
     * non, et, pour ceux qui ne tiennent pas, la raison chiffrée. La page ne
     * propose d'installer que ceux qui tiennent ; `/helix/provision/start`
     * refuse les autres (`refusTropLourd`).
     */
    modeles: catalogueComplet(hardware).map((e) => ({ ...e, installe: presents.has(nomSansEditeur(e.key)) })),
  });
}

/**
 * Installe le moteur d'exécution des modèles, sans intervention.
 * La progression suit le même flux que le téléchargement des modèles, pour que
 * l'écran de mise en route n'ait qu'une seule barre à afficher.
 */
/**
 * Conditions d'utilisation de LM Studio, que l'entreprise accepte en
 * l'installant. LM Studio est un logiciel fermé d'Element Labs, Inc. : ses
 * conditions (version du 23/08/2026) le réservent à un usage « personnel et / ou
 * interne à l'entreprise » et interdisent l'usage « as an application service
 * provider, or a software-as-a-service ». Helix l'installait sans le nommer ;
 * c'est désormais l'entreprise, qui en est le licencié, qui dit oui.
 */
const CONDITIONS_MOTEUR = {
  editeur: "Element Labs, Inc.",
  adresse: "https://lmstudio.ai/app-terms",
  version: "2026-08-23",
};

/** Une installation du moteur à la fois (revue de sécurité du 27/09/2026). */
let moteurEnInstallation = false;
/** L'état publié par le dernier échec d'installation du moteur, tant qu'il est l'état courant (handleProvisionStatus). */
let echecDuMoteur: ReturnType<typeof getProvisionState> | null = null;

/** Relance seulement le moteur déjà installé : aucun téléchargement, aucune suppression de modèles. */
async function handleEngineRestart(req: http.IncomingMessage, res: http.ServerResponse, url: URL): Promise<void> {
  const qui = await demandeur(req, url);
  if (!qui) return send(res, 401, sansSeance());
  if (!(await estAdministrateur(qui.userId))) return send(res, 403, { error: { message: t("Seul l'administrateur de l'instance installe le moteur des modèles.") } });
  if (!autoProvisionEnabled()) return send(res, 403, { error: { message: t("Sur ce poste, les modèles sont préparés par l'intégrateur.") } });
  if (moteurEnInstallation) return send(res, 409, { error: { message: t("Le moteur est déjà en cours d'installation.") } });
  if (moteurOuvert() || backendById("lmstudio")?.enabled !== true || !(await appInstallee()) || moteurAPoser() || llmsterPoseAilleurs()) {
    return send(res, 409, { error: { message: t("Installez d'abord le moteur des modèles.") } });
  }
  moteurEnInstallation = true;
  echecDuMoteur = null;
  oublierLms();
  setProvisionState({ phase: "checking", message: t("Démarrage du moteur..."), error: undefined, model: undefined, percent: undefined });
  void ensureLmStudioServer().then(pret => {
    invalidate();
    setProvisionState(pret
      ? { phase: "ready", message: t("Moteur installé et démarré."), error: undefined }
      : { phase: "error", code: "moteur_demarrage", message: t("Le moteur est installé, mais il n'a pas démarré."), error: conseilDemarrageLmStudio() });
  }).catch(err => {
    console.error("[helix] relance du moteur :", err);
    setProvisionState({ phase: "error", code: "moteur_demarrage", message: t("Le moteur est installé, mais il n'a pas démarré."), error: conseilDemarrageLmStudio() });
  }).finally(() => { moteurEnInstallation = false; });
  send(res, 202, { started: true, state: getProvisionState() });
}

async function handleEngineInstall(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  url: URL,
): Promise<void> {
  const qui = await demandeur(req, url);
  if (!qui) return send(res, 401, sansSeance());
  // Installer un logiciel sur la machine de l'instance, et en accepter les conditions pour l'entreprise : l'administrateur.
  if (!(await estAdministrateur(qui.userId))) {
    return send(res, 403, { error: { message: t("Seul l'administrateur de l'instance installe le moteur des modèles.") } });
  }
  if (moteurEnInstallation) return send(res, 409, { error: { message: t("Le moteur est déjà en cours d'installation.") } });
  // Déploiement piloté par l'intégrateur : les modèles sont ceux du profil client, l'écran ne propose rien (revue du 27/09/2026).
  if (!autoProvisionEnabled()) return send(res, 403, { error: { message: t("Sur ce poste, les modèles sont préparés par l'intégrateur.") } });
  const body = (await readJson(req).catch(() => ({}))) as { conditionsAcceptees?: unknown; model?: unknown; sansModele?: unknown };
  /*
   * Le moteur sans fenêtre posé depuis les réglages, à côté de l'application
   * LM Studio (23/10/2026) : la personne a déjà ses modèles, on n'enchaîne pas
   * sur un téléchargement.
   */
  const sansModele = body.sansModele === true;
  /*
   * Le modèle qui suit le moteur (28/09/2026) : le conseillé par défaut, ou
   * un autre, pourvu qu'il tienne sur la machine (les mêmes que l'écran de
   * mise en route propose, `modelesQuiTiennent`). Sans lui, « installer le
   * moteur » enchaînait toujours sur le conseillé, et une demande de modèle
   * faite pendant l'installation se greffait sur celle-ci
   * (`ensureLocalModel` n'en fait qu'une à la fois) : c'est ce qu'a montré
   * l'essai Windows de bout en bout (scripts/essai-windows-ci.mjs), qui veut
   * le plus léger. Vérifié avant rien installer ni journaliser.
   */
  let modeleChoisi: string | undefined;
  if (body.model !== undefined) {
    if (typeof body.model !== "string" || !modelesQuiTiennent(detectHardware()).some((m) => m.key === body.model)) {
      return send(res, 400, { error: { message: t("Ce modèle n'est pas proposé pour cette machine."), code: "modele_non_propose" } });
    }
    modeleChoisi = body.model;
  }
  if (moteurOuvert()) return installerMoteurOuvert(qui.userId, res, modeleChoisi);
  // Même règle que partout : seul un `true` explicite vaut accord.
  if (body.conditionsAcceptees !== true) {
    return send(res, 400, {
      error: {
        message: t("Installation non confirmée : les conditions d'utilisation de LM Studio doivent être acceptées."),
        conditions: CONDITIONS_MOTEUR,
      },
    });
  }
  journaliser("moteur.conditions_acceptees", qui.userId, CONDITIONS_MOTEUR);

  moteurEnInstallation = true;
  void installerMoteur((p) =>
    setProvisionState({
      /*
       * Moteur posé : pas encore « prêt » pour l'écran, la suite (démarrage,
       * modèle) enchaîne. « ready » fermait le suivi de l'écran, qui restait
       * figé pendant le téléchargement du modèle (MacBook, 27/09/2026).
       */
      phase: p.phase === "pret" ? "checking" : p.phase === "erreur" ? "error" : "downloading",
      message: p.message,
      // Moteur posé : la barre pleine ne doit pas rester pendant le démarrage (revue du 27/09/2026).
      percent: p.phase === "pret" ? undefined : p.percent,
    }),
  )
    .then(async () => {
      /*
       * Au démarrage, `findLms` avait mémorisé « absent » : sans cet oubli, la
       * suite croirait que le moteur n'est pas là, juste après l'avoir posé.
       */
      oublierLms();

      // Puis on l'allume : `lms load` a besoin du service, pas seulement du binaire.
      setProvisionState({ phase: "checking", message: t("Démarrage du moteur..."), percent: undefined });
      await ensureLmStudioServer();
      invalidate();
      /*
       * Un moteur posé qui ne démarre pas se dit tel quel : la suite l'aurait
       * présenté comme « le téléchargement de … a échoué », avec le texte brut
       * de `lms` (revue du 27/09/2026). Quelques secondes de grâce : il peut
       * mettre un instant à écouter.
       */
      let ecoute = await lmStudioRepond();
      for (let i = 0; i < 10 && !ecoute; i++) {
        await new Promise((r) => setTimeout(r, 2000));
        ecoute = await lmStudioRepond();
      }
      if (!ecoute) {
        setProvisionState({
          phase: "error",
          code: "moteur_demarrage",
          message: t("Le moteur est installé, mais il n'a pas démarré."),
          error: conseilDemarrageLmStudio(),
          percent: undefined,
        });
        return;
      }
      if (sansModele) {
        setProvisionState({ phase: "ready", message: t("Moteur installé et démarré."), percent: undefined, model: undefined });
        return;
      }

      /*
       * On enchaîne sur le modèle sans rendre la main : du point de vue de
       * l'utilisateur, « installer Helix » est une seule opération, pas deux
       * étapes techniques dont il devrait comprendre l'ordre.
       */
      setProvisionState({ phase: "checking", message: t("Choix du modèle adapté à votre machine..."), percent: undefined });
      apresMiseEnRoute(await ensureLocalModel(modeleChoisi));
    })
    .catch((err: unknown) => {
      setProvisionState({
        phase: "error",
        message: t("L'installation du moteur a échoué."),
        error: err instanceof Error ? err.message : String(err),
      });
      echecDuMoteur = getProvisionState();
    })
    .finally(() => {
      moteurEnInstallation = false;
    });

  send(res, 202, { started: true, state: getProvisionState() });
}

/**
 * Mac Intel : llama.cpp, logiciel libre (MIT), sans conditions à accepter
 * pour s'en servir. Puis, comme pour LM Studio, le modèle adapté à la machine
 * dans la foulée : « installer Helix » reste une seule opération.
 */
function installerMoteurOuvert(userId: string, res: http.ServerResponse, modeleChoisi?: string): void {
  journaliser("moteur.llamacpp_installation", userId, {});
  moteurEnInstallation = true;
  void installerLlamaCpp((a) => setProvisionState({ phase: "downloading", message: a.message, percent: a.percent }))
    .then(async () => {
      invalidate();
      setProvisionState({ phase: "checking", message: t("Choix du modèle adapté à votre machine..."), percent: undefined });
      apresMiseEnRoute(await ensureLocalModel(modeleChoisi));
    })
    .catch((err: unknown) => {
      setProvisionState({
        phase: "error",
        message: t("L'installation du moteur a échoué."),
        error: err instanceof Error ? err.message : String(err),
      });
      echecDuMoteur = getProvisionState();
    })
    .finally(() => {
      moteurEnInstallation = false;
    });
  send(res, 202, { started: true, state: getProvisionState() });
}

/* ------------------------- emplacement des modèles ------------------------- */

/**
 * Le moteur local dont l'emplacement se règle d'ici : aucun sur un poste
 * piloté par l'intégrateur (ses modèles sont ceux du profil), ni quand LM
 * Studio est coupé sans moteur ouvert.
 */
function moteurDeLEmplacement(): MoteurLocal | null {
  if (!autoProvisionEnabled()) return null;
  return moteurLocal(backendById("lmstudio")?.enabled === true, moteurOuvert());
}

/**
 * Où iront (ou sont) le moteur et les modèles, la place libre sur ce disque et
 * la place nécessaire (moteur s'il manque, modèle conseillé, 1 Go de marge).
 * Une séance suffit à lire : l'écran de mise en route et les réglages le
 * montrent à chacun ; seul l'administrateur change (route suivante).
 */
async function handleEmplacementEtat(req: http.IncomingMessage, res: http.ServerResponse, url: URL): Promise<void> {
  const qui = await demandeur(req, url);
  if (!qui) return send(res, 401, sansSeance());
  const moteur = moteurDeLEmplacement();
  const etat = etatEmplacement(moteur);
  const conseil = conseilPourLaMachine(detectHardware());
  const moteurPose = moteur === "llamacpp" ? llamaCppInstalle() : lmStudioEnPlace() !== null;
  send(res, 200, {
    ...etat,
    necessaire: placeNecessaire(moteur, moteurPose, conseil.downloadGb),
    modele: { label: conseil.label, downloadGb: conseil.downloadGb },
    moteurPose,
    admin: await estAdministrateur(qui.userId),
  });
}

/**
 * Choisir l'emplacement (`{ dossier }`, ou `{ dossier: null }` pour
 * l'emplacement habituel). L'administrateur seul, au journal : c'est le
 * dossier d'où la passerelle lancera `lms` (emplacementModeles.ts).
 */
async function handleEmplacementChoix(req: http.IncomingMessage, res: http.ServerResponse, url: URL): Promise<void> {
  const qui = await demandeur(req, url);
  if (!qui) return send(res, 401, sansSeance());
  if (await reserveeALAdministration(res, qui, t("Seul l'administrateur de l'instance choisit où vont le moteur et les modèles."))) return;
  const body = (await readJson(req).catch(() => ({}))) as { dossier?: unknown };
  if (!("dossier" in body)) return send(res, 400, { error: { message: t("Indiquez un dossier.") } });
  const issue = choisirEmplacement(moteurDeLEmplacement(), body.dossier, moteurEnInstallation || miseEnRouteEnCours());
  if (issue.journal) {
    journaliser("moteur.emplacement", qui.userId, issue.journal);
    // Le `lms` mémorisé peut être celui de l'ancien dossier.
    oublierLms();
    invalidate();
  }
  send(res, issue.statut, issue.corps);
}

/** Juger un dossier sans rien créer ni changer (la place libre avant un déplacement). L'administrateur seul : c'est un regard sur les disques de la machine. */
async function handleEmplacementVerifier(req: http.IncomingMessage, res: http.ServerResponse, url: URL): Promise<void> {
  const qui = await demandeur(req, url);
  if (!qui) return send(res, 401, sansSeance());
  if (await reserveeALAdministration(res, qui, t("Seul l'administrateur de l'instance choisit où vont le moteur et les modèles."))) return;
  const body = (await readJson(req).catch(() => ({}))) as { dossier?: unknown };
  const issue = verifierEmplacement(moteurDeLEmplacement(), body.dossier);
  send(res, issue.statut, issue.corps);
}

/* --------------- le moteur de LM Studio que Helix démarre (23/10/2026) --------------- */

/**
 * L'application LM Studio (ou Bionic) qui s'ouvrait toute seule (engine.ts) :
 * ce qui est déclaré sur la machine, le choix retenu, et si un service tourne.
 * Une séance suffit à lire ; seul l'administrateur choisit (route suivante).
 * Rien n'est proposé sur un Mac Intel (llama.cpp) ni quand LM Studio est coupé.
 */
async function handleMoteurLmStudioEtat(req: http.IncomingMessage, res: http.ServerResponse, url: URL): Promise<void> {
  const qui = await demandeur(req, url);
  if (!qui) return send(res, 401, sansSeance());
  const concerne = moteurDeLEmplacement() === "lmstudio";
  send(res, 200, { concerne, ...(concerne ? await etatChoixMoteur() : {}), admin: await estAdministrateur(qui.userId) });
}

/**
 * `{ choix: "application" | "sansFenetre" }`. « sansFenetre » ne fait que
 * retenir le choix : la pose du moteur passe ensuite par la route
 * d'installation, conditions de LM Studio acceptées (`/helix/provision/moteur`).
 */
async function handleMoteurLmStudioChoix(req: http.IncomingMessage, res: http.ServerResponse, url: URL): Promise<void> {
  const qui = await demandeur(req, url);
  if (!qui) return send(res, 401, sansSeance());
  if (await reserveeALAdministration(res, qui, t("Seul l'administrateur de l'instance choisit le moteur des modèles locaux."))) return;
  if (moteurDeLEmplacement() !== "lmstudio") return send(res, 409, { error: { message: t("Cette instance n'utilise pas LM Studio pour ses modèles locaux.") } });
  const body = (await readJson(req).catch(() => ({}))) as { choix?: unknown };
  if (body.choix !== "application" && body.choix !== "sansFenetre") return send(res, 400, { error: { message: t("Choix inconnu.") } });
  await definirChoixMoteur(body.choix, qui.userId);
  // Le `lms` mémorisé et la liste des modèles peuvent changer avec le moteur.
  oublierLms();
  invalidate();
  send(res, 200, await etatChoixMoteur());
}

/**
 * La dictée (Whisper) s'installe d'elle-même, juste après le modèle.
 *
 * Demandé par le client : installer Helix, c'est avoir le modèle adapté à la
 * machine ET le micro qui marche, sans aller chercher une installation de
 * plus au premier clic sur le micro. En arrière-plan et en silence : un échec
 * (Python absent, pas de réseau) ne bloque rien, le micro proposera alors
 * l'installation lui-même, avec la raison.
 */
function dicteeEnFond(): void {
  void diagnosticDictee()
    .then((etat) => {
      if (etat.installee || etat.installationEnCours || !etat.installable) return;
      console.log("[helix] Installation de la dictée en arrière-plan.");
      return preparerDictee(() => {}).then((bilan) =>
        console.log(`[helix] Dictée : ${bilan.ok ? "installée" : "non installée"}.`),
      );
    })
    .catch((err: unknown) => console.error("[helix] dictée en arrière-plan", err));
}

/**
 * OpenCode, le moteur de l'écran Code, s'installe de lui-même aussi : au
 * démarrage de la passerelle et après la mise en route du modèle (demandé par
 * Medhi le 27/09/2026, « tout s'installe seul »). Les cas où rien ne se fait
 * sont dans `opencodeEnFond` (opencode.ts). Le lancement est au journal, au
 * nom de l'instance : personne n'a cliqué.
 */
function codeEnFond(): void {
  void opencodeEnFond()
    .then((verdict) => {
      if (verdict === "lancee") journaliser("code.opencode_installe", "instance", { automatique: true });
    })
    .catch((err: unknown) => console.error("[helix] OpenCode en arrière-plan", err));
}

/**
 * Après la mise en route du modèle : la dictée et l'agent de code, en fond,
 * seulement si le modèle est prêt (tournée à l'écran du 28/09/2026).
 * `ensureLocalModel` rend l'état final sans rejeter : un téléchargement raté
 * (réseau coupé, disque plein) lançait quand même l'installation de la dictée,
 * Python et son modèle compris (850 Mo mesurés sur le poste d'essai), sur le
 * disque qui venait peut-être de manquer de place.
 */
function apresMiseEnRoute(etat: ReturnType<typeof getProvisionState>): void {
  invalidate();
  if (etat.phase !== "ready") return;
  dicteeEnFond();
  codeEnFond();
}

function handleProvisionStart(req: http.IncomingMessage, res: http.ServerResponse): void {
  readJson(req)
    .catch(() => ({}))
    .then((body) => {
      const { model, role } = body as { model?: string; role?: "chat" | "gui" };
      // Le catalogue d'écran est distinct : un modèle de conversation ne voit
      // pas les images, il ne peut donc pas remplacer un modèle de vision.
      const catalogue = role === "gui" ? VISION_CATALOG : CATALOG;
      // Trop lourd pour la machine : refusé avant de rien télécharger (28/09/2026, `refusTropLourd`).
      const refus = typeof model === "string" ? refusTropLourd(detectHardware(), model, role === "gui" ? "gui" : "chat") : null;
      if (refus) return send(res, 409, { error: { message: refus } });
      // Non bloquant : la progression se suit sur /helix/provision/stream.
      void ensureLocalModel(model, catalogue)
        .then((etat) => {
          if (role !== "gui") apresMiseEnRoute(etat);
          else invalidate();
        })
        /*
         * Sans ce filet, un provisionnement qui rejette devient un rejet non
         * capturé — et Node arrête alors le processus (vérifié : sortie en
         * code 1, serveur HTTP compris). Une installation qui échoue doit se
         * dire dans l'état de mise en route, pas emporter toute la passerelle
         * et, avec elle, le logiciel de l'utilisateur.
         */
        .catch((err: unknown) =>
          setProvisionState({
            phase: "error",
            message: t("L'installation du modèle a échoué."),
            error: err instanceof Error ? err.message : String(err),
          }),
        );
      send(res, 202, { started: true, state: getProvisionState() });
    })
    // Même raison : ce que fait le `then` ci-dessus ne doit pas non plus
    // pouvoir remonter jusqu'au processus.
    .catch((err: unknown) => {
      console.error("[gateway] provision/start", err);
      if (!res.headersSent) {
        send(res, 500, { error: { message: t("Le provisionnement n'a pas pu démarrer.") } });
      }
    });
}

/** Flux SSE de la progression d'installation. */
function handleProvisionStream(req: http.IncomingMessage, res: http.ServerResponse): void {
  res.writeHead(200, entetesFlux(req));
  const write = (s: unknown) => res.write(`data: ${JSON.stringify(s)}\n\n`);
  write(getProvisionState());
  const off = onProvisionChange(write);
  const keepAlive = setInterval(() => res.write(": ping\n\n"), 15000);
  req.on("close", () => {
    off();
    clearInterval(keepAlive);
    res.end();
  });
}

/* ---------------------------- routes atelier Cowork --------------------------- */

/**
 * Inventaire de l'atelier bureautique. Route de lecture seule : elle regarde
 * la machine, elle n'y touche pas.
 */
async function handleAtelierDiagnostic(res: http.ServerResponse): Promise<void> {
  send(res, 200, await atelierDiagnostic());
}

/**
 * Préparation de l'atelier, en flux d'événements.
 *
 * `/helix/provision/moteur` répond 202 et publie sa progression sur un flux
 * séparé, parce que plusieurs écrans suivent la même installation. Ici, une
 * seule fenêtre demande et une seule attend : la réponse elle-même porte le
 * flux, ce qui évite une route de plus et une corrélation à tenir.
 */
function handleAtelierPreparer(req: http.IncomingMessage, res: http.ServerResponse): void {
  res.writeHead(200, entetesFlux(req));

  /*
   * Si le navigateur se ferme, on cesse d'écrire mais on n'interrompt pas
   * l'installation : couper pip au milieu laisserait un environnement à
   * moitié posé, plus difficile à réparer qu'à refaire.
   */
  let ouvert = true;
  req.on("close", () => {
    ouvert = false;
  });
  const write = (event: unknown) => {
    if (ouvert) res.write(`data: ${JSON.stringify(event)}\n\n`);
  };

  void preparerAtelier((p) => write({ type: "progres", ...p }))
    .then((bilan) => write({ type: "bilan", bilan }))
    .catch((err: unknown) =>
      write({
        type: "erreur",
        message: err instanceof Error ? err.message : String(err),
      }),
    )
    .finally(() => {
      // L'atelier vient peut-être d'apparaître : les outils bureautiques se
      // fient à un cache, qui doit repartir d'une constatation fraîche.
      oublierAtelier();
      if (ouvert) res.end();
    })
    /*
     * `finally` laisse repasser un rejet. Sans ce dernier filet, une écriture
     * sur une réponse déjà fermée — la fenêtre se referme pendant que
     * l'installation écrit — deviendrait un rejet non capturé, donc l'arrêt du
     * processus Node (vérifié : sortie en code 1).
     */
    .catch((err: unknown) => console.error("[gateway] atelier/preparer", err));
}

/** Épreuves fonctionnelles : produire puis relire un document de chaque format. */
async function handleAtelierVerifier(res: http.ServerResponse): Promise<void> {
  send(res, 200, await verifierAtelier());
}

/* -------------------------------- routes dictée ------------------------------- */

/**
 * État de la dictée : installée ou non, et ce qu'il faudrait télécharger.
 * Lecture seule, comme `GET /helix/atelier` : le composeur la lit à l'ouverture
 * pour savoir si le bouton micro enregistre ou propose l'installation.
 */
async function handleDicteeEtat(res: http.ServerResponse): Promise<void> {
  send(res, 200, await diagnosticDictee());
}

/**
 * Installation de la dictée, en flux d'événements, sur le modèle de l'atelier.
 *
 * Le corps doit porter `{"accord": true}`, et rien d'autre ne vaut accord : un
 * appel égaré, ou un champ mal nommé, ne télécharge pas 500 Mo sur le poste de
 * quelqu'un. C'est le principe du bouton « refuser » corrigé : un contrôle qui
 * ne comprend pas ce qu'on lui demande refuse.
 */
async function handleDicteeInstaller(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  url: URL,
): Promise<void> {
  const qui = await demandeur(req, url);
  if (!qui) return send(res, 401, sansSeance());

  const body = (await readJson(req).catch(() => ({}))) as { accord?: unknown };
  if (body.accord !== true) {
    return send(res, 400, {
      error: { message: t("Installation non confirmée : `accord` doit valoir true.") },
    });
  }

  res.writeHead(200, entetesFlux(req));
  /*
   * `res` et non `req` : le corps de la requête a déjà été lu, et sa fin
   * déclenche la fermeture de `req` alors que la fenêtre écoute toujours.
   */
  let ouvert = true;
  res.on("close", () => {
    ouvert = false;
  });
  const write = (event: unknown) => {
    if (ouvert) res.write(`data: ${JSON.stringify(event)}\n\n`);
  };

  const debut = Date.now();
  void preparerDictee((p) => write({ type: "progres", ...p }))
    .then((bilan) => {
      journaliser("dictee.installee", qui.userId, { ok: bilan.ok, dureeMs: bilan.duree });
      write({ type: "bilan", bilan });
    })
    .catch((err: unknown) => {
      journaliser("dictee.installee", qui.userId, { ok: false, dureeMs: Date.now() - debut });
      write({ type: "erreur", message: err instanceof Error ? err.message : String(err) });
    })
    .finally(() => {
      if (ouvert) res.end();
    })
    // Même filet que pour l'atelier : une écriture tardive ne doit pas tuer le processus.
    .catch((err: unknown) => console.error("[gateway] dictee/installer", err));
}

/**
 * Transcription d'un enregistrement. Le corps est le son brut (WebM, Ogg, MP4,
 * WAV ou AIFF), borné en taille. Le texte revient à l'interface et n'est
 * consigné nulle part : le journal ne retient que la taille et la durée.
 */
async function handleDictee(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  url: URL,
): Promise<void> {
  const qui = await demandeur(req, url);
  if (!qui) return send(res, 401, sansSeance());

  let octets = 0;
  try {
    const son = await lireAudio(req);
    octets = son.length;
    const resultat = await transcrire(son, url.searchParams.get("langue") ?? "fr");
    journaliser("dictee.transcrite", qui.userId, {
      ok: true,
      octets,
      dureeAudio: resultat.dureeAudio,
      dureeMs: resultat.dureeMs,
    });
    send(res, 200, resultat);
  } catch (err) {
    const connue = err instanceof ErreurDictee;
    const statut = connue ? err.statut : 500;
    // Une erreur inattendue ne part pas au poste : son message est interne.
    if (!connue) console.error("[gateway] dictee", err);
    if (statut !== 413) journaliser("dictee.transcrite", qui.userId, { ok: false, octets, statut });
    send(res, statut, { error: { message: connue ? err.message : "La dictée a échoué." } });
    // Corps refusé en cours de lecture : on coupe plutôt que de le recevoir jusqu'au bout.
    if (statut === 413) res.once("finish", () => req.destroy());
  }
}

/* ---------------------------- routes courrier IMAP ---------------------------- */

/**
 * État du connecteur courrier, et de quoi remplir le formulaire.
 *
 * La table des fournisseurs voyage avec l'état plutôt que d'être recopiée dans
 * l'interface : les serveurs et les ports changent, et une valeur figée dans le
 * paquet du poste ne se corrige qu'en repackageant l'application. Ce que
 * l'instance sait est ce que le formulaire montre.
 *
 * Route de lecture : elle ne dit rien du mot de passe, qui ne sort jamais du
 * module (voir courrier.ts).
 */
/**
 * Les réglages qui valent pour toute l'instance, et donc pour les agents de
 * tous ses membres : la boîte mail commune, son serveur d'envoi, l'envoi sans
 * confirmation, le niveau d'approbation. Revue de sécurité du 26/09/2026 :
 * une séance suffisait. Un collègue pouvait ainsi diriger l'envoi vers son
 * propre serveur, qui recevait au passage le mot de passe de la boîte
 * (reproduit avec un faux serveur), ou passer les agents de tous en « Tout
 * approuver ». Sur une instance d'une seule personne, c'est elle
 * l'administratrice (roles.ts) : rien ne change pour elle.
 */
async function reserveeALAdministration(res: http.ServerResponse, qui: Demandeur, message: string): Promise<boolean> {
  if (await estAdministrateur(qui.userId)) return false;
  journaliser("reglage.refuse", qui.userId, {});
  send(res, 403, { error: { message } });
  return true;
}

/**
 * Google Drive, l'agenda (CalDAV ou Google) et Slack sont, comme la boîte
 * commune, un compte pour toute l'instance : ses agents les lisent pour tous
 * les membres, et l'agenda y écrit. Tournée des connecteurs du 28/09/2026 :
 * une séance suffisait pour les brancher, les remplacer ou les débrancher. Un
 * membre pouvait donc couper le Drive ou le Slack de l'organisation, ou
 * remplacer l'agenda de l'instance par un serveur à lui, qui recevait ensuite
 * les rendez-vous que les agents de tous y écrivaient (même règle que la boîte
 * commune, revue du 26/09/2026, et que les connexions natives du 28/09).
 * Lire l'état reste permis à toute séance.
 */
async function reserveeServiceCommun(res: http.ServerResponse, qui: Demandeur): Promise<boolean> {
  return reserveeALAdministration(res, qui, t("Seul l'administrateur de l'instance peut brancher, débrancher ou configurer ces services : ils agissent au nom de toute l'organisation."));
}

async function handleCourrierEtat(req: http.IncomingMessage, res: http.ServerResponse, url: URL): Promise<void> {
  const adresse = url.searchParams.get("adresse") ?? "";
  const base = adresseVue(req);
  const microsoft = await natifs.applicationMicrosoft().catch(() => null);
  send(res, 200, {
    ...(await courrierEtat()),
    fournisseurs: fournisseursConnus(),
    // Réglages devinés depuis le domaine, quand l'interface en demande.
    suggestion: adresse ? reglagesConnus(adresse) : null,
    /*
     * « Se connecter avec Google / Microsoft » (28/09/2026) : les applications
     * de l'instance qu'on peut reprendre (identifiants seulement, jamais de
     * secret), les adresses de retour à déclarer telles que la passerelle les
     * enverra, et l'issue du dernier retour par la boucle locale (Gmail).
     */
    oauth: {
      google: { ...etatClientGoogle(), boucle: base ? surLaBoucle(base) : true, ...(base ? { retour: retourADeclarer("google", base) } : {}) },
      microsoft: {
        disponible: Boolean(microsoft),
        ...(microsoft ? { identifiant: microsoft.clientId, annuaire: microsoft.annuaire, avecSecret: Boolean(microsoft.clientSecret) } : {}),
        ...(base ? { retour: retourADeclarer("microsoft", base) } : {}),
      },
      attente: boucleOuverte(),
      ...(issueCourrier() ? { issue: issueCourrier() } : {}),
    },
  });
}

/**
 * Enregistre un compte de courrier.
 *
 * Le module refuse tout seul d'écrire quoi que ce soit tant que la connexion
 * n'a pas été essayée pour de bon ; on se contente ici d'identifier qui demande
 * et de le consigner. Le corps contient un mot de passe : il n'est ni journalisé
 * ni renvoyé, et le journal ne retient que l'adresse de la boîte.
 */
/**
 * Lance l'autorisation « Se connecter avec Google / Microsoft ».
 *
 * L'instance ne va nulle part elle-même : elle rend l'adresse, et c'est
 * l'écran qui l'ouvre dans le navigateur de la personne. C'est chez son
 * fournisseur, et là seulement, qu'elle s'authentifie — Helix ne voit jamais
 * son mot de passe, ce qui est tout l'intérêt de la manoeuvre.
 */
async function handleCourrierOauth(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  url: URL,
): Promise<void> {
  const qui = await demandeur(req, url);
  if (!qui) return send(res, 401, sansSeance());
  if (await reserveeALAdministration(res, qui, t("Seul l'administrateur de l'instance peut changer la boîte mail commune et son envoi."))) return;

  const body = (await readJson(req).catch(() => ({}))) as {
    adresse?: unknown;
    reglage?: unknown;
  };
  const adresse = typeof body.adresse === "string" ? body.adresse.trim() : "";
  if (!adresse.includes("@")) {
    return send(res, 400, {
      error: { message: t("Indiquez l'adresse de la boîte, par exemple vous@entreprise.fr.") },
    });
  }
  /*
   * « application: instance » (28/09/2026) : reprendre l'application déjà
   * enregistrée sur l'instance, celle de Drive et d'Agenda chez Google, celle
   * de Microsoft 365 chez Microsoft, plutôt que d'en créer une de plus. Ses
   * identifiants sont lus ici, jamais envoyés par l'écran : le secret ne
   * quitte pas la passerelle.
   */
  const demande = (body.reglage ?? {}) as Record<string, unknown>;
  let reglage: unknown = demande;
  const instanceGoogle = demande.application === "instance" && demande.fournisseur === "google";
  if (instanceGoogle) {
    const g = clientGoogle();
    if (!g.ok) return send(res, 400, { error: { message: t("Aucune application Google n'est enregistrée sur cette instance : renseignez-la d'abord, avec les étapes affichées.") } });
    reglage = { fournisseur: "google", clientId: g.clientId, ...(g.clientSecret ? { clientSecret: g.clientSecret } : {}) };
  } else if (demande.application === "instance" && demande.fournisseur === "microsoft") {
    const m = await natifs.applicationMicrosoft();
    if (!m) return send(res, 400, { error: { message: t("Aucune application Microsoft 365 n'est enregistrée sur cette instance : renseignez-la d'abord, avec les étapes affichées.") } });
    reglage = { fournisseur: "microsoft", clientId: m.clientId, ...(m.clientSecret ? { clientSecret: m.clientSecret } : {}), ...(m.annuaire ? { tenant: m.annuaire } : {}) };
  }
  const verdict = validerOauthCourrier(reglage);
  if (!verdict.ok) return send(res, 400, { error: { message: verdict.message } });

  /*
   * L'adresse de retour est celle par laquelle **ce navigateur** atteint
   * l'instance : il revient là d'où il est parti. Elle doit être inscrite à
   * l'identique dans l'application déclarée par l'administrateur, sinon le
   * fournisseur refuse — et l'écran le dit, plutôt que de laisser chercher.
   * Gmail par l'application de l'instance (une « Application de bureau ») :
   * rien à déclarer, le retour se fait par la boucle locale, comme pour
   * Agenda (courrierOauth.ts, `ouvrirBoucle`).
   */
  const base = adresseVue(req);
  if (!base) {
    return send(res, 400, {
      error: { message: t("L'adresse de cette instance n'a pas pu être déterminée.") },
    });
  }
  let redirection = retourEnvoye(verdict.reglage.fournisseur, base);
  if (instanceGoogle) {
    const b = await ouvrirBoucleCourrier(retourCourrierParLaBoucle);
    if (!b.ok) return send(res, 400, { error: { message: b.message } });
    redirection = b.redirection;
  }
  const { url: destination } = demarrerCourrier(verdict.reglage, adresse, redirection);
  journaliser("donnees.ecrites", qui.userId, {
    collection: "courrier.oauth",
    fournisseur: verdict.reglage.fournisseur,
  });
  send(res, 200, { url: destination, redirection, ...(instanceGoogle ? { boucle: true } : {}) });
}

/** Le retour de Google par la boucle locale (Gmail, 28/09/2026) : les mêmes étapes que la route publique. */
async function retourCourrierParLaBoucle(parametres: URLSearchParams): Promise<{ ok: boolean; message: string; ignore?: boolean }> {
  const etat = parametres.get("state") ?? "";
  const erreur = parametres.get("error");
  if (erreur) {
    const refus = refuserCourrier(etat, erreur);
    return refus ? { ok: false, message: refus } : { ok: false, message: t("Cette réponse ne correspond à aucune demande de connexion en cours : elle est ignorée."), ignore: true };
  }
  const code = parametres.get("code") ?? "";
  if (!code || !courrierEnAttente(etat)) return { ok: false, message: t("Cette réponse ne correspond à aucune demande de connexion en cours : elle est ignorée."), ignore: true };
  const r = await acheverCourrier(code, etat);
  if (!r.ok) return { ok: false, message: r.message };
  const branchement = await brancherParOauth(r.jetons, r.adresse);
  return { ok: branchement.ok, message: branchement.message };
}

/** L'instance est sur une autre machine : l'adresse de retour de Google, collée à l'écran (courrierOauth.ts). */
async function handleCourrierOauthColler(req: http.IncomingMessage, res: http.ServerResponse, url: URL): Promise<void> {
  const qui = await demandeur(req, url);
  if (!qui) return send(res, 401, sansSeance());
  if (await reserveeALAdministration(res, qui, t("Seul l'administrateur de l'instance peut changer la boîte mail commune et son envoi."))) return;
  const body = (await readJson(req).catch(() => ({}))) as { adresse?: unknown };
  const r = await collerRetourCourrier(body.adresse);
  send(res, r.ok ? 200 : 400, r);
}

async function handleCourrierConfigurer(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  url: URL,
): Promise<void> {
  const qui = await demandeur(req, url);
  if (!qui) return send(res, 401, sansSeance());
  if (await reserveeALAdministration(res, qui, t("Seul l'administrateur de l'instance peut changer la boîte mail commune et son envoi."))) return;

  const body = await readJson(req).catch(() => ({}));
  const resultat = await configurerCourrier(body);
  if (resultat.ok) {
    journaliser("donnees.ecrites", qui.userId, {
      collection: "courrier.compte",
      adresse: (body as { adresse?: string }).adresse,
    });
  }
  send(res, resultat.ok ? 200 : 400, resultat);
}

/**
 * Active ou coupe l'envoi de mails par les agents. Ouvrir l'envoi engage
 * l'entreprise : séance exigée, et le journal nomme qui l'a fait.
 */
async function handleCourrierEnvoi(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  url: URL,
): Promise<void> {
  const qui = await demandeur(req, url);
  if (!qui) return send(res, 401, sansSeance());
  if (await reserveeALAdministration(res, qui, t("Seul l'administrateur de l'instance peut changer la boîte mail commune et son envoi."))) return;

  const body = await readJson(req).catch(() => ({}));
  const resultat = await reglerEnvoiCourrier(body);
  if (resultat.ok) {
    journaliser("donnees.ecrites", qui.userId, { collection: "courrier.envoi", active: resultat.active });
  }
  send(res, resultat.ok ? 200 : 400, { ...resultat, etat: await courrierEtat() });
}

/** Envoyer sans confirmation, ou revenir à une carte par mail. Séance exigée, journalisé. */
async function handleCourrierConfirmation(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  url: URL,
): Promise<void> {
  const qui = await demandeur(req, url);
  if (!qui) return send(res, 401, sansSeance());
  if (await reserveeALAdministration(res, qui, t("Seul l'administrateur de l'instance peut changer la boîte mail commune et son envoi."))) return;
  const body = await readJson(req).catch(() => ({}));
  const resultat = await reglerConfirmationCourrier(body);
  if (resultat.ok) {
    journaliser("donnees.ecrites", qui.userId, { collection: "courrier.confirmation", sansAccord: resultat.sansAccord });
  }
  send(res, resultat.ok ? 200 : 400, { ...resultat, etat: await courrierEtat() });
}

/** Retire le compte de l'instance. Les outils disparaissent de la conversation suivante. */
async function handleCourrierOublier(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  url: URL,
): Promise<void> {
  const qui = await demandeur(req, url);
  if (!qui) return send(res, 401, sansSeance());
  if (await reserveeALAdministration(res, qui, t("Seul l'administrateur de l'instance peut changer la boîte mail commune et son envoi."))) return;

  const resultat = await oublierCourrier();
  journaliser("donnees.ecrites", qui.userId, { collection: "courrier.compte", adresse: null });
  send(res, 200, { ...resultat, etat: await courrierEtat() });
}

/* ---------------------------- routes agenda CalDAV ---------------------------- */

/**
 * État du connecteur agenda, et de quoi remplir le formulaire.
 *
 * Comme pour le courrier, la table des serveurs voyage avec l'état plutôt que
 * d'être recopiée dans l'interface : les adresses CalDAV changent, et une valeur
 * figée dans le paquet du poste ne se corrigerait qu'en repackageant
 * l'application. Ce que l'instance sait est ce que le formulaire montre.
 *
 * Route de lecture : elle ne dit rien du mot de passe, qui ne sort jamais du
 * module (voir agenda.ts).
 */
async function handleAgendaEtat(res: http.ServerResponse, url: URL): Promise<void> {
  const adresse = url.searchParams.get("adresse") ?? "";
  send(res, 200, {
    ...(await agendaEtat()),
    serveurs: serveursConnus(),
    // Réglages devinés depuis le domaine, quand l'interface en demande.
    suggestion: adresse ? reglagesAgendaConnus(adresse) : null,
  });
}

/**
 * Enregistre un agenda.
 *
 * Le module refuse tout seul d'écrire quoi que ce soit tant que la connexion
 * n'a pas été essayée pour de bon ; on se contente ici d'identifier qui demande
 * et de le consigner. Le corps contient un mot de passe : il n'est ni journalisé
 * ni renvoyé, et le journal ne retient rien d'autre que le fait de l'écriture.
 * Aucun titre de réunion ne transite par cette route.
 */
async function handleAgendaConfigurer(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  url: URL,
): Promise<void> {
  const qui = await demandeur(req, url);
  if (!qui) return send(res, 401, sansSeance());
  if (await reserveeServiceCommun(res, qui)) return;

  const body = await readJson(req).catch(() => ({}));
  const resultat = await configurerAgenda(body);
  if (resultat.ok) {
    journaliser("donnees.ecrites", qui.userId, { collection: "agenda.compte" });
  }
  send(res, resultat.ok ? 200 : 400, resultat);
}

/** Retire l'agenda de l'instance. Les outils disparaissent de la conversation suivante. */
async function handleAgendaOublier(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  url: URL,
): Promise<void> {
  const qui = await demandeur(req, url);
  if (!qui) return send(res, 401, sansSeance());
  if (await reserveeServiceCommun(res, qui)) return;

  const resultat = await oublierAgenda();
  journaliser("donnees.ecrites", qui.userId, { collection: "agenda.compte" });
  send(res, 200, { ...resultat, etat: await agendaEtat() });
}

/* ------------------------ routes Google Drive et Slack ------------------------ */

/*
 * Les modules tiennent eux-mêmes le journal (drive.ts, slack.ts) : l'accord
 * Google arrive par la boucle locale, hors de toute requête, et c'est le
 * module qui sait qui l'avait demandé. Ici, on n'identifie que le demandeur.
 * Les routes d'état, au jeton seul, disent si un compte est branché et lequel,
 * jamais un jeton ni un contenu.
 */
/** Les tâches programmées de la personne : chacune ne voit et ne touche que les siennes. */
async function handleTachesProgrammees(req: http.IncomingMessage, res: http.ServerResponse, url: URL, path: string): Promise<void> {
  const qui = await demandeur(req, url);
  if (!qui) return send(res, 401, sansSeance());
  const [, , , id, action] = path.split("/");
  const corps = async () => (await readJson(req).catch(() => ({}))) as Record<string, unknown>;
  const repondre = <T,>(r: tachesProgrammees.Resultat<T>, cle: string) => (r.ok ? send(res, 200, { [cle]: r.valeur }) : send(res, r.statut, { error: { message: r.message } }));
  try {
    if (!id && req.method === "GET") return send(res, 200, { taches: await tachesProgrammees.lister(qui.userId) });
    // Les agents que la personne peut charger d'une tâche : nom et identifiant seulement, jamais leurs instructions.
    if (id === "agents" && !action && req.method === "GET") {
      const agents = await tachesProgrammees.agentsVisibles(qui.userId);
      return send(res, 200, { agents: agents.map((a) => ({ id: a.id, nom: a.nom })) });
    }
    if (!id && req.method === "POST") return repondre(await tachesProgrammees.creer(await corps(), qui.userId), "tache");
    if (id && !action && req.method === "POST") return repondre(await tachesProgrammees.modifier(id, await corps(), qui.userId), "tache");
    if (id && !action && req.method === "DELETE") return repondre(await tachesProgrammees.supprimer(id, qui.userId), "supprimee");
    if (id && action === "lancer" && req.method === "POST") return repondre(await tachesProgrammees.lancerMaintenant(id, qui.userId), "execution");
  } catch (err) {
    return send(res, 503, { error: { message: err instanceof Error ? err.message : String(err) } });
  }
  send(res, 404, { error: { message: t("Introuvable.") } });
}

/*
 * L'application Google de l'instance : son identifiant se voit (il n'est pas
 * secret), son secret jamais. La changer vaut pour toute l'instance : réservé
 * à l'administrateur, comme le journal complet (roles.ts).
 */
async function handleClientGoogleEtat(req: http.IncomingMessage, res: http.ServerResponse, url: URL): Promise<void> {
  const qui = await demandeur(req, url);
  if (!qui) return send(res, 401, sansSeance());
  send(res, 200, { ...etatClientGoogle(), modifiable: await estAdministrateur(qui.userId) });
}

async function handleClientGoogleEnregistrer(req: http.IncomingMessage, res: http.ServerResponse, url: URL): Promise<void> {
  const qui = await demandeur(req, url);
  if (!qui) return send(res, 401, sansSeance());
  if (!(await estAdministrateur(qui.userId))) return send(res, 403, { error: { message: t("Seul l'administrateur de l'instance peut enregistrer l'application Google.") } });
  const body = (await readJson(req).catch(() => ({}))) as { clientId?: unknown; clientSecret?: unknown };
  const r = await enregistrerClientGoogle(body.clientId, body.clientSecret, qui.userId);
  send(res, r.ok ? 200 : 400, { ...r, etat: etatClientGoogle() });
}

async function handleClientGoogleEffacer(req: http.IncomingMessage, res: http.ServerResponse, url: URL): Promise<void> {
  const qui = await demandeur(req, url);
  if (!qui) return send(res, 401, sansSeance());
  if (!(await estAdministrateur(qui.userId))) return send(res, 403, { error: { message: t("Seul l'administrateur de l'instance peut retirer l'application Google.") } });
  const r = await effacerClientGoogle(qui.userId);
  send(res, 200, { ...r, etat: etatClientGoogle() });
}

/*
 * Connexions natives (oauthNatif.ts, 28/09/2026). Lire l'état : une séance.
 * Tout le reste (enregistrer l'application d'un fournisseur, brancher ou
 * débrancher un compte) : l'administrateur. Un compte branché vaut pour toute
 * l'instance, et publie au nom de l'organisation ; c'est la règle de la boîte
 * mail commune (`reserveeALAdministration`). L'état ne contient ni jeton ni
 * secret, sous aucune forme.
 */
async function handleNatifs(req: http.IncomingMessage, res: http.ServerResponse, url: URL, suite: string): Promise<void> {
  const qui = await demandeur(req, url);
  if (!qui) return send(res, 401, sansSeance());
  const base = adresseVue(req) ?? "";
  const etatComplet = async () => ({ services: await natifs.etat(base), administrateur: await estAdministrateur(qui.userId) });
  if (req.method === "GET" && suite === "") return send(res, 200, await etatComplet());
  if (req.method !== "POST") return send(res, 404, { error: { message: t("Introuvable.") } });
  if (await reserveeALAdministration(res, qui, t("Seul l'administrateur de l'instance peut brancher, débrancher ou configurer ces services : ils agissent au nom de toute l'organisation."))) return;
  const body = (await readJson(req).catch(() => ({}))) as { service?: unknown; clientId?: unknown; clientSecret?: unknown; choix?: unknown; adresse?: unknown; annuaire?: unknown };
  let r: { ok: boolean; message: string; url?: string };
  try {
    switch (suite) {
      case "/application":
        // `annuaire` : Microsoft 365 seulement (l'annuaire Entra de l'application), ignoré par les autres services.
        r = await natifs.enregistrerApplication(body.service, body.clientId, body.clientSecret, qui.userId, body.annuaire);
        break;
      case "/application/effacer":
        r = await natifs.effacerApplication(body.service, qui.userId);
        break;
      case "/connecter":
        if (!base) return send(res, 400, { error: { message: t("Adresse d'instance illisible.") } });
        r = await natifs.demarrer(body.service, qui.userId, base, body.choix);
        break;
      case "/code":
        r = await natifs.collerAdresse(body.service, body.adresse, qui.userId);
        break;
      case "/oublier":
        r = await natifs.oublier(body.service, qui.userId);
        break;
      default:
        return send(res, 404, { error: { message: t("Introuvable.") } });
    }
  } catch (err) {
    r = { ok: false, message: natifs.messageUtilisateur(err) };
  }
  send(res, r.ok ? 200 : 400, { ...r, ...(await etatComplet()) });
}

/*
 * Messageries (natifs/messageries.ts, 28/09/2026) : Telegram, Discord,
 * WhatsApp. Même règle que les connexions natives : l'état pour toute séance,
 * sans aucun jeton ; brancher, ouvrir l'envoi, débrancher : l'administrateur.
 */
async function handleMessageries(req: http.IncomingMessage, res: http.ServerResponse, url: URL, suite: string): Promise<void> {
  const qui = await demandeur(req, url);
  if (!qui) return send(res, 401, sansSeance());
  const admin = await estAdministrateur(qui.userId);
  const etatComplet = async () => ({ services: await messageries.etat(adresseVue(req) ?? "", admin), administrateur: admin, chiffrement: messageries.chiffrementDisponible() });
  if (req.method === "GET" && suite === "") return send(res, 200, await etatComplet());
  if (req.method !== "POST") return send(res, 404, { error: { message: t("Introuvable.") } });
  if (await reserveeALAdministration(res, qui, t("Seul l'administrateur de l'instance peut brancher, régler ou débrancher une messagerie : elle parle au nom de toute l'organisation."))) return;
  const r = await messageries.traiterRoute(suite, (await readJson(req, 64 * 1024).catch(() => ({}))) as Record<string, unknown>, qui.userId);
  if (!r) return send(res, 404, { error: { message: t("Introuvable.") } });
  send(res, r.ok ? 200 : 400, { ...r, ...(await etatComplet()) });
}

/* Stripe, Shopify, WooCommerce, Salesforce, Pipedrive, Zendesk (natifs/commerce.ts, § 47) : mêmes droits que les connexions natives, décidés dans le module. */
async function handleCommerce(req: http.IncomingMessage, res: http.ServerResponse, url: URL, suite: string): Promise<void> {
  const qui = await demandeur(req, url);
  if (!qui) return send(res, 401, sansSeance());
  const corps = req.method === "POST" ? ((await readJson(req).catch(() => ({}))) as Record<string, unknown>) : {};
  const r = await commerce.route(req.method ?? "", suite, corps && typeof corps === "object" ? corps : {}, qui, adresseVue(req) ?? "");
  send(res, r.statut, r.corps);
}

async function handleAgendaGoogleEtat(req: http.IncomingMessage, res: http.ServerResponse, url: URL): Promise<void> {
  const qui = await demandeur(req, url);
  if (!qui) return send(res, 401, sansSeance());
  send(res, 200, { ...(await agendaGoogle.etat()), client: etatClientGoogle() });
}

async function handleAgendaGoogleConnecter(req: http.IncomingMessage, res: http.ServerResponse, url: URL): Promise<void> {
  const qui = await demandeur(req, url);
  if (!qui) return send(res, 401, sansSeance());
  if (await reserveeServiceCommun(res, qui)) return;
  const body = (await readJson(req).catch(() => ({}))) as { ecriture?: unknown };
  const r = await agendaGoogle.demarrer(qui.userId, body.ecriture === true);
  send(res, r.ok ? 200 : 400, r);
}

async function handleAgendaGoogleCode(req: http.IncomingMessage, res: http.ServerResponse, url: URL): Promise<void> {
  const qui = await demandeur(req, url);
  if (!qui) return send(res, 401, sansSeance());
  if (await reserveeServiceCommun(res, qui)) return;
  const body = (await readJson(req).catch(() => ({}))) as { adresse?: unknown };
  const r = await agendaGoogle.collerAdresse(body.adresse, qui.userId);
  send(res, r.ok ? 200 : 400, { ...r, etat: await agendaGoogle.etat() });
}

async function handleAgendaGoogleOublier(req: http.IncomingMessage, res: http.ServerResponse, url: URL): Promise<void> {
  const qui = await demandeur(req, url);
  if (!qui) return send(res, 401, sansSeance());
  if (await reserveeServiceCommun(res, qui)) return;
  const r = await agendaGoogle.oublier(qui.userId);
  send(res, 200, { ...r, etat: await agendaGoogle.etat() });
}

async function handleDriveEtat(res: http.ServerResponse): Promise<void> {
  send(res, 200, await drive.etat());
}

/** Lance l'autorisation Google. L'adresse rendue porte le `state` : séance exigée. */
async function handleDriveConnecter(req: http.IncomingMessage, res: http.ServerResponse, url: URL): Promise<void> {
  const qui = await demandeur(req, url);
  if (!qui) return send(res, 401, sansSeance());
  if (await reserveeServiceCommun(res, qui)) return;
  const resultat = await drive.demarrer(qui.userId);
  send(res, resultat.ok ? 200 : 400, resultat);
}

/** Adresse de retour recopiée depuis le navigateur, quand l'instance est sur une autre machine. */
async function handleDriveCode(req: http.IncomingMessage, res: http.ServerResponse, url: URL): Promise<void> {
  const qui = await demandeur(req, url);
  if (!qui) return send(res, 401, sansSeance());
  if (await reserveeServiceCommun(res, qui)) return;
  const body = (await readJson(req).catch(() => ({}))) as { adresse?: unknown };
  const resultat = await drive.collerAdresse(body.adresse, qui.userId);
  send(res, resultat.ok ? 200 : 400, { ...resultat, etat: await drive.etat() });
}

async function handleDriveOublier(req: http.IncomingMessage, res: http.ServerResponse, url: URL): Promise<void> {
  const qui = await demandeur(req, url);
  if (!qui) return send(res, 401, sansSeance());
  if (await reserveeServiceCommun(res, qui)) return;
  const resultat = await drive.oublier(qui.userId);
  send(res, 200, { ...resultat, etat: await drive.etat() });
}

async function handleSlackEtat(res: http.ServerResponse): Promise<void> {
  send(res, 200, await slack.etat());
}

/** Le corps porte le jeton : il n'est ni journalisé ni renvoyé. */
async function handleSlackConfigurer(req: http.IncomingMessage, res: http.ServerResponse, url: URL): Promise<void> {
  const qui = await demandeur(req, url);
  if (!qui) return send(res, 401, sansSeance());
  if (await reserveeServiceCommun(res, qui)) return;
  const body = await readJson(req).catch(() => ({}));
  const resultat = await slack.configurer(body, qui.userId);
  send(res, resultat.ok ? 200 : 400, resultat);
}

async function handleSlackOublier(req: http.IncomingMessage, res: http.ServerResponse, url: URL): Promise<void> {
  const qui = await demandeur(req, url);
  if (!qui) return send(res, 401, sansSeance());
  if (await reserveeServiceCommun(res, qui)) return;
  const resultat = await slack.oublier(qui.userId);
  send(res, 200, { ...resultat, etat: await slack.etat() });
}

/* ------------------------- routes données partagées --------------------------- */

/**
 * Collections de l'instance. C'est par ici que plusieurs postes partagent
 * comptes, projets, conversations, tâches et agents.
 */
/**
 * Identifie la personne derrière la requête, à partir de son jeton de séance.
 *
 * Le jeton d'instance dit seulement que la machine a le droit de parler ; sans
 * séance, on ne sait pas qui parle et on ne peut donc rien cloisonner.
 */
/**
 * Exécute `suite` avec l'identité de la séance, ou répond 401.
 *
 * `exigeSeance` a déjà refusé les requêtes sans séance sur ces routes ; ce
 * passage sert à obtenir *qui*, pour ne montrer à chacun que ce qui le
 * concerne. Les deux vont ensemble : sans identité, on ne cloisonne rien.
 */
async function avecSeance(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  url: URL,
  suite: (qui: Demandeur) => void | Promise<void>,
): Promise<void> {
  const qui = await demandeur(req, url);
  if (!qui) return send(res, 401, sansSeance());
  await suite(qui);
}

/**
 * Identité déjà résolue pour cette requête.
 *
 * `demandeur()` est appelée deux fois sur une même requête : une fois par la
 * barrière `exigeSeance`, une fois par la route elle-même. Avec un jeton de
 * séance, relire deux fois ne coûtait rien. Avec un **billet de flux**, qui ne
 * sert qu'une fois, la seconde lecture échouait : le flux répondait 401 alors
 * que le billet était bon. On retient donc la réponse le temps de la requête.
 */
const identites = new WeakMap<http.IncomingMessage, Demandeur | null>();

/**
 * Requêtes arrivées avec une clé d'API, et l'identifiant de cette clé. Posé
 * par `traiterParCle`, avec l'identité de la titulaire dans `identites` :
 * `demandeur()` rend alors la titulaire, et rien de ce que la requête porte
 * par ailleurs (en-tête de séance, billet) n'y change quoi que ce soit.
 */
const parCleApi = new WeakMap<http.IncomingMessage, string>();

async function demandeur(req: http.IncomingMessage, url: URL): Promise<Demandeur | null> {
  if (identites.has(req)) return identites.get(req) ?? null;
  const resolu = await resoudreDemandeur(req, url);
  identites.set(req, resolu);
  return resolu;
}

async function resoudreDemandeur(req: http.IncomingMessage, url: URL): Promise<Demandeur | null> {
  /*
   * Billet de flux : c'est ici qu'il se consomme, une seule fois. Il vaut pour
   * l'ouverture d'un flux d'évènements, où `EventSource` ne sait pas poser
   * d'en-tête, et remplace le jeton de séance dans l'adresse (flux.ts).
   */
  const billet = url.searchParams.get("flux");
  if (billet) {
    const compteDuBillet = flux.consommer(billet);
    return compteDuBillet ? await profilDe(compteDuBillet) : null;
  }

  const entete = req.headers["x-helix-session"];
  const token =
    (typeof entete === "string" ? entete : entete?.[0]) ?? url.searchParams.get("session") ?? undefined;

  const seance = await resolveSession(token);
  if (!seance) return null;

  return profilDe(seance.accountId);
}

/** Identité cloisonnable d'un compte, ou null s'il n'a plus le droit d'entrer. */
async function profilDe(accountId: string): Promise<Demandeur | null> {
  const compte = (await publicAccounts()).find((a) => a.id === accountId);
  if (!compte) return null;
  // Séance ouverte avant que l'instance n'impose le second facteur : elle ne vaut plus.
  if (!seanceAdmise(compte)) return null;
  /*
   * L'adresse transmise au cloisonnement n'est pas forcément celle du compte :
   * une adresse que la personne a déclarée elle-même ne rattache aucune
   * invitation en attente (voir `adresseDePartage`, gateway/src/accounts.ts).
   */
  return { userId: compte.id, email: adresseDePartage(compte), groupes: await groupes.groupesDe(compte.id) };
}

/**
 * Routes qui exigent une séance : celles qui **font agir** l'instance, et
 * celles qui **donnent à voir** ce qu'une personne fait faire à l'agent.
 *
 * Le jeton d'instance dit qu'une machine a le droit de parler ; il ne dit pas
 * qui. Or exécuter des outils sur les fichiers, piloter l'écran, lancer l'agent
 * de code, installer un logiciel ou charger un modèle engage quelqu'un. Sans
 * séance, ces actions n'avaient ni auteur identifiable ni trace exploitable :
 * le jeton, présent sur chaque poste du parc, valait exécution complète.
 *
 * Deux flux d'évènements y figurent aussi, bien qu'ils ne fassent qu'observer :
 * ce qu'ils laissent voir engage une personne autant qu'une exécution. Le
 * détail est en regard de chacun.
 */
const EXECUTION: { methode: string; chemin: string }[] = [
  { methode: "POST", chemin: "/helix/models/load" },
  { methode: "POST", chemin: "/helix/code/vps" },
  { methode: "POST", chemin: "/helix/studio/medias" },
  { methode: "POST", chemin: "/helix/studio/medias/*" },
  { methode: "POST", chemin: "/helix/provision/moteur" },
  { methode: "POST", chemin: "/helix/provision/moteur/relancer" },
  { methode: "POST", chemin: "/helix/provision/start" },
  // L'emplacement des modèles (28/09/2026) : les chemins de la machine, et le choix de l'administrateur.
  { methode: "GET", chemin: "/helix/emplacement-modeles" },
  { methode: "POST", chemin: "/helix/emplacement-modeles" },
  { methode: "POST", chemin: "/helix/emplacement-modeles/verifier" },
  // Le moteur de LM Studio que Helix peut démarrer (23/10/2026) : l'état de la machine, et le choix de l'administrateur.
  { methode: "GET", chemin: "/helix/optimisation-locale" },
  { methode: "POST", chemin: "/helix/optimisation-locale" },
  { methode: "POST", chemin: "/helix/optimisation-locale/conseil" },
  { methode: "GET", chemin: "/helix/moteur-lmstudio" },
  { methode: "POST", chemin: "/helix/moteur-lmstudio" },
  { methode: "POST", chemin: "/helix/mcp/toggle" },
  { methode: "POST", chemin: "/helix/mcp/workspace" },
  { methode: "POST", chemin: "/helix/code/session" },
  { methode: "POST", chemin: "/helix/code/prompt" },
  { methode: "POST", chemin: "/helix/code/interrupt" },
  /*
   * Le flux des demandes d'approbation d'écran porte l'action **entière**,
   * texte à saisir compris. Mesuré au banc, au jeton seul et sans séance :
   * `{"type":"approbation_demandee","action":{"action":"saisir",
   * "texte":"MonMotDePasseBancaire-4242"}}`. Le journal d'audit, lui, ne
   * consigne que `{"action":"saisir"}` — il tient sa promesse de ne jamais
   * enregistrer ce qui est tapé, et c'était cette route qui la contredisait.
   * N'importe quel poste du parc pouvait écouter ce qu'un collègue fait taper
   * à l'agent. Il faut donc savoir *qui* écoute, pas seulement que la machine
   * a le droit de parler.
   */
  { methode: "GET", chemin: "/helix/computer/events" },
  /*
   * Et l'état lui-même, pour la même raison : il rend `enAttente`, c'est-à-dire
   * les mêmes actions entières que le flux. Seul le flux avait été fermé ; la
   * route d'état donnait la même chose à qui la demandait au jeton seul.
   */
  { methode: "GET", chemin: "/helix/computer" },
  /*
   * Approbation des outils : l'état et le flux portent le **détail** des
   * demandes, et ce détail est le mail tel qu'il partira — destinataires,
   * objet, corps entier — ou le chemin du fichier visé. Au jeton seul,
   * n'importe quel poste du parc lisait en direct la correspondance qu'un
   * agent préparait pour un collègue. Les deux routes exigent une séance, et
   * ne montrent à chacun que ses propres demandes (`Demande.pour`).
   */
  { methode: "GET", chemin: "/helix/approbation" },
  { methode: "GET", chemin: "/helix/approbation/evenements" },
  /*
   * Le flux de la session de code laisse voir le travail en cours d'un
   * collègue — prompts, sorties d'outils, contenu de fichiers. Et il ne se
   * contente pas de lire : jusqu'ici il **démarrait** le serveur OpenCode,
   * processus persistant enraciné sur le dossier de projet (mesuré : PID vivant
   * après un simple GET au jeton seul). Le démarrage est redevenu le rôle de
   * `POST /helix/code/session`, qui exige déjà une séance ; voir
   * `handleCodeEvents`.
   */
  { methode: "GET", chemin: "/helix/code/events" },
  // Codex avec le compte ChatGPT du propriétaire du poste (codex.ts, 27/09/2026) : la séance, puis ses propres barrières.
  { methode: "GET", chemin: "/helix/codex" },
  { methode: "POST", chemin: "/helix/codex/connexion" },
  { methode: "POST", chemin: "/helix/codex/connexion/annuler" },
  { methode: "POST", chemin: "/helix/codex/tache" },
  { methode: "POST", chemin: "/helix/codex/arreter" },
  // Préparer l'atelier installe des logiciels ; le vérifier écrit des fichiers
  // d'essai. Le jeton d'instance seul ne suffit donc pas.
  { methode: "POST", chemin: "/helix/atelier/preparer" },
  { methode: "POST", chemin: "/helix/atelier/verifier" },
  /*
   * Installer la dictée télécharge un logiciel et un modèle de 464 Mo ;
   * transcrire fait tourner un interpréteur sur la voix de quelqu'un. Les deux
   * engagent une personne, que le journal doit pouvoir nommer.
   */
  { methode: "POST", chemin: "/helix/dictee/installer" },
  /*
   * Créer une image fait tourner un modèle de plusieurs Go sur la machine ;
   * l'installer en télécharge autant. Une personne, nommée au journal.
   */
  { methode: "POST", chemin: "/helix/images/installer" },
  { methode: "POST", chemin: "/helix/images/desinstaller" },
  { methode: "POST", chemin: "/helix/images/choisir" },
  { methode: "POST", chemin: "/helix/images/creer" },
  { methode: "POST", chemin: "/helix/videos/installer" },
  { methode: "POST", chemin: "/helix/videos/desinstaller" },
  { methode: "POST", chemin: "/helix/videos/choisir" },
  { methode: "POST", chemin: "/helix/videos/creer" },
  { methode: "POST", chemin: "/helix/videos/scenario" },
  { methode: "POST", chemin: "/helix/dictee" },
  /*
   * Approuver une action, ou desserrer le niveau d'approbation, engage une
   * personne autant qu'exécuter l'outil lui-même. Sans séance, le jeton
   * d'instance aurait suffi à s'auto-approuver, et le journal n'aurait eu
   * personne à nommer.
   */
  { methode: "POST", chemin: "/helix/approbation/niveau" },
  { methode: "POST", chemin: "/helix/approbation/repondre" },
  // Donner à l'agent la souris et le clavier de la machine engage quelqu'un.
  { methode: "POST", chemin: "/helix/computer/mode" },
  { methode: "POST", chemin: "/helix/machine/demarrer" },
  { methode: "POST", chemin: "/helix/machine/arreter" },
  { methode: "POST", chemin: "/helix/machine/effacer" },
  // Voir l'écran de la machine montre ce que l'agent y fait : réservé à une séance, comme le reste.
  { methode: "GET", chemin: "/helix/machine/ecran" },
  /*
   * Brancher ou débrancher une boîte aux lettres modifie l'instance, et ouvre
   * aux agents la correspondance de l'entreprise. Le jeton d'instance, présent
   * sur chaque poste du parc, ne suffit donc pas : il faut une séance, pour que
   * le journal puisse nommer qui a connecté quelle boîte.
   */
  { methode: "POST", chemin: "/helix/courrier/configurer" },
  // Même famille : brancher une boîte par autorisation engage l'instance.
  { methode: "POST", chemin: "/helix/courrier/oauth" },
  { methode: "POST", chemin: "/helix/courrier/oauth/coller" },
  { methode: "POST", chemin: "/helix/courrier/envoi" },
  { methode: "POST", chemin: "/helix/courrier/confirmation" },
  { methode: "POST", chemin: "/helix/courrier/oublier" },
  /*
   * Même raisonnement pour l'agenda : le brancher ouvre aux agents l'emploi du
   * temps de l'entreprise, c'est-à-dire qui rencontre qui et quand. Il faut une
   * séance, pour que le journal puisse nommer qui a connecté quel agenda.
   */
  { methode: "POST", chemin: "/helix/agenda/configurer" },
  { methode: "POST", chemin: "/helix/agenda/oublier" },
  /*
   * Google Drive et Slack : les brancher ouvre aux agents les documents ou les
   * conversations de l'entreprise, les débrancher coupe cet accès à tous.
   * `drive/connecter` rend l'adresse d'autorisation, qui porte le `state` de la
   * demande ; `drive/code` achève une autorisation recopiée depuis le
   * navigateur. Il faut une séance, pour que le journal nomme qui l'a fait.
   */
  { methode: "POST", chemin: "/helix/drive/connecter" },
  { methode: "POST", chemin: "/helix/drive/code" },
  { methode: "POST", chemin: "/helix/drive/oublier" },
  { methode: "POST", chemin: "/helix/slack/configurer" },
  { methode: "POST", chemin: "/helix/slack/oublier" },
  // Sheets, Slides, YouTube, réseaux sociaux (oauthNatif.ts, 28/09/2026) : réservés en plus à l'administrateur (`handleNatifs`).
  { methode: "GET", chemin: "/helix/natifs" },
  { methode: "POST", chemin: "/helix/natifs/application" },
  { methode: "POST", chemin: "/helix/natifs/application/effacer" },
  { methode: "POST", chemin: "/helix/natifs/connecter" },
  { methode: "POST", chemin: "/helix/natifs/code" },
  { methode: "POST", chemin: "/helix/natifs/oublier" },
  // Telegram, Discord, WhatsApp (natifs/messageries.ts) : réservés en plus à l'administrateur (`handleMessageries`).
  { methode: "GET", chemin: "/helix/messageries" },
  { methode: "POST", chemin: "/helix/messageries/connecter" },
  { methode: "POST", chemin: "/helix/messageries/envoi" },
  { methode: "POST", chemin: "/helix/messageries/oublier" },
  // Commerce et relation client (natifs/commerce.ts, § 47) : réservés en plus à l'administrateur.
  { methode: "GET", chemin: "/helix/commerce" },
  { methode: "POST", chemin: "/helix/commerce/enregistrer" },
  { methode: "POST", chemin: "/helix/commerce/connecter" },
  { methode: "POST", chemin: "/helix/commerce/oublier" },
  /*
   * Ajouter un connecteur lance un programme de plus sur la machine, et lui
   * confie un jeton d'accès à un service de l'entreprise ; le retirer coupe cet
   * accès à tous les agents d'un coup. Ces deux routes modifient la machine :
   * le jeton d'instance, présent sur chaque poste du parc, ne peut pas suffire.
   */
  /*
   * Un billet de flux ouvre un flux d'évènements au nom de son titulaire : il
   * ne s'obtient qu'avec une séance, sinon il n'y aurait personne à y inscrire.
   */
  { methode: "POST", chemin: "/helix/flux/ticket" },
  /*
   * Inviter engage l'instance : cela ouvre à quelqu'un le droit de rattacher un
   * poste et d'y ouvrir un compte, et cela fait partir un mail en son nom. Le
   * journal doit pouvoir dire qui a invité qui. (La route que l'invité appelle,
   * elle, est publique par nécessité : voir `handleRejoindre`.)
   */
  /*
   * Ouvrir l'instance au réseau change la surface de la machine : cela engage
   * la personne qui l'administre, et le journal doit pouvoir la nommer.
   */
  { methode: "GET", chemin: "/helix/reseau" },
  { methode: "POST", chemin: "/helix/reseau" },
  { methode: "POST", chemin: "/helix/invitations/inviter" },
  { methode: "GET", chemin: "/helix/invitations" },
  { methode: "POST", chemin: "/helix/invitations" },
  { methode: "POST", chemin: "/helix/connecteurs/ajouter" },
  { methode: "POST", chemin: "/helix/connecteurs/connecter" },
  { methode: "POST", chemin: "/helix/connecteurs/retirer" },
  // Un serveur MCP ajouté par l'administrateur (16/10/2026) : le journal nomme qui l'a ajouté ou réglé.
  { methode: "POST", chemin: "/helix/connecteurs/personnalise" },
  { methode: "POST", chemin: "/helix/connecteurs/personnalise/lectures" },
  /*
   * La consommation d'une personne dit quand elle travaille et combien : elle
   * ne se lit qu'avec une séance, et la route ne rend que celle du demandeur.
   * Le tarif d'un modèle distant change tous les coûts affichés, pour tout le
   * monde : le modifier engage quelqu'un, que le journal doit pouvoir nommer.
   */
  { methode: "GET", chemin: "/helix/usage" },
  { methode: "POST", chemin: "/helix/usage/tarif" },
  /*
   * Modifier son nom ou son adresse change une identité : l'adresse est à la
   * fois un identifiant de connexion et une clé de partage. Le jeton
   * d'instance ne dit pas qui parle ; la séance, si, et c'est son compte, et
   * lui seul, que la route modifie (`handleAuthProfil`).
   */
  { methode: "POST", chemin: "/helix/auth/profil" },
  // Installer OpenClaw télécharge et installe un logiciel sur la machine de l'instance.
  { methode: "POST", chemin: "/helix/openclaw/installer" },
];

/*
 * `/helix/data` (les révisions) reste au jeton seul, volontairement : c'est ce
 * que la synchronisation interroge **avant la connexion** pour rapatrier la
 * liste des comptes et peupler l'écran de connexion. L'y soumettre à une séance
 * rendait tout poste neuf incapable d'afficher ses comptes.
 *
 * Ce qu'elle expose se limite à des horodatages d'écriture par collection : de
 * l'activité, jamais du contenu. Le contenu, lui, exige une séance
 * (`/helix/data/<collection>`), à la seule exception des comptes expurgés.
 */

/*
 * Employés OpenClaw : toutes leurs routes engagent quelqu'un (déployer, faire
 * travailler, lire ses propres échanges), sauf le serveur d'outils, que
 * l'instance OpenClaw appelle sans séance et qui vérifie sa propre clé
 * (serveurOutils.ts).
 */
const routeEmploye = (chemin: string) =>
  (chemin === "/helix/employes" || chemin.startsWith("/helix/employes/")) && !/\/outils$/.test(chemin);

/*
 * Clés de modèles cloud : les lister, les essayer, les brancher engagent le
 * moyen de paiement de quelqu'un, et une clé personnelle ne se montre qu'à son
 * titulaire. Tout le préfixe exige une séance.
 */
const routeFournisseur = (chemin: string) =>
  chemin === "/helix/fournisseurs" || chemin.startsWith("/helix/fournisseurs/");

/*
 * Dossier de travail de l'équipe (« Depuis Helix ») : parcourir et relire ce
 * que les agents voient déjà. Une séance, pour savoir qui l'a fait.
 */
const routeEspace = (chemin: string) => chemin === "/helix/espace" || chemin === "/helix/espace/fichier";

/*
 * Groupes de l'équipe : qui en est membre décide de ce que chacun voit ; les
 * créer, les changer, les quitter engagent quelqu'un.
 */
const routeGroupe = (chemin: string) => chemin === "/helix/groupes" || chemin.startsWith("/helix/groupes/");

// Bibliothèque : chaque lecture est filtrée pour qui la demande, chaque écriture a un auteur.
const routeBibliotheque = (chemin: string) => chemin === "/helix/bibliotheque" || chemin.startsWith("/helix/bibliotheque/");

// Bases de connaissances : comme la Bibliothèque dont elles lisent les documents.
const routeConnaissances = (chemin: string) => chemin === "/helix/connaissances" || chemin.startsWith("/helix/connaissances/");

// Réunions : enregistrer, transcrire, envoyer le bot engagent quelqu'un ; lire est filtré pour lui.
const routeReunion = (chemin: string) => chemin === "/helix/reunions" || chemin.startsWith("/helix/reunions/");

/*
 * Entraîner un modèle : installer le moteur télécharge plusieurs Go, entraîner
 * occupe la machine, et les exemples sont ceux de quelqu'un. Tout le préfixe
 * exige une séance ; chaque projet n'est rendu qu'à son auteur.
 */
const routeEntrainement = (chemin: string) => chemin === "/helix/entrainement" || chemin.startsWith("/helix/entrainement/");

/*
 * Clés d'API personnelles : les lister, en créer, en révoquer engagent une
 * personne, et chacune ne voit que les siennes. Une séance, jamais une clé
 * (une clé n'atteint aucune route `/helix/*`, voir `ROUTES_CLE`).
 */
const routeClesApi = (chemin: string) => chemin === "/helix/cles-api" || chemin.startsWith("/helix/cles-api/");

const exigeSeance = (methode: string, chemin: string) =>
  EXECUTION.some((r) => r.methode === methode && r.chemin === chemin) ||
  routeClesApi(chemin) ||
  routeEntrainement(chemin) ||
  routeEmploye(chemin) ||
  routeFournisseur(chemin) ||
  routeEspace(chemin) ||
  routeGroupe(chemin) ||
  routeBibliotheque(chemin) ||
  routeConnaissances(chemin) ||
  routeReunion(chemin);

/*
 * Une fonction et non une constante : une constante est calculée une fois, au
 * chargement de la passerelle, hors de toute requête — donc en français pour
 * tout le monde. Appelée au moment de répondre, elle parle la langue de celui
 * qui lit (langue.ts).
 */
const sansSeance = () => ({
  error: {
    message: t("Séance expirée ou absente. Reconnectez-vous pour accéder à vos données."),
  },
});

async function handleDataRead(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  url: URL,
  name: string,
): Promise<void> {
  if (!isCollection(name)) {
    return send(res, 404, { error: { message: tf("Collection inconnue : {0}", name) } });
  }
  const revision = await revisionVue(name);

  /*
   * Les comptes sortent expurgés : une empreinte de mot de passe distribuée à
   * tous les postes pourrait être attaquée hors ligne par n'importe quel
   * collaborateur. Cette liste reste lisible sans séance : c'est l'écran de
   * connexion qui la demande, avant qu'une séance existe.
   *
   * `hasPassword` en disparaît aussi. Il disait quels comptes n'ont pas encore
   * de mot de passe — c'est-à-dire ceux dont `/helix/auth/premier-mot-de-passe`
   * ouvre une séance à qui le pose. Publier la liste des comptes à prendre
   * revenait à la servir. L'écran de connexion l'apprend autrement : il essaie,
   * et la réponse lui dit « mot de passe à définir » pour le compte visé,
   * celui-là seulement.
   */
  if (name === "accounts") {
    const comptes = (await publicAccounts()).map(({ hasPassword: _p, ...reste }) => reste);
    return send(res, 200, { collection: name, value: comptes, revision });
  }

  const qui = await demandeur(req, url);
  if (!qui) return send(res, 401, sansSeance());

  const valeur = filtrer(name, await db().read(name), qui);
  send(res, 200, { collection: name, value: valeur, revision });
}

/** Une file par collection : ce qui s'y lit puis s'y écrit ne se croise pas. */
const filesDeCollection = new Map<string, Promise<unknown>>();
function enFileDeCollection<T>(nom: string, travail: () => Promise<T>): Promise<T> {
  const avant = filesDeCollection.get(nom) ?? Promise.resolve();
  const suite = avant.catch(() => undefined).then(travail);
  filesDeCollection.set(nom, suite.catch(() => undefined));
  return suite;
}

async function handleDataWrite(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  url: URL,
  name: string,
): Promise<void> {
  if (!isCollection(name)) {
    return send(res, 404, { error: { message: tf("Collection inconnue : {0}", name) } });
  }
  // Les comptes ne s'écrivent que par les routes d'authentification : un poste
  // ne doit pas pouvoir remplacer la liste, ni effacer les empreintes.
  if (name === "accounts") {
    return send(res, 403, {
      error: {
        message:
          t("Les comptes se créent via /helix/auth/create : leur écriture directe est refusée."),
      },
    });
  }

  const qui = await demandeur(req, url);
  if (!qui) return send(res, 401, sansSeance());

  let body: { value?: unknown };
  try {
    body = (await readJson(req)) as { value?: unknown };
  } catch {
    return send(res, 400, { error: { message: t("Corps JSON invalide.") } });
  }

  /*
   * Une liste, et rien d'autre (les profils : un objet). Un corps sans
   * `value`, ou `{}`, valait « je n'ai plus rien » et effaçait tout ce que
   * l'appelant possédait (revue du 26/09/2026) : la moitié serveur de la perte
   * du 20/09.
   */
  const forme = name === "profiles" ? body.value !== null && typeof body.value === "object" && !Array.isArray(body.value) : Array.isArray(body.value);
  if (!forme) {
    return send(res, 400, { error: { message: name === "profiles" ? t("« value » doit être un objet.") : t("« value » doit être une liste : rien n'a été écrit.") } });
  }

  /*
   * Le poste envoie la collection entière. On n'en retient que ce qu'il a le
   * droit de toucher : sans cette fusion, pousser une liste vide effacerait le
   * travail de toute l'entreprise.
   *
   * Lire, fusionner, écrire : une écriture à la fois par collection. Sur
   * PostgreSQL, deux envois simultanés lisaient le même état et le second
   * effaçait ce que le premier venait d'ajouter (revue du 26/09/2026).
   */
  /*
   * La version de l'instance sur laquelle ce poste s'appuie (`base`, 27/09/2026).
   * Une absence vaut suppression : la même personne sur un second poste, qui
   * n'avait pas encore relu, effaçait ce qu'elle venait de créer sur le
   * premier. Si l'instance a changé depuis, rien n'est écrit : le poste relit,
   * fusionne ce qu'il avait en attente (sync.ts) et renvoie. Un poste d'avant
   * cette règle n'envoie pas de `base`, et garde l'ancien comportement.
   */
  const base = typeof (body as { base?: unknown }).base === "number" ? (body as { base: number }).base : undefined;
  const fusion = await enFileDeCollection(name, async () => {
    /*
     * La version que ce poste a lue : celle que rend la lecture (`revisionVue`),
     * qui tient compte des groupes pour les Chats. Comparée à la version brute,
     * elle ne tombait plus jamais juste dès qu'un groupe changeait, et aucun
     * Chat ne s'enregistrait plus (revue du 27/09/2026).
     */
    if (base !== undefined && base !== (await revisionVue(name))) return null;
    const existant = await db().read(name);
    const f = fusionner(name, existant, body.value ?? null, qui);
    // Un collègue peut renvoyer une copie où figure encore un compte supprimé.
    await db().write(name, await sansComptesDisparus(name, f.valeur));
    /*
     * Un Chat supprimé emporte sa mémoire (memoireConversation.ts,
     * 16/10/2026), celle de chaque personne qui y a parlé. Seulement les
     * identifiants qui étaient dans la collection lue, et n'y sont plus après
     * la fusion : jamais sur une lecture ratée (elle lève avant d'arriver ici).
     */
    if (name === "sessions") {
      const apres = new Set((Array.isArray(f.valeur) ? f.valeur : []).map((c) => String((c as { id?: unknown })?.id)));
      const partis = (Array.isArray(existant) ? existant : []).map((c) => String((c as { id?: unknown })?.id)).filter((id) => !apres.has(id));
      if (partis.length > 0) {
        const n = await memoireConversation.oublierChatsPartout(partis).catch(() => 0);
        if (n > 0) console.log(`[memoire] ${n} mémoire(s) de Chat supprimé effacée(s)`);
      }
    }
    return f;
  });
  if (!fusion) {
    return send(res, 409, {
      error: { message: t("Cette copie n'est plus à jour : un autre poste a écrit entre-temps. Relisez, puis renvoyez."), code: "revision-depassee" },
      revision: await revisionVue(name),
    });
  }
  // Deux écritures dans la même milliseconde ont la même révision : le relevé des images ne s'y fie pas seul.
  if (name === "sessions") images.oublierChatsDesImages();

  journaliser("donnees.ecrites", qui.userId, {
    collection: name,
    refuses: fusion.refuses,
  });

  send(res, 200, {
    collection: name,
    revision: await revisionVue(name),
    refuses: fusion.refuses,
  });
}

/* --------------------------- routes authentification -------------------------- */

/**
 * Création d'un compte.
 *
 * Le point sensible est l'adresse email : elle sert de clé de partage
 * (« invitez votre collègue par son mail »), et rien ne la vérifie. Ouverte au
 * seul jeton d'instance, cette route permettait à n'importe quel poste du parc
 * de créer un compte à l'adresse d'un invité en attente et d'hériter de ses
 * projets et conversations.
 *
 * D'où la règle : le **premier** compte s'ouvre librement — il faut bien
 * amorcer l'instance — puis toute création exige une séance. Sur une instance
 * d'entreprise, c'est un collègue déjà connu qui inscrit le suivant, comme dans
 * un ERP. Personne ne s'auto-déclare avec l'adresse d'un autre.
 */
async function handleAuthCreate(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  url: URL,
): Promise<void> {
  const body = (await readJson(req).catch(() => ({}))) as {
    fullName?: string;
    email?: string;
    password?: string;
    poste?: string;
    /** Code reçu par mail : il tient lieu de séance (invitations.ts). */
    invitation?: unknown;
  };

  const dejaLa = await publicAccounts();
  const amorcage = dejaLa.length === 0;

  /*
   * Trois façons d'ouvrir un compte, et pas une de plus.
   *
   *  1. **l'amorçage** : l'instance n'a aucun compte, il faut bien commencer ;
   *  2. **un collègue connecté** inscrit quelqu'un — il choisit alors le mot
   *     de passe, ce qui n'est pas idéal, mais c'était la seule voie ;
   *  3. **un code d'invitation**, depuis la 0.23.0 : la personne invitée ouvre
   *     son compte **elle-même** et choisit son propre mot de passe, que
   *     personne d'autre ne connaîtra. C'est la bonne voie.
   *
   * Dans le cas 3, l'adresse du compte est **celle de l'invitation**, jamais
   * celle que le corps de la requête propose : sans quoi un code destiné à une
   * personne servirait à en inscrire une autre.
   */
  let emailImpose: string | null = null;
  if (!amorcage) {
    if (body.invitation !== undefined) {
      const verdict = await invitations.consommer(body.invitation);
      if (!verdict.ok) {
        return send(res, verdict.statut, { error: { message: verdict.message } });
      }
      emailImpose = verdict.valeur.email;
    } else {
      const qui = await demandeur(req, url);
      if (!qui) {
        return send(res, 401, {
          error: {
            message:
              "Cette instance a déjà des comptes. Faites-vous inviter par un collègue : " +
              "vous recevrez un code, et vous choisirez vous-même votre mot de passe.",
          },
        });
      }
      /*
       * Créer directement le compte de quelqu'un d'autre : l'administrateur
       * seul (revue du 26/09/2026). Un collègue invite (invitations.ts) : la
       * personne ouvre alors son compte elle-même. Et même par
       * l'administrateur, le mot de passe choisi est provisoire : il ne sert
       * qu'à en choisir un à soi, à la première connexion.
       */
      if (!(await estAdministrateur(qui.userId))) {
        return send(res, 403, {
          error: { message: t("Pour ajouter un collègue, invitez-le : il ouvrira son compte lui-même et choisira son mot de passe. Seul l'administrateur crée un compte directement.") },
        });
      }
    }
  }

  const result = await createAccount({
    fullName: body.fullName ?? "",
    email: emailImpose ?? body.email ?? "",
    password: body.password,
    // Ni l'amorçage ni l'invitation : quelqu'un d'autre a choisi ce mot de passe.
    provisoire: !amorcage && !emailImpose,
  });
  if (!result.ok) return send(res, 400, { error: { message: result.reason } });

  journaliser("compte.cree", result.account.id, {
    email: result.account.email,
    amorcage,
    ...(emailImpose ? { surInvitation: true } : {}),
  });

  /*
   * Amorçage : on ouvre la séance dans la foulée.
   *
   * Sans cela, la personne qui vient de créer le premier compte est connectée
   * dans l'interface et parfaitement inconnue de l'instance : chaque route qui
   * exige une séance lui répondait « Session expirée, reconnectez-vous », y
   * compris le choix du dossier de travail et l'usage des outils. Une
   * application neuve s'ouvrait donc sur un message d'erreur.
   *
   * Hors amorçage, surtout pas : c'est un collègue déjà connecté qui inscrit
   * quelqu'un d'autre. Lui rendre une séance au nom du nouveau compte le
   * ferait basculer dans une identité qui n'est pas la sienne.
   */
  /*
   * Instance qui impose le second facteur : même le premier compte n'a pas de
   * séance avant de l'avoir activé. Le défi d'inscription prend sa place, et
   * l'écran enchaîne sur le QR code.
   */
  if ((amorcage || emailImpose) && deuxFacteursObligatoire()) {
    return send(res, 200, { account: result.account, defi: defiInscription(result.account.id) });
  }

  /*
   * Séance ouverte dans la foulée pour l'amorçage **et** pour une création sur
   * invitation : dans les deux cas, c'est la personne elle-même qui vient
   * d'ouvrir son compte, et la laisser devant un écran de connexion juste
   * après serait absurde. Quand c'est un collègue qui inscrit quelqu'un
   * d'autre, surtout pas : cela le ferait basculer dans une identité qui n'est
   * pas la sienne.
   */
  const seance =
    amorcage || emailImpose
      ? await openSession(result.account.id, body.poste ?? "Poste", resterConnecte(body as Record<string, unknown>))
      : undefined;

  send(res, 200, { account: result.account, session: seance });
}

/**
 * « Rester connecté sur ce poste », coché à la connexion.
 *
 * Le choix voyage jusqu'au bout du parcours (mot de passe, puis code si la
 * double authentification est active) : c'est la même personne qui le termine,
 * et la séance n'est ouverte qu'à la dernière étape. Ce n'est pas un droit de
 * plus, seulement une durée — et la séance longue se voit et se révoque dans
 * la liste des postes.
 */
const resterConnecte = (body: Record<string, unknown>): boolean => body.rester === true;

async function handleAuthVerify(
  req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<void> {
  const body = (await readJson(req).catch(() => ({}))) as {
    accountId?: string;
    password?: string;
    poste?: string;
  };
  if (!body.accountId) {
    return send(res, 400, { error: { message: t("`accountId` est requis.") } });
  }
  const result = await verifyAccount(body.accountId, body.password);
  return repondreConnexion(res, result, body as Record<string, unknown>);
}

/** La suite commune d'une vérification de mot de passe : séance, ou l'étape suivante. */
async function repondreConnexion(
  res: http.ServerResponse,
  result: Awaited<ReturnType<typeof verifyAccount>>,
  body: Record<string, unknown>,
): Promise<void> {
  if (!result.ok) {
    // Mot de passe choisi par qui a créé le compte : la personne en choisit un à elle d'abord.
    if (result.aChanger) {
      return send(res, 409, { error: { message: result.reason, code: "mot-de-passe-a-changer" } });
    }
    // 409 plutôt que 401 : ce n'est pas un mauvais mot de passe, c'est un
    // compte à qui il en manque un. L'interface bascule sur la saisie du premier.
    if (result.aDefinir) {
      return send(res, 409, { error: { message: result.reason, code: "mot-de-passe-a-definir" } });
    }
    // Instance qui impose le second facteur, compte qui n'en a pas encore.
    if (result.inscription) {
      return send(res, 401, {
        error: { message: result.reason, code: "deux-facteurs-a-activer" },
        defi: result.inscription,
      });
    }
    // Mot de passe juste, code attendu : le défi remplace la séance.
    if (result.defi) {
      return send(res, 401, {
        error: { message: result.reason, code: "deux-facteurs-requis" },
        defi: result.defi,
      });
    }
    return send(res, 401, { error: { message: result.reason } });
  }

  /*
   * La connexion ouvre une séance : c'est elle qui portera l'identité sur
   * chaque requête suivante, et c'est elle qu'on révoque si le poste est perdu.
   */
  const seance = await openSession(
    result.account.id,
    typeof body.poste === "string" ? body.poste : "Poste",
    resterConnecte(body),
  );
  send(res, 200, { account: result.account, session: seance });
}

/**
 * Le mot de passe provisoire remplacé par celui de la personne, puis la
 * connexion comme d'habitude (second facteur compris). Au jeton seul, comme la
 * connexion : la personne n'a pas encore de séance.
 */
async function handleChangerProvisoire(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  const body = (await readJson(req).catch(() => ({}))) as Record<string, unknown>;
  if (typeof body.accountId !== "string" || !body.accountId) return send(res, 400, { error: { message: t("`accountId` est requis.") } });
  const r = await remplacerMotDePasseProvisoire(body.accountId, body.password, body.nouveau);
  if (!r.ok) return send(res, r.statut, { error: { message: r.reason } });
  return repondreConnexion(res, await verifyAccount(body.accountId, String(body.nouveau)), body);
}

/**
 * Mot de passe oublié, avec un code de récupération : le code redéfinit le
 * mot de passe (accounts.ts, `recupererParCode`), puis la connexion suit son
 * cours, second facteur compris. Au jeton seul, comme la connexion : la
 * personne n'a pas de séance. Bornée par appelant (debit.ts), et chaque échec
 * compte dans le blocage du compte.
 */
async function handleRecuperer(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  const body = (await readJson(req).catch(() => ({}))) as Record<string, unknown>;
  const r = await recupererParCode(body.accountId, body.code, body.nouveau);
  if (!r.ok) return send(res, r.statut, { error: { message: r.reason } });
  return repondreConnexion(res, await verifyAccount(String(body.accountId), String(body.nouveau)), body);
}

/**
 * Codes de récupération du compte de la séance : combien il en reste (GET), ou
 * une nouvelle série (POST, mot de passe et code du second facteur s'il est
 * actif). Jamais ceux d'un autre : le compte est celui de la séance.
 */
async function handleCodesRecuperation(req: http.IncomingMessage, res: http.ServerResponse, url: URL): Promise<void> {
  const qui = await demandeur(req, url);
  if (!qui) return send(res, 401, sansSeance());
  if (req.method === "GET") {
    const etat = await etatRecuperation(qui.userId);
    return etat ? send(res, 200, etat) : send(res, 404, { error: { message: t("Compte introuvable.") } });
  }
  const body = (await readJson(req).catch(() => ({}))) as { password?: unknown; code?: unknown };
  const r = await creerCodesRecuperation(qui.userId, body.password, body.code);
  if (!r.ok) return send(res, r.statut, { error: { message: r.reason } });
  send(res, 200, { codes: r.codes });
}

/**
 * Un administrateur réinitialise le mot de passe d'un collègue (accounts.ts,
 * `reinitialiserParAdministrateur`, pour ce qui est exigé et pourquoi).
 * GET : les comptes qui administrent aussi, que l'écran ne propose pas.
 */
async function handleReinitialiser(req: http.IncomingMessage, res: http.ServerResponse, url: URL): Promise<void> {
  const qui = await demandeur(req, url);
  if (!qui) return send(res, 401, sansSeance());
  if (!(await estAdministrateur(qui.userId))) {
    journaliser("reglage.refuse", qui.userId, { reglage: "réinitialisation de mot de passe" });
    return send(res, 403, { error: { message: t("Seul l'administrateur de l'instance réinitialise le mot de passe d'un collègue.") } });
  }
  if (req.method === "GET") {
    const comptes = await publicAccounts();
    const administrateurs: string[] = [];
    for (const c of comptes) if (await estAdministrateur(c.id)) administrateurs.push(c.id);
    return send(res, 200, { administrateurs });
  }
  const body = (await readJson(req).catch(() => ({}))) as Record<string, unknown>;
  const r = await reinitialiserParAdministrateur(qui.userId, body.accountId, body.password, body.code, body.retirerDeuxFacteurs, estAdministrateur);
  if (!r.ok) return send(res, r.statut, { error: { message: r.reason } });
  // Montré une fois : ni cache, ni journal. `send` répond en JSON ; l'en-tête dit de ne rien garder.
  res.setHeader("Cache-Control", "no-store");
  send(res, 200, { provisoire: r.provisoire, expire: r.expire, deuxFacteursRetire: r.deuxFacteursRetire });
}

/**
 * Premier mot de passe d'un compte créé sans, avant que la règle ne change.
 *
 * Accessible au jeton seul, comme la connexion : la personne n'a pas encore de
 * séance, puisque c'est précisément ce mot de passe qui lui en ouvrira une.
 * Voir `definirPremierMotDePasse` pour la pesée de l'exposition.
 */
async function handlePremierMotDePasse(
  req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<void> {
  const body = (await readJson(req).catch(() => ({}))) as {
    accountId?: unknown;
    password?: unknown;
    poste?: unknown;
  };
  if (typeof body.accountId !== "string" || !body.accountId) {
    return send(res, 400, { error: { message: t("`accountId` est requis.") } });
  }
  const result = await definirPremierMotDePasse(body.accountId, body.password);
  if (!result.ok) {
    const code = result.statut === 409 ? "mot-de-passe-deja-defini" : undefined;
    return send(res, result.statut, { error: { message: result.reason, code } });
  }
  // Instance qui impose le second facteur : pas de séance avant son activation.
  if (deuxFacteursObligatoire()) {
    return send(res, 401, {
      error: {
        message: t("Votre instance exige la double authentification : activez-la pour vous connecter."),
        code: "deux-facteurs-a-activer",
      },
      defi: defiInscription(result.account.id),
    });
  }

  const seance = await openSession(
    result.account.id,
    typeof body.poste === "string" ? body.poste : "Poste",
    resterConnecte(body as Record<string, unknown>),
  );
  send(res, 200, { account: result.account, session: seance });
}

/**
 * Second pas de la connexion : le code de l'application d'authentification, ou
 * un code de secours. Accessible au jeton seul, comme `verify` dont il est la
 * suite ; c'est le défi remis par `verify` qui prouve le mot de passe.
 */
async function handleDeuxFacteurs(
  req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<void> {
  const body = (await readJson(req).catch(() => ({}))) as {
    defi?: unknown;
    code?: unknown;
    poste?: unknown;
  };
  const result = await validerSecondFacteur(body.defi, body.code);
  if (!result.ok) {
    return send(res, result.statut, {
      error: { message: result.reason, code: result.expire ? "defi-expire" : undefined },
    });
  }
  const seance = await openSession(
    result.account.id,
    typeof body.poste === "string" ? body.poste : "Poste",
    resterConnecte(body as Record<string, unknown>),
  );
  send(res, 200, { account: result.account, session: seance });
}

/**
 * Activation imposée du second facteur, à la connexion (instance qui l'exige,
 * compte qui n'en a pas). Au jeton seul, comme `verify` : c'est le défi
 * d'inscription, remis après le mot de passe, qui tient lieu de preuve.
 */
async function handleInscriptionDeuxFacteurs(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  etape: "preparer" | "activer",
): Promise<void> {
  const body = (await readJson(req).catch(() => ({}))) as {
    defi?: unknown;
    code?: unknown;
    poste?: unknown;
  };
  if (etape === "preparer") {
    const r = await preparerInscription(body.defi);
    if (!r.ok) {
      return send(res, r.statut, {
        error: { message: r.reason, code: r.expire ? "defi-expire" : undefined },
      });
    }
    return send(res, 200, { secret: r.secret });
  }
  const r = await activerInscription(body.defi, body.code);
  if (!r.ok) {
    return send(res, r.statut, {
      error: { message: r.reason, code: r.expire ? "defi-expire" : undefined },
    });
  }
  const seance = await openSession(
    r.account.id,
    typeof body.poste === "string" ? body.poste : "Poste",
    resterConnecte(body as Record<string, unknown>),
  );
  send(res, 200, { account: r.account, session: seance, codesDeSecours: r.codesDeSecours });
}

/**
 * Réglage du second facteur, par la personne connectée et pour elle seule :
 * le compte est toujours celui de la séance, jamais un identifiant envoyé.
 * Toute modification redemande le mot de passe (voir `controlerMotDePasse`).
 */
async function handleReglageDeuxFacteurs(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  url: URL,
  action: "etat" | "preparer" | "activer" | "desactiver" | "codes",
): Promise<void> {
  const qui = await demandeur(req, url);
  if (!qui) return send(res, 401, sansSeance());

  if (action === "etat") {
    const etat = await etatDeuxFacteurs(qui.userId);
    return etat
      ? send(res, 200, etat)
      : send(res, 404, { error: { message: t("Compte introuvable.") } });
  }

  const body = (await readJson(req).catch(() => ({}))) as {
    password?: unknown;
    code?: unknown;
  };
  const result =
    action === "preparer"
      ? await preparerDeuxFacteurs(qui.userId, body.password)
      : action === "activer"
        ? await activerDeuxFacteurs(qui.userId, body.code)
        : action === "desactiver"
          ? await desactiverDeuxFacteurs(qui.userId, body.password, body.code)
          : await regenererCodesDeSecours(qui.userId, body.password, body.code);
  if (!result.ok) return send(res, result.statut, { error: { message: result.reason } });
  const { ok: _ok, ...reponse } = result;
  send(res, 200, reponse);
}

/**
 * Export RGPD des données de la personne connectée (voir `export.ts`). Le
 * compte est celui de la séance : il n'existe aucun moyen, par cette route,
 * d'exporter les données d'un collègue.
 */
async function handleExport(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  url: URL,
): Promise<void> {
  const qui = await demandeur(req, url);
  if (!qui) return send(res, 401, sansSeance());
  send(res, 200, await exporterDonnees(qui));
}

/**
 * « Effacer la mémoire de ce Chat » (memoireConversation.ts, 16/10/2026) : la
 * mémoire de la personne de la séance, et seulement la sienne. Le Chat reste.
 */
async function handleOublierMemoireChat(req: http.IncomingMessage, res: http.ServerResponse, url: URL, chat: string): Promise<void> {
  const qui = await demandeur(req, url);
  if (!qui) return send(res, 401, sansSeance());
  if (!memoireConversation.chatValide(chat)) return send(res, 400, { error: { message: t("Ce Chat n'existe pas.") } });
  const effacee = await memoireConversation.oublierChat(qui.userId, chat);
  journaliser("memoire.chat_effacee", qui.userId, { effacee });
  send(res, 200, { effacee });
}

/**
 * Suppression de son propre compte (RGPD, article 17). Le compte est celui de
 * la séance ; l'identité est confirmée par le mot de passe, et par un code si
 * le second facteur est actif. Voir `effacement.ts` pour ce qui disparaît et
 * ce qui reste.
 */
async function handleEffacement(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  url: URL,
  etape: "apercu" | "effacer",
): Promise<void> {
  const qui = await demandeur(req, url);
  if (!qui) return send(res, 401, sansSeance());
  const compte = (await publicAccounts()).find((a) => a.id === qui.userId);
  if (!compte) return send(res, 404, { error: { message: t("Compte introuvable.") } });

  if (etape === "apercu") {
    return send(res, 200, {
      ...(await apercuEffacement(compte.id, compte.email)),
      deuxFacteurs: compte.deuxFacteursActive,
    });
  }
  const body = (await readJson(req).catch(() => ({}))) as { password?: unknown; code?: unknown };
  const refus = await confirmerIdentite(compte.id, body.password, body.code);
  if (refus) return send(res, refus.statut, { error: { message: refus.reason } });
  // Côté OpenClaw d'abord : ses conversations avec les employés, et les employés qu'il a déployés.
  const sesEmployes = (await employes.employesDe(compte.id)).map((e) => e.nom);
  await employes.oublierPersonne(compte.id);
  const bilan = { ...(await effacerCompte(compte.id, compte.email, "titulaire")), employes: sesEmployes };
  send(res, 200, { ok: true, bilan });
}

/**
 * Modification de son propre profil : nom complet et adresse.
 *
 * Le compte modifié est **toujours** celui de la séance. La requête ne désigne
 * personne : si elle tente de le faire (`accountId`, `userId` ou `id` qui ne
 * sont pas les siens), elle est refusée en 403 plutôt qu'ignorée, pour qu'un
 * appelant qui croirait modifier un collègue ne reparte pas avec un 200 qui
 * aurait en fait touché son propre compte.
 *
 * Toutes les règles de fond (mot de passe exigé pour l'adresse, unicité,
 * absence d'héritage d'invitations, trace) sont dans `modifierProfil`
 * (gateway/src/accounts.ts), à côté des empreintes qu'elles manipulent.
 */
async function handleAuthProfil(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  url: URL,
): Promise<void> {
  const qui = await demandeur(req, url);
  if (!qui) return send(res, 401, sansSeance());

  let body: unknown;
  try {
    body = await readJson(req);
  } catch {
    return send(res, 400, { error: { message: t("Corps JSON invalide.") } });
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return send(res, 400, { error: { message: t("Corps JSON invalide.") } });
  }
  const champs = body as Record<string, unknown>;

  for (const cle of ["accountId", "userId", "id"]) {
    if (cle in champs && champs[cle] !== qui.userId) {
      return send(res, 403, {
        error: { message: t("On ne modifie que son propre compte.") },
      });
    }
  }

  const resultat = await modifierProfil(qui.userId, {
    fullName: champs.fullName,
    email: champs.email,
    password: champs.password,
    photo: champs.photo,
  });
  if (!resultat.ok) {
    return send(res, resultat.statut, { error: { message: resultat.reason } });
  }
  send(res, 200, { account: resultat.account });
}

/**
 * Journal d'audit : entrées récentes et vérification de la chaîne.
 *
 * Réservé aux personnes connectées, et **à ce qui les concerne**. Le journal
 * dit qui s'est connecté et quand, quels fichiers chaque agent a touchés,
 * quels documents ont été ouverts, quelles boîtes sont branchées. Rendu en
 * entier à toute séance, il donnait à chaque salarié la carte complète de
 * l'activité de ses collègues. Chacun y voit donc les siennes, plus celles
 * que l'instance s'attribue à elle-même (« systeme ») : ce sont les
 * démarrages, les migrations, les purges — l'état de la machine, que tout le
 * monde peut légitimement constater, et qui ne nomme personne.
 *
 * La vérification d'intégrité, elle, reste globale : elle porte sur la chaîne
 * d'empreintes, pas sur le contenu, et ne rend que des compteurs. Une chaîne
 * rompue doit être visible de tous, c'est tout l'intérêt de la sceller.
 *
 * **L'administrateur de l'instance, lui, voit tout** (roles.ts) : quelqu'un
 * doit pouvoir constater ce qui s'y passe, sans quoi sceller le journal ne
 * sert à rien. Il est désigné par le profil de déploiement, à défaut c'est le
 * premier compte créé. L'écran dit à chacun ce qu'il regarde.
 */
async function handleAudit(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  url: URL,
): Promise<void> {
  const qui = await demandeur(req, url);
  if (!qui) return send(res, 401, sansSeance());

  const jour = url.searchParams.get("jour") ?? undefined;
  /*
   * `Number("abc")` vaut NaN, et `slice(-NaN)` rend le tableau entier : la
   * borne de 1000 ne tenait qu'aux appelants bien élevés. On retombe donc sur
   * la valeur par défaut dès que le paramètre n'est pas un nombre.
   */
  const demandee = Number(url.searchParams.get("limite") ?? 200);
  const limite = Number.isFinite(demandee)
    ? Math.min(Math.max(Math.trunc(demandee), 1), 1000)
    : 200;
  /*
   * On lit large puis on filtre : les entrées sont mêlées dans le fichier, et
   * ne garder que les `limite` dernières avant de filtrer rendrait une liste
   * presque vide à quelqu'un dont les collègues ont beaucoup travaillé.
   */
  const role = await origineDuRole(qui.userId);
  const toutes = lireAudit(role ? limite : 5000, jour);
  const visibles = role
    ? toutes
    : toutes.filter((e) => e.qui === qui.userId || e.qui === "systeme").slice(-limite);
  send(res, 200, {
    jours: joursAudit(),
    entrees: visibles,
    integrite: verifierAudit(jour),
    conservationJours: conservationJours(),
    // L'écran doit pouvoir dire si l'on regarde tout, ou seulement les siennes.
    administrateur: role,
  });
}

/** Séances ouvertes du compte connecté, et fermeture de l'une d'elles. */
async function handleSessionsList(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  url: URL,
): Promise<void> {
  const qui = await demandeur(req, url);
  if (!qui) return send(res, 401, sansSeance());

  const entete = req.headers["x-helix-session"];
  const token = typeof entete === "string" ? entete : entete?.[0];
  const courante = await resolveSession(token);
  send(res, 200, { sessions: await listSessions(qui.userId, courante?.hash) });
}

async function handleSessionRevoke(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  url: URL,
): Promise<void> {
  const qui = await demandeur(req, url);
  if (!qui) return send(res, 401, sansSeance());

  const body = (await readJson(req).catch(() => ({}))) as { id?: string; toutes?: boolean };

  if (body.toutes) {
    const fermees = await revokeAll(qui.userId);
    return send(res, 200, { ok: true, fermees });
  }
  if (!body.id) return send(res, 400, { error: { message: t("`id` est requis.") } });

  const fait = await revokeSession(qui.userId, body.id);
  send(res, fait ? 200 : 404, {
    ok: fait,
    message: fait ? "Séance fermée." : "Séance introuvable.",
  });
}

/** Révisions de toutes les collections : permet à un poste de savoir quoi retirer. */
/**
 * Révision d'une collection telle que les postes la suivent. Qui voit quelle
 * conversation dépend aussi des groupes : un changement de membres doit faire
 * re-tirer les conversations, sans quoi celles partagées au groupe
 * n'apparaîtraient (ou ne disparaîtraient) qu'à la prochaine écriture.
 */
async function revisionVue(c: Collection): Promise<number> {
  const r = await db().revision(c);
  if (c !== "sessions") return r;
  // Des groupes illisibles ne bloquent pas les Chats : leur révision n'entre plus en compte, c'est tout.
  return Math.max(r, await db().revision("groupes").catch(() => 0));
}

/*
 * Une collection abîmée est laissée de côté, pas les autres (relecture du
 * 27/09/2026) : un seul fichier illisible rendait 500 à toute la
 * synchronisation. Absente de la réponse, elle n'est simplement pas relue, et
 * rien n'est écrit par-dessus.
 */
async function handleDataRevisions(res: http.ServerResponse): Promise<void> {
  const entries = await Promise.all(COLLECTIONS.map(async (c) => [c, await revisionVue(c).catch(() => null)] as const));
  send(res, 200, { revisions: Object.fromEntries(entries.filter(([, r]) => r !== null)), shared: true });
}

/* ------------------------------- routes Code ---------------------------------- */

/**
 * `GET /helix/code` : le moteur est-il là, tourne-t-il, et quel dossier
 * proposer. Au jeton seul ; le dossier est celui de la personne si une séance
 * est présentée. Le port d'OpenCode n'est plus rendu (revue du 25/09/2026) :
 * aucun client ne s'en servait.
 */
async function handleCodeStatus(req: http.IncomingMessage, res: http.ServerResponse, url: URL): Promise<void> {
  const qui = await demandeur(req, url);
  if (qui) await dossierCodeDe(qui.userId);
  /*
   * `administrateur` : l'écran Code sans moteur lance l'installation d'office
   * pour l'administrateur, et dit aux autres que c'est à lui de le faire
   * (27/09/2026). La route d'installation le revérifie, bien sûr.
   */
  send(res, 200, { ...(await codeStatus(qui?.userId)), administrateur: qui ? await estAdministrateur(qui.userId) : false });
}

/**
 * Le dossier de projet proposé à une personne pour une nouvelle session : son
 * dernier choix (mémoire), sinon le dossier de sa dernière session (registre,
 * utile après un redémarrage), sinon celui de l'instance. Jamais celui d'une
 * autre personne.
 */
async function dossierCodeDe(userId: string): Promise<string> {
  const choisi = projectDir(userId);
  if (choisi !== dossierCodeParDefaut()) return choisi;
  const derniere = (await sessionsCodeDe(userId).catch(() => []))[0]?.dossier;
  if (derniere && validerDossier(derniere).ok) {
    setProjectDir(userId, derniere);
    return derniere;
  }
  return choisi;
}

/** Ouvre une session OpenCode dans le dossier de projet. */
/** Parcours des dossiers, pour choisir où un agent travaille. */
async function handleDossiers(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  url: URL,
): Promise<void> {
  const qui = await demandeur(req, url);
  if (!qui) return send(res, 401, sansSeance());
  const courant = await dossierCodeDe(qui.userId);
  send(res, 200, {
    ...listerDossiers(url.searchParams.get("chemin") ?? courant),
    courant,
  });
}

async function handleVps(req:http.IncomingMessage,res:http.ServerResponse,url:URL):Promise<void>{
 const qui=await demandeur(req,url);if(!qui)return send(res,401,sansSeance());
 if(!await estAdministrateur(qui.userId))return send(res,403,{error:{message:t("Seul l'administrateur peut connecter un VPS.")}});
 try{if(req.method==='GET')return send(res,200,{projets:await vps.projetsVps(qui.userId)});
 const b=await readJson(req,4096) as Record<string,unknown>;
 if(b.action==='tester'){const controle=new AbortController();res.on('close',()=>controle.abort());return send(res,200,await vps.testerVps(qui.userId,String(b.id),controle.signal))}
 if(b.action==='retirer'){await vps.retirerVps(qui.userId,String(b.id));journaliser("donnees.ecrites",qui.userId,{collection:"code.vps",action:"retirer"});return send(res,200,{ok:true})}
 const projet=await vps.enregistrerVps(qui.userId,b);journaliser("donnees.ecrites",qui.userId,{collection:"code.vps",action:"ajouter",id:projet.id});return send(res,201,projet);
 }catch(e){return send(res,400,{error:{message:e instanceof Error?e.message:t("Connexion SSH interrompue.")}})}
}

async function handleCodeSession(
  req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<void> {
  const body = (await readJson(req).catch(() => ({}))) as {
    model?: string;
    vps?: string;
    dossier?: string;
    /** Niveau de raisonnement choisi à l'écran : devient la variante OpenCode. */
    effort?: string;
  };

  /*
   * Le dossier vient de l'interface : il est validé ici, jamais pris tel quel.
   * Sans cela, un chemin fabriqué donnerait à l'agent de code accès à
   * n'importe quel endroit du disque.
   */
  // La séance est exigée par le tableau `EXECUTION` ; la session s'inscrit à son nom.
  const qui = await demandeur(req, new URL(req.url ?? "/", "http://localhost"));
  if (!qui) return send(res, 401, sansSeance());
  if (body.vps && (!(await estAdministrateur(qui.userId)) || !(await vps.projetsVps(qui.userId)).some(p => p.id === body.vps))) return send(res,403,{error:{message:t("Serveur introuvable.")}});
  if (body.dossier) {
    const verdict = validerDossier(body.dossier);
    if (!verdict.ok) return send(res, 400, { error: { message: verdict.raison } });
    // Le choix de cette personne, et d'elle seule (revue du 25/09/2026 : il était commun à l'instance).
    setProjectDir(qui.userId, verdict.chemin);
    journaliser("donnees.ecrites", qui.userId, {
      collection: "code.dossier",
      dossier: verdict.chemin,
    });
  }

  /*
   * Le modèle est **toujours** nommé, même quand l'interface n'en demande
   * aucun en particulier.
   *
   * Sans cette ligne, la session partait sans modèle et OpenCode choisissait
   * lui-même. Mesuré le 20/09/2026 sur le poste du client : chaque prompt de
   * l'écran Code rendait « Provider request failed with HTTP 401 :
   * missing_api_key ». OpenCode n'avait pas retenu le fournisseur « helix »
   * écrit dans `opencode.json` et tombait sur un fournisseur distant, sans clé.
   *
   * Deux raisons de nommer le modèle plutôt que de réparer la configuration :
   * c'est la passerelle qui décide du moteur (ADR-001), et un client qui
   * choisit seul peut choisir un service tiers — c'est-à-dire envoyer le code
   * du client hors de sa machine. On ne laisse pas cette porte ouverte, même
   * refermée par une liste de fournisseurs désactivés.
   */
  /*
   * Le modèle choisi à l'écran arrive sous son identifiant d'interface
   * (« lmstudio/qwen3-8b ») : OpenCode, lui, connaît le nom du modèle
   * (`writeConfig`). Le passer tel quel faisait redémarrer OpenCode sur un
   * modèle « absent », puis refuser la session. D'où la résolution ici.
   */
  const reglage = await reglageCode(body.model, body.effort, qui.userId);
  if ("erreur" in reglage) return send(res, 503, { error: { message: reglage.erreur } });
  const modele = reglage.modele;

  // Un modèle apparu depuis le démarrage d'OpenCode : il faut le lui faire relire.
  if (!(await assurerModeleCode(modele))) {
    return send(res, 503, {
      error: {
        message: tf(
          "L'agent de code ne dispose pas du modèle « {0} ». Choisissez-en un autre, ou vérifiez que LM Studio le sert.",
          modele,
        ),
      },
    });
  }

  /*
   * Session de l'**ancienne** API d'OpenCode : c'est la seule qui propose au
   * modèle les outils MCP, donc les connecteurs de l'instance (outilsCode.ts).
   * La passerelle traduit son flux dans celui qu'attendent les clients
   * (fluxCode.ts). Le modèle part avec chaque demande (`refModele`).
   */
  const dossier = body.dossier ? projectDir(qui.userId) : await dossierCodeDe(qui.userId);
  const creation = await creerSessionCode(dossier, modele, reglage.variante);
  if ("erreur" in creation) return send(res, creation.statut, { error: { message: creation.erreur } });
  /*
   * La session entre dans la liste de sa propriétaire (sessionsCode.ts),
   * séparée des Chats. Le registre fait foi pour l'accès : une session qu'il
   * n'a pas notée ne s'ouvrirait pour personne, on le dit tout de suite.
   */
  try {
    await noterSessionCode({ id: creation.id, userId: qui.userId, dossier, modele, variante: reglage.variante, vps: body.vps });
  } catch (err) {
    console.error("[code] session non notée au registre :", err instanceof Error ? err.message : err);
    return send(res, 503, { error: { message: t("Le registre des sessions de code est illisible : la session n'a pas pu être ouverte.") } });
  }
  // Même forme de réponse qu'avant (`data.id`) : l'écran, la ligne de commande et l'extension la lisent.
  send(res, 200, { data: { id: creation.id } });
}

/**
 * Cette personne peut-elle utiliser cette session (demande, arrêt, flux) ?
 * Rend la session du registre, ou le refus à renvoyer.
 *
 * Le registre (sessionsCode.ts) **fait foi**, et le contrôle échoue fermé.
 * Revue de sécurité du 25/09/2026 : une session absente du registre (ouverte
 * avant lui, retirée de la liste, sortie par la borne, sous-agent) ou un
 * registre illisible donnaient l'accès à toute séance. Désormais : registre
 * illisible, 503 ; session inconnue du registre ou d'une autre personne, 403.
 * Les sessions ouvertes avant le 25/09/2026 n'ont pas de propriétaire et ne
 * s'ouvrent plus par ces routes (voulu, SECURITE.md § 22.4).
 */
async function refusSessionCode(
  sessionID: string,
  userId: string | undefined,
): Promise<{ session: SessionCodeInscrite } | { statut: number; message: string }> {
  let s: SessionCodeInscrite | undefined;
  try {
    s = await sessionCode(sessionID);
  } catch {
    return { statut: 503, message: t("Le registre des sessions de code est illisible : l'accès aux sessions est refusé tant qu'il ne se relit pas.") };
  }
  if (!s) return { statut: 403, message: t("Cette session de code n'est inscrite au nom de personne sur cette instance.") };
  if (!userId || s.userId !== userId) return { statut: 403, message: t("Cette session de code appartient à une autre personne.") };
  return { session: s };
}

/** `GET /helix/code/sessions` : les sessions de Code de la personne, la plus récente d'abord. */
async function handleCodeSessions(res: http.ServerResponse, userId: string): Promise<void> {
  try {
    const liste = await sessionsDe(userId);
    send(res, 200, {
      // `enCours` : l'agent ou Helix y travaille encore (fluxCode.ts), pour l'indicateur de la liste.
      sessions: liste.map((s) => ({ id: s.id, titre: s.titre, dossier: s.dossier, vps: s.vps, creee: s.creee, maj: s.maj, enCours: auTravailCode(s.id) })),
    });
  } catch (err) {
    send(res, 500, { error: { message: err instanceof Error ? err.message : String(err) } });
  }
}

/**
 * `GET /helix/code/sessions/<id>` : l'historique d'une session, relu chez
 * OpenCode, pour la rouvrir. `enCours` : l'agent y travaille encore ;
 * `dernier` : le dernier numéro d'évènement vu par la passerelle, pour suivre
 * la suite sans rien rejouer.
 */
async function handleCodeSessionHistorique(res: http.ServerResponse, userId: string, id: string): Promise<void> {
  const s = await sessionCode(id).catch(() => undefined);
  if (!s || s.userId !== userId) return send(res, 404, { error: { message: t("Session de code inconnue.") } });
  try {
    const d = encodeURIComponent(s.dossier);
    /*
     * Le dernier numéro est lu AVANT l'historique : ce qui arrive entre les
     * deux est rejoué par le flux plutôt que perdu (27/09/2026). Lu après, un
     * texte fini pendant la lecture n'était ni dans l'historique ni rejoué.
     */
    const dernier = dernierNumeroCode(id);
    const [messages, etat] = await Promise.all([
      codeApi(`/session/${id}/message?directory=${d}`),
      codeApi(`/session/status?directory=${d}`).catch(() => undefined),
    ]);
    if (!messages.ok) {
      await messages.text().catch(() => "");
      return send(res, messages.status === 404 ? 404 : 502, { error: { message: t("L'agent de code n'a pas rendu cette session.") } });
    }
    const brut = (await messages.json().catch(() => [])) as unknown;
    const statuts = etat?.ok ? ((await etat.json().catch(() => ({}))) as Record<string, { type?: string } | undefined>) : {};
    // La passerelle retrouve le dossier et le modèle de la session après un redémarrage.
    if (!modeleDeSession.has(id)) modeleDeSession.set(id, { modele: s.modele, variante: s.variante, dossier: s.dossier });
    if (!sessionCodeSuivie(id)) suivreSessionCode(id, s.dossier);
    await ecouterDossierCode(s.dossier).catch(() => {});
    /*
     * En cours : OpenCode le dit, ou la passerelle le sait (Helix prépare,
     * contrôle ou envoie ; tour ouvert vu dans le flux). OpenCode au repos et
     * Helix sans travail : un tour qu'on croyait ouvert a perdu sa fin.
     */
    const occupeChezOpenCode = Boolean(statuts[id] && statuts[id]!.type !== "idle");
    if (etat?.ok && !occupeChezOpenCode && !helixAuTravailCode(id)) reposConfirmeCode(id);
    const enCours = occupeChezOpenCode || auTravailCode(id);
    const attente = demandesCodeEnCours.get(id);
    send(res, 200, {
      session: { id: s.id, titre: s.titre, dossier: s.dossier, vps: s.vps, creee: s.creee, maj: s.maj },
      messages: historiqueCode(Array.isArray(brut) ? brut : [], {
        enCours,
        demandeEnAttente: attente && !attente.envoyee ? attente.texte : undefined,
      }),
      enCours,
      dernier,
    });
  } catch (err) {
    send(res, 502, { error: { message: err instanceof Error ? err.message : String(err) } });
  }
}

/**
 * Ouvre une session de Helix Code et la fait suivre par la passerelle, avant
 * toute demande : `/event` ne rejoue rien, un évènement émis avant l'écoute
 * serait perdu.
 */
async function creerSessionCode(
  dossier: string,
  modele: string,
  variante: string | undefined,
): Promise<{ id: string } | { erreur: string; statut: number }> {
  const upstream = await codeApi(`/session?directory=${encodeURIComponent(dossier)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  const corps = (await upstream.json().catch(() => ({}))) as { id?: unknown };
  const id = typeof corps.id === "string" && SESSION_CODE.test(corps.id) ? corps.id : undefined;
  if (!upstream.ok || !id) {
    return { erreur: t("L'agent de code n'a pas ouvert de session."), statut: upstream.ok ? 502 : upstream.status };
  }
  modeleDeSession.set(id, { modele, variante, dossier });
  suivreSessionCode(id, dossier);
  try {
    await ecouterDossierCode(dossier);
  } catch {
    return { erreur: t("Flux d'événements indisponible."), statut: 502 };
  }
  return { id };
}

/**
 * Modèle, niveau et dossier de chaque session de l'écran Code : de quoi en
 * rouvrir une identique (relance), et savoir si le réglage a changé depuis.
 */
const modeleDeSession = new Map<string, { modele: string; variante?: string; dossier: string }>();

/**
 * Le modèle et la variante qu'une demande de l'écran Code doit utiliser.
 * `model` absent : celui que l'instance choisit pour le code.
 */
async function reglageCode(
  model: string | undefined,
  effort: string | undefined,
  /**
   * La propriétaire de la session : ses modèles branchés par clé personnelle
   * en font partie. Sans elle (avant le 27/09/2026), choisir dans Code un
   * modèle de sa propre clé rendait « modèle inconnu ou réservé à la personne
   * qui a branché sa clé », à cette personne même.
   */
  acces: string | undefined,
): Promise<{ modele: string; variante?: string } | { erreur: string }> {
  const choix = await resolve(model ? { model, acces } : { role: "code", acces });
  if ("error" in choix) {
    /*
     * Tournée finale du 28/09/2026 : l'écran affichait « Aucun modèle disponible pour l'écran
     * Code. Aucun modèle disponible pour le rôle « code ». », en français dans toutes les
     * langues, et sans dire quoi faire, alors que le sélecteur, sous la saisie, proposait des
     * modèles (servis pour le Chat, que le mode Auto ne prend pas pour le code). Les autres
     * refus du routeur (modèle imposé absent, modèles branchés par clé) disent déjà la raison.
     */
    if (model) return { erreur: choix.error };
    return {
      erreur:
        choix.error === tf("Aucun modèle disponible pour le rôle « {0} ».", "code")
          ? t("Le mode Auto ne trouve aucun modèle de code sur cette instance. Choisissez un modèle dans le sélecteur, sous la saisie, ou installez un modèle de code sur cette machine.")
          : choix.error,
    };
  }
  return { modele: choix.model.id, variante: varianteDe(effort) };
}

/*
 * Délai au-delà duquel une demande qui n'a pas atteint le modèle est tenue pour
 * perdue. Mesuré le 23/09/2026 sur le poste du client : une demande saine
 * atteint le modèle en 0,1 à 0,2 seconde, même quand la réponse met ensuite
 * vingt secondes à commencer. Huit secondes laissent quarante fois la marge.
 */
const APPEL_MAX_MS = 8000;

async function attendreAppel(texte: string, depuis: number): Promise<boolean> {
  while (Date.now() - depuis < APPEL_MAX_MS) {
    if (agentAAppele(texte, depuis)) return true;
    await new Promise((r) => setTimeout(r, 100));
  }
  return agentAAppele(texte, depuis);
}

/**
 * Forme d'un identifiant de session OpenCode.
 *
 * Il est interpolé dans un chemin d'URL, et `fetch` normalise les segments
 * `..` : sans ce contrôle, `x/../../api/…?` faisait appeler à la passerelle
 * un tout autre point d'entrée de l'API OpenCode, **avec l'en-tête
 * d'autorisation du serveur**, et — sur la route des évènements — renvoyait la
 * réponse telle quelle à l'appelant. C'est-à-dire une lecture libre d'une API
 * qui sait lire des fichiers et lancer des commandes, en contournant la
 * barrière d'approbation.
 */
const SESSION_CODE = /^[A-Za-z0-9_-]{1,64}$/;

/*
 * Contrôle automatique de fin de tour (controleCode.ts) : Helix vérifie ce que
 * l'agent a écrit, essaie les pages, et le relance avec la liste des problèmes
 * tant que ce n'est pas propre. La relance part dans la même session, avec le
 * même modèle, au nom de la même personne ; les clients la suivent dans le même
 * tour (`relanceHelix`, fluxCode.ts).
 */
surFinDeTourCode(async (sessionID, dossier) => {
  const cible = await sessionCode(sessionID).catch(() => null);
  if (!cible || cible.vps) return;
  // Le contrôle est du travail de la session : l'écran qui y revient la voit en cours (fluxCode.ts).
  const fin = travailHelixCode(sessionID);
  void apresTourCode(
    sessionID,
    dossier,
    async (texte) => {
      const reglage = modeleDeSession.get(sessionID);
      if (!reglage) return false;
      const messageID = idMessageCode();
      noterRelanceHelix(messageID);
      try {
        const reponse = await codeApi(`/session/${sessionID}/prompt_async?directory=${encodeURIComponent(reglage.dossier)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messageID, ...refModele(reglage.modele, reglage.variante), parts: [{ type: "text", text: texte }] }),
        });
        await reponse.text().catch(() => "");
        if (reponse.ok) ouvrirTourCode(sessionID);
        return reponse.ok;
      } catch {
        return false;
      }
    },
    (message) => publierStatutCode(sessionID, { etat: "controle", message }),
  )
    .catch((err) => console.error("[code] contrôle automatique :", err instanceof Error ? err.message : err))
    .finally(fin);
});

/**
 * La demande de la personne, par session, tant que `POST /helix/code/prompt`
 * la traite (27/09/2026). `envoyee` : partie chez OpenCode, qui la rend
 * désormais dans l'historique. Avant, pendant que Helix prépare une
 * application ou un plan, OpenCode ne l'a pas : l'historique relu pour
 * l'écran qui revient sur la session l'ajoute (sessionsCode.ts).
 */
const demandesCodeEnCours = new Map<string, { texte: string; envoyee: boolean }>();

/** La demande est prise en charge : la session est « en cours » jusqu'à la réponse de la route. */
function prendreDemandeCode(sessionID: string, texte: string): { envoyee: () => void; fin: () => void } {
  const finTravail = travailHelixCode(sessionID);
  const demande = { texte, envoyee: false };
  demandesCodeEnCours.set(sessionID, demande);
  return {
    envoyee: () => {
      demande.envoyee = true;
    },
    fin: () => {
      finTravail();
      if (demandesCodeEnCours.get(sessionID) === demande) demandesCodeEnCours.delete(sessionID);
    },
  };
}

async function handleCodePrompt(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  // Rendues quoi qu'il arrive : une session ne reste pas « en cours » pour une demande qui a échoué.
  const prises: { envoyee: () => void; fin: () => void }[] = [];
  try {
    await traiterCodePrompt(req, res, (sessionID, texte) => {
      const prise = prendreDemandeCode(sessionID, texte);
      prises.push(prise);
      return prise;
    });
  } finally {
    for (const prise of prises) prise.fin();
  }
}

async function traiterCodePrompt(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  prendre: (sessionID: string, texte: string) => { envoyee: () => void },
): Promise<void> {
  const body = (await readJson(req).catch(() => ({}))) as {
    sessionID?: string;
    text?: string;
    /** Réglages de l'écran au moment de l'envoi ; absents : ceux de la session. */
    model?: string;
    effort?: string;
    /** Réglage RTK de l'écran Code (rtk.ts) : « cloud » (défaut), « toujours » ou « jamais ». */
    rtk?: unknown;
  };
  if (!body.sessionID || !body.text) {
    return send(res, 400, { error: { message: t("`sessionID` et `text` sont requis.") } });
  }
  if (!SESSION_CODE.test(body.sessionID)) {
    return send(res, 400, { error: { message: t("`sessionID` invalide.") } });
  }
  /*
   * La personne a changé de modèle ou de niveau depuis l'ouverture de la
   * session : la demande part avec le nouveau réglage. Sans cela, le
   * sélecteur changeait d'affichage et la demande partait sur l'ancien réglage.
   * L'ancienne API d'OpenCode prend le modèle à chaque demande : il suffit de
   * le retenir.
   */
  const envoyeur = await demandeur(req, new URL(req.url ?? "/", "http://localhost"));
  const acces = await refusSessionCode(body.sessionID, envoyeur?.userId);
  if ("statut" in acces) return send(res, acces.statut, { error: { message: acces.message } });
  const notee = acces.session;
  // Dès ici, la session travaille : l'écran qui la quitte puis y revient la retrouve, message compris.
  const prise = prendre(body.sessionID, body.text);
  /*
   * Session inconnue de la mémoire (ouverte avant un redémarrage de la
   * passerelle) : son dossier et son modèle viennent du registre. Le dossier
   * d'une session est toujours le sien, jamais celui qu'une personne a choisi
   * depuis pour une nouvelle.
   */
  if (!modeleDeSession.has(body.sessionID)) {
    modeleDeSession.set(body.sessionID, { modele: notee.modele, variante: notee.variante, dossier: notee.dossier });
  }
  let connue = modeleDeSession.get(body.sessionID);
  if (!connue || body.model !== undefined || body.effort !== undefined) {
    const voulu = await reglageCode(body.model, body.effort, notee.userId);
    if ("erreur" in voulu) return send(res, 503, { error: { message: voulu.erreur } });
    if (!connue || voulu.modele !== connue.modele || voulu.variante !== connue.variante) {
      if (!(await assurerModeleCode(voulu.modele))) {
        return send(res, 503, {
          error: {
            message: tf(
              "L'agent de code ne dispose pas du modèle « {0} ». Choisissez-en un autre, ou vérifiez que LM Studio le sert.",
              voulu.modele,
            ),
          },
        });
      }
      connue = { dossier: connue?.dossier ?? notee.dossier, modele: voulu.modele, variante: voulu.variante };
      modeleDeSession.set(body.sessionID, connue);
    }
  }
  const reglageEnvoi = connue;
  /*
   * La passerelle écoute le dossier avant d'envoyer (`/event` ne rejoue rien) ;
   * `assurerModele` a pu redémarrer OpenCode, et l'écoute avec lui.
   */
  if (!sessionCodeSuivie(body.sessionID)) suivreSessionCode(body.sessionID, reglageEnvoi.dossier);
  try {
    await ecouterDossierCode(reglageEnvoi.dossier);
  } catch {
    return send(res, 502, { error: { message: t("Flux d'événements indisponible.") } });
  }
  /*
   * Un connecteur branché ou retiré depuis, ou une bibliothèque qui a reçu
   * son premier document : OpenCode relit la liste des outils (outilsCode.ts),
   * établie pour la personne qui envoie.
   */
  await rafraichirOutilsCode(reglageEnvoi.dossier, envoyeur?.userId);
  // Titre (première demande) et date de la session dans la liste de Code.
  void toucherSessionCode(body.sessionID, body.text, { modele: reglageEnvoi.modele, variante: reglageEnvoi.variante }).catch(() => {});

  /*
   * Une demande de site : Helix pose d'abord un design professionnel dans le
   * projet (design.ts), et la demande part avec la consigne de s'en servir.
   * Un petit modèle ne sait pas dessiner ; il sait suivre un guide.
   */
  const cibleVps = notee.vps ? (await vps.projetsVps(notee.userId)).find(p=>p.id===notee.vps) : null;
  if (notee.vps && !cibleVps) return send(res,409,{error:{message:t("Serveur introuvable.")}});
  let texteEnvoye = body.text;
  // Une demande de la personne : le contrôle automatique repart de zéro (controleCode.ts). Avant la
  // préparation d'une application : les fichiers que Helix y écrit comptent parmi ceux à essayer.
  nouvelleDemandeCode(body.sessionID);
  /*
   * Une application de gestion dans un dossier neuf : Helix la fait en
   * plusieurs étapes (application.ts), le plan et les exemples par le modèle,
   * l'interface par Helix, et l'agent n'écrit plus que les règles du métier.
   * Plusieurs minutes avec un petit modèle : l'écran suit chaque étape.
   */
  let preparee = false;
  if (!cibleVps && estApplication(body.text) && !applicationPreparee(reglageEnvoi.dossier) && !projetDejaCommence(reglageEnvoi.dossier)) {
    const statut = (message: string) => publierStatutCode(body.sessionID!, { etat: "preparation", message });
    try {
      const qui = await demandeur(req, new URL(req.url ?? "/", "http://localhost"));
      statut(t("Helix prépare l'application : choix du design..."));
      const design = await choisirDesign(body.text, qui?.userId ?? "code").catch(() => undefined);
      const plan = await planifierApplication(body.text, qui?.userId ?? "code", statut);
      if (plan && !demandeArretee(body.sessionID)) {
        statut(t("Helix prépare l'application, étape 3 sur 4 : l'interface complète..."));
        const ecrits = ecrireApplication(reglageEnvoi.dossier, plan, design);
        texteEnvoye = body.text + consigneApplication(plan, reglageEnvoi.dossier);
        preparee = true;
        statut(t("Helix prépare l'application, étape 4 sur 4 : l'agent de code ajoute les règles du métier..."));
        console.log(`[code] application préparée : ${plan.nom}, ${plan.modules.length} parties, ${ecrits.length} fichiers.`);
      } else if (!plan) {
        console.log("[code] plan d'application inutilisable : la demande part avec le design seul.");
      }
    } catch (err) {
      console.log(`[code] application non préparée : ${err instanceof Error ? err.message : String(err)}`);
    }
    // Arrêtée pendant la préparation : rien n'est envoyé à l'agent.
    if (demandeArretee(body.sessionID)) return send(res, 200, { data: {} });
  } else if (!cibleVps && estApplication(body.text) && applicationPreparee(reglageEnvoi.dossier)) {
    // La suite d'une application déjà préparée : l'agent garde la même méthode.
    texteEnvoye = body.text + consigneApplication(null, reglageEnvoi.dossier);
    preparee = true;
  }
  if (!cibleVps && !preparee && estDemandeDeSite(body.text)) {
    try {
      const qui = await demandeur(req, new URL(req.url ?? "/", "http://localhost"));
      const prepare = await preparerDesign(reglageEnvoi.dossier, body.text, qui?.userId ?? "code", { application: estApplication(body.text) });
      texteEnvoye = body.text + prepare.consigne;
      if (prepare.design) console.log(`[code] design préparé : ${prepare.design.produit}, ${prepare.design.style}, ${prepare.design.polices.nom}.`);
    } catch (err) {
      console.log(`[code] design non préparé : ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /*
   * Le séquençage (sequenceCode.ts) : une demande composée, avec un petit ou un
   * moyen modèle, est faite étape par étape, et Helix tient le fil. Un grand
   * modèle, une question ou une réplique partent tels quels (`strategie`,
   * plan.ts). Une application de gestion a déjà ses étapes (application.ts).
   */
  if (!cibleVps && !preparee && !estQuestionSimple(body.text) && !estReplique(body.text)) {
    // Au nom de la propriétaire de la session : un modèle de clé personnelle est le sien (revue du 28/09/2026).
    const choix = await resolve({ model: reglageEnvoi.modele, acces: notee.userId });
    const regime = "error" in choix ? null : strategie({ params: choix.model.params, sizeBytes: choix.model.sizeBytes, backendKind: choix.model.backendKind });
    if (regime?.decoupe) {
      const statut = (message: string) => publierStatutCode(body.sessionID!, { etat: "preparation", message });
      const qui = await demandeur(req, new URL(req.url ?? "/", "http://localhost"));
      const etapes = await planifierCode(body.text, reglageEnvoi.dossier, qui?.userId ?? "code", reglageEnvoi.modele, statut);
      if (demandeArretee(body.sessionID)) return send(res, 200, { data: {} });
      if (etapes) {
        demarrerSequence(body.sessionID, body.text, reglageEnvoi.dossier, etapes);
        texteEnvoye += consignePremiereEtape(body.sessionID);
        statut(tf("Plan de Helix : {0} étapes. Étape 1 : {1}", etapes.length, etapes[0]!.titre));
        console.log(`[code] plan : ${etapes.length} étapes (${regime.raison}).`);
      }
    }
  }
  // La carte du projet (carteProjet.ts) : ce qui existe déjà, pour n'appeler que ce qui existe.
  if (!cibleVps && !preparee) texteEnvoye += blocCarte(reglageEnvoi.dossier, 4000);
  // La méthode qui rend un petit modèle juste du premier coup (controleCode.ts), pour toute demande.
  if (cibleVps) texteEnvoye = `Projet distant SSH choisi par la personne : ${JSON.stringify({serveur:cibleVps.id,nom:cibleVps.nom,dossier:cibleVps.dossier})}. Utilise vps__executer avec cet identifiant serveur pour lire, modifier, utiliser Git et lancer les tests sur le VPS. Les outils de fichiers et de commandes locaux ne concernent pas ce projet et sont interdits. Si SSH échoue, explique l’erreur sans travailler à la place sur le disque local.

` + texteEnvoye;
  texteEnvoye += (cibleVps ? "\n\nVérifie les changements avec les tests du projet exécutés sur le VPS via SSH. Rapporte les résultats réels et les fichiers modifiés." : METHODE_CODE) + consigneLangue(body.text);

  /*
   * Qui envoie cette demande : les connecteurs que l'agent de code appellera
   * pendant ce tour travailleront pour cette personne, et c'est à elle que
   * les cartes d'accord iront (outilsCode.ts). Noté avant l'envoi : le premier
   * appel d'outil peut arriver avant la réponse d'OpenCode.
   */
  const auteur = await demandeur(req, new URL(req.url ?? "/", "http://localhost"));
  const dossierDemande = reglageEnvoi.dossier;
  if (auteur) noterDemandeCode(body.sessionID, auteur.userId, dossierDemande);
  // Les compétences de la personne, après la méthode de travail (competences.ts, 23/10/2026) : du texte, rien qui s'exécute.
  if (auteur) texteEnvoye += await competences.consignePourCode(auteur.userId, body.text);
  // Les accords donnés aux outils d'OpenCode valent pour un tour (permissionsCode.ts).
  nouveauTourCode(body.sessionID);
  /*
   * RTK dans cette session, pour ce tour (rtk.ts) : d'office avec un modèle
   * cloud, à la demande de Medhi (28/09/2026) ; avec un modèle local si la
   * personne l'a choisi. Décidé ici, avant l'envoi : la première commande
   * peut suivre de près. Les commandes passent toujours d'abord par la barrière.
   *
   * Au nom de la propriétaire de la session, comme `reglageCode` (revue du
   * 28/09/2026) : sans `acces`, le routeur écarte les modèles branchés par clé
   * personnelle, l'origine restait inconnue, et un modèle cloud de clé
   * personnelle partait sans RTK en réglage « cloud ».
   */
  const choixRtk = await resolve({ model: reglageEnvoi.modele, acces: notee.userId });
  const rtkActif = rtkPourDemande(lireReglageRtk(body.rtk), "error" in choixRtk ? undefined : choixRtk.model.origine);
  noterRtkSession(body.sessionID, rtkActif);

  /*
   * `prompt_async` rend la main tout de suite (204), comme le faisait la
   * nouvelle API. L'identifiant du message est choisi ici, au format
   * d'OpenCode, et rendu aux clients (`data.id`) : c'est par lui qu'ils
   * reconnaissent leur demande dans le flux (`session.next.prompted`).
   */
  const envoyer = async (session: string, reglage: { modele: string; variante?: string; dossier: string }) => {
    const messageID = idMessageCode();
    const reponse = await codeApi(
      `/session/${session}/prompt_async?directory=${encodeURIComponent(reglage.dossier)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messageID,
          ...refModele(reglage.modele, reglage.variante),
          parts: [{ type: "text", text: texteEnvoye }],
        }),
      },
    );
    await reponse.text().catch(() => "");
    return { ok: reponse.ok, statut: reponse.status, messageID };
  };

  let envoi = Date.now();
  const upstream = await envoyer(body.sessionID, reglageEnvoi);
  if (upstream.ok) prise.envoyee();

  /*
   * La demande a-t-elle atteint le modèle ?
   *
   * OpenCode rate parfois la première session après son démarrage : il
   * accepte la demande, puis ne l'exécute jamais, sans rien émettre (voir
   * `chauffer`, opencode.ts). La passerelle le voit, puisque c'est elle qui
   * relaie l'appel au modèle : sans cet appel au bout de huit secondes, la
   * session est perdue. On en ouvre une identique et on y renvoie la demande,
   * une fois. L'écran apprend le nouvel identifiant par `helixRelance` et s'y
   * abonne.
   *
   * Un premier guet, posé côté écran, attendait « la première étape » et la
   * croyait immédiate. Elle ne l'est pas : elle vient après la lecture des
   * instructions d'OpenCode par le modèle, jusqu'à vingt secondes plus tard.
   * Ce guet-là aurait relancé des demandes simplement lentes, en double.
   */
  if (upstream.ok && !(await attendreAppel(body.text, envoi))) {
    /*
     * Le modèle de la session perdue ; à défaut — session ouverte avant un
     * redémarrage de la passerelle —, celui qu'elle choisirait pour le code.
     */
    // Perdue : rien n'y travaille, même si OpenCode y a noté la demande.
    fermerTourCode(body.sessionID);
    const perdue = modeleDeSession.get(body.sessionID);
    let modele = perdue?.modele;
    if (!modele) {
      const choix = await resolve({ role: "code" });
      if (!("error" in choix)) modele = choix.model.id;
    }
    // Même dossier que la session perdue : le dossier choisi a pu changer depuis.
    const dossier = perdue?.dossier ?? notee.dossier;
    console.log(`[code] demande jamais arrivée au modèle : nouvelle session (${modele ?? "aucun modèle"}).`);
    if (modele) {
      const creation = await creerSessionCode(dossier, modele, perdue?.variante);
      if ("id" in creation) {
        const nouvelle = creation.id;
        if (auteur) noterDemandeCode(nouvelle, auteur.userId, dossier);
        nouveauTourCode(nouvelle);
        noterRtkSession(nouvelle, rtkActif);
        /*
         * La session relancée remplace la perdue dans la liste de Code, avec
         * la même demande pour titre, et à la même propriétaire. La perdue est
         * masquée, pas oubliée : elle reste à sa propriétaire.
         */
        const inscrite = await noterSessionCode({ id: nouvelle, userId: notee.userId, dossier, modele, variante: perdue?.variante, vps: notee.vps, titre: "" }).then(
          () => true,
          () => false,
        );
        if (!inscrite) {
          return send(res, 503, { error: { message: t("Le registre des sessions de code est illisible : la session n'a pas pu être ouverte.") } });
        }
        void toucherSessionCode(nouvelle, body.text).catch(() => {});
        void retirerSessionCode(body.sessionID, notee.userId).catch(() => {});
        envoi = Date.now();
        const priseNouvelle = prendre(nouvelle, body.text);
        const second = await envoyer(nouvelle, { modele, variante: perdue?.variante, dossier });
        if (second.ok) priseNouvelle.envoyee();
        if (second.ok && (await attendreAppel(body.text, envoi))) {
          ouvrirTourCode(nouvelle);
          return send(res, 200, { data: { id: second.messageID }, helixRelance: { sessionID: nouvelle } });
        }
        fermerTourCode(nouvelle);
      }
    }
    return send(res, 502, {
      error: {
        message: t(
          "L'agent de code n'a pas démarré, même après une nouvelle tentative. Réessayez dans un instant ; si cela recommence, fermez puis rouvrez l'application.",
        ),
      },
    });
  }
  if (!upstream.ok) {
    return send(res, upstream.statut >= 400 && upstream.statut < 600 ? upstream.statut : 502, {
      error: { message: t("La demande n'a pas été acceptée par l'agent de code.") },
    });
  }
  // Le modèle a reçu la demande : le tour est ouvert, jusqu'à sa fin vue dans le flux (fluxCode.ts).
  ouvrirTourCode(body.sessionID);
  // Même forme de réponse qu'avec la nouvelle API : `data.id`, l'identifiant du message.
  send(res, 200, { data: { id: upstream.messageID } });
}

async function handleCodeInterrupt(
  req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<void> {
  const body = (await readJson(req).catch(() => ({}))) as { sessionID?: string };
  if (!body.sessionID) return send(res, 400, { error: { message: t("`sessionID` requis.") } });
  if (!SESSION_CODE.test(body.sessionID)) {
    return send(res, 400, { error: { message: t("`sessionID` invalide.") } });
  }
  const qui = await demandeur(req, new URL(req.url ?? "/", "http://localhost"));
  const acces = await refusSessionCode(body.sessionID, qui?.userId);
  if ("statut" in acces) return send(res, acces.statut, { error: { message: acces.message } });
  // Arrêtée par la personne : le contrôle automatique ne relance plus l'agent derrière elle.
  arretDemandeCode(body.sessionID);
  const dossier = acces.session.dossier;
  const upstream = await codeApi(`/session/${body.sessionID}/abort?directory=${encodeURIComponent(dossier)}`, {
    method: "POST",
  });
  send(res, upstream.status, { ok: upstream.ok });
}

/**
 * Relaie le flux d'événements d'une session OpenCode vers l'interface.
 *
 * **Relayer, et rien d'autre.** `codeApi` démarre le serveur OpenCode s'il ne
 * tourne pas : cette route de lecture lançait donc un processus persistant,
 * enraciné sur le dossier de projet, à qui présentait le seul jeton d'instance.
 * Une route qui lit ne doit pas allumer un moteur. Le démarrage reste le rôle
 * de `POST /helix/code/session`, qui exige une séance et valide le dossier.
 *
 * Serveur éteint : on le dit (503) plutôt que de le démarrer. L'interface
 * n'ouvre ce flux qu'après avoir créé une session, donc après le démarrage :
 * le cas ne se présente que pour un appelant qui court-circuite ce chemin.
 */
async function handleCodeEvents(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  sessionID: string,
  url: URL,
): Promise<void> {
  if (!SESSION_CODE.test(sessionID)) {
    return send(res, 400, { error: { message: t("`sessionID` invalide.") } });
  }
  if (!codeEnMarche()) {
    return send(res, 503, {
      error: {
        message:
          "Le moteur de code n'est pas démarré. Ouvrez une session de code " +
          "(POST /helix/code/session) avant d'écouter son flux d'évènements.",
      },
    });
  }

  /*
   * `after` : l'écran qui se réabonne donne le dernier événement reçu, pour
   * ne pas se voir rejouer toute la session.
   */
  const apresBrut = url.searchParams.get("after");
  const apres = apresBrut && /^\d{1,12}$/.test(apresBrut) ? Number(apresBrut) : undefined;

  /*
   * Le flux est celui que la passerelle fabrique (fluxCode.ts) à partir de
   * `/event` d'OpenCode. Une session qu'elle ne suit pas (ouverte avant un
   * redémarrage) n'est suivie que si OpenCode la connaît : un identifiant
   * inventé n'occupe rien.
   */
  const qui = await demandeur(req, url);
  const acces = await refusSessionCode(sessionID, qui?.userId);
  if ("statut" in acces) return send(res, acces.statut, { error: { message: acces.message } });
  const dossier = acces.session.dossier;
  try {
    if (!sessionCodeSuivie(sessionID)) {
      const existe = await codeApi(`/session/${sessionID}?directory=${encodeURIComponent(dossier)}`);
      await existe.text().catch(() => "");
      if (!existe.ok) return send(res, 404, { error: { message: t("Session de code inconnue.") } });
      suivreSessionCode(sessionID, dossier);
    }
    await ecouterDossierCode(dossier);
  } catch {
    return send(res, 502, { error: { message: t("Flux d'événements indisponible.") } });
  }
  res.writeHead(200, entetesFlux(req));
  /*
   * Un commentaire SSE toutes les vingt secondes : invisible pour l'écran,
   * mais une connexion morte se révèle à l'écriture au lieu de passer pour
   * un agent silencieux, et aucun intermédiaire ne ferme un flux muet.
   */
  const veille = setInterval(() => res.write(": veille\n\n"), 20_000);
  /*
   * Fin d'un tour de Code (« step.ended » avec « stop ») : Helix repasse sur
   * les pages du projet, si un design y a été posé (design.ts). Seulement
   * pour un évènement qui arrive, pas pour l'historique rejoué à l'ouverture.
   */
  let enDirect = false;
  const desabonner = abonnerCode(sessionID, apres, (evenement: EvenementCode) => {
    res.write(`data: ${JSON.stringify(evenement)}\n\n`);
    if (enDirect && evenement.type === "session.next.step.ended" && evenement.data.finish === "stop") {
      const dossierTour = dossier;
      setTimeout(() => {
        const n = corrigerPages(dossierTour);
        if (n > 0) console.log(`[code] design : ${n} page(s) remise(s) sur la feuille du projet.`);
      }, 1500);
    }
  });
  enDirect = true;
  const finir = () => {
    clearInterval(veille);
    desabonner();
    res.end();
  };
  req.on("close", finir);
}

/* ------------------------------- routes MCP ----------------------------------- */

async function handleMcpStatus(res: http.ServerResponse): Promise<void> {
  const espaces = workspaces();
  send(res, 200, {
    workspace: workspace(),
    espaces,
    // L'écran doit pouvoir dire « tout votre poste » plutôt que d'aligner des
    // chemins : la portée se reconnaît au dossier personnel en tête.
    toutLePoste: espaces.length > 1 && espaces[0] === homedirDeLHote(),
    // Une application locale arrêtée (Palmier Pro) dit sa raison du moment, dans la langue de qui lit.
    servers: await mcpStatusFrais(),
  });
}

/** Dossier personnel du compte qui fait tourner l'instance. */
// Le dossier personnel seul : `toutLePoste()` interroge aussi chaque disque (D: à Z: sous Windows), et un lecteur réseau hors ligne gelait la requête (audit du 27/09/2026).
const homedirDeLHote = (): string => dossierPersonnel();

/**
 * Change l'espace de travail de Cowork.
 *
 * Le chemin est validé côté instance, avec les mêmes bornes que pour Code :
 * l'agent reste dans le dossier personnel de l'utilisateur.
 */
/**
 * L'instance sert-elle plusieurs personnes ?
 *
 * Deux signes : le profil de déploiement le dit (`share`), ou la passerelle
 * écoute sur le réseau. Sur un poste personnel, aucun des deux, et les gestes
 * qui n'engagent que soi restent sans friction.
 */
const instancePartagee = (): boolean => deployment().share === true || surLeReseau();

async function handleWorkspace(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  url: URL,
): Promise<void> {
  const qui = await demandeur(req, url);
  if (!qui) return send(res, 401, sansSeance());

  const body = (await readJson(req).catch(() => ({}))) as {
    dossier?: string;
    /** « poste » ouvre le dossier personnel et les disques montés d'un coup. */
    portee?: string;
    motDePasse?: unknown;
    code?: unknown;
  };
  const toutLeposte = body.portee === "poste";
  if (!body.dossier && !toutLeposte) {
    return send(res, 400, { error: { message: t("`dossier` ou `portee` est requis.") } });
  }

  /*
   * L'administrateur seul (revue de sécurité du 27/09/2026) : sur une instance
   * partagée, le dossier de l'équipe vaut pour tout le monde, et « Tout mon
   * poste » ouvre le dossier personnel du compte hôte. Un membre qui ne
   * confirmait que son propre mot de passe pouvait ensuite y faire écrire ses
   * agents, jusqu'aux réglages d'autres logiciels qui lancent des programmes.
   */
  if ((instancePartagee() || toutLeposte) && !(await estAdministrateur(qui.userId))) {
    return send(res, 403, { error: { message: t("Seul l'administrateur de l'instance choisit le dossier de l'équipe.") } });
  }

  /*
   * Le dossier de travail est **commun à toute l'instance** : le changer
   * déplace le bac à sable de tous les agents, de tout le monde, d'un coup.
   * Sur un poste personnel, c'est un geste ordinaire — on choisit son dossier,
   * et il n'y a personne d'autre. Sur une instance partagée, c'est le geste
   * qui ouvre à l'équipe entière n'importe quel dossier de la machine hôte :
   * on redemande donc le mot de passe, comme pour le contrôle de l'écran.
   */
  if (instancePartagee()) {
    const refus = await confirmerIdentite(qui.userId, body.motDePasse, body.code);
    if (refus) {
      // Le code permet à l'écran de demander le mot de passe, plutôt que
      // d'afficher un refus sans suite à quelqu'un qui a le droit de le faire.
      return send(res, refus.statut, {
        error: { message: refus.reason, code: "identite-a-confirmer" },
      });
    }
  }

  /*
   * « Tout mon poste » demande le mot de passe, toujours, même sur une machine
   * personnelle où le changement de dossier n'en demande pas.
   *
   * La raison n'est pas la même que pour une instance partagée. Ici, ce qui
   * change, c'est **l'étendue** : l'agent passe d'un dossier à l'ensemble des
   * documents de la personne, disques branchés compris. C'est un geste rare et
   * lourd de conséquences, et un clic de trop vaut mieux qu'une découverte
   * après coup.
   */
  if (toutLeposte && !instancePartagee()) {
    const refus = await confirmerIdentite(qui.userId, body.motDePasse, body.code);
    if (refus) {
      return send(res, refus.statut, {
        error: { message: refus.reason, code: "identite-a-confirmer" },
      });
    }
  }

  let chemins: string[];
  if (toutLeposte) {
    chemins = toutLePoste();
  } else {
    const verdict = validerDossier(body.dossier as string, "cowork");
    if (!verdict.ok) return send(res, 400, { error: { message: verdict.raison } });
    /*
     * Choisir une zone protégée comme dossier de l'équipe reviendrait à l'ouvrir
     * à tous (zonesProtegees.ts, revue du 25/09/2026) : `~/.helix/data`, `~/.ssh`
     * et leurs voisins ne se désignent pas. Un dossier qui en contient un reste
     * possible (le dossier personnel) : la zone y est alors filtrée partout.
     */
    if (estProtege(verdict.chemin)) {
      return send(res, 400, { error: { message: t("Ce dossier est protégé (données de l'instance, clés, réglages d'autres logiciels) : il ne peut pas devenir le dossier de l'équipe.") } });
    }
    chemins = [verdict.chemin];
  }

  const resultat = await setWorkspace(chemins);
  if (!resultat.ok) {
    return send(res, 500, {
      error: { message: resultat.error ?? "Le serveur de fichiers n'a pas redémarré." },
    });
  }

  journaliser("donnees.ecrites", qui.userId, {
    collection: "cowork.espace",
    dossier: chemins[0],
    ...(toutLeposte ? { portee: "poste", emplacements: chemins.length } : {}),
  });
  send(res, 200, {
    workspace: workspace(),
    espaces: workspaces(),
    toutLePoste: toutLeposte,
    servers: mcpStatus(),
  });
}

async function handleMcpToggle(
  req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<void> {
  const body = (await readJson(req).catch(() => ({}))) as { id?: string; start?: boolean };
  if (!body.id) return send(res, 400, { error: { message: t("`id` est requis.") } });
  if (body.start === false) {
    await stopServer(body.id);
    return send(res, 200, { ok: true, servers: mcpStatus() });
  }
  const result = await startServer(body.id);
  send(res, result.ok ? 200 : 500, { ...result, servers: mcpStatus() });
}

/* --------------------------- routes connecteurs ------------------------------- */

/** Catalogue, connecteurs branchés, et régime de l'instance. Aucun secret. */
async function handleConnecteursEtat(req: http.IncomingMessage, res: http.ServerResponse, url: URL): Promise<void> {
  // L'adresse de retour, telle que « Se connecter » l'enverra au service : l'écran la montre avant le premier essai (28/09/2026).
  send(res, 200, await etatConnecteursPour(req, url));
}

/**
 * L'état des connecteurs pour ce demandeur (16/10/2026) : ce qu'il peut
 * ajouter lui-même (un serveur MCP à lui, administrateur ; un programme de
 * cette machine, administrateur depuis cette machine), et la commande ou
 * l'adresse des serveurs ajoutés, montrées à l'administrateur seulement.
 */
async function etatConnecteursPour(req: http.IncomingMessage, url: URL): Promise<connecteurs.EtatConnecteurs> {
  const qui = await demandeur(req, url).catch(() => null);
  const administrateur = Boolean(qui && (await estAdministrateur(qui.userId)));
  return connecteurs.etat(adresseVue(req) ?? undefined, { administrateur, depuisCePoste: depuisCePoste(req) });
}

/** Un serveur ajouté par l'administrateur (connecteurs.ts) ? Son retrait et ses réglages lui sont réservés. */
const estPersonnalise = (id: string): Promise<boolean> => connecteurs.estConnecteurPersonnalise(id);

/**
 * Ajoute un serveur MCP à la demande de l'administrateur (16/10/2026, demande
 * de Medhi : « créer son propre MCP »). Trois barrières, en plus de la séance :
 *  1. l'administrateur seul (roles.ts) ;
 *  2. jetons en en-têtes seulement, jamais dans l'adresse : l'écran les pose
 *     ainsi, un lien ou un script bricolé non (même règle que l'import depuis
 *     les logiciels du poste, `handleImportLogiciels`) ;
 *  3. un programme de la machine ou un serveur sur sa boucle : depuis cette
 *     machine, instance fermée aux collègues, ou instance réglée par
 *     l'intégrateur (`connecteursLibres`) ; jugé par connecteurs.ts.
 * Sans shell ni code en ligne (mcpPersoRegles.ts). Journal à l'ajout.
 */
async function handleConnecteurPersonnalise(req: http.IncomingMessage, res: http.ServerResponse, url: URL): Promise<void> {
  if (["token", "session", "flux"].some((p) => url.searchParams.has(p))) {
    return send(res, 400, { error: { message: t("Jetons en en-têtes seulement pour cette route, jamais dans l'adresse.") } });
  }
  const qui = await demandeur(req, url);
  if (!qui) return send(res, 401, sansSeance());
  if (await reserveeALAdministration(res, qui, t("Seul l'administrateur de l'instance peut ajouter un serveur MCP : ses outils servent à toute l'instance."))) return;
  const base = adresseVue(req);
  if (!base) return send(res, 400, { error: { message: t("Adresse d'instance illisible.") } });
  const body = await readJson(req).catch(() => null);
  const resultat = await connecteurs.ajouterPersonnalise(body, qui.userId, { depuisCePoste: depuisCePoste(req), base });
  send(res, resultat.ok ? 200 : 400, { ...resultat, etat: await etatConnecteursPour(req, url) });
}

/** L'administrateur marque des outils d'un serveur ajouté « lecture seule » ; les autres demandent l'accord. */
async function handleConnecteurLectures(req: http.IncomingMessage, res: http.ServerResponse, url: URL): Promise<void> {
  const qui = await demandeur(req, url);
  if (!qui) return send(res, 401, sansSeance());
  if (await reserveeALAdministration(res, qui, t("Seul l'administrateur de l'instance peut régler les outils d'un serveur ajouté."))) return;
  const body = (await readJson(req).catch(() => ({}))) as { id?: unknown; lectures?: unknown };
  if (typeof body.id !== "string" || !body.id) return send(res, 400, { error: { message: t("`id` est requis.") } });
  const resultat = await connecteurs.definirLecturesPersonnalisees(body.id, body.lectures, qui.userId);
  send(res, resultat.ok ? 200 : 400, { ...resultat, etat: await etatConnecteursPour(req, url) });
}

/** Groupes d'outils réellement proposés au modèle : ce que le composeur affiche. */
async function handleOutils(res: http.ServerResponse): Promise<void> {
  send(res, 200, { groupes: await connecteurs.groupes() });
}

/**
 * Branche un connecteur.
 *
 * La séance est exigée deux fois plutôt qu'une : par le tableau `EXECUTION` en
 * amont, et ici. Cette route fait tourner un programme de plus sur la machine
 * de l'entreprise ; elle doit pouvoir nommer qui l'a demandé, sans quoi le
 * journal d'audit n'a personne à inscrire.
 */
async function handleConnecteurAjouter(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  url: URL,
): Promise<void> {
  const qui = await demandeur(req, url);
  if (!qui) return send(res, 401, sansSeance());

  const body = await readJson(req).catch(() => null);
  const resultat = await connecteurs.ajouter(body, qui.userId);
  send(res, resultat.ok ? 200 : 400, { ...resultat, etat: await etatConnecteursPour(req, url) });
}

/**
 * Adresse par laquelle le navigateur de la personne atteint cette instance.
 *
 * C'est elle, et pas une adresse configurée quelque part, qui doit servir de
 * retour d'autorisation : le service renverra la personne là où elle était.
 * L'en-tête `Host` vient du client, donc d'un contenu non maîtrisé : on
 * n'accepte qu'un nom d'hôte de forme correcte, pour ne pas construire une
 * adresse de retour arbitraire à partir d'une requête forgée.
 */
function adresseVue(req: http.IncomingMessage): string | null {
  const brut = req.headers.host;
  const hote = typeof brut === "string" ? brut.trim() : "";
  if (!/^[A-Za-z0-9.\-]+(:\d{1,5})?$/.test(hote) && !/^\[[0-9a-fA-F:]+\](:\d{1,5})?$/.test(hote)) {
    return null;
  }
  const schema = tls ? "https" : "http";
  return `${schema}://${hote}`;
}

/**
 * Adresse à laquelle un **autre poste** peut joindre cette instance.
 *
 * Ce n'est pas la même question que `adresseVue`. Celle-là rend l'adresse par
 * laquelle le navigateur courant atteint l'instance, ce qu'il faut pour un
 * retour d'autorisation — le navigateur revient là d'où il est parti. Mais
 * pour une invitation, l'adresse voyage vers **une autre machine** : sur un
 * poste autonome, `Host` vaut « localhost:8787 », et le mail aurait donné à un
 * collègue une adresse qui ne mène qu'à son propre ordinateur.
 *
 * Trois cas, dans cet ordre :
 *  1. l'appelant atteint déjà l'instance par une adresse nommée : c'est la
 *     bonne, il la connaît mieux que nous ;
 *  2. l'instance est ouverte au réseau mais l'appelant passe par la boucle
 *     locale (l'administrateur travaille sur la machine hôte) : on donne le
 *     nom de la machine, celui-là même que porte le certificat ;
 *  3. l'instance n'est pas ouverte au réseau : il n'existe aucune adresse à
 *     donner, et le dire vaut mieux qu'envoyer un mail inutilisable.
 */
function adresseJoignable(req: http.IncomingMessage): string | null {
  const vue = adresseVue(req);
  const hoteVu = vue ? new URL(vue).hostname.toLowerCase() : "";
  const boucle = ["localhost", "127.0.0.1", "::1", "[::1]"].includes(hoteVu);
  /*
   * `Host` est écrit par l'appelant (revue du 26/09/2026) : `Host: evil.tld`
   * faisait partir, de la vraie boîte de l'instance, une invitation dont le
   * lien menait chez un autre, prêt à recueillir le mot de passe du nouveau
   * collègue. Il n'est repris que s'il désigne une adresse que l'instance
   * annonce elle-même.
   */
  const connues = instancePartagee() ? adressesPourLesCollegues(PORT, Boolean(tls)) : [];
  if (vue && !boucle && connues.some((a) => new URL(a).hostname.toLowerCase() === hoteVu)) return vue;
  if (!instancePartagee()) return null;
  /*
   * Surtout pas `hostname()` : sur ce Mac il rend « Mini-de-Clabaut » quand le
   * réseau annonce « Mac-mini-de-Clabaut.local ». Le mail aurait porté une
   * adresse qui ne résout nulle part. `adressePourLesCollegues` ne rend que
   * des noms réellement annoncés, et le certificat les couvre tous.
   */
  return adressePourLesCollegues(PORT, Boolean(tls));
}

/* --------------------------- ouverture au réseau --------------------------- */

/**
 * État de l'ouverture, et l'adresse à donner à un collègue.
 *
 * L'écran doit pouvoir dire trois choses : si l'instance est ouverte, si elle
 * l'est par le profil de déploiement (auquel cas l'interrupteur n'y peut rien),
 * et l'adresse exacte à transmettre.
 */
async function handleReseauEtat(res: http.ServerResponse, qui: Demandeur): Promise<void> {
  const etat = etatReseau();
  const parLeProfil = deployment().share === true || process.env.HELIX_GATEWAY_HOST !== undefined;
  send(res, 200, {
    ouverte: surLeReseau(),
    parLeProfil,
    depuis: etat.depuis ?? null,
    adresse: surLeReseau() ? adressePourLesCollegues(PORT, Boolean(tls)) : null,
    /*
     * Plusieurs adresses, la meilleure d'abord. Une seule ne suffit pas : le
     * nom mDNS ne traverse pas tous les réseaux, et une adresse IP change au
     * gré des baux. La personne essaie, et l'écran le dit.
     */
    adresses: surLeReseau() ? adressesPourLesCollegues(PORT, Boolean(tls)) : [],
    /*
     * Les mêmes, mais nommées : « local » se joint depuis le même Wi-Fi,
     * « prive » depuis n'importe où sur le même réseau privé. L'écran s'en
     * sert pour dire à qui donner quoi, au lieu d'aligner des adresses nues.
     */
    propositions: surLeReseau() ? propositions(PORT, Boolean(tls)) : [],
    chiffre: Boolean(tls),
    administrateur: Boolean(await origineDuRole(qui.userId)),
  });
}

/**
 * Ouvre ou referme l'instance.
 *
 * Ce réglage change la surface de la machine : on redemande le mot de passe,
 * comme pour le contrôle de l'écran ou le palier « libre » d'un agent. Il ne
 * prend effet qu'au redémarrage de la passerelle — l'adresse d'écoute se
 * choisit à l'ouverture du serveur — et c'est l'application qui la relance.
 */
async function handleReseauRegler(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  url: URL,
): Promise<void> {
  const qui = await demandeur(req, url);
  if (!qui) return send(res, 401, sansSeance());

  const body = (await readJson(req).catch(() => ({}))) as {
    ouverte?: unknown;
    motDePasse?: unknown;
    code?: unknown;
  };
  if (typeof body.ouverte !== "boolean") {
    return send(res, 400, { error: { message: t("« ouverte » doit valoir true ou false.") } });
  }
  if (deployment().share === true || process.env.HELIX_GATEWAY_HOST !== undefined) {
    return send(res, 409, {
      error: {
        message:
          "L'ouverture de cette instance est fixée par son profil de déploiement : " +
          "elle ne se règle pas depuis cet écran.",
      },
    });
  }
  /*
   * Seul l'administrateur de l'instance ouvre la porte. Sur un poste
   * personnel, c'est l'unique compte, et la question ne se pose pas.
   */
  if (!(await origineDuRole(qui.userId))) {
    return send(res, 403, {
      error: { message: t("Seule la personne qui administre cette instance peut l'ouvrir.") },
    });
  }
  const refus = await confirmerIdentite(qui.userId, body.motDePasse, body.code);
  if (refus) {
    return send(res, refus.statut, {
      error: { message: refus.reason, code: "identite-a-confirmer" },
    });
  }

  reglerReseau(body.ouverte, qui.userId);
  journaliser("donnees.ecrites", qui.userId, {
    collection: "reseau",
    ouverte: body.ouverte,
  });
  send(res, 200, {
    ouverte: body.ouverte,
    /*
     * L'adresse annoncée est celle qui vaudra **après** le redémarrage :
     * l'instance chiffre dès qu'elle écoute sur le réseau (tls.ts).
     */
    adresse: body.ouverte ? adressePourLesCollegues(PORT, true) : null,
    redemarrageNecessaire: true,
  });
}

/* ------------------------------ invitations ------------------------------ */

/**
 * Invite un collègue : crée un code, et envoie le mail si une boîte est
 * branchée sur l'instance (invitations.ts).
 */
async function handleInviter(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  url: URL,
): Promise<void> {
  const qui = await demandeur(req, url);
  if (!qui) return send(res, 401, sansSeance());

  const body = (await readJson(req).catch(() => ({}))) as { email?: unknown };
  const base = adresseJoignable(req);
  if (!base) {
    return send(res, 409, {
      error: {
        message:
          "Cette instance n'est joignable que depuis cette machine : un collègue ne " +
          "pourrait pas s'y connecter, et l'invitation ne servirait à rien. Ouvrez-la " +
          "à vos collègues dans Réglages, Profil, avant d'inviter.",
      },
    });
  }

  const moi = (await publicAccounts()).find((c) => c.id === qui.userId);
  /*
   * Le mail porte l'adresse principale, et les autres en second recours : le
   * collègue essaie, il n'a rien à comprendre au réseau. Une adresse de moins
   * dans le mail, c'est un échec de plus au moment de se connecter.
   */
  const autres = surLeReseau()
    ? adressesPourLesCollegues(PORT, Boolean(tls)).filter((a) => a !== base)
    : [];
  const resultat = await invitations.inviter(
    body.email,
    qui.userId,
    moi?.fullName?.trim() || "Un collègue",
    base,
    autres,
    await estAdministrateur(qui.userId),
  );
  if (!resultat.ok) return send(res, resultat.statut, { error: { message: resultat.message } });
  send(res, 200, { ...resultat.valeur, adresse: base });
}

/** Invitations en attente, et annulation. Les codes n'en sortent jamais. */
async function handleInvitations(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  url: URL,
): Promise<void> {
  const qui = await demandeur(req, url);
  if (!qui) return send(res, 401, sansSeance());
  // Chacun ne voit et n'annule que les siennes : la liste de toutes désignait qui viser (revue du 26/09/2026).
  const admin = await estAdministrateur(qui.userId);
  // `administrateur` : l'écran des collègues montre « Créer un compte sur ce poste » à lui seul (CreerCompte.tsx, 28/09/2026).
  if (req.method === "GET") return send(res, 200, { invitations: await invitations.enAttente(qui.userId, admin), administrateur: admin });

  const body = (await readJson(req).catch(() => ({}))) as { email?: unknown };
  const r = await invitations.annuler(body.email, qui.userId, admin);
  if (!r.ok) return send(res, r.statut, { error: { message: r.message } });
  send(res, 200, { ok: true, invitations: await invitations.enAttente(qui.userId, admin) });
}

/**
 * Rattache un poste à l'instance avec un code d'invitation.
 *
 * **Route publique, et elle doit l'être** : c'est un poste tout neuf qui
 * appelle, et il n'a précisément rien — ni jeton d'instance, ni séance. C'est
 * le code qui l'autorise, et le code seul : court, lié à une adresse, valable
 * sept jours, bon une fois. Il est aussi le seul endroit du produit qui remet
 * le jeton d'instance, et c'est pour éviter qu'on le dicte au téléphone.
 *
 * Le code n'est pas consommé ici : il l'est à la création du compte, qui est
 * son vrai usage. Un poste rattaché sans compte n'a accès à rien de plus
 * qu'un écran de connexion.
 */
async function handleRejoindre(
  req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<void> {
  const body = (await readJson(req).catch(() => ({}))) as { code?: unknown };
  const verdict = await invitations.verifier(body.code);
  if (!verdict.ok) return send(res, verdict.statut, { error: { message: verdict.message } });

  journaliser("compte.invite", "anonyme", { email: verdict.valeur.email, etape: "poste rattaché" });
  send(res, 200, {
    jeton: instanceToken(),
    email: verdict.valeur.email,
    produit: nomProduit(),
  });
}

/** Lance l'autorisation d'un service distant, ou le branche s'il l'est déjà. */
async function handleConnecteurConnecter(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  url: URL,
): Promise<void> {
  const qui = await demandeur(req, url);
  if (!qui) return send(res, 401, sansSeance());

  const body = (await readJson(req).catch(() => ({}))) as {
    id?: string;
    clientId?: unknown;
    clientSecret?: unknown;
    ecriture?: unknown;
  };
  if (typeof body.id !== "string" || !body.id) {
    return send(res, 400, { error: { message: t("`id` est requis.") } });
  }
  // Trello, Monday, ClickUp, Todoist, Calendly, Zoom : un compte branché parle au nom de toute l'organisation (SECURITE.md § 48).
  if (estMcpProjet(body.id) && (await reserveeALAdministration(res, qui, t("Seul l'administrateur de l'instance peut brancher, débrancher ou configurer ces services : ils agissent au nom de toute l'organisation.")))) return;
  if ((await estPersonnalise(body.id)) && (await reserveeALAdministration(res, qui, t("Seul l'administrateur de l'instance peut retirer ou relancer un serveur MCP ajouté.")))) return;
  const base = adresseVue(req);
  if (!base) return send(res, 400, { error: { message: t("Adresse d'instance illisible.") } });

  const resultat = await connecteurs.connecter(
    body.id,
    qui.userId,
    base,
    {
      clientId: body.clientId,
      clientSecret: body.clientSecret,
    },
    body.ecriture,
  );
  send(res, resultat.ok ? 200 : 400, { ...resultat, etat: await etatConnecteursPour(req, url) });
}

/** Page rendue au navigateur au retour d'une autorisation. */
function pageRetour(titre: string, message: string, reussi: boolean): string {
  const echapper = (t: string) =>
    t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  return `<!doctype html>
<html lang="${langue()}"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${echapper(titre)}</title>
<style>
  :root { color-scheme: light dark; }
  body { margin:0; min-height:100vh; display:flex; align-items:center; justify-content:center;
         font: 16px/1.6 -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
         background:#F9F6EF; color:#161413; }
  @media (prefers-color-scheme: dark) { body { background:#161413; color:#F9F6EF; } }
  main { max-width: 34rem; padding: 2rem; text-align: center; }
  h1 { font-size: 1.25rem; margin: 0 0 .5rem; }
  p { margin: 0; opacity: .8; }
  .marque { font-size: .75rem; letter-spacing:.08em; text-transform: uppercase; opacity:.5; margin-bottom:1.25rem; }
</style></head>
<body><main>
  <p class="marque">${echapper(nomProduit())}</p>
  <h1>${echapper(reussi ? titre : t("Autorisation interrompue"))}</h1>
  <p>${echapper(message)}</p>
</main></body></html>`;
}

/**
 * Retour d'autorisation OAuth.
 *
 * **Route publique**, et elle doit l'être : c'est un navigateur qui arrive
 * depuis le service, sans jeton d'instance ni séance. Ce qui la protège est le
 * `state` — tiré au hasard, retenu au départ de la demande, et sans lequel un
 * code ne mène à rien — plus le vérificateur PKCE, qui n'a jamais quitté
 * l'instance. Elle ne rend aucune donnée : une page à lire, et rien d'autre.
 */
async function handleOauthRetour(
  res: http.ServerResponse,
  url: URL,
): Promise<void> {
  const repondre = (titre: string, message: string, reussi: boolean, statut = 200) => {
    res.writeHead(statut, {
      "Content-Type": "text/html; charset=utf-8",
      ...ENTETES_SECURITE,
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'",
    });
    res.end(pageRetour(titre, message, reussi));
  };

  const erreur = url.searchParams.get("error");
  // Un refus chez LinkedIn ou Meta clôt la demande en cours, si son `state` est le bon (oauthNatif.ts) ; sinon il ne touche à rien.
  if (erreur && natifs.estEtatNatif(url.searchParams.get("state") ?? "")) {
    const r = await natifs.recevoir(url.searchParams, null);
    return repondre(t("Autorisation refusée"), r.message, false, 400);
  }
  if (erreur && commerce.estEtatCommerce(url.searchParams.get("state") ?? "")) {
    const r = await commerce.recevoir(url.searchParams);
    return repondre(t("Autorisation refusée"), r.message, false, 400);
  }
  if (erreur) {
    /*
     * Un message fixe, pas `error_description` : cette page est publique, et
     * n'importe qui pouvait faire afficher son propre texte à l'adresse de
     * l'instance (revue du 26/09/2026). Le code d'erreur, lui, est un mot du
     * protocole, borné.
     */
    const etatRefus = url.searchParams.get("state") ?? "";
    /*
     * La cause probable et le remède, par le code seul (refusOauth.ts,
     * 28/09/2026) : « access_denied » chez Google, c'est le plus souvent un
     * compte absent des utilisateurs de test. L'écran des connecteurs qui
     * attend l'accord le lit aussi, au lieu d'attendre cinq minutes.
     */
    const refus =
      (estEtatCourrier(etatRefus) ? refuserCourrier(etatRefus, erreur) : await connecteurs.refuserAutorisation(etatRefus, erreur)) ??
      tf("Le service a refusé la demande (code : {0}). Recommencez depuis {1}.", erreur.replace(/[^a-z_]/gi, "").slice(0, 40) || "inconnu", nomProduit());
    return repondre(t("Autorisation refusée"), refus, false, 400);
  }

  const code = url.searchParams.get("code");
  const etat = url.searchParams.get("state");
  if (!code || !etat) {
    return repondre(t("Autorisation interrompue"), t("La réponse du service est incomplète."), false, 400);
  }

  /*
   * Deux familles d'autorisations reviennent par cette même adresse : les
   * connecteurs d'outils (MCP) et le courrier. Le `state` porte son origine,
   * et c'est lui qui aiguille — l'alternative aurait été une seconde route
   * publique, c'est-à-dire une seconde surface à protéger.
   */
  // Troisième famille (28/09/2026) : LinkedIn, Facebook, Instagram (oauthNatif.ts), même route publique, même protection.
  // Salesforce, Pipedrive, Zendesk (natifs/commerce.ts) : préfixe « commerce. », même route, même protection.
  if (natifs.estEtatNatif(etat) || commerce.estEtatCommerce(etat)) {
    const r = natifs.estEtatNatif(etat) ? await natifs.recevoir(url.searchParams, null) : await commerce.recevoir(url.searchParams);
    return repondre(
      r.ok ? tf("{0} est branché", r.nom ?? t("Service")) : t("Autorisation interrompue"),
      r.ok ? `${r.message} ${tf("Vous pouvez fermer cette fenêtre et revenir à {0}.", nomProduit())}` : r.message,
      r.ok,
      r.ok ? 200 : 400,
    );
  }

  if (estEtatCourrier(etat)) {
    const r = await acheverCourrier(code, etat);
    if (!r.ok) return repondre(t("Autorisation interrompue"), r.message, false, 400);
    const branchement = await brancherParOauth(r.jetons, r.adresse);
    return repondre(
      branchement.ok ? t("Votre boîte est branchée") : t("Autorisation interrompue"),
      branchement.ok
        ? `${branchement.message} ${tf("Vous pouvez fermer cette fenêtre et revenir à {0}.", nomProduit())}`
        : branchement.message,
      branchement.ok,
      branchement.ok ? 200 : 400,
    );
  }

  const resultat = await connecteurs.acheverAutorisation(code, etat);
  repondre(
    resultat.ok ? tf("{0} est branché", resultat.label ?? t("Service")) : t("Autorisation interrompue"),
    resultat.ok
      ? `${resultat.message} ${tf("Vous pouvez fermer cette fenêtre et revenir à {0}.", nomProduit())}`
      : resultat.message,
    resultat.ok,
    resultat.ok ? 200 : 400,
  );
}

async function handleConnecteurRetirer(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  url: URL,
): Promise<void> {
  const qui = await demandeur(req, url);
  if (!qui) return send(res, 401, sansSeance());

  const body = (await readJson(req).catch(() => ({}))) as { id?: string };
  if (!body.id) return send(res, 400, { error: { message: t("`id` est requis.") } });

  if (estMcpProjet(body.id) && (await reserveeALAdministration(res, qui, t("Seul l'administrateur de l'instance peut brancher, débrancher ou configurer ces services : ils agissent au nom de toute l'organisation.")))) return;
  // Un serveur ajouté par l'administrateur : lui seul le retire (16/10/2026).
  if ((await estPersonnalise(body.id)) && (await reserveeALAdministration(res, qui, t("Seul l'administrateur de l'instance peut retirer ou relancer un serveur MCP ajouté.")))) return;
  const resultat = await connecteurs.retirer(body.id, qui.userId);
  send(res, resultat.ok ? 200 : 400, { ...resultat, etat: await etatConnecteursPour(req, url) });
}

/* ------------------------------ routes usage ---------------------------------- */

/**
 * Consommation du demandeur sur une période.
 *
 * Le compte vient de la séance, jamais de l'URL : aucun paramètre ne permet de
 * demander la consommation d'un autre. Une période inconnue est refusée
 * plutôt que remplacée en silence : l'écran afficherait sinon, sous le titre
 * « aujourd'hui », les chiffres d'un autre intervalle.
 */
async function handleUsage(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  url: URL,
): Promise<void> {
  const qui = await demandeur(req, url);
  if (!qui) return send(res, 401, sansSeance());

  const periode = url.searchParams.get("periode") ?? "mois";
  if (!usage.estPeriode(periode)) {
    return send(res, 400, {
      error: { message: tf("« periode » doit valoir {0}.", usage.PERIODES.join(", ")) },
    });
  }
  send(res, 200, await usage.rapport(qui.userId, periode));
}

/** Renseigne ou retire le tarif d'un modèle distant. Tracé au journal d'audit. */
async function handleUsageTarif(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  url: URL,
): Promise<void> {
  const qui = await demandeur(req, url);
  if (!qui) return send(res, 401, sansSeance());

  const body = await readJson(req).catch(() => null);
  const resultat = await usage.definirTarif(body, qui.userId);
  if (!resultat.ok) return send(res, 400, { error: { message: resultat.raison } });
  send(res, 200, { ok: true });
}

/* ------------------------- routes contrôle de l'écran ------------------------- */

/**
 * État du contrôle de l'écran : mode, autorisations macOS obtenues, et ce qu'il
 * reste à faire. L'interface s'en sert pour guider l'utilisateur plutôt que
 * d'échouer silencieusement au premier clic.
 */
async function handleComputerStatus(res: http.ServerResponse, qui: Demandeur): Promise<void> {
  send(res, 200, {
    ...(await computer.capability()),
    // Les siennes seulement : l'action porte le texte que l'agent va frapper.
    enAttente: computer.pendingApprovals(qui.userId),
    // Ce que l'installation proposerait si aucun modèle de vision n'est là.
    modeleConseille: autoProvisionEnabled() ? recommendVision(detectHardware()) : null,
  });
}

/** Exécution directe d'une action, pour l'essai depuis les réglages. */
async function handleComputerAction(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  url: URL,
): Promise<void> {
  /*
   * Une action sur l'écran doit être rattachée à quelqu'un. Sans séance, sur
   * une instance partagée, n'importe quel poste détenant le jeton pourrait
   * demander une action et se l'approuver lui-même, sans que le journal puisse
   * dire qui.
   */
  const qui = await demandeur(req, url);
  if (!qui) return send(res, 401, sansSeance());

  const body = (await readJson(req).catch(() => ({}))) as computer.Action;
  if (!body?.action) return send(res, 400, { error: { message: t("`action` est requise.") } });
  const result = await computer.request(body, qui.userId);
  send(res, result.ok ? 200 : 400, result);
}

/**
 * Activer ou désactiver le contrôle de l'écran depuis l'interface (voir
 * `reglagesEcran.ts` pour qui le peut, et quand). Activer redemande le mot de
 * passe, et le code si le second facteur est actif : c'est donner à l'agent la
 * souris et le clavier de la machine. Désactiver ne demande rien, resserrer
 * est toujours permis.
 */
async function handleComputerMode(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  url: URL,
): Promise<void> {
  const qui = await demandeur(req, url);
  if (!qui) return send(res, 401, sansSeance());
  const body = (await readJson(req).catch(() => ({}))) as {
    mode?: unknown;
    password?: unknown;
    code?: unknown;
    systeme?: unknown;
  };
  if (body.mode !== "hote" && body.mode !== "sandbox" && body.mode !== "desactive") {
    return send(res, 400, { error: { message: t("`mode` doit valoir « hote », « sandbox » ou « desactive ».") } });
  }
  const possible = modeModifiable(body.mode);
  if (!possible.ok) return send(res, 403, { error: { message: possible.raison } });
  if (body.mode !== "desactive") {
    /*
     * Activer, c'est donner la souris et le clavier de cette machine à un
     * agent : l'administrateur seul, comme « Tout mon poste » (relecture du
     * 27/09/2026). Test d'intrusion du même jour : un membre l'activait avec
     * son propre mot de passe, et c'est à lui qu'allaient ensuite les cartes.
     * Avant le mot de passe : un membre n'a rien à essayer ici.
     */
    if (!(await estAdministrateur(qui.userId))) {
      return send(res, 403, { error: { message: t("Seul l'administrateur de l'instance peut activer le contrôle de l'écran."), code: "ecran_administrateur" } });
    }
    const refus = await confirmerIdentite(qui.userId, body.password, body.code);
    if (refus) return send(res, refus.statut, { error: { message: refus.reason } });
  }
  const avant = configEcran().mode;
  /*
   * Le système de la machine (Linux ou macOS) se choisit avec le mode. En
   * changer quand la machine tourne : l'ancienne s'arrête d'abord.
   */
  if (body.mode === "sandbox" && (body.systeme === "linux" || body.systeme === "macos") && body.systeme !== systemeMachine()) {
    /*
     * Pas pendant une préparation : `demarrerMachine` rendait la préparation
     * en cours, celle de l'ancien système. On choisissait macOS, le bureau
     * Linux finissait de démarrer, et la machine macOS ne démarrait jamais,
     * alors que le système retenu disait macOS.
     */
    if (preparationMachineEnCours()) {
      return send(res, 409, { error: { message: t("La machine est en cours de préparation : attendez qu'elle ait fini.") } });
    }
    if (body.systeme === "macos" && !(await diagnosticMachine()).macos.possible) {
      return send(res, 400, { error: { message: t("Cet ordinateur ne peut pas faire tourner la machine macOS.") } });
    }
    if (avant === "sandbox") await arreterMachine(qui.userId);
    choisirSysteme(body.systeme);
  }
  await definirModeEcran(body.mode, qui.userId);
  /*
   * La machine suit le mode : choisie, elle démarre (en arrière-plan, la
   * progression se lit sur /helix/machine) ; quittée, elle s'arrête et rend
   * ses 3 Go de mémoire.
   */
  if (body.mode === "sandbox") void demarrerMachine(qui.userId).catch(() => undefined);
  else if (avant === "sandbox") void arreterMachine(qui.userId);
  computer.oublierCapacite();
  send(res, 200, await computer.capability());
}

/* ------------------------------- images -------------------------------- */

/** Ce que la machine peut faire en images, et l'installation en cours. */
/** Gestion privée des médias : la séance détermine l'auteur, jamais le corps de la demande. */
async function handleMediasStudio(req: http.IncomingMessage, res: http.ServerResponse, url: URL, id?: string): Promise<void> {
  const qui = await demandeur(req, url);
  if (!qui) return send(res, 401, sansSeance());
  try {
    if (req.method === "GET") return send(res, 200, { medias: images.mediasStudio(qui.userId) });
    const b = await readJson(req, id ? 4096 : 56 * 1024 * 1024) as { contenu?: unknown; nom?: unknown; largeur?: unknown; hauteur?: unknown; secondes?: unknown; action?: unknown };
    if (!id) return send(res, 201, images.importerMediaStudio(qui.userId, b));
    if (!["corbeille", "restaurer", "supprimer"].includes(String(b.action))) return send(res, 400, { error: { message: t("Action inconnue.") } });
    if (!images.modifierMediaStudio(qui.userId, id, b.action as "corbeille" | "restaurer" | "supprimer")) return send(res, 404, { error: { message: t("Création introuvable.") } });
    return send(res, 200, { ok: true });
  } catch (err) { return send(res, 400, { error: { message: err instanceof Error ? err.message : t("Le média n'a pas pu être enregistré.") } }); }
}

async function handleImagesEtat(req: http.IncomingMessage, res: http.ServerResponse, url: URL): Promise<void> {
  const qui = await demandeur(req, url);
  if (!qui) return send(res, 401, sansSeance());
  send(res, 200, await images.etatImages());
}

/** Installer, retirer ou choisir un modèle d'images (`modele` : z-image, flux2-klein, qwen-image). */
async function handleImagesInstaller(req: http.IncomingMessage, res: http.ServerResponse, url: URL, action: "installer" | "retirer" | "choisir"): Promise<void> {
  const qui = await demandeur(req, url);
  if (!qui) return send(res, 401, sansSeance());
  const body = (await readJson(req).catch(() => ({}))) as { modele?: unknown };
  const id = typeof body.modele === "string" ? body.modele : undefined;
  if (action === "retirer") {
    try {
      await images.desinstallerImages(qui.userId, id);
    } catch (err) {
      return send(res, 409, { error: { message: err instanceof Error ? err.message : String(err) } });
    }
    return send(res, 200, await images.etatImages());
  }
  if (!id) return send(res, 400, { error: { message: t("`modele` est requis.") } });
  if (action === "choisir") {
    if (!images.choisirModele(id)) return send(res, 409, { error: { message: t("Ce modèle n'est pas installé.") } });
    return send(res, 200, await images.etatImages());
  }
  void images.installerImages(qui.userId, id).catch(() => undefined);
  send(res, 202, await images.etatImages());
}

/* ------------------------------- vidéos -------------------------------- */

/*
 * La vidéo, comme les images (27/09/2026) : même moteur, mêmes droits. Le
 * suivi d'une création et la lecture du fichier passent par les routes des
 * images (`/helix/images/travail`, `/helix/images/fichier`), qui ne font pas
 * la différence.
 */
async function handleVideos(req: http.IncomingMessage, res: http.ServerResponse, url: URL, action: string): Promise<void> {
  const qui = await demandeur(req, url);
  if (!qui) return send(res, 401, sansSeance());
  if (req.method === "GET" && action === "") return send(res, 200, await images.etatVideos());
  const body = (await readJson(req).catch(() => ({}))) as { modele?: unknown; description?: unknown; format?: unknown; chat?: unknown };
  const id = typeof body.modele === "string" ? body.modele : undefined;
  try {
    if (req.method === "POST" && action === "desinstaller") {
      await images.desinstallerVideos(qui.userId, id);
      return send(res, 200, await images.etatVideos());
    }
    if (req.method === "POST" && action === "choisir") {
      if (!id || !images.choisirModeleVideo(id)) return send(res, 409, { error: { message: t("Ce modèle n'est pas installé.") } });
      return send(res, 200, await images.etatVideos());
    }
    if (req.method === "POST" && action === "installer") {
      if (!id) return send(res, 400, { error: { message: t("`modele` est requis.") } });
      void images.installerVideos(qui.userId, id).catch(() => undefined);
      return send(res, 202, await images.etatVideos());
    }
    if (req.method === "POST" && action === "creer") {
      const description = typeof body.description === "string" ? body.description.trim().slice(0, 2000) : "";
      if (!description) return send(res, 400, { error: { message: t("Décrivez la vidéo à créer.") } });
      const format = body.format === "portrait" ? "portrait" : "paysage";
      const chat = typeof body.chat === "string" && /^[\w-]{1,100}$/.test(body.chat) ? body.chat : undefined;
      return send(res, 202, await images.lancerVideo(description, format, qui.userId, chat));
    }
  } catch (err) {
    return send(res, 409, { error: { message: err instanceof Error ? err.message : String(err) } });
  }
  send(res, 404, { error: { message: tf("Route inconnue : {0} {1}", req.method, url.pathname) } });
}

/* ---------------------------- entraînement ----------------------------- */

/**
 * Entraîner un modèle sur ses exemples (entrainement.ts). Une seule entrée :
 * `GET /helix/entrainement` rend l'état de la machine, le travail en cours et
 * les projets de la personne ; le reste suit `/helix/entrainement/<action>`.
 */
async function handleEntrainement(req: http.IncomingMessage, res: http.ServerResponse, url: URL, action: string): Promise<void> {
  const qui = await demandeur(req, url);
  if (!qui) return send(res, 401, sansSeance());
  const u = qui.userId;
  const corps = (req.method === "POST" ? await readJson(req).catch(() => ({})) : {}) as Record<string, unknown>;
  try {
    switch (`${req.method} ${action}`) {
      case "GET ":
        return send(res, 200, await entrainement.etat(u));
      case "GET projet":
        return send(res, 200, entrainement.detailProjet(u, url.searchParams.get("id")));
      case "POST installer":
        void entrainement.installer(u).catch(() => undefined);
        return send(res, 202, await entrainement.etat(u));
      case "POST desinstaller":
        entrainement.desinstaller(u);
        return send(res, 200, await entrainement.etat(u));
      case "POST projets":
        return send(res, 200, entrainement.creerProjet(u, corps.nom));
      case "POST renommer":
        return send(res, 200, entrainement.renommer(u, corps.projet, corps.nom));
      case "POST exemples":
        return send(res, 200, entrainement.enregistrerExemples(u, corps.projet, corps.exemples, corps.propositions));
      case "POST importer":
        return send(res, 200, entrainement.importer(u, corps.projet, corps.contenu, corps.nom));
      case "POST generer":
        return send(res, 202, entrainement.generer(u, corps.projet, corps.texte, corps.source));
      case "POST lancer":
        return send(res, 202, entrainement.entrainer(u, corps.projet));
      case "POST arreter":
        return send(res, 200, { arrete: entrainement.arreter(u) });
      case "POST comparer":
        return send(res, 202, entrainement.comparer(u, corps.projet, corps.questions));
      case "POST publier":
        return send(res, 202, entrainement.publier(u, corps.projet));
      case "POST retirer":
        return send(res, 200, await entrainement.retirer(u, corps.projet));
      case "POST supprimer":
        await entrainement.supprimer(u, corps.projet);
        return send(res, 200, { ok: true });
      default:
        return send(res, 404, { error: { message: tf("Route inconnue : {0} {1}", req.method, url.pathname) } });
    }
  } catch (err) {
    const statut = err instanceof entrainement.ErreurEntrainement ? err.statut : 500;
    if (statut === 500) console.error("[gateway] entrainement", err);
    return send(res, statut, { error: { message: err instanceof Error ? err.message : String(err) } });
  }
}

/** Lance une création ; l'écran suit son avancement sur /helix/images/travail/<id>. */
async function handleImagesCreer(req: http.IncomingMessage, res: http.ServerResponse, url: URL): Promise<void> {
  const qui = await demandeur(req, url);
  if (!qui) return send(res, 401, sansSeance());
  const body = (await readJson(req).catch(() => ({}))) as { description?: unknown; format?: unknown; chat?: unknown };
  const description = typeof body.description === "string" ? body.description.trim().slice(0, 2000) : "";
  if (!description) return send(res, 400, { error: { message: t("Décrivez l'image à créer.") } });
  const format = body.format === "portrait" || body.format === "paysage" ? body.format : "carre";
  // Le Chat de la demande : ceux qui le voient verront l'image (images.ts, `imageVisible`).
  const chat = typeof body.chat === "string" && /^[\w-]{1,100}$/.test(body.chat) ? body.chat : undefined;
  try {
    const tr = await images.lancerCreation(description, format, qui.userId, chat);
    send(res, 202, tr);
  } catch (err) {
    send(res, 409, { error: { message: err instanceof Error ? err.message : String(err) } });
  }
}

async function handleImagesTravail(req: http.IncomingMessage, res: http.ServerResponse, url: URL, id: string): Promise<void> {
  const qui = await demandeur(req, url);
  if (!qui) return send(res, 401, sansSeance());
  const tr = images.travail(id, qui.userId);
  if (!tr) return send(res, 404, { error: { message: t("Création introuvable.") } });
  send(res, 200, tr);
}

/**
 * Une image créée, pour son auteur et pour qui voit le Chat où elle a été
 * créée (images.ts, `imageVisible`). Tout autre : 404, qu'elle existe ou non.
 */
async function handleImagesFichier(req: http.IncomingMessage, res: http.ServerResponse, url: URL, id: string): Promise<void> {
  const qui = await demandeur(req, url);
  if (!qui) return send(res, 401, sansSeance());
  const vue = await images.imageVisible(id, qui);
  if (!vue) return send(res, 404, { error: { message: t("Image introuvable.") } });
  const octets = readFileSync(vue.chemin);
  /*
   * Un collègue ne garde pas l'image en cache : le partage du Chat peut lui
   * être retiré, et l'instance doit alors cesser de la lui servir.
   */
  // Une image (PNG) ou une vidéo (WebM) : le registre sait laquelle (images.ts, `fichierCree`).
  res.writeHead(200, { "Content-Type": vue.type, "Content-Length": octets.length, ...entetesOrigine(req), ...ENTETES_SECURITE, "Cache-Control": vue.auteur ? "private, max-age=86400" : "no-store" });
  res.end(octets);
}

/* -------------------- import depuis les logiciels du poste -------------------- */

/*
 * Lire les historiques des autres logiciels d'IA du poste (importLocal.ts).
 * Seulement depuis le poste lui-même : ces fichiers sont ceux de la machine
 * qui fait tourner la passerelle, qui n'est la machine de la personne que
 * sur un poste autonome. Une demande venue du réseau est refusée.
 */
const depuisCePoste = (req: http.IncomingMessage) => /^(::1|127\.|::ffff:127\.)/.test(req.socket.remoteAddress ?? "");

async function handleImportLogiciels(req: http.IncomingMessage, res: http.ServerResponse, url: URL, id?: string): Promise<void> {
  /*
   * Revue du 25/09/2026 : la boucle locale ne prouvait rien sur une instance
   * partagée. Un outil qui tourne sur le serveur (le bash de Helix Code, un
   * script d'employé) appelle `http://127.0.0.1:<port>/…` et passe pour « le
   * poste », jetons en `?token=` et `?session=`. Il recevait les
   * conversations Claude Code, Codex et Cursor du compte qui fait tourner le
   * serveur. Trois barrières désormais, en plus de la boucle locale :
   *  1. jetons en en-têtes seulement, jamais dans l'adresse (ni billet de
   *     flux) : l'écran les pose ainsi, un lien ou un script bricolé non ;
   *  2. instance partagée (`share`, ou écoute sur le réseau) : refus, toujours.
   *     Ces fichiers sont ceux du serveur, pas ceux de la personne ;
   *  3. le compte doit être celui qui administre l'instance (roles.ts : sur un
   *     poste autonome, le premier compte, celui qui l'a mise en route).
   */
  if (["token", "session", "flux"].some((p) => url.searchParams.has(p))) {
    return send(res, 400, { error: { message: t("Jetons en en-têtes seulement pour cette route, jamais dans l'adresse.") } });
  }
  if (instancePartagee()) {
    return send(res, 403, { error: { message: t("L'import depuis les logiciels du poste est fermé sur une instance partagée : ces fichiers seraient ceux du serveur, pas les vôtres. Utilisez l'export du logiciel (Réglages, Importer).") } });
  }
  const qui = await demandeur(req, url);
  if (!qui) return send(res, 401, sansSeance());
  if (!depuisCePoste(req)) {
    return send(res, 403, { error: { message: t("L'import depuis les logiciels se fait sur le poste où ils sont installés, pas depuis une instance distante.") } });
  }
  if (!(await estAdministrateur(qui.userId))) {
    return send(res, 403, { error: { message: t("Seul le titulaire de ce poste peut reprendre les historiques de ses logiciels.") } });
  }
  if (!id) return send(res, 200, { logiciels: await logicielsTrouves() });
  /*
   * Par morceaux (importLocal.ts) : GET donne une page de la liste
   * (`?depuis=`), POST le contenu des Chats choisis (`{ cles }`).
   */
  if (req.method === "POST") {
    const body = (await readJson(req).catch(() => ({}))) as { cles?: unknown };
    const cles = Array.isArray(body.cles) ? body.cles.filter((c): c is string => typeof c === "string").slice(0, 500) : [];
    const contenu = await contenuLogiciel(id, cles);
    if (!contenu) return send(res, 404, { error: { message: t("Rien à reprendre de ce logiciel.") } });
    journaliser("import.logiciel", qui.userId, { logiciel: id, chats: contenu.chats.length });
    return send(res, 200, contenu);
  }
  const depuis = Number(url.searchParams.get("depuis") ?? 0);
  const page = await pageLogiciel(id, Number.isFinite(depuis) && depuis >= 0 ? depuis : 0);
  if (!page) return send(res, 404, { error: { message: t("Rien à reprendre de ce logiciel.") } });
  send(res, 200, page);
}

/* ------------------------- machine de l'agent ------------------------- */

/** Ce que l'ordinateur peut porter, l'état de la machine, et la préparation en cours. */
async function handleMachineEtat(req: http.IncomingMessage, res: http.ServerResponse, url: URL): Promise<void> {
  const qui = await demandeur(req, url);
  if (!qui) return send(res, 401, sansSeance());
  send(res, 200, { ...(await diagnosticMachine()), progression: progressionMachine() });
}

async function handleMachineAction(req: http.IncomingMessage, res: http.ServerResponse, url: URL, action: "demarrer" | "arreter" | "effacer"): Promise<void> {
  const qui = await demandeur(req, url);
  if (!qui) return send(res, 401, sansSeance());
  /*
   * Effacer rend la place sur le disque (8 Go pour Linux, bien plus pour
   * macOS). Seulement machine non choisie : en service, on la désactive
   * d'abord, pour que l'agent ne perde pas son écran en pleine demande.
   */
  if (action === "effacer") {
    if (configEcran().mode === "sandbox") {
      return send(res, 409, { error: { message: t("Désactivez d'abord la machine de l'agent, puis effacez-la.") } });
    }
    try {
      await effacerMachine(qui.userId);
    } catch (err) {
      return send(res, 409, { error: { message: err instanceof Error ? err.message : String(err) } });
    }
    return send(res, 200, await diagnosticMachine());
  }
  if (action === "arreter") {
    await arreterMachine(qui.userId);
    return send(res, 200, await diagnosticMachine());
  }
  void demarrerMachine(qui.userId).catch(() => undefined);
  send(res, 202, { demarrage: true, progression: progressionMachine() });
}

/**
 * L'écran de la machine, en image, pour le suivre en direct dans Cowork. Ne
 * passe pas par l'approbation : regarder la machine de l'agent n'agit sur rien.
 */
async function handleMachineEcran(req: http.IncomingMessage, res: http.ServerResponse, url: URL): Promise<void> {
  const qui = await demandeur(req, url);
  if (!qui) return send(res, 401, sansSeance());
  const image = await computer.captureMachine();
  if (!image) return send(res, 503, { error: { message: t("La machine de l'agent ne répond pas.") } });
  res.writeHead(200, { "Content-Type": "image/png", ...entetesOrigine(req), ...ENTETES_SECURITE, "Cache-Control": "no-store" });
  res.end(image);
}

/** Accord ou refus d'une action en attente. */
async function handleComputerApprove(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  url: URL,
): Promise<void> {
  // Approuver engage une personne : le journal doit pouvoir la nommer.
  const qui = await demandeur(req, url);
  if (!qui) return send(res, 401, sansSeance());

  const body = (await readJson(req).catch(() => ({}))) as { id?: string; accord?: boolean };
  if (!body.id) return send(res, 400, { error: { message: t("`id` est requis.") } });
  // Même règle que pour les outils : seul un `true` explicite autorise.
  if (typeof body.accord !== "boolean") {
    return send(res, 400, {
      error: { message: t("`accord` doit valoir true ou false, sans ambiguïté.") },
    });
  }
  const known = computer.resolveApproval(body.id, body.accord, qui.userId);
  send(res, known ? 200 : 404, {
    ok: known,
    message: known ? t("Réponse enregistrée.") : t("Cette demande n'est plus en attente."),
  });
}

/** Flux des demandes d'approbation et des actions exécutées. */
function handleComputerStream(req: http.IncomingMessage, res: http.ServerResponse, qui: Demandeur): void {
  res.writeHead(200, entetesFlux(req));
  // Voir `handleApprobationFlux` : les en-têtes partent sans attendre une première trame.
  res.flushHeaders();
  const write = (event: unknown) => res.write(`data: ${JSON.stringify(event)}\n\n`);

  // Un poste qui se connecte en cours de route doit voir les demandes déjà
  // posées, sinon l'agent reste bloqué sans que personne ne le sache.
  for (const attente of computer.pendingApprovals(qui.userId)) {
    write({ type: "approbation_demandee", id: attente.id, action: attente.action });
  }

  const off = computer.onApprovalEvent(qui.userId, write);
  const keepAlive = setInterval(() => res.write(": ping\n\n"), 15000);
  req.on("close", () => {
    off();
    clearInterval(keepAlive);
    res.end();
  });
}

/* ------------------ routes approbation des actions de l'agent ----------------- */

/**
 * Niveau en vigueur et demandes en attente.
 *
 * Le niveau est tenu par la passerelle, pas par le poste : l'interface le lit
 * ici et n'en garde aucune copie qui ferait autorité.
 */
async function handleApprobationEtat(res: http.ServerResponse, qui: Demandeur): Promise<void> {
  send(res, 200, {
    niveau: approbation.niveau(),
    // L'écran ne propose de changer le niveau qu'à qui en a le droit.
    modifiable: await estAdministrateur(qui.userId),
    delaiMs: approbation.DELAI,
    // Les siennes seulement : le détail porte le mail entier, destinataires
    // compris, et les chemins des fichiers que l'agent veut toucher.
    enAttente: approbation.enAttente("outil", qui.userId),
  });
}

async function handleApprobationNiveau(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  url: URL,
): Promise<void> {
  const qui = await demandeur(req, url);
  if (!qui) return send(res, 401, sansSeance());

  const body = (await readJson(req).catch(() => ({}))) as { niveau?: unknown };
  if (!approbation.estNiveau(body.niveau)) {
    return send(res, 400, {
      error: { message: tf("« niveau » doit valoir {0}.", approbation.NIVEAUX.join(", ")) },
    });
  }

  if (await reserveeALAdministration(res, qui, t("Seul l'administrateur de l'instance peut changer le niveau d'approbation : il vaut pour les agents de tous ses membres."))) return;
  approbation.definirNiveau(body.niveau, qui.userId);
  send(res, 200, { niveau: approbation.niveau() });
}

/** Accord ou refus d'une action d'outil en attente. */
async function handleApprobationRepondre(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  url: URL,
): Promise<void> {
  const qui = await demandeur(req, url);
  if (!qui) return send(res, 401, sansSeance());

  const body = (await readJson(req).catch(() => ({}))) as { id?: string; accord?: unknown };
  if (!body.id) return send(res, 400, { error: { message: t("`id` est requis.") } });

  /*
   * Seul un `true` explicite autorise. Le code lisait `accord !== false`, ce
   * qui approuvait tout ce qui n'était pas exactement `false` : un champ mal
   * nommé, un corps tronqué, une valeur nulle. Un contrôle de sécurité doit
   * échouer en refusant. Mesuré avant correction : un refus envoyé sous un
   * autre nom de champ a laissé l'agent écrire le fichier, et le journal a
   * enregistré une approbation.
   */
  if (typeof body.accord !== "boolean") {
    return send(res, 400, {
      error: { message: t("`accord` doit valoir true ou false, sans ambiguïté.") },
    });
  }

  const connue = approbation.repondre(body.id, body.accord, "outil", qui.userId);
  send(res, connue ? 200 : 404, {
    ok: connue,
    message: connue ? "Réponse enregistrée." : "Cette demande n'est plus en attente.",
  });
}

/** Flux des demandes d'approbation d'outils. */
function handleApprobationFlux(req: http.IncomingMessage, res: http.ServerResponse, qui: Demandeur): void {
  res.writeHead(200, entetesFlux(req));
  /*
   * En-têtes envoyés tout de suite (27/09/2026). Sans demande en attente, rien
   * n'était écrit avant le premier signe de vie, quinze secondes plus tard :
   * l'écran ne savait pas le flux ouvert (`onopen`), et, après un redémarrage
   * de la passerelle, relisait l'état avec autant de retard ; une carte d'accord
   * pour une demande disparue restait affichée pendant ce temps.
   */
  res.flushHeaders();
  const write = (event: unknown) => res.write(`data: ${JSON.stringify(event)}\n\n`);

  // Un poste qui arrive en cours de route doit voir ce qui attend déjà, sinon
  // l'agent reste suspendu sans que personne ne le sache.
  for (const attente of approbation.enAttente("outil", qui.userId)) {
    write({ type: "approbation_demandee", ...attente });
  }

  const off = approbation.surEvenement((event) => {
    if (event.nature !== "outil") return;
    // Le flux portait le mail entier à toute séance qui l'écoutait.
    if (typeof event.pour === "string" && event.pour !== qui.userId) return;
    write(event);
  });
  const keepAlive = setInterval(() => res.write(": ping\n\n"), 15000);
  req.on("close", () => {
    off();
    clearInterval(keepAlive);
    res.end();
  });
}

async function handleLoad(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  const body = (await readJson(req).catch(() => ({}))) as { model?: string };
  if (!body.model) return send(res, 400, { error: { message: t("`model` est requis.") } });
  const result = await loadModel(body.model);
  invalidate();
  send(res, result.ok ? 200 : 500, result);
}

/* ----------------------------- modèles cloud par clé ---------------------------- */

/**
 * Clés de fournisseurs de modèles cloud (fournisseurs.ts). La clé entre une
 * fois, à l'essai puis à l'ajout, et ne ressort jamais.
 */
async function handleFournisseurs(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  url: URL,
  path: string,
): Promise<void> {
  const qui = await demandeur(req, url);
  if (!qui) return send(res, 401, sansSeance());
  const [id, action] = path.split("/").slice(3);
  const corps = async () => {
    const b = await readJson(req).catch(() => ({}));
    return b && typeof b === "object" && !Array.isArray(b) ? (b as Record<string, unknown>) : {};
  };
  const repondre = <T,>(r: fournisseurs.Resultat<T>, succes: (v: T) => unknown) =>
    r.ok ? send(res, 200, succes(r.valeur)) : send(res, r.statut, { error: { message: r.message } });

  if (!id && req.method === "GET") {
    return send(res, 200, {
      // Le seul nom du catalogue qui soit une phrase : dans la langue de l'écran (relevé en anglais le 27/09/2026).
      catalogue: fournisseurs.CATALOGUE.map(({ entetes: _e, ...f }) => (f.adresseLibre ? { ...f, nom: t("Autre (compatible OpenAI)") } : f)),
      cles: await fournisseurs.listerCles(qui.userId),
    });
  }
  /*
   * Un moteur de cette machine (boucle locale) : l'administrateur seul (test
   * d'intrusion du 27/09/2026). Un membre s'en servait pour sonder les ports
   * de la machine de l'instance et lire ce qu'un service local y répondait.
   */
  const boucleLocaleRefusee = async (adresse: unknown) => {
    let hote = "";
    try {
      hote = new URL(String(adresse ?? "")).hostname.toLowerCase();
    } catch {
      return false;
    }
    if (!["localhost", "127.0.0.1", "::1", "[::1]"].includes(hote) && !hote.startsWith("127.")) return false;
    return !(await estAdministrateur(qui.userId));
  };
  const refusBoucle = () => send(res, 403, { error: { message: t("Seul l'administrateur de l'instance peut brancher un moteur installé sur sa machine.") } });
  if (id === "essayer" && !action && req.method === "POST") {
    const b = await corps();
    if (await boucleLocaleRefusee(b.adresse)) return refusBoucle();
    return repondre(await fournisseurs.essayerCle(String(b.fournisseur ?? ""), b.adresse, b.cle), (modeles) => ({ modeles }));
  }
  if (!id && req.method === "POST") {
    const b = await corps();
    if (await boucleLocaleRefusee(b.adresse)) return refusBoucle();
    const r = await fournisseurs.ajouterCle(b, qui.userId);
    invalidate();
    return repondre(r, (cle) => ({ cle }));
  }
  if (id && !action && req.method === "POST") {
    return repondre(await fournisseurs.modifierCle(id, await corps(), qui.userId), (cle) => ({ cle }));
  }
  if (id && action === "supprimer" && req.method === "POST") {
    return repondre(await fournisseurs.retirerCle(id, qui.userId), () => ({ ok: true }));
  }
  send(res, 404, { error: { message: tf("Route inconnue : {0} {1}", req.method, path) } });
}

/* --------------------------------- clés d'API --------------------------------- */

/**
 * Paramètres → API développeur : les clés de la personne connectée, et les
 * adresses où l'API se joint, telles que la passerelle les sert vraiment
 * (chiffrée ou non, ouverte au réseau ou non). Séance exigée par la barrière
 * (`routeClesApi`) ; une clé n'arrive jamais jusqu'ici (`ROUTES_CLE`).
 */
async function handleClesApi(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  url: URL,
  path: string,
): Promise<void> {
  const qui = await demandeur(req, url);
  if (!qui) return send(res, 401, sansSeance());
  const [id, action] = path.split("/").slice(3);
  const corps = async () => {
    const b = await readJson(req).catch(() => ({}));
    return b && typeof b === "object" && !Array.isArray(b) ? (b as Record<string, unknown>) : {};
  };
  const repondre = <T,>(r: clesApi.Resultat<T>, succes: (v: T) => unknown) =>
    r.ok ? send(res, 200, succes(r.valeur)) : send(res, r.statut, { error: { message: r.message } });

  if (!id && req.method === "GET") {
    const schema = tls ? "https" : "http";
    return send(res, 200, {
      cles: await clesApi.clesDe(qui.userId),
      limite: clesApi.CLES_PAR_PERSONNE_MAX,
      parMinute: clesApi.PAR_MINUTE,
      adresses: {
        // Sur la machine de l'instance : toujours joignable.
        locale: `${schema}://localhost:${PORT}/v1`,
        // Depuis une autre machine : seulement si l'instance est ouverte aux collègues.
        reseau: surLeReseau() ? propositions(PORT, Boolean(tls)).map((p) => ({ url: `${p.url}/v1`, genre: p.genre })) : [],
        chiffre: Boolean(tls),
      },
    });
  }
  if (!id && req.method === "POST") {
    const b = await corps();
    /*
     * Une clé survit à la séance qui la crée : son mot de passe d'abord (et
     * son code, si le second facteur est actif), comme pour ouvrir l'instance
     * au réseau. Revue du 26/09/2026 : une séance volée quelques secondes
     * suffisait à se ménager un accès durable.
     */
    const refus = await confirmerIdentite(qui.userId, b.motDePasse, b.code);
    if (refus) return send(res, refus.statut, { error: { message: refus.reason, code: "identite-a-confirmer" } });
    return repondre(await clesApi.creerCle(qui.userId, { nom: b.nom, jours: b.jours }), (v) => v);
  }
  if (id && !action && req.method === "POST") {
    return repondre(await clesApi.renommerCle(qui.userId, id, (await corps()).nom), (cle) => ({ cle }));
  }
  if (id && action === "revoquer" && req.method === "POST") {
    return repondre(await clesApi.revoquerCle(qui.userId, id), () => ({ ok: true }));
  }
  send(res, 404, { error: { message: tf("Route inconnue : {0} {1}", req.method, path) } });
}

/**
 * Ce qu'une clé d'API ouvre, et rien d'autre : l'API compatible OpenAI.
 * Liste fermée, comme `EXECUTION` : une route ajoutée plus tard n'est pas
 * ouverte aux clés par omission, il faut l'écrire ici.
 */
const ROUTES_CLE: { methode: string; chemin: string }[] = [
  { methode: "GET", chemin: "/v1/models" },
  { methode: "POST", chemin: "/v1/chat/completions" },
];

/**
 * Requête portant `Authorization: Bearer hlx_…`. La clé remplace, pour les
 * seules `ROUTES_CLE`, le jeton d'instance **et** la séance : elle dit à la
 * fois que l'appelant a le droit de parler et au nom de qui. Inconnue,
 * révoquée ou expirée : 401. Trop d'appels dans la minute : 429.
 */
async function traiterParCle(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  url: URL,
  path: string,
  secret: string,
): Promise<void> {
  const cle = await clesApi.verifierCle(secret);
  if (!cle) {
    return send(res, 401, { error: { message: t("Clé d'API inconnue, révoquée ou expirée."), code: "cle_invalide" } });
  }
  const verdict = debit.verifierCleApi(cle.id, clesApi.PAR_MINUTE);
  if (!verdict.ok) {
    res.setHeader("Retry-After", String(verdict.retenteDans ?? 60));
    return send(res, 429, {
      error: {
        message: tf("Trop de requêtes avec cette clé ({0} par minute au plus). Réessayez dans {1} s.", clesApi.PAR_MINUTE, verdict.retenteDans),
        code: "debit_depasse",
      },
    });
  }
  // Le compte peut avoir été supprimé, ou n'avoir plus le droit d'entrer (second facteur imposé depuis).
  const qui = await profilDe(cle.userId);
  if (!qui) {
    return send(res, 401, { error: { message: t("Le compte de cette clé n'a plus accès à l'instance."), code: "cle_invalide" } });
  }
  identites.set(req, qui);
  parCleApi.set(req, cle.id);

  if (req.method === "GET" && path === "/v1/models") {
    await handleModels(req, res, url, true);
    journaliser("api.appel", qui.userId, { cle: cle.id, route: path, statut: res.statusCode });
    return;
  }
  if (req.method === "POST" && path === "/v1/chat/completions") return handleChat(req, res, url);
  send(res, 404, { error: { message: tf("Route inconnue : {0} {1}", req.method, path) } });
}

/* ------------------------------------ groupes ---------------------------------- */

/**
 * Groupes : la liste est l'annuaire de l'équipe, lisible de tous ; chaque
 * membre y est nommé (nom, initiales). Les photos restent dans la liste des
 * comptes, que chaque poste a déjà : les recopier ici alourdirait chaque
 * réponse de dizaines de Ko par personne. Les droits sont vérifiés par groupes.ts.
 */
async function handleGroupes(req: http.IncomingMessage, res: http.ServerResponse, url: URL, path: string): Promise<void> {
  const qui = await demandeur(req, url);
  if (!qui) return send(res, 401, sansSeance());
  const [id, action] = path.split("/").slice(3);
  const corps = async () => {
    const b = await readJson(req).catch(() => ({}));
    return b && typeof b === "object" && !Array.isArray(b) ? (b as Record<string, unknown>) : {};
  };
  const comptes = await publicAccounts();
  const vue = (g: groupes.Groupe) => ({
    ...g,
    membres: g.membres.flatMap((m) => {
      const c = comptes.find((x) => x.id === m);
      return c ? [{ id: c.id, nom: c.fullName, email: c.email, initiales: c.initials }] : [];
    }),
    estMembre: g.membres.includes(qui.userId),
    estResponsable: g.responsables.includes(qui.userId),
  });
  const repondre = <T,>(r: { ok: true; valeur: T } | { ok: false; statut: number; message: string }, succes: (v: T) => unknown) =>
    r.ok ? send(res, 200, succes(r.valeur)) : send(res, r.statut, { error: { message: r.message } });

  if (!id && req.method === "GET") {
    const liste = await groupes.listerGroupes();
    return send(res, 200, {
      groupes: liste.map(vue).sort((a, b) => Number(b.estMembre) - Number(a.estMembre) || a.nom.localeCompare(b.nom, "fr")),
      // L'annuaire, pour choisir des membres : qui existe, sans rien d'autre que ce que l'écran de connexion montre déjà.
      annuaire: comptes.map((c) => ({ id: c.id, nom: c.fullName, email: c.email, initiales: c.initials })),
    });
  }
  if (!id && req.method === "POST") return repondre(await groupes.creerGroupe(await corps(), qui.userId), (g) => ({ groupe: vue(g) }));
  if (id && !action && req.method === "POST") {
    return repondre(await groupes.modifierGroupe(id, await corps(), qui.userId), (g) => ({ groupe: vue(g) }));
  }
  if (id && action === "quitter" && req.method === "POST") return repondre(await groupes.quitterGroupe(id, qui.userId), () => ({ ok: true }));
  if (id && action === "supprimer" && req.method === "POST") {
    return repondre(await groupes.supprimerGroupe(id, qui.userId), () => ({ ok: true }));
  }
  send(res, 404, { error: { message: tf("Route inconnue : {0} {1}", req.method, path) } });
}

/* --------------------------------- bibliothèque -------------------------------- */

async function handleBibliotheque(req: http.IncomingMessage, res: http.ServerResponse, url: URL, path: string): Promise<void> {
  const qui = await demandeur(req, url);
  if (!qui) return send(res, 401, sansSeance());
  const moi = { userId: qui.userId, groupes: qui.groupes ?? [] };
  const [id, action] = path.split("/").slice(3);
  const corps = async (max?: number) => {
    const b = await readJson(req, max).catch(() => ({}));
    return b && typeof b === "object" && !Array.isArray(b) ? (b as Record<string, unknown>) : {};
  };
  const repondre = <T,>(r: { ok: true; valeur: T } | { ok: false; statut: number; message: string }, succes: (v: T) => unknown) =>
    r.ok ? send(res, 200, succes(r.valeur)) : send(res, r.statut, { error: { message: r.message } });

  if (!id && req.method === "GET") {
    return repondre(
      await bibliotheque.lister(moi, {
        vue: url.searchParams.get("vue") ?? undefined,
        dossier: url.searchParams.get("dossier"),
        q: url.searchParams.get("q") ?? undefined,
      }),
      (v) => v,
    );
  }
  if (id === "dossiers" && !action && req.method === "POST") {
    return repondre(await bibliotheque.creerDossier(await corps(), moi), (element) => ({ element }));
  }
  if (id === "documents" && !action && req.method === "POST") {
    if (estEnvoiEnFlux(req)) {
      const envoi = await lireEnvoi(req);
      if (!envoi.ok) return send(res, 400, { error: { message: envoi.message } });
      return repondre(await bibliotheque.importerDocumentEnFlux(envoi.entete, envoi.fichier, moi), (element) => ({ element }));
    }
    const b = await readJson(req, CORPS_DOCUMENT_MAX).catch((err: unknown) => err as Error);
    if (b instanceof Error) {
      return send(res, 413, { error: { message: tf("Document trop lourd pour cet envoi : mettez l'application à jour (jusqu'à {0}).", LIBELLE_DOCUMENT_MAX) } });
    }
    const doc = b && typeof b === "object" && !Array.isArray(b) ? (b as Record<string, unknown>) : {};
    return repondre(await bibliotheque.importerDocument(doc, moi), (element) => ({ element }));
  }
  if (id && action === "contenu" && req.method === "GET") {
    const r = await bibliotheque.lireContenu(id, moi);
    if (!r.ok) return send(res, r.statut, { error: { message: r.message } });
    res.writeHead(200, {
      ...entetesOrigine(req),
      ...ENTETES_SECURITE,
      // Jamais interprété par le navigateur : un document partagé ne s'exécute pas dans la page.
      "Content-Type": "application/octet-stream",
      "Content-Length": r.valeur.taille,
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(r.valeur.nom)}`,
      "X-Helix-Type": r.valeur.type,
      "Access-Control-Expose-Headers": "X-Helix-Type",
    });
    return envoyerFlux(res, r.valeur.flux);
  }
  if (id && action === "favori" && req.method === "POST") {
    const b = await corps();
    return repondre(await bibliotheque.marquerFavori(id, b.favori === true, moi), () => ({ ok: true }));
  }
  if (id && action === "supprimer" && req.method === "POST") {
    const r = await bibliotheque.supprimerElement(id, moi);
    // Un document supprimé quitte aussi les bases de connaissances, index compris (connaissances.ts).
    if (r.ok) await connaissances.retirerDocumentsPartout(r.valeur.documents).catch(() => 0);
    return repondre(r, (v) => ({ supprimes: v.supprimes }));
  }
  if (id && !action && req.method === "POST") {
    return repondre(await bibliotheque.modifierElement(id, await corps(), moi), (element) => ({ element }));
  }
  send(res, 404, { error: { message: tf("Route inconnue : {0} {1}", req.method, path) } });
}

/* ---------------------------- bases de connaissances --------------------------- */

async function handleConnaissances(req: http.IncomingMessage, res: http.ServerResponse, url: URL, path: string): Promise<void> {
  const qui = await demandeur(req, url);
  if (!qui) return send(res, 401, sansSeance());
  const moi = { userId: qui.userId, groupes: qui.groupes ?? [] };
  const [id, action] = path.split("/").slice(3);
  const corps = async () => {
    const b = await readJson(req).catch(() => ({}));
    return b && typeof b === "object" && !Array.isArray(b) ? (b as Record<string, unknown>) : {};
  };
  const repondre = <T,>(r: { ok: true; valeur: T } | { ok: false; statut: number; message: string }, succes: (v: T) => unknown) =>
    r.ok ? send(res, 200, succes(r.valeur)) : send(res, r.statut, { error: { message: r.message } });

  if (!id && req.method === "GET") return send(res, 200, { bases: await connaissances.listerBases(moi) });
  if (!id && req.method === "POST") return repondre(await connaissances.creerBase(await corps(), moi), (base) => ({ base }));
  if (id === "documents" && !action && req.method === "GET") {
    return send(res, 200, { documents: await connaissances.documentsDisponibles(moi) });
  }
  // Essayer une question sans passer par le Chat : l'écran de la base, et les vérifications.
  if (id === "chercher" && !action && req.method === "POST") {
    const b = await corps();
    const r = await connaissances.chercher(b.bases, typeof b.question === "string" ? b.question : "", moi, Number(b.nombre) || undefined);
    return send(res, 200, r);
  }
  if (id && !action && req.method === "GET") return repondre(await connaissances.lireBase(id, moi), (base) => ({ base }));
  if (id && !action && req.method === "POST") return repondre(await connaissances.modifierBase(id, await corps(), moi), (base) => ({ base }));
  if (id && action === "supprimer" && req.method === "POST") return repondre(await connaissances.supprimerBase(id, moi), (v) => v);
  if (id && action === "documents" && req.method === "POST") {
    return repondre(await connaissances.ajouterDocuments(id, await corps(), moi), (base) => ({ base }));
  }
  if (id && action === "retirer" && req.method === "POST") return repondre(await connaissances.retirerDocument(id, await corps(), moi), (base) => ({ base }));
  if (id && action === "reindexer" && req.method === "POST") return repondre(await connaissances.reindexer(id, await corps(), moi), (base) => ({ base }));
  send(res, 404, { error: { message: tf("Route inconnue : {0} {1}", req.method, path) } });
}

/* ----------------------------------- réunions ---------------------------------- */

async function handleReunions(req: http.IncomingMessage, res: http.ServerResponse, url: URL, path: string): Promise<void> {
  const qui = await demandeur(req, url);
  if (!qui) return send(res, 401, sansSeance());
  const moi = { userId: qui.userId, groupes: qui.groupes ?? [] };
  const [id, action] = path.split("/").slice(3);
  const corps = async () => {
    const b = await readJson(req).catch(() => ({}));
    return b && typeof b === "object" && !Array.isArray(b) ? (b as Record<string, unknown>) : {};
  };
  const repondre = <T,>(r: { ok: true; valeur: T } | { ok: false; statut: number; message: string }, succes: (v: T) => unknown) =>
    r.ok ? send(res, 200, succes(r.valeur)) : send(res, r.statut, { error: { message: r.message } });

  if (!id && req.method === "GET") {
    const [liste, reglages, dictee, agenda] = await Promise.all([
      reunions.lister(moi),
      reunions.reglagesDe(qui.userId),
      diagnosticDictee(),
      etatAgenda(),
    ]);
    return send(res, 200, {
      reunions: liste.map((r) => ({ ...r, estProprietaire: r.ownerId === qui.userId })),
      reglages,
      transcription: { installee: dictee.installee, modele: dictee.modele },
      agenda: Boolean(agenda.branche),
    });
  }
  if (!id && req.method === "POST") return repondre(await reunions.creer(await corps(), moi), (reunion) => ({ reunion }));
  if (id === "reglages" && !action) {
    if (req.method === "GET") return send(res, 200, { reglages: await reunions.reglagesDe(qui.userId) });
    if (req.method === "POST") return send(res, 200, { reglages: await reunions.modifierReglages(qui.userId, await corps()) });
  }
  if (id === "a-rejoindre" && !action && req.method === "GET") return send(res, 200, { reunions: await reunions.aRejoindre(moi) });
  if (id && !action && req.method === "GET") return repondre(await reunions.detail(id, moi), (v) => v);
  if (id && !action && req.method === "POST") return repondre(await reunions.modifier(id, await corps(), moi), (reunion) => ({ reunion }));
  if (id && action === "audio" && req.method === "POST") return repondre(await reunions.ajouterAudio(id, req, moi), (v) => v);
  if (id && action === "audio" && req.method === "GET") {
    const r = await reunions.audio(id, moi);
    if (!r.ok) return send(res, r.statut, { error: { message: r.message } });
    res.writeHead(200, { ...entetesOrigine(req), ...ENTETES_SECURITE, "Content-Type": "application/octet-stream", "Content-Length": r.valeur.taille });
    return envoyerFlux(res, r.valeur.flux);
  }
  if (id && action === "etat" && req.method === "POST") return repondre(await reunions.etatBot(id, await corps(), moi), (reunion) => ({ reunion }));
  if (id && action === "terminer" && req.method === "POST") return repondre(await reunions.terminer(id, moi), (reunion) => ({ reunion }));
  if (id && action === "resumer" && req.method === "POST") return repondre(await reunions.resumer(id, moi), (reunion) => ({ reunion }));
  if (id && action === "relancer" && req.method === "POST") return repondre(await reunions.relancer(id, moi), (reunion) => ({ reunion }));
  if (id && action === "supprimer" && req.method === "POST") return repondre(await reunions.supprimer(id, moi), () => ({ ok: true }));
  send(res, 404, { error: { message: tf("Route inconnue : {0} {1}", req.method, path) } });
}

/* ------------------------------ employés OpenClaw ------------------------------ */

/**
 * Employés : visibles de toute l'instance (ce sont des membres de l'équipe),
 * chacun leur parle dans sa propre conversation, seule la personne qui en a
 * déployé un peut le modifier, le mettre en pause ou le retirer. Voir
 * employes.ts pour le déploiement, serveurOutils.ts pour les outils.
 */
async function handleEmployes(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  url: URL,
  path: string,
): Promise<void> {
  const segments = path.split("/").slice(3); // ["<id>", "message", ...]
  const [id, action, sous, sousAction, quatrieme] = segments;

  // Serveur d'outils : appelé par OpenClaw, sans séance, sur preuve de la clé.
  if (id && action === "outils" && segments.length === 2) {
    const corps = req.method === "POST" ? await readJson(req).catch(() => undefined) : undefined;
    if (!(await servirOutils(req, res, id, corps))) {
      send(res, 403, { error: { message: t("Accès réservé à l'instance des employés.") } });
    }
    return;
  }

  const qui = await demandeur(req, url);
  if (!qui) return send(res, 401, sansSeance());
  // Un agent personnel n'existe que pour son propriétaire : pour les autres, il est introuvable.
  if (id) {
    const cible = await employes.employe(id);
    if (cible && !employes.visiblePar(cible, qui.userId, qui.groupes ?? [])) {
      return send(res, 404, { error: { message: t("Agent introuvable.") } });
    }
  }
  const corps = async () => {
    const b = await readJson(req).catch(() => ({}));
    return b && typeof b === "object" && !Array.isArray(b) ? (b as Record<string, unknown>) : {};
  };
  const repondre = <T,>(r: employes.Resultat<T>, succes: (v: T) => unknown) =>
    r.ok
      ? send(res, 200, { ...(succes(r.valeur) as object), ...(r.avertissement ? { avertissement: r.avertissement } : {}) })
      : send(res, r.statut, { error: { message: r.message, ...(r.code ? { code: r.code } : {}), ...(r.details ? { details: r.details } : {}) } });

  // GET /helix/employes : l'équipe, ce qu'on peut leur donner, et l'état du moteur.
  if (!id && req.method === "GET") {
    const comptes = await publicAccounts();
    const liste = (await employes.listerEmployes()).filter((e) => employes.visiblePar(e, qui.userId, qui.groupes ?? []));
    // Une seule découverte : la liste proposée et l'état du modèle de chaque employé.
    const decouverte = await discover();
    // Les modèles que cette personne peut donner à un employé : les siens, ceux de l'équipe et de la machine.
    const modeles = decouverte.models.filter(
      (m) => m.roles.includes("chat") && (!m.proprietaire || m.proprietaire === qui.userId),
    );
    const depuis = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
    // Une mission « à chaque mail » est en place quand une boîte est branchée et qu'il y a accès.
    const boite = outilsDeFamille("courrier").length > 0;
    // Les agents masqués (27/09/2026) : le poste d'un employé est la copie de leurs instructions, il ne sort pas non plus.
    const agentsBruts = await db().read("agents").catch(() => null);
    const masques = new Set((Array.isArray(agentsBruts) ? (agentsBruts as Record<string, unknown>[]) : []).filter((a) => a.hidePrompt === true).map((a) => String(a.id)));
    const vues = await Promise.all(
      liste.map(async (e) => {
        const conso = await consommationDe(auteurEmploye(e.id));
        let jetons = 0;
        for (const [jour, parModele] of Object.entries(conso.jours)) {
          if (jour < depuis) continue;
          for (const l of Object.values(parModele)) jetons += l.entree + l.sortie;
        }
        const estProprietaire = e.ownerId === qui.userId;
        // Jugé avec les droits du propriétaire (c'est à son nom que l'employé est servi).
        const etatModele = employes.etatDuModele(e, decouverte);
        return {
          ...e,
          ...(!estProprietaire && e.agentId && masques.has(e.agentId) ? { poste: "" } : {}),
          /*
           * Le modèle d'un agent d'organisation ne regarde que son propriétaire
           * (audit du 28/09/2026, § 36). `modele` porte l'identifiant qualifié,
           * qui pour une clé personnelle nomme la clé (« cle-<id>/… ») et le
           * modèle payé par une collègue ; `modeleEtat` en dit le nom, le
           * fournisseur, le pays. Une collègue n'en garde que la disponibilité,
           * de quoi afficher « modèle indisponible » sans nommer le modèle ni
           * révéler la clé personnelle d'autrui (la liste `modeles` la cache déjà).
           */
          ...(estProprietaire ? {} : { modele: undefined }),
          // Qui est autorisé sur un canal (numéros, identifiants) ne regarde que son propriétaire.
          canaux: (e.canaux ?? []).map((c) =>
            estProprietaire ? { ...c, nom: employes.CANAUX[c.type].nom } : { type: c.type, nom: employes.CANAUX[c.type].nom },
          ),
          missions: e.missions.map(({ tache, ...m }) => ({
            ...m,
            planifiee:
              m.rythme === "a-chaque-mail"
                ? boite && employes.famillesEffectives(e).includes("courrier")
                : Boolean(tache),
          })),
          proprietaire: comptes.find((c) => c.id === e.ownerId)?.fullName ?? t("Un ancien membre"),
          estProprietaire,
          jetons30Jours: jetons,
          // Son modèle, jugé avec les droits de son propriétaire : l'écran le montre, et dit s'il a disparu.
          modeleEtat: estProprietaire ? etatModele : { nom: "", disponible: etatModele.disponible },
        };
      }),
    );
    return send(res, 200, {
      catalogueCanaux: Object.fromEntries(
        employes.TYPES_CANAUX.map((t) => [t, { nom: employes.CANAUX[t].nom, champs: employes.CANAUX[t].champs, qr: Boolean(employes.CANAUX[t].qr) }]),
      ),
      moteur: await employes.etatMoteur(),
      employes: vues,
      familles: FAMILLES.map((f) => ({ id: f, disponible: outilsDeFamille(f).length > 0 })),
      modeles: modeles.map((m) => ({
        uid: m.uid,
        nom: m.id,
        charge: Boolean(m.loaded),
        origine: m.origine ?? "local",
        pays: m.pays,
        fournisseur: m.fournisseur ?? m.backendLabel,
        // De quoi proposer un modèle adapté au poste (src/lib/employes.ts, `proposerModele`).
        ...(typeof m.outils === "boolean" ? { outils: m.outils } : {}),
        ...(m.sizeBytes ? { taille: m.sizeBytes } : {}),
        ...(m.params ? { params: m.params } : {}),
        ...(m.entraine ? { entraine: true } : {}),
        ...(moteurDeLaMachine(m.backendKind) && estDefaillant(m.id) ? { defaillant: true } : {}),
        // Une clé personnelle : la sienne (la route ne montre jamais celle d'une autre personne).
        ...(m.proprietaire ? { personnel: true } : {}),
      })),
    });
  }

  /*
   * Deux réglages désarment une barrière, et tous deux se reconfirment.
   *
   * Le palier « libre » donne à l'employé les commandes de la machine. Et
   * « autonome » lui permet d'agir sans jamais demander : c'est la porte
   * d'approbation elle-même qu'on retire. Seul « libre » était protégé ;
   * rendre un agent autonome ne demandait rien. Comme pour le contrôle de
   * l'écran, on redemande le mot de passe (et le code si la double
   * authentification est active) au moment de l'ouvrir.
   */
  const confirmerReglageSensible = async (
    b: Record<string, unknown>,
    avant?: { liberte?: string; autonome?: boolean },
  ) => {
    const ouvreLibre = b.liberte === "libre" && avant?.liberte !== "libre";
    const ouvreAutonome = b.autonome === true && avant?.autonome !== true;
    if (!ouvreLibre && !ouvreAutonome) return null;
    return confirmerIdentite(qui.userId, b.motDePasse, b.code);
  };

  // POST /helix/employes : déployer.
  if (!id && req.method === "POST") {
    const b = await corps();
    const refus = await confirmerReglageSensible(b);
    if (refus) return send(res, refus.statut, { error: { message: refus.reason } });
    const chat = (await models(true)).filter(
      (m) => m.roles.includes("chat") && (!m.proprietaire || m.proprietaire === qui.userId),
    );
    /*
     * Le modèle demandé, ou un refus : jusqu'au 27/09/2026, un modèle absent
     * ou réservé à quelqu'un d'autre (la clé personnelle d'une collègue) était
     * remplacé en silence par un modèle de la machine, et l'agent démarrait
     * sur un modèle que personne n'avait choisi.
     */
    if (typeof b.modele === "string" && b.modele && !chat.some((m) => m.uid === b.modele)) {
      return send(res, 400, { error: { message: t("Ce modèle n'est pas disponible pour vous."), code: "modele_indisponible" } });
    }
    // Sans modèle demandé : un modèle cloud branché par clé jamais, il coûte à quelqu'un ; ni un modèle entraîné ici.
    const gratuits = chat.filter((m) => m.origine !== "cle" && !m.entraine);
    // Un poste qui se sert d'outils (services branchés, bases de connaissances) : d'abord un modèle qui sait les appeler.
    const avecOutils =
      b.toutesLesFamilles === true ||
      (Array.isArray(b.outils) && b.outils.length > 0) ||
      (Array.isArray(b.connaissances) && b.connaissances.length > 0);
    const capables = avecOutils ? gratuits.filter((m) => m.outils === true) : [];
    const choisi =
      chat.find((m) => m.uid === b.modele) ??
      capables.find((m) => m.loaded) ??
      capables[0] ??
      gratuits.find((m) => m.loaded) ??
      gratuits[0];
    if (!choisi) {
      return send(res, 409, {
        error: { message: t("Aucun modèle de conversation n'est disponible : installez-en un avant de mettre un agent en service.") },
      });
    }
    return repondre(await employes.deployer(b, qui.userId, choisi.uid), (e) => ({ employe: e }));
  }

  if (!id) return send(res, 405, { error: { message: t("Méthode non prise en charge.") } });

  if (!action && req.method === "POST") {
    const b = await corps();
    const actuel = await employes.employe(id);
    if (actuel && actuel.ownerId === qui.userId) {
      const refus = await confirmerReglageSensible(b, actuel);
      if (refus) return send(res, refus.statut, { error: { message: refus.reason } });
    }
    /*
     * Un modèle choisi doit être servi à cette personne (la route n'accepte
     * pas la clé personnelle d'une autre). Le même que l'actuel ne se
     * revérifie pas : son modèle disparu, son propriétaire doit encore
     * pouvoir le mettre en pause ou changer son poste.
     */
    if (typeof b.modele === "string" && b.modele !== actuel?.modele) {
      const m = (await models(true)).find(
        (x) => x.uid === b.modele && x.roles.includes("chat") && (!x.proprietaire || x.proprietaire === qui.userId),
      );
      if (!m) return send(res, 400, { error: { message: t("Ce modèle n'est pas disponible pour vous."), code: "modele_indisponible" } });
    }
    return repondre(await employes.modifier(id, b, qui.userId), (e) => ({ employe: e }));
  }
  if (action === "supprimer" && req.method === "POST") {
    return repondre(await employes.supprimer(id, qui.userId), () => ({ ok: true }));
  }
  if (action === "message" && !sous && req.method === "POST") {
    const b = await corps();
    return repondre(await employes.parler(id, typeof b.texte === "string" ? b.texte : "", qui.userId), (v) => v);
  }
  if (action === "message" && sous && req.method === "GET") {
    const travail = employes.suivreTravail(sous, qui.userId);
    if (!travail || travail.employe !== id)
      return send(res, 404, { error: { message: t("Message introuvable.") } });
    return send(res, 200, { etat: travail.etat, reponse: travail.reponse ?? null });
  }
  /*
   * Ce que l'agent a fait, et ce qu'on lui a confié, ne regardent que son
   * propriétaire.
   *
   * `visiblePar` ne cache que les agents personnels : un agent d'organisation
   * est visible de tous, ce qui est voulu — chacun peut lui parler. Mais son
   * activité porte le résultat de ses missions, et ses documents portent les
   * noms des fichiers de son propriétaire. Toutes les autres routes de la
   * famille vérifiaient le propriétaire ; ces deux-là avaient été oubliées.
   */
  const sienOuRefus = async (): Promise<boolean> => {
    const cible = await employes.employe(id!);
    if (cible && cible.ownerId !== qui.userId) {
      send(res, 403, { error: { message: t("Cet agent ne vous appartient pas.") } });
      return false;
    }
    return true;
  };

  // Documents de référence de l'agent (voir employes.ts).
  if (action === "documents" && !sous && req.method === "GET") {
    if (!(await sienOuRefus())) return;
    return send(res, 200, { documents: employes.listerDocuments(id) });
  }
  if (action === "documents" && !sous && req.method === "POST") {
    if (estEnvoiEnFlux(req)) {
      const envoi = await lireEnvoi(req);
      if (!envoi.ok) return send(res, 400, { error: { message: envoi.message } });
      return repondre(await employes.ajouterDocumentEnFlux(id, envoi.entete, envoi.fichier, qui.userId), (documents) => ({ documents }));
    }
    const b = await readJson(req, CORPS_DOCUMENT_MAX).catch((err: unknown) => err as Error);
    if (b instanceof Error) {
      return send(res, 413, { error: { message: tf("Document trop lourd pour cet envoi : mettez l'application à jour (jusqu'à {0}).", LIBELLE_DOCUMENT_MAX) } });
    }
    const doc = b && typeof b === "object" && !Array.isArray(b) ? (b as Record<string, unknown>) : {};
    return repondre(await employes.ajouterDocument(id, doc, qui.userId), (documents) => ({ documents }));
  }
  if (action === "documents" && sous && sousAction === "supprimer" && req.method === "POST") {
    return repondre(await employes.retirerDocument(id, decodeURIComponent(sous), qui.userId), (documents) => ({ documents }));
  }
  if (action === "echanges" && req.method === "GET") {
    return send(res, 200, {
      echanges: await employes.echanges(qui.userId, id),
      enCours: employes.travailEnCours(id, qui.userId),
    });
  }
  if (action === "activite" && req.method === "GET") {
    if (!(await sienOuRefus())) return;
    return send(res, 200, await employes.activite(id));
  }
  /*
   * POST /helix/employes/<id>/connaissances : ce que l'employé lira
   * réellement dans ces bases (celles qu'on est en train de choisir, à défaut
   * les siennes), et pourquoi pas dans les autres. Même calcul que son outil
   * `connaissances__chercher` (serveurOutils.ts), rien n'est lu ni cherché.
   * Réservé à son propriétaire, comme le reste de sa fiche.
   */
  if (action === "connaissances" && !sous && req.method === "POST") {
    if (!(await sienOuRefus())) return;
    const e = await employes.employe(id);
    if (!e) return send(res, 404, { error: { message: t("Agent introuvable.") } });
    const b = await corps();
    const lecture = employes.lectureDesBases(e);
    const bases = await connaissances.lecturePourEmploye(
      Array.isArray(b.bases) ? b.bases : (e.connaissances ?? []),
      auteurEmploye(e.id),
      await employes.lecteursDe(e, lecture),
      { userId: qui.userId, groupes: qui.groupes ?? [] },
    );
    return send(res, 200, { ...lecture, bases });
  }
  /*
   * Sa mémoire mise de côté (employes.ts, `viderMemoire`) : la liste des
   * copies (des nombres et des dates), les restaurer, les supprimer. Réservé
   * à son propriétaire.
   */
  if (action === "memoire" && !sous && req.method === "GET") {
    return repondre(await employes.copiesMemoire(id, qui.userId), (v) => v);
  }
  if (action === "memoire" && sous && sousAction === "restaurer" && req.method === "POST") {
    return repondre(await employes.restaurerMemoire(id, sous, qui.userId), (v) => v);
  }
  if (action === "memoire" && sous && sousAction === "supprimer" && req.method === "POST") {
    return repondre(await employes.supprimerCopieMemoire(id, sous, qui.userId), () => ({ ok: true }));
  }
  // Canaux : les brancher, les retirer, lier WhatsApp, accepter les personnes qui écrivent.
  if (action === "canaux" && !sous && req.method === "GET") {
    return send(res, 200, { etat: await employes.etatCanaux(id) });
  }
  if (action === "canaux" && !sous && req.method === "POST") {
    return repondre(await employes.brancherCanal(id, await corps(), qui.userId), (e) => ({ employe: e }));
  }
  if (action === "canaux" && sous && sousAction === "retirer" && req.method === "POST") {
    return repondre(await employes.retirerCanal(id, sous, qui.userId), (e) => ({ employe: e }));
  }
  if (action === "canaux" && sous === "whatsapp" && sousAction === "qr" && req.method === "POST") {
    const b = await corps();
    return repondre(await employes.liaisonWhatsApp(id, qui.userId, b.attendre === true), (v) => v);
  }
  if (action === "demandes" && !sous && req.method === "GET") {
    return repondre(await employes.demandesAcces(id, qui.userId), (demandes) => ({ demandes }));
  }
  if (action === "demandes" && sous && sousAction && quatrieme === "accepter" && req.method === "POST") {
    return repondre(await employes.accepterDemande(id, sous, sousAction, qui.userId), () => ({ ok: true }));
  }
  if (action === "missions" && sous && sousAction === "lancer" && req.method === "POST") {
    const e = await employes.employe(id);
    if (e && e.ownerId !== qui.userId) {
      return send(res, 403, { error: { message: t("Seule la personne qui l'a créé peut lancer ses missions.") } });
    }
    return repondre(await employes.lancerMission(id, sous, qui.userId), () => ({ ok: true }));
  }
  send(res, 404, { error: { message: tf("Route inconnue : {0} {1}", req.method, path) } });
}

/* ---------------------------------- serveur ----------------------------------- */

/*
 * Chiffrement du transport : décidé au démarrage. Une instance ouverte au
 * réseau ne sert jamais en clair (voir tls.ts).
 */
const tls = tlsMaterial();

const handler: http.RequestListener = (req, res) => {
  /*
   * Une adresse qu'on ne sait pas lire : 400, et rien d'autre (test d'intrusion
   * du 27/09/2026). Un en-tête `Host` vide faisait lever `new URL` hors de tout
   * `try`, et la passerelle entière s'arrêtait, sans jeton ni séance, pour
   * tous les postes. On ne se sert plus de `Host` pour lire le chemin.
   */
  let url: URL;
  try {
    url = new URL(req.url ?? "/", "http://localhost");
  } catch {
    res.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ error: { message: t("Requête illisible.") } }));
    return;
  }
  const path = url.pathname.replace(/\/+$/, "") || "/";

  // La langue de l'auteur de la requête, lisible partout en dessous (langue.ts).
  return avecLangueDe(req.headers, url, () => traiter(req, res, url, path));
};

const traiter = (
  req: http.IncomingMessage,
  res: http.ServerResponse,
  url: URL,
  path: string,
): unknown => {

  if (req.method === "OPTIONS") {
    /*
     * Préparation CORS. Une origine non reconnue reçoit une réponse sans
     * `Access-Control-Allow-Origin` : le navigateur en conclut que la requête
     * n'est pas permise et ne l'envoie jamais. C'est un refus, pas une erreur —
     * la préparation elle-même reste un 204, comme le veut la spécification.
     */
    res.writeHead(204, {
      ...entetesOrigine(req),
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      /*
       * Tout en-tête que l'écran pose doit figurer ici : sans lui, le
       * navigateur refuse la requête avant même de l'envoyer. X-Helix-Session
       * porte l'identité, X-Helix-Langue la langue de lecture — oublier le
       * second avait coupé toutes les requêtes d'un poste rattaché, y compris
       * celles qui n'avaient rien à voir avec la langue.
       */
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Helix-Session, X-Helix-Langue",
      "Access-Control-Max-Age": "600",
    });
    return res.end();
  }

  /*
   * Clés d'API personnelles (clesApi.ts), avant le jeton d'instance : une clé
   * le remplace, mais seulement sur les `ROUTES_CLE`. Ailleurs, elle est
   * refusée sans même être vérifiée, et elle ne se présente que dans
   * `Authorization: Bearer` — jamais dans l'adresse, où elle finirait dans un
   * historique ou le journal d'un proxy.
   */
  if (clesApi.cleMalPlacee(req, url)) {
    return send(res, 401, {
      error: {
        message: t(
          "Une clé d'API se présente dans l'en-tête Authorization: Bearer, jamais dans l'adresse ni ailleurs. Par prudence, révoquez celle-ci et créez-en une autre.",
        ),
        code: "cle_mal_placee",
      },
    });
  }
  const cleApi = clesApi.clePresentee(req);
  if (cleApi) {
    if (!ROUTES_CLE.some((r) => r.methode === req.method && r.chemin === path)) {
      return send(res, 403, {
        error: {
          message: t("Une clé d'API n'ouvre que l'API compatible OpenAI (/v1/models, /v1/chat/completions)."),
          code: "hors_portee",
        },
      });
    }
    return void traiterParCle(req, res, url, path, cleApi).catch((err) => erreurInattendue(res, err));
  }

  // Toute route autre que le contrôle de présence exige le jeton d'instance :
  // la passerelle donne accès aux données, aux fichiers et à l'exécution
  // d'outils, elle ne peut pas être ouverte sur le réseau.
  const authorised = authorise(req, url, path);
  if (!authorised) {
    return send(res, 401, {
      error: {
        message:
          t("Jeton d'instance manquant ou invalide. L'administrateur le fournit avec l'adresse de l'instance."),
      },
    });
  }

  /*
   * Limitation de débit : quelques routes relisent des fichiers entiers ou
   * font tourner un interpréteur, et l'authentification se répète à volonté.
   * On identifie l'appelant par son jeton de séance, à défaut par son adresse
   * (voir debit.ts).
   */
  const entete = req.headers["x-helix-session"];
  const jeton = (typeof entete === "string" ? entete : entete?.[0]) ?? url.searchParams.get("session");
  /*
   * Une séance ne compte comme appelant que si elle est valide (revue du
   * 26/09/2026) : un en-tête inventé à chaque requête donnait un compteur
   * neuf à chaque fois, et l'essai de mots de passe sur tous les comptes
   * n'était plus freiné. Sinon, c'est l'adresse qui compte. `demandeur` est
   * mémorisé par requête : la route ne refait pas la recherche.
   */
  const run = async () => {
    const seanceValide = jeton ? Boolean(await demandeur(req, url).catch(() => null)) : false;
    const appelant = jeton && seanceValide
      ? `s:${createHash("sha256").update(jeton).digest("hex").slice(0, 32)}`
      : `a:${req.socket.remoteAddress ?? "inconnue"}`;
    const debitVerdict = debit.verifier(req.method ?? "", path, appelant);
    if (!debitVerdict.ok) {
      res.setHeader("Retry-After", String(debitVerdict.retenteDans ?? 60));
      return send(res, 429, {
        error: {
          // Une phrase par nombre (28/09/2026) : le « s » collé restait tel quel en chinois.
          message:
            (debitVerdict.retenteDans ?? 0) > 1
              ? tf("Trop de requêtes sur cette route. Réessayez dans {0} secondes.", debitVerdict.retenteDans)
              : tf("Trop de requêtes sur cette route. Réessayez dans {0} seconde.", debitVerdict.retenteDans),
        },
      });
    }

    if (req.method === "GET" && (path === "/health" || path === "/")) {
      return handleHealth(res, hasValidToken(req, url));
    }
    /*
     * Barrière commune aux routes d'exécution. Elle est posée avant le routage
     * pour qu'une route ajoutée plus tard ne puisse pas l'oublier par omission.
     */
    if (exigeSeance(req.method ?? "", path) && !(await demandeur(req, url))) {
      return send(res, 401, sansSeance());
    }

    if (req.method === "GET" && path === "/v1/models") return handleModels(req, res, url, true);
    if (req.method === "GET" && path === "/helix/models") return handleModels(req, res, url, false);
    if (req.method === "POST" && path === "/v1/chat/completions")
      return handleChat(req, res, url);
    if (req.method === "POST" && path === "/helix/models/load") return handleLoad(req, res);
    if (req.method === "GET" && path === "/helix/provision") return handleProvisionStatus(res);
    if (req.method === "POST" && path === "/helix/provision/moteur/relancer")
      return handleEngineRestart(req, res, url);
    if (req.method === "POST" && path === "/helix/provision/moteur")
      return handleEngineInstall(req, res, url);
    if (req.method === "POST" && path === "/helix/provision/start")
      return handleProvisionStart(req, res);
    if (req.method === "GET" && path === "/helix/provision/stream")
      return handleProvisionStream(req, res);
    if (req.method === "GET" && path === "/helix/emplacement-modeles") return handleEmplacementEtat(req, res, url);
    if (req.method === "POST" && path === "/helix/emplacement-modeles") return handleEmplacementChoix(req, res, url);
    if (req.method === "POST" && path === "/helix/emplacement-modeles/verifier") return handleEmplacementVerifier(req, res, url);
    if (path === "/helix/optimisation-locale" || path === "/helix/optimisation-locale/conseil") {
      const qui = await demandeur(req, url);
      if (!qui) return send(res, 401, sansSeance());
      const admin = await estAdministrateur(qui.userId);
      if (path.endsWith("/conseil") && req.method === "POST") {
        if (!admin) return send(res, 403, { error: { message: t("Seul l'administrateur de l'instance peut modifier ce réglage.") } });
        try { return send(res, 200, await optimisation.demanderConseilLocal(tousLesBackends(), detectHardware())); }
        catch (e) { return send(res, 409, { error: { message: e instanceof Error ? e.message : t("Demande refusée.") } }); }
      }
      if (path === "/helix/optimisation-locale" && req.method === "POST") {
        if (!admin) return send(res, 403, { error: { message: t("Seul l'administrateur de l'instance peut modifier ce réglage.") } });
        const corps = await readJson(req) as { mode?: unknown };
        if (corps.mode !== "standard" && corps.mode !== "automatique") return send(res, 400, { error: { message: t("Choix inconnu.") } });
        await optimisation.reglerOptimisation(corps.mode, qui.userId);
      } else if (req.method !== "GET" || path.endsWith("/conseil")) return send(res, 405, {});
      return send(res, 200, { ...optimisation.diagnosticOptimisation(detectHardware()), admin });
    }
    if (req.method === "GET" && path === "/helix/moteur-lmstudio") return handleMoteurLmStudioEtat(req, res, url);
    if (req.method === "POST" && path === "/helix/moteur-lmstudio") return handleMoteurLmStudioChoix(req, res, url);
    if (req.method === "POST" && path === "/helix/auth/create")
      return handleAuthCreate(req, res, url);
    if (req.method === "POST" && path === "/helix/auth/premier-mot-de-passe")
      return handlePremierMotDePasse(req, res);
    if (req.method === "POST" && path === "/helix/auth/mot-de-passe-provisoire")
      return handleChangerProvisoire(req, res);
    if (req.method === "POST" && path === "/helix/auth/verify")
      return handleAuthVerify(req, res);
    // Mot de passe oublié (23/10/2026) : code de récupération, codes à tirer, réinitialisation par un administrateur.
    if (req.method === "POST" && path === "/helix/auth/recuperer")
      return handleRecuperer(req, res);
    if ((req.method === "GET" || req.method === "POST") && path === "/helix/auth/codes-recuperation")
      return handleCodesRecuperation(req, res, url);
    if ((req.method === "GET" || req.method === "POST") && path === "/helix/auth/reinitialiser")
      return handleReinitialiser(req, res, url);
    if (req.method === "GET" && path === "/helix/export") return handleExport(req, res, url);
    if (req.method === "DELETE" && path.startsWith("/helix/memoire-chat/"))
      return handleOublierMemoireChat(req, res, url, path.slice("/helix/memoire-chat/".length));
    if (req.method === "GET" && path === "/helix/compte/effacement")
      return handleEffacement(req, res, url, "apercu");
    if (req.method === "POST" && path === "/helix/compte/effacer")
      return handleEffacement(req, res, url, "effacer");
    if (req.method === "POST" && path === "/helix/auth/deux-facteurs")
      return handleDeuxFacteurs(req, res);
    if (req.method === "POST" && path === "/helix/auth/deux-facteurs/inscription")
      return handleInscriptionDeuxFacteurs(req, res, "preparer");
    if (req.method === "POST" && path === "/helix/auth/deux-facteurs/inscription/activer")
      return handleInscriptionDeuxFacteurs(req, res, "activer");
    if (req.method === "GET" && path === "/helix/auth/deux-facteurs/etat")
      return handleReglageDeuxFacteurs(req, res, url, "etat");
    if (req.method === "POST" && path === "/helix/auth/deux-facteurs/preparer")
      return handleReglageDeuxFacteurs(req, res, url, "preparer");
    if (req.method === "POST" && path === "/helix/auth/deux-facteurs/activer")
      return handleReglageDeuxFacteurs(req, res, url, "activer");
    if (req.method === "POST" && path === "/helix/auth/deux-facteurs/desactiver")
      return handleReglageDeuxFacteurs(req, res, url, "desactiver");
    if (req.method === "POST" && path === "/helix/auth/deux-facteurs/codes")
      return handleReglageDeuxFacteurs(req, res, url, "codes");
    if (req.method === "POST" && path === "/helix/auth/profil")
      return handleAuthProfil(req, res, url);
    if (req.method === "GET" && path === "/helix/data") return handleDataRevisions(res);
    if (req.method === "GET" && path === "/helix/audit") return handleAudit(req, res, url);
    if (req.method === "GET" && path === "/helix/auth/sessions")
      return handleSessionsList(req, res, url);
    if (req.method === "POST" && path === "/helix/auth/revoke")
      return handleSessionRevoke(req, res, url);
    if (path.startsWith("/helix/data/")) {
      const name = path.slice("/helix/data/".length);
      if (req.method === "GET") return handleDataRead(req, res, url, name);
      if (req.method === "PUT") return handleDataWrite(req, res, url, name);
    }
    if (req.method === "GET" && path === "/helix/code") return handleCodeStatus(req, res, url);
    if (req.method === "GET" && path === "/helix/dossiers")
      return handleDossiers(req, res, url);
    if (req.method === "POST" && path === "/helix/code/session")
      return handleCodeSession(req, res);
    if (req.method === "POST" && path === "/helix/code/prompt")
      return handleCodePrompt(req, res);
    /*
     * Pose OpenCode, le moteur de l'écran Code (opencodePrive.ts) : un logiciel
     * installé sur la machine de l'instance, donc l'administrateur, comme le
     * moteur des modèles. En arrière-plan ; l'écran suit `GET /helix/code`.
     */
    if (req.method === "POST" && path === "/helix/code/installer") {
      return avecSeance(req, res, url, async (qui) => {
        if (!(await estAdministrateur(qui.userId))) {
          return send(res, 403, { error: { message: t("Seul l'administrateur de l'instance installe le moteur de l'écran Code.") } });
        }
        // Lancée d'office à l'ouverture de l'écran (27/09/2026) ou par « Réessayer » : le journal distingue les deux.
        const corps = (await readJson(req).catch(() => ({}))) as { ouverture?: unknown };
        journaliser("code.opencode_installe", qui.userId, corps.ouverture === true ? { automatique: true } : {});
        void installerOpencode()
          .then(() => oublierOpencode())
          .catch((err: unknown) => console.error("[helix] installation d'OpenCode :", err instanceof Error ? err.message : err));
        send(res, 202, { started: true });
      });
    }
    if (req.method === "POST" && path === "/helix/code/interrupt")
      return handleCodeInterrupt(req, res);
    /*
     * RTK (rtk.ts) : s'il est posé, et les jetons qu'il a épargnés dans une
     * session, d'après l'historique qu'il tient sur ce poste. Séance requise,
     * et la session doit être à la personne : ses commandes n'intéressent qu'elle.
     */
    if (req.method === "GET" && path === "/helix/code/rtk") {
      return avecSeance(req, res, url, async (qui) => {
        relayerReplis();
        const sessionID = url.searchParams.get("sessionID");
        if (!sessionID) return send(res, 200, { etat: etatRtk() });
        if (!SESSION_CODE.test(sessionID)) return send(res, 400, { error: { message: t("`sessionID` invalide.") } });
        const acces = await refusSessionCode(sessionID, qui.userId);
        if ("statut" in acces) return send(res, acces.statut, { error: { message: acces.message } });
        send(res, 200, { etat: etatRtk(), session: { actif: rtkActifDans(sessionID), economies: await economiesSession(sessionID) } });
      });
    }
    /*
     * Sessions de Code de la personne (sessionsCode.ts) : la liste, l'historique
     * d'une session pour la rouvrir, et « retirer de la liste » (la conversation
     * reste chez OpenCode). Séance requise : on ne liste que les siennes.
     */
    if (req.method === "GET" && path === "/helix/code/sessions")
      return avecSeance(req, res, url, (qui) => handleCodeSessions(res, qui.userId));
    if (path.startsWith("/helix/code/sessions/")) {
      const id = path.slice("/helix/code/sessions/".length);
      if (!SESSION_CODE.test(id)) return send(res, 400, { error: { message: t("`sessionID` invalide.") } });
      if (req.method === "GET") return avecSeance(req, res, url, (qui) => handleCodeSessionHistorique(res, qui.userId, id));
      if (req.method === "DELETE") {
        return avecSeance(req, res, url, async (qui) => {
          /*
           * Pas pendant que l'agent y travaille (27/09/2026) : retirée de la
           * liste en plein travail, la session disparaissait de l'écran et de
           * la liste, et l'agent continuait de modifier le projet sans que
           * personne puisse le voir ni l'arrêter. Seulement pour sa
           * propriétaire : un autre compte n'apprend rien de la session.
           */
          const siennes = (await sessionCode(id).catch(() => undefined))?.userId === qui.userId;
          if (siennes && auTravailCode(id)) {
            return send(res, 409, { error: { message: t("L'agent travaille encore sur cette session : arrêtez-la avant de la retirer de la liste.") } });
          }
          const ok = await retirerSessionCode(id, qui.userId).catch(() => false);
          send(res, ok ? 200 : 404, ok ? { ok: true } : { error: { message: t("Session de code inconnue.") } });
        });
      }
    }
    /*
     * Serveur d'outils de l'agent de code : appelé par OpenCode, sans séance,
     * sur preuve de la clé écrite dans sa configuration (outilsCode.ts). La
     * personne pour qui il travaille est retrouvée par la passerelle, jamais
     * lue dans la requête.
     */
    if (path === "/helix/code/outils") {
      const corps = req.method === "POST" ? await readJson(req).catch(() => undefined) : undefined;
      if (!(await servirOutilsCode(req, res, corps))) {
        send(res, 403, { error: { message: t("Accès réservé à l'agent de code de l'instance.") } });
      }
      return;
    }
    if (req.method === "GET" && path === "/helix/code/events") {
      /*
       * `sessionID` et non plus `session` : depuis que ce flux exige une séance,
       * les deux se disputaient le même nom dans l'URL. `EventSource` ne pose
       * pas d'en-tête, le jeton de séance voyage donc en `?session=` comme le
       * jeton d'instance en `?token=` — et `searchParams.get("session")` rendait
       * le premier des deux, c'est-à-dire l'identifiant OpenCode. Résultat : la
       * séance n'était jamais résolue et le flux répondait 401 à un poste
       * pourtant connecté. Deux choses différentes, deux noms différents.
       */
      const sessionID = url.searchParams.get("sessionID");
      if (!sessionID) return send(res, 400, { error: { message: t("`sessionID` requis.") } });
      return handleCodeEvents(req, res, sessionID, url);
    }
    /*
     * Codex, second moteur de l'écran Code, réservé au propriétaire du poste
     * (codex.ts, codexGarde.ts ; PROJET.md § 3.14, décidé le 27/09/2026). Ce
     * que la passerelle sait de la requête est établi ici, jamais lu dans la
     * requête elle-même.
     */
    if (path === "/helix/codex" || path.startsWith("/helix/codex/")) {
      return avecSeance(req, res, url, async (qui) =>
        routeCodex(req, res, path, {
          userId: qui.userId,
          contexte: {
            bureau: surLeBureau(),
            partagee: instancePartagee(),
            depuisCePoste: depuisLaBoucle(req),
            jetonsDansAdresse: ["token", "session", "flux"].some((p) => url.searchParams.has(p)),
            parCleApi: parCleApi.has(req),
            administrateur: await estAdministrateur(qui.userId),
          },
          lireCorps: () => readJson(req, 1024 * 1024),
          envoyer: (status, corps) => send(res, status, corps),
        }),
      );
    }
    if (req.method === "GET" && path === "/helix/computer") return avecSeance(req, res, url, (qui) => handleComputerStatus(res, qui));
    if (req.method === "POST" && path === "/helix/computer/action")
      return handleComputerAction(req, res, url);
    if (req.method === "POST" && path === "/helix/computer/approve")
      return handleComputerApprove(req, res, url);
    if (req.method === "POST" && path === "/helix/computer/mode")
      return handleComputerMode(req, res, url);
    if (req.method === "GET" && path === "/helix/machine") return handleMachineEtat(req, res, url);
    if (req.method === "POST" && path === "/helix/machine/demarrer") return handleMachineAction(req, res, url, "demarrer");
    if (req.method === "POST" && path === "/helix/machine/arreter") return handleMachineAction(req, res, url, "arreter");
    if (req.method === "POST" && path === "/helix/machine/effacer") return handleMachineAction(req, res, url, "effacer");
    if (req.method === "GET" && path === "/helix/machine/ecran") return handleMachineEcran(req, res, url);
    if (req.method === "POST" && path === "/helix/videos/scenario") {
      const qui = await demandeur(req, url);
      if (!qui) return send(res, 401, sansSeance());
      const corps = await readJson(req) as { brief?: unknown };
      if (typeof corps.brief !== "string" || !corps.brief.trim() || corps.brief.length > 2000) return send(res, 400, { error: { message: t("Décrivez votre vidéo en 2 000 caractères au plus.") } });
      try { return send(res, 200, { scenes: await preparerScenario(corps.brief, qui.userId) }); }
      catch (e) { return send(res, 409, { error: { message: e instanceof Error ? e.message : t("Demande refusée.") } }); }
    }
    if (path === "/helix/videos" || path.startsWith("/helix/videos/")) return handleVideos(req, res, url, path.slice("/helix/videos".length).replace(/^\//, ""));
    if (["GET", "POST"].includes(req.method ?? "") && path === "/helix/code/vps") return handleVps(req,res,url);
    if (["GET", "POST"].includes(req.method ?? "") && path === "/helix/studio/medias") return handleMediasStudio(req, res, url);
    if (req.method === "POST" && path.startsWith("/helix/studio/medias/")) return handleMediasStudio(req, res, url, path.slice("/helix/studio/medias/".length));
    if (req.method === "GET" && path === "/helix/images") return handleImagesEtat(req, res, url);
    // La recherche sur le web du Chat : permise ou non par le profil, et le moteur que la puce nomme (rechercheWeb.ts).
    if (req.method === "GET" && path === "/helix/recherche-web") return send(res, 200, etatRechercheWeb());
    if (routeEntrainement(path)) return handleEntrainement(req, res, url, path === "/helix/entrainement" ? "" : path.slice("/helix/entrainement/".length));
    if (req.method === "GET" && path === "/helix/import/logiciels") return handleImportLogiciels(req, res, url);
    if ((req.method === "GET" || req.method === "POST") && path.startsWith("/helix/import/logiciel/")) return handleImportLogiciels(req, res, url, path.slice("/helix/import/logiciel/".length));
    if (req.method === "POST" && path === "/helix/images/installer") return handleImagesInstaller(req, res, url, "installer");
    if (req.method === "POST" && path === "/helix/images/desinstaller") return handleImagesInstaller(req, res, url, "retirer");
    if (req.method === "POST" && path === "/helix/images/choisir") return handleImagesInstaller(req, res, url, "choisir");
    if (req.method === "POST" && path === "/helix/images/creer") return handleImagesCreer(req, res, url);
    if (req.method === "GET" && path.startsWith("/helix/images/travail/")) return handleImagesTravail(req, res, url, path.slice("/helix/images/travail/".length));
    if (req.method === "GET" && path.startsWith("/helix/images/fichier/")) return handleImagesFichier(req, res, url, path.slice("/helix/images/fichier/".length));
    if (req.method === "GET" && path === "/helix/computer/events")
      return avecSeance(req, res, url, (qui) => handleComputerStream(req, res, qui));

    if (req.method === "GET" && path === "/helix/approbation")
      return avecSeance(req, res, url, (qui) => handleApprobationEtat(res, qui));
    if (req.method === "POST" && path === "/helix/approbation/niveau")
      return handleApprobationNiveau(req, res, url);
    if (req.method === "POST" && path === "/helix/approbation/repondre")
      return handleApprobationRepondre(req, res, url);
    if (req.method === "GET" && path === "/helix/approbation/evenements")
      return avecSeance(req, res, url, (qui) => handleApprobationFlux(req, res, qui));

    if (req.method === "GET" && path === "/helix/atelier")
      return handleAtelierDiagnostic(res);
    if (req.method === "POST" && path === "/helix/atelier/preparer")
      return handleAtelierPreparer(req, res);
    if (req.method === "POST" && path === "/helix/atelier/verifier")
      return handleAtelierVerifier(res);

    if (req.method === "GET" && path === "/helix/dictee") return handleDicteeEtat(res);
    if (req.method === "POST" && path === "/helix/dictee/installer")
      return handleDicteeInstaller(req, res, url);
    if (req.method === "POST" && path === "/helix/dictee") return handleDictee(req, res, url);

    if (req.method === "GET" && path === "/helix/courrier")
      return handleCourrierEtat(req, res, url);
    if (req.method === "POST" && path === "/helix/courrier/configurer")
      return handleCourrierConfigurer(req, res, url);
    if (req.method === "POST" && path === "/helix/courrier/oauth")
      return handleCourrierOauth(req, res, url);
    if (req.method === "POST" && path === "/helix/courrier/oauth/coller")
      return handleCourrierOauthColler(req, res, url);
    if (req.method === "POST" && path === "/helix/courrier/envoi")
      return handleCourrierEnvoi(req, res, url);
    if (req.method === "POST" && path === "/helix/courrier/confirmation")
      return handleCourrierConfirmation(req, res, url);
    if (req.method === "POST" && path === "/helix/courrier/oublier")
      return handleCourrierOublier(req, res, url);

    if (req.method === "GET" && path === "/helix/agenda") return handleAgendaEtat(res, url);
    if (req.method === "POST" && path === "/helix/agenda/configurer")
      return handleAgendaConfigurer(req, res, url);
    if (req.method === "POST" && path === "/helix/agenda/oublier")
      return handleAgendaOublier(req, res, url);

    // Tâches programmées (tachesProgrammees.ts).
    if (path === "/helix/taches-programmees" || path.startsWith("/helix/taches-programmees/")) return handleTachesProgrammees(req, res, url, path);
    // Application Google de l'instance (clientGoogle.ts), partagée par Drive et Google Agenda.
    if (req.method === "GET" && path === "/helix/google/client") return handleClientGoogleEtat(req, res, url);
    if (req.method === "POST" && path === "/helix/google/client") return handleClientGoogleEnregistrer(req, res, url);
    if (req.method === "POST" && path === "/helix/google/client/effacer") return handleClientGoogleEffacer(req, res, url);
    // Google Agenda par la connexion Google (agendaGoogle.ts).
    if (req.method === "GET" && path === "/helix/agenda/google") return handleAgendaGoogleEtat(req, res, url);
    if (req.method === "POST" && path === "/helix/agenda/google/connecter") return handleAgendaGoogleConnecter(req, res, url);
    if (req.method === "POST" && path === "/helix/agenda/google/code") return handleAgendaGoogleCode(req, res, url);
    if (req.method === "POST" && path === "/helix/agenda/google/oublier") return handleAgendaGoogleOublier(req, res, url);
    // Sheets, Slides, YouTube, LinkedIn, Facebook, Instagram, TikTok (oauthNatif.ts, 28/09/2026).
    if (path === "/helix/natifs" || path.startsWith("/helix/natifs/")) return handleNatifs(req, res, url, path.slice("/helix/natifs".length));
    // Telegram, Discord, WhatsApp (natifs/messageries.ts). Le webhook de WhatsApp est public (auth.ts) : signé par Meta, vérifié par le module.
    if (path === messageries.CHEMIN_WEBHOOK) return messageries.webhookWhatsApp(req, res, url);
    if (path === "/helix/messageries" || path.startsWith("/helix/messageries/")) return handleMessageries(req, res, url, path.slice("/helix/messageries".length));
    if (path === "/helix/commerce" || path.startsWith("/helix/commerce/")) return handleCommerce(req, res, url, path.slice("/helix/commerce".length));
    if (req.method === "GET" && path === "/helix/drive") return handleDriveEtat(res);
    if (req.method === "POST" && path === "/helix/drive/connecter")
      return handleDriveConnecter(req, res, url);
    if (req.method === "POST" && path === "/helix/drive/code") return handleDriveCode(req, res, url);
    if (req.method === "POST" && path === "/helix/drive/oublier")
      return handleDriveOublier(req, res, url);
    if (req.method === "GET" && path === "/helix/slack") return handleSlackEtat(res);
    if (req.method === "POST" && path === "/helix/slack/configurer")
      return handleSlackConfigurer(req, res, url);
    if (req.method === "POST" && path === "/helix/slack/oublier")
      return handleSlackOublier(req, res, url);

    /*
     * Billet d'ouverture de flux : une requête normale, avec ses en-têtes, qui
     * rend une valeur à usage unique et d'une minute. Elle remplace les deux
     * jetons dans l'adresse des flux d'évènements (flux.ts).
     */
    /*
     * Téléchargement direct de l'application (telechargement.ts).
     *
     * L'état et la préparation passent par une séance, comme le reste. Le
     * fichier lui-même s'ouvre dans le navigateur, qui ne sait pas poser
     * d'en-tête sur un lien : il se présente donc avec un billet d'une minute
     * et d'un seul usage (`?flux=`), exactement comme les flux d'évènements.
     */
    /*
     * Mises à jour des postes rattachés (telechargement.ts, fluxMiseAJour) :
     * le jeton d'instance suffit, c'est le processus principal de
     * l'application qui demande, sans séance. Seulement la description de la
     * version et l'archive de l'application : rien des données de personne.
     */
    if (req.method === "GET" && path === "/helix/mises-a-jour/latest-mac.yml") {
      const f = await telechargement.fluxMiseAJour();
      if ("erreur" in f) return send(res, 404, { error: { message: f.erreur } });
      res.writeHead(200, { "Content-Type": "text/yaml; charset=utf-8", "Cache-Control": "no-store" });
      return void res.end(f.yml);
    }
    {
      const archive = /^\/helix\/mises-a-jour\/([A-Za-z0-9._-]+\.zip)$/.exec(path);
      if (req.method === "GET" && archive) {
        if (archive[1] !== telechargement.nomArchiveMiseAJour()) return send(res, 404, { error: { message: t("Archive inconnue.") } });
        return telechargement.servir(res, "macos");
      }
    }
    if (req.method === "GET" && path === "/helix/telecharger") {
      return avecSeance(req, res, url, () => {
        send(res, 200, {
          paquets: (["macos", "windows", "linux"] as const).map((p) => telechargement.etat(p)),
        });
      });
    }
    if (req.method === "POST" && path === "/helix/telecharger/macos/preparer") {
      return avecSeance(req, res, url, async () => {
        const r = await telechargement.preparer();
        send(res, r.ok ? 200 : 503, r.ok ? { ok: true, etat: telechargement.etat("macos") } : { error: { message: r.message } });
      });
    }
    {
      const telecharger = /^\/helix\/telecharger\/(macos|windows|linux)$/.exec(path);
      if (req.method === "GET" && telecharger) {
        return avecSeance(req, res, url, () =>
          telechargement.servir(res, telecharger[1] as telechargement.Plateforme),
        );
      }
    }

    if (req.method === "POST" && path === "/helix/flux/ticket") {
      return avecSeance(req, res, url, (qui) => {
        const { billet, expireDansMs } = flux.creer(qui.userId);
        send(res, 200, { billet, expireDansMs });
      });
    }

    if (req.method === "GET" && path === "/helix/mcp") return handleMcpStatus(res);
    if (req.method === "POST" && path === "/helix/mcp/toggle") return handleMcpToggle(req, res);
    if (req.method === "POST" && path === "/helix/mcp/workspace")
      return handleWorkspace(req, res, url);

    if (req.method === "GET" && path === "/helix/connecteurs")
      return handleConnecteursEtat(req, res, url);
    if (req.method === "POST" && path === "/helix/connecteurs/personnalise")
      return handleConnecteurPersonnalise(req, res, url);
    if (req.method === "POST" && path === "/helix/connecteurs/personnalise/lectures")
      return handleConnecteurLectures(req, res, url);
    if (req.method === "POST" && path === "/helix/connecteurs/ajouter")
      return handleConnecteurAjouter(req, res, url);
    if (req.method === "GET" && path === "/helix/reseau")
      return avecSeance(req, res, url, (qui) => handleReseauEtat(res, qui));
    if (req.method === "POST" && path === "/helix/reseau")
      return handleReseauRegler(req, res, url);

    if (req.method === "POST" && path === "/helix/invitations/inviter")
      return handleInviter(req, res, url);
    if (path === "/helix/invitations" && (req.method === "GET" || req.method === "POST"))
      return handleInvitations(req, res, url);
    if (req.method === "POST" && path === "/helix/invitations/rejoindre")
      return handleRejoindre(req, res);

    if (req.method === "POST" && path === "/helix/connecteurs/connecter")
      return handleConnecteurConnecter(req, res, url);
    if (req.method === "POST" && path === "/helix/connecteurs/retirer")
      return handleConnecteurRetirer(req, res, url);
    if (req.method === "GET" && path === "/helix/oauth/retour")
      return handleOauthRetour(res, url);
    if (req.method === "GET" && path === "/helix/outils") return handleOutils(res);

    if (path === "/helix/employes" || path.startsWith("/helix/employes/")) {
      return handleEmployes(req, res, url, path);
    }
    if (routeFournisseur(path)) return handleFournisseurs(req, res, url, path);
    if (routeClesApi(path)) return handleClesApi(req, res, url, path);
    if (routeGroupe(path)) return handleGroupes(req, res, url, path);
    if (routeBibliotheque(path)) return handleBibliotheque(req, res, url, path);
    if (routeConnaissances(path)) return handleConnaissances(req, res, url, path);
    if (routeReunion(path)) return handleReunions(req, res, url, path);
    if (req.method === "GET" && path === "/helix/espace") {
      const r = listerEspace(url.searchParams.get("chemin") ?? "");
      return r.ok ? send(res, 200, r.valeur) : send(res, r.statut, { error: { message: r.message } });
    }
    if (req.method === "GET" && path === "/helix/espace/fichier") {
      const r = lireFichierEspace(url.searchParams.get("chemin") ?? "");
      if (!r.ok) return send(res, r.statut, { error: { message: r.message } });
      res.writeHead(200, {
        "Content-Type": "application/octet-stream",
        "Content-Length": r.valeur.taille,
        ...entetesOrigine(req),
        ...ENTETES_SECURITE,
      });
      return envoyerFlux(res, r.valeur.flux);
    }
    if (req.method === "POST" && path === "/helix/openclaw/installer") {
      const qui = await demandeur(req, url);
      if (!qui) return send(res, 401, sansSeance());
      /*
       * Déjà installé : c'est une mise à jour, vers la version éprouvée, et
       * seulement vers une version plus récente (OpenClaw fait migrer sa base :
       * une version plus ancienne ne pourrait plus l'ouvrir).
       */
      const avant = await employes.etatMoteur();
      /*
       * Installé, à jour, mais sans les bibliothèques Visual C++ de Microsoft
       * (Windows) : seule l'étape de Microsoft, puis le redémarrage de
       * l'instance (29/09/2026). Le paquet est celui épinglé dans visualCpp.ts :
       * la requête ne choisit rien.
       */
      if (avant.installe && !avant.miseAJour && avant.visualCpp) {
        reparerVisualCpp(qui.userId, employes.crochetsInstallation);
        return send(res, 202, { installation: etatInstallation() });
      }
      if (avant.installe && !avant.miseAJour) {
        return send(res, 409, { error: { message: tf("OpenClaw {0} est déjà à jour.", avant.version) } });
      }
      if (avant.installe) installerOpenClaw(qui.userId, employes.crochetsMiseAJour, avant.version);
      else installerOpenClaw(qui.userId, employes.crochetsInstallation);
      return send(res, 202, { installation: etatInstallation() });
    }

    if (req.method === "GET" && path === "/helix/usage") return handleUsage(req, res, url);
    if (req.method === "POST" && path === "/helix/usage/tarif")
      return handleUsageTarif(req, res, url);
    send(res, 404, { error: { message: tf("Route inconnue : {0} {1}", req.method, path) } });
  };

  run().catch((err) => erreurInattendue(res, err));
};

/**
 * Une exception imprévue ne se raconte pas au client.
 *
 * Son message porte des chemins absolus de la machine hôte, des erreurs
 * d'OpenSSL, des messages de la base — de quoi dresser la carte du serveur
 * en provoquant des erreurs. Le détail va au journal de l'instance, que
 * son administrateur lit ; le client reçoit un numéro pour qu'on puisse
 * retrouver la ligne correspondante.
 */
function erreurInattendue(res: http.ServerResponse, err: unknown): void {
  const reference = randomBytes(4).toString("hex");
  console.error(`[gateway] ${reference}`, err);
  if (!res.headersSent) {
    send(res, 500, {
      error: {
        message: tf("Erreur interne de l'instance (référence {0}). Le détail est dans le journal du serveur.", reference),
      },
    });
  } else {
    res.end();
  }
}

const server = tls
  ? https.createServer({ cert: tls.cert, key: tls.key }, handler)
  : http.createServer(handler);
/*
 * Node coupe par défaut toute requête dont le corps n'est pas arrivé en cinq
 * minutes : un document d'un gigaoctet envoyé à une instance distante, sur une
 * connexion ordinaire, échouait donc à coup sûr. Deux heures laissent passer
 * un gros envoi lent ; les en-têtes, eux, restent bornés à une minute.
 */
server.requestTimeout = 2 * 60 * 60 * 1000;
server.headersTimeout = 60_000;

/*
 * Arrêt propre. Fermer Helix doit tout refermer : le serveur OpenCode, et le
 * moteur de modèles si c'est nous qui l'avions démarré. Sans cela, un modèle de
 * plusieurs gigaoctets resterait en mémoire après la fermeture de la fenêtre.
 */
let arretEnCours = false;
function arreterProprement(): void {
  if (arretEnCours) return;
  arretEnCours = true;
  stopCodeServer();
  arreterCodex();
  // Un entraînement orphelin garderait plusieurs Go de mémoire graphique.
  entrainement.arreterEnPartant();
  stopLmStudioIfStarted();
  // Le moteur ouvert (Mac Intel) s'arrête avec la passerelle qui l'a lancé : il garderait le modèle en mémoire.
  arreterLlama();
  employes.arreterEmployes();
  // Les serveurs MCP locaux, et ce qu'ils ont lancé (mcp.ts, 28/09/2026).
  arreterServeursMcp();
  // La machine de l'agent garderait 3 Go de mémoire après la fermeture.
  if (configEcran().mode === "sandbox") arreterMachineEnPartant();
}

/*
 * Une erreur que personne n'a rattrapée ne doit pas arrêter l'instance de
 * toute une équipe (test d'intrusion du 27/09/2026 : une requête suffisait).
 * Elle est notée, sans le contenu des requêtes, et le service continue ; le
 * défaut qui l'a causée reste à corriger à la source.
 */
process.on("uncaughtException", (err) => {
  console.error("[helix] erreur non rattrapée :", err instanceof Error ? `${err.name}: ${err.message}` : String(err));
});
process.on("unhandledRejection", (raison) => {
  console.error("[helix] promesse rejetée sans suite :", raison instanceof Error ? `${raison.name}: ${raison.message}` : String(raison));
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    arreterProprement();
    process.exit(0);
  });
}
process.on("exit", arreterProprement);

/*
 * Sous Windows, il n'y a pas de signal à recevoir : `kill()` tuait net la
 * passerelle, et rien de ce qui précède ne tournait (audit du 27/09/2026 :
 * OpenCode, OpenClaw, le serveur de LM Studio restaient derrière). L'application
 * ouvre un canal au lancement et y demande l'arrêt. Canal coupé (application
 * arrêtée net, ou plantée) : la passerelle s'arrête aussi, au lieu de rester
 * seule sur le port. Sans canal (passerelle lancée à la main, serveur), rien
 * ne change.
 *
 * Depuis le 28/09/2026 le canal est celui d'un `utilityProcess`
 * (canalApplication.ts). L'application y demande aussi le Node de Helix pour
 * la commande `helix` (electron/ligneDeCommande.cjs) : ce canal ne s'ouvre
 * qu'entre l'application et sa passerelle, aucune route HTTP n'y mène.
 */
if (canalOuvert()) {
  ecouterLApplication((m) => {
    const message = m && typeof m === "object" ? (m as { type?: unknown; id?: unknown }) : null;
    if (message?.type === "arret") {
      arreterProprement();
      process.exit(0);
    }
    /*
     * Mot de passe oublié, sur la machine de l'instance (23/10/2026) :
     * l'application a fait reconnaître la session de l'ordinateur (Touch ID ou
     * mot de passe de la session sous macOS, code écrit dans un fichier du
     * dossier personnel ailleurs : electron/motDePasseOublie.cjs). C'est la
     * même porte que `npm run motdepasse`, `definirMotDePasse`, et aucune
     * route HTTP n'y mène : ce canal ne s'ouvre qu'entre l'application et la
     * passerelle qu'elle a lancée. Le mot de passe n'est écrit nulle part.
     */
    if (message?.type === "mot-de-passe-local") {
      const m = message as { id?: unknown; accountId?: unknown; motDePasse?: unknown; retirerDeuxFacteurs?: unknown };
      const id = m.id;
      if (typeof m.accountId !== "string" || typeof m.motDePasse !== "string") {
        envoyerALApplication({ type: "mot-de-passe-local", id, ok: false, raison: t("Compte introuvable.") });
        return;
      }
      void definirMotDePasse(m.accountId, m.motDePasse, "application de bureau", { retirerDeuxFacteurs: m.retirerDeuxFacteurs === true }).then(
        (r) => envoyerALApplication({ type: "mot-de-passe-local", id, ok: r.ok, ...(r.raison ? { raison: r.raison } : {}) }),
        () => envoyerALApplication({ type: "mot-de-passe-local", id, ok: false, raison: t("L'instance n'a pas pu enregistrer ce mot de passe.") }),
      );
    }
    if (message?.type === "node-prive") {
      const id = message.id;
      void assurerNodePrive().then(
        () => envoyerALApplication({ type: "node-prive", id, ok: true }),
        (err: unknown) => envoyerALApplication({ type: "node-prive", id, ok: false, erreur: err instanceof Error ? err.message : String(err) }),
      );
    }
  });
  surFinDuCanal(() => {
    arreterProprement();
    process.exit(0);
  });
}

/*
 * SIGUSR1 ouvre le débogueur de Node sur 127.0.0.1:9229, et un programme du
 * même compte y faisait tourner son code dans la passerelle, qui tient la clé
 * des données déchiffrée et toutes les séances (seconde tournée du test
 * d'intrusion, 28/09/2026). L'option `--disable-sigusr1` n'y fait rien dans un
 * `utilityProcess` : `execArgv` y est seulement recopié dans
 * `process.execArgv` (essayé le 28/09/2026 avec Electron 44.4.5 : le
 * débogueur s'ouvrait quand même, fusible --inspect ouvert). Écouter le signal
 * le retire au débogueur (même essai : plus rien sur 9229). La passerelle n'a
 * pas besoin de ce débogueur, en application comme en serveur. Windows n'a pas
 * ce signal.
 */
if (process.platform !== "win32") {
  process.on("SIGUSR1", () => {
    console.error("[helix] signal SIGUSR1 reçu et ignoré : le débogueur de Node reste fermé.");
  });
}

/*
 * Le magasin est remis sous sa forme chiffrée actuelle **avant** la première
 * requête : une réécriture qui croiserait l'écriture d'un poste pourrait
 * remettre l'ancienne valeur par-dessus la nouvelle. Une base injoignable ne
 * doit pas pour autant empêcher l'instance de démarrer et de le dire : au-delà
 * du délai, on écoute quand même, et les routes rendront l'erreur de la base.
 */
const DELAI_MIGRATION_MS = 15_000;

async function preparerMagasin(): Promise<void> {
  let delai: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      migrerChiffrement().then(({ reecrites }) => {
        if (reecrites.length > 0) {
          console.log(`[helix] chiffrement appliqué à : ${reecrites.join(", ")}.`);
        }
      }),
      new Promise<void>((resolve) => {
        delai = setTimeout(() => {
          console.warn("[helix] la base tarde à répondre : démarrage sans attendre la migration du chiffrement.");
          resolve();
        }, DELAI_MIGRATION_MS);
      }),
    ]);
  } catch (err) {
    console.warn(
      `[helix] migration du chiffrement interrompue : ${err instanceof Error ? err.message : String(err)}`,
    );
  } finally {
    clearTimeout(delai);
  }
  // Le mode d'écran choisi dans l'interface doit être connu avant la première
  // requête, même si la migration a échoué : il ne lève jamais d'erreur.
  await chargerReglagesEcran();
  // Le moteur de LM Studio que Helix peut démarrer (23/10/2026) : connu avant la première découverte, qui lancerait `lms`.
  await chargerChoixMoteur();
  await optimisation.chargerOptimisation();
  // Mode « machine de l'agent » choisi : elle démarre avec l'instance, sans attendre la première demande.
  if (configEcran().mode === "sandbox") void demarrerMachine().catch(() => undefined);
  // Les clés de modèles cloud doivent être des backends dès la première requête.
  await fournisseurs.chargerFournisseurs().catch(() => undefined);
}

/*
 * Le port pris (un autre Helix, un serveur de développement) : la passerelle
 * s'arrête, pour que l'application la relance plus tard. Sans cela, le filet
 * ci-dessus l'aurait gardée en vie sans rien servir.
 */
server.on("error", (err: NodeJS.ErrnoException) => {
  if (server.listening) return;
  console.error(`[helix-gateway] écoute impossible sur ${HOST}:${PORT} : ${err.code ?? err.message}`);
  process.exit(1);
});
void preparerMagasin().then(() => server.listen(PORT, HOST, () => {
  const schema = tls ? "https" : "http";
  console.log(`[helix-gateway] écoute sur ${schema}://${HOST}:${PORT}`);
  // L'adresse réellement ouverte (« localhost » peut donner ::1) : l'adresse de retour de X en dépend (oauthNatif.ts, SECURITE.md § 43).
  const ouverte = server.address();
  if (ouverte && typeof ouverte === "object") natifs.noterEcoute(ouverte.address);
  /*
   * Le port réellement ouvert, à côté du jeton (0600). La ligne de commande
   * ne lit le jeton du poste que pour ce port-là (cli/helix.mjs) : revue du
   * 26/09/2026, elle l'envoyait à n'importe quel port de la boucle locale,
   * c'est-à-dire à tout programme du poste qui y écoute.
   */
  try {
    const dossier = process.env.HELIX_DATA_DIR ?? joindre(dossierPersonnel(), ".helix", "data");
    writeFileSync(joindre(dossier, "instance-port"), `${PORT}\n`, { encoding: "utf8", mode: 0o600 });
    /*
     * ~/.helix lui-même en 0700 : revue du 26/09/2026, il restait en 0755
     * (`mkdirSync({ mode })` ne change pas un dossier existant), et les autres
     * comptes du Mac voyaient la liste de ce qu'il contient. Seulement pour le
     * dossier par défaut : un HELIX_DATA_DIR choisi appartient à l'administrateur.
     */
    if (!process.env.HELIX_DATA_DIR) chmodSync(joindre(dossierPersonnel(), ".helix"), 0o700);
  } catch (err) {
    console.error("[helix-gateway] port non noté pour la ligne de commande :", err instanceof Error ? err.message : err);
  }
  if (HOST === "127.0.0.1") {
    console.log("  (boucle locale uniquement — « share »: true pour ouvrir au réseau)");
  }
  if (tls?.autoSigne) {
    console.log(
      "  TLS auto-signé : le trafic est chiffré, mais les postes devront " +
        "accepter ce certificat. Pour une instance exposée durablement, " +
        "fournissez le vôtre via « tls » dans helix.config.json.",
    );
  } else if (tls) {
    console.log(`  TLS : certificat fourni (${tls.chemin}).`);
  }
  /*
   * Le jeton n'est plus imprimé.
   *
   * Il donne accès à l'instance. Sur la sortie standard, il finit dans le
   * journal de `launchd` ou de `systemd` — un fichier lisible bien plus
   * largement que celui, en 0600, prévu pour lui. On dit donc où il est, pas
   * ce qu'il est. Le fichier est de toute façon le seul endroit où le lire.
   */
  instanceToken(); // le crée au premier démarrage
  console.log(`  jeton d'instance : ${cheminDuJeton()}`);
  discover()
    .then(({ backends, models }) => {
      for (const b of backends) {
        console.log(
          `  ${b.online ? "✓" : "✗"} ${b.label.padEnd(14)} ${b.baseUrl}` +
            (b.online ? `  (${b.modelCount} modèles, ${b.latencyMs} ms)` : `  ${b.error ?? ""}`),
        );
      }
      console.log(`  → ${models.length} modèle(s) exposé(s).`);
    })
    .catch(() => {});

  /*
   * Le connecteur courrier construit sa liste d'outils sans attendre, parce que
   * chat.ts la demande au montage de chaque conversation. Sans cette lecture au
   * démarrage, la première conversation ouverte après un redémarrage se verrait
   * proposer une liste vide alors qu'une boîte est bel et bien connectée.
   *
   * Le connecteur agenda a exactement la même contrainte, pour la même raison.
   */
  void chargerCourrier().catch(() => {});
  // Indexation des bases de connaissances interrompue par un arrêt : elle reprend.
  connaissances.demarrer();
  void chargerAgenda().catch(() => {});
  // Google Drive et Slack : même contrainte, même raison (drive.ts, slack.ts).
  void chargerClientGoogle().catch(() => {});
  void drive.charger().catch(() => {});
  void agendaGoogle.charger().catch(() => {});
  void slack.charger().catch(() => {});
  // Sheets, Slides, YouTube, LinkedIn, Facebook, Instagram, TikTok (oauthNatif.ts) : même contrainte.
  void natifs.charger().catch(() => {});
  // Telegram, Discord, WhatsApp (natifs/messageries.ts) : même contrainte, et le relevé de Telegram reprend.
  void messageries.charger().catch(() => {});
  void commerce.charger().catch(() => {});
  // OpenCode manquant : posé en arrière-plan, sans attendre personne (27/09/2026, opencodeEnFond).
  codeEnFond();
  /*
   * Poste déjà installé : le modèle conseillé, jamais essayé sur cette
   * machine, passe l'essai une fois (provision.ts, 27/09/2026). Un quart de
   * minute après le démarrage, le temps que le moteur local se réveille ; un
   * échec ne gêne rien, l'essai se refera au premier chargement.
   */
  setTimeout(() => {
    void verifierModeleEnPlace().catch((err: unknown) => console.error("[helix] essai du modèle en place", err));
  }, 15_000).unref();
  // Mac Intel : les fichiers laissés par un modèle retiré du catalogue du moteur ouvert (llamaCpp.ts).
  if (moteurOuvert()) menageLlama();

  /*
   * Les connecteurs branchés se redéclarent **avant** le démarrage automatique :
   * sinon la passerelle ne relancerait que le serveur de fichiers, et Notion,
   * branché la veille, aurait silencieusement disparu de la liste d'outils.
   */
  connecteurs
    .charger()
    .catch(() => {})
    .then(() => startAutoServers())
    .then(() => {
      const servers = mcpStatus();
      const tools = servers.reduce((n, s) => n + s.toolCount, 0);
      console.log(`  → MCP : ${servers.filter((s) => s.running).length} serveur(s), ${tools} outil(s). Espace de travail : ${workspace()}`);
    })
    .catch(() => {})
    // Les employés en dernier : leur fiche de poste nomme les outils, qui doivent être là.
    .then(() => demarrerEmployes())
    .catch((err: unknown) => {
      console.warn(`[helix] employés non démarrés : ${err instanceof Error ? err.message : String(err)}`);
    });
}));

/**
 * L'instance OpenClaw des employés parle à la passerelle par la boucle locale.
 *
 * Quand la passerelle sert en TLS, un certificat fourni ne couvre en général
 * que le nom public de l'instance, pas 127.0.0.1 : OpenClaw le refuserait. Une
 * seconde écoute, en clair et sur la boucle locale seulement, sur un port tiré
 * au hasard, lui est donc réservée. Rien n'y passe qui ne passe déjà en clair
 * sur une instance non partagée (même machine), et le jeton y reste exigé.
 */
/*
 * Les tâches programmées (tachesProgrammees.ts) s'exécutent par la route du
 * Chat, sur la boucle locale, au nom de leur propriétaire. Cette clé, tirée au
 * sort à chaque démarrage et jamais écrite, est ce qui l'autorise : sans elle,
 * l'en-tête « x-helix-tache » ne vaut rien (vérifié dans handleChatCompletions).
 */
const CLE_TACHES = randomBytes(32).toString("base64url");

function demarrerTachesProgrammees(url: string): void {
  tachesProgrammees.demarrer(async (ownerId, messages, options) => {
    const reponse = await fetch(`${url}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${instanceToken()}`,
        "x-helix-tache": ownerId,
        "x-helix-cle-tache": CLE_TACHES,
        ...(options.titre ? { "x-helix-tache-titre": encodeURIComponent(options.titre) } : {}),
      },
      body: JSON.stringify({
        messages,
        role: "chat",
        effort: "moyen",
        tools: options.outils,
        stream: true,
        ...(options.modele ? { model: options.modele } : {}),
        ...(options.connaissances ? { connaissances: options.connaissances } : {}),
        // Les compétences de la propriétaire valent aussi pour ses tâches programmées (competences.ts, 23/10/2026).
        competences: true,
      }),
      signal: AbortSignal.timeout(30 * 60_000),
    });
    if (!reponse.ok || !reponse.body) {
      const j = (await reponse.json().catch(() => ({}))) as { error?: { message?: string } };
      throw new Error(j.error?.message ?? tf("Le Chat de l'instance a refusé la tâche ({0}).", String(reponse.status)));
    }
    // Le flux SSE du Chat : on garde le texte de la réponse, pas les événements de l'écran.
    const lecteur = reponse.body.getReader();
    const decodeur = new TextDecoder();
    let tampon = "";
    let texte = "";
    // Une erreur du Chat arrive comme un évènement Helix : elle est la raison de l'échec, pas « rien répondu ».
    let erreurDuChat: string | null = null;
    for (;;) {
      const { done, value } = await lecteur.read();
      if (done) break;
      tampon += decodeur.decode(value, { stream: true });
      const evenements = tampon.split("\n\n");
      tampon = evenements.pop() ?? "";
      for (const ev of evenements) {
        for (const ligne of ev.split("\n")) {
          if (!ligne.startsWith("data:")) continue;
          const charge = ligne.slice(5).trim();
          if (!charge || charge === "[DONE]") continue;
          try {
            const j = JSON.parse(charge) as { helix?: { type?: unknown; message?: unknown }; error?: { message?: unknown }; choices?: { delta?: { content?: unknown } }[] };
            const c = j.choices?.[0]?.delta?.content;
            if (j.helix?.type === "error" && typeof j.helix.message === "string") erreurDuChat = j.helix.message;
            else if (typeof j.error?.message === "string") erreurDuChat = j.error.message;
            else if (!j.helix && typeof c === "string") texte += c;
          } catch {
            /* ligne illisible : ignorée */
          }
        }
      }
    }
    if (erreurDuChat) throw new Error(erreurDuChat);
    return texte;
  });
}

async function demarrerEmployes(): Promise<void> {
  let url = `http://127.0.0.1:${PORT}`;
  if (tls) {
    const interne = http.createServer(handler);
    await new Promise<void>((resolve) => interne.listen(0, "127.0.0.1", resolve));
    const adresse = interne.address();
    if (adresse && typeof adresse === "object") url = `http://127.0.0.1:${adresse.port}`;
  }
  employes.connaitrePasserelle({ url, jeton: instanceToken() });
  demarrerTachesProgrammees(url);
  // Missions « à chaque mail reçu » : la boîte est relevée même si aucune n'existe encore (le tour ne lit rien alors).
  employes.demarrerDeclencheurCourrier();
  // Réunions dont la transcription a été interrompue par un arrêt : elles reprennent.
  void reunions.reprendreAuDemarrage().catch(() => undefined);
  await employes.assurerMarche();
  const etat = await employes.etatMoteur();
  if (etat.enMarche) console.log(`  → employés : OpenClaw ${etat.version} en marche.`);
}
