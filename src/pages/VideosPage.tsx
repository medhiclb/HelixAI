import { apiFetch } from "@/lib/endpoint";
import { useEffect, useRef, useState } from "react";
import { Film, Plus, Download, Loader2, ArrowUp, ArrowDown, Copy, Trash2, Play } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Field, Input, Textarea } from "@/components/ui/Field";
import { ImageChip } from "@/components/chat/ImageChip";
import { useProjects } from "@/hooks/useProjects";
import { currentUser } from "@/lib/store/identity";
import { getProject } from "@/lib/store/projects";
import { aleatoire } from "@/lib/store/storage";
import { etatVideos, urlImage, type EtatImages, type ImageCreee, type Travail } from "@/lib/images";
import { assemblerClips, enregistrerStudio, genererScene, STUDIO_CHANGE, suivreScene, telechargerBlob, type StudioVideo } from "@/lib/studioVideo";
import { t, tf } from "@/lib/i18n";

function Clip({ clip }: { clip: ImageCreee }) {
  const [url, setUrl] = useState<string | null>(null);
  const [charge, setCharge] = useState(false);
  useEffect(() => { let vivant = true; let adresse: string | null = null; setCharge(false); setUrl(null);
    void urlImage(clip.id).then(u => { adresse = u; if (vivant) { setUrl(u); setCharge(true); } else if (u) URL.revokeObjectURL(u); });
    return () => { vivant = false; if (adresse) URL.revokeObjectURL(adresse); };
  }, [clip.id]);
  return url ? <div className="space-y-2"><video src={url} controls preload="metadata" className="max-h-72 w-full rounded-xl bg-muted" aria-label={clip.description} />
    <a href={url} download={`${clip.id}.webm`} className="inline-flex min-h-11 items-center gap-2 text-sm underline"><Download size={16} aria-hidden="true" />{t("Télécharger")}</a></div>
    : <p className="text-sm text-muted-foreground">{charge ? t("Vidéo indisponible") : t("Chargement...")}</p>;
}

/** Studio local : les projets suivent la persistance chiffrée et les droits existants.
 * Les clips restent dans l'index d'images, protégé par leur propriétaire.
 */
export function VideosPage() {
  const { projects, create, rename, refresh } = useProjects();
  const miens = projects.filter(p => p.ownerId === currentUser().id && p.studioVideo);
  const [selection, setSelection] = useState<string | null>(null);
  const projet = miens.find(p => p.id === selection) ?? miens[0];
  const [etat, setEtat] = useState<EtatImages | null>(null);
  const [erreur, setErreur] = useState("");
  const [occupe, setOccupe] = useState(false);
  const [exporte, setExporte] = useState(false);
  const [prepare, setPrepare] = useState(false);
  const [rangExport, setRangExport] = useState(0);
  const [travaux, setTravaux] = useState<Record<string, Travail>>({});
  const controleExport = useRef<AbortController | null>(null);
  const sequences = useRef(false);
  useEffect(() => { const charger = () => void etatVideos().then(setEtat); charger(); const timer = setInterval(charger, 5000); return () => clearInterval(timer); }, []);
  useEffect(() => {
    const changer = (e: Event) => { refresh(); const tr = (e as CustomEvent<Travail>).detail; if (tr?.id) setTravaux(v => ({ ...v, [tr.id]: tr })); };
    window.addEventListener(STUDIO_CHANGE, changer);
    return () => { window.removeEventListener(STUDIO_CHANGE, changer); controleExport.current?.abort(); sequences.current = false; };
  }, [refresh]);
  useEffect(() => { for (const p of miens) for (const s of p.studioVideo?.scenes ?? []) if (s.travail) void suivreScene(p.id, s.id, s.travail); }, [projects]);
  const studio = projet?.studioVideo;
  const sauvegarder = (valeur: StudioVideo) => { if (projet) enregistrerStudio(projet.id, valeur); };
  const nouveau = (modele: "libre" | "produit" | "histoire") => {
    const p = create(t("Nouveau projet vidéo"));
    const descriptions = modele === "produit" ? [t("Présentez le produit et son décor."), t("Montrez le produit en utilisation."), t("Terminez par un plan du produit.")]
      : modele === "histoire" ? [t("Présentez le lieu et le personnage."), t("Décrivez une action simple."), t("Décrivez le plan final.")] : [""];
    enregistrerStudio(p.id, { format: "paysage", scenes: descriptions.map(description => ({ id: aleatoire(12), description })) });
    setSelection(p.id); setErreur("");
  };
  const lancer = async (toutes: boolean, scene?: string) => {
    if (!projet) return;
    setOccupe(true); setErreur(""); sequences.current = true;
    const id = projet.id;
    try {
      const cibles = toutes ? studio?.scenes.filter(s => !s.clip).map(s => s.id) ?? [] : [scene!];
      for (const cible of cibles) {
        if (!sequences.current) break;
        await genererScene(id, cible);
        // Une génération à la fois, et suivi toujours actif en quittant la page.
        while (sequences.current && getProject(id)?.studioVideo?.scenes.find(s => s.id === cible)?.travail) await new Promise(r => setTimeout(r, 1000));
        const derniere = getProject(id)?.studioVideo?.scenes.find(s => s.id === cible);
        if (derniere?.erreur) throw new Error(derniere.erreur);
      }
    } catch (e) { setErreur(e instanceof Error ? e.message : String(e)); }
    finally { setOccupe(false); sequences.current = false; }
  };
  const preparer = async () => {
    if (!projet || !studio?.brief?.trim()) return;
    const id = projet.id;
    setPrepare(true); setErreur("");
    try {
      const r = await apiFetch("/helix/videos/scenario", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ brief: studio.brief }) });
      const d = await r.json() as { scenes?: string[]; error?: { message?: string } };
      if (!r.ok || !d.scenes) throw new Error(d.error?.message ?? t("L'instance n'a pas répondu."));
      const actuel = getProject(id)?.studioVideo;
      if (!actuel) return;
      const gardees = actuel.scenes.filter(s => s.description.trim() || s.clip || s.travail);
      enregistrerStudio(id, { ...actuel, scenes: [...gardees, ...d.scenes.map(description => ({ id: aleatoire(12), description }))].slice(0, 12) });
    } catch (e) { setErreur(e instanceof Error ? e.message : String(e)); }
    finally { setPrepare(false); }
  };
  const exporter = async () => {
    if (!studio) return;
    setExporte(true); setErreur(""); controleExport.current = new AbortController();
    try { telechargerBlob(await assemblerClips(studio.scenes.map(s => s.clip!.id), studio.format, setRangExport, controleExport.current.signal), `${projet.name}.webm`); }
    catch (e) { if (!(e instanceof DOMException && e.name === "AbortError")) setErreur(e instanceof Error ? e.message : String(e)); }
    finally { setExporte(false); }
  };
  const enCours = exporte || prepare || occupe || Boolean(studio?.scenes.some(s => s.travail));
  return <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
    <div className="mx-auto w-full max-w-6xl space-y-6 p-4 pb-8 sm:p-6 sm:pb-10">
    <PageHeader title={t("Studio vidéo")} subtitle={t("Préparez vos scènes, créez vos clips sur cette machine et assemblez votre vidéo.")} />
    <div className="flex flex-wrap gap-2">
      <Button icon={Plus} onClick={() => nouveau("libre")}>{t("Nouveau projet vidéo")}</Button>
      <Button variant="secondary" onClick={() => nouveau("produit")}>{t("Vidéo produit")}</Button>
      <Button variant="secondary" onClick={() => nouveau("histoire")}>{t("Histoire courte")}</Button>
    </div>
    <div className="grid gap-5 lg:grid-cols-[15rem_minmax(0,1fr)]">
      <aside className="space-y-2" aria-label={t("Projets vidéo")}>
        {miens.map(p => <button key={p.id} type="button" aria-pressed={projet?.id === p.id} onClick={() => setSelection(p.id)}
          className={`flex min-h-11 w-full items-center gap-2 rounded-xl border p-3 text-start text-sm ${projet?.id === p.id ? "border-primary bg-muted" : "border-border"}`}>
          <Film size={16} className="shrink-0" aria-hidden="true" /><span className="truncate">{p.name}</span></button>)}
      </aside>
      <main className="min-w-0 space-y-4">
        {!projet || !studio ? <div className="rounded-2xl border border-border bg-card p-8 text-sm text-muted-foreground">{t("Créez un projet pour préparer votre première vidéo.")}</div> : <>
          <section className="space-y-4 rounded-2xl border border-border bg-card p-4">
            <Field label={t("Nom du projet")}><Input aria-label={t("Nom du projet")} value={projet.name} maxLength={120} disabled={enCours} onChange={e => rename(projet.id, { name: e.target.value })} /></Field>
            <Field label={t("Décrivez votre vidéo")}><Textarea aria-label={t("Décrivez votre vidéo")} rows={3} maxLength={2000} disabled={enCours} value={studio.brief ?? ""} onChange={e => sauvegarder({ ...studio, brief: e.target.value })} /></Field>
            <Button variant="secondary" icon={prepare ? Loader2 : Film} disabled={enCours || !studio.brief?.trim() || studio.scenes.filter(s => s.description.trim() || s.clip).length > 9} onClick={() => void preparer()}>{t("Préparer les scènes")}</Button>
            <div className="flex flex-wrap items-center gap-3">
              <ImageChip genre="video" format={studio.format} onFormat={f => { if (!enCours) sauvegarder({ ...studio, format: f === "portrait" ? "portrait" : "paysage" }); }} />
              <label className="text-sm">{t("Format")}<select className="ms-2 rounded-lg border border-border bg-background p-2" disabled={enCours} value={studio.format} onChange={e => sauvegarder({ ...studio, format: e.target.value as StudioVideo["format"] })}>
                <option value="paysage">{t("Paysage")}</option><option value="portrait">{t("Portrait")}</option>
              </select></label>
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">{t("Wan crée des clips courts sans son. Les dimensions et la durée dépendent du modèle adapté à votre machine. L'assemblage WebM s'effectue en temps réel dans cette fenêtre.")}</p>
            {!etat && <p role="status" className="text-sm text-muted-foreground">{t("Instance injoignable : impossible de savoir si elle crée des vidéos.")}</p>}
            {etat && !etat.pret && <p className="text-sm text-muted-foreground">{etat.raison || t("Choisissez et installez un modèle dans les réglages de la vidéo.")}</p>}
          </section>
          <ol className="space-y-4">
            {studio.scenes.map((s, i) => <li key={s.id} className="space-y-3 rounded-2xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-sm font-medium">{tf("Scène {0}", i + 1)}</h2>
                <div className="flex flex-wrap gap-1">
                  {[{ Icon: ArrowUp, nom: t("Monter"), destination: i - 1 }, { Icon: ArrowDown, nom: t("Descendre"), destination: i + 1 }].map(({ Icon, nom, destination }) => <Button key={nom} variant="ghost" aria-label={nom} className="min-h-11" disabled={enCours || destination < 0 || destination >= studio.scenes.length} icon={Icon} onClick={() => { const scenes = [...studio.scenes]; [scenes[i], scenes[destination]] = [scenes[destination]!, scenes[i]!]; sauvegarder({ ...studio, scenes }); }} />)}
                  <Button variant="ghost" icon={Copy} aria-label={t("Dupliquer")} className="min-h-11" disabled={enCours || studio.scenes.length >= 12} onClick={() => { const scenes = [...studio.scenes]; scenes.splice(i + 1, 0, { id: aleatoire(12), description: s.description }); sauvegarder({ ...studio, scenes }); }} />
                  <Button variant="ghost" icon={Trash2} aria-label={t("Retirer la scène")} className="min-h-11" disabled={enCours || studio.scenes.length === 1} onClick={() => sauvegarder({ ...studio, scenes: studio.scenes.filter(x => x.id !== s.id) })} />
                </div>
              </div>
              <Field label={t("Description")}><Textarea aria-label={`${t("Description")} ${i + 1}`} rows={3} maxLength={2000} disabled={enCours} value={s.description} onChange={e => sauvegarder({ ...studio, scenes: studio.scenes.map(x => x.id === s.id ? { ...x, description: e.target.value } : x) })} /></Field>
              {s.clip && <Clip clip={s.clip} />}
              {s.travail && <p role="status" className="flex items-center gap-2 text-sm"><Loader2 size={16} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />{travaux[s.travail]?.message ?? t("Création de la vidéo...")}</p>}
              {s.erreur && <p role="alert" className="text-sm text-destructive">{s.erreur}</p>}
              <Button variant="secondary" icon={Play} disabled={enCours || !etat?.pret || !s.description.trim()} onClick={() => void lancer(false, s.id)}>{s.clip ? t("Régénérer") : t("Générer la scène")}</Button>
            </li>)}
          </ol>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" icon={Plus} disabled={enCours || studio.scenes.length >= 12} onClick={() => sauvegarder({ ...studio, scenes: [...studio.scenes, { id: aleatoire(12), description: "" }] })}>{t("Ajouter une scène")}</Button>
            <Button icon={enCours ? Loader2 : Film} disabled={enCours || !etat?.pret || studio.scenes.some(s => !s.description.trim()) || studio.scenes.every(s => s.clip)} onClick={() => void lancer(true)}>{t("Générer les scènes manquantes")}</Button>
            <Button icon={exporte ? Loader2 : Download} disabled={exporte || enCours || studio.scenes.some(s => !s.clip)} onClick={() => void exporter()}>{exporte ? tf("Assemblage : scène {0}", rangExport) : t("Exporter la vidéo")}</Button>
            {exporte && <Button variant="secondary" onClick={() => controleExport.current?.abort()}>{t("Annuler")}</Button>}
          </div>
        </>}
        {erreur && <p role="alert" className="text-sm text-destructive">{erreur}</p>}
      </main>
    </div>
    </div>
  </div>;
}
