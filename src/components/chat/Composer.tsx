import { useCallback, useEffect, useRef, useState, type ReactNode, type KeyboardEvent, type ClipboardEvent } from "react";
import { Film,
  Plus,
  Mic,
  ArrowUp,
  Square,
  FileText,
  Image as ImageIcon,
  X,
  Loader2,
  TriangleAlert,
  Paperclip,
  Globe,
  Check,
  ListPlus,
} from "lucide-react";
import { imagesDuCollage } from "@/lib/pressePapierImages";
import { ACCEPT, type Attachment } from "@/lib/attachments";
import type { EtatRechercheWeb } from "@/lib/rechercheWeb";
import { IconButton } from "@/components/ui/IconButton";
import { Popover } from "@/components/ui/Popover";
import { Button } from "@/components/ui/Button";
import { InfoBox } from "@/components/ui/InfoBox";
import { ModelBehaviorPicker, ReasoningPicker } from "./ModelPicker";
import { cn } from "@/lib/cn";
import { instance } from "@/lib/instance";
import * as dictee from "@/lib/dictee";
import { t, tf, lister } from "@/lib/i18n";

interface ComposerProps {
  placeholder: string;
  /** Contenu de la barre de contexte (chips a gauche, actions a droite). */
  contextBar?: ReactNode;
  className?: string;
  /** Champ contrôlé. Sans `value`, le composer reste décoratif. */
  value?: string;
  onChange?: (value: string) => void;
  onSubmit?: () => void;
  /** Génération en cours : le bouton d'envoi devient un bouton d'arrêt (sauf file d'attente, ci-dessous). */
  busy?: boolean;
  onStop?: () => void;
  /**
   * File d'attente du Chat (29/09/2026) : pendant une réponse, Entrée et le
   * bouton d'envoi mettent le message en file au lieu de ne rien faire, et
   * « Arrêter » devient un bouton à part, à gauche. Absent (écran Code) : le
   * bouton d'envoi devient « Arrêter », comme avant.
   */
  onMettreEnFile?: () => void;
  /** Ce qui s'affiche au-dessus du champ, dans la carte : la file d'attente. */
  enTete?: ReactNode;
  /** Modèle sélectionné (uid passerelle) et changement de sélection. */
  modelUid?: string;
  /** `undefined` veut dire « Auto » : c'est l'instance qui choisit. */
  onModelChange?: (uid?: string) => void;
  effort?: string;
  onEffortChange?: (effort: string) => void;
  /** Pièces jointes en attente d'envoi, et leur gestion. */
  pieces?: Attachment[];
  /** Fichiers dont le texte est en cours d'extraction : l'envoi attend qu'ils soient lus. */
  piecesEnLecture?: string[];
  onAjouterFichiers?: (fichiers: File[]) => void;
  onRetirerPiece?: (index: number) => void;
  /** Menu « + » : « Créer une image ». Absent : pas d'entrée image dans le menu. */
  onCreerImage?: () => void;
  /** « Créer une vidéo » dans le menu « + » (27/09/2026). */
  onCreerVideo?: () => void;
  /**
   * « Rechercher sur le web » dans le menu « + » (28/09/2026) : une bascule,
   * montrée ensuite en puce (`accessoire`). `etat` vient de l'instance :
   * `undefined` pendant la lecture, `null` si elle ne répond pas.
   */
  rechercheWeb?: { actif: boolean; onChange: (actif: boolean) => void; etat: EtatRechercheWeb | null | undefined };
  /** Pastille affichée à côté du « + » (outil choisi dans le menu, par exemple « Image »). */
  accessoire?: ReactNode;
  /** Le moteur choisit lui-même son modèle (Codex, écran Code) : ni modèle ni niveau à proposer. */
  sansModele?: boolean;
}

/**
 * Composer : barre de contexte en retrait + champ de saisie + ligne d'outils
 * (plus a gauche ; modele, niveau de raisonnement, micro, envoi a droite).
 */
export function Composer({
  placeholder,
  contextBar,
  className,
  value,
  onChange,
  onSubmit,
  busy,
  onStop,
  modelUid,
  onModelChange,
  effort,
  onEffortChange,
  pieces = [],
  piecesEnLecture = [],
  onAjouterFichiers,
  onRetirerPiece,
  onCreerImage,
  onCreerVideo,
  rechercheWeb,
  accessoire,
  sansModele = false,
  onMettreEnFile,
  enTete,
}: ComposerProps) {
  const [menuPlus, setMenuPlus] = useState(false);
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const fichierRef = useRef<HTMLInputElement>(null);
  const controlled = value !== undefined;
  // Un document joint se suffit à lui-même : « résume ça » peut rester implicite.
  /*
   * Pas d'envoi pendant qu'un fichier est lu (27/09/2026) : la lecture d'un
   * PDF prend plusieurs secondes sur un PC modeste, et la question partait
   * sans lui si l'on appuyait sur Entrée entre-temps. Le modèle répondait
   * alors qu'il ne voyait aucun document.
   */
  const pret = controlled && (value.trim().length > 0 || pieces.length > 0) && piecesEnLecture.length === 0;
  const canSend = pret && !busy;
  /*
   * Pendant une réponse, le message part dans la file du Chat. Avant le
   * 29/09/2026, Entrée ne faisait rien et le bouton d'envoi devenait
   * « Arrêter » à la même place : on coupait la réponse en voulant envoyer
   * la suite (demande de Medhi : « il y a des gens impatients »).
   */
  const enFile = Boolean(busy && onMettreEnFile);
  const canQueue = pret && enFile;

  /*
   * La transcription prend quelques secondes, pendant lesquelles on peut avoir
   * continué à taper : le texte dicté s'ajoute donc à la valeur **du moment**,
   * lue ici, et non à celle qui existait quand on a cliqué sur le micro.
   */
  const valeurRef = useRef(value ?? "");
  valeurRef.current = value ?? "";
  const insererDictee = useCallback(
    (texte: string) => {
      const avant = valeurRef.current;
      const separateur = avant && !/\s$/.test(avant) ? " " : "";
      onChange?.(avant + separateur + texte);
      // Le texte est inséré, jamais envoyé : on rend la main dans le champ.
      requestAnimationFrame(() => {
        const zone = areaRef.current;
        if (!zone) return;
        autoGrow(zone);
        zone.focus();
        zone.setSelectionRange(zone.value.length, zone.value.length);
      });
    },
    [onChange],
  );

  const choisir = (liste: FileList | null) => {
    if (liste && liste.length > 0) onAjouterFichiers?.([...liste]);
    // Réinitialise, sinon choisir deux fois le même fichier ne déclenche rien.
    if (fichierRef.current) fichierRef.current.value = "";
  };

  /*
   * Glisser-déposer sur **toute la fenêtre**, pas seulement sur la carte du
   * composeur. Un fichier lâché à côté de la carte était perdu, et dans
   * l'application de bureau le navigateur tentait même de l'ouvrir. On
   * intercepte donc au niveau de la fenêtre, et on montre où déposer.
   */
  const [survol, setSurvol] = useState(false);
  const ajouterRef = useRef(onAjouterFichiers);
  ajouterRef.current = onAjouterFichiers;
  const actif = Boolean(onAjouterFichiers);
  useEffect(() => {
    if (!actif) return;
    let profondeur = 0;
    const porteDesFichiers = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes("Files");
    const entree = (e: DragEvent) => {
      if (!porteDesFichiers(e)) return;
      e.preventDefault();
      profondeur += 1;
      setSurvol(true);
    };
    const survole = (e: DragEvent) => {
      if (!porteDesFichiers(e)) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
    };
    const sortie = (e: DragEvent) => {
      if (!porteDesFichiers(e)) return;
      profondeur = Math.max(0, profondeur - 1);
      if (profondeur === 0) setSurvol(false);
    };
    const depot = (e: DragEvent) => {
      if (!porteDesFichiers(e)) return;
      e.preventDefault();
      profondeur = 0;
      setSurvol(false);
      const fichiers = e.dataTransfer?.files;
      if (fichiers && fichiers.length > 0) ajouterRef.current?.([...fichiers]);
    };
    window.addEventListener("dragenter", entree);
    window.addEventListener("dragover", survole);
    window.addEventListener("dragleave", sortie);
    window.addEventListener("drop", depot);
  return () => {
      window.removeEventListener("dragenter", entree);
      window.removeEventListener("dragover", survole);
      window.removeEventListener("dragleave", sortie);
      window.removeEventListener("drop", depot);
    };
  }, [actif]);

  const autoGrow = (el: HTMLTextAreaElement) => {
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 208)}px`;
  };
  /*
   * Le champ vidé par l'envoi ou la mise en file reprend sa hauteur d'une
   * ligne (29/09/2026) : après un message de plusieurs lignes, il restait
   * haut et vide, et poussait la file et la conversation vers le haut.
   */
  useEffect(() => {
    if (value === "" && areaRef.current) areaRef.current.style.height = "";
  }, [value]);
  /*
   * Au premier envoi d'un Chat neuf, l'écran passe de l'accueil à la
   * conversation et le composeur renaît ailleurs, sans le curseur : ce que la
   * personne tapait aussitôt pour la file se perdait (vu le 29/09/2026). Né
   * pendant une réponse, sans rien d'autre qui ait la main, il la reprend.
   */
  useEffect(() => {
    if (busy && onMettreEnFile && document.activeElement === document.body) areaRef.current?.focus();
    // Seulement à la naissance du composeur.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (canSend) onSubmit?.();
      else if (canQueue) onMettreEnFile?.();
    }
  };

  const collerImages = (e: ClipboardEvent<HTMLTextAreaElement>) => {
              if (!onAjouterFichiers) return;
              const images = imagesDuCollage(e.clipboardData);
              if (!images.length) return;
              e.preventDefault();
              onAjouterFichiers(images);
              // Un collage mixte conserve aussi son texte, à la position du curseur.
              const texte = e.clipboardData.getData("text/plain");
              if (texte && !/^https?:\/\/\S+$/.test(texte.trim())) {
                const zone = e.currentTarget;
                const debut = zone.selectionStart; const fin = zone.selectionEnd;
                onChange?.((value ?? "").slice(0, debut) + texte + (value ?? "").slice(fin));
                requestAnimationFrame(() => { zone.setSelectionRange(debut + texte.length, debut + texte.length); autoGrow(zone); });
              }

  };
  return (
    <div className={cn("w-full", className)}>
      <div className="rounded-2xl bg-muted/50 p-1.5">
        {enTete}
        {contextBar && (
          /*
           * Une seule ligne : quand la place manque, les libellés des puces se
           * raccourcissent (points de suspension, libellé complet au survol)
           * au lieu de faire passer la dernière puce seule sur une seconde
           * ligne (vu par Medhi le 26/09/2026 dans Cowork : « Connaissances »
           * tombait en dessous). Pas d'`overflow-hidden` ici : il couperait
           * les menus qui s'ouvrent sous les puces.
           */
          <div className="flex min-w-0 flex-nowrap items-center gap-1 px-1.5 py-1 [&>*]:min-w-0">{contextBar}</div>
        )}
        {/* La carte porte l'etat de focus, pas le textarea : un seul contour. */}
        {survol && (
          <div
            aria-hidden
            className="pointer-events-none fixed inset-3 z-50 flex items-center justify-center rounded-2xl border-2 border-dashed border-accent bg-background/85 backdrop-blur-sm"
          >
            <div className="flex flex-col items-center gap-2 text-center">
              <FileText size={28} strokeWidth={1.5} className="text-accent" />
              <p className="text-base font-medium text-foreground">{t("Déposez pour joindre")}</p>
              <p className="text-sm text-muted-foreground">
                {t("PDF, Word, Excel, PowerPoint, OpenDocument, texte ou image")}
              </p>
            </div>
          </div>
        )}
        <div
          className={cn(
            // Au focus, comme ailleurs : le bord fonce à peine et l'ombre s'étoffe, en gris, sans couleur.
            // `cq` : la barre du bas se règle sur la largeur réelle du champ, pas sur celle de la fenêtre.
            "cq rounded-xl border border-border bg-card shadow-sm transition-[border-color,box-shadow] duration-150 focus-within:border-foreground/20 focus-within:shadow-md",
            survol && "border-accent",
          )}
        >
          {(pieces.length > 0 || piecesEnLecture.length > 0) && (
            <ul className="flex flex-wrap gap-1.5 px-3 pt-3">
              {piecesEnLecture.map((nom, i) => (
                <li
                  key={`lecture-${nom}-${i}`}
                  className="inline-flex max-w-[220px] items-center gap-1.5 rounded-lg bg-muted px-2 py-1 text-xs text-muted-foreground"
                  title={t("Lecture du fichier sur ce poste : l'envoi attend qu'elle soit finie.")}
                >
                  <Loader2 size={13} strokeWidth={1.75} className="shrink-0 animate-spin" />
                  <span className="truncate">{tf("Lecture de {0}...", nom)}</span>
                </li>
              ))}
              {pieces.map((piece, i) => (
                <li
                  key={`${piece.nom}-${i}`}
                  className="inline-flex max-w-[220px] items-center gap-1.5 rounded-lg bg-muted px-2 py-1 text-xs text-foreground"
                >
                  {piece.type === "image" ? (
                    <ImageIcon size={13} strokeWidth={1.75} className="shrink-0 text-muted-foreground" />
                  ) : (
                    <FileText size={13} strokeWidth={1.75} className="shrink-0 text-muted-foreground" />
                  )}
                  <span className="truncate">{piece.nom}</span>
                  {piece.type === "texte" && piece.tronque && (
                    <span
                      className="shrink-0 text-muted-foreground"
                      title={t("Trop long pour être lu en entier : seul son début (environ 200 000 caractères) part avec la question. Pour un long document, déposez-le dans Fichiers : le modèle y cherche et le lit par passages.")}
                    >
                      {t("(début)")}
                    </span>
                  )}
                  <button
                    type="button"
                    aria-label={tf("Retirer {0}", piece.nom)}
                    onClick={() => onRetirerPiece?.(i)}
                    className="-me-0.5 shrink-0 rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <X size={12} strokeWidth={2} />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <textarea
            className="block max-h-52 w-full resize-none bg-transparent px-4 pb-2 pt-3.5 text-[15px] leading-relaxed text-foreground placeholder:overflow-hidden placeholder:text-ellipsis placeholder:whitespace-nowrap placeholder:text-muted-foreground focus:outline-none"
            ref={areaRef}
            rows={1}
            placeholder={placeholder}
            aria-label={placeholder}
            value={value}
            onChange={(e) => {
              onChange?.(e.target.value);
              autoGrow(e.target);
            }}
            onPaste={collerImages}
            onKeyDown={onKeyDown}
            /*
             * L'invite sur une ligne, en points de suspension (tournée finale du 28/09/2026) : à
             * 375 px, elle passait sur deux lignes dans un champ d'une ligne, et le haut de la
             * seconde restait visible sous la première (« Posez votre question... @ », puis un
             * bout de lettre coupé). Le texte tapé, lui, passe toujours à la ligne.
             */
            /*
             * Le texte tapé s'aligne selon sa langue (30/09/2026) : de l'arabe
             * dans une interface française part de la droite, du français dans
             * une interface arabe de la gauche. Vide, le champ suit l'interface
             * (l'invite est dans sa langue).
             */
            dir={value ? "auto" : undefined}
          />
          {/*
            Relevé le 27/09/2026 (Code et Cowork, en français) : le libellé du
            niveau d'approbation se coupait à toute largeur de fenêtre dès que le
            modèle choisi avait un nom un peu long, parce que le groupe de droite
            ne savait pas rétrécir ; et à 375 px, ce groupe débordait du champ,
            bouton d'envoi compris. Désormais le nom du modèle se raccourcit le
            premier (le champ assez large, la puce de l'accessoire garde sa
            taille), et un champ très étroit passe la ligne en deux.
          */}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 px-2.5 pb-2.5 pt-1 cq-xs:flex-nowrap">
            <input
              ref={fichierRef}
              type="file"
              multiple
              accept={ACCEPT}
              className="hidden"
              onChange={(e) => choisir(e.target.files)}
            />
            {/*
              * Le « + » ouvre un menu, comme dans ChatGPT : joindre, ou changer
              * ce que fera l'envoi (créer une image). Sans autre entrée que
              * « joindre », il joint directement.
              */}
            {onCreerImage ? (
              <Popover
                open={menuPlus}
                onOpenChange={setMenuPlus}
                align="start"
                width={440}
                trigger={(p) => (
                  <IconButton icon={Plus} label={t("Ajouter")} onClick={p.onClick} aria-expanded={p["aria-expanded"]} />
                )}
              >
                <button
                  type="button"
                  onClick={() => {
                    setMenuPlus(false);
                    fichierRef.current?.click();
                  }}
                  className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-start hover:bg-muted"
                >
                  <Paperclip size={16} strokeWidth={1.75} className="shrink-0 text-foreground" />
                  <span className="shrink-0 whitespace-nowrap text-sm text-foreground">{t("Ajouter des photos et fichiers")}</span>
                  <span className="truncate text-xs text-muted-foreground">{t("Depuis l'ordinateur")}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMenuPlus(false);
                    onCreerImage();
                  }}
                  className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-start hover:bg-muted"
                >
                  <ImageIcon size={16} strokeWidth={1.75} className="shrink-0 text-foreground" />
                  <span className="shrink-0 whitespace-nowrap text-sm text-foreground">{t("Créer une image")}</span>
                  <span className="truncate text-xs text-muted-foreground">{t("Transformez vos idées en images")}</span>
                </button>
                {onCreerVideo && (
                  <button
                    type="button"
                    onClick={() => {
                      setMenuPlus(false);
                      onCreerVideo();
                    }}
                    className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-start hover:bg-muted"
                  >
                    <Film size={16} strokeWidth={1.75} className="shrink-0 text-foreground" />
                    <span className="shrink-0 whitespace-nowrap text-sm text-foreground">{t("Créer une vidéo")}</span>
                    <span className="truncate text-xs text-muted-foreground">{t("Quelques secondes, sur cette machine")}</span>
                  </button>
                )}
                {rechercheWeb && <EntreeRechercheWeb {...rechercheWeb} fermer={() => setMenuPlus(false)} />}
              </Popover>
            ) : (
              <IconButton
                icon={Plus}
                label={t("Joindre un document ou une image")}
                onClick={() => fichierRef.current?.click()}
              />
            )}
            {accessoire && <div className="flex min-w-0 cq-md:shrink-0">{accessoire}</div>}
            <div className="ms-auto flex min-w-0 items-center gap-0.5">
              {!sansModele && <ModelBehaviorPicker value={modelUid} onChange={onModelChange} />}
              {/* Le niveau de réflexion garde son mot court : c'est le nom du modèle qui se raccourcit. */}
              {!sansModele && (
                <div className="flex shrink-0">
                  <ReasoningPicker value={effort} onChange={onEffortChange} />
                </div>
              )}
              {/* Sans champ contrôlé, il n'y aurait nulle part où écrire la dictée. */}
              {controlled && onChange && <BoutonDictee onTexte={insererDictee} />}
              {enFile ? (
                <>
                  {/*
                    « Arrêter » à part, en retrait, et l'envoi à sa place habituelle, tout à
                    droite : c'est là que la personne clique pour envoyer la suite.
                  */}
                  <button
                    type="button"
                    aria-label={t("Arrêter la génération")}
                    title={t("Arrêter la génération")}
                    onClick={onStop}
                    className="ms-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-card text-foreground transition-colors hover:bg-muted"
                  >
                    <Square size={13} strokeWidth={2} className="fill-current" />
                  </button>
                  <button
                    type="button"
                    aria-label={t("Mettre en file")}
                    title={t("Mettre en file : votre message partira quand la réponse en cours sera finie")}
                    onClick={() => canQueue && onMettreEnFile?.()}
                    disabled={!canQueue}
                    className={cn(
                      "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-opacity",
                      canQueue ? "hover:opacity-90" : "opacity-40",
                    )}
                  >
                    <ListPlus size={18} strokeWidth={2} />
                  </button>
                </>
              ) : busy ? (
                <button
                  type="button"
                  aria-label={t("Arrêter la génération")}
                  onClick={onStop}
                  className="ms-1 inline-flex shrink-0 h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground transition-opacity hover:opacity-90"
                >
                  <Square size={14} strokeWidth={2} className="fill-current" />
                </button>
              ) : (
                <button
                  type="button"
                  aria-label={t("Envoyer")}
                  onClick={() => canSend && onSubmit?.()}
                  disabled={controlled && !canSend}
                  className={cn(
                    "ms-1 inline-flex shrink-0 h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground transition-opacity",
                    controlled && !canSend
                      ? "opacity-40"
                      : "hover:opacity-90",
                  )}
                >
                  <ArrowUp size={18} strokeWidth={2} />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------- recherche sur le web ------------------------- */

/**
 * L'entrée « Rechercher sur le web » du menu « + » (28/09/2026) : une bascule,
 * cochée quand elle est active. Elle dit à qui partent les questions ; quand
 * l'instance l'interdit (profil de déploiement) ou ne répond pas, elle reste
 * visible, désactivée, avec la raison sous son nom plutôt qu'au survol.
 */
function EntreeRechercheWeb({
  actif,
  onChange,
  etat,
  fermer,
}: {
  actif: boolean;
  onChange: (actif: boolean) => void;
  etat: EtatRechercheWeb | null | undefined;
  fermer: () => void;
}) {
  const possible = Boolean(etat?.autorisee);
  const raison =
    etat === undefined
      ? t("Lecture...")
      : etat === null
        ? t("Indisponible : l'instance ne répond pas.")
        : !etat.autorisee
          ? (etat.raison ?? t("Désactivée sur cette instance."))
          : null;
  return (
    <button
      type="button"
      role="menuitemcheckbox"
      aria-checked={actif}
      disabled={!possible}
      onClick={() => {
        fermer();
        onChange(!actif);
      }}
      className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-start hover:bg-muted disabled:cursor-not-allowed disabled:hover:bg-transparent"
    >
      <Globe size={16} strokeWidth={1.75} className={cn("shrink-0", possible ? "text-foreground" : "text-muted-foreground")} />
      <span className="min-w-0 flex-1">
        {/*
          Pas de points de suspension ici, à la différence des autres entrées :
          le nom du moteur est l'information, et il se coupait à 375 px en
          japonais (« 質問は DuckDuck… »). La phrase passe à la ligne à la place.
        */}
        <span className="flex min-w-0 flex-wrap items-baseline gap-x-3">
          <span className={cn("shrink-0 whitespace-nowrap text-sm", possible ? "text-foreground" : "text-muted-foreground")}>
            {t("Rechercher sur le web")}
          </span>
          {possible && etat && (
            <span className="text-xs text-muted-foreground">{tf("Vos questions partent à {0}", etat.moteur)}</span>
          )}
        </span>
        {raison && <span className="mt-0.5 block text-xs text-muted-foreground">{raison}</span>}
      </span>
      {actif && possible && <Check size={15} strokeWidth={2} className="shrink-0 text-foreground" />}
    </button>
  );
}

/* --------------------------------- dictée ---------------------------------- */

type ModeDictee = "repos" | "enregistrement" | "transcription";

const minutes = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

/**
 * Bouton micro : clic pour commencer, clic pour arrêter, texte inséré dans le
 * champ (jamais envoyé tout seul).
 *
 * Il ne fait jamais semblant. Tant que l'instance n'a pas la dictée, le même
 * bouton ouvre un panneau qui le dit, annonce ce qui sera téléchargé et la
 * place occupée, et n'installe qu'au clic sur « Installer ». Si l'instance ne
 * répond pas, il est désactivé et dit pourquoi.
 */
function BoutonDictee({ onTexte }: { onTexte: (texte: string) => void }) {
  const [diag, setDiag] = useState<dictee.DiagnosticDictee | null | undefined>(undefined);
  const [mode, setMode] = useState<ModeDictee>("repos");
  const [secondes, setSecondes] = useState(0);
  const [ouvert, setOuvert] = useState(false);
  const [message, setMessage] = useState<{ ton: "erreur" | "info"; texte: string } | null>(null);
  const [installation, setInstallation] = useState(false);
  const [progres, setProgres] = useState<dictee.ProgresDictee | null>(null);
  const enregistreur = useRef<dictee.Enregistreur | null>(null);

  useEffect(() => {
    let vivant = true;
    void dictee.etat().then((d) => {
      if (vivant) setDiag(d);
    });
    return () => {
      vivant = false;
      // Quitter l'écran en pleine dictée referme le micro, sans rien envoyer.
      enregistreur.current?.abandonner();
    };
  }, []);

  const signaler = (ton: "erreur" | "info", texte: string) => {
    setMessage({ ton, texte });
    setOuvert(true);
  };

  const demarrer = async () => {
    setMessage(null);
    setOuvert(false);
    if (!dictee.captureDisponible()) {
      signaler("erreur", t("Ce poste ne permet pas de capturer le micro."));
      return;
    }
    const nouvel = new dictee.Enregistreur();
    try {
      await nouvel.demarrer();
    } catch (err) {
      signaler("erreur", dictee.messageErreurMicro(err));
      return;
    }
    enregistreur.current = nouvel;
    setMode("enregistrement");
  };

  const arreter = async () => {
    const courant = enregistreur.current;
    if (!courant) return;
    enregistreur.current = null;
    setMode("transcription");
    try {
      const son = await courant.arreter();
      const resultat = await dictee.transcrire(son);
      if (resultat.texte) onTexte(resultat.texte);
      else signaler("info", t("Aucune parole n'a été reconnue dans l'enregistrement."));
    } catch (err) {
      signaler("erreur", err instanceof Error ? err.message : t("La transcription a échoué."));
      // La dictée a peut-être été retirée entre-temps : l'état fait foi.
      void dictee.etat().then(setDiag);
    } finally {
      setMode("repos");
    }
  };

  // Chronomètre visible, et arrêt automatique à la durée maximale.
  const arreterRef = useRef(arreter);
  arreterRef.current = arreter;
  useEffect(() => {
    if (mode !== "enregistrement") return;
    const debut = Date.now();
    setSecondes(0);
    const minuterie = setInterval(() => {
      const ecoule = Math.floor((Date.now() - debut) / 1000);
      setSecondes(ecoule);
      if (ecoule >= dictee.DICTEE_MAX_SECONDES) void arreterRef.current();
    }, 250);
    return () => clearInterval(minuterie);
  }, [mode]);

  const installer = async () => {
    setInstallation(true);
    setMessage(null);
    setProgres({ phase: "verification", message: t("Démarrage de l'installation..."), percent: 1 });
    try {
      const bilan = await dictee.installer(setProgres);
      setDiag(bilan.diagnostic);
      if (bilan.ok) signaler("info", t("La dictée est prête. Cliquez sur le micro pour dicter."));
      else signaler("erreur", bilan.message);
    } catch (err) {
      signaler("erreur", err instanceof Error ? err.message : t("L'installation a échoué."));
      void dictee.etat().then(setDiag);
    } finally {
      setInstallation(false);
      setProgres(null);
    }
  };

  const declencheur = () => {
    if (diag === undefined) {
      return <IconButton icon={Mic} label={t("Dicter")} title={t("Vérification de la dictée...")} disabled />;
    }
    if (diag === null) {
      return (
        <IconButton
          icon={Mic}
          label={t("Dicter")}
          title={t("Dictée indisponible : l'instance ne répond pas.")}
          disabled
        />
      );
    }
    if (mode === "enregistrement") {
      return (
        <button
          type="button"
          onClick={() => void arreter()}
          aria-label={t("Arrêter la dictée et transcrire")}
          title={t("Arrêter la dictée et transcrire")}
          className="inline-flex h-[34px] items-center gap-1.5 rounded-lg bg-destructive/10 px-2.5 text-sm font-medium tabular-nums text-destructive transition-colors hover:bg-destructive/15"
        >
          <span aria-hidden className="h-2 w-2 animate-pulse rounded-full bg-destructive" />
          {minutes(secondes)}
          <Square size={11} strokeWidth={2} className="fill-current" />
        </button>
      );
    }
    if (mode === "transcription") {
      return (
        <span
          role="status"
          className="inline-flex h-[34px] items-center gap-1.5 px-2 text-sm text-muted-foreground"
        >
          <Loader2 size={15} strokeWidth={1.75} className="animate-spin" />
          {t("Transcription...")}
        </span>
      );
    }
    if (!diag.installee) {
      return (
        <IconButton
          icon={Mic}
          label={t("Dicter (dictée à installer)")}
          aria-expanded={ouvert}
          onClick={() => {
            setOuvert((o) => !o);
            // L'état a pu changer depuis l'ouverture de l'écran (installation ailleurs).
            void dictee.etat().then((d) => d && setDiag(d));
          }}
        />
      );
    }
    return <IconButton icon={Mic} label={t("Dicter")} onClick={() => void demarrer()} />;
  };

  const provenance = diag
    ? [
        !diag.paquetInstalle && t("moteur de transcription depuis PyPI"),
        !diag.modeleInstalle && tf("modèle depuis {0}", diag.source),
      ].filter(Boolean)
    : [];

  return (
    <Popover
      open={ouvert}
      onOpenChange={setOuvert}
      side="top"
      align="end"
      width={340}
      trigger={declencheur}
    >
      <div className="space-y-3 p-2 text-sm">
        {diag && !diag.installee && (
          <>
            <div>
              <p className="font-medium text-foreground">{t("Dictée locale, à installer")}</p>
              <p className="mt-1 text-muted-foreground">
                {t("Votre voix est transcrite")}{" "}{instance().remote ? t("par votre instance") : t("sur ce poste")}{" "}
                {t("par le modèle")}{" "}{diag.modele}{t(". Pendant la dictée, rien ne part vers un service extérieur.")}
              </p>
            </div>

            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
              {/*
               * Le modèle est choisi selon la machine qui transcrit, comme le
               * modèle de conversation au premier démarrage. On dit pourquoi :
               * une installation de 1,5 Go ne se découvre pas après coup.
               */}
              <dt className="text-muted-foreground">{t("Choisi pour")}</dt>
              <dd className="text-foreground">{diag.raison}</dd>
              <dt className="text-muted-foreground">{t("À télécharger")}</dt>
              <dd className="text-foreground">{diag.telechargementMo}{" "}{t("Mo, une seule fois")}</dd>
              <dt className="text-muted-foreground">{t("Sur le disque")}</dt>
              <dd className="text-foreground">{diag.placeMo}{" "}{t("Mo")}</dd>
              {provenance.length > 0 && (
                <>
                  <dt className="text-muted-foreground">{t("Provenance")}</dt>
                  <dd className="text-foreground">{lister(provenance)}</dd>
                </>
              )}
              <dt className="text-muted-foreground">{t("Dossier")}</dt>
              <dd className="break-all font-mono text-[11px] text-foreground">{diag.dossier}</dd>
            </dl>

            {diag.obstacles.map((obstacle) => (
              <InfoBox
                key={obstacle}
                tone="warning"
                leading={<TriangleAlert size={14} strokeWidth={1.75} />}
                className="p-2.5 text-xs"
              >
                {obstacle}
              </InfoBox>
            ))}

            {diag.installationEnCours && !installation && (
              <p className="text-xs text-muted-foreground">
                {t("Une installation est déjà en cours sur l'instance. Réessayez dans quelques minutes.")}
              </p>
            )}

            {progres ? (
              <div className="space-y-1.5" role="status">
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-[width] duration-500"
                    style={{ width: `${Math.max(2, Math.min(100, progres.percent))}%` }}
                  />
                </div>
                <p className="text-xs text-foreground">{progres.message}</p>
                {progres.detail && (
                  <p className="truncate text-[11px] text-muted-foreground">{progres.detail}</p>
                )}
              </div>
            ) : (
              <Button
                size="sm"
                block
                onClick={() => void installer()}
                disabled={!diag.installable || installation || diag.installationEnCours}
              >
                {t("Installer la dictée (")}{diag.telechargementMo}{" "}{t("Mo)")}
              </Button>
            )}
          </>
        )}

        {message && (
          <p
            role={message.ton === "erreur" ? "alert" : "status"}
            className={cn(
              "text-xs",
              message.ton === "erreur" ? "text-destructive" : "text-foreground",
            )}
          >
            {message.texte}
          </p>
        )}
      </div>
    </Popover>
  );
}

export default Composer;
