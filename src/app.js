import { ROOMS, createMessage, createId, sanitizeName, formatTime, colorFor } from './protocol.js';
import { createHistoryStore } from './history.js';
import { createBus } from './bus.js';
import { touch, remove, prune, usersInRoom, onlineCount, activeTypers, describeTypers } from './presence.js';

const $ = (s) => document.querySelector(s);
const els = {
  login: $('#login'), loginForm: $('#login-form'), nameInput: $('#name'),
  app: $('#app'), rooms: $('#rooms'), title: $('#room-title'), users: $('#users'),
  log: $('#log'), form: $('#form'), input: $('#text'), typing: $('#typing'), online: $('#online'),
  warn: $('#warn'), me: $('#me'),
};

const tabId = createId();
const history = createHistoryStore(window.localStorage);
const bus = createBus({ tabId });
let me = '';
let room = ROOMS[0];
let presence = {};
let typing = {};
let unread = {};
let lastTypingSent = 0;

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

function messageNode(m) {
  const li = el('li', 'msg' + (m.author === me ? ' mine' : ''));
  const head = el('div', 'meta');
  const who = el('span', 'who', m.author);
  who.style.color = `hsl(${colorFor(m.author)} 70% 70%)`;
  head.append(who, el('time', 'time', formatTime(m.ts)));
  // textContent only: message text is never interpreted as HTML.
  li.append(head, el('div', 'body', m.text));
  return li;
}

function renderLog() {
  els.log.replaceChildren(...history.load(room).map(messageNode));
  els.log.scrollTop = els.log.scrollHeight;
}

function appendLive(m) {
  const stick = els.log.scrollHeight - els.log.scrollTop - els.log.clientHeight < 60;
  els.log.append(messageNode(m));
  if (stick || m.author === me) els.log.scrollTop = els.log.scrollHeight;
}

function renderRooms() {
  els.rooms.replaceChildren(...ROOMS.map((r) => {
    const b = el('button', 'room' + (r === room ? ' on' : ''));
    b.type = 'button';
    b.append(el('span', '', `# ${r}`));
    if (unread[r]) b.append(el('span', 'badge', String(unread[r])));
    b.setAttribute('aria-current', String(r === room));
    b.addEventListener('click', () => switchRoom(r));
    return b;
  }));
}

function renderSide() {
  const names = usersInRoom(presence, room);
  els.users.replaceChildren(...names.map((n) => {
    const li = el('li', '', n + (n === me ? ' (you)' : ''));
    li.style.setProperty('--dot', `hsl(${colorFor(n)} 70% 60%)`);
    return li;
  }));
  els.online.textContent = `${onlineCount(presence)} online`;
}

function renderTyping() {
  const names = activeTypers(Object.fromEntries(Object.entries(typing).filter(([k]) => k.startsWith(`${room}:`))), Date.now()).filter((n) => n !== me);
  els.typing.textContent = describeTypers(names);
}

function switchRoom(next) {
  room = next;
  unread[room] = 0;
  els.title.textContent = `# ${room}`;
  renderRooms();
  renderLog();
  renderSide();
  renderTyping();
  heartbeat();
  els.input.focus();
}

function heartbeat() {
  presence = touch(presence, { tabId, name: me, room }, Date.now());
  bus.send('presence', { name: me, room });
  renderSide();
}

bus.subscribe((env) => {
  const now = Date.now();
  switch (env.type) {
    case 'message': {
      const m = env.payload;
      if (m.room === room) appendLive(m);
      else { unread[m.room] = (unread[m.room] ?? 0) + 1; renderRooms(); }
      delete typing[`${m.room}:${env.tabId}`];
      break;
    }
    case 'presence': {
      const fresh = !presence[env.tabId];
      presence = touch(presence, { tabId: env.tabId, name: env.payload.name, room: env.payload.room }, now);
      if (fresh) bus.send('presence', { name: me, room }); // reply so newcomers learn about us
      renderSide();
      break;
    }
    case 'typing':
      typing[`${env.payload.room}:${env.tabId}`] = { name: env.payload.name, at: now };
      renderTyping();
      break;
    case 'leave':
      presence = remove(presence, env.tabId);
      renderSide();
      break;
    default:
  }
});

els.form.addEventListener('submit', (e) => {
  e.preventDefault();
  const message = createMessage({ room, author: me, text: els.input.value });
  if (!message) return;
  els.input.value = '';
  history.append(room, message);
  bus.send('message', message);
  appendLive(message);
});
els.input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); els.form.requestSubmit(); }
});
els.input.addEventListener('input', () => {
  const now = Date.now();
  if (now - lastTypingSent > 1500) { lastTypingSent = now; bus.send('typing', { name: me, room }); }
});

els.loginForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const name = sanitizeName(els.nameInput.value);
  if (!name) return;
  me = name;
  sessionStorage.setItem('chat.name', me);
  start();
});

function start() {
  els.login.hidden = true;
  els.app.hidden = false;
  els.me.textContent = me;
  els.warn.hidden = bus.supported;
  switchRoom(room);
  setInterval(() => {
    presence = prune(presence, Date.now());
    heartbeat();
    renderTyping();
  }, 3000);
}

window.addEventListener('pagehide', () => bus.send('leave', {}));

const saved = sessionStorage.getItem('chat.name');
if (saved) { me = saved; start(); } else { els.nameInput.focus(); }
