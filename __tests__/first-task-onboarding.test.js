const {
  FIRST_TASK_TEMPLATES,
  shouldCelebrateFirstCompletion,
  shouldShowFirstTaskOnboarding,
  templateForId,
} = require('../first-task-onboarding');

describe('first task onboarding', () => {
  test('exposes stable starter task templates', () => {
    expect(FIRST_TASK_TEMPLATES).toHaveLength(3);
    expect(templateForId('plan')).toEqual({
      id: 'plan',
      text: 'Write the next three steps for this project',
      priority: 'high',
    });
    expect(templateForId('missing')).toBeNull();
  });

  test('shows onboarding only for genuinely empty active ponds', () => {
    expect(shouldShowFirstTaskOnboarding({
      dismissed: false,
      filter: 'all',
      hasActiveSearchFilter: false,
      liveCount: 0,
      visibleCount: 0,
    })).toBe(true);

    expect(shouldShowFirstTaskOnboarding({
      dismissed: true,
      filter: 'all',
      hasActiveSearchFilter: false,
      liveCount: 0,
      visibleCount: 0,
    })).toBe(false);

    expect(shouldShowFirstTaskOnboarding({
      dismissed: false,
      filter: 'archive',
      hasActiveSearchFilter: false,
      liveCount: 0,
      visibleCount: 0,
    })).toBe(false);

    expect(shouldShowFirstTaskOnboarding({
      dismissed: false,
      filter: 'all',
      hasActiveSearchFilter: true,
      liveCount: 0,
      visibleCount: 0,
    })).toBe(false);

    expect(shouldShowFirstTaskOnboarding({
      dismissed: false,
      filter: 'all',
      hasActiveSearchFilter: false,
      liveCount: 1,
      visibleCount: 1,
    })).toBe(false);
  });

  test('celebrates only the first transition to one completed task', () => {
    expect(shouldCelebrateFirstCompletion({
      alreadyCelebrated: false,
      previousCompletedCount: 0,
      nextCompletedCount: 1,
    })).toBe(true);

    expect(shouldCelebrateFirstCompletion({
      alreadyCelebrated: true,
      previousCompletedCount: 0,
      nextCompletedCount: 1,
    })).toBe(false);

    expect(shouldCelebrateFirstCompletion({
      alreadyCelebrated: false,
      previousCompletedCount: 1,
      nextCompletedCount: 2,
    })).toBe(false);
  });
});
