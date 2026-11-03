import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Blocks,
  Check,
  ExternalLink,
  Globe,
  Info,
  Laptop,
  Loader2,
  Lock,
  Plug,
  Plus,
  RotateCw,
  ShieldAlert,
  Terminal,
  Trash2,
  X,
} from "lucide-react";
import {
  etat as lireEtat,
  ajouter as brancher,
  connecter as autoriser,
  retirer as debrancher,
  CONNECTEURS_CHANGE,
  type EntreeCatalogue,
  type EtatConnecteurs,
} from "@/lib/connecteurs";
import { MCP_CHANGE } from "@/hooks/useMcp";
import { Card } from "@/components/settings/SettingsShell";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { InfoBox } from "@/components/ui/InfoBox";
import { SearchInput } from "@/components/ui/SearchInput";
import { LogoMarque } from "@/components/settings/TuileService";
import {
  MARQUE_DU_CONNECTEUR,
  ICONE_DU_CONNECTEUR,
  ICONE_PAR_DEFAUT,
} from "@/components/settings/marquesConnecteurs";
import type { CleMarquePetite } from "@/components/ui/marques";
import { AideMcpProjet } from "@/components/settings/ConnecteurProjets";
import { GuideApplication } from "@/components/settings/GuideApplication";
import { ServeursPersonnalises } from "@/components/settings/ServeursPersonnalises";
import { guideApplication, guideApplicationLocale } from "@/lib/guidesApplications";
import { branding } from "@/config/branding";
import { cn } from "@/lib/cn";
import { formaterDate } from "@/lib/formats";
import { t, tf } from "@/lib/i18n";

/**
 * Écran des connecteurs.
 *
 * Deux façons de brancher un service, et l'écran dit toujours laquelle
 * s'applique :
 *
 *  - **Se connecter** : le service publie son propre serveur, on l'autorise
 *    dans son navigateur, comme partout ailleurs. Rien à installer, aucun
 *    jeton à trouver. La page d'autorisation est celle du service : Helix ne
 *    voit jamais le mot de passe ;
 *  - **par jeton** : le service n'offre pas cette voie. On colle un jeton, et
 *    un serveur tourne sur la machine de l'instance ;
 *  - **Brancher** (29/09/2026) : une application ouverte sur la machine de
 *    l'instance (Palmier Pro) sert ses outils sur la boucle locale. Un clic,
 *    sans navigateur ni jeton ; l'instance reconnaît l'application avant de
 *    lui parler, et l'écran dit quoi faire quand elle est fermée.
 *
 * Ce que l'écran ne propose pas compte autant : pour un service du
 * catalogue, il n'y a **aucun champ de commande**. Un serveur MCP local est un
 * programme exécuté sur la machine de l'entreprise ; laisser l'interface le
 * choisir reviendrait à offrir l'exécution de code à distance à quiconque
 * atteint la passerelle. La commande vient du catalogue de l'instance, la
 * personne n'apporte que ses identifiants. Depuis le 16/10/2026, une seule
 * exception, plus bas (ServeursPersonnalises.tsx) : l'administrateur, depuis
 * la machine même d'une instance fermée aux collègues, ajoute son propre
 * serveur ; c'est l'instance qui juge et qui refuse.
 */

/** Date d'ajout, dite comme on la dirait à l'oral. */
function depuisLisible(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return formaterDate(date);
}

/**
 * Un service branché par son propre écran : courrier, agenda, Drive, Slack.
 *
 * Ces quatre-là ne sont pas des serveurs du catalogue — ils ont chacun leur
 * panneau de réglages. Ils étaient donc présentés à part, en tuiles, au-dessus
 * de la liste : Gmail apparaissait ainsi deux fois à l'écran, une fois en
 * tuile et une fois dans la liste, et il fallait comprendre que les deux blocs
 * répondaient à la même question. Ils rejoignent la liste, avec leur logo et
 * leur panneau, et la recherche les trouve comme les autres.
 */
export interface ServiceMaison {
  id: string;
  label: string;
  description: string;
  categorie: string;
  marque?: CleMarquePetite;
  icone?: LucideIcon;
  connecte: boolean;
  ouvert: boolean;
  onBasculer: () => void;
  /** Le panneau de réglages, affiché sous la ligne quand elle est ouverte. */
  panneau: ReactNode;
}

/**
 * Le logo d'un service, avec un point d'état posé dessus.
 *
 * Il y avait un point seul, gris ou vert, devant un nom : trente lignes
 * identiques dans lesquelles on cherchait son service en lisant. Le logo se
 * reconnaît sans lire, et le point garde la seule chose qu'il disait — branché,
 * branché mais arrêté, pas branché.
 *
 * Le point est posé devant le logo, plus sur son coin (seconde tournée des
 * logos, 28/09/2026) : les chartes interdisent d'ajouter un élément à un logo
 * ou dans sa zone de protection (GitHub : « combining with other design
 * elements » ; Canva : 8 px libres ; Facebook : une demi-largeur de logo). Le
 * point sur le coin du G de Gmail ou du chat de GitHub faisait exactement cela.
 * L'écart de 12 px (gap-3) entre le point, le logo et le nom, et la marge
 * intérieure de la ligne (14 px), sont le dégagement que LogoMarque reçoit.
 */
function Pastille({
  id,
  etat,
  marque,
  icone,
}: {
  id?: string;
  etat: "actif" | "attention" | "eteint";
  marque?: CleMarquePetite;
  icone?: LucideIcon;
}) {
  const marqueRetenue = marque ?? (id ? MARQUE_DU_CONNECTEUR[id] : undefined);
  const iconeRetenue = icone ?? (id ? ICONE_DU_CONNECTEUR[id] : undefined) ?? ICONE_PAR_DEFAUT;
  return (
    <span className="flex shrink-0 items-center gap-3">
      <span
        className={cn(
          "h-2 w-2 shrink-0 rounded-full",
          etat === "actif" ? "bg-success" : etat === "attention" ? "bg-warning" : "bg-neutral-70",
        )}
      />
      <LogoMarque marque={marqueRetenue} icone={iconeRetenue} taille={22} degagement={12} />
    </span>
  );
}

/** « Réunion » et « reunion » doivent se trouver l'un l'autre. */
const plier = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function Connecteurs({ maison = [] }: { maison?: ServiceMaison[] } = {}) {
  const [etat, setEtat] = useState<EtatConnecteurs | null | undefined>(undefined);
  /** Connecteur dont le formulaire est ouvert (jeton, ou identifiants d'application). */
  const [ouvert, setOuvert] = useState<string | null>(null);
  const [saisie, setSaisie] = useState<Record<string, string>>({});
  const [enCours, setEnCours] = useState(false);
  const [attente, setAttente] = useState<string | null>(null);
  const [retrait, setRetrait] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [succes, setSucces] = useState<string | null>(null);
  const [recherche, setRecherche] = useState("");
  /** Trello, Monday… : l'écriture cochée dans le formulaire (ConnecteurProjets.tsx). */
  const [ecriture, setEcriture] = useState(false);
  const sondage = useRef<ReturnType<typeof setInterval> | null>(null);

  const recharger = useCallback(() => {
    void lireEtat().then(setEtat);
  }, []);

  /**
   * Brancher ou débrancher change aussi la liste des serveurs MCP.
   *
   * Le panneau de Cowork et la puce « Outils » lisent cette liste par `useMcp`,
   * qui a son propre signal. Sans ce relais, retirer un connecteur le faisait
   * disparaître d'un écran tout en le laissant affiché, actif, dans l'autre.
   */
  const signalerAuxServeurs = useCallback(() => {
    window.dispatchEvent(new Event(MCP_CHANGE));
  }, []);

  useEffect(() => {
    recharger();
    window.addEventListener(CONNECTEURS_CHANGE, recharger);
    /*
     * Et dans l'autre sens (28/09/2026) : un serveur éteint par sa bascule, dans
     * « Détail des serveurs » plus bas sur le même écran, restait affiché
     * allumé, vert, avec ses outils, dans la liste des connecteurs.
     */
    window.addEventListener(MCP_CHANGE, recharger);
    return () => {
      window.removeEventListener(CONNECTEURS_CHANGE, recharger);
      window.removeEventListener(MCP_CHANGE, recharger);
    };
  }, [recharger]);

  // Le sondage de l'autorisation en cours s'arrête avec l'écran.
  useEffect(() => () => {
    if (sondage.current) clearInterval(sondage.current);
  }, []);

  const terme = plier(recherche.trim());

  /** Les services maison retenus par la recherche, groupés comme les autres. */
  const maisonParCategorie = useMemo(() => {
    const retenu = (s: ServiceMaison) =>
      !terme || plier(`${s.label} ${s.description} ${s.categorie}`).includes(terme);
    const groupes: { cat: string; services: ServiceMaison[] }[] = [];
    for (const service of maison.filter(retenu)) {
      const existant = groupes.find((g) => g.cat === service.categorie);
      if (existant) existant.services.push(service);
      else groupes.push({ cat: service.categorie, services: [service] });
    }
    return groupes;
  }, [maison, terme]);

  const parCategorie = useMemo(() => {
    if (!etat) return [];
    const retenu = (e: EntreeCatalogue) =>
      !terme || plier(`${e.label} ${e.description} ${e.categorie}`).includes(terme);
    return etat.categories
      .map((cat) => ({
        cat,
        entrees: etat.catalogue.filter((e) => e.categorie === cat && retenu(e)),
      }))
      .filter((g) => g.entrees.length > 0);
  }, [etat, terme]);

  /*
   * Ce qui est livré avec le produit passe devant.
   *
   * Ces serveurs-là sont déjà là et fonctionnent sans rien brancher : les
   * mettre après les services à connecter, c'était faire chercher ce qu'on a
   * déjà. Le groupe est reconnu à l'attribut `integre` et non à son titre, qui
   * est du texte traduit et peut changer.
   */
  const livrees = parCategorie.filter((g) => g.entrees.some((e) => e.integre));
  const aBrancher = parCategorie.filter((g) => !g.entrees.some((e) => e.integre));
  /*
   * Une rubrique, un titre (tournée finale du 28/09/2026). Les services à panneau
   * et ceux du catalogue étaient groupés chacun de leur côté : une même rubrique
   * pouvait donc s'afficher deux fois, et le commerce était réparti sous trois
   * titres (Stripe d'un côté, HubSpot et PayPal de l'autre). Les entrées du
   * catalogue rejoignent la rubrique de même nom des services à panneau, sous
   * eux ; le titre est le texte traduit, le même des deux côtés (contrôlé par
   * npm run securite, 18 bis).
   */
  const rubriques = [
    ...maisonParCategorie.map(({ cat, services }) => ({
      cat,
      services,
      entrees: aBrancher.find((g) => g.cat === cat)?.entrees ?? [],
    })),
    ...aBrancher
      .filter((g) => !maisonParCategorie.some((m) => m.cat === g.cat))
      .map(({ cat, entrees }) => ({ cat, services: [] as ServiceMaison[], entrees })),
  ];

  if (etat === undefined) {
    return (
      <Card className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
        <Loader2 size={16} className="animate-spin" />{" "}{t("Lecture des connecteurs...")}
      </Card>
    );
  }

  if (etat === null) {
    return (
      <InfoBox tone="warning" leading={<Info size={15} strokeWidth={1.75} />}>
        {t("Instance injoignable. Les connecteurs vivent dans l'instance : sans elle, rien ne peut être branché ni retiré.")}
      </InfoBox>
    );
  }

  const installe = (id: string) => etat.installes.find((c) => c.id === id);

  const ouvrir = (entree: EntreeCatalogue) => {
    setOuvert(entree.id);
    setSaisie(
      entree.oauth === "appli"
        ? { clientId: "", clientSecret: "" }
        : entree.local || entree.lanceur
          ? {}
          : Object.fromEntries(entree.secrets.map((s) => [s.nom, ""])),
    );
    setEcriture(false);
    setErreur(null);
    setSucces(null);
  };

  const fermer = () => {
    setOuvert(null);
    // Les secrets saisis ne survivent pas à la fermeture du formulaire : ils
    // n'ont aucune raison de rester en mémoire du navigateur.
    setSaisie({});
  };

  /**
   * Attend le retour de l'autorisation.
   *
   * La personne autorise dans son navigateur, hors de l'application : c'est
   * l'instance qui reçoit le retour. On relit donc son état jusqu'à ce que le
   * service apparaisse branché, plutôt que de demander à la personne de
   * rafraîchir elle-même.
   */
  const attendreRetour = (id: string) => {
    setAttente(id);
    if (sondage.current) clearInterval(sondage.current);
    let tours = 0;
    sondage.current = setInterval(() => {
      tours += 1;
      void lireEtat().then((suite) => {
        if (!suite) return;
        setEtat(suite);
        /*
         * Un refus dans la page du service, ou un échec après l'accord
         * (28/09/2026) : l'instance le dit, et on cesse d'attendre. Sans cela,
         * « En attente de votre accord… » restait cinq minutes, puis le bouton
         * revenait sans un mot. L'instance efface l'issue précédente quand
         * « Se connecter » est cliqué (connecteurs.ts, `connecter`) : celle
         * qu'on lit ici est donc celle de ce clic.
         */
        const issue = suite.issues?.[id];
        if (issue && !issue.ok) {
          if (sondage.current) clearInterval(sondage.current);
          sondage.current = null;
          setAttente(null);
          setSucces(null);
          setErreur(issue.message);
          return;
        }
        const vivant = suite.installes.find((c) => c.id === id);
        if (vivant?.running || tours > 150) {
          if (sondage.current) clearInterval(sondage.current);
          sondage.current = null;
          setAttente(null);
          if (vivant?.running) {
            setSucces(tf("{0} est branché : {1} outil(s) disponibles.", vivant.label, vivant.toolCount));
            signalerAuxServeurs();
          }
        }
      });
    }, 2000);
  };

  const seConnecter = async (entree: EntreeCatalogue) => {
    setEnCours(true);
    setErreur(null);
    setSucces(null);
    const resultat = await autoriser(
      entree.id,
      entree.oauth === "appli"
        ? { clientId: saisie.clientId ?? "", clientSecret: saisie.clientSecret ?? "" }
        : undefined,
      entree.ecritureAuChoix ? ecriture : undefined,
    );
    setEnCours(false);
    if (!resultat.ok) {
      // Un service qui réclame une application, ou une application locale fermée : on ouvre le panneau et son pas à pas.
      // Déjà branchée (« Réessayer ») : le message seul, en tête de l'écran ; la ligne n'a pas de panneau à refermer.
      if ((entree.oauth === "appli" || ((entree.local || entree.lanceur) && !installe(entree.id))) && ouvert !== entree.id) ouvrir(entree);
      /*
       * Après `ouvrir`, qui efface le message (revérification du 28/09/2026) :
       * posé avant, il disparaissait aussitôt, et avec lui l'adresse de retour
       * à déclarer chez le service, que le formulaire annonce « dans le
       * message ci-dessous ». Sans elle, impossible de créer l'application.
       */
      setErreur(resultat.message);
      return;
    }
    if (resultat.etat) setEtat(resultat.etat);
    if (resultat.pret) {
      setSucces(resultat.message);
      fermer();
      signalerAuxServeurs();
      return;
    }
    if (resultat.adresse) {
      fermer();
      setSucces(
        tf("Autorisez {0} dans la fenêtre qui vient de s'ouvrir, puis revenez ici.", entree.label),
      );
      // Le navigateur du système, jamais une fenêtre de l'application : la
      // page d'autorisation est celle du service, et doit le rester.
      window.open(resultat.adresse, "_blank", "noopener,noreferrer");
      attendreRetour(entree.id);
    }
  };

  const soumettreJeton = async (entree: EntreeCatalogue) => {
    setEnCours(true);
    setErreur(null);
    setSucces(null);
    const resultat = await brancher(entree.id, saisie);
    setEnCours(false);
    if (resultat.ok) {
      setSucces(resultat.message);
      fermer();
      if (resultat.etat) setEtat(resultat.etat);
      signalerAuxServeurs();
    } else {
      setErreur(resultat.message);
    }
  };

  const retirerConnecteur = async (id: string) => {
    setRetrait(id);
    setErreur(null);
    setSucces(null);
    const resultat = await debrancher(id);
    setRetrait(null);
    if (resultat.ok) {
      setSucces(resultat.message);
      if (resultat.etat) setEtat(resultat.etat);
      signalerAuxServeurs();
    } else {
      setErreur(resultat.message);
    }
  };

  /** Une ligne de service maison : même dessin que les autres, panneau dessous. */
  // `id` : une autre ligne peut mener à celle-ci et l'amener à l'écran (Page d'entreprise LinkedIn, 29/09/2026).
  const ligneMaison = (service: ServiceMaison) => (
    <div key={service.id} id={`connecteur-${service.id}`} className="rounded-xl border border-border">
      <button
        type="button"
        onClick={service.onBasculer}
        aria-expanded={service.ouvert}
        className="flex w-full flex-wrap items-center gap-3 rounded-xl p-3.5 text-start transition-colors hover:bg-muted"
      >
        <Pastille
          etat={service.connecte ? "actif" : "eteint"}
          marque={service.marque}
          icone={service.icone}
        />
        <span className="min-w-[9rem] flex-1">
          <span className="block text-sm font-medium text-foreground">{service.label}</span>
          <span className="block text-xs text-muted-foreground">{service.description}</span>
        </span>
        <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
          {service.connecte ? t("Connecté") : t("Connecter")}
        </span>
      </button>
      {service.ouvert && <div className="border-t border-border p-3.5 max-sm:p-2">{service.panneau}</div>}
    </div>
  );

  const ligne = (entree: EntreeCatalogue) => {
    const vivant = installe(entree.id);
    /*
     * Le serveur de fichiers est livré avec Helix : il apparaît ici comme les
     * autres, mais sans bouton. Le masquer laisserait croire que l'agent n'a
     * accès à rien tant qu'on n'a rien branché.
     */
    const branche = entree.integre || Boolean(vivant);
    const actif = entree.integre ? true : (vivant?.running ?? false);
    const distant = Boolean(entree.url);
    // Une application ouverte sur la machine de l'instance (Palmier Pro, 29/09/2026).
    // Et Roblox Studio, Blender (12/10/2026) : installées sur la machine, leur serveur lancé par l'instance.
    const local = Boolean(entree.local || entree.lanceur);

    return (
      <div key={entree.id} className="rounded-xl border border-border">
        <div className="flex flex-wrap items-center gap-3 p-3.5">
          <Pastille
            id={entree.id}
            etat={branche && actif ? "actif" : branche ? "attention" : "eteint"}
          />
          {/*
            Une largeur minimale (28/09/2026) : sous 400 px, le texte se réduisait à un mot par
            ligne et passait sous le bouton ; avec elle, c'est le bouton qui va à la ligne.
          */}
          <div className="min-w-[9rem] flex-1">
            <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
              {entree.label}
              {!entree.integre && (
                <span
                  className="text-muted-foreground"
                  title={
                    distant
                      ? t("Service distant : rien ne s'installe sur cette machine.")
                      : entree.id === "rea"
                        ? t("Outil local installé au premier branchement, avec ses dépendances verrouillées.")
                        : entree.lanceur
                        ? t("Application installée sur la machine de l'instance, dont l'instance lance le serveur d'outils.")
                        : local
                          ? t("Application ouverte sur la machine de l'instance, reliée par la boucle locale.")
                          : t("Serveur exécuté sur la machine de l'instance.")
                  }
                >
                  {distant ? (
                    <Globe size={12} strokeWidth={1.75} />
                  ) : local ? (
                    <Laptop size={12} strokeWidth={1.75} />
                  ) : (
                    <Terminal size={12} strokeWidth={1.75} />
                  )}
                </span>
              )}
            </p>
            <p className="text-xs text-muted-foreground">{entree.description}</p>
            {vivant?.error && <p className="mt-1 text-xs text-destructive">{vivant.error}</p>}
            {vivant && !vivant.error && (
              <p className="mt-1 text-xs text-muted-foreground">
                {vivant.toolCount}{" "}{t("outil(s)")}
                {vivant.depuis && tf(" · connecté le {0}", depuisLisible(vivant.depuis))}
              </p>
            )}
            {!vivant && entree.oauth === "auto" && (
              <p className="mt-1 text-xs text-muted-foreground">
                {t("Un clic : vous autorisez chez")}{" "}{entree.label}{t(", rien n'est à installer.")}
              </p>
            )}
            {!vivant && local && (
              <p className="mt-1 text-xs text-muted-foreground">
                {t("Un clic, quand l'application est ouverte sur la machine de l'instance.")}
              </p>
            )}
            {!vivant && entree.oauth === "appli" && (
              <p className="mt-1 text-xs text-muted-foreground">
                {t("Demande une application déclarée chez")}{" "}{entree.label}{t(", une seule fois.")}
              </p>
            )}
          </div>

          {entree.integre ? (
            <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
              {tf("Livré avec {0}", branding.name)}
            </span>
          ) : vivant ? (
            <span className="flex shrink-0 flex-wrap items-center gap-1">
              {/* L'application a été fermée, puis rouverte : un clic la rebranche, sans la retirer. */}
              {local && !vivant.running && (
                <Button
                  variant="secondary"
                  size="sm"
                  icon={enCours ? Loader2 : RotateCw}
                  disabled={enCours}
                  onClick={() => void seConnecter(entree)}
                >
                  {t("Réessayer")}
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                icon={retrait === entree.id ? Loader2 : Trash2}
                disabled={retrait === entree.id}
                onClick={() => void retirerConnecteur(entree.id)}
              >
                {retrait === entree.id ? t("Retrait...") : t("Retirer")}
              </Button>
            </span>
          ) : attente === entree.id ? (
            <Button variant="ghost" size="sm" icon={Loader2} disabled>
              {t("En attente de votre accord...")}
            </Button>
          ) : ouvert === entree.id ? (
            <Button variant="ghost" size="sm" icon={X} onClick={fermer}>
              {t("Annuler")}
            </Button>
          ) : local ? (
            // Ni navigateur ni jeton : rien à chiffrer, le bouton ne dépend pas du trousseau.
            <Button
              variant="secondary"
              size="sm"
              icon={enCours ? Loader2 : Plug}
              disabled={enCours}
              onClick={() => void seConnecter(entree)}
            >
              {t("Brancher")}
            </Button>
          ) : distant ? (
            <Button
              variant="secondary"
              size="sm"
              icon={enCours ? Loader2 : ExternalLink}
              disabled={enCours || !etat.chiffrementDonnees}
              // Trello, Monday… : d'abord le formulaire, qui dit ce qui se passe et propose l'écriture.
              onClick={() => (entree.ecritureAuChoix ? ouvrir(entree) : void seConnecter(entree))}
            >
              {t("Se connecter")}
            </Button>
          ) : (
            <Button variant="secondary" size="sm" icon={Plus} onClick={() => ouvrir(entree)}>
              {t("Connecter")}
            </Button>
          )}
        </div>

        {ouvert === entree.id && (
          <form
            className="space-y-3 border-t border-border p-3.5 max-sm:p-2"
            onSubmit={(event) => {
              event.preventDefault();
              if (entree.oauth === "appli" || entree.ecritureAuChoix || local) void seConnecter(entree);
              else void soumettreJeton(entree);
            }}
          >
            {entree.ecritureAuChoix && <AideMcpProjet id={entree.id} nom={entree.label} />}
            {local ? (
              guideApplicationLocale(entree.id) && (
                <GuideApplication guide={guideApplicationLocale(entree.id)!} titre={tf("Brancher {0}, pas à pas", entree.label)} />
              )
            ) : entree.oauth === "appli" ? (
              <>
                {/*
                 * 28/09/2026 (Medhi : « tout doit être simple, pour tout ») : l'adresse de
                 * retour n'était donnée que dans le message d'un premier essai manqué, et
                 * la console qu'en lien discret sous le formulaire. Le guide ouvre la page
                 * exacte de création, dit les étapes dans l'ordre de la console, et porte
                 * l'adresse de retour, copiable, dans l'étape où on la colle.
                 */}
                {guideApplication(entree.id) ? (
                  <GuideApplication
                    guide={guideApplication(entree.id)!}
                    retour={etat.retours?.[entree.id] ?? etat.retour}
                    noteRetour={t("C'est l'adresse par laquelle ce navigateur atteint l'instance. Si le service exige https, ouvrez l'instance par une adresse en https.")}
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {entree.label}{" "}{t("veut connaître l'application qui demande l'accès. Créez-la une fois chez eux, indiquez comme adresse de retour celle que l'instance vous donnera dans le message ci-dessous, puis collez son identifiant. Ensuite, « Se connecter » suffira à tout le monde.")}
                  </p>
                )}
                <Field label={t("Identifiant de l'application (client ID)")} hint={guideApplication(entree.id)?.champs?.identifiant} required>
                  <Input
                    autoComplete="off"
                    value={saisie.clientId ?? ""}
                    onChange={(e) => setSaisie((s) => ({ ...s, clientId: e.target.value }))}
                  />
                </Field>
                <Field label={t("Secret de l'application (si le service en donne un)")} hint={guideApplication(entree.id)?.champs?.secret}>
                  <Input
                    type="password"
                    autoComplete="off"
                    value={saisie.clientSecret ?? ""}
                    onChange={(e) => setSaisie((s) => ({ ...s, clientSecret: e.target.value }))}
                  />
                </Field>
              </>
            ) : (
              <>
                {entree.secrets.map((champ) => (
                  <Field key={champ.nom} label={champ.libelle} hint={champ.aide} required>
                    <Input
                      type="password"
                      autoComplete="off"
                      value={saisie[champ.nom] ?? ""}
                      onChange={(event) =>
                        setSaisie((s) => ({ ...s, [champ.nom]: event.target.value }))
                      }
                      placeholder={t("Collez le jeton ici")}
                    />
                  </Field>
                ))}
                {entree.secrets.length === 0 && !entree.ecritureAuChoix && (
                  <p className="text-sm text-muted-foreground">
                    {t("Ce connecteur ne demande aucun identifiant.")}
                  </p>
                )}
              </>
            )}

            {entree.ecritureAuChoix && (
              <label className="flex items-start gap-2 text-sm text-foreground">
                <input type="checkbox" className="mt-1" checked={ecriture} onChange={(e) => setEcriture(e.target.checked)} />
                <span>
                  {tf("Permettre aussi d'écrire dans {0}.", entree.label)}{" "}
                  <span className="text-muted-foreground">{t("Chaque écriture vous sera montrée en entier et demandera votre accord.")}</span>
                </span>
              </label>
            )}

            {erreur && (
              <InfoBox tone="warning" leading={<Info size={15} strokeWidth={1.75} />}>
                {erreur}
              </InfoBox>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="submit"
                size="sm"
                icon={enCours ? Loader2 : Check}
                disabled={enCours || (!local && !etat.chiffrementDonnees)}
              >
                {enCours ? t("Connexion...") : local ? t("Brancher") : entree.ecritureAuChoix ? t("Se connecter") : t("Connecter")}
              </Button>
              {(entree.console ?? entree.documentation) && (
                <a
                  href={entree.console ?? entree.documentation}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  <ExternalLink size={14} strokeWidth={1.75} />
                  {/*
                    Un service qui ne demande rien (Mémoire, Réflexion, Navigateur, Documentation des
                    bibliothèques) n'a pas de jeton à trouver : son lien mène à sa documentation
                    (tournée finale du 28/09/2026 ; « Où trouver mon jeton » y menait vers modelcontextprotocol.io).
                  */}
                  {entree.oauth === "appli"
                    ? t("Créer l'application")
                    : entree.ecritureAuChoix || entree.secrets.length === 0
                      ? t("Documentation du service")
                      : t("Où trouver mon jeton")}
                </a>
              )}
            </div>
          </form>
        )}
      </div>
    );
  };

  return (
    <>
      {/*
        Le chiffrement conditionne l'enregistrement d'un jeton : l'annoncer ici
        évite de laisser quelqu'un remplir un formulaire que l'instance
        refusera de toute façon.
      */}
      {!etat.chiffrementDonnees && (
        <InfoBox
          tone="warning"
          className="mb-4"
          leading={<ShieldAlert size={15} strokeWidth={1.75} />}
        >
          {tf("Le chiffrement des données n'est pas actif sur cette instance : {0} refusera d'enregistrer un jeton d'accès. Déverrouillez le trousseau du compte hôte, ou réglez « chiffrement » sur « fichier » dans le profil de déploiement.", branding.name)}
        </InfoBox>
      )}

      {succes && (
        <InfoBox className="mb-4" leading={<Check size={15} strokeWidth={2} />}>
          {succes}
        </InfoBox>
      )}
      {erreur && !ouvert && (
        <InfoBox tone="warning" className="mb-4" leading={<Info size={15} strokeWidth={1.75} />}>
          {erreur}
        </InfoBox>
      )}

      {/* 375 px (28/09/2026) : quatre cadres imbriqués ne laissaient qu'une soixantaine de pixels aux étapes des guides ; les marges se resserrent. */}
      <Card className="max-sm:p-3">
        <h3 className="flex items-center gap-2 text-lg font-semibold text-foreground">
          <Blocks size={18} strokeWidth={1.75} />{" "}{t("Services connectés")}
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("Chaque service branché ajoute ses outils à vos agents, dans le Chat comme dans Cowork. Un service branché l'est pour toute l'instance.")}
        </p>

        <div className="mt-4">
          <SearchInput
            placeholder={t("Chercher un service...")}
            aria-label={t("Chercher un service")}
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
          />
        </div>

        {parCategorie.length === 0 && maisonParCategorie.length === 0 && (
          <p className="mt-4 text-sm text-muted-foreground">
            {t("Aucun service ne correspond à votre recherche.")}
          </p>
        )}

        {/* D'abord ce qui marche déjà, ensuite ce qui se branche. */}
        {livrees.map(({ cat, entrees }) => (
          <div key={cat} className="mt-5">
            <p className="px-1 pb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {cat}
            </p>
            <div className="space-y-2">{entrees.map(ligne)}</div>
          </div>
        ))}

        {/*
         * Puis les services à panneau, avec les entrées du catalogue de leur
         * rubrique : ce sont ceux que presque tout le monde branche, et ceux
         * qu'on vient chercher en arrivant. Enfin, le reste du catalogue.
         */}
        {rubriques.map(({ cat, services, entrees }) => (
          <div key={cat} className="mt-5">
            <p className="px-1 pb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {cat}
            </p>
            <div className="space-y-2">
              {services.map(ligneMaison)}
              {entrees.map(ligne)}
            </div>
          </div>
        ))}

        {/*
          Connecteurs hors catalogue : ils n'existent que si l'intégrateur les a
          posés dans le profil de déploiement, et ils ne se retirent pas moins
          facilement pour autant.
        */}
        {etat.installes
          // Les serveurs ajoutés par l'administrateur ont leur propre carte, plus bas (16/10/2026).
          .filter((c) => !etat.catalogue.some((e) => e.id === c.id) && !c.personnalise)
          .map((c) => (
            <div key={c.id} className="mt-2 rounded-xl border border-border">
              <div className="flex flex-wrap items-center gap-3 p-3.5">
                <span
                  className={cn(
                    "h-2 w-2 shrink-0 rounded-full",
                    c.running ? "bg-success" : "bg-warning",
                  )}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">{c.label}</p>
                  <p className="text-xs text-muted-foreground">{c.description}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {c.toolCount}{" "}{t("outil(s) · ajouté hors catalogue par l'intégrateur")}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  icon={retrait === c.id ? Loader2 : Trash2}
                  disabled={retrait === c.id}
                  onClick={() => void retirerConnecteur(c.id)}
                >
                  {retrait === c.id ? t("Retrait...") : t("Retirer")}
                </Button>
              </div>
            </div>
          ))}
      </Card>

      <ServeursPersonnalises etat={etat} surEtat={setEtat} surChangement={signalerAuxServeurs} />

      <InfoBox className="mt-4" leading={<Lock size={15} strokeWidth={1.75} />}>
        {/* Une troisième façon depuis le 29/09/2026 (Palmier Pro), dite seulement là où elle est proposée. */}
        {etat.catalogue.some((e) => e.local || e.lanceur)
          ? t("Trois façons de brancher, et aucune ne passe par un tiers.")
          : t("Deux façons de brancher, et aucune ne passe par un tiers.")}{" "}
        <strong className="font-medium">{t("Se connecter")}</strong>{" "}{t("vous envoie chez le service, qui vous demande votre accord ; le jeton revient chiffré dans l'instance et n'en sort plus.")}{" "}<strong className="font-medium">{t("Par jeton")}</strong>{" "}{tf("lance un serveur sur la machine de l'instance : {0} ne lance que la commande de son catalogue, jamais une commande venue de ce formulaire, et le jeton est transmis par l'environnement, sans jamais apparaître dans la liste des processus.", branding.name)}
        {etat.catalogue.some((e) => e.local || e.lanceur) && (
          <>
            {" "}
            <strong className="font-medium">{t("Brancher")}</strong>{" "}
            {/* Roblox Studio et Blender (12/10/2026) : leur serveur se lance sur la machine, il ne passe pas toujours par la boucle locale. */}
            {etat.catalogue.some((e) => e.lanceur)
              ? t("relie une application installée sur la machine de l'instance : son serveur d'outils est pris dans l'installation de l'application elle-même, jamais une commande venue de cet écran.")
              : t("relie une application ouverte sur la machine de l'instance, par la boucle locale, après avoir vérifié que c'est bien elle qui répond.")}
          </>
        )}
        {etat.commandeLibre && (
          <>
            {" "}
            {t("Cette instance a été réglée pour accepter aussi des serveurs internes définis par l'intégrateur.")}
          </>
        )}
      </InfoBox>
    </>
  );
}

export default Connecteurs;
