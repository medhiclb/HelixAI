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
  const requete = useRef<AbortController | null>(null);
  const refresh = useCallback(() => {
    // Une relecture périodique ne doit pas invalider une réponse lente.
    if (requete.current) return;
    const controle = new AbortController();
    requete.current = controle;
    const appel = ++numero.current;
    setState((s) => ({ ...s, loading: s.models.length === 0 && !s.error }));
    fetchModels(controle.signal)
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
      }).finally(() => { if (requete.current === controle) requete.current = null; });
  }, []);

  useEffect(() => {
    refresh();
    const relire = () => { if (!document.hidden) refresh(); };
    const changerCompte = () => { numero.current++; requete.current?.abort(); requete.current = null; setState({ models: [], loading: true }); refresh(); };
    window.addEventListener("helix:identite-changee", changerCompte);
    window.addEventListener("focus", relire);
    window.addEventListener("helix:models-changed", relire);
    document.addEventListener("visibilitychange", relire);
    const timer = window.setInterval(relire, 15_000);
    return () => { window.removeEventListener("helix:identite-changee", changerCompte); numero.current++; requete.current?.abort(); requete.current = null; clearInterval(timer); window.removeEventListener("focus", relire); window.removeEventListener("helix:models-changed", relire); document.removeEventListener("visibilitychange", relire); };
  }, [refresh]);

  const relancer = useCallback(() => {
    numero.current++;
    requete.current?.abort();
    requete.current = null;
    setState(s => ({ ...s, error: undefined }));
    refresh();
  }, [refresh]);
  return { ...state, refresh: relancer };
}
