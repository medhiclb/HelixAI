/** Moteur réel, uniquement sur machine jetable : poids publics épinglés, jamais de micro. */
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtempSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
if(process.env.HELIX_ESSAI_MACHINE_JETABLE!=='1')throw Error('Cet essai télécharge un moteur. Réserver à une machine jetable.');
const npm=process.env.npm_execpath;if(!npm||!existsSync(npm))throw Error('Lancer par npm run essai:kokoro-ci');
const d=mkdtempSync(join(tmpdir(),'helix-kokoro-ci-')),ancien=process.env.HELIX_DATA_DIR;process.env.HELIX_DATA_DIR=d;
try{
 await build({entryPoints:[resolve('gateway/src/kokoro.ts')],outfile:join(d,'module.mjs'),bundle:true,platform:'node',format:'esm',plugins:[{name:'instance-jetable',setup(b){b.onResolve({filter:/installationOpenClaw\.ts|deployment\.ts|langue\.ts$/},a=>({path:a.path,namespace:'jetable'}));b.onLoad({filter:/.*/,namespace:'jetable'},()=>({contents:`export const t=x=>x;export const autoProvisionEnabled=()=>true;export const npxPrive=()=>({node:${JSON.stringify(process.execPath)},dossier:${JSON.stringify(dirname(process.execPath))}});export const nodePriveInstallable=()=>null;export const assurerNodePrive=async()=>${JSON.stringify(npm)};`}));}}]});
 const v=await import(pathToFileURL(join(d,'module.mjs')).href);await v.preparerKokoro();assert.equal(v.etatKokoro().installee,true);
 const c=new AbortController(),p=v.parlerKokoro({texte:'Bonjour, parlez-moi de votre projet.',langue:'fr',vitesse:1},c.signal);
 await assert.rejects(v.parlerKokoro({texte:'Bonjour',langue:'fr',vitesse:1}),e=>e.statut===429);setTimeout(()=>c.abort(),100);await assert.rejects(p,e=>e.statut===499);
 const debut=Date.now();const son=await v.parlerKokoro({texte:'Bonjour. Pouvez-vous me présenter votre parcours et un projet dont vous êtes fier ?',langue:'fr',vitesse:1});assert.equal(son.subarray(0,4).toString(),'RIFF');assert.equal(son.readUInt32LE(24),24000);const duree=(son.length-44)/48000;assert.ok(duree>2&&duree<30);let energie=0;for(let i=44;i<son.length;i+=2)energie+=(son.readInt16LE(i)/32768)**2;const rms=Math.sqrt(energie/((son.length-44)/2));assert.ok(rms>.005&&rms<.9);
 const sortie=resolve(process.env.HELIX_ESSAI_SORTIE??'essai-voix-sortie');const{mkdirSync}=await import('node:fs');mkdirSync(sortie,{recursive:true});writeFileSync(join(sortie,'voix-francaise.wav'),son);writeFileSync(join(sortie,'resultat.json'),JSON.stringify({plateforme:process.platform,architecture:process.arch,duree,calculMs:Date.now()-debut,rms,annulation:true,concurrenceBornee:true},null,2));
 writeFileSync(join(d,'kokoro','v1-fr-1','ff_siwis.bin'),'altéré');await assert.rejects(v.parlerKokoro({texte:'Bonjour',langue:'fr',vitesse:1}),e=>e.statut===409);
 console.log('Installation, WAV français, annulation, concurrence et empreinte altérée : réussis.');
}finally{rmSync(d,{recursive:true,force:true});if(ancien===undefined)delete process.env.HELIX_DATA_DIR;else process.env.HELIX_DATA_DIR=ancien}
