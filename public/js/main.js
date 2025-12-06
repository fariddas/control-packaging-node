
// main.js - logic bersama untuk semua halaman

const API_BASE = ''; // same origin

// ===== Helpers auth =====
function getUser() {
  try {
    const raw = localStorage.getItem('cp_user');
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function setUser(u) {
  localStorage.setItem('cp_user', JSON.stringify(u));
}

function clearUser() {
  localStorage.removeItem('cp_user');
}

function ensureLoggedIn() {
  const u = getUser();
  if (!u) {
    window.location.href = '/login.html';
    return null;
  }
  return u;
}

function ensureRole(allowedRoles) {
  const u = ensureLoggedIn();
  if (!u) return null;
  if (!allowedRoles.includes(u.role)) {
    alert('Akses ditolak untuk role: ' + u.role);
    window.location.href = '/index.html';
    return null;
  }
  return u;
}

function renderHeaderUser() {
  const u = getUser();
  const elName = document.querySelector('[data-user-label]');
  const elRole = document.querySelector('[data-role-badge]');
  if (u && elName && elRole) {
    elName.textContent = u.displayName + ' (' + u.role + ')';
    elRole.textContent = 'Login sebagai ' + u.username;
  }
  const logoutBtn = document.querySelector('[data-logout]');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      clearUser();
      window.location.href = '/login.html';
    });
  }
}

// ===== Login page =====
async function initLoginPage() {
  const form = document.getElementById('login-form');
  const alertBox = document.getElementById('login-alert');

  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    alertBox.textContent = '';
    alertBox.className = 'alert';

    const username = form.username.value.trim();
    const password = form.password.value.trim();

    if (!username || !password) {
      alertBox.textContent = 'Username dan password wajib diisi.';
      alertBox.classList.add('alert-error');
      return;
    }

    try {
      const res = await fetch(API_BASE + '/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (!data.ok) {
        alertBox.textContent = data.error || 'Login gagal';
        alertBox.classList.add('alert-error');
        return;
      }
      setUser({
        username: data.username,
        role: data.role,
        displayName: data.displayName,
        token: data.token
      });

      // Admin → dashboard, lainnya → WH/Supplier/Repair sesuai role
      if (data.role === 'Admin') {
        window.location.href = '/index.html';
      } else if (data.role === 'WH') {
        window.location.href = '/wh.html';
      } else if (data.role === 'Supplier') {
        window.location.href = '/supplier.html';
      } else if (data.role === 'Repair') {
        window.location.href = '/repair.html';
      } else {
        window.location.href = '/index.html';
      }
    } catch (err) {
      console.error(err);
      alertBox.textContent = 'Gagal terhubung ke server.';
      alertBox.classList.add('alert-error');
    }
  });
}

// ===== Dashboard =====
async function loadDashboardSummary() {
  const elToday = document.getElementById('total-today');
  const elMonth = document.getElementById('total-month');
  if (!elToday || !elMonth) return;

  try {
    const res = await fetch(API_BASE + '/api/summary/dashboard');
    const data = await res.json();
    if (data.ok) {
      elToday.textContent = data.totalToday;
      elMonth.textContent = data.totalMonth;
    }
  } catch (err) {
    console.error('loadDashboardSummary error', err);
  }
}

function initDashboardPage() {
  const u = ensureRole(['Admin']);
  if (!u) return;
  renderHeaderUser();
  loadDashboardSummary();
  // Auto refresh setiap 3 detik
  setInterval(loadDashboardSummary, 1000);
}

// ===== Scan page helper =====
function initScanPage(options) {
  const { station, allowedRoles } = options;
  const u = ensureRole(allowedRoles);
  if (!u) return;
  renderHeaderUser();

  const form = document.getElementById('scan-form');
  const statusEl = document.getElementById('scan-status');
  const historyForm = document.getElementById('history-form');
  const historyBody = document.getElementById('history-body');

  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    statusEl.textContent = '';

    const packagingId = form.packagingId.value.trim();
    const partNo = form.partNo.value.trim();
    const action = form.action.value;
    const supplier = form.supplier ? form.supplier.value : '';
    const remarks = form.remarks.value.trim();

    if (!packagingId) {
      alert('Packaging ID wajib diisi');
      return;
    }

    try {
      const res = await fetch(API_BASE + '/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          station,
          packagingId,
          partNo,
          action,
          supplier,
          remarks,
          username: u.username
        })
      });
      const data = await res.json();
      if (!data.ok) {
        alert(data.error || 'Gagal simpan scan');
        return;
      }
      statusEl.textContent = 'Scan OK, status: ' + data.record.status;
      // kosongkan hanya remarks
      form.remarks.value = '';
    } catch (err) {
      console.error(err);
      alert('Error koneksi ke server');
    }
  });

  if (historyForm && historyBody) {
    historyForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      historyBody.innerHTML = '';

      const packagingId = historyForm.packagingId.value.trim();
      const from = historyForm.from.value.trim();
      const to = historyForm.to.value.trim();
      if (!packagingId) {
        alert('Packaging ID wajib diisi');
        return;
      }

      const params = new URLSearchParams({ packagingId });
      if (from) params.append('from', from);
      if (to) params.append('to', to);

      try {
        const res = await fetch(API_BASE + '/api/history?' + params.toString());
        const data = await res.json();
        if (!data.ok) {
          alert(data.error || 'Gagal load history');
          return;
        }

        historyForm.info.textContent = 'Ditemukan ' + data.count + ' baris.';
        data.results.forEach(r => {
          const tr = document.createElement('tr');
          const dt = new Date(r.timestamp);
          const fmt = dt.toLocaleDateString('id-ID') + ' ' + dt.toLocaleTimeString('id-ID', { hour12: false });
          tr.innerHTML = `
            <td>${fmt}</td>
            <td>${r.station}</td>
            <td>${r.action || ''}</td>
            <td>${r.supplier || ''}</td>
            <td>${r.partNo || ''}</td>
            <td>${r.packagingId}</td>
            <td>${r.status || ''}</td>
          `;
          historyBody.appendChild(tr);
        });
      } catch (err) {
        console.error(err);
        alert('Error koneksi ke server saat load history');
      }
    });
  }
}

// ===== Routing by page =====
document.addEventListener('DOMContentLoaded', () => {
  const page = document.body.dataset.page;

  if (page === 'login') {
    initLoginPage();
  } else if (page === 'dashboard') {
    initDashboardPage();
  } else if (page === 'wh') {
    initScanPage({ station: 'WH', allowedRoles: ['Admin', 'WH'] });
  } else if (page === 'supplier') {
    initScanPage({ station: 'Supplier', allowedRoles: ['Admin', 'Supplier'] });
  } else if (page === 'repair') {
    initScanPage({ station: 'Repair', allowedRoles: ['Admin', 'Repair'] });
  }
});
