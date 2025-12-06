
// server.js - Control Packaging demo (Node.js + Express)
// Penyimpanan data masih pakai file JSON sederhana (data.json)

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// ======== KONFIGURASI ========
const DATA_FILE = path.join(__dirname, 'data.json');

// Demo users (password disimpan SHA256)
const USERS = [
  { username: 'Admin',     role: 'Admin',    displayName: 'Admin',     passwordHash: sha256('123') },
  { username: 'WH1',       role: 'WH',       displayName: 'WH1',       passwordHash: sha256('123') },
  { username: 'SUPPLIER1', role: 'Supplier', displayName: 'SUPPLIER1', passwordHash: sha256('123') },
  { username: 'REPAIR1',   role: 'Repair',   displayName: 'REPAIR1',   passwordHash: sha256('123') },
];

// ======== HELPERS ========
function sha256(str) {
  return crypto.createHash('sha256').update(str).digest('hex');
}

function loadData() {
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    return { scans: [] };
  }
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
}

// ======== MIDDLEWARE ========
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// ======== API ROUTES ========

// Ping
app.get('/api/ping', (req, res) => {
  res.json({ ok: true, msg: 'Control Packaging API (Node.js) alive' });
});

// Login
app.post('/api/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ ok: false, error: 'Username / password kosong' });
  }

  const user = USERS.find(u => u.username.toLowerCase() === String(username).toLowerCase());
  if (!user) {
    return res.status(401).json({ ok: false, error: 'User tidak ditemukan' });
  }

  const hash = sha256(password);
  if (hash !== user.passwordHash) {
    return res.status(401).json({ ok: false, error: 'Password salah' });
  }

  // Demo: token sederhana
  const token = sha256(user.username + Date.now());

  res.json({
    ok: true,
    username: user.username,
    role: user.role,
    displayName: user.displayName,
    token
  });
});

// Scan packaging
app.post('/api/scan', (req, res) => {
  const body = req.body || {};
  const {
    station,
    packagingId,
    action,
    supplier,
    partNo,
    remarks,
    username
  } = body;

  if (!packagingId) {
    return res.status(400).json({ ok: false, error: 'Packaging ID wajib diisi' });
  }

  if (!station) {
    return res.status(400).json({ ok: false, error: 'Station wajib diisi' });
  }

  // Validasi Part No: 11–14 karakter jika diisi
  if (partNo) {
    const len = String(partNo).trim().length;
    if (len < 11 || len > 14) {
      return res.status(400).json({ ok: false, error: 'Part No harus 11–14 karakter jika diisi' });
    }
  }

  const now = new Date();

  const data = loadData();
  const record = {
    id: Date.now(),
    timestamp: now.toISOString(),
    station: station,
    action: action || '',
    supplier: supplier || '',
    partNo: partNo || '',
    packagingId,
    remarks: remarks || '',
    username: username || '',
    status: 'complete'
  };
  data.scans.push(record);
  saveData(data);

  res.json({ ok: true, record });
});

// History by Packaging ID + date range
app.get('/api/history', (req, res) => {
  const { packagingId, from, to } = req.query || {};
  if (!packagingId) {
    return res.status(400).json({ ok: false, error: 'packagingId wajib diisi' });
  }

  const data = loadData();
  let rows = data.scans.filter(r => String(r.packagingId) === String(packagingId));

  let fromTime = from ? Date.parse(from) : null;
  let toTime   = to   ? Date.parse(to)   : null;

  if (fromTime) {
    rows = rows.filter(r => Date.parse(r.timestamp) >= fromTime);
  }
  if (toTime) {
    rows = rows.filter(r => Date.parse(r.timestamp) <= toTime);
  }

  // Sort by time ascending
  rows.sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));

  res.json({
    ok: true,
    packagingId,
    count: rows.length,
    results: rows
  });
});

// Summary dashboard (total scan hari ini & bulan ini)
app.get('/api/summary/dashboard', (req, res) => {
  const data = loadData();
  const now  = new Date();

  const y = now.getFullYear();
  const m = now.getMonth();
  const d = now.getDate();

  const dayStart   = new Date(y, m, d, 0, 0, 0).getTime();
  const dayEnd     = new Date(y, m, d + 1, 0, 0, 0).getTime();
  const monthStart = new Date(y, m, 1, 0, 0, 0).getTime();
  const monthEnd   = new Date(y, m + 1, 1, 0, 0, 0).getTime();

  let totalToday = 0;
  let totalMonth = 0;

  data.scans.forEach(r => {
    const t = Date.parse(r.timestamp);
    if (t >= dayStart && t < dayEnd)   totalToday++;
    if (t >= monthStart && t < monthEnd) totalMonth++;
  });

  res.json({
    ok: true,
    totalToday,
    totalMonth
  });
});

// ======== ROUTING HALAMAN ========

// Login page
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Dashboard (Admin only - dicek di front-end pakai role)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Jalankan server
app.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
});
