export const stages = [
  "À qualifier",
  "Premier contact",
  "Démo planifiée",
  "Proposition",
  "Négociation",
  "Gagné",
  "Perdu",
];
export const entities = [
  "cabinets",
  "contacts",
  "opportunities",
  "tasks",
  "meetings",
  "events",
  "notes",
];
export const blank = () => Object.fromEntries(entities.map((e) => [e, []]));
export function isOverdue(task, now = new Date()) {
  return !task.done && !!task.due_at && new Date(task.due_at) < now;
}
export function pipelineTotal(items) {
  return items
    .filter((x) => !["Gagné", "Perdu"].includes(x.stage))
    .reduce((n, x) => n + Number(x.amount || 0), 0);
}
export function escapeCsv(value) {
  const text = String(value ?? "");
  return (
    '"' +
    (/^[=+@\-\t\r]/.test(text) ? "'" : "") +
    text.replaceAll('"', '""') +
    '"'
  );
}
export function exportCsv(rows) {
  const keys = [...new Set(rows.flatMap(Object.keys))].filter(k=>!k.startsWith("_"));
  return (
    "\uFEFF" +
    [keys, ...rows.map((r) => keys.map((k) => r[k]))]
      .map((r) => r.map(escapeCsv).join(";"))
      .join("\r\n")
  );
}
