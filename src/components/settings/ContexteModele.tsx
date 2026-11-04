import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/endpoint";
import { Button } from "@/components/ui/Button";
import { t, tf } from "@/lib/i18n";

interface Modele { uid: string; nom: string; actuel?: number; maximum?: number; souhaite?: number }
export function ContexteModele() {
  const [modeles, setModeles] = useState<Modele[]>([]);
  const [admin, setAdmin] = useState(false);
  const [veille, setVeille] = useState(20);
  const [reglable, setReglable] = useState(false);
  const [uid, setUid] = useState("");
  const [taille, setTaille] = useState(32768);
  const [occupe, setOccupe] = useState(false);
  const [message, setMessage] = useState("");
  const [erreur, setErreur] = useState("");
  const lire = async () => {
    const r = await apiFetch("/helix/models/contexte"); const d = await r.json();
    if (!r.ok) throw Error(d.error?.message ?? t("L'instance n'a pas répondu."));
    setModeles(d.modeles); setAdmin(d.admin); setVeille(d.veilleMinutes ?? 20); setReglable(d.reglable === true);
    return d.modeles as Modele[];
  };
  useEffect(() => { let actif = true; void lire().then(liste => { if (actif && liste[0]) { setUid(liste[0].uid); setTaille(liste[0].actuel ?? 32768); } }).catch(e => { if (actif) setErreur(e.message); }); return () => { actif = false; }; }, []);
  const modele = modeles.find(m => m.uid === uid);
  const enregistrerVeille = async () => {
    setOccupe(true); setErreur(""); setMessage("");
    try {
      const r = await apiFetch("/helix/models/contexte", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ veilleMinutes: veille }) });
      const d = await r.json(); if (!r.ok) throw Error(d.error?.message ?? t("Demande refusée."));
      setVeille(d.veilleMinutes); setMessage(t("Enregistré"));
    } catch (e) { setErreur(e instanceof Error ? e.message : String(e)); }
    finally { setOccupe(false); }
  };
  const appliquer = async () => {
    setOccupe(true); setErreur(""); setMessage("");
    try {
      const r = await apiFetch("/helix/models/contexte", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ modele: uid, taille }) });
      const d = await r.json(); if (!r.ok) throw Error(d.error?.message ?? t("Demande refusée."));
      setMessage(tf("Contexte appliqué : {0} jetons.", d.actuel));
      window.dispatchEvent(new Event("helix:models-changed"));
    } catch (e) { setErreur(e instanceof Error ? e.message : String(e)); }
    finally { await lire().catch(() => {}); setOccupe(false); }
  };
  return <section className="space-y-3 border-t border-border pt-4" aria-busy={occupe}>
    <h3 className="text-sm font-medium">{t("Gestion des modèles")}</h3>
    <p className="text-sm text-muted-foreground">{t("En mode Auto, le choix suit la tâche : Chat ou Code. Un modèle choisi manuellement garde la priorité. Le moteur local fonctionne en arrière-plan.")}</p>
    <p className="text-sm text-muted-foreground">{t("Ces réglages concernent le moteur local LM Studio.")}</p>
    {reglable && <p className="text-sm text-muted-foreground">{t("Après le délai d’inactivité, le modèle est déchargé pour libérer sa mémoire. Le délai choisi s’applique aux prochains chargements, sans arrêter une réponse en cours.")}</p>}
    {admin && reglable && <div className="flex flex-wrap items-end gap-3"><label className="block space-y-1 text-sm"><span>{t("Décharger après inactivité (minutes)")}</span><input type="number" min={5} max={120} step={5} value={veille} disabled={occupe} onChange={e => setVeille(Number(e.target.value))} className="block w-32 rounded-lg border border-border bg-background p-2 text-foreground" /></label><Button variant="secondary" disabled={occupe || !Number.isInteger(veille) || veille < 5 || veille > 120} onClick={() => void enregistrerVeille()}>{t("Enregistrer")}</Button></div>}
    <h3 className="pt-3 text-sm font-medium">{t("Taille du contexte")}</h3>
    <p className="text-sm text-muted-foreground">{t("Plus de contexte laisse davantage de place aux messages et aux outils, mais demande plus de mémoire et peut ralentir le modèle. Le changement recharge uniquement le modèle choisi, lorsqu’il est au repos.")}</p>
    {modeles.length === 0 ? <p className="text-sm text-muted-foreground">{t("Chargez un modèle de texte dans le moteur local pour régler son contexte ici.")}</p> : <>
      <label className="block space-y-1 text-sm"><span>{t("Modèle local")}</span><select disabled={occupe} value={uid} onChange={e => { const m = modeles.find(m => m.uid === e.target.value); setUid(e.target.value); setTaille(m?.actuel ?? 32768); setMessage(""); }} className="w-full rounded-lg border border-border bg-background p-2 text-foreground">{modeles.map(m => <option key={m.uid} value={m.uid}>{m.nom}</option>)}</select></label>
      {modele?.actuel && <p className="text-sm">{tf("Contexte actuel : {0} jetons.", modele.actuel)}</p>}
      {modele?.maximum && <p className="text-xs text-muted-foreground">{tf("Limite du modèle : {0} jetons.", modele.maximum)}</p>}
      {admin && reglable && <div className="flex flex-wrap items-end gap-3"><label className="block space-y-1 text-sm"><span>{t("Contexte souhaité (jetons)")}</span><input type="number" min={2048} max={Math.min(modele?.maximum ?? 262144, 262144)} step={1024} value={taille} disabled={occupe} onChange={e => setTaille(Number(e.target.value))} className="block w-44 rounded-lg border border-border bg-background p-2 text-foreground" /></label>
        <Button disabled={occupe || !uid || !Number.isInteger(taille) || taille < 2048 || taille > Math.min(modele?.maximum ?? 262144, 262144)} onClick={() => void appliquer()}>{occupe ? t("Rechargement en cours...") : t("Appliquer et recharger")}</Button>
      </div>}
    </>}
    <Button variant="ghost" size="sm" disabled={occupe} onClick={() => void lire().then(l => { if (!l.some(m => m.uid === uid) && l[0]) { setUid(l[0].uid); setTaille(l[0].actuel ?? 32768); } }).catch(e => setErreur(e.message))}>{t("Actualiser")}</Button>
    {message && <p role="status" className="text-sm text-success">{message}</p>}
    {erreur && <p role="alert" className="text-sm text-destructive">{erreur}</p>}
  </section>;
}
