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
    '<button class="btn ghost block" id="rain-btn" style="margin-bottom:14px;">\uD83C\uDF27 Simulate rain (demo)</button>' +
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
    if (simRain) { $('lbl-rain').textContent = 'Simulated rain (demo)'; $('weather-icon').textContent = '\uD83C\uDF27\uFE0F'; }
  };
  window.setSimRain = function (on) {
    on = !!on; if (on === simRain) return; simRain = on;
    rainSoon = on || realRain(); renderWeather(); forecast();
    $('rain-btn').textContent = on ? '\u2600\uFE0F Stop simulated rain' : '\uD83C\uDF27 Simulate rain (demo)';
    pushAlert(on ? 'info' : 'warn', on ? '\uD83C\uDF27' : '\u2600', on ? 'Irrigation skipped \u2014 rain forecast' : 'Simulated rain ended', 'Demo');
  };
  $('rain-btn').addEventListener('click', function () { window.setSimRain(!simRain); });
  setInterval(function () {                                  // soil absorbs rain in the app's own simulation
    if (simRain && typeof simOn !== 'undefined' && simOn && !irrigating) { moisture = Math.min(95, moisture + 1.5); paintRing(); }
  }, 3000);
  var _sf = selectFarm; selectFarm = function () { _sf.apply(this, arguments); calendar(); };
  if (typeof SW !== 'undefined') { SW['Smart forecast'] = 'Utabiri wa busara'; SW['Crop calendar'] = 'Kalenda ya mazao'; }
  forecast(); calendar(); setInterval(forecast, 3000);
})();
