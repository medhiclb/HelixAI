# Composants tiers

HelixAI est publié sous AGPL-3.0 ([LICENSE](LICENSE), [COPYRIGHT.md](COPYRIGHT.md)). Ce fichier
recense ce qui, dans l'application et dans ce dépôt, vient d'autres auteurs, sous quelle licence,
et si cette licence permet de le redistribuer avec un logiciel sous AGPL-3.0. Il accompagne
l'application construite (copié dans ses ressources par electron-builder).

> **Ce n'est pas un avis juridique.** Ce relevé a été fait par l'équipe du projet, à partir des
> fichiers de licence des paquets et des pages des éditeurs, le 28/09/2026. La colonne
> « compatible » dit ce que nous en comprenons ; elle ne remplace pas l'avis d'un juriste, qu'il
> faut prendre avant de redistribuer HelixAI dans un cadre commercial ou contractuel.

## 1. Ce que l'application embarque

| Composant | Licence | Compatible avec l'AGPL-3.0 et la redistribution |
|---|---|---|
| Electron 44.4.5 | MIT | Oui, avec sa mention (reproduite plus bas). |
| Chromium, Node.js, V8 et les 779 composants recensés par Electron | surtout BSD-3-Clause ; aussi MIT, Apache-2.0, LGPL-2.1 (FFmpeg de Chromium), MPL-2.0, ICU, zlib… | Oui : licences permissives, ou LGPL pour des bibliothèques liées dynamiquement et non modifiées. La redistribution exige de fournir leurs mentions : c'est `LICENSES.chromium.html`, livré avec l'application (voir § 1.1). |
| Paquets npm fondus dans la passerelle et l'interface (§ 5) | MIT, ISC, BSD-3-Clause, Apache-2.0 | Oui : toutes permissives, compatibles avec l'AGPL-3.0 (Apache-2.0 l'est avec la version 3 des GPL). Leur texte est recopié au § 5, comme ces licences le demandent. |
| Paquets npm livrés dans `app.asar` (§ 5) | MIT, ISC, BSD-2/3-Clause, BlueOak-1.0.0, Python-2.0 | Oui. `argparse` porte la licence de Python (PSF), que la Free Software Foundation tient pour compatible avec la GPL depuis Python 2.0.1. Chaque paquet voyage avec son fichier de licence. |
| Police Plus Jakarta Sans (`public/fonts/plus-jakarta-sans-*.woff2`), The Plus Jakarta Sans Project Authors | SIL Open Font License 1.1 | Oui : l'OFL permet d'utiliser, de modifier et de redistribuer la police avec un logiciel, y compris sous AGPL, tant que la police n'est pas vendue seule. Texte dans `public/fonts/OFL-plus-jakarta-sans.txt`. Voir § 2. |
| Code repris d'autres projets : données de conception de ui-ux-pro-max (`gateway/design/`), découpeur de texte porté de LangChain.js, idées d'AnythingLLM (`gateway/rag/`) | MIT | Oui ; leurs mentions sont à côté du code (`LICENCE-*.txt`). |
| Notes des modèles (indice ECI d'Epoch AI) | CC BY 4.0 | Oui, avec l'attribution du § 3. La Free Software Foundation tient CC BY 4.0 pour compatible avec la GPL version 3. |
| Logos des services et des fournisseurs de modèles (`scripts/marques/`, `src/components/ui/marques.ts`) | marques de leurs sociétés, pas des licences libres | Sans objet : ils ne sont pas sous AGPL et ne sont montrés que pour désigner le service ou le modèle (compatibilité). Affichés sans accord préalable des sociétés, par décision de Medhi du 28/09/2026. Voir § 4 bis. |
| Prix des fournisseurs cloud (`gateway/src/prixPublies.ts`) | faits relevés sur les pages de prix de chaque fournisseur | Des tarifs publiés sont des faits ; ils sont recopiés tels quels, avec la page et la date du relevé. |

### 1.1 Electron et Chromium

Sous Windows et Linux, electron-builder pose `LICENSE.electron.txt` et `LICENSES.chromium.html`
à côté de l'exécutable. Sous macOS, il les efface du paquet (`electronMac.js` d'app-builder-lib
26.15.7) : l'application pour Mac, la seule publiée aujourd'hui, partait donc sans ces mentions.
Depuis le 28/09/2026, `package.json` (`mac.extraResources`) les recopie dans
`Helix.app/Contents/Resources/`. Pas encore vérifié dans un paquet construit.

Mention d'Electron (`node_modules/electron/dist/LICENSE`) :

```text
Copyright (c) Electron contributors
Copyright (c) 2013-2020 GitHub Inc.

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
"Software"), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
```

## 2. La police de l'interface : Plus Jakarta Sans

L'interface utilise Plus Jakarta Sans (police variable, graisses 200 à 800), Copyright 2020 The Plus
Jakarta Sans Project Authors (https://github.com/tokotype/PlusJakartaSans), sous SIL Open Font
License 1.1. Les fichiers `public/fonts/plus-jakarta-sans-latin.woff2` et
`plus-jakarta-sans-latin-ext.woff2` sont ceux du paquet `@fontsource-variable/plus-jakarta-sans`
5.3.0, sans modification ; le texte de la licence est à côté
(`public/fonts/OFL-plus-jakarta-sans.txt`).

**Historique** : jusqu'au 28/09/2026, l'interface utilisait Satoshi (Indian Type Foundry, ITF Free
Font License 2.0). Cette licence interdit de rendre la police disponible par un dépôt ou un serveur
public, et n'accorde rien à qui reçoit le logiciel (relevé à la seconde tournée, SECURITE.md § 39).
Medhi a choisi de la remplacer le 28/09/2026 ; le fichier `public/fonts/satoshi.woff2` est retiré du
dépôt à partir de la version 2026.928.1. Il reste dans l'historique git des versions précédentes :
le retirer de là demanderait de réécrire l'historique public.

## 3. Epoch AI : attribution des notes des modèles

Les notes affichées dans le sélecteur de modèles et dans « Comparer les modèles » sont l'indice ECI
(Epoch Capabilities Index) d'Epoch AI, recopié dans `gateway/src/notesModeles.ts`.

- **Auteur** : Epoch AI.
- **Titre** : « Capabilities & benchmarking ».
- **Source** : https://epoch.ai/benchmarks/use-this-data, fichier
  `epoch_capabilities_index/eci_scores.csv` de l'archive https://epoch.ai/data/benchmark_data.zip,
  relevé le 27/09/2026 (la page indiquait « Updated Sep. 27, 2026 »).
- **Licence** : Creative Commons Attribution 4.0 International,
  https://creativecommons.org/licenses/by/4.0/. Epoch AI demande de citer : « Epoch AI,
  'Capabilities & benchmarking'. Published online at epoch.ai. Retrieved from
  'https://epoch.ai/benchmarks/use-this-data' [online resource]. »
- **Modifications** : seuls les modèles sortis depuis le 01/01/2024 sont repris (217), avec leur
  note, leur éditeur et leur date de sortie tels que publiés ; les identifiants de mesure
  (`model_version`) sont repris sans la mention d'effort « _high », deux identifiants génériques
  (« deepseek-chat », « deepseek-reasoner ») sont écartés, et les noms sont rapprochés de ceux des
  modèles installés ou branchés. Aucune note n'est changée ni calculée.
- **Garantie** : Epoch AI ne garantit pas ces données (section 5 de la licence).

L'écran « Comparer les modèles » porte la même attribution (source, auteur, titre, lien, licence,
date du relevé, modifications).

## 4. Ce que Helix télécharge sur le poste, à la demande

Ces composants ne sont pas dans l'application ni dans ce dépôt : Helix les télécharge chez leur
éditeur, sur le poste de la personne, quand elle l'installe ou active la fonction. Helix ne les
redistribue pas ; la personne les reçoit de leur éditeur, sous sa licence. Ceux qui sortent de la
règle du projet « Apache 2.0 ou MIT » sont nommés ici ; la liste complète, avec versions et
empreintes, est dans `gateway/src/atelier-paquets.json`, `gateway/src/entrainement.ts`,
`gateway/src/connecteurs.ts` et PROJET.md § 3.9.

| Composant | Licence | Compatible avec l'AGPL-3.0 | Remarque |
|---|---|---|---|
| numpy, pandas, lxml, pypdf, reportlab… (atelier) | BSD | Oui | Permissives. |
| Pillow (atelier) | MIT-CMU | Oui | Permissive, de la famille HPND. |
| typing-extensions ; CPython 3.12.14 (`pythonPrive.ts`) | PSF-2.0 | Oui (FSF) | Python posé par Helix : accepté par Medhi le 27/09/2026. La construction autonome d'Astral est sous MPL-2.0. |
| certifi, tqdm (en partie) | MPL-2.0 | Oui | Copyleft par fichier : un fichier modifié resterait sous MPL-2.0 ; Helix n'en modifie aucun. |
| PyAV 15.1.0, 17.1.0, 18.1.0 (dictée) | BSD-3-Clause | Oui | Voir la ligne suivante pour ce que ses roues embarquent. |
| FFmpeg dans les roues de PyAV | LGPL-3.0-or-later (déclarée par la bibliothèque elle-même) | Oui | Relu le 28/09/2026 dans quatre roues (macOS 15.1.0 et 17.1.0, Linux x86_64 et Windows 18.1.0), empreintes conformes à la liste figée : `libavcodec` se déclare « LGPL version 3 or later », construite avec `--enable-version3`, sans `--enable-gpl`. |
| x264 et x265 dans les roues de PyAV | GPL-2.0-or-later | Oui, par la version 3 de la GPL (« or later ») et la section 13 de l'AGPL-3.0 | Les deux bibliothèques sont dans chacune des quatre roues, et FFmpeg y est lié (`--enable-libx264 --enable-libx265`). Les roues ne portent que la licence BSD de PyAV, ni celle de FFmpeg ni celles de x264 et x265 : c'est à PyAV de les fournir. H.264 et HEVC sont aussi couverts par des brevets dans certains pays ; la dictée n'utilise que le décodage de l'audio. |
| unsloth_zoo 2026.9.7 (entraînement NVIDIA) | LGPL-3.0-or-later | Oui | Accepté par Medhi le 25/09/2026 (PROJET.md § 3.12). |
| LibreOffice 25.8.6.2 (machines virtuelles) | MPL-2.0 | Oui | Installé dans la machine, pas sur le poste. |
| mammoth (atelier) | BSD-2-Clause | Oui | |
| jszip (atelier) | MIT ou GPL-3.0, au choix | Oui | Pris sous MIT. |
| llmster 0.0.25-1 (moteur de LM Studio) | conditions d'Element Labs, propriétaires | Sans objet : jamais redistribué | Acceptées par la personne à l'installation. |
| OpenCode 1.18.32, Node 24.22.1, OpenClaw 2026.10.7 | MIT (npm : Artistic-2.0) | Oui | |
| Microsoft Visual C++ Redistributable 14.51.36247.0, x64 et arm64 (`gateway/src/visualCpp.ts`, Windows) | Conditions de licence de Microsoft (logiciel fermé, gratuit ; https://visualstudio.microsoft.com/license-terms/) | Sans objet : jamais redistribué | Téléchargé par Helix chez Microsoft (download.visualstudio.microsoft.com, adresse versionnée, empreinte SHA-256 et signature Authenticode de Microsoft vérifiées), seulement quand les bibliothèques manquent sur le PC, puis installé par Windows avec l'autorisation d'administrateur de la personne ; ni l'application ni ce dépôt ne le contiennent. Accepté par Medhi le 29/09/2026 (PROJET.md § 3.9) ; SECURITE.md § 64. |
| RTK 0.50.0 (`gateway/src/rtk.ts`, Helix Code) | Apache-2.0 (© RTK AI Labs, github.com/rtk-ai/rtk) | Oui | Archive officielle de la publication, empreinte SHA-256 écrite dans le code, posée dans les données de Helix (macOS et Linux). Télémétrie coupée à chaque appel (`RTK_TELEMETRY_DISABLED=1`) ; SECURITE.md § 50. |
| llama.cpp b11146 = v0.5.0 (`gateway/src/llamaCpp.ts`, Mac Intel) | MIT (© The ggml authors, github.com/ggml-org/llama.cpp) | Oui | Archive officielle de la publication (`llama-b11146-bin-macos-x64.tar.gz`), empreinte SHA-256 écrite dans le code, posée dans les données de Helix ; son fichier LICENSE est posé avec elle. SECURITE.md § 54. |
| Qwen3 1.7B, 4B, 8B, 30B A3B en GGUF (Mac Intel) | Apache 2.0 (© Alibaba Cloud, dépôts `Qwen/Qwen3-*-GGUF`) | Oui | Fichiers publiés par Qwen, révision figée, empreinte SHA-256 écrite dans le code. |
| Serveurs d'outils lancés par `npx` | MIT ou Apache-2.0 (projet MCP : Apache-2.0 pour le nouveau code, MIT pour l'ancien) | Oui | `exa-mcp-server` ne déclare pas de licence dans son paquet ; son dépôt est sous MIT. |
| Modèles de conversation, d'images, de vidéo, de dictée et d'entraînement | Apache-2.0 ou MIT | Oui | Règle du projet ; relevé au § 32 de SECURITE.md. |

## 4 bis. Marques et logos

Les logos affichés devant les services (écran des connecteurs), en tête du panneau YouTube, devant
les fournisseurs de modèles (clés d'API) et les modèles (sélecteur, « Comparer les modèles »)
**appartiennent à leurs sociétés**. Ce
sont des marques, pas des composants sous licence libre : l'AGPL-3.0 de HelixAI ne s'applique pas à
eux, et les recevoir avec HelixAI ne donne aucun droit sur eux. Helix ne les montre que pour
**désigner le service ou le modèle** dont il est question, à côté de son nom, jamais comme sa propre
marque, et sans suggérer de partenariat, d'approbation ni de parrainage.

**Décision de Medhi (28/09/2026)** : « Les logos, on s'en fout : mets les vrais. Si j'ai un souci, ils
viendront me voir. » Depuis ce jour, **chaque service et chaque fournisseur de modèles affiché dans
Helix porte son vrai logo, en couleur**, y compris ceux dont la charte demande un accord préalable,
une licence écrite ou un autre usage que celui-ci (liste plus bas, avec ce que dit chaque charte).
Ces logos servent **à désigner la compatibilité** : dire quel service on branche ou quel modèle on
choisit. **La décision de les afficher sans l'accord préalable des sociétés est celle de Medhi**, qui
en assume le risque ; aucune de ces sociétés n'a donné son accord, et aucune case « j'accepte les
conditions » n'a été cochée pour relever leurs fichiers.

Chaque logo est le fichier officiel publié par la société sur son kit ou sa page de marque, **relevé
le 28/09/2026**, embarqué dans l'application (aucun appel réseau à l'affichage) et non modifié :
mêmes tracés, mêmes couleurs, la version pour fond sombre quand la société en livre une. Les
fichiers sont dans `scripts/marques/`, avec leur empreinte SHA-256 dans
`scripts/marques/sources.json` ; `scripts/gen-marques.cjs` les vérifie et les convertit en données
de dessin (`src/components/ui/marques.ts`). Les seules interventions : un cadrage de la zone
visible sur le dessin pour cinq fichiers livrés avec une grande marge (Figma, GitLab, Perplexity,
Atlassian, Facebook), et les cas notés dans la dernière colonne (X, Sentry, Mistral AI, YouTube,
Facebook, Instagram, et les icônes Google publiées seulement en PNG).

Seconde tournée du même jour (28/09/2026, demande de Medhi) : chaque charte relue, les empreintes
revérifiées (fichiers retéléchargés aux mêmes adresses quand elles répondent : identiques), et les
règles chiffrées appliquées à l'écran. Ce qui a changé :

- les icônes Google (Gmail, Agenda, Drive, Sheets, Slides, Maps, Gemini) passent à leur version
  redessinée de 2026, que la charte demande (« la plus récente ») et que la charte de l'API Drive
  désigne ; elles ne sont publiées qu'en PNG, intégré en données comme celui d'Instagram ;
- la taille minimale et la zone de protection, quand la charte les chiffre, sont dans
  `sources.json` (`tailleMin`, `marge`) et `LogoMarque` les applique : sous la taille minimale,
  l'icône neutre ; autour du logo, la marge qui manque à l'espace que l'écran laisse déjà ;
- le point d'état de la liste des connecteurs ne se pose plus sur le coin du logo (un élément
  ajouté dans la zone de protection, ce que GitHub, Canva, Facebook ou Atlassian interdisent) :
  il est devant le logo, à 12 px ;
- Tavily a désormais une page de marque : son logo remplace l'icône neutre ;
- Google Docs, Google Forms, Dropbox, Telegram, Trello, Todoist et ClickUp sont relevés pour des
  connecteurs à venir, sans être montrés par aucun écran tant que ces connecteurs n'existent pas.

Troisième tournée du même jour (28/09/2026, décision de Medhi ci-dessus) : les quarante-deux marques
qui gardaient une icône neutre, ou qui n'avaient pas de logo, ont le leur (Slack, OpenAI, LinkedIn,
TikTok, HubSpot, Intercom, Box, PayPal, Asana, Airtable, Square, monday.com, Mailchimp, Brevo, IONOS,
DeepSeek, Qwen, Calendly, Groq, Gemma, Scaleway, OVHcloud, Meta pour Llama, Outlook, OneDrive,
SharePoint, Excel, Word, Teams, Stripe, Shopify, WooCommerce, Salesforce, Pipedrive, Zendesk,
Discord, Zoom, WhatsApp, Mattermost, l'icône de YouTube, Z.ai pour GLM et MiniMax). Ordre des
sources suivi : le kit ou la page de marque en téléchargement direct (TikTok, Discord, Shopify,
YouTube), sinon le fichier servi par le site officiel, souvent l'icône du site (Slack, OpenAI,
LinkedIn, les icônes Microsoft 365 de 2026, Stripe, Meta, WhatsApp…), sinon le dépôt officiel
(MiniMax), sinon une reproduction fidèle et non modifiée sur Wikimedia Commons (Square seulement).
Interventions de cette tournée, dans la dernière colonne : conversion en SVG par `pdftocairo` de
deux fichiers .ai (TikTok, icône de YouTube), conversion en PNG par `sips` d'un .ico (Asana),
cadrage (OpenAI, icône de YouTube), et règles `@media (prefers-color-scheme)` ignorées (Scaleway,
Zendesk). Un logo sombre sans version pour fond sombre (Square, OVHcloud, PayPal) reçoit en thème
sombre une pastille claire derrière lui, pour rester lisible ; il n'est pas recoloré.

| Marque | Clé | Page de marque | Fichier officiel | Règle d'usage retenue |
|---|---|---|---|---|
| Gmail | `gmail` | https://partnermarketinghub.withgoogle.com/brands/google/use-cases/product-co-branding/ | https://www.gstatic.com/images/branding/productlogos/gmail_2026/v2/web-64dp/logo_gmail_2026_color_2x_web_64dp.png | Google autorise ses icônes de produit pour montrer une grille de produits compatibles ou une action dans une interface, sans modification, la marque de l'application restant la plus visible ; sa charte demande la version la plus récente des icônes, redessinées en 2026 (seconde tournée du 28/09/2026 : les icônes de 2020 sont remplacées). Point laissé à Medhi : la page https://partnermarketinghub.withgoogle.com/brands/google/branding-guidelines/how-to-show-googles-brand/ demande en plus, pour une icône de produit, une demande d'autorisation par le formulaire du Partner Marketing Hub (compte à créer). Publiée seulement en PNG (la version 2 n'existe pas en SVG) : fichier officiel de 128 pixels, non modifié. |
| Google Agenda | `googleAgenda` | https://partnermarketinghub.withgoogle.com/brands/google/use-cases/product-co-branding/ | https://www.gstatic.com/images/branding/productlogos/calendar_2026/v2/web-64dp/logo_calendar_2026_color_2x_web_64dp.png | Même règle que Gmail (icônes de produit Google, version de 2026). Publiée seulement en PNG (la version 2 n'existe pas en SVG) : fichier officiel de 128 pixels, non modifié. |
| Google Drive | `googleDrive` | https://partnermarketinghub.withgoogle.com/brands/google/use-cases/product-co-branding/ | https://www.gstatic.com/images/branding/productlogos/drive_2026/v2/web-64dp/logo_drive_2026_color_2x_web_64dp.png | Même règle que Gmail (icônes de produit Google, version de 2026). La charte de l'API Drive (https://developers.google.com/workspace/drive/api/guides/branding) permet aussi le logo de Drive dans une application, pour un bouton qui agit sur Drive ou pour signaler un fichier rangé dans Drive, sans approbation préalable, et c'est ce fichier-là qu'elle désigne. Publiée seulement en PNG (la version 2 n'existe pas en SVG) : fichier officiel de 128 pixels, non modifié. |
| Google Sheets | `googleSheets` | https://partnermarketinghub.withgoogle.com/brands/google/use-cases/product-co-branding/ | https://www.gstatic.com/images/branding/productlogos/sheets_2026/v2/web-64dp/logo_sheets_2026_color_2x_web_64dp.png | Même règle que Gmail (icônes de produit Google, version de 2026). Publiée seulement en PNG (la version 2 n'existe pas en SVG) : fichier officiel de 128 pixels, non modifié. |
| Google Slides | `googleSlides` | https://partnermarketinghub.withgoogle.com/brands/google/use-cases/product-co-branding/ | https://www.gstatic.com/images/branding/productlogos/slides_2026/v2/web-64dp/logo_slides_2026_color_2x_web_64dp.png | Même règle que Gmail (icônes de produit Google, version de 2026). Publiée seulement en PNG (la version 2 n'existe pas en SVG) : fichier officiel de 128 pixels, non modifié. |
| Google Docs | `googleDocs` | https://partnermarketinghub.withgoogle.com/brands/google/use-cases/product-co-branding/ | https://www.gstatic.com/images/branding/productlogos/docs_2026/v2/web-64dp/logo_docs_2026_color_2x_web_64dp.png | Même règle que Gmail (icônes de produit Google, version de 2026). Relevé pour un connecteur Google Docs à venir : aucun écran ne le montre encore. Publiée seulement en PNG (la version 2 n'existe pas en SVG) : fichier officiel de 128 pixels, non modifié. |
| Google Forms | `googleForms` | https://partnermarketinghub.withgoogle.com/brands/google/use-cases/product-co-branding/ | https://www.gstatic.com/images/branding/productlogos/forms_2026/v2/web-64dp/logo_forms_2026_color_2x_web_64dp.png | Même règle que Gmail (icônes de produit Google, version de 2026). Relevé pour un connecteur Google Forms à venir : aucun écran ne le montre encore. Publiée seulement en PNG (la version 2 n'existe pas en SVG) : fichier officiel de 128 pixels, non modifié. |
| Google Maps | `googleMaps` | https://partnermarketinghub.withgoogle.com/brands/google/use-cases/product-co-branding/ | https://www.gstatic.com/images/branding/productlogos/maps_2025/v1/web-64dp/logo_maps_2025_color_2x_web_64dp.png | Même règle que Gmail (icônes de produit Google) ; Maps n'a pas encore d'icône de 2026, celle de 2025 est la plus récente publiée. Publiée seulement en PNG (la version 2 n'existe pas en SVG) : fichier officiel de 128 pixels, non modifié. |
| Gemini | `gemini` | https://partnermarketinghub.withgoogle.com/brands/google/use-cases/product-co-branding/ | https://www.gstatic.com/images/branding/productlogos/gemini_2026/v1/web-64dp/logo_gemini_2026_color_2x_web_64dp.png | Même règle que Gmail (icônes de produit Google, version de 2026) ; sert aux modèles Gemini et au fournisseur « Google Gemini ». Publiée seulement en PNG (la version 2 n'existe pas en SVG) : fichier officiel de 128 pixels, non modifié. |
| GitHub | `github` | https://brand.github.com/foundations/logo | https://brand.github.com/GitHub_Logos.zip (GitHub_Invertocat_Black.svg, GitHub_Invertocat_White.svg) | Logo permis pour dire qu'un projet s'intègre à GitHub, sans suggérer de partenariat ; Invertocat en noir ou en blanc, sans modification. |
| Linear | `linear` | https://linear.app/brand | https://static.linear.app/design-assets/Linear-Brand-Assets.zip?v=3 (logo-dark.svg, logo-light.svg) | Logomark prévu pour les mises en page serrées et les grilles de logos ; fichiers non modifiés, sans suggérer d'approbation. |
| Figma | `figma` | https://www.figma.com/using-the-figma-brand/ | https://static.figma.com/uploads/4fbf4d754dbbc027ba1530205f8747cd97d532e5 (Figma Icon (Full-color).svg) | Usage permis pour signaler la compatibilité avec Figma ; la marque de l'application doit rester plus grande et plus visible. |
| Vercel | `vercel` | https://vercel.com/geist/brands | https://k2mkucxia43oc7fa.public.blob.vercel-storage.com/front/press/vercel-assets.zip (icon/light, icon/dark) | Symbole seul là où seuls les symboles de plusieurs marques sont affichés ; noir sur fond clair, blanc sur fond sombre ; aucune modification. |
| X | `x` | https://about.x.com/en/who-we-are/brand-toolkit | https://about.x.com/content/dam/about-twitter/x/brand-toolkit/x-logo.zip (logo.svg) | Logo noir sur fond clair, blanc sur fond sombre (guide https://about.x.com/content/dam/about-twitter/x/brand-toolkit/x-brand-guidelines.pdf). x.svg est le tracé de logo.svg (livré en blanc) rempli en noir, la couleur que le guide prescrit sur fond clair et que le kit fournit aussi en PNG. |
| Canva | `canva` | https://www.canva.dev/docs/connect/guidelines/brand/ | https://www.canva.dev/assets/connect/Canva-logos.zip (Canva Icon logo.svg) | Logo icône pour les surfaces de moins de 50 px, marge d'au moins 8 px, couleurs et forme non modifiées. Appliqué à l'écran : 8 px libres autour. |
| Atlassian | `atlassian` | https://www.atlassian.com/legal/trademark | https://atlassian.design/assets/06c6b5ff60de/logos/atlassian_logo.zip (Atlassian mark brand RGB.svg, Atlassian mark inverse RGB.svg) | Logos d'Atlassian permis pour signaler qu'un produit est compatible, reproduits exactement, sans modification autre que la taille ; sert au connecteur « Jira et Confluence ». |
| Notion | `notion` | https://www.notion.so/Media-Kit-205535b1d9c4440497a3d7a2ac096286 | https://www.notion.so/Media-Kit-205535b1d9c4440497a3d7a2ac096286 (NotionLogoFiles.zip, notion-logo-block-main.svg) | Kit presse officiel, sans règle d'usage écrite ; le cube blanc cerné de noir se lit sur les deux fonds, il sert aux deux thèmes. |
| Sentry | `sentry` | https://sentry.io/branding/ | https://sentry.io/branding/ (glyphe, couleurs « Dark » et « Light » de la page) | Glyphe proposé par la page officielle, avec l'option « inverser en mode sombre » ; couleur #181225 en clair, blanc en sombre. La page dessine le glyphe dans le navigateur au lieu de livrer un fichier : le tracé est recopié de son code source, dans les deux couleurs qu'elle propose. |
| GitLab | `gitlab` | https://about.gitlab.com/press/press-kit/ | https://about.gitlab.com/images/press/gitlab-logo-500-rgb.svg | Logomark en couleur ; ni recoloration, ni transformation, ni effet ; au moins 20 px en numérique (https://design.gitlab.com/brand-logo/core-logo). Appliqué à l'écran : jamais sous 20 px. |
| Webflow | `webflow` | https://brand.webflow.com/brand-assets | https://dhygzobemt712.cloudfront.net/Mark/Mark_Logo_Blue.svg | La marque W en bleu, telle que livrée ; la charte recommande de « mener avec le bleu » et interdit de la modifier. Le logo complet reste le premier choix quand la place le permet. |
| Wix | `wix` | https://www.wix.com/about/design-assets | https://www.wix.com/about/design-assets (WixLogoNew.zip : « Wix logoW.svg » noir, « Wix logoB.svg » blanc) | Logo à utiliser tel quel, sans modification ; le logo de Wix est son nom, il n'existe pas de symbole seul. |
| PostgreSQL | `postgresql` | https://www.postgresql.org/about/policies/trademarks/ | https://wiki.postgresql.org/images/a/a4/PostgreSQL_logo.3colors.svg | Usage loyal pour dire qu'un logiciel fonctionne avec PostgreSQL, sans suggérer d'affiliation ; mention d'attribution dans THIRD_PARTY_NOTICES.md. |
| Kubernetes | `kubernetes` | https://www.linuxfoundation.org/legal/trademark-usage | https://raw.githubusercontent.com/cncf/artwork/main/projects/kubernetes/icon/color/kubernetes-icon-color.svg | Logo officiel du projet (dépôt d'illustrations de la CNCF), sans variation de couleur ; formule « compatible avec ». |
| Brave | `brave` | https://brave.com/brave-branding-assets/ | https://brave.com/static-assets/images/brave-logo-sans-text.svg | Lion sans texte publié par Brave sur sa page de marque ; la page ne donne pas de règle d'usage écrite. |
| Firecrawl | `firecrawl` | https://www.firecrawl.dev/press-brand | https://www.firecrawl.dev/brand/brand-assets.zip (firecrawl-logo.svg) | La flamme sert quand un format carré ou réduit est nécessaire ; ne pas étirer, recolorer ni modifier. |
| Exa | `exa` | https://exa.ai/brand | https://exa.ai/assets/Exa%20Brand%20Assets.zip (Exa Logomark Blue.svg, Exa Logomark White.svg) | Logomark en bleu Exa en standard, en blanc sur fond sombre ; couleurs et proportions non modifiées. |
| Anthropic | `anthropic` | https://www.anthropic.com/news | https://www.anthropic.com/press-kit (Anthropic symbol - Slate.svg, Anthropic symbol - Ivory.svg) | Kit presse officiel, sans règle d'usage jointe ; symbole ardoise sur fond clair, ivoire sur fond sombre, sans modification. |
| Claude | `claude` | https://www.anthropic.com/news | https://www.anthropic.com/press-kit (Claude Spark - Clay.svg) | Même kit presse ; l'étincelle de Claude, couleur argile, désigne les modèles Claude. |
| Mistral AI | `mistral` | https://mistral.ai/brand/ | https://mistral.ai/brand/ (symbole M en dégradé de l'en-tête de la page) | Version en dégradé préférée ; ni recoloration, ni cadre, ni fond coloré. Le kit (cms.globalaegis.net) est derrière une vérification anti-robot que Helix ne contourne pas : le symbole est recopié de la page de marque elle-même, où Mistral l'affiche en SVG. |
| Perplexity | `perplexity` | https://live.standards.site/perplexity/logo | https://live.standards.site/perplexity/logo (Perplexity_AllLogos_Final.zip, perplexity-icon-dark.svg, perplexity-icon-light.svg) | Le symbole s'emploie seul là où le logo complet ne tient pas ; ne pas le remplir ni le tourner ; teinte claire sur fond sombre, sombre sur fond clair. |
| Grok | `grok` | https://x.ai/legal/brand-guidelines | https://data.x.ai/logos/SpaceXAI_Grok_Assets.zip (Grok_Logomark_Dark.svg, Grok_Logomark_Light.svg) | Logos exactement tels que fournis, seulement pour désigner SpaceXAI et ses services. |
| xAI | `xai` | https://x.ai/legal/brand-guidelines | https://data.x.ai/logos/SpaceXAI_Grok_Assets.zip (spacexai - symbol - black - transparent.svg, spacexai - symbol - white - transparent.svg) | Même charte que Grok ; symbole de SpaceXAI pour le fournisseur « xAI ». |
| OpenRouter | `openrouter` | https://openrouter.ai/brand | https://openrouter.ai/brand/logos/transparent/glyph/svg/glyph-grape.svg, https://openrouter.ai/brand/logos/transparent/glyph/svg/glyph-volt.svg | Glyphe pour les petites tailles ; Grape sur fond clair, Volt sur fond sombre ; ne pas étirer, recolorer ni remanier. |
| Kimi | `kimi` | https://moonshotai.github.io/Branding-Guide/ | https://moonshotai.github.io/Branding-Guide/scenarios/04-k-only/k-only-light.svg, https://moonshotai.github.io/Branding-Guide/scenarios/04-k-only/k-only-dark.svg | Le « K seul » de Moonshot AI, version fond clair et version fond sombre, telles que livrées. |
| Together AI | `together` | https://www.together.ai/brand | https://cdn.prod.website-files.com/69654e88dce9154b5f1206dd/69a6dad66e8b98c718262888_together-ai-logo-suite.zip (Color+Black/TogetherAI_Logo_021026_Logo.svg) | Logo en couleur ; le kit livre le même dessin pour fond clair et fond sombre. |
| YouTube | `youtube` | https://brand.youtube/youtube-logo/ | https://www.gstatic.com/marketing-cms/52/7d/637fef5a4788a97747e6feabc4aa/youtube-logo.zip (Digital/01 Full Color : yt_logo_fullcolor_almostblack_digital.ai, yt_logo_fullcolor_white_digital.ai) | Pour une fonction d'une application qui se sert de l'API de YouTube, c'est le logo complet que prévoit la charte des développeurs (https://developers.google.com/youtube/terms/branding-guidelines), l'icône seule étant réservée aux rangées de réseaux sociaux et aux contenus de sources mêlées. Hauteur du logo jamais sous 100 px en numérique ; zone de protection autour du logo égale au triangle de l'icône ; texte presque noir (#212121) sur fond clair, blanc sur fond sombre, triangle toujours blanc ; ni contour, ni ombre, ni recoloration, ni rotation, ni déformation ; un fond uni ; placé à côté de la fonction qui utilise YouTube, cliquable vers YouTube, jamais l'élément le plus en vue de la page. N'apparaît qu'en tête du panneau YouTube des connecteurs, à 100 px de haut ; la liste garde une icône neutre. Le kit ne livre pas de SVG (PNG, AI, EPS, PDF) : youtube.svg et youtube.sombre.svg sont la sortie, non retouchée, de `pdftocairo -svg` (Poppler 26.06.0) sur les deux fichiers .ai du kit, qui sont au format PDF (SHA-256 f0dd67577c524eadc64e6cfb1721fbaa87c115ab6b4ea5b3cc9bdb10a72d2e32 et 0afd024f677ab527c53f9aedf08705aaf6645568a646254980c7017fd4f39b75). Mêmes tracés et même plan de travail, marge du kit comprise ; les couleurs y sont notées en pourcentages (rgb(100%, 0%, 20%) pour #FF0033, 12,9 % pour #212121). |
| Facebook | `facebook` | https://about.meta.com/brand/resources/facebook/logo/ | Facebook Brand Asset Pack (Logo/Primary Logo/Facebook_Logo_Primary.ai), téléchargé par Medhi le 28/09/2026 sur https://about.meta.com/brand/resources/facebook/logo/ après acceptation des conditions de Meta | Logo principal, non modifié, pour désigner le connecteur Facebook ; au moins 16 px de large en numérique, et toujours à une demi-largeur de logo au moins de tout autre contenu (la zone de protection stricte est d'un quart). Converti du .ai en SVG (pdftocairo), tracé inchangé. facebook.svg est la conversion vectorielle exacte du fichier .ai officiel (pdftocairo -svg), sans changer le tracé ; « cadre » retire la marge du plan de travail. Appliqué à l'écran : jamais sous 16 px, zone libre de 0,5 fois la hauteur affichée. |
| Instagram | `instagram` | https://about.meta.com/brand/resources/instagram/ | IG brand asset pack 2023 (01 Static Glyph/01 Gradient Glyph/Instagram_Glyph_Gradient.png), téléchargé par Medhi le 28/09/2026 sur https://about.meta.com/brand/resources/instagram/ après acceptation des conditions de Meta | Glyphe en dégradé, non modifié, pour désigner le connecteur Instagram ; conditions de Meta acceptées par Medhi le 28/09/2026. Instagram ne publie le dégradé qu'en image (son SVG découpe un PNG) : instagram.png est le PNG officiel réduit de 2500 à 128 pixels (sips), sans autre changement. |
| Tavily | `tavily` | https://www.tavily.com/brand | https://www.tavily.com/logos/tavily-mark-black.svg, https://www.tavily.com/logos/tavily-mark-offwhite.svg | Page de marque publiée depuis le premier relevé : l'usage référentiel est permis pour désigner les produits de Tavily (déclaration de compatibilité), s'il est nécessaire, sans suggérer d'approbation et sans plus de place que nécessaire. Le « brand mark » est prévu pour les petites tailles ; noir sur fond clair, blanc cassé sur fond sombre ; zone libre au moins égale à sa hauteur ; ni recoloration, ni déformation, ni effet. Appliqué à l'écran : zone libre de 1 fois la hauteur affichée. |
| Dropbox | `dropbox` | https://docs.dropboxapi.com/dropbox-api/docs/developer-resources/branding-guide | https://www.dropbox.com/scl/fo/6qjduc7j5ujf09f75w1p7/AFc217w49gnfwVNr64Bd1_A?rlkey=tkqw8jcoi7f24voc6577vakky (Brand Partner Toolkit, lien de https://brand.dropbox.com/ : Logos/Dropbox/Glyph/Glyph_128.svg) | La charte des développeurs permet le nom et le logo de Dropbox dans une application, seulement pour désigner une intégration avec Dropbox ou y mener, sans modification, la marque de l'application restant la plus visible (https://www.dropbox.com/branding). Point laissé à Medhi : la page juridique demande aussi de consulter Dropbox avant un usage « dans un produit ». Le glyphe bleu, seul livré en SVG, sert aux deux thèmes. Relevé pour un connecteur à venir : aucun écran ne le montre encore. |
| Telegram | `telegram` | https://telegram.org/tour/screenshots | https://telegram.org/file/464001088/1/bI7AJLo7oX4.287931.zip/374fe3b0a59dc60005 (Logo.svg) | Telegram permet ses logos pour illustrer un article, un graphique, un bouton « transférer vers Telegram », etc., à condition qu'on ne passe pas pour son représentant officiel. Le logo rond en dégradé sert aux deux thèmes. Relevé pour un connecteur à venir : aucun écran ne le montre encore. |
| Trello | `trello` | https://www.atlassian.com/legal/trademark | https://atlassian.design/assets/06c6b5ff60de/logos/trello_app.zip (trello/svg/Trello_icon.svg) | Même charte qu'Atlassian : logos de produit permis pour signaler qu'un produit est compatible, reproduits exactement, sans autre modification que la taille ; le symbole reste dans sa tuile, sans conteneur ajouté (https://atlassian.design/foundations/logos). La tuile bleue sert aux deux thèmes. Relevé pour un connecteur à venir : aucun écran ne le montre encore. |
| Todoist | `todoist` | https://www.todoist.com/press | https://www.todoist.com/brand-assets/todoist-logo.zip (Icon/Color.svg, Icon/White.svg) | La page d'aide des intégrations (https://www.todoist.com/help/articles/market-your-todoist-integration-B6C5sCKkn) renvoie à la charte pour qui emploie le logo dans une intégration ; la charte (Todoist Brand Guidelines.pdf, 01/2021, dans le même kit) : symbole d'au moins 16 px de haut, zone libre de la moitié de sa hauteur, en couleur sur fond blanc ou beige, en blanc sur fond sombre, sans modification. Relevé pour un connecteur à venir : aucun écran ne le montre encore. Appliqué à l'écran : jamais sous 16 px, zone libre de 0,5 fois la hauteur affichée. |
| ClickUp | `clickup` | https://clickup.com/brand | https://clickup.com/assets/brand/v4/clickup-brand-assets.zip (Logos/ClickUp/Logomark-gradient.svg) | Page de marque officielle, sans règle écrite pour les tiers ; ni recoloration, ni contour, ni déformation, ni rotation, pas sur un fond coloré ; zone libre du symbole d'environ 17 % de sa largeur (schéma logo-clickup-icon-clearspace-full.svg de la page). Le symbole en dégradé sert aux deux thèmes. Relevé pour un connecteur à venir : aucun écran ne le montre encore. Appliqué à l'écran : zone libre de 0,18 fois la hauteur affichée. |
| Slack | `slack` | https://slack.com/media-kit | https://a.slack-edge.com/9cc0056/marketing/img/nav/logo.svg | Décision de Medhi du 28/09/2026 : le vrai logo, en couleur, sans attendre l'accord de la marque. Le dièse en quatre couleurs que slack.com sert dans l'en-tête de sa page presse (le kit, lui, demande d'accepter des conditions : non téléchargé). Le même dessin sert aux deux thèmes. |
| OpenAI | `openai` | https://openai.com/brand/ | https://images.ctfassets.net/kftzwdyauwt9/3hUGLn3ypllZ0oa01qOYVq/28e8188e6f11b84c3e876569d492734f/Blossom_Light.svg, https://images.ctfassets.net/kftzwdyauwt9/3M8rPrJsENQL5tjaDzo6SL/f0f85c8e27090123c767ac3c8237b401/Blossom_Dark.svg | Décision de Medhi du 28/09/2026 : le vrai logo, en couleur, sans attendre l'accord de la marque. La « Blossom » de la page de marque d'OpenAI, noire sur fond clair, blanche sur fond sombre. Sert au fournisseur OpenAI et aux modèles GPT. Les deux fichiers de la page montrent la Blossom deux fois (dont une sur une grille de construction) : « cadre » ne garde que la seconde, sans grille ni cadre ; le dessin n'est pas modifié. |
| LinkedIn | `linkedin` | https://brand.linkedin.com/in-logo | https://static.licdn.com/aero-v1/sc/h/akt4ae504epesldzj74dzred8 | Décision de Medhi du 28/09/2026 : le vrai logo, en couleur, sans attendre l'accord de la marque. Le [in] bleu que linkedin.com sert comme icône de site (SVG), le même dans les deux thèmes (le kit de marque demande d'accepter des conditions : non téléchargé). |
| TikTok | `tiktok` | https://developers.tiktok.com/doc/getting-started-design-guidelines | https://sf16-va.tiktokcdn.com/obj/eden-va2/uvzhqeh7nuhd/tt4d/logo-pack.zip (Dev Portal Logo Pack/TikTok Logo Pack/TikTok – Icons/TikTok_Icon_Black.ai, page 1) | Décision de Medhi du 28/09/2026 : le vrai logo, en couleur, sans attendre l'accord de la marque. L'icône de TikTok (note en couleur sur carré noir) du kit de la page développeurs, téléchargeable sans case à cocher ; lisible sur les deux fonds. Le kit ne livre l'icône en vecteur qu'en .ai (au format PDF, SHA-256 d76ffdb96ef96082c3e65a8cc0f2a386d338849d1670c6d388aa616ad1061e1a) : tiktok.svg est la sortie, non retouchée, de `pdftocairo -svg -f 1 -l 1` (Poppler 26.06.0), comme pour YouTube. |
| HubSpot | `hubspot` | https://www.hubspot.com/style-guide | https://www.hubspot.com/hs-fs/hubfs/HubSpot-sprocket-color-Aug-03-2022-04-23-39-02-PM.png | Décision de Medhi du 28/09/2026 : le vrai logo, en couleur, sans attendre l'accord de la marque. Le « sprocket » orange, en PNG, tel que hubspot.com le sert ; le même dans les deux thèmes. PNG officiel de 267 × 269 pixels, non modifié. |
| Intercom | `intercom` | https://www.intercom.com/help/en/ | https://intercom.help/intercom/assets/favicon | Décision de Medhi du 28/09/2026 : le vrai logo, en couleur, sans attendre l'accord de la marque. Icône du site officiel, telle que le site la sert (favicon), sans modification. Icône noire d'Intercom, cerclée de clair, lisible sur les deux fonds. PNG officiel de 172 × 170 pixels, non modifié (le centre d'aide d'Intercom le sert comme icône). |
| Box | `box` | https://www.box.com/ | https://www.box.com/apple-touch-icon.png | Décision de Medhi du 28/09/2026 : le vrai logo, en couleur, sans attendre l'accord de la marque. Icône du site officiel, telle que le site la sert (favicon), sans modification. Tuile bleue « box ». PNG officiel de 180 pixels, non modifié. |
| PayPal | `paypal` | https://www.paypal.com/ | https://www.paypalobjects.com/paypal-ui/logos/svg/paypal-mark-color.svg | Décision de Medhi du 28/09/2026 : le vrai logo, en couleur, sans attendre l'accord de la marque. Le monogramme « P » en couleur servi par PayPal (paypalobjects.com). Sur fond sombre, une pastille claire derrière lui : son bleu marine s'y perd. Appliqué à l'écran : pastille claire derrière le logo en thème sombre. |
| Asana | `asana` | https://asana.com/brand | https://asana.com/assets/img/brand/asana-logo-favicon.ico | Décision de Medhi du 28/09/2026 : le vrai logo, en couleur, sans attendre l'accord de la marque. Les trois points corail, icône de site d'asana.com (sa charte demande de ne pas employer le symbole seul : Medhi a décidé de ne pas s'en soucier). Asana ne sert son symbole seul qu'en .ico (les PNG de brand.asana.biz refusent les téléchargements hors navigateur) : asana.png est l'image de 100 pixels de ce fichier, convertie en PNG par `sips -s format png` (macOS), pixels inchangés. SHA-256 du .ico : a42ae227f92cc034bed8015af2bb5664327c3ef4c207e3dc6cd06e8642845e77. |
| Airtable | `airtable` | https://www.airtable.com/ | https://www.airtable.com/favicon.ico | Décision de Medhi du 28/09/2026 : le vrai logo, en couleur, sans attendre l'accord de la marque. Icône du site officiel, telle que le site la sert (favicon), sans modification. La boîte en trois couleurs. Servi sous le nom favicon.ico mais au format PNG (48 pixels) : fichier non modifié. C'est la plus grande version du symbole seul que le site serve. |
| Palmier Pro | `palmier` | https://www.palmier.io/ | https://www.palmier.io/icon.png | Ajouté le 29/09/2026 avec le connecteur Palmier Pro, sous la décision de Medhi du 28/09/2026 (le vrai logo, sans attendre l'accord de la marque). Palmier, Inc. ne publie ni kit ni charte de marque : c'est l'icône que son site sert (`link rel="icon"`), la même que celle de l'application. Servie en PNG de 1024 pixels : réduite à 128 pixels par `sips`, dessin et couleurs inchangés. Helix ne reprend aucun code de Palmier Pro (ni de la source publiée sous GPLv3, ni des versions propriétaires) et n'en distribue rien : il parle à l'application que la personne a installée elle-même. |
| Roblox Studio | `roblox` | https://www.roblox.com/ | https://images.rbxcdn.com/905bd722ee0a6ceda3caacde54c0b081.png | Ajouté le 12/10/2026 avec le connecteur Roblox Studio, sous la décision de Medhi du 28/09/2026 (le vrai logo, sans attendre l'accord de la marque). L'icône que roblox.com déclare pour son site (`apple-touch-icon`), PNG de 180 pixels réduit à 128 pixels par `sips`, dessin et couleurs inchangés. |
| Blender | `blender` | https://www.blender.org/about/logo/ | https://download.blender.org/branding/blender_logo_kit.zip (`square/blender_icon_128x128.png`) | Ajouté le 12/10/2026 avec le connecteur Blender, sous la décision de Medhi du 28/09/2026. Le logo du kit officiel de la Blender Foundation, qui permet de l'employer pour désigner le logiciel Blender ; PNG de 128 pixels, non modifié. |
| Square | `square` | https://squareup.com/us/en/press | https://upload.wikimedia.org/wikipedia/commons/3/30/Square%2C_Inc._-_Square_logo.svg (https://commons.wikimedia.org/wiki/File:Square,_Inc._-_Square_logo.svg) | Décision de Medhi du 28/09/2026 : le vrai logo, en couleur, sans attendre l'accord de la marque. Le carré noir de Square. Aucun fichier du symbole seul n'est servi par Square hors .ico de 32 pixels : reproduction fidèle, non modifiée, de Wikimedia Commons. Sur fond sombre, une pastille claire derrière lui. Appliqué à l'écran : pastille claire derrière le logo en thème sombre. |
| monday.com | `monday` | https://monday.com/p/news/press-kit/ | https://cdn.prod.website-files.com/656da6fea306219773d04208/65af6bd6e742d497b5f23f69_645898132bbaac20f1963919_256x256.png | Décision de Medhi du 28/09/2026 : le vrai logo, en couleur, sans attendre l'accord de la marque. Les trois capsules sur tuile blanche, icône de 256 pixels que monday.com déclare pour son site. PNG officiel de 256 pixels, non modifié. |
| Mailchimp | `mailchimp` | https://mailchimp.com/about/brand-assets/ | https://digitalasset.intuit.com/render/content/dam/intuit/mc-fe/en_us/images/mailchimp-favicons/apple-touch-icon.png | Décision de Medhi du 28/09/2026 : le vrai logo, en couleur, sans attendre l'accord de la marque. Icône du site officiel, telle que le site la sert (favicon), sans modification. Freddie sur fond jaune Cavendish. PNG officiel de 180 pixels, non modifié. |
| Brevo | `brevo` | https://www.brevo.com/press/ | https://corp-backend.brevo.com/wp-content/uploads/2025/07/Brevo_logo.svg | Décision de Medhi du 28/09/2026 : le vrai logo, en couleur, sans attendre l'accord de la marque. Le « B » vert dans son rond, que brevo.com déclare comme icône de site. |
| IONOS | `ionos` | https://www.ionos.com/newsroom/download/ | https://www.ionos.com/favicon-96x96.png | Décision de Medhi du 28/09/2026 : le vrai logo, en couleur, sans attendre l'accord de la marque. Icône du site officiel, telle que le site la sert (favicon), sans modification. Pas de symbole téléchargeable, seulement le nom : c'est l'icône du site qui sert. PNG officiel de 96 pixels, non modifié. |
| DeepSeek | `deepseek` | https://api-docs.deepseek.com/ | https://api-docs.deepseek.com/img/favicon.svg | Décision de Medhi du 28/09/2026 : le vrai logo, en couleur, sans attendre l'accord de la marque. La baleine bleue, icône du site de documentation de l'API de DeepSeek ; la même dans les deux thèmes. |
| Qwen | `qwen` | https://qwen.ai/ | https://img.alicdn.com/imgextra/i4/O1CN01OXv3EM1FN8t9W4P79_!!6000000000474-2-tps-80-80.png | Décision de Medhi du 28/09/2026 : le vrai logo, en couleur, sans attendre l'accord de la marque. Icône du site officiel, telle que le site la sert (favicon), sans modification. Le symbole violet de Qwen. PNG officiel de 80 pixels, non modifié (le plus grand que qwen.ai serve). |
| Calendly | `calendly` | https://calendly.com/ | https://calendly.com/media/favicon/icon.svg | Décision de Medhi du 28/09/2026 : le vrai logo, en couleur, sans attendre l'accord de la marque. Icône du site officiel, telle que le site la sert (favicon), sans modification. |
| Groq | `groq` | https://groq.com/ | https://groq.com/favicon.svg | Décision de Medhi du 28/09/2026 : le vrai logo, en couleur, sans attendre l'accord de la marque. Icône du site officiel, telle que le site la sert (favicon), sans modification. L'éclair blanc sur carré orange. |
| Gemma | `gemma` | https://deepmind.google/models/gemma/ | https://storage.googleapis.com/gdm-deepmind-com-prod-public/media/original_images/nav__dm__gemma__large.svg | Décision de Medhi du 28/09/2026 : le vrai logo, en couleur, sans attendre l'accord de la marque. L'étoile bleue de Gemma, telle que Google DeepMind la sert dans le menu de son site ; la même dans les deux thèmes. |
| Scaleway | `scaleway` | https://ultraviolet.scaleway.com/6dd9b5c45/p/6840d3-logo | https://www.scaleway.com/favicon/website/favicon.svg | Décision de Medhi du 28/09/2026 : le vrai logo, en couleur, sans attendre l'accord de la marque. Icône du site officiel, telle que le site la sert (favicon), sans modification. Le symbole lavande de Scaleway. Le fichier passe au blanc quand le système est en thème sombre (règle `@media (prefers-color-scheme: dark)`) ; Helix choisit son thème lui-même, cette règle est donc ignorée par le générateur et la couleur lavande sert aux deux thèmes. |
| OVHcloud | `ovhcloud` | https://www.ovhcloud.com/ | https://www.ovhcloud.com/icon.svg | Décision de Medhi du 28/09/2026 : le vrai logo, en couleur, sans attendre l'accord de la marque. Icône du site officiel, telle que le site la sert (favicon), sans modification. Sur fond sombre, une pastille claire derrière lui : son bleu nuit s'y perd. Appliqué à l'écran : pastille claire derrière le logo en thème sombre. |
| Meta | `meta` | https://www.meta.com/ | https://static.xx.fbcdn.net/rsrc.php/yf/r/-7pQO6hUGK_.svg | Décision de Medhi du 28/09/2026 : le vrai logo, en couleur, sans attendre l'accord de la marque. L'anneau de Meta en dégradé, icône de site de meta.com ; désigne les modèles Llama (Llama n'a pas de logo propre). |
| Outlook | `outlook` | https://www.microsoft.com/en-us/microsoft-365/outlook | https://www.microsoft.com/content/dam/microsoft/bade/images/icons/en-us/m365-app-icons-fy26/Outlook-Icon-FY26.svg | Décision de Medhi du 28/09/2026 : le vrai logo, en couleur, sans attendre l'accord de la marque. Icône d'application Microsoft 365 de 2026 (« FY26 »), servie par microsoft.com sur ses pages produit ; la même sert aux deux thèmes. |
| OneDrive | `onedrive` | https://www.microsoft.com/en-us/microsoft-365/onedrive | https://www.microsoft.com/content/dam/microsoft/bade/images/icons/en-us/m365-app-icons-fy26/OneDrive-Icon-FY26.svg | Décision de Medhi du 28/09/2026 : le vrai logo, en couleur, sans attendre l'accord de la marque. Icône d'application Microsoft 365 de 2026 (« FY26 »), servie par microsoft.com sur ses pages produit ; la même sert aux deux thèmes. |
| SharePoint | `sharepoint` | https://www.microsoft.com/en-us/microsoft-365/sharepoint | https://www.microsoft.com/content/dam/microsoft/bade/images/icons/en-us/m365-app-icons-fy26/SharePoint-Icon-FY26.svg | Décision de Medhi du 28/09/2026 : le vrai logo, en couleur, sans attendre l'accord de la marque. Icône d'application Microsoft 365 de 2026 (« FY26 »), servie par microsoft.com sur ses pages produit ; la même sert aux deux thèmes. |
| Excel | `excel` | https://www.microsoft.com/en-us/microsoft-365/excel | https://www.microsoft.com/content/dam/microsoft/bade/images/icons/en-us/m365-app-icons-fy26/Excel-Icon-FY26.svg | Décision de Medhi du 28/09/2026 : le vrai logo, en couleur, sans attendre l'accord de la marque. Icône d'application Microsoft 365 de 2026 (« FY26 »), servie par microsoft.com sur ses pages produit ; la même sert aux deux thèmes. |
| Word | `word` | https://www.microsoft.com/en-us/microsoft-365/word | https://www.microsoft.com/content/dam/microsoft/bade/images/icons/en-us/m365-app-icons-fy26/Word-Icon-FY26.svg | Décision de Medhi du 28/09/2026 : le vrai logo, en couleur, sans attendre l'accord de la marque. Icône d'application Microsoft 365 de 2026 (« FY26 »), servie par microsoft.com sur ses pages produit ; la même sert aux deux thèmes. |
| Microsoft Teams | `teams` | https://www.microsoft.com/en-us/microsoft-365/teams | https://www.microsoft.com/content/dam/microsoft/bade/images/icons/en-us/m365-app-icons-fy26/Teams-Icon-FY26.svg | Décision de Medhi du 28/09/2026 : le vrai logo, en couleur, sans attendre l'accord de la marque. Icône d'application Microsoft 365 de 2026 (« FY26 »), servie par microsoft.com sur ses pages produit ; la même sert aux deux thèmes. |
| Stripe | `stripe` | https://stripe.com/newsroom/brand-assets | https://images.stripeassets.com/fzn2n1nzq965/1hgcBNd12BfT9VLgbId7By/01d91920114b124fb4cf6d448f9f06eb/favicon.svg | Décision de Medhi du 28/09/2026 : le vrai logo, en couleur, sans attendre l'accord de la marque. L'icône de Stripe que stripe.com sert (le kit de la page de marque ne contient que le nom en toutes lettres). |
| Shopify | `shopify` | https://www.shopify.com/brand-assets | https://cdn.shopify.com/shopifycloud/brochure/assets/brand-assets/shopify-logo-shopping-bag-full-color-66166b2e55d67988b56b4bd28b63c271e2b9713358cb723070a92bde17ad7d63.svg | Décision de Medhi du 28/09/2026 : le vrai logo, en couleur, sans attendre l'accord de la marque. Le sac Shopify en couleur, téléchargé directement depuis la page de marque. |
| WooCommerce | `woocommerce` | https://woocommerce.com/trademark-guidelines/ | https://woocommerce.com/wp-content/uploads/2024/12/cropped-logo-w-favicon.png | Décision de Medhi du 28/09/2026 : le vrai logo, en couleur, sans attendre l'accord de la marque. Icône du site officiel, telle que le site la sert (favicon), sans modification. Le « W » blanc sur rond violet. PNG officiel de 512 pixels, non modifié. |
| Salesforce | `salesforce` | https://www.salesforce.com/ | https://wp.sfdcdigital.com/en-us/wp-content/uploads/sites/4/2024/11/logo-salesforce.svg | Décision de Medhi du 28/09/2026 : le vrai logo, en couleur, sans attendre l'accord de la marque. Le nuage bleu marqué « salesforce », servi dans l'en-tête de salesforce.com. C'est le logo complet (il n'existe pas de symbole seul) ; il reste reconnaissable à 22 px à sa forme et à sa couleur. |
| Pipedrive | `pipedrive` | https://www.pipedrive.com/en/newsroom/press-kit | https://cdn.dub-1.pipedriveassets.com/www-main-renderer/_next/static/media/apple-touch-icon-144x144.184934e8.png | Décision de Medhi du 28/09/2026 : le vrai logo, en couleur, sans attendre l'accord de la marque. Icône du site officiel, telle que le site la sert (favicon), sans modification. Le « p » blanc sur rond vert. PNG officiel de 144 pixels, non modifié. |
| Zendesk | `zendesk` | https://www.zendesk.com/ | https://d1eipm3vz40hy0.cloudfront.net/images/logos/favicons/zendesk-icon.svg | Décision de Medhi du 28/09/2026 : le vrai logo, en couleur, sans attendre l'accord de la marque. Icône du site officiel, telle que le site la sert (favicon), sans modification. Le symbole est dessiné « à la couleur du texte » (currentColor) : noir sur fond clair, blanc sur fond sombre, comme le prévoit le fichier. Le fichier passe au blanc quand le système est en thème sombre (règle `@media (prefers-color-scheme: dark)`) ; Helix choisit son thème lui-même, cette règle est ignorée par le générateur, et currentColor donne déjà le blanc en thème sombre. |
| Discord | `discord` | https://discord.com/branding | https://cdn.discordapp.com/assets/content/a736b95923ddbc155e828651c92471292e40727655d770a06cec89c48ba0b41f.zip (Discord_Symbol_Color/Discord-Symbol-Blurple.svg) | Décision de Medhi du 28/09/2026 : le vrai logo, en couleur, sans attendre l'accord de la marque. Le symbole « blurple », téléchargé directement depuis la page de marque (sans case à cocher) ; lisible sur les deux fonds. |
| Zoom | `zoom` | https://developers.zoom.us/ | https://developers.zoom.us/svgs/favicon.svg | Décision de Medhi du 28/09/2026 : le vrai logo, en couleur, sans attendre l'accord de la marque. Icône du site officiel, telle que le site la sert (favicon), sans modification. L'icône « zm » bleue de l'application (la page de marque, brand.zoom.com, ne livre ses fichiers que par une application en JavaScript, et le logo complet est le seul mot « zoom »). |
| WhatsApp | `whatsapp` | https://www.whatsapp.com/ | https://static.whatsapp.net/rsrc.php/y1/r/FJbTMJqMap7.svg | Décision de Medhi du 28/09/2026 : le vrai logo, en couleur, sans attendre l'accord de la marque. Icône du site officiel, telle que le site la sert (favicon), sans modification. La bulle verte (le kit de marque de Meta demande de cocher une case : non téléchargé). Sert à WhatsApp Business. |
| Mattermost | `mattermost` | https://mattermost.com/ | https://mattermost.com/favicon.svg | Décision de Medhi du 28/09/2026 : le vrai logo, en couleur, sans attendre l'accord de la marque. Icône du site officiel, telle que le site la sert (favicon), sans modification. La marque blanche sur disque bleu ; sert au canal Mattermost des employés. |
| YouTube | `youtubeIcone` | https://brand.youtube/youtube-icon/ | https://www.gstatic.com/marketing-cms/78/29/3e68a1414bb28d0b7e47b44c3c91/youtube-icon.zip (YouTube_Icon/Digital/01 Red/yt_icon_red_digital.ai) | Décision de Medhi du 28/09/2026 : le vrai logo, en couleur, sans attendre l'accord de la marque. L'icône rouge de YouTube, pour la ligne de la liste des connecteurs (la charte fixe 100 px au moins : Medhi a décidé de ne plus s'en soucier). Le logo complet reste en grand dans le panneau YouTube (clé « youtube »). Le kit ne livre pas de SVG : youtube-icone.svg est la sortie, non retouchée, de `pdftocairo -svg` (Poppler 26.06.0) sur le fichier .ai du kit, au format PDF (SHA-256 b5958b5f28b494b9e3e3962bdf5619c69c6733e409cc23845c6910af84d80c22) ; « cadre » retire la marge du plan de travail. |
| Z.ai (GLM) | `zai` | https://z.ai/ | https://z-cdn.chatglm.cn/z-ai/static/logo.svg | Décision de Medhi du 28/09/2026 : le vrai logo, en couleur, sans attendre l'accord de la marque. Icône du site officiel, telle que le site la sert (favicon), sans modification. Le « Z » de Z.ai (Zhipu), éditeur des modèles GLM. |
| MiniMax | `minimax` | https://github.com/MiniMax-AI/MiniMax-01 | https://raw.githubusercontent.com/MiniMax-AI/MiniMax-01/main/figures/minimax.svg | Décision de Medhi du 28/09/2026 : le vrai logo, en couleur, sans attendre l'accord de la marque. Le symbole en dégradé publié dans le dépôt officiel de MiniMax ; désigne les modèles MiniMax. |

PostgreSQL : Postgres, PostgreSQL and the Slonik Logo are trademarks or registered trademarks of the
PostgreSQL Community Association of Canada, and used with their permission. Le symbole ® que la
politique demande « là où c'est praticable » n'est pas posé à côté d'un logo de 16 à 22 px.

Kubernetes est une marque de The Linux Foundation. GitHub, Gmail, Google Drive, Google Agenda,
Google Sheets, Google Slides, Google Maps et Gemini sont des marques de leurs propriétaires
respectifs, comme toutes les marques citées dans ce tableau.

YouTube (décision de Medhi, 28/09/2026) : le logo ne paraît qu'en tête du panneau YouTube de
l'écran des connecteurs, à 100 px de haut (le logo lui-même, rouge et texte), avec autour la marge
que le kit livre, plus large que la zone de protection de la charte (68 pt au-dessus et au-dessous,
98 pt sur les côtés, pour un triangle de 59 × 51 pt, logo de 138 pt de haut). Il mène à
https://www.youtube.com/, dans le navigateur. La liste des connecteurs, où il ferait 22 px, montre
l'icône de YouTube (clé `youtubeIcone`, troisième tournée : la charte en demande 100 px au moins,
Medhi a décidé de ne plus s'en soucier) ; le type `CleMarquePetite` écarte le logo complet de
`LogoMarque`, et `LogoMarqueGrand` ne le
dessine jamais sous 100 px ni coupé : dans une fenêtre trop étroite pour qu'il tienne en entier
(595 × 200 px avec sa marge), il ne paraît pas. Point laissé au jugement de Medhi : la charte
demande aussi que le logo ne soit pas l'élément le plus en vue de la page ; à 100 px, une fois le
panneau YouTube déplié, c'est le dessin le plus grand et le plus visible de l'écran (vu le
28/09/2026).

**Ce que disent les chartes des logos affichés depuis la troisième tournée** (relevé du 28/09/2026,
avant la décision de Medhi). Ces marques gardaient une icône neutre pour ces raisons ; elles ont
désormais leur logo, **par décision de Medhi, qui passe outre ces règles et en assume le risque**.
La liste reste ici pour que chacun sache ce que la société demande, et ce qui serait à régler si
elle se manifeste. Les icônes Lucide qui imitaient certains logos restent retirées : une copie
approximative n'est pas le vrai logo.

- **slack** : https://slack.com/terms-of-service/slack-brand : une application peut dire qu'elle s'intègre à Slack, mais la charte interdit de « distribuer ou mettre à disposition » ses logos, ce que ferait un dépôt public ; le kit (https://slack.com/media-kit) ne se télécharge qu'en acceptant ces conditions. Relu le 28/09/2026.
- **openai** : https://openai.com/brand/ : pour un développeur de l'API, tout ce qui touche à l'application (nom, logo, description, captures d'écran) doit rester libre des marques d'OpenAI, logos compris ; tout autre usage passe par partnercomms@openai.com. Relu le 28/09/2026.
- **linkedin** : https://brand.linkedin.com/in-logo : un développeur ne peut employer le logo [in] que comme bouton « Share » ou widget « Follow » ; le kit se télécharge après acceptation des conditions de LinkedIn, ce qui ne changerait pas cette règle.
- **meta** : Modèles Llama : https://www.meta.com/brand/resources/meta/company-brand/ : tout usage du logo de Meta demande une approbation (« Brand Review ») et il est réservé aux partenariats sous accord, à la presse et à l'édition ; Llama n'a pas de page de marque propre (l'ancienne adresse n'existe plus). Le kit téléchargé par Medhi n'a pas été retrouvé sur le poste le 28/09/2026 ; il ne lèverait pas l'approbation demandée.
- **tiktok** : https://developers.tiktok.com/doc/getting-started-design-guidelines : pas de logo TikTok sans autorisation écrite préalable. Relu le 28/09/2026.
- **youtube** (icône, `youtubeIcone`) : https://brand.youtube/youtube-icon/ : hauteur minimale de 100 px en numérique, incompatible avec une ligne de liste de 22 px. L'icône y paraît pourtant depuis la troisième tournée ; le logo complet reste en grand dans le panneau YouTube.
- **hubspot** : https://www.hubspot.com/partners/app/branding-guidelines : le logo et le sprocket demandent une approbation préalable (formulaire, 7 à 10 jours) ; seuls les badges de partenaire se téléchargent sans elle.
- **intercom** : https://www.intercom.com/legal/trademark-usage : le logo désigné ne s'emploie que dans le cadre du programme développeur ou d'un accord écrit avec Intercom.
- **asana** : https://asana.com/brand : le symbole ne s'emploie jamais seul, et le logo complet est illisible à 22 px. Relu le 28/09/2026.
- **airtable** : https://www.airtable.com/company/trademark-guidelines : seuls deux assemblages icône et nom sont approuvés ; l'icône seule n'en fait pas partie. Relu le 28/09/2026.
- **box** : https://www.box.com/legal/trademark : sans accord écrit, un tiers ne peut utiliser aucun logo de Box, même pour décrire une intégration. Relu le 28/09/2026.
- **paypal** : https://newsroom.paypal-corp.com/media-resources : fichiers destinés à la presse ; un développeur doit demander l'accord de developer@paypal.com.
- **square** : https://developer.squareup.com/docs/brand-guidelines : seul un assemblage « Built with Square » en PNG est fourni aux développeurs, illisible à 22 px. Relu le 28/09/2026.
- **deepseek** : Aucune page de marque ; le seul fichier officiel (https://github.com/deepseek-ai/DeepSeek-V2/blob/main/figures/logo.svg) est l'assemblage baleine et nom, illisible à 22 px. Relu le 28/09/2026.
- **qwen** : Aucune page de marque ; le dépôt QwenLM ne publie qu'une image PNG de Qwen-Image. Relu le 28/09/2026.
- **gemma** : https://ai.google.dev/gemma/terms (§ 4.2) : les conditions de Gemma n'accordent aucun droit sur les logos de Google, et aucun fichier officiel du logo de Gemma n'est publié avec une règle d'usage. L'icône de Gemini, un autre produit, n'est pas prêtée à Gemma.
- **groq** : https://groq.com/brand-assets/ renvoie une page introuvable le 28/09/2026 ; aucune autre page de marque officielle.
- **scaleway** : https://ultraviolet.scaleway.com/6dd9b5c45/p/6840d3-logo : le logo complet s'emploie de préférence, le symbole seul en dernier recours, et jamais sous 32 px de haut en numérique ; les listes de Helix l'afficheraient entre 13 et 22 px.
- **ovhcloud** : https://www.ovhcloud.com/sites/default/files/external_files/trademark-usage-policy-en-30december-24.pdf : le logo d'OVHcloud ne s'emploie, sur un site ou dans un produit, qu'avec une licence écrite ; la compatibilité se dit avec le nom seul.
- **ionos** : https://www.ionos.com/newsroom/download/ : pas de symbole téléchargeable, seulement le nom. Relu le 28/09/2026.
- **outlook** : https://www.microsoft.com/en-us/legal/intellectualproperty/trademarks : les logos et icônes de produit de Microsoft ne s'emploient jamais sans licence expresse ; la compatibilité ne se dit qu'en texte. Les jeux d'icônes de Microsoft Learn sont réservés aux schémas d'architecture, à la formation et à la documentation.
- **onedrive** : Même règle que outlook (Microsoft).
- **sharepoint** : Même règle que outlook (Microsoft).
- **excel** : Même règle que outlook (Microsoft).
- **word** : Même règle que outlook (Microsoft).
- **teams** : Même règle que outlook (Microsoft).
- **whatsapp** : https://www.meta.com/brand/resources/whatsapp/whatsapp-brand/ : l'usage serait possible (logo non modifié, jamais l'élément le plus en vue, sans suggérer de partenariat), mais le kit ne se télécharge qu'en cochant « J'ai lu et j'accepte les règles applicables » : c'est à Medhi de l'accepter.
- **discord** : https://discord.com/branding : les marques de Discord ne servent qu'à dire qu'on utilise Discord ou qu'on y a un serveur ; tout autre usage demande la permission de Discord.
- **stripe** : https://stripe.com/marks/legal : les conditions couvrent un client de Stripe qui signale Stripe là où il s'en sert (page de paiement) ; tout autre usage passe par trademarks@stripe.com.
- **shopify** : https://www.shopify.com/brand-assets : tout usage des éléments de marque de Shopify doit être autorisé par écrit.
- **woocommerce** : https://woocommerce.com/trademark-guidelines/ : les logos WooCommerce et Woo ne peuvent servir à aucun usage ; la compatibilité se dit en texte.
- **salesforce** : https://www.salesforce.com/company/legal/tmcusageguidelines/ : un produit compatible ne peut montrer le logo d'un produit Salesforce que dans un schéma ou un diagramme qui explique comment il fonctionne avec lui.
- **pipedrive** : https://www.pipedrive.com/en/newsroom/press-kit : les fichiers du logo ne sont remis que sur demande.
- **zendesk** : https://www.zendesk.com/company/trademark-property/trademarks/ : aucune marque de Zendesk sans accord écrit qui contienne une licence ; sa page de fichiers de marque ne répond plus (28/09/2026).
- **monday** : https://monday.com/p/news/press-kit/ : le logo s'emploie avec le texte « monday.com » complet, jamais les capsules seules ; l'ensemble est illisible à 22 px.
- **calendly** : Aucune page de marque ni kit officiel trouvé (calendly.com/press, /brand, /newsroom, le 28/09/2026) ; l'icône du site sert.
- **zoom** : https://www.zoom.com/en/trust/legal/zoom-api-license-and-tou/ : la licence de marque ne vaut que pour les applications bâties sur le SDK de Zoom ; tout autre usage demande l'accord écrit préalable de Zoom.
- **brevo** : https://www.brevo.com/press/ : seul le nom en toutes lettres est publié, sans symbole ni règle d'usage ; à 22 px de large, il ferait 6 px de haut.
- **mailchimp** : https://mailchimp.com/about/brand-assets/ : Freddie va toujours avec le nom, le kit ne livre que cet assemblage (illisible à 22 px), et l'associer à un autre graphisme demande l'accord écrit de Mailchimp.

Refaire le relevé : retélécharger chaque fichier à l'adresse de la colonne « Fichier officiel »,
relire la page de marque, puis `node scripts/gen-marques.cjs --noter` et vérifier à l'écran.

## 5. Paquets npm

<!-- début de la partie générée par scripts/notices-tiers.mjs : ne pas modifier à la main -->

### Passerelle (`dist-gateway/index.cjs`, `dist-gateway/motdepasse.cjs`)

34 paquets, fondus par esbuild dans la passerelle.

#### @hono/node-server 2.1.8 (MIT)

`LICENSE` :

```text
MIT License

Copyright (c) 2022 - present, Yusuke Wada and Hono contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

#### @modelcontextprotocol/sdk 1.32.2 (MIT)

`LICENSE` :

```text
MIT License

Copyright (c) 2024 Anthropic, PBC

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

#### ajv 8.20.0 (MIT)

`LICENSE` :

```text
The MIT License (MIT)

Copyright (c) 2015-2021 Evgeny Poberezkin

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

#### ajv-formats 3.0.1 (MIT)

`LICENSE` :

```text
MIT License

Copyright (c) 2020 Evgeny Poberezkin

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

#### content-type 1.0.5 (MIT)

`LICENSE` :

```text
(The MIT License)

Copyright (c) 2015 Douglas Christopher Wilson

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
'Software'), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
```

#### cross-spawn 7.0.6 (MIT)

`LICENSE` :

```text
The MIT License (MIT)

Copyright (c) 2018 Made With MOXY Lda <hello@moxy.studio>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
```

#### eventsource 3.0.7 (MIT)

`LICENSE` :

```text
The MIT License

Copyright (c) EventSource GitHub organisation

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
"Software"), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
```

#### eventsource-parser 3.1.1 (MIT)

`LICENSE` :

```text
MIT License

Copyright (c) 2026 Espen Hovlandsdal <espen@hovlandsdal.com>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

#### fast-deep-equal 3.1.3 (MIT)

`LICENSE` :

```text
MIT License

Copyright (c) 2017 Evgeny Poberezkin

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

#### fast-uri 3.1.9 (BSD-3-Clause)

`LICENSE` :

```text
Copyright (c) 2011-2021, Gary Court until https://github.com/garycourt/uri-js/commit/a1acf730b4bba3f1097c9f52e7d9d3aba8cdcaae
Copyright (c) 2021-present The Fastify team <https://github.com/fastify/fastify#team>
All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:
    * Redistributions of source code must retain the above copyright
      notice, this list of conditions and the following disclaimer.
    * Redistributions in binary form must reproduce the above copyright
      notice, this list of conditions and the following disclaimer in the
      documentation and/or other materials provided with the distribution.
    * The names of any contributors may not be used to endorse or promote
      products derived from this software without specific prior written
      permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDERS AND CONTRIBUTORS BE LIABLE FOR ANY
DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
(INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

                                  *   *   *

The complete list of contributors can be found at:
- https://github.com/garycourt/uri-js/graphs/contributors
```

#### hono 4.13.18 (MIT)

`LICENSE` :

```text
MIT License

Copyright (c) 2021 - present, Yusuke Wada and Hono contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

#### isexe 2.0.0 (ISC)

`LICENSE` :

```text
The ISC License

Copyright (c) Isaac Z. Schlueter and Contributors

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR
IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
```

#### json-schema-traverse 1.0.0 (MIT)

`LICENSE` :

```text
MIT License

Copyright (c) 2017 Evgeny Poberezkin

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

#### path-key 3.1.1 (MIT)

`license` :

```text
MIT License

Copyright (c) Sindre Sorhus <sindresorhus@gmail.com> (sindresorhus.com)

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
```

#### pg 8.23.1 (MIT)

`LICENSE` :

```text
MIT License

Copyright (c) 2010 - 2021 Brian Carlson

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

#### pg-cloudflare 1.4.1 (MIT)

`LICENSE` :

```text
MIT License

Copyright (c) 2010 - 2021 Brian Carlson

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

#### pg-connection-string 2.14.1 (MIT)

`LICENSE` :

```text
The MIT License (MIT)

Copyright (c) 2014 Iced Development

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

#### pg-int8 1.0.1 (ISC)

`LICENSE` :

```text
Copyright © 2017, Charmander <~@charmander.me>

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED “AS IS” AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND
FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.
```

#### pg-pool 3.14.0 (MIT)

`LICENSE` :

```text
MIT License

Copyright (c) 2017 Brian M. Carlson

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

#### pg-protocol 1.16.1 (MIT)

`LICENSE` :

```text
MIT License

Copyright (c) 2010 - 2021 Brian Carlson

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

#### pg-types 2.2.0 (MIT)

Le paquet ne contient pas de fichier de licence ; licence déclarée dans son `package.json` : MIT.

#### pgpass 1.0.5 (MIT)

Le paquet ne contient pas de fichier de licence ; licence déclarée dans son `package.json` : MIT.

#### pkce-challenge 5.0.1 (MIT)

`LICENSE` :

```text
MIT License

Copyright (c) 2019 

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

#### postgres-array 2.0.0 (MIT)

`license` :

```text
The MIT License (MIT)

Copyright (c) Ben Drucker <bvdrucker@gmail.com> (bendrucker.me)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
```

#### postgres-bytea 1.0.1 (MIT)

`license` :

```text
The MIT License (MIT)

Copyright (c) Ben Drucker <bvdrucker@gmail.com> (bendrucker.me)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
```

#### postgres-date 1.0.7 (MIT)

`license` :

```text
The MIT License (MIT)

Copyright (c) Ben Drucker <bvdrucker@gmail.com> (bendrucker.me)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
```

#### postgres-interval 1.2.0 (MIT)

`license` :

```text
The MIT License (MIT)

Copyright (c) Ben Drucker <bvdrucker@gmail.com> (bendrucker.me)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
```

#### shebang-command 2.0.0 (MIT)

`license` :

```text
MIT License

Copyright (c) Kevin Mårtensson <kevinmartensson@gmail.com> (github.com/kevva)

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
```

#### shebang-regex 3.0.0 (MIT)

`license` :

```text
MIT License

Copyright (c) Sindre Sorhus <sindresorhus@gmail.com> (sindresorhus.com)

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
```

#### split2 4.2.0 (ISC)

`LICENSE` :

```text
Copyright (c) 2014-2018, Matteo Collina <hello@matteocollina.com>

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR
IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
```

#### which 2.0.2 (ISC)

`LICENSE` :

```text
The ISC License

Copyright (c) Isaac Z. Schlueter and Contributors

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR
IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
```

#### xtend 4.0.2 (MIT)

`LICENSE` :

```text
The MIT License (MIT)
Copyright (c) 2012-2014 Raynos.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
```

#### zod 4.6.7 (MIT)

`LICENSE` :

```text
MIT License

Copyright (c) 2025 Colin McDonnell

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

#### zod-to-json-schema 3.25.2 (ISC)

`LICENSE` :

```text
ISC License

Copyright (c) 2020, Stefan Terdell

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
```

### Interface construite (`dist/`)

9 paquets, fondus par Vite dans l'interface.

#### cookie 1.1.1 (MIT)

`LICENSE` :

```text
(The MIT License)

Copyright (c) 2012-2014 Roman Shtylman <shtylman@gmail.com>
Copyright (c) 2015 Douglas Christopher Wilson <doug@somethingdoug.com>

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
'Software'), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
```

#### lucide-react 0.469.0 (ISC)

`LICENSE` :

```text
ISC License

Copyright (c) for portions of Lucide are held by Cole Bemis 2013-2022 as part of Feather (MIT). All other copyright (c) for Lucide are held by Lucide Contributors 2022.

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
```

#### pdfjs-dist 6.4.299 (Apache-2.0)

`LICENSE` :

```text
Apache License
                           Version 2.0, January 2004
                        http://www.apache.org/licenses/

   TERMS AND CONDITIONS FOR USE, REPRODUCTION, AND DISTRIBUTION

   1. Definitions.

      "License" shall mean the terms and conditions for use, reproduction,
      and distribution as defined by Sections 1 through 9 of this document.

      "Licensor" shall mean the copyright owner or entity authorized by
      the copyright owner that is granting the License.

      "Legal Entity" shall mean the union of the acting entity and all
      other entities that control, are controlled by, or are under common
      control with that entity. For the purposes of this definition,
      "control" means (i) the power, direct or indirect, to cause the
      direction or management of such entity, whether by contract or
      otherwise, or (ii) ownership of fifty percent (50%) or more of the
      outstanding shares, or (iii) beneficial ownership of such entity.

      "You" (or "Your") shall mean an individual or Legal Entity
      exercising permissions granted by this License.

      "Source" form shall mean the preferred form for making modifications,
      including but not limited to software source code, documentation
      source, and configuration files.

      "Object" form shall mean any form resulting from mechanical
      transformation or translation of a Source form, including but
      not limited to compiled object code, generated documentation,
      and conversions to other media types.

      "Work" shall mean the work of authorship, whether in Source or
      Object form, made available under the License, as indicated by a
      copyright notice that is included in or attached to the work
      (an example is provided in the Appendix below).

      "Derivative Works" shall mean any work, whether in Source or Object
      form, that is based on (or derived from) the Work and for which the
      editorial revisions, annotations, elaborations, or other modifications
      represent, as a whole, an original work of authorship. For the purposes
      of this License, Derivative Works shall not include works that remain
      separable from, or merely link (or bind by name) to the interfaces of,
      the Work and Derivative Works thereof.

      "Contribution" shall mean any work of authorship, including
      the original version of the Work and any modifications or additions
      to that Work or Derivative Works thereof, that is intentionally
      submitted to Licensor for inclusion in the Work by the copyright owner
      or by an individual or Legal Entity authorized to submit on behalf of
      the copyright owner. For the purposes of this definition, "submitted"
      means any form of electronic, verbal, or written communication sent
      to the Licensor or its representatives, including but not limited to
      communication on electronic mailing lists, source code control systems,
      and issue tracking systems that are managed by, or on behalf of, the
      Licensor for the purpose of discussing and improving the Work, but
      excluding communication that is conspicuously marked or otherwise
      designated in writing by the copyright owner as "Not a Contribution."

      "Contributor" shall mean Licensor and any individual or Legal Entity
      on behalf of whom a Contribution has been received by Licensor and
      subsequently incorporated within the Work.

   2. Grant of Copyright License. Subject to the terms and conditions of
      this License, each Contributor hereby grants to You a perpetual,
      worldwide, non-exclusive, no-charge, royalty-free, irrevocable
      copyright license to reproduce, prepare Derivative Works of,
      publicly display, publicly perform, sublicense, and distribute the
      Work and such Derivative Works in Source or Object form.

   3. Grant of Patent License. Subject to the terms and conditions of
      this License, each Contributor hereby grants to You a perpetual,
      worldwide, non-exclusive, no-charge, royalty-free, irrevocable
      (except as stated in this section) patent license to make, have made,
      use, offer to sell, sell, import, and otherwise transfer the Work,
      where such license applies only to those patent claims licensable
      by such Contributor that are necessarily infringed by their
      Contribution(s) alone or by combination of their Contribution(s)
      with the Work to which such Contribution(s) was submitted. If You
      institute patent litigation against any entity (including a
      cross-claim or counterclaim in a lawsuit) alleging that the Work
      or a Contribution incorporated within the Work constitutes direct
      or contributory patent infringement, then any patent licenses
      granted to You under this License for that Work shall terminate
      as of the date such litigation is filed.

   4. Redistribution. You may reproduce and distribute copies of the
      Work or Derivative Works thereof in any medium, with or without
      modifications, and in Source or Object form, provided that You
      meet the following conditions:

      (a) You must give any other recipients of the Work or
          Derivative Works a copy of this License; and

      (b) You must cause any modified files to carry prominent notices
          stating that You changed the files; and

      (c) You must retain, in the Source form of any Derivative Works
          that You distribute, all copyright, patent, trademark, and
          attribution notices from the Source form of the Work,
          excluding those notices that do not pertain to any part of
          the Derivative Works; and

      (d) If the Work includes a "NOTICE" text file as part of its
          distribution, then any Derivative Works that You distribute must
          include a readable copy of the attribution notices contained
          within such NOTICE file, excluding those notices that do not
          pertain to any part of the Derivative Works, in at least one
          of the following places: within a NOTICE text file distributed
          as part of the Derivative Works; within the Source form or
          documentation, if provided along with the Derivative Works; or,
          within a display generated by the Derivative Works, if and
          wherever such third-party notices normally appear. The contents
          of the NOTICE file are for informational purposes only and
          do not modify the License. You may add Your own attribution
          notices within Derivative Works that You distribute, alongside
          or as an addendum to the NOTICE text from the Work, provided
          that such additional attribution notices cannot be construed
          as modifying the License.

      You may add Your own copyright statement to Your modifications and
      may provide additional or different license terms and conditions
      for use, reproduction, or distribution of Your modifications, or
      for any such Derivative Works as a whole, provided Your use,
      reproduction, and distribution of the Work otherwise complies with
      the conditions stated in this License.

   5. Submission of Contributions. Unless You explicitly state otherwise,
      any Contribution intentionally submitted for inclusion in the Work
      by You to the Licensor shall be under the terms and conditions of
      this License, without any additional terms or conditions.
      Notwithstanding the above, nothing herein shall supersede or modify
      the terms of any separate license agreement you may have executed
      with Licensor regarding such Contributions.

   6. Trademarks. This License does not grant permission to use the trade
      names, trademarks, service marks, or product names of the Licensor,
      except as required for reasonable and customary use in describing the
      origin of the Work and reproducing the content of the NOTICE file.

   7. Disclaimer of Warranty. Unless required by applicable law or
      agreed to in writing, Licensor provides the Work (and each
      Contributor provides its Contributions) on an "AS IS" BASIS,
      WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or
      implied, including, without limitation, any warranties or conditions
      of TITLE, NON-INFRINGEMENT, MERCHANTABILITY, or FITNESS FOR A
      PARTICULAR PURPOSE. You are solely responsible for determining the
      appropriateness of using or redistributing the Work and assume any
      risks associated with Your exercise of permissions under this License.

   8. Limitation of Liability. In no event and under no legal theory,
      whether in tort (including negligence), contract, or otherwise,
      unless required by applicable law (such as deliberate and grossly
      negligent acts) or agreed to in writing, shall any Contributor be
      liable to You for damages, including any direct, indirect, special,
      incidental, or consequential damages of any character arising as a
      result of this License or out of the use or inability to use the
      Work (including but not limited to damages for loss of goodwill,
      work stoppage, computer failure or malfunction, or any and all
      other commercial damages or losses), even if such Contributor
      has been advised of the possibility of such damages.

   9. Accepting Warranty or Additional Liability. While redistributing
      the Work or Derivative Works thereof, You may choose to offer,
      and charge a fee for, acceptance of support, warranty, indemnity,
      or other liability obligations and/or rights consistent with this
      License. However, in accepting such obligations, You may act only
      on Your own behalf and on Your sole responsibility, not on behalf
      of any other Contributor, and only if You agree to indemnify,
      defend, and hold each Contributor harmless for any liability
      incurred by, or claims asserted against, such Contributor by reason
      of your accepting any such warranty or additional liability.

   END OF TERMS AND CONDITIONS
```

#### react 18.3.1 (MIT)

`LICENSE` :

```text
MIT License

Copyright (c) Facebook, Inc. and its affiliates.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

#### react-dom 18.3.1 (MIT)

`LICENSE` :

```text
MIT License

Copyright (c) Facebook, Inc. and its affiliates.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

#### react-router 7.18.4 (MIT)

`LICENSE.md` :

```text
MIT License

Copyright (c) React Training LLC 2015-2019
Copyright (c) Remix Software Inc. 2020-2021
Copyright (c) Shopify Inc. 2022-2023

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

#### react-router-dom 7.18.4 (MIT)

`LICENSE.md` :

```text
MIT License

Copyright (c) React Training LLC 2015-2019
Copyright (c) Remix Software Inc. 2020-2021
Copyright (c) Shopify Inc. 2022-2023

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

#### scheduler 0.23.2 (MIT)

`LICENSE` :

```text
MIT License

Copyright (c) Facebook, Inc. and its affiliates.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

#### set-cookie-parser 2.7.3 (MIT)

`LICENSE` :

```text
The MIT License (MIT)

Copyright (c) 2015 Nathan Friedly <nathan@nfriedly.com> (http://nfriedly.com/)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
```

### Outils de construction dont une part est livrée

Styles de base générés par Tailwind CSS ; amorce de chargement des modules écrite par Vite.

#### tailwindcss 3.4.19 (MIT)

`LICENSE` :

```text
MIT License

Copyright (c) Tailwind Labs, Inc.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

#### vite 6.4.5 (MIT)

`LICENSE.md` :

```text
# Vite core license
Vite is released under the MIT license:

MIT License

Copyright (c) 2019-present, VoidZero Inc. and Vite contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

### Paquets livrés avec leur dossier dans `app.asar`

116 paquets (`npm ls --omit=dev --all`) : MIT 101, ISC 10, BSD-3-Clause 2, BlueOak-1.0.0 1, BSD-2-Clause 1, Python-2.0 1. Chacun voyage avec son propre fichier de licence ; il n'est pas recopié ici.

| Paquet | Version | Licence |
|---|---|---|
| @hono/node-server | 2.1.8 | MIT |
| @modelcontextprotocol/sdk | 1.32.2 | MIT |
| accepts | 2.0.0 | MIT |
| ajv | 8.20.0 | MIT |
| ajv-formats | 3.0.1 | MIT |
| argparse | 2.0.1 | Python-2.0 |
| body-parser | 2.4.0 | MIT |
| builder-util-runtime | 9.7.0 | MIT |
| bytes | 3.1.2 | MIT |
| call-bind-apply-helpers | 1.0.2 | MIT |
| call-bound | 1.0.4 | MIT |
| content-disposition | 2.0.1 | MIT |
| content-type | 1.0.5 | MIT |
| content-type | 2.1.0 | MIT |
| cookie | 0.7.2 | MIT |
| cookie | 1.1.1 | MIT |
| cookie-signature | 1.2.2 | MIT |
| cors | 2.8.6 | MIT |
| cross-spawn | 7.0.6 | MIT |
| debug | 4.4.3 | MIT |
| depd | 2.0.0 | MIT |
| dunder-proto | 1.0.1 | MIT |
| ee-first | 1.1.1 | MIT |
| electron-updater | 6.8.11 | MIT |
| encodeurl | 2.0.0 | MIT |
| es-define-property | 1.0.1 | MIT |
| es-errors | 1.3.0 | MIT |
| es-object-atoms | 1.1.2 | MIT |
| escape-html | 1.0.3 | MIT |
| etag | 1.8.1 | MIT |
| eventsource | 3.0.7 | MIT |
| eventsource-parser | 3.1.1 | MIT |
| express | 5.3.0 | MIT |
| express-rate-limit | 8.7.1 | MIT |
| fast-deep-equal | 3.1.3 | MIT |
| fast-uri | 3.1.9 | BSD-3-Clause |
| finalhandler | 2.1.1 | MIT |
| forwarded | 0.2.0 | MIT |
| fresh | 2.0.0 | MIT |
| fs-extra | 10.1.0 | MIT |
| function-bind | 1.1.2 | MIT |
| get-intrinsic | 1.3.0 | MIT |
| get-proto | 1.0.1 | MIT |
| gopd | 1.2.0 | MIT |
| graceful-fs | 4.2.11 | ISC |
| has-symbols | 1.1.0 | MIT |
| hasown | 2.0.4 | MIT |
| hono | 4.13.18 | MIT |
| http-errors | 2.0.1 | MIT |
| iconv-lite | 0.7.3 | MIT |
| inherits | 2.0.4 | ISC |
| ip-address | 10.7.4 | MIT |
| ipaddr.js | 1.9.1 | MIT |
| is-promise | 4.0.0 | MIT |
| isexe | 2.0.0 | ISC |
| jose | 6.2.13 | MIT |
| js-tokens | 4.0.0 | MIT |
| js-yaml | 4.3.2 | MIT |
| json-schema-traverse | 1.0.0 | MIT |
| json-schema-typed | 8.0.2 | BSD-2-Clause |
| jsonfile | 6.2.1 | MIT |
| lazy-val | 1.0.5 | MIT |
| lodash.escaperegexp | 4.1.2 | MIT |
| lodash.isequal | 4.5.0 | MIT |
| loose-envify | 1.4.0 | MIT |
| lucide-react | 0.469.0 | ISC |
| math-intrinsics | 1.1.0 | MIT |
| media-typer | 1.1.1 | MIT |
| merge-descriptors | 2.0.0 | MIT |
| mime-db | 1.54.0 | MIT |
| mime-types | 3.0.2 | MIT |
| ms | 2.1.3 | MIT |
| negotiator | 1.1.0 | MIT |
| object-assign | 4.1.1 | MIT |
| object-inspect | 1.13.4 | MIT |
| on-finished | 2.4.2 | MIT |
| once | 1.4.0 | ISC |
| parseurl | 1.3.3 | MIT |
| path-key | 3.1.1 | MIT |
| path-to-regexp | 8.4.2 | MIT |
| pkce-challenge | 5.0.1 | MIT |
| proxy-addr | 2.0.8 | MIT |
| qs | 6.16.1 | BSD-3-Clause |
| range-parser | 1.3.0 | MIT |
| raw-body | 3.0.2 | MIT |
| react | 18.3.1 | MIT |
| react-dom | 18.3.1 | MIT |
| react-router | 7.18.4 | MIT |
| react-router-dom | 7.18.4 | MIT |
| require-from-string | 2.0.2 | MIT |
| router | 2.2.0 | MIT |
| safer-buffer | 2.1.2 | MIT |
| sax | 1.6.1 | BlueOak-1.0.0 |
| scheduler | 0.23.2 | MIT |
| semver | 7.7.4 | ISC |
| send | 1.2.1 | MIT |
| serve-static | 2.2.1 | MIT |
| set-cookie-parser | 2.7.3 | MIT |
| setprototypeof | 1.2.0 | ISC |
| shebang-command | 2.0.0 | MIT |
| shebang-regex | 3.0.0 | MIT |
| side-channel | 1.1.1 | MIT |
| side-channel-list | 1.0.1 | MIT |
| side-channel-map | 1.0.1 | MIT |
| side-channel-weakmap | 1.0.2 | MIT |
| statuses | 2.0.2 | MIT |
| tiny-typed-emitter | 2.1.0 | MIT |
| toidentifier | 1.0.1 | MIT |
| type-is | 2.1.0 | MIT |
| universalify | 2.0.1 | MIT |
| unpipe | 1.0.0 | MIT |
| vary | 1.1.2 | MIT |
| which | 2.0.2 | ISC |
| wrappy | 1.0.2 | ISC |
| zod | 4.6.7 | MIT |
| zod-to-json-schema | 3.25.2 | ISC |

<!-- fin de la partie générée -->


## REA (optional local Code connector)

REA 6.8.0, copyright (c) 2026 morluto, MIT, https://github.com/morluto/rea.
The upstream package and its notices are retained in the private installation.
Its dependency lock is taken from revision 160d821ac9a0310afcb8d1fc427862dd6508add5.
Runtime dependencies include MIT, Apache-2.0, BSD, ISC, BlueOak-1.0.0, Zlib and
OpenPGP under LGPL-3.0+. Frida and external analysis engines are not automatically
installed. See REA's THIRD_PARTY_NOTICES.md and licenses/ in the installed package
for the complete copyright and license texts.


## Voix locale optionnelle Kokoro (03/11/2026)

Kokoro-82M v1.0 ONNX et voix française ff_siwis : Apache-2.0.
Révision : 1939ad2a8e416c0acfeecc08a694d14ef25f2231.
https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX

Runtime optionnel : ONNX Runtime Web/Common 1.24.3 (MIT), Microsoft ;
@echogarden/espeak-ng-emscripten 0.3.5 (GPL-3.0), auteurs eSpeak NG et Echogarden.
flatbuffers et long (Apache-2.0), platform, undici-types et @types/node (MIT),
protobufjs et @protobufjs/* (BSD-3-Clause), guid-typescript (ISC).
Versions et intégrités : gateway/ressources/kokoro/package-lock.json.
Chaque paquet conserve ses licences dans le dossier de voix installé, avec NOTICES.md.
Aucun script d’installation npm n’est exécuté.

Sources et instructions de construction du port eSpeak non modifié :
https://github.com/echogarden-project/espeak-ng-emscripten
https://github.com/echogarden-project/espeak-ng/tree/fork
ONNX Runtime : https://github.com/microsoft/onnxruntime/tree/v1.24.3
