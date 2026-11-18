import {
  authorize,
  connectionFor,
  access,
  check,
  fail,
  jsonFetch,
  AppError,
} from "../lib/server.mjs";
import { graph } from "../lib/providers.mjs";
export default async function handler(req, res) {
  try {
    const ctx = await authorize(req);
    const { client } = ctx;
    const { action, provider } = req.body;
    const c = await connectionFor(ctx, provider);
    if (action === "disconnect") {
      check(await client.rpc('crm_disconnect_connection',{c:c.id}));
      res.json({ ok: true });
      return;
    }
    if(action === "settings" && req.body.share_emails !== true) throw new AppError("Les échanges CRM sont partagés dans l’espace commun Helix.");
    if(provider === "imap") {
      if(action === "calendars") {res.json({calendars:[]});return;}
      if(action === "settings") {res.json({ok:true});return;}
      throw new AppError("Action inconnue.");
    }
    const token = await access(client, c),
      headers = { Authorization: `Bearer ${token}` };
    let calendars = [];
    let next =
      provider === "google"
        ? "https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=250"
        : graph + "/me/calendars?$top=100";
    for (let page = 0; next && page < 10; page++) {
      const r = await jsonFetch(next, { headers });
      calendars.push(
        ...(provider === "google"
          ? (r.items || [])
              .filter((x) => !x.deleted)
              .map((x) => ({
                id: x.primary ? "primary" : x.id,
                name: x.summary,
                write: ["owner", "writer"].includes(x.accessRole),
              }))
          : (r.value || []).map((x) => ({
              id: x.isDefaultCalendar ? "primary" : x.id,
              name: x.name,
              write: !!x.canEdit,
            })))
      );
      next =
        provider === "google" && r.nextPageToken
          ? "https://www.googleapis.com/calendar/v3/users/me/calendarList?" +
            new URLSearchParams({
              maxResults: "250",
              pageToken: r.nextPageToken,
            })
          : r["@odata.nextLink"] || null;
      if (
        next &&
        new URL(next).hostname !==
          (provider === "google" ? "www.googleapis.com" : "graph.microsoft.com")
      )
        throw new AppError("Pagination refusée.");
    }
    if (action === "calendars") {
      res.json({ calendars });
      return;
    }
    if (action === "settings") {
      const calendar_id=String(req.body.calendar_id||c.calendar_id);
      if(!calendars.some(x=>x.id===calendar_id))throw new AppError('Calendrier introuvable.');
      check(await client.rpc('crm_set_connection_settings',{c:c.id,calendar:calendar_id,share:req.body.share_emails===true}));
      res.json({ ok: true });
      return;
    }
    throw new AppError("Action inconnue.");
  } catch (e) {
    fail(res, e);
  }
}
