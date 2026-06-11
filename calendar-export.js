/* global module, window */
(function calendarExportModule(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.CalendarExport = api;
}(typeof window !== 'undefined' ? window : globalThis, () => {
  function escapeText(str) {
    return String(str)
      .replace(/\\/g, '\\\\')
      .replace(/;/g, '\\;')
      .replace(/,/g, '\\,')
      .replace(/\r/g, '')
      .replace(/\n/g, '\\n');
  }

  // RFC 5545 §3.1 — fold lines exceeding 75 characters (character-based, not byte-based,
  // which is conservative for ASCII and acceptable for the calendaring clients we target).
  function foldLine(line) {
    const MAX = 75;
    if (line.length <= MAX) return line;
    const chunks = [];
    let pos = 0;
    while (pos < line.length) {
      const limit = pos === 0 ? MAX : MAX - 1; // continuation lines carry a leading space
      chunks.push(line.slice(pos, pos + limit));
      pos += limit;
    }
    return chunks.join('\r\n ');
  }

  function addDays(dateKey, n) {
    const [year, month, day] = dateKey.split('-').map(Number);
    const d = new Date(Date.UTC(year, month - 1, day));
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  }

  function addMonths(dateKey, n) {
    const [year, month, day] = dateKey.split('-').map(Number);
    const d = new Date(Date.UTC(year, month - 1, day));
    d.setUTCMonth(d.getUTCMonth() + n);
    return d.toISOString().slice(0, 10);
  }

  function nextOccurrence(dateKey, recurrence) {
    if (recurrence === 'daily') return addDays(dateKey, 1);
    if (recurrence === 'weekly') return addDays(dateKey, 7);
    if (recurrence === 'monthly') return addMonths(dateKey, 1);
    return null;
  }

  function todayKey() {
    const now = new Date();
    return now.toISOString().slice(0, 10);
  }

  function nowStamp() {
    const iso = new Date().toISOString();
    return iso.slice(0, 4) + iso.slice(5, 7) + iso.slice(8, 10) + 'T'
      + iso.slice(11, 13) + iso.slice(14, 16) + iso.slice(17, 19) + 'Z';
  }

  function toDateStamp(dateKey) {
    return dateKey.replace(/-/g, '');
  }

  function buildVEvent(todo, dateKey, uid, stamp) {
    const descParts = [`Priority: ${todo.priority}`];
    if (todo.recurrence && todo.recurrence !== 'none') {
      descParts.push(`Repeats: ${todo.recurrence}`);
    }
    if (todo.githubUrl) {
      descParts.push(`GitHub: ${todo.githubUrl}`);
    }
    return [
      'BEGIN:VEVENT',
      `UID:${escapeText(uid)}`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${toDateStamp(dateKey)}`,
      `DTEND;VALUE=DATE:${toDateStamp(addDays(dateKey, 1))}`,
      `SUMMARY:${escapeText(todo.text)}`,
      `DESCRIPTION:${escapeText(descParts.join('\n'))}`,
      'END:VEVENT',
    ];
  }

  function occurrencesInHorizon(todo, horizonDays, today) {
    const horizon = addDays(today, horizonDays);
    let start = todo.dueDate || today;
    // Advance a past-due start date forward until it is on or after today.
    while (start < today) {
      const next = nextOccurrence(start, todo.recurrence);
      if (!next || next === start) return [];
      start = next;
    }
    const dates = [];
    let current = start;
    while (current && current <= horizon) {
      dates.push(current);
      const next = nextOccurrence(current, todo.recurrence);
      if (!next || next === current) break;
      current = next;
    }
    return dates;
  }

  function generateIcs(todos, opts) {
    const { today = todayKey(), horizonDays = 60 } = opts || {};
    const stamp = nowStamp();
    const veventLines = [];

    for (const todo of todos) {
      if (todo.completed || todo.archivedAt) continue;
      const hasRecurrence = todo.recurrence && todo.recurrence !== 'none';

      if (hasRecurrence) {
        const dates = occurrencesInHorizon(todo, horizonDays, today);
        dates.forEach((dateKey, idx) => {
          veventLines.push(...buildVEvent(todo, dateKey, `${todo.id}-occ${idx}@dactyl`, stamp));
        });
      } else if (todo.dueDate) {
        veventLines.push(...buildVEvent(todo, todo.dueDate, `${todo.id}@dactyl`, stamp));
      }
    }

    const calLines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Dactyl sandbox//Calendar export//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      ...veventLines,
      'END:VCALENDAR',
    ];

    return calLines.map(foldLine).join('\r\n') + '\r\n';
  }

  return { generateIcs };
}));
