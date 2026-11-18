import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import { googleIdentity } from "../lib/google-identity.mjs";

test("Google : signature, origine, audience, e-mail vérifié et défi de connexion", async t => {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const kid = "test-key";
  const now = Math.floor(Date.now() / 1000);
  const audience = "test.apps.googleusercontent.com";
  t.mock.method(globalThis, "fetch", async url => {
    assert.equal(url, "https://www.googleapis.com/oauth2/v3/certs");
    return Response.json({ keys: [{ ...publicKey.export({ format: "jwk" }), kid, alg: "RS256" }] });
  });
  const encode = value => Buffer.from(JSON.stringify(value)).toString("base64url");
  const token = changes => {
    const claims = { iss: "https://accounts.google.com", aud: audience, exp: now + 60, iat: now,
      nonce: "test-nonce", sub: "account", email: "User@gmail.com", email_verified: true, ...changes };
    const data = encode({ alg: "RS256", kid }) + "." + encode(claims);
    return data + "." + sign("RSA-SHA256", Buffer.from(data), privateKey).toString("base64url");
  };
  assert.equal(await googleIdentity(token(), "test-nonce", audience), "user@gmail.com");
  for (const changes of [{ aud: "wrong" }, { nonce: "wrong" }, { exp: now - 1 }, { email_verified: false }]) {
    await assert.rejects(googleIdentity(token(changes), "test-nonce", audience), /invalide/);
  }
  const broken = token().split(".");
  broken[2] = Buffer.alloc(256).toString("base64url");
  await assert.rejects(googleIdentity(broken.join("."), "test-nonce", audience), /invalide/);
});
