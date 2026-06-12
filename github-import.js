/* global module, window */
(function githubImportModule(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.GithubImport = api;
}(typeof window !== 'undefined' ? window : globalThis, () => {

  function normaliseGithubUrl(value) {
    if (!value) return '';
    let parsed;
    try { parsed = new URL(value.trim()); } catch { return ''; }
    const [owner, repo, type, number] = parsed.pathname.split('/').filter(Boolean);
    const valid = owner && repo && ['issues', 'pull'].includes(type) && /^[1-9]\d*$/.test(number);
    if (parsed.protocol !== 'https:' || parsed.hostname !== 'github.com' || !valid) return '';
    return `https://github.com/${owner}/${repo}/${type}/${number}`;
  }

  function parseImportUrls(text) {
    // extract all https://github.com/... URLs from pasted text
    const matches = String(text).match(/https:\/\/github\.com\/[^\s"'>)]+/g) || [];
    const seen = new Set();
    const results = [];
    for (const raw of matches) {
      const url = normaliseGithubUrl(raw);
      if (url && !seen.has(url)) { seen.add(url); results.push(url); }
    }
    return results;
  }

  function fallbackLabel(url) {
    try {
      const parts = new URL(url).pathname.split('/').filter(Boolean);
      const [owner, repo, type, number] = parts;
      return `${owner}/${repo} #${number} (${type === 'pull' ? 'PR' : 'issue'})`;
    } catch { return url; }
  }

  async function fetchTitle(url) {
    try {
      const parts = new URL(url).pathname.split('/').filter(Boolean);
      const [owner, repo, , number] = parts;
      const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues/${number}`, {
        headers: { Accept: 'application/vnd.github+json' },
      });
      if (!res.ok) return fallbackLabel(url);
      const data = await res.json();
      return typeof data.title === 'string' ? data.title : fallbackLabel(url);
    } catch { return fallbackLabel(url); }
  }

  async function buildPreviewItems(urls, existingGithubUrls) {
    const existingSet = new Set(existingGithubUrls);
    const items = await Promise.all(urls.map(async (url) => {
      const title = await fetchTitle(url);
      return { url, title, duplicate: existingSet.has(url) };
    }));
    return items;
  }

  return { parseImportUrls, buildPreviewItems, fallbackLabel, normaliseGithubUrl };
}));
