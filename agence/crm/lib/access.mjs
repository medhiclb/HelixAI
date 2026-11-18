import { check } from "./crm.mjs";

export const SHARED_WORKSPACE = "71ce7dd5-5f52-48e0-b1c6-ae32597f6e30";

export async function isAllowedEmail(client, email) {
  if (typeof email !== "string" || !email.trim()) return false;
  return check(await client.rpc("crm_email_allowed", { addr: email })) === true;
}
