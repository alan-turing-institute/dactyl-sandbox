const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const indexHtml = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const appJs = fs.readFileSync(path.join(root, 'app.js'), 'utf8');

describe('Home / Today panel tabs', () => {
  test('Home summary offers a Daily Catch / View Fish tab pair', () => {
    expect(indexHtml).toContain('class="view-summary-actions home-view-tabs" role="tablist" aria-label="Home / Today panels"');
    expect(indexHtml).toContain('id="daily-catch-toggle" class="secondary-action active" type="button" role="tab" aria-selected="true" aria-expanded="true"');
    expect(indexHtml).toContain('data-pond-view-target="tasks">View Fish</button>');
  });

  test('Home keeps Daily Catch visible while View Fish owns the task list', () => {
    expect(appJs).toContain('function syncHomeTodayTabs(activeView)');
    expect(appJs).toContain("dailyCatchPanel.hidden = !homeActive;");
    expect(appJs).toContain("if (!open) {\n    setPondView('tasks');");
    expect(appJs).toContain('Switch to View Fish when you are ready to add, search, or review the full pond.');
  });
});
