import React, { useEffect, useState } from "react";
import {
  Plug,
  RefreshCw,
  ArrowUpRight,
  LogOut,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import ImapAccount from "./ImapAccount";
function Account({
  provider,
  title,
  connection,
  api,
  configured,
  onRefresh,
  onError,
  onNotice,
}) {
  const [calendars, setCalendars] = useState([]),
    [calendar, setCalendar] = useState(connection?.calendar_id || "primary"),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(false);
  const perform = async (fn) => {
    setBusy(true);
    try {
      await fn();
      await onRefresh();
    } catch (e) {
      onError(e.message);
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    if (!connection) return;
    setLoading(true);
    api("/api/connections", { action: "calendars", provider })
      .then((r) => setCalendars(r.calendars))
      .catch((e) => onError(e.message))
      .finally(() => setLoading(false));
  }, [connection?.id]);
  return (
    <section className="panel connection">
      <div className="provider-icon">{provider === "google" ? "G" : "M"}</div>
      <h2>{title}</h2>
      <p>
        {provider === "google"
          ? "Gmail et Google Agenda"
          : "Outlook et Calendrier Microsoft"}
      </p>
      <span className="badge">
        {connection
          ? connection.email
          : configured
          ? "Prêt à connecter"
          : "Configuration serveur requise"}
      </span>
      {connection ? (
        <>
          <small>
            Dernière synchronisation :{" "}
            {connection.last_sync_at
              ? new Date(connection.last_sync_at).toLocaleString("fr-FR")
              : "En attente du premier import"}
          </small>
          {connection.sync_error && (
            <div className="error" role="alert">
              {connection.sync_error}
            </div>
          )}
          {(!connection.capabilities?.send ||
            !connection.capabilities?.calendar_write) && (
            <p className="connection-warning">
              Reconnectez ce compte pour autoriser l’envoi et la publication
              dans l’agenda.
            </p>
          )}
          <label className="connection-field">
            Calendrier à synchroniser
            <select
              value={calendar}
              disabled={loading || busy}
              onChange={(e) => setCalendar(e.target.value)}
            >
              {!calendars.length && (
                <option value={calendar}>
                  {loading ? "Chargement…" : "Calendrier actuel"}
                </option>
              )}
              {calendars.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {!c.write ? " (lecture seule)" : ""}
                </option>
              ))}
            </select>
          </label>
          <p>Les emails liés aux contacts CRM sont partagés dans la boîte commune Helix. Les autres emails ne sont pas importés ; les rendez-vous personnels affichent seulement les créneaux occupés.</p>
          <div className="connection-buttons">
            <button
              className="secondary"
              disabled={busy}
              onClick={() =>
                perform(async () => {
                  await api("/api/connections", {
                    provider,
                    action: "settings",
                    calendar_id: calendar,
                    share_emails: true,
                  });
                  onNotice(
                    "Préférences enregistrées. Le planning sera mis à jour à la prochaine synchronisation."
                  );
                })
              }
            >
              Enregistrer mes préférences
            </button>
            <button
              className="primary"
              disabled={busy}
              onClick={() =>
                perform(async () => {
                  const r = await api("/api/sync", { provider });
                  onNotice(
                    `${r.messages} échange(s) et ${
                      r.meetings
                    } rendez-vous traités.${
                      r.pending
                        ? " Import en cours : les pages suivantes seront chargées automatiquement."
                        : ""
                    }`
                  );
                })
              }
            >
              <RefreshCw size={15} />
              Synchroniser
            </button>
          </div>
          <div className="connection-buttons">
            <button
              className="text-button"
              disabled={busy}
              onClick={() =>
                perform(async () => {
                  const { url } = await api("/api/oauth", { provider });
                  window.location.assign(url);
                })
              }
            >
              Renouveler l’autorisation <ArrowUpRight size={14} />
            </button>
            <button
              className="danger"
              disabled={busy}
              onClick={() => {
                if (
                  confirm(
                    "Déconnecter ce compte ? Les synchronisations et envois seront désactivés. Les historiques CRM déjà importés seront conservés."
                  )
                )
                  perform(async () => {
                    await api("/api/connections", {
                      provider,
                      action: "disconnect",
                    });
                    onNotice(
                      "Compte déconnecté du CRM. Vous pouvez également révoquer son autorisation dans les paramètres Google ou Microsoft."
                    );
                  });
              }}
            >
              <LogOut size={14} />
              Déconnecter
            </button>
          </div>
        </>
      ) : (
        <button
          className="primary"
          disabled={busy || !configured}
          onClick={() =>
            perform(async () => {
              const { url } = await api("/api/oauth", { provider });
              window.location.assign(url);
            })
          }
        >
          Connecter mon compte <ArrowUpRight size={15} />
        </button>
      )}
    </section>
  );
}
export default function Connections({
  connections,
  api,
  health,
  onRefresh,
  onError,
  onNotice,
  enabled,
}) {
  return (
    <>
      <div className="connection-intro">
        <Plug size={26} />
        <div>
          <h2>Chaque compte, un même suivi.</h2>
          <p>
            Chaque membre connecte son propre compte Google et/ou Microsoft. Les
            rendez-vous commerciaux alimentent le planning commun et les fiches
            cabinets.
          </p>
        </div>
      </div>
      <div className="connection-grid">
        {[
          ["google", "Google Workspace"],
          ["microsoft", "Microsoft 365"],
        ].map(([provider, title]) => (
          <Account
            key={
              provider + connections.find((c) => c.provider === provider)?.id
            }
            provider={provider}
            title={title}
            connection={connections.find((c) => c.provider === provider)}
            configured={
              enabled &&
              health?.oauth?.[provider] &&
              health?.encryption &&
              health?.app_url
            }
            api={api}
            onRefresh={onRefresh}
            onError={onError}
            onNotice={onNotice}
          />
        ))}
      </div>
      <ImapAccount connection={connections.find(c=>c.provider==="imap")} api={api} onRefresh={onRefresh} onError={onError} onNotice={onNotice} enabled={enabled && health?.encryption && health?.database}/>
      <section className="panel connection-status">
        <h2>État de votre espace connecté</h2>
        <div className="readiness">
          {[
            ["Base partagée", health?.database && enabled],
            ["Chiffrement des comptes", health?.encryption],
            ["Adresse de retour des connexions", health?.app_url],
            ["Synchronisation en arrière-plan", health?.background_sync],
          ].map(([label, ok]) => (
            <div key={label}>
              {ok ? <CheckCircle2 size={17} /> : <AlertCircle size={17} />}
              <span>{label}</span>
              <strong>{ok ? "Configuré" : "À configurer"}</strong>
            </div>
          ))}
        </div>
        <p>
          L’actualisation se fait automatiquement chaque minute lorsque le CRM
          est ouvert. Une synchronisation quotidienne est prévue lorsque le CRM
          est fermé, si la tâche serveur est configurée. Les limites ou erreurs
          du fournisseur restent visibles sur chaque compte.
        </p>
      </section>
    </>
  );
}
