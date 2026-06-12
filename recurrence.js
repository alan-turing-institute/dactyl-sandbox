/* global module, window */
(function recurrenceModule(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.DactylRecurrence = api;
}(typeof window !== 'undefined' ? window : globalThis, () => {
  const RECURRENCE_OPTIONS = ['none', 'daily', 'weekly', 'monthly'];

  function normaliseRecurrence(value) {
    return RECURRENCE_OPTIONS.includes(value) ? value : 'none';
  }

  function recurrenceLabel(value) {
    return {
      daily: 'Migrates daily',
      weekly: 'Migrates weekly',
      monthly: 'Migrates monthly',
    }[normaliseRecurrence(value)] || '';
  }

  function dateKey(date) {
    return date.toISOString().slice(0, 10);
  }

  function parseDateKey(value, fallback = new Date()) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return fallback;
    const [year, month, day] = value.split('-').map(Number);
    const parsed = new Date(Date.UTC(year, month - 1, day));
    return Number.isNaN(parsed.getTime()) ? fallback : parsed;
  }

  function nextRecurrenceDate(dueDate, recurrence, today = dateKey(new Date())) {
    const normalised = normaliseRecurrence(recurrence);
    if (normalised === 'none') return '';

    const base = parseDateKey(dueDate || today, parseDateKey(today));
    if (normalised === 'daily') base.setUTCDate(base.getUTCDate() + 1);
    if (normalised === 'weekly') base.setUTCDate(base.getUTCDate() + 7);
    if (normalised === 'monthly') base.setUTCMonth(base.getUTCMonth() + 1);
    return dateKey(base);
  }

  return {
    RECURRENCE_OPTIONS,
    normaliseRecurrence,
    recurrenceLabel,
    nextRecurrenceDate,
  };
}));
