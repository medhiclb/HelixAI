import assert from 'node:assert/strict';
import {build} from 'esbuild';
import{mkdtempSync,rmSync}from'node:fs';import{tmpdir}from'node:os';import{join,resolve}from'node:path';
const d=mkdtempSync(join(tmpdir(),'helix-permissions-vps-'));
try{
await build({entryPoints:[resolve('gateway/src/permissionsCode.ts')],outfile:join(d,'permissions.mjs'),bundle:true,platform:'node',format:'esm',plugins:[{name:'registre-isolé',setup(b){b.onResolve({filter:/^\.\/(approbation|audit|sessionsCode|langue|zonesProtegees)\.ts$/},a=>({path:a.path,namespace:'double'}));b.onLoad({filter:/.*/,namespace:'double'},()=>({contents:`export const annuler=()=>{};export const fermerDemande=()=>{};export const modifie=()=>true;export const ouvrirDemande=()=>'';export const verifierOutil=async()=>{globalThis.__cartes++;return{autorise:true}};export const journaliser=()=>{};export const sessionCode=async id=>globalThis.__sessions[id];export const t=x=>x;export const tf=x=>x;export const cheminReel=x=>x;export const estProtege=()=>false;`}));}}]});
const{traiterPermissionCode}=await import(join(d,'permissions.mjs'));globalThis.__sessions={distante:{userId:'alice',vps:'serveur'},locale:{userId:'alice'}};globalThis.__cartes=0;
for(const permission of ['bash','read','write','edit','apply_patch','glob','grep','list','external_directory']){
 let reponse;await traiterPermissionCode({id:'permission',sessionID:'distante',permission,patterns:['/srv/projet'],metadata:{command:'pwd'}},'distante','/tmp',r=>reponse=r);assert.equal(reponse.reply,'reject',permission);
}
let reponse;await traiterPermissionCode({id:'permission',sessionID:'enfant',permission:'bash',patterns:['pwd'],metadata:{command:'pwd'}},'distante','/tmp',r=>reponse=r);assert.equal(reponse.reply,'reject');assert.equal(globalThis.__cartes,0);
await traiterPermissionCode({id:'permission',sessionID:'locale',permission:'bash',patterns:['pwd'],metadata:{command:'pwd'}},'locale','/tmp',r=>reponse=r);assert.equal(reponse.reply,'once');assert.equal(globalThis.__cartes,1);
console.log('VPS : outils locaux refusés avant toute carte, héritage du parent, permissions locales conservées.');
}finally{delete globalThis.__sessions;delete globalThis.__cartes;rmSync(d,{recursive:true,force:true})}
