/*
 * Un faux OpenCode, pour la batterie de sécurité (scripts/securite.mjs).
 *
 * Il imite de l'ancienne API d'OpenCode 1.18.32 ce dont la passerelle se sert
 * (sessions, `prompt_async`, flux `/event`, réponse aux permissions,
 * fournisseurs de la configuration), exige son mot de passe comme le vrai, et
 * n'appelle jamais aucun modèle. Il ouvre en plus, sans mot de passe, de quoi
 * vérifier de l'extérieur ce que la passerelle lui donne :
 *
 *  - `GET /essai/env` : son environnement, et celui que recevrait une commande
 *    qu'il lancerait, calculé comme le vrai (lu dans son code :
 *    `{ ...process.env, ...env }`, où `env` sort du crochet `shell.env` des
 *    greffons `plugin/*.js` de son dossier de configuration) ;
 *  - `POST /essai/permission` : émet un `permission.asked` sur `/event`, comme
 *    le vrai avant une commande ou une écriture ;
 *  - `GET /essai/reponses` : les réponses reçues sur `/permission/<id>/reply`.
 *
 * Usage : `faux-opencode.mjs --version` ou `faux-opencode.mjs serve --port N`.
 */
import http from "node:http";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const args = process.argv.slice(2);
if (args[0] === "--version") {
  process.stdout.write("1.18.32\n");
  process.exit(0);
}
if (args[0] !== "serve") process.exit(1);
const port = Number(args[args.indexOf("--port") + 1]);
const attendu = "Basic " + Buffer.from(`opencode:${process.env.OPENCODE_SERVER_PASSWORD ?? ""}`).toString("base64");
const id = (prefixe) => `${prefixe}_${randomBytes(12).toString("hex")}`;
/** Flux ouverts, avec leur dossier : comme le vrai, `/event` ne rend que les évènements d'un dossier. */
const flux = new Map();
const dossiers = new Map();
const reponses = [];
/** Demandes reçues par session, rendues par `/session/<id>/message` comme le vrai (au format de l'ancienne API). */
const messages = new Map();
const emettre = (evenement, dossier) => {
  for (const [res, d] of flux) if (dossier === undefined || d === dossier) res.write(`data: ${JSON.stringify(evenement)}\n\n`);
};

/** L'environnement d'une commande, comme le calcule OpenCode 1.18.32 (`entree` : ce que reçoit le crochet `shell.env`). */
async function environnementEnfant(entree = { cwd: process.cwd() }) {
  const dossier = join(process.env.OPENCODE_CONFIG_DIR ?? "", "plugin");
  const sortie = { env: {} };
  let fichiers = [];
  try {
    fichiers = readdirSync(dossier).filter((f) => f.endsWith(".js"));
  } catch {
    /* aucun greffon */
  }
  for (const f of fichiers) {
    const module = await import(pathToFileURL(join(dossier, f)).href);
    for (const fabrique of Object.values(module)) {
      if (typeof fabrique !== "function") continue;
      const crochets = await fabrique({});
      await crochets?.["shell.env"]?.(entree, sortie);
    }
  }
  return { ...process.env, ...sortie.env };
}

const serveur = http.createServer((req, res) => {
  let corps = "";
  req.on("data", (b) => (corps += b));
  req.on("end", async () => {
    const url = new URL(req.url ?? "/", "http://x");
    const chemin = url.pathname;
    const json = (valeur, statut = 200) => {
      res.writeHead(statut, { "Content-Type": "application/json" });
      res.end(JSON.stringify(valeur));
    };
    // Crochets d'essai, sans mot de passe : ils ne servent qu'à la batterie.
    if (chemin === "/essai/env") return json({ env: process.env, enfant: await environnementEnfant() });
    /*
     * Ajouté le 28/09/2026 (RTK, section 16) : lance une commande comme l'outil
     * `bash` du vrai, une fois l'accord donné. Lu dans `ShellTool` de 1.18.32 :
     * `spawn(commande, [], { shell, env })`, le shell venant du réglage `shell`
     * de la configuration (sinon `SHELL`), l'environnement du crochet
     * `shell.env` appelé avec `{ cwd, sessionID, callID }`.
     */
    if (chemin === "/essai/executer" && req.method === "POST") {
      const d = JSON.parse(corps || "{}");
      const config = JSON.parse(readFileSync(join(process.env.OPENCODE_CONFIG_DIR ?? "", "opencode.json"), "utf8"));
      const shell = config.shell ?? process.env.SHELL ?? "/bin/sh";
      const cwd = d.dossier ?? process.cwd();
      const env = await environnementEnfant({ cwd, sessionID: d.sessionID, callID: id("call") });
      const enfant = spawn(d.command, [], { shell, cwd, env, stdio: ["ignore", "pipe", "pipe"] });
      let sortie = "";
      enfant.stdout.on("data", (b) => (sortie += b));
      enfant.stderr.on("data", (b) => (sortie += b));
      enfant.on("close", (code) => json({ shell, sortie, code }));
      enfant.on("error", (err) => json({ shell, sortie: String(err), code: -1 }));
      return;
    }
    if (chemin === "/essai/reponses") return json(reponses);
    if (chemin === "/essai/permission" && req.method === "POST") {
      const d = JSON.parse(corps || "{}");
      const demande = { id: id("per"), sessionID: d.sessionID, permission: d.permission, patterns: d.patterns ?? [], metadata: d.metadata ?? {}, always: [] };
      emettre({ type: "permission.asked", properties: demande }, dossiers.get(d.sessionID));
      return json({ id: demande.id });
    }
    if (req.headers.authorization !== attendu) return json({ error: "unauthorized" }, 401);

    if (chemin === "/global/health") return json({ healthy: true, version: "fictif" });
    if (chemin === "/api/session") return json([]);
    if (chemin === "/event") {
      res.writeHead(200, { "Content-Type": "text/event-stream" });
      res.write(`data: ${JSON.stringify({ type: "server.connected", properties: {} })}\n\n`);
      flux.set(res, url.searchParams.get("directory") ?? "");
      res.on("close", () => flux.delete(res));
      return;
    }
    if (chemin === "/config/providers") {
      const config = JSON.parse(readFileSync(join(process.env.OPENCODE_CONFIG_DIR ?? "", "opencode.json"), "utf8"));
      return json({ providers: [{ id: "helix", models: config.provider?.helix?.models ?? {} }] });
    }
    if (chemin === "/session/status") return json({});
    if (chemin === "/api/session/active") return json({ data: {} });
    if (chemin === "/mcp/helix/connect") return json(true);
    if (chemin === "/session" && req.method === "POST") {
      const nouvelle = id("ses");
      dossiers.set(nouvelle, url.searchParams.get("directory") ?? "");
      return json({ id: nouvelle });
    }
    const reponse = chemin.match(/^\/permission\/([^/]+)\/reply$/);
    if (reponse && req.method === "POST") {
      reponses.push({ id: reponse[1], ...JSON.parse(corps || "{}") });
      emettre({ type: "permission.replied", properties: { requestID: reponse[1], reply: JSON.parse(corps || "{}").reply } }, url.searchParams.get("directory") ?? "");
      return json(true);
    }
    const session = chemin.match(/^\/session\/(ses_[A-Za-z0-9]+)(\/[a-z_]+)?$/);
    if (session) {
      if (session[2] === "/prompt_async") {
        const d = JSON.parse(corps || "{}");
        const texte = (d.parts ?? []).filter((p) => p.type === "text").map((p) => p.text).join("\n\n");
        const liste = messages.get(session[1]) ?? [];
        liste.push({ info: { id: d.messageID ?? id("msg"), role: "user" }, parts: [{ type: "text", text: texte }] });
        messages.set(session[1], liste);
        res.writeHead(204);
        return res.end();
      }
      if (session[2] === "/message") return json(messages.get(session[1]) ?? []);
      return json({ id: session[1] });
    }
    json({ error: "inconnu" }, 404);
  });
});
serveur.listen(port, "127.0.0.1");
// Parti avec la passerelle : un faux serveur ne survit pas à la batterie.
const parent = process.ppid;
setInterval(() => {
  try {
    process.kill(parent, 0);
  } catch {
    process.exit(0);
  }
}, 1000);
process.on("SIGTERM", () => process.exit(0));
