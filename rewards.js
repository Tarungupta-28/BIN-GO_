/* ═══════════════════════════════════════════════════════
   rewards.js — Reward Milestone & Coupon Redemption System
   Full functional module for 🌿BIN-GO
═══════════════════════════════════════════════════════ */
'use strict';

/* ── COMPAT: alias showToast → notify ───────────────── */
function showToast(msg, type) { if (typeof notify === 'function') notify(msg, type); }

/* ── BRAND CONFIG ────────────────────────────────────── */
const BRANDS = [
  { name: 'Myntra',  emoji: '👗', color: '#e91e8c', bg: 'rgba(233,30,140,0.1)',  desc: 'Fashion & Lifestyle' },
  { name: 'Zara',    emoji: '🛍️', color: '#1a1a1a', bg: 'rgba(26,26,26,0.08)',   desc: 'Premium Fashion' },
  { name: 'Ajio',    emoji: '✨', color: '#f97316', bg: 'rgba(249,115,22,0.1)',  desc: 'Trendy Styles' },
  { name: 'Trends',  emoji: '🎯', color: '#6366f1', bg: 'rgba(99,102,241,0.1)',  desc: 'Everyday Fashion' }
];

const TIER_CONFIG = {
  Silver:   { color: '#9ca3af', icon: '🥈', range: '30–40%', milestone: 500,  gradient: 'linear-gradient(135deg,#9ca3af,#6b7280)' },
  Gold:     { color: '#f59e0b', icon: '🥇', range: '40–55%', milestone: 1000, gradient: 'linear-gradient(135deg,#f59e0b,#d97706)' },
  Platinum: { color: '#8b5cf6', icon: '💎', range: '55–70%', milestone: 2000, gradient: 'linear-gradient(135deg,#8b5cf6,#7c3aed)' }
};

/* ── MAIN RENDER ─────────────────────────────────────── */
async function renderRewards() {
  const u = State.currentUser;
  // Optimistic render with current data, then fetch fresh
  const pts = u.points || 0;
  const nextMs = getNextMilestoneLocal(pts);
  const pct = nextMs ? Math.min(100, Math.round((pts / nextMs) * 100)) : 100;
  const tierInfo = getTierLocal(u.total_earned_points || pts);
  const remaining = nextMs ? Math.max(0, nextMs - pts) : 0;

  return `<div class="fade-in rewards-page">
    <div class="pg-header">
      <h2>🎁 Rewards & Coupons</h2>
      <p>Earn points, unlock milestones, redeem fashion discounts</p>
    </div>

    <!-- TIER BADGE -->
    <div class="tier-banner" style="background:${tierInfo.gradient}">
      <div class="tier-inner">
        <div class="tier-icon">${tierInfo.icon}</div>
        <div>
          <div class="tier-name">${tierInfo.tier} Member</div>
          <div class="tier-sub">Unlocks ${tierInfo.range} discounts at ${tierInfo.milestone} pts</div>
        </div>
        <div class="tier-pts-display">
          <div class="tier-pts-num">${pts}</div>
          <div class="tier-pts-lbl">Points</div>
        </div>
      </div>
    </div>

    <!-- PROGRESS MILESTONE -->
    <div class="card milestone-card">
      <div class="milestone-header">
        <div>
          <div class="milestone-title">🏆 Milestone Progress</div>
          <div class="milestone-sub">${nextMs
            ? `<span class="pts-left">${remaining} points left</span> to unlock ${nextMs === 500 ? 'your first' : 'next'} reward`
            : '🎉 All milestones unlocked! Keep earning!'
          }</div>
        </div>
        <div class="milestone-pct">${pct}%</div>
      </div>
      <div class="milestone-prog-track">
        <div class="milestone-prog-fill" id="ms-fill" style="width:0%" data-target="${pct}"></div>
      </div>
      <div class="milestone-markers">
        <span>0</span>
        ${nextMs === 2000 ? `<span class="${pts >= 500 ? 'ms-done' : ''}">500</span><span class="${pts >= 1000 ? 'ms-done' : ''}">1000</span>` : ''}
        <span class="${pts >= (nextMs || 0) ? 'ms-done' : ''}">${nextMs || 2000}</span>
      </div>

      <!-- EARN GUIDE -->
      <div class="earn-guide">
        <div class="earn-title">How to earn points:</div>
        <div class="earn-items">
          <div class="earn-item"><span class="earn-icon">📸</span><span>Submit report</span><span class="earn-pts">+10 pts</span></div>
          <div class="earn-item"><span class="earn-icon">✅</span><span>Report verified</span><span class="earn-pts">+20 pts</span></div>
          <div class="earn-item"><span class="earn-icon">👥</span><span>Refer a friend</span><span class="earn-pts">+50 pts</span></div>
          <div class="earn-item"><span class="earn-icon">🚿</span><span>Cleanliness drive</span><span class="earn-pts">+100 pts</span></div>
        </div>
      </div>

      <!-- QUICK EARN BUTTONS (Demo) -->
      ${u.role !== 'admin' ? `
      <div class="demo-earn-row">
        <span class="demo-earn-lbl">🧪 Demo: Simulate earning</span>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn-outline btn-sm" onclick="demoAddPoints(50,'Referral bonus','referral')">+50 Referral</button>
          <button class="btn btn-outline btn-sm" onclick="demoAddPoints(100,'Cleanliness drive participation','drive')">+100 Drive</button>
        </div>
      </div>` : ''}
    </div>

    <!-- REDEEM SECTION -->
    <div id="redeem-section">
      ${pts >= 500 ? renderRedeemSection(pts) : renderLockedSection(remaining, nextMs)}
    </div>

    <!-- ACTIVE COUPON -->
    <div id="active-coupon-section"></div>

    <!-- COUPON HISTORY -->
    <div id="coupon-history-section">
      <div class="sec-card">
        <div class="sec-title">📜 My Coupons</div>
        <div id="coupon-list" style="color:var(--text2);text-align:center;padding:20px">Loading...</div>
      </div>
    </div>

    <!-- POINTS HISTORY -->
    <div class="sec-card" style="margin-top:20px">
      <div class="sec-title">⚡ Points History</div>
      <div id="points-history-list" style="color:var(--text2);text-align:center;padding:20px">Loading...</div>
    </div>
  </div>`;
}

function renderRedeemSection(pts) {
  return `
  <div class="card redeem-card">
    <div class="redeem-header">
      <div class="redeem-unlock-badge">🎉 MILESTONE UNLOCKED!</div>
      <h3>Choose Your Reward Brand</h3>
      <p>Select a brand to generate your exclusive discount coupon</p>
    </div>
    <div class="brand-grid" id="brand-grid">
      ${BRANDS.map(b => `
        <div class="brand-card" data-brand="${b.name}" onclick="selectBrand('${b.name}')" style="--brand-color:${b.color};--brand-bg:${b.bg}">
          <div class="brand-emoji">${b.emoji}</div>
          <div class="brand-name">${b.name}</div>
          <div class="brand-desc">${b.desc}</div>
        </div>
      `).join('')}
    </div>
    <div id="brand-confirm" class="brand-confirm hidden">
      <div class="selected-brand-display" id="selected-brand-display"></div>
      <button class="btn btn-primary btn-lg btn-full" id="generate-btn" onclick="generateCoupon()">
        🎫 Generate My Coupon
      </button>
      <button class="btn btn-outline" onclick="clearBrandSelection()" style="width:100%;margin-top:8px">← Choose Different Brand</button>
    </div>
    <div class="redeem-note">
      💡 <strong>500 points</strong> will be deducted on redemption. You have <strong>${pts} pts</strong> available. You can hold up to <strong>3 active coupons</strong>.
    </div>
  </div>`;
}

function renderLockedSection(remaining, nextMs) {
  const pct = nextMs ? Math.round(((nextMs - remaining) / nextMs) * 100) : 0;
  return `
  <div class="card locked-card">
    <div class="locked-icon">🔒</div>
    <h3>Unlock at ${nextMs || 500} Points</h3>
    <p>You need <strong>${remaining} more points</strong> to unlock coupon redemption</p>
    <div style="margin:20px 0">
      <div class="milestone-prog-track">
        <div class="milestone-prog-fill" style="width:${pct}%"></div>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--text2);margin-top:6px">
        <span>0 pts</span><span>${nextMs || 500} pts</span>
      </div>
    </div>
    <div class="brand-preview-row">
      ${BRANDS.map(b => `<div class="brand-preview-pill" style="background:${b.bg};color:${b.color}">${b.emoji} ${b.name}</div>`).join('')}
    </div>
    <p style="color:var(--text2);font-size:13px;margin-top:16px">Keep reporting waste to earn points faster!</p>
    <button class="btn btn-primary btn-lg" onclick="goPage('report')" style="margin-top:12px">📸 Report Waste Now</button>
  </div>`;
}

/* ── LOCAL HELPERS ───────────────────────────────────── */
function getNextMilestoneLocal(pts) {
  if (pts < 500)  return 500;
  if (pts < 1000) return 1000;
  if (pts < 2000) return 2000;
  return null;
}

function getTierLocal(totalPts) {
  if (totalPts >= 2000) return { ...TIER_CONFIG.Platinum, tier: 'Platinum' };
  if (totalPts >= 1000) return { ...TIER_CONFIG.Gold,     tier: 'Gold' };
  return { ...TIER_CONFIG.Silver, tier: 'Silver' };
}

/* ── BRAND SELECTION ─────────────────────────────────── */
window.selectBrand = function(brand) {
  State.selectedBrand = brand;
  $$('.brand-card').forEach(c => c.classList.toggle('selected', c.dataset.brand === brand));
  const b = BRANDS.find(b => b.name === brand);
  $('#selected-brand-display').innerHTML = `
    <div class="sel-brand-inner" style="border-color:${b.color}">
      <span style="font-size:2rem">${b.emoji}</span>
      <div>
        <strong style="color:${b.color}">${b.name}</strong>
        <div style="font-size:13px;color:var(--text2)">${b.desc}</div>
      </div>
    </div>`;
  $('#brand-confirm').classList.remove('hidden');
};

window.clearBrandSelection = function() {
  State.selectedBrand = null;
  $$('.brand-card').forEach(c => c.classList.remove('selected'));
  $('#brand-confirm').classList.add('hidden');
};

/* ── GENERATE COUPON ─────────────────────────────────── */
window.generateCoupon = async function() {
  if (!State.selectedBrand) return;
  const btn = $('#generate-btn');
  btn.disabled = true;
  btn.textContent = '⏳ Generating...';

  try {
    const res = await api('POST', '/rewards/redeem', {
      userId: State.currentUser.id,
      brand:  State.selectedBrand
    });

    if (!res.success) {
      showToast(res.message || 'Redemption failed', 'error');
      btn.disabled = false;
      btn.textContent = '🎫 Generate My Coupon';
      return;
    }

    // Update local user points
    State.currentUser.points = res.remainingPoints;
    updateSidebarPoints();

    // Show success popup
    showMilestoneCelebration(res.coupon);

    // Reload rewards page sections
    setTimeout(() => refreshRewardsUI(), 600);

  } catch(e) {
    showToast('Error connecting to server', 'error');
    btn.disabled = false;
    btn.textContent = '🎫 Generate My Coupon';
  }
};

/* ── CELEBRATION POPUP ───────────────────────────────── */
function showMilestoneCelebration(coupon) {
  const b = BRANDS.find(b => b.name === coupon.brand) || BRANDS[0];
  const expDate = new Date(coupon.expiresAt).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric'
  });

  const popup = document.createElement('div');
  popup.className = 'milestone-popup-overlay';
  popup.innerHTML = `
    <div class="milestone-popup">
      <div class="confetti-burst">
        ${Array.from({length: 20}, (_, i) => `<div class="confetti-piece" style="--i:${i}"></div>`).join('')}
      </div>
      <div class="popup-emoji">🎉</div>
      <h2 class="popup-title">Coupon Generated!</h2>
      <p class="popup-sub">Your exclusive discount is ready to use</p>

      <div class="coupon-card-design" style="--brand-color:${b.color};--brand-bg:${b.bg}">
        <div class="coupon-brand-row">
          <span class="coupon-brand-emoji">${b.emoji}</span>
          <span class="coupon-brand-name">${coupon.brand}</span>
          <span class="coupon-tier-badge" style="background:${TIER_CONFIG[coupon.tier]?.gradient || '#6b7280'}">${coupon.tier}</span>
        </div>
        <div class="coupon-discount">${coupon.discount_pct}% OFF</div>
        <div class="coupon-code-display">
          <span class="coupon-code-label">CODE</span>
          <span class="coupon-code-val" id="popup-code">${coupon.code}</span>
          <button class="copy-code-btn" onclick="copyCode('${coupon.code}')">📋</button>
        </div>
        <div class="coupon-meta-row">
          <span>🗓️ Valid till ${expDate}</span>
          <span>⚡ One-time use</span>
        </div>
        <div class="coupon-dashed-line"></div>
        <div class="coupon-hash">🔐 ${coupon.hash}</div>
      </div>

      <button class="btn btn-primary btn-full btn-lg" onclick="closeCelebrationPopup()" style="margin-top:20px">
        🎊 Awesome, Thanks!
      </button>
    </div>`;

  document.body.appendChild(popup);
  requestAnimationFrame(() => popup.classList.add('visible'));

  popup.addEventListener('click', e => {
    if (e.target === popup) closeCelebrationPopup();
  });
}

window.closeCelebrationPopup = function() {
  const popup = $('.milestone-popup-overlay');
  if (popup) {
    popup.classList.remove('visible');
    setTimeout(() => popup.remove(), 300);
  }
};

window.copyCode = function(code) {
  navigator.clipboard?.writeText(code).then(() => showToast('Code copied! 📋', 'success'));
};

/* ── MILESTONE UNLOCK POPUP ──────────────────────────── */
function showMilestoneUnlockPopup(milestone) {
  const popup = document.createElement('div');
  popup.className = 'milestone-popup-overlay';
  popup.innerHTML = `
    <div class="milestone-popup milestone-unlock-popup">
      <div class="confetti-burst">
        ${Array.from({length: 20}, (_, i) => `<div class="confetti-piece" style="--i:${i}"></div>`).join('')}
      </div>
      <div class="popup-emoji" style="font-size:64px">🏆</div>
      <h2 class="popup-title">Milestone Reached!</h2>
      <div class="unlock-pts-display">${milestone} Points</div>
      <p class="popup-sub">You've unlocked coupon redemption! Go to <strong>Rewards</strong> to claim your discount.</p>
      <div class="unlock-brands-row">
        ${BRANDS.map(b => `<div class="unlock-brand" style="background:${b.bg};color:${b.color}">${b.emoji} ${b.name}</div>`).join('')}
      </div>
      <button class="btn btn-primary btn-full btn-lg" onclick="closeMilestoneUnlockPopup()" style="margin-top:20px">
        🎁 Redeem Now!
      </button>
    </div>`;
  document.body.appendChild(popup);
  requestAnimationFrame(() => popup.classList.add('visible'));
  popup.addEventListener('click', e => { if(e.target === popup) closeMilestoneUnlockPopup(); });
}

window.closeMilestoneUnlockPopup = function() {
  const popup = $('.milestone-popup-overlay');
  if (popup) {
    popup.classList.remove('visible');
    setTimeout(() => { popup.remove(); goPage('rewards'); }, 300);
  }
};

/* ── REFRESH UI AFTER REDEMPTION ─────────────────────── */
async function refreshRewardsUI() {
  const u = State.currentUser;
  const pts = u.points;
  const nextMs = getNextMilestoneLocal(pts);
  const pct = nextMs ? Math.min(100, Math.round((pts / nextMs) * 100)) : 100;
  const remaining = nextMs ? Math.max(0, nextMs - pts) : 0;

  // Update redeem section
  const redeemSec = $('#redeem-section');
  if (redeemSec) {
    redeemSec.innerHTML = pts >= 500 ? renderRedeemSection(pts) : renderLockedSection(remaining, nextMs);
  }

  // Update progress bar
  const fill = $('#ms-fill');
  if (fill) { setTimeout(() => { fill.style.width = pct + '%'; }, 100); }

  // Load coupons
  await loadUserCoupons();
  await loadPointsHistory();
}

/* ── LOAD COUPONS ────────────────────────────────────── */
async function loadUserCoupons() {
  try {
    const res = await api('GET', `/rewards/${State.currentUser.id}`);
    if (!res.success) return;

    // Active coupons banner (up to 3)
    const activeSec = $('#active-coupon-section');
    if (activeSec) {
      const now = new Date();
      const activeCoupons = (res.all_coupons || []).filter(c => !c.used && new Date(c.expiresAt) > now);
      if (activeCoupons.length > 0) {
        const countLabel = activeCoupons.length === 1 ? '1 Active Coupon' : `${activeCoupons.length} Active Coupons (${activeCoupons.length}/3)`;
        activeSec.innerHTML = `
          <div style="margin-bottom:16px">
            <div class="sec-title">🎫 ${countLabel}</div>
            ${activeCoupons.map(c => {
              const b   = BRANDS.find(b => b.name === c.brand) || BRANDS[0];
              const exp = new Date(c.expiresAt).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' });
              return `<div class="active-coupon-banner" style="--brand-color:${b.color};margin-bottom:12px">
                <div class="acb-header">
                  <span>${b.emoji} ${c.brand}</span>
                  <span class="acb-tier">${c.tier}</span>
                </div>
                <div class="acb-body">
                  <div class="acb-left">
                    <span style="font-size:1.8rem">${b.emoji}</span>
                    <div>
                      <div class="acb-brand">${c.brand}</div>
                      <div class="acb-exp">Expires ${exp}</div>
                    </div>
                  </div>
                  <div class="acb-discount">${c.discount_pct}%<br><span>OFF</span></div>
                </div>
                <div class="acb-code-row">
                  <code class="acb-code">${c.code}</code>
                  <button class="btn btn-outline btn-sm" onclick="copyCode('${c.code}')">📋 Copy</button>
                </div>
              </div>`;
            }).join('')}
          </div>`;
      } else {
        activeSec.innerHTML = '';
      }
    }

    // All coupons list
    const list = $('#coupon-list');
    if (!list) return;
    const coupons = res.all_coupons || [];
    if (!coupons.length) {
      list.innerHTML = '<div style="color:var(--text2);text-align:center;padding:20px">No coupons yet. Reach 500 points to redeem!</div>';
      return;
    }
    list.innerHTML = coupons.map(c => {
      const b   = BRANDS.find(b => b.name === c.brand) || BRANDS[0];
      const exp = new Date(c.expiresAt).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' });
      const expired = new Date(c.expiresAt) < new Date();
      const statusClass = c.used ? 'cpn-used' : expired ? 'cpn-expired' : 'cpn-active';
      const statusLabel = c.used ? '✅ Used' : expired ? '⏰ Expired' : '🟢 Active';
      return `
        <div class="cpn-list-item ${statusClass}" style="--brand-color:${b.color}">
          <span class="cpn-emoji">${b.emoji}</span>
          <div class="cpn-info">
            <div class="cpn-brand">${c.brand} — ${c.discount_pct}% OFF</div>
            <div class="cpn-code-small">${c.code}</div>
            <div class="cpn-dates">Expires ${exp} · ${c.tier}</div>
          </div>
          <div class="cpn-status ${statusClass}">${statusLabel}</div>
        </div>`;
    }).join('');

  } catch(e) {
    console.error('Failed to load coupons:', e);
  }
}

/* ── LOAD POINTS HISTORY ─────────────────────────────── */
async function loadPointsHistory() {
  try {
    const res = await api('GET', `/points-history/${State.currentUser.id}`);
    const el  = $('#points-history-list');
    if (!el) return;
    const hist = res.history || [];
    if (!hist.length) {
      el.innerHTML = '<div style="color:var(--text2);text-align:center;padding:16px">No activity yet</div>';
      return;
    }
    el.innerHTML = hist.map(h => {
      const isPos  = h.points > 0;
      const date   = new Date(h.createdAt).toLocaleDateString('en-IN', { day:'numeric', month:'short' });
      const typeIconMap = { report:'📸', resolved:'✅', referral:'👥', drive:'🚿', manual:'⚙️', redemption:'🎫' };
      const icon = typeIconMap[h.type] || '⚡';
      return `
        <div class="hist-item">
          <span class="hist-icon">${icon}</span>
          <div class="hist-info">
            <div class="hist-reason">${h.reason}</div>
            <div class="hist-date">${date}</div>
          </div>
          <div class="hist-pts ${isPos ? 'hist-pos' : 'hist-neg'}">${isPos ? '+' : ''}${h.points}</div>
        </div>`;
    }).join('');
  } catch(e) {
    console.error('Failed to load history:', e);
  }
}

/* ── DEMO: Add points for testing ────────────────────── */
window.demoAddPoints = async function(pts, reason, type) {
  try {
    const res = await api('POST', `/users/${State.currentUser.id}/points`, { points: pts, reason, type });
    if (!res.success) { showToast('Failed to add points', 'error'); return; }
    State.currentUser.points = res.user.points;
    State.currentUser.total_earned_points = res.user.total_earned_points;
    updateSidebarPoints();
    showToast(`+${pts} points earned! 🎉`, 'success');
    if (res.milestoneUnlocked) {
      setTimeout(() => showMilestoneUnlockPopup(res.milestoneUnlocked), 400);
    } else {
      await refreshRewardsUI();
    }
  } catch(e) {
    showToast('Error adding points', 'error');
  }
};

/* ── SIDEBAR POINTS UPDATE ───────────────────────────── */
function updateSidebarPoints() {
  const u = State.currentUser;
  const el = $('#sb-pts');
  if (el) el.textContent = `⭐ ${u.points} pts · ${u.role}`;
}

/* ── POST-RENDER INIT ────────────────────────────────── */
async function wireRewardsPage() {
  // Animate progress bar
  setTimeout(() => {
    const fill = $('#ms-fill');
    if (fill) fill.style.width = fill.dataset.target + '%';
  }, 100);

  // Load data
  await loadUserCoupons();
  await loadPointsHistory();
}

// Export for page router
window.renderRewards   = renderRewards;
window.wireRewardsPage = wireRewardsPage;
window.showMilestoneUnlockPopup = showMilestoneUnlockPopup;
