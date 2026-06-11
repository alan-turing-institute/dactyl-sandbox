const {
  clampTriageIndex,
  nextPriority,
  nextTriageIndex,
  triageCandidates,
} = require('../triage-mode');

describe('keyboard triage mode helpers', () => {
  test('selects only active, unarchived tasks for triage', () => {
    const todos = [
      { id: 'active', completed: false, archivedAt: '' },
      { id: 'done', completed: true, archivedAt: '' },
      { id: 'reef', completed: true, archivedAt: '2026-06-11T00:00:00.000Z' },
    ];

    expect(triageCandidates(todos).map((todo) => todo.id)).toEqual(['active']);
  });

  test('wraps triage navigation without leaving bounds', () => {
    expect(nextTriageIndex(0, 3, 1)).toBe(1);
    expect(nextTriageIndex(2, 3, 1)).toBe(0);
    expect(nextTriageIndex(0, 3, -1)).toBe(2);
    expect(clampTriageIndex(5, 3)).toBe(2);
    expect(nextTriageIndex(0, 0, 1)).toBe(0);
  });

  test('cycles priorities for keyboard triage actions', () => {
    expect(nextPriority('low')).toBe('medium');
    expect(nextPriority('medium')).toBe('high');
    expect(nextPriority('high')).toBe('low');
    expect(nextPriority('high', -1)).toBe('medium');
  });
});
