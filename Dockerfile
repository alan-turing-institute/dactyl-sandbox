FROM node:24-alpine

WORKDIR /app
ENV NODE_ENV=production \
    PORT=8080 \
    DATABASE_PATH=/data/todos.sqlite

COPY package*.json ./
RUN npm ci --omit=dev

COPY index.html styles.css app.js server.js ./
RUN mkdir -p /data && chown -R node:node /app /data

USER node
EXPOSE 8080
CMD ["node", "server.js"]
