import {check} from './server.mjs';
export async function maintainFiles(client,now=new Date()){
 const cutoff=new Date(+now-9*864e5).toISOString(),pending=new Date(+now-864e5).toISOString();
 const rows=check(await client.from('crm_files').select('id,path').or(`and(status.eq.deleted,deleted_at.lt.${cutoff}),and(status.eq.pending,created_at.lt.${pending})`).limit(100));
 if(rows.length){const r=await client.storage.from('crm-documents').remove(rows.map(f=>f.path));if(r.error)throw r.error;check(await client.from('crm_files').delete().in('id',rows.map(f=>f.id)));}
 return {purged:rows.length,retention_days:9};
}
