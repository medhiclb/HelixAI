import React, { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, CalendarDays } from "lucide-react";
import {
  daysOf,
  scheduleItems,
  layoutDay,
  localInput,
  weekOf,
  overlaps,
} from "../planning.mjs";
export default function Planning({ data, busy, members, onEdit, onCreate }) {
  const [anchor, setAnchor] = useState(new Date()),
    [member, setMember] = useState(""),
    [kind, setKind] = useState("");
  const scroll = useRef(null);
  useEffect(() => {
    if (scroll.current) scroll.current.scrollTop = 7 * 48;
  }, []);
  const days = daysOf(anchor),
    items = scheduleItems(data, busy, members).filter(
      (x) =>
        (!member || x.member_ids.includes(member)) &&
        (!kind || x.entity === kind)
    );
  const move = (n) => {
    const d = new Date(anchor);
    d.setDate(d.getDate() + n * 7);
    setAnchor(d);
  };
  const memberName = (id) =>
    members.find((m) => m.user_id === id)?.display_name || "Non attribué";
  const create = (day, hour = 9) => {
    const d = new Date(day);
    d.setHours(hour, 0, 0, 0);
    onCreate({
      starts_at: localInput(d),
      ends_at: localInput(new Date(+d + 3600000)),
      ...(member ? { owner: member } : {}),
    });
  };
  return (
    <section className="planning">
      <div className="planning-controls">
        <div className="week-switch">
          <button
            aria-label="Semaine précédente"
            className="secondary"
            onClick={() => move(-1)}
          >
            <ChevronLeft size={16} />
          </button>
          <button className="secondary" onClick={() => setAnchor(new Date())}>
            Aujourd’hui
          </button>
          <button
            aria-label="Semaine suivante"
            className="secondary"
            onClick={() => move(1)}
          >
            <ChevronRight size={16} />
          </button>
          <strong>
            {days[0].toLocaleDateString("fr-FR", {
              day: "numeric",
              month: "short",
            })}{" "}
            ·{" "}
            {days[6].toLocaleDateString("fr-FR", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </strong>
        </div>
        <div className="planning-filters">
          <select
            aria-label="Membre du planning"
            value={member}
            onChange={(e) => setMember(e.target.value)}
          >
            <option value="">Toute l’équipe</option>
            {members.map((m) => (
              <option key={m.user_id} value={m.user_id}>
                {m.display_name}
              </option>
            ))}
          </select>
          <select
            aria-label="Type d’élément du planning"
            value={kind}
            onChange={(e) => setKind(e.target.value)}
          >
            <option value="">Tout le planning</option>
            <option value="meetings">Rendez-vous</option>
            <option value="tasks">Relances</option>
            <option value="events">Événements</option>
            <option value="busy">Indisponibilités</option>
          </select>
        </div>
      </div>
      <div className="planning-legend">
        <span className="legend-meeting">Rendez-vous</span>
        <span className="legend-task">Relance</span>
        <span className="legend-event">Événement</span>
        <span className="legend-busy">Occupé (détails privés)</span>
        <small>
          Fuseau : {Intl.DateTimeFormat().resolvedOptions().timeZone}
        </small>
      </div>
      <div className="planning-scroll" ref={scroll}>
        <div className="week-grid">
          <div className="week-head">
            <div className="time-gutter" />
            {days.map((day) => (
              <div
                key={+day}
                className={
                  day.toDateString() === new Date().toDateString()
                    ? "today day-head"
                    : "day-head"
                }
              >
                <small>
                  {day.toLocaleDateString("fr-FR", { weekday: "short" })}
                </small>
                <strong>{day.getDate()}</strong>
                <div className="all-day">
                  {items
                    .filter(
                      (x) =>
                        x.all_day &&
                        overlaps(x, {
                          starts_at: day,
                          ends_at: new Date(
                            new Date(day).setDate(day.getDate() + 1)
                          ),
                        })
                    )
                    .map((x) => (
                      <button
                        key={x.id}
                        className={`calendar-chip ${x.entity}`}
                        onClick={() =>
                          x.entity !== "busy" && onEdit(x.entity, x)
                        }
                      >
                        {x.name}
                      </button>
                    ))}
                </div>
              </div>
            ))}
          </div>
          <div className="week-body">
            <div className="hours">
              {Array.from({ length: 24 }, (_, hour) => (
                <span key={hour}>{String(hour).padStart(2, "0")}:00</span>
              ))}
            </div>
            {days.map((day) => (
              <div className="day-column" key={+day}>
                {Array.from({ length: 24 }, (_, hour) => (
                  <button
                    key={hour}
                    className="hour-slot"
                    aria-label={`Créer un rendez-vous ${day.toLocaleDateString(
                      "fr-FR"
                    )} à ${hour} heures`}
                    onClick={() => create(day, hour)}
                  />
                ))}
                {layoutDay(items, day).map((x) => (
                  <button
                    key={x.id}
                    className={`calendar-item ${x.entity}`}
                    style={{
                      top: (x.startMinute / 60) * 48,
                      height: Math.max(
                        ((x.endMinute - x.startMinute) / 60) * 48,
                        24
                      ),
                      left: `calc(${(x.lane / x.lanes) * 100}% + 3px)`,
                      width: `calc(${100 / x.lanes}% - 6px)`,
                    }}
                    title={`${x.name} · ${memberName(x.owner)}`}
                    onClick={() => x.entity !== "busy" && onEdit(x.entity, x)}
                  >
                    <span>
                      {new Date(x.starts_at).toLocaleTimeString("fr-FR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    <strong>{x.name}</strong>
                    <small>{memberName(x.owner)}</small>
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
      <p className="planning-hint">
        Cliquez sur un créneau pour créer un rendez-vous. Rendez-vous, relances
        et événements ouvrent leur fiche ; les créneaux personnels affichent
        uniquement une indisponibilité.
      </p>
    </section>
  );
}
