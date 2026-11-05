import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Boxes, Brain, Check, Cpu, Download, ExternalLink, Eye, Gauge, Loader2, Wrench, Zap } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { InfoBox } from "@/components/ui/InfoBox";
import { SearchInput } from "@/components/ui/SearchInput";
import { SegmentedTabs } from "@/components/ui/SegmentedTabs";
import { Select } from "@/components/ui/Select";
import { LogoMarque } from "@/components/settings/TuileService";
import { marqueDuModele } from "@/components/settings/marquesConnecteurs";
import { SOURCE_NOTES } from "../../gateway/src/notesModeles.ts";
import { formaterDate } from "@/lib/formats";
import { cn } from "@/lib/cn";
import { enumerer, locale, t, tf } from "@/lib/i18n";
import {
  demanderInstallation,
  lireCatalogue,
  type EtatCatalogue,
  type ModeleDuCatalogue,
} from "@/lib/installables";

/**
 * Page « Modèles » (28/09/2026, demandé par Medhi : « je veux laisser le
 * choix comme avec LM Studio », et des modèles plus petits si on veut).
 *
 * Tout le catalogue libre de la passerelle (licences Apache 2.0 et MIT,
 * gateway/src/provision.ts) : on cherche, on trie, on filtre, on installe.
 * Seuls les modèles qui tiennent sur la machine s'installent (`tientSur`) ;
 * les plus lourds restent visibles, grisés, avec la raison chiffrée, et la
 * passerelle refuse de toute façon de les installer (`refusTropLourd`).
 * Ouverte depuis le sélecteur de modèles du Chat (« Voir tous les modèles »),
 * qui garde sa courte liste.
 *
 * Même route d'installation que le sélecteur (`/helix/provision/start`) :
 * une installation à la fois, suivie ici par l'état relu chaque seconde.
 */

/** Pays des éditeurs du catalogue : le siège de qui publie les poids. */
const PAYS_EDITEUR: Record<string, string> = {
  "Alibaba (Qwen)": t("Chine"),
  "Mistral AI": t("France"),
  IBM: t("États-Unis"),
  OpenAI: t("États-Unis"),
  DeepSeek: t("Chine"),
  "Zhipu (Z.ai)": t("Chine"),
  Meta: t("États-Unis"),
  Ai2: t("États-Unis"),
  Microsoft: t("États-Unis"),
  Baidu: t("Chine"),
  "ByteDance (Seed)": t("Chine"),
  "Essential AI": t("États-Unis"),
};

const EN_COURS = ["checking", "downloading", "loading"];

type Tri = "note" | "petits" | "gros";

/** Le mieux noté d'abord ; sans note, le plus lourd d'abord, comme la passerelle (`classement`). */
function parNote(a: ModeleDuCatalogue, b: ModeleDuCatalogue): number {
  if (a.eci !== undefined && b.eci !== undefined) return b.eci - a.eci || a.downloadGb - b.downloadGb;
  if (a.eci !== undefined) return -1;
  if (b.eci !== undefined) return 1;
  return b.downloadGb - a.downloadGb;
}

const nombre = (n: number) => n.toLocaleString(locale(), { maximumFractionDigits: 1 });

export function ModelesPage() {
  const [donnees, setDonnees] = useState<EtatCatalogue | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [role, setRole] = useState<"chat" | "gui">("chat");
  const [recherche, setRecherche] = useState("");
  const [editeur, setEditeur] = useState("tous");
  const [tri, setTri] = useState<Tri>("note");
  const [images, setImages] = useState(false);
  const [raisonne, setRaisonne] = useState(false);
  const [rapide, setRapide] = useState(false);
  // Le refus d'une demande (trop lourd, instance injoignable), par modèle.
  const [refus, setRefus] = useState<{ key: string; message: string } | null>(null);
  // L'installation lancée d'ici, le temps que l'état de la passerelle la montre.
  const [demande, setDemande] = useState<string | null>(null);

  const etat = donnees?.etat;
  const enCours = Boolean(etat && EN_COURS.includes(etat.phase)) || demande !== null;
  const avant = useRef(false);

  const lire = useCallback(() => {
    return lireCatalogue()
      .then((d) => {
        setDonnees(d);
        setErreur(null);
        // La demande est prise en charge dès que la passerelle montre une installation, ou la fin de celle de ce modèle.
        const e = d.etat;
        setDemande((dem) => (dem && e && (EN_COURS.includes(e.phase) || (e.model === dem && e.phase !== "idle")) ? null : dem));
      })
      .catch((err: unknown) => setErreur(err instanceof Error ? err.message : String(err)));
  }, []);

  useEffect(() => {
    void lire();
  }, [lire]);

  // Pendant une installation, l'état est relu chaque seconde ; à la fin, la liste (« installé ») aussi.
  useEffect(() => {
    if (avant.current && !enCours) void lire();
    avant.current = enCours;
    if (!enCours) return;
    const minuterie = window.setInterval(() => void lire(), 1000);
    return () => window.clearInterval(minuterie);
  }, [enCours, lire]);

  const modeles = donnees?.modeles ?? [];
  const aDesModelesEcran = modeles.some((m) => m.role === "gui");
  const duRole = modeles.filter((m) => m.role === (aDesModelesEcran ? role : "chat"));
  const editeurs = useMemo(() => [...new Set(duRole.map((m) => m.editeur))].sort((a, b) => a.localeCompare(b)), [duRole]);

  const terme = recherche.trim().toLocaleLowerCase(locale());
  const visibles = useMemo(() => {
    const liste = duRole.filter(
      (m) =>
        (!terme || `${m.label} ${m.editeur} ${m.key} ${PAYS_EDITEUR[m.editeur] ?? ""}`.toLocaleLowerCase(locale()).includes(terme)) &&
        (editeur === "tous" || m.editeur === editeur) &&
        (!images || m.vision) &&
        (!raisonne || m.raisonne) &&
        (!rapide || m.moe),
    );
    const ordre = tri === "note" ? parNote : tri === "petits" ? (a: ModeleDuCatalogue, b: ModeleDuCatalogue) => a.downloadGb - b.downloadGb : (a: ModeleDuCatalogue, b: ModeleDuCatalogue) => b.downloadGb - a.downloadGb;
    // Ceux qui tiennent d'abord : ce sont les seuls qu'on peut installer.
    return [...liste].sort((a, b) => Number(Boolean(a.tropLourd)) - Number(Boolean(b.tropLourd)) || ordre(a, b));
  }, [duRole, terme, editeur, images, raisonne, rapide, tri]);

  const tiennent = duRole.filter((m) => !m.tropLourd).length;
  const bloque = donnees?.managed
    ? t("Les modèles de cette instance sont préparés par votre prestataire : rien ne s'installe d'ici.")
    : donnees && !donnees.moteurInstalle
      ? t("Le moteur des modèles n'est pas encore installé sur cette machine : installez-le depuis l'écran de mise en route, puis revenez ici.")
      : null;

  const installer = (m: ModeleDuCatalogue) => {
    setRefus(null);
    setDemande(m.key);
    void demanderInstallation(m).then((message) => {
      if (message) {
        setDemande(null);
        setRefus({ key: m.key, message });
      } else void lire();
    });
  };

  const machine = donnees?.machine;
  const resumeMachine = machine
    ? enumerer([
        tf("{0} Go de mémoire", nombre(machine.totalMemoryGb)),
        machine.appleSilicon
          ? t("puce Apple (mémoire partagée avec la carte graphique)")
          : machine.gpuNom
            ? `${machine.gpuNom}${machine.gpuVramGb !== undefined ? ` (${tf("carte graphique de {0} Go", nombre(machine.gpuVramGb))})` : ""}`
          : machine.gpuVramGb !== undefined
            ? tf("carte graphique de {0} Go", nombre(machine.gpuVramGb))
            : t("calcul au processeur"),
      ])
    : "";

  const modeleEnCours = etat && EN_COURS.includes(etat.phase) ? modeles.find((m) => m.key === etat.model) : undefined;

  return (
    <div className="flex h-full flex-col overflow-y-auto px-8 py-7 max-sm:px-4">
      <PageHeader
        icon={Boxes}
        showBack
        title={t("Modèles")}
        subtitle={t("Les modèles libres qu'on peut installer sur cette machine. Ceux qu'elle ne fait pas tourner restent visibles, grisés, avec la raison.")}
        actions={
          <SearchInput
            placeholder={t("Rechercher un modèle ou un éditeur...")}
            aria-label={t("Rechercher un modèle ou un éditeur")}
            containerClassName="w-[320px] max-sm:w-full"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
          />
        }
      />

      {resumeMachine && (
        <p className="mt-4 flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
          <Cpu size={15} strokeWidth={1.75} className="shrink-0" />
          <span>{tf("Cette machine : {0}.", resumeMachine)}</span>
          <span>
            {tiennent <= 1 ? tf("{0} modèle sur {1} y tient.", tiennent, duRole.length) : tf("{0} modèles sur {1} y tiennent.", tiennent, duRole.length)}
          </span>
        </p>
      )}

      {donnees?.moteur === "llamacpp" && (
        <InfoBox tone="muted" className="mt-3">
          {t("Sur ce Mac, le moteur des modèles est llama.cpp : seuls les modèles préparés pour lui sont proposés, chacun vérifié par son empreinte.")}
        </InfoBox>
      )}

      {bloque && (
        <InfoBox tone="warning" className="mt-3">
          {bloque}
        </InfoBox>
      )}

      {erreur && (
        <InfoBox tone="warning" className="mt-3">
          {erreur}
        </InfoBox>
      )}

      {/* L'installation en cours, lancée d'ici, du sélecteur ou de la mise en route. */}
      {etat && EN_COURS.includes(etat.phase) && (
        <div className="mt-4 rounded-xl border border-border bg-card p-3" role="status" aria-live="polite">
          <p className="flex items-center gap-2 text-sm text-foreground">
            <Loader2 size={15} className="shrink-0 animate-spin" />
            <span className="min-w-0 flex-1">{etat.message}</span>
          </p>
          {etat.percent !== undefined && (
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${Math.round(etat.percent)}%` }} />
            </div>
          )}
          {modeleEnCours && <p className="mt-1.5 text-xs text-muted-foreground">{tf("Une installation à la fois : les autres boutons attendent la fin de {0}.", modeleEnCours.label)}</p>}
        </div>
      )}
      {etat?.phase === "error" && etat.model && modeles.some((m) => m.key === etat.model) && (
        <InfoBox tone="warning" className="mt-4">
          <p className="font-medium">{etat.message}</p>
          {etat.error && <p className="mt-1 whitespace-pre-line break-words text-xs text-muted-foreground">{etat.error}</p>}
        </InfoBox>
      )}

      {aDesModelesEcran && (
        <div className="mt-5">
          <SegmentedTabs
            options={[
              { id: "chat", label: tf("Converser ({0})", modeles.filter((m) => m.role === "chat").length) },
              { id: "gui", label: tf("Piloter l'écran ({0})", modeles.filter((m) => m.role === "gui").length) },
            ]}
            value={role}
            onChange={(id) => {
              setRole(id === "gui" ? "gui" : "chat");
              setEditeur("tous");
            }}
          />
        </div>
      )}

      {/* Filtres et tri : sur une ligne, qui passe à la ligne sur un écran étroit. */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <div className="w-[200px] max-sm:w-full">
          <Select
            value={editeur}
            onChange={setEditeur}
            options={[{ value: "tous", label: t("Tous les éditeurs") }, ...editeurs.map((e) => ({ value: e, label: e }))]}
          />
        </div>
        <div className="w-[200px] max-sm:w-full">
          <Select
            value={tri}
            onChange={(v) => setTri(v === "petits" || v === "gros" ? v : "note")}
            options={[
              { value: "note", label: t("Trier par note") },
              { value: "petits", label: t("Les plus légers d'abord") },
              { value: "gros", label: t("Les plus lourds d'abord") },
            ]}
          />
        </div>
        <Filtre actif={images} onClick={() => setImages((v) => !v)} icone={Eye} libelle={t("Lit les images")} />
        <Filtre actif={raisonne} onClick={() => setRaisonne((v) => !v)} icone={Brain} libelle={t("Raisonne")} />
        <Filtre actif={rapide} onClick={() => setRapide((v) => !v)} icone={Zap} libelle={t("Rapide sans carte graphique")} />
      </div>

      {!donnees && !erreur ? (
        <div className="flex flex-1 items-center justify-center py-16 text-muted-foreground">
          <Loader2 size={20} className="animate-spin" />
        </div>
      ) : donnees && visibles.length === 0 ? (
        <EmptyState
          icon={Boxes}
          title={t("Aucun modèle")}
          description={terme || editeur !== "tous" || images || raisonne || rapide ? t("Aucun modèle ne correspond à ces filtres.") : t("Aucun modèle n'est proposé sur cette instance.")}
        />
      ) : (
        <ul className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {visibles.map((m) => (
            <li key={`${m.role}:${m.key}`}>
              <FicheModele
                m={m}
                enCours={Boolean(etat && EN_COURS.includes(etat.phase) && etat.model === m.key) || demande === m.key}
                pourcentage={etat?.model === m.key ? etat.percent : undefined}
                occupe={enCours}
                bloque={bloque !== null}
                refus={refus?.key === m.key ? refus.message : undefined}
                onInstaller={() => installer(m)}
              />
            </li>
          ))}
        </ul>
      )}

      {/* Attribution exigée par la licence CC BY 4.0 d'Epoch AI, comme sous la comparaison des modèles (ComparerModeles.tsx). */}
      <p className="mt-6 text-xs text-muted-foreground">
        {t("Notes :")}{" "}
        <a href={SOURCE_NOTES.page} title={SOURCE_NOTES.titre} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline underline-offset-2 hover:text-foreground">
          {tf("{0} ({1})", SOURCE_NOTES.nom, SOURCE_NOTES.indice)}
          <ExternalLink size={11} strokeWidth={1.75} />
        </a>{" "}
        {"· "}
        <a href={SOURCE_NOTES.licenceUrl} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-foreground">
          {SOURCE_NOTES.licence}
        </a>
        {tf(" · extrait, notes inchangées · relevées le {0}", formaterDate(`${SOURCE_NOTES.releveLe}T12:00:00`))}
      </p>
    </div>
  );
}

/** Un filtre qu'on allume ou éteint. */
function Filtre({ actif, onClick, icone: Icone, libelle }: { actif: boolean; onClick: () => void; icone: LucideIcon; libelle: string }) {
  return (
    <button
      type="button"
      aria-pressed={actif}
      onClick={onClick}
      className={cn(
        "inline-flex h-10 items-center gap-1.5 rounded-full border px-3 text-sm transition-colors",
        actif ? "border-primary bg-muted text-foreground" : "border-border text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      <Icone size={15} strokeWidth={1.75} />
      {libelle}
    </button>
  );
}

/** Une pastille de capacité. */
function Capacite({ icone: Icone, libelle }: { icone: LucideIcon; libelle: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
      <Icone size={11} strokeWidth={2} />
      {libelle}
    </span>
  );
}

function FicheModele({
  m,
  enCours,
  pourcentage,
  occupe,
  bloque,
  refus,
  onInstaller,
}: {
  m: ModeleDuCatalogue;
  enCours: boolean;
  pourcentage?: number;
  occupe: boolean;
  bloque: boolean;
  refus?: string;
  onInstaller: () => void;
}) {
  const pays = PAYS_EDITEUR[m.editeur];
  const lourd = Boolean(m.tropLourd);
  return (
    <div
      className={cn(
        "flex h-full flex-col gap-2.5 rounded-2xl border border-border bg-card p-4",
        lourd && "opacity-60",
      )}
    >
      <div className="flex items-start gap-2.5">
        <LogoMarque marque={marqueDuModele(m.key)} icone={Cpu} taille={22} degagement={8} />
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className="font-medium text-foreground">{m.label}</span>
            {m.recommande && (
              <span className="rounded-full bg-accent/15 px-1.5 py-0.5 text-[10px] font-medium text-accent">{t("Recommandé")}</span>
            )}
          </p>
          <p className="text-xs text-muted-foreground">{enumerer([m.editeur, pays])}</p>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        {enumerer([
          m.licence,
          tf("{0} Go", nombre(m.downloadGb)),
          m.eci !== undefined ? tf("Note ECI {0}", m.eci.toLocaleString(locale())) : t("sans note publiée"),
        ])}
      </p>

      <div className="flex flex-wrap gap-1.5">
        {m.role === "gui" && <Capacite icone={Gauge} libelle={t("désigne les éléments à l'écran")} />}
        {m.outils && <Capacite icone={Wrench} libelle={t("outils")} />}
        {m.raisonne && <Capacite icone={Brain} libelle={t("raisonne")} />}
        {m.vision && <Capacite icone={Eye} libelle={t("images")} />}
        {m.moe && <Capacite icone={Zap} libelle={t("rapide sans carte graphique")} />}
      </div>

      {m.tropLourd && <p className="text-xs text-foreground">{m.tropLourd.texte}</p>}
      {refus && <p className="text-xs text-warning">{refus}</p>}

      <div className="mt-auto flex items-center justify-end pt-1">
        {m.installe ? (
          <span className="inline-flex items-center gap-1.5 text-sm text-success">
            <Check size={15} strokeWidth={2} />
            {t("Installé")}
          </span>
        ) : enCours ? (
          <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
            <Loader2 size={15} className="animate-spin" />
            {pourcentage !== undefined ? tf("{0} %", Math.round(pourcentage)) : t("Préparation...")}
          </span>
        ) : lourd ? (
          <span className="text-xs text-muted-foreground">{t("Trop lourd pour cette machine")}</span>
        ) : (
          <Button size="sm" variant="secondary" icon={Download} disabled={occupe || bloque} onClick={onInstaller}>
            {t("Installer")}
          </Button>
        )}
      </div>
    </div>
  );
}

export default ModelesPage;
