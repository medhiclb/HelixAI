import {AppError,check} from './server.mjs';
export async function loadAttachments(client,workspace,ids=[]) {
 if(!Array.isArray(ids)||ids.length>10||new Set(ids).size!==ids.length)throw new AppError('Maximum : dix pièces jointes distinctes.');
 if(!ids.length)return [];
 const files=check(await client.from('crm_files').select('*').eq('workspace_id',workspace).eq('status','ready').in('id',ids));
 if(files.length!==ids.length)throw new AppError('Une pièce jointe est indisponible.');
 if(files.reduce((n,f)=>n+Number(f.size),0)>2*1024*1024)throw new AppError('Maximum : 2 Mo de pièces jointes par message.');
 return Promise.all(files.map(async f=>{const r=await client.storage.from('crm-documents').download(f.path);if(r.error)throw r.error;return {filename:f.name,content:Buffer.from(await r.data.arrayBuffer()),contentType:f.mime};}));
}
