import { useEffect, useRef, useState } from "react";
import { Check, Globe, Info, Loader2, Plus, RotateCw, Terminal, Trash2, X } from "lucide-react";
import {
  ajouterPersonnalise,
  connecter,
  definirLectures,
  etat as lireEtat,
  retirer,
  type ConnecteurInstalle,
  type DemandePersonnalise,
  type EtatConnecteurs,
} from "@/lib/connecteurs";
import { Card } from "@/components/settings/SettingsShell";
import { Button } from "@/components/ui/Button";
import { Field, Input, Textarea } from "@/components/ui/Field";
import { InfoBox } from "@/components/ui/InfoBox";
import { SegmentedTabs } from "@/components/ui/SegmentedTabs";
import { cn } from "@/lib/cn";
import { t, tf } from "@/lib/i18n";

/**
 * Vos propres serveurs MCP (16/10/2026, demande de Medhi : « créer son propre
 * MCP »). L'instance savait déjà brancher un serveur quelconque, mais
 * seulement sur une instance réglée par l'intégrateur, et rien à l'écran ne le
 * disait. Ici, l'administrateur en ajoute un de deux façons :
 *  - « Programme de cette machine » : un programme et ses arguments, lancés
 *    sans interpréteur de commandes, avec les variables qu'il donne (chiffrées) ;
 *    seulement depuis cette machine, instance fermée aux collègues ;
 *  - « Adresse » : un serveur en https (autorisation dans le navigateur s'il
 *    en demande une), ou sur la boucle locale de cette machine.
 * Tous ses outils demandent l'accord avant d'agir ; l'administrateur coche
 * ceux qui ne font que lire. C'est l'instance qui juge et refuse
 * (gateway/src/mcpPersoRegles.ts, connecteurs.ts) : cet écran ne fait que
 * transmettre. Aide : « Brancher votre propre serveur MCP ».
 */

/** « Mon serveur interne » → « mon-serveur-interne » : l'identifiant devient le préfixe des outils. */
const identifiantDe = (nom: string): string =>
  nom
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32)
    .replace(/[-_]+$/, "");

interface Variable {
  nom: string;
  valeur: string;
}

export function ServeursPersonnalises({
  etat,
  surEtat,
  surChangement,
}: {
  etat: EtatConnecteurs;
  surEtat: (e: EtatConnecteurs) => void;
  surChangement: () => void;
}) {
  const permis = etat.personnalise;
  const installes = etat.installes.filter((c) => c.personnalise);
  const [ouvert, setOuvert] = useState(false);
  const [mode, setMode] = useState<"programme" | "adresse">(permis?.programme ? "programme" : "adresse");
  const [nom, setNom] = useState("");
  const [identifiant, setIdentifiant] = useState("");
  const [identifiantTouche, setIdentifiantTouche] = useState(false);
  const [description, setDescription] = useState("");
  const [commande, setCommande] = useState("");
  const [args, setArgs] = useState("");
  const [variables, setVariables] = useState<Variable[]>([]);
  const [adresse, setAdresse] = useState("");
  const [jeton, setJeton] = useState("");
  const [entetes, setEntetes] = useState<Variable[]>([]);
  const [enCours, setEnCours] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [succes, setSucces] = useState<string | null>(null);
  /** Outils cochés « lecture seule », par serveur, avant enregistrement. */
  const [lectures, setLectures] = useState<Record<string, string[]>>({});
  const sondage = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => {
    if (sondage.current) clearInterval(sondage.current);
  }, []);

  // Rien à montrer à qui ne peut rien ajouter, s'il n'y a rien d'ajouté.
  if (!permis?.ajouter && installes.length === 0) return null;

  const vider = () => {
    setNom("");
    setIdentifiant("");
    setIdentifiantTouche(false);
    setDescription("");
    setCommande("");
    setArgs("");
    setVariables([]);
    setAdresse("");
    setJeton("");
    setEntetes([]);
  };

  /** Une autorisation est demandée dans le navigateur : on relit l'état jusqu'à ce que le serveur réponde. */
  const attendre = (id: string) => {
    if (sondage.current) clearInterval(sondage.current);
    let tours = 0;
    sondage.current = setInterval(() => {
      tours += 1;
      void lireEtat().then((suite) => {
        if (!suite) return;
        surEtat(suite);
        const issue = suite.issues?.[id];
        const vivant = suite.installes.find((c) => c.id === id);
        if ((issue && !issue.ok) || vivant?.running || tours > 150) {
          if (sondage.current) clearInterval(sondage.current);
          sondage.current = null;
          setEnCours(null);
          if (issue && !issue.ok) setErreur(issue.message);
          else if (vivant?.running) {
            setSucces(tf("« {0} » est connecté.", vivant.label));
            surChangement();
          }
        }
      });
    }, 2000);
  };

  const soumettre = async () => {
    setErreur(null);
    setSucces(null);
    setEnCours("ajout");
    const commun = { id: identifiant || identifiantDe(nom), label: nom.trim(), description: description.trim() || undefined };
    const demande: DemandePersonnalise =
      mode === "programme"
        ? {
            ...commun,
            mode,
            command: commande.trim(),
            args: args.split("\n").map((a) => a.trim()).filter(Boolean),
            variables: Object.fromEntries(variables.filter((v) => v.nom.trim()).map((v) => [v.nom.trim(), v.valeur])),
          }
        : { ...commun, mode, url: adresse.trim(), entetes: { ...Object.fromEntries(entetes.filter(v => v.nom.trim()).map(v => [v.nom.trim(), v.valeur])), ...(jeton.trim() ? { Authorization: `Bearer ${jeton.trim()}` } : {}) } };
    const r = await ajouterPersonnalise(demande);
    if (r.etat) surEtat(r.etat);
    if (!r.ok) {
      setEnCours(null);
      setErreur(r.message);
      return;
    }
    // Les valeurs des variables ne restent pas dans le navigateur.
    vider();
    setOuvert(false);
    if (r.adresse) {
      setSucces(r.message);
      window.open(r.adresse, "_blank", "noopener,noreferrer");
      setEnCours(commun.id);
      attendre(commun.id);
      return;
    }
    setEnCours(null);
    setSucces(r.message);
    surChangement();
  };

  const relancer = async (c: ConnecteurInstalle) => {
    setErreur(null);
    setSucces(null);
    setEnCours(c.id);
    const r = await connecter(c.id);
    if (r.etat) surEtat(r.etat);
    if (r.ok && r.adresse) {
      setSucces(r.message);
      window.open(r.adresse, "_blank", "noopener,noreferrer");
      attendre(c.id);
      return;
    }
    setEnCours(null);
    if (r.ok) {
      setSucces(r.message);
      surChangement();
    } else setErreur(r.message);
  };

  const enlever = async (c: ConnecteurInstalle) => {
    setErreur(null);
    setSucces(null);
    setEnCours(c.id);
    const r = await retirer(c.id);
    setEnCours(null);
    if (r.etat) surEtat(r.etat);
    if (r.ok) {
      setSucces(r.message);
      surChangement();
    } else setErreur(r.message);
  };

  const enregistrerLectures = async (c: ConnecteurInstalle) => {
    setErreur(null);
    setSucces(null);
    setEnCours(c.id);
    const r = await definirLectures(c.id, lectures[c.id] ?? c.personnalise?.lectures ?? []);
    setEnCours(null);
    if (r.etat) surEtat(r.etat);
    if (r.ok) {
      setSucces(r.message);
      setLectures((l) => {
        const suite = { ...l };
        delete suite[c.id];
        return suite;
      });
    } else setErreur(r.message);
  };

  const pret = nom.trim() && (mode === "programme" ? commande.trim() : adresse.trim());

  return (
    <Card className="mt-4 max-sm:p-3">
      <h3 className="flex items-center gap-2 text-lg font-semibold text-foreground">
        <Terminal size={18} strokeWidth={1.75} />{" "}{t("Vos propres serveurs MCP")}
      </h3>
      <p className="mt-1 text-sm text-muted-foreground">
        {t("Un serveur MCP que vous avez écrit, ou celui d'un outil interne : vos agents utilisent ses outils comme ceux d'un connecteur. Chaque outil demande votre accord avant d'agir, sauf ceux que vous marquez « lecture seule ».")}
      </p>

      {succes && (
        <InfoBox className="mt-3" leading={<Check size={15} strokeWidth={2} />}>
          {succes}
        </InfoBox>
      )}
      {erreur && (
        <InfoBox tone="warning" className="mt-3" leading={<Info size={15} strokeWidth={1.75} />}>
          {erreur}
        </InfoBox>
      )}

      {installes.length > 0 && (
        <div className="mt-4 space-y-2">
          {installes.map((c) => {
            const p = c.personnalise!;
            const coches = lectures[c.id] ?? p.lectures;
            const modifie = lectures[c.id] !== undefined;
            return (
              <div key={c.id} className="rounded-xl border border-border p-3.5 max-sm:p-2">
                <div className="flex flex-wrap items-center gap-3">
                  <span className={cn("h-2 w-2 shrink-0 rounded-full", c.running ? "bg-success" : "bg-warning")} />
                  <span className="shrink-0 text-muted-foreground">
                    {p.mode === "adresse" ? <Globe size={16} strokeWidth={1.75} /> : <Terminal size={16} strokeWidth={1.75} />}
                  </span>
                  <div className="min-w-[9rem] flex-1">
                    <p className="text-sm font-medium text-foreground">{c.label}</p>
                    <p className="text-xs text-muted-foreground">{c.description}</p>
                    {p.cible && <p className="mt-1 break-all font-mono text-xs text-muted-foreground" dir="ltr">{p.cible}</p>}
                    {c.error ? (
                      <p className="mt-1 text-xs text-destructive">{c.error}</p>
                    ) : (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {c.toolCount}{" "}{t("outil(s)")}{" · "}{p.mode === "adresse" ? t("à une adresse") : t("programme de cette machine")}
                      </p>
                    )}
                  </div>
                  {permis?.ajouter && (
                    <span className="flex shrink-0 flex-wrap items-center gap-1">
                      {!c.running && (
                        <Button variant="secondary" size="sm" icon={enCours === c.id ? Loader2 : RotateCw} disabled={enCours !== null} onClick={() => void relancer(c)}>
                          {t("Réessayer")}
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" icon={enCours === c.id ? Loader2 : Trash2} disabled={enCours !== null} onClick={() => void enlever(c)}>
                        {t("Retirer")}
                      </Button>
                    </span>
                  )}
                </div>
                {permis?.ajouter && p.outils.length > 0 && (
                  <div className="mt-3 border-t border-border pt-3">
                    <p className="text-xs font-medium text-foreground">{t("Outils qui ne font que lire (sans carte d'accord) :")}</p>
                    <div className="mt-2 space-y-1.5">
                      {p.outils.map((o) => (
                        <label key={o.nom} className="flex items-start gap-2 text-sm text-foreground">
                          <input
                            type="checkbox"
                            className="mt-1"
                            checked={coches.includes(o.nom)}
                            onChange={(e) =>
                              setLectures((l) => ({
                                ...l,
                                [c.id]: e.target.checked ? [...coches, o.nom] : coches.filter((n) => n !== o.nom),
                              }))
                            }
                          />
                          <span className="min-w-0">
                            <span className="font-mono text-xs" dir="ltr">{o.nom}</span>
                            {o.description && <span className="block text-xs text-muted-foreground">{o.description}</span>}
                          </span>
                        </label>
                      ))}
                    </div>
                    {modifie && (
                      <Button className="mt-2" size="sm" icon={enCours === c.id ? Loader2 : Check} disabled={enCours !== null} onClick={() => void enregistrerLectures(c)}>
                        {t("Enregistrer")}
                      </Button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {permis?.ajouter && !ouvert && (
        <Button className="mt-4" variant="secondary" size="sm" icon={Plus} onClick={() => { setOuvert(true); setErreur(null); setSucces(null); }}>
          {t("Ajouter un serveur MCP")}
        </Button>
      )}

      {permis?.ajouter && ouvert && (
        <form
          className="mt-4 space-y-3 rounded-xl border border-border p-3.5 max-sm:p-2"
          onSubmit={(e) => {
            e.preventDefault();
            void soumettre();
          }}
        >
          <SegmentedTabs
            size="sm"
            value={mode}
            onChange={(v) => setMode(v as "programme" | "adresse")}
            options={[
              { id: "programme", label: t("Programme de cette machine"), icon: Terminal },
              { id: "adresse", label: t("Adresse"), icon: Globe },
            ]}
            disabledIds={permis.programme ? [] : ["programme"]}
            disabledTitle={t("Seulement depuis la machine de l'instance, quand elle n'est pas ouverte aux collègues.")}
          />
          <Field label={t("Nom")} required>
            <Input
              value={nom}
              maxLength={60}
              onChange={(e) => {
                setNom(e.target.value);
                if (!identifiantTouche) setIdentifiant(identifiantDe(e.target.value));
              }}
            />
          </Field>
          <Field label={t("Identifiant")} hint={t("Lettres minuscules, chiffres et tirets : il précède le nom de chaque outil.")}>
            <Input
              dir="ltr"
              value={identifiant}
              maxLength={32}
              onChange={(e) => {
                setIdentifiantTouche(true);
                setIdentifiant(e.target.value.toLowerCase());
              }}
            />
          </Field>
          <Field label={t("Description")} hint={t("Ce que fait ce serveur, en une phrase : vos agents la lisent.")}>
            <Input value={description} maxLength={300} onChange={(e) => setDescription(e.target.value)} />
          </Field>

          {mode === "programme" ? (
            <>
              <Field label={t("Programme")} required hint={t("Son chemin complet, ou son nom s'il est dans le PATH (par exemple node, python3, npx). Lancé sans interpréteur de commandes : pas de sh, bash, cmd ni PowerShell.")}>
                <Input dir="ltr" value={commande} onChange={(e) => setCommande(e.target.value)} placeholder="/usr/local/bin/node" />
              </Field>
              <Field label={t("Arguments")} hint={t("Un par ligne, tels quels : ni guillemets ni échappement.")}>
                <Textarea dir="ltr" rows={3} value={args} onChange={(e) => setArgs(e.target.value)} placeholder={"/Users/vous/mon-serveur/index.js\n--lecture-seule"} />
              </Field>
              <div className="space-y-1.5">
                <p className="text-sm font-medium text-foreground">{t("Variables d'environnement")}</p>
                <p className="text-xs text-muted-foreground">
                  {t("Pour une clé ou un jeton : chiffrés dans l'instance et passés au programme par son environnement, jamais affichés ni mis dans la ligne de commande. Le programme ne reçoit aucune autre variable de l'instance.")}
                </p>
                {variables.map((v, i) => (
                  <div key={i} className="flex flex-wrap items-center gap-2">
                    <Input
                      dir="ltr"
                      className="min-w-[8rem] flex-1"
                      placeholder={t("NOM")}
                      value={v.nom}
                      onChange={(e) => setVariables((l) => l.map((x, j) => (j === i ? { ...x, nom: e.target.value.toUpperCase() } : x)))}
                    />
                    <Input
                      dir="ltr"
                      type="password"
                      autoComplete="off"
                      className="min-w-[8rem] flex-1"
                      placeholder={t("valeur")}
                      value={v.valeur}
                      onChange={(e) => setVariables((l) => l.map((x, j) => (j === i ? { ...x, valeur: e.target.value } : x)))}
                    />
                    <Button variant="ghost" size="sm" icon={X} aria-label={t("Retirer cette variable")} onClick={() => setVariables((l) => l.filter((_, j) => j !== i))} />
                  </div>
                ))}
                <Button variant="ghost" size="sm" icon={Plus} onClick={() => setVariables((l) => [...l, { nom: "", valeur: "" }])}>
                  {t("Ajouter une variable")}
                </Button>
              </div>
            </>
          ) : (
            <>
            <Field
              label={t("Adresse du serveur")}
              required
              hint={
                permis.programme
                  ? t("En https, ou un serveur de cette machine en http://127.0.0.1:port/… Si le serveur demande une autorisation, sa page s'ouvre dans votre navigateur.")
                  : t("En https. Si le serveur demande une autorisation, sa page s'ouvre dans votre navigateur.")
              }
            >
              <Input dir="ltr" value={adresse} onChange={(e) => setAdresse(e.target.value)} placeholder="https://mcp.exemple.org/mcp" />
            </Field>
            <Field label={t("Jeton Bearer (facultatif)")} hint={t("La clé est chiffrée sur l'instance et envoyée uniquement à ce serveur. Laissez vide pour une connexion OAuth ou sans clé.")}>
              <Input aria-label={t("Jeton Bearer (facultatif)")} maxLength={7993} type="password" autoComplete="new-password" value={jeton} onChange={e => setJeton(e.target.value)} />
            </Field>
            {entetes.map((v, i) => <div key={i} className="flex items-end gap-2">
              <Field className="min-w-0 flex-1" label={t("Nom de l'en-tête")}><Input required maxLength={128} aria-label={t("Nom de l'en-tête")} dir="ltr" value={v.nom} onChange={e => setEntetes(l => l.map((x,j) => j===i ? {...x,nom:e.target.value}:x))} /></Field>
              <Field className="min-w-0 flex-1" label={t("Valeur de l'en-tête")}><Input required maxLength={8000} aria-label={t("Valeur de l'en-tête")} type="password" autoComplete="new-password" value={v.valeur} onChange={e => setEntetes(l => l.map((x,j) => j===i ? {...x,valeur:e.target.value}:x))} /></Field>
              <Button variant="ghost" size="sm" icon={X} aria-label={t("Retirer cet en-tête")} onClick={() => setEntetes(l => l.filter((_,j) => j!==i))} />
            </div>)}
            <Button variant="ghost" size="sm" icon={Plus} disabled={entetes.length >= 16} onClick={() => setEntetes(l => [...l,{nom:"",valeur:""}])}>{t("Ajouter un en-tête")}</Button>
            </>
          )}

          <InfoBox leading={<Info size={15} strokeWidth={1.75} />}>
            {t("Un serveur MCP agit avec les droits de ce qu'il est : un programme de cette machine peut lire et écrire tout ce que votre compte peut toucher. N'ajoutez que du code que vous connaissez. Chaque outil demandera votre accord avant d'agir ; vous cocherez ensuite ceux qui ne font que lire.")}
          </InfoBox>

          {erreur && (
            <InfoBox tone="warning" leading={<Info size={15} strokeWidth={1.75} />}>
              {erreur}
            </InfoBox>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" size="sm" icon={enCours === "ajout" ? Loader2 : Check} disabled={!pret || enCours !== null}>
              {enCours === "ajout" ? t("Connexion...") : t("Ajouter")}
            </Button>
            <Button variant="ghost" size="sm" icon={X} onClick={() => { setOuvert(false); vider(); setErreur(null); }}>
              {t("Annuler")}
            </Button>
          </div>
        </form>
      )}
    </Card>
  );
}

export default ServeursPersonnalises;
