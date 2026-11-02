import { OptimisationLocale } from "@/components/settings/OptimisationLocale";
import { useState, useEffect, useCallback, useRef } from "react";
import { reduirePhoto } from "@/lib/photo";
import {
  ShieldOff,
  Check,
  ExternalLink,
  LogOut,
  Server,
  Info,
  Mail,
  FileText,
  ShieldCheck,
  Download,
  Monitor,
  Code2,
  User as UserIcon,
  Trash2,
  Plus,
  Loader2,
} from "lucide-react";
import type { CleMarquePetite } from "@/components/ui/marques";
import { useProfile } from "@/hooks/useProfile";
import { useComputer } from "@/hooks/useComputer";
import { runAction, installerModeleEcran, MODE_LABEL } from "@/lib/computer";
import {
  isDesktopApp,
  instance,
  setInstance,
  normaliseUrl,
  probeInstance,
} from "@/lib/instance";
import { secretsEcrits } from "@/lib/coffre";
import { InviterCollegue } from "@/components/settings/InviterCollegue";
import { Abonnement } from "@/components/settings/Abonnement";
import { OuvrirInstance } from "@/components/settings/OuvrirInstance";
import { CreerCompte } from "@/components/settings/CreerCompte";
import { ReinitialiserMotDePasse } from "@/components/settings/ReinitialiserMotDePasse";
import { CodesRecuperation } from "@/components/settings/CodesRecuperation";
import { useMcp } from "@/hooks/useMcp";
import { SettingsPage, SettingsRow, Card } from "@/components/settings/SettingsShell";
import { SeancesEtJournal } from "@/components/settings/SeancesEtJournal";
import { EmplacementModeles } from "@/components/onboarding/EmplacementModeles";
import { MoteurLmStudio } from "@/components/settings/MoteurLmStudio";
import { DeuxFacteurs } from "@/components/settings/DeuxFacteurs";
import { SupprimerCompte } from "@/components/settings/SupprimerCompte";
import { SignalerProbleme } from "@/components/settings/SignalerProbleme";
import { MiseAJour } from "@/components/settings/MiseAJour";
import { ActivationEcran } from "@/components/settings/ActivationEcran";
import { telechargerMesDonnees, type ResumeExport } from "@/lib/exportDonnees";
import { Connecteurs } from "@/components/settings/Connecteurs";
import { CourrierIMAP } from "@/components/settings/CourrierIMAP";
import { DriveGoogle } from "@/components/settings/DriveGoogle";
import { SlackConnecteur } from "@/components/settings/SlackConnecteur";
import { ConnecteurNatif } from "@/components/settings/ConnecteurNatif";
import { useServicesCommerce } from "@/components/settings/ConnecteurCommerce";
import { lignesMicrosoft } from "@/components/settings/ConnecteurMicrosoft";
import { etatNatifs, type EtatNatif, type IdNatif } from "@/lib/natifs";
import { ConnecteurMessagerie } from "@/components/settings/ConnecteurMessagerie";
import { etatMessageries, type EtatMessagerie, type IdMessagerie } from "@/lib/messageries";
import { etat as etatDrive, type EtatDrive } from "@/lib/drive";
import { etat as etatSlack, type EtatSlack } from "@/lib/slack";
import type { ServiceMaison } from "@/components/settings/Connecteurs";
import { Usage } from "@/components/settings/Usage";
import { ModelesCloud } from "@/components/settings/ModelesCloud";
import { ClesApi } from "@/components/settings/ClesApi";
import { EntrainerModele } from "@/components/settings/EntrainerModele";
import { TelechargerApps } from "@/components/settings/TelechargerApps";
import { ImporterChats } from "@/components/settings/ImporterChats";
import {
  useFormats,
  ecrireFormats,
  FORMATS_DATE,
  FORMATS_HEURE,
  type FormatDate,
  type FormatHeure,
} from "@/lib/formats";
import { etat as etatCourrier } from "@/lib/courrier";
import { etat as etatAgenda } from "@/lib/agenda";
import { AgendaCalDAV } from "@/components/settings/AgendaCalDAV";
import { lireReglages, modifierReglages as modifierReglagesReunions, pontBot, type Reglages } from "@/lib/reunions";
import { REGLAGES_REUNIONS } from "@/hooks/useBotAutomatique";
import { Apparence } from "@/components/settings/Apparence";
import { ChoixLangue } from "@/components/settings/ChoixLangue";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Switch } from "@/components/ui/Switch";
import { InfoBox } from "@/components/ui/InfoBox";
import { Avatar } from "@/components/ui/Avatar";
import { Field, Input, Textarea } from "@/components/ui/Field";
import { branding } from "@/config/branding";
import {
  clearCurrentUser,
  modifierIdentite,
  useUtilisateurCourant,
} from "@/lib/store/identity";
import { cn } from "@/lib/cn";
import { t, tf } from "@/lib/i18n";

/* ========================================================================== */
/* Profil                                                                     */
/* ========================================================================== */
/*
 * L'identité du compte (nom, adresse) appartient à l'instance : elle est créée
 * par « /helix/auth/create », modifiée par « /helix/auth/profil », et relue à
 * chaque connexion. L'écran n'enregistre donc rien lui-même : il envoie, puis
 * n'affiche comme fait que ce que l'instance a accepté. Un nom changé ici et
 * gardé seulement dans le navigateur serait écrasé à la connexion suivante,
 * et resterait faux sur l'écran de connexion des collègues.
 */

/**
 * Photo de profil, enregistrée sur l'instance aussitôt choisie : elle suit le
 * compte d'un poste à l'autre et apparaît dans le choix du compte à la connexion.
 */
function PhotoDeProfil() {
  const utilisateur = useUtilisateurCourant();
  const choix = useRef<HTMLInputElement>(null);
  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const changer = async (photo: string | null) => {
    setOccupe(true);
    setErreur(null);
    try {
      await modifierIdentite({ photo });
    } catch (err) {
      setErreur(err instanceof Error ? err.message : String(err));
    } finally {
      setOccupe(false);
    }
  };
  return (
    <>
      <Avatar size={92} />
      <input
        ref={choix}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) void reduirePhoto(f).then(changer).catch((err) => setErreur(err instanceof Error ? err.message : String(err)));
        }}
      />
      <Button type="button" variant="secondary" size="sm" disabled={occupe} onClick={() => choix.current?.click()}>
        {utilisateur.photo ? t("Changer la photo") : t("Photo de profil")}
      </Button>
      {utilisateur.photo ? (
        <button type="button" disabled={occupe} onClick={() => void changer(null)} className="text-xs text-muted-foreground underline underline-offset-2">
          {t("Retirer la photo")}
        </button>
      ) : (
        <p className="text-center text-xs text-muted-foreground">{t("Sans photo, l'avatar reprend vos initiales.")}</p>
      )}
      {erreur && <p className="max-w-[180px] text-center text-xs text-destructive">{erreur}</p>}
    </>
  );
}

export function ProfilSettings() {
  const utilisateur = useUtilisateurCourant();
  const [nom, setNom] = useState(utilisateur.fullName);
  const [adresse, setAdresse] = useState(utilisateur.email);
  const [motDePasse, setMotDePasse] = useState("");
  const [occupe, setOccupe] = useState(false);
  const [echec, setEchec] = useState<string | null>(null);
  const [enregistre, setEnregistre] = useState(false);

  // Mêmes normalisations que l'instance : un espace de trop n'est pas un changement.
  const nomSaisi = nom.trim().replace(/\s+/g, " ");
  const adresseSaisie = adresse.trim().toLowerCase();
  const nomChange = nomSaisi !== utilisateur.fullName;
  const adresseChange = adresseSaisie !== utilisateur.email.trim().toLowerCase();
  const modifie = nomChange || adresseChange;
  /*
   * Le mot de passe actuel est demandé pour changer d'adresse.
   *
   * Il l'est toujours : on n'arrive plus ici sans mot de passe, l'écran de
   * connexion en fait choisir un avant d'ouvrir la séance. Le poste ne sait
   * d'ailleurs plus quels comptes en ont un — la liste ouverte ne le dit
   * plus — et c'est très bien : un écran ne doit pas décider d'une règle que
   * l'instance applique de son côté.
   */
  const protege = true;
  const pret =
    modifie &&
    !occupe &&
    nomSaisi !== "" &&
    adresseSaisie !== "" &&
    (!adresseChange || !protege || motDePasse !== "");

  const annuler = () => {
    setNom(utilisateur.fullName);
    setAdresse(utilisateur.email);
    setMotDePasse("");
    setEchec(null);
  };

  const enregistrer = async () => {
    setOccupe(true);
    setEchec(null);
    setEnregistre(false);
    try {
      const apres = await modifierIdentite({
        ...(nomChange ? { fullName: nomSaisi } : {}),
        ...(adresseChange
          ? { email: adresseSaisie, ...(motDePasse ? { password: motDePasse } : {}) }
          : {}),
      });
      setNom(apres.fullName);
      setAdresse(apres.email);
      setEnregistre(true);
    } catch (err) {
      setEchec(err instanceof Error ? err.message : String(err));
    } finally {
      // Le mot de passe ne reste pas dans un champ plus longtemps que nécessaire.
      setMotDePasse("");
      setOccupe(false);
    }
  };

  return (
    <SettingsPage title={t("Profil")}>
      <SettingsRow title={t("Profil")} desc={t("Gérez vos informations personnelles et vos préférences")}>
        <Card>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (pret) void enregistrer();
            }}
          >
            <div className="grid gap-6 cq-sm:grid-cols-[minmax(0,1fr)_10rem]">
              <div className="space-y-4">
                <Field label={t("Nom complet")} required>
                  <Input
                    value={nom}
                    maxLength={120}
                    autoComplete="name"
                    onChange={(e) => {
                      setNom(e.target.value);
                      setEnregistre(false);
                    }}
                  />
                </Field>
                <Field
                  label={t("Adresse email")}
                  required
                  hint={t("Elle sert à vous connecter et à vous inviter. L'instance ne peut pas la vérifier : elle n'envoie pas de courrier.")}
                >
                  <Input
                    type="email"
                    value={adresse}
                    maxLength={254}
                    autoComplete="email"
                    onChange={(e) => {
                      setAdresse(e.target.value);
                      setEnregistre(false);
                    }}
                  />
                </Field>
                {adresseChange && protege && (
                  <Field
                    label={t("Mot de passe actuel")}
                    required
                    hint={t("Exigé pour changer d'adresse : c'est votre identifiant de connexion.")}
                  >
                    <Input
                      type="password"
                      value={motDePasse}
                      autoComplete="current-password"
                      onChange={(e) => setMotDePasse(e.target.value)}
                    />
                  </Field>
                )}
                {adresseChange && (
                  /*
                   * Dit à l'écran ce que l'instance applique : une adresse
                   * déclarée ne rattache aucune invitation en attente
                   * (`adresseDePartage`, gateway/src/accounts.ts). Sans cette
                   * phrase, la personne attendrait des projets qui ne
                   * viendront pas.
                   */
                  <InfoBox tone="muted" leading={<Info size={15} strokeWidth={1.75} />}>
                    {t("Changer d'adresse ne vous donne pas accès aux invitations déjà envoyées à la nouvelle adresse. Si un collègue vous y a invité, demandez-lui de vous inviter à nouveau : l'invitation vous parviendra directement.")}
                  </InfoBox>
                )}
              </div>
              <div className="-order-1 flex flex-col items-center gap-3 cq-sm:order-none">
                <PhotoDeProfil />
              </div>
            </div>

            {echec && (
              <InfoBox tone="warning" className="mt-4" leading={<Info size={15} strokeWidth={1.75} />}>
                {echec}
              </InfoBox>
            )}
            <div className="mt-5 flex items-center justify-end gap-2">
              {enregistre && !modifie && (
                <span className="me-auto inline-flex items-center gap-1.5 text-xs text-success">
                  <Check size={14} strokeWidth={2} />{" "}{t("Profil enregistré sur l'instance")}
                </span>
              )}
              <Button type="button" variant="secondary" disabled={!modifie || occupe} onClick={annuler}>
                {t("Annuler")}
              </Button>
              <Button type="submit" disabled={!pret}>
                {occupe ? t("Enregistrement…") : t("Enregistrer")}
              </Button>
            </div>
          </form>
        </Card>
      </SettingsRow>

      <SettingsRow title={t("Instance")} desc={tf("Configuration de l'instance {0}", branding.name)}>
        <CarteInstance />
      </SettingsRow>

      <SettingsRow
        title={t("Collègues")}
        desc={t("Ouvrir l'instance à quelqu'un d'autre, sans rien lui dicter")}
      >
        <OuvrirInstance />
        <div className="mt-4">
          <InviterCollegue />
        </div>
        <div className="mt-4">
          <CreerCompte />
        </div>
        <div className="mt-4">
          <ReinitialiserMotDePasse />
        </div>
      </SettingsRow>

      <SettingsRow
        title={t("Zone de danger")}
        desc={t("Actions irréversibles qui peuvent affecter votre compte")}
        last
      >
        <div className="flex items-center justify-between gap-4 rounded-2xl border border-destructive/40 bg-destructive/[0.04] p-4">
          <div>
            <p className="text-sm font-semibold text-foreground">{utilisateur.handle}</p>
            <p className="text-xs text-muted-foreground">{utilisateur.email}</p>
          </div>
          <Button
            variant="destructive"
            icon={LogOut}
            onClick={() => {
              /*
               * L'identité est oubliée et la séance révoquée sur l'instance ;
               * le compte et ses données restent sur le poste. On attend la
               * révocation avant de recharger, sinon la requête est annulée en
               * vol et la séance resterait ouverte côté serveur.
               */
              void clearCurrentUser().finally(() => window.location.reload());
            }}
          >
            {t("Se déconnecter")}
          </Button>
        </div>
        <div className="mt-3">
          <SupprimerCompte />
        </div>
      </SettingsRow>
    </SettingsPage>
  );
}

/**
 * Instance à laquelle ce poste est rattaché.
 *
 * La carte affichait l'adresse commerciale du produit (`branding.urls`), la
 * même pour tout le monde, et son formulaire n'enregistrait rien : un poste
 * rattaché au serveur de son entreprise y lisait donc une adresse qui n'était
 * pas la sienne, sans moyen d'en changer. On montre l'adresse réelle, et le
 * bouton la vérifie avant de l'enregistrer, comme au premier lancement.
 */
function CarteInstance() {
  const courante = instance();
  const [adresse, setAdresse] = useState(courante.url);
  const [occupe, setOccupe] = useState(false);
  const [echec, setEchec] = useState<string | null>(null);

  const cible = normaliseUrl(adresse);
  const modifiee = cible !== "" && cible !== courante.url;

  const enregistrer = async () => {
    setOccupe(true);
    setEchec(null);
    const essai = await probeInstance(cible, courante.token);
    setOccupe(false);
    if (!essai.ok) {
      setEchec(essai.reason ?? t("Cette adresse ne répond pas."));
      return;
    }
    /*
     * Une adresse de boucle locale désigne la passerelle du poste lui-même :
     * il redevient autonome, et son jeton reste fourni par l'application, pas
     * conservé dans le navigateur.
     */
    const local = /^https?:\/\/(localhost|127\.0\.0\.1)(:|$)/i.test(cible);
    setInstance({
      url: cible,
      remote: !local,
      label: local ? undefined : cible.replace(/^https?:\/\//, ""),
      token: local ? undefined : courante.token,
    });
    /*
     * L'adresse est figée à l'import du module : seul un rechargement la
     * reprend. On attend d'abord que le coffre ait enregistré la nouvelle
     * instance : l'application relit cette valeur au chargement pour resserrer
     * sa politique de sécurité, et repartirait sinon sur l'ancienne adresse.
     */
    await secretsEcrits();
    window.location.reload();
  };

  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        {/* L'adresse entière, à la ligne s'il le faut : à 375 px, elle se réduisait à « http://loc… » (28/09/2026). */}
        <span className="min-w-0 text-sm font-semibold text-foreground [overflow-wrap:anywhere]">
          {courante.label ?? courante.url}
        </span>
        <Button
          variant="secondary"
          size="sm"
          icon={ExternalLink}
          disabled
          title={t("Adresse technique de l'instance : elle ne s'ouvre pas dans un navigateur")}
        >
          {t("Ouvrir")}
        </Button>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        {courante.remote
          ? t("Ce poste dépend de cette instance : modèles et données en viennent.")
          : t("Poste autonome : tout est calculé sur cette machine.")}
      </p>
      <div className="my-4 h-px bg-border" />
      <Field
        label={t("URL de l'instance")}
        hint={t("Changer l'URL relance l'application pour réinitialiser la session.")}
      >
        <Input
          value={adresse}
          onChange={(e) => setAdresse(e.target.value)}
          placeholder={t("helix.mon-entreprise.fr")}
        />
      </Field>
      {echec && (
        <InfoBox tone="warning" className="mt-3" leading={<Info size={15} strokeWidth={1.75} />}>
          {echec}
        </InfoBox>
      )}
      <div className="mt-4 flex justify-end gap-2">
        <Button
          variant="secondary"
          disabled={!modifiee || occupe}
          onClick={() => {
            setAdresse(courante.url);
            setEchec(null);
          }}
        >
          {t("Annuler")}
        </Button>
        <Button disabled={!modifiee || occupe} onClick={() => void enregistrer()}>
          {occupe ? t("Vérification...") : t("Enregistrer")}
        </Button>
      </div>
    </Card>
  );
}

/* ========================================================================== */
/* Préférences                                                                */
/* ========================================================================== */
/*
 * Langue, format de date et format d'heure n'étaient rattachés à rien : ils
 * vivaient dans un état local que personne ne relisait. Les formats sont
 * désormais réels et s'appliquent partout où une date s'affiche (voir
 * `src/lib/formats.ts`). La langue, elle, n'offre plus de faux choix.
 */
export function PreferencesSettings() {
  const { prefs, date, heure, dateHeure } = useFormats();
  const maintenant = new Date();

  return (
    <SettingsPage title={t("Préférences")} subtitle={t("Personnalisez votre expérience")}>
      <Apparence />

      {/*
       * L'anglais est la langue de référence et la langue par défaut du
       * logiciel ; les phrases françaises servent de clés aux traductions
       * (src/lib/i18n.ts). L'interface se choisit parmi les sept langues
       * (l'arabe retourne l'écran, de droite à gauche).
       */}
      <ChoixLangue />

      <Card className="mt-7">
        <h3 className="text-lg font-semibold text-foreground">{t("Dates et heures")}</h3>
        <p className="mb-4 text-sm text-muted-foreground">
          {t("S'applique partout où une date s'affiche, sur tous vos postes.")}
        </p>
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">{t("Format de date")}</label>
            <Select
              value={prefs.date}
              onChange={(v) => ecrireFormats({ date: v as FormatDate })}
              options={FORMATS_DATE.map((f) => ({ value: f.valeur, label: f.nom }))}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">{t("Format d'heure")}</label>
            <Select
              value={prefs.heure}
              onChange={(v) => ecrireFormats({ heure: v as FormatHeure })}
              options={FORMATS_HEURE.map((f) => ({ value: f.valeur, label: f.nom }))}
            />
          </div>
          <div className="rounded-xl bg-muted/50 p-4 text-sm">
            <p className="font-medium text-foreground">{t("Aperçu")}</p>
            <p className="mt-1 text-muted-foreground">{t("Date :")}{" "}{date(maintenant)}</p>
            <p className="text-muted-foreground">{t("Heure :")}{" "}{heure(maintenant)}</p>
            <p className="text-muted-foreground">{t("Date et heure :")}{" "}{dateHeure(maintenant)}</p>
          </div>
        </div>
      </Card>

      <Card className="mt-6">
        <h3 className="text-lg font-semibold text-foreground">{tf("À propos de {0}", branding.name)}</h3>
        {/*
         * Le badge vert « À jour » disait autrefois un fait que personne ne
         * mesurait. Depuis 0.10.0, l'état vient de la vérification réelle
         * (electron/miseAJour.cjs) : « aucune version plus récente » n'est
         * affiché qu'après une vérification réussie, avec son heure. Pas de
         * canal Stable / Beta : un seul flux, celui du prestataire.
         */}
        <div className="mt-3">
          <MiseAJour />
        </div>

        {/*
          La licence n'est pas une mention légale de plus au fond d'une page.
          L'AGPL demande que la personne qui se sert du logiciel puisse en
          obtenir le code : l'écrire ici, avec l'adresse du dépôt, est la façon
          la plus simple de tenir cette obligation — et en marque blanche, elle
          rappelle au prestataire qu'elle lui incombe aussi.
        */}
        <div className="mt-4 border-t border-border pt-4 text-sm text-muted-foreground">
          <p>
            {/*
              Une seule phrase à trous : chaque langue place le nom du produit et
              celui de la licence où elle veut. La licence garde sa mise en valeur :
              on coupe la phrase traduite sur un marqueur mis à la place du trou {1}.
            */}
            {(() => {
              const [avant, apres = ""] = tf(
                "{0} est un logiciel libre, publié sous licence {1}. Vous pouvez le lire, l'installer, le modifier et le redistribuer. Qui le distribue ou le propose comme service en ligne doit publier le code de sa version.",
                branding.name,
                "\u0000",
              ).split("\u0000");
              return (
                <>
                  {avant}
                  <span className="font-medium text-foreground">{t("GNU AGPL-3.0")}</span>
                  {apres}
                </>
              );
            })()}
          </p>
          <a
            href={branding.urls.sourceCode}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-flex items-center gap-1.5 text-foreground underline underline-offset-4 hover:no-underline"
          >
            <Code2 size={14} strokeWidth={1.75} />{" "}{tf("Code source de {0}", branding.name)}
          </a>
        </div>
      </Card>
    </SettingsPage>
  );
}

/* ========================================================================== */
/* Abonnement                                                                  */
/* ========================================================================== */
/*
 * L'offre d'hébergement des modèles. Présente seulement quand le module est
 * allumé (branding.featureOverrides) : une installation en marque blanche
 * n'achète rien et ne doit rien voir.
 */
export function AbonnementSettings() {
  return (
    <SettingsPage title={t("Abonnement")}>
      <Abonnement />
    </SettingsPage>
  );
}

/* ========================================================================== */
/* Sécurité                                                                    */
/* ========================================================================== */
export function SecuriteSettings() {
  return (
    <SettingsPage title={t("Sécurité")}>
      <SettingsRow
        title={t("Postes et activité")}
        desc={t("Où votre compte est connecté, et ce qui s'est passé dessus.")}
      >
        <SeancesEtJournal />
      </SettingsRow>

      {/*
       * Le bloc « Vérification de l'email » qui suivait affichait une coche
       * verte et « Votre adresse email est vérifiée ». Aucune vérification
       * d'adresse n'existe : la passerelle ne connaît ni jeton de confirmation
       * ni route de validation, l'adresse est simplement celle saisie à la
       * création du compte. Un état de sécurité affirmé à tort est ce qu'un
       * audit relève en premier, et rien de réel ne pouvait le remplacer :
       * le bloc est retiré plutôt que reformulé.
       */}
      <SettingsRow
        title={t("Authentification à deux facteurs")}
        desc={t("Après le mot de passe, un code à six chiffres affiché par votre téléphone. Aucun service extérieur n'intervient : le calcul se fait sur votre téléphone et sur l'instance.")}
      >
        <DeuxFacteurs />
      </SettingsRow>

      <SettingsRow
        title={t("Mot de passe oublié")}
        desc={t("Des codes à garder à l'abri : chacun redéfinit votre mot de passe une fois, depuis l'écran de connexion, sans l'aide de personne.")}
        last
      >
        <CodesRecuperation />
      </SettingsRow>
    </SettingsPage>
  );
}

/* ========================================================================== */
/* Personnalisation de l'IA                                                   */
/* ========================================================================== */
export function PersonnalisationSettings() {
  const { user, profile, update, addMemory, removeMemory } = useProfile();
  const [instructions, setInstructions] = useState(profile.customInstructions);
  const [info, setInfo] = useState(profile.personalInfo);
  const [newMemory, setNewMemory] = useState("");
  const [saved, setSaved] = useState(false);

  const dirty =
    instructions !== profile.customInstructions || info !== profile.personalInfo;

  const save = () => {
    update({ customInstructions: instructions, personalInfo: info });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <SettingsPage title={t("Personnalisation de l'IA")}>
      <InfoBox tone="muted" className="mb-2" leading={<UserIcon size={15} strokeWidth={1.75} />}>
        {t("Ces réglages sont")}{" "}<strong className="font-medium text-foreground">{t("personnels")}</strong>{" "}{t("et s'appliquent à votre compte (")}{user.email}{t("). Ils ne sont jamais partagés avec les autres utilisateurs de cette installation, même lorsque vous partagez une conversation.")}
      </InfoBox>

      <SettingsRow
        title={t("Réglages personnalisés")}
        desc={t("Personnalisez le comportement de l'IA selon vos préférences")}
      >
        <Card>
          <Field
            label={t("Instructions personnalisées")}
            hint={t("Instructions spécifiques pour guider le comportement de l'IA")}
          >
            <Textarea
              rows={4}
              placeholder={t("Écrivez vos instructions personnalisées ici...")}
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
            />
          </Field>
          <div className="mt-4">
            <Field
              label={t("Informations personnelles")}
              hint={t("Informations sur vous que l'IA peut utiliser pour personnaliser ses réponses")}
            >
              <Textarea
                rows={4}
                placeholder={t("Décrivez-vous ici (profession, préférences, contexte...)...")}
                value={info}
                onChange={(e) => setInfo(e.target.value)}
              />
            </Field>
          </div>
          <div className="mt-5 flex items-center gap-3">
            <Button onClick={save} disabled={!dirty}>
              {t("Enregistrer")}
            </Button>
            {saved && (
              <span className="inline-flex items-center gap-1.5 text-sm text-success">
                <Check size={15} strokeWidth={2.5} />{" "}{t("Enregistré")}
              </span>
            )}
          </div>
        </Card>
      </SettingsRow>

      <SettingsRow
        title={t("Gestionnaire de mémoire")}
        desc={t("Gérez les informations que l'IA se souvient de vous")}
        last
      >
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-foreground">{t("Mémoire IA")}</p>
              <p className="text-sm text-muted-foreground">
                {profile.memoryEnabled ? t("Activée") : t("Désactivée")}
              </p>
            </div>
            <Switch
              checked={profile.memoryEnabled}
              onChange={(v) => update({ memoryEnabled: v })}
              label={t("Mémoire IA")}
            />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {/*
              * Ce que fait vraiment l'interrupteur (29/09/2026) : les éléments ajoutés
              * ci-dessous accompagnent chaque demande (store/profile.ts). Rien ne les
              * tire tout seul des conversations ; l'écran disait « se souvenir de vos
              * conversations précédentes ». Depuis le 16/10/2026, un long Chat garde
              * aussi sa propre mémoire (bloc suivant) : la phrase ne parle plus que
              * de cette liste.
              */}
            {t("Les éléments ajoutés ci-dessous accompagnent chacune de vos demandes à l'IA. Rien n'est ajouté à cette liste sans vous.")}
          </p>

          {/*
            * Mémoire des longues conversations (16/10/2026,
            * gateway/src/memoireConversation.ts) : ce qui sort de la place du
            * modèle est rangé sur l'instance, Chat par Chat, et retrouvé quand
            * la question s'y rapporte. Le réglage élargit la recherche aux autres
            * Chats de la personne, jamais à ceux d'une autre.
            */}
          <div className="mt-4 rounded-xl border border-border p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="font-semibold text-foreground">{t("Mémoire des longues conversations")}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t("Quand un Chat devient trop long pour ce que le modèle peut lire, ses plus anciens messages sont rangés sur l'instance, chiffrés, dans une mémoire propre à ce Chat et à vous. À chaque question, les passages qui s'y rapportent sont rendus au modèle. Supprimer le Chat supprime sa mémoire ; « Effacer la mémoire de ce Chat » est dans la liste des Chats.")}
                </p>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between gap-4">
              <p className="text-sm text-foreground">{t("Retrouver aussi ce qui a été dit dans mes autres Chats")}</p>
              <Switch
                checked={profile.memoireAutresChats === true}
                onChange={(v) => update({ memoireAutresChats: v })}
                label={t("Retrouver aussi ce qui a été dit dans mes autres Chats")}
              />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {t("Éteint, chaque Chat ne retrouve que sa propre mémoire. Allumé, la recherche couvre tous vos Chats, jamais ceux des autres.")}
            </p>
          </div>

          <div className="mt-4 rounded-xl border border-border p-4">
            <p className="font-semibold text-foreground">{t("Gestionnaire de mémoire")}</p>
            <p className="text-sm text-muted-foreground">
              {t("Gérez les informations que l'IA se souvient de vous")}
            </p>

            <div className="mt-3 flex gap-2">
              <Input
                placeholder={t("Ajouter un élément à mémoriser...")}
                value={newMemory}
                onChange={(e) => setNewMemory(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newMemory.trim()) {
                    addMemory(newMemory);
                    setNewMemory("");
                  }
                }}
              />
              <Button
                variant="secondary"
                icon={Plus}
                className="shrink-0"
                disabled={!newMemory.trim()}
                onClick={() => {
                  addMemory(newMemory);
                  setNewMemory("");
                }}
              >
                {t("Ajouter")}
              </Button>
            </div>

            {profile.memories.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">{t("Aucune mémoire enregistrée")}</p>
            ) : (
              <ul className="mt-3 space-y-1.5">
                {profile.memories.map((m) => (
                  <li
                    key={m.id}
                    className="flex items-start gap-2 rounded-lg bg-muted/50 px-3 py-2 text-sm"
                  >
                    <span className="min-w-0 flex-1 text-foreground">{m.text}</span>
                    <button
                      type="button"
                      aria-label={t("Oublier cet élément")}
                      onClick={() => removeMemory(m.id)}
                      className="shrink-0 rounded p-0.5 text-muted-foreground transition-colors hover:text-destructive"
                    >
                      <Trash2 size={14} strokeWidth={1.75} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>
      </SettingsRow>
    </SettingsPage>
  );
}

/* ========================================================================== */
/* Bot Recorder                                                               */
/* ========================================================================== */
export function BotRecorderSettings() {
  const [reglages, setReglages] = useState<Reglages | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [nom, setNom] = useState("");
  const [agenda, setAgenda] = useState<boolean | null>(null);
  const [compteGoogle, setCompteGoogle] = useState<boolean | null>(null);
  const pont = pontBot();

  useEffect(() => {
    void lireReglages()
      .then((r) => {
        setReglages(r);
        setNom(r.nomBot);
      })
      .catch((err) => setErreur(err instanceof Error ? err.message : String(err)));
    void etatAgenda().then((e) => setAgenda(Boolean(e?.configure)));
    if (pont) void pont.compte("etat").then((c) => setCompteGoogle(c.connecte)).catch(() => setCompteGoogle(null));
  }, [pont]);

  const changer = (d: Partial<Reglages>, succes?: string) => {
    setErreur(null);
    void modifierReglagesReunions(d)
      .then((r) => {
        setReglages(r);
        if (succes) setInfo(succes);
        // Le bot automatique suit tout de suite (useBotAutomatique).
        window.dispatchEvent(new Event(REGLAGES_REUNIONS));
      })
      .catch((err) => setErreur(err instanceof Error ? err.message : String(err)));
  };

  const nomParDefaut = tf("Prise de notes {0}", branding.name);

  return (
    <SettingsPage
      title={t("Bot Recorder")}
      subtitle={t("Enregistrement, transcription et compte rendu des réunions, sur vos machines")}
    >
      {erreur && (
        <InfoBox tone="warning" className="mb-4" leading={<Info size={15} strokeWidth={1.75} />}>
          {erreur}
        </InfoBox>
      )}
      {!reglages ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 size={15} className="animate-spin" />{" "}{t("Lecture des réglages…")}
        </p>
      ) : (
        <>
          <SettingsRow title={t("Le bot")} desc={t("Le nom sous lequel il apparaît dans les réunions Google Meet")}>
            <Card className="space-y-4">
              <Field label={t("Nom affiché")} hint={t("Choisissez un nom qui dit clairement qu'il enregistre : les participants le voient.")}>
                <div className="flex gap-2">
                  <Input value={nom} maxLength={60} placeholder={nomParDefaut} onChange={(e) => setNom(e.target.value)} />
                  <Button
                    variant="secondary"
                    disabled={nom.trim() === reglages.nomBot}
                    onClick={() => changer({ nomBot: nom.trim() }, t("Nom du bot enregistré."))}
                  >
                    {t("Enregistrer")}
                  </Button>
                </div>
              </Field>
              {!pont && (
                <InfoBox tone="muted">
                  {tf("Le bot tourne dans l'application de bureau {0} : depuis un navigateur, on peut enregistrer au micro et importer des fichiers, pas envoyer le bot.", branding.name)}
                </InfoBox>
              )}
              {pont && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border px-3 py-2.5">
                  <div>
                    <p className="text-sm font-medium text-foreground">{t("Compte Google du bot")}</p>
                    <p className="text-xs text-muted-foreground">
                      {compteGoogle
                        ? t("Le bot rejoint les réunions avec le compte Google connecté, sous le nom de ce compte.")
                        : t("Facultatif. Certaines réunions n'admettent que des comptes Google connectés : connectez-en un pour le bot. Vous vous connectez vous-même, sur la page de Google.")}
                    </p>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() =>
                      void pont
                        .compte(compteGoogle ? "oublier" : "connecter")
                        .then((c) => setCompteGoogle(c.connecte))
                        .catch((err) => setErreur(err instanceof Error ? err.message : String(err)))
                    }
                  >
                    {compteGoogle ? t("Déconnecter") : t("Connecter un compte")}
                  </Button>
                </div>
              )}
            </Card>
          </SettingsRow>

          <SettingsRow title={t("Réunions de l'agenda")} desc={t("Envoyer le bot tout seul, à l'heure dite")}>
            <Card>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-foreground">{t("Rejoindre automatiquement les réunions Google Meet")}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {agenda === false
                      ? t("Branchez d'abord l'agenda, dans Connecteurs : le bot y lit les réunions qui ont un lien Google Meet.")
                      : tf("Le bot rejoint chaque réunion de l'agenda qui a un lien Google Meet, au moment où elle commence, tant que l'application {0} est ouverte sur ce poste.", branding.name)}
                  </p>
                </div>
                <Switch
                  checked={reglages.botAuto}
                  disabled={!pont || agenda === false}
                  label={t("Rejoindre automatiquement les réunions Google Meet")}
                  onChange={(v) => changer({ botAuto: v }, v ? t("Le bot rejoindra vos prochaines réunions Google Meet.") : t("Le bot ne rejoindra plus les réunions tout seul."))}
                />
              </div>
            </Card>
          </SettingsRow>

          <SettingsRow title={t("Transcription")} desc={t("Faite par Whisper, sur la machine de l'instance")}>
            <Card className="space-y-4">
              <Field label={t("Langue des réunions")}>
                <Select
                  value={reglages.langue}
                  onChange={(v) => changer({ langue: v as Reglages["langue"] })}
                  options={[
                    { value: "fr", label: t("Français") },
                    { value: "en", label: t("Anglais") },
                    { value: "auto", label: t("Détection automatique") },
                  ]}
                />
              </Field>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-foreground">{t("Compte rendu automatique")}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {t("Résumé, décisions et tâches rédigés par un modèle de la machine, dès la transcription finie.")}
                  </p>
                </div>
                <Switch checked={reglages.compteRenduAuto} label={t("Compte rendu automatique")} onChange={(v) => changer({ compteRenduAuto: v })} />
              </div>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-foreground">{t("Conserver l'enregistrement audio")}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {reglages.conserverAudio
                      ? t("L'audio reste sur l'instance, chiffré, à côté de la transcription, jusqu'à ce que vous supprimiez la réunion.")
                      : t("Par défaut, l'audio est effacé dès la transcription faite : il ne reste que le texte.")}
                  </p>
                </div>
                <Switch checked={reglages.conserverAudio} label={t("Conserver l'enregistrement audio")} onChange={(v) => changer({ conserverAudio: v })} />
              </div>
            </Card>
          </SettingsRow>

          {info && (
            <InfoBox tone="muted" leading={<Check size={15} strokeWidth={2} />}>
              {info}
            </InfoBox>
          )}
        </>
      )}
    </SettingsPage>
  );
}

/* ========================================================================== */
/* Connecteurs                                                                */
/* ========================================================================== */
/*
 * Cet écran expliquait ce qu'est le Model Context Protocol sur trois colonnes,
 * puis montrait un unique serveur qu'on pouvait allumer ou éteindre. Le nom du
 * protocole n'intéresse personne : ce que le client demande, c'est de brancher
 * ses services, comme il le fait ailleurs. L'écran liste donc ce qui est
 * connecté, ce qui peut l'être, et rien d'autre.
 */
/**
 * Écran unique des connexions.
 *
 * Il y en avait deux, « Connecteurs » et « Intégrations », nés de deux travaux
 * menés en parallèle. Quelqu'un qui cherchait à brancher sa boîte aux lettres
 * cliquait sur « Connecteurs », n'y trouvait rien, et concluait que la
 * fonction n'existait pas — alors qu'elle était sur l'autre écran. Deux
 * entrées de menu pour la même intention, c'est une de trop.
 */
export function McpSettings() {
  /*
   * Une seule liste, et pas une grille au-dessus d'une liste.
   *
   * L'écran avait quatre tuiles en haut — courrier, agenda, Drive, Slack — et
   * le catalogue en dessous. Gmail se retrouvait donc affiché deux fois, et il
   * fallait comprendre que les deux blocs répondaient à la même question. Les
   * quatre rejoignent la liste, avec leur logo et leur panneau, sous le titre
   * « Services connectés » : une seule liste, une seule recherche.
   */
  const [ouvert, setOuvert] = useState<string | null>(null);
  const [courrierPret, setCourrierPret] = useState(false);
  const [agendaPret, setAgendaPret] = useState(false);
  const [drive, setDrive] = useState<EtatDrive | null>(null);
  const [slack, setSlack] = useState<EtatSlack | null>(null);
  const [natifs, setNatifs] = useState<EtatNatif[]>([]);
  const [messageries, setMessageries] = useState<EtatMessagerie[]>([]);

  const relire = useCallback(() => {
    void etatMessageries().then((e) => setMessageries(e?.services ?? []));
    void etatCourrier().then((e) => setCourrierPret(Boolean(e?.configure)));
    void etatAgenda().then((e) => setAgendaPret(Boolean(e?.configure)));
    void etatDrive().then(setDrive);
    void etatSlack().then(setSlack);
    void etatNatifs().then((e) => setNatifs(e?.services ?? []));
  }, []);
  useEffect(relire, [relire]);

  const basculer = (cle: string) => setOuvert((o) => (o === cle ? null : cle));
  // Stripe, Shopify, WooCommerce, Salesforce, Pipedrive, Zendesk (28/09/2026, ConnecteurCommerce.tsx).
  const commerce = useServicesCommerce(ouvert, basculer);

  const CATEGORIE = t("Courrier, agenda et fichiers");

  const services: ServiceMaison[] = [
    {
      id: "courrier",
      label: t("Courrier"),
      description: courrierPret ? t("Boîte connectée") : "Gmail, Outlook, OVH, Infomaniak...",
      categorie: CATEGORIE,
      marque: "gmail",
      connecte: courrierPret,
      ouvert: ouvert === "courrier",
      onBasculer: () => basculer("courrier"),
      panneau: <CourrierIMAP onChange={relire} />,
    },
    {
      id: "agenda",
      label: t("Agenda"),
      // Traduit (tournée des connecteurs du 28/09/2026) : « Google Agenda » s'appelle « Google Calendar » en anglais.
      description: agendaPret ? t("Agenda connecté") : t("Google Agenda, iCloud, Nextcloud..."),
      categorie: CATEGORIE,
      marque: "googleAgenda",
      connecte: agendaPret,
      ouvert: ouvert === "agenda",
      onBasculer: () => basculer("agenda"),
      panneau: <AgendaCalDAV onChange={relire} />,
    },
    {
      id: "drive",
      label: "Google Drive",
      description: resumeDrive(drive),
      categorie: CATEGORIE,
      marque: "googleDrive",
      connecte: Boolean(drive?.configure),
      ouvert: ouvert === "drive",
      onBasculer: () => basculer("drive"),
      panneau: <DriveGoogle onChange={relire} />,
    },
    /*
     * Sheets, Slides, Docs, Forms, Dropbox, YouTube, réseaux sociaux et
     * campagnes e-mail (28/09/2026, ConnecteurNatif.tsx). Chaque ligne porte le
     * vrai logo du service, en couleur, depuis la troisième tournée des logos
     * (28/09/2026, décision de Medhi : « mets les vrais »). YouTube montre ici
     * son icône (`youtubeIcone`) ; le logo complet reste en grand, en tête de
     * son panneau (LogoYouTube, ConnecteurNatif.tsx). Les glyphes « marque »
     * de Lucide restent écartés : ce sont des copies approximatives des logos.
     */
    ...([
      ["sheets", "Google Sheets", t("Lire vos feuilles, et y écrire après accord"), "googleSheets", CATEGORIE],
      ["slides", "Google Slides", t("Lire vos présentations"), "googleSlides", CATEGORIE],
      ["docs", "Google Docs", t("Lire vos documents, en créer et y ajouter du texte après accord"), "googleDocs", CATEGORIE],
      ["forms", "Google Forms", t("Lire vos formulaires et leurs réponses"), "googleForms", CATEGORIE],
      ["dropbox", "Dropbox", t("Lister, chercher, lire, et envoyer un fichier après accord"), "dropbox", CATEGORIE],
      ["youtube", "YouTube", t("Vidéos et statistiques d'une chaîne"), "youtubeIcone", t("Réseaux sociaux")],
      ["linkedin", "LinkedIn", t("Profil : publier en son nom après accord"), "linkedin", t("Réseaux sociaux")],
      // La Page d'entreprise, par sa propre application LinkedIn (29/09/2026) : même logo, ligne à part.
      ["linkedinPage", t("LinkedIn (Page d'entreprise)"), t("Page : publications, statistiques, publier après accord"), "linkedin", t("Réseaux sociaux")],
      ["facebook", "Facebook", t("Pages : publications, réactions, publier après accord"), "facebook", t("Réseaux sociaux")],
      ["instagram", "Instagram", t("Compte professionnel : publications, statistiques, publier après accord"), "instagram", t("Réseaux sociaux")],
      ["tiktok", "TikTok", t("Vidéos, statistiques, publier après accord"), "tiktok", t("Réseaux sociaux")],
      ["x", "X", t("Ex-Twitter : posts, statistiques, publier après accord"), "x", t("Réseaux sociaux")],
      ["brevo", "Brevo", t("Campagnes e-mail et listes : lire, brouillons et envoi après accord"), "brevo", t("Campagnes e-mail")],
      ["mailchimp", "Mailchimp", t("Campagnes e-mail et audiences : lire, brouillons et envoi après accord"), "mailchimp", t("Campagnes e-mail")],
    ] as [IdNatif, string, string, CleMarquePetite, string][]).map(([id, label, description, marque, categorie]): ServiceMaison => {
      const e = natifs.find((s) => s.id === id);
      return {
        id,
        label,
        description: e?.configure ? tf("Connecté : {0}", e.compte ?? "") : e?.aReconnecter ? t("Accès perdu, à reconnecter") : description,
        categorie,
        marque,
        connecte: Boolean(e?.configure),
        ouvert: ouvert === id,
        onBasculer: () => basculer(id),
        // Le profil LinkedIn mène à la ligne de la Page d'entreprise (VersPageLinkedin, ConnecteurNatif.tsx).
        panneau: <ConnecteurNatif id={id} onChange={relire} onOuvrir={(cible) => setOuvert(cible)} />,
      };
    }),
    // Messageries (28/09/2026, ConnecteurMessagerie.tsx), chacune avec son logo (troisième tournée des logos).
    ...([
      ["telegram", "Telegram", t("Lire les messages reçus par un bot, envoyer après accord"), "telegram"],
      ["discord", "Discord", t("Lire les salons d'un serveur, envoyer après accord"), "discord"],
      ["whatsapp", "WhatsApp Business", t("Messages reçus, réponses dans les 24 h et modèles, après accord"), "whatsapp"],
    ] as [IdMessagerie, string, string, CleMarquePetite][]).map(([id, label, description, marque]): ServiceMaison => {
      const e = messageries.find((s) => s.id === id);
      return {
        id,
        label,
        description: e?.configure ? tf("Connecté : {0}", e.compte ?? "") : e?.aReconnecter ? t("Jeton refusé, à reconnecter") : description,
        categorie: t("Messageries"),
        marque,
        connecte: Boolean(e?.configure),
        ouvert: ouvert === id,
        onBasculer: () => basculer(id),
        panneau: <ConnecteurMessagerie id={id} onChange={relire} />,
      };
    }),
    ...commerce,
    // Microsoft 365 (28/09/2026) : six lignes, une seule connexion (ConnecteurMicrosoft.tsx).
    ...lignesMicrosoft(natifs.find((s) => s.id === "microsoft"), ouvert, basculer, relire),
    {
      id: "slack",
      /*
       * « Slack (par jeton) », sous « Travail en équipe » (tournée finale du
       * 28/09/2026) : il y avait deux lignes « Slack », celle-ci sous
       * « Courrier, agenda et fichiers » et celle du serveur de Slack (catalogue)
       * sous « Travail en équipe ». Elles sont désormais côte à côte, et se
       * distinguent comme Notion et « Notion (par jeton) » : ici, le jeton d'un
       * bot, qui lit les salons où on l'invite.
       */
      label: t("Slack (par jeton)"),
      // Son logo depuis la troisième tournée des logos (28/09/2026, décision de Medhi ; scripts/marques/sources.json).
      description: resumeSlack(slack),
      categorie: t("Travail en équipe"),
      marque: "slack",
      connecte: Boolean(slack?.configure),
      ouvert: ouvert === "slack",
      onBasculer: () => basculer("slack"),
      panneau: <SlackConnecteur onChange={relire} />,
    },
  ];

  return (
    <SettingsPage
      title={t("Connecteurs")}
      subtitle={t("Branchez vos services. Chaque service ajoute ses outils à vos agents, dans le Chat comme dans Cowork.")}
    >
      <div className="space-y-4">
        <Connecteurs maison={services} />
        <McpServers />
      </div>
    </SettingsPage>
  );
}

/** Ce que dit la ligne Drive selon l'état de la connexion. */
function resumeDrive(e: EtatDrive | null): string {
  if (e?.configure) return e.compte ? tf("Connecté : {0}", e.compte) : t("Drive connecté");
  if (e?.aReconnecter) return t("Accès perdu, à reconnecter");
  if (e && !e.disponible) return t("Préparation Google à faire");
  return t("Retrouver et lire vos documents");
}

/** Ce que dit la ligne Slack selon l'état de la connexion. */
function resumeSlack(e: EtatSlack | null): string {
  if (e?.configure) return e.espace ? tf("Espace « {0} »", e.espace) : t("Slack connecté");
  if (e?.aReconnecter) return t("Jeton refusé, à reconnecter");
  return t("Lire les salons où vous l'invitez");
}

/**
 * Serveurs MCP réellement lancés par la passerelle.
 *
 * Passe par `useMcp` plutôt que par un état local dupliqué : activer un serveur
 * ici doit se voir dans le panneau de Cowork, qui liste les mêmes outils. Avec
 * deux états séparés, l'interrupteur basculait bien mais Cowork continuait
 * d'annoncer l'ancienne liste de compétences.
 *
 * Ce bloc double la liste des connecteurs au-dessus, et c'est voulu : il répond
 * à d'autres questions. Couper un serveur un moment sans le débrancher, savoir
 * quel dossier l'agent atteint, et lire le nom exact des outils qu'un service a
 * apportés — ce qu'aucune carte de connecteur n'a vocation à montrer.
 */
function McpServers() {
  const state = useMcp();
  const { toggle } = state;
  const [expanded, setExpanded] = useState<string | null>(null);

  if (state.loading && state.servers.length === 0) {
    return (
      <Card className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
        <Loader2 size={16} className="animate-spin" />{" "}{t("Chargement des serveurs...")}
      </Card>
    );
  }

  if (state.error) {
    return (
      <InfoBox tone="warning" leading={<Info size={15} strokeWidth={1.75} />}>
        {isDesktopApp() ? (
          <>
            {t("Moteur injoignable. Il redémarre tout seul : patientez quelques secondes, puis rouvrez cet écran.")}
          </>
        ) : (
          <>
            {t("Service injoignable à cette adresse. Démarrez-le avec")}{" "}<code>{t("npm run gateway")}</code>{" "}
            {t("pour gérer vos serveurs MCP.")}
          </>
        )}
      </InfoBox>
    );
  }

  return (
    <>
      <Card>
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-lg font-semibold text-foreground">
            <Server size={18} strokeWidth={1.75} />{" "}{t("Détail des serveurs")}
          </h3>
          <span className="rounded-full bg-success/15 px-2.5 py-1 text-xs font-medium text-success">
            {t("Auto-hébergés")}
          </span>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("Ces serveurs s'exécutent sur cette machine. Aucune donnée ne transite par un service tiers.")}
        </p>
        {state.workspace && (
          <p className="mt-2 text-xs text-muted-foreground">
            {t("Espace de travail :")}{" "}<code className="break-all text-foreground">{state.workspace}</code>
          </p>
        )}

        <div className="mt-4 space-y-2">
          {state.servers.map((s) => (
            <div key={s.id} className="rounded-xl border border-border">
              {/*
                Le nombre d'outils et l'interrupteur passent à la ligne quand la
                place manque (tournée à l'écran du 28/09/2026) : à 375 px, le nom
                du serveur passait sous « 14 outils » et sa description tenait
                en 4 px.
              */}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2 p-3.5">
                <span
                  className={cn(
                    "h-2 w-2 shrink-0 rounded-full",
                    s.running ? "bg-success" : "bg-neutral-70",
                  )}
                />
                <div className="min-w-0 flex-1 basis-32">
                  <p className="text-sm font-medium text-foreground">{t(s.label)}</p>
                  <p className="text-xs text-muted-foreground [overflow-wrap:anywhere]">{s.description}</p>
                  {s.error && <p className="text-xs text-destructive">{s.error}</p>}
                </div>
                {s.running && (
                  <button
                    type="button"
                    onClick={() => setExpanded(expanded === s.id ? null : s.id)}
                    className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {s.toolCount === 1 ? t("1 outil") : tf("{0} outils", s.toolCount)}
                  </button>
                )}
                <Switch
                  checked={s.running}
                  onChange={(v) => void toggle(s.id, v)}
                  label={tf("Activer {0}", t(s.label))}
                />
              </div>
              {expanded === s.id && (
                <ul className="max-h-64 space-y-1 overflow-y-auto border-t border-border p-3.5">
                  {s.tools.map((t) => (
                    <li key={t.name} className="text-xs">
                      <code className="text-foreground">{t.name}</code>
                      <span className="ms-2 text-muted-foreground">
                        {t.description.split(".")[0]}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </Card>

    </>
  );
}

/* ========================================================================== */
/* Intégrations                                                               */
/* ========================================================================== */
/*
 * Cet écran affichait Google comme « Connecté », avec l'adresse du compte à
 * côté. Or il n'existe ni OAuth, ni jeton, ni route d'instance vers un service
 * externe : l'adresse montrée était celle du compte local, ce qui rendait
 * l'illusion crédible et donc plus grave. Un client pouvait en conclure que sa
 * messagerie et son agenda étaient déjà accessibles à l'agent.
 *
 * Une intégration est désormais réelle : le courrier, en IMAP. C'est la seule
 * compatible avec la promesse de souveraineté, puisque IMAP est un protocole
 * ouvert et non l'API d'un fournisseur. Les autres cartes restent des annonces
 * et le disent.
 */



/* ========================================================================== */
/* API développeur : clés personnelles et documentation (clesApi.ts)          */
/* ========================================================================== */
export function ApiSettings() {
  return (
    <SettingsPage title={t("API développeur")} subtitle={t("Clés d'accès et intégration programmatique")}>
      <ClesApi />
    </SettingsPage>
  );
}

/* ========================================================================== */
/* Mon usage                                                                  */
/* ========================================================================== */
/*
 * Cet écran affichait un budget, une courbe de coûts et un modèle
 * (« qwen3.5-397b-a17b ») qui n'avaient jamais existé. Les données sont
 * maintenant mesurées par la passerelle : voir `gateway/src/usage.ts` et
 * `src/components/settings/Usage.tsx`.
 */
/*
 * Le moteur et les modèles de la machine de l'instance : où ils sont, la
 * place qu'il reste, et comment les mettre sur un autre disque (28/09/2026,
 * gateway/src/emplacementModeles.ts).
 */
export function ModelesLocauxSettings() {
  return (
    <SettingsPage
      title={t("Modèles locaux")}
      subtitle={t("Le moteur et les modèles qui tournent sur la machine de l'instance, et le disque où ils sont rangés.")}
    >
      <Card>
        <EmplacementModeles reglages />
      </Card>
      {/* L'application LM Studio, ou Bionic, qui s'ouvrait toute seule (23/10/2026) : rien ne s'affiche sans application LM Studio sur la machine. */}
      <MoteurLmStudioCarte />
      <Card className="mt-4"><OptimisationLocale /></Card>
    </SettingsPage>
  );
}

/** La carte n'apparaît que si le composant a quelque chose à dire (il rend null sinon). */
function MoteurLmStudioCarte() {
  return (
    <Card className="mt-4 empty:hidden">
      <MoteurLmStudio />
    </Card>
  );
}

export function ModelesSettings() {
  return (
    <SettingsPage
      title={t("Modèles cloud")}
      subtitle={t("Les modèles d'un fournisseur, par votre propre clé, pour vous ou pour toute l'équipe.")}
    >
      <ModelesCloud />
    </SettingsPage>
  );
}

/*
 * Entraîner un modèle sur ses propres exemples, sur la machine de l'instance
 * (gateway/src/entrainement.ts).
 */
export function EntrainementSettings() {
  return (
    <SettingsPage
      title={t("Entraîner un modèle")}
      subtitle={t("Apprenez à un petit modèle ouvert les faits de votre société, sur cette machine, puis retrouvez-le dans le sélecteur de modèles.")}
    >
      <EntrainerModele />
    </SettingsPage>
  );
}

export function UsageSettings() {
  return (
    <SettingsPage
      title={t("Mon usage")}
      subtitle={t("Ce que vos conversations et vos agents ont consommé, modèle par modèle.")}
    >
      <Usage />
    </SettingsPage>
  );
}

/* ========================================================================== */
/* Confidentialité                                                            */
/* ========================================================================== */
export function ConfidentialiteSettings() {
  const rights = [
    { title: t("Droit d'accès (Art. 15)"), desc: t("Accédez à toutes vos données personnelles stockées dans l'application") },
    { title: t("Droit à la portabilité (Art. 20)"), desc: t("Exportez vos données dans un format structuré et lisible") },
    /*
     * Vrai depuis 0.10.0 : Profil, Zone de danger, « Supprimer mon compte »
     * (gateway/src/effacement.ts). Le journal d'audit est conservé, et l'écran
     * de suppression le dit.
     */
    { title: t("Droit à l'effacement (Art. 17)"), desc: t("Supprimez votre compte et vos données depuis Profil, Zone de danger. Le journal d'audit, scellé, est conservé") },
  ];
  /* Exactement les rubriques du fichier produit par `gateway/src/export.ts`. */
  const exportItems = [
    t("Votre compte (sans mot de passe ni secret) et l'état de votre double authentification"),
    t("Votre profil : instructions et mémoire personnelles"),
    t("Vos conversations, et celles qu'un collègue vous a partagées"),
    t("Vos projets, et ceux dont vous êtes membre"),
    t("Vos tâches et vos agents"),
    t("Votre consommation des modèles, jour par jour"),
    t("Vos postes connectés et vos entrées du journal d'audit"),
  ];
  const [exportEnCours, setExportEnCours] = useState(false);
  const [exportResume, setExportResume] = useState<ResumeExport | null>(null);
  const [exportErreur, setExportErreur] = useState<string | undefined>();
  const exporter = async () => {
    setExportEnCours(true);
    setExportErreur(undefined);
    setExportResume(null);
    try {
      setExportResume(await telechargerMesDonnees());
    } catch (err) {
      setExportErreur(err instanceof Error ? err.message : String(err));
    } finally {
      setExportEnCours(false);
    }
  };
  return (
    <SettingsPage
      title={t("Confidentialité et données personnelles")}
      subtitle={t("Gérez vos données personnelles et exercez vos droits RGPD")}
    >
      <SettingsRow
        title={t("Vos droits RGPD")}
        desc={t("Conformément au Règlement Général sur la Protection des Données")}
      >
        <Card>
          <p className="flex items-center gap-2 text-lg font-semibold text-foreground">
            <ShieldCheck size={18} strokeWidth={1.75} />{" "}{t("Protection de vos données")}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {tf("{0} respecte votre vie privée et vos droits en matière de protection des données", branding.name)}
          </p>
          <InfoBox tone="muted" className="mt-4" leading={<Info size={15} strokeWidth={1.75} />}>
            {t("Vous bénéficiez de plusieurs droits concernant vos données personnelles : droit d'accès, de rectification, d'effacement, de limitation du traitement, de portabilité et d'opposition.")}
          </InfoBox>
          <div className="mt-3 space-y-2">
            {rights.map((r) => (
              <div key={r.title} className="flex items-start gap-2 rounded-xl border border-border p-3">
                <Check size={16} strokeWidth={2.5} className="mt-0.5 shrink-0 text-success" />
                <div>
                  <p className="text-sm font-medium text-foreground">{r.title}</p>
                  <p className="text-sm text-muted-foreground">{r.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </SettingsRow>

      <SettingsRow
        title={t("Export de vos données")}
        desc={t("Téléchargez toutes vos données personnelles au format JSON")}
      >
        <Card>
          <p className="flex items-center gap-2 text-lg font-semibold text-foreground">
            <FileText size={18} strokeWidth={1.75} />{" "}{t("Exporter mes données")}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {tf("Obtenez une copie complète de toutes vos données personnelles stockées dans {0}.", branding.name)}
          </p>
          <p className="mt-3 text-sm font-medium text-foreground">{t("L'export comprendra les éléments suivants :")}</p>
          <ul className="mt-1 space-y-0.5 text-sm text-muted-foreground">
            {exportItems.map((it) => (
              <li key={it}>• {it}</li>
            ))}
          </ul>
          <InfoBox className="mt-4" leading={<Info size={15} strokeWidth={1.75} />}>
            {t("Un fichier JSON, lisible par n'importe quel logiciel. Ni mot de passe, ni secret de double authentification, ni jeton de connexion : l'instance n'en garde que des empreintes ou ne doit pas les transporter. Le fichier lui-même dit ce qu'il ne contient pas, et pourquoi. L'export est inscrit au journal d'audit.")}
          </InfoBox>
          <Button
            icon={Download}
            className="mt-4"
            disabled={exportEnCours}
            onClick={() => void exporter()}
          >
            {exportEnCours ? t("Préparation…") : t("Télécharger mes données")}
          </Button>
          {exportResume && (
            <p className="mt-3 text-sm text-muted-foreground">
              {/* Une phrase entière, traduite (28/09/2026) : « conversation », « projet » et le « s » du pluriel restaient en français. */}
              {tf(
                "Fichier prêt ({0} Ko) : {1}, {2}, {3}, {4}.",
                Math.max(1, Math.round(exportResume.octets / 1024)),
                exportResume.conversations === 1 ? t("1 conversation") : tf("{0} conversations", exportResume.conversations),
                exportResume.projets === 1 ? t("1 projet") : tf("{0} projets", exportResume.projets),
                exportResume.taches === 1 ? t("1 tâche") : tf("{0} tâches", exportResume.taches),
                exportResume.entreesDeJournal === 1 ? t("1 entrée de journal") : tf("{0} entrées de journal", exportResume.entreesDeJournal),
              )}
            </p>
          )}
          {exportErreur && (
            <InfoBox tone="warning" className="mt-3" leading={<Info size={15} strokeWidth={1.75} />}>
              {exportErreur}
            </InfoBox>
          )}
        </Card>
      </SettingsRow>

      <SettingsRow
        title={t("Délégué à la Protection des Données")}
        desc={t("Contactez notre DPO pour exercer vos droits")}
        last
      >
        <Card>
          <p className="flex items-center gap-2 text-lg font-semibold text-foreground">
            <Mail size={18} strokeWidth={1.75} />{" "}{t("Contact DPO")}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("Pour toute question concernant vos données personnelles")}
          </p>
          <div className="mt-3 flex items-center gap-3 rounded-xl bg-muted/40 px-4 py-3">
            <Mail size={18} strokeWidth={1.75} className="text-muted-foreground" />
            <div>
              <p className="text-sm font-medium text-foreground">{t("Email du DPO")}</p>
              <p className="text-sm text-muted-foreground">{branding.urls.dpoEmail}</p>
            </div>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            {t("Notre Délégué à la Protection des Données est disponible pour répondre à vos questions concernant le traitement de vos données personnelles et vous aider à exercer vos droits RGPD.")}
          </p>
        </Card>
      </SettingsRow>
    </SettingsPage>
  );
}

/* ========================================================================== */
/* Installer les apps                                                         */
/* ========================================================================== */
/*
 * Le téléchargement est servi par l'instance elle-même : voir
 * TelechargerApps.tsx et gateway/src/telechargement.ts. Le bouton grisé
 * « bientôt disponible » et le renvoi vers GitHub ont disparu : l'instance a
 * l'application sous la main, dans sa version exacte.
 */
export function AppsSettings() {
  return (
    <SettingsPage
      title={t("Installer les apps")}
      subtitle={tf("Téléchargez les applications {0} pour accéder à vos données depuis tous vos appareils.", branding.name)}
    >
      <TelechargerApps />
    </SettingsPage>
  );
}

/* ----------------------------- Importer ses Chats ----------------------------- */

/** Reprendre ses Chats et ses projets depuis ChatGPT, Claude ou Gemini : voir ImporterChats.tsx. */
export function ImportSettings() {
  return (
    <SettingsPage
      title={t("Importer depuis d'autres IA")}
      subtitle={t("Reprenez vos Chats, projets et instructions depuis vos autres outils d’IA.")}
    >
      <ImporterChats />
    </SettingsPage>
  );
}

/* ----------------------------- Contrôle de l'écran ----------------------------- */

/**
 * Contrôle de l'écran : ce que l'instance autorise, ce que macOS a accordé, et
 * un essai pour le vérifier soi-même plutôt que de le découvrir en pleine tâche.
 */
export function EcranSettings() {
  const { capability, journal, refresh } = useComputer();
  const [essai, setEssai] = useState<{ ok: boolean; message: string } | null>(null);
  const [apercu, setApercu] = useState<string | null>(null);
  const [occupe, setOccupe] = useState(false);
  /*
   * Issue de la demande d'installation. Le bouton se contentait auparavant de
   * passer à « Installation lancée » sans jamais lire la réponse : instance
   * injoignable ou demande refusée, l'écran affichait la même chose et restait
   * bloqué là. On attend le verdict, et on rend la main s'il est négatif.
   */
  const [installation, setInstallation] = useState<"lancee" | "echec" | null>(null);

  const tester = async () => {
    setOccupe(true);
    setEssai(null);
    const res = await runAction({ action: "capture" });
    setEssai({ ok: res.ok, message: res.message });
    setApercu(res.capture ? `data:image/png;base64,${res.capture.base64}` : null);
    setOccupe(false);
    refresh();
  };

  if (!capability) {
    return (
      <SettingsPage title={t("Contrôle de l'écran")} subtitle={t("Lecture de l'état en cours...")}>
        <Card>
          <Loader2 size={16} className="animate-spin text-muted-foreground" />
        </Card>
      </SettingsPage>
    );
  }

  const desactive = capability.mode === "desactive";

  return (
    <SettingsPage
      title={t("Contrôle de l'écran")}
      subtitle={t("Permet à Cowork de voir l'écran, de déplacer la souris et de saisir au clavier, sous votre approbation.")}
    >
      <ActivationEcran capability={capability} onChange={() => void refresh()} />

      <Card className="mb-4">
        <SettingsRow
          title={t("Mode")}
          desc={
            capability.mode === "sandbox"
              ? t("L'agent agit dans une machine virtuelle dédiée. Votre poste n'est jamais touché.")
              : capability.mode === "hote"
                ? t("L'agent agit sur cette machine : la souris, le clavier et les fenêtres réelles.")
                : t("Aucune route de contrôle n'est active sur cette instance.")
          }
        >
          <span className="text-sm font-medium text-foreground">
            {MODE_LABEL[capability.mode]}
          </span>
        </SettingsRow>

        <SettingsRow
          title={t("Approbation")}
          desc={
            capability.approbationRequise
              ? t("Chaque action modifiante vous est soumise avant d'être exécutée.")
              : t("Les actions partent sans confirmation. À réserver aux postes de démonstration.")
          }
        >
          <span className="text-sm font-medium text-foreground">
            {capability.approbationRequise ? t("Demandée") : t("Désactivée")}
          </span>
        </SettingsRow>

        {capability.ecran && (
          <SettingsRow title={t("Écran détecté")} desc={t("Repère utilisé pour les clics.")}>
            <span className="text-sm text-muted-foreground">
              {capability.ecran.largeur} × {capability.ecran.hauteur}
            </span>
          </SettingsRow>
        )}
      </Card>

      {!desactive && (
        <Card className="mb-4">
          <h3 className="mb-3 text-lg font-semibold text-foreground">{t("Autorisations")}</h3>
          <Autorisation
            ok={capability.permissions.capture}
            titre={t("Voir l'écran")}
            manque={tf("Réglages Système > Confidentialité et sécurité > Enregistrement de l'écran, puis relancez {0}.", branding.name)}
          />
          <Autorisation
            ok={capability.permissions.controle}
            titre={t("Souris et clavier")}
            manque={t("Réglages Système > Confidentialité et sécurité > Accessibilité.")}
          />
          <Autorisation
            ok={Boolean(capability.modeleEcran)}
            titre={
              capability.modeleEcran
                ? tf("Lecture de l'écran : {0}", capability.modeleEcran)
                : t("Lecture de l'écran")
            }
            manque={t("Aucun modèle chargé ne sait lire une capture. L'agent cliquerait à l'aveugle.")}
          />

          {!capability.modeleEcran && capability.modeleConseille && (
            <div className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-muted/50 p-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">
                  {capability.modeleConseille.label}
                </p>
                <p className="text-xs text-muted-foreground">
                  {capability.modeleConseille.description}{" "}{t("Environ")}{" "}
                  {capability.modeleConseille.downloadGb}{" "}{t("Go à télécharger.")}
                </p>
              </div>
              <Button
                variant="secondary"
                size="sm"
                icon={Download}
                disabled={installation === "lancee"}
                onClick={() => {
                  const cle = capability.modeleConseille?.key;
                  void installerModeleEcran(cle).then((ok) => {
                    setInstallation(ok ? "lancee" : "echec");
                    // Le téléchargement se poursuit côté instance : on relit
                    // l'état pour que la ligne « Lecture de l'écran » se mette
                    // à jour dès que le modèle est disponible.
                    if (ok) refresh();
                  });
                }}
              >
                {installation === "lancee" ? t("Installation lancée") : "Installer"}
              </Button>
            </div>
          )}

          {installation === "echec" && (
            <InfoBox
              tone="warning"
              className="mt-3"
              leading={<ShieldOff size={15} strokeWidth={1.75} />}
            >
              {t("L'installation n'a pas pu être lancée. Vérifiez que l'instance répond, puis réessayez.")}
            </InfoBox>
          )}

          {capability.problemes.length > 0 && (
            <InfoBox tone="warning" className="mt-3" leading={<ShieldOff size={15} strokeWidth={1.75} />}>
              <ul className="space-y-1">
                {capability.problemes.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </InfoBox>
          )}

          <div className="mt-4 flex items-center gap-3">
            <Button icon={Monitor} disabled={occupe} onClick={() => void tester()}>
              {occupe ? t("Essai en cours...") : t("Tester la capture")}
            </Button>
            {essai && (
              <span
                className={cn(
                  "text-sm",
                  essai.ok ? "text-success" : "text-foreground",
                )}
              >
                {essai.message}
              </span>
            )}
          </div>

          {apercu && (
            <img
              src={apercu}
              alt={t("Aperçu de l'écran capturé")}
              className="mt-3 w-full rounded-lg border border-border"
            />
          )}
        </Card>
      )}

      {journal.length > 0 && (
        <Card>
          <h3 className="mb-3 text-lg font-semibold text-foreground">{t("Dernières actions")}</h3>
          <ul className="space-y-1.5">
            {journal.map((entree, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <span className="mt-0.5 shrink-0">
                  {entree.ok ? (
                    <Check size={14} strokeWidth={2} className="text-success" />
                  ) : (
                    <ShieldOff size={14} strokeWidth={1.75} className="text-warning" />
                  )}
                </span>
                <span className="text-muted-foreground">{entree.texte}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </SettingsPage>
  );
}

function Autorisation({ ok, titre, manque }: { ok: boolean; titre: string; manque: string }) {
  return (
    <div className="flex items-start gap-2.5 py-2">
      <span className="mt-0.5 shrink-0">
        {ok ? (
          <Check size={16} strokeWidth={2} className="text-success" />
        ) : (
          <ShieldOff size={16} strokeWidth={1.75} className="text-warning" />
        )}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium text-foreground">{titre}</span>
        <span className="block text-sm text-muted-foreground">
          {ok ? t("Accordée.") : manque}
        </span>
      </span>
    </div>
  );
}

/* ----------------------------- Signaler un problème ----------------------------- */

/** Retours envoyés à l'éditeur par un ticket GitHub ou un mail (27/09/2026). */
export function SignalerSettings() {
  return (
    <SettingsPage
      title={t("Signaler un problème")}
      subtitle={t("Dites ce qui ne va pas : le retour arrive directement à ceux qui font le logiciel.")}
    >
      <SignalerProbleme />
    </SettingsPage>
  );
}
