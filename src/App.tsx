import { ServicesPage } from "@/pages/ServicesPage";
import { EntretiensPage } from "@/pages/EntretiensPage";
import { VideosPage } from "@/pages/VideosPage";
import { FenetreMiseAJour } from "@/components/layout/FenetreMiseAJour";
import {
  createBrowserRouter,
  createHashRouter,
  RouterProvider,
  Navigate,
  type RouteObject,
} from "react-router-dom";
import { useEffect, useState } from "react";
import { features } from "@/config/branding";
import { isSignedIn, clearCurrentUser } from "@/lib/store/identity";
import { SEANCE_EXPIREE } from "@/lib/endpoint";
import { relireMaintenant } from "@/lib/store/sync";
import { LoginPage } from "@/pages/LoginPage";
import { InstanceSetupPage } from "@/pages/InstanceSetupPage";
import { isConfigured } from "@/lib/instance";
import { surInvitation, type InvitationRecue } from "@/lib/invitations";
import { useApparence } from "@/hooks/useApparence";
import { AppLayout } from "@/components/layout/AppLayout";
import { HomePage } from "@/pages/HomePage";
import { CoworkPage } from "@/pages/CoworkPage";
import { CodePage } from "@/pages/CodePage";
import { ProjetsPage } from "@/pages/ProjetsPage";
import { AgentsPage } from "@/pages/AgentsPage";
import { BibliothequePage } from "@/pages/BibliothequePage";
import { GroupesPage } from "@/pages/GroupesPage";
import { ReunionsPage } from "@/pages/ReunionsPage";
import { TachesPage } from "@/pages/TachesPage";
import { ModelesPage } from "@/pages/ModelesPage";
import { SettingsLayout } from "@/components/settings/SettingsShell";
import { CompetencesSettings } from "@/components/settings/CompetencesReglages";
import {
  ProfilSettings,
  PreferencesSettings,
  SecuriteSettings,
  PersonnalisationSettings,
  BotRecorderSettings,
  McpSettings,
  ApiSettings,
  UsageSettings,
  AbonnementSettings,
  ModelesSettings,
  ModelesLocauxSettings,
  EntrainementSettings,
  ConfidentialiteSettings,
  AppsSettings,
  ImportSettings,
  EcranSettings,
  SignalerSettings,
} from "@/pages/ParametresPages";

/** Route incluse seulement si son module est actif dans l'édition livrée. */
const when = (on: boolean, route: RouteObject): RouteObject[] => (on ? [route] : []);

/**
 * Choix du routeur, selon d'où l'interface est chargée.
 *
 * L'application empaquetée ouvre son interface depuis le disque (`file://`).
 * Un routeur qui écrit des chemins d'URL y transforme « /cowork » en
 * `file:///cowork` — un fichier qui n'existe pas. La page se ré-affiche tant
 * qu'on ne fait que naviguer, mais **le moindre rechargement donne un écran
 * blanc**, définitivement : le bouton « Réessayer », un rafraîchissement, un
 * plantage du rendu.
 *
 * Le routeur à ancre met le chemin après un « # », que le système de fichiers
 * ignore. Le serveur de développement, lui, garde des adresses propres.
 */
/*
 * Depuis la 0.23.0, l'interface livrée est servie sous `helix://app` et non
 * plus depuis le disque. Le routeur à ancre reste le bon choix pour elle, et
 * pour une raison de plus que le chemin : un routeur d'historique remplace
 * l'adresse entière à chaque navigation, **paramètres compris**. Or l'adresse
 * de départ porte le jeton d'instance que l'application remet à son interface
 * (`?token=`, voir electron/main.cjs). Mesuré : un clic sur « Réglages »
 * effaçait ce jeton, toutes les requêtes suivantes repartaient sans
 * autorisation, l'instance répondait 401, et l'application se croyait
 * déconnectée. Avec l'ancre, le chemin vit après le « # » et les paramètres
 * restent intacts.
 */
const servieParLApplication =
  typeof window !== "undefined" && !/^https?:$/.test(window.location.protocol);
const creerRouteur = servieParLApplication ? createHashRouter : createBrowserRouter;

const router = creerRouteur([
  {
    element: <AppLayout />,
    children: [
      { path: "/", element: <HomePage /> },
      ...when(features.cowork, { path: "/cowork", element: <CoworkPage /> }),
      ...when(features.code, { path: "/code", element: <CodePage /> }),
      ...when(features.projets, { path: "/projets", element: <ProjetsPage /> }),
      ...when(features.agents, { path: "/agents", element: <AgentsPage /> }),
      ...when(features.bibliotheque, { path: "/bibliotheque", element: <BibliothequePage /> }),
      ...when(features.reunions, { path: "/reunions", element: <ReunionsPage /> }),
      ...when(features.groupes, { path: "/groupes", element: <GroupesPage /> }),
      ...when(features.taches, { path: "/taches", element: <TachesPage /> }),
      // Tout le catalogue des modèles libres, ouvert depuis le sélecteur du Chat (28/09/2026).
      { path: "/modeles", element: <ModelesPage /> },
      { path: "/services", element: <ServicesPage /> },
      { path: "/services/entretiens", element: <EntretiensPage key="entretien" /> },
      { path: "/services/cours", element: <EntretiensPage key="cours" mode="cours" /> },
      { path: "/videos", element: <VideosPage /> },
      {
        path: "/parametres",
        element: <SettingsLayout />,
        children: [
          { index: true, element: <Navigate to="profil" replace /> },
          { path: "profil", element: <ProfilSettings /> },
          { path: "preferences", element: <PreferencesSettings /> },
          { path: "securite", element: <SecuriteSettings /> },
          { path: "personnalisation", element: <PersonnalisationSettings /> },
          { path: "competences", element: <CompetencesSettings /> },
          { path: "bot-recorder", element: <BotRecorderSettings /> },
          { path: "mcp", element: <McpSettings /> },
          { path: "ecran", element: <EcranSettings /> },
          /*
           * Ancienne adresse conservée : elle redirige vers l'écran unique.
           * Un poste qui l'avait en favori, ou un lien noté quelque part,
           * doit continuer de tomber au bon endroit.
           */
          { path: "integrations", element: <Navigate to="../mcp" replace /> },
          { path: "api", element: <ApiSettings /> },
          { path: "usage", element: <UsageSettings /> },
          ...when(features.abonnement, {
            path: "abonnement",
            element: <AbonnementSettings />,
          }),
          { path: "modeles-locaux", element: <ModelesLocauxSettings /> },
          { path: "modeles", element: <ModelesSettings /> },
          { path: "entrainement", element: <EntrainementSettings /> },
          { path: "confidentialite", element: <ConfidentialiteSettings /> },
          { path: "apps", element: <AppsSettings /> },
          { path: "importer", element: <ImportSettings /> },
          { path: "signaler", element: <SignalerSettings /> },
        ],
      },
      { path: "*", element: <HomePage /> },
    ],
  },
]);

export default function App() {
  // Deux préalables, dans cet ordre : savoir à quoi le poste est rattaché
  // (machine seule ou instance d'entreprise), puis qui l'utilise. Profils,
  // mémoire et sessions sont ainsi toujours rattachés à quelqu'un (ADR-010).
  const [configured, setConfigured] = useState(() => isConfigured());
  const [signedIn, setSignedIn] = useState(() => isSignedIn());
  /*
   * Invitation arrivée par lien `helix://rejoindre`, cliquée dans un mail.
   *
   * Elle ne concerne pas que le premier lancement : une personne qui utilise
   * déjà Helix sur son poste peut être invitée sur l'instance d'un collègue.
   * L'écran de rattachement s'ouvre alors par-dessus l'application, en disant
   * ce que cela change et en laissant renoncer.
   */
  const [invitation, setInvitation] = useState<InvitationRecue | null>(null);
  useEffect(() => surInvitation(setInvitation), []);

  /*
   * Monté ici, au-dessus de tout : l'écran de configuration et celui de
   * connexion doivent eux aussi être sombres à minuit. Le thème est un état de
   * la fenêtre, pas une propriété d'un écran connecté.
   */
  useApparence();

  /*
   * L'instance peut cesser de reconnaître ce poste : séance expirée au bout de
   * douze heures, révoquée depuis un autre poste, ou instance réinstallée. On
   * revient alors à l'écran de connexion, plutôt que de laisser l'utilisateur
   * face à une application qui affiche son nom et refuse tout.
   */
  useEffect(() => {
    /*
     * On recharge la fenêtre (revue du 26/09/2026) : la synchronisation garde
     * en mémoire ce qu'elle a déjà relu de l'instance. Sans rechargement, la
     * personne suivante qui se connectait sur ce poste repartait sur cet état,
     * sans relire, et son premier envoi poussait la copie de la précédente :
     * l'instance effaçait alors ce qui, à elle, n'y figurait pas. Rechargée,
     * la synchronisation relit tout avant d'écrire quoi que ce soit.
     */
    const expiree = () => {
      clearCurrentUser().finally(() => {
        setSignedIn(false);
        window.location.reload();
      });
    };
    window.addEventListener(SEANCE_EXPIREE, expiree);
    return () => window.removeEventListener(SEANCE_EXPIREE, expiree);
  }, []);

  if (!configured || invitation) {
    return (
      <InstanceSetupPage
        invitation={invitation}
        onAnnuler={configured ? () => setInvitation(null) : undefined}
        onReady={() => {
          // L'adresse de la passerelle est figée à l'import : on recharge pour
          // que toute l'application parte sur la bonne instance.
          window.location.reload();
          setConfigured(true);
        }}
      />
    );
  }

  if (!signedIn)
    return (
      <>
        <LoginPage
          onSignedIn={() => {
            setSignedIn(true);
            // Les Chats et les projets de la personne, relus sans attendre la relève suivante.
            void relireMaintenant();
          }}
        />
        {/*
          La mise à jour proposée dès l'écran de connexion (24/10/2026, Medhi) :
          sans cela, une personne qui a perdu son mot de passe ne voyait jamais
          la fenêtre, qui ne vit qu'après la connexion, et ne recevait donc
          jamais la version qui apporte « Mot de passe oublié ? ». La fenêtre
          ne parle qu'au processus principal d'Electron, sans séance.
        */}
        <FenetreMiseAJour />
      </>
    );

  return <RouterProvider router={router} />;
}
