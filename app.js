const STORAGE_KEY = 'dactyl.todos';
const MAX_TODOS = 200;
const MAX_TODO_LENGTH = 120;

const form = document.querySelector('#todo-form');
const input = document.querySelector('#todo-input');
const list = document.querySelector('#todo-list');
const template = document.querySelector('#todo-template');
const count = document.querySelector('#todo-count');
const emptyState = document.querySelector('#empty-state');
const clearCompleted = document.querySelector('#clear-completed');
const filterButtons = [...document.querySelectorAll('.filter')];
const storageError = document.querySelector('#storage-error');

let todos = loadTodos();
let filter = 'all';

function showStorageError(message) {
  storageError.textContent = message;
  storageError.hidden = false;
}

function clearStorageError() {
  storageError.textContent = '';
  storageError.hidden = true;
}

function isValidDate(value) {
  return !Number.isNaN(Date.parse(value));
}

function normaliseTodo(todo) {
  if (!todo || typeof todo !== 'object') return null;
  if (typeof todo.id !== 'string' || typeof todo.text !== 'string') return null;

  const id = todo.id.trim();
  const text = todo.text.trim().slice(0, MAX_TODO_LENGTH);
  if (!id || !text) return null;

  const createdAt = typeof todo.createdAt === 'string' && isValidDate(todo.createdAt)
    ? todo.createdAt
    : new Date().toISOString();

  return {
    id,
    text,
    completed: Boolean(todo.completed),
    createdAt,
  };
}

function normaliseTodos(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map(normaliseTodo)
    .filter(Boolean)
    .slice(0, MAX_TODOS);
}

function loadTodos() {
  try {
    return normaliseTodos(JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? []);
  } catch {
    showStorageError('Saved tasks could not be loaded, so the app started with an empty list.');
    return [];
  }
}

function saveTodos() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
    clearStorageError();
    return true;
  } catch {
    showStorageError('Tasks changed in this tab, but could not be saved to this browser. Storage may be full or unavailable.');
    return false;
  }
}

function visibleTodos() {
  if (filter === 'active') return todos.filter((todo) => !todo.completed);
  if (filter === 'completed') return todos.filter((todo) => todo.completed);
  return todos;
}

function pluralise(countValue, singular, plural = `${singular}s`) {
  return `${countValue} ${countValue === 1 ? singular : plural}`;
}

function render() {
  list.replaceChildren();

  for (const todo of visibleTodos()) {
    const item = template.content.firstElementChild.cloneNode(true);
    const checkbox = item.querySelector('.toggle');
    const text = item.querySelector('.text');
    const deleteButton = item.querySelector('.delete');

    item.classList.toggle('completed', todo.completed);
    checkbox.checked = todo.completed;
    text.textContent = todo.text;
    deleteButton.setAttribute('aria-label', `Delete ${todo.text}`);

    checkbox.addEventListener('change', () => toggleTodo(todo.id));
    deleteButton.addEventListener('click', () => deleteTodo(todo.id));

    list.append(item);
  }

  const activeCount = todos.filter((todo) => !todo.completed).length;
  count.textContent = `${pluralise(activeCount, 'task')} left`;
  emptyState.classList.toggle('visible', visibleTodos().length === 0);
  clearCompleted.classList.toggle('visible', todos.some((todo) => todo.completed));

  filterButtons.forEach((button) => {
    button.classList.toggle('active', button.dataset.filter === filter);
  });
}

function addTodo(text) {
  todos.unshift({
    id: crypto.randomUUID(),
    text: text.slice(0, MAX_TODO_LENGTH),
    completed: false,
    createdAt: new Date().toISOString(),
  });
  saveTodos();
  render();
}

function toggleTodo(id) {
  todos = todos.map((todo) => (
    todo.id === id ? { ...todo, completed: !todo.completed } : todo
  ));
  saveTodos();
  render();
}

function deleteTodo(id) {
  todos = todos.filter((todo) => todo.id !== id);
  saveTodos();
  render();
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const text = input.value.trim();
  if (!text) return;

  addTodo(text);
  form.reset();
  input.focus();
});

filterButtons.forEach((button) => {
  button.addEventListener('click', () => {
    filter = button.dataset.filter;
    render();
  });
});

clearCompleted.addEventListener('click', () => {
  todos = todos.filter((todo) => !todo.completed);
  saveTodos();
  render();
});

render();
