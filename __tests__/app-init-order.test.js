const fs = require('node:fs');
const path = require('node:path');

describe('app initialisation order', () => {
  test('defines persisted filter allowlist before loading saved filter state', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
    const validFiltersDeclaration = source.indexOf('const VALID_FILTERS =');
    const savedFilterInitialiser = source.indexOf('let filter = loadLastFilter();');

    expect(validFiltersDeclaration).toBeGreaterThanOrEqual(0);
    expect(savedFilterInitialiser).toBeGreaterThanOrEqual(0);
    expect(validFiltersDeclaration).toBeLessThan(savedFilterInitialiser);
  });
});
