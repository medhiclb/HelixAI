import { currentUser } from "@/lib/store/identity";
import { features } from "@/config/branding";
import { chargerEmployes } from "@/lib/employes";
import { visibleTo, estArchivee, estCowork } from "@/lib/store/sessions";
import { SESSIONS_CHANGED } from "@/hooks/useSessions";
import { abonnerExecutions } from "@/lib/executions";
import { visibleTo as tachesVisibles } from "@/lib/store/tasks";
import { fetchApprobation, subscribeApprobation } from "@/lib/gateway";
import { libelleOutil } from "@/lib/libellesOutils";
import { t, tf } from "@/lib/i18n";

/**
 * Centre de notifications.
 *
 * Ce que Helix a le droit de signaler : ce qui s'est vraiment produit et que
 * la personne n'a pas pu voir, parce qu'elle était sur un autre écran ou
 * ailleurs. Rien d'inventé, rien de promotionnel, aucune relance.
 *
 * Cinq sources, toutes existantes par ailleurs :
 *  - la mise à jour de l'application (electron/miseAJour.cjs) ;
 *  - la mise à jour du moteur des agents, OpenClaw ;
 *  - une action d'agent qui attend un accord (passerelle, approbation.ts) ;
 *  - une tâche déléguée terminée ou échouée (lib/executions.ts) ;
 *  - un chat qu'une collègue vient de partager.
 *
 * Tout est **local au poste** : la liste vit dans le stockage du navigateur,
 * sous l'identifiant de la personne connectée, et ne part nulle part. Une
 * notification n'est pas une donnée partagée : c'est un pense-bête d'écran.
 */

export type GenreNotification = "maj" | "moteur" | "approbation" | "tache" | "partage";

export interface Notification {
  id: string;
  genre: GenreNotification;
  titre: string;
  detail?: string;
  /** Route vers l'écran qui répond à la notification. */
  lien?: string;
  date: string;
  lue: boolean;
}

/** Au-delà, les plus anciennes tombent : une liste sans fin ne se lit pas. */
const MAX = 50;

const abonnes = new Set<() => void>();
let demarre = false;

const cle = (): string => `helix:notifications:${currentUser().id}`;

function lire(): Notification[] {
  try {
    const brut = localStorage.getItem(cle());
    const liste = brut ? (JSON.parse(brut) as Notification[]) : [];
    return Array.isArray(liste) ? liste : [];
  } catch {
    return [];
  }
}

function ecrire(liste: Notification[]): void {
  try {
    localStorage.setItem(cle(), JSON.stringify(liste.slice(0, MAX)));
  } catch {
    /* quota dépassé ou stockage indisponible : on s'en passe */
  }
  for (const f of abonnes) f();
}

export const notifications = (): Notification[] => lire();

export const nonLues = (): number => lire().filter((n) => !n.lue).length;

export function abonnerNotifications(f: () => void): () => void {
  abonnes.add(f);
  return () => abonnes.delete(f);
}

/**
 * Pose une notification, sauf si elle est déjà là.
 *
 * L'identifiant est stable et porte le fait signalé (« maj:0.22.0 », et non un
 * tirage au sort) : les sources sont interrogées en boucle, et une même mise à
 * jour ne doit pas remplir la liste à chaque tour.
 */
export function signaler(n: Omit<Notification, "date" | "lue">): void {
  const liste = lire();
  if (liste.some((x) => x.id === n.id)) return;
  ecrire([{ ...n, date: new Date().toISOString(), lue: false }, ...liste]);
}

/** Retire une notification devenue sans objet (l'accord a été donné, par exemple). */
export function retirer(id: string): void {
  const liste = lire();
  const suite = liste.filter((n) => n.id !== id);
  if (suite.length !== liste.length) ecrire(suite);
}

export function marquerLue(id: string): void {
  ecrire(lire().map((n) => (n.id === id ? { ...n, lue: true } : n)));
}

export function toutMarquerLu(): void {
  const liste = lire();
  if (liste.every((n) => n.lue)) return;
  ecrire(liste.map((n) => ({ ...n, lue: true })));
}

export function toutEffacer(): void {
  ecrire([]);
}

/* ------------------------------- Les sources ------------------------------- */

interface PontMiseAJour {
  etat: () => Promise<EtatMaj>;
  surChangement: (rappel: (e: EtatMaj) => void) => () => void;
}
interface EtatMaj {
  phase: string;
  versionDisponible?: string | null;
  message?: string | null;
}

function pontMaj(): PontMiseAJour | undefined {
  return (window as unknown as { helix?: { miseAJour?: PontMiseAJour } }).helix?.miseAJour;
}

function suivreMiseAJour(): void {
  const pont = pontMaj();
  if (!pont) return; // hors Electron : pas de paquet à mettre à jour
  const traiter = (e: EtatMaj) => {
    const version = e.versionDisponible ?? "";
    if (e.phase === "disponible" && version) {
      signaler({
        id: `maj:disponible:${version}`,
        genre: "maj",
        titre: tf("Version {0} disponible", version),
        detail: t("Elle s'installe depuis les Réglages, rubrique Mise à jour."),
        lien: "/parametres/preferences",
      });
    } else if (e.phase === "prete" && version) {
      signaler({
        id: `maj:prete:${version}`,
        genre: "maj",
        titre: tf("Version {0} prête à installer", version),
        detail: t("Elle se mettra en place au prochain redémarrage de l'application."),
        lien: "/parametres/preferences",
      });
    }
  };
  pont.surChangement(traiter);
  void pont.etat().then(traiter).catch(() => undefined);
}

/**
 * Moteur des agents : une version éprouvée plus récente que celle installée.
 * Interrogé au lancement puis toutes les six heures, comme l'application.
 * Rien à surveiller si l'édition livrée n'a pas d'agents.
 */
function suivreMoteur(): void {
  if (!features.agents) return;
  const regarder = async () => {
    try {
      const etat = await chargerEmployes();
      if (etat.moteur.installe && etat.moteur.miseAJour) {
        signaler({
          id: `moteur:${etat.moteur.miseAJour}`,
          genre: "moteur",
          titre: tf("Mise à jour du moteur des agents : {0}", etat.moteur.miseAJour),
          detail: tf("La version en place est {0}.", etat.moteur.version ?? t("inconnue")),
          lien: "/agents",
        });
      }
    } catch {
      /* passerelle injoignable : on réessaiera au tour suivant */
    }
  };
  void regarder();
  // Pas « t » : ce nom masquerait la traduction dans `regarder`.
  const minuterie = setInterval(() => void regarder(), 6 * 60 * 60 * 1000);
  window.addEventListener("beforeunload", () => clearInterval(minuterie));
}

/**
 * Action d'agent en attente d'accord. La notification disparaît d'elle-même
 * dès que la demande est tranchée : un pense-bête pour une décision déjà prise
 * ne serait plus qu'un mensonge de plus à l'écran.
 *
 * C'est un second abonnement au même flux que celui de `useApprobation` : la
 * cloche doit s'allumer où que l'on soit, y compris sur un écran qui n'affiche
 * aucune carte d'approbation. Le coût est d'une connexion d'évènements de plus
 * par fenêtre ; le partager demanderait que la barre latérale dépende d'un
 * crochet React monté ailleurs, ce qui est plus fragile que cette connexion.
 */
function suivreApprobations(): void {
  const poser = (d: { id: string; detail?: { outil?: string; employe?: string } }) => {
    const outil = d.detail?.outil ? libelleOutil(d.detail.outil) : t("Une action");
    const qui = d.detail?.employe ? ` (${d.detail.employe})` : "";
    signaler({
      id: `approbation:${d.id}`,
      genre: "approbation",
      titre: t("Une action attend votre accord"),
      detail: `${outil}${qui}`,
      lien: "/cowork",
    });
  };
  /*
   * L'état lu fait foi, au démarrage et à chaque reprise du flux (27/09/2026).
   * La liste est gardée dans le navigateur : une demande tranchée ou perdue
   * pendant que la fenêtre était fermée, ou pendant un redémarrage de la
   * passerelle, ne produit aucun évènement, et la cloche disait encore « Une
   * action attend votre accord » (vu en essayant l'écran Code). Une lecture
   * ratée ne retire rien : on ne sait pas.
   */
  /*
   * Ce que le flux a dit pendant la lecture (28/09/2026) : l'état lu est celui
   * d'avant sa réponse, et une demande arrivée entre-temps en était retirée
   * aussitôt posée ; une demande tranchée entre-temps, reposée.
   */
  let pendant: { posees: Set<string>; tranchees: Set<string> } | null = null;
  const synchroniser = () => {
    const notes = { posees: new Set<string>(), tranchees: new Set<string>() };
    pendant = notes;
    void fetchApprobation()
      .then((etat) => {
        const enAttente = new Set(etat.enAttente.map((d) => `approbation:${d.id}`));
        for (const n of lire()) if (n.genre === "approbation" && !enAttente.has(n.id) && !notes.posees.has(n.id)) retirer(n.id);
        etat.enAttente.filter((d) => !notes.tranchees.has(`approbation:${d.id}`)).forEach(poser);
      })
      .catch(() => undefined)
      .finally(() => {
        if (pendant === notes) pendant = null;
      });
  };
  subscribeApprobation((evenement) => {
    if (evenement.type === "approbation_demandee") {
      const { type: _type, ...demande } = evenement;
      pendant?.posees.add(`approbation:${demande.id}`);
      poser(demande);
    } else {
      pendant?.tranchees.add(`approbation:${evenement.id}`);
      retirer(`approbation:${evenement.id}`);
    }
  }, synchroniser);
}

/**
 * Tâches déléguées : on signale la fin, pas le déroulé.
 *
 * Un échec porte le statut « annulée » **et** un message d'erreur ; une carte
 * qu'une personne a rangée elle-même en « annulée » n'en a pas. C'est ce qui
 * distingue les deux, et évite d'annoncer un échec là où il n'y en a pas.
 */
function suivreTaches(): void {
  const vus = new Map<string, string>();
  const regarder = () => {
    for (const t of tachesVisibles(currentUser())) {
      const avant = vus.get(t.id);
      vus.set(t.id, t.status);
      if (avant === undefined || avant === t.status) continue;
      if (t.status === "terminee") {
        signaler({
          id: `tache:${t.id}:terminee`,
          genre: "tache",
          titre: tf("Tâche terminée : {0}", t.title),
          lien: "/taches",
        });
      } else if (t.status === "annulee" && t.error) {
        signaler({
          id: `tache:${t.id}:echec`,
          genre: "tache",
          titre: tf("Tâche en échec : {0}", t.title),
          detail: t.error.slice(0, 160),
          lien: "/taches",
        });
      }
    }
  };
  regarder();
  abonnerExecutions(regarder);
}

/** Un chat qu'on vient de vous partager, et que vous n'aviez pas encore. */
function suivrePartages(): void {
  let connus: Set<string> | null = null;
  const regarder = () => {
    const moi = currentUser();
    const partages = visibleTo(moi).filter((s) => s.ownerId !== moi.id && !estArchivee(s, moi));
    const ids = new Set(partages.map((s) => s.id));
    if (connus === null) {
      // Premier tour : on prend l'existant pour acquis, sans notifier le passé.
      connus = ids;
      return;
    }
    for (const s of partages) {
      if (connus.has(s.id)) continue;
      signaler({
        id: `partage:${s.id}`,
        genre: "partage",
        titre: t("Un chat vous a été partagé"),
        detail: s.title,
        // Une session de Cowork s'ouvre dans Cowork (04/10/2026), avec ses outils.
        lien: estCowork(s) ? `/cowork?c=${s.id}` : `/?c=${s.id}`,
      });
    }
    connus = ids;
  };
  regarder();
  window.addEventListener(SESSIONS_CHANGED, regarder);
  window.addEventListener("helix:synced", regarder);
}

/** À appeler une fois, une personne connectée. Les appels suivants ne font rien. */
export function demarrerNotifications(): void {
  if (demarre) return;
  demarre = true;
  suivreMiseAJour();
  suivreMoteur();
  suivreApprobations();
  suivreTaches();
  suivrePartages();
}
