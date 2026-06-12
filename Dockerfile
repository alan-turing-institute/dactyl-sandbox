FROM node:24-alpine

# AI-assisted coding: GPT-5.5 plus Claude Code CLI investigation command
# `claude -p "In repo alan-turing-institute/dactyl-sandbox, issue #201 reports Docker runtime login failure after #199: ENOENT stat /app/github-import.js. Investigate likely minimal fix and tests. Do not modify files; return concise diagnosis."`

WORKDIR /app
ENV NODE_ENV=production \
    PORT=8080 \
    DATABASE_PATH=/data/todos.sqlite

COPY package*.json ./
RUN npm ci --omit=dev

COPY index.html docs.html styles.css app.js analytics.js calendar-export.js contextual-empty-states.js daily-catch.js due-nudges.js fish-emoji.js first-task-onboarding.js github-import.js premium-hooks.js quick-add-parser.js recurrence.js screen-state.js triage-mode.js server.js ./
RUN mkdir -p /data && chown -R node:node /app /data

USER node
EXPOSE 8080
CMD ["node", "server.js"]
