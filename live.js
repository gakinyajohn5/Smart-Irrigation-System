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

  // MQTT data is untrusted (public broker): coerce every field to a safe type and range before use
  function num(v, lo, hi, def) { v = +v; return isFinite(v) ? Math.min(hi, Math.max(lo, v)) : def; }
  function clean(d) {
    if (!d || typeof d !== 'object' || !Array.isArray(d.zones) || d.zones.length < 3) return null;
    return {
      ts: num(d.ts, 0, 8.64e15, 0), sun: num(d.sun, 0, 100, 0), tank: num(d.tank, 0, 100, 0), batt: num(d.batt, 0, 100, 0),
      master: ['auto', 'on', 'off'].indexOf(d.master) >= 0 ? d.master : 'auto', rain: !!d.rain, clock: num(d.clock, 0, 24, 0), auto: !!d.auto,
      solar: num(d.solar, 0, 1000, 0), faults: Array.isArray(d.faults) ? d.faults.slice(0, 10).map(function (f) { return String(f).slice(0, 120); }) : [],
      zones: d.zones.slice(0, 3).map(function (z) {
        z = z || {};
        return { m: num(z.m, 0, 100, 0), t: num(z.t, -20, 60, 20), h: Math.round(num(z.h, 0, 100, 0)), p: z.p ? 1 : 0, mode: z.mode === 'manual' ? 'manual' : 'auto', ph: num(z.ph, 3.5, 9, 6.5) };
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
      var acid = tz.ph != null && tz.ph < 5.6;
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
      if (zb.ph != null) { var gp = document.querySelector('#gauge-ph b'); if (gp) gp.textContent = zb.ph.toFixed(1); var gpe = $('gauge-ph'); if (gpe) gpe.classList.toggle('warn', zb.ph < 5.6); }
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
    if (topic === E) { if (!d || typeof d !== 'object') return; pushAlert(d.level === 'warn' ? 'warn' : 'info', d.level === 'warn' ? '\u26A0' : '\u2713', esc(String(d.msg).slice(0, 200)), 'Live from digital twin'); return; }
    d = clean(d); if (!d) return;
    if (!d.ts || Math.abs(Date.now() - d.ts) > 30000) { apply(d, false); return; }   // old retained message: show it as "last known", not live
    lastMsg = Date.now(); if (!linked) { linked = true; badge(); }
    apply(d, true);
  });
  setInterval(function () { if (linked && Date.now() - lastMsg > 8000) { linked = false; simOn = true; badge(); } }, 2000);
})();
