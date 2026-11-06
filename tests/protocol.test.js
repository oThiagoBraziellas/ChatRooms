import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createMessage, isValidMessage, sanitizeText, sanitizeName, createEnvelope, parseEnvelope,
  createId, formatTime, colorFor, MAX_TEXT, MAX_NAME,
} from '../src/protocol.js';

test('sanitizeText trims, normalises line breaks and caps length', () => {
  assert.equal(sanitizeText('  hi   there \r\n'), 'hi there');
  assert.equal(sanitizeText('a\n\n\n\nb'), 'a\n\nb');
  assert.equal(sanitizeText('x'.repeat(MAX_TEXT + 50)).length, MAX_TEXT);
  assert.equal(sanitizeText(undefined), '');
});

test('sanitizeName collapses spaces and caps length', () => {
  assert.equal(sanitizeName('  Ada   Lovelace '), 'Ada Lovelace');
  assert.equal(sanitizeName('n'.repeat(50)).length, MAX_NAME);
});

test('createMessage validates room, author and text', () => {
  const m = createMessage({ room: 'general', author: 'Ada', text: ' hello ', id: 'm1', ts: 10 });
  assert.deepEqual(m, { id: 'm1', room: 'general', author: 'Ada', text: 'hello', ts: 10 });
  assert.equal(createMessage({ room: 'nope', author: 'Ada', text: 'x' }), null);
  assert.equal(createMessage({ room: 'general', author: '', text: 'x' }), null);
  assert.equal(createMessage({ room: 'general', author: 'Ada', text: '   ' }), null);
});

test('createId produces unique ids', () => {
  assert.equal(new Set(Array.from({ length: 500 }, () => createId())).size, 500);
});

test('isValidMessage rejects malformed objects', () => {
  const ok = { id: 'a', room: 'help', author: 'x', text: 'y', ts: 1 };
  assert.equal(isValidMessage(ok), true);
  for (const bad of [null, 'str', {}, { ...ok, ts: 'now' }, { ...ok, room: 'zzz' }, { ...ok, text: '' }, { ...ok, id: '' }]) {
    assert.equal(isValidMessage(bad), false);
  }
});

test('parseEnvelope accepts valid envelopes and rejects hostile input', () => {
  const msg = { id: 'a', room: 'general', author: 'x', text: 'y', ts: 1 };
  const good = createEnvelope('message', 'tab1', msg);
  assert.equal(parseEnvelope(good), good);
  assert.ok(parseEnvelope(createEnvelope('presence', 't', { name: 'x', room: 'help' })));
  assert.ok(parseEnvelope(createEnvelope('leave', 't', {})));
  assert.equal(parseEnvelope(createEnvelope('message', 't', { ...msg, text: 5 })), null);
  assert.equal(parseEnvelope(createEnvelope('presence', 't', { name: 'x', room: 'bad' })), null);
  assert.equal(parseEnvelope({ v: 2, type: 'message', tabId: 't', payload: msg }), null);
  assert.equal(parseEnvelope({ v: 1, type: 'exec', tabId: 't', payload: {} }), null);
  assert.equal(parseEnvelope({ v: 1, type: 'leave', tabId: 5, payload: {} }), null);
  assert.equal(parseEnvelope('hello'), null);
  assert.equal(parseEnvelope(null), null);
});

test('formatTime uses the given timezone', () => {
  assert.equal(formatTime(Date.UTC(2026, 0, 1, 15, 4), 'en-GB', 'UTC'), '15:04');
});

test('colorFor is deterministic and within 0-359', () => {
  assert.equal(colorFor('Ada'), colorFor('Ada'));
  assert.notEqual(colorFor('Ada'), colorFor('Grace'));
  assert.ok(colorFor('anything') >= 0 && colorFor('anything') < 360);
});
