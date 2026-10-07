/* live.js: mirrors the Rootline digital twin (twin.html) into this app over MQTT (WebSocket).
   - Every zone, the tank, battery and pump follow what you change on the dashboard.
   - The last twin state is remembered, so the app restores it on reload and when offline.
   - If the twin goes quiet for 8 s, the app keeps going from the last values with its own simulation. */
(function () {
  var ROOM = 'gakinya-rl-8h2q9x4m';           // must match twin.html
  var ZONE = 1;                                // twin zone shown on the main ring: 0 Greenhouses, 1 Open Field, 2 Orchard
  var FARM = 'kiambu';                         // twin zones 0..2 drive this farm's Zone A..C
  var S = 'rootline/' + ROOM + '/state', E = 'rootline/' + ROOM + '/events', KEY = 'rl-last-state';
  var CMD = 'rootline/' + ROOM + '/cmd';
  window.sendTwinCmd = function () { return false; };            // replaced once the MQTT link exists
  var linked = false, lastMsg = 0, btn = document.getElementById('live-toggle');
  function badge() { if (btn) btn.innerHTML = '<span class="dot"></span>' + (linked ? 'LIVE \u00B7 TWIN' : 'LIVE'); }
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }); }
  function $(id) { return document.getElementById(id); }

  function apply(d, fromTwin) {
    var z = d && d.zones && d.zones[ZONE]; if (!z) return;
    if (fromTwin) simOn = false;                                   // twin is driving: stop the random simulation
    moisture = z.m; battery = d.batt; tank = d.tank; irrigating = !!z.p;
    if (typeof setSimRain === 'function') setSimRain(!!d.rain);   // dashboard rain -> app rain
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
  try { var saved = JSON.parse(localStorage.getItem(KEY)); if (saved) apply(saved, false); } catch (e) {}

  if (typeof mqtt === 'undefined') return;                         // CDN blocked: keep going from the remembered state
  var c = mqtt.connect('wss://broker.hivemq.com:8884/mqtt', { clientId: 'app-' + Math.random().toString(16).slice(2, 8), reconnectPeriod: 2000 });
  window.sendTwinCmd = function (o) { if (!c.connected) return false; c.publish(CMD, JSON.stringify(o)); return true; };
  c.on('connect', function () { c.subscribe([S, E]); });
  c.on('message', function (topic, buf) {
    var d; try { d = JSON.parse(buf.toString()); } catch (e) { return; }
    if (topic === E) { pushAlert(d.level === 'warn' ? 'warn' : 'info', d.level === 'warn' ? '\u26A0' : '\u2713', esc(d.msg), 'Live from digital twin'); return; }
    lastMsg = Date.now(); if (!linked) { linked = true; badge(); }
    apply(d, true);
  });
  setInterval(function () { if (linked && Date.now() - lastMsg > 8000) { linked = false; simOn = true; badge(); } }, 2000);
})();
