import { cpus, freemem, totalmem } from "node:os";
import { db } from "./db.ts";
import { journaliser } from "./audit.ts";
import { t } from "./langue.ts";
import type { Hardware } from "./provision.ts";
import type { BackendConfig } from "./types.ts";

/** Conseiller local (02/11/2026) : règles explicites au chargement, IA consultative.
 * Le modèle n'a aucun outil et son texte ne devient jamais une commande ni un réglage.
 * Aucun modèle supplémentaire n'est téléchargé pour optimiser un autre modèle.
 */
export type ModeOptimisation = "automatique" | "standard";
let mode: ModeOptimisation = "automatique";
let occupe = false;
export const modeOptimisation = () => mode;
export async function chargerOptimisation() {
  try {
    const r = await db().read("reglages") as { optimisationLocale?: { mode?: unknown } } | null;
    mode = r?.optimisationLocale?.mode === "standard" ? "standard" : "automatique";
  } catch { /* La lecture ratée n'autorise aucune écriture. */ }
}
export async function reglerOptimisation(choix: ModeOptimisation, qui: string) {
  const r = await db().read("reglages") as Record<string, unknown> | null;
  await db().write("reglages", { ...r, optimisationLocale: { mode: choix } });
  mode = choix;
  journaliser("moteur.optimisation", qui, { mode: choix });
}
export function optionsOptimisees(options: string[], choix = mode): string[] {
  if (choix === "standard") return options;
  if (options.includes("--parallel")) return options.map((valeur, i) => options[i - 1] === "--parallel" ? "1" : valeur);
  const resultat = [...options];
  // Une seule génération à la fois : moins de cache réservé et de contention.
  // Taille de conversation et choix GPU restent ceux déjà validés par Helix.
  return [...resultat, "--parallel", "1"];
}
export function diagnosticOptimisation(hw: Hardware) {
  return {
    mode, memoireGo: hw.totalMemoryGb, libreGo: Math.round(freemem() / 1024 ** 3 * 10) / 10,
    processeurs: hw.cpuCount, cpu: cpus()[0]?.model ?? "", vramGo: hw.gpuVramGb,
    calcul: hw.appleSilicon ? "apple" : hw.gpuVramGb !== undefined ? "nvidia" : "cpu",
    conseils: [
      t("Une réponse à la fois réduit la mémoire réservée et la concurrence entre générations."),
      t("Les réglages s'appliquent au prochain chargement effectué par l'instance. Un modèle déjà chargé reste intact."),
      ...(freemem() < totalmem() * .15 ? [t("La mémoire disponible est faible : fermez les applications inutilisées avant de charger un modèle.")] : []),
      ...(!hw.appleSilicon && hw.gpuVramGb === undefined ? [t("Aucune carte NVIDIA n'est détectée. Pour une carte AMD ou Intel, vérifiez l'accélération dans le moteur avant de modifier son réglage.")] : []),
      t("La quantification, l'accélération et la taille de conversation influencent la vitesse. Comparez les mesures sur le même modèle et la même demande."),
    ],
  };
}
export function backendLocalSur(b: BackendConfig): boolean {
  try {
    const u = new URL(b.baseUrl);
    return b.enabled !== false && (b.kind === "lmstudio" || b.kind === "llamacpp") &&
      ["127.0.0.1", "localhost", "[::1]"].includes(u.hostname) && ["http:", "https:"].includes(u.protocol) && !u.username && !u.password;
  } catch { return false; }
}
export async function demanderConseilLocal(backends: BackendConfig[], hw: Hardware) {
  if (occupe) throw new Error(t("Le conseiller local travaille déjà."));
  occupe = true;
  try {
    for (const b of backends.filter(backendLocalSur)) {
      const headers = { "Content-Type": "application/json", ...(b.apiKey ? { Authorization: `Bearer ${b.apiKey}` } : {}) };
      // /v1/models peut aussi lister les modèles non chargés (JIT de LM Studio).
      // L'API native distingue ses instances chargées : ne jamais provoquer un second chargement.
      const adresse = b.kind === "lmstudio" ? new URL("/api/v1/models", b.baseUrl).href : `${b.baseUrl}/models`;
      const r = await fetch(adresse, { headers, redirect: "error", signal: AbortSignal.timeout(5000) });
      if (!r.ok) { await r.body?.cancel(); continue; }
      const liste = await r.json() as { models?: { type?: string; loaded_instances?: { id?: unknown; config?: unknown }[] }[]; data?: { id?: unknown; status?: { value?: string } }[] };
      const instance = b.kind === "lmstudio"
        ? liste.models?.filter(m => m.type === "llm").flatMap(m => m.loaded_instances ?? []).find(m => typeof m.id === "string")
        : liste.data?.find(m => m.status?.value === "loaded" && typeof m.id === "string" && !/embed/i.test(m.id));
      if (typeof instance?.id !== "string") continue;
      const modele = { id: instance.id, config: "config" in instance ? instance.config : undefined };
      const debut = performance.now();
      const reponse = await fetch(`${b.baseUrl}/chat/completions`, {
        method: "POST", headers, redirect: "error", signal: AbortSignal.timeout(120_000),
        body: JSON.stringify({ model: modele.id, stream: false, max_tokens: 512, reasoning_effort: "none",
          messages: [{ role: "system", content: t("Tu es un conseiller de performances locales. À partir du diagnostic fourni, propose trois conseils courts dans la langue de ce message. Aucun outil, aucune commande système, aucun téléchargement. N'invente pas de gain, de matériel ni de mesure. Ne conseille pas de réduire la qualité ni la taille de conversation sans expliquer le compromis.") },
            { role: "user", content: JSON.stringify({ machine: diagnosticOptimisation(hw), modele: modele.id, configuration: modele.config }) }] }),
      });
      if (!reponse.ok) { await reponse.body?.cancel(); throw new Error(t("Le modèle local n'a pas pu produire de conseil. Le diagnostic matériel reste disponible.")); }
      const d = await reponse.json() as { choices?: { message?: { content?: unknown } }[]; usage?: { completion_tokens?: number } };
      const texte = d.choices?.[0]?.message?.content;
      if (typeof texte !== "string" || !texte.trim()) throw new Error(t("Le modèle local n'a pas pu produire de conseil. Le diagnostic matériel reste disponible."));
      const dureeMs = Math.round(performance.now() - debut);
      const jetons = d.usage?.completion_tokens;
      return { modele: modele.id, conseil: texte.slice(0, 8000), dureeMs,
        ...(typeof jetons === "number" && Number.isFinite(jetons) && jetons > 0 ? { jetons, debitGlobal: Math.round(jetons * 10000 / Math.max(1, dureeMs)) / 10 } : {}) };
    }
    throw new Error(t("Chargez un modèle de texte local pour demander un conseil. Aucun modèle cloud n'est utilisé."));
  } finally { occupe = false; }
}
