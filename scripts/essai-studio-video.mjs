/** Ouvrir l'adresse affichée et cliquer « Lancer » pour vérifier le véritable export WebM. */
import { build } from "esbuild";
import { createServer } from "node:http";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
const dossier = mkdtempSync(join(tmpdir(), "helix-studio-video-"));
await build({ entryPoints: [resolve(import.meta.dirname, "fixtures/studio-video.mjs")], outfile: join(dossier, "test.js"), bundle: true, platform: "browser", format: "esm",
  plugins: [{ name: "doublures", setup(b) {
    b.onResolve({ filter: /store\/(identity|projects)$|\/endpoint$|\/i18n$/ }, a => ({ path: a.path, namespace: "double" }));
    b.onLoad({ filter: /.*/, namespace: "double" }, () => ({ contents: "export const currentUser=()=>({id:'essai'});export const getProject=()=>null;export const updateProject=()=>{};export const t=x=>x;export const apiFetch=async url=>{const id=url.split('/').pop();return window.__clips[id]?new Response(window.__clips[id]):new Response('',{status:404})};" }));
  } }] });
const serveur = createServer((req, res) => {
  if (req.url === "/test.js") { res.setHeader("Content-Type", "text/javascript"); res.end(readFileSync(join(dossier, "test.js"))); return; }
  if (req.url !== "/") { res.writeHead(404); res.end(); return; }
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.end('<html lang="fr"><title>Essai du studio vidéo</title><meta charset="utf-8"><button>Lancer les essais vidéo</button><script type="module">document.querySelector("button").onclick=()=>import("/test.js")</script></html>');
});
serveur.listen(0, "127.0.0.1", () => console.log(`Ouvrir http://127.0.0.1:${serveur.address().port}/ et lancer les essais. Ctrl+C arrête le serveur.`));
const nettoyer = () => { serveur.close(); rmSync(dossier, { recursive: true, force: true }); process.exit(); };
process.on("SIGINT", nettoyer); process.on("SIGTERM", nettoyer);
