/* ═══════════════════════════════════════════════════════
   app.js — Main application controller
   Auth, routing, sidebar, theme, map logic, events
═══════════════════════════════════════════════════════ */
'use strict';

/* ── THEME ───────────────────────────────────────────── */
function applyTheme(dark) {
  State.dark = dark;
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  localStorage.setItem('cc-dark', dark ? '1' : '0');
  const label = dark ? '☀️ Light Mode' : '🌙 Dark Mode';
  const e1 = $('#theme-toggle'), e2 = $('#topbar-theme'), e3 = $('#auth-theme-btn');
  if (e1) e1.textContent = label;
  if (e2) e2.textContent = dark ? '☀️' : '🌙';
  if (e3) e3.textContent = label;
}
function toggleTheme() { applyTheme(!State.dark); }

/* ── BOOT ────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', async () => {
  applyTheme(State.dark);
  wireAuth();
  wireSidebar();
  $('#topbar-theme')?.addEventListener('click', toggleTheme);
  $('#auth-theme-btn')?.addEventListener('click', toggleTheme);
});

/* ── AUTH ────────────────────────────────────────────── */
function wireAuth() {
  let authMode = 'login';

  $$('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      authMode = btn.dataset.tab;
      $$('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      $('#name-wrap').classList.toggle('hidden', authMode !== 'signup');
      $('#auth-btn').textContent = authMode === 'login' ? 'Sign In' : 'Create Account';
      $('#auth-err').classList.add('hidden');
    });
  });

  $('#auth-form').addEventListener('submit', async e => {
    e.preventDefault();
    const email = $('#inp-email').value.trim();
    const pass  = $('#inp-pass').value;
    const name  = $('#inp-name')?.value.trim();
    const errEl = $('#auth-err');
    errEl.classList.add('hidden');

    if (!email || !pass) { showAuthErr('Please fill all fields'); return; }
    if (authMode === 'signup' && !name) { showAuthErr('Please enter your name'); return; }

    const btn = $('#auth-btn');
    btn.textContent = '⏳ Please wait…';
    btn.disabled = true;

    let res;
    try {
      res = authMode === 'login'
        ? await api('POST', '/auth/login', { email, password: pass })
        : await api('POST', '/auth/signup', { name, email, password: pass });
    } catch(err) {
      btn.disabled = false;
      btn.textContent = authMode === 'login' ? 'Sign In' : 'Create Account';
      showAuthErr('Cannot connect to server. Make sure backend is running.');
      return;
    }

    btn.disabled = false;
    btn.textContent = authMode === 'login' ? 'Sign In' : 'Create Account';

    if (!res.success) { showAuthErr(res.message || 'Something went wrong'); return; }
    bootApp(res.user);
  });
}

function showAuthErr(msg) {
  const el = $('#auth-err');
  el.textContent = msg;
  el.classList.remove('hidden');
}

/* ── BOOT APP ────────────────────────────────────────── */
async function bootApp(user) {
  State.currentUser = user;
  $('#auth-screen').classList.add('hidden');
  $('#app').classList.remove('hidden');

  // Load data from backend
  try {
    const [rRes, uRes] = await Promise.all([
      api('GET', '/reports'),
      api('GET', '/users')
    ]);
    if (rRes.success) State.reports = rRes.reports;
    if (uRes.success) State.users   = uRes.users;
  } catch(e) {
    console.error('Failed to load data:', e);
  }

  // Show/hide admin nav
  $$('.admin-only').forEach(el => el.classList.toggle('hidden', user.role !== 'admin'));

  updateSidebarUser();
  updateTopbar();
  goPage('dashboard');
  notify(`Welcome back, ${user.name.split(' ')[0]}! 🌿`);
}

function updateTopbar() {
  const u = State.currentUser; if (!u) return;
  const av = $('#topbar-avatar');
  if (av) av.textContent = u.name[0];
}

function updateSidebarUser() {
  const u = State.currentUser; if (!u) return;
  const n = $('#sb-username'), p = $('#sb-pts');
  if (n) n.textContent = u.name;
  if (p) p.textContent = `⭐ ${u.points} pts · ${u.role}`;
}

/* ── ROUTING ─────────────────────────────────────────── */
async function goPage(page) {
  State.page = page;

  // Destroy old map instances
  if (State.gmap && page !== 'map') {
    State.gmapMarkers.forEach(m => m.setMap(null));
    State.gmapMarkers = [];
    if (State.gmapHeat) { State.gmapHeat.setMap(null); State.gmapHeat = null; }
    State.gmap = null;
  }

  $$('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.page === page));

  const content = $('#page-content');

  // Handle async rewards page
  if (page === 'rewards') {
    content.innerHTML = '<div style="text-align:center;padding:60px;color:var(--text2)">⏳ Loading rewards...</div>';
    content.innerHTML = await renderRewards();
    content.scrollTop = 0;
    wireRewardsPage();
    return;
  }

  const renders = {
    dashboard:   renderDashboard,
    report:      renderReport,
    map:         renderMap,
    leaderboard: renderLeaderboard,
    adopt:       renderAdopt,
    admin:       State.currentUser?.role === 'admin' ? renderAdmin : renderDashboard,
    profile:     renderProfile,
    'ngo-support': renderNGOSupport,
  };

  content.innerHTML = (renders[page] || renderDashboard)();
  content.scrollTop = 0;

  // Post-render wiring
  if (page === 'report') wireReportPage();
  if (page === 'map')    { setTimeout(() => initGoogleMap(), 100); wireMapPage(); }
  if (page === 'admin')  wireAdminPage();
  if (page === 'ngo-support') wireNGOPage();
}
window.goPage = goPage;

/* ── SIDEBAR ─────────────────────────────────────────── */
function wireSidebar() {
  const sb = $('#sidebar'), ov = $('#sb-overlay');
  const open  = () => { sb.classList.add('open');    ov.classList.add('on'); };
  const close = () => { sb.classList.remove('open'); ov.classList.remove('on'); };

  $('#menu-btn').addEventListener('click', open);
  $('#sb-close').addEventListener('click', close);
  ov.addEventListener('click', close);

  $$('.nav-item').forEach(btn => btn.addEventListener('click', () => { goPage(btn.dataset.page); close(); }));

  $('#logout-btn').addEventListener('click', () => {
    State.currentUser = null; State.reports = []; State.users = [];
    close();
    $('#app').classList.add('hidden');
    $('#auth-screen').classList.remove('hidden');
    $('#inp-email').value = ''; $('#inp-pass').value = '';
    notify('Signed out successfully', 'success');
  });

  $('#theme-toggle').addEventListener('click', () => { toggleTheme(); updateSidebarUser(); });
  $('#topbar-avatar')?.addEventListener('click', () => goPage('profile'));
}

/* ── REPORT PAGE WIRING ─────────────────────────────── */
function wireReportPage() {
  // Waste type buttons
  $$('.wt-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.wt-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      State.selWaste = btn.dataset.type;
      updateCO2();
    });
  });

  // Init mini map after a tick
  setTimeout(() => initMiniMap(State.gpsCoords.lat, State.gpsCoords.lng), 150);
}

function initMiniMap(lat, lng) {
  const el = document.getElementById('mini-map');
  if (!el || typeof google === 'undefined') return;
  el.style.height = '160px';
  const pos = { lat, lng };
  const map = new google.maps.Map(el, {
    center: pos, zoom: 14,
    disableDefaultUI: true,
    zoomControl: true,
    styles: State.dark ? GMAP_DARK_STYLE : []
  });
  new google.maps.Marker({ position: pos, map });
  State.miniMap = map;
}

window.handleImgUpload = function(input) {
  const file = input.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    State.imgData = e.target.result;
    const zone = $('#upload-zone');
    zone.innerHTML = `<img src="${e.target.result}" class="preview-img" alt="preview"/><div style="font-size:12px;color:var(--text2);margin-top:6px">Click to change</div>`;
  };
  reader.readAsDataURL(file);
};

/* ── CAMERA CAPTURE ──────────────────────────────────── */
let _camStream = null;
let _camFacing = 'environment'; // rear camera by default
let _camSnapped = null;

window.openCameraCapture = async function() {
  const modal = document.getElementById('camera-modal');
  if (!modal) return;
  modal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  await _startCamera();
};

async function _startCamera() {
  const video  = document.getElementById('camera-video');
  const errEl  = document.getElementById('camera-err');
  const vf     = document.getElementById('camera-viewfinder');
  if (!video) return;

  // Stop any existing stream
  if (_camStream) { _camStream.getTracks().forEach(t => t.stop()); _camStream = null; }

  // Reset to live view
  document.getElementById('camera-snap-preview')?.classList.add('hidden');
  if (vf) vf.style.display = '';
  document.getElementById('camera-live-controls')?.classList.remove('hidden');
  document.getElementById('camera-retake-controls')?.classList.add('hidden');
  if (errEl) errEl.classList.add('hidden');

  try {
    _camStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: _camFacing, width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false
    });
    video.srcObject = _camStream;
  } catch (err) {
    const msg = err.name === 'NotAllowedError'
      ? '⚠️ Camera permission denied. Please allow camera access and try again.'
      : '⚠️ Could not access camera. Try uploading a photo instead.';
    if (errEl) { errEl.textContent = msg; errEl.classList.remove('hidden'); }
    if (vf) vf.style.display = 'none';
    document.getElementById('camera-live-controls')?.classList.add('hidden');
  }
}

window.closeCameraCapture = function() {
  if (_camStream) { _camStream.getTracks().forEach(t => t.stop()); _camStream = null; }
  const modal = document.getElementById('camera-modal');
  if (modal) modal.classList.add('hidden');
  document.body.style.overflow = '';
  _camSnapped = null;
};

window.flipCamera = async function() {
  _camFacing = _camFacing === 'environment' ? 'user' : 'environment';
  await _startCamera();
};

window.snapPhoto = function() {
  const video  = document.getElementById('camera-video');
  const canvas = document.getElementById('camera-canvas');
  if (!video || !canvas) return;

  canvas.width  = video.videoWidth  || 640;
  canvas.height = video.videoHeight || 480;
  const ctx = canvas.getContext('2d');

  // Mirror horizontally if using front camera
  if (_camFacing === 'user') {
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  _camSnapped = canvas.toDataURL('image/jpeg', 0.92);

  // Show preview, hide live feed
  const preview = document.getElementById('camera-snap-preview');
  const previewImg = document.getElementById('camera-preview-img');
  const vf = document.getElementById('camera-viewfinder');
  if (previewImg) previewImg.src = _camSnapped;
  if (preview) preview.classList.remove('hidden');
  if (vf) vf.style.display = 'none';

  // Switch control buttons
  document.getElementById('camera-live-controls')?.classList.add('hidden');
  document.getElementById('camera-retake-controls')?.classList.remove('hidden');

  // Shutter flash effect
  const flash = document.createElement('div');
  flash.className = 'camera-flash';
  document.getElementById('camera-modal')?.appendChild(flash);
  setTimeout(() => flash.remove(), 300);
};

window.retakePhoto = async function() {
  _camSnapped = null;
  await _startCamera();
};

window.usePhoto = function() {
  if (!_camSnapped) return;
  State.imgData = _camSnapped;
  const zone = $('#upload-zone');
  if (zone) {
    zone.innerHTML = `<img src="${_camSnapped}" class="preview-img" alt="preview"/><div style="font-size:12px;color:var(--text2);margin-top:6px">Click to change</div>`;
  }
  closeCameraCapture();
  notify('📷 Photo captured!', 'success');
};



window.handleDescInput = function(val) {
  const aiBox = $('#ai-box'), aiType = $('#ai-type');
  if (val.length > 10) {
    const det = detectWaste(val);
    if (aiType) aiType.textContent = det;
    if (aiBox) aiBox.classList.remove('hidden');
    if (!State.selWaste) {
      State.selWaste = det;
      $$('.wt-btn').forEach(b => b.classList.toggle('active', b.dataset.type === det));
      updateCO2();
    }
  } else {
    if (aiBox) aiBox.classList.add('hidden');
  }
};

function updateCO2() {
  const box = $('#co2-box'), val = $('#co2-val');
  const co2 = CO2_MAP[State.selWaste];
  if (co2 && box && val) { val.textContent = co2; box.classList.remove('hidden'); }
  else if (box) box.classList.add('hidden');
}

window.getGPS = function() {
  const btn = $('#gps-btn');
  if (btn) btn.textContent = '⏳ Detecting…';
  navigator.geolocation?.getCurrentPosition(pos => {
    State.gpsCoords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
    const disp = $('#loc-disp');
    if (disp) disp.textContent = `📍 ${State.gpsCoords.lat.toFixed(5)}, ${State.gpsCoords.lng.toFixed(5)} (GPS)`;
    if (btn) btn.textContent = '✅ Detected';
    initMiniMap(State.gpsCoords.lat, State.gpsCoords.lng);
    notify('GPS location captured!');
  }, () => {
    if (btn) btn.textContent = '📡 Auto-detect';
    notify('Could not get GPS, using default', 'warn');
  });
};

window.submitReport = async function() {
  const desc = $('#desc-inp')?.value.trim();
  const area = $('#area-sel')?.value;
  if (!desc) { notify('Please add a description', 'error'); return; }
  const wt  = State.selWaste || detectWaste(desc);
  const btn = $('#submit-btn');
  if (btn) { btn.textContent = '⏳ Submitting…'; btn.disabled = true; }

  const res = await api('POST', '/reports', {
    userId: State.currentUser.id,
    userName: State.currentUser.name,
    area, wasteType: wt, description: desc,
    lat: State.gpsCoords.lat, lng: State.gpsCoords.lng,
    imageUrl: State.imgData || '',
    co2: CO2_MAP[wt] || 1.2
  });

  if (res.success) {
    State.reports.unshift(res.report);
    State.currentUser.points = res.newPoints;
    updateSidebarUser();
    notify(`✅ Reported! +10 pts · ~${CO2_MAP[wt]||1.2}kg CO₂ prevented!`, 'success');
    if (res.milestoneUnlocked) {
      setTimeout(() => showMilestoneUnlockPopup(res.milestoneUnlocked), 800);
    } else {
      goPage('dashboard');
    }
  } else {
    if (btn) { btn.textContent = '🚀 Submit Report'; btn.disabled = false; }
    notify('Failed to submit', 'error');
  }
};

/* ── MAP PAGE WIRING ─────────────────────────────────── */
let _mapState = { fType:'all', fStatus:'all', heatmap:false };

function wireMapPage() {
  _mapState = { fType:'all', fStatus:'all', heatmap:false };

  setTimeout(() => {
    $('#map-type-sel')?.addEventListener('change', e => { _mapState.fType = e.target.value; refreshGoogleMap(); });
    $('#map-stat-sel')?.addEventListener('change', e => { _mapState.fStatus = e.target.value; refreshGoogleMap(); });
    $('#hm-btn')?.addEventListener('click', () => {
      _mapState.heatmap = !_mapState.heatmap;
      const btn = $('#hm-btn');
      btn.classList.toggle('on', _mapState.heatmap);
      btn.textContent = `🔥 Heatmap ${_mapState.heatmap ? 'ON' : 'OFF'}`;
      refreshGoogleMap();
    });
  }, 50);
}

function initGoogleMap() {
  const el = document.getElementById('google-map-el');
  if (!el) return;

  // If google maps not loaded yet, retry
  if (typeof google === 'undefined' || !google.maps) {
    setTimeout(initGoogleMap, 500);
    return;
  }

  const map = new google.maps.Map(el, {
    center: { lat: 21.1904, lng: 81.2849 },
    zoom: 13,
    mapTypeControl: false,
    streetViewControl: false,
    fullscreenControl: true,
    styles: State.dark ? GMAP_DARK_STYLE : []
  });

  State.gmap    = map;
  State.gmapInfo = new google.maps.InfoWindow();
  refreshGoogleMap();
}

function refreshGoogleMap() {
  const map = State.gmap;
  if (!map) return;

  // Clear old markers
  State.gmapMarkers.forEach(m => m.setMap(null));
  State.gmapMarkers = [];

  // Clear heatmap
  if (State.gmapHeat) { State.gmapHeat.setMap(null); State.gmapHeat = null; }

  const { fType, fStatus, heatmap } = _mapState;
  const filtered = State.reports.filter(r =>
    (fType   === 'all' || r.wasteType === fType) &&
    (fStatus === 'all' || r.status    === fStatus)
  );

  const heatData = [];

  filtered.forEach(r => {
    const pos   = { lat: r.lat, lng: r.lng };
    const color = WASTE_COLORS[r.wasteType] || '#888';

    const svgPin = {
      path: 'M12 0C7.58 0 4 3.58 4 8c0 5.25 8 13 8 13s8-7.75 8-13c0-4.42-3.58-8-8-8zm0 11c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3z',
      fillColor: color, fillOpacity: 1,
      strokeColor: '#fff', strokeWeight: 1.5,
      scale: 1.4,
      anchor: new google.maps.Point(12, 21)
    };

    const marker = new google.maps.Marker({
      position: pos, map,
      icon: svgPin,
      title: `${r.area} – ${r.wasteType}`
    });

    marker.addListener('click', () => {
      const h = (Date.now() - new Date(r.createdAt).getTime()) / 3_600_000;
      const timeStr = r.status === 'Resolved' ? '✅ Resolved' : h >= 72 ? 'Escalated' : `${Math.floor(72-h)}h left`;
      State.gmapInfo.setContent(`
        <div style="font-family:'DM Sans',sans-serif;padding:6px 2px;min-width:200px">
          <strong style="font-size:14px">${r.area} – ${r.wasteType}</strong>
          <div style="font-size:12px;color:#666;margin-top:4px">${r.description}</div>
          <div style="font-size:11px;color:#999;margin-top:4px">By ${r.userName} · ${timeStr}</div>
          <div style="margin-top:6px">${statusBadge(r)}</div>
        </div>`);
      State.gmapInfo.open(map, marker);
    });

    State.gmapMarkers.push(marker);
    heatData.push(new google.maps.LatLng(r.lat, r.lng));
  });

  if (heatmap && heatData.length) {
    State.gmapHeat = new google.maps.visualization.HeatmapLayer({
      data: heatData, map, radius: 50, opacity: 0.65
    });
  }
}

/* ── ADMIN WIRING ────────────────────────────────────── */
function wireAdminPage() {
  let fStatus = 'all', fArea = 'all', fType = 'all';

  function refresh() {
    const tbody = $('#adm-tbody');
    if (tbody) tbody.innerHTML = buildAdminTable(fStatus, fArea, fType);
  }

  setTimeout(() => {
    refresh();
    $('#adm-stat')?.addEventListener('change', e => { fStatus = e.target.value; refresh(); });
    $('#adm-area')?.addEventListener('change', e => { fArea   = e.target.value; refresh(); });
    $('#adm-type')?.addEventListener('change', e => { fType   = e.target.value; refresh(); });
    loadAdminCouponData();
    loadAdminLeaderboard();
  }, 30);
}

async function loadAdminCouponData() {
  try {
    const res = await api('GET', '/admin/coupons');
    const el  = $('#admin-coupon-stats');
    if (!el || !res.success) return;
    const s = res.stats;
    const coupons = res.coupons || [];
    const brandEmoji = b => b === 'Myntra' ? '👗' : b === 'Zara' ? '🛍️' : b === 'Ajio' ? '✨' : '🎯';
    const couponRows = coupons.slice(0,10).map(c => {
      const exp = new Date(c.expiresAt) < new Date();
      const st  = c.used ? '✅ Used' : exp ? '⏰ Exp' : '🟢 Active';
      return '<div class="cpn-list-item" style="margin-bottom:8px">' +
        '<span style="font-size:1.2rem">' + brandEmoji(c.brand) + '</span>' +
        '<div class="cpn-info">' +
          '<div class="cpn-brand">' + c.userName + ' → ' + c.brand + ' ' + c.discount_pct + '% (' + c.tier + ')</div>' +
          '<div class="cpn-code-small">' + c.code + '</div>' +
        '</div>' +
        '<div class="cpn-status">' + st + '</div>' +
      '</div>';
    }).join('');

    el.innerHTML = `
      <div class="adm-coupon-stats">
        <div class="adm-cs-card" style="background:rgba(0,200,150,0.1);border-color:var(--accent)">
          <div class="adm-cs-num">${s.total}</div><div class="adm-cs-lbl">Total Issued</div>
        </div>
        <div class="adm-cs-card" style="background:rgba(34,197,94,0.1);border-color:#22c55e">
          <div class="adm-cs-num">${s.active}</div><div class="adm-cs-lbl">Active</div>
        </div>
        <div class="adm-cs-card" style="background:rgba(245,158,11,0.1);border-color:#f59e0b">
          <div class="adm-cs-num">${s.used}</div><div class="adm-cs-lbl">Used</div>
        </div>
        <div class="adm-cs-card" style="background:rgba(99,102,241,0.1);border-color:#6366f1">
          <div class="adm-cs-num">${s.avgDiscount}%</div><div class="adm-cs-lbl">Avg Discount</div>
        </div>
      </div>
      <div style="margin-top:16px">${couponRows}</div>`;
  } catch(e) { console.error(e); }
}

async function loadAdminLeaderboard() {
  try {
    const res = await api('GET', '/admin/leaderboard');
    const el  = $('#admin-leaderboard');
    if (!el || !res.success) return;
    const top = res.leaderboard || [];
    el.innerHTML = top.map((u, i) => `
      <div class="lb-row" style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--border)">
        <div style="width:28px;text-align:center;font-weight:800;color:${i<3?['#f59e0b','#9ca3af','#cd7c2f'][i]:'var(--text2)'}">${i+1}</div>
        <div class="avatar" style="width:32px;height:32px;font-size:13px">${u.name[0]}</div>
        <div style="flex:1">
          <div style="font-weight:600">${u.name}</div>
          <div style="font-size:12px;color:var(--text2)">${u.rptCount} reports · ${u.couponCount} coupons</div>
        </div>
        <div style="font-weight:800;color:var(--accent)">${u.total_earned_points || u.points} pts</div>
      </div>`).join('');
  } catch(e) { console.error(e); }
}

window.adminSetStatus = async function(id, status) {
  const res = await api('PATCH', `/reports/${id}/status`, { status });
  if (res.success) {
    const idx = State.reports.findIndex(r => r.id === id);
    if (idx !== -1) State.reports[idx] = res.report;
    notify(`Status → ${status}`, 'success');
    // Re-render full admin page so stat cards + table both reflect the change
    const content = $('#page-content');
    content.innerHTML = renderAdmin();
    wireAdminPage();
    updateSidebarUser();
  } else {
    notify('Failed to update', 'error');
  }
};

/* ── ADOPT ───────────────────────────────────────────── */
window.adoptStreet = async function(street) {
  const res = await api('PATCH', `/users/${State.currentUser.id}/adopt`, { street });
  if (res.success) {
    State.currentUser.adoptedStreet = street;
    notify(`You adopted ${street}! 🌿`);
    goPage('adopt');
  } else {
    notify('Failed to adopt', 'error');
  }
};

/* ══════════════════════════════════════════════════════
   NGO SUPPORT PAGE — Wiring & Handlers
══════════════════════════════════════════════════════ */

let _ngoData = [];
let _currentVolNgoId = null;

async function wireNGOPage() {
  await loadNGOs();
  wireQuickAmounts();
  wireDonationAmountInput();
  wirePaymentMethods();
  // Retry until the DOM element is mounted
  let tries = 0;
  const tryLoad = async () => {
    const el = document.getElementById('my-donations-list');
    if (el) { await loadMyDonations(); }
    else if (tries++ < 10) { setTimeout(tryLoad, 150); }
  };
  tryLoad();
}

async function loadNGOs() {
  try {
    const res = await api('GET', '/ngos');
    if (!res.success) return;
    _ngoData = res.ngos;
    renderNGOCards(res.ngos);
    populateDonationDropdown(res.ngos);
    updateHeroStats(res.ngos);
  } catch(e) {
    const grid = document.getElementById('ngo-cards-grid');
    if (grid) grid.innerHTML = '<div style="color:var(--text2);text-align:center;padding:40px">Failed to load NGOs. Make sure backend is running.</div>';
  }
}

function updateHeroStats(ngos) {
  const totalVols   = ngos.reduce((s, n) => s + (n.volunteerCount || n.volunteers || 0), 0);
  const totalWaste  = ngos.reduce((s, n) => s + (n.totalWasteCollected || 0), 0);
  const el1 = document.getElementById('hstat-volunteers');
  const el2 = document.getElementById('hstat-waste');
  const el3 = document.getElementById('hstat-ngos');
  if (el1) el1.textContent = totalVols.toLocaleString('en-IN') + '+';
  if (el2) el2.textContent = (totalWaste / 1000).toFixed(1) + 'T';
  if (el3) el3.textContent = ngos.length;
}

function renderNGOCards(ngos) {
  const grid = document.getElementById('ngo-cards-grid');
  if (!grid) return;
  if (!ngos.length) { grid.innerHTML = '<div style="color:var(--text2);text-align:center;padding:40px">No NGOs available.</div>'; return; }

  grid.innerHTML = ngos.map(n => `
    <div class="ngo-card fade-in">
      <div class="ngo-card-header">
        <div class="ngo-logo">${n.logo}</div>
        <div class="ngo-card-info">
          <div class="ngo-card-name">${n.name}</div>
          <div class="ngo-card-loc">📍 ${n.location}</div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:4px;">
            ${n.verified ? '<span class="ngo-verified-badge">✅ Verified</span>' : ''}
            ${n.category ? `<span style="background:var(--accent,#16a34a);color:#fff;font-size:0.68rem;padding:2px 8px;border-radius:20px;font-weight:600;">${n.category}</span>` : ''}
          </div>
        </div>
      </div>
      <p class="ngo-card-desc">${n.description}</p>
      <div class="ngo-causes">
        ${(n.causes || []).map(c => `<span class="cause-tag">${c}</span>`).join('')}
      </div>
      <div class="ngo-card-stats">
        <div class="ngo-stat"><div class="ngo-stat-val">${n.activeProjects}</div><div class="ngo-stat-lbl">Projects</div></div>
        <div class="ngo-stat"><div class="ngo-stat-val">${(n.totalWasteCollected / 1000).toFixed(1)}T</div><div class="ngo-stat-lbl">Waste Cleaned</div></div>
        <div class="ngo-stat"><div class="ngo-stat-val">${n.volunteerCount || n.volunteers || 0}</div><div class="ngo-stat-lbl">Volunteers</div></div>
      </div>
      <div class="ngo-card-footer">
        <button class="btn btn-outline" onclick="openVolModal('${n.id}', '${n.name.replace(/'/g, "\\'")}')">🤝 Join NGO</button>
        <button class="btn btn-primary" onclick="scrollToDonateFor('${n.id}')">💚 Donate</button>
      </div>
    </div>
  `).join('');
}

function populateDonationDropdown(ngos) {
  const sel = document.getElementById('don-ngo-select');
  if (!sel) return;
  sel.innerHTML = '<option value="">— Select an NGO —</option>' +
    ngos.map(n => `<option value="${n.id}">${n.logo} ${n.name} (${n.location})</option>`).join('');
  sel.addEventListener('change', updateImpactPreview);
}

function wireQuickAmounts() {
  document.querySelectorAll('.quick-amt').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.quick-amt').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const amt = btn.dataset.amt;
      const input = document.getElementById('don-amount');
      if (amt === 'custom') {
        if (input) { input.value = ''; input.focus(); }
      } else {
        if (input) input.value = amt;
      }
      updateImpactPreview();
    });
  });
}

function wireDonationAmountInput() {
  const input = document.getElementById('don-amount');
  if (input) input.addEventListener('input', updateImpactPreview);
}

function wirePaymentMethods() {
  document.querySelectorAll('.pm-option').forEach(lbl => {
    lbl.addEventListener('click', () => {
      document.querySelectorAll('.pm-option').forEach(l => l.classList.remove('active'));
      lbl.classList.add('active');
    });
  });
}

function updateImpactPreview() {
  const amt  = parseFloat(document.getElementById('don-amount')?.value || 0);
  const prev = document.getElementById('don-impact-preview');
  const txt  = document.getElementById('don-impact-text');
  if (!prev || !txt) return;
  if (amt > 0) {
    const waste = ((amt / 10) * 0.4).toFixed(1);
    txt.textContent = `💡 Your ₹${amt.toLocaleString('en-IN')} helps clean approximately ${waste}kg of waste!`;
    prev.classList.remove('hidden');
  } else {
    prev.classList.add('hidden');
  }
}

function scrollToSection(id) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function scrollToDonateFor(ngoId) {
  const sel = document.getElementById('don-ngo-select');
  if (sel) sel.value = ngoId;
  scrollToSection('donation-section');
  updateImpactPreview();
}

// ── Volunteer Modal ─────────────────────────────────
function openVolModal(ngoId, ngoName) {
  _currentVolNgoId = ngoId;
  const modal = document.getElementById('vol-modal');
  const title = document.getElementById('vol-modal-title');
  const sub   = document.getElementById('vol-modal-subtitle');
  if (!modal) return;
  if (title) title.textContent = `Join ${ngoName}`;
  if (sub)   sub.textContent   = `Volunteer for ${ngoName} – fill your details below`;
  // Pre-fill if logged in
  const u = State.currentUser;
  if (u) {
    const nameIn  = document.getElementById('vol-name');
    const emailIn = document.getElementById('vol-email');
    if (nameIn  && !nameIn.value)  nameIn.value  = u.name  || '';
    if (emailIn && !emailIn.value) emailIn.value = u.email || '';
  }
  hideNGOMsg('vol-msg');
  modal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeVolModal() {
  const modal = document.getElementById('vol-modal');
  if (modal) modal.classList.add('hidden');
  document.body.style.overflow = '';
}
window.openVolModal    = openVolModal;
window.closeVolModal   = closeVolModal;
window.scrollToSection = scrollToSection;
window.scrollToDonateFor = scrollToDonateFor;

async function submitVolunteer() {
  const fullName    = document.getElementById('vol-name')?.value.trim();
  const email       = document.getElementById('vol-email')?.value.trim();
  const phone       = document.getElementById('vol-phone')?.value.trim();
  const city        = document.getElementById('vol-city')?.value.trim();
  const skills      = document.getElementById('vol-skills')?.value;
  const availability = document.getElementById('vol-avail')?.value;
  const btn         = document.getElementById('vol-submit-btn');

  if (!fullName || !email || !phone || !city || !skills || !availability) {
    showNGOMsg('vol-msg', '⚠️ Please fill all required fields.', 'error'); return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showNGOMsg('vol-msg', '⚠️ Please enter a valid email address.', 'error'); return;
  }

  btn.textContent = '⏳ Submitting...';
  btn.disabled    = true;

  try {
    const res = await api('POST', `/ngos/${_currentVolNgoId}/volunteer`, {
      userId:       State.currentUser?.id || null,
      name: fullName, email, phone, city, skills, availability
    });
    if (res.success) {
      showNGOMsg('vol-msg', '🎉 ' + (res.message || 'Successfully joined!'), 'success');
      if (res.volunteer && State.currentUser) {
        // Update local user points
        const ptRes = await api('GET', `/rewards/${State.currentUser.id}`);
        if (ptRes.success) {
          State.currentUser.points = ptRes.points;
          const sbPts = document.getElementById('sb-pts');
          if (sbPts) sbPts.textContent = `⭐ ${ptRes.points} pts · ${State.currentUser.role}`;
        }
        const ngo = _ngoData.find(n => n.id === _currentVolNgoId);
        notify(`🤝 Joined ${ngo?.name || 'NGO'}! +15 pts`, 'success');
      }
      setTimeout(() => { closeVolModal(); loadNGOs(); }, 1800);
    } else {
      showNGOMsg('vol-msg', '❌ ' + (res.message || 'Failed to join NGO.'), 'error');
    }
  } catch(e) {
    showNGOMsg('vol-msg', '❌ Network error. Please try again.', 'error');
  }
  btn.textContent = '🤝 Join NGO';
  btn.disabled    = false;
}
window.submitVolunteer = submitVolunteer;

// ── Donation Submission ─────────────────────────────
async function submitDonation() {
  const ngoId  = document.getElementById('don-ngo-select')?.value;
  const amount = parseFloat(document.getElementById('don-amount')?.value || 0);
  const name   = document.getElementById('don-name')?.value.trim();
  const email  = document.getElementById('don-email')?.value.trim();
  const method = document.querySelector('input[name="paymethod"]:checked')?.value || 'sandbox';
  const btn    = document.getElementById('donate-btn');

  if (!ngoId)     { showNGOMsg('don-msg', '⚠️ Please select an NGO.', 'error'); return; }
  if (!amount || amount < 1) { showNGOMsg('don-msg', '⚠️ Please enter a valid donation amount.', 'error'); return; }

  btn.textContent = '⏳ Processing...';
  btn.disabled    = true;

  try {
    const res = await api('POST', `/ngos/${ngoId}/donate`, {
      userId:        State.currentUser?.id || null,
      amount,
      paymentMethod: method,
      donorName:     name || 'Anonymous',
      donorEmail:    email || ''
    });
    if (res.success) {
      hideNGOMsg('don-msg');
      showReceipt(res.receipt, res.impactMessage);
      // Refresh donations list
      await loadMyDonations();
      if (State.currentUser) {
        const ptRes = await api('GET', `/rewards/${State.currentUser.id}`);
        if (ptRes.success) {
          State.currentUser.points = ptRes.points;
          const sbPts = document.getElementById('sb-pts');
          if (sbPts) sbPts.textContent = `⭐ ${ptRes.points} pts · ${State.currentUser.role}`;
        }
        notify(`💚 Donation of ₹${amount} successful! Points earned.`, 'success');
      }
      // Reset form
      document.getElementById('don-amount').value = '';
      document.querySelectorAll('.quick-amt').forEach(b => b.classList.remove('active'));
      document.getElementById('don-impact-preview')?.classList.add('hidden');
    } else {
      showNGOMsg('don-msg', '❌ ' + (res.message || 'Payment failed. Please try again.'), 'error');
    }
  } catch(e) {
    showNGOMsg('don-msg', '❌ Network error. Please try again.', 'error');
  }
  btn.textContent = '💚 Donate Now';
  btn.disabled    = false;
}
window.submitDonation = submitDonation;

function showReceipt(receipt, impactMsg) {
  const modal = document.getElementById('receipt-modal');
  const cont  = document.getElementById('receipt-content');
  if (!modal || !cont) return;
  const date = new Date(receipt.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  cont.innerHTML = `
    <div class="receipt-box">
      <div class="receipt-header">
        <div class="receipt-logo">🌿</div>
        <h3>Donation Receipt</h3>
        <div class="receipt-subtitle">🌿BIN-GO – NGO Support</div>
      </div>
      <div class="receipt-body">
        <div class="receipt-row"><span>Receipt No</span><strong>${receipt.receiptNo}</strong></div>
        <div class="receipt-row"><span>Transaction ID</span><strong>${receipt.txnId}</strong></div>
        <div class="receipt-row"><span>NGO</span><strong>${receipt.ngoName}</strong></div>
        <div class="receipt-row"><span>Amount</span><strong class="receipt-amount">₹${Number(receipt.amount).toLocaleString('en-IN')}</strong></div>
        <div class="receipt-row"><span>Date</span><strong>${date}</strong></div>
        <div class="receipt-row"><span>Status</span><strong class="receipt-success">✅ Success</strong></div>
      </div>
      <div class="receipt-impact">${impactMsg}</div>
      <div class="receipt-footer">
        <button class="btn btn-primary btn-full" onclick="closeReceiptModal()">✅ Done</button>
        <div style="font-size:11px;color:var(--text2);text-align:center;margin-top:8px">Sandbox Mode – No real payment charged</div>
      </div>
    </div>
  `;
  modal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeReceiptModal() {
  const modal = document.getElementById('receipt-modal');
  if (modal) modal.classList.add('hidden');
  document.body.style.overflow = '';
}
window.closeReceiptModal = closeReceiptModal;

async function loadMyDonations() {
  if (!State.currentUser) return;
  const list = document.getElementById('my-donations-list');
  if (!list) return;

  list.innerHTML = '<div style="color:var(--text2);font-size:13px;text-align:center;padding:16px">⏳ Loading...</div>';

  try {
    const res = await api('GET', `/donations/${State.currentUser.id}`);
    const donations = (res.success && res.donations) ? res.donations : [];

    if (!donations.length) {
      list.innerHTML = `
        <div style="text-align:center;padding:24px 12px">
          <div style="font-size:32px;margin-bottom:8px">💚</div>
          <div style="font-weight:600;font-size:13px;color:var(--text1,#111);margin-bottom:4px">No donations yet</div>
          <div style="font-size:12px;color:var(--text2,#888)">Make your first donation to support a clean city!</div>
        </div>`;
      return;
    }

    // Summary stats
    const totalAmt  = donations.reduce((s, d) => s + Number(d.amount), 0);
    const totalPts  = donations.reduce((s, d) => s + Math.floor(Number(d.amount) / 10), 0);
    const kgCleaned = Math.round(totalAmt / 2.5);

    const methodIcon  = m => ({ razorpay:'🔶', stripe:'💳', upi:'📱' })[m] || '💰';
    const methodColor = m => ({ razorpay:'#fff3e0', stripe:'#f5f3ff', upi:'#fff7ed' })[m] || '#f0fdf4';
    const methodLabel = m => ({ razorpay:'Razorpay', stripe:'Stripe', upi:'UPI' })[m] || 'Online';

    const rows = donations.slice(0, 5).map((d, i) => `
      <div style="display:flex;align-items:center;gap:10px;padding:10px 0;
        border-bottom:1px solid var(--border,#f0f0f0);
        animation:fadeSlideIn 0.3s ease both;animation-delay:${i * 60}ms">
        <div style="width:38px;height:38px;border-radius:10px;background:${methodColor(d.method)};
          display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0">
          ${methodIcon(d.method)}
        </div>
        <div style="flex:1;min-width:0">
          <div style="font-weight:700;font-size:13px;color:var(--text1,#111);
            white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${d.ngoName || 'NGO'}</div>
          <div style="display:flex;align-items:center;gap:6px;margin-top:3px;flex-wrap:wrap">
            <span style="font-size:10px;background:var(--bg2,#f3f4f6);
              color:var(--text2,#888);padding:2px 6px;border-radius:5px;font-weight:600">
              ${methodLabel(d.method)}
            </span>
            <span style="font-size:10px;color:var(--text2,#aaa)">
              ${new Date(d.createdAt).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}
            </span>
          </div>
        </div>
        <div style="text-align:right;flex-shrink:0">
          <div style="font-weight:800;font-size:14px;color:#16a34a">
            ₹${Number(d.amount).toLocaleString('en-IN')}
          </div>
          <div style="font-size:10px;color:#22c55e;font-weight:600;margin-top:2px">✅ Success</div>
        </div>
      </div>`).join('');

    list.innerHTML = `
      <!-- Summary strip -->
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;
        background:linear-gradient(135deg,#f0fdf4,#dcfce7);
        border-radius:12px;padding:12px;margin-bottom:14px">
        <div style="text-align:center">
          <div style="font-size:15px;font-weight:800;color:#16a34a">
            ₹${totalAmt.toLocaleString('en-IN')}
          </div>
          <div style="font-size:10px;color:#6b7280;font-weight:600">Total Donated</div>
        </div>
        <div style="text-align:center;border-left:1px solid #bbf7d0;border-right:1px solid #bbf7d0">
          <div style="font-size:15px;font-weight:800;color:#f59e0b">⭐ ${totalPts}</div>
          <div style="font-size:10px;color:#6b7280;font-weight:600">Pts Earned</div>
        </div>
        <div style="text-align:center">
          <div style="font-size:15px;font-weight:800;color:#0ea5e9">🌿 ${kgCleaned}kg</div>
          <div style="font-size:10px;color:#6b7280;font-weight:600">Waste Cleaned</div>
        </div>
      </div>
      <!-- Donation rows -->
      ${rows}
      ${donations.length > 5 ? `<div style="text-align:center;font-size:12px;color:var(--text2,#aaa);padding:10px 0">
        + ${donations.length - 5} more donations
      </div>` : ''}`;
  } catch(e) {
    list.innerHTML = '<div style="color:var(--text2);font-size:13px;text-align:center;padding:12px">❌ Failed to load donations</div>';
  }
}

function showNGOMsg(id, msg, type) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg;
  el.className   = `ngo-msg ${type}`;
  el.classList.remove('hidden');
}
function hideNGOMsg(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('hidden');
}

/* ── Google Maps async callback ─────────────────────── */
// Called by Google Maps API once it's ready (via &callback=initGoogleMapsReady)
window.initGoogleMapsReady = function() {
  // If the map page is currently active, initialize it now
  if (State.page === 'map') {
    initGoogleMap();
  }
};

/* ═══════════════════════════════════════════════════════
   FAKE PAYMENT GATEWAY MODAL
   Intercepts donations and shows a realistic gateway UI
═══════════════════════════════════════════════════════ */

let _pgwData = null; // holds pending donation data

/* Override submitDonation to show gateway first */
window.submitDonation = async function() {
  const ngoId  = document.getElementById('don-ngo-select')?.value;
  const amount = parseFloat(document.getElementById('don-amount')?.value || 0);
  const name   = document.getElementById('don-name')?.value.trim();
  const email  = document.getElementById('don-email')?.value.trim();
  const method = document.querySelector('input[name="paymethod"]:checked')?.value || 'razorpay';

  if (!ngoId)               { showNGOMsg('don-msg', '⚠️ Please select an NGO.', 'error'); return; }
  if (!amount || amount < 1){ showNGOMsg('don-msg', '⚠️ Please enter a valid donation amount.', 'error'); return; }

  // Store pending data and open gateway
  _pgwData = { ngoId, amount, name: name || 'Anonymous', email: email || '', method };
  openPaymentGateway(method, amount, ngoId);
};

/* ── OPEN GATEWAY ── */
function openPaymentGateway(method, amount, ngoId) {
  // Get NGO name from select
  const sel = document.getElementById('don-ngo-select');
  const ngoName = sel?.options[sel.selectedIndex]?.text || 'NGO';

  // Build modal HTML
  const overlay = document.createElement('div');
  overlay.className = 'pgw-overlay';
  overlay.id = 'pgw-overlay';

  overlay.innerHTML = `
    <div class="pgw-modal" id="pgw-modal">
      <!-- HEADER -->
      <div class="pgw-header">
        ${pgwHeaderHTML(method)}
      </div>

      <!-- AMOUNT BAR -->
      <div class="pgw-amount-bar ${method}">
        <div>
          <div class="pgw-amount-lbl">Paying to ${ngoName}</div>
          <div class="pgw-amount-val">₹${Number(amount).toLocaleString('en-IN')}</div>
        </div>
        <div class="pgw-ngo-name">${ngoName}</div>
      </div>

      <!-- PAYMENT FORM (shown first) -->
      <div id="pgw-form-section">
        <div class="pgw-body" id="pgw-body">
          ${pgwFormHTML(method)}
        </div>
        <div class="pgw-footer">
          <button class="pgw-pay-btn ${method}" onclick="pgwPay()">
            ${pgwPayLabel(method, amount)}
          </button>
          <div class="pgw-sandbox-note">🔒 Sandbox Mode · No real payment · 256-bit SSL</div>
          <div class="pgw-cancel-link" onclick="closePaymentGateway()">✕ Cancel Payment</div>
        </div>
      </div>

      <!-- PROCESSING SCREEN (hidden initially) -->
      <div class="pgw-processing" id="pgw-processing">
        <div class="pgw-spinner-ring ${method}" id="pgw-spinner"></div>
        <h3>Processing Payment…</h3>
        <p>Please wait, do not close this window</p>
        <div class="pgw-processing-steps" id="pgw-steps">
          <div class="pgw-step" id="step1"><span class="pgw-step-icon">🔐</span>Authenticating session</div>
          <div class="pgw-step" id="step2"><span class="pgw-step-icon">💳</span>Verifying payment details</div>
          <div class="pgw-step" id="step3"><span class="pgw-step-icon">🏦</span>Contacting bank</div>
          <div class="pgw-step" id="step4"><span class="pgw-step-icon">✅</span>Confirming transaction</div>
        </div>
      </div>

      <!-- SUCCESS SCREEN (hidden initially) -->
      <div class="pgw-success" id="pgw-success">
        <div class="pgw-success-circle">✓</div>
        <h3>Payment Successful!</h3>
        <p>Your donation has been received. Thank you! 💚</p>
        <div class="pgw-txn-box" id="pgw-txn-box"></div>
        <button class="pgw-pay-btn green" onclick="pgwDone()" style="width:100%">
          🎉 Done
        </button>
        <div class="pgw-sandbox-note" style="margin-top:10px">🔒 Sandbox Mode · No real payment charged</div>
      </div>
    </div>`;

  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('visible'));

  // Close on backdrop click
  overlay.addEventListener('click', e => { if (e.target === overlay) closePaymentGateway(); });
}

function pgwHeaderHTML(method) {
  const configs = {
    razorpay: { logo: '🔶', bg: '#fff3e0', name: 'Razorpay', sub: 'Secure Payment Gateway' },
    stripe:   { logo: '💳', bg: '#f5f3ff', name: 'Stripe',   sub: 'Powered by Stripe' },
    upi:      { logo: '📱', bg: '#fff7ed', name: 'UPI Pay',  sub: 'Unified Payments Interface' },
  };
  const c = configs[method] || configs.razorpay;
  return `
    <div class="pgw-logo" style="background:${c.bg}">${c.logo}</div>
    <div class="pgw-header-text">
      <h3>${c.name}</h3>
      <p>${c.sub}</p>
    </div>
    <div class="pgw-secure">🔒 Secure</div>`;
}

function pgwFormHTML(method) {
  if (method === 'razorpay') return `
    <div style="font-size:12px;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:12px">Choose Payment Method</div>
    <div class="pgw-rzp-methods">
      <div class="pgw-rzp-method active" onclick="pgwRzpSelect(this,'upi')">
        <div class="pgw-rzp-method-icon" style="background:#fff3e0">📱</div>
        <div><div class="pgw-rzp-method-label">UPI</div><div class="pgw-rzp-method-sub">GPay, PhonePe, Paytm</div></div>
        <div class="pgw-rzp-check">✓</div>
      </div>
      <div class="pgw-rzp-method" onclick="pgwRzpSelect(this,'netbanking')">
        <div class="pgw-rzp-method-icon" style="background:#eff6ff">🏦</div>
        <div><div class="pgw-rzp-method-label">Net Banking</div><div class="pgw-rzp-method-sub">All major banks</div></div>
        <div class="pgw-rzp-check"></div>
      </div>
      <div class="pgw-rzp-method" onclick="pgwRzpSelect(this,'card')">
        <div class="pgw-rzp-method-icon" style="background:#f5f3ff">💳</div>
        <div><div class="pgw-rzp-method-label">Credit / Debit Card</div><div class="pgw-rzp-method-sub">Visa, Mastercard, RuPay</div></div>
        <div class="pgw-rzp-check"></div>
      </div>
      <div class="pgw-rzp-method" onclick="pgwRzpSelect(this,'wallet')">
        <div class="pgw-rzp-method-icon" style="background:#f0fdf4">👝</div>
        <div><div class="pgw-rzp-method-label">Wallets</div><div class="pgw-rzp-method-sub">Paytm, Mobikwik, Freecharge</div></div>
        <div class="pgw-rzp-check"></div>
      </div>
    </div>
    <div id="pgw-rzp-sub" style="padding:10px;background:#f9fafb;border-radius:10px;font-size:12px;color:#555">
      <div style="font-weight:600;margin-bottom:6px">Enter UPI ID</div>
      <input type="text" placeholder="yourname@upi" style="width:100%;border:2px solid #e5e7eb;border-radius:8px;padding:9px 12px;font-size:13px;outline:none;box-sizing:border-box" id="pgw-rzp-upi-id" onfocus="this.style.borderColor='#0d6efd'" onblur="this.style.borderColor='#e5e7eb'"/>
    </div>`;

  if (method === 'stripe') return `
    <div class="pgw-card-brands">
      <div class="pgw-card-brand-pill active">💳 Visa</div>
      <div class="pgw-card-brand-pill">💳 Mastercard</div>
      <div class="pgw-card-brand-pill">💳 Amex</div>
    </div>
    <div class="pgw-card-field">
      <label>Card Number</label>
      <input type="text" placeholder="1234 5678 9012 3456" maxlength="19" id="pgw-card-num"
        oninput="pgwFormatCard(this)" onfocus="this.style.borderColor='#635bff'" onblur="this.style.borderColor='#e5e7eb'"/>
    </div>
    <div class="pgw-card-field">
      <label>Cardholder Name</label>
      <input type="text" placeholder="Name on card" id="pgw-card-name"
        onfocus="this.style.borderColor='#635bff'" onblur="this.style.borderColor='#e5e7eb'"/>
    </div>
    <div class="pgw-card-row">
      <div class="pgw-card-field">
        <label>Expiry</label>
        <input type="text" placeholder="MM / YY" maxlength="7" id="pgw-card-exp"
          oninput="pgwFormatExpiry(this)" onfocus="this.style.borderColor='#635bff'" onblur="this.style.borderColor='#e5e7eb'"/>
      </div>
      <div class="pgw-card-field">
        <label>CVV</label>
        <input type="password" placeholder="•••" maxlength="4" id="pgw-card-cvv"
          onfocus="this.style.borderColor='#635bff'" onblur="this.style.borderColor='#e5e7eb'"/>
      </div>
    </div>`;

  if (method === 'upi') return `
    <div style="font-size:12px;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:12px">Select UPI App</div>
    <div class="pgw-upi-apps">
      <div class="pgw-upi-app active" onclick="pgwUpiSelect(this)">
        <div class="pgw-upi-app-icon">🟢</div>
        <div class="pgw-upi-app-name">GPay</div>
      </div>
      <div class="pgw-upi-app" onclick="pgwUpiSelect(this)">
        <div class="pgw-upi-app-icon">🟣</div>
        <div class="pgw-upi-app-name">PhonePe</div>
      </div>
      <div class="pgw-upi-app" onclick="pgwUpiSelect(this)">
        <div class="pgw-upi-app-icon">🔵</div>
        <div class="pgw-upi-app-name">Paytm</div>
      </div>
      <div class="pgw-upi-app" onclick="pgwUpiSelect(this)">
        <div class="pgw-upi-app-icon">🟠</div>
        <div class="pgw-upi-app-name">BHIM</div>
      </div>
    </div>
    <div class="pgw-upi-or">— or enter UPI ID manually —</div>
    <div class="pgw-upi-id-row">
      <input type="text" placeholder="yourname@ybl" id="pgw-upi-id"
        onfocus="this.style.borderColor='#f97316'" onblur="this.style.borderColor='#e5e7eb'"/>
      <button class="pgw-upi-verify-btn" onclick="pgwVerifyUpi()">Verify</button>
    </div>
    <div id="pgw-upi-verify-msg" style="font-size:11px;margin-top:6px;color:#22c55e;display:none">✓ UPI ID verified</div>`;

  return '';
}

function pgwPayLabel(method, amount) {
  const labels = { razorpay: '🔶 Pay with Razorpay', stripe: '💳 Pay with Stripe', upi: '📱 Pay via UPI' };
  return `${labels[method] || 'Pay'} · ₹${Number(amount).toLocaleString('en-IN')}`;
}

/* ── Razorpay sub-method selector ── */
window.pgwRzpSelect = function(el, subMethod) {
  document.querySelectorAll('.pgw-rzp-method').forEach(m => {
    m.classList.remove('active');
    m.querySelector('.pgw-rzp-check').textContent = '';
  });
  el.classList.add('active');
  el.querySelector('.pgw-rzp-check').textContent = '✓';
  const sub = document.getElementById('pgw-rzp-sub');
  if (!sub) return;
  const subForms = {
    upi:        `<div style="font-weight:600;margin-bottom:6px;font-size:12px">Enter UPI ID</div><input type="text" placeholder="yourname@upi" id="pgw-rzp-upi-id" style="width:100%;border:2px solid #e5e7eb;border-radius:8px;padding:9px 12px;font-size:13px;outline:none;box-sizing:border-box"/>`,
    netbanking: `<div style="font-weight:600;margin-bottom:8px;font-size:12px">Select Bank</div><select style="width:100%;border:2px solid #e5e7eb;border-radius:8px;padding:9px 12px;font-size:13px;outline:none"><option>State Bank of India</option><option>HDFC Bank</option><option>ICICI Bank</option><option>Axis Bank</option><option>Punjab National Bank</option><option>Bank of Baroda</option></select>`,
    card:       `<div style="font-weight:600;margin-bottom:8px;font-size:12px">Card Number</div><input type="text" placeholder="1234 5678 9012 3456" maxlength="19" oninput="pgwFormatCard(this)" style="width:100%;border:2px solid #e5e7eb;border-radius:8px;padding:9px 12px;font-size:13px;outline:none;box-sizing:border-box;margin-bottom:8px"/><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px"><input type="text" placeholder="MM/YY" maxlength="5" style="border:2px solid #e5e7eb;border-radius:8px;padding:9px 12px;font-size:13px;outline:none"/><input type="password" placeholder="CVV" maxlength="3" style="border:2px solid #e5e7eb;border-radius:8px;padding:9px 12px;font-size:13px;outline:none"/></div>`,
    wallet:     `<div style="font-weight:600;margin-bottom:8px;font-size:12px">Select Wallet</div><select style="width:100%;border:2px solid #e5e7eb;border-radius:8px;padding:9px 12px;font-size:13px;outline:none"><option>Paytm Wallet</option><option>Mobikwik</option><option>Freecharge</option><option>Amazon Pay</option></select>`,
  };
  sub.innerHTML = subForms[subMethod] || '';
};

/* ── UPI helpers ── */
window.pgwUpiSelect = function(el) {
  document.querySelectorAll('.pgw-upi-app').forEach(a => a.classList.remove('active'));
  el.classList.add('active');
};
window.pgwVerifyUpi = function() {
  const val = document.getElementById('pgw-upi-id')?.value;
  const msg = document.getElementById('pgw-upi-verify-msg');
  if (msg) { msg.style.display = val ? 'block' : 'none'; }
};

/* ── Card formatters ── */
window.pgwFormatCard = function(el) {
  let v = el.value.replace(/\D/g,'').slice(0,16);
  el.value = v.replace(/(.{4})/g,'$1 ').trim();
};
window.pgwFormatExpiry = function(el) {
  let v = el.value.replace(/\D/g,'').slice(0,4);
  if (v.length >= 2) v = v.slice(0,2) + ' / ' + v.slice(2);
  el.value = v;
};

/* ── PAY BUTTON CLICK ── */
window.pgwPay = async function() {
  const formSec = document.getElementById('pgw-form-section');
  const procSec = document.getElementById('pgw-processing');
  const spinner = document.getElementById('pgw-spinner');

  if (formSec) formSec.style.display = 'none';
  if (procSec) procSec.classList.add('active');
  if (spinner && _pgwData) spinner.className = `pgw-spinner-ring ${_pgwData.method}`;

  // Animate steps
  const steps = ['step1','step2','step3','step4'];
  for (let i = 0; i < steps.length; i++) {
    await new Promise(r => setTimeout(r, 600 + i * 500));
    const el = document.getElementById(steps[i]);
    if (el) el.className = 'pgw-step done';
    if (i < steps.length - 1) {
      const next = document.getElementById(steps[i+1]);
      if (next) next.className = 'pgw-step active';
    }
  }

  await new Promise(r => setTimeout(r, 400));

  // Now hit the real API
  try {
    const res = await api('POST', `/ngos/${_pgwData.ngoId}/donate`, {
      userId:        State.currentUser?.id || null,
      amount:        _pgwData.amount,
      paymentMethod: _pgwData.method,
      donorName:     _pgwData.name,
      donorEmail:    _pgwData.email,
    });

    if (procSec) procSec.classList.remove('active');
    const succSec = document.getElementById('pgw-success');
    if (succSec) succSec.classList.add('active');

    if (res.success && res.receipt) {
      const r = res.receipt;
      const txnBox = document.getElementById('pgw-txn-box');
      if (txnBox) txnBox.innerHTML = `
        <div class="pgw-txn-row"><span>Transaction ID</span><strong>${r.txnId}</strong></div>
        <div class="pgw-txn-row"><span>Receipt No</span><strong>${r.receiptNo}</strong></div>
        <div class="pgw-txn-row"><span>NGO</span><strong>${r.ngoName}</strong></div>
        <div class="pgw-txn-row"><span>Amount</span><strong style="color:#22c55e">₹${Number(r.amount).toLocaleString('en-IN')}</strong></div>
        <div class="pgw-txn-row"><span>Points Earned</span><strong style="color:#f59e0b">+${r.pointsEarned} pts ⭐</strong></div>
        <div class="pgw-txn-row"><span>Status</span><strong style="color:#22c55e">✅ Success</strong></div>`;
      _pgwData._receipt = r;
      _pgwData._impactMsg = res.impactMessage;

      // Update sidebar points
      if (State.currentUser && res.newPoints !== undefined) {
        State.currentUser.points = res.newPoints;
        const sbPts = document.getElementById('sb-pts');
        if (sbPts) sbPts.textContent = `⭐ ${res.newPoints} pts · ${State.currentUser.role}`;
      }
    }
  } catch(e) {
    closePaymentGateway();
    showNGOMsg('don-msg', '❌ Payment failed. Please try again.', 'error');
  }
};

/* ── DONE — close gateway and show receipt ── */
window.pgwDone = async function() {
  const r = _pgwData?._receipt;
  const imp = _pgwData?._impactMsg;
  closePaymentGateway();

  if (r) {
    // Show the existing receipt modal
    showReceipt(r, imp || '🌿 Thank you for your generous donation!');
    await loadMyDonations();
    notify(`💚 Donation of ₹${r.amount} successful!`, 'success');
    // Reset donation form
    const amtEl = document.getElementById('don-amount');
    if (amtEl) amtEl.value = '';
    document.querySelectorAll('.quick-amt').forEach(b => b.classList.remove('active'));
    document.getElementById('don-impact-preview')?.classList.add('hidden');
  }
  _pgwData = null;
};

/* ── CLOSE ── */
window.closePaymentGateway = function() {
  const overlay = document.getElementById('pgw-overlay');
  if (!overlay) return;
  overlay.classList.remove('visible');
  setTimeout(() => overlay.remove(), 300);
};
