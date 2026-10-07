/* weather.js: weekly forecast + irrigation advisor. Real 7-day data from Open-Meteo; today/tomorrow follow the digital twin when it is live. */
(function () {
  var $ = function (id) { return document.getElementById(id); }, KEY = 'rl-week', days = [], tw = null, live = false, askShown = false;
  var DN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  function icon(c) { return c === 0 ? '\u2600\uFE0F' : c <= 2 ? '\u26C5' : c <= 3 ? '\u2601\uFE0F' : c <= 48 ? '\uD83C\uDF2B\uFE0F' : (c <= 67 || (c >= 80 && c <= 82)) ? '\uD83C\uDF27\uFE0F' : c >= 95 ? '\u26C8\uFE0F' : '\uD83C\uDF26\uFE0F'; }
  function sunIcon(s, rain) { return rain ? '\uD83C\uDF27\uFE0F' : s >= 70 ? '\u2600\uFE0F' : s >= 30 ? '\u26C5' : s > 0 ? '\u2601\uFE0F' : '\uD83C\uDF19'; }
  var nav = document.querySelector('nav'), home = $('screen-home'); if (!nav || !home) return;
  var scr = document.createElement('div'); scr.className = 'screen'; scr.id = 'screen-week';
  scr.innerHTML = '<button class="back" onclick="go(\'home\')">\u2190 Field</button><h1 class="serif" style="margin:0 0 4px;font-size:20px;">Weather this week</h1><div id="wk-note" style="font-size:11px;opacity:.75;margin-bottom:10px;"></div><div id="wk-days"></div>';
  nav.before(scr);
  var tab = nav.querySelector('[data-s="ledger"]');
  if (tab) tab.insertAdjacentHTML('afterend', '<button data-s="week" onclick="go(\'week\')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="9" cy="9" r="3.5"/><path d="M9 2v2M2 9h2M4 4l1.4 1.4M14 4l-1.4 1.4"/><path d="M8 20h9a3.5 3.5 0 000-7 5 5 0 00-9.5-1A4 4 0 008 20z"/></svg>Week</button>');
  home.insertAdjacentHTML('afterbegin', '<div class="gauge" id="wx-strip" style="margin-bottom:12px;text-align:left;cursor:pointer;" onclick="go(\'week\')"><b id="wx-main" style="font-size:15px;">\u2026</b><span id="wx-sub"></span><div id="wx-ask" style="display:none;margin-top:8px;" onclick="event.stopPropagation()"><div id="wx-q" style="font-weight:600;font-size:13px;margin-bottom:6px;"></div><button class="btn" data-ans="1">\uD83D\uDCA7 Irrigate tonight</button> <button class="btn ghost" data-ans="0">Skip, rain is coming</button></div></div>');
  $('wx-ask').addEventListener('click', function (e) {
    var b = e.target.closest('[data-ans]'); if (!b) return;
    var ok = window.sendTwinCmd && window.sendTwinCmd({ type: 'decision', irrigate: b.dataset.ans === '1' });
    $('wx-q').textContent = ok ? 'Answer sent.' : 'Not connected to the dashboard. Try again.';
  });
  function eff() {                                         // real forecast, with today/tomorrow overridden by the twin
    var d = days.map(function (x) { return Object.assign({}, x); });
    if (live && tw && d.length > 1) {
      d[0].rain = tw.rp0; d[0].hi = Math.round(tw.temp); d[0].sun = tw.sun; d[0].icon = sunIcon(tw.sun, tw.rp0 > 75);
      d[1].rain = tw.rp1; d[1].icon = icon(tw.rp1 > 75 ? 61 : d[1].code);
    }
    return d;
  }
  function plan(x) { return x.rain > 75 ? 'Skip: rain' : x.hi >= 30 ? 'Short, cool hours' : 'Normal'; }
  function paint() {
    var d = eff(), t = d[0]; if (!t) return;
    var rain = t.rain, sun = live && tw ? tw.sun : null;
    $('wx-main').textContent = (t.icon || icon(t.code)) + ' ' + t.hi + '\u00B0C \u00B7 ' + (sun != null ? 'Sun ' + sun + '% \u00B7 ' : '') + 'Rain ' + rain + '%';
    var msg = live && tw && tw.skip ? 'Rain likely today: irrigation skipped. It rechecks at ' + tw.irrH + ':00 and irrigates if it stays dry.'
      : live && tw && tw.heat ? 'Strong sun: irrigation is held to cooler hours and cycles are shorter.'
      : !live && rain > 75 ? 'Rain likely today: irrigation will be skipped.' : 'Irrigation runs normally. Tap for the week.';
    $('wx-sub').textContent = msg;
    var ask = live && tw && tw.ask; $('wx-ask').style.display = ask ? 'block' : 'none';
    if (ask) { if (!askShown) { askShown = true; $('wx-q').textContent = 'Rain is likely tomorrow (' + tw.rp1 + '%). Irrigate tonight?'; pushAlert('warn', '\uD83C\uDF27', 'Rain likely tomorrow (' + tw.rp1 + '%): irrigate tonight?', 'Answer on the Field screen'); } } else askShown = false;
    $('wk-note').textContent = live ? 'Today and tomorrow follow the digital twin; the rest is the live forecast.' : 'Live forecast for this farm.';
    $('wk-days').innerHTML = d.map(function (x, i) {
      var dt = new Date(x.date + 'T12:00:00'), hot = x.rain > 75;
      return '<div class="report-row" style="align-items:center;"><span><b>' + (i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : DN[dt.getDay()]) + '</b> ' + (x.icon || icon(x.code)) + '<br><small style="opacity:.75">' + x.lo + '\u2013' + x.hi + '\u00B0C \u00B7 ' + (x.sun != null ? 'Sun ' + x.sun + '%' : '') + '</small></span><span class="v" style="text-align:right;' + (hot ? 'color:var(--rust);' : '') + '">' + x.rain + '% rain<br><small>\uD83D\uDCA7 ' + plan(x) + '</small></span></div>';
    }).join('');
  }
  function load() {
    var f = farms[curFarm]; if (!f) return;
    fetch('https://api.open-meteo.com/v1/forecast?latitude=' + f.lat + '&longitude=' + f.lon + '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&forecast_days=7')
      .then(function (r) { return r.json(); }).then(function (j) {
        var q = j.daily; days = q.time.map(function (t, i) { return { date: t, code: q.weather_code[i], hi: Math.round(q.temperature_2m_max[i]), lo: Math.round(q.temperature_2m_min[i]), rain: q.precipitation_probability_max[i] || 0 }; });
        try { localStorage.setItem(KEY, JSON.stringify(days)); } catch (e) {} paint();
      }).catch(function () {});
  }
  try { var c = JSON.parse(localStorage.getItem(KEY)); if (Array.isArray(c)) days = c; } catch (e) {}
  var _sf = selectFarm; selectFarm = function () { _sf.apply(this, arguments); load(); };
  window.addEventListener('twin', function (e) { tw = e.detail.d; live = e.detail.live; paint(); });
  if (window.__twinLast) { tw = window.__twinLast; paint(); }
  paint(); load(); setInterval(load, 3600000);
})();
