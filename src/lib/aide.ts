import { branding, features } from "@/config/branding";
import { t, tf } from "@/lib/i18n";

/**
 * Aide intégrée.
 *
 * Elle est **dans l'application**, pas sur un site : une plateforme souveraine
 * qui n'a pas besoin d'Internet pour fonctionner ne doit pas en avoir besoin
 * pour s'expliquer. Les articles sont du texte, écrits ici, et suivent la
 * version livrée ; un module désactivé n'a pas d'article.
 *
 * Règle de rédaction : décrire ce que le logiciel fait **vraiment**, y compris
 * ses limites. Une aide qui promet plus que le produit fait perdre plus de
 * temps qu'elle n'en fait gagner.
 */

export interface Article {
  id: string;
  titre: string;
  /** Une phrase, affichée dans la liste. */
  resume: string;
  /** Corps de l'article : paragraphes et listes à puces (« - » en début de ligne). */
  corps: string;
  /** Mots que quelqu'un taperait pour trouver cet article. */
  motsCles: string[];
  /** Écran concerné, ouvert depuis l'article. */
  lien?: string;
  /** Article retenu seulement si son module est livré. */
  module?: keyof typeof features;
}

const ARTICLES: Article[] = [
  {
    id: "demarrer",
    titre: t("Premiers pas"),
    resume: tf("Ce que {0} fait, et par où commencer.", branding.name),
    motsCles: ["debut", "commencer", "accueil", "decouvrir", "premier"],
    lien: "/",
    corps: tf("{0} fait tourner des modèles d'IA sur votre matériel ou sur l'instance de votre organisation. Rien ne part vers un service tiers tant que vous n'avez pas branché vous-même une clé chez un fournisseur.\n\nPour commencer :\n- ouvrez un Chat et posez votre question ; le modèle utilisé est indiqué sous le champ de saisie, avec son pays d'hébergement ;\n- déposez un document dans Fichiers pour que les agents puissent s'y référer ;\n- choisissez le niveau d'accord dans la barre du bas de Cowork ou de Code, à côté du « + » : c'est lui qui décide de ce qu'un agent peut faire sans vous demander.\n\nTout ce que vous écrivez reste sur votre poste et sur votre instance. Fermer l'application n'efface rien.", branding.name),
  },
  {
    id: "chats",
    titre: t("Chats : renommer, archiver, supprimer, partager"),
    resume: t("Ranger vos conversations sans rien perdre."),
    motsCles: ["chat", "conversation", "archive", "archiver", "supprimer", "partager", "ranger", "renommer", "nom", "titre", "file", "attente", "file d'attente", "pendant une reponse"],
    lien: "/",
    corps: t("Chaque chat de la barre latérale porte quatre actions, visibles au survol.\n\n- Renommer (ou un double clic sur son nom) : le nom se change sur place, Entrée le garde, Échap l'annule. Le chat ne remonte pas en tête de liste pour autant.\n- Partager : vous invitez une personne par son adresse. Elle voit la conversation, elle ne peut pas la ranger à votre place.\n- Archiver : le chat quitte la liste et se retrouve sous « Archivés », en bas. Rien n'est effacé, et un clic le remet en place. L'archivage est personnel : archiver un chat partagé ne le retire pas de la liste des autres.\n- Supprimer : les messages sont effacés pour de bon. Il n'y a pas de corbeille ; archivez plutôt si vous hésitez.\n\nUn chat peut aussi être rangé dans un Projet, depuis le champ de saisie. Ce classement ne partage rien : il ne fait qu'ordonner votre propre écran.\n\nPendant qu'une réponse s'écrit, vous pouvez déjà écrire la suite : Entrée, ou le bouton d'envoi (qui dit alors « Mettre en file »), la met dans la file d'attente du Chat, au-dessus du champ de saisie, sans couper la réponse. Chaque message en attente se modifie ou se retire, jusqu'à dix par Chat, et ils partent l'un après l'autre avec les pièces jointes et les choix du moment où vous les avez écrits. Si la réponse échoue ou si vous l'arrêtez, la file se met en pause : « Envoyer maintenant » la relance. La file reste sur ce poste et se perd si la page est rechargée ou l'application fermée."),
  },
  {
    // L'attente et la réflexion, dites sur toutes les plateformes (29/09/2026, ARCHITECTURE.md ADR-073).
    id: "attente-modele",
    titre: t("Pendant que le modèle travaille"),
    resume: t("Ce que le Chat affiche avant la réponse, et combien de temps ça peut prendre."),
    motsCles: ["attente", "lent", "long", "réflexion", "reflexion", "réfléchit", "temps", "curseur", "rien ne se passe", "windows", "linux", "processeur"],
    lien: "/",
    corps: t("Avant d'écrire, le modèle peut prendre du temps, surtout sur un ordinateur sans carte graphique : plus d'une minute n'a rien d'anormal. Le Chat dit ce qui se passe, avec le temps écoulé et le nom du modèle : « … organise le travail », puis « … lit la demande », puis « Réflexion en cours » quand le modèle réfléchit. Cliquez sur la réflexion pour la lire ; sa durée reste affichée une fois la réponse écrite.\n\nVous pouvez envoyer un autre message pendant ce temps : il attend son tour dans la file, au-dessus de la zone de saisie."),
  },
  {
    id: "documents-joints",
    titre: t("Joindre un document au Chat"),
    resume: t("Ce que le modèle lit d'un fichier joint, et ce qu'il ne lit pas."),
    motsCles: ["joindre", "piece jointe", "document", "fichier", "pdf", "word", "excel", "csv", "lire", "resumer", "long"],
    lien: "/",
    corps: t("Le « + » de la zone de saisie, ou un fichier glissé sur la fenêtre, joint un document à votre message. Le texte est lu sur votre poste, puis envoyé avec la question au modèle choisi, quel qu'il soit.\n\n- Formats lus : texte (y compris un CSV d'Excel ou un fichier du Bloc-notes), PDF, Word, Excel, PowerPoint, OpenDocument, et les images pour un modèle qui sait les voir.\n- Le message attend : « Lecture de … » s'affiche, et rien ne part avant que les fichiers soient lus.\n- Dans le message, une carte par fichier dit son nom, son poids et « lu en entier » ou « début seulement » (environ 200 000 caractères, 300 pages d'un PDF ou 5 000 lignes d'un tableur).\n- Un document trop long pour la mémoire du modèle est lu en parties : la réponse le dit en tête (« lu en 5 parties… ») et s'appuie sur les notes prises sur chacune. Au-delà de 24 parties, la suite n'est pas lue, et c'est dit aussi.\n- La question suivante garde le document tant que le Chat reste ouvert : « et la page 3 ? » fonctionne. Un Chat rouvert plus tard n'a plus le texte du fichier : joignez-le de nouveau.\n\nNe se lisent pas, et l'écran le dit : un PDF scanné (des images de pages), un PDF protégé par un mot de passe, les anciens formats .doc, .xls et .ppt (enregistrez-les au format actuel), une photo HEIC d'iPhone (convertissez-la en JPEG).\n\nPour un long document auquel vous reviendrez souvent, déposez-le plutôt dans Fichiers : il y est lu par passages, et les agents peuvent s'y référer."),
  },
  {
    id: "recherche-web",
    titre: t("Rechercher sur le web depuis le Chat"),
    resume: t("Ce qui part vers le moteur de recherche, et quand."),
    motsCles: ["web", "internet", "recherche", "chercher", "duckduckgo", "source", "sources", "lien", "actualite", "page"],
    lien: "/",
    corps: t("Dans le Chat, le « + » de la zone de saisie propose « Rechercher sur le web ». Une fois choisie, la recherche reste active, montrée par la puce « Web · DuckDuckGo » à côté du « + » ; la croix de la puce l'arrête.\n\nTant qu'elle est active :\n- votre question, ou les mots que le modèle en tire, part à DuckDuckGo, sans compte ;\n- votre instance ouvre ensuite les pages trouvées et en donne le texte au modèle. Elle ne lit que des adresses déjà vues (écrites par vous, trouvées par la recherche ou dans une page déjà lue), jamais une adresse inventée, ni une machine du réseau de l'entreprise ;\n- sous la réponse, « Sources du web » donne les pages citées, avec leur lien ; les autres résultats consultés restent repliés.\n\nSans la puce, rien ne part vers le web.\n\nUne page lue est donnée au modèle comme une donnée, jamais comme une consigne, et un appel d'outil qu'elle dicterait n'est pas lancé. Un modèle peut tout de même se laisser influencer par ce qu'il lit : relisez une réponse fondée sur le web comme vous reliriez la page elle-même.\n\nAvec un petit modèle, ou un modèle qui ne sait pas se servir d'outils, votre instance fait la recherche avant la réponse, à partir de votre question, et la lui donne toute prête.\n\nSi l'entrée est grisée, l'administrateur de l'instance a désactivé la recherche sur le web : le menu le dit."),
  },
  {
    id: "modeles",
    titre: t("Choisir un modèle"),
    resume: t("Local, instance, ou fournisseur avec votre clé."),
    motsCles: ["modele", "llm", "local", "cloud", "cle", "api", "pays", "souverain"],
    lien: "/parametres/modeles",
    corps: t("Trois origines, toujours affichées telles quelles :\n\n- local : le modèle tourne sur votre machine. Rien ne sort du poste. C'est le plus lent sur une grosse demande, et le plus sûr.\n- instance : le modèle tourne sur le serveur de votre organisation.\n- clé : vous avez branché votre propre compte chez un fournisseur. La demande part chez lui, et le pays d'hébergement est indiqué à côté du nom.\n\nAucun modèle distant n'est choisi à votre place. Si vous n'avez branché aucune clé, rien ne quitte votre installation.\n\nUn modèle de la machine passe un court essai sur ce poste, quand il est installé ou chargé pour la première fois. S'il répond mal ici (texte illisible, réponse qui tourne en boucle), il n'est plus choisi d'office, ni en « Auto » : le sélecteur le marque « répond mal sur cette machine », et vous pouvez toujours le prendre à la main.\n\n« Comparer intelligence et prix », en bas du sélecteur, place vos modèles selon la note publiée par Epoch AI (sous licence ouverte) et le prix publié par leur éditeur. Un modèle qu'Epoch AI ne note pas est listé à part, « pas de note publiée » : rien n'invente sa note.\n\nSous chaque réponse, le Chat indique combien de temps elle a pris, le temps avant le premier mot et, quand le modèle a réfléchi, la durée de sa réflexion."),
  },
  {
    // La page « Modèles » (28/09/2026) : tout le catalogue libre, seulement ce qui tient sur la machine.
    id: "catalogue-modeles",
    titre: t("Installer d'autres modèles"),
    resume: t("Tous les modèles libres, plus petits ou plus grands, qui tiennent sur la machine."),
    motsCles: ["modele", "installer", "telecharger", "catalogue", "petit", "leger", "mistral", "qwen", "phi", "granite", "deepseek", "lm studio"],
    lien: "/modeles",
    corps: t("Le sélecteur de modèles du Chat propose une courte liste, adaptée à la machine. Pour choisir parmi tous les modèles libres (licences Apache 2.0 ou MIT) : sélecteur de modèles, « Installer un modèle sur cette machine », puis « Voir tous les modèles ».\n\nLa page « Modèles » :\n- recherche par nom, éditeur ou pays ;\n- tri par note (Epoch AI) ou par taille ;\n- filtres : éditeur, lit les images, raisonne, rapide sans carte graphique ;\n- pour chaque modèle : éditeur et pays, licence, taille du téléchargement, note ou « sans note publiée », capacités.\n\nSeuls les modèles que cette machine fait tourner sans ralentir s'installent. Les plus lourds restent visibles, grisés, avec la raison : la mémoire qu'ils demandent, et celle de la machine. Un modèle plus léger répond plus vite, avec des réponses plus simples.\n\nUne installation à la fois : le téléchargement se suit sur la page, puis le modèle apparaît dans le sélecteur. Le modèle posé à la mise en route reste celui qui est conseillé pour la machine ; l'écran de mise en route propose aussi les autres, par « Choisir un autre modèle »."),
  },
  {
    id: "modeles-locaux",
    titre: t("Où sont rangés les modèles locaux"),
    resume: t("Mettre le moteur et les modèles sur un autre disque."),
    motsCles: ["disque", "place", "espace", "emplacement", "dossier", "stockage", "lm studio", "llama", "deplacer", "d:"],
    lien: "/parametres/modeles-locaux",
    corps: tf("Un modèle pèse de 2 à 18 Go. Si le disque principal n'a pas la place, choisissez-en un autre, par exemple D: sous Windows ou un disque externe sur Mac.\n\n- Avant l'installation : l'écran de mise en route montre où iront le moteur et les modèles, la place libre sur ce disque et la place nécessaire. « Changer » ouvre le choix d'un dossier. Les modèles iront alors sur ce disque, et le moteur aussi avec LM Studio, dans un sous-dossier « LM Studio » (« modeles-llamacpp » sur un Mac Intel).\n- Après l'installation : Réglages, Modèles locaux. Sur un Mac Intel, {0} déplace lui-même les modèles, et n'efface les originaux qu'une fois la copie vérifiée. Avec LM Studio déjà installé, {0} ne déplace pas son dossier pendant qu'il tourne : la page donne la marche à suivre.\n\nLe dossier choisi doit être sur un disque de cette machine (pas un partage réseau), hors de votre dossier personnel et de l'espace de travail des agents. Seul l'administrateur de l'instance le change.", branding.name),
  },
  {
    id: "usage",
    titre: t("Mon usage : ce que coûtent vos modèles"),
    resume: t("Jetons consommés, prix publié et coût estimé."),
    motsCles: ["usage", "cout", "prix", "tarif", "facture", "jetons", "consommation", "estime", "publie"],
    lien: "/parametres/usage",
    corps: t("Réglages, Mon usage montre ce que vous avez consommé : requêtes, jetons envoyés et reçus, par jour et par modèle. Chacun ne voit que sa propre consommation.\n\nLe coût, modèle par modèle :\n- Gratuit : le modèle tourne sur votre machine, aucun frais d'API.\n- Prix publié : vous n'avez pas saisi de tarif, alors le prix affiché par le fournisseur sur sa page de prix s'applique. L'écran nomme le fournisseur, donne la date du relevé et le lien vers sa page. Ce prix a pu changer depuis.\n- Tarif saisi : le prix que vous avez renseigné plus bas, pour un modèle. Il l'emporte toujours sur le prix publié.\n- Tarif non renseigné : aucun prix connu. Son coût n'est pas compté, jamais compté à zéro : renseignez-le pour le voir.\n\n« Estimé » veut dire que le montant n'est pas celui de votre facture. Avec un prix publié, c'est toujours le cas : le tarif standard est appliqué, sans le cache, les lots ni les paliers gratuits de votre contrat. Avec un tarif saisi, seulement quand le moteur n'a pas rapporté ses jetons et qu'ils ont été comptés d'après la longueur des échanges.\n\nLes devises ne sont pas converties : un total en dollars et en euros s'affiche en deux montants."),
  },
  {
    id: "accords",
    titre: t("Accords : ce qu'un agent peut faire seul"),
    resume: t("Le garde-fou entre le modèle et vos fichiers, vos mails, votre écran."),
    motsCles: ["accord", "approbation", "permission", "securite", "autonomie", "garde-fou"],
    lien: "/cowork",
    corps: t("Trois niveaux, choisis dans la barre du bas de la zone de saisie (Cowork et Code), à côté du « + » :\n\n- Demander pour tout : rien ne se fait sans un clic de votre part, lectures comprises.\n- Demander avant de modifier : lire est libre ; écrire, déplacer, supprimer et envoyer demandent votre accord. C'est le réglage par défaut.\n- Tout approuver : l'agent travaille sans vous interrompre. Un texte piégé qu'il lit (mail, page web, document) peut alors le faire agir sans que vous le voyiez : à ce niveau, ce risque est accepté.\n\nLe niveau vaut pour toute l'instance : seul son administrateur le change. Sur une instance d'une seule personne, c'est vous.\n\nToujours confirmés, à tout niveau :\n- envoyer un mail, sauf si l'administrateur a activé « Envoyer sans me demander » ;\n- supprimer un événement d'agenda ;\n- programmer une tâche qui tournera seule.\nUn agent déclenché par un mail reçu ne fait jamais rien qui modifie sans vous le montrer.\n\nLa carte dit ce qui va se passer : pour un fichier, où ; pour un connecteur, un événement ou une tâche, ce que l'outil recevra exactement ; pour une commande de Code, la commande entière. Chaque action figure ensuite dans le journal."),
  },
  {
    id: "code",
    titre: t("Code : OpenCode ou Codex"),
    resume: t("Faire écrire du code dans un dossier, et brancher Codex."),
    motsCles: ["code", "programmer", "developper", "opencode", "codex", "chatgpt", "openai", "session", "projet"],
    lien: "/code",
    module: "code",
    corps: tf("L'écran Code confie un travail sur un dossier de projet à un agent de code. Choisissez le dossier sur la ligne au-dessus de la saisie, puis écrivez votre demande. Le panneau de suivi, à droite, montre ce que fait l'agent : fichiers lus et écrits, commandes, tâches.\n\n- Le travail continue quand vous quittez la session : ouvrir une autre session, un Chat ou une autre page n'arrête rien. Dans la barre latérale, une roue marque une session qui travaille encore ; rouverte, elle reprend là où elle en est. Seul « Arrêter » arrête l'agent.\n- Par défaut, le moteur est OpenCode, avec les modèles de {0} : chaque action passe par votre niveau d'approbation.\n\nCodex, avec votre compte ChatGPT. Sur votre propre poste (application de bureau, instance qui n'est pas ouverte aux collègues, compte administrateur), la puce « OpenCode » de la ligne du dossier propose aussi « Codex (votre compte ChatGPT) ». Pour le brancher :\n- installez Codex, le logiciel d'OpenAI : {0} ne l'installe pas pour vous, et donne la commande officielle à copier ;\n- choisissez « Se connecter avec ChatGPT » : la connexion se termine dans votre navigateur, chez OpenAI. {0} ne voit passer ni votre mot de passe ni aucun jeton ;\n- une fois connecté, choisissez « Codex » dans la même puce.\n\nCe qu'il faut savoir avant de s'en servir :\n- votre demande et les fichiers du projet que Codex lit partent chez OpenAI (États-Unis), dans les limites de votre abonnement ;\n- Codex ne passe pas par les approbations de {0} : seul son bac à sable le borne. Au niveau « Tout approuver », il modifie les fichiers du projet et lance des commandes, sans réseau pour ces commandes ; à « Demander avant de modifier », il travaille en lecture seule ; à « Demander pour tout », il n'est pas proposé ;\n- Codex choisit lui-même son modèle ;\n- ses sessions ne vont pas dans la liste de la barre latérale, et quitter l'écran Code arrête une tâche de Codex en cours.\n\nUn collègue, un poste rattaché à une instance ou une instance partagée ne voient pas Codex : un abonnement ChatGPT ne sert qu'à la personne qui l'a.", branding.name),
  },
  {
    // RTK dans Helix Code (28/09/2026, gateway/src/rtk.ts).
    id: "code-rtk",
    titre: t("Code : moins de jetons avec RTK"),
    resume: t("Raccourcir la sortie des commandes de l'agent avant qu'elle parte au modèle."),
    motsCles: ["rtk", "jetons", "tokens", "economie", "cout", "commandes", "sortie", "code"],
    lien: "/code",
    module: "code",
    corps: t("Quand l'agent de code lance une commande (git status, ls, grep, les tests), sa sortie part au modèle, et chaque ligne compte en jetons. RTK, un outil libre installé avec l'agent de code, la raccourcit d'abord : lignes vides, textes d'aide et listes longues en moins.\n\n- Avec un modèle cloud, RTK sert d'office : moins de jetons facturés par le fournisseur.\n- La puce « RTK », sur la ligne du dossier, propose aussi « Toujours », pour les modèles de cette machine (les petits modèles ont peu de place), et « Jamais ».\n- Sous la saisie, « RTK : N jetons économisés sur cette session » dit ce que RTK a mesuré sur cette machine. Rien n'est envoyé nulle part.\n\nCe qui ne change pas : la carte d'accord montre et juge la commande telle que l'agent l'a écrite, votre niveau d'approbation s'applique comme avant, et une commande que RTK ne connaît pas passe telle quelle. Si RTK manque, les commandes partent sans lui.\n\nCe que le modèle lit change un peu : par exemple, git log n'y montre que les dix derniers commits, un par ligne. Choisissez « Jamais » si un modèle s'y perd. Sous Windows et avec Codex, les commandes partent sans RTK."),
  },
  {
    // Cowork (29/09/2026) : src/pages/CoworkPage.tsx, src/components/cowork/, gateway/src/atelier.ts, zonesProtegees.ts.
    id: "cowork",
    titre: t("Cowork : faire travailler un agent sur vos fichiers"),
    resume: t("Un dossier, une demande, et l'agent lit, range, rédige et produit vos documents."),
    motsCles: ["cowork", "session", "sessions", "dossier", "fichiers", "document", "word", "excel", "powerpoint", "pdf", "atelier", "libreoffice", "poste", "tout mon poste"],
    lien: "/cowork",
    module: "cowork",
    corps: t("Cowork confie un travail sur vos fichiers à un agent : trier, résumer, rédiger, produire un document Word, Excel, PowerPoint ou PDF. Écrivez la demande dans le champ de saisie ; le niveau d'accord, à côté du « + », décide de ce qu'il fait sans vous demander.\n\n- Le dossier : la pastille du dossier, dans la barre du bas, choisit où l'agent lit et écrit, et nulle part ailleurs. « Travailler ici » le retient ; dans l'application de bureau, « Parcourir mon ordinateur... » ouvre la fenêtre du système. Sur une instance partagée, seul l'administrateur change ce dossier, avec son mot de passe.\n- « Tout mon poste » ouvre d'un coup votre dossier personnel et les disques branchés. Réservé à l'administrateur, avec son mot de passe. Restent fermés : les dossiers du système, les données de l'instance, les clés et identifiants (.ssh, .aws, .gnupg), les réglages des logiciels (.config), les historiques d'autres assistants et les trousseaux.\n- Le panneau de droite suit le travail : fichiers lus, modifiés et ajoutés, outils disponibles, procédures (voir « Apprendre vos manières de faire »), connecteurs, et « Préparer Cowork ».\n- « Préparer Cowork » installe une fois l'atelier bureautique : des bibliothèques Python et Node, environ 320 Mo, à des versions figées et vérifiées. L'écran les liste et attend votre confirmation avant de télécharger. LibreOffice est facultatif et ne s'installe pas par ce bouton. Sans atelier, l'agent le dit et propose un fichier texte à la place.\n- Pour que l'agent se serve d'un navigateur ou de LibreOffice à l'écran, activez d'abord le contrôle de l'écran (voir « Contrôle de l'écran : laisser l'agent cliquer »). Sur la machine de l'agent, son travail s'affiche en direct dans le panneau.\n\nChaque modification passe par une carte d'accord, selon votre niveau. « Autoriser » vaut aussi pour les modifications suivantes dans ce dossier, jusqu'à la fin de la demande. Sans réponse, l'action n'est pas faite ; « Arrêter » refuse tout ce qui attend encore.") +
      // Sessions de Cowork (04/10/2026) : store/sessions.ts (`surface`), CoworkPage, Sidebar (`SessionList`).
      "\n\n" +
      t("Chaque demande ouvre une session de Cowork, rangée dans la barre de gauche quand vous êtes dans Cowork, la plus récente en haut, à part des Chats. Un clic la rouvre avec sa conversation et ses bases de connaissances ; revenir dans Cowork après un passage au Chat rouvre la dernière. Si elle travaillait dans un autre dossier, l'écran le dit et propose « Reprendre ce dossier ». « Nouvelle session » repart à neuf ; une session se renomme, s'archive ou se supprime comme un Chat."),
  },
  {
    // Extension VS Code 0.2.5 (29/09/2026) : extensions/vscode/, paquet .vsix joint à chaque version publiée (branding.urls.releases).
    id: "vscode",
    titre: t("L'extension VS Code"),
    resume: t("Le Chat et l'agent de code de votre instance, dans VS Code : où la trouver, comment l'installer."),
    motsCles: ["vs code", "vscode", "visual studio code", "extension", "vsix", "editeur", "inserer", "selection", "code"],
    corps: tf("L'extension {0} pour VS Code met le Chat de votre instance dans la barre latérale de VS Code, avec vos modèles et vos règles. Elle ne parle à aucun autre service.\n\nPour l'installer :\n- téléchargez son fichier .vsix, joint à chaque version publiée : {1} ;\n- dans VS Code, ouvrez la vue Extensions, puis le menu « … » en haut de la vue, « Install from VSIX… », et choisissez le fichier. Une version plus récente s'installe de la même façon, par-dessus.\n\nCe qu'elle fait :\n- l'icône {0} ouvre deux onglets, Chat et Code. « Joindre le fichier ouvert » envoie le fichier en cours avec la question ;\n- clic droit sur du code sélectionné : expliquer la sélection, ou l'améliorer ;\n- chaque bloc de code d'une réponse porte, au-dessus, un bouton « Insérer » : il remplace la sélection, ou s'insère au curseur ;\n- pendant que le modèle réfléchit, la vue dit depuis combien de secondes ;\n- l'onglet Code fait travailler l'agent de code sur le dossier ouvert, avec vos cartes d'accord (« Autoriser » ou « Refuser »). Il faut d'abord la commande « {0} : se connecter (pour {0} Code) » : votre compte, votre mot de passe, et votre code si la double authentification est active. La séance est gardée dans le coffre de VS Code.\n\nSes réglages : l'adresse de l'instance (par défaut l'application de cet ordinateur ; ailleurs, en https seulement), le jeton (vide, il est lu sur cet ordinateur ; pour une instance d'entreprise, celui que donne l'administrateur) et le modèle (vide : Auto). L'onglet Code ne travaille qu'avec l'instance de cet ordinateur. L'extension ne s'active que dans un espace de travail de confiance.", branding.name, branding.urls.releases),
  },
  {
    // Ligne de commande (29/09/2026) : cli/helix.mjs, cli/textes.mjs (T.aide), src/components/settings/LigneDeCommande.tsx.
    id: "ligne-de-commande",
    titre: t("La ligne de commande"),
    resume: t("Le Chat et l'agent de code dans un terminal, avec la commande helix."),
    motsCles: ["terminal", "ligne de commande", "cli", "helix", "commande", "shell", "console"],
    lien: "/parametres/apps",
    corps: t("La commande helix fait parler un terminal à votre instance, comme l'interface : mêmes modèles, mêmes outils, même barrière d'accord, même journal.\n\nPour la mettre en place : Réglages, Installer les apps, onglet CLI, « Mettre en place », depuis l'application de bureau, sur Mac, sous Windows, ou sous Linux avec le paquet .deb (pas avec l'AppImage : l'onglet le dit). Sur Mac et sous Linux, le lanceur est posé dans ~/.local/bin, sans droit d'administrateur ; si ce dossier manque au PATH, une ligne marquée est ajoutée au profil de votre shell. Sous Windows, c'est un fichier helix.cmd dans le dossier .helix\\bin de votre compte, et ce dossier est ajouté au PATH de votre compte, sans droit d'administrateur non plus. Ouvrez ensuite un nouveau terminal (sous Windows, PowerShell ou l'Invite de commandes). « Mettre à jour » et « Retirer » sont au même endroit. Il faut Node 20 ou plus récent : s'il manque, le bouton pose celui de l'application.\n\nLes commandes principales :\n- helix connexion : se connecter une fois avec son compte (mot de passe masqué, puis code si la double authentification est active) ;\n- helix, ou helix chat : un Chat interactif ; helix chat \"question\" : une question, une réponse ;\n- helix chat --outils : le même Chat, avec les outils et les connecteurs de l'instance ;\n- helix code : l'agent de code sur le dossier courant ; helix code \"demande\" pour une seule demande ;\n- helix modeles et helix outils : les modèles de l'instance, et ses groupes d'outils avec le niveau d'accord ;\n- helix deconnexion ; helix --aide : toutes les commandes et les options (--adresse, --modele, --effort, --dossier…).\n\nDans une conversation : /nouveau, /modele, /aide, /quitter (ou Ctrl+D) ; Ctrl+C arrête la réponse en cours.\n\nQuand l'agent veut agir, le terminal montre la demande en entier et pose « Autoriser ? [o/N] » : seuls « o » ou « oui » accordent, toute autre réponse refuse. Sans réponse dans les deux minutes, l'action n'est pas faite. Hors de cet ordinateur, l'adresse de l'instance doit être en https."),
  },
  {
    id: "documents",
    titre: t("Fichiers et documents"),
    resume: t("Déposer des fichiers, et ce que les agents en font."),
    motsCles: ["document", "bibliotheque", "fichier", "pdf", "taille", "televersement", "chiffrement"],
    lien: "/bibliotheque",
    module: "bibliotheque",
    corps: t("Les documents sont chiffrés sur l'instance, y compris les gros : ils partent par tranches, chacune scellée séparément, ce qui permet de déposer jusqu'à 1 Go par fichier (2 Go pour un enregistrement de réunion).\n\n- Visibilité : privé, un ou plusieurs groupes, ou toute l'organisation. Elle se change après coup.\n- Les agents lisent un document par passages, pas d'un bloc : une note de 300 pages ne sature pas la mémoire du modèle, mais il faudra parfois lui dire où chercher.\n- L'extraction de texte (PDF, bureautique) s'arrête à 100 Mo par fichier. Au-delà, le fichier est bien stocké, mais son texte n'est pas indexé."),
  },
  {
    // Bases de connaissances (29/09/2026) : src/components/bibliotheque/BasesConnaissances.tsx, ConnaissancesChip.tsx, gateway/src/connaissances.ts.
    id: "bases-connaissances",
    titre: t("Bases de connaissances : répondre d'après vos documents"),
    resume: t("Indexer des documents sur la machine, et les faire citer par le Chat."),
    motsCles: ["base de connaissances", "connaissances", "rag", "sources", "citer", "indexer", "embeddings", "passages", "documents"],
    lien: "/bibliotheque",
    module: "bibliotheque",
    corps: t("Une base de connaissances rassemble des documents de Fichiers. L'instance les découpe en passages et les indexe sur la machine ; un Chat qui la consulte répond à partir des passages trouvés, et cite ses sources.\n\n- Créer : Fichiers, onglet « Bases de connaissances », « Nouvelle base » : un nom, une description, et qui peut s'en servir. Voir une base ne donne pas accès à ses documents.\n- Remplir : « Ajouter depuis Fichiers » ou « Importer un fichier ». Chaque document dit où il en est : « En attente », passages indexés, « Prêt », « Échec » ou « Sans texte ». « Essayer une question » montre les passages que la base retrouve. Supprimer une base laisse ses documents dans Fichiers.\n- Il faut un modèle d'embeddings chargé dans LM Studio, par exemple text-embedding-nomic-embed-text-v1.5. Sans lui, l'écran le dit : chargez-le, puis relancez l'indexation. Une clé chez un fournisseur ne sert jamais à indexer.\n- Dans le Chat, la pastille « Connaissances » coche les bases à consulter. Celles de l'agent choisi ou du projet où le Chat est rangé sont consultées aussi, et l'écran dit d'où elles viennent.\n- Sous la réponse, « Sources » donne les passages cités par leur numéro ; ceux qui ont été consultés sans être cités sont repliés.\n\nChacun ne retrouve que les documents qu'il voit dans Fichiers : un document qui vous est fermé n'est ni nommé ni cité pour vous. Les agents toujours actifs consultent les bases, dans ce qui est ouvert à toute l'équipe ; plus largement, seulement s'ils n'ont ni messagerie ni outil qui écrit ou envoie. Avec une clé d'API, un programme peut aussi interroger vos bases (voir « API développeur »)."),
  },
  {
    // L'écran Projets (29/09/2026) : src/pages/ProjetsPage.tsx. Identifiant à part : « projets » est l'article des connecteurs Trello, Monday…
    id: "projets-chats",
    titre: t("Projets : regrouper Chats et documents"),
    resume: t("Un sujet, ses Chats, ses bases de connaissances et ses membres."),
    motsCles: ["projet", "projets", "regrouper", "ranger", "membres", "inviter", "dossier"],
    lien: "/projets",
    module: "projets",
    corps: t("Un projet regroupe les Chats et les bases de connaissances d'un même sujet. Projets, « Nouveau projet » : un nom, et une description si vous voulez.\n\n- Ranger un Chat : depuis la pastille « Projet », sous le champ de saisie du Chat, ou par « Nouveau Chat » dans le projet. Ranger ne partage rien : pour qu'un membre lise un Chat, partagez-le depuis le Chat lui-même.\n- Bases de connaissances : le propriétaire du projet en rattache. Les Chats rangés dans le projet y cherchent avant de répondre, et chaque membre n'y lit que ce qu'il a le droit de voir.\n- Membres : « Inviter un collègue », par son adresse. Qui a déjà un compte est ajouté tout de suite ; sinon, un mail part avec un code valable sept jours, ou, si le mail ne peut pas partir, l'écran donne l'adresse et le code à transmettre vous-même.\n- Le propriétaire retire un membre, ou supprime le projet.\n\nLes tâches se rangent aussi dans un projet, depuis l'écran Tâches. Les invitations valent pour cette installation : pour travailler à plusieurs depuis plusieurs postes, il faut une instance partagée (voir « Travailler avec quelqu'un d'autre »)."),
  },
  {
    // Groupes (29/09/2026) : src/pages/GroupesPage.tsx, gateway/src/groupes.ts.
    id: "groupes",
    titre: t("Groupes : partager d'un geste"),
    resume: t("Réunir des collègues pour leur partager une conversation, un dossier ou une base."),
    motsCles: ["groupe", "groupes", "equipe", "service", "partager", "membres", "responsable"],
    lien: "/groupes",
    module: "groupes",
    corps: t("Un groupe réunit des collègues. Ce qu'on partage avec lui (une conversation, un dossier ou un document de Fichiers, une base de connaissances, un agent), chaque membre le voit, et le perd s'il quitte le groupe.\n\n- Créer : Groupes, « Nouveau groupe » : un nom, qui doit être unique, une description, et les membres, choisis dans l'annuaire. Vous en devenez responsable.\n- Tout le monde voit les groupes et leurs membres, et peut en créer.\n- Seuls les responsables renomment le groupe, ajoutent ou retirent des personnes, nomment un autre responsable, et suppriment le groupe.\n- Chacun peut quitter un groupe, sauf son dernier responsable, qui en nomme d'abord un autre.\n\nDans Fichiers, « Des groupes » règle qui voit un document ; la même règle vaut pour les bases de connaissances et les agents."),
  },
  {
    id: "agents",
    titre: t("Agents qui travaillent tout seuls"),
    resume: t("Des agents qui tournent même fenêtre fermée."),
    motsCles: ["agent", "employe", "openclaw", "mission", "autonome", "planification"],
    lien: "/agents",
    module: "agents",
    corps: tf("Un agent déployé vit dans l'instance, pas dans la fenêtre : il continue quand vous fermez l'application.\n\n- Son modèle : chacun a le sien, choisi à la création dans « Son modèle ». Un modèle est proposé selon son poste, avec la raison (un modèle qui sait se servir d'outils quand il en a, le plus léger pour un poste court) ; « Le prendre » l'accepte, ou choisissez-en un autre. Un modèle cloud ne vous est jamais proposé d'office : choisi à la main, l'écran dit où partent ses messages et qui paie (votre clé, ou celle de l'équipe). Ce modèle sert sur sa fiche, dans ses missions et sur ses messageries ; dans le Chat, c'est celui choisi dans le Chat.\n- Changer de modèle : ouvrez sa carte, onglet Réglages (vous seul, qui l'avez créé), puis « Son modèle ». Le changement vaut dès son message suivant. Si son modèle disparaît (désinstallé, clé retirée), sa carte dit « Modèle indisponible » avec la raison : il ne répond pas avec un autre à sa place, choisissez-en un nouveau dans ses Réglages.\n- Photo : cliquez sur l'avatar de sa carte pour lui en donner une ; elle apparaît aussi dans le choix de l'agent du Chat.\n- Missions : dans son onglet Missions, au rythme voulu : chaque jour, du lundi au vendredi, un jour de la semaine, un jour du mois (ou le dernier), chaque heure, et l'heure à la minute. Chaque mission rend compte dans Activité.\n- Canaux : il peut répondre sur les messageries que vous lui branchez.\n- Liberté : son palier dit ce qu'il a en plus de ses outils {0} (le web au palier « étendu », des commandes au palier « libre »). Ce qu'ouvre un palier ne passe pas par votre accord.\n- Instructions masquées : pour un agent partagé, son auteur peut les masquer. Elles restent sur l'instance, qui les ajoute elle-même au Chat. Le modèle, lui, les lit : une question insistante peut lui en faire dire une partie.\n\nQuand il traite un mail reçu, il travaille avec moins de droits : ni navigateur, ni messagerie, ni commande, ni écriture de fichier, et sur le web il n'ouvre que des adresses déjà vues (dans le mail, une recherche ou une page lue). Un mail piégé ne peut pas lui faire envoyer vos données sur le web.\n\nSous Windows, si les bibliothèques Visual C++ de Microsoft manquent sur le PC, la première mise en service les installe avec le paquet officiel de Microsoft : Windows demande alors une autorisation d'administrateur (si la demande n'apparaît pas, regardez la barre des tâches). Si votre compte n'a pas le mot de passe d'un administrateur, demandez à la personne qui gère ce PC.\n\nUn agent ne sait que ce que vous lui donnez : son instruction, ses outils, les documents qu'il a le droit de voir.", branding.name),
  },
  {
    id: "taches",
    titre: t("Tâches et enchaînements"),
    resume: t("Déléguer une carte, et en enchaîner plusieurs."),
    motsCles: ["tache", "kanban", "carte", "deleguer", "enchainer", "dependance"],
    lien: "/taches",
    module: "taches",
    corps: t("Une carte peut être confiée à un agent : il la traite et écrit son compte rendu dedans.\n\n- « Après » : une carte peut attendre qu'une autre soit terminée. Elle ne part pas avant.\n- « Lancement » : automatique, une carte démarre d'elle-même dès que ses prérequis sont finis, et récupère leurs résultats.\n- Les cartes lancées automatiquement passent une à une : sur une machine qui fait tourner un modèle en local, trois agents en même temps se gêneraient.\n\nLimite assumée : ces exécutions vivent dans la fenêtre de l'application. La fermer les interrompt. Les agents de l'écran Agents, eux, travaillent dans l'instance."),
  },
  {
    id: "taches-programmees",
    titre: t("Tâches programmées"),
    resume: t("Une consigne qui tourne seule, chaque jour, semaine ou mois."),
    motsCles: ["programmer", "programmee", "planifier", "quotidien", "hebdomadaire", "mensuel", "chaque", "rappel", "automatique"],
    lien: "/taches",
    corps: t("Une tâche programmée, c'est une consigne et un rythme : l'instance l'exécute avec vos outils (mails, agenda, fichiers), même fenêtre fermée, puis en garde le compte rendu.\n\n- Où : Tâches, rubrique « Programmées », « Nouvelle tâche programmée ». Ou dans un Chat : « Tous les lundis à 8 h, résume mes mails de la semaine ». Une carte vous la montre avant qu'elle soit créée.\n- Rythme : chaque jour, du lundi au vendredi, chaque semaine (un jour choisi), chaque mois (un jour du mois, ou le dernier), et l'heure.\n- Fait par : l'agent du Chat, ou l'un de vos agents, avec ses instructions, son modèle et ses bases de connaissances.\n- Chaque exécution laisse un compte rendu, qui s'ouvre dans un Chat pour y répondre.\n\nPersonne n'est devant l'écran quand elle tourne : ce qui modifie quelque chose attend votre accord, et sans réponse la carte expire, sauf au niveau « Tout approuver ». Une machine éteinte à l'heure dite fait la tâche au démarrage suivant, une seule fois."),
  },
  {
    id: "images-videos",
    titre: t("Créer une image ou une vidéo"),
    resume: t("Sur votre machine, avec un modèle ouvert, selon sa puissance."),
    motsCles: ["image", "video", "creer", "generer", "dessin", "photo", "film", "animation"],
    lien: "/",
    corps: t("Dans le Chat, le menu « + » propose « Créer une image » et « Créer une vidéo ». Tout se calcule sur la machine de l'instance : ni la description ni le résultat ne partent sur internet.\n\n- Le modèle proposé dépend de la machine (mémoire du Mac, ou de la carte graphique d'un PC). Le conseillé est en tête, avec la taille à télécharger ; rien ne s'installe sans votre clic.\n- Image : carré, portrait ou paysage, en quelques minutes.\n- Vidéo : deux secondes, en paysage ou en portrait. Mesuré sur un Mac de 16 Go : environ 11 minutes. Sur un PC sans carte graphique, la vidéo n'est pas proposée. Au-delà de 45 minutes, elle s'arrête et le dit.\n- Pendant le calcul, les modèles de conversation sont mis de côté pour faire de la place, s'ils ne travaillent pas.\n\nUne image ou une vidéo se voit par qui voit le Chat où elle a été créée, et se télécharge depuis le Chat."),
  },
  {
    id: "decoupage",
    titre: t("Demandes longues : le découpage"),
    resume: t("Comment une grosse demande est menée à bout."),
    motsCles: ["decoupage", "plan", "etape", "long", "sequencage", "petit modele"],
    lien: "/",
    corps: t("Quand une demande est trop grosse pour un seul tour, le modèle est appelé une première fois pour juger s'il faut la découper, puis pour en écrire le plan. Chaque étape est ensuite traitée à part, avec son propre budget d'actions, et vérifiée avant de passer à la suivante.\n\nLe découpage n'est pas infini, et c'est voulu :\n- 15 étapes au premier niveau, 8 quand une étape est redécoupée ;\n- 3 niveaux de profondeur ;\n- 60 étapes exécutées au total pour une demande.\n\nUne demande qui touche ces limites s'arrête et le dit, plutôt que de tourner sans fin. Le plan s'affiche au fil de l'eau, avec les étapes faites et celles qui restent."),
  },
  {
    id: "courrier",
    titre: t("Connecter sa boîte mail"),
    resume: t("Lire, écrire des brouillons, envoyer après accord."),
    motsCles: ["mail", "courrier", "imap", "smtp", "boite", "envoyer", "brouillon"],
    lien: "/parametres/mcp",
    corps: t("Le connecteur courrier se règle dans Réglages, Connecteurs.\n\n- Lecture : l'agent lit les messages de votre boîte par IMAP.\n- Brouillons : il peut déposer un vrai brouillon dans votre messagerie, que vous relisez et envoyez vous-même.\n- Envoi : il faut renseigner le serveur d'envoi. Chaque message vous est montré en entier avant de partir, avec ses destinataires.\n\nGmail et Outlook se branchent aussi sans mot de passe, par « Se connecter avec Google » ou « Se connecter avec Microsoft », avec l'application de votre organisation (voir « Brancher Gmail pas à pas »). Sinon, un mot de passe d'application est souvent nécessaire : votre mot de passe habituel sera refusé par le fournisseur. Il est conservé chiffré sur l'instance, jamais dans la fenêtre.\n\nLa boîte est commune à l'instance : seul son administrateur la branche, change son serveur d'envoi ou autorise l'envoi sans confirmation."),
  },
  {
    /*
     * Demandé par Medhi le 28/09/2026 (« quand je veux connecter Gmail, il n'y a
     * pas la redirection vers où je dois aller pour créer l'appli »). Les étapes
     * sont celles de l'écran (src/lib/guidesApplications.ts, `guideGoogle`).
     */
    id: "gmail",
    titre: t("Brancher Gmail pas à pas"),
    resume: t("Avec l'application Google de votre organisation, créée une fois pour tous les services Google."),
    motsCles: ["gmail", "google", "mail", "courrier", "oauth", "console", "google cloud", "application", "client id", "identifiant", "redirection", "adresse de retour", "workspace"],
    lien: "/parametres/mcp",
    corps: t("Gmail se branche dans Réglages, Connecteurs, ligne « Courrier » : tapez l'adresse Gmail, puis « Se connecter avec Google », « Essayer ». Seul l'administrateur de l'instance branche la boîte.\n\nIl faut une application Google, créée une fois pour toute l'instance. C'est la même pour Gmail, Google Agenda, Drive, Sheets, Slides, Docs, Forms et YouTube : ne la créez pas deux fois. Si elle existe déjà, il n'y a rien d'autre à préparer.\n\nSi elle n'existe pas encore, l'écran affiche quatre boutons, à ouvrir dans l'ordre :\n- « Ouvrir la création de projet » : un nom, puis « Create ».\n- « Ouvrir l'activation des API Google » : il active d'un coup les API de Gmail, Agenda, Drive et des autres. Confirmez le projet.\n- « Ouvrir Google Auth Platform » : « Get started », un nom et votre adresse. Audience « Internal » si votre organisation a Google Workspace ; sinon « External », puis ajoutez votre adresse dans « Test users » et publiez l'application (« Publish app ») : en test, Google coupe l'accès au bout de sept jours.\n- « Ouvrir la création du client OAuth » : type « Desktop app » (Application de bureau), pas « Web application ». Aucune adresse de retour à déclarer.\n\nGoogle affiche alors l'ID client (il se termine par .apps.googleusercontent.com) et le code secret. Copiez les deux tout de suite : Google ne remontre plus le secret. Collez-les dans l'écran, « Enregistrer l'application Google », puis « Se connecter avec Google ».\n\nSi Google affiche une erreur :\n- « Google hasn't verified this app » : normal pour une application « External » qui ne sert qu'à vous. « Advanced », puis « Go to … (unsafe) ».\n- « Error 403: access_denied » : le compte n'est pas dans les utilisateurs de test ; ajoutez-le, ou publiez l'application.\n- « org_internal » : application « Internal », et un compte hors de votre organisation.\n- « redirect_uri_mismatch » : le client n'est pas de type « Desktop app ».\n\nCompte Google Workspace : l'administrateur doit laisser IMAP activé pour les utilisateurs. L'instance est sur une autre machine que votre navigateur ? Après votre accord, la page affiche une erreur à une adresse en http://127.0.0.1 : copiez cette adresse et collez-la dans l'écran, qui termine la connexion."),
  },
  {
    // Le même parcours pour tous les services à application (28/09/2026, src/lib/guidesApplications.ts).
    id: "applications",
    titre: t("Créer l'application d'un service, pas à pas"),
    resume: t("Google, Microsoft, LinkedIn, Meta, TikTok, X, Dropbox, Salesforce, GitHub… : où aller, quoi recopier."),
    motsCles: ["application", "console", "developpeur", "client id", "secret", "redirect", "redirection", "adresse de retour", "oauth", "google", "microsoft", "entra", "linkedin", "page linkedin", "page d'entreprise", "community management", "facebook", "instagram", "tiktok", "x", "dropbox", "salesforce", "pipedrive", "zendesk", "shopify", "github", "asana", "zoom", "box", "slack"],
    lien: "/parametres/mcp",
    corps: t("Beaucoup de services ne laissent entrer qu'une application que votre organisation a déclarée chez eux. Vous la créez une fois, dans la console du service ; ensuite, « Se connecter » suffit. Le panneau de chaque service, dans Réglages, Connecteurs, suit toujours le même ordre :\n\n- des boutons « Ouvrir … » en tête : ils mènent à la page exacte de la console où l'on crée l'application ;\n- des étapes numérotées, dans l'ordre de la console : quoi cliquer, quoi choisir, quoi recopier ;\n- l'adresse de retour, avec un bouton « Copier », dans l'étape où on la colle chez le service. Collez-la telle quelle : un caractère de différence, et le service refuse ;\n- les portées ou permissions à cocher, copiables elles aussi : ni plus, ni moins, sinon la connexion est refusée par prudence ;\n- ce qu'il ne faut pas faire (le mauvais type d'application, publier ou non) ;\n- « Si … affiche une erreur » : la cause probable et le remède, pour les erreurs que le service affiche chez lui.\n\nCollez ensuite l'identifiant et le secret dans les champs du panneau : chaque champ dit où les trouver. Le secret est gardé chiffré sur l'instance et n'en ressort jamais. Beaucoup de consoles ne montrent le secret qu'une fois : copiez-le tout de suite.\n\nUne même application sert à plusieurs services : celle de Google pour Gmail, Agenda, Drive, Sheets, Slides, Docs, Forms et YouTube ; celle de Microsoft 365 pour Outlook, OneDrive, SharePoint, Excel, Word et Teams, et pour la boîte Outlook. LinkedIn, à l'inverse, en veut deux : une pour le profil, et une seconde, neuve, pour la Page d'entreprise (ligne « LinkedIn (Page d'entreprise) »). LinkedIn n'ouvre les pages qu'à une application qui n'a aucun autre produit, et il examine la demande avant : l'organisation, une adresse e-mail professionnelle, et la vérification de l'application par un super administrateur de la page. Il n'annonce pas de délai.\n\nL'adresse de retour dépend de l'adresse par laquelle vous ouvrez l'instance : sur ce poste, elle commence par http://localhost ou http://127.0.0.1. Certains services veulent une adresse en https (Slack pour son serveur, parfois Meta, LinkedIn ou Pipedrive) : ouvrez alors l'instance par son adresse en https, et déclarez celle que le panneau affiche.\n\nLes consoles changent de libellés de temps en temps : si un bouton ne porte plus exactement le nom écrit, cherchez l'équivalent."),
  },
  {
    // X (ex-Twitter), 28/09/2026 : gateway/src/oauthNatif.ts, outilsNatifs.ts, SECURITE.md § 42.
    id: "x",
    titre: t("Connecter X (ex-Twitter)"),
    resume: t("Lire les posts du compte de l'organisation, publier après accord."),
    motsCles: ["x", "twitter", "tweet", "post", "reseaux sociaux", "publier"],
    lien: "/parametres/mcp",
    corps: t("X se branche dans Réglages, Connecteurs, avec l'application que votre organisation crée elle-même sur console.x.com. L'écran dit comment, en quelques étapes. Seul l'administrateur de l'instance branche X, et seul lui peut publier.\n\n- Lecture, sans rien cocher : le compte (abonnés, nombre de posts) et ses derniers posts, avec leurs vues, j'aime, reposts et réponses.\n- Publier, si la case est cochée à la connexion : un post de 280 caractères au plus, avec une image du dossier de travail si vous le demandez. Chaque post vous est montré en entier et ne part qu'après votre accord, à chaque fois, quel que soit le niveau d'approbation.\n\nL'API de X est payante : X n'a plus d'offre gratuite pour les nouveaux développeurs depuis février 2026. On lui achète des crédits, et chaque lecture ou publication est décomptée ; un post qui contient une adresse web coûte plus cher. Les tarifs publiés par X sont rappelés sur l'écran de connexion.\n\nPar prudence, dix publications par heure au plus pour toute l'instance, et le même post n'est pas publié deux fois de suite."),
  },
  {
    // LinkedIn, profil et Page d'entreprise (29/09/2026) : gateway/src/oauthNatif.ts (`linkedin`, `linkedinPage`), outilsNatifs.ts, SECURITE.md § 62.
    id: "linkedin",
    titre: t("Connecter LinkedIn : profil et Page d'entreprise"),
    resume: t("Publier au nom de votre profil ; lire et publier pour une page, avec une seconde application."),
    motsCles: ["linkedin", "page", "page d'entreprise", "entreprise", "profil", "publier", "post", "reseaux sociaux", "community management"],
    lien: "/parametres/mcp",
    corps: t("LinkedIn se branche dans Réglages, Connecteurs, rubrique « Réseaux sociaux », sur deux lignes, avec deux applications que votre organisation crée elle-même chez LinkedIn. Le panneau de chaque ligne dit comment, pas à pas. Seul l'administrateur de l'instance les branche, et seul lui peut faire publier.\n\n- « LinkedIn » : le profil. Se connecter, et publier au nom du profil si la case est cochée. Lire les publications d'un profil n'est pas possible : LinkedIn n'ouvre plus cet accès.\n- « LinkedIn (Page d'entreprise) » : les pages que le compte administre. Vos agents listent ces pages, lisent leurs dernières publications et leurs statistiques (sur les douze derniers mois), et publient au nom d'une page si la case est cochée. Le compte qui se connecte doit administrer au moins une page.\n\nPourquoi deux applications : LinkedIn n'ouvre les pages qu'au produit « Community Management API », et seulement à une application qui n'a aucun autre produit. Il examine la demande avant de l'accorder : l'organisation, une adresse e-mail professionnelle, et la vérification de l'application par un super administrateur de la page. Il n'annonce pas de délai. Au premier palier, LinkedIn limite les appels à 100 par personne et par jour. Le panneau du profil mène à la ligne de la page : « Brancher la Page d'entreprise ».\n\nChaque publication, au nom du profil ou d'une page, vous est montrée en entier et ne part qu'après votre accord, même au niveau « Tout approuver ». Une publication ne se reprend pas."),
  },
  {
    // Google Docs, Google Forms, Dropbox, 28/09/2026 : gateway/src/natifs/documents.ts, SECURITE.md § 45.
    // Identifiant à part (tournée finale du 28/09/2026) : « documents » est celui de « Fichiers et
    // documents », et l'aide ouvre un article par son identifiant : un clic ici ouvrait l'autre.
    id: "connecteurs-documents",
    titre: t("Connecter Google Docs, Google Forms et Dropbox"),
    resume: t("Lire documents, formulaires et fichiers ; écrire ou envoyer après accord."),
    motsCles: ["google docs", "document", "google forms", "formulaire", "reponses", "dropbox", "fichier", "envoyer"],
    lien: "/parametres/mcp",
    corps: t("Ces trois services se branchent dans Réglages, Connecteurs. Seul l'administrateur de l'instance les branche, et seul lui peut faire écrire ou envoyer.\n\n- Google Docs et Google Forms reprennent l'application Google de l'instance, celle de Drive et d'Agenda : il suffit d'activer « Google Docs API » ou « Google Forms API » dans le même projet de la console Google Cloud.\n- Dropbox demande une application que votre organisation crée sur dropbox.com/developers/apps. L'écran dit comment, en quelques étapes, et quelle adresse de retour y déclarer.\n\nCe que vos agents peuvent faire :\n- Google Docs : lire un document, onglets et tableaux compris ; si la case est cochée à la connexion, créer un document ou ajouter du texte à la fin d'un document, sans rien effacer.\n- Google Forms : lire un formulaire et ses réponses, les plus récentes d'abord. Rien n'est modifié.\n- Dropbox : lister un dossier, chercher, lire un fichier texte ; si la case est cochée, envoyer un fichier du dossier de travail. Un fichier du même nom n'est jamais remplacé.\n\nChaque écriture et chaque envoi vous est montré en entier et n'a lieu qu'après votre accord, à chaque fois, quel que soit le niveau d'approbation. Par prudence, dix écritures par heure au plus et par service pour toute l'instance, et la même demande n'est pas refaite deux fois de suite."),
  },
  {
    // Messageries, 28/09/2026 : gateway/src/natifs/messageries.ts, SECURITE.md § 46.
    id: "messageries",
    titre: t("Connecter Telegram, Discord ou WhatsApp"),
    resume: t("Lire les messages reçus, envoyer un message après accord."),
    motsCles: ["telegram", "discord", "whatsapp", "messagerie", "bot", "message", "envoyer", "botfather"],
    lien: "/parametres/mcp",
    corps: t("Les messageries se branchent dans Réglages, Connecteurs, rubrique « Messageries ». Seul l'administrateur de l'instance les branche, et seul lui peut faire envoyer un message.\n\n- Telegram : créez un bot avec @BotFather (/newbot) et collez son jeton. Le bot lit les messages reçus depuis sa connexion ; dans un groupe, il ne voit que ceux qui le mentionnent, sauf si vous coupez son mode confidentialité (/setprivacy). Prenez un bot à part : un bot déjà branché sur un agent est refusé.\n- Discord : créez une application sur le portail développeur de Discord, copiez le jeton de son bot, activez « Message Content Intent », puis invitez le bot sur votre serveur.\n- WhatsApp Business : il faut un numéro WhatsApp Business chez Meta, un jeton d'utilisateur système et la clé secrète de l'application. Meta n'envoie les messages reçus qu'à une adresse publique en https : l'écran donne l'adresse et le jeton à déclarer.\n\nLire ne demande rien. Envoyer se coche à la connexion : chaque message vous est montré en entier, avec son destinataire, et ne part qu'après votre accord, à chaque fois, quel que soit le niveau d'approbation.\n\nWhatsApp : on répond librement à une personne pendant les 24 heures qui suivent son dernier message ; au-delà, seul un modèle de message approuvé par Meta peut partir, et Meta le facture.\n\nUn message reçu n'est jamais pris pour une consigne : l'agent le lit comme une donnée, et rien ne part sans vous. Par prudence, vingt messages par heure au plus par messagerie pour toute l'instance, et le même message n'est pas envoyé deux fois de suite au même destinataire."),
  },
  {
    // Commerce et relation client, 28/09/2026 : gateway/src/natifs/commerce.ts, SECURITE.md § 47.
    id: "commerce",
    titre: t("Commerce et relation client"),
    resume: t("Stripe, Shopify, WooCommerce, Salesforce, Pipedrive, Zendesk."),
    motsCles: ["stripe", "shopify", "woocommerce", "salesforce", "pipedrive", "zendesk", "commande", "facture", "paiement", "crm", "ticket", "boutique"],
    lien: "/parametres/mcp",
    corps: t("Ces six services se branchent dans Réglages, Connecteurs, rubrique « Commerce et relation client ». Seul l'administrateur de l'instance les branche, et l'écran dit comment créer la clé ou l'application chez chacun.\n\n- Stripe : une clé restreinte en lecture. Vos agents lisent paiements, clients, factures et abonnements ; rien ne peut être remboursé, encaissé ni viré par ce connecteur. Une clé secrète, qui ouvre tout le compte, est refusée.\n- Shopify : une application de votre organisation, installée sur la boutique. Commandes, produits et stocks, en lecture.\n- WooCommerce : une clé d'API REST en « Lecture ». Commandes et produits.\n- Salesforce et Pipedrive : l'application que vous déclarez chez eux, puis votre accord dans le navigateur. Contacts et affaires ; ajouter une note si la case est cochée.\n- Zendesk : un client OAuth de votre compte. Tickets et échanges ; répondre si la case est cochée, par une réponse publique ou une note interne.\n\nChaque note et chaque réponse vous est montrée en entier et ne part qu'après votre accord, à chaque fois, quel que soit le niveau d'approbation ; seul l'administrateur peut écrire. Par prudence, dix écritures par heure et par service au plus pour toute l'instance, et la même n'est pas faite deux fois de suite. Les clés et les accès sont gardés chiffrés sur l'instance et n'en ressortent jamais."),
  },
  {
    // Projets et rendez-vous, 28/09/2026 : gateway/src/natifs/projetsRegles.ts, SECURITE.md § 48.
    id: "projets",
    titre: t("Connecter Trello, Monday, ClickUp, Todoist, Calendly ou Zoom"),
    resume: t("Lire vos tâches, tableaux et rendez-vous ; écrire après accord si l'administrateur l'a permis."),
    motsCles: ["trello", "monday", "clickup", "todoist", "calendly", "zoom", "tache", "projet", "tableau", "rendez-vous", "reunion"],
    lien: "/parametres/mcp",
    corps: t("Ces six services se branchent dans Réglages, Connecteurs, par le serveur que leur éditeur publie : rien ne s'installe sur la machine, et l'accord se donne dans la page du service. Zoom demande en plus une application, créée une fois sur le Zoom App Marketplace : l'écran dit comment.\n\n- Seul l'administrateur de l'instance branche ces services : un compte branché vaut pour toute l'organisation.\n- Sans rien cocher, vos agents lisent seulement : tâches, tableaux, projets, disponibilités, réunions et leurs résumés.\n- Si l'administrateur coche l'écriture à la connexion, les agents peuvent proposer de créer ou de modifier. Chaque écriture est montrée en entier et n'a lieu qu'après votre accord, à chaque fois, quel que soit le niveau d'approbation, et seul l'administrateur peut l'accepter.\n- Les employés et l'agent de code lisent, mais n'écrivent jamais dans ces services.\n\nSi le service accorde plus que ce qui a été demandé (l'écriture sans que la case soit cochée, par exemple), rien n'est enregistré."),
  },
  {
    // Palmier Pro, 29/09/2026 : gateway/src/palmier.ts, palmierRegles.ts, SECURITE.md § 63.
    id: "palmier",
    titre: t("Monter des vidéos avec Palmier Pro"),
    resume: t("Brancher Palmier Pro, ouvert sur ce Mac, pour que vos agents montent sur sa timeline."),
    motsCles: ["palmier", "palmier pro", "video", "montage", "timeline", "generation", "seedance", "kling", "clip"],
    lien: "/parametres/mcp",
    corps: t("Palmier Pro est un monteur vidéo pour Mac, d'un autre éditeur. Il se branche dans Réglages, Connecteurs, rubrique « Documents et données », sur la machine de l'instance seulement : un Mac à puce Apple, avec macOS 26 (Tahoe) ou plus récent. La ligne n'apparaît pas ailleurs.\n\n- Installez Palmier Pro depuis sa page officielle, dans le dossier Applications, et ouvrez-le avec un projet.\n- Cliquez « Brancher ». L'instance vérifie d'abord que le programme qui répond est bien Palmier Pro, signé par son éditeur ; sinon, rien ne lui est envoyé et l'écran le dit.\n- Palmier Pro fermé : ses outils ne répondent plus. Rouvrez-le, puis « Réessayer ».\n\nCe que vos agents peuvent faire :\n- lire le projet, la timeline et la bibliothèque, sans rien demander (au niveau « Demander pour tout », avec votre accord) ;\n- tout le reste (ajouter, couper, déplacer des plans, des textes, des sous-titres, exporter, générer) seulement après votre accord, à chaque fois, quel que soit le niveau d'approbation. Seul l'administrateur de l'instance peut l'accepter ; les employés et l'agent de code ne font que lire.\n\nGénérer une vidéo, une image ou du son (Seedance, Kling, Nano Banana Pro…) se fait chez Palmier, hors de cette machine, avec l'abonnement ou les crédits de votre compte Palmier, et ne se reprend pas : la carte d'accord le rappelle. Pour la transcription, Palmier Pro peut aussi passer par ses services quand votre compte a des crédits."),
  },
  {
    // Brevo et Mailchimp, 28/09/2026 : gateway/src/natifs/projets.ts, SECURITE.md § 48.
    id: "campagnes",
    titre: t("Connecter Brevo ou Mailchimp"),
    resume: t("Lire vos campagnes e-mail et leurs statistiques ; préparer un brouillon ou envoyer après accord."),
    motsCles: ["brevo", "sendinblue", "mailchimp", "campagne", "emailing", "newsletter", "liste", "audience", "envoyer"],
    lien: "/parametres/mcp",
    corps: t("Brevo et Mailchimp se branchent dans Réglages, Connecteurs, avec l'application que votre organisation crée elle-même chez le service. L'écran dit comment, en quelques étapes. Seul l'administrateur de l'instance les branche.\n\n- Sans rien cocher : le compte, les listes ou audiences, les campagnes et leurs statistiques (envois, ouvertures, clics, désinscriptions).\n- Préparer des brouillons, si la case est cochée : rien ne part ; la carte d'accord montre le brouillon entier et le nombre de destinataires.\n- Envoyer, si la seconde case est cochée : la carte montre la campagne telle que le service l'enverra, relue chez lui, avec son objet, son expéditeur, son texte, ses liens et le nombre de destinataires. Si la campagne change entre la carte et l'envoi, rien ne part. Seul l'administrateur peut accepter un envoi.\n\nChez Brevo, seules les campagnes adressées à des listes s'envoient d'ici : le nombre de destinataires d'un segment n'est pas connu d'avance. Mailchimp n'a pas d'accès en lecture seule : c'est le logiciel qui s'en tient à la lecture tant que rien n'est coché.\n\nPar prudence, dix brouillons ou envois par heure au plus pour toute l'instance, et la même campagne n'est pas envoyée deux fois."),
  },
  {
    // Microsoft 365, 28/09/2026 : gateway/src/natifs/microsoftBase.ts, natifs/microsoft.ts, SECURITE.md § 44.
    id: "microsoft",
    titre: t("Connecter Microsoft 365"),
    resume: t("Outlook, OneDrive, SharePoint, Excel, Word et Teams, par une seule connexion."),
    motsCles: ["microsoft", "office", "outlook", "onedrive", "sharepoint", "excel", "word", "teams", "entra", "azure"],
    lien: "/parametres/mcp",
    corps: t("Microsoft 365 se branche dans Réglages, Connecteurs : les six lignes Outlook, OneDrive, SharePoint, Excel, Word et Teams ouvrent la même connexion. Seul l'administrateur de l'instance la branche.\n\nIl faut d'abord une application dans le portail Microsoft Entra de votre organisation, créée une fois : l'écran dit comment, en quelques étapes, et liste exactement les permissions à déclarer selon les services cochés. SharePoint et Teams demandent en plus le consentement d'un administrateur de l'annuaire.\n\n- Lecture, sans cocher l'écriture : mails et agenda, fichiers du OneDrive et des sites SharePoint, classeurs Excel, documents Word, canaux Teams.\n- Écriture, si la case est cochée : préparer un brouillon, envoyer un mail (avec des pièces jointes du dossier de travail), créer un événement, écrire des valeurs dans un classeur (jamais de formule), poster dans un canal. Chaque écriture vous est montrée en entier et n'a lieu qu'après votre accord, à chaque fois, quel que soit le niveau d'approbation ; seul l'administrateur peut écrire.\n\nLe compte branché vaut pour toute l'instance : branchez un compte dédié à l'organisation plutôt qu'un compte personnel. Par prudence, dix écritures par heure au plus pour Microsoft 365, et la même écriture n'est pas refaite deux fois de suite.\n\nDébrancher efface l'accès de l'instance. Microsoft ne laisse pas une application révoquer elle-même son accès : pour le couper aussi chez Microsoft, un administrateur le retire dans le portail Entra (« Applications d'entreprise », l'application, « Autorisations »)."),
  },
  {
    id: "reunions",
    titre: t("Réunions et transcription"),
    resume: t("Enregistrer, transcrire, résumer une réunion."),
    motsCles: ["reunion", "meet", "transcription", "audio", "compte rendu", "bot"],
    lien: "/reunions",
    module: "reunions",
    corps: t("Deux façons d'obtenir une transcription :\n\n- enregistrer depuis votre poste : le son de la réunion est capté, chiffré, puis transcrit sur l'instance ;\n- envoyer un bot dans une réunion Google Meet : il rejoint, écoute et renvoie le son. Il faut l'autoriser à entrer dans la réunion comme n'importe quel participant.\n\nLa transcription tourne sur l'instance. Un enregistrement peut aller jusqu'à 2 Go, soit plusieurs heures."),
  },
  {
    // Réglages, Bot Recorder (29/09/2026) : src/pages/ParametresPages.tsx, BotRecorderSettings.
    id: "bot-reunion",
    titre: t("Régler le bot de réunion"),
    resume: t("Son nom, son compte Google, l'agenda, la langue et le compte rendu."),
    motsCles: ["bot", "bot recorder", "reunion", "meet", "google meet", "transcription", "audio", "compte rendu", "agenda"],
    lien: "/parametres/bot-recorder",
    module: "reunions",
    corps: tf("Réglages, Bot Recorder règle l'enregistrement et la transcription des réunions.\n\n- Le bot : son nom affiché dans la réunion (par défaut « Prise de notes {0} »). Dans l'application de bureau, un compte Google pour le bot, facultatif, pour les réunions qui refusent les invités sans compte : « Connecter un compte ». Le bot ne tourne que dans l'application de bureau.\n- Réunions de l'agenda : « Rejoindre automatiquement les réunions Google Meet ». Il faut l'agenda branché dans Connecteurs, et l'application de bureau ouverte.\n- Transcription, par Whisper, sur la machine de l'instance : la langue des réunions (français, anglais, ou détection automatique), le compte rendu automatique (résumé, décisions, tâches), et « Conserver l'enregistrement audio ». Coupé par défaut : l'audio est effacé après la transcription ; allumé, il est gardé chiffré.", branding.name),
  },
  {
    id: "confidentialite",
    titre: t("Où vont vos données"),
    resume: t("Ce qui reste chez vous, ce qui peut en sortir."),
    motsCles: ["donnees", "confidentialite", "rgpd", "vie privee", "export", "effacement", "audit"],
    lien: "/parametres/confidentialite",
    corps: t("Par défaut, rien ne sort de votre installation. Ce qui peut en sortir, et seulement si vous l'avez branché vous-même :\n\n- un modèle chez un fournisseur avec votre clé : la conversation part chez lui ;\n- un connecteur (boîte mail, stockage, messagerie) : il parle au service que vous avez désigné ;\n- la vérification de mise à jour, vers l'adresse inscrite dans le paquet par votre prestataire, ou vers l'instance de votre organisation. Une mise à jour ne s'installe que si elle porte la signature de l'éditeur de votre application, d'où qu'elle vienne.\n\nVous pouvez à tout moment exporter toutes vos données, ou demander leur effacement, depuis Réglages, Confidentialité. Le journal d'audit garde la trace de chaque action faite par un agent."),
  },
  {
    // Réglages, Profil (29/09/2026) : src/pages/ParametresPages.tsx, SupprimerCompte.tsx.
    id: "profil",
    titre: t("Votre profil et votre compte"),
    resume: t("Nom, adresse, photo, déconnexion, suppression du compte."),
    motsCles: ["profil", "compte", "nom", "adresse", "email", "photo", "avatar", "deconnexion", "supprimer mon compte"],
    lien: "/parametres/profil",
    corps: t("Réglages, Profil.\n\n- Nom et adresse : « Enregistrer » les garde sur l'instance. Changer d'adresse demande votre mot de passe actuel ; une adresse déjà utilisée est refusée, et une invitation envoyée à la nouvelle adresse n'est pas reprise.\n- « Photo de profil » : JPEG, PNG ou WebP, enregistrée sur l'instance dès que vous la choisissez. Sans photo, vos initiales.\n- Instance : l'adresse de l'instance à laquelle ce poste parle, ou « Poste autonome ». Une nouvelle adresse est essayée avant d'être retenue, puis l'application se recharge.\n- Collègues : ouvrir l'instance, inviter, créer un compte (voir « Travailler avec quelqu'un d'autre »).\n- « Se déconnecter » ferme votre séance ; rien n'est effacé.\n- « Supprimer mon compte » montre d'abord ce qui sera supprimé (conversations, tâches, agents, documents, réunions, projets dont vous êtes le seul membre) et les projets confiés à un collègue. Il faut votre mot de passe, votre code si la double authentification est active, et cocher la case de confirmation. La suppression est définitive ; le journal d'activité garde la trace des actions passées."),
  },
  {
    // Réglages, Sécurité (29/09/2026) : DeuxFacteurs.tsx, SeancesEtJournal.tsx, gateway/src/totp.ts, audit.ts.
    id: "securite",
    titre: t("Sécurité : double authentification, postes et journal"),
    resume: t("Protéger votre compte, voir les postes connectés et ce qui a été fait."),
    motsCles: ["securite", "double authentification", "2fa", "totp", "code", "secours", "seance", "poste", "journal", "audit"],
    lien: "/parametres/securite",
    corps: t("Réglages, Sécurité.\n\nLa double authentification demande, en plus du mot de passe, un code à six chiffres tiré d'une application d'authentification sur votre téléphone. Rien ne passe par un service extérieur.\n- « Activer » : votre mot de passe, puis le QR code à lire avec l'application (ou la clé à saisir à la main), puis un premier code.\n- Dix codes de secours s'affichent une seule fois : copiez-les et gardez-les à l'abri. Chacun sert une fois, à la place d'un code du téléphone. La page prévient quand il en reste trois ou moins ; « Nouveaux codes de secours » en refait une série.\n- Si votre instance l'impose, elle ne se désactive pas.\n- Téléphone et codes perdus : l'administrateur peut retirer le second facteur, depuis la machine qui héberge l'instance.\n\nPostes connectés : chaque séance ouverte avec votre compte, ce poste compris. « Fermer » coupe tout de suite l'accès d'un autre poste.\n\nJournal d'activité : les dernières actions, dites en clair, et la vérification de la chaîne du journal (« Journal intact » ou « Journal altéré »). Vous y voyez vos actions et celles de l'instance ; l'administrateur voit celles de tout le monde."),
  },
  {
    // Réglages, Préférences : apparence et formats (29/09/2026) : Apparence.tsx, src/lib/formats.ts.
    id: "apparence",
    titre: t("Apparence, dates et heures"),
    resume: t("Clair, sombre, au coucher du soleil ; formats de date et d'heure."),
    motsCles: ["apparence", "theme", "sombre", "clair", "nuit", "soleil", "date", "heure", "format"],
    lien: "/parametres/preferences",
    corps: t("Réglages, Préférences.\n\n- Apparence : « Clair », « Sombre », « Réglage du système », ou « Au coucher du soleil », qui passe en sombre à la tombée du jour. Les heures du soleil sont calculées sur le poste, sans rien demander à Internet. Ce choix vaut pour ce poste.\n- Dates et heures : date au format européen, américain ou ISO, heure sur 24 ou 12 heures, avec un aperçu. Ce choix suit votre compte sur tous vos postes, et vaut partout où une date s'affiche.\n- Langue : voir « Changer la langue »."),
  },
  {
    // Mise à jour de l'application (29/09/2026) : MiseAJour.tsx, electron/miseAJour.cjs, sourceGithub.cjs.
    id: "mise-a-jour",
    titre: t("Mettre à jour l'application"),
    resume: t("D'où vient une nouvelle version, et comment elle s'installe."),
    motsCles: ["mise a jour", "version", "nouvelle version", "installer", "telecharger", "signature", "a propos"],
    lien: "/parametres/preferences",
    corps: t("Réglages, Préférences, carte « À propos » : la version installée et, dans l'application de bureau, la mise à jour. Dans un navigateur, l'interface suit la version de l'instance.\n\n- D'où vient la nouvelle version : du serveur de votre prestataire s'il est inscrit dans l'application ; sinon, pour un poste rattaché, de l'instance ; sinon, pour un poste seul, des versions publiées sur GitHub. L'application vérifie peu après son lancement, puis toutes les six heures ; « Vérifier maintenant » le fait tout de suite.\n- Une version ne s'installe que si son empreinte correspond et qu'elle porte la signature de l'éditeur de votre application, d'où qu'elle vienne.\n- Sur Mac et sous Windows : « Installer maintenant », en un clic. Quand l'application est signée par Apple, la version se télécharge seule, puis « Redémarrer pour installer », ou elle s'installe à la fermeture.\n- Sous Linux, ou quand l'installation en un clic n'est pas possible : « Télécharger », puis installez le paquet.\n\nSi aucune source n'est inscrite, rien n'est contacté : la page le dit, et « Voir les versions publiées » mène aux versions, à installer à la main."),
  },
  {
    // Réglages, Personnalisation de l'IA (29/09/2026) : src/lib/store/profile.ts, buildSystemPrompt (Chat, Cowork, tâches ; pas Code).
    id: "personnalisation",
    titre: t("Personnaliser l'IA : instructions et mémoire"),
    resume: t("Ce que le modèle sait de vous, et comment il vous répond."),
    motsCles: ["personnalisation", "instructions", "memoire", "souvenir", "profil", "ton", "style", "preferences"],
    lien: "/parametres/personnalisation",
    corps: t("Réglages, Personnalisation de l'IA. Ces réglages sont à vous seul : ils ne sont jamais montrés aux autres, même quand vous partagez une conversation.\n\n- Instructions personnalisées : comment l'IA doit vous répondre (ton, longueur, langue, format).\n- Informations personnelles : ce qu'elle peut savoir de vous (métier, contexte, préférences).\n- Mémoire : des éléments que vous ajoutez un par un (« Ajouter un élément à mémoriser... »), et que la corbeille oublie. L'interrupteur « Mémoire IA » décide s'ils sont donnés au modèle. Ce sont les éléments que vous avez écrits : rien n'y entre sans vous.\n\nCe texte est ajouté aux consignes du modèle dans le Chat, dans Cowork et dans les tâches confiées à un agent, après le rôle de l'agent et les procédures de votre organisation ; pas dans l'écran Code. Il part avec chaque demande au modèle choisi : si c'est un modèle chez un fournisseur, il le reçoit aussi."),
  },
  {
    // Réglages, Entraîner un modèle (29/09/2026) : src/components/settings/EntrainerModele.tsx, gateway/src/entrainement.ts.
    id: "entrainement",
    titre: t("Entraîner un modèle sur les faits de votre organisation"),
    resume: t("Des exemples, un entraînement sur cette machine, une comparaison, puis l'installation."),
    motsCles: ["entrainer", "entrainement", "fine-tuning", "affiner", "exemples", "qwen", "mlx", "nvidia", "lm studio", "apprendre"],
    lien: "/parametres/entrainement",
    corps: t("Réglages, Entraîner un modèle. Vous donnez des exemples (une question, la bonne réponse), la machine entraîne un petit modèle ouvert (Qwen3, sous licence Apache 2.0), vous comparez, puis vous l'installez : il apparaît dans le sélecteur de modèles. L'entraînement se fait sur cette machine ; seuls le moteur et le modèle de départ se téléchargent.\n\nLes machines qui conviennent :\n- un Mac à puce Apple, avec macOS 14 ou plus récent ; le modèle de départ dépend de la mémoire (0.6B dès 8 Go, 1.7B dès 16 Go, 4B dès 32 Go) ;\n- un PC Windows ou Linux avec une carte NVIDIA d'au moins 6 Go (1.7B, ou 4B dès 12 Go).\nUn Mac Intel, ou un PC sans carte NVIDIA, ne convient pas : la page le dit.\n\nLes étapes :\n- « Installer le moteur d'entraînement », une fois : la page dit la taille à télécharger et la place prise sur le disque. « Retirer le moteur » la rend.\n- Créez un modèle, puis « 1. Exemples » : « Ajouter un exemple », « Importer un CSV ou un JSONL » (question, puis réponse), ou « Tirer des exemples d'un document » (PDF, Word, texte, PowerPoint, Excel) : un modèle de cette machine le lit et propose des exemples, que vous relisez avant de les garder. Il en faut 10 au moins ; la page en conseille une cinquantaine.\n- « 2. Entraîner » : la page estime la durée (par exemple, environ 2 minutes pour 30 exemples sur un Mac de 16 Go). À partir de 20 exemples, quelques-uns sont mis de côté pour vérifier. « Arrêter » ne garde rien.\n- « 3. Comparer » : vos questions, et les exemples mis de côté, posées au modèle avant et après l'entraînement, côte à côte.\n- « 4. Installer » : « Installer dans LM Studio » range le modèle avec les autres. Il est alors visible de toute l'équipe de l'instance. « Retirer de LM Studio » le retire.\n\nUn seul entraînement tourne à la fois sur la machine, et chacun ne voit que ses propres modèles en préparation."),
  },
  {
    // Réglages, Contrôle de l'écran (29/09/2026) : ActivationEcran.tsx, gateway/src/reglagesEcran.ts, machine.ts, machineMacos.ts, computer.ts.
    id: "ecran",
    titre: t("Contrôle de l'écran : laisser l'agent cliquer"),
    resume: t("Une machine à part où Cowork clique et tape, ou votre propre écran, sous votre accord."),
    motsCles: ["ecran", "controle", "souris", "clavier", "cliquer", "machine virtuelle", "docker", "linux", "mac virtuel", "capture", "accessibilite"],
    lien: "/parametres/ecran",
    corps: t("Réglages, Contrôle de l'écran permet à Cowork de voir un écran, de déplacer la souris et de taper au clavier. C'est désactivé par défaut : l'agent travaille alors sur vos fichiers, sans voir ni piloter aucun écran.\n\nDeux façons, au choix :\n- « Machine de l'agent (recommandé) » : un ordinateur à part, où une erreur reste enfermée. « Bureau Linux » : Firefox et LibreOffice, dans Docker ; environ 2 Go à télécharger la première fois ; il faut Docker, 12 Go de mémoire et 12 Go libres sur le disque. « Mac virtuel » : Safari et LibreOffice ; il faut un Mac à puce Apple avec 32 Go de mémoire, macOS 15.3 ou plus récent et 60 Go libres ; environ 23 Go à télécharger, souvent plus d'une heure. Cette machine n'est joignable que depuis ce poste, et n'a accès à aucun de vos fichiers, sauf le dossier d'échange où arrivent les documents qu'elle rend. Elle s'arrête quand vous désactivez ou fermez l'application ; « Effacer la machine » libère la place.\n- « Cet écran », sur Mac seulement : l'agent pilote votre propre souris et votre clavier. macOS demande deux autorisations, que la page nomme : Enregistrement de l'écran, puis Accessibilité (Réglages Système, Confidentialité et sécurité) ; relancez ensuite l'application.\n\nActiver demande votre mot de passe, et votre code si la double authentification est active ; seul l'administrateur de l'instance peut le faire, tout le monde peut désactiver. Sur une instance partagée ou ouverte au réseau, ce réglage se fait dans le profil de déploiement, et la page le dit.\n\nIl faut aussi un modèle qui sait lire une capture d'écran : la page propose de l'installer, avec sa taille. « Tester la capture » montre ce que l'agent voit ; « Dernières actions » liste ce qu'il a fait.\n\nVoir l'écran et déplacer la souris ne demandent rien ; tout autre geste demande votre accord : un par action sur votre propre écran, un pour toute la demande en cours sur la machine de l'agent. Au niveau « Demander pour tout », chaque action est redemandée, capture comprise. Ces agents se trompent souvent de cible : relisez ce qu'ils ont fait."),
  },
  {
    // Réglages, API développeur (29/09/2026) : src/components/settings/ClesApi.tsx, gateway/src/clesApi.ts (ADR-055).
    id: "api",
    titre: t("API développeur : des clés pour vos programmes"),
    resume: t("Brancher un script ou un logiciel sur les modèles de l'instance, en votre nom."),
    motsCles: ["api", "cle", "cle d'api", "developpeur", "openai", "script", "programme", "hlx", "curl", "python"],
    lien: "/parametres/api",
    corps: t("Réglages, API développeur. Une clé permet à un programme (un script, un tableur, un logiciel compatible avec l'API d'OpenAI) de parler aux modèles de l'instance, en votre nom, et rien de plus.\n\n- « Créer une clé » : un nom, une expiration (30 jours, 90 jours, 1 an ou sans expiration), votre mot de passe, et votre code si la double authentification est active.\n- La clé commence par hlx_ et ne s'affiche qu'une fois : copiez-la tout de suite. L'instance n'en garde qu'une empreinte.\n- La liste montre chaque clé par sa fin, avec sa date de création, sa dernière utilisation et son expiration. « Renommer », ou « Révoquer » : les programmes qui s'en servent sont refusés dès maintenant.\n- Chacun a ses propres clés, 20 au plus, et ne voit que les siennes.\n\nCe qu'une clé permet : lister les modèles (GET /v1/models) et leur écrire (POST /v1/chat/completions), avec vos bases de connaissances si vous les nommez dans le champ connaissances. La page donne l'adresse de base, des exemples en curl et en Python prêts à copier, et les identifiants de vos bases.\n\nCe qu'elle ne permet pas : lire vos Chats, fichiers, agents ou réglages, lancer Code, faire exécuter les outils ou les connecteurs de l'instance, créer une autre clé. Elle se passe dans l'en-tête Authorization, jamais dans l'adresse. 60 requêtes par minute et par clé ; chaque appel est inscrit au journal, sans son contenu."),
  },
  {
    // Réglages, Installer les apps (29/09/2026) : TelechargerApps.tsx, gateway/src/telechargement.ts.
    id: "installer-apps",
    titre: t("Installer l'application sur un autre poste"),
    resume: t("L'application de bureau servie par votre instance, dans sa version exacte."),
    motsCles: ["installer", "application", "bureau", "desktop", "mac", "windows", "linux", "telecharger", "poste", "collegue", "mobile"],
    lien: "/parametres/apps",
    corps: t("Réglages, Installer les apps, onglet Desktop : l'instance sert l'application de bureau qu'elle fait tourner, dans sa version exacte. Un collègue installe ainsi la même que la vôtre, sans passer par Internet.\n\n- Seule l'application Mac est servie, et seulement par une instance qui tourne elle-même dans l'application installée sur un Mac. Pour Windows et Linux, installez le paquet fourni par votre prestataire : l'écran le dit.\n- « Télécharger » : le fichier arrive dans Téléchargements, par votre navigateur.\n- Au premier lancement : ouvrez le .zip, glissez l'application dans le dossier Applications, puis faites un clic droit sur l'application, « Ouvrir », et confirmez. Ce geste n'est demandé qu'une fois, tant que l'application n'est pas signée par Apple.\n\nUne fois l'application installée, rattachez le poste à l'instance (voir « Travailler avec quelqu'un d'autre »). L'onglet CLI met en place la ligne de commande (voir « La ligne de commande »). Il n'y a pas d'application mobile. L'extension VS Code s'installe à part (voir « L'extension VS Code »)."),
  },
  {
    // Réglages, Abonnement (29/09/2026) : src/components/settings/Abonnement.tsx, src/config/offre.ts. Sans prix : ils vivent dans offre.ts et changent.
    id: "abonnement",
    titre: t("Abonnement : les modèles hébergés en Europe"),
    resume: t("Ce que la page présente, et ce qu'elle ne fait pas : rien ne s'y paie."),
    motsCles: ["abonnement", "formule", "prix", "offre", "heberge", "europe", "credit", "jetons", "devis", "entreprise"],
    lien: "/parametres/abonnement",
    module: "abonnement",
    corps: tf("Réglages, Abonnement présente l'offre d'hébergement de modèles de {0}. Le logiciel est gratuit : ce qui se paierait, c'est le calcul des modèles hébergés.\n\nLa page montre :\n- des modèles à poids ouverts, hébergés en Europe : polyvalent et rapide. Chaque formule donne un crédit de calcul par mois, que chaque modèle consomme à son tarif, sur ce qu'il lit et sur ce qu'il écrit ;\n- les formules, en mensuel ou en annuel : pour les particuliers (Découverte, Plus, Pro, Max) et pour les entreprises (Équipe et Équipe Premium, par poste ; Entreprise, sur devis) ;\n- pour chacune, les jetons par modèle et leur équivalent approximatif en échanges de Chat par jour ou en tâches par mois, et, en mensuel, le prix de lancement des premiers mois ;\n- ce que comprend chaque formule : la plateforme entière, modèles de la machine compris.\n\nCe que la page ne fait pas : ces formules ne sont pas ouvertes. Aucun paiement n'est possible depuis cet écran, et les prix sont une proposition, qui peut changer. « Écrire pour être prévenu » et « Demander un devis » ouvrent un mail dans votre messagerie, adressé au support : rien ne part sans vous.\n\nSans abonnement, rien ne change : les modèles de votre machine, et ceux que vous branchez avec votre propre clé, restent à votre disposition.", branding.name),
  },
  {
    id: "importer",
    titre: t("Reprendre ses Chats d'une autre IA"),
    resume: t("ChatGPT, Claude, Gemini, et les logiciels d'IA de ce poste."),
    motsCles: ["importer", "import", "chatgpt", "claude", "gemini", "google", "takeout", "export", "historique", "reprendre", "codex", "cursor"],
    lien: "/parametres/importer",
    corps: tf(`Réglages, « Importer depuis d'autres IA ». L'export est lu sur ce poste : rien ne part ailleurs que dans votre instance. Vous choisissez ensuite les Chats à garder ; un Chat déjà importé n'est pas importé une seconde fois.

- ChatGPT : Paramètres, Contrôle des données, Exporter les données. Choisissez l'archive ZIP reçue par mail.
- Claude : Paramètres, Confidentialité, Exporter les données. Les projets reviennent avec leurs documents et leurs instructions.
- Gemini : sur Google Takeout, cochez seulement « Mes activités », puis, dans « Toutes les données d'activité sont incluses », seulement « Applications Gemini ». Le format JSON (bouton « Plusieurs formats ») est conseillé, le HTML se lit aussi. Choisissez l'archive ZIP telle quelle, ou le fichier MyActivity.json qu'elle contient.

Ce qu'il faut savoir sur Gemini : Google n'exporte pas des conversations, mais un journal de vos questions, avec la réponse et la date. {0} regroupe les questions d'une même conversation d'après le lien que Google range avec chacune, ou, sans lien, les questions posées à moins de 30 minutes d'écart, et l'écran le dit. L'export n'a pas de titres : chaque Chat prend sa première question. Les images, les fichiers joints et les Gems ne sont pas repris.

Sur l'application de bureau, Claude Code, Codex et Cursor installés sur ce poste se reprennent sans export, depuis la même page.`, branding.name),
  },
  {
    id: "langue",
    titre: t("Changer la langue"),
    resume: t("Français, anglais, chinois, japonais, espagnol, allemand, arabe."),
    motsCles: ["langue", "anglais", "chinois", "japonais", "espagnol", "allemand", "arabe", "english", "japanese", "spanish", "german", "arabic", "traduction", "language", "中文", "日本語", "español", "deutsch", "العربية", "droite à gauche"],
    lien: "/parametres/preferences",
    corps: t(`L'interface se lit en français, en anglais, en chinois, en japonais, en espagnol, en allemand ou en arabe. Le choix se fait dans Réglages, Préférences, rubrique Langue.

- Le choix vaut pour ce poste, pas pour toute l'instance : chacun peut lire dans sa langue, sur la même instance.
- La page se recharge aussitôt, pour que tout l'écran change d'un coup plutôt qu'à moitié.
- Sans choix de votre part, la langue de votre système est suivie, si elle est servie.
- En arabe, l'écran se lit de droite à gauche : la barre latérale passe à droite, et le code, les adresses et les chemins restent de gauche à droite.

Ce qui n'est jamais traduit : ce que vous écrivez. Vos chats, vos documents, vos procédures et les réponses des modèles restent tels quels. Certains messages venus de l'instance peuvent aussi rester en français.`),
  },
  {
    id: "competences",
    titre: t("Apprendre vos manières de faire"),
    resume: t("Écrire une procédure une fois, pour ne plus la répéter."),
    motsCles: [
      "competence",
      "procedure",
      "methode",
      "modele de document",
      "instruction",
      "apprendre",
      "habitude",
      "cowork",
    ],
    lien: "/cowork",
    corps: tf("Une compétence est une manière de faire, écrite en français, que {0} applique quand la situation s'y prête. Par exemple : comment rédiger un compte rendu chez vous, quelles mentions porte un devis, dans quel ordre facturer.\n\nElle se crée dans Cowork, panneau de droite, carte « Procédures », bouton « Créer une compétence ». Trois champs, et pas un de plus :\n\n- le nom, pour la retrouver ;\n- quand s'en servir : c'est la seule phrase que le modèle lit pour décider s'il l'applique, alors décrivez la situation, pas la méthode ;\n- la procédure : les étapes dans l'ordre, et ce qu'il ne faut surtout pas faire. Écrivez-la comme à un nouveau collègue.\n\nCe qu'il faut savoir :\n\n- une compétence ne donne aucun pouvoir nouveau : elle dit comment se servir de ceux qui existent déjà. Pour brancher un nouveau service, ce sont les Connecteurs ;\n- elle s'applique dans Cowork, dans le Chat et aux tâches exécutées par un agent ;\n- l'interrupteur la met de côté sans l'effacer ;\n- « Toute l'organisation » la rend lisible par vos collègues, qui ne peuvent pas la modifier ;\n- les consignes repartent à chaque message : la ligne sous la liste dit combien de caractères sont envoyés. Au-delà d'une douzaine de procédures, les dernières ne partent plus, et l'écran le dit plutôt que de les couper en deux.", branding.name),
  },
  {
    id: "travailler-ensemble",
    titre: t("Travailler avec quelqu'un d'autre"),
    resume: t("Inviter un collègue, et par quel chemin il vous rejoint."),
    motsCles: [
      "inviter",
      "collegue",
      "partager",
      "equipe",
      "reseau",
      "wifi",
      "vpn",
      "instance",
      "rejoindre",
      "code",
      "lien",
    ],
    lien: "/parametres/profil",
    corps: tf("Une instance {0}, c'est une machine qui répond. Inviter quelqu'un, c'est lui donner le moyen de lui parler.\n\nDeux gestes, dans cet ordre :\n\n- Ouvrez votre instance. Réglages, Profil, « Ouvrir l'instance à mes collègues ». Tant qu'elle est fermée, elle ne répond qu'à votre machine. En l'ouvrant, elle se met à chiffrer ses échanges et affiche les adresses par lesquelles on peut la joindre.\n- Invitez la personne par son adresse email. Elle reçoit un lien : un clic, et son poste se rattache. Sans lien cliquable, l'adresse et le code du mail se saisissent à la main, ou se collent ensemble dans le premier champ.\n\nPar où elle vous rejoint dépend d'où elle se trouve :\n\n- Même réseau. Même Wi-Fi, même bureau, même câble : rien à régler, l'adresse suffit. C'est le cas courant.\n- Ailleurs. Il faut alors un lien privé entre vos deux réseaux : le VPN de votre entreprise, ou un réseau privé monté entre vos machines. {1} le détecte tout seul et affiche l'adresse correspondante. N'ouvrez pas de port sur votre box pour aller plus vite : vous exposeriez votre poste à tout Internet, sans rien y gagner.\n- À toute heure. Votre poste éteint, votre instance ne répond plus : c'est elle qui fait tourner les modèles. Pour une équipe qui travaille en continu, installez l'instance sur une machine qui ne s'éteint pas.\n\nCe que le code d'invitation vaut : sept jours, un seul usage, une seule adresse email. La personne choisit son propre mot de passe, que vous ne connaîtrez jamais. Vous pouvez annuler une invitation tant qu'elle n'a pas servi. Quand le mail part, le code n'est affiché qu'à la personne invitée, dans sa boîte : c'est ce qui prouve qu'elle lit bien cette adresse.\n\nL'administrateur peut aussi créer un compte directement. Le mot de passe qu'il choisit est provisoire : à sa première connexion, la personne en choisit un à elle, et l'ancien ne sert plus.\n\nLe premier rattachement affichera un avertissement sur le certificat : votre instance signe le sien elle-même, aucune autorité extérieure ne le connaît. On accepte une fois, et l'application refusera ensuite tout certificat différent.", branding.name, branding.name),
  },
  {
    id: "probleme",
    titre: t("Quelque chose ne marche pas"),
    resume: t("Les vérifications à faire avant de demander de l'aide."),
    motsCles: ["probleme", "bug", "erreur", "panne", "support", "aide", "lent", "bloque"],
    corps: t("Dans l'ordre :\n\n- Vérifiez l'état de l'instance : Réglages, puis le bandeau en haut de l'écran. Hors ligne, les chats restent lisibles mais aucune réponse ne peut être générée.\n- Un modèle local très lent est normal sur une longue demande : le plan affiché avance étape par étape, même si aucun texte n'apparaît.\n- Une action « en attente » vient presque toujours d'une carte d'accord non répondue : regardez la cloche de notifications.\n- Après une mise à jour, redémarrez l'application une fois.\n\nSi le problème persiste, le bouton « Copier les informations techniques » de cette fenêtre rassemble la version, l'adresse de l'instance et votre système. Joignez-le à votre message : c'est ce qu'on vous demandera.\n\nPour le signaler, « Signaler un problème », plus bas dans cette fenêtre ou en dernier dans les Réglages, prépare le message pour vous. Décrivez ce qui ne va pas (le seul champ obligatoire), ce que vous faisiez et ce que vous attendiez. La case « Joindre les informations techniques » ajoute la version, le système et le modèle choisi ; ni vos messages, ni vos documents, ni aucune clé, ni l'adresse d'une instance d'entreprise. L'écran montre le texte exact avant l'envoi. Puis, au choix :\n- « Ouvrir sur GitHub », quand l'écran le propose, ouvre un ticket prérempli dans votre navigateur. Il faut un compte GitHub, et le ticket est public : n'y mettez rien de privé.\n- « Envoyer par mail » ouvre un mail prérempli dans votre messagerie, adressé au support, qui part de votre adresse.\n\nRien ne part en arrière-plan : c'est vous qui relisez et envoyez."),
  },
];

/** Articles de l'édition livrée : un module absent n'a pas d'article. */
export const articles = (): Article[] =>
  ARTICLES.filter((a) => !a.module || features[a.module]);

/** Recherche simple, insensible aux accents et à la casse. */
export function chercherArticles(terme: string): Article[] {
  const t = plier(terme.trim());
  if (!t) return articles();
  return articles().filter((a) =>
    [a.titre, a.resume, a.corps, ...a.motsCles].some((champ) => plier(champ).includes(t)),
  );
}

/** « Réunion » et « reunion » doivent se trouver l'un l'autre. */
const plier = (s: string): string =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
