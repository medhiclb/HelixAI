import test from 'node:test';import assert from 'node:assert/strict';
import {parseCalendar,calendarUrl,safeCalendarFetch} from '../lib/calendars.mjs';
const ics=(body)=>`BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Test//EN\r\n${body}\r\nEND:VCALENDAR`;
test('agendas : récurrences, exception déplacée et événements privés',()=>{
 const result=parseCalendar(ics('BEGIN:VEVENT\r\nUID:one\r\nDTSTART:20261114T100000Z\r\nDTEND:20261114T110000Z\r\nRRULE:FREQ=DAILY;COUNT=3\r\nSUMMARY:Audience\r\nCLASS:PRIVATE\r\nEND:VEVENT\r\nBEGIN:VEVENT\r\nUID:one\r\nRECURRENCE-ID:20261115T100000Z\r\nDTSTART:20261115T120000Z\r\nDTEND:20261115T130000Z\r\nSUMMARY:Déplacé\r\nEND:VEVENT'),new Date('2026-11-14'),new Date('2026-11-18'));
 assert.equal(result.length,3);assert.equal(result[1].starts_at,'2026-11-15T12:00:00.000Z');assert.equal(result[0].private,true);
});
test('agendas : annulation et URL sans secrets ou réseau interne',async()=>{
 assert.throws(()=>calendarUrl('http://example.com'));assert.throws(()=>calendarUrl('https://user:pass@example.com'));
 await assert.rejects(safeCalendarFetch('https://127.0.0.1/private'),/non autorisé/);
 assert.equal(parseCalendar(ics('BEGIN:VEVENT\r\nUID:no\r\nDTSTART:20261114T100000Z\r\nDTEND:20261114T110000Z\r\nSTATUS:CANCELLED\r\nEND:VEVENT'),new Date('2026-11-14'),new Date('2026-11-15')).length,0);
});
test('agendas : fuseau IANA sans VTIMEZONE et changement d’heure français',()=>{
 const rows=parseCalendar(ics('BEGIN:VEVENT\r\nUID:paris\r\nDTSTART;TZID=Europe/Paris:20261024T100000\r\nDTEND;TZID=Europe/Paris:20261024T110000\r\nRRULE:FREQ=DAILY;COUNT=3\r\nEND:VEVENT'),new Date('2026-10-24'),new Date('2026-10-28'));
 assert.equal(rows[0].starts_at,'2026-10-24T08:00:00.000Z');assert.equal(rows[1].starts_at,'2026-10-25T09:00:00.000Z');assert.equal(rows[2].ends_at,'2026-10-26T10:00:00.000Z');
});
