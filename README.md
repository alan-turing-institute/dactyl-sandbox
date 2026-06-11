# dactyl-sandbox

Sandbox for the Dactyl OpenClaw agent (Hack Week 2026).

## TODO app

This repository contains a small TODO app built with HTML, CSS, vanilla JavaScript, and a Node/Express backend. Users can sign up or log in, then sync tasks through a SQLite-backed API protected by simple JWT authentication.

### Features

- Sign up and log in with username/password credentials
- Sync TODOs to a server-side SQLite database instead of browser-only task storage
- REST API for creating, reading, updating, replacing, and deleting tasks
- Add and delete tasks with optional due dates and low, medium, or high priority
- Mark tasks as complete
- Filter all, active, completed, and Tide mode grouped urgency lanes
- Show deterministic fishy mood badges with accessible text
- Pick one active task for "feed the fish" focus mode
- Stock or release fish-themed demo tasks without duplicating sample data
- Cast a net to select multiple visible tasks, release them, or move them to a priority shoal
- Paste Slack-style bullets or checklists into the pond in bulk, with optional `[high]` and `due:YYYY-MM-DD` markers
- Use a dismissible first-run Pond tour and empty-state quick start for self-serve onboarding
- Clear completed tasks
- Validate saved task data before rendering
- Responsive layout with accessible labels

### Run locally

Install dependencies and start the app:

```bash
npm install
npm start
```

Then visit <http://localhost:8080>. Data is stored in `data/todos.sqlite` by default. Set `DATABASE_PATH` to choose another SQLite file and `JWT_SECRET` to provide a stable signing secret across restarts.

### Test

```bash
npm test
```

The test suite uses Jest and Supertest to cover signup, login, authenticated task persistence, and user isolation.

### Run with Docker

Build the app image:

```bash
docker build -t dactyl-sandbox .
```

Run the container on local port 8080, mounting a volume for SQLite persistence:

```bash
docker run --rm -p 8080:8080 -v dactyl-data:/data -e JWT_SECRET=change-me dactyl-sandbox
```

Then visit <http://localhost:8080>. The container runs an unprivileged Node process that serves the frontend and API on port 8080.
