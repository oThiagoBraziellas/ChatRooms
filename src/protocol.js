/** Message and envelope shapes shared by every tab. Pure functions only. */

export const ROOMS = ['general', 'random', 'help'];
export const MAX_TEXT = 500;
export const MAX_NAME = 20;
export const ENVELOPE_TYPES = ['message', 'presence', 'typing', 'leave'];

let seq = 0;
export function createId(now = Date.now()) {
  seq += 1;
  return `${now.toString(36)}-${seq.toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function sanitizeText(text) {
  return String(text ?? '').replace(/\r\n?/g, '\n').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim().slice(0, MAX_TEXT);
}

export function sanitizeName(name) {
  return String(name ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_NAME);
}

export function createMessage({ room, author, text, id = createId(), ts = Date.now() }) {
  const clean = sanitizeText(text);
  const who = sanitizeName(author);
  if (!clean || !who || !ROOMS.includes(room)) return null;
  return { id, room, author: who, text: clean, ts };
}

export function isValidMessage(m) {
  return (
    m !== null && typeof m === 'object' &&
    typeof m.id === 'string' && m.id.length > 0 &&
    ROOMS.includes(m.room) &&
    typeof m.author === 'string' && m.author.length > 0 &&
    typeof m.text === 'string' && m.text.length > 0 &&
    Number.isFinite(m.ts)
  );
}

export function createEnvelope(type, tabId, payload = {}) {
  return { v: 1, type, tabId, payload };
}

/** Validates data received from the channel; returns null for anything unexpected. */
export function parseEnvelope(data) {
  if (!data || typeof data !== 'object' || data.v !== 1) return null;
  if (!ENVELOPE_TYPES.includes(data.type) || typeof data.tabId !== 'string') return null;
  const payload = data.payload;
  if (!payload || typeof payload !== 'object') return null;
  if (data.type === 'message') return isValidMessage(payload) ? data : null;
  if (data.type === 'presence' || data.type === 'typing') {
    return typeof payload.name === 'string' && ROOMS.includes(payload.room) ? data : null;
  }
  return data;
}

export function formatTime(ts, locale = 'en-GB', timeZone) {
  return new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', timeZone }).format(new Date(ts));
}

/** Stable hue from a name so each person keeps the same color. */
export function colorFor(name) {
  let hash = 0;
  for (const ch of String(name)) hash = (hash * 31 + ch.codePointAt(0)) >>> 0;
  return hash % 360;
}
