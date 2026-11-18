import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { draftWithHelix } from "../lib/helix-ai.mjs";
import { receiveSiteContact } from "../lib/site-contact.mjs";

test("limite IA réservée au serveur et appliquée entre deux générations", async () => {
  const db = new PGlite();
  try {
    await db.exec("create role anon; create role authenticated; create role service_role; create schema auth; create table auth.users(id uuid primary key);");
    await db.exec(await readFile(new URL("../supabase/migrations/202611180001_helix_ai.sql", import.meta.url), "utf8"));
    const { rows: [{ id }] } = await db.query("insert into auth.users values (gen_random_uuid()) returning id");
    await db.exec("set role authenticated");
    await assert.rejects(db.query("select crm_claim_ai($1)", [id]), /permission denied/);
    await db.exec("reset role; set role service_role");
    assert.equal((await db.query("select crm_claim_ai($1) as allowed", [id])).rows[0].allowed, true);
    assert.equal((await db.query("select crm_claim_ai($1) as allowed", [id])).rows[0].allowed, false);
  } finally {
    await db.close();
  }
});

test("brouillon IA via la passerelle configurée, avec délai et sans outil", async t => {
  const config = { HELIX_AI_URL: "https://ia.example.test", HELIX_AI_KEY: "clé-de-test", HELIX_AI_MODEL: "modele-local" };
  for (const [key, value] of Object.entries(config)) {
    const previous = process.env[key];
    process.env[key] = value;
    t.after(() => previous === undefined ? delete process.env[key] : Reflect.set(process.env, key, previous));
  }
  const auth = { client: { rpc: async (name, input) => {
    assert.equal(name, "crm_claim_ai");
    assert.deepEqual(input, { actor: "membre" });
    return { data: true };
  } }, user: { id: "membre" } };
  const fetch = t.mock.method(globalThis, "fetch", async (url, init) => {
    assert.equal(url.href, "https://ia.example.test/v1/chat/completions");
    assert.equal(init.redirect, "error");
    assert.equal(init.headers.Authorization, "Bearer clé-de-test");
    assert.ok(init.signal instanceof AbortSignal);
    const body = JSON.parse(init.body);
    assert.equal(body.model, "modele-local");
    assert.equal(body.stream, false);
    assert.equal(body.tools, undefined);
    return Response.json({ choices: [{ message: { content: "Bonjour, voici notre proposition." } }] });
  });
  assert.deepEqual(await draftWithHelix(auth, { task: "proposal", question: "Prépare un brouillon." }), {
    text: "Bonjour, voici notre proposition.",
  });
  await assert.rejects(draftWithHelix(auth, { task: "toString", question: "Prépare un brouillon." }), /invalide/);
  assert.equal(fetch.mock.callCount(), 1);
});

test("formulaire du site : dépôt authentifié et clé de rejeu stable", async t => {
  const saved = {};
  const config = {
    SUPABASE_URL: "https://db.example.test", SUPABASE_SERVICE_ROLE_KEY: "clé-de-test",
    SITE_CONTACT_SECRET: "jeton-de-test-avec-trente-deux-caracteres",
  };
  for (const [key, value] of Object.entries(config)) {
    saved[key] = process.env[key];
    process.env[key] = value;
    t.after(() => saved[key] === undefined ? delete process.env[key] : Reflect.set(process.env, key, saved[key]));
  }
  const deliveries = [];
  t.mock.method(globalThis, "fetch", async (url, init) => {
    assert.match(String(url), /\/rpc\/crm_receive_site_contact$/);
    const { delivery, payload } = JSON.parse(init.body);
    assert.match(delivery, /^[0-9a-f]{64}$/);
    assert.equal(payload.cabinet, "Agence Démo");
    assert.equal(payload.objet, "projet");
    const duplicate = deliveries.includes(delivery);
    deliveries.push(delivery);
    return Response.json({ duplicate });
  });
  const req = {
    method: "POST", headers: {},
    body: { nom: "Camille", entreprise: "Agence Démo", email: "camille@example.test", message: "Un projet IA." },
  };
  const res = { code: 200, setHeader() {}, status(code) { this.code = code; return this; }, json(body) { return body; } };
  await receiveSiteContact(req, res);
  assert.equal(res.code, 401);
  assert.equal(deliveries.length, 0);
  req.headers.authorization = "Bearer " + config.SITE_CONTACT_SECRET;
  assert.deepEqual(await receiveSiteContact(req, res), { ok: true, duplicate: false });
  assert.deepEqual(await receiveSiteContact(req, res), { ok: true, duplicate: true });
});
