# dactyl-sandbox

Sandbox for the Dactyl OpenClaw agent (Hack Week 2026).

## TODO app

This repository contains a small static web-based TODO app built with HTML, CSS, and vanilla JavaScript.

### Features

- Add and delete tasks
- Mark tasks as complete
- Filter all, active, and completed tasks
- Clear completed tasks
- Persist tasks in `localStorage`
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
docker run --rm -p 8080:80 dactyl-sandbox
```

Then visit <http://localhost:8080>. TODO data remains browser-local via `localStorage`; the container does not store server-side application state.
