import {
  authorize,
  connectionFor,
  access,
  jsonFetch,
  check,
  fail,
  AppError,
} from "../lib/server.mjs";
import { validateMeeting } from "../lib/crm.mjs";
import {
  calendarBase,
  normalizeGoogleEvent,
  normalizeMicrosoftEvent,
} from "../lib/providers.mjs";
import {
  claimOperation,
  finishOperation,
  failOperation,
} from "../lib/outbox.mjs";
export default async function handler(req, res) {
  let ctx, operation;
  try {
    ctx = await authorize(req);
    const c = await connectionFor(ctx, req.body.provider);
    if (!c.capabilities?.calendar_write)
      throw new AppError(
        "Reconnectez votre compte avec l’autorisation de modifier votre calendrier."
      );
    const row = check(
      await ctx.client
        .from("crm_records")
        .select("*")
        .eq("id", req.body.record_id)
        .eq("workspace_id", ctx.workspace)
        .eq("entity", "meetings")
        .single()
    );
    if (row.data.owner !== ctx.user.id)
      throw new AppError(
        "Seul l’organisateur peut publier ce rendez-vous dans son propre agenda.",
        403
      );
    const action = req.body.action;
    if (!["publish", "cancel", "reload"].includes(action))
      throw new AppError("Action inconnue.");
    const linked = !!row.data.external_id;
    if (
      linked &&
      (row.data.connection_id !== c.id ||
        row.data.calendar_id !== c.calendar_id)
    )
      throw new AppError(
        "Ce rendez-vous appartient à un autre compte ou calendrier."
      );
    if (action === "reload") {
      if (!linked)
        throw new AppError("Ce rendez-vous n’est pas lié à un calendrier.");
      const token = await access(ctx.client, c);
      const remote = await jsonFetch(
        calendarBase(c) + "/events/" + encodeURIComponent(row.data.external_id),
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Prefer: 'outlook.timezone="UTC"',
          },
        }
      );
      const event =
        c.provider === "google"
          ? normalizeGoogleEvent(remote)
          : normalizeMicrosoftEvent(remote);
      const redacted = event.private
        ? {
            name: "Occupé · calendrier personnel",
            description: "",
            location: "",
            attendees: [],
            cabinet_id: "",
          }
        : {};
      const record = {
        ...row.data,
        ...event,
        ...redacted,
        attendees: (redacted.attendees || event.attendees).join(", "),
        calendar_dirty: false,
        status: event.cancelled ? "Annulé" : "Prévu",
      };
      const saved=check(await ctx.client.from("crm_records").update({data:record}).eq("id",row.id).eq("revision",row.revision).select("revision").maybeSingle());
      if(!saved)throw new AppError("Cette fiche a changé pendant le chargement de l’agenda. Rechargez-la avant de réessayer.",409);
      res.json({ ok: true, record: { ...record, id: row.id, _revision:saved.revision, _base:record } });
      return;
    }
    if (linked && row.data.can_edit === false)
      throw new AppError(
        "Vous n’êtes pas l’organisateur de cet événement dans le calendrier.",
        403
      );
    const meeting = validateMeeting(row.data),
      token = await access(ctx.client, c);
    if (action === "publish" && !req.body.allow_conflict) {
      const busy = check(
        await ctx.client
          .from("crm_busy_slots")
          .select("external_id")
          .eq("workspace_id", ctx.workspace)
          .eq("user_id", ctx.user.id)
          .lt("starts_at", meeting.ends_at)
          .gt("ends_at", meeting.starts_at)
      );
      if (busy.some((b) => b.external_id !== row.data.external_id))
        throw new AppError(
          "Ce créneau chevauche une indisponibilité. Confirmez le chevauchement pour publier.",
          409
        );
    }
    const claimed = await claimOperation(ctx, req.body.request_key, "calendar");
    if (claimed.result) {
      res.json(claimed.result);
      return;
    }
    operation = claimed.operation;
    const headers = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(linked && row.data.remote_etag
        ? { "If-Match": row.data.remote_etag }
        : {}),
    };
    const base = calendarBase(c);
    let external_id = row.data.external_id,
      providerResult = {};
    if (action === "cancel") {
      if (!linked) throw new AppError("Ce rendez-vous n’est pas publié.");
      try {
        await jsonFetch(
          base +
            "/events/" +
            encodeURIComponent(external_id) +
            (c.provider === "google" ? "?sendUpdates=all" : ""),
          { method: "DELETE", headers }
        );
      } catch (e) {
        if (e.providerStatus !== 404 && e.providerStatus !== 410) throw e;
      }
    } else if (c.provider === "google") {
      const event = {
        summary: meeting.name,
        description: meeting.description || "",
        location: meeting.location || "",
        start: { dateTime: meeting.starts_at },
        end: { dateTime: meeting.ends_at },
        attendees: meeting.attendees.map((email) => ({ email })),
        extendedProperties: { private: { helix_id: row.id } },
      };
      if (!linked) event.id = "ac" + row.id.replaceAll("-", "");
      try {
        providerResult = await jsonFetch(
          base +
            "/events" +
            (linked ? "/" + encodeURIComponent(external_id) : "") +
            "?sendUpdates=all",
          {
            method: linked ? "PATCH" : "POST",
            headers,
            body: JSON.stringify(event),
          }
        );
      } catch (e) {
        if (!linked && e.providerStatus === 409) {
          providerResult = await jsonFetch(base + "/events/" + event.id, {
            headers,
          });
        } else throw e;
      }
      external_id = providerResult.id;
    } else {
      const event = {
        subject: meeting.name,
        body: { contentType: "Text", content: meeting.description || "" },
        location: { displayName: meeting.location || "" },
        start: { dateTime: meeting.starts_at, timeZone: "UTC" },
        end: { dateTime: meeting.ends_at, timeZone: "UTC" },
        attendees: meeting.attendees.map((address) => ({
          emailAddress: { address },
          type: "required",
        })),
        ...(!linked ? { transactionId: row.id } : {}),
      };
      providerResult = await jsonFetch(
        linked
          ? base + "/events/" + encodeURIComponent(external_id)
          : base + "/events",
        {
          method: linked ? "PATCH" : "POST",
          headers,
          body: JSON.stringify(event),
        }
      );
      external_id = providerResult.id;
    }
    const updated = {
      ...row.data,
      provider: c.provider,
      calendar_id: c.calendar_id,
      connection_id: c.id,
      external_id,
      calendar_linked: true,
      calendar_dirty: false,
      remote_etag:
        providerResult.etag ||
        providerResult["@odata.etag"] ||
        row.data.remote_etag,
      can_edit: true,
      status: action === "cancel" ? "Annulé" : row.data.status || "Prévu",
    };
    const saved=check(await ctx.client.from("crm_records").update({data:updated}).eq("id",row.id).eq("revision",row.revision).select("revision").maybeSingle());
    if(!saved)throw new AppError("L’agenda a été mis à jour, mais la fiche CRM a changé entre-temps. Rechargez la fiche et vérifiez l’agenda avant de recommencer.",409);
    const result = {
      ok: true,
      record: { ...updated, id: row.id, _revision:saved.revision, _base:updated },
      cancelled: action === "cancel",
    };
    await finishOperation(ctx, operation, result);
    operation = null;
    await ctx.client
      .from("crm_connections")
      .update({ next_sync_at: new Date().toISOString() })
      .eq("id", c.id);
    res.json(result);
  } catch (e) {
    if (ctx && operation) await failOperation(ctx, operation, e);
    fail(res, e);
  }
}
