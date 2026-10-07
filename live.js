/* live.js: mirrors the Rootline digital twin into this app over MQTT (WebSocket).
   If the twin or the network goes quiet for 8 s, the app falls back to its own simulation. */
(function () {
  var ROOM = 'gakinya-rl-8h2q9x4m';           // must match twin.html
  var ZONE = 1;                    // twin zone shown on the main ring: 0 Greenhouses, 1 Open Field, 2 Orchard
  var S = 'rootline/' + ROOM + '/state', E = 'rootline/' + ROOM + '/events';
  if (typeof mqtt === 'undefined') return;                       // CDN blocked: keep simulating
  var linked = false, lastMsg = 0, btn = document.getElementById('live-toggle');
  function badge() { if (btn) btn.innerHTML = '<span class="dot"></span>' + (linked ? 'LIVE \u00B7 TWIN' : 'LIVE'); }
  var c = mqtt.connect('wss://broker.hivemq.com:8884/mqtt', { clientId: 'app-' + Math.random().toString(16).slice(2, 8), reconnectPeriod: 2000 });
  c.on('connect', function () { c.subscribe([S, E]); });
  c.on('message', function (topic, buf) {
    var d; try { d = JSON.parse(buf.toString()); } catch (e) { return; }
    if (topic === E) { pushAlert(d.level === 'warn' ? 'warn' : 'info', d.level === 'warn' ? '\u26A0' : '\u2713', String(d.msg == null ? '' : d.msg).replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }), 'Live from digital twin'); return; }
    var z = d.zones && d.zones[ZONE]; if (!z) return;
    lastMsg = Date.now(); if (!linked) { linked = true; badge(); }
    simOn = false;                                               // stop the app's random simulation
    moisture = z.m; battery = d.batt; tank = d.tank; irrigating = !!z.p;
    paintRing();
    document.getElementById('tank-fill').style.width = tank + '%';
    document.getElementById('tank-val').textContent = Math.round(tank) + '%';
    document.getElementById('irrigation-status').innerHTML = z.p ? '<span class="pumping">\u25CF Irrigating Zone A\u2026</span>' : 'Live from digital twin';
  });
  setInterval(function () { if (linked && Date.now() - lastMsg > 8000) { linked = false; simOn = true; badge(); } }, 2000);
})();
