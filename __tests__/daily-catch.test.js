const { catchScore, selectDailyCatchSuggestions } = require('../daily-catch');

describe('Daily Catch planning helpers', () => {
  const today = '2026-06-11';

  test('scores overdue, due-today, high-priority, and focused tasks higher', () => {
    expect(catchScore({ id: 'overdue', dueDate: '2026-06-10', priority: 'low' }, { today })).toBeGreaterThan(
      catchScore({ id: 'later', dueDate: '2026-06-14', priority: 'medium' }, { today }),
    );
    expect(catchScore({ id: 'focus', dueDate: '', priority: 'low' }, { today, focusedTodoId: 'focus' })).toBeGreaterThan(
      catchScore({ id: 'low', dueDate: '', priority: 'low' }, { today }),
    );
  });

  test('suggests three to five active unpinned tasks in deterministic order', () => {
    const todos = [
      { id: 'done', text: 'Done', completed: true, dueDate: '2026-06-10', priority: 'high' },
      { id: 'pinned', text: 'Already pinned', completed: false, dueDate: '2026-06-10', priority: 'high' },
      { id: 'overdue', text: 'Overdue fish', completed: false, dueDate: '2026-06-10', priority: 'low' },
      { id: 'today', text: 'Today fish', completed: false, dueDate: '2026-06-11', priority: 'medium' },
      { id: 'high', text: 'High tide fish', completed: false, dueDate: '', priority: 'high' },
      { id: 'medium', text: 'Medium fish', completed: false, dueDate: '', priority: 'medium' },
      { id: 'low', text: 'Low fish', completed: false, dueDate: '', priority: 'low' },
      { id: 'archived', text: 'Old shell', completed: false, archivedAt: '2026-06-11T00:00:00.000Z', dueDate: '2026-06-10', priority: 'high' },
    ];

    expect(selectDailyCatchSuggestions(todos, { today, pinnedIds: ['pinned'], limit: 5 }).map((todo) => todo.id)).toEqual([
      'overdue',
      'today',
      'high',
      'medium',
      'low',
    ]);
  });
});
