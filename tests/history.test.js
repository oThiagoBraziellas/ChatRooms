import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHistoryStore } from '../src/history.js';

function memoryStorage(init = {}) {
  const d = { ...init };
  return {
    getItem: (k) => (k in d ? d[k] : null),
    setItem: (k, v) => { d[k] = String(v); },
    removeItem: (k) => { delete d[k]; },
    d,
  };
}
const msg = (id, ts, room = 'general') => ({ id, room, author: 'a', text: `t${id}`, ts });

test('append persists and load returns messages in order', () => {
  const store = createHistoryStore(memoryStorage());
  store.append('general', msg('2', 20));
  store.append('general', msg('1', 10));
  assert.deepEqual(store.load('general').map((m) => m.id), ['1', '2']);
});

test('rooms are isolated', () => {
  const store = createHistoryStore(memoryStorage());
  store.append('general', msg('1', 1));
  store.append('help', msg('2', 2, 'help'));
  assert.equal(store.load('general').length, 1);
  assert.equal(store.load('random').length, 0);
});

test('duplicate ids are ignored', () => {
  const store = createHistoryStore(memoryStorage());
  store.append('general', msg('1', 1));
  store.append('general', msg('1', 1));
  assert.equal(store.load('general').length, 1);
});

test('history is capped, keeping the newest messages', () => {
  const store = createHistoryStore(memoryStorage(), { limit: 5 });
  for (let i = 1; i <= 9; i++) store.append('general', msg(String(i), i));
  assert.deepEqual(store.load('general').map((m) => m.id), ['5', '6', '7', '8', '9']);
});

test('load survives corrupt JSON and drops invalid entries', () => {
  const s = memoryStorage({ 'chat.history.general': '{broken' });
  assert.deepEqual(createHistoryStore(s).load('general'), []);
  const s2 = memoryStorage({ 'chat.history.general': JSON.stringify([msg('1', 1), { nope: true }]) });
  assert.equal(createHistoryStore(s2).load('general').length, 1);
  const s3 = memoryStorage({ 'chat.history.general': '{"a":1}' });
  assert.deepEqual(createHistoryStore(s3).load('general'), []);
});

test('clear removes a room and storage failures do not throw', () => {
  const s = memoryStorage();
  const store = createHistoryStore(s);
  store.append('general', msg('1', 1));
  store.clear('general');
  assert.deepEqual(store.load('general'), []);
  const full = { getItem: () => null, setItem() { throw new Error('quota'); }, removeItem() { throw new Error('x'); } };
  const failing = createHistoryStore(full);
  assert.doesNotThrow(() => failing.append('general', msg('2', 2)));
  assert.doesNotThrow(() => failing.clear('general'));
});
