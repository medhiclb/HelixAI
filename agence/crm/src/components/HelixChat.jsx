import React, { useState } from "react";
import { branding } from "../branding.mjs";

export function HelixChat({ api, data }) {
  const [question, setQuestion] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [action, setAction] = useState("followup");
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    setAnswer("");
    try {
      const result = await api("/api/team", { action: "ai_draft", task: action, company_id: companyId, question });
      setAnswer(result.text);
    } catch (error) {
      setError(error.message);
    } finally {
      setBusy(false);
    }
  }

  return <section className="panel team-tools helix-chat">
    <p>Rédigez un brouillon avec {branding.ai}. Si vous sélectionnez une entreprise, ses opportunités et ses débriefs récents sont transmis à l’instance de l’agence.</p>
    <form onSubmit={submit}>
      <label>Type de brouillon<select value={action} onChange={e => setAction(e.target.value)}>
        <option value="followup">Relance commerciale</option>
        <option value="summary">Synthèse de compte</option>
        <option value="proposal">Proposition commerciale</option>
      </select></label>
      <label>Entreprise<select value={companyId} onChange={e => setCompanyId(e.target.value)}>
        <option value="">Contexte saisi uniquement</option>
        {data.cabinets.map(company => <option key={company.id} value={company.id}>{company.name}</option>)}
      </select></label>
      <label>Consigne<textarea rows={5} required maxLength={4000} value={question} onChange={e => setQuestion(e.target.value)}/></label>
      <div><button className="primary" disabled={busy}>{busy ? "Rédaction…" : "Générer un brouillon"}</button></div>
    </form>
    {error && <p className="error" role="alert">{error}</p>}
    {answer && <section aria-live="polite"><h2>Brouillon</h2><p className="helix-chat-output">{answer}</p></section>}
  </section>;
}
