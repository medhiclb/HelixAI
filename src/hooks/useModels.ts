import { useCallback, useEffect, useState, useRef } from "react";
import { fetchModels, type GatewayModel } from "@/lib/gateway";

interface State {
  models: GatewayModel[];
  loading: boolean;
  error?: string;
}

/**
 * Modèles réellement disponibles, vus par la passerelle.
 * Ne conserve que ceux utilisables en conversation (les modèles
 * d'embeddings ou de contrôle d'écran ne sont pas proposés à l'utilisateur).
 */
export function useModels() {
  const [state, setState] = useState<State>({ models: [], loading: true });

  const numero = useRef(0);
  const refresh = useCallback(() => {
    const appel = ++numero.current;
    setState((s) => ({ ...s, loading: s.models.length === 0 }));
    fetchModels()
      .then((all) => {
        if (appel !== numero.current) return;
        setState({
          models: all.filter((m) => m.roles.includes("chat") || m.roles.includes("code")),
          loading: false,
        });
      })
      .catch((err: unknown) => {
        if (appel !== numero.current) return;
        setState(s => ({ ...s, loading: false, error: err instanceof Error ? err.message : String(err) }));
      });
  }, []);

  useEffect(() => {
    refresh();
    const relire = () => { if (!document.hidden) refresh(); };
    const changerCompte = () => { setState({ models: [], loading: true }); refresh(); };
    window.addEventListener("helix:identite-changee", changerCompte);
    window.addEventListener("focus", relire);
    window.addEventListener("helix:models-changed", relire);
    document.addEventListener("visibilitychange", relire);
    const timer = window.setInterval(relire, 15_000);
    return () => { window.removeEventListener("helix:identite-changee", changerCompte); numero.current++; clearInterval(timer); window.removeEventListener("focus", relire); window.removeEventListener("helix:models-changed", relire); document.removeEventListener("visibilitychange", relire); };
  }, [refresh]);

  return { ...state, refresh };
}
