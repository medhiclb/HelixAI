import { jsonFetch } from "./server.mjs";
import { emails, googleBody, safeNext } from "./crm.mjs";
export const googleBase = "https://www.googleapis.com/calendar/v3/calendars/";
export const graph = "https://graph.microsoft.com/v1.0";
export const calendarBase = (c) =>
  c.provider === "google"
    ? googleBase + encodeURIComponent(c.calendar_id || "primary")
    : c.calendar_id === "primary"
    ? graph + "/me/calendar"
    : graph + "/me/calendars/" + encodeURIComponent(c.calendar_id);
const header = (m, name) =>
  m.payload?.headers?.find((h) => h.name.toLowerCase() === name)?.value || "";
export function googleMessage(m) {
  return {
    external_id: m.id,
    sender: header(m, "from"),
    recipients: [...emails(header(m, "to")), ...emails(header(m, "cc"))],
    subject: header(m, "subject"),
    sent_at: new Date(Number(m.internalDate)).toISOString(),
    snippet: m.snippet || "",
    body_text: googleBody(m.payload).slice(0, 100000),
    thread_id: m.threadId,
    internet_message_id: header(m, "message-id"),
    deleted: (m.labelIds || []).includes("TRASH"),
  };
}
export function microsoftMessage(m) {
  return {
    external_id: m.id,
    sender: m.from?.emailAddress?.address || "",
    recipients: [...(m.toRecipients || []), ...(m.ccRecipients || [])]
      .map((x) => x.emailAddress?.address)
      .filter(Boolean),
    subject: m.subject || "",
    sent_at: m.sentDateTime || m.receivedDateTime,
    snippet: m.bodyPreview || "",
    body_text:
      m.body?.contentType?.toLowerCase() === "text"
        ? m.body.content.slice(0, 100000)
        : m.bodyPreview || "",
    thread_id: m.conversationId,
    internet_message_id: m.internetMessageId,
    deleted: false,
  };
}
export function normalizeGoogleEvent(e) {
  return {
    external_id: e.id,
    name: e.summary || "Rendez-vous",
    starts_at: e.start?.dateTime || e.start?.date,
    ends_at: e.end?.dateTime || e.end?.date,
    all_day: !!e.start?.date,
    location: e.location || e.hangoutLink || "",
    attendees: (e.attendees || []).map((x) => x.email).filter(Boolean),
    description: e.description || "",
    private: e.visibility === "private" || e.visibility === "confidential",
    cancelled: e.status === "cancelled",
    free: e.transparency === "transparent",
    can_edit: !!e.organizer?.self,
    crm_id: e.extendedProperties?.private?.helix_id,
    remote_etag: e.etag,
  };
}
const utc = (value) =>
  !value ? null : /([zZ]|[+-]\d\d:\d\d)$/.test(value) ? value : value + "Z";
export function normalizeMicrosoftEvent(e) {
  return {
    external_id: e.id,
    name: e.subject || "Rendez-vous",
    starts_at: utc(e.start?.dateTime),
    ends_at: utc(e.end?.dateTime),
    all_day: e.isAllDay || false,
    location: e.location?.displayName || e.onlineMeeting?.joinUrl || "",
    attendees: (e.attendees || [])
      .map((x) => x.emailAddress?.address)
      .filter(Boolean),
    description: e.bodyPreview || "",
    private: ["private", "confidential"].includes(e.sensitivity),
    cancelled: e.isCancelled || false,
    free: e.showAs === "free",
    can_edit: !!e.isOrganizer,
    remote_etag: e["@odata.etag"],
  };
}
export async function messagePage(connection, token, state) {
  const headers = {
    Authorization: `Bearer ${token}`,
    Prefer: 'outlook.body-content-type="text"',
  };
  if (connection.provider === "google") {
    const params = new URLSearchParams({
      maxResults: "25",
      q: `after:${Math.floor(
        new Date(state.since).getTime() / 1000
      )} -in:trash -in:spam`,
    });
    if (state.next) params.set("pageToken", state.next);
    const page = await jsonFetch(
      "https://gmail.googleapis.com/gmail/v1/users/me/messages?" + params,
      { headers }
    );
    const result = [];
    for (let i = 0; i < (page.messages || []).length; i += 5) {
      const batch = await Promise.all(
        page.messages
          .slice(i, i + 5)
          .map((m) =>
            jsonFetch(
              `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(
                m.id
              )}?format=full`,
              { headers }
            ).then(googleMessage)
          )
      );
      result.push(...batch);
    }
    return { items: result, next: page.nextPageToken || null };
  }
  const url = state.next
    ? safeNext(state.next, "microsoft")
    : graph +
      "/me/messages?" +
      new URLSearchParams({
        $top: "25",
        $orderby: "lastModifiedDateTime asc",
        $filter: `lastModifiedDateTime ge ${state.since}`,
        $select:
          "id,subject,from,toRecipients,ccRecipients,sentDateTime,receivedDateTime,bodyPreview,body,conversationId,internetMessageId",
      });
  const page = await jsonFetch(url, { headers });
  return {
    items: (page.value || []).map(microsoftMessage),
    next: page["@odata.nextLink"] || null,
  };
}
export async function calendarPage(connection, token, state) {
  const headers = {
    Authorization: `Bearer ${token}`,
    Prefer: 'outlook.timezone="UTC"',
  };
  const base = calendarBase(connection);
  const params =
    connection.provider === "google"
      ? new URLSearchParams({
          maxResults: "100",
          singleEvents: "true",
          showDeleted: "true",
          timeMin: state.start,
          timeMax: state.end,
        })
      : new URLSearchParams({
          startDateTime: state.start,
          endDateTime: state.end,
          $top: "100",
        });
  if (connection.provider === "google" && state.next)
    params.set("pageToken", state.next);
  const url =
    connection.provider === "google"
      ? base + "/events?" + params
      : state.next
      ? safeNext(state.next, "microsoft")
      : base + "/calendarView?" + params;
  const page = await jsonFetch(url, { headers });
  return {
    items:
      connection.provider === "google"
        ? (page.items || []).map(normalizeGoogleEvent)
        : (page.value || []).map(normalizeMicrosoftEvent),
    next:
      connection.provider === "google"
        ? page.nextPageToken || null
        : page["@odata.nextLink"] || null,
  };
}
