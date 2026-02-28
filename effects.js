/* ═══════════════════════════════════════════════════════
   ✨ effects.js — Visual enhancements for 🌿BIN-GO
═══════════════════════════════════════════════════════ */
'use strict';

/* ── PARTICLE SYSTEM (auth screen only) ─────────────── */
function initParticles() {
  const authScreen = document.getElementById('auth-screen');
  if (!authScreen) return;

  const canvas = document.createElement('canvas');
  canvas.id = 'particle-canvas';
  const authBg = authScreen.querySelector('.auth-bg');
  (authBg || authScreen).appendChild(canvas);

  const ctx = canvas.getContext('2d');
  let W, H, particles = [], raf;

  function resize() {
    W = canvas.width  = authScreen.offsetWidth  || window.innerWidth;
    H = canvas.height = authScreen.offsetHeight || window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  const COLORS = ['rgba(0,200,150,', 'rgba(14,165,233,', 'rgba(99,102,241,'];

  function makeParticle() {
    const col = COLORS[Math.floor(Math.random() * COLORS.length)];
    return {
      x: Math.random() * W, y: Math.random() * H,
      r: Math.random() * 2.2 + 0.6,
      dx: (Math.random() - 0.5) * 0.4, dy: (Math.random() - 0.5) * 0.4,
      alpha: Math.random() * 0.45 + 0.15, dAlpha: (Math.random() - 0.5) * 0.007,
      col, pulse: Math.random() * Math.PI * 2
    };
  }
  for (let i = 0; i < 75; i++) particles.push(makeParticle());

  function drawConnections() {
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 105) {
          ctx.beginPath();
          ctx.strokeStyle = 'rgba(0,200,150,' + ((1 - dist / 105) * 0.10) + ')';
          ctx.lineWidth = 0.5;
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.stroke();
        }
      }
    }
  }

  function tick() {
    if (authScreen.classList.contains('hidden')) { raf = null; return; }
    ctx.clearRect(0, 0, W, H);
    drawConnections();
    particles.forEach(function(p) {
      p.x += p.dx; p.y += p.dy;
      p.alpha += p.dAlpha; p.pulse += 0.025;
      if (p.alpha > 0.65 || p.alpha < 0.10) p.dAlpha *= -1;
      if (p.x < 0) p.x = W; if (p.x > W) p.x = 0;
      if (p.y < 0) p.y = H; if (p.y > H) p.y = 0;
      const glow = 1 + Math.sin(p.pulse) * 0.28;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * glow, 0, Math.PI * 2);
      ctx.fillStyle = p.col + p.alpha + ')';
      ctx.fill();
    });
    raf = requestAnimationFrame(tick);
  }
  tick();

  new MutationObserver(function() {
    if (!authScreen.classList.contains('hidden') && !raf) tick();
  }).observe(authScreen, { attributes: true, attributeFilter: ['class'] });
}

/* ── RIPPLE EFFECT on buttons ────────────────────────── */
function initRipple() {
  document.addEventListener('click', function(e) {
    const target = e.target.closest('.btn, .tab-btn, .wt-btn, .quick-amt');
    // NOTE: nav-item excluded — it has ::after glow dot that needs overflow visible
    if (!target) return;

    const rect = target.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height) * 1.8;
    const x    = e.clientX - rect.left  - size / 2;
    const y    = e.clientY - rect.top   - size / 2;

    const ripple = document.createElement('span');
    ripple.className = 'ripple';
    ripple.style.cssText = 'width:' + size + 'px;height:' + size + 'px;left:' + x + 'px;top:' + y + 'px';
    target.appendChild(ripple);
    setTimeout(function() { ripple.remove(); }, 620);
  });
}

/* ── SCROLL REVEAL ───────────────────────────────────── */
var revealObserver = null;
var _revealMutObs  = null; // track mutation observer so we don't stack them

function initScrollReveal() {
  if (revealObserver) revealObserver.disconnect();

  revealObserver = new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.08, rootMargin: '0px 0px -20px 0px' });

  function attachReveal() {
    document.querySelectorAll(
      '.stat-card:not(.reveal),.sec-card:not(.reveal),.adopt-card:not(.reveal),.pod-card:not(.reveal),.ps-card:not(.reveal)'
    ).forEach(function(el, i) {
      el.classList.add('reveal');
      if (i > 0 && i <= 4) el.classList.add('reveal-delay-' + i);
      revealObserver.observe(el);
    });
  }

  // Disconnect old mutation observer before creating a new one
  if (_revealMutObs) _revealMutObs.disconnect();
  const pageContent = document.getElementById('page-content');
  if (pageContent) {
    _revealMutObs = new MutationObserver(function() { setTimeout(attachReveal, 100); });
    _revealMutObs.observe(pageContent, { childList: true });
  }
  attachReveal();
}

/* ── 3D TILT on stat cards ───────────────────────────── */
function initTilt() {
  var currentCard = null;

  document.addEventListener('mousemove', function(e) {
    const card = e.target.closest && e.target.closest('.stat-card');
    if (!card) {
      if (currentCard) {
        currentCard.style.transform = '';
        currentCard.style.boxShadow = '';
        currentCard = null;
      }
      return;
    }
    currentCard = card;
    const rect = card.getBoundingClientRect();
    const dx   = (e.clientX - rect.left  - rect.width  / 2) / (rect.width  / 2);
    const dy   = (e.clientY - rect.top   - rect.height / 2) / (rect.height / 2);
    card.style.transform = 'perspective(700px) rotateX(' + (-dy * 6) + 'deg) rotateY(' + (dx * 6) + 'deg) translateY(-4px) scale(1.02)';
    card.style.boxShadow = '0 16px 40px rgba(0,200,150,0.18), 0 4px 12px rgba(0,0,0,0.12)';
  });

  // Use mouseleave on the stats grid container instead of capture to avoid noise
  document.addEventListener('mouseleave', function(e) {
    if (currentCard && !currentCard.contains(e.relatedTarget)) {
      currentCard.style.transform = '';
      currentCard.style.boxShadow = '';
      currentCard = null;
    }
  });
}

/* ── TOPBAR SCROLL SHADOW ────────────────────────────── */
function initTopbarScroll() {
  function attachListener() {
    const topbar      = document.querySelector('.topbar');
    const pageContent = document.querySelector('.page-content');
    if (!topbar || !pageContent) return;
    pageContent.onscroll = function() {
      topbar.classList.toggle('scrolled', pageContent.scrollTop > 8);
    };
  }

  const pageContent = document.getElementById('page-content');
  if (pageContent) {
    new MutationObserver(attachListener).observe(pageContent, { childList: true });
  }
  setTimeout(attachListener, 400);
}

/* ── PAGE TRANSITION ─────────────────────────────────── */
function initPageTransition() {
  if (typeof window.goPage !== 'function') {
    setTimeout(initPageTransition, 250);
    return;
  }
  if (window._goPagePatched) return;
  window._goPagePatched = true;

  const originalGoPage = window.goPage;
  window.goPage = async function(page) {
    const content = document.getElementById('page-content');
    if (content) {
      // Use direct properties, never cssText += (can duplicate/corrupt existing styles)
      content.style.transition = 'opacity 0.16s ease, transform 0.16s ease';
      content.style.opacity    = '0';
      content.style.transform  = 'translateX(8px)';
      await new Promise(function(r) { setTimeout(r, 110); });
    }
    await originalGoPage(page);
    if (content) {
      content.style.opacity   = '1';
      content.style.transform = 'translateX(0)';
      setTimeout(function() {
        content.style.transition = '';
        content.style.opacity    = '';
        content.style.transform  = '';
      }, 280);
    }
    setTimeout(initScrollReveal, 160);
  };
}

/* ── KEYBOARD SHORTCUTS ──────────────────────────────── */
function initKeyboardShortcuts() {
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      const sidebar = document.getElementById('sidebar');
      const overlay = document.getElementById('sb-overlay');
      if (sidebar && sidebar.classList.contains('open')) {
        sidebar.classList.remove('open');
        if (overlay) overlay.classList.remove('on');
      }
    }
  });
}

/* ── AUTH CARD STAGGER ANIMATION ─────────────────────── */
function initAuthAnimation() {
  const logo = document.querySelector('.auth-logo');
  const card = document.querySelector('.auth-card');
  if (!card) return;

  // Only animate structural layout elements, NOT .btn (submit button must always be visible/interactive)
  const items = card.querySelectorAll('.tab-row, .field-group, #name-wrap, .demo-hint');

  if (logo) {
    logo.style.opacity    = '0';
    logo.style.transform  = 'translateY(-12px)';
    logo.style.transition = 'opacity 0.5s ease 0.05s, transform 0.5s ease 0.05s';
  }
  items.forEach(function(el, i) {
    el.style.opacity    = '0';
    el.style.transform  = 'translateY(14px)';
    el.style.transition = 'opacity 0.38s ease ' + (i * 0.07 + 0.15) + 's, transform 0.38s ease ' + (i * 0.07 + 0.15) + 's';
  });

  requestAnimationFrame(function() {
    requestAnimationFrame(function() {
      if (logo) { logo.style.opacity = '1'; logo.style.transform = 'translateY(0)'; }
      items.forEach(function(el) { el.style.opacity = '1'; el.style.transform = 'translateY(0)'; });
    });
  });
}

/* ── INIT ALL ─────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', function() {
  initParticles();
  initRipple();
  initScrollReveal();
  initTilt();
  initTopbarScroll();
  initKeyboardShortcuts();
  initAuthAnimation();
  setTimeout(initPageTransition, 600);
});
