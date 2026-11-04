import { t } from "./langue.ts";
import { db } from "./db.ts";
import { journaliser } from "./audit.ts";

let tailles: Record<string, number> = {};
let veilleMinutes = 20;
let fileEcriture: Promise<void> = Promise.resolve();
function serialiser<T>(action: () => Promise<T>): Promise<T> {
  const suivante = fileEcriture.then(action);
  fileEcriture = suivante.then(() => {}, () => {});
  return suivante;
}
export const veilleValide = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v) && v >= 5 && v <= 120;
export const delaiVeilleMinutes = () => veilleMinutes;
export const delaiVeilleSecondes = () => String(veilleMinutes * 60);
export const tailleValide = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v) && v >= 2048 && v <= 262144;
export const contexteSouhaite = (modele: string) => Object.hasOwn(tailles, modele) ? tailles[modele] : undefined;
export async function chargerContextesModeles() {
  try {
    const r = await db().read("reglages") as { contextesModeles?: Record<string, unknown>; veilleModelesMinutes?: unknown } | null;
    if (veilleValide(r?.veilleModelesMinutes)) veilleMinutes = r.veilleModelesMinutes;
    if (r?.contextesModeles && typeof r.contextesModeles === "object" && !Array.isArray(r.contextesModeles)) {
      tailles = Object.fromEntries(Object.entries(r.contextesModeles).filter(([k, v]) => k.length <= 300 && tailleValide(v))) as Record<string, number>;
    }
  } catch { /* Une lecture ratée ne remplace jamais les données enregistrées. */ }
}
export async function enregistrerContexte(modele: string, taille: number, qui: string) {
  if (!tailleValide(taille) || modele.length > 300) throw Error(t("Cette taille de contexte n’est pas disponible pour ce modèle local."));
  return serialiser(async () => {
  const r = await db().read("reglages") as Record<string, unknown> | null;
  if (r !== null && (typeof r !== "object" || Array.isArray(r))) throw Error(t("Demande refusée."));
  const anciennes = r?.contextesModeles;
  if (anciennes !== undefined && (!anciennes || typeof anciennes !== "object" || Array.isArray(anciennes))) throw Error(t("Demande refusée."));
  const suivantes = { ...(anciennes as Record<string, number> | undefined), [modele]: taille };
  await db().write("reglages", { ...r, contextesModeles: suivantes });
  tailles = Object.fromEntries(Object.entries(suivantes).filter(([, v]) => tailleValide(v)));
  journaliser("moteur.contexte", qui, { modele, taille });
  });
}
export function optionsContexte(options: string[], modele?: string): string[] {
  const taille = modele ? contexteSouhaite(modele) : undefined;
  if (!taille) return options;
  return [...options.filter((v, i) => v !== "--context-length" && options[i - 1] !== "--context-length"), "--context-length", String(taille)];
}

export async function enregistrerVeille(minutes: number, qui: string) {
  if (!veilleValide(minutes)) throw Error(t("Choix inconnu."));
  return serialiser(async () => {
  const r = await db().read("reglages") as Record<string, unknown> | null;
  if (r !== null && (typeof r !== "object" || Array.isArray(r))) throw Error(t("Demande refusée."));
  await db().write("reglages", { ...r, veilleModelesMinutes: minutes });
  veilleMinutes = minutes;
  journaliser("moteur.optimisation", qui, { veilleMinutes: minutes });
  });
}
