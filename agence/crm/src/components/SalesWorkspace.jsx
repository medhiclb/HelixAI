import React, { useState } from "react";
import { saveRecord } from "../store";

const initial = { cabinet_id: "", name: "", description: "" };

export function SalesWorkspace({ workspace, data, userId, onSaved }) {
  const [draft, setDraft] = useState(initial);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const proposals = data.notes.filter(note => note.source === "Proposition commerciale");
  const change = (key, value) => setDraft(previous => ({ ...previous, [key]: value }));

  async function submit(event) {
    event.preventDefault();
    if (busy || !draft.name.trim() || !draft.description.trim()) return;
    setBusy(true);
    setStatus("");
    setError("");
    try {
      const saved = await saveRecord("notes", {
        ...draft, name: draft.name.trim(), description: draft.description.trim(),
        source: "Proposition commerciale", owner: draft.owner || userId || "",
      }, workspace);
      setDraft(saved);
      await onSaved();
      setStatus("Proposition enregistrée.");
    } catch (error) {
      setError(error.message);
    } finally {
      setBusy(false);
    }
  }

  return <section className="panel team-tools proposal-editor">
    <form onSubmit={submit}>
      <label>Proposition enregistrée<select value={draft.id || ""} onChange={e => {
        setDraft(proposals.find(note => note.id === e.target.value) || initial);
        setStatus("");
        setError("");
      }}>
        <option value="">Nouvelle proposition</option>
        {proposals.map(note => <option key={note.id} value={note.id}>{note.name}</option>)}
      </select></label>
      <label>Entreprise<select required value={draft.cabinet_id} onChange={e => change("cabinet_id", e.target.value)}>
        <option value="">Choisir une entreprise</option>
        {data.cabinets.map(company => <option key={company.id} value={company.id}>{company.name}</option>)}
      </select></label>
      <label>Titre<input required maxLength={150} value={draft.name} onChange={e => change("name", e.target.value)}/></label>
      <label>Proposition<textarea required rows={12} maxLength={20000} value={draft.description} onChange={e => change("description", e.target.value)}/></label>
      <div className="actions"><button className="primary" disabled={busy}>Enregistrer</button>{draft.id && <button type="button" className="secondary" onClick={() => {
        const file = new Blob([draft.name, "\n\n", draft.description], { type: "text/plain;charset=utf-8" });
        const url = URL.createObjectURL(file);
        const link = document.createElement("a");
        link.href = url;
        link.download = "proposition.txt";
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }}>Exporter</button>}</div>
    </form>
    {status && <p role="status">{status}</p>}
    {error && <p className="error" role="alert">{error}</p>}
  </section>;
}
