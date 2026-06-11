/* global module, window */
(function quickAddModule(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.DactylQuickAdd = api;
}(typeof window !== 'undefined' ? window : globalThis, () => {
  const PRIORITY_WORDS = new Map([
    ['low', 'low'],
    ['medium', 'medium'],
    ['high', 'high'],
    ['low tide', 'low'],
    ['medium tide', 'medium'],
    ['high tide', 'high'],
  ]);
  const WEEKDAYS = new Map([
    ['sunday', 0],
    ['monday', 1],
    ['tuesday', 2],
    ['wednesday', 3],
    ['thursday', 4],
    ['friday', 5],
    ['saturday', 6],
  ]);

  function pad(value) {
    return String(value).padStart(2, '0');
  }

  function dateKey(date) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  function addDays(date, days) {
    const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    next.setDate(next.getDate() + days);
    return next;
  }

  function nextWeekday(baseDate, targetDay) {
    const distance = (targetDay - baseDate.getDay() + 7) % 7 || 7;
    return addDays(baseDate, distance);
  }

  function parseBaseDate(value) {
    if (!value) return new Date();
    if (value instanceof Date) return new Date(value.getFullYear(), value.getMonth(), value.getDate());
    const [year, month, day] = String(value).split('-').map(Number);
    if (year && month && day) return new Date(year, month - 1, day);
    return new Date();
  }

  function parseQuickAdd(rawText, options = {}) {
    let text = String(rawText || '').trim();
    const baseDate = parseBaseDate(options.today);
    const result = { text, dueDate: '', priority: '' };

    for (const [phrase, priority] of [...PRIORITY_WORDS.entries()].sort((a, b) => b[0].length - a[0].length)) {
      const pattern = new RegExp(`(?:^|\\s)${phrase.replace(' ', '\\s+')}(?=\\s|$)`, 'i');
      if (pattern.test(text)) {
        result.priority = priority;
        text = text.replace(pattern, ' ');
        break;
      }
    }

    const isoMatch = text.match(/(?:^|\s)(?:due:)?(\d{4}-\d{2}-\d{2})(?=\s|$)/i);
    if (isoMatch) {
      result.dueDate = isoMatch[1];
      text = text.replace(isoMatch[0], ' ');
    } else {
      const phraseChecks = [
        [/\bnext\s+week\b/i, () => addDays(baseDate, 7)],
        [/\btomorrow\b/i, () => addDays(baseDate, 1)],
        [/\btoday\b/i, () => baseDate],
      ];
      for (const [pattern, getDate] of phraseChecks) {
        if (pattern.test(text)) {
          result.dueDate = dateKey(getDate());
          text = text.replace(pattern, ' ');
          break;
        }
      }

      if (!result.dueDate) {
        for (const [weekday, day] of WEEKDAYS) {
          const pattern = new RegExp(`\\bnext\\s+${weekday}\\b`, 'i');
          if (pattern.test(text)) {
            result.dueDate = dateKey(nextWeekday(baseDate, day));
            text = text.replace(pattern, ' ');
            break;
          }
        }
      }
    }

    result.text = text.trim().replace(/\s+/g, ' ');
    return result;
  }

  return { parseQuickAdd, dateKey, nextWeekday };
}));
