import { createServer } from 'node:http';

const maximumBodyBytes = 64 * 1024;

export class HttpError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function invalid(message) {
  return new HttpError(400, 'VALIDATION_ERROR', message);
}

export async function readJson(request) {
  const mediaType = request.headers['content-type']?.split(';', 1)[0].trim().toLowerCase();
  if (mediaType !== 'application/json') {
    throw new HttpError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Send a JSON request body.');
  }

  const chunks = [];
  let size = 0;
  for await (const chunk of request.iterator({ destroyOnReturn: false })) {
    size += chunk.length;
    if (size > maximumBodyBytes) {
      request.resume();
      throw new HttpError(413, 'PAYLOAD_TOO_LARGE', 'The request body exceeds 64 KiB.');
    }
    chunks.push(chunk);
  }

  let body;
  try {
    body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw invalid('The request body contains invalid JSON.');
  }
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw invalid('The request body must be a JSON object.');
  }
  return body;
}

export function textField(value, name, minimum, maximum) {
  if (typeof value !== 'string') {
    throw invalid(name + ' must be a string.');
  }
  const trimmed = value.trim();
  if (trimmed.length < minimum || trimmed.length > maximum) {
    throw invalid(name + ' must contain ' + minimum + '–' + maximum + ' characters.');
  }
  return trimmed;
}

export function json(response, status, body) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(body));
}

export function serve({ name, port, db, route }) {
  const host = process.env.HOST ?? '127.0.0.1';
  const server = createServer(async (request, response) => {
    try {
      const path = new URL(request.url, 'http://localhost').pathname;
      if (request.method === 'GET' && path === '/health') {
        try {
          db.prepare('SELECT 1').get();
          return json(response, 200, { service: name, status: 'ok' });
        } catch {
          throw new HttpError(503, 'DATABASE_UNAVAILABLE', 'The database is unavailable.');
        }
      }
      return await route(request, response, path);
    } catch (error) {
      if (error instanceof HttpError) {
        return json(response, error.status, { error: { code: error.code, message: error.message } });
      }
      console.error(error);
      return json(response, 500, { error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' } });
    }
  });

  server.listen(port, host, () => {
    const address = server.address();
    console.log(name + ' listening on http://' + host + ':' + address.port);
  });
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.once(signal, () => {
      server.close(() => db.close());
    });
  }
}
