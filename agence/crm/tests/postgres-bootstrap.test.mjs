import { postgresQuery } from "../lib/postgres-data.mjs";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

test("PostgreSQL autonome : schéma privé, ingestion et refus de réinstallation", async () => {
  const script = fileURLToPath(new URL("../scripts/postgres-bootstrap.mjs", import.meta.url));
  const sql = execFileSync(process.execPath, [script], { encoding: "utf8" });
  const db = new PGlite();
  try {
    await db.exec(sql);
    assert.equal((await db.query("select count(*)::int as total from crm_records")).rows[0].total, 0);

    await db.exec("set role authenticated");
    await assert.rejects(db.query("select * from auth.users"), /permission denied/);
    await assert.rejects(db.query("select crm_receive_site_contact($1, $2)", ["a".repeat(64), "{}"]), /permission denied/);
    await db.exec("reset role");

    await db.exec(`
      insert into auth.users (id, email, email_confirmed_at)
        values ('1162478a-8613-46d8-8d4f-e6551dbc33bd', 'medhi.clabaut@gmail.com', now());
      select set_config('request.jwt.claim.sub', '1162478a-8613-46d8-8d4f-e6551dbc33bd', false);
      select crm_join_invitations();
      set role crm_intake;
    `);
    const delivery = ["a".repeat(64), JSON.stringify({
      nom: "Contact de test", email: "contact@example.test", message: "Demande d’intégration HelixAI",
      objet: "integration", objet_label: "Intégration HelixAI",
    })];
    const intake = "select crm_receive_site_contact($1, $2::jsonb) as result";
    const first = (await db.query(intake, delivery)).rows[0].result;
    assert.equal(first.duplicate, false);
    assert.ok(first.opportunity_id);
    assert.equal((await db.query(intake, delivery)).rows[0].result.duplicate, true);
    await assert.rejects(db.query("select * from crm_records"), /permission denied/);
    await db.exec("reset role");

    await assert.rejects(db.exec(sql), /instance PostgreSQL dédiée/);
    await db.exec("rollback");
    assert.equal((await db.query("select count(*)::int as total from crm_workspaces")).rows[0].total, 1);
  } finally {
    await db.close();
  }
});

test("PostgreSQL : lien à usage unique, écriture par la session et révocation", async () => {
  const script = fileURLToPath(new URL("../scripts/postgres-bootstrap.mjs", import.meta.url));
  const db = new PGlite();
  try {
    await db.exec(execFileSync(process.execPath, [script], { encoding: "utf8" }));
    await db.exec("set role crm_app");
    const addr = "medhi.clabaut@gmail.com";
    const link = "a".repeat(64);
    const session = "b".repeat(64);
    const login = "select crm_native_request($1,$2) as accepted";
    assert.equal((await db.query(login, ["outsider@example.test", "c".repeat(64)])).rows[0].accepted, false);
    assert.equal((await db.query(login, [addr, link])).rows[0].accepted, true);
    assert.equal((await db.query(login, [addr, "c".repeat(64)])).rows[0].accepted, false);
    const exchange = "select crm_native_exchange($1,$2) as identity";
    const { identity } = (await db.query(exchange, [link, session])).rows[0];
    assert.equal(identity.email, addr);
    assert.equal((await db.query(exchange, [link, "d".repeat(64)])).rows[0].identity, null);

    const workspace = "71ce7dd5-5f52-48e0-b1c6-ae32597f6e30";
    const record = "1162478a-8613-46d8-8d4f-e6551dbc33bd";
    const save = postgresQuery({
      action: "rpc", name: "crm_save_record",
      args: { w: workspace, kind: "opportunities", record_id: record, payload: { name: "Projet Helix" } },
    });
    const read = postgresQuery({
      action: "select", table: "crm_records", columns: "id,data",
      filters: [["workspace_id", workspace], ["entity", "opportunities"]],
    });
    assert.throws(() => postgresQuery({ action: "rpc", name: "crm_native_exchange" }), /inconnue/);
    assert.throws(() => postgresQuery({ action: "select", table: "crm_records", columns: "id;drop table" }), /invalide/);
    await db.transaction(async tx => {
      await tx.exec("set local role authenticated");
      assert.deepEqual((await tx.query(read.query, read.params)).rows, []);
      await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [identity.id]);
      assert.equal((await tx.query(save.query, save.params)).rows[0].value.id, record);
      assert.equal((await tx.query(read.query, read.params)).rows[0].data.name, "Projet Helix");
    });
    const current = "select crm_native_user($1) as identity";
    assert.deepEqual((await db.query(current, [session])).rows[0].identity, identity);
    await db.query("select crm_native_signout($1)", [session]);
    assert.equal((await db.query(current, [session])).rows[0].identity, null);
  } finally {
    await db.close();
  }
});
