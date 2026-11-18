import { createPublicKey, verify } from "node:crypto";
import { AppError } from "./crm.mjs";

let cache = { expires: 0, keys: [] };

async function keys() {
  if (Date.now() < cache.expires) return cache.keys;
  const response = await fetch("https://www.googleapis.com/oauth2/v3/certs", {
    redirect: "error", signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new AppError("Vérification Google indisponible.", 503);
  const data = await response.json();
  if (!Array.isArray(data.keys)) throw new AppError("Vérification Google indisponible.", 503);
  cache = { expires: Date.now() + 300000, keys: data.keys };
  return cache.keys;
}

export async function googleIdentity(credential, nonce, clientId) {
  const invalid = () => new AppError("Connexion Google invalide.", 401);
  if (typeof credential !== "string" || credential.length > 12000) throw invalid();
  const parts = credential.split(".");
  if (parts.length !== 3 || parts.some(part => !/^[\w-]+$/.test(part))) throw invalid();
  let header;
  let claims;
  try {
    [header, claims] = parts.slice(0, 2).map(part => JSON.parse(Buffer.from(part, "base64url").toString("utf8")));
  } catch { throw invalid(); }
  const now = Math.floor(Date.now() / 1000);
  if (header?.alg !== "RS256" || typeof header.kid !== "string" || !claims ||
      !["accounts.google.com", "https://accounts.google.com"].includes(claims.iss) ||
      claims.aud !== clientId || (claims.azp && claims.azp !== clientId) ||
      !Number.isSafeInteger(claims.exp) || claims.exp <= now ||
      !Number.isSafeInteger(claims.iat) || claims.iat > now + 30 ||
      claims.nonce !== nonce || claims.email_verified !== true ||
      typeof claims.sub !== "string" || !claims.sub ||
      typeof claims.email !== "string" || !claims.email.toLowerCase().endsWith("@gmail.com")) {
    throw invalid();
  }
  const key = (await keys()).find(item => item.kid === header.kid && item.kty === "RSA" && item.alg === "RS256");
  if (!key || !verify("RSA-SHA256", Buffer.from(parts.slice(0, 2).join(".")), createPublicKey({ key, format: "jwk" }), Buffer.from(parts[2], "base64url"))) {
    throw invalid();
  }
  return claims.email.trim().toLowerCase();
}
