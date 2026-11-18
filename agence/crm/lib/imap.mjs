import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";
import { ImapFlow } from "imapflow";
import nodemailer from "nodemailer";
import MailComposer from "nodemailer/lib/mail-composer/index.js";
import { simpleParser } from "mailparser";
import { AppError, emails, htmlText } from "./crm.mjs";
const blocked = new BlockList();
for (const [ip,bits] of [["0.0.0.0",8],["10.0.0.0",8],["100.64.0.0",10],["127.0.0.0",8],["169.254.0.0",16],["172.16.0.0",12],["192.0.0.0",24],["192.0.2.0",24],["192.168.0.0",16],["192.88.99.0",24],["198.18.0.0",15],["198.51.100.0",24],["203.0.113.0",24],["224.0.0.0",4],["240.0.0.0",4]]) blocked.addSubnet(ip,bits,"ipv4");
export function publicAddress(ip) {
  if (isIP(ip) === 4) return !blocked.check(ip,"ipv4");
  // Only global IPv6 unicast; excludes mapped IPv4, loopback, link-local and ULA.
  return isIP(ip) === 6 && /^[23][0-9a-f]{3}:/i.test(ip) && !/^2001:(?:0{1,4}|db8):/i.test(ip) && !/^2002:/i.test(ip);
}
export function mailboxSettings(input) {
  const email = emails(String(input.email || ""))[0];
  if (!email || email !== String(input.email).trim().toLowerCase()) throw new AppError("Adresse de messagerie invalide.");
  const password = String(input.password || "");
  if (!password || password.length > 1024) throw new AppError("Saisissez le mot de passe d’application de cette messagerie.");
  const endpoint = (host,port,ports) => {
    host=String(host || "").trim().toLowerCase();port=Number(port);
    if (host.length>253 || !/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63}$/.test(host) || !ports.includes(port)) throw new AppError("Serveur ou port invalide. IMAP : 993 ; SMTP : 465 ou 587.");
    return {host,port};
  };
  return {email,password,imap:endpoint(input.imap_host,input.imap_port || 993,[993]),smtp:endpoint(input.smtp_host,input.smtp_port || 465,[465,587])};
}
async function pin(endpoint) {
  const addresses=await lookup(endpoint.host,{all:true});
  if (!addresses.length || addresses.some(x=>!publicAddress(x.address))) throw new AppError("Ce serveur ne possède pas une adresse publique autorisée.");
  return {...endpoint,address:addresses[0].address};
}
async function imapClient(settings) {
  const server=await pin(settings.imap);
  return new ImapFlow({host:server.address,port:server.port,secure:true,servername:server.host,
    tls:{servername:server.host,rejectUnauthorized:true,minVersion:"TLSv1.2"},
    auth:{user:settings.email,pass:settings.password},logger:false,
    connectionTimeout:10000,greetingTimeout:10000,socketTimeout:12000,disableAutoIdle:true});
}
async function smtpClient(settings) {
  const server=await pin(settings.smtp);
  return nodemailer.createTransport({host:server.address,servername:server.host,port:server.port,secure:server.port===465,requireTLS:true,
    tls:{servername:server.host,rejectUnauthorized:true,minVersion:"TLSv1.2"},
    auth:{user:settings.email,pass:settings.password},connectionTimeout:10000,greetingTimeout:10000,socketTimeout:12000,
    logger:false,debug:false,disableFileAccess:true,disableUrlAccess:true});
}
export async function verifyMailbox(settings) {
  const client=await imapClient(settings);
  try {
    await client.connect();
    await client.mailboxOpen("INBOX",{readOnly:true});
  } finally {client.close();}
  const transport=await smtpClient(settings);
  try {await transport.verify();} finally {transport.close();}
}
export function uidBatch(ids,last=0,size=15) {
  const next=ids.filter(id=>Number.isInteger(id)&&id>last).sort((a,b)=>a-b);
  return {ids:next.slice(0,size),pending:next.length>size};
}
export async function imapPage(settings,state,lookupEntreprise,createClient=imapClient) {
  const client=await createClient(settings),items=[];
  const progress=Object.assign(Object.create(null),structuredClone(state || {}));
  let pending=false;
  const deadline=Date.now()+35000;
  try {
    await client.connect();
    const folders=await client.list();
    const sent=folders.find(f=>f.specialUse==="\\Sent");
    const paths=["INBOX",...(sent && sent.path!=="INBOX"?[sent.path]:[])];
    const since=new Date(Date.now()-30*86400000);
    for (const path of paths) {
      if(Date.now()>deadline){pending=true;break;}
      const box=await client.mailboxOpen(path,{readOnly:true});
      const validity=String(box.uidValidity);
      const prior=progress[path]?.validity===validity?progress[path].last:0;
      const ids=await client.search(prior?{uid:`${prior+1}:*`}:{since},{uid:true});
      const batch=uidBatch(ids || [],prior);
      pending ||= batch.pending;
      let last=prior;
      // Fetch only metadata first. Bodies of unrelated personal messages are never downloaded.
      for (const uid of batch.ids) {
        if(Date.now()>deadline){pending=true;break;}
        const msg=await client.fetchOne(String(uid),{envelope:true,flags:true,size:true,internalDate:true},{uid:true});
        if (!msg) {last=uid;continue;}
        const sender=msg.envelope?.from?.[0]?.address || "";
        const recipients=[...(msg.envelope?.to || []),...(msg.envelope?.cc || [])].map(x=>x.address).filter(Boolean);
        const cabinet_id=[sender,...recipients].map(x=>lookupEntreprise.get(x.toLowerCase())).find(Boolean);
        if (cabinet_id && !msg.flags.has("\\Deleted")) {
          let text="";
          if (msg.size<=1024*1024) {
            const full=await client.fetchOne(String(uid),{source:true},{uid:true});
            if(full?.source) {
              const parsed=await simpleParser(full.source,{skipHtmlToText:true,skipTextToHtml:true,skipImageLinks:true});
              text=String(parsed.text || htmlText(parsed.html)).slice(0,100000);
            }
          } else text="Message volumineux : consultez le contenu et les pièces jointes dans votre messagerie.";
          items.push({external_id:msg.envelope?.messageId || `${encodeURIComponent(path)}:${validity}:${uid}`,internet_message_id:msg.envelope?.messageId || null,
            sender,recipients,subject:msg.envelope?.subject || "",sent_at:new Date(msg.envelope?.date || msg.internalDate).toISOString(),
            body_text:text,snippet:text.slice(0,250),deleted:false,cabinet_id,direction:sender.toLowerCase()===settings.email.toLowerCase()?"sent":"received"});
        }
        last=uid;
      }
      progress[path]={validity,last};
    }
    const unique=new Map();
    for(const item of items) {
      const prior=unique.get(item.external_id);
      unique.set(item.external_id, prior ? {...prior,...item,body_text:item.body_text || prior.body_text,snippet:item.snippet || prior.snippet,recipients:[...new Set([...prior.recipients,...item.recipients])]} : item);
    }
    return {items:[...unique.values()],state:progress,pending};
  } finally {client.close();}
}
export async function smtpSend(settings,{to,subject,body,inReplyTo,messageId,attachments=[]}) {
  const transport=await smtpClient(settings);
  const options={from:settings.email,to,subject,text:body,messageId,attachments,
    ...(inReplyTo?{inReplyTo,references:inReplyTo}:{}),disableFileAccess:true,disableUrlAccess:true};
  try {
    const result=await transport.sendMail(options);
    return {id:result.messageId,accepted:result.accepted || [],rejected:result.rejected || []};
  } finally {transport.close();}
}
// Copy a sent message when the server exposes an existing Sent folder; never create folders.
export async function appendSent(settings,{to,subject,body,inReplyTo,messageId,attachments=[]}) {
  const client=await imapClient(settings);
  try {
    await client.connect();
    const sent=(await client.list()).find(f=>f.specialUse==="\\Sent");
    if (!sent) return false;
    await client.mailboxOpen(sent.path,{readOnly:true});
    const found=await client.search({header:{"message-id":messageId}},{uid:true});
    if(found.length)return true;
    const raw=await new MailComposer({from:settings.email,to,subject,text:body,messageId,attachments,inReplyTo}).compile().build();
    await client.append(sent.path,raw,["\\Seen"]);
    return true;
  } finally {client.close();}
}
// Read attachments only after an explicit user request, and only from an already imported message.
export async function imapAttachments(settings,message,attachmentIndex=null) {
 const client=await imapClient(settings);
 try {
  await client.connect();const folders=await client.list();
  for(const folder of folders.filter(f=>f.path==='INBOX'||f.specialUse==='\\Sent')) {
   await client.mailboxOpen(folder.path,{readOnly:true});
   if(!message.internet_message_id)continue;
   const uids=await client.search({header:{'message-id':message.internet_message_id}},{uid:true});
   if(!uids?.length)continue;
   const meta=await client.fetchOne(String(uids[0]),{size:true},{uid:true});
   if(meta.size>20*1024*1024)throw new AppError('Ce message dépasse la limite de lecture des pièces jointes (20 Mo).');
   const source=await client.fetchOne(String(uids[0]),{source:true},{uid:true});const parsed=await simpleParser(source.source);
   if(attachmentIndex!==null){const a=parsed.attachments[attachmentIndex];if(!a||a.size>10485760)throw new AppError('Pièce jointe introuvable ou supérieure à 10 Mo.');return a;}
   return parsed.attachments.map((a,i)=>({id:String(i),name:a.filename||'Pièce jointe',size:a.size,mime:a.contentType}));
  }
  return attachmentIndex===null?[]:null;
 }finally{client.close();}
}
