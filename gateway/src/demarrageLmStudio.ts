/** Le moteur écoute uniquement sur la boucle locale. Une adresse distante n'est jamais démarrée ici. */
export function portServeurLocal(adresse: string): number | null {
  try {
    const u = new URL(adresse);
    if (u.protocol !== "http:" || u.username || u.password || !["localhost", "127.0.0.1", "[::1]"].includes(u.hostname)) return null;
    const port = Number(u.port || 80);
    return Number.isInteger(port) && port > 0 && port < 65536 ? port : null;
  } catch { return null; }
}

/** Premier lancement Windows lent : attendre l'écoute, sans redémarrer un serveur déjà lancé. */
export async function attendreEcoute(
  repond: () => Promise<boolean>,
  pause: (ms: number) => Promise<void> = ms => new Promise(r => setTimeout(r, ms)),
  essais = 60,
): Promise<boolean> {
  const limite = Date.now() + essais * 1000;
  for (let i = 0; i < essais; i++) {
    if (await repond()) return true;
    if (Date.now() >= limite) return false;
    if (i + 1 < essais) await pause(1000);
  }
  return false;
}
