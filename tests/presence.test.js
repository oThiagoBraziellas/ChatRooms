import { test } from 'node:test';
import assert from 'node:assert/strict';
import { touch, remove, prune, usersInRoom, onlineCount, activeTypers, describeTypers } from '../src/presence.js';

test('touch registers and refreshes a tab', () => {
  let s = touch({}, { tabId: 't1', name: 'Ada', room: 'general' }, 100);
  s = touch(s, { tabId: 't1', name: 'Ada', room: 'help' }, 200);
  assert.deepEqual(s.t1, { tabId: 't1', name: 'Ada', room: 'help', lastSeen: 200 });
});

test('prune drops stale tabs and keeps the same reference when nothing changes', () => {
  let s = touch({}, { tabId: 'old', name: 'A', room: 'general' }, 0);
  s = touch(s, { tabId: 'new', name: 'B', room: 'general' }, 9000);
  const pruned = prune(s, 10000, 8000);
  assert.deepEqual(Object.keys(pruned), ['new']);
  assert.equal(prune(pruned, 10000, 8000), pruned);
});

test('remove deletes one tab', () => {
  const s = touch({}, { tabId: 't', name: 'A', room: 'general' }, 0);
  assert.deepEqual(remove(s, 't'), {});
  assert.equal(remove(s, 'missing'), s);
});

test('usersInRoom lists unique sorted names', () => {
  let s = {};
  s = touch(s, { tabId: '1', name: 'Zed', room: 'general' }, 0);
  s = touch(s, { tabId: '2', name: 'Ada', room: 'general' }, 0);
  s = touch(s, { tabId: '3', name: 'Ada', room: 'general' }, 0);
  s = touch(s, { tabId: '4', name: 'Bob', room: 'help' }, 0);
  assert.deepEqual(usersInRoom(s, 'general'), ['Ada', 'Zed']);
  assert.deepEqual(usersInRoom(s, 'random'), []);
  assert.equal(onlineCount(s), 3);
});

test('typing indicators expire', () => {
  const typing = { a: { name: 'Ada', at: 1000 }, b: { name: 'Bob', at: 4500 } };
  assert.deepEqual(activeTypers(typing, 5000, 3000), ['Bob']);
  assert.deepEqual(activeTypers(typing, 2000, 3000), ['Ada', 'Bob']);
});

test('describeTypers phrases 0, 1, 2 and many', () => {
  assert.equal(describeTypers([]), '');
  assert.equal(describeTypers(['Ada']), 'Ada is typing…');
  assert.equal(describeTypers(['Ada', 'Bob']), 'Ada and Bob are typing…');
  assert.equal(describeTypers(['a', 'b', 'c']), 'Several people are typing…');
});
