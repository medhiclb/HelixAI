import {maintainFiles} from "../lib/team-maintenance.mjs";
import { timingSafeEqual } from "node:crypto";
import { admin, check, fail, AppError } from "../lib/server.mjs";
import { backupBusinessData } from "../lib/backup.mjs";
import {syncExternalCalendar} from "../lib/calendars.mjs";
import { syncConnection } from "../lib/sync.mjs";
export default async function handler(req, res) {
  try {
    const expected = "Bearer " + process.env.CRON_SECRET,
      actual = req.headers.authorization || "";
    if (
      req.method !== "GET" ||
      !process.env.CRON_SECRET ||
      Buffer.byteLength(actual) !== Buffer.byteLength(expected) ||
      !timingSafeEqual(Buffer.from(actual), Buffer.from(expected))
    )
      throw new AppError("Non autorisé.", 401);
    const client = admin();
    const backupTask=backupBusinessData(client).catch(()=>({ok:false,error:"La sauvegarde métier n’a pas abouti. Vérifiez le stockage et les journaux serveur."}));
    const connections = check(
      await client
        .from("crm_connections")
        .select("*")
        .lte("next_sync_at", new Date().toISOString())
        .order("next_sync_at")
        .limit(10)
    );
    const results = await Promise.all(
      connections.map(async (c) => {
        try {
          const r = await syncConnection(client, c);
          return { id: c.id, ok: true, pending: r.pending };
        } catch {
          return { id: c.id, ok: false };
        }
      })
    );
    const accounts=check(await client.from("crm_calendar_accounts").select("*").order("last_sync_at",{nullsFirst:true}).limit(5));
    const calendars=await Promise.all(accounts.map(async a=>{try{return {id:a.id,ok:true,...await syncExternalCalendar(client,a)};}catch{return {id:a.id,ok:false};}}));
    const documents=await maintainFiles(client).catch(()=>({ok:false}));
    const backup=await backupTask;
    res.status(backup.ok?200:503).json({ processed: results, calendars, documents, backup });
  } catch (e) {
    fail(res, e);
  }
}
