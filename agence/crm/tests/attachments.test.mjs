import test from 'node:test';import assert from 'node:assert/strict';
import {loadAttachments} from '../lib/attachments.mjs';
function fake(files){const seen=[];const q={select(){return this},eq(k,v){seen.push([k,v]);return this},in(){return Promise.resolve({data:files,error:null})}};return {seen,from:()=>q,storage:{from:()=>({download:async()=>({data:new Blob(['abc']),error:null})})}};}
test('pièces jointes : fichiers limités à l’espace et au statut prêt, pas de chemin fourni par le client',async()=>{
 const c=fake([{id:'one',path:'private/id',name:'accord.pdf',mime:'application/octet-stream',size:3}]);
 const r=await loadAttachments(c,'workspace',['one']);assert.equal(r[0].content.toString(),'abc');assert.deepEqual(c.seen,[['workspace_id','workspace'],['status','ready']]);
 await assert.rejects(loadAttachments(fake([]),'workspace',['other-space']),/indisponible/);
 await assert.rejects(loadAttachments(c,'workspace',['one','one']),/distinctes/);
 await assert.rejects(loadAttachments(fake([{size:3*1024*1024}]),'workspace',['big']),/2 Mo/);
});
