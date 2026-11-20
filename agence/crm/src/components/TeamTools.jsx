import React,{useEffect,useState} from 'react';
import {Bell,Upload,Download,Trash2,RefreshCw} from 'lucide-react';
import {db} from '../store';
import {HelixDrive} from './HelixDrive.jsx';
import {driveLinks} from '../drive-documents.mjs';

export function DriveDocuments({records}) {
 const [selected, setSelected] = useState(null);
 const links = driveLinks(records);
 const preview = links.find(link => link.file && link.file === selected);
 if (!links.length) return null;
 return <section className="panel team-tools">
  <h2>Documents Google Drive</h2>
  {links.map(link => <div className="team-row" key={link.href}>
   <div><strong>{link.label}</strong></div>
   {link.file && <button type="button" className="secondary" aria-pressed={selected === link.file}
    onClick={() => setSelected(selected === link.file ? null : link.file)}>Aperçu</button>}
   <a className="secondary" href={link.href} target="_blank" rel="noreferrer">Ouvrir</a>
  </div>)}
  {preview && <iframe title={'Aperçu : ' + preview.label} src={'https://drive.google.com/file/d/' + preview.file + '/preview'} style={{ width: '100%', height: 'min(65vh, 650px)', border: 0 }} />}
 </section>;
}

function useRows(table,workspace,select='*',recordId=null){
 const [limit,setLimit]=useState(300);
 const [rows,setRows]=useState([]),[error,setError]=useState('');
 async function load(){if(!db||!workspace)return;try{const all=[];for(let offset=0;offset<limit;offset+=300){let q=db.from(table).select(select).eq('workspace_id',workspace).order('created_at',{ascending:false}).order('id').range(offset,Math.min(offset+299,limit-1));if(recordId)q=q.eq('record_id',recordId);const r=await q;if(r.error)throw r.error;all.push(...(r.data||[]));if(r.data.length<300)break;}setRows(all);setError('');}catch(e){setError(e.message);}}

 useEffect(()=>{load();const id=setInterval(load,30000);return()=>clearInterval(id);},[table,workspace,recordId,limit]);return{rows,error,load,setError,limit,setLimit};
}
export function Documents({workspace,api,data,recordId}) {
 const {rows,error,load,setError,limit,setLimit}=useRows('crm_files',workspace,'*',recordId),[busy,setBusy]=useState(false),[record,setRecord]=useState(recordId||'');
 async function upload(files){setBusy(true);setError('');try{for(const file of files){const r=await api('/api/team',{action:'file_begin',name:file.name,size:file.size,record_id:record||null});const result=await db.storage.from('crm-documents').uploadToSignedUrl(r.path,r.token,file,{contentType:'application/octet-stream'});if(result.error)throw result.error;await api('/api/team',{action:'file_commit',id:r.id});}await load();}catch(e){setError(e.message);}finally{setBusy(false);}}
 return <>{!recordId && <HelixDrive />}{!recordId && <DriveDocuments records={[...(data?.cabinets || []), ...(data?.notes || [])]} />}<section className="panel team-tools"><h2>Documents partagés</h2><p>Documents privés de l’équipe, liés aux fiches. Maximum : 10 Mo par fichier.</p>{error&&<p className="error" role="alert">{error}</p>}
 {!recordId&&<label>Fiche associée<select value={record} onChange={e=>setRecord(e.target.value)}><option value="">Document de l’équipe</option>{Object.entries(data||{}).flatMap(([entity,rs])=>rs.map(r=><option key={r.id} value={r.id}>{r.name||r.subject||entity}</option>))}</select></label>}
 <label className="secondary upload-button"><Upload size={16}/>{busy?'Envoi en cours…':'Ajouter des fichiers'}<input type="file" multiple disabled={busy} onChange={e=>{upload([...e.target.files]);e.target.value='';}}/></label>
 {!rows.length&&<p>Aucun document pour le moment.</p>}{rows.map(f=><div className="team-row" key={f.id}><div><strong>{f.name}</strong><small>{Math.ceil(f.size/1024)} Ko · {new Date(f.created_at).toLocaleDateString('fr-FR')}</small></div><button title="Télécharger" onClick={async()=>{try{const r=await api('/api/team',{action:'file_download',id:f.id});const a=document.createElement('a');a.href=r.url;a.rel='noopener';a.click();}catch(e){setError(e.message);}}}><Download size={17}/></button><button title="Supprimer" onClick={async()=>{if(!confirm('Supprimer ce document de l’espace partagé ?'))return;try{await api('/api/team',{action:'file_delete',id:f.id});load();}catch(e){setError(e.message);}}}><Trash2 size={17}/></button></div>)}{rows.length>=limit&&<button className="secondary" onClick={()=>setLimit(limit+300)}>Charger plus de documents</button>}</section></>;
}
const labels={insert:'Création',update:'Modification',delete:'Suppression',mail_assignment:'Traitement du mail',file_upload:'Ajout de document',file_delete:'Suppression de document'};
export function Activity({workspace,members,recordId}){
 const {rows,error,load}=useRows('crm_activity',workspace,'*',recordId);
 return <section className="panel team-tools"><h2>Historique des actions <button onClick={load} title="Actualiser"><RefreshCw size={16}/></button></h2><p>Les 300 dernières actions. Le journal démarre à l’activation de cette fonction.</p>{error&&<p className="error">{error}</p>}{!rows.length&&<p>Aucune action enregistrée.</p>}{rows.map(r=><article className="activity-row" key={r.id}><strong>{labels[r.action]||r.action} · {r.title}</strong><small>{members.find(m=>m.user_id===r.actor_id)?.display_name||(r.actor_id?'Membre de l’équipe':'Synchronisation serveur')} · {new Date(r.created_at).toLocaleString('fr-FR')}</small>{Object.entries(r.details).map(([k,v])=><div className="activity-change" key={k}><b>{k.replaceAll('_',' ')}</b> : {v&&typeof v==='object'&&'before'in v?<><del>{String(v.before??'Vide')}</del> → {String(v.after??'Vide')}</>:String(v??'Aucun')}</div>)}</article>)}</section>;
}
export function Notifications({workspace,onOpen}){
 const {rows,error,load}=useRows('crm_notifications',workspace),[open,setOpen]=useState(false),[browser,setBrowser]=useState(()=>localStorage.getItem("helix-browser-alerts:"+workspace)==="true");
 useEffect(()=>{if(!db||!workspace)return;const run=async()=>{const r=await db.rpc('crm_refresh_reminders',{w:workspace});if(!r.error)load();};run();const t=setInterval(run,60000);return()=>clearInterval(t);},[workspace]);
 useEffect(()=>{if(!browser||!('Notification'in window)||Notification.permission!=='granted')return;for(const r of rows.filter(r=>!r.read_at)){const k='helix-notified:'+r.id;if(!sessionStorage.getItem(k)){new Notification(r.title,{body:r.body,tag:r.id});sessionStorage.setItem(k,'1');}}},[rows,browser]);
 const unread=rows.filter(r=>!r.read_at).length;
 return <div className="notification-anchor"><button aria-label={`Notifications : ${unread} non lues`} onClick={()=>{setOpen(!open);load();}}><Bell size={19}/>{unread>0&&<span className="badge">{unread}</span>}</button>{open&&<section className="notification-panel panel"><h3>Notifications</h3>{error&&<p className="error">{error}</p>}<button className="secondary" onClick={async()=>{const r=await db.rpc('crm_mark_notification',{n:null});if(!r.error)load();}}>Tout marquer comme lu</button><button className="secondary" onClick={async()=>{if('Notification'in window){const p=await Notification.requestPermission();setBrowser(p==='granted');localStorage.setItem('helix-browser-alerts:'+workspace,String(p==='granted')); }}}>Activer les alertes sur cet appareil</button><small>Rappels actualisés chaque minute lorsque le CRM est ouvert.</small>{!rows.length&&<p>Aucune notification.</p>}{rows.map(r=><button className={`notification-item ${r.read_at?'':'unread'}`} key={r.id} onClick={async()=>{await db.rpc('crm_mark_notification',{n:r.id});load();if(r.record_id)onOpen(r.record_id);setOpen(false);}}><strong>{r.title}</strong><span>{r.body}</span><small>{new Date(r.created_at).toLocaleString('fr-FR')}</small></button>)}</section>}</div>;
}
export function MailWork({message,workspace,members,userId,api}){
 const [work,setWork]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 async function load(){const r=await db.from('crm_mail_work').select('*').eq('workspace_id',workspace).eq('message_key',message.collaboration_key).maybeSingle();if(r.error)setError(r.error.message);else setWork(r.data);}
 useEffect(()=>{setWork(null);setError('');load();api('/api/team',{action:'mail_read',id:message.id}).catch(e=>setError(e.message));const t=setInterval(load,15000);return()=>clearInterval(t);},[message.id]);
 async function save(assigned,status){setBusy(true);setError('');try{const r=await db.rpc('crm_mail_assign',{w:workspace,m:message.id,assignee:assigned||null,new_status:status,expected:work?.revision||1}).single();if(r.error)throw r.error;setWork(r.data);}catch(e){setError(e.message);load();}finally{setBusy(false);}}
 return <div className="mail-work"><label>Responsable<select disabled={busy} value={work?.assigned_to||''} onChange={e=>save(e.target.value,work?.status||'new')}><option value="">Non attribué</option>{members.map(m=><option key={m.user_id} value={m.user_id}>{m.display_name}</option>)}</select></label><label>Traitement<select disabled={busy} value={work?.status||'new'} onChange={e=>save(work?.assigned_to,e.target.value)}><option value="new">À traiter</option><option value="in_progress">En cours</option><option value="done">Traité</option></select></label><button className="secondary" disabled={busy} onClick={()=>save(userId,'in_progress')}>Je prends ce message</button>{error&&<p className="error">{error}</p>}</div>;
}
export function ExternalCalendars({workspace,api,onChange}){
 const {rows,error,load,setError}=useRows('crm_calendar_accounts',workspace,'id,workspace_id,user_id,name,kind,share_details,last_sync_at,last_error,created_at');
 const [form,setForm]=useState({kind:'caldav',name:'',url:'',username:'',password:'',share_details:false}),[choices,setChoices]=useState([]),[busy,setBusy]=useState(false);
 const change=(k,v)=>{setForm({...form,[k]:v});if(['url','username','password','kind'].includes(k))setChoices([]);};
 async function run(action,id){setBusy(true);setError('');try{const r=await api('/api/team',{...form,action,id});if(action==='calendar_discover')setChoices(r.calendars);else{await load();onChange?.();if(action==='calendar_add'){setForm({...form,password:'',url:'',name:''});setChoices([]);}}}catch(e){setError(e.message);}finally{setBusy(false);}}
 return <section className="panel team-tools"><h2>Autres agendas</h2><p>iCloud ou serveur CalDAV, et liens privés ICS. Import dans le planning commun en lecture seule. Les événements privés restent affichés « Occupé ».</p>{error&&<p className="error" role="alert">{error}</p>}{rows.map(r=><div className="team-row" key={r.id}><div><strong>{r.name}</strong><small>{r.last_sync_at?'Synchronisé le '+new Date(r.last_sync_at).toLocaleString('fr-FR'):'Non synchronisé'}</small>{r.last_error&&<small className="error">{r.last_error}</small>}</div><button disabled={busy} onClick={()=>run('calendar_sync',r.id)}>Synchroniser</button><button disabled={busy} onClick={()=>{if(confirm('Déconnecter cet agenda et retirer ses créneaux du planning ?'))run('calendar_delete',r.id);}}>Déconnecter</button></div>)}
 <form onSubmit={e=>{e.preventDefault();run(form.kind==='caldav'&&!choices.length?'calendar_discover':'calendar_add');}}><div className="form-fields"><label>Type<select value={form.kind} onChange={e=>change('kind',e.target.value)}><option value="caldav">CalDAV / iCloud</option><option value="ics">Lien privé ICS</option></select></label><label>Nom<input required value={form.name} onChange={e=>change('name',e.target.value)}/></label><label className="full">Adresse HTTPS<input type="url" required value={form.url} onChange={e=>change('url',e.target.value)} placeholder={form.kind==='caldav'?'https://caldav.icloud.com':'https://…/agenda.ics'}/></label>{form.kind==='caldav'&&<><label>Identifiant<input required autoComplete="off" value={form.username} onChange={e=>change('username',e.target.value)}/></label><label>Mot de passe d’application<input type="password" autoComplete="new-password" required value={form.password} onChange={e=>change('password',e.target.value)}/></label></>}{choices.length>0&&<label className="full">Agenda<select required value={form.calendar_url||''} onChange={e=>change('calendar_url',e.target.value)}><option value="">Choisir</option>{choices.map(c=><option key={c.url} value={c.url}>{c.name}</option>)}</select></label>}<label className="full"><input type="checkbox" checked={form.share_details} onChange={e=>change('share_details',e.target.checked)}/> Partager les titres non privés de cet agenda avec l’équipe</label></div><button className="primary" disabled={busy}>{busy?'Connexion…':form.kind==='caldav'&&!choices.length?'Rechercher mes agendas':'Connecter cet agenda'}</button></form></section>;
}

export function InboundAttachments({message,api}){
 const [rows,setRows]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 async function run(id){setBusy(true);setError('');try{const r=await api('/api/team',{action:id===undefined?'attachment_list':'attachment_download',id:message.id,attachment_id:id});if(r.attachments)setRows(r.attachments);else {const a=document.createElement('a');a.href=r.url;a.rel='noopener';a.click();}}catch(e){setError(e.message);}finally{setBusy(false);}}
 return <section className="inbound-attachments"><button className="secondary" disabled={busy} onClick={()=>run()}>Voir les pièces jointes</button>{error&&<p className="error">{error}</p>}{rows?.length===0&&<p>Aucune pièce jointe.</p>}{rows?.map(a=><button className="secondary" key={a.id} disabled={busy||a.size>10485760} onClick={()=>run(a.id)}><Download size={15}/>{a.name} · {Math.ceil(a.size/1024)} Ko</button>)}<small>Les pièces téléchargées sont aussi conservées dans les Documents partagés (10 Mo maximum).</small></section>;
}
