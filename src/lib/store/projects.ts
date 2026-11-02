import type { StudioVideo } from "../studioVideo";
import { storage, newId } from "./storage";
import type { User } from "./identity";
import { allAccounts } from "./accounts";
import { t } from "@/lib/i18n";

/**
 * Projets et collaboration.
 *
 * Un projet regroupe des personnes autour d'un même travail. On y invite un
 * collègue par son adresse email, comme dans un ERP ou un CRM.
 *
 * ⚠ Portée actuelle : l'invitation fonctionne **au sein d'une même
 * installation** (plusieurs comptes sur un poste, ou sur une instance partagée).
 * Inviter quelqu'un sur une **autre machine** suppose un serveur commun, qui
 * relève du chantier multi-postes : c'est la couche de stockage qui changera,
 * pas ce modèle.
 */

export type ProjectRole = "proprietaire" | "membre";
export type MemberStatus = "actif" | "invite";

export interface ProjectMember {
  /** Renseigné dès que la personne possède un compte sur l'instance. */
  userId?: string;
  email: string;
  role: ProjectRole;
  status: MemberStatus;
  invitedAt: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  ownerId: string;
  organisationId: string;
  members: ProjectMember[];
  /** Bases de connaissances consultées par les Chats rangés dans ce projet (chacun n'y lit que ce qu'il voit). */
  connaissances?: string[];
  /** Dossier déjà existant, importé depuis un outil de code. Aucune copie des fichiers. */
  dossierCode?: string;
  studioVideo?: StudioVideo;
  importe?: { source: string; cle: string };
  createdAt: string;
  updatedAt: string;
}

const KEY = "projects";

function all(): Project[] {
  return storage.get<Project[]>(KEY, []);
}

function persist(projects: Project[]): void {
  storage.set(KEY, projects);
}

const normalise = (email: string) => email.trim().toLowerCase();

/** Projets dont l'utilisateur est propriétaire ou membre actif. */
export function visibleTo(user: User, inclureCorbeille = false): Project[] {
  const email = normalise(user.email);
  return all()
    .filter(p => inclureCorbeille || !p.studioVideo?.supprimeLe)
    .filter(
      (p) =>
        p.ownerId === user.id ||
        p.members.some(
          (m) => m.status === "actif" && (m.userId === user.id || m.email === email),
        ),
    )
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getProject(id: string): Project | undefined {
  return all().find((p) => p.id === id);
}

export function createProject(owner: User, name: string, description = ""): Project {
  const now = new Date().toISOString();
  const project: Project = {
    id: newId(),
    name: name.trim() || t("Nouveau projet"),
    description: description.trim(),
    ownerId: owner.id,
    organisationId: owner.organisationId,
    members: [
      {
        userId: owner.id,
        email: normalise(owner.email),
        role: "proprietaire",
        status: "actif",
        invitedAt: now,
      },
    ],
    createdAt: now,
    updatedAt: now,
  };
  persist([project, ...all()]);
  return project;
}

export function updateProject(id: string, changes: Partial<Project>): void {
  persist(
    all().map((p) =>
      p.id === id ? { ...p, ...changes, updatedAt: new Date().toISOString() } : p,
    ),
  );
}

export function deleteProject(id: string): void {
  persist(all().filter((p) => p.id !== id));
}

/**
 * Invite un collègue par email.
 * Si un compte existe déjà avec cette adresse sur l'instance, il rejoint
 * immédiatement ; sinon l'invitation reste en attente et se dénouera à la
 * création de son compte.
 */
export function inviteMember(
  projectId: string,
  email: string,
): { ok: boolean; reason?: string; immediate?: boolean } {
  const address = normalise(email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) {
    return { ok: false, reason: "Adresse email invalide." };
  }

  const project = getProject(projectId);
  if (!project) return { ok: false, reason: "Projet introuvable." };
  if (project.members.some((m) => m.email === address)) {
    return { ok: false, reason: t("Cette personne fait déjà partie du projet.") };
  }

  const existing = allAccounts().find((a) => normalise(a.email) === address);
  const member: ProjectMember = {
    userId: existing?.id,
    email: address,
    role: "membre",
    status: existing ? "actif" : "invite",
    invitedAt: new Date().toISOString(),
  };

  updateProject(projectId, { members: [...project.members, member] });
  return { ok: true, immediate: Boolean(existing) };
}

export function removeMember(projectId: string, email: string): void {
  const project = getProject(projectId);
  if (!project) return;
  const address = normalise(email);
  updateProject(projectId, {
    members: project.members.filter(
      (m) => m.email !== address || m.role === "proprietaire",
    ),
  });
}

/**
 * Rattache les invitations en attente à un compte qui vient d'être créé.
 * À appeler à la connexion : le collègue invité retrouve ses projets sans rien
 * faire de particulier.
 */
export function claimInvitations(user: User): number {
  const address = normalise(user.email);
  let claimed = 0;

  const next = all().map((project) => {
    let touched = false;
    const members = project.members.map((m) => {
      if (m.email === address && m.status === "invite") {
        touched = true;
        claimed += 1;
        return { ...m, userId: user.id, status: "actif" as MemberStatus };
      }
      return m;
    });
    return touched ? { ...project, members } : project;
  });

  if (claimed > 0) persist(next);
  return claimed;
}
