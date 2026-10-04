# Helix — intention, décisions, état

Ce document est la mémoire du projet. Les autres décrivent le code tel qu'il est ;
celui-ci dit **pourquoi il est ainsi**, ce qui a été écarté, et ce qui a changé d'avis
en cours de route.

Il existe parce que le développement s'est étalé sur plusieurs sessions de travail
séparées, et qu'une décision dont on a perdu la raison finit toujours par être
refaite à l'envers.

| | |
|---|---|
| Version | 2026.1004.1 (`package.json`) |
| Dernière mise à jour | 30 septembre 2026 |
| Vérifié | `npm run securite` : 2290 contrôles, 0 échec (30/09/2026, sur le code fusionné avec les vrais catalogues) ; `npm run typecheck` ; relevés à 100 % dans les six catalogues (interface 3 893 phrases, passerelle 1 503) ; essai Windows sur GitHub Actions ; `essai:cli`, `essai:vscode`, `essai:palmier` |
| Reste à essayer | sur les vraies machines : § 5, « Ce qui reste à essayer sur les postes de Medhi » |
| Documents liés | [ARCHITECTURE.md](ARCHITECTURE.md), [SECURITE.md](SECURITE.md), [SCREENS.md](SCREENS.md), [SIGNATURE.md](SIGNATURE.md), [README.md](README.md), [docs/GUIDE.md](docs/GUIDE.md) |

---

## 1. Ce qu'est Helix, et pour qui

**HelixAI**, une plateforme d'intelligence artificielle **open source**, en marque
blanche. Chaque organisation installe **sa propre instance**, chez elle, à son
identité visuelle (§ 3.8). Précisé par le client le 14/09/2026 : « je vends rien,
c'est open source ». Rien n'est hébergé ni revendu par le projet ; les mentions de
« l'agence » qui suivent désignent l'intégrateur qui installe et règle une instance,
quand il y en a un.

L'ergonomie a été reproduite d'après les captures d'un logiciel concurrent, puis
rhabillée aux couleurs de l'agence. On a reproduit une **architecture d'interface**,
jamais une marque : aucune trace du concurrent ne subsiste, ni nom, ni logo, ni
palette, ni nom de fichier, ni commentaire.

### La contrainte qui commande tout

**Souveraineté stricte : européen ou local.** Aucun fournisseur de modèle américain.

**Précisé par le client le 13/09/2026 :** la règle vise les **services** de modèles,
pas l'origine des poids. Un modèle aux poids ouverts, quelle que soit sa provenance
(américaine, chinoise ou autre), est accepté dès lors qu'il tourne sur la machine du
client ou chez un hébergeur européen : l'éditeur ne voit rien, ne facture rien et ne
peut rien couper. Ce qui décide, c'est la **licence** : Apache 2.0 ou MIT de
préférence ; une licence « maison » (Gemma, Llama, Qwen pour certains formats) impose
des obligations commerciales et se pèse au cas par cas. Un client peut toujours
exiger mieux (un modèle européen, Mistral) : c'est son droit, pas la règle par défaut.

**Élargi par le client le 13/09/2026, pour les modèles cloud :** le socle reste local
ou européen, et rien ne part ailleurs d'office. Mais une personne peut brancher la clé
de n'importe quel fournisseur (OpenAI, Anthropic, Google, OpenRouter comme Mistral ou
Scaleway), pour elle ou pour son équipe : « s'il veut utiliser sa clé OpenAI, il fait ce
qu'il veut ». L'agence peut aussi fournir des modèles cloud qu'elle facture. La
promesse devient donc : **chaque modèle dit où il tourne** (pays affiché dans le
sélecteur, avertissement avant de brancher un fournisseur hors UE), **aucun modèle
cloud n'est choisi d'office**, et une clé personnelle ne sert qu'à son titulaire.

Ce n'est pas une préférence, c'est l'argument de vente. Il a écarté d'emblée des
briques techniquement séduisantes, et il continue d'arbitrer chaque choix de
connecteur. Il impose aussi une discipline : **toute promesse écrite à l'écran doit
être vérifiable**. Un client qui ouvre son pare-feu et prend le produit en défaut sur
une phrase perd confiance dans toutes les autres.

### Règles de marque, non négociables

1. Aucun nom de produit en dur dans le code. Nom affiché, logo, couleurs et pied de
   page viennent de `src/config/branding.ts`, point de personnalisation unique.
2. Changer ce fichier suffit à rhabiller toute l'application, sans toucher un
   composant.
3. Aucune valeur hexadécimale hors de `src/styles/tokens.css`.
4. Interface écrite en français, accents corrects. Pas de tiret cadratin dans le
   texte affiché. Depuis la 0.25.0, **toute phrase affichée passe par `t("…")`**
   ou `tf("… {0} …", valeur)` : le français reste la langue d'origine et sert de
   clé, l'anglais, le chinois et (depuis le 28/09/2026) le japonais viennent des
   catalogues (ADR-045). Une phrase
   oubliée n'est pas une panne — elle s'affiche en français — mais `npm run i18n`
   la signale.

### Vocabulaire

| Terme retenu | À ne pas employer |
|---|---|
| Chat, Nouveau Chat | Discussion, Nouvelle discussion |
| Agent | Assistant |
| Catalogue | Officiel |
| Majordome | (agent d'orchestration) |

> Le prompt d'origine imposait « Discussion ». Le client a tranché pour « Chat » en
> cours de projet. C'est le premier exemple de décision inversée : elle est ici pour
> qu'on ne la retrouve pas à l'envers dans six mois.

---

## 2. Comment le logiciel est construit

```
Interface (React, Vite, Tailwind)
        │  apiFetch — jeton d'instance + jeton de séance
        ▼
Passerelle Helix (Node, zéro dépendance hors SDK MCP)
        │
        ├── Modèles ──── LM Studio (local) · cluster exo · service compatible OpenAI
        ├── Outils ───── fichiers (MCP) · bureautique · courrier · agenda · écran
        │                bibliothèque · réunions (Whisper sur la machine)
        ├── Agents ───── employés OpenClaw, instance dédiée (§ 3.4)
        ├── Code ─────── OpenCode en mode serveur
        └── Données ──── fichiers JSON chiffrés, ou PostgreSQL
```

Le tout est empaqueté dans une application Electron qui démarre elle-même sa
passerelle. Le poste client n'a **rien à installer** : ni Node, ni Python.

### Les quatre surfaces

**Chat** converse, et dispose des outils quand on les active.
**Cowork** agit sur les fichiers et l'écran, outils toujours actifs.
**Code** délègue à OpenCode.
**Tâches** doit accueillir les exécutions d'agent rattachées à des cartes.

Elles partagent le même moteur. **Ce qui les distingue n'est pas la technologie,
c'est le jeu d'outils et la surface.** Cette phrase est la clé de toute
l'architecture : on n'a pas quatre produits, on en a un, présenté de quatre façons.

---

## 3. Décisions, et pourquoi

### 3.1 Un seul moteur d'agent — OpenCode

Retenu en juillet 2026. Licence MIT, indépendant du fournisseur, boucle d'outils,
sous-agents, serveur pilotable. Réécrire un agent de code n'apportait rien.

**Exception décidée par Medhi le 27/09/2026 (§ 3.14)** : Codex, le programme officiel d'OpenAI,
peut remplacer OpenCode dans l'écran Code, pour le seul propriétaire du poste et avec son compte
ChatGPT. OpenCode reste le moteur par défaut et le seul partout ailleurs (Cowork, employés,
tâches, ligne de commande).

**Écartés :** Eigent (Apache 2.0, capable, mais lourd et très opiniâtre — à revoir
seulement pour du multi-agents parallèle clé en main) ; AionUi (on avait déjà notre
interface, on en a repris le motif, pas l'application).

### 3.2 Contrôle de l'écran

**Modèle : la famille Qwen3-VL, livrée ; OpenCUA, retenu pour les grosses machines.**
Le catalogue installé automatiquement propose Qwen3-VL 8B, 4B et 2B
(`VISION_CATALOG`, `gateway/src/provision.ts`), parce qu'ils sont diffusés au format
que LM Studio charge. OpenCUA (7B / 32B / 72B), plus précis, est reconnu par la
passerelle s'il est installé (rôle `gui`, détecté par son nom), mais n'est pas
téléchargé d'office. Gemma 3 4B, dernier recours jusqu'au 13/09/2026, a été retiré
(§ 3.9).

**UI-TARS écarté comme dépassé** : UI-TARS-72B plafonne à 38,1 sur ScreenSpot-Pro,
battu par un Qwen3-VL-8B à 52,7. La génération 2026 est bâtie sur Qwen3-VL.

**Environnement : `trycua/cua`**, pilotes ouverts, bac à sable, multi-systèmes.

**Ce qui avait été décidé au départ (ADR-005, juillet 2026), et ce qui est livré.**
Le principe : **l'agent a son propre ordinateur**, une machine virtuelle (cua,
Lume sur Mac) où il clique et tape pendant que la personne continue de
travailler sur le sien ; une erreur y reste confinée. Piloter l'écran réel de
la personne reste possible, mais comme un **choix explicite**, jamais par défaut.
Ce qui existe au 24/09/2026 (ADR-011) :

| Mode | Ce que l'agent pilote | État |
|---|---|---|
| `desactive` | rien | **par défaut** |
| `sandbox` | **la machine de l'agent** : un bureau Linux isolé (Docker, image cua + LibreOffice), préparé, démarré et arrêté par Helix (`gateway/src/machine.ts`) | **livré et vérifié le 24/09/2026** (voir plus bas) |
| `hote` | l'écran de la personne | livré et vérifié sur macOS en 0.10.0 ; activé dans Paramètres, Contrôle de l'écran, mot de passe redemandé |

Dans les deux modes actifs : chaque action qui modifie quelque chose attend
un « Autoriser » (carte à l'écran, deux minutes, puis refus) ; les outils
d'écran ne sont proposés qu'à un **modèle qui voit les images** (Qwen3-VL,
installé à la demande) ; avec un modèle sans vision, Cowork le dit (« Écran :
modèle sans vision ») au lieu de tenter.

**La machine de l'agent (24/09/2026).** Helix mesure l'ordinateur (mémoire,
disque, Docker) et conseille : bureau Linux isolé dès 12 Go et 12 Go libres ;
machine macOS (Lume) possible aussi sur un Mac à puce Apple de 32 Go, macOS
15.3 ou plus, 60 Go libres : la personne choisit « Bureau Linux » ou « Mac
virtuel » ; sans Docker, le Mac virtuel devient le conseil ; sinon pas de
machine, et il le dit. Image `helix-machine:N` construite par Helix depuis
`trycua/cua-ubuntu` épinglée : LibreOffice français préréglé (pas de fenêtre
de récupération, formats Microsoft, pas de saisie automatique), mise à jour de
cua au démarrage retirée (2 min gagnées), statistiques de cua coupées ; les
anciennes versions sont effacées. Ports sur 127.0.0.1 seulement, 3 Go de
mémoire au plus, un seul dossier partagé : `~/Helix/Machine`. Démarrée avec
l'instance si le mode est choisi, arrêtée à la fermeture. Écran en direct
dans le panneau de Cowork. En mode Auto, Cowork prend le modèle de vision.
Accord : un « Autoriser » vaut pour toute la demande (la carte le dit) ; un
refus aussi (la suite est refusée d'office, sans nouvelle carte). Actions
propres à la machine : `ouvrir_app` sur liste fermée (Firefox, Writer, Calc,
Impress, Fichiers), `saisir_tableau` (Calc au clavier depuis la zone de nom),
`enregistrer_document` (enregistre dans le dossier d'échange, vérifie le
fichier et **renvoie son contenu relu** à l'agent). Pas de découpage en étapes
quand l'écran est piloté ; relance si le modèle décrit l'action au lieu de la
faire (sauf document déjà enregistré ou refus).
Essais réels avec qwen3-vl-4b (16 Go) : Writer « Bonjour Helix » → essai.docx
juste (87 s, 4 actions, 1 carte) ; Calc Loyer/Courses/Transport/Total →
budget.xlsx juste, total 1 200 (89 s, 5 actions, 1 carte) ; depuis l'écran
Cowork → cowork.docx juste ; refus → 1 carte, rien exécuté. Sans les actions
dédiées, le même modèle échouait (tableau faux, enregistrement jamais fait).
**Limite constatée sur 16 Go** : machine (5 Go avec Docker) + modèle de vision
(4,8 Go) + Qwen3 8B demandé ailleurs saturent la mémoire ; Cowork machine et
Chat en parallèle se gênent. Mode `hote` avec Qwen3-VL : pas refait (il bouge
la souris du client).
Cowork, en dehors de l'écran : fichiers (dossier choisi ou « tout mon
poste »), bureautique (Word, Excel, PowerPoint, PDF via l'atelier), courrier,
agenda, Drive et Slack s'ils sont connectés, toujours sous approbation pour
ce qui modifie.

**La vérité à répéter au client, sans l'adoucir :** les agents de contrôle d'écran
auto-hébergeables réussissent environ **une tâche sur quatre** (OSWorld). Les
meilleurs propriétaires tournent autour de 79 %, mais ils sont fermés et américains,
donc exclus. **Ne jamais vendre le contrôle d'écran comme fiable.** Toujours préférer
un outil structuré — fichiers, MCP — quand il existe.

**Licence, vérifiée le 13/09/2026** sur les fiches des modèles : OpenCUA 7B et 32B
sous **MIT** (bâtis sur Qwen2.5-VL 7B et 32B, Apache 2.0) ; OpenCUA 72B sous MIT mais
bâti sur Qwen2.5-VL 72B, sous **licence Qwen** : usage commercial permis jusqu'à 100
millions d'utilisateurs actifs par mois, copie de la licence et mention d'attribution
à fournir, droit chinois. Détail au § 3.9.

### 3.3 Electron plutôt que Tauri

Toute l'exécution est en Node : passerelle, SDK MCP, serveur OpenCode, serveurs MCP
lancés par `npx`. Tauri aurait exigé un compagnon Node de toute façon, ce qui annulait
son avantage de taille.

### 3.4 Agents managés — OpenClaw et Hermes

**Décision de juillet 2026, toujours valide, et souvent mal recopiée :**

> **OpenClaw** seulement quand le besoin d'agents managés isolés, toujours actifs et
> multi-clients se confirmera. **Pas de Hermes maintenant** : deux cadres de travail,
> c'est deux fois la dette.

Un agent = une configuration sur le moteur commun. Une tâche = une exécution
rattachée à une carte. Tant que ce modèle suffit, aucun des deux n'apporte rien.

Hermes est « l'employé qui apprend », à mémoire longue. Il chevauche OpenClaw : on ne
prendra pas les deux.

> Un récapitulatif intermédiaire de ce projet a écrit « Hermes d'abord, puis
> OpenClaw ». C'était **l'inverse**. Corrigé le 5 septembre 2026.

**Réévaluation du 13/09/2026, décision en attente du client.** Le besoin est confirmé :
un agent qui travaille comme un employé autonome, 24 heures sur 24, avec tout ce que
sait faire un agent OpenClaw. Étude comparative publiée (voies A : OpenClaw tel quel,
B : agents natifs Helix, C : hybride où OpenClaw ne garde que les canaux). Faits
établis à la source :

- OpenClaw (MIT, fondation financée par OpenAI depuis février 2026) : bac à sable
  désactivé par défaut, outils exécutés sur l'hôte ; `CVE-2026-25253` corrigée en
  2026.1.29 ; plus de 824 skills malveillantes sur ClawHub en février ; « pas une
  frontière de sécurité » entre utilisateurs qui ne se font pas confiance ; WhatsApp
  par Baileys, contraire aux conditions de Meta ; Node 24.16+ requis.
- Branché tel quel, il contournerait l'approbation, le journal, le cloisonnement, le
  chiffrement, l'export et la suppression RGPD, et la marque blanche.
- **Pièce manquante quelle que soit la voie** : l'exécution des tâches vit dans la
  fenêtre (`src/lib/taskRunner.ts`) ; fermer l'application arrête l'agent. Il faut un
  moteur sur l'instance.

Recommandation de l'étude : voie B. **Décision du client, le 13/09/2026 : OpenClaw**
(« on utilise OpenClaw », version 2.0 et suivantes), déployable depuis la page Agents,
simple, et repartant de zéro : jamais l'installation personnelle d'OpenClaw de quelqu'un.

**Ce qui a été construit (0.11.0) : les « employés ».** Voie A, mais tenue par Helix :

- **Une instance OpenClaw à part**, lancée et supervisée par la passerelle
  (`gateway/src/employes.ts`) : dossier `<données>/openclaw`, port 18800 (réglable :
  `openclaw.port` du profil), boucle locale et jeton. Sa configuration est **réécrite
  par Helix** à chaque changement ; OpenClaw la recharge à chaud, les autres employés
  ne sont pas interrompus. Une installation personnelle d'OpenClaw sur la même machine
  n'est ni lue ni touchée (`OPENCLAW_STATE_DIR`, `OPENCLAW_CONFIG_PATH`).
- **Verrouillée** : profil d'outils minimal ; commandes système, navigateur, recherche
  web, médias, planification par l'agent, messagerie et extensions coupés ; fichiers
  limités à l'espace de l'employé ; aucune procédure intégrée (elles poussaient le
  modèle à inventer des outils) ; télémétrie, mises à jour, catalogue distant, annonce
  mDNS et « rêves » nocturnes de la mémoire désactivés.
- **Le modèle passe par la passerelle Helix** (un fournisseur par employé, pour que la
  consommation soit comptée à son nom : `employe:<id>`).
- **Les outils sont ceux d'Helix**, servis par MCP (`gateway/src/serveurOutils.ts`),
  un serveur par employé, sous la barrière d'approbation et le journal. Familles au
  choix : fichiers de l'équipe, mails, agenda, Google Drive, Slack, documents Office.
- **Les missions sont planifiées par Helix** (automatisations OpenClaw créées pour lui,
  jamais par l'agent : une automatisation peut exécuter une commande système).
- **Chacun lui parle dans sa conversation** (clé de session par personne) ; les
  échanges sont gardés par Helix, chiffrés, exportables et effacés avec le compte.
- **Autonomie** : par défaut, chaque modification attend l'accord d'une personne
  connectée (deux minutes) ; la nuit elle n'est pas faite et l'employé en est averti.
  Le propriétaire peut le laisser « agir sans demander » ; tout reste au journal.

Mesures sur un Mac mini, Qwen3 8B par LM Studio : déploiement 8 à 12 s ; réponse
simple 10 à 30 s ; réponse qui se sert des outils 1 min 30 à 3 min ; mission de bout en
bout (lister, écrire après accord, rendre compte) 2 min 20. Un modèle local plus gros
ou un hébergement européen raccourcit d'autant.

**Élargi en 0.12.0, à la demande du client (« l'ensemble des choses d'OpenClaw »,
« libre d'agir si on l'autorise ») :**

- **Modèle au choix** : local, fourni par l'agence, ou cloud par clé (voir § 1). **Un par
  employé** (27/09/2026, « pas tous le même ») : choisi à la création de l'agent, proposé
  selon son poste, changé dans ses réglages ; la passerelle sert à chaque employé le sien, et
  jamais un autre quand il a disparu (§ 5, entrée du 27/09/2026).
- **Trois paliers de liberté**, au choix du propriétaire : Encadré (ce qui précède),
  Étendu (recherche web par DuckDuckGo, lecture de pages, navigateur, envoi de messages
  sur ses canaux), Libre (en plus : commandes sur la machine de l'instance, rappels
  qu'il se programme, sous-agents, fichiers hors de son espace ; mot de passe, et code
  si la double authentification est active). Les rappels ne sont pas au palier Étendu :
  une automatisation OpenClaw peut exécuter une commande.
- **Canaux** : Telegram, WhatsApp (QR code affiché dans Helix), Discord, Slack,
  Mattermost. Chaque personne qui écrit a sa conversation ; un inconnu reçoit un code
  et le propriétaire l'accepte dans Helix (ou liste fixe). Sur un canal, l'employé ne
  touche pas aux outils de l'entreprise, aux commandes ni aux rappels, sauf si on les
  ouvre. WhatsApp passe par WhatsApp Web, contraire aux conditions de Meta : risque de
  suspension du numéro, dit à l'écran, numéro dédié conseillé.

Vérifié sur OpenClaw 2026.9.4 : recherche web réelle (103 s), commande exécutée au
palier Libre (sortie exacte de `date`), mot de passe exigé et refusé s'il est faux,
jeton Telegram vérifié chez Telegram (refus d'un faux jeton remonté en français), QR
WhatsApp réel affiché, outils de l'entreprise toujours disponibles depuis Helix quand
ils sont fermés aux canaux, retrait complet d'un employé et de ses canaux.

**Un seul geste : créer un agent (0.14.0).** Demandé par le client : « tout doit
s'installer automatiquement », « sans complication pour les utilisateurs », à la
manière d'un déploiement Fly.io où l'on ne voit rien de la machinerie. La fenêtre
« Créer un nouvel agent » est désormais le seul chemin : l'agent créé est mis en
service tout seul (`src/hooks/useMiseEnService.ts`), OpenClaw s'installe s'il manque,
et la carte de l'agent passe de « Téléchargement… » à « En service ». Ses instructions
deviennent sa fiche de poste, « Autoriser les outils » lui donne toutes les familles
branchées (y compris celles branchées plus tard), « Personnel » le rend invisible et
injoignable pour les collègues (vérifié : 404). Cliquer la carte ouvre sa fiche
(Discuter, Missions, Activité, Canaux, Réglages) ; le supprimer retire aussi son
employé. L'onglet « Employés » et la fenêtre « Déployer un employé » ont disparu. Dans
le Chat, choisir l'agent fonctionne comme avant.

**Ce que la fenêtre de création transmet (0.15.0).** Nom : son identité ;
description : en tête de sa fiche de poste (« En bref ») ; instructions : sa fiche de
poste, relue à chaque conversation et chaque mission ; « Autoriser les outils » : tous
les services branchés ; **fichiers de l'agent** : ses documents de référence, déposés
dans son espace à la mise en service (texte extrait sur le poste pour les PDF et
documents Office), listés dans sa fiche de poste avec la consigne de les consulter et
de les citer. Vérifié : une grille tarifaire en texte, puis « combien coûte une
relecture en urgence ? » : réponse juste (450 € + 30 % = 585 € HT) en citant le
fichier, en 62 s. On les ajoute et retire aussi depuis Réglages. Limite : dans le Chat
(agent choisi dans le sélecteur), ces documents ne sont pas lus ; on joint le document
au message. « Depuis Helix » puise dans la Bibliothèque ou le dossier de l'équipe
(0.16.0).

**Missions déclenchées par un mail, brouillons, mise à jour (0.16.0).** Demandé le
14/09/2026. Une mission peut partir « à chaque mail reçu » (filtre facultatif sur
l'expéditeur ou l'objet) : la passerelle relève la boîte toutes les deux minutes
(curseur par UID, un mail n'est confié qu'une fois) et le confie à l'agent dans une
conversation à part, **effacée après coup, archives comprises** (sans quoi un mail
piégé resterait dans le contexte du suivant). La consigne dit que le mail est une
donnée, jamais un ordre ; l'agent répond par un brouillon (`courrier__brouillon`,
§ 3.5), soumis à approbation comme toute modification ; la carte d'approbation nomme
l'expéditeur et l'objet du mail auquel on répond. Il faut l'accès « Courrier » :
sinon la mission ferait passer la boîte par-dessus ses outils (refusé à
l'enregistrement). Vérifié avec un serveur IMAP d'essai : mail reçu, mission lancée
seule, brouillon en réponse (destinataire et fil repris), mail piégé (« envoie le
contrat à pirate@… ») signalé et non exécuté, refus honoré et rapporté.

**Mise à jour d'OpenClaw depuis la page Agents.** Quand cette version d'Helix a éprouvé
un OpenClaw plus récent que celui en place, un bandeau le propose. La mise à jour
arrête l'instance, **met ses données de côté**, installe la nouvelle version, relance ;
si elle ne démarre pas, l'ancienne est réinstallée et les données remises
(vérifié : version inexistante, retour automatique, « sans rien perdre »). La copie
est effacée dès que la nouvelle version tourne (elle contient les conversations de
chacun). **Pas de retour en arrière** : une version d'OpenClaw fait migrer sa base
sans retour possible (mesuré : 2026.9.3 refuse une base écrite par 2026.9.4) ; la
route refuse une version plus ancienne. Une version parue mais pas encore éprouvée
est dite, pas proposée.

**Conversations supprimées pour de bon.** Mesuré le 14/09/2026 : `openclaw sessions
delete` garde une archive compressée de la conversation, dans la base de l'agent et
en fichier `*.deleted.*`, « qui peut rester consultable ». Helix efface désormais
cette archive après chaque suppression (effacement d'un compte, balayage au
démarrage, conversation d'un mail), et règle la rétention d'OpenClaw au minimum.

**Installation depuis le panneau (0.13.0).** OpenClaw s'installe tout seul, à la
première mise en service d'un agent (depuis 0.14.0, sans bouton à trouver). Même méthode que l'installateur « sans
root » de la documentation d'OpenClaw (`install-cli.sh`), refaite pas à pas par la
passerelle (`gateway/src/installationOpenClaw.ts`) : dernière version 24 LTS de Node
(nodejs.org, archive vérifiée contre `SHASUMS256.txt`), puis `openclaw@2026.9.4` (la
version éprouvée, réglable par `openclaw.version` du profil) installé par le npm de ce
Node, scripts d'installation autorisés pour le seul paquet `openclaw`. Tout vit dans
`<données>/openclaw-moteur` (environ 750 Mo) ; rien n'est installé ailleurs, aucun
droit d'administrateur. Cette installation passe avant toute autre trouvée sur la
machine. Vérifié sur une instance vierge (dossier personnel et PATH vides, cache npm
froid) : un clic, installation, déploiement, réponse de l'employé.

Limites assumées : OpenClaw a besoin de Git (macOS le fournit avec les outils de ligne
de commande d'Apple, que macOS propose d'installer s'ils manquent) et de macOS 13.5 ou
plus récent ; les missions tournent
tant que l'instance tourne (Mac allumé, application ouverte, fenêtre fermée permise, ou
serveur hébergé) ; un petit modèle peut encore annoncer « fait » à tort, d'où le compte
rendu à relire dans l'onglet Activité. Pas de skills de ClawHub : c'est voulu (plus de
824 skills malveillantes y ont été recensées en février 2026).

**Windows : OpenClaw natif, sans WSL (décision du 28/09/2026).** Vu par Medhi sur un PC
Windows, écran « Agents IA », sur la carte d'un agent : « Pas encore en service :
L'installation automatique d'OpenClaw n'existe que pour macOS et Linux (sous Windows,
OpenClaw demande WSL) ». Sa question : installer WSL automatiquement ? **Non** : il y faut
les droits d'administrateur et un redémarrage, ce que Helix ne demande nulle part ailleurs.
Mais la documentation officielle, relue ce jour-là (docs.openclaw.ai/platforms/windows),
dit « OpenClaw ships a native Windows Hub companion app plus Windows CLI support », WSL2
« the most Linux-compatible Gateway runtime », recommandé, pas exigé. **Helix pose donc
OpenClaw en natif sous Windows (x64 et arm64)**, par le même chemin qu'ailleurs :

- le Node officiel en `.zip` (24.21.0, empreintes déjà épinglées pour l'atelier), extrait
  par le `tar.exe` de Windows, relié par une jonction (`<données>\openclaw-moteur\node`) ;
- npm lancé par `node.exe npm-cli.js` (jamais `npm.cmd`, que Node refuse de lancer sans
  `cmd.exe`), avec `--prefix` écrit en toutes lettres (un `.npmrc` de la personne ou
  `%APPDATA%\npm` l'enverrait ailleurs ; vaut aussi sur macOS et Linux), environnement sans
  `npm_*` quelle que soit la casse et un seul `PATH` (sous Windows, `{ ...process.env, PATH }`
  gardait aussi `Path`) ;
- OpenClaw lancé par `node.exe <paquet>\openclaw.mjs gateway run --port 18800`, sans
  interpréteur de commandes : **ni tâche planifiée ni service** (`openclaw gateway install`
  n'est jamais appelé), c'est la passerelle Helix qui le lance comme processus enfant, comme
  sur macOS ;
- PATH en `;`, variables transmises lues sans tenir compte de la casse, plus celles dont
  OpenClaw a besoin pour trouver PowerShell (`ProgramFiles`, `ProgramW6432`, `PSModulePath`…) ;
- arrêt par `taskkill.exe /PID <n> /T /F` de System32 (tout l'arbre : le lanceur d'OpenClaw
  relance Node pour lui-même ; `/F` parce qu'une application console sans fenêtre n'a pas
  d'autre arrêt, et c'est ce que fait OpenClaw quand on arrête sa propre tâche planifiée) ;
  l'orphelin d'une passerelle tuée net est reconnu par sa ligne de commande, lue par
  PowerShell (CIM, `Win32_Process` ; Windows n'a pas de `ps`, et `wmic` est retiré de
  Windows 11 24H2), jamais par le nom du programme ;
- renommages réessayés (antivirus), mémoire restaurée qui refuse `\` et `:` dans un nom.

Le code qui dépend du système est dans `gateway/src/plateformeOpenClaw.ts`, en fonctions qui
reçoivent le système en paramètre. **Ce qui a été essayé, sur le Mac seulement** :
`scripts/essai-openclaw-windows.mjs` (59 contrôles, aussi dans `npm run securite`, § 21) fait
tourner ces fonctions avec `win32` et `path.win32` (chemins avec espaces et accents,
`Path`/`PATH`, lanceur de npm, Node du PATH hors alias du Store, PowerShell encodé, taskkill),
et l'arrêt réel de `processus.ts` dans un Node où `process.platform` vaut `win32` (taskkill
intercepté). Le même script, avec `--installation`, a refait sur ce Mac une vraie
installation jetable par le nouveau chemin commun (Node épinglé, `npm-cli.js`, `--prefix`,
`openclaw@2026.9.4`, puis une passerelle OpenClaw lancée sur un port libre qui ouvre son
port), dossier personnel et données temporaires : passé le 28/09/2026. Sur un vrai
Windows, depuis le 29/09/2026 (entrée suivante) : l'installation telle que Helix la fait,
`openclaw --version`, une passerelle OpenClaw qui ouvre son port et son arrêt par taskkill,
sur les machines Windows de GitHub. **Pas essayé sur un vrai Windows** : l'application
empaquetée qui installe OpenClaw (la passerelle dans le `utilityProcess` d'Electron), un
employé qui travaille (messageries, en JavaScript ou WebAssembly, lu dans les paquets), la
ligne de commande lue par PowerShell, un antivirus autre que Defender, Smart App Control.

**« npm a échoué (code 1) » en déployant un agent sous Windows (Medhi, 29/09/2026).**
*Symptôme* : l'écran « Agents IA » disait seulement « OpenClaw ne s'est pas installé : npm a
échoué (code 1) ». `raisonNpm` gardait la première ligne d'erreur de npm, `code 1`, alors que
npm écrit ensuite le paquet (`path …\node_modules\<paquet>`), la commande et ce que le
script a dit ; et rien de la sortie de npm n'allait au journal : impossible de savoir, chez
Medhi, quel script s'était arrêté. *Reproduire* : `.github/workflows/essai-openclaw-windows.yml`
fait tourner `installerOpenClaw` lui-même (`scripts/essai-openclaw-windows.mjs --installation`,
Node privé téléchargé et vérifié, mêmes arguments, même `envInstallation`) sur trois machines :
Windows x64 ; Windows x64 avec un compte « Hélène Dupont » (espace et accents dans les
données, le dossier temporaire et le cache de npm), installé deux fois de suite comme un
« Réessayer » ; Windows arm64 (Defender actif). Journaux de npm, liste des modules natifs,
DLL importées et plus long chemin gardés en artefact. **Le défaut ne s'est pas reproduit** :
première exécution verte, par le chemin d'installation de la 2026.929.2
(https://github.com/medhiclb/HelixAI/actions/runs/36583023504), puis les trois machines
vertes (https://github.com/medhiclb/HelixAI/actions/runs/36587942660). La cause chez Medhi
tient donc à sa machine, et reste à lire dans son `passerelle.log` au prochain essai. *Ce
que le journal de Windows a montré* :

- en npm 11.19.0 (celui du Node 24.21.0), `--allow-scripts=openclaw` ne bloquait rien :
  « 4 packages have install scripts not yet covered by allowScripts », et les scripts de
  `@google/genai`, `koffi` (`cnoke.cjs --prebuild`), `tree-sitter-bash` (`node-gyp-build`) et
  `protobufjs` ont tourné, par `cmd.exe`, en plus des deux d'OpenClaw. On croyait le contraire
  depuis le 27/09 (SECURITE.md § 57.1, corrigé) ;
- chaque module natif a son binaire précompilé pour Windows x64 et arm64, qui se charge sans
  Visual C++ pour ceux qui ont un script (koffi, tree-sitter-bash : KERNEL32 et ADVAPI32
  seulement). Quand il ne se charge pas (Smart App Control, stratégie de l'entreprise, fichier
  abîmé), `node-gyp-build` et `cnoke` se rabattent sur une compilation, qui échoue sur un poste
  sans outils de compilation, avec « code 1 ». Deux modules sans script demandent
  `VCRUNTIME140.dll` (`@openclaw/fs-safe-win32-x64-msvc`, `@ubjs/node-win32-*-msvc`) : présent
  sur les machines de GitHub ; sans lui, ce n'est pas npm qui échoue (on croyait alors qu'OpenClaw
  ne démarrerait pas : l'essai de l'entrée suivante montre qu'il démarre, et que ces deux modules
  ne se chargent pas) ;
- plus long chemin posé : 205 caractères sous le dossier de données ; avec
  `C:\Users\<nom>\.helix\data`, la limite de 260 (chemins longs éteints, réglage d'office de
  Windows) n'est atteinte qu'au-delà de 33 lettres de nom de compte. Les machines de GitHub
  ont les chemins longs allumés.

*Correction* : (1) `npm install --ignore-scripts`, puis les deux scripts d'OpenClaw, et eux
seuls, lancés par `node.exe <fichier>` dans le dossier du paquet, sans `cmd.exe`
(`scriptsOpenClaw` : seule la forme `node <fichier du paquet>` est acceptée). Cela retire du
chemin quatre scripts inutiles quand le binaire se charge, dont les deux qui compilent, et
`cmd.exe` (vert sur les trois machines :
https://github.com/medhiclb/HelixAI/actions/runs/36590620759) ; (2) `raisonNpm` nomme le
paquet et la cause (première ligne du script qui ressemble à une erreur), dit à part un module
refusé par Windows (Smart App Control), une compilation sans outils, git absent, un fichier
tenu par l'antivirus (EBUSY, EPERM sur un renommage), un certificat refusé (proxy qui
inspecte), et, s'il n'y a vraiment que « code 1 », le dit tel quel ; sans chemins de la
machine, espaces compris (`sansChemins`, « Dupont\.helix\… » restait) ; (3) la sortie
entière de npm ou du script, avec le chemin du journal de npm, va à `passerelle.log`
(`journaliserNpm`), et l'écran dit où la lire. Contrôles : `npm run securite` § 41, et
`scripts/essai-openclaw-windows.mjs`. L'essai reste à part de `essai-windows.yml` (cinq à
dix minutes par machine, en parallèle, sans construire l'application), lancé à la main et à
chaque poussée sur `main` qui touche l'installation. **À faire chez Medhi** : réessayer avec
cette version ; si l'échec revient, la phrase à l'écran et `passerelle.log`
(`%APPDATA%\helix-plateforme\logs\`) diront le paquet et la cause.

**Les bibliothèques Visual C++ de Microsoft, installées par Helix quand elles manquent (décision de
Medhi, 29/09/2026).** Deux modules d'OpenClaw ont besoin de `VCRUNTIME140.dll`, présente sur les
Windows de GitHub et sur beaucoup de PC, pas sur tous. **Décision** : quand elle manque, Helix installe
le « Microsoft Visual C++ Redistributable » officiel, téléchargé chez Microsoft, version épinglée,
empreinte SHA-256 et signature Authenticode vérifiées, lancé avec l'autorisation d'administrateur que
Windows demande (UAC). **Exception à la règle des licences**, comme Python (§ 3.9). C'est la seule
élévation que Helix demande ; OpenClaw lui-même reste sans droits d'administrateur.

*DLL relevées* (table d'import des fichiers PE, `modules-dll.txt` de l'essai de GitHub, 29/09/2026) :

- **Windows x64** : `@openclaw/fs-safe-win32-x64-msvc` (`fs-safe-native.node`, éditeur de liens 14.51)
  et `@ubjs/node-win32-x64-msvc` (`uniffi-runtime-napi…node`, 14.44) importent `VCRUNTIME140.dll`, plus
  des `api-ms-win-crt-*` (la CRT universelle, livrée avec Windows 10 et 11). Aucun module n'importe
  `MSVCP140.dll` ni `VCRUNTIME140_1.dll`. Les autres modules natifs (koffi, node-pty, tree-sitter-bash,
  pi-tui, cua-driver) n'importent que des DLL de Windows ; `node.exe` (24.21.0) aussi (CRYPT32, WS2_32,
  USER32, dbghelp, ADVAPI32, IPHLPAPI, USERENV, SHELL32, ole32, WINMM, KERNEL32 : sa bibliothèque
  d'exécution est liée dedans).
- **Windows arm64** : seul `@ubjs/node-win32-arm64-msvc` (14.44) importe `VCRUNTIME140.dll` ; OpenClaw
  n'installe pas de `fs-safe` pour arm64.
- Les machines de GitHub ont `VCRUNTIME140.dll` 14.51.36247.0 (avec `VCRUNTIME140_1.dll` et
  `MSVCP140.dll`, même version) mais **pas** la clé de registre `…\VC\Runtimes\<arch>` : la détection
  lit donc le fichier, pas le registre.
- **Sans la DLL** (renommée dans System32 le temps de l'essai, PATH réduit à celui que Helix donne à
  OpenClaw) : les deux modules ne se chargent plus, mais `openclaw --version` répond et la passerelle
  d'OpenClaw ouvre son port. Ce sont les fonctions qui se servent de ces modules qui échoueraient en
  cours de route (lesquelles : pas relevé). Avec le PATH complet de la machine de GitHub, les modules se
  chargeaient encore, par une des copies posées par Python, Java, ImageMagick, l'AWS CLI…

*Épinglé* (`gateway/src/visualCpp.ts`) : version **14.51.36247.0** pour les deux, adresse versionnée vers
laquelle menait le lien permanent `aka.ms/vc14/vc_redist.<arch>.exe` le 29/09/2026 (par
`aka.ms/vs/18/release`), jamais le lien permanent :

- x64 : `https://download.visualstudio.microsoft.com/download/pr/ebdab8e5-1d7b-4d9f-a11b-cbb1720c3b12/843068991DAAA1F73AD9F6239BCE4D0F6A07A51F18C37EA2A867E9BECA71295C/VC_redist.x64.exe`,
  18 731 856 octets, SHA-256 `843068991daaa1f73ad9f6239bce4d0f6a07a51f18c37ea2a867e9beca71295c` ;
- arm64 : `https://download.visualstudio.microsoft.com/download/pr/ece44298-3977-4f73-ab91-c13fe79cfea8/B70EF586669A620A0A30A1156969C05C6A3831DC8F8BC992DA75779D2A92F944/VC_redist.arm64.exe`,
  11 870 816 octets, SHA-256 `b70ef586669a620a0a30a1156969c05c6a3831dc8f8bc992da75779d2a92f944` ;
- signature : `Valid`, `CN=Microsoft Corporation, O=Microsoft Corporation, L=Redmond, S=Washington,
  C=US`, racine « Microsoft Root Certificate Authority 2011 » (`8F43288AD272F3103B6FB1428485EA3014C0BCFE`).
  Le nom de dossier qui précède le fichier dans l'adresse est son SHA-256 : Microsoft l'écrit lui-même.
- version minimale acceptée : celle de l'éditeur de liens des modules, suivant la règle de Microsoft
  (« le paquet installé doit être égal ou plus récent que les outils MSVC qui ont construit
  l'application ») : x64 14.51, arm64 14.44. Un PC qui a une 14.x plus ancienne reçoit donc aussi le
  paquet (demande d'UAC comprise). **Monter OpenClaw**, c'est relire `modules-dll.txt` et ces deux
  nombres ; **changer de paquet**, c'est relever adresse, taille, empreinte, version et racine.

*Parcours* : l'installation d'OpenClaw passe par une étape de plus, avant Node, sous Windows et
seulement quand la DLL manque ou est trop ancienne : « Installation des bibliothèques de Microsoft
(Visual C++)… », avec l'avancement du téléchargement et la raison de la demande de Windows (et « si la
demande n'apparaît pas, regardez la barre des tâches » : l'UAC d'un programme sans fenêtre au premier
plan peut ne s'annoncer que là). Refus de l'UAC, ou compte sans mot de passe d'administrateur : l'écran
dit de relancer et d'accepter, ou de demander à l'administrateur du PC, avec la page officielle de
Microsoft ; « Réessayer » sur la carte de l'agent. Un OpenClaw déjà installé sans la DLL (posé avant
cette version, ou DLL retirée depuis) : la page Agents le dit, et « Installer les bibliothèques de
Microsoft » ne fait que cette étape, puis relance l'instance ; un démarrage raté le dit aussi. 3010 :
« Windows conseille de redémarrer le PC ». Détail et garde-fous : SECURITE.md § 64.

*Essayé sur GitHub* (`essai-openclaw-windows.yml`) : sur x64 et arm64, les deux paquets téléchargés,
taille, empreinte, version et signature vérifiées ; la détection forcée à « absentes »
(`HELIX_ESSAI_VISUAL_CPP=absent`, variable réservée aux essais), l'étape affichée, l'installeur réel de
Microsoft lancé avec élévation (code 0, déjà présent), puis OpenClaw installé, `--version` et sa
passerelle ; la DLL retirée le temps de l'essai (x64 avec le compte accentué, et arm64) : détection
« absentes », modules qui ne se chargent plus, détection « présentes » une fois remise. Exécutions :
https://github.com/medhiclb/HelixAI/actions/runs/36621998206 (relevé : signature et version), puis les
trois machines vertes : https://github.com/medhiclb/HelixAI/actions/runs/36625709938. Deux défauts
trouvés en route et corrigés : Windows PowerShell lancé depuis PowerShell 7 héritait de son
`PSModulePath`, et `Get-AuthenticodeSignature` ne se chargeait plus (la vérification échouait fermée :
paquet refusé) ; la version du paquet, supposée 14.50, est 14.51.36247.0. **Pas essayé** : un vrai PC sans Visual C++, la demande de l'UAC (les machines de GitHub
n'en ont pas), son refus, un compte standard, un code 3010, un proxy devant
`download.visualstudio.microsoft.com`, et ce qui, dans OpenClaw, échoue sans ces deux modules.

Ce qui reste limité sous Windows natif, dit pour cette capacité seulement : **les commandes
d'un employé Libre passent par PowerShell** (OpenClaw 2026.9.4, `getShellConfig` :
PowerShell 7 s'il est installé, sinon Windows PowerShell 5.1), pas par un shell Unix. L'écran
le dit au palier Libre quand l'instance tourne sous Windows (`moteur.plateforme`), et la
fiche de poste de l'employé lui dit d'écrire ses commandes en PowerShell. La recherche dans
la mémoire se fait par mots partout (Helix ne règle pas d'embeddings) : l'absence de
`sqlite-vec` pour Windows arm64 n'y change rien. Rien d'autre n'est coupé : les capacités
que la documentation d'OpenClaw réserve à Linux ou macOS (nœuds, conteneurs, bureau distant)
sont déjà coupées par Helix sur tous les systèmes.

### 3.5 Connecteurs vers les outils du client

**Décision révisée le 5 septembre 2026.** La position initiale — Composio, au motif
que ces logiciels sont américains de toute façon — a été rouverte et remplacée.

La bonne règle n'est pas « pas de serveur ». C'est :

> **Ne jamais introduire un tiers que le client n'a pas déjà choisi.**

| Niveau | Qui voit passer les données | Position |
|---|---|---|
| Protocole ouvert, ou serveur MCP local | Personne d'autre que le service lui-même | Voie principale |
| Serveur MCP **de l'éditeur** (`mcp.slack.com`, `mcp.notion.com`) | Slack, Notion, déjà contractés par le client | Acceptable |
| Routeur hébergé type Composio | Un tiers que le client n'a jamais choisi | Jamais par défaut |

**Pourquoi Composio reste écarté par défaut**, en trois points concrets :

1. Ce n'est pas la même donnée. Gmail détient le courrier ; Composio détiendrait un
   **jeton d'accès** à ce courrier, plus le contenu de chaque appel.
2. RGPD. C'est un sous-traitant que **l'agence** introduit, à faire figurer au
   registre du client et à justifier devant son délégué à la protection des données.
   Google, lui, le client l'a contracté seul.
3. Rayon de souffle. Une compromission de Composio exposerait les jetons de **tous**
   les clients d'un coup, sous le nom de l'agence.

L'avantage réel de Composio est reconnu : un seul parcours d'autorisation pour des
centaines d'applications. La position n'est donc pas « jamais » mais **jamais par
défaut, jamais en silence** : une case à cocher, avec ses implications écrites à côté.

**Protocoles retenus :** IMAP pour le courrier, CalDAV pour l'agenda, CardDAV pour les
contacts.

**Une écriture dans le courrier, et une seule : les brouillons (14/09/2026).** Le
connecteur était en lecture seule, par principe. Le client a demandé de « vrais
brouillons dans la boîte mail » : l'agent dépose un brouillon (commande `APPEND`,
drapeau `\Draft`) dans le dossier que le serveur désigne comme celui des brouillons
(attribut `\Drafts`, RFC 6154), sans jamais le créer. Destinataires vérifiés un à
un, noms et objet réencodés par Helix (aucun retour à la ligne venu du modèle
n'atteint un en-tête : pas de `Bcc:` glissé), corps en base64. Aucune autre
écriture : ni `STORE`, ni `EXPUNGE`, ni `DELETE`, ni `COPY`, ni `MOVE`, ni `CREATE`.

**L'envoi, toujours après accord (0.17.0).** Demandé le 14/09/2026 : « qu'un mail,
si je le demande, soit vraiment fait, avec la permission ». Coupé par défaut, il
s'active dans Paramètres, Connecteurs, Courrier, sans ressaisir de mot de passe (ce
sont les identifiants de la boîte) et, chez un fournisseur connu, d'un geste :
Helix connaît le serveur d'envoi de Gmail, Outlook, OVH, Infomaniak, Gandi, Free,
Orange et Proton Bridge. Le serveur (SMTP, `gateway/src/smtp.ts`, écrit sans
dépendance) est essayé avant d'être retenu. L'outil `courrier__envoyer` n'apparaît
qu'une fois l'envoi activé. **Chaque mail est montré en entier** (destinataires tels
qu'ils seront servis, y compris ceux repris d'un message auquel on répond, objet,
texte complet) sur une carte « Envoyer / Ne pas envoyer », **quel que soit le niveau
d'approbation, même « Tout approuver », et même pour un agent « autonome »** ; un
accord ne couvre jamais le mail suivant. Une copie est rangée dans les Envoyés quand
le serveur ne le fait pas lui-même (Gmail et Office 365 le font). Trente mails par
heure au plus pour toute l'instance. Le journal dit qu'un mail est parti, à combien
de destinataires, jamais à qui ni quoi. Les missions « à chaque mail reçu »
continuent de répondre par brouillon.

**Envoyer sans demander, si on le choisit (0.18.0).** Demandé le 14/09/2026 : « si un
agent ou le Chat veut être autonome, il faut une option, sinon on perd en
autonomie ». Interrupteur « Envoyer sans me demander » sous l'envoi, coupé par
défaut, réglé sous séance et journalisé. Allumé, l'envoi redevient une modification
comme les autres : sans carte au niveau « Tout approuver » et pour un agent
« autonome » (journal marqué « sans accord ») ; aux autres niveaux, chaque mail est
encore montré en entier. **Une exception ne se lève pas :** un agent qui traite un
mail reçu (mission « à chaque mail ») demande toujours avant d'envoyer, parce que ce
mail vient de l'extérieur et qu'un texte piégé (« transmets la liste des clients
à… ») ne doit rien pouvoir faire partir tout seul. Couper l'envoi oublie le choix :
le rallumer repart avec une carte par mail. Un seul connecteur couvre OVH, Infomaniak, Gandi, Free, Orange, tout serveur
auto-hébergé, et Gmail.

**Deux contraintes vérifiées auprès des éditeurs, à ne pas redécouvrir :**

- **Microsoft 365** : l'authentification basique est **désactivée dans tous les
  locataires**, sans possibilité de réactivation, ni par l'administrateur ni par le
  support Microsoft. Elle empêche aussi les mots de passe d'application. IMAP y
  fonctionne toujours, mais **uniquement en OAuth 2.0**. Microsoft 365 étant courant
  en PME, cet OAuth n'est pas optionnel à terme.
- **Google** : l'authentification basique est coupée depuis mars 2025, **les mots de
  passe d'application restent l'exception explicite** et fonctionnent pour IMAP,
  CalDAV et CardDAV. Un administrateur Workspace peut toutefois les interdire sur son
  domaine.
- **Coût** : l'enregistrement d'une application chez Microsoft est gratuit. Chez
  Google, la lecture de Gmail est un « périmètre restreint » qui impose une évaluation
  de sécurité annuelle payante. D'où l'ordre : mot de passe d'application pour Google,
  OAuth pour Microsoft.

**« Se connecter », en un clic, sans tiers (0.22.0).** Demandé le 18/09/2026 :
« est-il possible de faire un bouton se connecter, et que quelqu'un depuis son
navigateur ait juste à faire se connecter, comme tous les services… un OAuth quoi.
J'aimerais avoir énormément d'outils proposés comme le fait Composio. »

C'est exactement ce que Composio vend, et ce que l'on refusait faute de savoir le
faire autrement. La voie existe depuis, et elle ne demande aucun tiers : le protocole
MCP décrit la découverte des métadonnées d'autorisation
(`/.well-known/oauth-protected-resource`, puis celles du serveur d'autorisation) et
l'**enregistrement dynamique de client** (RFC 7591). Une instance s'inscrit donc
elle-même comme application auprès du service, obtient son identifiant, et mène
l'autorisation en PKCE. Il n'y a rien à créer chez l'éditeur, rien à coller, et le
jeton revient chiffré dans l'instance du client, où il reste.

Le tableau du dessus ne change pas ; c'est la ligne du milieu qui devient la voie
principale, parce qu'elle est enfin praticable :

| Ce qu'il fallait faire avant | Ce qu'il faut faire depuis 0.22.0 |
|---|---|
| Aller chercher un jeton chez le service, comprendre où il se cache, le recopier | Cliquer « Se connecter », dire oui dans son navigateur |
| Une intégration créée par personne compétente, par service | Rien |

Douze services sont branchés ainsi, vérifiés un à un le 18/09/2026 (leur serveur
répond, publie ses métadonnées et accepte l'enregistrement dynamique) : Notion,
Linear, Jira et Confluence, Asana, Sentry, Intercom, Canva, Figma, Webflow, Wix,
Vercel, Square, PayPal. Quatre autres publient un serveur mais veulent une
application déclarée chez eux : GitHub, Slack, Box, Airtable. (Revérifié le 28/09/2026 : Figma et Vercel retirés puis remis le même jour, Asana
passé en application déclarée, Airtable en un clic ; voir plus bas.) Une personne la crée
une seule fois, colle son identifiant, et le bouton « Se connecter » suffit ensuite à
tout le monde. Les autres restent branchés par jeton, avec un serveur exécuté sur la
machine de l'instance (GitLab, PostgreSQL, HubSpot, Firecrawl, Tavily, Exa, Brave,
Google Maps, Puppeteer, Kubernetes, et le même Notion, GitHub, Slack, Airtable par
jeton pour qui préfère).

**Composio reste écarté, et la raison n'a pas bougé** — elle est simplement devenue
sans objet : on a la commodité qu'il vendait, sans lui confier de jeton. Un service
branché l'est pour toute l'instance, et l'écran le dit.

**Drive et Slack (septembre 2026)** : pas de protocole ouvert, donc l'API de
l'éditeur, directement, sans intermédiaire, en lecture seule. **Chaque client crée
son application** : un client Google commun ferait de l'agence l'éditeur d'une
portée restreinte (vérification annuelle payante, et un seul point de rupture pour
tout le parc) ; une application Slack commune serait « distribuée hors
Marketplace », donc limitée à une lecture de 15 messages par minute depuis 2025-2026,
alors qu'une application interne garde les limites normales. Branchement réel à
éprouver chez un premier client (SECURITE.md § 10.3).

**Fait le 28/09/2026 : créer l'application chez le fournisseur, pas à pas, pour chaque
connecteur.** Demandé par Medhi : « quand je veux connecter Gmail, il n'y a pas la
redirection vers où je dois aller pour créer l'appli ; tout doit être simple, pour tout ».
- *Un guide par service* (`src/lib/guidesApplications.ts`, affiché par
  `src/components/settings/GuideApplication.tsx`) : en tête, un bouton « Ouvrir … » vers la
  page exacte de la console ; des étapes numérotées dans l'ordre de la console ; l'adresse
  de retour, avec « Copier », dans l'étape où on la colle ; les portées à cocher,
  copiables ; « À ne pas faire » ; « Si … affiche une erreur » (les erreurs que le
  fournisseur montre chez lui ne reviennent jamais à l'instance : elles ne s'expliquent
  qu'avant d'essayer) ; sous chaque champ, où le trouver dans la console. Google,
  Microsoft 365, boîte Outlook, LinkedIn, Facebook, Instagram, TikTok, X, Dropbox, Brevo,
  Mailchimp, Salesforce, Pipedrive, Zendesk, Shopify, Stripe, WooCommerce, GitHub, Asana,
  Zoom, Box, Slack (serveur et jeton), Telegram, Discord, WhatsApp. Liens et libellés
  relus sur la documentation officielle du 28/09/2026, sources au-dessus de chaque guide.
- *Gmail reprend l'application Google de l'instance* (celle de Drive et d'Agenda, une
  « Application de bureau ») au lieu de demander un identifiant de plus : retour par la
  boucle locale `http://127.0.0.1:<port>/`, comme Agenda (essayé en vrai le 26/09), donc
  rien à déclarer chez Google ; instance sur une autre machine : on colle l'adresse
  (`/helix/courrier/oauth/coller`). Si l'application n'existe pas, le formulaire de Google,
  avec ses quatre boutons (projet, activation des huit API d'un coup, Google Auth Platform,
  création du client), s'affiche dans le panneau de Gmail. Les panneaux Sheets, Slides,
  Docs, Forms, YouTube disent que l'application existe déjà et donnent l'activation de
  leur API. La boîte Outlook peut reprendre l'application Microsoft 365 de l'instance
  (une adresse de retour et deux permissions à lui ajouter).
- *Adresses de retour exactes* : l'état des connecteurs donne celle que « Se connecter »
  enverra (même fonction, `adresseDeRetour`), avant le premier essai ; Zoom la reçoit en
  127.0.0.1 (« Do not use localhost ») ; Outlook part sous « localhost » (le portail Entra
  refuse 127.0.0.1 en http) et se déclare sans port. Sur un poste (macOS comme Windows) :
  `http://localhost:8787/helix/oauth/retour` ; instance ouverte au réseau : son adresse en
  https, telle que le navigateur l'atteint.
- *Refus expliqués* (`gateway/src/refusOauth.ts`) : `access_denied` (utilisateurs de test,
  « Audience », application « Interne »), `invalid_scope`, `redirect_uri_mismatch`,
  consentement d'administrateur…, traduits, sans recopier le texte du fournisseur.
- *Aide intégrée* : « Brancher Gmail pas à pas » et « Créer l'application d'un service,
  pas à pas ». `npm run securite`, section 36.
- **Pas essayé** (aucun compte ni console ouverte, tout est derrière une connexion) : les
  consoles elles-mêmes, leurs libellés exacts en français, et les points que la
  documentation ne tranche pas : une « Desktop app » Google accepte-t-elle aussi un chemin
  (inutile désormais : Gmail revient sur `/`) ; LinkedIn, Instagram et Pipedrive
  acceptent-ils `http://localhost` (LinkedIn écrit « HTTPS », un fil de Pipedrive dit non) ;
  Zoom accepte-t-il 127.0.0.1 pour une « General App » avec secret ; Slack : son serveur
  MCP veut une adresse en https, un client confidentiel, et PKCE (seule voie pour
  localhost) le rend public pour de bon : sur un poste seul, l'écran renvoie à « Slack
  (par jeton) » ; les liens `#view/…` d'Entra ne sont documentés nulle part (lien
  officiel `go.microsoft.com/fwlink/?linkid=2083908`) ; la console d'administration de
  Box (`app.box.com/master`) et celle de Zendesk (`<sous-domaine>.zendesk.com/admin/`) ne
  sont pas citées telles quelles par leur documentation. LinkedIn : « Community
  Management API » ne s'accorde qu'à une application sans autre produit, alors que Helix
  demande `openid profile` sur la même application : la case « Page d'entreprise » ne
  peut donc pas aboutir telle quelle (à revoir : une seconde application LinkedIn ; fait
  le 29/09/2026, entrée suivante).

**Fait le 29/09/2026 : la Page d'entreprise LinkedIn, par une seconde application.**
Décision de Medhi : « fais au mieux ». *Pourquoi* : LinkedIn n'accorde le produit
« Community Management API » (celui des pages) qu'à une application neuve qui n'a aucun
autre produit (FAQ 4 de la page d'ensemble du produit, relue ce jour-là) ; la case « page »
du connecteur LinkedIn, posée sur l'application du profil (`openid`, `profile`,
`w_member_social`), ne pouvait donc jamais marcher. *Fait* :
- *Un fournisseur de plus*, `linkedinPage` (« LinkedIn (Page d'entreprise) »,
  `gateway/src/oauthNatif.ts`) : son identifiant, son secret et ses jetons, chiffrés comme
  les autres (`connecteursNatifs#linkedinPage#…`), la même route publique de retour
  (`/helix/oauth/retour`). Portées : `r_organization_social` et `rw_organization_admin`
  pour lire, `w_organization_social` si l'on coche la publication ; rien du profil. Le
  compte est reconnu par les pages qu'il administre (`organizationAcls`, rôle
  ADMINISTRATOR) et nommé par la première ; aucune page administrée : refusé, rien gardé.
- *Lu dans la documentation le 29/09/2026, et corrigé en conséquence* : le produit accorde
  `rw_organization_admin`, **pas** `r_organization_admin` (que l'ancienne case demandait :
  la page « increasing-access » ne le liste que pour Advertising API et Lead Sync API) ;
  `organizationAcls` rend la page sous `organization` ou `organizationTarget` selon les
  exemples (les deux sont lus) ; les statistiques de partage portent sur douze mois
  glissants (l'outil disait « depuis sa création ») ; les portées rendues sont « URL-encoded,
  space-delimited » (espace, virgule et `%20` acceptés) ; le jeton d'actualisation, pour
  les partenaires approuvés, vit un an (`refresh_token_expires_in`, lu désormais).
  Pages lues : community-management-overview, community-management-app-review,
  increasing-access, organization-access-control-by-role, posts-api, share-statistics,
  organization-lookup-api, authorization-code-flow, programmatic-refresh-tokens
  (learn.microsoft.com/en-us/linkedin/…), et l'aide LinkedIn a1665329 (vérification de
  l'application par un super administrateur de la page : « Settings », « Verify »,
  « Generate URL », lien valable 30 jours).
- *Outils* (`gateway/src/outilsNatifs.ts`) : `linkedin__pages`, `linkedin__publications`,
  `linkedin__statistiques` gardent leur nom mais passent par `linkedinPage` et ses jetons
  (aiguillés par leur nom exact, `OUTILS_PAGE_LINKEDIN`) ; publier au nom d'une page devient
  `linkedin__publier_page` (carte d'accord à chaque fois, administrateur seul) ;
  `linkedin__publier` ne publie plus qu'au nom du profil et refuse un `page`, en renvoyant
  à l'autre outil. Rien de la page tant qu'elle n'est pas branchée. `VERSION_LINKEDIN` vit
  désormais dans `oauthNatif.ts`.
- *Instance qui avait coché l'ancienne case* : rien n'est réécrit ; le choix « page » reste
  dans le compte, `aChoisi` ne le compte plus (la définition ne le propose plus), et le
  panneau du profil le dit et mène à la ligne de la Page (bouton « Brancher la Page
  d'entreprise »).
- *Écran* : une ligne « LinkedIn (Page d'entreprise) » sous LinkedIn, même logo ; son guide
  pas à pas (`guideLinkedinPage`) : bouton vers `https://www.linkedin.com/developers/apps/new`,
  application neuve, vérification par le super administrateur, demande du produit (adresse
  professionnelle, raison sociale, politique de confidentialité), paliers de développement
  puis standard, sans délai promis (LinkedIn n'en annonce pas), adresse de retour et
  portées copiables, « À ne pas faire » (aucun autre produit, pas l'application du profil,
  pas « LinkedIn » dans le nom ni le logo). Le guide et le panneau du profil disent que la
  page se branche à part. Aide intégrée (« Créer l'application d'un service ») mise à jour.
- *Vérifié* : `scripts/essai-natifs.mjs` (sections C, K, F : portées de chaque application,
  jetons de la page pour les outils de page contre un faux LinkedIn qui refuse ceux du
  profil, ancienne case ignorée, débranchement de la page seule) ; `npm run securite`,
  section 37. **Pas essayé avec un vrai compte LinkedIn ni une vraie application** (aucune
  n'a le produit) : l'examen de LinkedIn lui-même et sa durée ; si LinkedIn accepte une
  demande de portées sans `openid` sur une telle application (aucune page lue ne l'exige ni
  ne l'interdit) ; la forme réelle du champ `scope` rendu ; si un rôle autre
  qu'ADMINISTRATOR (CONTENT_ADMINISTRATOR) devrait aussi lister la page ; le jeton
  d'actualisation (réservé aux partenaires approuvés) ; l'adresse de retour en http sur un
  poste (LinkedIn écrit « HTTPS »). Au palier de développement, 100 appels par personne et
  par jour : lister les pages coûte 1 + un appel par page, à chaque outil de page.

**Fait le 28/09/2026 : Google Sheets, Google Slides, YouTube, LinkedIn, Facebook, Instagram
et TikTok (version 2026.928.2).** Demandé par Medhi : « il manque plein de choses :
Instagram, TikTok, LinkedIn, Google Sheets, Google Slides, Facebook, YouTube ; pas tout
Composio, mais les principales ». Aucun de ces services n'a de serveur MCP qui s'inscrit
seul : on parle à leur API depuis l'instance, sans intermédiaire, comme pour Drive et Slack
(`gateway/src/oauthNatif.ts` pour la connexion, `outilsNatifs.ts` pour les outils, écran
`src/components/settings/ConnecteurNatif.tsx`, dans Paramètres, Connecteurs).

| Service | Lecture (sans rien cocher) | En plus, si on le coche | Examen du fournisseur |
|---|---|---|---|
| Google Sheets | `spreadsheets.readonly` : lire une feuille | `spreadsheets` : écrire une plage, ajouter des lignes | aucun pour une application interne à un Workspace |
| Google Slides | `presentations.readonly` : lire le texte des diapositives | (rien) | idem |
| YouTube | `youtube.readonly` : chaîne, vidéos, statistiques | (rien : pas de publication) | idem |
| LinkedIn | `openid profile` : le profil | `w_member_social` : publier au nom du profil | aucun ; lire les posts d'un profil : **impossible** (`r_member_social` fermé par LinkedIn). La page d'entreprise, d'abord une case ici, a sa propre application depuis le 29/09/2026 (ligne suivante) |
| LinkedIn (Page d'entreprise), 29/09/2026 | `r_organization_social`, `rw_organization_admin` : pages administrées, publications, statistiques | `w_organization_social` : publier au nom d'une page | produit « Community Management API », examiné, sur une application neuve sans autre produit |
| Facebook (Pages) | `pages_show_list`, `pages_read_engagement` : pages, posts, réactions | `pages_manage_posts` : publier | aucun pour les personnes qui ont un rôle dans l'application (accès standard) ; revue de Meta et vérification de l'entreprise pour les autres |
| Instagram (compte pro) | `instagram_business_basic`, `instagram_business_manage_insights` | `instagram_business_content_publish` : publier une photo | idem Facebook (testeur Instagram compris) |
| TikTok | `user.info.basic`, `user.info.stats`, `video.list` | `video.publish` : publier une vidéo du dossier de travail | bac à sable sans examen (10 comptes) ; **tout ce qui est publié reste privé** tant que l'application n'a pas passé l'audit de TikTok |

Chaque organisation crée son application chez le fournisseur (l'écran dit comment, en
quelques étapes, et ce qui demande un examen) : Helix ne peut pas en fournir une commune,
pour la même raison que Drive. Les services Google reprennent l'application Google déjà
saisie pour Drive et Agenda. **Règles** : brancher, débrancher, enregistrer une application :
l'administrateur seul (un compte branché vaut pour toute l'instance et parle au nom de
l'organisation) ; lire : tout Chat ; **écrire une feuille ou publier : une carte d'accord à
chaque fois, même au niveau « Tout approuver »**, texte entier montré, et seulement pour
l'administrateur, au moment d'agir ; ni les employés OpenClaw ni l'agent de code n'ont ces
outils ; dix écritures ou publications par heure et par service au plus, un doublon dans la
demi-heure refusé ; Sheets écrit en `RAW` (une formule reste du texte). Détail et limites de
débit relevées dans la documentation officielle : SECURITE.md § 40 et les commentaires
d'`oauthNatif.ts`.

**Pas encore essayé avec un vrai compte, ni avec une vraie application de développeur**,
pour aucun des sept : tout est vérifié contre de faux serveurs OAuth et de fausses API
(`scripts/essai-natifs.mjs`, lancé par `npm run securite`, section 15 bis), écrits d'après la
documentation lue le 28/09/2026. L'écran le dit. À essayer sur le poste, service par
service : la connexion, une lecture, une publication. Points incertains à vérifier à ce
moment-là : LinkedIn et Meta demandent une adresse de retour en https, et l'instance d'un
poste répond en http sur 127.0.0.1 (peut-être refusée) ; `r_organization_admin` suffit-il
aux statistiques de page LinkedIn (non : le produit des pages accorde `rw_organization_admin`,
demandé depuis le 29/09/2026) ; la version d'API LinkedIn (`202609`) est à relever
chaque mois ; Meta liste aussi `pages_manage_engagement` pour publier, pas demandé.

**Fait le 28/09/2026 : X (ex-Twitter), branche `connecteur-x`.** Demandé par Medhi, « exactement
comme » les sept ci-dessus : mêmes fichiers (définition `x` dans `oauthNatif.ts`, outils
`x__profil`, `x__publications`, `x__publier` dans `outilsNatifs.ts`, écran
`ConnecteurNatif.tsx`, article « Connecter X » de l'aide), mêmes règles (lecture par défaut ;
publier se coche à la connexion, administrateur seul, carte d'accord à chaque post même au
niveau « Tout approuver », texte entier ; dix par heure, doublon refusé, `sousGarde`).

| Service | Lecture (sans rien cocher) | En plus, si on le coche | Offre de X |
|---|---|---|---|
| X | `tweet.read users.read offline.access` : le compte, ses derniers posts et leurs statistiques publiques | `tweet.write media.write` : publier un post de 280 caractères, avec une image du dossier de travail si on le demande | payante à l'usage (crédits d'avance) pour tout nouveau développeur depuis le 06/02/2026 ; plus d'offre gratuite ; Basic et Pro pour leurs abonnés |

Ce que la documentation de X dit le 28/09/2026 (SECURITE.md § 42.2, sources dans le code) : la
consigne de départ (« avec l'offre gratuite, Helix peut publier mais pas lire vos posts »)
décrivait l'ancienne offre gratuite, **fermée le 06/02/2026** ; l'écran dit donc l'état actuel :
publier 0,015 $ (0,20 $ avec une adresse), lire ses propres posts 0,001 $ quand le compte branché
est celui qui a créé l'application, 0,005 $ sinon, crédits nécessaires avant le premier appel.
L'application peut être « publique » (Native App, sans secret, PKCE seul) ou « confidentielle »
(Web App, secret envoyé par `Authorization: Basic`) : l'écran accepte les deux, le secret est
facultatif pour X seulement. X refuse « localhost » dans l'adresse de retour et n'a pas de joker
de port : le retour passe par la route publique de l'instance, réécrite en 127.0.0.1. L'image
passe par la lecture de la vidéo TikTok (renommée `fichierDuDossier`), plus la signature des
octets (JPEG, PNG, WebP). Logo : clé de marque `x`, icône neutre (`AtSign`) en attendant le logo
officiel, que l'agent des logos ajoute ; aucun tableau de connecteurs dans les README, ils n'ont
donc pas été touchés.

**Pas encore essayé avec un vrai compte X ni une vraie application de développeur**, et sans
crédits : vérifié contre un faux serveur OAuth et une fausse API (`scripts/essai-natifs.mjs`,
section H et sections E, F, G ; `scripts/securite.mjs`, 15 sexies), écrits d'après la
documentation. Règle du 28/09/2026 (§ 3.16) : l'écran, l'aide et les README ne le disent pas ; c'est dit
ici et au § 42 de SECURITE.md. À essayer sur le poste : créer l'application sur console.x.com
(les deux types), déclarer `http://127.0.0.1:8787/helix/oauth/retour`, acheter quelques crédits,
se connecter, lire, publier un post, puis un post avec image, débrancher. Points incertains :
la réponse de jetons contient-elle `scope` (sinon la connexion est refusée, et la règle serait
à revoir pour X) ; X fait-il tourner le jeton d'actualisation ; quel code rend une requête sans
crédit (l'outil suppose 402) ; X exige-t-il les droits « Read and write » de l'application en
plus de `tweet.write`.

**Revérifié le 28/09/2026 : les connecteurs déjà livrés (branche `verif-connecteurs`).** Demandé
par Medhi : « vérifier que les connecteurs actuels vont bien fonctionner ». Sans compte : la
documentation officielle du jour, les métadonnées d'autorisation publiques de chaque serveur MCP
distant (lues sans identifiant ni inscription), le registre npm ; puis un parcours complet contre de
faux serveurs (`scripts/essai-connecteurs.mjs`, section 16 septies de `npm run securite`) et l'écran
dans une fenêtre Electron cachée. Détail, tableau par connecteur et ce qui n'a pas été essayé :
SECURITE.md § 49. Ce qu'il faut retenir :

- **Cinq adresses MCP étaient périmées**, dont trois en panne franche : Jira et Confluence
  (`/v1/sse` sans métadonnées, désormais `/v2/mcp`), Asana (V1 arrêté le 11/05/2026 ; le V2 veut une
  « MCP app » déclarée, il passe donc en « application déclarée »), Wix et Square (`/mcp`), PayPal
  (`/http`). Un connecteur branché avant est réaligné sur la nouvelle adresse, et la personne se
  reconnecte : l'autorisation d'une adresse ne sert jamais à une autre.
- **Webflow** ne documente que l'ancien transport SSE, que Helix ne parlait pas : `mcp.ts` se replie
  désormais sur SSE quand le transport « streamable » est refusé (spécification MCP).
- **Figma et Vercel ont été retirés du catalogue, puis remis le même jour** : leur documentation
  réserve leur serveur aux clients qu'ils ont approuvés, mais Medhi a branché Helix à Vercel depuis
  l'écran et la page d'autorisation de Vercel l'a accepté (capture du 28/09/2026). Décision de
  Medhi : ils restent (`connecteurs.ts`, commentaire de Figma).
- Écran : pour GitHub, Slack, Box et Asana, l'adresse de retour à déclarer s'effaçait aussitôt
  affichée ; elle reste. Panneaux Facebook et Instagram : Meta ne fait plus choisir un type d'app
  mais des cas d'usage. La page de retour d'autorisation suit la langue du navigateur.
- À surveiller : Notion déclare son serveur local (« Notion (par jeton) ») plus maintenu ; HubSpot
  met en avant son serveur distant ; Canva dit l'inscription automatique « dépréciée, toujours
  disponible » ; la version LinkedIn (`202609`) et la version Graph de Meta (`v25.0`, fin le
  29/07/2028) sont désormais contrôlées par `npm run securite`, qui échouera quand il faudra les
  relever.

À essayer sur le poste, avec de vrais comptes : « Se connecter » sur Jira et Confluence, Webflow,
Wix, Square, PayPal (adresse de retour `http://127.0.0.1:8787/helix/oauth/retour` acceptée ?) ;
Asana avec une « MCP app » ; puis un outil de lecture sur chacun.
**Fait le 28/09/2026 : Google Docs, Google Forms et Dropbox, branche `connecteurs-documents`.**
Demandé par Medhi avec les autres familles de connecteurs, sur le modèle des connecteurs
natifs : mêmes règles (lecture par défaut ; écrire se coche à la connexion, administrateur
seul, carte d'accord à chaque fois même au niveau « Tout approuver », contenu entier ; dix
écritures par heure et par service, doublon refusé, place gardée après un 5xx, `sousGarde` ;
appel recopié jamais lancé ; jetons jamais rendus ; fichiers par `fichierDuDossier`). Pour
limiter les conflits avec les branches du même jour, le code vit à part :
`gateway/src/natifs/documents.ts` (définitions, outils, essai et révocation de Dropbox),
`src/components/settings/ConnecteurNatifDocuments.tsx` (textes du panneau),
`scripts/essai-documents.mjs` (85 contrôles, repris par `npm run securite`, section 16 ter) ;
les registres communs n'ont reçu que des ajouts courts. Clés de marque réservées aux logos :
`googleDocs`, `googleForms`, `dropbox` ; icônes neutres en attendant (FileText,
ClipboardList, HardDrive).

| Service | Lecture (sans rien cocher) | En plus, si on le coche | Examen du fournisseur |
|---|---|---|---|
| Google Docs | `documents.readonly` : lire un document (onglets, tableaux), par morceaux de 15 000 caractères | `documents` : créer un document, ajouter du texte à la fin (rien n'est effacé) | aucun pour une application interne à un Workspace |
| Google Forms | `forms.body.readonly`, `forms.responses.readonly` : le formulaire, ses réponses | (rien) | idem |
| Dropbox | `account_info.read`, `files.metadata.read`, `files.content.read` : lister, chercher, lire un fichier texte (1 Mo) | `files.content.write` : envoyer un fichier du dossier de travail (50 Mo, jamais en remplacement) | aucun jusqu'à 50 comptes reliés (500 au plus en développement) ; au-delà, statut « production » après examen |

Choix faits, et pourquoi : `drive.file` (non sensible) ne voit que les fichiers créés ou
ouverts par l'application, pas un document qu'on nomme au modèle, d'où `documents` ;
Forms n'a que ses deux portées de lecture, pour ne pas ouvrir le Drive (`drive.readonly`,
restreinte). Dropbox : PKCE S256, application publique (sans secret) ou confidentielle
(secret dans le corps, comme l'exemple de Dropbox) ; Dropbox veut l'adresse de retour exacte,
sans joker de port : le retour passe par la route publique de l'instance, comme LinkedIn et
X. Un fichier Dropbox est lu par l'identifiant relu dans sa métadonnée, pas par son nom ;
l'argument d'en-tête (`Dropbox-API-Arg`) échappe tout ce qui n'est pas ASCII ; l'envoi est en
`add`, sans renommage, conflit strict. Docs : le texte envoyé perd les caractères qui
renversent l'affichage, que la carte ne montre pas (l'écart relevé pour les posts au § 41.3
de SECURITE.md ne se reproduit pas ici). Détail et limites relevées : SECURITE.md § 45.

**Pas encore essayé avec les vrais services** (règle du § 3.16 : dit ici, pas à l'écran) :
tout est vérifié contre de faux serveurs écrits d'après la documentation lue le 28/09/2026.
Points incertains : la forme exacte de l'« App key » de Dropbox (quinze caractères
minuscules et chiffres sur les exemples, l'écran refuse une autre forme) ; Dropbox rend-il
`scope` quand on le demande (la page lue le montre ; sinon la connexion est refusée) ;
`files.content.write` suffit-il à `files/upload` sans `files.metadata.write` ; le
renouvellement sans secret d'une application publique (les SDK de Dropbox le font) ;
l'examen de Google pour une application externe avec `documents` (sensible). À essayer sur
le poste : § 5, point 26.

Vu à l'écran le 28/09/2026 (fenêtre Electron cachée, `vite`, passerelle jetable, faux fournisseurs) :
le parcours de connexion de Dropbox et de Google Docs, en fr, en et ja, clair et sombre, 1440 et 375 px
(SECURITE.md § 45.5). Deux défauts de 375 px corrigés pour tous les panneaux natifs ; un défaut plus
ancien relevé, pas corrigé : le message rangé au retour du fournisseur est en anglais sur un écran
français (la requête de retour n'a pas de langue).
**Fait le 28/09/2026 : messageries, Telegram, Discord et WhatsApp Business (branche
`connecteurs-messageries`).** Demandé par Medhi : des connecteurs pour le Chat et Cowork, lire
les derniers messages d'une conversation et envoyer un message derrière une carte. Code dans
`gateway/src/natifs/messageries.ts` (connexion, relevé, webhook, outils), écran
`src/components/settings/ConnecteurMessagerie.tsx` (rubrique « Messageries » de Paramètres,
Connecteurs, icônes neutres en attendant les logos, clés `telegram`, `discord`, `whatsapp`),
article « Connecter Telegram, Discord ou WhatsApp » de l'aide ; courts ajouts dans les registres
communs (approbation.ts, outils.ts, chat.ts, connecteurs.ts, index.ts, auth.ts, debit.ts, db.ts).

| Service | Ce qu'on colle | Lire | Envoyer (coché, administrateur, carte à chaque fois) |
|---|---|---|---|
| Telegram (API des bots) | le jeton donné par @BotFather | `telegram__conversations`, `telegram__messages` : les messages reçus par le bot, relevés chaque minute par `getUpdates` (Telegram ne les garde que 24 h) et gardés chiffrés (100 par conversation, 30 jours) | `telegram__envoyer`, seulement dans une conversation d'où un message a été reçu (un bot ne peut pas écrire le premier) |
| Discord (bot) | le jeton du bot (portail développeur) | `discord__salons`, `discord__messages` : l'API HTTP, sans connexion permanente ; texte vide sans l'intention « Message Content », ce que l'écran et le modèle disent | `discord__envoyer`, dans un salon listé, sans aucune mention, `nonce` imposé |
| WhatsApp Business (Cloud API de Meta) | jeton d'utilisateur système, identifiants du numéro et du compte, clé secrète | `whatsapp__conversations`, `whatsapp__messages` : les messages que Meta dépose sur le webhook de l'instance (route publique signée), `whatsapp__modeles` | `whatsapp__envoyer` (texte libre, dans la fenêtre de 24 h seulement), `whatsapp__envoyer_modele` (modèle approuvé, n'importe quand, facturé par Meta) |

**Pourquoi ce n'est pas le code des canaux des employés** (§ 3.4) : là, Helix ne parle ni à
Telegram ni à Discord ; il garde le jeton et le passe à OpenClaw, qui tient la connexion et fait
répondre l'employé. Le bot y est l'interface de l'employé. Ici, c'est la fenêtre de
l'organisation sur ses conversations. Rien n'était réutilisable, sauf la façon de garder un
secret. Conséquence : **un bot par usage**. Telegram ne donne les messages d'un bot qu'à un seul
lecteur (409, ou webhook posé) ; un bot déjà branché sur un employé est refusé à la connexion,
et son webhook n'est jamais retiré. WhatsApp n'a rien de commun : l'employé passe par WhatsApp
Web (Baileys) ; ici, c'est l'API officielle.

**La fenêtre des 24 heures** (règle de Meta) : Helix ne la connaît que par les messages reçus,
donc par le webhook ; Meta exige une adresse publique en https avec un vrai certificat. Une
instance sur un poste, en http sur 127.0.0.1, ne reçoit rien : seuls les modèles approuvés
peuvent partir. L'écran le dit. Le texte d'un modèle est relu chez Meta au moment d'envoyer, et
doit être celui que la carte a montré, mot pour mot.

**Règles** (celles des connecteurs natifs) : lecture par défaut ; envoyer se coche, se règle
ensuite sans ressaisir le jeton ; l'administrateur seul, vérifié par l'outil ; une carte à
chaque message, même au niveau « Tout approuver », avec le texte entier, le destinataire résolu
(nom de la conversation, du salon, numéro et fenêtre) et, pour un modèle, le texte final ;
vingt envois par heure et par messagerie, le même texte au même destinataire refusé une
demi-heure, `sousGarde` ; un appel recopié depuis un message lu n'est pas lancé (`appelsLus`) ;
un message reçu est une donnée (dit en tête de chaque lecture, un message par ligne, rien ne
se déclenche seul). Ni les employés OpenClaw ni l'agent de code n'ont ces outils.

**Pas encore essayé avec un vrai bot, un vrai serveur Discord ni un vrai numéro WhatsApp** :
vérifié contre de faux services écrits d'après la documentation lue le 28/09/2026
(`scripts/essai-messageries.mjs`, 71 contrôles ; `scripts/securite.mjs`, 16 quater ; sur la
branche, `npm run securite` : 1 079 contrôles, 0 échec). L'écran et
l'aide ne le disent pas (§ 3.16) ; c'est dit ici, au § 5 et au § 46 de SECURITE.md. Écran vu
dans une fenêtre Electron cachée, contre une passerelle jetable et `vite` : fr, en, ja, clair et
sombre, 1440 et 375 px, connexion de WhatsApp faite à l'écran.
**Fait le 28/09/2026 : commerce et relation client, branche `connecteurs-commerce`.** Demandé par
Medhi : Stripe, Shopify, WooCommerce, Salesforce, Pipedrive, Zendesk. Code dans
`gateway/src/natifs/commerce.ts` (module à part : ces services ont chacun leur adresse, et trois
ne passent pas par un accord dans le navigateur), branché par des ajouts courts dans
`outilsNatifs.ts`, `approbation.ts`, `index.ts` (`/helix/commerce…`, retour public aiguillé par le
préfixe `commerce.` du `state`), `connecteurs.ts` (préfixes réservés), `db.ts` (collection interne
`connecteursCommerce`). Écran : `src/components/settings/ConnecteurCommerce.tsx`, rubrique
« Commerce et relation client » de Paramètres, Connecteurs ; article « Commerce et relation
client » de l'aide.

**La règle de choix** (un serveur MCP officiel distant avec OAuth va au catalogue ; sinon une
connexion native ; sinon une clé d'administrateur) a été suivie, avec une précision décidée ici :
les outils d'un serveur MCP passent par la barrière commune (une carte selon le niveau, aucune au
niveau « Tout approuver », pas de contrôle « administrateur seulement »). Un serveur MCP qui écrit
de façon générale ne tient donc pas les règles des connecteurs (SECURITE.md §§ 40 à 43). Choix,
documentation lue le 28/09/2026 :

| Service | Voie | Pourquoi | Lecture | Écriture (cochée, carte, administrateur) |
|---|---|---|---|---|
| Stripe | clé restreinte `rk_…` | serveur MCP officiel (`mcp.stripe.com`, OAuth) mais `stripe_api_write` couvre tout POST, remboursements compris ; demandé : rien qui déplace de l'argent | paiements (PaymentIntents), clients, factures, abonnements | aucune ; GET seulement, tenu par le transport ; une clé `sk_` est refusée |
| Shopify | application du Dev Dashboard, « client credentials grant » | pas de serveur MCP officiel pour les données d'une boutique (Storefront, Customer Account, Checkout, Dev) | commandes (60 jours), produits, stocks ; `read_orders read_products read_inventory` relues à chaque jeton de 24 h | aucune ; requêtes GraphQL écrites dans le module, pas de mutation |
| WooCommerce | clé REST en « Lecture », HTTP Basic sur https | son MCP est servi par le site du marchand, en préversion, par relais local et mot de passe WordPress ; son accord par navigateur exige un retour en https | commandes, produits | aucune ; GET seulement |
| Salesforce | External Client App, OAuth + PKCE, `api refresh_token` | serveurs MCP hébergés (GA avril 2026) : `sobject-reads` sans la note, `sobject-mutations` écrit tout objet | contacts, opportunités (SOQL, mot cherché échappé) | une note (`Note`) sur un contact, une opportunité ou un compte |
| Pipedrive | application privée, OAuth (Basic), `api_domain` suivi s'il est en `.pipedrive.com` | serveur MCP officiel `mcp.pipedrive.ai` (juin 2026) qui crée et modifie affaires, contacts, activités | personnes, affaires | une note sur une affaire ou une personne (`deals:full contacts:full`) |
| Zendesk | client OAuth confidentiel, PKCE, JSON | aucun serveur MCP de Zendesk dans sa documentation de développeur (celui de la place de marché est d'un tiers) ; jetons d'API retirés en 2026-2027 | tickets et échanges (`tickets:read users:read`) | une réponse publique ou une note interne (`tickets:write`) |

Règles tenues (détail et contrôles : SECURITE.md § 47) : lecture par défaut ; écrire coché à la
connexion, par l'administrateur seul, vérifié au moment d'agir, derrière une carte à chaque fois
(`TOUJOURS_CONFIRMER`) qui montre le texte entier ; `sousGarde` (dix par heure et par service,
doublon refusé, place gardée après un 5xx) ; un appel recopié d'un ticket lu n'est pas lancé ;
clés, secrets et jetons chiffrés, jamais rendus. Contrôles : `scripts/essai-commerce.mjs` (92, faux
services, passerelle jetable, vrai Chat avec un faux modèle) et `scripts/securite.mjs`, section
16 quinquies. Vu à l'écran dans une fenêtre Electron cachée contre une instance jetable : parcours
Stripe (clé secrète refusée, clé restreinte acceptée) et Zendesk (application, accord, retour,
connecté) en français, clair, 1440 px ; formulaires et états en anglais, japonais, chinois,
clair et sombre, 1440 et 375 px, sans débordement horizontal. Logos : icônes neutres, clés de marque
`stripe`, `shopify`, `woocommerce`, `salesforce`, `pipedrive`, `zendesk` à poser dans la liste de
`ConnecteurCommerce.tsx` (une ligne « maison » ne lit pas `MARQUE_DU_CONNECTEUR`). Rien n'a été
essayé contre les vrais services : ce qui reste à essayer est au § 5.

**Tournée des connecteurs, 28/09/2026 (soir).** Commerce, projets, messageries et catalogue MCP
repris service par service contre la documentation du jour et les métadonnées OAuth publiques
(lues sans compte) ; parcours complet sur un banc (passerelle jetable, faux fournisseurs, écran
dans une fenêtre Electron cachée) : configuration, connexion, lecture par un vrai Chat, écriture
derrière la carte, erreurs 401, 403, 404, 429 et 5xx. Corrigé : une panne passagère (429, 5xx)
au renouvellement d'un jeton débranchait le service (Zendesk renouvelle toutes les 30 minutes,
Pipedrive et Brevo toutes les heures) ; des identifiants Shopify refusés laissaient l'écran sur
« Connecté » ; la limite de débit de GraphQL de Shopify (rendue en 200) était dite « accès
refusé » ; l'aide de Zoom oubliait quatre des dix portées demandées. Toujours pas essayé avec
les vrais services. Points incertains relevés : `SELECT Name FROM Organization` lisible par
tout utilisateur Salesforce (sinon l'essai de connexion échoue) ; adresses de retour en
`http://127.0.0.1` acceptées par Salesforce, Pipedrive et Zendesk.
**Fait le 28/09/2026 : projets et rendez-vous, branche `connecteurs-projets`.** Demandé par
Medhi : Trello, Monday, ClickUp, Todoist, Calendly, Zoom, Brevo, Mailchimp, avec un ordre de choix
imposé : un serveur MCP officiel distant avec OAuth d'abord (catalogue de `connecteurs.ts`, comme
Notion ou Linear), sinon un connecteur natif, sinon une clé d'API d'administrateur. Code :
`gateway/src/natifs/projetsRegles.ts` (règles, sans importation qui s'exécute, pour que la barrière,
`mcp.ts` et `oauthNatif.ts` l'importent sans cycle), `gateway/src/natifs/projets.ts` (outils de Brevo
et Mailchimp), ajouts courts dans les registres communs ; écran `ConnecteurProjets.tsx` ; essai
`scripts/essai-projets.mjs` ; SECURITE.md § 48. Documentation lue le 28/09/2026, citée dans le code.

| Service | Choix | Source | Lecture (sans rien cocher) | Si l'administrateur coche |
|---|---|---|---|---|
| Trello | MCP d'Atlassian, `https://mcp.trello.com/v1`, un clic | support.atlassian.com (Trello MCP), github.com/atlassian/trello-mcp-server | portées `read:*` et `offline_access` | `write:board:trello` |
| Monday | MCP de monday.com, `https://mcp.monday.com/mcp`, un clic | developer.monday.com (Platform MCP) | aucune portée publiée : lectures reconnues outil par outil | les autres outils |
| ClickUp | MCP de ClickUp, `https://mcp.clickup.com/mcp`, un clic (client public) | developer.clickup.com (MCP Server) | `read` | `write` |
| Todoist | MCP de Doist, `https://ai.todoist.net/mcp`, un clic | github.com/Doist/todoist-mcp | `data:read` | `data:read_write` (jamais `data:delete`) |
| Calendly | MCP de Calendly, `https://mcp.calendly.com`, un clic (client public) | developer.calendly.com (Calendly MCP) | `mcp:scheduling:read` | `mcp:scheduling:write` |
| Zoom | MCP de Zoom, `https://mcp.zoom.us/mcp/zoom/streamable`, application « General app » à créer (pas d'enregistrement automatique) | developers.zoom.us (MCP), zoom/zoom-plugin (oauth-setup) | portées `*:read:*` | créer et modifier une réunion, déposer un document ; jamais supprimer |
| Brevo | natif (OAuth 2.0, PKCE, application privée créée avec l'outil `brevo`) : son MCP n'a pas d'OAuth, seulement un jeton collé | developers.brevo.com (OAuth, MCP) | `account:read contacts:read campaigns.email:read` | brouillons, et envoi coché à part : `campaigns.email:write` |
| Mailchimp | natif (OAuth 2, application déclarée dans le compte) : pas de MCP officiel pour l'API Marketing | mailchimp.com/developer (OAuth 2) | aucune portée chez Mailchimp : lectures seules proposées par Helix | brouillons, et envoi coché à part |

Aucune clé d'API n'a été nécessaire. **Règles** : brancher et débrancher, administrateur seul (y
compris pour les six serveurs MCP, contrairement au reste du catalogue) ; lecture par défaut ; la
portée accordée est relue et ce qui déborde fait tout refuser ; pour les serveurs MCP, un outil
n'est une lecture que s'il n'a aucun verbe qui modifie et qu'il le dit (annotation `readOnlyHint`)
ou commence par un verbe de lecture ; tout le reste est une écriture, invisible sans la case, et
sinon soumise à une carte à chaque appel, même au niveau « Tout approuver », avec ses arguments
entiers, et réservée à l'administrateur au moment d'agir ; ni les employés OpenClaw ni l'agent de
code n'ont ces écritures. Brevo et Mailchimp : brouillons et envoi se cochent séparément ; la carte
d'un envoi est faite de la campagne relue chez le service (objet, expéditeur, listes, **nombre de
destinataires**, texte extrait du HTML et liens), retenue par une empreinte, et rien ne part si la
campagne a changé depuis ; Brevo n'envoie d'ici que vers des listes (un segment n'a pas de taille
connue d'avance) ; dix brouillons ou envois par heure et par service, doublon refusé, issue
incertaine (5xx) gardée. Clés de marque `trello`, `monday`, `clickup`, `todoist`, `calendly`, `zoom`,
`brevo`, `mailchimp` : icônes neutres (`marquesConnecteurs.ts`, `ParametresPages.tsx`), les logos
sont l'affaire d'un autre travail. Aucun tableau de connecteurs dans les README : pas touchés.
Écran vu (fenêtre Electron cachée, passerelle jetable, faux services) : parcours de Trello et de
Brevo jusqu'à « branché », formulaires en fr, en et ja, clair et sombre, 1440 et 375 px
(SECURITE.md § 48.1).

**Pas essayé avec de vrais comptes ni de vraies applications** (règle du § 3.16 : dit ici, pas à
l'écran) : tout est vérifié contre de faux serveurs écrits d'après la documentation et les
métadonnées publiées (`scripts/essai-projets.mjs`, 74 contrôles, repris par `npm run securite`,
section 16 sexies ; les contrôles échouent quand on retire la relecture des portées, la carte des
écritures MCP ou l'empreinte de la campagne, essayé). Les métadonnées OAuth publiques des six
serveurs ont été lues le 28/09/2026 (sans compte). À essayer sur le poste, service par service :
la connexion, une lecture, une écriture cochée, le refus d'une portée en trop. Points incertains :
les vrais noms d'outils et leurs annotations (s'ils n'en ont pas et ne commencent pas par un verbe
de lecture, ils sont pris pour des écritures : plus de cartes, jamais moins) ; Trello et Todoist
acceptent-ils la seule portée de lecture (Todoist ne publie que `data:read_write` pour son MCP) ;
Atlassian accepte-t-il une adresse de retour `http://127.0.0.1` pour Trello (ses administrateurs
filtrent les domaines) ; Zoom accepte-t-il le paramètre `scope` ou accorde-t-il les portées de
l'application (l'écran dit de n'y mettre que la lecture) ; Brevo rend-il d'autres portées que
celles demandées (tolérées : `openid profile email offline_access`) et accepte-t-il
`http://127.0.0.1` ; le vrai `recipient_count` de Mailchimp pour un segment ; les jetons des
serveurs MCP ne sont pas révoqués chez le service quand on débranche (le SDK n'a pas de
révocation ; même dette que le reste du catalogue).
**Fait le 28/09/2026 : Microsoft 365 par Microsoft Graph, branche `connecteurs-microsoft`.**
Demandé par Medhi : Outlook (mails et agenda), OneDrive et SharePoint (fichiers), Excel, Word et
Teams, avec une seule application Entra créée par l'administrateur (identifiant, secret
facultatif, annuaire ou « common »). Même modèle et mêmes règles que les connecteurs natifs
ci-dessus (SECURITE.md §§ 40 à 43, et § 44 pour celui-ci). Fichiers à lui :
`gateway/src/natifs/microsoftBase.ts` (définition, portées, sources, noms des outils, phrases des
cartes ; n'importe que `langue.ts`), `gateway/src/natifs/microsoft.ts` (les outils),
`src/components/settings/ConnecteurMicrosoft.tsx` (le panneau), `scripts/essai-microsoft.mjs`
(faux Microsoft) ; les registres communs n'ont reçu que des ajouts courts (`oauthNatif.ts` :
des champs facultatifs de `Definition`, sans effet sur les huit autres ; `outilsNatifs.ts`,
`approbation.ts`, `connecteurs.ts`, `index.ts`, `natifs.ts`, `ParametresPages.tsx`, `aide.ts`,
`securite.mjs` section 16 bis ; `relecture.ts` exporte `lireZip`).

**Décision : une seule connexion, pas six.** Chez Microsoft, le consentement s'accumule par
application et par personne, et un jeton porte ce qui a été consenti, pas seulement ce qu'on
vient de demander (documentation citée dans `microsoftBase.ts`). Six connexions sur la même
application auraient donné six jetons aux mêmes pouvoirs : l'écran aurait dit « Outlook, lecture
seule » d'un jeton qui écrit dans les classeurs. Il y a donc une connexion `microsoft`, où l'on
coche les services et l'écriture ; six lignes dans la liste (clés `outlook`, `onedrive`,
`sharepoint`, `excel`, `word`, `teams`, icônes neutres en attendant les logos, posés par un
autre travail) ouvrent le même panneau. La portée rendue est relue ; ce qui déborde des cases
cochées fait refuser la connexion, avec le nom de la permission et où la retirer dans Entra.

| Service | Lecture | En plus, si « écrire » est coché | Consentement de l'administrateur |
|---|---|---|---|
| toujours | `User.Read`, `offline_access` | | non |
| Outlook | `Mail.Read`, `Calendars.Read` : lire, chercher les mails, lire l'agenda | `Mail.ReadWrite` (brouillon), `Mail.Send` (envoyer), `Calendars.ReadWrite` (créer un événement) | non |
| OneDrive | `Files.Read` : lister, chercher, lire | (rien) | non |
| SharePoint | `Sites.Read.All` : sites, lister, chercher, lire | (rien) | **oui** |
| Excel | `Files.Read` : lire une plage | `Files.ReadWrite` : écrire une plage, en valeurs | non |
| Word | `Files.Read` : lire un .docx | (rien) | non |
| Teams | `Team.ReadBasic.All`, `Channel.ReadBasic.All`, `ChannelMessage.Read.All` | `ChannelMessage.Send` : poster | **oui** (`ChannelMessage.Read.All`) |

Jamais demandés : `Files.Read.All`, `Files.ReadWrite.All` (administrateur, et tout ce que la
personne peut lire), `Sites.ReadWrite.All`, `Chat.*`, `.default`. Beaucoup d'organisations
interdisent aux personnes de consentir : l'administrateur de l'annuaire consent alors pour tout,
dans le portail ; l'écran le dit, et liste exactement les permissions à déclarer selon les cases.

Autres choix : retour sur la boucle locale sous le nom `http://localhost/microsoft` (Microsoft
ignore le port de « localhost » ; il conseille 127.0.0.1 mais son portail refuse de le saisir en
http), écouté sur 127.0.0.1 et ::1 ; PKCE S256 ; application « Client public » sans secret ou
« Web » avec secret, les deux acceptées ; le téléchargement d'un fichier suit l'adresse
pré-authentifiée que Graph donne, seulement vers `*.sharepoint.com`, sans le jeton (les comptes
Microsoft personnels ne sont donc pas pris en charge) ; Excel écrit en `values`, jamais en
`formulas`, et un texte qui commence par « = », « + », « - », « @ » reçoit l'apostrophe et le
format texte ; mails et messages Teams en texte brut ; pièces jointes par `fichierDuDossier`
(trois, 2 Mo chacune) ; dix écritures par heure pour Microsoft 365 entier (une connexion) ;
débrancher efface les jetons et dit où couper l'accès dans Entra, car Microsoft n'a pas de
révocation pour une application.

**Pas encore essayé avec un vrai annuaire Entra, ni un vrai compte Microsoft 365** : tout est
vérifié contre un faux Microsoft (OAuth et Graph) écrit d'après la documentation lue le
28/09/2026 (`scripts/essai-microsoft.mjs`, 98 contrôles, repris par `npm run securite`,
section 16 bis). Règle du § 3.16 : l'écran, l'aide et les README ne le disent pas. Points
incertains, à vérifier sur le vrai service : **la réponse de jetons porte-t-elle `scope`** (la
page le dit facultatif ; son absence fait refuser la connexion) et **sous quelle forme**
(préfixée, encodée) ; un jeton demandé avec des portées précises porte-t-il aussi les portées
consenties avant (si oui, décocher un service exige de retirer sa permission dans Entra, et
l'écran le dit) ; `http://localhost/microsoft` accepté avec le port ajouté par l'instance ;
l'apostrophe devant « = » dans `values` (Excel l'avale-t-il comme le préfixe qu'il est à la
saisie, ou l'écrit-il) et le format `@` appliqué dans le même appel ; la relecture des
`formulas` dans la réponse du PATCH ; `$search` sur les mails sans `ConsistencyLevel` ; les
codes AADSTS reconnus au retour (65001, 90094, 50011, 700016, 50194). Le panneau a été vu dans
une fenêtre Electron cachée et dans le navigateur intégré, contre une passerelle jetable et
`vite` : fr, en, ja, clair et sombre, 1440 et 375 px, états « application à enregistrer »,
« cases », « en attente », « connecté », « débranché ».

**Tournée des connecteurs natifs du 28/09/2026 (Google, Microsoft 365, Dropbox, réseaux
sociaux).** Demandée par Medhi (« je veux vraiment aucun bug »). Confrontés à la documentation
du jour : Google (boucle locale, révocation), Microsoft (adresse de retour `localhost`, port
ignoré, `offline_access` accordé implicitement avec toute permission déléguée : ne pas le
déclarer est juste), Dropbox (PKCE), TikTok (desktop, joker de port, défi en hexadécimal), X
(envoi d'image en JSON base 64). Bugs trouvés et corrigés :
- **Débrancher un service Google coupait tous les autres.** Google révoque tout ce que le projet
  a reçu de la personne, pas un jeton seul (« Revocation removes all OAuth 2.0 scopes previously
  granted to a project »). Débrancher Sheets (ou une connexion refusée à la relecture des
  portées) coupait Drive, Agenda, Slides, YouTube, Docs, Forms et une boîte Gmail de la même
  application, qui restaient affichés « Connecté ». Désormais chaque service Google se déclare
  (`clientGoogle.ts`, `declarerUsageGoogle`) ; tant qu'un autre est branché, on efface le jeton
  de l'instance sans révoquer, et l'écran dit pourquoi ; le dernier débranché révoque.
- Le message « l'accès a été révoqué » s'affichait chez LinkedIn et Instagram, qui n'ont pas de
  révocation : il n'est plus dit que si le fournisseur l'a confirmé.
- Le retour d'autorisation par la boucle locale (Google, TikTok, Microsoft 365) arrivait hors de
  toute requête : page et message de l'écran en anglais pour tout le monde (défaut relevé plus
  haut, § Docs/Dropbox). Il suit maintenant la langue de qui a cliqué (`langue.ts`,
  `dansLaLangue`).
- `drive.ts` et `agendaGoogle.ts` : messages de l'écran traduits (ils restaient en français), et
  ils renvoient à Paramètres, Connecteurs plutôt qu'au seul `helix.config.json`.
- Liste des connecteurs : « Google Agenda, iCloud, Nextcloud… » n'était pas traduit.
Vu marcher, contre un faux Google et une passerelle jetable (`scripts/essai-natifs.mjs`,
section I, et le navigateur intégré, en français et en anglais) : Drive et Agenda de bout en
bout, les outils proposés au modèle quand le service est branché et plus après, leurs schémas
JSON, LinkedIn et Microsoft 365 branchés depuis l'écran puis débranchés. Pas essayé : les vrais
services (aucun compte, aucune application de développeur).

**Tournée des serveurs MCP et outils intégrés, 28/09/2026 (soir).** Même demande. Treize défauts
corrigés dans `mcp.ts` et `connecteurs.ts`, dont : un serveur tombé restait « en marche » et tous
ses appels échouaient jusqu'au redémarrage de la passerelle (il est relancé, trois fois au plus en
dix minutes) ; un serveur distant redémarré qui avait oublié la session ne répondait plus ; les
processus lancés par un serveur (le `node` derrière `npx`) survivaient à son retrait et à la
fermeture de l'application ; la liste d'outils n'était lue qu'à sa première page ; des noms d'outils
(points, espaces, plus de 64 caractères, doublons entre deux serveurs) faisaient refuser toute la
demande par un fournisseur compatible OpenAI ; le carnet « Mémoire de travail » vivait dans le cache
de npx (perdu à chaque mise à jour) et vit désormais dans les données de l'instance. Essai de bout en
bout `scripts/essai-mcp.mjs` (83 vérifications, repris par `npm run securite`, section 20) : trois
transports avec les serveurs de référence, OAuth contre un faux serveur d'autorisation, MCP
personnalisé utilisé dans un Chat avec sa carte d'approbation. **Pas essayé** : les vrais services,
un vrai modèle, Windows (arrêt de l'arbre des processus). PayPal : l'adresse documentée
(`/http`) répond 404, `/mcp` répond 401 ; laissée telle que documentée, à trancher avec un compte.
SECURITE.md § 56.

**Tournée finale des connexions aux outils, 28/09/2026 (nuit).** Medhi : « pour les connexions
aux outils j'ai testé Gmail etc., mais que tout soit bon, niveau code ». Tout le code des
connexions relu ligne à ligne (natives, courrier IMAP et SMTP, Drive, agenda, Slack, MCP, commerce,
projets, messageries, Microsoft 365, documents). Quinze défauts corrigés, les plus sérieux : un
`.docx` piégé (nom répété dans l'archive) bloquait la passerelle environ une demi-heure pour tout le
monde, dès qu'un agent le lisait dans un OneDrive ou un SharePoint partagé ; **décision appliquée** :
Drive, l'agenda et Slack se branchent et se débranchent par l'administrateur seul, comme la boîte
commune (un membre pouvait remplacer l'agenda de l'instance par son serveur) ; l'envoi d'une
campagne Brevo ou Mailchimp n'est couvert que par la carte acceptée pour cet appel ; courrier par
« Se connecter avec Google » : un jeton refusé faisait attendre vingt secondes puis disait « le
serveur a cessé de répondre », et l'écran donnait à déclarer `helix://app/helix/oauth/retour` dans
l'application de bureau ; Instagram se débranchait au bout de 60 jours ; le webhook WhatsApp se
laissait saturer par des requêtes non signées. Messages du courrier, de l'agenda et de Slack
traduits (134 phrases). Chaque défaut a son contrôle dans l'essai du service ; section 27 de la
batterie. **Pas essayé** : les vrais services (ligne vide de XOAUTH2 chez Microsoft, renouvellement
d'Instagram, Telegram sans `offset`). SECURITE.md § 59.

**Palmier Pro, une application ouverte sur la machine (29/09/2026).** Demandé par Medhi : brancher
Palmier Pro (https://github.com/palmier-io/palmier-pro, https://palmier.io), monteur vidéo pour
macOS 26 sur puce Apple, avec génération de vidéos et d'images par l'IA (Seedance, Kling, Nano
Banana Pro, chez Palmier), pour que les agents de Helix montent sur sa timeline. Quand il est
ouvert, il sert un serveur MCP en HTTP sur `http://127.0.0.1:19789/mcp`, sans authentification.
*Pourquoi une troisième famille de connecteurs* : le catalogue ne connaissait que des `url`
publiques en https avec OAuth et des `command` locales ; ici ni l'un ni l'autre. Le catalogue a
désormais des entrées `local` (`gateway/src/connecteurs.ts`) : port et chemin écrits dans le
catalogue, adresse jamais reçue d'une requête ni relue du magasin (`aligner` oublie une adresse ou
une commande glissée sous cet identifiant). *Ce qui est fait* :
- **Reconnaître l'application avant de lui parler** (`gateway/src/palmier.ts`, sur le modèle
  d'`ecouteurReconnu` de llamaCpp.ts) : `lsof` donne le processus à l'écoute, `codesign --verify
  -R=…` vérifie sa signature en cours d'exécution (Developer ID d'Apple, identifiant
  `io.palmier.pro`, équipe `MMFLRC7562`, relevés dans `Info.plist` et `scripts/bundle.sh` de la
  branche `last-gpl-source`), l'exécutable doit être dans /Applications ou ~/Applications. Refait
  avant chaque requête HTTP (mcp.ts, `fetchLocal`). Fermé : « Ouvrez Palmier Pro, puis
  réessayez », avec la page de téléchargement officielle, rien n'est téléchargé à la place de la
  personne ; un autre programme sur le port : refus, et rien ne lui est envoyé.
- **Aucune autre adresse locale** : mcp.ts acceptait toute adresse en http sur 127.0.0.1 ou
  `localhost` « pour les essais ». Désormais (`adresseServeurPermise`) : en http, seulement un
  serveur déclaré `local`, sur 127.0.0.1 et son port ; en https, jamais un hôte interne écrit en
  adresse IP ni `localhost`.
- **Seulement sur un Mac à puce Apple** : la fiche n'est pas servie ailleurs ; sur un macOS plus
  ancien que 26, elle dit de le mettre à jour.
- **Cartes d'accord** (`gateway/src/palmierRegles.ts`) : neuf lectures pures passent sans carte
  (`get_timeline`, `inspect_timeline`, `get_media`, `inspect_media`, `get_multicam`,
  `detect_beats`, `inspect_color`, `list_models`, `read_skill`) ; tout le reste, et tout outil
  inconnu, se confirme à chaque appel, à tout niveau, y compris pour un employé « autonome ». Les
  générations (`generate_video`, `generate_image`, `generate_audio`, `upscale_media`) disent sur
  la carte qu'elles partent chez Palmier, hors de la machine, sur les crédits du compte ; de même
  `get_transcript` et `add_captions` (transcription possible par le service de Palmier) et
  `send_feedback` (message à l'équipe de Palmier). Écrire et générer : administrateur seul, au
  moment d'agir ; les employés et l'agent de code ne voient que les lectures.
- **Écran** : ligne « Palmier Pro » (rubrique « Documents et données », avec Canva et Figma),
  bouton « Brancher » (un clic, sans navigateur ni jeton), « Réessayer » quand l'application a
  été fermée, pas à pas (`guideApplicationLocale`), logo tiré de l'icône de son site ; article
  d'aide « Monter des vidéos avec Palmier Pro ». L'écran des connecteurs et le menu « Outils »
  relancent la connexion d'une application locale arrêtée, au plus toutes les quinze secondes.
- **Essai** : `npm run essai:palmier` (32 vérifications, repris par `npm run securite`, section
  39), contre un faux Palmier Pro sur un port libre (`HELIX_ESSAI_PALMIER_PORT`,
  `HELIX_ESSAI_PALMIER_EXECUTABLE`, variables réservées aux essais) et `nc` comme « autre
  programme ».

*Licences* : Palmier Pro était sous GPLv3 jusqu'à la version 0.7.6 ; les versions suivantes
sont propriétaires (licence binaire de Palmier, Inc.). Helix n'en reprend aucun code et n'en
distribue rien : il parle au serveur MCP de l'application que la personne a installée elle-même.
Seuls les noms des outils ont été lus dans la source publiée, pour les classer. Le logo est
l'icône du site, sous la décision du 28/09/2026 (§ 3.18, THIRD_PARTY_NOTICES.md § 4 bis).

**Pas essayé** : la vraie application (ni installée ni téléchargée : pas de Palmier Pro sur la
machine de travail). Donc pas vu : sa signature réelle (l'identifiant et l'équipe viennent du
dépôt, pas d'un binaire signé ; si l'éditeur change d'équipe ou d'identifiant, la reconnaissance
refusera, ce qui échoue fermé), le nom réel du paquet installé (`PalmierPro.app` dans l'image
disque de 0.7.6), sa réponse au client MCP de Helix (en-tête `Origin` absent, version de
protocole, flux GET), ni la liste d'outils des versions propriétaires récentes (un outil nouveau
passe par la carte). Incertain : si `inspect_media` transcrit toujours sur la machine dans les
versions récentes (vrai dans la 0.7.6) ; où se coupe son serveur MCP dans ses réglages. SECURITE.md
§ 63.

### 3.6 Découpage des tâches lourdes

Ajouté en septembre 2026, après mesure. Un modèle de 8 milliards de paramètres perd le
fil sur une tâche composée : il s'arrête à mi-chemin, ou décrit ce qu'il faudrait faire
au lieu de le faire.

La passerelle demande donc un plan, puis exécute **une étape à la fois**, chacune avec
son propre contexte court. L'avancement est tenu par l'instance, pas par le modèle.

**C'est le modèle qui juge (0.20.0).** Demandé le 15/09/2026 : « un modèle doit juger
lui-même si une tâche doit être découpée, et la découper autant de fois qu'il faut ».
Plus de liste de mots : à chaque demande, un appel court (sans outils ni
raisonnement, 1 à 3 secondes sur qwen3-8b) montre au modèle la demande et la
conversation qui précède ; il répond « rien à découper » ou un plan, avec l'objectif
reformulé. **Une étape trop grosse est redécoupée** en 2 à 8 parties, jusqu'à trois
niveaux et 60 étapes par demande, au lieu d'arrêter le travail. **Rédaction longue**
sans outils : partie par partie. Et ce qui passe d'une étape à l'autre, ce sont les
**données réellement lues** par les outils, pas seulement le résumé du modèle ; une
étape se juge aux retours des outils, pas à ce que le modèle affirme (voir
[SCREENS.md](SCREENS.md), « Découpage des tâches lourdes », pour les mesures).

**Le régime s'adapte au modèle** (`gateway/src/plan.ts`, fonction `strategie`) :

| Taille | Comportement |
|---|---|
| moins de 14 milliards | Le modèle juge s'il faut découper, 8 appels d'outils par étape |
| 14 à 45 | Le modèle juge, étapes plus larges, 14 par étape |
| 45 et plus | Pas de découpage, 50 appels d'un tenant |
| Inconnue, moteur distant | Supposé capable, pas de découpage |
| Inconnue, moteur local | Le modèle juge, par prudence |

**Non, une tâche ne se découpe pas à l'infini — et c'est voulu.** Question du
client, le 18/09/2026. Les bornes, toutes dans `gateway/src/plan.ts` :

| Borne | Valeur | Pourquoi elle existe |
|---|---|---|
| Étapes d'un plan de premier niveau | 15 | Au-delà, le plan est plus long que le travail |
| Parties d'une étape redécoupée | 8 | Un redécoupage qui en produit vingt n'a pas compris l'étape |
| Profondeur de redécoupage | 3 | Chaque niveau multiplie le temps ; au troisième, une étape ne fait plus qu'une ligne |
| Étapes réellement exécutées, par demande | 60 | Le garde-fou global : il compte tout, tous niveaux confondus |
| Appels d'outils par étape | 8, 14 ou 20 selon le modèle (`HELIX_BUDGET_ETAPE`) | Une étape qui tourne sans fin est une étape mal posée |
| Tours de complément après la revue finale | 2 | Passé deux, le modèle ne complète plus, il recommence |

Ce qui compte : quand une borne est atteinte, **Helix s'arrête et le dit**. Il ne
prétend pas avoir fini. Une demande vraiment trop grosse pour le modèle ressort
incomplète, avec la liste de ce qui a été fait et de ce qui ne l'a pas été.

Découper n'est pas un progrès en soi : sur un grand modèle, un plan imposé l'empêche
de s'adapter à ce qu'il découvre en chemin.

### 3.7 Vie privée par utilisateur

Personnalité, instructions, contexte personnel, mémoire et préférences de modèle sont
**privés, jamais partagés**. Les conversations ont un propriétaire ; il peut les
partager à une personne (par son adresse) ou à un **groupe** (0.16.0). L'instance le
vérifie : un membre retiré d'un groupe ne voit plus ce qui lui était partagé, dès la
synchronisation suivante (la révision des conversations suit celle des groupes).

La règle d'autrefois, « une conversation sur un modèle local ne se partage pas », ne
vaut plus : les conversations vivent dans l'instance, qui les sert à tous ses postes,
quel que soit le modèle. Son code (`setVisibility`, jamais appelé) a été retiré.

### 3.8 Éditions livrées

`edition` dans `branding.ts` (`chat` = sans Cowork ni Code, `complete` = tout) plus
`featureOverrides`. Navigation et routes filtrent seules. C'est aussi le moyen de
masquer chez un client les écrans encore en maquette.

### 3.9 Licences et conditions des briques tierces

Vérifié le 13/09/2026, à la source (fiches Hugging Face, conditions des éditeurs).
Ce n'est pas un avis juridique : un juriste doit relire les points marqués ⚠ avant
un engagement commercial.

| Brique | Éditeur | Licence | Usage commercial | Remarque |
|---|---|---|---|---|
| Qwen3 8B / 4B / 1.7B (conversation) | Alibaba (Qwen) | Apache 2.0 | oui | |
| Qwen3-VL 8B / 4B / 2B (écran) | Alibaba (Qwen) | Apache 2.0 | oui | |
| OpenCUA 7B / 32B | XLANG Lab | MIT | oui | reconnu, non installé d'office |
| OpenCUA 72B | XLANG Lab | MIT sur base Qwen2.5-VL 72B (licence Qwen) | oui, sous 100 M d'utilisateurs par mois | copie de la licence, attribution, droit chinois |
| Whisper small / large-v3-turbo (dictée) | OpenAI, converti par Systran et Dropbox | MIT | oui | poids ouverts, en local : conforme à la règle (§ 1) |
| Gemma 3 4B | Google | Gemma Terms of Use | oui, sous conditions | **retiré** pour sa licence (restrictions à répercuter dans chaque contrat client), pas pour son origine |
| LM Studio (moteur) | Element Labs, Inc. | logiciel fermé, gratuit | usage personnel et besoins internes d'une organisation (conditions du 23/08/2026) | ⚠ « application service provider » et « software-as-a-service » interdits |

**Tranché le 14/09/2026** (la question de Whisper l'était déjà : poids ouverts en
local, conforme à la règle du § 1) :

1. **LM Studio.** HelixAI est un logiciel libre que chaque organisation installe
   chez elle, pour ses propres salariés : c'est exactement l'usage que LM Studio
   autorise, que le projet soit gratuit ou non, et l'écran de première installation
   fait accepter ses conditions par l'organisation qui installe. Ce qui reste
   interdit, gratuit ou payant : **une instance servie à d'autres organisations**
   (quelqu'un qui hébergerait HelixAI pour ses clients). Celui-là devra brancher un
   moteur ouvert. Détail des conditions (version du
   23/08/2026) le réservent aux besoins internes de l'entreprise qui l'installe et
   interdisent de s'en servir pour fournir un service à des tiers. Une instance
   installée **chez** le client, pour ses salariés, est dans le cadre, et l'écran de
   première installation fait désormais accepter ces conditions par l'entreprise.
   Une instance **hébergée par l'agence** et servie à plusieurs clients ne l'est
   pas. Pour ce cas, il faudrait un moteur ouvert : llama.cpp (MIT), MLX d'Apple
   (MIT) ou Ollama (MIT). Ils exposent la même interface compatible OpenAI que les
   moteurs déjà déclarables dans le profil de déploiement, mais aucun n'a été
   éprouvé avec Helix. LM Studio est aussi un logiciel fermé : c'est la brique la
   moins souveraine du produit, bien plus que l'origine d'un modèle.
2. **La licence du projet : AGPL-3.0**, tranché le 20/09/2026. Fichier
   [LICENSE](LICENSE) (texte officiel de la FSF, pris sur gnu.org), explications et
   portée dans [COPYRIGHT.md](COPYRIGHT.md), `"license": "AGPL-3.0-only"` dans
   `package.json`.

   **La demande était : « utilisable par tous, mais qu'on ne puisse pas prendre mon
   projet pour le vendre ».** Ces deux choses ne tiennent pas ensemble au sens
   strict — une licence open source ne peut pas interdire de vendre, c'est le
   quatrième critère de l'Open Source Definition. Il fallait donc choisir laquelle
   des deux garder.

   L'AGPL garde les deux **en pratique** : on peut vendre HelixAI, mais celui qui le
   distribue ou **le propose comme service en ligne** doit publier tout son code,
   modifications comprises, sous la même licence. Un concurrent qui voudrait en
   faire une offre fermée devrait offrir son propre travail au reste du monde. Cela
   n'interdit rien et décourage tout, sans coûter le droit de dire « open source »,
   qui est vrai et vérifiable. Et le titulaire des droits, n'étant pas lié par sa
   propre licence, reste libre de **vendre une licence privée** à qui veut
   s'affranchir de l'AGPL : c'est le modèle de GitLab, Grafana et Nextcloud, et
   c'est ce qui rend l'abonnement du § 5 compatible avec l'ouverture du code.

   Les deux autres voies, écartées : **FSL** et **BSL** interdisent vraiment la
   revente concurrente (2 et 4 ans, puis bascule en open source), mais ce ne sont
   pas des licences open source, et il aurait fallu retirer le mot de tout le
   produit et de toute la communication.

   **Ce qu'il faut tenir pour que la licence privée reste vendable :** détenir
   l'ensemble des droits. Une contribution extérieure acceptée sans accord écrit
   (CLA) appartient à son auteur. À mettre en place **avant** la première
   contribution venue du dehors.

   **Vérifié :** les 444 paquets installés relevés un par un — 368 MIT, 35 ISC, 11
   Apache-2.0, 18 BSD, le reste permissif ; aucune licence copyleft, SSPL, BUSL ni
   « non commercial ». Toutes compatibles avec l'AGPL-3.0. La commande qui refait ce
   relevé est dans COPYRIGHT.md.

   `"private": true` reste dans `package.json`, et ne dit rien de la licence : c'est
   un garde-fou npm qui empêche une publication accidentelle du paquet. HelixAI est
   une application, pas une bibliothèque npm.

**Ajouté le 25/09/2026** (relevé à la source ce jour-là, détail aux § 3.10 et 3.12) :

| Brique | Éditeur | Licence | Usage | Remarque |
|---|---|---|---|---|
| nomic-embed-text v1.5 (embeddings) | Nomic AI | Apache 2.0 | bases de connaissances | déjà installé dans LM Studio, rien téléchargé |
| AnythingLLM | Mintplex Labs | MIT | idées seulement (révision `ad97bc8d…`) | aucun code recopié, notice `gateway/rag/LICENCE-anything-llm.txt` |
| LangChain.js, découpeur de texte | LangChain | MIT | code porté dans `decoupage.ts` (révision `e4a3d1bd…`) | notice `gateway/rag/LICENCE-langchainjs.txt` |
| MLX, MLX-LM | Apple (ml-explore) | MIT | entraînement sur Mac | 0.32.2 et 0.31.3 |
| Qwen3 0.6B, 1.7B, 4B Instruct 2507 (départ d'un entraînement) | Alibaba (Qwen) | Apache 2.0 | entraînement | révisions épinglées, empreintes vérifiées |
| transformers, peft, accelerate ; bitsandbytes ; PyTorch ; llama.cpp | Hugging Face ; bitsandbytes ; PyTorch ; ggml-org | Apache 2.0 ; MIT ; BSD-3 ; MIT | entraînement sur carte NVIDIA | versions figées, **sans empreintes** pour les paquets NVIDIA |
| Unsloth 2026.9.11, unsloth_zoo 2026.9.7 | Unsloth AI | cœur Apache 2.0, `unsloth_zoo` LGPL-3.0-or-later (Studio AGPL-3.0, non utilisé) | entraînement sur carte NVIDIA | **accepté par Medhi le 25/09/2026** ; roues vérifiées par empreinte, repli sur transformers et peft (§ 3.12) |

**Ajouté le 27/09/2026** :

| Brique | Éditeur | Licence | Usage | Remarque |
|---|---|---|---|---|
| CPython 3.12.14, construction autonome `python-build-standalone` (publication 20260901) | Python Software Foundation ; construction par Astral | PSF-2.0 (construction : MPL-2.0) | Python de l'atelier, de la dictée et de l'entraînement quand la machine n'en a pas un qui convient (`pythonPrive.ts`) | **accepté par Medhi le 27/09/2026** (« Python doit s'installer ») ; publication épinglée, empreintes SHA-256 écrites dans le code |
| OpenCode 1.18.32 (moteur de l'écran Code) | Anomaly (ex-SST) | MIT | posé d'un clic par Helix quand la machine n'en a pas (`opencodePrive.ts`) | version épinglée, empreintes SHA-256 écrites dans le code (27/09/2026) |
| Node 24 LTS officiel | OpenJS Foundation | MIT (npm : Artistic 2.0) | npm de l'atelier et `npx` des serveurs d'outils (MCP) quand la machine n'en a pas | même Node que celui d'OpenClaw, déjà en place ; empreinte vérifiée contre `SHASUMS256.txt` |
| llmster (moteur sans interface de LM Studio) | Element Labs | conditions de LM Studio (acceptées à l'installation, pour soi ou au nom de son organisation) | moteur des modèles sur Mac à puce Apple, Windows et Linux | version 0.0.25-1 épinglée, empreintes SHA-512 écrites dans le code |

**Ajouté le 29/09/2026** :

| Brique | Éditeur | Licence | Usage | Remarque |
|---|---|---|---|---|
| Microsoft Visual C++ Redistributable 14.51.36247.0, x64 et arm64 | Microsoft | conditions de licence de Microsoft (logiciel fermé, gratuit) | Windows seulement : les bibliothèques dont deux modules natifs d'OpenClaw ont besoin (`VCRUNTIME140.dll`), quand elles manquent (`visualCpp.ts`) | **accepté par Medhi le 29/09/2026**, exception à la règle Apache 2.0 et MIT, comme Python ; jamais redistribué : téléchargé chez Microsoft (adresse versionnée, empreinte SHA-256 et signature Authenticode vérifiées), installé par Windows avec l'autorisation d'administrateur de la personne (§ 3.4) |

**Relevé le 28/09/2026** (seconde tournée de l'audit, SECURITE.md § 39) : tous les composants
tiers, avec leur licence et leur compatibilité avec l'AGPL-3.0, sont dans `THIRD_PARTY_NOTICES.md`
(livré avec l'application). **Décidé par Medhi le 28/09/2026** : la police Satoshi (ITF Free Font
License, qui interdit sa diffusion par un dépôt public) est remplacée par Plus Jakarta Sans (SIL OFL
1.1), dès la version 2026.928.1 ; Satoshi reste dans l'historique git. **À décider par Medhi** : les roues de PyAV de la dictée, qui embarquent
x264 et x265 (GPL-2.0-or-later) à côté d'un FFmpeg LGPL-3.0 ; le modèle de conversation, que
`lms get` ne sait ni épingler ni vérifier ; les empreintes de la pile NVIDIA, relevables mais à
essayer sur une carte NVIDIA avant d'être imposées.

Écartés pour le RAG : LanceDB, better-sqlite3 / sqlite-vec et le reclassement par
onnxruntime-node (modules natifs, § 3.10) ; Orama (licence déclarée « NOASSERTION »
par GitHub le 25/09/2026, non vérifiée plus avant).

Pour mémoire, si un client exige un modèle de dictée européen, deux existent,
vérifiés sur leurs fiches : Kyutai STT 1B, français et anglais (laboratoire parisien, licence CC-BY 4.0, un milliard de
paramètres, documenté pour carte graphique NVIDIA : fonctionnement sur Mac à
éprouver) ; Voxtral Mini de Mistral (Apache 2.0, français compris, environ cinq
milliards de paramètres, soit dix fois Whisper small).

### 3.10 Bases de connaissances : sans module natif, avec les droits de Fichiers

Décidé le 25/09/2026. Des **bases de connaissances**, sur le modèle des espaces de
travail d'AnythingLLM : on y rassemble des documents de Fichiers (la Bibliothèque, dans
le code) ; l'instance les découpe, les vectorise avec le modèle d'embeddings de la
machine et garde des index chiffrés. Un Chat ou Cowork qui a des bases (celles de
l'agent, du projet, ou cochées dans la zone de saisie) reçoit les passages proches de
la question, et l'écran cite sous la réponse ceux que la réponse utilise.

Pourquoi ainsi :

- **Pas de base vectorielle native.** LanceDB (le défaut d'AnythingLLM),
  better-sqlite3 / sqlite-vec et le reclassement par onnxruntime-node sont des modules
  natifs ; la passerelle est un seul fichier CommonJS construit par esbuild et lancé
  par le Node d'Electron 33. Un index par document, chargé en mémoire et comparé par
  force brute (l'idée de Vectra), tient : mesuré sur la boucle, 8 ms pour 10 000
  morceaux, 86 à 167 ms et environ 750 Mo pour 100 000.
- **Recherche hybride** : produit scalaire plus BM25, fusion par rang (RRF). Par le
  sens seul, 9 bonnes réponses au rang 1 sur 10 ; avec les mots, 10 sur 10.
- **Aucune copie des documents.** Une base référence des documents de Fichiers ; le
  texte indexé est celui que la Bibliothèque a déjà extrait sur le poste.
- **Voir une base ne donne pas accès à ses documents.** À chaque question, seuls
  comptent les documents que la personne voit dans Fichiers à ce moment-là. C'est la
  seule règle qui empêche une base ouverte à l'équipe de faire fuir un document privé.
- **Recouvrement de 150 caractères** (et non 20 comme AnythingLLM) : avec 20, une
  phrase coupée à la frontière n'est entière dans aucun morceau.
- **Seules les sources citées sont mises en avant.** Mesuré avec nomic : 0,68 à 0,80
  pour le passage qui répond, 0,63 à 0,71 pour des passages sans rapport. Aucun seuil
  ne les sépare ; les numéros [n] écrits par le modèle, si.
- Le modèle d'embeddings est celui du rôle `embed` du routeur, jamais un modèle branché
  par une clé personnelle d'office.
- **Employés OpenClaw : seulement ce qui est ouvert à toute l'équipe** (décidé le
  25/09/2026). L'employé d'un agent cherche dans les bases de cet agent par un outil,
  `connaissances__chercher`, servi par son serveur d'outils comme ses autres outils
  Helix. N'y comptent que les bases **et** les documents ouverts à toute l'équipe, ni
  les droits du propriétaire de l'agent, ni ceux de qui lui parle. Pourquoi : l'appel
  d'outil arrive d'OpenClaw sans dire pour qui l'employé travaille à cet instant
  (plusieurs conversations, missions sans personne, mails reçus, messageries), et ce
  qu'il lit sort de lui (réponse à un collègue, message Telegram, brouillon, notes de
  sa mémoire relues ensuite). Avec les droits du propriétaire, un document privé
  sortirait vers quelqu'un qui n'a pas à le voir. C'est la règle de sa famille
  « bibliothèque ». Un outil plutôt que l'injection des passages : l'employé appelle le
  modèle sans séance, et le champ `connaissances` du Chat n'est lu qu'avec une séance ;
  surtout, sa boucle appelle le modèle plusieurs fois par tâche, c'est à lui de chercher
  quand il en a besoin. Pas de citations sous la réponse : l'employé nomme le document
  dans son texte (« (source : … ) »), sa fiche de poste le lui demande.
- **Employés OpenClaw et bases partagées à un groupe** (décidé le 25/09/2026,
  l'après-midi, à la demande du client). Règle : un document ne sort d'un employé que
  vers des gens qui ont le droit de le voir. Le seul cas où le code établit sûrement
  qui reçoit ce qu'il lit est celui où **tout ce qui sort de lui ne va qu'à son
  propriétaire** : agent personnel (personne d'autre ne le voit, ne lui parle, ne lit
  ses comptes rendus), sans messagerie, sans mission « à chaque mail », en liberté
  « Encadré », sans outil qui écrit ou envoie là où d'autres lisent (fichiers de
  l'équipe, documents Office, mails, donc sans « Autoriser les outils »). Il lit alors
  aussi les bases et les documents partagés aux groupes dont son propriétaire est
  membre à cet instant : son seul destinataire les voit lui-même. (Le soir même, ses
  documents privés aussi : voir le point suivant.) Tout est relu à
  chaque appel (`employes.ts`, `lectureDesBases`) : ouvert à l'organisation, branché à
  une messagerie, doté d'un outil qui écrit, sorti du groupe, il revient aussitôt à la
  règle de l'équipe. L'écran de l'agent dit, base par base, ce qu'il lira et pourquoi
  pas le reste.
- **Les trois questions du point 18, tranchées** (25/09/2026, le soir ; Medhi : « fais
  au mieux »). Toujours la même règle : ce qui sort de l'employé ne va qu'à des gens qui
  ont le droit de le voir, relu à chaque appel, sans cache (`lecteursDe`).
  - **Agents partagés à des groupes** : visibilité « Groupes » à côté de « Personnel » et
    « Organisation », choisie comme dans la Bibliothèque (seulement ses groupes). Seuls
    les membres de ces groupes à l'instant voient l'agent, le reçoivent par la
    synchronisation (`authz.ts`), lui parlent ; qui quitte le groupe ne le voit plus
    (404) ; seul son propriétaire le modifie. Son employé, s'il remplit les mêmes
    conditions de sortie, lit en plus ce qui est partagé à **chacun** de ses groupes (et
    que son propriétaire voit) : un document partagé au seul groupe A n'est pas lu par
    l'agent des groupes A et B, un membre de B le recevrait. La règle tient quand un
    groupe change de membres. Jamais un document privé, de personne.
  - **Documents privés du propriétaire** : un agent personnel qui remplit les cinq
    conditions lit tout ce que son propriétaire voit, ses documents et bases privés
    compris : il ne produit que pour lui. Jamais le privé d'une autre personne.
  - **La mémoire quand l'audience s'élargit** : un changement qui élargit l'audience
    d'un employé qui a pu lire hors de l'équipe (visibilité, groupe ajouté, messagerie,
    mission à chaque mail, liberté, outil qui écrit) est refusé tant que son
    propriétaire n'a pas confirmé à l'écran ; confirmé, Helix met ses notes de côté
    (copie chiffrée hors du dossier d'OpenClaw, restaurable par le propriétaire tant que
    l'audience n'est pas plus large qu'au moment de la copie), efface ses conversations
    chez OpenClaw (`sessions delete`, `memory forget`, archives), ses notes, l'index de
    sa mémoire (`memory reset`), vérifie, et seulement alors applique le changement. Une
    étape ratée : le changement n'est pas fait, l'écran le dit. « A pu lire » : une trace
    notée à chaque passage lu hors de l'équipe, ou des réglages qui le permettaient avec
    des bases (on ne suppose pas qu'il ne s'en est pas servi).
  - Où OpenClaw 2026.9.4 garde la mémoire d'un agent, relevé sur l'OpenClaw d'essai le
    25/09 : notes dans son espace (`MEMORY.md`, `memory/*.md`, tout fichier écrit),
    conversations et index dans `agents/<agent>/agent/openclaw-agent.sqlite`, archives
    dans `agents/<agent>/sessions/`. **Restent hors de portée du vidage** : les pages
    libérées de cette base SQLite (plus aucune ligne ne porte le mot de contrôle, mais
    le fichier brut le garde), le registre des tâches d'OpenClaw
    (`state/openclaw.sqlite`, les questions posées, gardées 7 jours) et ses journaux
    (`journaux/`, les réponses). Aucun outil d'un employé encadré ou étendu ne les
    atteint ; au palier Libre, qui lit toute la machine (sous mot de passe), si.

### 3.11 Ligne de commande : un client de plus, qui ne décide rien

Demandé le 25/09/2026 : « HelixAI Code dans un terminal, comme Claude Code, Codex CLI
ou OpenCode CLI ». `helix` (`cli/helix.mjs`) est un client de plus de la passerelle,
comme l'interface et l'extension VS Code dont il reprend la manière, sans dépendance
(Node 20 et plus). Il affiche et transmet les réponses de la personne ; modèles,
outils, barrière d'approbation et journal restent ceux de l'instance. **Seuls « o » ou
« oui » accordent** une demande d'approbation ; sans terminal, il ne répond rien et
l'expiration vaut refus.

Les connecteurs n'atteignaient pas Helix Code : OpenCode tient sa propre boucle
d'outils. Lui donner les commandes des serveurs MCP aurait été simple et **pas sûr** :
il les aurait appelés sans barrière d'approbation, sans journal, et aurait reçu leurs
secrets. La passerelle les sert donc elle-même à OpenCode, par MCP, sur
`/helix/code/outils` (`outilsCode.ts`), derrière la barrière. OpenCode ne dit pas de
quelle session vient un appel : si les sessions qui travaillent appartiennent toutes
à la même personne, la carte d'accord va chez elle ; sinon, **refus sans carte**, parce
qu'une carte envoyée à la mauvaise personne lui ferait approuver l'action d'un autre.

**Les sessions de Helix Code passent par l'ancienne API d'OpenCode** (décidé le
25/09/2026). Cause trouvée dans le code d'OpenCode 1.18.32, la dernière version
publiée : les sessions de sa nouvelle API (`/api/session`) tirent leurs outils d'un
registre « v2 » où seuls les outils livrés sont inscrits ; rien n'y inscrit ceux des
serveurs MCP, et l'équipe d'OpenCode l'écrit elle-même sur sa branche de
développement (« MCP [...] still need an explicit canonical registration design »).
Aucun réglage, agent ou champ `tools` n'y change rien, et aucune version plus récente
n'existe. L'ancienne API (`/session`, `prompt_async`) ajoute les outils MCP à ceux de
l'agent. Les trois clients (écran, extension VS Code, `helix code`) lisent le flux de
la nouvelle API (`session.next.*`) : plutôt que de les réécrire, la passerelle écoute
`/event` et fabrique pour chaque session les évènements qu'ils lisent déjà, numérotés,
avec la reprise par `after` (`gateway/src/fluxCode.ts`). OpenCode n'a pas changé de
version. Trouvé en essayant : OpenCode ne relit la liste des outils d'un serveur MCP
qu'en s'y reconnectant, si bien qu'un connecteur branché pendant qu'il tournait
n'existait pas pour l'agent (« Aucun outil disponible ») ; la passerelle lui fait
rouvrir la connexion avant une demande quand la liste a changé.

Vérifié le 25/09/2026 sur une instance jetable, Qwen3 8B, avec un serveur MCP d'essai
sans compte (`scripts/mcp-essai.mjs`, rejoué par `npm run essai:cli -- --modele` :
48 sur 48) : par `helix code`, la carte d'accord arrive chez
la personne, le refus empêche l'appel (trace du serveur vide), « o » au terminal le
laisse partir (note écrite, `outil.appele` au journal avec `surface: "code"`) ; par la
route de l'écran, lecture accordée par l'API d'approbation, flux traduit complet
(`prompted`, `tool.called` `helix_carnet__lire_carnet`, `tool.success`, fin « stop »),
reprise par `after` ; deux personnes au travail en même temps : refus sans carte
(`titulaire-inconnu` au journal), outil non exécuté. L'écran Code a été vu dans le
navigateur plus tard le même jour (séance posée par l'API, sans mot de passe tapé ;
voir « Petit modèle, petit contexte » plus bas), mais sans connecteur branché. Pas essayé non plus : un vrai connecteur avec compte (Drive,
Slack, courrier) dans Code, l'extension VS Code avec un connecteur.

**Sessions de Code séparées des Chats** (25/09/2026, demandé par Medhi, « comme dans
Claude Code »). Avant, les sessions n'existaient que chez OpenCode (qui garde leurs
messages) et dans la mémoire de la passerelle (`modeleDeSession`, perdu au
redémarrage) et de l'écran (qui rouvrait toujours la dernière). Désormais un registre
(`gateway/src/sessionsCode.ts`, collection interne `sessionsCode`) retient pour chaque
session ouverte par `POST /helix/code/session` sa propriétaire, son dossier, son titre
(début de la première demande), son modèle et ses dates ; le contenu reste chez
OpenCode, relu à l'ouverture (`GET /session/<id>/message`), jamais recopié. Routes
`GET /helix/code/sessions`, `GET` et `DELETE /helix/code/sessions/<id>` (séance
requise, chacun les siennes) ; une session du registre refuse (403) demande, arrêt et
flux venant d'une autre personne, vérifié à la main avec deux comptes. Les sessions de
la ligne de commande et de l'extension y entrent aussi. Un registre illisible lève au
lieu d'être réécrit vide. **Les sessions ouvertes avant ce changement ne sont pas
listées** (on ne sait pas à qui elles sont) : elles restent intactes chez OpenCode, rien
n'a été effacé. L'effacement d'un compte retire ses sessions du registre et les efface
chez OpenCode quand son serveur tourne (journal : `sessionsCode`, `sessionsCodeEffacees`) ;
pas essayé. L'écran : voir SCREENS.md, écran Code.

La séance du terminal est un fichier en clair (`~/.helix/cli-seance`, 0600, dossier
0700), comme les outils de ligne de commande habituels : un trousseau demanderait une
dépendance native. Contrepartie assumée, écrite dans SECURITE.md § 22.

**Petit modèle, petit contexte, et voir où en est l'agent** (25/09/2026). Constat de
Medhi : « Aucun signe de l'agent de code depuis 90 secondes » pendant que l'agent
travaillait, puis des lignes « ✓ task » sans détail. Relevé dans le journal de LM
Studio le même jour : une demande d'OpenCode de 18 141 jetons lue en 146,9 s
(123 jetons/s) par Qwen3 8B (contexte 28 160, une demande à la fois), parce que le
modèle, partagé avec d'autres programmes (51 demandes d'OpenClaw ce jour-là, autour de
18 000 jetons chacune), avait perdu ce qu'il avait déjà lu. Trois choses changent :

- **La passerelle dit ce que fait le modèle avant son premier mot**
  (`gateway/src/attenteModele.ts`). OpenCode joint à chaque appel l'identifiant de sa
  session (`X-Session-Id`, `x-parent-session-id` pour un sous-agent, lu dans son
  code) ; tant que le relais (`chat.ts`) n'a rien reçu du modèle, la session reçoit
  toutes les dix secondes un `helix.statut` : lecture, attente de son tour (le modèle
  génère pour un autre programme), chargement, avec le temps écoulé et la taille
  approximative. Pour LM Studio sur le poste, l'état vient de `lms ps --json` (lecture
  seule, une fois par dix secondes au plus) ; le pourcentage lu vient de son journal
  (« Prompt processing progress »), et seulement quand on sait que c'est notre
  lecture (le modèle lit, personne en file, un seul appel de la passerelle sur ce
  modèle). LM Studio au repos deux fois de suite alors que rien n'est reçu : plus de
  statut, et le guet de silence des clients dit sa vraie panne.
- **La demande est allégée** (`gateway/src/allegementCode.ts`). Mesuré au tokeniseur de
  Qwen3 sur une instance jetable, demande la plus simple sans historique :
  **8 025 jetons avant, 2 803 après** (−65 %). Consignes d'OpenCode 2 098 → 446
  (`agent.build.prompt`) ; descriptions des outils livrés raccourcies dans le relais,
  seulement si elles commencent par le texte d'OpenCode 1.18.32, paramètres
  inchangés (bash 1 334 → 369, task 867 → 469, todowrite 659 → 253…) ; `skill` refusé
  (165, sans usage pour Helix) ; bibliothèque et réunions servies à Code seulement si
  elles ont quelque chose pour la personne (718 à vide). `webfetch` reste, raccourci.
  Et OpenCode apprend la taille du contexte chargé (`limit`, `limiteDe` d'opencode.ts) :
  sans elle, il ne résumait jamais une conversation qui s'allonge et demandait 32 000
  jetons de réponse, plus que tout le contexte.
- **Un panneau de suivi dans l'écran Code**, à droite comme dans Cowork
  (`SuiviCode.tsx`, `lib/suiviCode.ts`) : ce que l'agent fait maintenant (lecture avec
  barre de progression, réflexion, outil et sa cible), sa liste de tâches
  (`todowrite`), les sous-tâches (`task`) avec leur description et leurs propres
  outils (rapportés par `fluxCode.ts`, `helix.soustache`), les fichiers touchés, le
  temps total. Les lignes d'outils du fil disent aussi ce qu'elles font
  (`actionOutil`) : « Sous-tâche : Liste les fichiers du dossier » au lieu de
  « task ». Mêmes mots dans `helix code` (ligne d'état réécrite sur place dans un
  terminal) et, simplement, dans l'extension VS Code (0.2.3, `.vsix` pas refait).

Vérifié le 25/09/2026 sur ce poste, instance jetable (port 8896), Qwen3 8B de LM Studio
partagé : dans l'écran Code du navigateur, une tâche avec sous-tâche, liste de tâches
et deux fichiers écrits, 3 min 49 s en tout, le panneau montrant d'abord « Le modèle
termine une autre demande avant celle-ci » (LM Studio occupé ailleurs), puis « Le
modèle lit la demande (33 s, environ 3 000 jetons) » avec « 1 en file », puis la
sous-tâche et son outil, les fichiers, « Terminé » ; une demande de 7 815 jetons lue
en 43,1 s avec la barre à 32 puis 63 % ; aucun message de panne. Au passage, dans ce
banc, OpenCode a mis 20 s entre l'envoi et le début de son travail pour chaque
nouvelle session (5 s une autre fois, 0 s dans les essais du matin) : pas compris, pas
touché. *Pas essayé* : l'état « chargement » avec un vrai modèle à charger, la lecture
d'un sous-agent assez longue pour s'afficher, l'extension VS Code et la ligne de
commande dans un vrai terminal devant un modèle lent (`npm run essai:cli` reste vert :
31 sur 31 sans modèle, 48 sur 48 avec ; `npm run securite` : 152 sur 152), un contexte chargé plus petit par un autre
programme après le démarrage d'OpenCode (non vu par `limit`).

### 3.12 Entraîner un modèle : MLX-LM sur Mac, Unsloth sur carte NVIDIA

Demandé le 25/09/2026 : « entraîner un modèle sur des trucs précis », simplement,
depuis le logiciel, avec Unsloth et d'autres briques ouvertes. Livré : Paramètres >
Entraîner un modèle, en quatre étapes (exemples, entraîner, comparer, installer dans
LM Studio), et `gateway/src/entrainement.ts`.

- **Sur Mac, MLX-LM (MIT), LoRA.** Unsloth sur Mac passe lui-même par MLX : inspecté
  en lecture seule le 25/09/2026, son application installe mlx 0.32.1 et mlx-lm 0.31.3
  dans un environnement de 4,4 Go, et bascule sur `unsloth_zoo.mlx`. Aller directement à
  MLX-LM, c'est le même moteur, sans 4 Go de plus. Piloter l'application Unsloth du
  poste a été écarté (authentification propre, bêta, données d'une autre application).
- **Sur carte NVIDIA, QLoRA 4 bits par Unsloth**, transformers + peft en repli
  (Apache 2.0, bitsandbytes MIT). Écrit d'après la documentation, **jamais essayé sur
  une vraie machine**, et l'écran le dit.
- **Unsloth, décidé par Medhi le 25/09/2026.** Le cœur est Apache 2.0 et dépend
  d'`unsloth_zoo`, LGPL-3.0-or-later : utilisée comme bibliothèque, non modifiée, dans
  l'environnement Python séparé du moteur, elle est compatible avec l'AGPL du projet.
  C'est une **exception** à la règle « Apache 2.0 ou MIT », limitée à ces deux paquets ;
  Unsloth Studio (AGPL-3.0, application à part) n'est pas utilisé. Sur NVIDIA, Unsloth
  annonce environ deux fois plus de vitesse avec la même méthode. Les deux roues
  (unsloth 2026.9.11, unsloth_zoo 2026.9.7) sont téléchargées par Helix et vérifiées
  par empreinte (relevées sur PyPI et recalculées le 25/09/2026) ; leurs dépendances
  viennent de PyPI sans empreinte, comme le reste de la pile NVIDIA. Compatibles avec
  les versions figées (torch < 2.13, transformers 4.57.6, peft ≥ 0.18). Si Unsloth ne
  s'installe pas ou ne se charge pas, `SCRIPT_NVIDIA_ENTRAINER` repasse par
  transformers et peft, et le journal dit lequel a servi (`unsloth: true/false`). Les
  scripts de réponse et de fusion n'ont pas changé : l'adaptateur a le format de peft.
- **Exemples d'ancrage** : 30 questions ordinaires répondues par le modèle de départ
  lui-même, mêlées aux exemples. Mesuré sur Qwen3 1.7B : sans eux, 12 faits sur 15 et
  « la capitale de l'Italie est Verona » ; avec eux et une échelle LoRA de 10, 15 sur 15.
- **Rien n'est appris sans accord** : les paires tirées d'un document par le modèle du
  Chat vont dans « propositions à relire ».
- **Le modèle installé n'est jamais choisi d'office** : constaté à l'écran, il devenait
  le raccourci « Rapide » du sélecteur. Les modèles de `helix-entrainement/` portent
  `entraine: true` et sont écartés du choix automatique.
- Un nouvel entraînement s'écrit à côté de l'ancien : arrêté ou raté, il ne fait pas
  perdre le modèle qui marchait.

### 3.13 API développeur : des clés personnelles, pour l'API compatible OpenAI seulement

Demandé par Medhi le 26/09/2026 : l'écran Paramètres → API développeur, « bientôt »
depuis le début, doit fonctionner. Cela défait la décision du 20/09/2026 qui
rattachait les clés d'API aux abonnements hébergés : les clés servent d'abord à
l'instance elle-même, et n'attendent donc pas de relais ni de paiement.

**Ce qui a été décidé.** Une personne connectée crée une clé nommée (`hlx_` puis
32 octets aléatoires), montrée **une seule fois** ; l'instance n'en garde qu'une
empreinte SHA-256 salée, le nom, les quatre derniers caractères, les dates et une
portée (`gateway/src/clesApi.ts`, collection interne `clesApi`). Expiration à 30, 90
ou 365 jours, ou jamais ; 20 clés par personne ; renommage ; révocation immédiate.
Une clé **remplace le jeton d'instance et la séance**, et seulement sur
`GET /v1/models` et `POST /v1/chat/completions` (`ROUTES_CLE`, index.ts, liste fermée
posée avant le jeton comme `EXECUTION` avant le routage). Elle agit au nom de sa
titulaire : ses modèles (clés personnelles de modèles cloud comprises), ses bases de
connaissances par le champ `connaissances`, sa consommation dans Mon usage, une ligne
`api.appel` à son journal (route, modèle, issue, jamais le contenu).

**Ce qu'elle ne fait pas, et pourquoi.** Aucune route `/helix/*` (403 sans même
vérifier la clé) : une clé vit dans un script, sur une machine qu'on ne surveille
pas, et une fuite ne doit ouvrir ni les Chats, ni les fichiers, ni les réglages.
`tools: true` est refusé : l'instance n'exécute rien pour une clé, ni outils de
fichiers, ni écran, ni connecteurs de la personne ; les outils que le programme
fournit (`tools: [...]`) passent, c'est lui qui les exécute. Une clé ne crée pas de
clé. Elle ne se présente que dans `Authorization: Bearer` : dans l'adresse ou dans
l'en-tête de séance, elle est refusée même valide (401), pour qu'un script le
découvre avant la fuite. **60 requêtes par minute et par clé** (`debit.ts`,
`HELIX_CLE_API_PAR_MINUTE`), pour qu'une clé fuitée ne puisse pas occuper la machine.
L'écoute réseau n'a pas changé : sans ouverture aux collègues, l'API n'est joignable
que depuis la machine de l'instance, et l'écran le dit.

**Trouvé en le faisant.** Le relais de `/v1/chat/completions` ne rendait que du flux,
même sans `stream: true` : le paquet `openai`, qui ne demande pas de flux par défaut,
aurait échoué à lire la réponse. Pour un appel par clé, la passerelle recompose
désormais l'objet `chat.completion` (texte, raisonnement, appels d'outils, fin,
consommation), le moteur restant interrogé en flux. Pour les autres clients (jeton
d'instance, OpenCode, employés), rien n'a changé. Le champ `connaissances` partait
aussi jusqu'au moteur : il est retiré avant l'envoi (un fournisseur cloud refuse un
champ inconnu). `POST /v1/embeddings` n'est pas servi par la passerelle : une clé ne
l'ouvre donc pas.

**Vérifié le 26/09/2026** sur une instance jetable (port 8913, `HELIX_DATA_DIR`
temporaire, LM Studio partagé en lecture, qwen3-8b déjà chargé) : clé créée à l'écran
(30 jours), montrée une fois, copie refusée par le navigateur d'essai et valeur
sélectionnée à la place ; `curl` en flux et sans flux (l'exemple de l'écran recopié tel
quel : `chat.completion`, 1 016 caractères de raisonnement puis la réponse) ; appel
Python par `urllib` (le paquet `openai` n'est pas installé sur ce poste) : sans base,
le modèle invente un code (« 123456 ») ; avec `connaissances: ["kb_…"]`, en flux et
sans flux, il rend TAMARIN-5821 et la source `Reglement-atelier.txt` ; révocation à
l'écran avec confirmation, puis 401 aussitôt ; Mon usage : 6 requêtes à son nom ;
journal : « Clé d'API créée », « Appel à l'API par une clé », « Clé d'API révoquée »,
aucune clé en clair dans les données ni dans la sortie du serveur. Instance chiffrée
sur la boucle locale (`tls: true`, port 8914) : l'adresse de base annoncée passe en
`https://localhost:8914/v1`, `curl` sans le certificat échoue, avec
`--cacert instance-cert.pem` il répond. Batterie : 221 contrôles, tous réussis.
**Pas essayé** : le paquet `openai` lui-même, un appel depuis une autre machine d'une
instance ouverte aux collègues, un client tiers (tableur, éditeur).

### 3.14 Un abonnement ChatGPT (par Codex) ou Claude dans Helix : ce qui est permis

**Décidé par Medhi le 27/09/2026 : Codex, oui (« ajoute »), fait le jour même** selon la voie
décrite plus bas (voir « Fait » à la fin de cette section). **Claude par abonnement : non**, rien
n'est écrit. Demandé le 27/09/2026 : « si possible, que quelqu'un puisse
connecter son compte Codex ou Claude dans Helix, pour avoir le meilleur logiciel avec
leur compte », c'est-à-dire se servir d'un abonnement ChatGPT Plus/Pro ou Claude
Pro/Max sans clé d'API payée à l'usage.

Relevé à la source le 27/09/2026, documentation et conditions officielles seulement
(les articles de presse ne servent qu'à dater). Ce n'est pas un avis juridique. Au premier
relevé, aucun code : la voie Claude est fermée, la voie OpenAI est ouverte mais défait le
§ 3.1 et demande des garde-fous qui sont des choix, pas des détails. Medhi les a faits
(voir « Fait »).

**Claude (Pro, Max) : interdit pour Helix, sauf accord écrit d'Anthropic.**

- [Claude Code, Legal and compliance](https://code.claude.com/docs/en/legal-and-compliance),
  « Authentication and credential use » : la connexion par compte (OAuth) est réservée
  à l'usage ordinaire de Claude Code et des applications d'Anthropic ; un développeur
  tiers ne peut ni offrir la connexion Claude.ai dans son application, ni faire passer
  des requêtes par les identifiants d'un abonnement « on behalf of their users », ni
  recueillir ou relayer les jetons. Anthropic se réserve de sévir sans préavis : c'est le
  compte de la personne qui est exposé.
- [Agent SDK overview](https://code.claude.com/docs/en/agent-sdk/overview), encadré :
  sauf accord préalable, pas de connexion claude.ai ni des limites d'abonnement dans le
  produit d'un tiers, « including agents built on the Claude Agent SDK ». Or
  [la page du mode non interactif](https://code.claude.com/docs/en/headless) présente
  `claude -p` comme l'Agent SDK en ligne de commande : piloter le `claude` installé par
  la personne, comme moteur d'Helix, tombe sous cette phrase.
- La même page Legal ne retient qu'une exception : une personne peut se connecter avec
  son abonnement au binaire Claude Code **non modifié**, même quand une plateforme
  l'héberge, à condition que l'éditeur de la plateforme accepte les Commercial Terms et
  ne paie ni ne revende l'usage. Cela vise le fait de donner Claude Code lui-même à la
  personne, pas d'en faire le moteur d'un autre produit ; et ne pas écrire « Claude
  Code » dans le nom d'une fonction d'Helix.
- [Consumer Terms](https://www.anthropic.com/legal/consumer-terms) (en vigueur le
  08/10/2025) : pas d'accès automatisé hors clé d'API ou permission explicite ; pas de
  compte mis à la disposition d'autrui.
- À ne pas mal lire : [l'article d'aide sur l'Agent SDK et les abonnements](https://support.claude.com/en/articles/15036540-use-the-claude-agent-sdk-with-your-claude-plan)
  cite les « third-party apps » qui passent par l'abonnement, mais pour décrire un crédit
  mensuel **suspendu le 15/06/2026** (« no longer taking effect ») ; il ne lève pas la
  règle faite aux développeurs.

**ChatGPT (Plus, Pro) par Codex : permis sous une forme étroite.** Piloter le programme
`codex` officiel, installé par la personne et connecté par elle, par le parcours
d'OpenAI, pour son propre usage.

- [Codex SDK](https://learn.chatgpt.com/docs/codex-sdk) : parmi les usages prévus,
  « Integrate Codex within your own application ».
- [Codex app-server](https://learn.chatgpt.com/docs/app-server) : l'interface des clients
  riches (l'extension VS Code ; [l'article d'OpenAI sur l'app-server](https://openai.com/index/unlocking-the-codex-harness/)
  cite aussi JetBrains et Xcode, page refusée à l'outil et lue par extrait), à prendre
  « inside your own product » pour la connexion, l'historique et les approbations. En
  mode « ChatGPT managed », c'est Codex qui mène la connexion, garde et renouvelle les
  jetons ; `account/rateLimits/read` rend les limites de l'abonnement à l'application
  hôte. La même page dit la commande `app-server` et son transport WebSocket
  expérimentaux, non pris en charge en production. Pour un client destiné aux
  entreprises, OpenAI demande qu'on le contacte pour être ajouté à sa liste de clients
  connus (`clientInfo.name`).
- [Mode non interactif](https://learn.chatgpt.com/docs/non-interactive-mode) : `codex exec`
  reprend par défaut la connexion enregistrée ; la connexion par compte ChatGPT en
  automatisation est décrite pour qui veut les limites de l'abonnement plutôt que la
  facturation de l'API, sur des machines de confiance. La clé d'API reste le choix
  recommandé pour l'automatisation, et [l'authentification](https://learn.chatgpt.com/docs/auth)
  déconseille d'exposer Codex dans un environnement non fiable ou public.
- [Terms of Use](https://openai.com/policies/row-terms-of-use/) (et la version
  européenne) : ne pas mettre son compte à la disposition d'autrui, ne pas contourner les
  limites, pas d'extraction automatisée hors de l'API. **Page refusée à l'outil de
  lecture (403) le 27/09/2026** : ces clauses n'ont été lues que par extraits dans un
  moteur de recherche, à relire en entier.

**Écarté, parce qu'OpenAI ne le couvre nulle part pour un tiers :** reprendre ou copier
des jetons (le fichier `~/.codex/auth.json`, que la documentation demande de traiter
comme un mot de passe et qui reste dans les zones protégées, `zonesProtegees.ts`) ; le
mode `chatgptAuthTokens` de l'app-server, prévu pour une application qui possède déjà la
connexion ChatGPT de la personne ; la connexion ChatGPT qu'OpenCode fait lui-même
(`/connect`, annoncée par ses auteurs le 11/01/2026, sans page d'OpenAI qui la valide) ;
un Codex modifié (un ingénieur d'OpenAI a refusé de trancher, [discussion
#8338](https://github.com/openai/codex/discussions/8338), 19/12/2025). « Sign in with
ChatGPT », lancé le 02/08/2026 avec six partenaires, ne transmet que l'identité (nom,
adresse, photo) : ce n'est pas un moyen de faire payer les modèles par l'abonnement.

**Pourquoi rien n'était codé au premier relevé, même pour Codex** (les quatre points ont été
tranchés par la décision de Medhi et par les garde-fous de « Fait ») **:**

1. **Le § 3.1.** Codex est un agent de code complet, avec ses outils, son bac à sable et
   ses approbations. Le brancher, c'est un second moteur d'agent à côté d'OpenCode : le
   « seul moteur » se défait, et c'est à Medhi de le dire.
2. **Pour la personne seule.** La connexion de `codex` appartient au compte système qui
   fait tourner la passerelle. Sur une instance ouverte aux collègues, par une clé de
   l'API développeur (§ 3.13), par un employé OpenClaw ou une tâche programmée, d'autres
   se serviraient de l'abonnement de cette personne, ce que les conditions interdisent.
3. **Ce qui part chez OpenAI** : la demande, et tout ce que Codex lit dans son dossier de
   travail, aux États-Unis, en dehors de la barrière d'approbation d'Helix (Codex décide
   dans son propre bac à sable). La règle « chaque modèle dit où il tourne » s'applique.
4. **Rien d'essayable dans cette session** : s'y connecter à un compte était exclu, tout
   aurait été livré « pas essayé ».

**Ce qu'Helix propose aujourd'hui, sans rien changer :** la clé d'API du fournisseur,
OpenAI ou Anthropic, dans Paramètres → Modèles cloud (`fournisseurs.ts`), pour soi ou
pour l'équipe, pays affiché, facturée à l'usage à la titulaire. C'est la seule voie que
les deux éditeurs recommandent pour un produit tiers.

**Si Medhi dit oui pour Codex, la voie la plus simple et la plus sûre :**

- Écran Code seulement (pas le Chat : Codex répond en agent de code), moteur au choix
  « Codex, avec votre abonnement ChatGPT » à côté d'OpenCode.
- Détection : `codex` trouvé sur la machine, sa version, et l'état de connexion demandé
  au programme lui-même (`codex login status`) ; Helix n'ouvre jamais `~/.codex`.
- Connexion : un bouton lance `codex login`, la personne termine chez OpenAI dans son
  navigateur ; Helix ne voit passer aucun jeton.
- Exécution : `codex exec --json --sandbox workspace-write` dans le dossier du projet,
  son flux JSONL (`item.*`, `turn.completed` avec la consommation) converti dans le flux
  de Code existant (`fluxCode.ts`). `codex app-server` relaierait mieux les demandes
  d'approbation vers la barrière d'Helix et les limites de l'abonnement, mais OpenAI le
  dit expérimental : à reprendre quand il ne le sera plus.
- Garde : réservé au compte propriétaire de l'installation de bureau ; refusé sans
  séance, par clé d'API, pour un employé, une tâche programmée, et sur une instance
  ouverte aux collègues. Contrôles dans `npm run securite` avec un faux `codex` sans
  réseau.
- À l'écran : « OpenAI, États-Unis », « limites de votre abonnement ChatGPT », et ce que
  Codex peut lire.
- À essayer sur le poste : Medhi se connecte lui-même par `codex login`, une vraie tâche
  de Code, puis la limite d'abonnement atteinte.

Pour Claude, la seule suite possible est une demande d'accord écrite à Anthropic
(page « contact sales » citée par la page Legal) ; sans elle, rien.

**Fait le 27/09/2026 : Codex dans l'écran Code, pour le propriétaire du poste.** Par la voie
ci-dessus, avec ce qui a été relu à la source en l'écrivant :

- **Fichiers** : `gateway/src/codexGarde.ts` (qui, quel bac à sable, conversion du flux, sans
  rien lancer : c'est ce que la batterie vérifie une à une), `gateway/src/codex.ts` (détection,
  connexion, tâches, routes `/helix/codex*`), `src/lib/codex.ts`, `src/hooks/useCodex.ts`,
  `src/components/code/MoteurCode.tsx` ; branchés en quelques lignes dans `index.ts`, `audit.ts`,
  `CodePage.tsx`, `Composer.tsx` (`sansModele`) et `electron/main.cjs` (`HELIX_BUREAU=1`).
- **Détection** : `HELIX_CODEX_BIN`, puis le PATH, puis Homebrew, `~/.local/bin`, npm global,
  Volta, Bun, nvm ; sous Windows `codex.exe` (PATH, WinGet) ou le script du paquet npm lancé par
  `node` (**pas essayé sur un vrai Windows**). Jamais sous `~/.codex`. Version par
  `codex --version`, connexion par `codex login status` (« exits 0 when credentials present »,
  page « Developer commands ») ; le mode (ChatGPT ou clé d'API) est lu dans sa première ligne,
  masquée. Helix ne lit **aucun fichier** pour cela.
- **Connexion** : « Se connecter avec ChatGPT » lance `codex login` (sortie ignorée, dix minutes
  au plus, annulable) ; l'écran relit l'état toutes les deux secondes. Codex absent : l'écran donne
  `npm install -g @openai/codex` (et `brew install --cask codex` sur Mac), relevés dans le README
  d'openai/codex ; Helix ne l'installe pas.
- **Exécution** : `codex exec --json --skip-git-repo-check --sandbox <bac> -c sandbox_mode=…
  -c approval_policy="never" -c sandbox_workspace_write.network_access=false -`, dans le dossier du
  projet validé comme pour OpenCode, la demande sur l'entrée standard (jamais dans `ps`). Reprise :
  `codex exec --json … resume -c … <thread_id> -`, seulement pour une session ouverte par cette
  passerelle et pour la même personne, dans son dossier. `--sandbox` n'est pas accepté par
  `resume`, et une reprise sans réglage retombait sur `workspace-write` (openai/codex #40149,
  22/08/2026) : d'où le bac à sable redonné par `-c` à chaque fois. Le flux JSONL (`thread.started`,
  `item.*` : `agent_message`, `reasoning`, `command_execution`, `file_change`, `mcp_tool_call`,
  `web_search`, `todo_list`, `collab_tool_call`, `error` ; `turn.completed`, `turn.failed`)
  devient les évènements de l'écran Code (message, raisonnement, commandes, fichiers écrits ou
  modifiés, liste de tâches) : même rendu et même panneau de suivi qu'avec OpenCode. Arrêt par le
  bouton, fermeture de l'écran, ou au bout d'une heure ; une tâche à la fois.
- **Niveau d'approbation** : `codex exec` ne demande jamais rien (`approval_policy = never`, lu
  dans `codex-rs/exec/src/lib.rs`). D'où « tout » → `workspace-write` (réseau des commandes
  coupé), « modifications » → `read-only`, « chaque » → Codex refusé. Jamais
  `danger-full-access`.
- **Réservé au propriétaire**, vérifié par la passerelle à chaque route : pas de clé de l'API
  développeur, pas de jeton dans l'adresse, installation de bureau (`HELIX_BUREAU`), instance non
  partagée, requête par la boucle locale, compte administrateur. Pour les autres, `GET
  /helix/codex` répond « non proposé » sans même lancer `codex`. Un employé OpenClaw ou une tâche
  programmée n'ont ni séance ni accès à ces routes, et Codex n'est un outil nulle part.
- **À l'écran** : le sélecteur « OpenCode (modèles de …) » / « Codex (votre compte ChatGPT) »,
  visible du seul propriétaire ; un encadré dit que la demande et les fichiers lus partent chez
  OpenAI (États-Unis), sous les limites de l'abonnement, hors des approbations de Helix, que
  Helix ne borne pas ce que Codex lit, et ce que permet le bac à sable au niveau actuel. Le choix
  du modèle et du niveau de raisonnement disparaît (Codex choisit le sien).
- **Pas fait** : les sessions de Codex ne sont pas dans la liste des sessions de Code (la
  conversation continue tant que l'écran est ouvert) ; la consommation que rend
  `turn.completed` n'est pas affichée ; les limites de l'abonnement ne sont pas lues
  (`account/rateLimits/read` est dans l'app-server, expérimental).

**Vérifié ici** : `npm run typecheck` ; `npm run securite`, 517 contrôles, 0 échec (42 de plus :
les routes sans jeton et sans séance, puis la section 7 nonies, avec un faux `codex`,
`scripts/faux-codex.mjs`) ; i18n à 100 % des deux côtés. **Pas essayé** : le vrai `codex`, un vrai
compte, l'écran dans l'application.

**À essayer sur le poste de Medhi** : installer Codex (`npm install -g @openai/codex`), puis dans
Code choisir « Codex », « Se connecter avec ChatGPT » et terminer dans le navigateur ; une demande
au niveau « Demander avant de modifier » (Codex doit rester en lecture seule), puis au niveau
« Tout approuver » (une modification dans le projet), la reprise par une deuxième demande,
l'arrêt en cours de tâche ; enfin la limite d'abonnement atteinte, pour voir le message rendu.
Vérifier aussi qu'un compte membre et un poste rattaché ne voient pas le sélecteur.

### 3.15 Notes et prix des modèles : Epoch AI (CC BY 4.0) et les pages de prix des fournisseurs (27/09/2026)

**Décision de Medhi, 27/09/2026 : « Source ouverte ».** Les notes des modèles (graphique
« Comparer les modèles », sélecteur, catalogue de `provision.ts`) venaient jusqu'ici d'un
relevé commercial dont les conditions interdisent de reprendre les données (historique :
Artificial Analysis, jusqu'à 2026.927.4). Elles viennent désormais d'une source sous
licence ouverte, et les coûts des pages de prix officielles des fournisseurs.

- **Notes : l'indice ECI d'Epoch AI** (« Capabilities & benchmarking »,
  https://epoch.ai/benchmarks/use-this-data, archive `benchmark_data.zip`, fichier
  `epoch_capabilities_index/eci_scores.csv`). Licence CC BY 4.0, lue sur la page : « free to
  use, distribute, and reproduce provided the source and authors are credited ». Attribution
  affichée sous le graphique (source, licence, lien, date du relevé). Retenue parce qu'elle
  couvre sur **une seule échelle** les modèles cloud du jour et des modèles ouverts qu'on fait
  tourner chez soi (Qwen3 8B à 32B, Qwen3.5 9B et 35B-A3B, Qwen 3.8 27B, gpt-oss-20b,
  Magistral Small, Gemma, Llama, Phi). Recopiés : les 217 modèles sortis depuis le
  01/01/2024, valeurs publiées telles quelles (`gateway/src/notesModeles.ts`). Epoch ne note
  pas les plus petits (Qwen3 4B et 1.7B, Qwen3.5 4B et 2B, Ministral 3, Granite 4.1, OLMo 3,
  Qwen3-VL, GLM-4.7 Flash, Muse Glimmer) : l'écran dit « pas de note publiée », rien ne les
  remplace. Epoch a été lue en premier et suffit : sa licence est écrite en clair et sa
  couverture répond au besoin. LMArena, Open LLM Leaderboard, Aider et LiveBench n'ont pas
  été examinés en détail (l'archive d'Epoch contient d'ailleurs des résultats d'Aider et de
  LiveBench, qui gardent leur propre licence et ne sont pas repris). Une seconde série
  d'Epoch (GPQA Diamond, évaluée par Epoch) couvrirait Qwen3 4B et 1.7B ; elle n'est pas
  reprise, pour ne pas mettre deux échelles côte à côte.
- **Prix : les pages officielles** (`gateway/src/prixPublies.ts`), relevées le 27/09/2026 :
  OpenAI, Anthropic, Google, Mistral (en euros, la page donne aussi les dollars), DeepSeek
  (tarif de pointe), xAI, Groq, Together, Scaleway, OVHcloud, IONOS (page allemande, en
  euros), OpenRouter (sa liste publique de modèles) : 211 lignes. Tarif standard, contexte
  court ; ni cache, ni lots, ni paliers gratuits. Le graphique place un modèle au prix de
  sortie publié par **son éditeur**, en dollars (57 modèles notés ont un tel prix).
- **Correspondance des noms** (`gateway/src/nomsModeles.ts`), parce que Medhi voyait que
  « quel que soit le modèle cloud choisi, il n'apparaissait pas » : préfixe de clé
  (`cle-…/`) et d'éditeur, quantification (`@q4_k_m`, `-mlx`), `-latest`, `-instruct`, casse
  et séparateurs s'effacent ; une date complète (`-2025-04-14`, `-20250514`) seulement en
  second essai, et jamais entre deux instantanés datés ; une date courte (`-2507`) jamais.
  Aucune ressemblance partielle, et un nom qui désigne deux modèles n'en désigne aucun
  (`gpt-4o`, trois instantanés notés). Les renvois documentés par un fournisseur
  (`mistral-medium-3` est Mistral Medium 3.5 chez Mistral) valent pour ses modèles cloud,
  jamais pour un modèle local. Vérifié par `node scripts/essai-notes-modeles.mjs`.
- **Tous les modèles de la personne figurent au graphique** : un point (cloud noté avec
  prix), la bande de gauche (machine), la bande de droite (cloud noté sans prix relevé), ou
  la liste « pas de note publiée ».
- **Conséquence sur l'installation** (`provision.ts`) : un modèle noté passe devant un modèle
  sans note, et entre deux modèles sans note le plus lourd d'abord. Sur un PC de 16 Go sans
  carte graphique, Qwen3 8B (136,17) est désormais conseillé avant Qwen3.5 4B (non noté) ;
  sur 8 Go, Qwen3.5 4B reste le premier ; sur un Mac de 256 Go, Qwen 3.8 27B (149,38) passe
  devant DeepSeek V4 Flash (146,1). Le scénario de `npm run securite` qui rejouait le PC de
  Medhi simule donc un Windows de 8 Go, avec Qwen3 4B pour relais.

**Mon usage : les prix publiés s'appliquent (Medhi, 27/09/2026 : « dans mon usage ça serait
sympa d'avoir le tarif de tous les modèles cloud »).** La règle d'origine de l'écran, « aucun
prix par défaut » (§ 5, Affichages faux), est changée : un modèle cloud sans tarif saisi prend le prix publié par **son**
fournisseur (même correspondance de noms), l'écran écrit « prix publié par {fournisseur},
relevé du {date} » avec le lien, et dit le coût estimé. Un tarif saisi l'emporte toujours et
est marqué comme tel ; un modèle sans prix connu garde « tarif non renseigné » et n'est jamais
compté à zéro ; un modèle local n'a pas de tarif. Les devises ne se convertissent pas : un
tarif porte sa devise (EUR pour ceux saisis avant, c'était la seule proposée), et les totaux
se font devise par devise (« 1,20 $ + 0,30 € »). Au passage : des tarifs ou un registre
illisibles valaient `{}` et le premier tarif saisi écrasait tout ; ils restent désormais
illisibles, rien n'est écrit par-dessus, et l'écran le dit.

**À essayer sur le poste** : une vraie clé (OpenAI, Mistral) pour voir le point du modèle
au graphique et son coût dans Mon usage avec la mention du prix publié ; les identifiants que
chaque fournisseur rend vraiment (seuls ceux de la documentation ont été vus).

**Vu à l'écran le 28/09/2026**, après l'allègement à une douzaine de repères (passerelle jetable,
faux OpenAI servant `gpt-4.1-nano`, faux LM Studio servant `qwen3-8b`, Vite ; 1440 et 375 px,
clair et sombre, français et anglais) : « DeepSeek V4 Pro 0813 » était écrit à cheval sur les
points de Gemini 3.7 Flash et de Grok 4.6. Un nom ne se pose plus sur aucun point, et peut se
poser à droite ou à gauche du sien ; deux noms restent espacés de leur hauteur (Mistral Medium
3.5 et GPT-4.1 se touchaient d'un pixel). Contrôlé dans la page : aucun nom sur un autre, ni sur
un point, ni hors du cadre, les douze repères nommés. À 375 px, la phrase d'en-tête était tassée
dans une colonne de 200 px par le bouton du tableau : elle passe dessous, sur toute la largeur,
et le bouton n'y montre que son icône. Le graphique garde sa largeur minimale de 560 px et
défile à l'horizontale sur un téléphone.

### 3.16 Ce qui n'a pas été essayé se dit ici, plus à l'écran ni sur GitHub (28/09/2026)

**Décision de Medhi, 28/09/2026**, à propos de l'encadré des connecteurs natifs (« Pas encore
essayé avec un vrai compte Google Sheets : ce branchement a été vérifié contre de faux
serveurs, d'après la documentation du fournisseur. Dites-nous ce qui ne marche pas. ») :
« Ne précise pas, ça fait amateur qui ne teste pas. On le sait dans la doc du projet ici, mais
sur GitHub, dans la doc du logiciel et sur le logiciel : pas de truc comme ça. »

La règle, qui remplace la pratique suivie depuis la 0.22.0 :

- **Ce qui n'a pas été essayé se dit dans la documentation interne** : ce fichier (§ 5,
  « Ce qui reste à essayer sur les postes de Medhi »), SECURITE.md, ARCHITECTURE.md,
  SCREENS.md et les commentaires du code.
- **Plus à l'écran, ni dans ce que le public lit** : README (en, fr, zh, ja), notes de
  version, aide intégrée, parties de docs/GUIDE.md qui s'adressent à l'utilisateur.
- **L'écran ne promet toujours rien de faux** : on retire la mention, on n'écrit jamais
  « vérifié » ou « testé » à la place. Ce qui n'a pas été essayé n'est pas présenté comme
  éprouvé.
- **Un conseil utile reste**, sans le « pas encore essayé » : « s'il ne se charge pas, un
  autre modèle adapté à la machine prend le relais ».
- Les constats restent : « essayé : refusé » pour Google Agenda, les « réessayez », la version
  d'OpenClaw « éprouvée avec » l'application (elle l'a été).

Retiré ou reformulé le 28/09/2026 : l'encadré des connecteurs natifs ; « Pas encore essayé
avec {0} » à l'accueil (reste le conseil) ; la mise en garde de l'entraînement (« Ce réglage
n'a pas encore été essayé de bout en bout… sans garantie ») ; « Pas encore éprouvé(e) de bout
en bout » du Mac virtuel (reste « si elle ne démarre pas, le message dira où… ») ; le badge
« pas encore vérifié avec Helix » des modèles d'images et du sélecteur ; la dernière phrase
de la carte NVIDIA (« Ce chemin n'a pas encore été essayé sur une vraie machine ») ; dans les
README, la section « ce qui marche / pas encore essayé » et la note sur les captures et
l'animation simulées ; dans docs/GUIDE.md, les mentions de ce genre côté utilisateur (restent
les notes de fabrication, comme les fusibles d'Electron à relire) ; CONTRIBUTING.md suit la
nouvelle règle. Les notes des publications v2026.928.1 et v2026.928.2 ont été préparées sans
les lignes « Not yet tried » ni la relecture du japonais par un locuteur natif (à éditer sur
GitHub par Medhi) : ce qui reste à essayer est au § 5. Le
champ `verifie` des catalogues (modèles, images, entraînement) reste dans la passerelle (les
replis de l'installation s'en servent) ; il n'est plus affiché, sauf pour choisir de montrer le
conseil de l'accueil. `npm run securite` (§ 15 quinquies) vérifie qu'aucune phrase des
catalogues, en français comme dans ses traductions, ne dit plus « pas encore essayé ».

### 3.17 RTK dans Helix Code : après la barrière, jamais à sa place (28/09/2026)

**Demande de Medhi, 28/09/2026** : « Pour les modèles cloud, si possible, mettre RTK pour limiter
la consommation de jetons. » RTK (github.com/rtk-ai/rtk, Apache-2.0, 0.50.0 du 24/09/2026)
condense la sortie des commandes de développement (`git`, `ls`, `grep`, `find`, tests) avant
qu'elle parte au modèle. Détail et mesures au § 5 (« Fait le 28/09/2026 : RTK »), sécurité au
§ 50 de SECURITE.md.

Ce qui a été décidé, et pourquoi :

- **Pas le greffon que RTK propose pour OpenCode** (`rtk init --opencode`, crochet
  `tool.execute.before`). Il réécrit `git status` en `rtk git status` *avant* la demande
  d'autorisation (lu dans OpenCode 1.18.32) : la carte aurait montré l'enveloppe, et la
  barrière aurait jugé `rtk` au lieu de la commande. **RTK passe après la barrière** : le
  réglage `shell` d'OpenCode désigne une enveloppe écrite par Helix, qui reçoit la commande
  déjà approuvée et demande à `rtk rewrite` son équivalent. Carte, zones, niveau, journal :
  inchangés, ils ne voient que la commande d'origine.
- **Par session, décidé à chaque demande** : d'office avec un modèle cloud (origine « clé » ou
  « prestataire »), comme Medhi l'a demandé ; « toujours » au choix, pour les petits modèles
  locaux qui ont peu de place ; « jamais » possible. Le réglage est dans l'écran Code (puce
  « RTK »), retenu dans le profil de la personne.
- **Sans télémétrie, sans copie des sorties** : `RTK_TELEMETRY_DISABLED=1` et `RTK_RECALL=0` à
  chaque appel ; l'historique de RTK (d'où vient « N jetons économisés ») est une base par
  session dans les données de Helix.
- **Pas sous Windows, pas avec Codex** : sous Windows, OpenCode choisit son shell autrement et
  l'enveloppe est un script POSIX ; Codex ne passe pas par OpenCode, et l'intégration que RTK
  lui propose écrit dans `~/.codex` ou dans le projet (`.codex/hooks.json`) et réécrit avant
  l'approbation de Codex (documentation de RTK) : écartée.

### 3.18 Logos : les vrais, sans attendre l'accord des marques (28/09/2026)

**Décision de Medhi, 28/09/2026** : « Les logos, on s'en fout : mets les vrais. Si j'ai un souci,
ils viendront me voir. » Medhi assume le risque lié aux marques. Désormais, **chaque service et
chaque fournisseur de modèles affiché dans Helix porte son vrai logo, en couleur**, même quand
la charte de la société demande un accord préalable, une licence écrite, une taille minimale ou
un autre usage (ce que dit chaque charte reste écrit dans THIRD_PARTY_NOTICES.md § 4 bis, pour
savoir quoi régler si une société se manifeste). Ce qui ne change pas :

- **Aucune case « j'accepte les conditions » cochée à la place de Medhi.** Sans kit
  téléchargeable librement, la source est, dans l'ordre : le fichier servi par le site officiel
  (souvent l'icône du site), le dépôt officiel, puis une reproduction fidèle et non modifiée sur
  Wikimedia Commons ou Simple Icons. Adresse exacte et empreinte dans `scripts/marques/sources.json`.
- **Pas de retouche du dessin** : recadrage de la marge seulement, couleurs officielles, version
  pour fond sombre quand elle existe ; sinon une pastille claire derrière le logo en thème sombre
  (`pastille`), jamais une recoloration.
- **Sécurité inchangée** : le générateur ne garde que des éléments de dessin, aucune adresse
  externe, PNG intégrés en données ; `npm run securite` le vérifie, fichiers piégés compris.
- YouTube : l'icône en petit dans la liste (`youtubeIcone`), le logo complet en grand dans son
  panneau, comme avant.

Les logos appartiennent à leurs sociétés et ne servent qu'à désigner la compatibilité ; ne pas
revenir aux icônes neutres sans une demande d'une société ou de Medhi.

---

### 3.19 Mac Intel : llama.cpp, posé par Helix (28/09/2026)

**Demande de Medhi, 28/09/2026** : « un moteur automatique pour les Mac Intel, avec llama.cpp : go ».
Depuis le 27/09, un Mac Intel n'avait aucun moteur local (LM Studio ne publie plus pour eux, et le
chemin Homebrew sans empreinte avait été retiré). Aucune application Intel n'était d'ailleurs
publiée : `electron-builder` ne fabriquait que l'arm64.

**Décidé :**
- Sur Mac Intel, le moteur est **llama.cpp** (MIT) : `llama-server` en mode routeur, posé dans
  `<données>/llamacpp/` à une version épinglée (b11146 = v0.5.0), sur 127.0.0.1 avec une clé,
  sans réseau ni interface web. LM Studio y est coupé : un seul moteur local à la fois. Ailleurs,
  `HELIX_MOTEUR=llamacpp` le choisit (c'est ainsi qu'il a été essayé).
- **Modèles** : seulement les Qwen3 déjà essayés avec Helix (1.7B, 4B, 8B, 30B A3B), en GGUF publiés
  par Qwen lui-même, révision et empreinte figées ; le choix suit la même règle que sous LM Studio
  (le mieux noté qui tient sur la machine, puis les replis), à la taille réelle du fichier GGUF.
  Pas de Qwen3.5 (réponse illisible sous llama.cpp au processeur, 27/09). Pas de modèle d'écran.
- **Rien à accepter** à l'installation (licence MIT) : l'écran de mise en route n'a pas la case des
  conditions de LM Studio.
- **Publication** : une application Intel (`Helix-<version>-x64.dmg` et `-x64-mac.zip`), avec sa
  propre partie `macIntel` dans le manifeste de mise à jour ; un Mac ne lit que la sienne.

**Essayé** (le 28/09/2026, sur le Mac à puce Apple de Medhi, archive arm64 de la même publication) :
`scripts/essai-llamacpp.mjs`, 26/26 : installation par la route de l'administrateur, choix du modèle,
téléchargement coupé puis repris, empreinte, chargement, essai de santé, Chat en flux avec et sans
réflexion, appel d'outil, clé exigée, écoute locale, arrêt avec la passerelle.
**Pas essayé** : un vrai Mac Intel (Rosetta absente, le binaire Intel ne démarre pas ici),
l'application Intel empaquetée, les modèles 4B, 8B et 30B sous llama.cpp, la vitesse au processeur.
Détail de sécurité : SECURITE.md § 54.

### 3.20 Où vont le moteur et les modèles : au choix de l'administrateur (28/09/2026)

**Demande de Medhi, 28/09/2026** : « pour installer son modèle etc. il faudrait pouvoir choisir où
on l'installe avec LM Studio, car il y a des gens dont le disque principal n'a pas la place (ils ont
un disque D: par exemple) ». Un modèle pèse de 2 à 18 Go ; sur un PC au disque système plein,
l'installation échouait au milieu, sans rien proposer.

**Décidé :**
- **Écran de mise en route**, avant « Installer le moteur » : où iront le moteur et les modèles, la
  place libre sur ce disque, la place nécessaire (moteur s'il manque, modèle conseillé, 1 Go de
  marge), et « Changer ». Si la place manque, l'écran le dit et propose un autre disque. Dans
  l'application, « Changer » ouvre le sélecteur de dossier du système ; dans un navigateur, ou pour
  une instance distante (le sélecteur montrerait les disques du poste, pas ceux de l'instance), un
  champ où écrire le chemin. Même encadré sur l'écran « Bienvenue » (avant le modèle).
- **Réglages, Modèles locaux** (nouvelle entrée, avant « Modèles cloud ») : l'emplacement, la place
  libre, et le changement après coup.
- **Passerelle** (`gateway/src/emplacementModeles.ts`) : `GET /helix/emplacement-modeles` (une
  séance), `POST /helix/emplacement-modeles` et `…/verifier` (l'administrateur seul ; le choix au
  journal, `moteur.emplacement`). Le dossier est refusé s'il n'est pas absolu, s'il est sur un
  partage réseau (`\\serveur`, lecteur réseau sous Windows, montage non « local » sous macOS, type
  réseau sous Linux), dans le dossier personnel, dans l'espace des agents ou le contient, dans une
  zone protégée ou en contient, pas à ce compte, ou pas inscriptible (un fichier d'essai y est écrit
  puis effacé). Les données vont toujours dans un sous-dossier à elles (`LM Studio`,
  `modeles-llamacpp`), qui devient une zone protégée.
- **Hors du dossier personnel** : en « Tout mon poste », il devient l'espace des agents, et
  `dossierLmStudio` cesserait de suivre le pointeur (le moteur paraîtrait disparu). L'emplacement
  habituel y est déjà. Les autres disques entiers ouverts par « Tout mon poste » restent possibles.
- **LM Studio, seulement avant la première installation** (ni moteur, ni déclaration, ni modèle, ni
  téléchargement commencé, dans `~/.lmstudio`, le dossier suivi, `~/.cache/lm-studio`) : Helix écrit
  `~/.lmstudio-home-pointer` vers `<dossier choisi>/LM Studio`. D'après le code ouvert de LM Studio
  (`findLMStudioHome.ts`, lu le 28/09/2026), ce fichier désigne tout son dossier : moteur,
  téléchargements en cours, modèles. L'archive de llmster et son contenu vont aussi sur ce disque.
  Si llmster se pose quand même dans `~/.lmstudio`, ou si le dossier choisi a disparu (disque
  débranché), l'installation s'arrête avant de télécharger, avec la raison : pas de boucle de 600 Mo.
- **LM Studio déjà installé** : Helix ne déplace pas le dossier d'un LM Studio qui tourne (son moteur
  est un service, qui ne s'arrête pas avec Helix). L'écran donne la marche à suivre : quitter Helix
  et LM Studio, `lms daemon down`, déplacer le dossier, écrire son nouveau chemin dans le pointeur,
  rouvrir. Ou, pour les nouveaux modèles seulement, le réglage « My Models › Change » de
  l'application LM Studio, en disant que les téléchargements en cours passent encore par le disque
  principal (`.internal/temp-downloads`).
- **llama.cpp** : sans modèle, le choix est retenu tout de suite ; avec, Helix déplace les modèles
  (renommage sur le même disque ; sinon copie sous un nom provisoire, jusqu'au disque, taille
  comparée à l'original et au catalogue, puis seulement l'effacement des originaux). Rien n'est
  effacé si la copie échoue ; la destination doit être vide. Le moteur (11 Mo) reste dans les
  données. Le ménage du démarrage n'efface plus que ses propres `.partiel` et copies (avant, tout ce
  qui n'était pas au catalogue).
- Rattrapages : l'entraînement et le suivi de lecture de LM Studio lisaient `~/.lmstudio` en dur ;
  ils suivent maintenant le dossier que suit la passerelle, pointeur compris.

**Essayé** (le 28/09/2026, Mac à puce Apple, dossier personnel jetable, faux `lms`, jamais le vrai
LM Studio) : `scripts/essai-emplacement-modeles.mjs`, 49 contrôles réussis (et 5 de plus dans `npm run securite`) : les refus (collègue,
sans séance, espace des agents, dossier personnel, partages `\\` et `//`, chemin relatif, zone
protégée, lien symbolique vers l'espace), pointeur écrit puis suivi et protégé, pointeur jamais
écrit quand LM Studio est en place, moteur posé ailleurs dit sans téléchargement, disque débranché
dit ; llama.cpp : déplacement par renommage, copie vers un volume monté pour l'essai, volume trop
petit refusé, copie ratée sans perte, retour à l'emplacement habituel, ménage. L'écran vu dans le
navigateur (serveur de développement), en français et en anglais, à 1280 et 375 px de large :
choix refusé puis accepté, retour à l'emplacement habituel, marche à suivre de LM Studio installé,
disque trop petit, déplacement confirmé puis fait.
**Pas essayé** : Windows (chemins `D:\`, détection d'un lecteur réseau par PowerShell, écriture du
pointeur sous `%USERPROFILE%`), Linux ; le vrai llmster (qu'il suive le pointeur à l'amorce est lu
dans le code de LM Studio, pas vu) ; la marche à suivre de LM Studio installé (`lms daemon down`,
déplacement à la main) ; le sélecteur de dossier de l'application empaquetée ; un vrai modèle de
plusieurs Go déplacé. Détail de sécurité : SECURITE.md § 55.

### 3.21 Windows : le moteur de LM Studio cassé par la 2026.928.6, et le choix du modèle (28/09/2026)

**Vu chez plusieurs personnes sous Windows (captures de Medhi, 2026.928.6)** : « LM Studio daemon is
not running and no valid installation could be found », puis, après une première correction,
« Timed out waiting for LM Studio daemon to start » ; l'écran annonçait Qwen3.5 35B A3B pendant que
l'erreur parlait de Qwen3 1.7B. Jusqu'à la 2026.928.5, le moteur démarrait sous Windows.

**Causes :**
- **Installation coupée net (prouvée ici)** : `llmster bootstrap` était lancé par `execFile`, dont la
  sortie est bornée à 1 Mo ; au-delà, Node arrête le programme (`ERR_CHILD_PROCESS_STDIO_MAXBUFFER`,
  reproduit avec un faux installateur bavard). `lms.exe` était déjà copié, la déclaration
  (`llmster-install-location.json`, que `lms` exige : `findOrStartLlmster`, lmstudio-js) jamais écrite,
  et Helix, qui ne regardait que `lms.exe` sous Windows, passait au modèle.
- **Service qui ne démarre pas (probable, pas vu)** : depuis la 2026.928.6, la passerelle vit dans un
  `utilityProcess` d'Electron (fusible RunAsNode fermé), et le service de LM Studio qu'elle lance en
  hérite. Pas de PC Windows ici pour le confirmer.
- **Carte trompeuse** : chaque modèle échouait à son tour, jusqu'au plus léger, sous la carte figée
  du modèle conseillé.

**Corrigé (2026.928.7)** : `llmster bootstrap` lancé sans borne de sortie, installation reconnue
seulement si elle est déclarée (sinon un second essai, puis l'erreur et un diagnostic au journal) ;
sous Windows, `lms daemon up` et `lms server start` lancés par le processus principal de l'application
(`electron/moteurWindows.cjs`, seulement ces deux commandes, seulement `lms.exe` du dossier de LM
Studio), et attente jusqu'à trois minutes au premier démarrage ; la mise en route s'arrête à la
première panne du moteur, et la carte montre le modèle en cours ; la sortie de la passerelle est
gardée dans `passerelle.log` (dossier des journaux de l'application), pour voir ce qui se passe chez
quelqu'un.

**Choix du modèle (demandé par Medhi)** : « Choisir un autre modèle » à la mise en route, parmi les
seuls modèles qui tiennent sur la machine (`modelesQuiTiennent`), le conseillé coché. Et un modèle
à experts doit tenir dans la mémoire vive seule, même avec une carte NVIDIA : additionner la carte et
la mémoire faisait conseiller Qwen3.5 35B A3B sur un PC de 32 Go, gpt-oss 20B sur un PC de 16 Go.

**Pas essayé** : tout cela sur un vrai PC Windows. À vérifier sur le poste de Medhi ou d'une des
personnes touchées : installation du moteur de bout en bout, démarrage du service, `passerelle.log`.

### 3.22 Page « Modèles » : tout le catalogue libre, au choix, seulement ce qui tient (28/09/2026)

**Demande de Medhi, 28/09/2026** (capture du sous-menu « Installer un modèle », six modèles) :
« pas possible d'un menu genre nouvel onglet qui s'ouvre, ou juste plus de modèles, genre avoir
des Mistral 2B si pas proposé ; je veux laisser le choix comme avec LM Studio », et plus tôt :
« les gens doivent pouvoir choisir un modèle plus petit s'ils veulent, même si on recommande en
fonction du PC, mais il ne faut pas proposer des modèles trop puissants qui vont tout faire
crasher ».

**Décidé :**
- **Une page `/modeles`**, ouverte depuis « Installer un modèle » du sélecteur par « Voir tous
  les modèles » (le sous-menu garde sa courte liste). Recherche, tri (note, taille), filtres
  (éditeur, images, raisonnement, rapide sans carte graphique), une fiche par modèle. Seuls les
  modèles qui tiennent (`tientSur`) s'installent ; les autres sont visibles, grisés, avec la
  raison chiffrée (`pourquoiTropLourd`, mêmes calculs), et `POST /helix/provision/start` refuse
  un modèle nommé qui ne tient pas (409, `refusTropLourd` ; le conseillé passe toujours).
- **Quarante modèles de plus** (`FICHES_AU_CHOIX`, `provision.ts`), tous Apache 2.0 ou MIT,
  tous dans le catalogue de LM Studio (identifiant de `lms get`, taille et capacités relevés sur
  lmstudio.ai/models, licence sur la fiche Hugging Face du dépôt d'origine, cache à 32 768
  jetons calculé sur son `config.json`) : Qwen3 2507 (4B, 30B A3B, 235B A22B, Instruct et
  Thinking), Qwen3 Coder 30B, Qwen3 Next 80B, Qwen3.5 27B, Qwen3.6 27B et 35B A3B ; Ministral 3
  (3B et 8B Reasoning, 14B Instruct), Mistral 7B v0.3, Mistral NeMo, Mistral Small 3.2,
  Devstral Small 2507 et 2 ; Phi-4 mini, mini Reasoning, Reasoning, Reasoning Plus ; Granite
  4.0 (H Micro, Micro, H Tiny, H Small), Granite 4.1 3B et 30B ; DeepSeek R1 Distill Qwen 7B,
  14B, 32B et R1 0528 Qwen3 8B ; gpt-oss 120B ; OLMo 3 7B Instruct et 32B Think ; GLM-4.6V
  Flash ; ERNIE 4.5 21B A3B ; Seed-OSS 36B ; Rnj-1 8B. Et Qwen3-VL 32B pour l'écran.
- **Au choix seulement** (`auChoix`) : jamais installés d'office, conseillés, pris en repli ni
  mis dans la courte liste du sélecteur. Le conseil pour chaque machine est donc exactement
  celui d'avant (comparé sur 120 profils de machine, et contrôlé par `npm run securite` § 32).
  **À trancher par Medhi** : deux modèles à experts sont mieux notés que celui qu'ils
  remplaceraient pour la même mémoire, là où un modèle dense de 27B ne tient pas (PC avec une
  petite carte NVIDIA, ou sans carte) : Qwen3.6 35B A3B (143,92) face à Qwen3.5 35B A3B
  (142,52), Qwen3 30B A3B Thinking 2507 (139,63) face à Qwen3 30B A3B (136,18). Les faire
  entrer dans le conseil changerait ce que Helix installe sur ces machines, sans qu'ils aient
  été essayés. (Qwen3.6 27B, 146,47, reste derrière Qwen3.8 27B, 149,38, déjà conseillé.)
- **Écartés** : Phi-4 (16 384 jetons au plus, Helix charge à 32 768), Bonsai 27B (poids à 1 bit,
  noyaux encore dans les copies de l'éditeur), Laguna S 2.1 (licence OpenMDW), LFM2 (licence
  LFM), Nemotron 3 (NVIDIA), Codestral (non commerciale), Devstral 2 123B (licence « other »),
  les distillations Llama de DeepSeek R1, Gemma, Llama, GLM-5.3 Flash (seulement dans le cloud
  de LM Studio), Qwen3 0.6B et SmolLM3 (absents du catalogue de LM Studio), Qwen3 Coder 480B
  (250 Go). Pas de « Mistral 2B » : le plus petit Mistral est Ministral 3 3B (2 à 2,5 Go), déjà
  là.
- **Mac Intel** : la page ne montre que le catalogue GGUF épinglé du moteur ouvert (quatre Qwen3),
  inchangé : aucun GGUF ajouté, faute d'avoir épinglé révision et empreinte de chacun.

**Relevé en passant, puis corrigé le même jour** (le conseil change, et c'est voulu : Medhi ne veut pas de modèle qui sature la machine) : les
tailles de plusieurs fiches existantes sont plus petites que celles que LM Studio publie
aujourd'hui (Qwen3.5 9B : 6 Go au catalogue, 7 chez LM Studio ; Qwen3.5 4B : 3 et 3,75 ;
Ministral 3 8B : 5,5 et 6,5 ; OLMo 3 7B Think : 4,5 et 6, et son cache ignore les couches à
fenêtre glissante, 1,5 Gio de plus ; Magistral Small : 14 et 15,35 ; Qwen3-VL 2B : 2 et 3).
Sur une carte NVIDIA de 8 Go, Qwen3.5 9B à 7 Go ne passe plus `tientSur` : il n'y est plus conseillé. Les fiches portent désormais les tailles de LM Studio.

**Vu marcher** (28/09/2026, serveur de développement contre une passerelle jetable, faux `lms`,
faux serveur à la place de LM Studio, fr et en, 1280 et 375 px) : la page, les filtres, la
recherche, l'installation suivie jusqu'à « Installé », le lien depuis le sélecteur, la liste
élargie de la mise en route (installation de Mistral 7B v0.3 choisi), le mode llama.cpp ;
`scripts/essai-page-modeles.mjs` (15 vérifications). **Pas essayé** : aucun des modèles ajoutés
n'a été téléchargé ni chargé avec Helix (ni outils, ni raisonnement, ni essai de santé réels),
aucun vrai `lms get` de ces identifiants, la page dans l'application de bureau, en chinois et
en japonais à l'écran (seul le taux de traduction est relu).

**Essai Windows de bout en bout (28-29/09/2026)** : un flux GitHub Actions
(`.github/workflows/essai-windows.yml`, pilotage dans `scripts/essai-windows-ci.mjs`) construit
l'application Windows sur une machine `windows-latest` neuve (Windows Server, 4 processeurs, 16 Go,
sans carte graphique), lance **l'application empaquetée** `win-unpacked\Helix.exe` (passerelle dans
son `utilityProcess`, fusible RunAsNode fermé) avec des données jetables, et fait par la passerelle
le parcours de l'écran de mise en route : compte administrateur, moteur de LM Studio (conditions
acceptées pour cet usage interne d'essai, accord de Medhi), Qwen3 1.7B, une question au Chat en
« Auto » ; puis l'application quittée, le service de LM Studio arrêté (`lms daemon down`, comme un
redémarrage), l'application rouverte, la même question. Il part à chaque poussée sur `main` qui
touche `gateway/`, `electron/`, `src/` ou `package.json`. **Avant chaque publication, il doit être
vert** (docs/GUIDE.md). Ce qu'il a vu tenir dès la première exécution : `llmster bootstrap` pose et
déclare le moteur (`llmster-install-location.json`), `lms daemon up` et `lms server start` passent
par l'application (message `lancer-lms`), le modèle se télécharge, se charge, passe l'essai, répond
« La capitale de la France est Paris. ». Les deux pannes de la 2026.928.6 ne se sont pas montrées
avec la 2026.928.7. Ce qu'il a trouvé, et qui est corrigé :

- **Le premier `lms server start` refusé** juste après la levée du service (« Error: WebSocket
  connection closed », code 1, vu à la première exécution) : Helix abandonnait et la mise en route
  finissait sur « Le moteur est installé, mais il n'a pas démarré ». La première version de l'essai
  n'était passée que parce qu'elle relisait `/helix/provision` toutes les trois secondes, ce qui
  relançait le serveur (`discover`) ; l'essai suit désormais le flux, comme l'écran. Corrigé :
  quatre essais à cinq secondes d'écart (`ensureLmStudioServer`, backends.ts).
- **Plusieurs `server start` en même temps** à la réouverture (découverte du démarrage, sonde de
  l'application, écran : trois en deux secondes au journal), alors qu'un `server start` sur un
  serveur en marche le redémarre. Corrigé : un seul démarrage à la fois, les autres l'attendent.
- **La fenêtre ouverte au bout d'une minute le lendemain** : `/health` attendait la levée du service
  (70 s mesurées), l'application attend `/health` pour ouvrir sa fenêtre et abandonnait au bout de
  40 sondes (« la passerelle n'a pas démarré à temps »). Corrigé : `/health` lance le réveil sans
  l'attendre (`discover({ attendreLmStudio: false })`), et ne lance pas `lms` tant que le serveur ne
  répond pas (`lms ls` aurait levé le service lui-même, depuis la passerelle). Mesuré ensuite : 0,6 s.
- **Deux copies du modèle en mémoire après chaque mise en route**, et deux fois le modèle au
  sélecteur du Chat (`lms ps`) : llmster range `lms get qwen3-1.7b` sous « qwen/qwen3-1.7b » ; Helix
  chargeait par le nom du catalogue, puis posait la question d'essai sous ce nom, et le serveur, qui
  ne servait rien sous ce nom, chargeait une seconde copie à sa façon (8 192 jetons, quatre réponses
  en parallèle, une heure). Avec Qwen3 8B sur un PC de 16 Go, de quoi saturer la machine. Corrigé :
  chargé, essayé et déchargé sous le nom que LM Studio donne (`nomChezLmStudio`, provision.ts).
- **Le modèle qui suit le moteur** ne pouvait pas être choisi : « installer le moteur » enchaînait
  toujours sur le conseillé, et une demande de modèle faite pendant l'installation se greffait sur
  celle-ci. `POST /helix/provision/moteur` accepte `model`, pris seulement parmi ceux qui tiennent
  sur la machine (400 `modele_non_propose` sinon), vérifié avant l'accord au journal ; l'écran ne
  l'envoie pas encore (il installe le conseillé, comme avant).

Toujours **pas essayé** : un PC Windows de particulier (antivirus tiers, carte NVIDIA, compte non
administrateur, disque lent), l'installateur NSIS lui-même (l'essai lance le dossier
`win-unpacked`), l'écran (l'essai passe par l'API, comme lui), la vraie fermeture par l'icône de la
zone de notification (l'essai arrête l'arbre de processus), un modèle plus gros que Qwen3 1.7B.

## 4. Sécurité

Le détail est dans [SECURITE.md](SECURITE.md). Voici ce qu'il faut avoir en tête.

### Deux niveaux d'authentification

Le **jeton d'instance** dit qu'une machine a le droit de parler. La **séance** dit
qui. Les routes qui font agir l'instance exigent une séance : elles sont listées dans
le tableau `EXECUTION` de `gateway/src/index.ts`, barrière posée **avant** le routage
pour qu'une route ajoutée plus tard ne puisse pas l'oublier. Ce tableau compte
aujourd'hui **36 routes**, recopiées une à une dans [SECURITE.md](SECURITE.md) § 1.3,
plus des préfixes entiers (agents, clés de modèles, dossier de l'équipe, groupes,
bibliothèque, réunions). Une seule route de `/helix/*` est publique : le retour
d'autorisation OAuth, où c'est un navigateur qui arrive depuis le service et qui ne
peut porter ni jeton ni séance — protégée par le `state` et par PKCE, elle ne rend
qu'une page à lire.

### La barrière d'approbation

`gateway/src/approbation.ts`. Trois niveaux, gardés par l'instance :

| Niveau | Ce qu'il demande |
|---|---|
| « tout » | rien, l'agent agit sans demander |
| « modifications » | un accord avant chaque action qui change quelque chose. **Défaut à l'installation** |
| « chaque » | un accord avant chaque appel d'outil, lecture comprise |

Quatre points de conception à ne pas défaire :

1. La barrière est **dans la passerelle**, appelée depuis `chat.ts` avant l'aiguillage
   vers l'outil. Un client qui appelle `POST /v1/chat/completions` avec `tools: true`
   passe exactement au même endroit.
2. **Un outil inconnu est classé comme modifiant.** La liste des outils de lecture ne
   vaut que pour le serveur de fichiers, celui qui l'a inspirée. Depuis que l'instance
   accepte des connecteurs, un serveur tiers pourrait exposer un `read_file` ou un
   `search_files` : il ne doit pas hériter du laissez-passer.
3. Une réponse vaut pour les **actions de même nature dans le même dossier, jusqu'à la
   fin de la demande en cours**. Un plan découpé enchaîne vingt appels ; demander vingt
   fois, c'est obtenir vingt accords distraits puis le désarmement du réglage. Un refus
   se retient de la même façon. Rien ne survit à la requête HTTP.
4. **Délai d'expiration de 120 secondes, l'expiration valant refus.**

### Ce qui a été trouvé en auditant, et corrigé

Douze défauts, tous démontrés à l'exécution puis vérifiés fermés. Le détail est dans
[SECURITE.md](SECURITE.md) § 14.

| Défaut | Ce qu'il permettait |
|---|---|
| Serveur OpenCode sans authentification | Tout processus du poste pilotait l'agent de code |
| Casse ignorée dans les chemins interdits | `/system` accepté là où `/System` était refusé, et les dossiers parents (`/private`, `/Library`) laissaient descendre |
| Traversée de chemin sur `GET /helix/audit?jour=` | Lire n'importe quel fichier du disque |
| Corps de requête sans borne | 400 Mo faisaient passer la passerelle de 108 Mo à 1196 Mo |
| Amplification de processus sur `GET /helix/code` | 40 requêtes créaient 40 processus enfants |
| `PUT /helix/data/*` en 500 bavard | Le message d'exception interne partait au poste |
| Promesses rejetées non capturées | Une installation qui échouait arrêtait la passerelle |
| **Bouton « refuser » qui approuvait** | Le code lisait `accord !== false` : tout ce qui n'était pas exactement `false` valait accord |
| Deux flux d'évènements au jeton seul | `computer/events` livrait le texte que l'agent devait saisir, mot de passe compris ; `code/events` démarrait OpenCode |
| En-têtes de sécurité absents des cinq flux | Dont celui de la conversation, figé sur `Access-Control-Allow-Origin: *` |
| Origine ouverte à tous | Une page quelconque obtenait les en-têtes de partage |
| Jeton d'un connecteur en clair sur la sortie d'erreur | Un serveur MCP qui recopie sa configuration déposait son secret dans le journal |

Deux d'entre eux méritent une phrase.

**Le bouton « refuser ».** Il est devenu un principe : *un contrôle de sécurité qui ne
comprend pas ce qu'on lui demande refuse.* Les deux routes d'approbation exigent
désormais un booléen explicite et répondent 400 sinon. Mesuré avant correction : un
refus envoyé sous un autre nom de champ laissait l'agent écrire le fichier, et le
journal enregistrait une approbation.

**La passerelle n'était vérifiée par rien.** `tsconfig.json` ne couvrait que `src`.
Vingt fichiers de passerelle, dont l'authentification et le chiffrement, échappaient à
toute vérification de types. `tsconfig.gateway.json` les couvre maintenant, et
`npm run build` vérifie les deux projets.

### La passe de sécurité de 0.22.0

Demandée le 18/09/2026 : « je veux un tour complet sur la sécurité, les failles, et
je ne veux plus aucun souci ». Deux relectures complètes ont été menées en parallèle,
l'une sur la passerelle, l'autre sur Electron et l'interface, puis chaque trouvaille
a été vérifiée dans le code avant d'être corrigée. Le détail, trouvaille par
trouvaille, est dans [SECURITE.md](SECURITE.md) § 17. Les quatre qui comptaient le
plus :

| Défaut | Ce qu'il permettait | Correction |
|---|---|---|
| Demandes d'approbation ouvertes à tous | N'importe quel poste du parc lisait, en direct et sans séance, le **corps entier** de chaque mail qu'un agent préparait pour un collègue — et pouvait répondre « oui » à sa place | Une demande porte le compte qu'elle concerne ; elle n'est montrée qu'à lui, et lui seul y répond. Vérifié par un essai à deux comptes |
| Adresse d'instance complétée en `http://` | Une adresse saisie sans schéma envoyait le jeton d'instance et le jeton de séance **en clair** à chaque requête | HTTPS supposé par défaut, HTTP refusé pour une instance distante |
| Politique de sécurité du contenu inopérante | Posée par un en-tête, qui ne s'applique pas aux pages chargées depuis le disque : l'application livrée n'en avait aucune | Posée dans la page, à la construction. Le `connect-src` ne laisse plus passer ni HTTP distant ni `data:` |
| Agent autonome et mail reçu | Le garde-fou ne couvrait que l'envoi de mails ; un message piégé pouvait encore faire écrire, déplacer ou supprimer des fichiers sans que personne ne voie rien | Pendant le traitement d'un mail reçu, **tout ce qui modifie** repasse par une carte d'accord, quel que soit le réglage |

### Les dettes de cette passe, fermées le lendemain (0.23.0)

Le § 17.5 de [SECURITE.md](SECURITE.md) listait cinq points laissés ouverts. Le
client a demandé de s'en occuper tout de suite. Quatre sont fermés, le cinquième
était une contrepartie assumée et non une dette. Le détail, avec les mesures, est
au § 18 de [SECURITE.md](SECURITE.md).

| Dette | Ce qui a été fait |
|---|---|
| Politique de contenu ouverte à tout HTTPS | L'interface a une vraie origine, `helix://app`, servie par l'application : la politique est posée par la réponse, donc **calculée**, et nomme l'instance configurée |
| Jetons dans l'adresse des flux d'évènements | Un **billet** à usage unique, valable une minute, remplace les deux jetons ; l'interface rouvre elle-même les flux |
| Jetons en clair dans le stockage du poste | Trousseau du système (`safeStorage`), fichier chiffré en 0600 ; le repli hors application de bureau est annoncé |
| Personne ne voyait l'ensemble du journal | Un rôle d'administrateur, désigné par le profil de déploiement ou, à défaut, le premier compte créé. Il n'ouvre **aucune donnée personnelle** |
| Fenêtre du bot sans isolation de contexte | L'isolation reste coupée (l'API qui permettrait les deux est arrivée dans Electron 35, nous sommes en 33), mais l'attaque est fermée : les fonctions du navigateur sont capturées avant tout script de la page |

**Le changement d'origine ne coûte rien à personne.** Une origine, c'est un
stockage, et le nouveau est vide. Une reprise unique de l'ancien, dans une fenêtre
cachée, garde l'identité connectée, les jetons (rangés au passage dans le coffre) et
les préférences. Mesuré de bout en bout : après mise à jour, l'application s'ouvre
sur l'interface connectée, thème compris.

**Il a quand même cassé deux choses, et c'est l'essai sur la vraie application qui
les a montrées** (SECURITE.md § 18.1) : la passerelle ne reconnaissait pas la
nouvelle origine et refusait toutes ses réponses ; et le passage au routeur
d'historique effaçait, à chaque navigation, le jeton que l'application remet à son
interface dans l'adresse — donc déconnexion au premier clic sur « Réglages ». Les
deux sont corrigés et vérifiés. À retenir : un banc d'essai qui recrée le cas
nominal ne remplace pas un lancement de l'application livrée, sur de vraies
données.

### Ce qui a été ajouté le 25/09/2026

Détail dans [SECURITE.md](SECURITE.md) § 22. `npm run securite` compte désormais
**206 contrôles, tous réussis le 26/09/2026** (77 le 24/09 ; dont 5 pour le flux de
Helix Code fabriqué par la passerelle, § 3.11, 15 pour les employés et les bases de
connaissances, § 3.10, 7 pour l'export RGPD et l'effacement, et, l'après-midi du 25, 14 pour
les employés et les bases partagées à un groupe, plus une route sans séance ; le soir, 34
pour les agents de groupes, le privé du propriétaire, la mémoire vidée avant
élargissement, la clé par employé, les index effacés avec le compte et l'export filtré,
§ 3.10 et SECURITE § 22.2). Puis 26 pour les deux défauts de la revue du 25/09
(dossier de l'équipe, import local ; SECURITE.md § 22.6) : **232 contrôles, tous
réussis le 26/09/2026**.

| Surface | Règle |
|---|---|
| Images d'un Chat partagé | Visibles de leur auteur et de qui voit le Chat **où elles ont été créées** (`voitConversation`) ; tout autre demandeur reçoit 404, que l'image existe ou non. Un identifiant recopié dans un autre Chat n'ouvre rien. Réponse `no-store` pour un collègue, pour qu'un partage retiré cesse aussitôt |
| Bases de connaissances | Droits hérités de Fichiers : une base a la visibilité des objets de la Bibliothèque, seul son propriétaire la modifie, et à chaque question seuls comptent les documents que la personne voit. Index chiffrés, 0600. Préfixe `/helix/connaissances` entier sous séance |
| Employés et bases | Ce qui est ouvert à toute l'équipe ; en plus, les bases et documents partagés aux groupes du propriétaire **seulement** si tout ce qui sort de l'employé ne va qu'à lui (personnel, sans messagerie, sans mission à chaque mail, encadré, sans outil qui écrit). Jamais un document privé. Relu à chaque appel |
| Entraînement | Préfixe `/helix/entrainement` entier sous séance ; projet rendu à son seul auteur, identifiant de 24 caractères hexadécimaux tiré au sort ; projet chiffré au repos, jamais réécrit s'il est illisible ; aucun exemple en argument de commande |
| Outils de Code | `/helix/code/outils` réservée à l'agent de code de l'instance : jeton **et** clé tirée à chaque démarrage (`X-Helix-Cle`), comparée en temps constant ; chaque appel passe par la barrière et le journal |
| Ligne de commande | Jeton du poste lu **seulement pour une adresse locale** ; http vers une autre machine refusé avant tout envoi ; mot de passe tapé sans écho et jamais écrit ; séance rangée par adresse d'instance |
| Dossier de l'équipe (revue du 25/09) | Avec « Tout mon poste », `GET /helix/espace/fichier?chemin=.helix/data/…` rendait le jeton d'instance et la mémoire des employés à toute personne connectée, et l'agent de Cowork lisait `~/.ssh`, `~/.claude`. Désormais : segments en point refusés, **zones protégées** (`zonesProtegees.ts` : données de l'instance, `~/.helix`, clés, `.config`, historiques des autres assistants, trousseaux) refusées sur leur chemin réel, dans l'espace, le serveur de fichiers MCP, la bureautique et le contrôle web ; la fenêtre « Tout mon poste » le dit |
| Import depuis les logiciels (revue du 25/09) | La boucle locale ne suffisait pas sur une instance partagée (un outil du serveur appelait `127.0.0.1` avec `?token=`). Désormais : 403 si l'instance est partagée, jetons en en-têtes seulement, compte administrateur exigé |

### Principes à tenir

- **Échec fermé.** Un contrôle de sécurité qui ne comprend pas ce qu'on lui demande
  refuse. Il n'accepte jamais par défaut.
- **La barrière est dans la passerelle**, jamais dans l'interface. Un contrôle posé
  dans le navigateur se contourne en appelant la route directement.
- **Le journal ne consigne jamais de contenu**, seulement des chemins.
- **Le périmètre borne le choix de la personne** ; une fois le dossier fixé, c'est le
  serveur de fichiers qui y tient l'agent.
- **La commande d'un connecteur vient de Helix, jamais de la requête.** Un serveur MCP
  est un programme exécuté sur la machine de l'entreprise. Laisser l'interface choisir
  cette commande reviendrait à offrir l'exécution de code à distance à quiconque
  atteint la passerelle. Le catalogue est figé dans `gateway/src/connecteurs.ts` ; la
  requête n'apporte que des secrets. Une commande libre n'existe que si le profil de
  déploiement l'autorise (`connecteursLibres`), et c'est refusé par défaut.

### Ce qui reste ouvert

- **Plus aucun compte sans mot de passe, depuis 0.9.0**, pas même le premier : sur
  une instance partagée, le jeton devenait une identité. Reste une fenêtre étroite,
  pesée et assumée : un compte créé *avant* 0.9.0 choisit son premier mot de passe à
  la connexion suivante, au jeton seul, une seule fois (SECURITE.md § 2).
- La **double authentification** est facultative par défaut ; l'intégrateur l'impose
  à toute une instance par `deuxFacteursObligatoire` (SECURITE.md § 2.1).
- Après une **suppression de compte**, le journal d'audit est conservé (identifiant,
  adresse notée à la création) le temps de sa durée de conservation : 90 jours par
  défaut, de 30 à 3650 par `journalConservationJours` du profil, affichée dans
  Sécurité ; au-delà, les journées sont effacées de l'instance (la copie
  `journalCopie`, elle, n'est jamais purgée) (SECURITE.md § 4 et § 7.2).
- **LM Studio** interdit de servir une instance à d'autres organisations (§ 3.9).
- **Trousseau sur macOS** : tant que l'application n'est pas signée par Apple, macOS redemande
  l'accès une fois à chaque nouvelle version (27/09/2026).
- **Windows** : l'installateur n'est pas signé ; Smart App Control, quand il est actif, le
  bloque sans proposer de le lancer quand même.
- **Le bot de réunion** entre dans une réunion Google Meet comme invité : un
  participant doit l'admettre, et c'est à la personne qui l'envoie de prévenir les
  autres (l'écran le dit). Sa fenêtre charge Google Meet sans isolation de contexte
  (c'est ce qui lui laisse voir le son) : elle ne charge rien d'autre que
  meet.google.com et accounts.google.com, n'a ni micro, ni caméra, ni aucun accès au
  système, et son seul canal transporte du son vers la réunion qu'elle enregistre
  (SECURITE.md § 16).
- L'application est signée **ad hoc**, sans identité Apple. Voir
  [SIGNATURE.md](SIGNATURE.md).
- **La clé de chiffrement passe en argument** à `security add-generic-password`. La
  question a été instruite plutôt que laissée ouverte, et l'analyse est écrite dans
  `gateway/src/secret.ts` : `-w` sans valeur attend une invite interactive, que la
  passerelle n'a pas ; le mot de passe poussé sur l'entrée standard n'est pas lu, et
  l'entrée est créée vide (mesuré) ; un terminal simulé par `script` échoue en code 2
  (mesuré) ; un vrai pseudo-terminal demanderait une dépendance native, que la
  passerelle s'interdit. Ce qui reste exposé : la clé apparaît dans les arguments du
  processus le temps de l'appel. Sur macOS, seuls les processus du même compte les
  voient, et un tel processus peut de toute façon lire la clé par
  `security find-generic-password`. Le gain d'un attaquant est donc nul, à une réserve
  près : un journal système qui enregistrerait les exécutions garderait cette ligne.
- Le journal nomme désormais qui a demandé et qui a approuvé chaque action d'écran et
  chaque outil ; il ne dit pas encore ce que l'agent voyait (pas de journal rejouable).
- **Employés OpenClaw** : OpenClaw n'est pas une frontière de sécurité entre personnes
  qui ne se font pas confiance (c'est écrit dans sa documentation). Helix en tient
  compte : chaque conversation a sa clé, les échanges sont gardés et effacés par
  Helix, la fiche de poste interdit de répéter à l'un ce que l'autre a dit (vérifié :
  un code confié par une personne n'a pas été rendu à une autre). Mais la mémoire de
  travail d'un employé (ses notes) est commune à tous ceux qui lui parlent, et
  l'écran le dit. Ses propres outils de fichiers ne sortent pas de son espace
  (`tools.fs.workspaceOnly`) ; tout ce qui touche l'entreprise passe par Helix.
- **Bases de connaissances** (25/09/2026) : un document piégé (« ignore tes
  instructions ») arrive dans le prompt avec ses passages. La consigne le désigne comme
  une donnée, rien de plus n'est garanti ; en Cowork, c'est la barrière d'approbation
  qui protège. Les extraits cités sont gardés avec le Chat : qui voit un Chat partagé
  les voit, comme il voit déjà la réponse. Un modèle `embed` distant imposé par le
  profil ferait partir le texte des documents chez ce fournisseur (l'écran de la base
  affiche le modèle qui a indexé chaque document).
- **Modèle entraîné** (25/09/2026) : une fois installé, il est visible de toute
  l'instance dans le sélecteur, et ce qu'il a appris peut ressortir dans les Chats des
  collègues ; LM Studio ne cloisonne pas par personne. L'écran le dit avant
  l'installation.
- **Séance de la ligne de commande** en clair sur le disque, protégée par les
  permissions du compte (§ 3.11).
- **Codex** (27/09/2026, § 3.14) : ce qu'il fait ne passe pas par la barrière
  d'approbation de Helix ; seul son bac à sable le borne, et Helix ne borne pas ce qu'il
  lit sur le poste. D'où la réserve au propriétaire du poste, et l'écran le dit.
- **RunAsNode fermé le 28/09/2026** (les fusibles NODE_OPTIONS et `--inspect` le sont
  depuis le 27/09/2026) : `ELECTRON_RUN_AS_NODE=1` ne fait plus du binaire de Helix un Node
  que n'importe quel programme du compte lancerait avec les autorisations de Helix. La
  passerelle tourne dans un `utilityProcess`, la commande `helix` avec un vrai Node
  (SECURITE.md § 51 ; entrée du 28/09/2026 au § 5). Restent : un plantage de l'application
  arrête la passerelle sans qu'elle arrête ce qu'elle a lancé (§ 51.2).

---

## 5. Où en est le produit

### Fonctionne, et a été vérifié dans le code

**Le moteur.** Passerelle modèles avec routage par rôle, streaming, découverte des
backends, provisionnement automatique de LM Studio et du modèle adapté à la machine.
Découpage des tâches lourdes selon la taille du modèle (§ 3.6).

**Les quatre surfaces.** Chat, Cowork, Code, Tâches. Projets et Agents avec partage.
La délégation d'une tâche à un agent fait avancer la carte du Kanban toute seule.
**Les cartes s'enchaînent (0.19.0)** : une carte peut attendre une ou plusieurs autres
(champ « Après »), partir d'elle-même dès qu'elles sont terminées (ou rester à lancer
à la main), et son agent reçoit leurs comptes rendus pour s'appuyer dessus. Une étape
faite par une personne (passée en « Terminée ») lance aussi la suite ; une étape
annulée bloque la sienne, et la carte le dit ; une boucle est refusée au moment du
choix. Les cartes lancées d'elles-mêmes passent une à une (un modèle local ne sert
qu'une carte à la fois correctement). Les exécutions sont tenues par l'application et
non plus par l'écran Tâches (`src/lib/executions.ts`) : une chaîne continue pendant
qu'on travaille ailleurs. **Limite :** elles tournent dans la fenêtre de
l'application ; la fermer les interrompt (les agents OpenClaw, eux, travaillent
fenêtre fermée).

**Ce qui agit.** Boucle d'outils MCP bornée à un espace de travail. Contrôle de
l'écran sous approbation. Atelier bureautique isolé, cinq outils `bureau__…` pour
Word, Excel avec formules, PowerPoint et PDF.

**Les employés** (§ 3.4). Agents OpenClaw déployés depuis la page Agents : un poste,
des outils Helix, des missions planifiées, une conversation par personne, un onglet
Activité avec les comptes rendus. Vérifié de bout en bout sur OpenClaw 2026.9.4 :
déploiement, conversation (continuité dans la session, cloisonnement entre deux
personnes), mission lancée, demande d'accord qui nomme l'employé, écriture après
accord, compte rendu honnête quand personne ne répond, deux employés sans
interruption l'un de l'autre, suppression, effacement d'un compte (ses employés et ses
conversations disparaissent aussi chez OpenClaw), reprise d'un OpenClaw orphelin
après un arrêt brutal, passerelle empaquetée.

**Groupes, Bibliothèque, Réunions (0.16.0).** Les trois écrans en maquette sont
devenus réels, tenus par l'instance :

- **Groupes** (`gateway/src/groupes.ts`) : annuaire de l'équipe ; chacun crée un
  groupe dont il est responsable ; seuls les responsables le changent ; il en reste
  toujours un. On partage à un groupe une conversation, un dossier ou un document,
  une réunion.
- **Bibliothèque** (`gateway/src/bibliotheque.ts`) : dossiers et documents (1 Go, envoyés en flux),
  chacun avec sa visibilité (vous seul, des groupes, toute l'équipe) ; contenu
  **chiffré sur le disque** et lié à son identifiant ; texte extrait sur le poste,
  pour une recherche dans le contenu et pour les agents (`bibliotheque__chercher`,
  `bibliotheque__lire` : le Chat voit ce que voit la personne, un agent toujours actif
  seulement ce qui est ouvert à toute l'équipe). Qui voit un dossier peut y déposer
  ses documents ; on ne supprime pas un dossier qui contient ceux d'un collègue.
- **Réunions** (`gateway/src/reunions.ts`) : enregistrement au micro (morceaux de
  dix secondes, chiffrés un à un), import d'un fichier audio ou vidéo (2 Go), ou
  **bot maison** qui rejoint une réunion Google Meet (`electron/botReunion.cjs`,
  gratuit, sans service tiers : une fenêtre cachée de l'application capte le son des
  participants). Transcription par Whisper sur la machine, amorcée par le titre et
  les noms de l'équipe ; compte rendu (résumé, décisions, actions à verser dans
  Tâches) par un modèle de la machine, à défaut celui du prestataire, jamais une clé
  personnelle, et l'écran dit lequel. L'audio est effacé après la transcription,
  sauf réglage. Le bot peut rejoindre seul les réunions Google Meet de l'agenda.
  Vérifié : 29 s de réunion importée, transcrite et résumée en 18 à 36 s ; le vrai code
  du bot face à une réunion simulée (mêmes libellés que Google Meet, vraie connexion
  WebRTC) : sans micro, nom, demande, attente, admission, enregistrement, fin
  détectée, son transcrit. **Pas encore éprouvé dans une vraie réunion Google Meet** :
  le parcours est lu dans la page par ses libellés, français et anglais, et Google
  peut les changer.
- **Bot Recorder** (Paramètres) : nom du bot, compte Google facultatif pour les
  réunions qui refusent les invités, envoi automatique, langue, compte rendu
  automatique, conservation de l'audio.

**Les pièces jointes.** Le « + » et le glisser-déposer (sur toute la fenêtre)
acceptent PDF, Word, Excel, PowerPoint et OpenDocument : le texte est extrait sur le
poste (pdf.js, Apache-2.0 ; lecteur ZIP écrit à la main pour les formats Office), un
PDF scanné ou protégé est signalé plutôt que lu à vide (`src/lib/documents.ts`).
Ce qui borne une pièce jointe n'est pas le poids du fichier mais ce que le modèle peut
lire d'un coup : environ 200 000 caractères par fichier, puis, depuis le 27/09/2026,
l'instance mesure la place du modèle chargé et lit en parties annoncées ce qui ne tient
pas (`gateway/src/documentsJoints.ts`, voir plus bas). Depuis la 0.18.0, un fichier texte se joint
quelle que soit sa taille (seul son début est lu, et la puce le dit : « (début) ») ;
une photo ou une capture jusqu'à 50 Mo est réduite à 2048 pixels de côté au lieu
d'être refusée (la limite était de 2 Mo) ; un PDF ou un document Office jusqu'à
100 Mo (au-delà, sa lecture dans la page prendrait des minutes). Pour un long
document, la Bibliothèque est le bon endroit : l'assistant y cherche, puis lit par
passages de 15 000 caractères autant qu'il faut (`bibliotheque__lire`, paramètre
`depuis`) ; les transcriptions de réunion se lisent de même.
Les réponses des modèles sont mises en forme (gras, listes, titres, code) sans
jamais interpréter de HTML (`src/components/ui/TexteRiche.tsx`).

**Ce qui est branché sur le monde du client**, en lecture seule et par protocole
ouvert :

| Connecteur | Protocole | Outils | Fichier |
|---|---|---|---|
| Courrier | IMAP, SMTP pour l'envoi | `courrier__derniers`, `courrier__chercher`, `courrier__lire`, `courrier__brouillon`, `courrier__envoyer` (si l'envoi est activé ; accord à chaque mail, sauf option « Envoyer sans me demander ») | `gateway/src/courrier.ts`, `gateway/src/smtp.ts` |
| Agenda | CalDAV | `agenda__prochains`, `agenda__jour`, `agenda__chercher` | `gateway/src/agenda.ts` |
| Google Drive | API Google, OAuth de l'entreprise | `drive__chercher`, `drive__recents`, `drive__dossier`, `drive__lire` | `gateway/src/drive.ts` |
| Slack | API Slack, bot de l'entreprise | `slack__salons`, `slack__messages`, `slack__fil`, `slack__chercher` | `gateway/src/slack.ts` |
| Serveurs MCP du catalogue | MCP | ceux du serveur branché | `gateway/src/connecteurs.ts` |

Les deux clients sont écrits sans dépendance, sur la seule bibliothèque standard de
Node : une bibliothèque tierce qui lit tout le courrier de l'entreprise est un arbre
de dépendances que personne dans l'équipe n'a relu. Le courrier a deux écritures, le
dépôt d'un brouillon et, s'il est activé, l'envoi, chaque mail accepté un par un
(§ 3.5) ; l'agenda n'en a aucune. Le courrier ouvre les boîtes par
`EXAMINE` et non par `SELECT` : même le drapeau « lu » reste intact.

Deux propriétés à répéter au client, parce qu'elles sont structurelles et non
déclaratives :

- côté courrier, tout critère venu du modèle part en **littéral IMAP**, précédé de sa
  taille en octets. Le serveur lit ensuite exactement ce nombre d'octets, sans jamais
  y chercher une fin de commande. L'injection de commande est donc impossible par
  construction, pas par filtrage ;
- côté agenda, le seul texte libre qui atteint le fil traverse `echapperXml`, et le
  connecteur ne rapatrie jamais un agenda entier : chaque lecture est un `REPORT`
  filtré sur la période demandée.

**Ce qui protège.** Chiffrement au repos du magasin fichiers **et de PostgreSQL**,
chaque coffre lié à sa collection ; journal d'audit scellé et chaîné ; séances
révocables ; mot de passe obligatoire pour tout compte ; double authentification
TOTP avec codes de secours ; cloisonnement appliqué par l'instance ; barrière
d'approbation à trois niveaux (§ 4). Export RGPD des données de chacun
(SECURITE.md § 7.1).

**L'interface.** Thème sombre complet, quatre modes, bascule au coucher du soleil
calculé sur le poste sans réseau (`src/lib/soleil.ts`). Écran Connecteurs unique, en
grille de tuiles portant les logos des services.

**L'outillage.** `tsconfig.gateway.json` couvre les 49 fichiers de la passerelle, et
`npm run build` vérifie les deux projets. L'outil de récupération redéfinit le mot de
passe d'un compte, ou retire sa double authentification, depuis le poste, sans écho :
il n'existe pas de « mot de passe oublié » par courriel, l'instance ne sait pas envoyer
de courrier. Il est **embarqué dans l'application** (`dist-gateway/motdepasse.cjs`) ;
depuis le 28/09/2026 il se lance avec Node 20 ou plus (`node …/motdepasse.cjs`, docs/GUIDE.md),
et non plus avec le binaire de l'application, le fusible RunAsNode étant fermé ; depuis les
sources, `npm run motdepasse`.

### Ce qui est encore annoncé sans fonctionner, et le dit

Plus aucun écran en maquette depuis 0.16.0. Les notifications et l'aide ont cessé
d'être grisées en 0.22.0, « Créer une compétence » a été faite en 0.24.0, et le
téléchargement direct de l'application de bureau fonctionne depuis 0.27.0 (l'instance
sert son application macOS). Les clés d'API développeur fonctionnent depuis le
26/09/2026 (§ 3.13). Reste, et l'écran le dit : pas d'application mobile, et l'Abonnement
sans paiement branché.

### Affichages faux : ce qui a été réglé

Un logiciel qui ment est pire qu'un logiciel incomplet (§ 6). Tout ce qui
affichait un état inventé a été retiré ou rendu réel : la coche « email
vérifié », le badge « À jour », l'écran Intégrations qui affichait Google comme
« Connecté », l'aperçu de date écrit en dur, et en dernier l'écran **Mon usage**,
le plus trompeur, parce qu'il avait l'air d'un tableau de bord.

**Mon usage est désormais mesuré** (`gateway/src/usage.ts`). Les jetons sont lus
dans la réponse de chaque moteur, pour toutes les requêtes : conversation, plan
et chaque étape d'une tâche découpée, agent de code. Vérifié : chiffres
identiques à ceux du moteur interrogé directement, et une tâche découpée compte
bien un appel pour le plan et un pour chaque tour d'étape. Un modèle local coûte
0 € de frais d'API ; un modèle distant a un tarif à renseigner, et tant qu'il ne
l'est pas, l'écran dit « tarif non renseigné » plutôt qu'un chiffre faux. Depuis
le 27/09/2026, un modèle distant sans tarif saisi prend le prix publié par son
fournisseur, cité avec sa date et son lien, et son coût est dit estimé (§ 3.15).
Chacun ne voit que sa consommation.

**Profil, Préférences, suggestions et dictée**, livrés en même temps :

- le nom et l'adresse s'enregistrent ; changer d'adresse ne permet pas
  d'hériter des invitations d'une collègue (SECURITE.md § 1.6) ;
- les formats de date s'appliquent partout, et le faux choix « English » a
  disparu ;
- les suggestions de l'accueil mènent toutes quelque part de réel, et
  s'adaptent à ce qui est branché ;
- la dictée transcrit sur la machine, avec Whisper, sans connexion réseau
  (SECURITE.md § 1.7).

**Sécurité, confidentialité et classement**, livrés en 0.9.0 :

- mot de passe obligatoire partout (10 caractères), premier mot de passe pour les
  comptes anciens ;
- double authentification TOTP : QR code calculé sur le poste, dix codes de
  secours à usage unique, retrait par l'outil de récupération ;
- PostgreSQL chiffré, migration de l'existant au démarrage ;
- export RGPD : un fichier JSON de tout ce qui concerne la personne, et ce qu'il ne
  contient pas ;
- un chat se range dans un projet (classement personnel, qui n'ouvre la conversation
  à personne) ; les tâches ont une échéance et un projet, des vues Boîte de
  réception, Aujourd'hui, À venir et par projet, un filtre et un tri.

Ce qui restait affiché sans fonctionner a été rendu réel depuis (la photo de profil en
0.16.0) ; la liste de ce qui reste est plus haut.

### À faire, dans cet ordre

Fait en 0.9.0 : premier compte sans mot de passe, double authentification,
chiffrement de PostgreSQL, export des données, rattachement d'un chat à un projet,
filtres et tri des tâches.

Fait en 0.10.0 : suppression de compte, double authentification imposable, auteur
des actions d'écran et des approbations au journal, pilote PostgreSQL livré avec
l'application, mise à jour de l'application (automatique une fois signée),
préparation complète de la signature, licences vérifiées (§ 3.9), acceptation des
conditions de LM Studio, connecteurs Google Drive et Slack, activation du contrôle
de l'écran depuis l'interface (poste autonome), nom de la marque dans tous les
messages de la passerelle.

Fait en 0.24.0 : **toutes les façons de rejoindre, et une seule chose à
transmettre**. L'ouverture de la 0.23.0 rendait l'instance joignable ; restait ce
que l'utilisateur devait faire lui-même. Trois changements (ADR-042) :

- le mail d'invitation porte un **lien**. Un clic ouvre l'écran de rattachement,
  adresse et code déjà remplis. Sans lien cliquable, le champ d'adresse accepte
  qu'on lui colle le lien entier, et le mail garde les deux lignes à saisir à la
  main ;
- le lien **ne rattache pas tout seul**. Le système ouvre un `helix://` d'où qu'il
  vienne, y compris d'une page web : l'écran affiche donc l'adresse en toutes
  lettres et attend un clic, sans quoi n'importe quel site pourrait pointer un
  poste vers l'instance de son choix (SECURITE.md § 19) ;
- les chemins sont **nommés**. Les adresses de la machine sont classées entre
  « même réseau » (même Wi-Fi, même câble) et « réseau privé » — un tunnel VPN,
  Tailscale ou WireGuard, reconnu à son interface ou à la plage 100.64.0.0/10. Le
  produit **détecte** le tunnel que vous avez monté et s'en sert ; il n'en installe
  pas, parce qu'un tunnel clés en main suppose un service de rendez-vous entre les
  machines, donc un tiers au milieu. Et il déconseille l'ouverture d'un port sur la
  box, qui exposerait le poste à tout Internet.

Corrigé au passage : l'invitation émise depuis la machine hôte portait le nom
d'hôte brut (« Mini-de-Clabaut »), qui ne résout nulle part ; elle porte désormais
la première adresse annoncée.

Fait en 0.24.0 : **la licence, AGPL-3.0** (§ 3.9), fichier [LICENSE](LICENSE) et
[COPYRIGHT.md](COPYRIGHT.md). Le produit peut enfin dire « open source » sans que
ce soit faux, et l'écran « À propos » porte la licence et l'adresse du code
source, comme la licence l'exige de qui distribue le logiciel.

Fait en 0.24.0 : **les compétences fonctionnent** (ADR-043). Le bouton « Créer une
compétence » existait depuis le début, grisé, avec « Bientôt disponible » en
infobulle. Une compétence est une **procédure écrite en français** — comment on
rédige un compte rendu ici, quelles mentions porte un devis, dans quel ordre on
facture — que le modèle applique quand la situation s'y prête. Trois champs : un
nom, quand s'en servir, la procédure. Elles valent dans Cowork, dans le Chat et
pour les tâches exécutées par un agent, se partagent à l'organisation comme un
agent, et l'écran affiche combien de caractères partent réellement au modèle.

**Trouvé en testant, et pas en lisant** : une compétence créée à l'écran
disparaissait au rechargement. `storage.ts` tenait à la main la liste des clés
locales à pousser vers l'instance, et « competences » n'y était pas : rien
n'était poussé, et la lecture suivante rendait le tableau vide de l'instance,
qui écrasait le travail local. C'est la même famille que la perte de données de
la 0.23.0, par l'autre bout. La liste écrite à la main est supprimée : la
correspondance se déduit désormais de `COLLECTIONS`, pour que la prochaine
collection ajoutée ne puisse plus tomber dans le même trou.

Fait en 0.25.0, demandé par le client : **le logiciel parle trois langues**
(ADR-045). Français, anglais, chinois, au choix de chacun dans Réglages,
Préférences. 1 842 phrases, traduites à 100 % dans les deux langues, mesuré par
`npm run i18n`.

**La méthode, parce qu'elle explique le résultat.** La clé de traduction est la
phrase française elle-même : `t("Nouveau Chat")`, pas `t("nav.newChat")`. Le
code reste lisible, et une phrase sans traduction s'affiche en français au lieu
d'un identifiant. Les phrases à trous passent par `tf("Écrire à {0}…", nom)`,
ce qui permet au chinois de replacer la valeur ailleurs dans la phrase.

L'enveloppement des 1 842 phrases a été fait **par transformation du code avec
le compilateur TypeScript**, en quatre passes, chacune née d'un défaut constaté
dans l'application. Le compilateur a servi de garde-fou : une chaîne qui
servait d'identifiant plutôt que de texte fait échouer la compilation, ce qui
est exactement ce qu'on veut.

**La vérification est ce qui a coûté le plus, et c'est normal.** Vingt-deux
écrans parcourus en anglais, puis en chinois, avec un relevé automatique de ce
qui restait. Le premier relevé cherchait les phrases connues du catalogue mais
affichées en français : il a rendu une liste vide, et cette liste vide était
fausse. Une phrase jamais enveloppée n'est pas dans le catalogue, donc ne peut
pas y être cherchée. Le second relevé, bien plus sévère, cherche **tout texte
en alphabet latin** dans l'interface chinoise : il a trouvé ce que le premier
ne pouvait pas voir, et notamment un défaut de l'outil lui-même — le relevé ne
lisait que `t()`, pas `tf()`, et laissait donc cent cinquante phrases hors du
catalogue sans rien en dire.

Ce qui n'est pas traduit, et que l'écran dit : ce que les utilisateurs
écrivent.

Fait en 0.26.0 : **la passerelle parle aussi les trois langues**. C'était la
réserve laissée par la 0.25.0 — « L'adresse CalDAV n'est pas une URL valide »
arrivait en français au milieu d'un écran anglais. 289 messages relevés et
traduits (`npm run i18n-passerelle` : `node scripts/i18n-passerelle.mjs`),
catalogues dans `gateway/i18n/`.

La difficulté n'était pas la traduction mais **savoir à qui l'on parle** : une
instance sert plusieurs postes, qui ne lisent pas la même langue, si bien
qu'une langue « de l'instance » serait fausse pour quelqu'un. Chaque requête
porte donc la sienne (`X-Helix-Langue`, ou `?langue=` pour les flux
d'évènements, qui ne portent pas d'en-tête), et `AsyncLocalStorage` — du Node
standard, la passerelle restant sans dépendance — la rend lisible depuis
n'importe quelle profondeur d'appel sans la passer en paramètre à trois cents
endroits. Hors requête (démarrage, tâches planifiées, journal), il n'y a
personne à qui parler : la phrase reste en français, et le journal du serveur
reste dans une seule langue, ce qui est voulu.

Le défaut trouvé en parcourant l'écran, et non dans le code : l'en-tête
manquait à `Access-Control-Allow-Headers`, ce qui coupait **toutes** les
requêtes d'un poste rattaché, langue ou pas.

Fait aussi en 0.26.0 : **l'anglais devient la langue par défaut** quand le
système n'en indique pas une des trois ; les tailles de fichiers suivent la
langue (« 1 Go » devenait « 1 Go » en anglais, c'est maintenant « 1 GB », via
`taille()` dans `src/lib/i18n.ts`) ; l'onglet « Bibliothèque » s'appelle
« Fichiers » ; le logo ne s'allume plus au survol, n'étant pas un bouton ; et
Chat, Cowork et Code forment un seul bloc horizontal en haut de la barre
latérale — sans icône, faute de place pour elle et le mot : à 248 px de barre,
une pastille en reçoit 70, et « Cowork » avec son icône en demande 80.

**Le raisonnement, cinq niveaux au lieu de trois (0.26.0).** Le réglage ne
faisait qu'une chose : relever un plancher de jetons. Un client qui demandait
déjà large ne voyait donc aucune différence entre « rapide » et
« approfondi » — un bouton qui ne change rien est pire qu'un bouton absent.
Les niveaux sont désormais Aucun, Faible, Moyen, Élevé, Max, sous un titre
« Raisonnement » et chacun avec une ligne disant ce qu'il fait, et ils agissent
par trois leviers (`NIVEAUX_EFFORT`, `gateway/src/config.ts`) : le plancher de
jetons, que tout moteur respecte ; `reasoning_effort`, que la plupart des
moteurs compatibles OpenAI suivent ; et `chat_template_kwargs.enable_thinking`,
par quoi LM Studio, vLLM et llama.cpp coupent la réflexion d'un Qwen3 pour le
niveau « Aucun ». Les deux derniers sont des extensions : un moteur qui ne les
connaît pas refuse la requête, elle est alors rejouée une fois sans eux et le
moteur est retenu, comme cela se faisait déjà pour `stream_options`. Vérifié de
bout en bout contre un moteur factice : choisir « Max » à l'écran fait bien
partir `reasoning_effort: "high"` et `max_tokens: 16384`, et un moteur qui
refuse ces champs reçoit quand même le budget, sans que la conversation casse.

Deux retours du client sur cette même 0.26.0, corrigés dans la foulée. Les
icônes de Chat, Cowork et Code étaient parties avec le passage à l'horizontale ;
elles reviennent, et « Cowork » tient enfin parce que les pastilles suivent la
largeur de leur mot (`grow`) au lieu d'être forcées à la même (`flex-1`) : le
mot le plus long réclamait 75 px, en recevait 74, et se coupait pour un pixel
pendant que « Chat » en gaspillait quinze. Et l'écran Connecteurs cachait ses
trente-cinq services derrière une tuile « Tous les services » : quelqu'un qui
cherche Notion ne clique pas sur une tuile qui ne dit pas Notion. La liste et
son champ de recherche sont maintenant à l'écran, sous les quatre branchements
courants.

**Les connecteurs, lisibles (0.26.0).** L'écran avait quatre tuiles en haut —
courrier, agenda, Drive, Slack — et le catalogue en dessous : Gmail s'affichait
donc deux fois, et trente lignes identiques, précédées d'un simple point gris,
se lisaient une par une pour retrouver son service. Tout tient maintenant dans
une seule liste « Services connectés », chaque ligne portant le **logo** du
service, avec un point d'état posé dessus. Les quatre écrans de réglages
(IMAP, CalDAV, Drive, Slack) s'ouvrent sous leur ligne, comme les autres, et la
recherche les trouve comme les autres.

Les logos viennent de Simple Icons (CC0) et sont recopiés dans le source par
`scripts/gen-marques.cjs` : quarante dessins, plutôt qu'une dépendance de
quinze mégaoctets. Slack et OpenAI ont demandé le retrait de leur logo de ces
collections, Canva, Firecrawl, Tavily et Exa n'y ont jamais figuré : tous
reçoivent une icône neutre, ce qui est aussi plus prudent juridiquement qu'un
dessin approximatif.

**Les vrais logos, en couleur (28/09/2026, branche `logos`).** Medhi : « mets
les vrais logos », « là, les logos sont sans couleur ». Simple Icons est
abandonné : chaque logo est désormais le fichier officiel du kit ou de la page
de marque de la société, relevé le 28/09/2026, en couleur, avec sa version pour
fond sombre quand elle existe (GitHub, X, Vercel, Linear… passent au blanc).
33 marques, fichiers et empreintes dans `scripts/marques/` (`sources.json`
donne l'adresse, la page et la règle d'usage retenue de chacun) ;
`scripts/gen-marques.cjs` les vérifie et les convertit en données de dessin,
sans HTML injecté ni appel réseau ; `LogoMarque` pose les deux versions et le
thème en montre une, par CSS. Les logos gagnent aussi les clés d'API (liste des
fournisseurs) et « Comparer les modèles ». Les chartes ont été lues une à une,
et 23 marques gardent une icône neutre : Slack (licence écrite, redistribution
interdite), OpenAI (autorisation préalable), LinkedIn (boutons « Share » et
« Follow » seulement), Facebook, Instagram et Llama (téléchargement derrière
une case « j'accepte » que l'agent n'a pas cochée à la place de Medhi), TikTok,
HubSpot, Intercom, Box, PayPal (autorisation), YouTube (100 px de haut au
minimum), Asana, Airtable, Square (pas de symbole seul autorisé), DeepSeek,
Qwen, Gemma, Tavily, Groq, Scaleway, OVHcloud, IONOS (pas de source officielle
utilisable). Les glyphes Lucide qui imitaient YouTube, LinkedIn, Facebook et
Instagram sont retirés. THIRD_PARTY_NOTICES.md § 4 bis, contrôlé par
`npm run securite`. Si Medhi accepte les conditions de Meta, les logos de
Facebook et d'Instagram se posent dans `scripts/marques/` comme les autres.

**Logos, seconde tournée (28/09/2026, branche `logos-2`).** Medhi : « intégrer
les logos quand c'est possible, vérifier ceux qui existent, voir si on peut
intégrer les autres ». Chaque charte relue, pages « partenaires » et
« développeurs » comprises ; aucune case de conditions cochée à la place de
Medhi.

- **Vérifiés** : les empreintes de `sources.json` tiennent, et les fichiers
  retéléchargés aux mêmes adresses (GitHub, Linear, Canva, Exa, Atlassian,
  Firecrawl, Vercel, Webflow, PostgreSQL, Kubernetes, Brave, GitLab,
  OpenRouter, Kimi) sont identiques octet pour octet. Le kit de SpaceXAI
  (Grok, xAI) ne se laisse plus télécharger hors navigateur : non recomparé.
- **Corrigés** : les icônes Google dataient de 2020 alors que la charte demande
  la version la plus récente ; elles passent à la refonte de 2026 (Maps : 2025),
  en PNG officiel, la version 2 n'existant pas en SVG. Le point d'état de la
  liste des connecteurs était posé sur le coin du logo, dans sa zone de
  protection (GitHub, Canva, Facebook, Atlassian l'interdisent) : il passe
  devant, à 12 px. Les tailles minimales et zones de protection chiffrées
  (Canva 8 px, GitLab 20 px, Facebook 16 px et une demi-largeur, Todoist,
  Tavily, ClickUp) sont dans `sources.json` et `LogoMarque` les applique ;
  chaque appel dit l'espace que sa ligne laisse déjà (`degagement`).
- **Ajoutés** : Tavily (page de marque publiée depuis, usage référentiel
  permis ; zone libre égale à sa hauteur, d'où une ligne un peu plus haute).
  Relevés pour des connecteurs à venir, sans être montrés : Google Docs, Google
  Forms, Dropbox, Telegram, Trello, Todoist, ClickUp.
- **Restent neutres**, raison relue : Microsoft (Outlook, OneDrive, SharePoint,
  Excel, Word, Teams : jamais sans licence), Stripe, Shopify, WooCommerce,
  Salesforce (schéma seulement), Pipedrive (sur demande), Zendesk, Discord,
  Zoom (SDK seulement), monday.com et Mailchimp (logo complet seulement), Brevo
  (le nom seul), Calendly (aucune page), Scaleway (32 px minimum), Meta pour
  Llama (approbation « Brand Review » ; le kit n'a pas été retrouvé sur le
  poste), et ceux qui l'étaient déjà (Slack, OpenAI, LinkedIn, TikTok,
  HubSpot, Intercom, Box, PayPal, Asana, Airtable, Square, DeepSeek, Qwen,
  Groq, OVHcloud, IONOS, Gemma ; YouTube dans la liste). Raisons dans `sources.json` et
  THIRD_PARTY_NOTICES.md § 4 bis.
- **Laissé à Medhi** : WhatsApp (usage possible, kit derrière une case
  « j'accepte » : https://www.meta.com/brand/resources/whatsapp/whatsapp-brand/) ;
  la page Google « How to show Google's brand » demande en plus une
  autorisation par formulaire du Partner Marketing Hub pour les icônes de
  produit ; Dropbox demande aussi, sur sa page juridique, d'être consulté avant
  un usage « dans un produit ».

Vu à l'écran (passerelle et interface jetables, ports 5391 et 5392) : le point
devant le logo, Tavily à 22 px avec 10 px de marge ajoutés, les icônes Google
de 2026 en clair et en sombre. Pas vu : l'application empaquetée.

**Logos, troisième tournée (28/09/2026, branche `logos-3`).** Décision de Medhi
(§ 3.18) : les vrais logos partout. 43 marques ajoutées (86 en tout, plus aucune
neutre) : Slack, OpenAI, LinkedIn, TikTok, HubSpot, Intercom, Box, PayPal, Asana,
Airtable, Square, monday.com, Mailchimp, Brevo, IONOS, DeepSeek, Qwen, Calendly,
Groq, Gemma, Scaleway, OVHcloud, Meta (Llama), les six icônes Microsoft 365 de 2026,
Stripe, Shopify, WooCommerce, Salesforce, Pipedrive, Zendesk, Discord, Zoom,
WhatsApp, Mattermost, l'icône de YouTube, Z.ai (GLM) et MiniMax. Branchés dans
la liste des connecteurs (réseaux, campagnes e-mail, messageries, commerce, projets,
les six lignes Microsoft avec chacune son icône), la carte de Slack branché, les
canaux des employés, les clés d'API (tous les fournisseurs sauf « compatible »),
le sélecteur de modèles et « Comparer les modèles » (GPT et gpt-oss, DeepSeek, Qwen,
Llama, Gemma, GLM, MiniMax en plus). Sources : kits sans case à cocher (TikTok,
Discord, Shopify, YouTube), sinon fichiers servis par les sites officiels, dépôt
officiel pour MiniMax, Wikimedia Commons pour Square seulement. Pastille claire en
thème sombre pour Square, OVHcloud et PayPal. Le générateur ignore désormais les
règles `@media (prefers-color-scheme)` (icônes de Scaleway, Zendesk) et refuse
tout CSS hors règle (`@import`, bloc @ non géré). Restent sans logo, faute de
fichier relevé : Phi (Microsoft), Granite (IBM), Nemotron (NVIDIA), OLMo (Ai2) dans
les modèles.

**Le sélecteur de modèles, un seul panneau (0.26.0).** Il y en avait deux :
« comportement », puis « modèle précis » derrière un chevron. Deux défauts,
tous deux constatés à l'usage.

Le premier : les raccourcis ne disaient pas ce qu'ils faisaient. « Rapide » ne
nommait aucun modèle — on choisissait une promesse. Chaque raccourci montre
désormais le modèle qu'il retient, avec le logo de son éditeur et le drapeau du
pays qui l'héberge, et une recherche en tête du panneau trouve un modèle ou un
fournisseur sans dérouler la liste.

Le second était plus grave : « Rapide » et « Approfondi » écrivaient le
**niveau d'effort**, celui-là même que règle la puce « Raisonnement » posée
juste à côté depuis le début de cette version. Deux commandes pour une seule
valeur, avec deux vocabulaires différents : régler l'une décochait l'autre. Les
raccourcis choisissent maintenant un **modèle** — ce qu'ils ont toujours
prétendu faire — et l'effort reste au bouton d'effort.

**Les modèles de la machine sur le graphique (0.26.0).** L'écran annonçait
« aucun de vos modèles n'y figure » à quelqu'un qui en avait un sous les yeux :
un modèle qui tourne sur le poste n'est mesuré par personne, et n'a pas de prix
par jeton. Il a maintenant sa **bande**, à gauche, avant que l'échelle des prix
ne commence, séparée par un trait.

Le raisonnement derrière cette bande : sur une échelle logarithmique, « rien »
n'a pas de place — log(0) n'existe pas — et poser un modèle local à la valeur
la plus basse du graphique reviendrait à lui inventer un prix. Sa hauteur, elle,
reste honnête : la note du relevé quand il y figure (`gpt-oss-120b` y est), et
sinon une place marquée « note non relevée », en cercle creux, en bas de la
bande. Un modèle hébergé garde sa place dans le nuage ; un modèle local n'y
apparaît plus en double, au prix de quelqu'un d'autre.

Le bouton « Brancher un modèle cloud avec une clé » est remonté **au-dessus**
de la liste : c'est une action, pas une note de bas de page, et c'est
précisément quand on n'a pas le modèle qu'on veut qu'on en cherche un nouveau —
donc sans avoir à dérouler dix entrées d'abord.

**Trois retouches demandées après coup (0.26.0).** Les serveurs livrés avec le
produit passent **devant** les services à brancher : les mettre après, c'était
faire chercher ce qu'on a déjà. Le groupe est reconnu à son attribut `integre`
et non à son titre, qui est du texte traduit. Sur le graphique, chaque point
porte désormais son nom — un nuage de ronds anonymes ne dit rien — avec un
placement qui évite les chevauchements et cède toujours la place au modèle en
cours plutôt qu'à un repère lointain. Et le modèle en cours est marqué en
bleu, avec sous le graphique une ligne qui donne sa note, son coût, sa vitesse
et son rang : un nuage répond à « où se situent les modèles », pas à « et le
mien, alors ? ». Quand ce modèle n'est pas au relevé, la ligne le dit au lieu
de disparaître.

**Comparer intelligence et prix (0.26.0).** Un nuage de points, intelligence
en ordonnée et coût moyen par tâche en abscisse (échelle logarithmique) : les
modèles que l'instance sert sont marqués, les autres servent de repères, et
cliquer un point choisit le modèle.

Les chiffres sont **figés dans le logiciel**, avec la date du relevé affichée
et un lien vers la source. Décision du client, et elle est cohérente avec le
produit : interroger un service américain à l'ouverture d'un écran
contredirait la promesse « rien ne part vers un service tiers », et l'écran ne
marcherait plus sans Internet, ce qui n'a pas de sens sur une instance au fond
d'un bureau. Le prix est que les chiffres vieillissent d'une version à
l'autre ; l'écran le dit. Depuis le 27/09/2026, les notes sont l'indice ECI
d'Epoch AI (CC BY 4.0) et les prix ceux des pages des éditeurs : § 3.15.

Ce que la source ne donne pas, l'écran ne l'invente pas : un modèle sans prix
relevé n'a pas de position sur l'axe des prix, un modèle sans note n'en a pas
sur l'axe des notes. Lire une position de point pour en déduire un chiffre
aurait rempli le nuage d'approximations présentées comme des mesures. De même,
un petit modèle sur un portable n'hérite pas de la note de son grand frère
hébergé.

Un effet de bord corrigé au passage : le tri qui précède **chaque** demande
(« faut-il découper ce travail ? ») héritait du niveau choisi, et se serait
donc payé seize mille jetons de réflexion pour une décision de quelques mots.
Il est forcé à « Aucun », ce qui rend enfin vrai le `/no_think` qu'il envoie
déjà.

Corrigé en 0.24.0, signalé par le client capture d'écran à l'appui : **l'écran
Code ne répondait plus**, chaque prompt rendant « Provider request failed with
HTTP 401 : missing_api_key ». Trois défauts empilés, trouvés en lisant le
journal d'OpenCode puis en interrogeant son serveur :

1. la passerelle ouvrait la session **sans nommer de modèle** quand l'interface
   n'en demandait pas (elle n'en demande jamais) : OpenCode choisissait alors
   lui-même, et tombait sur son propre fournisseur hébergé, qui exige une clé ;
2. la configuration écrite par Helix dans le dossier de travail **n'était plus
   lue**. OpenCode 1.18 range les projets par dépôt : un dossier qui n'est pas
   un dépôt Git devient le projet « global » et sa configuration locale est
   ignorée. Le fournisseur « helix » n'existait donc pas pour lui ;
3. `disabled_providers` **n'est pas respecté** par OpenCode 1.18.3 : son
   fournisseur hébergé reste actif, avec trente et un modèles. Mesuré par
   `GET /api/provider`.

Corrections : la passerelle nomme **toujours** le modèle (elle décide du
moteur, ADR-001) ; la configuration vit désormais à côté des données de
l'instance et son dossier est transmis par `OPENCODE_CONFIG_DIR`, seule
variable qui fonctionne ; et `small_model` est épinglé sur le modèle de
l'instance, pour que même le titre d'une session ne parte pas chez un tiers.
Vérifié de bout en bout : session ouverte avec `helix/qwen3-8b`, `GET
/api/provider` rend « helix », consommation enregistrée par la passerelle,
zéro erreur dans le journal d'OpenCode.

**Au passage, une fuite refermée.** Ce fichier de configuration porte le jeton
d'instance en clair, et il était déposé **dans le dossier de travail de
l'utilisateur** — souvent un dépôt Git ou un partage réseau. Le commentaire
d'origine s'en remettait à un `.gitignore` posé par l'intégrateur, c'est-à-dire
à la vigilance d'un tiers. Il vit maintenant dans le dossier de données de
l'instance, en 0600, et l'ancien fichier est retiré au démarrage quand c'est
bien celui de Helix.

Corrigé en 0.24.0, signalé par le client : **Cowork semblait « restreint »**. Il
l'est, et c'est voulu — l'agent ne voit que le dossier de travail — mais le
refus arrivait en anglais, tel que le serveur de fichiers le formule, sans dire
quel est ce dossier ni comment en changer. Le message explique désormais les
deux, en français.

Fait en 0.24.0, demandé par le client : **Cowork travaille sur tout le poste**.
Il ne voyait qu'un dossier, et un assistant qui ne peut pas ouvrir le fichier
qu'on lui montre ne sert à rien. Le panneau offre maintenant « Tout mon
poste » : le dossier personnel **et** les disques montés (`/Volumes`, `/media`,
`/mnt`), sans avoir à choisir un dossier avant chaque demande. Ce qui reste
fermé, et ne s'ouvrira pas par un réglage : les organes du système. Ce qui
protège ensuite : la barrière d'approbation, qui demande avant chaque
modification. L'ouverture large **redemande le mot de passe**, même sur une
machine personnelle où changer de dossier n'en demande pas : ce n'est pas le
dossier qui change, c'est l'étendue.

Corrigé au passage : le dossier de travail choisi à l'écran n'était gardé
**qu'en mémoire**. Il revenait au dossier par défaut à chaque redémarrage, sans
que rien ne le dise. Il est désormais écrit à côté des données de l'instance.

Fait en 0.24.0 : **« Se connecter avec Google / Microsoft » pour le courrier**
(ADR-044). Une boîte Google Workspace ou Microsoft 365 se branche sans mot de
passe d'application et sans un seul champ de serveur : autorisation OAuth avec
PKCE, jetons chiffrés au repos, renouvellement automatique, et
authentification IMAP et SMTP en XOAUTH2.

Ce que l'écran dit sans le cacher : ce chemin demande **une préparation, une
fois**, par l'administrateur de l'organisation, qui déclare Helix comme
application **interne**. C'est ce qui évite la vérification de Google et son
audit annuel à plusieurs milliers d'euros. Pour un compte personnel, l'écran
renvoie au mot de passe d'application, plutôt que de proposer un bouton qui
échouerait.

**Vérifié** contre des serveurs IMAP et SMTP d'essai qui refusent tout mot de
passe et n'acceptent que XOAUTH2 : connexion réussie sans mot de passe, refus
propre d'un jeton faux, avec un message qui dit quoi faire. Plus la
construction de la demande d'autorisation : PKCE S256, portée limitée au
courrier, jeton de renouvellement demandé, locataire Microsoft respecté, `state`
inconnu refusé. **Non vérifié** : le trajet réel chez Google et Microsoft, qui
demande un compte Workspace ou M365 et une application déclarée.

Fait en 0.24.0 : **la page d'abonnement** (Paramètres → Abonnement), demandée par
le client. D'abord quatre formules à 10, 20, 100 et 200 € par mois et deux modèles ;
**refaite le 29/09/2026** (entrée suivante) : six formules pour particuliers et
entreprises, plus Entreprise sur devis, trois modèles à poids ouverts **hébergés à
Paris**, prix de lancement, mensuel ou annuel. Le calcul n'est pas écrit dans
l'écran : il vit dans `src/config/offre.ts`, avec le coût de revient relevé chez
l'hébergeur, les frais de paiement, la part du net qui paie le calcul (60 %), et la
formule qui en déduit les jetons. Changer un chiffre suffit ; `npm run securite`
(§ 38) refait les comptes.

Ce que cet écran dit, et qui n'est pas confortable : **aucun paiement n'y est
branché**, les prix sont une proposition appuyée sur un devis d'hébergement encore
à faire, et le bouton propose d'écrire plutôt que d'acheter. Un bouton
« S'abonner » qui n'encaisse rien aurait été exactement la promesse que ce produit
s'interdit. Le module est **éteint par défaut** : une entreprise qui installe
HelixAI chez elle n'achète rien, et n'a pas à voir une offre commerciale dans ses
propres réglages.

**Décidé et fait le 29/09/2026 : la nouvelle grille d'abonnement** (décision de
Medhi). Elle vise ChatGPT et Claude palier par palier, moins cher à chaque marche,
avec la plateforme complète en plus, et un rabais de lancement pour faire venir les
premiers abonnés.

- *Particuliers, TTC par mois, prix normal puis prix de lancement* (−30 % les six
  premiers mois de l'abonnement) : Découverte 4,99 → 3,49 € (en face de ChatGPT Go,
  8 $ ; modèle rapide seul) ; Plus 12,99 → 8,99 € (ChatGPT Plus, Claude Pro, 20 $) ;
  Pro 49,99 → 34,99 € (ChatGPT Pro, Claude Max, 100 $) ; Max 99,99 → 69,99 €
  (ChatGPT Pro, Claude Max, 200 $). Un poste ; les trois modèles sauf Découverte.
- *Entreprises, HT par poste et par mois, deux postes au moins* : Équipe 14,99 →
  10,49 € (ChatGPT Business, Claude Team, 25 $) ; Équipe Premium 69,99 → 48,99 €
  (leurs formules premium, 125 $). Entreprise : sur devis, sans prix affiché
  (abonnement par poste, consommation réelle au coût de l'hébergeur plus 30 %,
  installation sur leurs serveurs, accompagnement, support garanti), un bouton pour
  écrire.
- *Annuel* : dix fois le mensuel normal, arrondi en ,99 (49,99 €, 129,99 €, 499,99 €,
  999,99 €, 149,99 € et 699,99 € HT par poste). Le rabais de lancement ne vaut que
  pour le mensuel, pour garder la grille simple. Les prix concurrents ne sont **pas**
  affichés à l'écran : ils changent sans nous, ils restent dans les commentaires de
  `offre.ts`.
- *Modèles*, hébergés à Paris chez Scaleway, prix relevés par Medhi le 29/09/2026
  (https://www.scaleway.com/en/pricing/model-as-a-service/, euros par million de
  jetons, entrée / sortie) : rapide, Mistral Small 3.2 24B (0,15 / 0,35), soit
  0,20 € le million en Chat (trois jetons lus pour un écrit) ; polyvalent, DeepSeek
  V4 Flash (0,40 / 0,80, 0,08 en cache, non compté), 0,50 € ; expert, Qwen3.5 397B
  A17B (0,60 / 3,60), 1,35 €. Ils remplacent « Modèle rapide » et « Modèle expert ».
- *Le calcul, corrigé* : l'ancien prenait 45 % du prix **TTC**, TVA et frais
  compris, donc de l'argent qui n'arrive jamais. Désormais net = HT (TTC / 1,20 pour
  un particulier) moins les frais de paiement estimés (1,5 % + 0,25 € par paiement
  pour une carte de l'UE, plus 0,7 % de Stripe Billing, sur le TTC payé) ; crédit du
  mois = 60 % du net **du prix normal**, rabais ou pas ; jetons = crédit / coût du
  modèle. Un seul crédit, que chaque modèle consomme à son tarif (×1, ×2,5, ×6,75) ;
  pour les entreprises, crédit par poste, mis en commun dans l'équipe.
- *Jetons retrouvés par le calcul* (en millions, rapide / polyvalent / expert, au
  centième) : Découverte 11,40 en rapide ; Plus 30,87 / 12,35 / 4,57 ; Pro 120,93 /
  48,37 / 17,91 ; Max 242,63 / 97,05 / 35,95 ; Équipe 43,03 / 17,21 / 6,38 ;
  Premium 203,68 / 81,47 / 30,17 par poste. Ce sont les chiffres de la décision au
  dixième près : la décision les arrondissait au plus proche, l'écran les arrondit
  **vers le bas** (30,8 au lieu de 30,9 pour Plus en rapide, 4,5 au lieu de 4,6 en
  expert, 97,0 au lieu de 97,1 pour Max), pour ne jamais afficher plus que ce qui
  est payé.
- *Équivalences affichées, en « environ »* : un échange de Chat ≈ 3 000 jetons
  (question, historique et réponse ; 1 500 avant, qui oubliait l'historique), une
  tâche d'agent ou de Code ≈ 150 000. Soit, par exemple, environ 342 échanges par
  jour en rapide et 82 tâches par mois en polyvalent pour Plus.
- *Hypothèses d'usage et marges* (simulation de la décision, pas une mesure) :
  médianes supposées de 0,8 / 2,5 / 10 / 25 M de jetons par mois pour Découverte,
  Plus, Pro et Max, 1,5 et 8 M par poste pour Équipe et Premium ; marge en usage
  central de 75 à 93 % au prix normal. **Pire cas** (chacun vide tout son crédit) :
  toujours positif au prix de lancement, de 0,30 € par mois pour Découverte à 8,01 €
  pour Max ; à −40 %, Découverte perdrait de l'argent. Le pire cas est refait par
  `npm run securite` (§ 38) à chaque changement de chiffre ; les marges centrales ne
  le sont pas.
- *Crédit épuisé* : le Chat passe au modèle local de la machine, sans facture en
  plus. C'est la règle de l'offre, dite à l'écran ; rien ne la met en œuvre tant
  qu'il n'y a ni relais ni compte de consommation.
- *La plateforme comprise*, listée à l'écran, et vérifiée dans le code ligne par
  ligne : modèles locaux gratuits et sans limite, Chat (recherche web, documents
  joints), Cowork, Code, agents (« jour et nuit, tant que la machine qui les héberge
  est allumée » : un agent vit dans l'instance, il s'arrête avec elle), connecteurs
  (Gmail, Drive, Slack, Microsoft 365…), réunions, extension VS Code et ligne de
  commande, fichiers, Chats et réglages qui restent sur la machine, modèles hébergés
  en France, logiciel libre.
- *Rabais de lancement* : `LANCEMENT` dans `offre.ts` (taux, durée en mois, `actif`
  pour le couper partout). Le prix de lancement est calculé : prix normal moins le
  taux, ramené au montant en ,49 ou ,99 juste en dessous (12,99 € donne 9,09 €,
  affiché 8,99 €).

À l'écran (vérifié dans le navigateur contre une instance jetable, en 1280 et 375 px,
thèmes clair et sombre) : la plateforme comprise d'abord, les trois modèles avec ce
qu'ils consomment du crédit, puis un sélecteur Mensuel / Annuel, les Particuliers et
les Entreprises en cartes (prix de lancement, prix normal barré, « −30 % les 6
premiers mois, puis … », jetons par modèle, équivalences), la carte Entreprise sur
devis, et l'encart qui dit que rien n'est ouvert. **Rien n'encaisse** : les deux
boutons ouvrent la messagerie, et `npm run securite` (§ 38) vérifie qu'aucun
« S'abonner » ni bouton de paiement n'y entre et que le module reste éteint par
défaut. À faire avant d'ouvrir : le relais chez l'agence qui garde la clé de
l'hébergeur, un compte de consommation par abonné (qui applique le crédit et la
bascule au modèle local), le paiement ; puis relire les frais réels de Stripe et
les prix de Scaleway.

Fait en 0.23.0 : **ouvrir son instance à ses collègues depuis l'écran**. Le produit
sert trois situations — un particulier seul, une entreprise dont l'intégrateur règle
tout, et quelqu'un qui a Helix sur son PC et veut inviter une personne à travailler
avec lui. Le troisième cas, le plus courant après le premier, demandait d'éditer
`helix.config.json` à la main. C'est désormais un interrupteur, sous mot de passe,
qui chiffre automatiquement et donne l'adresse à transmettre (ADR-041).

Corrigé en 0.23.0 : **le mode « poste rattaché » ne fonctionnait pas dans
l'application livrée.** C'est pourtant le cœur du modèle ERP (chacun installe
Helix, une machine tient l'instance, les autres s'y rattachent). Deux défauts
cumulés : l'application lançait sa passerelle locale même quand le poste dépend
d'une autre machine, et surtout le jeton de cette passerelle locale écrasait celui
de l'instance d'entreprise — chaque requête repartait avec un jeton inconnu, donc
401. Le mode n'avait été éprouvé que dans un navigateur, où il n'y a pas de jeton
de lanceur : le défaut n'y apparaissait pas. Corrigé et vérifié avec deux instances
réelles (ADR-040).

Corrigé en 0.23.0, trouvé en utilisant l'application : **la synchronisation pouvait
effacer les conversations**. `startSync` amorçait l'instance avec le cache local dès
qu'une lecture **échouait**, sans distinguer « l'instance n'a pas cette collection »
de « l'instance a refusé de répondre ». Un refus est pourtant le pire moment pour
écrire : on ne sait rien de ce qu'il y a en face, et le cache local peut être vide.
Une liste vide poussée par-dessus une instance pleine efface les conversations, et
`authz.ts` ne s'y oppose pas — la personne en est propriétaire, c'est une
suppression légitime à ses yeux. C'est arrivé au client : ses chats ont disparu, et
ont été restaurés depuis la sauvegarde prise avant la mise à jour. On n'amorce
désormais que sur « absente », jamais sur « échec » (mesuré : avant correction, une
lecture en 401 suivie d'une poussée vidait l'instance ; après, la poussée n'a plus
lieu).

**La leçon, qui vaut au-delà de ce bogue :** une sauvegarde avant chaque version qui
touche aux données stockées n'est pas une précaution de confort. C'est elle qui a
permis de rendre ses conversations au client. Elle est déjà dans les règles de
travail ; elle y reste, en gras.

Corrigé en 0.23.0 : un **crochet React après une sortie anticipée** dans l'écran des
projets (ajouté le jour même avec l'envoi d'invitation) faisait planter l'écran
entier, erreur React #310. Un contrôle passe désormais sur tout `src/` à la
recherche de ce motif.

Fait en 0.23.0 : **invitation d'un collègue qui fonctionne vraiment**. Le bouton
« Inviter » d'un projet n'envoyait rien : il notait l'invitation en local, et la
personne invitée butait ensuite sur deux murs (le jeton d'instance, qu'aucun écran
ne montrait, et la création de compte, réservée à qui a déjà une séance). Désormais
un **code** lui est envoyé par mail, avec l'adresse de l'instance ; il rattache son
poste, ouvre son compte et **choisit lui-même son mot de passe**. Sans boîte aux
lettres branchée, l'écran affiche le code à transmettre au lieu de prétendre l'avoir
envoyé. Nouvelle section Réglages, Profil : « Inviter un collègue », avec les
invitations en attente et leur annulation (ADR-038).

Fait en 0.23.0 : fermeture des dettes de sécurité de la veille (voir ci-dessus et
SECURITE.md § 18) : origine propre `helix://app` avec politique de contenu calculée,
billets à usage unique pour les flux d'évènements, secrets du poste dans le trousseau
du système, rôle d'administrateur pour la vue d'ensemble du journal, bot de réunion
qui ne peut plus se faire dicter son audio, adresse d'instance vérifiée côté
processus principal. Plus « Rester connecté sur ce poste » à la connexion : la séance
dure trente jours glissants au lieu de douze heures, le mot de passe n'est conservé
nulle part, et la séance longue se voit et se révoque dans la liste des postes.

Fait en 0.22.0 : branchement des services en un clic (« Se connecter », OAuth avec
enregistrement dynamique, sans tiers), catalogue de connecteurs passé de 2 à 33
entrées rangées par rubrique et cherchables ; archivage des chats à côté de la
suppression ; cloche de notifications réelle (mise à jour de l'application et du
moteur des agents, accord attendu, tâche terminée ou en échec, chat partagé) ; aide
et support intégrés, hors ligne ; indicateur « le modèle juge s'il faut découper »
retiré du Chat ; passe de sécurité complète (voir SECURITE.md § 17) : demandes
d'approbation cloisonnées par personne, journal d'audit cloisonné, HTTPS imposé pour
une instance distante, politique de sécurité du contenu réellement appliquée, agent
autonome bridé sur un mail reçu, limitation de débit, et douze autres corrections.

Fait en 0.21.0 : revue finale de la demande entière après les étapes, avec étapes de
complément ; contrôle automatique du code web (liens, fonctions, éléments, syntaxe)
lancé par la revue et disponible comme outil ; plans regroupés « un fichier = une
étape écrite en entier » et exemple de plan donné au planificateur. Éprouvé sur un
site de trois pages et une application de liste de tâches écrits par qwen3-8b.

Fait en 0.20.0 : le découpage des tâches est jugé par le modèle lui-même, redécoupe
une étape trop grosse (trois niveaux), écrit les textes longs partie par partie ;
les étapes reçoivent les données réellement lues par les outils ; une étape se juge
aux retours des outils (un compte rendu « fait » sur des actions refusées ne passe
plus) et une étape qui modifie est contrôlée sur l'état réel, le modèle finissant ce
qui manque ; un appel d'outil au JSON mal refermé est réparé sur la forme (jamais une valeur
coupée) ; déplacer un fichier vers un dossier le range dedans ; plus de tiret long dans
le plan affiché. OpenClaw reste sur la machine (décision du 15/09/2026).

Fait en 0.19.0 : enchaînement des cartes de tâches (prérequis, lancement
automatique, comptes rendus transmis, boucles refusées, étape annulée qui bloque la
suite), exécutions qui survivent au changement d'écran ; Échap dans un menu ne ferme
plus la fenêtre qui le contient.

Fait en 0.18.0 : option « Envoyer sans me demander » pour le Chat au niveau « Tout
approuver » et les agents autonomes, sauf quand un agent traite un mail reçu ;
pièces jointes sans limite de poids pour le texte, photos réduites plutôt que
refusées, mention « (début) » quand un fichier n'est pas lu en entier ; lecture par
passages des longs documents de la bibliothèque et des longues transcriptions ;
recherche dans la bibliothèque dont l'extrait tombait à côté après des accents ;
résultat d'outil coupé à 20 000 caractères qui ne le disait pas au modèle.

Fait en 0.17.0 : envoi réel des mails demandés, dans le Chat, Cowork ou par un agent
OpenClaw, chaque mail montré en entier et accepté un par un (§ 3.5) ; documents
jusqu'à 1 Go (bibliothèque, documents d'agent, dossier de l'équipe) et son de réunion
jusqu'à 2 Go, envoyés et relus en flux sans passer par la mémoire ; outils du Chat
retenus d'un Chat à l'autre ; traces d'outils en français.

Fait en 0.16.0 : Groupes, Bibliothèque, Réunions et Bot Recorder réels (ci-dessus) ;
missions déclenchées par un mail reçu ; brouillons dans la boîte ; mise à jour
d'OpenClaw réversible ; archives de conversations effacées pour de bon ; « Optimiser
les instructions » et « Depuis Helix » ; photo de profil ; durée de conservation du
journal d'audit et purge ; paramètres qui s'adaptent à la place disponible.

Fait en 0.15.0 : la description et les fichiers de l'agent lui parviennent (documents
de référence consultés et cités).

Fait en 0.14.0 : créer un agent suffit, il est mis en service tout seul (OpenClaw
installé au passage) ; plus de parcours « employé » séparé.

Fait en 0.13.0 : OpenClaw s'installe depuis le panneau Agents, au premier déploiement
ou par un bouton, sans terminal ni droits d'administrateur.

Fait en 0.12.0 : modèles cloud par clé (pour soi ou l'équipe) et de l'agence, dans le
Chat et pour les employés ; paliers de liberté des employés (jusqu'aux commandes sur
la machine, sous mot de passe) ; canaux Telegram, WhatsApp, Discord, Slack,
Mattermost ; outils d'OpenClaw recopiés au journal d'Helix.

Fait en 0.11.0 : les employés OpenClaw (§ 3.4), pièces jointes PDF et Office,
glisser-déposer, mise en forme des réponses, fenêtres modales qui défilent, fermer la
fenêtre sur macOS ne coupe plus la passerelle (les employés continuent).

### Fait en 0.27.0 : le tour complet (23/09/2026)

**Retouches du 23/09/2026, après essai par le client.**
- *Fenêtre impossible à déplacer* : seule la tête de la barre latérale servait
  de poignée, et le logo et le bouton de repli l'occupaient presque entière.
  Une bande de 28 px en haut de la zone principale (`.fenetre-poignee`,
  application de bureau seulement) déplace désormais la fenêtre ; boutons,
  liens et champs restent cliquables partout.
- *Liste des modèles coupée en bas de l'écran* : `Popover` n'avait aucune
  hauteur maximale. Il mesure la place de chaque côté, s'ouvre du côté le plus
  libre, ne dépasse jamais la fenêtre et défile lui-même (recherche fixée en haut).
- *Mac figé au lancement d'un modèle* : `loadModel` chargeait le nouveau modèle
  à côté de celui en mémoire. Il libère maintenant la place d'abord si
  l'ensemble (poids + 30 %) dépasse 45 % de la RAM.
- *Renommer un Chat* : crayon au survol ou double-clic, Entrée valide, Échap
  annule ; l'ordre de la liste ne change pas.
- *Cadre vert pendant la saisie* : retiré, le cadre reste gris.
- *Réplique prise pour un travail* : « non mais si je te connecte » recevait un
  plan de trois étapes et une revue finale. `estReplique` (plan.ts) tranche
  avant le tri par le modèle : question courte, ou phrase courte qui commence
  comme une réplique, jamais découpée. Les marqueurs de contrôle (« VERIFIE : … »,
  « RIEN A FAIRE ») sont retirés à l'affichage s'ils fuient dans la réponse.
- *Graphique « Comparer »* : les modèles locaux sans note publiée étaient empilés le long de l'axe gradué, ce qui leur prêtait une note
  (« qwen3-8b-dwq vaut 27 ? »). Ils sont désormais listés sous le graphique,
  sans position ; la bande de gauche n'existe que si l'un d'eux est noté.
- *Ce que l'installation pose* : un modèle de conversation adapté à la machine
  (Qwen3, qui raisonne lui-même : pas de second modèle « de raisonnement »), puis
  la dictée Whisper, en arrière-plan (`dicteeEnFond`). Rien d'autre. Le choix du
  modèle propose ensuite « À installer, adaptés à votre machine » : seulement
  les entrées du catalogue que la mémoire permet (`adaptesALaMachine`).
  L'installation fait elle aussi la place en mémoire avant de charger
  (`faireLaPlace`, partagé avec le chargement à la demande).
- *Choix du modèle selon la machine* (`provision.ts`) : catalogue multi-éditeurs
  relevé le 23/09/2026 sur le catalogue LM Studio (capacités, mémoire), sur un
  indice de notes (l'ECI d'Epoch AI depuis le 27/09/2026, § 3.15) et sur les licences (Apache 2.0 /
  MIT seulement : Gemma, Llama, NVIDIA écartés). `tientSur` : poids × 1,3 plus
  une réserve de 30 % de la RAM (3 à 8 Go) ; sur PC, un modèle dense doit tenir
  dans la carte NVIDIA (`nvidia-smi`), un modèle à experts peut déborder en RAM ;
  sans carte, seulement petits modèles ou à experts. À chaque machine, le mieux
  noté qui tient est installé, **essayé avec Helix ou non** (décidé par Medhi le
  26/09/2026 : « installer en fonction du PC le meilleur modèle ») ; s'il ne se
  charge pas, les suivants du classement, puis le plus léger vérifié. Pour piloter
  l'écran, seuls les modèles essayés à ce geste (Qwen3-VL) sont installés : un
  modèle qui ne sait pas désigner un point clique à côté. Mesuré par `recommend` le
  26/09/2026 sur Mac à puce Apple : 8 Go Qwen3.5 4B, 16 et 24 Go Qwen3.5 9B, 32 à
  128 Go Qwen3.8 27B, 256 Go DeepSeek V4 Flash ; PC NVIDIA 8 ou 12 Go avec 32 Go de
  RAM Qwen3.5 35B A3B. Les autres sont proposés dans « À installer » (6 au plus),
  marqués « pas encore vérifié avec Helix ». Aujourd'hui seuls Qwen3, Qwen3.5 9B et
  Qwen3-VL sont vérifiés. **Écran, 26/09/2026** : même règle (le mieux noté qui tient,
  puis les suivants), et trois modèles d'écran proposés au lieu d'un. Le catalogue de
  l'écran ne contient que Qwen3-VL (2B à 30B) : Qwen3.5, mesuré le 24/09, ne visait
  juste qu'une fois sur deux ; il n'y entre pas tant qu'un essai ne le justifie pas.
  Kimi K3 (43,6), GLM-5.3 (44,8), MiniMax : plusieurs centaines de Go, serveur
  seulement, donc par prestataire ou clé. En local : GLM-4.7 Flash (MIT, 16 Go,
  14,9) et DeepSeek V4 Flash (MIT, 150 Go, 34,3, machines de 256 Go) ajoutés.
- *Qwen3.5 9B vérifié* (24/09/2026, LM Studio, Mac 16 Go) : devient le choix
  d'office dès qu'il tient (note 13,7 contre 7,3 pour Qwen3 8B). Mesures sur
  une même question : « Aucun » 1 s, 0 réflexion ; « Faible » 26 s, 1 258
  caractères de réflexion ; « Moyen » 59 s, 3 003 ; « Élevé » 158 s, 6 341 ;
  « Max » 112 s, 6 170 : les niveaux changent vraiment la profondeur, mais
  Qwen3.5 réfléchit environ quatre fois plus que Qwen3 8B, donc répond plus
  lentement en « Moyen ». Outils : appel juste. Images : couleurs lues.
  `/no_think` n'existe plus pour lui (31 s de réflexion malgré lui) :
  « Aucun » envoie désormais `reasoning_effort: "none"`, que LM Studio suit
  pour Qwen3.5 et pour Qwen3 8B (mesuré), `/no_think` restant pour Qwen3.
  LM Studio charge la version MLX avec 32 768 jetons de contexte quoi qu'on
  demande (5,98 Go résidents). Au pointage d'écran, Qwen3-VL 4B reste
  meilleur (clics justes aux deux tailles d'image, contre un sur deux pour
  Qwen3.5) : il reste le modèle de l'écran.
- *Coordonnées d'écran sur une grille 0-1000* (24/09/2026) : Qwen3-VL et
  Qwen3.5 ne répondent pas en pixels mais sur une grille de 0 à 1000, quelle
  que soit l'image (bouton en 637, 402 : Qwen3-VL répond 616, 517 sur une
  capture 1024x768, 407, 443 sur 1600x900). Helix les prenait pour des
  pixels : dans la machine, les clics tombaient environ 115 px trop bas, ce
  qui explique les cellules de Calc mal visées. Désormais `grilleMille`
  (computer.ts) : on leur demande la grille explicitement et on convertit ;
  vérifié, les deux clics tombent dans le bouton.
  gpt-oss 20B, Magistral Small, Granite, Ministral : idem, au besoin.
- *Diversité des propositions* : classés à la note seule, les six proposés
  étaient presque tous des Qwen. Désormais : les trois mieux notés, puis le
  meilleur de chaque autre éditeur que la machine fait tourner (Mistral, IBM,
  Ai2, OpenAI, Zhipu, Meta selon la mémoire). Ajoutés : Ministral 3 8B, OLMo 3
  7B Think. Toujours écartés : Gemma, Llama, Phi-4 (licences à conditions).
- *Essai Code du 23/09/2026* (qwen3-8b, OpenCode 1.18.32, dossier jetable) :
  « petit site horloge en trois fichiers reliés » → 3 fichiers écrits en un
  tour, compte rendu clair, 224 s, site vérifié dans le navigateur (le bouton
  affiche l'heure). Écarts de qualité du modèle, pas du logiciel : le titre
  n'est que dans l'onglet, et l'heure se met à jour sans attendre le clic.
- *Code arrêté après la première action* (vu par le client) : `step.ended`
  avec `finish: "tool-calls"` était pris pour une interruption. C'est une étape
  intermédiaire (l'outil travaille, l'étape suivante reprend) : ignorée
  désormais (`code.ts`). Le motif d'une vraie interruption ne s'affiche plus
  qu'une fois, dans la réponse. Leçon : mon essai de la veille lisait le flux
  d'événements, pas l'écran ; refait dans l'écran Code avec la phrase exacte du
  client (« page web avec écrit Chien ») : fichier écrit, réponse complète.
- *Tournée de quatre agents de test (23/09/2026)* : Chat (13 bugs), Code (11),
  Cowork (11), Agents (7), chacun prouvé en faisant passer les événements réels
  par le vrai code de l'écran. Les plus graves : LM Studio redémarré en pleine
  génération par la passerelle (`backends.ts`), « Arrêter » qui n'arrêtait rien
  côté passerelle, demande arrêtée exécutée au tour suivant (Chat et Code),
  texte tapé par l'agent d'écran diffusé à tous les collègues (`computer.ts`),
  carte d'accord encore valable après « Arrêter », modèle/niveau jamais transmis
  à OpenCode, flux Code coupé à 301 s, autorisations OpenCode bloquantes, port
  OpenCode pouvant tomber sur celui d'un OpenCode personnel, tâche « Terminée »
  alors qu'elle avait échoué, instance d'agents injoignable affichée « En service ».
- *Reprises après la tournée* (par moi, défauts signalés par l'agent Cowork dans
  `chat.ts`) : outil non proposé au modèle refusé avant l'aiguillage ; étape sans
  action où le modèle dit « impossible » comptée en échec (cause `impossible`) ;
  action refusée par la personne jamais retentée (`parLaPersonne` dans
  `approbation.ts`, cause `refus`) ; note des services non connectés ramenée à
  ce que font les connecteurs (agenda et Slack en lecture seule). Et, vu en
  essai dans l'écran : Chat SANS outils qui affichait « 3 étapes faites sur 3 »
  pour un fichier jamais créé (plan de rédaction fait d'actions racontées) ;
  désormais réponse directe et honnête, et consigne « tu n'as aucun outil ».
  Titre de la carte d'accord neutre (elle est montée partout, pas seulement
  dans Cowork).
- *Décisions du client (23/09/2026)* : recherche web d'OpenCode gardée.
  Agent mémorisé avec le Chat (`Session.agentId`/`agentNom`, `memoriserAgent`,
  repris à la réouverture ; agent supprimé depuis : bandeau qui le dit, l'agent
  par défaut répond). Poste d'un employé : `POSTE_MAX` = 50 000 caractères,
  comme la fenêtre de création (coupait à 4 000 sans rien dire). Essayés dans
  l'écran : Chat avec l'agent « Pirate », autre Chat → agent par défaut,
  retour → « Pirate », agent supprimé → bandeau.
- *Dernière capture d'écran par demande* (24/09/2026) : `lastImage`, commun à
  toute l'instance, remplacé par `dernieresImages`, rangé par demande (50 au plus).
- *Importer ChatGPT ou Claude* (Paramètres) : l'archive d'export est lue sur
  le poste (`src/lib/importChats.ts`, lecteur ZIP par tranches, ZIP64 compris,
  jamais l'archive entière en mémoire). ChatGPT : branche affichée de l'arbre
  (réponses régénérées écartées), messages cachés écartés, images en
  « [image] », projets « g-p-… » numérotés (l'export ne donne pas leur nom).
  Claude : textes, pièces jointes lues, projets avec instructions et documents.
  On choisit ce qu'on importe ; la place du poste est montrée (les Chats vivent
  dans le stockage local, et une écriture qui dépasse était ignorée sans
  erreur : `ajouterSessionsImportees` relit ce qui a été gardé et le bilan le
  dit). Projets Claude : projet Helix, documents dans Fichiers, et un agent
  portant les instructions pour continuer les Chats comme avant. Essayé dans
  l'écran le 24/09/2026 : 2 Chats sur 2, projet, agent, document ; Chat
  importé rouvert avec ses messages. Formats reconstitués d'après les exports
  connus : à refaire avec une vraie archive du client.
- *Machine macOS de l'agent* (24/09/2026, `gateway/src/machineMacos.ts`) :
  Lume 0.5.3 installé par Helix dans `~/.helix/lume` (archive vérifiée par
  empreinte, puis signature de Cua AI, rien d'autre installé sur le Mac) ;
  image `trycua/macos-tahoe-cua:26.5.2` (ou 26.2, ou `macos-sequoia-cua:15.3`
  selon le macOS du poste, la virtualisation d'Apple refusant un invité plus
  récent), environ 23 Go, cache effacé après téléchargement ; démarrée par
  `lume run --detach --display none --shared-dir ~/Helix/Machine:rw`, vue
  dans la machine sous `/Volumes/My Shared Files` ; serveur cua sur le port
  8000 de l'adresse que donne `lume get -f json`, réseau que seul ce Mac voit.
  Au premier démarrage, LibreOffice 25.8.6.2 (empreintes vérifiées) installé
  dans la machine avec les préréglages du bureau Linux, plus les boîtes
  d'enregistrement de LibreOffice (celles de macOS n'acceptent pas un chemin
  tapé). Raccourcis en Commande, applications en liste fermée (Safari, Writer,
  Calc, Impress, Finder, Terminal, `open -a` filtré sinon), relecture des
  documents faite sur le poste (`relecture.ts`, Python n'étant pas garanti
  dans la machine). « Effacer la machine » (Linux et macOS) rend la place.
  **Jamais démarrée de bout en bout** : le Mac de développement a 16 Go.
  Vérifié : installation de Lume (dans un dossier d'essai), diagnostic sur ce
  Mac (refus justifié), refus côté serveur, écran de choix et de
  confirmation, relecture sur des fichiers d'essai.
- *Chats sans la limite du navigateur* (24/09/2026) : dans l'application de
  bureau, la collection `sessions` quitte `localStorage` (environ 5 Mo) pour un
  fichier chiffré par `safeStorage`, `~/.helix/poste/sessions.enc`, 0600,
  écrit par renommage (`electron/grandStockage.cjs`, `src/lib/store/grandStockage.ts`,
  lu d'un coup au démarrage comme le coffre). Repris de `localStorage` au
  premier passage, puis libéré là-bas. Place d'import : 25 Mo (l'instance
  accepte 32 Mo par envoi) au lieu de 3,5 ; navigateur : inchangé.
  **Incident le jour même** : l'application a été reconstruite pendant
  qu'elle tournait ; au redémarrage, la liste des Chats du client a été
  remplacée par « [] » sur le poste puis sur l'instance (1 Chat, « ça va ? »).
  Non reproduit sur une copie exacte de ses données (la migration seule ne
  perd rien) ; cause la plus probable : processus mêlant deux versions.
  Rattrapé depuis le journal LevelDB du navigateur, avec « test » (11
  messages), perdu dès 10 h 30 par l'ancienne synchronisation (l'instance
  vide avait écrasé le poste). Correctifs : la copie du navigateur n'est
  effacée qu'après écriture confirmée du fichier ; écriture refusée → retour
  au stockage du navigateur pour la séance ; préchargement tolérant un
  processus principal sans ce canal ; une liste qui fond de plus de moitié
  laisse une copie chiffrée à côté (`sessions.<date>.copie.enc`, trois au
  plus). Règle : ne jamais reconstruire l'application pendant qu'elle tourne.
- *Mémoire de Qwen3 8B* (24/09/2026) : une requête à la fois sur un poste de
  16 Go ou moins, deux jusqu'à 36 Go, et **32 768 jetons de contexte au moins**
  (`optionsDeChargement`, backends.ts). Le matin, 16 384 avait été choisi pour
  gagner de la mémoire : Code en est mort l'après-midi, les consignes
  d'OpenCode faisant à elles seules environ 18 000 jetons.
- *Créer des images* (24/09/2026, `gateway/src/images.ts`, puce « Image » du
  Chat, `ImageChip.tsx`) : comme ChatGPT ou Gemini, sur la machine. Moteur
  stable-diffusion.cpp (MIT, sans Python ; Mac Metal, Windows CUDA ou Vulkan,
  Linux Vulkan ; version pour macOS 15 à part, l'actuelle exige macOS 26),
  modèle Z-Image Turbo (Apache 2.0) avec Qwen3 4B pour lire la description
  (Apache 2.0) ; trois tailles selon la mémoire (léger 5,6 Go dès 8 Go,
  standard 6,7 Go dès 16 Go, fin 10,2 Go dès 32 Go ou carte de 12 Go), chaque
  fichier pris à une révision et vérifié par empreinte, téléchargement repris
  après coupure. La description est réécrite en anglais par le modèle local
  (Z-Image rend mieux ainsi) ; avant le calcul, les modèles de conversation au
  repos sont déchargés si la mémoire manque (`libererPourImage`). Image rangée
  dans les données de l'instance, servie à son auteur seul (un Chat partagé ne
  la montre pas aux collègues), référencée dans le Chat. Mesuré sur un Mac M4
  de 16 Go : 1024 px en 6 min 15, 768 px en 2 min 27 (15 s par étape) ; le
  niveau standard crée donc en 768, le fin en 1024. Essayé de bout en bout
  dans l'écran (installation, image paysage, réouverture du Chat) ; Windows et
  Linux pas essayés.
- *Images, plusieurs modèles* (24/09/2026, suite) : le « + » de la zone de
  saisie ouvre un menu comme ChatGPT (« Ajouter des photos et fichiers »,
  « Créer une image ») ; « Créer une image » pose une pastille « Image × »
  dont le menu règle le format et le modèle. Catalogue (tous Apache 2.0) :
  Z-Image Turbo (conseillé dès 16 Go, trois tailles), FLUX.2 klein 4B (le plus
  rapide, conseillé sous 16 Go ; vérifié : 1 min 42 sur le Mac M4, image nette,
  texte dans l'image illisible), Qwen-Image 20B (texte lisible dans l'image,
  dès 48 Go ou carte de 24 Go ; pas vérifié, faute de machine). Chaque modèle
  s'installe au clic, on choisit l'actif (`/helix/images/choisir`).
- *Import depuis les logiciels du poste* (24/09/2026, `gateway/src/importLocal.ts`,
  carte « Depuis les logiciels de cet ordinateur » de Paramètres > Importer
  depuis d'autres IA) : Helix trouve Claude Code (conversations
  ~/.claude/projects, dossier de travail, titre, CLAUDE.md) et Codex
  (~/.codex/sessions, AGENTS.md) et les reprend sans export, par le même
  chemin que l'import d'une archive (choix des Chats, projets par dossier de
  travail, instructions en agent « Comme dans … »). Dit franchement ce qui ne
  se lit pas : ChatGPT (conversations chiffrées sur le disque), Claude
  (conversations sur les serveurs d'Anthropic), Cursor (sa base). Seulement
  depuis le poste lui-même (adresse de boucle locale). Essayé : 20 Chats
  Claude Code et 6 Codex détectés sur le Mac du client, liste Codex affichée.
- *Extension VS Code* (24/09/2026, `extensions/vscode/`, `helix-ai-0.1.0.vsix`,
  21 Ko, sans dépendance) : Chat de l'instance dans la barre latérale (joindre
  le fichier ouvert, insérer un bloc de code), « Expliquer » et « Améliorer la
  sélection » au clic droit. Parle à l'instance depuis le processus de
  l'extension (le jeton ne va jamais dans la page), jeton lu dans
  ~/.helix/data/instance-token ou réglé (instance d'entreprise). Essayé avec
  un faux module vscode contre une vraie instance : « Améliorer » a trouvé et
  corrigé un bug, 57 s avec Qwen3 8B. **0.2.0** : onglet « Code » (Helix Code
  sur le dossier ouvert : session, flux d'évènements, actions affichées « ✓
  Écriture bonjour.txt »), connexion « Helix : se connecter » (compte, mot de
  passe, second facteur ; séance dans le coffre de VS Code). Essayé : Helix
  Code a créé le fichier demandé via l'extension ; installée dans le VS Code du
  client (1.111), vue affichée et activée sans erreur. Pas de question tapée
  dans VS Code par moi (saisie interdite dans un éditeur) : à faire par le client.
- *Import Cursor* : base `state.vscdb` lue par `sqlite3` (formats ancien
  « conversation » et récent « bubbleId: », texte enrichi compris), vérifié sur
  une base fabriquée ; le poste du client n'a que des brouillons vides.
- *Dépôt GitHub* : https://github.com/medhiclb/HelixAI, privé, vide (24/09/2026).
- *Design des sites de Code* (24/09/2026, `gateway/src/design.ts`,
  `gateway/design/`) : une demande de site fait poser par Helix
  `design/helix.css` et `design/DESIGN.md` dans le projet, choisis dans les
  tables du skill UI/UX Pro Max (nextlevelbuilder, MIT, licence gardée à côté) :
  type d'activité reconnu (lexique français, mots-clés du modèle local, mots
  génériques d'un site écartés), palette complète, polices, plan de page, cinq
  familles de style (sobre, vif, doux, verre, sombre). La consigne jointe à la
  demande donne les lignes du <head> et la structure. Mesuré avec Qwen3 8B : il
  n'a pas ouvert le guide et a écrit ses propres classes. D'où deux filets :
  la feuille habille aussi le HTML sans classes (en-tête, sections, cartes,
  formulaire, pied) et les noms courants (hero, card, btn, container) ; et,
  à la fin de chaque tour de Code (« step.ended / stop » dans le flux), Helix
  remet dans chaque page le lien relatif vers la feuille et les polices, la
  feuille en dernier pour qu'elle l'emporte sur un <style> du modèle
  (`corrigerPages`). La même page, avant et après : texte brut sur fond bleu,
  puis une vraie page de boulangerie.
- *Eden et Helix sur le même Qwen3 8B* : le garde d'Eden (script du client,
  hors Helix) recharge Qwen3 8B à ses propres réglages quand il le trouve
  autrement ; s'il le fait pendant une réponse d'Helix, la réponse est coupée
  (vu le 24/09 : « Invalid helix/openai-compatible-chat stream event » dans
  Code). Helix ne touche pas au garde d'Eden.
- *LM Studio partagé* : une instance qui s'arrêtait coupait le serveur LM
  Studio sous les autres (autre instance, Eden) : à la fermeture, Helix ne
  décharge plus que ses propres modèles, au repos, et laisse le serveur. Et
  faire de la place ne décharge plus un modèle en train de répondre (attente
  45 s au plus).
- *Sous-menu « Installer un modèle sur cette machine »* : la liste principale
  ne montre que les modèles présents ; les modèles à ajouter sont un cran plus
  loin (retour par la flèche), pour ne pas encombrer.
- *Graphique et modèles cloud* : un modèle branché plus tard (prestataire ou
  clé) se place tout seul s'il figure au relevé. Rapprochement durci : versions
  à tirets reconnues (« claude-fable-5-1 »), mais un nom qui continue par un
  chiffre ou une déclinaison (« claude-opus-5-5 », « …-flash-lite », « -mini »)
  n'emprunte plus la note d'un autre modèle.
- Trois modèles d'essai retirés du Mac du client (mis à la corbeille le
  23/09/2026, 13 Go) : gemma-3-4b, qwen3-8b-dwq, qwen3-vl-8b.
- *Saisie* : au focus, bord gris un peu plus foncé et ombre un peu plus large.
- *Services connectables* : le modèle reçoit la liste des services non encore
  connectés (messagerie, agenda, Drive, Slack) et sait dire « oui, connectez-la
  dans Paramètres, Connecteurs » sans prétendre y avoir accès. Vérifié sur
  qwen3-8b avec la phrase exacte du client.
- Les six modèles de la liste n'ont pas été installés par cette version : ils
  sont sur le disque depuis juin et juillet 2026 (essais du contrôle de
  l'écran). La liste les montre depuis 0.27.0 parce qu'ils sont réellement
  utilisables.

Demandé par le client : « un tour complet, que tout fonctionne, aucun bug, la
sécurité, le design, tout ». Ce qui a été trouvé, et comment.

**Le Chat qui ne répondait pas, ou répondait « je n'ai pas l'information ».**
Trois causes, toutes reproduites avant d'être corrigées.

1. *Le niveau de raisonnement plafonnait la réponse.* Censé relever un
   plancher de jetons, il posait `max_tokens` même quand l'écran ne demandait
   rien : 768 en « Faible », 2 048 en « Moyen ». Qwen3 dépense ce budget à
   réfléchir, et la réponse sortait coupée ou vide. Reproduit contre LM Studio
   (`finish_reason: length`). Le plancher ne s'applique plus qu'à une demande
   explicite.
2. *Les images partaient vers un modèle qui ne voit pas.* LM Studio ne liste par
   son API que les modèles chargés ; trois modèles de vision dormaient sur le
   disque, invisibles. Une capture d'écran en mode Auto allait donc à
   `qwen3-8b`. La passerelle voit maintenant tous les modèles téléchargés (avec
   leurs capacités telles que LM Studio les déclare), envoie les images à un
   modèle de vision, le charge à la volée en le disant, et prévient si aucun
   n'existe au lieu de faire semblant. Essai réel : la capture « Santé de la
   batterie » est lue (83 %, 612 cycles).
3. *Le modèle fouillait les Fichiers au lieu de répondre.* Quatre recherches
   pour une question générale sur un iPhone, relevées au journal d'audit. Les
   consignes disent maintenant de répondre directement aux questions
   générales, et une recherche vide dit au modèle quoi faire ensuite. Essai
   réel : aucune recherche, une vraie réponse.

Et, garantie de dernier recours : une réponse vide s'affiche désormais comme
telle, avec quoi faire, au lieu d'une bulle blanche.

**Les niveaux de raisonnement n'agissaient pas sur le modèle local.** Mesuré :
`reasoning_effort` « low » et « high » donnaient la même réflexion (232 et 263
jetons), et `enable_thinking` n'était pas transmis par LM Studio. Les leviers
qui marchent sont maintenant employés : `/no_think` pour « Aucun » (0 jeton,
2 s), une consigne de profondeur pour les autres. Mesuré sur une même
question : Aucun 2 s, Faible 11 s, Moyen 28 s. « Élevé » et « Max » ne vont pas
plus loin que « Moyen » sur ce modèle, qui réfléchit déjà beaucoup par
défaut : on le dit plutôt que de le promettre.

**L'écran Code, état final (23/09/2026, après vérification complète).** Ce qui
suit corrige les deux paragraphes plus bas, écrits trop tôt.

- *Le défaut d'OpenCode* : il rate au hasard la **première** session qu'il
  exécute après son démarrage (« Model unavailable »), en 1.18.3 comme en
  1.18.32 : 2 à 3 démarrages sur 10, jamais les sessions suivantes (21 sur 21).
- *La chauffe* (`chauffer`, opencode.ts) : à chaque démarrage d'OpenCode, une
  session jetable sur un modèle inexistant absorbe ce premier passage, sans
  appeler aucun modèle, puis est supprimée. Mesuré : 30 démarrages sur 30,
  contre un raté sur dix pour le témoin au même moment.
- *La détection* (`handleCodePrompt`, index.ts) : une demande saine atteint le
  modèle en 0,1 à 0,2 s — la passerelle le voit, puisqu'elle relaie l'appel.
  Sans cet appel au bout de 8 s, la session est perdue : une neuve est ouverte,
  la demande y est renvoyée, et l'écran suit la nouvelle (`helixRelance`).
  Seul compte l'appel qui porte les outils de l'agent : OpenCode envoie aussi,
  pour la même demande, un appel sans outils qui génère le titre, et le
  compter faisait passer pour vivante une session morte (vu au banc).
- *Ce qui avait été posé à tort* : un guet côté écran, qui tenait une session
  pour morte sans « première étape » en 12 s. Cette étape n'arrive qu'après la
  lecture des longues instructions d'OpenCode par le modèle — mesuré : 16 s. Il
  aurait relancé, en double, des demandes simplement lentes. Retiré.
- *Preuves* : 8 démarrages à froid sur 8 suivis jusqu'à la réponse (9 à 17 s) ;
  une session rendue morte à coup sûr est relancée en 8 s et répond ; une
  demande qui écrit un fichier aboutit, l'interruption fonctionne.
- *OpenCode mis à jour en 1.18.32* (22/09/2026), après avoir vérifié par la
  passerelle un parcours identique à la 1.18.3 (mêmes événements, outils,
  interruption). L'ancienne version reste à côté :
  `~/.opencode/bin/opencode-1.18.3`. `HELIX_OPENCODE_BIN` permet de fixer une
  version pour Helix indépendamment de celle de la personne.
- *Un défaut que ces essais ont révélé, et corrigé* : la passerelle lisait
  l'état « chargé » des modèles par `lms ps`, qui dépasse son délai quand LM
  Studio est occupé. Tout passait alors pour non chargé, et un modèle déjà en
  mémoire était rechargé en **seconde copie** (« qwen3-8b:2 », 5 Go de plus) :
  la machine saturait. Ce que l'API de LM Studio liste est désormais tenu pour
  chargé, et aucun chargement n'a lieu sans avoir vérifié que le modèle n'y
  est pas déjà — ni quand on ne peut pas le vérifier.

**L'écran Code où « rien ne se passait » — la vraie cause, trouvée ensuite.**
Le client a revu le silence après la première correction ; l'explication
ci-dessous était donc incomplète. Mesures faites ensuite, chacune contre un
OpenCode isolé : **OpenCode 1.18.3 rate au hasard la toute première demande
qui suit son démarrage** (« Model unavailable », environ une fois sur trois,
jamais à la demande), et la session meurt sans rien émettre après l'accusé de
réception. Écartés un à un par l'essai : la configuration, la clé, la liste des
modèles, le dossier `~/Helix`, l'environnement Electron, le téléchargement de
models.dev, la course au démarrage de la passerelle. Ce n'est pas corrigeable
chez nous ; l'écran ne le subit plus : sans première étape au bout de 12
secondes (une demande saine l'annonce en une seconde, avant même d'appeler le
modèle), il ouvre une session neuve et renvoie la même demande, une fois, et
le dit. Prouvé en provoquant la panne dans le navigateur (demande avalée) :
relance à 12 s, réponse obtenue. Au passage, OpenCode ne contacte plus
models.dev à chaque démarrage, ne se met plus à jour seul, ne publie plus de
liens, et ne lit plus la configuration Claude Code du poste
(`OPENCODE_DISABLE_*` dans `opencode.ts`), vérifié sans effet sur ses réponses.

Ce qui avait été corrigé avant, et reste vrai : OpenCode ne lit sa
configuration qu'à son démarrage : si un modèle manquait à ce moment-là, toute
session sur ce modèle était acceptée puis restait muette pour toujours — son
flux annonce « admis » et se tait, l'erreur ne part que dans son journal
(reproduit sur un OpenCode isolé). La passerelle vérifie maintenant le modèle
auprès d'OpenCode avant d'ouvrir la session, le redémarre si sa configuration
est périmée, et refuse avec une raison sinon. L'écran signale en plus tout
silence de plus de 90 secondes. Seconde cause : le découpage des tâches de
Helix s'appliquait aussi aux requêtes d'OpenCode et glissait ses événements
maison dans le flux, que le SDK d'OpenCode rejetait
(`AI_TypeValidationError`). Un client ordinaire de l'API reçoit désormais un
relais propre. Enfin, un garde-fou contre les boucles : à trois actions
identiques de suite, une note au modèle ; à cinq, les outils lui sont retirés
pour la réponse suivante.

**Le téléchargement direct**, marqué « bientôt », fonctionne : l'instance sert
une archive de l'application qu'elle fait tourner (`telechargement.ts`), dans
sa version exacte, sans passer par Internet ; le lien porte un billet d'une
minute et d'un seul usage. Pour Windows et Linux, l'écran dit que l'instance
ne sert que l'application macOS et renvoie au paquet du prestataire (27/09/2026). L'écran explique le clic droit → Ouvrir, tant que l'application
n'est pas signée.

**La sécurité, attaquée plutôt que relue** : `npm run securite` lance une
instance jetable et frappe à chaque porte (66 vérifications en 0.27.0, 125 le
25/09/2026, toutes réussies : routes sans
jeton ou sans séance, énumération de comptes, force brute, billets réutilisés,
CORS, en-têtes, chemins détournés, fin de séance, secrets au journal, écoute
réseau). Elle a trouvé un vrai défaut : une variable `HELIX_GATEWAY_HOST` vide
faisait écouter la passerelle **sur toutes les interfaces**, sans chiffrement,
alors qu'elle se croyait locale — prouvé, puis fermé. Et `npm audit` : cinq
vulnérabilités connues dans des dépendances (SDK MCP, module de mise à jour),
corrigées sans saut de version majeure ; zéro restante.

**Les traductions**, reprises : le catalogue des connecteurs et la liste des
outils venaient de la passerelle sous forme de données et restaient en
français dans l'interface anglaise, alors que le relevé annonçait 100 %. Le
relevé lit maintenant ces données. Deux phrases étaient figées en français
parce que calculées au chargement du module ; un outil les détecte. Et le nom
de marque, lu trop tôt, faisait écrire « Livré avec l'application ».

**Le tour de l'interface** : 23 écrans parcourus, relevé automatique des
débordements, textes coupés, images cassées et erreurs, en français, anglais
et chinois. Aucun défaut d'affichage. Corrigé au passage : l'accueil saluait
par l'identifiant (« Bonjour, prenom.nom ») au lieu du prénom.

### Fait le 25/09/2026 : bases de connaissances, ligne de commande, entraînement, corrections

Quatre branches fusionnées dans main le même jour. Les décisions sont aux § 3.10,
3.11 et 3.12, la sécurité au § 4 et dans SECURITE.md § 22.

**Bases de connaissances (RAG).** Onglet « Bases de connaissances » dans Fichiers,
pastille « Connaissances » de la zone de saisie (Chat et Cowork), bases d'un agent et
d'un projet, sources citées sous la réponse. Mesuré par la branche le 25/09/2026 (Apple
M4, passerelle d'essai, quatre documents fictifs, `text-embedding-nomic-embed-text-v1.5`
et `qwen3-8b` déjà chargés) : 309 morceaux indexés en 16,1 s, environ 24 par seconde ;
sur 10 questions dont la réponse n'est que dans les documents, le bon passage au rang 1
dix fois sur dix en hybride (neuf par le sens seul) ; 12 à 20 ms par question à chaud,
361 ms à froid ; au Chat, 9 réponses justes sur 9, chacune citant [1], et à la question
sans réponse, « les passages n'en parlent pas » sans citation ; question de suite « Et
pour un employé ? » juste. Second compte : base privée ni listée, ni lisible, ni
cherchable ; base ouverte mais documents privés, 0 document nommé, 0 passage. Index en
0600, chiffrés (en-tête `HLXF1`), 1,1 Mo pour 300 morceaux.
**Essayé de bout en bout dans l'interface le 25/09/2026**, par la personne qui a
fusionné : base créée, deux documents indexés par
`text-embedding-nomic-embed-text-v1.5`, recherche d'essai correcte, puis un Chat avec la
base attachée a répondu juste (27 jours de congés, baguette à 1,30 euro) avec les deux
sources citées sous la réponse.
*Pas essayé* : Cowork avec des bases (outils actifs) ; de vrais PDF et documents Office
(seuls des fichiers texte ont été indexés) ; une vraie base de 100 000 morceaux (seule
la boucle de recherche a été mesurée) et la mémoire de l'application avec un gros
cache ; la reprise de l'indexation après un arrêt en plein travail ; l'effet des
préfixes `search_document:` / `search_query:` ; PostgreSQL comme magasin ; l'instance
empaquetée, Windows et Linux.

**Ligne de commande `helix`.** `helix` (Chat interactif), `helix chat "question"` (aussi
par un tube), `helix chat --outils` (outils de l'instance, séance requise),
`helix code` sur le dossier courant, `connexion`, `deconnexion`, `modeles`, `outils`.
Installation sur un poste qui a le dépôt : `npm link` ou `node cli/helix.mjs`.
Vérifié par la branche le 25/09/2026 : `npm run essai:cli` 31 sur 31 sans modèle, 41 sur
41 avec qwen3-8b (écriture mise en attente d'accord, refusée puis accordée au
pseudo-terminal par « o » ; Code écrit `bonjour.txt` au bon contenu ; Ctrl+C rend la
main). Connecteurs dans Code : route connectée et appelée depuis l'ancienne API
d'OpenCode, **pas proposée par la nouvelle** (§ 3.11).
*Pas essayé* : une vraie demande d'accord par un connecteur (Drive, Slack, courrier) et
le mail affiché en entier dans la carte ; la double authentification au terminal ; une
instance d'entreprise en https à certificat auto-signé (Node le refuse, il faudrait
`NODE_EXTRA_CA_CERTS`) ; Windows ; le refus « deux personnes en même temps » de
`outilsCode.ts` (seul « session inconnue » a été observé) ; qu'OpenCode cesse vraiment
d'écrire après Ctrl+C. La ligne de commande ne parle que français (textes dans
`cli/textes.mjs`).

**Entraîner un modèle.** Paramètres > Entraîner un modèle, quatre étapes. Vérifié par
la branche le 25/09/2026 (Mac mini M4, 16 Go, macOS 27) : moteur installé par la route
en 15 s (34 paquets vérifiés par empreinte, 435 Mo), Qwen3 1.7B téléchargé (4,06 Go en
3 min 15, empreintes conformes) ; de bout en bout, 26 exemples appris et 4 mis de côté,
entraînement en 2 min 38 (2 min 43 annoncées), erreur sur les exemples mis de côté de
4,05 à 0,022, 8 faits justes sur 8 à la comparaison ; installé dans LM Studio en 9 s
(1,84 Go), puis interrogé par le Chat de Helix : réponse juste ; retrait complet. Arrêt
en plein calcul, par le bouton ou par l'arrêt de la passerelle : rien de laissé, le
modèle précédent gardé. Chemin GGUF (celui du PC NVIDIA) essayé sur le Mac : conversion
Q8_0 en 19 s, mêmes réponses.
**Vérification du 25/09/2026 par la personne qui a fusionné** : écran vu ; « Tirer des
exemples d'un document » essayé avec Qwen3 8B : l'ancienne consigne ne rendait que 2
paires sur un règlement de 5 faits ; consigne corrigée (« Couvre chacun des faits »),
8 paires couvrant les 5 faits. L'installation du moteur (4 Go) et un entraînement
complet **n'ont pas été refaits** dans cette vérification.
*Pas essayé* : tout le chemin NVIDIA sauf la conversion GGUF (PyTorch CUDA, QLoRA,
comparaison et fusion par peft) ; Qwen3 0.6B et Qwen3 4B Instruct 2507 (empreintes
relevées, jamais téléchargés en entier ni entraînés) ; Windows, Linux, macOS 14 et 15 ;
un vrai refus d'empreinte par pip ; des jeux de centaines d'exemples ; deux personnes à
la fois sur une instance partagée.

**Images d'un Chat partagé** (ancien point 12). Une image se voit par son auteur et par
qui voit le Chat où elle a été créée ; toute autre demande reçoit 404. Relevé
« image vers Chats » gardé en mémoire : mesuré le 25/09/2026 sur 2 000 Chats de 40
messages (164 Mo), 930 à 1 025 ms pour le refaire, puis 0,3 ms. Les images d'un compte
effacé partent avec lui (elles restaient sur le disque). Vérifié par `npm run securite`
avec de fausses images posées à la main ; *pas essayé* : une vraie image créée puis vue
par un collègue sur un second poste. L'image n'apparaît au collègue que si le Chat a été
synchronisé vers l'instance.

**Import par morceaux** (ancien point 14). La liste arrive par pages de 50 conversations
(ou 64 Mo de fichiers) lues ligne à ligne, les plus récentes d'abord, 5 000 au plus ;
seul le contenu des Chats choisis est ensuite chargé, par lots, **avant** la création
des projets et des agents. Mesuré le 25/09/2026 sur un jeu factice de 2 000
conversations Claude Code (4,7 Go, HOME jetable) : 2 000 proposées au lieu de 500, boucle
de la passerelle bloquée 9 à 14 ms au pire au lieu de 1 372 à 1 588 ms, mémoire au pic
109 à 173 Mo au lieu de 295 Mo, première page en 0,1 s. Une clé inventée
(`claude-code:../../etc/passwd`) est ignorée. Cursor : `sqlite3` ne bloque plus la
passerelle. **Vu à l'écran le 25/09/2026** : 5 lots pour Claude Code, 19 Chats listés ;
Cursor, à 0 conversation, a son bouton désactivé. *Pas essayé* : Cursor sur une vraie
base, Codex (même code, pas mesuré).

**Douze défauts de ce qui avait été ajouté le 24/09, corrigés.** Registre des images
illisible réécrit par-dessus (désormais mis de côté, `index.<date>.illisible.json`) ;
installation d'images sans progression ; modèle d'image retiré pendant la préparation
d'une création ; images d'un compte effacé gardées ; import Cursor affiché
« undefined » ; textes hors traduction ; **fichier des Chats illisible écrasé sans
copie** (le schéma de la perte du 24/09, sans prétendre que c'en était la cause :
désormais copie `sessions.<date>.illisible.enc`, et `sync.push` ne pousse pas une
collection illisible tant que l'instance ne l'a pas rendue ; vérifié avec un faux module
electron, 50 Chats récupérables au lieu de perdus, **pas essayé dans l'application de
bureau**) ; design posé sur un site existant (ne se pose plus que dans un dossier sans
page ni feuille de style) ; relecture d'un classeur qui avalait la cellule suivant une
cellule vide mise en forme ; onglet Code de VS Code muet ; flux Code de VS Code laissé
ouvert ; changement de système pendant la préparation de la machine (refusé, 409). Les
défauts 1, 2, 3 et 12 ont été corrigés sur lecture du code, sans reproduction ; le
paquet `.vsix` n'a pas été refait ; rien n'a été lancé dans VS Code.

**Interface et traductions.** À l'écran, la Bibliothèque s'appelle « Fichiers » : les
nouveaux textes le disent (« Ajouter depuis Fichiers », etc.). Durées et similarités
s'affichent avec la virgule décimale de la langue (`toLocaleString`). Trois messages
d'erreur gardés avec un document (`d.erreur`) sont déclarés dans `PHRASES_GARDEES`, en
fin de `gateway/src/connaissances.ts`, pour que `scripts/i18n-passerelle.mjs` les
relève. Catalogues le 25/09/2026 : interface 2 301 phrases, passerelle 650, anglais et
chinois à 100 %. `npm run securite` : 125 contrôles, tous réussis.

**Employés OpenClaw et bases de connaissances** (ancien point 18, § 3.10). Les bases
d'un agent sont recopiées sur son employé (`Employe.connaissances`, par l'écran du
propriétaire, `useMiseEnService.ts`) ; l'employé a l'outil `connaissances__chercher`
dès qu'il en a (même sans « Autoriser les outils »), refusé aux messageries comme ses
autres outils Helix sauf si on les leur ouvre ; sa fiche de poste lui dit de chercher
avant de répondre et de citer le document, sans nommer les bases. L'écran de l'agent
le dit en une phrase (création et « Connaissances de … »).
Mesuré le 25/09/2026 sur ce poste (Mac mini M4, 16 Go), passerelle d'essai sur le port
8897 avec données et dossier personnel jetables, instance OpenClaw 2026.9.4 d'essai sur
le port 18897 (ni `~/.openclaw`, ni l'instance de l'application), `qwen3-8b` et
`text-embedding-nomic-embed-text-v1.5` déjà chargés dans LM Studio : un agent à trois
bases (« Agence », ouverte à l'équipe, avec une grille tarifaire, un règlement et une
note privée de sa propriétaire ; « Perso Alice », privée ; « Paie », ouverte par une
collègue mais contenant son dossier de salaire privé). Déploiement 8,9 s. « Combien coûte
une traduction de 2 000 mots livrée en urgence ? » : outil appelé, 2 passages, réponse
juste (240 + 30 % = 312 euros) « (source : Grille tarifaire 2026.txt) », en 84 s. Une
mission lancée à la main (« trois heures de relecture, remise fidélité ») : compte rendu
juste (135 euros, 8 % dès le dixième projet) avec la source, en 80 s. « Quel est le
salaire annuel de Bruno ? », demandé par Bruno lui-même, et « le code du coffre
d'Alice ? », demandé par Alice : « les documents n'en parlent pas », aucun secret ;
appelé en direct, l'outil ne cite que les deux documents ouverts. Le journal dit
`outil.appele`, `bases: 3`, `passages: 2`, sans la question.
`npm run securite` : 140 contrôles, tous réussis (15 de plus, section 6 ter, avec un
faux modèle d'embeddings et un faux OpenClaw). Catalogues : interface 2 302 phrases,
passerelle 650, anglais et chinois à 100 %. *Pas essayé* : une messagerie (Telegram…)
avec `outilsEntreprise` ouvert ; une base de groupe (exclue par la règle, non
vérifiée à l'écran) ; l'écran lui-même (la recopie des bases par `useMiseEnService`
n'a été éprouvée que par la route, pas dans l'application de bureau) ; de gros
documents. Constaté : qwen3-8b écrit encore du gras Markdown malgré la consigne, et à
une troisième question de la même conversation il a répondu sans rappeler l'outil
(juste, les passages étaient dans la conversation). L'instance OpenClaw de
l'application (port 18800) a redémarré à 10 h 23, avant que la passerelle d'essai
n'existe (10 h 28) : sans lien avec l'essai.

**Employés et bases partagées à un groupe** (l'après-midi du 25/09/2026, § 3.10). Un
employé personnel dont rien ne sort vers d'autres que son propriétaire lit aussi les
bases partagées aux groupes de ce propriétaire ; l'écran « Connaissances de … » dit ce
qu'il lira, base par base, et pourquoi pas le reste (`LectureBases.tsx`,
`POST /helix/employes/<id>/connaissances`). La carte d'un employé sans agent disait
« Organisation » même pour un employé personnel : corrigé. Vérifié le 25/09/2026 :
`npm run securite` 167 contrôles, tous réussis (14 de plus en section 7 ter : lecture du
groupe, rien du groupe étranger ni du privé, fermeture dès l'élargissement par la
visibilité, les outils, la liberté, une messagerie Telegram, la sortie du groupe, et
réouverture quand la condition revient). De bout en bout sur ce poste, passerelle
d'essai sur 8899 (données jetables) et OpenClaw 2026.9.4 d'essai sur le port 18877
(dossier temporaire ; ni `~/.openclaw`, ni 18789, ni 18800), `qwen3-8b` et
`text-embedding-nomic-embed-text-v1.5` déjà chargés : base « Base Compta » partagée au
groupe Compta, avec la grille du groupe et une note privée d'Alice ; l'employé
personnel d'Alice répond « PAPAYE-3150 (source : Tarifs-Compta.txt) » en 108 s, et au
code du coffre d'Alice « ne figure pas » (en 21 s, en inventant au passage un nom de
document, « Règles-Compta.txt ») ; ouvert à l'organisation, la même question posée par
Bruno ne ramène rien (journal : `regle: "equipe"`, 0 passage), et « cherche dans ta
mémoire » non plus (l'employé n'avait rien noté). Écran vu dans le navigateur (instance
jetable) : agent personnel sans outils, « lue : 1 document(s) sur 2 » ; agent
d'organisation avec outils, deux raisons et « non lue : partagée à des groupes ».
*Pas essayé* : dans l'application de bureau ; sur une messagerie réelle ; un
employé qui a noté un passage de groupe dans sa mémoire puis est ouvert à l'équipe.

**Fichier des Chats illisible : le bandeau, et le bilan d'import** (anciens restes du
point 21). Un bandeau par-dessus l'écran dit ce qui s'est passé, où est la copie, ce
que l'instance a répondu, et quoi faire (`AvisChatsIllisibles.tsx`). La copie
`.illisible.enc` est faite dès la lecture ; un fichier qu'on n'a pas pu copier n'est
jamais remplacé ; le blocage de la poussée survit à un rechargement de la fenêtre. Au
bureau, le bilan d'import attend l'écriture du fichier et dit si les Chats sont dans
le fichier, dans le stockage du navigateur ou seulement en mémoire, et si l'instance en
a la copie ; quand le navigateur refuse aussi, la mémoire reste la source de lecture
(avant, la liste lue redevenait l'ancienne, et la poussée suivante l'aurait envoyée).
**Vu le 25/09/2026 dans l'application de bureau** (Electron de développement, profil
d'essai `HELIX_PROFIL_ESSAI`, `HELIX_DATA_DIR` temporaire, passerelle jetable sur 8898,
jamais `~/.helix/poste`) : fichier remplacé par des octets quelconques → copie faite au
démarrage, bandeau, trois Chats rendus par l'instance ; instance coupée → « pas
joignable », rien poussé ; dossier des Chats non inscriptible et stockage du navigateur
rempli → import de deux Chats par l'écran : « ils ne sont qu'en mémoire […] L'instance
en a reçu la copie ». *Pas provoqué* : le trousseau refusé ou verrouillé. Une sonde
lancée avec un dossier personnel d'essai est restée bloquée (sans doute une demande du
trousseau à l'écran) et a été arrêtée au bout d'une minute ; les essais ont ensuite
gardé le vrai dossier personnel ; dans `~/.helix`, l'application d'essai n'écrit que le
fichier du thème (`electron/main.cjs`, `fichierTheme`), réécrit à 15 h 32 avec la même
valeur, « clair ».

### Ce qui reste à essayer sur les postes de Medhi

*Regroupé le 28/09/2026 (2026.928.1), à partir des entrées « À essayer » et « Pas vérifié »
des 26 et 27/09 plus bas, qui gardent le détail. Tout ce qui suit est écrit et vérifié ici
contre des doublures (faux moteur, faux fournisseurs, faux `codex`, faux OpenCode, Windows
simulé) ; rien de cela n'a tourné sur la vraie machine.*

**Palmier Pro (29/09/2026, § 3.5)** : sur un Mac à puce Apple en macOS 26, installer Palmier Pro
dans Applications, l'ouvrir avec un projet, cliquer « Brancher » dans Connecteurs. À voir :
la reconnaissance par la signature réelle (identifiant `io.palmier.pro`, équipe `MMFLRC7562`),
le nombre d'outils listés, une lecture de la timeline sans carte, un ajout de plan avec carte,
une génération (carte « hors de cette machine », crédits du compte), Palmier Pro fermé puis
rouvert et « Réessayer ».

**Parcours à l'écran du 28/09/2026 (2026.928.6)**, interface en serveur de développement
contre une instance jetable et un faux modèle compatible OpenAI (flux, réflexion, appels
d'outils, 429, 500, coupure), en français, anglais et japonais, clair et sombre, 1280 et
375 px. Vu marcher : mise en route (poste autonome, premier compte), connexion, mot de passe
refusé, Chat (flux, réflexion, arrêt, erreurs dites, outils avec carte d'accord, pièces PDF,
image et texte, recherche web activée sans envoi, choix du modèle, Comparer, renommer,
recherche), Cowork (accord refusé), Code (carte d'accord d'une commande, faux OpenCode),
Tâches (colonne repliable, compte rendu : agrandir, copier, télécharger intercepté), agents
(création avec son modèle, changement de modèle), Fichiers (import, recherche dans le
contenu d'un PDF), Réunions (écran seul), Réglages (langue, thème, usage), deux onglets,
rechargement pendant une réponse, passerelle coupée puis revenue. Corrigé ce jour-là :
synchronisation (deux envois simultanés d'une collection, relecture pendant une écriture,
coupure derrière un relais, renommage perdu après rechargement), question perdue au
rechargement, « Ajouter un compte » sans issue, puces coupées à 375 px, tableau de
Comparer, textes hors traduction, aide des Chats. **Pas essayé** : avec un vrai modèle, dans
l'application de bureau (où le jeton d'instance reste dans l'adresse ; en serveur de
développement, un rechargement à chaud le perd et déconnecte, sans conséquence hors
développement), le parcours de l'invité sur un second poste (l'instance d'essai n'était pas
ouverte au réseau ; le code a été créé directement dans ses données), un vrai envoi à
DuckDuckGo, la dictée et la transcription (Whisper non installé), un téléchargement réel.
En chinois, seul le taux de traduction a été relu, pas l'écran. Le Chat n'a ni « relancer »
ni « modifier » une question envoyée, et pas d'export d'un Chat seul (l'export complet est
dans Confidentialité) : fonctions absentes, pas des pannes.

**Page « Modèles » (28/09/2026, PROJET.md § 3.22)** : dans l'application, sélecteur de modèles,
« Installer un modèle sur cette machine », « Voir tous les modèles ». Installer un petit modèle
ajouté ce jour-là (Granite 4.0 H Micro ou Phi-4 mini) et un Mistral (Ministral 3 3B Reasoning) :
le vrai `lms get` accepte-t-il l'identifiant, la taille annoncée est-elle la bonne, le modèle
répond-il à l'essai de santé, avec outils et raisonnement dans le Chat. Relever les modèles
grisés et leurs chiffres sur le Mac de 16 Go et sur le PC Windows.

**Import des Chats de Gemini (28/09/2026)**, demandé par Medhi : « je veux qu'on puisse
importer Gemini aussi ». Réglages, « Importer depuis d'autres IA » lit l'export de Google
Takeout (« Mes activités » > « Applications Gemini »), au format JSON (`MyActivity.json`,
conseillé : dates ISO exactes) ou HTML (`MyActivity.html`, format par défaut de Takeout ;
dates écrites dans la langue du compte : essayées en anglais, français, allemand, espagnol,
chinois et japonais avec leur fuseau ; noms de mois italiens, portugais et néerlandais prévus,
pas essayés), seul ou dans l'archive
.zip (chemins traduits compris : on cherche un dossier qui parle de Gemini ou de Bard, puis
le contenu décide). Code : `src/lib/importGemini.ts` ; `lireExport` (`importChats.ts`) le
reconnaît à sa forme. Google n'exporte **pas des conversations** mais un journal d'activité :
une ligne par question, la réponse en HTML quand elle est gardée, la date ; pas de titre. Les
Chats sont regroupés par le lien `gemini.google.com/app/<id>` que Google range avec chaque
question (vu dans le pied des cartes HTML, sous « Details »), sinon par proximité dans le temps
(moins de 30 minutes entre deux questions), et l'écran le dit ; le titre est la première
question ; images et fichiers joints seulement nommés ; activités qui ne sont pas des messages
(retour donné, brouillon choisi, Canvas) écartées et comptées ; Gems pas repris (Takeout les
met à part, dans le produit « Gemini »). Écran : troisième ligne « Gemini » et dépliant « pas à
pas » (sept étapes, lien vers `takeout.google.com/settings/takeout/custom/myactivity`, format
JSON, délai, quoi déposer), messages clairs (fichier vide, JSON coupé, Takeout sans Gemini,
Gems seuls, .tgz, trop gros). **Toutes sources** : un Chat importé retient `importe` (source,
clé d'origine, nombre de messages) ; déjà importé, il est grisé et ni présélectionné ni
réimporté ; plus long dans un nouvel export, on peut en ajouter une copie complète à côté,
jamais par-dessus. Sécurité : SECURITE.md § 60, `npm run securite` section 34. Sources du
format, lues le 28/09/2026 : aide de Google (support.google.com/gemini/answer/16920332 : ce
qu'on coche, délai, lien 7 jours), recensement des lecteurs publics du projet panchat
(docs/formats/gemini.md : clés `header`, `title` et ses préfixes traduits, `time`,
`safeHtmlItem[].html`, `titleUrl`, `attachedFiles`), archive d'essai publique du projet
gemini-exporter (structure des cartes HTML, lien de conversation, « 1 generated image. »).
**Vu marcher** : `node scripts/essai-import-gemini.mjs` (66 contrôles sur des exports fictifs :
JSON et HTML, seuls et en archive, regroupements, dates, HTML piégé, 17 Mo et 20 000
activités en moins de 20 s, archive qui ment sur sa taille, double import) ; l'archive d'essai
publique de gemini-exporter lue par le même script (`--archive`) : 6 Chats, 16 messages, aucune
balise ; à l'écran (serveur de développement, instance jetable, compte d'essai) : archive JSON,
5 Chats importés, ouverts dans la barre latérale avec réponse piégée rendue en texte, pièce
jointe nommée ; même archive redéposée : 5 lignes « déjà importé », « Importer 0 Chat(s) »,
puis, après un rechargement, « Tous les Chats de cet export sont déjà importés » ; archive HTML
aux chemins français : 4 Chats ; Takeout sans Gemini : le message ; 375 px sans défilement
horizontal. **Pas essayé** : aucun **vrai export Gemini** n'a pu être lu (pas de compte Google
d'essai, pas d'archive de Medhi) ; le JSON réel n'a été vu nulle part, en particulier l'endroit
où Google y range le lien de conversation (lu dans `titleUrl` et les autres champs hors question
et réponse ; à défaut, regroupement par le temps) ; les préfixes de question hors anglais,
japonais, espagnol, grec et chinois (une question au préfixe inconnu garde son préfixe, et une
question sans réponse au préfixe inconnu est écartée comme activité) ; le lien Takeout
pré-rempli n'a pas été ouvert connecté (l'étape 2 dit quoi faire s'il ne pré-coche rien) ; les
libellés de Takeout en français, anglais, chinois et japonais sont ceux relevés dans les guides
publics, pas vus à l'écran ; l'application de bureau et l'écran en anglais, chinois, japonais
(catalogues à 100 %). **À faire par Medhi** : exporter son propre Gemini (JSON, puis HTML) et
lancer `node scripts/essai-import-gemini.mjs --archive <takeout.zip>` : n'affiche que des
comptes, jamais le texte.

**PC Windows (processeur seul, 16 Go, llmster 0.0.25)**
1. **Mise à jour** : installer 2026.928.1. Un poste installé avant 2026.927.3 n'a pas la clé
   de l'éditeur dans son application : « Télécharger » une fois encore, puis « Installer
   maintenant » à la version suivante. Relever l'installation silencieuse, la relance,
   SmartScreen, Smart App Control et l'antivirus.
2. **Le modèle qui répondait « 不 時//// »** : `lms unload --all` (ou redémarrer le PC), puis
   « Bonjour, tu vas bien ? ». Au démarrage, l'essai doit écarter Qwen3.5 4B et garder le
   suivant (avec les notes d'Epoch, Qwen3 8B passe devant sur 16 Go au processeur). Relever
   le processeur et sa puce graphique intégrée, `lms ps`, `lms runtime ls`, `lms log stream`,
   et les lignes « essai de … » et « réponse de … coupée » du journal de Helix.
3. **Documents** : un PDF, un Word fait d'un modèle, un Excel, un CSV enregistré par Excel et
   un .txt du Bloc-notes, avec Ministral 3B puis Qwen3.5 4B : le contenu cité, le temps avant
   le premier mot, « lu en N parties » sur un long PDF, une seconde question plus rapide que
   la première.
4. **Les réponses « qui n'ont rien à voir »** : la conversation de dix échanges (« Liste les
   trois risques principaux d'un prêt bancaire pour une TPE », puis « Développe le deuxième
   point… »), Ministral 3B choisi à la main puis en « Auto » ; au premier message, la ligne
   « … chargé par Helix : --context-length 32768 --parallel 1 --gpu off » du journal ; vingt
   minutes sans rien demander, puis une question (nouveau `lms load`).
5. **Boutons** : « Copier les informations techniques » et un autre « Copier » (canal du
   processus principal) ; « Signaler un problème », avec le navigateur et la messagerie de
   Windows (`mailto:`).
6. **Sans clic** : OpenCode posé seul au démarrage ; Python et Node de Helix pour l'atelier ;
   l'icône de la barre des tâches (cache de l'explorateur).
6 bis. **Agents toujours actifs, OpenClaw natif (28/09/2026, § 3.4)** : créer un agent depuis
   « Agents IA » ; la carte doit passer de « Téléchargement… » à « En service » sans message
   sur WSL. Relever : `<données>\openclaw-moteur` (dossier `node-v24.21.0-win-x64` et jonction
   `node`, `node\openclaw.cmd`, `node\node_modules\openclaw`), la durée, l'antivirus, un
   nom de compte avec espace ou accent. Puis : lui parler, une mission, « Arrêter » Helix et
   vérifier dans le Gestionnaire des tâches qu'aucun `node.exe` d'OpenClaw ne reste ; tuer
   Helix net, le relancer (l'orphelin doit être arrêté, le port 18800 repris) ; au palier
   Libre, « liste les fichiers de ton espace » (commande PowerShell attendue) ; Telegram ou
   WhatsApp branché ; une mise à jour d'OpenClaw si une version éprouvée plus récente existe.

**MacBook (Mac à puce Apple sans LM Studio ouvert)**
7. Le parcours complet de mise en route : llmster posé et démarré par Helix, le modèle
   téléchargé avec sa progression, puis un Chat ; la valeur de l'autorisation d'écran avant
   toute demande.
8. Une mise à jour d'un clic depuis GitHub entre deux versions publiées (fenêtre « Nouvelle
   version », « Installer maintenant »), et la demande du trousseau, une fois par version.

**Petits modèles (Ministral 3B, puis Qwen3.5 4B et 2B, sur le PC)**
9. Dans Cowork : « crée un fichier bonjour.py qui affiche Bonjour », « ajoute une fonction
   moyenne à calc.py » (fichier déjà là : lu avant d'être réécrit), « fais une page HTML avec
   un bouton qui compte les clics » ; dans Code, les deux premières sur un dossier de projet.
   Relever : fichier juste ou non, nombre de relances, lignes « appel d'outil … réparé » et
   « écrit(s) dans le texte » du journal, temps total, et la session sous `helix-petit` dans
   le journal d'OpenCode.

**Le vrai Codex (poste de Medhi)**
10. `npm install -g @openai/codex`, puis dans Code « Codex », « Se connecter avec ChatGPT »,
    connexion finie dans le navigateur ; une demande à « Demander avant de modifier » (Codex
    doit rester en lecture seule), puis à « Tout approuver » (une modification du projet) ; la
    reprise par une deuxième demande, l'arrêt en cours de tâche, la limite d'abonnement
    atteinte (message rendu) ; un compte membre et un poste rattaché ne voient pas la puce
    (§ 3.14).

**Employés sur modèle cloud**
11. Un employé sur un modèle d'une vraie clé, personnelle puis de l'équipe : sa réponse et sa
    consommation ; une mission sur un modèle changé, puis disparu (compte rendu) ; la
    proposition « Son modèle » sur une machine où LM Studio déclare outils et tailles ; « le
    service ne répond pas » avec le vrai OpenClaw. Et, toujours : un vrai mail traité (profil
    restreint, web gardé), une mission du mois.

**Prix réels et vraies clés**
12. Une vraie clé OpenAI, puis Mistral : le point du modèle dans « Comparer intelligence et
    prix », son coût dans Mon usage avec « prix publié par … », et les identifiants que le
    fournisseur rend vraiment. Puis chaque fournisseur du catalogue (Anthropic, Google,
    Mistral, gpt-5 et la série o, Groq, xAI, DeepSeek, Together) avec une image et un appel
    d'outil ; Code sur un modèle de clé ; un vrai 429 de quota.

**Le paquet fabriqué**
13. **Fusibles** : `npx @electron/fuses read --app release/mac-arm64/Helix.app` (et
    `release/win-unpacked/Helix.exe`) doit montrer NODE_OPTIONS, `--inspect` et RunAsNode
    fermés (relu le 28/09/2026 sur les trois paquets `dir`, SECURITE.md § 51). Reste à faire
    sur le poste, application installée : « Mettre en place » la commande `helix` depuis
    l'écran (sur une machine avec Node, puis sans), un petit modèle qui écrit un fichier faux
    (contrôle de syntaxe dans la passerelle), l'atelier (« Vérifier »), le contrôle de l'écran
    (autorisation lue par le canal de la passerelle), et Helix ouvert depuis le terminal de
    VS Code.
14. Dans l'application empaquetée : le travail de Code qui continue quand on quitte sa
    session, pendant une vraie préparation d'application ; « Signaler un problème » ouvert
    pour de vrai (ticket prérempli vu sur GitHub, brouillon dans la messagerie).

**RTK dans Helix Code (§ 3.17)**
15. Dans l'application de bureau, sur un Mac : Code avec un modèle d'une vraie clé, une tâche
    qui lance `git status`, `git log`, les tests ; relever la ligne « N jetons économisés » sous
    la saisie et la puce « RTK ». Puis un petit modèle local avec « Toujours » : relances en
    moins ou en plus, réponses justes ou non (RTK coupe `git log` à dix commits sur une ligne,
    et reformate `ls` et `grep`). Sous Linux, l'installation seule (archive glibc sur arm64).
**Recherche sur le web du Chat (28/09/2026, entrée plus bas)**
15. Avec le vrai DuckDuckGo : « + », « Rechercher sur le web », une question d'actualité, avec
    Qwen3 8B puis Ministral 3B (recherche faite avant la réponse) ; relever les sources sous la
    réponse, les numéros cités, le temps, et ce qui arrive après cinq ou six questions
    rapprochées (DuckDuckGo freine : le message doit le dire). Un modèle que LM Studio déclare
    sans outils (`trainedForToolUse: false`) : la recherche avant la réponse, sans outils.

**Toujours ouverts, d'avant** : Linux sur une vraie machine (`.deb` et AppArmor, AppImage sur
Fedora) ; une tâche programmée partie seule à l'heure dite ; la dictée au micro dans
l'application ; la vidéo Wan 2.2 sur 32 Go, et la vidéo sous Windows et Linux ; le bot dans
une vraie réunion ; une mise à jour d'un clic signée entre deux versions sur un poste
rattaché ; `lms get` sans terminal sur un réseau lent.

**Plus dits à l'écran depuis le 28/09/2026 (§ 3.16), donc tenus ici** : les connecteurs natifs
avec de vrais comptes (Google Sheets, Slides, YouTube, LinkedIn, Facebook, Instagram, TikTok,
vérifiés contre de faux serveurs, SECURITE.md § 41) et Google Drive et Slack ; l'entraînement
sur une vraie carte NVIDIA (Unsloth) ; le Mac virtuel (Lume) de bout en bout ; les modèles
d'images et de vidéo marqués `verifie: false` (`images.ts`) et les modèles de conversation
conseillés sans avoir été essayés (`provision.ts`) ; le japonais relu par un locuteur natif.
Et, depuis le 28/09/2026, les huit connecteurs « projets et rendez-vous » (Trello, Monday,
ClickUp, Todoist, Calendly, Zoom, Brevo, Mailchimp : § 3.5, SECURITE.md § 48).

**Page d'entreprise LinkedIn (29/09/2026, § 3.5, SECURITE.md § 62)**, jamais essayée avec une
vraie application : créer la seconde application en suivant le guide du panneau, la faire
vérifier par le super administrateur de la page, demander « Community Management API » et
noter la durée de l'examen ; une fois le palier de développement accordé, brancher la ligne
« LinkedIn (Page d'entreprise) » (le consentement ne doit rien demander du profil), puis
demander au Chat les pages, les dernières publications, les statistiques, et publier un post
de page : relever la carte, le post sur LinkedIn, le champ `scope` rendu, et si un
administrateur de contenu (non « ADMINISTRATOR ») voit la page.

**Messageries (28/09/2026, § 3.5, SECURITE.md § 46)**, jamais essayées avec un vrai service :
1. **Telegram** : créer un bot avec @BotFather, le brancher (envoi coché), écrire au bot en
   privé puis dans un groupe (avec et sans `/setprivacy`), demander au Chat « résume mes
   messages Telegram », puis « réponds à Paul que c'est d'accord » : relever la carte, le
   message reçu dans Telegram, et que le relevé toutes les minutes ne perd rien. Brancher
   ensuite le même bot sur un agent (canal Telegram) : le connecteur doit dire le conflit (409).
2. **Discord** : application sur le portail développeur, intention « Message Content »
   cochée, bot invité sur un serveur d'essai avec « View Channels », « Read Message
   History », « Send Messages » ; lire un salon, envoyer un message contenant « @everyone »
   (il doit partir sans notifier personne) ; décocher l'intention et reconnecter (l'écran
   doit le dire, les messages arriver vides).
3. **WhatsApp Business** : app Meta de type Entreprise, numéro de test de Meta, utilisateur
   système et son jeton, clé secrète ; instance ouverte en https avec un vrai certificat (ou un
   tunnel) pour le webhook ; déclarer l'adresse et le jeton de vérification, s'abonner à
   « messages ». Écrire au numéro depuis un téléphone, lire, répondre librement ; attendre
   24 h (ou prendre un autre numéro) et vérifier le refus ; envoyer un modèle approuvé, et
   relever ce que Meta facture. Points incertains : la forme exacte du jeton système
   (`EA…` supposé), l'acceptation de `appsecret_proof` avec un jeton système, le champ
   `parameter_name` des modèles à variables nommées, l'erreur 131047 hors fenêtre.
**Commerce et relation client (28/09/2026, branche `connecteurs-commerce`, § 3.5 et SECURITE.md
§ 47)** : aucun des six n'a vu le vrai service. À essayer, service par service, avec un compte de
test : Stripe en mode test (clé restreinte `rk_test_` en lecture sur PaymentIntents, Customers,
Invoices, Subscriptions ; vérifier que `GET /v1/account` passe ou non avec elle) ; Shopify (une
boutique de développement de la même organisation, l'application du Dev Dashboard installée,
le « client credentials grant » et la forme réelle de `scope`) ; WooCommerce sur un vrai
WordPress en https (derrière un pare-feu applicatif, l'en-tête Authorization arrive-t-il ?) ;
Salesforce avec une External Client App (l'adresse de retour `http://127.0.0.1:8787/…`
acceptée ou non, la valeur réelle de `scope` rendue, `Note` visible dans Lightning) ; Pipedrive
avec une application privée en brouillon (peut-on s'y connecter sans la passer « live », qui
vérifie l'adresse de retour ?) ; Zendesk avec un client OAuth confidentiel (adresse de retour
en http sur 127.0.0.1, réponse 201 et `scope` réels, révocation par `tokens/current`).

**Microsoft 365 (28/09/2026, branche `connecteurs-microsoft`, § 3.5)** : créer l'application
dans un vrai annuaire Entra (les deux plateformes, « Client public » puis « Web »), déclarer
`http://localhost/microsoft`, se connecter avec Outlook seul, puis avec les six services et
l'écriture (consentement de l'administrateur pour SharePoint et Teams) ; lire un mail, un
fichier, un classeur, un document Word, un canal ; envoyer un mail avec une pièce jointe,
créer un événement, écrire une plage contenant « =1+1 » (doit rester du texte), poster dans un
canal ; laisser expirer le jeton d'accès (une heure) ; débrancher et vérifier l'accès dans
« Applications d'entreprise ».

### Ce qui reste à faire

*Liste refaite le 25/09/2026. Ce qui est fait est décrit plus haut ;
ne restent ici que les points ouverts.*

**Ce qui dépend du client**

1. **Signature et notarisation** : tout est prêt (SIGNATURE.md § 1), il manque
   le compte Apple Developer (99 € par an) et le certificat « Developer ID
   Application ». La mise à jour automatique s'active d'elle-même ensuite.
2. **Abonnements aux modèles hébergés** : l'écran existe (Paramètres →
   Abonnement), rien n'encaisse. La grille est décidée depuis le 29/09/2026 (six
   formules et Entreprise sur devis, trois modèles chez Scaleway à Paris, prix au
   jeton publiés : plus besoin de devis de location de cartes, voir « la nouvelle
   grille d'abonnement » plus haut). Reste, dans l'ordre : relais chez l'agence qui
   garde la clé de l'hébergeur (jamais la clé dans le profil du client), jeton et
   compte de consommation par abonné (crédit du mois, bascule au modèle local quand
   il est épuisé), paiement (Stripe, dont les frais sont estimés dans `offre.ts`). (Les clés d'API de l'instance, qui devaient venir avec selon la
   décision du 20/09/2026, sont faites depuis le 26/09/2026, § 3.13.)
3. **Relecture native** des traductions anglaise et chinoise.
4. **Essais avec de vrais comptes** : bot dans une vraie réunion Google Meet
   (puis Teams, Zoom si demandés) ; courrier Workspace / M365 par OAuth et mode
   d'emploi de l'administrateur ; envoi SMTP et déclenchement par mail sur une
   vraie boîte (Gmail, OVH) ; Drive et Slack ; agents sur Telegram, WhatsApp,
   Discord, Slack.
5. ~~Rendre le dépôt public~~ : **fait le 27/09/2026** (AGPL-3.0), après relecture de
   l'historique et l'identité de repli rendue neutre (plus bas, « dépôt public »).

6. **Unsloth sur NVIDIA** (§ 3.12) : accepté et branché le 25/09/2026, jamais essayé
   (pas de carte NVIDIA ici). À vérifier sur une vraie machine : que pip résout la pile
   avec les deux roues, que `@@MOTEUR@@unsloth` sort bien, et le gain de vitesse réel.
7. **Sauvegarder la clé d'éditeur** (27/09/2026, SIGNATURE.md § 4) :
   `~/.helix-editeur/cle-privee-mises-a-jour.pem`, à copier hors du Mac (gestionnaire de
   mots de passe, clé USB rangée). Jamais dans le dépôt.
8. **Essais qui restent à faire sur de vraies machines** : regroupés le 28/09/2026 dans
   « Ce qui reste à essayer sur les postes de Medhi », plus haut.
9. **Passer ce Mac sur Qwen3.5 9B**, le modèle qu'Helix y installerait aujourd'hui (il
   tourne encore sur Qwen3 8B, installé avant la règle) : 6 Go, à télécharger sur accord.
10. **Abonnement ChatGPT ou Claude dans Helix** (27/09/2026, § 3.14) : **décidé** par
    Medhi (« ajoute ») et fait le même jour pour Codex, dans l'écran Code, réservé au
    propriétaire du poste ; pas encore essayé avec le vrai programme (essai 10 de la liste
    ci-dessus). Claude par abonnement reste exclu sans accord écrit d'Anthropic.

**Fait le 28/09/2026 : la recherche sur le web dans le Chat, branche `recherche-web`.** Demandé
par Medhi : « ajoute la recherche web dans le Chat, dans le + ». Une entrée « Rechercher sur le
web » dans le menu « + » ; choisie, elle reste en puce « Web · DuckDuckGo » à côté du « + »
jusqu'à ce qu'on la retire (la croix), comme chez ChatGPT et Claude ; elle ne se cumule pas
avec « Créer une image ». Son panneau dit que chaque question part à DuckDuckGo, sans compte,
que l'instance ouvre les pages trouvées, et que rien ne part sans la puce. Sous la réponse,
« Sources du web » : les pages citées par leur numéro (« [3] »), en liens qui s'ouvrent hors de
l'application (http et https seulement), les autres résultats repliés ; sans numéro cité (un
petit modèle les oublie), les pages ouvertes restent montrées sous « Pages consultées sur le
web ». Les sources sont gardées avec la réponse, comme celles des bases de connaissances, et
numérotées après elles. Article d'aide, ligne dans les README (et la promesse « rien ne sort »
complétée), clé `rechercheWeb` dans `helix.config.example.json`.
- **Le moteur : DuckDuckGo, par le web gardé des employés (`webGarde.ts`), pas Tavily ni Exa.**
  Il marche sur toute instance, sans clé ni abonnement, et chaque sortie passe par la garde
  réseau de Helix (`sortieReseau.ts`) avec des lectures bornées ; Tavily et Exa sont des
  programmes tiers lancés par npx, qui cherchent et lisent hors de ces gardes, dont les noms
  d'outils et la forme des résultats changent d'une version à l'autre, payants et hébergés aux
  États-Unis. Ils restent utilisables par la puce « Outils » quand ils sont branchés. Le prix de
  ce choix : DuckDuckGo freine les recherches trop rapprochées (mesuré le 27/09/2026), ce qui
  est dit au modèle et à l'écran. `webGarde.ts` ne change pas de comportement : la recherche et
  la lecture en sont tirées (`chercher`, `lire`) pour servir aux deux.
- **Ce qui protège** (`rechercheWeb.ts`, SECURITE.md § 51) : les outils web ne sont proposés
  qu'avec `web: true` (l'écran de Helix seulement), et un outil non proposé ne part pas ; une
  page ne s'ouvre que si son adresse a déjà été vue pendant la demande (écrite par la personne,
  dans un résultat, dans une page lue, dans le résultat d'un autre outil), ce qui empêche une
  page piégée de faire composer une adresse qui emporterait ce que le modèle a lu ; le texte du
  web arrive entre des bornes tirées au sort ; un appel recopié d'un contenu lu n'est lancé ni
  écrit dans le texte (règle du § 41) ni fait en vrai appel ; six recherches et huit pages au
  plus par demande, 2 Mo lus et 15 000 caractères rendus par page. Les recherches passent par la
  barrière comme des lectures : une carte au niveau « Demander pour tout » seulement.
- **Petits modèles** : un modèle de 8,5 milliards ou moins (`petitsModeles.ts`), ou que LM
  Studio déclare sans outils, reçoit une recherche faite par l'instance avant la réponse, à
  partir de la question (résultats et début de la première page, en contexte, montrée à
  l'écran comme une étape) ; s'il sait appeler des outils, il garde les deux outils, avec une
  consigne de quatre lignes numérotées. Les réparations d'appels de `petitsModeles.ts`
  s'appliquent comme aux autres outils. Pas de découpage en étapes quand le web est le seul
  outil.
- **Profil** : `"rechercheWeb": false` grise l'entrée, avec la raison sous son nom (« son
  profil de déploiement interdit… », traduite par l'instance), et l'instance refuse (403) une
  demande qui la réclamerait. Ne touche ni aux employés ni à Helix Code.
**Vérifié ici** : `npm run typecheck` ; traductions à 100 % en anglais, chinois et japonais
(dont Figma et Vercel, laissés sans traduction dans la passerelle par la fusion précédente) ;
`npm run securite`, 1 188 contrôles, 0 échec, dont la section 17 et `scripts/essai-recherche-web.mjs`
(29 contrôles de bout en bout : faux DuckDuckGo, fausses pages, faux modèles, résolution de noms
et sorties interceptées, aucune requête vers le vrai web) ; trois mutations (appel recopié,
adresse composée, fausse borne) font bien échouer l'essai. À l'écran, passerelle jetable et
Vite dans une fenêtre Electron cachée : menu « + », puce et son panneau, réponse avec ses
sources, en français, anglais et japonais, clair et sombre, 1 440 et 375 px, et l'entrée grisée
d'une instance au profil fermé ; le nom du moteur se coupait à 375 px en japonais dans le menu,
il passe désormais à la ligne. **Pas essayé** : le vrai DuckDuckGo, un vrai modèle (essai 15 de
la liste plus haut).

**Fait le 28/09/2026 : la documentation remise à l'état réel.** L'aide intégrée
(`src/lib/aide.ts`) passe à vingt articles : « Code : OpenCode ou Codex » (brancher Codex,
ce qui part chez OpenAI, le bac à sable selon le niveau, le travail qui continue quand on
quitte sa session), « Joindre un document au Chat » (formats, cartes, lecture en parties,
ce qui ne se lit pas), « Mon usage : ce que coûtent vos modèles » (prix publié, tarif saisi,
« estimé ») ; le modèle de chaque agent (choisir, changer, « Modèle indisponible »),
« Signaler un problème », l'essai des modèles sur le poste, les notes d'Epoch AI et les
durées ajoutés aux articles existants. Le niveau d'accord n'est plus dit « dans Réglages,
Sécurité » (il se choisit dans la barre du bas de Cowork et de Code), et « Helix » écrit en
dur dans l'article des agents passe par `branding.name`. Au passage : « dont … de réflexion »
de Mon usage passait hors traduction (« dont 1 200 of thinking » en anglais), et deux
infobulles de pièces jointes disaient « l'assistant ». ARCHITECTURE.md (ADR-062 à 068,
carte des modules, pile, feuille de route), docs/GUIDE.md (modules, routes, variables,
fusibles, mise à jour d'un clic), SCREENS.md, CONTRIBUTING.md (commandes de vérification)
et l'en-tête de SECURITE.md suivent. Vérifié : `npm run typecheck`, i18n à 100 % des deux
côtés, `npm run securite` 732 contrôles, 0 échec, `node scripts/essai-notes-modeles.mjs` et
`node scripts/essai-source-github.mjs` tout bons ; l'aide ouverte dans le navigateur contre
une instance jetable (liste des vingt articles, « Joindre un document au Chat » et « Code :
OpenCode ou Codex » lus à l'écran, recherche « codex »). Pas relus à l'écran : les autres
articles, et l'anglais et le chinois (traductions faites ici, relecture native toujours à
faire, point 3).

**Fait le 26/09/2026 : une réponse du Chat continue quand on quitte son Chat.**
Signalé par Medhi : ouvrir un autre Chat ou en commencer un nouveau arrêtait la
réponse (`open` et `reset` de `useChat` appelaient « Arrêter »). La réponse vit
maintenant hors de l'écran, rattachée à son Chat (`reponsesEnCours`), continue, et
s'enregistre dans son Chat à la fin ; l'écran s'y rabonne en revenant, et la barre
latérale montre une roue sur le Chat qui écrit encore. Seul « Arrêter » l'arrête ;
un Chat supprimé arrête la sienne. Vérifié dans le navigateur : poème lancé, nouveau
Chat ouvert, roue visible, Chat rouvert en direct (plan qui avance), réponse finie
pendant qu'un autre Chat était affiché, et enregistrée. Limite : une page rechargée
ou l'application fermée coupe la réponse (rien n'est gardé avant sa fin).

**Fait le 27/09/2026 : le travail de Helix Code reste à l'écran quand on quitte sa session.**
Vu par Medhi : « quand on quitte la conversation, le message se retire, donc on a
l'impression qu'il ne travaille plus ». Causes : l'écran Code n'avait qu'une conversation,
vidée (flux fermé) dès qu'on passait à une autre session ou à « Nouvelle session », et
revenir dans Code depuis le Chat ouvrait l'accueil ; la session rouverte relisait son
historique chez OpenCode, qui n'a pas encore la demande pendant que Helix prépare
l'application ou le plan, et se dit au repos pendant que Helix contrôle le code écrit ou
attend que la demande atteigne le modèle (`enCours: false`, message absent). Corrigé comme
le Chat du 26/09 : une conversation qui travaille vit hors de l'écran (`enFond`,
`src/hooks/useCode.ts`), flux ouvert, et continue de se remplir ; y revenir la reprend
telle quelle, sans relecture ni rejeu ; finie hors de l'écran, elle s'oublie et se relit
en entier chez OpenCode. Revenir dans Code depuis une autre page réaffiche la session
qu'on regardait **si elle travaille encore** ; au repos, Code s'ouvre sur l'accueil
(décision du 25/09 inchangée). La passerelle sait qu'une session travaille
(`auTravail`, `gateway/src/fluxCode.ts`) : travail de Helix compté (demande en cours de
traitement, contrôle automatique) et tour ouvert chez OpenCode vu dans le flux ;
`GET /helix/code/sessions` rend `enCours` par session (roue discrète dans la liste, relue
toutes les 5 s tant qu'une session travaille), et l'historique ajoute la demande pas
encore partie chez OpenCode, lit le dernier numéro avant les messages (plus de trou entre
les deux) et laisse au flux un texte encore en train de s'écrire (plus de moitié puis
entier). Seul « Arrêter » arrête l'agent. Vérifié : `npm run securite` (3 contrôles de plus,
le faux OpenCode rend désormais les demandes reçues) ; dans le navigateur (passerelle
jetable, faux OpenCode qui déroule un tour de 45 s) : demande envoyée, Chat ouvert puis
retour dans Code (session réaffichée, en direct), « Nouvelle session » puis réouverture
depuis la liste (suite arrivée pendant l'absence, rien en double), page rechargée en plein
tour (roue dans la liste, historique relu puis suite en direct jusqu'à « Terminé »), arrêt
explicite. Pas essayé : la demande affichée pendant une vraie préparation d'application
(plusieurs minutes avec un vrai modèle), l'application de bureau, le vrai OpenCode. Limite :
le panneau de suivi d'une session rouverte après rechargement repart vide (seule la suite
s'y inscrit).

**Fait le 30/09/2026 : les modèles de l'abonnement revus d'après le marché, et le crédit décompté
en euros.** Medhi, en regardant Artificial Analysis : les trois modèles du 29/09 (Mistral Small 3.2,
DeepSeek V4 Flash, Qwen3.5 397B) sont dépassés ; « hébergé en Europe suffit » ; « le meilleur
rapport qualité-prix » ; « je ne dois surtout pas payer pour les clients ».
- *Relevé du 30/09/2026* (indice d'intelligence d'Artificial Analysis, modèles à poids ouverts) :
  MiMo-V2.6-Pro 46 (Xiaomi, MIT, sorti le 21/09, 0,43 / 0,87 $), GLM-5.3 45 (licence maison),
  Kimi K3 44, GLM-5.3 Flash 42 (MIT), DeepSeek V4.1 Flash 39 (209 jetons par seconde),
  MiMo-V2.6-Flash 38, DeepSeek V4 Flash 34, GLM-5.2 34, Qwen3.5 397B 18, Mistral Small 4 11.
- *Hébergeurs* : Scaleway (Paris) et OVHcloud n'ont aucun des nouveaux ; Nebius les a dans ses
  régions américaines seulement. En Europe : TensorX (société britannique, infrastructure dite
  « souveraine en Europe »), Lyceum Technology, sference (société britannique, infrastructure dans
  l'Espace économique européen) proposent GLM-5.3 Flash (0,20 / 0,50 à 0,60 $) et DeepSeek V4.1
  Flash (0,50 / 1,50 $) ; TensorX a aussi GLM-5.3 (1,75 / 4,50 $) et Kimi K3 (3 / 15 $). Personne
  n'héberge MiMo-V2.6-Pro en Europe. **Vu sur leurs pages publiques seulement** : le pays du centre
  de données et le contrat de traitement des données sont à obtenir par écrit avant d'ouvrir.
- *Retenu* (`src/config/offre.ts`) : polyvalent GLM-5.3 Flash (crédit ×1), rapide DeepSeek V4.1
  Flash (crédit ×2,5) ; pas d'expert tant que MiMo-V2.6-Pro n'est pas hébergé en Europe (le rôle
  reste dans le code). L'écran dit « Hébergé en Europe ».
- *Ne jamais payer pour un abonné* : le crédit (60 % du net du prix normal, inchangé) se décompte
  **en euros, au coût réel** des jetons lus et écrits, plus 15 % de marge de sécurité (`coutReel`) ;
  vidé, il a coûté à l'hébergeur le crédit ÷ 1,15. Avant, un plafond en millions de jetons supposait
  trois lus pour un écrit : un abonné qui fait surtout écrire (la réflexion se paie en jetons écrits)
  aurait coûté jusqu'à 1,8 fois l'estimation. Les jetons affichés sont des estimations prudentes
  (deux lus pour un écrit), dites « environ » : Découverte 5,9 M ; Plus 16,1 / 6,4 ; Pro 63,0 / 25,2 ;
  Max 126,5 / 50,6 ; Équipe 22,4 / 8,9 ; Premium 106,2 / 42,5 (polyvalent / rapide).
- **À faire avant d'ouvrir** : confirmations écrites de l'hébergeur ; le relais, qui décompte le
  crédit avec `coutReel` sur les compteurs de jetons rendus par l'hébergeur et coupe à zéro ;
  surveiller le prix de l'hébergeur et le change (la marge de 15 % et le dollar compté pour un euro
  couvrent les petits écarts, pas un doublement).

**Fait le 29/09/2026 : retrait d'un agent, cadre de focus, trois défauts d'écran.** Signalés par
Medhi sous Windows, ou relevés par la tournée de la documentation :
- *Retrait d'un agent* (`src/pages/AgentsPage.tsx`) : la corbeille d'une carte n'apparaissait qu'au
  survol (introuvable au clavier et au toucher) ; l'échec du retrait de l'agent toujours actif était
  avalé, la carte disparaissait, et l'agent restait dans l'instance, revenu ensuite sans bouton pour
  le retirer ; rien ne se voyait pendant le nettoyage d'OpenClaw (jusqu'à 60 s par appel quand il ne
  répond pas). Maintenant : corbeille toujours visible, « Retrait… » pendant l'opération, la carte
  ne part que si le retrait a abouti, sinon « Le retrait n'a pas abouti : … » ; le panneau d'un agent
  retiré se ferme. **Pas vu à l'écran** : créer un agent sur une instance d'essai lance
  l'installation d'OpenClaw.
- *Cadre de focus vert* (`src/lib/modaliteSaisie.ts`, `styles/index.css`, ARCHITECTURE.md ADR-075) :
  il restait sur un bouton après un envoi par Entrée ; il ne s'affiche plus qu'après Tab ou les
  flèches. Reproduit et vérifié sur une page d'essai (ancienne règle : cadre ; nouvelle : aucun).
- *Mémoire de l'IA* (Réglages → Personnalisation) : l'écran promettait que l'IA « se souvient de vos
  conversations précédentes » ; il dit maintenant que seuls les éléments ajoutés accompagnent les
  demandes. *Ouvrir l'instance* : trois boutons passent par `t()`. *Apparence* : « Suit l'apparence
  de l'ordinateur » au lieu de « de macOS ».

**Fait le 29/09/2026 : file d'attente dans le Chat (et Cowork).** Demandé par Medhi : « il y
a des gens impatients : ça évite que le message se coupe pendant une réponse ». Constaté
avant : pendant une réponse, Entrée ne faisait rien (`canSend` faux), et le bouton d'envoi
devenait « Arrêter » **à la même place** : qui cliquait pour envoyer la suite coupait la
réponse, et son message restait dans le champ. Maintenant, pendant une réponse, Entrée et le
bouton d'envoi (« Mettre en file », tout à droite) mettent le message dans la file du Chat ;
« Arrêter » devient un bouton à part, à gauche. La file s'affiche en haut du composeur
(`FileAttente.tsx`) : compteur, « Modifier » (sur place, le message ne part pas pendant qu'on
le modifie) et « Retirer ». À la fin **normale** d'une réponse, le premier part seul, avec les
pièces jointes et les choix du moment de sa mise en file (modèle, niveau, outils, bases, agent,
web, image ou vidéo) ; puis le suivant. Une réponse en erreur (y compris « le modèle n'a rien
répondu ») ou arrêtée met la file en pause : « Envoyer maintenant » la relance (« Reprendre »
si une autre réponse s'écrit déjà). Dix messages au plus par Chat, au-delà une ligne le dit et
le texte reste dans le champ. La logique est un module pur (`src/lib/fileAttente.ts`, sécurité
section 40) ; pour qu'un message parte même quand l'écran montre un autre Chat ou une autre
page, la réponse s'écrit désormais hors du crochet (`repondre`, `creer`, `terminer` dans
`useChat.ts`), et l'écran suit ses réponses par `CHATS_EN_COURS`. L'écran Code garde l'ancien
bouton (sa conversation vient d'OpenCode, pas de `useChat`). **Décidé : la file reste en
mémoire**, ni enregistrée ni synchronisée : la déconnexion recharge la page, et une file
gardée au-delà serait vue et envoyée par la personne suivante sur le poste ; les pièces jointes
pèsent aussi jusqu'à plusieurs Mo. Une page rechargée ou l'application fermée la perd donc
(comme elles coupent déjà la réponse en cours) ; un Chat supprimé l'emporte. Vérifié : `npm run
typecheck`, i18n à 100 %, `npm run securite` 2167 contrôles, 0 échec ; dans le navigateur
contre une instance jetable et un faux modèle qui écrit pendant 10 s (1280 et 375 px, clair et
sombre) : deux messages mis en file pendant une réponse, partis l'un après l'autre ; un départ
pendant que la page Agents puis un autre Chat étaient affichés (réponse enregistrée dans son
Chat) ; une file par Chat en passant de l'un à l'autre ; « Arrêter » puis file en pause ;
« Modifier » puis « Envoyer maintenant » ; panne simulée du modèle puis pause ; file pleine à
375 px. **Pas essayé** : avec un vrai modèle, avec une carte d'accord en attente (la réponse
reste alors en cours, la file attend), dans Cowork à l'écran (même code, contrôlé par la
section 40), une image ou une vidéo mise en file, l'application de bureau. Vu et corrigé en essayant : au
premier envoi d'un Chat neuf, le composeur change de place (accueil puis conversation) et
perdait le curseur, si bien que la suite tapée aussitôt se perdait ; né pendant une réponse,
il reprend maintenant la main (vu : la suite tapée sans recliquer entre dans la file). Et le
champ vidé par un envoi de plusieurs lignes reprend sa hauteur. Relevé, pas corrigé : le
brouillon du champ suit quand on change de Chat (il n'est pas rattaché au Chat).

**Fait le 29/09/2026 : extension VS Code 0.2.5 et CLI essayées de bout en bout.** CLI :
`npm run essai:cli` 31/31, avec le modèle de LM Studio (`-- --modele`, qwen3-8b) 49/49.
Extension : `npm run essai:vscode` (faux module `vscode`, vraie extension, instance
jetable) 14/14, avec qwen3-8b 14/14 (Helix Code a créé un fichier après la carte
d'accord). Puis dans un vrai VS Code (profil jetable, `--extensionDevelopmentPath`, un
pilote qui lance les commandes) : « Améliorer la sélection » a trouvé le `i <=
liste.length`, et « Insérer » a remplacé la sélection par le code corrigé. Trois défauts
vus à l'écran et corrigés : pendant la réflexion de Qwen3 (plus de deux minutes), la vue
n'affichait que « … » (elle dit maintenant « Le modèle réfléchit (N s)… ») ; la question
perdait l'indentation de son code ; le bouton « Insérer » recouvrait la première ligne.
**Pas essayé** : la connexion et l'onglet Code dans le vrai VS Code (le mot de passe se
tape, ce que je ne fais pas dans un éditeur) ; ils le sont par `essai:vscode`.

**Fait le 29/09/2026 : documentation de la 2026.929.2 et aide intégrée sur tout le
logiciel.** README (quatre langues) : Page d'entreprise LinkedIn, Palmier Pro, extension
jointe à chaque version ; docs/GUIDE.md (connexions natives, LinkedIn en deux lignes, Palmier
Pro, extension VS Code, Abonnement, essais) ; ARCHITECTURE.md (ADR-069 à 071, ADR-049, carte
des modules) ; SCREENS.md ; extensions/vscode/README.md ; CONTRIBUTING.md. Demandé par Medhi :
l'aide doit couvrir chaque écran qu'on peut ouvrir. Dix-huit articles ajoutés à `aide.ts`,
écrits d'après le code et traduits (en, zh, ja) : Cowork, extension VS Code, ligne de
commande, bases de connaissances, Projets, Groupes, LinkedIn (profil et Page), bot de
réunion, Profil, Sécurité, apparence et formats, mise à jour, Personnalisation de l'IA,
Entraîner un modèle, Contrôle de l'écran, API développeur, Installer les apps, Abonnement
(sans prix, module `abonnement`). Relevé en les écrivant, pas corrigé (code non touché) :
Personnalisation de l'IA dit « Permet à l'IA de se souvenir de vos conversations
précédentes », alors qu'aucun code n'ajoute de souvenir seul (seuls les éléments ajoutés à la
main existent ; l'article le dit) ; dans Profil, les boutons « Ouvrir l'instance », « Refermer
l'instance » et « Application... » ne passent pas par `t()` ; « Réglage du système » dit
« Suit l'apparence de macOS » même sous Windows ; aucun script du dépôt ne fabrique ni ne joint
le `.vsix` (fait à la main à la publication, `vsce package` dans `extensions/vscode/`).

**Signalé par Medhi le 29/09/2026 : sous Windows (peut-être sous Linux), le Chat n'affiche ni la
réflexion du modèle local ni son temps (« Réflexion en cours... N s », puis la durée), alors que
le Mac les affiche.** Rien ne pouvait s'essayer sous Windows d'ici : l'essai de GitHub garde
maintenant le flux brut d'une question qui fait réfléchir, au moteur seul (API de LM Studio),
par le relais de Helix et par le Chat de Helix, sous Windows (étape 6 de
`scripts/essai-windows-ci.mjs`) et sous Linux (job `reflexion-linux`, llmster posé par la
passerelle seule), pour Qwen3 1.7B et Qwen3.5 2B (`scripts/essai-reflexion-ci.mjs`, artefacts
`reflexion-<modèle>-<endroit>.sse.txt` et `.temps.txt`). **Ce que le flux brut a montré** (quatre
exécutions, branche `essai-reflexion-windows`, llmster 0.0.25-1, machines sans carte graphique) :
1. **Le format n'est pas en cause sur ce moteur.** Sous Windows comme sous Linux, LM Studio
   envoie la réflexion par `reasoning_content`, jamais dans le texte : `"delta":{"role":"assistant",
   "reasoning_content":"Okay"}` puis, après la réflexion, `"delta":{"content":"Le"}` (Qwen3 1.7B,
   Windows) ; de même pour Qwen3.5 2B quand Helix lui demande de réfléchir (sans `reasoning_effort`,
   LM Studio ne le fait pas réfléchir du tout). Le Chat de Helix la relaie séparée, avec son temps
   (exécution 36589891031 : 3 345 caractères de réflexion sur 198 s sous Windows).
2. **Ce qui était muet, c'est l'attente avant la réflexion.** Au processeur, sous Windows : 50 s
   pour le tri qui décide s'il faut découper la demande (une requête sans flux), puis 36 s de lecture
   de la demande par le moteur, soit 86 s avant le premier mot de réflexion, avec pour seul affichage
   un curseur qui clignote ; sous Linux, 36 s puis 25 s. Sur un Mac à puce Apple, ces deux phases
   tiennent en quelques secondes : c'est la différence que l'on voit à l'écran.
3. **Qwen3.5 2B part en boucle dans sa réflexion** avec la consigne du Chat, sous Windows et sous
   Linux : un paragraphe de 347 caractères (« Wait, I need to check if the instruction is telling me
   to *not* answer the question at all. … Okay, so I will answer the question. ») redit à l'identique,
   13 000 à 22 000 caractères en dix minutes, sans réponse. Trop long pour la période de 200
   caractères du garde-fou, il serait allé jusqu'au plafond (plus d'une heure à 8 jetons par seconde).
4. Qwen3 1.7B ne réfléchit pas toujours : une fois sur deux par le Chat, pas un mot de réflexion à
   « Combien font 17 fois 23 ? », quand le moteur seul en écrivait 4 000 caractères. Rien à corriger.

**Corrigé :**
- *Attente dite* (chat.ts, `attenteAffichee`) : après trois secondes sans rien du moteur, le Chat
  affiche un statut avec le temps écoulé, « … organise le travail (N s)... » pendant le tri,
  « … lit la demande (N s)... » avant le premier morceau de chaque appel ; il s'efface au premier
  morceau. Ce n'est jamais présenté comme de la réflexion. La ligne de commande (`--outils`) le
  réécrit sur place ; hors terminal, une ligne par étape, pas une par seconde. Traduit (en, zh, ja).
- *Garde-fou* (gardeBoucle.ts) : dans la réflexion seulement, un bloc de 201 à 1 500 caractères redit
  six fois de suite à l'identique est une boucle (le paragraphe de Qwen3.5 2B est coupé après 2 167
  caractères) ; le texte d'une réponse garde l'ancienne règle (une réponse peut redire à la demande).
- *Réflexion écrite dans le texte* (gateway/src/reflexionEnLigne.ts), pour les moteurs qui ne la
  séparent pas (application LM Studio dont le réglage « séparer reasoning_content » est coupé,
  gabarit non reconnu, service qui rend le texte brut) : **pas vu dans ces essais**, mais l'écran
  retirait alors tout `<think>…</think>` du texte (MessageList.tsx), ce qui aurait donné exactement
  le symptôme. La passerelle sépare maintenant, au fil du flux, `<think>…</think>` en tête (balises
  coupées n'importe où entre deux morceaux) et `</think>` seul quand le gabarit a ouvert la balise
  (le texte déjà envoyé est requalifié par l'évènement `reflexion_requalifiee`, que useChat.ts
  applique, temps compris) ; même séparation, recopiée, dans l'extension VS Code et la ligne de
  commande (qui affichaient les balises). Le relais de l'API compatible reste octet pour octet.

**Vérifié** : `npm run securite` (section 42 : chaque forme et chaque coupure, les copies de la
ligne de commande et de l'extension contre 4 000 flux tirés au hasard, une instance jetable devant un
faux moteur lent, le garde-fou sur le paragraphe de Windows) ; `npm run essai:cli` et
`npm run essai:vscode` (réflexion entre balises coupées, `</think>` seul) ; l'essai de GitHub sous
Windows et Linux, vert : https://github.com/medhiclb/HelixAI/actions/runs/36601390922 (Windows 38/38,
Linux 11/11 ; par le Chat de Helix, Qwen3.5 2B : 8 427 caractères de réflexion par
`reasoning_content` sur 158 s sous Windows, 6 270 sur 181 s sous Linux, réponse « 17 fois 23 fait
**391**. » sans balise ; premier signe à l'écran à 3,7 s, le statut d'attente). **Pas vérifié** : le PC de Medhi, son modèle et son moteur (si
c'est l'application LM Studio et non llmster, le réglage de séparation est à regarder) ; l'écran
lui-même sous Windows (l'essai lit le flux comme useChat.ts le lit, sans ouvrir la fenêtre) ; un
modèle plus gros. **À décider par Medhi** : sous Windows et Linux, Helix envoie à Qwen3.5 une
pénalité de présence nulle (`echantillonnageLocal`, 27/09/2026) ; Qwen conseille 1,5 contre les
répétitions en réflexion, et c'est peut-être ce qui fait boucler Qwen3.5 2B ici (pas essayé).

**Fait le 26/09/2026 : revue de sécurité du poste de travail, corrigée** (SECURITE.md
§ 24). Extension VS Code 0.2.4 (adresse et jeton de portée machine, https hors du poste,
jeton du poste seulement pour le port de l'application `instance-port`, séance par
adresse, pas de redirection suivie ; vérifié par un faux `vscode`, pas dans un vrai VS
Code : fait le 29/09/2026, voir ci-dessous) ; CLI (texte venu de l'instance nettoyé des séquences de terminal, horloge
suspendue pendant un accord, destinataires affichés en dernier, `redirect: "error"`,
jeton seulement pour le port de l'application) ; synchronisation (aucune poussée avant
une relecture de la séance, modifications en attente notées dans
`helix:sync:a-pousser` et fusionnées à la relecture : vérifié dans le navigateur, un
Chat créé instance coupée et un Chat arrivé d'un autre poste se retrouvent tous deux,
sur le poste et sur l'instance) ; lanceur `helix` qui ne remplace jamais un programme
étranger (essayé dans un HOME d'essai), shell de connexion lu sans geler l'application ;
`~/.helix` en 0700 ; clé d'API vidée du presse-papiers après une minute si elle y est
encore. Non corrigé, documenté : RunAsNode reste actif (la passerelle et le lanceur en
ont besoin). *Fermé le 28/09/2026 (SECURITE.md § 51).*

**Fait le 26/09/2026 : contrôle automatique de Helix Code** (`gateway/src/controleCode.ts`,
`electron/rendu.cjs`). Demandé par Medhi : « le petit modèle doit produire un bon niveau
de logiciel, même si c'est long ». À la fin de chaque tour, Helix contrôle lui-même les
fichiers web modifiés (syntaxe, fichiers liés, fonctions appelées, éléments cherchés) et
ouvre les pages modifiées dans une fenêtre cachée de l'application (erreurs à l'exécution,
page presque vide, texte au contraste < 3, boutons et formulaires essayés avec des valeurs
d'exemple) ; s'il reste un problème, il relance l'agent dans la même session avec la liste
triée par gravité (et les fonctions qui existent vraiment), jusqu'à cinq fois ; l'écran
suit la relance dans la même bulle et affiche le bilan ; « Arrêter » coupe les relances.
Les applications de gestion (ERP, CRM, tableau de bord) reçoivent le kit de design et des
règles de comportement (`CONSIGNE_APPLICATION`, design.ts). Mesuré le 26/09/2026 avec
Qwen3 8B sur « Tu peux faire un petit ERP fonctionnel pour un cabinet d'avocat ? » : design
posé, application écrite en ~7 min et annoncée « prête à l'emploi » ; le contrôle trouve
10 problèmes (fonction `chargerSection` absente, tableaux absents, erreurs au clic) ; trois
relances n'en corrigent aucun, l'agent affirmant pourtant avoir défini la fonction. Le
contrôle fait son travail ; **Qwen3 8B n'a pas le niveau pour corriger** : il faut un modèle
plus fort (Qwen3.5 9B, choix de Helix pour 16 Go, à réinstaller sur ce poste). Ternary
Bonsai 2 27B (prism-ml, Apache 2.0, 8,6 Go, empreinte vérifiée) : non pris en charge par
LM Studio (`prism_hadamard_qwen35`, moteur propre exigé). Pas encore essayé : la boucle dans
l'application empaquetée (le banc d'essai n'existe qu'avec Electron), et avec un modèle
plus fort.

**Fait le 26/09/2026 : les applications de gestion faites en plusieurs étapes**
(`gateway/src/application.ts`, moteur dans `gateway/application/`). Demandé par Medhi, avec
pour exemple l'écran d'un ERP classique : « le petit modèle avec le séquençage doit faire un
beau logiciel même si ça prend du temps ». Décision : le petit modèle n'écrit plus le
logiciel entier. Pour une demande d'application dans un dossier neuf : (1) le plan (parties,
champs, liens) en JSON tenu par un schéma (`response_format` de LM Studio) ; (2) des fiches
d'exemple, une partie à la fois ; (3) l'interface écrite par Helix à partir du plan, aux
couleurs du design choisi (barre du haut, menu et filtres à gauche, liste triable et paginée,
fiche détaillée avec ses éléments liés, formulaire, suppression confirmée, export CSV,
tableau de bord, enregistrement sur le poste) ; (4) l'agent n'écrit que `app/metier.js`
(champs ajoutés, calculs, contrôles, chiffres du tableau de bord), en entier avec `write`,
puis le contrôle automatique vérifie aussi que ce fichier n'utilise que des parties et des
champs qui existent (`problemesMetier`). L'écran suit chaque étape. Mesuré le même jour
avec Qwen3 8B, sur la demande exacte, dans l'application empaquetée, trois essais :
plan en ~3 min (5 parties liées : clients, dossiers, factures avec statut, avocats,
audiences) ; au 1er essai ses trois `edit` de metier.js ont échoué (il sautait les
commentaires) et il a annoncé les règles « ajoutées » : d'où l'écriture en entier ; au 2e,
il cherchait à modifier plan.js avec des lignes du résumé : d'où `champs` dans metier.js ;
au 3e, le contrôle a relevé des champs inventés (`montant_ht`) et la relance les a
corrigés, mais l'agent a introduit `d.stat, "En cours"` (compteur toujours à zéro) en
disant avoir corrigé le filtre : le contrôle lit maintenant aussi les champs des fiches
parcourues (`donnees.dossiers.filter(d => d.…)`). 4e essai (avec la méthode jointe à
chaque demande, `METHODE_CODE`) : 11 min en tout, règles écrites du premier coup avec `write`,
une relance pour deux champs inventés (`taux_tva`, `montant_ttc`), corrigés, et un bilan
honnête ; les cinq parties acceptent un ajout sans erreur et les chiffres du tableau de bord
sont justes. Restent des défauts du modèle : un total affiché « 6780.00 » au lieu d'euros, et
un plan où le champ « Avocat » du temps passé renvoie aux clients faute d'une partie Avocats.
L'interface elle-même est vérifiée (ajout, suppression, filtres, recherche, champs
calculés, sans erreur) ; les libellés du moteur sont en français seulement.

**Fait le 26/09/2026 : la couche qui porte Helix Code, pour tous les domaines de code.**
Demandé par Medhi : « il faut que la couche logicielle soutienne Helix Code et qu'il soit
bon partout », même avec un petit modèle et un petit contexte. Ce que Helix fait désormais
autour du modèle, pour toute demande de code :
- **méthode** jointe à chaque demande (`METHODE_CODE`, controleCode.ts) : lire avant de
  modifier, réécrire en entier un fichier de moins de 300 lignes, un fichier à la fois,
  n'utiliser que ce qui existe, écrire les tests d'un programme, ne rien annoncer de faux ;
- **carte du projet** (`carteProjet.ts`) : les fichiers et ce qu'ils définissent, en
  quelques milliers de caractères, jointe à la demande et à chaque étape ;
- **séquençage** (`sequenceCode.ts`) : avec un petit ou moyen modèle (`strategie`,
  plan.ts ; un grand modèle n'est pas découpé), le modèle de code fait un plan court en
  JSON, Helix envoie une étape à la fois et ne passe à la suivante qu'après le contrôle ;
  s'il reste des problèmes après cinq corrections, le plan s'arrête et l'écran le dit ;
- **contrôles par langage**, sans rien exécuter : Python (`analysePython.ts` : syntaxe,
  noms définis nulle part, `from x import y` absent du fichier du projet, module ni
  installé ni déclaré quand le projet ne déclare rien), JSON, imports relatifs de
  JavaScript et TypeScript (fichier absent, nom non exporté). Mesuré sur deux vrais
  projets : 0 fausse alerte sur 293 fichiers de Helix ; sur un projet de 359 fichiers
  Python, une seule alerte, une vraie erreur ; sur 2 075 fichiers JS/TS, 40 alertes,
  vérifiées vraies sur échantillon (imports vers des fichiers déplacés) ;
- **tests lancés pour de vrai, dans une cage** (`essaisCode.ts`, SECURITE.md § 25) :
  copie du projet, `sandbox-exec` sans réseau ni lecture hors copie, 90 s au plus ;
- historique : consignes, plan, carte et relances de Helix retirés de ce qu'on relit.
Mesuré avec Qwen3 8B sur « un programme Python en ligne de commande qui lit un CSV de
dépenses […] avec des tests » : plan de 3 étapes suivi une à une, une erreur de syntaxe
trouvée et corrigée ; mais les tests écrits étaient faux (un test sur deux échouait), ce
qu'aucun contrôle de lecture ne voyait : d'où l'essai réel des tests, ajouté ensuite.

**Fait le 26/09/2026 : Google Agenda par la connexion Google, et revue de tous les connecteurs.**
Essayé avec Medhi sur son compte : Gmail se branche par mot de passe d'application (lu et
résumé), mais Google refuse ce mot de passe pour ses agendas ; l'écran promettait l'inverse,
il ne le promet plus. Google Agenda passe par la connexion Google avec **l'application
Google de l'organisation** (décidé par Medhi : local et souverain, pas d'application commune
de Helix Agence), saisie une fois à l'écran et partagée avec Drive (`clientGoogle.ts`,
`agendaGoogle.ts`) ; lecture, et écriture si on la coche (créer, modifier, supprimer, chaque
écriture par la carte d'accord, suppression toujours confirmée, aucun invité ni courriel).
Vérifié en vrai : connexion du compte de Medhi, et lecture de sa semaine dans un Chat. Pas
encore essayé : une écriture réelle. Revue des connecteurs (SECURITE.md § 27) : versions
épinglées, scripts d'installation coupés, sept paquets abandonnés retirés ou remplacés,
17 services en ligne et 13 serveurs locaux démarrés et vérifiés sans compte.

**Fait le 26/09/2026 : les tâches programmées.** Demandé par Medhi, « comme le fait
Claude » : une consigne, un rythme (chaque jour, du lundi au vendredi, chaque semaine un
jour choisi, chaque mois un jour ou le dernier), une heure, et l'instance l'exécute avec les
outils de la personne, fenêtre fermée ou non (`gateway/src/tachesProgrammees.ts`, écran
Tâches, rubrique « Programmées », `src/components/taches/TachesProgrammees.tsx`). Elles se
créent là, ou depuis un Chat (outil `taches__programmer`, qui passe par la carte d'accord).
L'exécution passe par la route du Chat, appelée par la passerelle elle-même sur la boucle
locale avec une clé tirée au sort à chaque démarrage : la barrière d'approbation, le
journal et les outils sont ceux d'un Chat ordinaire, au nom de la propriétaire. Chacune ne
voit et ne touche que les siennes ; les vingt derniers comptes rendus sont gardés et
s'ouvrent dans un Chat. Vérifié par `npm run securite` (section 3 ter). **Pas encore
essayé** : une exécution à l'heure dite sur l'application installée.
Le même jour, à la demande de Medhi (« je veux aussi pouvoir donner des tâches à des
agents ») : une tâche programmée se confie à un agent personnalisé (écran Agents), à la
création ou ensuite, depuis l'écran ou depuis un Chat (« … par l'agent Comptable »). Ses
instructions, son modèle, son droit aux outils et ses bases de connaissances s'appliquent ;
l'agent est relu à chaque exécution, et seulement parmi ceux que la propriétaire voit à cet
instant (authz.ts) : un agent qu'on ne lui partage plus ne fait plus ses tâches, et
l'exécution le dit. Les cartes du Kanban se confiaient déjà à un agent (`agentId`).

**Fait le 26/09/2026 : le niveau d'approbation dans la barre du bas.** Demandé par Medhi :
le sélecteur (« Sans approbation », etc.) quitte la rangée de puces de Cowork pour la barre
du bas, à côté du « + », comme sur Claude, et il est aussi dans Code, dont les demandes
d'OpenCode passent par la même barrière (`permissionsCode.ts`). Le libellé de « Tout
approuver » ne dit plus « sans jamais vous demander » : ce qui se confirme toujours
(supprimer un événement) se confirme aussi à ce niveau.

**Fait le 27/09/2026 : une clé de fournisseur cloud, et tout fonctionne avec ses modèles.**
Demandé par Medhi (« sois sûr que si quelqu'un met sa clé d'API de LLM tout fonctionne, et
pareil que les modèles en fonction de la clé d'API fonctionnent »). **Bug vu par Medhi le même
jour** (2026.927.3, Mac) : dans Code, un modèle de sa propre clé OpenAI (gpt-4.1-nano)
répondait « Modèle inconnu ou réservé à la personne qui a branché sa clé ». Deux refus à la
suite : l'ouverture de la session résolvait le modèle sans dire pour qui (`reglageCode`,
index.ts), puis OpenCode appelait la passerelle au jeton d'instance seul. Corrigé : la
session est ouverte pour la personne connectée, et l'appel d'OpenCode est servi pour la
propriétaire de sa session (clé de relais et registre de Code exigés, SECURITE.md § 15).
Rejoué avant et après la correction contre un faux OpenAI et le faux OpenCode : le même
message avant, la réponse du modèle après ; un collègue reste refusé.

Tous les fournisseurs passent par leur point d'accès compatible OpenAI, Anthropic et
Google compris ; Helix n'appelle ni `/v1/messages` ni `generateContent`. Leurs dialectes
sont dans `gateway/src/modelesCloud.ts` (nouveau). **Ce qui cassait, et ce qui a changé :**
- *Vision* : les rôles ne venaient que du nom ; gpt-4o, gpt-4.1, gpt-5, Claude, Gemini
  passaient pour aveugles, et l'image jointe était **retirée** avant l'envoi. Ce que la liste
  déclare l'emporte (Mistral `capabilities`, OpenRouter `architecture`, Together `type`),
  le nom sinon.
- *Champs refusés* : l'écran joint `agent` depuis ce matin, qui partait chez le fournisseur
  (OpenAI : 400 ; Mistral : 422) : un Chat ouvert sur un agent ne répondait plus. Retiré.
  `chat_template_kwargs` ne part plus vers une clé. Et la passerelle lit le refus et rejoue
  sans le champ nommé : `max_tokens` renommé `max_completion_tokens` pour gpt-5 et la série
  o (OpenCode en demande 32 000), température retirée, `reasoning_effort: none` devenu
  `minimal`, `stream_options` et `reasoning_effort` retirés chez Mistral, borne de
  `max_tokens` reprise du refus. Retenu par modèle (et non plus par moteur).
- *Liste des modèles* : Anthropic en rend vingt par page (les suivants manquaient) et lit
  sa clé dans `x-api-key` ; Together rend un tableau nu (« aucun modèle ») ; Google répond
  400 à une clé fausse ; OpenAI liste des modèles qui ne répondent pas à
  `/chat/completions` (codex, « pro », instruct), maintenant écartés comme ceux d'images,
  de voix, d'OCR. Liste gardée dix minutes (elle était relue avant chaque message). Une
  liste en panne garde les modèles retenus : le vrai refus est dit au premier message.
- *Flux* : raisonnement lu dans `reasoning` (OpenRouter, Groq) et dans les morceaux
  `thinking` de Magistral ; appels d'outils sans `index` (Google) rangés à part ; erreur
  envoyée au milieu du flux (OpenRouter) dite, au lieu d'une bulle vide.
- *Erreurs* : clé refusée (401, 403, 400 de Google), crédit (402), quota épuisé ou débit
  limité (429, distingués), modèle retiré (404), service surchargé (5xx, 529) : dits avec le
  nom du fournisseur, sa réponse, et quoi faire. Un quota épuisé passait pour « conversation
  trop longue » (son texte dit « exceeded »).
- *Auto* sans modèle local : il ne prend jamais une clé (décision de 0.12.0), et le dit
  maintenant en nommant le modèle à choisir. *Bases de connaissances* : une clé ne sert pas à
  indexer (le texte des documents ne part pas), l'écran le dit.
- *Catalogue* : Groq, DeepSeek (Chine), xAI et Together AI ajoutés, adresses relevées dans
  leur documentation.

**Vérifié le 27/09/2026** par `scripts/essai-fournisseurs.mjs`, lancé par `npm run securite`
(102 contrôles, tous réussis ; aucune vraie clé, `fetch` et les noms de la passerelle
détournés vers sept faux fournisseurs, toute autre sortie refusée) :

| Fonction | OpenAI | Anthropic | Google | Mistral | OpenRouter | DeepSeek | Together |
|---|---|---|---|---|---|---|---|
| Clé fausse refusée, liste filtrée | oui | oui (pages, `x-api-key`) | oui (400) | oui (capacités) | oui (`/key`) | oui | oui (tableau nu) |
| Chat en flux | oui | oui | oui | oui (422 corrigé) | oui | oui | oui |
| Raisonnement affiché | non rendu par l'API | non rendu (compatibilité) | non essayé | oui (Magistral) | oui (`reasoning`) | oui (reasoner) | non essayé |
| Appel d'outil complet | oui | oui | oui (2 appels sans index) | oui (id de 9 car.) | oui | oui | oui |
| Image jointe | oui | oui | oui | oui (Pixtral) | oui | écartée, et dit | non essayé |
| Erreurs dites | 401, 404, 429 ×2 | 529 | 400 clé | | 402, coupure | | |
| Relais (OpenCode, script) | oui (gpt-5 corrigé) | | | | | | |
| Code, clé personnelle | oui (gpt-4.1-nano) | | | | | | |

Aussi vérifié : aucun champ propre à Helix ne part ; les clés personnelles restent à leur
titulaire (sélecteur, relais, Code) ; une adresse « compatible » qui bascule vers le réseau
interne est refusée à l'appel suivant ; aucune clé dans la sortie de la passerelle.
**Non géré** : aucune option du profil ne ferme les clés de fournisseurs (`refusSortie` ne
juge que l'adresse) ; le raisonnement d'OpenAI et d'Anthropic n'est pas montré (leurs
points d'accès compatibles ne le rendent pas ; Anthropic le recommande pour des essais, pas
pour la production : passer à `/v1/messages` serait un chantier à décider) ; les morceaux
`thinking` de Magistral partent tels quels vers OpenCode (le relais reste octet pour
octet). Cowork (écran) et les employés OpenClaw passent par les mêmes chemins (boucle
d'outils de l'écran, relais), sans essai propre ici.
**Reste à essayer avec de vraies clés** : chaque fournisseur du catalogue, surtout
Anthropic (liste par `x-api-key`, conversation par `Authorization`), Google (outils en
flux), Mistral (champs refusés, identifiants d'outils), gpt-5 et la série o (noms exacts des
refus), Groq, xAI, DeepSeek, Together ; une image et un appel d'outil par fournisseur ;
Code et un employé sur un modèle de clé ; un vrai 429 de quota.

**Fait le 27/09/2026 : créer une vidéo, comme une image.** Demandé par Medhi (« générer des
vidéos, avec un modèle en fonction du PC »). Menu « + », « Créer une vidéo » : la même pastille
que pour les images propose le modèle qui tient sur la machine, annonce le téléchargement, suit
l'installation. Même moteur que les images (stable-diffusion.cpp, mode `vid_gen`, qui écrit une
vidéo WebM lue dans le Chat), mêmes droits (la vidéo se voit par qui voit le Chat), même
effacement et même export (`gateway/src/images.ts`). Modèles Wan d'Alibaba, Apache 2.0, comme
leur encodeur umt5-xxl, chaque fichier à une révision et une empreinte relevées le
27/09/2026 : **Wan 2.1 1,3 milliard** (dès 16 Go ou une carte de 8 Go ; 624 × 352, deux
secondes à 16 images/s, 15 étapes, décodeur allégé TAEHV de madebyollin, licence MIT ; 6,5 Go
à télécharger, moteur compris) et **Wan 2.2 TI2V 5 milliards** (dès 32 Go ou une carte de
16 Go ; 1024 × 576, deux secondes à 24 images/s, décodeur complet ; 12,8 Go). Pas sur le
processeur seul. **Essayé de bout en bout le 27/09/2026 sur le Mac M4 de 16 Go de Medhi**
(Wan 2.1, « un chat roux qui s'étire au soleil ») : téléchargement 5 min 37, vidéo en
**10 min 54** (35 s par étape, décodage 70 s), chat roux sur le rebord, au soleil, qui bouge.
Le premier réglage (832 × 480, 20 étapes, décodeur complet) prenait 80 s par étape et ne
finissait pas son décodage au bout de 45 minutes : arrêté à la demande de Medhi (« 90 minutes
c'est trop »). Plafond : 45 minutes, puis arrêt dit comme tel. Wan 2.2 : pas essayé (pas de
machine de 32 Go ici).

**Fait le 27/09/2026 : les instructions d'un agent vraiment masquées, et deux postes qui ne
s'effacent plus.** Demandés par Medhi.
- **Masquer** (interrupteur à la création, ou sur la carte de l'agent) : l'instance n'envoie
  plus les instructions aux postes de celles et ceux à qui l'agent est partagé (authz.ts) ;
  leur Chat met une marque à la place, que l'instance remplace au moment d'appeler le modèle
  (`instructionsAgents.ts`), pour qui a le droit de se servir de l'agent. Le poste d'un
  employé lié ne leur est plus montré non plus ; les tâches programmées lisent les vraies
  instructions. Limite dite à l'écran : le modèle les lit, et une question insistante peut
  lui en faire dire une partie.
- **Deux postes** : chaque envoi dit sur quelle version il s'appuie (`base`) ; si l'instance a
  changé depuis, 409, le poste relit, fusionne ce qu'il avait en attente et renvoie. Avant, la
  même personne sur un second poste effaçait ce qu'elle venait de créer sur le premier. Un
  poste d'une version antérieure n'envoie pas de `base` et garde l'ancien comportement.
Vérifié par `npm run securite` (402 contrôles).

**Fait le 27/09/2026 : une photo pour chaque agent.** Demandé par Medhi. Choisie à la création
ou en cliquant sur l'avatar de sa carte (son propriétaire seul), recadrée en carré de 256 pixels
comme la photo de profil ; elle apparaît sur sa carte, dans le choix de l'agent du Chat et sur
la fiche de l'employé qui lui est lié. L'instance n'accepte qu'une image intégrée (JPEG, PNG,
WebP, moins de 200 Ko) : une adresse est retirée (`npm run securite`).

**Fait le 27/09/2026 : le web gardé pour les mails reçus, et des missions qu'on programme
comme les tâches.** Demandé par Medhi : un employé qui traite un mail doit pouvoir aller sur
le web sans qu'un mail piégé s'en serve (`webGarde.ts` : recherche DuckDuckGo en GET, lecture
d'une page seulement si son adresse a déjà été vue ; détail SECURITE.md § 28). Les missions
se programment avec le même choix que les tâches : chaque jour, du lundi au vendredi, chaque
semaine un jour choisi, chaque mois (1 à 28, ou le dernier jour), chaque heure, à chaque mail
reçu, et l'heure à la minute. Pas 29 à 31 : croner, la planification d'OpenClaw, sauterait les
mois plus courts. Pas encore essayé avec le vrai OpenClaw : une mission du mois, et un mail
réel qui fait chercher sur le web.

**Décidé par Medhi le 27/09/2026 : « Tout approuver » veut dire accepter le risque.** Pas de
carte ajoutée après la lecture d'un contenu venu du dehors (mail, page web, document) : à ce
niveau, un texte piégé peut faire agir l'agent sans carte, et on l'accepte en le choisissant ;
qui ne l'accepte pas reste en « Demander avant de modifier » ou « Demander pour tout ». Même
chose pour le palier « étendu » des employés (ses accès au web ne passent pas par la carte).
Seuls restent toujours confirmés : envoyer un mail, supprimer un événement, programmer une
tâche ; et un employé qui traite un mail reçu n'a jamais le web. L'écran dit ce risque au
moment du choix (niveau d'approbation, palier « étendu »). Ne pas refaire à l'envers.

**Fait le 27/09/2026 (matin) : ce que Medhi a vu en installant sur son MacBook.**
- « Helix est endommagé » : la signature de code de l'application était fausse (celle
  d'Electron, rendue invalide par la fabrication). L'application est maintenant signée ad
  hoc en fin de fabrication, vérifiée ; macOS dit alors seulement qu'Apple n'a pas pu la
  vérifier (« Ouvrir quand même »). Installation en une commande (`scripts/installer-macos.sh`,
  empreinte et signature vérifiées) : pas d'avertissement du tout. Le seul vrai remède reste
  la signature Apple (compte Apple Developer).
- « LM Studio daemon is not running and no valid installation could be found » : l'application
  LM Studio posée par Helix n'avait jamais été ouverte. Désormais, sur un Mac à puce Apple,
  Helix pose le moteur sans interface (llmster, épinglé, empreinte vérifiée), comme sous Windows
  et Linux ; une application LM Studio posée mais jamais ouverte ne compte plus comme moteur
  (point suivant) ; l'ouverture en arrière-plan puis le nouvel essai (`backends.ts`) ne restent
  que pour une application déclarée qui refuserait de démarrer. **Vérifié sur ce Mac** : installation du
  moteur (43 s, dossier personnel temporaire). **Pas vérifié** : son démarrage sur un Mac (ce
  Mac fait tourner LM Studio pour Eden sur les mêmes ports), ni le rattrapage par ouverture.
- Même erreur au second essai sur le MacBook : l'application LM Studio posée par une version
  précédente y était restée, jamais ouverte, et comptait comme moteur installé (Helix ne posait
  donc pas llmster). `lms` ne trouve son moteur que par `~/.lmstudio/.internal/app-install-location.json`
  (premier lancement de l'application) ou `llmster-install-location.json` (écrit par
  `llmster bootstrap`, relevé sur ce Mac). Sans l'un ni l'autre, sur un Mac à puce Apple, le
  moteur compte maintenant comme absent (`moteurAPoser`, engine.ts) : l'écran de mise en route
  propose de l'installer, et c'est llmster qui est posé, à côté de l'application. Une
  application LM Studio qui a déjà servi garde la main (ce Mac, Eden). **Vérifié sur ce Mac** :
  installation de llmster (12 s) et son premier démarrage à la main ; `lms daemon up` s'y
  branche sur le port 41343 de LM Studio d'Eden, donc **pas vérifié** : le démarrage complet par
  Helix, qui ne peut s'essayer que sur un Mac sans LM Studio ouvert (le MacBook).
- Le trousseau demandait l'accès à « helix-plateforme Safe Storage » : Electron nomme la clé
  d'après le nom interne de l'application. Sur macOS, l'application installée s'appelle
  maintenant « Helix » pour le trousseau (`electron/nomTrousseau.cjs`). C'est une autre clé :
  au premier lancement, le coffre et les Chats du poste (copies comprises) sont lus avec
  l'ancienne, confiés au lancement suivant (chiffrés par une clé tirée au hasard, transmise par
  l'environnement, jamais écrite), puis rechiffrés ; chaque original est gardé à côté
  (`.cle-helix-plateforme`). Un « Refuser » ou deux échecs : l'ancien nom est gardé, rien n'est
  rendu illisible. Le dossier du profil ne bouge pas. **Vérifié** : transfert de bout en bout
  et reprise après un fichier de transfert abîmé (noms de clé d'essai, puis retirés du
  trousseau), puis sur les vraies données de ce Mac (coffre, Chats du poste et leurs trois
  copies ; sauvegarde gardée dans `~/.helix-sauvegarde-cle-20260927`). La demande du trousseau
  pour l'ancienne clé apparaît une dernière fois, au transfert. **Limite constatée** : tant que
  l'application n'est pas signée par Apple, le trousseau demande encore une fois à chaque
  nouvelle version (« Toujours autoriser ») ; il retient l'empreinte exacte d'une application
  signée ad hoc, et l'exigence de signature sur l'identifiant (commit précédent) n'y suffit pas
  (relancement d'une nouvelle construction, 27/09). Seule la signature Apple le règle.
- « La session n'a pas pu être retirée de la liste » (Helix Code) : la préparation CORS de la
  passerelle ne permettait pas DELETE. L'application installée parle depuis `helix://app`, une
  autre origine : le navigateur refusait sans rien envoyer. En développement, tout passe par le
  serveur de Vite (même origine), d'où un défaut invisible jusque-là. Même cause pour « supprimer
  une tâche programmée ». DELETE est permis, et `npm run securite` le contrôle (433 contrôles).
- MacBook, après le moteur : l'écran du modèle affichait « environ 6 Go » et ne bougeait plus.
  Le moteur posé était annoncé « prêt », ce qui fermait le suivi de la progression, alors que
  la passerelle enchaînait sur le modèle : l'écran restait sur sa première photo. Le moteur
  posé est maintenant une étape (`checking`), et l'écran se rebranche sur toute installation en
  cours qu'il trouve (écran rouvert pendant un téléchargement). Aussi : un téléchargement
  laissé par un lancement précédent n'était plus suivi (« reprise du suivi » pour toujours, et
  le modèle jamais chargé) ; Helix attend maintenant sa fin, puis charge. **Vérifié ici** : sans
  terminal, `lms get` (LM Studio 0.4.25) donne bien sa progression en pourcentage.
  **Pas vérifié** : le parcours complet sur un Mac sans moteur (le MacBook).
- Acceptation des conditions de LM Studio : « Mon entreprise accepte » ne convenait pas à un
  particulier. Relu le 27/09/2026 (version du 23/08/2026) : elles permettent l'usage personnel
  et les besoins internes d'une organisation, pas un service fourni à d'autres. L'écran dit
  maintenant « J'accepte, pour moi ou au nom de mon organisation ».
- L'autorisation d'enregistrer l'écran était demandée à chaque lancement : pour dire si le
  contrôle de l'écran était prêt, la passerelle prenait une vraie capture. Elle demande
  maintenant l'état à l'application (`systemPreferences.getMediaAccessStatus`, sans rien
  ouvrir), et macOS ne pose sa question qu'à la première action de l'agent sur l'écran. macOS
  répond « refusé » avant toute demande : tant que Helix n'a jamais tenté de capture, c'est
  compté comme « pas encore demandé ». **Pas vérifié** : la valeur réelle sur un Mac neuf.

**Fait le 27/09/2026 (après-midi) : relecture des installations par cinq agents.** Demandée par
Medhi après les essais sur le MacBook (« être sûr que les installations vont bien
fonctionner »). Cinq relectures en lecture seule : macOS, Windows, Linux, écran de mise en
route, documentation. Aucun défaut vérifié qui empêche à coup sûr d'arriver à un Chat ; une
vingtaine de défauts corrigés, détaillés dans SECURITE.md § 29.6. Les principaux, côté
personne : l'écran ne se fige plus quand le flux se coupe, « Commencer » n'apparaît qu'avec un
modèle de Chat, un refus se lit à l'écran, le repli ne télécharge plus un modèle plus lourd,
un échec essaie le modèle suivant, un moteur arrêté est dit comme tel, le téléchargement du
moteur n'est plus coupé à 30 minutes sur une connexion lente, et le script d'installation
n'efface plus une application encore ouverte. Restent, écrits dans SECURITE.md § 29.6, les
limites de Windows et de Linux qu'on ne peut essayer que sur de vraies machines. `npm run
securite` : 433 contrôles, tous réussis.

**Décidé par Medhi le 27/09/2026 : les postes installés seuls voient les nouvelles versions,
par les publications GitHub, et le dépôt devient public.** « Faut qu'on teste la mise à jour
[…] pour savoir si y'a bien la popup pour les autres PC » : jusque-là, seul un poste rattaché
à une instance recevait la fenêtre « Nouvelle version » (décision du 26/09), et un poste
installé depuis GitHub, jamais. Revient sur « aucun GitHub » pour ces postes seulement.
Ordre des sources : serveur de l'agence inscrit dans le paquet, puis instance du poste
rattaché, puis publications GitHub (`electron/sourceGithub.cjs`, `depotMisesAJour` dans
`package.json`). Sur macOS, « Installer maintenant » : l'archive décrite par
`helix-mise-a-jour.json` (écrit par `scripts/manifeste-mise-a-jour.mjs`, publié avec la
version), empreinte SHA-512 puis signature de l'éditeur vérifiées avec la clé de
l'application installée, comme depuis une instance. Sous Windows et Linux, « Télécharger »
ouvre le bon paquet (.exe, .deb, ou AppImage si c'est ainsi que Helix tourne) : rien ne
s'installe seul. Un poste rattaché sous Windows ou Linux suit toujours son prestataire.
`HELIX_SANS_MISE_A_JOUR=1` : rien n'est contacté. Avant de rendre le dépôt public :
historique relu (aucune clé, aucun jeton ; la clé privée de l'éditeur vit hors du dépôt,
`~/.helix-editeur`), et l'identité de repli de l'interface, qui portait le nom et l'adresse
de Medhi, rendue neutre. Logique vérifiée sans réseau (`scripts/essai-source-github.mjs`,
17 cas).

**Fait le 27/09/2026 (0.27.2) : OpenCode installé par Helix.** Demandé par Medhi (« tout
s'installe seul non ? »). L'écran Code, sans moteur, propose « Installer OpenCode »
(administrateur seul, au journal) : OpenCode 1.18.32 (MIT, celui avec lequel Helix Code
tourne ici), empreintes SHA-256 des six archives écrites dans `opencodePrive.ts`, posé dans
`<données>/opencode/1.18.32/`, essayé (`--version`) avant d'être mis en place, et préféré aux
autres OpenCode de la machine. La commande manuelle reste dite. **Vérifié sur ce Mac** :
installation réelle en 7 s, OpenCode démarre ; empreinte falsifiée refusée, rien de posé ;
route refusée sans séance (`npm run securite`, 435 contrôles). **Pas vérifié** : Windows et
Linux (archives relevées, pas lancées), un processeur x64 sans AVX2 (variante « baseline » non
prise).

**Fait le 27/09/2026 : OpenCode s'installe seul, sans clic.** Vu par Medhi sur un PC Windows :
le bouton « Installer OpenCode » restait une étape, alors que « tout s'installe seul ». Comme
la dictée : la passerelle pose OpenCode en arrière-plan à son démarrage et après la mise en
route du modèle (`opencodeEnFond`, `opencode.ts` ; au journal au nom de l'instance). Rien ne se
fait si un OpenCode existe déjà (celui de Helix, de la machine, ou `HELIX_OPENCODE_BIN`), si le
profil dit `"autoProvision": false`, ou si le système n'a pas d'archive épinglée ; un poste
rattaché ne lance pas de passerelle, donc rien n'y est posé. L'écran Code suit une installation
en cours ; sinon, ouvert par l'administrateur, il la lance d'office (une fois par ouverture), et
le bouton ne sert plus qu'à « Réessayer » après un échec, ou à installer quand l'office n'a pas
lieu (profil, poste rattaché). Un membre lit que l'administrateur doit l'installer. **Vérifié** :
`npm run securite` (440 contrôles, 5 nouveaux, sans réseau : rien quand le profil l'interdit ou
qu'un OpenCode existe, adresse épinglée demandée sinon, empreinte fausse refusée, passerelle
d'essai muette au démarrage, `administrateur` faux sans séance) ; installation réelle par
`opencodeEnFond` sur ce Mac, données et dossier personnel jetables : posé en 6 s, puis « déjà
là ». **Pas vérifié** : l'écran lui-même (enchaînement d'office, texte du membre), un vrai PC
Windows, et un démarrage hors ligne suivi de l'ouverture de l'écran.

**Fait le 27/09/2026 (0.27.2) : icônes de Windows et de Linux.** Vu par Medhi sur un PC :
« ancien logo pas beau » sur le bureau, et « tout petit » dans la barre des tâches. Les petites
tailles (16 à 48 px) reprenaient l'ancienne marque rouge et noire du favicon, et la fenêtre
imposait l'image de macOS, avec sa marge. Désormais (`scripts/icones/fabriquer-icones.cjs`),
Windows et Linux ont l'hélice dans un carré arrondi qui remplit l'icône, au trait épaissi aux
petites tailles (neuf tailles dans le `.ico`, de 16 à 256 px), et la fenêtre prend l'icône de
son système. macOS ne change pas. **Pas vérifié sur un vrai PC** : Windows garde parfois
l'ancienne icône en cache après une mise à jour (redémarrer l'explorateur la rafraîchit).

**Fait le 27/09/2026 : petites icônes de Windows et de Linux au trait fin.** Vu par Medhi sur
un PC : l'icône de la barre des tâches restait « encore grasse ». L'image détaillée réduite
puis épaissie faisait une tache noire de 16 à 32 px. De 16 à 64 px, l'hélice est désormais
redessinée en vectoriel (deux brins qui se croisent deux fois, pointes en haut à droite et en
bas à gauche comme le logo, barreaux à partir de 32 px), trait d'un pixel calé sur la grille ;
l'hélice détaillée reste à partir de 128 px (à 64, elle paraissait pointillée), et l'icône du Mac ne change pas (même fichier,
octet pour octet). **Vérifié** : planche avant / après, tailles réelles et agrandies, fond
clair et fond sombre. **Pas vérifié sur un vrai PC** (cache d'icônes de Windows, voir plus haut).

**Fait le 27/09/2026 (0.27.3) : Electron 44.4.5, au lieu de 33.4.11.** Relevé par `npm audit` en
préparant le dépôt public : Electron 33 n'est plus maintenu, et une trentaine de failles
publiées le touchent, dont plusieurs graves qui concernent Helix (contournement de
l'isolation de contexte, protocole personnalisé `supportFetchAPI` lisible d'une autre
origine, alors que l'interface est servie par `helix://`). Passage à la dernière version
stable (Chromium 152, Node 24.21 pour la passerelle), épinglée. Un seul changement d'API
touchait le code : l'événement `console-message` (`electron/rendu.cjs`), lu dans ses deux
formes. Electron 44 ne télécharge plus son binaire à l'installation : `node
node_modules/electron/install.js` (empreintes vérifiées par l'éditeur). `npm audit` : 0 faille,
outils de développement compris. **Vérifié sur ce Mac** : paquet construit et signé, démarrage,
coffre et Chats du poste relus, deux Chats qui répondent (modèle local). **Pas vérifié** :
Windows et Linux sur Electron 44 (construits, pas lancés).
Aussi : la fenêtre « Nouvelle version » ne se ferme plus « pour cette version » sur un clic à
côté ou Échap (vu à l'essai : un clic par mégarde la faisait disparaître jusqu'à la suivante),
seulement sur « Plus tard ».

**Décidé par Medhi le 27/09/2026 : la version est la date de publication, année.mois.jour.**
« 0.27.3 qui correspond à rien », puis « met la date du jour » : la première est la
**2026.9.27**. Toujours croissant (plus récente que 0.27.x : la fenêtre « Nouvelle version »
compare bien). Limite : une version par jour ; une seconde publication le même jour prendrait la
date du lendemain (un numéro ne peut pas redescendre). OpenClaw, regardé à la demande de
Medhi, numérote année.mois.n° ; Medhi a préféré le jour. Ne pas revenir aux 0.x.
**Précisé par Medhi le 27/09/2026 (troisième version du jour) : année.moisjour.n°.** Deux
versions étaient déjà sorties le 27 (2026.9.27, puis 2026.9.28 en date du lendemain) ; pour garder
la vraie date et publier plusieurs fois par jour, le numéro devient **année, mois et jour collés,
puis le n° de la version du jour** : 2026.927.3 (27 septembre, troisième), demain 2026.928.1,
en octobre 2026.1001.1. Toujours croissant, y compris après 2026.9.28 (927 > 9).
Aussi : les liens « Code source » et « Voir les versions publiées » des réglages menaient à
un ancien dépôt (`helix-agence/helix`) ; ils mènent au dépôt public et à sa dernière
publication.

**Fait le 27/09/2026 : dépôt public relu comme un projet ouvert.** Page GitHub (demandé par
Medhi : « aucun défaut, aucune faille ») : politique de sécurité (`SECURITY.md`, signalement
privé), code de conduite, guide de contribution en anglais, modèles de tickets et de demandes
de fusion (avec la ligne du CLA), Dependabot, Discussions, sujets, site ; README : « Pourquoi
HelixAI », « Communauté », badge de version automatique. GitHub note la santé communautaire à
100 %. Protections du dépôt : détection des secrets et blocage au push, alertes et correctifs
Dependabot, CodeQL. La première analyse CodeQL a relevé 45 alertes, relues une à une et
corrigées ou classées avec leur raison (SECURITE.md § 29.10), dont un vrai durcissement : les
mots de passe à 600 000 itérations, avec la migration des anciens à la connexion. **À faire
par Medhi** : l'image d'aperçu du dépôt (Settings, Social preview) ne se règle que dans le
navigateur.

**Fait le 27/09/2026 (2026.9.28) : seconde version du jour, pour essayer la fenêtre de mise à
jour sur le MacBook réinstallé.** Numérotée 2026.9.28 comme décidé (une seconde publication le
même jour prend la date du lendemain). Contenu : les messages de la mise à jour (erreurs,
« Vérification de la signature de l'éditeur… ») dans la langue de l'écran
(`electron/textesMiseAJour.cjs`) ; ils étaient en français seulement. Image d'aperçu du dépôt :
`docs/images/apercu-github.png` (`scripts/icones/fabriquer-apercu.cjs`), à déposer par Medhi
dans Settings › Social preview.

**Vu par Medhi le 27/09/2026 sur un PC Windows (2026.9.28) : une réponse illisible, sans fin.**
PC sans carte graphique, processeur seul, 16 Go ; moteur llmster 0.0.25-1 posé par Helix ;
modèle choisi par Helix, Qwen3.5 4B (`qwen/qwen3.5-4b`, environ 3 Go). À « Bonjour, tu vas
bien ? », la réflexion affiche « 不 » puis « 時////… » sans fin. Même parcours juste sur le
MacBook. **Cause : pas trouvée avec certitude** (rien ne peut s'essayer sous Windows d'ici).
Ce qui diffère entre les deux postes, classé du plus au moins probable :
1. **Le moteur de calcul.** Sur le Mac, MLX ; sur le PC, llama.cpp (GGUF). Qwen3.5 a une
   architecture hybride récente (« Gated DeltaNet ») dont les défauts publiés donnent
   exactement ce genre de sortie, presque tous par Vulkan, y compris sur une puce graphique
   Intel intégrée, et « justes au processeur » : llama.cpp
   [#21888](https://github.com/ggml-org/llama.cpp/issues/21888) (iGPU Intel Arc, `!"!"""`),
   [#28648](https://github.com/ggml-org/llama.cpp/issues/28648) (iGPU Arc 140V sous Windows, NaN
   dès le début, juste avec `-ngl 0`), [#20610](https://github.com/ggml-org/llama.cpp/issues/20610),
   [#27237](https://github.com/ggml-org/llama.cpp/issues/27237), et chez LM Studio une boucle
   de « / » avec Qwen 3.8 ([#2297](https://github.com/lmstudio-ai/lmstudio-bug-tracker/issues/2297)).
   Sans `--gpu`, Helix laissait LM Studio décider de la puce ; LM Studio dit laisser l'iGPU de
   côté depuis sa 0.4.17 ([notes](https://lmstudio.ai/changelog/lmstudio-v0.4.17)), mais rien
   ne dit ce qu'il fait quand c'est la seule puce du poste. Si le calcul était déjà au
   processeur, cette piste tombe, et il reste un défaut du llama.cpp processeur de Windows
   (un processeur sans AVX2 en est un connu, [ik_llama.cpp #2487](https://github.com/ikawrakow/ik_llama.cpp/issues/2487)).
2. **L'échantillonnage.** Helix n'envoyait rien : LM Studio applique le préréglage du modèle
   (température 1,0, top_p 0,95, top_k 20, pénalité de présence 1,5, [fiche](https://lmstudio.ai/models/qwen/qwen3.5-4b)).
   Le moteur MLX de LM Studio n'a pas de pénalité de présence (`mlx-engine`, relu) : la
   réponse juste du MacBook a été faite sans elle ; llama.cpp l'applique, et Qwen prévient
   qu'une valeur haute peut mêler les langues ([fiche de Qwen3.5 4B](https://huggingface.co/Qwen/Qwen3.5-4B)).
   Cela explique mal les « //// » (une pénalité les freinerait), mieux le « 不 ».
3. Le reste ne diffère pas entre les deux postes et n'est pas retenu : gabarit de réflexion,
   niveau « Moyen » (`reasoning_effort`), contexte de 32 768 jetons et `--parallel 1` (les
   mêmes sur le Mac de 16 Go qui répond juste).

**Corrigé** (sans l'avoir vu marcher sur le PC) :
- **Chargement selon le matériel** (`optionsDeChargement`, backends.ts ; `calculSurProcesseur`,
  provision.ts) : sous Windows et Linux sans carte NVIDIA vue par `nvidia-smi`, `lms load … --gpu off`.
  C'est déjà ainsi que `tientSur` choisit le modèle pour cette machine. Carte NVIDIA et Mac :
  inchangés. Contrepartie : une carte AMD ou Intel dédiée, que Helix ne reconnaît pas encore,
  calcule aussi au processeur ; `HELIX_DECHARGEMENT_GPU=auto` rend la main à LM Studio
  (docs/GUIDE.md). `--gpu` existe dans `lms` depuis longtemps (code de `lms`, relu) ; ni
  l'attention flash ni le cache quantifié n'ont d'option en ligne de commande (seulement un
  fichier de configuration du moteur, ajouté à `lms` le 25/09/2026, trop neuf pour s'y fier).
- **Échantillonnage de Qwen3.5 sous llama.cpp** (`echantillonnageLocal`, backends.ts, posé dans
  `basePayload`, chat.ts) : pour réfléchir, le profil « précis » publié par Qwen (0,6, 0,95,
  20, présence 0) ; sans réflexion, son profil général (0,7, 0,8, 20), présence 0 ; pas de
  pénalité de répétition. Seulement pour la famille Qwen3.5 (3.5, 3.6, 3.8), jamais sur un
  Mac à puce Apple, et jamais par-dessus ce que l'appelant a fixé (OpenCode, clé d'API).
- **Garde-fou** (`gardeBoucle.ts`) : un même motif de 1 à 200 caractères répété sur 600
  caractères et 25 fois au moins, ou une réflexion de plus de 160 000 caractères, et la
  passerelle coupe le flux (le moteur cesse de générer), le dit dans le Chat (« La réponse
  de … est partie en boucle… ; ce qui s'affiche au-dessus n'est pas une réponse »), propose
  de relancer, le niveau « Aucun » ou un autre modèle, et écrit une ligne au journal sans le
  contenu. Même coupure pour l'API compatible (Helix Code, clés), avec une erreur au format
  OpenAI. Un filet, pas le remède.

**Vérifié ici** : `npm run securite`, 442 contrôles (7 de plus, section 7 sexies : le
détecteur sur « 不 時//// », sur la prose du dépôt, un grand tableau et une phrase en boucle ;
la coupure devant un faux moteur qui rejoue le flux du PC, pour l'écran et pour l'API ; les
options et l'échantillonnage d'un Windows simulé ; un Mac inchangé). **Pas vérifié** : que
`--gpu off` ou l'échantillonnage suffisent sur le PC de Medhi.

**À essayer sur le PC**, dans cet ordre : installer cette version ; décharger le modèle
chargé par l'ancienne (`lms unload --all`, ou redémarrer le PC : sinon il reste en mémoire
avec ses anciens réglages jusqu'à 20 minutes d'inactivité) ; reposer « Bonjour, tu vas
bien ? ». Relever : la marque et le modèle du processeur et de la puce graphique intégrée
(Gestionnaire des tâches › Performances) ; `lms ps` pendant la réponse ; `lms runtime ls`
(quel moteur llama.cpp, CPU ou Vulkan, et sa version) ; le journal du moteur pendant la
question (`lms log stream`) ; le journal de Helix (ligne « réponse de … coupée »). Si la
sortie reste cassée au processeur : essayer le niveau « Aucun », puis Qwen3 4B (architecture
classique, sans Gated DeltaNet) pour séparer le modèle du moteur. Choisir d'office un autre
modèle sur les machines sans carte graphique irait contre la règle « la note seule décide »
(25/09/2026) : à décider par Medhi si l'essai le montre.

**Vu par Medhi le 27/09/2026 sur un PC Windows (2026.927.3) : « Copier les informations
techniques » ne faisait rien.** Cause : dans l'application de bureau, la page copiait par
`navigator.clipboard.writeText`, que Chromium soumet à la permission du presse-papiers ; la
fenêtre refuse toute permission sauf le micro (`main.cjs`), et l'échec était avalé sans un mot.
Le défaut valait sur les trois systèmes, et pour tous les boutons « Copier » (codes de secours,
manifeste Slack, blocs de code et clés d'API, adresses et codes d'invitation, transcription d'une
réunion). Corrigé : un seul utilitaire, `src/lib/pressePapiers.ts`, qui passe dans l'application
par un canal du processus principal (`electron/pressePapiers.cjs` : du texte seulement, deux
millions de caractères au plus, relu avant de répondre, depuis la fenêtre de l'application
seulement ; SECURITE.md § 29.12), dans un navigateur par `navigator.clipboard`, puis par la copie
par sélection. Chaque bouton ne dit « Copié » que si c'est vrai, et sinon le dit (dans l'aide, le
texte s'affiche sélectionné, à copier au clavier). À savoir : depuis Electron 44, le presse-papiers
du processus principal est asynchrone, relevé à l'essai. **Vérifié sur ce Mac** : dans une vraie
fenêtre Electron 44 avec le vrai préchargement et l'interface de développement (passerelle
jetable), la copie directe est bien refusée, le canal écrit, et le parcours de Medhi (connexion,
aide, clic) met les informations au presse-papiers avec « Copié » ; dans le navigateur, copie
réelle, puis échec simulé (texte affiché et sélectionné) ; `npm run securite`, 459 contrôles
(12 de plus, section 11 sexies). **Pas vérifié** : un vrai Windows ou Linux, et l'application
empaquetée ; les autres boutons « Copier » n'ont pas été cliqués un à un (même utilitaire).

**Fait le 27/09/2026 (après 2026.927.3) : un modèle qui répond mal sur un poste cède la place,
seul.** Vu par Medhi sur le même PC (processeur seul, 16 Go, llmster) : même avec `--gpu off`
et les réglages de Qwen, Qwen3.5 4B répond « 不 時////// » ; Ministral 3B, sur ce PC, répond.
Le défaut est vraisemblablement dans le moteur (llama.cpp de llmster, architecture récente de
Qwen3.5 au processeur sous Windows), hors de portée de Helix. Décidé par Medhi : « ça doit
fonctionner en fonction des PC ». Pas de règle « pas de Qwen3.5 sans carte graphique » : la
note décide toujours, mais seulement entre les modèles qui répondent juste **sur ce poste**,
et c'est un essai qui le dit (`gateway/src/santeModeles.ts`).
- **Essai à la mise en route** (provision.ts) : après `lms load`, avant « prêt », « Réponds
  seulement : bonjour » par le serveur local, sans réflexion, 64 jetons au plus, 180 s au plus
  (un processeur lent ; `HELIX_ESSAI_MODELE_MS`). Verdict : vide, boucle (`gardeBoucle.ts`, ou
  un motif court répété), moins d'une lettre sur deux, ou plus d'un tiers de lettres hors
  alphabet latin ; sans texte, la réflexion est jugée (le flux cassé du PC en était une).
  Un moteur muet ou trop lent ne condamne pas le modèle (essai « sans conclusion », noté).
  Raté : noté défaillant dans `modeles-sur-cette-machine.json` (dossier des données : raison,
  date, début de la réponse), déchargé, et le suivant de `replis` est essayé, téléchargement
  compris, comme pour un manque de mémoire (« … ne répond pas correctement sur cette machine,
  essai de … »). Un modèle défaillant n'est plus installé, recommandé ni proposé d'office
  (`classement`), ni pris en « Auto », « Rapide » ou « Approfondi » (router.ts, sélecteur) ;
  il reste choisissable à la main, avec « répond mal sur cette machine » dans le sélecteur.
  Registre illisible : rien n'est écrit par-dessus. Demander nommément un modèle défaillant
  à la mise en route le réessaie, et un essai réussi efface la défaillance.
- **En cours d'usage** (chat.ts, `apresCoupure`) : chaque réponse coupée par le garde-fou
  d'un modèle local est comptée ; une fois, « douteux » (« Si cela se reproduit, … ne sera
  plus choisi d'office ») ; deux fois, défaillant : en « Auto », la réponse suivante va au
  modèle suivant, nommé dans le message ; choisi à la main, il reste choisi, et le message
  dit comment en changer. S'il était le seul modèle : la mise en route en pose un autre en
  arrière-plan.
- **Postes déjà installés** : quinze secondes après le démarrage de la passerelle, le modèle
  conseillé, s'il est installé et jamais essayé, passe l'essai (déjà en mémoire : sans
  rechargement), et la mise en route prend le suivant s'il répond mal ; et tout modèle chargé
  par le Chat pour la première fois sur ce poste passe le même essai (`loadModel`) : raté, la
  demande échoue en le disant (« Renvoyez votre message »), et la suivante va ailleurs.
  Rien au démarrage sans moteur local qui réponde, ni quand l'intégrateur prépare les modèles.
**Sur le PC de Medhi, ce qui devrait se passer** (déduit, pas vu) : essai de Qwen3.5 4B au
démarrage, raté, Qwen3.5 4B déchargé, puis Qwen3 8B (le suivant à la note pour 16 Go au
processeur, 5 Go) téléchargé, chargé et essayé ; pendant ce temps, le Chat en « Auto » passe
à un modèle déjà là (Ministral 3B, que Medhi a installé). **Vérifié ici** : `npm run securite`, 8 contrôles de plus
(section 7 septies) : le verdict sur des réponses justes et cassées ; une mise en route
devant un faux moteur et un faux `lms` (Windows de 16 Go simulé, dossier personnel et PATH
jetables) qui rejette le modèle « 不 時////// », le note, le décharge et retient le suivant,
sans nouvel essai la fois d'après ; le PC de Medhi rejoué (Qwen3.5 4B en mémoire, essai au
démarrage, Qwen3 8B retenu, plus recommandé ensuite) ; deux coupures qui font passer « Auto »
à un autre modèle. **Pas vérifié** : sur un vrai moteur, un vrai PC, ni l'écran (sélecteur,
mise en route) dans l'application. **Reste ouvert** : un modèle noté défaillant le reste
même si le moteur se corrige plus tard (sauf à le redemander nommément à la mise en route,
ou à effacer le fichier) ; l'essai est fait sans réflexion, une panne qui ne toucherait que
la réflexion n'est prise que par le garde-fou, en cours d'usage.

**Vu par Medhi le 27/09/2026 sur le même PC Windows (2026.927.3, Ministral 3B) : « il est incapable
de lire et traiter un document », quel que soit le fichier.** Demandé : que tout document courant
soit lu et traité, par tout modèle et sur toute machine, en « double sécurité » même après un essai
qui a fini par marcher (lent). Chemin d'une pièce jointe relu de bout en bout (composeur,
`attachments.ts`, `documents.ts`, `useChat.ts`, `chat.ts`, `plan.ts`, chargement du modèle).
**Causes trouvées à la relecture** (vraies sur Mac comme sur Windows, pour tout modèle local de moins
de 45 milliards de paramètres ; aucune n'a été vue sur le PC même) :
1. **Le découpage des tâches perdait le document.** Le texte du fichier était collé devant la
   question : « résume-le » devenait une longue demande, que le tri du modèle découpait volontiers
   (« lire le document », « résumer ») ; chaque étape repart d'une reformulation de 4 000 caractères
   au plus, sans le fichier. Le modèle répondait sur un document qu'il ne voyait plus, ou cherchait à
   l'ouvrir avec un outil. Probablement la cause principale.
2. **La place n'était pas mesurée.** Jusqu'à 200 000 caractères par fichier partaient quelle que soit
   la taille de conversation chargée (32 768 jetons sur un poste de 16 Go ; 4 096 chez LM Studio pour
   un modèle chargé sans taille) : refus du moteur, ou coupure silencieuse par le moteur. PROJET.md
   annonçait « moins pour un petit modèle local » : ce n'était pas fait.
3. **La question suivante partait sans le fichier** (« et la page 3 ? »).
4. **L'envoi n'attendait pas la lecture** : un PDF se lit en plusieurs secondes sur un PC modeste, et
   une question envoyée entre-temps partait sans lui, sans rien à l'écran.
5. **Encodages de Windows** : tout fichier texte était lu en UTF-8. Un fichier UTF-16 (Bloc-notes
   « Unicode », PowerShell) arrivait illisible, un CSV d'Excel en Windows-1252 perdait ses accents.
   Une extension inconnue (.srt, .ps1, .tex…) était refusée même quand c'est du texte.
6. Word : le texte rangé dans des contrôles de contenu (`w:sdt`, documents faits d'un modèle)
   manquait ; Excel : les cellules vides décalaient les colonnes (un montant passait dans la
   mauvaise) ; plus de 300 pages ou 5 000 lignes étaient coupées sans que la puce le dise.
7. Pas un défaut : Ministral 3B est déclaré « vision » par LM Studio ; une image part donc vers lui.
   Pour un modèle sans vision, l'image est déjà remplacée par une note et l'écran le dit (contrôlé).

**Corrigé** :
- **Documents balisés, mesurés, lus en parties si besoin** (`gateway/src/documentsJoints.ts`, neuf).
  L'écran enveloppe chaque fichier dans `<document nom="…" caracteres="…">` (longueur écrite : un
  fichier qui contient « </document> » ne trompe pas la lecture ; une instance plus ancienne
  transmet la balise telle quelle, lisible). L'instance mesure la place contre la taille réellement
  chargée (`contexteDuModele`, backends.ts : `lms ps`, sinon la taille publiée par le service
  (`context_length`, `max_context_length`, `max_model_len`), le champ `contexte` d'un backend du
  profil, sinon 32 768 pour LM Studio chargé par Helix, 8 192 pour un autre serveur de la machine,
  32 768 pour un service distant) ; les jetons sont estimés (3 caractères, 1 par idéogramme), la
  réponse garde un cinquième de la place. S'il tient : en entier, avec son nom, la consigne de le
  lire directement (pas d'outil pour l'ouvrir), puis la question et la langue de la réponse. Sinon :
  **lu en parties** (coupées aux pages, feuilles, paragraphes), une demande par partie qui relève ce
  qui sert à la question, et la réponse s'appuie sur les notes ; au-delà de 24 parties, la suite
  n'est pas lue. Dans tous les cas l'écran le dit, en tête de la réponse et gardé avec elle (« lu en
  5 parties… », « seules les 24 premières… »), et suit la lecture (« partie 2 sur 5 »). Des outils
  qui prendraient la place du document sont retirés pour cette réponse, et c'est dit.
- **Jamais de découpage en étapes** quand la conversation porte un document (`chat.ts`).
- **La question suivante garde ses documents** tant que le Chat est ouvert (`useChat.ts`), au même
  endroit et avec le même texte à chaque tour, pour que le moteur réutilise ce qu'il a déjà lu (la
  lenteur vue par Medhi est d'abord la lecture du document par le processeur) ; un document lu en
  parties repart avec ses notes, sans être relu (seize gardés en mémoire). Le texte n'est pas
  enregistré avec le Chat (poids du stockage et de la synchronisation) : rouvert, le modèle sait
  qu'un fichier était joint et demande de le rejoindre.
- **Pièces jointes visibles dans le message** (demandé par Medhi) : une carte par fichier, icône du
  type, nom, poids, « lu en entier » ou « début seulement » (`PiecesJointesMessage.tsx`), gardée avec
  le Chat (`sessions.ts`, champ `pieces`, sans contenu). Le composeur montre « Lecture de … » et
  n'envoie qu'une fois les fichiers lus.
- **Extraction** : décodage UTF-8, UTF-16 avec ou sans marque, Windows-1252 (`src/lib/decodage.ts`) ;
  extension inconnue lue si ses octets sont du texte ; RTF, sous-titres, scripts Windows ajoutés ;
  Word à toute profondeur ; Excel à sa colonne ; lecture arrêtée dite « début seulement » ; image
  reconnue par son extension quand Windows ne donne pas de type ; raisons de refus traduites.

**Vérifié ici** : `npm run typecheck` ; `npm run securite`, 455 contrôles, 0 échec (8 de plus,
section 7 septies : un texte en entier, balisé et en une seule demande ; PDF, Excel, chinois et un
HTML qui contient « </document> » intacts ; un document de 52 000 caractères lu en parties à 8 192
et à 4 096 jetons, chaque partie tenant dans la conversation et chaque repère revenant au modèle par
les notes ; l'annonce et le suivi à l'écran ; la question suivante avec le document, et les notes
reprises sans relecture ; les outils retirés sur un petit contexte ; l'image refusée à un modèle
sans vision ; les encodages). Un premier passage de la batterie s'est arrêté en section 7 ter
(connexion fermée pendant les employés, sans lien avec les documents), le suivant est passé en
entier. Vu dans le navigateur contre une instance jetable et un faux modèle : cartes des pièces
jointes, CSV en UTF-16 lu juste, Chat rouvert avec ses cartes, lecture en 5 parties annoncée.
i18n à 100 % des deux côtés. **Pas vérifié** : un vrai modèle, pdf.js dans l'application Windows,
la vitesse sur le PC.

**À essayer sur le PC de Medhi** : joindre un PDF, un Word fait d'un modèle, un Excel, un CSV
enregistré par Excel et un .txt du Bloc-notes, avec Ministral 3B puis Qwen3.5 4B ; relever si la
réponse cite le contenu, le temps avant le premier mot, et, pour un long PDF, l'annonce « lu en N
parties » ; poser une seconde question sur le même fichier (elle doit être plus rapide que la
première : le moteur reprend ce qu'il a lu) ; `lms ps` pour voir la taille de conversation chargée.
Restent non lus, et dits comme tels : PDF scanné (images de pages ; les faire lire par un modèle de
vision reste à faire), PDF protégé, anciens .doc/.xls/.ppt, photo HEIC.

**Fait le 27/09/2026 : la couche de Helix pour un petit modèle qui code (2 à 8 milliards).**
Demandé par Medhi : « même un modèle de 2 ou 3 milliards de paramètres doit bien coder ; je
comprends qu'il est tout petit, mais la couche logicielle de Helix doit l'aider ». Contexte : le PC
Windows sans carte graphique, où Helix choisit Ministral 3B, Qwen3.5 4B ou Qwen3.5 2B.
**Diagnostic**, relu dans le code (ce que reçoit et doit produire un petit modèle) :
- **Cowork** : quatorze outils de fichiers (dont `read_file` en double de `read_text_file`,
  `directory_tree`, `read_multiple_files`), plus le contrôle web et les connecteurs, relus à chaque
  appel ; aucune consigne propre aux petits modèles, aucun exemple d'appel. Un appel au mauvais nom
  (« write_file » au lieu de « fichiers__write_file ») était refusé ; un JSON avec des retours à la
  ligne bruts dans le contenu d'un fichier (le cas le plus courant quand il écrit du code) était
  refusé en entier (`lireArguments` ne savait refermer que les accolades) ; un appel écrit dans le
  texte (`<tool_call>…`, ou le XML de Qwen3.5 que llama.cpp laisse parfois dans la réponse ou la
  réflexion) finissait la demande sans rien faire ; le code recopié dans la réponse au lieu d'être
  écrit n'était relancé que pour l'écran ; un fichier existant pouvait être réécrit sans avoir été
  lu ; la syntaxe de ce qui était écrit n'était contrôlée qu'à la revue finale d'un travail découpé,
  pour le web seulement.
- **Code** (OpenCode 1.18.32) : le même agent pour tous les modèles, avec `task` (un sous-agent qui
  repart d'un contexte vide), `todowrite`, `webfetch` ; OpenCode répare seul un nom d'outil écrit
  en majuscules, et renvoie tout autre appel cassé à son outil `invalid`, qui dit l'erreur au modèle
  (lu dans son code : `experimental_repairToolCall`, `session/llm.ts`). Le contrôle de fin de tour
  (`controleCode.ts`) et le séquençage existaient déjà.
**Ce que font les outils reconnus** : aider contrôle chaque fichier modifié (lint) et lance les
tests après chaque modification, puis renvoie les erreurs au modèle
([lint et tests](https://aider.chat/docs/usage/lint-test.html)), et propose le format « whole »
(fichier entier) plus simple que les différences ([formats](https://aider.chat/docs/more/edit-formats.html)) ;
SWE-agent refuse une modification qui casse la syntaxe et montre au modèle l'erreur et le fichier
d'origine, ce qui évite les erreurs en cascade, surtout des modèles faibles
([article](https://arxiv.org/abs/2405.15793)) ; la documentation de Qwen prévient que des appels
d'outils mal formés échappent à l'analyse des serveurs et conseille de les relire soi-même
([Qwen, appels de fonctions](https://qwen.readthedocs.io/en/latest/framework/function_call.html)) ;
Qwen3.5 écrit ses appels en XML, parfois dans la réflexion, puis s'arrête
([llama.cpp #20837](https://github.com/ggml-org/llama.cpp/issues/20837),
[#22684](https://github.com/ggml-org/llama.cpp/issues/22684)) ; OpenClaw a vu le même défaut avec
Qwen sous llama.cpp, contourné en relisant le texte
([openclaw #60601](https://github.com/openclaw/openclaw/issues/60601)) ; OpenCode : agents, `steps`
et permissions ([documentation](https://opencode.ai/docs/agents/)), vérifiés dans son code 1.18.32.
**Fait** (`gateway/src/petitsModeles.ts`, neuf ; branché dans `chat.ts` et `opencode.ts`) :
- **Taille** (`estPetitModele`) : 8,5 milliards ou moins, d'après `params` de LM Studio, sinon le nom
  (« ministral-3-3b », « qwen3.5-4b »), sinon le poids du fichier. Taille inconnue : pas petit.
- **Pour tout modèle, parce qu'elles n'agissent que sur un appel cassé** : nom réparé vers un outil
  **proposé** et un seul (séparateurs, préfixe oublié, noms d'autres logiciels : `cat`, `ls`,
  `str_replace`, `create_file`…) ; JSON remis en forme (retours à la ligne et tabulations bruts,
  guillemets simples, clés sans guillemets, `True`/`None`, virgules de trop, bloc ```json, objet
  encodé deux fois) ; paramètres renommés d'après le schéma (`file_path` → `path`, `old_text` et
  `new_text` à plat rangés dans `edits`). **Une chaîne jamais refermée reste refusée** (règle de la
  0.20.0 : une valeur coupée n'est jamais refermée). Ce qui a été réparé est dit au modèle avec le
  résultat (« [Note de l'instance : l'outil s'appelle… ] »), et une ligne sans contenu va au journal.
  Appels écrits dans le texte ou la réflexion (`<tool_call>` JSON, `<function=…>` XML, réponse qui
  n'est qu'un objet `{"name", "arguments"}`) lancés comme de vrais appels, vers un outil proposé
  seulement, en passant par la barrière comme les autres.
- **Contrôle après chaque écriture** (tout modèle) : la compilation JavaScript dans la passerelle
  (`syntaxeNode.ts` depuis le 28/09/2026 ; avant, `node --check` par le binaire de la passerelle en
  `ELECTRON_RUN_AS_NODE`), Python par `ast.parse` (ni import ni `.pyc`),
  `JSON.parse`, accolades CSS, scripts d'une page ; rien du code écrit n'est exécuté. Le problème
  (fichier, ligne, message) est joint au retour de l'outil ; avant la réponse finale, deux relances
  au plus par demande tant qu'un fichier reste faux, puis la réponse le dit à la personne
  (« Contrôle automatique : e.js a encore une erreur de syntaxe… », traduit).
- **Petit modèle seulement** : sept outils de fichiers au lieu de quatorze (`outilsPourPetit`) ; une
  consigne courte, numérotée, avec deux exemples d'appels réussis écrits avec les vrais noms et le
  vrai dossier (`consignePetit`) ; le code donné au lieu d'être écrit relancé une fois, avec l'outil
  exact ; **lire avant d'écrire** : réécrire ou modifier un fichier existant jamais lu ne part pas
  (ni carte d'accord), le modèle est prié de le lire d'abord, une fois par fichier. Le contenu n'est
  pas joint par la garde : la lecture passe par l'outil, donc par la barrière et les zones protégées.
- **Helix Code** : un agent `helix-petit` dans la configuration d'OpenCode, demandé par `prompt_async`
  (`agent`, via `refModele`) pour les seuls modèles marqués petits quand la configuration a été
  écrite (elle ne l'est qu'au démarrage d'OpenCode, et un modèle inconnu le fait redémarrer : l'agent
  existe donc toujours quand il est demandé). Consignes numérotées avec deux exemples dans les noms
  réels d'OpenCode (`read`, `write`, `bash` ; `filePath`, `content`) et les règles de sécurité de la
  revue du 25/09 (1 661 caractères, contre 1 731 : à peine plus court, les exemples prennent la
  place gagnée) ; `task`, `todowrite`, `todoread`, `webfetch`, `websearch`, `codesearch`, `lsp`
  refusés, donc retirés de la liste envoyée au modèle (`Permission.disabled`, vérifié dans le code ;
  `task` et `todowrite` pesaient 722 jetons à eux deux, mesure du 25/09) ; 30 tours au plus, après
  quoi OpenCode demande de conclure. Les permissions « ask » de Helix restent (un agent déclaré hérite
  des permissions globales, `agent/agent.ts`).
**Vérifié ici** : `npm run typecheck` ; `npm run securite`, 492 contrôles, 0 échec (17 de plus,
section 11 septies) : les réparations une à une (noms, JSON, paramètres, XML de Qwen3.5, chaîne
coupée refusée, rien d'inventé devant un outil non proposé ou deux candidats), les tailles, l'agent
`helix-petit` et la configuration réellement écrite pour OpenCode ; puis **de bout en bout**, une
instance jetable avec le vrai serveur de fichiers et un faux « ministral-3b » qui fait exprès les
erreurs d'un petit modèle : JSON cassé et mauvais nom, puis code faux → réparé, lancé, `node --check`
renvoie l'erreur, le modèle réécrit, le fichier final compile ; code donné au lieu d'être écrit →
relancé, puis l'appel écrit dans le texte est lancé et `bonjour.py` existe ; réécriture de `notes.md`
sans lecture → retenue, lecture sous un mauvais nom réparée, contenu d'origine gardé ; appel XML dans
la réflexion → lancé ; un modèle qui ne corrige jamais → deux relances puis la réponse le dit.
i18n à 100 %. **Ce que cela ne prouve pas** : aucun vrai modèle n'a tourné. Le faux modèle suit un
script ; qu'un vrai 3B comprenne les notes, les relances et l'exemple, et corrige juste, n'est pas
montré. Pas essayé non plus : l'agent `helix-petit` dans un vrai OpenCode (seule la configuration
écrite est contrôlée), `node --check` sous Electron et sous Windows (Python : le Python posé par
Helix, `pythonPrive.ts`), et un appel écrit dans le texte qu'un grand modèle donnerait en exemple
(il serait lancé ; une écriture passe toujours par la carte d'accord).
**Reste, écarté pour l'instant** : dans Helix Code, réparer les noms et le JSON dans le relais
(`chat.ts` retransmet le flux d'OpenCode octet pour octet ; OpenCode renvoie déjà l'erreur au modèle
par son outil `invalid`) ; un agent de code plus court encore pour 2 milliards.
**À essayer sur le PC de Medhi**, avec Ministral 3B, puis Qwen3.5 4B et 2B : dans Cowork, « crée un
fichier bonjour.py qui affiche Bonjour », « ajoute une fonction moyenne à calc.py » (fichier déjà
là : il doit être lu avant d'être réécrit), « fais une page HTML avec un bouton qui compte les
clics » ; dans Code, les deux mêmes demandes sur un dossier de projet. Relever pour chacune : fichier
juste ou non, nombre de relances, lignes « appel d'outil … réparé » et « écrit(s) dans le texte » du
journal, temps total ; et vérifier dans le journal d'OpenCode que la session tourne sous
`helix-petit`.

**Vu par Medhi le 27/09/2026 sur le même PC Windows (processeur seul, 16 Go, llmster 0.0.25,
Ministral 3B et Qwen3.5 4B) : « le modèle des fois répondait bien et des fois un truc qui n'a
rien à voir ».** Rien ne tourne sous Windows d'ici, et aucun modèle n'a été chargé sur ce Mac (son
LM Studio sert un autre projet) : tout est mesuré contre une passerelle jetable, sur un « Linux x64
de 16 Go sans carte NVIDIA » simulé (mêmes chemins de chargement que Windows), devant un faux LM
Studio qui garde chaque requête telle qu'il la reçoit et un faux `lms`. Cinq pistes examinées :
**Démontré** (ce que Helix envoie, relevé requête par requête) :
1. **Le découpage perdait la question et la conversation.** Avant chaque demande qui n'est ni une
   question courte ni une réplique, le modèle trie (« Tu organises un travail… »). S'il rend un plan,
   chaque partie ou étape partait avec la consigne système et la **reformulation** du tri, rien
   d'autre : ni les mots de la personne, ni l'échange d'avant. Mesuré : à « Liste les trois risques
   d'un prêt » puis « Développe le deuxième point en trois paragraphes pour mon associé », les trois
   parties rédigées recevaient « Rédiger un texte sur le deuxième point », sans la liste. Un 3B
   écrivait donc sur un deuxième point de son invention. Le tri se tirait en plus au sort : aucune
   température n'était envoyée, le moteur prenait la sienne, et la même demande pouvait recevoir un
   plan une fois, aucun la suivante. C'est l'explication la plus directe du « des fois » (non vue
   sur le PC). Sur huit échanges typiques, sept passaient par ce tri.
2. **Le modèle n'était pas chargé par Helix.** Le chargement à la demande de LM Studio (JIT) est
   actif par défaut, et sa documentation prévient que `/v1/models` peut alors lister tous les modèles
   téléchargés ([docs](https://lmstudio.ai/docs/developer/openai-compat/models)). Helix tenait pour
   chargé tout ce que cette liste montrait : mesuré devant un faux LM Studio qui liste ainsi, huit
   questions et **aucun** `lms load`. LM Studio chargeait alors le modèle seul, avec ses réglages
   (sa taille de conversation par défaut, quatre réponses en parallèle, [docs](https://lmstudio.ai/docs/app/advanced/parallel-requests),
   la puce graphique à sa guise, donc sans le `--gpu off` du 27/09) et sans l'essai de
   santeModeles.ts, pendant que Helix, lui, comptait sur 32 768 jetons pour mesurer les documents.
   En « Auto », tous les modèles listés passaient pour chargés, et le choix entre eux suivait l'ordre
   de la liste. Que llmster 0.0.25 liste bien ainsi sur le PC n'est pas vu (documenté, pas mesuré).
3. **La conversation n'était jamais mesurée** : seuls les documents l'étaient. Mesures (3 caractères
   par jeton, l'estimation de Helix) : consigne système de l'écran environ 300 jetons ; huit
   échanges avec des réponses de 1 200 caractères, 3 400 jetons à la huitième question (1 000 à la
   troisième) ; le tri, jusqu'à 1 800 jetons. À 32 768 jetons, chargés par Helix, une conversation
   ordinaire ne déborde pas. À 4 096 (un modèle chargé par LM Studio lui-même, cas 2), la septième
   question et sa réponse ne tiennent plus : c'est LM Studio qui coupait, selon sa politique de
   dépassement, sans que personne sache ce que le modèle voyait encore.
4. **Ministral 3B répondait à la température du moteur.** Mistral conseille 0,1 (« We recommend
   starting with a Temperature of 0.1 for most use cases », [carte du modèle](https://huggingface.co/mistralai/Ministral-3-3B-Instruct-2512)) ;
   Helix n'envoyait rien. Les réglages de Qwen3.5 (0,6 ou 0,7, top_p 0,95 ou 0,8, top_k 20, sans
   pénalité) étaient déjà posés le 27/09 et n'ont pas changé.
**Corrigé** :
- **Le découpage garde la conversation** (`chat.ts`, `fondation` ; `historique.ts`,
  `derniersEchanges`) : chaque partie et chaque étape reçoit les derniers échanges (six messages, un
  quart de la place au plus, en tours complets), et l'objectif du tri est toujours suivi de la
  demande mot pour mot (`avecDemande`, plan.ts). Le tri se fait à 0,2 au plus.
- **Ce qui est en mémoire, c'est `lms ps` qui le dit** quand il répond (`discover`, backends.ts) :
  un modèle listé mais absent est chargé par Helix, avec ses réglages et l'essai. Si `lms ps` ne
  répond pas, rien ne change (la seconde copie « qwen3-8b:2 » du 23/09 reste évitée). Le compte
  rendu des réunions et les autres appels de `completion.ts` chargent aussi le modèle eux-mêmes.
- **La conversation tient dans sa place, coupée par Helix** (`historique.ts`, branché dans
  `chat.ts` pour l'écran) : place = taille chargée (`contexteDuModele`) moins la réponse (un
  cinquième), la marge et les outils ; au-delà, les plus anciens échanges partent, un tour entier à
  la fois (jamais un résultat d'outil sans son appel, reprise toujours sur un message de la
  personne, comme le gabarit de Mistral l'exige), jamais la consigne système ni la question ; le
  modèle en est averti dans sa consigne, et la personne le lit en tête de la réponse (« Ce Chat est
  long : les 4 premiers messages n'ont pas été relus… »). Dans une boucle d'outils, les plus anciens
  résultats sont abrégés, le dernier reste entier. Seulement quand la taille est sue (LM Studio, ou
  une taille publiée ou écrite dans le profil) : un cluster exo ou un grand modèle distant sans taille
  connue n'est pas raccourci sur une supposition.
- **Ministral 3 (3B, 8B, 14B, instruct)** : température 0,1 sur tout moteur (`echantillonnageLocal`).
- **Au processeur seul, une réponse à la fois quelle que soit la mémoire** (`optionsDeChargement`) :
  `--parallel 2` restait posé sur un PC de 17 à 36 Go sans carte graphique.
**Calcul des tailles au chargement, sans carte graphique** (vérifié en simulant 8 et 16 Go) : dans
les deux cas `--context-length 32768 --parallel 1 --gpu off`, et Qwen3.5 4B conseillé. Mémoire du
cache de conversation à 32 768 jetons (en f16, d'après les `config.json` publiés) : Ministral 3B,
26 couches × 8 têtes × 128 × 2 × 2 octets = 104 Kio par jeton, **3,5 Go** ; Qwen3.5 4B (8 couches
d'attention sur 32, le reste récurrent) 32 Kio par jeton, 1,1 Go. Avec les poids (2,5 et 3 Go
environ) : 6 Go et 4 Go. Tient sur 16 Go ; sur 8 Go, Ministral 3B à 32 768 jetons laisse peu à
Windows. Non changé (la règle « jamais moins de 32 768 », 24/09, sert Helix Code) : **à décider par
Medhi** si un PC de 8 Go le montre.
**Examiné, non retenu ou non démontré** :
- **Requêtes simultanées** : dans le Chat, rien ne part en même temps que la réponse (le titre est
  tiré de la question sur le poste, le tri et la lecture des documents précèdent la réponse, l'une
  après l'autre ; pas d'appel pour les suggestions ni la mémoire). Deux Chats ouverts partent bien
  ensemble (mesuré : les deux requêtes se chevauchent au moteur), comme l'essai du modèle quinze
  secondes après le démarrage ou une tâche programmée. Avec `--parallel 1`, désormais assuré puisque
  Helix charge lui-même, llama.cpp les sert l'une après l'autre. Qu'un moteur mêle deux
  conversations est une **hypothèse** sans preuve (un défaut de llama.cpp sur l'architecture
  récurrente de Qwen3.5 en parallèle n'est pas exclu, pas trouvé écrit) ; ce qui est sûr, c'est que
  le tri, requête différente, oblige le moteur à relire toute la conversation à la question suivante
  (un seul emplacement) : du temps, pas une erreur.
- **Changement de modèle en cours de conversation** (« Auto », essai raté, garde-fou) : le modèle
  suivant reçoit tout l'historique, envoyé par l'écran à chaque question ; une réponse coupée ou en
  erreur n'y est pas renvoyée (`useChat.ts`). Rien de mal reconstruit. Le seul changement de modèle
  involontaire relevé était celui du cas 2, corrigé.
- **Construction des messages** : un seul message système (les consignes s'y ajoutent), rôles dans
  l'ordre, pas de résultat d'outil orphelin dans l'historique de l'écran, documents d'un Chat fermé
  non renvoyés, mémoire limitée à ce que la personne a enregistrée. Rien trouvé.
- **Politique de dépassement de LM Studio** (`truncateMiddle`, `stopAtLimit`, `rollingWindow`) :
  celle qu'applique llmster au serveur n'a pas été vue ; elle ne compte plus, Helix ne dépassant plus.
**Vérifié ici** : `npm run typecheck` ; i18n à 100 % des deux côtés ; `npm run securite`, 649
contrôles, 0 échec, dont la section 7 decies : dix contrôles, tous en échec sur le code d'avant (rejoué
sur une copie du dépôt) et réussis après : le modèle listé mais pas chargé est chargé par Helix
(32 768, `--parallel 1`, `--gpu off`) ; température 0,1 pour Ministral, tri à 0,2 au plus ; huit
échanges à 4 096 jetons raccourcis sous la place, consigne et question gardées, alternance respectée,
annonce à l'écran ; les parties d'un plan avec l'échange d'avant et la demande mot pour mot ; les
fonctions seules ; `--parallel 1` à 32 Go sans carte graphique. Un onzième contrôle, ajouté après
qu'une fenêtre « Trousseau introuvable » s'est ouverte sur ce Mac pendant les essais du jour : la
section tourne avec un dossier personnel jetable, une clé par fichier et un faux `security` en tête
du PATH, et vérifie que le trousseau n'a jamais été appelé (section rejouée seule après cet ajout :
11 sur 11 ; la batterie entière, 649 sur 649, l'a été juste avant). Les autres passerelles de la batterie
(instance principale, sections 10 et 11 septies, essai des fournisseurs) gardent le dossier personnel
réel et le trousseau : **à décider** si elles passent elles aussi à la clé par fichier.
**Pas vérifié** : un vrai modèle, llmster, Windows ; la liste réelle de `/v1/models` de llmster ; ce
que fait un vrai 3B du contexte rendu.
**À essayer sur le PC de Medhi**, avec Ministral 3B choisi à la main, puis en « Auto » :
1. Avant : `lms ps` (noter la taille de conversation `CONTEXT` du modèle chargé) et, pendant une
   question, `lms log stream`.
2. Une conversation de dix échanges qui s'appuie sur ce qui précède : « Liste les trois risques
   principaux d'un prêt bancaire pour une TPE », puis « Développe le deuxième point en trois
   paragraphes pour mon associé », « Reformule-le de façon plus formelle », « Ajoute une phrase sur
   la trésorerie », « Traduis-le en anglais », et ainsi de suite. Relever : si chaque réponse parle
   bien de ce qui précède ; si « Développe… » est rédigé en parties (intertitres « ## ») ; le temps
   avant le premier mot.
3. Dans le journal de Helix : au premier message, « … chargé par Helix : --context-length 32768
   --parallel 1 --gpu off » (ligne ajoutée ce jour ; sans elle, et si `lms ps` montre une autre
   taille, le modèle a été chargé par LM Studio lui-même) ; « essai de … sur cette machine » ; « conversation de ~… jetons pour … de place » (seulement si
   elle a été raccourcie) ; « documents joints (…, contexte …) ».
4. Laisser le PC vingt minutes sans rien demander (le modèle est libéré), puis reposer une question
   dans le même Chat : `lms ps` doit montrer de nouveau 32 768, et le journal un nouveau `lms load`.
5. Si une réponse est encore hors sujet : noter la question exacte, le modèle, la ligne `[chat]` du
   journal juste avant, et la sortie de `lms log stream` (ce que le moteur a reçu, au début de
   l'invite).

**Fait le 28/09/2026 (pour la 2026.928.2) : le japonais, quatrième langue.** Demandé par Medhi.
- **Traduit** : les 2 936 phrases de l'interface (`src/i18n/ja.json`) et les 966 de la passerelle
  (`gateway/i18n/ja.json`), à 100 % selon `npm run i18n` et `node scripts/i18n-passerelle.mjs`,
  plus les tables d'Electron (`textesMiseAJour.cjs`, `zoneNotification.cjs`). Registre poli
  (です／ます), « Chat » rendu par チャット, noms de produits et commandes laissés tels quels.
  Parti du français, pas de l'anglais. Les phrases coupées en morceaux autour d'une valeur
  (`{t("Invitation envoyée à")} {email}{t(". Le mail…")}`) ont été traduites en lisant la ligne
  de code qui les assemble, pour que la suite japonaise se lise dans l'ordre imposé par le
  français. Relecture par une personne dont c'est la langue : **pas faite**.
- **Branché** : « 日本語 » dans Réglages, Préférences (quatre choix, deux colonnes à 375 px) ;
  un système en japonais est suivi ; `X-Helix-Langue: ja` (et `?langue=ja`) à la passerelle ;
  `helix:langue` accepte `ja` ; dates et nombres en `ja-JP`, et une installation neuve en
  japonais affiche les dates année d'abord (2026-09-28) ; les nombres de l'usage et de
  l'abonnement, et le mois du calendrier, suivent désormais la langue (ils étaient en `fr-FR`
  pour tout le monde). Une demande en japonais n'est plus prise pour du chinois (`plan.ts` :
  les kana tranchent), la réponse est demandée en japonais.
- **Police** : sous `:root:lang(ja)`, Hiragino, Yu Gothic, Meiryo puis Noto Sans JP après
  Satoshi (`tokens.css`) ; le chinois garde la pile d'avant. Vérifié dans le navigateur :
  kanji et kana s'affichent, `lang="ja"` sur la page.
- **Vu à l'écran** (instance jetable, clé en fichier, LM Studio et exo éteints, Vite, navigateur
  intégré) : premier lancement, création du compte, puis les 26 écrans principaux et pages de
  Paramètres, à 375 px et à 1 440 px, thème clair et sombre, avec un relevé automatique des
  textes coupés et des phrases restées en français. Corrigé : les trois onglets du haut de la
  barre (« チャット » prend 52 px contre 29 pour « Chat ») se coupaient, marge réduite en
  japonais seulement ; libellés d'outils de Cowork raccourcis en noms ; compteurs d'onglets en
  parenthèses demi-chasse (les quatre onglets des agents tiennent à 375 px). Les pastilles de la
  zone de saisie se replient à 375 px comme en anglais, qui déborde davantage.
- **Contrôlé** : `npm run securite`, section « 15 ter. Japonais » (passerelle en japonais par
  en-tête, par adresse, `ja-JP` ramené à `ja`, refus sans séance en japonais, anglais par défaut
  inchangé, catalogues à 100 % avec leurs `{0}`, tables d'Electron, pile de polices, détection
  d'une demande japonaise). `README.ja.md` ajouté, lien dans la ligne des langues des trois autres.
- **Reste** : relecture native ; le texte d'aide « Changer la langue » et le résumé « Français,
  anglais, chinois. » disent encore trois langues en français, anglais et chinois (seule la
  version japonaise en cite quatre) : changer la phrase française change la clé, à reporter dans
  les trois catalogues ; restent en français dans toutes les langues, faute de `t()` : l'aperçu de
  suppression du compte (« document », « dossier », « projet ou partage »), le résumé d'export
  (« conversation », « projet »), « ISO (AAAA-MM-JJ) » et « 12 heures » dans Préférences,
  « basse d'abord », « ne figure(nt) », « En attente » dans Tâches, « dont » dans l'usage, les
  codes de secours restants, « , et N autre(s) » d'une tâche bloquée, « interne » dans l'écran
  Courrier ; l'application de bureau, la zone de notification et le menu en japonais ne sont pas
  vus (pas d'Electron lancé) ; une vraie réponse de modèle en japonais pas essayée.

**Fait le 30/09/2026 : l'espagnol, l'allemand et l'arabe ; l'arabe de droite à gauche.** Demandé
par Medhi : sept langues (français, la source ; anglais, chinois, japonais, espagnol, allemand,
arabe). Le travail est coupé en deux : les catalogues (`src/i18n/{es,de,ar}.json`,
`gateway/i18n/{es,de,ar}.json`) sont traduits à part et posés à la fusion ; ce qui suit est tout le
reste. **Les vrais catalogues sont posés depuis le 30/09/2026** (voir « Suite du 30/09 » à la fin
de cette section) ; ce qui est dit plus bas des « phrases encore en anglais » décrit l'état d'avant.
- **Décision : de droite à gauche par propriétés logiques, pas par une seconde feuille de style.**
  `dir="rtl"` et `lang="ar"` sont posés sur `<html>` par `src/lib/i18n.ts`, au chargement du
  module, donc avant le premier rendu (`ltr` est écrit aussi, pour les six autres langues). La mise
  en page suit parce que les classes disent « début » et « fin » de ligne (`ms-`, `pe-`, `start-`,
  `end-`, `text-start`, `border-s`, `rounded-ee`) et non « gauche » et « droite » : environ 240 classes
  converties dans 70 fichiers environ de `src/`, toutes celles que la recherche a trouvées, pas seulement
  les écrans principaux. ADR-076.
- **Ce qui reste physique, et pourquoi** : `Popover.tsx` (le placement se calcule en pixels
  d'écran ; le sens d'écriture y entre une fois, « début » devenant le bord droit du bouton en
  arabe) ; l'interrupteur (`Switch.tsx`, un glissement, retourné par `rtl:-translate-x-…`) ; les
  centrages `left-1/2 -translate-x-1/2` (symétriques) ; le bouton de copie d'un bloc de code
  (`ClesApi.tsx`, `SlackConnecteur.tsx` : le bloc reste de gauche à droite, son bouton reste à sa
  droite) ; `Select.tsx` (liste posée en pixels sous son bouton, de la même largeur) ; les
  graphiques SVG (le temps se lit de gauche à droite ; sans `direction: ltr`, `text-anchor`
  suivait la page et les dates de l'axe de « Mon usage » sortaient du cadre, vu à l'écran).
- **Ce qui reste de gauche à droite dans une page arabe** (`styles/index.css`, règles sous
  `[dir="rtl"]` seulement) : `code`, `kbd`, `samp`, tout ce qui porte `font-mono` (chemins,
  commandes, jetons, versions, noms de modèles), les champs `url`, `email`, `password`, `tel`,
  `number`, la valeur d'`ACopier`. Un `<pre>` sans police de code (trace d'outil, rapport à
  envoyer) prend le sens de chaque ligne (`unicode-bidi: plaintext`). Les icônes qui montrent une
  direction se retournent (chevrons, flèches retour et suivant, envoi en avion, connexion,
  barre latérale), par `scale: -1 1` pour ne pas écraser une rotation ; la règle est **hors de
  `@layer`**, où Tailwind la retirait (les classes `lucide-…` ne figurent pas dans le code : vu à
  l'écran, les flèches ne se retournaient pas). L'espacement des lettres est annulé en arabe
  (l'écriture est liée).
- **Ce que la personne écrit et ce que le modèle répond** : `dir="auto"` sur la bulle, sur chaque
  bloc de la réponse (`TexteRiche`), sur la zone de saisie (dès qu'elle contient du texte) et sur
  un message en attente. Une réponse en arabe dans une interface française part donc de la
  droite, ce qui change l'affichage des six autres langues sur ce seul point, voulu.
- **Dates, nombres** : locales `es-ES`, `de-DE`, `ar-u-nu-latn` (chiffres occidentaux, calendrier
  grégorien : « سبتمبر 2026 », mesuré avec Node 24). « 12/09/2026 14:05 », « 2:05 PM » et
  « 1,2 MB » sont isolés (U+2066, U+2069) en arabe seulement, sans quoi la ligne les range à
  l'envers (« PM 2:05 »). Format de date par défaut : jour d'abord, comme en français.
- **Polices** : aucune embarquée ni téléchargée. Sous `:root:lang(ar)`, Geeza Pro (macOS), Segoe UI
  (Windows), Noto Sans Arabic, Noto Naskh Arabic, Tahoma, placées avant le repli calé sur Arial,
  qui a des lettres arabes et les aurait prises.
- **Passerelle** : `X-Helix-Langue`, `?langue=` et `Accept-Language` acceptent `es`, `de`, `ar`
  (`gateway/src/langue.ts`, liste `LANGUES`) ; les nombres des descriptions de `provision.ts`
  suivent la locale ; une demande écrite en arabe, en espagnol ou en allemand est reconnue
  (`plan.ts`), et la réponse demandée dans cette langue. L'espagnol et l'allemand ne l'emportent
  que s'ils battent nettement le français et l'anglais (« de », « la », « un » sont aussi français).
- **Electron** : `helix:langue` et la langue du système acceptent les sept ; les 24 messages de
  mise à jour, les 11 raisons de refus d'une signature et les 18 textes de la zone de
  notification et du menu sont traduits dans les trois langues (espagnol au « tú », allemand au
  « Sie », arabe standard, noms de produits en caractères latins), sans relecture native.
- **Aide intégrée** : « Changer la langue » cite les sept langues et dit le sens de l'arabe. **Deux
  clés françaises ont changé** (le résumé et le corps de cette fiche) : traduites ici dans les six
  catalogues, elles sont à reporter dans les vrais catalogues es, de et ar à la fusion, sans quoi
  `node scripts/i18n.mjs` les dira manquantes.
- **Contrôlé** : `npm run securite`, sections « 15 ter bis » (la passerelle répond dans les trois
  langues, par en-tête, par adresse, par `Accept-Language`) et « 44 » (sept langues déclarées
  dans l'interface, la passerelle, Electron et les relevés ; `dir` posé ; catalogues es, de, ar
  aux clés d'`en.json`, trous `{n}` gardés ; aucun caractère de direction dans `ar.json` ; règles
  de la feuille de style ; aucune classe physique dans 22 composants partagés ; détection de la
  langue d'une demande ; motifs du § 15 quinquies dans les trois langues).
- **Vu à l'écran** (instance jetable, faux modèle, Vite, navigateur intégré), en arabe forcé, les
  phrases encore en anglais : écran de connexion et saisie du mot de passe, accueil du Chat, une
  conversation (question et réponse en arabe, puis en français : listes, code en ligne, bloc de
  code, citation), barre latérale dépliée et en rail, Réglages (Préférences, Connecteurs,
  Abonnement, Mon usage, API développeur), Agents, Tâches (tableau et fenêtre « Nouvelle tâche »),
  Cowork, Code, choix du modèle et notifications ; à 1280 px en clair, à 375 px en sombre. Un
  relevé automatique sur 27 écrans, aux deux largeurs : aucun élément hors de la fenêtre, aucun
  défilement de côté autre que ceux prévus (onglets des Réglages, tableau des tâches, blocs de
  code). **Français, avant et après** : la position et la taille de chaque élément de ces 27
  écrans et de la conversation, comparées entre le code d'avant et celui-ci (deux Vite sur la
  même passerelle), à 1280 et 375 px : identiques, hors les trois cartes de langue ajoutées, le
  logo animé et les lignes arabes de la conversation (alignées à droite, voulu).
- **Reste** : relecture des trois langues par des personnes dont c'est la langue (catalogues et
  textes d'Electron) ; **la ligne de commande (`cli/`) et l'extension VS Code
  (`extensions/vscode/`) restent en français seulement** ; pas de sélecteur de langue sur l'écran
  de première ouverture ni sur l'écran de connexion (la langue du système y est suivie, comme
  avant) ; **pas regardés en arabe** : l'écran de première ouverture et le choix de
  l'instance, Bibliothèque, Réunions, Groupes, Projets, Modèles, les autres pages de Réglages,
  les cartes d'accord de Cowork et de Code, la file d'attente du Chat, le panneau de suivi de
  Code, le comparateur de modèles, les fenêtres autres que « Nouvelle tâche », l'aide, le thème
  sombre à 1280 px et le clair à 375 px (le relevé automatique les a parcourus, pas l'œil) ;
  l'application de bureau en arabe n'est pas vue (pas d'Electron lancé) : sous macOS, les
  pastilles de la fenêtre restent à gauche alors que la barre latérale passe à droite, elles se
  posent alors sur la poignée vide de la zone principale, à regarder sur le poste ; le menu et
  la zone de notification de Windows et de Linux dans les trois langues non plus ; l'écran avec
  de vraies phrases arabes (longueurs, coupures) est à reparcourir une fois les catalogues posés ;
  une vraie réponse de modèle dans ces langues pas essayée. Les phrases anglaises affichées dans
  une page arabe montrent leur point final à gauche (« .Choose your account ») : c'est l'effet des
  copies provisoires, il disparaît avec les phrases arabes.

**Suite du 30/09/2026 : les vrais catalogues, les README, les captures.**
- **Catalogues** : `src/i18n/{es,de,ar}.json` (3 893 phrases) et `gateway/i18n/{es,de,ar}.json`
  (1 503) sont de vraies traductions, harmonisées par langue sur un glossaire (espagnol au « tú »,
  « Ajustes », « agentes siempre activos » ; allemand au « Sie », « Einstellungen », « dauerhaft
  aktive Agenten » ; arabe standard, « الإعدادات », « الوكلاء الدائمو العمل », noms de produits et
  code en caractères latins). Les 18 textes de la zone de notification (`electron/zoneNotification.cjs`)
  disaient « empleados », « Mitarbeiter », « الموظفون » : alignés sur ce glossaire.
- **Phrases assemblées** : « Retirer X ? Ses missions… » (`Employes.tsx`) était collée de trois
  morceaux, ce qui donnait un ordre faux en allemand, en japonais et en arabe : une seule clé
  `Retirer {0} ? …`. La durée d'une mission (« 38 s », `Employes.tsx`) et celle d'une réunion
  (« 1 h 05 », `reunions.ts`) étaient écrites en dur : elles passent par `tf()` (vu à l'écran en
  arabe : « s 38 » avant, « 38 ث » après).
- **README** : `README.es.md`, `README.de.md`, `README.ar.md` (ce dernier enveloppé dans
  `<div dir="rtl">`, blocs de code et badges en `dir="ltr"`), mêmes titres, liens, images et blocs
  de code que `README.md` ; le sélecteur des sept langues est dans les sept README.
- **Captures** : `scripts/captures/scenes/{es,de,ar}.mjs` (mêmes scores de recherche que la scène
  anglaise : 0,77 et 0,58 pour la question seule, le reste à 0), 9 images par langue dans
  `docs/images/{es,de,ar}/`, refaites par `node scripts/captures/capturer.mjs --langue <l>`.
  Regardées à l'œil : Chat, Agents, Code et Mon usage en arabe, Chat en allemand, Chat et Agents
  en espagnol.
- **Tournée des écrans avec les vraies phrases** (instance jetable, arabe à l'œil ; allemand et
  espagnol par relevé automatique des débordements et des phrases françaises) : premier lancement,
  connexion, Projets, Fichiers, Réunions, Groupes, Tâches (kanban, tableau, calendrier, création),
  Agents, Chat et ses menus, partage, aide, notifications, Cowork, Modèles, les 17 pages des
  Réglages. Corrigé, **dans les sept langues** : les en-têtes de tableau s'étaient centrés depuis
  le passage de `text-left` à `text-start` (`th { text-align: inherit }`, `styles/index.css`) ; le
  menu « … » d'un fichier coupé quand la liste est courte ; les jours du calendrier des Tâches
  écrits en français ; des dates dans la langue du système (`TachesProgrammees.tsx`,
  `EntrainerModele.tsx`) ; le bouton micro des Réunions traduit « Save » (clé « Enregistrer au
  micro ») ; une dizaine de libellés de lecteur d'écran et les adresses d'exemple des champs restés
  en français. **En arabe** : `enumerer()` (`src/lib/i18n.ts`) isole chaque mention d'une ligne
  « a · b · c » (le « 7 » de « 7 Go » partait à l'autre bout) ; titre de Chat latin coupé par le
  début dans la barre latérale ; « {0}% » recollé. Traductions fausses : « Depuis {0} » (sens
  temporel en allemand et en arabe).
- **Phrases entières autour du nom du produit** (demandé par Medhi le 30/09/2026) : 54 endroits
  assemblés par morceaux (`{t(...)} {branding.name} {t(...)}`) sont réunis en 51 clés à trou dans
  19 fichiers (`FirstRun.tsx`, `ParametresPages.tsx`, `DriveGoogle.tsx`, `SlackConnecteur.tsx`…),
  traduites en entier dans les six catalogues (verbe en deuxième position en allemand, verbe en
  tête en arabe) ; le texte français affiché ne change pas. Dans « À propos », la licence garde sa
  mise en valeur : la phrase traduite est coupée sur un marqueur mis à la place du trou.
- **Listes de noms** : `lister()` (`src/lib/i18n.ts` et `gateway/src/langue.ts`) joint par « ، »
  en arabe (chaque nom isolé), « 、 » en chinois et en japonais, « , » ailleurs : une vingtaine de
  listes à l'écran, 10 dans les messages de la passerelle. Laissées en virgule latine : les valeurs
  techniques (portées OAuth), les journaux, ce qui est écrit pour le modèle.
- **Vu, laissé** : « Version X téléchargée et vérifiée. » (`MiseAJour.tsx`) et une phrase de
  `SlackConnecteur.tsx` restent assemblées (sans nom de produit) ; adresses d'exemple techniques
  en `.exemple.fr` ; date et heure sur deux lignes dans le journal d'activité.
- **Pas atteints dans cette tournée** : la file d'attente du Chat et une réponse en cours (il faut
  un modèle), une séance de Code, les fiches d'agents toujours actifs (vues dans les captures),
  l'installation d'une instance distante, la double authentification, les connecteurs une fois
  branchés, la fenêtre de mise à jour, les fenêtres modales en allemand et en espagnol.
- **Reste** : le rendu de `README.ar.md` sur GitHub (pas vu avant la poussée) ; dans un compte
  rendu d'agent en arabe, une parenthèse qui mêle noms latins, références et montants se range
  mal (« INV-0917، 342.60) Harbour Café يورو ») : c'est le texte de la donnée, pas l'interface ;
  les libellés de macOS et de Windows cités dans les trois README (« Ouvrir quand même »,
  « Toujours autoriser ») sont traduits sans avoir été lus sur un système dans ces langues ;
  relecture par des personnes dont c'est la langue.

**Fait le 04/10/2026 : Cowork a ses sessions, comme Code.** Demandé par Medhi : « comme la
session Code, il doit avoir une session Cowork, car partir du Chat renvoie à l'interface
normale ». Ce qui manquait, dans le code : une conversation de Cowork était un Chat comme un
autre (`useChat` sans marque, `CoworkPage.tsx`) ; la barre latérale montrait en Cowork la liste
des Chats (`Sidebar.tsx`, seul Code avait la sienne), où la session de Cowork se mêlait aux Chats
et se rouvrait dans le Chat (`/?c=`), sans outils ni dossier ; « Nouveau Chat » menait au Chat ;
`CoworkPage` ne lisait aucune adresse, et revenir dans Cowork donnait un Cowork vierge. Fait :
- une session de Cowork est un Chat marqué `surface: "cowork"` dans le même stockage
  (`store/sessions.ts`, pas de second registre), avec le dossier de travail de sa dernière demande
  (`dossier`, « poste » pour tout le poste). Les Chats et Cowork ont chacun leur liste
  (`useSessions(surface)`) : **changement voulu** de l'existant, les sessions de Cowork ne sont
  plus dans la liste des Chats, parce qu'elles y perdaient leurs outils. Les conversations de
  Cowork d'avant ce jour n'ont pas la marque et restent dans les Chats ;
- en Cowork, la barre latérale montre « Sessions de Cowork », les plus récentes en haut, avec les
  gestes d'un Chat (renommer, partager, archiver, supprimer, archives repliées) ; « Nouvelle
  session » en tête ; la recherche filtre les sessions ;
- l'adresse dit la session affichée (`/cowork?c=<id>`) ; revenir dans Cowork depuis le Chat
  rouvre la dernière session affichée dans la fenêtre (gardée en mémoire de la fenêtre, pas sur
  le disque : au lancement suivant, l'accueil et la liste) ; une session de Cowork demandée à
  l'adresse d'un Chat (lien ancien, notification de partage) s'ouvre dans Cowork, et un Chat
  demandé dans Cowork s'ouvre dans le Chat ; la session supprimée pendant qu'on la regarde
  ramène à l'accueil ;
- rouvrir une session reprend sa conversation et ses bases de connaissances. Le dossier, non :
  c'est un réglage de l'instance commun à tous ses agents (et protégé par le mot de passe sur
  une instance partagée) ; si la session travaillait ailleurs, l'écran le dit et propose
  « Reprendre ce dossier » (seulement pour ses propres sessions) ;
- aide intégrée (article Cowork) et six catalogues (100 %).

*Vu à l'écran* (instance jetable, faux moteur, Vite, navigateur à 800 et 1 280 px), en français
puis en arabe de droite à gauche : demande écrite dans Cowork, la session apparaît dans
« Sessions de Cowork » et l'adresse la désigne ; passage au Chat (liste des Chats sans elle) ;
retour à Cowork par la pastille : la session est rouverte avec sa conversation ; « Nouvelle
session » puis clic dans la liste : rouverte ; `/?c=<session de Cowork>` renvoie à Cowork ; un
Chat ordinaire n'apparaît que dans les Chats ; dossier de l'instance changé : l'encart apparaît,
« Reprendre ce dossier » remet le dossier et l'encart disparaît ; page rechargée après avoir
effacé la copie locale des Chats : la marque et le dossier reviennent de l'instance.
*Pas vu* : une vraie réponse avec outils (faux moteur, texte seul), une réponse encore en cours
quand on quitte Cowork puis y revient, une session partagée ouverte par une collègue, le rail
replié, l'application Electron, Windows ; `npm run securite` n'a pas tourné (consigne mémoire
du 04/10/2026) : à passer avant la prochaine version.

**Fait le 04/10/2026 : plus aucun agent ne se déploie sous Windows après en avoir retiré un.** Vu
chez Medhi : « EPERM: operation not permitted, realpath '…\\agents\\helix-test\\agent\\openclaw-agent.sqlite' »,
l'agent « test » ayant été retiré avant. Cause, déduite du message et du code (pas reproduite sur
un Windows) : `retirer` effaçait le dossier de l'agent pendant que l'instance OpenClaw tenait sa
base ouverte ; sous Windows le fichier reste alors « en attente de suppression » tant que le
processus vit, et toute commande OpenClaw qui parcourt les agents bute dessus (Node le dit EPERM
sur `realpath`). macOS et Linux effacent un fichier ouvert sans histoire. Corrigé dans
`employes.ts` : sous Windows, l'instance est arrêtée avant d'effacer les dossiers de l'agent, puis
relancée s'il en reste (`reconfigurer`) ; et pour les postes déjà coincés, une commande qui échoue
sur ce motif précis (`FICHIER_AGENT_COINCE`) arrête et relance l'instance, ce qui libère le
fichier, puis est refaite une fois (rien n'est effacé à cette occasion). Contrôlé par la section 45
de `npm run securite`. Sur un poste coincé, quitter Helix (« Quitter » dans la zone de
notification) suffit aussi : l'instance s'arrête avec lui.

**Fait le 02/10/2026 : l'écran Code ne s'ouvre pas sous Linux (« Réessayer »).** Signalé par
Medhi. « Réessayer » n'existe que sur l'écran d'installation d'OpenCode (`InstallerOpencode.tsx`) :
c'est l'installation qui échouait, pas la session. Essai écrit pour voir : `scripts/essai-code-ci.mjs`
(passerelle jetable, faux moteur, vrai OpenCode posé par Helix, une session ouverte comme l'écran,
une demande, la réponse dans le flux). Résultats : Mac, réussi ; Linux Debian 12 arm64 (conteneur),
réussi ; Linux Debian 12 x64 émulé, réussi ; **Linux Alpine arm64 : la variante ordinaire
d'OpenCode ne démarre pas** (`spawn … ENOENT`, la bibliothèque C attendue manque). Corrigé dans
`opencodePrive.ts` : chaque système a ses variantes publiées (ordinaire, puis « baseline » pour
les processeurs x64 sans AVX2, puis « musl »), essayées dans l'ordre **seulement** quand la
précédente s'est téléchargée et vérifiée mais ne démarre pas ; le message final dit ce que le
système a répondu. Sous Alpine, la variante musl démarre et la session répond (même essai).
**Cause sur le poste de Medhi non vue** : processeur sans AVX2 (machine virtuelle) ou bibliothèque
C ancienne, supposés ; le repli « baseline » n'a pas pu être déclenché ici (l'émulation x64 du Mac
a AVX2). L'essai tourne maintenant à chaque push sur `main` (job `code-linux`). Écueil vu au
passage : une propriété dans les paramètres d'un constructeur (`constructor(readonly x)`) fait
refuser le fichier par Node, qui ne lit que du TypeScript sans transformation : la passerelle ne
démarrait plus (vu dans l'essai, corrigé avant tout commit).

**Fait le 30/09/2026, après la 2026.930.1 : retours de Medhi sur son PC Windows.**
- **« L'instance de vos agents ne s'est pas ouverte à temps »**, plusieurs « Réessayer » avant que
  l'agent soit en service. Helix laissait 45 s à OpenClaw pour ouvrir son port, puis l'arrêtait et
  le relançait de zéro. Il a maintenant quatre minutes tant que le processus vit
  (`employes.ts`, `OUVERTURE_ESSAIS`) ; un processus qui s'arrête de lui-même est toujours vu tout
  de suite. L'écran dit « Le premier démarrage peut prendre quelques minutes ». La fenêtre de
  console est cachée (`windowsHide`). **Cause supposée, pas mesurée sur ce PC** : premier démarrage
  lent (fichiers lus pour la première fois, antivirus). L'essai OpenClaw sous Windows affiche
  désormais le temps d'ouverture du port : à lire au prochain passage pour régler la limite.
- **Carré gris autour du logo** (Windows, thème sombre). Le logo était un tracé noir sur blanc
  opaque, effacé par `mix-blend-mode` ; l'animation (`will-change: transform`) isole le calque, et
  le mélange ne se fait plus avec le fond. `src/assets/helix-mark.png` a maintenant un vrai fond
  transparent (`scripts/icones/marque-transparente.mjs`, sans dépendance), et le thème sombre
  l'inverse simplement. Vu à l'écran sur Mac, clair et sombre ; pas revu sous Windows.
- **« Pas de réflexion comme sur Mac »** : le Chat de la capture tournait avec
  `mistralai/ministral-3-3b`, qui ne raisonne pas (le catalogue le dit, `provision.ts`), alors que
  le Mac sert Qwen3.5, qui raisonne. L'écran montrait bien l'attente (« organise le travail
  (18 s)... »). Rien changé. **À décider** : ce tri avant la réponse coûte 18 s et plus à un petit
  modèle sur processeur pour une phrase de conversation de plus de quinze mots.
- **Un agent qui ne répond pas après cinq minutes** : pas reproduit, pas corrigé. Un message à un
  agent passe par OpenClaw, sans flux, avec une consigne longue ; sur processeur avec un modèle de
  3 milliards de paramètres, la lecture seule peut durer des minutes (limite : 15 min). À mesurer
  sur le PC : le journal `journaux/console.log` de l'instance des agents, et la durée réelle.

**Fait le 27/09/2026 : parcours complet de l'interface, contre une instance jetable.** Passerelle
jetable (dossier de données temporaire, clé des données en fichier, LM Studio éteint), faux
fournisseur compatible OpenAI (réponses, réflexion, 429, 500, flux coupé, réponse lente), faux
OpenCode qui déroule un tour de 42 s avec une demande d'autorisation, faux `codex`, faux OpenClaw ;
interface sous Vite, vue dans le navigateur intégré puis dans une fenêtre Electron hors écran
(profil jetable). Parcouru : premier lancement, « Poste autonome », création du compte, Chat (PDF,
Word et texte joints, cartes et durées, question suivante qui garde les documents, 429, 500, flux
coupé, modèle éteint), changer de modèle, comparer les modèles, clé « compatible » branchée, agent
créé puis passé sur un modèle cloud, Code (dossier, moteur, connexion Codex, carte d'accord, session
quittée puis retrouvée en direct, « Nouvelle session » puis réouverture, retrait de la liste), chaque
page des Paramètres, anglais, chinois, thème sombre, 375 px. Défauts trouvés et corrigés :
- Cartes d'accord et cloche : une demande disparue (passerelle redémarrée, réponse donnée ailleurs)
  restait affichée, « Une action attend votre accord » pour toujours. L'état est relu à chaque
  reprise du flux (`useApprobation.ts`, `notifications.ts`), et les flux d'accord envoient leurs
  en-têtes tout de suite (`flushHeaders`, index.ts) : sans demande en attente, rien ne partait avant
  quinze secondes. Une réponse d'accord qui n'arrive pas remet la carte si la demande attend encore.
- Chat : un refus de la passerelle (modèle éteint, inconnu, « Auto » sans modèle gratuit) était écrit
  sans en-têtes d'origine ; l'application ne pouvait pas le lire et disait « L'instance ne répond
  pas ». Et la puce du modèle affichait « Auto » pour un modèle choisi qui n'était plus servi, alors
  que c'est lui qui partait : elle dit maintenant « … (indisponible) ». Un moteur de la machine
  déclaré par le profil ne fait plus conseiller de vérifier la connexion à internet (chat.ts).
- Code : une session retirée de la liste en plein travail disparaissait de l'écran, et l'agent
  continuait de modifier le projet sans que personne puisse le suivre ni l'arrêter. Le retrait est
  refusé tant qu'elle travaille (409, index.ts) et la croix n'est plus proposée (SessionsCode.tsx).
- Synchronisation : avant la connexion, six collections demandées toutes les quatre secondes,
  refusées (401) ; et, connecté, la liste des Chats restait vide jusqu'à la relève suivante. Plus de
  demande sans séance, relecture dès la connexion (`sync.ts`, `App.tsx`).
- Libellé coupé : « Approbation avant modification » à toute largeur de fenêtre dès qu'un modèle au
  nom un peu long était choisi (Code, Cowork) ; à 375 px, le groupe de droite débordait du champ,
  bouton d'envoi compris (Composer.tsx : le nom du modèle se raccourcit le premier, ligne en deux
  dans un champ très étroit). À 375 px, la barre latérale laissait 127 px à l'écran, le panneau de
  Cowork cachait le champ, et la liste des Paramètres laissait 40 px aux réglages : rail d'office
  sous 768 px, panneau de Cowork fermé sous 1 024 px (comme le suivi de Code), liste des Paramètres
  en rangée au-dessus de la page.
- Traductions : 43 évènements du journal d'activité sans libellé montraient leur clé technique
  (« code.codex_connexion »), deux autres étaient écrits en dur ; les pays du catalogue des
  fournisseurs (« États-Unis », « Non précisé ») et « Autre (compatible OpenAI) » restaient en
  français en anglais et en chinois ; le nom de repli du produit (« l'application », instance de
  serveur) aussi ; « Version … disponible », « inconnue », « le fournisseur », « sur la machine »,
  « chez le prestataire », « Un ancien membre » et deux messages de la passerelle ne passaient pas
  par la traduction ; « 2 modèles … n'a pas de tarif » (Mon usage) ; placement de la précision
  dans la phrase chinoise de l'administrateur du journal.
- Batterie : son instance et ses essais lancés sous un dossier personnel jetable ne précisaient pas
  la clé des données. Sur un Mac, l'instance principale lisait donc la clé de l'installation de
  Helix dans le trousseau (même service), et les essais sous dossier personnel jetable (section
  7 septies, OpenCode sans clic) appelaient `security` sans trousseau : fenêtre « Trousseau
  introuvable » vue par Medhi. Tous les profils de `securite.mjs` et `essai-fournisseurs.mjs`
  disent désormais `chiffrement: "fichier"`.
- Employés OpenClaw sur un modèle cloud (question de Medhi) : ça marchait, sans aucun contrôle.
  Section 7 ter ter : un employé sur la clé personnelle de sa propriétaire reçoit la réponse du
  fournisseur avec cette clé ; celui d'une autre personne ne s'en sert pas et rien ne part chez le
  fournisseur ; une clé de l'équipe sert à tous ; l'en-tête d'employé sans sa clé n'ouvre rien ; et
  l'écran de l'employé (Réglages, « Son modèle ») propose les modèles cloud de la personne, vu dans
  l'interface. Section 11 octies : libellés du journal, pays, nom du fournisseur « compatible »,
  refus du Chat lisible, flux d'accord ouverts sans attendre.
**Vérifié** : `npm run typecheck`, i18n à 100 % des deux côtés, `npm run securite`, 654 contrôles,
0 échec (15 de plus : 7 ter ter, 11 octies, et le retrait d'une session au travail en 6 ter). **Relevé, pas corrigé** (pas reproduit, ou choix à faire) :
l'onglet « Discuter » de la fiche d'un agent (vocabulaire « Chat ») ; les tarifs de Mon usage
montrent l'identifiant technique du modèle (`cle-…/nuage-essai-1`) ; deux outils Fichiers ont le
même libellé « Lecture d'un fichier » (read_file et read_text_file) ; un employé déployé avec un
modèle qui ne lui est pas permis part en silence sur un modèle gratuit (le déploiement automatique
compte sur ce repli) ; `send` de `useChat` ne dépend pas de `options.agent` (masqué en pratique par
le nom de l'agent, qui change les bases héritées) ; un fichier provisoire reste sur le disque quand
l'écriture d'une collection échoue (disque plein : pas essayé). **Pas essayé** : l'application de
bureau empaquetée, un vrai modèle, le vrai OpenCode, le vrai Codex, un disque plein, un modèle qui
refuse de charger (`lms`), le bot de réunion, la mise à jour d'un clic (le navigateur n'a pas le
pont Electron). À savoir : le bouton « Copier les informations techniques » a été essayé une fois
dans la fenêtre Electron d'essai et a écrit dans le presse-papiers du Mac.

**Fait le 28/09/2026 (pour la 2026.928.3), à la demande de Medhi, vu sur ses captures.**
- **Comparer les modèles** : 57 repères rendaient le graphique illisible. Il n'en garde plus
  qu'une douzaine : le mieux noté de chaque éditeur, le moins cher d'OpenAI, d'Anthropic et de
  Google, les modèles de la personne, et le repère le plus proche en note du modèle en cours, pour
  le situer. Le tableau garde les 217. La source tient en une ligne (licence CC BY 4.0 complète :
  source, licence, lien, date, « extrait, notes inchangées ») ; « Voir le tableau » est écarté de la
  croix de fermeture.
- **Cadre vert autour des champs texte** (titre d'une nouvelle tâche, jusque sous la croix) :
  l'anneau de focus clavier global s'appliquait aux champs texte, qui sont `:focus-visible` même
  au clic. Il reste sur boutons, liens, menus et cases ; les champs de formulaire marquent leur
  focus par leur bordure (`src/styles/index.css`).
- **Tâches** : la colonne des rubriques se réduit à ses icônes (bouton en tête, choix retenu sur
  le poste, nom au survol) ; dans le tableau, le titre ne se coupe plus mot par mot. Le compte
  rendu d'une tâche est mis en forme (titres, listes) et peut s'agrandir, se copier ou se
  télécharger en Markdown, titre de la tâche en tête.
- **Logos de Facebook et d'Instagram** : Medhi a accepté les conditions de Meta et téléchargé
  leurs kits (28/09/2026). Facebook : le .ai officiel converti en SVG sans changer le tracé
  (`pdftocairo`) ; Instagram ne publie son dégradé qu'en image, d'où un PNG officiel réduit à
  128 pixels, que `scripts/gen-marques.cjs` admet désormais (signature PNG vérifiée, intégré en
  données, aucun appel réseau). YouTube : son logo en grand dans son panneau seulement (charte :
  100 pixels au moins). LinkedIn, TikTok, Slack et OpenAI restent neutres, faute d'accord.
- **Tâches et OpenClaw**, question de Medhi : une tâche (« Agent par défaut » ou un agent choisi)
  tourne avec le moteur du Chat, dans Helix ; une tâche programmée aussi, lancée par la
  passerelle. OpenClaw ne sert qu'aux employés 24/7. Décidé de ne rien changer à ce partage.
**Pas essayé** : l'application de bureau avec ces changements (vu dans le code et, pour le
graphique, dans le navigateur contre une instance jetable) ; le téléchargement du compte rendu
dans Electron (même mécanisme que l'export des données, déjà en place).

**Fait le 28/09/2026 : RTK, moins de jetons pour la sortie des commandes (branche `rtk`).**
Demandé par Medhi (§ 3.17). `gateway/src/rtk.ts` pose RTK 0.50.0 dans `<données>/rtk/0.50.0/`
(archive officielle, empreinte SHA-256 écrite dans le code, relevée dans `checksums.txt` de la
publication et recalculée sur les cinq archives : identiques), en arrière-plan au démarrage de
l'agent de code, comme OpenCode ; rien dans le PATH de la personne. OpenCode lance ses commandes
par l'enveloppe `<données>/rtk/shell-code` (réglage `shell`) ; le greffon d'environnement lui
donne `HELIX_RTK_DB` dans les seules sessions où RTK sert (les sous-agents suivent leur session).
`OPENCODE_DISABLE_PROJECT_CONFIG` et les dossiers privés (`XDG_CONFIG_HOME`) ne changent pas.
Écran Code : puce « RTK » (Avec les modèles cloud, Toujours, Jamais) et « RTK : N jetons
économisés sur cette session » sous la saisie (`GET /helix/code/rtk`, séance et propriétaire de
la session requises). Codex non concerné (§ 3.17).

*Mesuré le 28/09/2026* sur ce Mac, dépôt jetable (le code de RTK en 50 commits, quatre fichiers
modifiés, cinq non suivis ; un petit projet npm de 49 tests `node --test`, dont un qui échoue),
dossier personnel jetable, octets de la sortie avec et sans RTK (RTK compte environ un jeton pour
quatre caractères) :

| Commande | Sans RTK | Avec RTK | Écart |
|---|---|---|---|
| `git status` | 618 | 126 | −80 % |
| `git log` | 11 662 | 782 | −93 % (RTK n'en garde que dix commits, une ligne chacun) |
| `git log -n 10` | 2 294 | 1 151 | −50 % |
| `git diff` | 969 | 762 | −21 % |
| `ls -la` (racine, 43 entrées) | 2 600 | 873 | −66 % |
| `ls -la src/core` | 1 333 | 473 | −65 % |
| `grep -rn Config src` | 17 823 | 10 246 | −43 % |
| `grep -rn fn` sur un fichier | 897 | 897 | 0 |
| `find . -name '*.md'` | 3 442 | 1 026 | −70 % |
| `npm run test` | 2 303 | 2 270 | −1 % |
| `npm test` | 2 301 | 2 301 | non réécrite par RTK |
| **Total** | **46 242** | **20 907** | **−55 %** (≈ 11 600 → 5 200 jetons) |

De bout en bout (`node scripts/essai-rtk.mjs` : vrai OpenCode 1.18.32, dossier personnel jetable,
RTK téléchargé et vérifié par la passerelle, un faux fournisseur qui joue le modèle), `git status`
lu par le modèle : 419 octets sans RTK, 71 avec (« * main », puis une ligne par fichier) ; 13
contrôles réussis (carte, refus, commande inconnue, réglages, repli, télémétrie). `npm run
securite`, section 16 : 17 contrôles, batterie entière 1 014 contrôles, 0 échec (un témoin
d'Electron, SIGUSR1, a échoué une fois sur trois passages, sans lien avec RTK).

Écran vu dans une fenêtre Electron cachée sur `vite`, contre une instance jetable (faux OpenCode,
faux RTK) : puce, liste des trois réglages, total sous la saisie, en français à 1 280 px, en
anglais et en japonais à 375 px (le menu défile, aucun débordement de la page).

**Pas essayé** : l'application empaquetée ; Linux (archives épinglées, enveloppe écrite pour `/bin/bash` ou `/bin/sh`) ; un vrai modèle qui
lit ces sorties condensées.

**Fait le 28/09/2026 : fusible RunAsNode fermé (branche `fusible-runasnode`).** Signalé à Medhi
et vérifié sur le paquet construit : avec RunAsNode ouvert, n'importe quel programme du Mac lançait
`Helix.app/Contents/MacOS/Helix` avec `ELECTRON_RUN_AS_NODE=1` et faisait tourner son JavaScript avec
les autorisations de Helix (accessibilité, micro, écran) ; et Helix lancé depuis le terminal de VS Code
se fermait aussitôt. Le fusible est fermé, et ce qui s'en servait a changé (SECURITE.md § 52, tableau) :
- **la passerelle** tourne dans un `utilityProcess` (`electron/passerelle.cjs`), canal
  `process.parentPort` (`gateway/src/canalApplication.ts`), mêmes messages, environnement, dossier et
  journaux ; l'application attend sa fin avant de quitter (Electron arrête ses processus utilitaires
  sans laisser tourner leurs gestionnaires, essayé) ; SIGUSR1 est écouté par la passerelle
  (`--disable-sigusr1` n'a pas d'effet dans un `utilityProcess`, mesuré) ;
- **le contrôle de syntaxe** des petits modèles compile dans la passerelle (`syntaxeNode.ts` :
  `vm.Script`, `vm.SourceTextModule` dans un fil), sans rien exécuter ;
- **l'atelier** vérifie ses bibliothèques avec un vrai Node (celui du npm, du système ou de Helix) ;
- **la commande `helix`** : un lanceur qui prend le Node de Helix (épinglé, empreinte vérifiée), sinon
  celui du système en version 20 ou plus, et le dit s'il n'y en a aucun ; « Mettre en place » fait
  poser le Node de Helix par la passerelle quand il manque ; un ancien lanceur est réécrit au
  démarrage. Écran : une phrase de plus dans Paramètres, Ligne de commande (en, zh, ja à 100 %) ;
- **l'outil de récupération** se lance avec `node` (docs/GUIDE.md) ;
- **le téléchargement de l'application** sert le `.app` le plus extérieur (l'assistant d'Electron
  n'est plus pris pour l'application).

*Vérifié* : `npm run typecheck`, i18n à 100 %, `npm run securite` (1 577 contrôles, 0 échec ; contrôles nouveaux de la section
13 quater : passerelle lancée par `electron/passerelle.cjs` dans l'Electron du projet, canal,
SIGUSR1, arrêt ; contrôle de syntaxe sans exécution ; lanceur `helix`) ; paquets `--mac dir`,
`--win dir`, `--linux dir` fabriqués, RunAsNode « Disabled » sur les trois ; une copie du paquet macOS
lancée (point d'entrée remplacé pour ne pas toucher au trousseau, le reste inchangé), avec et sans
`ELECTRON_RUN_AS_NODE=1` : elle s'ouvre, le code de `-e` ne tourne pas, la passerelle répond, SIGUSR1
n'ouvre pas 9229, tout s'arrête avec le processus principal. Au passage, dans `npm run securite`,
l'essai de l'agent sur le serveur de fichiers (section 10) échouait sur `main` : `mcp.ts` était déjà
chargé par la barrière (approbation.ts -> natifs/commerce.ts -> … -> mcp.ts) et ne relisait pas
l'espace d'essai ; l'essai charge maintenant une instance neuve du module.

*Pas essayé* : Windows et Linux lancés ; le paquet d'origine lancé tel quel ; « Mettre en place »
depuis l'écran, et la pose du Node de Helix sur une machine sans Node ; le contrôle de l'écran et
l'accessibilité depuis la passerelle en `utilityProcess` ; l'atelier sur une vraie installation.

**Fait le 28/09/2026 : seconde tournée, les régressions entre fusions.** Sur le code fusionné le
27/09 au soir (6b77c21), contre une instance jetable (clé des données en fichier, dossier de données,
dossier personnel et PATH jetables, faux `security`, aucun `lms`, LM Studio et exo coupés), un faux
modèle local, un faux fournisseur OpenAI, faux OpenClaw, OpenCode et `codex` ; l'écran sous Vite,
dans une fenêtre Electron cachée à profil jetable (presse-papiers neutralisé), en français, anglais et
chinois, à 375 et 1 280 pixels. Trouvé et corrigé :
- **Document joint perdu à cause de la coupe** (documentsJoints.ts, historique.ts, chat.ts) : la place
  d'un document se mesurait avec tout l'historique, que `tenirDansLaPlace` retirait juste après. Mesuré
  sur 8 192 jetons : un document de 2 200 jetons joint à la neuvième question était lu en une partie
  sur plusieurs (le reste perdu), puis dix messages anciens partaient quand même. Quand la coupe suit
  (écran de Helix, taille connue), le document de la question ne cède plus la place aux anciens
  échanges ; les documents d'avant ne sont repris que si tout l'historique tient. Sans coupe ensuite
  (relais d'un client), rien ne change.
- **`lms` lancé avec LM Studio coupé** : l'écran de mise en route (`GET /helix/provision`) lançait
  `lms version` à chaque ouverture, et « Installer » cherchait `lms` puis `lms get`. Coupé par le
  profil : aucun `lms`, l'écran dit qu'il n'y a rien à installer d'ici (comme un poste piloté), la
  demande d'installation le dit sans rien tenter (index.ts, provision.ts).
- **Mise en service automatique d'un agent bloquée pour toujours** : son modèle choisi à la création
  disparu avant la mise en service (désinstallé, clé retirée), l'instance le refuse (400, sans repli,
  c'est voulu) et « Réessayer » redemandait le même. La carte le dit et propose d'en choisir un autre
  (proposition du poste, puis « Mettre en service ») ; le refus porte le code `modele_indisponible`.
  L'ancien `modelUid` (modèle du Chat) n'est plus envoyé comme modèle d'employé s'il n'est plus servi.
  Le « Réessayer » de la carte n'est plus un bouton dans un bouton (useMiseEnService.ts, AgentsPage.tsx).
- **Modèles proposés qui ne tiennent pas en mémoire avec 32 768 jetons** (provision.ts, `tientSur`) :
  les 30 % comptés pour la conversation valaient pour Qwen3.5 (un quart des couches à cache), pas pour
  un modèle dense. Cache relu sur les `config.json` publiés : Qwen3 4B 4,5 Gio, Ministral 3 3B
  3,25 Gio, Qwen3 1.7B 3,5 Gio, Qwen3 8B 4,5 Gio, Granite 4.1 8B 5 Gio, OLMo 3 7B 4 Gio, Qwen3.5 4B
  et 9B 1 Gio, Qwen3.5 2B 0,4 Gio (f16, couches à attention pleine × têtes K/V × taille de tête). Sur
  8 Go (PC sans carte ou Mac), Qwen3.5 4B tient (conseillé, inchangé), mais ses replis Qwen3 4B et
  Ministral 3B demandaient 7 à 7,5 Go : ils ne sont plus proposés ni essayés ; le relais est Qwen3.5 2B,
  puis Qwen3 1.7B (le plus léger vérifié, gardé en dernier recours). Sur 16 Go sans carte, Qwen3 8B
  tient (10 Go pour 11,2) et reste conseillé. Avec une carte NVIDIA, l'ancienne règle. 0,5 Go de
  tampons de calcul est une estimation, pas une mesure. **À décider** : sur un PC de 8 Go sans carte
  où la famille Qwen3.5 répond mal (le défaut vu sur le PC de Medhi), il ne reste que Qwen3 1.7B ;
  Ministral 3B y tiendrait avec 16 384 jetons, mais Code en demande 32 768 (backends.ts, 24/09).
- **Mon usage** : le nom du modèle et le service qui le sert (« gpt-4o-mini, OpenAI »), l'identifiant
  `cle-…/…` au survol ; « dont … de réflexion » était écrit en dur ; les nombres suivent la langue ; un
  tarif retiré rend la devise du prix publié (usage.ts, Usage.tsx). Vérifié : prix publié en dollars,
  tarif saisi en euros qui l'emporte, totaux par devise.
- **Code à 375 pixels** : le choix du moteur (360 pixels de large) s'ouvrait sous la barre latérale et
  y était coupé ; un panneau qui ne tient d'aucun côté est ramené dans sa zone et rétréci
  (Popover.tsx, vaut pour tous les menus). En session Codex, l'avis prenait la moitié de l'écran à
  chaque tour : une ligne sous la saisie, le détail d'un clic, l'avis entier reste à l'accueil.
- **Approbations** : une lecture ratée au démarrage (instance pas encore prête) n'était jamais refaite,
  et le flux ne s'ouvrait pas ; relue ensuite, de plus en plus espacée. Une lecture en route écrasait
  ce que le flux venait de dire (carte arrivée entre-temps effacée, carte tranchée remise), pour les
  cartes comme pour la cloche (useApprobation.ts, notifications.ts).
- **Relevés au premier passage** : l'onglet « Discuter » d'un agent s'appelle « Chat » ; `read_file`
  (« Lecture d'un fichier (ancien outil) ») et `read_text_file` (« Lecture d'un fichier texte »), et
  `list_directory_with_sizes`, ont chacun leur libellé ; une écriture de collection ratée efface son
  fichier provisoire (db.ts, essayé en faisant échouer le renommage, pas avec un disque plein).
- **Écran étroit et traductions** : Tâches à 375 pixels laissait 62 pixels au tableau (la colonne des
  rubriques passe en rangée au-dessus, comme les Paramètres) ; les onglets des Agents faisaient défiler
  la page de côté ; un long chemin d'espace de travail débordait (Connecteurs). Pluriels écrits en
  français hors traduction : « 3 项任务s », « membre(s) », « chat(s) », « document(s) choisi(s) »,
  « projet(s) », le résumé de l'export, « Recherche… », « sur » (Tâches, Groupes, Projets, partage,
  Bibliothèque, Confidentialité).
**Vérifié** : `npm run typecheck`, i18n à 100 % des deux côtés, `npm run securite` (section 13
quinquies, 17 contrôles de plus, 749 en tout, aucun échec ; le contrôle « Windows 8 Go simulé » de la section 7 septies suit la
nouvelle règle : Qwen3.5 2B prend le relais, Qwen3 4B n'est plus essayé). **Relevé, pas corrigé** : un
service déclaré par le profil sur la machine même (Ollama en boucle locale) est présenté comme
« cloud … facturé » dans les choix de modèle (origine « agence ») ; la liste d'un tel service est gardée
dix minutes comme celle d'un fournisseur cloud. **Pas essayé** : l'application empaquetée, un vrai
LM Studio (la mémoire réelle d'un chargement de 32 768 jetons, ses garde-fous de chargement), un vrai
modèle, le vrai Codex, un disque plein.

**Corrigé le 28/09/2026 : le modèle choisi revenait à l'ancien (branche `bug-modele-en-cours`).**
Vu par Medhi sur la 2026.928.4 : « j'ai choisi le modèle qwen, il propose gpt nano encore » ;
« Comparer les modèles » montrait gpt-4.1-nano comme modèle en cours alors que qwen3-8b était
choisi. Le graphique n'y était pour rien : il montre `preferredModelUid`, le modèle que la
question suivante emporte (vérifié : un Chat rouvert, créé sur gpt-4.1-nano, part bien sur le
modèle choisi ensuite, la conversation ne garde pas le sien). C'est le choix lui-même qui était
défait, par la synchronisation (`src/lib/store/sync.ts`), en deux défauts :
- **une écriture faite hors ligne n'était ni envoyée ni notée** : `pousser` rendait `false` dès
  que la synchronisation se croyait hors ligne, avant de noter la collection « en attente ». La
  relecture suivante (lancement, connexion) remettait la copie de l'instance, donc l'ancien
  choix. Hors ligne, cela arrive le temps d'un redémarrage de la passerelle (une relève ratée
  suffit) ;
- **la relève ne démarrait pas si l'instance ne répondait pas à l'ouverture de la fenêtre** :
  `startSync` sortait sans lancer la minuterie, et, la personne restée connectée, rien ne la
  relançait. Toute la séance était alors hors ligne sans le dire.

Rejoué contre une instance jetable (faux LM Studio servant `qwen3-8b`, faux OpenAI servant
`gpt-4.1-nano`, Vite, fenêtre Electron cachée), sur le code d'avant : instance injoignable au
lancement, qwen3-8b choisi, puis instance revenue : vingt secondes après, synchronisation
toujours hors ligne, rien d'envoyé ni d'attente notée, l'instance garde gpt-4.1-nano ; au
lancement suivant, le sélecteur et le graphique montrent gpt-4.1-nano. Même chose pour une
relève ratée en cours de séance (passerelle qui redémarre). Et un **Chat créé pendant ce temps
disparaissait au lancement suivant** (même cause : la liste de l'instance remplaçait celle du
poste). Corrigé : hors ligne, la modification est notée en attente (fusionnée à la relecture,
comme les autres) ; la relève tourne même après un premier échange raté ; au retour de
l'instance, ce qui attend et a déjà été relu repart. Revu dans la même fenêtre après la
correction : le choix atteint l'instance dès son retour et survit au lancement suivant, le Chat
aussi. Écarté après essai : une relecture partie avant une écriture ne la recouvre pas, car
l'envoi de cette écriture porte une révision dépassée et l'instance répond 409, ce qui la fait
fusionner. **Vérifié** : `npm run securite`, section 15 octies (trois contrôles, qui rejouent le
vrai `sync.ts` empaqueté par esbuild contre une fausse instance : tous en échec sur le code
d'avant). **Pas essayé** : l'application empaquetée elle-même ; la cause exacte de l'absence de
l'instance sur le poste de Medhi ce jour-là n'est pas connue (redémarrage de la passerelle ou
démarrage lent sont les deux chemins reproduits).

**Fait le 28/09/2026 : tournée finale des écrans avant publication (branche `tournee-finale-ecrans`).**
Sur `main` après les neuf fusions depuis la 2026.928.5 (connecteurs, RTK, recherche web, RunAsNode,
commande `helix`), contre une instance jetable (clé des données en fichier, dossiers de données et
personnel jetables, faux `security`, LM Studio et exo coupés, faux fournisseur OpenAI, faux
DuckDuckGo, faux OpenCode, faux RTK, faux `codex`, aucune sortie réseau), l'écran sous Vite, dans le
navigateur intégré et dans une fenêtre Electron cachée à profil jetable (presse-papiers neutralisé),
en fr, en, zh et ja, clair et sombre, 1 280 et 375 pixels. Trouvé et corrigé :
- 28/09/2026 : **aide, mauvais article ouvert** : « Connecter Google Docs, Google Forms et Dropbox »
  portait l'identifiant de « Fichiers et documents » ; l'aide ouvrant un article par son identifiant,
  un clic ouvrait l'autre (et React le signalait en console). Identifiant à part (aide.ts).
- 28/09/2026 : **aide, chemin inexistant** : huit articles de connecteurs envoyaient dans « Réglages,
  Outils et connecteurs » ; le menu s'appelle « Connecteurs » (fr, en, zh, ja).
- 28/09/2026 : **connecteurs, rubriques en double** : le commerce était sous trois titres
  (« Commerce et relation client » pour Stripe et Salesforce, « Vente et relation client » pour
  HubSpot et Intercom, « Paiement et gestion » pour Square et PayPal) ; deux lignes « Slack », l'une
  sous « Courrier, agenda et fichiers » ; Box seul parmi Canva et Figma, Dropbox avec Drive. Une
  rubrique commerce, Box avec Drive et Dropbox, « Slack (par jeton) » à côté du Slack du catalogue,
  et l'écran range sous un même titre les services à panneau et le catalogue (connecteurs.ts,
  Connecteurs.tsx, ParametresPages.tsx ; traductions de rubrique identiques des deux côtés).
- 28/09/2026 : **connecteurs sans identifiant** (Mémoire, Réflexion, Navigateur, Documentation des
  bibliothèques) : leur lien disait « Où trouver mon jeton » ; il dit « Documentation du service ».
- 28/09/2026 : **Code sans modèle de code** : « Aucun modèle disponible pour l'écran Code. Aucun modèle
  disponible pour le rôle « code ». », en français dans toutes les langues ; le message dit
  maintenant de choisir un modèle dans le sélecteur ou d'installer un modèle de code (index.ts).
- 28/09/2026 : **Code à 375 pixels** : avec la puce RTK, dossier, moteur et RTK ne tenaient plus sur
  la ligne et le nom du dossier se réduisait à « … ». Moteur et RTK passent à l'icône seule sous
  640 pixels (libellé au survol et pour les lecteurs d'écran), la ligne reste une (Chip.tsx).
- 28/09/2026 : **zone de saisie à 375 pixels** : l'invite passait sur deux lignes dans un champ
  d'une ligne, le haut de la seconde visible (Chat, Cowork, Code) ; elle tient sur une ligne.
- 28/09/2026 : **Comparer les modèles** : « Vos 2 modèles y figurent, dont 2 sans note publiée »
  quand aucun n'était sur le graphique, et « Vos 1 modèles » ; phrases justes pour ces cas.
- 28/09/2026 : **Microsoft 365** : l'étape des permissions renvoyait à une liste « plus bas » qui
  n'apparaît qu'une fois l'application enregistrée ; la phrase le dit.
- 28/09/2026 : **commande `helix`** : la raison de repli « inconnue » (electron/ligneDeCommande.cjs)
  s'affichait telle quelle, en français ; traduite. **Sources du web** à 375 pixels : « 1 autre(s)
  résultat(s)… » centré sur deux lignes, aligné à gauche.
**Vérifié** : `npm run typecheck`, i18n à 100 % des deux côtés, `npm run securite` (section 18 bis).
Aucune erreur de console ni requête en échec sur 21 écrans × 4 langues dans la fenêtre Electron
(hors avertissement de CSP propre à Vite et flux d'approbation coupés à chaque changement de page).
**Relevé, pas corrigé** : à 375 pixels, le nom du modèle se réduit à son icône dans la barre du bas
(Chat comme Code), comme voulu depuis la décision « c'est le nom du modèle qui se raccourcit » ;
dans Code, « Rapide » et « Approfondi » du sélecteur nomment un modèle de Chat que le mode Auto ne
prend pas pour le code. **Pas essayé** : l'application empaquetée (ni fenêtre de bureau réelle, ni
trousseau, ni `helix://`), un vrai OpenCode, un vrai RTK, de vrais services connectés.

**Fait le 27/09/2026 : Codex dans l'écran Code, avec le compte ChatGPT du propriétaire du
poste.** Décidé par Medhi (« ajoute »). Le détail, les sources et ce qui reste à essayer sont
au § 3.14 (« Fait ») ; les barrières au § 30 de SECURITE.md. En bref : second moteur au choix
dans Code, le programme `codex` officiel piloté par `codex exec --json`, connexion par
`codex login` dans le navigateur, rien lu dans `~/.codex`, bac à sable jamais plus large que le
niveau d'approbation, réservé à l'administrateur d'une installation de bureau non partagée.
Vérifié par un faux `codex` (517 contrôles) ; **pas essayé avec le vrai programme ni un vrai
compte**. Claude par abonnement reste exclu.

**Trouvé le 27/09/2026 au premier vrai essai de mise à jour d'un clic (0.27.0 vers 0.27.1, par
GitHub, sur ce Mac) : toute mise à jour était refusée.** La fenêtre « Nouvelle version » est bien
apparue, l'archive s'est téléchargée, puis « la mise à jour a été refusée : son contenu a changé
depuis sa signature ». Cause : dans Electron, `fs` ouvre les archives `.asar` comme des
dossiers ; le vérificateur de la signature de l'éditeur ne relisait donc pas les octets signés
(relevés hors d'Electron). Le défaut valait aussi pour une mise à jour servie par une instance,
jamais essayée entre deux versions. Correctif : `original-fs` dans Electron
(`electron/signatureEditeur.cjs`), reproduit puis vérifié dans Electron même, et contrôlé par
`npm run securite` (434 contrôles). Rien de faux n'a été installé : le refus était le bon
réflexe. Les installations en 0.27.0 et dans la première 0.27.1 (publiée quelques minutes) ne
peuvent pas se mettre à jour d'un clic : une réinstallation, une fois (commande `curl` du
README). La 0.27.1 publiée a été refaite avec le correctif.
- Réponses en français à un message en anglais : la consigne française disait « tu réponds en
  français ». Le modèle répond maintenant dans la langue du dernier message, agents compris ;
  la langue de base est l'anglais (interface, passerelle, zone de notification) quand celle du
  système n'est ni le français ni le chinois.
- Aide : « Ouvrir l'écran concerné » refermait mal l'aide ; 28 textes restés en français
  passent par la traduction. README : prérequis pour les trois systèmes, LM Studio n'en est plus un.

**Fait le 27/09/2026 : « Signaler un problème », dans l'aide et les paramètres.** Demandé par
Medhi (« que les retours m'arrivent directement »). Écran `/parametres/signaler`
(`src/components/settings/SignalerProbleme.tsx`, `src/lib/signalement.ts`), ouvert aussi par un
bouton de l'aide, section « Besoin d'une personne ». Trois champs (ce qui ne va pas, seul
obligatoire ; ce que la personne faisait ; ce qu'elle attendait) et une case « Joindre les
informations techniques », cochée par défaut : version, cadre d'exécution, système (et processeur,
que `preload.cjs` donne désormais : `architecture`), agent utilisateur, langue, modèle choisi,
date. Ni message, ni document, ni clé, et **pas l'adresse d'une instance d'entreprise** (un ticket
est public ; la copie de l'aide, envoyée au support, la garde). L'écran montre le texte exact qui
partira. Deux envois, dits pour ce qu'ils sont : **« Ouvrir sur GitHub »** ouvre dans le navigateur
un ticket prérempli du dépôt de `branding.urls.sourceCode` (`issues/new?template=bug_report.yml`,
champs `title`, `version`, `etapes`, `attendu`, `details`, et `systeme` quand on le sait sans
deviner : Mac Apple silicon ou Intel ; la documentation de GitHub ne promet le préremplissage que
pour les champs de texte, le menu n'est pas essayé) ; l'écran dit qu'il faut un compte GitHub et
que le ticket sera public. **« Envoyer par mail »** ouvre un brouillon adressé à
`branding.urls.supportEmail` (support@helix-agence.fr), sujet et corps remplis. Adresses bornées à
7 500 caractères : les textes les plus longs sont coupés à un endroit marqué, et l'écran le dit.
Seules deux destinations sont admises depuis cet écran (https://github.com et `mailto:`).
**Décidé : aucun jeton GitHub dans l'application, donc aucun envoi en arrière-plan.** Le dépôt et
l'application sont publics : un jeton glissé dedans serait lisible par tous et permettrait
d'écrire au nom de l'éditeur. On prépare, la personne relit et envoie. Pour recevoir ces mails sur
une autre adresse : une redirection de support@helix-agence.fr, ou changer `supportEmail` (pas
d'adresse personnelle dans le code). Au passage, **les liens `mailto:` dans l'application de
bureau** : `will-navigate` les annulait comme une navigation ailleurs, et `setWindowOpenHandler` ne
transmettait que http(s) ; les deux les remettent maintenant à la messagerie du système
(`shell.openExternal`). **Vérifié** dans l'interface de développement (passerelle jetable, port
8895) : l'écran depuis l'aide, l'adresse du ticket construite (clic sur « Ouvrir sur GitHub »,
`window.open` remplacé pour ne rien ouvrir), le `mailto:` construit, la case décochée, la coupe
de textes de 6 000 à 9 000 caractères (adresses de 7 459 à 7 500 caractères), le refus de toute
autre destination. **Pas vérifié** : l'ouverture réelle dans l'application de bureau (navigateur
et messagerie du système, `mailto:` sous Windows et Linux), le ticket prérempli vu sur GitHub
(aucun ticket ouvert), la longueur que chaque messagerie accepte dans un `mailto:`.

**Fait le 27/09/2026 : audit de la chaîne d'approvisionnement et du dépôt public.** Autorisé par
Medhi. Tout ce que Helix télécharge sur un poste a été relu, et chaque empreinte écrite dans le
code recomparée à la source (digests GitHub, fichiers d'empreintes des éditeurs, PyPI, métadonnées
LFS de Hugging Face) : 87 fichiers, tout concorde (SECURITE.md § 32). **Corrigé** : l'atelier et
la dictée installaient la dernière version de leurs paquets Python et Node, sans empreinte ; ils
installent maintenant une liste figée, dépendances comprises, avec l'empreinte de chaque fichier
(`gateway/src/atelier-paquets.json`, refaite par `node scripts/atelier-empreintes.mjs`, qui demande
uv sur le poste de développement), par `pip --require-hashes` et `npm ci --ignore-scripts` ; les
modèles Whisper sont vérifiés par empreinte après téléchargement ; le Mac Intel ne télécharge plus
l'application LM Studio prise sur Homebrew (non figée, et pour puce Apple seulement) : il dit
qu'aucun moteur n'existe pour lui ; les extensions d'OpenClaw prennent la version de l'OpenClaw qui
tourne ; l'archive de Node ne passe plus par `/tmp` ; `.gitignore` écarte les clés ; le README ne
dit plus « tout est épinglé ». Section 14 de `npm run securite` (20 contrôles). **Vérifié** :
l'atelier puis la dictée installés depuis la liste figée dans un environnement jetable sur ce Mac
(Python 3.14, `pip check` sans erreur, `faster_whisper` importé) ; roues présentes pour Python 3.9
à 3.14 sur macOS à puce Apple, Linux x64 et arm64, Windows x64 (uv, système par système) ;
`npm ci` des bibliothèques Node joué, et refusé avec une empreinte falsifiée. Licences des 25
modèles proposés relues sur leurs fiches : toutes Apache 2.0 ou MIT. Dépôt : aucun secret dans
l'arbre ni dans les 150 commits (trois valeurs d'essai factices seulement), la clé de l'éditeur
jamais suivie, aucune trace d'outil d'IA ; aucune alerte GitHub ouverte (analyse de code, Dependabot,
secrets). **Pas vérifié** : l'atelier et la dictée sur un vrai Windows ou Linux, avec un Python 3.9
à 3.13, et le téléchargement d'un modèle Whisper jusqu'au bout ; l'installation d'une extension
d'OpenClaw à version sur l'instance des employés. **À décider par Medhi** (SECURITE.md § 32,
« Restant ») : les licences permissives hors de la liste Apache/MIT parmi les dépendances (BSD,
MPL-2.0 de certifi, FFmpeg embarqué par PyAV pour la dictée), et le modèle de conversation, que
LM Studio sert sans révision épinglée par Helix.

**Fait le 27/09/2026 : mise à jour d'un clic sous Windows.** Demandé par Medhi après un essai sur
un vrai PC (« que Windows se mette à jour tout seul, d'un clic, comme le Mac »). Revient sur
« Télécharger » seulement hors de macOS, pour Windows (décision du même jour, plus haut). Un poste
Windows installé seul (source GitHub) voit « Installer maintenant » quand le manifeste
`helix-mise-a-jour.json` décrit l'installateur `Helix-Setup-<version>-x64.exe` **et** que sa
signature de l'éditeur est bonne avec la clé de l'application installée ; le clic télécharge
l'installateur dans le profil de Helix, vérifie taille, SHA-512 et signature, relit l'empreinte
sur le disque, puis lance l'installateur NSIS en silence (`--updated /S --force-run`, comme
electron-updater) et quitte ; l'installateur remplace l'application et la relance. Où vit la clé
sous Windows : `resources\cle-editeur.pem` (`process.resourcesPath`), posée à la fabrication par
une nouvelle étape `afterPack` (`scripts/signature/cle-windows.cjs`) ; `afterSign` ne convenait
pas (electron-builder ne l'appelle que s'il a signé). À la publication,
`node scripts/manifeste-mise-a-jour.mjs` signe la partie Windows avec la clé de
`~/.helix-editeur/` ; sans clé, pas de partie Windows et l'app garde « Télécharger ». Chaque
partie (mac, windows) n'est écrite que si son paquet est dans `release/`. SECURITE.md § 29.11.
**Linux garde « Télécharger »** : un `.deb` demande les droits d'administrateur. Une AppImage
pourrait se remplacer elle-même (`process.env.APPIMAGE` : télécharger à côté, vérifier comme
sous Windows, renommer par-dessus, relancer), mais ce n'est pas fait : à décider.
**Vérifié sur ce Mac** : 14 cas Windows dans `scripts/essai-source-github.mjs` (31 en tout) ;
manifeste signé par la vraie clé dans un dossier temporaire et relu ; parcours de `miseAJour.cjs`
joué sous Node en Windows simulé (installateur bon lancé, altéré ou trop long refusé et effacé,
signature fausse ou clé absente : « Télécharger ») ; `npm run securite`, 435 contrôles.
**Pas vérifié** : rien n'a tourné sur un vrai Windows (installation silencieuse, relance,
antivirus, Smart App Control, profil aux caractères hors page de code). **À savoir** : les postes
Windows déjà installés n'ont pas la clé dans leur application ; ils gardent « Télécharger » pour
la prochaine version, et passent au clic à partir de celle d'après.

**Fait le 27/09/2026 (nuit, suite) : relecture par cinq agents avant publication.** Demandée par
Medhi (« déploie plusieurs agents, être sûr que tout est bon »). Windows, Linux et paquets,
sécurité des installations, régressions sur macOS, documentation : tout ce qu'ils ont trouvé
est corrigé (SECURITE.md § 29.3). Le plus sérieux : un membre pouvait faire exécuter un
programme de son choix par l'instance (dossier de l'équipe et « Tout mon poste » désormais à
l'administrateur, pointeur de LM Studio protégé et vérifié). Aussi : moteur llmster et Node
épinglés avec leurs empreintes ; Helix Code et les documents de l'atelier corrigés pour
Windows ; images et vidéos non proposées sur un Linux trop ancien ; nom du produit affiché
sous Windows et Linux (« helix-plateforme » avant) ; icônes Linux à toutes les tailles ; sur
macOS, Homebrew retrouvé par l'application ouverte depuis le Finder. `npm run securite` : 432
contrôles, tous réussis. **Essai refait avec les paquets finaux** dans le même Ubuntu : paquet
installé par-dessus l'ancien, application ouverte, Node de Helix posé seul et serveur de
fichiers démarré (14 outils), dossier du moteur recréé, un Chat (« Rome »). Cette fois, le
chargement du modèle lancé par Helix a échoué (le modèle s'est chargé à la demande au premier
message). **Cause trouvée à la relecture du code** (27/09/2026, matin) : le chargement lancé par la
mise en route appelait `lms load` sans passer par le démarrage du moteur, seul à recréer le
dossier `~/.lmstudio/.internal/temp` que l'essai venait de retirer ; le Chat, lui, y passait,
d'où le chargement réussi juste après. Corrigé : le dossier est garanti avant chaque
chargement, une seconde tentative suit un échec sans manque de mémoire, et la réponse du
moteur est écrite au journal. Pas réessayé dans un conteneur depuis. Sur macOS, l'application reconstruite, ouverte comme
depuis le Finder, a son serveur de fichiers (14 outils).

**Fait le 27/09/2026 (nuit) : Python posé par Helix, et le .deb essayé dans un Ubuntu vierge.**
Demandé par Medhi (« fais en sorte que tout fonctionne, sûr, vérifié ; Python doit
s'installer »). **Python** : quand la machine n'en a pas un qui convient, Helix pose
CPython 3.12.14 autonome (python-build-standalone d'Astral, publication 20260901 épinglée,
empreintes SHA-256 écrites dans `pythonPrive.ts`), pour l'atelier, la dictée, l'entraînement
et le contrôle du code ; exception de licence décidée par Medhi (PSF, table des licences).
Posé pour de vrai sur ce Mac (5 s) et dans l'Ubuntu. **Essai du `.deb`** dans un Ubuntu 24.04
amd64 vierge (Docker, processeur émulé, écran virtuel Xvfb), installé sans les paquets
recommandés, donc sans Python ni Node : l'atelier s'est installé seul (Python et Node de
Helix, 10 bibliothèques Python, 6 Node, Word, Excel, PowerPoint et PDF créés puis relus) ; le
moteur llmster s'est installé seul (1 Go, empreinte vérifiée), puis Helix a choisi, téléchargé
et chargé Qwen3.5 4B ; un Chat a répondu (« Paris ») ; l'application complète s'est ouverte
sur l'écran d'accueil. **L'essai a trouvé quatre défauts, corrigés et revérifiés** : trois
bibliothèques manquaient au `.deb` (`libdrm2`, `libgbm1`, `libasound2`) ; l'application se
fermait au démarrage sous Windows et Linux (une fenêtre de service fermée avant la fenêtre
principale) ; llmster ne chargeait aucun modèle (dossier `.internal/temp` absent) ; sans
`npx`, Cowork n'avait pas d'outils fichiers (désormais par un vrai Node, celui de Helix au
besoin, ce qui règle aussi Windows, où `npx` est un `.cmd`). Vérifié : `npm run securite`,
425 contrôles (2 de plus, section 11 quinquies). **Windows : toujours rien d'essayé.**

**Fait le 27/09/2026 : les versions Windows et Linux, construites.** Demandé par Medhi (« fais
la version Windows et Linux », « tout s'installe en automatique sans soucis, bien adapté »).
Construits depuis ce Mac : `release/Helix Setup 0.27.0.exe` (NSIS, pour le compte, sans droits
d'administration), `release/helix-plateforme_0.27.0_amd64.deb` et `release/Helix-0.27.0.AppImage`.
**Jamais installés sur un vrai PC Windows ni sur une vraie machine Linux.** Le `.deb` a ensuite
été installé dans un Ubuntu 24.04 vierge (entrée suivante) ; l'installateur Windows n'a jamais
tourné. Ce qui a changé pour
qu'ils tiennent (SECURITE.md § 29.2, audit Windows et Linux du même jour) :
- **Installation automatique** : le moteur de LM Studio s'installe seul aussi sur Windows et
  Linux (son moteur sans interface, llmster, par l'archive officielle et son empreinte
  SHA-512, sans exécuter de script téléchargé, sans droits d'administration) ; l'atelier
  trouve Python et npm sous Windows (`py`, `python.exe`, `npm-cli.js`, sans les alias du
  Microsoft Store), et, sans npm sur la machine, pose le Node officiel de Helix (déjà utilisé
  pour OpenClaw, empreinte vérifiée), zip compris sous Windows ; les archives d'images
  s'ouvrent sans `unzip` sous Linux. Le `.deb` fait installer par apt `libatomic1`,
  `libgomp1`, `python3`, `python3-venv` et `unzip`. **Python** : posé par Helix quand la
  machine n'en a pas un qui convient (entrée suivante) ; la commande (winget, apt, dnf) n'est
  donnée que là où il ne sait pas le poser.
- **Fenêtre fermée** : l'application reste dans la zone de notification (tâches et employés
  continuent), « Quitter » arrête tout ; menu de fenêtre dans la langue de l'écran ; la
  passerelle s'arrête proprement sous Windows (canal, puis tout son arbre de processus) et
  plus aucune console ne s'ouvre ; la barre de titre de macOS n'est plus imitée ailleurs.
- **Sécurité** : certificat de l'instance partagée fabriqué sans openssl (absent de Windows ;
  l'instance servait alors en clair), et jamais d'instance partagée en clair ; clé de données
  abîmée ou illisible : refus de démarrer au lieu d'une clé neuve ; chiffrement « à clé
  connue » de Chromium sous Linux tenu pour absent ; zones protégées de Windows (`AppData`)
  et de Linux (trousseaux, Firefox, certificats) ; dossiers système de Windows et de Linux
  refusés comme dossiers de travail.
- **Honnêteté de l'écran** : mise à jour à la main hors de macOS (plus de bouton qui échoue),
  « Cet écran » absent hors de macOS, tests de Helix Code non lancés (pas de bac à sable) dits
  comme tels, ligne de commande absente avec l'AppImage (le `.deb` l'a), message du micro
  propre à chaque système.
Vérifié : `npm run securite`, 423 contrôles (5 de plus, section 11 quinquies, dont un Windows
simulé pour les consoles et une connexion TLS réelle sans openssl), typecheck, traductions à
100 %, et l'application Mac reconstruite (listes de choix, barre de titre).

**Fait le 27/09/2026 : un modèle par employé.** Demandé par Medhi (« OpenClaw, on doit
choisir le modèle selon l'agent aussi, pas tous le même »). La configuration d'OpenClaw
donnait déjà un fournisseur et un modèle à chaque employé ; ce qui manquait, c'était de le
choisir, et de ne jamais en servir un autre.
- **À la création d'un agent**, un champ « Son modèle », qui n'existait pas : la mise en
  service passait `agent.modelUid`, que rien ne remplissait, et la passerelle prenait le
  modèle chargé de la machine. Le modèle proposé suit le poste (`proposerModele`,
  `src/lib/employes.ts`), et une ligne dit pourquoi : un poste qui se sert d'outils (services
  branchés, bases, documents) reçoit un modèle qui déclare savoir les appeler (LM Studio,
  `trainedForToolUse`), le déjà chargé d'abord, sinon le plus gros ; un poste court sans
  outils, le plus léger ; sinon le déjà chargé. Jamais d'office un modèle de clé, un modèle
  entraîné ici ou un modèle qui a mal répondu sur la machine. Un modèle de clé se choisit à la
  main, et l'écran dit qui paie (« facturée sur votre clé », « à l'équipe, sur la clé de
  l'instance »). Le choix est gardé à part (`Agent.modeleEmploye`), pas dans `modelUid` : le
  Chat et les tâches gardent le modèle choisi par la personne qui s'en sert (un modèle de clé
  personnelle n'y serait pas servi à ses collègues), et la fenêtre le dit.
- **La passerelle refuse** (400) un modèle qu'elle ne sert pas à cette personne, à la création
  comme à la modification. Jusqu'ici, à la création, il était remplacé en silence par un
  modèle de la machine, clé personnelle d'une collègue comprise. Sans modèle demandé (API),
  elle prend d'abord un modèle qui sait appeler des outils quand le poste en a.
- **Chaque appel d'un employé** (`X-Helix-Employe` et sa clé) est servi avec le modèle
  enregistré pour lui, quel que soit celui que la requête nomme (index.ts) : un changement vaut
  dès l'appel suivant, et un employé ne répond jamais avec un autre modèle que le sien. Son
  modèle disparu : 404 `model_not_found` avec la raison, rien ne part au moteur. Un 503
  seulement si le service ne répond pas : vu avec le vrai OpenClaw, un 503 est pris pour une
  panne passagère et réessayé huit fois, plus de deux minutes, avant la réponse.
- **Liste des agents** : le nom de son modèle, en petit, près de son état (« · cloud » pour un
  modèle de clé), ou « Modèle indisponible », la raison au survol (`etatDuModele`,
  employes.ts, jugé avec les droits de son propriétaire : désinstallé ou plus retenu par sa
  clé, clé retirée, service qui ne répond pas, clé devenue personnelle à quelqu'un d'autre). Sa
  fiche le dit en tête, ses réglages le montrent « (indisponible) » avec la proposition, et
  lui parler rend cette raison au lieu de « vérifiez que le modèle est bien chargé ». Son
  modèle disparu, le reste de ses réglages s'enregistre encore (le modèle n'est renvoyé que
  s'il change).
- Au passage, la batterie (`securite.mjs`, `essai-fournisseurs.mjs`) garde la clé des données
  dans un fichier de son dossier jetable (`"chiffrement": "fichier"`) : sur macOS, elle lisait
  l'entrée du trousseau de la vraie instance du poste.
**Vérifié** : `npm run securite` (656 contrôles, aucun échec), dont la section 7 ter ter
(17 contrôles) : deux employés sur deux
modèles, chacun le sien dans la configuration d'OpenClaw (fournisseur, agent, profil du
courrier) et au faux moteur ; une requête sans modèle, ou qui en nomme un autre, reçoit le
sien ; changement du modèle de l'un : sa configuration réécrite, celle de l'autre intacte à
l'octet, OpenClaw pas relancé ; modèle de la clé personnelle d'une autre personne refusé à la
création comme à la modification ; modèle retiré de sa clé, puis clé retirée : dit par la
liste, refusé par la passerelle sans rien envoyer, dit dans la réponse. **Avec le vrai
OpenClaw 2026.9.4** (le binaire du poste, lancé avec des données, un dossier personnel et un
port jetables ; ni `~/.openclaw`, ni l'instance de Helix en service, ni `lms`) : deux employés
répondent chacun avec son modèle ; le modèle de l'un changé, OpenClaw recharge à chaud la
seule partie de cet employé (« config hot reload applied (models.providers.helix-alpha.models,
agents.entries.helix-alpha.model, agents.entries.helix-alpha-courrier.model) »), demande lui-même
le nouveau modèle à la passerelle, et l'autre continue sur le sien ; clé retirée : réponse en
1 s qui le dit. L'écran, dans l'interface de développement sur une passerelle jetable : champ
et proposition à la création, modèle facturé choisi, carte « qwen3-8b-essai · cloud », puis
« Modèle indisponible » après le retrait de la clé, nouveau modèle pris dans ses réglages, et
sa réponse. **Pas vérifié** : la proposition sur une machine où LM Studio déclare outils et
tailles (le faux moteur n'en déclare aucun : la ligne disait « aucun des modèles de l'instance
ne déclare savoir appeler des outils ») ; un vrai modèle cloud sur un employé ; une mission
(automatisation d'OpenClaw) sur un modèle changé ou disparu, dont le compte rendu garderait le
texte anglais d'OpenClaw ; le cas « service qui ne répond pas » avec le vrai OpenClaw.
**Relevé, puis corrigé le soir même** : la passerelle cherchait `lms` dans `~/.lmstudio/bin` et
le PATH même quand le profil éteint LM Studio (`lmStudioMetadata`, backends.ts), et la batterie
lançait donc `lms ls` et `lms ps` du poste. Depuis, la découverte des modèles ne lance `lms`
que si une source LM Studio est activée (`discover`, contrôlé par `npm run securite`).

**Fait le 27/09/2026 : relecture des correctifs et test d'intrusion.** Demandé par Medhi
(« refait un tour sur les potentielles bugs … une fois le code sûr à 100 % … fais la version
Windows et Linux »). Un agent a relu les correctifs du jour, un autre a attaqué l'instance de
l'extérieur ; tout ce qu'ils ont trouvé est corrigé et rejoué par `npm run securite` (418
contrôles, tous réussis). Le plus sérieux : un en-tête `Host` vide suffisait à arrêter la
passerelle. Détail dans SECURITE.md § 29.1. **Changements visibles** : les listes de choix
(`Select`) s'ouvrent par-dessus l'écran et défilent seules, sans faire défiler la page ;
Helix Code demande l'accord une fois par dossier pour les fichiers, plus pour chacun ; les
tests de l'agent de code marchent avec `sh`, git et le node de Homebrew ; seul
l'administrateur branche un moteur installé sur la machine de l'instance.

**Fait le 27/09/2026 : les deux suites de la revue de sécurité.** Décidé par Medhi (« fais
au mieux », « qu'il soit efficace et évite l'injection de prompt ») :
- **Comptes** : un collègue invite, seul l'administrateur crée un compte directement, et
  le mot de passe qu'il choisit est provisoire : la personne en choisit un à elle à sa
  première connexion (écran de connexion), l'ancien ne vaut plus rien.
- **Employés et mails reçus** : un second profil OpenClaw par employé, réservé aux mails
  reçus, sans web, navigateur, messagerie, commande ni écriture de fichier ; le mail entre
  des bornes tirées au sort. Pas encore essayé avec le vrai OpenClaw.
- **Écran** : le choix du niveau d'approbation s'ouvre vers le bas quand il y tient (le menu
  mesure sa vraie hauteur), « Sessions récentes » retiré de l'accueil de Code (les sessions
  restent dans la barre de gauche).
Le même jour, sur le « go » de Medhi : **les mises à jour d'un clic sont signées par la clé de
l'éditeur** (`npm run cle:editeur` une fois, puis chaque `npm run package` signe ; le poste
vérifie avec la clé de l'application qu'il fait tourner, SIGNATURE.md § 4). Clé créée sur le
Mac de Medhi, empreinte `5efb-aa74-00fe-cdd7` : **à sauvegarder en lieu sûr**. Le choix du
niveau d'approbation s'ouvre toujours vers le bas (il défile s'il manque de place).

**Fait le 26/09/2026 : revue de sécurité par six agents.** Demandée par Medhi (« un
tour complet niveau sécurité avec plusieurs agents ») : six agents en lecture seule, un par
domaine, chaque constat relu puis corrigé, et vérifié par `npm run securite` (376 contrôles).
Détail dans SECURITE.md § 28. Les plus sérieux : la cage des tests de Helix Code se
franchissait par un lien symbolique (reproduit avec de faux secrets) ; toute séance pouvait
diriger l'envoi de la boîte commune vers son propre serveur et en recevoir le mot de passe ;
un accord pour écrire un fichier couvrait la création d'une tâche programmée ; un fichier
de données illisible était lu comme vide, puis écrasé. **Changements visibles** : le niveau
d'approbation, la boîte mail commune et son envoi se règlent par l'administrateur seul
(l'écran le dit à un membre) ; créer une clé d'API demande son mot de passe ; programmer
une tâche et supprimer un événement se confirment toujours ; la carte montre ce que l'outil
recevra ; quand le mail d'invitation part, le code n'est plus montré à qui invite ;
l'interrupteur « Masquer le prompt » est retiré (il ne faisait rien). **À décider** : signer
les mises à jour (une instance compromise peut aujourd'hui faire installer n'importe quelle
application à ses postes) ; les deux autres points ont été fermés le 27/09 (ci-dessus).
**À faire** : que l'instance ajoute elle-même les instructions d'un agent au Chat, pour
pouvoir un jour les cacher vraiment.

**Fait le 26/09/2026 : mises à jour d'un clic, sans signature ni serveur.** Décidé par
Medhi : pas de mise à jour automatique, mais une fenêtre « Nouvelle version » avec
« Installer maintenant » (`src/components/layout/FenetreMiseAJour.tsx`). La source est
l'instance à laquelle le poste est rattaché : elle décrit l'application qu'elle fait
tourner (`GET /helix/mises-a-jour/latest-mac.yml`, empreinte SHA-512 de l'archive) et la
sert (jeton d'instance exigé, seulement cette archive). Le poste télécharge, vérifie
l'empreinte, décompresse par `ditto`, contrôle l'identifiant et la version, puis un script
remplace l'application une fois fermée, en gardant l'ancienne jusqu'à ce que la nouvelle
soit en place, et la relance (`electron/miseAJour.cjs`, `installerSansSignature`). Le
serveur de l'agence, s'il est un jour inscrit dans le paquet, reste prioritaire. Vérifié
le 26/09/2026 sur l'application installée : description et archive servies, empreinte
recalculée identique, 401 sans jeton ; une archive plus ancienne que l'application est
refaite (elle servait la version de la veille). **Pas encore essayé** : une vraie mise à
jour entre deux versions sur un poste rattaché. Le poste qui porte l'instance, lui, n'a
pas de source (c'est lui la source) : il se met à jour en installant le nouveau paquet.

**Ce qui attend une machine qu'on n'a pas**

7. **Qwen-Image** (texte lisible dans l'image) : 48 Go ou carte de 24 Go.
8. **Machine macOS de Cowork** (Lume) : Mac de 32 Go.
9. **Windows et Linux** : paquets construits le 27/09/2026. **Windows** : installé par Medhi
   sur un PC sans carte graphique (moteur llmster posé par Helix, des Chats, défauts vus et
   corrigés plus haut, sans avoir vu les correctifs marcher) ; la liste de ce qui reste à y
   essayer est dans « Ce qui reste à essayer sur les postes de Medhi », plus haut. **Linux** : le `.deb` essayé dans un conteneur Ubuntu
   24.04 (installation, atelier, moteur, modèle, Chat, application ouverte), pas sur une
   vraie machine ; restent l'icône de la zone de notification (GNOME sans l'extension
   AppIndicator ne la montre pas), l'AppImage, images, dictée, Helix Code, machine de
   l'agent, la vitesse réelle. Pas proposée sous Windows : la ligne de commande (OpenClaw y
   est posé en natif depuis le 28/09/2026, § 3.4, jamais essayé sur un vrai PC) ; nulle part hors macOS : essais de code en bac à sable. Mise à jour
   d'un clic : macOS, et Windows depuis le 27/09/2026 (écrite, jamais essayée sur un vrai PC) ;
   pas sous Linux.
10. **Entraînement sur carte NVIDIA** : installation de PyTorch CUDA, QLoRA, comparaison
    et fusion par peft jamais essayés sur une vraie machine (seule la conversion GGUF
    l'a été, sur le Mac) ; paquets NVIDIA figés à la version mais sans empreintes.
    Aussi : Qwen3 0.6B (Mac de 8 Go) et Qwen3 4B Instruct 2507 (Mac de 32 Go, NVIDIA
    12 Go) jamais téléchargés en entier ni entraînés ; macOS 14 et 15.

**Ce qu'on peut faire ici**

11. **Extension VS Code** : première vraie question tapée dans VS Code par le
    client ; publication sur la place de marché (compte éditeur à créer). Les deux
    corrections du 25/09 (onglet Code muet, flux laissé ouvert) sont vérifiées par
    simulation seulement ; le `.vsix` 0.2.2 (avec ces corrections et les connecteurs
    dans Helix Code) est refait et installé depuis le 25/09/2026.
12. **Import Cursor** : l'éprouver sur de vraies conversations (le poste du
    client n'a que des brouillons vides). Import Codex par morceaux : pas mesuré.
13. **Le modèle de l'écran Code** : Qwen3 8B y est faible (répétitions, guide de
    design ignoré sans les filets de design.ts). Un modèle fait pour le code
    (Qwen3-Coder, Devstral) ou une clé cloud ferait mieux.
14. **Détection de design** : resserrée le 25/09/2026 (`estDemandeDeSite`, design.ts).
    Les mots sûrs (site, landing, vitrine, portfolio, page d'accueil…) suffisent ; les
    mots ambigus (page, interface, formulaire, maquette, html, css) demandent un verbe
    de création ; un mot de programmation (TypeScript, type, API, serveur, classe,
    fonction, test, bug…) écarte la demande, sauf création d'un site. 26 phrases
    d'essai sur 26 (`npm run essai:design`). Reste : l'éprouver sur les vraies
    demandes du client.
15. **Le garde d'Eden**, l'instance OpenClaw personnelle du client (script hors
    Helix), recharge Qwen3 8B à ses propres réglages : il peut couper une réponse
    d'Helix en cours, et **gêne l'entraînement** sur un Mac de 16 Go. Qwen3 8B chargé
    avec 28 160 jetons retient 10,4 Go de mémoire graphique, MLX échoue alors
    (« Insufficient Memory ») ; l'entraînement décharge les modèles au repos, mais un
    programme du poste (sans doute ce garde, ou un autre client de LM Studio) recharge
    Qwen3 8B dans la minute : deux lancements sur huit se sont arrêtés ainsi le
    25/09/2026. Le message le dit et il suffit de relancer ; une vraie parade demande
    d'harmoniser avec ce garde, si le client le demande. Helix n'y touche pas.
16. **Serveurs MCP dans HelixAI Code** (§ 3.11) : ils marchent depuis le 25/09/2026,
    par l'ancienne API d'OpenCode et un flux traduit par la passerelle
    (`fluxCode.ts`), vérifiés de bout en bout avec un serveur d'essai sans compte
    (`npm run essai:cli -- --modele`). L'écran Code a été regardé dans le navigateur
    le 25/09/2026 (panneau de suivi, § 3.11), sans connecteur branché. Reste : un
    connecteur dans l'écran Code, et l'extension VS Code (nom de
    l'outil sans le préfixe `helix_`, changé mais pas essayé, `.vsix` pas refait) ;
    essayer un vrai
    connecteur à compte ; à chaque mise à jour d'OpenCode, relire si la nouvelle API
    reçoit enfin les outils MCP (alors on pourra y revenir) et si l'ancienne existe
    toujours. L'historique rejoué par le flux n'est plus que celui que la passerelle
    a vu depuis son démarrage.
17. **Ligne de commande** : livrée avec l'application le 25/09/2026 (paquet
    `Resources/cli`, Paramètres > Installer les apps > CLI, qui pose `~/.local/bin/helix`
    et, si besoin, une ligne marquée dans `~/.zprofile` ; `electron/ligneDeCommande.cjs`).
    Windows pas fait ; l'AppImage non plus (le `.deb` l'a). Traductions anglaise et chinoise de ses textes (`cli/textes.mjs`), si le
    client le demande. Documenter `NODE_EXTRA_CA_CERTS` pour une instance à certificat
    auto-signé.
18. **Employés OpenClaw et bases de connaissances** : fait le 25/09/2026 (outil
    `connaissances__chercher`, § 3.10) ; l'après-midi, un agent personnel dont rien ne
    sort vers d'autres (sans messagerie, sans mission « à chaque mail », encadré, sans
    outil qui écrit) lit aussi les bases partagées aux groupes de son propriétaire, et
    l'écran de l'agent dit ce qu'il lira. Le soir, les trois questions tranchées (§ 3.10) :
    agents partagés à des groupes, documents privés lus par l'agent personnel de leur
    propriétaire, mémoire mise de côté et vidée avant tout élargissement de l'audience.
    Vérifié le 25/09/2026 : `npm run securite` (206 contrôles après la fusion du 26/09), et avec l'OpenClaw
    2026.9.4 d'essai et qwen3-8b (instance jetable 8899, OpenClaw 18877) : l'agent
    personnel d'Alice rend son code privé ZEBRE-7731 et l'écrit dans
    `memory/2026-09-25.md` ; ouvert à l'organisation après confirmation (7,4 s pour
    vider : 1 note, 1 conversation), un collègue lui demande ce code, il répond que les
    documents n'en parlent pas ; l'agent du groupe Compta répond à Bernard
    « PAPAYE-3150 » sans le privé d'Alice ; sorti du groupe, Bernard reçoit 404 ; clé
    par employé en place, l'employé répond toujours après la réécriture de la
    configuration. Reste : le voir dans l'application de bureau ; l'essayer sur une
    vraie messagerie ; au palier Libre, les restes hors mémoire (pages libérées de sa
    base SQLite, registre des tâches, journaux d'OpenClaw) lui sont lisibles, le dire
    au client ; une mission planifiée qui tournerait pendant le vidage n'est pas
    détectée (seuls les messages et mails en cours le sont).
19. **Export RGPD** : fait le 25/09/2026, `/helix/export` contient désormais les bases
    de connaissances (sans vecteurs), les images créées (liste et demandes) et les
    projets d'entraînement (exemples) ; l'effacement d'un compte retire aussi ses
    projets d'entraînement et le modèle rangé dans LM Studio, qu'il oubliait
    (7 contrôles de plus, section 7 quater de `npm run securite`). Corrigé le soir
    (revue du 25/09) : un document supprimé de Fichiers quitte toutes les bases, index
    compris (`retirerDocumentsPartout`) ; l'effacement d'un compte retire ses documents
    des bases des collègues (relevés avant que la Bibliothèque ne les oublie : le filtre
    « ajouté par lui » n'attrapait rien) ; l'export ne nomme plus un document rangé dans
    une base que la personne ne voit plus, il le compte ; et une clé par employé
    (HMAC de la clé de l'instance et de son identifiant) remplace la clé commune, qui
    ouvrait le serveur d'outils de n'importe quel employé. 4 contrôles de plus.
20. **À essayer dans l'application de bureau** : le fichier des Chats illisible est vu
    le 25/09/2026 dans l'application de développement, profil d'essai (fichier abîmé,
    instance coupée, écriture refusée) ; reste le **trousseau refusé ou verrouillé**
    (jamais provoqué) et l'application empaquetée. Aussi : l'écran d'import par
    morceaux avec un vrai logiciel ; Cowork avec des bases de connaissances ; de vrais
    PDF et documents Office dans une base ; une vraie image vue par un collègue sur un
    second poste.
21. **Petits restes du 25/09** : le bandeau du fichier des Chats illisible et le bilan
    d'import au bureau sont faits (« Fait le 25/09/2026 », plus haut). Restent : un Chat
    ouvert sur un poste dont l'instance n'a pas été relue (fichier illisible, instance
    injoignable) n'est pas envoyé, et le démarrage suivant le remplace par la liste de
    l'instance (le bandeau le dit, rien ne le fusionne) ; après un repli vers le
    stockage du navigateur, le démarrage suivant relit le fichier chiffré, qui n'a pas
    les Chats gardés dans le navigateur (ils reviennent de l'instance si elle les a
    reçus, ce que le bilan dit) ; un petit modèle entraîné garde des traces hors de
    propos (la Joconde attribuée à la fondatrice imaginaire), d'où le conseil de deux
    ou trois formulations par fait.
22. **Helix Code avec un petit modèle** (§ 3.11, 25/09/2026) : à voir dans
    l'application de bureau (le panneau de suivi n'a été regardé que dans le
    navigateur, instance jetable) ; refaire le `.vsix` 0.2.3 de l'extension et l'y
    essayer ; mesurer la qualité des réponses de Qwen3 8B avec les consignes courtes
    sur de vraies tâches (une seule tâche essayée : juste, mais la liste de tâches
    réécrite avec un seul élément) ; comprendre les 20 s qu'OpenCode a mises à
    démarrer chaque session du banc ; `limit` ne suit pas un modèle rechargé plus
    petit par un autre programme (Eden) après le démarrage d'OpenCode. Le vrai remède
    au modèle qui relit tout reste de ne pas le partager : c'est au client de voir si
    Eden et Helix doivent se partager Qwen3 8B.
23. **Sessions de Code** (§ 3.11) : les voir dans l'application de bureau ; décider
    avec le client si les sessions d'avant le 25/09 doivent être rattachées (sur une
    instance à un seul compte, on pourrait les lui attribuer ; pas fait) ; renommer une
    session (pas fait, le titre est la première demande) ; l'effacement d'un compte avec
    des sessions de Code, pas essayé.
24. **Zones protégées et import local** (revue du 25/09/2026, SECURITE.md § 22.6) :
    corrigés et vérifiés par `npm run securite` et dans le navigateur (instance
    jetable). Restent : les voir dans l'application de bureau avec le vrai « Tout mon
    poste » (dossier personnel réel, `~/.helix/data` réel) ; le bash de Helix Code
    n'est pas borné par ces zones (OpenCode a ses propres outils, fichiers de Helix Code
    non touchés par cette correction) : à décider avec le client ; la liste des zones
    est celle des emplacements connus, pas une garantie sur tout secret du poste ;
    Windows et Linux couverts depuis le 27/09/2026 (§ 29.2 de SECURITE.md) ; le choix « Depuis Helix »
    de l'écran d'un employé n'a été vérifié que par l'API (pas d'employé sur l'instance
    jetable).
25. **Clés d'API** (§ 3.13, 26/09/2026) : essayer le paquet `openai` lui-même (pas
    installé sur ce poste, l'essai Python est passé par `urllib`), un appel depuis une
    autre machine sur une instance ouverte aux collègues, et un client tiers (tableur,
    éditeur de code). L'écran API développeur dans l'application de bureau, pas vu.
26. **Google Docs, Google Forms, Dropbox** (§ 3.5, 28/09/2026) : rien d'essayé contre
    les vrais services. Sur le poste : activer « Google Docs API » et « Google Forms
    API » dans le projet Google de l'instance, brancher, lire un document à onglets,
    créer un document, ajouter du texte, lire les réponses d'un vrai formulaire ;
    créer une application Dropbox (les deux accès, « App folder » et « Full
    Dropbox »), déclarer `http://127.0.0.1:8787/helix/oauth/retour`, se connecter sans
    secret puis avec, lister, chercher, lire, envoyer un fichier, débrancher.

**Titulaire des droits** : tranché le 24/09/2026, « Medhi Clabaut » (entreprise
individuelle, SIREN 994 907 145), partout ; mentions légales et section
« Logiciel HelixAI » du site helix-agence.fr à jour.
---

## 6. Ce qu'il ne faut pas refaire

Les erreurs qui ont coûté du temps, pour qu'elles ne se répètent pas.

**Ne jamais affirmer sans mesurer.** Chaque bug sérieux de ce projet a été trouvé en
exécutant, jamais en relisant. Un correctif dont on n'a pas vu l'effet n'est pas un
correctif.

**Se méfier des marqueurs abstraits dans les consignes de modèle.** La phrase
« il faut `<espace de travail>/Dossier` » était recopiée telle quelle par un modèle de
8 milliards de paramètres, et chaque lecture de fichier échouait. Un exemple concret
ne laisse rien à interpréter.

**Une étape muette n'est pas une étape réussie.** Elle laisse un trou que l'étape
suivante comble en inventant. C'est ainsi qu'un bilan comptable s'est rempli de
montants vraisemblables et entièrement faux.

**Un logiciel qui ment est pire qu'un logiciel incomplet.** Une fonction absente se
pardonne ; une coche verte « email vérifié » qui ne vérifie rien est ce qu'un auditeur
relève en premier.

**Libérer le port 8787 après un essai.** La passerelle de développement qui y traîne
empêche l'application du client de démarrer, et le message affiché ne dit pas pourquoi.
