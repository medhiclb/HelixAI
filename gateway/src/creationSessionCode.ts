import { t } from "./langue.ts";

/** 13/11/2026 : ne pas masquer un disque plein ou un dossier inaccessible derrière « pas de session ». */
export async function ouvrirSessionCode(
  dossier: string,
  appeler: (chemin: string, init?: RequestInit) => Promise<Response>,
): Promise<{ id: string } | { erreur: string; statut: number }> {
  for (let essai = 0; essai < 3; essai++) {
    let reponse: Response;
    try {
      reponse = await appeler(`/session?directory=${encodeURIComponent(dossier)}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: "{}", signal: AbortSignal.timeout(15_000),
      });
    } catch {
      // Une réponse perdue peut avoir créé la session : pas de nouvel envoi aveugle.
      return { erreur: t("Le moteur de Code ne répond pas. Réessayez après quelques instants ou redémarrez l'application."), statut: 502 };
    }
    const corps = await reponse.json().catch(() => null) as { id?: unknown; name?: unknown; message?: unknown; data?: { message?: unknown } } | null;
    if (reponse.ok && typeof corps?.id === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(corps.id)) return { id: corps.id };
    // Un refus explicite de disponibilité n'a ouvert aucune session. Borné,
    // sans redémarrer un serveur qui peut tenir d'autres sessions au travail.
    if ((reponse.status === 503 || reponse.status === 429) && essai < 2) {
      await new Promise(r => setTimeout(r, 500 * (essai + 1)));
      continue;
    }
    const detail = [corps?.name, corps?.message, corps?.data?.message].filter(x => typeof x === "string").join(" ");
    const erreur = /ENOSPC|disk.*full|database or disk is full/i.test(detail)
      ? t("Le disque du moteur de Code est plein. Libérez de l'espace, puis réessayez.")
      : /EACCES|EPERM|EROFS|SQLITE_CANTOPEN|SQLITE_READONLY|permission denied|readonly database/i.test(detail)
        ? t("Le moteur de Code ne peut pas écrire dans son dossier ou sa base locale. Vérifiez les droits de votre compte et choisissez un dossier de projet accessible.")
        : /SQLITE_BUSY|database is locked/i.test(detail)
          ? t("La base du moteur de Code est occupée. Fermez les autres processus OpenCode, puis réessayez.")
          : t("Le moteur de Code n'a pas pu ouvrir la session. Choisissez un dossier de projet accessible et réessayez ; si le problème persiste, consultez les journaux dans Réglages.");
    return { erreur, statut: reponse.ok || reponse.status >= 500 ? 502 : reponse.status };
  }
  return { erreur: t("Le moteur de Code ne répond pas. Réessayez après quelques instants ou redémarrez l'application."), statut: 502 };
}
