const { parseImportUrls, fallbackLabel, normaliseGithubUrl } = require('../github-import');

describe('github import URL parsing', () => {
  test('parses valid issue URL', () => {
    const urls = parseImportUrls('https://github.com/owner/repo/issues/123');
    expect(urls).toEqual(['https://github.com/owner/repo/issues/123']);
  });

  test('parses valid PR URL', () => {
    const urls = parseImportUrls('https://github.com/owner/repo/pull/456');
    expect(urls).toEqual(['https://github.com/owner/repo/pull/456']);
  });

  test('ignores invalid URLs', () => {
    const urls = parseImportUrls('https://example.com/owner/repo/issues/1\nhttps://github.com/owner/repo\nnot-a-url');
    expect(urls).toEqual([]);
  });

  test('deduplicates same URL pasted twice', () => {
    const text = 'https://github.com/owner/repo/issues/123\nhttps://github.com/owner/repo/issues/123';
    const urls = parseImportUrls(text);
    expect(urls).toHaveLength(1);
    expect(urls[0]).toBe('https://github.com/owner/repo/issues/123');
  });

  test('parses from markdown bullet list', () => {
    const text = '- Fix the bug: https://github.com/org/project/issues/42\n- Review PR: https://github.com/org/project/pull/99';
    const urls = parseImportUrls(text);
    expect(urls).toEqual([
      'https://github.com/org/project/issues/42',
      'https://github.com/org/project/pull/99',
    ]);
  });

  test('strips trailing content from URL in pasted text', () => {
    const text = 'See https://github.com/owner/repo/issues/7 for details.';
    const urls = parseImportUrls(text);
    expect(urls).toEqual(['https://github.com/owner/repo/issues/7']);
  });

  test('filters URLs with zero issue number', () => {
    const urls = parseImportUrls('https://github.com/owner/repo/issues/0');
    expect(urls).toEqual([]);
  });

  test('parses multiple different valid URLs', () => {
    const text = [
      'https://github.com/alan-turing-institute/dactyl/issues/146',
      'https://github.com/alan-turing-institute/dactyl/pull/147',
      'https://github.com/other/repo/issues/1',
    ].join('\n');
    const urls = parseImportUrls(text);
    expect(urls).toHaveLength(3);
  });
});

describe('fallbackLabel', () => {
  test('formats issue URL correctly', () => {
    const label = fallbackLabel('https://github.com/owner/repo/issues/42');
    expect(label).toBe('owner/repo #42 (issue)');
  });

  test('formats PR URL correctly', () => {
    const label = fallbackLabel('https://github.com/owner/repo/pull/7');
    expect(label).toBe('owner/repo #7 (PR)');
  });

  test('returns url on invalid input', () => {
    const label = fallbackLabel('not-a-url');
    expect(label).toBe('not-a-url');
  });
});

describe('normaliseGithubUrl', () => {
  test('returns normalised URL for valid issue', () => {
    const url = normaliseGithubUrl('https://github.com/owner/repo/issues/1');
    expect(url).toBe('https://github.com/owner/repo/issues/1');
  });

  test('returns normalised URL for valid PR', () => {
    const url = normaliseGithubUrl('https://github.com/owner/repo/pull/99');
    expect(url).toBe('https://github.com/owner/repo/pull/99');
  });

  test('strips trailing hash/anchor from URL', () => {
    const url = normaliseGithubUrl('https://github.com/owner/repo/issues/5#issuecomment-12345');
    expect(url).toBe('https://github.com/owner/repo/issues/5');
  });

  test('returns empty string for http URL', () => {
    expect(normaliseGithubUrl('http://github.com/owner/repo/issues/1')).toBe('');
  });

  test('returns empty string for non-github URL', () => {
    expect(normaliseGithubUrl('https://gitlab.com/owner/repo/issues/1')).toBe('');
  });

  test('returns empty string for missing number', () => {
    expect(normaliseGithubUrl('https://github.com/owner/repo/issues/')).toBe('');
  });

  test('returns empty string for invalid type', () => {
    expect(normaliseGithubUrl('https://github.com/owner/repo/commits/abc123')).toBe('');
  });

  test('returns empty string for empty input', () => {
    expect(normaliseGithubUrl('')).toBe('');
    expect(normaliseGithubUrl(null)).toBe('');
    expect(normaliseGithubUrl(undefined)).toBe('');
  });
});
