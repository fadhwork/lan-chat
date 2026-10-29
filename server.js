const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { WebSocketServer } = require('ws');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const MAX_FILE_MB = 50;
// When packaged as .exe, keep data next to the exe (not inside it)
const BASE_DIR = process.pkg ? path.dirname(process.execPath) : __dirname;
const HISTORY_FILE = path.join(BASE_DIR, 'history.jsonl');
const UPLOAD_DIR = path.join(BASE_DIR, 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// Optional config.json next to the app/exe, e.g. { "adminPassword": "secret", "localhostAdmin": true }
let config = {};
try { config = JSON.parse(fs.readFileSync(path.join(BASE_DIR, 'config.json'), 'utf8')); } catch {}
const ADMIN_PASSWORD = String(config.adminPassword || '');
const LOCAL_ADMIN = config.localhostAdmin !== false; // the PC running the server is admin by default
// True when the connection comes from the PC that runs the server (localhost OR this PC's own LAN IP)
function isLocalConnection(addr) {
  const ip = String(addr || '').replace(/^::ffff:/, '');
  if (ip === '127.0.0.1' || ip === '::1') return true;
  for (const list of Object.values(require('os').networkInterfaces())) {
    for (const i of list) if (i.address === ip) return true;
  }
  return false;
}
const sha = (x) => crypto.createHash('sha256').update(String(x)).digest();

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// --- File upload ---
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

// --- History ---
function loadHistory(limit = 200) {
  if (!fs.existsSync(HISTORY_FILE)) return [];
  const lines = fs.readFileSync(HISTORY_FILE, 'utf8').split('\n').filter(Boolean);
  return lines.slice(-limit).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
}
function saveMessage(msg) {
  fs.appendFile(HISTORY_FILE, JSON.stringify(msg) + '\n', () => {});
}

// --- WebSocket ---
const clients = new Map(); // ws -> username

function broadcast(obj) {
  const data = JSON.stringify(obj);
  for (const ws of clients.keys()) if (ws.readyState === 1) ws.send(data);
}
function cleanName(n) {
  n = String(n || '').trim().slice(0, 30) || 'Anonymous';
  return n.toLowerCase() === 'system' ? n + '_' : n; // nobody can pose as the System notices
}
function sendRole(ws) {
  ws.send(JSON.stringify({ type: 'role', admin: !!ws.isAdmin, canLogin: !!ADMIN_PASSWORD }));
}
function broadcastUsers() {
  broadcast({ type: 'users', users: [...new Set(clients.values())].sort() });
}

wss.on('connection', (ws, req) => {
  ws.isAdmin = LOCAL_ADMIN && isLocalConnection(req.socket.remoteAddress);
  ws.failedLogins = 0;
  ws.on('message', (raw) => {
    let m;
    try { m = JSON.parse(raw); } catch { return; }

    if (m.type === 'join') {
      clients.set(ws, cleanName(m.name));
      ws.send(JSON.stringify({ type: 'history', messages: loadHistory() }));
      sendRole(ws);
      broadcastUsers();
      return;
    }

    const user = clients.get(ws);
    if (!user) return;

    if (m.type === 'chat') {
      const text = String(m.text || '').slice(0, 4000);
      if (!text.trim()) return;
      const msg = { type: 'chat', user, text, time: Date.now() };
      saveMessage(msg);
      broadcast(msg);
    } else if (m.type === 'file') {
      const f = m.file || {};
      if (typeof f.url !== 'string' || !f.url.startsWith('/files/')) return;
      const msg = {
        type: 'file', user, time: Date.now(),
        file: { url: f.url, name: String(f.name || '').slice(0, 200), size: Number(f.size) || 0, isImage: !!f.isImage },
      };
      saveMessage(msg);
      broadcast(msg);
    } else if (m.type === 'adminLogin') {
      if (!ADMIN_PASSWORD) return;
      if (crypto.timingSafeEqual(sha(m.password), sha(ADMIN_PASSWORD))) {
        ws.isAdmin = true;
        sendRole(ws);
      } else {
        ws.send(JSON.stringify({ type: 'error', message: 'Wrong admin password' }));
        if (++ws.failedLogins >= 5) ws.close();
      }
    } else if (m.type === 'rename') {
      if (!ws.isAdmin) return;
      const target = String(m.target || '');
      const newName = cleanName(m.newName);
      const targets = [...clients].filter(([, n]) => n === target).map(([c]) => c);
      if (!targets.length || newName === target) return;
      if ([...clients.values()].includes(newName)) {
        ws.send(JSON.stringify({ type: 'error', message: 'That name is already in use' }));
        return;
      }
      for (const c of targets) {
        clients.set(c, newName);
        if (c.readyState === 1) c.send(JSON.stringify({ type: 'renamed', name: newName }));
      }
      broadcastUsers();
      broadcast({ type: 'chat', user: 'System', text: `Admin renamed ${target} to ${newName}`, time: Date.now() });
    } else if (m.type === 'typing') {
      for (const [c, n] of clients) if (c !== ws && c.readyState === 1) c.send(JSON.stringify({ type: 'typing', user }));
    }
  });

  ws.on('close', () => { clients.delete(ws); broadcastUsers(); });
});

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
  console.log(' (Keep this window open. Close it to stop the chat.)');
  console.log('==============================');
});
