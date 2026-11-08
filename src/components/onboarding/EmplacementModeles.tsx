import { useCallback, useEffect, useState } from "react";
import { ArrowRightLeft, FolderOpen, HardDrive, Loader2, RotateCcw, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { InfoBox } from "@/components/ui/InfoBox";
import { ACopier } from "@/components/ui/ACopier";
import { branding } from "@/config/branding";
import { cn } from "@/lib/cn";
import {
  choisirEmplacement,
  lireEmplacement,
  ouvrirSelecteur,
  selecteurDossier,
  verifierEmplacement,
  type EtatEmplacement,
} from "@/lib/emplacementModeles";
import { t, taille, tf } from "@/lib/i18n";

/**
 * Où iront le moteur et les modèles, et la place qu'il y a (28/09/2026,
 * demandé par Medhi : « il y a des gens dont le disque principal n'a pas la
 * place, ils ont un disque D: par exemple »).
 *
 *  - Mise en route (`reglages` faux) : un encadré sous le texte d'accueil,
 *    avant « Installer le moteur ». « Changer » ouvre le sélecteur de dossier
 *    du système dans l'application ; dans un navigateur, ou pour une instance
 *    distante, un champ où écrire le chemin (sur la machine de l'instance).
 *  - Réglages, Modèles locaux : la même chose, plus le déplacement des
 *    modèles du moteur ouvert, ou la marche à suivre pour LM Studio déjà
 *    installé (la passerelle ne déplace pas le dossier d'un LM Studio qui
 *    tourne, gateway/src/emplacementModeles.ts).
 */
export function EmplacementModeles({
  reglages = false,
  onChange,
  modeleChoisi,
}: {
  reglages?: boolean;
  onChange?: () => void;
  /** Le modèle choisi à la mise en route, quand ce n'est pas le conseillé (FirstRun.tsx, 28/09/2026) : la place se compte pour lui. */
  modeleChoisi?: { label: string; downloadGb: number };
}) {
  const [etat, setEtat] = useState<EtatEmplacement | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [saisie, setSaisie] = useState(false);
  const [marcheVisible, setMarcheVisible] = useState(false);
  const [chemin, setChemin] = useState("");
  const [occupe, setOccupe] = useState(false);
  /** Un déplacement à confirmer : la destination (le sous-dossier qui sera créé) et sa place libre. */
  const [aConfirmer, setAConfirmer] = useState<{ choisi: string; dossier: string; libre: number | null } | null>(null);

  const charger = useCallback(() => {
    // L'erreur d'un choix refusé reste affichée : relire l'état ne l'efface pas (chaque action repart de zéro).
    void lireEmplacement()
      .then(setEtat)
      .catch((err: unknown) => setErreur(err instanceof Error ? err.message : String(err)));
  }, []);
  useEffect(charger, [charger]);

  // Un déplacement en cours se suit toutes les secondes.
  const enCours = etat?.deplacement?.phase === "en-cours";
  useEffect(() => {
    if (!enCours) return;
    const id = window.setInterval(charger, 1000);
    return () => window.clearInterval(id);
  }, [enCours, charger]);

  if (!etat) {
    return erreur && reglages ? (
      <InfoBox tone="warning" leading={<TriangleAlert size={15} strokeWidth={1.75} />}>
        {erreur}
      </InfoBox>
    ) : null;
  }
  if (!etat.moteur) {
    return reglages ? (
      <p className="text-sm text-muted-foreground">
        {t("Cette instance n'a pas de moteur de modèles local à régler : ses modèles viennent de son profil, ou d'une clé d'un fournisseur.")}
      </p>
    ) : null;
  }

  const windows = /^[A-Za-z]:\\/.test(etat.habituel);
  const exemple = windows ? "D:\\Modeles" : "/Volumes/Disque";
  // À la mise en route seulement : dans les réglages, le modèle conseillé est souvent déjà là.
  /*
   * La place pour le modèle choisi, pas pour le conseillé (vu le 28/09/2026 :
   * Qwen3 4B coché, l'encadré comptait encore Qwen3.5 9B). La part du moteur
   * et la marge restent celles que l'instance a comptées.
   */
  const modele = modeleChoisi ?? etat.modele;
  const necessaire = etat.necessaire - Math.round(etat.modele.downloadGb * 1e9) + Math.round(modele.downloadGb * 1e9);
  const manque = !reglages && etat.libre !== null && etat.libre < necessaire;
  const selecteur = selecteurDossier();

  /** Applique un choix (ou le retour à l'emplacement habituel). */
  const appliquer = async (dossier: string | null) => {
    setOccupe(true);
    setErreur(null);
    try {
      await choisirEmplacement(dossier);
      setSaisie(false);
      setAConfirmer(null);
      setChemin("");
      onChange?.();
    } catch (err) {
      setErreur(err instanceof Error ? err.message : String(err));
    } finally {
      setOccupe(false);
      charger();
    }
  };

  /** Un dossier est choisi : appliqué tout de suite si rien n'est posé, sinon jugé puis proposé au déplacement. */
  const dossierChoisi = async (dossier: string) => {
    if (etat.changement !== "deplacement") return appliquer(dossier);
    setOccupe(true);
    setErreur(null);
    try {
      const v = await verifierEmplacement(dossier);
      // Le dossier déjà retenu, rechoisi (28/09/2026) : rien à déplacer, pas de « Déplacer vers » ce même dossier.
      if (!v.actuel) setAConfirmer({ choisi: dossier, dossier: v.dossier, libre: v.libre });
      setSaisie(false);
    } catch (err) {
      setErreur(err instanceof Error ? err.message : String(err));
    } finally {
      setOccupe(false);
    }
  };

  const changer = async () => {
    setErreur(null);
    if (!selecteur) {
      setSaisie(true);
      return;
    }
    const dossier = await ouvrirSelecteur(selecteur).catch(() => null);
    if (dossier) await dossierChoisi(dossier);
  };

  const titre =
    etat.moteur === "lmstudio" ? t("Emplacement du moteur et des modèles") : t("Emplacement des modèles");
  const peutChoisir = etat.admin && (etat.changement === "libre" || etat.changement === "deplacement");
  const deplacement = etat.deplacement;

  return (
    /*
     * Les chemins sont longs et sans espace : ils passent à la ligne n'importe
     * où plutôt que d'élargir la page (vu à 375 px de large, 28/09/2026).
     */
    <div className={cn("w-full min-w-0 text-start [overflow-wrap:anywhere]", !reglages && "max-w-md rounded-2xl border border-border bg-card p-4")}>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{titre}</p>
      <div className="mt-1.5 flex items-start gap-2">
        <HardDrive size={15} strokeWidth={1.75} className="mt-0.5 shrink-0 text-muted-foreground" />
        <span className="min-w-0 break-all font-mono text-[13px] text-foreground">{etat.dossier}</span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        {etat.parDefaut ? t("Emplacement habituel.") : t("Emplacement choisi.")}{" "}
        {etat.libre !== null ? tf("{0} libres sur ce disque.", taille(etat.libre)) : t("Place libre inconnue.")}
        {!reglages &&
          ` ${
            // Le moteur ouvert (11 Mo) reste dans les données de l'instance : seul le modèle compte ici.
            etat.moteurPose || etat.moteur === "llamacpp"
              ? modeleChoisi
                ? tf("Il faut environ {0} pour le modèle choisi ({1}).", taille(necessaire), modele.label)
                : tf("Il faut environ {0} pour le modèle conseillé ({1}).", taille(necessaire), modele.label)
              : modeleChoisi
                ? tf("Il faut environ {0} pour le moteur et le modèle choisi ({1}).", taille(necessaire), modele.label)
                : tf("Il faut environ {0} pour le moteur et le modèle conseillé ({1}).", taille(necessaire), modele.label)
          }`}
        {etat.moteur === "llamacpp" && (etat.occupe ?? 0) > 0 && ` ${tf("Les modèles posés occupent {0}.", taille(etat.occupe ?? 0))}`}
      </p>

      {manque && (
        <InfoBox tone="warning" className="mt-3" leading={<TriangleAlert size={15} strokeWidth={1.75} />}>
          {windows
            ? t("Il n'y a pas assez de place sur ce disque. Choisissez un autre disque, par exemple D:.")
            : t("Il n'y a pas assez de place sur ce disque. Choisissez un autre disque, par exemple un disque externe.")}
        </InfoBox>
      )}
      {etat.alerte && (
        <InfoBox tone="warning" className="mt-3" leading={<TriangleAlert size={15} strokeWidth={1.75} />}>
          {etat.alerte}
        </InfoBox>
      )}

      {/* Déplacement en cours ou terminé (moteur ouvert). */}
      {deplacement && (
        <div className="mt-3">
          <div className="flex items-center gap-2 text-sm">
            {deplacement.phase === "en-cours" && <Loader2 size={15} className="shrink-0 animate-spin text-muted-foreground" />}
            <span className={deplacement.phase === "erreur" ? "text-foreground" : "text-muted-foreground"}>{deplacement.message}</span>
          </div>
          {deplacement.phase === "en-cours" && typeof deplacement.percent === "number" && (
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${deplacement.percent}%` }} />
            </div>
          )}
          {deplacement.erreur && <p className="mt-1 text-xs text-muted-foreground">{deplacement.erreur}</p>}
        </div>
      )}

      {/* Confirmation d'un déplacement : ce qui part, où, et la place qu'il y a. */}
      {aConfirmer && (
        <div className="mt-3 rounded-xl border border-border bg-muted/40 p-3 text-sm">
          <p className="text-foreground">
            {tf("Déplacer {0} de modèles vers {1} ?", taille(etat.occupe ?? 0), aConfirmer.dossier)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {aConfirmer.libre !== null && `${tf("{0} libres à la destination.", taille(aConfirmer.libre))} `}
            {t("Le moteur s'arrête pendant le déplacement. Sur un autre disque, les modèles sont copiés, la copie vérifiée, puis seulement les originaux effacés.")}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button size="sm" icon={ArrowRightLeft} disabled={occupe} onClick={() => void appliquer(aConfirmer.choisi)}>
              {t("Déplacer")}
            </Button>
            <Button size="sm" variant="ghost" disabled={occupe} onClick={() => setAConfirmer(null)}>
              {t("Annuler")}
            </Button>
          </div>
        </div>
      )}

      {/* Saisie du chemin, dans un navigateur ou pour une instance distante. */}
      {saisie && !aConfirmer && (
        <form
          className="mt-3 flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (chemin.trim()) void dossierChoisi(chemin.trim());
          }}
        >
          <label className="text-xs text-muted-foreground" htmlFor="emplacement-modeles-chemin">
            {t("Chemin complet d'un dossier sur la machine de l'instance :")}
          </label>
          <Input
            id="emplacement-modeles-chemin"
            value={chemin}
            placeholder={exemple}
            autoFocus
            spellCheck={false}
            onChange={(e) => setChemin(e.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            <Button size="sm" type="submit" disabled={occupe || !chemin.trim()}>
              {t("Utiliser ce dossier")}
            </Button>
            <Button size="sm" variant="ghost" type="button" onClick={() => setSaisie(false)}>
              {t("Annuler")}
            </Button>
          </div>
        </form>
      )}

      {erreur && (
        <InfoBox tone="warning" className="mt-3" leading={<TriangleAlert size={15} strokeWidth={1.75} />}>
          {erreur}
        </InfoBox>
      )}

      {peutChoisir && !saisie && !aConfirmer && !enCours && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button size="sm" variant="secondary" icon={occupe ? Loader2 : FolderOpen} disabled={occupe} onClick={() => void changer()}>
            {t("Changer")}
          </Button>
          {etat.revenir && !etat.parDefaut && (
            <Button size="sm" variant="ghost" className="h-auto min-h-8 py-1.5 text-start" icon={RotateCcw} disabled={occupe} onClick={() => void appliquer(null)}>
              {t("Revenir à l'emplacement habituel")}
            </Button>
          )}
        </div>
      )}
      {/* LM Studio posé ailleurs que choisi : revenir reste possible même si le choix n'est plus libre. */}
      {etat.admin && etat.changement === "manuel" && etat.revenir && !etat.parDefaut && !reglages && (
        <div className="mt-3">
          <Button size="sm" variant="ghost" className="h-auto min-h-8 py-1.5 text-start" icon={RotateCcw} disabled={occupe} onClick={() => void appliquer(null)}>
            {t("Revenir à l'emplacement habituel")}
          </Button>
        </div>
      )}
      {!etat.admin && etat.changement !== "aucun" && (
        <p className="mt-2 text-xs text-muted-foreground">{t("Seul l'administrateur de l'instance change cet emplacement.")}</p>
      )}

      {reglages && etat.changement === "deplacement" && !deplacement && (
        <p className="mt-3 text-xs text-muted-foreground">
          {t("Changer d'emplacement déplace aussi les modèles déjà posés.")}
        </p>
      )}
      {etat.admin && !reglages && etat.changement === "manuel" && etat.manuel && (
        <Button className="mt-3" size="sm" variant="secondary" icon={FolderOpen}
          aria-expanded={marcheVisible} aria-controls="emplacement-modeles-marche"
          onClick={() => setMarcheVisible(v => !v)}>
          {t("Changer")}
        </Button>
      )}
      {etat.admin && (reglages || marcheVisible) && etat.changement === "manuel" && etat.manuel && (
        <div id="emplacement-modeles-marche">
          <MarcheLmStudio etat={etat} windows={windows} occupe={occupe} revenir={() => void appliquer(null)} />
        </div>
      )}
    </div>
  );
}

/**
 * LM Studio déjà installé : ce qu'il faut faire soi-même pour le mettre
 * ailleurs. La passerelle ne le fait pas : le moteur de LM Studio tourne en
 * service, y compris quand l'application est fermée, et déplacer son dossier
 * sous ses pieds peut abîmer un modèle en cours d'écriture.
 */
function MarcheLmStudio({ etat, windows, occupe, revenir }: { etat: EtatEmplacement; windows: boolean; occupe: boolean; revenir: () => void }) {
  const m = etat.manuel!;
  const commande = `"${m.lms}" daemon down`;
  return (
    <div className="mt-4 space-y-3 text-sm">
      <p className="text-foreground">
        {tf("LM Studio est déjà installé dans {0}. {1} ne déplace pas le dossier d'un LM Studio en marche : ce qu'il écrit pourrait être abîmé. Pour le mettre sur un autre disque :", m.dossier, branding.name)}
      </p>
      <ol className="list-decimal space-y-2 ps-5 text-muted-foreground">
        <li>{tf("Quittez {0}, et l'application LM Studio si elle est ouverte.", branding.name)}</li>
        <li>
          {windows
            ? t("Arrêtez le moteur de LM Studio, dans l'invite de commandes (cmd) :")
            : t("Arrêtez le moteur de LM Studio, dans un terminal :")}
          <ACopier className="mt-1.5" valeur={commande} libelle={t("la commande")} />
        </li>
        <li>{tf("Déplacez le dossier {0} tout entier vers le disque voulu (par exemple {1}).", m.dossier, windows ? "D:\\LM Studio" : "/Volumes/Disque/LM Studio")}</li>
        <li>
          {t("Ouvrez ce fichier avec un éditeur de texte (créez-le s'il manque), et remplacez son contenu par le chemin complet du dossier déplacé, seul sur une ligne :")}
          <ACopier className="mt-1.5" valeur={m.pointeur} libelle={t("le chemin du fichier")} />
        </li>
        <li>{tf("Rouvrez {0} : il suit le nouveau dossier.", branding.name)}</li>
      </ol>
      <p className="text-xs text-muted-foreground">
        {t("Choisissez un dossier hors de votre dossier personnel, sur un disque de cette machine (pas un partage réseau) : sinon, le nouveau dossier n'est pas suivi.")}
      </p>
      <p className="text-xs text-muted-foreground">
        {t("Pour les nouveaux modèles seulement, sans rien déplacer : dans l'application LM Studio, My Models, puis Change. Les téléchargements en cours passent encore par le disque principal, dans le dossier de LM Studio, avant d'être rangés au nouvel endroit.")}
      </p>
      {m.modeles && (
        <p className="text-xs text-muted-foreground">{tf("Les modèles de LM Studio sont rangés dans {0} (réglage de LM Studio).", m.modeles)}</p>
      )}
      {etat.admin && etat.revenir && !etat.parDefaut && (
        <Button size="sm" variant="ghost" className="h-auto min-h-8 py-1.5 text-start" icon={RotateCcw} disabled={occupe} onClick={revenir}>
          {t("Revenir à l'emplacement habituel")}
        </Button>
      )}
    </div>
  );
}

export default EmplacementModeles;
