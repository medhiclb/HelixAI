import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FolderKanban,
  Folder,
  Plus,
  Users,
  Trash2,
  Mail,
  Check,
  Clock,
  TriangleAlert,
  MessageSquare,
  Share2,
  Loader2,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { SearchInput } from "@/components/ui/SearchInput";
import { SegmentedTabs } from "@/components/ui/SegmentedTabs";
import { EmptyState } from "@/components/ui/EmptyState";
import { Modal } from "@/components/ui/Modal";
import { Field, Input, Textarea } from "@/components/ui/Field";
import { InfoBox } from "@/components/ui/InfoBox";
import { Avatar } from "@/components/ui/Avatar";
import { useProjects } from "@/hooks/useProjects";
import { ChoixBases } from "@/components/bibliotheque/ChoixBases";
import { features } from "@/config/branding";
import type { ResultatInvitation } from "@/lib/invitations";
import { useSessions } from "@/hooks/useSessions";
import { currentUser } from "@/lib/store/identity";
import type { Project } from "@/lib/store/projects";
import type { Session } from "@/lib/store/sessions";
import { useFormats } from "@/lib/formats";
import { cn } from "@/lib/cn";
import { t, tf } from "@/lib/i18n";

const tabs = [
  { id: "tous", label: t("Tous") },
  { id: "miens", label: t("Les miens") },
  { id: "partages", label: t("Partagés") },
];

/** Page Projets : création, membres, invitation par email (captures 10 et 11). */
export function ProjetsPage() {
  const ouvrirCode = useNavigate();
  const { projects, create, remove, invite, revoke } = useProjects();
  /*
   * Chats rangés dans chaque projet. On part des conversations que la personne
   * voit déjà (`useSessions` lit `visibleTo`, que la passerelle a filtré) : un
   * projet regroupe ce qu'on voyait, il n'ouvre l'accès à rien de plus.
   */
  const { sessions } = useSessions();
  const chatsParProjet = useMemo(() => {
    const index = new Map<string, Session[]>();
    for (const s of sessions) {
      if (!s.projectId) continue;
      index.set(s.projectId, [...(index.get(s.projectId) ?? []), s]);
    }
    return index;
  }, [sessions]);
  const [tab, setTab] = useState("tous");
  const [query, setQuery] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [detail, setDetail] = useState<Project | null>(null);

  const me = currentUser();

  const filtered = useMemo(() => {
    const byTab = projects.filter((p) =>
      tab === "miens"
        ? p.ownerId === me.id
        : tab === "partages"
          ? p.ownerId !== me.id
          : true,
    );
    const q = query.trim().toLowerCase();
    return q ? byTab.filter((p) => p.name.toLowerCase().includes(q)) : byTab;
  }, [projects, tab, query, me.id]);

  // Le détail doit refléter les invitations ajoutées en direct.
  const live = detail ? (projects.find((p) => p.id === detail.id) ?? detail) : null;

  return (
    <div className="flex h-full flex-col overflow-y-auto px-8 py-7">
      <PageHeader
        showBack
        icon={FolderKanban}
        title={t("Projets")}
        subtitle={t("Organisez votre travail avec des projets structurés")}
        actions={
          <Button icon={Plus} onClick={() => setModalOpen(true)}>
            {t("Nouveau projet")}
          </Button>
        }
      />

      <div className="mt-6 flex items-center justify-between gap-4">
        <SearchInput
          placeholder={t("Rechercher des projets...")}
          aria-label={t("Rechercher des projets")}
          containerClassName="w-full max-w-[280px]"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <SegmentedTabs options={tabs} value={tab} onChange={setTab} />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Folder}
          title={projects.length === 0 ? t("Aucun projet") : t("Aucun résultat")}
          description={
            projects.length === 0
              ? t("Créez votre premier projet pour commencer")
              : t("Aucun projet ne correspond à votre recherche")
          }
        />
      ) : (
        <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((project) => {
            const actifs = project.members.filter((m) => m.status === "actif").length;
            const invites = project.members.filter((m) => m.status === "invite").length;
            const chats = chatsParProjet.get(project.id)?.length ?? 0;
            return (
              <li
                key={project.id}
                className="group relative flex flex-col gap-2 rounded-2xl border border-border bg-card p-4 transition-shadow hover:shadow-sm"
              >
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted">
                    <Folder size={18} strokeWidth={1.75} className="text-muted-foreground" />
                  </span>
                  <button
                    type="button"
                    onClick={() => setDetail(project)}
                    className="min-w-0 flex-1 text-start"
                  >
                    <span className="block truncate font-medium text-foreground">
                      {project.name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {project.ownerId === me.id ? t("Propriétaire") : t("Partagé avec vous")}
                    </span>
                  </button>
                  {project.ownerId === me.id && (
                    <button
                      type="button"
                      aria-label={tf("Supprimer {0}", project.name)}
                      onClick={() => remove(project.id)}
                      className="hidden shrink-0 rounded p-1 text-muted-foreground transition-colors hover:text-destructive group-hover:block"
                    >
                      <Trash2 size={15} strokeWidth={1.75} />
                    </button>
                  )}
                </div>

                {project.description && (
                  <p className="line-clamp-2 text-sm text-muted-foreground">
                    {project.description}
                  </p>
                )}

                {project.dossierCode && project.ownerId === me.id && features.code && (
                  <Button onClick={() => ouvrirCode(`/code?projet=${encodeURIComponent(project.id)}`)}>{t("Continuer dans Code")}</Button>
                )}
                <div className="mt-auto flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setDetail(project)}
                    className="inline-flex w-fit items-center gap-1.5 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <Users size={11} strokeWidth={2} />
                    {(actifs === 1 ? t("1 membre") : tf("{0} membres", actifs))}
                    {invites > 0 && ` · ${invites === 1 ? t("1 invité") : tf("{0} invités", invites)}`}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDetail(project)}
                    className="inline-flex w-fit items-center gap-1.5 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <MessageSquare size={11} strokeWidth={2} />
                    {chats === 1 ? t("1 Chat") : tf("{0} Chats", chats)}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <CreateProjectModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreate={(name, desc) => {
          const project = create(name, desc);
          setModalOpen(false);
          setDetail(project);
        }}
      />

      <MembersModal
        project={live}
        chats={live ? (chatsParProjet.get(live.id) ?? []) : []}
        canManage={live?.ownerId === me.id}
        onClose={() => setDetail(null)}
        onInvite={(email) => invite(live!.id, email)}
        onRevoke={(email) => revoke(live!.id, email)}
      />
    </div>
  );
}

function CreateProjectModal({
  open,
  onClose,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (name: string, description: string) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const close = () => {
    setName("");
    setDescription("");
    onClose();
  };

  return (
    <Modal open={open} onClose={close}>
      <h2 className="text-lg font-semibold text-foreground">{t("Créer un nouveau projet")}</h2>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">
        {t("Un projet vous permet de regrouper des documents et des conversations autour d'un même sujet.")}
      </p>

      <div className="mt-5 space-y-4">
        <Field label={t("Nom du projet")} hint={t("Un nom concis et descriptif pour votre projet.")}>
          <Input
            placeholder={t("Mon super projet")}
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
        </Field>
        <Field label={t("Description (optionnel)")}>
          <Textarea
            rows={3}
            placeholder={t("À quoi sert ce projet ?")}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </Field>

        <InfoBox leading={<span aria-hidden>💡</span>}>
          <p className="font-medium">{t("Partage")}</p>
          <p className="text-info/90">
            {t("Vous pourrez inviter des membres par email après la création.")}
          </p>
        </InfoBox>
      </div>

      <div className="mt-6 flex justify-end gap-2">
        <Button variant="secondary" onClick={close}>
          {t("Annuler")}
        </Button>
        {/*
          Le formulaire reste monté entre deux ouvertures : sans remise à zéro
          ici, le projet suivant héritait du nom du précédent (« Chantier
          LyonCompta interne », constaté en vérifiant le rattachement des chats).
        */}
        <Button
          disabled={!name.trim()}
          onClick={() => {
            onCreate(name, description);
            setName("");
            setDescription("");
          }}
        >
          {t("Créer le projet")}
        </Button>
      </div>
    </Modal>
  );
}

/**
 * Chats rangés dans un projet, et le moyen de les rouvrir.
 *
 * La liste ne montre que ce que la personne voyait déjà : ses propres chats
 * rangés ici, et ceux qu'une collègue lui a partagés puis rangés ici. Le texte
 * d'accompagnement le dit, pour qu'un membre ne conclue pas qu'un projet vide
 * de son côté l'est aussi pour les autres.
 */
function ChatsDuProjet({
  project,
  chats,
  onNavigate,
}: {
  project: Project;
  chats: Session[];
  onNavigate: () => void;
}) {
  const navigate = useNavigate();
  const { momentCourt } = useFormats();
  const me = currentUser();

  const ouvrir = (chemin: string) => {
    onNavigate();
    navigate(chemin);
  };

  return (
    <section className="mt-5">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground">{t("Chats")}</h3>
        <Button
          variant="secondary"
          size="sm"
          icon={Plus}
          onClick={() => ouvrir(`/?projet=${encodeURIComponent(project.id)}`)}
        >
          {t("Nouveau Chat")}
        </Button>
      </div>

      {chats.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-3 py-4 text-center text-sm text-muted-foreground">
          {t("Aucun chat rangé dans ce projet. Choisissez ce projet dans le composer d'un chat pour l'y ranger.")}
        </p>
      ) : (
        <ul className="max-h-60 space-y-1 overflow-y-auto">
          {chats.map((chat) => (
            <li key={chat.id}>
              <button
                type="button"
                onClick={() => ouvrir(`/?c=${encodeURIComponent(chat.id)}`)}
                className="flex w-full items-center gap-3 rounded-xl border border-border px-3 py-2.5 text-start transition-colors hover:bg-muted"
              >
                <MessageSquare size={15} strokeWidth={1.75} className="shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-foreground">
                    {chat.title}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {chat.ownerId === me.id ? t("Votre chat") : t("Partagé avec vous")}
                  </span>
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {momentCourt(chat.updatedAt)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-2 flex items-start gap-1.5 text-xs text-muted-foreground">
        <Share2 size={12} strokeWidth={2} className="mt-0.5 shrink-0" />
        {t("Ranger un chat ici ne le montre pas aux autres membres. Pour qu'ils le lisent, partagez-le avec eux depuis le chat.")}
      </p>
    </section>
  );
}

function MembersModal({
  project,
  chats,
  canManage,
  onClose,
  onInvite,
  onRevoke,
}: {
  project: Project | null;
  chats: Session[];
  canManage?: boolean;
  onClose: () => void;
  onInvite: (email: string) => Promise<ResultatInvitation>;
  onRevoke: (email: string) => void;
}) {
  const [email, setEmail] = useState("");
  const [feedback, setFeedback] = useState<{
    ok: boolean;
    text: string;
    /** Adresse et code à recopier, quand le mail n'a pas pu partir. */
    code?: { adresse: string; code: string };
  } | null>(null);

  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const { rename } = useProjects();

  /*
   * Tous les crochets au-dessus de ce retour, sans exception : React compte
   * les appels, et un crochet placé après une sortie anticipée en fait varier
   * le nombre d'un rendu à l'autre. C'est l'erreur React #310, et elle casse
   * l'écran entier, pas seulement ce composant.
   */
  if (!project) return null;

  /**
   * Trois issues, et l'écran dit laquelle :
   *  - la personne a déjà un compte : elle est dans le projet, rien à envoyer ;
   *  - elle n'en a pas et le mail est parti : elle a tout ce qu'il faut ;
   *  - elle n'en a pas et le mail n'a pas pu partir : le code s'affiche ici,
   *    avec l'adresse de l'instance, à transmettre de vive voix.
   */
  const send = async () => {
    setEnvoiEnCours(true);
    setFeedback(null);
    const result = await onInvite(email);
    setEnvoiEnCours(false);

    if (!result.ok) {
      setFeedback({ ok: false, text: result.reason ?? t("Invitation impossible.") });
      return;
    }
    const invitee = email;
    setEmail("");

    if (result.immediate) {
      // Traduit comme les autres retours (tournée à l'écran du 28/09/2026 : il restait en français).
      setFeedback({ ok: true, text: tf("{0} a rejoint le projet.", invitee) });
      return;
    }
    if (result.invitation?.envoye) {
      setFeedback({
        ok: true,
        text: tf("Invitation envoyée à {0}. Elle y trouvera l'adresse de l'instance et son code, valable sept jours.", invitee),
      });
      return;
    }
    setFeedback({
      ok: true,
      text:
        (result.invitation?.motif ?? result.echecInvitation ?? t("Le mail n'a pas pu partir.")) +
        t(" Transmettez-lui vous-même ces deux lignes :"),
      code: result.invitation?.code
        ? { adresse: result.invitation.adresse, code: result.invitation.code }
        : undefined,
    });
  };

  const fermer = () => {
    setFeedback(null);
    setEmail("");
    onClose();
  };

  return (
    <Modal open onClose={fermer} size="md">
      <h2 className="pe-8 text-lg font-semibold text-foreground">{project.name}</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {project.members.filter((m) => m.status === "actif").length}{" "}{t("membre(s) ·")}{" "}
        {project.members.filter((m) => m.status === "invite").length}{" "}{t("invitation(s) en attente")}
      </p>

      <ChatsDuProjet project={project} chats={chats} onNavigate={fermer} />

      {/* Bases de connaissances du projet : les Chats qui y sont rangés les consultent avant de répondre. */}
      {features.bibliotheque && canManage && (
        <div className="mt-6">
          <h3 className="text-sm font-semibold text-foreground">{t("Bases de connaissances")}</h3>
          <div className="mt-2">
            <ChoixBases
              valeur={project.connaissances ?? []}
              onChange={(ids) => rename(project.id, { connaissances: ids })}
              aide={t("Les Chats rangés dans ce projet y cherchent avant de répondre. Chaque membre n'y lit que ce qu'il a le droit de voir.")}
            />
          </div>
        </div>
      )}

      <h3 className="mt-6 text-sm font-semibold text-foreground">{t("Membres")}</h3>

      {canManage && (
        <div className="mt-5">
          <Field label={t("Inviter un collègue")}>
            <div className="flex gap-2">
              <Input
                type="email"
                placeholder={t("collegue@entreprise.fr")}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && email.trim()) void send();
                }}
              />
              <Button
                icon={envoiEnCours ? Loader2 : Mail}
                className="shrink-0"
                disabled={!email.trim() || envoiEnCours}
                onClick={() => void send()}
              >
                {envoiEnCours ? t("Envoi...") : t("Inviter")}
              </Button>
            </div>
          </Field>
          {feedback && (
            <InfoBox
              tone={feedback.ok ? "info" : "warning"}
              className="mt-2"
              leading={
                feedback.ok ? (
                  <Check size={15} strokeWidth={2.5} />
                ) : (
                  <TriangleAlert size={15} strokeWidth={1.75} />
                )
              }
            >
              {feedback.text}
              {feedback.code && (
                /*
                 * Sans boîte aux lettres branchée, le code doit être lisible et
                 * recopiable : en gros caractères à chasse fixe, pas noyé dans
                 * une phrase. C'est ce que la personne va dicter.
                 */
                <span className="mt-2 block space-y-0.5 font-mono text-[13px] text-foreground">
                  <span className="block">{t("Adresse :")}{" "}{feedback.code.adresse}</span>
                  <span className="block">{t("Code :")}{" "}{feedback.code.code}</span>
                </span>
              )}
            </InfoBox>
          )}
        </div>
      )}

      <ul className="mt-5 space-y-1.5">
        {project.members.map((member) => (
          <li
            key={member.email}
            className="flex items-center gap-3 rounded-xl border border-border px-3 py-2.5"
          >
            <Avatar size={30} initials={member.email.slice(0, 2).toUpperCase()} nom={member.email} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm text-foreground">{member.email}</span>
              <span className="text-xs text-muted-foreground">
                {member.role === "proprietaire" ? t("Propriétaire") : "Membre"}
              </span>
            </span>
            <span
              className={cn(
                "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
                member.status === "actif"
                  ? "bg-success/15 text-success"
                  : "bg-warning/15 text-warning",
              )}
            >
              {member.status === "actif" ? (
                <>
                  <Check size={10} strokeWidth={3} />{" "}{t("Actif")}
                </>
              ) : (
                <>
                  <Clock size={10} strokeWidth={2.5} />{" "}{t("Invité")}
                </>
              )}
            </span>
            {canManage && member.role !== "proprietaire" && (
              <button
                type="button"
                aria-label={tf("Retirer {0}", member.email)}
                onClick={() => onRevoke(member.email)}
                className="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:text-destructive"
              >
                <Trash2 size={14} strokeWidth={1.75} />
              </button>
            )}
          </li>
        ))}
      </ul>

      <InfoBox tone="muted" className="mt-5">
        {t("Les invitations valent pour cette installation. Pour collaborer depuis plusieurs postes, une instance partagée est nécessaire.")}
      </InfoBox>
    </Modal>
  );
}

export default ProjetsPage;
