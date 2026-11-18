import { authorize, encrypt, check, fail, AppError } from "../lib/server.mjs";
import { mailboxSettings, verifyMailbox } from "../lib/imap.mjs";
export default async function handler(req,res) {
  try {
    const ctx=await authorize(req);
    const settings=mailboxSettings(req.body);
    if (req.body.share_emails!==true) throw new AppError("Confirmez le partage des échanges CRM avec l’équipe.");
    const existing=check(await ctx.client.from("crm_connections").select("id").eq("workspace_id",ctx.workspace).eq("user_id",ctx.user.id).eq("provider","imap").maybeSingle());
    if (existing) throw new AppError("Déconnectez d’abord votre compte IMAP actuel avant de le remplacer.");
    try {await verifyMailbox(settings);} catch {
      throw new AppError("Connexion refusée : vérifiez les serveurs et le mot de passe d’application. IMAP et SMTP doivent être autorisés chez votre fournisseur. Aucun identifiant n’a été enregistré.",422);
    }
    check(await ctx.client.from("crm_connections").insert({workspace_id:ctx.workspace,user_id:ctx.user.id,provider:"imap",email:settings.email,
      encrypted_tokens:encrypt(settings),share_emails:true,calendar_id:"primary",capabilities:{send:true,calendar_write:false},next_sync_at:new Date().toISOString()}));
    res.json({ok:true});
  } catch(e) {fail(res,e);}
}
