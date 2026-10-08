/* Smart forecast + crop calendar (adds two cards to the Home screen) */
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var DRY_PER_HOUR = 1.2, THRESHOLD = 34;           // % moisture lost per hour, auto-irrigation trigger
  var CAL = {                                        // crop -> [week, task]
    Tomatoes: [[3, 'Stake plants, weed'], [6, 'Top-dress with CAN, spray for blight'], [11, 'First harvest']],
    Cabbage:  [[3, 'Weed, thin seedlings'], [6, 'Top-dress, check for aphids'], [12, 'Harvest heads']],
    Maize:    [[3, 'Weed, gap-fill'], [6, 'Top-dress with CAN'], [16, 'Harvest when husks dry']],
    Beans:    [[2, 'Weed lightly'], [5, 'Check for rust and aphids'], [10, 'Harvest dry pods']],
    Potatoes: [[3, 'Weed, earth-up'], [6, 'Earth-up again, spray for blight'], [13, 'Harvest tubers']],
    Sorghum:  [[3, 'Thin and weed'], [8, 'Scare birds, check for pests'], [16, 'Harvest heads']]
  };
  var anchor = $('lbl-rec'); if (!anchor) return;
  anchor.insertAdjacentHTML('beforebegin',
    '<h2 class="section">Smart forecast</h2><div class="gauge" id="fc-card" style="margin-bottom:16px;text-align:left;"><b id="fc-main" style="font-size:15px;">…</b><span id="fc-sub"></span></div>' +
    '<h2 class="section">Crop calendar</h2><div id="cal-card" style="margin-bottom:18px;"></div>');
  function forecast() {
    if (typeof moisture === 'undefined') return;
    var m = Math.round(moisture), hrs = Math.max(0, (moisture - THRESHOLD) / DRY_PER_HOUR);
    var rain = typeof rainSoon !== 'undefined' && rainSoon;
    $('fc-main').textContent = m <= THRESHOLD ? 'Soil is dry now (' + m + '%)' :
      'Dry in about ' + (hrs < 1 ? 'under 1 hour' : Math.round(hrs) + ' hours');
    $('fc-sub').textContent = rain ? 'Rain is forecast, so irrigation will be skipped and water saved.'
      : m <= THRESHOLD ? 'Irrigation will start automatically.' : 'Irrigation starts automatically when moisture reaches ' + THRESHOLD + '%.';
  }
  function calendar() {
    var f = farms[curFarm], html = '';
    f.jars.forEach(function (j) {
      var t = CAL[j.sub]; if (!t) return;
      html += '<div class="report-row"><span><b>' + j.name + ' · ' + j.sub + '</b><br><small style="opacity:.75">' +
        t.map(function (x) { return 'Wk ' + x[0] + ': ' + x[1]; }).join('<br>') + '</small></span></div>';
    });
    $('cal-card').innerHTML = html || '<div style="font-size:12px">No calendar for these crops yet.</div>';
  }
  /* Rain simulation: the forecast/temperature shown stay REAL (Open-Meteo); this only layers a demo rain on top */
  var simRain = false;
  function realRain() { return !!(typeof weather !== 'undefined' && weather && weather.hoursAway !== -1); }
  var _rw = renderWeather;
  renderWeather = function () {
    if (simRain) rainSoon = true;
    _rw();
    if (simRain) { $('lbl-rain').textContent = 'Raining at the farm (live)'; $('weather-icon').textContent = '\uD83C\uDF27\uFE0F'; }
  };
  window.setSimRain = function (on) {
    on = !!on; if (on === simRain) return; simRain = on;
    rainSoon = on || realRain(); renderWeather(); forecast();
    if (on) { pushAlert('info', '\uD83C\uDF27', 'It is raining now \u2014 irrigation skipped', 'Live from digital twin'); if (window.farmPopup) window.farmPopup('\uD83C\uDF27 It is raining now at the farm. Irrigation is skipped.'); }
  };
  setInterval(function () {                                  // soil absorbs rain in the app's own simulation
    if (simRain && typeof simOn !== 'undefined' && simOn && !irrigating) { moisture = Math.min(95, moisture + 1.5); paintRing(); }
  }, 3000);
  var _sf = selectFarm; selectFarm = function () { _sf.apply(this, arguments); calendar(); };
  if (typeof SW !== 'undefined') { SW['Smart forecast'] = 'Utabiri wa busara'; SW['Crop calendar'] = 'Kalenda ya mazao'; }
  forecast(); calendar(); setInterval(forecast, 3000);
})();

/* ---- Full data screen + irrigate (talks to the dashboard over MQTT; falls back to the app simulation) ---- */
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var nav = document.querySelector('nav'); if (!nav) return;
  var zn = function (i) { var j = farms.kiambu.jars[i]; return j ? j.name + ' \u00B7 ' + j.sub : 'Zone ' + (i + 1); };
  var scr = document.createElement('div'); scr.className = 'screen'; scr.id = 'screen-data';
  scr.innerHTML = '<button class="back" onclick="go(\'home\')">\u2190 Field</button>' +
    '<h1 class="serif" style="margin:0 0 6px;font-size:20px;">Full farm data</h1>' +
    '<div id="dt-status" style="font-size:11px;margin-bottom:10px;opacity:.8;"></div>' +
    '<div id="dt-faults" style="font-size:12px;font-weight:600;margin-bottom:12px;"></div>' +
    '<h2 class="section">Power and water</h2><div id="dt-sys"></div>' +
    [0, 1, 2].map(function (i) {
      return '<h2 class="section" style="margin-top:14px;">' + zn(i) + '</h2><div id="dt-z' + i + '"></div>' +
        '<div style="display:flex;gap:8px;margin:8px 0 4px;"><button class="btn" data-irr="' + i + '">\uD83D\uDCA7 Irrigate 15 s</button><button class="btn ghost" data-stop="' + i + '">Stop</button></div>';
    }).join('') + '<div id="dt-msg" style="font-size:12px;color:var(--leaf-dk);min-height:16px;margin:8px 0 14px;"></div>';
  nav.before(scr);
  var fc = $('fc-card'), anchor = fc && fc.previousElementSibling; if (anchor) anchor.insertAdjacentHTML('beforebegin', '<button class="btn block" style="margin-bottom:10px;" onclick="go(\'data\')">\uD83D\uDCCA Full data &amp; irrigate</button>');
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }); }
  function row(k, v) { return '<div class="report-row"><span>' + k + '</span><span class="v">' + esc(v) + '</span></div>'; }
  function hhmm(c) { return ('0' + Math.floor(c)).slice(-2) + ':' + ('0' + Math.floor((c % 1) * 60)).slice(-2); }
  function draw(d, live) {
    if (!d) return;
    $('dt-status').textContent = live ? 'Live from the digital twin' : 'Last known data (dashboard not connected)';
    var f = d.faults || [], fe = $('dt-faults');
    fe.textContent = f.length ? '\u26A0 ' + f.join(' \u2022 ') : '\u2713 No faults'; fe.style.color = f.length ? 'var(--rust)' : 'var(--leaf-dk)';
    var pump = d.zones.some(function (z) { return z.p; });
    scr.querySelectorAll('[data-irr]').forEach(function (b) { b.disabled = !!d.rain; b.style.opacity = d.rain ? .45 : 1; b.textContent = d.rain ? '\uD83C\uDF27 Blocked: raining' : '\uD83D\uDCA7 Irrigate 15 s'; });
    $('dt-sys').innerHTML = row('Time of day', d.clock != null ? hhmm(d.clock) + (d.sun === 0 ? ' (night)' : '') : '--') + row('Sunlight', d.sun + '%') +
      row('Solar power', (d.solar != null ? d.solar : '--') + ' W') + row('Battery', Math.round(d.batt) + '%') + row('Water tank', Math.round(d.tank) + '%') +
      row('Pump', pump ? 'RUNNING' : 'Idle') + row('Rain', d.rain ? 'Simulated rain' : 'None');
    d.zones.forEach(function (z, i) {
      if (!$('dt-z' + i)) return;
      $('dt-z' + i).innerHTML = row('Moisture', Math.round(z.m) + '%') + row('Temperature', Math.round(z.t) + '\u00B0C') + row('Humidity', z.h + '%') +
        row('Soil pH', z.ph != null ? z.ph.toFixed(1) : '--') + row('Valve', z.p ? 'OPEN' : 'Closed') + row('Mode', String(z.mode).toUpperCase());
    });
  }
  window.addEventListener('twin', function (e) { draw(e.detail.d, e.detail.live); });
  if (window.__twinLast) draw(window.__twinLast, false);
  scr.addEventListener('click', function (e) {
    var b = e.target.closest('[data-irr],[data-stop]'); if (!b) return;
    if (b.dataset.stop != null) { var ok = window.sendTwinCmd && window.sendTwinCmd({ type: 'stop', zone: +b.dataset.stop }); $('dt-msg').textContent = ok ? 'Stop command sent.' : 'Not connected to the dashboard.'; }
    else window.irrigateZone(+b.dataset.irr);
  });
  window.irrigateZone = function (i, opt) {
    if (window.__twinLast && window.__twinLast.rain) {
      var m = 'Irrigation blocked: it is raining at the farm.';
      pushAlert('warn', '\uD83C\uDF27', m, 'Wait until the rain stops'); if ($('dt-msg')) $('dt-msg').textContent = m; return;
    }
    if (window.careGuard && !(opt && opt.confirmed)) { window.careGuard(i, function () { window.irrigateZone(i, { confirmed: true }); }); return; }   // plant-aware warning first
    var ok = window.sendTwinCmd && window.sendTwinCmd({ type: 'irrigate', zone: i, seconds: 15, confirm: !!(opt && opt.confirmed) }), msg;
    if (ok) msg = 'Irrigation command sent to ' + zn(i) + ' (15 s). The dashboard may refuse it if the tank is empty or power is out.';
    else { msg = 'Dashboard not connected: irrigating in the app simulation.'; if (typeof simOn !== 'undefined' && simOn && !irrigating) { irrigating = true; irrigTicksLeft = 4; pushAlert('info', '\uD83D\uDCA7', 'Irrigation started \u2014 ' + zn(i), 'App simulation'); if (window.farmPopup) window.farmPopup('Irrigation started in ' + zn(i) + '.'); } }
    if ($('dt-msg')) $('dt-msg').textContent = msg;
  };
})();
