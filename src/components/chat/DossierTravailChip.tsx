import { useCallback, useEffect, useState } from "react";
import { FolderOpen, CornerLeftUp, Check, Folder, FolderSearch, Laptop } from "lucide-react";
import { Chip } from "@/components/ui/Chip";
import { Popover } from "@/components/ui/Popover";
import { apiFetch } from "@/lib/endpoint";
import { cn } from "@/lib/cn";
import { t } from "@/lib/i18n";

/**
 * Choix du dossier sur lequel un agent travaille — Cowork comme Code.
 *
 * Un agent cantonné à un répertoire fixé à l'installation ne sert qu'à moitié :
 * les dossiers d'une entreprise sont là où elle les a mis. Ce sélecteur laisse
 * désigner le périmètre, et rien d'autre n'est atteignable.
 *
 * Le parcours est borné au dossier personnel côté instance : ce qu'on affiche
 * ici n'est qu'une commodité, la vérification n'est pas dans le navigateur.
 */

interface Raccourci {
  nom: string;
  chemin: string;
}

interface Contenu {
  chemin: string;
  parent: string | null;
  dossiers: string[];
  courant: string;
  raccourcis?: Raccourci[];
}

/**
 * Sélecteur de dossier du système, quand l'application tourne sur le poste.
 *
 * Remonter une arborescence clic par clic dans une liste maison est pénible et
 * ne ressemble à rien de ce que les gens connaissent. Quand le pont est là, on
 * ouvre la fenêtre de macOS, celle que tout le monde sait utiliser.
 */
declare global {
  interface Window {
    helix?: { choisirDossier?: (options?: { titre?: string; message?: string; bouton?: string }) => Promise<string | null> };
  }
}

const selecteurNatif = () =>
  typeof window !== "undefined" ? window.helix?.choisirDossier : undefined;

/** Affiche un chemin de façon lisible : « ~/Projets/site ». */
function abreger(chemin: string): string {
  const maison = chemin.match(/^\/Users\/[^/]+/)?.[0];
  return maison ? chemin.replace(maison, "~") : chemin;
}

/**
 * Nom court porté par la puce.
 *
 * Le dernier segment du chemin suffit presque toujours. Deux exceptions où il
 * ne veut rien dire : le dossier personnel, qui s'abrégeait en « ~ », et la
 * racine d'un disque, qui donnait une chaîne vide.
 */
function etiquette(chemin: string): string {
  if (/^\/Users\/[^/]+$/.test(chemin)) return "Dossier personnel";
  return chemin.split("/").filter(Boolean).pop() ?? chemin;
}

export function DossierTravailChip({
  dossier,
  onChange,
  titre = t("Dossier de travail"),
  aide,
  toutLePoste,
  libelle,
  surToutLePoste,
}: {
  /** Dossier retenu, ou `undefined` pour celui de l'instance. */
  dossier?: string;
  /** Action explicite quand le choix du dossier ouvre un projet. */
  libelle?: string;
  onChange: (chemin: string) => void;
  titre?: string;
  /** Phrase expliquant ce que le choix implique sur cet écran. */
  aide?: string;
  /** L'agent a-t-il déjà accès au poste entier ? */
  toutLePoste?: boolean;
  /**
   * Ouvre le poste entier. Absent sur les écrans où cela n'a pas de sens —
   * l'écran Code travaille sur un projet, pas sur une machine.
   */
  surToutLePoste?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [contenu, setContenu] = useState<Contenu | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  const parcourir = useCallback((chemin?: string) => {
    const url = chemin
      ? `/helix/dossiers?chemin=${encodeURIComponent(chemin)}`
      : "/helix/dossiers";
    void apiFetch(url)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: Contenu) => {
        setContenu(d);
        setErreur(null);
      })
      .catch((err: unknown) => {
        /*
         * Dire ce qui s'est passé, pas seulement que ça a raté. Un 401 veut
         * dire que l'instance ne reconnaît plus ce poste — l'application
         * ramène alors à la connexion, et ce message explique pourquoi.
         */
        const code = err instanceof Error ? err.message : "";
        setErreur(
          code === "401"
            ? t("Session expirée : reconnectez-vous pour parcourir vos dossiers.")
            : t("Ces dossiers ne peuvent pas être lus. Vérifiez que l'instance répond."),
        );
      });
  }, []);

  useEffect(() => {
    if (open && !contenu) parcourir(dossier);
  }, [open, contenu, dossier, parcourir]);

  const affiche = dossier ?? contenu?.courant;

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      align="start"
      width={340}
      trigger={(p) => (
        <Chip
          leading={<FolderOpen size={15} strokeWidth={1.75} />}
          onClick={p.onClick}
          active={open}
          aria-expanded={p["aria-expanded"]}
          // Le nom seul suffit à s'y retrouver, mais deux dossiers peuvent le
          // partager : le chemin complet au survol lève le doute.
          title={
            toutLePoste
              ? t("Tout votre poste : vos documents et vos disques branchés")
              : affiche
                ? abreger(affiche)
                : titre
          }
        >
          {libelle ? (affiche ? `${libelle} · ${etiquette(affiche)}` : libelle) : (toutLePoste ? t("Tout mon poste") : affiche ? etiquette(affiche) : titre)}
        </Chip>
      )}
    >
      <p className="px-2.5 pb-1 pt-1 text-sm font-semibold text-foreground">{titre}</p>
      {aide && <p className="px-2.5 pb-1.5 text-xs text-muted-foreground">{aide}</p>}
      <p className="px-2.5 pb-2 text-xs text-muted-foreground">
        {contenu ? abreger(contenu.chemin) : t("Lecture...")}
      </p>

      {/*
        Le poste entier, en un choix.
        Le dossier unique est le bon réglage par défaut : il borne ce qu'un
        agent peut abîmer. Mais il y a des journées où l'on travaille sur dix
        dossiers, et choisir le bon avant chaque demande n'est pas un travail.
        On offre donc l'ouverture large, en disant ce qu'elle change, et
        l'instance redemande le mot de passe avant de l'appliquer.
      */}
      {surToutLePoste && (
        <button
          type="button"
          onClick={() => {
            surToutLePoste();
            setOpen(false);
          }}
          className={cn(
            "mb-1 flex w-full items-start gap-2.5 rounded-lg border px-2.5 py-2 text-start transition-colors",
            toutLePoste
              ? "border-foreground/40 bg-muted"
              : "border-border hover:bg-muted",
          )}
        >
          <Laptop size={15} strokeWidth={1.75} className="mt-0.5 shrink-0" />
          <span className="min-w-0">
            <span className="block text-sm text-foreground">
              {t("Tout mon poste")}{" "}{toutLePoste && "(actif)"}
            </span>
            <span className="block text-xs text-muted-foreground">
              {t("Vos documents et vos disques branchés, sans choisir de dossier. Les dossiers du système restent fermés, et chaque modification demande votre accord.")}
            </span>
          </span>
        </button>
      )}

      {selecteurNatif() && (
        <button
          type="button"
          onClick={() => {
            void selecteurNatif()!().then((chemin) => {
              if (!chemin) return;
              onChange(chemin);
              setOpen(false);
            });
          }}
          className="mb-1 flex w-full items-center gap-2.5 rounded-lg border border-border px-2.5 py-2 text-start text-sm text-foreground transition-colors hover:bg-muted"
        >
          <FolderSearch size={15} strokeWidth={1.75} className="shrink-0" />
          {t("Parcourir mon ordinateur...")}
        </button>
      )}

      {contenu?.raccourcis && contenu.raccourcis.length > 0 && (
        <div className="mb-1 flex flex-wrap gap-1">
          {contenu.raccourcis.map((r) => (
            <button
              key={r.chemin}
              type="button"
              onClick={() => parcourir(r.chemin)}
              className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              {r.nom}
            </button>
          ))}
        </div>
      )}

      {/*
        `warning-foreground` est la couleur de texte posee SUR un aplat d'ambre :
        elle reste sombre en theme sombre. Ici le message est sur le fond du
        popover, donc il suit `foreground` — meme couleur qu'avant en clair.
      */}
      {erreur && <p className="px-2.5 pb-2 text-xs text-foreground">{erreur}</p>}

      <div className="max-h-64 overflow-y-auto">
        {contenu?.parent && (
          <button
            type="button"
            onClick={() => parcourir(contenu.parent!)}
            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-start text-sm text-muted-foreground transition-colors hover:bg-muted"
          >
            <CornerLeftUp size={15} strokeWidth={1.75} />
            {t("Dossier parent")}
          </button>
        )}

        {contenu?.dossiers.length === 0 && (
          <p className="px-2.5 py-2 text-xs text-muted-foreground">
            {t("Aucun sous-dossier ici. Vous pouvez tout de même choisir ce dossier.")}
          </p>
        )}

        {contenu?.dossiers.map((nom) => (
          <button
            key={nom}
            type="button"
            onClick={() => parcourir(`${contenu.chemin}/${nom}`)}
            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-start text-sm text-foreground transition-colors hover:bg-muted"
          >
            <Folder size={15} strokeWidth={1.75} className="shrink-0 text-muted-foreground" />
            <span className="min-w-0 truncate">{nom}</span>
          </button>
        ))}
      </div>

      <button
        type="button"
        disabled={!contenu}
        onClick={() => {
          if (!contenu) return;
          onChange(contenu.chemin);
          setOpen(false);
        }}
        className={cn(
          "mt-1 flex w-full items-center justify-center gap-2 rounded-lg border-t border-border px-2.5 py-2.5 text-sm font-medium transition-colors",
          contenu ? "text-foreground hover:bg-muted" : "cursor-not-allowed opacity-50",
        )}
      >
        <Check size={15} strokeWidth={2} />
        {t("Travailler ici")}
      </button>
    </Popover>
  );
}

export default DossierTravailChip;
