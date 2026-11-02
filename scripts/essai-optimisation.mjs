/** Profil et conseil local : pas de modèle réel, pas de service cloud. */
import assert from "node:assert/strict";
import { build } from "esbuild";
import { mkdtempSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { createRequire } from "node:module";
const dossier = mkdtempSync(join(tmpdir(), "helix-optimisation-"));
try {
  const cible = join(dossier, "optimisation.cjs");
  await build({ entryPoints: [resolve("gateway/src/optimisationLocale.ts")], outfile: cible, bundle: true, platform: "node", format: "cjs", external: ["pg-native"], logLevel: "silent" });
  const m = createRequire(import.meta.url)(cible);
  assert.deepEqual(m.optionsOptimisees(["--context-length", "32768", "--parallel", "2", "--gpu", "off"], "automatique"), ["--context-length", "32768", "--parallel", "1", "--gpu", "off"]);
  assert.deepEqual(m.optionsOptimisees(["--parallel", "2"], "standard"), ["--parallel", "2"]);
  assert.deepEqual(m.optionsOptimisees([], "automatique"), ["--parallel", "1"]);
  const b = { id: "essai", kind: "lmstudio", baseUrl: "http://127.0.0.1:1234/v1" };
  assert.equal(m.backendLocalSur(b), true);
  for (const baseUrl of ["https://cloud.example/v1", "http://127.0.0.1.evil.example/v1", "file:///etc/passwd", "http://secret@localhost/v1", "invalide"]) assert.equal(m.backendLocalSur({ ...b, baseUrl }), false);
  assert.equal(m.backendLocalSur({ ...b, kind: "openai-compatible" }), false);
  assert.equal(m.backendLocalSur({ ...b, enabled: false }), false);
  const hw = { totalMemoryGb: 16, cpuCount: 8, appleSilicon: true, platform: "darwin", arch: "arm64" };
  assert.equal(m.diagnosticOptimisation(hw).calcul, "apple");
  const initial = globalThis.fetch;
  const demandes = [];
  globalThis.fetch = async (url, options) => {
    demandes.push({ url, options });
    if (url.endsWith('/models')) return Response.json({ models: [{ type: "llm", loaded_instances: [{ id: "modele-essai", config: { context_length: 32768 } }] }] });
    const corps = JSON.parse(options.body);
    assert.equal(corps.tools, undefined);
    assert.equal(corps.model, "modele-essai");
    return Response.json({ choices: [{ message: { content: "Conseil local témoin." } }], usage: { completion_tokens: 40 } });
  };
  try {
    const conseil = await m.demanderConseilLocal([{ ...b, baseUrl: "https://cloud.example/v1" }, b], hw);
    assert.equal(conseil.conseil, "Conseil local témoin.");
    assert.equal(conseil.jetons, 40);
    assert.equal(demandes.length, 2);
    assert.ok(demandes.every(d => new URL(d.url).hostname === "127.0.0.1" && d.options.redirect === "error"));
    await assert.rejects(m.demanderConseilLocal([{ ...b, baseUrl: "https://cloud.example/v1" }], hw));
    assert.equal(demandes.length, 2);
  } finally { globalThis.fetch = initial; }
  console.log("Optimisation : contrôles réussis, aucun appel cloud et aucun outil exécuté.");
} finally { rmSync(dossier, { recursive: true, force: true }); }
