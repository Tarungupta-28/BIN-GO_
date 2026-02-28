/* ═══════════════════════════════════════════════════════
   pages.js — Page renderers (return HTML strings)
═══════════════════════════════════════════════════════ */
'use strict';

/* ── DASHBOARD ──────────────────────────────────────── */
function renderDashboard() {
  const u    = State.currentUser;
  const rpts = State.reports;
  const myR  = rpts.filter(r => r.userId === u.id);
  const res  = rpts.filter(r => r.status === 'Resolved').length;
  const esc  = rpts.filter(r => r.status === 'Escalated' || escalLevel(r) === 'escalated').length;
  const rate = rpts.length ? Math.round(res / rpts.length * 100) : 0;
  const myCO2 = myR.reduce((s, r) => s + (r.co2 || 0), 0).toFixed(1);

  const stats = [
    { lbl:'Total Reports', val:rpts.length,  sub:'City-wide' },
    { lbl:'Resolved',      val:`${rate}%`,    sub:`${res} of ${rpts.length}` },
    { lbl:'Escalated',     val:esc,           sub:'Need attention' },
    { lbl:'My CO₂ Saved',  val:`${myCO2}kg`, sub:'Carbon prevented' },
  ].map(s => `
    <div class="stat-card">
      <div class="stat-lbl">${s.lbl}</div>
      <div class="stat-val">${s.val}</div>
      <div class="stat-sub">${s.sub}</div>
    </div>`).join('');

  const areaRows = AREAS.map(a => {
    const sc = areaScore(a, rpts), col = scoreColor(sc);
    return `<div class="area-row">
      <div class="area-row-hd"><span>${a}</span><span style="color:${col};font-weight:700">${sc}/100</span></div>
      <div class="prog-bar"><div class="prog-fill" style="width:${sc}%;background:${col}"></div></div>
    </div>`;
  }).join('');

  const recentRows = rpts.slice(0, 6).map(r => `
    <div class="rpt-row">
      <div class="rpt-info">
        <div class="rpt-title">${r.area}</div>
        <div class="rpt-sub">${r.wasteType} · ${r.userName}</div>
      </div>
      ${statusBadge(r)}
    </div>`).join('');

  const timerRows = rpts.filter(r => r.status !== 'Resolved' && hoursAgo(r.createdAt) >= 24).slice(0, 5);
  const timerHtml = timerRows.length
    ? timerRows.map(r => `
      <div class="tmr-row">
        <div class="rpt-info">
          <div class="rpt-title">${r.area} – ${r.wasteType}</div>
          <div class="rpt-sub">${r.description.slice(0, 42)}…</div>
        </div>
        ${timerChip(r)}
      </div>`).join('')
    : '<div style="color:var(--text2);text-align:center;padding:18px 0">✅ No alerts right now</div>';

  const badgePills = (u.badges || []).length
    ? u.badges.map(b => `<span class="badge-pill">${badgeEmoji(b)} ${b}</span>`).join('')
    : '<span style="color:var(--text2);font-size:13px">Keep reporting to earn badges!</span>';

  return `<div class="fade-in">
    <div class="pg-header"><h2>Good day, ${u.name.split(' ')[0]}! 👋</h2><p>Your 🌿BIN-GO impact overview</p></div>
    <div class="stats-grid">${stats}</div>
    <div class="quick-row">
      <button class="btn btn-primary btn-lg" onclick="goPage('report')">📸 Report Waste</button>
      <button class="btn btn-outline btn-lg"  onclick="goPage('map')">🗺️ View Map</button>
    </div>
    <div class="dash-grid">
      <div class="sec-card"><div class="sec-title">📊 Location – Coordinates Cleanliness Index</div>${areaRows}</div>
      <div class="sec-card"><div class="sec-title">📋 Recent Reports</div>${recentRows}</div>
      <div class="sec-card"><div class="sec-title">⏱️ Escalation Timers</div>${timerHtml}</div>
      <div class="sec-card">
        <div class="sec-title">🏆 My Achievements</div>
        <div style="display:flex;gap:16px;margin-bottom:16px">
          <div style="text-align:center;flex:1">
            <div style="font-size:32px;font-weight:800;color:var(--accent)">${u.points}</div>
            <div style="font-size:12px;color:var(--text2)">Total Points</div>
          </div>
          <div style="text-align:center;flex:1">
            <div style="font-size:32px;font-weight:800;color:#f59e0b">${myR.length}</div>
            <div style="font-size:12px;color:var(--text2)">Reports Made</div>
          </div>
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:8px">${badgePills}</div>
      </div>
    </div>
  </div>`;
}

/* ── REPORT WASTE ────────────────────────────────────── */
function renderReport() {
  State.imgData  = null;
  State.gpsCoords = { lat: 21.1904, lng: 81.2849 };
  State.selWaste  = '';

  const areaOpts = AREAS.map(a => `<option>${a}</option>`).join('');
  const wtBtns   = WASTE_TYPES.map(t => `<button class="wt-btn" data-type="${t}">${t}</button>`).join('');

  return `<div class="fade-in">
    <div class="pg-header"><h2>📸 Report Waste</h2><p>Help keep your city clean</p></div>
    <div class="report-form-wrap">
      <div class="card" style="padding:24px">

        <div class="field-group">
          <label>Waste Photo</label>
          <div class="photo-btns-row">
            <button type="button" class="photo-src-btn" onclick="document.getElementById('img-input').click()">
              <svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              Upload Photo
            </button>
            <button type="button" class="photo-src-btn" onclick="openCameraCapture()">
              <svg viewBox="0 0 24 24"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
              Take Photo
            </button>
          </div>
          <div class="upload-zone" id="upload-zone" onclick="document.getElementById('img-input').click()">
            <svg viewBox="0 0 24 24"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
            <p>Tap to upload photo</p><small>JPG, PNG, WEBP supported</small>
          </div>
          <input id="img-input" type="file" accept="image/*" style="display:none" onchange="handleImgUpload(this)"/>
        </div>

        <!-- ── CAMERA CAPTURE MODAL ── -->
        <div id="camera-modal" class="camera-modal hidden">
          <div class="camera-modal-inner">
            <div class="camera-modal-header">
              <span style="font-weight:700;font-size:15px">📷 Take Photo</span>
              <button class="camera-close-btn" onclick="closeCameraCapture()">✕</button>
            </div>
            <div class="camera-viewfinder" id="camera-viewfinder">
              <video id="camera-video" autoplay playsinline muted></video>
              <canvas id="camera-canvas" style="display:none"></canvas>
              <div class="camera-guide-frame"></div>
            </div>
            <div id="camera-snap-preview" class="hidden" style="padding:0 16px">
              <img id="camera-preview-img" alt="captured" style="width:100%;border-radius:10px;max-height:240px;object-fit:cover"/>
            </div>
            <div id="camera-err" class="camera-err hidden"></div>
            <div class="camera-controls" id="camera-live-controls">
              <button class="camera-flip-btn" onclick="flipCamera()" title="Flip camera">🔄</button>
              <button class="camera-shutter-btn" onclick="snapPhoto()"></button>
              <div style="width:44px"></div>
            </div>
            <div class="camera-controls hidden" id="camera-retake-controls">
              <button class="btn btn-outline" style="flex:1" onclick="retakePhoto()">🔄 Retake</button>
              <button class="btn btn-primary" style="flex:1" onclick="usePhoto()">✅ Use Photo</button>
            </div>
          </div>
        </div>

        <div class="field-group">
          <label>Description <span style="color:var(--text2);font-weight:400">(AI auto-detects waste type)</span></label>
          <textarea id="desc-inp" placeholder="Describe the waste you see…" oninput="handleDescInput(this.value)"></textarea>
          <div id="ai-box" class="ai-box hidden">🤖 AI Detected: <strong id="ai-type"></strong></div>
        </div>

        <div class="field-group">
          <label>Waste Type</label>
          <div class="wt-btns">${wtBtns}</div>
        </div>

        <div class="field-group">
          <label>Location – Coordinates</label>
          <select id="area-sel">${areaOpts}</select>
        </div>

        <div class="field-group">
          <label>Location</label>
          <div class="loc-row">
            <div class="loc-disp" id="loc-disp">📍 21.1904, 81.2849 (default)</div>
            <button class="btn btn-outline" id="gps-btn" onclick="getGPS()">📡 Auto-detect</button>
          </div>
          <div class="mini-map" id="mini-map"></div>
        </div>

        <div class="co2-box hidden" id="co2-box">
          <div style="font-size:13px;color:var(--text2)">Carbon Impact Prevented</div>
          <div class="co2-val">🌱 <span id="co2-val">0</span>kg CO₂</div>
          <small>By reporting this waste type</small>
        </div>

        <button class="btn btn-primary btn-full btn-lg" id="submit-btn" onclick="submitReport()">🚀 Submit Report</button>
      </div>
    </div>
  </div>`;
}

/* ── MAP ─────────────────────────────────────────────── */
function renderMap() {
  const rpts = State.reports;
  const typeOpts   = ['all', ...WASTE_TYPES].map(t => `<option value="${t}">${t === 'all' ? 'All Types' : t}</option>`).join('');
  const statusOpts = ['all', ...STATUSES].map(s => `<option value="${s}">${s === 'all' ? 'All Status' : s}</option>`).join('');
  const areaCards  = AREAS.map(a => {
    const sc = areaScore(a, rpts), col = scoreColor(sc), cnt = rpts.filter(r => r.area === a).length;
    return `<div class="area-card">
      <div class="score-circle" style="color:${col};border-color:${col};background:${col}22">${sc}</div>
      <div style="flex:1">
        <div style="font-weight:600;font-size:14px">${a}</div>
        <div style="font-size:12px;color:${col};font-weight:600">${scoreLabel(sc)}</div>
      </div>
      <div style="font-size:12px;color:var(--text2)">${cnt} rpts</div>
    </div>`;
  }).join('');

  return `<div class="fade-in">
    <div class="pg-header"><h2>🗺️ Live Waste Map</h2><p>Real-time report heatmap &amp; cleanliness index</p></div>
    <div class="map-filters">
      <select id="map-type-sel">${typeOpts}</select>
      <select id="map-stat-sel">${statusOpts}</select>
      <button class="hm-btn" id="hm-btn">🔥 Heatmap OFF</button>
    </div>
    <div class="map-wrap">
      <div id="google-map-el" style="width:100%;height:420px;border-radius:16px;overflow:hidden;background:var(--inp)"></div>
    </div>
    <div class="area-cards">${areaCards}</div>
  </div>`;
}

/* ── LEADERBOARD ────────────────────────────────────── */
function renderLeaderboard() {
  const board = State.users
    .filter(u => u.role !== 'admin')
    .map(u => ({ ...u, rptCount: State.reports.filter(r => r.userId === u.id).length }))
    .sort((a, b) => b.points - a.points);

  const medals = ['🥇','🥈','🥉'];
  const podCls = ['gold','silver','bronze'];

  const podium = board.slice(0, 3).map((u, i) => `
    <div class="pod-card ${podCls[i]}">
      <div style="font-size:28px">${medals[i]}</div>
      <div class="avatar" style="margin:8px auto;font-size:18px">${u.name[0]}</div>
      <div style="font-weight:700;font-size:14px">${u.name.split(' ')[0]}</div>
      <div style="font-size:18px;font-weight:800;color:var(--accent);margin-top:4px">${u.points} pts</div>
      <div style="font-size:12px;color:var(--text2)">${u.rptCount} reports</div>
      <div style="margin-top:8px;font-size:18px">${(u.badges||[]).map(badgeEmoji).join(' ')}</div>
    </div>`).join('');

  const rows = board.map((u, i) => `
    <div class="lb-row">
      <div class="lb-rank">${medals[i] || `#${i+1}`}</div>
      <div class="avatar">${u.name[0]}</div>
      <div class="lb-info">
        <div class="lb-name">${u.name}</div>
        <div class="lb-sub">${u.rptCount} reports · ${(u.badges||[]).map(badgeEmoji).join(' ')}</div>
      </div>
      <div class="lb-pts">${u.points}</div>
    </div>`).join('');

  const guide = [
    ['Clean Hero','🏆','Resolve 5+ waste reports'],
    ['Eco Warrior','🌿','Report organic waste 3+ times'],
    ['Street Guardian','🛡️','Adopt a street in your area'],
  ].map(([n,e,d]) => `<div class="bg-card"><div class="bg-emoji">${e}</div><div class="bg-name">${n}</div><div class="bg-desc">${d}</div></div>`).join('');

  return `<div class="fade-in">
    <div class="pg-header"><h2>🏆 Leaderboard</h2><p>Top civic champions in Bhilai</p></div>
    <div class="podium">${podium}</div>
    <div class="lb-table">${rows}</div>
    <div class="sec-card"><div class="sec-title">🏅 Badge Guide</div><div class="badge-guide">${guide}</div></div>
  </div>`;
}

/* ── ADOPT A STREET ─────────────────────────────────── */
function renderAdopt() {
  const u = State.currentUser;
  const adopted = u.adoptedStreet;

  const banner = adopted
    ? `<div class="adopted-banner">🌿 You are currently a guardian of <strong>${adopted}</strong>! Your commitment helps keep this street clean.</div>`
    : '';

  const cards = AREAS.map((area, i) => {
    const score = areaScore(area, State.reports);
    const col   = scoreColor(score);
    const cnt   = State.reports.filter(r => r.area === area).length;
    const isMine = adopted === area;
    const footer = isMine
      ? `<div style="color:var(--accent);font-weight:700;font-size:13px">✅ Your adopted street</div>`
      : `<button class="btn btn-outline btn-full" onclick="adoptStreet('${area}')">🏠 Adopt This Street</button>`;

    return `<div class="adopt-card${isMine ? ' mine' : ''}">
      <div class="adopt-top">
        <div class="score-circle" style="color:${col};border-color:${col};background:${col}22">${score}</div>
        <div><div style="font-weight:700;font-size:15px">${area}</div><div style="font-size:12px;color:${col};font-weight:600">${scoreLabel(score)}</div></div>
      </div>
      <div style="font-size:13px;color:var(--text2);margin-bottom:12px">${cnt} reports · Monthly rank #${i+1}</div>
      ${footer}
    </div>`;
  }).join('');

  return `<div class="fade-in">
    <div class="pg-header"><h2>🏘️ Adopt a Street</h2><p>Take responsibility for a street and track its cleanliness score</p></div>
    ${banner}
    <div class="adopt-grid">${cards}</div>
  </div>`;
}

/* ── ADMIN ───────────────────────────────────────────── */
function renderAdmin() {
  const rpts = State.reports;
  const res  = rpts.filter(r => r.status === 'Resolved').length;
  const esc  = rpts.filter(r => r.status === 'Escalated' || escalLevel(r) === 'escalated').length;
  const inp  = rpts.filter(r => r.status === 'In Progress').length;

  const statCards = [
    { lbl:'Total Reports', val:rpts.length },
    { lbl:'Resolved', val:`${res} (${rpts.length ? Math.round(res/rpts.length*100) : 0}%)` },
    { lbl:'In Progress', val:inp },
    { lbl:'Escalated', val:esc },
  ].map(s => `<div class="stat-card"><div class="stat-lbl">${s.lbl}</div><div class="stat-val">${s.val}</div></div>`).join('');

  const centre = { lat:21.1904, lng:81.2849 };
  const route  = [...rpts]
    .filter(r => r.status !== 'Resolved')
    .sort((a,b) => (Math.abs(a.lat-centre.lat)+Math.abs(a.lng-centre.lng)) - (Math.abs(b.lat-centre.lat)+Math.abs(b.lng-centre.lng)))
    .slice(0, 6);
  const routeHtml = route.map((r, i) => `
    <div class="route-step">
      <div class="rt-num">${i+1}</div>
      <div class="rt-lbl">${r.area}</div>
      ${i < route.length-1 ? '<span style="color:var(--text2)">→</span>' : ''}
    </div>`).join('');

  const statusOpts = ['all',...STATUSES].map(s => `<option value="${s}">${s==='all'?'All Status':s}</option>`).join('');
  const areaOpts   = ['all',...AREAS].map(a => `<option value="${a}">${a==='all'?'All Areas':a}</option>`).join('');
  const typeOpts   = ['all',...WASTE_TYPES].map(t => `<option value="${t}">${t==='all'?'All Types':t}</option>`).join('');

  return `<div class="fade-in">
    <div class="pg-header"><h2>🛡️ Admin Dashboard</h2><p>Manage all reports and monitor city cleanliness</p></div>
    <div class="stats-grid">${statCards}</div>
    <div class="route-box">
      <div class="sec-title">🗺️ Suggested Cleaning Route (Optimized by proximity)</div>
      <div class="route-steps">${routeHtml}</div>
    </div>
    <div class="admin-filters">
      <select id="adm-stat">${statusOpts}</select>
      <select id="adm-area">${areaOpts}</select>
      <select id="adm-type">${typeOpts}</select>
    </div>
    <div class="adm-table">
      <div class="adm-thead">
        <span>Location – Coordinates / Description</span><span>Reporter</span>
        <span>Type</span><span>Timer</span><span>Actions</span>
      </div>
      <div id="adm-tbody"></div>
    </div>

    <!-- COUPON ADMIN PANEL -->
    <div class="sec-card" style="margin-top:20px">
      <div class="sec-title">🎫 Coupon Analytics</div>
      <div id="admin-coupon-stats" style="color:var(--text2);text-align:center;padding:20px">Loading...</div>
    </div>

    <!-- LEADERBOARD -->
    <div class="sec-card" style="margin-top:20px">
      <div class="sec-title">🏆 Top Users by Points</div>
      <div id="admin-leaderboard" style="color:var(--text2);text-align:center;padding:20px">Loading...</div>
    </div>
  </div>`;
}

function buildAdminTable(fStatus, fArea, fType) {
  const filtered = State.reports.filter(r =>
    (fStatus === 'all' || r.status   === fStatus) &&
    (fArea   === 'all' || r.area     === fArea)   &&
    (fType   === 'all' || r.wasteType === fType)
  );
  if (!filtered.length) return `<div style="padding:38px;text-align:center;color:var(--text2)">No reports match filters</div>`;
  const clsMap = { Resolved:'ab-resolved','In Progress':'ab-progress', Escalated:'ab-escalated', Pending:'ab-pending' };
  return filtered.map(r => {
    const lvl    = escalLevel(r);
    const rowCls = lvl==='red'||lvl==='escalated' ? 'row-red' : lvl==='yellow' ? 'row-yellow' : '';
    const actions = STATUSES.filter(s => s !== r.status).slice(0, 3).map(s =>
      `<button class="act-btn ${clsMap[s]}" onclick="adminSetStatus('${r.id}','${s}')">${s}</button>`
    ).join('');
    return `<div class="adm-row ${rowCls}">
      <div><div class="r-title">${r.area}</div><div class="r-sub">${r.description.slice(0,42)}…</div></div>
      <div class="r-reporter" style="color:var(--text2);font-size:13px">${r.userName}</div>
      <div class="r-type"><span style="background:var(--inp);padding:3px 7px;border-radius:5px;font-size:11px;font-weight:600">${r.wasteType}</span></div>
      <div class="r-timer">${timerChip(r)}</div>
      <div class="act-btns">${actions}</div>
    </div>`;
  }).join('');
}

/* ── PROFILE ─────────────────────────────────────────── */
function renderProfile() {
  const u   = State.currentUser;
  const myR = State.reports.filter(r => r.userId === u.id);
  const res = myR.filter(r => r.status === 'Resolved').length;
  const co2 = myR.reduce((s, r) => s + (r.co2||0), 0).toFixed(1);

  const profStats = [
    { lbl:'Reports', val:myR.length },
    { lbl:'Resolved', val:res },
    { lbl:'CO₂ Saved', val:`${co2}kg` },
  ].map(s => `<div class="ps-card"><div class="ps-val">${s.val}</div><div class="ps-lbl">${s.lbl}</div></div>`).join('');

  const badgePills = (u.badges||[]).length
    ? u.badges.map(b => `<span class="badge-pill">${badgeEmoji(b)} ${b}</span>`).join('')
    : '<span style="color:var(--text2);font-size:13px">No badges yet – keep reporting!</span>';

  const reportRows = myR.length
    ? myR.map(r => `
      <div class="rpt-row">
        <div class="rpt-info">
          <div class="rpt-title">${r.area} – ${r.wasteType}</div>
          <div class="rpt-sub">${r.description.slice(0,50)}</div>
          <div style="font-size:11px;color:#22c55e;margin-top:2px">🌱 ${r.co2}kg CO₂ prevented</div>
        </div>
        ${statusBadge(r)}
      </div>`).join('')
    : '<div style="color:var(--text2);font-size:13px">No reports yet</div>';

  const html = `<div class="fade-in" style="max-width:600px;margin:0 auto">
    <div class="prof-hero">
      <div class="avatar avatar-lg" style="margin:0 auto">${u.name[0]}</div>
      <h2>${u.name}</h2>
      <div class="ph-email">${u.email} · ${u.role}</div>
      <div class="ph-pts">⭐ ${u.points} points</div>
    </div>
    <div class="prof-stats">${profStats}</div>
    <div class="sec-card" style="margin-bottom:16px">
      <div class="sec-title">🏅 Badges</div>
      <div style="display:flex;flex-wrap:wrap;gap:8px">${badgePills}</div>
    </div>
    <div class="sec-card" style="margin-bottom:16px" id="prof-ngo-section">
      <div class="sec-title">🤝 My NGOs</div>
      <div id="prof-ngo-list"><div style="color:var(--text2);font-size:13px">Loading...</div></div>
    </div>
    <div class="sec-card"><div class="sec-title">📋 My Reports</div>${reportRows}</div>
  </div>`;

  // Async-load joined NGOs after render
  setTimeout(async () => {
    const el = document.getElementById('prof-ngo-list');
    if (!el) return;
    try {
      const res = await api('GET', `/my-ngos?userId=${u.id}`);
      if (!res.success || !res.ngos.length) {
        el.innerHTML = `<div style="color:var(--text2);font-size:13px">You haven't joined any NGO yet. <a href="#" onclick="goPage('ngo-support')" style="color:var(--primary);text-decoration:none;font-weight:600">Browse NGOs →</a></div>`;
        return;
      }
      el.innerHTML = res.ngos.map(n => `
        <div style="display:flex;align-items:center;gap:14px;padding:12px 0;border-bottom:1px solid var(--border,#e5e7eb);last-child:border-bottom:none">
          <div style="font-size:2rem;min-width:44px;text-align:center;background:var(--bg2,#f3f4f6);border-radius:12px;padding:6px">${n.logo}</div>
          <div style="flex:1;min-width:0">
            <div style="font-weight:700;font-size:14px;color:var(--text1,#111)">${n.name}</div>
            <div style="font-size:12px;color:var(--text2,#6b7280);margin-top:2px">📍 ${n.location}</div>
            <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:5px">
              ${n.category ? `<span style="background:#dcfce7;color:#15803d;font-size:11px;padding:2px 8px;border-radius:20px;font-weight:600">${n.category}</span>` : ''}
              <span style="background:#f0fdf4;color:#16a34a;font-size:11px;padding:2px 8px;border-radius:20px">✅ Active Volunteer</span>
            </div>
          </div>
          <div style="text-align:right;font-size:11px;color:var(--text2,#9ca3af);white-space:nowrap">
            Joined<br><strong>${new Date(n.joinedAt).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}</strong>
          </div>
        </div>`).join('');
    } catch(e) {
      el.innerHTML = '<div style="color:var(--text2);font-size:13px">Could not load NGOs.</div>';
    }
  }, 0);

  return html;
}

/* ══════════════════════════════════════════════════════
   NGO SUPPORT PAGE
══════════════════════════════════════════════════════ */
function renderNGOSupport() {
  return `<div class="fade-in" id="ngo-page">
    <!-- Hero -->
    <div class="ngo-hero">
      <div class="ngo-hero-bg">
        <div class="ngo-orb ngo-orb1"></div>
        <div class="ngo-orb ngo-orb2"></div>
      </div>
      <div class="ngo-hero-content">
        <div class="ngo-hero-badge">🌍 Community Impact</div>
        <h1 class="ngo-hero-title">Support Clean City Movement</h1>
        <p class="ngo-hero-sub">Join NGOs or Donate to Make a Real Impact</p>
        <div class="ngo-hero-btns">
          <button class="btn btn-primary btn-lg" onclick="scrollToSection('ngo-listing')">🤝 Join as Volunteer</button>
          <button class="btn btn-outline btn-lg" onclick="scrollToSection('donation-section')">💚 Donate Now</button>
        </div>
        <div class="ngo-hero-stats">
          <div class="ngo-hstat"><span id="hstat-volunteers">—</span><small>Volunteers</small></div>
          <div class="ngo-hstat"><span id="hstat-waste">—</span><small>Kg Waste Cleaned</small></div>
          <div class="ngo-hstat"><span id="hstat-ngos">—</span><small>Partner NGOs</small></div>
        </div>
      </div>
    </div>

    <!-- NGO Listing -->
    <div id="ngo-listing" class="ngo-section">
      <div class="ngo-section-header">
        <h2>🏢 Partner NGOs</h2>
        <p>Choose an organization to support or volunteer with</p>
      </div>
      <div id="ngo-cards-grid" class="ngo-cards-grid">
        <div class="ngo-loading">
          <div class="ngo-spinner"></div>
          <p>Loading NGOs...</p>
        </div>
      </div>
    </div>

    <!-- Donation Section -->
    <div id="donation-section" class="ngo-section ngo-section-alt">
      <div class="ngo-section-header">
        <h2>💳 Make a Donation</h2>
        <p>Every rupee counts towards a cleaner city</p>
      </div>
      <div class="donation-layout">
        <div class="donation-form-card">
          <div class="field-group">
            <label>Select NGO</label>
            <select id="don-ngo-select" class="ngo-select">
              <option value="">Loading NGOs...</option>
            </select>
          </div>
          <div id="don-impact-preview" class="don-impact-preview hidden">
            <span id="don-impact-text">Your donation will make an impact!</span>
          </div>
          <div class="field-group">
            <label>Donation Amount (₹)</label>
            <div class="quick-amounts">
              <button class="quick-amt" data-amt="100">₹100</button>
              <button class="quick-amt" data-amt="500">₹500</button>
              <button class="quick-amt" data-amt="1000">₹1,000</button>
              <button class="quick-amt" data-amt="custom">Custom</button>
            </div>
            <input type="number" id="don-amount" class="ngo-input" placeholder="Enter amount in ₹" min="1" />
          </div>
          <div class="field-group">
            <label>Your Name</label>
            <input type="text" id="don-name" class="ngo-input" placeholder="Full name (or leave blank for anonymous)" />
          </div>
          <div class="field-group">
            <label>Email (for receipt)</label>
            <input type="email" id="don-email" class="ngo-input" placeholder="your@email.com" />
          </div>
          <div class="field-group">
            <label>Payment Method</label>
            <div class="payment-methods">
              <label class="pm-option active" data-method="razorpay">
                <input type="radio" name="paymethod" value="razorpay" checked />
                <span>🔶 Razorpay</span>
              </label>
              <label class="pm-option" data-method="stripe">
                <input type="radio" name="paymethod" value="stripe" />
                <span>💳 Stripe</span>
              </label>
              <label class="pm-option" data-method="upi">
                <input type="radio" name="paymethod" value="upi" />
                <span>📱 UPI</span>
              </label>
            </div>
          </div>
          <div class="sandbox-badge">🔒 Sandbox Mode – No real payment charged</div>
          <button class="btn btn-primary btn-full" id="donate-btn" onclick="submitDonation()">
            💚 Donate Now
          </button>
          <div id="don-msg" class="ngo-msg hidden"></div>
        </div>
        <div class="donation-info-card">
          <div class="impact-info">
            <h3>🌍 Your Impact</h3>
            <div class="impact-rows">
              <div class="impact-row">
                <span class="impact-icon">♻️</span>
                <div><strong>₹100</strong> helps clean <strong>4kg</strong> of waste</div>
              </div>
              <div class="impact-row">
                <span class="impact-icon">🧹</span>
                <div><strong>₹500</strong> helps clean <strong>20kg</strong> of waste</div>
              </div>
              <div class="impact-row">
                <span class="impact-icon">🏗️</span>
                <div><strong>₹1000</strong> helps clean <strong>40kg</strong> of waste</div>
              </div>
              <div class="impact-row">
                <span class="impact-icon">⭐</span>
                <div>Earn <strong>1 point</strong> per ₹10 donated</div>
              </div>
            </div>
          </div>
          <div class="my-donations-panel">
            <h3>📜 My Donations</h3>
            <div id="my-donations-list">
              <div style="color:var(--text2);font-size:13px;text-align:center;padding:16px">Loading...</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Volunteer Modal -->
    <div id="vol-modal" class="ngo-modal hidden">
      <div class="ngo-modal-overlay" onclick="closeVolModal()"></div>
      <div class="ngo-modal-box">
        <div class="ngo-modal-header">
          <div>
            <h3 id="vol-modal-title">Join NGO</h3>
            <p id="vol-modal-subtitle" style="color:var(--text2);font-size:13px;margin:4px 0 0">Fill in your details to volunteer</p>
          </div>
          <button class="icon-btn" onclick="closeVolModal()">
            <svg viewBox="0 0 24 24" width="20" height="20"><path d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
        <div id="vol-form-content">
          <div class="two-col">
            <div class="field-group">
              <label>Full Name *</label>
              <input type="text" id="vol-name" class="ngo-input" placeholder="Your full name" />
            </div>
            <div class="field-group">
              <label>Email *</label>
              <input type="email" id="vol-email" class="ngo-input" placeholder="you@email.com" />
            </div>
          </div>
          <div class="two-col">
            <div class="field-group">
              <label>Phone *</label>
              <input type="tel" id="vol-phone" class="ngo-input" placeholder="+91 XXXXX XXXXX" />
            </div>
            <div class="field-group">
              <label>City *</label>
              <input type="text" id="vol-city" class="ngo-input" placeholder="Your city" />
            </div>
          </div>
          <div class="two-col">
            <div class="field-group">
              <label>Primary Skills *</label>
              <select id="vol-skills" class="ngo-select">
                <option value="">Select skill</option>
                <option value="field-work">🌾 Field Work</option>
                <option value="social-media">📱 Social Media</option>
                <option value="tech-support">💻 Tech Support</option>
                <option value="fundraising">💰 Fundraising</option>
                <option value="data-entry">📊 Data Entry</option>
                <option value="event-management">🎪 Event Management</option>
                <option value="photography">📷 Photography</option>
                <option value="teaching">🎓 Teaching / Awareness</option>
              </select>
            </div>
            <div class="field-group">
              <label>Availability *</label>
              <select id="vol-avail" class="ngo-select">
                <option value="">Select availability</option>
                <option value="weekends">📅 Weekends Only</option>
                <option value="full-time">🕐 Full Time</option>
                <option value="remote">🏠 Remote / Online</option>
                <option value="flexible">🔄 Flexible</option>
              </select>
            </div>
          </div>
          <div id="vol-msg" class="ngo-msg hidden"></div>
          <div class="vol-modal-footer">
            <button class="btn btn-outline" onclick="closeVolModal()">Cancel</button>
            <button class="btn btn-primary" id="vol-submit-btn" onclick="submitVolunteer()">🤝 Join NGO</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Donation Receipt Modal -->
    <div id="receipt-modal" class="ngo-modal hidden">
      <div class="ngo-modal-overlay" onclick="closeReceiptModal()"></div>
      <div class="ngo-modal-box ngo-modal-sm">
        <div id="receipt-content"></div>
      </div>
    </div>
  </div>`;
}
