const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const indexHtml = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const appJs = fs.readFileSync(path.join(root, 'app.js'), 'utf8');

describe('Tasks view layout wiring', () => {
  test('top-level View Fish tab targets a dedicated fish workflow summary', () => {
    expect(indexHtml).toContain('data-pond-view="tasks" aria-controls="tasks-view-summary"');
    expect(indexHtml).toContain('data-pond-view="tasks" aria-controls="tasks-view-summary" aria-pressed="false">View Fish</button>');
    expect(indexHtml).toContain('id="tasks-view-summary"');
    expect(indexHtml).toContain('Add, search, filter, select, edit, complete, archive, and restore fish');
  });

  test('core task workflow controls are owned by the Tasks view selectors', () => {
    const tasksBlock = appJs.match(/tasks: \[([\s\S]*?)\],\n[ ]{2}tools:/)[1];
    const homeBlock = appJs.match(/home: \[([\s\S]*?)\],\n[ ]{2}tasks:/)[1];

    [
      '#todo-form',
      '.pond-actions',
      '.toolbar',
      '.search-panel',
      '#todo-list',
      '#empty-state',
      '#clear-completed',
      '#triage-panel',
    ].forEach((selector) => {
      expect(tasksBlock).toContain(`'${selector}'`);
    });

    expect(homeBlock).not.toContain("'#todo-form'");
    expect(homeBlock).not.toContain("'#todo-list'");
  });
});
