export function localInput(value) {
  if (!value) return "";
  const d = new Date(value);
  if (!Number.isFinite(+d)) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(d.getDate()).padStart(2, "0")}T${String(d.getHours()).padStart(
    2,
    "0"
  )}:${String(d.getMinutes()).padStart(2, "0")}`;
}
export function weekOf(value) {
  const d = new Date(value);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}
export function daysOf(value) {
  const start = weekOf(value);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}
export function scheduleItems(data, busy, members) {
  const linked = new Set(
    data.meetings
      .filter((x) => x.status !== "Annulé" && x.external_id)
      .map((x) => `${x.connection_id}:${x.external_id}`)
  );
  const internal = ["meetings", "events", "tasks"].flatMap((entity) =>
    data[entity]
      .filter(
        (x) => x.status !== "Annulé" && !x.done && (x.starts_at || x.due_at)
      )
      .map((x) => ({
        ...x,
        entity,
        starts_at: x.starts_at || x.due_at,
        ends_at:
          x.ends_at ||
          new Date(
            new Date(x.starts_at || x.due_at).getTime() +
              (entity === "tasks" ? 15 : 60) * 60000
          ).toISOString(),
        member_ids: [
          ...new Set(
            [
              x.owner,
              ...members
                .filter((m) =>
                  String(x.attendees || "")
                    .toLowerCase()
                    .includes(m.email.toLowerCase())
                )
                .map((m) => m.user_id),
            ].filter(Boolean)
          ),
        ],
      }))
  );
  return [
    ...internal,
    ...busy
      .filter((x) => !linked.has(`${x.connection_id}:${x.external_id}`))
      .map((x) => ({
        ...x,
        entity: "busy",
        name: x.title || "Occupé · calendrier personnel",
        owner: x.user_id,
        member_ids: [x.user_id],
      })),
  ];
}
export function overlaps(a, b) {
  return (
    new Date(a.starts_at) < new Date(b.ends_at) &&
    new Date(a.ends_at) > new Date(b.starts_at)
  );
}
export function conflicts(record, items) {
  if (!record.starts_at || !record.ends_at || record.status === "Annulé")
    return [];
  return items.filter(
    (x) =>
      x.id !== record.id &&
      x.entity !== "tasks" &&
      x.status !== "Annulé" &&
      overlaps(record, x) &&
      (x.member_ids || [x.owner]).includes(record.owner)
  );
}
export function layoutDay(items, date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  const timed = items
    .filter(
      (x) =>
        !x.all_day && new Date(x.starts_at) < end && new Date(x.ends_at) > start
    )
    .map((x) => {
      const a = new Date(Math.max(+new Date(x.starts_at), +start)),
        b = new Date(Math.min(+new Date(x.ends_at), +end));
      return {
        ...x,
        startMinute: a.getHours() * 60 + a.getMinutes(),
        endMinute: +b === +end ? 1440 : b.getHours() * 60 + b.getMinutes(),
      };
    })
    .sort((a, b) => a.startMinute - b.startMinute || b.endMinute - a.endMinute);
  let cluster = [],
    clusterEnd = -1;
  const result = [];
  function flush() {
    const lanes = [];
    for (const item of cluster) {
      let lane = lanes.findIndex((end) => end <= item.startMinute);
      if (lane < 0) lane = lanes.length;
      lanes[lane] = Math.max(item.endMinute, item.startMinute + 30);
      item.lane = lane;
    }
    for (const item of cluster) result.push({ ...item, lanes: lanes.length });
    cluster = [];
  }
  for (const item of timed) {
    if (item.startMinute >= clusterEnd) {
      flush();
      clusterEnd = -1;
    }
    cluster.push(item);
    clusterEnd = Math.max(clusterEnd, item.endMinute, item.startMinute + 30);
  }
  flush();
  return result;
}
