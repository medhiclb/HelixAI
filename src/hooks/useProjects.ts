import { useCallback, useEffect, useState } from "react";
import { inviter as inviterParMail } from "@/lib/invitations";
import { currentUser } from "@/lib/store/identity";
import {
  visibleTo,
  createProject,
  updateProject,
  deleteProject,
  inviteMember,
  removeMember,
  type Project,
} from "@/lib/store/projects";

const CHANGED = "helix:projects-changed";

function notify(): void {
  window.dispatchEvent(new Event(CHANGED));
}

/** Projets visibles par l'utilisateur connecté, et leur collaboration. */
export function useProjects(inclureCorbeille = false) {
  const [projects, setProjects] = useState<Project[]>(() => visibleTo(currentUser(), inclureCorbeille));

  const refresh = useCallback(() => setProjects(visibleTo(currentUser(), inclureCorbeille)), [inclureCorbeille]);

  useEffect(() => {
    window.addEventListener(CHANGED, refresh);
    return () => window.removeEventListener(CHANGED, refresh);
  }, [refresh]);

  const create = useCallback((name: string, description?: string) => {
    const project = createProject(currentUser(), name, description);
    notify();
    return project;
  }, []);

  const rename = useCallback((id: string, changes: Partial<Project>) => {
    updateProject(id, changes);
    notify();
  }, []);

  const remove = useCallback((id: string) => {
    deleteProject(id);
    notify();
  }, []);

  /**
   * Invite un collègue sur un projet, et **envoie vraiment le mail**.
   *
   * Deux cas, et le message les distingue :
   *  - la personne a déjà un compte sur l'instance : elle est ajoutée, point.
   *    Il n'y a rien à lui envoyer, elle verra le projet à sa prochaine
   *    synchronisation ;
   *  - elle n'en a pas : l'instance crée un code d'invitation et le lui envoie
   *    par mail (invitations.ts). Sans boîte branchée, le code est rendu ici
   *    pour être transmis de vive voix, et l'écran le dit.
   */
  const invite = useCallback(async (projectId: string, email: string) => {
    const result = inviteMember(projectId, email);
    if (!result.ok) return result;
    notify();
    if (result.immediate) return result;

    const envoi = await inviterParMail(email);
    return envoi.ok
      ? { ...result, invitation: envoi.valeur }
      : { ...result, echecInvitation: envoi.message };
  }, []);

  const revoke = useCallback((projectId: string, email: string) => {
    removeMember(projectId, email);
    notify();
  }, []);

  return { projects, create, rename, remove, invite, revoke, refresh };
}
