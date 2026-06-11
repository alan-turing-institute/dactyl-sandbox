/* global module, window */
(function premiumModule(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.DactylPremium = api;
}(typeof window !== 'undefined' ? window : globalThis, () => {
  const PREMIUM_FEATURES = Object.freeze({
    export: Object.freeze({
      id: 'export',
      label: 'Export pond',
      description: 'Pro includes scheduled exports and multiple formats (CSV, JSON, Markdown).',
    }),
    sharing: Object.freeze({
      id: 'sharing',
      label: 'Pond sharing',
      description: 'Pro lets you share read-only pond links with your team, with custom expiry.',
    }),
    advancedReminders: Object.freeze({
      id: 'advancedReminders',
      label: 'Advanced reminders',
      description: 'Pro unlocks recurring reminders and calendar integrations.',
    }),
    analytics: Object.freeze({
      id: 'analytics',
      label: 'Deeper analytics',
      description: 'Pro surfaces velocity trends, completion streaks, and focus-time breakdowns.',
    }),
  });

  const STORAGE_PREFIX = 'dactyl.premiumDismissed.';

  function isDismissed(featureId) {
    try {
      return Boolean(
        typeof localStorage !== 'undefined' &&
        localStorage.getItem(STORAGE_PREFIX + featureId)
      );
    } catch (_) {
      return false;
    }
  }

  function dismiss(featureId) {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_PREFIX + featureId, '1');
      }
    } catch (_) {
      // silently ignore storage errors
    }
  }

  function createCallout(featureId) {
    if (isDismissed(featureId)) return null;

    const feature = PREMIUM_FEATURES[featureId];
    if (!feature) return null;

    const aside = document.createElement('aside');
    aside.className = 'premium-callout';
    aside.dataset.premiumFeature = featureId;

    const badge = document.createElement('span');
    badge.className = 'premium-badge';
    badge.textContent = 'Pro';

    const desc = document.createElement('span');
    desc.className = 'premium-description';
    desc.textContent = feature.description;

    const dismissBtn = document.createElement('button');
    dismissBtn.className = 'premium-dismiss';
    dismissBtn.type = 'button';
    dismissBtn.setAttribute('aria-label', 'Dismiss upgrade hint');
    dismissBtn.textContent = '×';

    dismissBtn.addEventListener('click', () => {
      dismiss(featureId);
      aside.remove();
    });

    aside.append(badge, desc, dismissBtn);
    return aside;
  }

  return { PREMIUM_FEATURES, createCallout, isDismissed, dismiss };
}));
