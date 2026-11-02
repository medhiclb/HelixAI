/** Les nouvelles routes face à une instance jetable, sans moteur du poste. */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { build } from "esbuild";
const root = resolve(import.meta.dirname, "..");
const d = mkdtempSync(join(tmpdir(), "helix-ajouts-http-"));
const port = await new Promise(ok => { const s = createServer(); s.listen(0, "127.0.0.1", () => { const p = s.address().port; s.close(() => ok(p)); }); });
let p;
let journal = "";
try {
  mkdirSync(join(d, "home"));
  writeFileSync(join(d, "profil.json"), JSON.stringify({ chiffrement: "fichier", autoProvision: false, backends: [{ id: "exo", enabled: false }, { id: "lmstudio", enabled: false }] }));
  await build({ entryPoints: [join(root, "gateway/src/index.ts")], outfile: join(d, "gateway.cjs"), bundle: true, platform: "node", format: "cjs", external: ["pg-native"], logLevel: "silent" });
  p = spawn(process.execPath, [join(d, "gateway.cjs")], { cwd: root, env: { ...process.env, HOME: join(d, "home"), USERPROFILE: join(d, "home"), HELIX_CONFIG: join(d, "profil.json"), HELIX_DATA_DIR: join(d, "data"), HELIX_WORKSPACE: join(d, "espace"), HELIX_GATEWAY_HOST: "127.0.0.1", HELIX_GATEWAY_PORT: String(port), HELIX_MEMOIRE_RESUME: "non" }, detached: true, stdio: ["ignore", "pipe", "pipe"] });
  p.stdout.on("data", b => journal += b); p.stderr.on("data", b => journal += b);
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 100; i++) { try { await fetch(base + "/health"); break; } catch { await new Promise(ok => setTimeout(ok, 100)); } }
  const token = readFileSync(join(d, "data/instance-token"), "utf8").trim();
  const h = { "Content-Type": "application/json", Authorization: `Bearer ${token}`, "X-Helix-Langue": "fr" };
  const q = (chemin, headers, corps) => fetch(base + chemin, { headers, ...(corps !== undefined ? { method: "POST", body: JSON.stringify(corps) } : {}) });
  const a = await (await q("/helix/auth/create", h, { fullName: "Essai", email: "essai@example.test", password: "Mot-de-passe-essai-2026!" })).json();
  assert.ok(a.session?.token, JSON.stringify(a));
  const admin = { ...h, "X-Helix-Session": a.session.token };
  for (const [route, corps] of [["/helix/provision/moteur/relancer", {}], ["/helix/optimisation-locale", undefined], ["/helix/optimisation-locale", { mode: "standard" }], ["/helix/optimisation-locale/conseil", {}], ["/helix/videos/scenario", { brief: "Une tasse" }]]) {
    assert.equal((await q(route, h, corps)).status, 401);
  }
  assert.equal((await q("/helix/provision/moteur/relancer", admin, {})).status, 403);
  const diagnostic = await (await q("/helix/optimisation-locale", admin)).json();
  assert.equal(diagnostic.admin, true); assert.equal(diagnostic.mode, "automatique");
  assert.equal((await q("/helix/optimisation-locale", admin, { mode: "commande arbitraire" })).status, 400);
  assert.equal((await q("/helix/optimisation-locale", admin, { mode: "standard" })).status, 200);
  assert.equal((await (await q("/helix/optimisation-locale", admin)).json()).mode, "standard");
  assert.equal((await q("/helix/optimisation-locale/conseil", admin, {})).status, 409);
  for (const brief of ["", "x".repeat(2001), 42]) assert.equal((await q("/helix/videos/scenario", admin, { brief })).status, 400);
  assert.equal((await q("/helix/videos/scenario", admin, { brief: "Une tasse bleue" })).status, 409);
  console.log("Routes : séance exigée, choix validé, réglage relu, absence de modèle local honorée.");
} catch (e) { console.error(journal.slice(-2000)); throw e; }
finally {
  if (p) { const fin = new Promise(ok => p.once("exit", ok)); try { process.kill(-p.pid, "SIGTERM"); } catch {} await Promise.race([fin, new Promise(ok => setTimeout(ok, 4000))]); }
  rmSync(d, { recursive: true, force: true });
}
