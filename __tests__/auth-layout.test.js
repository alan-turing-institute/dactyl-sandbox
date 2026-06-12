const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const indexHtml = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const styles = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');

describe('minimal auth screen layout', () => {
  test('auth markup keeps context, credentials, and actions in separate groups', () => {
    expect(indexHtml).toContain('class="hero auth-hero"');
    expect(indexHtml).toContain('class="auth-context"');
    expect(indexHtml).toContain('class="auth-field-group" aria-describedby="auth-help"');
    expect(indexHtml).toContain('id="login-button" type="submit" name="auth-mode" value="login"');
    expect(indexHtml).toContain('id="signup-button" class="link-action" type="submit" name="auth-mode" value="signup"');
    expect(indexHtml).toContain('New here?');
  });

  test('visible labels and helper text remain available to both credential fields', () => {
    expect(indexHtml).toContain('<span>Username</span>');
    expect(indexHtml).toContain('<span>Password</span>');
    expect(indexHtml).toContain('id="username-input"');
    expect(indexHtml).toContain('id="password-input"');
    expect(indexHtml.match(/aria-describedby="auth-help"/g)).toHaveLength(3);
  });

  test('CSS makes login primary, signup secondary, and tap targets mobile-safe', () => {
    expect(styles).toContain('.auth-panel {\n  display: grid;\n  gap: 1.5rem;');
    expect(styles).toContain('.auth-actions {\n  display: grid;\n  gap: 1rem;');
    expect(styles).toContain('#login-button {\n  width: 100%;');
    expect(styles).toContain('.link-action {');
    expect(styles).toContain('min-height: 44px;');
    expect(styles).toContain('font-size: 1rem;');
  });
});
