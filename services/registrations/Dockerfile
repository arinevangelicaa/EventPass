FROM node:24-bookworm-slim

WORKDIR /app

COPY package.json .
COPY src/ ./src/
COPY services/registrations/server.js ./services/registrations/server.js

RUN mkdir -p /app/data && chown node:node /app/data

ENV HOST=0.0.0.0
ENV PORT=3001
ENV DB_PATH=/app/data/registrations.sqlite

USER node
EXPOSE 3001

CMD ["node", "services/registrations/server.js"]