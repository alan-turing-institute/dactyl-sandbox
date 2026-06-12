// AI-assisted coding: Claude Code was attempted via `claude -p` for issue #237 using the prompt: "implement GitHub issue #237 ... add a Pond OS game called Net Sweeper ..."; GPT-5.5 completed these tests after Claude Code produced no edits.
const {
  createKeySequenceDetector,
  createNetSweeperGame,
  markNetSweeperTile,
  runFishTermCommand,
  runNetSweeperComputerTurn,
  sweepNetSweeperTile,
} = require('../pond-os');

function sequenceRandom(values) {
  let index = 0;
  return () => {
    const value = values[index % values.length];
    index += 1;
    return value;
  };
}

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
      'sweeper   open Net Sweeper',
    ]));
    expect(runFishTermCommand('clear')).toMatchObject({ clear: true });
    expect(runFishTermCommand('dance').lines[0]).toContain('command not found in this pond');
  });
});

describe('Net Sweeper game model', () => {
  test('generates a pond board with hazards, fish bonuses, and clue counts', () => {
    const game = createNetSweeperGame({
      rows: 3,
      cols: 3,
      hazards: 2,
      fishBonuses: 1,
      random: sequenceRandom([0, 0.88, 0.44]),
    });

    expect(game.cells).toHaveLength(9);
    expect(game.cells.filter((cell) => cell.hazard)).toHaveLength(2);
    expect(game.cells.filter((cell) => cell.fishBonus)).toHaveLength(1);
    expect(game.safeRemaining).toBe(7);
    expect(game.cells.find((cell) => cell.id === '0:1').clue).toBe(1);
    expect(game.cells.find((cell) => cell.id === '1:1').clue).toBe(2);
  });

  test('sweeping safe fish water scores points and advances to computer turn', () => {
    const game = createNetSweeperGame({
      rows: 3,
      cols: 3,
      hazards: 1,
      fishBonuses: 1,
      random: sequenceRandom([0, 0.44]),
    });
    const next = sweepNetSweeperTile(game, '1:0', 'human');

    expect(next.scores.human).toBe(5);
    expect(next.safeRemaining).toBe(7);
    expect(next.turn).toBe('computer');
    expect(next.cells.find((cell) => cell.id === '1:0').revealed).toBe(true);
  });

  test('sweeping a ghost net penalises the active player', () => {
    const game = createNetSweeperGame({ rows: 3, cols: 3, hazards: 1, fishBonuses: 0, random: sequenceRandom([0]) });
    const next = sweepNetSweeperTile(game, '0:0', 'human');

    expect(next.scores.human).toBe(-5);
    expect(next.log[0]).toContain('disturbed');
  });

  test('finishes the game when all safe water has been swept and awards marker bonuses', () => {
    let game = createNetSweeperGame({ rows: 3, cols: 3, hazards: 1, fishBonuses: 0, random: sequenceRandom([0]) });
    game = markNetSweeperTile(game, '0:0', 'human');
    ['0:1', '0:2', '1:0', '1:1', '1:2', '2:0', '2:1', '2:2'].forEach((cellId) => {
      game = sweepNetSweeperTile({ ...game, turn: 'human' }, cellId, 'human');
    });

    expect(game.status).toBe('complete');
    expect(game.winner).toBe('human');
    expect(game.scores.human).toBe(18);
  });

  test('computer takes a clue-based move and returns control to the human', () => {
    let game = createNetSweeperGame({ rows: 3, cols: 3, hazards: 1, fishBonuses: 0, random: sequenceRandom([0]) });
    game = sweepNetSweeperTile(game, '2:2', 'human');
    const afterComputer = runNetSweeperComputerTurn(game, { random: sequenceRandom([0.1]), difficulty: 'cod' });

    expect(afterComputer.turn).toBe('human');
    expect(afterComputer.log[0]).toMatch(/Computer/);
    expect(afterComputer.cells.some((cell) => cell.revealed && cell.owner === 'computer')).toBe(true);
  });
});
