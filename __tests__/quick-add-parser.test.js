const { parseQuickAdd } = require('../quick-add-parser');

describe('natural-language quick add parser', () => {
  const today = '2026-06-11';

  test('parses relative dates and priority hints', () => {
    expect(parseQuickAdd('Send slides tomorrow high', { today })).toEqual({
      text: 'Send slides',
      dueDate: '2026-06-12',
      priority: 'high',
    });
  });

  test('parses explicit due date hints', () => {
    expect(parseQuickAdd('Review PR due:2026-06-14 medium', { today })).toEqual({
      text: 'Review PR',
      dueDate: '2026-06-14',
      priority: 'medium',
    });
  });

  test('parses next weekday phrases', () => {
    expect(parseQuickAdd('Email Alice next Friday low', { today })).toEqual({
      text: 'Email Alice',
      dueDate: '2026-06-12',
      priority: 'low',
    });
  });

  test('leaves ordinary text untouched when no hints are present', () => {
    expect(parseQuickAdd('Write demo notes', { today })).toEqual({
      text: 'Write demo notes',
      dueDate: '',
      priority: '',
    });
  });
});
