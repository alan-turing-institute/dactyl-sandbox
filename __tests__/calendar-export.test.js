const { generateIcs } = require('../calendar-export');

const TODAY = '2026-06-15';

// RFC 5545 §3.1 — strip CRLF + leading-space continuation markers before asserting on field values.
function unfold(ics) { return ics.replace(/\r\n /g, ''); }

const baseTodo = {
  id: 'todo-1',
  text: 'Test task',
  completed: false,
  archivedAt: '',
  dueDate: '2026-07-01',
  priority: 'medium',
  recurrence: 'none',
  githubUrl: '',
};

describe('generateIcs', () => {
  test('returns valid VCALENDAR wrapper for empty input', () => {
    const ics = generateIcs([], { today: TODAY });
    expect(ics).toMatch(/^BEGIN:VCALENDAR\r\n/);
    expect(ics).toContain('VERSION:2.0\r\n');
    expect(ics).toContain('PRODID:-//Dactyl sandbox//Calendar export//EN\r\n');
    expect(ics).toMatch(/END:VCALENDAR\r\n$/);
    expect(ics).not.toContain('BEGIN:VEVENT');
  });

  test('includes active task with due date', () => {
    const ics = generateIcs([baseTodo], { today: TODAY });
    expect(ics).toContain('BEGIN:VEVENT\r\n');
    expect(ics).toContain('DTSTART;VALUE=DATE:20260701\r\n');
    expect(ics).toContain('DTEND;VALUE=DATE:20260702\r\n');
    expect(ics).toContain('SUMMARY:Test task\r\n');
    expect(ics).toContain('UID:todo-1@dactyl\r\n');
    expect(ics).toContain('END:VEVENT\r\n');
  });

  test('excludes completed tasks', () => {
    const ics = generateIcs([{ ...baseTodo, completed: true }], { today: TODAY });
    expect(ics).not.toContain('BEGIN:VEVENT');
  });

  test('excludes archived tasks', () => {
    const ics = generateIcs([{ ...baseTodo, archivedAt: '2026-06-01T00:00:00.000Z' }], { today: TODAY });
    expect(ics).not.toContain('BEGIN:VEVENT');
  });

  test('excludes tasks with no due date and no recurrence', () => {
    const ics = generateIcs([{ ...baseTodo, dueDate: '' }], { today: TODAY });
    expect(ics).not.toContain('BEGIN:VEVENT');
  });

  test('DTEND is one day after DTSTART', () => {
    const ics = generateIcs([{ ...baseTodo, dueDate: '2026-12-31' }], { today: TODAY });
    expect(ics).toContain('DTSTART;VALUE=DATE:20261231\r\n');
    expect(ics).toContain('DTEND;VALUE=DATE:20270101\r\n');
  });

  test('escapes backslash, semicolon, comma, and newline in task text', () => {
    const todo = { ...baseTodo, text: 'A\\B;C,D\nE' };
    const ics = generateIcs([todo], { today: TODAY });
    expect(ics).toContain('SUMMARY:A\\\\B\\;C\\,D\\nE\r\n');
  });

  test('folds SUMMARY lines longer than 75 characters', () => {
    const todo = { ...baseTodo, text: 'A'.repeat(80) };
    const ics = generateIcs([todo], { today: TODAY });
    ics.split('\r\n').forEach((line) => {
      expect(line.length).toBeLessThanOrEqual(75);
    });
  });

  test('uses CRLF line endings throughout', () => {
    const ics = generateIcs([baseTodo], { today: TODAY });
    // Strip all CRLFs — no bare LFs should remain
    expect(ics.replace(/\r\n/g, '')).not.toContain('\n');
    expect(ics.replace(/\r\n/g, '')).not.toContain('\r');
  });

  test('includes github URL in DESCRIPTION when present', () => {
    const todo = { ...baseTodo, githubUrl: 'https://github.com/owner/repo/issues/1' };
    const ics = generateIcs([todo], { today: TODAY });
    expect(unfold(ics)).toContain('GitHub: https://github.com/owner/repo/issues/1');
  });

  test('includes recurrence label in DESCRIPTION', () => {
    const todo = { ...baseTodo, dueDate: '2026-07-01', recurrence: 'weekly' };
    const ics = generateIcs([todo], { today: TODAY });
    expect(unfold(ics)).toContain('Repeats: weekly');
  });

  test('generates daily occurrences within the horizon', () => {
    const todo = { ...baseTodo, dueDate: TODAY, recurrence: 'daily' };
    const ics = generateIcs([todo], { today: TODAY, horizonDays: 6 });
    // today=2026-06-15, horizon=2026-06-21 → 7 occurrences (Jun 15–21 inclusive)
    const count = (ics.match(/BEGIN:VEVENT/g) || []).length;
    expect(count).toBe(7);
    expect(ics).toContain('DTSTART;VALUE=DATE:20260615\r\n');
    expect(ics).toContain('DTSTART;VALUE=DATE:20260621\r\n');
  });

  test('generates weekly occurrences within the horizon', () => {
    const todo = { ...baseTodo, dueDate: TODAY, recurrence: 'weekly' };
    const ics = generateIcs([todo], { today: TODAY, horizonDays: 21 });
    // today=2026-06-15, horizon=2026-07-06 → Jun 15, 22, 29, Jul 6 = 4 occurrences
    const count = (ics.match(/BEGIN:VEVENT/g) || []).length;
    expect(count).toBe(4);
  });

  test('advances past-due recurring start to first future occurrence', () => {
    // dueDate is 3 days before today (weekly)
    const todo = { ...baseTodo, dueDate: '2026-06-12', recurrence: 'weekly' };
    const ics = generateIcs([todo], { today: TODAY, horizonDays: 21 });
    // 2026-06-12 < 2026-06-15 → advance to 2026-06-19 (next weekly)
    // horizon = 2026-07-06 → Jun 19, 26, Jul 3 = 3 occurrences
    expect(ics).not.toContain('DTSTART;VALUE=DATE:20260612');
    expect(ics).toContain('DTSTART;VALUE=DATE:20260619\r\n');
    const count = (ics.match(/BEGIN:VEVENT/g) || []).length;
    expect(count).toBe(3);
  });

  test('recurring task without due date starts from today', () => {
    const todo = { ...baseTodo, dueDate: '', recurrence: 'weekly' };
    const ics = generateIcs([todo], { today: TODAY, horizonDays: 7 });
    // no due date → start from today (2026-06-15)
    // horizon = 2026-06-22 → Jun 15, 22 = 2 occurrences
    expect(ics).toContain('DTSTART;VALUE=DATE:20260615\r\n');
    const count = (ics.match(/BEGIN:VEVENT/g) || []).length;
    expect(count).toBe(2);
  });

  test('each occurrence gets a distinct UID', () => {
    const todo = { ...baseTodo, dueDate: TODAY, recurrence: 'weekly' };
    const ics = generateIcs([todo], { today: TODAY, horizonDays: 7 });
    expect(ics).toContain('UID:todo-1-occ0@dactyl\r\n');
    expect(ics).toContain('UID:todo-1-occ1@dactyl\r\n');
  });

  test('DTSTAMP is present and matches UTC timestamp format', () => {
    const ics = generateIcs([baseTodo], { today: TODAY });
    expect(ics).toMatch(/DTSTAMP:\d{8}T\d{6}Z\r\n/);
  });

  test('multiple todos produce multiple VEVENTs', () => {
    const t1 = { ...baseTodo, id: 't1', dueDate: '2026-07-01' };
    const t2 = { ...baseTodo, id: 't2', dueDate: '2026-07-15' };
    const ics = generateIcs([t1, t2], { today: TODAY });
    const count = (ics.match(/BEGIN:VEVENT/g) || []).length;
    expect(count).toBe(2);
  });
});
