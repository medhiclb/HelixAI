import { db } from "./db.ts";
import {
  choisirCompetences,
  competenceExplicite,
  placeCompetences,
  voitCompetence,
  type ChoixCompetences,
  type CompetenceStockee,
} from "./competencesRegles.ts";

/**
 * Compétences, côté instance (23/10/2026, demandé par Medhi : « un système de
 * skills, la possibilité pour les gens de créer leurs skills »).
 *
 * Jusque-là, chaque écran (Chat, Cowork, tâches) recopiait **toutes** les
 * compétences actives dans ses consignes, jusqu'à 6 000 caractères, à chaque
 * message, et Code ni les employés n'en recevaient aucune. Désormais c'est
 * l'instance qui les ajoute, au moment d'appeler le modèle, pour toutes les
 * surfaces :
 *
 *  - le Chat, Cowork et les tâches d'un agent, qui le demandent (`competences:
 *    true`, chat.ts) : les compétences de la personne et celles partagées à
 *    l'organisation ;
 *  - Code (index.ts, `/helix/code/prompt`) : les mêmes, ajoutées à la demande
 *    comme la méthode de travail ;
 *  - les employés toujours actifs (OpenClaw) : **seulement** celles partagées à
 *    l'organisation. Un employé parle à plusieurs personnes ; la compétence
 *    personnelle de sa propriétaire n'a pas à leur être récitée.
 *
 * Pourquoi pas le format « skills » d'OpenClaw : Helix l'a coupé exprès
 * (employes.ts, `skills: []`, `allowBundled: []`, atelier éteint). Une
 * compétence d'OpenClaw peut porter des scripts et des dépendances à
 * installer ; ici, une compétence reste du texte. Elle arrive à l'employé par
 * le même chemin que tout le reste : la passerelle, qui sert son modèle.
 *
 * Choisir ce qui part : voir `choisirCompetences` (competencesRegles.ts).
 */

/** Ce que l'instance garde : jamais réécrit ici. Une lecture ratée rend une liste vide **pour cette demande**, rien d'autre. */
async function toutes(): Promise<CompetenceStockee[]> {
  try {
    const brut = await db().read("competences");
    return Array.isArray(brut)
      ? (brut as unknown[]).filter((c): c is CompetenceStockee => {
          const x = c as Record<string, unknown> | null;
          return Boolean(x) && typeof x!.id === "string" && typeof x!.nom === "string" && typeof x!.instructions === "string";
        })
      : [];
  } catch (err) {
    console.log(`[competences] collection illisible, aucune compétence pour cette demande : ${err instanceof Error ? err.message : String(err)}`);
    return [];
  }
}

/** Les compétences qu'une personne a éteintes pour elle seule (son profil, `competencesEteintes`). */
async function eteintesPar(userId: string): Promise<Set<string>> {
  try {
    const sac = (await db().read("profiles")) as Record<string, unknown> | null;
    const profil = sac && typeof sac === "object" ? (sac[`profile:${userId}`] as { competencesEteintes?: unknown } | undefined) : undefined;
    return new Set(Array.isArray(profil?.competencesEteintes) ? profil!.competencesEteintes.filter((x): x is string => typeof x === "string") : []);
  } catch {
    return new Set();
  }
}

/**
 * Les compétences qui valent pour une demande : celles que la personne voit
 * (les siennes, celles de l'organisation), allumées par leur autrice, et pas
 * éteintes par la personne pour elle-même. `null` : un employé, qui ne reçoit
 * que celles de l'organisation.
 */
export async function competencesPour(userId: string | null): Promise<CompetenceStockee[]> {
  const liste = await toutes();
  if (userId === null) return liste.filter((c) => c.visibilite === "organisation" && c.active !== false);
  const eteintes = await eteintesPar(userId);
  return liste.filter((c) => voitCompetence(c as unknown as Record<string, unknown>, userId) && c.active !== false && !eteintes.has(c.id));
}

/** Ce qui part au modèle pour cette demande, mesuré contre la taille de sa conversation (en jetons). */
export async function pourLaDemande(userId: string | null, demande: string, contexte: number): Promise<ChoixCompetences> {
  const liste = await competencesPour(userId);
  const explicite = competenceExplicite(liste, demande);
  // Un appel volontaire réserve davantage de place à la méthode choisie,
  // sans dépasser la moitié d’un petit contexte ni 16 000 caractères.
  const fenetre = Number.isFinite(contexte) && contexte > 0 ? contexte : 8192;
  const place = explicite ? Math.max(placeCompetences(fenetre), Math.min(16000, Math.floor(fenetre * 1.5))) : placeCompetences(fenetre);
  const choix = choisirCompetences(explicite ? [explicite] : liste, demande, place);
  if (choix.mode !== "aucune") {
    console.log(
      `[competences] ${liste.length} compétence(s), ${choix.mode === "entier" ? "toutes en entier" : `index et ${choix.appliquees.length} en entier`}, ${choix.consigne?.length ?? 0} caractères`,
    );
  }
  return choix;
}

/**
 * Pour Code : le bloc ajouté à la demande, après la méthode de travail, ou
 * rien. La place est celle d'un petit modèle : l'agent de code relit déjà
 * beaucoup de consignes à chaque étape.
 */
export async function consignePourCode(userId: string, demande: string): Promise<string> {
  const choix = await pourLaDemande(userId, demande, 8192);
  return choix.consigne ? `\n\n${choix.consigne}` : "";
}
