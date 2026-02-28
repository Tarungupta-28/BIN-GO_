/**
 * 🌿BIN-GO — server.js
 * Node.js + Express | Database: parkease-db.json
 * Enhanced with Reward Milestone & Coupon Redemption System
 */
const express = require('express');
const cors    = require('cors');
const path    = require('path');
const fs      = require('fs');
const crypto  = require('crypto');
const { v4: uuidv4 } = require('uuid');

const app     = express();
const PORT    = process.env.PORT || 4000;
const DB_PATH = path.join(__dirname, 'parkease-db.json');

app.use(cors());
app.use(express.json({ limit: '15mb' }));

// Serve frontend static files
app.use(express.static(path.join(__dirname, '..', 'frontend')));

/* ── DB helpers ─────────────────────────────────────── */
function readDB()       { return JSON.parse(fs.readFileSync(DB_PATH, 'utf8')); }
function writeDB(data)  { fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2)); }

/* ── REWARD HELPERS ─────────────────────────────────── */

const BRANDS = ['Myntra', 'Zara', 'Ajio', 'Trends'];

// Tier-based discount ranges
function getDiscountRange(totalPoints) {
  if (totalPoints >= 2000) return { min: 55, max: 70, tier: 'Platinum', milestone: 2000 };
  if (totalPoints >= 1000) return { min: 40, max: 55, tier: 'Gold',     milestone: 1000 };
  return                          { min: 30, max: 40, tier: 'Silver',   milestone: 500  };
}

// Next milestone for user
function getNextMilestone(points) {
  if (points < 500)  return 500;
  if (points < 1000) return 1000;
  if (points < 2000) return 2000;
  return null; // max tier unlocked
}

// Generate unique coupon code
function generateCouponCode(brand, discount) {
  const rand   = crypto.randomBytes(4).toString('hex').toUpperCase();
  const prefix = brand.slice(0, 3).toUpperCase();
  return `${prefix}${discount}OFF${rand}`;
}

// Secure hash for coupon validation
function hashCoupon(code, userId) {
  return crypto.createHmac('sha256', 'cleancity-secret-2024')
    .update(`${code}:${userId}`)
    .digest('hex').slice(0, 16);
}

// Add points history entry
function addPointsHistory(db, userId, points, reason, type) {
  if (!db.points_history) db.points_history = [];
  db.points_history.push({
    id: 'ph' + uuidv4().slice(0, 8),
    userId, points, reason, type,
    createdAt: new Date().toISOString()
  });
}

// Check if user just crossed a milestone
function checkMilestoneUnlock(user, oldPoints, newPoints) {
  const milestones = [500, 1000, 2000];
  for (const m of milestones) {
    if (oldPoints < m && newPoints >= m) return m;
  }
  return null;
}

/* ── AUTH ────────────────────────────────────────────── */
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  const db   = readDB();
  const user = db.users.find(u => u.email === email && u.password === password);
  if (!user) return res.status(401).json({ success: false, message: 'Invalid email or password' });
  const { password: _, ...safe } = user;
  // Include user's active coupons
  const userCoupons = (db.coupons || []).filter(c => c.userId === user.id);
  res.json({ success: true, user: { ...safe, coupons: userCoupons } });
});

app.post('/api/auth/signup', (req, res) => {
  const { name, email, password } = req.body;
  const db = readDB();
  if (db.users.find(u => u.email === email))
    return res.status(409).json({ success: false, message: 'Email already registered' });
  const newUser = {
    id: 'u' + uuidv4().slice(0, 8), name, email, password,
    role: 'citizen', points: 0, badges: [], adoptedStreet: null,
    milestone_status: 'locked', total_earned_points: 0
  };
  db.users.push(newUser);
  writeDB(db);
  const { password: _, ...safe } = newUser;
  res.json({ success: true, user: { ...safe, coupons: [] } });
});

/* ── REPORTS ─────────────────────────────────────────── */
app.get('/api/reports', (req, res) => {
  const db = readDB();
  res.json({ success: true, reports: db.reports });
});

app.post('/api/reports', (req, res) => {
  const { userId, userName, area, wasteType, description, lat, lng, imageUrl, co2 } = req.body;
  const db = readDB();
  const report = {
    id: 'r' + uuidv4().slice(0, 8), userId, userName, area, wasteType, description,
    lat: lat || 21.1904, lng: lng || 81.2849, imageUrl: imageUrl || '',
    co2: co2 || 1.2, status: 'Pending',
    createdAt: new Date().toISOString(), resolvedAt: null
  };
  db.reports.unshift(report);

  const user     = db.users.find(u => u.id === userId);
  const POINTS   = 10;
  const oldPts   = user ? user.points : 0;
  if (user) {
    user.points              += POINTS;
    user.total_earned_points  = (user.total_earned_points || 0) + POINTS;
    addPointsHistory(db, userId, POINTS, `Report submitted: ${area} (${wasteType})`, 'report');
  }
  const newPts  = user ? user.points : 0;
  const crossed = user ? checkMilestoneUnlock(user, oldPts, newPts) : null;
  if (crossed && user) user.milestone_status = 'unlocked';

  writeDB(db);
  res.json({ success: true, report, newPoints: newPts, milestoneUnlocked: crossed });
});

app.patch('/api/reports/:id/status', (req, res) => {
  const { status, adminId } = req.body;
  const db     = readDB();
  const report = db.reports.find(r => r.id === req.params.id);
  if (!report) return res.status(404).json({ success: false, message: 'Not found' });
  const wasResolved = status === 'Resolved' && report.status !== 'Resolved';
  report.status = status;
  if (status === 'Resolved') report.resolvedAt = new Date().toISOString();
  let milestoneUnlocked = null;
  if (wasResolved) {
    const user   = db.users.find(u => u.id === report.userId);
    const POINTS = 20;
    const oldPts = user ? user.points : 0;
    if (user) {
      user.points              += POINTS;
      user.total_earned_points  = (user.total_earned_points || 0) + POINTS;
      addPointsHistory(db, user.id, POINTS, `Complaint resolved: ${report.area}`, 'resolved');
      const crossed = checkMilestoneUnlock(user, oldPts, user.points);
      if (crossed) { user.milestone_status = 'unlocked'; milestoneUnlocked = crossed; }
    }
  }
  writeDB(db);
  res.json({ success: true, report, milestoneUnlocked });
});

/* ── USERS ───────────────────────────────────────────── */
app.get('/api/users', (req, res) => {
  const db = readDB();
  const users = db.users.map(({ password: _, ...u }) => ({
    ...u, rptCount: db.reports.filter(r => r.userId === u.id).length
  }));
  res.json({ success: true, users });
});

app.patch('/api/users/:id/adopt', (req, res) => {
  const { street } = req.body;
  const db   = readDB();
  const user = db.users.find(u => u.id === req.params.id);
  if (!user) return res.status(404).json({ success: false, message: 'Not found' });
  user.adoptedStreet = street;
  writeDB(db);
  const { password: _, ...safe } = user;
  res.json({ success: true, user: safe });
});

/* ── POINTS: Add manually (referrals, drives) ─────────── */
app.post('/api/users/:id/points', (req, res) => {
  const { points, reason, type } = req.body;
  if (!points || points <= 0) return res.status(400).json({ success: false, message: 'Invalid points' });
  const db   = readDB();
  const user = db.users.find(u => u.id === req.params.id);
  if (!user) return res.status(404).json({ success: false, message: 'User not found' });

  const oldPts = user.points;
  user.points              += points;
  user.total_earned_points  = (user.total_earned_points || 0) + points;
  addPointsHistory(db, user.id, points, reason || 'Points added', type || 'manual');

  const crossed = checkMilestoneUnlock(user, oldPts, user.points);
  if (crossed) user.milestone_status = 'unlocked';

  writeDB(db);
  const { password: _, ...safe } = user;
  res.json({ success: true, user: safe, milestoneUnlocked: crossed });
});

/* ── REWARDS: Get user reward status ─────────────────── */
app.get('/api/rewards/:userId', (req, res) => {
  const db   = readDB();
  const user = db.users.find(u => u.id === req.params.userId);
  if (!user) return res.status(404).json({ success: false, message: 'User not found' });

  const userCoupons  = (db.coupons || []).filter(c => c.userId === user.id);
  const activeCoupon = userCoupons.find(c => !c.used && new Date(c.expiresAt) > new Date());
  const milestone    = getNextMilestone(user.points);
  const range        = getDiscountRange(user.total_earned_points || user.points);

  res.json({
    success: true,
    points: user.points,
    total_earned: user.total_earned_points || user.points,
    milestone_status: user.milestone_status,
    next_milestone: milestone,
    tier: range.tier,
    discount_range: range,
    active_coupon: activeCoupon || null,
    all_coupons: userCoupons
  });
});

/* ── REWARDS: Generate coupon ─────────────────────────── */
app.post('/api/rewards/redeem', (req, res) => {
  const { userId, brand } = req.body;

  if (!BRANDS.includes(brand)) {
    return res.status(400).json({ success: false, message: 'Invalid brand selected' });
  }

  const db   = readDB();
  const user = db.users.find(u => u.id === userId);
  if (!user) return res.status(404).json({ success: false, message: 'User not found' });

  // Security: validate milestone
  if (user.points < 500) {
    return res.status(403).json({ success: false, message: 'Insufficient points. Need 500 to redeem.' });
  }

  // Check if user already has an active coupon
  const existing = (db.coupons || []).find(
    c => c.userId === userId && !c.used && new Date(c.expiresAt) > new Date()
  );
  if (existing) {
    return res.status(409).json({ success: false, message: 'You already have an active coupon!', coupon: existing });
  }

  // Determine tier & discount
  const range    = getDiscountRange(user.total_earned_points || user.points);
  const discount = Math.floor(Math.random() * (range.max - range.min + 1)) + range.min;
  const code     = generateCouponCode(brand, discount);
  const hash     = hashCoupon(code, userId);

  // Expiry: 7–15 days
  const expiryDays = Math.floor(Math.random() * 9) + 7;
  const expiresAt  = new Date(Date.now() + expiryDays * 86400000).toISOString();

  const coupon = {
    id:           'cpn' + uuidv4().slice(0, 8),
    userId,
    userName:     user.name,
    brand,
    code,
    hash,
    discount_pct: discount,
    tier:         range.tier,
    milestone:    range.milestone,
    used:         false,
    expiresAt,
    createdAt:    new Date().toISOString(),
    redeemedAt:   null
  };

  if (!db.coupons) db.coupons = [];
  db.coupons.push(coupon);

  // Deduct 500 points
  const deducted   = range.milestone;
  user.points     -= deducted;
  user.milestone_status = user.points >= 500 ? 'unlocked' : 'locked';

  addPointsHistory(db, userId, -deducted, `Coupon redeemed: ${brand} ${discount}% off`, 'redemption');

  // Log redemption
  if (!db.redemption_logs) db.redemption_logs = [];
  db.redemption_logs.push({
    id:        'log' + uuidv4().slice(0, 8),
    userId,
    userName:  user.name,
    couponId:  coupon.id,
    brand,
    discount,
    tier:      range.tier,
    pointsDeducted: deducted,
    createdAt: new Date().toISOString()
  });

  writeDB(db);
  res.json({ success: true, coupon, remainingPoints: user.points });
});

/* ── REWARDS: Mark coupon as used ─────────────────────── */
app.patch('/api/rewards/coupon/:id/use', (req, res) => {
  const { userId, hash } = req.body;
  const db     = readDB();
  const coupon = (db.coupons || []).find(c => c.id === req.params.id);
  if (!coupon) return res.status(404).json({ success: false, message: 'Coupon not found' });
  if (coupon.userId !== userId) return res.status(403).json({ success: false, message: 'Unauthorized' });
  if (coupon.used) return res.status(409).json({ success: false, message: 'Coupon already used' });

  // Validate hash
  const expectedHash = hashCoupon(coupon.code, userId);
  if (hash !== expectedHash) return res.status(403).json({ success: false, message: 'Invalid coupon hash' });

  coupon.used       = true;
  coupon.redeemedAt = new Date().toISOString();
  writeDB(db);
  res.json({ success: true, message: 'Coupon used successfully' });
});

/* ── POINTS HISTORY ───────────────────────────────────── */
app.get('/api/points-history/:userId', (req, res) => {
  const db      = readDB();
  const history = (db.points_history || [])
    .filter(h => h.userId === req.params.userId)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 50);
  res.json({ success: true, history });
});

/* ── ADMIN: Coupon analytics ──────────────────────────── */
app.get('/api/admin/coupons', (req, res) => {
  const db = readDB();
  const coupons = (db.coupons || []).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const totalDiscount = coupons.reduce((s, c) => s + c.discount_pct, 0);
  const used = coupons.filter(c => c.used).length;
  res.json({
    success: true,
    coupons,
    stats: {
      total: coupons.length,
      used,
      active: coupons.filter(c => !c.used && new Date(c.expiresAt) > new Date()).length,
      expired: coupons.filter(c => !c.used && new Date(c.expiresAt) <= new Date()).length,
      totalDiscount,
      avgDiscount: coupons.length ? Math.round(totalDiscount / coupons.length) : 0
    }
  });
});

app.get('/api/admin/leaderboard', (req, res) => {
  const db = readDB();
  const top = db.users
    .map(({ password: _, ...u }) => ({
      ...u,
      rptCount:    db.reports.filter(r => r.userId === u.id).length,
      couponCount: (db.coupons || []).filter(c => c.userId === u.id).length
    }))
    .sort((a, b) => (b.total_earned_points || b.points) - (a.total_earned_points || a.points))
    .slice(0, 20);
  res.json({ success: true, leaderboard: top });
});

/* ── NGO ROUTES ──────────────────────────────────────── */

// Get all NGOs
app.get('/api/ngos', (req, res) => {
  const db = readDB();
  const ngos = (db.ngos || []).map(ngo => ({
    ...ngo,
    volunteerCount: (db.ngo_volunteers || []).filter(v => v.ngoId === ngo.id).length,
    donationTotal:  (db.ngo_donations  || []).filter(d => d.ngoId === ngo.id && d.status === 'success').reduce((s, d) => s + d.amount, 0)
  }));
  res.json({ success: true, ngos });
});

// Get single NGO
app.get('/api/ngos/:id', (req, res) => {
  const db  = readDB();
  const ngo = (db.ngos || []).find(n => n.id === req.params.id);
  if (!ngo) return res.status(404).json({ success: false, message: 'NGO not found' });
  const volunteers = (db.ngo_volunteers || []).filter(v => v.ngoId === ngo.id);
  const donations  = (db.ngo_donations  || []).filter(d => d.ngoId === ngo.id && d.status === 'success');
  res.json({ success: true, ngo: { ...ngo, volunteerCount: volunteers.length, donationTotal: donations.reduce((s, d) => s + d.amount, 0) } });
});

// Join NGO as volunteer
app.post('/api/ngos/:id/volunteer', (req, res) => {
  const { userId, fullName, email, phone, city, skills, availability } = req.body;
  if (!fullName || !email || !phone || !city || !skills || !availability) {
    return res.status(400).json({ success: false, message: 'All fields are required' });
  }
  const db  = readDB();
  const ngo = (db.ngos || []).find(n => n.id === req.params.id);
  if (!ngo) return res.status(404).json({ success: false, message: 'NGO not found' });

  // Check duplicate
  const existing = (db.ngo_volunteers || []).find(v => v.email === email && v.ngoId === req.params.id);
  if (existing) return res.status(409).json({ success: false, message: 'You have already joined this NGO' });

  const vol = {
    id:           'vol' + uuidv4().slice(0, 8),
    ngoId:        req.params.id,
    ngoName:      ngo.name,
    userId:       userId || null,
    fullName, email, phone, city, skills, availability,
    status:       'active',
    joinedAt:     new Date().toISOString()
  };
  if (!db.ngo_volunteers) db.ngo_volunteers = [];
  db.ngo_volunteers.push(vol);

  // Award points if user is logged in
  if (userId) {
    const user = db.users.find(u => u.id === userId);
    if (user) {
      const oldPts = user.points;
      user.points              += 50;
      user.total_earned_points  = (user.total_earned_points || 0) + 50;
      addPointsHistory(db, userId, 50, `Joined NGO: ${ngo.name}`, 'ngo_volunteer');
      const crossed = checkMilestoneUnlock(user, oldPts, user.points);
      if (crossed) user.milestone_status = 'unlocked';
    }
  }

  writeDB(db);
  res.json({ success: true, volunteer: vol, message: `Welcome! You have joined ${ngo.name} as a volunteer.` });
});

// Create donation (sandbox – Stripe/Razorpay simulated)
app.post('/api/ngos/:id/donate', (req, res) => {
  const { userId, amount, paymentMethod, donorName, donorEmail } = req.body;
  if (!amount || amount <= 0) return res.status(400).json({ success: false, message: 'Invalid donation amount' });
  const db  = readDB();
  const ngo = (db.ngos || []).find(n => n.id === req.params.id);
  if (!ngo) return res.status(404).json({ success: false, message: 'NGO not found' });

  const txnId    = 'TXN' + crypto.randomBytes(6).toString('hex').toUpperCase();
  const receiptNo = 'REC-' + Date.now();

  const donation = {
    id:           'don' + uuidv4().slice(0, 8),
    ngoId:        req.params.id,
    ngoName:      ngo.name,
    userId:       userId || null,
    donorName:    donorName || 'Anonymous',
    donorEmail:   donorEmail || '',
    amount:       Number(amount),
    currency:     'INR',
    paymentMethod: paymentMethod || 'sandbox',
    txnId,
    receiptNo,
    status:       'success',  // sandbox always succeeds
    createdAt:    new Date().toISOString()
  };

  if (!db.ngo_donations) db.ngo_donations = [];
  db.ngo_donations.push(donation);

  // Award points for donation (1 pt per ₹10)
  if (userId) {
    const user = db.users.find(u => u.id === userId);
    if (user) {
      const pts    = Math.floor(amount / 10);
      const oldPts = user.points;
      user.points              += pts;
      user.total_earned_points  = (user.total_earned_points || 0) + pts;
      addPointsHistory(db, userId, pts, `Donated ₹${amount} to ${ngo.name}`, 'ngo_donation');
      const crossed = checkMilestoneUnlock(user, oldPts, user.points);
      if (crossed) user.milestone_status = 'unlocked';
    }
  }

  writeDB(db);

  // Impact calculation: ₹10 cleans ~0.4kg waste
  const wasteImpact = ((amount / 10) * 0.4).toFixed(1);

  res.json({
    success: true,
    donation,
    receipt: { receiptNo, txnId, amount, ngoName: ngo.name, date: new Date().toISOString() },
    impactMessage: `Your ₹${amount} helps clean approximately ${wasteImpact}kg of waste!`
  });
});

// Get donation history for user
app.get('/api/donations/:userId', (req, res) => {
  const db = readDB();
  const donations = (db.ngo_donations || [])
    .filter(d => d.userId === req.params.userId)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json({ success: true, donations });
});

// Get volunteer history for user
app.get('/api/volunteers/:userId', (req, res) => {
  const db = readDB();
  const volunteers = (db.ngo_volunteers || [])
    .filter(v => v.userId === req.params.userId)
    .sort((a, b) => new Date(b.joinedAt) - new Date(a.joinedAt));
  res.json({ success: true, volunteers });
});

/* ── HEALTH ──────────────────────────────────────────── */
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', db: 'parkease-db.json', ts: new Date().toISOString() });
});

/* ── SPA fallback ────────────────────────────────────── */
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🌿BIN-GO running → http://localhost:${PORT}`);
  console.log(`📂 Database: parkease-db.json`);
  console.log(`🎁 Reward System: Active`);
});
