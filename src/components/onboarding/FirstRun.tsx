import { useState } from "react";
import {
  Download,
  Cpu,
  HardDrive,
  Check,
  TriangleAlert,
  Loader2,
  ServerCrash,
  RefreshCw,
} from "lucide-react";
import { LogoMark } from "@/components/ui/Logo";
import { Button } from "@/components/ui/Button";
import { InfoBox } from "@/components/ui/InfoBox";
import { branding } from "@/config/branding";
import { useProvision } from "@/hooks/useProvision";
import { EmplacementModeles } from "@/components/onboarding/EmplacementModeles";
import { MoteurLmStudio } from "@/components/settings/MoteurLmStudio";
import { isDesktopApp } from "@/lib/instance";
import { cn } from "@/lib/cn";
import { t, tf, locale } from "@/lib/i18n";

/**
 * Première mise en route : aucun modèle n'est disponible.
 * La machine est profilée, un modèle adapté est proposé, installé et chargé
 * sans que l'utilisateur ait à comprendre ce qui se passe (ADR-009).
 */
export function FirstRun({ onReady }: { onReady: () => void }) {
  const { status, state, unreachable, start, installerMoteur, relancerMoteur, refresh } = useProvision();
  const [conditions, setConditions] = useState(false);
  // Le modèle choisi à la place du recommandé (null : le recommandé), et la liste dépliée.
  const [choix, setChoix] = useState<string | null>(null);
  const [listeOuverte, setListeOuverte] = useState(false);

  const busy =
    state.phase === "checking" ||
    state.phase === "downloading" ||
    state.phase === "loading";

  if (unreachable) {
    return (
      <Shell>
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
          <ServerCrash size={26} strokeWidth={1.5} className="text-muted-foreground" />
        </span>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {t("Moteur indisponible")}
        </h1>
        {isDesktopApp() ? (
          <>
            <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
              {tf("Le moteur de {0} ne répond pas. Il est relancé automatiquement : patientez quelques secondes, puis réessayez.", branding.name)}
            </p>
            <p className="max-w-md text-xs leading-relaxed text-muted-foreground">
              {tf("S'il ne revient pas, c'est le plus souvent qu'un autre {0} est déjà ouvert sur cette machine, ou qu'un programme occupe son port. Fermez l'autre fenêtre, puis réessayez.", branding.name)}
            </p>
            <Button icon={RefreshCw} onClick={() => window.location.reload()}>
              {t("Réessayer")}
            </Button>
          </>
        ) : (
          <>
            <p className="max-w-md text-sm text-muted-foreground">
              {tf("Le service {0} n'est pas joignable à cette adresse. Vérifiez qu'il est démarré, puis rechargez la page.", branding.name)}
            </p>
            <code className="rounded-lg bg-muted px-3 py-1.5 text-xs text-foreground">
              {t("npm run gateway")}
            </code>
          </>
        )}
      </Shell>
    );
  }

  if (!status) {
    return (
      <Shell>
        <Loader2 size={22} className="animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{t("Analyse de votre machine...")}</p>
      </Shell>
    );
  }

  // Poste piloté par l'intégrateur : rien à installer d'ici (revue du 27/09/2026).
  if (status.managed) {
    return (
      <Shell>
        <LogoMark size={52} animated />
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{branding.name}</h1>
        <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
          {t("Sur ce poste, les modèles sont préparés par l'intégrateur, et aucun n'est encore disponible. Contactez la personne qui a installé ce poste.")}
        </p>
        <Button icon={RefreshCw} variant="ghost" onClick={refresh}>
          {t("Vérifier à nouveau")}
        </Button>
      </Shell>
    );
  }

  /*
   * L'application LM Studio de la personne est là, mais fermée (23/10/2026,
   * signalement « il ouvre automatiquement Bionic ») : l'instance ne la
   * démarre plus d'elle-même. L'écran le dit une fois, et laisse choisir.
   */
  if (status.lmStudioFerme && !busy) {
    return (
      <Shell>
        <LogoMark size={52} animated />
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{t("L'application LM Studio est fermée")}</h1>
        <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
          {tf("Ouvrez LM Studio, puis « Vérifier à nouveau » : {0} s'y branche. Ou choisissez ci-dessous le moteur que {0} peut démarrer lui-même.", branding.name)}
        </p>
        <MoteurLmStudio miseEnRoute onChange={refresh} />
        <Button icon={RefreshCw} variant="ghost" onClick={refresh}>
          {t("Vérifier à nouveau")}
        </Button>
      </Shell>
    );
  }

  /*
   * Sans moteur d'exécution, il n'y a aucun modèle à télécharger : c'est la
   * première chose à mettre en place. Helix s'en charge — demander à
   * l'utilisateur d'aller chercher un logiciel tiers, c'est là que la plupart
   * des installations s'arrêtent.
   */
  if (state.phase === "error" && state.code === "moteur_demarrage") {
    return <Shell>
      <LogoMark size={52} animated />
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">{state.message}</h1>
      {state.error && <p role="alert" className="max-w-md text-sm leading-relaxed text-muted-foreground">{state.error}</p>}
      <Button icon={RefreshCw} onClick={relancerMoteur}>{t("Réessayer le démarrage")}</Button>
    </Shell>;
  }

  if (!status.moteurInstalle) {
    /*
     * Mac Intel : le moteur est llama.cpp, logiciel libre (MIT), que Helix
     * pose lui-même (llamaCpp.ts, 28/09/2026). Rien à accepter : la licence
     * MIT ne pose aucune condition à qui s'en sert.
     */
    const ouvert = status.moteur === "llamacpp";
    return (
      <Shell>
        <LogoMark size={52} animated />
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {tf("Préparation de {0}", branding.name)}
        </h1>
        <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
          {ouvert ? (
            <>
              {tf("Il manque le moteur qui fait tourner les modèles : llama.cpp, un logiciel libre. {0} l'installe lui-même, puis le modèle adapté à ce Mac : rien à télécharger ni à glisser. Comptez quelques minutes selon votre connexion (11 Mo pour le moteur, 2 à 19 Go pour le modèle selon la machine). Les modèles tournent ensuite sur cette machine, sans rien envoyer à personne.", branding.name)}
            </>
          ) : (
            <>
              {tf("Il manque le moteur qui fait tourner les modèles : LM Studio, d'Element Labs. {0} l'installe lui-même : rien à télécharger ni à glisser. Comptez quelques minutes selon votre connexion (0,3 à 1,3 Go selon le système). Les modèles tournent ensuite sur cette machine, sans rien envoyer à l'éditeur.", branding.name)}
            </>
          )}
        </p>

        {busy || state.phase === "ready" ? (
          <div className="mt-2 w-full max-w-md">
            <div className="flex items-center gap-2 text-sm">
              {state.phase === "ready" ? (
                <Check size={15} strokeWidth={2.5} className="shrink-0 text-success" />
              ) : (
                <Loader2 size={15} className="shrink-0 animate-spin text-muted-foreground" />
              )}
              <span className="text-muted-foreground">{state.message}</span>
            </div>
            {typeof state.percent === "number" && state.phase === "downloading" && (
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${state.percent}%` }}
                />
              </div>
            )}
          </div>
        ) : ouvert ? (
          <div className="flex w-full max-w-md flex-col items-center gap-3">
            <EmplacementModeles onChange={refresh} />
            <Button icon={Download} onClick={() => void installerMoteur()}>
              {t("Installer le moteur")}
            </Button>
          </div>
        ) : (
          <div className="flex w-full max-w-md flex-col items-center gap-3">
            {/* Où iront le moteur et les modèles, avant de rien télécharger (28/09/2026). */}
            <EmplacementModeles onChange={refresh} />
            <label className="flex items-start gap-2 text-start text-sm text-foreground">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={conditions}
                onChange={(e) => setConditions(e.target.checked)}
              />
              <span>
                {t("J'accepte, pour moi ou au nom de mon organisation, les")}{" "}
                <a
                  href="https://lmstudio.ai/app-terms"
                  target="_blank"
                  rel="noreferrer noopener"
                  className="underline underline-offset-2"
                >
                  {t("conditions d'utilisation de LM Studio")}
                </a>
                {t(", qui en permettent l'usage personnel et interne, pas un service fourni à d'autres.")}
              </span>
            </label>
            <Button icon={Download} disabled={!conditions} onClick={() => void installerMoteur()}>
              {t("Installer le moteur")}
            </Button>
          </div>
        )}

        {state.phase === "error" && (
          <InfoBox
            tone="warning"
            className="mt-2 w-full max-w-md text-start"
            leading={<TriangleAlert size={15} strokeWidth={1.75} />}
          >
            <p className="font-medium text-foreground">{state.message}</p>
            {state.error && (
              <p className="mt-1 text-xs text-muted-foreground">{state.error}</p>
            )}
            {!ouvert && (
            <p className="mt-2 text-xs text-muted-foreground">
              {t("Vous pouvez aussi l'installer vous-même depuis")}{" "}
              <a
                href="https://lmstudio.ai/download"
                target="_blank"
                rel="noreferrer noopener"
                className="underline"
              >
                lmstudio.ai
              </a>
              {t(", l'ouvrir une fois, puis revenir ici.")}
            </p>
            )}
            <Button className="mt-2" size="sm" variant="ghost" icon={RefreshCw} onClick={refresh}>
              {t("Vérifier à nouveau")}
            </Button>
          </InfoBox>
        )}

        <p className="max-w-md text-xs leading-relaxed text-muted-foreground">
          {tf("Le paquet vient de l'éditeur, et son empreinte est vérifiée avant installation. Vous n'aurez jamais à le lancer vous-même : {0} le démarre quand il en a besoin et, en partant, décharge les modèles qu'il a chargés.", branding.name)}
        </p>
      </Shell>
    );
  }

  const { hardware, recommended } = status;
  /*
   * Le modèle choisi (28/09/2026, demandé par Medhi : pouvoir prendre plus
   * petit, comme pour un modèle cloud). Seuls les modèles qui tiennent sur la
   * machine sont proposés (`possibles`, provision.ts) : jamais un modèle qui
   * la ferait saturer. Par défaut, le recommandé.
   */
  const possibles = status.possibles?.length ? status.possibles : [recommended];
  const choisi = possibles.find((m) => m.key === choix) ?? recommended;
  /*
   * La carte montre le modèle en cours (vu par Medhi le 28/09/2026 : elle
   * annonçait « Qwen3.5 35B A3B » pendant que l'erreur parlait de Qwen3 1.7B,
   * un modèle de repli). Pendant une installation ou après un échec : celui
   * que la mise en route traite ; sinon, celui qui est choisi.
   */
  const enCours = (busy || state.phase === "error") && state.model ? status.catalog.find((m) => m.key === state.model) ?? possibles.find((m) => m.key === state.model) : undefined;
  const affiche = enCours ?? choisi;
  /*
   * « Prêt » sans modèle de Chat (modèle d'écran installé depuis les
   * réglages, modèle retiré depuis) : « Commencer » ne menait nulle part.
   * L'écran repropose alors l'installation (revue du 27/09/2026).
   */
  const pret = state.phase === "ready" && status.hasChatModel;

  return (
    <Shell>
      <LogoMark size={52} animated />
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        {tf("Bienvenue dans {0}", branding.name)}
      </h1>
      <p className="max-w-md text-sm text-muted-foreground">
        {tf("{0} fonctionne entièrement sur votre machine. Nous allons installer un modèle adapté à votre matériel. Vos données ne quittent pas cet ordinateur.", branding.name)}
      </p>

      {/* Profil machine */}
      <div className="mt-2 flex flex-wrap items-center justify-center gap-2 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1">
          <Cpu size={13} strokeWidth={1.75} />
          {hardware.appleSilicon ? "Apple Silicon" : hardware.arch}
          {" · "}
          {hardware.cpuCount}{" "}{t("cœurs")}
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1">
          <HardDrive size={13} strokeWidth={1.75} />
          {hardware.totalMemoryGb}{" "}{t("Go de mémoire")}
        </span>
      </div>

      {/* Modèle recommandé */}
      <div className="mt-4 w-full max-w-md rounded-2xl border border-border bg-card p-4 text-start">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {affiche.key === recommended.key ? t("Recommandé pour votre machine") : t("Modèle choisi")}
        </p>
        <div className="mt-1.5 flex items-baseline justify-between gap-3">
          <span className="font-medium text-foreground">{affiche.label}</span>
          <span className="text-xs text-muted-foreground">
            {tf("environ {0} Go", affiche.downloadGb.toLocaleString(locale()))}
          </span>
        </div>
        <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">{affiche.description}</p>
        {affiche.verifie === false && (
          <p className="mt-1 text-xs text-muted-foreground">
            {t("S'il ne se charge pas, un autre modèle adapté à la machine prend le relais.")}
          </p>
        )}

        {/* Progression */}
        {(busy || pret) && (
          <div className="mt-4">
            <div className="flex items-center gap-2 text-sm">
              {pret ? (
                <Check size={15} strokeWidth={2.5} className="shrink-0 text-success" />
              ) : (
                <Loader2 size={15} className="shrink-0 animate-spin text-muted-foreground" />
              )}
              <span className={cn(pret ? "text-foreground" : "text-muted-foreground")}>
                {state.message}
              </span>
            </div>
            {typeof state.percent === "number" && state.phase === "downloading" && (
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${state.percent}%` }}
                />
              </div>
            )}
          </div>
        )}

        {state.phase === "error" && (
          <InfoBox tone="warning" className="mt-4" leading={<TriangleAlert size={15} strokeWidth={1.75} />}>
            <p className="font-medium text-foreground">{state.message}</p>
            {state.error && (
              <p className="mt-1 max-h-24 overflow-auto text-xs text-muted-foreground">
                {state.error}
              </p>
            )}
          </InfoBox>
        )}
      </div>

      {/* Choisir un autre modèle : seulement ceux qui tiennent sur la machine. */}
      {!busy && !pret && possibles.length > 1 && (
        <div className="w-full max-w-md text-start">
          <button
            type="button"
            className="text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground"
            aria-expanded={listeOuverte}
            onClick={() => setListeOuverte((o) => !o)}
          >
            {listeOuverte ? t("Masquer les autres modèles") : t("Choisir un autre modèle")}
          </button>
          {listeOuverte && (
            <div className="mt-2 space-y-1.5" role="radiogroup" aria-label={t("Modèles adaptés à cette machine")}>
              <p className="text-xs text-muted-foreground">
                {t("Seuls les modèles que cette machine fait tourner sans ralentir sont proposés. Un modèle plus léger répond plus vite, avec des réponses plus simples.")}
              </p>
              {/* Le catalogue élargi du 28/09/2026 (une quarantaine de modèles sur une grosse machine) : la liste défile dans sa hauteur. */}
              <div className="max-h-72 space-y-1.5 overflow-y-auto pe-1">
              {possibles.map((m) => (
                <label
                  key={m.key}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 text-sm",
                    m.key === choisi.key ? "border-primary bg-muted" : "border-border hover:bg-muted",
                  )}
                >
                  <input type="radio" name="modele-mise-en-route" checked={m.key === choisi.key} onChange={() => setChoix(m.key)} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-foreground">{m.label}</span>
                    <span className="block text-xs text-muted-foreground">
                      {m.key === recommended.key ? `${t("Recommandé")} · ` : ""}
                      {m.editeur ? `${m.editeur} · ` : ""}
                      {tf("environ {0} Go", m.downloadGb.toLocaleString(locale()))}
                    </span>
                  </span>
                </label>
              ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Où ira le modèle, et la place qu'il y a : avant « Installer et démarrer ». */}
      {!busy && !pret && (
        <div className="mt-3 flex w-full justify-center">
          <EmplacementModeles onChange={refresh} modeleChoisi={choisi.key === recommended.key ? undefined : choisi} />
        </div>
      )}

      <div className="mt-4 flex items-center gap-2">
        {pret ? (
          <Button icon={Check} onClick={onReady}>
            {t("Commencer")}
          </Button>
        ) : (
          <Button icon={Download} disabled={busy} onClick={() => start(choisi.key === recommended.key ? undefined : choisi.key)}>
            {busy ? t("Installation en cours...") : t("Installer et démarrer")}
          </Button>
        )}
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
      {children}
    </div>
  );
}

export default FirstRun;
