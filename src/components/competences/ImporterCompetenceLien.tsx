import { useState } from "react";
import { Link, Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/endpoint";
import { lireFichiersCompetence, type LectureCompetence } from "@/lib/competencesFichier";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { t, tf } from "@/lib/i18n";

export function ImporterCompetenceLien({ onImport }: { onImport: (lecture: LectureCompetence) => void }) {
  const [ouvert, setOuvert] = useState(false);
  const [adresse, setAdresse] = useState("");
  const [source, setSource] = useState("");
  const [candidats, setCandidats] = useState<string[]>([]);
  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState("");
  const lire = async (selection?: string) => {
    setOccupe(true); setErreur("");
    try {
      const r = await apiFetch("/helix/competences/importer-lien", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ adresse: selection ? source : adresse.trim(), selection }) });
      const d = await r.json();
      if (!r.ok) throw Error(d.error?.message ?? t("Ce dépôt n'a pas pu être lu."));
      if (Array.isArray(d.candidats)) { setCandidats(d.candidats); setSource(d.source); return; }
      const fichiers = (d.fichiers as { nom: string; base64: string }[]).map(f => new File([Uint8Array.from(atob(f.base64), c => c.charCodeAt(0))], f.nom));
      const lecture = await lireFichiersCompetence(fichiers);
      if (lecture.probleme && !lecture.instructions) throw Error(lecture.probleme);
      lecture.avertissements.push(...(d.avertissements ?? []), tf("Source de la compétence : {0}", d.source));
      onImport(lecture); setOuvert(false);
    } catch (e) { setErreur(e instanceof Error ? e.message : t("Ce dépôt n'a pas pu être lu.")); }
    finally { setOccupe(false); }
  };
  return <>
    <Button variant="secondary" icon={Link} onClick={() => { setOuvert(true); setCandidats([]); setErreur(""); }}>{t("Importer depuis un lien")}</Button>
    <Modal open={ouvert} onClose={() => { if (!occupe) setOuvert(false); }}>
      <form className="space-y-4" aria-busy={occupe} onSubmit={e => { e.preventDefault(); void lire(); }}>
        <h2 className="text-lg font-semibold">{t("Importer depuis un lien")}</h2>
        <p className="text-sm text-muted-foreground">{t("Collez un dépôt GitHub public, un lien vers SKILL.md ou un ZIP. Vous relirez la compétence avant de l’ajouter.")}</p>
        <label className="block space-y-2 text-sm"><span>{t("Lien de la compétence")}</span>
          <input autoFocus type="url" required value={adresse} onChange={e => { setAdresse(e.target.value); setCandidats([]); }} disabled={occupe} placeholder="https://github.com/auteur/skills" className="w-full rounded-lg border border-border bg-background p-3 text-foreground" />
        </label>
        <Button type="submit" disabled={occupe}>{occupe ? <><Loader2 size={16} className="animate-spin" aria-hidden="true" />{t("Lecture en cours...")}</> : t("Rechercher les compétences")}</Button>
        {candidats.length > 0 && <fieldset className="space-y-2"><legend className="mb-2 text-sm font-medium">{t("Choisissez une compétence")}</legend>
          <div className="max-h-64 space-y-2 overflow-y-auto">{candidats.map(p => <button key={p} type="button" disabled={occupe} onClick={() => void lire(p)} className="block w-full break-all rounded-lg border border-border p-3 text-left text-sm hover:bg-muted focus-visible:outline focus-visible:outline-2">{p}</button>)}</div>
        </fieldset>}
        {erreur && <p role="alert" className="text-sm text-destructive">{erreur}</p>}
      </form>
    </Modal>
  </>;
}
