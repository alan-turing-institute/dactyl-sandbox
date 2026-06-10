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
      .send({ text: 'Sync the fish pond', dueDate: '2026-06-11', priority: 'high' })
      .expect(201);

    expect(createTask.body.todo.text).toBe('Sync the fish pond');

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
    expect(login.body.todos[0]).toMatchObject({ text: 'Sync the fish pond', completed: true, priority: 'high' });
  });

  test('does not expose server source files', async () => {
    app = makeApp();

    await request(app).get('/server.js').expect(404);
    await request(app).get('/').expect(200).expect('Content-Security-Policy', /default-src 'self'/);
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
});
