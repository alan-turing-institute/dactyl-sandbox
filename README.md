# dactyl-sandbox

Sandbox for the Dactyl OpenClaw agent (Hack Week 2026).

## TODO app

This repository contains a small TODO app built with HTML, CSS, vanilla JavaScript, and a Node/Express backend. Users can sign up or log in, then sync tasks through a SQLite-backed API protected by simple JWT authentication.

### Features

- Sign up and log in with username/password credentials
- Change a signed-in account password and invalidate old session tokens
- Sync TODOs to a server-side SQLite database instead of browser-only task storage
- REST API for creating, reading, updating, replacing, and deleting tasks
- Add, edit, and delete tasks with optional due dates, GitHub issue/PR links, and low, medium, or high priority
- Use quick priority chips to mark the next fish as low, medium, or high tide
- Mark tasks as complete
- Archive completed tasks to a reef view, restore them later, or permanently release archived tasks
- Filter all, active, completed, archived, Tide mode grouped urgency lanes, a Week ahead agenda, and a Ghost net stale-task review
- Search task text and narrow the pond with quick chips for high priority, due soon, no due date, or selected net tasks
- Save repeated planning filters as local smart views for quick reuse
- Open fish-themed button help to decode key controls and pond-specific UI language
- Review Ghost net tasks (overdue, no-due-date tasks older than 7 days, high-priority tasks older than 7 days) with per-task Focus, Snooze to tomorrow, Snooze one week, and Release actions
- Show deterministic fishy mood badges with accessible text
- Rotate mood badges through a wider pool of fish and sea-life emoji while keeping the labels stable
- Capture quick tasks with natural-language hints like `tomorrow`, `next Friday`, `due:2026-06-14`, `low`, `medium`, or `high`; expand `+ more options` only when you need due date, GitHub URL, recurrence, or priority fields
- Clear active tasks keyboard-first with triage mode: one task card, complete/archive/priority, and due-date nudges
- Nudge due dates inline from each task chip with keyboard-reachable ±1 day / ±1 week controls, or set no-date tasks to tomorrow
- See contextual empty-state guidance for filters, search, ghost net, Tide mode, and Daily Catch so an empty view explains what to do next
- Keep private per-task notes and capped checklists in the app; details only leave the pond when you copy/export them yourself
- Plan a small Daily Catch from overdue, due-today, high-priority, and focused tasks; pins stay local to the app
- Show dismissible, non-blocking premium hooks from centralised copy/config; no payment processing or feature blocking is included
- Mark tasks as daily, weekly, or monthly recurring; completing one schedules the next active occurrence
- Pick one active task for "feed the fish" focus mode
- Stock or release fish-themed demo tasks without duplicating sample data
- Cast a net to select multiple visible tasks, release them, or move them to a custom shoal
- **Custom shoals** — group tasks into named shoals (project, workstream, demo, etc.) and filter by shoal
- Paste Slack-style bullets or checklists into the pond in bulk, with optional `[high]` and `due:YYYY-MM-DD` markers
- Export a versioned JSON pond backup and restore it later with a merge/replace preview before anything changes
- Export a calendar snapshot (`.ics`) of active tasks with due dates and projected recurring-task occurrences over the next 60 days; open in any calendar app — the file is a user-controlled snapshot, not a live-sync feed
- Attach validated GitHub issue or PR URLs to tasks and show compact link chips plus report links
- Review a Pond health panel with counts, sync status, render timing, and copy-safe diagnostics that omit task text and private account data
- Copy a read-only pond snapshot for standups and demos without account credentials or edit controls
- Use a dismissible first-run Pond tour and empty-state quick start for self-serve onboarding
- Show a Pond shortcuts help card with safe keyboard shortcuts for repeat actions
- **Starter shoals** — one-click task templates for stand-ups, PR reviews, demo prep, and docs tidy-ups.
- Clear completed tasks
- Validate saved task data before rendering
- Responsive layout with accessible labels

### Keyboard shortcuts

Open the in-app **Pond shortcuts** card with the visible button or press `?`. Shortcuts only run when focus is not in a form field, button, or editable element.

- `?` opens or closes the shortcuts card
- `/` focuses the task input
- `T` switches to Tide mode
- `G` switches to Ghost net review
- `A` switches to All tasks
- `R` copies the pond report
- `Esc` closes the shortcuts card and leaves net mode

### Deploy

Run the app in the cloud without a local install.

#### Try the hosted demo

A hosted demo is available at <https://dactyl.azurewebsites.net/>. Treat it as a shared demo instance: do not enter sensitive tasks or passwords, and assume account data may be reset as the hack-week app is redeployed.

#### Render

Click the button below to deploy your own copy to [Render](https://render.com). A free-tier web service will be created with a randomly generated `JWT_SECRET`.

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/alan-turing-institute/dactyl-sandbox)

The app will be available at the URL Render assigns (e.g. `https://dactyl-sandbox.onrender.com`). Free-tier instances spin down after inactivity and may take a few seconds to wake on first request.

Data is stored in an ephemeral SQLite file on the Render container filesystem unless you configure a persistent disk. For persistent storage, mount a Render disk at `/data` and set `DATABASE_PATH=/data/todos.sqlite`.

#### Railway

1. Install the [Railway CLI](https://docs.railway.app/develop/cli) and run `railway login`.
2. Clone this repository and navigate to its root directory.
3. Run `railway up` to deploy. Railway detects the `railway.toml` config automatically.
4. Set `JWT_SECRET` in the Railway dashboard under **Variables** for a stable signing secret across redeploys.

Data is stored in an ephemeral SQLite file on the container filesystem. For persistent storage, mount a [Railway volume](https://docs.railway.app/reference/volumes) at `/data` and set `DATABASE_PATH=/data/todos.sqlite`.

### Published documentation

The standalone documentation site is published with GitHub Pages at <https://alan-turing-institute.github.io/dactyl-sandbox/>. It reuses the in-app `docs.html` guide, builds to `dist/docs`, and uses relative asset links so it works under the repository Pages path.

Build and validate the static docs locally with:

```bash
npm run docs:lint
```

Pull request CI runs the docs build, and pushes to `main` deploy the generated `dist/docs` artifact with the official GitHub Pages actions.

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
docker run --rm --init -p 8080:8080 -v dactyl-data:/data -e JWT_SECRET=change-me dactyl-sandbox
```

Then visit <http://localhost:8080>. The container runs an unprivileged Node process that serves the frontend and API on port 8080.
