import { useEffect, useState } from "react";
import { Cpu, Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/endpoint";
import { Button } from "@/components/ui/Button";
import { t, tf } from "@/lib/i18n";

interface Diagnostic { mode: "automatique" | "standard"; memoireGo: number; libreGo: number; processeurs: number; calcul: string; conseils: string[]; admin: boolean }
interface Conseil { modele: string; conseil: string; dureeMs: number; debitGlobal?: number }
export function OptimisationLocale() {
  const [etat, setEtat] = useState<Diagnostic | null>(null);
  const [conseil, setConseil] = useState<Conseil | null>(null);
  const [erreur, setErreur] = useState("");
  const [occupe, setOccupe] = useState(false);
  const lire = async (chemin: string, body?: object) => {
    const r = await apiFetch(chemin, body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : undefined);
    const d = await r.json();
    if (!r.ok) throw new Error(d.error?.message ?? t("L'instance n'a pas répondu."));
    return d;
  };
  useEffect(() => { let actif = true; void lire("/helix/optimisation-locale").then(d => { if (actif) setEtat(d); }).catch(e => { if (actif) setErreur(String(e.message)); }); return () => { actif = false; }; }, []);
  const agir = async (conseiller: boolean) => {
    setOccupe(true); setErreur("");
    try {
      if (conseiller) setConseil(await lire("/helix/optimisation-locale/conseil", {}));
      else setEtat(await lire("/helix/optimisation-locale", { mode: etat?.mode === "automatique" ? "standard" : "automatique" }));
    } catch (e) { setErreur(e instanceof Error ? e.message : String(e)); }
    finally { setOccupe(false); }
  };
  return <section className="space-y-3" aria-busy={occupe}>
    <h2 className="flex items-center gap-2 text-sm font-medium"><Cpu size={18} aria-hidden="true" />{t("Optimisation locale")}</h2>
    <p className="text-sm text-muted-foreground">{t("Le diagnostic adapte le chargement à cette machine. Le conseiller utilise un modèle déjà chargé sur place, sans service cloud.")}</p>
    {etat && <>
      <p className="text-sm">{tf("{0} Go de mémoire, {1} Go disponibles, {2} processeurs logiques.", etat.memoireGo, etat.libreGo, etat.processeurs)}</p>
      <p className="text-sm font-medium">{etat.mode === "automatique" ? t("Chargement optimisé activé") : t("Chargement standard")}</p>
      <ul className="list-disc space-y-2 ps-5 text-sm text-muted-foreground">{etat.conseils.map(c => <li key={c}>{c}</li>)}</ul>
      {etat.admin && <div className="flex flex-wrap gap-2">
        <Button disabled={occupe} onClick={() => void agir(false)}>{etat.mode === "automatique" ? t("Revenir au chargement standard") : t("Activer le chargement optimisé")}</Button>
        <Button disabled={occupe} icon={occupe ? Loader2 : Cpu} onClick={() => void agir(true)}>{occupe ? t("Analyse locale en cours...") : t("Demander conseil au modèle local")}</Button>
      </div>}
    </>}
    {conseil && <div className="space-y-2 rounded-xl bg-muted p-3" role="status">
      <p className="whitespace-pre-wrap text-sm">{conseil.conseil}</p>
      <p className="text-xs text-muted-foreground">{tf("Conseil produit par {0} sur cette machine.", conseil.modele)}</p>
      {conseil.debitGlobal !== undefined && <p className="text-xs text-muted-foreground">{tf("Débit global de cette demande : {0} jetons/s, lecture initiale comprise.", conseil.debitGlobal)}</p>}
    </div>}
    {erreur && <p role="alert" className="text-sm text-destructive">{erreur}</p>}
  </section>;
}
