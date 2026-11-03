import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Zap,
  Wand2,
  Telescope,
  Check,
  Cpu,
  ChartScatter,
  Gauge,
  CircleAlert,
  Loader2,
  Cloud,
  Plus,
  Download,
  ChevronLeft,
  ChevronRight,
  Boxes,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Chip } from "@/components/ui/Chip";
import { SearchInput } from "@/components/ui/SearchInput";
import { LogoMarque } from "@/components/settings/TuileService";
import { ComparerModeles } from "@/components/chat/ComparerModeles";
import { noteDuModeleServi } from "../../../gateway/src/notesModeles.ts";
import { branding } from "@/config/branding";
import { marqueDuModele } from "@/components/settings/marquesConnecteurs";
import { Popover } from "@/components/ui/Popover";
import { cn } from "@/lib/cn";
import { useModels } from "@/hooks/useModels";
import { lieuDuModele } from "@/lib/fournisseurs";
import type { GatewayModel } from "@/lib/gateway";
import { enumerer, locale, t, taille, tf } from "@/lib/i18n";
import {
  installerModele,
  lireInstallables,
  type EtatInstallation,
  type ModeleInstallable,
} from "@/lib/installables";

/** Groupes du sélecteur : d'où vient le modèle, et donc où partent les messages. */
const GROUPES: { titre: string; garde: (m: GatewayModel) => boolean }[] = [
  { titre: t("Sur vos machines"), garde: (m) => !m.origine || m.origine === "local" },
  { titre: t("Fournis par votre prestataire"), garde: (m) => m.origine === "agence" },
  { titre: t("Vos clés"), garde: (m) => m.origine === "cle" && Boolean(m.proprietaire) },
  { titre: t("Clés de l'équipe"), garde: (m) => m.origine === "cle" && !m.proprietaire },
];

function formatSize(bytes?: number): string | null {
  if (!bytes) return null;
  return taille(bytes);
}

/* --- Drapeaux et logos ----------------------------------------------------- */

/*
 * Le drapeau du pays d'hébergement. Il n'est pas décoratif : c'est la seule
 * information qui dit, d'un coup d'œil, si la question va sortir d'Europe.
 * Un modèle de la machine n'a pas de pays, il a un ordinateur.
 */
const DRAPEAUX: Record<string, string> = {
  France: "🇫🇷",
  Allemagne: "🇩🇪",
  Belgique: "🇧🇪",
  Suisse: "🇨🇭",
  "Pays-Bas": "🇳🇱",
  Irlande: "🇮🇪",
  "Royaume-Uni": "🇬🇧",
  "États-Unis": "🇺🇸",
  Chine: "🇨🇳",
};

function drapeau(m: GatewayModel): string | null {
  if (m.origine !== "cle" && m.origine !== "agence") return null;
  return m.pays ? (DRAPEAUX[m.pays] ?? null) : null;
}

/* --- Modèle qui a mal répondu sur cette machine ---------------------------- */

/**
 * Ce que le sélecteur dit d'un modèle qui a mal répondu sur la machine de
 * l'instance (27/09/2026, gateway/src/santeModeles.ts). Choisissable quand
 * même : la personne sait alors à quoi s'attendre.
 */
function avertissementMachine(m: GatewayModel): { court: string; long: string } | null {
  const s = m.surCetteMachine;
  if (!s) return null;
  const jour = new Date(s.date).toLocaleDateString(locale());
  if (s.etat === "douteux") {
    return {
      court: t("une réponse en boucle ici"),
      long: tf("Une de ses réponses est partie en boucle sur cette machine le {0}. À la deuxième, il ne sera plus choisi d'office.", jour),
    };
  }
  const raisons: Record<string, string> = {
    vide: t("réponse d'essai vide"),
    boucle: t("réponse d'essai en boucle"),
    signes: t("réponse d'essai faite de signes"),
    alphabet: t("réponse d'essai dans un autre alphabet"),
    coupures: t("deux réponses parties en boucle"),
  };
  return {
    court: t("répond mal sur cette machine"),
    long: tf(
      "Ne répond pas correctement sur cette machine ({0}, le {1}) : il n'est plus choisi d'office. Vous pouvez le choisir quand même.",
      raisons[s.raison ?? ""] ?? t("réponse illisible"),
      jour,
    ),
  };
}

/* --- Choix « Rapide » et « Approfondi » ------------------------------------ */

/**
 * Le poids d'un modèle, en milliards de paramètres.
 *
 * Sert de mesure de rapidité faute de mieux : à moteur égal, un modèle deux
 * fois plus petit répond à peu près deux fois plus vite. C'est grossier, et
 * c'est pourquoi l'écran **nomme** le modèle retenu au lieu de se contenter
 * de dire « rapide » : la personne voit sur quoi elle tombe.
 */
function poids(m: GatewayModel): number {
  const params = m.params ? Number.parseFloat(m.params.replace(",", ".")) : NaN;
  if (Number.isFinite(params)) return params;
  if (m.sizeBytes) return m.sizeBytes / 1e9;
  return Number.POSITIVE_INFINITY;
}

/** Le plus léger : celui qui répondra le plus vite. */
function leRapide(models: GatewayModel[]): GatewayModel | undefined {
  return [...models].sort((a, b) => poids(a) - poids(b))[0];
}

/**
 * Le plus capable : la note ECI d'Epoch AI si elle existe, le poids sinon.
 *
 * Les deux ne se comparent pas entre eux — un modèle noté passe toujours
 * devant un modèle non noté, plutôt que de mélanger une note ECI et
 * des milliards de paramètres dans un même calcul, ce qui n'aurait aucun sens.
 */
function leCapable(models: GatewayModel[]): GatewayModel | undefined {
  const note = (m: GatewayModel) => noteDuModeleServi(m)?.eci;
  const notes = models.filter((m) => note(m) !== undefined);
  if (notes.length > 0) {
    return [...notes].sort((a, b) => (note(b) ?? 0) - (note(a) ?? 0))[0];
  }
  const pesables = models.filter((m) => Number.isFinite(poids(m)));
  return [...pesables].sort((a, b) => poids(b) - poids(a))[0] ?? models[0];
}

/* --- Sélecteur de modèle --------------------------------------------------- */

/**
 * Un seul panneau : une recherche, trois raccourcis, tous les modèles.
 *
 * ── Ce qui a changé, et pourquoi ────────────────────────────────────────────
 *
 * Il y avait deux panneaux — « comportement », puis « modèle précis » derrière
 * un chevron. Deux défauts, tous deux constatés à l'usage :
 *
 *  1. **les raccourcis ne disaient pas ce qu'ils faisaient.** « Rapide » ne
 *     nommait aucun modèle : on choisissait une promesse. Chaque raccourci
 *     montre maintenant le modèle qu'il retient, avec son logo et le drapeau du
 *     pays qui l'héberge ;
 *  2. **ils réglaient le mauvais bouton.** « Rapide » et « Approfondi »
 *     écrivaient le niveau d'effort, celui-là même que règle la puce
 *     « Raisonnement » à côté. Deux commandes pour une seule valeur, avec deux
 *     vocabulaires différents : régler l'une décochait l'autre. Les raccourcis
 *     choisissent désormais un **modèle**, ce qu'ils ont toujours prétendu
 *     faire, et l'effort reste au bouton d'effort.
 *
 * La liste des modèles n'est plus cachée : avec une clé cloud branchée, elle
 * passe la dizaine d'entrées, et une recherche vaut mieux qu'un défilement.
 */
export function ModelBehaviorPicker({
  value,
  onChange,
}: {
  value?: string;
  onChange?: (uid?: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [recherche, setRecherche] = useState("");
  const [comparer, setComparer] = useState(false);
  const [vue, setVue] = useState<"liste" | "installer">("liste");
  // Changer de vue repart du haut : le panneau défile, et garderait sinon la position de l'autre vue.
  const haut = useRef<HTMLDivElement>(null);
  useEffect(() => {
    haut.current?.closest(".overflow-y-auto")?.scrollTo({ top: 0 });
  }, [vue]);
  const navigate = useNavigate();
  const { models, loading, error, refresh } = useModels();

  /*
   * Modèles qu'on peut encore ajouter, adaptés à la machine. Lus à l'ouverture
   * du panneau ; pendant une installation, l'état est relu chaque seconde et
   * la liste des modèles rafraîchie à la fin.
   */
  const [installables, setInstallables] = useState<ModeleInstallable[]>([]);
  const [installation, setInstallation] = useState<EtatInstallation | undefined>();
  // Des modèles s'installent sur cette machine (pas d'intégrateur qui les prépare) : la page « Modèles » a un sens.
  const [catalogueLocal, setCatalogueLocal] = useState(false);
  const enCours = installation && ["checking", "downloading", "loading"].includes(installation.phase);
  useEffect(() => {
    if (!open && !enCours) return;
    let actif = true;
    const lire = () =>
      lireInstallables()
        .then(({ liste, etat, local }) => {
          if (!actif) return;
          setInstallables(liste);
          setCatalogueLocal(local);
          setInstallation((avant) => {
            const avantEnCours = avant && ["checking", "downloading", "loading"].includes(avant.phase);
            if (avantEnCours && etat && !["checking", "downloading", "loading"].includes(etat.phase)) refresh();
            return etat;
          });
        })
        .catch(() => {});
    void lire();
    const minuterie = enCours ? window.setInterval(lire, 1000) : undefined;
    return () => {
      actif = false;
      if (minuterie) window.clearInterval(minuterie);
    };
  }, [open, enCours, refresh]);

  const selected = models.find((m) => m.uid === value);
  /*
   * Un modèle choisi qui n'est plus servi (moteur éteint, clé retirée) reste
   * celui qui part avec la question : la puce le dit (27/09/2026). Elle
   * affichait « Auto », et la réponse revenait refusée pour un autre modèle
   * que celui qu'on croyait choisi.
   */
  const label =
    selected?.id ??
    (loading ? t("Chargement...") : error ? t("Hors ligne") : value ? tf("{0} (indisponible)", value.split("/").pop() ?? value) : t("Auto"));

  /*
   * Les raccourcis ne proposent jamais un modèle entraîné sur la machine, ni
   * un modèle qui a mal répondu sur elle (27/09/2026) : ils restent dans la
   * liste, à choisir soi-même.
   */
  const pourConverser = useMemo(
    () => models.filter((m) => m.roles.includes("chat") && !m.entraine && m.surCetteMachine?.etat !== "defaillant"),
    [models],
  );
  const rapide = useMemo(() => leRapide(pourConverser), [pourConverser]);
  const capable = useMemo(() => leCapable(pourConverser), [pourConverser]);

  const terme = recherche.trim().toLowerCase();
  const filtres = useMemo(
    () =>
      terme
        ? models.filter((m) =>
            `${m.id} ${m.fournisseur ?? ""} ${m.backendLabel} ${m.pays ?? ""}`.toLowerCase().includes(terme),
          )
        : models,
    [models, terme],
  );

  /** Une ligne de modèle : logo, nom, provenance, drapeau. */
  const ligneModele = (m: GatewayModel) => {
    const isSelected = m.uid === value;
    const size = formatSize(m.sizeBytes);
    const lieu = lieuDuModele(m);
    const pavillon = drapeau(m);
    const avertissement = avertissementMachine(m);
    return (
      <button
        key={m.uid}
        type="button"
        title={avertissement?.long}
        onClick={() => {
          onChange?.(m.uid);
          setOpen(false);
        }}
        className={cn(
          "flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-start transition-colors hover:bg-muted",
          isSelected && "bg-muted",
        )}
      >
        <LogoMarque marque={marqueDuModele(m.id)} icone={Cpu} taille={18} degagement={8} />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-sm font-medium text-foreground">{m.id}</span>
            {m.loaded && (
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-success" title={t("Chargé en mémoire")} />
            )}
          </span>
          <span className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
            {lieu && <Cloud size={11} strokeWidth={2} className="shrink-0" />}
            {m.fournisseur ?? m.backendLabel}
            {lieu && <span>· {lieu.replace("Cloud · ", "")}</span>}
            {m.params && <span>· {m.params}</span>}
            {size && <span>· {size}</span>}
            {m.reasoning && <span>{t("· raisonnement")}</span>}
          </span>
          {avertissement && (
            <span className="flex items-center gap-1 text-[11px] text-warning">
              <CircleAlert size={11} strokeWidth={2} className="shrink-0" />
              <span className="truncate">{avertissement.court}</span>
            </span>
          )}
        </span>
        {pavillon && <span className="shrink-0 text-base leading-none">{pavillon}</span>}
        {isSelected && <Check size={16} strokeWidth={2} className="shrink-0 text-foreground" />}
      </button>
    );
  };

  /** Un raccourci : ce qu'il fait, et le modèle qu'il retient. */
  const raccourci = (
    id: string,
    Icone: LucideIcon,
    titre: string,
    sousTitre: string,
    modele: GatewayModel | undefined,
    recommande?: boolean,
  ) => {
    const choisi = modele ? value === modele.uid : value === undefined;
    return (
      <button
        key={id}
        type="button"
        onClick={() => {
          onChange?.(modele?.uid);
          setOpen(false);
        }}
        disabled={id !== "auto" && !modele}
        className="flex w-full items-start gap-2.5 rounded-lg px-2 py-2 text-start transition-colors hover:bg-muted disabled:opacity-50"
      >
        <Icone size={16} strokeWidth={1.75} className="mt-0.5 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground">{titre}</span>
            {recommande && (
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                {t("Recommandé")}
              </span>
            )}
          </span>
          {modele ? (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <LogoMarque marque={marqueDuModele(modele.id)} icone={Cpu} taille={13} degagement={6} />
              <span className="truncate">{modele.id}</span>
              {drapeau(modele) && <span className="leading-none">{drapeau(modele)}</span>}
            </span>
          ) : (
            <span className="block text-xs text-muted-foreground">{sousTitre}</span>
          )}
        </span>
        {choisi && <Check size={16} strokeWidth={2} className="mt-0.5 shrink-0 text-foreground" />}
      </button>
    );
  };

  return (
    <>
      <Popover
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (o) {
            refresh();
            setRecherche("");
            setVue("liste");
          }
        }}
        align="end"
        width={360}
        trigger={(p) => (
          <Chip
            leading={<Zap size={15} strokeWidth={1.75} />}
            onClick={p.onClick}
            active={open}
            aria-expanded={p["aria-expanded"]}
          >
            {label}
          </Chip>
        )}
      >
        {vue === "installer" ? (
          /*
           * Sous-menu : les modèles qu'on peut ajouter, adaptés à la machine.
           * À part de la liste principale, qui ne montre que ce qu'on a déjà.
           */
          <div ref={haut}>
            <div className="sticky -top-1.5 z-10 -mx-1.5 -mt-1.5 flex items-center gap-1 bg-popover px-1.5 pb-1.5 pt-1.5">
              <button
                type="button"
                onClick={() => setVue("liste")}
                aria-label={t("Retour")}
                className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <ChevronLeft size={16} strokeWidth={1.75} />
              </button>
              <p className="text-sm font-medium text-foreground">{t("Installer un modèle")}</p>
            </div>
            <p className="px-2 pb-1.5 text-[11px] leading-relaxed text-muted-foreground">
              {t("Seulement ceux que cette machine fait tourner sans ralentir, du mieux noté au moins bien noté.")}
            </p>
            {/*
             * La courte liste reste courte ; tout le catalogue libre est sur
             * la page « Modèles » (28/09/2026, demandé par Medhi : « laisser
             * le choix comme avec LM Studio »). En haut : en bas de la liste,
             * il fallait la faire défiler pour le trouver (vu à l'écran).
             */}
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                navigate("/modeles");
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Boxes size={15} strokeWidth={1.75} />
              <span className="flex-1 text-start">{t("Voir tous les modèles")}</span>
              <ChevronRight size={15} strokeWidth={1.75} />
            </button>
            <div className="my-1 h-px bg-border" />
            {installables.map((m) => {
                          const celuiCi = enCours && installation?.model === m.key;
                          return (
                            <div key={m.key} className="flex items-center gap-2.5 rounded-lg px-2 py-2">
                              <Download size={16} strokeWidth={1.75} className="shrink-0 text-muted-foreground" />
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm text-foreground">
                                  {m.label}
                                  <span className="ms-1.5 text-[11px] text-muted-foreground">{m.editeur}</span>
                                </p>
                                <p
                                  className="truncate text-[11px] text-muted-foreground"
                                  title={`${m.description} ${m.licence}.`}
                                >
                                  {celuiCi
                                    ? installation?.message
                                    : enumerer([
                                        m.eci !== undefined
                                          ? tf("Note ECI {0}", m.eci.toLocaleString(locale()))
                                          : t("sans note publiée"),
                                        tf("{0} Go", m.downloadGb.toLocaleString(locale())),
                                        m.vision ? t("images") : "",
                                      ])}
                                </p>
                              </div>
                              <button
                                type="button"
                                disabled={Boolean(enCours)}
                                onClick={() => {
                                  void installerModele(m).then((ok) => {
                                    if (ok) setInstallation({ phase: "checking", message: t("Préparation..."), model: m.key });
                                  });
                                }}
                                className="shrink-0 rounded-md border border-border px-2 py-1 text-xs text-foreground transition-colors hover:bg-muted disabled:opacity-50"
                              >
                                {celuiCi ? <Loader2 size={13} className="animate-spin" /> : t("Installer")}
                              </button>
                            </div>
                          );
                        })}
          </div>
        ) : (
        <>
        {/* La recherche reste visible quand la liste défile dessous. */}
        <div ref={haut} className="sticky -top-1.5 z-10 -mx-1.5 -mt-1.5 bg-popover px-2.5 pb-2 pt-2.5">
          <SearchInput
            placeholder={t("Rechercher un modèle ou un fournisseur...")}
            aria-label={t("Rechercher un modèle ou un fournisseur")}
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
          />
        </div>

        {/* Les raccourcis disparaissent pendant une recherche : on cherche un modèle. */}
        {!terme && (
          <>
            {raccourci("auto", Wand2, t("Auto"), tf("{0} choisit selon votre demande", branding.name), undefined, true)}
            {raccourci("rapide", Zap, t("Rapide"), t("Le plus léger de vos modèles"), rapide)}
            {raccourci("approfondi", Telescope, t("Approfondi"), t("Le plus capable de vos modèles"), capable)}
            <div className="my-1 h-px bg-border" />
          </>
        )}

        {loading && (
          <p className="flex items-center justify-center gap-2 px-2 py-6 text-sm text-muted-foreground">
            <Loader2 size={15} className="animate-spin" />{" "}{t("Recherche des modèles...")}
          </p>
        )}

        {error && (
          <div className="px-2 py-4 text-sm">
            <p className="flex items-start gap-2 text-muted-foreground">
              <CircleAlert size={15} strokeWidth={1.75} className="mt-0.5 shrink-0 text-warning" />
              <span>
                {error}
              </span>
            </p>
            <button type="button" className="mt-3 rounded-full border border-border px-4 py-2 hover:bg-muted disabled:opacity-50" disabled={loading} onClick={refresh}>{t("Réessayer")}</button>
          </div>
        )}

        {!loading && !error && models.length === 0 && (
          <p className="px-2 py-6 text-center text-sm text-muted-foreground">
            {t("Aucun modèle de conversation installé.")}
          </p>
        )}

        {/* Une seule barre de défilement : celle du panneau, qui tient dans la fenêtre. */}
        <div>
          {terme ? (
            filtres.length === 0 ? (
              <p className="px-2 py-6 text-center text-sm text-muted-foreground">
                {t("Aucun modèle ne correspond à votre recherche.")}
              </p>
            ) : (
              filtres.map(ligneModele)
            )
          ) : (
            <>
              {models.length > 0 && (
                <p className="px-2 pb-0.5 pt-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {t("Tous les modèles")}
                </p>
              )}
              {GROUPES.map((g, i) => {
                const liste = models.filter(g.garde);
                return (
                  <div key={g.titre}>
                    {liste.length > 0 && (
                      <>
                        <p className="px-2 pb-0.5 pt-2 text-[11px] text-muted-foreground/80">{g.titre}</p>
                        {liste.map(ligneModele)}
                      </>
                    )}
                    {/*
                     * Après les modèles de la machine, là où commencent ceux du
                     * cloud : c'est l'endroit où l'on cherche à en ajouter un.
                     * Ni en haut, avant même d'avoir vu ce qu'on a, ni tout en
                     * bas, après un défilement.
                     */}
                    {i === 0 && installables.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setVue("installer")}
                        className="mt-1 flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      >
                        {enCours ? (
                          <Loader2 size={15} strokeWidth={1.75} className="animate-spin" />
                        ) : (
                          <Download size={15} strokeWidth={1.75} />
                        )}
                        <span className="flex-1 text-start">
                          {enCours ? installation?.message : t("Installer un modèle sur cette machine")}
                        </span>
                        <ChevronRight size={15} strokeWidth={1.75} />
                      </button>
                    )}
                    {i === 0 && installables.length === 0 && catalogueLocal && (
                      <button
                        type="button"
                        onClick={() => {
                          setOpen(false);
                          navigate("/modeles");
                        }}
                        className="mt-1 flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      >
                        <Boxes size={15} strokeWidth={1.75} />
                        <span className="flex-1 text-start">{t("Voir tous les modèles")}</span>
                        <ChevronRight size={15} strokeWidth={1.75} />
                      </button>
                    )}
                    {i === 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setOpen(false);
                          navigate("/parametres/modeles");
                        }}
                        className="mt-1 flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      >
                        <Plus size={15} strokeWidth={1.75} />
                        {t("Brancher un modèle cloud avec une clé")}
                      </button>
                    )}
                  </div>
                );
              })}
            </>
          )}
        </div>

        <div className="my-1 h-px bg-border" />
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setComparer(true);
          }}
          className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ChartScatter size={15} strokeWidth={1.75} />
          {t("Comparer intelligence et prix")}
        </button>
        </>
        )}
      </Popover>

      <ComparerModeles
        open={comparer}
        onClose={() => setComparer(false)}
        modeles={models}
        choisi={value}
        onChoisir={(uid) => {
          onChange?.(uid);
          setComparer(false);
        }}
      />
    </>
  );
}

/* --- Niveau de raisonnement ------------------------------------------------ */

/*
 * Cinq niveaux, et un titre au-dessus.
 *
 * Il y en avait trois, sans titre : « Rapide », « Moyen », « Approfondi »
 * flottaient seuls dans un menu, sans dire de quoi ils réglaient la mesure.
 * Chacun porte donc ici ce qu'il change, en une ligne, parce qu'un réglage
 * qu'on ne comprend pas ne se touche pas.
 *
 * Les identifiants sont ceux que la passerelle attend (`NIVEAUX_EFFORT` dans
 * gateway/src/config.ts), qui accepte encore les anciens pour les postes dont
 * les préférences datent d'avant.
 */
const levels = [
  { id: "aucun", label: t("Aucun"), aide: t("Répond directement, sans réfléchir avant.") },
  { id: "faible", label: t("Faible"), aide: t("Un court temps de réflexion.") },
  { id: "moyen", label: t("Moyen"), aide: t("L'équilibre habituel.") },
  { id: "eleve", label: t("Élevé"), aide: t("Prend le temps des questions difficiles.") },
  { id: "max", label: t("Max"), aide: t("Le plus long. Réservé aux cas qui le méritent.") },
];

/** Préférences d'avant les cinq niveaux, encore enregistrées sur les postes. */
const ANCIENS_NIVEAUX: Record<string, string> = {
  rapide: "faible",
  auto: "moyen",
  approfondi: "eleve",
};

export function ReasoningPicker({
  value = "moyen",
  onChange,
}: {
  value?: string;
  onChange?: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const id = ANCIENS_NIVEAUX[value] ?? value;
  const current = levels.find((l) => l.id === id) ?? levels[2];
  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      align="end"
      width={248}
      trigger={(p) => (
        <Chip
          leading={<Gauge size={15} strokeWidth={1.75} />}
          /*
           * L'icône seule sous 640 px (tournée à l'écran du 28/09/2026) : à
           * 375 px, « Moyen » restait entier et le nom du modèle, à côté,
           * tombait à zéro pixel (« Auto » en français, « 自動 » réduit à un
           * trait en japonais). Le modèle qui répond passe avant le niveau :
           * sans chevron ni grande marge non plus, il rend 28 px au modèle.
           */
          compacte
          chevronEtroit={false}
          onClick={p.onClick}
          active={open}
          aria-expanded={p["aria-expanded"]}
        >
          {current.label}
        </Chip>
      )}
    >
      <p className="px-2 pb-0.5 pt-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {t("Raisonnement")}
      </p>
      {levels.map((l) => (
        <button
          key={l.id}
          type="button"
          onClick={() => {
            onChange?.(l.id);
            setOpen(false);
          }}
          className="flex w-full items-start gap-2 rounded-lg px-2.5 py-2 text-start text-sm text-foreground transition-colors hover:bg-muted"
        >
          <span className="min-w-0">
            <span className="block">{l.label}</span>
            <span className="block text-[11px] leading-snug text-muted-foreground">{l.aide}</span>
          </span>
          {current.id === l.id && (
            <Check size={16} strokeWidth={2} className="ms-auto mt-0.5 shrink-0 text-foreground" />
          )}
        </button>
      ))}
    </Popover>
  );
}
