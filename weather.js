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
  var PK = 'rl-pause', until = 0; try { until = +localStorage.getItem(PK) || 0; } catch (e) {} window.__pauseUntil = until;
  function paused() { return live && tw ? tw.pause > 0 : until > Date.now(); }
  function left() { return ((live && tw ? tw.pause : (until - Date.now()) / 3600000)).toFixed(1) + ' h'; }
  function setLocal(ms) { until = ms; window.__pauseUntil = ms; try { localStorage.setItem(PK, ms); } catch (e) {} }
  function pz() { var p = paused(); $('pz-status').textContent = p ? ' \u23F8 Paused: ' + left() + ' left' : ' Irrigation is not paused'; $('pz-resume').style.display = p ? '' : 'none'; }
  $('wx-strip').insertAdjacentHTML('afterend', '<div class="gauge" id="pz-card" style="margin-bottom:12px;text-align:left;"><b style="font-size:14px;">Do not irrigate</b><span id="pz-status"></span><div style="display:flex;gap:6px;margin-top:6px;flex-wrap:wrap;align-items:center;"><select id="pz-h"><option value="6">6 hours</option><option value="12">12 hours</option><option value="24" selected>1 day</option><option value="48">2 days</option><option value="72">3 days</option><option value="168">1 week</option></select><button class="btn" id="pz-go">Pause irrigation</button><button class="btn ghost" id="pz-resume">Resume</button></div><div id="pz-msg" style="font-size:12px;min-height:14px;margin-top:6px;"></div></div>');
  $('pz-card').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return; var hrs = +$('pz-h').value, m = $('pz-msg');
    if (b.id === 'pz-go') { if (window.sendTwinCmd({ type: 'pause', hours: hrs })) m.textContent = 'Irrigation paused for ' + hrs + ' h.'; else { setLocal(Date.now() + hrs * 3600000); m.textContent = 'Paused in the app for ' + hrs + ' h (dashboard not connected).'; } }
    else { if (!window.sendTwinCmd({ type: 'resume' })) setLocal(0); m.textContent = 'Irrigation resumed.'; }
    pz();
  });
  var _iz = window.irrigateZone;                              // manual "Irrigate 15 s" respects the pause too
  if (_iz) window.irrigateZone = function (i) { if (paused()) { var m = 'Irrigation is paused (' + left() + ' left). Resume it first.'; pushAlert('warn', '\u23F8', m, 'Do not irrigate'); if ($('dt-msg')) $('dt-msg').textContent = m; return; } _iz(i); };
  $('wx-strip').insertAdjacentHTML('afterend', '<div class="gauge" id="ir-card" style="display:none;margin-bottom:12px;text-align:left;"><b id="ir-t"></b><div id="ir-b" style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px;"></div><div id="ir-m" style="font-size:12px;min-height:14px;margin-top:4px;"></div></div>');
  function ir() {                                            // "Irrigating now" card with a Stop button per running zone
    var run = [], f = farms[curFarm] || { jars: [] };
    if (live && tw) tw.zones.forEach(function (z, i) { if (z.p) run.push(i); }); else if (typeof irrigating !== 'undefined' && irrigating) run.push(-1);
    $('ir-card').style.display = run.length ? 'block' : 'none'; if (!run.length) { $('ir-m').textContent = ''; return; }
    var nm = function (i) { var j = f.jars[i === -1 ? 0 : i]; return j ? j.name : 'Zone ' + (i + 1); };
    $('ir-t').textContent = '\uD83D\uDCA7 Irrigating now: ' + run.map(nm).join(', ');
    $('ir-b').innerHTML = run.map(function (i) { return '<button class="btn" data-stop="' + i + '">\u25A0 Stop ' + nm(i) + '</button>'; }).join('');
  }
  $('ir-card').addEventListener('click', function (e) {
    var b = e.target.closest('[data-stop]'); if (!b) return; var i = +b.dataset.stop;
    if (i === -1) { irrigating = false; irrigTicksLeft = 0; $('ir-m').textContent = 'Irrigation stopped.'; ir(); return; }
    $('ir-m').textContent = window.sendTwinCmd({ type: 'stop', zone: i }) ? 'Stop sent. This zone stays off for 3 h unless you irrigate it.' : 'Not connected to the dashboard.';
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
    ir(); var d = eff(), t = d[0]; if (!t) return;
    var rain = t.rain, sun = live && tw ? tw.sun : null;
    $('wx-main').textContent = (t.icon || icon(t.code)) + ' ' + t.hi + '\u00B0C \u00B7 ' + (sun != null ? 'Sun ' + sun + '% \u00B7 ' : '') + 'Rain ' + rain + '%';
    var msg = paused() ? 'Irrigation paused by you: ' + left() + ' left. Use Resume to restart it.' : live && tw && tw.skip ? 'Rain likely today: irrigation skipped. It rechecks at ' + tw.irrH + ':00 and irrigates if it stays dry.'
      : live && tw && tw.heat ? 'Strong sun: irrigation is held to cooler hours and cycles are shorter.'
      : !live && rain > 75 ? 'Rain likely today: irrigation will be skipped.' : 'Irrigation runs normally. Tap for the week.';
    $('wx-sub').textContent = msg;
    var ask = live && tw && tw.ask; $('wx-ask').style.display = ask ? 'block' : 'none';
    if (ask) { if (!askShown) { askShown = true; $('wx-q').textContent = 'Rain is likely tomorrow (' + tw.rp1 + '%). Irrigate tonight?'; pushAlert('warn', '\uD83C\uDF27', 'Rain likely tomorrow (' + tw.rp1 + '%): irrigate tonight?', 'Answer on the Field screen'); } } else askShown = false;
    pz();
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
  paint(); load(); setInterval(load, 3600000); setInterval(ir, 1500);
})();
