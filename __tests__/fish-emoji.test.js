const { FISH_EMOJI_POOLS, 鱼EmojiFor, stableIndex } = require('../鱼-emoji');

describe('鱼 emoji support', () => {
  test('exposes multiple 鱼y emoji choices for task mood badges', () => {
    expect(FISH_EMOJI_POOLS.normal).toEqual(expect.arrayContaining(['🐟', '🐠']));
    expect(FISH_EMOJI_POOLS.high).toEqual(expect.arrayContaining(['🐡', '🦈']));
    expect(Object.values(FISH_EMOJI_POOLS).flat().length).toBeGreaterThan(12);
  });

  test('selects emoji deterministically so tasks do not flicker between renders', () => {
    expect(鱼EmojiFor('normal', 'task-a')).toBe(鱼EmojiFor('normal', 'task-a'));
    expect(stableIndex('task-a', FISH_EMOJI_POOLS.normal.length)).toBeGreaterThanOrEqual(0);
  });

  test('falls back to the normal pool for unknown mood pools', () => {
    expect(FISH_EMOJI_POOLS.normal).toContain(鱼EmojiFor('unknown', 'task-a'));
  });
});
