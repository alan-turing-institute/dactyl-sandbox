// AI-assisted coding: Claude Code (claude-sonnet-4-6) via `claude -p`.
// Prompts: (1) fix issue #61 by clearing/constraining Cast net selections so bulk actions cannot affect hidden tasks; (2) review/refine with renderedTodoIds() so render(), release, and shoal moves all scope selection to rendered tasks per filter; (3) issue #22 Ghost net stale-task review mode — ghost filter button, stale detection (overdue / no-due-date 7d / high-priority 7d), Ghost net panel with count/empty-state, per-task actions (Focus, Snooze tomorrow, Snooze 1 week, Release).
const TOKEN_KEY = 'dactyl.authToken';
const FOCUS_KEY = 'dactyl.focusedTodoId';
const SPRINT_LENGTH_KEY = 'dactyl.focusSprintLengthMinutes';
const TOUR_DISMISSED_KEY = 'dactyl.pondTourDismissed:v1';
const MAX_TODOS = 200;
const DEFAULT_SPRINT_MINUTES = 15;
const MAX_TODO_LENGTH = 120;
const PRIORITIES = ['low', 'medium', 'high'];
const DEMO_TODO_IDS = ['demo-flopping', 'demo-bubbles', 'demo-low-tide'];
const GHOST_STALE_DAYS = 7;

const authPanel = document.querySelector('#auth-panel');
const authTitle = document.querySelector('#auth-title');
const authForm = document.querySelector('#auth-form');
const usernameInput = document.querySelector('#username-input');
const passwordInput = document.querySelector('#password-input');
const signupButton = document.querySelector('#signup-button');
const logoutButton = document.querySelector('#logout-button');
const authStatus = document.querySelector('#auth-status');
const passwordForm = document.querySelector('#password-form');
const currentPasswordInput = document.querySelector('#current-password-input');
const newPasswordInput = document.querySelector('#new-password-input');
const changePasswordButton = document.querySelector('#change-password-button');
const form = document.querySelector('#todo-form');
const input = document.querySelector('#todo-input');
const dueDateInput = document.querySelector('#due-date-input');
const priorityInput = document.querySelector('#priority-input');
const priorityChips = [...document.querySelectorAll('.priority-chips button')];
const list = document.querySelector('#todo-list');
const template = document.querySelector('#todo-template');
const count = document.querySelector('#todo-count');
const emptyState = document.querySelector('#empty-state');
const clearCompleted = document.querySelector('#clear-completed');
const filterButtons = [...document.querySelectorAll('.filter')];
const storageError = document.querySelector('#storage-error');
const pondMessage = document.querySelector('#pond-message');
const stockPond = document.querySelector('#stock-pond');
const releaseDemo = document.querySelector('#release-demo');
const pastePond = document.querySelector('#paste-pond');
const pastePanel = document.querySelector('#paste-panel');
const pasteInput = document.querySelector('#paste-input');
const pastePreview = document.querySelector('#paste-preview');
const addPastedTasks = document.querySelector('#add-pasted-tasks');
const clearPaste = document.querySelector('#clear-paste');
const cancelPaste = document.querySelector('#cancel-paste');
const copyPondReport = document.querySelector('#copy-pond-report');
const pondHealthToggle = document.querySelector('#pond-health-toggle');
const pondHealthPanel = document.querySelector('#pond-health-panel');
const pondHealthSummary = document.querySelector('#pond-health-summary');
const pondHealthMetrics = document.querySelector('#pond-health-metrics');
const pondHealthHints = document.querySelector('#pond-health-hints');
const copyPondDiagnostics = document.querySelector('#copy-pond-diagnostics');
const showPondTour = document.querySelector('#show-pond-tour');
const shortcutHelpToggle = document.querySelector('#shortcut-help-toggle');
const shortcutHelp = document.querySelector('#shortcut-help');
const shortcutHelpClose = document.querySelector('#shortcut-help-close');
const castNet = document.querySelector('#cast-net');
const releaseSelected = document.querySelector('#release-selected');
const shoalControl = document.querySelector('#shoal-control');
const shoalPriority = document.querySelector('#shoal-priority');
const moveShoal = document.querySelector('#move-shoal');
const pondTour = document.querySelector('#pond-tour');
const tourAddTask = document.querySelector('#tour-add-task');
const tourStockDemo = document.querySelector('#tour-stock-demo');
const tourPastePond = document.querySelector('#tour-paste-pond');
const tourTideMode = document.querySelector('#tour-tide-mode');
const tourCopyReport = document.querySelector('#tour-copy-report');
const dismissPondTour = document.querySelector('#dismiss-pond-tour');
const focusPanel = document.querySelector('#focus-panel');
const focusTitle = document.querySelector('#focus-title');
const focusMeta = document.querySelector('#focus-meta');
const focusSprintStatus = document.querySelector('#focus-sprint-status');
const focusSprintPresets = [...document.querySelectorAll('.focus-sprint-preset')];
const startFocusSprint = document.querySelector('#start-focus-sprint');
const pauseFocusSprint = document.querySelector('#pause-focus-sprint');
const cancelFocusSprint = document.querySelector('#cancel-focus-sprint');
const completeFocusSprint = document.querySelector('#complete-focus-sprint');
const completeFocus = document.querySelector('#complete-focus');
const showcaseToggle = document.querySelector('#showcase-toggle');
const showcasePanel = document.querySelector('#showcase-panel');
const showcaseClose = document.querySelector('#showcase-close');
const showcaseBody = document.querySelector('#showcase-body');

const tideGroups = [
  { key: 'washed', label: 'Washed ashore', description: 'Active overdue fish looking sternly at you.' },
  { key: 'high', label: 'High tide', description: 'Active tasks due today or marked high priority.' },
  { key: 'ebbing', label: 'Ebbing', description: 'Active scheduled tasks due after today.' },
  { key: 'incoming', label: 'Incoming', description: 'Active unscheduled or low-pressure tasks.' },
  { key: 'completed', label: 'Resting shells', description: 'Completed tasks resting after the active work.' },
];

const celebrations = [
  'The task fish has been fed. Begrudgingly proud of you.',
  'One less barnacle on the hull.',
  'A productive splash has occurred.',
];

let authToken = loadAuthToken();
let currentUser = null;
let todos = [];
let filter = 'all';
let focusedTodoId = loadFocusedTodoId();
let tourDismissed = loadTourDismissed();
let tourForcedVisible = false;
let focusSprint = createFocusSprint();
let focusSprintTimerId = null;
let netMode = false;
let editingTodoId = '';
let pendingEditFocusId = '';
let pendingEditReturnId = '';
let selectedTodoIds = new Set();
let saveQueue = Promise.resolve();
let saveVersion = 0;
let lastUndoAction = null;
let lastSync = {
  state: 'never synced',
  at: '',
  message: 'No sync attempted yet.',
};
let lastRenderDuration = 0;
let renderDurations = [];

function diagnosticNow() {
  return window.performance?.now ? window.performance.now() : Date.now();
}

function markSyncState(state, message) {
  lastSync = {
    state,
    at: new Date().toISOString(),
    message,
  };
  renderPondHealth();
}

function recordRenderDuration(startTime) {
  lastRenderDuration = Math.max(0, diagnosticNow() - startTime);
  renderDurations = [...renderDurations.slice(-4), lastRenderDuration];
}

function averageRenderDuration() {
  if (renderDurations.length === 0) return 0;
  const total = renderDurations.reduce((sum, duration) => sum + duration, 0);
  return total / renderDurations.length;
}

function showStorageError(message) {
  storageError.textContent = message;
  storageError.hidden = false;
}

function clearStorageError() {
  storageError.textContent = '';
  storageError.hidden = true;
}

function clearUndoAction() {
  if (lastUndoAction?.timeoutId) window.clearTimeout(lastUndoAction.timeoutId);
  lastUndoAction = null;
}

function showPondMessage(message, options = {}) {
  if (!options.preserveUndo) clearUndoAction();

  pondMessage.replaceChildren(document.createTextNode(message));
  if (options.action) {
    pondMessage.append(document.createTextNode(' '));
    const actionButton = document.createElement('button');
    actionButton.type = 'button';
    actionButton.className = 'undo-action';
    actionButton.textContent = options.action.label;
    actionButton.addEventListener('click', options.action.onClick);
    pondMessage.append(actionButton);
  }
  pondMessage.hidden = false;
}

function hidePondMessage() {
  clearUndoAction();
  pondMessage.replaceChildren();
  pondMessage.hidden = true;
}

function todayKey() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

function addDays(dateKey, days) {
  const [year, month, day] = dateKey.split('-').map(Number);
  const date = new Date(year, month - 1, day + days);
  const nextMonth = String(date.getMonth() + 1).padStart(2, '0');
  const nextDay = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${nextMonth}-${nextDay}`;
}

function isValidDateKey(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

function formatDateKey(value) {
  if (!value) return 'No due date';
  const [year, month, day] = value.split('-').map(Number);
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(
    new Date(year, month - 1, day),
  );
}

function normalisePriority(priority) {
  return PRIORITIES.includes(priority) ? priority : 'medium';
}

function normaliseTimestamp(value) {
  return typeof value === 'string' && value && !Number.isNaN(Date.parse(value)) ? value : '';
}

function normaliseTodo(todo) {
  if (!todo || typeof todo !== 'object') return null;
  if (typeof todo.id !== 'string' || typeof todo.text !== 'string') return null;

  const id = todo.id.trim();
  const text = todo.text.trim().slice(0, MAX_TODO_LENGTH);
  if (!id || !text) return null;

  const createdAt = typeof todo.createdAt === 'string' && !Number.isNaN(Date.parse(todo.createdAt))
    ? todo.createdAt
    : new Date().toISOString();

  return {
    id,
    text,
    completed: Boolean(todo.completed),
    createdAt,
    dueDate: isValidDateKey(todo.dueDate) ? todo.dueDate : '',
    priority: normalisePriority(todo.priority),
    archivedAt: normaliseTimestamp(todo.archivedAt),
  };
}

function normaliseTodos(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map(normaliseTodo)
    .filter(Boolean)
    .slice(0, MAX_TODOS);
}

function loadAuthToken() {
  try {
    return localStorage.getItem(TOKEN_KEY) ?? '';
  } catch {
    return '';
  }
}

function saveAuthToken(value) {
  authToken = value;
  try {
    if (value) localStorage.setItem(TOKEN_KEY, value);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    showStorageError('Authentication changed, but could not be saved in this browser.');
  }
}

function loadFocusedTodoId() {
  try {
    return localStorage.getItem(FOCUS_KEY) ?? '';
  } catch {
    return '';
  }
}

function loadTourDismissed() {
  try {
    return localStorage.getItem(TOUR_DISMISSED_KEY) === 'true';
  } catch {
    return false;
  }
}

function loadFocusSprintMinutes() {
  try {
    const storedMinutes = Number(localStorage.getItem(SPRINT_LENGTH_KEY));
    return [15, 25].includes(storedMinutes) ? storedMinutes : DEFAULT_SPRINT_MINUTES;
  } catch {
    return DEFAULT_SPRINT_MINUTES;
  }
}

function saveFocusSprintMinutes(value) {
  try {
    localStorage.setItem(SPRINT_LENGTH_KEY, String(value));
  } catch {
    showStorageError('Focus sprint length changed, but could not be saved in this browser.');
  }
}

function createFocusSprint(minutes = loadFocusSprintMinutes()) {
  return {
    minutes,
    status: 'idle',
    todoId: '',
    endsAt: 0,
    remainingMs: minutes * 60 * 1000,
  };
}

function saveTourDismissed(value) {
  tourDismissed = value;
  try {
    if (value) localStorage.setItem(TOUR_DISMISSED_KEY, 'true');
    else localStorage.removeItem(TOUR_DISMISSED_KEY);
  } catch {
    showStorageError('Pond tour preference changed, but could not be saved in this browser.');
  }
}

function saveFocusedTodoId(value) {
  focusedTodoId = value;
  try {
    if (value) localStorage.setItem(FOCUS_KEY, value);
    else localStorage.removeItem(FOCUS_KEY);
  } catch {
    showStorageError('Focus mode changed in this tab, but could not be saved to this browser.');
  }
}

async function apiRequest(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      ...(options.headers || {}),
    },
  });
  if (response.status === 204) return null;
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || 'The server could not complete that request.');
  return body;
}

function saveTodos() {
  if (!authToken) {
    showStorageError('Log in or sign up before changing tasks.');
    return false;
  }

  const version = ++saveVersion;
  const snapshot = normaliseTodos(todos);
  markSyncState('syncing', 'Saving latest pond changes…');
  saveQueue = saveQueue
    .catch(() => {})
    .then(() => apiRequest('/api/tasks', {
      method: 'PUT',
      body: JSON.stringify({ todos: snapshot }),
    }))
    .then((body) => {
      if (version === saveVersion) {
        todos = normaliseTodos(body.todos);
        markSyncState('synced', 'Latest task save completed.');
        clearStorageError();
        render();
      }
    });

  saveQueue.catch((error) => {
    if (version === saveVersion) {
      markSyncState('sync error', error.message);
      showStorageError(`Tasks changed in this tab, but sync failed: ${error.message}`);
    }
  });
  return true;
}

function priorityRank(priority) {
  return { high: 0, medium: 1, low: 2 }[priority] ?? 1;
}

function sortTodos(items) {
  return [...items].sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    if ((a.dueDate || '9999-12-31') !== (b.dueDate || '9999-12-31')) {
      return (a.dueDate || '9999-12-31').localeCompare(b.dueDate || '9999-12-31');
    }
    if (priorityRank(a.priority) !== priorityRank(b.priority)) return priorityRank(a.priority) - priorityRank(b.priority);
    return Date.parse(b.createdAt) - Date.parse(a.createdAt);
  });
}

function sortArchivedTodos(items) {
  return [...items].sort((a, b) => Date.parse(b.archivedAt || 0) - Date.parse(a.archivedAt || 0));
}

function liveTodos() {
  return todos.filter((todo) => !todo.archivedAt);
}

function archivedTodos() {
  return sortArchivedTodos(todos.filter((todo) => todo.archivedAt));
}

function visibleTodos() {
  const live = liveTodos();
  if (filter === 'archive') return archivedTodos();
  if (filter === 'active') return sortTodos(live.filter((todo) => !todo.completed));
  if (filter === 'completed') return sortTodos(live.filter((todo) => todo.completed));
  if (filter === 'week') {
    const today = todayKey();
    const weekEnd = addDays(today, 6);
    return sortTodos(live.filter((todo) => !todo.completed && todo.dueDate && todo.dueDate <= weekEnd));
  }
  return sortTodos(live);
}

function ghostNetTodos() {
  const today = todayKey();
  const staleThresholdMs = GHOST_STALE_DAYS * 24 * 60 * 60 * 1000;
  const nowMs = Date.now();
  const active = liveTodos().filter((todo) => !todo.completed);
  const seen = new Set();
  const ghosts = [];
  function addIfNew(todo) {
    if (!seen.has(todo.id)) { seen.add(todo.id); ghosts.push(todo); }
  }
  active.filter((todo) => todo.dueDate && todo.dueDate < today).forEach(addIfNew);
  active.filter((todo) => !todo.dueDate && nowMs - Date.parse(todo.createdAt) > staleThresholdMs).forEach(addIfNew);
  active.filter((todo) => todo.priority === 'high' && nowMs - Date.parse(todo.createdAt) > staleThresholdMs).forEach(addIfNew);
  return sortTodos(ghosts);
}

function renderedTodoIds() {
  // tide renders all todos across groups (including completed); other filters match visibleTodos().
  if (filter === 'tide') return new Set(todos.map((todo) => todo.id));
  if (filter === 'ghost') return new Set(ghostNetTodos().map((todo) => todo.id));
  return new Set(visibleTodos().map((todo) => todo.id));
}

function tideFor(todo) {
  if (todo.completed) return 'completed';
  const today = todayKey();
  if (todo.dueDate && todo.dueDate < today) return 'washed';
  if (todo.dueDate === today || todo.priority === 'high') return 'high';
  if (todo.dueDate && todo.dueDate > today) return 'ebbing';
  return 'incoming';
}

function moodFor(todo) {
  const tide = tideFor(todo);
  if (todo.completed) return { emoji: '🐚', text: 'Resting shell', className: 'mood-resting' };
  if (tide === 'washed' && todo.priority === 'high') {
    return { emoji: '🦑', text: 'Tentacular emergency', className: 'mood-emergency' };
  }
  if (todo.priority === 'high') return { emoji: '🐡', text: 'Puffed up', className: 'mood-high' };
  if (!todo.dueDate) return { emoji: '🧜', text: 'Mythical commitment', className: 'mood-mythical' };
  if (todo.priority === 'medium') return { emoji: '🦀', text: 'Sideways but moving', className: 'mood-medium' };
  return { emoji: '🐟', text: 'Swimming nicely', className: 'mood-normal' };
}

function dueLabelFor(todo) {
  const today = todayKey();
  if (!todo.dueDate) return 'No due date';
  if (todo.dueDate < today) return `Overdue · ${formatDateKey(todo.dueDate)}`;
  if (todo.dueDate === today) return 'Due today';
  return `Due ${formatDateKey(todo.dueDate)}`;
}

function priorityLabelFor(todo) {
  return `${todo.priority[0].toUpperCase()}${todo.priority.slice(1)} priority`;
}

function pluralise(countValue, singular, plural = `${singular}s`) {
  return `${countValue} ${countValue === 1 ? singular : plural}`;
}

function dueSummary() {
  const today = todayKey();
  const activeTodos = liveTodos().filter((todo) => !todo.completed);
  const overdueCount = activeTodos.filter((todo) => todo.dueDate && todo.dueDate < today).length;
  const todayCount = activeTodos.filter((todo) => todo.dueDate === today).length;
  return [`${overdueCount} overdue`, `${todayCount} due today`];
}

function reportDueLabel(todo) {
  const today = todayKey();
  if (!todo.dueDate) return 'No due date';
  if (todo.dueDate < today) return `Overdue ${formatDateKey(todo.dueDate)}`;
  if (todo.dueDate === today) return 'Today';
  return formatDateKey(todo.dueDate);
}

function stripImportPrefix(line) {
  let text = line.trim().replace(/^>\s*/, '');
  text = text.replace(/^(?:[-*•]\s*)?\[(?:\s|x|X)\]\s*/, '');
  text = text.replace(/^(?:[-*•]\s+|\d+[.)]\s+)/, '');
  text = text.replace(/^\[(?:\s|x|X)\]\s*/, '');
  return text.trim();
}

function isImportHeading(text, originalLine) {
  if (!text || /^[\s\-*_–—=•#]+$/.test(text)) return true;
  if (/^#{1,6}\s+\S+/.test(originalLine.trim())) return true;
  return text.length <= 48 && /:$/.test(text) && !/\bdue:\d{4}-\d{2}-\d{2}\b/i.test(text);
}

function parseImportLine(line) {
  let text = stripImportPrefix(line);
  if (isImportHeading(text, line)) return null;

  const dueMatch = text.match(/\bdue:\s*(\d{4}-\d{2}-\d{2})\b/i);
  const dueDate = dueMatch && isValidDateKey(dueMatch[1]) ? dueMatch[1] : '';
  text = text.replace(/\bdue:\s*\d{4}-\d{2}-\d{2}\b/ig, '').trim();

  let priority = 'medium';
  const bracketPriority = text.match(/\[(high|medium|low)\]/i);
  const namedPriority = text.match(/\bpriority:\s*(high|medium|low)\b/i);
  if (bracketPriority) priority = normalisePriority(bracketPriority[1].toLowerCase());
  else if (namedPriority) priority = normalisePriority(namedPriority[1].toLowerCase());

  text = text
    .replace(/\[(high|medium|low)\]/ig, '')
    .replace(/\bpriority:\s*(high|medium|low)\b/ig, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  if (!text) return null;
  return { text, priority, dueDate };
}

function parsePastedTodos(value) {
  return value
    .split(/\r?\n/)
    .map(parseImportLine)
    .filter(Boolean);
}

function pastedTodoPreview() {
  const remainingSlots = Math.max(0, MAX_TODOS - todos.length);
  return parsePastedTodos(pasteInput.value).slice(0, remainingSlots);
}

function updatePastePreview() {
  const parsedCount = parsePastedTodos(pasteInput.value).length;
  const remainingSlots = Math.max(0, MAX_TODOS - todos.length);
  const importableCount = Math.min(parsedCount, remainingSlots);

  if (remainingSlots === 0) {
    pastePreview.textContent = `The pond is full at ${MAX_TODOS} tasks. Release a fish before importing.`;
  } else if (parsedCount === 0) {
    pastePreview.textContent = 'Paste notes to preview tasks. Supported: bullets, checkboxes, [high]/[medium]/[low], and due:YYYY-MM-DD.';
  } else if (parsedCount > remainingSlots) {
    pastePreview.textContent = `${parsedCount} task lines found; ${importableCount} will be added because the pond has ${remainingSlots} open ${remainingSlots === 1 ? 'slot' : 'slots'}.`;
  } else {
    pastePreview.textContent = `${pluralise(importableCount, 'task')} ready to add.`;
  }

  addPastedTasks.disabled = !currentUser || importableCount === 0;
}

function setPastePanelOpen(open) {
  pastePanel.hidden = !open;
  pastePond.setAttribute('aria-expanded', String(open));
  if (open) {
    updatePastePreview();
    pasteInput.focus();
  }
}

function setShortcutHelpOpen(open) {
  shortcutHelp.hidden = !open;
  shortcutHelpToggle.setAttribute('aria-expanded', String(open));
}

function syncPriorityChips() {
  priorityChips.forEach((chip) => {
    chip.setAttribute('aria-pressed', String(chip.dataset.priority === priorityInput.value));
  });
}

function setDraftPriority(priority) {
  if (!PRIORITIES.includes(priority)) return;
  priorityInput.value = priority;
  syncPriorityChips();
  showPondMessage(priority[0].toUpperCase() + priority.slice(1) + ' tide selected for the next fish.');
}

function toggleShortcutHelp() {
  setShortcutHelpOpen(shortcutHelp.hidden);
}

function clearPasteInput() {
  pasteInput.value = '';
  updatePastePreview();
  pasteInput.focus();
}

function importPastedTodos() {
  if (!currentUser) return;

  const imported = pastedTodoPreview()
    .map((todo, index) => normaliseTodo({
      id: crypto.randomUUID(),
      text: todo.text,
      completed: false,
      createdAt: new Date(Date.now() - index).toISOString(),
      dueDate: todo.dueDate,
      priority: todo.priority,
    }))
    .filter(Boolean);

  if (imported.length === 0) {
    updatePastePreview();
    return;
  }

  todos = [...imported, ...todos].slice(0, MAX_TODOS);
  pasteInput.value = '';
  saveTodos();
  showPondMessage(`Added ${pluralise(imported.length, 'pasted fish', 'pasted fish')} to the pond.`);
  setPastePanelOpen(false);
  render();
}

function buildPondReport() {
  const visiblePond = liveTodos();
  const totalCount = visiblePond.length;
  const activeTodos = visiblePond.filter((todo) => !todo.completed);
  const completedCount = visiblePond.filter((todo) => todo.completed).length;
  const lines = [];

  if (totalCount === 0) {
    lines.push('Pond report: no tasks in the pond yet.');
    return lines.join('\n');
  }

  const dueCounts = dueSummary();
  const headlineParts = [
    `${pluralise(totalCount, 'task')}`,
    `${activeTodos.length} active`,
    `${completedCount} completed`,
    ...dueCounts,
  ];
  lines.push(`Pond report: ${headlineParts.join(' — ')}.`);

  const focusedTodo = activeTodos.find((todo) => todo.id === focusedTodoId);
  if (focusedTodo) lines.push(`Focus fish: ${focusedTodo.text}.`);

  const highPriorityTodos = sortTodos(activeTodos.filter((todo) => todo.priority === 'high')).slice(0, 3);
  if (highPriorityTodos.length > 0) {
    lines.push('High-priority active:');
    highPriorityTodos.forEach((todo) => lines.push(`• ${todo.text}`));
  }

  const nextDueTodos = sortTodos(activeTodos.filter((todo) => todo.dueDate)).slice(0, 3);
  if (nextDueTodos.length > 0) {
    lines.push('Next due:');
    nextDueTodos.forEach((todo) => {
      lines.push(`• ${reportDueLabel(todo)} · ${todo.priority} · ${todo.text}`);
    });
  }

  return lines.join('\n');
}

function tideCounts() {
  return tideGroups.reduce((counts, group) => ({
    ...counts,
    [group.key]: liveTodos().filter((todo) => tideFor(todo) === group.key).length,
  }), {});
}

function visibleTodoCount() {
  if (filter === 'tide') return liveTodos().length;
  if (filter === 'ghost') return ghostNetTodos().length;
  return visibleTodos().length;
}

function pondDiagnostics() {
  const activeCount = liveTodos().filter((todo) => !todo.completed).length;
  const completedCount = liveTodos().length - activeCount;
  const tides = tideCounts();
  const averageRender = averageRenderDuration();

  return {
    totalCount: liveTodos().length,
    activeCount,
    completedCount,
    archivedCount: archivedTodos().length,
    visibleCount: visibleTodoCount(),
    selectedCount: selectedTodoIds.size,
    filter,
    netMode,
    focusedTaskPresent: liveTodos().some((todo) => todo.id === focusedTodoId && !todo.completed),
    tides,
    sync: lastSync,
    lastRenderDuration,
    averageRender,
    timestamp: new Date().toISOString(),
  };
}

function diagnosticHints(diagnostics) {
  const hints = [];
  if (diagnostics.totalCount === 0) hints.push('The pond is empty; add or stock tasks to exercise rendering and sync.');
  if (diagnostics.totalCount >= Math.floor(MAX_TODOS * 0.8)) hints.push(`Large pond: ${diagnostics.totalCount}/${MAX_TODOS} task slots are in use.`);
  if (diagnostics.averageRender > 80) hints.push(`Slow render hint: recent renders average ${diagnostics.averageRender.toFixed(1)} ms.`);
  if (diagnostics.sync.state === 'sync error') hints.push(`Last sync failed: ${diagnostics.sync.message}`);
  if (diagnostics.sync.state === 'syncing') hints.push('Sync is currently in progress.');
  if (hints.length === 0) hints.push('No obvious health warnings.');
  return hints;
}

function syncLabel(sync) {
  const when = sync.at ? new Date(sync.at).toLocaleString() : 'not recorded';
  return `${sync.state} · ${sync.message} · ${when}`;
}

function renderMetric(label, value) {
  const item = document.createElement('div');
  const term = document.createElement('dt');
  const description = document.createElement('dd');
  term.textContent = label;
  description.textContent = value;
  item.append(term, description);
  pondHealthMetrics.append(item);
}

function renderPondHealth() {
  if (pondHealthPanel.hidden) return;

  const diagnostics = pondDiagnostics();
  const hints = diagnosticHints(diagnostics);
  pondHealthSummary.textContent = hints.some((hint) => hint.includes('failed') || hint.includes('Slow') || hint.includes('Large'))
    ? 'Pond health needs attention.'
    : 'Pond health looks steady.';

  pondHealthMetrics.replaceChildren();
  renderMetric('Tasks', `${diagnostics.totalCount} total · ${diagnostics.activeCount} active · ${diagnostics.completedCount} completed`);
  renderMetric('Archive', `${diagnostics.archivedCount} reefed fish`);
  renderMetric('Current view', `${diagnostics.filter} · ${diagnostics.visibleCount} visible`);
  renderMetric('Net', diagnostics.netMode ? `${diagnostics.selectedCount} selected` : 'not cast');
  renderMetric('Focus', diagnostics.focusedTaskPresent ? 'active focus fish' : 'none');
  renderMetric('Tide lanes', `washed ${diagnostics.tides.washed} · high ${diagnostics.tides.high} · ebbing ${diagnostics.tides.ebbing} · incoming ${diagnostics.tides.incoming} · resting ${diagnostics.tides.completed}`);
  renderMetric('Sync', syncLabel(diagnostics.sync));
  renderMetric('Render', `${diagnostics.lastRenderDuration.toFixed(1)} ms last · ${diagnostics.averageRender.toFixed(1)} ms avg`);

  pondHealthHints.replaceChildren();
  hints.forEach((hint) => {
    const item = document.createElement('li');
    item.textContent = hint;
    pondHealthHints.append(item);
  });
}

function buildPondDiagnostics() {
  const diagnostics = pondDiagnostics();
  const hints = diagnosticHints(diagnostics);
  return [
    'Pond health diagnostics',
    `Timestamp: ${diagnostics.timestamp}`,
    `Tasks: ${diagnostics.totalCount} total, ${diagnostics.activeCount} active, ${diagnostics.completedCount} completed, ${diagnostics.visibleCount} visible, ${diagnostics.archivedCount} archived`,
    `View: filter=${diagnostics.filter}, net=${diagnostics.netMode ? 'cast' : 'not cast'}, selected=${diagnostics.selectedCount}, focus=${diagnostics.focusedTaskPresent ? 'present' : 'none'}`,
    `Tide lanes: washed=${diagnostics.tides.washed}, high=${diagnostics.tides.high}, ebbing=${diagnostics.tides.ebbing}, incoming=${diagnostics.tides.incoming}, resting=${diagnostics.tides.completed}`,
    `Sync: ${diagnostics.sync.state}; ${diagnostics.sync.message}; at=${diagnostics.sync.at || 'not recorded'}`,
    `Render: last=${diagnostics.lastRenderDuration.toFixed(1)}ms, average=${diagnostics.averageRender.toFixed(1)}ms`,
    `Hints: ${hints.join(' | ')}`,
  ].join('\n');
}

async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.top = '-1000px';
  textarea.style.opacity = '0';
  document.body.append(textarea);
  textarea.select();
  try {
    if (!document.execCommand('copy')) throw new Error('copy command was rejected');
  } finally {
    textarea.remove();
  }
}

async function copyPondProgressReport() {
  try {
    await copyText(buildPondReport());
    showPondMessage('Copied a Slack-friendly pond report to the clipboard.');
  } catch {
    showPondMessage('Could not copy the pond report. Select the tasks and try again?');
  }
}

async function copyDiagnosticsReport() {
  try {
    await copyText(buildPondDiagnostics());
    showPondMessage('Copied pond diagnostics without task text or private account data.');
  } catch {
    showPondMessage('Could not copy diagnostics. The panel still shows the same safe summary.');
  }
}

function setPondHealthOpen(open) {
  pondHealthPanel.hidden = !open;
  pondHealthToggle.setAttribute('aria-expanded', String(open));
  if (open) renderPondHealth();
}

function makeShowcaseSection(title) {
  const section = document.createElement('div');
  section.className = 'showcase-section';
  const heading = document.createElement('h3');
  heading.textContent = title;
  section.append(heading);
  return section;
}

function renderShowcase() {
  if (showcasePanel.hidden) return;

  const today = todayKey();
  const live = liveTodos();
  const activeTodos = live.filter((t) => !t.completed);
  const completedCount = live.filter((t) => t.completed).length;
  const completionPct = live.length > 0 ? Math.round((completedCount / live.length) * 100) : 0;
  const focusedTodo = activeTodos.find((t) => t.id === focusedTodoId);

  const urgentAll = sortTodos(activeTodos.filter((t) =>
    t.priority === 'high' || (t.dueDate && t.dueDate <= today)));
  const urgentShown = urgentAll.slice(0, 5);

  showcaseBody.replaceChildren();

  const feedSection = makeShowcaseSection('Now feeding');
  if (focusedTodo) {
    const mood = moodFor(focusedTodo);
    const card = document.createElement('div');
    card.className = 'showcase-card';
    const moodEl = document.createElement('p');
    moodEl.className = `showcase-mood ${mood.className}`;
    moodEl.textContent = `${mood.emoji} ${mood.text}`;
    const textEl = document.createElement('p');
    textEl.className = 'showcase-task-text';
    textEl.textContent = focusedTodo.text;
    const metaEl = document.createElement('p');
    metaEl.className = 'showcase-task-meta';
    metaEl.textContent = `${dueLabelFor(focusedTodo)} · ${priorityLabelFor(focusedTodo)}`;
    card.append(moodEl, textEl, metaEl);
    feedSection.append(card);
  } else {
    const hint = document.createElement('p');
    hint.className = 'showcase-hint';
    hint.textContent = currentUser
      ? 'No focus fish selected. Use Feed on any task to pick one.'
      : 'Sign in to see your focus fish here.';
    feedSection.append(hint);
  }
  showcaseBody.append(feedSection);

  const urgentSection = makeShowcaseSection('High tide');
  if (urgentShown.length > 0) {
    const taskList = document.createElement('ul');
    taskList.className = 'showcase-task-list';
    urgentShown.forEach((t) => {
      const item = document.createElement('li');
      item.className = 'showcase-task-item';
      const mood = moodFor(t);
      const textEl = document.createElement('span');
      textEl.className = 'showcase-task-text';
      textEl.textContent = t.text;
      const metaEl = document.createElement('span');
      metaEl.className = 'showcase-task-meta';
      metaEl.textContent = `${mood.emoji} ${dueLabelFor(t)} · ${priorityLabelFor(t)}`;
      item.append(textEl, metaEl);
      taskList.append(item);
    });
    urgentSection.append(taskList);
    if (urgentAll.length > 5) {
      const hint = document.createElement('p');
      hint.className = 'showcase-hint';
      hint.textContent = `+${urgentAll.length - 5} more high-tide tasks`;
      urgentSection.append(hint);
    }
  } else {
    const hint = document.createElement('p');
    hint.className = 'showcase-hint';
    hint.textContent = 'No urgent or overdue fish. Clear waters!';
    urgentSection.append(hint);
  }
  showcaseBody.append(urgentSection);

  const lanesSection = makeShowcaseSection('Shoal snapshot');
  const lanesEl = document.createElement('div');
  lanesEl.className = 'showcase-lanes';
  tideGroups.forEach((group) => {
    const cnt = live.filter((t) => tideFor(t) === group.key).length;
    if (cnt === 0) return;
    const lane = document.createElement('div');
    lane.className = 'showcase-lane';
    lane.dataset.tideGroup = group.key;
    const cntEl = document.createElement('span');
    cntEl.className = 'showcase-lane-count';
    cntEl.textContent = cnt;
    const lblEl = document.createElement('span');
    lblEl.className = 'showcase-lane-label';
    lblEl.textContent = group.label;
    lane.append(cntEl, lblEl);
    lanesEl.append(lane);
  });
  if (!lanesEl.children.length) {
    const hint = document.createElement('p');
    hint.className = 'showcase-hint';
    hint.textContent = 'The pond is empty. Add tasks to see tide lanes.';
    lanesSection.append(hint);
  } else {
    lanesSection.append(lanesEl);
  }
  showcaseBody.append(lanesSection);

  const statsSection = makeShowcaseSection('Clear waters');
  const statsEl = document.createElement('div');
  statsEl.className = 'showcase-stats';
  [
    { value: String(live.length), label: 'tasks' },
    { value: String(activeTodos.length), label: 'active' },
    { value: String(completedCount), label: 'completed' },
    { value: `${completionPct}%`, label: 'done' },
  ].forEach(({ value, label }) => {
    const stat = document.createElement('div');
    stat.className = 'showcase-stat';
    const valEl = document.createElement('span');
    valEl.className = 'showcase-stat-value';
    valEl.textContent = value;
    const lblEl = document.createElement('span');
    lblEl.className = 'showcase-stat-label';
    lblEl.textContent = label;
    stat.append(valEl, lblEl);
    statsEl.append(stat);
  });
  statsSection.append(statsEl);
  showcaseBody.append(statsSection);
}

function setShowcaseOpen(open) {
  showcasePanel.hidden = !open;
  showcaseToggle.setAttribute('aria-expanded', String(open));
  if (open) {
    renderShowcase();
    showcasePanel.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
}

function createEditField(labelText, control) {
  const label = document.createElement('label');
  const labelSpan = document.createElement('span');
  labelSpan.textContent = labelText;
  label.append(labelSpan, control);
  return label;
}

function createTodoEditForm(todo) {
  const formElement = document.createElement('form');
  formElement.className = 'edit-task-form';
  formElement.noValidate = true;

  const textInput = document.createElement('input');
  textInput.className = 'edit-task-text';
  textInput.name = 'text';
  textInput.type = 'text';
  textInput.maxLength = MAX_TODO_LENGTH;
  textInput.required = true;
  textInput.value = todo.text;

  const dueInput = document.createElement('input');
  dueInput.name = 'dueDate';
  dueInput.type = 'date';
  dueInput.value = todo.dueDate;

  const prioritySelect = document.createElement('select');
  prioritySelect.name = 'priority';
  [
    ['low', 'Low tide'],
    ['medium', 'Medium tide'],
    ['high', 'High tide'],
  ].forEach(([value, label]) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    prioritySelect.append(option);
  });
  prioritySelect.value = todo.priority;

  const actions = document.createElement('div');
  actions.className = 'edit-task-actions';
  const saveButton = document.createElement('button');
  saveButton.type = 'submit';
  saveButton.textContent = 'Save';
  const cancelButton = document.createElement('button');
  cancelButton.type = 'button';
  cancelButton.className = 'secondary-action';
  cancelButton.textContent = 'Cancel';
  actions.append(saveButton, cancelButton);

  formElement.append(
    createEditField('Task', textInput),
    createEditField('Due date', dueInput),
    createEditField('Priority', prioritySelect),
    actions,
  );

  formElement.addEventListener('submit', (event) => {
    event.preventDefault();
    saveEditedTodo(todo.id, {
      text: textInput.value,
      dueDate: dueInput.value,
      priority: prioritySelect.value,
    });
  });
  formElement.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      cancelEditingTodo();
    }
  });
  cancelButton.addEventListener('click', cancelEditingTodo);

  return formElement;
}

function createTodoItem(todo) {
  const item = template.content.firstElementChild.cloneNode(true);
  const netSelect = item.querySelector('.net-select');
  const checkbox = item.querySelector('.toggle');
  const text = item.querySelector('.text');
  const moodBadge = item.querySelector('.mood-badge');
  const dueLabel = item.querySelector('.due-label');
  const priorityLabel = item.querySelector('.priority-label');
  const focusButton = item.querySelector('.focus-task');
  const editButton = item.querySelector('.edit-task');
  const archiveButton = item.querySelector('.archive-task');
  const restoreButton = item.querySelector('.restore-task');
  const deleteButton = item.querySelector('.delete');
  const mood = moodFor(todo);
  const tide = tideFor(todo);
  const isArchived = Boolean(todo.archivedAt);

  item.classList.toggle('completed', todo.completed);
  item.classList.toggle('archived', isArchived);
  item.classList.toggle('focused', todo.id === focusedTodoId);
  item.classList.toggle('editing', todo.id === editingTodoId);
  item.dataset.priority = todo.priority;
  item.dataset.tide = tide;
  item.dataset.todoId = todo.id;
  item.classList.toggle('net-mode', netMode);
  netSelect.hidden = !netMode || isArchived;
  netSelect.checked = selectedTodoIds.has(todo.id);
  netSelect.disabled = todo.id === editingTodoId || isArchived;
  netSelect.setAttribute('aria-label', `Select ${todo.text}`);
  checkbox.checked = todo.completed;
  checkbox.disabled = todo.id === editingTodoId || isArchived;
  text.textContent = todo.text;
  moodBadge.textContent = `${mood.emoji} ${mood.text}`;
  moodBadge.classList.add(mood.className);
  moodBadge.setAttribute('aria-label', `Mood: ${mood.text}`);
  dueLabel.textContent = dueLabelFor(todo);
  priorityLabel.textContent = priorityLabelFor(todo);
  focusButton.hidden = isArchived;
  focusButton.disabled = todo.completed || todo.id === editingTodoId || isArchived;
  focusButton.textContent = todo.id === focusedTodoId ? 'Feeding' : 'Feed';
  focusButton.setAttribute('aria-label', `Feed ${todo.text}`);
  editButton.hidden = isArchived;
  editButton.disabled = todo.id === editingTodoId;
  editButton.setAttribute('aria-label', `Edit ${todo.text}`);
  archiveButton.hidden = isArchived || !todo.completed;
  archiveButton.setAttribute('aria-label', `Archive ${todo.text}`);
  restoreButton.hidden = !isArchived;
  restoreButton.setAttribute('aria-label', `Restore ${todo.text}`);
  deleteButton.setAttribute('aria-label', isArchived ? `Permanently release ${todo.text}` : `Delete ${todo.text}`);

  if (todo.id === editingTodoId) {
    const editForm = createTodoEditForm(todo);
    item.append(editForm);
  }

  netSelect.addEventListener('change', () => toggleSelectedTodo(todo.id));
  checkbox.addEventListener('change', () => toggleTodo(todo.id));
  focusButton.addEventListener('click', () => focusTodo(todo.id));
  editButton.addEventListener('click', () => startEditingTodo(todo.id));
  archiveButton.addEventListener('click', () => archiveTodo(todo.id));
  restoreButton.addEventListener('click', () => restoreArchivedTodo(todo.id));
  deleteButton.addEventListener('click', () => deleteTodo(todo.id));

  return item;
}

function weekAheadGroups() {
  const today = todayKey();
  const activeDueTodos = sortTodos(liveTodos().filter((todo) => !todo.completed && todo.dueDate));
  const groups = [
    {
      key: 'overdue',
      label: 'Overdue',
      description: 'Fish already washed ashore and needing attention.',
      todos: activeDueTodos.filter((todo) => todo.dueDate < today),
    },
    ...Array.from({ length: 7 }, (_, index) => {
      const dateKey = addDays(today, index);
      return {
        key: dateKey,
        label: index === 0 ? 'Today' : index === 1 ? 'Tomorrow' : formatDateKey(dateKey),
        description: index === 0 ? 'Tasks due before the tide turns tonight.' : `Tasks due ${formatDateKey(dateKey)}.`,
        todos: activeDueTodos.filter((todo) => todo.dueDate === dateKey),
      };
    }),
  ];
  return groups.filter((group) => group.todos.length > 0);
}

function renderWeekAhead() {
  const groups = weekAheadGroups();

  if (groups.length === 0) {
    const emptyItem = document.createElement('li');
    emptyItem.className = 'week-group week-group-empty';
    const heading = document.createElement('h3');
    heading.textContent = 'Clear waters ahead';
    const description = document.createElement('p');
    description.textContent = 'No active due-date tasks in the next seven days. Add due dates to plan the pond.';
    emptyItem.append(heading, description);
    list.append(emptyItem);
    return;
  }

  for (const group of groups) {
    const groupItem = document.createElement('li');
    groupItem.className = 'week-group';
    groupItem.dataset.weekGroup = group.key === 'overdue' ? 'overdue' : 'upcoming';

    const heading = document.createElement('h3');
    heading.textContent = `${group.label} (${group.todos.length})`;
    groupItem.append(heading);

    const description = document.createElement('p');
    description.textContent = group.description;
    groupItem.append(description);

    const nestedList = document.createElement('ul');
    nestedList.className = 'todo-list week-list';
    group.todos.forEach((todo) => nestedList.append(createTodoItem(todo)));
    groupItem.append(nestedList);

    list.append(groupItem);
  }
}

function renderTideMode() {
  const sortedTodos = sortTodos(todos);
  const populatedGroups = tideGroups
    .map((group) => ({ ...group, todos: sortedTodos.filter((todo) => tideFor(todo) === group.key) }))
    .filter((group) => group.todos.length > 0);

  if (populatedGroups.length === 0) {
    const emptyItem = document.createElement('li');
    emptyItem.className = 'tide-group tide-group-empty';
    const heading = document.createElement('h3');
    heading.textContent = 'Still waters (0)';
    const description = document.createElement('p');
    description.textContent = 'No tasks in the pond yet. Add one above or stock the pond with demo fish.';
    emptyItem.append(heading, description);
    list.append(emptyItem);
    return;
  }

  for (const group of populatedGroups) {
    const groupItem = document.createElement('li');
    groupItem.className = 'tide-group';
    groupItem.dataset.tideGroup = group.key;

    const heading = document.createElement('h3');
    heading.textContent = `${group.label} (${group.todos.length})`;
    groupItem.append(heading);

    const description = document.createElement('p');
    description.textContent = group.description;
    groupItem.append(description);

    const nestedList = document.createElement('ul');
    nestedList.className = 'todo-list tide-list';
    group.todos.forEach((todo) => nestedList.append(createTodoItem(todo)));
    groupItem.append(nestedList);

    list.append(groupItem);
  }
}

function renderNetControls() {
  const selectedCount = selectedTodoIds.size;
  castNet.textContent = netMode ? 'Haul net in' : 'Cast net';
  releaseSelected.hidden = !netMode;
  shoalControl.hidden = !netMode;
  releaseSelected.disabled = !currentUser || selectedCount === 0;
  moveShoal.disabled = !currentUser || selectedCount === 0;
  releaseSelected.textContent = selectedCount > 0 ? `Release selected (${selectedCount})` : 'Release selected';
}

function renderTourPanel() {
  const shouldAutoShow = Boolean(currentUser) && todos.length === 0 && !tourDismissed;
  const shouldShow = Boolean(currentUser) && (tourForcedVisible || shouldAutoShow);
  pondTour.hidden = !shouldShow;
  showPondTour.hidden = !currentUser || shouldShow;
  [tourAddTask, tourStockDemo, tourPastePond, tourTideMode, tourCopyReport, dismissPondTour]
    .forEach((button) => {
      button.disabled = !currentUser;
    });
  if (shouldAutoShow) saveTourDismissed(true);
}

function formatSprintTime(ms) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes + ':' + String(seconds).padStart(2, '0');
}

function selectedFocusTodo() {
  return todos.find((todo) => todo.id === focusedTodoId && !todo.completed);
}

function setFocusSprintTimer(active) {
  if (focusSprintTimerId) {
    window.clearInterval(focusSprintTimerId);
    focusSprintTimerId = null;
  }
  if (active) focusSprintTimerId = window.setInterval(tickFocusSprint, 1000);
}

function resetFocusSprint(todoId = focusedTodoId) {
  setFocusSprintTimer(false);
  focusSprint = createFocusSprint(focusSprint.minutes);
  focusSprint.todoId = todoId;
}

function syncFocusSprintWithSelection() {
  const focusedTodo = selectedFocusTodo();
  if (!focusedTodo) {
    resetFocusSprint('');
    return;
  }
  if (focusSprint.todoId && focusSprint.todoId !== focusedTodo.id) resetFocusSprint(focusedTodo.id);
  else if (!focusSprint.todoId) focusSprint.todoId = focusedTodo.id;
}

function renderFocusSprint() {
  const focusedTodo = selectedFocusTodo();
  const hasFocus = Boolean(focusedTodo);
  const isRunning = focusSprint.status === 'running';
  const isPaused = focusSprint.status === 'paused';
  const isFinished = focusSprint.status === 'finished';
  const remaining = isRunning ? Math.max(0, focusSprint.endsAt - Date.now()) : focusSprint.remainingMs;

  focusSprintPresets.forEach((button) => {
    const minutes = Number(button.dataset.sprintMinutes);
    button.classList.toggle('active', minutes === focusSprint.minutes);
    button.setAttribute('aria-pressed', String(minutes === focusSprint.minutes));
    button.disabled = !hasFocus || isRunning;
  });

  startFocusSprint.disabled = !hasFocus || isRunning || isFinished;
  startFocusSprint.textContent = isPaused ? 'Resume sprint' : 'Start sprint';
  pauseFocusSprint.disabled = !hasFocus || !isRunning;
  cancelFocusSprint.disabled = !hasFocus || focusSprint.status === 'idle';
  completeFocusSprint.hidden = !isFinished;
  completeFocusSprint.disabled = !hasFocus || !isFinished;

  if (!hasFocus) {
    focusSprintStatus.textContent = 'Pick a fish to start a focus sprint.';
  } else if (isFinished) {
    focusSprintStatus.textContent = 'Sprint complete. Mark this fish fed when you are ready.';
  } else if (isRunning) {
    focusSprintStatus.textContent = formatSprintTime(remaining) + ' left in this sprint.';
  } else if (isPaused) {
    focusSprintStatus.textContent = formatSprintTime(remaining) + ' paused.';
  } else {
    focusSprintStatus.textContent = focusSprint.minutes + ' minute sprint ready.';
  }
}

function selectFocusSprintLength(minutes) {
  if (focusSprint.status === 'running') return;
  focusSprint = createFocusSprint(minutes);
  focusSprint.todoId = focusedTodoId;
  saveFocusSprintMinutes(minutes);
  renderFocusSprint();
}

function startOrResumeFocusSprint() {
  const focusedTodo = selectedFocusTodo();
  if (!focusedTodo || focusSprint.status === 'running' || focusSprint.status === 'finished') return;
  focusSprint.todoId = focusedTodo.id;
  focusSprint.status = 'running';
  focusSprint.endsAt = Date.now() + focusSprint.remainingMs;
  setFocusSprintTimer(true);
  renderFocusSprint();
  showPondMessage('Focus sprint started for ' + focusedTodo.text + '.');
}

function pauseCurrentFocusSprint() {
  if (focusSprint.status !== 'running') return;
  focusSprint.remainingMs = Math.max(0, focusSprint.endsAt - Date.now());
  focusSprint.status = 'paused';
  focusSprint.endsAt = 0;
  setFocusSprintTimer(false);
  renderFocusSprint();
  showPondMessage('Focus sprint paused.');
}

function cancelCurrentFocusSprint(message = 'Focus sprint cancelled.') {
  const hadActiveSprint = focusSprint.status !== 'idle';
  resetFocusSprint(focusedTodoId);
  renderFocusSprint();
  if (hadActiveSprint && message) showPondMessage(message);
}

function finishFocusSprint() {
  focusSprint.status = 'finished';
  focusSprint.remainingMs = 0;
  focusSprint.endsAt = 0;
  setFocusSprintTimer(false);
  renderFocusSprint();
  showPondMessage('Focus sprint complete. Nice steady swimming.');
}

function tickFocusSprint() {
  if (focusSprint.status !== 'running') return;
  if (!selectedFocusTodo() || focusSprint.todoId !== focusedTodoId) {
    cancelCurrentFocusSprint('Focus sprint cancelled because the selected fish changed.');
    return;
  }
  const remaining = focusSprint.endsAt - Date.now();
  if (remaining <= 0) {
    finishFocusSprint();
    return;
  }
  renderFocusSprint();
}

function completeSprintFocusedTodo() {
  if (focusSprint.status !== 'finished') return;
  completeFocusedTodo();
}

function renderFocusPanel() {
  const focusedTodo = selectedFocusTodo();
  syncFocusSprintWithSelection();
  if (!focusedTodo) {
    saveFocusedTodoId('');
    focusPanel.hidden = true;
    renderFocusSprint();
    return;
  }

  focusPanel.hidden = false;
  focusTitle.textContent = focusedTodo.text;
  focusMeta.textContent = `${moodFor(focusedTodo).text} · ${dueLabelFor(focusedTodo)} · ${priorityLabelFor(focusedTodo)}`;
  renderFocusSprint();
}

function renderAuth() {
  const signedIn = Boolean(currentUser);
  authPanel.classList.toggle('signed-in', signedIn);
  authTitle.textContent = signedIn ? 'Account' : 'Sign in to sync tasks';
  authStatus.textContent = signedIn
    ? `Signed in as ${currentUser.username}. Your tasks sync to the backend.`
    : 'Create an account or log in to load your TODO pond.';
  logoutButton.hidden = !signedIn;
  usernameInput.disabled = signedIn;
  passwordInput.disabled = signedIn;
  form.classList.toggle('disabled', !signedIn);
  [...form.elements].forEach((element) => {
    element.disabled = !signedIn;
  });
  passwordForm.hidden = !signedIn;
  [...passwordForm.elements].forEach((element) => {
    element.disabled = !signedIn;
  });
  stockPond.disabled = !signedIn;
  pastePond.disabled = !signedIn;
  copyPondReport.disabled = !signedIn;
  pondHealthToggle.disabled = !signedIn;
  copyPondDiagnostics.disabled = !signedIn;
  showPondTour.disabled = !signedIn;
  castNet.disabled = !signedIn;
  clearCompleted.disabled = !signedIn;
  updatePastePreview();
}

function setFilter(nextFilter) {
  // Clear selection when filter changes so hidden tasks can't be affected by bulk actions.
  selectedTodoIds.clear();
  filter = nextFilter;
  render();
}

function focusTaskInputFromTour() {
  input.focus();
  showPondMessage('Add one small next action, then let it swim.');
}

function openPastePanelFromTour() {
  setPastePanelOpen(true);
}

function switchToTideModeFromTour() {
  setFilter('tide');
}

function dismissTour() {
  tourForcedVisible = false;
  saveTourDismissed(true);
  render();
  showPondMessage('Pond tour dismissed. You can reopen it from Show pond tour.');
}


function render() {
  const renderStarted = diagnosticNow();
  renderAuth();
  list.replaceChildren();

  if (filter === 'tide') {
    renderTideMode();
  } else if (filter === 'week') {
    renderWeekAhead();
  } else if (filter === 'ghost') {
    renderGhostNet();
  } else {
    for (const todo of visibleTodos()) {
      list.append(createTodoItem(todo));
    }
  }

  const activeCount = liveTodos().filter((todo) => !todo.completed).length;
  count.textContent = filter === 'archive'
    ? `${pluralise(archivedTodos().length, 'archived fish', 'archived fish')}`
    : filter === 'ghost'
    ? `${pluralise(ghostNetTodos().length, 'ghost task')} found`
    : `${pluralise(activeCount, 'task')} left`;
  emptyState.querySelector('h2').textContent = filter === 'archive' ? 'No fish in the reef archive' : 'Nothing here yet';
  emptyState.querySelector('p').textContent = filter === 'archive'
    ? 'Archive completed fish to tidy the active pond without permanently deleting them.'
    : 'Add your first task above, stock the pond with demo tasks, or reopen the Pond tour for a quick walkthrough.';
  emptyState.classList.toggle('visible', filter !== 'tide' && filter !== 'week' && filter !== 'ghost' && visibleTodos().length === 0);
  clearCompleted.textContent = filter === 'archive' ? 'Release archived permanently' : 'Archive completed';
  clearCompleted.classList.toggle('visible', filter !== 'ghost' && (filter === 'archive' ? archivedTodos().length > 0 : liveTodos().some((todo) => todo.completed)));
  releaseDemo.disabled = !currentUser || !liveTodos().some((todo) => DEMO_TODO_IDS.includes(todo.id));
  selectedTodoIds = new Set([...selectedTodoIds].filter((id) => renderedTodoIds().has(id)));
  renderNetControls();
  renderTourPanel();

  filterButtons.forEach((button) => {
    button.classList.toggle('active', button.dataset.filter === filter);
  });

  renderFocusPanel();
  focusPendingEditField();
  recordRenderDuration(renderStarted);
  renderPondHealth();
  renderShowcase();
}

function addTodo(text, options = {}) {
  const todo = normaliseTodo({
    id: options.id ?? crypto.randomUUID(),
    text,
    completed: false,
    createdAt: options.createdAt ?? new Date().toISOString(),
    dueDate: options.dueDate ?? '',
    priority: options.priority ?? 'medium',
  });

  if (!todo) return;
  todos.unshift(todo);
  saveTodos();
  render();
}

function toggleTodo(id) {
  todos = todos.map((todo) => (
    todo.id === id ? { ...todo, completed: !todo.completed } : todo
  ));
  if (id === focusedTodoId && todos.find((todo) => todo.id === id)?.completed) {
    cancelCurrentFocusSprint('Focus sprint cancelled because this fish was completed.');
    saveFocusedTodoId('');
  }
  saveTodos();
  render();
}

function restoreUndoAction() {
  if (!lastUndoAction) return;

  const undoAction = lastUndoAction;
  clearUndoAction();
  todos = normaliseTodos(undoAction.todos);
  netMode = undoAction.netMode;
  selectedTodoIds = new Set(undoAction.selectedTodoIds.filter((id) => todos.some((todo) => todo.id === id)));
  saveFocusedTodoId(undoAction.focusedTodoId && todos.some((todo) => todo.id === undoAction.focusedTodoId)
    ? undoAction.focusedTodoId
    : '');
  saveTodos();
  render();
  showPondMessage(undoAction.confirmation);
}

function removeTodosWithUndo(predicate, message) {
  const previousTodos = normaliseTodos(todos);
  const removedTodos = previousTodos.filter(predicate);
  if (removedTodos.length === 0) return false;

  clearUndoAction();
  const previousFocus = focusedTodoId;
  const previousSelection = [...selectedTodoIds];
  const previousNetMode = netMode;

  todos = previousTodos.filter((todo) => !predicate(todo));
  if (previousFocus && removedTodos.some((todo) => todo.id === previousFocus)) {
    cancelCurrentFocusSprint('Focus sprint cancelled because that fish left the pond.');
    saveFocusedTodoId('');
  }
  selectedTodoIds = new Set(previousSelection.filter((id) => todos.some((todo) => todo.id === id)));
  saveTodos();
  render();

  const undoMessage = message(removedTodos.length);
  const undoAction = {
    todos: previousTodos,
    focusedTodoId: previousFocus,
    selectedTodoIds: previousSelection,
    netMode: previousNetMode,
    confirmation: `Restored ${pluralise(removedTodos.length, 'fish', 'fish')} to the pond.`,
    timeoutId: null,
  };
  undoAction.timeoutId = window.setTimeout(() => {
    if (lastUndoAction === undoAction) {
      lastUndoAction = null;
      showPondMessage(undoMessage);
    }
  }, 9000);
  lastUndoAction = undoAction;
  showPondMessage(undoMessage, {
    preserveUndo: true,
    action: { label: 'Undo', onClick: restoreUndoAction },
  });
  return true;
}

function focusPendingEditField() {
  if (pendingEditFocusId) {
    const inputElement = list.querySelector('.todo-item.editing .edit-task-text');
    if (inputElement) {
      inputElement.focus();
      inputElement.select();
    }
    pendingEditFocusId = '';
  }

  if (pendingEditReturnId) {
    list.querySelector(`[data-todo-id="${pendingEditReturnId}"] .edit-task`)?.focus();
    pendingEditReturnId = '';
  }
}

function startEditingTodo(id) {
  editingTodoId = id;
  pendingEditFocusId = id;
  hidePondMessage();
  render();
}

function cancelEditingTodo() {
  pendingEditReturnId = editingTodoId;
  editingTodoId = '';
  pendingEditFocusId = '';
  render();
}

function saveEditedTodo(id, updates) {
  const existingTodo = todos.find((todo) => todo.id === id);
  if (!existingTodo) return;

  const updatedTodo = normaliseTodo({
    ...existingTodo,
    text: updates.text,
    dueDate: updates.dueDate,
    priority: updates.priority,
  });

  if (!updatedTodo) {
    showPondMessage('Give this fish a task name before saving.');
    pendingEditFocusId = id;
    render();
    return;
  }

  todos = todos.map((todo) => (todo.id === id ? updatedTodo : todo));
  editingTodoId = '';
  pendingEditFocusId = '';
  saveTodos();
  showPondMessage('Updated this fish in the pond.');
  render();
}

function deleteTodo(id) {
  const isArchivedDelete = todos.some((todo) => todo.id === id && todo.archivedAt);
  if (editingTodoId === id) editingTodoId = '';
  removeTodosWithUndo(
    (todo) => todo.id === id,
    () => (isArchivedDelete
      ? 'Permanently released 1 archived fish from the reef.'
      : 'Released 1 fish from the pond.'),
  );
}

function archiveTodo(id) {
  const archivedAt = new Date().toISOString();
  todos = todos.map((todo) => (
    todo.id === id ? { ...todo, completed: true, archivedAt } : todo
  ));
  if (id === focusedTodoId) {
    cancelCurrentFocusSprint('Focus sprint cancelled because this fish moved to the reef.');
    saveFocusedTodoId('');
  }
  selectedTodoIds.delete(id);
  saveTodos();
  showPondMessage('Moved 1 completed fish to the reef archive.');
  render();
}

function archiveCompletedTodos() {
  const completedIds = liveTodos().filter((todo) => todo.completed).map((todo) => todo.id);
  if (completedIds.length === 0) return;
  const archivedAt = new Date().toISOString();
  const completedIdSet = new Set(completedIds);
  todos = todos.map((todo) => (
    completedIdSet.has(todo.id) ? { ...todo, completed: true, archivedAt } : todo
  ));
  if (completedIdSet.has(focusedTodoId)) {
    cancelCurrentFocusSprint('Focus sprint cancelled because this fish moved to the reef.');
    saveFocusedTodoId('');
  }
  selectedTodoIds = new Set([...selectedTodoIds].filter((id) => !completedIdSet.has(id)));
  saveTodos();
  showPondMessage(`Moved ${pluralise(completedIds.length, 'completed fish', 'completed fish')} to the reef archive.`);
  render();
}

function restoreArchivedTodo(id) {
  todos = todos.map((todo) => (
    todo.id === id ? { ...todo, archivedAt: '' } : todo
  ));
  saveTodos();
  showPondMessage('Restored 1 fish from the reef archive.');
  render();
}

function releaseArchivedTodos() {
  removeTodosWithUndo(
    (todo) => Boolean(todo.archivedAt),
    (count) => `Permanently released ${pluralise(count, 'archived fish', 'archived fish')} from the reef.`,
  );
}

function focusTodo(id) {
  editingTodoId = '';
  if (id !== focusedTodoId) resetFocusSprint(id);
  saveFocusedTodoId(id);
  hidePondMessage();
  render();
}

function toggleNetMode() {
  editingTodoId = '';
  netMode = !netMode;
  if (!netMode) selectedTodoIds.clear();
  render();
}

function leaveNetMode() {
  if (!netMode) return false;
  netMode = false;
  selectedTodoIds.clear();
  render();
  return true;
}

function toggleSelectedTodo(id) {
  if (selectedTodoIds.has(id)) selectedTodoIds.delete(id);
  else selectedTodoIds.add(id);
  render();
}

function releaseSelectedTodos() {
  // Constrain to rendered todos only, so tasks hidden by the current filter are never released.
  const selectedIds = new Set([...selectedTodoIds].filter((id) => renderedTodoIds().has(id)));
  if (removeTodosWithUndo(
    (todo) => selectedIds.has(todo.id),
    (count) => `Released ${pluralise(count, 'selected fish', 'selected fish')} from the pond.`,
  )) {
    selectedTodoIds.clear();
    render();
  }
}

function moveSelectedToShoal() {
  editingTodoId = '';
  // Constrain to rendered todos only, so tasks hidden by the current filter are never moved.
  const effectiveIds = new Set([...selectedTodoIds].filter((id) => renderedTodoIds().has(id)));
  const selectedCount = effectiveIds.size;
  const priority = normalisePriority(shoalPriority.value);
  todos = todos.map((todo) => (
    effectiveIds.has(todo.id) ? { ...todo, priority } : todo
  ));
  saveTodos();
  showPondMessage(`Moved ${pluralise(selectedCount, 'selected fish', 'selected fish')} to the ${priority} shoal.`);
  render();
}

function completeFocusedTodo() {
  if (!focusedTodoId) return;
  const completedTask = todos.find((todo) => todo.id === focusedTodoId);
  cancelCurrentFocusSprint('');
  todos = todos.map((todo) => (
    todo.id === focusedTodoId ? { ...todo, completed: true } : todo
  ));
  saveFocusedTodoId('');
  saveTodos();
  render();
  if (completedTask) {
    const celebration = celebrations[Math.floor(Math.random() * celebrations.length)];
    showPondMessage(celebration);
  }
}

function demoTodos() {
  const today = todayKey();
  return [
    {
      id: 'demo-flopping',
      text: 'Polish the demo until it stops flopping',
      priority: 'high',
      dueDate: today,
    },
    {
      id: 'demo-bubbles',
      text: 'Check the logs for suspicious bubbles',
      priority: 'medium',
      dueDate: addDays(today, 2),
    },
    {
      id: 'demo-low-tide',
      text: 'Ask CI why it smells like low tide',
      priority: 'low',
      dueDate: '',
    },
  ];
}

function stockDemoPond() {
  if (todos.length > 0 && !window.confirm('Add demo fish-themed tasks to this pond? Existing tasks will stay put.')) {
    return;
  }

  const existingIds = new Set(todos.map((todo) => todo.id));
  const existingTexts = new Set(todos.map((todo) => todo.text));
  const newTodos = demoTodos()
    .filter((todo) => !existingIds.has(todo.id) && !existingTexts.has(todo.text))
    .map((todo) => normaliseTodo({ ...todo, completed: false, createdAt: new Date().toISOString() }))
    .filter(Boolean);

  if (newTodos.length === 0) {
    showPondMessage('The pond is already stocked with demo fish.');
    return;
  }

  todos = [...newTodos, ...todos].slice(0, MAX_TODOS);
  saveTodos();
  showPondMessage(`Stocked the pond with ${pluralise(newTodos.length, 'demo fish', 'demo fish')}.`);
  render();
}

function releaseDemoFish() {
  removeTodosWithUndo(
    (todo) => DEMO_TODO_IDS.includes(todo.id),
    (count) => `Released ${pluralise(count, 'demo fish', 'demo fish')} from the pond.`,
  );
}

function snoozeTodo(id, days) {
  const today = todayKey();
  const newDueDate = addDays(today, days);
  todos = todos.map((todo) => (todo.id === id ? { ...todo, dueDate: newDueDate } : todo));
  saveTodos();
  showPondMessage(`Snoozed 1 task until ${formatDateKey(newDueDate)}.`);
  render();
}

function renderGhostNet() {
  const ghosts = ghostNetTodos();

  if (ghosts.length === 0) {
    const emptyItem = document.createElement('li');
    emptyItem.className = 'ghost-group ghost-group-empty';
    const heading = document.createElement('h3');
    heading.textContent = 'Clear waters — no ghost tasks';
    const description = document.createElement('p');
    description.textContent = 'No overdue, stale, or drifting high-priority tasks found. The pond is swimming clean.';
    emptyItem.append(heading, description);
    list.append(emptyItem);
    return;
  }

  const summaryItem = document.createElement('li');
  summaryItem.className = 'ghost-group';
  const summaryHeading = document.createElement('h3');
  summaryHeading.textContent = `Ghost net found ${pluralise(ghosts.length, 'task')}`;
  const summaryDescription = document.createElement('p');
  summaryDescription.textContent = `Review active fish that are overdue, unscheduled for more than ${GHOST_STALE_DAYS} days, or high priority and drifting.`;
  summaryItem.append(summaryHeading, summaryDescription);
  list.append(summaryItem);

  for (const todo of ghosts) {
    const item = document.createElement('li');
    item.className = 'ghost-item';
    item.dataset.priority = todo.priority;
    item.dataset.todoId = todo.id;

    const info = document.createElement('div');
    info.className = 'ghost-info';

    const textEl = document.createElement('span');
    textEl.className = 'ghost-text';
    textEl.textContent = todo.text;

    const metaEl = document.createElement('span');
    metaEl.className = 'ghost-meta';
    const mood = moodFor(todo);
    metaEl.textContent = `${mood.emoji} ${mood.text} · ${dueLabelFor(todo)} · ${priorityLabelFor(todo)}`;

    info.append(textEl, metaEl);

    const actions = document.createElement('div');
    actions.className = 'ghost-actions';

    const focusBtn = document.createElement('button');
    focusBtn.type = 'button';
    focusBtn.className = 'secondary-action';
    focusBtn.textContent = 'Focus';
    focusBtn.setAttribute('aria-label', `Focus on ${todo.text}`);
    focusBtn.addEventListener('click', () => focusTodo(todo.id));

    const snoozeTomorrowBtn = document.createElement('button');
    snoozeTomorrowBtn.type = 'button';
    snoozeTomorrowBtn.className = 'secondary-action';
    snoozeTomorrowBtn.textContent = 'Snooze tomorrow';
    snoozeTomorrowBtn.setAttribute('aria-label', `Snooze ${todo.text} to tomorrow`);
    snoozeTomorrowBtn.disabled = !currentUser;
    snoozeTomorrowBtn.addEventListener('click', () => snoozeTodo(todo.id, 1));

    const snoozeWeekBtn = document.createElement('button');
    snoozeWeekBtn.type = 'button';
    snoozeWeekBtn.className = 'secondary-action';
    snoozeWeekBtn.textContent = 'Snooze 1 week';
    snoozeWeekBtn.setAttribute('aria-label', `Snooze ${todo.text} by one week`);
    snoozeWeekBtn.disabled = !currentUser;
    snoozeWeekBtn.addEventListener('click', () => snoozeTodo(todo.id, 7));

    const releaseBtn = document.createElement('button');
    releaseBtn.type = 'button';
    releaseBtn.className = 'ghost-release';
    releaseBtn.textContent = '×';
    releaseBtn.setAttribute('aria-label', `Release ${todo.text}`);
    releaseBtn.addEventListener('click', () => deleteTodo(todo.id));

    actions.append(focusBtn, snoozeTomorrowBtn, snoozeWeekBtn, releaseBtn);
    item.append(info, actions);
    list.append(item);
  }
}

async function authenticate(mode) {
  if (!authForm.reportValidity()) return;

  const username = usernameInput.value.trim();
  const password = passwordInput.value;

  authStatus.textContent = mode === 'signup' ? 'Creating account…' : 'Logging in…';
  try {
    const body = await apiRequest(`/api/${mode}`, {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    saveAuthToken(body.token);
    currentUser = body.user;
    todos = normaliseTodos(body.todos);
    markSyncState('loaded', 'Loaded tasks for the current session.');
    passwordInput.value = '';
    clearStorageError();
    hidePondMessage();
    render();
  } catch (error) {
    authStatus.textContent = error.message;
  }
}

async function changePassword() {
  if (!currentUser || !passwordForm.reportValidity()) return;

  changePasswordButton.disabled = true;
  authStatus.textContent = 'Updating password…';
  try {
    const body = await apiRequest('/api/account/password', {
      method: 'POST',
      body: JSON.stringify({
        currentPassword: currentPasswordInput.value,
        newPassword: newPasswordInput.value,
      }),
    });
    saveAuthToken(body.token);
    currentUser = body.user;
    todos = normaliseTodos(body.todos);
    passwordForm.reset();
    clearStorageError();
    markSyncState('loaded', 'Password changed and this session refreshed.');
    render();
    showPondMessage('Password updated. Other old sessions will need to log in again.');
  } catch (error) {
    authStatus.textContent = error.message;
  } finally {
    changePasswordButton.disabled = false;
  }
}

function logout() {
  saveAuthToken('');
  currentUser = null;
  todos = [];
  selectedTodoIds.clear();
  netMode = false;
  tourForcedVisible = false;
  resetFocusSprint('');
  saveFocusedTodoId('');
  markSyncState('signed out', 'No account is currently syncing.');
  hidePondMessage();
  render();
}

async function restoreSession() {
  if (!authToken) {
    render();
    return;
  }
  try {
    const body = await apiRequest('/api/me');
    currentUser = body.user;
    todos = normaliseTodos(body.todos);
    markSyncState('loaded', 'Restored the signed-in task pond.');
  } catch {
    saveAuthToken('');
    currentUser = null;
    todos = [];
    markSyncState('signed out', 'Saved session could not be restored.');
  }
  render();
}

function isInteractiveShortcutTarget(target) {
  if (!target || typeof target.closest !== 'function') return false;
  return Boolean(target.closest(
    'input, select, textarea, button, [contenteditable=""], [contenteditable="true"]',
  ));
}

function handleGlobalShortcut(event) {
  const hasModifier = event.altKey || event.ctrlKey || event.metaKey;
  if (event.defaultPrevented || hasModifier || isInteractiveShortcutTarget(event.target)) {
    return;
  }

  if (event.key === '?') {
    event.preventDefault();
    toggleShortcutHelp();
    return;
  }

  if (event.key === '/') {
    event.preventDefault();
    input.focus();
    return;
  }

  if (event.key.toLowerCase() === 't') {
    event.preventDefault();
    setFilter('tide');
    return;
  }

  if (event.key.toLowerCase() === 'g') {
    event.preventDefault();
    setFilter('ghost');
    return;
  }

  if (event.key.toLowerCase() === 'a') {
    event.preventDefault();
    setFilter('all');
    return;
  }

  if (event.key.toLowerCase() === 'r') {
    event.preventDefault();
    if (currentUser) copyPondProgressReport();
    return;
  }

  if (event.key === 'Escape') {
    const helpWasOpen = !shortcutHelp.hidden;
    setShortcutHelpOpen(false);
    const leftNetMode = leaveNetMode();
    const closedShowcase = !showcasePanel.hidden;
    if (closedShowcase) setShowcaseOpen(false);
    if (helpWasOpen || leftNetMode || closedShowcase) event.preventDefault();
  }
}

authForm.addEventListener('submit', (event) => {
  event.preventDefault();
  authenticate('login');
});

signupButton.addEventListener('click', () => authenticate('signup'));
logoutButton.addEventListener('click', logout);
passwordForm.addEventListener('submit', (event) => {
  event.preventDefault();
  changePassword();
});

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const text = input.value.trim();
  if (!text) return;

  addTodo(text, {
    dueDate: dueDateInput.value,
    priority: priorityInput.value,
  });
  form.reset();
  priorityInput.value = 'medium';
  syncPriorityChips();
  input.focus();
});

filterButtons.forEach((button) => {
  button.addEventListener('click', () => setFilter(button.dataset.filter));
});

priorityInput.addEventListener('change', syncPriorityChips);
priorityChips.forEach((chip) => {
  chip.addEventListener('click', () => setDraftPriority(chip.dataset.priority));
});

clearCompleted.addEventListener('click', () => {
  if (filter === 'archive') releaseArchivedTodos();
  else archiveCompletedTodos();
});

stockPond.addEventListener('click', stockDemoPond);
releaseDemo.addEventListener('click', releaseDemoFish);
pastePond.addEventListener('click', () => setPastePanelOpen(pastePanel.hidden));
pasteInput.addEventListener('input', updatePastePreview);
addPastedTasks.addEventListener('click', importPastedTodos);
clearPaste.addEventListener('click', clearPasteInput);
cancelPaste.addEventListener('click', () => setPastePanelOpen(false));
copyPondReport.addEventListener('click', copyPondProgressReport);
shortcutHelpToggle.addEventListener('click', toggleShortcutHelp);
shortcutHelpClose.addEventListener('click', () => setShortcutHelpOpen(false));
pondHealthToggle.addEventListener('click', () => setPondHealthOpen(pondHealthPanel.hidden));
copyPondDiagnostics.addEventListener('click', copyDiagnosticsReport);
castNet.addEventListener('click', toggleNetMode);
releaseSelected.addEventListener('click', releaseSelectedTodos);
moveShoal.addEventListener('click', moveSelectedToShoal);
showPondTour.addEventListener('click', () => {
  tourForcedVisible = true;
  render();
  pondTour.focus({ preventScroll: true });
  pondTour.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
});
tourAddTask.addEventListener('click', focusTaskInputFromTour);
tourStockDemo.addEventListener('click', stockDemoPond);
tourPastePond.addEventListener('click', openPastePanelFromTour);
tourTideMode.addEventListener('click', switchToTideModeFromTour);
tourCopyReport.addEventListener('click', copyPondProgressReport);
dismissPondTour.addEventListener('click', dismissTour);
focusSprintPresets.forEach((button) => {
  button.addEventListener('click', () => selectFocusSprintLength(Number(button.dataset.sprintMinutes)));
});
startFocusSprint.addEventListener('click', startOrResumeFocusSprint);
pauseFocusSprint.addEventListener('click', pauseCurrentFocusSprint);
cancelFocusSprint.addEventListener('click', () => cancelCurrentFocusSprint());
completeFocusSprint.addEventListener('click', completeSprintFocusedTodo);
completeFocus.addEventListener('click', completeFocusedTodo);
showcaseToggle.addEventListener('click', () => setShowcaseOpen(showcasePanel.hidden));
showcaseClose.addEventListener('click', () => setShowcaseOpen(false));

document.addEventListener('keydown', handleGlobalShortcut);
syncPriorityChips();

restoreSession();
