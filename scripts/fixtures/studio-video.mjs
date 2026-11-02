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
 const image=document.createElement('canvas');image.width=100;image.height=100;image.getContext('2d').fillRect(0,0,100,100);
 window.__clips.image=await new Promise(ok=>image.toBlob(ok,'image/png'));
 const diapo=await assemblerClips([{id:'image',video:false,duree:0.7,titre:'Titre de la scène'}],'carre',()=>{},new AbortController().signal);
 assert(diapo.type==='video/webm'&&diapo.size>0,'Image fixe avec titre exportée');
 const lecteur=document.createElement('video');lecteur.muted=true;lecteur.src=URL.createObjectURL(diapo);document.body.append(lecteur);await new Promise((ok,non)=>{lecteur.onloadeddata=ok;lecteur.onerror=non});
 assert(lecteur.videoWidth===832&&lecteur.videoHeight===832,'Format carré');
 await new Promise((ok,non)=>{lecteur.onseeked=ok;lecteur.onerror=non;lecteur.currentTime=0.15});
 const titres=document.createElement('canvas');titres.width=832;titres.height=832;const tc=titres.getContext('2d');tc.drawImage(lecteur,0,0);const pixels=tc.getImageData(0,700,832,132).data;let blancs=0;for(let i=0;i<pixels.length;i+=4)if(pixels[i]>200&&pixels[i+1]>200&&pixels[i+2]>200)blancs++;assert(blancs>20,'Titre présent dans la vidéo décodée');
 const debutLecture=performance.now();await new Promise(async(ok,non)=>{lecteur.onended=ok;lecteur.onerror=non;await lecteur.play()});assert(performance.now()-debutLecture>450,'Durée de l’image fixe conservée');
 const coupe=await assemblerClips([{id:'rouge',video:true,debut:0.1,fin:0.3}],'paysage',()=>{},new AbortController().signal);assert(coupe.size>0,'Découpe du clip exportée');
 let mauvais=false;try{await assemblerClips([{id:'rouge',debut:2,fin:1}],'paysage',()=>{},new AbortController().signal)}catch{mauvais=true}assert(mauvais,'Découpe inversée refusée');
 const frequence=22050,n=frequence,onde=new ArrayBuffer(44+n*2),vue=new DataView(onde);const ascii=(debut,texte)=>[...texte].forEach((c,i)=>vue.setUint8(debut+i,c.charCodeAt(0)));
 ascii(0,'RIFF');vue.setUint32(4,36+n*2,true);ascii(8,'WAVE');ascii(12,'fmt ');vue.setUint32(16,16,true);vue.setUint16(20,1,true);vue.setUint16(22,1,true);vue.setUint32(24,frequence,true);vue.setUint32(28,frequence*2,true);vue.setUint16(32,2,true);vue.setUint16(34,16,true);ascii(36,'data');vue.setUint32(40,n*2,true);for(let i=0;i<n;i++)vue.setInt16(44+i*2,Math.round(Math.sin(i/frequence*440*Math.PI*2)*12000),true);
 window.__clips.son=new Blob([onde],{type:'audio/wav'});
 const sonore=await assemblerClips([{id:'image',video:false,duree:0.7}],'paysage',()=>{},new AbortController().signal,{audio:'son',volume:0.4});
 const audio=new AudioContext();try{const piste=await audio.decodeAudioData(await sonore.arrayBuffer());let maximum=0;for(const valeur of piste.getChannelData(0))maximum=Math.max(maximum,Math.abs(valeur));assert(maximum>0.02,'Bande sonore présente dans le fichier exporté')}finally{await audio.close()}
 const interruption=new AbortController();setTimeout(()=>interruption.abort(),250);let annule=false;try{await assemblerClips([{id:'image',video:false,duree:3}],'paysage',()=>{},interruption.signal)}catch(e){annule=e.name==='AbortError'}assert(annule,'Annulation pendant une image fixe honorée');
 output.textContent+='ESSAIS TERMINÉS';document.title='Essais vidéo réussis';
})().catch(e=>{output.textContent+='ERREUR '+e.stack;document.title='Échec vidéo'});
