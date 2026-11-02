import assert from 'node:assert/strict';import{build}from'esbuild';import{mkdtempSync,rmSync}from'node:fs';import{tmpdir}from'node:os';import{join,resolve}from'node:path';
const d=mkdtempSync(join(tmpdir(),'helix-collage-'));
try{
 await build({entryPoints:[resolve('src/lib/pressePapierImages.ts')],outfile:join(d,'collage.mjs'),bundle:true,platform:'node',format:'esm'});
 const{imagesDuCollage}=await import(join(d,'collage.mjs'));
 const image=new File(['image'],'capture.png',{type:'image/png'});const element={kind:'file',type:'image/png',getAsFile:()=>image};
 assert.deepEqual(imagesDuCollage({items:[element],files:[image]}),[image]);
 assert.deepEqual(imagesDuCollage({items:[],files:[image]}),[image]);
 assert.deepEqual(imagesDuCollage({items:[{kind:'string',type:'text/plain'}],files:[]}),[]);
 assert.deepEqual(imagesDuCollage({items:[],files:[new File(['texte'],'a.txt',{type:'text/plain'})]}),[]);
 assert.deepEqual(imagesDuCollage({items:[{...element,getAsFile:()=>null}],files:[image]}),[image]);
 console.log('Collage : image unique, repli fichiers, texte et fichiers non image laissés au collage habituel.');
}finally{rmSync(d,{recursive:true,force:true})}
