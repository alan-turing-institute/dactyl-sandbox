/* global module, window */
(function registerPondOs(globalScope) {
  const TRIGGER_SEQUENCE = 'pondos';
  const POND_OS_APPS = {
    fishterm: {
      title: 'FishTerm',
      description: 'Local command line for checking the pond kernel.',
    },
    pondpad: {
      title: 'PondPad',
      description: 'Read-only notes from the Pond OS desktop.',
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
    return { lines: [`${command}: command not found in this pond`], clear: false, close: false };
  }

  const api = {
    POND_OS_APPS,
    TRIGGER_SEQUENCE,
    createKeySequenceDetector,
    runFishTermCommand,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  globalScope.DactylPondOs = api;
})(typeof window !== 'undefined' ? window : globalThis);
