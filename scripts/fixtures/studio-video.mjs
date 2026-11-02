/** Deux clips artificiels : aucun modèle ni fichier de la personne. */
import {assemblerClips} from '../../src/lib/studioVideo.ts';
const output=document.createElement('pre');document.body.append(output);
const assert=(v,texte)=>{if(!v)throw new Error(texte);output.textContent+='✓ '+texte+'\n'};
const faire=async couleur=>{const c=document.createElement('canvas');c.width=160;c.height=90;const ctx=c.getContext('2d');ctx.fillStyle=couleur;ctx.fillRect(0,0,160,90);const s=c.captureStream(12),r=new MediaRecorder(s,{mimeType:'video/webm'}),chunks=[];const fin=new Promise(ok=>{r.ondataavailable=e=>chunks.push(e.data);r.onstop=()=>ok(new Blob(chunks,{type:'video/webm'}))});r.start();for(let i=0;i<6;i++){ctx.fillRect(0,0,160,90);await new Promise(ok=>setTimeout(ok,80))}r.stop();const b=await fin;s.getTracks().forEach(t=>t.stop());return b};
(async()=>{
 window.__clips={rouge:await faire('red'),bleu:await faire('blue')};
 const ordre=[];const b=await assemblerClips(['rouge','bleu'],'paysage',r=>ordre.push(r),new AbortController().signal);
 assert(b.size>1000,'WebM produit');assert(ordre.join(',')==='1,2','Ordre des deux scènes conservé');
 const v=document.createElement('video');v.controls=true;v.muted=true;v.src=URL.createObjectURL(b);document.body.append(v);await new Promise((ok,non)=>{v.onloadeddata=ok;v.onerror=non});
 assert(v.videoWidth===832&&v.videoHeight===480,'Dimensions paysage');
 const c=document.createElement('canvas');c.width=1;c.height=1;const ctx=c.getContext('2d');const couleurs=[];
 await new Promise(async(ok,non)=>{v.onended=ok;v.onerror=non;const lire=()=>{ctx.drawImage(v,0,0,1,1);const [r,g,b]=ctx.getImageData(0,0,1,1).data;couleurs.push([r,g,b]);if(!v.ended)v.requestVideoFrameCallback(lire)};v.requestVideoFrameCallback(lire);await v.play()});
 assert(couleurs.some(([r,g,b])=>r>150&&b<100)&&couleurs.some(([r,g,b])=>b>150&&r<100),'Les deux clips sont décodés dans le résultat');
 const arret=new AbortController();arret.abort();let refuse=false;try{await assemblerClips(['rouge'],'portrait',()=>{},arret.signal)}catch(e){refuse=e.name==='AbortError'}assert(refuse,'Annulation honorée');
 let absent=false;try{await assemblerClips(['inconnu'],'paysage',()=>{},new AbortController().signal)}catch{absent=true}assert(absent,'Un clip absent arrête l’export');
 output.textContent+='ESSAIS TERMINÉS';document.title='Essais vidéo réussis';
})().catch(e=>{output.textContent+='ERREUR '+e.stack;document.title='Échec vidéo'});
