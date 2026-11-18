import React, { useCallback, useEffect, useRef, useState } from "react";
import { Mail, Plus, Send, Reply, Search, X, RefreshCw } from "lucide-react";
import {MailWork,InboundAttachments} from "./TeamTools";
import { db } from "../store";
export function Compose({
  connections,
  api,
  workspace,
  cabinets,
  initial,
  onClose,
  onSent,
}) {
  const [draft, setDraft] = useState(() => ({
    to: "",
    subject: "",
    body: "",
    provider: connections.find((c) => c.capabilities?.send)?.provider || "",
    cabinet_id: "",
    ...initial,
  }));
  const [key, setKey] = useState(crypto.randomUUID()),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [files,setFiles]=useState([]),[attachmentIds,setAttachmentIds]=useState([]);
  useEffect(()=>{let active=true;async function load(){if(!db||!workspace)return;try{const all=[];for(let offset=0;;offset+=500){const r=await db.from("crm_files").select("id,name,size").eq("workspace_id",workspace).eq("status","ready").order("created_at",{ascending:false}).order("id").range(offset,offset+499);if(r.error)throw r.error;all.push(...r.data);if(r.data.length<500)break;}if(active)setFiles(all);}catch(e){if(active)setError(e.message);}}load();return()=>{active=false;};},[workspace]);
  const change = (field, value) => {
    setDraft({ ...draft, [field]: value });
    setKey(crypto.randomUUID());
  };
  return (
    <div className="modal-backdrop">
      <section
        className="modal compose"
        role="dialog"
        aria-modal="true"
        aria-labelledby="compose-title"
      >
        <div className="modal-heading">
          <h2 id="compose-title">
            {draft.reply_id ? "Répondre au message" : "Nouveau message"}
          </h2>
          <button
            aria-label="Fermer le message"
            disabled={busy}
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (busy) return;
            setBusy(true);
            setError("");
            try {
              const result = await api("/api/mail", { ...draft, attachment_ids:attachmentIds, request_key: key });
              onSent(result.message || "Message accepté par le fournisseur.");
              onClose();
            } catch (e) {
              setError(e.message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <div className="form-fields">
            <label className="full">Pièces jointes des Documents partagés (2 Mo au total)<select multiple value={attachmentIds} onChange={e=>{setAttachmentIds([...e.target.selectedOptions].map(o=>o.value));setKey(crypto.randomUUID());}}>{files.map(f=><option key={f.id} value={f.id}>{f.name} · {Math.ceil(f.size/1024)} Ko</option>)}</select><small>Ajoutez d’abord les fichiers dans Documents. Ctrl/Cmd pour sélectionner plusieurs fichiers.</small></label>
            <label>
              Depuis mon compte
              <select
                required
                value={draft.provider}
                disabled={!!draft.reply_id}
                onChange={(e) => change("provider", e.target.value)}
              >
                <option value="">Choisir un compte connecté</option>
                {connections
                  .filter((c) => c.capabilities?.send)
                  .map((c) => (
                    <option key={c.id} value={c.provider}>
                      {c.email} · {c.provider}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Entreprise associé
              <select
                value={draft.cabinet_id}
                onChange={(e) => change("cabinet_id", e.target.value)}
              >
                <option value="">Aucun</option>
                {cabinets.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="full">
              À
              <input
                type="text"
                required
                value={draft.to}
                readOnly={!!draft.reply_id}
                placeholder="contact@cabinet.fr"
                onChange={(e) => change("to", e.target.value)}
              />
            </label>
            <label className="full">
              Objet
              <input
                required
                maxLength={500}
                value={draft.subject}
                onChange={(e) => change("subject", e.target.value)}
              />
            </label>
            <label className="full">
              Message
              <textarea
                required
                maxLength={100000}
                rows={12}
                value={draft.body}
                onChange={(e) => change("body", e.target.value)}
              />
            </label>
          </div>
          {error && (
            <div className="error" role="alert">
              {error}
            </div>
          )}
          <div className="modal-actions">
            <button
              type="button"
              className="secondary"
              disabled={busy}
              onClick={onClose}
            >
              Annuler
            </button>
            <button className="primary" disabled={busy || !draft.provider}>
              <Send size={15} />
              {busy ? "Envoi en cours…" : "Envoyer le message"}
            </button>
          </div>
          <small>
            L’envoi utilise votre propre messagerie. Le message apparaît dans
            ses éléments envoyés.
          </small>
        </form>
      </section>
    </div>
  );
}
export default function Mailbox({
  workspace,
  session,
  connections,
  api,
  cabinets,
  members = [],
  onNotice,
  onCompose,
}) {
  const [rows, setRows] = useState([]),
    [selected, setSelected] = useState(null),
    [query, setQuery] = useState(""),
    [direction, setDirection] = useState(""),
    [scope, setScope] = useState("team"),
    [workFilter,setWorkFilter]=useState(""),[workRows,setWorkRows]=useState([]),[readRows,setReadRows]=useState([]),
    [owner, setOwner] = useState(""),
    [cabinet, setEntreprise] = useState(""),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false),
    [updated, setUpdated] = useState(null),
    [limit, setLimit] = useState(100);
  const request = useRef(0);
  const userId = session?.user.id;
  const load = useCallback(async () => {
    if (!db || !workspace || !userId) return;
    const version = ++request.current;
    setLoading(true);
    try {
      let q = db.from("crm_messages").select("*")
        .eq("workspace_id", workspace).eq("deleted", false)
        .order("sent_at", { ascending: false }).order("id").limit(limit);
      if (scope === "mine") q = q.eq("user_id", userId);
      else q = q.eq("shared", true);
      if (scope === "team" && owner) q = q.eq("user_id", owner);
      if (cabinet) q = q.eq("cabinet_id", cabinet);
      if (direction) q = q.eq("direction", direction);
      const { data, error } = await q;
      if (version !== request.current) return;
      if (error) throw error;
      const [work,reads]=await Promise.all([db.from("crm_mail_work").select("*").eq("workspace_id",workspace),db.from("crm_mail_reads").select("message_key").eq("workspace_id",workspace).eq("user_id",userId)]);
      if(work.error||reads.error)throw work.error||reads.error;
      if(version!==request.current)return;
      setWorkRows(work.data||[]);setReadRows(reads.data||[]);
      setRows(data || []);
      setSelected(current => current ? data.find(r => r.id === current.id) || null : null);
      setError("");
      setUpdated(new Date());
    } catch (e) {
      if (version === request.current) {
        setError("Impossible d’actualiser les échanges : " + e.message);
        setRows([]);
        setSelected(null);
      }
    } finally {
      if (version === request.current) setLoading(false);
    }
  }, [workspace, userId, scope, owner, cabinet, direction, limit]);
  useEffect(() => {
    setRows([]);
    setSelected(null);
    load();
    const refresh = () => {
      if (document.visibilityState === "visible") load();
    };
    const timer = setInterval(refresh, 30000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      ++request.current;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [load]);
  const syncKey = connections.map(c => c.last_sync_at).join(",");
  useEffect(() => { load(); }, [syncKey]);
  const nameOf = id => members.find(m => m.user_id === id)?.display_name || "Collaborateur";
  const workOf=r=>workRows.find(w=>w.message_key===r.collaboration_key);
  const isRead=r=>readRows.some(x=>x.message_key===r.collaboration_key);
  const filtered = rows.filter(r => (workFilter==="unread"?!isRead(r):workFilter==="mine"?workOf(r)?.assigned_to===userId:workFilter?(workOf(r)?.status||"new")===workFilter:true)).filter(r =>
    [r.subject, r.sender, r.snippet, ...(r.recipients || [])]
      .join(" ").toLowerCase().includes(query.trim().toLowerCase())
  );
  return (
    <>
      <div className="toolbar">
        <div className="search">
          <Search size={16} />
          <input
            placeholder="Rechercher un échange chargé…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <select
          aria-label="Visibilité des messages"
          value={scope}
          onChange={(e) => setScope(e.target.value)}
        >
          <option value="mine">Mes échanges</option>
          <option value="team">Boîte commune Helix</option>
        </select>
        <select
          aria-label="Sens des messages"
          value={direction}
          onChange={(e) => setDirection(e.target.value)}
        >
          <option value="">Reçus et envoyés</option>
          <option value="received">Reçus</option>
          <option value="sent">Envoyés</option>
        </select>
        <button className="secondary" disabled={loading} onClick={load}>
          <RefreshCw size={15} />
          Actualiser
        </button>
        <button className="primary" onClick={() => onCompose({})}>
          <Plus size={15} />
          Écrire
        </button>
      </div>
      <div className="toolbar mail-filters">
        <select aria-label="Traitement des mails" value={workFilter} onChange={e=>setWorkFilter(e.target.value)}><option value="">Tous les états</option><option value="unread">Non lus par moi</option><option value="mine">Attribués à moi</option><option value="new">À traiter</option><option value="in_progress">En cours</option><option value="done">Traités</option></select>
        {scope === "team" && <select aria-label="Collaborateur" value={owner} onChange={e => setOwner(e.target.value)}>
          <option value="">Toute l’équipe</option>
          {members.map(m => <option key={m.user_id} value={m.user_id}>{m.display_name}</option>)}
        </select>}
        <select aria-label="Entreprise" value={cabinet} onChange={e => setEntreprise(e.target.value)}>
          <option value="">Tous les cabinets</option>
          {cabinets.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <small aria-live="polite">{loading ? "Actualisation…" : `${filtered.length} échange(s) chargé(s)`}{updated && !loading ? ` · Actualisé à ${updated.toLocaleTimeString("fr-FR", {hour:"2-digit",minute:"2-digit"})}` : ""}</small>
      </div>
      <p className="mail-explanation">
        La boîte commune réunit les emails commerciaux reçus et envoyés des membres Helix.
        Seuls les échanges avec les adresses de contacts et cabinets enregistrées dans le CRM sont importés,
        à partir des 30 derniers jours lors de la première connexion. Chaque membre connecte sa messagerie dans Connexions.
      </p>
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
      <div className="mail-layout">
        <section className="panel mail-list">
          {loading && !rows.length && <p role="status">Chargement…</p>}
          {!loading && !filtered.length && (
            <div className="empty">
              <Mail size={30} />
              <h3>{query || owner || cabinet || direction ? "Aucun échange pour ces filtres" : "Aucun échange à afficher"}</h3>
              <p>
                Ajoutez les adresses de vos contacts, connectez votre messagerie puis synchronisez-la. Les adresses autorisées rejoignent automatiquement le même espace.
              </p>
            </div>
          )}
          {filtered.map((r) => (
            <button
              className={`mail-row ${selected?.id === r.id ? "selected" : ""}`}
              key={r.id}
              onClick={() => {setSelected(r);setReadRows(current=>[...current,{message_key:r.collaboration_key}]);}}
            >
              <div>
                <strong>
                  {r.direction === "sent"
                    ? "À : " + r.recipients.join(", ")
                    : r.sender}
                </strong>
                <small>{new Date(r.sent_at).toLocaleDateString("fr-FR")}</small>
              </div>
              <b>{!isRead(r)&&"● "}{r.subject || "(Sans objet)"}</b>
              <small>{({new:"À traiter",in_progress:"En cours",done:"Traité"})[workOf(r)?.status||"new"]}{workOf(r)?.assigned_to?" · "+nameOf(workOf(r).assigned_to):""}</small>
              <p>{r.snippet}</p>
              <span className="badge">
                {cabinets.find((c) => c.id === r.cabinet_id)?.name || "Entreprise"}{" "}
                · {r.shared ? "Partagé" : "Privé"} · {nameOf(r.user_id)} · {r.provider === "google" ? "Gmail" : r.provider === "microsoft" ? "Outlook" : "IMAP"}
              </span>
            </button>
          ))}
          {rows.length >= limit && (
            <button
              className="secondary"
              onClick={() => setLimit((n) => n + 100)}
            >
              Charger plus d’échanges
            </button>
          )}
        </section>
        <section className="panel mail-detail">
          {selected ? (
            <>
              <span className="eyebrow">
                {selected.direction === "sent"
                  ? "MESSAGE ENVOYÉ"
                  : "MESSAGE REÇU"}
              </span>
              <h2>{selected.subject}</h2>
              <MailWork key={selected.id} message={selected} workspace={workspace} members={members} userId={userId} api={api}/>
              <p>
                Compte de {nameOf(selected.user_id)} · {selected.provider === "google" ? "Gmail" : selected.provider === "microsoft" ? "Outlook" : "IMAP"}
                <br />De : {selected.sender}
                <br />À : {selected.recipients.join(", ")}
                <br />
                {new Date(selected.sent_at).toLocaleString("fr-FR")}
              </p>
              <InboundAttachments key={selected.id+"attachments"} message={selected} api={api}/>
              <div className="mail-body">
                {selected.body_text ||
                  selected.snippet ||
                  "Aucun contenu texte disponible."}
              </div>
              {selected.user_id === session?.user.id &&
                selected.direction === "received" && (
                  <button
                    className="primary"
                    onClick={() =>
                      onCompose({
                        provider: selected.provider,
                        reply_id: selected.id,
                        to:
                          selected.sender.match(/<([^>]+)>/)?.[1] ||
                          selected.sender,
                        subject: /^re:/i.test(selected.subject)
                          ? selected.subject
                          : "Re: " + selected.subject,
                        cabinet_id: selected.cabinet_id,
                      })
                    }
                  >
                    <Reply size={15} />
                    Répondre
                  </button>
                )}
              {selected.user_id !== session?.user.id && (
                <div>
                  <button className="primary" disabled={!connections.some(c => c.capabilities?.send)}
                    onClick={() => onCompose({
                      to: selected.direction === "received"
                        ? selected.sender.match(/<([^>]+)>/)?.[1] || selected.sender
                        : selected.recipients.join(", "),
                      subject: /^re:/i.test(selected.subject || "") ? selected.subject : "Re: " + (selected.subject || ""),
                      cabinet_id: selected.cabinet_id || "",
                    })}>
                    <Send size={15} /> Écrire depuis mon compte
                  </button>
                  <small>Échange partagé par {nameOf(selected.user_id)}. Le nouveau message sera envoyé depuis votre propre messagerie.</small>
                </div>
              )}
            </>
          ) : (
            <div className="empty">
              <Mail size={28} />
              <h3>Sélectionnez un échange</h3>
              <p>Retrouvez le contexte avant de répondre.</p>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
