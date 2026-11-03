# Helix (HelixAI) : consignes pour Codex

Plateforme d'IA souveraine, locale et open source (AGPL-3.0) : application Electron + passerelle Node sans dépendance (`gateway/src`) + interface React (`src`). Rien n'est vendu : chaque organisation installe sa propre instance.

**Lire d'abord [PROJET.md](PROJET.md)** : intentions, décisions prises, état réel, ce qui reste à faire. Les décisions qui y sont écrites ne se refont pas à l'envers. `ARCHITECTURE.md`, `SECURITE.md`, `docs/GUIDE.md` (ancien README technique), `SCREENS.md` décrivent le code ; `README.md` (anglais, + `.fr`, `.zh`) est la vitrine GitHub.

## Règles du projet

- Interface en français, vocabulaire « Chat » (jamais « Discussion »). Tout texte affiché passe par `t()` / `tf()` (`src/lib/i18n`, `gateway/src/langue.ts`), avec catalogues anglais, chinois, japonais, espagnol, allemand et arabe à 100 % : `node scripts/i18n.mjs --ecrire` et `node scripts/i18n-passerelle.mjs --ecrire` préparent les clés, puis remplir `src/i18n/{en,zh,ja,es,de,ar}.json` et `gateway/i18n/{en,zh,ja,es,de,ar}.json`.
- Aucun nom de produit en dur à l'écran (`branding.name`), pas de tiret cadratin dans un texte affiché, pas de couleur hexadécimale hors de `tokens.css`.
- Honnêteté avant tout : l'écran ne promet que ce qui est vérifié, et n'écrit jamais « vérifié » ou « testé » pour ce qui ne l'a pas été. Ce qui n'a pas été essayé se dit dans la documentation interne (PROJET.md, SECURITE.md, commentaires du code) et dans les réponses à Medhi, **plus à l'écran ni dans ce que le public lit** (README, notes de version, aide intégrée, docs/GUIDE.md côté utilisateur) : on retire la mention, on garde le conseil utile. Décision de Medhi du 28/09/2026, PROJET.md § 3.16 ; contrôlé par `npm run securite` (§ 15 quinquies).
- Commentaires et noms en français, dans le style du code existant (le « pourquoi », mesures datées).
- Modèles et fichiers téléchargés : licences Apache 2.0 ou MIT seulement, révision épinglée, empreinte vérifiée. Exceptions décidées par Medhi : Unsloth et unsloth_zoo (LGPL) sur carte NVIDIA (25/09/2026, PROJET.md § 3.12) ; Python (PSF), posé par Helix quand la machine n'en a pas (27/09/2026, `pythonPrive.ts`) ; Microsoft Visual C++ Redistributable, téléchargé chez Microsoft (version épinglée, empreinte et signature vérifiées) et installé sous Windows quand OpenClaw en a besoin et qu'il manque (29/09/2026). ; les dépendances du serveur MCP de Blender sous BSD-3, MIT-0, PSF et MPL-2.0 (certifi), figées par empreintes (12/10/2026, « je veux juste que ça fonctionne, fais au mieux »). ; REA et ses dépendances nécessaires (LGPL-3.0+, BSD, ISC, BlueOak et Zlib), notices conservées, sans installation automatique de Frida ni des moteurs externes (accord explicite de Medhi du 02/11/2026).
- Données : ne jamais écrire une liste vide par-dessus des données qu'on n'a pas pu lire (voir PROJET.md, pertes du 20/09 et du 24/09).

## Vérifier avant de rendre

- `npm run typecheck` (interface et passerelle).
- `npm run securite` (2717 contrôles contre une instance jetable).
- `node scripts/i18n.mjs` et `node scripts/i18n-passerelle.mjs` : 100 % dans les six catalogues (en, zh, ja, es, de, ar).
- Ne jamais envoyer la sortie de `npm run build` dans `head` (cela a déjà écrasé `index.html`).

## Dans une session cloud

Pas de LM Studio, pas d'application Electron, pas de Mac : on écrit et on vérifie le code (typecheck, sécurité, i18n), on ne lance ni `npm run package` ni les modèles. Dire à la fin ce qui reste à essayer sur le poste. Ne pas publier le site helix-agence.fr ni changer la visibilité du dépôt sans le demander.
