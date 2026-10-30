const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 3000;
const MAX_FILE_MB = 50;

// When packaged as .exe, keep data next to the exe (not inside it)
const BASE_DIR = process.pkg ? path.dirname(process.execPath) : __dirname;
const HISTORY_FILE = path.join(BASE_DIR, 'history.jsonl');
const SEEN_FILE = path.join(BASE_DIR, 'seen.json');
const UPLOAD_DIR = path.join(BASE_DIR, 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// Optional config.json next to the app/exe. All keys are optional:
// { "adminPassword": "secret", "localhostAdmin": true,
//   "selfDestruct": true, "secondsPerMessage": 15, "maxUnreadHours": 24 }
// (secondsPerMessage is only the starting value: the admin can change it in Settings and the server remembers it.)
let config = {};
try { config = JSON.parse(fs.readFileSync(path.join(BASE_DIR, 'config.json'), 'utf8')); } catch {}
const ADMIN_PASSWORD = String(config.adminPassword || '');
const LOCAL_ADMIN = config.localhostAdmin !== false;            // the PC running the server is admin by default
const SELF_DESTRUCT = config.selfDestruct !== false;            // messages vanish after being read
const DEFAULT_SECONDS = Number(config.secondsPerMessage) > 0 ? Number(config.secondsPerMessage) : 15;
const MAX_UNREAD_MS = (Number(config.maxUnreadHours) > 0 ? Number(config.maxUnreadHours) : 24) * 3600 * 1000;
const sha = (x) => crypto.createHash('sha256').update(String(x)).digest();

// True when the connection comes from the PC that runs the server (localhost OR this PC's own LAN IP)
function isLocalConnection(addr) {
  const ip = String(addr || '').replace(/^::ffff:/, '');
  if (ip === '127.0.0.1' || ip === '::1') return true;
  for (const list of Object.values(require('os').networkInterfaces())) {
    for (const i of list) if (i.address === ip) return true;
  }
  return false;
}

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// ---------------- File upload ----------------
const storage = multer.diskStorage({
  destination: UPLOAD_DIR,
  filename: (req, file, cb) => {
    const original = Buffer.from(file.originalname, 'latin1').toString('utf8');
    const safe = original.replace(/[^\w.\- ()]/g, '_');
    cb(null, Date.now() + '-' + safe);
  },
});
const upload = multer({ storage, limits: { fileSize: MAX_FILE_MB * 1024 * 1024 } });

app.use(express.static(path.join(__dirname, 'public')));
app.use('/files', express.static(UPLOAD_DIR, {
  setHeaders: (res) => res.setHeader('Content-Disposition', 'inline'),
}));

app.post('/upload', (req, res) => {
  upload.single('file')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'No file' });
    const displayName = req.file.filename.replace(/^\d+-/, '');
    res.json({
      url: '/files/' + encodeURIComponent(req.file.filename),
      name: displayName,
      size: req.file.size,
      isImage: /\.(png|jpe?g|gif|webp)$/i.test(req.file.filename),
    });
  });
});

// ---------------- State ----------------
// messages: [{ id, type: 'chat'|'file', user, time, text | file }]
// state.people[name]     = { first, last }   first/last time this username was online
// state.seen[name][id]   = time (ms) when that person's copy of the message vanishes
// state.lastExpire[name] = the last vanish time handed out to that person (for the 30s x N queue)
let messages = [];
let state = { people: {}, seen: {}, lastExpire: {}, secondsPerMessage: 0 }; // secondsPerMessage: set by the admin (0 = use the default)
const secondsPerMessage = () => (state.secondsPerMessage > 0 ? state.secondsPerMessage : DEFAULT_SECONDS);
const newId = () => Date.now().toString(36) + crypto.randomBytes(4).toString('hex');

(function loadAll() {
  try {
    messages = fs.readFileSync(HISTORY_FILE, 'utf8').split('\n').filter(Boolean)
      .map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
    for (const m of messages) if (!m.id) m.id = newId();
  } catch {}
  try {
    const s = JSON.parse(fs.readFileSync(SEEN_FILE, 'utf8'));
    state = { people: s.people || {}, seen: s.seen || {}, lastExpire: s.lastExpire || {}, secondsPerMessage: Number(s.secondsPerMessage) || 0 };
  } catch {}
})();

let saveTimer;
function persist() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      fs.writeFileSync(HISTORY_FILE, messages.map((m) => JSON.stringify(m)).join('\n') + (messages.length ? '\n' : ''));
      fs.writeFileSync(SEEN_FILE, JSON.stringify(state));
    } catch (e) { console.error('Could not save:', e.message); }
  }, 300);
}

function removeFile(m) {
  if (m.type !== 'file' || !m.file || typeof m.file.url !== 'string') return;
  try {
    const fname = path.basename(decodeURIComponent(m.file.url.replace(/^\/files\//, '')));
    fs.unlink(path.join(UPLOAD_DIR, fname), () => {});
  } catch {}
}

// A person (username) is a recipient of a message if they were known before it was sent
// and were online within the "max unread" window before it.
function isRecipient(name, m) {
  const p = state.people[name];
  return !!p && p.first <= m.time && p.last >= m.time - MAX_UNREAD_MS;
}
function visibleTo(name, m) {
  if (!SELF_DESTRUCT) return true;
  if (!isRecipient(name, m)) return false;
  const exp = (state.seen[name] || {})[m.id];
  return !(exp && exp <= Date.now());
}

// Mark messages as read by `name`: each one vanishes secondsPerMessage() after the previous one
// (3 messages read at once -> gone after 30s, 60s, 90s).
function markSeen(name, ids) {
  const seen = state.seen[name] || (state.seen[name] = {});
  let last = Math.max(state.lastExpire[name] || 0, Date.now());
  let changed = false;
  for (const id of ids) {
    if (seen[id]) continue;
    const m = messages.find((x) => x.id === id);
    if (!m || !isRecipient(name, m)) continue;
    last += secondsPerMessage() * 1000;
    seen[id] = last;
    changed = true;
  }
  if (changed) { state.lastExpire[name] = last; persist(); }
}

function migratePerson(from, to) {
  for (const key of ['people', 'seen', 'lastExpire']) {
    if (state[key][from] !== undefined) { state[key][to] = state[key][from]; delete state[key][from]; }
  }
}

// ---------------- WebSocket ----------------
const clients = new Map(); // ws -> username
const send = (ws, obj) => { if (ws.readyState === 1) ws.send(JSON.stringify(obj)); };
function broadcast(obj) { for (const ws of clients.keys()) send(ws, obj); }

function cleanName(n) {
  return String(n || '').trim().slice(0, 30) || 'Anonymous';
}
function sendRole(ws) {
  send(ws, { type: 'role', admin: !!ws.isAdmin, canLogin: !!ADMIN_PASSWORD, selfDestruct: SELF_DESTRUCT, seconds: secondsPerMessage() });
}
function broadcastUsers() {
  broadcast({ type: 'users', users: [...new Set(clients.values())].sort() });
}

wss.on('connection', (ws, req) => {
  ws.isAdmin = LOCAL_ADMIN && isLocalConnection(req.socket.remoteAddress);
  ws.failedLogins = 0;
  ws.removed = new Set(); // ids already announced as vanished to this connection

  ws.on('message', (raw) => {
    let m;
    try { m = JSON.parse(raw); } catch { return; }

    if (m.type === 'join') {
      const name = cleanName(m.name);
      const prev = clients.get(ws);
      if (prev && prev !== name && !state.people[name]) migratePerson(prev, name); // renamed to a brand-new name
      clients.set(ws, name);
      const now = Date.now();
      const p = state.people[name] || (state.people[name] = { first: now, last: now });
      p.last = now;
      persist();
      send(ws, { type: 'history', messages: messages.filter((x) => visibleTo(name, x)).slice(-200) });
      sendRole(ws);
      broadcastUsers();
      return;
    }

    const user = clients.get(ws);
    if (!user) return;

    if (m.type === 'chat') {
      const text = String(m.text || '').slice(0, 4000);
      if (!text.trim()) return;
      const msg = { id: newId(), type: 'chat', user, text, time: Date.now() };
      messages.push(msg);
      markSeen(user, [msg.id]); // the sender has "read" it by writing it
      persist();
      broadcast(msg);
    } else if (m.type === 'file') {
      const f = m.file || {};
      if (typeof f.url !== 'string' || !f.url.startsWith('/files/')) return;
      const msg = {
        id: newId(), type: 'file', user, time: Date.now(),
        file: { url: f.url, name: String(f.name || '').slice(0, 200), size: Number(f.size) || 0, isImage: !!f.isImage },
      };
      messages.push(msg);
      markSeen(user, [msg.id]);
      persist();
      broadcast(msg);
    } else if (m.type === 'seen') {
      if (!SELF_DESTRUCT || !Array.isArray(m.ids)) return;
      markSeen(user, m.ids.slice(0, 500).map(String));
    } else if (m.type === 'adminLogin') {
      if (!ADMIN_PASSWORD) return;
      if (crypto.timingSafeEqual(sha(m.password), sha(ADMIN_PASSWORD))) {
        ws.isAdmin = true;
        sendRole(ws);
      } else {
        send(ws, { type: 'error', message: 'Wrong admin password' });
        if (++ws.failedLogins >= 5) ws.close();
      }
    } else if (m.type === 'rename') {
      if (!ws.isAdmin) return;
      const target = String(m.target || '');
      const newName = cleanName(m.newName);
      const targets = [...clients].filter(([, n]) => n === target).map(([c]) => c);
      if (!targets.length || newName === target) return;
      if (state.people[newName] || [...clients.values()].includes(newName)) {
        send(ws, { type: 'error', message: 'That name is already used by someone' });
        return;
      }
      migratePerson(target, newName);
      for (const c of targets) { clients.set(c, newName); send(c, { type: 'renamed', name: newName }); }
      persist();
      broadcastUsers();
    } else if (m.type === 'setDuration') {
      if (!ws.isAdmin) return;
      const sec = Math.round(Number(m.seconds));
      if (!(sec >= 1 && sec <= 3600)) { send(ws, { type: 'error', message: 'Durasi harus antara 1 dan 3600 detik' }); return; }
      state.secondsPerMessage = sec; // applies to messages read from now on
      persist();
      for (const c of clients.keys()) sendRole(c); // tells every screen the new number
    } else if (m.type === 'clearAll') {
      if (!ws.isAdmin) return;
      messages = [];
      state.seen = {};
      state.lastExpire = {};
      try { for (const f of fs.readdirSync(UPLOAD_DIR)) fs.unlink(path.join(UPLOAD_DIR, f), () => {}); } catch {}
      persist();
      broadcast({ type: 'cleared' });
    } else if (m.type === 'typing') {
      for (const [c, n] of clients) if (c !== ws) send(c, { type: 'typing', user });
    }
  });

  ws.on('close', () => {
    const n = clients.get(ws);
    if (n && state.people[n]) state.people[n].last = Date.now();
    clients.delete(ws);
    broadcastUsers();
    persist();
  });
});

// ---------------- Housekeeping (every second) ----------------
function hardDelete() {
  const now = Date.now();
  const kept = [], gone = [], announce = [];
  for (const m of messages) {
    const tooOld = now - m.time > MAX_UNREAD_MS;
    const people = Object.keys(state.people).filter((n) => isRecipient(n, m));
    const everyoneDone = people.length > 0 && people.every((n) => {
      const exp = (state.seen[n] || {})[m.id];
      return exp && exp <= now;
    });
    if (tooOld || everyoneDone) {
      removeFile(m); gone.push(m.id);
      if (!everyoneDone) announce.push(m.id); // expired unread: screens that still show it must drop it
    } else kept.push(m);
  }
  if (!gone.length) return;
  messages = kept;
  const alive = new Set(kept.map((m) => m.id));
  for (const n of Object.keys(state.seen)) {
    for (const id of Object.keys(state.seen[n])) if (!alive.has(id)) delete state.seen[n][id];
  }
  if (announce.length) broadcast({ type: 'remove', ids: announce });
  persist();
}
function cleanOrphanUploads() {
  const used = new Set(messages.filter((m) => m.type === 'file').map((m) => {
    try { return path.basename(decodeURIComponent(m.file.url.replace(/^\/files\//, ''))); } catch { return ''; }
  }));
  try {
    for (const f of fs.readdirSync(UPLOAD_DIR)) {
      const full = path.join(UPLOAD_DIR, f);
      if (!used.has(f) && Date.now() - fs.statSync(full).mtimeMs > 3600 * 1000) fs.unlink(full, () => {});
    }
  } catch {}
}

let tick = 0;
setInterval(() => {
  tick++;
  const now = Date.now();
  for (const [ws, name] of clients) {
    if (state.people[name]) state.people[name].last = now;
    if (!SELF_DESTRUCT) continue;
    const seen = state.seen[name];
    if (!seen) continue;
    const gone = [];
    for (const [id, exp] of Object.entries(seen)) {
      if (exp <= now && !ws.removed.has(id)) { gone.push(id); ws.removed.add(id); }
    }
    if (gone.length) send(ws, { type: 'remove', ids: gone }); // vanish from this person's screen
  }
  if (SELF_DESTRUCT && tick % 5 === 0) hardDelete();           // delete from the server
  if (!SELF_DESTRUCT && messages.length > 5000) { messages = messages.slice(-5000); persist(); }
  if (tick % 600 === 0) cleanOrphanUploads();
}, 1000);

server.listen(PORT, '0.0.0.0', () => {
  const os = require('os');
  console.log('==============================');
  console.log(' LAN Chat is running');
  console.log(' Share one of these links:');
  for (const list of Object.values(os.networkInterfaces())) {
    for (const i of list) {
      if (i.family === 'IPv4' && !i.internal) console.log(`   http://${i.address}:${PORT}`);
    }
  }
  console.log(SELF_DESTRUCT
    ? ` Self-destruct ON: ${secondsPerMessage()}s per message after reading, unread kept max ${MAX_UNREAD_MS / 3600000}h`
    : ' Self-destruct OFF');
  console.log(' (Keep this window open. Close it to stop the chat.)');
  console.log('==============================');
});
