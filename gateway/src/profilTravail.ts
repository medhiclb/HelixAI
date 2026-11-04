import { db } from "./db.ts";
import { t } from "./langue.ts";

/** Code reçoit seulement le choix solo/équipe de son auteur, jamais le profil
 * d’un collègue ni la mémoire personnelle du propriétaire d’un employé. */
export async function consigneModeTravail(userId: string): Promise<string> {
  try {
    const r = await db().read("profiles") as Record<string, { modeTravail?: unknown }> | null;
    const mode = r?.[`profile:${userId}`]?.modeTravail;
    if (mode === "solo") return t("La personne travaille seule. Adapte tes réponses à un usage individuel. Ne suppose pas l’existence de collègues, d’une équipe, d’une entreprise ou d’un service interne. Propose des actions qu’elle peut réaliser elle-même, sauf si elle mentionne explicitement d’autres personnes.");
    if (mode === "equipe") return t("La personne travaille en équipe. Tu peux tenir compte de la collaboration, sans inventer de collègues, de rôles ni de services internes.");
  } catch { /* Aucun profil inventé ni réécrit après une lecture ratée. */ }
  return "";
}
