const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const indexHtml = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const appJs = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8');
const docsHtml = fs.readFileSync(path.join(root, 'docs.html'), 'utf8');

const views = [
  ['home', 'home-view-summary'],
  ['tasks', 'tasks-view-summary'],
  ['tools', 'tools-view-summary'],
  ['settings', 'settings-view-summary'],
];

describe('top-level navigation regression coverage', () => {
  test('each top-level tab owns a labelled summary section and accessible state', () => {
    views.forEach(([view, sectionId]) => {
      expect(indexHtml).toContain(`data-pond-view="${view}" aria-controls="${sectionId}"`);
      expect(indexHtml).toContain(`id="${sectionId}"`);
      expect(indexHtml).toContain(`data-pond-view-section="${view}"`);
    });

    expect(indexHtml).toContain('id="pond-view-status" class="sr-only" role="status" aria-live="polite"');
    expect(indexHtml).toContain('aria-current="page" aria-pressed="true"');
  });

  test('view changes update visibility, active state, focus target, and status text', () => {
    expect(appJs).toContain("element.classList.toggle('pond-view-section-hidden', viewKey !== activeView);");
    expect(appJs).toContain("button.classList.toggle('active', state.active);");
    expect(appJs).toContain("button.setAttribute('aria-pressed', state.ariaPressed);");
    expect(appJs).toContain("pondViewStatus.textContent = `${pondViewLabel(activeView)} view selected.`;");
    expect(appJs).toContain("activeButton.focus({ preventScroll: true });");
  });

  test('README and docs describe the view map for future UI additions', () => {
    ['Home / Today', 'View Fish', 'Tools', 'Settings & Help'].forEach((label) => {
      expect(readme).toContain(label);
    });
    ['Home / Today', 'View Fish', 'Tools', 'Settings &amp; Help'].forEach((label) => {
      expect(docsHtml).toContain(label);
    });
    expect(readme).toContain('Navigation QA checklist');
    expect(docsHtml).toContain('Top-level views');
  });
});
