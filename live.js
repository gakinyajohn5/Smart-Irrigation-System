/* live.js: mirrors the Rootline digital twin (twin.html) into this app over MQTT (WebSocket).
   - Every zone, the tank, battery and pump follow what you change on the dashboard.
   - The last twin state is remembered, so the app restores it on reload and when offline.
   - If the twin goes quiet for 8 s, the app keeps going from the last values with its own simulation. */
(function () {
  var ROOM = 'gakinya-rl-8h2q9x4m';           // must match twin.html
  var ZONE = 0;                                // twin zone shown on the main ring (labelled Zone A): 0 Greenhouses, 1 Open Field, 2 Orchard
  var FARM = 'kiambu';                         // twin zones 0..2 drive this farm's Zone A..C
  var S = 'rootline/' + ROOM + '/state', E = 'rootline/' + ROOM + '/events', KEY = 'rl-last-state';
  var CMD = 'rootline/' + ROOM + '/cmd';
  window.sendTwinCmd = function () { return false; };            // replaced once the MQTT link exists
  var linked = false, lastMsg = 0, btn = document.getElementById('live-toggle');
  function badge() { if (btn) btn.innerHTML = '<span class="dot"></span>' + (linked ? 'LIVE \u00B7 TWIN' : 'LIVE'); }
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }); }
  function $(id) { return document.getElementById(id); }
  function beep() { try { var A = window.AudioContext || window.webkitAudioContext, a = new A(), o = a.createOscillator(), g = a.createGain(); o.connect(g); g.connect(a.destination); o.frequency.value = 880; g.gain.value = .08; o.start(); setTimeout(function () { o.stop(); a.close(); }, 220); } catch (e) {} }
  function sysNote(msg) { try { if (window.Notification && Notification.permission === 'granted') { if (navigator.serviceWorker && navigator.serviceWorker.ready) navigator.serviceWorker.ready.then(function (r) { r.showNotification('Smart Irrigation', { body: msg, icon: 'icon-192.png' }); }); else new Notification('Smart Irrigation', { body: msg }); } } catch (e) {} }
  document.addEventListener('click', function once() { document.removeEventListener('click', once); try { if (window.Notification && Notification.permission === 'default') Notification.requestPermission(); } catch (e) {} });
  var seen = {}, lastPop = 0;                                    // fewer notifications: warnings only, no repeats, no bursts
  function shouldNotify(d) {
    var warn = d.level === 'warn', act = Number.isInteger(d.stop) || !!d.ask || !!d.keep, keep = !!d.keep || Number.isInteger(d.stop), now = Date.now(), k = String(d.msg).slice(0, 80);
    if (!warn && !act) return false;                             // routine info stays out of the farmer's way
    if (seen[k] && now - seen[k] < (keep ? 10000 : 120000)) return false;   // same message again (10 s for irrigation start/done, 2 min otherwise)
    if (!warn && !d.ask && !keep && now - lastPop < 30000) return false;   // quiet period after any popup
    seen[k] = now; lastPop = now; return true;
  }
  window.farmPopup = function (m) { popup(false, m); };
  function popup(warn, msg, x) {                                 // alert card that pops out; warnings stay until dismissed
    if (!$('rl-pops')) {
      var st = document.createElement('style');
      st.textContent = '@keyframes rlpop{0%{transform:translateY(-30px) scale(.9);opacity:0}60%{transform:translateY(4px) scale(1.02);opacity:1}100%{transform:none}}#rl-pops{position:fixed;top:10px;left:0;right:0;z-index:99999;display:flex;flex-direction:column;align-items:center;gap:8px;pointer-events:none}.rl-pop{pointer-events:auto;width:min(92%,380px);background:#fff;color:#1b2b21;border-radius:16px;border-left:6px solid #2F5A3E;box-shadow:0 12px 34px rgba(0,0,0,.35);padding:12px 14px;animation:rlpop .35s ease-out}.rl-pop.warn{border-left-color:#d9541a}.rl-pop b{font-size:14px;display:block;margin-bottom:2px}.rl-pop p{margin:0;font-size:13px;line-height:1.35}.rl-b{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}.rl-pop button{border:0;border-radius:10px;padding:7px 12px;font-size:12px;font-weight:700;background:#2F5A3E;color:#fff;cursor:pointer}.rl-pop button.g{background:#e6ece8;color:#1b2b21}';
      document.head.appendChild(st); var w0 = document.createElement('div'); w0.id = 'rl-pops'; document.body.appendChild(w0);
    }
    var w = $('rl-pops'), c = document.createElement('div'), h = document.createElement('b'), p = document.createElement('p'), bs = document.createElement('div');
    c.className = 'rl-pop' + (warn ? ' warn' : ''); bs.className = 'rl-b';
    h.textContent = warn ? '\u26A0 Farm alert' : '\uD83D\uDCA7 Farm update'; p.textContent = msg; c.appendChild(h); c.appendChild(p); c.appendChild(bs);
    function btn(t, cls, fn) { var b = document.createElement('button'); b.textContent = t; if (cls) b.className = cls; b.onclick = function () { if (fn) fn(); c.remove(); }; bs.appendChild(b); }
    if (x && Number.isInteger(x.stop) && x.stop >= 0 && x.stop < 3) { var jn; try { jn = farms[FARM].jars[x.stop].name; } catch (e) {} btn('\u25A0 Stop ' + (jn || 'Zone ' + (x.stop + 1)), '', function () { window.sendTwinCmd({ type: 'stop', zone: x.stop }); }); }
    if (x && x.ask) { var mo = x.sched !== 'evening'; btn(mo ? '\uD83D\uDCA7 Irrigate anyway' : '\uD83D\uDCA7 Irrigate tonight', '', function () { window.sendTwinCmd({ type: 'decision', irrigate: true }); }); btn(mo ? 'Skip tomorrow: rain is coming' : 'Skip: rain is coming', 'g', function () { window.sendTwinCmd({ type: 'decision', irrigate: false }); }); }
    btn('OK', 'g');
    w.prepend(c); while (w.children.length > 1) w.lastChild.remove();
    if (!warn) setTimeout(function () { c.remove(); }, 10000);
    if (warn) { try { navigator.vibrate && navigator.vibrate([200, 100, 200]); } catch (e) {} beep(); }
    if (document.hidden) sysNote(msg);
  }

  // MQTT data is untrusted (public broker): coerce every field to a safe type and range before use
  function num(v, lo, hi, def) { v = +v; return isFinite(v) ? Math.min(hi, Math.max(lo, v)) : def; }
  function clean(d) {
    if (!d || typeof d !== 'object' || !Array.isArray(d.zones) || d.zones.length < 3) return null;
    return {
      ts: num(d.ts, 0, 8.64e15, 0), sun: num(d.sun, 0, 100, 0), tank: num(d.tank, 0, 100, 0), batt: num(d.batt, 0, 100, 0),
      master: ['auto', 'on', 'off'].indexOf(d.master) >= 0 ? d.master : 'auto', rain: !!d.rain, clock: num(d.clock, 0, 24, 0), auto: !!d.auto,
      solar: num(d.solar, 0, 1000, 0), temp: num(d.temp, -10, 60, 26), rp0: num(d.rp0, 0, 100, 0), rp1: num(d.rp1, 0, 100, 0), pause: num(d.pause, 0, 168, 0), sched: d.sched === 'evening' ? 'evening' : 'morning', win: Array.isArray(d.win) ? [num(d.win[0], 0, 24, 5), num(d.win[1], 0, 24, 9)] : null, skip: !!d.skip, heat: !!d.heat, ask: !!d.ask, faults: Array.isArray(d.faults) ? d.faults.slice(0, 10).map(function (f) { return String(f).slice(0, 120); }) : [],
      zones: d.zones.slice(0, 3).map(function (z) {
        z = z || {};
        return { m: num(z.m, 0, 100, 0), t: num(z.t, -20, 60, 20), h: Math.round(num(z.h, 0, 100, 0)), p: z.p ? 1 : 0, mode: z.mode === 'manual' ? 'manual' : 'auto', ph: num(z.ph, 3.5, 9, 6.5), crop: String(z.crop == null ? '' : z.crop).replace(/[^A-Za-z0-9 \-]/g, '').slice(0, 24), wait: z.wait ? 1 : 0 };
      })
    };
  }

  function apply(d, fromTwin) {
    var z = d && d.zones && d.zones[ZONE]; if (!z) return;
    if (fromTwin) simOn = false;                                   // twin is driving: stop the random simulation
    moisture = z.m; battery = d.batt; tank = d.tank; irrigating = !!z.p;
    if (fromTwin && typeof setSimRain === 'function') setSimRain(!!d.rain);   // dashboard rain -> app rain
    paintRing();
    $('tank-fill').style.width = tank + '%';
    $('tank-val').textContent = Math.round(tank) + '%';
    $('irrigation-status').innerHTML = z.p ? '<span class="pumping">\u25CF Irrigating Zone A\u2026</span>' : (fromTwin ? 'Live from digital twin' : 'Last known state');
    // every twin zone -> the matching zone jar on the Home screen
    var jars = $('jars-list') ? $('jars-list').children : [], f = farms[FARM];
    d.zones.forEach(function (tz, i) {
      if (!f.jars[i]) return;
      f.jars[i].fill = Math.round(tz.m);
      if (tz.crop && window.cropOf) { var nm = cropOf(tz.crop).name; if (f.jars[i].sub !== nm) { f.jars[i].sub = nm; if (curFarm === FARM && jars[i] && jars[i].querySelector('.jar-sub')) jars[i].querySelector('.jar-sub').textContent = nm; } }
      var cr = window.cropOf ? cropOf(tz.crop || f.jars[i].sub) : null, acid = tz.ph != null && (cr ? (tz.ph < cr.ph[0] || tz.ph > cr.ph[1]) : tz.ph < 5.6);   // out of range for THIS crop
      if (tz.ph != null) { f.jars[i].ph = tz.ph.toFixed(1); f.jars[i].color = acid ? 'var(--rust)' : ''; }
      if (curFarm === FARM && jars[i]) {
        var fill = jars[i].querySelector('.jar-fill'), ph = jars[i].querySelector('.jar-ph');
        if (fill) { fill.style.height = Math.round(tz.m) + '%'; fill.style.background = acid ? 'var(--rust)' : ''; }
        if (ph && tz.ph != null) { ph.textContent = 'pH ' + tz.ph.toFixed(1); ph.style.color = acid ? '#8a3a00' : ''; }
      }
    });
    // zone detail screen shows twin zone 2 (Open Field = Zone B)
    var zb = d.zones[1];
    if (zb) {
      var gm = document.querySelector('#gauge-moisture b'), gt = document.querySelector('#gauge-temp b');
      if (zb.ph != null) { var gp = document.querySelector('#gauge-ph b'); if (gp) gp.textContent = zb.ph.toFixed(1); var gpe = $('gauge-ph'), cb = window.cropOf ? cropOf(zb.crop || (f.jars[1] && f.jars[1].sub)) : null; if (gpe) gpe.classList.toggle('warn', cb ? (zb.ph < cb.ph[0] || zb.ph > cb.ph[1]) : zb.ph < 5.6); }
      if (gm) gm.textContent = Math.round(zb.m) + '%'; if (gt) gt.textContent = Math.round(zb.t) + '\u00B0C';
    }
    window.__twinLast = d;
    window.dispatchEvent(new CustomEvent('twin', { detail: { d: d, live: !!fromTwin } }));
    try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) {}
  }

  // 1. Remember: restore the last twin state straight away (before the network answers)
  try { var saved = clean(JSON.parse(localStorage.getItem(KEY))); if (saved) apply(saved, false); } catch (e) {}

  if (typeof mqtt === 'undefined') return;                         // CDN blocked: keep going from the remembered state
  var c = mqtt.connect('wss://broker.hivemq.com:8884/mqtt', { clientId: 'app-' + Math.random().toString(16).slice(2, 8), reconnectPeriod: 2000 });
  window.sendTwinCmd = function (o) { if (!c.connected || !linked) return false; /* broker up AND twin alive */ c.publish(CMD, JSON.stringify(o)); return true; };
  c.on('connect', function () { c.subscribe([S, E]); });
  c.on('message', function (topic, buf) {
    var d; try { d = JSON.parse(buf.toString()); } catch (e) { return; }
    if (topic === E) { if (!d || typeof d !== 'object') return; if (!shouldNotify(d)) return; popup(d.level === 'warn', String(d.msg).slice(0, 200), d); pushAlert(d.level === 'warn' ? 'warn' : 'info', d.level === 'warn' ? '\u26A0' : '\u2713', esc(String(d.msg).slice(0, 200)), 'Live from digital twin'); return; }
    d = clean(d); if (!d) return;
    if (!d.ts || Math.abs(Date.now() - d.ts) > 30000) { apply(d, false); return; }   // old retained message: show it as "last known", not live
    lastMsg = Date.now(); if (!linked) { linked = true; badge(); }
    apply(d, true);
  });
  setInterval(function () { if (linked && Date.now() - lastMsg > 8000) { linked = false; simOn = true; badge(); } }, 2000);
})();
