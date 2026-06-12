const fs = require('fs');
const path = require('path');

const appSource = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');

describe('inline action strip keyboard behavior', () => {
  test('queues row focus restoration for render-driven shortcuts', () => {
    expect(appSource).toContain('function queueTodoFocusAfterRender(id)');
    expect(appSource).toContain('toggleTodo(todo.id, { refocusRow: true })');
    expect(appSource).toContain("updateTodoDetails(todo.id, { priority: next }, 'Tide level updated.', { refocusRow: true })");
    expect(appSource).toContain('focusPendingTodoRow();');
  });

  test('supports an archive shortcut only when the archive action is available', () => {
    expect(appSource).toContain("e.key === 'a' || e.key === 'A'");
    expect(appSource).toContain('actionButtonAvailable(archiveButton)');
    expect(appSource).toContain('archiveTodo(todo.id, { refocusRow: true })');
  });
});
