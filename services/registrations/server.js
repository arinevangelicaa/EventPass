import { randomUUID } from 'node:crypto';
import { openDatabase } from '../../src/database.js';
import { HttpError, invalid, json, readJson, serve, textField } from '../../src/http.js';

const eventServiceUrl = new URL(process.env.EVENT_SERVICE_URL ?? 'http://127.0.0.1:3000');
const db = openDatabase('registrations.sqlite', `
  CREATE TABLE IF NOT EXISTS registrations (
    registration_id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL,
    participant_name TEXT NOT NULL,
    participant_email TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('registered', 'cancelled')),
    created_at TEXT NOT NULL
  ) STRICT
`);
const listRegistrations = db.prepare('SELECT * FROM registrations ORDER BY created_at, registration_id');
const getRegistration = db.prepare('SELECT * FROM registrations WHERE registration_id = ?');
const insertRegistration = db.prepare(`
  INSERT INTO registrations (registration_id, event_id, participant_name, participant_email, status, created_at)
  VALUES (?, ?, ?, ?, 'registered', ?)
  RETURNING *
`);
const cancelRegistration = db.prepare(
  "UPDATE registrations SET status = 'cancelled' WHERE registration_id = ? RETURNING registration_id",
);

function eventUnavailable() {
  return new HttpError(503, 'EVENT_SERVICE_UNAVAILABLE', 'Event availability could not be verified.');
}

async function verifyEvent(eventId) {
  const url = new URL('/events/' + encodeURIComponent(eventId), eventServiceUrl);
  let result;
  let event;
  try {
    result = await fetch(url, { signal: AbortSignal.timeout(3000), redirect: 'error' });
    if (result.ok) event = await result.json();
    else await result.body?.cancel();
  } catch {
    throw eventUnavailable();
  }
  if (result.status === 404) {
    throw new HttpError(404, 'EVENT_NOT_FOUND', 'The event was not found.');
  }
  if (event?.event_id !== eventId || !['draft', 'open', 'closed'].includes(event.status)) {
    throw eventUnavailable();
  }
  if (event.status !== 'open') {
    throw new HttpError(409, 'EVENT_NOT_OPEN', 'The event is not open for registration.');
  }
}

async function route(request, response, path) {
  if (path === '/registrations' && request.method === 'GET') {
    return json(response, 200, listRegistrations.all());
  }
  if (path === '/registrations' && request.method === 'POST') {
    const body = await readJson(request);
    const eventId = textField(body.event_id, 'event_id', 36, 36);
    if (!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(eventId)) {
      throw invalid('event_id must be a UUID.');
    }
    const name = textField(body.participant_name, 'participant_name', 1, 120);
    const email = textField(body.participant_email, 'participant_email', 3, 254);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw invalid('participant_email must be an email address.');
    }

    await verifyEvent(eventId);
    const registration = insertRegistration.get(randomUUID(), eventId, name, email, new Date().toISOString());
    response.setHeader('Location', '/registrations/' + registration.registration_id);
    return json(response, 201, registration);
  }

  const match = /^\/registrations\/([^/]+)$/.exec(path);
  if (match) {
    const id = match[1];
    if (request.method === 'GET') {
      const registration = getRegistration.get(id);
      if (registration) return json(response, 200, registration);
    }
    if (request.method === 'DELETE') {
      if (cancelRegistration.get(id)) {
        response.writeHead(204);
        return response.end();
      }
    }
    if (['GET', 'DELETE'].includes(request.method)) {
      throw new HttpError(404, 'REGISTRATION_NOT_FOUND', 'The registration was not found.');
    }
  }
  throw new HttpError(404, 'ROUTE_NOT_FOUND', 'The route was not found.');
}

serve({ name: 'registration-service', port: Number(process.env.PORT ?? 3001), db, route });
