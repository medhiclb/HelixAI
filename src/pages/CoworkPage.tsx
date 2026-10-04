import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { FolderOpen, PanelRight, TriangleAlert } from "lucide-react";
import { LogoMark } from "@/components/ui/Logo";
import { IconButton } from "@/components/ui/IconButton";
import { Composer } from "@/components/chat/Composer";
import { InfoBox } from "@/components/ui/InfoBox";
import { MessageList } from "@/components/chat/MessageList";
import { FileAttente } from "@/components/chat/FileAttente";
import { ApprovalSelector } from "@/components/chat/CoworkSelectors";
import { DossierTravailChip } from "@/components/chat/DossierTravailChip";
import { ScreenAccessChip } from "@/components/chat/ScreenAccessChip";
import { ConnaissancesChip } from "@/components/chat/ConnaissancesChip";
import { useComputer } from "@/hooks/useComputer";
import { useApprobation } from "@/hooks/useApprobation";
import { useAtelier } from "@/hooks/useAtelier";
import { useMcp } from "@/hooks/useMcp";
import { useModels } from "@/hooks/useModels";
import { ConfirmerDossier } from "@/components/cowork/ConfirmerDossier";
import { CoworkPanel, type TouchedFile } from "@/components/cowork/CoworkPanel";
import { arreterReponse, useChat, type Message } from "@/hooks/useChat";
import { useSessions } from "@/hooks/useSessions";
import { estCowork, getSession, memoriserConnaissances } from "@/lib/store/sessions";
import { useProfile } from "@/hooks/useProfile";
import { useAttachments } from "@/hooks/useAttachments";
import { buildSystemPrompt, type NiveauRaisonnement } from "@/lib/store/profile";
import { useCompetences } from "@/hooks/useCompetences";
import { currentUser, prenom } from "@/lib/store/identity";
import { Button } from "@/components/ui/Button";
import { branding } from "@/config/branding";
import { t, tf } from "@/lib/i18n";

/**
 * Consigne propre à Cowork : l'agent agit, il ne se contente pas de décrire.
 * Les instructions personnelles de l'utilisateur s'y ajoutent ensuite.
 */
const COWORK_ROLE = [
  tf("Tu es {0} Cowork, un agent qui travaille sur les fichiers et les outils de", branding.name),
  t("l'utilisateur. Tu réponds en français. Tu disposes d'outils : utilise-les pour agir"),
  t("réellement plutôt que d'expliquer ce qu'il faudrait faire. Avant une action destructrice"),
  t("ou irréversible, demande confirmation. Termine par un résumé court de ce que tu as fait."),
  ``,
  t("Règles d'usage des outils de fichiers :"),
  t("- N'invente jamais un nom de fichier. Liste d'abord le dossier, puis n'utilise que les"),
  t("  noms exacts renvoyés par cette liste."),
  t("- Les chemins sont absolus et commencent tous par le dossier de travail donné"),
  t("  à la fin de ces consignes. Un chemin comme « /Dossier » sera refusé."),
  t("- Pour déplacer ou copier, la destination doit être le chemin complet du fichier"),
  t("  d'arrivée, nom de fichier compris, et non le dossier seul."),
  `  Exemple correct : /dossier/Archives/rapport.txt`,
  `  Exemple incorrect : /dossier/Archives`,
  t("- Si un outil échoue, lis le message d'erreur et corrige ton appel avant de réessayer."),
].join("\n");

/**
 * Consignes ajoutées seulement quand le contrôle de l'écran est réellement
 * disponible. Les décrire alors qu'il ne l'est pas pousserait le modèle à
 * appeler des outils absents.
 */
const ECRAN_ROLE = [
  ``,
  t("Tu peux aussi voir et piloter l'écran, avec les outils « ecran__… »."),
  t("- Commence toujours par « ecran__capture » : agir sans avoir regardé revient à cliquer à l'aveugle."),
  t("- Les coordonnées que tu donnes sont celles de la dernière capture, jamais des coordonnées supposées."),
  t("- Après une action, reprends une capture pour vérifier son effet avant d'enchaîner."),
  t("- Utilise « ecran__ouvrir_app » plutôt que de chercher une icône dans le Dock."),
  t("- Pour trier ou ranger des fichiers, préfère les outils de fichiers : ils sont"),
  t("  plus fiables que le Finder. Ne passe par l'écran que pour ce qu'eux ne savent pas faire."),
  t("- L'utilisateur peut refuser une action. Dans ce cas, n'insiste pas : explique et propose autre chose."),
].join("\n");

/**
 * Les services de la personne : ce qu'on n'a pas lu ne se raconte pas.
 *
 * Mesuré le 23/09/2026 avec qwen3-8b, agenda et Slack non connectés : à « quels
 * sont mes rendez-vous de demain ? », il a cherché dans les réunions
 * transcrites, puis répondu « aucun rendez-vous demain », comme s'il avait lu
 * l'agenda ; pour Slack, il a tenté d'écrire le message dans un fichier. Les
 * connecteurs d'agenda, de Drive et de Slack ne font que lire (agenda.ts,
 * drive.ts, slack.ts) : le dire évite aussi de promettre un envoi impossible.
 */
const SERVICES_ROLE = [
  ``,
  t("Messagerie, agenda, Google Drive et Slack : n'en parle qu'après avoir utilisé l'outil qui les lit"),
  t("(« courrier__… », « agenda__… », « drive__… », « slack__… »). Si cet outil ne t'est pas proposé, le"),
  t("service n'est pas connecté : dis-le franchement, sans rien supposer de son contenu, et indique qu'il"),
  t("se connecte dans Réglages, rubrique Connecteurs. Les réunions transcrites ne sont pas l'agenda."),
  t("Les connecteurs d'agenda, de Google Drive et de Slack ne font que lire : ils ne créent pas de"),
  t("rendez-vous et n'envoient pas de message."),
].join("\n");

/**
 * Consignes posées quand l'écran n'est **pas** utilisable par ce modèle.
 *
 * Sans elles, à « ouvre la Calculatrice », un modèle sans outils d'écran
 * cherchait des détours pendant plusieurs étapes au lieu de répondre tout de
 * suite qu'il n'y a pas accès, et où cela se règle.
 */
/**
 * La machine de l'agent (mode `sandbox`, machine.ts) : l'écran piloté n'est
 * pas celui de la personne mais un bureau Linux isolé. Le modèle doit savoir
 * ce qu'il y trouve, et par où rendre un document : le dossier d'échange,
 * qui apparaît chez la personne dans Helix/Machine.
 */
const MACHINE_ROLE = [
  ``,
  t("L'écran que tu pilotes est celui de ta propre machine de travail : un bureau Linux isolé, pas l'ordinateur de la personne."),
  t("- Applications disponibles : Firefox, LibreOffice Writer, Calc et Impress, Fichiers. Ouvre-les avec « ecran__ouvrir_app » (« Writer », « Calc », « Impress », « Firefox »),"),
  t("  puis attends 3 secondes (« ecran__attendre ») et prends une capture avant d'agir."),
  t("- Pour rendre un document à la personne, enregistre-le dans le dossier « Echanges » (/home/kasm-user/Echanges) :"),
  t("  il apparaît chez elle dans Helix/Machine. Choisis le format Microsoft (.docx, .xlsx, .pptx) sauf demande contraire."),
  t("- Dans Calc, remplis les cellules avec « ecran__saisir_tableau » (au clavier, depuis une cellule de départ), jamais en cliquant cellule par cellule."),
  t("- Pour enregistrer le document ouvert, utilise « ecran__enregistrer_document » avec le nom du fichier (« compte-rendu.docx »)."),
  t("- L'enregistrement te renvoie le contenu relu dans le fichier : compare-le à la demande, et corrige s'il ne correspond pas."),
  t("- Les outils « fichiers__… » agissent sur l'ordinateur de la personne, pas dans ta machine : pour ce qui se passe dans la machine, n'utilise que les outils « ecran__… »."),
].join("\n");

/** La même, quand la machine est un Mac virtuel (machineMacos.ts). */
const MACHINE_MACOS_ROLE = [
  ``,
  t("L'écran que tu pilotes est celui de ta propre machine de travail : un Mac virtuel isolé, pas l'ordinateur de la personne."),
  t("- Applications disponibles : Safari, LibreOffice Writer, Calc et Impress, Finder, Terminal. Ouvre-les avec « ecran__ouvrir_app » (« Writer », « Calc », « Impress », « Safari »),"),
  t("  puis attends 3 secondes (« ecran__attendre ») et prends une capture avant d'agir."),
  t("- Les raccourcis utilisent la touche Commande (« cmd+s », « cmd+c »), pas Contrôle."),
  t("- Pour rendre un document à la personne, enregistre-le dans le dossier partagé (/Volumes/My Shared Files) :"),
  t("  il apparaît chez elle dans Helix/Machine. Choisis le format Microsoft (.docx, .xlsx, .pptx) sauf demande contraire."),
  t("- Dans Calc, remplis les cellules avec « ecran__saisir_tableau » (au clavier, depuis une cellule de départ), jamais en cliquant cellule par cellule."),
  t("- Pour enregistrer le document ouvert, utilise « ecran__enregistrer_document » avec le nom du fichier (« compte-rendu.docx »)."),
  t("- L'enregistrement te renvoie le contenu relu dans le fichier : compare-le à la demande, et corrige s'il ne correspond pas."),
  t("- Les outils « fichiers__… » agissent sur l'ordinateur de la personne, pas dans ta machine : pour ce qui se passe dans la machine, n'utilise que les outils « ecran__… »."),
].join("\n");

const SANS_ECRAN_ROLE = [
  ``,
  t("Tu ne vois pas l'écran et tu ne peux ni cliquer, ni taper au clavier, ni ouvrir une application."),
  t("Si on te le demande, dis-le tout de suite, sans chercher de détour avec les autres outils, et indique"),
  t("que le contrôle de l'écran se règle dans Réglages, rubrique Contrôle de l'écran, avec un modèle"),
  t("capable de voir les images choisi dans le sélecteur de modèle."),
].join("\n");

/**
 * Consignes ajoutées quand l'atelier bureautique est installé.
 *
 * Sans elles, un modèle modeste répond à « fais-moi un rapport » en écrivant
 * un fichier texte : il ne devine pas qu'il dispose d'outils capables de
 * produire un vrai document. Elles ne sont posées que si l'atelier répond,
 * pour la raison inverse : annoncer des outils absents pousserait le modèle à
 * s'acharner dessus.
 */
const BUREAU_ROLE = [
  ``,
  t("Tu peux produire de vrais documents bureautiques, avec les outils « bureau__… » :"),
  t("Word (.docx), Excel (.xlsx), PowerPoint (.pptx) et PDF, et relire ces quatre formats."),
  t("- Quand on te demande un rapport, un compte rendu ou une note, produis un .docx,"),
  t("  pas un fichier texte. Un tableau de chiffres appelle un .xlsx, une présentation"),
  t("  un .pptx. Ne reviens au .txt que si on te le demande explicitement."),
  t("- Tu fournis le contenu sous forme de données structurées : un titre, des"),
  t("  paragraphes, des lignes de tableau. Tu n'écris jamais de code."),
  t("- Dans un classeur, une cellule qui commence par « = » est une formule : sers-t'en"),
  t("  pour les totaux plutôt que de calculer toi-même."),
  t("- Pour lire un .docx, .xlsx, .pptx ou .pdf, utilise « bureau__lire_document »."),
  t("  Les outils de fichiers ne savent pas ouvrir ces formats."),
].join("\n");

/**
 * Consignes posées quand l'atelier bureautique **n'est pas** là.
 *
 * Sans elles, à « fais-moi un compte rendu Word », le modèle écrivait du texte
 * brut dans un fichier nommé « .docx » avec l'outil de fichiers : un faux
 * document que Word refuse d'ouvrir, présenté comme fait. Mesuré le 23/09/2026
 * avec qwen3-8b. Mieux vaut dire ce qui manque et proposer ce qui marche.
 */
const SANS_BUREAU_ROLE = [
  ``,
  t("Tu ne peux pas produire de vrai document Word, Excel, PowerPoint ou PDF : l'atelier bureautique"),
  t("n'est pas préparé sur cette machine. N'écris jamais un fichier .docx, .xlsx, .pptx ou .pdf avec"),
  t("les outils de fichiers : ce serait du texte brut qu'aucun logiciel n'ouvrira. Dis-le à l'utilisateur,"),
  t("indique qu'il peut préparer l'atelier depuis le panneau de droite de Cowork, et propose un fichier"),
  t(".md ou .txt en attendant."),
].join("\n");

/** Ce qu'importent les outils bureautiques de l'instance (bureau.ts, `bureautiquePresente`). */
const BIBLIOTHEQUES_BUREAU = ["python-docx", "python-pptx", "openpyxl", "reportlab", "pdfplumber"];

/** Déduit les fichiers touchés à partir des outils réellement appelés. */
function touchedFiles(messages: Message[]): TouchedFile[] {
  const found = new Map<string, TouchedFile>();
  for (const message of messages) {
    for (const trace of message.tools ?? []) {
      if (!trace.ok) continue;
      const name = trace.name.toLowerCase();
      // « chemin » est la clé des outils bureautiques : sans elle, un document
      // Word produit par l'agent n'apparaissait pas dans le panneau.
      let path = ["path", "source", "destination", "chemin"]
        .map((key) => trace.args[key])
        .find((value): value is string => typeof value === "string" && value.length > 0);
      /*
       * Un document bureautique n'est pas toujours écrit là où le modèle l'a
       * dit : l'instance complète l'extension et rattache un chemin relatif à
       * l'espace de travail (bureau.ts, `cheminSur`). Le panneau affichait
       * donc « rapport » pour un « rapport.docx ». Le chemin réel est dans la
       * réponse de l'outil : c'est lui qui fait foi.
       */
      if (name.startsWith("bureau__creer_")) {
        const reel = /Chemin : (.+)$/m.exec(trace.preview ?? "")?.[1]?.trim();
        if (reel) path = reel;
      }
      if (!path) continue;

      /*
       * Un déplacement se montre à son point d'arrivée. Le panneau affichait
       * la source, « modifié », c'est-à-dire un fichier qui n'existe plus.
       */
      if (/move/.test(name) && typeof trace.args.destination === "string" && trace.args.destination) {
        found.set(`ajouté:${trace.args.destination}`, { path: trace.args.destination, action: "ajouté" });
        continue;
      }
      const action: TouchedFile["action"] = /write|create|edit|move|creer/.test(name)
        ? /create|write|creer/.test(name)
          ? "ajouté"
          : "modifié"
        : "lu";
      found.set(`${action}:${path}`, { path, action });
    }
  }
  return [...found.values()];
}

/**
 * La dernière session de Cowork affichée dans cette fenêtre (04/10/2026).
 * Revenir dans Cowork après un passage au Chat la rouvre : on retombait sur un
 * Cowork vierge, le travail en cours introuvable depuis Cowork (signalé par
 * Medhi). Gardée en mémoire de la fenêtre, pas sur le disque : au lancement
 * suivant, Cowork s'ouvre sur l'accueil, et la session sur la liste de gauche.
 * « Nouvelle session » l'oublie.
 */
let derniereSessionCowork: string | null = null;

/** Ecran Cowork (captures 6 a 8), branché sur le runtime avec outils. */
export function CoworkPage() {
  /*
   * Ouvert d'office seulement dans une fenêtre assez large, comme le suivi de
   * Code : à 375 px (relevé le 27/09/2026), le panneau de 320 px prenait toute
   * la place et le champ de Cowork disparaissait.
   */
  const [panelOpen, setPanelOpen] = useState(
    () => typeof window === "undefined" || window.matchMedia("(min-width: 1024px)").matches,
  );
  const [draft, setDraft] = useState("");
  // Bases de connaissances consultées avant chaque réponse de Cowork (l'instance vérifie les droits).
  const [bases, setBases] = useState<string[]>([]);

  const { profile, update } = useProfile();
  const { capability: capaciteEcran, disponible: ecranDisponible, pending: demandesEcran, repondre: repondreEcran } = useComputer();
  const { enAttente: demandesOutils, repondre: repondreOutil } = useApprobation();
  /*
   * Les outils « bureau__… » existent dès que les cinq bibliothèques Python
   * qu'ils importent sont là (bureau.ts, `bureautiquePresente`) ; l'atelier
   * n'est « prêt » qu'avec les bibliothèques Node en plus. Se fier à `pret`
   * disait au modèle « tu ne peux pas produire de Word » alors que l'instance
   * lui en donnait les outils (vu sur un atelier dont seule la partie Node
   * manquait). On regarde donc ce dont les outils ont réellement besoin.
   * `diagnostic` nul : l'état n'est pas encore connu, on n'affirme rien.
   */
  const { diagnostic: atelierConnu } = useAtelier();
  const bureauPret = Boolean(
    atelierConnu &&
      BIBLIOTHEQUES_BUREAU.every((nom) => atelierConnu.bibliotheques.some((b) => b.nom === nom && b.installee)),
  );
  // Sans cette indication, l'agent gaspille ses premières étapes à deviner où
  // il a le droit d'écrire — sur une tâche longue, ce sont des étapes perdues.
  // `erreurMcp` : un dossier refusé par l'instance ne produisait aucun signe à
  // l'écran. La puce revenait à l'ancien chemin sans un mot, et l'utilisateur
  // croyait travailler dans un dossier où l'agent n'a en fait aucun accès.
  const { workspace, toutLePoste, changerWorkspace, erreurWorkspace } = useMcp();
  /*
   * Sur une instance partagée, changer le dossier de travail déplace le
   * périmètre de tous les agents de l'équipe : l'instance redemande le mot de
   * passe. Le dossier choisi attend ici pendant ce temps.
   */
  const [dossierAConfirmer, setDossierAConfirmer] = useState<string | null>(null);
  /*
   * Machine de l'agent prête et modèle en « Auto » : Cowork travaille avec le
   * modèle qui voit l'écran. En automatique, une demande de texte partait au
   * modèle de conversation, qui ne voit pas les images : la machine restait
   * inutilisable tant qu'on n'allait pas choisir soi-même un modèle de vision.
   * Un modèle choisi à la main, lui, est respecté.
   */
  const modelUid =
    profile.preferredModelUid ??
    (capaciteEcran?.mode === "sandbox" && capaciteEcran.disponible ? (capaciteEcran.modeleEcran ?? undefined) : undefined);
  const effort = profile.preferredEffort ?? "moyen";
  /*
   * L'instance ne confie les outils d'écran qu'à un modèle qui voit les images
   * (chat.ts, `voitLesImages`) ; en mode automatique, une demande de texte ne
   * va jamais à un modèle de vision. La page annonçait pourtant l'écran au
   * modèle, et la puce « Écran : cette machine », dès qu'un modèle de vision
   * existait quelque part : un modèle de conversation lisait « tu peux piloter
   * l'écran » sans en avoir les outils. Mesuré le 23/09/2026 avec qwen3-8b et
   * « ouvre la Calculatrice » : sept étapes de détours (listes de dossiers, un
   * classeur Excel) avant d'avouer n'avoir aucun moyen. L'écran ne compte donc
   * que si le modèle choisi le voit, et sinon on le lui dit (`SANS_ECRAN_ROLE`).
   */
  const { models } = useModels();
  const modeleChoisi = models.find((m) => m.uid === modelUid);
  const modeleVoit = Boolean(
    modeleChoisi && (modeleChoisi.roles.includes("vision") || modeleChoisi.roles.includes("gui")),
  );
  const ecranUtilisable = ecranDisponible && modeleVoit;
  const jointes = useAttachments(modelUid);
  /*
   * Les procédures de l'entreprise (`competences.ts`). Cowork est la surface qui
   * agit : c'est là qu'une manière de faire maison compte le plus.
   */
  const { consignes: consignesCompetences } = useCompetences();

  const systemPrompt = useMemo(
    () =>
      buildSystemPrompt(
        profile,
        branding.name,
        [
          COWORK_ROLE,
          "\n" + SERVICES_ROLE,
          ecranUtilisable ? "\n" + ECRAN_ROLE : "\n" + SANS_ECRAN_ROLE,
          ecranUtilisable && capaciteEcran?.mode === "sandbox"
            ? "\n" + (capaciteEcran.systeme === "macos" ? MACHINE_MACOS_ROLE : MACHINE_ROLE)
            : "",
          bureauPret ? "\n" + BUREAU_ROLE : atelierConnu ? "\n" + SANS_BUREAU_ROLE : "",
          /*
           * Le chemin est donné en toutes lettres, avec un exemple construit
           * dessus. Les consignes portaient un marqueur abstrait,
           * « <espace de travail>/Dossier » : un modèle de 8 milliards de
           * paramètres le recopiait tel quel dans ses appels d'outils, et
           * chaque lecture de fichier échouait en « fichier introuvable ».
           * Un exemple concret ne laisse rien à interpréter.
           */
          workspace
            ? tf("\nEspace de travail : {0}", workspace) +
              tf("\nTout chemin commence par cette ligne. Exemple : {0}/rapport.txt", workspace)
            : "",
        ].join(""),
        consignesCompetences,
      ),
    [profile, ecranUtilisable, capaciteEcran?.mode, bureauPret, atelierConnu, workspace, consignesCompetences],
  );

  // Cowork est la surface « qui agit » : les outils y sont toujours actifs.
  const chat = useChat({
    model: modelUid,
    effort,
    systemPrompt,
    origin: "local",
    tools: true,
    connaissances: bases,
    // Une session de Cowork, rangée à part des Chats, avec son dossier (04/10/2026).
    surface: "cowork",
    dossier: toutLePoste ? "poste" : workspace,
  });

  /*
   * L'adresse dit quelle session est affichée, comme dans Code et le Chat :
   * `/cowork?c=<id>` une session de la liste, `/cowork` l'accueil. Une
   * réponse qui s'écrit encore continue hors de l'écran, et se rouvre en
   * direct depuis la liste (useChat, `open`).
   */
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const demandee = params.get("c");
  const { open: ouvrirSession, reset: viderEcran } = chat;
  const premierPassage = useRef(true);
  useEffect(() => {
    const retour = premierPassage.current;
    premierPassage.current = false;
    if (!demandee) {
      // Retour dans Cowork (depuis le Chat ou une autre page) : la dernière session revient.
      const derniere = retour && derniereSessionCowork ? getSession(derniereSessionCowork) : undefined;
      if (derniere && estCowork(derniere)) {
        setParams({ c: derniere.id }, { replace: true });
        return;
      }
      // « Nouvelle session », ou rien à reprendre : un Cowork neuf, sans les bases de la session précédente.
      derniereSessionCowork = null;
      viderEcran();
      setBases([]);
      return;
    }
    // Déjà affichée : la session qui vient de naître, dont l'adresse vient d'être posée.
    if (chat.session?.id === demandee) return;
    const session = getSession(demandee);
    if (session && !estCowork(session)) {
      // Un Chat ordinaire se rouvre dans le Chat, là où il a été mené.
      navigate(`/?c=${encodeURIComponent(session.id)}`, { replace: true });
      return;
    }
    if (session) {
      ouvrirSession(session);
      setBases(session.connaissances ?? []);
      derniereSessionCowork = session.id;
    } else {
      // Introuvable ici (supprimée, ou pas encore relue) : l'accueil, sans rien écrire.
      viderEcran();
      setBases([]);
    }
    // Seule l'adresse décide, comme dans Code.
  }, [demandee]);

  /*
   * Une session vient de naître (première demande) : l'adresse la désigne,
   * pour que la barre latérale la montre active et qu'un retour la retrouve.
   */
  const idEnCours = chat.session?.id ?? null;
  useEffect(() => {
    if (!idEnCours) return;
    derniereSessionCowork = idEnCours;
    if (idEnCours !== demandee) setParams({ c: idEnCours }, { replace: true });
  }, [idEnCours]);

  // Les bases cochées sont retenues avec la session, comme dans le Chat.
  useEffect(() => {
    if (!idEnCours) return;
    const session = getSession(idEnCours);
    if (!session || session.ownerId !== currentUser().id) return;
    if (!session.connaissances && bases.length === 0) return;
    memoriserConnaissances(idEnCours, bases);
  }, [idEnCours, bases]);

  /*
   * La session affichée vient d'être supprimée (barre latérale, autre
   * fenêtre) : l'écran repart à neuf, sans quoi la suite s'enregistrerait
   * dans une session disparue, donc nulle part (même garde que le Chat).
   */
  const { sessions: sessionsCowork } = useSessions("cowork");
  useEffect(() => {
    if (idEnCours && !getSession(idEnCours)) {
      arreterReponse(idEnCours);
      derniereSessionCowork = null;
      navigate("/cowork", { replace: true });
    }
  }, [sessionsCowork, idEnCours]);

  /*
   * La session rouverte travaillait dans un autre dossier. Le dossier de
   * travail est un réglage de l'instance, commun à tous ses agents (et, sur
   * une instance partagée, protégé par le mot de passe de l'administrateur) :
   * le changer d'office en rouvrant une session déplacerait le périmètre de
   * tout le monde sans qu'on l'ait demandé. L'écran le dit, et propose de le
   * reprendre d'un clic. Seulement pour ses propres sessions : celui d'une
   * collègue désigne un dossier de son poste à elle.
   */
  const sessionAffichee = idEnCours ? (sessionsCowork.find((x) => x.id === idEnCours) ?? null) : null;
  const dossierActuel = toutLePoste ? "poste" : workspace;
  const dossierDeLaSession =
    sessionAffichee?.dossier &&
    sessionAffichee.ownerId === currentUser().id &&
    dossierActuel &&
    sessionAffichee.dossier !== dossierActuel &&
    !chat.busy
      ? sessionAffichee.dossier
      : null;
  // Le nom du dossier, comme sur la puce ; le chemin entier au survol (un chemin complet prenait six lignes).
  const nomDossier = (d: string) =>
    d === "poste" ? t("Tout mon poste") : d.replace(/[\\/]+$/, "").split(/[\\/]/).pop() || d;
  const cheminLisible = (d: string) => (d === "poste" ? t("Tout mon poste") : d);

  const files = useMemo(() => touchedFiles(chat.messages), [chat.messages]);

  /*
   * « Arrêter » coupe l'affichage, mais l'instance, elle, attendait encore la
   * réponse à la carte d'accord restée à l'écran : cliquer « Autoriser » après
   * l'arrêt exécutait l'action (mesuré le 23/09/2026 : un clic parti après
   * l'arrêt). Arrêter vaut donc refus de ce qui attend encore. Les demandes d'un
   * employé ne sont pas touchées : elles ne viennent pas de cette conversation,
   * ni celles de Helix Code (une commande en attente dans une autre session).
   */
  const arreter = () => {
    chat.stop();
    for (const d of demandesEcran) void repondreEcran(d.id, false);
    for (const d of demandesOutils) if (!d.detail?.employe && d.detail?.surface !== "code") void repondreOutil(d.id, false);
  };

  /*
   * Pendant que l'agent travaille, le message suivant entre dans la file de
   * ce Chat (29/09/2026), comme dans le Chat : il part à la fin normale du
   * travail en cours, pas après une erreur ni après « Arrêter ».
   */
  const [fileRefusee, setFileRefusee] = useState(false);
  const mettreEnFile = () => {
    const ajout = chat.mettreEnFile(draft, jointes.pieces);
    if (!ajout) return;
    if (!ajout.ok) {
      setFileRefusee(true);
      return;
    }
    setFileRefusee(false);
    setDraft("");
    jointes.vider();
  };

  const submit = () => {
    if (chat.busy) {
      mettreEnFile();
      return;
    }
    const text = draft;
    const pieces = jointes.pieces;
    setDraft("");
    jointes.vider();
    void chat.send(text, pieces);
  };

  /*
   * Deux choses valent la peine d'être dites avant l'envoi : un fichier
   * refusé, et une image confiée à un modèle qui ne sait pas la lire — ce
   * dernier cas ne produit aucune erreur, juste une réponse à côté.
   */
  const avertissements = (
    <>
      {dossierDeLaSession && dossierActuel && (
        <InfoBox
          tone="muted"
          className="mt-2"
          leading={<FolderOpen size={15} strokeWidth={1.75} />}
        >
          <p dir="auto" title={`${cheminLisible(dossierDeLaSession)}\n${cheminLisible(dossierActuel)}`}>
            {tf("Cette session travaillait dans « {0} ». L'agent a maintenant accès à « {1} ».", nomDossier(dossierDeLaSession), nomDossier(dossierActuel))}
          </p>
          <Button
            size="sm"
            variant="secondary"
            className="mt-2"
            onClick={() =>
              void changerWorkspace(dossierDeLaSession).then((r) => {
                if (r.confirmation) setDossierAConfirmer(dossierDeLaSession);
              })
            }
          >
            {t("Reprendre ce dossier")}
          </Button>
        </InfoBox>
      )}
      {erreurWorkspace && (
        <InfoBox
          tone="warning"
          className="mt-2"
          leading={<TriangleAlert size={15} strokeWidth={1.75} />}
        >
          {t("Dossier de travail inchangé :")}{" "}{erreurWorkspace}
        </InfoBox>
      )}
      {jointes.avertissementImage && (
        <InfoBox
          tone="warning"
          className="mt-2"
          leading={<TriangleAlert size={15} strokeWidth={1.75} />}
        >
          {jointes.avertissementImage}
        </InfoBox>
      )}
      {jointes.erreurs.length > 0 && (
        <InfoBox
          tone="muted"
          className="mt-2"
          leading={<TriangleAlert size={15} strokeWidth={1.75} />}
        >
          {jointes.erreurs.map((e) => (
            <p key={e.nom}>
              <strong>{e.nom}</strong> : {e.raison}.
            </p>
          ))}
        </InfoBox>
      )}
    </>
  );

  const composer = (
    <Composer
      placeholder={t("Demandez à Cowork de travailler sur vos fichiers...")}
      value={draft}
      onChange={setDraft}
      onSubmit={submit}
      busy={chat.busy}
      onStop={arreter}
      onMettreEnFile={mettreEnFile}
      enTete={
        <FileAttente
          file={chat.file}
          occupe={chat.busy}
          refusee={fileRefusee}
          onRetirer={chat.retirerDeFile}
          onCommencerEdition={chat.commencerEdition}
          onFinirEdition={chat.finirEdition}
          onReprendre={chat.reprendreFile}
        />
      }
      pieces={jointes.pieces}
      piecesEnLecture={jointes.enLecture}
      onAjouterFichiers={(f) => void jointes.ajouter(f)}
      onRetirerPiece={jointes.retirer}
      modelUid={modelUid}
      onModelChange={(uid) => update({ preferredModelUid: uid })}
      effort={effort}
      onEffortChange={(e) =>
        update({ preferredEffort: e as NiveauRaisonnement })
      }
      /*
       * Le niveau d'approbation dans la barre du bas, à côté du « + », comme
       * le sélecteur de permissions de Claude (demandé par Medhi le
       * 26/09/2026) : c'est là qu'on le cherche au moment d'envoyer.
       */
      accessoire={<ApprovalSelector />}
      contextBar={
        <>
          <DossierTravailChip
            dossier={workspace}
            titre={t("Dossier accessible")}
            aide={t("L'agent lit et écrit ici, et nulle part ailleurs.")}
            toutLePoste={toutLePoste}
            onChange={(chemin) =>
              void changerWorkspace(chemin).then((r) => {
                if (r.confirmation) setDossierAConfirmer(chemin);
              })
            }
            surToutLePoste={() =>
              void changerWorkspace("poste").then((r) => {
                if (r.confirmation) setDossierAConfirmer("poste");
              })
            }
          />
          <ScreenAccessChip modeleVoit={modeleVoit} />
          <ConnaissancesChip choisies={bases} onChange={setBases} side={chat.messages.length > 0 ? "top" : "bottom"} />
        </>
      }
    />
  );

  return (
    <div className="relative flex h-full min-w-0">
      <IconButton
        icon={PanelRight}
        label={panelOpen ? t("Masquer le panneau") : t("Afficher le panneau")}
        onClick={() => setPanelOpen((o) => !o)}
        className="absolute end-4 top-4 z-20"
      />

      <section className="relative flex min-w-0 flex-1 flex-col overflow-hidden bg-dotted">
        {chat.messages.length === 0 ? (
          /* Accueil */
          <div className="flex flex-1 items-center justify-center overflow-y-auto px-6 pb-24 pt-16">
            <div className="w-full max-w-[680px]">
              <div className="mb-7 flex items-center justify-center gap-3">
                <LogoMark size={38} animated />
                <h1 className="text-3xl font-medium tracking-tight text-foreground">
                  {t("Bonjour,")}{" "}{prenom(currentUser())}
                </h1>
              </div>
              {composer}
              {avertissements}
            </div>
          </div>
        ) : (
          /* Conversation */
          <>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <div className="mx-auto w-full max-w-[720px] px-6 py-8">
                <MessageList messages={chat.messages} />
              </div>
            </div>
            <div className="shrink-0 px-6 pb-5">
              <div className="mx-auto w-full max-w-[720px]">
                {composer}
                {avertissements}
              </div>
            </div>
          </>
        )}
      </section>

      {panelOpen && <CoworkPanel files={files} />}

      {dossierAConfirmer && (
        <ConfirmerDossier
          dossier={dossierAConfirmer}
          onAnnuler={() => setDossierAConfirmer(null)}
          onConfirmer={async (identite) => {
            const r = await changerWorkspace(dossierAConfirmer, identite);
            if (r.ok) setDossierAConfirmer(null);
            return r;
          }}
        />
      )}
    </div>
  );
}

export default CoworkPage;
