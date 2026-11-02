/** SSH doublé : aucun accès à un vrai serveur ni à une clé du poste. */
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdtempSync,rmSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
const d=mkdtempSync(join(tmpdir(),'helix-vps-'));
try{
 await build({entryPoints:[resolve('gateway/src/vps.ts')],outfile:join(d,'vps.mjs'),bundle:true,platform:'node',format:'esm',plugins:[{name:'isolé',setup(b){
 b.onResolve({filter:/^\.\/(db|roles|langue)\.ts$|^node:child_process$/},a=>({path:a.path,namespace:'double'}));
 b.onLoad({filter:/.*/,namespace:'double'},a=>({contents:a.path==='node:child_process'?`import {EventEmitter}from'node:events';export function spawn(exe,args,options){globalThis.__ssh={exe,args,options};const p=new EventEmitter();p.stdout=new EventEmitter();p.stderr=new EventEmitter();p.kill=()=>queueMicrotask(()=>p.emit('close',null));queueMicrotask(()=>{p.stdout.emit('data',Buffer.from('/srv/projet\\n'));p.emit('close',0)});return p}`:`export const db=()=>({read:async()=>{if(globalThis.__casse)throw Error('illisible');return globalThis.__vps},write:async(_,v)=>{globalThis.__vps=structuredClone(v)}});export const estAdministrateur=async id=>id==='alice';export const t=x=>x;`}));
 }}]});
 const v=await import(join(d,'vps.mjs'));globalThis.__vps=[];
 const valide={nom:'Projet',hote:'dev@serveur.example',port:2222,dossier:"/srv/mon projet's"};
 for(const hote of ['-oProxyCommand=evil','host;touch /tmp/piege','ssh://host','user@host\ncommande','a@b@c'])assert.throws(()=>v.validerVps({...valide,hote}));
 for(const dossier of ['relatif','/srv/a\ncommande','/srv/\0'])assert.throws(()=>v.validerVps({...valide,dossier}));
 await assert.rejects(v.enregistrerVps('bob',valide));const p=await v.enregistrerVps('alice',valide);
 assert.equal((await v.projetsVps('bob')).length,0);assert.equal((await v.executerVps('bob',{serveur:p.id,commande:'ls'})).ok,false);
 assert.equal((await v.executerVps('alice',{serveur:'absent',commande:'ls'})).ok,false);
 assert.equal((await v.executerVps('alice',{serveur:p.id,commande:'git status'})).ok,true);
 const {args,options}=globalThis.__ssh;assert.ok(args.includes('StrictHostKeyChecking=yes'));assert.ok(args.includes('BatchMode=yes'));assert.ok(args.includes('ClearAllForwardings=yes'));assert.ok(args.includes('-a'));assert.equal(args.at(-2),valide.hote);assert.equal(args.at(-1),"cd -- '/srv/mon projet'\\''s' && git status");assert.equal(options.env.HELIX_TOKEN,undefined);
 assert.equal((await v.testerVps('alice',p.id)).ok,true);globalThis.__casse=true;await assert.rejects(v.enregistrerVps('alice',valide));assert.equal(globalThis.__vps.length,1);globalThis.__casse=false;
 await v.retirerVps('bob',p.id);assert.equal(globalThis.__vps.length,1);await v.oublierVps('alice');assert.equal(globalThis.__vps.length,0);
 console.log('VPS : propriétaire, hôte et chemins validés, citation shell, serveur reconnu requis, agent non transféré, environnement borné, registre illisible préservé.');
}finally{for(const k of ['__vps','__ssh','__casse'])delete globalThis[k];rmSync(d,{recursive:true,force:true})}
