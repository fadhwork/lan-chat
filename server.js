const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { WebSocketServer } = require('ws');

const PORT = 3000;
const MAX_FILE_MB = 50;
// When packaged as .exe, keep data next to the exe (not inside it)
const BASE_DIR = process.pkg ? path.dirname(process.execPath) : __dirname;
const HISTORY_FILE = path.join(BASE_DIR, 'history.jsonl');
const UPLOAD_DIR = path.join(BASE_DIR, 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

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
function broadcastUsers() {
  broadcast({ type: 'users', users: [...new Set(clients.values())].sort() });
}

wss.on('connection', (ws) => {
  ws.on('message', (raw) => {
    let m;
    try { m = JSON.parse(raw); } catch { return; }

    if (m.type === 'join') {
      const name = String(m.name || '').trim().slice(0, 30) || 'Anonymous';
      clients.set(ws, name);
      ws.send(JSON.stringify({ type: 'history', messages: loadHistory() }));
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
