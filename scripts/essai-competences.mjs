/*
 * Compétences (23/10/2026, gateway/src/competences.ts, src/lib/competencesFichier.ts).
 *
 * Demandé par Medhi : « un système de skills, la possibilité pour les gens de
 * créer leurs skills ». Aucun vrai modèle, aucun vrai LM Studio : une
 * passerelle jetable (dossier personnel, PATH et données jetables, un « Linux
 * x64 de 16 Go » simulé comme dans essai-memoire-conversation.mjs), devant un
 * faux `lms` et un faux LM Studio qui sert un modèle chargé à 4 096 jetons
 * et note ce qu'il reçoit.
 *
 * Ce que l'essai vérifie :
 *  - une compétence créée part au modèle quand le Chat le demande, et l'écran
 *    reçoit son nom quand la demande s'y prête ; pas de nom sinon ;
 *  - quand la place manque : l'index (nom et « quand ») de toutes, le texte
 *    complet de celle qui correspond, aucun texte complet si rien ne
 *    correspond ;
 *  - sans `competences: true`, rien n'est ajouté ;
 *  - une compétence personnelle est invisible à une autre personne (copie
 *    synchronisée et modèle) ; partagée à l'organisation, elle lui sert, et
 *    elle peut l'éteindre pour elle seule ;
 *  - l'instance refuse une compétence hors bornes, ou dont un fichier joint
 *    porte un chemin ;
 *  - le vrai lecteur de l'interface (empaqueté par esbuild) lit une archive
 *    SKILL.md : nom, description, fichiers texte, image écartée, champs qui
 *    donneraient des droits ignorés et dits ; l'export se relit à l'identique ;
 *  - rien ne s'exécute : un script joint arrive au modèle comme du texte, et
 *    le fichier qu'il créerait n'existe pas.
 *
 * Ce que l'essai ne prouve pas : qu'un vrai modèle suit bien une compétence,
 * ni Code et les employés de bout en bout (PROJET.md).
 *
 *   node scripts/essai-competences.mjs
 */
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { createServer as serveurNet } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { crc32 } from "node:zlib";
import { build } from "esbuild";

const RACINE = resolve(process.env.ESSAI_RACINE ?? join(dirname(fileURLToPath(import.meta.url)), ".."));
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
const portLibre = () =>
  new Promise((ok) => {
    const s = serveurNet();
    s.listen(0, "127.0.0.1", () => {
      const { port } = s.address();
      s.close(() => ok(port));
    });
  });
let reussis = 0;
const echecs = [];
function verifier(nom, condition, obtenu) {
  if (condition) {
    reussis++;
    console.log(`  ✓ ${nom}`);
  } else {
    echecs.push(nom);
    console.log(`  ✗ ${nom}  —  obtenu : ${String(obtenu).slice(0, 600)}`);
  }
}

const ICI = mkdtempSync(join(tmpdir(), "helix-essai-competences-"));
const BIN = join(ICI, "bin");
mkdirSync(BIN);
const INTERNE = join(ICI, "maison", ".lmstudio", ".internal");
mkdirSync(INTERNE, { recursive: true });
mkdirSync(join(ICI, "espace"));
symlinkSync(process.execPath, join(BIN, "node"));
writeFileSync(join(INTERNE, "llmster-install-location.json"), JSON.stringify({ path: process.execPath, argv: [], cwd: join(ICI, "maison") }));
writeFileSync(join(INTERNE, "app-install-location.json"), JSON.stringify({ path: process.execPath }));
const MODELE = "mistralai/ministral-3-3b";
writeFileSync(join(ICI, "installes.json"), JSON.stringify([MODELE]));
writeFileSync(join(ICI, "charges.json"), JSON.stringify([{ cle: MODELE, contexte: 4096 }]));
writeFileSync(
  join(BIN, "lms"),
  [
    "#!/usr/bin/env node",
    'const fs = require("node:fs"), path = require("node:path");',
    "const dir = process.env.FAUX_LMS_DIR, a = process.argv.slice(2);",
    'const lire = (n) => { try { return JSON.parse(fs.readFileSync(path.join(dir, n), "utf8")); } catch { return []; } };',
    'const charges = lire("charges.json"), installes = lire("installes.json"), json = a.includes("--json");',
    'if (a[0] === "version") console.log("lms 0.0.0-essai");',
    'else if (a[0] === "ps") console.log(JSON.stringify(charges.map((c) => ({ modelKey: c.cle, path: c.cle, identifier: c.cle, type: "llm", sizeBytes: 2.5e9, contextLength: c.contexte, status: "idle" }))));',
    'else if (a[0] === "ls") console.log(json ? JSON.stringify(installes.map((k) => ({ modelKey: k, path: k, type: "llm", sizeBytes: 2.5e9, paramsString: "3B", maxContextLength: 262144 }))) : installes.join("\\n"));',
    'else if (a[0] === "server") console.log(JSON.stringify({ running: true }));',
  ].join("\n"),
);
chmodSync(join(BIN, "lms"), 0o755);
writeFileSync(join(BIN, "security"), `#!/bin/sh\necho "$*" >> "${join(ICI, "security.log")}"\nexit 1\n`);
chmodSync(join(BIN, "security"), 0o755);

/* Le faux LM Studio : il note chaque demande et répond une phrase. */
const RECUES = [];
const PORT_LM = await portLibre();
const lm = createServer((req, res) => {
  let corps = "";
  req.on("data", (b) => (corps += b));
  req.on("end", () => {
    res.setHeader("Content-Type", "application/json");
    if (req.url === "/v1/models") return res.end(JSON.stringify({ data: [{ id: MODELE, object: "model" }] }));
    if (req.url !== "/v1/chat/completions") {
      res.statusCode = 404;
      return res.end("{}");
    }
    const d = JSON.parse(corps || "{}");
    RECUES.push(d);
    if (d.stream === false) return res.end(JSON.stringify({ choices: [{ index: 0, message: { role: "assistant", content: "Réponse d'essai." }, finish_reason: "stop" }] }));
    res.setHeader("Content-Type", "text/event-stream");
    const m = (o) => res.write(`data: ${JSON.stringify({ id: "x", object: "chat.completion.chunk", created: 1, model: d.model, ...o })}\n\n`);
    m({ choices: [{ index: 0, delta: { role: "assistant", content: "Réponse d'essai." } }] });
    m({ choices: [{ index: 0, delta: {}, finish_reason: "stop" }] });
    res.end("data: [DONE]\n\n");
  });
});
await new Promise((ok) => lm.listen(PORT_LM, "127.0.0.1", ok));

const PORT = await portLibre();
const DONNEES = join(ICI, "donnees");
writeFileSync(join(ICI, "profil.json"), JSON.stringify({ chiffrement: "fichier", autoProvision: false, backends: [{ id: "exo", enabled: false }] }));
writeFileSync(
  join(ICI, "lancer.mjs"),
  `import os from "node:os";
   Object.defineProperty(process, "platform", { value: "linux" });
   Object.defineProperty(process, "arch", { value: "x64" });
   os.totalmem = () => 16 * 1024 ** 3;
   (await import("node:module")).syncBuiltinESMExports();
   await import(${JSON.stringify(join(RACINE, "gateway", "src", "index.ts"))});`,
);
const passerelle = spawn(process.execPath, ["--experimental-strip-types", "--no-warnings", join(ICI, "lancer.mjs")], {
  cwd: RACINE,
  env: {
    PATH: `${BIN}:/usr/bin:/bin`,
    HOME: join(ICI, "maison"),
    TMPDIR: tmpdir(),
    FAUX_LMS_DIR: ICI,
    HELIX_CONFIG: join(ICI, "profil.json"),
    HELIX_DATA_DIR: DONNEES,
    HELIX_WORKSPACE: join(ICI, "espace"),
    HELIX_GATEWAY_HOST: "127.0.0.1",
    HELIX_GATEWAY_PORT: String(PORT),
    HELIX_LMSTUDIO_URL: `http://127.0.0.1:${PORT_LM}/v1`,
    HELIX_EXO_URL: "http://127.0.0.1:9/v1",
    HELIX_OPENCODE_BIN: "/usr/bin/true",
    HELIX_MEMOIRE_RESUME: "non",
  },
  stdio: ["ignore", "pipe", "pipe"],
  // Son propre groupe : à la fin, ses enfants (serveur d'outils de fichiers lancé par npm) partent avec elle.
  detached: true,
});
let journal = "";
passerelle.stdout.on("data", (b) => (journal += b));
passerelle.stderr.on("data", (b) => (journal += b));
const G = `http://127.0.0.1:${PORT}`;
for (let i = 0; i < 80; i++) {
  try {
    await fetch(`${G}/health`);
    break;
  } catch {
    await attendre(250);
  }
}
let JETON = "";
try {
  JETON = readFileSync(join(DONNEES, "instance-token"), "utf8").trim();
} catch {
  /* passerelle muette : les contrôles le diront */
}
const avecJeton = { "Content-Type": "application/json", Authorization: `Bearer ${JETON}`, "X-Helix-Langue": "fr" };
const appel = (chemin, init = {}) => fetch(`${G}${chemin}`, init).catch(() => ({ ok: false, status: 0, json: async () => ({}), text: async () => "" }));

// Deux personnes : l'administratrice (A), puis une collègue (B), qui choisit son mot de passe.
const MDP_A = `Ess-${randomBytes(12).toString("hex")}!9`;
const MDP_B = `Col-${randomBytes(12).toString("hex")}!7`;
const creeA = await (await appel("/helix/auth/create", { method: "POST", headers: avecJeton, body: JSON.stringify({ fullName: "Essai", email: "essai@example.test", password: MDP_A }) })).json().catch(() => ({}));
const SEANCE_A = creeA.session?.token ?? "";
const ID_A = creeA.account?.id ?? "";
const avecA = { ...avecJeton, "X-Helix-Session": SEANCE_A };
const PROVISOIRE = `Prov-${randomBytes(8).toString("hex")}!3`;
const creeB = await (await appel("/helix/auth/create", { method: "POST", headers: avecA, body: JSON.stringify({ fullName: "Collègue", email: "collegue@example.test", password: PROVISOIRE }) })).json().catch(() => ({}));
const ID_B = creeB.account?.id ?? "";
const connexionB = await (
  await appel("/helix/auth/mot-de-passe-provisoire", { method: "POST", headers: avecJeton, body: JSON.stringify({ accountId: ID_B, password: PROVISOIRE, nouveau: MDP_B }) })
).json().catch(() => ({}));
const SEANCE_B = connexionB.session?.token ?? "";
const avecB = { ...avecJeton, "X-Helix-Session": SEANCE_B };

/** Ce qu'un poste pousse : la liste entière de ce qu'il voit (sync.ts). */
const pousser = async (seance, liste) => {
  const r = await appel("/helix/data/competences", { method: "PUT", headers: { ...avecJeton, "X-Helix-Session": seance }, body: JSON.stringify({ value: liste }) });
  return { statut: r.status, corps: await r.json().catch(() => ({})) };
};
const relire = async (seance) => (await (await appel("/helix/data/competences", { headers: { ...avecJeton, "X-Helix-Session": seance } })).json().catch(() => ({}))).value ?? [];
const maintenant = new Date().toISOString();
const competence = (id, ownerId, champs) => ({ id, ownerId, organisationId: "org", active: true, visibilite: "personnel", createdAt: maintenant, updatedAt: maintenant, ...champs });

const envoyer = async (seance, question, options = { competences: true }) => {
  const avant = RECUES.length;
  const texte = await (
    await appel("/v1/chat/completions", {
      method: "POST",
      headers: { ...avecJeton, "X-Helix-Session": seance },
      body: JSON.stringify({ stream: true, effort: "moyen", model: MODELE, tools: false, messages: [{ role: "system", content: "Tu es l'assistant de l'entreprise." }, { role: "user", content: question }], ...options }),
    })
  ).text();
  const evenements = [];
  for (const ligne of texte.split("\n")) {
    if (!ligne.startsWith("data:")) continue;
    try {
      const j = JSON.parse(ligne.slice(5));
      if (j.helix) evenements.push(j.helix);
    } catch {
      /* [DONE] */
    }
  }
  const flux = RECUES.slice(avant).filter((r) => r.stream !== false);
  const envoye = flux.at(-1)?.messages ?? [];
  return { evenements, envoye, systeme: String(envoye[0]?.content ?? ""), corpsBrut: JSON.stringify(flux.at(-1) ?? {}) };
};
const nomsDe = (r) => r.evenements.find((e) => e.type === "competences")?.noms ?? [];

console.log(`\nEssai des compétences, sur ${RACINE}`);
verifier("deux comptes et leurs séances (administratrice et collègue)", Boolean(SEANCE_A && SEANCE_B && ID_A && ID_B), JSON.stringify({ a: Boolean(SEANCE_A), b: Boolean(SEANCE_B) }));

console.log("\n1. Une compétence créée sert dans le Chat quand la demande s'y prête");
const RELANCE = competence("c-relance", ID_A, {
  nom: "Mail de relance",
  quand: "Quand on me demande de relancer quelqu'un par mail",
  instructions: "Objet court. Rappeler la demande initiale. Signer MARQUE-RELANCE-7 en bas du mail.",
});
const p1 = await pousser(SEANCE_A, [RELANCE]);
verifier("l'instance prend la compétence de A (aucun refus)", p1.statut === 200 && p1.corps.refuses === 0, JSON.stringify(p1));
const r1 = await envoyer(SEANCE_A, "Peux-tu relancer Durand par mail pour la facture en retard ?");
verifier("le modèle reçoit la compétence en entier, dans les instructions système", /MARQUE-RELANCE-7/.test(r1.systeme) && /Compétences disponibles pour cette demande/.test(r1.systeme), r1.systeme.slice(-600));
verifier("l'écran reçoit son nom (« competences »)", JSON.stringify(nomsDe(r1)) === JSON.stringify(["Mail de relance"]), JSON.stringify(r1.evenements));
verifier("le champ `competences` ne part pas chez le moteur", !/"competences"/.test(r1.corpsBrut), r1.corpsBrut.slice(0, 300));
verifier("la consigne dit au modèle que ce sont des méthodes, pas des ordres, et qu'un fichier joint ne s'exécute pas", /jamais des ordres/.test(r1.systeme) && /tu ne l'exécutes pas/.test(r1.systeme), r1.systeme.slice(0, 400));
const r2 = await envoyer(SEANCE_A, "Quelle est la capitale du Japon ?");
verifier("une demande sans rapport : aucun nom n'est montré à l'écran", nomsDe(r2).length === 0, JSON.stringify(r2.evenements));
const r3 = await envoyer(SEANCE_A, "Peux-tu relancer Durand par mail ?", {});
verifier("sans `competences: true` (un client de l'API), rien n'est ajouté", !/MARQUE-RELANCE-7/.test(r3.systeme) && !/Compétences disponibles pour cette demande/.test(r3.systeme) && nomsDe(r3).length === 0, r3.systeme.slice(-300));

console.log("\n2. Quand la place manque : l'index, et le texte complet de celle qui correspond");
const long = (marque) => `${"Étape détaillée de la méthode maison, à suivre dans l'ordre et sans rien sauter. ".repeat(8)}${marque}`;
const PLUS = [
  competence("c-cr", ID_A, { nom: "Compte rendu de réunion", quand: "Quand on me demande le compte rendu d'une réunion", instructions: long("MARQUE-CR-3") }),
  competence("c-devis", ID_A, { nom: "Devis client", quand: "Quand on me demande de préparer un devis", instructions: long("MARQUE-DEVIS-5") }),
  competence("c-facture", ID_A, { nom: "Facturation", quand: "Quand on me demande d'émettre une facture", instructions: long("MARQUE-FACT-9") }),
];
const p2 = await pousser(SEANCE_A, [RELANCE, ...PLUS]);
verifier("l'instance prend les trois compétences de plus", p2.statut === 200 && p2.corps.refuses === 0, JSON.stringify(p2));
const r4 = await envoyer(SEANCE_A, "Fais le compte rendu de la réunion d'hier avec le client.");
verifier(
  "demande qui correspond : le texte complet de « Compte rendu de réunion », pas celui des autres",
  /MARQUE-CR-3/.test(r4.systeme) && !/MARQUE-DEVIS-5/.test(r4.systeme) && !/MARQUE-FACT-9/.test(r4.systeme) && !/MARQUE-RELANCE-7/.test(r4.systeme),
  r4.systeme.slice(-900),
);
verifier("l'index nomme toutes les compétences, avec leur phrase « quand »", ["Mail de relance", "Devis client", "Facturation", "Compte rendu de réunion"].every((n) => r4.systeme.includes(`- ${n} : Quand`)), r4.systeme.slice(-900));
verifier("l'écran reçoit seulement « Compte rendu de réunion »", JSON.stringify(nomsDe(r4)) === JSON.stringify(["Compte rendu de réunion"]), JSON.stringify(nomsDe(r4)));
const r5 = await envoyer(SEANCE_A, "Quelle est la capitale du Japon ?");
verifier("demande sans rapport : l'index seul, aucun texte complet, aucun nom à l'écran", !/MARQUE-/.test(r5.systeme) && /Devis client : Quand/.test(r5.systeme) && nomsDe(r5).length === 0, r5.systeme.slice(-500));
verifier("ce qui part tient dans la place prévue (2 000 caractères pour un modèle de 4 096 jetons)", (() => {
  const i = r4.systeme.indexOf("Compétences disponibles pour cette demande");
  return i >= 0 && r4.systeme.length - i <= 2000;
})(), r5.systeme.length);

console.log("\n3. Personnelle, partagée, éteinte pour soi");
const vuesB = await relire(SEANCE_B);
verifier("la copie synchronisée de B ne contient aucune compétence personnelle de A", Array.isArray(vuesB) && vuesB.length === 0, JSON.stringify(vuesB).slice(0, 200));
const rB1 = await envoyer(SEANCE_B, "Peux-tu relancer Durand par mail ?");
verifier("le modèle de B ne reçoit rien des compétences personnelles de A (ni texte, ni nom)", !/MARQUE-/.test(rB1.systeme) && !/Mail de relance/.test(rB1.systeme) && nomsDe(rB1).length === 0, rB1.systeme.slice(-300));
const p3 = await pousser(SEANCE_A, [RELANCE, { ...PLUS[0], visibilite: "organisation" }, PLUS[1], PLUS[2]]);
verifier("A partage « Compte rendu de réunion » à l'organisation", p3.statut === 200 && p3.corps.refuses === 0, JSON.stringify(p3));
const vuesB2 = await relire(SEANCE_B);
verifier("B la voit, et seulement elle", vuesB2.length === 1 && vuesB2[0].id === "c-cr", JSON.stringify(vuesB2.map((c) => c.id)));
const rB2 = await envoyer(SEANCE_B, "Fais le compte rendu de la réunion d'hier.");
verifier("elle sert à B quand sa demande s'y prête", /MARQUE-CR-3/.test(rB2.systeme) && JSON.stringify(nomsDe(rB2)) === JSON.stringify(["Compte rendu de réunion"]), rB2.systeme.slice(-400));
const pB = await pousser(SEANCE_B, [{ ...vuesB2[0], instructions: "Réécrite par B : MARQUE-PIRATE." }]);
const apresB = await relire(SEANCE_A);
verifier("B ne peut pas la modifier (refusé, l'original reste)", pB.corps.refuses >= 1 && apresB.find((c) => c.id === "c-cr")?.instructions.includes("MARQUE-CR-3"), JSON.stringify(pB));
const profilB = await appel("/helix/data/profiles", { method: "PUT", headers: avecB, body: JSON.stringify({ value: { [`profile:${ID_B}`]: { userId: ID_B, customInstructions: "", personalInfo: "", memoryEnabled: true, memories: [], competencesEteintes: ["c-cr"] } } }) });
const rB3 = await envoyer(SEANCE_B, "Fais le compte rendu de la réunion d'hier.");
verifier("B l'éteint pour elle seule (profil) : elle ne lui sert plus", profilB.status === 200 && !/MARQUE-CR-3/.test(rB3.systeme) && nomsDe(rB3).length === 0, rB3.systeme.slice(-300));
const rA6 = await envoyer(SEANCE_A, "Fais le compte rendu de la réunion d'hier.");
verifier("…et elle sert toujours à A", /MARQUE-CR-3/.test(rA6.systeme), rA6.systeme.slice(-300));
const pEteinte = await pousser(SEANCE_A, [{ ...RELANCE, active: false }, { ...PLUS[0], visibilite: "organisation" }, PLUS[1], PLUS[2]]);
const rA7 = await envoyer(SEANCE_A, "Peux-tu relancer Durand par mail ?");
verifier("une compétence éteinte par son autrice ne part plus", pEteinte.statut === 200 && !/MARQUE-RELANCE-7/.test(rA7.systeme) && !/Mail de relance/.test(rA7.systeme), rA7.systeme.slice(-300));

console.log("\n4. Bornes : l'instance refuse ce qui dépasse, sans tronquer");
const trop = competence("c-trop", ID_A, { nom: "Trop longue", quand: "", instructions: "x".repeat(12_001) });
const chemin = competence("c-chemin", ID_A, { nom: "Chemin", quand: "", instructions: "ok", fichiers: [{ nom: "../../etc/passwd", contenu: "x" }] });
const nombreux = competence("c-six", ID_A, { nom: "Six fichiers", quand: "", instructions: "ok", fichiers: Array.from({ length: 6 }, (_, i) => ({ nom: `f${i}.txt`, contenu: "x" })) });
const actuelles = await relire(SEANCE_A);
const p4 = await pousser(SEANCE_A, [...actuelles, trop, chemin, nombreux]);
const apres4 = await relire(SEANCE_A);
verifier(
  "procédure de plus de 12 000 caractères, fichier joint au nom de chemin, six fichiers : refusés (3), rien n'est gardé",
  p4.corps.refuses === 3 && !apres4.some((c) => ["c-trop", "c-chemin", "c-six"].includes(c.id)) && apres4.length === actuelles.length,
  JSON.stringify({ refuses: p4.corps.refuses, ids: apres4.map((c) => c.id) }),
);
const modifTrop = await pousser(SEANCE_A, apres4.map((c) => (c.id === "c-devis" ? { ...c, instructions: "y".repeat(12_001) } : c)));
const apres5 = await relire(SEANCE_A);
verifier("une modification hors bornes est refusée, l'ancienne version reste", modifTrop.corps.refuses === 1 && apres5.find((c) => c.id === "c-devis")?.instructions.includes("MARQUE-DEVIS-5"), JSON.stringify(modifTrop.corps));
const vide = await pousser(SEANCE_A, {});
verifier("un envoi qui n'est pas une liste n'efface rien", vide.statut === 400 && (await relire(SEANCE_A)).length === apres5.length, vide.statut);

console.log("\n5. Import d'un SKILL.md, par le vrai lecteur de l'interface");
const TMP = join(ICI, "lecteur");
mkdirSync(TMP);
await build({
  stdin: { contents: 'export * from "./src/lib/competencesFichier.ts";', resolveDir: RACINE, loader: "ts" },
  bundle: true,
  format: "esm",
  platform: "browser",
  outfile: join(TMP, "lecteur.mjs"),
  alias: { "@": join(RACINE, "src") },
  define: { "import.meta.env": "{}", __HELIX_VERSION__: '"essai"' },
  loader: { ".png": "empty", ".svg": "empty", ".css": "empty" },
  logLevel: "error",
});
const magasin = new Map([["helix:langue", "fr"]]);
globalThis.localStorage = {
  getItem: (k) => (magasin.has(k) ? magasin.get(k) : null),
  setItem: (k, v) => void magasin.set(k, String(v)),
  removeItem: (k) => void magasin.delete(k),
  key: (i) => [...magasin.keys()][i] ?? null,
  get length() {
    return magasin.size;
  },
  clear: () => magasin.clear(),
};
globalThis.window = globalThis;
globalThis.location = { protocol: "http:", search: "", href: "http://127.0.0.1/", hostname: "127.0.0.1" };
const L = await import(pathToFileURL(join(TMP, "lecteur.mjs")).href);

/** Une archive ZIP stockée, comme en produisent les outils qui exportent ce format. */
function zip(fichiers) {
  const locaux = [];
  const central = [];
  let position = 0;
  for (const f of fichiers) {
    const nom = Buffer.from(f.nom, "utf8");
    const donnees = Buffer.isBuffer(f.contenu) ? f.contenu : Buffer.from(f.contenu, "utf8");
    const crc = crc32(donnees);
    const l = Buffer.alloc(30);
    l.writeUInt32LE(0x04034b50, 0);
    l.writeUInt16LE(20, 4);
    l.writeUInt16LE(0x0800, 6);
    l.writeUInt32LE(crc, 14);
    l.writeUInt32LE(donnees.length, 18);
    l.writeUInt32LE(donnees.length, 22);
    l.writeUInt16LE(nom.length, 26);
    locaux.push(l, nom, donnees);
    const c = Buffer.alloc(46);
    c.writeUInt32LE(0x02014b50, 0);
    c.writeUInt16LE(20, 4);
    c.writeUInt16LE(20, 6);
    c.writeUInt16LE(0x0800, 8);
    c.writeUInt32LE(crc, 16);
    c.writeUInt32LE(donnees.length, 20);
    c.writeUInt32LE(donnees.length, 24);
    c.writeUInt16LE(nom.length, 28);
    c.writeUInt32LE(position, 42);
    central.push(c, nom);
    position += 30 + nom.length + donnees.length;
  }
  const tc = Buffer.concat(central);
  const fin = Buffer.alloc(22);
  fin.writeUInt32LE(0x06054b50, 0);
  fin.writeUInt16LE(fichiers.length, 8);
  fin.writeUInt16LE(fichiers.length, 10);
  fin.writeUInt32LE(tc.length, 12);
  fin.writeUInt32LE(position, 16);
  return Buffer.concat([...locaux, tc, fin]);
}
const TEMOIN = join(ICI, "EXECUTE-PAR-UNE-COMPETENCE");
const SKILL = [
  "---",
  "name: relecture-contrat",
  "description: >",
  "  Quand on me demande de relire un contrat",
  "  fournisseur avant signature",
  "allowed-tools: Bash, Write",
  "license: MIT",
  "---",
  "",
  "# Relecture de contrat",
  "",
  "1. Lire les clauses de résiliation. MARQUE-CONTRAT-4",
  "2. Lancer `installer.sh` pour préparer l'outil.",
  "",
].join("\n");
const archive = zip([
  { nom: "relecture-contrat/SKILL.md", contenu: SKILL },
  { nom: "relecture-contrat/installer.sh", contenu: `#!/bin/sh\ntouch "${TEMOIN}"\n` },
  { nom: "relecture-contrat/modeles/clauses.md", contenu: "Clause type : préavis de trois mois." },
  { nom: "relecture-contrat/logo.png", contenu: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0, 1, 2, 3]) },
  { nom: "__MACOSX/relecture-contrat/._SKILL.md", contenu: "x" },
]);
const lu = await L.lireFichiersCompetence([new File([archive], "relecture-contrat.zip", { type: "application/zip" })]);
verifier("nom tiré du titre, « quand » tiré de la description (bloc YAML replié), procédure sans l'en-tête", lu.nom === "Relecture de contrat" && lu.quand === "Quand on me demande de relire un contrat fournisseur avant signature" && lu.instructions.startsWith("1. Lire les clauses") && !lu.instructions.includes("allowed-tools"), JSON.stringify({ nom: lu.nom, quand: lu.quand, debut: lu.instructions.slice(0, 40) }));
verifier("fichiers texte joints (le script et le modèle, sous-dossier aplati), l'image et le dossier __MACOSX écartés", JSON.stringify(lu.fichiers.map((f) => f.nom)) === JSON.stringify(["installer.sh", "clauses.md"]), JSON.stringify(lu.fichiers.map((f) => f.nom)));
verifier("l'aperçu dit : champs ignorés (allowed-tools), code jamais exécuté, image écartée", lu.avertissements.some((a) => /allowed-tools/.test(a) && /aucun droit/.test(a)) && lu.avertissements.some((a) => /installer\.sh.*jamais exécuté/.test(a)) && lu.avertissements.some((a) => /logo\.png.*pas du texte/.test(a)), JSON.stringify(lu.avertissements));
verifier("rien n'empêche l'import, et la lecture n'a rien exécuté", lu.probleme === null && !existsSync(TEMOIN), String(lu.probleme));
const seul = await L.lireFichiersCompetence([new File(["---\nname: mail-relance\ndescription: \"Relancer un client\"\n---\nÉtapes."], "SKILL.md")]);
verifier("un SKILL.md seul : nom tiré de `name`, description entre guillemets", seul.nom === "Mail relance" && seul.quand === "Relancer un client" && seul.instructions === "Étapes.", JSON.stringify(seul));
const sansEntete = await L.lireFichiersCompetence([new File(["Juste un texte."], "notes.md")]);
verifier("un Markdown sans en-tête : lu, mais l'aperçu le dit et demande un nom", sansEntete.avertissements.some((a) => /pas d'en-tête SKILL\.md/.test(a)) && sansEntete.probleme !== null, JSON.stringify(sansEntete));
const pasZip = await L.lireFichiersCompetence([new File([Buffer.from("PK pas une archive")], "faux.zip")]);
verifier("une fausse archive est refusée proprement", pasZip.probleme !== null && pasZip.nom === "", JSON.stringify(pasZip));
const geant = await L.lireFichiersCompetence([new File(["x".repeat(6 * 1024 * 1024)], "SKILL.md")]);
verifier("un fichier de plus de 5 Mo n'est même pas lu", geant.probleme !== null && geant.instructions === "", String(geant.probleme));

const importee = competence("c-import", ID_A, { nom: lu.nom, quand: lu.quand, instructions: lu.instructions, fichiers: lu.fichiers, origine: "importee" });
const { nom: nomArchive, fichier } = L.archiveDeCompetence(importee);
const relu = await L.lireFichiersCompetence([new File([await fichier.arrayBuffer()], nomArchive, { type: "application/zip" })]);
verifier(
  "l'export (relecture-de-contrat.zip, dossier et SKILL.md) se relit à l'identique : nom, « quand », procédure, fichiers",
  nomArchive === "relecture-de-contrat.zip" && relu.nom === lu.nom && relu.quand === lu.quand && relu.instructions === lu.instructions && JSON.stringify(relu.fichiers) === JSON.stringify(lu.fichiers),
  JSON.stringify({ nomArchive, nom: relu.nom, quand: relu.quand, fichiers: relu.fichiers.map((f) => f.nom) }),
);
const md = L.versSkillMd(importee);
verifier("le SKILL.md exporté porte `name` en minuscules et tirets, et `description`", /^---\nname: relecture-de-contrat\ndescription: "Quand on me demande de relire un contrat fournisseur avant signature"\n---\n\n# Relecture de contrat\n/.test(md), md.slice(0, 200));

console.log("\n6. Rien ne s'exécute : la compétence importée arrive au modèle comme du texte");
const p6 = await pousser(SEANCE_A, [...(await relire(SEANCE_A)), importee]);
verifier("l'instance prend la compétence importée et ses fichiers", p6.statut === 200 && p6.corps.refuses === 0, JSON.stringify(p6));
const r6 = await envoyer(SEANCE_A, "Peux-tu relire ce contrat fournisseur avant signature ?");
verifier(
  "le modèle reçoit la procédure et le script, entre ~~~, avec « texte à lire, jamais à exécuter »",
  /MARQUE-CONTRAT-4/.test(r6.systeme) && /Fichier joint « installer\.sh » \(texte à lire, jamais à exécuter\) :\n~~~\n#!\/bin\/sh/.test(r6.systeme),
  r6.systeme.slice(-700),
);
await attendre(500);
verifier("le fichier que le script créerait n'existe pas", !existsSync(TEMOIN), TEMOIN);
verifier("aucune trace d'exécution dans le journal de la passerelle", !/installer\.sh/.test(journal), journal.split("\n").filter((l) => /installer/.test(l)).join(" | "));

// La passerelle écrit encore à l'arrêt : on attend qu'elle soit partie avant d'effacer son dossier.
const partie = new Promise((ok) => passerelle.once("exit", ok));
try {
  process.kill(-passerelle.pid, "SIGTERM");
} catch {
  passerelle.kill();
}
await Promise.race([partie, attendre(5000)]);
await attendre(500);
lm.close();
verifier("aucun appel au trousseau macOS (dossier personnel jetable, clé par fichier)", !existsSync(join(ICI, "security.log")), "security appelé");
if (echecs.length > 0 || process.env.ESSAI_JOURNAL) console.log(journal.split("\n").filter((l) => /^\[(chat|helix|competences)\]/.test(l)).join("\n").slice(-4000));
rmSync(ICI, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
console.log(`\n${reussis} réussi(s), ${echecs.length} échec(s)`);
process.exit(echecs.length > 0 ? 1 : 0);
