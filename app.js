// AI-assisted coding: Claude Code (claude-sonnet-4-6) via `claude -p`.
// Prompts: (1) fix issue #61 by clearing/constraining Cast net selections so bulk actions cannot affect hidden tasks; (2) review/refine with renderedTodoIds() so render(), release, and shoal moves all scope selection to rendered tasks per filter.
const TOKEN_KEY = 'dactyl.authToken';
const FOCUS_KEY = 'dactyl.focusedTodoId';
const TOUR_DISMISSED_KEY = 'dactyl.pondTourDismissed:v1';
const MAX_TODOS = 200;
const MAX_TODO_LENGTH = 120;
const PRIORITIES = ['low', 'medium', 'high'];
const DEMO_TODO_IDS = ['demo-flopping', 'demo-bubbles', 'demo-low-tide'];

const authPanel = document.querySelector('#auth-panel');
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
const completeFocus = document.querySelector('#complete-focus');

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

function visibleTodos() {
  if (filter === 'active') return sortTodos(todos.filter((todo) => !todo.completed));
  if (filter === 'completed') return sortTodos(todos.filter((todo) => todo.completed));
  if (filter === 'week') {
    const today = todayKey();
    const weekEnd = addDays(today, 6);
    return sortTodos(todos.filter((todo) => !todo.completed && todo.dueDate && todo.dueDate <= weekEnd));
  }
  return sortTodos(todos);
}

function renderedTodoIds() {
  // tide renders all todos across groups (including completed); other filters match visibleTodos().
  if (filter === 'tide') return new Set(todos.map((todo) => todo.id));
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
  const activeTodos = todos.filter((todo) => !todo.completed);
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
  const totalCount = todos.length;
  const activeTodos = todos.filter((todo) => !todo.completed);
  const completedCount = todos.filter((todo) => todo.completed).length;
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
    [group.key]: todos.filter((todo) => tideFor(todo) === group.key).length,
  }), {});
}

function visibleTodoCount() {
  return filter === 'tide' ? todos.length : visibleTodos().length;
}

function pondDiagnostics() {
  const activeCount = todos.filter((todo) => !todo.completed).length;
  const completedCount = todos.length - activeCount;
  const tides = tideCounts();
  const averageRender = averageRenderDuration();

  return {
    totalCount: todos.length,
    activeCount,
    completedCount,
    visibleCount: visibleTodoCount(),
    selectedCount: selectedTodoIds.size,
    filter,
    netMode,
    focusedTaskPresent: todos.some((todo) => todo.id === focusedTodoId && !todo.completed),
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
    `Tasks: ${diagnostics.totalCount} total, ${diagnostics.activeCount} active, ${diagnostics.completedCount} completed, ${diagnostics.visibleCount} visible`,
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
  const deleteButton = item.querySelector('.delete');
  const mood = moodFor(todo);
  const tide = tideFor(todo);

  item.classList.toggle('completed', todo.completed);
  item.classList.toggle('focused', todo.id === focusedTodoId);
  item.classList.toggle('editing', todo.id === editingTodoId);
  item.dataset.priority = todo.priority;
  item.dataset.tide = tide;
  item.dataset.todoId = todo.id;
  item.classList.toggle('net-mode', netMode);
  netSelect.hidden = !netMode;
  netSelect.checked = selectedTodoIds.has(todo.id);
  netSelect.disabled = todo.id === editingTodoId;
  netSelect.setAttribute('aria-label', `Select ${todo.text}`);
  checkbox.checked = todo.completed;
  checkbox.disabled = todo.id === editingTodoId;
  text.textContent = todo.text;
  moodBadge.textContent = `${mood.emoji} ${mood.text}`;
  moodBadge.classList.add(mood.className);
  moodBadge.setAttribute('aria-label', `Mood: ${mood.text}`);
  dueLabel.textContent = dueLabelFor(todo);
  priorityLabel.textContent = priorityLabelFor(todo);
  focusButton.disabled = todo.completed || todo.id === editingTodoId;
  focusButton.textContent = todo.id === focusedTodoId ? 'Feeding' : 'Feed';
  focusButton.setAttribute('aria-label', `Feed ${todo.text}`);
  editButton.disabled = todo.id === editingTodoId;
  editButton.setAttribute('aria-label', `Edit ${todo.text}`);
  deleteButton.setAttribute('aria-label', `Delete ${todo.text}`);

  if (todo.id === editingTodoId) {
    const editForm = createTodoEditForm(todo);
    item.append(editForm);
  }

  netSelect.addEventListener('change', () => toggleSelectedTodo(todo.id));
  checkbox.addEventListener('change', () => toggleTodo(todo.id));
  focusButton.addEventListener('click', () => focusTodo(todo.id));
  editButton.addEventListener('click', () => startEditingTodo(todo.id));
  deleteButton.addEventListener('click', () => deleteTodo(todo.id));

  return item;
}

function weekAheadGroups() {
  const today = todayKey();
  const activeDueTodos = sortTodos(todos.filter((todo) => !todo.completed && todo.dueDate));
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
  tourCopyReport.disabled = todos.length === 0;
}

function renderFocusPanel() {
  const focusedTodo = todos.find((todo) => todo.id === focusedTodoId && !todo.completed);
  if (!focusedTodo) {
    saveFocusedTodoId('');
    focusPanel.hidden = true;
    return;
  }

  focusPanel.hidden = false;
  focusTitle.textContent = focusedTodo.text;
  focusMeta.textContent = `${moodFor(focusedTodo).text} · ${dueLabelFor(focusedTodo)} · ${priorityLabelFor(focusedTodo)}`;
}

function renderAuth() {
  const signedIn = Boolean(currentUser);
  authPanel.classList.toggle('signed-in', signedIn);
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

function render() {
  const renderStarted = diagnosticNow();
  renderAuth();
  list.replaceChildren();

  if (filter === 'tide') {
    renderTideMode();
  } else if (filter === 'week') {
    renderWeekAhead();
  } else {
    for (const todo of visibleTodos()) {
      list.append(createTodoItem(todo));
    }
  }

  const activeCount = todos.filter((todo) => !todo.completed).length;
  count.textContent = `${pluralise(activeCount, 'task')} left`;
  emptyState.classList.toggle('visible', filter !== 'tide' && filter !== 'week' && visibleTodos().length === 0);
  clearCompleted.classList.toggle('visible', todos.some((todo) => todo.completed));
  releaseDemo.disabled = !currentUser || !todos.some((todo) => DEMO_TODO_IDS.includes(todo.id));
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
  if (id === focusedTodoId && todos.find((todo) => todo.id === id)?.completed) saveFocusedTodoId('');
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
  if (previousFocus && removedTodos.some((todo) => todo.id === previousFocus)) saveFocusedTodoId('');
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
  if (editingTodoId === id) editingTodoId = '';
  removeTodosWithUndo(
    (todo) => todo.id === id,
    () => 'Released 1 fish from the pond.',
  );
}

function focusTodo(id) {
  editingTodoId = '';
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
    if (helpWasOpen || leftNetMode) event.preventDefault();
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
  input.focus();
});

filterButtons.forEach((button) => {
  button.addEventListener('click', () => setFilter(button.dataset.filter));
});

clearCompleted.addEventListener('click', () => {
  removeTodosWithUndo(
    (todo) => todo.completed,
    (count) => `Released ${pluralise(count, 'completed fish', 'completed fish')} from the pond.`,
  );
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
tourAddTask.addEventListener('click', () => {
  input.focus();
  showPondMessage('Add one small next action, then let it swim.');
});
tourStockDemo.addEventListener('click', stockDemoPond);
tourPastePond.addEventListener('click', () => setPastePanelOpen(true));
tourTideMode.addEventListener('click', () => {
  filter = 'tide';
  render();
});
tourCopyReport.addEventListener('click', copyPondProgressReport);
dismissPondTour.addEventListener('click', () => {
  tourForcedVisible = false;
  saveTourDismissed(true);
  render();
  showPondMessage('Pond tour dismissed. You can reopen it from Show pond tour.');
});
completeFocus.addEventListener('click', completeFocusedTodo);

document.addEventListener('keydown', handleGlobalShortcut);

restoreSession();
