const {
  DEFAULT_POND_VIEW,
  desiredPondView,
  normalisePondView,
  viewButtonState,
} = require('../view-state');

describe('pond top-level view state', () => {
  test('normalises supported pond views and rejects unknown views', () => {
    expect(normalisePondView('home')).toBe('home');
    expect(normalisePondView('tasks')).toBe('tasks');
    expect(normalisePondView('tools')).toBe('tools');
    expect(normalisePondView('settings')).toBe('settings');
    expect(normalisePondView('focus')).toBe('');
    expect(normalisePondView('')).toBe('');
  });

  test('falls back to Home when requested view is missing or unknown', () => {
    expect(DEFAULT_POND_VIEW).toBe('home');
    expect(desiredPondView('tasks')).toBe('tasks');
    expect(desiredPondView('missing')).toBe('home');
    expect(desiredPondView('', 'tools')).toBe('tools');
    expect(desiredPondView('', 'missing')).toBe('home');
  });

  test('exposes accessible active state for nav buttons', () => {
    expect(viewButtonState('tasks', 'tasks')).toEqual({
      active: true,
      ariaCurrent: 'page',
      ariaPressed: 'true',
    });
    expect(viewButtonState('tools', 'tasks')).toEqual({
      active: false,
      ariaCurrent: '',
      ariaPressed: 'false',
    });
  });
});
