import { createClient } from "@supabase/supabase-js";
import { blank, entities } from "./domain.mjs";
export const db =
  import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY
    ? createClient(
        import.meta.env.VITE_SUPABASE_URL,
        import.meta.env.VITE_SUPABASE_ANON_KEY
      )
    : null;
const key = "helix-crm-local-v1";
export function localRead() {
  try {
    return { ...blank(), ...JSON.parse(localStorage.getItem(key) || "{}") };
  } catch {
    return blank();
  }
}
export async function readAll(workspace) {
  if (!db) return localRead();
  const results = await Promise.all(
    entities.map(async (entity) => {
      const data = [];
      for (let offset = 0; ; offset += 500) {
        const { data: page, error } = await db
          .from("crm_records")
          .select("id,data,created_at,revision")
          .eq("workspace_id", workspace)
          .eq("entity", entity)
          .order("created_at", { ascending: false })
          .order("id")
          .range(offset, offset + 499);
        if (error) throw error;
        data.push(...page);
        if (page.length < 500) break;
      }
      return [
        entity,
        data.map((x) => ({ ...x.data, id: x.id, created_at: x.created_at, _revision: x.revision, _base: x.data })),
      ];
    })
  );
  return Object.fromEntries(results);
}
export async function saveRecord(entity, data, workspace) {
  const record = {
    ...data,
    id: data.id || crypto.randomUUID(),
    created_at: data.created_at || new Date().toISOString(),
  };
  if (db) {
    const {_revision, _base, ...payload}=record;
    const {data:saved,error}=await db.rpc("crm_save_record",{w:workspace,kind:entity,record_id:record.id,payload,expected_revision:_revision ?? null}).single();
    if(error) throw error;
    return {...saved.data,id:saved.id,created_at:saved.created_at,_revision:saved.revision,_base:saved.data};
  } else {
    const all = localRead();
    all[entity] = [record, ...all[entity].filter((x) => x.id !== record.id)];
    localStorage.setItem(key, JSON.stringify(all));
  }
  return record;
}
export async function deleteRecord(entity, id, workspace, revision) {
  if (db) {
    if(!Number.isSafeInteger(revision)) throw Error("Rechargez cette fiche avant de la supprimer.");
    const {error}=await db.rpc("crm_delete_record",{w:workspace,kind:entity,record_id:id,expected_revision:revision});
    if (error) throw error;
  } else {
    const all = localRead();
    all[entity] = all[entity].filter((x) => x.id !== id);
    localStorage.setItem(key, JSON.stringify(all));
  }
}

export async function saveNoteWithFollowup(note,task,workspace) {
  const {_revision:noteRevision,...notePayload}=note;
  const {_revision:taskRevision,...taskPayload}=task;
  if(!db) {
    const saved=await saveRecord("notes",note,workspace);
    await saveRecord("tasks",task,workspace);
    return saved;
  }
  const {data,error}=await db.rpc("crm_save_note_bundle",{w:workspace,note_id:note.id,note_payload:notePayload,note_revision:noteRevision ?? null,task_id:task.id,task_payload:taskPayload,task_revision:taskRevision ?? null});
  if(error)throw error;
  return {...data.note.data,id:data.note.id,created_at:data.note.created_at,_revision:data.note.revision,_base:data.note.data};
}
