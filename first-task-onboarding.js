/* global module, window */
(function firstTaskOnboardingModule(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.DactylFirstTaskOnboarding = api;
}(typeof window !== 'undefined' ? window : globalThis, () => {
  const FIRST_TASK_TEMPLATES = Object.freeze([
    Object.freeze({
      id: 'today',
      text: 'Choose one small win for today',
      priority: 'medium',
    }),
    Object.freeze({
      id: 'plan',
      text: 'Write the next three steps for this project',
      priority: 'high',
    }),
    Object.freeze({
      id: 'follow-up',
      text: 'Send one useful follow-up before the day ends',
      priority: 'low',
    }),
  ]);

  function templateForId(templateId) {
    return FIRST_TASK_TEMPLATES.find((template) => template.id === templateId) || null;
  }

  function isGuidedEmptyPond({ dismissed, filter, hasActiveSearchFilter, liveCount }) {
    const guidedFilters = ['all', 'active'];
    return !dismissed
      && !hasActiveSearchFilter
      && guidedFilters.includes(filter)
      && liveCount === 0;
  }

  function shouldShowFirstTaskOnboarding({ dismissed, filter, hasActiveSearchFilter, liveCount, visibleCount }) {
    return isGuidedEmptyPond({ dismissed, filter, hasActiveSearchFilter, liveCount })
      && visibleCount === 0;
  }

  function shouldUseNewUserOnboardingMode({ signedIn, dismissed, filter, hasActiveSearchFilter, liveCount }) {
    return Boolean(signedIn)
      && isGuidedEmptyPond({ dismissed, filter, hasActiveSearchFilter, liveCount });
  }

  function shouldCelebrateFirstCompletion({ alreadyCelebrated, previousCompletedCount, nextCompletedCount }) {
    return !alreadyCelebrated && previousCompletedCount === 0 && nextCompletedCount === 1;
  }

  return {
    FIRST_TASK_TEMPLATES,
    shouldCelebrateFirstCompletion,
    shouldShowFirstTaskOnboarding,
    shouldUseNewUserOnboardingMode,
    templateForId,
  };
}));
