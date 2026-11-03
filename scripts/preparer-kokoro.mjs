import {readFileSync,writeFileSync}from'node:fs';import{gzipSync}from'node:zlib';import{createHash}from'node:crypto';
const lire=n=>readFileSync(new URL('../gateway/ressources/kokoro/'+n,import.meta.url));
const verrou=lire('package-lock.json'),moteur=lire('moteur.mjs'),notices=lire('NOTICES.md');
writeFileSync(new URL('../gateway/src/kokoroRessources.ts',import.meta.url),'// Produit par scripts/preparer-kokoro.mjs depuis les ressources relisibles.\n'+Object.entries({VERROU_KOKORO:gzipSync(verrou).toString('base64'),SHA_VERROU_KOKORO:createHash('sha256').update(verrou).digest('hex'),MOTEUR_KOKORO:moteur.toString(),NOTICES_KOKORO:notices.toString()}).map(([k,v])=>`export const ${k}=${JSON.stringify(v)};`).join('\n')+'\n');
