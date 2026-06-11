const {
  desiredScreenKey,
  normaliseScreenKey,
  screenKeyFromHash,
  screenKeyFromLocation,
} = require('../screen-state');

describe('screen state transitions', () => {
  test('normalises supported screen keys and rejects unknown keys', () => {
    expect(normaliseScreenKey('auth')).toBe('auth');
    expect(normaliseScreenKey('pond')).toBe('pond');
    expect(normaliseScreenKey('focus')).toBe('focus');
    expect(normaliseScreenKey('settings')).toBe('');
  });

  test('reads shareable screen keys from the URL hash', () => {
    expect(screenKeyFromHash('#auth')).toBe('auth');
    expect(screenKeyFromHash('#pond')).toBe('pond');
    expect(screenKeyFromHash('#focus')).toBe('focus');
    expect(screenKeyFromHash('')).toBe('');
    expect(screenKeyFromHash('#unknown')).toBe('');
  });

  test('reads requested screen keys from the active location hash', () => {
    expect(screenKeyFromLocation({ hash: '#auth' })).toBe('auth');
    expect(screenKeyFromLocation({ hash: '#pond' })).toBe('pond');
    expect(screenKeyFromLocation({ hash: '#focus' })).toBe('focus');
    expect(screenKeyFromLocation({ hash: '#unknown' })).toBe('');
    expect(screenKeyFromLocation({})).toBe('');
  });

  test('keeps signed-out visitors on the auth screen', () => {
    expect(desiredScreenKey({ signedIn: false, requestedScreen: 'pond', hasFocusedTodo: true })).toBe('auth');
    expect(desiredScreenKey({ signedIn: false, requestedScreen: 'focus', hasFocusedTodo: true })).toBe('auth');
  });

  test('uses pond as the signed-in default and only shows focus when a task is selected', () => {
    expect(desiredScreenKey({ signedIn: true, requestedScreen: '', hasFocusedTodo: false })).toBe('pond');
    expect(desiredScreenKey({ signedIn: true, requestedScreen: 'auth', hasFocusedTodo: false })).toBe('pond');
    expect(desiredScreenKey({ signedIn: true, requestedScreen: 'focus', hasFocusedTodo: false })).toBe('pond');
    expect(desiredScreenKey({ signedIn: true, requestedScreen: 'focus', hasFocusedTodo: true })).toBe('focus');
  });
});
