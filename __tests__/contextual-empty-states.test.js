const { contextualEmptyState, dailyCatchEmptyState } = require('../contextual-empty-states');

describe('contextual empty states', () => {
  test('returns distinct copy for named filters', () => {
    expect(contextualEmptyState({ filter: 'all' })).toMatchObject({
      heading: 'Your pond is empty.',
      cta: null,
    });
    expect(contextualEmptyState({ filter: 'active' })).toMatchObject({
      heading: 'No active tasks.',
      cta: { label: 'Switch to Completed', action: 'show-completed' },
    });
    expect(contextualEmptyState({ filter: 'completed' })).toMatchObject({
      heading: 'Nothing completed yet.',
      cta: { label: 'Switch to Active', action: 'show-active' },
    });
    expect(contextualEmptyState({ filter: 'tide' }).heading).toBe('No overdue or high-priority tasks.');
    expect(contextualEmptyState({ filter: 'ghost' }).heading).toBe('Nothing needs attention.');
  });

  test('search empty state includes the query and clear action', () => {
    expect(contextualEmptyState({ filter: 'active', searchQuery: 'reef logs' })).toMatchObject({
      heading: 'No tasks match “reef logs”.',
      cta: { label: 'Clear search', action: 'clear-search' },
    });
  });

  test('quick-filter empty state clears filters', () => {
    expect(contextualEmptyState({ filter: 'all', quickFilter: 'high' })).toMatchObject({
      heading: 'No fish match these filters.',
      cta: { label: 'Clear filter', action: 'clear-filter' },
    });
  });

  test('daily catch empty state points back to all tasks', () => {
    expect(dailyCatchEmptyState()).toMatchObject({
      heading: 'Pin some tasks to build today’s catch.',
      cta: { label: 'Switch to All', action: 'show-all' },
    });
  });
});
