import assert from "node:assert/strict";
import { build } from "esbuild";
import { createRequire } from "node:module";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
const dir = mkdtempSync(join(tmpdir(), "helix-scenario-"));
try {
  const fichier = join(dir, "scenario.cjs");
  await build({ entryPoints: [resolve("gateway/src/videosScenario.ts")], outfile: fichier, bundle: true, platform: "node", format: "cjs", logLevel: "silent",
    plugins: [{ name: "modele-factice", setup(b) {
      b.onResolve({ filter: /\.\/completion\.ts$/ }, () => ({ path: "modele", namespace: "essai" }));
      b.onLoad({ filter: /.*/, namespace: "essai" }, () => ({ contents: "export async function completer(messages, options) { globalThis.__optionsScenario = options; return globalThis.__reponseScenario; }" }));
    } }] });
  const m = createRequire(import.meta.url)(fichier);
  globalThis.__reponseScenario = { ok: true, texte: JSON.stringify({ scenes: ["Le produit apparaît.", "Le produit tourne.", "Plan final."] }) };
  assert.equal((await m.preparerScenario("Une tasse bleue", "essai")).length, 3);
  assert.equal(globalThis.__optionsScenario.localSeulement, true);
  assert.equal(globalThis.__optionsScenario.schema.schema.properties.scenes.maxItems, 3);
  for (const texte of ["pas du JSON", "null", '{"scenes":["une seule"]}', '{"scenes":["a",23,"b"]}', JSON.stringify({ scenes: ["a", "b", "x".repeat(2001)] })]) {
    globalThis.__reponseScenario = { ok: true, texte };
    await assert.rejects(m.preparerScenario("Une tasse bleue", "essai"));
  }
  globalThis.__reponseScenario = { ok: false, message: "Pas de modèle local" };
  await assert.rejects(m.preparerScenario("Une tasse bleue", "essai"));
  console.log("Scénario vidéo : sortie bornée, erreurs honorées et modèle local imposé.");
} finally { delete globalThis.__optionsScenario; delete globalThis.__reponseScenario; rmSync(dir, { recursive: true, force: true }); }
