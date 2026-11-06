import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBus } from '../src/bus.js';

/** In-memory BroadcastChannel: delivers to every other instance with the same name, never to the sender. */
function makeFakeChannel() {
  const registry = new Map();
  return class FakeChannel {
    constructor(name) {
      this.name = name;
      this.onmessage = null;
      if (!registry.has(name)) registry.set(name, new Set());
      registry.get(name).add(this);
    }
    postMessage(data) {
      for (const peer of registry.get(this.name)) {
        if (peer !== this && peer.onmessage) peer.onmessage({ data: structuredClone(data) });
      }
    }
    close() { registry.get(this.name).delete(this); }
  };
}
const message = { id: 'm1', room: 'general', author: 'Ada', text: 'hello', ts: 1 };

test('messages sent by one bus reach the others, not the sender', () => {
  const Ctor = makeFakeChannel();
  const a = createBus({ tabId: 'A', ChannelCtor: Ctor });
  const b = createBus({ tabId: 'B', ChannelCtor: Ctor });
  const gotA = [];
  const gotB = [];
  a.subscribe((e) => gotA.push(e));
  b.subscribe((e) => gotB.push(e));
  a.send('message', message);
  assert.equal(gotA.length, 0);
  assert.equal(gotB.length, 1);
  assert.equal(gotB[0].payload.text, 'hello');
  assert.equal(gotB[0].tabId, 'A');
});

test('same-tab echoes are dropped by tab id', () => {
  const Ctor = makeFakeChannel();
  const first = createBus({ tabId: 'same', ChannelCtor: Ctor });
  const second = createBus({ tabId: 'same', ChannelCtor: Ctor });
  const got = [];
  second.subscribe((e) => got.push(e));
  first.send('message', message);
  assert.equal(got.length, 0);
});

test('invalid payloads are ignored', () => {
  const Ctor = makeFakeChannel();
  const raw = new Ctor('chatrooms-v1');
  const b = createBus({ tabId: 'B', ChannelCtor: Ctor });
  const got = [];
  b.subscribe((e) => got.push(e));
  raw.postMessage({ v: 1, type: 'message', tabId: 'X', payload: { text: 'no id' } });
  raw.postMessage('garbage');
  assert.equal(got.length, 0);
});

test('unsubscribe and close stop delivery', () => {
  const Ctor = makeFakeChannel();
  const a = createBus({ tabId: 'A', ChannelCtor: Ctor });
  const b = createBus({ tabId: 'B', ChannelCtor: Ctor });
  const got = [];
  const off = b.subscribe((e) => got.push(e));
  a.send('message', message);
  off();
  a.send('message', { ...message, id: 'm2' });
  assert.equal(got.length, 1);
  b.close();
  assert.doesNotThrow(() => a.send('message', { ...message, id: 'm3' }));
});

test('without BroadcastChannel the bus degrades to a no-op', () => {
  const bus = createBus({ tabId: 'A', ChannelCtor: null });
  assert.equal(bus.supported, false);
  assert.doesNotThrow(() => { bus.send('message', message); bus.subscribe(() => {})(); bus.close(); });
});

test('works with the real BroadcastChannel when available', async (t) => {
  if (typeof BroadcastChannel !== 'function') return t.skip('BroadcastChannel not available');
  const a = createBus({ tabId: 'A', channelName: 'chat-test-real' });
  const b = createBus({ tabId: 'B', channelName: 'chat-test-real' });
  try {
    const received = new Promise((resolve) => b.subscribe(resolve));
    a.send('message', message);
    const env = await Promise.race([received, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 2000))]);
    assert.equal(env.payload.id, 'm1');
  } finally {
    a.close();
    b.close();
  }
});
