/** Première connexion : les applications et téléchargements lents ont un délai borné. */
export function delaiInitialisationMcp(config: { command?: string; delaiDemarrageMs?: number }, ordinaire: number, surcharge?: string): number {
  // npx peut encore télécharger le paquet pendant initialize, même au banc.
  if (config.command === "npx") return 300_000;
  const essai = Number(surcharge);
  if (Number.isFinite(essai) && essai > 0) return Math.min(300_000, Math.max(1, essai));
  const demande = Number.isFinite(config.delaiDemarrageMs) ? config.delaiDemarrageMs! : 0;
  return Math.min(300_000, Math.max(ordinaire, demande));
}
