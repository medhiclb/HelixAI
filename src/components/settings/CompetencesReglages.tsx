import { ImporterCompetenceLien } from "@/components/competences/ImporterCompetenceLien";
import { useRef, useState } from "react";
import { Download, FileUp, Pencil, Plus, Sparkles, Users, User as UserIcon } from "lucide-react";
import { SettingsPage, SettingsRow, Card } from "@/components/settings/SettingsShell";
import { EditeurCompetence, type ValeursEditeur } from "@/components/competences/EditeurCompetence";
import { Button } from "@/components/ui/Button";
import { InfoBox } from "@/components/ui/InfoBox";
import { Switch } from "@/components/ui/Switch";
import { useCompetences } from "@/hooks/useCompetences";
import { exemplesDeCompetences, type Competence } from "@/lib/store/competences";
import { lireFichiersCompetence, telechargerCompetence } from "@/lib/competencesFichier";
import { branding } from "@/config/branding";
import { t, tf } from "@/lib/i18n";

type Ouverte =
  | { genre: "nouvelle" }
  | { genre: "existante"; competence: Competence }
  | { genre: "import"; valeurs: Partial<ValeursEditeur>; avertissements: string[] };

/**
 * Réglages, « Compétences » (23/10/2026, demandé par Medhi : « la possibilité
 * pour les gens de créer leurs skills »).
 *
 * Jusque-là, les compétences ne se trouvaient que dans le panneau de Cowork.
 * Elles valent pourtant partout (Chat, Cowork, Code, tâches, employés :
 * gateway/src/competences.ts) : elles ont donc un écran à elles, rangé avec
 * l'IA, où l'on crée, modifie, allume, éteint, supprime, importe et exporte.
 */
export function CompetencesSettings() {
  const { competences, creer, modifier, supprimer, allumee, basculer, moi } = useCompetences();
  const [ouverte, setOuverte] = useState<Ouverte | null>(null);
  const [erreurImport, setErreurImport] = useState<string | null>(null);
  const choix = useRef<HTMLInputElement>(null);
  const exemples = exemplesDeCompetences();
  const miennes = competences.filter((c) => c.ownerId === moi);
  const partagees = competences.filter((c) => c.ownerId !== moi);

  const importer = async (liste: FileList | null) => {
    setErreurImport(null);
    const fichiers = Array.from(liste ?? []);
    if (choix.current) choix.current.value = "";
    if (fichiers.length === 0) return;
    const lecture = await lireFichiersCompetence(fichiers).catch(() => null);
    if (!lecture) {
      setErreurImport(t("Ce fichier n'a pas pu être lu."));
      return;
    }
    // Rien de lisible : on le dit. Sinon l'éditeur s'ouvre, contenu entier, et c'est la personne qui accepte.
    if (!lecture.nom && !lecture.instructions) {
      setErreurImport(lecture.probleme ?? t("Ce fichier ne contient pas de compétence."));
      return;
    }
    setOuverte({
      genre: "import",
      valeurs: { nom: lecture.nom, quand: lecture.quand, instructions: lecture.instructions, fichiers: lecture.fichiers, visibilite: "personnel" },
      avertissements: lecture.avertissements,
    });
  };

  const ligne = (c: Competence) => {
    const sienne = c.ownerId === moi;
    return (
      <li key={c.id} className="flex items-start gap-3 py-3">
        <Switch checked={allumee(c)} onChange={(v) => basculer(c, v)} label={tf("Activer la compétence {0}", c.nom)} />
        <div className="min-w-0 flex-1">
          <p className={allumee(c) ? "truncate text-sm font-medium text-foreground" : "truncate text-sm font-medium text-muted-foreground"}>{c.nom}</p>
          {c.quand && <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{c.quand}</p>}
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              {c.visibilite === "organisation" ? <Users size={12} strokeWidth={1.75} /> : <UserIcon size={12} strokeWidth={1.75} />}
              {c.visibilite === "organisation" ? (sienne ? t("Partagée à l'organisation") : t("Partagée par un collègue")) : t("Personnelle")}
            </span>
            {(c.fichiers?.length ?? 0) > 0 && <span>{tf("{0} fichier(s) joint(s)", c.fichiers!.length)}</span>}
            {c.origine === "importee" && <span>{t("Importée")}</span>}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button variant="ghost" size="sm" icon={Pencil} onClick={() => setOuverte({ genre: "existante", competence: c })}>
            {sienne ? t("Modifier") : t("Lire")}
          </Button>
          <Button variant="ghost" size="sm" icon={Download} aria-label={tf("Exporter {0}", c.nom)} onClick={() => telechargerCompetence(c)} />
        </div>
      </li>
    );
  };

  return (
    <SettingsPage
      title={t("Compétences")}
      subtitle={tf("Vos manières de faire, que {0} applique quand une demande s'y prête : dans le Chat, Cowork, Code et les tâches des agents.", branding.name)}
    >
      <SettingsRow
        title={t("Vos compétences")}
        desc={t("Allumez celles qui doivent servir. Une compétence d'un collègue s'éteint pour vous seul.")}
      >
        <Card>
          {competences.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("Aucune compétence pour l'instant. Créez-en une, importez un fichier SKILL.md, ou partez d'un exemple ci-dessous.")}</p>
          ) : (
            <>
              {miennes.length > 0 && <ul className="divide-y divide-border">{miennes.map(ligne)}</ul>}
              {partagees.length > 0 && (
                <>
                  <p className="mt-4 text-xs font-medium uppercase tracking-wide text-muted-foreground">{t("Partagées par vos collègues")}</p>
                  <ul className="divide-y divide-border">{partagees.map(ligne)}</ul>
                </>
              )}
            </>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <Button icon={Plus} onClick={() => setOuverte({ genre: "nouvelle" })}>
              {t("Créer une compétence")}
            </Button>
            <input
              ref={choix}
              type="file"
              multiple
              accept=".md,.markdown,.txt,.zip,text/markdown,application/zip"
              className="hidden"
              onChange={(e) => void importer(e.target.files)}
            />
            <ImporterCompetenceLien onImport={lecture => setOuverte({ genre: "import", valeurs: { nom: lecture.nom, quand: lecture.quand, instructions: lecture.instructions, fichiers: lecture.fichiers, visibilite: "personnel" }, avertissements: lecture.avertissements })} />
            <Button variant="secondary" icon={FileUp} onClick={() => choix.current?.click()}>
              {t("Importer")}
            </Button>
          </div>
          {erreurImport && <p className="mt-2 text-xs text-destructive">{erreurImport}</p>}
        </Card>
      </SettingsRow>

      <SettingsRow
        title={t("Partager en fichier")}
        desc={t("Le format SKILL.md, répandu et ouvert : un dossier avec un fichier SKILL.md (nom, description, puis les instructions) et ses fichiers joints.")}
      >
        <InfoBox tone="muted" leading={<FileUp size={15} strokeWidth={1.75} />}>
          {t("« Exporter » donne une archive ZIP que vos collègues, ou d'autres outils qui lisent ce format, peuvent importer. « Importer » accepte cette archive, un fichier .md seul, ou un SKILL.md choisi avec ses fichiers voisins. Le contenu s'affiche en entier avant d'être ajouté, et rien de ce qu'il contient n'est jamais exécuté : un script joint n'est que du texte que l'assistant lit.")}
        </InfoBox>
      </SettingsRow>

      <SettingsRow
        title={t("Comment l'assistant s'en sert")}
        desc={t("Pour ne pas encombrer la place du modèle.")}
      >
        <InfoBox tone="muted" leading={<Sparkles size={15} strokeWidth={1.75} />}>
          {t("Quand elles tiennent, toutes les compétences allumées sont données en entier à l'assistant. Quand la place manque, il reçoit le nom et la phrase « quand s'en servir » de chacune, et le texte complet des trois au plus qui correspondent le mieux à votre demande. Sous la réponse, une ligne discrète nomme la compétence donnée en entier pour cette demande. Vos employés toujours actifs ne reçoivent que les compétences partagées à l'organisation.")}
        </InfoBox>
      </SettingsRow>

      <SettingsRow title={t("Exemples")} desc={t("À ajouter si vous le souhaitez, puis à adapter. Ajoutés éteints, pour que vous les relisiez d'abord.")} last>
        <Card>
          <ul className="divide-y divide-border">
            {exemples.map((x) => {
              const deja = competences.some((c) => c.ownerId === moi && c.origine === "exemple" && c.nom === x.nom);
              return (
                <li key={x.cle} className="flex items-start gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground">{x.nom}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{x.quand}</p>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={Plus}
                    disabled={deja}
                    onClick={() => creer({ nom: x.nom, quand: x.quand, instructions: x.instructions, visibilite: "personnel", origine: "exemple", active: false })}
                  >
                    {deja ? t("Ajoutée") : t("Ajouter")}
                  </Button>
                </li>
              );
            })}
          </ul>
        </Card>
      </SettingsRow>

      {ouverte?.genre === "nouvelle" && <EditeurCompetence competence={null} onFermer={() => setOuverte(null)} onEnregistrer={(v) => creer(v)} />}
      {ouverte?.genre === "import" && (
        <EditeurCompetence
          competence={null}
          initial={ouverte.valeurs}
          avertissements={ouverte.avertissements}
          onFermer={() => setOuverte(null)}
          onEnregistrer={(v) => creer({ ...v, origine: "importee" })}
        />
      )}
      {ouverte?.genre === "existante" && (
        <EditeurCompetence
          competence={ouverte.competence}
          lectureSeule={ouverte.competence.ownerId !== moi}
          onFermer={() => setOuverte(null)}
          onEnregistrer={(v) => modifier(ouverte.competence.id, v)}
          onSupprimer={() => supprimer(ouverte.competence.id)}
        />
      )}
    </SettingsPage>
  );
}

export default CompetencesSettings;
