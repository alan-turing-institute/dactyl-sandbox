const { normaliseRecurrence, recurrenceLabel, nextRecurrenceDate } = require('../recurrence');

describe('recurrence helpers', () => {
  test('normalises supported recurrence values', () => {
    expect(normaliseRecurrence('daily')).toBe('daily');
    expect(normaliseRecurrence('weekly')).toBe('weekly');
    expect(normaliseRecurrence('monthly')).toBe('monthly');
    expect(normaliseRecurrence('yearly')).toBe('none');
  });

  test('labels recurring tasks accessibly', () => {
    expect(recurrenceLabel('weekly')).toBe('Repeats weekly');
    expect(recurrenceLabel('none')).toBe('');
  });

  test('computes next recurrence dates', () => {
    expect(nextRecurrenceDate('2026-06-11', 'daily')).toBe('2026-06-12');
    expect(nextRecurrenceDate('2026-06-11', 'weekly')).toBe('2026-06-18');
    expect(nextRecurrenceDate('2026-06-11', 'monthly')).toBe('2026-07-11');
    expect(nextRecurrenceDate('', 'weekly', '2026-06-11')).toBe('2026-06-18');
    expect(nextRecurrenceDate('2026-06-11', 'none')).toBe('');
  });
});
