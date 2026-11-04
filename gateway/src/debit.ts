/**
 * Limitation de débit.
 *
 * La passerelle n'en avait aucune. Deux routes suffisaient à la mettre à
 * genoux : `GET /helix/export` relit tout le magasin **et** quatre-vingt-dix
 * jours de journal, et `GET /helix/audit` relit le fichier du jour deux fois,
 * dont un passage qui recalcule un HMAC par ligne. Quelques appels simultanés
 * d'une seule séance, et le processus tombe — c'est-à-dire que le produit
 * s'arrête, pour tout le monde.
 *
 * Fenêtre glissante, en mémoire. Pas de base, pas de dépendance : une
 * passerelle qui redémarre repart à zéro, ce qui est le bon comportement —
 * une limite n'est pas une punition à faire durer.
 *
 * Elle ne remplace pas les protections existantes et ne les double pas : le
 * verrouillage après échecs de mot de passe reste dans accounts.ts, par
 * compte. Celle-ci compte les requêtes, par appelant.
 */

interface Regle {
  /** Nombre d'appels admis dans la fenêtre. */
  max: number;
  /** Durée de la fenêtre, en millisecondes. */
  fenetreMs: number;
}

/**
 * Ce qu'on limite, et pourquoi.
 *
 * Les valeurs sont larges à dessein : une personne au travail ne les atteint
 * jamais. Elles n'arrêtent que la répétition mécanique.
 */
const REGLES: { methode: string; chemin: string; regle: Regle }[] = [
  // Plusieurs lectures distantes et jusqu’à 8 Mo de catalogue, avant prévisualisation.
  { methode: "POST", chemin: "/helix/competences/importer-lien", regle: { max: 6, fenetreMs: 60_000 } },
  // Relit tout le magasin et 90 jours de journal, en une requête.
  { methode: "GET", chemin: "/helix/export", regle: { max: 3, fenetreMs: 60_000 } },
  // Relit et rehache le journal du jour, deux fois.
  { methode: "GET", chemin: "/helix/audit", regle: { max: 30, fenetreMs: 60_000 } },
  // Fait tourner un interpréteur sur un fichier son.
  { methode: "POST", chemin: "/helix/dictee", regle: { max: 30, fenetreMs: 60_000 } },
  /*
   * Authentification : le verrouillage par compte existe déjà (accounts.ts),
   * mais il ne coûte rien d'essayer mille comptes différents. Ici on compte
   * par appelant, quel que soit le compte visé.
   */
  { methode: "POST", chemin: "/helix/auth/verify", regle: { max: 30, fenetreMs: 60_000 } },
  { methode: "POST", chemin: "/helix/auth/deux-facteurs", regle: { max: 30, fenetreMs: 60_000 } },
  { methode: "POST", chemin: "/helix/auth/premier-mot-de-passe", regle: { max: 10, fenetreMs: 60_000 } },
  { methode: "POST", chemin: "/helix/auth/mot-de-passe-provisoire", regle: { max: 10, fenetreMs: 60_000 } },
  { methode: "POST", chemin: "/helix/auth/create", regle: { max: 10, fenetreMs: 60_000 } },
  /*
   * Mot de passe oublié (23/10/2026). Un code de récupération fait dix
   * caractères d'un alphabet de 31 (environ 49 bits) : le deviner est hors de
   * portée, le blocage par compte s'ajoute. Tirer des codes et réinitialiser
   * un collègue redemandent un mot de passe : même frein que la connexion.
   */
  { methode: "POST", chemin: "/helix/auth/recuperer", regle: { max: 10, fenetreMs: 60_000 } },
  { methode: "POST", chemin: "/helix/auth/codes-recuperation", regle: { max: 10, fenetreMs: 60_000 } },
  { methode: "POST", chemin: "/helix/auth/reinitialiser", regle: { max: 10, fenetreMs: 60_000 } },
  /*
   * Rattachement par code d'invitation : c'est la seule route publique qui
   * remet le jeton d'instance. Un code fait quatre groupes de quatre
   * caractères tirés d'un alphabet de trente, soit environ 82 bits : le
   * deviner est hors de portée. La limite est là pour que personne n'essaie.
   */
  { methode: "POST", chemin: "/helix/invitations/rejoindre", regle: { max: 10, fenetreMs: 60_000 } },
  /*
   * Notifications de WhatsApp (natifs/messageries.ts) : publiques, et chacune
   * coûte un HMAC. Meta les groupe (jusqu'à 1000 par envoi) : 300 par minute
   * laissent passer un pic réel et arrêtent un envoi en boucle.
   */
  /*
   * Compté par le module lui-même, seulement pour les requêtes qui portent une
   * signature de la bonne forme (natifs/messageries.ts, `CHEMIN_DEBIT_SIGNE`,
   * tournée du 28/09/2026) : ce chemin n'est celui d'aucune requête.
   */
  { methode: "POST", chemin: "/helix/messageries/whatsapp/webhook#signee", regle: { max: 300, fenetreMs: 60_000 } },
  { methode: "GET", chemin: "/helix/messageries/whatsapp/webhook", regle: { max: 30, fenetreMs: 60_000 } },
];

/** Plus ancien que la plus longue fenêtre : on peut oublier l'appelant. */
const OUBLI_MS = 10 * 60_000;
/** Au-delà, on purge : un compteur par adresse ne doit pas devenir une fuite. */
const APPELANTS_MAX = 10_000;

const passages = new Map<string, number[]>();
let dernierMenage = Date.now();

function menage(maintenant: number): void {
  if (maintenant - dernierMenage < 60_000 && passages.size < APPELANTS_MAX) return;
  dernierMenage = maintenant;
  for (const [cle, dates] of passages) {
    if (dates.length === 0 || maintenant - dates[dates.length - 1]! > OUBLI_MS) passages.delete(cle);
  }
}

export interface Verdict {
  /** Vrai si la requête passe. */
  ok: boolean;
  /** Secondes à attendre, quand elle ne passe pas. */
  retenteDans?: number;
}

/**
 * La requête passe-t-elle ?
 *
 * `appelant` identifie qui demande : le jeton de séance s'il y en a un, sinon
 * l'adresse. Le jeton d'abord, parce que sur une instance partagée toutes les
 * requêtes d'un même bureau sortent de la même adresse, et qu'une personne ne
 * doit pas être bloquée par sa voisine.
 */
export function verifier(methode: string, chemin: string, appelant: string): Verdict {
  const entree = REGLES.find((r) => r.methode === methode && r.chemin === chemin);
  if (!entree) return { ok: true };

  const maintenant = Date.now();
  menage(maintenant);

  const cle = `${methode} ${chemin}|${appelant}`;
  const debut = maintenant - entree.regle.fenetreMs;
  const dates = (passages.get(cle) ?? []).filter((d) => d > debut);

  if (dates.length >= entree.regle.max) {
    passages.set(cle, dates);
    const plusAncienne = dates[0]!;
    return { ok: false, retenteDans: Math.max(1, Math.ceil((plusAncienne + entree.regle.fenetreMs - maintenant) / 1000)) };
  }

  dates.push(maintenant);
  passages.set(cle, dates);
  return { ok: true };
}

/**
 * Débit d'une clé d'API (clesApi.ts), toutes routes confondues : `max`
 * requêtes par minute. Compté par clé et non par adresse, pour qu'une clé
 * fuitée qui tourne en boucle s'arrête seule, sans freiner les collègues du
 * même bureau.
 */
export function verifierCleApi(idCle: string, max: number): Verdict {
  const maintenant = Date.now();
  menage(maintenant);
  const cle = `cle-api|${idCle}`;
  const fenetreMs = 60_000;
  const dates = (passages.get(cle) ?? []).filter((d) => d > maintenant - fenetreMs);
  if (dates.length >= max) {
    passages.set(cle, dates);
    return { ok: false, retenteDans: Math.max(1, Math.ceil((dates[0]! + fenetreMs - maintenant) / 1000)) };
  }
  dates.push(maintenant);
  passages.set(cle, dates);
  return { ok: true };
}

/** Remet les compteurs à zéro. Pour les essais, et pour eux seuls. */
export function oublierTout(): void {
  passages.clear();
}
