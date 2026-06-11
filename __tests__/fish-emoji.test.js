const { FISH_EMOJI_POOLS, fishEmojiFor, stableIndex } = require('../fish-emoji');

describe('fish emoji support', () => {
  test('exposes multiple fishy emoji choices for task mood badges', () => {
    expect(FISH_EMOJI_POOLS.normal).toEqual(expect.arrayContaining(['🐟', '🐠']));
    expect(FISH_EMOJI_POOLS.high).toEqual(expect.arrayContaining(['🐡', '🦈']));
    expect(Object.values(FISH_EMOJI_POOLS).flat().length).toBeGreaterThan(12);
  });

  test('selects emoji deterministically so tasks do not flicker between renders', () => {
    expect(fishEmojiFor('normal', 'task-a')).toBe(fishEmojiFor('normal', 'task-a'));
    expect(stableIndex('task-a', FISH_EMOJI_POOLS.normal.length)).toBeGreaterThanOrEqual(0);
  });

  test('falls back to the normal pool for unknown mood pools', () => {
    expect(FISH_EMOJI_POOLS.normal).toContain(fishEmojiFor('unknown', 'task-a'));
  });
});
