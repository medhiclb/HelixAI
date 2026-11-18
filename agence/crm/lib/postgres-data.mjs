import { AppError } from "./crm.mjs";

const tables = new Set([
  "crm_records", "crm_members", "crm_connections", "crm_busy_slots", "crm_external_slots",
  "crm_messages", "crm_mail_work", "crm_mail_reads", "crm_files", "crm_activity",
  "crm_notifications", "crm_calendar_accounts",
]);

const operations = {
  crm_join_invitations: [],
  crm_create_workspace: [["workspace_name", "text"]],
  crm_save_record: [["w", "uuid"], ["kind", "text"], ["record_id", "uuid"], ["payload", "jsonb"], ["expected_revision", "bigint"]],
  crm_delete_record: [["w", "uuid"], ["kind", "text"], ["record_id", "uuid"], ["expected_revision", "bigint"]],
  crm_save_note_bundle: [["w", "uuid"], ["note_id", "uuid"], ["note_payload", "jsonb"], ["note_revision", "bigint"], ["task_id", "uuid"], ["task_payload", "jsonb"], ["task_revision", "bigint"]],
  crm_refresh_reminders: [["w", "uuid"]],
  crm_mark_notification: [["n", "uuid"]],
  crm_mail_assign: [["w", "uuid"], ["m", "uuid"], ["assignee", "uuid"], ["new_status", "text"], ["expected", "bigint"]],
};

function column(value) {
  if (typeof value !== "string" || !/^[a-z][a-z0-9_]{0,62}$/.test(value)) {
    throw new AppError("Colonne invalide.", 400);
  }
  return `"${value}"`;
}

export function postgresQuery(body) {
  const params = [];
  const bind = value => {
    params.push(value);
    return "$" + params.length;
  };
  if (body.action === "rpc") {
    if (!Object.hasOwn(operations, body.name)) throw new AppError("Opération inconnue.", 400);
    const args = operations[body.name].map(([name, type]) => {
      const value = body.args?.[name] ?? null;
      return bind(type === "jsonb" && value !== null ? JSON.stringify(value) : value) + "::" + type;
    });
    const call = `public.${column(body.name)}(${args.join(",")})`;
    const isVoid = ["crm_join_invitations", "crm_delete_record", "crm_mark_notification"].includes(body.name);
    return { query: `select ${isVoid ? call : `to_jsonb(${call})`} as value`, params };
  }
  if (body.action !== "select" || !tables.has(body.table)) throw new AppError("Table invalide.", 400);
  const linked = body.table === "crm_members" && body.columns === "workspace_id,crm_workspaces(name)";
  if (typeof body.columns !== "string" || body.columns.length > 800) throw new AppError("Sélection invalide.", 400);
  const fields = linked
    ? "r.workspace_id, jsonb_build_object('name', w.name) as crm_workspaces"
    : body.columns === "*" ? "r.*" : body.columns.split(",").map(key => "r." + column(key.trim())).join(",");
  const join = linked ? " join public.crm_workspaces w on w.id=r.workspace_id" : "";
  const filters = body.filters ?? [];
  const orders = body.orders ?? [];
  if (!Array.isArray(filters) || filters.length > 10 || !Array.isArray(orders) || orders.length > 4) {
    throw new AppError("Requête invalide.", 400);
  }
  const where = filters.map(([name, value]) => {
    if (!["string", "boolean", "number"].includes(typeof value)) throw new AppError("Filtre invalide.", 400);
    return "r." + column(name) + "=" + bind(value);
  });
  const ordering = orders.map(([name, ascending]) => `r.${column(name)} ${ascending === false ? "desc" : "asc"}`);
  const offset = body.offset ?? 0;
  const limit = body.limit ?? 500;
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > 100000 ||
      !Number.isSafeInteger(limit) || limit < 1 || limit > 500) {
    throw new AppError("Pagination invalide.", 400);
  }
  const query = `select ${fields} from public.${column(body.table)} r${join}` +
    (where.length ? " where " + where.join(" and ") : "") +
    (ordering.length ? " order by " + ordering.join(",") : "") +
    " limit " + bind(limit) + " offset " + bind(offset);
  return { query, params };
}

export async function postgresData(sql, key, body) {
  const { query, params } = postgresQuery(body);
  const [{ user }] = await sql`select public.crm_native_user(${key}) as "user"`;
  if (!user) throw new AppError("Session expirée.", 401);

  const [, , rows] = await sql.transaction(tx => [
    tx.query("set local role authenticated"),
    tx`select set_config('request.jwt.claim.sub', ${user.id}, true)`,
    tx.query(query, params),
  ]);
  if (body.action === "rpc") return rows[0]?.value ?? null;
  for (const row of rows) {
    if (typeof row.revision === "string") {
      const revision = Number(row.revision);
      if (!Number.isSafeInteger(revision)) throw new AppError("Version de fiche invalide.", 409);
      row.revision = revision;
    }
  }
  if (body.single === true) {
    if (rows.length > 1) throw new AppError("Plusieurs résultats correspondent.", 409);
    return rows[0] ?? null;
  }
  return rows;
}
