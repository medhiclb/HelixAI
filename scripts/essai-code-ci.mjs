/*
 * Une session de l'écran Code ouverte comme l'écran l'ouvre, avec le vrai
 * OpenCode posé par Helix, sur une machine jetable (02/10/2026).
 *
 * Signalé par Medhi le 02/10/2026 : sous Linux, l'écran Code n'ouvre pas de
 * session (« Réessayer »). Rien ne se voyait d'ici, faute de Linux : cet essai
 * tourne sur GitHub Actions (job `code-linux` de .github/workflows/essai-windows.yml),
 * et sur un Mac pour le mettre au point.
 *
 *   node scripts/essai-code-ci.mjs [--sortie essai-code-sortie]
 *
 * Ce qui tourne, tout sur 127.0.0.1 : une passerelle (`node gateway/src/index.ts`),
 * données et dossier de projet jetables ; un faux moteur compatible OpenAI à la
 * place de LM Studio (une réponse courte, en flux). OpenCode est celui que
 * Helix télécharge et vérifie lui-même (opencodePrive.ts), dans les données
 * jetables. Rien ne touche au LM Studio, à l'OpenCode ni aux réglages du poste.
 *
 * Gardé dans le dossier de sortie : le journal de la passerelle (avec celui
 * d'OpenCode, préfixé « [opencode] »), et le résumé des étapes.
 */
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { createServer } from "node:http";
import { chmodSync, createWriteStream, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const arg = (nom, defaut) => {
  const i = process.argv.indexOf(`--${nom}`);
  return i > 0 ? process.argv[i + 1] : defaut;
};
const SORTIE = resolve(arg("sortie", "essai-code-sortie"));
mkdirSync(SORTIE, { recursive: true });
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
const debut = Date.now();
const dire = (m) => console.log(`[${String(Math.round((Date.now() - debut) / 1000)).padStart(5)} s] ${m}`);
const resume = [];
let echecs = 0;
function verifier(nom, ok, obtenu) {
  resume.push({ nom, ok, obtenu: ok ? undefined : String(obtenu ?? "").slice(0, 2000) });
  dire(`${ok ? "  ✓" : "  ✗"} ${nom}${ok ? "" : `  —  obtenu : ${String(obtenu ?? "").slice(0, 600)}`}`);
  if (!ok) echecs++;
  return ok;
}

/* ── Le faux moteur : un modèle, une réponse courte en flux ─────────────── */
const MODELE = arg("modele", "essai-code");
const PANNE_DEMARRAGE = process.argv.includes("--panne-demarrage");
// Ce que le modèle a reçu en résultat d'outil (étape 7).
const RECU_PAR_LE_MODELE = [];
const moteur = createServer((req, res) => {
  let corps = "";
  req.on("data", (b) => (corps += b));
  req.on("end", () => {
    if (req.url?.startsWith("/v1/models")) {
      res.setHeader("Content-Type", "application/json");
      return res.end(JSON.stringify({ object: "list", data: [{ id: MODELE, object: "model", context_length: 32768 }] }));
    }
    if (req.url?.startsWith("/v1/chat/completions")) {
      const demande = JSON.parse(corps || "{}");
      if (demande.stream === false) {
        res.setHeader("Content-Type", "application/json");
        return res.end(JSON.stringify({ id: "essai", object: "chat.completion", model: MODELE, choices: [{ index: 0, message: { role: "assistant", content: "{\"etapes\":[]}" }, finish_reason: "stop" }], usage: { prompt_tokens: 10, completion_tokens: 3, total_tokens: 13 } }));
      }
      res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" });
      const morceau = (delta, fin) => `data: ${JSON.stringify({ id: "essai", object: "chat.completion.chunk", created: Math.floor(Date.now() / 1000), model: MODELE, choices: [{ index: 0, delta, finish_reason: fin ?? null }] })}\n\n`;
      /*
       * Étape 7 (23/10/2026, capture sous Windows) : sur « ESSAI-HORS-PROJET »,
       * le modèle lit `/app/PLAN.md`, un chemin absolu hors du dossier du
       * projet ; puis il répond par ce que l'outil lui a rendu.
       */
      const messages = Array.isArray(demande.messages) ? demande.messages : [];
      const texteDe = (m) => (typeof m?.content === "string" ? m.content : Array.isArray(m?.content) ? m.content.map((p) => p?.text ?? "").join(" ") : "");
      const avecLecture = (demande.tools ?? []).some((o) => o?.function?.name === "read");
      if (avecLecture && messages.some((m) => m.role === "user" && texteDe(m).includes("ESSAI-HORS-PROJET"))) {
        const resultat = [...messages].reverse().find((m) => m.role === "tool");
        if (!resultat) {
          res.write(morceau({ role: "assistant", content: null, tool_calls: [{ index: 0, id: "appel-hors-projet", type: "function", function: { name: "read", arguments: JSON.stringify({ filePath: "/app/PLAN.md" }) } }] }));
          res.write(morceau({}, "tool_calls"));
          return res.end("data: [DONE]\n\n");
        }
        RECU_PAR_LE_MODELE.push(texteDe(resultat));
        res.write(morceau({ role: "assistant", content: "Reçu de l'outil, fin de l'essai." }));
        res.write(morceau({}, "stop"));
        return res.end("data: [DONE]\n\n");
      }
      res.write(morceau({ role: "assistant", content: "" }));
      res.write(morceau({ content: "Bonjour, " }));
      res.write(morceau({ content: "la session répond." }));
      res.write(morceau({}, "stop"));
      res.write(`data: ${JSON.stringify({ id: "essai", object: "chat.completion.chunk", model: MODELE, choices: [], usage: { prompt_tokens: 10, completion_tokens: 6, total_tokens: 16 } })}\n\n`);
      return res.end("data: [DONE]\n\n");
    }
    res.statusCode = 404;
    res.end("{}");
  });
});
await new Promise((ok) => moteur.listen(0, "127.0.0.1", ok));
const PORT_MOTEUR = moteur.address().port;

/* ── La passerelle jetable ──────────────────────────────────────────────── */
const TMP = mkdtempSync(join(tmpdir(), "helix-essai-code-"));
const DONNEES = join(TMP, "donnees");
const PROJET = join(TMP, "projet");
mkdirSync(DONNEES, { recursive: true });
mkdirSync(PROJET, { recursive: true });
writeFileSync(join(PROJET, "README.md"), "# Projet d'essai\n");
mkdirSync(join(PROJET, "app"), { recursive: true });
writeFileSync(join(PROJET, "app", "PLAN.md"), "# Plan d'essai\n");
let fauxBinaire;
if (PANNE_DEMARRAGE) {
  fauxBinaire = join(TMP, "opencode-en-panne");
  writeFileSync(fauxBinaire, `#!${process.execPath}\nif(process.argv.includes('--version')){console.log('1.18.32');process.exit(0)}process.exit(17);\n`);
  chmodSync(fauxBinaire, 0o700);
}
const PORT = 8797;
const G = `http://127.0.0.1:${PORT}`;
const journal = createWriteStream(join(SORTIE, "passerelle.log"), { flags: "w" });
const passerelle = spawn(process.execPath, [join(RACINE, "gateway", "src", "index.ts")], {
  cwd: RACINE,
  env: {
    ...process.env,
    HELIX_DATA_DIR: DONNEES,
    ...(fauxBinaire ? { HELIX_OPENCODE_BIN: fauxBinaire } : {}),
    HELIX_CONFIG: join(TMP, "helix.config.json"),
    HELIX_GATEWAY_PORT: String(PORT),
    HELIX_CODE_DIR: PROJET,
    HELIX_WORKSPACE: join(TMP, "espace"),
    HELIX_LUME_DIR: join(TMP, "lume"),
    HELIX_LMSTUDIO_URL: `http://127.0.0.1:${PORT_MOTEUR}/v1`,
    HELIX_EXO_URL: "http://127.0.0.1:9/v1",
    HELIX_SANS_MISE_A_JOUR: "1",
  },
  stdio: ["ignore", "pipe", "pipe"],
});
passerelle.stdout.pipe(journal);
passerelle.stderr.pipe(journal);

let JETON = "";
let SEANCE = "";
const entetes = () => ({ "Content-Type": "application/json", Authorization: `Bearer ${JETON}`, "X-Helix-Langue": "fr", ...(SEANCE ? { "X-Helix-Session": SEANCE } : {}) });
const lireJson = async (r) => {
  const texte = await r.text();
  try {
    return { statut: r.status, corps: JSON.parse(texte), texte };
  } catch {
    return { statut: r.status, corps: null, texte };
  }
};

try {
  dire("1. La passerelle démarre");
  let sante = false;
  for (let i = 0; i < 240 && !sante; i++) {
    sante = await fetch(`${G}/health`, { signal: AbortSignal.timeout(2000) }).then((r) => r.ok, () => false);
    if (!sante) await attendre(500);
  }
  if (!verifier("la passerelle répond", sante, "aucune réponse")) throw new Error("passerelle muette");
  const fichierJeton = join(DONNEES, "instance-token");
  for (let i = 0; i < 20 && !existsSync(fichierJeton); i++) await attendre(500);
  JETON = readFileSync(fichierJeton, "utf8").trim();

  dire("2. Le compte administrateur");
  const motDePasse = `Essai-${randomBytes(12).toString("base64url")}-9a`;
  const compte = await lireJson(await fetch(`${G}/helix/auth/create`, { method: "POST", headers: entetes(), body: JSON.stringify({ fullName: "Administrateur essai", email: "admin@essai-code.test", password: motDePasse }) }));
  SEANCE = compte.corps?.session?.token ?? "";
  if (!verifier("le premier compte est créé", Boolean(SEANCE), compte.texte.slice(0, 300))) throw new Error("pas de séance");

  dire("3. OpenCode, posé par Helix de lui-même");
  let etat = null;
  let relance = false;
  for (let i = 0; i < 360; i++) {
    etat = (await lireJson(await fetch(`${G}/helix/code`, { headers: entetes() }))).corps;
    if (etat?.available) break;
    // Pas d'installation en cours ni d'erreur au bout de 20 s : on la demande, comme le bouton de l'écran.
    if (!relance && i >= 40 && !etat?.installation?.enCours) {
      relance = true;
      const r = await lireJson(await fetch(`${G}/helix/code/installer`, { method: "POST", headers: entetes(), body: "{}" }));
      dire(`   installation demandée : ${r.statut} ${r.texte.slice(0, 200)}`);
    }
    if (etat?.installation?.erreur && relance) break;
    if (i % 20 === 0) dire(`   ${JSON.stringify({ available: etat?.available, installation: etat?.installation, error: etat?.error })}`);
    await attendre(1000);
  }
  dire(`   état : ${JSON.stringify(etat)}`);
  if (!verifier("OpenCode est posé et trouvé", Boolean(etat?.available), JSON.stringify(etat))) throw new Error("pas d'OpenCode");

  dire("4. Le modèle choisi pour Code");
  const modeles = (await lireJson(await fetch(`${G}/helix/models`, { headers: entetes() }))).corps;
  const liste = (modeles?.data ?? modeles?.models ?? []).map((m) => m.id ?? m.uid ?? m);
  dire(`   modèles : ${JSON.stringify(liste).slice(0, 300)}`);
  const modele = liste.find((m) => String(m).includes(MODELE));
  if (!verifier("le faux modèle est proposé", Boolean(modele), JSON.stringify(modeles).slice(0, 400))) throw new Error("pas de modèle");

  dire("5. Une session, comme l'écran Code l'ouvre");
  const t0 = Date.now();
  const session = await lireJson(await fetch(`${G}/helix/code/session`, { method: "POST", headers: entetes(), body: JSON.stringify({ model: modele, effort: "moyen", dossier: PROJET }) }));
  dire(`   ${session.statut} en ${Date.now() - t0} ms : ${session.texte.slice(0, 400)}`);
  const id = session.corps?.data?.id;
  if (PANNE_DEMARRAGE) verifier("un crash du moteur est expliqué comme un échec de démarrage, jamais comme un modèle absent", session.statut === 503 && /démarrage.*17/.test(session.texte) && !/ne dispose pas du modèle/.test(session.texte), session.texte);
  else verifier("la session s'ouvre (200, un identifiant)", session.statut === 200 && Boolean(id), `${session.statut} ${session.texte}`);

  if (id) {
    dire("6. Une demande dans la session");
    const flux = await fetch(`${G}/helix/code/events?sessionID=${encodeURIComponent(id)}`, { headers: entetes(), signal: AbortSignal.timeout(120_000) }).catch((e) => e);
    const demande = await lireJson(await fetch(`${G}/helix/code/prompt`, { method: "POST", headers: entetes(), body: JSON.stringify({ sessionID: id, text: "Dis bonjour en une phrase.", model: modele, effort: "moyen" }) }));
    dire(`   demande : ${demande.statut} ${demande.texte.slice(0, 300)}`);
    verifier("la demande est acceptée", demande.statut >= 200 && demande.statut < 300, `${demande.statut} ${demande.texte}`);
    let vu = "";
    if (flux instanceof Response && flux.body) {
      const lecteur = flux.body.getReader();
      const decodeur = new TextDecoder();
      const fin = Date.now() + 90_000;
      while (Date.now() < fin && !/la session répond/.test(vu)) {
        const { value, done } = await Promise.race([lecteur.read(), attendre(5000).then(() => ({ value: undefined, done: false }))]);
        if (done) break;
        if (value) vu += decodeur.decode(value, { stream: true });
      }
      lecteur.cancel().catch(() => {});
    }
    writeFileSync(join(SORTIE, "flux-session.txt"), vu);
    verifier("la réponse du modèle arrive dans le flux de la session", /la session répond/.test(vu), vu.slice(-800) || String(flux));

    /*
     * 7. Capture d'un utilisateur sous Windows (23/10/2026) : « Lecture
     * /app/PLAN.md », puis le message de règle d'OpenCode et le JSON de ses
     * règles à l'écran. Le modèle lit ici `/app/PLAN.md` (hors du projet) ;
     * l'écran doit recevoir un refus reconnaissable sans le JSON, le modèle une
     * phrase qui lui dit le dossier du projet et le bon chemin.
     */
    dire("7. Un chemin absolu hors du dossier du projet (/app/PLAN.md)");
    const flux7 = await fetch(`${G}/helix/code/events?sessionID=${encodeURIComponent(id)}`, { headers: entetes(), signal: AbortSignal.timeout(120_000) }).catch((e) => e);
    const demande7 = await lireJson(await fetch(`${G}/helix/code/prompt`, { method: "POST", headers: entetes(), body: JSON.stringify({ sessionID: id, text: "ESSAI-HORS-PROJET : lis le plan.", model: modele, effort: "moyen" }) }));
    dire(`   demande : ${demande7.statut} ${demande7.texte.slice(0, 200)}`);
    let vu7 = "";
    if (flux7 instanceof Response && flux7.body) {
      const lecteur = flux7.body.getReader();
      const decodeur = new TextDecoder();
      const fin = Date.now() + 90_000;
      while (Date.now() < fin && !/fin de l'essai/.test(vu7)) {
        const { value, done } = await Promise.race([lecteur.read(), attendre(5000).then(() => ({ value: undefined, done: false }))]);
        if (done) break;
        if (value) vu7 += decodeur.decode(value, { stream: true });
      }
      lecteur.cancel().catch(() => {});
    }
    writeFileSync(join(SORTIE, "flux-hors-projet.txt"), vu7);
    const echec7 = vu7.split("\n").filter((l) => l.includes("session.next.tool.failed")).join("\n");
    dire(`   échec de l'outil vu par l'écran : ${echec7.slice(0, 400)}`);
    dire(`   reçu par le modèle : ${(RECU_PAR_LE_MODELE.at(-1) ?? "").slice(0, 400)}`);
    verifier(
      "écran : la lecture hors du projet échoue avec `horsProjet` et le chemin, sans le JSON des règles d'OpenCode",
      /"horsProjet":\{"chemin":"\/app\/PLAN\.md"\}/.test(echec7) && !/"permission":/.test(echec7) && !/relevant rules/.test(echec7),
      echec7.slice(0, 800) || vu7.slice(-800),
    );
    verifier(
      "modèle : il reçoit le dossier du projet et le bon chemin (app/PLAN.md du projet), rien n'a été lu",
      RECU_PAR_LE_MODELE.some((r) => /outside the project folder/.test(r) && /Did you mean \S*projet[\\/]app[\\/]PLAN\.md\?/.test(r) && !/Plan d'essai/.test(r)),
      RECU_PAR_LE_MODELE.at(-1) ?? "(rien reçu)",
    );
  }
} catch (err) {
  dire(`arrêt : ${err instanceof Error ? err.message : err}`);
} finally {
  writeFileSync(join(SORTIE, "resume.json"), JSON.stringify(resume, null, 2));
  passerelle.kill("SIGTERM");
  await attendre(1500);
  if (passerelle.exitCode === null) passerelle.kill("SIGKILL");
  moteur.close();
  journal.end();
  await attendre(300);
  const lignes = readFileSync(join(SORTIE, "passerelle.log"), "utf8").split("\n").filter((l) => /opencode|code\]|erreur|error/i.test(l));
  console.log("\n── Journal de la passerelle (OpenCode et erreurs) ──");
  console.log(lignes.slice(-60).join("\n"));
  console.log(`\n${resume.filter((r) => r.ok).length} vérification(s) réussie(s), ${echecs} échec(s).`);
  process.exit(echecs ? 1 : 0);
}
