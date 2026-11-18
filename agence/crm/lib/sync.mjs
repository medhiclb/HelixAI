import { randomUUID } from "node:crypto";
import { access, check, withBudget, decrypt } from "./server.mjs";
import { stableId, emails, AppError } from "./crm.mjs";
import { messagePage, calendarPage } from "./providers.mjs";
import { imapPage } from "./imap.mjs";
import { isAllowedEmail, SHARED_WORKSPACE } from "./access.mjs";
export async function recordsForSync(client,workspace,entities,contains) {
  const rows=[];
  for(let offset=0;;offset+=500) {
    let q=client.from("crm_records").select("id,entity,data,revision").eq("workspace_id",workspace).in("entity",entities).order("id").range(offset,offset+499);
    if(contains) q=q.contains("data",contains);
    const page=check(await q);
    rows.push(...page);
    if(page.length<500)return rows;
  }
}
export function syncConnection(client, connection) {
  return withBudget(() => syncImplementation(client, connection));
}
async function syncImplementation(client, connection) {
  if (connection.workspace_id !== SHARED_WORKSPACE) throw new AppError("Espace Helix requis.",403);
  const lock = randomUUID();
  const acquired = check(
    await client.rpc("crm_claim_sync", { c: connection.id, lock_id: lock })
  );
  if (!acquired)
    throw new AppError(
      "Une synchronisation de ce compte est déjà en cours.",
      409
    );
  const begin = new Date().toISOString();
  let state;
  let mailCount = 0,
    eventCount = 0;
  try {
    connection=check(await client.from('crm_connections').select('*').eq('id',connection.id).single());
    state={...connection.sync_state};
    const { data: member } = await client
      .from("crm_members")
      .select("user_id")
      .eq("workspace_id", connection.workspace_id)
      .eq("user_id", connection.user_id)
      .single();
    if (!member)
      throw new AppError(
        "Le propriétaire du compte ne fait plus partie de l’espace.",
        403
      );
    const {data: owner} = await client.auth.admin.getUserById(connection.user_id);
    if (!owner?.user?.email_confirmed_at || !(await isAllowedEmail(client, owner.user.email))) throw new AppError("Accès révoqué.",403);
    const token = connection.provider === "imap" ? null : await access(client, connection);
    const records=await recordsForSync(client,connection.workspace_id,["cabinets","contacts"]);
    const lookup = new Map(
      records
        .map((r) => [
          r.data.email?.trim().toLowerCase(),
          r.entity === "cabinets" ? r.id : r.data.cabinet_id,
        ])
        .filter(([email, id]) => email && id)
    );
    if (connection.provider === "imap") {
      let page;
      try {page=await imapPage(decrypt(connection.encrypted_tokens),state.imap,lookup);}
      catch {throw new AppError("Relève IMAP impossible. Vérifiez les autorisations et les paramètres de la messagerie.",502);}
      if(page.items.length) check(await client.from("crm_messages").upsert(page.items.map(m=>({...m,workspace_id:connection.workspace_id,user_id:connection.user_id,provider:"imap",shared:true})),{onConflict:"workspace_id,user_id,provider,external_id"}));
      state.imap=page.state;
      check(await client.from("crm_connections").update({sync_state:state,last_sync_at:begin,sync_error:null,next_sync_at:new Date(Date.now()+(page.pending?15000:60000)).toISOString()}).eq("id",connection.id).eq("sync_lock_id",lock));
      return {messages:page.items.length,meetings:0,pending:page.pending};
    }
    state.mail = state.mail || {
      since: new Date(Date.now() - 30 * 86400000).toISOString(),
      cycle: begin,
    };
    if (!state.mail.cycle) state.mail.cycle = begin;
    const messages = await messagePage(connection, token, state.mail);
    for (const m of messages.items) {
      const sender = emails(m.sender)[0];
      const direction =
        sender === connection.email.toLowerCase() ? "sent" : "received";
      const related = [
        sender,
        ...m.recipients.map((x) => x.toLowerCase()),
      ].filter((x) => x !== connection.email.toLowerCase());
      const cabinet_id = related.map((x) => lookup.get(x)).find(Boolean);
      if (!cabinet_id) continue;
      check(
        await client.from("crm_messages").upsert(
          {
            ...m,
            workspace_id: connection.workspace_id,
            user_id: connection.user_id,
            provider: connection.provider,
            cabinet_id,
            direction,
            shared: connection.share_emails,
          },
          { onConflict: "workspace_id,user_id,provider,external_id" }
        )
      );
      mailCount++;
    }
    state.mail = messages.next
      ? { ...state.mail, next: messages.next }
      : {
          since: new Date(
            new Date(state.mail.cycle).getTime() - 300000
          ).toISOString(),
          next: null,
        };
    // Commit mail progress independently. A calendar failure must not lose the mail cursor.
    check(
      await client
        .from("crm_connections")
        .update({ sync_state: state })
        .eq("id", connection.id)
        .eq("sync_lock_id", lock)
    );
    state.calendar = state.calendar || {
      start: new Date(Date.now() - 30 * 86400000).toISOString(),
      end: new Date(Date.now() + 180 * 86400000).toISOString(),
      generation: randomUUID(),
    };
    const page = await calendarPage(connection, token, state.calendar);
    const generation = state.calendar.generation;
    for (const event of page.items) {
      const id = stableId(
        `${connection.id}:${connection.calendar_id}:${event.external_id}`
      );
      const common = {
        workspace_id: connection.workspace_id,
        user_id: connection.user_id,
        connection_id: connection.id,
        external_id: event.external_id,
        generation,
      };
      if (event.cancelled) {
        check(await client.from("crm_busy_slots").delete().eq("id", id));
        const cancelled=check(await client.from("crm_records").select("data,revision").eq("id",id).maybeSingle());
        if(cancelled) {
          const changed=check(await client.from("crm_records").update({data:{...cancelled.data,status:"Annulé"}}).eq("id",id).eq("revision",cancelled.revision).select("id").maybeSingle());
          if(!changed)throw new AppError("Ce rendez-vous a changé pendant la synchronisation. Réessayez.",409);
        }
        continue;
      }
      if (
        !event.starts_at ||
        !event.ends_at ||
        new Date(event.ends_at) <= new Date(event.starts_at)
      )
        continue;
      const cabinet_id = event.private
        ? null
        : event.attendees.map((x) => lookup.get(x.toLowerCase())).find(Boolean);
      let existing = check(
        await client
          .from("crm_records")
          .select("id,data,revision")
          .eq("id", id)
          .maybeSingle()
      );
      // A calendar event created in the CRM keeps its original record identity (no duplicate).
      if (!existing) {
        existing = check(
          await client
            .from("crm_records")
            .select("id,data,revision")
            .eq("workspace_id", connection.workspace_id)
            .eq("entity", "meetings")
            .contains("data", {
              connection_id: connection.id,
              external_id: event.external_id,
            })
            .maybeSingle()
        );
      }
      if (cabinet_id || existing) {
        if (event.private) {
          if (existing)
            check(
              await client.from("crm_records").delete().eq("id", existing.id)
            );
        } else {
          const recordId = existing?.id || id;
          const recordData={
                ...existing?.data,
                ...event,
                ...(existing?.data?.calendar_dirty
                  ? {
                      name: existing.data.name,
                      starts_at: existing.data.starts_at,
                      ends_at: existing.data.ends_at,
                      description: existing.data.description,
                      location: existing.data.location,
                      remote_etag: existing.data.remote_etag,
                    }
                  : {}),
                id: recordId,
                cabinet_id: cabinet_id || existing?.data?.cabinet_id || "",
                attendees: existing?.data?.calendar_dirty
                  ? existing.data.attendees
                  : event.attendees.join(", "),
                owner: connection.user_id,
                provider: connection.provider,
                calendar_id: connection.calendar_id,
                connection_id: connection.id,
                generation,
                status:
                  existing?.data?.status === "Réalisé" ? "Réalisé" : "Prévu",
                calendar_linked: true,
              };
          const write=existing
            ? client.from("crm_records").update({data:recordData}).eq("id",recordId).eq("revision",existing.revision)
            : client.from("crm_records").insert({id:recordId,workspace_id:connection.workspace_id,entity:"meetings",data:recordData});
          const written=check(await write.select("id").maybeSingle());
          if(!written)throw new AppError("Un rendez-vous a changé pendant la synchronisation. Elle reprendra sans écraser vos modifications.",409);
          eventCount++;
        }
      }
      // Busy slots contain no title, participants, location or description.
      if (!event.free)
        check(
          await client.from("crm_busy_slots").upsert(
            {
              id,
              ...common,
              starts_at: event.starts_at,
              ends_at: event.ends_at,
            },
            { onConflict: "connection_id,external_id" }
          )
        );
      else check(await client.from("crm_busy_slots").delete().eq("id", id));
    }
    if (page.next) {
      state.calendar = { ...state.calendar, next: page.next };
    } else {
      check(
        await client
          .from("crm_busy_slots")
          .delete()
          .eq("connection_id", connection.id)
          .neq("generation", generation)
          .gte("starts_at", state.calendar.start)
          .lt("starts_at", state.calendar.end)
      );
      const imported=await recordsForSync(client,connection.workspace_id,["meetings"],{connection_id:connection.id});
      for (const r of imported) {
        if (
          r.data.generation !== generation &&
          r.data.starts_at >= state.calendar.start &&
          r.data.starts_at < state.calendar.end
        ) {
          const marked=check(await client.from("crm_records").update({data:{...r.data,status:"Annulé"}}).eq("id",r.id).eq("revision",r.revision).select("id").maybeSingle());
          if(!marked)throw new AppError("Un rendez-vous a changé pendant la synchronisation. Réessayez.",409);
        }
      }
      state.calendar = null;
    }
    const pending = !!state.mail?.next || !!state.calendar?.next;
    check(
      await client
        .from("crm_connections")
        .update({
          sync_state: state,
          last_sync_at: begin,
          sync_error: null,
          next_sync_at: new Date(
            Date.now() + (pending ? 15000 : 300000)
          ).toISOString(),
        })
        .eq("id", connection.id)
        .eq("sync_lock_id", lock)
    );
    return { messages: mailCount, meetings: eventCount, pending };
  } catch (error) {
    await client
      .from("crm_connections")
      .update({
        sync_error: error.message,
        next_sync_at: new Date(Date.now() + 900000).toISOString(),
      })
      .eq("id", connection.id)
      .eq("sync_lock_id", lock);
    throw error;
  } finally {
    await client
      .from("crm_connections")
      .update({ sync_locked_until: null, sync_lock_id: null })
      .eq("id", connection.id)
      .eq("sync_lock_id", lock);
  }
}
