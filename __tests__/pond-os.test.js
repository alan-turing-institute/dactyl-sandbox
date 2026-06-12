const { createKeySequenceDetector, runFishTermCommand } = require('../pond-os');

describe('Pond OS easter egg helpers', () => {
  test('detects pondos sequence and resets after a trigger', () => {
    const detector = createKeySequenceDetector();
    expect(['p', 'o', 'n', 'd', 'o'].some((key) => detector.push(key))).toBe(false);
    expect(detector.push('s')).toBe(true);
    expect(detector.push('s')).toBe(false);
  });

  test('resets detection on non-letter keys before detecting the launch phrase', () => {
    const detector = createKeySequenceDetector();
    expect(detector.push('p')).toBe(false);
    expect(detector.push('ArrowLeft')).toBe(false);
    expect(['o', 'n', 'd', 'o', 's'].some((key) => detector.push(key))).toBe(false);
    expect(['p', 'o', 'n', 'd', 'o', 's'].some((key) => detector.push(key))).toBe(true);
  });

  test('runs local FishTerm commands without mutating tasks', () => {
    expect(runFishTermCommand('tasks', { total: 5, active: 3, completed: 2 }).lines).toEqual([
      '3 active fish / 2 resting shells / 5 total pond items',
    ]);
    expect(runFishTermCommand('help').lines).toEqual(expect.arrayContaining([
      'tasks     show current fish counts',
      'clear     clear FishTerm output',
    ]));
    expect(runFishTermCommand('clear')).toMatchObject({ clear: true });
    expect(runFishTermCommand('dance').lines[0]).toContain('command not found in this pond');
  });
});
