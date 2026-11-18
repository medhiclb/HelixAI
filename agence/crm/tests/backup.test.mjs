import test from 'node:test';import assert from 'node:assert/strict';import {gunzipSync} from 'node:zlib';
import {backupBusinessData} from '../lib/backup.mjs';
test('sauvegarde automatique : stockage privé, fichier lisible et rotation sur sept jours',async()=>{
 let saved;
 const client={rpc:async()=>({data:{crm_workspaces:[{id:'w'}],crm_records:[{id:'n',data:{name:'Dossier'}}],_auth_identities:[]},error:null}),storage:{getBucket:async()=>({data:{public:false},error:null}),from:()=>({upload:async(path,bytes,options)=>{saved={path,bytes,options};return{data:{path},error:null};}})}};
 const result=await backupBusinessData(client,new Date('2026-11-14T05:00:00Z'));
 assert.equal(result.ok,true);assert.equal(saved.path,'daily/day-6.json.gz');assert.equal(saved.options.upsert,true);
 const restored=JSON.parse(gunzipSync(saved.bytes));assert.equal(restored.data.crm_records[0].data.name,'Dossier');assert.equal(restored.manifest.tables.crm_records,1);
 client.storage.getBucket=async()=>({data:{public:true},error:null});await assert.rejects(backupBusinessData(client),/public/);
});
