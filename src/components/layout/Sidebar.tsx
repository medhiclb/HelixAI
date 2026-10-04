import { useEffect, useState } from "react";
import { ENREGISTREMENT_CHANGE, enregistrementCourant } from "@/lib/reunions";
import { NavLink, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { SessionsCodeListe } from "@/components/code/SessionsCode";
import { ShareSessionModal } from "@/components/chat/ShareSessionModal";
import {
  PanelLeft,
  Plus,
  MessageCircle,
  AppWindow,
  SlidersHorizontal,
  CircleHelp,
  Cloud,
  HardDrive,
  Users2,
  Trash2,
  Archive,
  ArchiveRestore,
  ChevronRight,
  Pencil,
  Loader2,
} from "lucide-react";
import { CHATS_EN_COURS, chatEnCours } from "@/hooks/useChat";
import { useSessions, notifySessionsChanged } from "@/hooks/useSessions";
import type { Session } from "@/lib/store/sessions";
import { LogoHome } from "@/components/ui/Logo";
import { Avatar } from "@/components/ui/Avatar";
import { IconButton } from "@/components/ui/IconButton";
import { SearchInput } from "@/components/ui/SearchInput";
import { primaryNav, secondaryNav, type NavItem } from "@/lib/nav";
import { cn } from "@/lib/cn";
import { BasculeTheme } from "@/components/layout/BasculeTheme";
import { Notifications } from "@/components/layout/Notifications";
import { Aide } from "@/components/layout/Aide";
import { t, tf } from "@/lib/i18n";

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

/** Une conversation dans la liste, avec ses actions au survol. */
function LigneSession({
  session,
  actif,
  archivee,
  onOuvrir,
  onPartager,
  onArchiver,
  onSupprimer,
  onRenommer,
  libelleNom = t("Nom du chat"),
}: {
  session: Session;
  /** Nom du champ de renommage, pour les lecteurs d'écran : « chat » ou « session ». */
  libelleNom?: string;
  actif: boolean;
  archivee: boolean;
  onOuvrir: () => void;
  onPartager: () => void;
  onArchiver: () => void;
  onSupprimer: () => void;
  onRenommer: (titre: string) => void;
}) {
  // Renommer se fait sur place : le nom devient un champ, Entrée valide,
  // Échap annule, cliquer ailleurs valide aussi (comme dans le Finder).
  const [edition, setEdition] = useState<string | null>(null);
  // Une réponse qui s'écrit encore dans ce Chat, même quand on regarde ailleurs.
  const [enCours, setEnCours] = useState(() => chatEnCours(session.id));
  useEffect(() => {
    const relire = () => setEnCours(chatEnCours(session.id));
    relire();
    window.addEventListener(CHATS_EN_COURS, relire);
    return () => window.removeEventListener(CHATS_EN_COURS, relire);
  }, [session.id]);
  const valider = () => {
    if (edition !== null && edition.trim() && edition.trim() !== session.title) onRenommer(edition);
    setEdition(null);
  };

  if (edition !== null) {
    return (
      <li className="relative">
        <input
          autoFocus
          value={edition}
          aria-label={libelleNom}
          maxLength={120}
          onChange={(e) => setEdition(e.target.value)}
          onFocus={(e) => e.currentTarget.select()}
          onBlur={valider}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              valider();
            } else if (e.key === "Escape") {
              e.preventDefault();
              setEdition(null);
            }
          }}
          className="w-full rounded-lg border border-border bg-background py-[7px] ps-2.5 pe-2 text-sm text-foreground outline-none focus:border-foreground/30 focus-visible:ring-0"
        />
      </li>
    );
  }

  return (
    <li className="group relative">
      <button
        type="button"
        title={session.title}
        onClick={onOuvrir}
        onDoubleClick={() => setEdition(session.title)}
        className={cn(
          "flex w-full items-center gap-2 rounded-lg py-2 ps-2.5 pe-7 text-start text-sm transition-colors",
          actif
            ? "bg-muted font-medium text-foreground"
            : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
        )}
      >
        {enCours ? (
          <Loader2 size={14} strokeWidth={1.75} className="shrink-0 animate-spin text-primary" aria-label={t("Réponse en cours")} />
        ) : session.origin === "cloud" ? (
          <Cloud size={14} strokeWidth={1.75} className="shrink-0" />
        ) : (
          <HardDrive size={14} strokeWidth={1.75} className="shrink-0" />
        )}
        {/*
         * `dir="auto"` : un titre trop long se coupe à sa fin, dans son propre
         * sens. Sans lui, un titre en anglais dans l'interface en arabe perdait
         * son début (« …t in English please, with », vu le 30/09/2026). Il reste
         * rangé du côté où commence la liste.
         */}
        <span dir="auto" className="min-w-0 flex-1 truncate ltr:text-left rtl:text-right">{session.title}</span>
        {(session.visibility !== "prive" || (session.sharedWith ?? []).length > 0) && (
          <Users2 size={13} strokeWidth={1.75} className="shrink-0 text-accent" aria-label={t("Partagé")} />
        )}
      </button>
      <span className="absolute end-1 top-1/2 hidden -translate-y-1/2 items-center gap-0.5 rounded-md bg-muted group-hover:flex">
        <button
          type="button"
          aria-label={tf("Renommer {0}", session.title)}
          title={t("Renommer")}
          onClick={() => setEdition(session.title)}
          className="rounded p-1 text-muted-foreground transition-colors hover:text-foreground"
        >
          <Pencil size={13} strokeWidth={1.75} />
        </button>
        {!archivee && (
          <button
            type="button"
            aria-label={tf("Partager {0}", session.title)}
            title={t("Partager")}
            onClick={onPartager}
            className="rounded p-1 text-muted-foreground transition-colors hover:text-foreground"
          >
            <Users2 size={13} strokeWidth={1.75} />
          </button>
        )}
        <button
          type="button"
          aria-label={archivee ? tf("Désarchiver {0}", session.title) : tf("Archiver {0}", session.title)}
          title={archivee ? t("Remettre dans la liste") : t("Archiver")}
          onClick={onArchiver}
          className="rounded p-1 text-muted-foreground transition-colors hover:text-foreground"
        >
          {archivee ? (
            <ArchiveRestore size={13} strokeWidth={1.75} />
          ) : (
            <Archive size={13} strokeWidth={1.75} />
          )}
        </button>
        <button
          type="button"
          aria-label={tf("Supprimer {0}", session.title)}
          title={t("Supprimer")}
          onClick={onSupprimer}
          className="rounded p-1 text-muted-foreground transition-colors hover:text-destructive"
        >
          <Trash2 size={13} strokeWidth={1.75} />
        </button>
      </span>
    </li>
  );
}

/**
 * Liste des conversations visibles (personnelles + partagées).
 *
 * Deux gestes distincts : **archiver**, qui range le chat sans rien perdre et
 * se défait d'un clic, et **supprimer**, qui efface les messages pour de bon.
 * Les archives se replient en bas de la liste : on les retrouve, elles
 * n'encombrent pas.
 *
 * En mode Cowork, la même liste montre les sessions de Cowork, et elles
 * seules, qui se rouvrent dans Cowork (`/cowork?c=<id>`), comme Code a les
 * siennes (demandé par Medhi le 04/10/2026). Mêmes gestes que pour un Chat :
 * c'est la même conversation enregistrée, marquée par son écran
 * (store/sessions.ts, `surface`).
 */
function SessionList({ recherche = "", surface = "chat" }: { recherche?: string; surface?: "chat" | "cowork" }) {
  const { sessions, archivees, remove, archiver, renommer, refresh } = useSessions(surface);
  const cowork = surface === "cowork";
  const base = cowork ? "/cowork" : "/";
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const activeId = params.get("c");
  const [sharing, setSharing] = useState<string | null>(null);
  const [archivesOuvertes, setArchivesOuvertes] = useState(false);

  // Le champ de recherche de la barre latérale ne servait à rien : il filtre
  // désormais la liste juste en dessous de lui, qui est ce qu'il désigne.
  const terme = recherche.trim().toLowerCase();
  const filtrer = (liste: Session[]) =>
    terme ? liste.filter((s) => s.title.toLowerCase().includes(terme)) : liste;
  const visibles = filtrer(sessions);
  const archivesVisibles = filtrer(archivees);

  const supprimer = (s: Session) => {
    remove(s.id);
    if (s.id === activeId) navigate(base);
    /*
     * Prévient aussi l'écran du Chat. Un chat tout juste commencé n'a pas son
     * identifiant dans l'adresse (elle reste « / ») : le supprimer laissait
     * la conversation affichée, et la suite s'écrivait dans un chat qui
     * n'existait plus, perdue sans un mot (voir HomePage).
     */
    notifySessionsChanged();
  };

  if (sessions.length === 0 && archivees.length === 0) {
    return (
      <div className="flex min-h-[140px] flex-1 flex-col items-center justify-center gap-3 px-8 py-6 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          {cowork ? (
            <AppWindow size={20} strokeWidth={1.75} className="text-muted-foreground" />
          ) : (
            <MessageCircle size={20} strokeWidth={1.75} className="text-muted-foreground" />
          )}
        </span>
        <p className="text-xs leading-relaxed text-muted-foreground">
          {cowork
            ? t("Vos sessions de Cowork apparaîtront ici : chaque demande se retrouve et se reprend d'un clic.")
            : t("Vos chats apparaîtront ici une fois que vous commencerez à discuter !")}
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-3 pt-3">
      <p className="px-1 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {cowork ? t("Sessions de Cowork") : t("Chats")}
      </p>
      {visibles.length === 0 && (
        <p className="px-1 pb-2 text-xs text-muted-foreground">
          {terme
            ? cowork
              ? t("Aucune session ne correspond à votre recherche.")
              : t("Aucun chat ne correspond à votre recherche.")
            : cowork
              ? t("Toutes vos sessions de Cowork sont archivées.")
              : t("Tous vos chats sont archivés.")}
        </p>
      )}
      <ul className="space-y-0.5">
        {visibles.map((s) => (
          <LigneSession
            key={s.id}
            session={s}
            actif={s.id === activeId}
            archivee={false}
            onOuvrir={() => navigate(`${base}?c=${s.id}`)}
            libelleNom={cowork ? t("Nom de la session") : undefined}
            onPartager={() => setSharing(s.id)}
            onArchiver={() => archiver(s.id, true)}
            onSupprimer={() => supprimer(s)}
            onRenommer={(titre) => renommer(s.id, titre)}
          />
        ))}
      </ul>

      {archivees.length > 0 && (
        <div className="pt-3">
          <button
            type="button"
            onClick={() => setArchivesOuvertes((v) => !v)}
            aria-expanded={archivesOuvertes}
            className="flex w-full items-center gap-1.5 rounded px-1 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground transition-colors hover:text-foreground"
          >
            <ChevronRight
              size={12}
              strokeWidth={2}
              className={cn("transition-transform", archivesOuvertes && "rotate-90")}
            />
            <span>{t("Archivés")}</span>
            <span className="font-normal normal-case tracking-normal">({archivees.length})</span>
          </button>
          {archivesOuvertes && (
            <ul className="space-y-0.5 pt-0.5">
              {archivesVisibles.length === 0 && (
                <li className="px-1 py-1 text-xs text-muted-foreground">
                  {cowork
                    ? t("Aucune session archivée ne correspond à votre recherche.")
                    : t("Aucun chat archivé ne correspond à votre recherche.")}
                </li>
              )}
              {archivesVisibles.map((s) => (
                <LigneSession
                  key={s.id}
                  session={s}
                  actif={s.id === activeId}
                  archivee
                  onOuvrir={() => navigate(`${base}?c=${s.id}`)}
                  libelleNom={cowork ? t("Nom de la session") : undefined}
                  onPartager={() => setSharing(s.id)}
                  onArchiver={() => archiver(s.id, false)}
                  onSupprimer={() => supprimer(s)}
                  onRenommer={(titre) => renommer(s.id, titre)}
                />
              ))}
            </ul>
          )}
        </div>
      )}

      {sharing && (
        <ShareSessionModal
          sessionId={sharing}
          onClose={() => setSharing(null)}
          onChanged={refresh}
        />
      )}
    </div>
  );
}

function Badge({ children }: { children: string }) {
  return (
    <span className="ms-auto rounded-full bg-accent/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent">
      {children}
    </span>
  );
}

/* --------------------------------- Expanded -------------------------------- */

/**
 * Une entrée du bandeau Chat / Cowork / Code.
 *
 * Le bandeau est **horizontal**, et c'est un choix de place : ces trois
 * entrées sont des modes de travail, pas des destinations parmi dix. Empilées,
 * elles prenaient trois lignes en haut de la barre et repoussaient la liste
 * des chats — celle qu'on regarde vraiment — vers le bas de l'écran. Côte à
 * côte, elles tiennent sur une ligne et se lisent comme ce qu'elles sont : un
 * sélecteur.
 *
 * L'étiquette disparaît sous 240 pixels de barre : mieux vaut trois icônes
 * lisibles que trois mots coupés.
 */
/*
 * Les trois surfaces de travail, en un seul bloc horizontal.
 *
 * L'icône et le mot, tous les deux. Tenir les deux dans une barre de 248 px a
 * demandé de compter : icône à 15, écart à 4, et surtout **des pastilles à la
 * largeur de leur mot**.
 *
 * C'est ce dernier point qui débloquait tout. `flex-1` les forçait à la même
 * largeur : « Cowork » recevait les 74 px des autres alors qu'il en demandait
 * 75, et se coupait pour un pixel pendant que « Chat » en gaspillait quinze.
 * `grow` part de la largeur du mot et ne partage que la place restante.
 *
 * En japonais (28/09/2026), « チャット » prend 52 px contre 29 pour « Chat » :
 * les trois pastilles se coupaient, « Cowork » et « Code » compris. Une marge
 * intérieure de 4 px au lieu de 8, pour le japonais seulement, rend les 24 px
 * qui manquaient.
 *
 * Avec Plus Jakarta Sans (28/09/2026, à la place de Satoshi), plus large, les
 * trois mots se coupaient aussi en français, en grand écran comme en petit
 * (vu par Medhi) : mesurés dans Electron à 13 px, « Chat », « Cowork » et
 * « Code » demandent 114,7 px ; il en restait 110. Une marge de 6 px au lieu
 * de 8 rend 12 px : 122 px de place, les mots entiers, sans baisser la taille.
 *
 * Et le japonais se coupait de nouveau avec cette police (tournée à l'écran
 * du 28/09/2026) : mesurées dans le navigateur, les trois pastilles
 * demandaient 223,5 px pour 223 de place, et chacune perdait sa dernière
 * lettre (« チャッ… », « Cowo… », « Co… »). Un écart de 2 px entre l'icône et
 * le mot, en japonais seulement, rend 6 px.
 */
function PrimaryItem({ item }: { item: NavItem }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.path}
      end={item.path === "/"}
      title={item.label}
      className={({ isActive }) =>
        cn(
          "flex min-w-0 grow items-center justify-center gap-1 rounded-xl px-1.5 py-1.5 [:lang(ja)_&]:gap-0.5 [:lang(ja)_&]:px-1",
          "text-[13px] font-medium transition-colors",
          isActive
            ? "border border-sidebar-border bg-sidebar-active text-foreground shadow-sm"
            : "border border-transparent text-muted-foreground hover:text-foreground",
        )
      }
    >
      <Icon size={15} strokeWidth={1.75} className="shrink-0" />
      <span className="truncate">{item.label}</span>
      {item.badge && <Badge>{item.badge}</Badge>}
    </NavLink>
  );
}

/** Un enregistrement de réunion tourne-t-il ? La barre latérale le montre, où que l'on soit. */
function useEnregistrementEnCours(): boolean {
  const [actif, setActif] = useState(() => enregistrementCourant() !== null);
  useEffect(() => {
    const suivre = () => setActif(enregistrementCourant() !== null);
    window.addEventListener(ENREGISTREMENT_CHANGE, suivre);
    return () => window.removeEventListener(ENREGISTREMENT_CHANGE, suivre);
  }, []);
  return actif;
}

function PastilleEnregistrement() {
  return (
    <span className="ms-auto h-2 w-2 shrink-0 animate-pulse rounded-full bg-destructive" role="img" aria-label={t("Enregistrement en cours")} />
  );
}

function SecondaryItem({ item }: { item: NavItem }) {
  const Icon = item.icon;
  const enregistre = useEnregistrementEnCours() && item.path === "/reunions";
  return (
    <NavLink
      to={item.path}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
          isActive
            ? "bg-muted font-medium text-foreground"
            : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
        )
      }
    >
      <Icon size={18} strokeWidth={1.75} />
      <span>{item.label}</span>
      {enregistre && <PastilleEnregistrement />}
    </NavLink>
  );
}

/**
 * Le mode Code a sa propre liste : ses sessions, rangées par dossier, et non
 * les Chats (demandé par Medhi le 25/09/2026, comme dans Claude Code). Les
 * Chats, eux, ne montrent plus rien de Code.
 */
const enModeCode = (chemin: string) => chemin === "/code" || chemin.startsWith("/code/");

/** Le mode Cowork a aussi sa liste, ses sessions (04/10/2026) : voir `SessionList`. */
const enModeCowork = (chemin: string) => chemin === "/cowork";

/** Où mène « Nouveau Chat » / « Nouvelle session » : l'accueil de l'écran où l'on est. */
const accueilDu = (modeCode: boolean, modeCowork: boolean) => (modeCode ? "/code" : modeCowork ? "/cowork" : "/");

function ExpandedSidebar({ onToggle }: { onToggle: () => void }) {
  const navigate = useNavigate();
  const chemin = useLocation().pathname;
  const modeCode = enModeCode(chemin);
  const modeCowork = enModeCowork(chemin);
  const modeSessions = modeCode || modeCowork;
  const [recherche, setRecherche] = useState("");
  const [aide, setAide] = useState(false);
  return (
    <aside className="flex h-full w-[248px] shrink-0 flex-col border-e border-sidebar-border bg-sidebar">
      {/* En-tete : marque + repli */}
      <div className="titlebar-inset titlebar-drag flex shrink-0 items-center justify-between px-4 pb-3">
        <LogoHome height={30} />
        <IconButton
          icon={PanelLeft}
          label={t("Replier le panneau")}
          onClick={onToggle}
        />
      </div>

      {/*
       * Tout ce bloc défile d'un seul tenant : sur une fenêtre courte, la
       * navigation resterait sinon coincée sous le pied de barre.
       */}
      <div className="scrollbar-discret flex min-h-0 flex-1 flex-col overflow-y-auto">
        {/* Bloc de navigation principal */}
        <div className="shrink-0 px-2">
          <div className="flex items-center gap-0.5 rounded-2xl border border-sidebar-border bg-muted/40 p-0.5">
            {primaryNav.map((item) => (
              <PrimaryItem key={item.path} item={item} />
            ))}
          </div>
        </div>

        {/* Nouvelle discussion */}
        <div className="shrink-0 px-3 pt-3">
          <button
            type="button"
            onClick={() => navigate(accueilDu(modeCode, modeCowork))}
            className="flex w-full items-center gap-2.5 rounded-xl border border-sidebar-border bg-sidebar-active px-3 py-2 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-muted"
          >
            <Plus size={18} strokeWidth={1.75} />
            <span>{modeSessions ? t("Nouvelle session") : t("Nouveau Chat")}</span>
          </button>
        </div>

        {/* Navigation secondaire */}
        <nav className="shrink-0 space-y-0.5 px-3 pt-2">
          {secondaryNav.map((item) => (
            <SecondaryItem key={item.path} item={item} />
          ))}
        </nav>

        {/* Recherche */}
        <div className="shrink-0 px-3 pt-2">
          <SearchInput
            variant="ghost"
            placeholder={modeSessions ? t("Rechercher une session...") : t("Rechercher un chat...")}
            aria-label={modeSessions ? t("Rechercher une session") : t("Rechercher un chat")}
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
          />
        </div>

        {/* Liste des chats (ou des sessions de Code ou de Cowork, dans ces modes), ou état vide */}
        {modeCode ? (
          <SessionsCodeListe recherche={recherche} />
        ) : (
          <SessionList key={modeCowork ? "cowork" : "chat"} recherche={recherche} surface={modeCowork ? "cowork" : "chat"} />
        )}
      </div>

      {/* Pied de barre */}
      <div className="flex shrink-0 items-center gap-1 border-t border-sidebar-border px-3 py-3">
        <button
          type="button"
          aria-label={t("Compte")}
          title={t("Mon profil")}
          onClick={() => navigate("/parametres/profil")}
          className="rounded-full outline-offset-2"
        >
          <Avatar size={32} />
        </button>
        <div className="ms-auto flex items-center gap-0.5">
          <BasculeTheme />
          <Notifications />
          <NavLink
            to="/parametres"
            aria-label={t("Réglages")}
            className={({ isActive }) =>
              cn(
                "inline-flex h-[34px] w-[34px] items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                isActive && "bg-muted text-foreground",
              )
            }
          >
            <SlidersHorizontal size={18} strokeWidth={1.75} />
          </NavLink>
          <IconButton
            icon={CircleHelp}
            label={t("Aide et support")}
            onClick={() => setAide(true)}
            active={aide}
          />
        </div>
      </div>
      <Aide open={aide} onClose={() => setAide(false)} />
    </aside>
  );
}

/* ----------------------------------- Rail ---------------------------------- */

/**
 * Entrée du rail.
 *
 * `primaire` reprend l'aspect des entrées Chat / Cowork / Code dépliées :
 * l'entrée active y ressort en pastille claire posée sur le cadre du groupe,
 * comme dans les captures de référence.
 */
function RailItem({ item, primaire }: { item: NavItem; primaire?: boolean }) {
  const Icon = item.icon;
  const enregistre = useEnregistrementEnCours() && item.path === "/reunions";
  return (
    <NavLink
      to={item.path}
      end={item.path === "/"}
      aria-label={item.label}
      title={item.label}
      className={({ isActive }) =>
        cn(
          "relative inline-flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground transition-colors",
          isActive
            ? primaire
              ? "border border-sidebar-border bg-sidebar-active text-foreground shadow-sm"
              : "bg-muted text-foreground"
            : "border border-transparent hover:bg-muted/60 hover:text-foreground",
        )
      }
    >
      <Icon size={18} strokeWidth={1.75} />
      {enregistre && <span className="absolute end-1 top-1 h-2 w-2 animate-pulse rounded-full bg-destructive" aria-hidden />}
    </NavLink>
  );
}

function CollapsedSidebar({ onToggle }: { onToggle: () => void }) {
  const navigate = useNavigate();
  const chemin = useLocation().pathname;
  const modeCode = enModeCode(chemin);
  const modeCowork = enModeCowork(chemin);
  const nouveau = modeCode || modeCowork ? t("Nouvelle session") : t("Nouveau Chat");
  const [aide, setAide] = useState(false);
  return (
    /*
     * 77 px : 76 de contenu (largeur des captures de référence) plus la bordure,
     * qui fait partie de la boîte. Un rail plus étroit collerait les trois
     * pastilles de fenêtre macOS à ses bords — elles occupent 52 px à elles
     * seules.
     */
    <aside className="flex h-full w-[77px] shrink-0 flex-col items-center border-e border-sidebar-border bg-sidebar">
      <div className="titlebar-inset titlebar-drag flex shrink-0 flex-col items-center gap-1">
        <IconButton icon={PanelLeft} label={t("Déplier le panneau")} onClick={onToggle} />
        <LogoHome height={26} withWordmark={false} className="my-1" />
      </div>

      {/*
       * La navigation défile, l'en-tête et le pied restent en place : sur une
       * fenêtre courte, les entrées du bas seraient sinon hors de l'écran et
       * inatteignables.
       */}
      <div className="scrollbar-discret flex min-h-0 flex-1 flex-col items-center overflow-y-auto">
        {/* Même cadre que déplié : Chat, Cowork et Code forment un groupe. */}
        <div className="mt-1 flex shrink-0 flex-col items-center gap-1 rounded-2xl border border-sidebar-border bg-muted/40 p-1.5">
          {primaryNav.map((item) => (
            <RailItem key={item.path} item={item} primaire />
          ))}
        </div>

        <button
          type="button"
          aria-label={nouveau}
          title={nouveau}
          onClick={() => navigate(accueilDu(modeCode, modeCowork))}
          className="mt-3 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-sidebar-border bg-sidebar-active text-foreground shadow-sm transition-colors hover:bg-muted"
        >
          <Plus size={18} strokeWidth={1.75} />
        </button>

        <div className="mt-2 flex flex-col items-center gap-1 pb-2">
          {secondaryNav.map((item) => (
            <RailItem key={item.path} item={item} />
          ))}
        </div>
      </div>

      {/* Pied */}
      <div className="flex shrink-0 flex-col items-center gap-1 border-t border-sidebar-border pb-3 pt-2">
        <button
          type="button"
          aria-label={t("Compte")}
          title={t("Mon profil")}
          onClick={() => navigate("/parametres/profil")}
          className="rounded-full outline-offset-2"
        >
          <Avatar size={30} />
        </button>
        <BasculeTheme size={32} />
        <Notifications size={32} />
        <NavLink
          to="/parametres"
          aria-label={t("Réglages")}
          title={t("Réglages")}
          className={({ isActive }) =>
            cn(
              "inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
              isActive && "bg-muted text-foreground",
            )
          }
        >
          <SlidersHorizontal size={18} strokeWidth={1.75} />
        </NavLink>
        <IconButton
          icon={CircleHelp}
          label={t("Aide et support")}
          size={32}
          onClick={() => setAide(true)}
          active={aide}
        />
      </div>
      <Aide open={aide} onClose={() => setAide(false)} />
    </aside>
  );
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  return collapsed ? (
    <CollapsedSidebar onToggle={onToggle} />
  ) : (
    <ExpandedSidebar onToggle={onToggle} />
  );
}

export default Sidebar;
