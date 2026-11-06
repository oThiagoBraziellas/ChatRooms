/** Tracks which tabs are online, based on heartbeats. State is a plain object keyed by tab id. */

export const PRESENCE_TTL = 8000;

export function touch(state, { tabId, name, room }, now) {
  return { ...state, [tabId]: { tabId, name, room, lastSeen: now } };
}

export function remove(state, tabId) {
  if (!(tabId in state)) return state;
  const { [tabId]: _gone, ...rest } = state;
  return rest;
}

export function prune(state, now, ttl = PRESENCE_TTL) {
  const entries = Object.entries(state).filter(([, v]) => now - v.lastSeen <= ttl);
  return entries.length === Object.keys(state).length ? state : Object.fromEntries(entries);
}

/** Unique names present in a room (one person may have several tabs). */
export function usersInRoom(state, room) {
  return [...new Set(Object.values(state).filter((p) => p.room === room).map((p) => p.name))].sort((a, b) => a.localeCompare(b));
}

export function onlineCount(state) {
  return new Set(Object.values(state).map((p) => p.name)).size;
}

/** Typing indicators expire quickly: pass entries as { name, at }. */
export function activeTypers(typing, now, ttl = 3000) {
  return Object.values(typing).filter((t) => now - t.at <= ttl).map((t) => t.name).sort();
}

export function describeTypers(names) {
  if (names.length === 0) return '';
  if (names.length === 1) return `${names[0]} is typing…`;
  if (names.length === 2) return `${names[0]} and ${names[1]} are typing…`;
  return 'Several people are typing…';
}
