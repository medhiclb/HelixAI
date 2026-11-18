import { postgresAccess } from "../lib/postgres-access.mjs";
import healthHandler from '../lib/health-handler.mjs';
import {draftWithHelix} from '../lib/helix-ai.mjs';
import {receiveSiteContact} from '../lib/site-contact.mjs';
import {inboundAttachments} from "../lib/inbound-attachments.mjs";
import {randomUUID} from 'node:crypto';
import {authorize,check,fail,AppError,encrypt} from '../lib/server.mjs';
import {calendarUrl,discoverCalendars,syncExternalCalendar} from '../lib/calendars.mjs';
const BUCKET='crm-documents';
export default async function handler(req,res) {
 if(req.query?.crm_route==='postgres_access')return postgresAccess(req,res);
 if(req.query?.crm_route==='health')return healthHandler(req,res);
 if(req.query?.crm_route==='site_contact')return receiveSiteContact(req,res);
 try {
 const auth=await authorize(req), {client,user,workspace}=auth,b=req.body;
 if(b.action==='ai_draft'){res.setHeader('Cache-Control','no-store');return res.json(await draftWithHelix(auth,b));}
 const table=(t)=>client.from(t);
 const audit=async(action,title,record_id=null)=>check(await table('crm_activity').insert({workspace_id:workspace,actor_id:user.id,action,entity:'documents',title,record_id}));
 if(b.action==='attachment_list'||b.action==='attachment_download')return res.json(await inboundAttachments({client,user,workspace},b.id,b.action==='attachment_download'?b.attachment_id:null));
 if(b.action==='file_begin') {
  const name=String(b.name||'').replace(/[\x00-\x1f/\\]/g,'_').trim();
  if(!name||name.length>180||!Number.isSafeInteger(b.size)||b.size<1||b.size>10485760)throw new AppError('Fichier invalide. Maximum : 10 Mo.');
  if(b.record_id&&!check(await table('crm_records').select('id').eq('workspace_id',workspace).eq('id',b.record_id).maybeSingle()))throw new AppError('Fiche introuvable.',404);
  const {count,error}=await table('crm_files').select('id',{count:'exact',head:true}).eq('workspace_id',workspace).neq('status','deleted');if(error)throw error;if(count>=2000)throw new AppError('Limite de 2 000 documents atteinte.');
  const bucket=await client.storage.getBucket(BUCKET);if(bucket.error){const c=await client.storage.createBucket(BUCKET,{public:false,fileSizeLimit:10485760});if(c.error&&String(c.error.statusCode)!=='409')throw c.error;}else if(bucket.data.public)throw new AppError('Le stockage des documents doit être privé.',503);
  const id=randomUUID(),path=workspace+'/'+id;
  check(await table('crm_files').insert({id,workspace_id:workspace,record_id:b.record_id||null,name,size:b.size,mime:'application/octet-stream',path,created_by:user.id}));
  const signed=await client.storage.from(BUCKET).createSignedUploadUrl(path,{upsert:false});if(signed.error)throw signed.error;
  return res.json({id,path,token:signed.data.token});
 }
 if(['file_commit','file_download','file_delete'].includes(b.action)) {
  const f=check(await table('crm_files').select('*').eq('workspace_id',workspace).eq('id',b.id).single());
  if(b.action==='file_commit') {if(f.created_by!==user.id||f.status!=='pending')throw new AppError('Validation refusée.',403);const result=await client.storage.from(BUCKET).download(f.path);if(result.error)throw result.error;if(result.data.size!==f.size)throw new AppError('La taille reçue ne correspond pas au document.');check(await table('crm_files').update({status:'ready'}).eq('id',f.id).eq('status','pending'));await audit('file_upload',f.name,f.record_id);return res.json({ok:true});}
  if(f.status!=='ready')throw new AppError('Document indisponible.',404);
  if(b.action==='file_delete') {check(await table('crm_files').update({status:'deleted',deleted_at:new Date().toISOString()}).eq('id',f.id));await audit('file_delete',f.name,f.record_id);return res.json({ok:true});}
  const result=await client.storage.from(BUCKET).createSignedUrl(f.path,60,{download:f.name});if(result.error)throw result.error;return res.json({url:result.data.signedUrl});
 }
 if(b.action==='mail_read') {
  const message=check(await table('crm_messages').select('collaboration_key').eq('workspace_id',workspace).eq('id',b.id).eq('deleted',false).single());
  check(await table('crm_mail_reads').upsert({workspace_id:workspace,user_id:user.id,message_key:message.collaboration_key,read_at:new Date().toISOString()}));return res.json({ok:true});
 }
 if(b.action==='calendar_sync_due'){const accounts=check(await table('crm_calendar_accounts').select('*').eq('workspace_id',workspace).eq('user_id',user.id));const results=await Promise.all(accounts.filter(a=>!a.last_sync_at||Date.now()-Date.parse(a.last_sync_at)>300000).map(async a=>{try{return {id:a.id,ok:true,...await syncExternalCalendar(client,a)};}catch{await table('crm_calendar_accounts').update({last_error:'Synchronisation impossible. Vérifiez les identifiants et le serveur.'}).eq('id',a.id);return {id:a.id,ok:false};}}));return res.json({ok:true,results});}
 if(b.action==='calendar_discover') {
  const settings={url:calendarUrl(b.url).href,username:String(b.username||''),password:String(b.password||'')};
  if(!settings.username||!settings.password||settings.password.length>1024)throw new AppError('Identifiants d’agenda requis.');
  const {calendars}=await discoverCalendars(settings);return res.json({calendars:calendars.map(c=>({url:c.url,name:typeof c.displayName==='string'?c.displayName:'Agenda'}))});
 }
 if(b.action==='calendar_add') {
  if(!['ics','caldav'].includes(b.kind))throw new AppError('Type d’agenda invalide.');
  const settings={url:calendarUrl(b.url).href,username:String(b.username||''),password:String(b.password||'')};
  let selected=settings.url;
  if(b.kind==='caldav'){const {calendars}=await discoverCalendars(settings);selected=calendars.find(c=>c.url===b.calendar_url)?.url;if(!selected)throw new AppError('Choisissez un agenda découvert.');}
  const account={id:randomUUID(),workspace_id:workspace,user_id:user.id,name:String(b.name||'Mon agenda').slice(0,100),kind:b.kind,encrypted_credentials:encrypt(settings),calendar_url:selected,share_details:b.share_details===true};
  const {count}=await table('crm_calendar_accounts').select('id',{count:'exact',head:true}).eq('workspace_id',workspace).eq('user_id',user.id);if(count>=5)throw new AppError('Maximum : cinq agendas externes par membre.');
  check(await table('crm_calendar_accounts').insert(account));
  try {const r=await syncExternalCalendar(client,account);return res.json({ok:true,...r});}catch(e){await table('crm_calendar_accounts').delete().eq('id',account.id);throw e;}
 }
 if(['calendar_sync','calendar_delete'].includes(b.action)) {
  const account=check(await table('crm_calendar_accounts').select('*').eq('workspace_id',workspace).eq('user_id',user.id).eq('id',b.id).single());
  if(b.action==='calendar_delete'){check(await table('crm_calendar_accounts').delete().eq('id',account.id));return res.json({ok:true});}
  return res.json({ok:true,...await syncExternalCalendar(client,account)});
 }
 throw new AppError('Action inconnue.');
 }catch(e){fail(res,e);}
}
