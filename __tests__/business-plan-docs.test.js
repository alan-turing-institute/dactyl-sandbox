const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const businessPlan = fs.readFileSync(path.join(root, 'BUSINESS_PLAN.md'), 'utf8');
const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8');

describe('Dactyl business plan documentation', () => {
  test('README links to the investor-facing business plan', () => {
    expect(readme).toContain('[Dactyl business plan](BUSINESS_PLAN.md)');
  });

  test('business plan covers positioning, market, model, and investor readiness', () => {
    [
      '# Dactyl business plan',
      '## Positioning',
      '## Target audiences',
      '## Business model',
      '## Revenue scenarios',
      '## Go-to-market plan',
      '## Investor narrative',
      '## Risks and mitigations',
      '## Product roadmap for investor-readiness',
      '## Next deck outline',
    ].forEach((heading) => {
      expect(businessPlan).toContain(heading);
    });
  });

  test('business plan keeps the gentle task pond thesis explicit', () => {
    expect(businessPlan).toContain('gentle task pond');
    expect(businessPlan).toContain('TODO lists have teeth');
    expect(businessPlan).toContain('low-shame task recovery');
  });
});
