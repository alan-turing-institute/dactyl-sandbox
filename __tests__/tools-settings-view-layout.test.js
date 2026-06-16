const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const indexHtml = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const styles = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');

function sectionHtml(sectionId) {
  const match = indexHtml.match(new RegExp(`<section id="${sectionId}"[\\s\\S]*?<\\/section>`));
  if (!match) throw new Error(`Missing section ${sectionId}`);
  return match[0];
}

describe('Tools and Settings view relocation', () => {
  test('secondary tool controls live directly in the Tools view summary', () => {
    const tools = sectionHtml('tools-view-summary');
    [
      'paste-pond',
      'github-import-toggle',
      'export-pond',
      'export-calendar',
      'restore-pond-toggle',
      'copy-pond-report',
      'copy-pond-snapshot',
      'share-pond',
      'copy-standup-draft',
      'pond-health-toggle',
      'activity-log-toggle',
      'showcase-toggle',
      'trophies-toggle',
      'starter-shoals-toggle',
    ].forEach((id) => {
      expect(tools).toContain(`id="${id}"`);
    });
    expect(tools).toContain('Import / export');
    expect(tools).toContain('Reports &amp; diagnostics');
  });

  test('settings and help controls live directly in the Settings & Help view summary', () => {
    const settings = sectionHtml('settings-view-summary');
    [
      'prefs-toggle',
      'reminder-prefs-toggle',
      'getting-started-toggle',
      'shortcut-help-toggle',
      'button-help-toggle',
    ].forEach((id) => {
      expect(settings).toContain(`id="${id}"`);
    });
    expect(settings).toContain('href="/docs"');
  });

  test('overflow panel is no longer the large catch-all controls surface', () => {
    const more = sectionHtml('more-actions-panel');
    expect(more).toContain('Tools live here now');
    expect(more).toContain('data-pond-view-target="tools"');
    expect(more).toContain('data-pond-view-target="settings"');
    expect(more).not.toContain('id="paste-pond"');
    expect(more).not.toContain('id="prefs-toggle"');
    expect(indexHtml.match(/id="paste-pond"/g)).toHaveLength(1);
    expect(indexHtml.match(/id="prefs-toggle"/g)).toHaveLength(1);
  });

  test('view action clusters have explicit styling hooks', () => {
    expect(styles).toContain('.view-action-groups {');
    expect(styles).toContain('.view-action-label {');
  });

  test('starter shoals provide visible feedback and reveal stocked fish', () => {
    const starterShoals = sectionHtml('starter-shoals-panel');
    const appJs = fs.readFileSync(path.join(root, 'app.js'), 'utf8');

    expect(starterShoals).toContain('id="starter-shoals-status"');
    expect(starterShoals).toContain('aria-live="polite"');
    expect(styles).toContain('.starter-shoals-status {');
    expect(appJs).toContain('function setStarterShoalsStatus(message)');
    expect(appJs).toContain("if (open) setPondView('tools');");
    expect(appJs).toContain('clearSearchState();');
    expect(appJs).toContain("setShoalFilter('');");
    expect(appJs).toContain("setFilter('all');");
    expect(appJs).toContain("shoal: shoal.name");
  });
});
