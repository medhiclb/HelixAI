import { googleIdentity } from "./google-identity.mjs";
import { postgresData } from "./postgres-data.mjs";
import { createHash, randomBytes } from "node:crypto";
import nodemailer from "nodemailer";
import { AppError, fail, origin } from "./server.mjs";

const cookieName = "__Host-helix-session";
const maxAge = 7 * 24 * 60 * 60;
const opaqueToken = () => randomBytes(32).toString("base64url");
const validToken = value => typeof value === "string" && /^[a-zA-Z0-9_-]{43}$/.test(value);
const digest = value => createHash("sha256").update(value).digest("hex");

function cookie(token, age, name = cookieName) {
  return `${name}=${token}; Max-Age=${age}; Path=/; Secure; HttpOnly; SameSite=Lax`;
}

export async function postgresAccess(req, res) {
  res.setHeader("Cache-Control", "no-store");
  try {
    if (req.method !== "POST") throw new AppError("Méthode refusée.", 405);
    const appOrigin = origin();
    if (req.headers.origin !== appOrigin) throw new AppError("Origine refusée.", 403);
    const databaseUrl = process.env.CRM_APP_DATABASE_URL;
    if (!databaseUrl) throw new AppError("Connexion PostgreSQL indisponible.", 503);

    const { neon } = await import("@neondatabase/serverless");
    const sql = neon(databaseUrl);
    const { action, email, token } = req.body || {};
    const current = req.headers.cookie?.split(/;\s*/).find(value => value.startsWith(cookieName + "="))?.slice(cookieName.length + 1);

    if (action === "google_challenge" || action === "google_exchange") {
      const clientId = process.env.CRM_GOOGLE_LOGIN_CLIENT_ID;
      if (!clientId) throw new AppError("Connexion Google indisponible.", 503);
      const challengeName = "__Host-helix-google";
      if (action === "google_challenge") {
        const nonce = opaqueToken();
        res.setHeader("Set-Cookie", cookie(nonce, 300, challengeName));
        return res.json({ clientId, nonce });
      }
      const nonce = req.headers.cookie?.split(/;\s*/).find(value => value.startsWith(challengeName + "="))?.slice(challengeName.length + 1);
      if (!validToken(nonce)) throw new AppError("Rechargez la page avant de vous connecter.", 401);
      const addr = await googleIdentity(req.body.credential, nonce, clientId);
      const linkDigest = digest(opaqueToken());
      const sessionToken = opaqueToken();
      // La limite et la liste d’accès existantes restent communes aux deux modes.
      const [, rows] = await sql.transaction(tx => [
        tx`select public.crm_native_request(${addr}, ${linkDigest})`,
        tx`select public.crm_native_exchange(${linkDigest}, ${digest(sessionToken)}) as "user"`,
      ]);
      const user = rows[0]?.user;
      if (!user) throw new AppError("Accès refusé ou demande trop récente. Réessayez dans deux minutes.", 403);
      res.setHeader("Set-Cookie", [cookie("", 0, challengeName), cookie(sessionToken, maxAge)]);
      return res.json({ user });
    }
    if (action === "request") {
      const address = typeof email === "string" ? email.trim().toLowerCase() : "";
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address) || address.length > 254) {
        throw new AppError("Adresse e-mail invalide.", 400);
      }
      const { CRM_SMTP_URL, CRM_MAIL_FROM } = process.env;
      if (!CRM_SMTP_URL || !CRM_MAIL_FROM) throw new AppError("Service e-mail indisponible.", 503);
      const linkToken = opaqueToken();
      const [{ accepted }] = await sql`select public.crm_native_request(${address}, ${digest(linkToken)}) as accepted`;
      if (accepted) {
        try {
          const smtp = new URL(CRM_SMTP_URL);
          if (!["smtp:", "smtps:"].includes(smtp.protocol) || !smtp.hostname) throw Error("SMTP invalide");
          const secure = smtp.protocol === "smtps:";
          const transport = nodemailer.createTransport({
            host: smtp.hostname, port: Number(smtp.port || (secure ? 465 : 587)),
            secure, requireTLS: !secure,
            auth: smtp.username ? { user: decodeURIComponent(smtp.username), pass: decodeURIComponent(smtp.password) } : undefined,
            connectionTimeout: 5000, greetingTimeout: 5000, socketTimeout: 8000,
          });
          const link = new URL("/", appOrigin);
          link.hash = new URLSearchParams({ crm_access: linkToken }).toString();
          await transport.sendMail({
            from: CRM_MAIL_FROM, to: address, subject: "Connexion à Helix CRM",
            text: `Ouvrez ce lien pour vous connecter à Helix CRM. Il expire dans 15 minutes.\n\n${link.href}`,
          });
        } catch {
          console.error("Helix CRM : échec de l’envoi du lien de connexion.");
        }
      }
      return res.json({ ok: true });
    }
    if (action === "exchange") {
      if (!validToken(token)) throw new AppError("Lien de connexion invalide.", 401);
      const sessionToken = opaqueToken();
      const [{ user }] = await sql`select public.crm_native_exchange(${digest(token)}, ${digest(sessionToken)}) as "user"`;
      if (!user) throw new AppError("Lien expiré ou déjà utilisé.", 401);
      res.setHeader("Set-Cookie", cookie(sessionToken, maxAge));
      return res.json({ user });
    }
    if (action === "signout") {
      if (validToken(current)) await sql`select public.crm_native_signout(${digest(current)})`;
      res.setHeader("Set-Cookie", cookie("", 0));
      return res.json({ ok: true });
    }
    if (action === "select" || action === "rpc") {
      if (!validToken(current)) throw new AppError("Session expirée.", 401);
      return res.json({ data: await postgresData(sql, digest(current), req.body) });
    }
    if (action === "session") {
      if (!validToken(current)) return res.json({ user: null });
      const [{ user }] = await sql`select public.crm_native_user(${digest(current)}) as "user"`;
      return res.json({ user });
    }
    throw new AppError("Action inconnue.", 400);
  } catch (error) {
    return fail(res, error instanceof AppError ? error : new AppError("Connexion indisponible.", 503));
  }
}
