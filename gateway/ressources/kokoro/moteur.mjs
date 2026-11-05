/** Calcul séparé : aucun texte dans les arguments, journaux ou fichiers temporaires. */
import { readFileSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import * as ort from 'onnxruntime-web';
import initialiser from '@echogarden/espeak-ng-emscripten';
const espeak=await initialiser();
const prononciation=new espeak.eSpeakNGWorker();
if(prononciation.set_voice('fr')!==0)throw Error('voix française absente');
// Le runtime WASM ne charge que ses fichiers voisins. Aucun modèle ni voix par URL.
ort.env.wasm.numThreads=Math.max(1,Math.min(4,availableParallelism()));
ort.env.wasm.proxy=false;
const dossier=process.argv[2];
const vocab=JSON.parse(readFileSync(`${dossier}/tokenizer.json`,'utf8')).model.vocab;
const voixBrute=readFileSync(`${dossier}/ff_siwis.bin`);
const voix=new Float32Array(voixBrute.buffer.slice(voixBrute.byteOffset,voixBrute.byteOffset+voixBrute.byteLength));
const session=await ort.InferenceSession.create(new Uint8Array(readFileSync(`${dossier}/model_quantized.onnx`)),{executionProviders:['wasm'],graphOptimizationLevel:'all'});
let entree='';for await(const b of process.stdin){entree+=b;if(entree.length>16000)throw Error('taille');}
const {texte,vitesse}=JSON.parse(entree);
// Segments courts : aucune troncature silencieuse des mots ou des phonèmes.
const segments=texte.match(/[^.!?\n]+[.!?]?/gu)??[];
const sons=[];let taille=0;
async function produire(phrase){
 const phones=prononciation.synthesize_ipa(phrase).ipa.replace(/_/g,'').replace(/\n/g,' ').trim().normalize('NFC');
 const ids=Array.from(phones).map(c=>vocab[c]).filter(n=>Number.isInteger(n));
 if(ids.length>500){const mots=phrase.trim().split(/\s+/u);if(mots.length<2)throw Error('segment');const milieu=Math.ceil(mots.length/2);await produire(mots.slice(0,milieu).join(' '));await produire(mots.slice(milieu).join(' '));return;}
 if(!ids.length)return;
 const style=voix.slice(Math.min(ids.length,509)*256,(Math.min(ids.length,509)+1)*256);
 const r=await session.run({input_ids:new ort.Tensor('int64',BigInt64Array.from([0,...ids,0],BigInt),[1,ids.length+2]),style:new ort.Tensor('float32',style,[1,256]),speed:new ort.Tensor('float32',Float32Array.of(vitesse),[1])});
 const onde=r.waveform??Object.values(r)[0];const son=Float32Array.from(onde.data);taille+=son.length;if(taille>24000*240)throw Error('duree');sons.push(son);
 for(const x of Object.values(r))x.dispose();
}
for(const phrase of segments)await produire(phrase);
if(!taille)throw Error('vide');
const wav=Buffer.alloc(44+taille*2);wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(24000,24);wav.writeUInt32LE(48000,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(taille*2,40);let i=44;for(const son of sons)for(const x of son){wav.writeInt16LE(Math.round(Math.max(-1,Math.min(1,Number.isFinite(x)?x:0))*32767),i);i+=2;}
await session.release();process.stdout.write(wav);
