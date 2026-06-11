/* global module, window */
(function dailyCatchModule(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.DactylDailyCatch = api;
}(typeof window !== 'undefined' ? window : globalThis, () => {
  const DEFAULT_DAILY_CATCH_LIMIT = 5;

  function priorityScore(priority) {
    return { high: 30, medium: 15, low: 5 }[priority] ?? 15;
  }

  function dueScore(dueDate, today) {
    if (!dueDate) return 0;
    if (dueDate < today) return 60;
    if (dueDate === today) return 45;
    return 0;
  }

  function activeCatchTodos(todos) {
    return Array.isArray(todos)
      ? todos.filter((todo) => todo && !todo.completed && !todo.archivedAt)
      : [];
  }

  function catchScore(todo, { today, focusedTodoId = '' } = {}) {
    return dueScore(todo.dueDate, today) + priorityScore(todo.priority) + (todo.id === focusedTodoId ? 25 : 0);
  }

  function selectDailyCatchSuggestions(todos, options = {}) {
    const today = options.today || new Date().toISOString().slice(0, 10);
    const pinnedIds = new Set(options.pinnedIds || []);
    const limit = Math.max(1, Math.min(options.limit || DEFAULT_DAILY_CATCH_LIMIT, DEFAULT_DAILY_CATCH_LIMIT));
    return activeCatchTodos(todos)
      .filter((todo) => !pinnedIds.has(todo.id))
      .map((todo) => ({ todo, score: catchScore(todo, { today, focusedTodoId: options.focusedTodoId }) }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        if ((a.todo.dueDate || '9999-12-31') !== (b.todo.dueDate || '9999-12-31')) {
          return (a.todo.dueDate || '9999-12-31').localeCompare(b.todo.dueDate || '9999-12-31');
        }
        return a.todo.text.localeCompare(b.todo.text);
      })
      .slice(0, limit)
      .map(({ todo }) => todo);
  }

  return {
    DEFAULT_DAILY_CATCH_LIMIT,
    activeCatchTodos,
    catchScore,
    selectDailyCatchSuggestions,
  };
}));
