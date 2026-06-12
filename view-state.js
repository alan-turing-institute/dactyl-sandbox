/* global module, window */
(function viewStateModule(root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.DactylViewState = api;
}(typeof window !== 'undefined' ? window : globalThis, () => {
  const POND_VIEW_KEYS = ['home', 'tasks', 'tools', 'settings'];
  const DEFAULT_POND_VIEW = 'home';

  function normalisePondView(viewKey) {
    return POND_VIEW_KEYS.includes(viewKey) ? viewKey : '';
  }

  function desiredPondView(viewKey, fallback = DEFAULT_POND_VIEW) {
    return normalisePondView(viewKey) || normalisePondView(fallback) || DEFAULT_POND_VIEW;
  }

  function viewButtonState(viewKey, activeView) {
    const normalised = normalisePondView(viewKey);
    const active = normalised !== '' && normalised === desiredPondView(activeView);
    return {
      active,
      ariaCurrent: active ? 'page' : '',
      ariaPressed: String(active),
    };
  }

  return { DEFAULT_POND_VIEW, POND_VIEW_KEYS, desiredPondView, normalisePondView, viewButtonState };
}));
