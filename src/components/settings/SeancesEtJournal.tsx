import { useCallback, useEffect, useState } from "react";
import { Laptop, ShieldCheck, ShieldAlert, X, ScrollText } from "lucide-react";
import { apiFetch } from "@/lib/endpoint";
import { Button } from "@/components/ui/Button";
import { InfoBox } from "@/components/ui/InfoBox";
import { Card } from "@/components/settings/SettingsShell";
import { formaterDateHeure } from "@/lib/formats";
import { t, tf } from "@/lib/i18n";

/**
 * Séances ouvertes et journal d'audit.
 *
 * Deux questions qu'un utilisateur doit pouvoir se poser seul : « où suis-je
 * connecté ? » et « que s'est-il passé sur mon compte ? ». Sans écran, ces
 * garanties existent dans le code mais restent invisibles.
 */

interface Seance {
  id: string;
  poste: string;
  createdAt: string;
  lastSeenAt: string;
  courante?: boolean;
  /** Ouverte avec « Rester connecté » : elle dure trente jours, il faut le dire. */
  longue?: boolean;
}

interface Entree {
  quand: string;
  action: string;
  qui: string;
  detail: Record<string, unknown>;
}

interface Integrite {
  entrees: number;
  intact: boolean;
  anomalie?: { ligne: number; raison: string };
}

const LIBELLES: Record<string, string> = {
  "connexion.reussie": t("Connexion"),
  "connexion.refusee": t("Connexion refusée"),
  "connexion.bloquee": t("Compte temporairement bloqué"),
  "compte.cree": t("Compte créé"),
  "compte.invite": t("Collègue invité"),
  "seance.ouverte": t("Séance ouverte"),
  "seance.fermee": t("Séance fermée"),
  "donnees.ecrites": t("Données enregistrées"),
  "ecran.demande": t("Action d'écran demandée"),
  "ecran.approuve": t("Action d'écran autorisée"),
  "ecran.refuse": t("Action d'écran refusée"),
  "ecran.execute": t("Action d'écran exécutée"),
  "outil.appele": t("Outil utilisé"),
  "outil.demande": t("Autorisation d'outil demandée"),
  "outil.approuve": t("Outil autorisé"),
  "outil.refuse": t("Outil refusé"),
  "reglage.refuse": t("Réglage de l'instance refusé (réservé à l'administrateur)"),
  "approbation.niveau": t("Niveau d'approbation modifié"),
  "connecteur.ajoute": t("Connecteur ajouté"),
  "connecteur.retire": t("Connecteur retiré"),
  "dictee.installee": t("Dictée installée"),
  "dictee.transcrite": t("Dictée transcrite"),
  "tarif.modifie": t("Tarif de modèle modifié"),
  "compte.nom_modifie": t("Nom modifié"),
  "compte.adresse_modifiee": t("Adresse modifiée"),
  "compte.adresse_refusee": t("Changement d'adresse refusé"),
  "compte.supprime": t("Compte supprimé"),
  "motdepasse.defini": t("Mot de passe choisi"),
  "motdepasse.redefini": t("Mot de passe redéfini (mot de passe oublié)"),
  "motdepasse.reinitialise": t("Mot de passe réinitialisé par un administrateur"),
  "motdepasse.reinitialisation_refusee": t("Réinitialisation de mot de passe refusée"),
  "recuperation.codes_crees": t("Codes de récupération créés"),
  "connexion.second_facteur_demande": t("Code de vérification demandé"),
  "deuxfacteurs.active": t("Double authentification activée"),
  "deuxfacteurs.desactive": t("Double authentification désactivée"),
  "deuxfacteurs.codes_regeneres": t("Nouveaux codes de secours"),
  "connexion.second_facteur_a_activer": t("Double authentification à activer"),
  "moteur.conditions_acceptees": t("Conditions de LM Studio acceptées"),
  "moteur.llamacpp_installation": t("Installation du moteur llama.cpp"),
  "moteur.emplacement": t("Emplacement des modèles changé"),
  "moteur.choix_lmstudio": t("Moteur des modèles locaux choisi"),
  "moteur.optimisation": t("Réglages du moteur modifiés"),
  "moteur.contexte": t("Taille du contexte modifiée"),
  "code.opencode_installe": t("OpenCode installé (écran Code)"),
  "donnees.exportees": t("Données exportées"),
  "ecran.mode_modifie": t("Contrôle de l'écran activé ou désactivé"),
  "drive.branche": t("Google Drive connecté"),
  "drive.debranche": t("Google Drive déconnecté"),
  "drive.acces_perdu": t("Accès à Google Drive perdu"),
  "google.client_enregistre": t("Application Google enregistrée"),
  "google.client_efface": t("Application Google retirée"),
  "agenda_google.branche": t("Google Agenda connecté"),
  "agenda_google.debranche": t("Google Agenda déconnecté"),
  "agenda_google.acces_perdu": t("Accès à Google Agenda perdu"),
  "tache_programmee.creee": t("Tâche programmée créée"),
  "tache_programmee.supprimee": t("Tâche programmée supprimée"),
  "tache_programmee.executee": t("Tâche programmée exécutée"),
  "slack.branche": t("Slack connecté"),
  "slack.debranche": t("Slack déconnecté"),
  "slack.acces_perdu": t("Accès à Slack perdu"),
  // Sheets, Slides, YouTube, réseaux sociaux (oauthNatif.ts) : le service est dans le détail de l'entrée.
  "natif.application_enregistree": t("Application d'un service enregistrée"),
  "natif.application_effacee": t("Application d'un service retirée"),
  "natif.branche": t("Service connecté"),
  "natif.debranche": t("Service déconnecté"),
  "natif.acces_perdu": t("Accès à un service perdu"),
  "natif.publie": t("Écriture ou publication par un agent"),
  "employe.deploye": t("Agent mis en service"),
  "employe.modifie": t("Agent modifié"),
  "employe.supprime": t("Agent retiré"),
  "memoire.chat_effacee": t("Mémoire d'un Chat effacée"),
  "employe.message": t("Message traité par un agent"),
  "employe.mission_lancee": t("Mission lancée à la main"),
  "employe.mission_courrier": t("Mail reçu confié à un agent"),
  "courrier.envoye": t("Mail envoyé par l'assistant"),
  "employe.liberte": t("Liberté d'action d'un agent changée"),
  "employe.canal_branche": t("Messagerie branchée sur un agent"),
  "employe.canal_retire": t("Messagerie retirée d'un agent"),
  "employe.whatsapp_lie": t("Téléphone WhatsApp lié à un agent"),
  "employe.acces_accepte": t("Personne acceptée sur un canal"),
  "employe.outil_openclaw": t("Outil utilisé par un agent"),
  "employe.document_ajoute": t("Document confié à un agent"),
  "employe.document_retire": t("Document retiré d'un agent"),
  "openclaw.installe": t("OpenClaw installé"),
  "openclaw.mis_a_jour": t("OpenClaw mis à jour"),
  "openclaw.installation_echouee": t("Installation d'OpenClaw échouée"),
  "visual_cpp.installe": t("Bibliothèques Visual C++ de Microsoft installées"),
  "visual_cpp.echec": t("Installation des bibliothèques Visual C++ échouée"),
  "compte.photo_modifiee": t("Photo de profil modifiée"),
  "fournisseur.ajoute": t("Clé de modèle cloud branchée"),
  "fournisseur.modifie": t("Clé de modèle cloud modifiée"),
  "fournisseur.retire": t("Clé de modèle cloud retirée"),
  "cleapi.creee": t("Clé d'API créée"),
  "cleapi.renommee": t("Clé d'API renommée"),
  "cleapi.revoquee": t("Clé d'API révoquée"),
  "api.appel": t("Appel à l'API par une clé"),
  // Ajoutés le 27/09/2026 : sans libellé, le journal montrait la clé technique (« code.codex_connexion »).
  "machine.demarree": t("Machine virtuelle démarrée"),
  "machine.arretee": t("Machine virtuelle arrêtée"),
  "machine.effacee": t("Machine virtuelle effacée"),
  "images.installees": t("Création d'images installée"),
  "images.desinstallees": t("Création d'images désinstallée"),
  "images.creee": t("Image ou vidéo créée"),
  "entrainement.installe": t("Outils d'entraînement installés"),
  "entrainement.desinstalle": t("Outils d'entraînement désinstallés"),
  "entrainement.projet_cree": t("Projet d'entraînement créé"),
  "entrainement.projet_supprime": t("Projet d'entraînement supprimé"),
  "entrainement.paires_generees": t("Exemples d'entraînement préparés"),
  "entrainement.termine": t("Entraînement terminé"),
  "entrainement.publie": t("Modèle entraîné publié"),
  "entrainement.retire": t("Modèle entraîné retiré"),
  "import.logiciel": t("Chats importés d'une autre IA"),
  "code.codex_connexion": t("Connexion de Codex lancée"),
  "code.codex_tache": t("Tâche confiée à Codex"),
  "employe.memoire_videe": t("Mémoire d'un agent vidée"),
  "employe.memoire_non_videe": t("Mémoire d'un agent non vidée (échec)"),
  "employe.memoire_restauree": t("Mémoire d'un agent restaurée"),
  "employe.memoire_copie_supprimee": t("Copie de la mémoire d'un agent supprimée"),
  "groupe.cree": t("Groupe créé"),
  "groupe.modifie": t("Groupe modifié"),
  "groupe.quitte": t("Groupe quitté"),
  "groupe.supprime": t("Groupe supprimé"),
  "bibliotheque.dossier_cree": t("Dossier créé dans Fichiers"),
  "bibliotheque.importe": t("Document ajouté à Fichiers"),
  "bibliotheque.modifie": t("Document de Fichiers modifié"),
  "bibliotheque.supprime": t("Document retiré de Fichiers"),
  "bibliotheque.consulte": t("Document d'une autre personne consulté"),
  "connaissances.base_creee": t("Base de connaissances créée"),
  "connaissances.base_modifiee": t("Base de connaissances modifiée"),
  "connaissances.base_supprimee": t("Base de connaissances supprimée"),
  "connaissances.documents_ajoutes": t("Documents ajoutés à une base"),
  "connaissances.document_retire": t("Document retiré d'une base"),
  "reunion.creee": t("Réunion enregistrée"),
  "reunion.bot_envoye": t("Bot envoyé en réunion"),
  "reunion.bot_echec": t("Bot de réunion en échec"),
  "reunion.bot_auto": t("Bot envoyé seul en réunion"),
  "reunion.transcrite": t("Réunion transcrite"),
  "reunion.partagee": t("Réunion partagée"),
  "reunion.consultee": t("Réunion d'une autre personne consultée"),
  "reunion.supprimee": t("Réunion supprimée"),
};

/** Les évènements qui méritent l'œil : refus, blocages, actions sur l'écran. */
const NOTABLE = new Set([
  "ecran.mode_modifie",
  "employe.liberte",
  "employe.canal_branche",
  "fournisseur.ajoute",
  "connexion.refusee",
  "connexion.bloquee",
  "deuxfacteurs.desactive",
  "motdepasse.redefini",
  "motdepasse.reinitialise",
  "motdepasse.reinitialisation_refusee",
  "compte.adresse_refusee",
  "ecran.refuse",
  "ecran.execute",
]);

// Suit le format choisi dans Préférences, comme toute date de l'application.
const heure = (iso: string) => formaterDateHeure(iso);

export function SeancesEtJournal() {
  const [seances, setSeances] = useState<Seance[]>([]);
  const [entrees, setEntrees] = useState<Entree[]>([]);
  const [integrite, setIntegrite] = useState<Integrite | null>(null);
  /*
   * Qui regarde quoi. Chacun voit ses propres traces ; l'administrateur de
   * l'instance voit celles de tout le monde, parce que quelqu'un doit pouvoir
   * constater ce qui s'y passe. L'écran le dit, plutôt que de laisser croire
   * que le journal est complet quand il ne l'est pas.
   */
  const [administrateur, setAdministrateur] = useState<"profil" | "premier" | null>(null);
  const [conservation, setConservation] = useState<number | null>(null);

  const charger = useCallback(() => {
    void apiFetch("/helix/auth/sessions")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { sessions?: Seance[] } | null) => setSeances(d?.sessions ?? []))
      .catch(() => setSeances([]));

    void apiFetch("/helix/audit?limite=50")
      .then((r) => (r.ok ? r.json() : null))
      .then(
        (
          d: {
            entrees?: Entree[];
            integrite?: Integrite;
            conservationJours?: number;
            administrateur?: "profil" | "premier" | null;
          } | null,
        ) => {
        setEntrees(d?.entrees ?? []);
        setIntegrite(d?.integrite ?? null);
        setConservation(d?.conservationJours ?? null);
        setAdministrateur(d?.administrateur ?? null);
      })
      .catch(() => setEntrees([]));
  }, []);

  useEffect(charger, [charger]);

  const fermer = async (id: string) => {
    await apiFetch("/helix/auth/revoke", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    charger();
  };

  return (
    <>
      <Card className="mb-4">
        <h3 className="mb-1 text-lg font-semibold text-foreground">{t("Postes connectés")}</h3>
        <p className="mb-4 text-sm text-muted-foreground">
          {t("Fermez une séance et le poste concerné perd immédiatement l'accès, sans toucher aux autres.")}
        </p>

        {seances.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("Aucune séance ouverte.")}</p>
        ) : (
          <ul className="space-y-1.5">
            {seances.map((s) => (
              <li
                key={s.id}
                /*
                 * « Fermer » passe à la ligne quand la place manque, et le nom du
                 * poste n'est plus coupé (tournée à l'écran du 28/09/2026 : à
                 * 375 px, il tenait en 30 px, « Mac · Ch… »).
                 */
                className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-border px-3 py-2.5"
              >
                <Laptop size={16} strokeWidth={1.75} className="shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 basis-32">
                  <span className="block text-sm font-medium text-foreground [overflow-wrap:anywhere]">
                    {s.poste}
                    {s.courante && (
                      <span className="ms-2 rounded-full bg-muted px-2 py-0.5 text-xs font-normal text-muted-foreground">
                        {t("ce poste")}
                      </span>
                    )}
                    {s.longue && (
                      <span className="ms-2 rounded-full bg-muted px-2 py-0.5 text-xs font-normal text-muted-foreground">
                        {t("reste connecté")}
                      </span>
                    )}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {t("Dernière activité")}{" "}{heure(s.lastSeenAt)}
                  </span>
                </span>
                {!s.courante && (
                  <Button variant="secondary" size="sm" icon={X} onClick={() => void fermer(s.id)}>
                    {t("Fermer")}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <h3 className="mb-1 flex items-center gap-2 text-lg font-semibold text-foreground">
          <ScrollText size={18} strokeWidth={1.75} />
          {t("Journal d'activité")}
        </h3>
        <p className="mb-3 text-sm text-muted-foreground">
          {t("Chaque entrée est liée à la précédente : retirer ou modifier une ligne se voit.")}
          {conservation ? tf(" Conservé {0} jours, puis effacé.", conservation) : ""}
        </p>
        <p className="mb-3 text-sm text-muted-foreground">
          {administrateur
            ? tf("Vous administrez cette instance {0} : vous voyez l'activité de tout le monde.", administrateur === "profil"
                  ? t("(désigné dans le profil de déploiement)")
                  : t("(premier compte créé)"))
            : t("Vous voyez vos propres actions, et celles de l'instance elle-même. Celles de vos collègues ne vous regardent pas.")}
        </p>

        {integrite && (
          <InfoBox
            tone={integrite.intact ? "muted" : "warning"}
            className="mb-3"
            leading={
              integrite.intact ? (
                <ShieldCheck size={15} strokeWidth={1.75} className="text-success" />
              ) : (
                <ShieldAlert size={15} strokeWidth={1.75} />
              )
            }
          >
            {integrite.intact ? (
              <>{t("Journal intact :")}{" "}{integrite.entrees}{" "}{t("entrée(s) vérifiée(s).")}</>
            ) : (
              <>
                <strong>{t("Journal altéré")}</strong>{" "}{t("à la ligne")}{" "}{integrite.anomalie?.ligne}&nbsp;:{" "}
                {integrite.anomalie?.raison}.
              </>
            )}
          </InfoBox>
        )}

        {entrees.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("Aucune activité enregistrée.")}</p>
        ) : (
          <ul className="max-h-80 space-y-0.5 overflow-y-auto">
            {entrees.map((e, i) => (
              <li key={i} className="flex items-baseline gap-3 py-1 text-sm">
                <span className="w-24 shrink-0 text-xs tabular-nums text-muted-foreground">
                  {heure(e.quand)}
                </span>
                <span
                  className={
                    NOTABLE.has(e.action) ? "font-medium text-foreground" : "text-muted-foreground"
                  }
                >
                  {LIBELLES[e.action] ?? e.action}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}

export default SeancesEtJournal;
