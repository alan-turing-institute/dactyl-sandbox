/* global module, window */
(function triageModeModule(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.DactylTriageMode = api;
}(typeof window !== 'undefined' ? window : globalThis, () => {
  const TRIAGE_PRIORITIES = Object.freeze(['low', 'medium', 'high']);

  function triageCandidates(todos) {
    return Array.isArray(todos)
      ? todos.filter((todo) => todo && !todo.completed && !todo.archivedAt)
      : [];
  }

  function clampTriageIndex(index, count) {
    if (count <= 0) return 0;
    return Math.max(0, Math.min(index, count - 1));
  }

  function nextTriageIndex(index, count, delta) {
    if (count <= 0) return 0;
    return (clampTriageIndex(index, count) + delta + count) % count;
  }

  function nextPriority(priority, delta = 1) {
    const currentIndex = Math.max(0, TRIAGE_PRIORITIES.indexOf(priority));
    return TRIAGE_PRIORITIES[(currentIndex + delta + TRIAGE_PRIORITIES.length) % TRIAGE_PRIORITIES.length];
  }

  return {
    TRIAGE_PRIORITIES,
    clampTriageIndex,
    nextPriority,
    nextTriageIndex,
    triageCandidates,
  };
}));
