/* global module, window */
(function registerDueNudges(globalScope) {
  function isValidDateKey(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
  }

  function addDaysToDateKey(dateKey, days) {
    if (!isValidDateKey(dateKey)) throw new Error(`Invalid date key: ${dateKey}`);
    const [year, month, day] = dateKey.split('-').map(Number);
    const date = new Date(year, month - 1, day + days);
    const nextMonth = String(date.getMonth() + 1).padStart(2, '0');
    const nextDay = String(date.getDate()).padStart(2, '0');
    return `${date.getFullYear()}-${nextMonth}-${nextDay}`;
  }

  function nextDueDate(currentDueDate, days, todayKey) {
    const baseDate = isValidDateKey(currentDueDate) ? currentDueDate : todayKey;
    return addDaysToDateKey(baseDate, days);
  }

  function defaultDueDate(todayKey) {
    return addDaysToDateKey(todayKey, 1);
  }

  const api = {
    addDaysToDateKey,
    defaultDueDate,
    nextDueDate,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  globalScope.DactylDueNudges = api;
})(typeof window !== 'undefined' ? window : globalThis);
