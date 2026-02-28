/* ═══════════════════════════════════════════════════════
   constants.js — App-wide constants & utility functions
═══════════════════════════════════════════════════════ */
'use strict';

const WASTE_TYPES  = ['Plastic', 'Organic', 'E-Waste', 'Construction'];
const AREAS        = ['Durg Bit – 21.190400, 81.284900','Nehru Nagar – 21.206657, 81.326699','Supela – 21.206651, 81.349166','Teli Banda – 21.240740, 81.660729','Kali Badi – 21.231303, 81.639805','Maha DevGhat – 21.231716, 81.602416'];
const STATUSES     = ['Pending','In Progress','Resolved','Escalated'];
const CO2_MAP      = { Plastic:1.2, Organic:2.0, 'E-Waste':0.8, Construction:1.5 };
const WASTE_COLORS = { Plastic:'#3b82f6', Organic:'#22c55e', 'E-Waste':'#a855f7', Construction:'#f59e0b' };

const GMAP_DARK_STYLE = [
  {elementType:'geometry',stylers:[{color:'#1a1f2e'}]},
  {elementType:'labels.text.stroke',stylers:[{color:'#1a1f2e'}]},
  {elementType:'labels.text.fill',stylers:[{color:'#746855'}]},
  {featureType:'road',elementType:'geometry',stylers:[{color:'#2c3148'}]},
  {featureType:'road',elementType:'geometry.stroke',stylers:[{color:'#212a37'}]},
  {featureType:'water',elementType:'geometry',stylers:[{color:'#0e1626'}]},
  {featureType:'water',elementType:'labels.text.fill',stylers:[{color:'#515c6d'}]}
];

function hoursAgo(d) { return (Date.now() - new Date(d).getTime()) / 3_600_000; }

function escalLevel(r) {
  if (r.status === 'Resolved') return 'none';
  const h = hoursAgo(r.createdAt);
  if (h >= 72) return 'escalated';
  if (h >= 48) return 'red';
  if (h >= 24) return 'yellow';
  return 'normal';
}

function timeLeft(r) {
  if (r.status === 'Resolved') return '✅ Resolved';
  const h = hoursAgo(r.createdAt);
  if (h >= 72) return 'Escalated';
  const rem = 72 - h;
  return `${Math.floor(rem)}h ${Math.floor((rem % 1) * 60)}m left`;
}

function areaScore(area, reports) {
  const ar   = reports.filter(r => r.area === area);
  if (!ar.length) return 90;
  const pend = ar.filter(r => r.status === 'Pending' || r.status === 'Escalated').length;
  const res  = ar.filter(r => r.status === 'Resolved').length;
  return Math.max(0, Math.min(100, Math.round(70 + (res / ar.length) * 30 - pend * 8)));
}

function scoreColor(s) { return s >= 70 ? '#22c55e' : s >= 40 ? '#f59e0b' : '#ef4444'; }
function scoreLabel(s) { return s >= 70 ? '🟢 Clean' : s >= 40 ? '🟡 Moderate' : '🔴 Needs Attention'; }

function detectWaste(desc) {
  const d = desc.toLowerCase();
  if (/electronic|monitor|battery|cable|phone|circuit|laptop/.test(d)) return 'E-Waste';
  if (/food|organic|vegetable|decompos|fruit|compost/.test(d))         return 'Organic';
  if (/sand|rubble|brick|cement|debris|construction|concrete/.test(d)) return 'Construction';
  return 'Plastic';
}

function badgeEmoji(b) {
  return { 'Clean Hero': '🏆', 'Eco Warrior': '🌿', 'Street Guardian': '🛡️' }[b] || '⭐';
}

function statusBadge(r) {
  const lvl = escalLevel(r);
  let cls = { Resolved:'b-resolved', 'In Progress':'b-progress', Pending:'b-pending', Escalated:'b-escalated' }[r.status] || 'b-pending';
  if ((lvl === 'red' || lvl === 'escalated') && r.status !== 'Resolved') cls = 'b-escalated';
  return `<span class="badge ${cls}">${r.status}</span>`;
}

function timerChip(r) {
  const lvl = escalLevel(r), t = timeLeft(r);
  let col = 'var(--text2)', bg = 'var(--inp)';
  if (lvl === 'red' || lvl === 'escalated') { col = '#ef4444'; bg = 'rgba(239,68,68,.12)'; }
  else if (lvl === 'yellow')                { col = '#f59e0b'; bg = 'rgba(245,158,11,.12)'; }
  return `<span class="tmr-chip" style="color:${col};background:${bg}">${t}</span>`;
}

// DOM helpers
const $  = (s, ctx = document) => ctx.querySelector(s);
const $$ = (s, ctx = document) => [...ctx.querySelectorAll(s)];

// Notification toast
let _nTimer;
function notify(msg, type = 'success') {
  let el = document.getElementById('notif');
  if (!el) { el = document.createElement('div'); el.id = 'notif'; document.body.appendChild(el); }
  el.textContent = msg;
  el.className   = `notif ${type}`;
  clearTimeout(_nTimer);
  _nTimer = setTimeout(() => el.remove(), 3500);
}

/* ══════════════════════════════════════════════════════
   LOCAL DB — runs entirely in browser via localStorage
   No backend needed. Falls back to real API if available.
══════════════════════════════════════════════════════ */

const LocalDB = {
  _key: 'cc_db',
  _ngo_version: 2,  // bump this whenever NGO seed data changes
  get() {
    try {
      const raw = localStorage.getItem(this._key);
      if (!raw) return this._seed();
      const db = JSON.parse(raw);
      // Migration: inject NGOs if missing from existing stored DB
      if (!db.ngos || db.ngos.length === 0) {
        db.ngos = this._seed().ngos;
        db.ngo_volunteers = db.ngo_volunteers || [];
        db.ngo_donations  = db.ngo_donations  || [];
        db._ngo_version = this._ngo_version;
        this.save(db);
      }
      // Version-based migration: merge in any new seed NGOs not yet in stored DB
      if (!db._ngo_version || db._ngo_version < this._ngo_version) {
        const seedNgos = this._seed().ngos;
        const existingIds = new Set((db.ngos || []).map(n => n.id));
        const newNgos = seedNgos.filter(n => !existingIds.has(n.id));
        if (newNgos.length > 0) {
          db.ngos = [...(db.ngos || []), ...newNgos];
        }
        db._ngo_version = this._ngo_version;
        this.save(db);
      }
      return db;
    } catch { return this._seed(); }
  },
  save(db) {
    localStorage.setItem(this._key, JSON.stringify(db));
  },
  _seed() {
    const db = {
      users: [
        { id: 'u001', name: 'Arjun Sharma', email: 'arjun@demo.com', password: 'demo123', role: 'citizen', points: 520, total_earned_points: 520, badges: ['Eco Warrior'], adoptedStreet: null, milestone_status: 'unlocked' },
        { id: 'u002', name: 'Priya Patel', email: 'priya@demo.com', password: 'demo123', role: 'citizen', points: 380, total_earned_points: 380, badges: [], adoptedStreet: 'MG Road', milestone_status: 'locked' },
        { id: 'u003', name: 'Admin User', email: 'admin@demo.com', password: 'admin123', role: 'admin', points: 1200, total_earned_points: 1200, badges: ['Clean Hero'], adoptedStreet: null, milestone_status: 'unlocked' },
        { id: 'u004', name: 'Karan Mehta', email: 'karan@demo.com', password: 'demo123', role: 'citizen', points: 210, total_earned_points: 210, badges: [], adoptedStreet: null, milestone_status: 'locked' },
        { id: 'u005', name: 'Neha Singh', email: 'neha@demo.com', password: 'demo123', role: 'citizen', points: 95, total_earned_points: 95, badges: [], adoptedStreet: null, milestone_status: 'locked' },
      ],
      reports: [
        { id: 'r001', userId: 'u001', userName: 'Arjun Sharma', area: 'Durg Bit – 21.190400, 81.284900', wasteType: 'Plastic', description: 'Large pile of plastic bottles near the park entrance', lat: 21.190400, lng: 81.284900, imageUrl: '', co2: 1.2, status: 'Pending', createdAt: new Date(Date.now() - 3600000 * 5).toISOString(), resolvedAt: null },
        { id: 'r002', userId: 'u002', userName: 'Priya Patel', area: 'Nehru Nagar – 21.206657, 81.326699', wasteType: 'Organic', description: 'Food waste dumped on roadside, attracting stray animals', lat: 21.206657, lng: 81.326699, imageUrl: '', co2: 2.0, status: 'In Progress', createdAt: new Date(Date.now() - 3600000 * 28).toISOString(), resolvedAt: null },
        { id: 'r003', userId: 'u004', userName: 'Karan Mehta', area: 'Supela – 21.206651, 81.349166', wasteType: 'E-Waste', description: 'Old electronics dumped behind shopping complex', lat: 21.206651, lng: 81.349166, imageUrl: '', co2: 0.8, status: 'Resolved', createdAt: new Date(Date.now() - 3600000 * 72).toISOString(), resolvedAt: new Date().toISOString() },
        { id: 'r004', userId: 'u005', userName: 'Neha Singh', area: 'Kali Badi – 21.231303, 81.639805', wasteType: 'Construction', description: 'Rubble from demolished building blocking footpath', lat: 21.231303, lng: 81.639805, imageUrl: '', co2: 1.5, status: 'Escalated', createdAt: new Date(Date.now() - 3600000 * 80).toISOString(), resolvedAt: null },
        { id: 'r005', userId: 'u001', userName: 'Arjun Sharma', area: 'Maha DevGhat – 21.231716, 81.602416', wasteType: 'Plastic', description: 'Plastic bags floating in the river near the ghat', lat: 21.231716, lng: 81.602416, imageUrl: '', co2: 1.2, status: 'Pending', createdAt: new Date(Date.now() - 3600000 * 2).toISOString(), resolvedAt: null },
      ],
      coupons: [],
      points_history: [],
      ngos: [
        {
          id: 'ngo1', name: 'GreenEarth Foundation', logo: '🌱',
          description: 'Dedicated to urban waste management and community-driven cleanliness drives across Bhopal and surrounding areas.',
          location: 'Bhopal, MP', activeProjects: 8, totalWasteCollected: 12400, volunteers: 345,
          causes: ['Urban Cleanliness', 'Recycling Awareness', 'River Clean-up'],
          category: 'Urban Cleanliness', contactEmail: 'greenearth@ngo.org', established: '2015', verified: true
        },
        {
          id: 'ngo2', name: 'CleanStreets Initiative', logo: '🛣️',
          description: 'Focusing on street-level cleanliness in residential zones with weekly drives and youth engagement programs.',
          location: 'Indore, MP', activeProjects: 5, totalWasteCollected: 8750, volunteers: 210,
          causes: ['Street Cleanliness', 'Youth Engagement', 'Plastic-Free Zones'],
          category: 'Urban Cleanliness', contactEmail: 'cleanstreets@ngo.org', established: '2018', verified: true
        },
        {
          id: 'ngo3', name: 'Harit Bhumi Trust', logo: '🌿',
          description: 'Working on sustainable waste processing, composting, and awareness campaigns in rural and semi-urban areas.',
          location: 'Jabalpur, MP', activeProjects: 6, totalWasteCollected: 9200, volunteers: 180,
          causes: ['Composting', 'Rural Sanitation', 'Awareness Campaigns'],
          category: 'Rural Sanitation', contactEmail: 'haritbhumi@ngo.org', established: '2016', verified: true
        },
        {
          id: 'ngo4', name: 'Blue Planet Warriors', logo: '💧',
          description: 'Protecting water bodies from plastic pollution through lakeside and riverside clean-up missions.',
          location: 'Bhopal, MP', activeProjects: 4, totalWasteCollected: 6800, volunteers: 155,
          causes: ['Water Body Clean-up', 'Anti-Plastic', 'Eco-Tourism'],
          category: 'Water Conservation', contactEmail: 'blueplanet@ngo.org', established: '2019', verified: true
        },
        {
          id: 'ngo5', name: 'Adar Poonawalla Clean City Initiative', logo: '🏙️',
          description: 'A cleanliness and sanitation initiative supporting urban waste management, public hygiene awareness, and sustainable city development aligned with national Swachh Bharat goals.',
          location: 'Multiple Indian Cities', activeProjects: 25, totalWasteCollected: 15000, volunteers: 1200,
          causes: ['Waste Management', 'Urban Sanitation', 'Public Awareness'],
          category: 'Cleanliness & Sanitation', contactEmail: 'info@cleanpoonawalla.org', established: '2014', verified: true
        },
        {
          id: 'ngo6', name: 'Environmentalist Foundation of India', logo: '🌊',
          description: 'A non-profit organization focused on ecological restoration, water body rejuvenation, wildlife conservation, and environmental education across India.',
          location: 'Pan India', activeProjects: 40, totalWasteCollected: 20000, volunteers: 2500,
          causes: ['Lake Restoration', 'Biodiversity', 'Environmental Education'],
          category: 'Environment Conservation', contactEmail: 'connect@efi.org.in', established: '2010', verified: true
        },
        {
          id: 'ngo7', name: 'Tarun Bharat Sangh', logo: '🏞️',
          description: 'A grassroots organization dedicated to water conservation, river rejuvenation, rural development, and sustainable environmental practices in Rajasthan and North India.',
          location: 'Rajasthan & North India', activeProjects: 18, totalWasteCollected: 8000, volunteers: 900,
          causes: ['Water Conservation', 'River Rejuvenation', 'Rural Sustainability'],
          category: 'Water & Rural Development', contactEmail: 'info@tarunbharatsangh.org', established: '1975', verified: true
        }
      ],
      ngo_volunteers: [],
      ngo_donations: [],
    };
    this.save(db);
    return db;
  }
};

/* ── MOCK API ROUTER ──────────────────────────────────── */
function genId(prefix = '') { return prefix + Math.random().toString(36).slice(2, 10); }

async function api(method, endpoint, body) {
  // Small artificial delay for realism
  await new Promise(r => setTimeout(r, 80));

  const db = LocalDB.get();

  // ── AUTH ────────────────────────────────────────────
  if (method === 'POST' && endpoint === '/auth/login') {
    const user = db.users.find(u => u.email === body.email && u.password === body.password);
    if (!user) return { success: false, message: 'Invalid email or password' };
    const { password: _, ...safe } = user;
    const coupons = (db.coupons || []).filter(c => c.userId === user.id);
    return { success: true, user: { ...safe, coupons } };
  }

  if (method === 'POST' && endpoint === '/auth/signup') {
    if (db.users.find(u => u.email === body.email))
      return { success: false, message: 'Email already registered' };
    const newUser = {
      id: genId('u'), name: body.name, email: body.email, password: body.password,
      role: 'citizen', points: 0, total_earned_points: 0,
      badges: [], adoptedStreet: null, milestone_status: 'locked'
    };
    db.users.push(newUser);
    LocalDB.save(db);
    const { password: _, ...safe } = newUser;
    return { success: true, user: { ...safe, coupons: [] } };
  }

  // ── REPORTS ─────────────────────────────────────────
  if (method === 'GET' && endpoint === '/reports') {
    return { success: true, reports: db.reports };
  }

  if (method === 'POST' && endpoint === '/reports') {
    const user = db.users.find(u => u.id === body.userId);
    const report = {
      id: genId('r'), ...body, status: 'Pending',
      createdAt: new Date().toISOString(), resolvedAt: null
    };
    db.reports.unshift(report);
    const oldPoints = user ? user.points : 0;
    if (user) { user.points += 10; user.total_earned_points = (user.total_earned_points || 0) + 10; }
    const newPoints = user ? user.points : 0;
    const milestoneUnlocked = checkMilestoneUnlock(oldPoints, newPoints);
    if (milestoneUnlocked && user) user.milestone_status = 'unlocked';
    LocalDB.save(db);
    return { success: true, report, newPoints, milestoneUnlocked };
  }

  if (method === 'PATCH' && endpoint.startsWith('/reports/') && endpoint.endsWith('/status')) {
    const id = endpoint.split('/')[2];
    const report = db.reports.find(r => r.id === id);
    if (!report) return { success: false, message: 'Not found' };
    report.status = body.status;
    if (body.status === 'Resolved') {
      report.resolvedAt = new Date().toISOString();
      const user = db.users.find(u => u.id === report.userId);
      if (user) { user.points += 20; user.total_earned_points = (user.total_earned_points || 0) + 20; }
    }
    LocalDB.save(db);
    return { success: true, report };
  }

  // ── USERS ────────────────────────────────────────────
  if (method === 'GET' && endpoint === '/users') {
    return { success: true, users: db.users.map(({ password: _, ...u }) => u) };
  }

  if (method === 'PATCH' && endpoint.includes('/adopt')) {
    const id = endpoint.split('/')[2];
    const user = db.users.find(u => u.id === id);
    if (user) { user.adoptedStreet = body.street; LocalDB.save(db); }
    return { success: true };
  }

  if (method === 'POST' && endpoint.includes('/points')) {
    const id = endpoint.split('/')[2];
    const user = db.users.find(u => u.id === id);
    if (!user) return { success: false, message: 'User not found' };
    const oldPoints = user.points;
    user.points += body.points;
    user.total_earned_points = (user.total_earned_points || 0) + body.points;
    const milestoneUnlocked = checkMilestoneUnlock(oldPoints, user.points);
    if (milestoneUnlocked) user.milestone_status = 'unlocked';
    LocalDB.save(db);
    return { success: true, newPoints: user.points, milestoneUnlocked, user: { points: user.points, total_earned_points: user.total_earned_points } };
  }

  // ── REWARDS ──────────────────────────────────────────
  if (method === 'GET' && endpoint.startsWith('/rewards/')) {
    const userId = endpoint.split('/')[2];
    const user = db.users.find(u => u.id === userId);
    if (!user) return { success: false };
    const allCoupons = (db.coupons || []).filter(c => c.userId === userId);
    const now = new Date();
    const activeCoupons = allCoupons.filter(c => !c.used && new Date(c.expiresAt) > now);
    const activeCoupon = activeCoupons[0] || null;
    const tier = user.total_earned_points >= 2000 ? 'Platinum' : user.total_earned_points >= 1000 ? 'Gold' : user.total_earned_points >= 500 ? 'Silver' : 'None';
    return { success: true, points: user.points, total_earned_points: user.total_earned_points, milestone_status: user.milestone_status, tier, coupons: allCoupons, active_coupon: activeCoupon, active_coupons: activeCoupons, all_coupons: allCoupons };
  }

  if (method === 'POST' && endpoint === '/rewards/redeem') {
    const { userId, brand } = body;
    const user = db.users.find(u => u.id === userId);
    if (!user) return { success: false, message: 'User not found' };
    if (user.points < 500) return { success: false, message: 'Insufficient points' };
    const activeCoupons = (db.coupons || []).filter(c => c.userId === userId && !c.used && new Date(c.expiresAt) > new Date());
    if (activeCoupons.length >= 3) return { success: false, message: 'You can hold up to 3 active coupons at a time. Please use one before generating more.' };

    const tier = user.total_earned_points >= 2000 ? 'Platinum' : user.total_earned_points >= 1000 ? 'Gold' : 'Silver';
    const milestone = user.total_earned_points >= 2000 ? 2000 : user.total_earned_points >= 1000 ? 1000 : 500;
    const discountRanges = { Silver: [30,40], Gold: [40,55], Platinum: [55,70] };
    const [min,max] = discountRanges[tier];
    const discount_pct = Math.floor(Math.random() * (max - min + 1)) + min;
    const prefix = brand.slice(0,3).toUpperCase();
    const code = `${prefix}${discount_pct}OFF${Math.random().toString(36).slice(2,8).toUpperCase()}`;
    const expiresAt = new Date(Date.now() + 10 * 86400000).toISOString();

    const coupon = { id: genId('c'), userId, userName: user.name, brand, code, discount_pct, tier, milestone, used: false, expiresAt, createdAt: new Date().toISOString(), hash: Math.random().toString(36).slice(2,12).toUpperCase() };
    if (!db.coupons) db.coupons = [];
    db.coupons.push(coupon);
    user.points -= milestone;
    if (!user.total_earned_points) user.total_earned_points = user.points + milestone;
    user.milestone_status = 'redeemed';
    LocalDB.save(db);
    return { success: true, coupon, remainingPoints: user.points };
  }

  if (method === 'PATCH' && endpoint.includes('/coupon/') && endpoint.includes('/use')) {
    const id = endpoint.split('/')[3];
    const coupon = (db.coupons || []).find(c => c.id === id);
    if (!coupon) return { success: false, message: 'Coupon not found' };
    coupon.used = true;
    LocalDB.save(db);
    return { success: true };
  }

  // ── ADMIN ────────────────────────────────────────────
  if (method === 'GET' && endpoint === '/admin/coupons') {
    const coupons = db.coupons || [];
    const now = new Date();
    const active = coupons.filter(c => !c.used && new Date(c.expiresAt) > now).length;
    const used = coupons.filter(c => c.used).length;
    const avgDiscount = coupons.length ? Math.round(coupons.reduce((s,c) => s + c.discount_pct, 0) / coupons.length) : 0;
    return { success: true, stats: { total: coupons.length, active, used, avgDiscount }, coupons: coupons.slice(-10).reverse() };
  }

  if (method === 'GET' && endpoint === '/admin/leaderboard') {
    const leaderboard = db.users
      .map(({ password: _, ...u }) => ({
        ...u,
        rptCount: db.reports.filter(r => r.userId === u.id).length,
        couponCount: (db.coupons || []).filter(c => c.userId === u.id).length
      }))
      .sort((a,b) => (b.total_earned_points||b.points) - (a.total_earned_points||a.points))
      .slice(0,20);
    return { success: true, leaderboard };
  }

  if (method === 'GET' && endpoint.startsWith('/points-history/')) {
    return { success: true, history: [] };
  }

  // ── NGOs ─────────────────────────────────────────────
  if (method === 'GET' && endpoint === '/ngos') {
    const ngos = (db.ngos || []).map(ngo => ({
      ...ngo,
      volunteerCount: (db.ngo_volunteers || []).filter(v => v.ngoId === ngo.id).length,
      donationTotal:  (db.ngo_donations  || []).filter(d => d.ngoId === ngo.id).reduce((s,d) => s + d.amount, 0)
    }));
    return { success: true, ngos };
  }

  if (method === "GET" && endpoint.match(/^\/my-ngos/)) {
    const userId = new URLSearchParams(endpoint.split("?")[1] || "").get("userId");
    const myVolEntries = (db.ngo_volunteers || []).filter(v => v.userId === userId);
    const myNgos = myVolEntries.map(v => {
      const ngo = (db.ngos || []).find(n => n.id === v.ngoId);
      return ngo ? { ...ngo, joinedAt: v.joinedAt } : null;
    }).filter(Boolean);
    return { success: true, ngos: myNgos };
  }

  if (method === 'POST' && endpoint.match(/^\/ngos\/[^/]+\/volunteer$/)) {
    const ngoId = endpoint.split('/')[2];
    const ngo = (db.ngos || []).find(n => n.id === ngoId);
    if (!ngo) return { success: false, message: 'NGO not found' };
    if (!db.ngo_volunteers) db.ngo_volunteers = [];
    const existing = db.ngo_volunteers.find(v => v.ngoId === ngoId && v.userId === body.userId);
    if (existing) return { success: false, message: 'You have already joined this NGO' };
    const entry = { id: genId('vol'), ngoId, userId: body.userId, name: body.name, email: body.email, phone: body.phone || '', joinedAt: new Date().toISOString() };
    db.ngo_volunteers.push(entry);
    // Award 15 points for joining
    const user = db.users.find(u => u.id === body.userId);
    if (user) { user.points += 15; user.total_earned_points = (user.total_earned_points || 0) + 15; }
    LocalDB.save(db);
    return { success: true, volunteer: entry, newPoints: user ? user.points : 0 };
  }

  // ── MY DONATIONS ─────────────────────────────────────
  if (method === 'GET' && endpoint.startsWith('/donations/')) {
    const userId = endpoint.split('/')[2];
    const allDonations = (db.ngo_donations || []).filter(d => d.userId === userId);
    // Enrich each donation with ngoName if missing
    const enriched = allDonations.map(d => ({
      ...d,
      ngoName: d.ngoName || (db.ngos || []).find(n => n.id === d.ngoId)?.name || 'NGO',
    })).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return { success: true, donations: enriched };
  }

  if (method === 'POST' && endpoint.match(/^\/ngos\/[^/]+\/donate$/)) {
    const ngoId = endpoint.split('/')[2];
    const ngo = (db.ngos || []).find(n => n.id === ngoId);
    if (!ngo) return { success: false, message: 'NGO not found' };
    if (!db.ngo_donations) db.ngo_donations = [];
    const txnId = 'TXN' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2,6).toUpperCase();
    const receiptNo = 'RCP' + Math.floor(100000 + Math.random() * 900000);
    const donation = { id: genId('don'), ngoId, ngoName: ngo.name, userId: body.userId, donorName: body.donorName || 'Anonymous', donorEmail: body.donorEmail || '', amount: body.amount, method: body.paymentMethod || 'UPI', txnId, receiptNo, status: 'success', createdAt: new Date().toISOString() };
    db.ngo_donations.push(donation);
    // Award 1 point per ₹10 donated
    const pts = Math.floor(body.amount / 10);
    const user = db.users.find(u => u.id === body.userId);
    if (user && pts > 0) { user.points += pts; user.total_earned_points = (user.total_earned_points || 0) + pts; }
    LocalDB.save(db);
    const kgWaste = Math.round(body.amount / 2.5);
    const impactMessage = `🌿 Your ₹${body.amount} donation will help clean approx. <strong>${kgWaste}kg</strong> of waste from our city!`;
    const receipt = { receiptNo, txnId, ngoName: ngo.name, amount: body.amount, method: body.paymentMethod || 'UPI', date: new Date().toISOString(), donorName: body.donorName || 'Anonymous', pointsEarned: pts };
    return { success: true, donation, receipt, impactMessage, newPoints: user ? user.points : 0, pointsEarned: pts };
  }

  // Unknown endpoint
  console.warn('Unhandled API:', method, endpoint);
  return { success: false, message: 'Not implemented' };
}

function checkMilestoneUnlock(oldPts, newPts) {
  for (const m of [500, 1000, 2000]) {
    if (oldPts < m && newPts >= m) return m;
  }
  return null;
}
