/** Démarrages lents, refus transitoires et port mémorisé : aucun moteur réel n'est lancé. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { transform, build } from "esbuild";
import vm from "node:vm";
import path from "node:path";
const aide = await build({ entryPoints: ["gateway/src/demarrageLmStudio.ts"], bundle: true, platform: "node", format: "cjs", write: false, logLevel: "silent" });
const exportsAide = { exports: {} };
vm.runInNewContext(aide.outputFiles[0].text, { module: exportsAide, exports: exportsAide.exports, URL, Date, setTimeout });
const { portServeurLocal, attendreEcoute } = exportsAide.exports;
assert.equal(portServeurLocal("http://127.0.0.1:1234/v1"), 1234);
assert.equal(portServeurLocal("http://[::1]:2345/v1"), 2345);
for (const adresse of ["https://localhost/v1", "http://localhost.evil.test/v1", "http://cle@localhost/v1", "http://example.test/v1", "faux"]) assert.equal(portServeurLocal(adresse), null);
let sondes = 0;
assert.equal(await attendreEcoute(async () => ++sondes > 8, async () => {}, 15), true);
assert.equal(sondes, 9);
assert.equal(await attendreEcoute(async () => false, async () => {}, 3), false);
const source = readFileSync("gateway/src/backends.ts", "utf8");
const morceau = source.slice(source.indexOf("const LMSTUDIO_URL ="), source.indexOf("/** Modèles que cette instance a chargés"));
const compile = await transform(morceau, { loader: "ts", format: "cjs" });
function banc({ adresse = "http://127.0.0.1:1234/v1", deja = false, retard = 0, refus = false, serviceEnPanne = false, enMarcheApresRefus = false } = {}) {
  const commandes = []; let commence = false; let lectures = 0; let tentatives = 0;
  const module = { exports: {} };
  const exec = async (_lms, args) => {
    commandes.push(args);
    if (args[0] === "daemon" && args[1] === "up") { if (serviceEnPanne) throw Error("service arrêté"); return { stdout: "" }; }
    if (args[0] === "daemon") return { stdout: JSON.stringify({ status: serviceEnPanne ? "not-running" : "running" }) };
    if (args[1] === "status") return { stdout: JSON.stringify({ running: deja || (enMarcheApresRefus && commence), port: 9999 }) };
    assert.deepEqual(Array.from(args), ["server", "start", "--port", "1234"]);
    commence = true; tentatives++;
    if (refus && tentatives === 1) { commence = enMarcheApresRefus; throw Error("WebSocket fermé pendant le démarrage"); }
    return { stdout: "" };
  };
  const contexte = { module, exports: module.exports, BACKENDS: [{ id: "lmstudio", baseUrl: adresse }], Date, URL, process: { platform: "win32" }, console: { log() {}, warn() {}, error() {} }, AbortSignal,
    fetch: async () => ({ ok: commence && ++lectures > retard }),
    setTimeout: fn => setTimeout(fn, 0), clearTimeout,
    exec, t: x => x, tf: (x, v) => x.replace("{0}", String(v)), portServeurLocal,
    attendreEcoute: f => attendreEcoute(f, async () => {}, 60),
    preparerDossiersLlmster() {}, moteurAPoser: () => false, findLms: async () => "C:\\moteur\\lms.exe", moteurSansInterface: () => true, canalOuvert: () => false, applicationLmStudio: () => null,
  };
  vm.runInNewContext(compile.code, contexte);
  return { m: module.exports, commandes };
}
{
  const b = banc({ retard: 12 }); const a = b.m.ensureLmStudioServer(); assert.equal(a, b.m.ensureLmStudioServer());
  assert.equal(await a, true); assert.equal(b.commandes.filter(x => x[1] === "start").length, 1);
}
{
  const b = banc({ refus: true }); assert.equal(await b.m.ensureLmStudioServer(), true);
  assert.equal(b.commandes.filter(x => x[1] === "start").length, 2);
}
{
  const b = banc({ refus: true, enMarcheApresRefus: true, retard: 12 }); assert.equal(await b.m.ensureLmStudioServer(), true);
  assert.equal(b.commandes.filter(x => x[1] === "start").length, 1);
}
for (const opts of [{ deja: true }, { adresse: "https://moteur.example/v1" }, { serviceEnPanne: true }]) {
  const b = banc(opts); assert.equal(await b.m.ensureLmStudioServer(), false);
  assert.equal(b.commandes.filter(x => x[1] === "start").length, 0);
}
// Le canal Windows accepte un port numérique, jamais une chaîne de commande ni un autre programme.
const windows = readFileSync("electron/moteurWindows.cjs", "utf8");
const enfants = [];
const mod = { exports: {} };
vm.runInNewContext(windows, { module: mod, exports: mod.exports, process: { platform: "win32" }, setTimeout, clearTimeout,
  require: nom => ({ "node:fs": { readFileSync() { throw Error(); }, existsSync: () => true }, "node:os": { homedir: () => "C:\\Compte avec accents é" }, "node:path": path.win32,
    "node:child_process": { spawn: (f, args) => { enfants.push({ f, args }); const e = { stdout: { on() {} }, stderr: { on() {} }, kill() {}, on(type, fn) { if (type === "close") queueMicrotask(() => fn(0)); } }; return e; } } })[nom],
});
const lancer = mod.exports.lancerLms;
const lms = "C:\\Compte avec accents é\\.lmstudio\\bin\\lms.exe";
assert.equal((await lancer({ lms, commande: "server start", port: 1234 })).code, 0);
assert.deepEqual(Array.from(enfants[0].args), ["server", "start", "--port", "1234"]);
for (const demande of [{ lms, commande: "server start", port: "1234 & calc" }, { lms, commande: "server start", port: 65536 }, { lms, commande: "daemon up", port: 1234 }, { lms, commande: "constructor" }, { lms: "C:\\autre.exe", commande: "daemon up" }]) assert.equal((await lancer(demande)).code, -1);
assert.equal(enfants.length, 1);
console.log("Démarrage : retard, concurrence, port, refus transitoire, serveur partagé et canal Windows contrôlés.");
