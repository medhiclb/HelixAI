/** Résolution sur des configurations différentes, sans moteur du poste. */
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
const d=mkdtempSync(join(tmpdir(),'helix-modeles-code-'));
try {
 await build({entryPoints:[resolve('gateway/src/router.ts')],outfile:join(d,'router.mjs'),bundle:true,platform:'node',format:'esm',plugins:[{name:'configuration-jetable',setup(b){
 b.onResolve({filter:/^\.\/(backends|deployment|santeModeles|langue)\.ts$/},a=>({path:a.path,namespace:'double'}));
 b.onLoad({filter:/.*/,namespace:'double'},()=>({contents:`export const discover=async()=>({models:globalThis.__modeles});export const backendById=id=>({id,priority:1});export const pinnedModel=()=>globalThis.__impose;export const estDefaillant=()=>false;export const t=x=>x;export const tf=(x,...v)=>x.replace(/\\{(\\d+)\\}/g,(_,n)=>v[n]);`}));
 }}]});
 const {resolve:choisir,invalidate}=await import(join(d,'router.mjs'));
 const modele=(id,roles,autres={})=>({id,uid:id,roles,backendId:'local',backendKind:'lmstudio',backendLabel:'Local',loaded:true,...autres});
 const cas=async(modeles,opts={})=>{globalThis.__modeles=modeles;invalidate();return choisir({role:'code',...opts})};
 const local=modele('modele-sans-coder',['chat']);
 assert.equal((await cas([local])).model.id,local.id);
 assert.equal((await cas([local,modele('specialiste',['code'])])).model.id,'specialiste');
 assert.ok((await cas([modele('vecteurs',['embedding'])])).error);
 assert.ok((await cas([modele('payant',['chat'],{origine:'cle',proprietaire:'alice'})],{acces:'alice'})).error);
 assert.ok((await cas([modele('prive',['chat'],{proprietaire:'alice'})],{acces:'bob'})).error);
 globalThis.__impose='absent';assert.ok((await cas([local])).error);globalThis.__impose=undefined;
 assert.equal((await cas([local],{model:local.id})).model.id,local.id);
 globalThis.__modeles=[modele('qwen2.5-coder',['chat','code']),modele('qwen2.5-instruct',['chat'],{loaded:false})];invalidate();assert.equal((await choisir({role:'chat'})).model.id,'qwen2.5-instruct');assert.equal((await choisir({role:'code'})).model.id,'qwen2.5-coder');assert.equal((await choisir({role:'chat',model:'qwen2.5-coder'})).model.id,'qwen2.5-coder');globalThis.__modeles=[modele('qwen2.5-coder',['chat','code'])];invalidate();assert.equal((await choisir({role:'chat'})).model.id,'qwen2.5-coder');
 console.log('Code : modèle local générique, spécialiste prioritaire, embeddings exclus, clés et propriétaire respectés, profil imposé conservé.');
}finally{delete globalThis.__modeles;delete globalThis.__impose;rmSync(d,{recursive:true,force:true})}
