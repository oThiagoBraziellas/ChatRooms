export const HISTORY_PREFIX = 'chat.history.';
export const DEFAULT_LIMIT = 200;

import { isValidMessage } from './protocol.js';

/** Per-room message history persisted in a Storage-like object. */
export function createHistoryStore(storage, { limit = DEFAULT_LIMIT, prefix = HISTORY_PREFIX } = {}) {
  const key = (room) => `${prefix}${room}`;

  function load(room) {
    try {
      const raw = storage.getItem(key(room));
      const data = raw ? JSON.parse(raw) : [];
      return Array.isArray(data) ? data.filter(isValidMessage) : [];
    } catch {
      return [];
    }
  }

  function save(room, messages) {
    try {
      storage.setItem(key(room), JSON.stringify(messages));
      return true;
    } catch {
      return false;
    }
  }

  /** Appends keeping chronological order, ignoring duplicates and trimming to `limit`. */
  function append(room, message) {
    const messages = load(room);
    if (messages.some((m) => m.id === message.id)) return messages;
    messages.push(message);
    messages.sort((a, b) => a.ts - b.ts);
    const trimmed = messages.length > limit ? messages.slice(messages.length - limit) : messages;
    save(room, trimmed);
    return trimmed;
  }

  function clear(room) {
    try { storage.removeItem(key(room)); } catch { /* ignore */ }
  }

  return { load, append, clear };
}
