import assert from'node:assert/strict';import{build}from'esbuild';import{mkdtempSync,rmSync}from'node:fs';import{tmpdir}from'node:os';import{join,resolve}from'node:path';
const d=mkdtempSync(join(tmpdir(),'helix-voix-entretien-'));
try{
 await build({entryPoints:[resolve('src/lib/entretiens.ts')],outfile:join(d,'client.mjs'),bundle:true,platform:'node',format:'esm',plugins:[{name:'sans-passerelle',setup(b){b.onResolve({filter:/^\.\/(endpoint|i18n)$/},a=>({path:a.path,namespace:'double'}));b.onLoad({filter:/.*/,namespace:'double'},()=>({contents:'export const apiFetch=()=>{throw Error("aucun appel réseau attendu")};export const t=x=>x;'}));}}]});
 const v=await import(join(d,'client.mjs'));assert.equal(v.voixLocale('fr'),undefined);
 const distante={localService:false,lang:'fr-FR'},anglaise={localService:true,lang:'en-GB'},locale={localService:true,lang:'fr-FR'};let voix=[distante,anglaise,locale],phrase;
 globalThis.speechSynthesis={getVoices:()=>voix,cancel:()=>{},speak:p=>phrase=p};globalThis.SpeechSynthesisUtterance=class{constructor(text){this.text=text}};
 assert.equal(v.voixLocale('fr'),locale);v.lireQuestion('Présentez votre projet.','fr');assert.equal(phrase.voice,locale);assert.equal(phrase.lang,'fr-FR');voix=[distante];assert.throws(()=>v.lireQuestion('Question','fr'));assert.equal(v.voixLocale('en'),undefined);
 console.log('Entretien vocal : seules les voix locales de la langue choisie sont utilisées, aucun repli distant.');
}finally{delete globalThis.speechSynthesis;delete globalThis.SpeechSynthesisUtterance;rmSync(d,{recursive:true,force:true})}
