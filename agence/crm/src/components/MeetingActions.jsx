import React, { useState } from "react";
import { CalendarPlus, RefreshCw } from "lucide-react";
export default function MeetingActions({
  record,
  session,
  connections,
  api,
  onUpdated,
  onNotice,
}) {
  const [provider, setProvider] = useState(
      record.provider ||
        connections.find((c) => c.capabilities?.calendar_write)?.provider ||
        ""
    ),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [allow, setAllow] = useState(false);
  if (record.owner !== session?.user.id)
    return (
      <small>
        La publication dans l’agenda est réservée à l’organisateur du
        rendez-vous.
      </small>
    );
  async function perform(action) {
    if (busy) return;
    if (
      !confirm(
        action === "reload"
          ? "Remplacer les modifications locales par la version actuelle de votre agenda ?"
          : action === "cancel"
          ? "Annuler ce rendez-vous dans votre agenda et notifier les participants ?"
          : "Publier la dernière version enregistrée de ce rendez-vous dans votre agenda et envoyer les invitations aux participants ?"
      )
    )
      return;
    setBusy(true);
    setError("");
    try {
      const result = await api("/api/calendar", {
        provider,
        record_id: record.id,
        action,
        allow_conflict: allow,
        request_key: crypto.randomUUID(),
      });
      onUpdated(result.record);
      onNotice(
        action === "reload"
          ? "Version de l’agenda rechargée."
          : action === "cancel"
          ? "Rendez-vous annulé dans le calendrier."
          : "Rendez-vous publié dans votre calendrier. Les invitations sont gérées par votre fournisseur."
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="meeting-actions">
      <h3>Relier à mon calendrier</h3>
      <p>
        Enregistrez vos modifications avant de publier. Les participants
        recevront les invitations ou mises à jour de votre agenda.
      </p>
      <label>
        Mon compte
        <select
          value={provider}
          disabled={record.calendar_linked || busy}
          onChange={(e) => setProvider(e.target.value)}
        >
          <option value="">Choisir un compte</option>
          {connections
            .filter((c) => c.capabilities?.calendar_write)
            .map((c) => (
              <option key={c.id} value={c.provider}>
                {c.email} · {c.provider}
              </option>
            ))}
        </select>
      </label>
      <label className="checkbox-label">
        <input
          type="checkbox"
          checked={allow}
          onChange={(e) => setAllow(e.target.checked)}
        />
        Autoriser un chevauchement de créneaux
      </label>
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
      <div className="connection-buttons">
        {record.calendar_linked && (
          <button
            type="button"
            className="secondary"
            disabled={busy}
            onClick={() => perform("reload")}
          >
            Recharger depuis l’agenda
          </button>
        )}
        <button
          type="button"
          className="primary"
          disabled={busy || !provider || record.status === "Annulé"}
          onClick={() => perform("publish")}
        >
          <CalendarPlus size={15} />
          {record.calendar_linked
            ? "Mettre à jour dans mon agenda"
            : "Publier dans mon agenda"}
        </button>
        {record.calendar_linked && record.status !== "Annulé" && (
          <button
            type="button"
            className="secondary"
            disabled={busy}
            onClick={() => perform("cancel")}
          >
            Annuler dans l’agenda
          </button>
        )}
      </div>
      <small>
        {record.calendar_linked
          ? "Agenda lié. Les modifications locales doivent être publiées pour être envoyées au fournisseur."
          : "La fiche est enregistrée dans le CRM. La publication dans votre agenda est une action distincte."}
      </small>
    </div>
  );
}
