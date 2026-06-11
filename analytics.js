/* global module, window */
(function analyticsModule(root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.DactylAnalytics = api;
}(typeof window !== 'undefined' ? window : globalThis, (root) => {
  const ALLOWED_EVENTS = Object.freeze([
    'signup',
    'login',
    'task_created',
    'task_completed',
    'focus_started',
    'focus_completed',
    'tour_opened',
    'export_created',
  ]);
  const ALLOWED_EVENT_SET = new Set(ALLOWED_EVENTS);
  const SENSITIVE_KEY_PATTERN = /(text|title|name|email|user|note|password|token|secret|url|link)/i;
  const SAFE_STRING_PATTERN = /^[a-z0-9_.:-]{0,64}$/i;
  const MAX_SAFE_KEYS = 16;

  function isAllowedAnalyticsEvent(eventName) {
    return ALLOWED_EVENT_SET.has(String(eventName || ''));
  }

  function safeScalar(value) {
    return typeof value === 'boolean'
      || (Number.isFinite(value) && Math.abs(value) <= 1000000)
      || (typeof value === 'string' && SAFE_STRING_PATTERN.test(value));
  }

  function sanitizeAnalyticsPayload(payload = {}) {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return {};
    return Object.entries(payload).slice(0, MAX_SAFE_KEYS).reduce((safe, [key, value]) => {
      const safeKey = String(key || '').trim();
      if (!safeKey || SENSITIVE_KEY_PATTERN.test(safeKey)) return safe;
      if (safeScalar(value)) safe[safeKey] = value;
      return safe;
    }, {});
  }

  function sanitizeAnalyticsEvent(eventName, payload = {}) {
    const name = String(eventName || '').trim();
    if (!isAllowedAnalyticsEvent(name)) return null;
    return {
      event: name,
      payload: sanitizeAnalyticsPayload(payload),
    };
  }

  function createAnalytics(options = {}) {
    const config = root?.DACTYL_ANALYTICS_CONFIG || {};
    const fetchImpl = options.fetchImpl || (root && root.fetch ? root.fetch.bind(root) : null);
    const endpoint = options.endpoint || config.endpoint || '/api/analytics';
    const enabled = options.enabled ?? (config.enabled === true);

    async function track(eventName, payload = {}) {
      const event = sanitizeAnalyticsEvent(eventName, payload);
      if (!event) return { sent: false, reason: 'invalid_event' };
      if (!enabled || !fetchImpl) return { sent: false, reason: 'disabled', event };

      try {
        await fetchImpl(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(event),
          keepalive: true,
        });
        return { sent: true, event };
      } catch {
        return { sent: false, reason: 'network_error', event };
      }
    }

    return { enabled, track };
  }

  return {
    ALLOWED_EVENTS,
    createAnalytics,
    isAllowedAnalyticsEvent,
    sanitizeAnalyticsEvent,
    sanitizeAnalyticsPayload,
  };
}));
