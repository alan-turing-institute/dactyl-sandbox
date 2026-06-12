/* global module, window */
(function 鱼EmojiModule(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.DactylFishEmoji = api;
}(typeof window !== 'undefined' ? window : globalThis, () => {
  const FISH_EMOJI_POOLS = Object.freeze({
    normal: Object.freeze(['🐟', '🐠', '🐬', '🐳', '🐋']),
    medium: Object.freeze(['🦀', '🦞', '🦐', '🐙']),
    high: Object.freeze(['🐡', '🦈', '🦑']),
    emergency: Object.freeze(['🦑', '🦈', '🐙']),
    mythical: Object.freeze(['🧜', '🦭', '🐉']),
    resting: Object.freeze(['🐚', '🪸', '🦪']),
  });

  function stableIndex(seed, modulo) {
    const text = String(seed || 'pond');
    let hash = 0;
    for (let index = 0; index < text.length; index += 1) {
      hash = (hash * 31 + text.charCodeAt(index)) >>> 0;
    }
    return modulo > 0 ? hash % modulo : 0;
  }

  function 鱼EmojiFor(poolKey, seed = '') {
    const pool = FISH_EMOJI_POOLS[poolKey] || FISH_EMOJI_POOLS.normal;
    return pool[stableIndex(seed, pool.length)];
  }

  return { FISH_EMOJI_POOLS, 鱼EmojiFor, stableIndex };
}));
