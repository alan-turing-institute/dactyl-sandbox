/* global DactylAnalytics, DactylContextualEmptyStates, DactylDailyCatch, DactylDueNudges, DactylFirstTaskOnboarding, DactylFishEmoji, DactylPremiumHooks, DactylQuickAdd, DactylRecurrence, DactylScreenState, DactylTriageMode */
// AI-assisted coding: Claude Code (claude-sonnet-4-6) via `claude -p`.
// Prompts: (1) fix issue #61 by clearing/constraining Cast net selections so bulk actions cannot affect hidden tasks; (2) review/refine with renderedTodoIds() so render(), release, and shoal moves all scope selection to rendered tasks per filter; (3) issue #22 Ghost net stale-task review mode — ghost filter button, stale detection (overdue / no-due-date 7d / high-priority 7d), Ghost net panel with count/empty-state, per-task actions (Focus, Snooze tomorrow, Snooze 1 week, Release); (4) issue #198 login submit robustness — `claude -p "Investigate likely cause... Do not modify files"` plus GPT-5.5 edits to keep explicit Log in/Sign up button intent and busy state.
const TOKEN_KEY = 'dactyl.authToken';
const FOCUS_KEY = 'dactyl.focusedTodoId';
const SPRINT_LENGTH_KEY = 'dactyl.focusSprintLengthMinutes';
const TOUR_DISMISSED_KEY = 'dactyl.pondTourDismissed:v1';
const NOTIFIED_TODAY_KEY = 'dactyl.notifiedToday:v1';
const FIRST_TASK_ONBOARDING_DISMISSED_KEY = 'dactyl.firstTaskOnboardingDismissed:v1';
const FIRST_COMPLETION_CELEBRATED_KEY = 'dactyl.firstCompletionCelebrated:v1';
const PREFS_KEY = 'dactyl.viewPrefs:v1';
const SMART_VIEWS_KEY = 'dactyl.smartViews:v1';
const DAILY_CATCH_KEY = 'dactyl.dailyCatch:v1';
const LAST_FILTER_KEY = 'dactyl.lastFilter:v1';
const OVERDUE_NUDGE_MIN = 2;
const PREMIUM_CALLOUT_DISMISSED_KEY = 'dactyl.premiumCalloutDismissed:v1';
const MAX_TODOS = 200;
const POND_EXPORT_VERSION = 1;
const dueNudgeUtils = typeof DactylDueNudges !== 'undefined' ? DactylDueNudges : {
  defaultDueDate: (today) => addDays(today, 1),
  nextDueDate: (currentDueDate, days, today) => addDays(currentDueDate || today, days),
};
const MAX_ACTIVITY_LOG = 50;
const DEFAULT_SPRINT_MINUTES = 15;
const MAX_TODO_LENGTH = 120;
const MAX_NOTES_LENGTH = 1000;
const MAX_CHECKLIST_ITEMS = 10;
const MAX_CHECKLIST_TEXT_LENGTH = 80;
const USERNAME_PATTERN = /^[a-z0-9_.-]{3,32}$/i;
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;
const PRIORITIES = ['low', 'medium', 'high'];
const DEMO_TODO_IDS = ['demo-flopping', 'demo-bubbles', 'demo-low-tide'];
const GHOST_STALE_DAYS = 7;
const REMINDER_PREFS_KEY = 'dactyl.reminderPrefs:v1';
const GETTING_STARTED_PREF_KEY = 'gettingStartedOpen';
const GETTING_STARTED_AUTO_COLLAPSED_KEY = 'gettingStartedAutoCollapsed';
const STARTER_SHOALS = [
  {
    name: 'Morning stand-up shoal',
    description: 'Yesterday, today, blockers, review asks.',
    tasks: [
      { text: 'Note what I completed yesterday', priority: 'low' },
      { text: 'Write today\'s focus task', priority: 'high' },
      { text: 'Flag any blockers or waiting-ons', priority: 'medium' },
      { text: 'Check open review requests', priority: 'medium' },
    ],
  },
  {
    name: 'PR review shoal',
    description: 'Reproduce, inspect diff, run tests, leave review, follow up.',
    tasks: [
      { text: 'Reproduce the change locally', priority: 'high' },
      { text: 'Read the diff and leave inline comments', priority: 'high' },
      { text: 'Run the test suite', priority: 'medium' },
      { text: 'Submit review', priority: 'medium' },
      { text: 'Follow up on review response', priority: 'low' },
    ],
  },
  {
    name: 'Hack-week demo shoal',
    description: 'Polish README, capture screenshot, write demo script, check deploy.',
    tasks: [
      { text: 'Polish README with setup steps', priority: 'high' },
      { text: 'Capture screenshot or GIF', priority: 'medium' },
      { text: 'Write demo script (3 min)', priority: 'high' },
      { text: 'Verify deployment / local demo works', priority: 'high' },
    ],
  },
  {
    name: 'Docs tidy shoal',
    description: 'Update install steps, add troubleshooting, verify commands.',
    tasks: [
      { text: 'Update install / setup steps', priority: 'medium' },
      { text: 'Add troubleshooting note', priority: 'low' },
      { text: 'Verify all documented commands work', priority: 'medium' },
      { text: 'Review for outdated screenshots or links', priority: 'low' },
    ],
  },
];
const {
  shouldCelebrateFirstCompletion,
  shouldShowFirstTaskOnboarding,
  templateForId,
} = DactylFirstTaskOnboarding;
const {
  normaliseScreenKey,
  screenKeyFromLocation,
  desiredScreenKey: chooseScreenKey,
} = DactylScreenState;
const { 鱼EmojiFor } = DactylFishEmoji;
const { parseQuickAdd } = DactylQuickAdd;
const { selectDailyCatchSuggestions } = DactylDailyCatch;
const { premiumHookForSurface } = DactylPremiumHooks;
const { normaliseRecurrence, recurrenceLabel, nextRecurrenceDate } = DactylRecurrence;
const { contextualEmptyState, dailyCatchEmptyState } = DactylContextualEmptyStates;
const analytics = DactylAnalytics.createAnalytics();
const {
  clampTriageIndex,
  nextPriority: nextTriagePriority,
  nextTriageIndex,
  triageCandidates: getTriageCandidates,
} = DactylTriageMode;

function trackProductEvent(name, payload = {}) {
  analytics.track(name, payload);
}

const authScreen = document.querySelector('#auth-screen');
const pondScreen = document.querySelector('#pond-screen');
const authPanel = document.querySelector('#auth-panel');
const authTitle = document.querySelector('#auth-title');
const authForm = document.querySelector('#auth-form');
const usernameInput = document.querySelector('#username-input');
const passwordInput = document.querySelector('#password-input');
const loginButton = document.querySelector('#login-button');
const signupButton = document.querySelector('#signup-button');
const logoutButton = document.querySelector('#logout-button');
const authStatus = document.querySelector('#auth-status');
const passwordForm = document.querySelector('#password-form');
const currentPasswordInput = document.querySelector('#current-password-input');
const newPasswordInput = document.querySelector('#new-password-input');
const changePasswordButton = document.querySelector('#change-password-button');
const form = document.querySelector('#todo-form');
const input = document.querySelector('#todo-input');
const advancedAddToggle = document.querySelector('#advanced-add-toggle');
const advancedAddFields = document.querySelector('#advanced-add-fields');
const dueDateInput = document.querySelector('#due-date-input');
const githubUrlInput = document.querySelector('#github-url-input');
const priorityInput = document.querySelector('#priority-input');
const recurrenceInput = document.querySelector('#recurrence-input');
const priorityChips = [...document.querySelectorAll('.priority-chips button')];
const list = document.querySelector('#todo-list');
const template = document.querySelector('#todo-template');
const count = document.querySelector('#todo-count');
const emptyState = document.querySelector('#empty-state');
const emptyStateActions = document.querySelector('#empty-state-actions');
const firstTaskOnboarding = document.querySelector('#first-task-onboarding');
const firstTaskTemplateButtons = [...document.querySelectorAll('[data-first-task-template]')];
const dismissFirstTaskOnboarding = document.querySelector('#dismiss-first-task-onboarding');
const clearCompleted = document.querySelector('#clear-completed');
const filterButtons = [...document.querySelectorAll('.filter')];
const taskSearch = document.querySelector('#task-search');
const clearSearch = document.querySelector('#clear-search');
const quickFilterButtons = [...document.querySelectorAll('.quick-filter')];
const smartViewName = document.querySelector('#smart-view-name');
const saveSmartView = document.querySelector('#save-smart-view');
const smartViewList = document.querySelector('#smart-view-list');
const storageError = document.querySelector('#storage-error');
const pondMessage = document.querySelector('#pond-message');
const undoToast = document.querySelector('#undo-toast');
const undoToastMessage = document.querySelector('#undo-toast-message');
const undoToastAction = document.querySelector('#undo-toast-action');
const undoToastDismiss = document.querySelector('#undo-toast-dismiss');
const undoToastProgress = document.querySelector('#undo-toast-progress');
const stockPond = document.querySelector('#stock-pond');
const releaseDemo = document.querySelector('#release-demo');
const pastePond = document.querySelector('#paste-pond');
const pastePanel = document.querySelector('#paste-panel');
const pasteInput = document.querySelector('#paste-input');
const pastePreview = document.querySelector('#paste-preview');
const addPastedTasks = document.querySelector('#add-pasted-tasks');
const clearPaste = document.querySelector('#clear-paste');
const cancelPaste = document.querySelector('#cancel-paste');
const exportPond = document.querySelector('#export-pond');
const exportCalendarBtn = document.querySelector('#export-calendar');
const restorePondToggle = document.querySelector('#restore-pond-toggle');
const restorePanel = document.querySelector('#restore-panel');
const restoreFile = document.querySelector('#restore-file');
const restorePreview = document.querySelector('#restore-preview');
const mergeRestore = document.querySelector('#merge-restore');
const replaceRestore = document.querySelector('#replace-restore');
const cancelRestore = document.querySelector('#cancel-restore');
const copyPondReport = document.querySelector('#copy-pond-report');
const copyPondSnapshot = document.querySelector('#copy-pond-snapshot');
const sharePond = document.querySelector('#share-pond');
const copyStandupDraftButton = document.querySelector('#copy-standup-draft');
const dailyCatchToggle = document.querySelector('#daily-catch-toggle');
const dailyCatchPanel = document.querySelector('#daily-catch-panel');
const dailyCatchClose = document.querySelector('#daily-catch-close');
const dailyCatchSummary = document.querySelector('#daily-catch-summary');
const dailyCatchPinned = document.querySelector('#daily-catch-pinned');
const dailyCatchSuggestions = document.querySelector('#daily-catch-suggestions');
const upgradeCallout = document.querySelector('#upgrade-callout');
const upgradeCalloutTitle = document.querySelector('#upgrade-callout-title');
const upgradeCalloutBody = document.querySelector('#upgrade-callout-body');
const upgradeCalloutDismiss = document.querySelector('#upgrade-callout-dismiss');
const pondHealthToggle = document.querySelector('#pond-health-toggle');
const pondHealthPanel = document.querySelector('#pond-health-panel');
const pondHealthSummary = document.querySelector('#pond-health-summary');
const pondHealthMetrics = document.querySelector('#pond-health-metrics');
const pondHealthHints = document.querySelector('#pond-health-hints');
const copyPondDiagnostics = document.querySelector('#copy-pond-diagnostics');
const gettingStartedToggle = document.querySelector('#getting-started-toggle');
const gettingStartedPanel = document.querySelector('#getting-started-panel');
const gettingStartedCollapse = document.querySelector('#getting-started-collapse');
const checklistAddTask = document.querySelector('#checklist-add-task');
const checklistTideMode = document.querySelector('#checklist-tide-mode');
const checklistPondTour = document.querySelector('#checklist-pond-tour');
const showPondTour = document.querySelector('#show-pond-tour');
const shortcutHelpToggle = document.querySelector('#shortcut-help-toggle');
const shortcutHelp = document.querySelector('#shortcut-help');
const shortcutHelpClose = document.querySelector('#shortcut-help-close');
const buttonHelpToggle = document.querySelector('#button-help-toggle');
const buttonHelpPanel = document.querySelector('#button-help-panel');
const buttonHelpClose = document.querySelector('#button-help-close');
const triageToggle = document.querySelector('#triage-toggle');
const triagePanel = document.querySelector('#triage-panel');
const triageClose = document.querySelector('#triage-close');
const triageStatus = document.querySelector('#triage-status');
const triageTaskTitle = document.querySelector('#triage-task-title');
const triageTaskMeta = document.querySelector('#triage-task-meta');
const triagePrev = document.querySelector('#triage-prev');
const triageNext = document.querySelector('#triage-next');
const triageComplete = document.querySelector('#triage-complete');
const triageArchive = document.querySelector('#triage-archive');
const triagePriority = document.querySelector('#triage-priority');
const triageDueEarlier = document.querySelector('#triage-due-earlier');
const triageDueLater = document.querySelector('#triage-due-later');
const castNet = document.querySelector('#cast-net');
const releaseSelected = document.querySelector('#release-selected');
const shoalControl = document.querySelector('#shoal-control');
const bulkShoalInput = document.querySelector('#bulk-shoal-input');
const moveShoal = document.querySelector('#move-shoal');
const pondTour = document.querySelector('#pond-tour');
const tourAddTask = document.querySelector('#tour-add-task');
const tourStockDemo = document.querySelector('#tour-stock-demo');
const tourPastePond = document.querySelector('#tour-paste-pond');
const tourTideMode = document.querySelector('#tour-tide-mode');
const tourCopyReport = document.querySelector('#tour-copy-report');
const dismissPondTour = document.querySelector('#dismiss-pond-tour');
const focusPanel = document.querySelector('#focus-panel');
const screenRoots = { auth: authScreen, pond: pondScreen, focus: focusPanel };
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
const trophiesToggle = document.querySelector('#trophies-toggle');
const trophiesPanel = document.querySelector('#trophies-panel');
const trophiesClose = document.querySelector('#trophies-close');
const trophiesList = document.querySelector('#trophies-list');
const trophiesSummary = document.querySelector('#trophies-summary');
const starterShoalsToggle = document.querySelector('#starter-shoals-toggle');
const starterShoalsPanel = document.querySelector('#starter-shoals-panel');
const starterShoalsClose = document.querySelector('#starter-shoals-close');
const reminderPrefsToggle = document.querySelector('#reminder-prefs-toggle');
const reminderPrefsPanel = document.querySelector('#reminder-prefs-panel');
const reminderPrefsClose = document.querySelector('#reminder-prefs-close');
const reminderPrefsStatus = document.querySelector('#reminder-prefs-status');
const reminderEnable = document.querySelector('#reminder-enable');
const quietStart = document.querySelector('#quiet-start');
const quietEnd = document.querySelector('#quiet-end');
const prefsToggle = document.querySelector('#prefs-toggle');
const prefsPanel = document.querySelector('#prefs-panel');
const prefsClose = document.querySelector('#prefs-close');
const prefReducedMotion = document.querySelector('#pref-reduced-motion');
const prefHighContrast = document.querySelector('#pref-high-contrast');
const prefDensity = document.querySelector('#pref-density');
const prefTextBadges = document.querySelector('#pref-text-badges');
const moreActionsToggle = document.querySelector('#more-actions-toggle');
const moreActionsPanel = document.querySelector('#more-actions-panel');
const activityLogToggle = document.querySelector('#activity-log-toggle');
const activityLogPanel = document.querySelector('#activity-log-panel');
const activityLogClose = document.querySelector('#activity-log-close');
const activityLogList = document.querySelector('#activity-log-list');
const shoalInput = document.querySelector('#shoal-input');
const formContextHint = document.querySelector('#form-context-hint');
const shoalDatalist = document.querySelector('#shoal-datalist');
const shoalFilterSelect = document.querySelector('#shoal-filter-select');
const commandPaletteEl = document.querySelector('#command-palette');
const commandSearch = document.querySelector('#command-search');
const commandList = document.querySelector('#command-list');
const commandPaletteToggle = document.querySelector('#command-palette-toggle');
const githubImportToggle = document.querySelector('#github-import-toggle');
const githubImportPanel = document.querySelector('#github-import-panel');
const githubImportClose = document.querySelector('#github-import-close');
const githubImportInput = document.querySelector('#github-import-input');
const githubImportParse = document.querySelector('#github-import-parse');
const githubImportPreview = document.querySelector('#github-import-preview');
const githubImportActions = document.querySelector('#github-import-actions');
const githubImportConfirm = document.querySelector('#github-import-confirm');
const githubImportSelectAll = document.querySelector('#github-import-select-all');

const tideGroups = [
  { key: 'washed', label: 'Washed ashore', description: 'Active overdue 鱼 looking sternly at you.' },
  { key: 'high', label: 'High tide', description: 'Active tasks due today or marked high priority.' },
  { key: 'ebbing', label: 'Ebbing', description: 'Active scheduled tasks due after today.' },
  { key: 'incoming', label: 'Incoming', description: 'Active unscheduled or low-pressure tasks.' },
  { key: 'completed', label: 'Resting shells', description: 'Completed tasks resting after the active work.' },
];

const celebrations = [
  'The task 鱼 has been fed. Begrudgingly proud of you.',
  'One less barnacle on the hull.',
  'A productive splash has occurred.',
];

let authToken = loadAuthToken();
let currentUser = null;
let pendingAuthMode = 'login';
let authRequestInFlight = false;
let todos = [];
let filter = loadLastFilter();
let searchQuery = '';
let quickFilter = '';
let shoalFilter = '';
let smartViews = loadSmartViews();
let dailyCatch = loadDailyCatch();
let premiumCalloutDismissed = loadPremiumCalloutDismissed();
let focusedTodoId = loadFocusedTodoId();
let tourDismissed = loadTourDismissed();
let firstTaskOnboardingDismissed = loadFirstTaskOnboardingDismissed();
let firstCompletionCelebrated = loadFirstCompletionCelebrated();
let overdueNudgeDismissed = false;
let tourForcedVisible = false;
let notifiedTodayIds = loadNotifiedTodayIds();
let notificationIntervalId = null;
let triageOpen = false;
let triageIndex = 0;
let viewPrefs = loadViewPrefs();
let focusSprint = createFocusSprint();
let focusSprintTimerId = null;
let netMode = false;
let editingTodoId = '';
let blockingTodoId = '';
let detailsTodoId = '';
let pendingEditFocusId = '';
let pendingEditReturnId = '';
let pendingTodoFocusTarget = null;
let selectedTodoIds = new Set();
const dirtyFormFields = new Set();
let saveQueue = Promise.resolve();
let saveVersion = 0;
let lastUndoAction = null;
let undoToastFocused = false;
let activityLog = [];
let pendingRestore = null;
let buttonHelpReturnFocus = null;
let currentScreen = '';
let suppressScreenHistory = false;
let lastSync = {
  state: 'never synced',
  at: '',
  message: 'No sync attempted yet.',
};
let lastRenderDuration = 0;
let renderDurations = [];
let commandPaletteOpen = false;
let commandPalettePriorFocus = null;
let commandPaletteActiveIndex = 0;


function requestedScreenKey() {
  return screenKeyFromLocation(window.location);
}

function desiredScreenKey() {
  return chooseScreenKey({
    signedIn: Boolean(currentUser),
    requestedScreen: requestedScreenKey(),
    hasFocusedTodo: Boolean(selectedFocusTodo()),
  });
}

function focusScreenEntry(screenKey) {
  const target = screenKey === 'auth'
    ? usernameInput
    : screenKey === 'focus'
      ? focusPanel
      : input;
  if (target && typeof target.focus === 'function') target.focus({ preventScroll: true });
}

function setScreen(nextScreen, options = {}) {
  const screenKey = normaliseScreenKey(nextScreen) || 'auth';
  const changed = currentScreen !== screenKey;
  const updateUrl = options.updateUrl !== false;
  const hash = `#${screenKey}`;

  currentScreen = screenKey;
  Object.entries(screenRoots).forEach(([key, root]) => {
    if (root) root.hidden = key !== screenKey;
  });
  document.body.dataset.screen = screenKey;

  if (updateUrl && window.location.hash !== hash) {
    const method = options.replace ? 'replaceState' : 'pushState';
    window.history[method]({ screen: screenKey }, '', hash);
  }

  if (changed || options.focus) focusScreenEntry(screenKey);
}

function syncScreen(options = {}) {
  setScreen(desiredScreenKey(), options);
}

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
  undoToast.hidden = true;
  undoToast.classList.remove('paused');
  undoToastProgress.style.animation = '';
  lastUndoAction = null;
}

function pauseUndoToastTimer() {
  if (!lastUndoAction?.timeoutId) return;
  window.clearTimeout(lastUndoAction.timeoutId);
  lastUndoAction.timeoutId = null;
  lastUndoAction.remainingMs = Math.max(0, lastUndoAction.remainingMs - (Date.now() - lastUndoAction.startedAt));
  undoToast.classList.add('paused');
}

function scheduleUndoToastDismiss() {
  if (!lastUndoAction || undoToastFocused) return;
  if (lastUndoAction.timeoutId) window.clearTimeout(lastUndoAction.timeoutId);
  lastUndoAction.startedAt = Date.now();
  lastUndoAction.timeoutId = window.setTimeout(() => {
    if (lastUndoAction) clearUndoAction();
  }, lastUndoAction.remainingMs);
  undoToast.classList.remove('paused');
}

function showUndoToast() {
  if (!lastUndoAction) return;
  undoToastMessage.textContent = lastUndoAction.message;
  undoToast.hidden = false;
  undoToastProgress.style.animation = 'none';
  void undoToastProgress.offsetHeight; // Restart the progress animation.
  undoToastProgress.style.animation = `undo-toast-progress ${lastUndoAction.remainingMs}ms linear forwards`;
  scheduleUndoToastDismiss();
}

function setUndoAction({ todos: previousTodos, focusedTodoId: previousFocus, selectedTodoIds: previousSelection, netMode: previousNetMode, message, confirmation }) {
  clearUndoAction();
  lastUndoAction = {
    todos: previousTodos,
    focusedTodoId: previousFocus,
    selectedTodoIds: previousSelection,
    netMode: previousNetMode,
    message,
    confirmation,
    timeoutId: null,
    remainingMs: 5000,
    startedAt: 0,
  };
  showUndoToast();
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

function normaliseGithubUrl(value) {
  if (value === undefined || value === null || value === '') return '';
  if (typeof value !== 'string') return '';

  let parsed;
  try {
    parsed = new window.URL(value.trim());
  } catch {
    return '';
  }

  const [owner, repo, type, number] = parsed.pathname.split('/').filter(Boolean);
  const validPath = owner && repo && ['issues', 'pull'].includes(type) && /^[1-9]\d*$/.test(number);
  if (parsed.protocol !== 'https:' || parsed.hostname !== 'github.com' || !validPath) return '';
  return `https://github.com/${owner}/${repo}/${type}/${number}`;
}

function normaliseChecklist(value) {
  if (!Array.isArray(value)) return [];
  const checklist = [];
  const seenIds = new Set();

  value.forEach((item) => {
    if (!item || typeof item !== 'object' || checklist.length >= MAX_CHECKLIST_ITEMS) return;
    const text = typeof item.text === 'string' ? item.text.trim().slice(0, MAX_CHECKLIST_TEXT_LENGTH) : '';
    if (!text) return;
    const candidateId = typeof item.id === 'string' ? item.id.trim().slice(0, 80) : '';
    const id = candidateId && !seenIds.has(candidateId) ? candidateId : crypto.randomUUID();
    seenIds.add(id);
    checklist.push({ id, text, completed: Boolean(item.completed) });
  });

  return checklist;
}

function checklistProgress(todo) {
  const checklist = normaliseChecklist(todo.checklist);
  if (checklist.length === 0) return '';
  const completed = checklist.filter((item) => item.completed).length;
  return `${completed}/${checklist.length} scales`;
}

function githubLinkInfo(url) {
  const normalised = normaliseGithubUrl(url);
  if (!normalised) return null;
  const [, , type, number] = new window.URL(normalised).pathname.split('/').filter(Boolean);
  return {
    url: normalised,
    label: `#${number} ${type === 'pull' ? 'PR' : 'issue'}`,
  };
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
    shoal: typeof todo.shoal === 'string' ? todo.shoal.trim().slice(0, 40) : '',
    blocked: Boolean(todo.blocked),
    blockerReason: typeof todo.blockerReason === 'string' ? todo.blockerReason.trim().slice(0, 160) : '',
    githubUrl: normaliseGithubUrl(todo.githubUrl),
    notes: typeof todo.notes === 'string' ? todo.notes.trim().slice(0, MAX_NOTES_LENGTH) : '',
    checklist: normaliseChecklist(todo.checklist),
    recurrence: normaliseRecurrence(todo.recurrence),
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

function loadFirstTaskOnboardingDismissed() {
  try {
    return localStorage.getItem(FIRST_TASK_ONBOARDING_DISMISSED_KEY) === 'true';
  } catch {
    return false;
  }
}

function loadFirstCompletionCelebrated() {
  try {
    return localStorage.getItem(FIRST_COMPLETION_CELEBRATED_KEY) === 'true';
  } catch {
    return false;
  }
}

function loadSmartViews() {
  try {
    const parsed = JSON.parse(localStorage.getItem(SMART_VIEWS_KEY) ?? '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((view) => view && typeof view.name === 'string')
      .slice(0, 8)
      .map((view) => ({
        id: typeof view.id === 'string' ? view.id : crypto.randomUUID(),
        name: view.name.trim().slice(0, 32),
        filter: typeof view.filter === 'string' ? view.filter : 'all',
        quickFilter: typeof view.quickFilter === 'string' ? view.quickFilter : '',
        searchQuery: typeof view.searchQuery === 'string' ? view.searchQuery : '',
      }))
      .filter((view) => view.name);
  } catch {
    return [];
  }
}

function persistSmartViews() {
  try {
    localStorage.setItem(SMART_VIEWS_KEY, JSON.stringify(smartViews));
  } catch {
    showPondMessage('Could not save that smart view in this browser.');
  }
}

function loadPremiumCalloutDismissed() {
  try {
    return localStorage.getItem(PREMIUM_CALLOUT_DISMISSED_KEY) === 'true';
  } catch {
    return false;
  }
}

function dismissPremiumCallout() {
  premiumCalloutDismissed = true;
  try {
    localStorage.setItem(PREMIUM_CALLOUT_DISMISSED_KEY, 'true');
  } catch {
    showPondMessage('Upgrade note dismissed, but this browser could not remember it.');
  }
  renderUpgradeCallout();
}

function loadDailyCatch() {
  try {
    const parsed = JSON.parse(localStorage.getItem(DAILY_CATCH_KEY) ?? '{}');
    if (parsed.date !== todayKey()) return { date: todayKey(), ids: [] };
    return {
      date: parsed.date,
      ids: Array.isArray(parsed.ids) ? parsed.ids.filter((id) => typeof id === 'string') : [],
    };
  } catch {
    return { date: todayKey(), ids: [] };
  }
}

function persistDailyCatch() {
  dailyCatch = { date: todayKey(), ids: dailyCatch.ids.filter((id) => todos.some((todo) => todo.id === id && !todo.archivedAt)) };
  try {
    localStorage.setItem(DAILY_CATCH_KEY, JSON.stringify(dailyCatch));
  } catch {
    showPondMessage('Could not save today’s catch in this browser.');
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

function loadNotifiedTodayIds() {
  try {
    const raw = localStorage.getItem(NOTIFIED_TODAY_KEY);
    if (!raw) return new Set();
    const data = JSON.parse(raw);
    if (data.date !== todayKey()) return new Set();
    return new Set(Array.isArray(data.ids) ? data.ids : []);
  } catch {
    return new Set();
  }
}

function saveNotifiedTodayIds() {
  try {
    localStorage.setItem(NOTIFIED_TODAY_KEY, JSON.stringify({
      date: todayKey(),
      ids: [...notifiedTodayIds],
    }));
  } catch {
    // Ignore: this cache only suppresses duplicate reminders for the current day.
  }
}

function saveFirstTaskOnboardingDismissed(value) {
  firstTaskOnboardingDismissed = value;
  try {
    if (value) localStorage.setItem(FIRST_TASK_ONBOARDING_DISMISSED_KEY, 'true');
    else localStorage.removeItem(FIRST_TASK_ONBOARDING_DISMISSED_KEY);
  } catch {
    showStorageError('First-task guide preference changed, but could not be saved in this browser.');
  }
}

function saveFirstCompletionCelebrated(value) {
  firstCompletionCelebrated = value;
  try {
    if (value) localStorage.setItem(FIRST_COMPLETION_CELEBRATED_KEY, 'true');
    else localStorage.removeItem(FIRST_COMPLETION_CELEBRATED_KEY);
  } catch {
    showStorageError('First-completion celebration changed, but could not be saved in this browser.');
  }
}

function loadViewPrefs() {
  const systemReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  const defaults = {
    reducedMotion: systemReducedMotion,
    highContrast: false,
    density: 'comfortable',
    textBadges: false,
    addFormAdvanced: false,
    [GETTING_STARTED_PREF_KEY]: null,
    [GETTING_STARTED_AUTO_COLLAPSED_KEY]: false,
  };
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return defaults;
    const saved = JSON.parse(raw);
    return {
      reducedMotion: typeof saved.reducedMotion === 'boolean' ? saved.reducedMotion : defaults.reducedMotion,
      highContrast: typeof saved.highContrast === 'boolean' ? saved.highContrast : false,
      density: (() => { const VALID_DENSITY = ['condensed', 'comfortable', 'detailed']; return VALID_DENSITY.includes(saved.density) ? saved.density : (saved.compact ? 'condensed' : 'comfortable'); })(),
      textBadges: typeof saved.textBadges === 'boolean' ? saved.textBadges : false,
      addFormAdvanced: typeof saved.addFormAdvanced === 'boolean' ? saved.addFormAdvanced : false,
      [GETTING_STARTED_PREF_KEY]: typeof saved[GETTING_STARTED_PREF_KEY] === 'boolean'
        ? saved[GETTING_STARTED_PREF_KEY]
        : null,
      [GETTING_STARTED_AUTO_COLLAPSED_KEY]: typeof saved[GETTING_STARTED_AUTO_COLLAPSED_KEY] === 'boolean'
        ? saved[GETTING_STARTED_AUTO_COLLAPSED_KEY]
        : false,
    };
  } catch {
    return defaults;
  }
}

function saveViewPrefs() {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(viewPrefs));
  } catch {
    showStorageError('Preferences changed, but could not be saved in this browser.');
  }
}

const VALID_FILTERS = ['all', 'active', 'completed', 'archive', 'week', 'tide', 'ghost'];

function loadLastFilter() {
  const saved = localStorage.getItem(LAST_FILTER_KEY);
  return VALID_FILTERS.includes(saved) ? saved : 'all';
}

function saveLastFilter() {
  try {
    localStorage.setItem(LAST_FILTER_KEY, filter);
  } catch { /* ignore storage errors for non-critical state */ }
}

function overdueActiveTodoCount() {
  const today = todayKey();
  return todos.filter((t) => !t.completed && !t.archivedAt && t.dueDate && t.dueDate < today).length;
}

function renderOverdueNudge() {
  const nudge = document.querySelector('#overdue-nudge');
  if (!nudge) return;
  const showOnFilter = ['all', 'active'].includes(filter);
  const count = overdueActiveTodoCount();
  if (!showOnFilter || count < OVERDUE_NUDGE_MIN || overdueNudgeDismissed) {
    nudge.hidden = true;
    return;
  }
  nudge.hidden = false;
  nudge.querySelector('.overdue-nudge-text').textContent =
    `${count} overdue task${count === 1 ? '' : 's'} — switch to Tide mode to prioritise them.`;
}

function applyViewPrefs() {
  const root = document.documentElement;
  root.dataset.motion = viewPrefs.reducedMotion ? 'reduced' : 'full';
  root.dataset.contrast = viewPrefs.highContrast ? 'high' : 'default';
  root.dataset.density = viewPrefs.density || 'comfortable';
  root.dataset.badges = viewPrefs.textBadges ? 'text-first' : 'default';
  renderAddFormMode();
}

function setAddFormAdvanced(expanded) {
  if (!expanded) resetAdvancedAddFields();
  viewPrefs = { ...viewPrefs, addFormAdvanced: Boolean(expanded) };
  saveViewPrefs();
  renderAddFormMode();
}

function resetAdvancedAddFields() {
  dueDateInput.value = '';
  githubUrlInput.value = '';
  priorityInput.value = 'medium';
  recurrenceInput.value = 'none';
  syncPriorityChips();
}

function contextFormDefaults() {
  const defaults = {};
  if (shoalFilter) defaults.shoal = shoalFilter;
  if (quickFilter === 'high') defaults.priority = 'high';
  if (quickFilter === 'due-soon' || filter === 'week' || !dailyCatchPanel.hidden) defaults.dueDate = todayKey();
  return defaults;
}

function visibleContextDefaults(defaults) {
  return Object.fromEntries(Object.entries(defaults).filter(([field]) => !dirtyFormFields.has(field)));
}

function updateContextHint(defaults) {
  if (!formContextHint) return;
  const parts = [];
  if (defaults.shoal) parts.push(`Shoal: ${defaults.shoal}`);
  if (defaults.priority && defaults.priority !== 'medium') {
    parts.push(`${defaults.priority[0].toUpperCase()}${defaults.priority.slice(1)} priority`);
  }
  if (defaults.dueDate) parts.push('Due today');
  if (parts.length === 0) {
    formContextHint.hidden = true;
    return;
  }
  formContextHint.textContent = `Context: ${parts.join(' · ')}`;
  formContextHint.hidden = false;
}

function applyContextDefaults() {
  const defaults = contextFormDefaults();
  const visibleDefaults = visibleContextDefaults(defaults);
  if (!dirtyFormFields.has('priority')) {
    priorityInput.value = defaults.priority || 'medium';
    syncPriorityChips();
  }
  if (!dirtyFormFields.has('dueDate')) {
    dueDateInput.value = defaults.dueDate || '';
  }
  if (!dirtyFormFields.has('shoal') && shoalInput) {
    shoalInput.value = defaults.shoal || '';
  }
  updateContextHint(visibleDefaults);
}

function renderAddFormMode() {
  if (!advancedAddToggle || !advancedAddFields) return;
  const expanded = Boolean(viewPrefs.addFormAdvanced);
  advancedAddFields.hidden = !expanded;
  advancedAddToggle.setAttribute('aria-expanded', String(expanded));
  advancedAddToggle.textContent = expanded ? '− fewer options' : '+ more options';
}

function setPrefsOpen(open) {
  prefsPanel.hidden = !open;
  prefsToggle.setAttribute('aria-expanded', String(open));
  if (open) {
    prefReducedMotion.checked = viewPrefs.reducedMotion;
    prefHighContrast.checked = viewPrefs.highContrast;
    if (prefDensity) prefDensity.value = viewPrefs.density || 'comfortable';
    prefTextBadges.checked = viewPrefs.textBadges;
    prefsPanel.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
}

function logActivity(action, todoText) {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const at = `${hh}:${mm}`;
  const trimTo40 = String(todoText || '').slice(0, 40);
  activityLog.unshift({ action, text: trimTo40, at });
  if (activityLog.length > MAX_ACTIVITY_LOG) activityLog = activityLog.slice(0, MAX_ACTIVITY_LOG);
  renderActivityLog();
}

function setMoreActionsOpen(open) {
  moreActionsPanel.hidden = !open;
  moreActionsToggle.setAttribute('aria-expanded', String(open));
  if (open) {
    moreActionsPanel.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  } else {
    moreActionsToggle.focus();
  }
}

function setActivityLogOpen(open) {
  activityLogPanel.hidden = !open;
  activityLogToggle.setAttribute('aria-expanded', String(open));
  if (open) {
    activityLogPanel.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    activityLogClose.focus();
  } else {
    activityLogToggle.focus();
  }
}

function setGithubImportOpen(open) {
  githubImportPanel.hidden = !open;
  githubImportToggle.setAttribute('aria-expanded', String(open));
  if (open) {
    githubImportPanel.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    githubImportClose.focus({ preventScroll: true });
  } else {
    githubImportToggle.focus({ preventScroll: true });
  }
}

function renderGithubImportPreview(items, rateLimitHit) {
  if (!items || items.length === 0) {
    githubImportPreview.hidden = false;
    githubImportPreview.textContent = 'No valid GitHub issue or PR URLs found.';
    githubImportActions.hidden = true;
    return;
  }
  const container = document.createDocumentFragment();
  if (rateLimitHit) {
    const warning = document.createElement('p');
    warning.className = 'github-import-rate-limit-warning';
    warning.textContent = 'GitHub rate limit reached — some titles are shown as fallback labels. Try again in a few minutes.';
    container.append(warning);
  }
  const list = document.createElement('ul');
  list.className = 'github-import-preview-list';
  items.forEach((item) => {
    const li = document.createElement('li');
    li.className = `github-import-preview-item${item.duplicate ? ' github-import-preview-item--duplicate' : ''}`;
    const label = document.createElement('label');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.value = item.url;
    checkbox.dataset.title = item.title;
    if (!item.duplicate) {
      checkbox.checked = true;
    } else {
      checkbox.disabled = true;
    }
    const span = document.createElement('span');
    span.textContent = item.title;
    if (item.duplicate) {
      const badge = document.createElement('span');
      badge.className = 'github-import-duplicate-badge';
      badge.textContent = ' (already in pond)';
      span.append(badge);
    }
    label.append(checkbox, span);
    li.append(label);
    list.append(li);
  });
  container.append(list);
  githubImportPreview.hidden = false;
  githubImportPreview.replaceChildren(container);
  githubImportActions.hidden = false;
}

function confirmGithubImport() {
  const checkboxes = [...githubImportPreview.querySelectorAll('input[type="checkbox"]:checked')];
  checkboxes.forEach((checkbox) => {
    const url = checkbox.value;
    const title = checkbox.dataset.title || url;
    addTodo(title, { githubUrl: url, priority: 'medium', source: 'github_import' });
  });
  setGithubImportOpen(false);
  githubImportInput.value = '';
  githubImportPreview.hidden = true;
  githubImportPreview.replaceChildren();
  githubImportActions.hidden = true;
  if (checkboxes.length > 0) showPondMessage(`Imported ${checkboxes.length} task${checkboxes.length === 1 ? '' : 's'} from GitHub.`);
}

function renderActivityLog() {
  if (!activityLogList) return;
  activityLogList.replaceChildren();
  if (activityLog.length === 0) {
    const li = document.createElement('li');
    li.className = 'activity-entry activity-entry--empty';
    li.textContent = 'No recent actions.';
    activityLogList.append(li);
  } else {
    activityLog.forEach(({ action, text, at }) => {
      const li = document.createElement('li');
      li.className = 'activity-entry';
      li.textContent = `${at} — ${action}: ${text}`;
      activityLogList.append(li);
    });
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
  if (!response.ok) {
    const error = new Error(body.error || 'The server could not complete that request.');
    error.field = body.field || '';
    error.code = body.code || '';
    throw error;
  }
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

function baseVisibleTodos() {
  const live = liveTodos();
  if (filter === 'archive') return todos.filter((todo) => todo.archivedAt);
  if (filter === 'active') return live.filter((todo) => !todo.completed);
  if (filter === 'completed') return live.filter((todo) => todo.completed);
  if (filter === 'week') {
    const today = todayKey();
    const weekEnd = addDays(today, 6);
    return live.filter((todo) => !todo.completed && todo.dueDate && todo.dueDate <= weekEnd);
  }
  return live;
}

function normalisedSearchQuery() {
  return searchQuery.trim().toLowerCase();
}

function matchesSearch(todo) {
  const query = normalisedSearchQuery();
  if (!query) return true;
  return todo.text.toLowerCase().includes(query);
}

function matchesQuickFilter(todo) {
  const today = todayKey();
  if (quickFilter === 'high') return todo.priority === 'high';
  if (quickFilter === 'due-soon') {
    const dueSoonEnd = addDays(today, 3);
    return !todo.completed && todo.dueDate && todo.dueDate >= today && todo.dueDate <= dueSoonEnd;
  }
  if (quickFilter === 'no-due-date') return !todo.dueDate;
  if (quickFilter === 'selected-net') return netMode && selectedTodoIds.has(todo.id);
  return true;
}

function filterTodos(items) {
  return items.filter((todo) => matchesSearch(todo) && matchesQuickFilter(todo));
}

function filteredTodos(items) {
  return sortTodos(filterTodos(items));
}

function visibleTodos() {
  let filtered = filterTodos(baseVisibleTodos());
  if (shoalFilter) filtered = filtered.filter((todo) => todo.shoal === shoalFilter);
  return filter === 'archive' ? sortArchivedTodos(filtered) : sortTodos(filtered);
}

function setShoalFilter(name) {
  shoalFilter = name;
  if (shoalFilterSelect) shoalFilterSelect.value = name;
  render();
  applyContextDefaults();
}

function updateShoalDatalist() {
  if (!shoalDatalist) return;
  const names = [...new Set(todos.map((t) => t.shoal).filter(Boolean))].sort();
  shoalDatalist.replaceChildren(...names.map((name) => {
    const opt = document.createElement('option');
    opt.value = name;
    return opt;
  }));
  if (shoalFilterSelect) {
    const currentVal = shoalFilterSelect.value;
    shoalFilterSelect.replaceChildren(
      Object.assign(document.createElement('option'), { value: '', textContent: 'All shoals' }),
      ...names.map((name) => Object.assign(document.createElement('option'), { value: name, textContent: name })),
    );
    shoalFilterSelect.value = names.includes(currentVal) ? currentVal : '';
    if (shoalFilterSelect.value !== currentVal) shoalFilter = '';
  }
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
  // Tide renders filtered live todos across groups; Ghost net uses its own review set.
  if (filter === 'tide') return new Set(filteredTodos(liveTodos()).map((todo) => todo.id));
  if (filter === 'ghost') return new Set(ghostNetTodos().map((todo) => todo.id));
  return new Set(visibleTodos().map((todo) => todo.id));
}

function hasActiveSearchFilter() {
  return Boolean(normalisedSearchQuery() || quickFilter);
}

function currentSmartViewName() {
  const parts = [];
  if (filter !== 'all') parts.push(filter.replace('-', ' '));
  if (quickFilter) parts.push(quickFilter.replace('-', ' '));
  if (normalisedSearchQuery()) parts.push('search ' + searchQuery.trim());
  return parts.length > 0 ? parts.join(' + ') : 'All 鱼';
}

function saveCurrentSmartView() {
  const name = (smartViewName.value || currentSmartViewName()).trim().slice(0, 32);
  if (!name) {
    showPondMessage('Name this smart view before saving it.');
    smartViewName.focus();
    return;
  }

  const view = { id: crypto.randomUUID(), name, filter, quickFilter, searchQuery: searchQuery.trim() };
  smartViews = [view, ...smartViews.filter((savedView) => savedView.name.toLowerCase() !== name.toLowerCase())].slice(0, 8);
  persistSmartViews();
  smartViewName.value = '';
  render();
  showPondMessage('Saved smart view: ' + name + '.');
}

function applySmartView(viewId) {
  const view = smartViews.find((savedView) => savedView.id === viewId);
  if (!view) return;
  selectedTodoIds.clear();
  filter = view.filter;
  quickFilter = view.quickFilter;
  searchQuery = view.searchQuery;
  render();
  showPondMessage('Applied smart view: ' + view.name + '.');
}

function deleteSmartView(viewId) {
  const view = smartViews.find((savedView) => savedView.id === viewId);
  smartViews = smartViews.filter((savedView) => savedView.id !== viewId);
  persistSmartViews();
  render();
  if (view) showPondMessage('Deleted smart view: ' + view.name + '.');
}

function runEmptyStateAction(action) {
  if (action === 'clear-search' || action === 'clear-filter') {
    clearSearchState();
    render();
    taskSearch.focus();
    return;
  }
  if (action === 'show-completed') {
    setFilter('completed');
    return;
  }
  if (action === 'show-active') {
    setFilter('active');
    return;
  }
  if (action === 'show-all') {
    setFilter('all');
  }
}

function renderEmptyStateActions(state) {
  emptyStateActions.replaceChildren();
  if (!state?.cta) return;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'secondary-action';
  button.textContent = state.cta.label;
  button.addEventListener('click', () => runEmptyStateAction(state.cta.action));
  emptyStateActions.append(button);
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
  const emojiSeed = todo.id || todo.text;
  if (todo.completed) return { emoji: 鱼EmojiFor('resting', emojiSeed), text: 'Resting shell', className: 'mood-resting' };
  if (tide === 'washed' && todo.priority === 'high') {
    return { emoji: 鱼EmojiFor('emergency', emojiSeed), text: 'Tentacular emergency', className: 'mood-emergency' };
  }
  if (todo.priority === 'high') return { emoji: 鱼EmojiFor('high', emojiSeed), text: 'Puffed up', className: 'mood-high' };
  if (!todo.dueDate) return { emoji: 鱼EmojiFor('mythical', emojiSeed), text: 'Mythical commitment', className: 'mood-mythical' };
  if (todo.priority === 'medium') return { emoji: 鱼EmojiFor('medium', emojiSeed), text: 'Sideways but moving', className: 'mood-medium' };
  return { emoji: 鱼EmojiFor('normal', emojiSeed), text: 'Swimming nicely', className: 'mood-normal' };
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

function recurrenceLabelFor(todo) {
  return recurrenceLabel(todo.recurrence);
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

  const githubMatch = text.match(/https:\/\/github\.com\/[^\s)]+\/[^\s)]+\/(?:issues|pull)\/[1-9]\d*(?:[^\s)]*)?/i);
  const githubUrl = githubMatch ? normaliseGithubUrl(githubMatch[0]) : '';
  if (githubMatch) text = text.replace(githubMatch[0], '').trim();

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
  return { text, priority, dueDate, githubUrl };
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
    pastePreview.textContent = `The pond is full at ${MAX_TODOS} tasks. Release a 鱼 before importing.`;
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

function setButtonHelpOpen(open) {
  buttonHelpPanel.hidden = !open;
  buttonHelpToggle.setAttribute('aria-expanded', String(open));
  if (open) {
    buttonHelpReturnFocus = document.activeElement && typeof document.activeElement.focus === 'function' ? document.activeElement : buttonHelpToggle;
    buttonHelpPanel.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    buttonHelpClose.focus({ preventScroll: true });
  } else if (buttonHelpReturnFocus && typeof buttonHelpReturnFocus.focus === 'function') {
    buttonHelpReturnFocus.focus({ preventScroll: true });
    buttonHelpReturnFocus = null;
  }
}

function renderUpgradeCallout() {
  const hook = premiumHookForSurface('sharing');
  const shouldShow = Boolean(currentUser) && !premiumCalloutDismissed && Boolean(hook);
  upgradeCallout.hidden = !shouldShow;
  if (!shouldShow || !hook) return;
  upgradeCalloutTitle.textContent = hook.title;
  upgradeCalloutBody.textContent = hook.body;
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
  dirtyFormFields.add('priority');
  applyContextDefaults();
  showPondMessage(priority[0].toUpperCase() + priority.slice(1) + ' tide selected for the next 鱼.');
}

function toggleShortcutHelp() {
  setShortcutHelpOpen(shortcutHelp.hidden);
}

const COMMANDS = [
  { id: 'filter-all', label: 'Show all tasks', action: () => setFilter('all') },
  { id: 'filter-active', label: 'Show active tasks', action: () => setFilter('active') },
  { id: 'filter-completed', label: 'Show completed tasks', action: () => setFilter('completed') },
  { id: 'filter-tide', label: 'Switch to Tide mode', action: () => setFilter('tide') },
  { id: 'filter-ghost', label: 'Switch to Ghost net review', action: () => setFilter('ghost') },
  { id: 'copy-pond-report', label: 'Copy pond report', action: () => copyPondProgressReport() },
  { id: 'pond-health', label: 'Open pond health', action: () => setPondHealthOpen(true) },
  { id: 'keyboard-shortcuts', label: 'Show keyboard shortcuts', action: () => setShortcutHelpOpen(true) },
  { id: 'triage-mode', label: 'Open triage mode', action: () => setTriageOpen(true) },
  { id: 'add-task', label: 'Add a task', action: () => { input.focus(); input.select(); } },
  { id: 'search-tasks', label: 'Search tasks', action: () => { taskSearch.focus(); taskSearch.select(); } },
  { id: 'log-out', label: 'Log out', action: () => logout() },
];

function openCommandPalette() {
  commandPalettePriorFocus = document.activeElement;
  commandPaletteOpen = true;
  commandPaletteEl.hidden = false;
  commandPaletteActiveIndex = 0;
  renderCommandList('');
  commandSearch.value = '';
  commandSearch.focus();
}

function closeCommandPalette() {
  commandPaletteOpen = false;
  commandPaletteEl.hidden = true;
  commandPaletteActiveIndex = 0;
  commandSearch.removeAttribute('aria-activedescendant');
  if (commandPalettePriorFocus && typeof commandPalettePriorFocus.focus === 'function') {
    commandPalettePriorFocus.focus();
  }
  commandPalettePriorFocus = null;
}

function commandPaletteFocusableElements() {
  return [...commandPaletteEl.querySelectorAll(
    'button, input, select, textarea, [href], [tabindex]:not([tabindex="-1"])',
  )].filter((element) => !element.disabled && element.offsetParent !== null);
}

function trapCommandPaletteFocus(event) {
  if (!commandPaletteOpen || event.key !== 'Tab') return;
  const focusable = commandPaletteFocusableElements();
  if (focusable.length === 0) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (focusable.length === 1) {
    event.preventDefault();
    first.focus();
    return;
  }
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

function renderCommandList(query) {
  const q = query.toLowerCase().trim();
  const filtered = q ? COMMANDS.filter((c) => c.label.toLowerCase().includes(q)) : COMMANDS;
  commandList.replaceChildren();
  if (filtered.length === 0) {
    commandSearch.removeAttribute('aria-activedescendant');
    const empty = document.createElement('li');
    empty.className = 'command-list-empty';
    empty.textContent = 'No matching commands.';
    commandList.appendChild(empty);
    return;
  }
  if (commandPaletteActiveIndex >= filtered.length) commandPaletteActiveIndex = 0;
  filtered.forEach((cmd, idx) => {
    const li = document.createElement('li');
    li.setAttribute('role', 'option');
    li.setAttribute('aria-selected', String(idx === commandPaletteActiveIndex));
    li.id = `command-option-${cmd.id}`;
    li.textContent = cmd.label;
    if (idx === commandPaletteActiveIndex) li.classList.add('command-list-active');
    li.addEventListener('click', () => {
      closeCommandPalette();
      cmd.action();
    });
    commandList.appendChild(li);
  });
  commandSearch.setAttribute('aria-activedescendant', `command-option-${filtered[commandPaletteActiveIndex].id}`);
}

function navigateCommandList(direction) {
  const items = [...commandList.querySelectorAll('li[role="option"]')];
  if (items.length === 0) return;
  commandPaletteActiveIndex = (commandPaletteActiveIndex + direction + items.length) % items.length;
  items.forEach((li, idx) => {
    li.setAttribute('aria-selected', String(idx === commandPaletteActiveIndex));
    li.classList.toggle('command-list-active', idx === commandPaletteActiveIndex);
  });
  if (items[commandPaletteActiveIndex]) {
    items[commandPaletteActiveIndex].scrollIntoView({ block: 'nearest' });
    commandSearch.setAttribute('aria-activedescendant', items[commandPaletteActiveIndex].id);
  }
}

function executeActiveCommand() {
  const q = commandSearch.value.toLowerCase().trim();
  const filtered = q ? COMMANDS.filter((c) => c.label.toLowerCase().includes(q)) : COMMANDS;
  if (filtered.length === 0) return;
  const idx = Math.min(commandPaletteActiveIndex, filtered.length - 1);
  const cmd = filtered[idx];
  if (cmd) {
    closeCommandPalette();
    cmd.action();
  }
}

function clearPasteInput() {
  pasteInput.value = '';
  updatePastePreview();
  pasteInput.focus();
}

function exportedTodo(todo) {
  return {
    id: todo.id,
    text: todo.text,
    completed: todo.completed,
    createdAt: todo.createdAt,
    dueDate: todo.dueDate,
    priority: todo.priority,
    githubUrl: todo.githubUrl,
    archivedAt: todo.archivedAt,
    notes: todo.notes,
    checklist: todo.checklist,
  };
}

function buildPondBackup() {
  return {
    source: 'dactyl-sandbox',
    version: POND_EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    tasks: normaliseTodos(todos).map(exportedTodo),
  };
}

function backupFileName() {
  return `dactyl-pond-backup-${todayKey()}.json`;
}

function downloadJsonFile(filename, data) {
  const blob = new window.Blob([`${JSON.stringify(data, null, 2)}\n`], { type: 'application/json' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

function downloadIcsFile(filename, content) {
  const blob = new window.Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

function exportCalendar() {
  if (!currentUser) return;
  const ics = window.CalendarExport.generateIcs(todos);
  downloadIcsFile('dactyl-pond.ics', ics);
}

function exportPondBackup() {
  if (!currentUser) return;
  const backup = buildPondBackup();
  downloadJsonFile(backupFileName(), backup);
  trackProductEvent('export_created', { taskCount: backup.tasks.length });
  showPondMessage(`Exported ${pluralise(backup.tasks.length, '鱼', '鱼')} as a JSON pond backup.`);
}

function backupTasksFromJson(value) {
  if (!value || typeof value !== 'object') throw new Error('This file is not a Dactyl pond backup.');
  if (value.source && value.source !== 'dactyl-sandbox') throw new Error('This backup came from an unsupported source.');
  if (Number(value.version || 1) > POND_EXPORT_VERSION) throw new Error('This backup was made by a newer Dactyl version.');
  const tasks = Array.isArray(value.tasks) ? value.tasks : value.todos;
  if (!Array.isArray(tasks)) throw new Error('This backup does not contain a task list.');
  return tasks;
}

function normaliseBackupTask(task, seenIds) {
  if (!task || typeof task !== 'object') return null;
  const candidateId = typeof task.id === 'string' ? task.id.trim() : '';
  const id = candidateId && !seenIds.has(candidateId) ? candidateId : crypto.randomUUID();
  seenIds.add(id);
  return normaliseTodo({
    id,
    text: task.text,
    completed: task.completed,
    createdAt: task.createdAt,
    dueDate: task.dueDate,
    priority: task.priority,
    archivedAt: task.archivedAt,
    githubUrl: task.githubUrl,
    notes: task.notes,
    checklist: task.checklist,
  });
}

function duplicateRestoreHints(imported) {
  const existingKeys = new Set(todos.map((todo) => `${todo.text.trim().toLowerCase()}|${todo.dueDate || ''}`));
  return imported.filter((todo) => existingKeys.has(`${todo.text.trim().toLowerCase()}|${todo.dueDate || ''}`)).length;
}

function updateRestorePreview() {
  const readyCount = pendingRestore?.todos.length ?? 0;
  mergeRestore.disabled = !currentUser || readyCount === 0 || todos.length >= MAX_TODOS;
  replaceRestore.disabled = !currentUser || readyCount === 0;

  if (!pendingRestore) return;

  const remainingSlots = Math.max(0, MAX_TODOS - todos.length);
  const mergeableCount = Math.min(readyCount, remainingSlots);
  const parts = [
    `${pluralise(readyCount, '鱼', '鱼')} ready`,
    `${pendingRestore.skippedCount} skipped`,
  ];
  if (pendingRestore.duplicateHints > 0) parts.push(`${pluralise(pendingRestore.duplicateHints, 'possible duplicate')} by title/date`);
  if (mergeableCount < readyCount) parts.push(`${mergeableCount} can be merged before the ${MAX_TODOS}-鱼 pond limit`);
  restorePreview.textContent = `${parts.join(' · ')}. Merge keeps existing 鱼; replace requires confirmation.`;
}

function setRestorePanelOpen(open) {
  restorePanel.hidden = !open;
  restorePondToggle.setAttribute('aria-expanded', String(open));
  if (open) {
    updateRestorePreview();
    restoreFile.focus();
  }
}

function clearRestoreSelection() {
  pendingRestore = null;
  restoreFile.value = '';
  restorePreview.textContent = 'Choose a backup file to preview its 鱼.';
  updateRestorePreview();
}

async function previewRestoreFile() {
  const [file] = restoreFile.files;
  pendingRestore = null;
  if (!file) {
    clearRestoreSelection();
    return;
  }

  try {
    const parsed = JSON.parse(await file.text());
    const rawTasks = backupTasksFromJson(parsed);
    const seenIds = new Set();
    const importedTodos = rawTasks
      .map((task) => normaliseBackupTask(task, seenIds))
      .filter(Boolean)
      .slice(0, MAX_TODOS);
    pendingRestore = {
      todos: importedTodos,
      skippedCount: Math.max(0, rawTasks.length - importedTodos.length),
      duplicateHints: duplicateRestoreHints(importedTodos),
    };
    updateRestorePreview();
  } catch (error) {
    pendingRestore = null;
    restorePreview.textContent = `Could not read this backup: ${error.message}`;
    updateRestorePreview();
  }
}

function applyRestore(mode) {
  if (!currentUser || !pendingRestore || pendingRestore.todos.length === 0) return;

  const imported = normaliseTodos(pendingRestore.todos);
  let restoredCount = imported.length;
  if (mode === 'replace') {
    const confirmed = window.confirm(`Replace your current pond with ${pluralise(imported.length, '鱼', '鱼')} from this backup? This cannot be undone after sync.`);
    if (!confirmed) return;
    todos = imported;
  } else {
    const existingIds = new Set(todos.map((todo) => todo.id));
    const remainingSlots = Math.max(0, MAX_TODOS - todos.length);
    const merged = imported.slice(0, remainingSlots).map((todo) => ({
      ...todo,
      id: existingIds.has(todo.id) ? crypto.randomUUID() : todo.id,
    }));
    restoredCount = merged.length;
    todos = normaliseTodos([...merged, ...todos]);
  }

  selectedTodoIds.clear();
  saveFocusedTodoId(focusedTodoId && todos.some((todo) => todo.id === focusedTodoId) ? focusedTodoId : '');
  saveTodos();
  showPondMessage(`${mode === 'replace' ? 'Replaced' : 'Merged'} ${pluralise(restoredCount, '鱼', '鱼')} from the pond backup.`);
  clearRestoreSelection();
  setRestorePanelOpen(false);
  render();
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
      githubUrl: todo.githubUrl,
    }))
    .filter(Boolean);

  if (imported.length === 0) {
    updatePastePreview();
    return;
  }

  todos = [...imported, ...todos].slice(0, MAX_TODOS);
  pasteInput.value = '';
  trackProductEvent('task_created', { taskCount: imported.length, source: 'paste' });
  saveTodos();
  showPondMessage(`Added ${pluralise(imported.length, 'pasted 鱼', 'pasted 鱼')} to the pond.`);
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
  if (focusedTodo) lines.push(`Focus 鱼: ${reportTodoText(focusedTodo)}.`);

  const highPriorityTodos = sortTodos(activeTodos.filter((todo) => todo.priority === 'high')).slice(0, 3);
  if (highPriorityTodos.length > 0) {
    lines.push('High-priority active:');
    highPriorityTodos.forEach((todo) => lines.push(`• ${reportTodoText(todo)}`));
  }

  const nextDueTodos = sortTodos(activeTodos.filter((todo) => todo.dueDate)).slice(0, 3);
  if (nextDueTodos.length > 0) {
    lines.push('Next due:');
    nextDueTodos.forEach((todo) => {
      lines.push(`• ${reportDueLabel(todo)} · ${todo.priority} · ${reportTodoText(todo)}`);
    });
  }

  const shoaledTodos = sortTodos(activeTodos.filter((t) => t.shoal));
  if (shoaledTodos.length > 0) {
    const byShoal = new Map();
    shoaledTodos.forEach((t) => {
      if (!byShoal.has(t.shoal)) byShoal.set(t.shoal, []);
      byShoal.get(t.shoal).push(t);
    });
    lines.push('By shoal:');
    byShoal.forEach((tasks, shoal) => {
      lines.push(`  ${shoal}: ${tasks.map((t) => t.text).join(', ')}`);
    });
  }

  return lines.join('\n');
}

function reportTodoText(todo) {
  const details = [recurrenceLabelFor(todo), checklistProgress(todo), todo.githubUrl].filter(Boolean);
  return details.length > 0 ? `${todo.text} (${details.join(' · ')})` : todo.text;
}

function buildPondSnapshot() {
  const visiblePond = liveTodos();
  const activeTodos = visiblePond.filter((todo) => !todo.completed);
  const completedCount = visiblePond.length - activeTodos.length;
  const highPriorityTodos = activeTodos.filter((todo) => todo.priority === 'high');
  const today = todayKey();
  const overdueTodos = activeTodos.filter((todo) => todo.dueDate && todo.dueDate < today);
  const upcomingTodos = sortTodos(activeTodos.filter((todo) => todo.dueDate && todo.dueDate >= today)).slice(0, 5);
  const focusTodo = activeTodos.find((todo) => todo.id === focusedTodoId);
  const generatedAt = new Date().toLocaleString([], {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
  const lines = [
    'Read-only pond snapshot',
    `Generated: ${generatedAt}`,
    `Tasks: ${visiblePond.length} total · ${activeTodos.length} active · ${completedCount} completed · ${archivedTodos().length} archived`,
    `Priority: ${highPriorityTodos.length} high tide · ${overdueTodos.length} overdue`,
  ];

  if (focusTodo) lines.push(`Focus 鱼: ${reportTodoText(focusTodo)}`);
  else lines.push('Focus 鱼: none selected');

  if (overdueTodos.length > 0) {
    lines.push('Overdue 鱼:');
    sortTodos(overdueTodos).slice(0, 5).forEach((todo) => {
      lines.push(`• ${reportDueLabel(todo)} · ${todo.priority} · ${reportTodoText(todo)}`);
    });
  }

  if (upcomingTodos.length > 0) {
    lines.push('Upcoming 鱼:');
    upcomingTodos.forEach((todo) => {
      lines.push(`• ${reportDueLabel(todo)} · ${todo.priority} · ${reportTodoText(todo)}`);
    });
  }

  if (activeTodos.length === 0) lines.push('No active 鱼 need attention.');

  lines.push('Snapshot is read-only and excludes account credentials, tokens, and diagnostics.');
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
  renderMetric('Archive', `${diagnostics.archivedCount} reefed 鱼`);
  renderMetric('Current view', `${diagnostics.filter} · ${diagnostics.visibleCount} visible`);
  renderMetric('Net', diagnostics.netMode ? `${diagnostics.selectedCount} selected` : 'not cast');
  renderMetric('Focus', diagnostics.focusedTaskPresent ? 'active focus 鱼' : 'none');
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

function buildStandupDraft() {
  const today = todayKey();
  const live = liveTodos();
  const active = live.filter((t) => !t.completed);
  const lines = [];
  const focused = active.find((t) => t.id === focusedTodoId);
  if (focused) {
    lines.push('*Working on now:*');
    lines.push(`• ${focused.text}${focused.blocked ? ` 🔴 Snagged${focused.blockerReason ? ': ' + focused.blockerReason : ''}` : ''}`);
    lines.push('');
  }
  const dueOrOverdue = sortTodos(active.filter((t) => t.dueDate && t.dueDate <= today));
  if (dueOrOverdue.length > 0) {
    lines.push('*Due or overdue:*');
    dueOrOverdue.forEach((t) => {
      lines.push(`• ${t.text}${t.blocked ? ` 🔴 Snagged${t.blockerReason ? ': ' + t.blockerReason : ''}` : ''}`);
    });
    lines.push('');
  }
  const blockers = active.filter((t) => t.blocked && t.id !== focusedTodoId && !(t.dueDate && t.dueDate <= today));
  if (blockers.length > 0) {
    lines.push('*Snagged:*');
    blockers.forEach((t) => {
      lines.push(`• ${t.text}${t.blockerReason ? ` — ${t.blockerReason}` : ''}`);
    });
    lines.push('');
  }
  if (lines.length === 0) return 'Stand-up draft: nothing due, overdue, or snagged today.';
  return lines.join('\n').trim();
}

async function copyStandupDraft() {
  try {
    await copyText(buildStandupDraft());
    showPondMessage('Copied stand-up draft to clipboard.');
  } catch {
    showPondMessage('Could not copy the stand-up draft.');
  }
}

function dailyCatchTodos() {
  if (dailyCatch.date !== todayKey()) dailyCatch = { date: todayKey(), ids: [] };
  const ids = new Set(dailyCatch.ids);
  return todos.filter((todo) => ids.has(todo.id) && !todo.archivedAt);
}

function setDailyCatchOpen(open) {
  dailyCatchPanel.hidden = !open;
  dailyCatchToggle.setAttribute('aria-expanded', String(open));
  if (open) {
    renderDailyCatch();
    dailyCatchPanel.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
  applyContextDefaults();
}

function pinDailyCatchTodo(id) {
  if (!dailyCatch.ids.includes(id)) dailyCatch.ids = [...dailyCatch.ids, id].slice(0, 5);
  persistDailyCatch();
  showPondMessage('Added 鱼 to today’s catch.');
  render();
}

function unpinDailyCatchTodo(id) {
  dailyCatch.ids = dailyCatch.ids.filter((candidate) => candidate !== id);
  persistDailyCatch();
  showPondMessage('Removed 鱼 from today’s catch.');
  render();
}

function createDailyCatchItem(todo, action) {
  const item = document.createElement('li');
  item.className = 'daily-catch-item';
  const copy = document.createElement('div');
  const title = document.createElement('strong');
  title.textContent = todo.text;
  const meta = document.createElement('span');
  meta.textContent = [dueLabelFor(todo), priorityLabelFor(todo), recurrenceLabelFor(todo), checklistProgress(todo)].filter(Boolean).join(' · ');
  copy.append(title, meta);

  const buttons = document.createElement('div');
  buttons.className = 'daily-catch-actions';
  const primary = document.createElement('button');
  primary.type = 'button';
  primary.className = action === 'pin' ? '' : 'secondary-action';
  primary.textContent = action === 'pin' ? 'Pin' : 'Unpin';
  primary.addEventListener('click', () => (action === 'pin' ? pinDailyCatchTodo(todo.id) : unpinDailyCatchTodo(todo.id)));
  const focus = document.createElement('button');
  focus.type = 'button';
  focus.className = 'secondary-action';
  focus.textContent = 'Feed';
  focus.disabled = todo.completed;
  focus.addEventListener('click', () => focusTodo(todo.id));
  buttons.append(primary, focus);
  item.append(copy, buttons);
  return item;
}

function renderDailyCatch() {
  if (dailyCatchPanel.hidden) return;

  const catchTodos = dailyCatchTodos();
  const emptyState = dailyCatchEmptyState();
  const completed = catchTodos.filter((todo) => todo.completed).length;
  const activeCatch = catchTodos.filter((todo) => !todo.completed);
  dailyCatchSummary.textContent = catchTodos.length > 0
    ? `${completed}/${catchTodos.length} 鱼 fed today · ${activeCatch.length} still swimming.`
    : emptyState.heading;

  dailyCatchPinned.replaceChildren();
  if (catchTodos.length === 0) {
    const empty = document.createElement('li');
    empty.className = 'daily-catch-empty';
    const copy = document.createElement('span');
    copy.textContent = emptyState.description;
    const action = document.createElement('button');
    action.type = 'button';
    action.className = 'secondary-action';
    action.textContent = emptyState.cta.label;
    action.addEventListener('click', () => {
      setDailyCatchOpen(false);
      runEmptyStateAction(emptyState.cta.action);
    });
    empty.append(copy, action);
    dailyCatchPinned.append(empty);
  } else {
    catchTodos.forEach((todo) => dailyCatchPinned.append(createDailyCatchItem(todo, 'unpin')));
  }

  const suggestions = selectDailyCatchSuggestions(todos, {
    today: todayKey(),
    focusedTodoId,
    pinnedIds: dailyCatch.ids,
    limit: 5,
  });
  dailyCatchSuggestions.replaceChildren();
  if (suggestions.length === 0) {
    const empty = document.createElement('li');
    empty.className = 'daily-catch-empty';
    empty.textContent = 'No urgent suggestions. The pond is unusually calm.';
    dailyCatchSuggestions.append(empty);
  } else {
    suggestions.forEach((todo) => dailyCatchSuggestions.append(createDailyCatchItem(todo, 'pin')));
  }
}

async function copyPondSnapshotReport() {
  try {
    await copyText(buildPondSnapshot());
    showPondMessage('Copied a read-only pond snapshot for standups and demos.');
  } catch {
    showPondMessage('Could not copy the pond snapshot. Try the pond report instead?');
  }
}

async function shareVisiblePond() {
  if (!currentUser) {
    showPondMessage('Sign in first to create a shared planning view.');
    return;
  }

  const visibleIds = visibleTodos()
    .filter((todo) => !todo.archivedAt)
    .map((todo) => todo.id);
  const viewName = filter === 'all' ? 'pond' : `${filter} pond`;
  sharePond.disabled = true;
  try {
    const body = await apiRequest('/api/shared-ponds', {
      method: 'POST',
      body: JSON.stringify({
        title: `${currentUser.username}'s ${viewName} view`,
        todoIds: visibleIds,
      }),
    });
    const url = body.share.url;
    try {
      await copyText(url);
      showPondMessage(`Copied a read-only shared pond link with ${pluralise(body.share.taskCount, 'visible task')}. Private tasks outside this view stay hidden.`);
    } catch {
      showPondMessage(`Shared pond link: ${url}`);
    }
  } catch (error) {
    showPondMessage(`Could not create a shared pond: ${error.message}`);
  } finally {
    sharePond.disabled = !currentUser;
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
      ? 'No focus 鱼 selected. Use Feed on any task to pick one.'
      : 'Sign in to see your focus 鱼 here.';
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
    hint.textContent = 'No urgent or overdue 鱼. Clear waters!';
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

const TROPHY_DEFS = [
  {
    id: 'first-catch',
    emoji: '🎣',
    name: 'First catch',
    description: 'Added the first task to your pond.',
    earned: () => todos.length > 0,
  },
  {
    id: 'fed-鱼',
    emoji: '🐟',
    name: 'Fed the 鱼',
    description: 'Completed at least one task.',
    earned: () => todos.some((t) => t.completed),
  },
  {
    id: 'clear-waters',
    emoji: '💧',
    name: 'Clear waters',
    description: 'Active tasks exist with none overdue.',
    earned: () => {
      const active = liveTodos().filter((t) => !t.completed);
      return active.length > 0 && active.every((t) => tideFor(t) !== 'washed');
    },
  },
  {
    id: 'tide-rider',
    emoji: '🌊',
    name: 'Tide rider',
    description: 'Active tasks spread across two or more tide lanes.',
    earned: () => new Set(liveTodos().filter((t) => !t.completed).map((t) => tideFor(t))).size >= 2,
  },
  {
    id: 'shoal-wrangler',
    emoji: '🐙',
    name: 'Shoal wrangler',
    description: 'Active tasks organised across multiple priorities.',
    earned: () => new Set(liveTodos().filter((t) => !t.completed).map((t) => t.priority)).size >= 2,
  },
];

function renderTrophies() {
  if (trophiesPanel.hidden) return;

  const results = TROPHY_DEFS.map((def) => ({ def, isEarned: def.earned() }));
  const earnedCount = results.filter((r) => r.isEarned).length;

  trophiesSummary.textContent = `${earnedCount} of ${TROPHY_DEFS.length} earned`;

  trophiesList.replaceChildren();
  results.forEach(({ def, isEarned }) => {
    const item = document.createElement('li');
    item.className = `trophy-item ${isEarned ? 'earned' : 'locked'}`;

    const emoji = document.createElement('span');
    emoji.className = 'trophy-emoji';
    emoji.setAttribute('aria-hidden', 'true');
    emoji.textContent = def.emoji;

    const name = document.createElement('p');
    name.className = 'trophy-name';
    name.textContent = def.name;

    const desc = document.createElement('p');
    desc.className = 'trophy-desc';
    desc.textContent = def.description;

    const status = document.createElement('p');
    status.className = `trophy-status ${isEarned ? 'earned' : 'locked'}`;
    status.textContent = isEarned ? 'Earned' : 'Locked';

    item.append(emoji, name, desc, status);
    trophiesList.append(item);
  });
}

function setTrophiesOpen(open) {
  trophiesPanel.hidden = !open;
  trophiesToggle.setAttribute('aria-expanded', String(open));
  if (open) {
    renderTrophies();
    trophiesPanel.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
}

function setStarterShoalsOpen(open) {
  starterShoalsPanel.hidden = !open;
  starterShoalsToggle.setAttribute('aria-expanded', String(open));
  if (open) starterShoalsPanel.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

function loadReminderPrefs() {
  const defaults = { enabled: false, quietStart: '22:00', quietEnd: '08:00' };
  try {
    const raw = localStorage.getItem(REMINDER_PREFS_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw);
    const enabled = typeof parsed.enabled === 'boolean' ? parsed.enabled : false;
    const quietStartVal = /^\d{2}:\d{2}$/.test(parsed.quietStart) ? parsed.quietStart : defaults.quietStart;
    const quietEndVal = /^\d{2}:\d{2}$/.test(parsed.quietEnd) ? parsed.quietEnd : defaults.quietEnd;
    return { enabled, quietStart: quietStartVal, quietEnd: quietEndVal };
  } catch {
    return defaults;
  }
}

function saveReminderPrefs(prefs) {
  try {
    localStorage.setItem(REMINDER_PREFS_KEY, JSON.stringify(prefs));
  } catch {
    showStorageError('Could not save reminder preferences.');
  }
}

function isInQuietHours(prefs) {
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const [startH, startM] = prefs.quietStart.split(':').map(Number);
  const [endH, endM] = prefs.quietEnd.split(':').map(Number);
  const start = startH * 60 + startM;
  const end = endH * 60 + endM;
  if (start <= end) return currentMinutes >= start && currentMinutes < end;
  // Crosses midnight (e.g. 22:00 – 08:00)
  return currentMinutes >= start || currentMinutes < end;
}

function getNotificationApi() {
  return window.Notification || null;
}

function canNotifyNow(prefs) {
  const notificationApi = getNotificationApi();
  if (!prefs.enabled || !notificationApi) return false;
  if (notificationApi.permission !== 'granted') return false;
  return !isInQuietHours(prefs);
}

function renderReminderPrefs() {
  const prefs = loadReminderPrefs();
  reminderEnable.checked = prefs.enabled;
  quietStart.value = prefs.quietStart;
  quietEnd.value = prefs.quietEnd;
  const notificationApi = getNotificationApi();
  const permission = notificationApi?.permission;
  let statusText;
  if (!prefs.enabled) {
    statusText = 'Reminders are off.';
  } else if (!notificationApi) {
    statusText = 'Notifications are not supported in this browser.';
  } else if (permission === 'denied') {
    statusText = 'Notifications are blocked by the browser. Update site permissions to enable reminders.';
  } else if (permission !== 'granted') {
    statusText = 'Notification permission is still needed before reminders can fire.';
  } else if (!canNotifyNow(prefs)) {
    statusText = `In quiet hours (${prefs.quietStart}–${prefs.quietEnd}). Reminders paused.`;
  } else {
    statusText = 'Reminders active. Notifications will fire when a task is due.';
  }
  reminderPrefsStatus.textContent = statusText;
}

function setReminderPrefsOpen(open) {
  reminderPrefsPanel.hidden = !open;
  reminderPrefsToggle.setAttribute('aria-expanded', String(open));
  if (open) {
    renderReminderPrefs();
    reminderPrefsPanel.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
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

  const githubInput = document.createElement('input');
  githubInput.name = 'githubUrl';
  githubInput.type = 'url';
  githubInput.inputMode = 'url';
  githubInput.placeholder = 'https://github.com/owner/repo/issues/123';
  githubInput.value = todo.githubUrl;

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

  const recurrenceSelect = document.createElement('select');
  recurrenceSelect.name = 'recurrence';
  [
    ['none', 'No migration'],
    ['daily', 'Migrate daily'],
    ['weekly', 'Migrate weekly'],
    ['monthly', 'Migrate monthly'],
  ].forEach(([value, label]) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    recurrenceSelect.append(option);
  });
  recurrenceSelect.value = normaliseRecurrence(todo.recurrence);

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
    createEditField('GitHub URL', githubInput),
    createEditField('Tide level', prioritySelect),
    createEditField('Migration', recurrenceSelect),
    actions,
  );

  formElement.addEventListener('submit', (event) => {
    event.preventDefault();
    saveEditedTodo(todo.id, {
      text: textInput.value,
      dueDate: dueInput.value,
      githubUrl: githubInput.value,
      priority: prioritySelect.value,
      recurrence: recurrenceSelect.value,
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

function createGithubChip(todo) {
  const info = githubLinkInfo(todo.githubUrl);
  if (!info) return null;
  const chip = document.createElement('a');
  chip.className = 'github-chip';
  chip.href = info.url;
  chip.target = '_blank';
  chip.rel = 'noopener noreferrer';
  chip.textContent = info.label;
  chip.setAttribute('aria-label', `Open GitHub ${info.label} for ${todo.text}`);
  return chip;
}

function updateTodoDetails(id, updates, message = 'Updated task details.', options = {}) {
  const existingTodo = todos.find((todo) => todo.id === id);
  if (!existingTodo) return;
  if (options.refocusRow) queueTodoFocusAfterRender(id);
  const updatedTodo = normaliseTodo({ ...existingTodo, ...updates });
  if (!updatedTodo) return;
  todos = todos.map((todo) => (todo.id === id ? updatedTodo : todo));
  saveTodos();
  showPondMessage(message);
  render();
}

function createTodoDetailsPanel(todo) {
  const panel = document.createElement('form');
  panel.className = 'task-details-panel';
  panel.setAttribute('aria-label', `Details for ${todo.text}`);

  const notes = document.createElement('textarea');
  notes.name = 'notes';
  notes.maxLength = MAX_NOTES_LENGTH;
  notes.rows = 4;
  notes.placeholder = 'Private notes, repro steps, links, or acceptance notes…';
  notes.value = todo.notes;

  const checklist = normaliseChecklist(todo.checklist);
  const checklistWrap = document.createElement('div');
  checklistWrap.className = 'task-checklist';
  const checklistTitle = document.createElement('p');
  checklistTitle.className = 'task-details-heading';
  checklistTitle.textContent = checklist.length > 0 ? checklistProgress(todo) : 'Scales';
  const checklistList = document.createElement('ul');
  checklistList.className = 'task-checklist-items';

  checklist.forEach((check) => {
    const item = document.createElement('li');
    const label = document.createElement('label');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = check.completed;
    checkbox.addEventListener('change', () => updateTodoDetails(todo.id, {
      checklist: checklist.map((entry) => (entry.id === check.id ? { ...entry, completed: checkbox.checked } : entry)),
    }, checkbox.checked ? 'Checklist item marked done.' : 'Checklist item reopened.'));
    const text = document.createElement('span');
    text.textContent = check.text;
    label.append(checkbox, text);
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'delete checklist-delete';
    remove.textContent = '×';
    remove.setAttribute('aria-label', `Remove checklist item: ${check.text}`);
    remove.addEventListener('click', () => updateTodoDetails(todo.id, {
      checklist: checklist.filter((entry) => entry.id !== check.id),
    }, 'Removed checklist item.'));
    item.append(label, remove);
    checklistList.append(item);
  });

  const addRow = document.createElement('div');
  addRow.className = 'checklist-add-row';
  const addInput = document.createElement('input');
  addInput.type = 'text';
  addInput.maxLength = MAX_CHECKLIST_TEXT_LENGTH;
  addInput.placeholder = checklist.length >= MAX_CHECKLIST_ITEMS ? 'Scales limit reached' : 'Add scale';
  addInput.disabled = checklist.length >= MAX_CHECKLIST_ITEMS;
  const addButton = document.createElement('button');
  addButton.type = 'button';
  addButton.className = 'secondary-action';
  addButton.textContent = 'Add item';
  addButton.disabled = checklist.length >= MAX_CHECKLIST_ITEMS;
  addButton.addEventListener('click', () => {
    const text = addInput.value.trim();
    if (!text) return;
    updateTodoDetails(todo.id, {
      checklist: [...checklist, { id: crypto.randomUUID(), text, completed: false }],
    }, 'Added checklist item.');
  });
  addRow.append(addInput, addButton);
  checklistWrap.append(checklistTitle, checklistList, addRow);

  const actions = document.createElement('div');
  actions.className = 'task-details-actions';
  const save = document.createElement('button');
  save.type = 'submit';
  save.textContent = 'Save details';
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'secondary-action';
  close.textContent = 'Close';
  actions.append(save, close);

  panel.append(createEditField('Depth', notes), checklistWrap, actions);
  panel.addEventListener('submit', (event) => {
    event.preventDefault();
    updateTodoDetails(todo.id, { notes: notes.value }, 'Saved task notes.');
  });
  panel.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      detailsTodoId = '';
      render();
    }
  });
  close.addEventListener('click', () => {
    detailsTodoId = '';
    render();
  });

  return panel;
}

function createDueNudgeButton(todo, label, days, ariaLabel) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'due-nudge-button';
  button.textContent = label;
  button.setAttribute('aria-label', ariaLabel);
  button.disabled = todo.completed || Boolean(todo.archivedAt) || !currentUser;
  button.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    nudgeTodoDueDate(todo.id, days);
  });
  return button;
}

function renderDueChip(todo, dueLabel) {
  dueLabel.replaceChildren();
  dueLabel.classList.toggle('due-label-empty', !todo.dueDate);

  const text = document.createElement('span');
  text.className = 'due-label-text';
  text.textContent = dueLabelFor(todo);
  dueLabel.append(text);

  const controls = document.createElement('span');
  controls.className = 'due-nudge-controls';
  controls.setAttribute('aria-label', `Due date controls for ${todo.text}`);

  if (todo.dueDate) {
    controls.append(
      createDueNudgeButton(todo, '← −1d', -1, `Move ${todo.text} one day earlier`),
      createDueNudgeButton(todo, '+1d →', 1, `Move ${todo.text} one day later`),
      createDueNudgeButton(todo, '−1w', -7, `Move ${todo.text} one week earlier`),
      createDueNudgeButton(todo, '+1w', 7, `Move ${todo.text} one week later`),
    );
  } else {
    const addDueButton = document.createElement('button');
    addDueButton.type = 'button';
    addDueButton.className = 'due-nudge-button';
    addDueButton.textContent = '+ due date';
    addDueButton.setAttribute('aria-label', `Set ${todo.text} due tomorrow`);
    addDueButton.disabled = todo.completed || Boolean(todo.archivedAt) || !currentUser;
    addDueButton.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      setTodoDueDate(todo.id, dueNudgeUtils.defaultDueDate(todayKey()));
    });
    controls.append(addDueButton);
  }

  dueLabel.append(controls);
  dueLabel.addEventListener('keydown', (event) => {
    if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    const buttons = [...dueLabel.querySelectorAll('.due-nudge-button:not(:disabled)')];
    if (buttons.length === 0) return;
    event.preventDefault();
    const currentIndex = buttons.indexOf(document.activeElement);
    const fallbackIndex = event.key === 'ArrowLeft' ? buttons.length : -1;
    const nextIndex = event.key === 'ArrowLeft'
      ? Math.max(0, (currentIndex === -1 ? fallbackIndex : currentIndex) - 1)
      : Math.min(buttons.length - 1, currentIndex + 1);
    buttons[nextIndex].focus();
  });
}

function createTodoItem(todo) {
  const item = template.content.firstElementChild.cloneNode(true);
  const netSelect = item.querySelector('.net-select');
  const checkbox = item.querySelector('.toggle');
  const text = item.querySelector('.text');
  const moodBadge = item.querySelector('.mood-badge');
  const dueLabel = item.querySelector('.due-label');
  const priorityLabel = item.querySelector('.priority-label');
  const metadata = item.querySelector('.metadata');
  const focusButton = item.querySelector('.focus-task');
  const editButton = item.querySelector('.edit-task');
  const detailsButton = item.querySelector('.details-task');
  const archiveButton = item.querySelector('.archive-task');
  const restoreButton = item.querySelector('.restore-task');
  const deleteButton = item.querySelector('.delete');
  const blockButton = item.querySelector('.block-task');
  const blockerBadge = item.querySelector('.blocker-badge');
  const statusSummary = item.querySelector('.status-summary');
  const mood = moodFor(todo);
  const tide = tideFor(todo);
  const isArchived = Boolean(todo.archivedAt);

  item.classList.toggle('completed', todo.completed);
  item.classList.toggle('archived', isArchived);
  item.classList.toggle('focused', todo.id === focusedTodoId);
  item.classList.toggle('editing', todo.id === editingTodoId);
  item.classList.toggle('details-open', todo.id === detailsTodoId);
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
  renderDueChip(todo, dueLabel);
  priorityLabel.textContent = priorityLabelFor(todo);
  const shoalChip = item.querySelector('.shoal-chip');
  if (shoalChip) {
    if (todo.shoal) {
      shoalChip.hidden = false;
      shoalChip.textContent = todo.shoal;
    } else {
      shoalChip.hidden = true;
    }
  }
  const githubChip = createGithubChip(todo);
  if (githubChip) metadata.append(githubChip);
  const recurrenceText = recurrenceLabelFor(todo);
  if (recurrenceText) {
    const recurrenceBadge = document.createElement('span');
    recurrenceBadge.className = 'recurrence-badge';
    recurrenceBadge.textContent = recurrenceText;
    metadata.append(recurrenceBadge);
  }
  const progressText = checklistProgress(todo);
  if (progressText) {
    const progressBadge = document.createElement('span');
    progressBadge.className = 'checklist-badge';
    progressBadge.textContent = progressText;
    metadata.append(progressBadge);
  }
  focusButton.hidden = isArchived;
  focusButton.disabled = todo.completed || todo.id === editingTodoId || isArchived;
  focusButton.textContent = todo.id === focusedTodoId ? 'Feeding' : 'Feed';
  focusButton.setAttribute('aria-label', `Feed ${todo.text}`);
  editButton.hidden = isArchived;
  editButton.disabled = todo.id === editingTodoId;
  editButton.setAttribute('aria-label', `Edit ${todo.text}`);
  detailsButton.hidden = isArchived;
  detailsButton.disabled = todo.id === editingTodoId;
  detailsButton.setAttribute('aria-expanded', String(detailsTodoId === todo.id));
  detailsButton.setAttribute('aria-label', `Edit depth and scales for ${todo.text}`);
  archiveButton.hidden = isArchived || !todo.completed;
  archiveButton.setAttribute('aria-label', `Send to reef: ${todo.text}`);
  restoreButton.hidden = !isArchived;
  restoreButton.setAttribute('aria-label', `Restore ${todo.text}`);
  deleteButton.setAttribute('aria-label', isArchived ? `Permanently release ${todo.text}` : `Delete ${todo.text}`);
  blockButton.hidden = todo.completed || isArchived;
  blockButton.textContent = todo.blocked ? 'Unblock' : 'Block';
  blockerBadge.hidden = !todo.blocked;
  blockerBadge.textContent = todo.blocked
    ? (todo.blockerReason ? `Snagged: ${todo.blockerReason}` : 'Snagged')
    : '';

  if (statusSummary) {
    let summaryText = '';
    let summaryAriaLabel = '';
    if (!todo.completed) {
      const today = todayKey();
      if (todo.dueDate && todo.dueDate < today) {
        summaryText = dueLabelFor(todo);
      } else if (todo.blocked) {
        summaryText = todo.blockerReason ? `Snagged: ${todo.blockerReason}` : 'Snagged';
      } else if (todo.dueDate) {
        summaryText = dueLabelFor(todo);
      } else if (todo.priority && todo.priority !== 'medium') {
        summaryText = priorityLabelFor(todo);
      } else if (todo.shoal) {
        summaryText = todo.shoal;
        summaryAriaLabel = `Shoal: ${todo.shoal}`;
      }
    }
    statusSummary.textContent = summaryText;
    statusSummary.setAttribute('aria-label', summaryAriaLabel || summaryText);
  }

  if (todo.id === editingTodoId) {
    const editForm = createTodoEditForm(todo);
    item.append(editForm);
  }

  if (todo.id === blockingTodoId && !todo.blocked) {
    const form = createBlockForm(todo);
    item.append(form);
  }

  if (todo.id === detailsTodoId && !isArchived) {
    item.append(createTodoDetailsPanel(todo));
  }

  netSelect.addEventListener('change', () => toggleSelectedTodo(todo.id));
  checkbox.addEventListener('change', () => toggleTodo(todo.id));
  focusButton.addEventListener('click', () => focusTodo(todo.id));
  editButton.addEventListener('click', () => startEditingTodo(todo.id));
  detailsButton.addEventListener('click', () => {
    detailsTodoId = detailsTodoId === todo.id ? '' : todo.id;
    render();
  });
  archiveButton.addEventListener('click', () => archiveTodo(todo.id));
  restoreButton.addEventListener('click', () => restoreArchivedTodo(todo.id));
  deleteButton.addEventListener('click', () => deleteTodo(todo.id));
  blockButton.addEventListener('click', () => {
    if (todo.blocked) {
      setTodoBlocked(todo.id, false, '');
    } else {
      blockingTodoId = todo.id;
      render();
    }
  });

  // Keyboard-first action strip
  const actionsDiv = item.querySelector('.todo-actions');
  actionsDiv.setAttribute('aria-label', `Actions for ${todo.text}`);

  // Toolbar buttons are not in the tab order — navigate with arrow keys
  actionsDiv.querySelectorAll('button').forEach((btn) => btn.setAttribute('tabindex', '-1'));

  function visibleStripButtons() {
    return Array.from(actionsDiv.querySelectorAll('button')).filter(
      (btn) => !btn.hidden && !btn.disabled
    );
  }

  function actionButtonAvailable(button) {
    return Boolean(button && !button.hidden && !button.disabled);
  }

  function handleStripShortcut(e) {
    if (e.key === 'c' || e.key === 'C') {
      if (!checkbox.disabled) {
        e.preventDefault();
        toggleTodo(todo.id, { refocusRow: true });
      }
    } else if (e.key === 'a' || e.key === 'A') {
      if (actionButtonAvailable(archiveButton)) {
        e.preventDefault();
        archiveTodo(todo.id, { refocusRow: true });
      }
    } else if (e.key === 'e' || e.key === 'E') {
      if (actionButtonAvailable(editButton)) {
        e.preventDefault();
        startEditingTodo(todo.id);
      }
    } else if (e.key === 'p' || e.key === 'P') {
      if (!isArchived && todo.id !== editingTodoId) {
        e.preventDefault();
        const order = ['', 'low', 'medium', 'high'];
        const next = order[(order.indexOf(todo.priority || '') + 1) % order.length] || null;
        updateTodoDetails(todo.id, { priority: next }, 'Tide level updated.', { refocusRow: true });
      }
    }
  }

  // Arrow-key navigation + shortcut keys within the toolbar
  actionsDiv.addEventListener('keydown', (e) => {
    const btns = visibleStripButtons();
    const idx = btns.indexOf(document.activeElement);
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      if (btns.length) btns[(idx + 1) % btns.length].focus();
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (btns.length) btns[(idx - 1 + btns.length) % btns.length].focus();
    } else if (e.key === 'Escape') {
      e.stopPropagation();
      item.focus();
    } else {
      handleStripShortcut(e);
    }
  });

  // Enter/ArrowRight on the <li> itself enters the toolbar; single-letter shortcuts act immediately
  item.addEventListener('keydown', (e) => {
    if (document.activeElement !== item) return;
    if (e.key === 'Enter' || e.key === 'ArrowRight') {
      e.preventDefault();
      const btns = visibleStripButtons();
      if (btns.length) btns[0].focus();
    } else {
      handleStripShortcut(e);
    }
  });

  return item;
}

function weekAheadGroups() {
  const today = todayKey();
  const activeDueTodos = visibleTodos();
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
    const state = contextualEmptyState({ filter: 'week', searchQuery, quickFilter });
    const emptyItem = document.createElement('li');
    emptyItem.className = 'week-group week-group-empty';
    const heading = document.createElement('h3');
    heading.textContent = state.heading;
    const description = document.createElement('p');
    description.textContent = state.description;
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
  const sortedTodos = filteredTodos(liveTodos());
  const populatedGroups = tideGroups
    .map((group) => ({ ...group, todos: sortedTodos.filter((todo) => tideFor(todo) === group.key) }))
    .filter((group) => group.todos.length > 0);

  if (populatedGroups.length === 0) {
    const state = contextualEmptyState({ filter: 'tide', searchQuery, quickFilter });
    const emptyItem = document.createElement('li');
    emptyItem.className = 'tide-group tide-group-empty';
    const heading = document.createElement('h3');
    heading.textContent = state.heading;
    const description = document.createElement('p');
    description.textContent = state.description;
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

function renderSearchControls() {
  if (taskSearch.value !== searchQuery) {
    taskSearch.value = searchQuery;
  }
  taskSearch.disabled = !currentUser;
  clearSearch.hidden = !searchQuery;
  clearSearch.disabled = !currentUser;
  quickFilterButtons.forEach((button) => {
    const isSelectedNet = button.dataset.quickFilter === 'selected-net';
    button.disabled = !currentUser || (isSelectedNet && !netMode);
    button.classList.toggle('active', button.dataset.quickFilter === quickFilter);
    button.setAttribute('aria-pressed', String(button.dataset.quickFilter === quickFilter));
  });
}

function renderSmartViews() {
  saveSmartView.disabled = !currentUser;
  smartViewName.disabled = !currentUser;
  smartViewList.replaceChildren();

  if (smartViews.length === 0) {
    const emptyItem = document.createElement('li');
    emptyItem.className = 'smart-view-empty';
    emptyItem.textContent = 'No saved smart views yet.';
    smartViewList.append(emptyItem);
    return;
  }

  smartViews.forEach((view) => {
    const item = document.createElement('li');
    item.className = 'smart-view-item';
    const applyButton = document.createElement('button');
    applyButton.type = 'button';
    applyButton.className = 'smart-view-apply';
    applyButton.disabled = !currentUser;
    applyButton.textContent = view.name;
    applyButton.addEventListener('click', () => applySmartView(view.id));
    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.className = 'smart-view-delete';
    deleteButton.disabled = !currentUser;
    deleteButton.setAttribute('aria-label', 'Delete smart view ' + view.name);
    deleteButton.textContent = '×';
    deleteButton.addEventListener('click', () => deleteSmartView(view.id));
    item.append(applyButton, deleteButton);
    smartViewList.append(item);
  });
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

function hasRealTask() {
  return liveTodos().some((todo) => !DEMO_TODO_IDS.includes(todo.id));
}

function onboardingIsComplete() {
  return tourDismissed && hasRealTask();
}

function setGettingStartedOpen(open) {
  viewPrefs = { ...viewPrefs, [GETTING_STARTED_PREF_KEY]: Boolean(open) };
  saveViewPrefs();
  renderGettingStartedPanel();
}

function markChecklistItem(item, complete) {
  if (!item) return;
  item.classList.toggle('complete', complete);
  item.querySelector('span').textContent = complete ? '✓' : '○';
}

function renderGettingStartedPanel() {
  if (!gettingStartedToggle || !gettingStartedPanel) return;
  const complete = onboardingIsComplete();
  let storedOpen = viewPrefs[GETTING_STARTED_PREF_KEY];

  if (complete && !viewPrefs[GETTING_STARTED_AUTO_COLLAPSED_KEY]) {
    storedOpen = false;
    viewPrefs = {
      ...viewPrefs,
      [GETTING_STARTED_PREF_KEY]: false,
      [GETTING_STARTED_AUTO_COLLAPSED_KEY]: true,
    };
    saveViewPrefs();
  }

  const open = Boolean(currentUser) && (storedOpen === null ? !complete : storedOpen);
  gettingStartedPanel.hidden = !open;
  gettingStartedToggle.hidden = !currentUser;
  gettingStartedToggle.setAttribute('aria-expanded', String(open));
  gettingStartedToggle.textContent = open ? 'Hide getting started' : 'Getting started';
  if (gettingStartedCollapse) gettingStartedCollapse.disabled = !currentUser;

  markChecklistItem(checklistAddTask, hasRealTask());
  markChecklistItem(checklistTideMode, filter === 'tide');
  markChecklistItem(checklistPondTour, tourDismissed || !pondTour.hidden);
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
  if (shouldAutoShow) {
    saveTourDismissed(true);
    trackProductEvent('tour_opened', { source: 'auto' });
  }
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
    focusSprintStatus.textContent = 'Pick a 鱼 to start a focus sprint.';
  } else if (isFinished) {
    focusSprintStatus.textContent = 'Sprint complete. Mark this 鱼 fed when you are ready.';
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
  trackProductEvent('focus_started', {
    priority: focusedTodo.priority,
    sprintMinutes: focusSprint.minutes,
  });
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
    cancelCurrentFocusSprint('Focus sprint cancelled because the selected 鱼 changed.');
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
  const focusedTodo = selectedFocusTodo();
  if (focusedTodo) {
    trackProductEvent('focus_completed', {
      priority: focusedTodo.priority,
      sprintMinutes: focusSprint.minutes,
    });
  }
  completeFocusedTodo('focus');
}

function renderFocusPanel() {
  const focusedTodo = selectedFocusTodo();
  syncFocusSprintWithSelection();
  if (!focusedTodo) {
    saveFocusedTodoId('');
    renderFocusSprint();
    return;
  }

  focusTitle.textContent = focusedTodo.text;
  focusMeta.textContent = [
    moodFor(focusedTodo).text,
    dueLabelFor(focusedTodo),
    priorityLabelFor(focusedTodo),
    recurrenceLabelFor(focusedTodo),
    githubLinkInfo(focusedTodo.githubUrl)?.label,
    checklistProgress(focusedTodo),
  ].filter(Boolean).join(' · ');
  renderFocusSprint();
}

function reminderNotificationsActive() {
  const notificationApi = getNotificationApi();
  const prefs = loadReminderPrefs();
  return Boolean(currentUser)
    && prefs.enabled
    && notificationApi?.permission === 'granted'
    && !isInQuietHours(prefs);
}

function checkDueNotifications() {
  const notificationApi = getNotificationApi();
  if (!notificationApi || !reminderNotificationsActive() || todos.length === 0) return;

  const today = todayKey();
  const newlyDue = todos.filter(
    (todo) => !todo.completed && todo.dueDate && todo.dueDate <= today && !notifiedTodayIds.has(todo.id),
  );

  newlyDue.forEach((todo) => {
    new notificationApi('Dactyl TODO', {
      body: todo.dueDate < today ? `Overdue: ${todo.text}` : `Due today: ${todo.text}`,
      tag: `dactyl-due-${todo.id}`,
    });
    notifiedTodayIds.add(todo.id);
  });

  if (newlyDue.length > 0) saveNotifiedTodayIds();
}

function startNotificationInterval() {
  if (notificationIntervalId) return;
  notificationIntervalId = window.setInterval(checkDueNotifications, 60_000);
}

function stopNotificationInterval() {
  if (notificationIntervalId) {
    window.clearInterval(notificationIntervalId);
    notificationIntervalId = null;
  }
}

function syncNotificationInterval() {
  const prefs = loadReminderPrefs();
  const notificationApi = getNotificationApi();
  if (currentUser && prefs.enabled && notificationApi?.permission === 'granted') {
    startNotificationInterval();
    checkDueNotifications();
  } else {
    stopNotificationInterval();
  }
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
  loginButton.disabled = signedIn || authRequestInFlight;
  signupButton.disabled = signedIn || authRequestInFlight;
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
  exportPond.disabled = !signedIn;
  exportCalendarBtn.disabled = !signedIn;
  restorePondToggle.disabled = !signedIn;
  copyPondReport.disabled = !signedIn;
  copyPondSnapshot.disabled = !signedIn;
  sharePond.disabled = !signedIn;
  copyStandupDraftButton.disabled = !signedIn;
  dailyCatchToggle.disabled = !signedIn;
  pondHealthToggle.disabled = !signedIn;
  copyPondDiagnostics.disabled = !signedIn;
  showPondTour.disabled = !signedIn;
  triageToggle.disabled = !signedIn;
  castNet.disabled = !signedIn;
  saveSmartView.disabled = !signedIn;
  smartViewName.disabled = !signedIn;
  clearCompleted.disabled = !signedIn;
  updatePastePreview();
  updateRestorePreview();
}

function setFilter(nextFilter) {
  // Clear selection when filter changes so hidden tasks can't be affected by bulk actions.
  selectedTodoIds.clear();
  filter = nextFilter;
  saveLastFilter();
  render();
  applyContextDefaults();
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

function triageTasks() {
  return getTriageCandidates(todos);
}

function currentTriageTodo() {
  const tasks = triageTasks();
  triageIndex = clampTriageIndex(triageIndex, tasks.length);
  return tasks[triageIndex] || null;
}

function setTriageOpen(open) {
  if (open && !currentUser) {
    showPondMessage('Sign in first to use triage mode.');
    return;
  }
  if (open && triageTasks().length === 0) {
    showPondMessage('No active 鱼 to triage right now.');
    return;
  }
  triageOpen = open;
  triageToggle.setAttribute('aria-expanded', String(triageOpen));
  render();
  if (triageOpen) triagePanel.focus({ preventScroll: true });
}

function renderTriagePanel() {
  triagePanel.hidden = !triageOpen;
  triageToggle.setAttribute('aria-expanded', String(triageOpen));
  if (!triageOpen) return;

  const tasks = triageTasks();
  triageIndex = clampTriageIndex(triageIndex, tasks.length);
  const todo = tasks[triageIndex];
  const hasTodo = Boolean(todo);
  triageStatus.textContent = hasTodo
    ? `${triageIndex + 1} of ${tasks.length} active 鱼. J/K move, C completes, E archives, P cycles priority, [ and ] nudge due date.`
    : 'No active 鱼 to triage right now.';
  triageTaskTitle.textContent = todo?.text || 'No active task selected';
  triageTaskMeta.textContent = todo
    ? [moodFor(todo).text, dueLabelFor(todo), priorityLabelFor(todo), recurrenceLabelFor(todo)].filter(Boolean).join(' · ')
    : 'Add or restore a task to keep triaging.';
  [triagePrev, triageNext, triageComplete, triageArchive, triagePriority, triageDueEarlier, triageDueLater]
    .forEach((button) => { button.disabled = !hasTodo; });
}

function moveTriage(delta) {
  const tasks = triageTasks();
  triageIndex = nextTriageIndex(triageIndex, tasks.length, delta);
  render();
}

function completeTriageTodo() {
  const todo = currentTriageTodo();
  if (!todo) return;
  const previousCompletedCount = completedTodoCount();
  const generatedTodo = nextRecurringTodo(todo);
  todos = todos.map((item) => (
    item.id === todo.id ? { ...item, completed: true } : item
  ));
  if (generatedTodo) todos = [generatedTodo, ...todos];
  saveTodos();
  showPondMessage(generatedTodo
    ? `Completed from triage and scheduled the next ${normaliseRecurrence(todo.recurrence)} 鱼.`
    : `Completed from triage: ${todo.text}.`);
  celebrateFirstCompletionIfNeeded(previousCompletedCount, completedTodoCount());
  render();
}

function archiveTriageTodo() {
  const todo = currentTriageTodo();
  if (!todo) return;
  const archivedAt = new Date().toISOString();
  todos = todos.map((item) => (
    item.id === todo.id ? { ...item, completed: true, archivedAt } : item
  ));
  selectedTodoIds.delete(todo.id);
  if (todo.id === focusedTodoId) saveFocusedTodoId('');
  saveTodos();
  showPondMessage(`Archived from triage: ${todo.text}.`);
  render();
}

function cycleTriagePriority() {
  const todo = currentTriageTodo();
  if (!todo) return;
  const priority = nextTriagePriority(todo.priority);
  todos = todos.map((item) => (
    item.id === todo.id ? { ...item, priority } : item
  ));
  saveTodos();
  showPondMessage(`Triage set ${todo.text} to ${priority} priority.`);
  render();
}

function setTodoDueDate(id, dueDate) {
  const todo = todos.find((item) => item.id === id);
  if (!todo || todo.dueDate === dueDate) return;
  const snapshot = prepareUndoSnapshot();
  todos = todos.map((item) => (
    item.id === id ? { ...item, dueDate } : item
  ));
  applyUndoableTodoChange(snapshot, `Moved ${todo.text} to ${formatDateKey(dueDate)}.`, 'Restored previous due date.');
}

function nudgeTodoDueDate(id, days) {
  const todo = todos.find((item) => item.id === id);
  if (!todo) return;
  const dueDate = dueNudgeUtils.nextDueDate(todo.dueDate, days, todayKey());
  setTodoDueDate(id, dueDate);
}

function nudgeTriageDueDate(days) {
  const todo = currentTriageTodo();
  if (!todo) return;
  nudgeTodoDueDate(todo.id, days);
}


function render() {
  const renderStarted = diagnosticNow();
  renderAuth();
  if (quickFilter === 'selected-net' && !netMode) quickFilter = '';
  list.replaceChildren();
  const visiblePond = visibleTodos();

  if (filter === 'tide') {
    renderTideMode();
  } else if (filter === 'week') {
    renderWeekAhead();
  } else if (filter === 'ghost') {
    renderGhostNet();
  } else {
    for (const todo of visiblePond) {
      list.append(createTodoItem(todo));
    }
  }

  const livePond = liveTodos();
  const activeCount = livePond.filter((todo) => !todo.completed).length;
  const visibleCount = filter === 'tide' ? filteredTodos(livePond).length : visiblePond.length;
  const showFirstTaskGuide = shouldShowFirstTaskOnboarding({
    dismissed: firstTaskOnboardingDismissed,
    filter,
    hasActiveSearchFilter: hasActiveSearchFilter(),
    liveCount: livePond.length,
    visibleCount,
  });
  const empty = contextualEmptyState({ filter, searchQuery, quickFilter, showFirstTaskGuide });
  count.textContent = filter === 'ghost'
    ? `${pluralise(ghostNetTodos().length, 'ghost task')} found`
    : hasActiveSearchFilter()
      ? `${pluralise(visibleCount, 'matching 鱼', 'matching 鱼')}`
      : filter === 'archive'
        ? `${pluralise(archivedTodos().length, 'archived 鱼', 'archived 鱼')}`
        : `${pluralise(activeCount, 'task')} left`;
  emptyState.querySelector('h2').textContent = empty.heading;
  emptyState.querySelector('p').textContent = empty.description;
  renderEmptyStateActions(empty);
  firstTaskOnboarding.hidden = !showFirstTaskGuide;
  emptyState.classList.toggle('visible', filter !== 'tide' && filter !== 'week' && filter !== 'ghost' && visiblePond.length === 0);
  clearCompleted.textContent = filter === 'archive' ? 'Release archived permanently' : 'Send all to reef';
  clearCompleted.classList.toggle('visible', filter !== 'ghost' && (filter === 'archive' ? archivedTodos().length > 0 : liveTodos().some((todo) => todo.completed)));
  releaseDemo.disabled = !currentUser || !liveTodos().some((todo) => DEMO_TODO_IDS.includes(todo.id));
  selectedTodoIds = new Set([...selectedTodoIds].filter((id) => renderedTodoIds().has(id)));
  renderNetControls();
  renderSearchControls();
  renderSmartViews();
  renderTourPanel();
  renderGettingStartedPanel();
  renderUpgradeCallout();

  filterButtons.forEach((button) => {
    button.classList.toggle('active', button.dataset.filter === filter);
  });

  renderFocusPanel();
  syncScreen({ updateUrl: !suppressScreenHistory });
  focusPendingEditField();
  focusPendingTodoRow();
  updateShoalDatalist();
  recordRenderDuration(renderStarted);
  renderDailyCatch();
  renderPondHealth();
  renderTriagePanel();
  renderShowcase();
  renderTrophies();
  if (!reminderPrefsPanel.hidden) renderReminderPrefs();
  renderOverdueNudge();
}

function addTodo(text, options = {}) {
  const todo = normaliseTodo({
    id: options.id ?? crypto.randomUUID(),
    text,
    completed: false,
    createdAt: options.createdAt ?? new Date().toISOString(),
    dueDate: options.dueDate ?? '',
    priority: options.priority ?? 'medium',
    shoal: options.shoal ?? '',
    recurrence: options.recurrence ?? 'none',
    githubUrl: options.githubUrl ?? '',
    notes: options.notes ?? '',
    checklist: options.checklist ?? [],
  });

  if (!todo) return;
  if (liveTodos().length === 0) saveFirstTaskOnboardingDismissed(true);
  todos.unshift(todo);
  trackProductEvent('task_created', {
    priority: todo.priority,
    hasDueDate: Boolean(todo.dueDate),
    hasGithubLink: Boolean(todo.githubUrl),
    recurrence: todo.recurrence,
    source: options.source || 'form',
  });
  logActivity('Added', todo.text);
  saveTodos();
  render();
}

function addStarterTask(templateId) {
  const templateTodo = templateForId(templateId);
  if (!templateTodo) return;

  addTodo(templateTodo.text, { priority: templateTodo.priority, source: 'starter_template' });
  showPondMessage(`Starter 鱼 added: ${templateTodo.text}.`);
  input.focus();
}

function dismissFirstTaskGuide() {
  saveFirstTaskOnboardingDismissed(true);
  render();
  showPondMessage('First-task guide dismissed. Add your own 鱼 whenever you are ready.');
  input.focus();
}

function completedTodoCount() {
  return liveTodos().filter((todo) => todo.completed).length;
}

function nextRecurringTodo(todo) {
  if (!todo || normaliseRecurrence(todo.recurrence) === 'none' || todos.length >= MAX_TODOS) return null;
  const nextDueDate = nextRecurrenceDate(todo.dueDate, todo.recurrence, todayKey());
  const alreadyScheduled = todos.some((candidate) => candidate.id !== todo.id
    && !candidate.completed
    && !candidate.archivedAt
    && candidate.text === todo.text
    && normaliseRecurrence(candidate.recurrence) === normaliseRecurrence(todo.recurrence)
    && candidate.dueDate === nextDueDate);
  if (alreadyScheduled) return null;
  return normaliseTodo({
    ...todo,
    id: crypto.randomUUID(),
    completed: false,
    createdAt: new Date().toISOString(),
    dueDate: nextDueDate,
    archivedAt: '',
    blocked: false,
    blockerReason: '',
    checklist: normaliseChecklist(todo.checklist).map((item) => ({ ...item, id: crypto.randomUUID(), completed: false })),
  });
}

function celebrateFirstCompletionIfNeeded(previousCompletedCount, nextCompletedCount) {
  if (!shouldCelebrateFirstCompletion({
    alreadyCelebrated: firstCompletionCelebrated,
    previousCompletedCount,
    nextCompletedCount,
  })) {
    return false;
  }

  saveFirstCompletionCelebrated(true);
  showPondMessage('First 鱼 fed! Nice launch — the pond officially has momentum.');
  return true;
}

function starterShoalTaskKey(text) {
  return String(text || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function applyStarterShoal(shoal) {
  if (!currentUser) {
    showPondMessage('Sign in first to stock a starter shoal.');
    return;
  }
  const available = MAX_TODOS - todos.length;
  if (available <= 0) {
    showPondMessage('The pond is full. Release some 鱼 first.');
    return;
  }
  const existingTaskKeys = new Set(todos.map((todo) => starterShoalTaskKey(todo.text)));
  const uniqueTasks = shoal.tasks.filter((task) => !existingTaskKeys.has(starterShoalTaskKey(task.text)));
  const skippedCount = shoal.tasks.length - uniqueTasks.length;
  const toAdd = uniqueTasks.slice(0, available);
  if (toAdd.length === 0) {
    const reason = skippedCount > 0 ? 'those tasks are already in the pond' : 'the pond is full';
    showPondMessage(`No new tasks stocked from "${shoal.name}" — ${reason}.`);
    return;
  }
  toAdd.forEach((task) => addTodo(task.text, { priority: task.priority, source: 'starter_shoal' }));
  setStarterShoalsOpen(false);
  const skippedMessage = skippedCount > 0 ? ` Skipped ${skippedCount} already-stocked ${skippedCount === 1 ? 'task' : 'tasks'}.` : '';
  showPondMessage(`Stocked ${toAdd.length} new ${toAdd.length === 1 ? 'task' : 'tasks'} from the "${shoal.name}" shoal.${skippedMessage}`);
}

function renderStarterShoalsList() {
  const listEl = document.querySelector('#starter-shoals-list');
  if (!listEl) return;
  STARTER_SHOALS.forEach((shoal) => {
    const li = document.createElement('li');
    li.className = 'starter-shoal-item';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'starter-shoal-btn';
    btn.innerHTML = `<strong>${shoal.name}</strong><span>${shoal.description}</span><span class="shoal-count">${shoal.tasks.length} tasks</span>`;
    btn.addEventListener('click', () => applyStarterShoal(shoal));
    li.append(btn);
    listEl.append(li);
  });
}

function toggleTodo(id, options = {}) {
  if (options.refocusRow) queueTodoFocusAfterRender(id);
  const previousCompletedCount = completedTodoCount();
  let generatedTodo = null;
  todos = todos.map((todo) => {
    if (todo.id !== id) return todo;
    const completed = !todo.completed;
    if (completed) generatedTodo = nextRecurringTodo(todo);
    return { ...todo, completed };
  });
  if (generatedTodo) todos = [generatedTodo, ...todos];
  if (id === focusedTodoId && todos.find((todo) => todo.id === id)?.completed) {
    cancelCurrentFocusSprint('Focus sprint cancelled because this 鱼 was completed.');
    saveFocusedTodoId('');
  }
  saveTodos();
  render();
  const toggledTodo = todos.find((todo) => todo.id === id);
  if (toggledTodo?.completed) {
    trackProductEvent('task_completed', { priority: toggledTodo.priority, source: 'list' });
    logActivity('Completed', toggledTodo.text);
    if (generatedTodo) showPondMessage(`Scheduled next ${normaliseRecurrence(toggledTodo.recurrence)} 鱼 for ${dueLabelFor(generatedTodo).toLowerCase()}.`);
  }
  celebrateFirstCompletionIfNeeded(previousCompletedCount, completedTodoCount());
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

function prepareUndoSnapshot() {
  return {
    todos: normaliseTodos(todos),
    focusedTodoId,
    selectedTodoIds: [...selectedTodoIds],
    netMode,
  };
}

function applyUndoableTodoChange(snapshot, message, confirmation) {
  saveTodos();
  render();
  setUndoAction({
    ...snapshot,
    message,
    confirmation,
  });
}

function removeTodosWithUndo(predicate, message) {
  const snapshot = prepareUndoSnapshot();
  const previousTodos = snapshot.todos;
  const removedTodos = previousTodos.filter(predicate);
  if (removedTodos.length === 0) return false;

  todos = previousTodos.filter((todo) => !predicate(todo));
  if (snapshot.focusedTodoId && removedTodos.some((todo) => todo.id === snapshot.focusedTodoId)) {
    cancelCurrentFocusSprint('Focus sprint cancelled because that 鱼 left the pond.');
    saveFocusedTodoId('');
  }
  selectedTodoIds = new Set(snapshot.selectedTodoIds.filter((id) => todos.some((todo) => todo.id === id)));

  const undoMessage = message(removedTodos.length);
  applyUndoableTodoChange(snapshot, undoMessage, `Restored ${pluralise(removedTodos.length, '鱼', '鱼')} to the pond.`);
  return true;
}

function queueTodoFocusAfterRender(id) {
  const visibleIds = visibleTodos().map((todo) => todo.id);
  const currentIndex = visibleIds.indexOf(id);
  const fallbackIds = currentIndex === -1
    ? []
    : [...visibleIds.slice(currentIndex + 1), ...visibleIds.slice(0, currentIndex).reverse()];
  pendingTodoFocusTarget = { id, fallbackIds };
}

function findRenderedTodoItemById(id) {
  return Array.from(list.querySelectorAll('.todo-item')).find((item) => item.dataset.todoId === id) || null;
}

function focusPendingTodoRow() {
  if (!pendingTodoFocusTarget) return;
  const targetIds = [pendingTodoFocusTarget.id, ...pendingTodoFocusTarget.fallbackIds];
  pendingTodoFocusTarget = null;
  for (const id of targetIds) {
    const item = findRenderedTodoItemById(id);
    if (item) {
      item.focus();
      return;
    }
  }
  input.focus();
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
  detailsTodoId = '';
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
    githubUrl: updates.githubUrl,
    priority: updates.priority,
    recurrence: updates.recurrence,
  });

  if (!updatedTodo) {
    showPondMessage('Give this 鱼 a task name before saving.');
    pendingEditFocusId = id;
    render();
    return;
  }

  todos = todos.map((todo) => (todo.id === id ? updatedTodo : todo));
  editingTodoId = '';
  pendingEditFocusId = '';
  saveTodos();
  showPondMessage('Updated this 鱼 in the pond.');
  render();
}

function createBlockForm(todo) {
  const form = document.createElement('form');
  form.className = 'block-form';
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'block-reason-input';
  input.maxLength = 160;
  input.placeholder = 'Snag reason (optional)…';
  const saveBtn = document.createElement('button');
  saveBtn.type = 'submit';
  saveBtn.textContent = 'Save snag';
  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.addEventListener('click', () => { blockingTodoId = ''; render(); });
  form.append(input, saveBtn, cancelBtn);
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    setTodoBlocked(todo.id, true, input.value.trim());
  });
  return form;
}

function setTodoBlocked(id, blocked, reason) {
  todos = todos.map((todo) =>
    todo.id === id ? normaliseTodo({ ...todo, blocked, blockerReason: reason }) : todo
  ).filter(Boolean);
  blockingTodoId = '';
  saveTodos();
  render();
  showPondMessage(blocked ? 'Task snagged.' : 'Snag cleared.');
}

function deleteTodo(id) {
  const isArchivedDelete = todos.some((todo) => todo.id === id && todo.archivedAt);
  const todoToDelete = todos.find((todo) => todo.id === id);
  if (editingTodoId === id) editingTodoId = '';
  if (todoToDelete) logActivity('Deleted', todoToDelete.text);
  removeTodosWithUndo(
    (todo) => todo.id === id,
    () => (isArchivedDelete
      ? 'Permanently released 1 archived 鱼 from the reef.'
      : 'Released 1 鱼 from the pond.'),
  );
}

function archiveTodo(id, options = {}) {
  if (options.refocusRow) queueTodoFocusAfterRender(id);
  const snapshot = prepareUndoSnapshot();
  const archivedAt = new Date().toISOString();
  const todoToArchive = todos.find((todo) => todo.id === id);
  todos = todos.map((todo) => (
    todo.id === id ? { ...todo, completed: true, archivedAt } : todo
  ));
  if (id === focusedTodoId) {
    cancelCurrentFocusSprint('Focus sprint cancelled because this 鱼 moved to the reef.');
    saveFocusedTodoId('');
  }
  selectedTodoIds.delete(id);
  if (todoToArchive) logActivity('Archived', todoToArchive.text);
  applyUndoableTodoChange(snapshot, 'Moved 1 completed 鱼 to the reef archive.', 'Restored 1 鱼 from the reef archive.');
}

function archiveCompletedTodos() {
  const completedIds = liveTodos().filter((todo) => todo.completed).map((todo) => todo.id);
  if (completedIds.length === 0) return;
  const snapshot = prepareUndoSnapshot();
  const archivedAt = new Date().toISOString();
  const completedIdSet = new Set(completedIds);
  todos = todos.map((todo) => (
    completedIdSet.has(todo.id) ? { ...todo, completed: true, archivedAt } : todo
  ));
  if (completedIdSet.has(focusedTodoId)) {
    cancelCurrentFocusSprint('Focus sprint cancelled because this 鱼 moved to the reef.');
    saveFocusedTodoId('');
  }
  selectedTodoIds = new Set([...selectedTodoIds].filter((id) => !completedIdSet.has(id)));
  applyUndoableTodoChange(
    snapshot,
    `Moved ${pluralise(completedIds.length, 'completed 鱼', 'completed 鱼')} to the reef archive.`,
    `Restored ${pluralise(completedIds.length, '鱼', '鱼')} from the reef archive.`,
  );
}

function restoreArchivedTodo(id) {
  const todoToRestore = todos.find((todo) => todo.id === id);
  todos = todos.map((todo) => (
    todo.id === id ? { ...todo, archivedAt: '' } : todo
  ));
  if (todoToRestore) logActivity('Restored', todoToRestore.text);
  saveTodos();
  showPondMessage('Restored 1 鱼 from the reef archive.');
  render();
}

function releaseArchivedTodos() {
  removeTodosWithUndo(
    (todo) => Boolean(todo.archivedAt),
    (count) => `Permanently released ${pluralise(count, 'archived 鱼', 'archived 鱼')} from the reef.`,
  );
}

function focusTodo(id) {
  editingTodoId = '';
  if (id !== focusedTodoId) resetFocusSprint(id);
  saveFocusedTodoId(id);
  hidePondMessage();
  setScreen('focus');
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
    (count) => `Released ${pluralise(count, 'selected 鱼', 'selected 鱼')} from the pond.`,
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
  const shoal = bulkShoalInput.value.trim().slice(0, 40);
  if (selectedCount === 0) return;
  const snapshot = prepareUndoSnapshot();
  todos = todos.map((todo) => (
    effectiveIds.has(todo.id) ? { ...todo, shoal } : todo
  ));
  if (bulkShoalInput) bulkShoalInput.value = '';
  applyUndoableTodoChange(snapshot, shoal
    ? `Moved ${pluralise(selectedCount, 'selected 鱼', 'selected 鱼')} to the ${shoal} shoal.`
    : `Cleared shoal grouping for ${pluralise(selectedCount, 'selected 鱼', 'selected 鱼')}.`,
  `Restored previous shoals for ${pluralise(selectedCount, '鱼', '鱼')}.`);
}

function completeFocusedTodo(source = 'focus_button') {
  if (!focusedTodoId) return;
  const previousCompletedCount = completedTodoCount();
  const completedTask = todos.find((todo) => todo.id === focusedTodoId);
  const generatedTodo = nextRecurringTodo(completedTask);
  cancelCurrentFocusSprint('');
  todos = todos.map((todo) => (
    todo.id === focusedTodoId ? { ...todo, completed: true } : todo
  ));
  if (generatedTodo) todos = [generatedTodo, ...todos];
  saveFocusedTodoId('');
  saveTodos();
  render();
  if (completedTask) {
    trackProductEvent('task_completed', { priority: completedTask.priority, source });
    if (celebrateFirstCompletionIfNeeded(previousCompletedCount, completedTodoCount())) return;
    const celebration = generatedTodo
      ? `Fed the recurring 鱼 and scheduled the next ${normaliseRecurrence(completedTask.recurrence)} occurrence.`
      : celebrations[Math.floor(Math.random() * celebrations.length)];
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
  if (todos.length > 0 && !window.confirm('Add demo 鱼-themed tasks to this pond? Existing tasks will stay put.')) {
    return;
  }

  const existingIds = new Set(todos.map((todo) => todo.id));
  const existingTexts = new Set(todos.map((todo) => todo.text));
  const newTodos = demoTodos()
    .filter((todo) => !existingIds.has(todo.id) && !existingTexts.has(todo.text))
    .map((todo) => normaliseTodo({ ...todo, completed: false, createdAt: new Date().toISOString() }))
    .filter(Boolean);

  if (newTodos.length === 0) {
    showPondMessage('The pond is already stocked with demo 鱼.');
    return;
  }

  todos = [...newTodos, ...todos].slice(0, MAX_TODOS);
  if (newTodos.length > 0) saveFirstTaskOnboardingDismissed(true);
  trackProductEvent('task_created', { taskCount: newTodos.length, source: 'demo' });
  saveTodos();
  showPondMessage(`Stocked the pond with ${pluralise(newTodos.length, 'demo 鱼', 'demo 鱼')}.`);
  render();
}

function releaseDemoFish() {
  removeTodosWithUndo(
    (todo) => DEMO_TODO_IDS.includes(todo.id),
    (count) => `Released ${pluralise(count, 'demo 鱼', 'demo 鱼')} from the pond.`,
  );
}

function snoozeTodo(id, days) {
  setTodoDueDate(id, dueNudgeUtils.nextDueDate('', days, todayKey()));
}

function renderGhostNet() {
  const ghosts = ghostNetTodos();

  if (ghosts.length === 0) {
    const state = contextualEmptyState({ filter: 'ghost', searchQuery, quickFilter });
    const emptyItem = document.createElement('li');
    emptyItem.className = 'ghost-group ghost-group-empty';
    const heading = document.createElement('h3');
    heading.textContent = state.heading;
    const description = document.createElement('p');
    description.textContent = state.description;
    emptyItem.append(heading, description);
    list.append(emptyItem);
    return;
  }

  const summaryItem = document.createElement('li');
  summaryItem.className = 'ghost-group';
  const summaryHeading = document.createElement('h3');
  summaryHeading.textContent = `Ghost net found ${pluralise(ghosts.length, 'task')}`;
  const summaryDescription = document.createElement('p');
  summaryDescription.textContent = `Review active 鱼 that are overdue, unscheduled for more than ${GHOST_STALE_DAYS} days, or high priority and drifting.`;
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
    metaEl.textContent = [mood.emoji, mood.text, dueLabelFor(todo), priorityLabelFor(todo), recurrenceLabelFor(todo)].filter(Boolean).join(' · ');

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
  if (authRequestInFlight) return;
  if (!authForm.reportValidity()) return;

  const username = usernameInput.value.trim();
  const password = passwordInput.value;

  if (!USERNAME_PATTERN.test(username)) {
    authStatus.textContent = 'Username must be 3-32 letters, numbers, dots, underscores, or hyphens.';
    usernameInput.focus();
    return;
  }

  if (password.length < MIN_PASSWORD_LENGTH || password.length > MAX_PASSWORD_LENGTH) {
    authStatus.textContent = 'Password must be 8-128 characters.';
    passwordInput.focus();
    return;
  }

  authRequestInFlight = true;
  loginButton.disabled = true;
  signupButton.disabled = true;
  authStatus.textContent = mode === 'signup' ? 'Creating account…' : 'Logging in…';
  try {
    const body = await apiRequest(`/api/${mode}`, {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    trackProductEvent(mode === 'signup' ? 'signup' : 'login', { taskCount: body.todos?.length ?? 0 });
    saveAuthToken(body.token);
    currentUser = body.user;
    todos = normaliseTodos(body.todos);
    markSyncState('loaded', 'Loaded tasks for the current session.');
    syncNotificationInterval();
    passwordInput.value = '';
    clearStorageError();
    hidePondMessage();
    render();
  } catch (error) {
    authStatus.textContent = error.message;
    if (error.field === 'username') usernameInput.focus();
    if (error.field === 'password') passwordInput.focus();
  } finally {
    authRequestInFlight = false;
    if (!currentUser) {
      loginButton.disabled = false;
      signupButton.disabled = false;
    }
  }
}

function clearSearchState() {
  searchQuery = '';
  quickFilter = '';
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
  stopNotificationInterval();
  saveAuthToken('');
  currentUser = null;
  todos = [];
  selectedTodoIds.clear();
  clearSearchState();
  netMode = false;
  tourForcedVisible = false;
  resetFocusSprint('');
  saveFocusedTodoId('');
  clearRestoreSelection();
  detailsTodoId = '';
  setRestorePanelOpen(false);
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
    syncNotificationInterval();
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
  if (!event.defaultPrevented && (event.ctrlKey || event.metaKey) && event.key === 'k') {
    event.preventDefault();
    if (commandPaletteOpen) { closeCommandPalette(); } else { openCommandPalette(); }
    return;
  }

  const hasModifier = event.altKey || event.ctrlKey || event.metaKey;
  if (event.defaultPrevented || hasModifier || isInteractiveShortcutTarget(event.target)) {
    return;
  }

  if (triageOpen) {
    const key = event.key.toLowerCase();
    if (key === 'j' || event.key === 'ArrowDown') {
      event.preventDefault();
      moveTriage(1);
      return;
    }
    if (key === 'k' || event.key === 'ArrowUp') {
      event.preventDefault();
      moveTriage(-1);
      return;
    }
    if (key === 'c') {
      event.preventDefault();
      completeTriageTodo();
      return;
    }
    if (key === 'e') {
      event.preventDefault();
      archiveTriageTodo();
      return;
    }
    if (key === 'p') {
      event.preventDefault();
      cycleTriagePriority();
      return;
    }
    if (event.key === '[') {
      event.preventDefault();
      nudgeTriageDueDate(-1);
      return;
    }
    if (event.key === ']') {
      event.preventDefault();
      nudgeTriageDueDate(1);
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      setTriageOpen(false);
      return;
    }
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

  if (event.key.toLowerCase() === 'u') {
    event.preventDefault();
    setTriageOpen(true);
    return;
  }

  if (event.key === 'Escape') {
    if (commandPaletteOpen) {
      closeCommandPalette();
      event.preventDefault();
      return;
    }
    const helpWasOpen = !shortcutHelp.hidden;
    setShortcutHelpOpen(false);
    const buttonHelpWasOpen = !buttonHelpPanel.hidden;
    setButtonHelpOpen(false);
    const leftNetMode = leaveNetMode();
    const closedShowcase = !showcasePanel.hidden;
    if (closedShowcase) setShowcaseOpen(false);
    const closedTrophies = !trophiesPanel.hidden;
    if (closedTrophies) setTrophiesOpen(false);
    const closedStarterShoals = !starterShoalsPanel.hidden;
    if (closedStarterShoals) setStarterShoalsOpen(false);
    const closedDailyCatch = !dailyCatchPanel.hidden;
    if (closedDailyCatch) setDailyCatchOpen(false);
    const closedTriage = triageOpen;
    if (closedTriage) setTriageOpen(false);
    const closedReminderPrefs = !reminderPrefsPanel.hidden;
    if (closedReminderPrefs) setReminderPrefsOpen(false);
    const closedPrefs = !prefsPanel.hidden;
    if (closedPrefs) setPrefsOpen(false);
    const closedActivityLog = !activityLogPanel.hidden;
    if (closedActivityLog) setActivityLogOpen(false);
    const closedMoreActions = !moreActionsPanel.hidden;
    if (closedMoreActions) setMoreActionsOpen(false);
    const closedGithubImport = !githubImportPanel.hidden;
    if (closedGithubImport) setGithubImportOpen(false);
    if (helpWasOpen || buttonHelpWasOpen || leftNetMode || closedShowcase || closedTrophies || closedStarterShoals || closedDailyCatch || closedTriage || closedReminderPrefs || closedPrefs || closedActivityLog || closedMoreActions || closedGithubImport) event.preventDefault();
  }
}

authForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const submittedMode = event.submitter?.value;
  const mode = ['login', 'signup'].includes(submittedMode) ? submittedMode : pendingAuthMode;
  authenticate(mode);
});

loginButton.addEventListener('click', () => {
  pendingAuthMode = 'login';
});

signupButton.addEventListener('click', () => {
  pendingAuthMode = 'signup';
});

logoutButton.addEventListener('click', logout);
passwordForm.addEventListener('submit', (event) => {
  event.preventDefault();
  changePassword();
});

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const parsed = parseQuickAdd(input.value, { today: todayKey() });
  if (!parsed.text) {
    showPondMessage('Add some task text before the quick-add hints.');
    input.focus();
    return;
  }
  const dueDate = dueDateInput.value || parsed.dueDate;
  const priority = priorityInput.value !== 'medium' ? priorityInput.value : (parsed.priority || priorityInput.value);

  addTodo(parsed.text, {
    dueDate,
    priority,
    shoal: shoalInput ? shoalInput.value.trim() : '',
    recurrence: recurrenceInput.value,
    githubUrl: githubUrlInput.value,
    source: parsed.dueDate || parsed.priority ? 'quick_add' : 'form',
  });
  if (parsed.dueDate || parsed.priority) {
    const hints = [parsed.dueDate ? `due ${formatDateKey(parsed.dueDate)}` : '', parsed.priority ? `${parsed.priority} priority` : ''].filter(Boolean).join(' · ');
    showPondMessage(`Added quick task with ${hints}.`);
  }
  form.reset();
  dirtyFormFields.clear();
  priorityInput.value = 'medium';
  if (shoalInput) shoalInput.value = '';
  recurrenceInput.value = 'none';
  syncPriorityChips();
  applyContextDefaults();
  input.focus();
});

filterButtons.forEach((button) => {
  button.addEventListener('click', () => setFilter(button.dataset.filter));
});

priorityInput.addEventListener('change', () => {
  syncPriorityChips();
  dirtyFormFields.add('priority');
  applyContextDefaults();
});
dueDateInput.addEventListener('change', () => {
  dirtyFormFields.add('dueDate');
  applyContextDefaults();
});
if (shoalInput) {
  shoalInput.addEventListener('input', () => {
    dirtyFormFields.add('shoal');
    applyContextDefaults();
  });
}
advancedAddToggle.addEventListener('click', () => setAddFormAdvanced(!viewPrefs.addFormAdvanced));
priorityChips.forEach((chip) => {
  chip.addEventListener('click', () => setDraftPriority(chip.dataset.priority));
});

taskSearch.addEventListener('input', () => {
  searchQuery = taskSearch.value;
  render();
});

taskSearch.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && searchQuery) {
    event.preventDefault();
    searchQuery = '';
    render();
  }
});

clearSearch.addEventListener('click', () => {
  searchQuery = '';
  render();
  taskSearch.focus();
});

quickFilterButtons.forEach((button) => {
  button.addEventListener('click', () => {
    quickFilter = quickFilter === button.dataset.quickFilter ? '' : button.dataset.quickFilter;
    render();
    applyContextDefaults();
  });
});

shoalFilterSelect?.addEventListener('change', () => setShoalFilter(shoalFilterSelect.value));

saveSmartView.addEventListener('click', saveCurrentSmartView);
smartViewName.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    saveCurrentSmartView();
  }
});

clearCompleted.addEventListener('click', () => {
  if (filter === 'archive') releaseArchivedTodos();
  else archiveCompletedTodos();
});

gettingStartedToggle.addEventListener('click', () => setGettingStartedOpen(gettingStartedPanel.hidden));
gettingStartedCollapse.addEventListener('click', () => setGettingStartedOpen(false));
stockPond.addEventListener('click', stockDemoPond);
releaseDemo.addEventListener('click', releaseDemoFish);
firstTaskTemplateButtons.forEach((button) => {
  button.addEventListener('click', () => addStarterTask(button.dataset.firstTaskTemplate));
});
dismissFirstTaskOnboarding.addEventListener('click', dismissFirstTaskGuide);
pastePond.addEventListener('click', () => setPastePanelOpen(pastePanel.hidden));
pasteInput.addEventListener('input', updatePastePreview);
addPastedTasks.addEventListener('click', importPastedTodos);
clearPaste.addEventListener('click', clearPasteInput);
cancelPaste.addEventListener('click', () => setPastePanelOpen(false));
exportPond.addEventListener('click', exportPondBackup);
exportCalendarBtn.addEventListener('click', exportCalendar);
restorePondToggle.addEventListener('click', () => setRestorePanelOpen(restorePanel.hidden));
restoreFile.addEventListener('change', previewRestoreFile);
mergeRestore.addEventListener('click', () => applyRestore('merge'));
replaceRestore.addEventListener('click', () => applyRestore('replace'));
cancelRestore.addEventListener('click', () => setRestorePanelOpen(false));
copyPondReport.addEventListener('click', copyPondProgressReport);
copyPondSnapshot.addEventListener('click', copyPondSnapshotReport);
sharePond.addEventListener('click', shareVisiblePond);
copyStandupDraftButton.addEventListener('click', copyStandupDraft);
dailyCatchToggle.addEventListener('click', () => setDailyCatchOpen(dailyCatchPanel.hidden));
dailyCatchClose.addEventListener('click', () => setDailyCatchOpen(false));
upgradeCalloutDismiss.addEventListener('click', dismissPremiumCallout);
document.querySelector('#overdue-nudge-switch')?.addEventListener('click', () => setFilter('tide'));
document.querySelector('#overdue-nudge-dismiss')?.addEventListener('click', () => {
  overdueNudgeDismissed = true;
  renderOverdueNudge();
});
shortcutHelpToggle.addEventListener('click', toggleShortcutHelp);
shortcutHelpClose.addEventListener('click', () => setShortcutHelpOpen(false));
buttonHelpToggle.addEventListener('click', () => setButtonHelpOpen(buttonHelpPanel.hidden));
buttonHelpClose.addEventListener('click', () => setButtonHelpOpen(false));
triageToggle.addEventListener('click', () => setTriageOpen(!triageOpen));
triageClose.addEventListener('click', () => setTriageOpen(false));
commandPaletteToggle.addEventListener('click', () => {
  if (commandPaletteOpen) { closeCommandPalette(); } else { openCommandPalette(); }
});
commandSearch.addEventListener('input', () => {
  commandPaletteActiveIndex = 0;
  renderCommandList(commandSearch.value);
});
commandSearch.addEventListener('keydown', (event) => {
  if (event.key === 'ArrowDown') {
    event.preventDefault();
    navigateCommandList(1);
  } else if (event.key === 'ArrowUp') {
    event.preventDefault();
    navigateCommandList(-1);
  } else if (event.key === 'Enter') {
    event.preventDefault();
    executeActiveCommand();
  } else if (event.key === 'Escape') {
    event.preventDefault();
    closeCommandPalette();
  } else if (event.key === 'Tab') {
    event.preventDefault();
    commandSearch.focus();
  }
});
commandPaletteEl.addEventListener('keydown', trapCommandPaletteFocus);
commandPaletteEl.addEventListener('click', (event) => {
  if (event.target === commandPaletteEl) closeCommandPalette();
});
triagePrev.addEventListener('click', () => moveTriage(-1));
triageNext.addEventListener('click', () => moveTriage(1));
triageComplete.addEventListener('click', completeTriageTodo);
triageArchive.addEventListener('click', archiveTriageTodo);
triagePriority.addEventListener('click', cycleTriagePriority);
triageDueEarlier.addEventListener('click', () => nudgeTriageDueDate(-1));
triageDueLater.addEventListener('click', () => nudgeTriageDueDate(1));
pondHealthToggle.addEventListener('click', () => setPondHealthOpen(pondHealthPanel.hidden));
copyPondDiagnostics.addEventListener('click', copyDiagnosticsReport);
castNet.addEventListener('click', toggleNetMode);
releaseSelected.addEventListener('click', releaseSelectedTodos);
moveShoal.addEventListener('click', moveSelectedToShoal);
showPondTour.addEventListener('click', () => {
  tourForcedVisible = true;
  trackProductEvent('tour_opened', { source: 'manual' });
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
completeFocus.addEventListener('click', () => completeFocusedTodo());
showcaseToggle.addEventListener('click', () => setShowcaseOpen(showcasePanel.hidden));
showcaseClose.addEventListener('click', () => setShowcaseOpen(false));
trophiesToggle.addEventListener('click', () => setTrophiesOpen(trophiesPanel.hidden));
trophiesClose.addEventListener('click', () => setTrophiesOpen(false));
starterShoalsToggle.addEventListener('click', () => setStarterShoalsOpen(starterShoalsPanel.hidden));
starterShoalsClose.addEventListener('click', () => setStarterShoalsOpen(false));
reminderPrefsToggle.addEventListener('click', () => setReminderPrefsOpen(reminderPrefsPanel.hidden));
reminderPrefsClose.addEventListener('click', () => setReminderPrefsOpen(false));
reminderEnable.addEventListener('change', () => {
  const prefs = loadReminderPrefs();
  const enabling = reminderEnable.checked;
  const notificationApi = getNotificationApi();
  if (enabling && notificationApi?.permission === 'default') {
    notificationApi.requestPermission().then(() => {
      saveReminderPrefs({ ...prefs, enabled: true });
      syncNotificationInterval();
      renderReminderPrefs();
    });
  } else {
    saveReminderPrefs({ ...prefs, enabled: enabling });
    syncNotificationInterval();
    renderReminderPrefs();
  }
});
quietStart.addEventListener('change', () => {
  const prefs = loadReminderPrefs();
  saveReminderPrefs({ ...prefs, quietStart: quietStart.value });
  syncNotificationInterval();
  renderReminderPrefs();
});
quietEnd.addEventListener('change', () => {
  const prefs = loadReminderPrefs();
  saveReminderPrefs({ ...prefs, quietEnd: quietEnd.value });
  syncNotificationInterval();
  renderReminderPrefs();
});
prefsToggle.addEventListener('click', () => setPrefsOpen(prefsPanel.hidden));
prefsClose.addEventListener('click', () => setPrefsOpen(false));
prefReducedMotion.addEventListener('change', () => {
  viewPrefs = { ...viewPrefs, reducedMotion: prefReducedMotion.checked };
  saveViewPrefs();
  applyViewPrefs();
});
prefHighContrast.addEventListener('change', () => {
  viewPrefs = { ...viewPrefs, highContrast: prefHighContrast.checked };
  saveViewPrefs();
  applyViewPrefs();
});
prefDensity?.addEventListener('change', () => {
  viewPrefs = { ...viewPrefs, density: prefDensity.value };
  saveViewPrefs();
  applyViewPrefs();
});
prefTextBadges.addEventListener('change', () => {
  viewPrefs = { ...viewPrefs, textBadges: prefTextBadges.checked };
  saveViewPrefs();
  applyViewPrefs();
});

moreActionsToggle.addEventListener('click', () => setMoreActionsOpen(moreActionsPanel.hidden));
activityLogToggle.addEventListener('click', () => setActivityLogOpen(activityLogPanel.hidden));
activityLogClose.addEventListener('click', () => setActivityLogOpen(false));
undoToastAction.addEventListener('click', () => {
  restoreUndoAction();
  logActivity('Undone', '');
});
undoToastDismiss.addEventListener('click', clearUndoAction);
undoToast.addEventListener('focusin', () => {
  undoToastFocused = true;
  pauseUndoToastTimer();
});
undoToast.addEventListener('focusout', () => {
  undoToastFocused = false;
  scheduleUndoToastDismiss();
});

githubImportToggle.addEventListener('click', () => setGithubImportOpen(githubImportPanel.hidden));
githubImportClose.addEventListener('click', () => setGithubImportOpen(false));
githubImportParse.addEventListener('click', async () => {
  const urls = window.GithubImport.parseImportUrls(githubImportInput.value);
  const existingUrls = todos.map((t) => t.githubUrl).filter(Boolean);
  githubImportPreview.hidden = false;
  githubImportPreview.textContent = 'Fetching titles…';
  githubImportActions.hidden = true;
  const { items, rateLimitHit } = await window.GithubImport.buildPreviewItems(urls, existingUrls);
  renderGithubImportPreview(items, rateLimitHit);
});
githubImportConfirm.addEventListener('click', confirmGithubImport);
githubImportSelectAll.addEventListener('click', () => {
  [...githubImportPreview.querySelectorAll('input[type="checkbox"]:not(:disabled)')].forEach((cb) => { cb.checked = true; });
});

document.addEventListener('keydown', handleGlobalShortcut);
function renderFromHistory() {
  suppressScreenHistory = true;
  render();
  suppressScreenHistory = false;
}
window.addEventListener('popstate', renderFromHistory);
window.addEventListener('hashchange', renderFromHistory);
syncPriorityChips();
applyContextDefaults();

applyViewPrefs();
renderStarterShoalsList();
restoreSession();
