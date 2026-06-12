/* global module, window */
(function contextualEmptyStatesModule(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.DactylContextualEmptyStates = api;
}(typeof window !== 'undefined' ? window : globalThis, () => {
  function searchEmptyState(searchQuery) {
    const query = String(searchQuery || '').trim();
    if (!query) return null;
    return {
      heading: `No tasks match “${query}”.`,
      description: 'Try a different search, or clear it to bring the 鱼 back into view.',
      cta: { label: 'Clear search', action: 'clear-search' },
    };
  }

  function contextualEmptyState({ filter = 'all', searchQuery = '', quickFilter = '', showFirstTaskGuide = false } = {}) {
    const search = searchEmptyState(searchQuery);
    if (search) return search;
    if (quickFilter) {
      return {
        heading: 'No 鱼 match these filters.',
        description: 'Clear the quick filter to see more 鱼 in this view.',
        cta: { label: 'Clear filter', action: 'clear-filter' },
      };
    }

    if (filter === 'active') {
      return {
        heading: 'No active tasks.',
        description: 'Everything is complete or archived. Enjoy the calm pond, or review what you already fed.',
        cta: { label: 'Switch to Completed', action: 'show-completed' },
      };
    }
    if (filter === 'completed') {
      return {
        heading: 'Nothing completed yet.',
        description: 'Go catch some 鱼, then come back here to admire the fed shoal.',
        cta: { label: 'Switch to Active', action: 'show-active' },
      };
    }
    if (filter === 'archive') {
      return {
        heading: 'No 鱼 in the reef archive.',
        description: 'Archive completed 鱼 to tidy the active pond without permanently deleting them.',
        cta: null,
      };
    }
    if (filter === 'tide') {
      return {
        heading: 'No overdue or high-priority tasks.',
        description: 'The pond is calm. Add due dates or high-priority 鱼 when the tide changes.',
        cta: null,
      };
    }
    if (filter === 'ghost') {
      return {
        heading: 'No stale tasks.',
        description: 'Your pond is healthy: no overdue, drifting, or neglected high-priority 鱼 found.',
        cta: null,
      };
    }
    if (filter === 'week') {
      return {
        heading: 'Clear waters ahead.',
        description: 'No active due-date tasks in the next seven days. Add due dates to plan the pond.',
        cta: null,
      };
    }

    return {
      heading: 'Your pond is empty.',
      description: showFirstTaskGuide
        ? 'Add your first task above, or pick a starter 鱼 below.'
        : 'Add your first task above, or open Getting started for demo 鱼 and a quick pond tour.',
      cta: null,
    };
  }

  function dailyCatchEmptyState() {
    return {
      heading: 'Pin some tasks to build today’s catch.',
      description: 'Add tasks with a due date or switch back to the pond to choose a few 鱼 for today.',
      cta: { label: 'Switch to All', action: 'show-all' },
    };
  }

  return {
    contextualEmptyState,
    dailyCatchEmptyState,
  };
}));
