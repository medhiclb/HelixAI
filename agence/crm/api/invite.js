import { authorize, origin, fail, check, AppError } from "../lib/server.mjs";
import { isAllowedEmail } from "../lib/access.mjs";
import { recipients } from "../lib/crm.mjs";
export default async function handler(req, res) {
  try {
    const { client, workspace, member } = await authorize(req);
    if (member.role !== "admin")
      throw new AppError("Seul un administrateur peut inviter un membre.", 403);
    const [email] = recipients(req.body.email);
    if (recipients(req.body.email).length !== 1)
      throw new AppError("Invitez une personne à la fois.");
    if (!(await isAllowedEmail(client, email))) throw new AppError("Cette adresse ne fait pas partie de l’équipe autorisée.", 403);
    check(
      await client.from("crm_invites").upsert({
        workspace_id: workspace,
        email,
        expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
      })
    );
    const { error } = await client.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: origin() },
    });
    if (error) throw error;
    res.json({ ok: true });
  } catch (e) {
    fail(res, e);
  }
}
