# CRM de l’agence Helix

Application web privée issue du CRM Actelyo. Entreprises, contacts, pipeline entrant et sortant, rendez-vous, relances, messagerie commune filtrée sur les contacts CRM, calendriers, débriefs, propositions exportables, documents d’équipe et historique. Les données de démarrage sont vides. Le domaine cible est `crm.helix-agence.fr`.

## Développement

Node 24. Installer avec `npm ci`, puis `npm run dev`. En développement, sans projet Supabase, le mode local garde les fiches sur l’appareil. En production, l’application attend la configuration de la base. Vérifier avec `npm test` et `npm run build`.

## Déploiement privé

1. Créer un projet Supabase européen dédié au CRM Helix. Appliquer `supabase/schema.sql`, puis les fichiers de `supabase/migrations/` dans l’ordre de leur nom. L’agence a son propre identifiant d’espace et sa propre base.
2. L’adresse initiale autorisée est `medhi.clabaut@gmail.com`. Autoriser explicitement une autre adresse vérifiée via `insert into public.crm_allowed_emails (email) values ('adresse@exemple.fr');` depuis l’administration SQL. Pour une révocation, retirer l’adresse et révoquer les sessions de ce compte dans Supabase Auth.
3. Configurer le Site URL et la redirection d’authentification sur `https://crm.helix-agence.fr`, le lien de connexion Supabase et le SMTP de l’agence.
4. Créer un projet de déploiement dédié, à partir de `agence/crm`. Renseigner les variables de `.env.example`, associer le sous-domaine et appliquer les enregistrements indiqués par l’hébergeur. Pour les API et les données CRM, choisir une région européenne. L’option Vercel dans `vercel.json` cible Paris. Générer une clé de chiffrement unique avec `openssl rand -hex 32`.
5. Pour Gmail ou Microsoft, configurer les applications OAuth de l’agence avec le callback `https://crm.helix-agence.fr/api/callback`. Les comptes IMAP et calendriers externes se connectent dans le CRM. Le coffre de documents supporte les fichiers déposés dans le CRM.

## Accès depuis le site et formulaire

Ajouter un lien « Espace CRM » vers `https://crm.helix-agence.fr` au site de l’agence après vérification de la connexion. Une règle de redirection à intégrer à la configuration Vercel du site est fournie sous `site/redirect.json`.

Le formulaire existant utilise Web3Forms. S’il dispose de la fonctionnalité Webhooks, ajouter une destination POST `https://crm.helix-agence.fr/api/site-contact` et l’en-tête `Authorization: Bearer <SITE_CONTACT_SECRET>`. La clé est propre au CRM et comporte au moins 32 caractères. Le formulaire peut continuer à envoyer ses emails via Web3Forms.

L’API accepte les champs actuels `nom`, `entreprise`, `email`, `message`, avec `telephone`, `objet` et `objet_label` facultatifs. Une demande sans thème explicite devient « Demande de projet ». Elle crée ou retrouve le contact et son entreprise, ajoute un débrief et une relance et ouvre une opportunité entrante quand le thème est commercial et qu’aucune opportunité active correspondante n’existe. Pour un autre serveur de formulaire, envoyer `{ delivery_id, contact }` avec un identifiant stable de 64 caractères hexadécimaux par soumission.

## HelixAI

Renseigner `HELIX_AI_URL` avec l’URL de base de la passerelle de l’agence, `HELIX_AI_KEY` avec une clé d’instance dédiée et `HELIX_AI_MODEL` avec l’identifiant d’un modèle local ou européen sélectionné dans cette instance. Le serveur CRM doit pouvoir atteindre cette passerelle en HTTPS. Une instance qui écoute seulement sur le Mac ne sera pas joignable depuis Vercel. Sur un déploiement CRM sur le même hôte, une adresse loopback HTTP est acceptée.

L’onglet HelixAI génère des brouillons de relance, de synthèse de compte ou de proposition. La demande peut inclure les derniers débriefs et opportunités d’une entreprise choisie, dans la limite de six fiches. Les réponses sont des brouillons à relire et aucun email n’est envoyé automatiquement.
