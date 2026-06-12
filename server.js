// AI-assisted coding: GPT-5.5 plus Claude Code CLI investigation command
// `claude -p "Investigate likely cause... Do not modify files"` for issue #198; edits add missing static script coverage used by the login page.
// `claude -p "We need address GitHub issue #227... Rebrand TODO app to 'Pond Life'..."` plus GPT-5.5 edits to rebrand visible shared-page copy.
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { URL } = require('node:url');
const { DatabaseSync } = require('node:sqlite');
const express = require('express');
const { sanitizeAnalyticsEvent } = require('./analytics');
const { normaliseRecurrence } = require('./recurrence');

const MAX_TODOS = 200;
const MAX_TODO_LENGTH = 120;
const MAX_NOTES_LENGTH = 1000;
const MAX_CHECKLIST_ITEMS = 10;
const MAX_CHECKLIST_TEXT_LENGTH = 80;
const MAX_SHARE_TITLE_LENGTH = 80;
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;
const USERNAME_PATTERN = /^[a-z0-9_.-]{3,32}$/;
const PRIORITIES = ['low', 'medium', 'high'];
const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const AUTH_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const AUTH_RATE_LIMIT_MAX = 20;
const AUTH_RATE_LIMIT_MAX_KEYS = 1000;

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

function normaliseTimestamp(value) {
  return typeof value === 'string' && value && !Number.isNaN(Date.parse(value)) ? value : '';
}

function normaliseGithubUrl(value) {
  if (value === undefined || value === null || value === '') return '';
  if (typeof value !== 'string') return '';

  let parsed;
  try {
    parsed = new URL(value.trim());
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

function toPublicUser(row) {
  return { id: row.id, username: row.username };
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function userTokenVersion(row) {
  return Number.isInteger(row?.token_version) ? row.token_version : 0;
}

function passwordLengthError(password, label = 'Password') {
  if (password.length < MIN_PASSWORD_LENGTH || password.length > MAX_PASSWORD_LENGTH) {
    return `${label} must be ${MIN_PASSWORD_LENGTH}-${MAX_PASSWORD_LENGTH} characters.`;
  }
  return '';
}

function authError(error, field, code) {
  return { error, field, code };
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

function createFixedWindowRateLimiter({ windowMs, max, keyPrefix = 'rate-limit', maxKeys = AUTH_RATE_LIMIT_MAX_KEYS }) {
  const hits = new Map();

  function pruneExpired(now) {
    for (const [key, entry] of hits) {
      if (entry.resetAt <= now) hits.delete(key);
    }
  }

  function pruneOldest() {
    while (hits.size >= maxKeys) {
      const oldestKey = hits.keys().next().value;
      if (!oldestKey) return;
      hits.delete(oldestKey);
    }
  }

  return (req, res, next) => {
    if (!Number.isFinite(windowMs) || windowMs <= 0 || !Number.isFinite(max) || max <= 0) return next();
    if (!Number.isFinite(maxKeys) || maxKeys <= 0) return next();

    const now = Date.now();
    const clientId = req.ips?.[0] || req.ip || req.socket?.remoteAddress;
    if (!clientId) return next();

    const key = keyPrefix + ':' + clientId;
    let entry = hits.get(key);
    if (!entry || entry.resetAt <= now) {
      pruneExpired(now);
      if (!hits.has(key)) pruneOldest();
      entry = { count: 0, resetAt: now + windowMs };
      hits.set(key, entry);
    }

    entry.count += 1;
    const resetSeconds = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
    res.setHeader('RateLimit-Limit', String(max));
    res.setHeader('RateLimit-Remaining', String(Math.max(0, max - entry.count)));
    res.setHeader('RateLimit-Reset', String(resetSeconds));

    if (entry.count > max) {
      res.setHeader('Retry-After', String(resetSeconds));
      return res.status(429).json({ error: 'Too many authentication attempts. Please try again later.' });
    }

    return next();
  };
}

function createApp(options = {}) {
  const app = express();
  const dbPath = options.dbPath || process.env.DATABASE_PATH || path.join(__dirname, 'data', 'todos.sqlite');
  const jwtSecret = options.jwtSecret || process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');
  const analyticsEnabled = options.analyticsEnabled ?? process.env.DACTYL_ANALYTICS_ENABLED === 'true';
  const analyticsSink = options.analyticsSink || (() => {});
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
    CREATE TABLE IF NOT EXISTS shared_ponds (
      token TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS shared_pond_tasks (
      share_token TEXT NOT NULL REFERENCES shared_ponds(token) ON DELETE CASCADE,
      position INTEGER NOT NULL,
      text TEXT NOT NULL,
      completed INTEGER NOT NULL DEFAULT 0,
      due_date TEXT NOT NULL DEFAULT '',
      priority TEXT NOT NULL DEFAULT 'medium',
      github_url TEXT NOT NULL DEFAULT '',
      PRIMARY KEY (share_token, position)
    );
  `);

  const todoColumns = db.prepare('PRAGMA table_info(todos)').all().map((column) => column.name);
  if (!todoColumns.includes('archived_at')) {
    db.exec("ALTER TABLE todos ADD COLUMN archived_at TEXT NOT NULL DEFAULT ''");
  }
  if (!todoColumns.includes('shoal')) {
    db.exec("ALTER TABLE todos ADD COLUMN shoal TEXT NOT NULL DEFAULT ''");
  }
  if (!todoColumns.includes('blocked')) {
    db.exec('ALTER TABLE todos ADD COLUMN blocked INTEGER NOT NULL DEFAULT 0');
  }
  if (!todoColumns.includes('blocker_reason')) {
    db.exec("ALTER TABLE todos ADD COLUMN blocker_reason TEXT NOT NULL DEFAULT ''");
  }
  if (!todoColumns.includes('github_url')) {
    db.exec("ALTER TABLE todos ADD COLUMN github_url TEXT NOT NULL DEFAULT ''");
  }
  if (!todoColumns.includes('notes')) {
    db.exec("ALTER TABLE todos ADD COLUMN notes TEXT NOT NULL DEFAULT ''");
  }
  if (!todoColumns.includes('checklist_json')) {
    db.exec("ALTER TABLE todos ADD COLUMN checklist_json TEXT NOT NULL DEFAULT '[]'");
  }
  if (!todoColumns.includes('recurrence')) {
    db.exec("ALTER TABLE todos ADD COLUMN recurrence TEXT NOT NULL DEFAULT 'none'");
  }

  const userColumns = db.prepare('PRAGMA table_info(users)').all().map((column) => column.name);
  if (!userColumns.includes('token_version')) {
    db.exec('ALTER TABLE users ADD COLUMN token_version INTEGER NOT NULL DEFAULT 0');
  }

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

  const authRateLimiter = createFixedWindowRateLimiter({
    windowMs: options.authRateLimitWindowMs ?? AUTH_RATE_LIMIT_WINDOW_MS,
    max: options.authRateLimitMax ?? AUTH_RATE_LIMIT_MAX,
    maxKeys: options.authRateLimitMaxKeys ?? AUTH_RATE_LIMIT_MAX_KEYS,
    keyPrefix: 'auth',
  });

  function issueToken(user) {
    return signJwt({
      sub: user.id,
      username: user.username,
      tokenVersion: userTokenVersion(user),
      exp: Date.now() + TOKEN_TTL_MS,
    }, jwtSecret);
  }

  function requireAuth(req, res, next) {
    const header = req.get('authorization') || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    const payload = verifyJwt(token, jwtSecret);
    if (!payload) return res.status(401).json({ error: 'Authentication required.' });
    const user = db.prepare('SELECT id, username, token_version FROM users WHERE id = ?').get(payload.sub);
    if (!user || (payload.tokenVersion ?? 0) !== userTokenVersion(user)) {
      return res.status(401).json({ error: 'Authentication required.' });
    }
    req.user = user;
    return next();
  }

  function listTodos(userId) {
    return db.prepare(`
      SELECT id, text, completed, created_at AS createdAt, due_date AS dueDate, priority, archived_at AS archivedAt, shoal, blocked, blocker_reason AS blockerReason, github_url AS githubUrl, notes, checklist_json AS checklistJson, recurrence
      FROM todos
      WHERE user_id = ?
      ORDER BY completed ASC, COALESCE(NULLIF(due_date, ''), '9999-12-31') ASC, created_at DESC
    `).all(userId).map((todo) => {
      let checklist;
      try {
        checklist = JSON.parse(todo.checklistJson || '[]');
      } catch {
        checklist = [];
      }
      return normaliseTodo({
        ...todo,
        completed: Boolean(todo.completed),
        blocked: Boolean(todo.blocked),
        checklist,
      });
    }).filter(Boolean);
  }

  function upsertTodo(userId, todo) {
    const normalised = normaliseTodo(todo);
    if (!normalised) return null;
    db.prepare(`
      INSERT INTO todos (id, user_id, text, completed, created_at, due_date, priority, archived_at, shoal, blocked, blocker_reason, github_url, notes, checklist_json, recurrence, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id, user_id) DO UPDATE SET
        text = excluded.text,
        completed = excluded.completed,
        due_date = excluded.due_date,
        priority = excluded.priority,
        archived_at = excluded.archived_at,
        shoal = excluded.shoal,
        blocked = excluded.blocked,
        blocker_reason = excluded.blocker_reason,
        github_url = excluded.github_url,
        notes = excluded.notes,
        checklist_json = excluded.checklist_json,
        recurrence = excluded.recurrence,
        updated_at = excluded.updated_at
    `).run(
      normalised.id,
      userId,
      normalised.text,
      normalised.completed ? 1 : 0,
      normalised.createdAt,
      normalised.dueDate,
      normalised.priority,
      normalised.archivedAt,
      normalised.shoal,
      normalised.blocked ? 1 : 0,
      normalised.blockerReason,
      normalised.githubUrl,
      normalised.notes,
      JSON.stringify(normalised.checklist),
      normalised.recurrence,
      new Date().toISOString(),
    );
    return normalised;
  }

  function shareUrl(req, token) {
    return `${req.protocol}://${req.get('host')}/share/${token}`;
  }

  function createSharedPond(user, payload) {
    const requestedIds = Array.isArray(payload?.todoIds)
      ? payload.todoIds.filter((id) => typeof id === 'string' && id.trim()).slice(0, MAX_TODOS)
      : [];
    const requestedIdSet = new Set(requestedIds);
    const sourceTasks = listTodos(user.id).filter((todo) => (
      requestedIds.length === 0 || requestedIdSet.has(todo.id)
    ));
    const orderedTasks = requestedIds.length === 0
      ? sourceTasks
      : requestedIds.map((id) => sourceTasks.find((todo) => todo.id === id)).filter(Boolean);
    const title = String(payload?.title || `${user.username}'s shared pond`)
      .trim()
      .slice(0, MAX_SHARE_TITLE_LENGTH) || `${user.username}'s shared pond`;
    const token = crypto.randomBytes(18).toString('base64url');
    const createdAt = new Date().toISOString();

    db.exec('BEGIN IMMEDIATE');
    try {
      db.prepare('INSERT INTO shared_ponds (token, owner_id, title, created_at) VALUES (?, ?, ?, ?)')
        .run(token, user.id, title, createdAt);
      const insertTask = db.prepare(`
        INSERT INTO shared_pond_tasks (share_token, position, text, completed, due_date, priority, github_url)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      orderedTasks.forEach((todo, index) => {
        insertTask.run(token, index, todo.text, todo.completed ? 1 : 0, todo.dueDate, todo.priority, todo.githubUrl);
      });
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }

    return { token, title, createdAt, tasks: orderedTasks };
  }

  function getSharedPond(token) {
    if (!/^[A-Za-z0-9_-]{16,64}$/.test(String(token || ''))) return null;
    const share = db.prepare(`
      SELECT shared_ponds.token, shared_ponds.title, shared_ponds.created_at AS createdAt, users.username AS ownerUsername
      FROM shared_ponds
      JOIN users ON users.id = shared_ponds.owner_id
      WHERE shared_ponds.token = ?
    `).get(token);
    if (!share) return null;
    const tasks = db.prepare(`
      SELECT text, completed, due_date AS dueDate, priority, github_url AS githubUrl
      FROM shared_pond_tasks
      WHERE share_token = ?
      ORDER BY position ASC
    `).all(token).map((todo) => ({ ...todo, completed: Boolean(todo.completed) }));
    return {
      token: share.token,
      title: share.title,
      createdAt: share.createdAt,
      owner: { username: share.ownerUsername },
      tasks,
    };
  }

  function renderSharedPondPage(share) {
    const taskItems = share.tasks.length === 0
      ? '<li class="shared-empty">No tasks were included in this shared planning view.</li>'
      : share.tasks.map((todo) => {
        const meta = [todo.completed ? 'completed' : 'active', todo.dueDate || 'no due date', `${todo.priority} priority`]
          .map(escapeHtml)
          .join(' · ');
        const github = todo.githubUrl
          ? ` <a href="${escapeHtml(todo.githubUrl)}" rel="noreferrer">GitHub</a>`
          : '';
        return `<li class="shared-task" data-priority="${escapeHtml(todo.priority)}"><strong>${escapeHtml(todo.text)}</strong><span>${meta}${github}</span></li>`;
      }).join('');
    return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(share.title)} · Pond Life shared pond</title>
    <link rel="stylesheet" href="/styles.css" />
  </head>
  <body>
    <main class="app shared-view" aria-labelledby="shared-title">
      <p class="eyebrow">Read-only shared pond</p>
      <h1 id="shared-title">${escapeHtml(share.title)}</h1>
      <p class="subtitle">${escapeHtml(share.owner.username)} shared this planning view. Private tasks that were not selected for this view stay hidden.</p>
      <ul class="shared-task-list">${taskItems}</ul>
    </main>
  </body>
</html>`;
  }

  app.post('/api/signup', authRateLimiter, (req, res) => {
    const username = String(req.body?.username || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    if (!USERNAME_PATTERN.test(username)) {
      return res.status(400).json(authError('Username must be 3-32 letters, numbers, dots, underscores, or hyphens.', 'username', 'invalid_username'));
    }
    const passwordError = passwordLengthError(password);
    if (passwordError) return res.status(400).json(authError(passwordError, 'password', 'invalid_password_length'));

    const user = { id: crypto.randomUUID(), username, createdAt: new Date().toISOString() };
    try {
      db.prepare('INSERT INTO users (id, username, password_hash, created_at, token_version) VALUES (?, ?, ?, ?, 0)')
        .run(user.id, username, createPasswordHash(password), user.createdAt);
    } catch (error) {
      if (String(error.message).includes('UNIQUE')) return res.status(409).json(authError('Username already exists.', 'username', 'username_taken'));
      throw error;
    }
    return res.status(201).json({ token: issueToken(user), user: toPublicUser(user), todos: [] });
  });

  app.post('/api/login', authRateLimiter, (req, res) => {
    const username = String(req.body?.username || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    const passwordError = passwordLengthError(password);
    if (passwordError) return res.status(400).json(authError(passwordError, 'password', 'invalid_password_length'));

    const user = db.prepare('SELECT id, username, password_hash, token_version FROM users WHERE username = ?').get(username);
    if (!user || !verifyPassword(password, user.password_hash)) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }
    return res.json({ token: issueToken(user), user: toPublicUser(user), todos: listTodos(user.id) });
  });

  app.get('/api/me', requireAuth, (req, res) => {
    res.json({ user: toPublicUser(req.user), todos: listTodos(req.user.id) });
  });

  app.post('/api/account/password', requireAuth, (req, res) => {
    const currentPassword = String(req.body?.currentPassword || '');
    const newPassword = String(req.body?.newPassword || '');
    const currentPasswordError = passwordLengthError(currentPassword, 'Current password');
    if (currentPasswordError) return res.status(400).json({ error: currentPasswordError });
    const newPasswordError = passwordLengthError(newPassword, 'New password');
    if (newPasswordError) return res.status(400).json({ error: newPasswordError });

    const user = db.prepare('SELECT id, username, password_hash, token_version FROM users WHERE id = ?').get(req.user.id);
    if (!user || !verifyPassword(currentPassword, user.password_hash)) {
      return res.status(401).json({ error: 'Current password is incorrect.' });
    }

    const nextTokenVersion = userTokenVersion(user) + 1;
    db.prepare('UPDATE users SET password_hash = ?, token_version = ? WHERE id = ?')
      .run(createPasswordHash(newPassword), nextTokenVersion, user.id);

    const updatedUser = { ...user, token_version: nextTokenVersion };
    return res.json({
      token: issueToken(updatedUser),
      user: toPublicUser(updatedUser),
      todos: listTodos(user.id),
    });
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
    const existing = listTodos(req.user.id).find((todo) => todo.id === req.params.id);
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

  app.post('/api/analytics', (req, res) => {
    const event = sanitizeAnalyticsEvent(req.body?.event, req.body?.payload);
    if (!event) return res.status(400).json({ error: 'Unsupported analytics event.' });
    if (analyticsEnabled) analyticsSink({ ...event, receivedAt: new Date().toISOString() });
    return res.status(204).send();
  });

  app.post('/api/shared-ponds', requireAuth, (req, res) => {
    const share = createSharedPond(req.user, req.body);
    return res.status(201).json({
      share: {
        token: share.token,
        title: share.title,
        createdAt: share.createdAt,
        taskCount: share.tasks.length,
        url: shareUrl(req, share.token),
      },
    });
  });

  app.get('/api/shared-ponds/:token', (req, res) => {
    const share = getSharedPond(req.params.token);
    if (!share) return res.status(404).json({ error: 'Shared pond not found.' });
    return res.json({ share });
  });

  app.get('/share/:token', (req, res) => {
    const share = getSharedPond(req.params.token);
    if (!share) return res.status(404).send('Shared pond not found.');
    return res.type('html').send(renderSharedPondPage(share));
  });

  app.get(['/', '/index.html'], (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
  app.post(['/', '/index.html'], (req, res) => res.redirect(303, '/'));
  app.get(['/docs', '/docs.html'], (req, res) => res.sendFile(path.join(__dirname, 'docs.html')));
  app.get('/favicon.svg', (req, res) => res.type('image/svg+xml').sendFile(path.join(__dirname, 'favicon.svg')));
  app.get('/styles.css', (req, res) => res.type('text/css').sendFile(path.join(__dirname, 'styles.css')));
  app.get('/analytics-config.js', (req, res) => {
    res.type('application/javascript').send(`window.DACTYL_ANALYTICS_CONFIG = ${JSON.stringify({ enabled: analyticsEnabled, endpoint: '/api/analytics' })};\n`);
  });
  app.get('/analytics.js', (req, res) => res.type('application/javascript').sendFile(path.join(__dirname, 'analytics.js')));
  app.get('/calendar-export.js', (req, res) => res.type('application/javascript').sendFile(path.join(__dirname, 'calendar-export.js')));
  app.get('/contextual-empty-states.js', (req, res) => res.type('application/javascript').sendFile(path.join(__dirname, 'contextual-empty-states.js')));
  app.get('/daily-catch.js', (req, res) => res.type('application/javascript').sendFile(path.join(__dirname, 'daily-catch.js')));
  app.get('/due-nudges.js', (req, res) => res.type('application/javascript').sendFile(path.join(__dirname, 'due-nudges.js')));
  app.get('/premium-hooks.js', (req, res) => res.type('application/javascript').sendFile(path.join(__dirname, 'premium-hooks.js')));
  app.get('/recurrence.js', (req, res) => res.type('application/javascript').sendFile(path.join(__dirname, 'recurrence.js')));
  app.get('/screen-state.js', (req, res) => res.type('application/javascript').sendFile(path.join(__dirname, 'screen-state.js')));
  app.get('/view-state.js', (req, res) => res.type('application/javascript').sendFile(path.join(__dirname, 'view-state.js')));
  app.get('/fish-emoji.js', (req, res) => res.type('application/javascript').sendFile(path.join(__dirname, 'fish-emoji.js')));
  app.get('/first-task-onboarding.js', (req, res) => res.type('application/javascript').sendFile(path.join(__dirname, 'first-task-onboarding.js')));
  app.get('/quick-add-parser.js', (req, res) => res.type('application/javascript').sendFile(path.join(__dirname, 'quick-add-parser.js')));
  app.get('/triage-mode.js', (req, res) => res.type('application/javascript').sendFile(path.join(__dirname, 'triage-mode.js')));
  app.get('/github-import.js', (req, res) => res.type('application/javascript').sendFile(path.join(__dirname, 'github-import.js')));
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
