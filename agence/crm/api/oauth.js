import { randomBytes, createHash } from "node:crypto";
import { authorize, config, fail, check } from "../lib/server.mjs";
export default async function handler(req, res) {
  try {
    const { client, user, workspace } = await authorize(req);
    const provider = req.body.provider,
      c = config(provider),
      state = randomBytes(32).toString("hex"),
      verifier = randomBytes(48).toString("base64url");
    check(
      await client.from("crm_oauth_states").insert({
        state,
        user_id: user.id,
        workspace_id: workspace,
        provider,
        verifier,
        expires_at: new Date(Date.now() + 600000).toISOString(),
      })
    );
    res.setHeader(
      "Set-Cookie",
      `crm_oauth=${state}; HttpOnly; Secure; SameSite=Lax; Path=/api/callback; Max-Age=600`
    );
    res.setHeader("Cache-Control", "no-store");
    const params = new URLSearchParams({
      client_id: c.client_id,
      redirect_uri: c.redirect_uri,
      response_type: "code",
      scope: c.scope,
      state,
      code_challenge: createHash("sha256").update(verifier).digest("base64url"),
      code_challenge_method: "S256",
      prompt: "consent",
    });
    if (provider === "google") params.set("access_type", "offline");
    res.json({ url: c.auth + "?" + params });
  } catch (e) {
    fail(res, e);
  }
}
