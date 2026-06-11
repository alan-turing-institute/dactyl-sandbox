const TOKEN_KEY = 'dactyl.authToken';
const FOCUS_KEY = 'dactyl.focusedTodoId';
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
const copyPondReport = document.querySelector('#copy-pond-report');
const castNet = document.querySelector('#cast-net');
const releaseSelected = document.querySelector('#release-selected');
const shoalControl = document.querySelector('#shoal-control');
const shoalPriority = document.querySelector('#shoal-priority');
const moveShoal = document.querySelector('#move-shoal');
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
let netMode = false;
let selectedTodoIds = new Set();
let saveQueue = Promise.resolve();
let saveVersion = 0;
let lastUndoAction = null;

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
  saveQueue = saveQueue
    .catch(() => {})
    .then(() => apiRequest('/api/tasks', {
      method: 'PUT',
      body: JSON.stringify({ todos: snapshot }),
    }))
    .then((body) => {
      if (version === saveVersion) {
        todos = normaliseTodos(body.todos);
        clearStorageError();
        render();
      }
    });

  saveQueue.catch((error) => {
    if (version === saveVersion) {
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
  return sortTodos(todos);
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

function createTodoItem(todo) {
  const item = template.content.firstElementChild.cloneNode(true);
  const netSelect = item.querySelector('.net-select');
  const checkbox = item.querySelector('.toggle');
  const text = item.querySelector('.text');
  const moodBadge = item.querySelector('.mood-badge');
  const dueLabel = item.querySelector('.due-label');
  const priorityLabel = item.querySelector('.priority-label');
  const focusButton = item.querySelector('.focus-task');
  const deleteButton = item.querySelector('.delete');
  const mood = moodFor(todo);
  const tide = tideFor(todo);

  item.classList.toggle('completed', todo.completed);
  item.classList.toggle('focused', todo.id === focusedTodoId);
  item.dataset.priority = todo.priority;
  item.dataset.tide = tide;
  item.classList.toggle('net-mode', netMode);
  netSelect.hidden = !netMode;
  netSelect.checked = selectedTodoIds.has(todo.id);
  netSelect.setAttribute('aria-label', `Select ${todo.text}`);
  checkbox.checked = todo.completed;
  text.textContent = todo.text;
  moodBadge.textContent = `${mood.emoji} ${mood.text}`;
  moodBadge.classList.add(mood.className);
  moodBadge.setAttribute('aria-label', `Mood: ${mood.text}`);
  dueLabel.textContent = dueLabelFor(todo);
  priorityLabel.textContent = priorityLabelFor(todo);
  focusButton.disabled = todo.completed;
  focusButton.textContent = todo.id === focusedTodoId ? 'Feeding' : 'Feed';
  focusButton.setAttribute('aria-label', `Feed ${todo.text}`);
  deleteButton.setAttribute('aria-label', `Delete ${todo.text}`);

  netSelect.addEventListener('change', () => toggleSelectedTodo(todo.id));
  checkbox.addEventListener('change', () => toggleTodo(todo.id));
  focusButton.addEventListener('click', () => focusTodo(todo.id));
  deleteButton.addEventListener('click', () => deleteTodo(todo.id));

  return item;
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
  stockPond.disabled = !signedIn;
  copyPondReport.disabled = !signedIn;
  castNet.disabled = !signedIn;
  clearCompleted.disabled = !signedIn;
}

function render() {
  renderAuth();
  list.replaceChildren();

  if (filter === 'tide') {
    renderTideMode();
  } else {
    for (const todo of visibleTodos()) {
      list.append(createTodoItem(todo));
    }
  }

  const activeCount = todos.filter((todo) => !todo.completed).length;
  count.textContent = `${pluralise(activeCount, 'task')} left`;
  emptyState.classList.toggle('visible', filter !== 'tide' && visibleTodos().length === 0);
  clearCompleted.classList.toggle('visible', todos.some((todo) => todo.completed));
  releaseDemo.disabled = !currentUser || !todos.some((todo) => DEMO_TODO_IDS.includes(todo.id));
  selectedTodoIds = new Set([...selectedTodoIds].filter((id) => todos.some((todo) => todo.id === id)));
  renderNetControls();

  filterButtons.forEach((button) => {
    button.classList.toggle('active', button.dataset.filter === filter);
  });

  renderFocusPanel();
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

function deleteTodo(id) {
  removeTodosWithUndo(
    (todo) => todo.id === id,
    () => 'Released 1 fish from the pond.',
  );
}

function focusTodo(id) {
  saveFocusedTodoId(id);
  hidePondMessage();
  render();
}

function toggleNetMode() {
  netMode = !netMode;
  if (!netMode) selectedTodoIds.clear();
  render();
}

function toggleSelectedTodo(id) {
  if (selectedTodoIds.has(id)) selectedTodoIds.delete(id);
  else selectedTodoIds.add(id);
  render();
}

function releaseSelectedTodos() {
  const selectedIds = new Set(selectedTodoIds);
  if (removeTodosWithUndo(
    (todo) => selectedIds.has(todo.id),
    (count) => `Released ${pluralise(count, 'selected fish', 'selected fish')} from the pond.`,
  )) {
    selectedTodoIds.clear();
    render();
  }
}

function moveSelectedToShoal() {
  const selectedCount = selectedTodoIds.size;
  const priority = normalisePriority(shoalPriority.value);
  todos = todos.map((todo) => (
    selectedTodoIds.has(todo.id) ? { ...todo, priority } : todo
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
    passwordInput.value = '';
    clearStorageError();
    hidePondMessage();
    render();
  } catch (error) {
    authStatus.textContent = error.message;
  }
}

function logout() {
  saveAuthToken('');
  currentUser = null;
  todos = [];
  selectedTodoIds.clear();
  netMode = false;
  saveFocusedTodoId('');
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
  } catch {
    saveAuthToken('');
    currentUser = null;
    todos = [];
  }
  render();
}

authForm.addEventListener('submit', (event) => {
  event.preventDefault();
  authenticate('login');
});

signupButton.addEventListener('click', () => authenticate('signup'));
logoutButton.addEventListener('click', logout);

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
  button.addEventListener('click', () => {
    filter = button.dataset.filter;
    render();
  });
});

clearCompleted.addEventListener('click', () => {
  removeTodosWithUndo(
    (todo) => todo.completed,
    (count) => `Released ${pluralise(count, 'completed fish', 'completed fish')} from the pond.`,
  );
});

stockPond.addEventListener('click', stockDemoPond);
releaseDemo.addEventListener('click', releaseDemoFish);
copyPondReport.addEventListener('click', copyPondProgressReport);
castNet.addEventListener('click', toggleNetMode);
releaseSelected.addEventListener('click', releaseSelectedTodos);
moveShoal.addEventListener('click', moveSelectedToShoal);
completeFocus.addEventListener('click', completeFocusedTodo);

restoreSession();
