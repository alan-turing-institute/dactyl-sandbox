const { PREMIUM_HOOKS, premiumHookForSurface, premiumHookIds } = require('../premium-hooks');

describe('premium conversion hooks', () => {
  test('keeps hooks centralised and non-blocking in copy', () => {
    expect(PREMIUM_HOOKS).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'team-sharing', surface: 'sharing' }),
      expect.objectContaining({ id: 'advanced-reminders', surface: 'reminders' }),
      expect.objectContaining({ id: 'history-analytics', surface: 'insights' }),
    ]));
    expect(PREMIUM_HOOKS.every((hook) => /could add|stays usable|stays free/i.test(hook.body))).toBe(true);
  });

  test('looks up hooks by surface and exposes stable ids', () => {
    expect(premiumHookForSurface('sharing')).toMatchObject({ id: 'team-sharing' });
    expect(premiumHookForSurface('missing')).toBeNull();
    expect(premiumHookIds()).toEqual(['team-sharing', 'advanced-reminders', 'history-analytics']);
  });
});
