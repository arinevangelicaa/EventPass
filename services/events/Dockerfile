FROM node:24-bookworm-slim

WORKDIR /app

COPY package.json .
COPY src/ ./src/
COPY services/events/server.js ./services/events/server.js

RUN mkdir -p /app/data && chown node:node /app/data

ENV HOST=0.0.0.0
ENV PORT=3000
ENV DB_PATH=/app/data/events.sqlite

USER node
EXPOSE 3000

CMD ["node", "services/events/server.js"]
