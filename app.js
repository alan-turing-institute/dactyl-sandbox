const STORAGE_KEY = 'dactyl.todos';

const form = document.querySelector('#todo-form');
const input = document.querySelector('#todo-input');
const list = document.querySelector('#todo-list');
const template = document.querySelector('#todo-template');
const count = document.querySelector('#todo-count');
const emptyState = document.querySelector('#empty-state');
const clearCompleted = document.querySelector('#clear-completed');
const filterButtons = [...document.querySelectorAll('.filter')];

let todos = loadTodos();
let filter = 'all';

function loadTodos() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? [];
  } catch {
    return [];
  }
}

function saveTodos() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
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
    text,
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
