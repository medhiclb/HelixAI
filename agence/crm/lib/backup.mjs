import {gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {check,AppError} from './crm.mjs';
export async function backupBusinessData(client,now=new Date()) {
 const data=check(await client.rpc('crm_business_backup'));
 const tables=Object.keys(data).filter(k=>k.startsWith('crm_'));
 const manifest={format:'helix-crm-business-v1',created_at:now.toISOString(),tables:Object.fromEntries(tables.map(t=>[t,data[t].length])),scope:'CRM business tables and auth identity references; no Auth sessions, passwords or Vercel secrets'};
 const raw=Buffer.from(JSON.stringify({manifest,data}));
 if(raw.length>50*1024*1024)throw new AppError('Sauvegarde trop volumineuse pour la tâche automatique. Un export séparé est nécessaire.',503);
 const compressed=gzipSync(raw);
 if(compressed.length>10*1024*1024)throw new AppError('Sauvegarde compressée trop volumineuse. Un export séparé est nécessaire.',503);
 const existing=await client.storage.getBucket('crm-backups');
 if(existing.error) {
  const created=await client.storage.createBucket('crm-backups',{public:false,fileSizeLimit:10*1024*1024,allowedMimeTypes:['application/gzip']});
  if(created.error && !['409','BucketAlreadyExists'].includes(String(created.error.statusCode || created.error.code)))throw created.error;
 } else if(existing.data.public)throw new AppError('La sauvegarde refuse un espace de stockage public.',503);
 const path=`daily/day-${now.getUTCDay()}.json.gz`;
 const result=await client.storage.from('crm-backups').upload(path,compressed,{contentType:'application/gzip',upsert:true,cacheControl:'0'});
 if(result.error)throw result.error;
 return {ok:true,path,created_at:manifest.created_at,sha256:createHash('sha256').update(compressed).digest('hex'),bytes:compressed.length,retention:'7 rolling daily snapshots',scope:manifest.scope};
}
