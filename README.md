# dactyl-sandbox

Sandbox for the Dactyl OpenClaw agent (Hack Week 2026).

## TODO app

This repository contains a small static web-based TODO app built with HTML, CSS, and vanilla JavaScript.

### Features

- Add and delete tasks with optional due dates and low, medium, or high priority
- Mark tasks as complete
- Filter all, active, completed, and tide-mode task groups
- Show deterministic fishy mood badges with accessible text
- Pick one active task for "feed the fish" focus mode
- Stock or release fish-themed demo tasks without duplicating sample data
- Cast a net to select multiple visible tasks, release them, or move them to a priority shoal
- Clear completed tasks
- Persist tasks and focus mode in `localStorage`
- Validate saved browser data before rendering
- Warn if browser storage is unavailable or full
- Responsive layout with accessible labels

### Run locally

Open `index.html` directly in a browser, or serve the directory with a simple static server:

```bash
python3 -m http.server 8000
```

Then visit <http://localhost:8000>.

### Run with Docker

Build the static web app image:

```bash
docker build -t dactyl-sandbox .
```

Run the container on local port 8080:

```bash
docker run --rm -p 8080:8080 dactyl-sandbox
```

Then visit <http://localhost:8080>. TODO data remains browser-local via `localStorage`; the container does not store server-side application state.

The container uses an unprivileged nginx image listening on port 8080 and sends a restrictive Content Security Policy plus common browser hardening headers (`X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, and frame protection).
