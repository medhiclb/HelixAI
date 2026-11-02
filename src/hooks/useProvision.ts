import { useCallback, useEffect, useRef, useState } from "react";

import { apiFetch } from "@/lib/endpoint";
import { ouvrirFlux } from "@/lib/flux";
import { tf } from "@/lib/i18n";

export interface Hardware {
  platform: string;
  arch: string;
  totalMemoryGb: number;
  cpuCount: number;
  appleSilicon: boolean;
}

export interface CatalogEntry {
  key: string;
  label: string;
  minMemoryGb: number;
  downloadGb: number;
  description: string;
  /** Qui publie les poids (gateway/src/provision.ts). */
  editeur?: string;
  /**
   * Essayé avec Helix ? Faux : l'accueil dit que s'il ne se charge pas, un
   * autre modèle prend le relais (sans dire qu'il n'a pas été essayé, PROJET.md
   * § 3.16).
   */
  verifie?: boolean;
}

export type ProvisionPhase =
  | "idle"
  | "checking"
  | "downloading"
  | "loading"
  | "ready"
  | "error";

export interface ProvisionState {
  /** Échec du démarrage, distinct d’un téléchargement de modèle. */
  code?: "moteur_demarrage";
  phase: ProvisionPhase;
  message: string;
  percent?: number;
  model?: string;
  error?: string;
}

interface Status {
  hardware: Hardware;
  recommended: CatalogEntry;
  catalog: CatalogEntry[];
  /** Les modèles que la machine fait tourner sans risque, du mieux noté au moins bien noté (le seul choix proposé). */
  possibles?: CatalogEntry[];
  hasChatModel: boolean;
  /** Le moteur d'exécution des modèles est-il présent sur la machine ? */
  moteurInstalle: boolean;
  /** L'application LM Studio de la machine est fermée, et l'instance ne la démarre pas sans choix (23/10/2026). */
  lmStudioFerme?: boolean;
  /** Lequel : LM Studio (conditions à accepter), ou llama.cpp sur un Mac Intel (MIT). Absent d'une passerelle plus ancienne : LM Studio. */
  moteur?: "lmstudio" | "llamacpp";
  /** Déploiement piloté par l'intégrateur : les modèles sont ceux du profil client, rien à installer ici. */
  managed?: boolean;
  state: ProvisionState;
}

/**
 * Provisionnement du modèle local : profil machine, recommandation, et suivi
 * de l'installation en direct (ARCHITECTURE.md, ADR-009).
 */
export function useProvision() {
  const [status, setStatus] = useState<Status | null>(null);
  const [state, setState] = useState<ProvisionState>({ phase: "idle", message: "" });
  const [unreachable, setUnreachable] = useState(false);
  /** Fermeture du flux ouvert, s'il y en a un (lib/flux.ts). */
  const sourceRef = useRef<(() => void) | null>(null);

  /** `suivre`, pour `load` (défini après lui). */
  const suivreRef = useRef<() => void>(() => {});
  /** `load`, pour `refusDit` (défini avant lui). */
  const loadRef = useRef<() => void>(() => {});

  /*
   * Une demande refusée (membre non administrateur, installation déjà en
   * cours, poste piloté par l'intégrateur) se dit à l'écran : le clic ne
   * faisait sinon rien de visible (revue du 27/09/2026).
   */
  const refusDit = useCallback(async (res: Response) => {
    /*
     * Acceptée : l'état est relu (28/09/2026). Le flux, ouvert juste avant la
     * demande, dit d'abord l'état du moment ; si c'était l'échec précédent,
     * il se refermait aussitôt, et la relecture qui suivait pouvait passer
     * avant la demande : l'écran restait sur cet échec pendant que
     * l'installation tournait. Relu après l'acceptation, l'état est « en
     * cours » (provision.ts), et le suivi repart.
     */
    if (res.ok) {
      loadRef.current();
      return;
    }
    // 409 : une installation tourne déjà, le flux ouvert la suit.
    if (res.status === 409) return;
    const corps = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
    sourceRef.current?.();
    sourceRef.current = null;
    setState({ phase: "error", message: corps.error?.message ?? tf("Demande refusée ({0}).", res.status) });
  }, []);

  const load = useCallback(() => {
    // Borné (24/10/2026) : une instance qui ne répond pas laissait « Analyse de votre machine... » tourner sans fin ; l'écran « Moteur indisponible » propose de réessayer.
    apiFetch(`/helix/provision`, { signal: AbortSignal.timeout(120_000) })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((data: Status) => {
        setStatus(data);
        setState(data.state);
        setUnreachable(false);
        /*
         * Une installation en cours (écran rouvert pendant un téléchargement,
         * ou modèle enchaîné après le moteur) : on suit sa progression, sans
         * quoi l'écran reste figé sur cette photo (MacBook, 27/09/2026).
         */
        if (["checking", "downloading", "loading"].includes(data.state.phase) && !sourceRef.current) suivreRef.current();
      })
      .catch(() => setUnreachable(true));
  }, []);

  loadRef.current = load;
  useEffect(load, [load]);

  /**
   * Ouvre le flux de progression. Moteur et modèles empruntent le même : la
   * mise en route est une seule séquence aux yeux de l'utilisateur.
   */
  const suivre = useCallback(() => {
    sourceRef.current?.();
    sourceRef.current = ouvrirFlux(
      "/helix/provision/stream",
      (donnees) => {
        try {
          const next = JSON.parse(donnees) as ProvisionState;
          setState(next);
          if (next.phase === "ready" || next.phase === "error") {
            sourceRef.current?.();
            sourceRef.current = null;
            load();
          }
        } catch {
          /* fragment ignoré */
        }
      },
      /*
       * Pas de reprise du flux lui-même : une fois coupé (passerelle
       * redémarrée, billet refusé), on relit l'état, qui se rebranche si une
       * installation tourne encore, ou rend l'écran et son bouton. Sans cela,
       * l'écran restait sur le dernier pourcentage (revue du 27/09/2026).
       */
      {
        reprendre: false,
        onErreur: () => {
          sourceRef.current = null;
          setTimeout(load, 2500);
        },
      },
    );
  }, [load]);
  suivreRef.current = suivre;

  /** Lance le téléchargement d'un modèle et suit la progression. */
  const start = useCallback(
    (model?: string) => {
      suivre();
      void apiFetch(`/helix/provision/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model }),
      })
        .then(refusDit)
        .catch(() => setUnreachable(true));
    },
    [suivre],
  );

  /**
   * Installe le moteur d'exécution des modèles (LM Studio). La personne, ou
   * son organisation, en accepte les conditions : la passerelle refuse sans cet accord.
   */
  const installerMoteur = useCallback(() => {
    suivre();
    void apiFetch(`/helix/provision/moteur`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conditionsAcceptees: true }),
    })
      .then(refusDit)
      .catch(() => setUnreachable(true));
  }, [suivre]);

  /** Reprend un démarrage raté sans réinstaller ni retélécharger le moteur. */
  const relancerMoteur = useCallback(() => {
    setState({ phase: "checking", message: "" });
    void apiFetch("/helix/provision/moteur/relancer", { method: "POST" })
      .then(async res => { if (res.ok || res.status === 409) suivre(); await refusDit(res); })
      .catch(() => setUnreachable(true));
  }, [suivre, refusDit]);

  useEffect(() => () => sourceRef.current?.(), []);

  return { status, state, unreachable, start, installerMoteur, relancerMoteur, refresh: load };
}
