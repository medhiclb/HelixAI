import { useCallback, useEffect, useState } from "react";
import { Image as ImageIcon, Film, Loader2, Download, TriangleAlert, Square, RectangleVertical, RectangleHorizontal, X, ChevronDown, Check } from "lucide-react";
import { Popover } from "@/components/ui/Popover";
import { Button } from "@/components/ui/Button";
import { SegmentedTabs } from "@/components/ui/SegmentedTabs";
import {
  choisirModeleImage,
  choisirModeleVideo,
  etatImages,
  etatVideos,
  installerImages,
  installerVideos,
  type EtatImages,
  type Format,
  type IdModele,
} from "@/lib/images";
import { cn } from "@/lib/cn";
import { t, tf } from "@/lib/i18n";

/**
 * Pastille « Image » de la zone de saisie, comme dans ChatGPT : elle apparaît
 * quand on a choisi « Créer une image » dans le menu « + », et la croix la
 * retire. Son menu règle le format et le modèle.
 *
 * Les modèles proposés sont ceux que la machine peut faire tourner (images.ts,
 * côté passerelle), le conseillé en premier. Aucun n'est installé sans clic :
 * le panneau annonce ce qui sera téléchargé, puis suit l'installation.
 * Depuis le 28/09/2026, l'écran ne dit plus si un modèle a été essayé de bout
 * en bout avec Helix (PROJET.md § 3.16) : `verifie` ne sert plus qu'à la
 * passerelle.
 */
export function ImageChip({
  onFermer,
  format,
  onFormat,
  genre = "image",
}: {
  onFermer?: () => void;
  format: Format;
  onFormat: (f: Format) => void;
  /** « video » : la même pastille pour les vidéos (27/09/2026), mêmes modèles proposés selon la machine. */
  genre?: "image" | "video";
}) {
  const video = genre === "video";
  const lireEtat = video ? etatVideos : etatImages;
  const installer = video ? installerVideos : (id: string) => installerImages(id as IdModele);
  const choisir = video ? choisirModeleVideo : (id: string) => choisirModeleImage(id as IdModele);
  const [open, setOpen] = useState(false);
  const [etat, setEtat] = useState<EtatImages | null | undefined>(undefined);
  const [erreur, setErreur] = useState<string | null>(null);

  const relire = useCallback(() => {
    void lireEtat().then(setEtat);
  }, [lireEtat]);

  useEffect(relire, [relire]);

  // Rien d'installé : le menu s'ouvre de lui-même, c'est là que tout commence.
  const aInstaller = Boolean(etat && !etat.pret && etat.possible);
  useEffect(() => {
    if (aInstaller) setOpen(true);
  }, [aInstaller]);

  const enInstallation = Boolean(etat?.installation && etat.installation.etape !== "erreur");
  useEffect(() => {
    if (!enInstallation) return;
    const minuterie = window.setInterval(relire, 1500);
    return () => window.clearInterval(minuterie);
  }, [enInstallation, relire]);

  const agir = async (f: () => Promise<void>) => {
    setErreur(null);
    try {
      await f();
      relire();
    } catch (err) {
      setErreur(err instanceof Error ? err.message : String(err));
    }
  };

  const actif = etat?.modeles.find((m) => m.id === etat.actif);
  const progression = etat?.installation;
  const pourcent = progression && progression.total > 0 ? Math.round((progression.fait / progression.total) * 100) : 0;
  const proposes = (etat?.modeles ?? [])
    .filter((m) => m.possible || m.installe)
    .sort((a, b) => Number(b.conseille) - Number(a.conseille));

  return (
    <div className="inline-flex items-center rounded-full bg-primary/10 text-sm text-primary">
      <Popover
        open={open}
        onOpenChange={setOpen}
        align="start"
        width={340}
        trigger={(p) => (
          <button
            type="button"
            onClick={p.onClick}
            aria-expanded={p["aria-expanded"]}
            className="inline-flex h-8 items-center gap-1.5 rounded-full ps-3 pe-1.5 font-medium hover:bg-primary/10"
            title={video ? t("Réglages de la vidéo") : t("Réglages de l'image")}
          >
            {video ? <Film size={15} strokeWidth={1.75} /> : <ImageIcon size={15} strokeWidth={1.75} />}
            {video ? t("Vidéo") : t("Image")}
            {actif && <span className="hidden font-normal opacity-80 sm:inline">· {actif.nom}</span>}
            <ChevronDown size={13} strokeWidth={1.75} className="opacity-70" />
          </button>
        )}
      >
        {etat === undefined && (
          <p className="flex items-center gap-2 px-2.5 py-2 text-xs text-muted-foreground">
            <Loader2 size={13} className="animate-spin" /> {t("Lecture...")}
          </p>
        )}
        {etat === null && (
          <p className="px-2.5 py-2 text-xs text-muted-foreground">{video ? t("Instance injoignable : impossible de savoir si elle crée des vidéos.") : t("Instance injoignable : impossible de savoir si elle crée des images.")}</p>
        )}
        {etat && (
          <div className="space-y-3 px-2.5 py-2">
            <p className="text-xs text-muted-foreground">{etat.raison}</p>
            {etat.pret && (
              <SegmentedTabs
                size="sm"
                value={format}
                onChange={(id) => onFormat(id as Format)}
                options={[
                  // Les modèles vidéo tournent en paysage ou en portrait, pas en carré.
                  ...(video ? [] : [{ id: "carre", label: t("Carré"), icon: Square }]),
                  { id: "portrait", label: t("Portrait"), icon: RectangleVertical },
                  { id: "paysage", label: t("Paysage"), icon: RectangleHorizontal },
                ]}
              />
            )}
            {proposes.length > 0 && (
              <div>
                <p className="pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{t("Modèle")}</p>
                <div className="space-y-1">
                  {proposes.map((m) => {
                    const choisi = m.id === etat.actif;
                    const celuiCi = progression?.modele === m.id && progression.etape !== "erreur";
                    return (
                      <div key={m.id} className={cn("rounded-lg px-2 py-2", choisi && "bg-muted")}>
                        <div className="flex items-start gap-2">
                          <button
                            type="button"
                            disabled={!m.installe}
                            onClick={() => void agir(() => choisir(m.id))}
                            className="min-w-0 flex-1 text-start disabled:cursor-default"
                          >
                            <span className="flex flex-wrap items-center gap-1.5 text-sm font-medium text-foreground">
                              {m.nom}
                              {m.conseille && (
                                <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                                  {t("conseillé")}
                                </span>
                              )}
                            </span>
                            <span className="block text-xs text-muted-foreground">{m.atout}</span>
                            <span className="block text-[11px] text-muted-foreground">
                              {m.editeur} · {m.licence}
                            </span>
                          </button>
                          {choisi && <Check size={15} className="mt-0.5 shrink-0 text-primary" />}
                          {!m.installe && !celuiCi && (
                            <Button
                              size="sm"
                              variant="secondary"
                              icon={Download}
                              disabled={enInstallation}
                              onClick={() => void agir(() => installer(m.id))}
                            >
                              {tf("{0} Go", m.telechargementGo)}
                            </Button>
                          )}
                        </div>
                        {celuiCi && progression && (
                          <div className="mt-2 space-y-1">
                            <p className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Loader2 size={12} className="animate-spin" /> {progression.message} {pourcent} %
                            </p>
                            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                              <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${pourcent}%` }} />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            {(progression?.etape === "erreur" || erreur) && (
              <p className="flex items-start gap-2 text-xs text-foreground">
                <TriangleAlert size={13} className="mt-0.5 shrink-0 text-destructive" />
                <span>{erreur ?? `${progression?.message} ${progression?.erreur ?? ""}`}</span>
              </p>
            )}
          </div>
        )}
      </Popover>
      {onFermer && <button
        type="button"
        onClick={onFermer}
        aria-label={video ? t("Ne plus créer de vidéo") : t("Ne plus créer d'image")}
        className="me-1 inline-flex h-6 w-6 items-center justify-center rounded-full hover:bg-primary/15"
      >
        <X size={13} strokeWidth={2} />
      </button>}
    </div>
  );
}

export default ImageChip;
