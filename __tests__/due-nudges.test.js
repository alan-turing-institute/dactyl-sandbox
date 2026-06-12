const { defaultDueDate, nextDueDate } = require('../due-nudges');

describe('due-date nudges', () => {
  test('nudges due dates across month boundaries', () => {
    expect(nextDueDate('2026-01-31', 1, '2026-01-10')).toBe('2026-02-01');
    expect(nextDueDate('2026-03-01', -1, '2026-01-10')).toBe('2026-02-28');
  });

  test('nudges due dates across year boundaries', () => {
    expect(nextDueDate('2026-12-31', 1, '2026-01-10')).toBe('2027-01-01');
    expect(nextDueDate('2027-01-01', -7, '2026-01-10')).toBe('2026-12-25');
  });

  test('uses today as the base when the task has no due date', () => {
    expect(nextDueDate('', 7, '2026-06-11')).toBe('2026-06-18');
  });

  test('defaults no-due-date tasks to tomorrow', () => {
    expect(defaultDueDate('2026-06-11')).toBe('2026-06-12');
  });
});
