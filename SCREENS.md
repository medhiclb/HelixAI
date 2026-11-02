# Inventaire des écrans

État au 04/09/2026, tenu à jour depuis ; relu le 28/09/2026 (2026.928.1). Ce document
liste les écrans **réellement livrés**, route par route, et dit pour chacun **ce qui
fonctionne et ce qui est une maquette**.

Il remplace l'inventaire de cadrage rédigé en juillet 2026 à partir des 45
captures de référence (`screenshots/`, gardées sur le poste de Medhi et hors du dépôt depuis le 25/09/2026 : elles montrent un autre produit). Cet inventaire décrivait ce qu'il fallait
construire ; celui-ci décrit ce qui existe.

**Comment lire.** « Maquette » signifie : l'écran s'affiche, il est complet et
soigné, mais il n'y a **aucune logique de données derrière**. Les valeurs sont
écrites dans le composant, et les boutons ne déclenchent rien. Ce n'est pas un
défaut de finition, c'est une absence de moteur.

Source de vérité des routes : `src/App.tsx`. Source des entrées de navigation :
`src/lib/nav.ts`.

---

## 1. Vocabulaire

Le vocabulaire appliqué dans l'interface livrée, à ne pas confondre avec celui
des captures d'origine :

| Terme retenu | Terme abandonné | Où |
|---|---|---|
| **Chat**, **Nouveau Chat** | « Discussion », « Nouvelle discussion » | `src/lib/nav.ts` |
| **Agent** | « Assistant » | partout |
| **Catalogue** | « Officiel » | partout |
| **Majordome** | « Agent par Défaut » | `src/lib/store/agents.ts` |

Aucun tiret cadratin dans les textes affichés. Interface entièrement en
français, accents corrects.

---

## 2. Vue d'ensemble

Toutes les routes déclarées dans `src/App.tsx`, dans l'ordre du fichier.

| Route | Écran | Module | État |
|---|---|---|---|
| `/` | Chat | toujours | ✅ **fonctionne** |
| `/cowork` | Cowork | `cowork` | ✅ **fonctionne** |
| `/code` | Code (BETA) | `code` | ✅ **fonctionne**, moteur externe requis |
| `/projets` | Projets | `projets` | ✅ **fonctionne** |
| `/agents` | Agents | `agents` | ✅ **fonctionne** |
| `/bibliotheque` | Bibliothèque | `bibliotheque` | ✅ **fonctionne** (0.16.0) |
| `/reunions` | Réunions | `reunions` | ✅ **fonctionne** (0.16.0), bot dans l'application de bureau |
| `/groupes` | Groupes | `groupes` | ✅ **fonctionne** (0.16.0) |
| `/taches` | Tâches | `taches` | ✅ **fonctionne** |
| `/modeles` | Modèles (28/09/2026), ouverte depuis le sélecteur de modèles | toujours | ✅ **vu dans le navigateur** (passerelle jetable, faux `lms`), voir § 3 |
| `/parametres/*` | Réglages, 12 sous-pages | toujours | mixte, voir § 5 |
| `*` | repli sur l'accueil | | |

Deux écrans vivent **hors du routeur**, parce qu'ils précèdent tout le reste
(`src/App.tsx`) :

| Écran | Fichier | Quand | État |
|---|---|---|---|
| Rattachement du poste | `src/pages/InstanceSetupPage.tsx` | tant qu'aucune adresse d'instance n'est retenue sur ce poste (`isConfigured`), et sauf si `VITE_GATEWAY_URL` en impose une à la construction | ✅ fonctionne |
| Connexion | `src/pages/LoginPage.tsx` | tant que personne n'est connecté | ✅ fonctionne |

**Éditions.** Chaque route secondaire est conditionnée par un module
(`src/config/branding.ts`, `features`). L'édition `chat` désactive Cowork et
Code ; l'édition `complete` active tout. Les entrées de navigation **et** les
routes suivent le même drapeau : un module désactivé n'est ni affiché ni
atteignable par l'URL.

Bibliothèque, Réunions et Groupes sont actifs dans les deux éditions. Pour livrer
une instance sans eux, poser
`featureOverrides: { bibliotheque: false, reunions: false, groupes: false }`
dans `src/config/branding.ts`.

---

## 3. Écrans qui fonctionnent

### `/` Chat

`src/pages/HomePage.tsx`. Captures 1 à 5.

Ce qui fonctionne : conversation en streaming via la passerelle (`useChat`),
canal de raisonnement des modèles qui en émettent un, sélecteur de modèle
alimenté par le catalogue réel de la passerelle (`useModels`), pièces jointes
lues sur le poste (`useAttachments`), historique des conversations persisté,
partage d'une conversation (`ShareSessionModal`), sélecteurs de projet et
d'agent alimentés par les données réelles (`ContextSelectors`, `useProjects`,
`useAgents`). Le message système est reconstruit à chaque conversation depuis le
profil privé de l'utilisateur (`buildSystemPrompt`).

**Modèle qui répond mal sur cette machine (27/09/2026)** : dans le sélecteur, sous le nom,
une ligne en couleur d'avertissement, « répond mal sur cette machine » (essai raté ou deux
réponses coupées en boucle) ou « une réponse en boucle ici » (une coupure) ; le détail, avec
la raison et la date, au survol. Un tel modèle reste choisissable, mais n'est plus retenu
par « Auto », « Rapide » ni « Approfondi ». Dans le fil, le message de coupure dit en plus
« Si cela se reproduit, … ne sera plus choisi d'office sur cette machine. », puis, à la
deuxième, quel modèle répondra ensuite en « Auto ». **Pas vu à l'écran** (typecheck et
batterie seulement).

**Pièces jointes lues par tout modèle (27/09/2026)** : le composeur montre « Lecture de … »
et n'envoie qu'une fois les fichiers lus. Dans le message envoyé, une carte par fichier
(`PiecesJointesMessage.tsx`) : icône du type, nom, poids, « lu en entier », « début
seulement » (l'infobulle dit pourquoi et renvoie à Fichiers) ou « image » ; les cartes
restent avec le Chat rouvert. Quand un document ne tient pas dans la place du modèle, la
réponse l'annonce en tête (« … a été lu en 5 parties, et la réponse s'appuie sur les notes
prises sur chacune », ou « seules les 24 premières… ») et le fil suit la lecture (« Lecture
de « … » : partie 2 sur 5... »). Un Chat long dont les premiers messages n'ont pas été relus
le dit aussi en tête de la réponse. Vu dans le navigateur contre une instance jetable et un
faux modèle (cartes, CSV en UTF-16, lecture en 5 parties) ; pas avec un vrai modèle.

**File d'attente du composeur (29/09/2026)** (`FileAttente.tsx`, `lib/fileAttente.ts`, aussi
dans Cowork) : pendant une réponse, la zone de saisie reste utilisable. En bas à droite, deux
boutons ronds : « Arrêter » (carré, en retrait, bordé) puis, à la place habituelle de l'envoi,
**« Mettre en file »** (icône de liste avec un « + », infobulle « votre message partira quand la
réponse en cours sera finie »). Entrée met aussi en file. Au-dessus des pastilles, dans la carte
du composeur, un cadre : « 2 messages en attente » (horloge), « Ils partiront l'un après
l'autre… », puis la liste numérotée (texte sur deux lignes au plus, pièces jointes ou « Image à
créer » en dessous), chacun avec **« Modifier »** (le texte devient un champ ; Entrée ou
« Enregistrer », Échap ou « Annuler ») et **« Retirer »** ; dans un champ étroit (375 px),
ces deux boutons n'ont plus que leur icône. La liste défile au-delà de 30 % de la hauteur.
Après une erreur ou « Arrêter », l'icône devient une pause, la ligne dit « En pause : la
réponse… Rien ne part tout seul. » et un bouton **« Envoyer maintenant »** (« Reprendre » si
une autre réponse s'écrit déjà) relance la file. Au-delà de dix, une ligne rouge dit que la
file est pleine et le texte reste dans le champ. Une file par Chat, gardée en changeant de
Chat ou de page, perdue au rechargement. Vu dans le navigateur (instance jetable, faux modèle
de 10 s par réponse) : envoi pendant une réponse, départs l'un après l'autre (y compris
pendant qu'un autre Chat ou la page Agents était affiché), arrêt puis pause, modification
puis « Envoyer maintenant », panne simulée puis pause, file pleine à 375 px.

**Bulle d'erreur (29/09/2026)** : une réponse en échec se termine par un cadre d'alerte
(`role="alert"`, icône d'avertissement, `MessageList.tsx`) qui porte le message. Un refus
long d'un fournisseur cloud y arrive abrégé par la passerelle (`abreger`,
`gateway/src/modelesCloud.ts`) : la clé masquée qu'OpenAI renvoie (« sk-proj-****… », une
centaine d'étoiles) devient « … », et la coupe, à 240 caractères, tombe entre deux mots au lieu
du milieu d'une adresse. Le texte passe à la ligne n'importe où (`overflow-wrap: anywhere`,
pour tout `[role="alert"]` dans `src/styles/index.css`, donc aussi les `InfoBox` d'alerte) :
avant, la clé sans espace sortait de la bulle. Défaut vu le 29/09/2026 sur un refus d'OpenAI
(commentaires d'`abreger` et de `MessageList.tsx`).

**Durées (27/09/2026)** : « Réflexion : 12 s » sur le bloc de raisonnement, la durée de
chaque étape d'outil, et sous la réponse « Réponse en 1 min 04 s · premier mot après 3 s »,
gardées avec le Chat.

**Comparer intelligence et prix** (bas du sélecteur de modèles, `ComparerModeles.tsx`,
27/09/2026) : fenêtre « Comparer les modèles », nuage de points note ECI d'Epoch AI face au
prix de sortie publié par l'éditeur (échelle logarithmique), ou tableau. Tous les modèles
de la personne y figurent : un point, la bande « Sur votre machine » (sans frais d'API), la
bande « Cloud, prix non relevé », ou la liste « Pas de note publiée par Epoch AI pour : ».
Sous le graphique, la source, sa licence (CC BY 4.0), le lien et la date des relevés.

**Installer un modèle, et la page `/modeles` (28/09/2026)** : le sous-menu « Installer un
modèle » du sélecteur garde sa courte liste (les trois mieux notés qui tiennent, puis le
meilleur de chaque autre éditeur, et les modèles d'écran), avec en tête « Voir tous les
modèles » ; sans rien à y proposer, le même lien est sous les modèles de la machine. La page
`src/pages/ModelesPage.tsx` lit tout le catalogue (`modeles` de `GET /helix/provision`,
`catalogueComplet` dans `gateway/src/provision.ts`) : la machine en une ligne (mémoire, puce
Apple, carte NVIDIA ou non), onglets Converser et Piloter l'écran, recherche (nom, éditeur,
pays), éditeur, tri (note, plus légers, plus lourds), filtres (lit les images, raisonne, rapide
sans carte graphique), une fiche par modèle (éditeur et pays, licence, taille, note ECI ou
« sans note publiée », capacités, « Recommandé », « Installé »). Ceux qui tiennent d'abord,
avec « Installer » (même route que le sélecteur, progression sur la fiche et en tête de page) ;
les autres grisés, sans bouton, avec la raison chiffrée (« demande environ 25,6 Go de mémoire,
cette machine en a 16 »), et la passerelle les refuse aussi (409). Mac Intel : les seuls
modèles GGUF épinglés du moteur ouvert, sans onglet d'écran. Vu dans le navigateur le
28/09/2026 (fr et en, 1280 et 375 px) contre une passerelle jetable, un faux `lms` et un faux
serveur à la place de LM Studio : filtres, recherche « france », installation de Qwen3 1.7B
suivie jusqu'à « Installé », refus de gpt-oss 120B par la route, mode llama.cpp. Pas essayé : un vrai
téléchargement par LM Studio, et les modèles ajoutés ce jour-là chargés avec Helix.

Ce qui reste fictif sur cet écran :

- les **suggestions** de l'état vide (`src/data/mock/suggestions.ts`) ;
- les **libellés de comportement** Auto / Rapide / Approfondi
  (`behaviors` dans `src/data/mock/models.ts`). Le niveau choisi est bien
  transmis à la passerelle sous forme d'`effort`, mais les textes descriptifs
  sont écrits en dur ;
- (corrigé : le micro fonctionne depuis longtemps, dictée Whisper sur la machine.)

⚠ La liste de modèles de la capture 5 (Qwen 3.5 397B, Claude, Mistral…) n'est
plus utilisée : `models` dans `src/data/mock/models.ts` est du code mort. Le
sélecteur affiche les modèles réellement servis par la passerelle.

Ajouté le 27/09/2026 : **« Créer une vidéo »** dans le même menu, avec la même pastille
(« Vidéo · modèle × », paysage ou portrait) : le modèle selon la machine, la taille à
télécharger, la vidéo lue dans le Chat avec « Télécharger ». Mesuré sur un Mac de 16 Go :
environ 11 minutes pour deux secondes.

Ajouté le 24/09/2026 : le **« + »** du composeur ouvre un menu (« Ajouter des
photos et fichiers », « Créer une image ») ; « Créer une image » pose une
pastille **« Image · modèle × »** dont le menu règle le format (carré,
portrait, paysage) et le modèle (conseillé en premier, taille à télécharger,
« pas encore vérifié avec Helix » quand c'est le cas, installation suivie en
direct). L'image apparaît dans le Chat avec « Télécharger ». Depuis le
25/09/2026, elle est visible aussi de qui voit le Chat partagé où elle a été
créée.

Ajouté le 25/09/2026 : la pastille **« Connaissances »** de la zone de saisie
(`ConnaissancesChip.tsx`, aussi dans Cowork) ouvre la liste des bases de
connaissances à cocher (nombre de passages, « Indexation en cours »), avec
« Gérer les bases de connaissances » ; son libellé devient le nom de la base, ou
« {0} bases ». Le choix est gardé avec le Chat. Sous la réponse, **« Sources »** :
les passages que la réponse cite par leur numéro [n], mis en avant ; les autres,
repliés, « non cités ». Les bases de l'agent choisi ou du projet où le Chat est rangé
sont consultées aussi (« Par l'agent… », « Par le projet… »). Une base qu'on ne voit
pas est dite « ignorée », un document indexé par un autre modèle est signalé.
**Essayé dans l'interface le 25/09/2026** : un Chat avec une base de deux documents a
répondu juste, les deux sources citées sous la réponse.

### `/cowork` Cowork

`src/pages/CoworkPage.tsx`. Captures 6 à 8.

Ce qui fonctionne : boucle d'outils fichiers via MCP, avec trace des appels dans
la conversation ; choix du dossier de travail (`DossierTravailChip`, validé côté
instance) ; contrôle de l'écran sous approbation (`ScreenAccessChip`,
`ScreenApproval`) ; panneau droit alimenté par l'état réel des serveurs MCP
(`CoworkPanel`, `useMcp`) : fichiers touchés, compétences (les outils réellement
exposés), connecteurs (les serveurs réellement lancés) ; carte **Préparer
Cowork** (`PreparerCowork`), qui diagnostique l'atelier bureautique, annonce ce
qui sera installé, puis installe et vérifie.

**Niveau d'approbation** (`ApprovalSelector`, `src/components/chat/CoworkSelectors.tsx`) :
depuis le 26/09/2026 dans la barre du bas de la zone de saisie, à côté du « + », comme sur
Claude, et aussi dans Code. Trois niveaux réels, tenus par l'instance : « Tout approuver »
(avec le risque dit : un texte piégé lu par l'agent peut le faire agir sans carte),
« Demander avant de modifier », « Demander pour tout ». Le menu s'ouvre vers le bas.
Seul l'administrateur change le niveau ; pour les autres, les options sont grisées et le
menu le dit. (La note d'avant, « affichage sans état », décrivait une version ancienne.)

### `/code` Code (BETA)

`src/pages/CodePage.tsx`. Capture 9.

Ce qui fonctionne : sessions OpenCode, choix du dossier de projet, envoi de
consignes, interruption, flux d'évènements relayé par la passerelle (`useCode`).

**Sessions de Code, séparées des Chats** (25/09/2026, `src/components/code/SessionsCode.tsx`,
`useSessionsCode`, registre `gateway/src/sessionsCode.ts`). En mode Code, la barre
latérale montre « Sessions de Code » à la place des Chats, rangées par dossier de
projet (titre = début de la première demande, date ou heure), avec « Nouvelle
session » au lieu de « Nouveau Chat » et « Rechercher une session... » ; une croix
au survol retire une session de la liste (sa conversation reste chez OpenCode). Les
Chats ne montrent rien de Code, et inversement. L'adresse dit ce qui est affiché :
`/code` est l'accueil (sélecteur de dossier, saisie ; « Sessions récentes » retiré le
27/09/2026, les sessions restent dans la barre latérale), `/code?s=<id>`
une session, dont l'historique est relu chez OpenCode ; ouvrir Code ne reprend plus
la dernière session. Revenir à l'accueil n'arrête pas une session qui travaille :
rouverte, elle reprend son flux là où l'instance l'a vu, dans la même bulle. Vu dans
le navigateur le 25/09/2026 (instance jetable, deux dossiers, une session rouverte
après redémarrage de la passerelle, une autre rouverte pendant que l'agent écrivait) ;
pas vu dans l'application de bureau.

**Quitter une session qui travaille** (27/09/2026, `useCode`, `SessionsCode.tsx`) : passer
à une autre session, à « Nouvelle session » ou au Chat n'arrête rien et n'efface rien. La
conversation continue hors de l'écran ; rouverte depuis la liste, elle revient telle
quelle (message envoyé, réponse, étapes), la suite en direct. Revenir dans Code depuis une
autre page réaffiche la session qu'on regardait si elle travaille encore (sinon
l'accueil). Dans la liste, une roue discrète (« En cours ») remplace l'heure d'une session
où l'agent ou Helix travaille encore, y compris après un rechargement (l'instance le dit).
Seul « Arrêter » arrête l'agent. Vu dans le navigateur avec un faux OpenCode, pas dans
l'application de bureau.

**Panneau de suivi** (25/09/2026, `src/components/code/SuiviCode.tsx`) : à droite
dès qu'une conversation existe, ouvert d'office à partir de 1 024 px, par-dessus
l'écran en dessous (bouton « Afficher le suivi », croix pour le masquer). Cartes
repliables (`PanelCard`, désormais dans `components/ui`) : « En ce moment » (lecture
de la demande avec temps écoulé, barre de progression quand l'instance la connaît,
taille approximative ; attente de son tour ; chargement ; réflexion ; outil en cours
et sa cible ; sous-tâche et son action du moment ; « Terminé », « Arrêté à votre
demande. » ou « Interrompu »), « Tâches » (liste `todowrite` de l'agent), « Actions »
(chaque outil, sa durée, et pour une sous-tâche ses propres outils), « Fichiers »
(Lu, Modifié, Écrit), temps total. Le fil de la conversation dit aussi ce que fait
chaque outil (« Sous-tâche : … », « Écriture · index.html ») et, pendant la lecture,
« Le modèle lit la demande (33 s, 32 %, environ 9 000 jetons)... » au lieu de
l'annonce de panne. Vu dans le navigateur le 25/09/2026 (instance jetable, Qwen3 8B),
à 1 400 px et à 375 px ; pas vu dans l'application de bureau.

**OpenCode absent** : l'écran annonce que le moteur est absent. Depuis le 27/09/2026,
il n'y a plus de clic à faire : la passerelle pose OpenCode d'elle-même au démarrage et
après la mise en route du modèle, et l'écran, s'il trouve cette installation en cours,
en montre la progression. Sinon, pour un **administrateur**, il la lance d'office à
l'ouverture (1.18.32, empreinte vérifiée, environ 60 Mo, progression affichée). Le
bouton ne reste que pour « Réessayer » après un échec (hors ligne : l'erreur est dite
en clair), ou quand l'installation d'office n'a pas lieu (profil qui la réserve à
l'intégrateur, poste rattaché : « Installer OpenCode »). La commande manuelle reste en
rappel pour l'administrateur. Un **membre** lit que l'administrateur de l'instance doit
l'installer. Une fois posé, l'écran Code s'ouvre sans relancer l'application. OpenCode
n'est pas empaqueté dans l'installeur de Helix. **Pas vu à l'écran** (typecheck seul) :
l'enchaînement d'office, le texte du membre.

**Moteur : OpenCode ou Codex** (27/09/2026, `src/components/code/MoteurCode.tsx`,
`useCodex`, `src/lib/codex.ts` ; PROJET.md § 3.14). Pour le **seul propriétaire du
poste** (administrateur d'une installation de bureau non partagée ; la passerelle
le décide), une puce « OpenCode » / « Codex » sur la ligne du dossier, à côté du choix
du dossier (d'abord dans la barre de saisie, déplacée le 27/09/2026 : les libellés s'y
coupaient). Changer de moteur ouvre une conversation neuve. Le menu propose « OpenCode (modèles de …) », par
défaut, et « Codex (votre compte ChatGPT) », grisé tant que Codex n'est pas prêt ;
dessous, l'état : absent (commande officielle à copier, `npm install -g
@openai/codex`, et `brew install --cask codex` sur Mac ; Helix ne l'installe pas),
installé mais pas connecté (« Se connecter avec ChatGPT » : le navigateur s'ouvre
chez OpenAI, « Terminez la connexion dans votre navigateur… », « Annuler »),
connecté (par l'abonnement ChatGPT, ou par une clé d'API, dit tel quel). Au niveau
« Demander pour tout », Codex n'est pas proposé, et c'est écrit. Codex choisi : le
choix du modèle et du niveau de raisonnement disparaît de la saisie, et un encadré
sous la saisie dit que la demande et les fichiers lus partent chez OpenAI
(États-Unis), sous les limites de l'abonnement, hors des approbations de Helix, que
Helix ne borne pas ce que Codex lit, et ce que permet le bac à sable au niveau
actuel (lecture seule, ou écriture dans le projet sans réseau). Le fil et le
panneau de suivi sont les mêmes qu'avec OpenCode (message, raisonnement, commandes,
fichiers écrits ou modifiés, liste de tâches) ; le bouton d'arrêt arrête Codex. La
conversation continue (reprise de la session Codex) tant que l'écran reste ouvert ;
les sessions de Codex ne vont pas dans la barre latérale ; quitter l'écran arrête
une tâche en cours. Le choix du moteur est retenu sur le poste. Un membre, un poste
rattaché, une instance partagée ne voient pas la puce. Vu dans le navigateur le
27/09/2026 contre une passerelle jetable et un faux `codex` (choix du moteur, connexion) ;
pas avec le vrai programme, ni dans l'application de bureau.

### `/projets` Projets

`src/pages/ProjetsPage.tsx`. Captures 10 et 11.

Ce qui fonctionne : création, suppression, persistance dans l'instance,
invitation d'un membre par adresse email, révocation, onglets Tous / Récents /
Partagés, décompte des membres actifs et des invitations en attente. Une
invitation à une adresse encore inconnue reste en attente et se dénoue à la
création du compte correspondant. Chaque carte compte les chats rangés dans le
projet, la fiche les liste (« Votre chat » ou « Partagé avec vous ») et son
bouton « Nouveau Chat » en ouvre un déjà rangé dedans.

**Ranger un chat dans un projet** : sélecteur « Projet » du composer, pour un
chat neuf (appliqué à sa création) ou en cours, et « Retirer du projet ». C'est
un **classement personnel** : les membres du projet ne voient pas le chat, sauf
partage explicite, et le menu le dit. Seul le propriétaire d'un chat le range.

**Bases de connaissances d'un projet** (25/09/2026) : la fiche d'un projet a une
section « Bases de connaissances » (`ChoixBases.tsx`) : les Chats rangés dans ce
projet y cherchent avant de répondre, chaque membre n'y lisant que ce qu'il a le droit
de voir. Pas vu à l'écran lors de la vérification du 25/09.

### `/agents` Agents

`src/pages/AgentsPage.tsx`. Captures 12 à 14.

Ce qui fonctionne : création d'un agent (nom, description, prompt système,
visibilité personnelle ou organisation), persistance, onglets Tous /
Organisation / Personnels, et surtout **usage réel** : un agent créé ici est
sélectionnable dans le Chat et exécutable sur une tâche.

**Photo et instructions masquées** (27/09/2026) : un clic sur l'avatar d'une carte
(son propriétaire) choisit une photo, recadrée en 256 pixels, retirée par la petite croix ;
elle apparaît aussi dans le choix de l'agent du Chat et sur la fiche de l'employé. Pour un
agent partagé, « Masquer ses instructions » (à la création, ou sur la carte) : les autres
reçoivent l'agent sans elles, et l'instance les ajoute au Chat ; la carte le dit
(« instructions masquées »).

**Son modèle** (27/09/2026) : à la création, « Son modèle » propose un modèle selon le poste,
avec une ligne qui dit pourquoi (sait appeler des outils quand le poste en a, le plus léger
pour un poste court sans outils, le déjà chargé sinon ; jamais d'office un modèle de clé) ;
un modèle de clé se choisit à la main, et l'écran dit qui paie. Il vaut pour sa fiche, ses
missions et ses messageries, pas pour le Chat. La carte montre son nom en petit (« · cloud »
pour un modèle de clé), ou « Modèle indisponible » s'il a disparu ; la fiche le dit en tête,
avec la raison, et ses Réglages le changent (« (indisponible) », proposition, « Le prendre »).
Vu dans le navigateur sur une passerelle jetable et le vrai OpenClaw.

**Missions** (27/09/2026) : l'onglet Missions de la fiche d'un employé les ajoute et les
modifie directement (« Ajouter une mission », « Modifier les missions »), avec le même
choix que les tâches programmées : chaque jour, du lundi au vendredi, chaque semaine et son
jour, chaque mois (1 à 28, ou le dernier jour), chaque heure, et l'heure à la minute.
« À chaque mail reçu » n'est plus proposé ; une mission qui l'a le garde.

**Depuis 0.14.0, plus d'onglet Employés** : chaque agent créé est mis en service tout
seul, et sa carte ouvre la fiche décrite ci-dessous (état « En service », ou l'étape de
sa mise en service, dont l'installation d'OpenClaw la première fois).

**Sous Windows, les bibliothèques de Microsoft (29/09/2026)** (`gateway/src/visualCpp.ts`) : quand
les bibliothèques Visual C++ manquent ou sont trop anciennes, la mise en service commence par une
étape « Installation des bibliothèques de Microsoft (Visual C++)… », avec la progression du
téléchargement, pourquoi Windows va demander une autorisation d'administrateur, et « si la demande
n'apparaît pas, regardez la barre des tâches ». Refus, compte sans droits, installation déjà en
cours, redémarrage conseillé : chacun son message, avec la page officielle de Microsoft. Un OpenClaw
déjà installé sans ces bibliothèques : bandeau en haut de la page avec « Installer les bibliothèques
de Microsoft ».

**Retirer un agent (29/09/2026)** : la corbeille d'une carte est toujours visible, en discret (elle
n'apparaissait qu'au survol) ; « Supprimer » puis « Retrait… » pendant l'opération ; si le retrait de
l'agent toujours actif échoue, la carte reste et dit « Le retrait n'a pas abouti : … ». Le panneau
d'un agent retiré depuis sa fiche se ferme.

**Bases de connaissances d'un agent** (25/09/2026) : à la création d'un agent et sur
sa carte (« Connaissances de {0} »), le choix des bases que le Chat consulte avec cet
agent. Depuis le 25/09/2026, l'employé OpenClaw de l'agent y cherche aussi (sa fiche,
ses missions, ses messageries). Sous le choix des bases, « Ce qu'il lit hors du Chat »
(`src/components/agents/LectureBases.tsx`) dit ce qu'il lira **réellement**, calculé par
l'instance comme son outil le fait (`POST /helix/employes/<id>/connaissances`), base par
base : « lue : 1 document(s) sur 2 », « non lue : base privée », « non lue : partagée à
des groupes », « non lue : partagée à des groupes dont vous n'êtes pas membre ». En tête,
la règle qui s'applique : pour un agent personnel sans messagerie, sans mission à chaque
mail, encadré et sans outil qui écrit, « il lit ce qui est ouvert à toute l'équipe et ce
qui est partagé aux groupes dont vous êtes membre, jamais vos documents privés », plus
l'avertissement qu'il cesse de les lire dès que l'une de ces conditions tombe, et que
ce qu'il a déjà noté dans sa mémoire peut y rester ; sinon, « il ne lit que ce qui est
ouvert à toute l'équipe, parce que : » et la liste des raisons (ouvert à toute
l'organisation, messagerie, mission à chaque mail, liberté au-delà d'« Encadré »,
outils qui écrivent ou envoient, nommés). Agent pas encore en service : la phrase le dit.
**Vu le 25/09/2026** dans le navigateur, avec une instance jetable : agent personnel
sans outils (« lue : 1 document(s) sur 2 » pour une base partagée au groupe Compta, le
second document étant privé), agent d'organisation avec outils (deux raisons, « non
lue : partagée à des groupes »). La carte d'un employé sans agent dit désormais
« Personnel » quand il l'est (elle disait « Organisation » pour tous).

**Agents partagés à des groupes, mémoire vidée avant d'élargir** (25/09/2026, le soir) :
la visibilité se choisit comme dans la Bibliothèque (`ChoixVisibilite` : « Vous seul »,
« Des groupes » avec les pastilles de ses groupes, « Toute l'équipe »), à la création
et dans les **Réglages** de l'agent en service (« Qui le voit et lui parle »). Onglet
« Groupes (n) » à côté d'Organisation et Personnels ; la carte dit « Groupes : Compta ».
« Ce qu'il lit hors du Chat » dit désormais trois règles : personnel, « il lit dans ces
bases tout ce que vous voyez, vos documents privés compris » ; de groupes, « ce qui est
partagé à chacun de ses groupes, jamais un document privé » (« non lue : pas partagée à
chacun de ses groupes ») ; sinon la règle de l'équipe et ses raisons. Un enregistrement
ou un branchement de messagerie qui élargirait l'audience d'un agent ayant pu lire hors
de l'équipe n'est pas fait : un encadré « Vider sa mémoire d'abord »
(`ConfirmationMemoire.tsx`) dit pourquoi et ce qui sera fait, avec « Vider sa mémoire et
continuer » ou « Annuler ». Réussi, la ligne d'information dit « Sa mémoire a été mise
de côté (copie chiffrée…) puis vidée : n note(s), n conversation(s) » ; échoué, le
changement n'est pas fait et la raison s'affiche. Dans les Réglages, « Mémoire mise de
côté » liste les copies (date, notes, conversations effacées) avec **Restaurer** (grisé,
avec la raison, tant que l'agent est plus ouvert qu'au moment de la copie) et
**Supprimer**. **Vu le 25/09/2026** dans le navigateur (instance jetable, OpenClaw
d'essai) : passage de Personnel à « Des groupes » refusé puis confirmé, deux copies
listées ensuite, non restaurables ; création d'un agent « Des groupes » depuis la
modale, carte « Groupes : Compta ». Pas vu : l'encadré dans l'onglet Canaux (même
composant, essayé par l'API seulement), l'application de bureau.

**Fiche d'un agent en service** (0.11.0, `src/components/agents/Employes.tsx`) : des agents
OpenClaw qui travaillent pour toute l'équipe. « Déployer un employé » ouvre un
formulaire court : nom, poste, outils (ceux qui sont branchés sur l'instance ; les
autres sont grisés, avec la raison), missions régulières (rythme et heure), « agir
sans demander d'accord », modèle s'il y en a plusieurs ; trois exemples le préremplissent.
Chaque carte dit l'état (en service, en pause, arrêté), qui l'a déployé, ses outils
et sa prochaine mission. Le panneau d'un employé : **Discuter** (conversation propre à
chaque personne, qui survit à la fermeture du panneau), **Missions** (et « Lancer
maintenant » pour son propriétaire), **Activité** (comptes rendus des missions),
**Réglages** (propriétaire seulement : poste, outils, missions, pause, autonomie,
retrait). Sans OpenClaw sur la machine de l'instance, l'onglet le dit et explique
quoi installer. Depuis 0.12.0 : choix du **modèle** (local, de l'agence ou cloud par
clé, avec le pays du service), **palier de liberté** (Encadré, Étendu, Libre, ce
dernier sous mot de passe), et onglet **Canaux** : brancher Telegram, WhatsApp (QR
code affiché, à scanner depuis le téléphone), Discord, Slack, Mattermost, voir leur
état, accepter les personnes qui demandent à lui parler.

**Réglages, Modèles cloud** (0.12.0, `src/components/settings/ModelesCloud.tsx`) :
brancher la clé d'un fournisseur (Mistral, Scaleway, OVHcloud, IONOS, OpenAI,
Anthropic, Google, OpenRouter, et depuis le 27/09/2026 Groq, DeepSeek, xAI, Together AI,
ou une adresse compatible OpenAI), la vérifier, choisir les modèles à proposer, pour soi
ou pour l'équipe. Les refus d'un fournisseur (clé, crédit, quota, modèle retiré, service
surchargé) sont dits avec son nom et quoi faire ; vérifié contre de faux fournisseurs
seulement (`scripts/essai-fournisseurs.mjs`), pas avec de vraies clés. Le sélecteur de modèle du Chat
range les modèles par origine (sur vos machines, fournis par votre prestataire, vos
clés, clés de l'équipe) et affiche le pays de chaque modèle cloud.

Les **fichiers de l'agent** (« Ajouter un fichier », « Depuis Helix » qui puise dans
la Bibliothèque ou le dossier de l'équipe) deviennent ses documents de référence ;
« Optimiser les instructions » réécrit les instructions avec le modèle de la machine,
et « Revenir à ma version » les rend telles qu'elles étaient.

### `/taches` Tâches

`src/pages/TachesPage.tsx`. Captures 25 à 29.

Ce qui fonctionne : les trois vues **Kanban**, **Tableau** et **Calendrier** ;
création, modification, statuts (à faire, en cours, terminée, annulée),
priorité, projet, échéance (un jour du calendrier, qui ne change pas selon le
fuseau) ; persistance ; et la **délégation à un agent**
(`src/lib/taskRunner.ts`) : l'agent exécute la tâche, la carte avance toute
seule, la trace des outils et le compte rendu sont conservés.

**Enchaînement (0.19.0).** Champ **« Après »** à la création et dans le détail :
une liste des tâches, avec recherche ; celle qui créerait une boucle est grisée,
« attend celle-ci ». Dès qu'une tâche est choisie, ligne **« Lancement »** :
« D'elle-même, dès qu'elle est terminée » ou « À la main » (interrupteur). Sur la
carte qui attend : « Après « … » » et un bouton inactif « Partira d'elle-même » ou
« En attente » ; si une étape a été annulée : « Bloquée : « … » a été annulée » et
« En attente d'une relance ». Le Tableau porte la même mention sous le titre. Le
détail dit « Attendue par « … » : elle partira quand celle-ci sera terminée ».

Rubriques de gauche : **Boîte de réception** (ni échéance ni projet), **Mes
tâches**, **Aujourd'hui** (échéance du jour, plus les tâches ouvertes en retard,
marquées « En retard »), **À venir**, puis chaque projet avec son compteur.
**Filtre** par statut, priorité et agent, **tri** par échéance, priorité ou mise
à jour dans les deux sens (les tâches sans échéance restent en fin de liste),
appliqués aux trois vues. Le calendrier place les tâches à leur date, en semaine
ou en mois. Vue, rubrique, filtre et tri sont retenus par personne sur le poste.
Une tâche rangée dans un projet reste visible de sa seule propriétaire.

**Programmées** (26/09/2026, `src/components/taches/TachesProgrammees.tsx`) : rubrique
de gauche « Programmées ». « Nouvelle tâche programmée » : titre, consigne, rythme (chaque
jour, du lundi au vendredi, chaque semaine et son jour, chaque mois et son jour ou le
dernier), heure, « Fait par » (l'agent du Chat ou l'un de ses agents), « Avec mes outils ».
Chaque tâche : rythme et prochaine fois, « Lancer maintenant », « Mettre en pause »,
« Supprimer », changement d'agent, dernier compte rendu dépliable et « Ouvrir dans un
Chat ». Les listes sont celles de l'application : elles défilent d'elles-mêmes.

⚠ Non traités : les rappels d'échéance, l'assignation à un humain (le champ « Assigné
à » existe, il n'ouvre aucun flux).

---

## 4. Bibliothèque, Réunions, Groupes (0.16.0)

Ces trois écrans étaient des maquettes jusqu'à 0.15.0. Ils sont désormais tenus par
l'instance ; le détail de sécurité est dans `SECURITE.md` § 16.

### `/bibliotheque` Bibliothèque

`src/pages/BibliothequePage.tsx`, `src/lib/bibliotheque.ts`,
`gateway/src/bibliotheque.ts`.

Filtres Tous les fichiers (navigation par dossiers, fil d'Ariane), Favoris (étoile
au survol d'une ligne), Privés, Groupes ; recherche dans les noms **et le contenu**
des documents (texte extrait sur le poste). « Nouveau dossier » (nom, qui peut le
voir, emoji, couleur) ; « Importer » ou glisser-déposer sur la page (1 Go par
document, visibilité choisie, reprise de celle du dossier ouvert). Menu de chaque
ligne : Télécharger, Renommer, Qui peut le voir, Déplacer, Supprimer (propriétaire
seulement). Le menu contextuel au clic droit des captures n'est pas repris : les
mêmes actions sont dans le menu « ... » de chaque ligne.

À l'écran, ce module s'appelle **« Fichiers »** ; le code et cette documentation
gardent « Bibliothèque ». Les textes ajoutés le 25/09/2026 disent « Fichiers ».

**Onglet « Bases de connaissances »** (25/09/2026,
`src/components/bibliotheque/BasesConnaissances.tsx`). Une base rassemble des
documents de Fichiers : « Nouvelle base » (nom, description, « Qui peut s'en
servir »), puis sur sa fiche « Ajouter depuis Fichiers », « Importer un fichier »
(le document entre d'abord dans Fichiers), « Tout réindexer », « Modifier »,
« Supprimer la base » (les documents restent dans Fichiers). Tableau des documents :
état (En attente, Découpage..., progression « {0} sur {1} passages », Prêt, Sans
texte, Échec), passages, « Indexé par {0} en {1} s », Réindexer, Retirer de la base.
Les documents qu'on ne voit pas ne sont pas nommés (« {0} autre(s) document(s) ... ne
vous sont pas visibles »). Encadré **« Essayer une question »** : passages trouvés,
similarité, « mots trouvés », durée. Durées et similarités avec la virgule décimale
de la langue. **Vu le 25/09/2026** : base créée, deux documents indexés par
`text-embedding-nomic-embed-text-v1.5`, recherche d'essai correcte.

### `/reunions` Réunions

`src/pages/ReunionsPage.tsx`, `src/lib/reunions.ts`, `gateway/src/reunions.ts`,
`electron/botReunion.cjs`.

Boutons Envoyer le bot (application de bureau seulement, grisé ailleurs avec la
raison), Enregistrer (micro : minuteur, niveau, pause, terminer ; l'enregistrement
continue si l'on change d'écran, un point rouge le rappelle dans la barre latérale),
Importer (audio ou vidéo, 2 Go, avancement), réglages. Bandeau d'installation de
la transcription si Whisper manque ; bandeau du bot automatique s'il est activé.
Cartes des bots en cours (rejoint, attend d'être admis, enregistre depuis…, Voir la
fenêtre, Arrêter). Liste des réunions avec statut (transcription en pourcentage,
compte rendu, prête, erreur). Fiche d'une réunion : compte rendu (résumé, points
clés, décisions, actions à ajouter aux Tâches, modèle qui l'a rédigé), transcription
horodatée avec recherche et copie, audio s'il est gardé, Renommer, Partager,
Exporter en Markdown, Supprimer, Relancer après une erreur.

Les éléments des captures qui citaient Recall et Gladia (services tiers) ont disparu :
tout se fait sur la machine. L'import par « URL média » (YouTube…) n'est pas repris :
il supposait qu'un service tiers aille chercher le son.

### `/groupes` Groupes

`src/pages/GroupesPage.tsx`, `src/lib/groupes.ts`, `gateway/src/groupes.ts`.

Onglets Mes groupes et Tous, recherche, cartes (membres, rôle). Création (nom,
description, membres choisis dans l'annuaire). Fiche : renommer, ajouter des
personnes, nommer ou retirer un responsable, retirer un membre, quitter, supprimer.
Le partage à un groupe se fait depuis la conversation (Partager), la bibliothèque et
la fiche d'une réunion.

## 5. Réglages

`src/components/settings/SettingsShell.tsx` pour la navigation,
`src/pages/ParametresPages.tsx` pour les pages. Quinze entrées, toutes atteignables
(seize avec Abonnement, éteint en marque blanche), relevées dans `SettingsShell.tsx`
le 28/09/2026 (« Signaler un problème », la dernière, depuis le 27/09/2026).

| Route | Écran | État |
|---|---|---|
| `/parametres/profil` | Profil | ✅ **fonctionne**, photo comprise |
| `/parametres/preferences` | Préférences | ✅ **fonctionne** |
| `/parametres/securite` | Sécurité | ✅ **fonctionne** |
| `/parametres/personnalisation` | Personnalisation de l'IA | ✅ **fonctionne** |
| `/parametres/bot-recorder` | Bot Recorder | ✅ **fonctionne** (0.16.0) |
| `/parametres/mcp` | Connecteurs (lignes « LinkedIn (Page d'entreprise) » et « Palmier Pro » depuis le 29/09/2026) | ✅ **fonctionne** ; ces deux lignes vérifiées contre des doublures seulement |
| `/parametres/modeles-locaux` | Modèles locaux (28/09/2026) : emplacement du moteur et des modèles, place libre, changement (déplacement pour llama.cpp, marche à suivre pour LM Studio installé) | ✅ **vu dans le navigateur** (serveur de développement, passerelle jetable, fr et en, 1280 et 375 px) ; Windows pas essayé |
| `/parametres/modeles` | Modèles cloud | ✅ **fonctionne** |
| `/parametres/entrainement` | Entraîner un modèle | ✅ **fonctionne sur Mac à puce Apple** (25/09/2026) ; carte NVIDIA pas essayée, et l'écran le dit |
| `/parametres/abonnement` | Abonnement (version du prestataire seulement) : grille refaite le 29/09/2026, voir § 6 « Réglages, Abonnement » | ⚠ **écran sans paiement branché**, et il le dit |
| `/parametres/importer` | Importer depuis d'autres IA | ✅ **fonctionne** (24/09/2026, par morceaux depuis le 25/09) |
| `/parametres/ecran` | Contrôle de l'écran | ✅ **fonctionne** |
| `/parametres/integrations` | (redirige vers Connecteurs) | ↪ **supprimé** |
| `/parametres/api` | API développeur | ✅ **fonctionne** (26/09/2026) : clés d'API personnelles et documentation |
| `/parametres/usage` | Mon usage | ✅ **fonctionne** |
| `/parametres/confidentialite` | Confidentialité | ✅ **fonctionne** |
| `/parametres/apps` | Installer les apps | ✅ **fonctionne** pour l'application macOS servie par l'instance et l'onglet CLI ; Windows et Linux renvoyés au paquet du prestataire ; pas d'application mobile, et l'onglet le dit |
| `/parametres/signaler` | Signaler un problème | ✅ **fonctionne dans l'interface de développement** (27/09/2026) : ticket GitHub ou mail préremplis ; ouverture dans l'application de bureau pas essayée |

### Détail

**Profil** (captures 30 et 31). ✅ Nom et adresse enregistrés dans l'instance
(`POST /helix/auth/profil`). Changer d'adresse exige le mot de passe actuel,
une adresse libre, et n'hérite d'aucune invitation en attente : l'adresse devient
« déclarée » et ne rattache plus rien (voir SECURITE.md § 1.6). ✅ La photo de
profil (0.16.0) : JPEG, PNG ou WebP, recadrée en carré de 256 pixels sur le poste,
vérifiée par l'instance (type réel, 80 Ko au plus), visible dans le choix du compte
à la connexion. Déconnexion fonctionnelle. ✅ **Supprimer mon
compte** (Zone de danger, depuis 0.10.0) : un premier clic ouvre le bilan calculé
par l'instance (conversations, tâches, agents, projets supprimés, projets confiés
et à qui, mentions retirées chez les collègues, journal conservé), puis mot de
passe, code si la double authentification est active, et case « Je comprends que
la suppression est définitive ». Le bouton reste inactif tant que tout n'est pas
rempli. Après suppression, le poste oublie ce qui restait de la personne.

**Préférences** (captures 32 et 33). ✅ La carte **Apparence** : quatre modes,
dont la bascule au coucher du soleil calculée sur le poste. ✅ **Dates et
heures** : formats européen, américain ou ISO, 24 ou 12 heures, appliqués
partout où une date s'affiche (journal d'audit, séances, tâches, usage,
connecteurs, heures du soleil). Le choix suit la personne, pas le poste
(`src/lib/formats.ts`). ✅ **Langue** (0.25.0, `ChoixLangue.tsx`) : sept langues depuis le
30/09/2026 (English, Français, 中文, 日本語, Español, Deutsch, العربية), pour ce poste ; la page se
recharge, et l'arabe retourne l'écran (« Langues et sens d'écriture », § 6). ✅ **À propos** : version installée et mise
à jour réelle (`MiseAJour.tsx`, depuis 0.10.0). États, dont « aucune adresse de mise à
jour n'est inscrite » (rien n'est contacté), « aucune version plus récente (vérifié
le …) », « version X disponible » avec **« Installer maintenant »** quand l'archive (macOS)
ou l'installateur (Windows, depuis le 27/09/2026) porte une signature de l'éditeur valide,
« Télécharger » sinon (Linux, ou partie Windows absente), barre de téléchargement, puis
« Redémarrer pour installer » quand l'application est signée par Apple. La source est dite
(serveur du prestataire, instance, ou publications GitHub, toutes les six heures), et le
régime, automatique ou d'un clic. Le clic sous Windows n'a jamais tourné sur un vrai PC.
Dans un navigateur, la carte n'affiche que la version.

**Sécurité** (capture 34). ✅ La carte **Postes et activité**
(`SeancesEtJournal`) fonctionne : séances ouvertes du compte, révocation une par
une, journal d'audit consultable avec le résultat de la vérification de sa
chaîne, chaque action nommée en français. C'est un ajout Helix. ✅
**Authentification à deux facteurs** (`DeuxFacteurs.tsx`, depuis 0.9.0) :
activation en trois temps (mot de passe redemandé, QR code calculé sur le poste
avec la clé lisible pour une saisie à la main, premier code), dix codes de
secours montrés une seule fois, avec copie ; une fois active, date d'activation,
nombre de codes restants (alerte sous trois), nouvelle série et retrait, chacun
sous mot de passe et code. Le bloc « Vérification de l'email », qui affichait
une coche sans rien vérifier, a été retiré.

**Personnalisation de l'IA** (captures 35 et 36). ✅ Instructions personnalisées,
informations personnelles et gestionnaire de mémoire sont persistés dans le
profil privé (`useProfile`) et réellement injectés dans le message système des
conversations.

**Bot Recorder** (capture 37). ✅ Réglages réels (0.16.0) : nom affiché du bot,
compte Google du bot (facultatif, pour les réunions qui refusent les invités),
rejoindre automatiquement les réunions Google Meet de l'agenda, langue, compte
rendu automatique, conservation de l'audio. « Provider de réunions » des captures a
disparu : il n'y a pas de fournisseur, le bot est celui de l'application.

**MCP** (capture 38). ✅ Les serveurs MCP sont ceux réellement lancés par la
passerelle : état, nombre d'outils, liste des outils, interrupteur de démarrage
et d'arrêt, espace de travail affiché (`fetchMcp`, `toggleMcpServer`). La carte
pédagogique « Qu'est-ce que MCP ? » est un texte fixe. Le badge « Pro+ » et le
bouton « Passer au supérieur » des captures ont été retirés : il n'y a pas de
plan payant. ⚠ On ne peut pas **ajouter** un serveur : la liste est figée dans
`gateway/src/mcp.ts`.

**Contrôle de l'écran**. ✅ Ajout Helix, sans équivalent dans les captures.
Carte **Activation** en tête (depuis 0.10.0) : « Activer sur ce Mac », qui explique
ce que cela implique puis demande le mot de passe (et le code si la double
authentification est active) ; « Désactiver » sans mot de passe ; ou « réglage
verrouillé » avec la raison (profil de déploiement, instance partagée). Puis mode en
vigueur, exigence d'approbation, écran détecté, autorisations macOS manquantes
nommées en clair (l'autorisation d'enregistrer l'écran lue sans être demandée : jamais
demandée, elle compte comme utilisable), bouton « Tester la capture » avec aperçu, installation du modèle
de vision adapté à la machine, et dernières actions. Dans Cowork, le bouton
« Écran » mène à cette page (« Activer le contrôle de l'écran… », ou « Régler ce
qui manque… » quand une autorisation manque), comme « Connecter votre messagerie »
mène aux connecteurs.

**Connecteurs** (remplace MCP et Intégrations). ✅ Écran unique en grille de
tuiles, avec les logos officiels : Courrier, Agenda, Google Drive et Slack (actifs
depuis 0.10.0), plus **Tous les services** depuis 0.22.0 — le catalogue, une seule
tuile parce que les services y sont plus de trente et que la grille du haut doit
rester ce qu'elle est : les quatre branchements que presque tout le monde fait. Drive : « Préparation Google à faire »
tant que le client OAuth manque, avec les étapes pour la console Google ; « Se
connecter avec Google », puis attente de l'accord (collage de l'adresse de retour si
l'instance est sur une autre machine) ; « Connecté : compte » ; « Accès perdu, à
reconnecter ». Slack : étapes et manifeste à copier, champ du jeton ; « Espace
« … » » une fois branché ; « Jeton refusé, à reconnecter ». Panneau sous la grille,
un seul ouvert à la fois. Chaque tuile dit le service, une
ligne de résumé et son état ; le formulaire n'apparaît qu'au clic.

Courrier, une fois la boîte connectée (0.17.0) : bloc **« Envoi de mails »** avec son
interrupteur, coupé par défaut. Chez un fournisseur connu, l'allumer suffit (serveur
d'envoi repris, essayé, retenu) ; sinon, ou via « Choisir le serveur d'envoi »,
serveur, port et chiffrement, puis « Activer l'envoi ». L'erreur du serveur s'affiche
sous le bloc. Une fois l'envoi actif, second interrupteur **« Envoyer sans me
demander »** (coupé par défaut ; allumé, un avertissement dit le risque et
l'exception des mails reçus). Quand un agent veut envoyer, la carte d'approbation (en bas de toute
page) devient **« Un mail est prêt à partir »** : À, Cc, Objet, texte entier dans un
cadre qui défile, « Envoyer » ou « Ne pas envoyer », et « Sans réponse, le mail ne
partira pas ».

**Tous les services (0.22.0).** Sous la tuile, la liste complète : un champ de
recherche, puis les rubriques : Livré avec le produit ; celles des services à panneau
(Courrier, agenda et fichiers, Réseaux sociaux, Campagnes e-mail, Messageries, Commerce et
relation client, Microsoft 365, Travail en équipe), où les entrées du catalogue de même
rubrique rejoignent les services à panneau ; enfin Développement, Documents et données, Web et
recherche. Une rubrique n'a qu'un titre depuis la tournée finale du 28/09/2026 : « Vente et
relation client » et « Paiement et gestion » sont fondues dans « Commerce et relation client »,
Box est rangé avec Drive et Dropbox, et le Slack par jeton de bot s'appelle « Slack (par
jeton) », à côté du Slack du catalogue. Chaque ligne porte une pastille d'état, le nom, une icône qui
dit d'où le service tourne (un globe : chez lui, rien ne s'installe ici ; un
terminal : un serveur sur la machine de l'instance), sa description, et le nombre
d'outils une fois branché.

Deux boutons, et l'écran dit lequel s'applique avant qu'on clique :

- **« Se connecter »** pour les douze services qui publient leur serveur et acceptent
  l'enregistrement dynamique — Notion, Linear, Jira/Confluence, Asana, Sentry,
  Intercom, Canva, Figma, Webflow, Wix, Vercel, Square, PayPal (Figma et Vercel retirés le 28/09/2026,
  SECURITE.md § 49, puis remis le même jour : Vercel accepte Helix, vu par Medhi). La page
  d'autorisation qui s'ouvre est celle du service, dans le navigateur du système :
  Helix ne voit jamais le mot de passe. Pendant ce temps, le bouton devient « En
  attente de votre accord… » et l'écran relit l'état tout seul, jusqu'à afficher le
  nombre d'outils obtenus. Pour GitHub, Slack, Box et Airtable, le même bouton
  demande d'abord l'identifiant d'une application à créer une fois chez eux, avec
  l'adresse de retour à y inscrire ;
- **« Connecter »** pour les serveurs à exécuter sur la machine de l'instance : un
  formulaire, un jeton à coller, et l'aide qui dit où le trouver.
- **« Brancher »** (29/09/2026), pour une application ouverte sur la machine de l'instance
  (Palmier Pro) : un clic, sans navigateur ni jeton. L'encart du bas dit alors « Trois façons
  de brancher » au lieu de deux, et ce que fait « Brancher ».

**LinkedIn, deux lignes (29/09/2026)**, rubrique « Réseaux sociaux », même logo :
« LinkedIn » (« Profil : publier en son nom après accord ») et, juste dessous, « LinkedIn (Page
d'entreprise) » (« Page : publications, statistiques, publier après accord »), chacune avec son
panneau `ConnecteurNatif.tsx`. Le panneau du profil porte un encart « Cette application sert
au profil. La Page d'entreprise se branche à part… » et le bouton « Brancher la Page
d'entreprise », qui ouvre la ligne de la page et l'amène à l'écran ; si le compte avait été
branché avec l'ancienne case « page », l'encart passe en avertissement et le dit. Le panneau
de la page : « Avec une seconde application LinkedIn, que votre organisation crée pour sa Page
d'entreprise, une fois… », le texte de l'examen (produit « Community Management API »,
paliers de développement et standard, pas de délai annoncé), le guide pas à pas
(`guideLinkedinPage` : « Ouvrir la création d'une nouvelle application LinkedIn », vérification
par le super administrateur, demande du produit, adresse de retour et portées copiables, « À
ne pas faire »), les champs « Client ID » et « Primary Client Secret » de la seconde
application, et la case « Permettre de publier des posts au nom des pages que le compte
administre. ». Branchée : « Connecté : » et le nom de la première page administrée.

**Palmier Pro (29/09/2026)**, rubrique « Documents et données » (avec Canva et Figma), logo
tiré de l'icône de son site, servi seulement quand l'instance tourne sur un Mac à puce Apple.
Bouton « Brancher » ; si l'application n'est pas ouverte ou pas reconnue, le message le dit en
tête de l'écran et le panneau « Brancher Palmier Pro, pas à pas » s'ouvre
(`guideApplicationLocale`) : bouton vers la page de téléchargement officielle, installer dans
Applications, ouvrir un projet, « Brancher », se connecter à son compte Palmier pour générer ;
« À ne pas faire » : le lancer depuis l'image disque ou Téléchargements, le fermer pendant
qu'un agent monte. Branché : pastille d'état, nombre d'outils, « Retirer » ; application
fermée depuis : « Réessayer » à côté de « Retirer ». L'écran relance de lui-même une application
locale arrêtée, au plus toutes les quinze secondes. Les cartes d'accord de ses outils disent,
pour une génération, qu'elle part chez Palmier, hors de cette machine, sur les crédits du
compte (`libellesOutils.ts`). Vérifié contre un faux Palmier Pro (`npm run essai:palmier`) ;
la vraie application n'a pas été vue.

En pied d'écran, ce que les deux voies garantissent, écrit en toutes lettres : aucune
ne passe par un tiers, le jeton reste chiffré dans l'instance, et Helix ne lance que
les commandes de son catalogue — jamais une commande venue de cet écran.

Pièces jointes du Chat (0.18.0) : un fichier texte de toute taille est accepté, sa
puce porte « (début) » quand seul le début est lu (l'infobulle dit pourquoi et
renvoie à Fichiers) ; une photo lourde est réduite au lieu d'être refusée. Depuis le
27/09/2026, le message envoyé porte une carte par fichier (§ 3, Chat).

Dans le Chat, la puce **Outils** est retenue d'un Chat à l'autre (0.17.0), et les
traces d'outils disent l'action en français (« Envoi d'un mail », « Lecture d'un
fichier ») au lieu du nom technique.

L'ancien écran **Intégrations** a été supprimé. Il existait en double avec
Connecteurs, et un utilisateur cherchant à brancher sa boîte aux lettres
cliquait sur l'un quand le formulaire était sur l'autre. Il affichait par
ailleurs « Google connecté » avec l'adresse du compte local, sans aucune
connexion réelle. Son adresse redirige vers Connecteurs.

Les logos sont les fichiers officiels des kits de marque (28/09/2026), en
couleur, avec leur version pour fond sombre quand la société en livre une :
`scripts/marques/` (fichiers, page de marque, règle d'usage, empreintes), tirés
dans `src/components/ui/marques.ts` par `scripts/gen-marques.cjs`. Les mêmes
logos servent au sélecteur de modèles, aux clés d'API (Modèles cloud) et à
« Comparer les modèles ». Slack, LinkedIn, YouTube, Facebook, Instagram,
TikTok, Asana, HubSpot, Intercom, Airtable, Box, PayPal, Square et Tavily
gardent une icône neutre, pour la raison donnée dans
`scripts/marques/sources.json` et THIRD_PARTY_NOTICES.md § 4 bis. Les couleurs
de marque sont en hexadécimal, entorse assumée à la règle des tokens : ce sont
des données imposées par ces sociétés, pas des couleurs d'interface.

**API développeur** (`src/components/settings/ClesApi.tsx`, 26/09/2026). ✅ Données
réelles de l'instance (`/helix/cles-api`). En haut : ce qu'une clé permet, et
« Créer une clé » (nom, expiration 30 jours, 90 jours, 1 an ou sans expiration). La
clé créée s'affiche **une fois**, dans un encart d'avertissement, avec un bouton
Copier (si le navigateur refuse la copie, la valeur est sélectionnée et l'écran le
dit) et « J'ai copié la clé » qui la fait disparaître. Liste : nom, `hlx_•••• fin`,
créée le, dernière utilisation, expiration (pastille « Expirée »), Renommer, Révoquer
avec confirmation (« les programmes qui s'en servent seront refusés dès
maintenant »). En dessous, « Utiliser l'API » : l'adresse de base telle que la
passerelle la sert (`http://localhost:<port>/v1`, `https` si elle chiffre, et les
adresses réseau si l'instance est ouverte aux collègues, sinon la phrase qui dit
qu'elle n'est pas joignable d'ailleurs), exemples `curl` et Python (`openai`, sans et
avec flux) remplis avec un vrai modèle de l'instance et une variable d'environnement
nommée d'après la marque, l'usage du champ `connaissances` avec la liste des bases de
la personne et leurs identifiants, la liste des modèles, ce qu'une clé ne permet pas,
et les limites (60 requêtes par minute, 20 clés). Vu dans le navigateur le
26/09/2026 sur une instance jetable, en français et en chinois ; l'exemple `curl` a
été recopié de l'écran et exécuté tel quel. Pas vu dans l'application de bureau.

**Mon usage** (captures 41 et 42). ✅ Données réelles : requêtes, jetons
d'entrée et de sortie (dont ceux de raisonnement), courbe par jour, table par
modèle, sur quatre périodes. Coût « Gratuit » pour un modèle local ; pour un modèle
distant, le **tarif saisi** (« tarif saisi », il l'emporte toujours), sinon, depuis le
27/09/2026, le **prix publié** par son fournisseur : le montant suivi de « (estimé) », et
dessous « prix publié par {fournisseur}, relevé du {date} » avec « Voir la page » ;
l'infobulle dit que le cache, les lots et les paliers gratuits n'y sont pas. Sans l'un ni
l'autre, « Tarif non renseigné », jamais compté à zéro, et le total dit « (incomplet) ».
Totaux par devise, sans conversion (« 1,20 $ + 0,30 € ») ; tarifs illisibles : l'écran le
dit et n'écrit rien par-dessus. Plus bas, « Tarifs des modèles distants » : entrée,
sortie, devise (euro ou dollar), « Enregistrer », « Retirer ». Chacun ne voit que sa propre
consommation. L'ancien écran affichait un budget, une courbe et un modèle qui n'avaient
jamais existé. Relevé, pas corrigé : la table montre l'identifiant technique du modèle
(`cle-…/…`). Prix publiés pas encore vus avec une vraie clé.

**Confidentialité** (captures 43 et 44). ✅ « Télécharger mes données » produit
l'export RGPD réel (`GET /helix/export`, SECURITE.md § 7.1) : un fichier JSON
nommé d'après la marque et le jour, puis un résumé de ce qu'il contient. La liste
affichée des rubriques est exactement celle du fichier ; l'ancienne annonçait
documents, réunions et retours, qui n'existent pas. Le droit à l'effacement
renvoie au délégué : l'écran affirmait qu'on supprimait son compte depuis le
profil, ce qui n'existe pas. L'adresse du DPO vient de `branding.ts`.

**Installer les apps** (capture 45). ✅ Onglet Desktop : l'instance sert l'application
macOS qu'elle fait tourner (« Télécharger », taille, puis « Au premier lancement » : ouvrir
le .zip, glisser dans Applications, clic droit puis Ouvrir tant que l'application n'est pas
signée par Apple) ; pour Windows et Linux, l'écran dit que l'instance ne sert que
l'application macOS et renvoie au paquet du prestataire. L'onglet Mobile est grisé
(« Pas d'application mobile pour l'instant. »). L'onglet
**CLI** (25/09/2026, `LigneDeCommande.tsx`) est actif dans l'application de bureau :
« Mettre en place » pose `~/.local/bin/helix` (et une ligne marquée dans
`~/.zprofile` si ce dossier manque au PATH), « Mettre à jour » quand le lanceur vise
une autre copie de l'application, « Retirer » enlève les deux ; suivent les
commandes pour commencer. Dans un navigateur, l'onglet le dit au lieu d'offrir un
bouton. Le
lien « Voir toutes les versions » mène à l'URL de `branding.ts`. Seule
l'application macOS est éprouvée sur une vraie machine ; les paquets Windows et Linux
sont construits depuis le 27/09/2026, jamais installés sur un vrai PC (le `.deb` l'a été
dans un conteneur Ubuntu).

---

## 6. Ajouts Helix sans équivalent dans les captures

Ces éléments ne viennent pas de la maquette d'origine. Ils sont documentés ici
pour que personne ne les cherche dans `screenshots/`.


### Importer depuis d'autres IA (24/09/2026)

Réglages > « Importer depuis d'autres IA » : une carte **« Depuis les
logiciels de cet ordinateur »** liste les logiciels d'IA trouvés (Claude Code,
Codex, Cursor : nombre de conversations, instructions ; ChatGPT et Claude :
pourquoi on ne peut pas les lire), avec « Reprendre ». La suite est celle de
l'import d'archive : choix des Chats et des projets, place disponible, bilan.

**Par morceaux, depuis le 25/09/2026** : pendant la lecture, « Lecture des
conversations : {0} sur {1}... » (les plus récentes d'abord) ; à l'import, « Chargement
des Chats : {0} sur {1}... », avant la création des projets et des agents. Un Chat
devenu illisible entre-temps est compté à part dans le bilan. Un logiciel sans
conversation ni instructions a son bouton désactivé. **Vu le 25/09/2026** : 5 lots pour
Claude Code, 19 Chats listés ; Cursor, à 0 conversation, bouton désactivé.

**Où les Chats ont vraiment été gardés** (25/09/2026) : dans l'application de bureau,
le bilan attend l'écriture du fichier chiffré. Si le fichier l'a refusée, l'encart passe
en avertissement et le dit : Chats gardés pour l'instant dans le stockage du navigateur
(quelques Mo), ou, si celui-ci est plein aussi, seulement en mémoire et perdus à la
fermeture ; puis si l'instance en a reçu la copie ou non (et quoi faire). **Vu le
25/09/2026** dans l'application de bureau, profil d'essai, dossier des Chats rendu non
inscriptible et stockage du navigateur rempli : « 2 Chat(s) repris sur 2. Ni le fichier
chiffré de cet ordinateur ni le stockage du navigateur n'ont pu les garder […] L'instance
en a reçu la copie : ils y restent. »

**Gemini (28/09/2026)** : la liste des services porte une troisième ligne, « Gemini :
Google Takeout, « Mes activités », « Applications Gemini » seulement », et un dépliant
**« Exporter ses Chats de Gemini, pas à pas »** : sept étapes numérotées (lien
« Ouvrez Google Takeout », qui ouvre takeout.google.com avec « Mes activités » ;
quoi cocher, format JSON, .zip, délai et lien valable 7 jours, quoi déposer), puis ce
que l'export contient et ne contient pas. Le sélecteur de fichier accepte .zip, .json et
.html. Après lecture, un encart dit comment les Chats ont été regroupés (par lien de
conversation, ou reconstitués par proximité dans le temps), les questions sans réponse,
les fichiers seulement nommés, les dates reconstituées et les activités écartées. Toutes
sources : un Chat déjà importé est grisé, « déjà importé », sa case désactivée ; s'il a
grandi, « déjà importé, {0} message(s) de plus : une copie complète sera ajoutée », case
libre mais non cochée ; si tout l'export est déjà là, « Tous les Chats de cet export sont
déjà importés : rien de nouveau à reprendre. » ; le bilan compte les Chats laissés tels
quels. **Vu le 28/09/2026** (serveur de développement, instance jetable, fixtures
fictives) : archive JSON, 5 Chats importés et rouverts ; même archive redéposée, 5 lignes
grisées, « Importer 0 Chat(s) » ; archive HTML aux chemins français, 4 Chats ; Takeout
sans Gemini, message clair ; 375 px sans défilement horizontal.

### Signaler un problème (27/09/2026)

Réglages > **Signaler un problème** (dernière entrée), ou l'aide, « Besoin d'une
personne » (`src/components/settings/SignalerProbleme.tsx`, `src/lib/signalement.ts`).
Trois champs : ce qui ne va pas (obligatoire), ce que la personne faisait, ce qu'elle
attendait ; une case **« Joindre les informations techniques »**, cochée par défaut
(version, cadre d'exécution, système et processeur, agent utilisateur, langue, modèle
choisi, date ; ni message, ni document, ni clé, ni adresse d'une instance d'entreprise).
Un encadré **« Ce qui sera envoyé »** montre le texte exact avant l'envoi. Deux cartes :

- **Ouvrir un ticket sur GitHub** : ouvre dans le navigateur un ticket prérempli du
  dépôt de la marque (`branding.urls.sourceCode`, formulaire `bug_report.yml`). L'écran
  dit qu'il faut un compte GitHub et que le ticket sera public. Absente si le dépôt de
  la marque n'est pas sur github.com.
- **Envoyer par mail** : ouvre un brouillon adressé à `branding.urls.supportEmail`,
  sujet et corps remplis ; si aucune messagerie ne s'ouvre, l'écran dit de copier le
  texte.

Rien ne part en arrière-plan : l'application ne porte aucun jeton GitHub. Un texte trop
long pour une adresse (7 500 caractères) est coupé à un endroit marqué, et l'écran le
dit. **Vu le 27/09/2026** dans l'interface de développement : adresse du ticket et
`mailto:` construits ; ouverture réelle dans l'application de bureau pas essayée.

### Entraîner un modèle (25/09/2026)

Réglages > **Entraîner un modèle** (`src/components/settings/EntrainerModele.tsx`).
En tête : ce que la machine permet (raison, modèle de départ et sa licence,
avertissement « pas encore essayé » quand c'est le cas), puis « Installer le moteur
d'entraînement » avec la place et le téléchargement annoncés, ou « Retirer le
moteur ». « Vos modèles » : un modèle par sujet, avec son nombre d'exemples, « à
relire », « entraîné », « installé ». Puis quatre étapes :

1. **Exemples** : saisie question et réponse, « Importer un CSV ou un JSONL »,
   « Tirer des exemples d'un document » (lu par le modèle du Chat ; les paires vont
   dans « propositions à relire », avec « Tout garder » et « Tout écarter » : rien
   n'est appris sans accord).
2. **Entraîner** : durée estimée, place du modèle, exemples mis de côté ; pendant le
   calcul, pas, erreur sur les exemples appris et mis de côté, temps restant,
   mémoire, et « Arrêter ».
3. **Comparer** : les exemples mis de côté et jusqu'à cinq questions libres, au modèle
   de départ et au modèle entraîné, côte à côte, sans note automatique.
4. **Installer** dans LM Studio, après l'avertissement que le modèle sera visible de
   toute l'équipe ; « Retirer de LM Studio ». Le modèle apparaît dans le sélecteur du
   Chat sans devenir « Rapide ».

**Vu le 25/09/2026** : l'écran ; « Tirer des exemples d'un document » avec Qwen3 8B,
8 paires couvrant les 5 faits d'un règlement. L'installation du moteur et un
entraînement complet ont été vus dans le navigateur par la branche d'origine, pas
refaits ce jour-là.

### Ligne de commande `helix` (25/09/2026)

Pas un écran, mais une surface : `helix` dans un terminal (Chat, `chat --outils`,
`code`), avec les actions de l'agent affichées « ✓ Écriture bonjour.txt » et les
demandes d'accord « Autoriser ? [o/N] ». Textes en français seulement
(`cli/textes.mjs`). Détail dans docs/GUIDE.md.

### Extension VS Code (24/09/2026, 0.2.5 le 29/09/2026)

Icône Helix dans la barre de VS Code : onglets **Chat** (« Joindre le fichier
ouvert », coché par défaut ; « Insérer » au-dessus de chaque bloc de code d'une
réponse, pas sur le code de la question) et **Code** (actions de l'agent
affichées « ✓ Écriture index.html », accords dans une fenêtre « Helix Code veut … »,
« Autoriser » / « Refuser »). Clic droit sur une sélection :
« Helix : expliquer / améliorer la sélection ». Boutons « Nouveau » et « Envoyer »
(« Arrêter » pendant une réponse).

0.2.5 (vu dans un vrai VS Code le 29/09/2026, profil jetable, PROJET.md) : pendant la
réflexion du modèle, la ligne d'attente dit « Le modèle réfléchit… » puis « Le modèle
réfléchit (N s)… » après deux secondes, au lieu de « … » (Qwen3 réfléchit parfois plus de
deux minutes) ; dans Code s'y ajoutent « Le modèle se charge en mémoire (…)... » et « Le
modèle lit la demande (…)... ». Le code de la question garde son indentation (bloc mis en
forme). Le bouton « Insérer » a sa place au-dessus du code (`chat.css`) : il recouvrait la
fin de la première ligne. Le paquet `helix-ai-0.2.5.vsix` est joint à la version GitHub
2026.929.2 et s'installe par Extensions, « … », « Install from VSIX… ». Pas vus dans le
vrai VS Code : la connexion et l'onglet Code (vérifiés par `npm run essai:vscode`).

### Apparence, quatre modes

`src/lib/store/apparence.ts`, `src/hooks/useApparence.ts`,
`src/styles/tokens.css`, `src/lib/soleil.ts`. Réglé dans Réglages,
Préférences.

| Mode | Comportement |
|---|---|
| **Au coucher du soleil** (défaut) | Sombre la nuit, clair le jour |
| **Clair** | Toujours clair |
| **Sombre** | Toujours sombre |
| **Réglage du système** | Suit l'apparence de macOS (`prefers-color-scheme`) |

Le réglage est propre au **poste**, pas au compte : l'écran de connexion
s'affiche avant qu'on sache qui est là, et la bonne apparence dépend de la pièce
et de l'heure, pas de la personne.

Le thème sombre est un jeu complet de tokens sous
`:root[data-theme="sombre"]` dans `src/styles/tokens.css`. Ce n'est pas la
palette claire inversée : la dominante chaude est conservée et ramenée dans les
valeurs basses, et l'accent émeraude est éclairci (46 % au lieu de 38 %) pour
rester lisible sur fond sombre. Aucune couleur n'est écrite ailleurs que dans ce
fichier.

**Les heures du soleil sont calculées sur le poste, sans réseau**
(`src/lib/soleil.ts`). L'équation du temps usuelle donne lever et coucher à la
minute près. La position vient du **fuseau horaire du système**, rapproché d'une
table de 43 villes orientée Europe. Aucune géolocalisation n'est demandée,
aucun service n'est interrogé : envoyer la position de l'utilisateur à un tiers
pour un réglage d'affichage serait contradictoire avec le produit.

Quand le fuseau est absent de la table, ou aux latitudes où le soleil ne se
couche pas, le calcul renvoie « je ne sais pas » et le mode **suit alors le
réglage du système** plutôt que d'inventer une heure. L'écran de réglage le dit.

La bascule est programmée pour l'instant exact du lever ou du coucher, jamais
plus d'une heure à l'avance : `setTimeout` ne rattrape pas une mise en veille.

Un petit script dans `index.html` repose le dernier thème appliqué **avant le
premier rendu**, à partir de `localStorage`. Sans lui, l'application s'ouvrirait
en clair puis virerait au sombre : un éclair blanc en pleine nuit.

### Langues et sens d'écriture (30/09/2026)

`src/lib/i18n.ts`, `src/components/settings/ChoixLangue.tsx`, `src/styles/index.css`,
`src/styles/tokens.css`. Réglé dans Réglages, Préférences, rubrique Langue.

| Langue | Code | Sens | Dates et nombres |
|---|---|---|---|
| English | `en` | gauche à droite | `en-US` |
| Français (source) | `fr` | gauche à droite | `fr-FR` |
| 中文 | `zh` | gauche à droite | `zh-CN` |
| 日本語 | `ja` | gauche à droite | `ja-JP`, année d'abord |
| Español | `es` | gauche à droite | `es-ES` |
| Deutsch | `de` | gauche à droite | `de-DE` |
| العربية | `ar` | **droite à gauche** | `ar-u-nu-latn` (chiffres occidentaux) |

Sept cartes, chacune sous le nom de la langue dans cette langue : quatre par rangée
sur un écran large, deux à 375 px. Sans choix, la langue du système est suivie si
elle est servie ; sinon l'anglais.

**En arabe, l'écran se retourne** :

- la barre latérale passe à droite, dépliée comme en rail ; la zone principale à
  gauche ; la navigation des Réglages à droite de la page ;
- dans le Chat, la réponse part de la droite et la bulle de la personne se range à
  gauche ; la flèche d'envoi est au bout gauche de la zone de saisie, le « + » à son
  début, à droite ;
- la croix d'une fenêtre est en haut à gauche ; les menus s'alignent sur le bord
  droit de leur bouton quand ils s'alignaient sur le gauche ;
- les flèches « retour » pointent vers la droite, les chevrons « suivant » vers la
  gauche, l'icône de la barre latérale la dessine à droite ; les icônes sans
  direction ne bougent pas ;
- les barres de défilement suivent le système (à gauche).

**Ce qui reste de gauche à droite dans une page arabe** : les blocs de code et le code
en ligne, les chemins, les commandes, les adresses, les jetons, les numéros de
version, les champs d'adresse, de mot de passe et de nombre, la valeur d'une ligne
à copier, les graphiques (Mon usage, comparateur de modèles). Une date et son heure
restent dans cet ordre (« 12/09/2026 14:05 »), les chiffres sont occidentaux.

**Ce que vous écrivez s'aligne selon sa propre langue**, pas celle de l'interface :
une question en arabe dans une interface française part de la droite, une réponse
en français dans une interface arabe part de la gauche, paragraphe par paragraphe.

Le sens est posé sur la page avant le premier rendu : l'écran ne s'affiche jamais
une fois dans le mauvais sens. La ligne de commande et l'extension VS Code sont en
français.

### Préparer Cowork, atelier bureautique

`src/components/cowork/PreparerCowork.tsx`, `src/lib/atelier.ts`,
`gateway/src/atelier.ts`. Carte du panneau droit de Cowork, placée après les
compétences.

Cowork sait manipuler des fichiers, mais il ne sait produire ni relire un
document Word, Excel, PowerPoint ou PDF tant que la machine ne porte pas les
bibliothèques correspondantes. La carte présente en trois temps :

1. **Diagnostic**, en lecture seule : outils système présents (Python, pip,
   Node, npm), bibliothèques installées ou manquantes, outils optionnels
   (LibreOffice, Poppler), obstacles écrits pour quelqu'un qui n'est pas
   informaticien, et place estimée.
2. **Confirmation** : nombre de bibliothèques, taille en mégaoctets, dossier
   exact (`<HELIX_DATA_DIR>/cowork`, par défaut `~/.helix/cowork`), et la
   mention explicite qu'aucun logiciel, projet ou réglage de la machine n'est
   modifié et qu'aucun mot de passe administrateur n'est demandé.
3. **Installation** puis **vérification** : les épreuves produisent puis
   relisent un document de chaque format, dans un dossier temporaire effacé
   ensuite.

Tout est déposé dans un environnement isolé : un environnement virtuel Python et
un préfixe npm sous `<HELIX_DATA_DIR>/cowork`. La liste des paquets est figée
dans le code de la passerelle, **le modèle ne décide rien**.

Une fois l'atelier installé, cinq outils sont proposés au modèle
(`gateway/src/bureau.ts`) : créer un document Word, un classeur Excel, une
présentation PowerPoint, un PDF, et relire ces quatre formats. Ils ne sont
offerts que si l'atelier est là, et Cowork n'en annonce l'existence au modèle
que dans ce cas (`BUREAU_ROLE`, `src/pages/CoworkPage.tsx`).

⚠ Ces cinq outils **n'apparaissent pas dans la carte Compétences** du panneau
droit : celle-ci ne liste que les outils des serveurs MCP
(`src/components/cowork/CoworkPanel.tsx`), et les outils bureautiques sont
fournis par la passerelle elle-même. L'utilisateur ne voit donc nulle part ce
que Cowork sait produire, ce qui mérite d'être corrigé.

Le modèle fournit des **données**, jamais du code : les scripts sont des
constantes du module, les paramètres voyagent en JSON sur l'entrée standard, et
chaque chemin est résolu par `realpath` puis comparé à la racine de l'espace de
travail.

⚠ Ce n'est pas un outil d'exécution générique : cinq gabarits, pas davantage. Un
graphique, une mise en forme fine ou une conversion de format ne sont pas
réalisables.

### Découpage des tâches lourdes

`gateway/src/plan.ts`, boucle par étapes dans `gateway/src/chat.ts`. Visible
dans la conversation : « Le modèle juge s'il faut découper la demande... »,
puis le plan, les étapes annoncées une à une (les parties d'une étape
redécoupée, en retrait, sous elle), et un récapitulatif final.

Un petit modèle ne tient pas un plan de douze actions. **C'est lui qui juge**,
à chaque demande, s'il faut découper (0.20.0) : un premier appel court, sans
outils et sans raisonnement (1 à 3 secondes mesurées sur qwen3-8b), lui montre
la demande et la conversation qui précède. Une question ou une action simple
part en direct ; un travail composé revient en plan, avec l'objectif reformulé
en entier (une demande comme « vas-y » ne se comprend qu'avec la conversation).
La passerelle exécute ensuite **une étape à la fois**, chacune avec sa propre
boucle d'outils et un contexte réduit. L'avancement est tenu par l'instance,
pas par le modèle.

**Une étape trop grosse est redécoupée**, au lieu d'arrêter le travail : actions
épuisées, ou agent qui décrit au lieu de faire, et le modèle en fait 2 à 8
parties plus petites, en tenant compte de ce qu'elle a déjà fait. Jusqu'à trois
niveaux, 60 étapes au plus pour une demande.

**Rédaction longue** (outils coupés) : un rapport, un dossier, un compte rendu
jugés longs par le modèle sont écrits partie par partie, chaque partie avec le
plan entier sous les yeux et la fin de la précédente pour enchaîner.

**Le régime s'adapte à la taille du modèle** (fonction `strategie`). Barème exact
du code :

| Taille annoncée | Découpage | Budget d'outils par étape | Budget en exécution directe |
|---|---|---|---|
| moins de 14 milliards | jugé par le modèle, étapes courtes | 8 | 30 |
| de 14 à 45 milliards | jugé par le modèle, étapes larges | 14 | 40 |
| 45 milliards et plus | jamais | 20 | 50 |
| inconnue, moteur **local** (`lmstudio`) | jugé par le modèle, par prudence | 8 | 30 |
| inconnue, moteur **distant** | jamais, supposé capable | 8 | 50 |

La taille vient du nombre de paramètres annoncé par le backend ; à défaut, elle
est estimée à partir de la taille du fichier, à raison d'environ 0,6 Go par
milliard de paramètres. Le budget d'exécution directe est plafonné par
`HELIX_MAX_ETAPES`, **30 par défaut**. Un premier plan compte au plus 15 étapes ;
un plan d'une seule étape est abandonné. **Une demande qui porte une image
n'est jamais découpée** : les étapes repartent d'un contexte réduit au texte.

Garde-fous appris en essai réel :

- **ce qui passe d'une étape à l'autre, c'est ce que les outils ont lu**, pas
  seulement le résumé du modèle : le nom de chaque fichier lu et un extrait de
  son contenu. Mesuré sur qwen3-8b : résumé en « les clients sont Martin,
  Dupuis et Rose », la correspondance facture-client s'était perdue et deux
  factures ont été rangées chez le mauvais client ; avec les relevés, les
  quatre sont au bon endroit ;
- **une étape se juge à ce que les outils ont rendu, pas à ce que dit le
  modèle.** Une étape d'action sans modification réussie, ou dont des
  modifications ont échoué, est reprise une fois avec le message d'erreur sous
  les yeux ; « rien à faire » n'est accepté que si le modèle a vérifié l'état
  réel (au moins une lecture) sans échec. Mesuré : huit déplacements refusés
  par le serveur de fichiers, un compte rendu « les factures ont été
  déplacées », et l'ancien code affichait « fait » ;
- **une étape qui a modifié quelque chose est contrôlée** : le modèle regarde
  l'état réel avec ses outils de lecture, finit ce qui manque, et son nouveau
  compte rendu remplace l'ancien (l'étape affiche « contrôlée »). Mesuré sur
  qwen3-8b : vingt et un fichiers renommés sur vingt-quatre, aucune erreur
  d'outil, et « les 24 fichiers ont été renommés » ; aucun contrôle des retours
  d'outils ne voit ce qui n'a pas été tenté. **C'est ce constat qui tranche** :
  s'il a regardé sans échec, l'étape est faite, même si des tentatives
  intermédiaires avaient raté ; s'il n'a pas regardé, le verdict des outils
  tient ;
- **un fichier s'écrit d'un seul jet** : un plan qui crée un fichier vide puis
  y revient (menu, contenu) est regroupé en une étape « écrire ce fichier en
  entier » ; le planificateur reçoit un exemple de plan de site, qu'un petit
  modèle suit bien mieux qu'une règle. Mesuré sur qwen3-8b : un site planifié
  par morceaux s'est arrêté au milieu, faute de savoir modifier un fichier par
  morceaux ; écrit fichier par fichier, il a abouti ;
- **revue finale de la demande entière** : une fois les étapes faites, le
  modèle relit la demande d'origine contre les fichiers (rien de manquant, rien
  en double, rien en trop, ce qui doit être identique l'est) ; ce qui manque
  devient des étapes de complément, deux tours au plus. Mesuré : un site dont
  toutes les étapes étaient « faites » avait une feuille de style vide ;
- **le contrôle d'une étape ne juge que cette étape** : il reçoit la liste des
  étapes suivantes, qu'il ne doit pas compter comme manquantes (mesuré :
  « créer le dossier » jugée incomplète faute d'application écrite, et
  redécoupée en toute l'application) ; une étape est une **lecture** si son
  premier verbe l'est (« lire le dossier … à remplacer » n'est pas une action),
  et lire ce qui n'existe pas encore est un constat transmis, pas une panne ;
  un redécoupage ne reprend jamais un fichier qu'une étape suivante écrit ;
- **la revue finale reçoit le contenu des fichiers modifiés**, relu par
  l'instance (16 000 caractères au plus) : mesuré, sans lui le modèle concluait
  « tout est fait » sans avoir relu un fichier ; elle vérifie aussi la langue
  des textes affichés et l'effet immédiat de chaque action. Une revue qui ne
  conclut pas est dite « non concluante », pas « manques » ;
- **contrôle automatique du code web** (`gateway/src/controleWeb.ts`) : un
  programme, pas un avis. Il vérifie les fichiers liés (style, script, image,
  lien entre pages), les fonctions appelées depuis le HTML, les éléments
  cherchés par un script, la syntaxe JavaScript et CSS, le script qui vide le
  conteneur de ses propres champs, la page à accents qui ne déclare pas son
  encodage (« tĆ¢ches »), la classe posée par un script qu'aucune règle de style
  ne peut atteindre (une coche qui ne barre jamais), le script ou la feuille
  qu'aucune page ne charge, et les textes d'interface en anglais quand la
  demande est en français. La revue finale le lance sur les fichiers
  modifiés, le donne au modèle à corriger, le relance ; ce qui reste figure au
  récapitulatif. Le modèle peut aussi l'appeler (« Contrôle du code web »).
  Mesuré : une liste de tâches « relue et terminée » dont la page ne chargeait
  ni son style ni son script, dont le bouton appelait une fonction absente, et
  dont le script effaçait son propre champ de saisie ;
- **un appel d'outil au JSON mal refermé est réparé**, sur la forme seulement
  (accolade finale oubliée, virgule en trop) ; **jamais une valeur coupée en
  route** : refermer « decoupe/notes/202… » en fait un vrai chemin, faux.
  Mesuré avant cette règle : une note renommée « 202 ». L'appel est alors
  refusé et le modèle le refait ;
- **une étape redécoupée est contrôlée dans son ensemble** une fois ses parties
  faites (un sous-plan avait oublié une note), et un redécoupage part de l'état
  réel constaté en dernier, pas de ce qui avait été annoncé ;
- **déplacer un fichier vers un dossier le range dedans**, comme `mv` : c'était
  la cause de ces huit refus (le modèle donnait le dossier comme destination) ;
- une **étape ratée, et impossible à redécouper, arrête le plan**. Les
  suivantes s'appuyaient sur ce qu'elle devait produire ; les lancer quand même
  revient à demander au modèle de travailler sur une information qu'il n'a pas,
  et il l'invente. Le récapitulatif, construit à partir des retours des outils,
  dit où le travail s'est arrêté, pourquoi, et ce qui n'a pas été lancé.

### Écrans de mise en route

`src/pages/InstanceSetupPage.tsx`, `src/pages/LoginPage.tsx` et
`src/components/onboarding/FirstRun.tsx`. Sans équivalent dans les captures.
Rattachement du poste (machine seule, ou adresse et jeton d'une instance
d'entreprise), puis création du premier compte ou connexion.

**Installation du moteur** (FirstRun, poste sans moteur ; sur Mac à puce Apple, aussi une
application LM Studio posée mais jamais ouverte) : le moteur est nommé, avec son éditeur,
et l'installation exige de cocher « J'accepte, pour moi ou au nom de mon organisation, les
conditions d'utilisation de LM Studio, qui en permettent l'usage personnel et interne, pas
un service fourni à d'autres », avec le lien vers ces conditions. La passerelle refuse
l'installation sans cet accord, et le consigne au journal. Un refus (membre non
administrateur, poste piloté par l'intégrateur) s'affiche en clair. Le téléchargement du
modèle est suivi ensuite sur le même écran, y compris un téléchargement laissé par un
lancement précédent, et après une coupure du flux (passerelle redémarrée). « Commencer »
n'apparaît qu'avec un modèle de Chat disponible ; un modèle conseillé pas encore essayé avec
Helix le dit. Poste piloté par l'intégrateur : rien à installer, « Vérifier à nouveau ».

**Emplacement du moteur et des modèles (28/09/2026)** : avant « Installer le moteur », et sur
l'écran « Bienvenue » avant le modèle, un encadré dit où iront le moteur et les modèles, la place
libre sur ce disque et la place nécessaire ; si elle manque, « Il n'y a pas assez de place sur ce
disque » et un autre disque proposé. « Changer » (administrateur) ouvre le sélecteur de dossier
dans l'application, un champ de chemin dans un navigateur ; un refus (espace des agents, dossier
personnel, partage réseau…) s'affiche sous le champ ; « Revenir à l'emplacement habituel ». Vu
dans le navigateur le 28/09/2026 (passerelle jetable, LM Studio et llama.cpp, fr et en, 1280 et
375 px) ; le sélecteur de l'application empaquetée pas essayé.

**Essai du modèle (27/09/2026)** : après le chargement, une étape de plus, « Vérification
de … : une courte question d'essai... ». Un modèle qui répond mal sur cette machine (réponse
vide, en boucle, faite de signes, ou dans un autre alphabet) cède la place : « … ne répond
pas correctement sur cette machine, essai de … », puis le téléchargement et le chargement du
suivant, sur la même barre. Si aucun ne reste : « … ne répond pas correctement sur cette
machine. », avec la piste (sélecteur de modèles, ou modèle par une clé). **Pas vu à l'écran**
(batterie seule, faux moteur) : les textes sont ceux de l'état de mise en route déjà affiché.

L'écran de connexion a quatre étapes possibles : choix du compte (un cadenas
pour ceux qui ont un mot de passe, « Mot de passe à choisir » pour un compte
créé avant 0.9.0), mot de passe, **premier mot de passe** (avec confirmation),
et **code de vérification** quand la double authentification est active (code
de l'application ou code de secours). Quand l'instance l'**impose** et que le
compte ne l'a pas encore : QR code et clé lisible, premier code, puis les dix
codes de secours avec copie, avant d'entrer. La création exige un mot de passe de 10
caractères et sa confirmation : le bouton reste inactif sinon. La carte défile
quand la fenêtre est basse. Voir `SECURITE.md` § 2.

---

## 7. Coquille applicative

`src/components/layout/`. Conforme aux captures, à une exception près.

- **Fenêtre** : barre de titre native discrète. Sur macOS, feux tricolores
  calés à 12 px du rail replié.
- **Barre latérale** : en-tête de marque, bloc de navigation principal
  (Chat, Cowork, Code avec badge BETA), bouton « Nouveau Chat », liste
  secondaire (Projets, Agents, Bibliothèque, Réunions, Groupes, Tâches),
  recherche, liste des conversations, pied avec avatar, thème, notifications,
  réglages et aide. Les entrées sont filtrées par les modules actifs.
- **Barre latérale repliée** : rail d'icônes, mêmes entrées.
- **Cadre de focus** (29/09/2026, `lib/modaliteSaisie.ts`) : un anneau vert, discret, seulement
  après une navigation au clavier (Tab, flèches) ; un clic ou un toucher l'éteint, et un envoi par
  Entrée ne l'allume pas sur le bouton qui reprend le focus.

**Chaque chat porte quatre actions au survol** (0.22.0, renommer ajouté depuis) : **renommer** (aussi par double clic ; Entrée garde, Échap annule), partager, **archiver**,
supprimer. Archiver range le chat sous « Archivés », en bas de la liste, repliable et
compté ; rien n'est effacé, et un clic le remet en place. C'est un rangement
personnel : archiver un chat partagé ne le retire pas de la liste des autres.
Supprimer efface les messages pour de bon, sans corbeille — d'où l'intérêt d'avoir
les deux gestes côte à côte. Vérifié dans le navigateur : archivage, section
« Archivés (1) », désarchivage, et la marque enregistrée dans l'instance
(`archivedBy`), donc retrouvée sur un autre poste.

**La cloche de notifications fonctionne (0.22.0)** : pastille comptant les non lues,
panneau qui s'ouvre vers la droite (aligné à gauche du bouton : aligné à droite, il
sortait de l'écran), « Tout lu » et « Effacer », et cinq genres d'entrées — mise à
jour de l'application, mise à jour du moteur des agents, accord attendu, tâche
terminée ou en échec, chat partagé. Un clic ouvre l'écran concerné et marque l'entrée
lue. Rien n'est inventé : chaque entrée vient d'une source déjà en place.

**Le « ? » ouvre l'aide (0.22.0)** : vingt articles le 28/09/2026 (dont « Code :
OpenCode ou Codex », « Joindre un document au Chat », « Mon usage : ce que coûtent vos
modèles », le modèle de chaque agent et « Signaler un problème »), traduits comme le
reste de l'interface, cherchables sans accent ni casse, écrits pour dire ce que le logiciel fait vraiment, limites comprises.
Tout est embarqué : l'aide fonctionne sans Internet. En pied de fenêtre, l'adresse de
support de l'intégrateur, le lien vers son site, et un bouton qui copie les
informations techniques (version, cadre d'exécution, adresse d'instance, système) —
ni messages, ni documents, ni clés. Depuis le 27/09/2026, un bouton **« Signaler un
problème »** y referme l'aide et ouvre l'écran du même nom (Réglages, voir § 6).

**Bandeau « fichier des Chats illisible »** (25/09/2026,
`src/components/layout/AvisChatsIllisibles.tsx`) : par-dessus l'écran, où que l'on
soit, quand le fichier chiffré des Chats du poste n'a pas pu être lu au démarrage. Il
dit ce qui s'est passé (trousseau refusé ou verrouillé, fichier qui ne se déchiffre pas,
fichier qui ne s'ouvre pas), que rien n'est effacé avec le chemin de la copie gardée,
ce qui va se passer selon ce que l'instance a répondu (en cours de relecture, Chats
rendus avec leur nombre, aucun Chat sur l'instance, instance pas relue, instance
injoignable, place pleine), et ce que la personne peut faire (redémarrer, autoriser le
trousseau, contacter l'administrateur). Une croix le ferme ; il revient si la situation
change. Il ne promet jamais le retour des Chats tant que l'instance ne les a pas rendus.
**Vu le 25/09/2026** dans l'application de bureau (profil d'essai, fichier remplacé par
des octets quelconques) : « Vos Chats sont revenus depuis l'instance » avec les trois
Chats dans la liste, puis, l'instance coupée, « L'instance n'est pas joignable : vos
Chats reviendront d'elle au prochain démarrage où elle répondra ». Pas vu : le trousseau
refusé (ce cas n'a pas été provoqué).

Depuis 0.16.0, toutes les entrées de la navigation mènent à un écran qui fonctionne.
Depuis 0.22.0, plus rien n'est grisé au pied de la barre.

**Écran de connexion (0.23.0)** : sous le mot de passe, un interrupteur « Rester
connecté sur ce poste », et une phrase qui dit ce qu'il fait vraiment — le mot de
passe n'est conservé nulle part, c'est la séance qui dure trente jours au lieu de
douze heures, et elle se révoque dans Réglages, Sécurité. Le choix suit toute la
connexion, second facteur compris.

**Réglages, Profil → Collègues (0.23.0)** : carte « Inviter un collègue ». Une
adresse, un bouton, et le collègue reçoit un mail contenant l'adresse de
l'instance et un code. Les invitations en attente sont listées avec leur date de
péremption et un bouton « Annuler ». Sans boîte aux lettres branchée sur
l'instance, l'écran le dit et affiche les deux lignes à transmettre de vive voix,
en chasse fixe : c'est ce que la personne va dicter.

**Écran de mise en route (0.23.0)** : le second champ s'appelle désormais
« Code d'invitation, ou jeton d'instance », et l'aide change selon ce qui est
tapé. Le code n'est pas masqué : il se recopie depuis un mail, souvent à la
main, et le masquer ferait échouer une saisie sur deux sans rien protéger.

**Écran de connexion, sur invitation (0.23.0)** : la personne arrive directement
sur la création de compte, l'adresse pré-remplie et verrouillée (c'est celle du
code), avec un encart qui dit que le mot de passe n'appartiendra qu'à elle.

**Réglages, Préférences → Langue (0.25.0)** : trois cartes à l'origine, sept depuis le
30/09/2026 (« Langues et sens d'écriture », § 6), chacune portant le
nom de sa langue dans sa propre langue — Français, English, 中文 — avec, à l'origine, la part
réellement traduite, mesurée sur le catalogue et non déclarée (ligne retirée le 25/09/2026). Une phrase sous
le titre prévient que le choix recharge la page, et une autre, en bas, dit ce
qui n'est jamais traduit : ce que vous écrivez, et certains messages venus de
l'instance.

**Cowork, panneau de droite (0.24.0)** : deux cartes là où il n'y en avait
qu'une. « Outils » liste ce que les connecteurs savent faire. « Procédures »
liste ce que la maison sait faire : chaque procédure porte un interrupteur, se
modifie d'un crayon, et une ligne dit combien de caractères partent au modèle à
chaque message. « Créer une compétence » ouvre un formulaire de trois champs
(nom, quand s'en servir, la procédure) et n'est plus grisé.

**Réglages, Abonnement (0.24.0)** : écran présent uniquement quand le module est
allumé, c'est-à-dire chez le prestataire qui héberge les modèles, jamais dans une
installation en marque blanche. Il commence par dire que le logiciel est gratuit
et que ce qui se paie est le calcul, avec ce que la plateforme comprend dans chaque
formule ; puis les modèles hébergés en Europe (30/09/2026 : polyvalent, GLM-5.3 Flash,
crédit ×1 ; rapide, DeepSeek V4.1 Flash, crédit ×2,5), avec ce qu'ils consomment du
crédit, qui se décompte sur les jetons lus et écrits (les millions de jetons des cartes
sont dits « environ ») ; puis les formules, sous un sélecteur Mensuel /
Annuel : Particuliers (Découverte, Plus, Pro, Max, TTC) et Entreprises (Équipe,
Équipe Premium, HT par poste, et Entreprise sur devis), avec le prix de lancement
barré, les jetons par modèle et leur équivalent en échanges par jour et en tâches
par mois (refait le 29/09/2026, PROJET.md). Il se termine par un encart
d'avertissement : les formules ne sont pas ouvertes, rien n'encaisse, les prix sont
une proposition. Les deux boutons (« Demander un devis », « Écrire pour être
prévenu ») ouvrent la messagerie de la personne.

**Réglages, Profil → Ouvrir l'instance (0.24.0)** : une fois l'instance ouverte,
les adresses ne sont plus alignées en vrac. Deux blocs nommés : « Vos collègues sont
sur le même réseau » (même Wi-Fi, même câble) et « Vos collègues sont ailleurs ».
Le second affiche l'adresse du tunnel quand un réseau privé est actif sur la
machine, et sinon explique ce qu'il faudrait — sans jamais conseiller d'ouvrir un
port sur la box. Chaque adresse porte un bouton « Copier ». Un encart rappelle que
cette machine doit rester allumée, et qu'une équipe qui travaille en continu a
besoin d'une machine qui ne s'éteint pas.

**Réglages, Profil → Inviter un collègue (0.24.0)** : après l'envoi, trois lignes
à copier plutôt qu'à recopier — le lien (un clic suffit), l'adresse, le code —
chacune avec son bouton et une phrase qui dit à quoi elle sert.

**Écran de mise en route, sur lien d'invitation (0.24.0)** : les deux champs
arrivent remplis, et un encart nomme l'instance visée : « Elle rattachera ce poste
à <adresse>. Si cette adresse ne vous dit rien, n'allez pas plus loin. » Le
rattachement n'est **pas** automatique : un lien peut venir d'ailleurs que du mail
attendu. Quand le poste est déjà en service, un second encart le dit et le bouton
de retour devient « Rester sur ce poste ». Le champ d'adresse accepte aussi qu'on
lui colle le lien entier : il le découpe et remplit les deux champs.

**Réglages, Sécurité (0.23.0)** : une séance ouverte ainsi porte la mention « reste
connecté » à côté de « ce poste ». Et le journal d'activité dit désormais ce qu'on
regarde : « vous voyez vos propres actions, et celles de l'instance elle-même » ou,
pour la personne qui administre l'instance, qu'elle voit l'activité de tout le monde,
en précisant d'où lui vient ce rôle (profil de déploiement, ou premier compte créé).

---

## 8. Questions ouvertes de l'inventaire d'origine

Reprises ici avec ce qui a été tranché.

| Question de juillet 2026 | Tranchée |
|---|---|
| « Discussion » ou « Chat » | ✅ **Chat**, choix client du 24/07/2026 |
| Libellé « Majordome » pour l'agent par défaut | ✅ retenu |
| Couleur d'accent : émeraude ou coral | ✅ **émeraude** (`--accent`). Le token `--coral` n'existe plus nulle part dans le code |
| Barre de fenêtre macOS ou Windows | ✅ barre native, calage macOS |
| Noms de marques tierces (modèles, fournisseurs) | ✅ remplacés par le catalogue réel de la passerelle, et les connecteurs par des services réellement branchables |
| API développeur : page ou hors périmètre | ✅ page d'attente assumée, puis écran réel le 26/09/2026 (clés d'API) |
| Menu contextuel clic droit de la Bibliothèque | ↪ remplacé par le menu « ... » de chaque ligne (mêmes actions) |
| Graphique de coût : librairie ou SVG maison | ✅ SVG maison, sans dépendance. Les données restent fictives |
| Section « Organisation » des paramètres | ❌ non construite, aucune capture ne la montrait |

---

## 9. Récapitulatif pour un client

**Ce qui est livré et fonctionne** : Chat, Cowork, Code (OpenCode, et Codex pour le
propriétaire du poste), Projets, Agents, Bibliothèque, Réunions, Groupes, Tâches, et
dans les paramètres : Profil (photo comprise), Préférences, Sécurité (postes, journal,
double authentification), Personnalisation de l'IA, Bot Recorder, Connecteurs, Modèles
cloud, Entraîner un modèle (Mac), Contrôle de l'écran, API développeur (clés d'API,
depuis le 26/09/2026), Mon usage (prix publiés depuis le 27/09/2026), Confidentialité
(export RGPD), Installer les apps (macOS et CLI), Importer depuis d'autres IA, Signaler
un problème.

**Ce qui est annoncé et le dit à l'écran** : pas d'application mobile ; Abonnement sans
paiement branché. (« Créer une compétence » et le téléchargement direct, longtemps
« bientôt », fonctionnent.)

**À éprouver avant de le promettre** : le bot de réunion dans une vraie réunion
Google Meet (il l'a été face à une réunion simulée).


## Studio vidéo

Entrée « Studio vidéo » dans la navigation, route `/videos`. Projets libres ou
canevas « Vidéo produit » et « Histoire courte ». Nom, brief, préparation de trois
scènes par le modèle local de texte ; scènes éditables, déplaçables et duplicables,
jusqu'à douze. Modèle vidéo et format se choisissent dans le panneau de réglages.
Chaque scène possède son suivi, son aperçu et son téléchargement. Un bouton lance les
scènes manquantes dans l'ordre ; le montage final s'exporte en WebM. Le texte explique
les clips courts sans son et l'assemblage en temps réel, qui demande de garder la
fenêtre ouverte. Les erreurs restent à côté des scènes ; les contrôles de génération
sont indisponibles tant que le moteur n'est pas prêt.

## Reprise des projets de code et optimisation locale

Réglages, Importer : OpenCode et Zcode apparaissent lorsqu'un historique local est
trouvé. La sélection montre projets et Chats ; le projet repris apparaît dans Projets
avec « Continuer dans Code », vers son dossier existant. Un second import de la même
source réutilise le projet.

Réglages, Modèles locaux : diagnostic matériel, conseils déterministes, bascule du
profil de chargement par l'administrateur et consultation d'une instance locale de
texte déjà chargée. Le débit de cette consultation inclut la lecture initiale ;
aucun gain avant/après n'est annoncé.
