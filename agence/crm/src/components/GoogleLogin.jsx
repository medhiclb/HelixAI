import React, { useEffect, useRef } from "react";

let googleScript;

function loadGoogle() {
  googleScript ??= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.onload = () => resolve(window.google.accounts.id);
    script.onerror = () => {
      googleScript = undefined;
      reject(new Error("Le bouton Google n’a pas pu être chargé."));
    };
    document.head.append(script);
  });
  return googleScript;
}

export function GoogleLogin({ auth, onError }) {
  const target = useRef(null);
  useEffect(() => {
    let active = true;
    async function prepare() {
      const { clientId, nonce, error } = await auth.googleChallenge();
      if (error) throw error;
      if (!active) return;
      const google = await loadGoogle();
      if (!active) return;
      google.initialize({
        client_id: clientId, nonce,
        callback: async ({ credential }) => {
          if (!active) return;
          const result = await auth.signInWithGoogle(credential);
          if (active && result.error) onError(result.error.message);
        },
      });
      google.renderButton(target.current, { theme: "outline", size: "large", text: "continue_with", locale: "fr" });
    }
    prepare().catch(error => { if (active) onError(error.message); });
    return () => { active = false; };
  }, [auth, onError]);
  return <div ref={target} />;
}
