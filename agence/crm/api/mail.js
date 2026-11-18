import MailComposer from "nodemailer/lib/mail-composer/index.js";
import {loadAttachments} from "../lib/attachments.mjs";
import {
  authorize,
  connectionFor,
  access,
  jsonFetch,
  check,
  fail,
  AppError,
} from "../lib/server.mjs";
import { recipients, googleMime, emails } from "../lib/crm.mjs";
import {
  claimOperation,
  finishOperation,
  failOperation,
} from "../lib/outbox.mjs";
import { randomUUID } from "node:crypto";
import { decrypt } from "../lib/server.mjs";
import { smtpSend, appendSent } from "../lib/imap.mjs";
import { graph } from "../lib/providers.mjs";
export default async function handler(req, res) {
  let ctx, operation;
  try {
    ctx = await authorize(req);
    const c = await connectionFor(ctx, req.body.provider);
    if (!c.capabilities?.send)
      throw new AppError(
        "Reconnectez votre compte avec l’autorisation d’envoyer des messages."
      );
    const to = recipients(req.body.to),
      subject = String(req.body.subject || "").trim(),
      body = String(req.body.body || "");
    if (
      !subject ||
      subject.length > 500 ||
      /[\r\n]/.test(subject) ||
      !body.trim() ||
      body.length > 100000
    )
      throw new AppError(
        "Vérifiez l’objet et le contenu du message (100 000 caractères maximum)."
      );
    let reply = null;
    if (req.body.reply_id) {
      reply = check(
        await ctx.client
          .from("crm_messages")
          .select("*")
          .eq("id", req.body.reply_id)
          .eq("workspace_id", ctx.workspace)
          .eq("user_id", ctx.user.id)
          .eq("provider", c.provider)
          .single()
      );
      if (reply.direction === "sent")
        throw new AppError("Sélectionnez un message reçu pour répondre.");
      if (to.length !== 1 || to[0] !== emails(reply.sender)[0])
        throw new AppError(
          "Le destinataire doit être l’expéditeur du message auquel vous répondez."
        );
    }
    if (req.body.cabinet_id) {
      const r = check(
        await ctx.client
          .from("crm_records")
          .select("id")
          .eq("id", req.body.cabinet_id)
          .eq("workspace_id", ctx.workspace)
          .eq("entity", "cabinets")
          .single()
      );
      if (!r) throw new AppError("Entreprise introuvable.");
    }
    const attachments=await loadAttachments(ctx.client,ctx.workspace,req.body.attachment_ids||[]);
    const token = c.provider === "imap" ? null : await access(ctx.client, c);
    const claimed = await claimOperation(ctx, req.body.request_key, "mail");
    if (claimed.result) {
      res.json(claimed.result);
      return;
    }
    operation = claimed.operation;
    const headers = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };
    let providerResult;
    if (c.provider === "imap") {
      const settings=decrypt(c.encrypted_tokens);
      const messageId=`<${randomUUID()}@${c.email.split("@")[1]}>`;
      let sent;
      try {sent=await smtpSend(settings,{to,subject,body,inReplyTo:reply?.internet_message_id,messageId,attachments});}
      catch {throw new AppError("L’envoi SMTP n’a pas pu être confirmé. Vérifiez votre messagerie avant de réessayer.",502);}
      const result={accepted:sent.accepted.length>0,external_id:messageId,rejected:sent.rejected,message:"Message accepté par le serveur SMTP."};
      if(!result.accepted) throw new AppError("Aucun destinataire accepté par le serveur SMTP.",422);
      await finishOperation(ctx,operation,result);
      operation=null;
      try {result.sent_copy=await appendSent(settings,{to,subject,body,inReplyTo:reply?.internet_message_id,messageId,attachments});}
      catch {result.sent_copy=false;}
      if(req.body.cabinet_id) {
        const saved=await ctx.client.from("crm_messages").insert({workspace_id:ctx.workspace,user_id:ctx.user.id,provider:"imap",external_id:messageId,internet_message_id:messageId,sender:c.email,recipients:to,subject,body_text:body,snippet:body.slice(0,250),cabinet_id:req.body.cabinet_id,direction:"sent",sent_at:new Date().toISOString(),shared:true});
        result.history_saved=!saved.error;
      }
      result.message=sent.rejected.length ? "Message accepté pour certains destinataires seulement. Vérifiez les destinataires refusés." : result.sent_copy ? "Message accepté par le serveur SMTP et copie disponible dans Envoyés." : "Message accepté par le serveur SMTP. La copie dans Envoyés n’a pas pu être confirmée.";
      // Persist diagnostics without turning a successful send into a retryable send.
      try {await finishOperation(ctx,{id:claimed.operation.id},result);} catch {}
      res.json(result);return;
    } else if (c.provider === "google") {
      providerResult = await jsonFetch(
        "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            raw: attachments.length ? (await new MailComposer({from:c.email,to,subject,text:body,inReplyTo:reply?.internet_message_id,attachments}).compile().build()).toString("base64url") : googleMime({
              from: c.email,
              to,
              subject,
              body,
              inReplyTo: reply?.internet_message_id,
            }),
            ...(reply?.thread_id ? { threadId: reply.thread_id } : {}),
          }),
        }
      );
    } else {
      const url = reply
        ? graph +
          "/me/messages/" +
          encodeURIComponent(reply.external_id) +
          "/reply"
        : graph + "/me/sendMail";
      providerResult = await jsonFetch(url, {
        method: "POST",
        headers: reply&&attachments.length?{...headers,"Content-Type":"text/plain"}:headers,
        body: reply&&attachments.length?(await new MailComposer({from:c.email,to,subject,text:body,inReplyTo:reply.internet_message_id,attachments}).compile().build()).toString("base64"):JSON.stringify(
          reply
            ? { message: { body: { contentType: "Text", content: body } } }
            : {
                message: {
                  subject,
                  body: { contentType: "Text", content: body },
                  attachments: attachments.map(a=>({"@odata.type":"#microsoft.graph.fileAttachment",name:a.filename,contentType:a.contentType,contentBytes:a.content.toString("base64")})),
                  toRecipients: to.map((address) => ({
                    emailAddress: { address },
                  })),
                },
                saveToSentItems: true,
              }
        ),
      });
    }
    const result = {
      accepted: true,
      message:
        "Le fournisseur a accepté le message. Cela ne garantit pas sa livraison.",
      external_id: providerResult.id || null,
    };
    await finishOperation(ctx, operation, result);
    operation = null;
    if (c.provider === "google" && req.body.cabinet_id) {
      await ctx.client.from("crm_messages").upsert(
        {
          workspace_id: ctx.workspace,
          user_id: ctx.user.id,
          provider: c.provider,
          external_id: providerResult.id,
          thread_id: providerResult.threadId,
          sender: c.email,
          recipients: to,
          subject,
          body_text: body,
          snippet: body.slice(0, 250),
          cabinet_id: req.body.cabinet_id,
          direction: "sent",
          sent_at: new Date().toISOString(),
          shared: c.share_emails,
        },
        { onConflict: "workspace_id,user_id,provider,external_id" }
      );
    }
    res.json(result);
  } catch (e) {
    if (ctx && operation) await failOperation(ctx, operation, e);
    fail(res, e);
  }
}
