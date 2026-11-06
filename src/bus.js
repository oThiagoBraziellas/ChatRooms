import { createEnvelope, parseEnvelope } from './protocol.js';

export const CHANNEL_NAME = 'chatrooms-v1';

/**
 * Thin wrapper over BroadcastChannel. Injecting the constructor keeps it testable in Node.
 * Messages are validated on the way in and own-tab echoes are dropped.
 */
export function createBus({ tabId, channelName = CHANNEL_NAME, ChannelCtor = globalThis.BroadcastChannel } = {}) {
  if (typeof ChannelCtor !== 'function') {
    return { supported: false, send() {}, subscribe: () => () => {}, close() {} };
  }
  const channel = new ChannelCtor(channelName);
  const listeners = new Set();

  channel.onmessage = (event) => {
    const envelope = parseEnvelope(event.data);
    if (!envelope || envelope.tabId === tabId) return;
    for (const fn of [...listeners]) fn(envelope);
  };

  return {
    supported: true,
    send(type, payload) {
      channel.postMessage(createEnvelope(type, tabId, payload));
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    close() {
      listeners.clear();
      channel.close();
    },
  };
}
