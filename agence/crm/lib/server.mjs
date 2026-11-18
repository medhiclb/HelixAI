import { AsyncLocalStorage } from "node:async_hooks";
import { createClient } from "@supabase/supabase-js";
import { randomUUID, randomBytes, createCipheriv, createDecipheriv } from "node:crypto";
import { AppError, check } from "./crm.mjs";
export { AppError, check };
import { isAllowedEmail, SHARED_WORKSPACE } from "./access.mjs";
const requestBudget = new AsyncLocalStorage();
export function withBudget(fn, milliseconds = 45000) {
  return requestBudget.run(Date.now() + milliseconds, fn);
}
export const admin = () => {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY)
    throw new AppError("Base partagée non configurée sur le serveur.", 503);
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
};
export function origin() {
  if (!process.env.APP_URL) throw new AppError("APP_URL non configurée.", 503);
  const url = new URL(process.env.APP_URL);
  if (url.protocol !== "https:" && url.hostname !== "localhost")
    throw new AppError("APP_URL doit utiliser HTTPS.", 503);
  return url.origin;
}
export async function authorize(req) {
  if (req.method !== "POST") throw new AppError("Méthode non autorisée.", 405);
  const requestOrigin = req.headers.origin;
  if (requestOrigin && requestOrigin !== origin())
    throw new AppError("Origine refusée.", 403);
  const client = admin();
  const token = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
  if (!token) throw new AppError("Authentification requise.", 401);
  const {
    data: { user },
    error,
  } = await client.auth.getUser(token);
  if (error || !user)
    throw new AppError("Session expirée. Reconnectez-vous.", 401);
  if (!user.email_confirmed_at || !(await isAllowedEmail(client, user.email)))
    throw new AppError("Accès réservé à l’équipe Helix.", 403);
  const workspace = req.body?.workspace_id;
  if (workspace !== SHARED_WORKSPACE) throw new AppError("Espace Helix requis.", 403);
  const { data: member } = await client
    .from("crm_members")
    .select("*")
    .eq("workspace_id", workspace)
    .eq("user_id", user.id)
    .single();
  if (!member) throw new AppError("Accès à cet espace refusé.", 403);
  return { client, user, workspace, member };
}
function encryptionKey() {
  const value = process.env.TOKEN_ENCRYPTION_KEY || "";
  if (!/^[a-f0-9]{64}$/i.test(value))
    throw new AppError("Clé de chiffrement serveur non configurée.", 503);
  return Buffer.from(value, "hex");
}
export function encrypt(value) {
  const iv = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const body = Buffer.concat([
    cipher.update(JSON.stringify(value), "utf8"),
    cipher.final(),
  ]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64");
}
export function decrypt(value) {
  const bytes = Buffer.from(value, "base64"),
    decipher = createDecipheriv(
      "aes-256-gcm",
      encryptionKey(),
      bytes.subarray(0, 12)
    );
  decipher.setAuthTag(bytes.subarray(12, 28));
  return JSON.parse(
    Buffer.concat([
      decipher.update(bytes.subarray(28)),
      decipher.final(),
    ]).toString("utf8")
  );
}
export function config(provider) {
  if (!["google", "microsoft"].includes(provider))
    throw new AppError("Fournisseur invalide.");
  const google = provider === "google";
  const client_id =
      process.env[google ? "GOOGLE_CLIENT_ID" : "MICROSOFT_CLIENT_ID"],
    client_secret =
      process.env[google ? "GOOGLE_CLIENT_SECRET" : "MICROSOFT_CLIENT_SECRET"];
  if (!client_id || !client_secret)
    throw new AppError(
      `La connexion ${provider} n’est pas encore configurée.`,
      503
    );
  return {
    client_id,
    client_secret,
    redirect_uri: origin() + "/api/callback",
    auth: google
      ? "https://accounts.google.com/o/oauth2/v2/auth"
      : "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
    token: google
      ? "https://oauth2.googleapis.com/token"
      : "https://login.microsoftonline.com/common/oauth2/v2.0/token",
    scope: google
      ? "openid email https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.calendarlist.readonly"
      : "openid email offline_access User.Read Mail.Read Mail.Send Calendars.ReadWrite",
  };
}
export async function jsonFetch(url, options = {}) {
  const remaining =
    (requestBudget.getStore() || Date.now() + 12000) - Date.now();
  if (remaining < 500)
    throw new AppError(
      "La synchronisation reprendra au prochain passage.",
      503
    );
  const r = await fetch(url, {
    ...options,
    signal: options.signal || AbortSignal.timeout(Math.min(12000, remaining)),
  });
  const text = await r.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new AppError("Réponse fournisseur illisible.", 502);
  }
  if (!r.ok) {
    const e = new AppError(
      r.status === 401
        ? "Autorisation expirée : reconnectez le compte."
        : r.status === 403
        ? "Permission manquante : reconnectez le compte et acceptez les autorisations nécessaires."
        : r.status === 412
        ? "Le rendez-vous a été modifié dans votre agenda. Rechargez sa version avant de republier."
        : r.status === 429
        ? "Limite du fournisseur atteinte. Réessayez plus tard."
        : `Le fournisseur a refusé la requête (${r.status}).`,
      r.status === 401 ? 401 : 502
    );
    e.providerStatus = r.status;
    throw e;
  }
  return data;
}
export async function access(client, connection) {
  // Every caller rereads the encrypted value: refresh tokens can rotate between requests.
  const current=()=>client.from("crm_connections").select("*").eq("id",connection.id).single();
  let row=check(await current());
  let tokens=decrypt(row.encrypted_tokens);
  if(tokens.expires_at >= Date.now()+90000) return tokens.access_token;
  const lock=randomUUID();
  if(!check(await client.rpc("crm_claim_token_refresh",{c:connection.id,lock_id:lock})))
    throw new AppError("L’autorisation du compte est en cours de renouvellement. Réessayez dans un instant.",409);
  try {
    row=check(await current());tokens=decrypt(row.encrypted_tokens);
    if(tokens.expires_at >= Date.now()+90000) return tokens.access_token;
    if(!tokens.refresh_token)throw new AppError("Reconnectez votre compte pour renouveler son autorisation.",401);
    const c=config(connection.provider);
    const fresh=await jsonFetch(c.token,{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({client_id:c.client_id,client_secret:c.client_secret,refresh_token:tokens.refresh_token,grant_type:"refresh_token"})});
    if(!fresh.access_token || !Number.isFinite(Number(fresh.expires_in)))throw new AppError("Réponse de renouvellement invalide.",502);
    const encrypted=encrypt({...tokens,...fresh,refresh_token:fresh.refresh_token || tokens.refresh_token,expires_at:Date.now()+Number(fresh.expires_in)*1000});
    const saved=check(await client.from("crm_connections").update({encrypted_tokens:encrypted}).eq("id",connection.id).eq("refresh_lock_id",lock).eq("encrypted_tokens",row.encrypted_tokens).select("id").maybeSingle());
    if(!saved)throw new AppError("Le compte a changé pendant le renouvellement. Rechargez avant de réessayer.",409);
    return fresh.access_token;
  } finally {
    await client.rpc("crm_release_token_refresh",{c:connection.id,lock_id:lock});
  }
}
export async function connectionFor(ctx, provider) {
  if (provider !== "imap") config(provider);
  const { data, error } = await ctx.client
    .from("crm_connections")
    .select("*")
    .eq("workspace_id", ctx.workspace)
    .eq("user_id", ctx.user.id)
    .eq("provider", provider)
    .single();
  if (error || !data)
    throw new AppError("Connectez d’abord votre propre compte.");
  return data;
}
export function fail(res, error) {
  res.setHeader("Cache-Control", "no-store");
  res
    .status(error.status || 400)
    .json({ error: error.message || "Erreur serveur." });
}
