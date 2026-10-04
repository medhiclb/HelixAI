# HelixAI : guide technique

Plateforme d'agents IA **open source**, en marque blanche, en logiciel de bureau :
chaque organisation installe sa propre instance, chez elle. Elle réunit une interface
React, une **passerelle modèles** locale (`gateway/`) et une enveloppe **Electron** qui
lance la passerelle au démarrage. Interface en **sept langues** (français, anglais, chinois, japonais,
espagnol, allemand, arabe), au choix de chacun (Réglages, Préférences) ; en arabe, l'écran se lit de droite à gauche.

Contributions : [CONTRIBUTING.md](../CONTRIBUTING.md) et [CLA.md](../CLA.md).

Sous licence **[GNU AGPL-3.0](../LICENSE)** : lisez, installez, modifiez, redistribuez,
vendez. En retour, qui distribue HelixAI ou **le propose comme service en ligne** doit
publier le code de sa version, modifications comprises, sous la même licence.
Explications et portée dans [COPYRIGHT.md](../COPYRIGHT.md).

Ce qui fonctionne réellement aujourd'hui : la conversation en streaming sur un modèle
local (ou cloud, par clé), la boucle d'outils MCP sur un espace de travail fichiers,
l'écran Code adossé à OpenCode, le contrôle de l'écran sous approbation, les comptes et
séances, les agents toujours actifs (OpenClaw, installé tout seul), les groupes, la
bibliothèque, les réunions transcrites sur la machine et le bot de réunion, le
branchement d'une trentaine de services (dont douze en un clic, par autorisation dans
le navigateur), la synchronisation de plusieurs postes vers une instance, et depuis le
25/09/2026 les bases de connaissances citées dans le Chat, la ligne de commande
`helix` et l'entraînement d'un petit modèle sur Mac. Depuis le 27/09/2026 : les documents
joints lus par tout modèle (mesurés contre sa place, lus en parties au besoin), les durées
des réponses, un essai de chaque modèle local sur le poste, une couche d'aide aux petits
modèles, les modèles des clés d'API,
Codex dans l'écran Code pour le propriétaire du poste, un modèle par employé, les notes
d'Epoch AI et les prix publiés jusque dans Mon usage, « Signaler un problème », et la mise
à jour d'un clic sous Windows. Ce qui reste annoncé sans fonctionner est listé en fin de
document.

## Démarrer

```bash
npm install
```

### Application (recommandé)

```bash
npm run app
```

Lance Helix en application de bureau : elle compile puis démarre **sa propre
passerelle**, crée son espace de travail au premier lancement, et s'arrête
proprement à la fermeture. Aucun terminal à gérer.

### Produire l'installeur

```bash
npm run package            # paquet non signé, pour les essais
npm run package:signe      # paquet signé et notarié (certificat Apple requis)
npm run verifier:signature # contrôle signature, durcissement, Gatekeeper, notarisation
```

Mode d'emploi de la signature, pas à pas : [`SIGNATURE.md`](../SIGNATURE.md) § 1.

Génère `release/Helix-<version>-<arch>.dmg` et `.zip` (macOS). Windows et Linux se
fabriquent depuis ce même Mac, après `npm run build` (27/09/2026) :

```bash
npx electron-builder --win nsis --x64 --publish never
npx electron-builder --linux AppImage deb --x64 --publish never
```

Ils donnent `release/Helix-Setup-<version>-x64.exe` (installateur NSIS pour le compte, sans
droits d'administration, en français, anglais ou chinois selon Windows),
`release/helix-plateforme_<version>_amd64.deb` et `release/Helix-<version>.AppImage`. La
chaîne NSIS récente (`toolsets.nsis` 1.2.1) est nécessaire sur un Mac Apple Silicon sans
Rosetta ; l'AppImage prend le runtime statique (`toolsets.appimage` 1.0.3, noté bêta par
electron-builder), qui se passe de libfuse2. Le `.deb` tire les bibliothèques du moteur
(`libatomic1`, `libgomp1`) et recommande `python3`, `python3-venv` et `unzip` : apt les
installe avec lui. Il pose aussi le bac à sable de Chromium et son profil AppArmor, que
l'AppImage n'a pas (sur Ubuntu 24.04, l'AppImage démarre sans bac à sable).
L'installeur embarque
l'interface, la passerelle compilée (`dist-gateway/index.cjs`) et l'icône. La
passerelle tourne dans le runtime Node d'Electron : **lancer Helix et converser
ne demande aucune installation de Node**.

Deux capacités font exception et s'appuient sur des programmes présents sur la
machine :

| Capacité | Ce qu'elle exige | Sans cela |
|---|---|---|
| Outils fichiers (MCP) | `npx` | Sans lui (ou sous Windows, où c'est un `.cmd`), Helix le lance par un vrai Node : celui du système, sinon son Node officiel, posé au besoin (nodejs.org, empreinte vérifiée). Hors ligne et sans Node : pas d'outils |
| Écran Code | OpenCode : celui que Helix pose seul, en arrière-plan, depuis le 27/09/2026 (1.18.32, empreinte SHA-256 écrite dans le code, `<données>/opencode/`), sinon `HELIX_OPENCODE_BIN`, `~/.opencode/bin/opencode` ou le `PATH`. Codex, second moteur facultatif, n'est jamais installé par Helix | Hors ligne, ou sur un poste rattaché : l'écran Code propose « Installer OpenCode » (administrateur), et rappelle la commande manuelle |
| Modèles locaux | LM Studio | L'écran de mise en route l'installe, sans intervention : son moteur sans interface (llmster 0.0.25-1, empreinte SHA-512 écrite dans le code) sur Mac à puce Apple, Windows et Linux ; sur un Mac où l'application LM Studio a déjà servi, c'est elle qui sert ; sur Mac Intel, llama.cpp à la place (moteur ouvert, MIT, b11146, `<données>/llamacpp/`, modèles Qwen3 GGUF épinglés ; `HELIX_MOTEUR=llamacpp` le choisit ailleurs sur macOS). L'emplacement se choisit (voir « Emplacement du moteur et des modèles ») |

Dans le Chat et dans Cowork, un message envoyé pendant qu'une réponse s'écrit ne la coupe
pas : il entre dans la file d'attente de ce Chat, affichée au-dessus de la zone de saisie
(« Modifier », « Retirer »), et part seul à la fin de la réponse, avec ses pièces jointes et
les options du moment où il a été écrit. Après une erreur ou « Arrêter », la file se met en
pause jusqu'à « Envoyer maintenant ». Dix messages au plus par Chat ; la file n'est pas gardée
au rechargement de la page. Avant le premier mot, le Chat dit ce que fait le modèle, avec le
temps écoulé (« … organise le travail », « … lit la demande »), puis sa réflexion et sa durée,
sur macOS, Windows et Linux.

Avec un modèle local, l'écran Code peut attendre une ou deux minutes avant le premier
mot : le modèle lit d'abord toute la demande, et la relit s'il l'a perdue parce qu'un
autre programme s'en est servi entre-temps (LM Studio ne sert souvent qu'une demande à
la fois). L'écran le dit (« Le modèle lit la demande », avec le temps écoulé et, pour
LM Studio sur le poste, le pourcentage lu) et son panneau de suivi montre ce que fait
l'agent. Le journal de LM Studio lu pour ce pourcentage est
`server-logs/` dans son dossier (`~/.lmstudio`, ou celui que désigne `~/.lmstudio-home-pointer`) ;
sans lui, il n'y a simplement pas de chiffre.

### Publier une version : l'essai Windows doit être vert

**Avant chaque publication, l'essai Windows doit être vert.** C'est le flux GitHub Actions
« Essai Windows » (`.github/workflows/essai-windows.yml`) : sur une machine Windows neuve
(`windows-latest`), il construit l'application (`npm run build`, puis
`electron-builder --win dir --x64`, sans signature ni publication), lance
**l'application empaquetée** `release\win-unpacked\Helix.exe` avec des données et un profil
jetables, et fait le parcours d'une personne par la passerelle, comme l'écran de mise en
route : compte administrateur, installation du moteur de LM Studio (conditions acceptées
pour cet usage interne d'essai), Qwen3 1.7B jusqu'à « prêt », une question au Chat en flux,
puis l'application quittée, le service de LM Studio arrêté comme après un redémarrage,
l'application rouverte et la même question. Le pilotage est dans
`scripts/essai-windows-ci.mjs` (mode d'emploi en tête du fichier) ; il refuse de tourner
ailleurs que sous Windows, et sans `HELIX_ESSAI_MACHINE_JETABLE=1`, puisqu'il pose le
moteur dans `%USERPROFILE%\.lmstudio`.

Il part tout seul à chaque poussée sur `main` qui touche `gateway/`, `electron/`, `src/` ou
`package.json`, et à la main :

```bash
gh workflow run essai-windows.yml --ref main
gh run watch                # puis, s'il échoue : gh run view --log-failed
gh run download <numéro>    # les journaux, gardés 14 jours
```

Une exécution prend de cinq à dix minutes, construction comprise (plus si le téléchargement du
modèle est lent). Qu'il passe ou non, il
garde en artefact `essai-windows-journaux` : le déroulé de l'essai (`essai.log`), la sortie
de l'application, `passerelle.log`, la liste de `%USERPROFILE%\.lmstudio` et de son
`.internal`, le contenu des `*install-location.json`, les journaux du serveur de LM Studio,
les réponses du Chat et le journal d'audit de l'instance jetable.

Sur un poste Windows, `passerelle.log` (la sortie de la passerelle, 5 Mo au plus, l'ancien
gardé en `.1`) est dans `%APPDATA%\helix-plateforme\logs\` : c'est le premier fichier à
demander à une personne dont le moteur ne démarre pas.

### Emplacement du moteur et des modèles

Un modèle pèse de 2 à 18 Go. Quand le disque principal n'a pas la place, l'administrateur choisit
un autre disque (un D: sous Windows, un disque externe sur Mac) :

- **Avant l'installation**, sur l'écran de mise en route : l'emplacement, la place libre sur ce
  disque et la place nécessaire (moteur, modèle conseillé, 1 Go de marge), puis « Changer ». Dans
  l'application, le sélecteur de dossier du système ; dans un navigateur, ou pour une instance
  distante, un champ où écrire le chemin sur la machine de l'instance. Avec LM Studio, Helix écrit
  alors `~/.lmstudio-home-pointer` vers `<dossier choisi>/LM Studio` : moteur, téléchargements en
  cours et modèles y vont. Avec llama.cpp (Mac Intel), les modèles vont dans
  `<dossier choisi>/modeles-llamacpp` ; le moteur (11 Mo) reste dans les données de l'instance.
- **Après l'installation**, dans Réglages, Modèles locaux. llama.cpp : Helix déplace les modèles
  (renommage sur le même disque ; sinon copie, taille vérifiée, puis effacement des originaux ; rien
  n'est effacé si la copie échoue). LM Studio déjà installé : Helix ne déplace pas le dossier d'un
  LM Studio qui tourne. À la main : quitter Helix et LM Studio, `"<dossier>/bin/lms" daemon down`,
  déplacer tout le dossier, écrire son nouveau chemin (seul sur une ligne) dans
  `~/.lmstudio-home-pointer`, rouvrir Helix. Pour les nouveaux modèles seulement, le réglage « My
  Models › Change » de l'application LM Studio suffit, mais les téléchargements en cours passent
  encore par le disque principal (`.internal/temp-downloads` du dossier de LM Studio).

Le dossier doit être absolu, sur un disque de cette machine (pas un partage réseau), hors du
dossier personnel, hors de l'espace des agents et des zones protégées, à ce compte et inscriptible.
Le sous-dossier créé devient une zone protégée. Détail : SECURITE.md § 55.

⚠ Le paquet de `npm run package` n'est signé qu'**ad hoc**, pas par Apple : macOS dit
qu'Apple n'a pas pu le vérifier (« Ouvrir quand même ») et `spctl` le refuse.
L'installation en une commande (`scripts/installer-macos.sh`) évite l'avertissement : elle
télécharge l'image disque de la dernière publication par le Terminal, la vérifie contre
`SHA256SUMS.txt` de la même publication, vérifie la signature de code
(`codesign --verify --deep --strict`), attend que Helix soit fermé, puis copie
l'application à côté avant de la mettre en place dans Applications (ou `~/Applications`).
Limite : l'empreinte vient de la même publication que l'image. Non signée par Apple,
l'application voit aussi macOS redemander l'accès à sa clé du trousseau (« Helix Safe
Storage ») une fois à chaque nouvelle version. Tout est prêt pour la signature et la
notarisation (`npm run package:signe`) ; il manque le certificat Apple, voir
[`SIGNATURE.md`](../SIGNATURE.md). La mise à jour **automatique** en dépend aussi. Sans elle,
la mise à jour se fait **d'un clic** (« Installer maintenant ») sur macOS, et sous Windows
depuis le 27/09/2026 : l'archive ou l'installateur n'est installé que si sa signature de
l'éditeur est bonne avec la clé de l'application qui tourne (SIGNATURE.md § 4, SECURITE.md
§§ 29.7 et 29.11). Sous Linux, la fenêtre ouvre le paquet dans le navigateur.

Le paquet ferme trois fusibles d'Electron (`build.electronFuses` de `package.json`) :
`NODE_OPTIONS`, `--inspect` et, depuis le 28/09/2026, RunAsNode. `ELECTRON_RUN_AS_NODE=1`
ne fait donc plus du binaire de Helix un Node que n'importe quel programme du poste
pourrait lancer avec les autorisations de Helix (SECURITE.md, § 52 « RunAsNode fermé ») ;
lancé depuis le terminal de VS Code, qui définit cette variable, Helix s'ouvre
normalement. La passerelle tourne dans un `utilityProcess` (`electron/passerelle.cjs`),
la commande `helix` avec un vrai Node (celui que Helix pose, sinon celui du système en
version 20 ou plus). Relu le 28/09/2026 sur des paquets fabriqués (`--mac dir`,
`--win dir`, `--linux dir`) : `npx @electron/fuses read --app release/mac-arm64/Helix.app`
dit « RunAsNode is Disabled » sur les trois.

⚠ **LM Studio**, le moteur installé par défaut, est un logiciel fermé dont les
conditions (version du 23/08/2026) permettent l'usage personnel et les besoins
internes d'une organisation, et interdisent l'usage comme service hébergé pour des
tiers. L'écran de première installation fait accepter ces conditions, pour soi ou au
nom de son organisation. Voir PROJET.md § 3.9 avant d'héberger une
instance pour un client.

### Développement web

Deux processus, dans deux terminaux :

```bash
npm run gateway
```

```bash
npm run dev
```

L'interface est sur `http://localhost:5173`, la passerelle sur
`http://localhost:8787` (Vite la sert derrière `/api`).

### Ligne de commande

`helix` (`cli/helix.mjs`, Node 20 ou plus, sans dépendance) parle à l'instance comme
l'interface : il affiche, et transmet vos réponses ; modèles, outils, barrière
d'approbation et journal restent ceux de l'instance. Sur un poste qui a le dépôt :
`npm link` (ou `node cli/helix.mjs`). Avec l'application : Réglages > Installer les
apps > CLI > « Mettre en place », qui pose `~/.local/bin/helix` (depuis le 25/09/2026) ;
sous Windows (depuis le 04/10/2026), `%USERPROFILE%\.helix\bin\helix.cmd`, et ce dossier
ajouté au PATH du compte (pas de droit d'administrateur ; « Retirer » enlève les deux). Ouvrir
ensuite un nouveau PowerShell ou une nouvelle Invite de commandes.

```
helix                          Chat interactif
helix chat "question"          Une question, une réponse (aussi : cat notes.txt | helix chat "résume")
helix chat --outils            Chat avec les outils de l'instance ; séance requise
helix code "demande"           Helix Code sur le dossier courant (sans demande : interactif)
helix connexion [--compte adresse@exemple.fr]
helix deconnexion
helix modeles                  Modèles de l'instance
helix outils                   Groupes d'outils et niveau d'accord de l'instance
helix aide
```

Options : `--adresse URL` (ou `HELIX_ADRESSE`, défaut `http://127.0.0.1:8787`),
`--jeton` (ou `HELIX_JETON` ; à défaut, le jeton de l'application du poste, lu
seulement pour une adresse locale), `--modele`, `--effort`, `--outils`. Dans une
conversation : `/nouveau`, `/modele [NOM]`, `/aide`, `/quitter` (ou Ctrl+D) ; Ctrl+C
arrête la réponse en cours. Une demande d'accord s'affiche en entier, « Autoriser ?
[o/N] » : seuls « o » ou « oui » accordent. Sans terminal, rien n'est accordé et
l'expiration vaut refus. Essai automatique : `npm run essai:cli` (ajouter
`-- --modele` avec LM Studio). Vérifié sur macOS seulement ; textes en français
seulement.

### Extension VS Code

`extensions/vscode/` (version 0.2.6, sans dépendance) : le Chat de l'instance et Helix Code
dans VS Code. **Installation** : le paquet `helix-ai-0.2.6.vsix` est joint à chaque version
GitHub (https://github.com/medhiclb/HelixAI/releases/latest) ; dans VS Code, vue Extensions,
menu « … » en haut de la vue, « Install from VSIX… », puis le fichier. Une version plus
récente s'installe de la même façon, par-dessus. Le paquet se refait avec `vsce package` dans
`extensions/vscode/` (les `.vsix` sont ignorés par git).

- Icône Helix dans la barre d'activité : onglets **Chat** (« Joindre le fichier ouvert »,
  coché par défaut ; « Insérer » au-dessus de chaque bloc de code, qui remplace la sélection
  ou insère au curseur) et **Code** (Helix Code sur le dossier ouvert, accords dans une
  fenêtre « Autoriser » / « Refuser »).
- Commandes : « Helix : expliquer la sélection » et « Helix : améliorer la sélection » (aussi
  au clic droit sur du code sélectionné), « Helix : nouveau Chat », « Helix : se connecter
  (pour Helix Code) », « Helix : se déconnecter ».
- Réglages : `helix.adresse` (défaut `http://127.0.0.1:8787`, `https` exigé hors de cet
  ordinateur), `helix.jeton` (vide : lu dans `~/.helix/data/instance-token`, seulement pour le
  port de l'application), `helix.modele` (vide : Auto). Les deux premiers sont de portée
  machine : le `.vscode/settings.json` d'un dépôt ne les change pas, et l'extension ne
  s'active que dans un espace de travail de confiance.
- Le Chat se contente du jeton d'instance ; l'onglet Code exige une séance (« Helix : se
  connecter » : compte, mot de passe, code si la double authentification est active), gardée
  par adresse dans le coffre de VS Code, et l'instance de cet ordinateur (sinon :
  `helix code --dossier`).
- Pendant la réflexion du modèle, la vue dit « Le modèle réfléchit (N s)… » (0.2.5, comme le
  code de la question, désormais mis en forme, et le bouton « Insérer », posé au-dessus du
  code).

Essai automatique : `npm run essai:vscode` (faux module `vscode`, vraie extension, instance
jetable ; ajouter `-- --modele` avec LM Studio).

### Passerelle modèles

`gateway/` est le seul point de contact avec l'inférence (cf.
[`ARCHITECTURE.md`](../ARCHITECTURE.md), ADR-001). Elle s'exécute directement par
Node 22+, sans étape de compilation en développement, et n'a qu'une dépendance
d'exécution : le SDK MCP (`@modelcontextprotocol/sdk`). Le pilote `pg` n'est
chargé que si une base PostgreSQL est déclarée dans le profil de déploiement.

Elle découvre automatiquement les moteurs disponibles :

| Backend | URL par défaut | Variable d'environnement |
|---|---|---|
| Cluster **exo** | `http://localhost:52415/v1` | `HELIX_EXO_URL` |
| **LM Studio** | `http://localhost:1234/v1` | `HELIX_LMSTUDIO_URL` |

D'autres backends OpenAI-compatibles (cloud européen, second cluster) s'ajoutent
par `backends` dans `helix.config.json`.

Une personne peut aussi brancher **sa propre clé** (Réglages, Modèles cloud) : Mistral,
Scaleway, OVHcloud, IONOS, OpenAI, Anthropic, Google Gemini, OpenRouter, Groq, DeepSeek,
xAI, Together AI, ou tout service compatible OpenAI par son adresse
(`gateway/src/fournisseurs.ts`). Tous sont appelés par leur point d'accès compatible
OpenAI ; leurs différences (liste des modèles paginée ou en tableau nu, capacités
déclarées, champs refusés, raisonnement dans `reasoning` ou en morceaux `thinking`,
appels d'outils sans `index`) sont traitées dans `gateway/src/modelesCloud.ts`, et
vérifiées contre des faux fournisseurs par `scripts/essai-fournisseurs.mjs` (lancé par
`npm run securite`, sans vraie clé ni appel sortant). L'état des essais avec de vraies
clés est tenu dans PROJET.md.

Un refus long d'un fournisseur (OpenAI renvoie par exemple la clé masquée, une centaine
d'étoiles) est abrégé avant d'arriver à l'écran (`abreger`, `modelesCloud.ts`) : les
étoiles deviennent « … », la coupe se fait entre deux mots à 240 caractères, et la bulle
d'erreur du Chat passe à la ligne n'importe où plutôt que de déborder (29/09/2026).

Pour le Chat, il suffit que **LM Studio tourne avec son serveur local activé** et qu'un
modèle de conversation soit installé. Si le serveur local est éteint, la passerelle
tente de le démarrer elle-même (`lms server start`) et le referme à la fermeture de
Helix si c'est elle qui l'avait allumé. La passerelle classe les modèles par rôle
(chat, code, vision, gui, embed), préfère un modèle déjà chargé, et relaie le canal de
raisonnement des modèles qui en émettent un (Qwen3, Kimi Thinking…). Depuis le 27/09/2026,
ce qui est en mémoire, c'est `lms ps` qui le dit : un modèle que LM Studio liste sans
l'avoir chargé (chargement à la demande) est chargé par Helix, avec ses réglages
(`--context-length 32768`, `--parallel 1` au processeur seul, `--gpu off` sous Windows et
Linux sans carte NVIDIA), puis passe l'essai de `santeModeles.ts`.

#### Routes servies

Toutes exigent le jeton d'instance, sauf `GET /` et `GET /health`. Celles marquées
« séance » exigent en plus une séance utilisateur ouverte (voir
[`SECURITE.md`](../SECURITE.md)).

| Route | Rôle | Séance |
|---|---|---|
| `GET /`, `GET /health` | Contrôle de présence. Sans jeton, ne renvoie que la présence du service | non |
| `GET /v1/models`, `GET /helix/models` | Catalogue des modèles, avec leurs rôles. `/v1/models` accepte aussi une clé d'API seule | non |
| `POST /v1/chat/completions` | OpenAI-compatible. Accepte en plus `role`, `effort`, `tools` et `connaissances` ; accepte aussi une clé d'API seule (voir « Clés d'API ») | si `tools: true` |
| `POST /helix/models/load` | Charge un modèle en mémoire | oui |
| `GET /helix/provision`, `GET /helix/provision/stream` | État et progression de la mise en route ; `modeles` : tout le catalogue libre pour la page Modèles, avec `installe` et, pour ceux qui ne tiennent pas, `tropLourd` (raison chiffrée) | non |
| `POST /helix/provision/moteur` | Installe le moteur de LM Studio (llmster sur Mac à puce Apple, Windows et Linux ; llama.cpp sur Mac Intel, sans conditions à accepter) ; administrateur seul, une installation à la fois, conditions de LM Studio acceptées | oui |
| `POST /helix/provision/start` | Télécharge et charge un modèle du catalogue (`{ "model": "<clé>", "role": "chat" \| "gui" }`) ; 409 avec la raison si le modèle nommé ne tient pas sur la machine | oui |
| `GET /helix/emplacement-modeles` | Où vont le moteur et les modèles, place libre, place nécessaire, ce qui peut changer | oui |
| `POST /helix/emplacement-modeles` | Choisit l'emplacement (`{ "dossier": "D:\\IA" }`, ou `null` pour l'habituel) ; déplace les modèles de llama.cpp s'il y en a ; administrateur seul, au journal | oui |
| `POST /helix/emplacement-modeles/verifier` | Juge un dossier sans rien changer (sous-dossier qui serait créé, place libre) ; administrateur seul | oui |
| `POST /helix/auth/create`, `POST /helix/auth/verify` | Création de compte, connexion | voir ci-dessous |
| `POST /helix/auth/premier-mot-de-passe` | Premier mot de passe d'un compte créé avant 0.9.0, une seule fois | non |
| `POST /helix/auth/deux-facteurs` | Second pas de la connexion : défi remis par `verify` et code | non |
| `GET /helix/auth/deux-facteurs/etat`, `POST …/preparer`, `…/activer`, `…/desactiver`, `…/codes` | Réglage de la double authentification de la personne connectée | oui |
| `GET /helix/export` | Export RGPD des données de la personne connectée | oui |
| `GET /helix/compte/effacement`, `POST /helix/compte/effacer` | Aperçu puis suppression de son propre compte | oui |
| `POST /helix/auth/deux-facteurs/inscription`, `…/inscription/activer` | Activation imposée du second facteur à la connexion (défi d'inscription) | non |
| `GET /helix/auth/sessions`, `POST /helix/auth/revoke` | Séances ouvertes, révocation | oui |
| `GET /helix/data` | Révisions par collection, sans contenu | non |
| `GET`/`PUT /helix/data/<collection>` | Lecture et écriture d'une collection | oui, sauf lecture de `accounts` |
| `GET /helix/audit` | Journal d'audit et vérification de sa chaîne | oui |
| `GET /helix/mcp`, `POST /helix/mcp/toggle`, `POST /helix/mcp/workspace` | Serveurs d'outils et espace de travail | oui pour les deux `POST` |
| `GET /helix/code`, `GET /helix/code/events` | État du moteur, flux d'évènements d'une session | non |
| `GET /helix/dossiers`, `POST /helix/code/session`, `POST /helix/code/prompt`, `POST /helix/code/interrupt` | Écran Code (OpenCode) | oui |
| `GET /helix/code/sessions`, `GET`/`DELETE /helix/code/sessions/<id>` | Sessions de Code de la personne, avec `enCours` ; historique relu chez OpenCode ; retrait de la liste (409 tant que la session travaille) | oui |
| `GET /helix/codex`, `POST /helix/codex/connexion`, `…/connexion/annuler`, `…/tache`, `…/arreter` | Codex avec le compte ChatGPT du propriétaire du poste : état, `codex login`, tâche en flux, arrêt (SECURITE.md § 30). Refusé hors de l'application de bureau, sur une instance partagée, hors de la boucle locale, sans compte administrateur ou par clé d'API | oui |
| `GET /helix/computer`, `GET /helix/computer/events` | État du contrôle de l'écran, flux des approbations | non |
| `POST /helix/computer/action`, `POST /helix/computer/approve` | Demander et approuver une action d'écran | oui |
| `GET /helix/atelier` | Diagnostic de l'atelier bureautique de Cowork | non |
| `POST /helix/atelier/preparer`, `POST /helix/atelier/verifier` | Installer et vérifier l'atelier | oui |
| `GET`/`POST /helix/employes`, `POST /helix/employes/<id>`, `…/supprimer`, `…/message`, `GET …/message/<travail>`, `…/echanges`, `…/activite`, `POST …/missions/<m>/lancer` | Employés OpenClaw : équipe, déploiement, conversation, activité (SECURITE.md § 14) | oui |
| `…/canaux` (`GET`, `POST`), `…/canaux/<type>/retirer`, `…/canaux/whatsapp/qr`, `…/demandes`, `…/demandes/<canal>/<code>/accepter` | Messageries d'un employé, liaison WhatsApp par QR, personnes à accepter | oui |
| `GET`/`POST /helix/fournisseurs`, `POST …/essayer`, `POST …/<id>`, `…/<id>/supprimer` | Clés de modèles cloud (SECURITE.md § 15) | oui |
| `POST /helix/employes/<id>/outils` | Serveur d'outils MCP de l'employé, appelé par l'instance OpenClaw (clé `X-Helix-Cle`) | non, clé |
| `GET`/`POST /helix/connaissances`, `GET …/documents`, `POST …/chercher`, `GET`/`POST …/<id>`, `POST …/<id>/{documents,retirer,reindexer,supprimer}` | Bases de connaissances (SECURITE.md § 22.2) ; champ `connaissances` du corps de `POST /v1/chat/completions` | oui |
| `GET /helix/entrainement`, `GET …/projet?id=`, `POST …/{installer,desinstaller,projets,renommer,exemples,importer,generer,lancer,arreter,comparer,publier,retirer,supprimer}` | Entraîner un modèle (SECURITE.md § 22.3) | oui |
| `/helix/code/outils` | Connecteurs servis par MCP à l'agent de code de l'instance (jeton et clé `X-Helix-Cle`, SECURITE.md § 22.4) | non, clé |
| `GET`/`POST /helix/cles-api`, `POST …/<id>` (renommer), `POST …/<id>/revoquer` | Clés d'API personnelles : liste (avec les adresses de l'API réellement servies), création, renommage, révocation (SECURITE.md § 23) | oui |
| `GET /helix/usage`, `POST /helix/usage/tarif` | Mon usage : consommation de la personne, coût par modèle (tarif saisi, sinon prix publié par son fournisseur, marqué estimé) ; saisie ou retrait d'un tarif | oui |

#### Clés d'API

Depuis le 26/09/2026, une clé créée dans Réglages → API développeur remplace le
jeton d'instance **et** la séance, sur `GET /v1/models` et `POST /v1/chat/completions`
seulement, au nom de sa titulaire (ses modèles, ses bases, sa consommation, son
journal). Elle se présente dans `Authorization: Bearer hlx_…`, jamais dans l'adresse.
Toute autre route répond 403 à une clé ; `tools: true` aussi ; 60 requêtes par minute
et par clé (`HELIX_CLE_API_PAR_MINUTE`). Sans `stream: true`, la réponse est un objet
`chat.completion` ; avec, le flux du moteur tel quel. `POST /v1/embeddings` n'est pas
servi.

```sh
export HELIX_API_KEY=hlx_…
curl http://localhost:8787/v1/chat/completions \
  -H "Authorization: Bearer $HELIX_API_KEY" -H "Content-Type: application/json" \
  -d '{"model": "lmstudio/qwen3-8b", "messages": [{"role": "user", "content": "Bonjour"}], "connaissances": ["kb_…"]}'
```

```python
import os
from openai import OpenAI

client = OpenAI(base_url="http://localhost:8787/v1", api_key=os.environ["HELIX_API_KEY"])
r = client.chat.completions.create(
    model="lmstudio/qwen3-8b",
    messages=[{"role": "user", "content": "Bonjour"}],
    extra_body={"connaissances": ["kb_…"]},  # facultatif : bases de connaissances
)
print(r.choices[0].message.content)
```

Les passages cités reviennent, sans flux, dans `helix.sources`. L'identifiant du modèle
est le champ `id` de `GET /v1/models`. Depuis une autre machine, l'API n'est joignable
que si l'instance est ouverte aux collègues ; elle chiffre alors avec un certificat
auto-signé (`<données>/tls/instance-cert.pem`, à donner à `curl --cacert`). Vérifié le
26/09/2026 avec `curl` et Python `urllib`.

#### Variables d'environnement

| Variable | Effet | Défaut |
|---|---|---|
| `HELIX_GATEWAY_PORT` | Port d'écoute | `8787` |
| `HELIX_GATEWAY_HOST` | Interface d'écoute | `127.0.0.1`, ou `0.0.0.0` si `share: true` |
| `HELIX_CONFIG` | Chemin du profil de déploiement | `./helix.config.json` |
| `HELIX_DATA_DIR` | Données, jeton, journal, TLS, clé `.cle`, et l'atelier Cowork (sous-dossier `cowork`) | `~/.helix/data` |
| `HELIX_TOKEN` | Jeton d'instance imposé | tiré au sort au premier démarrage |
| `HELIX_TOKEN_FILE` | Fichier du jeton | `<données>/instance-token` |
| `HELIX_WORKSPACE` | Espace de travail de l'agent | `workspace` du profil, sinon `~/Helix` |
| `HELIX_CODE_DIR` | Dossier de départ de l'écran Code | `workspace` du profil, sinon `~/Helix` |
| `HELIX_EXO_URL`, `HELIX_LMSTUDIO_URL` | Adresses des backends | voir tableau ci-dessus |
| `HELIX_DECHARGEMENT_GPU` | Part du modèle confiée à la carte graphique par `lms load --gpu` : `auto` (LM Studio décide), `off`, `max` ou un nombre entre 0 et 1 | `off` sous Windows et Linux sans carte NVIDIA, sinon LM Studio décide |
| `HELIX_OPENCODE_BIN` | OpenCode à utiliser : quand elle est posée, Helix n'installe pas le sien | aucune |
| `HELIX_CODEX_BIN` | Programme `codex` à utiliser pour l'écran Code, avant le `PATH`, Homebrew, `~/.local/bin`, npm global, Volta, Bun et nvm ; jamais sous `~/.codex` | cherché |
| `HELIX_BUREAU` | Posée à `1` par l'application de bureau pour sa passerelle : sans elle, Codex n'est pas proposé (un serveur n'est le poste de personne). Ne pas la poser à la main sur un serveur | absente |
| `HELIX_SANS_MISE_A_JOUR` | `1` : l'application ne contacte aucune source de mise à jour (ni serveur de l'agence, ni instance, ni GitHub) | absente |
| `HELIX_ESSAI_MODELE_MS` | Délai de la courte question d'essai posée à un modèle local après son chargement (`santeModeles.ts`) ; dépassé, l'essai est « sans conclusion » et le modèle gardé. Le résultat de chaque essai est dans `modeles-sur-cette-machine.json`, dossier des données (l'effacer fait tout réessayer) | `180000` |
| `HELIX_MAX_ETAPES` | Plafond d'allers-retours d'outils | `30` |
| `HELIX_BUDGET_ETAPE` | Actions accordées à une étape d'un travail découpé, 4 au moins (à défaut : 8, 14 ou 20 selon la taille du modèle) | selon le modèle |
| `HELIX_CAPTURE_LARGEUR` | Largeur de la capture envoyée au modèle | `1024` |
| `HELIX_CUA_URL`, `HELIX_CUA_CONTAINER`, `HELIX_CUA_KEY` | Serveur cua du mode `sandbox` | `http://127.0.0.1:8000` |
| `HELIX_APPS_DIR` | Où installer l'application LM Studio (Mac Intel seulement : ailleurs, c'est llmster, dans `~/.lmstudio`) | `/Applications`, sinon `~/Applications` |
| `HELIX_MOTEUR` | Moteur local : `llamacpp` (llama.cpp, d'office sur Mac Intel, sur demande ailleurs sur macOS) ou `lmstudio` | selon la machine |
| `HELIX_LLAMACPP_PORT` | Port du serveur llama.cpp, sur 127.0.0.1 | `8795` |
| `HELIX_GATEWAY_URL` | Cible du proxy Vite en développement | `http://localhost:8787` |
| `VITE_GATEWAY_URL` | Instance imposée à la construction de l'interface | aucune |

### Outils (MCP)

La passerelle lance des **serveurs MCP auto-hébergés** et expose leurs outils au modèle.
Quand l'interrupteur **Outils** est actif dans le Chat, l'agent peut demander l'exécution
d'un outil : la passerelle l'exécute, lui renvoie le résultat, et le cycle se répète
jusqu'à la réponse finale. L'activité est tracée dans la conversation.

Le budget d'allers-retours s'adapte au modèle : 30 étapes en exécution directe
pour un modèle de moins de 14 milliards de paramètres, 40 jusqu'à 45 milliards,
50 au-delà. Ce budget est **plafonné par `HELIX_MAX_ETAPES`, qui vaut 30 par
défaut** : 40 et 50 ne sont atteints que si la variable est relevée. Pour un
petit modèle, c'est **le modèle qui juge** si une demande doit être découpée en
étapes, chacune avec son propre budget, plus court (8, 14 ou 20 selon la taille,
ou `HELIX_BUDGET_ETAPE`) ; une étape trop grosse est redécoupée, et une étape qui
modifie est contrôlée sur l'état réel. Trois étapes avant la
limite, l'agent est invité à conclure et à rendre compte plutôt que d'être coupé
net. Le barème complet est dans [`ARCHITECTURE.md`](../ARCHITECTURE.md), ADR-012.

Serveur par défaut : accès **fichiers** limité à un espace de travail explicite. Il est
lancé par `npx -y @modelcontextprotocol/server-filesystem <espace>` : le `npx` de la
machine, sinon celui du Node que Helix pose (27/09/2026), et, au tout premier lancement,
un accès au registre npm pour récupérer ce paquet.

```bash
HELIX_WORKSPACE=/chemin/vers/dossier npm run gateway
```

Par défaut : `~/Helix`. L'espace se change ensuite depuis l'interface, par le
sélecteur de dossier de macOS (`POST /helix/mcp/workspace`). Le chemin est validé
côté instance : tout dossier est admis, disque externe compris, sauf les
emplacements du système et la racine du disque.

### Connecteurs

**Réglages → Connecteurs.** Une grille de tuiles, un clic par service :

| Service | Protocole | Outils offerts à l'agent |
|---|---|---|
| Courrier | IMAP : lecture et brouillons ; SMTP : envoi, s'il est activé, chaque mail montré en entier et accepté un par un (ou sans confirmation, si on le choisit, sauf en réponse à un mail reçu) | `courrier__derniers`, `courrier__chercher`, `courrier__lire`, `courrier__brouillon`, `courrier__envoyer` |
| Agenda | CalDAV, lecture seule | `agenda__prochains`, `agenda__jour`, `agenda__chercher` |
| Google Drive | API Google, lecture seule | `drive__chercher`, `drive__recents`, `drive__dossier`, `drive__lire` |
| Slack | API Slack, lecture seule | `slack__salons`, `slack__messages`, `slack__fil`, `slack__chercher` |
| Notion | serveur MCP officiel | ceux du serveur |

**Google Drive** : l'entreprise crée son propre client OAuth sur console.cloud.google.com
(API Google Drive activée ; audience « Interne » sous Google Workspace ; client de type
« Application de bureau »), puis l'inscrit dans `helix.config.json` :
`"google": { "clientId": "…", "clientSecret": "…" }`, et redémarre l'instance. On
branche ensuite depuis Réglages, Connecteurs : le navigateur s'ouvre pour l'accord.
**Slack** : on crée l'application depuis le manifeste affiché à l'écran
(api.slack.com/apps, « From a manifest »), on l'installe dans l'espace, on colle son
jeton `xoxb-`, puis on l'invite dans les salons à lire. Laisser la distribution
publique désactivée.
Google Drive, l'agenda (CalDAV ou Google Agenda) et Slack valent pour toute
l'instance, comme la boîte mail commune : seul l'administrateur les branche, les
remplace ou les débranche ; chaque membre en voit l'état, et ses agents les lisent.

**Connexions natives** (`gateway/src/oauthNatif.ts` pour la connexion, `outilsNatifs.ts` et
`gateway/src/natifs/` pour les outils, guides pas à pas dans `src/lib/guidesApplications.ts`) :
Google Sheets, Slides, Docs, Forms, YouTube, Dropbox, LinkedIn, Facebook, Instagram, TikTok,
X, Brevo, Mailchimp, Microsoft 365, messageries, commerce. Chaque organisation crée son
application chez le service (le panneau dit où, et quoi recopier) ; brancher, débrancher,
enregistrer une application : l'administrateur seul ; lire : tout Chat ; écrire ou publier :
une carte d'accord à chaque fois, même au niveau « Tout approuver », acceptée par
l'administrateur seul ; dix écritures ou publications par heure et par service au plus, un
doublon dans la demi-heure refusé.

**LinkedIn, deux lignes et deux applications** (29/09/2026) :

| Ligne | Application LinkedIn | Portées | Outils |
|---|---|---|---|
| LinkedIn | celle du profil (produits « Sign In with LinkedIn using OpenID Connect », « Share on LinkedIn ») | `openid profile` ; `w_member_social` si « publier » est coché | `linkedin__profil`, `linkedin__publier` (au nom du profil seulement) |
| LinkedIn (Page d'entreprise) | une seconde, neuve, avec le seul produit « Community Management API » | `r_organization_social`, `rw_organization_admin` ; `w_organization_social` si « publier » est coché | `linkedin__pages`, `linkedin__publications`, `linkedin__statistiques` (partages des douze derniers mois), `linkedin__publier_page` |

LinkedIn n'accorde « Community Management API » qu'à une application qui n'a aucun autre
produit, et après examen : organisation, adresse e-mail professionnelle, vérification de
l'application par un super administrateur de la page (« Settings », « Verify », lien valable
30 jours). Il n'annonce pas de délai. Le compte branché doit administrer au moins une page
(rôle ADMINISTRATOR) ; la page visée est toujours prise parmi celles-là. Au palier de
développement, LinkedIn permet 500 appels par jour pour l'application et 100 par personne,
et chaque outil de page
coûte un appel plus un par page. Les deux lignes partagent l'adresse de retour
(`/helix/oauth/retour`). Essai : `scripts/essai-natifs.mjs` (lancé par `npm run securite`).

**Palmier Pro** (29/09/2026, `gateway/src/palmier.ts`, `gateway/src/palmierRegles.ts`) :
monteur vidéo pour macOS 26 sur Mac à puce Apple, d'un autre éditeur, avec génération de
vidéos, d'images et de son chez Palmier. Ouvert, il sert un serveur MCP sur
`http://127.0.0.1:19789/mcp`. Le catalogue (`gateway/src/connecteurs.ts`) le déclare comme
entrée `local` : port et chemin écrits dans le catalogue, jamais reçus d'une requête. Ligne
« Palmier Pro » de la rubrique « Documents et données », bouton « Brancher » (un clic, sans
navigateur ni jeton), « Réessayer » après une fermeture ; la ligne n'est servie que sur un Mac à
puce Apple, et demande macOS 26 ou plus récent.

- Avant chaque requête, l'instance vérifie que le programme à l'écoute est bien Palmier Pro :
  processus trouvé par `lsof`, signature du processus vérifiée par `codesign` (identifiant
  `io.palmier.pro`, équipe `MMFLRC7562`), exécutable dans /Applications ou ~/Applications.
  Sinon, rien ne lui est envoyé. Aucune autre adresse locale n'est acceptée pour un serveur
  MCP : en http, seulement une entrée `local` sur 127.0.0.1 et son port ; en https, jamais
  `localhost` ni une adresse IP interne.
- Neuf lectures passent sans carte (`get_timeline`, `inspect_timeline`, `get_media`,
  `inspect_media`, `get_multicam`, `detect_beats`, `inspect_color`, `list_models`,
  `read_skill`) ; tout le reste, et tout outil inconnu, demande une carte d'accord à chaque
  appel, à tout niveau, que seul l'administrateur accepte. Les employés et l'agent de code
  n'ont que les lectures.
- Les générations (`generate_video`, `generate_image`, `generate_audio`, `upscale_media`)
  partent chez Palmier, hors de la machine, sur l'abonnement ou les crédits du compte Palmier ;
  `get_transcript` et `add_captions` peuvent passer par son service de transcription. La carte
  le dit.

Essai : `npm run essai:palmier` (faux Palmier Pro sur un port libre, repris par
`npm run securite`).

Pour Gmail et Google Agenda, il faut un **mot de passe d'application** Google,
pas le mot de passe habituel : le formulaire l'indique et pré-remplit le serveur
d'après le domaine de l'adresse. Une boîte Workspace ou Microsoft 365 se branche aussi
sans mot de passe, par « Se connecter avec Google » ou « Se connecter avec Microsoft »,
avec l'application de l'organisation ; Microsoft 365 (Outlook, OneDrive, SharePoint,
Excel, Word, Teams) a aussi ses lignes dans Connecteurs, par une seule connexion.

Les outils d'un service ne sont proposés à l'agent qu'une fois ce service
configuré, et ils le sont dans le Chat comme dans Cowork et Code. Dans le Chat,
l'agent dispose aussi de la **bibliothèque** et des **réunions** transcrites
(`bibliotheque__…`, `reunions__…`), en lecture, selon ce que la personne y voit.

### Approbation des actions

**Barre du bas de la zone de saisie (Cowork et Code).** Trois niveaux : tout approuver,
demander avant de modifier (**défaut**), demander pour tout. La barrière est appliquée
par la passerelle, et le niveau vaut pour toute l'instance : seul son administrateur le
change. Toujours confirmés, à tout niveau : envoyer un mail (sauf envoi sans confirmation
activé par l'administrateur), supprimer un événement, programmer une tâche. Détail dans
[`SECURITE.md`](../SECURITE.md), § 6.2 et § 28.

**Tâches programmées** (`gateway/src/tachesProgrammees.ts`) : routes
`/helix/taches-programmees` (séance exigée, chacun les siennes) ; exécution par la route
du Chat sur la boucle locale, avec une clé tirée au sort à chaque démarrage.

**Vidéos** (`gateway/src/images.ts`) : routes `/helix/videos` (état, `installer`,
`choisir`, `desinstaller`, `creer`) ; suivi et fichier par `/helix/images/travail/<id>` et
`/helix/images/fichier/<id>`, servi en `video/webm`.

**Mises à jour signées** : `npm run cle:editeur` une fois (clé dans `~/.helix-editeur/`,
hors du dépôt), puis chaque `npm run package` signe l'application ; sans la clé, la
fabrication s'arrête, sauf `HELIX_SANS_CLE_EDITEUR=1`. Détail dans
[`SIGNATURE.md`](../SIGNATURE.md), § 4.

### Atelier bureautique de Cowork

Cowork sait manipuler des fichiers, mais il ne sait produire ni relire un
document Word, Excel, PowerPoint ou PDF tant que la machine ne porte pas les
bibliothèques correspondantes. La carte **Préparer Cowork**, dans le panneau
droit de Cowork, s'en charge.

Elle procède en trois temps : un **diagnostic** en lecture seule (Python, pip,
Node, npm, bibliothèques présentes ou manquantes, outils optionnels), une
**confirmation** qui annonce le nombre de paquets, la place occupée et le
dossier exact, puis l'**installation** suivie d'une **vérification** qui produit
et relit un document de chaque format.

Trois garanties, appliquées par le code de la passerelle
(`gateway/src/atelier.ts`) :

- la liste des paquets est **figée dans le code**. Le modèle ne décide rien, et
  aucune chaîne de commande n'est construite depuis une entrée utilisateur ;
- tout est installé dans un environnement **isolé** sous
  `<HELIX_DATA_DIR>/cowork` (par défaut `~/.helix/cowork`) : un environnement
  virtuel Python et un préfixe npm. Ni les installations globales, ni le `PATH`,
  ni les projets ne sont touchés ;
- **aucun droit administrateur** n'est demandé.

LibreOffice et les outils Poppler ne sont pas installés automatiquement : ils
pèsent plusieurs centaines de mégaoctets et peuvent demander des droits. Leur
présence est signalée, avec ce qu'elle apporterait.

Une fois l'atelier installé, cinq outils s'ajoutent à ceux du serveur de
fichiers (`gateway/src/bureau.ts`), dans la même liste proposée au modèle :

| Outil | Effet |
|---|---|
| `bureau__creer_document` | Word `.docx` : titre, paragraphes, tableaux |
| `bureau__creer_classeur` | Excel `.xlsx` : onglets, lignes, formules (`=SUM(...)`) |
| `bureau__creer_presentation` | PowerPoint `.pptx` : titre et puces par diapositive |
| `bureau__creer_pdf` | PDF mis en page sur du A4 |
| `bureau__lire_document` | Extrait le texte d'un `.docx`, `.xlsx`, `.pptx` ou `.pdf` |

Tant que l'atelier n'est pas installé, la liste est vide : proposer au modèle
des outils qui échoueront le pousse à s'acharner dessus.

Deux garanties, à connaître avant de vendre la production de documents :

- **le modèle fournit des données, jamais du code.** Les scripts Python sont des
  constantes du module et rien n'y est interpolé. Les paramètres voyagent en
  JSON sur l'entrée standard, pas en ligne de commande ;
- **rien ne s'écrit hors de l'espace de travail.** Chaque chemin est résolu par
  `realpath`, liens symboliques compris, puis comparé à la racine réelle de
  l'espace.

⚠ Ce n'est **pas** un outil d'exécution générique, et c'est délibéré : le modèle
remplit cinq gabarits, il ne lance ni commande ni code. Un graphique, une mise
en forme fine ou une conversion de format sortent de ce périmètre.

### Profil de déploiement client

Helix est installé par l'intégrateur, réglé sur le matériel et les usages de chaque client.
Copiez [`helix.config.example.json`](../helix.config.example.json) en `helix.config.json`
(ou pointez `HELIX_CONFIG` ailleurs) : **ce fichier prime sur toute détection automatique**.

Il permet de fixer, par client :

- le **modèle imposé pour chaque rôle** (`chat`, `code`, `vision`, `gui`, `embed`) ;
- les **backends** (adresse du cluster, ajout d'un cloud européen, désactivation de LM Studio) ;
- l'**espace de travail** accessible à l'agent ;
- `autoProvision: false` pour désactiver le téléchargement automatique (l'intégrateur gère
  les modèles) ;
- le mode **computer-use** : `sandbox` (VM dédiée, recommandé), `hote`, ou `desactive`.
  Écrit ici, il fait foi ; absent, la personne peut l'activer elle-même depuis
  Réglages, Contrôle de l'écran, sur un poste autonome et sous mot de passe ;
- `google` : le client OAuth de l'entreprise, pour le connecteur Google Drive ;
- `deuxFacteursObligatoire: true` pour **imposer la double authentification** à tous les
  comptes : une personne qui ne l'a pas l'active à sa connexion suivante, avant toute
  séance (SECURITE.md § 2.1) ;
- `database` pour une instance **PostgreSQL** : le pilote est livré avec l'application,
  et la base est chiffrée comme les fichiers.
- `openclaw` pour les **agents toujours actifs** : Helix installe OpenClaw lui-même à
  la première mise en service et propose ses mises à jour ; `version` et `node` fixent
  les versions installées, `chemin` impose un exécutable OpenClaw déjà présent (sous
  Windows, le `openclaw.cmd` posé par npm ou le script `openclaw.mjs` : Helix lance
  Node sur ce script, jamais le `.cmd`), `port` déplace l'instance dédiée (18800 par
  défaut). Sous Windows, deux modules d'OpenClaw demandent les bibliothèques Visual C++
  de Microsoft (`VCRUNTIME140.dll`) : quand elles manquent, Helix télécharge et vérifie
  le paquet officiel de Microsoft, puis Windows demande l'autorisation d'administrateur
  pour l'installer ; sur un compte sans ce droit, l'administrateur du PC l'installe
  depuis https://learn.microsoft.com/cpp/windows/latest-supported-vc-redist. Aucun
  réglage du profil ne change ce paquet ;
- `journalConservationJours` : durée de conservation du **journal d'audit** (90 jours
  par défaut, de 30 à 3650) ; `journalCopie` en recopie chaque ligne ailleurs.

Sans ce fichier, la passerelle profile la machine et se débrouille seule.

## Ce qui sort de la machine, et ce qui n'en sort jamais

C'est le cœur de la promesse Helix, et il vaut mieux le dire exactement.

**Ne sortent jamais de la machine, ni de l'instance :**

- les **conversations**, les documents joints, les fichiers lus ou écrits par l'agent ;
- l'**inférence** elle-même : les requêtes partent vers les backends déclarés, qui sont
  par défaut `localhost:1234` (LM Studio) et `localhost:52415` (cluster exo) ;
- les **comptes**, profils, projets, tâches et agents, qui vivent dans `~/.helix/data`
  ou dans la base PostgreSQL de l'entreprise ;
- les **captures d'écran** du mode `hote`, qui vont au modèle local et nulle part ailleurs ;
- aucun service d'authentification, de télémétrie ou d'analytique n'est contacté. La
  politique de sécurité du contenu de l'application empaquetée interdit à l'interface de
  charger un script, une police ou une image venus d'ailleurs.

**Sortent, à l'installation et à la mise en route :**

| Destination | Quand | Pourquoi |
|---|---|---|
| `registry.npmjs.org` | `npm install`, puis au premier démarrage du serveur d'outils, lancé par `npx` | Récupérer le code du serveur MCP fichiers, qui n'est pas empaqueté |
| `llmster.lmstudio.ai` | Bouton « Installer le moteur » (Mac à puce Apple, Windows, Linux) | Télécharger le moteur sans interface de LM Studio, version épinglée (0.0.25-1) ; l'empreinte SHA-512 écrite dans le code est vérifiée avant ouverture ; rien n'est lu en ligne pour choisir la version |
| `api.github.com`, puis `github.com` (publications du dépôt, `depotMisesAJour` dans `package.json`) | Poste installé seul (ni serveur de l'agence dans le paquet, ni instance) : peu après le lancement, puis toutes les six heures ; `HELIX_SANS_MISE_A_JOUR=1` l'arrête | Savoir si une version plus récente est publiée. Sur macOS, sur le clic de la personne, télécharger l'archive décrite par `helix-mise-a-jour.json` (empreinte SHA-512, puis signature de l'éditeur vérifiée avec la clé de l'application installée). Sous Windows (x64), le manifeste est lu aussi à chaque vérification ; sur le clic de la personne, l'installateur `Helix-Setup-<version>-x64.exe` qu'il décrit est téléchargé (GitHub redirige vers son stockage de fichiers), vérifié de même (SHA-512, signature de l'éditeur), puis lancé en silence (SECURITE.md § 29.11). Sous Linux, et sous Windows sans partie Windows signée, rien n'est téléchargé par Helix : la fenêtre ouvre le paquet dans le navigateur |
| `github.com` (anomalyco/opencode) | Sans clic depuis le 27/09/2026 : au démarrage de la passerelle et après la mise en route du modèle, si aucun OpenCode n'est sur la machine ; à l'ouverture de l'écran Code par l'administrateur ; « Réessayer » ou « Installer OpenCode » sur cet écran. Jamais quand un OpenCode existe déjà (`HELIX_OPENCODE_BIN` compris), ni avec `"autoProvision": false` dans le profil (sauf clic de l'administrateur), ni depuis un poste rattaché | OpenCode 1.18.32, archive vérifiée par son empreinte SHA-256 écrite dans le code, avant ouverture |
| `github.com` (python-build-standalone) | Atelier, dictée ou entraînement, sur une machine sans Python qui convienne | CPython 3.12.14 autonome, publication épinglée, empreinte SHA-256 écrite dans le code |
| `pypi.org`, `files.pythonhosted.org` | Préparation de l'atelier, installation de la dictée | Les bibliothèques de documents et de transcription, dépendances comprises, à versions figées : pip refuse tout fichier dont l'empreinte n'est pas dans `gateway/src/atelier-paquets.json` (`--require-hashes`) |
| `registry.npmjs.org` (atelier) | Préparation de l'atelier | Les six bibliothèques Node et leurs dépendances, posées par `npm ci --ignore-scripts` depuis le fichier de verrouillage de `atelier-paquets.json` (empreinte SHA-512 de chaque archive) |
| `huggingface.co` (dictée) | Installation de la dictée | Le modèle Whisper, à une révision épinglée ; l'empreinte de chaque fichier est vérifiée après le téléchargement |
| `nodejs.org` | Atelier sans npm sur la machine, ou premier serveur d'outils sans `npx` | Le même Node officiel que pour OpenClaw, archive vérifiée par son empreinte |
| Catalogue de modèles de LM Studio (HuggingFace) | Téléchargement d'un modèle (`lms get`) | Récupérer les poids. Ce trafic est le fait de LM Studio, que Helix pilote en ligne de commande |
| `registry.npmjs.org`, via OpenCode | Premier usage de l'écran Code | OpenCode charge l'adaptateur `@ai-sdk/openai-compatible` déclaré dans la configuration écrite par Helix |
| `pypi.org` et `registry.npmjs.org` | Bouton « Préparer l'atelier » de Cowork | Télécharger les bibliothèques bureautiques (Word, Excel, PowerPoint, PDF). La liste des paquets est figée dans le code de la passerelle, l'utilisateur la voit avant d'accepter |
| `pypi.org` et `huggingface.co` | Installation de la dictée ou de la transcription des réunions, sur demande | Le moteur de transcription, puis le modèle Whisper adapté à la machine, à une révision figée. Ensuite, la transcription tourne hors ligne |
| `registry.npmjs.org` | Page Agents, au plus deux fois par jour | Lire le numéro de la dernière version publiée d'OpenClaw, pour la dire à l'écran. Rien n'est envoyé |
| `nodejs.org`, puis `registry.npmjs.org` | Bouton « Installer OpenClaw », ou premier déploiement d'un employé | Un Node.js officiel (archive vérifiée par son empreinte SHA-256 ; `.zip` sous Windows, x64 ou arm64), puis OpenClaw à la version éprouvée, dans `<données>/openclaw-moteur`. Sous Windows, Helix pose et lance OpenClaw en natif, sans WSL ni tâche planifiée (`node.exe openclaw.mjs`) ; les commandes d'un employé, au palier Libre, passent par PowerShell |
| `download.visualstudio.microsoft.com` | Windows seulement : installation d'OpenClaw (ou bouton « Installer les bibliothèques de Microsoft » de la page Agents) quand `VCRUNTIME140.dll` manque dans System32, ou est plus ancienne que celle qu'OpenClaw demande | Le « Microsoft Visual C++ Redistributable » officiel, x64 ou arm64, à une adresse versionnée écrite dans le code (14.51.36247.0) ; taille, empreinte SHA-256 et signature Authenticode de Microsoft vérifiées avant le lancement. Windows demande l'autorisation d'administrateur (UAC) ; sans elle, rien n'est installé et l'écran donne la page officielle de Microsoft. Rien n'est envoyé |
| `registry.npmjs.org` | Premier employé au palier Étendu, premier branchement de WhatsApp, Discord, Slack ou Mattermost | Extensions officielles d'OpenClaw (recherche web DuckDuckGo, messageries), installées dans le dossier de l'instance |
| Le serveur de mise à jour **de l'agence** | Au lancement puis toutes les six heures, si une adresse est inscrite dans le paquet | Savoir si une version plus récente existe, et la télécharger si l'application est signée. Rien d'autre n'est envoyé que la requête du fichier `latest-mac.yml` (SIGNATURE.md § 4) |

Ces échanges sont des **téléchargements de logiciel et de modèles**. Aucune donnée
métier, aucune conversation, aucun identifiant ne les accompagne. Une fois
l'installation faite, une instance fonctionne sans accès à Internet.

**Sortent uniquement si quelqu'un le décide :** un backend cloud ajouté par l'intégrateur
dans `helix.config.json`, ou un fournisseur dont une personne a branché la clé
(Réglages, Modèles cloud), reçoit les conversations envoyées à ses modèles. Chaque
modèle affiche où il tourne, et aucun modèle cloud n'est choisi d'office. Un employé au
palier Étendu consulte le web (recherche DuckDuckGo, pages lues) ; un employé branché
sur une messagerie échange avec ses serveurs (Telegram, WhatsApp, Discord, Slack,
Mattermost). Dans l'écran Code, le **propriétaire du poste** peut choisir **Codex**
(27/09/2026, PROJET.md § 3.14) : c'est alors le programme `codex` d'OpenAI, installé et
connecté par la personne, qui parle à OpenAI lui-même, aux États-Unis, avec le compte
ChatGPT de la personne. Il y envoie la demande et ce qu'il lit sur le poste pour la
traiter ; la connexion (`codex login`) se fait dans le navigateur, chez OpenAI. Helix ne
voit passer ni ce trafic ni aucun jeton, ne lit rien dans `~/.codex`, et n'installe pas
Codex. Hors de ce choix, rien ne part chez OpenAI. Le **bot de réunion** entre dans une réunion Google Meet
(meet.google.com) quand quelqu'un l'y envoie : le son y est capté, puis transcrit sur la
machine ; rien ne part chez un service d'enregistrement. C'est un
choix explicite, jamais un défaut. La configuration d'OpenCode écrite par Helix
désactive d'ailleurs tous les fournisseurs distants (`opencode`, `anthropic`, `openai`,
`google`, `openrouter`) ainsi que la mise à jour automatique, pour qu'aucun repli
silencieux n'envoie le code du client ailleurs. Celle de l'instance OpenClaw des
employés fait de même : seuls les fournisseurs pointant sur la passerelle Helix
existent (`models.mode: replace`), les extensions des fournisseurs distants sont
désactivées, et la télémétrie, la vérification de mise à jour, le catalogue de modèles
distant et l'annonce sur le réseau local sont coupés.

## Comptes

Au premier lancement, l'utilisateur crée un compte (nom, email, mot de passe).
Les comptes vivent dans l'instance : **aucun service d'authentification n'est
contacté**. Le compte détermine à qui appartiennent le profil, la mémoire et les
sessions, ce qui permet à plusieurs collaborateurs de partager un poste ou une
instance sans mélanger leurs données.

Trois règles, appliquées par l'instance :

- **tout compte a un mot de passe**, de 10 caractères au moins, le premier compris
  (depuis 0.9.0). Un compte créé avant sans mot de passe choisit le sien à la
  connexion suivante ;
- le **premier** compte se crée sans être connecté : il faut bien amorcer
  l'instance ;
- **ensuite**, créer un compte exige d'être connecté. C'est un collègue déjà connu
  qui inscrit le suivant, comme dans un ERP. Sans cette règle, n'importe quel poste
  détenant le jeton pourrait s'inscrire à l'adresse d'un invité en attente et
  hériter de ses projets.

Chacun peut activer la **double authentification** dans Réglages, Sécurité : un
code à six chiffres affiché par une application du téléphone (Aegis, 2FAS, Mots de
passe d'Apple, Google Authenticator...), après le mot de passe. Aucun service tiers
n'intervient. Dix codes de secours sont remis à l'activation. L'intégrateur peut
l'imposer à tous (`deuxFacteursObligatoire`, profil de déploiement).

**Supprimer son compte** : Réglages, Profil, Zone de danger. L'écran montre d'abord
ce qui disparaît et ce qui est confié à un collègue (les projets partagés), puis
demande le mot de passe, et un code si la double authentification est active. Le
journal d'audit, scellé, est conservé. Pour une personne qui a quitté l'entreprise,
l'administrateur passe par l'outil de récupération (choix 3), application fermée.

**Mot de passe oublié, téléphone perdu.** Il n'y a pas de récupération par courriel :
l'instance n'envoie pas de courrier. L'administrateur du poste qui héberge l'instance
lance l'outil de récupération, embarqué dans l'application, avec Node 20 ou plus :

```bash
node "/Applications/Helix.app/Contents/Resources/dist-gateway/motdepasse.cjs"
```

(le nom `Helix` est celui de l'application livrée au client). Sans Node sur le poste,
celui que Helix pose fait l'affaire (`~/.helix/data/openclaw-moteur/node/bin/node`, ou
`node\node.exe` sous Windows ;
Réglages, Ligne de commande, « Mettre en place » le pose s'il manque). Jusqu'au
28/09/2026, l'outil tournait avec le binaire de l'application (`ELECTRON_RUN_AS_NODE=1`) :
ce n'est plus possible, le fusible RunAsNode étant fermé (SECURITE.md § 52). Essayé le
28/09/2026 avec le Node du système sur le `motdepasse.cjs` d'un paquet fabriqué. Il redéfinit un mot de
passe, retire la double authentification, ou supprime un compte ; chaque usage est
inscrit au journal.

Le mot de passe est dérivé par PBKDF2-SHA256 (210 000 itérations, sel par compte) et
n'est jamais stocké en clair ni transmis à un poste. La vérification a lieu sur
l'instance, et cinq échecs verrouillent le compte une minute, puis deux, puis quatre,
jusqu'à quinze minutes.

Les données de l'instance sont par ailleurs **chiffrées au repos**, dans les fichiers
JSON comme dans PostgreSQL, la clé étant rangée dans le trousseau macOS de la machine
de l'instance. Le détail, et ce
que cela ne protège pas, sont dans [`SECURITE.md`](../SECURITE.md).

## Postes et instance

Au tout premier lancement, chaque poste choisit son mode :

| Mode | Pour qui | Modèle |
|---|---|---|
| **Poste autonome** | une personne seule, ou le poste qui héberge l'instance | installé automatiquement sur la machine |
| **Rejoindre l'instance** | un collègue invité, sur son propre PC | **aucun** : l'inférence vient de l'instance |

C'est le fonctionnement d'un ERP : une instance centrale (le cluster ou un
serveur de l'entreprise), des postes qui s'y connectent. Le collègue clique le lien
de son invitation, ou saisit l'adresse et le code, et retrouve immédiatement les
projets et conversations auxquels il a été invité — **sans installer le moindre
modèle**.

### Données de l'instance

La passerelle héberge les collections partagées (comptes, projets,
conversations, tâches, agents). Deux stockages :

| Stockage | Quand | Configuration | Chiffrement au repos |
|---|---|---|---|
| **Fichiers JSON** (défaut) | poste isolé, petite équipe | aucune, `~/.helix/data` (ou `HELIX_DATA_DIR`) | oui, AES-256-GCM |
| **PostgreSQL** | usage concurrent réel | `"database"` dans `helix.config.json` | non, à confier au chiffrement du serveur |

```json
{ "database": "postgresql://helix:motdepasse@192.168.1.50:5432/helix" }
```

Le pilote `pg` n'est pas installé par défaut : `npm i pg` sur la machine qui héberge
l'instance.

Collections partagées : `accounts`, `projects`, `sessions`, `tasks`, `agents`,
`profiles`. Les séances d'authentification vivent dans le même magasin mais ne sont
**jamais** exposées par la synchronisation.

Chaque poste garde une copie locale dans son stockage de navigateur : **l'application
reste utilisable si l'instance est injoignable**, et se resynchronise au retour, en
comparant les révisions toutes les quatre secondes.

## Collaboration

On invite un collègue **par son adresse email**, sur un **projet** (page Projets →
badge des membres) ou sur une **conversation** (barre latérale → icône de partage
au survol).

- Si la personne a déjà un compte sur l'instance, l'accès est **immédiat**.
- Sinon l'invitation reste **en attente** et se dénoue toute seule à la création
  de son compte : elle retrouve alors ses projets et conversations partagés.

Le partage entre machines suppose une **instance partagée** : la passerelle du poste
qui l'héberge écoute sur le réseau, sert en TLS, et les autres postes la visent par
son adresse. Sur une installation isolée, « partagé » signifie « partagé entre les
comptes de cette machine ».

Deux façons de l'ouvrir : `"share": true` dans `helix.config.json`, réservé à
l'intégrateur d'une instance d'entreprise, ou l'interrupteur **Réglages → Profil →
« Ouvrir l'instance à mes collègues »**, qui demande le mot de passe et le rôle
d'administrateur. Dans les deux cas l'instance chiffre dès qu'elle écoute, et le
jeton reste exigé : ouvrir l'écoute n'ouvre pas l'accès.

### Inviter quelqu'un, et par où il vous rejoint

**Réglages → Profil → Inviter un collègue.** Une adresse email, un bouton. La
personne reçoit un lien : un clic ouvre son application avec l'adresse et le code
déjà remplis, et elle confirme. Le rattachement n'est jamais automatique, parce
qu'un lien `helix://` peut venir d'ailleurs que du mail attendu (`SECURITE.md` § 19).

L'écran range les adresses de la machine selon ce qu'elles permettent :

| Où est le collègue | Ce qu'il faut | État |
|---|---|---|
| Même réseau (même Wi-Fi, même câble) | rien, l'adresse suffit | fonctionne |
| Ailleurs, avec un VPN ou un réseau privé (Tailscale, WireGuard) | le tunnel monté des deux côtés ; Helix le détecte et affiche l'adresse | fonctionne |
| Ailleurs, sans lien privé | un lien privé entre les deux réseaux | l'écran le dit, et déconseille d'ouvrir un port sur la box |
| À toute heure | une machine qui ne s'éteint pas | instance dédiée |

Helix **détecte** le réseau privé que vous avez monté et s'en sert ; il n'en installe
pas. Un tunnel clés en main suppose un service de rendez-vous entre les machines,
donc un tiers au milieu d'une plateforme qui existe pour ne pas en avoir.

Une conversation, un dossier ou un document de la bibliothèque, une réunion se
partagent aussi à un **groupe** (page Groupes) : chaque membre y a accès, et le perd
s'il quitte le groupe.

Le cloisonnement est appliqué par l'instance, pas par l'interface : chacun ne reçoit
que ses projets, ses conversations, ses tâches et ses agents, plus ce qui lui est
explicitement partagé.

## Réunions

**Réunions → Enregistrer, Importer, ou Envoyer le bot.** Le micro du poste enregistre
(le son part par morceaux de dix secondes, chiffrés sur l'instance) ; un fichier audio
ou vidéo s'importe (2 Go) ; le **bot** (application de bureau) rejoint une réunion
Google Meet comme invité, sans micro ni caméra, sous le nom réglé dans Réglages, Bot
Recorder, et enregistre jusqu'à la fin. Un participant doit l'admettre, et c'est à
vous de prévenir les personnes présentes. Il peut aussi rejoindre seul les réunions
Google Meet de l'agenda.

La transcription se fait sur la machine de l'instance, par Whisper (le même moteur que
la dictée, installé sur demande) ; le compte rendu (résumé, décisions, actions à
verser dans Tâches) par un modèle de la machine. L'audio est effacé après la
transcription, sauf réglage contraire.

## Contrôle de l'écran

Cowork peut voir l'écran, déplacer la souris et saisir au clavier. **Désactivé
par défaut.** Sur un poste autonome, la personne l'active elle-même : bouton
« Écran » de Cowork, ou Réglages, Contrôle de l'écran, « Activer sur ce Mac », sous
mot de passe, approbation de chaque action toujours exigée. L'intégrateur peut aussi
le fixer dans `helix.config.json`, et son choix fait alors foi ; sur une instance
partagée, c'est la seule voie.

```json
{ "computerUse": { "mode": "sandbox", "image": "macos-sequoia", "requireApproval": true } }
```

| Mode | Ce que l'agent pilote | État |
|---|---|---|
| `desactive` | rien | défaut |
| `sandbox` | une machine virtuelle dédiée, via cua/Lume : le poste n'est jamais touché | livré |
| `hote` | la machine réelle | livré et vérifié sur macOS |

Le mode `sandbox` suppose une VM démarrée (`lume run`) et un serveur cua qui écoute sur
`http://127.0.0.1:8000` (`HELIX_CUA_URL`). Sans elle, chaque action renvoie une erreur
explicite.

En mode `hote` sur macOS, rien n'est à installer, mais **deux autorisations
système** sont à accorder à Helix, dans Réglages Système → Confidentialité et
sécurité :

1. **Enregistrement de l'écran** — pour voir. Relancer l'application ensuite.
2. **Accessibilité** — pour la souris et le clavier.

L'état se vérifie dans **Réglages → Contrôle de l'écran**, qui affiche ce qui
manque et propose un essai de capture. L'application lit l'autorisation
d'enregistrer l'écran sans la demander (`systemPreferences.getMediaAccessStatus`) :
macOS n'ouvre plus sa demande à chaque lancement (27/09/2026). Tant que Helix n'a
jamais tenté de capture, elle compte comme « pas encore demandée » (macOS répond
« refusé » avant toute demande), et macOS la demande à la première capture
(première action de l'agent, ou essai de capture). Passerelle lancée seule, sans
l'application : une capture d'essai, comme avant.

⚠ Le contrôle de l'écran a besoin d'un **modèle capable de lire une image**
(rôle `gui` ou `vision`). Un modèle de conversation ne voit rien : les outils
d'écran ne lui sont pas proposés. La page Réglages propose l'installation du
modèle adapté à la machine.

⚠ **Fiabilité.** Le meilleur modèle auto-hébergeable réussit moins d'une tâche
d'écran sur deux. À vendre comme une capacité assistée sous approbation, pas
comme une automatisation fiable. Chaque action modifiante demande un accord ;
`requireApproval: false` lève cette demande, à réserver aux démonstrations.

## Éditions

Le produit se livre en plusieurs éditions, pilotées par `edition` dans
`src/config/branding.ts` :

| Édition | Contenu |
|---|---|
| `chat` | Conversation seule (sans Cowork ni Code) |
| `complete` | Toutes les surfaces |

`featureOverrides` permet d'activer ou désactiver un module au cas par cas. Les entrées de
navigation **et** les routes suivent automatiquement.

Autres scripts :

```bash
npm run build             # vérifie l'interface ET la passerelle, puis construit
npm run preview           # sert le build de production
npm run typecheck         # vérification TypeScript, interface et passerelle
npm run typecheck:gateway # passerelle seule (tsconfig.gateway.json)
npm run motdepasse        # redéfinit le mot de passe d'un compte, depuis le poste
npm run securite          # la batterie de sécurité, contre une instance jetable
npm run essai:cli         # la ligne de commande (-- --modele : avec LM Studio)
npm run essai:vscode      # l'extension VS Code, avec un faux module vscode (-- --modele : avec LM Studio)
npm run essai:palmier     # le connecteur Palmier Pro, contre un faux Palmier Pro
```

## Rebrander pour un nouveau client

Tout point de personnalisation client est centralisé. **Aucune marque n'est codée en dur
dans les composants.**

1. **`src/config/branding.ts`** — nom produit, logos, URLs, version, pied de page, contacts.
   Changer ces valeurs suffit à rebrander toute l'application.
   ```ts
   name:    "Helix",                      // nom affiché partout
   logo:  { wordmark, mark, alt },        // visuels importés depuis src/assets/
   urls:  { instance, marketing, releases, dpoEmail, supportEmail },
   version: __HELIX_VERSION__,           // lue dans package.json, ne pas l'écrire
   ```
2. **`src/assets/`** — remplacer les visuels réellement consommés par `branding.ts` :
   - `helix-mark.png` : le mark seul (hélice), affiché au centre de l'accueil et dans la
     barre latérale. C'est le seul visuel affiché par défaut ;
   - `helix-logo.png` : logo complet avec texte, exposé sous `logo.wordmark` mais non
     utilisé par les composants livrés.
   Les marks sont des traces filaires noires sur fond blanc, affichées en
   `mix-blend-multiply` (le blanc disparaît sur les surfaces claires). Un nouveau client
   fournit ses propres visuels.

   **`public/brand/`** contient les visuels servis en fichiers statiques :
   `app-icon-256.png` est l'icône d'onglet référencée par `index.html`, `favicon.svg`
   est disponible mais n'est référencé nulle part. L'icône de l'application empaquetée
   est `build/icon.png`.
3. **`src/styles/tokens.css`** — la palette, la typographie, les rayons, les ombres et les
   espacements. Toutes les couleurs sont des tokens HSL consommés via Tailwind
   (`hsl(var(--token) / alpha)`). **Aucune valeur hexadécimale en dur hors de ce fichier.**

### Charte Helix (par défaut)

| Rôle | Token | Valeur |
|------|-------|--------|
| Primaire (texte, boutons) | `--primary` | `hsl(30 8% 9%)` sombre chaud |
| Fond | `--background` | `hsl(40 22% 97%)` crème |
| Accent (interactif, badges) | `--accent` | `hsl(162 70% 38%)` vert émeraude |
| Info (encarts) | `--info` | `hsl(221 83% 53%)` bleu |
| Police | Plus Jakarta Sans (SIL OFL 1.1) | 200–800 (`public/fonts/plus-jakarta-sans-*.woff2`) |

## Stack

| Couche | Choix |
|---|---|
| Interface | Vite · React 18 · TypeScript · Tailwind CSS · React Router 7 · icônes `lucide-react` |
| Enveloppe desktop | Electron 44.4.5 (Chromium 152, Node 24.21), empaquetage par `electron-builder` |
| Passerelle | Node 22+, HTTP/SSE écrits à la main, SDK MCP, `pg` optionnel |
| Inférence | LM Studio (`lms`) et/ou cluster exo, tout endpoint OpenAI-compatible |
| Agent de code | OpenCode en mode serveur, piloté par la passerelle |
| Persistance | Fichiers JSON chiffrés, ou PostgreSQL |

Aucune librairie de composants lourde côté interface.

## Structure

```
src/
  config/branding.ts        Personnalisation client (point unique)
  styles/tokens.css         Tokens de design (couleurs, typo, rayons…)
  components/
    layout/                 WindowChrome, Sidebar, MainArea, AppLayout, PageHeader
    ui/                     Button, IconButton, Chip, Popover, Modal, Select, Switch,
                            SegmentedTabs, Field, InfoBox, EmptyState, Avatar, Logo…
    chat/                   Composer, ModelPicker, ContextSelectors, MessageList,
                            ShareSessionModal, ScreenAccessChip…
    agents/                 Fiche d'un agent (employé OpenClaw), canaux, « Depuis Helix »
    cowork/                 Panneau Cowork, approbations d'écran, PreparerCowork
    onboarding/             Écran de mise en route (moteur, modèle, progression)
    settings/               Coquille des paramètres, séances et journal, apparence
  pages/                    Une page par écran, plus InstanceSetupPage et LoginPage
  hooks/                    useChat, useModels, useMcp, useComputer, useCode,
                            useTasks, useAgents, useProjects, useProfile,
                            useApparence…
  lib/
    store/                  Comptes, identité, sessions, projets, tâches, agents,
                            profils, apparence, et la synchronisation vers l'instance
    gateway.ts, endpoint.ts Appels à la passerelle, jetons, flux SSE
    taskRunner.ts           Exécution d'une tâche par un agent
    atelier.ts              Atelier bureautique de Cowork, côté interface
    soleil.ts               Lever et coucher du soleil, calculés hors ligne
  data/mock/                Ce qui reste fictif (libellés de comportement des modèles)
gateway/src/                Passerelle : routage par rôle, outils, écran, données,
                            comptes, séances, chiffrement, audit, TLS, plan
                            d'étapes, atelier bureautique, agents OpenClaw,
                            groupes, bibliothèque, réunions
cli/helix.mjs               Ligne de commande « helix » (textes dans cli/textes.mjs)
electron/main.cjs           Processus principal : lance la passerelle, CSP, TOFU TLS
electron/botReunion.cjs     Bot de réunion (fenêtre cachée), et son préchargement
electron/sourceGithub.cjs   Publications GitHub, source des mises à jour d'un poste installé seul
electron/nomTrousseau.cjs   macOS : clé du trousseau au nom de « Helix », reprise de l'ancienne
electron/pressePapiers.cjs  Copie dans le presse-papiers par le processus principal
```

Modules ajoutés les 27 et 28/09/2026, côté passerelle (`gateway/src/`) :

| Module | Rôle |
|---|---|
| `documentsJoints.ts` | Documents joints au Chat : balisés, mesurés contre la taille de conversation chargée, lus en entier ou en parties (24 au plus), gardés pour la question suivante |
| `historique.ts` | La conversation tient dans la place du modèle : Helix retire les plus anciens échanges, un tour entier à la fois, jamais la consigne ni la question, et le dit ; les étapes d'un travail découpé reçoivent les derniers échanges |
| `santeModeles.ts` | Essai de chaque modèle local sur ce poste (« Réponds seulement : bonjour ») et réponses coupées en cours d'usage ; un modèle qui répond mal n'est plus choisi d'office (`modeles-sur-cette-machine.json`) |
| `petitsModeles.ts` | Aide aux petits modèles (8,5 milliards ou moins) : appels d'outils réparés, syntaxe vérifiée après chaque écriture, lecture exigée avant de réécrire, consignes et outils réduits, agent `helix-petit` d'OpenCode |
| `codex.ts`, `codexGarde.ts` | Codex dans l'écran Code : détection, connexion, tâches et routes `/helix/codex*` ; qui y a droit, quel bac à sable, conversion du flux |
| `modelesCloud.ts` | Dialectes des fournisseurs cloud (listes, capacités, champs refusés, raisonnement, erreurs) |
| `notesModeles.ts` | Notes ECI d'Epoch AI (CC BY 4.0), recopiées telles quelles, avec leur attribution |
| `prixPublies.ts` | Prix publiés par les fournisseurs sur leurs pages de prix, avec la date du relevé |
| `nomsModeles.ts` | Correspondance prudente entre un identifiant de modèle et sa note ou son prix |

Modules ajoutés ou changés le 29/09/2026 (`gateway/src/`) :

| Module | Rôle |
|---|---|
| `palmier.ts` | Palmier Pro : reconnaissance de l'application à l'écoute (`lsof`, `codesign`), branchement de l'entrée `local` |
| `palmierRegles.ts` | Palmier Pro : lectures sans carte, écritures et générations sur carte, ce qui sort de la machine |
| `oauthNatif.ts`, `outilsNatifs.ts` | Seconde application LinkedIn (`linkedinPage`) et outils de page aiguillés vers ses jetons |
| `mcp.ts` | `adresseServeurPermise` : aucune adresse locale hors d'une entrée `local` du catalogue |
| `modelesCloud.ts` | `abreger` : refus d'un fournisseur abrégé pour l'écran, clé masquée comprise |

Côté interface : `src/components/code/MoteurCode.tsx`, `src/hooks/useCodex.ts`, `src/lib/codex.ts`
(choix du moteur de Code) ; `src/components/chat/PiecesJointesMessage.tsx` (cartes des pièces
jointes), `src/lib/decodage.ts` (UTF-8, UTF-16, Windows-1252) ; `src/lib/durees.ts` (durées des
réponses) ; `src/lib/pressePapiers.ts` ; `src/components/settings/SignalerProbleme.tsx` et
`src/lib/signalement.ts`. Essais sans réseau : `scripts/essai-notes-modeles.mjs`,
`scripts/essai-fournisseurs.mjs` (lancé par `npm run securite`), `scripts/essai-source-github.mjs`,
`scripts/faux-codex.mjs`, `scripts/doublure-mise-a-jour.cjs` ; `scripts/atelier-empreintes.mjs`
refait la liste figée des paquets de l'atelier et de la dictée.

L'inventaire écran par écran (correspondance avec les captures de référence) est dans
[`SCREENS.md`](../SCREENS.md).

## Vocabulaire produit

Interface française, accents corrects. Termes retenus : **Chat / Nouveau Chat**,
**Agent** (jamais « Assistant »), **Catalogue** (jamais « Officiel »), **Majordome** pour
l'agent d'orchestration par défaut. Aucun tiret cadratin dans les textes affichés.

## Ce qui fonctionne, et ce qui reste à faire

**Branché sur la passerelle et persistant :**

- Chat : streaming, canal de raisonnement, sélection du modèle, pièces jointes
  (documents et images lus sur le poste, envoyés avec la question, une carte par fichier
  dans le message ; depuis le 27/09/2026, mesurés contre la place du modèle et lus en
  parties au besoin, gardés pour la question suivante), historique des conversations,
  partage d'une conversation, durée de chaque réponse (réflexion, étapes, premier mot) ;
- Modèles locaux : un essai sur le poste à l'installation ou au premier chargement, et un
  modèle qui répond mal cède la place (27/09/2026) ; conversation raccourcie par Helix
  quand elle dépasse la place chargée ; aide aux petits modèles dans Cowork et Code ;
- Cowork : boucle d'outils fichiers avec découpage en étapes adapté au modèle,
  choix du dossier de travail, contrôle de l'écran avec approbations, préparation
  de l'atelier bureautique ;
- Code : sessions OpenCode, choix du dossier de projet, flux d'évènements ; pour
  une demande de site, un design professionnel fourni au modèle (palette,
  polices, feuille de style, guide) et les pages remises dessus en fin de tour ; le
  travail continue quand on quitte sa session (27/09/2026) ; **Codex** au choix, avec le
  compte ChatGPT du propriétaire du poste (27/09/2026) ;
- Images : « + » > « Créer une image » dans le Chat, sur la machine (Z-Image
  Turbo, FLUX.2 klein 4B, Qwen-Image selon la mémoire, licences Apache 2.0) ;
- Import : archives ChatGPT et Claude, export **Gemini** de Google Takeout, et sans
  export depuis Claude Code, Codex et Cursor installés sur le poste. Pour Gemini
  (28/09/2026) : sur takeout.google.com, cocher seulement « Mes activités », puis,
  dans « Toutes les données d'activité sont incluses », seulement « Applications
  Gemini » (le produit « Gemini » seul ne contient que les Gems) ; format JSON
  conseillé (« Plusieurs formats »), HTML lu aussi ; archive .zip. On dépose
  l'archive telle quelle, ou `MyActivity.json` / `MyActivity.html`. Google exporte
  un journal de questions (réponse et date), pas des conversations : Helix regroupe
  par le lien de conversation que Google range avec chaque question, sinon par
  proximité dans le temps (moins de 30 minutes), et l'écran dit lequel. Pas de
  titres (chaque Chat prend sa première question), ni images, ni fichiers joints
  (leur nom est noté), ni Gems. Toutes sources : un Chat déjà importé est signalé
  et n'est jamais réimporté ni écrasé ; s'il a grandi dans un export plus récent,
  on peut en ajouter une copie complète à côté. Code : `src/lib/importGemini.ts`,
  essai `node scripts/essai-import-gemini.mjs` ;
- Extension VS Code (`extensions/vscode/`, 0.2.6) : Chat, Helix Code sur le dossier
  ouvert, expliquer ou améliorer une sélection ; paquet `.vsix` joint à chaque version
  GitHub (voir « Extension VS Code » plus haut) ;
- **Bases de connaissances** (RAG, 25/09/2026) : dans Fichiers, onglet « Bases de
  connaissances », on rassemble des documents que l'instance indexe sur la machine
  (modèle d'embeddings de LM Studio, index chiffrés). Un Chat qui a des bases (celles
  de l'agent, du projet, ou cochées dans la pastille « Connaissances ») répond à partir
  des passages trouvés et cite ses sources sous la réponse ; chacun n'y lit que les
  documents qu'il voit dans Fichiers. Les employés OpenClaw les
  consultent aussi, dans ce qui est ouvert à toute l'équipe, et, pour un agent
  personnel dont rien ne sort vers d'autres, dans ce qui est partagé aux groupes de
  son propriétaire ;
- **Ligne de commande `helix`** (25/09/2026) : Chat et Helix Code dans un terminal,
  avec les outils et la barrière d'approbation de l'instance (voir « Ligne de
  commande » plus haut). Livrée avec l'application empaquetée depuis le 25/09/2026
  (macOS, et le `.deb` sous Linux ; pas sous Windows ni avec l'AppImage). Les
  connecteurs (serveurs MCP, courrier, Drive…) marchent aussi dans Helix Code depuis
  le 25/09/2026, derrière la même barrière ;
- **Entraîner un modèle** (Réglages, 25/09/2026) : apprendre à un petit modèle
  ouvert (Qwen3, Apache 2.0) les faits de son organisation à partir d'exemples, le
  comparer au modèle de départ, puis l'installer dans LM Studio : MLX-LM sur un Mac à
  puce Apple, Unsloth (QLoRA) sur une carte NVIDIA. Le modèle installé est visible de
  toute l'instance ;
- Projets, Agents, Tâches : création, persistance, partage, et exécution d'une tâche
  par un agent avec avancement du Kanban et trace des outils ; des cartes qui
  s'enchaînent (une carte attend les autres, part d'elle-même après elles et reçoit
  leurs comptes rendus). Un chat se range dans
  un projet (classement personnel, sans partage) ; les tâches ont une échéance et un
  projet, des vues Boîte de réception, Mes tâches, Aujourd'hui, À venir et par
  projet, un filtre (statut, priorité, agent) et un tri (échéance, priorité, mise à
  jour) ;
- Comptes, connexion, séances révocables, **double authentification**, journal
  d'audit consultable dans Réglages → Sécurité ;
- Réglages → **Confidentialité** : export RGPD de toutes ses données en JSON ;
- Réglages → **Connecteurs** : courrier en IMAP, agenda en CalDAV, Notion et
  serveurs MCP du catalogue ;
- la barrière d'approbation des actions de Cowork ;
- Réglages → **Mon usage** : jetons exacts lus dans la réponse de chaque
  moteur, par modèle et par jour, gratuit pour un modèle local ; pour un modèle distant,
  le tarif saisi, sinon (27/09/2026) le prix publié par son fournisseur, avec la date du
  relevé et le lien, et le coût dit « estimé ». Sans prix connu, « tarif non renseigné »,
  jamais compté à zéro ;
- « Comparer intelligence et prix » (sélecteur de modèles) : notes ECI d'Epoch AI
  (CC BY 4.0), prix publiés des éditeurs, tous les modèles de la personne au graphique ou
  listés « pas de note publiée » (27/09/2026) ;
- page **Modèles** (`/modeles`, 28/09/2026), par « Voir tous les modèles » dans « Installer
  un modèle » du sélecteur : tout le catalogue libre (Apache 2.0 et MIT, une soixantaine de
  modèles, `gateway/src/provision.ts`), recherche, tri, filtres ; seuls ceux qui tiennent sur la
  machine s'installent, les autres sont grisés avec la raison chiffrée. Les modèles ajoutés ce
  jour-là (`auChoix`) ne sont jamais installés d'office : le conseil pour la machine ne change
  pas ;
- Réglages → **Profil** : nom et adresse enregistrés ; changer d'adresse exige
  le mot de passe actuel et n'hérite d'aucune invitation ;
- Réglages → **Préférences** : apparence, et formats de date et d'heure
  appliqués partout où une date s'affiche ;
- **dictée** : bouton micro du composer, transcription par Whisper sur la
  machine, installée sur demande ;
- **suggestions de l'accueil** : chacune mène à un écran réel ou pose au Chat une
  question qu'il sait traiter ;
- Réglages → **Contrôle de l'écran** (activable depuis l'interface sur un poste
  autonome), Personnalisation de l'IA ;
- Réglages → **Connecteurs** : Google Drive et Slack en lecture seule ;
- Réglages → **Connecteurs** : la Page d'entreprise LinkedIn, par sa propre application
  (29/09/2026), et **Palmier Pro**, application ouverte sur le Mac de l'instance
  (29/09/2026), voir « Connecteurs » plus haut ;
- Réglages → Préférences, **À propos** : mise à jour de l'application depuis le
  serveur de l'agence, l'instance du poste rattaché ou les publications GitHub ;
  automatique une fois l'application signée par Apple, d'un clic sinon (macOS, et Windows
  depuis le 27/09/2026), signature de l'éditeur vérifiée ;
- Réglages → **Signaler un problème** (27/09/2026), aussi depuis l'aide : un ticket
  GitHub ou un mail préremplis, relus et envoyés par la personne, rien en arrière-plan ;
- **Agents** toujours actifs (OpenClaw) : missions à heure fixe ou à chaque mail
  reçu, messageries, documents de référence, installation et mise à jour depuis la
  page ; depuis le 27/09/2026, un modèle par employé, choisi à la création, changé dans
  ses Réglages et servi à chacun de ses appels ;
- **Groupes**, **Bibliothèque** (documents chiffrés, recherche dans le contenu),
  **Réunions** (micro, import, bot Google Meet, transcription et compte rendu sur la
  machine), Réglages → **Bot Recorder** ;
- Réglages → **Profil** : photo de profil ;
- la **cloche de notifications** et l'**aide intégrée** de la barre latérale (0.22.0) ;
- l'**archivage** des chats, à côté de leur suppression (0.22.0) ;
- le branchement d'un service **en un clic** : « Se connecter », autorisation dans
  votre navigateur, sans jeton à trouver ni tiers en travers (0.22.0) ;
- **« Rester connecté sur ce poste »** à la connexion, et un rôle d'administrateur
  pour la vue d'ensemble du journal d'activité (0.23.0) ;
- l'**invitation d'un collègue** par mail : il reçoit un code, rattache son poste,
  ouvre son compte et choisit son propre mot de passe (0.23.0) ;
- l'**ouverture de l'instance depuis l'écran** : un interrupteur sous mot de passe,
  dans Réglages → Profil, au lieu d'un fichier JSON à éditer (0.23.0) ;
- le **lien d'invitation** : le mail porte un lien qui ouvre l'application avec
  l'adresse et le code déjà remplis. Le lien reste collable dans le champ
  d'adresse, et le mail garde les deux lignes à saisir à la main (0.24.0) ;
- les **chemins d'accès nommés** : les adresses de la machine sont rangées entre
  « même réseau » et « réseau privé », ce dernier détecté quand un tunnel (VPN,
  Tailscale, WireGuard) est monté sur la machine (0.24.0) ;
- les **compétences** : des procédures écrites en français, une fois, que le modèle
  applique quand la situation s'y prête. Panneau Cowork → Procédures. Elles
  valent aussi dans le Chat et pour les tâches exécutées par un agent, se
  partagent à l'organisation, et l'écran dit combien de caractères partent
  réellement au modèle à chaque message (0.24.0) ;
- **Cowork sur tout le poste** : « Tout mon poste » ouvre le dossier personnel
  et les disques montés d'un coup, au lieu d'un dossier à choisir avant chaque
  demande. Les dossiers du système restent fermés, l'ouverture large redemande
  le mot de passe, et la barrière d'approbation continue de demander avant
  chaque modification (0.24.0). Depuis le 25/09/2026, même le poste entier
  exclut les données de l'instance, les clés et identifiants (`.ssh`, `.aws`,
  `.gnupg`…), les réglages des logiciels (`.config`), les historiques d'autres
  assistants (`.claude`, `.codex`, `.cursor`) et les trousseaux : ni l'agent ni
  l'équipe ne les lisent, et la fenêtre de confirmation le dit. « Fichiers de
  l'équipe » ne montre et ne rend plus aucun dossier caché ;
- **« Se connecter avec Google / Microsoft »** pour le courrier : une boîte
  Workspace ou M365 se branche sans mot de passe d'application ni serveur à
  saisir. Demande une préparation unique par l'administrateur de
  l'organisation ; un compte personnel garde le mot de passe d'application, et
  l'écran le dit (0.24.0) ;
- **sept langues** : français, anglais, chinois, japonais, et depuis le 30/09/2026
  espagnol, allemand et arabe. En arabe, l'écran se lit de droite à gauche : la barre
  latérale passe à droite, les flèches se retournent, et le code, les chemins, les
  adresses et les numéros de version restent de gauche à droite ; les chiffres restent
  occidentaux. Ce que vous écrivez et ce que le modèle répond s'alignent selon leur
  propre langue, quelle que soit celle de l'interface. La ligne de commande et
  l'extension VS Code sont en français. Le choix se fait dans
  Réglages, Préférences, vaut pour ce poste, et recharge la page pour que tout
  change d'un coup. 1 842 phrases en 0.25.0 ; le 25/09/2026, 2 301 dans
  l'interface et 650 dans la passerelle ; le 28/09/2026, 2 945 et 966, traduites à
  100 % dans les deux langues (`npm run i18n` le mesure). Ce que vous écrivez n'est
  jamais traduit (0.25.0) ;
- **Réglages → Abonnement** : l'offre d'hébergement des modèles en France, allumée
  dans la version du prestataire (`featureOverrides` de `src/config/branding.ts`),
  éteinte en marque blanche (0.24.0, grille refaite le 29/09/2026). La page dit que
  le logiciel est gratuit et que ce qui se paie est le calcul ; elle présente les
  modèles hébergés en Europe (polyvalent et rapide, choisis le 30/09/2026 d'après
  le marché du jour), qui consomment un même crédit mensuel chacun à son tarif, sur
  ce qu'il lit et sur ce qu'il écrit ; puis, sous un sélecteur Mensuel / Annuel, les
  formules Particuliers (Découverte, Plus, Pro, Max, prix TTC) et Entreprises
  (Équipe, Équipe Premium, HT par poste, deux postes au moins ; Entreprise sur
  devis), avec le prix de lancement (−30 % les six premiers mois, en mensuel), les
  jetons par modèle et leur équivalent en échanges par jour et en tâches par mois.
  Le crédit du mois vaut 60 % du net du prix normal (HT moins les frais de paiement
  estimés), rabais ou pas ; chiffres et calcul dans `src/config/offre.ts`, refaits
  par `npm run securite`. **Rien n'est encaissé** : les formules ne sont pas
  ouvertes, aucun paiement n'est branché, l'écran le dit, et ses boutons ouvrent un
  mail.

**Encore annoncé sans fonctionner, et marqué comme tel à l'écran :**

- l'application mobile (onglet Mobile d'Installer les apps). Le téléchargement direct de
  l'application de bureau, longtemps marqué « bientôt », fonctionne : l'instance sert son
  application macOS ; pour Windows et Linux, l'écran renvoie au paquet du prestataire ;
- **Composio** : écarté par défaut (voir `PROJET.md` § 3.5). Aucun code ne s'y
  connecte.

L'inventaire complet, écran par écran, est dans [`SCREENS.md`](../SCREENS.md).

## Accessibilité

Contraste suffisant, navigation clavier, focus visible, `aria-label` sur les boutons à
icône seule, `role` appropriés sur menus/dialogues. L'animation du logo respecte
`prefers-reduced-motion`.
