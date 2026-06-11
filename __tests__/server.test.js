const request = require('supertest');
const { createApp } = require('../server');

function makeApp() {
  return createApp({ dbPath: ':memory:', jwtSecret: 'test-secret' });
}

describe('auth and task API', () => {
  let app;

  afterEach(() => {
    if (app?.close) app.close();
  });

  test('signs up, persists tasks, and returns them after login', async () => {
    app = makeApp();

    const signup = await request(app)
      .post('/api/signup')
      .send({ username: 'marlow', password: 'very-secret' })
      .expect(201);

    expect(signup.body.token).toBeTruthy();
    expect(signup.body.user.username).toBe('marlow');

    const token = signup.body.token;
    const createTask = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${token}`)
      .send({
        text: 'Sync the fish pond',
        dueDate: '2026-06-11',
        priority: 'high',
        githubUrl: 'https://github.com/alan-turing-institute/dactyl-sandbox/issues/31?from=test',
      })
      .expect(201);

    expect(createTask.body.todo.text).toBe('Sync the fish pond');
    expect(createTask.body.todo.githubUrl).toBe('https://github.com/alan-turing-institute/dactyl-sandbox/issues/31');

    await request(app)
      .patch(`/api/tasks/${createTask.body.todo.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ completed: true })
      .expect(200);

    const login = await request(app)
      .post('/api/login')
      .send({ username: 'marlow', password: 'very-secret' })
      .expect(200);

    expect(login.body.todos).toHaveLength(1);
    expect(login.body.todos[0]).toMatchObject({
      text: 'Sync the fish pond',
      completed: true,
      priority: 'high',
      githubUrl: 'https://github.com/alan-turing-institute/dactyl-sandbox/issues/31',
    });
  });

  test('does not expose server source files', async () => {
    app = makeApp();

    await request(app).get('/server.js').expect(404);
    await request(app).get('/').expect(200).expect('Content-Security-Policy', /default-src 'self'/);
    await request(app)
      .get('/first-task-onboarding.js')
      .expect(200)
      .expect('Content-Type', /javascript/);
    await request(app)
      .get('/analytics.js')
      .expect(200)
      .expect('Content-Type', /javascript/);
    await request(app)
      .get('/analytics-config.js')
      .expect(200)
      .expect('Content-Type', /javascript/)
      .expect(/DACTYL_ANALYTICS_CONFIG/);
  });

  test('rate limits auth routes', async () => {
    app = createApp({
      dbPath: ':memory:',
      jwtSecret: 'test-secret',
      authRateLimitMax: 2,
      authRateLimitWindowMs: 60 * 1000,
    });

    await request(app)
      .post('/api/signup')
      .send({ username: 'limited-user', password: 'very-secret' })
      .expect(201);

    await request(app)
      .post('/api/login')
      .send({ username: 'limited-user', password: 'wrong-secret' })
      .expect(401);

    await request(app)
      .post('/api/signup')
      .send({ username: 'limited-other', password: 'very-secret' })
      .expect(429)
      .expect('Retry-After', /.+/)
      .expect('RateLimit-Limit', '2')
      .expect(({ body }) => {
        expect(body.error).toBe('Too many authentication attempts. Please try again later.');
      });
  });

  test('returns field-specific signup validation errors', async () => {
    app = makeApp();

    await request(app)
      .post('/api/signup')
      .send({ username: 'valid-user', password: 'short' })
      .expect(400)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          error: 'Password must be 8-128 characters.',
          field: 'password',
          code: 'invalid_password_length',
        });
      });

    await request(app)
      .post('/api/signup')
      .send({ username: 'bad username', password: 'very-secret' })
      .expect(400)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          error: 'Username must be 3-32 letters, numbers, dots, underscores, or hyphens.',
          field: 'username',
          code: 'invalid_username',
        });
      });
  });

  test('accepts analytics events only through sanitised allow-list', async () => {
    const analyticsSink = jest.fn();
    app = createApp({
      dbPath: ':memory:',
      jwtSecret: 'test-secret',
      analyticsEnabled: true,
      analyticsSink,
    });

    await request(app)
      .post('/api/analytics')
      .send({ event: 'task_created', payload: { priority: 'high', taskText: 'Private task' } })
      .expect(204);

    expect(analyticsSink).toHaveBeenCalledWith(expect.objectContaining({
      event: 'task_created',
      payload: { priority: 'high' },
    }));

    await request(app)
      .post('/api/analytics')
      .send({ event: 'task_title_leaked', payload: { priority: 'high' } })
      .expect(400);
  });

  test('requires a valid token and keeps users isolated', async () => {
    app = makeApp();

    await request(app).get('/api/tasks').expect(401);

    const first = await request(app)
      .post('/api/signup')
      .send({ username: 'first-user', password: 'very-secret' })
      .expect(201);
    const second = await request(app)
      .post('/api/signup')
      .send({ username: 'second-user', password: 'very-secret' })
      .expect(201);

    await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${first.body.token}`)
      .send({ text: 'Private task' })
      .expect(201);

    const secondTasks = await request(app)
      .get('/api/tasks')
      .set('Authorization', `Bearer ${second.body.token}`)
      .expect(200);

    expect(secondTasks.body.todos).toEqual([]);
  });

  test('creates read-only shared pond views without leaking private tasks', async () => {
    app = makeApp();

    const first = await request(app)
      .post('/api/signup')
      .send({ username: 'share-owner', password: 'very-secret' })
      .expect(201);
    const second = await request(app)
      .post('/api/signup')
      .send({ username: 'share-other', password: 'very-secret' })
      .expect(201);

    const sharedTask = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${first.body.token}`)
      .send({ text: 'Shared planning task', priority: 'high', dueDate: '2026-06-13' })
      .expect(201);
    const privateTask = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${first.body.token}`)
      .send({ text: 'Private solo task' })
      .expect(201);
    const otherUsersTask = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${second.body.token}`)
      .send({ text: 'Other user task' })
      .expect(201);

    await request(app)
      .get('/api/shared-ponds/not-a-real-token')
      .expect(404);

    const created = await request(app)
      .post('/api/shared-ponds')
      .set('Authorization', `Bearer ${first.body.token}`)
      .send({
        title: 'Sprint planning pond',
        todoIds: [sharedTask.body.todo.id, otherUsersTask.body.todo.id],
      })
      .expect(201);

    expect(created.body.share.url).toMatch(/\/share\//);
    expect(created.body.share.taskCount).toBe(1);

    const shared = await request(app)
      .get(`/api/shared-ponds/${created.body.share.token}`)
      .expect(200);

    expect(shared.body.share).toMatchObject({
      title: 'Sprint planning pond',
      owner: { username: 'share-owner' },
    });
    expect(shared.body.share.tasks).toEqual([
      expect.objectContaining({ text: 'Shared planning task', priority: 'high', dueDate: '2026-06-13' }),
    ]);
    expect(shared.body.share.tasks.map((todo) => todo.text)).not.toContain(privateTask.body.todo.text);
    expect(shared.body.share.tasks.map((todo) => todo.text)).not.toContain(otherUsersTask.body.todo.text);

    await request(app)
      .get(`/share/${created.body.share.token}`)
      .expect(200)
      .expect('Content-Type', /html/)
      .expect(/Read-only shared pond/)
      .expect(/Shared planning task/);
  });

  test('replaces a user task list with PUT /api/tasks', async () => {
    app = makeApp();

    const signup = await request(app)
      .post('/api/signup')
      .send({ username: 'put-user', password: 'very-secret' })
      .expect(201);

    await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${signup.body.token}`)
      .send({ text: 'Old task' })
      .expect(201);

    const replacement = await request(app)
      .put('/api/tasks')
      .set('Authorization', `Bearer ${signup.body.token}`)
      .send({
        todos: [
          { id: 'bulk-1', text: 'Bulk save task', completed: false, dueDate: '2026-06-12', priority: 'high' },
          { id: 'bulk-2', text: 'Second task', completed: true, dueDate: '', priority: 'low', githubUrl: 'https://github.com/alan-turing-institute/dactyl-sandbox/pull/48' },
          { id: 'bulk-3', text: 'Invalid GitHub link', completed: false, githubUrl: 'https://example.com/not-github/issues/1' },
        ],
      })
      .expect(200);

    expect(replacement.body.todos).toHaveLength(3);
    expect(replacement.body.todos).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'bulk-1', text: 'Bulk save task', completed: false, dueDate: '2026-06-12', priority: 'high' }),
      expect.objectContaining({ id: 'bulk-2', text: 'Second task', completed: true, dueDate: '', priority: 'low', githubUrl: 'https://github.com/alan-turing-institute/dactyl-sandbox/pull/48' }),
      expect.objectContaining({ id: 'bulk-3', text: 'Invalid GitHub link', githubUrl: '' }),
    ]));

    const tasks = await request(app)
      .get('/api/tasks')
      .set('Authorization', `Bearer ${signup.body.token}`)
      .expect(200);

    expect(tasks.body.todos.map((todo) => todo.text)).not.toContain('Old task');
  });

  test('persists archived task markers through patch and replace', async () => {
    app = makeApp();

    const signup = await request(app)
      .post('/api/signup')
      .send({ username: 'archive-user', password: 'very-secret' })
      .expect(201);

    const created = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${signup.body.token}`)
      .send({ text: 'Archive me', completed: true, archivedAt: '2026-06-11T08:00:00.000Z' })
      .expect(201);

    expect(created.body.todo).toMatchObject({ text: 'Archive me', completed: true, archivedAt: '2026-06-11T08:00:00.000Z' });

    const restored = await request(app)
      .patch(`/api/tasks/${created.body.todo.id}`)
      .set('Authorization', `Bearer ${signup.body.token}`)
      .send({ archivedAt: '' })
      .expect(200);

    expect(restored.body.todo.archivedAt).toBe('');

    const replacement = await request(app)
      .put('/api/tasks')
      .set('Authorization', `Bearer ${signup.body.token}`)
      .send({
        todos: [
          { id: 'archived-1', text: 'Old shell', completed: true, archivedAt: '2026-06-11T09:00:00.000Z' },
          { id: 'bad-archive', text: 'Bad archive date', completed: true, archivedAt: 'not-a-date' },
        ],
      })
      .expect(200);

    expect(replacement.body.todos).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'archived-1', archivedAt: '2026-06-11T09:00:00.000Z' }),
      expect.objectContaining({ id: 'bad-archive', archivedAt: '' }),
    ]));
  });

  test('persists task notes and checklist details through create, patch, and replace', async () => {
    app = makeApp();

    const signup = await request(app)
      .post('/api/signup')
      .send({ username: 'details-user', password: 'very-secret' })
      .expect(201);

    const created = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${signup.body.token}`)
      .send({
        text: 'Detailed fish',
        notes: ` ${'n'.repeat(1100)} `,
        checklist: [
          { id: 'one', text: 'Write test', completed: true },
          { id: 'two', text: ' '.repeat(4), completed: false },
          { id: 'three', text: 'Run smoke check', completed: false },
        ],
      })
      .expect(201);

    expect(created.body.todo.notes).toHaveLength(1000);
    expect(created.body.todo.checklist).toEqual([
      { id: 'one', text: 'Write test', completed: true },
      { id: 'three', text: 'Run smoke check', completed: false },
    ]);

    const patched = await request(app)
      .patch(`/api/tasks/${created.body.todo.id}`)
      .set('Authorization', `Bearer ${signup.body.token}`)
      .send({
        notes: 'Short context',
        checklist: [{ id: 'one', text: 'Write test', completed: false }],
      })
      .expect(200);

    expect(patched.body.todo).toMatchObject({
      notes: 'Short context',
      checklist: [{ id: 'one', text: 'Write test', completed: false }],
    });

    const replacement = await request(app)
      .put('/api/tasks')
      .set('Authorization', `Bearer ${signup.body.token}`)
      .send({
        todos: [{
          id: 'bulk-details',
          text: 'Bulk detail task',
          notes: 'Acceptance notes stay private',
          checklist: Array.from({ length: 12 }, (_, index) => ({ id: `item-${index}`, text: `Step ${index}`, completed: index === 0 })),
        }],
      })
      .expect(200);

    expect(replacement.body.todos[0]).toMatchObject({
      id: 'bulk-details',
      notes: 'Acceptance notes stay private',
    });
    expect(replacement.body.todos[0].checklist).toHaveLength(10);
  });

  test('rejects invalid task patches with 400', async () => {
    app = makeApp();

    const signup = await request(app)
      .post('/api/signup')
      .send({ username: 'patch-user', password: 'very-secret' })
      .expect(201);

    const created = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${signup.body.token}`)
      .send({ text: 'Patch me' })
      .expect(201);

    await request(app)
      .patch(`/api/tasks/${created.body.todo.id}`)
      .set('Authorization', `Bearer ${signup.body.token}`)
      .send({ text: '' })
      .expect(400);

    const linked = await request(app)
      .patch(`/api/tasks/${created.body.todo.id}`)
      .set('Authorization', `Bearer ${signup.body.token}`)
      .send({ githubUrl: 'https://github.com/alan-turing-institute/dactyl-sandbox/pull/66#discussion' })
      .expect(200);

    expect(linked.body.todo.githubUrl).toBe('https://github.com/alan-turing-institute/dactyl-sandbox/pull/66');

    const unlinked = await request(app)
      .patch(`/api/tasks/${created.body.todo.id}`)
      .set('Authorization', `Bearer ${signup.body.token}`)
      .send({ githubUrl: 'https://github.example/alan-turing-institute/dactyl-sandbox/pull/66' })
      .expect(200);

    expect(unlinked.body.todo.githubUrl).toBe('');
  });

  test('deletes a task and enforces user isolation on delete', async () => {
    app = makeApp();

    const owner = await request(app)
      .post('/api/signup')
      .send({ username: 'delete-owner', password: 'very-secret' })
      .expect(201);
    const other = await request(app)
      .post('/api/signup')
      .send({ username: 'delete-other', password: 'very-secret' })
      .expect(201);

    const created = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${owner.body.token}`)
      .send({ text: 'Delete me' })
      .expect(201);

    await request(app)
      .delete(`/api/tasks/${created.body.todo.id}`)
      .set('Authorization', `Bearer ${other.body.token}`)
      .expect(404);

    await request(app)
      .delete('/api/tasks/missing-task')
      .set('Authorization', `Bearer ${owner.body.token}`)
      .expect(404);

    await request(app)
      .delete(`/api/tasks/${created.body.todo.id}`)
      .set('Authorization', `Bearer ${owner.body.token}`)
      .expect(204);

    const tasks = await request(app)
      .get('/api/tasks')
      .set('Authorization', `Bearer ${owner.body.token}`)
      .expect(200);

    expect(tasks.body.todos).toEqual([]);
  });

  test('changes password and invalidates older tokens', async () => {
    app = makeApp();

    const signup = await request(app)
      .post('/api/signup')
      .send({ username: 'rotate-user', password: 'very-secret' })
      .expect(201);

    const oldToken = signup.body.token;

    await request(app)
      .post('/api/account/password')
      .set('Authorization', `Bearer ${oldToken}`)
      .send({ currentPassword: 'wrong-secret', newPassword: 'new-secret' })
      .expect(401);

    await request(app)
      .post('/api/account/password')
      .set('Authorization', `Bearer ${oldToken}`)
      .send({ currentPassword: 'very-secret', newPassword: 'short' })
      .expect(400);

    const changed = await request(app)
      .post('/api/account/password')
      .set('Authorization', `Bearer ${oldToken}`)
      .send({ currentPassword: 'very-secret', newPassword: 'new-secret' })
      .expect(200);

    expect(changed.body.token).toBeTruthy();
    expect(changed.body.token).not.toBe(oldToken);
    expect(changed.body.user.username).toBe('rotate-user');

    await request(app)
      .get('/api/me')
      .set('Authorization', `Bearer ${oldToken}`)
      .expect(401);

    await request(app)
      .get('/api/me')
      .set('Authorization', `Bearer ${changed.body.token}`)
      .expect(200);

    await request(app)
      .post('/api/login')
      .send({ username: 'rotate-user', password: 'very-secret' })
      .expect(401);

    await request(app)
      .post('/api/login')
      .send({ username: 'rotate-user', password: 'new-secret' })
      .expect(200);
  });

  test('rejects passwords longer than the bounded scrypt input length', async () => {
    app = makeApp();
    const longPassword = 'p'.repeat(129);

    await request(app)
      .post('/api/signup')
      .send({ username: 'long-signup', password: longPassword })
      .expect(400)
      .expect(({ body }) => {
        expect(body.error).toBe('Password must be 8-128 characters.');
      });

    const signup = await request(app)
      .post('/api/signup')
      .send({ username: 'bounded-user', password: 'very-secret' })
      .expect(201);

    await request(app)
      .post('/api/login')
      .send({ username: 'bounded-user', password: longPassword })
      .expect(400)
      .expect(({ body }) => {
        expect(body.error).toBe('Password must be 8-128 characters.');
      });

    await request(app)
      .post('/api/account/password')
      .set('Authorization', `Bearer ${signup.body.token}`)
      .send({ currentPassword: 'very-secret', newPassword: longPassword })
      .expect(400)
      .expect(({ body }) => {
        expect(body.error).toBe('New password must be 8-128 characters.');
      });
  });

  test('malformed password hashes fail login without crashing', async () => {
    app = makeApp();

    await request(app)
      .post('/api/signup')
      .send({ username: 'broken-hash', password: 'very-secret' })
      .expect(201);

    app.locals.db.prepare('UPDATE users SET password_hash = ? WHERE username = ?')
      .run('salt:abc123', 'broken-hash');

    await request(app)
      .post('/api/login')
      .send({ username: 'broken-hash', password: 'very-secret' })
      .expect(401);
  });

  test('persists blocked and blockerReason fields through patch and list', async () => {
    app = makeApp();

    const signup = await request(app)
      .post('/api/signup')
      .send({ username: 'blocker-user', password: 'very-secret' })
      .expect(201);

    const token = signup.body.token;

    // Create a task then flag it as blocked with a reason
    const created = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${token}`)
      .send({ text: 'Blocked fish', blocked: true, blockerReason: 'Waiting on PR review' })
      .expect(201);

    expect(created.body.todo.blocked).toBe(true);
    expect(created.body.todo.blockerReason).toBe('Waiting on PR review');

    // Verify it comes back in list
    const list = await request(app)
      .get('/api/tasks')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(list.body.todos[0].blocked).toBe(true);
    expect(list.body.todos[0].blockerReason).toBe('Waiting on PR review');

    // Unblock via patch
    const unblocked = await request(app)
      .patch(`/api/tasks/${created.body.todo.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ blocked: false, blockerReason: '' })
      .expect(200);

    expect(unblocked.body.todo.blocked).toBe(false);
    expect(unblocked.body.todo.blockerReason).toBe('');

    // Verify persisted after unblock
    const afterUnblock = await request(app)
      .get('/api/tasks')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(afterUnblock.body.todos[0].blocked).toBe(false);
    expect(afterUnblock.body.todos[0].blockerReason).toBe('');
  });

  test('truncates blockerReason to 160 characters', async () => {
    app = makeApp();

    const signup = await request(app)
      .post('/api/signup')
      .send({ username: 'truncate-user', password: 'very-secret' })
      .expect(201);

    const longReason = 'x'.repeat(200);
    const created = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${signup.body.token}`)
      .send({ text: 'Long blocker', blocked: true, blockerReason: longReason })
      .expect(201);

    expect(created.body.todo.blockerReason).toHaveLength(160);
  });
});
