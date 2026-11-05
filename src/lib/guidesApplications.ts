import { branding } from "@/config/branding";
import { t, tf } from "@/lib/i18n";

/**
 * Créer l'application chez le fournisseur, service par service, pour
 * quelqu'un qui n'a jamais ouvert une console de développeur.
 *
 * Demandé par Medhi le 28/09/2026 : « quand je veux connecter Gmail, il n'y a
 * pas la redirection vers où je dois aller pour créer l'appli ; tout doit être
 * simple, pour tout ». Chaque guide donne, dans l'ordre de la console :
 *
 *  - le ou les boutons « Ouvrir … » vers la page exacte où l'on agit ;
 *  - des étapes courtes, numérotées, qui disent quoi cliquer et quoi recopier ;
 *    l'étape où l'on colle l'adresse de retour la porte (`retour`), copiable ;
 *    celle où l'on coche des portées les liste (`portees`), copiables aussi ;
 *  - ce qu'il ne faut pas faire ;
 *  - les erreurs que le fournisseur affiche chez lui, avec leur cause et le
 *    remède. Une erreur montrée par le fournisseur (« redirect_uri_mismatch »
 *    chez Google, « URL bloquée » chez Meta) ne revient jamais à l'instance :
 *    elle ne peut s'expliquer qu'ici, avant d'essayer.
 *
 * Liens, libellés et règles relus le 28/09/2026 sur la documentation officielle
 * de chaque fournisseur (citée au-dessus de chaque guide). Les consoles elles-
 * mêmes sont derrière une connexion : elles n'ont pas été ouvertes, et leurs
 * libellés changent ; le composant le dit (GuideApplication.tsx). Les libellés
 * sont écrits tels que la console les affiche en anglais, avec le français
 * entre parenthèses quand la documentation française le donne.
 *
 * Traduits au rendu (fonctions), jamais au chargement du module : la langue
 * n'y est pas encore connue.
 *
 * `npm run securite` (section 32) contrôle que chaque service à application a
 * son guide, un lien de console en https et, s'il déclare une adresse de
 * retour, une étape qui la porte.
 */

export interface EtapeGuide {
  texte: string;
  /** L'adresse de retour se colle à cette étape : elle s'affiche dessous, avec « Copier ». */
  retour?: true;
  /** Portées ou permissions à ajouter à cette étape, listées et copiables. */
  portees?: string[];
  /** Comment les séparer pour la copie (« , » chez Meta et TikTok). */
  separateur?: string;
  notePortees?: string;
  /** Des commandes à taper (Brevo). */
  commandes?: string[];
  /** Un lien propre à l'étape. */
  lien?: { libelle: string; url: string };
}

export interface GuideAppli {
  /** Le fournisseur, pour « Si … affiche une erreur ». */
  nom: string;
  introduction?: string;
  /** Les pages de la console, dans l'ordre où on les ouvre. La première est la plus importante. */
  consoles: { libelle: string; url: string }[];
  etapes: EtapeGuide[];
  aEviter?: string[];
  erreurs?: { code: string; texte: string }[];
  /** Où trouver, dans la console, ce qu'on colle dans les champs de l'écran. */
  champs?: { identifiant?: string; secret?: string; annuaire?: string };
  /** Pas de console de développeur (une application à ouvrir, Palmier Pro) : la note sur ses libellés n'a pas lieu d'être. */
  sansConsole?: true;
}

/* ------------------------------------------------------------------ */
/* Google : une application pour tous les services Google               */
/* ------------------------------------------------------------------ */

/**
 * Les API Google dont se sert l'instance, par service. Noms relevés sur
 * https://developers.google.com/workspace/guides/enable-apis et
 * https://developers.google.com/youtube/v3/quickstart/python (28/09/2026).
 */
export const API_GOOGLE = {
  gmail: { nom: "Gmail API", service: "gmail.googleapis.com" },
  agenda: { nom: "Google Calendar API", service: "calendar-json.googleapis.com" },
  drive: { nom: "Google Drive API", service: "drive.googleapis.com" },
  sheets: { nom: "Google Sheets API", service: "sheets.googleapis.com" },
  slides: { nom: "Google Slides API", service: "slides.googleapis.com" },
  docs: { nom: "Google Docs API", service: "docs.googleapis.com" },
  forms: { nom: "Google Forms API", service: "forms.googleapis.com" },
  youtube: { nom: "YouTube Data API v3", service: "youtube.googleapis.com" },
} as const;
export type ServiceGoogle = keyof typeof API_GOOGLE;

/**
 * Activer une ou plusieurs API d'un coup : la forme `flows/enableapi?apiid=a,b`
 * que Google emploie lui-même (https://developers.google.com/workspace/guides/configure-mcp-servers,
 * lu le 28/09/2026). La console demande de confirmer le projet.
 */
export const activerApisGoogle = (services: ServiceGoogle[]): string =>
  `https://console.cloud.google.com/flows/enableapi?apiid=${services.map((s) => API_GOOGLE[s].service).join(",")}`;

const TOUTES_GOOGLE = Object.keys(API_GOOGLE) as ServiceGoogle[];

/**
 * Google Cloud, une fois pour toute l'instance : un projet, les API activées
 * d'un coup, l'écran de consentement (Google Auth Platform), puis un client
 * « Application de bureau ». Sources, lues le 28/09/2026 :
 *  - https://developers.google.com/workspace/guides/create-project (projectcreate) ;
 *  - https://developers.google.com/workspace/guides/configure-oauth-consent (Premiers pas, Audience, Interne / Externe) ;
 *  - https://developers.google.com/workspace/guides/create-credentials (Créer un client, Application de bureau) ;
 *  - https://support.google.com/cloud/answer/15549257 : le secret ne se montre qu'à la création (clients créés depuis juin 2025) ;
 *  - https://support.google.com/cloud/answer/15549945 : 100 utilisateurs de test, « Publier l'application » ;
 *  - https://developers.google.com/identity/protocols/oauth2 : en test, une application « Externe » voit ses accès expirer au bout de sept jours ;
 *  - https://support.google.com/cloud/answer/13464323 : usage interne ou personnel, moins de 100 personnes, sans vérification ;
 *  - https://developers.google.com/identity/protocols/oauth2/native-app : une « Application de bureau » revient par la boucle locale, sur un port quelconque, sans adresse à déclarer.
 */
export function guideGoogle(): GuideAppli {
  return {
    nom: "Google",
    introduction: t("Une seule application Google sert à tout : Gmail, Google Agenda, Google Drive, Sheets, Slides, Docs, Forms et YouTube. Créez-la une fois ; les autres services Google la reprendront sans rien demander. Comptez dix minutes."),
    consoles: [
      { libelle: t("la création de projet (Google Cloud)"), url: "https://console.cloud.google.com/projectcreate" },
      { libelle: t("l'activation des API Google"), url: activerApisGoogle(TOUTES_GOOGLE) },
      { libelle: t("Google Auth Platform"), url: "https://console.cloud.google.com/auth/overview" },
      { libelle: t("la création du client OAuth"), url: "https://console.cloud.google.com/auth/clients/create" },
    ],
    etapes: [
      { texte: tf("Création de projet : un nom (par exemple « {0} »), puis « Create » (Créer). Vérifiez ensuite que ce projet est celui choisi en haut de la console.", branding.name) },
      { texte: t("Activation des API : le bouton active d'un coup les API de Gmail, Agenda, Drive, Sheets, Slides, Docs, Forms et YouTube. Confirmez le projet, puis activez.") },
      {
        texte: t("Google Auth Platform, « Get started » (Premiers pas) : un nom d'application et votre adresse, puis l'audience. « Internal » (Interne) si votre organisation a Google Workspace : seuls ses comptes pourront se connecter, sans examen ni limite. Sinon (un compte Gmail personnel), « External » (Externe). Puis votre adresse de contact, acceptez la règle sur les données utilisateur, « Continue » et « Create »."),
      },
      {
        texte: t("« External » seulement : « Audience », « Test users » (Utilisateurs test), « Add users » : l'adresse du compte Google à brancher, puis « Save ». Ensuite, « Publish app » (Publier l'application) : une application restée en test perd ses accès au bout de sept jours."),
      },
      {
        texte: t("« Clients », « Create client » (Créer un client) : type d'application « Desktop app » (Application de bureau), un nom, puis « Create ». Aucune adresse de retour à déclarer : ce type d'application revient par la boucle locale de la machine."),
      },
      {
        texte: t("Google affiche l'ID client, qui se termine par .apps.googleusercontent.com, et le code secret du client. Copiez les deux tout de suite (ou « Download JSON ») : Google ne remontre plus le secret ensuite. Collez-les ci-dessous."),
      },
    ],
    aEviter: [
      t("Ne choisissez pas « Web application » (Application Web) : il faudrait déclarer une adresse de retour, et les services Google reviennent par un port qui change à chaque connexion. « Desktop app » n'en demande aucune."),
      t("Ne créez pas une application par service : la même sert à tous les services Google de l'instance."),
      t("Ne laissez pas une application « External » en test si vous voulez qu'elle dure : Google coupe ses accès au bout de sept jours."),
      t("Ne demandez pas la vérification de Google : elle ne sert qu'aux applications ouvertes au public. Une application interne, ou pour moins de 100 personnes, s'en passe."),
    ],
    erreurs: [
      {
        code: t("« Google hasn't verified this app » (Google n'a pas validé cette application)"),
        texte: t("Normal pour une application « External » qui ne sert qu'à votre organisation. Cliquez sur « Advanced », puis « Go to … (unsafe) » (Accéder à … (non sécurisé)). Jusqu'à 100 comptes."),
      },
      { code: "Error 403: access_denied", texte: t("Le compte n'est pas dans les utilisateurs de test d'une application en test. Ajoutez-le (« Audience », « Test users »), ou publiez l'application.") },
      { code: "Error 403: org_internal", texte: t("L'application est « Internal » : seul un compte de votre organisation Google Workspace peut s'y connecter. Branchez un compte de l'organisation, ou passez l'audience en « External ».") },
      { code: "Error 400: admin_policy_enforced", texte: t("L'administrateur de votre Google Workspace bloque les applications tierces. Dans la console d'administration : « Security », « Access and data control », « API controls », « Manage app access » : ajoutez cette application par son ID client et marquez-la « Trusted » (fiable).") },
      { code: "Error 400: redirect_uri_mismatch", texte: t("Le client n'est pas de type « Desktop app ». Créez un client de ce type, puis remplacez l'application enregistrée ici.") },
      { code: "invalid_client · deleted_client", texte: t("L'ID ou le secret ne correspondent plus à un client existant (supprimé, ou supprimé par Google après six mois sans usage). Créez un client, puis remplacez l'application enregistrée ici.") },
      { code: t("« API has not been used in project… or it is disabled »"), texte: t("L'API du service n'est pas activée dans ce projet : ouvrez l'activation des API (bouton ci-dessus), activez, attendez quelques minutes, puis recommencez.") },
    ],
    champs: {
      identifiant: t("« Client ID » (ID client), sur la fiche du client : il se termine par .apps.googleusercontent.com."),
      secret: t("« Client secret » (code secret du client), montré une seule fois à la création. Perdu : « Add secret » sur la fiche du client en crée un autre."),
    },
  };
}

/* ------------------------------------------------------------------ */
/* Microsoft : Entra ID                                                 */
/* ------------------------------------------------------------------ */

/**
 * Microsoft Entra, lu le 28/09/2026 :
 *  - https://learn.microsoft.com/en-us/entra/identity-platform/quickstart-register-app (« Entra ID », « App registrations », « New registration », « Single tenant only ») ;
 *  - https://learn.microsoft.com/en-us/entra/identity-platform/how-to-add-redirect-uri (« Authentication », « Add Redirect URI », « Mobile and desktop applications ») ;
 *  - https://learn.microsoft.com/en-us/entra/identity-platform/reply-url (http seulement pour localhost, port ignoré pour localhost, 127.0.0.1 en http refusé par le portail) ;
 *  - https://learn.microsoft.com/en-us/entra/identity-platform/how-to-add-credentials (la « Value » d'un secret ne se montre qu'une fois) ;
 *  - https://learn.microsoft.com/en-us/entra/identity-platform/reference-error-codes (AADSTS…).
 * Le lien est celui que Microsoft donne pour « App registrations »
 * (https://go.microsoft.com/fwlink/?linkid=2083908, cité par v2-oauth2-auth-code-flow) :
 * les adresses internes du portail (#view/…) ne sont documentées nulle part.
 */
const ENTRA_INSCRIPTIONS = "https://go.microsoft.com/fwlink/?linkid=2083908";

function erreursMicrosoft(retour: string): { code: string; texte: string }[] {
  return [
    { code: "AADSTS50011", texte: tf("L'adresse de retour n'est pas déclarée à l'identique : dans « Authentication », ajoutez {0} (même chemin, mêmes minuscules).", retour) },
    { code: "AADSTS65001 · AADSTS90094", texte: t("Une permission demande le consentement d'un administrateur de l'annuaire : il clique sur « Grant admin consent for … » (Accorder le consentement administrateur) dans « API permissions », puis recommencez.") },
    { code: "AADSTS700016", texte: t("Microsoft ne trouve pas l'application dans cet annuaire : vérifiez l'« Application (client) ID » et le « Directory (tenant) ID » collés ici.") },
    { code: "AADSTS50194", texte: t("L'application est « Single tenant » : indiquez l'ID de l'annuaire (tenant) plutôt que « common » ou « organizations ».") },
    { code: "AADSTS7000218", texte: t("L'adresse de retour est déclarée sur la plateforme « Web », qui exige un secret : collez le secret, ou déclarez l'adresse sur « Mobile and desktop applications ».") },
    { code: "AADSTS700025", texte: t("L'adresse est déclarée sur « Mobile and desktop applications » (client public), qui refuse un secret : retirez le secret ici, ou déclarez l'adresse sur « Web ».") },
    { code: "AADSTS7000215", texte: t("Le secret collé n'est pas le bon : c'est sa « Value » qu'il faut, pas son « Secret ID ».") },
    { code: "AADSTS50020", texte: t("Le compte n'appartient pas à l'annuaire de l'application : connectez-vous avec un compte de l'organisation.") },
  ];
}

/**
 * Microsoft 365 par Microsoft Graph (natifs/microsoftBase.ts) : `permissions`
 * est la liste exacte que la connexion demandera, selon les services cochés.
 */
export function guideMicrosoft(retour: string, permissions: string[]): GuideAppli {
  return {
    nom: "Microsoft",
    consoles: [{ libelle: t("les inscriptions d'applications (Microsoft Entra)"), url: ENTRA_INSCRIPTIONS }],
    etapes: [
      { texte: t("Connectez-vous avec un compte qui peut créer des applications (au moins le rôle « Application Developer »). « App registrations » (Inscriptions d'applications), « New registration » (Nouvelle inscription) : un nom au choix, et « Single tenant only » (Locataire unique uniquement), puis « Register » (Inscrire).") },
      { texte: t("Page « Overview » (Vue d'ensemble) : copiez l'« Application (client) ID » et le « Directory (tenant) ID ». Ce sont les deux premiers champs ci-dessous.") },
      {
        texte: t("« Authentication », « Add Redirect URI » (ou « Add a platform ») : choisissez « Mobile and desktop applications » (applications mobiles et de bureau), collez l'adresse de retour ci-dessous telle quelle, sans port, puis enregistrez."),
        retour: true,
      },
      {
        texte: t("« API permissions » (Autorisations de l'API), « Add a permission », « Microsoft Graph », « Delegated permissions » : ajoutez exactement les permissions listées ici, selon les services que vous cochez, rien de plus."),
        portees: permissions,
        separateur: ", ",
      },
      { texte: t("SharePoint ou Teams cochés, ou organisation qui interdit aux personnes de consentir : un administrateur de l'annuaire clique sur « Grant admin consent for … » (Accorder le consentement administrateur).") },
    ],
    aEviter: [
      t("Ne choisissez pas « Web » comme plateforme si vous ne voulez pas gérer de secret : « Web » en exige un, et il expire (24 mois au plus)."),
      t("N'ajoutez pas de permission en trop : la connexion serait refusée par prudence."),
      t("N'écrivez pas 127.0.0.1 à la place de localhost : le portail le refuse en http."),
    ],
    erreurs: erreursMicrosoft(retour),
    champs: {
      identifiant: t("« Application (client) ID », sur la page « Overview » de l'application."),
      annuaire: t("« Directory (tenant) ID », sur la même page. Ou un domaine de l'organisation, ou « common » si l'application accepte plusieurs annuaires."),
      secret: t("« Certificates & secrets », « New client secret » : copiez la « Value » (montrée une seule fois), pas le « Secret ID »."),
    },
  };
}

/**
 * La boîte Outlook par IMAP et SMTP (courrierOauth.ts), lu le 28/09/2026 :
 * https://learn.microsoft.com/en-us/exchange/client-developer/legacy-protocols/how-to-authenticate-an-imap-pop-smtp-application-by-using-oauth
 * (portées IMAP.AccessAsUser.All et SMTP.Send, listées parmi les permissions
 * déléguées de Microsoft Graph : https://learn.microsoft.com/en-us/graph/permissions-reference)
 * et https://learn.microsoft.com/en-us/exchange/clients-and-mobile-in-exchange-online/authenticated-client-smtp-submission
 * (SMTP AUTH à activer pour la boîte, coupé par les « paramètres de sécurité par défaut »).
 * `reprise` : l'application Microsoft 365 de l'instance existe déjà, on la complète.
 */
export function guideCourrierMicrosoft(retour: string, reprise: boolean): GuideAppli {
  const etapesCreation: EtapeGuide[] = reprise
    ? [{ texte: t("Ouvrez l'application Microsoft 365 déjà enregistrée sur cette instance (même « Application (client) ID »).") }]
    : [
        { texte: t("« App registrations » (Inscriptions d'applications), « New registration » : un nom au choix, et « Single tenant only » (Locataire unique uniquement), puis « Register ».") },
        { texte: t("Page « Overview » : copiez l'« Application (client) ID » et le « Directory (tenant) ID », pour les champs ci-dessous.") },
      ];
  return {
    nom: "Microsoft",
    consoles: [{ libelle: t("les inscriptions d'applications (Microsoft Entra)"), url: ENTRA_INSCRIPTIONS }],
    etapes: [
      ...etapesCreation,
      {
        texte: t("« Authentication », « Add Redirect URI » : sur la plateforme « Mobile and desktop applications » (celle de l'application Microsoft 365, s'il y en a une), ajoutez l'adresse de retour ci-dessous, puis enregistrez."),
        retour: true,
      },
      {
        texte: t("« API permissions », « Add a permission », « Microsoft Graph », « Delegated permissions » : ajoutez IMAP.AccessAsUser.All, SMTP.Send et offline_access."),
        portees: ["IMAP.AccessAsUser.All", "SMTP.Send", "offline_access"],
        separateur: ", ",
      },
      { texte: t("Pour envoyer : l'administrateur Microsoft 365 active « Authenticated SMTP » (SMTP authentifié) pour cette boîte (centre d'administration Microsoft 365, « Users », la personne, « Mail », « Manage email apps »). Les « paramètres de sécurité par défaut » de l'annuaire le coupent.") },
    ],
    aEviter: [
      t("Ne créez pas une seconde application si celle de Microsoft 365 existe : ajoutez-lui cette adresse et ces permissions."),
      t("Un compte personnel outlook.com ne passe pas par ici : il se branche avec l'adresse et un mot de passe d'application."),
    ],
    erreurs: erreursMicrosoft(retour),
    champs: {
      identifiant: t("« Application (client) ID », sur la page « Overview » de l'application."),
      annuaire: t("« Directory (tenant) ID », sur la même page. Sans lui, une application « Single tenant » est refusée (AADSTS50194)."),
      secret: t("Seulement si l'adresse est déclarée sur la plateforme « Web » : la « Value » du secret (« Certificates & secrets »)."),
    },
  };
}

/* ------------------------------------------------------------------ */
/* Réseaux sociaux                                                       */
/* ------------------------------------------------------------------ */

/**
 * LinkedIn, lu le 28/09/2026 :
 * https://learn.microsoft.com/en-us/linkedin/shared/authentication/authorization-code-flow (onglet « Auth », correspondance exacte, erreurs),
 * https://learn.microsoft.com/en-us/linkedin/consumer/integrations/self-serve/sign-in-with-linkedin-v2 et share-on-linkedin (produits),
 * https://learn.microsoft.com/en-us/linkedin/marketing/community-management/community-management-api-migration-guide
 * (« Community Management API » : seulement sur une application qui n'a aucun autre produit).
 * La documentation demande https pour l'adresse de retour et ne dit rien de
 * http://localhost : l'écran le dit, et donne la voie en https.
 *
 * Depuis le 29/09/2026, cette application ne sert plus qu'au profil : la Page
 * d'entreprise se branche avec une seconde application (`guideLinkedinPage`
 * ci-dessous) ; l'introduction le dit, et le panneau mène à l'autre ligne
 * (ConnecteurNatif.tsx, VersPageLinkedin).
 */
function guideLinkedin(): GuideAppli {
  return {
    nom: "LinkedIn",
    introduction: t("Cette application sert au profil LinkedIn : se connecter, et publier en son nom. La Page d'entreprise se branche à part, avec une seconde application (ligne « LinkedIn (Page d'entreprise) »)."),
    consoles: [{ libelle: t("la création d'application LinkedIn"), url: "https://www.linkedin.com/developers/apps/new" }],
    etapes: [
      { texte: t("« Create app » : un nom, la page LinkedIn de votre entreprise (LinkedIn l'exige ; créez-la d'abord s'il n'y en a pas), un logo, cochez l'accord, puis « Create app ».") },
      { texte: t("Onglet « Products » : « Request access » sur « Sign In with LinkedIn using OpenID Connect », puis sur « Share on LinkedIn ». Les deux sont accordés tout de suite.") },
      { texte: t("Onglet « Auth », « OAuth 2.0 settings », « Authorized redirect URLs for your app » : le crayon, « Add redirect URL », collez l'adresse ci-dessous, puis « Update »."), retour: true },
      { texte: t("Même onglet, « Application credentials » : copiez le « Client ID » et le « Primary Client Secret », pour les champs ci-dessous.") },
    ],
    aEviter: [
      t("N'ajoutez pas « Community Management API » à cette application : LinkedIn ne l'accorde qu'à une application qui n'a aucun autre produit. La Page d'entreprise a sa propre application, sur sa propre ligne."),
      t("N'ajoutez ni « # » ni paramètre à l'adresse de retour : collez-la telle quelle."),
    ],
    erreurs: [
      { code: "The redirect_uri does not match the registered value", texte: t("L'adresse de retour n'est pas déclarée à l'identique dans l'onglet « Auth ». Si LinkedIn refuse une adresse en http, ouvrez l'instance par son adresse en https.") },
      { code: "unauthorized_scope_error · Invalid scope", texte: t("Un produit manque : ajoutez « Sign In with LinkedIn using OpenID Connect » et « Share on LinkedIn » dans l'onglet « Products ».") },
      { code: "user_cancelled_login · user_cancelled_authorize", texte: t("La connexion ou l'autorisation a été annulée dans la page de LinkedIn : recommencez.") },
    ],
    champs: { identifiant: t("« Client ID », onglet « Auth »."), secret: t("« Primary Client Secret », onglet « Auth ».") },
  };
}

/** Les portées de la Page d'entreprise, telles que la passerelle les demande (gateway/src/oauthNatif.ts, `linkedinPage`). */
export const PORTEES_PAGE_LINKEDIN = ["r_organization_social", "rw_organization_admin", "w_organization_social"];

/**
 * LinkedIn, la Page d'entreprise, par une seconde application (29/09/2026).
 * Lu ce jour-là :
 *  - https://learn.microsoft.com/en-us/linkedin/marketing/community-management/community-management-overview
 *    (FAQ 4 : « Community Management API » seulement sur une application neuve,
 *    sans autre produit ; paliers de développement et standard) ;
 *  - https://learn.microsoft.com/en-us/linkedin/marketing/community-management-app-review
 *    (organisation déclarée, adresse professionnelle vérifiée, application
 *    vérifiée par un super administrateur de la page, ni nom ni logo de
 *    LinkedIn ; une application refusée ne peut pas redemander : il en faut
 *    une neuve ; vidéo pour le palier standard) ;
 *  - https://learn.microsoft.com/en-us/linkedin/marketing/increasing-access
 *    (portées du produit ; 500 appels par jour pour l'application et 100 par
 *    personne au palier de développement) ;
 *  - https://www.linkedin.com/help/linkedin/answer/a1665329 (onglet
 *    « Settings », « Verify », « Generate URL », « Copy URL », lien valable
 *    30 jours pour le super administrateur de la page).
 * Aucun délai d'examen n'y est annoncé : le guide n'en promet aucun.
 */
function guideLinkedinPage(): GuideAppli {
  return {
    nom: "LinkedIn",
    introduction: t("Une seconde application LinkedIn, distincte de celle du profil, ne sert qu'à la Page d'entreprise : lire ses publications et ses statistiques, et publier en son nom. LinkedIn n'ouvre les pages qu'à une application qui n'a aucun autre produit, et il examine la demande avant."),
    consoles: [{ libelle: t("la création d'une nouvelle application LinkedIn"), url: "https://www.linkedin.com/developers/apps/new" }],
    etapes: [
      { texte: t("« Create app » : une application neuve, pas celle du profil. Un nom et un logo sans « LinkedIn » ni rien qui y ressemble (LinkedIn le refuse), la page LinkedIn de votre entreprise, cochez l'accord, puis « Create app ».") },
      {
        texte: t("Onglet « Settings », « Verify », puis « Generate URL » et « Copy URL » : envoyez ce lien à un super administrateur de la page de l'entreprise, qui l'ouvre et approuve. Le lien vaut 30 jours ; LinkedIn exige cette vérification avant d'examiner la demande."),
        lien: { libelle: t("L'aide de LinkedIn sur cette vérification"), url: "https://www.linkedin.com/help/linkedin/answer/a1665329" },
      },
      { texte: t("Onglet « Products » : « Request access » sur « Community Management API », et sur rien d'autre. Le formulaire demande une adresse e-mail professionnelle (LinkedIn la vérifie ; une adresse personnelle est refusée), la raison sociale, l'adresse, le site et la politique de confidentialité de l'entreprise.") },
      { texte: t("LinkedIn examine la demande. S'il l'accepte, l'application reçoit le premier palier (« Development tier ») : 500 appels par jour pour l'application et 100 par personne, de quoi essayer. Le palier standard, sans ces limites, se demande ensuite dans le même onglet, avec une vidéo de l'application. LinkedIn n'annonce pas de délai.") },
      { texte: t("Onglet « Auth », « OAuth 2.0 settings », « Authorized redirect URLs for your app » : le crayon, « Add redirect URL », collez l'adresse ci-dessous, puis « Update »."), retour: true },
      {
        texte: t("Même onglet, « OAuth 2.0 scopes » : une fois l'accès accordé, ces portées doivent y figurer. C'est tout ce que la connexion demandera ; w_organization_social seulement si vous cochez la publication."),
        portees: PORTEES_PAGE_LINKEDIN,
      },
      { texte: t("Même onglet, « Application credentials » : copiez le « Client ID » et le « Primary Client Secret », pour les champs ci-dessous. Le compte qui se connecte ensuite doit administrer la page.") },
    ],
    aEviter: [
      t("N'ajoutez aucun autre produit à cette application, ni « Sign In with LinkedIn using OpenID Connect » ni « Share on LinkedIn » : LinkedIn n'accorde « Community Management API » qu'à une application qui n'en a aucun autre."),
      t("Ne réutilisez pas l'application du profil : créez-en une neuve. Si LinkedIn refuse la demande, il faut aussi une application neuve pour la refaire."),
      t("Ne mettez « LinkedIn », ni un morceau de son nom ou de son logo, dans le nom ou le logo de l'application."),
      t("N'ajoutez ni « # » ni paramètre à l'adresse de retour : collez-la telle quelle."),
    ],
    erreurs: [
      { code: "unauthorized_scope_error · Invalid scope", texte: t("LinkedIn n'a pas encore accordé « Community Management API » à cette application (examen en cours ou refusé), ou une portée manque dans l'onglet « Auth ». Vérifiez l'onglet « Products ».") },
      { code: "The redirect_uri does not match the registered value", texte: t("L'adresse de retour n'est pas déclarée à l'identique dans l'onglet « Auth » de cette seconde application. Si LinkedIn refuse une adresse en http, ouvrez l'instance par son adresse en https.") },
      { code: "user_cancelled_login · user_cancelled_authorize", texte: t("La connexion ou l'autorisation a été annulée dans la page de LinkedIn : recommencez.") },
    ],
    champs: { identifiant: t("« Client ID » de la seconde application, onglet « Auth »."), secret: t("« Primary Client Secret » de la seconde application, onglet « Auth ».") },
  };
}

/**
 * Meta, lu le 28/09/2026 :
 * https://developers.facebook.com/documentation/development/create-an-app (https://developers.facebook.com/apps/creation/),
 * https://developers.facebook.com/documentation/pages-api/create-an-app (cas d'usage « Manage everything on your Page », « Ready to test »),
 * https://developers.facebook.com/docs/facebook-login/facebook-login-for-business (réglages, « Redirect URI »),
 * https://developers.facebook.com/documentation/facebook-login/security (correspondance exacte, mode strict, https imposé),
 * https://developers.facebook.com/blog/post/2018/06/08/enforce-https-facebook-login/ (http sur localhost, en mode développement seulement),
 * https://developers.facebook.com/docs/development/build-and-test/app-roles (rôles).
 */
function guideFacebook(): GuideAppli {
  return {
    nom: "Meta",
    consoles: [{ libelle: t("la création d'app Meta"), url: "https://developers.facebook.com/apps/creation/" }],
    etapes: [
      { texte: t("« Create app » (Créer une app) : un nom et votre adresse, puis le cas d'usage « Manage everything on your Page » (gérer tout sur votre Page). Rattachez le portefeuille d'entreprise si Meta le demande, puis « Go to dashboard ».") },
      {
        texte: t("Dans le cas d'usage, « Customize » (Personnaliser) : ajoutez les permissions pages_read_engagement et pages_manage_posts (pages_show_list y est déjà), puis « Ready to test »."),
        portees: ["pages_show_list", "pages_read_engagement", "pages_manage_posts"],
        separateur: ",",
      },
      { texte: t("Menu de gauche, « Facebook Login for Business », « Settings » : dans « Valid OAuth Redirect URIs » (URI de redirection OAuth valides), collez l'adresse ci-dessous, puis « Save changes »."), retour: true },
      { texte: t("« App settings » (Paramètres de l'app), « Basic » (Général) : copiez l'« App ID » (ID de l'app) et l'« App secret » (Clé secrète, bouton « Show »), pour les champs ci-dessous.") },
      { texte: t("« App roles » (Rôles de l'app) : la personne qui se connectera doit y avoir un rôle (administrateur, développeur ou testeur), et gérer la Page.") },
    ],
    aEviter: [
      t("Ne passez pas l'app en mode « Live » (en ligne) : en mode développement, Meta accepte une adresse de retour en http sur localhost, et un rôle dans l'app suffit. En ligne, il exige une adresse en https et un examen."),
      t("Ne demandez pas l'examen de l'app : il ne sert que pour des Pages que votre organisation ne gère pas."),
    ],
    erreurs: [
      { code: t("« URL Blocked » (URL bloquée)"), texte: t("L'adresse de retour n'est pas dans « Valid OAuth Redirect URIs », ou pas à l'identique (Meta compare tout), ou l'app est en ligne avec une adresse en http.") },
      { code: t("« App not active » (application non disponible)"), texte: t("L'app est en mode développement et le compte n'y a pas de rôle : ajoutez-le dans « App roles », puis recommencez.") },
      { code: "access_denied · user_denied", texte: t("L'autorisation a été refusée dans la page de Meta : recommencez en acceptant.") },
    ],
    champs: { identifiant: t("« App ID » (ID de l'app), « App settings », « Basic »."), secret: t("« App secret » (Clé secrète), même page, bouton « Show ».") },
  };
}

/**
 * Instagram par la connexion Instagram, lu le 28/09/2026 :
 * https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-instagram-login/business-login
 * (« API setup with Instagram login », « Set up Instagram business login », « OAuth redirect URIs »,
 * « Instagram App ID » : c'est lui le client, pas l'ID de l'app Meta ; barre oblique ajoutée par le tableau de bord),
 * https://developers.facebook.com/documentation/instagram-platform/overview (accès standard : les comptes qui ont un rôle).
 * Le testeur Instagram accepte l'invitation sur instagram.com/accounts/manage_access/ (réponse de Meta sur son forum).
 * https ou non pour l'adresse de retour : la page ne le dit pas (elle ne s'affiche qu'avec JavaScript).
 */
function guideInstagram(): GuideAppli {
  return {
    nom: "Meta",
    consoles: [{ libelle: t("la création d'app Meta"), url: "https://developers.facebook.com/apps/creation/" }],
    etapes: [
      { texte: t("Le compte Instagram doit être professionnel (Entreprise ou Créateur) : cela se règle dans les paramètres de l'application Instagram.") },
      { texte: t("« Create app » : un nom, puis le cas d'usage « Manage messaging & content on Instagram » (gérer les messages et le contenu sur Instagram), puis « Go to dashboard ».") },
      {
        texte: t("« API setup with Instagram login » (configuration de l'API avec la connexion Instagram), étape « Set up Instagram business login » : dans « OAuth redirect URIs », collez l'adresse ci-dessous, puis enregistrez. Meta ajoute parfois une barre oblique à la fin : l'adresse enregistrée doit rester identique."),
        retour: true,
      },
      { texte: t("Même panneau : copiez l'« Instagram App ID » et l'« Instagram App Secret ». Ce ne sont pas l'ID et la clé de l'app Meta."), portees: ["instagram_business_basic", "instagram_business_manage_insights", "instagram_business_content_publish"], separateur: ",", notePortees: t("Les autorisations que la connexion demandera.") },
      {
        texte: t("« App roles », « Roles » : ajoutez le compte comme « Instagram Tester » (testeur Instagram), puis acceptez l'invitation sur instagram.com, « Apps and websites », onglet « Tester invites »."),
        lien: { libelle: t("Ouvrir les invitations de testeur sur Instagram"), url: "https://www.instagram.com/accounts/manage_access/" },
      },
    ],
    aEviter: [t("Ne collez pas l'ID de l'app Meta : Instagram le refuse. C'est l'« Instagram App ID » qu'il faut.")],
    erreurs: [
      { code: "Invalid redirect_uri", texte: t("L'adresse de retour n'est pas enregistrée à l'identique (une barre oblique ajoutée à la fin, par exemple). Si Meta refuse une adresse en http, ouvrez l'instance par son adresse en https.") },
      { code: "access_denied · user_denied", texte: t("L'autorisation a été refusée, ou le compte n'a pas accepté l'invitation de testeur : acceptez-la, puis recommencez.") },
    ],
    champs: { identifiant: t("« Instagram App ID », panneau « API setup with Instagram login »."), secret: t("« Instagram App Secret », même panneau.") },
  };
}

/**
 * TikTok, lu le 28/09/2026 :
 * https://developers.tiktok.com/doc/getting-started-create-an-app (« Manage apps », « Connect an app », « Client key », « Client secret »),
 * https://developers.tiktok.com/doc/login-kit-desktop (« localhost » ou 127.0.0.1 seulement, port joker `*`, exemple `http://127.0.0.1:*\/callback/`),
 * https://developers.tiktok.com/doc/add-a-sandbox (bac à sable, 10 comptes),
 * https://developers.tiktok.com/doc/oauth-user-access-token-management (« Redirect_uri is not matched »).
 */
function guideTiktok(): GuideAppli {
  return {
    nom: "TikTok",
    consoles: [{ libelle: t("vos applications TikTok (TikTok for Developers)"), url: "https://developers.tiktok.com/apps/" }],
    etapes: [
      { texte: t("« Connect an app » : propriétaire, votre organisation ; puis la fiche de l'app (nom, icône, catégorie), plateforme « Desktop ».") },
      { texte: t("« Add products » : « Login Kit ». Dans ses réglages, « Redirect URI » pour Desktop : collez l'adresse ci-dessous, astérisque compris (il vaut pour tout port)."), retour: true },
      { texte: t("Pour publier : ajoutez aussi « Content Posting API », avec « Direct Post ».") },
      { texte: t("« Scopes » : cochez les portées ci-dessous, et video.publish seulement pour publier."), portees: ["user.info.basic", "user.info.stats", "video.list", "video.publish"], separateur: "," },
      { texte: t("En tête de la fiche de l'app : copiez la « Client key » et le « Client secret », pour les champs ci-dessous.") },
      { texte: t("Pour essayer sans examen : « Sandbox », « Create Sandbox », puis « Sandbox settings », « Add account » : votre compte TikTok.") },
    ],
    aEviter: [t("Ne remplacez pas l'astérisque par un numéro de port : le port change à chaque connexion.")],
    erreurs: [
      { code: "Redirect_uri is not matched", texte: t("L'adresse n'est pas déclarée à l'identique dans « Login Kit » : http://127.0.0.1:*/callback/, barre oblique finale comprise.") },
      { code: t("« not eligible for using third-party login »"), texte: t("Le compte n'est pas dans le bac à sable de l'app : « Sandbox settings », « Add account ».") },
    ],
    champs: { identifiant: t("« Client key », en tête de la fiche de l'app."), secret: t("« Client secret », au même endroit.") },
  };
}

/**
 * X, lu le 28/09/2026 :
 * https://docs.x.com/fundamentals/developer-apps (« Create App », identifiants montrés une seule fois, « use http://127.0.0.1 (not localhost) », dix adresses au plus),
 * https://docs.x.com/fundamentals/authentication/oauth-2-0/authorization-code,
 * https://docs.x.com/x-ads-api/mcp (« App Permissions », « Type of app », « Callback URI / Redirect URL », « Website URL », « OAuth 2.0 Client ID »),
 * https://docs.x.com/x-api/getting-started/pricing (crédits).
 */
function guideX(): GuideAppli {
  return {
    nom: "X",
    consoles: [{ libelle: t("la console des développeurs X"), url: "https://console.x.com" }],
    etapes: [
      { texte: t("Connectez-vous avec le compte X de votre organisation, acceptez l'accord des développeurs, puis « Create App » (ou « New App ») : un nom.") },
      { texte: t("Achetez des crédits dans la même console (« Pay-per-use ») : sans crédit, X bloque les appels.") },
      { texte: t("Dans l'application, les réglages d'authentification (« User authentication settings ») : « App permissions », « Read and write » ; « Type of App », « Web App, Automated App or Bot » (avec un secret) ou « Native App » (sans secret).") },
      { texte: t("« Callback URI / Redirect URL » : collez l'adresse ci-dessous, à l'identique (X refuse « localhost » : elle commence donc par 127.0.0.1). « Website URL » : le site de votre organisation. Puis « Save »."), retour: true },
      { texte: t("« Keys and tokens » : copiez l'« OAuth 2.0 Client ID » (pas l'« API Key ») et, pour une « Web App », le « Client Secret ». X ne les montre qu'une fois.") },
    ],
    aEviter: [t("Ne collez pas l'« API Key » ni l'« API Key Secret » : ce sont les clés de l'ancienne connexion (OAuth 1.0a).")],
    erreurs: [
      { code: t("« You weren't able to give access to the App »"), texte: t("L'« OAuth 2.0 Client ID » collé n'est pas le bon, ou OAuth 2.0 n'est pas activé dans les réglages d'authentification.") },
      { code: "client-not-enrolled", texte: t("L'application n'est pas passée à l'usage payant : dans la console, choisissez « Pay-per-use » et l'environnement « Production ».") },
      { code: "402", texte: t("Plus de crédits : achetez-en dans la console, puis reconnectez-vous.") },
    ],
    champs: { identifiant: t("« OAuth 2.0 Client ID », dans « Keys and tokens »."), secret: t("« Client Secret », au même endroit, pour une « Web App » seulement.") },
  };
}

/* ------------------------------------------------------------------ */
/* Serveurs MCP qui veulent une application déclarée                    */
/* ------------------------------------------------------------------ */

/**
 * GitHub, lu le 28/09/2026 :
 * https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/creating-an-oauth-app (champs du formulaire),
 * https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps
 * (depuis le 03/08/2026, correspondance exacte de l'adresse de retour pour une application neuve),
 * https://github.com/github/github-mcp-server/blob/main/docs/host-integration.md (pas d'enregistrement automatique ; organisations qui restreignent les applications),
 * https://docs.github.com/en/apps/oauth-apps/maintaining-oauth-apps/troubleshooting-authorization-request-errors.
 */
function guideGithub(): GuideAppli {
  return {
    nom: "GitHub",
    consoles: [{ libelle: t("la création d'une OAuth App (GitHub)"), url: "https://github.com/settings/applications/new" }],
    etapes: [
      { texte: tf("« Application name » : un nom (par exemple « {0} ») ; « Homepage URL » : le site de votre organisation.", branding.name) },
      { texte: t("« Authorization callback URL » : collez l'adresse ci-dessous, à l'identique. Laissez « Enable Device Flow » décoché, puis « Register application »."), retour: true },
      { texte: t("Sur la page de l'application : copiez le « Client ID », puis « Generate a new client secret » et copiez le secret aussitôt : GitHub ne le remontre plus.") },
      { texte: t("Dépôts d'une organisation qui restreint les applications : un propriétaire de l'organisation l'approuve (« Settings », « Third-party access »).") },
    ],
    aEviter: [t("Ne créez pas une « GitHub App » ici : l'écran attend l'identifiant d'une « OAuth App ».")],
    erreurs: [
      { code: "The redirect_uri MUST match the registered callback URL for this application.", texte: t("L'« Authorization callback URL » n'est pas exactement l'adresse de retour ci-dessus : corrigez-la dans les réglages de l'application.") },
    ],
    champs: { identifiant: t("« Client ID », sur la page de l'OAuth App."), secret: t("Le secret créé par « Generate a new client secret », montré une seule fois.") },
  };
}

/**
 * Asana, serveur MCP V2, lu le 28/09/2026 :
 * https://developers.asana.com/docs/integrating-with-asanas-mcp-server (« Create new app », type « MCP app », « OAuth », « Manage distribution » ; aucune portée),
 * https://developers.asana.com/docs/connecting-mcp-clients-to-asanas-v2-server (correspondance exacte, exemples en http://localhost).
 */
function guideAsana(): GuideAppli {
  return {
    nom: "Asana",
    consoles: [{ libelle: t("vos applications Asana (console des développeurs)"), url: "https://app.asana.com/0/my-apps" }],
    etapes: [
      { texte: t("« Create new app » : un nom, type « MCP app », puis « Create app ». Asana affiche aussitôt le « Client ID » et le « Client secret » : copiez-les.") },
      { texte: t("Menu « OAuth » : « Add redirect URL », collez l'adresse ci-dessous, à l'identique (barre oblique comprise ou non, comme ici)."), retour: true },
      { texte: t("« Manage distribution » : « Specific workspaces », choisissez l'espace de travail de votre organisation, puis « Save changes ».") },
    ],
    aEviter: [t("N'ajoutez pas de portée : une « MCP app » n'en a pas.")],
    erreurs: [
      { code: "This app is not available to your Asana workspace or organization", texte: t("L'espace de travail n'est pas dans « Manage distribution » : ajoutez-le, puis recommencez.") },
      { code: t("« redirect_uri » refusée"), texte: t("L'adresse déclarée dans « OAuth » n'est pas exactement celle ci-dessus.") },
    ],
    champs: { identifiant: t("« Client ID », affiché à la création, puis dans « OAuth »."), secret: t("« Client secret », au même endroit.") },
  };
}

/**
 * Zoom, lu le 28/09/2026 :
 * https://developers.zoom.us/docs/mcp/servers/connect-to-zoom-mcp-servers/ (pas d'enregistrement automatique : une application),
 * https://developers.zoom.us/docs/integrations/create/ (« Develop », « Build app », « General app », « User-managed », « OAuth redirect URL », « OAuth allow lists », « App Credentials »),
 * https://developers.zoom.us/docs/integrations/oauth/ (« Do not use localhost » ; 127.0.0.1 pour un client avec PKCE, port ignoré).
 * `portees` : celles que l'instance demande (natifs/projetsRegles.ts, REGLES_MCP.zoom), lecture puis écriture.
 */
export const PORTEES_ZOOM = {
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
};
function guideZoom(): GuideAppli {
  return {
    nom: "Zoom",
    consoles: [{ libelle: t("la création d'application Zoom (App Marketplace)"), url: "https://marketplace.zoom.us/develop/create" }],
    etapes: [
      { texte: t("Avec un compte Zoom qui a les droits d'administrateur ou de développeur : « Develop », « Build App », « General App », puis « Create » ; gestion « User-managed ».") },
      { texte: t("« Basic Information », « OAuth Information » : collez l'adresse ci-dessous dans « OAuth Redirect URL » et dans « OAuth Allow Lists ». Zoom refuse « localhost » : elle commence donc par 127.0.0.1."), retour: true },
      { texte: t("« Scopes », « Add Scopes » : ajoutez les portées de lecture ci-dessous."), portees: PORTEES_ZOOM.lecture, separateur: " " },
      { texte: t("Pour écrire : ajoutez aussi celles-ci, et cochez l'écriture dans cet écran."), portees: PORTEES_ZOOM.ecriture, separateur: " " },
      { texte: t("« App Credentials » : copiez le « Client ID » et le « Client Secret » (ceux de « Development » suffisent pour votre compte), pour les champs ci-dessous.") },
    ],
    aEviter: [t("N'ajoutez pas de portée d'écriture si l'écriture n'est pas cochée ici : Zoom accorde toutes les portées de l'application, et la connexion serait refusée par prudence.")],
    erreurs: [
      { code: "Invalid redirect", texte: t("L'adresse n'est pas dans « OAuth Redirect URL » et « OAuth Allow Lists », à l'identique. Si Zoom refuse l'adresse en http, ouvrez l'instance par son adresse en https.") },
    ],
    champs: { identifiant: t("« Client ID », rubrique « App Credentials »."), secret: t("« Client Secret », même rubrique.") },
  };
}

/**
 * Box, serveur MCP distant, lu le 28/09/2026 :
 * https://developer.box.com/guides/box-mcp/remote/ (console d'administration, « Integrations », « Box MCP server », « Configure », « Add Integration Credentials », « Redirect URI »),
 * https://developer.box.com/guides/authentication/oauth2/oauth2-setup (http admis pour localhost, tout port).
 */
function guideBox(): GuideAppli {
  return {
    nom: "Box",
    consoles: [
      { libelle: t("la console d'administration Box"), url: "https://app.box.com/master" },
      { libelle: t("le guide de Box"), url: "https://developer.box.com/guides/box-mcp/remote/" },
    ],
    etapes: [
      { texte: t("Avec un compte administrateur Box : console d'administration, « Integrations », cherchez « Box MCP server », puis « Configure ».") },
      { texte: t("« Additional Configuration », « + Add Integration Credentials » : un nom, puis enregistrez. Dépliez l'entrée créée.") },
      { texte: t("« Redirect URI » : collez l'adresse ci-dessous, à l'identique, et enregistrez."), retour: true },
      { texte: t("Copiez le « Client ID » et le « Client Secret » de la même entrée, pour les champs ci-dessous.") },
    ],
    erreurs: [{ code: "redirect URI mismatch", texte: t("L'adresse déclarée dans l'entrée n'est pas exactement celle ci-dessus.") }],
    champs: { identifiant: t("« Client ID », dans l'entrée créée sous « Box MCP server »."), secret: t("« Client Secret », au même endroit.") },
  };
}

/**
 * Le serveur MCP de Slack, lu le 28/09/2026 :
 * https://docs.slack.dev/ai/slack-mcp-server/ (applications internes ou de l'annuaire seulement, jetons d'utilisateur, portées par outil, approbation des administrateurs),
 * https://docs.slack.dev/ai/slack-mcp-server/developing/ (« Agents », « Slack Model Context Protocol (MCP) Server »),
 * https://docs.slack.dev/authentication/installing-with-oauth (« The redirect_uri must use HTTPS »),
 * https://docs.slack.dev/authentication/using-pkce (http://localhost n'est admis qu'avec PKCE, qui fait de
 * l'application un client public, pour de bon ; or le serveur MCP n'annonce que `client_secret_post`).
 * Sur un poste seul, en http, ce branchement n'aboutit donc probablement pas :
 * l'écran le dit, et renvoie à « Slack (par jeton) ».
 */
function guideSlackMcp(): GuideAppli {
  return {
    nom: "Slack",
    introduction: t("Slack exige une adresse de retour en https pour ce serveur. Sur une instance ouverte au réseau (adresse en https), suivez ces étapes. Sur ce poste seul, branchez plutôt « Slack (par jeton) », juste à côté : il ne demande aucune adresse de retour."),
    consoles: [{ libelle: t("la création d'application Slack"), url: "https://api.slack.com/apps?new_app=1" }],
    etapes: [
      { texte: t("« Create New App », « From scratch » : un nom, l'espace de travail de votre organisation, puis « Create App ».") },
      { texte: t("« OAuth & Permissions », « Redirect URLs », « Add New Redirect URL » : collez l'adresse ci-dessous (elle doit commencer par https), puis « Save URLs »."), retour: true },
      {
        texte: t("Même page, « User Token Scopes » : ajoutez les portées des outils voulus, par exemple celles-ci pour chercher et lire."),
        portees: ["search:read.public", "channels:history", "channels:read", "groups:history", "groups:read", "users:read"],
        separateur: ", ",
      },
      { texte: t("Menu « Agents » : activez « Slack Model Context Protocol (MCP) Server ».") },
      { texte: t("« Basic Information », « App Credentials » : copiez le « Client ID » et le « Client Secret », pour les champs ci-dessous.") },
    ],
    aEviter: [
      t("N'activez pas la distribution publique de l'application : Slack ne donne son serveur MCP qu'aux applications internes à l'espace (ou publiées dans son annuaire)."),
      t("N'activez pas PKCE sur cette application : elle deviendrait, pour de bon, un client sans secret."),
    ],
    erreurs: [
      { code: "bad_redirect_uri", texte: t("L'adresse n'est pas dans « Redirect URLs », ou elle est en http : Slack veut une adresse en https. Sur ce poste seul, branchez « Slack (par jeton) ».") },
    ],
    champs: { identifiant: t("« Client ID », « Basic Information », « App Credentials »."), secret: t("« Client Secret », au même endroit.") },
  };
}

/* ------------------------------------------------------------------ */
/* Documents et campagnes                                               */
/* ------------------------------------------------------------------ */

/**
 * Dropbox, lu le 28/09/2026 :
 * https://docs.dropboxapi.com/dropbox-api/docs/get-started/tutorial/app-console (« Create app », « App folder » ou « Full Dropbox », onglets « Permissions » et « Settings », « App key », « App secret », « Redirect URIs »),
 * https://docs.dropboxapi.com/dropbox-api/docs/oauth (correspondance exacte ; PKCE pour une application de bureau),
 * https://docs.dropboxapi.com/dropbox-api/docs/developer-resources/developer-guide (500 comptes en développement, production au 50e).
 * Que http soit admis pour localhost vient des réponses de Dropbox sur son forum.
 */
function guideDropbox(): GuideAppli {
  return {
    nom: "Dropbox",
    consoles: [{ libelle: t("la console des applications Dropbox"), url: "https://www.dropbox.com/developers/apps" }],
    etapes: [
      { texte: t("« Create app » : « Scoped access », puis « App folder » (un seul dossier, dans Applications) ou « Full Dropbox » (tout le Dropbox du compte), un nom, puis « Create app ».") },
      {
        texte: t("Onglet « Permissions » : cochez les permissions ci-dessous (account_info.read l'est déjà), et files.content.write seulement pour envoyer des fichiers. Puis « Submit »."),
        portees: ["account_info.read", "files.metadata.read", "files.content.read", "files.content.write"],
        separateur: " ",
      },
      { texte: t("Onglet « Settings », rubrique « OAuth 2 », « Redirect URIs » : collez l'adresse ci-dessous, puis « Add »."), retour: true },
      { texte: t("Même onglet : copiez l'« App key » et, si vous voulez, l'« App secret » (« Show »). Sans secret, laissez l'option des clients publics (« Allow public clients ») sur « Allow » si la console la propose.") },
    ],
    aEviter: [t("Ne cochez pas d'autre permission : Dropbox l'accorderait, et la connexion serait refusée par prudence.")],
    erreurs: [{ code: "Invalid redirect_uri", texte: t("L'adresse n'est pas dans « Redirect URIs » à l'identique : ajoutez-la dans l'onglet « Settings ».") }],
    champs: { identifiant: t("« App key », onglet « Settings »."), secret: t("« App secret », même onglet, bouton « Show ». Facultatif.") },
  };
}

/**
 * Brevo, lu le 28/09/2026 : https://developers.brevo.com/docs/oauth-quickstart,
 * https://developers.brevo.com/docs/cli-reference et https://github.com/getbrevo/brevo-cli
 * (l'outil en ligne de commande est le seul moyen de créer une application
 * OAuth ; application privée seulement ; Node 20.15 ou plus récent ; http://localhost admis).
 */
function guideBrevo(retour: string): GuideAppli {
  return {
    nom: "Brevo",
    consoles: [{ libelle: t("le guide de Brevo (applications OAuth)"), url: "https://developers.brevo.com/docs/oauth-quickstart" }],
    etapes: [
      { texte: t("Brevo crée ses applications avec son outil en ligne de commande, et avec lui seulement. Dans un terminal (Node.js 20.15 ou plus récent), installez-le, puis connectez-le au compte Brevo de votre organisation :"), commandes: ["npm install -g @getbrevo/cli", "brevo login"] },
      { texte: t("Créez une application privée, réservée à votre organisation, avec l'adresse de retour ci-dessous, à l'identique :"), retour: true, commandes: [`brevo app create --name "${branding.name}" --distribution private --redirect-uri ${retour || "…"}`] },
      {
        texte: t("Dans le fichier app-config.json, « auth.scopes » : les portées ci-dessous (campaigns.email:write seulement pour préparer des brouillons ou envoyer). Puis envoyez la configuration :"),
        portees: ["account:read", "contacts:read", "campaigns.email:read", "campaigns.email:write"],
        separateur: " ",
        commandes: ["brevo app upload"],
      },
      { texte: t("Affichez l'identifiant et le secret, puis collez-les plus bas :"), commandes: ["brevo app credentials --app-id … --reveal-secret"] },
    ],
    aEviter: [t("Ne choisissez pas une distribution publique : Brevo ne la propose pas encore, et une application privée suffit à votre organisation.")],
    champs: { identifiant: t("Le « client_id » affiché par brevo app credentials."), secret: t("Le « client_secret », affiché par la même commande avec --reveal-secret.") },
  };
}

/**
 * Mailchimp, lu le 28/09/2026 : https://mailchimp.com/developer/marketing/guides/access-user-data-oauth-2/
 * (« Registered apps », « Register An App », secret montré une seule fois,
 * correspondance exacte depuis le 11/08/2020, exemple en http://127.0.0.1).
 */
function guideMailchimp(): GuideAppli {
  return {
    nom: "Mailchimp",
    consoles: [{ libelle: t("les applications enregistrées (Mailchimp)"), url: "https://us1.admin.mailchimp.com/account/oauth2/" }],
    etapes: [
      { texte: t("Connecté à votre compte Mailchimp : « Registered apps » (Profil, Extras), puis « Register An App » : un nom, votre entreprise, votre site.") },
      { texte: t("« Redirect URI » : collez l'adresse ci-dessous, à l'identique (Mailchimp compare tout : elle commence par 127.0.0.1, pas par localhost). Puis « Create »."), retour: true },
      { texte: t("En bas de la page : copiez le « Client ID » et le « Client Secret ». Mailchimp ne montre le secret qu'une fois.") },
    ],
    erreurs: [{ code: "invalid redirect_uri", texte: t("L'adresse enregistrée n'est pas exactement celle ci-dessus (localhost et 127.0.0.1 comptent comme deux adresses différentes).") }],
    champs: { identifiant: t("« Client ID », en bas de la page de l'application."), secret: t("« Client Secret », au même endroit, montré une seule fois.") },
  };
}

/* ------------------------------------------------------------------ */
/* Commerce et relation client                                          */
/* ------------------------------------------------------------------ */

/**
 * Salesforce, lu le 28/09/2026 :
 * https://help.salesforce.com/s/articleView?id=005228017&type=1 (depuis Spring '26, plus de « Connected App » neuve : une « External Client App »),
 * https://developer.salesforce.com/docs/platform/sfdx-dev/guide/sfdx-dev-auth-eca.html et
 * https://developer.salesforce.com/docs/platform/hosted-mcp-servers/guide/create-external-client-app.html
 * (« External Client App Manager », « New External Client App », « Enable OAuth », « Callback URL », portées, jusqu'à 30 minutes avant qu'elle serve ; exemples en http://localhost),
 * aide « Configure the External Client App OAuth Settings » (options de sécurité) et
 * « OAuth flow errors » (redirect_uri_mismatch, invalid_client_id…).
 */
function guideSalesforce(): GuideAppli {
  return {
    nom: "Salesforce",
    consoles: [
      { libelle: t("Salesforce (connexion, puis Setup)"), url: "https://login.salesforce.com/" },
      { libelle: t("le guide de Salesforce"), url: "https://developer.salesforce.com/docs/platform/sfdx-dev/guide/sfdx-dev-auth-eca.html" },
    ],
    etapes: [
      { texte: t("Dans Setup (Configuration), cherchez « External Client App Manager », puis « New External Client App » : un nom, une adresse de contact.") },
      { texte: t("« API (Enable OAuth Settings) » : cochez « Enable OAuth ». « Callback URL » : collez l'adresse ci-dessous, à l'identique."), retour: true },
      {
        texte: t("« OAuth Scopes » : « Manage user data via APIs (api) » et « Perform requests at any time (refresh_token, offline_access) »."),
        portees: ["api", "refresh_token"],
        separateur: " ",
      },
      { texte: t("Cochez « Require Proof Key for Code Exchange (PKCE) extension for Supported Authorization Flows ». Vous pouvez décocher « Require Secret for Web Server Flow » : le secret devient alors facultatif ici. Puis « Create ».") },
      { texte: t("Onglet « Settings », « OAuth Settings », « Consumer Key and Secret » : Salesforce envoie un code par e-mail, puis affiche la « Consumer Key » et le « Consumer Secret » avec « Copy ».") },
      { texte: t("Attendez jusqu'à 30 minutes : une application neuve ne sert pas tout de suite.") },
    ],
    aEviter: [t("Ne créez pas de « Connected App » : Salesforce n'en permet plus de nouvelle depuis Spring '26.")],
    erreurs: [
      { code: "redirect_uri_mismatch", texte: t("La « Callback URL » n'est pas exactement l'adresse ci-dessus. Si Salesforce exige https, ouvrez l'instance par son adresse en https.") },
      { code: "invalid_client_id", texte: t("L'application neuve n'est pas encore active (jusqu'à 30 minutes), ou la « Consumer Key » collée n'est pas la bonne.") },
      { code: "invalid_app_access", texte: t("L'utilisateur n'est pas autorisé à se servir de cette application : vérifiez ses règles d'accès dans l'application.") },
    ],
    champs: { identifiant: t("« Consumer Key », bouton « Consumer Key and Secret » de l'onglet « Settings »."), secret: t("« Consumer Secret », au même endroit. Facultatif si « Require Secret for Web Server Flow » est décoché.") },
  };
}

/**
 * Pipedrive, lu le 28/09/2026 : https://pipedrive.readme.io/docs/developer-hub (le Developer Hub
 * n'est ouvert qu'aux comptes « developer sandbox »), https://pipedrive.readme.io/docs/marketplace-registering-a-private-app
 * (« Create private app », « Basic info », « OAuth Callback URL », une seule par application,
 * « OAuth & access scopes », « Change to live », « Share app »),
 * https://pipedrive.readme.io/docs/marketplace-scopes-and-permissions-explanations.
 * Rien d'écrit sur http://localhost ; un fil du forum dit qu'il est refusé : l'écran le dit.
 */
function guidePipedrive(): GuideAppli {
  return {
    nom: "Pipedrive",
    consoles: [
      { libelle: t("le compte développeur Pipedrive (sandbox)"), url: "https://developers.pipedrive.com/" },
      { libelle: t("le Developer Hub"), url: "https://app.pipedrive.com/developer-hub" },
    ],
    etapes: [
      { texte: t("Pipedrive ne crée d'application que depuis un compte « developer sandbox » : ouvrez-en un, gratuitement, sur developers.pipedrive.com.") },
      { texte: t("Dans ce compte : « Settings », « Developer Hub », « Create an app », « Create private app ».") },
      { texte: t("Onglet « Basic info » : un nom, et dans « OAuth Callback URL » l'adresse ci-dessous, à l'identique. Puis « Save »."), retour: true },
      {
        texte: t("Onglet « OAuth & access scopes » : Deals et Contacts en « Read only », ou en « Full access » pour ajouter des notes (cochez alors l'écriture ici). Copiez le « Client ID » et le « Client secret »."),
        portees: ["base", "deals:read", "contacts:read"],
        separateur: " ",
      },
      { texte: t("« Change to live », puis « Share app » : ouvrez le lien d'installation avec votre vrai compte Pipedrive et installez l'application.") },
    ],
    aEviter: [t("Ne choisissez pas « Public app » : le type ne se change plus ensuite, et une application publique passe l'examen de Pipedrive.")],
    erreurs: [
      { code: "Invalid redirect URL", texte: t("La « OAuth Callback URL » n'est pas exactement l'adresse ci-dessus. Pipedrive peut refuser une adresse locale (localhost) : ouvrez alors l'instance par son adresse en https.") },
      { code: "user_denied", texte: t("L'installation a été refusée dans la page de Pipedrive : recommencez en acceptant.") },
    ],
    champs: { identifiant: t("« Client ID », onglet « OAuth & access scopes »."), secret: t("« Client secret », même onglet.") },
  };
}

/**
 * Zendesk, lu le 28/09/2026 : https://support.zendesk.com/hc/en-us/articles/4408845965210
 * (Admin Center, « Apps and integrations », « APIs », « OAuth clients », « Add OAuth client » ;
 * https sauf localhost ou 127.0.0.1 ; secret montré en entier une seule fois),
 * https://developer.zendesk.com/api-reference/ticketing/oauth/grant_type_tokens/ (portées).
 */
function guideZendesk(sousDomaine: string): GuideAppli {
  const sd = /^[a-z0-9][a-z0-9-]{0,62}$/i.test(sousDomaine.replace(/\.zendesk\.com$/i, "")) ? sousDomaine.replace(/\.zendesk\.com$/i, "") : "";
  return {
    nom: "Zendesk",
    consoles: [
      ...(sd ? [{ libelle: tf("le Centre d'administration de {0}", `${sd}.zendesk.com`), url: `https://${sd}.zendesk.com/admin/` }] : []),
      { libelle: t("le guide de Zendesk (clients OAuth)"), url: "https://support.zendesk.com/hc/en-us/articles/4408845965210" },
    ],
    etapes: [
      { texte: t("Admin Center (Centre d'administration) : « Apps and integrations », « APIs », onglet « OAuth clients », « Add OAuth client ».") },
      { texte: t("Un nom ; « Client kind » : « Confidential » ; « Redirect URLs » : collez l'adresse ci-dessous. « Scopes » : ceux ci-dessous (tickets:write seulement pour répondre)."), retour: true, portees: ["tickets:read", "users:read", "tickets:write"], separateur: " " },
      { texte: t("« Save » : Zendesk montre le secret en entier cette fois seulement (ensuite, ses neuf premiers caractères). Il dépasse du cadre : sélectionnez-le entièrement avant de le copier, avec l'« Identifier ».") },
    ],
    erreurs: [
      { code: "invalid_scope", texte: t("Une portée demandée n'est pas dans la liste « Scopes » du client : ajoutez-la.") },
      { code: "redirect_uri", texte: t("L'adresse n'est pas dans « Redirect URLs » à l'identique.") },
    ],
    champs: { identifiant: t("« Identifier », sur la fiche du client OAuth."), secret: t("« Secret », montré en entier une seule fois, à l'enregistrement.") },
  };
}

/**
 * Shopify, lu le 28/09/2026 : https://changelog.shopify.com/posts/legacy-custom-apps-can-t-be-created-after-january-1-2026,
 * https://help.shopify.com/en/manual/apps/install-setup-apps (Dev Dashboard, « Create app », « Release », « Install app »),
 * https://shopify.dev/docs/apps/build/dev-dashboard/get-api-access-tokens (« Settings », « Credentials » ;
 * la boutique doit être dans la même organisation Shopify, sinon `shop_not_permitted`).
 */
function guideShopify(): GuideAppli {
  return {
    nom: "Shopify",
    consoles: [{ libelle: t("le Dev Dashboard de Shopify"), url: "https://dev.shopify.com/dashboard/" }],
    etapes: [
      { texte: t("Avec un compte de la même organisation Shopify que la boutique (droit « Develop apps ») : « Create app », « Start from Dev Dashboard », un nom.") },
      { texte: t("Dans la version de l'application, « Access » : les portées ci-dessous, rien d'autre. Puis « Release »."), portees: ["read_orders", "read_products", "read_inventory"], separateur: "," },
      { texte: t("« Installs », « Install app » : choisissez la boutique, puis « Install ».") },
      { texte: t("« Settings », « Credentials » : copiez le « Client ID » et le « Client secret ».") },
    ],
    aEviter: [t("Ne cherchez plus « Develop apps » dans l'administration de la boutique pour créer l'application : Shopify ne le permet plus depuis le 1er janvier 2026.")],
    erreurs: [{ code: "shop_not_permitted", texte: t("La boutique n'est pas dans la même organisation Shopify que l'application : créez l'application depuis l'organisation de la boutique.") }],
    champs: { identifiant: t("« Client ID », « Settings », « Credentials »."), secret: t("« Client secret », au même endroit.") },
  };
}

/** Stripe, lu le 28/09/2026 : https://docs.stripe.com/keys/restricted-api-keys (« Create restricted key », « Read », valeur montrée une fois). */
function guideStripe(): GuideAppli {
  return {
    nom: "Stripe",
    consoles: [{ libelle: t("les clés API de Stripe"), url: "https://dashboard.stripe.com/apikeys" }],
    etapes: [
      { texte: t("« Create restricted key » (Créer une clé limitée), en partant de zéro, un nom.") },
      { texte: t("« Read » (Lecture) pour Payment Intents, Customers, Invoices et Subscriptions ; « None » (Aucune) partout ailleurs.") },
      { texte: t("« Create key » : Stripe affiche la clé (rk_live_…, ou rk_test_… en mode test) une seule fois. Cliquez dessus pour la copier.") },
    ],
    aEviter: [t("Ne collez pas la clé secrète (sk_…) : elle ouvre tout le compte, et elle est refusée ici.")],
    champs: { identifiant: t("La clé limitée, affichée une seule fois à sa création.") },
  };
}

/** WooCommerce, lu le 28/09/2026 : https://woocommerce.com/document/woocommerce-rest-api/ et l'adresse de création relevée dans son code (class-wc-admin-api-keys.php). */
function guideWoocommerce(adresse: string): GuideAppli {
  let boutique = "";
  try {
    const u = new URL(adresse);
    if (u.protocol === "https:") boutique = `${u.origin}${u.pathname.replace(/\/+$/, "")}`;
  } catch {
    boutique = "";
  }
  return {
    nom: "WooCommerce",
    consoles: boutique
      ? [{ libelle: t("la création de clé REST de votre boutique"), url: `${boutique}/wp-admin/admin.php?page=wc-settings&tab=advanced&section=keys&create-key=1` }]
      : [{ libelle: t("le guide de WooCommerce (API REST)"), url: "https://woocommerce.com/document/woocommerce-rest-api/" }],
    introduction: boutique ? undefined : t("Indiquez d'abord l'adresse de la boutique plus bas : le bouton mènera alors droit à la création de la clé."),
    etapes: [
      { texte: t("Administration WordPress : WooCommerce, « Settings » (Réglages), « Advanced » (Avancé), « REST API », « Add key » (Ajouter une clé).") },
      { texte: t("Une description, l'utilisateur, « Permissions » : « Read » (Lecture). Puis « Generate API key ».") },
      { texte: t("Copiez la « Consumer key » (ck_…) et le « Consumer secret » (cs_…) : WooCommerce ne montre le secret qu'une fois.") },
    ],
    aEviter: [t("Ne donnez pas « Write » ni « Read/Write » : la lecture suffit."), t("Les permaliens de WordPress ne doivent pas être « Plain » (Simple), et la boutique doit répondre en https.")],
    champs: { identifiant: t("« Consumer key » (ck_…)."), secret: t("« Consumer secret » (cs_…), montré une seule fois.") },
  };
}

/* ------------------------------------------------------------------ */
/* Messageries et Slack par jeton                                       */
/* ------------------------------------------------------------------ */

/** Slack par jeton de bot (slack.ts) : l'application se crée d'un clic, manifeste compris (https://docs.slack.dev/app-manifests/configuring-apps-with-app-manifests/, lu le 28/09/2026). */
function guideSlack(manifeste: string): GuideAppli {
  let compact = "";
  try {
    compact = JSON.stringify(JSON.parse(manifeste));
  } catch {
    compact = "";
  }
  return {
    nom: "Slack",
    consoles: [
      compact
        ? { libelle: t("Slack avec le manifeste déjà rempli"), url: `https://api.slack.com/apps?new_app=1&manifest_json=${encodeURIComponent(compact)}` }
        : { libelle: t("la création d'application Slack"), url: "https://api.slack.com/apps?new_app=1" },
    ],
    etapes: [
      { texte: t("Le bouton ouvre la création d'application avec le manifeste ci-dessous déjà rempli : choisissez votre espace de travail, vérifiez, puis « Create ». Sinon : « Create New App », « From a manifest », et collez-le.") },
      { texte: t("« Install App », « Install to Workspace », puis « Allow ». Selon les règles de votre espace, un administrateur Slack devra peut-être approuver.") },
      { texte: t("Même page : copiez le « Bot User OAuth Token » (il commence par xoxb-) et collez-le plus bas.") },
      { texte: t("Dans chaque salon que vos agents doivent lire, invitez le bot (/invite). Il ne lit que ceux-là.") },
    ],
    champs: { identifiant: t("« Bot User OAuth Token », page « Install App » (xoxb-…).") },
  };
}

function guideTelegram(): GuideAppli {
  return {
    nom: "Telegram",
    consoles: [{ libelle: t("@BotFather dans Telegram"), url: "https://t.me/BotFather" }],
    etapes: [
      { texte: t("Dans la conversation avec @BotFather, envoyez /newbot, puis donnez un nom et un identifiant qui finit par « bot ».") },
      { texte: t("BotFather répond avec le jeton du bot (123456789:AA…) : collez-le plus bas.") },
      { texte: t("Ajoutez le bot aux groupes à lire. Par défaut, dans un groupe, il ne voit que les messages qui le mentionnent ou lui répondent ; pour qu'il lise tout, envoyez /setprivacy à BotFather, choisissez « Disable », puis ajoutez-le de nouveau au groupe.") },
    ],
    aEviter: [t("Ne reprenez pas un bot déjà branché sur un agent ou un autre logiciel : Telegram ne donne ses messages qu'à un seul lecteur, et il sera refusé.")],
    champs: { identifiant: t("Le jeton donné par BotFather (123456789:AA…).") },
  };
}

function guideDiscord(): GuideAppli {
  return {
    nom: "Discord",
    consoles: [{ libelle: t("le portail des développeurs Discord"), url: "https://discord.com/developers/applications" }],
    etapes: [
      { texte: t("« New Application » : un nom, puis « Create ».") },
      { texte: t("Page « Bot » : « Reset Token », puis copiez le jeton et collez-le plus bas.") },
      { texte: t("Même page, « Privileged Gateway Intents » : activez « Message Content Intent ». Sans elle, Discord donne des messages vides, sauf ceux qui mentionnent le bot.") },
      { texte: t("Page « OAuth2 », « URL Generator » : cochez « bot », puis les permissions « View Channels », « Read Message History », et « Send Messages » pour envoyer. Ouvrez l'adresse produite et ajoutez le bot à votre serveur.") },
    ],
    champs: { identifiant: t("Le jeton de la page « Bot », après « Reset Token ».") },
  };
}

/**
 * WhatsApp Business, lu le 28/09/2026 :
 * https://developers.facebook.com/documentation/business-messaging/whatsapp/get-started (cas d'usage, « API Setup »),
 * https://developers.facebook.com/documentation/business-messaging/whatsapp/access-tokens (utilisateur système, « Generate token »),
 * https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/create-webhook-endpoint (« Callback URL », « Verify token », https public).
 */
function guideWhatsapp(): GuideAppli {
  return {
    nom: "Meta",
    consoles: [
      { libelle: t("la création d'app Meta"), url: "https://developers.facebook.com/apps/creation/" },
      { libelle: t("les paramètres de l'entreprise (Meta)"), url: "https://business.facebook.com/settings/" },
    ],
    etapes: [
      { texte: t("« Create app » : le cas d'usage « Connect with customers through WhatsApp » (communiquer avec vos clients sur WhatsApp), puis le portefeuille d'entreprise de votre organisation. Reliez-y le compte WhatsApp Business et le numéro de votre organisation.") },
      { texte: t("« API Setup » (Configuration de l'API) : copiez l'identifiant du numéro de téléphone (« Phone number ID », sous le numéro « From ») et l'identifiant du compte WhatsApp Business.") },
      {
        texte: t("Dans les paramètres de l'entreprise, « System users » (Utilisateurs système) : « Add », un nom, rôle « Admin » ; « Assign assets » : l'app, en « Manage app » ; puis « Generate token » avec les autorisations ci-dessous."),
        portees: ["business_management", "whatsapp_business_management", "whatsapp_business_messaging"],
        separateur: ", ",
      },
      { texte: t("« App settings » (Paramètres de l'app), « Basic » (Général) : copiez l'« App secret » (Clé secrète). Il sert à reconnaître les messages que Meta envoie à l'instance.") },
      { texte: t("Une fois connecté : cas d'usage WhatsApp, « Configuration », déclarez l'adresse du webhook et le jeton de vérification que cet écran affichera, puis abonnez-vous au champ « messages ».") },
    ],
    aEviter: [t("Ne collez pas le jeton temporaire de « API Setup » (« Generate access token ») : il expire en quelques heures. C'est le jeton de l'utilisateur système qu'il faut.")],
    champs: { identifiant: t("« Phone number ID » et identifiant du compte, page « API Setup »."), secret: t("Le jeton de l'utilisateur système, et l'« App secret » de l'app.") },
  };
}

/* ------------------------------------------------------------------ */
/* Le catalogue des guides                                              */
/* ------------------------------------------------------------------ */

/** Les services dont la connexion part avec une adresse de retour à déclarer chez le fournisseur. */
export const GUIDES_AVEC_RETOUR = [
  "linkedin",
  // La Page d'entreprise LinkedIn, sa propre application (29/09/2026).
  "linkedinPage",
  "facebook",
  "instagram",
  "tiktok",
  "x",
  "dropbox",
  "brevo",
  "mailchimp",
  "salesforce",
  "pipedrive",
  "zendesk",
  "github",
  "asana",
  "zoom",
  "box",
  "slack-mcp",
] as const;
/** Ceux qui demandent une application, une clé ou un bot, sans adresse de retour. */
export const GUIDES_SANS_RETOUR = ["shopify", "stripe", "woocommerce", "slack", "telegram", "discord", "whatsapp"] as const;
export type IdGuide = (typeof GUIDES_AVEC_RETOUR)[number] | (typeof GUIDES_SANS_RETOUR)[number];

/** Ce que certains guides reprennent de l'écran : l'adresse de retour (Brevo), la boutique (WooCommerce), le sous-domaine (Zendesk), le manifeste (Slack). */
export interface ContexteGuide {
  retour?: string;
  adresse?: string;
  manifeste?: string;
}

const GUIDES: Record<IdGuide, (c: ContexteGuide) => GuideAppli> = {
  linkedin: guideLinkedin,
  linkedinPage: guideLinkedinPage,
  facebook: guideFacebook,
  instagram: guideInstagram,
  tiktok: guideTiktok,
  x: guideX,
  dropbox: guideDropbox,
  brevo: (c) => guideBrevo(c.retour ?? ""),
  mailchimp: guideMailchimp,
  salesforce: guideSalesforce,
  pipedrive: guidePipedrive,
  zendesk: (c) => guideZendesk(c.adresse ?? ""),
  github: guideGithub,
  asana: guideAsana,
  zoom: guideZoom,
  box: guideBox,
  "slack-mcp": guideSlackMcp,
  shopify: guideShopify,
  stripe: guideStripe,
  woocommerce: (c) => guideWoocommerce(c.adresse ?? ""),
  slack: (c) => guideSlack(c.manifeste ?? ""),
  telegram: guideTelegram,
  discord: guideDiscord,
  whatsapp: guideWhatsapp,
};

/* ------------------------------------------------------------------ */
/* Applications ouvertes sur la machine de l'instance                   */
/* ------------------------------------------------------------------ */

/**
 * Palmier Pro (29/09/2026) : rien à créer chez l'éditeur, une application à
 * ouvrir sur la machine de l'instance. Lu le 29/09/2026 : le README de
 * https://github.com/palmier-io/palmier-pro (macOS 26 sur puce Apple, serveur
 * MCP quand l'application est ouverte) et, dans la branche `last-gpl-source`,
 * `MCPService.swift` (le serveur démarre avec l'application, sauf s'il a été
 * coupé dans ses réglages) et `ToolDefinitions.swift` (« sign in to Palmier and
 * subscribe » pour générer). L'application elle-même n'a pas été ouverte.
 */
function guidePalmier(): GuideAppli {
  return {
    nom: "Palmier Pro",
    sansConsole: true,
    introduction: tf("Palmier Pro est un monteur vidéo pour Mac, d'un autre éditeur que {0}. Il doit être installé et ouvert sur la machine de cette instance : {0} parle à l'application ouverte, sans rien installer à votre place.", branding.name),
    consoles: [{ libelle: t("la page de téléchargement de Palmier Pro"), url: "https://github.com/palmier-io/palmier-pro/releases/latest" }],
    etapes: [
      { texte: t("Pas encore installé : téléchargez Palmier Pro sur sa page officielle, puis glissez-le dans le dossier Applications. Il demande macOS 26 (Tahoe) ou plus récent, sur un Mac à puce Apple.") },
      { texte: t("Ouvrez Palmier Pro, puis un projet. Son serveur d'outils démarre avec l'application, sauf s'il a été coupé dans ses réglages.") },
      { texte: tf("Revenez ici et cliquez « Brancher ». {0} vérifie que c'est bien Palmier Pro, signé par son éditeur, qui répond, avant de lui envoyer quoi que ce soit.", branding.name) },
      { texte: t("Pour générer des vidéos, des images ou du son, connectez-vous à votre compte Palmier dans l'application : la génération se fait chez Palmier, avec l'abonnement ou les crédits de ce compte, et chaque demande vous est montrée avant de partir.") },
    ],
    aEviter: [
      t("Ne lancez pas Palmier Pro depuis l'image disque ou le dossier Téléchargements : il doit être dans Applications, sinon il n'est pas reconnu."),
      t("Ne fermez pas Palmier Pro pendant qu'un agent monte : ses outils ne répondent que tant que l'application est ouverte. Rouvert, « Réessayer » le rebranche."),
    ],
  };
}

/**
 * Roblox Studio (12/10/2026) : le serveur MCP est livré avec Studio, il faut
 * seulement l'activer. Lu le 12/10/2026 sur
 * https://create.roblox.com/docs/studio/mcp (chemin « Assistant › … › Manage
 * MCP Servers › Enable Studio as MCP server », témoin vert, `studio_id` pour
 * choisir parmi plusieurs Studio ouverts). Studio lui-même n'a pas été ouvert.
 */
function guideRoblox(): GuideAppli {
  return {
    nom: "Roblox Studio",
    sansConsole: true,
    introduction: tf("Roblox Studio est l'atelier de création de Roblox, d'un autre éditeur que {0}. Il doit être installé et ouvert sur la machine de cette instance (macOS ou Windows) : {0} lance le serveur d'outils livré avec Studio, sans rien télécharger.", branding.name),
    consoles: [
      { libelle: t("la page d'installation de Roblox Studio"), url: "https://create.roblox.com/docs/studio/setup" },
      { libelle: t("la documentation du serveur MCP de Studio"), url: "https://create.roblox.com/docs/studio/mcp" },
    ],
    etapes: [
      { texte: t("Pas encore installé : installez Roblox Studio depuis sa page officielle (sur Mac, dans le dossier Applications), puis connectez-vous à votre compte Roblox.") },
      { texte: t("Ouvrez Roblox Studio et une place. Ouvrez l'Assistant, cliquez « … », puis Manage MCP Servers, et activez « Enable Studio as MCP server ». Un témoin vert confirme qu'il est prêt.") },
      { texte: tf("Revenez ici et cliquez « Brancher ». {0} vérifie l'installation de Studio (sur Mac, la signature de son serveur) avant de le lancer, puis demande à Studio quelles places sont ouvertes.", branding.name) },
      { texte: t("Plusieurs Studio ouverts : vos agents voient la liste et choisissent celui que vous nommez. Lire les scripts et les instances est libre ; modifier un script, exécuter du code, lancer un essai de jeu ou générer demande votre accord à chaque fois.") },
    ],
    aEviter: [
      t("Ne laissez pas un agent travailler sur une place publiée que vous ne voulez pas voir modifiée : ouvrez plutôt une copie."),
      t("Ne fermez pas Roblox Studio pendant qu'un agent travaille : ses outils ne répondent que tant que Studio est ouvert. Rouvert, « Réessayer » le rebranche."),
    ],
  };
}

/**
 * Blender (12/10/2026) : le serveur « MCP for Blender » est posé par
 * l'instance (gateway/src/blender.ts, version et empreintes figées), et son
 * module complémentaire s'installe une fois dans Blender. Lu le 12/10/2026 :
 * README et code de https://github.com/ahujasid/mcp-for-blender à la
 * version 2.1.9 (module « MCP for Blender », rubrique Interface, panneau
 * « MCP for Blender » de la barre latérale de la vue 3D, démarrage automatique
 * du serveur, bibliothèques et générateurs éteints par défaut). Blender
 * lui-même n'a pas été ouvert.
 */
function guideBlender(): GuideAppli {
  return {
    nom: "Blender",
    sansConsole: true,
    introduction: tf("Blender est un logiciel libre de création 3D. {0} lui parle par le module complémentaire « MCP for Blender » (licence MIT), d'un auteur indépendant de la Blender Foundation : {0} pose lui-même son serveur, à une version vérifiée, et vous installez le module une fois dans Blender.", branding.name),
    consoles: [{ libelle: t("la page de téléchargement de Blender"), url: "https://www.blender.org/download/" }],
    etapes: [
      { texte: t("Pas encore installé : installez Blender depuis sa page officielle, puis ouvrez-le.") },
      { texte: tf("Cliquez « Brancher ». La première fois, {0} télécharge le serveur depuis pypi.org (quelques mégaoctets, chaque fichier vérifié par son empreinte) et vous donne le chemin du fichier du module. Si cette machine n'a pas Python 3.10 à 3.14, {0} pose d'abord son propre Python, téléchargé depuis github.com et vérifié par son empreinte (de 25 à 110 Mo environ selon le système).", branding.name) },
      { texte: t("Dans Blender : Édition, Préférences, Modules complémentaires, « Installer depuis le disque », choisissez ce fichier, puis cochez « MCP for Blender ». Le module démarre son serveur avec Blender (panneau « MCP for Blender » de la vue 3D, touche N).") },
      { texte: t("Revenez ici et cliquez « Réessayer » ou « Brancher ». Lire la scène est libre ; exécuter du code, importer et générer demande votre accord à chaque fois.") },
    ],
    aEviter: [
      t("N'allumez les bibliothèques en ligne (Poly Haven, Sketchfab, Poly Pizza) et les générateurs (Hyper3D, Hunyuan3D, Tripo) du module que si vous voulez que les demandes partent chez eux : ils sont éteints par défaut."),
      t("Ne fermez pas Blender pendant qu'un agent travaille : rouvert, « Réessayer » le rebranche."),
      // 16/10/2026 : un module muet (port ouvert, fil principal de Blender occupé) est maintenant dit en quelques secondes.
      t("Blender ouvert mais dit « ne répond pas » : fermez la fenêtre ou la boîte de dialogue ouverte dans Blender, ou attendez la fin d'un rendu. Sinon, dans la vue 3D, touche N, onglet « MCP for Blender », cliquez « Disconnect » puis « Connect to MCP server »."),
      t("Si vous retirez Blender des connecteurs, décochez aussi le module « MCP for Blender » dans Blender : tant qu'il est coché, il garde un port ouvert sur cette machine, sans mot de passe, chaque fois que Blender tourne."),
    ],
  };
}

/**
 * Unreal Engine (16/10/2026) : le serveur MCP officiel d'Epic, dans l'éditeur.
 * Lu le 16/10/2026 sur
 * https://dev.epicgames.com/documentation/unreal-engine/unreal-mcp-in-unreal-editor :
 * plugins « Unreal MCP » et « All Toolsets », redémarrage, « Auto Start
 * Server » (Editor Preferences, General, Model Context Protocol) ou
 * `ModelContextProtocol.StartServer`, port 8000 et chemin /mcp par défaut.
 * L'éditeur lui-même n'a pas été ouvert.
 */
function guideUnreal(): GuideAppli {
  return {
    nom: "Unreal Engine",
    sansConsole: true,
    introduction: tf("Unreal Engine est le moteur de jeu d'Epic Games, d'un autre éditeur que {0}. Depuis la version 5.8, Unreal Editor sert lui-même un serveur MCP, par son plugin « Unreal MCP » (expérimental) : {0} parle à l'éditeur ouvert sur la machine de cette instance, sans rien installer à votre place.", branding.name),
    consoles: [
      { libelle: t("la page de téléchargement d'Unreal Engine"), url: "https://www.unrealengine.com/download" },
      { libelle: t("la documentation du serveur MCP d'Unreal Editor"), url: "https://dev.epicgames.com/documentation/unreal-engine/unreal-mcp-in-unreal-editor" },
    ],
    etapes: [
      { texte: t("Pas encore installé : installez Unreal Engine 5.8 ou plus récent depuis sa page officielle, puis ouvrez votre projet dans Unreal Editor.") },
      { texte: t("Dans Unreal Editor : Edit, Plugins, cherchez et activez « Unreal MCP » et « All Toolsets » (c'est lui qui apporte les outils), puis redémarrez l'éditeur quand il le demande.") },
      { texte: t("Démarrez le serveur : Edit, Editor Preferences, General, Model Context Protocol, cochez « Auto Start Server ». Ou tapez ModelContextProtocol.StartServer dans la console de l'éditeur. Gardez le port 8000 et le chemin /mcp proposés.") },
      { texte: tf("Revenez ici et cliquez « Brancher ». {0} vérifie que c'est bien Unreal Editor qui répond sur ce port avant de lui envoyer quoi que ce soit. Lister les jeux d'outils est libre ; chaque action de l'éditeur demande votre accord, une à la fois.", branding.name) },
    ],
    aEviter: [
      t("Le port 8000 sert aussi à bien des serveurs de développement : si un autre programme le tient, l'éditeur ne peut pas l'ouvrir. Fermez ce programme avant d'ouvrir Unreal Editor."),
      t("Le serveur de l'éditeur n'a pas de mot de passe : ne l'ouvrez pas au réseau, laissez-le sur cette machine."),
      t("Travaillez sur une copie d'un projet important : le plugin est encore expérimental chez Epic."),
    ],
  };
}

/** Le pas à pas d'une application ouverte sur la machine de l'instance (`local` ou `lanceur` au catalogue), ou `null`. */
export function guideApplicationLocale(id: string): GuideAppli | null {
  if(id === "rea")return{nom:"REA",sansConsole:true,introduction:t("REA est un outil local d'analyse de logiciels. Son installation se prépare ici, sans modifier les réglages de vos autres agents."),consoles:[{libelle:t("la documentation officielle de REA"),url:"https://github.com/morluto/rea"}],etapes:[{texte:t("Cliquez « Brancher ». Le moteur Node privé, REA et ses dépendances verrouillées sont installés au premier branchement.")},{texte:t("Dans Code, ouvrez votre projet local et demandez une analyse avec REA. L'agent cherche l'outil utile et vous présente l'action à valider.")},{texte:t("L'analyse JavaScript accepte un dossier d'application ou une archive .asar. Les outils natifs peuvent demander un moteur externe déjà installé.")}],aEviter:[t("Frida et les moteurs externes ne sont pas installés automatiquement. Les analyses REA sont réservées à l'administrateur et s'exécutent sur la machine de l'instance.")]};
  if (id === "palmier") return guidePalmier();
  if (id === "roblox") return guideRoblox();
  if (id === "blender") return guideBlender();
  if (id === "unreal") return guideUnreal();
  return null;
}

/** Le guide d'un service, ou `null` s'il n'en a pas (il se branche d'un clic, ou par un simple jeton). */
export function guideApplication(id: string, contexte: ContexteGuide = {}): GuideAppli | null {
  return (GUIDES as Record<string, (c: ContexteGuide) => GuideAppli>)[id]?.(contexte) ?? null;
}
