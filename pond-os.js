/* global module, window */
// AI-assisted coding: Claude Code was attempted via `claude -p` for issue #237 using the prompt: "implement GitHub issue #237 ... add a Pond OS game called Net Sweeper ..."; GPT-5.5 completed this implementation after Claude Code produced no edits.
(function registerPondOs(globalScope) {
  const TRIGGER_SEQUENCE = 'pondos';
  const NET_SWEEPER_DEFAULTS = {
    rows: 6,
    cols: 6,
    hazards: 6,
    fishBonuses: 5,
  };
  const HAZARD_LABELS = ['ghost net', 'rusty hook', 'plastic ring', 'snapping crab'];
  const POND_OS_APPS = {
    fishterm: {
      title: 'FishTerm',
      description: 'Local command line for checking the pond kernel.',
    },
    pondpad: {
      title: 'PondPad',
      description: 'Read-only notes from the Pond OS desktop.',
    },
    netsweeper: {
      title: 'Net Sweeper',
      description: 'Human v computer pond-clearing puzzle game.',
    },
  };

  function normaliseTaskSummary(summary = {}) {
    return {
      total: Number(summary.total || 0),
      active: Number(summary.active || 0),
      completed: Number(summary.completed || 0),
    };
  }

  function createKeySequenceDetector(sequence = TRIGGER_SEQUENCE) {
    let buffer = '';
    const target = String(sequence).toLowerCase();
    return {
      push(key) {
        const value = String(key || '').toLowerCase();
        if (!/^[a-z]$/.test(value)) {
          buffer = '';
          return false;
        }
        buffer = `${buffer}${value}`.slice(-target.length);
        if (buffer === target) {
          buffer = '';
          return true;
        }
        return false;
      },
      reset() {
        buffer = '';
      },
    };
  }

  function runFishTermCommand(rawCommand, summary = {}) {
    const command = String(rawCommand || '').trim().toLowerCase();
    const taskSummary = normaliseTaskSummary(summary);
    if (!command) return { lines: [], clear: false, close: false };
    if (command === 'clear') return { lines: [], clear: true, close: false };
    if (command === 'exit') return { lines: ['returning to Pond Life…'], clear: false, close: true };
    if (command === 'help') {
      return {
        lines: [
          'help      list local Pond OS commands',
          'tasks     show current fish counts',
          'catch     print today’s catch note',
          'sweeper   open Net Sweeper',
          'clear     clear FishTerm output',
          'exit      return to Pond Life',
        ],
        clear: false,
        close: false,
      };
    }
    if (command === 'tasks') {
      return {
        lines: [
          `${taskSummary.active} active fish / ${taskSummary.completed} resting shells / ${taskSummary.total} total pond items`,
        ],
        clear: false,
        close: false,
      };
    }
    if (command === 'catch') {
      return {
        lines: ['today’s catch: feed one fish, sort the shoal, keep the water calm'],
        clear: false,
        close: false,
      };
    }
    if (command === 'sweeper' || command === 'netsweeper') {
      return {
        lines: ['Net Sweeper lives in the desktop icons. Mind the ghost nets.'],
        clear: false,
        close: false,
      };
    }
    return { lines: [`${command}: command not found in this pond`], clear: false, close: false };
  }

  function clampWholeNumber(value, fallback, min, max) {
    const number = Math.floor(Number(value));
    if (!Number.isFinite(number)) return fallback;
    return Math.min(max, Math.max(min, number));
  }

  function netSweeperCellId(row, col) {
    return `${row}:${col}`;
  }

  function netSweeperNeighbours(row, col, rows, cols) {
    const neighbours = [];
    for (let rowOffset = -1; rowOffset <= 1; rowOffset += 1) {
      for (let colOffset = -1; colOffset <= 1; colOffset += 1) {
        if (rowOffset === 0 && colOffset === 0) continue;
        const nextRow = row + rowOffset;
        const nextCol = col + colOffset;
        if (nextRow >= 0 && nextRow < rows && nextCol >= 0 && nextCol < cols) {
          neighbours.push(netSweeperCellId(nextRow, nextCol));
        }
      }
    }
    return neighbours;
  }

  function pickUniquePositions(count, total, random) {
    const positions = new Set();
    while (positions.size < count && positions.size < total) {
      positions.add(Math.floor(random() * total));
    }
    return positions;
  }

  function cloneNetSweeperGame(game) {
    return {
      ...game,
      scores: { ...game.scores },
      sonarLeft: { ...game.sonarLeft },
      cells: game.cells.map((cell) => ({ ...cell })),
      log: [...game.log],
    };
  }

  function findNetSweeperCell(game, cellId) {
    return game.cells.find((cell) => cell.id === cellId);
  }

  function createNetSweeperGame(options = {}) {
    const rows = clampWholeNumber(options.rows, NET_SWEEPER_DEFAULTS.rows, 3, 12);
    const cols = clampWholeNumber(options.cols, NET_SWEEPER_DEFAULTS.cols, 3, 12);
    const total = rows * cols;
    const random = typeof options.random === 'function' ? options.random : Math.random;
    const hazards = clampWholeNumber(options.hazards, NET_SWEEPER_DEFAULTS.hazards, 1, total - 2);
    const fishBonuses = clampWholeNumber(options.fishBonuses, NET_SWEEPER_DEFAULTS.fishBonuses, 0, total - hazards);
    const hazardPositions = pickUniquePositions(hazards, total, random);
    const bonusPositions = new Set();
    while (bonusPositions.size < fishBonuses) {
      const position = Math.floor(random() * total);
      if (!hazardPositions.has(position)) bonusPositions.add(position);
    }
    const cells = [];
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        const index = row * cols + col;
        const isHazard = hazardPositions.has(index);
        cells.push({
          id: netSweeperCellId(row, col),
          row,
          col,
          hazard: isHazard,
          hazardLabel: isHazard ? HAZARD_LABELS[index % HAZARD_LABELS.length] : '',
          fishBonus: bonusPositions.has(index),
          clue: 0,
          revealed: false,
          marked: false,
          markerOwner: '',
          owner: '',
          sonar: false,
        });
      }
    }
    const game = {
      rows,
      cols,
      hazards,
      status: 'playing',
      turn: 'human',
      winner: '',
      scores: { human: 0, computer: 0 },
      sonarLeft: { human: 1, computer: 0 },
      safeRemaining: total - hazards,
      cells,
      log: ['Net Sweeper started. Sweep safe water, mark ghost nets, beat the computer shoal.'],
    };
    game.cells.forEach((cell) => {
      cell.clue = netSweeperNeighbours(cell.row, cell.col, rows, cols)
        .filter((id) => findNetSweeperCell(game, id).hazard).length;
    });
    return game;
  }

  function finishNetSweeperIfNeeded(game) {
    if (game.status !== 'playing') return game;
    if (game.safeRemaining > 0) return game;
    const markerBonus = { human: 0, computer: 0 };
    game.cells.forEach((cell) => {
      if (cell.marked && cell.hazard && markerBonus[cell.markerOwner] !== undefined) markerBonus[cell.markerOwner] += 2;
      if (cell.marked && !cell.hazard && markerBonus[cell.markerOwner] !== undefined) markerBonus[cell.markerOwner] -= 1;
    });
    game.scores.human += markerBonus.human;
    game.scores.computer += markerBonus.computer;
    game.status = 'complete';
    if (game.scores.human > game.scores.computer) game.winner = 'human';
    else if (game.scores.computer > game.scores.human) game.winner = 'computer';
    else game.winner = 'draw';
    game.log.unshift(`Pond restored: ${netSweeperWinnerText(game)} Marker bonuses: human ${markerBonus.human}, computer ${markerBonus.computer}.`);
    return game;
  }

  function nextNetSweeperTurn(actor) {
    return actor === 'human' ? 'computer' : 'human';
  }

  function sweepNetSweeperTile(currentGame, cellId, actor = 'human') {
    const game = cloneNetSweeperGame(currentGame);
    if (game.status !== 'playing') return game;
    const cell = findNetSweeperCell(game, cellId);
    if (!cell || cell.revealed || cell.marked) return game;
    cell.revealed = true;
    cell.owner = actor;
    if (cell.hazard) {
      game.scores[actor] -= 5;
      game.log.unshift(`${actor === 'human' ? 'You' : 'Computer'} disturbed a ${cell.hazardLabel}. -5 points, very dignified.`);
    } else {
      game.safeRemaining -= 1;
      const points = cell.fishBonus ? 5 : 2;
      game.scores[actor] += points;
      game.log.unshift(`${actor === 'human' ? 'You' : 'Computer'} swept clear water${cell.fishBonus ? ' and rescued a fish' : ''}. +${points} points.`);
    }
    game.turn = nextNetSweeperTurn(actor);
    return finishNetSweeperIfNeeded(game);
  }

  function markNetSweeperTile(currentGame, cellId, actor = 'human') {
    const game = cloneNetSweeperGame(currentGame);
    if (game.status !== 'playing') return game;
    const cell = findNetSweeperCell(game, cellId);
    if (!cell || cell.revealed) return game;
    const ownedMarker = cell.marked && cell.markerOwner === actor;
    cell.marked = !ownedMarker;
    cell.markerOwner = cell.marked ? actor : '';
    game.log.unshift(`${actor === 'human' ? 'You' : 'Computer'} ${cell.marked ? 'dropped a warning buoy' : 'lifted a warning buoy'}.`);
    game.turn = nextNetSweeperTurn(actor);
    return game;
  }

  function sonarNetSweeperTile(currentGame, cellId, actor = 'human') {
    const game = cloneNetSweeperGame(currentGame);
    if (game.status !== 'playing' || game.sonarLeft[actor] <= 0) return game;
    const cell = findNetSweeperCell(game, cellId);
    if (!cell || cell.revealed) return game;
    cell.sonar = true;
    game.sonarLeft[actor] -= 1;
    game.log.unshift(`${actor === 'human' ? 'You' : 'Computer'} sent a sonar ping: ${cell.clue} nearby hazards ripple back.`);
    game.turn = nextNetSweeperTurn(actor);
    return game;
  }

  function estimateNetSweeperRisk(game, cell) {
    const hiddenCells = game.cells.filter((candidate) => !candidate.revealed && !candidate.marked);
    const markedHazards = game.cells.filter((candidate) => candidate.marked).length;
    let risk = (game.hazards - markedHazards) / Math.max(1, hiddenCells.length);
    const revealedNeighbours = netSweeperNeighbours(cell.row, cell.col, game.rows, game.cols)
      .map((id) => findNetSweeperCell(game, id))
      .filter((candidate) => candidate.revealed && !candidate.hazard);
    revealedNeighbours.forEach((neighbour) => {
      const neighbours = netSweeperNeighbours(neighbour.row, neighbour.col, game.rows, game.cols)
        .map((id) => findNetSweeperCell(game, id));
      const markedAround = neighbours.filter((candidate) => candidate.marked).length;
      const hiddenAround = neighbours.filter((candidate) => !candidate.revealed && !candidate.marked).length;
      if (hiddenAround > 0) risk = Math.max(risk, (neighbour.clue - markedAround) / hiddenAround);
    });
    return Math.max(0, Math.min(1, risk));
  }

  function chooseNetSweeperComputerMove(game, options = {}) {
    if (game.status !== 'playing') return null;
    const random = typeof options.random === 'function' ? options.random : Math.random;
    const difficulty = options.difficulty || 'cod';
    const candidates = game.cells
      .filter((cell) => !cell.revealed && !cell.marked)
      .map((cell) => ({ cell, risk: estimateNetSweeperRisk(game, cell) }))
      .sort((a, b) => a.risk - b.risk || a.cell.id.localeCompare(b.cell.id));
    if (candidates.length === 0) return null;
    if (difficulty === 'minnow' && random() < 0.35) {
      return { action: 'sweep', cellId: candidates[Math.floor(random() * candidates.length)].cell.id };
    }
    const dangerous = candidates.find((candidate) => candidate.risk >= (difficulty === 'shark' ? 0.72 : 0.88));
    if (dangerous) return { action: 'mark', cellId: dangerous.cell.id };
    const safestBand = candidates.filter((candidate) => candidate.risk <= candidates[0].risk + 0.05);
    const choice = safestBand[Math.floor(random() * safestBand.length)] || candidates[0];
    return { action: 'sweep', cellId: choice.cell.id };
  }

  function runNetSweeperComputerTurn(currentGame, options = {}) {
    if (currentGame.status !== 'playing' || currentGame.turn !== 'computer') return currentGame;
    const move = chooseNetSweeperComputerMove(currentGame, options);
    if (!move) return finishNetSweeperIfNeeded({ ...cloneNetSweeperGame(currentGame), turn: 'human' });
    return move.action === 'mark'
      ? markNetSweeperTile(currentGame, move.cellId, 'computer')
      : sweepNetSweeperTile(currentGame, move.cellId, 'computer');
  }

  function netSweeperWinnerText(game) {
    if (game.winner === 'human') return 'you restored the healthier pond';
    if (game.winner === 'computer') return 'the computer shoal takes the pond crown';
    if (game.winner === 'draw') return 'drawn tide — nobody gets to be smug';
    return 'pond still in progress';
  }

  const api = {
    NET_SWEEPER_DEFAULTS,
    POND_OS_APPS,
    TRIGGER_SEQUENCE,
    chooseNetSweeperComputerMove,
    createKeySequenceDetector,
    createNetSweeperGame,
    markNetSweeperTile,
    netSweeperNeighbours,
    netSweeperWinnerText,
    runFishTermCommand,
    runNetSweeperComputerTurn,
    sonarNetSweeperTile,
    sweepNetSweeperTile,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  globalScope.DactylPondOs = api;
})(typeof window !== 'undefined' ? window : globalThis);
