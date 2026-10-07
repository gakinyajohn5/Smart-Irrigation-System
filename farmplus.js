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
  var _sf = selectFarm; selectFarm = function () { _sf.apply(this, arguments); calendar(); };
  if (typeof SW !== 'undefined') { SW['Smart forecast'] = 'Utabiri wa busara'; SW['Crop calendar'] = 'Kalenda ya mazao'; }
  forecast(); calendar(); setInterval(forecast, 3000);
})();
