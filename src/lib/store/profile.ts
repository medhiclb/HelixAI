import { storage, newId } from "./storage";
import { t, tf } from "@/lib/i18n";

/**
 * Profil PRIVÉ d'un utilisateur : contexte, personnalité, mémoire, préférences.
 * Jamais partagé, même quand une session l'est. Scopé par identifiant
 * d'utilisateur : deux collaborateurs sur le même poste ne partagent ni leur
 * mémoire ni leurs instructions.
 */

export interface Memory {
  id: string;
  text: string;
  createdAt: string;
}

/** Niveaux de raisonnement, plus les trois anciens encore enregistrés. */
export type NiveauRaisonnement =
  | "aucun"
  | "faible"
  | "moyen"
  | "eleve"
  | "max"
  | "rapide"
  | "auto"
  | "approfondi";

export interface UserProfile {
  userId: string;
  /** Personnalité et règles de comportement de l'agent. */
  customInstructions: string;
  /** Contexte personnel réutilisable (métier, préférences, projets). */
  personalInfo: string;
  modeTravail?: "solo" | "equipe";
  memoryEnabled: boolean;
  memories: Memory[];
  /** Modèle préféré (uid passerelle) et niveau d'effort par défaut. */
  preferredModelUid?: string;
  /**
   * Niveau de raisonnement par défaut. Les trois anciens identifiants
   * (`rapide`, `auto`, `approfondi`) restent acceptés : un profil enregistré
   * avant les cinq niveaux ne doit pas perdre son réglage. Ils sont convertis
   * à l'affichage et par la passerelle.
   */
  preferredEffort?: NiveauRaisonnement;
  /**
   * Outils allumés dans le Chat (courrier, fichiers, agenda…). Retenu d'un
   * Chat à l'autre : les rallumer à chaque conversation, c'était découvrir au
   * premier « envoie ce mail » que l'assistant n'en avait pas les moyens.
   */
  outilsChat?: boolean;
  /**
   * RTK dans l'écran Code (gateway/src/rtk.ts, 28/09/2026) : « cloud » (défaut,
   * seulement avec un modèle cloud), « toujours » (modèles locaux compris),
   * « jamais ». Envoyé avec chaque demande, décidé par la passerelle.
   */
  rtkCode?: ReglageRtk;
  /**
   * « Retrouver aussi ce qui a été dit dans mes autres Chats » (16/10/2026,
   * gateway/src/memoireConversation.ts). Éteint par défaut : chaque Chat ne
   * retrouve que sa propre mémoire. Allumé, la recherche couvre tous les Chats
   * de cette personne, jamais ceux d'une autre.
   */
  memoireAutresChats?: boolean;
  /**
   * Compétences partagées par un collègue que cette personne a éteintes pour
   * elle seule (23/10/2026, store/competences.ts). L'interrupteur `active` de
   * la compétence est à son autrice ; celui-ci est à chacun. L'instance le lit
   * aussi (gateway/src/competences.ts).
   */
  competencesEteintes?: string[];
}

export type ReglageRtk = "cloud" | "toujours" | "jamais";

const key = (userId: string) => `profile:${userId}`;

export function emptyProfile(userId: string): UserProfile {
  return {
    userId,
    customInstructions: "",
    personalInfo: "",
    memoryEnabled: true,
    memories: [],
  };
}

export function loadProfile(userId: string): UserProfile {
  return storage.get<UserProfile>(key(userId), emptyProfile(userId));
}

export function saveProfile(profile: UserProfile): void {
  storage.set(key(profile.userId), profile);
}

export function addMemory(profile: UserProfile, text: string): UserProfile {
  const trimmed = text.trim();
  if (!trimmed) return profile;
  const next: UserProfile = {
    ...profile,
    memories: [
      ...profile.memories,
      { id: newId(), text: trimmed, createdAt: new Date().toISOString() },
    ],
  };
  saveProfile(next);
  return next;
}

export function removeMemory(profile: UserProfile, memoryId: string): UserProfile {
  const next: UserProfile = {
    ...profile,
    memories: profile.memories.filter((m) => m.id !== memoryId),
  };
  saveProfile(next);
  return next;
}

/**
 * Construit le message système à partir du profil.
 * Aucun secret n'y figure : les identifiants cloud vivent hors du profil et
 * ne sont jamais placés dans le contexte du modèle (ADR-008).
 */
export function buildSystemPrompt(
  profile: UserProfile,
  productName: string,
  /** Instructions de l'agent sélectionné : elles définissent son rôle. */
  agentInstructions?: string,
): string | null {
  /*
   * Les compétences n'y sont plus depuis le 23/10/2026 : c'est l'instance qui
   * les ajoute, demande par demande, selon la place du modèle
   * (gateway/src/competences.ts), pour le Chat, Cowork, Code et les agents.
   */
  const parts: string[] = [];

  if (agentInstructions?.trim()) {
    parts.push(agentInstructions.trim());
  } else {
    parts.push(
      tf("Tu es {0}, un assistant IA. Tu réponds ", productName) +
        t("de façon claire et utile, sans jargon inutile."),
    );
  }
  /*
   * La langue de la réponse : celle de la personne, pas celle de l'écran
   * (27/09/2026, vu par Medhi : « hi how are you » recevait « Bonjour ! » parce
   * que la consigne française disait « tu réponds en français »). Pour les
   * agents aussi, dont les instructions sont souvent écrites en français.
   */
  parts.push(t("Réponds toujours dans la langue du dernier message de la personne, quelle que soit la langue de ces consignes."));

  /*
   * Quand se servir des outils, et quand ne pas le faire.
   *
   * Sans cette phrase, un petit modèle à qui l'on offre des outils s'en sert
   * pour tout : une question générale partait en recherche dans les
   * documents de l'équipe, n'y trouvait rien, et revenait avec « je n'ai pas
   * l'information ». Les outils servent aux données de l'entreprise et aux
   * actions ; le reste, le modèle le sait.
   */
  parts.push(
    t("Réponds directement aux questions générales avec tes propres connaissances. ") +
      t("N’utilise les outils que pour les données de la personne ou de son équipe ") +
      t("(documents, mails, agenda, fichiers) ou pour agir, et jamais pour vérifier une connaissance générale."),
  );

  if (profile.modeTravail === "solo") {
    parts.push(t("La personne travaille seule. Adapte tes réponses à un usage individuel. Ne suppose pas l’existence de collègues, d’une équipe, d’une entreprise ou d’un service interne. Propose des actions qu’elle peut réaliser elle-même, sauf si elle mentionne explicitement d’autres personnes."));
  } else if (profile.modeTravail === "equipe") {
    parts.push(t("La personne travaille en équipe. Tu peux tenir compte de la collaboration, sans inventer de collègues, de rôles ni de services internes."));
  }
  if (profile.customInstructions.trim()) {
    parts.push(tf("Instructions de l'utilisateur :\n{0}", profile.customInstructions.trim()));
  }

  if (profile.personalInfo.trim()) {
    parts.push(tf("Contexte sur l'utilisateur :\n{0}", profile.personalInfo.trim()));
  }

  if (profile.memoryEnabled && profile.memories.length > 0) {
    const lines = profile.memories.map((m) => `- ${m.text}`).join("\n");
    parts.push(tf("Éléments mémorisés lors de précédentes conversations :\n{0}", lines));
  }

  return parts.length > 0 ? parts.join("\n\n") : null;
}
