/* global module, window */
(function premiumHooksModule(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.DactylPremiumHooks = api;
}(typeof window !== 'undefined' ? window : globalThis, () => {
  const PREMIUM_HOOKS = Object.freeze([
    {
      id: 'team-sharing',
      surface: 'sharing',
      title: 'Team ponds without the undertow',
      body: 'Premium could add shared workspaces, richer exports, and team history later. Your current sharing stays free.',
    },
    {
      id: 'advanced-reminders',
      surface: 'reminders',
      title: 'Sharper tide alerts',
      body: 'Premium could add recurring reminders and notification rules later. Today’s reminders stay usable.',
    },
    {
      id: 'history-analytics',
      surface: 'insights',
      title: 'Longer pond memory',
      body: 'Premium could add activity history and analytics later, without tracking private task text.',
    },
  ]);

  function premiumHookForSurface(surface) {
    return PREMIUM_HOOKS.find((hook) => hook.surface === surface) || null;
  }

  function premiumHookIds() {
    return PREMIUM_HOOKS.map((hook) => hook.id);
  }

  return {
    PREMIUM_HOOKS,
    premiumHookForSurface,
    premiumHookIds,
  };
}));
