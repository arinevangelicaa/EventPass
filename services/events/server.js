import { randomUUID } from 'node:crypto';
import { openDatabase } from '../../src/database.js';
import { HttpError, invalid, json, readJson, serve, textField } from '../../src/http.js';

const db = openDatabase('events.sqlite', `
  CREATE TABLE IF NOT EXISTS events (
    event_id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    location TEXT NOT NULL,
    date TEXT NOT NULL,
    capacity INTEGER NOT NULL CHECK (capacity > 0),
    status TEXT NOT NULL CHECK (status IN ('draft', 'open', 'closed')),
    deleted_at TEXT
  ) STRICT
`);
const fields = 'event_id, title, description, location, date, capacity, status';
const listEvents = db.prepare(
  'SELECT ' + fields + ' FROM events WHERE deleted_at IS NULL ORDER BY date, event_id',
);
const getEvent = db.prepare('SELECT ' + fields + ' FROM events WHERE event_id = ? AND deleted_at IS NULL');
const insertEvent = db.prepare(`
  INSERT INTO events (event_id, title, description, location, date, capacity, status)
  VALUES (?, ?, ?, ?, ?, ?, ?)
  RETURNING ${fields}
`);
const updateEvent = db.prepare(`
  UPDATE events SET title = ?, description = ?, location = ?, date = ?, capacity = ?, status = ?
  WHERE event_id = ? AND deleted_at IS NULL
  RETURNING ${fields}
`);
const deleteEvent = db.prepare('UPDATE events SET deleted_at = ? WHERE event_id = ? AND deleted_at IS NULL');

function normalizeDate(value) {
  const format = /^(\d{4}-\d{2}-\d{2})T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;
  const match = typeof value === 'string' ? format.exec(value) : null;
  const timestamp = match ? new Date(value) : new Date(NaN);
  if (!match || !Number.isFinite(timestamp.getTime())) {
    throw invalid('date must be an RFC 3339 timestamp with a timezone.');
  }

  const calendarDay = new Date(match[1] + 'T00:00:00Z');
  if (calendarDay.toISOString().slice(0, 10) !== match[1] || value.slice(11, 13) === '24') {
    throw invalid('date must contain a valid calendar date and time.');
  }
  return timestamp.toISOString();
}

function eventValues(input, defaultStatus) {
  const title = textField(input.title, 'title', 1, 120);
  const description = textField(input.description === undefined ? '' : input.description, 'description', 0, 2000);
  const location = textField(input.location, 'location', 1, 200);
  const date = normalizeDate(input.date);
  const capacity = input.capacity;
  const status = input.status === undefined ? defaultStatus : input.status;

  if (!Number.isSafeInteger(capacity) || capacity < 1) {
    throw invalid('capacity must be a positive integer.');
  }
  if (!['draft', 'open', 'closed'].includes(status)) {
    throw invalid('status must be draft, open, or closed.');
  }
  return [title, description, location, date, capacity, status];
}

function eventNotFound() {
  return new HttpError(404, 'EVENT_NOT_FOUND', 'The event was not found.');
}

async function route(request, response, path) {
  const method = request.method;
  if (path === '/events' && method === 'GET') {
    return json(response, 200, listEvents.all());
  }
  if (path === '/events' && method === 'POST') {
    const values = eventValues(await readJson(request), 'draft');
    const event = insertEvent.get(randomUUID(), ...values);
    response.setHeader('Location', '/events/' + event.event_id);
    return json(response, 201, event);
  }

  const match = /^\/events\/([^/]+)$/.exec(path);
  if (match) {
    const id = match[1];
    if (method === 'GET') {
      const event = getEvent.get(id);
      if (!event) throw eventNotFound();
      return json(response, 200, event);
    }
    if (method === 'PUT') {
      const values = eventValues(await readJson(request));
      const event = updateEvent.get(...values, id);
      if (!event) throw eventNotFound();
      return json(response, 200, event);
    }
    if (method === 'DELETE') {
      const result = deleteEvent.run(new Date().toISOString(), id);
      if (result.changes === 0) throw eventNotFound();
      response.writeHead(204);
      return response.end();
    }
  }
  throw new HttpError(404, 'ROUTE_NOT_FOUND', 'The route was not found.');
}

serve({ name: 'event-service', port: Number(process.env.PORT ?? 3000), db, route });
