const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const indexHtml = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const appJs = fs.readFileSync(path.join(root, 'app.js'), 'utf8');

describe('Getting started checklist actions', () => {
  test('checklist items are reachable buttons rather than static text', () => {
    [
      'checklist-add-task',
      'checklist-tide-mode',
      'checklist-pond-tour',
    ].forEach((id) => {
      expect(indexHtml).toContain(`<button id="${id}" type="button">`);
    });
  });

  test('checklist buttons are wired to their onboarding actions', () => {
    expect(appJs).toContain("checklistAddTask.addEventListener('click', focusTaskInputFromTour);");
    expect(appJs).toContain("checklistTideMode.addEventListener('click', switchToTideModeFromTour);");
    expect(appJs).toContain("checklistPondTour.addEventListener('click', () => openPondTour('getting_started_checklist'));");
  });
});
