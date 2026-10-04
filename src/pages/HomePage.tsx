import { useEffect, useMemo, useState } from "react";
import { useSearchParams, useLocation, useNavigate } from "react-router-dom";
import { TriangleAlert } from "lucide-react";
import { LogoMark } from "@/components/ui/Logo";
import { Composer } from "@/components/chat/Composer";
import { OutilsChip } from "@/components/chat/OutilsChip";
import { InviteOutils } from "@/components/chat/InviteOutils";
import { ConnaissancesChip } from "@/components/chat/ConnaissancesChip";
import { useProjects } from "@/hooks/useProjects";
import { ImageChip } from "@/components/chat/ImageChip";
import { RechercheWebChip } from "@/components/chat/RechercheWebChip";
import { etatRechercheWeb, type EtatRechercheWeb } from "@/lib/rechercheWeb";
import type { Format } from "@/lib/images";
import { InfoBox } from "@/components/ui/InfoBox";
import { SuggestionList } from "@/components/chat/SuggestionList";
import { MessageList } from "@/components/chat/MessageList";
import { FileAttente } from "@/components/chat/FileAttente";
import { FirstRun } from "@/components/onboarding/FirstRun";
import { ProjectSelector, AgentSelector } from "@/components/chat/ContextSelectors";
import { arreterReponse, useChat } from "@/hooks/useChat";
import { useProfile } from "@/hooks/useProfile";
import { useAttachments } from "@/hooks/useAttachments";
import { useModels } from "@/hooks/useModels";
import { buildSystemPrompt, type NiveauRaisonnement } from "@/lib/store/profile";
import { estCowork, getSession, memoriserAgent, memoriserConnaissances, rattacherProjet } from "@/lib/store/sessions";
import { currentUser } from "@/lib/store/identity";
import { useSessions, notifySessionsChanged } from "@/hooks/useSessions";
import { useAgents } from "@/hooks/useAgents";
import { useCompetences } from "@/hooks/useCompetences";
import { DEFAULT_AGENT, instructionsPourLeChat } from "@/lib/store/agents";
import { instance } from "@/lib/instance";
import { branding, features } from "@/config/branding";
import { t, tf } from "@/lib/i18n";

/** Ecran Chat : accueil vide, puis conversation (captures 1 a 5). */
export function HomePage() {
  const [draft, setDraft] = useState("");
  /** Bouton « Image » : le prochain envoi crée une image au lieu d'une réponse. */
  const [modeImage, setModeImage] = useState(false);
  /** Une vidéo plutôt qu'une image (27/09/2026) : même mode, même pastille, autre genre. */
  const [modeVideo, setModeVideo] = useState(false);
  const [formatImage, setFormatImage] = useState<Format>("carre");
  /*
   * « Rechercher sur le web » (menu « + », 28/09/2026) : une bascule, montrée
   * en puce tant qu'elle est active. Éteinte au départ, et sans effet si
   * l'instance l'interdit : rien ne part vers le web sans ce choix.
   */
  const [rechercheWeb, setRechercheWeb] = useState(false);
  const [etatWeb, setEtatWeb] = useState<EtatRechercheWeb | null | undefined>(undefined);
  useEffect(() => {
    /*
     * Relu toutes les 15 secondes tant que l'instance ne répond pas
     * (28/09/2026) : lu une seule fois à l'ouverture de l'écran, un démarrage
     * lent ou une coupure passagère laissait l'entrée du menu « + » grisée,
     * « l'instance ne répond pas », jusqu'à ce qu'on quitte le Chat.
     */
    let vivant = true;
    let minuterie: number | undefined;
    const lire = () =>
      void etatRechercheWeb().then((e) => {
        if (!vivant) return;
        setEtatWeb(e);
        if (e === null) minuterie = window.setTimeout(lire, 15_000);
      });
    lire();
    return () => {
      vivant = false;
      window.clearTimeout(minuterie);
    };
  }, []);
  const webActif = rechercheWeb && Boolean(etatWeb?.autorisee) && !modeImage;
  const { profile, update } = useProfile();
  const { models, loading: modelsLoading, refresh: refreshModels } = useModels();

  // Préférences du profil comme valeurs par défaut, surchargeables à la volée.
  const modelUid = profile.preferredModelUid;
  const effort = profile.preferredEffort ?? "moyen";
  const jointes = useAttachments(modelUid);

  // Agent sélectionné : ses instructions définissent le rôle, le profil privé
  // de l'utilisateur y ajoute son contexte et sa mémoire.
  const { selectable } = useAgents();
  const [agentId, setAgentId] = useState(DEFAULT_AGENT.id);
  const agent = selectable.find((a) => a.id === agentId) ?? DEFAULT_AGENT;

  // Les procédures de l'entreprise valent aussi dans le Chat : c'est là que la
  // plupart des demandes arrivent.
  const { consignes: consignesCompetences } = useCompetences();
  const systemPrompt = useMemo(
    () => buildSystemPrompt(profile, branding.name, instructionsPourLeChat(agent), consignesCompetences),
    [profile, agent, consignesCompetences],
  );

  // Une session menée sur un modèle local reste liée à cette machine.
  const origin = useMemo(() => {
    const model = models.find((m) => m.uid === modelUid);
    return model && model.backendId !== "lmstudio" ? "cloud" : "local";
  }, [models, modelUid]);

  /*
   * Bases de connaissances consultées à chaque question : celles que la
   * personne coche dans la zone de saisie (retenues avec le Chat), celles de
   * l'agent choisi, celles du projet où le Chat est rangé. L'instance ne
   * garde que celles que la personne a le droit de lire.
   */
  const [basesChoisies, setBasesChoisies] = useState<string[]>([]);
  const { projects } = useProjects();

  // L'agent peut interdire les outils : son réglage prime sur l'interrupteur.
  const toolsOn = profile.outilsChat ?? false;
  const setToolsOn = (actif: boolean) => update({ outilsChat: actif });
  const toolsAllowed = agent.toolsEnabled;
  const [projetDuChat, setProjetDuChat] = useState<string | null>(null);
  const projet = projects.find((p) => p.id === projetDuChat) ?? null;
  const basesHeritees = useMemo(
    () => [
      ...(agent.connaissances ?? []).map((id) => ({ id, raison: tf("Par l'agent « {0} »", agent.name) })),
      ...(projet?.connaissances ?? []).map((id) => ({ id, raison: tf("Par le projet « {0} »", projet!.name) })),
    ],
    [agent.connaissances, agent.name, projet],
  );
  const connaissances = useMemo(
    () => [...new Set([...basesChoisies, ...basesHeritees.map((h) => h.id)])],
    [basesChoisies, basesHeritees],
  );
  const chat = useChat({
    model: modelUid,
    effort,
    systemPrompt,
    origin,
    tools: toolsOn && toolsAllowed,
    connaissances,
    web: webActif,
    ...(agent.id !== DEFAULT_AGENT.id ? { agent: agent.id } : {}),
  });

  // La conversation affichée suit l'URL : « /?c=<id> » rouvre une session,
  // « / » ouvre une conversation neuve.
  // `location.key` change à chaque navigation, même vers la même adresse :
  // cliquer « Nouveau Chat » depuis une conversation en cours la réinitialise.
  const [params] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const sessionId = params.get("c");
  /*
   * « /?projet=<id> » ouvre un chat neuf déjà destiné à un projet : c'est le
   * chemin du bouton « Nouveau Chat » de l'écran Projets.
   */
  const projetDemande = params.get("projet");
  const { open, reset } = chat;

  /*
   * Projet choisi pour un chat qui n'existe pas encore. La conversation ne naît
   * qu'à la première question (`useChat.send`) : jusque-là il n'y a rien à
   * ranger, on retient donc le choix et on l'applique dès la création.
   */
  const [projetNeuf, setProjetNeuf] = useState<string | null>(projetDemande);

  useEffect(() => {
    // Ouvrir ou recommencer une conversation efface le choix en attente :
    // il visait le chat neuf, pas celui qu'on rouvre.
    setProjetNeuf(sessionId ? null : projetDemande);
    if (!sessionId) {
      reset();
      // Un Chat neuf repart sans les bases cochées du précédent (celles de l'agent et du projet suivent d'elles-mêmes).
      setBasesChoisies([]);
      return;
    }
    const session = getSession(sessionId);
    /*
     * Une session de Cowork demandée à l'adresse d'un Chat (lien d'avant le
     * 04/10/2026, notification, page d'un projet) : elle s'ouvre dans Cowork,
     * avec ses outils. Ouverte ici, elle continuait sans outils ni dossier.
     */
    if (session && estCowork(session) && features.cowork) {
      navigate(`/cowork?c=${encodeURIComponent(session.id)}`, { replace: true });
      return;
    }
    if (session) {
      open(session);
      /*
       * Un Chat rouvert reprend SON agent. Il repartait avec l'agent par
       * défaut, sans le dire : mêmes questions, autres réponses. Dans le même
       * effet que `open`, pour que l'agent et la conversation changent
       * ensemble (sinon l'effet de mémorisation ci-dessous écrirait l'agent
       * précédent dans le Chat qu'on vient d'ouvrir).
       */
      setAgentId(session.agentId ?? DEFAULT_AGENT.id);
      setBasesChoisies(session.connaissances ?? []);
    }
  }, [sessionId, projetDemande, location.key, open, reset, navigate]);

  // Relu à chaque changement de conversation, pour afficher le classement à jour.
  const { sessions } = useSessions();
  const idEnCours = chat.session?.id ?? null;
  const enCours = idEnCours
    ? (sessions.find((s) => s.id === idEnCours) ?? getSession(idEnCours) ?? null)
    : null;

  /*
   * Le chat affiché vient d'être supprimé (depuis la barre latérale) : l'écran
   * repart à neuf. Sans cela, il restait affiché et la suite de la
   * conversation s'enregistrait dans une session disparue, donc nulle part.
   */
  useEffect(() => {
    if (idEnCours && !getSession(idEnCours)) {
      // Supprimé : sa réponse en cours n'a plus nulle part où s'enregistrer.
      arreterReponse(idEnCours);
      reset();
    }
  }, [sessions, idEnCours, reset]);

  // L'agent choisi est retenu avec le Chat : à sa création, et à chaque changement.
  useEffect(() => {
    if (!idEnCours) return;
    const session = getSession(idEnCours);
    if (!session || session.ownerId !== currentUser().id || session.agentId === agentId) return;
    if (!session.agentId && agentId === DEFAULT_AGENT.id) return;
    memoriserAgent(idEnCours, agentId, agent.name);
  }, [idEnCours, agentId, agent.name]);

  /*
   * L'agent de ce Chat a été supprimé depuis : c'est l'agent par défaut qui
   * répond, et on le dit plutôt que de laisser croire que rien n'a changé.
   */
  const agentDisparu =
    enCours?.agentId && enCours.agentId !== DEFAULT_AGENT.id && !selectable.some((a) => a.id === enCours.agentId)
      ? (enCours.agentNom ?? "")
      : null;

  // Le projet dont le Chat tient ses bases : celui où il est rangé, ou celui qui l'attend.
  useEffect(() => {
    setProjetDuChat(enCours ? (enCours.projectId ?? null) : projetNeuf);
  }, [enCours, projetNeuf]);

  // Les bases cochées sont retenues avec le Chat, comme l'agent.
  useEffect(() => {
    if (!idEnCours) return;
    const session = getSession(idEnCours);
    if (!session || session.ownerId !== currentUser().id) return;
    if (!session.connaissances && basesChoisies.length === 0) return;
    memoriserConnaissances(idEnCours, basesChoisies);
  }, [idEnCours, basesChoisies]);

  useEffect(() => {
    if (!idEnCours || !projetNeuf) return;
    const session = getSession(idEnCours);
    // Garde : on ne range que le chat que ce composer vient de créer, jamais
    // un chat déjà classé ou appartenant à quelqu'un d'autre.
    if (session && !session.projectId && session.ownerId === currentUser().id) {
      rattacherProjet(idEnCours, projetNeuf, currentUser());
      notifySessionsChanged();
    }
    setProjetNeuf(null);
  }, [idEnCours, projetNeuf]);

  const selecteurProjet = features.projets ? (
    <ProjectSelector
      side={chat.messages.length > 0 ? "top" : "bottom"}
      value={enCours ? (enCours.projectId ?? null) : projetNeuf}
      disabledReason={
        enCours && enCours.ownerId !== currentUser().id
          ? t("Seule la personne qui a ouvert ce chat peut le ranger dans un projet.")
          : undefined
      }
      onChange={(projectId) => {
        if (!enCours) {
          setProjetNeuf(projectId);
          return;
        }
        rattacherProjet(enCours.id, projectId, currentUser());
        notifySessionsChanged();
      }}
    />
  ) : null;

  /** Un message refusé par une file pleine : on le dit, et son texte reste dans le champ. */
  const [fileRefusee, setFileRefusee] = useState(false);
  useEffect(() => setFileRefusee(false), [idEnCours]);

  /*
   * Pendant une réponse, le message entre dans la file de ce Chat
   * (29/09/2026), avec les pièces jointes et les choix du moment (modèle,
   * outils, web, image) ; il part seul à la fin normale de la réponse.
   */
  const mettreEnFile = () => {
    const creation = modeImage
      ? { format: modeVideo && formatImage === "carre" ? ("paysage" as const) : formatImage, video: modeVideo }
      : undefined;
    const ajout = chat.mettreEnFile(draft, creation ? [] : jointes.pieces, creation);
    if (!ajout) return;
    if (!ajout.ok) {
      setFileRefusee(true);
      return;
    }
    setFileRefusee(false);
    setDraft("");
    if (!creation) jointes.vider();
  };

  const submit = () => {
    if (chat.busy) {
      mettreEnFile();
      return;
    }
    const text = draft;
    const pieces = jointes.pieces;
    setDraft("");
    if (modeImage) {
      void chat.creerImage(text, modeVideo && formatImage === "carre" ? "paysage" : formatImage, modeVideo);
      return;
    }
    jointes.vider();
    void chat.send(text, pieces);
  };

  /*
   * Première mise en route d'un poste autonome : aucun modèle disponible, on
   * propose de l'installer. Un poste rattaché à une instance n'a rien à
   * installer — ses modèles sont ceux de l'instance.
   */
  if (
    !instance().remote &&
    !modelsLoading &&
    models.length === 0 &&
    chat.messages.length === 0
  ) {
    return <FirstRun onReady={refreshModels} />;
  }

  /*
   * Deux choses valent la peine d'être dites avant l'envoi : un fichier
   * refusé, et une image confiée à un modèle qui ne sait pas la lire — ce
   * dernier cas ne produit aucune erreur, juste une réponse à côté.
   */
  const avertissements = (
    <>
      <InviteOutils actif={toolsOn} autorise={toolsAllowed} onAllumer={() => setToolsOn(true)} />
      {agentDisparu !== null && (
        <InfoBox
          tone="muted"
          className="mt-2"
          leading={<TriangleAlert size={15} strokeWidth={1.75} />}
        >
          {agentDisparu
            ? tf("L'agent de ce Chat, « {0} », a été supprimé : c'est l'agent par défaut qui répond désormais.", agentDisparu)
            : t("L'agent de ce Chat a été supprimé : c'est l'agent par défaut qui répond désormais.")}
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
      placeholder={
        modeImage
          ? modeVideo
            ? t("Décrivez la vidéo à créer : ce qu'on voit, ce qui bouge...")
            : t("Décrivez l'image à créer...")
          : t("Posez votre question... @ pour mentionner un document ou une transcription")
      }
      value={draft}
      onChange={setDraft}
      onSubmit={submit}
      busy={chat.busy}
      onStop={chat.stop}
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
      onCreerImage={() => {
        setModeVideo(false);
        setModeImage(true);
        // Créer une image ne cherche rien : les deux modes ne se cumulent pas, comme chez ChatGPT.
        setRechercheWeb(false);
      }}
      onCreerVideo={() => {
        setModeVideo(true);
        if (formatImage === "carre") setFormatImage("paysage");
        setModeImage(true);
        setRechercheWeb(false);
      }}
      rechercheWeb={{
        actif: webActif,
        etat: etatWeb,
        onChange: (actif) => {
          setRechercheWeb(actif);
          if (actif) {
            setModeImage(false);
            setModeVideo(false);
          }
        },
      }}
      accessoire={
        webActif && etatWeb ? (
          <RechercheWebChip moteur={etatWeb.moteur} onFermer={() => setRechercheWeb(false)} />
        ) : modeImage ? (
          <ImageChip
            key={modeVideo ? "video" : "image"}
            genre={modeVideo ? "video" : "image"}
            onFermer={() => {
              setModeImage(false);
              setModeVideo(false);
            }}
            format={formatImage}
            onFormat={setFormatImage}
          />
        ) : null
      }
      modelUid={modelUid}
      onModelChange={(uid) => update({ preferredModelUid: uid })}
      effort={effort}
      onEffortChange={(e) =>
        update({ preferredEffort: e as NiveauRaisonnement })
      }
      contextBar={
        <>
          {selecteurProjet}
          <AgentSelector
            value={agentId}
            onChange={setAgentId}
            side={chat.messages.length > 0 ? "top" : "bottom"}
          />
          <OutilsChip
            actif={toolsOn}
            onChange={setToolsOn}
            autorise={toolsAllowed}
            nomAgent={agent.name}
          />
          <ConnaissancesChip
            choisies={basesChoisies}
            onChange={setBasesChoisies}
            heritees={basesHeritees}
            side={chat.messages.length > 0 ? "top" : "bottom"}
          />
        </>
      }
    />
  );

  /* --- Conversation en cours ------------------------------------------- */
  if (chat.messages.length > 0) {
    return (
      <div className="flex h-full flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[760px] px-6 py-8">
            <MessageList messages={chat.messages} />
          </div>
        </div>
        <div className="shrink-0 px-6 pb-5">
          <div className="mx-auto w-full max-w-[760px]">
            {composer}
            {avertissements}
          </div>
        </div>
      </div>
    );
  }

  /* --- Accueil (état vide) --------------------------------------------- */
  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="mx-auto flex w-full max-w-[760px] flex-1 flex-col justify-center px-6 pb-20 pt-12">
        <div className="mb-7 flex items-center justify-center gap-3">
          <LogoMark size={44} animated />
          <h1 className="text-3xl font-medium tracking-tight text-foreground">
            {t("Sur quoi voulez-vous travailler ?")}
          </h1>
        </div>

        {composer}
        {avertissements}

        <div className="mt-5 px-1">
          <SuggestionList
            onDemander={(question, outils) => {
              setDraft(question);
              // Une question sur le courrier ou l'agenda n'a de sens qu'avec
              // les outils : les laisser coupés donnerait une réponse à côté.
              if (outils) setToolsOn(true);
            }}
            onBase={(base) => setBasesChoisies((avant) => (avant.includes(base) ? avant : [...avant, base]))}
          />
        </div>
      </div>
    </div>
  );
}

export default HomePage;
