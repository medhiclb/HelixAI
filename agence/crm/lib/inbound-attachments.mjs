import {access,check,decrypt,jsonFetch,AppError} from './server.mjs';
import {imapAttachments} from './imap.mjs';
import {stableId} from './crm.mjs';
export async function inboundAttachments(ctx,messageId,attachmentId=null) {
 const m=check(await ctx.client.from('crm_messages').select('*').eq('workspace_id',ctx.workspace).eq('id',messageId).eq('deleted',false).single());
 if(!m.shared&&m.user_id!==ctx.user.id)throw new AppError('Message privé.',403);
 const c=check(await ctx.client.from('crm_connections').select('*').eq('workspace_id',ctx.workspace).eq('user_id',m.user_id).eq('provider',m.provider).single());
 if(!check(await ctx.client.from('crm_members').select('user_id').eq('workspace_id',ctx.workspace).eq('user_id',m.user_id).maybeSingle()))throw new AppError('Compte déconnecté.',403);
 let list,fetchContent;
 if(c.provider==='imap'){
  const settings=decrypt(c.encrypted_tokens);list=await imapAttachments(settings,m);fetchContent=async a=>(await imapAttachments(settings,m,Number(a.id)))?.content;
 } else {
  const token=await access(ctx.client,c),headers={Authorization:`Bearer ${token}`};
  if(c.provider==='google') {
   const base='https://gmail.googleapis.com/gmail/v1/users/me/messages/'+encodeURIComponent(m.external_id);
   const result=await jsonFetch(base+'?format=full',{headers});list=[];
   const walk=p=>{if(p.filename&&p.body?.attachmentId)list.push({id:p.body.attachmentId,name:p.filename,size:p.body.size,mime:p.mimeType});for(const child of p.parts||[])walk(child);};walk(result.payload);
   fetchContent=async a=>Buffer.from((await jsonFetch(base+'/attachments/'+encodeURIComponent(a.id),{headers})).data,'base64url');
  }else{
   const base='https://graph.microsoft.com/v1.0/me/messages/'+encodeURIComponent(m.external_id)+'/attachments';
   list=[];let url=base+'?$select=id,name,size,contentType,isInline&$top=100';
   for(let page=0;url;page++){if(page>=10)throw new AppError('Trop de pièces jointes.');if(!url.startsWith('https://graph.microsoft.com/v1.0/'))throw new AppError('Pagination fournisseur invalide.');const r=await jsonFetch(url,{headers});list.push(...r.value.filter(a=>a['@odata.type']==='#microsoft.graph.fileAttachment').map(a=>({id:a.id,name:a.name,size:a.size,mime:a.contentType})));url=r['@odata.nextLink'];}
   fetchContent=async a=>Buffer.from((await jsonFetch(base+'/'+encodeURIComponent(a.id),{headers})).contentBytes,'base64');
  }
 }
 if(attachmentId===null)return {attachments:list};
 const a=list.find(x=>x.id===String(attachmentId));if(!a||a.size>10485760)throw new AppError('Pièce jointe introuvable ou supérieure à 10 Mo.');
 const id=stableId('attachment:'+m.id+':'+a.id),path=ctx.workspace+'/'+id;
 const old=check(await ctx.client.from('crm_files').select('*').eq('id',id).maybeSingle());
 if(old?.status==='deleted')throw new AppError('Cette pièce jointe a été supprimée des Documents.');
 if(old?.status!=='ready') {
  const bytes=await fetchContent(a);if(!bytes?.length||bytes.length>10485760)throw new AppError('Contenu indisponible ou trop volumineux.');
  const bucket=await ctx.client.storage.getBucket('crm-documents');if(bucket.error){const r=await ctx.client.storage.createBucket('crm-documents',{public:false,fileSizeLimit:10485760});if(r.error&&String(r.error.statusCode)!=='409')throw r.error;}else if(bucket.data.public)throw new AppError('Stockage non privé.',503);
  const uploaded=await ctx.client.storage.from('crm-documents').upload(path,bytes,{upsert:false,contentType:'application/octet-stream'});if(uploaded.error&&String(uploaded.error.statusCode)!=='409')throw uploaded.error;
  const saved=await ctx.client.from('crm_files').upsert({id,workspace_id:ctx.workspace,record_id:m.cabinet_id,name:String(a.name||'Pièce jointe').replace(/[\x00-\x1f/\\]/g,'_').slice(0,180),size:bytes.length,mime:'application/octet-stream',path,created_by:ctx.user.id,status:'ready'},{onConflict:'id',ignoreDuplicates:true});if(saved.error)throw saved.error;
 }
 const signed=await ctx.client.storage.from('crm-documents').createSignedUrl(path,60,{download:a.name});if(signed.error)throw signed.error;return {url:signed.data.signedUrl};
}
