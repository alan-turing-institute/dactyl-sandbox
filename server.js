const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const express = require('express');

const MAX_TODOS = 200;
const MAX_TODO_LENGTH = 120;
const PRIORITIES = ['low', 'medium', 'high'];
const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function base64url(input) {
  return Buffer.from(input).toString('base64url');
}

function signJwt(payload, secret) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const encodedHeader = base64url(JSON.stringify(header));
  const encodedPayload = base64url(JSON.stringify(payload));
  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64url');
  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

function verifyJwt(token, secret) {
  const [encodedHeader, encodedPayload, signature] = String(token || '').split('.');
  if (!encodedHeader || !encodedPayload || !signature) return null;
  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64url');
  if (signature.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
    if (!payload.sub || !payload.exp || Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

function isValidDateKey(value) {
  if (value === '') return true;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
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

function toPublicUser(row) {
  return { id: row.id, username: row.username };
}

function createPasswordHash(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, passwordHash) {
  const [salt, storedHash] = String(passwordHash).split(':');
  if (!salt || !storedHash || !/^[a-f0-9]{128}$/i.test(storedHash)) return false;
  const hash = crypto.scryptSync(password, salt, 64);
  const stored = Buffer.from(storedHash, 'hex');
  return stored.length === hash.length && crypto.timingSafeEqual(stored, hash);
}

function createApp(options = {}) {
  const app = express();
  const dbPath = options.dbPath || process.env.DATABASE_PATH || path.join(__dirname, 'data', 'todos.sqlite');
  const jwtSecret = options.jwtSecret || process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');
  if (dbPath !== ':memory:') fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);

  db.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS todos (
      id TEXT NOT NULL,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      text TEXT NOT NULL,
      completed INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      due_date TEXT NOT NULL DEFAULT '',
      priority TEXT NOT NULL DEFAULT 'medium',
      updated_at TEXT NOT NULL,
      PRIMARY KEY (id, user_id)
    );
  `);

  app.locals.db = db;
  app.use((req, res, next) => {
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'; connect-src 'self'");
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    res.setHeader('X-Frame-Options', 'DENY');
    next();
  });
  app.use(express.json({ limit: '100kb' }));

  function issueToken(user) {
    return signJwt({ sub: user.id, username: user.username, exp: Date.now() + TOKEN_TTL_MS }, jwtSecret);
  }

  function requireAuth(req, res, next) {
    const header = req.get('authorization') || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    const payload = verifyJwt(token, jwtSecret);
    if (!payload) return res.status(401).json({ error: 'Authentication required.' });
    const user = db.prepare('SELECT id, username FROM users WHERE id = ?').get(payload.sub);
    if (!user) return res.status(401).json({ error: 'Authentication required.' });
    req.user = user;
    return next();
  }

  function listTodos(userId) {
    return db.prepare(`
      SELECT id, text, completed, created_at AS createdAt, due_date AS dueDate, priority
      FROM todos
      WHERE user_id = ?
      ORDER BY completed ASC, COALESCE(NULLIF(due_date, ''), '9999-12-31') ASC, created_at DESC
    `).all(userId).map((todo) => ({ ...todo, completed: Boolean(todo.completed) }));
  }

  function upsertTodo(userId, todo) {
    const normalised = normaliseTodo(todo);
    if (!normalised) return null;
    db.prepare(`
      INSERT INTO todos (id, user_id, text, completed, created_at, due_date, priority, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id, user_id) DO UPDATE SET
        text = excluded.text,
        completed = excluded.completed,
        due_date = excluded.due_date,
        priority = excluded.priority,
        updated_at = excluded.updated_at
    `).run(
      normalised.id,
      userId,
      normalised.text,
      normalised.completed ? 1 : 0,
      normalised.createdAt,
      normalised.dueDate,
      normalised.priority,
      new Date().toISOString(),
    );
    return normalised;
  }

  app.post('/api/signup', (req, res) => {
    const username = String(req.body?.username || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    if (!/^[a-z0-9_.-]{3,32}$/.test(username)) {
      return res.status(400).json({ error: 'Username must be 3-32 letters, numbers, dots, underscores, or hyphens.' });
    }
    if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' });

    const user = { id: crypto.randomUUID(), username, createdAt: new Date().toISOString() };
    try {
      db.prepare('INSERT INTO users (id, username, password_hash, created_at) VALUES (?, ?, ?, ?)')
        .run(user.id, username, createPasswordHash(password), user.createdAt);
    } catch (error) {
      if (String(error.message).includes('UNIQUE')) return res.status(409).json({ error: 'Username already exists.' });
      throw error;
    }
    return res.status(201).json({ token: issueToken(user), user: toPublicUser(user), todos: [] });
  });

  app.post('/api/login', (req, res) => {
    const username = String(req.body?.username || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    const user = db.prepare('SELECT id, username, password_hash FROM users WHERE username = ?').get(username);
    if (!user || !verifyPassword(password, user.password_hash)) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }
    return res.json({ token: issueToken(user), user: toPublicUser(user), todos: listTodos(user.id) });
  });

  app.get('/api/me', requireAuth, (req, res) => {
    res.json({ user: toPublicUser(req.user), todos: listTodos(req.user.id) });
  });

  app.get('/api/tasks', requireAuth, (req, res) => {
    res.json({ todos: listTodos(req.user.id) });
  });

  app.post('/api/tasks', requireAuth, (req, res) => {
    const created = upsertTodo(req.user.id, { ...req.body, id: req.body?.id || crypto.randomUUID() });
    if (!created) return res.status(400).json({ error: 'A task needs non-empty text.' });
    return res.status(201).json({ todo: created });
  });

  app.put('/api/tasks', requireAuth, (req, res) => {
    if (!Array.isArray(req.body?.todos)) return res.status(400).json({ error: 'Expected a todos array.' });
    const normalised = req.body.todos.map(normaliseTodo).filter(Boolean).slice(0, MAX_TODOS);

    db.exec('BEGIN IMMEDIATE');
    try {
      db.prepare('DELETE FROM todos WHERE user_id = ?').run(req.user.id);
      normalised.forEach((todo) => upsertTodo(req.user.id, todo));
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }

    return res.json({ todos: listTodos(req.user.id) });
  });

  app.patch('/api/tasks/:id', requireAuth, (req, res) => {
    const existing = db.prepare('SELECT id, text, completed, created_at AS createdAt, due_date AS dueDate, priority FROM todos WHERE user_id = ? AND id = ?')
      .get(req.user.id, req.params.id);
    if (!existing) return res.status(404).json({ error: 'Task not found.' });
    const updated = upsertTodo(req.user.id, { ...existing, ...req.body, id: existing.id });
    if (!updated) return res.status(400).json({ error: 'A task needs non-empty text.' });
    return res.json({ todo: updated });
  });

  app.delete('/api/tasks/:id', requireAuth, (req, res) => {
    const result = db.prepare('DELETE FROM todos WHERE user_id = ? AND id = ?').run(req.user.id, req.params.id);
    if (result.changes === 0) return res.status(404).json({ error: 'Task not found.' });
    return res.status(204).send();
  });

  app.get(['/', '/index.html'], (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
  app.get('/styles.css', (req, res) => res.type('text/css').sendFile(path.join(__dirname, 'styles.css')));
  app.get('/app.js', (req, res) => res.type('application/javascript').sendFile(path.join(__dirname, 'app.js')));

  app.close = () => db.close();
  return app;
}

if (require.main === module) {
  const port = Number(process.env.PORT || 8080);
  createApp().listen(port, () => {
    console.log(`Dactyl TODO listening on http://localhost:${port}`);
  });
}

module.exports = { createApp, normaliseTodo };
