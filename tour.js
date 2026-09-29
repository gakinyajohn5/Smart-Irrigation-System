/* ---- tour.js: Game-style interactive tutorial ---- */
(function () {
  const css = document.createElement('style');
  css.textContent = `
    #tg-root{position:fixed;inset:0;z-index:99999;display:none;pointer-events:none;font-family:'Work Sans',sans-serif;}
    #tg-root.on{display:block;}
    .tg-block{position:fixed;background:rgba(36,28,19,.82);pointer-events:auto;transition:all .25s ease;}
    #tg-guard{position:fixed;pointer-events:auto;display:none;}
    #tg-ring{position:fixed;pointer-events:none;border:3px solid var(--marigold,#D98E04);
      box-shadow:0 0 0 4px rgba(217,142,4,.35),0 0 24px 6px rgba(217,142,4,.55);
      animation:tgPulse 1.2s ease-in-out infinite;transition:all .25s ease;display:none;}
    @keyframes tgPulse{0%,100%{box-shadow:0 0 0 3px rgba(217,142,4,.35),0 0 14px 3px rgba(217,142,4,.4);}
      50%{box-shadow:0 0 0 9px rgba(217,142,4,.18),0 0 30px 10px rgba(217,142,4,.7);}}
    #tg-hand{position:fixed;font-size:34px;line-height:1;pointer-events:none;display:none;
      filter:drop-shadow(0 3px 4px rgba(0,0,0,.5));}
    #tg-hand.up{animation:tgBobUp .8s ease-in-out infinite;}
    #tg-hand.down{animation:tgBobDown .8s ease-in-out infinite;}
    @keyframes tgBobUp{0%,100%{transform:translateY(0);}50%{transform:translateY(-9px);}}
    @keyframes tgBobDown{0%,100%{transform:translateY(0);}50%{transform:translateY(9px);}}
    #tg-card{position:fixed;pointer-events:auto;background:var(--paper,#FBF8F1);color:var(--ink,#241A10);
      border:2px solid var(--line,#5A4938);border-radius:18px;padding:16px 16px 12px;
      box-shadow:0 16px 36px rgba(0,0,0,.5);animation:tgIn .25s ease;}
    @keyframes tgIn{from{opacity:0;transform:scale(.96);}to{opacity:1;transform:none;}}
    #tg-card .tg-badge{display:inline-block;background:var(--marigold,#D98E04);color:var(--soil,#2B2118);
      font-size:10px;font-weight:700;border-radius:12px;padding:2px 10px;margin-bottom:6px;}
    #tg-card h3{font-family:'Fraunces',serif;margin:0 0 6px;font-size:17px;color:var(--soil,#2B2118);}
    #tg-card p{font-size:13px;line-height:1.45;margin:0 0 10px;color:var(--line,#5A4938);}
    .tg-hint{font-size:12px;font-weight:700;color:var(--rust,#C1440E);margin-bottom:8px;}
    .tg-foot{display:flex;justify-content:space-between;align-items:center;gap:8px;}
    .tg-dots{display:flex;gap:4px;flex-wrap:wrap;}
    .tg-dots i{width:6px;height:6px;border-radius:50%;background:#D9CFBC;display:block;}
    .tg-dots i.done{background:var(--leaf,#7CB518);} .tg-dots i.cur{background:var(--marigold,#D98E04);}
    .tg-btn{border:none;border-radius:16px;padding:8px 16px;font-size:12.5px;font-weight:700;cursor:pointer;
      background:var(--leaf,#7CB518);color:var(--soil,#2B2118);font-family:inherit;}
    .tg-link{background:none;border:none;color:var(--line,#5A4938);font-size:11.5px;text-decoration:underline;
      cursor:pointer;padding:4px;font-family:inherit;}
  `;
  document.head.appendChild(css);

  const root = document.createElement('div');
  root.id = 'tg-root';
  root.innerHTML = `
    <div class="tg-block" id="tg-b1"></div><div class="tg-block" id="tg-b2"></div>
    <div class="tg-block" id="tg-b3"></div><div class="tg-block" id="tg-b4"></div>
    <div id="tg-guard"></div><div id="tg-ring"></div><div id="tg-hand"></div>
    <div id="tg-card"></div>`;
  document.body.appendChild(root);
  const $ = id => document.getElementById(id);

  const visible = el => el && el.getClientRects().length > 0;
  const firstVisible = sel => [...document.querySelectorAll(sel)].find(visible) || null;
  const T = {
    en: {
      step: 'Step', of: 'of', tap: '👆 Tap the glowing spot to continue', next: 'Next →', skip: 'Skip tour',
      skipStep: 'Skip this step', start: "Let's go! ▶", finish: 'Start farming 🌱'
    },
    sw: {
      step: 'Hatua', of: 'ya', tap: '👆 Gusa mahali panapong\'aa kuendelea', next: 'Endelea →', skip: 'Ruka mafunzo',
      skipStep: 'Ruka hatua hii', start: 'Twende! ▶', finish: 'Anza kulima 🌱'
    }
  };

  /* type: 'intro' | 'click' (user must tap target) | 'next' (just read) | 'end' */
  const steps = [
    { type: 'intro',
      title: { en: '🌾 Welcome, farmer!', sw: '🌾 Karibu, mkulima!' },
      text: { en: "Let's learn the app like a game. I'll show you exactly where to tap. Ready?",
              sw: 'Tujifunze programu kama mchezo. Nitakuonyesha mahali pa kugusa. Uko tayari?' } },

    { type: 'click', screen: 'home', target: '#lbl-place', delay: 450,
      title: { en: 'Switch farms', sw: 'Badilisha shamba' },
      text: { en: 'This is your farm name. Tap it to see all your farms.',
              sw: 'Hili ni jina la shamba lako. Ligonge kuona mashamba yako yote.' } },

    { type: 'click', screen: 'farms', target: () => document.querySelectorAll('#screen-farms .farmcard')[1], delay: 500,
      title: { en: 'Pick Nakuru Farm', sw: 'Chagua Shamba la Nakuru' },
      text: { en: 'Tap Nakuru Farm to switch to it.', sw: 'Gusa Shamba la Nakuru kulibadilisha.' } },

    { type: 'next', screen: 'home', target: '.almanac .weather',
      title: { en: 'Weather for that farm', sw: 'Hali ya hewa ya shamba hilo' },
      text: { en: 'See? The weather and your zones now belong to Nakuru. Every farm gets its own live forecast.',
              sw: 'Unaona? Hali ya hewa na maeneo sasa ni ya Nakuru. Kila shamba lina utabiri wake.' } },

    { type: 'click', screen: 'home', target: '#jars-list .jar', delay: 450,
      title: { en: 'Open a zone', sw: 'Fungua eneo' },
      text: { en: 'Each jar is a zone in your field. Tap one to open it.',
              sw: 'Kila chupa ni eneo shambani. Gusa moja kulifungua.' } },

    { type: 'click', screen: 'zone', target: '#read-now-btn', delay: 1700,
      title: { en: 'Take a sensor reading', sw: 'Soma kipimo' },
      text: { en: 'Tap "Read now" to get fresh soil pH, moisture and temperature.',
              sw: 'Gusa "Read now" kupata pH ya udongo, unyevu na joto vipya.' } },

    { type: 'next', screen: 'zone', target: '.gauges',
      title: { en: 'Your soil numbers', sw: 'Namba za udongo wako' },
      text: { en: 'Here is what the sensor found. A red or orange gauge means the zone needs attention.',
              sw: 'Hivi ndivyo kipimo kilipata. Kipimo chekundu au cha machungwa kinamaanisha eneo linahitaji uangalizi.' } },

    { type: 'click', target: 'nav .fab', delay: 450,
      title: { en: 'Leaf doctor', sw: 'Daktari wa majani' },
      text: { en: 'Tap the camera button in the middle to check a sick plant.',
              sw: 'Gusa kitufe cha kamera katikati kuchunguza mmea mgonjwa.' } },

    { type: 'next', screen: 'scan',
      target: () => { const b = document.querySelector('#screen-scan button[onclick*="file-camera"]'); return b && b.parentElement; },
      title: { en: 'Snap a leaf', sw: 'Piga picha ya jani' },
      text: { en: 'Tap "Take photo" or "Upload photo". The AI names the problem and suggests a treatment.',
              sw: 'Gusa "Take photo" au "Upload photo". AI itataja tatizo na kupendekeza matibabu.' } },

    { type: 'click', target: 'nav button[data-s="alerts"]', delay: 450,
      title: { en: 'Alerts', sw: 'Tahadhari' },
      text: { en: 'Low water tank? Disease nearby? Tap Alerts to see it.',
              sw: 'Tanki la maji linaisha? Ugonjwa karibu? Gusa Alerts kuona.' } },

    { type: 'click', screen: 'alerts', target: '#screen-alerts button[onclick="readAlerts()"]', delay: 700,
      title: { en: 'Hear your alerts', sw: 'Sikia tahadhari zako' },
      text: { en: 'Tap this to have your alerts read out loud. Great when your hands are muddy!',
              sw: 'Gusa hapa alerts zisomwe kwa sauti. Nzuri mikono ikiwa na matope!' } },

    { type: 'click', target: 'nav button[data-s="ledger"]', delay: 450,
      title: { en: 'Costs & profit', sw: 'Gharama na faida' },
      text: { en: 'Tap Ledger to work out lime costs, harvest dates and profit.',
              sw: 'Gusa Ledger kukokotoa gharama za chokaa, tarehe za mavuno na faida.' } },

    { type: 'click', screen: 'home', target: 'button[onclick="go(\'chat\')"]', delay: 500,
      title: { en: 'Ask the assistant', sw: 'Muulize msaidizi' },
      text: { en: 'Stuck? Tap here and ask the AI farm assistant anything.',
              sw: 'Umekwama? Gusa hapa umuulize msaidizi wa AI chochote.' } },

    { type: 'end',
      title: { en: '🎉 You did it!', sw: '🎉 Umefanikiwa!' },
      text: { en: "You know the app now. You can replay this tour anytime from your profile (tap JK at the top).",
              sw: 'Sasa unaijua programu. Unaweza kurudia mafunzo haya wakati wowote kwenye wasifu wako (gusa JK juu).' } }
  ];

  let idx = 0, cleanup = null, cur = null, active = false;
  const lang = () => (typeof currentLang !== 'undefined' && currentLang === 'sw') ? 'sw' : 'en';
  const tr = o => o[lang()] || o.en;
  const t = () => T[lang()];

  function findTarget(step) {
    if (!step.target) return null;
    try {
      const el = typeof step.target === 'function' ? step.target() : firstVisible(step.target);
      return visible(el) ? el : null;
    } catch (e) { return null; }
  }

  function setRect(el, l, tp, w, h) {
    el.style.left = l + 'px'; el.style.top = tp + 'px';
    el.style.width = Math.max(0, w) + 'px'; el.style.height = Math.max(0, h) + 'px';
  }

  function place() {
    if (!active) return;
    const step = steps[idx], W = window.innerWidth, H = window.innerHeight;
    const card = $('tg-card'), ring = $('tg-ring'), hand = $('tg-hand'), guard = $('tg-guard');
    const cw = Math.min(320, W - 24);
    card.style.width = cw + 'px';

    if (!cur) {
      setRect($('tg-b1'), 0, 0, W, H);
      ['tg-b2', 'tg-b3', 'tg-b4'].forEach(id => setRect($(id), 0, 0, 0, 0));
      ring.style.display = hand.style.display = guard.style.display = 'none';
      card.style.left = (W - cw) / 2 + 'px';
      card.style.top = Math.max(12, (H - card.offsetHeight) / 2) + 'px';
      return;
    }

    const r = cur.getBoundingClientRect(), p = 6;
    const L = Math.max(0, r.left - p), Tp = Math.max(0, r.top - p);
    const R = Math.min(W, r.right + p), B = Math.min(H, r.bottom + p);
    setRect($('tg-b1'), 0, 0, W, Tp);
    setRect($('tg-b2'), 0, B, W, H - B);
    setRect($('tg-b3'), 0, Tp, L, B - Tp);
    setRect($('tg-b4'), R, Tp, W - R, B - Tp);

    const br = parseFloat(getComputedStyle(cur).borderRadius) || 12;
    ring.style.display = 'block'; setRect(ring, L, Tp, R - L, B - Tp);
    ring.style.borderRadius = Math.min(999, br + p) + 'px';

    if (step.type === 'next') { guard.style.display = 'block'; setRect(guard, L, Tp, R - L, B - Tp); }
    else guard.style.display = 'none';

    const ch = card.offsetHeight, gap = 46;
    let top, handTop, dir = null;
    if (B + gap + ch + 8 <= H) { top = B + gap; handTop = B + 2; dir = 'up'; }
    else if (Tp - gap - ch - 8 >= 0) { top = Tp - gap - ch; handTop = Tp - 40; dir = 'down'; }
    else { top = H - ch - 12; }
    card.style.top = top + 'px';
    card.style.left = Math.min(Math.max(12, (L + R) / 2 - cw / 2), W - cw - 12) + 'px';

    if (dir && step.type === 'click') {
      hand.style.display = 'block'; hand.className = dir;
      hand.textContent = dir === 'up' ? '👆' : '👇';
      hand.style.left = Math.min(Math.max(4, (L + R) / 2 - 17), W - 40) + 'px';
      hand.style.top = handTop + 'px';
    } else hand.style.display = 'none';
  }

  function render() {
    if (cleanup) { cleanup(); cleanup = null; }
    const step = steps[idx], tt = t();
    if (step.screen) {
      const a = document.querySelector('.screen.active');
      if (!a || a.id !== 'screen-' + step.screen) { try { go(step.screen); } catch (e) {} }
    }
    setTimeout(() => {
      if (!active) return;
      cur = findTarget(step);
      if (step.target && !cur) { advance(); return; }
      if (cur) cur.scrollIntoView({ block: 'center', behavior: 'auto' });

      const total = steps.length;
      const dots = steps.map((s, i) => `<i class="${i < idx ? 'done' : i === idx ? 'cur' : ''}"></i>`).join('');
      let body = '';
      if (step.type === 'click') body += `<div class="tg-hint">${tt.tap}</div>`;
      let actions = '';
      if (step.type === 'intro') actions = `<button class="tg-btn" id="tg-go">${tt.start}</button>`;
      else if (step.type === 'next') actions = `<button class="tg-btn" id="tg-go">${tt.next}</button>`;
      else if (step.type === 'end') actions = `<button class="tg-btn" id="tg-go">${tt.finish}</button>`;
      else actions = `<button class="tg-link" id="tg-skipstep">${tt.skipStep}</button>`;

      $('tg-card').innerHTML = `
        <span class="tg-badge">${step.type === 'intro' || step.type === 'end' ? '🌱' : tt.step + ' ' + idx + ' ' + tt.of + ' ' + (total - 2)}</span>
        <h3>${tr(step.title)}</h3><p>${tr(step.text)}</p>${body}
        <div class="tg-foot"><div class="tg-dots">${dots}</div>${actions}</div>
        ${step.type === 'end' ? '' : `<div style="text-align:center;margin-top:6px;"><button class="tg-link" id="tg-skip">${tt.skip}</button></div>`}`;

      const go_ = $('tg-go'); if (go_) go_.onclick = advance;
      const ss = $('tg-skipstep'); if (ss) ss.onclick = advance;
      const sk = $('tg-skip'); if (sk) sk.onclick = finish;

      if (step.type === 'click' && cur) {
        const el = cur;
        const hit = () => setTimeout(() => { if (active && steps[idx] === step) advance(); }, step.delay || 450);
        el.addEventListener('click', hit, { once: true });
        cleanup = () => el.removeEventListener('click', hit);
      }
      place();
      requestAnimationFrame(place);
    }, 90);
  }

  function advance() {
    if (idx >= steps.length - 1) { finish(); return; }
    idx++; render();
  }

  function finish() {
    active = false; cur = null;
    if (cleanup) { cleanup(); cleanup = null; }
    root.classList.remove('on');
    try { if (typeof store !== 'undefined') store.set('tourCompleted', true); } catch (e) {}
    try {
      const first = document.querySelector('#screen-farms .farmcard');
      if (typeof selectFarm === 'function' && first) selectFarm('kiambu', first);
      go('home');
    } catch (e) {}
  }

  window.startTour = function () {
    idx = 0; active = true; cur = null;
    root.classList.add('on');
    render();
  };
  window.tourNext = advance;

  window.addEventListener('resize', place);
  window.addEventListener('scroll', () => requestAnimationFrame(place), true);

  setTimeout(() => {
    try { if (typeof store !== 'undefined' && !store.get('tourCompleted', false)) startTour(); } catch (e) {}
  }, 1200);
})();
