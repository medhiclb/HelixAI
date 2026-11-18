import { timingSafeEqual, createHash } from "node:crypto";
import { admin, AppError, check, fail } from "./server.mjs";

async function persistContact(delivery, payload) {
  const databaseUrl = process.env.CRM_INTAKE_DATABASE_URL;
  if (!databaseUrl) {
    return check(await admin().rpc("crm_receive_site_contact", { delivery, payload }));
  }
  try {
    const { neon } = await import("@neondatabase/serverless");
    const sql = neon(databaseUrl);
    const [row] = await sql`select public.crm_receive_site_contact(${delivery}::text, ${JSON.stringify(payload)}::jsonb) as result`;
    if (typeof row?.result?.duplicate !== "boolean") throw Error("Résultat incomplet");
    return row.result;
  } catch {
    throw new AppError("Enregistrement de la demande indisponible.", 503);
  }
}

export async function receiveSiteContact(req, res) {
  res.setHeader("Cache-Control", "no-store");
  try {
    if (req.method !== "POST") throw new AppError("Méthode refusée.", 405);
    const secret = process.env.SITE_CONTACT_SECRET;
    if (!secret || secret.length < 32) throw new AppError("Collecte des demandes indisponible.", 503);
    const hash = value => createHash("sha256").update(value).digest();
    if (!timingSafeEqual(hash(req.headers.authorization || ""), hash("Bearer " + secret))) {
      throw new AppError("Authentification requise.", 401);
    }
    const body = req.body;
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw new AppError("Demande invalide.", 400);
    }
    const wrapped = Object.hasOwn(body, "contact");
    const contact = wrapped ? body.contact : body;
    if ((wrapped && (typeof body.delivery_id !== "string" || !/^[a-f0-9]{64}$/.test(body.delivery_id))) || !contact ||
      typeof contact.nom !== "string" || !contact.nom.trim() || contact.nom.length > 120 ||
      typeof contact.email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email) || contact.email.length > 200 ||
      typeof contact.message !== "string" || !contact.message.trim() || contact.message.length > 5000) {
      throw new AppError("Demande invalide.", 400);
    }
    const optional = (key, limit) => typeof contact[key] === "string" ? contact[key].trim().slice(0, limit) : "";
    const payload = {
      nom: contact.nom.trim(), email: contact.email.trim().toLowerCase(), message: contact.message.trim(),
      cabinet: optional("entreprise", 160), telephone: optional("telephone", 40),
      objet: optional("objet", 60) || "projet", objet_label: optional("objet_label", 150) || "Demande de projet",
    };
    // Web3Forms transmet les champs du formulaire. Le même contenu rejoué ne recrée pas de relance.
    const delivery = wrapped ? body.delivery_id : hash(JSON.stringify(payload)).toString("hex");
    const result = await persistContact(delivery, payload);
    return res.json({ ok: true, duplicate: result.duplicate });
  } catch (error) {
    return fail(res, error);
  }
}
