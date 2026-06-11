/* global module, window */
(function screenStateModule(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.DactylScreenState = api;
}(typeof window !== 'undefined' ? window : globalThis, () => {
  const SCREEN_KEYS = ['auth', 'pond', 'focus'];

  function normaliseScreenKey(screenKey) {
    return SCREEN_KEYS.includes(screenKey) ? screenKey : '';
  }

  function screenKeyFromHash(hash = '') {
    return normaliseScreenKey(String(hash).replace(/^#/, ''));
  }

  function desiredScreenKey({ signedIn, requestedScreen, hasFocusedTodo }) {
    if (!signedIn) return 'auth';
    if (normaliseScreenKey(requestedScreen) === 'focus' && hasFocusedTodo) return 'focus';
    return 'pond';
  }

  return { SCREEN_KEYS, normaliseScreenKey, screenKeyFromHash, desiredScreenKey };
}));
