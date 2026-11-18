import React, { useState } from "react";
import { Mail, RefreshCw, LogOut } from "lucide-react";
const presets={gmail:["imap.gmail.com","smtp.gmail.com"],ovh:["ssl0.ovh.net","ssl0.ovh.net"],infomaniak:["mail.infomaniak.com","mail.infomaniak.com"],ionos:["imap.ionos.fr","smtp.ionos.fr"],custom:["",""]};
export default function ImapAccount({connection,api,onRefresh,onError,onNotice,enabled}) {
  const [busy,setBusy]=useState(false),[preset,setPreset]=useState("gmail"),[draft,setDraft]=useState({email:"",password:"",imap_host:presets.gmail[0],smtp_host:presets.gmail[1],imap_port:993,smtp_port:465,share_emails:false});
  const change=(key,value)=>setDraft(d=>({...d,[key]:value}));
  async function perform(fn) {setBusy(true);try {await fn();await onRefresh();}catch(e){onError(e.message);}finally{setBusy(false);}}
  return <section className="panel connection">
    <div className="provider-icon"><Mail size={25}/></div>
    <h2>IMAP / SMTP</h2>
    <p>Connexion directe à une messagerie, comme dans Helix.</p>
    {connection ? <>
      <span className="badge">{connection.email} · Partagé avec l’équipe</span>
      <small>Dernière relève : {connection.last_sync_at?new Date(connection.last_sync_at).toLocaleString("fr-FR"):"En attente du premier import"}</small>
      {connection.sync_error && <p className="error" role="alert">{connection.sync_error}</p>}
      <p>Les échanges avec les contacts CRM alimentent la boîte commune. IMAP ne synchronise pas les calendriers.</p>
      <div className="connection-buttons">
        <button className="primary" disabled={busy} onClick={()=>perform(async()=>{const r=await api("/api/sync",{provider:"imap"});onNotice(`${r.messages} échange(s) traité(s).${r.pending?" L’import continuera aux prochains passages.":""}`);})}><RefreshCw size={15}/>Synchroniser</button>
        <button className="danger" disabled={busy} onClick={()=>{if(confirm("Déconnecter cette messagerie ? Les échanges déjà importés resteront dans l’espace commun."))perform(async()=>{await api("/api/connections",{provider:"imap",action:"disconnect"});onNotice("Messagerie déconnectée.");});}}><LogOut size={15}/>Déconnecter</button>
      </div>
    </> : <form onSubmit={e=>{e.preventDefault();perform(async()=>{await api("/api/imap",draft);setDraft(d=>({...d,password:""}));onNotice("IMAP et SMTP connectés. La relève va démarrer.");});}}>
      <p>Gmail nécessite un mot de passe d’application. Pour Outlook/Hotmail, utilisez Microsoft 365 ci-dessus : Microsoft peut refuser les mots de passe en IMAP.</p>
      <div className="form-fields">
        <label className="full">Fournisseur<select value={preset} disabled={busy} onChange={e=>{const key=e.target.value;setPreset(key);setDraft(d=>({...d,imap_host:presets[key][0],smtp_host:presets[key][1]}));}}>
          <option value="gmail">Gmail avec mot de passe d’application</option><option value="ovh">OVH</option><option value="infomaniak">Infomaniak</option><option value="ionos">IONOS</option><option value="custom">Autre serveur public</option>
        </select></label>
        <label className="full">Adresse de la messagerie<input type="email" required autoComplete="username" value={draft.email} disabled={busy} onChange={e=>change("email",e.target.value)}/></label>
        <label className="full">Mot de passe d’application<input type="password" required autoComplete="new-password" value={draft.password} disabled={busy} onChange={e=>change("password",e.target.value)}/></label>
        <label>Serveur IMAP<input required value={draft.imap_host} disabled={busy} onChange={e=>change("imap_host",e.target.value)}/></label>
        <label>Port IMAP<select value={draft.imap_port} disabled={busy}><option value="993">993 · TLS</option></select></label>
        <label>Serveur SMTP<input required value={draft.smtp_host} disabled={busy} onChange={e=>change("smtp_host",e.target.value)}/></label>
        <label>Port SMTP<select value={draft.smtp_port} disabled={busy} onChange={e=>change("smtp_port",Number(e.target.value))}><option value="465">465 · TLS</option><option value="587">587 · STARTTLS</option></select></label>
      </div>
      <label className="checkbox-label"><input type="checkbox" required checked={draft.share_emails} disabled={busy} onChange={e=>change("share_emails",e.target.checked)}/>Je connecte une messagerie professionnelle et partage ses échanges liés aux contacts CRM avec l’équipe Helix.</label>
      <small>Les deux connexions sont vérifiées avant enregistrement. Les identifiants sont chiffrés côté serveur et ne sont jamais affichés aux autres membres.</small>
      <button className="primary" disabled={busy || !enabled}>{busy?"Vérification IMAP et SMTP…":"Vérifier et connecter ma messagerie"}</button>
    </form>}
  </section>;
}
