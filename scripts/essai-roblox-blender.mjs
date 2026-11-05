/*
 * Roblox Studio et Blender, connecteurs d'applications de la machine, essayés
 * de bout en bout (12/10/2026).
 *
 *   npm run essai:roblox-blender      (repris par npm run securite, section 40)
 *
 * Les deux serveurs MCP se lancent en stdio (gateway/src/roblox.ts,
 * gateway/src/blender.ts). Cet essai ne touche ni à un vrai Roblox Studio ni à
 * un vrai Blender, ni au vrai port du module de Blender : des faux serveurs
 * MCP stdio (scripts Node écrits dans un dossier jetable) imitent les outils
 * réels, et un faux module de Blender écoute sur un port libre, dans ce
 * processus. Variables réservées aux essais, posées pour la passerelle :
 *  - HELIX_ESSAI_ROBLOX_EXECUTABLE : le faux StudioMCP, à la place du
 *    programme de Studio et de sa signature ;
 *  - HELIX_ESSAI_BLENDER_SERVEUR : le faux serveur de Blender, à la place de
 *    celui que Helix pose ;
 *  - HELIX_ESSAI_BLENDER_PORT, HELIX_ESSAI_BLENDER_EXECUTABLE : le port du
 *    faux module, et l'exécutable qui doit y écouter (Node, ce processus) à la
 *    place de la signature de la Blender Foundation. « Un autre programme »
 *    est `nc`, qui note tout ce qu'il reçoit.
 *
 *  A. Règles, dans ce processus : classement des outils, catalogue,
 *     enregistrement relu, paquets figés et empreintes, télémétrie coupée.
 *  B. La passerelle : branchement, lecture sans carte, écriture derrière la
 *     carte à tout niveau, collègue non administrateur, chemin de fichier
 *     refusé, port de Blender pris par un autre programme, retrait.
 *  C. Seulement avec HELIX_ESSAI_BLENDER_RESEAU=1 (réseau requis, pypi.org) :
 *     Helix pose le vrai serveur de Blender (empreintes vérifiées), qui est
 *     lancé contre le faux module, avec un piège à toute sortie réseau.
 */
import { execFileSync, spawn } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { createServer as serveurHttp } from "node:http";
import { createServer as serveurTcp } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const RACINE = join(dirname(fileURLToPath(import.meta.url)), "..");

let reussis = 0;
const echecs = [];
function verifier(nom, condition, obtenu) {
  if (condition) {
    reussis++;
    console.log(`  ✓ ${nom}`);
  } else {
    echecs.push(nom);
    console.log(`  ✗ ${nom}  —  obtenu : ${String(typeof obtenu === "string" ? obtenu : JSON.stringify(obtenu)).slice(0, 500)}`);
  }
}
const portLibre = () =>
  new Promise((ok) => {
    const s = serveurTcp();
    s.listen(0, "127.0.0.1", () => {
      const { port } = s.address();
      s.close(() => ok(port));
    });
  });
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
const importer = (...p) => import(pathToFileURL(join(RACINE, ...p)).href);
const AUX = mkdtempSync(join(tmpdir(), "helix-essai-roblox-blender-"));
mkdirSync(join(AUX, "espace-a"), { recursive: true });
writeFileSync(join(AUX, "profil-a.json"), JSON.stringify({ chiffrement: "fichier" }));
Object.assign(process.env, { HELIX_DATA_DIR: join(AUX, "donnees-a"), HELIX_WORKSPACE: join(AUX, "espace-a"), HELIX_CONFIG: join(AUX, "profil-a.json") });
const NODE = realpathSync(process.execPath);

/* Les outils réels, tels que la documentation de Roblox (12/10/2026) et le code de MCP for Blender 2.1.9 les donnent. */
const LECTURES_ROBLOX = ["script_read", "script_search", "script_grep", "search_game_tree", "inspect_instance", "get_studio_state", "get_console_output", "screen_capture", "list_roblox_studios", "search_asset", "http_get", "skill", "wait_job_finished"];
const ECRITURES_ROBLOX = ["multi_edit", "execute_luau", "insert_asset", "generate_mesh", "generate_material", "generate_procedural_model", "upload_image", "store_image", "start_stop_play", "character_navigation", "user_keyboard_input", "user_mouse_input", "subagent", "nouvel_outil_inconnu"];
const LECTURES_BLENDER = ["get_addon_status", "get_scene_info", "look"];
const ECRITURES_BLENDER = ["execute_blender_code", "generate_3d", "search_assets", "import_asset", "disable_telemetry", "record_trajectory_feedback", "nouvel_outil_inconnu"];

/* ------------------------------------------------------------------------- */
/* A. Les règles, dans ce processus                                           */
/* ------------------------------------------------------------------------- */

console.log("\nA. Règles : classement des outils, catalogue, paquets figés, télémétrie coupée");
try {
  const { modifie, demandeToujours, resumerOutil } = await importer("gateway", "src", "approbation.ts");
  const rr = await importer("gateway", "src", "robloxRegles.ts");
  const rb = await importer("gateway", "src", "blenderRegles.ts");
  const qr = (n) => `roblox__${n}`;
  const qb = (n) => `blender__${n}`;
  const lecturesMal = [...LECTURES_ROBLOX.map(qr), ...LECTURES_BLENDER.map(qb)].filter((n) => modifie(n) || demandeToujours(n));
  verifier(`lectures (${LECTURES_ROBLOX.length} de Roblox Studio, ${LECTURES_BLENDER.length} de Blender) : sans carte, sauf au niveau « Demander pour tout »`, lecturesMal.length === 0, lecturesMal);
  const ecrituresMal = [...ECRITURES_ROBLOX.map(qr), ...ECRITURES_BLENDER.map(qb)].filter((n) => !modifie(n) || !demandeToujours(n));
  verifier(`écritures, exécution de code, générations, outil inconnu (${ECRITURES_ROBLOX.length} + ${ECRITURES_BLENDER.length}) : carte à chaque appel, à tout niveau`, ecrituresMal.length === 0, ecrituresMal);
  verifier(
    "hors de la machine, dit sur la carte : générations et image envoyée chez Roblox ; bibliothèques et générateurs de Blender",
    ["generate_mesh", "generate_material", "generate_procedural_model"].every((n) => rr.horsMachineRoblox(qr(n)) === "roblox-generation") && rr.horsMachineRoblox(qr("upload_image")) === "roblox-televersement" && rr.horsMachineRoblox(qr("execute_luau")) === null &&
      rb.horsMachineBlender(qb("search_assets")) === "blender-bibliotheque" && rb.horsMachineBlender(qb("import_asset")) === "blender-bibliotheque" && rb.horsMachineBlender(qb("generate_3d")) === "blender-generation" && rb.horsMachineBlender(qb("execute_blender_code")) === null &&
      /hors de cette machine/.test(resumerOutil(qr("generate_mesh"), { prompt: "un château" })) && /hors de cette machine/.test(resumerOutil(qb("generate_3d"), { prompt: "une chaise" })) && /Python dans Blender/.test(resumerOutil(qb("execute_blender_code"), {})),
    resumerOutil(qr("generate_mesh"), { prompt: "un château" }),
  );
  verifier(
    "préfixe exact : un outil d'un autre serveur n'est pas pris pour un outil de Roblox ou de Blender",
    !rr.estEcritureRoblox("robloxx__execute_luau") && !rr.estLectureRoblox("autre__script_read") && !rb.estEcritureBlender("blenderx__execute_blender_code") && !rb.estLectureBlender("execute_blender_code"),
    "regles",
  );
  {
    // 12/10/2026 : plus de liste d'extensions ; sans carte seulement sans image, ou « Render Result » / « Viewer Node » exactement.
    const avecCarte = ["/Users/x/.ssh/id_rsa.png", "~/Documents/a.jpg", "C:\\Users\\x\\a.png", "../secret.exr", "/Users/x/.ssh/id_rsa", "cle_sans_extension", "render result", "Render Result ", "MaTexture", "", 3];
    const sansCarte = [{}, { image: "Render Result" }, { image: "Viewer Node" }, { image: null }, { mode: "camera" }];
    const mal = [...avecCarte.filter((i) => !demandeToujours(qb("look"), { image: i }) || !rb.accordRequisBlender(qb("look"), { image: i })), ...sansCarte.filter((a) => demandeToujours(qb("look"), a) || rb.accordRequisBlender(qb("look"), a))];
    verifier(
      "look de Blender : sans carte seulement sans « image », ou avec exactement « Render Result » ou « Viewer Node » ; tout autre nom (fichier, même sans extension) demande la carte et l'administrateur",
      mal.length === 0 && !demandeToujours(qb("look")) && !rb.accordRequisBlender(qb("get_scene_info"), { image: "/etc/passwd" }) && /fichier de cette machine/.test(resumerOutil(qb("look"), { image: "/etc/passwd" })),
      mal,
    );
    verifier(
      "generate_3d avec une image : la carte dit que ce fichier part aussi chez le service de génération",
      /image « \/Users\/x\/photo\.png » part aussi chez ce service/.test(resumerOutil(qb("generate_3d"), { image: "/Users/x/photo.png" })) && !/part aussi/.test(resumerOutil(qb("generate_3d"), { prompt: "une chaise" })),
      resumerOutil(qb("generate_3d"), { image: "/Users/x/photo.png" }),
    );
  }

  const { CATALOGUE, aligner } = await importer("gateway", "src", "connecteurs.ts");
  const roblox = CATALOGUE.find((e) => e.id === "roblox");
  const blender = CATALOGUE.find((e) => e.id === "blender");
  verifier(
    "catalogue : « Roblox Studio » (Développement) et « Blender » (Documents et données), lancés sur la machine, sans adresse, sans commande, sans OAuth ni secret",
    [roblox, blender].every((f) => f && f.lanceur === true && !f.url && !f.command && !f.args && !f.local && !f.oauth && f.secrets.length === 0) && roblox.categorie === "Développement" && blender.categorie === "Documents et données" && roblox.telechargement === "https://create.roblox.com/docs/studio/setup" && blender.telechargement === "https://www.blender.org/download/",
    [roblox, blender],
  );
  let garde;
  try {
    garde = aligner({ id: "blender", label: "x", description: "x", local: true, url: "http://127.0.0.1:8787/", command: "/bin/sh", args: ["-c", "id"], secrets: { A: "b" }, depuis: "2026-10-12" });
  } catch (e) {
    garde = { erreur: e.message };
  }
  verifier("enregistrement relu : une adresse, une commande ou des secrets glissés dans le magasin sont oubliés", garde?.local === true && !garde.url && !garde.command && !garde.args && Object.keys(garde.secrets).length === 0 && garde.label === "Blender", garde);
  let refus = "";
  try {
    aligner({ id: "roblox", label: "x", description: "x", command: "/bin/sh", args: ["-c", "id"], secrets: {}, depuis: "" });
  } catch (e) {
    refus = e.message;
  }
  verifier("une commande enregistrée sous l'identifiant « roblox », sans « local » : refusée, pas déclarée", /hors catalogue|not in the catalogue/.test(refus), refus);

  const paquets = JSON.parse(readFileSync(join(RACINE, "gateway", "src", "blender-paquets.json"), "utf8"));
  const malFiges = paquets.exigences.filter((l) => !/^[A-Za-z0-9._-]+==[^\s;]+/.test(l) || !/--hash=sha256:[0-9a-f]{64}/.test(l));
  verifier(
    `serveur de Blender : mcp-for-blender==${paquets.version} et ses ${paquets.exigences.length - 1} dépendances, chaque ligne à version exacte avec au moins une empreinte SHA-256 ; empreinte du module complémentaire notée`,
    malFiges.length === 0 && paquets.exigences.some((l) => l.startsWith(`mcp-for-blender==${paquets.version} `)) && /^[0-9a-f]{64}$/.test(paquets.module.sha256) && paquets.module.chemin === "blender_mcp/bundled/addon.py",
    malFiges,
  );
  const licencesInconnues = Object.entries(paquets.licences).filter(([, l]) => !/MIT|Apache|BSD|PSF|MPL/.test(l));
  verifier("licence relevée pour chaque paquet (MIT, Apache, BSD, PSF ou MPL ; les écarts à MIT et Apache sont dans PROJET.md)", Object.keys(paquets.licences).length === paquets.exigences.length && licencesInconnues.length === 0, licencesInconnues);

  delete process.env.HELIX_ESSAI_BLENDER_SERVEUR;
  const b = await importer("gateway", "src", "blender.ts");
  const cmd = b.commandeBlender();
  const env = b.envBlender();
  verifier(
    "serveur de Blender lancé en Python isolé (-I) depuis l'environnement de Helix ; télémétrie et vérification de mise à jour coupées, module sur 127.0.0.1:9876",
    cmd.command.startsWith(join(AUX, "donnees-a", "blender-mcp", "venv")) && cmd.args[0] === "-I" && /from blender_mcp\.server import main; main\(\)/.test(cmd.args[2]) &&
      env.DISABLE_TELEMETRY === "1" && env.BLENDER_MCP_DISABLE_TELEMETRY === "1" && env.MCP_DISABLE_TELEMETRY === "1" && env.BLENDERMCP_NO_UPDATE_CHECK === "1" && env.BLENDER_HOST === "127.0.0.1" && env.BLENDER_PORT === "9876",
    { cmd, env },
  );
  verifier(
    "signature attendue de Blender sur macOS : Developer ID d'Apple, identifiant org.blenderfoundation.blender, équipe de la Blender Foundation",
    /anchor apple generic/.test(b.EXIGENCE_BLENDER) && /identifier "org\.blenderfoundation\.blender"/.test(b.EXIGENCE_BLENDER) && /leaf\[subject\.OU\] = "68UA947AUU"/.test(b.EXIGENCE_BLENDER),
    b.EXIGENCE_BLENDER,
  );
  verifier("serveur de Blender pas encore posé : il ne se lance pas, l'écran dit de cliquer « Brancher »", !b.serveurBlenderInstalle() && /pas installé|not installed/.test((await b.refusBlender()) ?? ""), await b.refusBlender());
  verifier(
    "Python du système pris seulement en 3.10 à 3.14 (les roues figées), sinon celui de Helix",
    [[3, 10], [3, 12], [3, 14]].every(([a, c]) => b.versionPythonAcceptee(a, c)) && ![[3, 9], [3, 15], [2, 7], [4, 0]].some(([a, c]) => b.versionPythonAcceptee(a, c)),
    "versionPythonAcceptee",
  );
  {
    const sansRoue = b.messageEchecPip("ERROR: Could not find a version that satisfies the requirement pydantic-core==2.50.1\nERROR: No matching distribution found for pydantic-core==2.50.1");
    const empreinte = b.messageEchecPip("ERROR: THESE PACKAGES DO NOT MATCH THE HASHES FROM THE REQUIREMENTS FILE.\n    mcp==1.30.0 from https://x: Expected sha256 a, Got b (hash mismatch)");
    const reseau = b.messageEchecPip("ERROR: Could not install packages due to an OSError: Connection refused");
    verifier(
      "pip sans roue pour ce Python ou ce système : dit clairement (Python 3.10 à 3.14), distinct d'une empreinte fausse et d'une panne de réseau",
      /paquet tout prêt|ready-made package/.test(sansRoue) && /3\.10 (à|to) 3\.14/.test(sansRoue) && /empreinte|fingerprint/.test(empreinte) && !/paquet tout prêt|ready-made/.test(empreinte) && /pypi\.org/.test(reseau) && !/ready-made|tout prêt/.test(reseau),
      `${sansRoue} | ${empreinte} | ${reseau}`,
    );
  }
  {
    const r = await importer("gateway", "src", "roblox.ts");
    const mauvais = ["C:\\Users\\Jean & Cie\\AppData\\Local\\Roblox\\mcp.bat", "C:\\Users\\a|b\\mcp.bat", "C:\\Users\\x (1)\\mcp.bat", "C:\\Users\\100%\\mcp.bat", "C:\\Users\\x!y\\mcp.bat", 'C:\\Users\\x"y\\mcp.bat', "C:\\Users\\a^b\\mcp.bat", "C:\\Users\\a<b>\\mcp.bat"];
    verifier(
      "Windows : cmd.exe lancé en /d /c (sans AutoRun) ; un chemin de mcp.bat avec & | < > ( ) ^ % ! \" est refusé, jamais échappé",
      JSON.stringify(r.argumentsCmd("C:\\Users\\Jean\\AppData\\Local\\Roblox\\mcp.bat")) === JSON.stringify(["/d", "/c", "C:\\Users\\Jean\\AppData\\Local\\Roblox\\mcp.bat"]) && mauvais.every((c) => !r.cheminPourCmd(c)) && r.cheminPourCmd("C:\\Users\\Jean Dupont\\AppData\\Local\\Roblox\\mcp.bat"),
      mauvais.filter((c) => r.cheminPourCmd(c)),
    );
    verifier(
      "macOS : signature de Roblox exigée, équipe de Roblox Corporation épinglée (2CFABCH843), sur l'application et sur StudioMCP",
      r.EQUIPE_ROBLOX === "2CFABCH843" && /anchor apple generic/.test(r.EXIGENCE_ROBLOX) && /leaf\[subject\.OU\] = "2CFABCH843"/.test(r.EXIGENCE_ROBLOX),
      r.EXIGENCE_ROBLOX,
    );
    const { dansLaLangue } = await importer("gateway", "src", "langue.ts");
    const conseil = (x) => dansLaLangue("fr", () => r.conseilRoblox(x)) ?? "";
    verifier(
      "conseil après branchement : « aucun Studio » seulement sur une liste vide ; un échec de la demande est dit comme tel",
      /Aucun Roblox Studio ne répond/.test(conseil({ ok: true, content: "[]" })) && !/Aucun Roblox Studio/.test(conseil({ ok: false, content: "délai dépassé" })) && /n'a pas pu être lue \(délai dépassé\)/.test(conseil({ ok: false, content: "délai dépassé" })) && /n'a pas pu être lue\./.test(conseil(null)),
      conseil({ ok: false, content: "délai dépassé" }),
    );
  }

  if (process.platform === "darwin") {
    // La vraie reconnaissance, sans variable d'essai : Node n'a pas la signature de la Blender Foundation.
    delete process.env.HELIX_ESSAI_BLENDER_EXECUTABLE;
    const port = await portLibre();
    const absent = await b.ecouteurBlender(port);
    const ecouteur = serveurTcp().listen(port, "127.0.0.1");
    await attendre(200);
    const nonSigne = await b.ecouteurBlender(port);
    ecouteur.close();
    verifier(
      "reconnaissance réelle (signature) : personne à l'écoute, « absent » ; un programme sans la signature de la Blender Foundation (Node), « un autre programme »",
      absent.ok === false && absent.raison === "absent" && nonSigne.ok === false && nonSigne.raison === "autre",
      `${JSON.stringify(absent)} ${JSON.stringify(nonSigne)}`,
    );
    const r = await importer("gateway", "src", "roblox.ts");
    process.env.HELIX_ESSAI_ROBLOX_EXECUTABLE = join(AUX, "absent-studiomcp");
    const introuvable = await r.refusRoblox();
    delete process.env.HELIX_ESSAI_ROBLOX_EXECUTABLE;
    const sansStudio = existsSync("/Applications/RobloxStudio.app") ? null : await r.refusRoblox();
    verifier(
      "Roblox Studio introuvable : rien n'est lancé, l'écran le dit (sur ce Mac sans Studio : avec la page d'installation officielle)",
      /introuvable|cannot be found/.test(introuvable ?? "") && (sansStudio === null || (/introuvable|cannot be found/.test(sansStudio) && sansStudio.includes("https://create.roblox.com/docs/studio/setup"))),
      `${introuvable} | ${sansStudio}`,
    );
    verifier("Roblox Studio sur macOS : le programme StudioMCP de l'application, sans argument", r.commandeRoblox().command.endsWith("RobloxStudio.app/Contents/MacOS/StudioMCP") && r.commandeRoblox().args.length === 0, r.commandeRoblox());
    verifier(
      "conseil après branchement : « aucun Studio ne répond » sur un échec ou une liste vide, rien sur une liste de Studio",
      /Enable Studio as MCP server/.test(r.conseilRoblox(null) ?? "") && /Enable Studio as MCP server/.test(r.conseilRoblox({ ok: true, content: "[]" }) ?? "") && /Enable Studio as MCP server/.test(r.conseilRoblox({ ok: false, content: "erreur" }) ?? "") && r.conseilRoblox({ ok: true, content: '[{"name":"Place1","studio_id":"a1"}]' }) === null,
      r.conseilRoblox({ ok: true, content: "[]" }),
    );
  }
} catch (err) {
  verifier("partie A sans exception", false, err?.stack ?? String(err));
}

/* ------------------------------------------------------------------------- */
/* Les faux : StudioMCP, serveur de Blender, module de Blender, modèle         */
/* ------------------------------------------------------------------------- */

/*
 * Un faux serveur MCP stdio, en Node : JSON-RPC ligne par ligne, comme le
 * transport stdio du SDK. Il note chaque appel (et son environnement, pour la
 * télémétrie) dans son journal. Le faux serveur de Blender relaie chaque appel
 * au module, sur BLENDER_HOST:BLENDER_PORT, comme le vrai.
 */
/*
 * `drapeauLong` (23/10/2026) : un fichier qui contient un nombre de
 * caractères ; tant qu'il existe, chaque description d'outil est allongée à
 * cette taille, pour la place du modèle (partie B, « place limitée »). Les
 * descriptions du vrai StudioMCP n'ont pas été relevées : c'est une taille
 * choisie, pas mesurée.
 */
function fauxServeur(nom, outils, journal, { blender = false, drapeauVide = null, drapeauLong = null } = {}) {
  const fichier = join(AUX, `faux-${nom}.mjs`);
  writeFileSync(
    fichier,
    `#!${NODE}
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { connect } from "node:net";
import { createInterface } from "node:readline";
const OUTILS = ${JSON.stringify(outils)};
const noter = (o) => appendFileSync(${JSON.stringify(journal)}, JSON.stringify(o) + "\\n");
noter({ demarre: true, env: { DISABLE_TELEMETRY: process.env.DISABLE_TELEMETRY, BLENDER_MCP_DISABLE_TELEMETRY: process.env.BLENDER_MCP_DISABLE_TELEMETRY, MCP_DISABLE_TELEMETRY: process.env.MCP_DISABLE_TELEMETRY, BLENDERMCP_NO_UPDATE_CHECK: process.env.BLENDERMCP_NO_UPDATE_CHECK, BLENDER_HOST: process.env.BLENDER_HOST, BLENDER_PORT: process.env.BLENDER_PORT } });
const envoyer = (o) => process.stdout.write(JSON.stringify(o) + "\\n");
const versModule = (commande) => new Promise((ok) => {
  const s = connect(Number(process.env.BLENDER_PORT), process.env.BLENDER_HOST, () => s.write(JSON.stringify(commande)));
  let recu = "";
  s.on("data", (b) => { recu += b; try { const r = JSON.parse(recu); s.end(); ok(JSON.stringify(r.result ?? r)); } catch {} });
  s.on("error", (e) => ok("ERREUR " + e.message));
});
createInterface({ input: process.stdin }).on("line", async (ligne) => {
  let m; try { m = JSON.parse(ligne); } catch { return; }
  if (m.id === undefined) return;
  if (m.method === "initialize") return envoyer({ jsonrpc: "2.0", id: m.id, result: { protocolVersion: m.params?.protocolVersion ?? "2025-06-18", capabilities: { tools: {} }, serverInfo: { name: ${JSON.stringify(nom)}, version: "1.0.0" } } });
  const long = ${drapeauLong ? `existsSync(${JSON.stringify(drapeauLong)}) ? Number(readFileSync(${JSON.stringify(drapeauLong)}, "utf8")) : 0` : "0"};
  const contrainte = long < 0 ? { enum: Array.from({ length: 100 }, (_, i) => "valeur-" + i + "x".repeat(Math.abs(long))) } : {};
  const decrire = (name) => { const d = "Outil " + name + " (faux)."; return long > d.length ? (d + " Détail de l'outil, de ses arguments et de ses limites.".repeat(Math.ceil(long / 50))).slice(0, long) : d; };
  if (m.method === "tools/list") return envoyer({ jsonrpc: "2.0", id: m.id, result: { tools: OUTILS.map((name) => ({ name, description: decrire(name), inputSchema: { type: "object", properties: { code: { type: "string", ...contrainte }, prompt: { type: "string" }, image: { type: "string" }, studio_id: { type: "string" } } } })) } });
  if (m.method === "tools/call") {
    const n = m.params?.name, a = m.params?.arguments ?? {};
    noter({ appel: n, args: a });
    let texte = "REPERE-${nom.toUpperCase()} " + n + " " + JSON.stringify(a);
    if (n === "list_roblox_studios") texte = ${drapeauVide ? `existsSync(${JSON.stringify(drapeauVide)}) ? "[]" : ` : ""}'[{"name":"Place1","studio_id":"a1b2"}]';
    if (${blender}) texte = "REPERE-BLENDER " + n + " " + (await versModule({ type: n, params: a }));
    return envoyer({ jsonrpc: "2.0", id: m.id, result: { content: [{ type: "text", text: texte }] } });
  }
  envoyer({ jsonrpc: "2.0", id: m.id, result: {} });
});
`,
  );
  chmodSync(fichier, 0o755);
  return fichier;
}
const lireJournal = (f) => (existsSync(f) ? readFileSync(f, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l)) : []);
const JOURNAL_ROBLOX = join(AUX, "journal-roblox.jsonl");
const JOURNAL_BLENDER = join(AUX, "journal-blender.jsonl");
const VIDE_ROBLOX = join(AUX, "roblox-vide");
const LONG_ROBLOX = join(AUX, "roblox-long");
const FAUX_ROBLOX = fauxServeur("roblox", [...LECTURES_ROBLOX, ...ECRITURES_ROBLOX], JOURNAL_ROBLOX, { drapeauVide: VIDE_ROBLOX, drapeauLong: LONG_ROBLOX });
const FAUX_BLENDER = fauxServeur("blender", [...LECTURES_BLENDER, ...ECRITURES_BLENDER], JOURNAL_BLENDER, { blender: true });
const appelsDe = (f) => lireJournal(f).filter((e) => e.appel).map((e) => e.appel);

/** Le faux module de Blender : JSON par commande, comme `BlenderMCPServer` du module. */
const recuModule = [];
function fauxModule(port) {
  const s = serveurTcp((c) => {
    let recu = "";
    c.on("data", (b) => {
      recu += b;
      try {
        const commande = JSON.parse(recu);
        recu = "";
        recuModule.push(commande);
        c.write(JSON.stringify({ status: "success", result: { scene: "Cube, Camera, Light", commande: commande.type } }));
      } catch {
        /* commande incomplète */
      }
    });
    c.on("error", () => undefined);
  });
  return new Promise((ok) => s.listen(port, "127.0.0.1", () => ok(s)));
}
const fermerServeur = (s) => new Promise((ok) => s.close(() => ok()));

async function autreProgramme(port) {
  const p = spawn("/usr/bin/nc", ["-l", "127.0.0.1", String(port)], { stdio: ["ignore", "pipe", "ignore"] });
  const etat = { processus: p, recu: "" };
  p.stdout.on("data", (b) => (etat.recu += b));
  for (let i = 0; i < 40; i++) {
    try {
      if (execFileSync("/usr/sbin/lsof", ["-nP", "-a", `-iTCP:${port}`, "-sTCP:LISTEN", "-t"], { encoding: "utf8" }).trim()) break;
    } catch {
      /* pas encore à l'écoute */
    }
    await attendre(100);
  }
  return etat;
}
const arreterAutre = async (a) => {
  a.processus.kill("SIGKILL");
  await attendre(300);
};

const json = (res, statut, corps) => {
  res.writeHead(statut, { "Content-Type": "application/json" });
  res.end(JSON.stringify(corps));
};
const texteDe = (m) => (typeof m?.content === "string" ? m.content : Array.isArray(m?.content) ? m.content.map((p) => p.text ?? "").join(" ") : "");
function decision(demande) {
  const messages = Array.isArray(demande.messages) ? demande.messages : [];
  const question = texteDe([...messages].reverse().find((m) => m.role === "user"));
  const resultats = messages.filter((m) => m.role === "tool").map(texteDe);
  const noms = (demande.tools ?? []).map((o) => o.function?.name);
  const plan = /PLAN:(\[.*\])/s.exec(question);
  if (!plan) return { content: "Réponse sans outil." };
  const appels = JSON.parse(plan[1]);
  if (resultats.length < appels.length) {
    const [nom, args] = appels[resultats.length];
    if (!noms.includes(nom)) return { content: `OUTIL-ABSENT ${nom}` };
    return { tool_calls: [{ index: 0, id: `appel-${resultats.length}`, type: "function", function: { name: nom, arguments: JSON.stringify(args) } }] };
  }
  return { content: `FIN ${resultats.join(" || ")}` };
}
// Ce que le faux modèle a reçu, demande par demande : les noms des outils proposés, et sa consigne.
const DEMANDES_MODELE = [];
const fauxModele = serveurHttp(async (req, res) => {
  const morceaux = [];
  for await (const m of req) morceaux.push(m);
  const url = new URL(req.url ?? "/", "http://x");
  if (url.pathname === "/v1/models") return json(res, 200, { object: "list", data: [{ id: "essai-outils", object: "model" }] });
  if (url.pathname !== "/v1/chat/completions") return json(res, 404, {});
  const demande = JSON.parse(Buffer.concat(morceaux).toString("utf8") || "{}");
  DEMANDES_MODELE.push({ outils: (demande.tools ?? []).map((o) => o.function?.name), systeme: texteDe((demande.messages ?? []).find((m) => m.role === "system")) });
  const delta = { role: "assistant", ...decision(demande) };
  res.writeHead(200, { "Content-Type": "text/event-stream" });
  const morceau = (o) => res.write(`data: ${JSON.stringify({ id: "essai", object: "chat.completion.chunk", created: 1, model: demande.model, ...o })}\n\n`);
  morceau({ choices: [{ index: 0, delta }] });
  morceau({ choices: [{ index: 0, delta: {}, finish_reason: delta.tool_calls ? "tool_calls" : "stop" }] });
  morceau({ choices: [], usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 } });
  res.end("data: [DONE]\n\n");
});
const PORT_MODELE = await portLibre();
await new Promise((ok) => fauxModele.listen(PORT_MODELE, "127.0.0.1", ok));

/* ------------------------------------------------------------------------- */
/* B. La passerelle d'essai                                                   */
/* ------------------------------------------------------------------------- */

const PORT_BLENDER = await portLibre();
const PREALABLE = join(AUX, "prealable.mjs");
const SORTIES = join(AUX, "sorties-refusees.log");
writeFileSync(
  PREALABLE,
  `import { appendFileSync } from "node:fs";
const fetchOrigine = globalThis.fetch;
globalThis.fetch = async (entree, options = {}) => {
  const brute = typeof entree === "string" || entree instanceof URL ? String(entree) : entree.url;
  const a = new URL(brute);
  if (["127.0.0.1", "localhost", "[::1]"].includes(a.hostname)) return fetchOrigine(entree, options);
  appendFileSync(${JSON.stringify(SORTIES)}, a.href + "\\n");
  throw new TypeError("fetch failed (essai : aucune sortie vers " + a.hostname + ")");
};
`,
);
const ESPACE = join(AUX, "espace");
mkdirSync(ESPACE, { recursive: true });
const DONNEES = join(AUX, "donnees");
const PROFIL = join(AUX, "profil.json");
writeFileSync(PROFIL, JSON.stringify({ chiffrement: "fichier", backends: [{ id: "lmstudio", enabled: false }, { id: "exo", enabled: false }, { id: "essai", label: "Essai", baseUrl: `http://127.0.0.1:${PORT_MODELE}/v1`, contexte: 32768 }] }));
// La taille de la capture de Medhi du 23/10/2026 (32 768) : sans elle, la place n'est pas mesurée et tous les outils partent.

async function lancerPasserelle() {
  const port = await portLibre();
  const env = {
    ...process.env,
    HELIX_CONFIG: PROFIL,
    HELIX_GATEWAY_PORT: String(port),
    HELIX_DATA_DIR: DONNEES,
    HELIX_WORKSPACE: ESPACE,
    HELIX_CODE_DIR: ESPACE,
    HELIX_LMSTUDIO_URL: "http://127.0.0.1:9/v1",
    HELIX_EXO_URL: "http://127.0.0.1:9/v1",
    HELIX_GATEWAY_HOST: "127.0.0.1",
    HELIX_ESSAI_ROBLOX_EXECUTABLE: FAUX_ROBLOX,
    HELIX_ESSAI_BLENDER_SERVEUR: FAUX_BLENDER,
    HELIX_ESSAI_BLENDER_PORT: String(PORT_BLENDER),
    HELIX_ESSAI_BLENDER_EXECUTABLE: NODE,
  };
  const processus = spawn(process.execPath, ["--import", PREALABLE, join(RACINE, "gateway", "src", "index.ts")], { env, stdio: ["ignore", "pipe", "pipe"] });
  const inst = { port, processus, journal: "", G: `http://127.0.0.1:${port}` };
  processus.stdout.on("data", (b) => (inst.journal += b));
  processus.stderr.on("data", (b) => (inst.journal += b));
  for (let i = 0; i < 160; i++) {
    try {
      await fetch(`${inst.G}/health`);
      break;
    } catch {
      await attendre(250);
    }
  }
  const jeton = readFileSync(join(DONNEES, "instance-token"), "utf8").trim();
  inst.J = { "Content-Type": "application/json", Authorization: `Bearer ${jeton}`, "X-Helix-Langue": "fr" };
  return inst;
}
const api = async (inst, chemin, corps, entetes = inst.A) => {
  const r = await fetch(`${inst.G}${chemin}`, corps === undefined ? { headers: entetes } : { method: "POST", headers: entetes, body: JSON.stringify(corps) });
  return { statut: r.status, ...(await r.json().catch(() => ({}))) };
};
async function chat(inst, plan, accorder = () => true, entetes = inst.A, demande = "") {
  const enCours = fetch(`${inst.G}/v1/chat/completions`, {
    method: "POST",
    headers: entetes,
    body: JSON.stringify({ model: "essai-outils", stream: true, tools: true, effort: "aucun", messages: [{ role: "user", content: `${demande}PLAN:${JSON.stringify(plan)}` }] }),
  }).then((r) => r.text());
  let fini = false;
  enCours.finally(() => (fini = true));
  const cartes = [];
  while (!fini) {
    const e = await api(inst, "/helix/approbation", undefined, entetes);
    for (const c of e.enAttente ?? []) {
      if (cartes.some((x) => x.id === c.id)) continue;
      cartes.push(c);
      await api(inst, "/helix/approbation/repondre", { id: c.id, accord: accorder(c) }, entetes);
    }
    await attendre(120);
  }
  const evenements = [];
  let texte = "";
  for (const ligne of (await enCours).split("\n")) {
    if (!ligne.startsWith("data: ") || ligne === "data: [DONE]") continue;
    try {
      const j = JSON.parse(ligne.slice(6));
      if (j.helix) evenements.push(j.helix);
      const d = j.choices?.[0]?.delta?.content;
      if (typeof d === "string") texte += d;
    } catch {
      /* ligne partielle */
    }
  }
  return { texte, fins: evenements.filter((e) => e.type === "tool_end"), cartes };
}
const resultat = (r, i = 0) => `${r.fins[i]?.preview ?? ""} ${r.texte}`;

console.log("\nB. La passerelle : branchement, cartes d'accord, reconnaissance de Blender, retrait");
const passerelle = await lancerPasserelle();
let module = null;
const comptes = { alice: null, collegue: null };
try {
  const cree = await api(passerelle, "/helix/auth/create", { fullName: "Alice Essai", email: "alice@example.test", password: "Mot2PasseSolide!42" }, passerelle.J);
  passerelle.A = { ...passerelle.J, "X-Helix-Session": cree.session?.token };
  verifier("la passerelle d'essai démarre et ouvre une séance (premier compte : administrateur)", Boolean(cree.session?.token), passerelle.journal.slice(-1500));

  const etat0 = await api(passerelle, "/helix/connecteurs");
  const fiches = (etat0.catalogue ?? []).filter((e) => e.id === "roblox" || e.id === "blender");
  verifier("sur ce Mac, les fiches « Roblox Studio » et « Blender » sont proposées, lancées sur la machine, sans adresse ni commande", fiches.length === 2 && fiches.every((f) => f.lanceur === true && !f.url && !f.command), fiches);

  /* ---- Roblox Studio ---- */
  writeFileSync(VIDE_ROBLOX, "");
  const brancheVide = await api(passerelle, "/helix/connecteurs/connecter", { id: "roblox", command: "/bin/sh", args: ["-c", "id"], url: "http://127.0.0.1:9/mcp" });
  const instR = (brancheVide.etat?.installes ?? []).find((c) => c.id === "roblox");
  const nbRoblox = LECTURES_ROBLOX.length + ECRITURES_ROBLOX.length;
  verifier(
    `Roblox Studio branché d'un clic : le serveur de Studio lancé, ses ${nbRoblox} outils listés ; aucun Studio ne répond encore, l'écran dit d'activer « Enable Studio as MCP server »`,
    brancheVide.statut === 200 && brancheVide.pret && instR?.running && instR.toolCount === nbRoblox && instR.local === true && /Enable Studio as MCP server/.test(brancheVide.message),
    `${brancheVide.message} ${JSON.stringify(instR)}`,
  );
  verifier("la commande, les arguments et l'adresse glissés dans la requête sont ignorés : c'est le serveur de Studio qui a démarré", lireJournal(JOURNAL_ROBLOX).some((e) => e.demarre) && !passerelle.journal.includes("uid="), passerelle.journal.slice(-300));
  rmSync(VIDE_ROBLOX);
  const rebranche = await api(passerelle, "/helix/connecteurs/connecter", { id: "roblox" });
  verifier("un Studio répond : le branchement le dit sans conseil", rebranche.statut === 200 && !/Enable Studio/.test(rebranche.message), rebranche.message);

  const lecture = await chat(passerelle, [["roblox__script_read", { studio_id: "a1b2", path: "game.ServerScriptService.Main" }], ["roblox__search_game_tree", { studio_id: "a1b2" }]]);
  verifier("Chat : lire un script et l'arbre des instances passe sans carte", lecture.cartes.length === 0 && lecture.fins.every((f) => f.ok) && /REPERE-ROBLOX script_read/.test(lecture.texte), `${JSON.stringify(lecture.cartes)} ${lecture.texte}`);

  const avantLuau = appelsDe(JOURNAL_ROBLOX).length;
  const luau = await chat(passerelle, [["roblox__execute_luau", { studio_id: "a1b2", datamodel_type: "Edit", code: "print('REPERE-CODE-LUAU')" }]]);
  const carteLuau = luau.cartes[0];
  verifier(
    "exécuter du Luau : une carte, le code en entier dessus, cet appel seulement ; acceptée, l'appel part",
    luau.cartes.length === 1 && carteLuau.detail?.outil === "roblox__execute_luau" && carteLuau.detail?.unique === true && /REPERE-CODE-LUAU/.test(carteLuau.detail?.arguments ?? "") && /Luau/.test(carteLuau.resume) && luau.fins[0]?.ok && appelsDe(JOURNAL_ROBLOX).slice(avantLuau).includes("execute_luau"),
    `${JSON.stringify(luau.cartes)} ${JSON.stringify(luau.fins)}`,
  );
  const avantRefus = appelsDe(JOURNAL_ROBLOX).length;
  const non = await chat(passerelle, [["roblox__generate_mesh", { studio_id: "a1b2", prompt: "un château" }]], () => false);
  verifier(
    "générer un objet : la carte dit « chez Roblox, hors de cette machine » ; refusée, rien n'arrive à Studio",
    non.cartes.length === 1 && non.cartes[0].detail?.horsMachine === "roblox-generation" && non.fins[0]?.ok === false && appelsDe(JOURNAL_ROBLOX).length === avantRefus,
    `${JSON.stringify(non.cartes)} ${appelsDe(JOURNAL_ROBLOX).slice(avantRefus)}`,
  );

  await api(passerelle, "/helix/approbation/niveau", { niveau: "tout" });
  const tout = await chat(passerelle, [["roblox__get_console_output", { studio_id: "a1b2" }], ["roblox__multi_edit", { studio_id: "a1b2" }], ["roblox__store_image", { path: "/Users/x/photo.png" }], ["roblox__nouvel_outil_inconnu", {}]]);
  verifier(
    "au niveau « Tout approuver » : la console se lit seule ; modifier un script, lire un fichier de la machine (store_image) et un outil inconnu demandent toujours",
    tout.cartes.map((c) => c.detail?.outil).join(",") === "roblox__multi_edit,roblox__store_image,roblox__nouvel_outil_inconnu" && tout.fins.every((f) => f.ok),
    `${tout.cartes.map((c) => c.detail?.outil)} ${JSON.stringify(tout.fins)}`,
  );
  await api(passerelle, "/helix/approbation/niveau", { niveau: "modifications" });

  // Un collègue non administrateur : il lit, mais ne modifie ni n'exécute rien.
  const coll = await api(passerelle, "/helix/auth/create", { fullName: "Collègue", email: "collegue@example.test", password: "Provisoire2Collegue!7" });
  comptes.alice = cree.account?.id ?? null;
  comptes.collegue = coll.account?.id ?? null;
  const connexion = await api(passerelle, "/helix/auth/mot-de-passe-provisoire", { accountId: coll.account?.id, password: "Provisoire2Collegue!7", nouveau: "Collegue2PasseSolide!9" }, passerelle.J);
  const B = { ...passerelle.J, "X-Helix-Session": connexion.session?.token };
  const avantB = appelsDe(JOURNAL_ROBLOX).length;
  const parB = await chat(passerelle, [["roblox__script_read", { studio_id: "a1b2" }], ["roblox__execute_luau", { studio_id: "a1b2", code: "print(1)" }], ["blender__execute_blender_code", { code: "print(1)" }]], () => true, B);
  verifier(
    "collègue non administrateur : il lit ; exécuter du Luau est refusé (administrateur seul) **avant toute carte**, et n'arrive pas à Studio",
    Boolean(connexion.session?.token) && parB.fins[0]?.ok && parB.fins[1]?.ok === false && /réservé à l'administrateur/.test(resultat(parB, 1)) && parB.cartes.length === 0 && !appelsDe(JOURNAL_ROBLOX).slice(avantB).includes("execute_luau"),
    `${JSON.stringify(parB.fins)} cartes : ${JSON.stringify(parB.cartes.map((c) => c.detail?.outil))}`,
  );

  /* ---- Blender ---- */
  const ferme = await api(passerelle, "/helix/connecteurs/connecter", { id: "blender" });
  verifier("Blender fermé (personne sur le port de son module) : refus clair, avec le fichier du module à installer, rien n'est branché", ferme.statut === 400 && /ne répond pas sur le port de son module MCP/.test(ferme.message) && !(ferme.etat?.installes ?? []).some((c) => c.id === "blender"), ferme.message);

  const autre = await autreProgramme(PORT_BLENDER);
  const refusAutre = await api(passerelle, "/helix/connecteurs/connecter", { id: "blender" });
  await attendre(300);
  verifier(
    "un autre programme sur le port du module : refus « ce n'est pas Blender », le serveur n'est pas lancé et le programme ne reçoit rien",
    refusAutre.statut === 400 && /Un autre programme occupe le port du module MCP de Blender/.test(refusAutre.message) && autre.recu === "" && !lireJournal(JOURNAL_BLENDER).some((e) => e.demarre),
    `${refusAutre.message} | reçu : ${JSON.stringify(autre.recu.slice(0, 200))}`,
  );
  await arreterAutre(autre);

  module = await fauxModule(PORT_BLENDER);
  const brancheB = await api(passerelle, "/helix/connecteurs/connecter", { id: "blender" });
  const instB = (brancheB.etat?.installes ?? []).find((c) => c.id === "blender");
  verifier(
    `Blender reconnu : branché d'un clic, ses ${LECTURES_BLENDER.length + ECRITURES_BLENDER.length} outils listés`,
    brancheB.statut === 200 && brancheB.pret && instB?.running && instB.toolCount === LECTURES_BLENDER.length + ECRITURES_BLENDER.length,
    `${brancheB.message} ${JSON.stringify(instB)}`,
  );
  const envServeur = lireJournal(JOURNAL_BLENDER).find((e) => e.demarre)?.env ?? {};
  verifier(
    "le serveur de Blender a reçu la télémétrie coupée (trois variables), pas de vérification de mise à jour, et l'adresse du module écrite par Helix",
    envServeur.DISABLE_TELEMETRY === "1" && envServeur.BLENDER_MCP_DISABLE_TELEMETRY === "1" && envServeur.MCP_DISABLE_TELEMETRY === "1" && envServeur.BLENDERMCP_NO_UPDATE_CHECK === "1" && envServeur.BLENDER_HOST === "127.0.0.1" && envServeur.BLENDER_PORT === String(PORT_BLENDER),
    envServeur,
  );

  const scene = await chat(passerelle, [["blender__get_scene_info", {}]]);
  verifier("Chat : lire la scène passe sans carte, la demande arrive au module", scene.cartes.length === 0 && scene.fins[0]?.ok && /Cube, Camera, Light/.test(scene.texte) && recuModule.some((c) => c.type === "get_scene_info"), `${JSON.stringify(scene.cartes)} ${scene.texte}`);

  const avantLook = recuModule.length;
  const look = await chat(passerelle, [["blender__look", { image: "/Users/alice/.ssh/cle-privee" }]], () => false);
  verifier(
    "look avec une image qui n'est pas celle de Blender (ici un fichier sans extension) : une carte qui le dit ; refusée, rien n'arrive au module",
    look.cartes.length === 1 && look.cartes[0].detail?.unique === true && /fichier de cette machine/.test(look.cartes[0].resume) && look.fins[0]?.ok === false && recuModule.length === avantLook,
    `${JSON.stringify(look.cartes)} ${JSON.stringify(look.fins)}`,
  );
  const rendu = await chat(passerelle, [["blender__look", { image: "Render Result" }], ["blender__look", {}]]);
  verifier("look de « Render Result » ou de la scène : sans carte, la demande arrive au module", rendu.cartes.length === 0 && rendu.fins.every((f) => f.ok) && recuModule.filter((c) => c.type === "look").length === 2, `${JSON.stringify(rendu.cartes)} ${JSON.stringify(rendu.fins)}`);

  const code = await chat(passerelle, [["blender__execute_blender_code", { code: "import bpy; bpy.ops.mesh.primitive_cube_add()  # REPERE-CODE-PY" }]]);
  verifier(
    "exécuter du Python dans Blender : une carte, le code en entier dessus ; acceptée, la commande arrive au module",
    code.cartes.length === 1 && code.cartes[0].detail?.unique === true && /REPERE-CODE-PY/.test(code.cartes[0].detail?.arguments ?? "") && /Python dans Blender/.test(code.cartes[0].resume) && code.fins[0]?.ok && recuModule.some((c) => c.type === "execute_blender_code"),
    `${JSON.stringify(code.cartes)} ${JSON.stringify(code.fins)}`,
  );
  const avantGen = recuModule.length;
  const gen = await chat(passerelle, [["blender__generate_3d", { prompt: "une chaise" }], ["blender__search_assets", { source: "polyhaven", query: "bois" }]], () => false);
  verifier(
    "générer ou chercher en ligne : la carte dit ce qui sort de la machine ; refusées, rien n'arrive au module",
    gen.cartes.map((c) => c.detail?.horsMachine).join(",") === "blender-generation,blender-bibliotheque" && gen.fins.every((f) => f.ok === false) && recuModule.length === avantGen,
    `${JSON.stringify(gen.cartes.map((c) => c.detail))}`,
  );

  // Le module fermé, un autre programme prend le port : rien ne lui est envoyé.
  await fermerServeur(module);
  module = null;
  const intrus = await autreProgramme(PORT_BLENDER);
  const versIntrus = await chat(passerelle, [["blender__get_scene_info", {}]]);
  await attendre(300);
  verifier(
    "Blender remplacé par un autre programme en cours de route : l'appel échoue en le disant, l'intrus ne reçoit rien",
    versIntrus.fins[0]?.ok === false && /Un autre programme occupe le port du module MCP de Blender/.test(resultat(versIntrus)) && intrus.recu === "",
    `${JSON.stringify(versIntrus.fins)} | reçu : ${JSON.stringify(intrus.recu.slice(0, 200))}`,
  );
  await arreterAutre(intrus);
  const ferme2 = await chat(passerelle, [["blender__get_scene_info", {}]]);
  verifier("Blender fermé : l'appel échoue en disant que Blender ne répond pas", ferme2.fins[0]?.ok === false && /ne répond pas/.test(resultat(ferme2)), JSON.stringify(ferme2.fins));
  const etatFerme = await api(passerelle, "/helix/connecteurs");
  const ligneB = (etatFerme.installes ?? []).find((c) => c.id === "blender");
  verifier("l'écran des connecteurs dit l'état du moment : Blender ne répond pas", ligneB && (ligneB.running === false ? /ne répond pas/.test(ligneB.error ?? "") : true), ligneB);

  /*
   * Place limitée (captures de Medhi du 23/10/2026) : Roblox Studio branché,
   * modèle à 32 768 jetons, « crée un sol en bois dans Roblox Studio ». Tous
   * les outils branchés ne tiennent pas : Helix les retirait tous, et le
   * modèle disait ne pas avoir accès à Roblox Studio. Ici, les descriptions de
   * Roblox sont allongées (`LONG_ROBLOX`) jusqu'à dépasser la place.
   */
  const nbRobloxTous = LECTURES_ROBLOX.length + ECRITURES_ROBLOX.length;
  const demanderSol = async (caracteres) => {
    writeFileSync(LONG_ROBLOX, String(caracteres));
    await api(passerelle, "/helix/connecteurs/connecter", { id: "roblox" });
    const avant = DEMANDES_MODELE.length;
    const r = await chat(passerelle, [["roblox__execute_luau", { studio_id: "a1b2", datamodel_type: "Edit", code: "local p = Instance.new('Part') p.Material = Enum.Material.Wood p.Parent = workspace" }]], () => true, passerelle.A, "Crée un sol en bois dans Roblox Studio. ");
    const recu = DEMANDES_MODELE.slice(avant);
    const outils = recu[0]?.outils ?? [];
    const ligne = passerelle.journal.split("\n").filter((l) => /outils \(~\d+ jetons\)/.test(l)).at(-1) ?? "";
    console.log(`    mesure (${caracteres} caractères par outil de Roblox) : ${ligne.trim().slice(0, 260)}`);
    return { ...r, outils, roblox: outils.filter((n) => n.startsWith("roblox__")).length, systeme: recu[0]?.systeme ?? "", ligne };
  };
  // a. Roblox seul plus grand que la place des outils : avant, tous retirés ; maintenant, les siens d'abord, et c'est dit, sans conseiller 32 768 à un modèle déjà à 32 768.
  const solA = await demanderSol(3000);
  verifier(
    "descriptions longues : tous les outils Roblox tiennent après allègement et l’appel part à Studio",
    solA.roblox === nbRobloxTous && solA.outils.includes("roblox__execute_luau") && solA.fins[0]?.ok === true && !/OUTIL-ABSENT/.test(solA.texte),
    `${solA.outils.length} outils reçus (${solA.roblox} de Roblox) ; ${solA.texte.slice(0, 300)}`,
  );
  verifier(
    "descriptions allégées : aucun avertissement sur des outils Roblox conservés",
    !/certains outils de Roblox Studio n'ont pas tenu/.test(solA.texte),
    solA.texte.slice(0, 500),
  );
  const solContraintes = await demanderSol(-30);
  verifier(
    "contraintes incompressibles : les outils Roblox retirés sont signalés sans conseiller le contexte déjà chargé",
    solContraintes.roblox < nbRobloxTous && /certains outils de Roblox Studio n'ont pas tenu/.test(solContraintes.texte) && /retirez dans Connecteurs/.test(solContraintes.texte) && !/32 768/.test(solContraintes.texte),
    solContraintes.texte.slice(0, 500),
  );
  // b. Roblox tient seul : tous ses outils gardés, d'autres retirés, sans rien dire à l'écran ; le modèle sait ce qui lui manque.
  const solB = await demanderSol(1800);
  verifier(
    "place limitée, Roblox tient : ses outils sont tous gardés, une partie des autres retirée, l'appel part à Studio",
    solB.roblox === nbRobloxTous && /gardés/.test(solB.ligne) && solB.fins[0]?.ok === true && !/OUTIL-ABSENT/.test(solB.texte),
    `${solB.outils.length} outils reçus (${solB.roblox} de Roblox) ; ${solB.texte.slice(0, 300)} ; ${solB.ligne}`,
  );
  verifier(
    "aucun outil utile retiré : rien à l'écran ; la consigne du modèle dit quels services ne lui sont pas proposés",
    !/n'a qu'une conversation de/.test(solB.texte) && /Faute de place, une partie des outils branchés/.test(solB.systeme),
    `${solB.texte.slice(0, 300)} | ${solB.systeme.slice(-300)}`,
  );
  // Sans service nommé : les outils courants passent d'abord, Roblox n'est pas « utile » à cette demande.
  const avantNeutre = DEMANDES_MODELE.length;
  const neutre = await chat(passerelle, [], () => true, passerelle.A, "Bonjour, que sais-tu faire ? ");
  const outilsNeutre = DEMANDES_MODELE[avantNeutre]?.outils ?? [];
  verifier(
    "sans service nommé : les outils courants (fichiers) sont gardés, une partie des autres retirée, sans avertissement à l'écran",
    outilsNeutre.some((n) => n.startsWith("fichiers__")) && outilsNeutre.length < solB.outils.length + 40 && /gardés/.test(passerelle.journal.split("\n").filter((l) => /outils \(~\d+ jetons\)/.test(l)).at(-1) ?? "") && !/n'a qu'une conversation de/.test(neutre.texte),
    `${outilsNeutre.length} outils : ${outilsNeutre.join(",").slice(0, 300)} | ${neutre.texte.slice(0, 300)}`,
  );
  rmSync(LONG_ROBLOX);
  await api(passerelle, "/helix/connecteurs/connecter", { id: "roblox" });

  // Ce que Helix aurait posé pour Blender (ici, un témoin) : effacé au retrait, et l'écran dit de décocher le module.
  mkdirSync(join(DONNEES, "blender-mcp", "venv"), { recursive: true });
  writeFileSync(join(DONNEES, "blender-mcp", "version.txt"), "2.1.9\n");
  const retraitR = await api(passerelle, "/helix/connecteurs/retirer", { id: "roblox" });
  const retraitB = await api(passerelle, "/helix/connecteurs/retirer", { id: "blender" });
  verifier(
    "retirer Blender : l'environnement posé par Helix (<données>/blender-mcp) est effacé, et l'écran dit de décocher le module « MCP for Blender » (port ouvert sans mot de passe sinon)",
    retraitB.statut === 200 && !existsSync(join(DONNEES, "blender-mcp")) && /décochez aussi le module « MCP for Blender »/.test(retraitB.message ?? "") && !/décochez/.test(retraitR.message ?? ""),
    `${retraitB.message} | ${existsSync(join(DONNEES, "blender-mcp"))}`,
  );
  const plusLa = await chat(passerelle, [["roblox__script_read", {}]]);
  const etatFin = await api(passerelle, "/helix/connecteurs");
  verifier("retirés : plus dans la liste, plus aucun outil proposé au modèle", !(etatFin.installes ?? []).some((c) => c.id === "roblox" || c.id === "blender") && /OUTIL-ABSENT roblox__script_read/.test(plusLa.texte), plusLa.texte);

  const sorties = (() => {
    try {
      // La vérification de version d'OpenClaw (registre npm) est celle de la passerelle, pas de ces connecteurs.
      return readFileSync(SORTIES, "utf8").trim().split("\n").filter((l) => l && !l.startsWith("https://registry.npmjs.org/"));
    } catch {
      return [];
    }
  })();
  verifier("aucune sortie réseau hors de la machine pendant l'essai", sorties.length === 0, sorties.join(" "));
} catch (err) {
  verifier("partie B sans exception", false, `${err?.stack ?? String(err)} ${passerelle.journal.slice(-1200)}`);
}
passerelle.processus.kill("SIGTERM");
await attendre(1200);
if (module) await fermerServeur(module);

/*
 * Les employés OpenClaw (relecture du 12/10/2026) : leur `userId` vaut
 * `employe:<id>`, jamais administrateur. Une écriture de Roblox ou de Blender
 * passe si la propriétaire de l'employé administre l'instance, pas sinon ;
 * Palmier Pro reste à l'administrateur seul. Contre les comptes de la
 * passerelle d'essai (Alice administratrice, le collègue non), dans un
 * processus à part qui lit le même dossier de données, passerelle arrêtée.
 */
{
  const script = join(AUX, "employes.mjs");
  writeFileSync(
    script,
    `const o = await import(${JSON.stringify(pathToFileURL(join(RACINE, "gateway", "src", "outils.ts")).href)});
const [alice, collegue] = process.argv.slice(2);
const r = async (nom, args, pour) => (await o.refusApplication(nom, args, pour)) === null;
console.log(JSON.stringify({
  aliceEmploye: await r("roblox__execute_luau", {}, { userId: "employe:a1", proprietaire: alice }),
  aliceEmployeBlender: await r("blender__execute_blender_code", {}, { userId: "employe:a1", proprietaire: alice }),
  aliceEmployeLook: await r("blender__look", { image: "/etc/hosts" }, { userId: "employe:a1", proprietaire: alice }),
  collegueEmploye: await r("roblox__execute_luau", {}, { userId: "employe:c1", proprietaire: collegue }),
  sansProprietaire: await r("blender__execute_blender_code", {}, { userId: "employe:x" }),
  lectureCollegue: await r("blender__get_scene_info", {}, { userId: "employe:c1", proprietaire: collegue }),
  palmierEmployeAlice: await r("palmier__generate_video", {}, { userId: "employe:a1", proprietaire: alice }),
  palmierAlice: await r("palmier__generate_video", {}, { userId: alice }),
  listeAlice: await o.ecrituresApplicationsPourEmploye(alice),
  listeCollegue: await o.ecrituresApplicationsPourEmploye(collegue),
}));
process.exit(0);
`,
  );
  let sortie = "";
  try {
    sortie = execFileSync(process.execPath, [script, comptes.alice ?? "", comptes.collegue ?? ""], { encoding: "utf8", timeout: 60_000, env: { ...process.env, HELIX_CONFIG: PROFIL, HELIX_DATA_DIR: DONNEES, HELIX_WORKSPACE: ESPACE } });
  } catch (err) {
    sortie = String(err?.stdout ?? "") + String(err?.stderr ?? err);
  }
  let v = {};
  try {
    v = JSON.parse(sortie.trim().split("\n").pop());
  } catch {
    v = { sortie };
  }
  verifier(
    "employés : écritures de Roblox Studio et de Blender (et look hors de la scène) permises à l'employé d'une administratrice, listées pour lui ; refusées et non listées pour l'employé d'un non-administrateur ou sans propriétaire ; lectures à tous",
    Boolean(comptes.alice && comptes.collegue) && v.aliceEmploye === true && v.aliceEmployeBlender === true && v.aliceEmployeLook === true && v.collegueEmploye === false && v.sansProprietaire === false && v.lectureCollegue === true && v.listeAlice === true && v.listeCollegue === false,
    v,
  );
  verifier("Palmier Pro inchangé (SECURITE.md § 63) : l'administrateur seul, pas ses employés", v.palmierAlice === true && v.palmierEmployeAlice === false, v);
}

/* ------------------------------------------------------------------------- */
/* C. Le vrai serveur de Blender (réseau requis)                              */
/* ------------------------------------------------------------------------- */

if (process.env.HELIX_ESSAI_BLENDER_RESEAU === "1") {
  console.log("\nC. Le vrai serveur de Blender : posé par Helix (empreintes), lancé contre le faux module, sorties piégées");
  try {
    for (const v of ["HELIX_ESSAI_BLENDER_SERVEUR", "HELIX_ESSAI_BLENDER_EXECUTABLE", "HELIX_ESSAI_BLENDER_PORT"]) delete process.env[v];
    process.env.HELIX_DATA_DIR = join(AUX, "donnees-c");
    const b = await importer("gateway", "src", "blender.ts");
    const debut = Date.now();
    await b.assurerServeurBlender();
    const paquets = JSON.parse(readFileSync(join(RACINE, "gateway", "src", "blender-paquets.json"), "utf8"));
    const { createHash } = await import("node:crypto");
    const module = readFileSync(b.fichierModuleBlender());
    verifier(
      `serveur posé par pip --require-hashes en ${Math.round((Date.now() - debut) / 1000)} s ; module complémentaire recopié, à l'empreinte notée`,
      b.serveurBlenderInstalle() && createHash("sha256").update(module).digest("hex") === paquets.module.sha256,
      b.fichierModuleBlender(),
    );
    // Le piège : toute sortie par un mandataire HTTP (httpx le suit) est notée.
    const piege = [];
    const serveurPiege = serveurTcp((c) => {
      c.on("data", (d) => piege.push(String(d).slice(0, 200)));
      c.on("error", () => undefined);
      c.end();
    });
    const portPiege = await portLibre();
    await new Promise((ok) => serveurPiege.listen(portPiege, "127.0.0.1", ok));
    const portModule = await portLibre();
    const faux = await fauxModule(portModule);
    const { Client } = await import("@modelcontextprotocol/sdk/client/index.js");
    const { StdioClientTransport, getDefaultEnvironment } = await import("@modelcontextprotocol/sdk/client/stdio.js");
    const { command, args } = b.commandeBlender();
    const mandataire = `http://127.0.0.1:${portPiege}`;
    const transport = new StdioClientTransport({ command, args, stderr: "pipe", env: { ...getDefaultEnvironment(), ...b.envBlender(), BLENDER_PORT: String(portModule), HTTPS_PROXY: mandataire, HTTP_PROXY: mandataire, ALL_PROXY: mandataire, https_proxy: mandataire, http_proxy: mandataire } });
    const client = new Client({ name: "essai-helix", version: "1.0.0" }, { capabilities: {} });
    await client.connect(transport, { timeout: 60_000 });
    const outils = (await client.listTools()).tools.map((o) => o.name).sort();
    const rb = await importer("gateway", "src", "blenderRegles.ts");
    const inconnus = outils.filter((n) => !rb.LECTURES_BLENDER.has(n) && !ECRITURES_BLENDER.includes(n));
    verifier(`le vrai serveur liste ${outils.length} outils, tous connus du classement (les outils réservés aux « applications » ne sont pas servis à Helix)`, outils.length > 0 && inconnus.length === 0 && outils.includes("execute_blender_code") && !outils.some((n) => n.startsWith("viewport_")), { outils, inconnus });
    const r = await client.callTool({ name: "get_scene_info", arguments: {} });
    await attendre(2500);
    verifier("un appel du vrai serveur arrive au faux module (127.0.0.1, port écrit par Helix)", recuModule.some((c) => c.type === "get_scene_info" || c.type === "execute_code" || c.type === "get_addon_info"), { recu: recuModule.slice(-4).map((c) => c.type), r: JSON.stringify(r).slice(0, 200) });
    verifier("aucune tentative de sortie réseau du vrai serveur (télémétrie coupée) : le piège n'a rien reçu", piege.length === 0, piege);
    await client.close();
    await fermerServeur(faux);
    serveurPiege.close();
  } catch (err) {
    verifier("partie C sans exception", false, err?.stack ?? String(err));
  }
}

fauxModele.close();
console.log(`\n${reussis} vérification(s) réussie(s), ${echecs.length} échec(s).`);
if (echecs.length) console.log(`Échecs :\n - ${echecs.join("\n - ")}`);
process.exit(echecs.length ? 1 : 0);
