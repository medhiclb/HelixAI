import {
  admin,
  config,
  encrypt,
  jsonFetch,
  origin,
  check,
} from "../lib/server.mjs";
import { isAllowedEmail, SHARED_WORKSPACE } from "../lib/access.mjs";
export default async function handler(req, res) {
  try {
    if (req.method !== "GET") throw Error("Méthode invalide.");
    const cookie = req.headers.cookie
      ?.split(";")
      .map((x) => x.trim())
      .find((x) => x.startsWith("crm_oauth="))
      ?.slice(10);
    if (!cookie || cookie !== req.query.state)
      throw Error("Session OAuth invalide.");
    res.setHeader(
      "Set-Cookie",
      "crm_oauth=; HttpOnly; Secure; SameSite=Lax; Path=/api/callback; Max-Age=0"
    );
    const client = admin();
    const states = check(
      await client
        .from("crm_oauth_states")
        .delete()
        .eq("state", String(req.query.state))
        .gt("expires_at", new Date().toISOString())
        .select()
    );
    if (states?.length !== 1) throw Error("Autorisation expirée.");
    const state = states[0];
    if (state.workspace_id !== SHARED_WORKSPACE) throw Error("Accès révoqué.");
    const { data: member } = await client
      .from("crm_members")
      .select("user_id")
      .eq("workspace_id", state.workspace_id)
      .eq("user_id", state.user_id)
      .single();
    if (!member) throw Error("Accès révoqué.");
    const {data: owner} = await client.auth.admin.getUserById(state.user_id);
    if (!owner?.user?.email_confirmed_at || !(await isAllowedEmail(client, owner.user.email))) throw Error("Accès révoqué.");
    if (req.query.error) {
      res.redirect(303, origin() + "/?connection=cancelled");
      return;
    }
    const c = config(state.provider);
    const tokens = await jsonFetch(c.token, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: c.client_id,
        client_secret: c.client_secret,
        code: String(req.query.code || ""),
        redirect_uri: c.redirect_uri,
        grant_type: "authorization_code",
        code_verifier: state.verifier,
      }),
    });
    const profile = await jsonFetch(
      state.provider === "google"
        ? "https://openidconnect.googleapis.com/v1/userinfo"
        : "https://graph.microsoft.com/v1.0/me",
      { headers: { Authorization: `Bearer ${tokens.access_token}` } }
    );
    const email = profile.email || profile.mail || profile.userPrincipalName;
    if (!email || !tokens.refresh_token)
      throw Error("Autorisation hors ligne manquante.");
    const scope = tokens.scope || "";
    const capabilities = {
      send:
        state.provider === "google"
          ? scope.includes("gmail.send")
          : scope.includes("Mail.Send"),
      calendar_write:
        state.provider === "google"
          ? scope.includes("calendar.events")
          : scope.includes("Calendars.ReadWrite"),
    };
    check(
      await client.from("crm_connections").upsert(
        {
          workspace_id: state.workspace_id,
          user_id: state.user_id,
          provider: state.provider,
          email,
          encrypted_tokens: encrypt({
            ...tokens,
            expires_at: Date.now() + tokens.expires_in * 1000,
          }),
          share_emails: true,
          calendar_id: "primary",
          capabilities,
          sync_state: {},
          sync_error: null,
          next_sync_at: new Date().toISOString(),
          last_sync_at: null,
        },
        { onConflict: "workspace_id,user_id,provider" }
      )
    );
    res.redirect(303, origin() + "/?connected=" + state.provider);
  } catch {
    res
      .status(400)
      .send(
        "Connexion impossible. Revenez dans Connexions et recommencez. Vérifiez que les autorisations et le callback sont configurés."
      );
  }
}
