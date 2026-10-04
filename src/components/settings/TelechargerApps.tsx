import { useEffect, useState } from "react";
import { Apple, Check, Download, Info, Loader2, Monitor, Smartphone, Terminal } from "lucide-react";
import { Card } from "@/components/settings/SettingsShell";
import { Button } from "@/components/ui/Button";
import { InfoBox } from "@/components/ui/InfoBox";
import { SegmentedTabs } from "@/components/ui/SegmentedTabs";
import { LigneDeCommande } from "@/components/settings/LigneDeCommande";
import { branding } from "@/config/branding";
import { etatPaquets, preparerMac, telecharger, type EtatPaquet, type Plateforme } from "@/lib/telechargement";
import { t, tf, taille } from "@/lib/i18n";

/**
 * Installer les apps : télécharger l'application, servie par l'instance.
 *
 * Le bouton était grisé, « bientôt disponible » : aucun paquet n'était publié.
 * L'instance fait pourtant tourner l'application — elle la sert désormais
 * elle-même, dans sa version exacte (gateway/src/telechargement.ts).
 *
 * Ce qui n'existe pas est dit comme tel, sans bouton qui ne mène nulle part :
 * il n'y a pas d'application mobile. Ce que l'instance ne sert pas elle-même
 * (Windows, Linux, et macOS quand elle ne tourne pas sur un Mac) mène au
 * paquet de la même version sur la page de publication (04/10/2026). La ligne de commande, elle, est livrée avec l'application de bureau
 * depuis le 25/09/2026 (onglet CLI, LigneDeCommande.tsx).
 */

/**
 * Les paquets publiés pour chaque version, tels que la publication les nomme
 * (README, page de publication). La version est celle de l'interface, donc de
 * l'instance qui la sert.
 */
const PUBLIES: Record<Plateforme, { fichier: (v: string) => string; detail: string }[]> = {
  macos: [
    { fichier: (v) => `Helix-${v}-arm64.dmg`, detail: "Apple Silicon" },
    { fichier: (v) => `Helix-${v}-x64.dmg`, detail: "Intel" },
  ],
  windows: [{ fichier: (v) => `Helix-Setup-${v}-x64.exe`, detail: "Windows 10/11, x64" }],
  linux: [
    { fichier: (v) => `helix-plateforme_${v}_amd64.deb`, detail: "Ubuntu, Debian, x64" },
    { fichier: (v) => `Helix-${v}.AppImage`, detail: "AppImage, x64" },
  ],
};

const PLATEFORMES: { id: Plateforme; label: string }[] = [
  { id: "macos", label: "macOS" },
  { id: "windows", label: "Windows" },
  { id: "linux", label: "Linux" },
];

/** La plateforme du poste qui regarde l'écran, pour la proposer d'abord. */
function plateformeDuPoste(): Plateforme {
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  if (/Windows/i.test(ua)) return "windows";
  if (/Linux/i.test(ua) && !/Android/i.test(ua)) return "linux";
  return "macos";
}

export function TelechargerApps() {
  const [paquets, setPaquets] = useState<EtatPaquet[] | null | undefined>(undefined);
  const [plateforme, setPlateforme] = useState<Plateforme>(plateformeDuPoste);
  const [enCours, setEnCours] = useState<"preparation" | "ouverture" | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; texte: string } | null>(null);
  const [onglet, setOnglet] = useState<"desktop" | "cli">("desktop");

  useEffect(() => {
    void etatPaquets().then(setPaquets);
  }, []);

  const paquet = paquets?.find((p) => p.plateforme === plateforme);

  const lancer = async () => {
    if (!paquet?.disponible) return;
    setMessage(null);
    if (!paquet.pret) {
      setEnCours("preparation");
      const r = await preparerMac();
      if (!r.ok) {
        setEnCours(null);
        setMessage({ ok: false, texte: r.message ?? t("La préparation du paquet a échoué.") });
        return;
      }
      setPaquets(await etatPaquets());
    }
    setEnCours("ouverture");
    const ok = await telecharger(plateforme);
    setEnCours(null);
    setMessage(
      ok
        ? { ok: true, texte: t("Le téléchargement s'est ouvert dans votre navigateur : le fichier arrive dans Téléchargements.") }
        : { ok: false, texte: t("L'instance n'a pas délivré de lien de téléchargement. Reconnectez-vous, puis réessayez.") },
    );
  };

  return (
    <>
      <div className="mb-4">
        {/*
         * Seule l'application de bureau existe. Les deux autres onglets
         * restent visibles pour dire ce qui manque, pas pour le promettre.
         */}
        <SegmentedTabs
          value={onglet}
          onChange={(v) => setOnglet(v as "desktop" | "cli")}
          disabledIds={["mobile"]}
          disabledTitle={t("Pas d'application mobile pour l'instant.")}
          options={[
            { id: "desktop", label: t("Desktop"), icon: Monitor },
            { id: "cli", label: t("CLI"), icon: Terminal },
            { id: "mobile", label: t("Mobile"), icon: Smartphone },
          ]}
        />
      </div>

      {onglet === "cli" ? (
        <LigneDeCommande />
      ) : (
        <Card>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-foreground">{t("Application desktop")}</h3>
              <p className="mt-1 max-w-md text-sm text-muted-foreground">
                {t(
                  "Servie par votre instance, dans sa version exacte : un collègue installe la même que la vôtre, sans passer par Internet. Elle embarque sa passerelle, fonctionne hors ligne et fait tourner les agents et le bot de réunion.",
                )}
              </p>
            </div>
            {paquet?.disponible && (
              <span className="shrink-0 rounded-full bg-success/15 px-2.5 py-1 text-xs font-medium text-foreground">
                {t("Disponible")}
              </span>
            )}
          </div>

          <div className="mt-4">
            <SegmentedTabs size="sm" value={plateforme} onChange={(v) => setPlateforme(v as Plateforme)} options={PLATEFORMES} />
          </div>

          {paquets === undefined ? (
            <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 size={14} className="animate-spin" /> {t("Lecture de l'instance...")}
            </p>
          ) : paquets === null ? (
            <InfoBox tone="warning" className="mt-4" leading={<Info size={15} strokeWidth={1.75} />}>
              {t("Instance injoignable : c'est elle qui sert l'application.")}
            </InfoBox>
          ) : paquet?.disponible ? (
            <div className="mt-4 space-y-3">
              <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border px-4 py-3">
                <Apple size={20} strokeWidth={1.75} className="shrink-0 text-foreground" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-foreground">
                    {tf("{0} {1} pour macOS", branding.name, paquet.version ?? "")}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {paquet.architecture}
                    {paquet.taille ? ` · ${taille(paquet.taille)}` : ` · ${t("paquet préparé au premier téléchargement")}`}
                  </span>
                </span>
                <Button
                  icon={enCours ? Loader2 : Download}
                  disabled={enCours !== null}
                  onClick={() => void lancer()}
                >
                  {enCours === "preparation"
                    ? t("Préparation...")
                    : enCours === "ouverture"
                      ? t("Ouverture...")
                      : t("Télécharger")}
                </Button>
              </div>

              {message && (
                <InfoBox
                  tone={message.ok ? undefined : "warning"}
                  leading={message.ok ? <Check size={15} strokeWidth={2} /> : <Info size={15} strokeWidth={1.75} />}
                >
                  {message.texte}
                </InfoBox>
              )}

              {/*
               * Tant que l'application n'est pas signée par Apple, macOS refuse
               * de l'ouvrir d'un double-clic après un téléchargement. Le dire
               * ici évite de conclure qu'elle est cassée.
               */}
              <div className="rounded-xl bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
                <p className="font-medium text-foreground">{t("Au premier lancement")}</p>
                <ol className="mt-1 list-decimal space-y-0.5 ps-5">
                  <li>{t("Ouvrez le fichier .zip : l'application apparaît à côté.")}</li>
                  <li>{t("Glissez-la dans le dossier Applications.")}</li>
                  <li>
                    {t("Faites clic droit sur l'application, puis Ouvrir, et confirmez. Ce geste n'est demandé qu'une fois : l'application n'est pas encore signée par Apple.")}
                  </li>
                </ol>
              </div>
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              <p className="text-sm text-muted-foreground">{paquet?.raison ?? t("Indisponible.")}</p>
              {/* Le paquet de la même version, sur la page de publication : sans lui, l'onglet ne menait nulle part. */}
              {PUBLIES[plateforme].map((p) => (
                <a
                  key={p.fichier(__HELIX_VERSION__)}
                  href={`${branding.urls.sourceCode}/releases/download/v${__HELIX_VERSION__}/${p.fichier(__HELIX_VERSION__)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex flex-wrap items-center gap-3 rounded-xl border border-border px-4 py-3 hover:bg-muted/50"
                >
                  <Download size={18} strokeWidth={1.75} className="shrink-0 text-foreground" />
                  <span className="min-w-0 flex-1">
                    <span className="block break-all text-sm font-medium text-foreground">{p.fichier(__HELIX_VERSION__)}</span>
                    <span className="block text-xs text-muted-foreground">{p.detail}</span>
                  </span>
                </a>
              ))}
              <p className="text-xs text-muted-foreground">
                {tf("Même version que votre instance ({0}), depuis la page de publication.", __HELIX_VERSION__)}{" "}
                <a className="underline" href={`${branding.urls.sourceCode}/releases/tag/v${__HELIX_VERSION__}`} target="_blank" rel="noreferrer">
                  {t("Ouvrir la page")}
                </a>
              </p>
            </div>
          )}
        </Card>
      )}
    </>
  );
}

export default TelechargerApps;
