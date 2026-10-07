/* smartcare.js: "Smart care" screen for the farmer.
   - choose morning or evening irrigation (sent to the controller / digital twin)
   - set the crop in each zone: the crop decides when watering starts, where it stops and the right soil pH (crops.js)
   - Irrigate buttons warn first and explain, based on the crop, the soil and the time (careGuard)
   - pH control: instructions for this farm's pH, and lime / sulfur buttons that move the pH toward the crop's range
   - "Ask AI" sends the zone's facts to the farm assistant (netlify chat function); the built-in crop rules work without it */
(function () {
  var FARM = 'kiambu';                                   // the farm the controller / digital twin drives
  var $ = function (id) { return document.getElementById(id); };
  var nav = document.querySelector('nav'); if (!nav || !window.cropOf) return;
  var tw = window.__twinLast || null, live = false, pending = {}, KEY = 'rl-crops';
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }); }
  function hhmm(c) { return ('0' + Math.floor(c)).slice(-2) + ':' + ('0' + Math.floor((c % 1) * 60)).slice(-2); }
  function hr(n) { return ('0' + n).slice(-2) + ':00'; }
  function jars() { return (farms[curFarm] || { jars: [] }).jars; }
  function wired() { return curFarm === FARM; }
  function zdata(i) {                                    // best known facts about zone i
    var j = jars()[i] || {}, z = wired() && tw && tw.zones && tw.zones[i];
    var ph = z ? z.ph : parseFloat(j.ph), m = z ? z.m : +j.fill;
    return { name: j.name || 'Zone ' + (i + 1), crop: (z && z.crop) || j.sub, m: isFinite(m) ? m : 0, ph: isFinite(ph) ? ph : 6.5, twin: !!z };
  }

  /* ---- remember crops the farmer chose (the twin overrides them for the wired farm while it is live) ---- */
  try { var saved = JSON.parse(localStorage.getItem(KEY)) || {}; Object.keys(saved).forEach(function (k) { if (farms[k]) saved[k].forEach(function (c, i) { if (c && farms[k].jars[i]) farms[k].jars[i].sub = c; }); }); } catch (e) {}
  function persist() { try { var o = {}; Object.keys(farms).forEach(function (k) { o[k] = farms[k].jars.map(function (j) { return j.sub; }); }); localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) {} }

  /* ---- the screen ---- */
  var scr = document.createElement('div'); scr.className = 'screen'; scr.id = 'screen-care';
  scr.innerHTML = '<button class="back" onclick="go(\'home\')">\u2190 Field</button>' +
    '<h1 class="serif" style="margin:0 0 4px;font-size:20px;">Smart care</h1>' +
    '<div id="care-status" style="font-size:11px;margin-bottom:10px;opacity:.8;"></div>' +
    '<h2 class="section">When to irrigate</h2>' +
    '<div class="gauge" style="text-align:left;margin-bottom:6px;"><div style="display:flex;gap:8px;margin-bottom:8px;">' +
    '<button class="btn" data-sched="morning" style="flex:1">\uD83C\uDF05 Morning<br><small>05:00-09:00</small></button>' +
    '<button class="btn ghost" data-sched="evening" style="flex:1">\uD83C\uDF07 Evening<br><small>17:00-19:00</small></button></div>' +
    '<div id="care-win" style="font-size:12px;font-weight:600;margin-bottom:4px;"></div><div id="care-why" style="font-size:12px;line-height:1.4;"></div></div>' +
    '<div id="care-msg" style="font-size:12px;color:var(--leaf-dk);min-height:16px;margin:4px 0 8px;"></div>' +
    '<h2 class="section">Zones and soil pH</h2><div id="care-zones"></div>';
  nav.before(scr);

  /* ---- Crops screen: opened from the hamburger menu (menu.js), not from Smart care ---- */
  var cscr = document.createElement('div'); cscr.className = 'screen'; cscr.id = 'screen-crops';
  cscr.innerHTML = '<button class="back" onclick="go(\'home\')">\u2190 Field</button>' +
    '<h1 class="serif" style="margin:0 0 4px;font-size:20px;">Crops</h1>' +
    '<div style="font-size:11px;color:var(--line);margin-bottom:14px;">Choose what is planted in each zone. Watering levels and the soil pH range follow the crop.</div>' +
    '<div id="crop-zones"></div><div id="crop-msg" style="font-size:12px;color:var(--leaf-dk);min-height:16px;margin:4px 0 8px;"></div>';
  nav.before(cscr);
  var jl = $('jars-list'); if (jl) jl.insertAdjacentHTML('afterend', '<button class="btn block" style="margin:0 0 14px;" onclick="go(\'care\')">\uD83C\uDF31 Smart care: irrigation time &amp; soil pH</button>');

  function build() {                                     // one card per zone of the current farm (built once; paint() only updates text)
    var opts = Object.keys(CROPS).map(function (k) { return '<option value="' + k + '">' + esc(CROPS[k].name) + '</option>'; }).join('') + '<option value="__other">Other crop\u2026</option>';
    $('crop-zones').innerHTML = jars().map(function (j, i) {
      return '<div class="gauge" style="text-align:left;margin-bottom:10px;display:flex;justify-content:space-between;align-items:center;gap:8px;"><div><b>' + esc(j.name) + '</b><div id="k' + i + '-info" style="font-size:11px;opacity:.75;margin-top:2px;"></div></div>' +
        '<select data-crop="' + i + '" style="font-size:13px;padding:4px 6px;border-radius:8px;border:1px solid var(--line);background:var(--paper);">' + opts + '</select></div>';
    }).join('');
    $('care-zones').innerHTML = jars().map(function (j, i) {
      return '<div class="gauge" style="text-align:left;margin-bottom:10px;" data-z="' + i + '">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;"><b>' + esc(j.name) + '</b><span id="c' + i + '-crop" style="font-size:13px;font-weight:600;opacity:.85;"></span></div>' +
        '<div style="margin-top:8px;font-size:12px;" id="c' + i + '-mv"></div>' +
        '<div style="position:relative;height:10px;background:#e3e9dc;border-radius:6px;margin:4px 0 2px;overflow:hidden;"><div id="c' + i + '-bar" style="height:100%;width:0;border-radius:6px;transition:width .3s;"></div><div id="c' + i + '-lo" style="position:absolute;top:0;bottom:0;width:2px;background:#241A10;opacity:.55;"></div><div id="c' + i + '-hi" style="position:absolute;top:0;bottom:0;width:2px;background:#241A10;opacity:.55;"></div></div>' +
        '<div style="font-size:11px;opacity:.75;" id="c' + i + '-rule"></div>' +
        '<div style="margin-top:8px;font-size:12px;font-weight:600;" id="c' + i + '-ph"></div>' +
        '<div style="font-size:12px;line-height:1.4;margin-top:2px;" id="c' + i + '-tx"></div>' +
        '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px;"><button class="btn" data-amend="' + i + '" style="display:none"></button>' +
        '<button class="btn" data-irr="' + i + '">\uD83D\uDCA7 Irrigate</button><button class="btn ghost" data-ai="' + i + '">\u2728 Ask AI</button></div>' +
        '<div id="c' + i + '-ai" style="font-size:12px;line-height:1.4;margin-top:8px;display:none;padding:8px;border-radius:10px;background:#eef3e4;"></div></div>';
    }).join('');
  }

  function paint() {
    var d = wired() && tw, hasWin = d && d.win && live;
    $('care-status').textContent = !wired() ? 'This plot has no irrigation controller linked yet: advice only.' : live ? 'Live from the controller' : 'Last known data (controller not connected)';
    var s = d ? d.sched : 'morning';
    scr.querySelectorAll('[data-sched]').forEach(function (b) { var on = b.dataset.sched === s; b.className = 'btn' + (on ? '' : ' ghost'); b.disabled = !wired(); b.style.opacity = wired() ? 1 : .5; });
    var w = d && d.win ? d.win : (s === 'evening' ? [17, 19] : [5, 9]), inW = d && d.clock != null && d.clock >= w[0] && d.clock < w[1];
    $('care-win').innerHTML = (s === 'evening' ? 'Evening' : 'Morning') + ' window ' + hr(w[0]) + '-' + hr(w[1]) + (hasWin ? ' \u00B7 now ' + hhmm(d.clock) + ' \u00B7 <span style="color:' + (inW ? 'var(--leaf-dk)' : 'var(--marigold)') + '">' + (inW ? 'OPEN' : 'CLOSED') + '</span>' : '');
    var blight = jars().filter(function (j, i) { return cropOf(zdata(i).crop).blight; }).map(function (j, i) { return j.sub; });
    $('care-why').innerHTML = s === 'evening'
      ? 'Water goes in cooler air with less loss, but leaves can stay wet overnight.' + (blight.length ? ' <b>Take care with ' + esc(blight.join(', ')) + ':</b> they get blight and mildew from wet leaves, so water at the base only.' : '') + ' Dry zones wait for this window; very dry soil is watered at any time.'
      : 'Cool air and calm wind mean little is lost to evaporation, leaves dry in the sun, and the crop has water before the heat. Dry zones wait for this window; very dry soil is watered at any time.';
    jars().forEach(function (j, i) {
      var z = zdata(i), c = cropOf(z.crop), pa = phAdvice(z.crop, z.ph), m = Math.round(z.m), sel = cscr.querySelector('[data-crop="' + i + '"]');
      if (sel && document.activeElement !== sel) { var k = c.key || '__custom'; if (!c.key && ![].some.call(sel.options, function (o) { return o.value === '__custom'; })) sel.add(new Option(c.name, '__custom')); sel.value = k; }
      $('c' + i + '-crop').textContent = '\uD83C\uDF31 ' + c.name; $('k' + i + '-info').textContent = 'Waters below ' + c.low + '%, stops at ' + c.stop + '% \u00B7 pH ' + c.phText;
      var st = m >= c.max ? 'too wet' : m >= c.stop ? 'wet enough, do not irrigate' : m < c.low ? 'dry, needs water' : 'comfortable';
      $('c' + i + '-mv').innerHTML = 'Soil moisture <b>' + m + '%</b> \u00B7 ' + st + (z.twin && tw.zones[i].wait && wired() ? ' \u00B7 <i>waiting for the ' + (tw.sched || 'morning') + ' window</i>' : '');
      $('c' + i + '-bar').style.width = m + '%'; $('c' + i + '-bar').style.background = m >= c.max || m < c.low ? 'var(--rust)' : m >= c.stop ? 'var(--marigold)' : 'var(--leaf)';
      $('c' + i + '-lo').style.left = c.low + '%'; $('c' + i + '-hi').style.left = c.stop + '%';
      $('c' + i + '-rule').textContent = (c.generic ? 'Unknown crop, general settings. ' : '') + {low: 'Low', medium: 'Medium', high: 'High'}[c.need] + ' water need, about ' + c.mm + ' mm a week (1 mm = 1 litre per m\u00B2). Waters below ' + c.low + '%, stops at ' + c.stop + '% (lines on the bar).';
      $('c' + i + '-ph').innerHTML = 'Soil pH <span style="color:' + (pa.state === 'ok' ? 'var(--leaf-dk)' : 'var(--rust)') + '">' + z.ph.toFixed(1) + '</span> \u00B7 ' + esc(c.name) + ' likes ' + pa.crop.phText;
      $('c' + i + '-tx').textContent = pa.text;
      var ab = scr.querySelector('[data-amend="' + i + '"]'); ab.style.display = pa.kind ? 'inline-block' : 'none'; ab.dataset.kind = pa.kind || ''; ab.dataset.delta = pa.delta; ab.disabled = !wired();
      if (pa.kind) ab.textContent = pa.kind === 'lime' ? '\uD83E\uDEA8 Apply lime (' + pa.amount + ' g/m\u00B2)' : '\uD83E\uDEA8 Apply sulfur (' + pa.amount + ' g/m\u00B2)';
      scr.querySelector('[data-irr="' + i + '"]').disabled = !wired();
    });
    homeNote();
  }

  function homeNote() {                                   // the Home "Today's note" follows the real pH of this farm
    var n = document.querySelector('#screen-home .note'); if (!n) return;
    var bad = null; jars().forEach(function (j, i) { if (bad) return; var z = zdata(i), pa = phAdvice(z.crop, z.ph); if (pa.state !== 'ok') bad = { j: j, z: z, pa: pa }; });
    var b = n.querySelector('b'), p = n.querySelector('p'), cost = n.querySelector('.cost'), btn = n.querySelector('button');
    if (bad) { b.textContent = bad.j.name + ' soil is ' + (bad.pa.state === 'low' ? 'acidic' : 'alkaline'); p.textContent = 'pH ' + bad.z.ph.toFixed(1) + ' is outside what ' + bad.pa.crop.name.toLowerCase() + ' needs (' + bad.pa.range[0] + '-' + bad.pa.range[1] + '). ' + (bad.pa.state === 'low' ? 'Add agricultural lime' : 'Add elemental sulfur') + ': open Smart care for how much.'; if (cost) cost.style.display = bad.pa.state === 'low' ? '' : 'none'; if (btn) btn.style.display = bad.pa.state === 'low' ? '' : 'none'; }
    else { b.textContent = 'Soil pH is right in every zone'; p.textContent = 'Each zone is inside the range its crop likes. Keep irrigating in the ' + ((tw && tw.sched) || 'morning') + ' window.'; if (cost) cost.style.display = 'none'; if (btn) btn.style.display = 'none'; }
  }

  /* ---- actions ---- */
  function say(t) { $('care-msg').textContent = t; }
  scr.addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    if (b.dataset.sched) { var ok = window.sendTwinCmd && window.sendTwinCmd({ type: 'sched', mode: b.dataset.sched }); say(ok ? 'Irrigation time set to ' + b.dataset.sched + '.' : 'Not connected to the controller, nothing changed.'); }
    else if (b.dataset.irr != null) window.irrigateZone(+b.dataset.irr);
    else if (b.dataset.amend != null) amend(+b.dataset.amend, b.dataset.kind, +b.dataset.delta);
    else if (b.dataset.ai != null) askZone(+b.dataset.ai, b);
  });
  function sayCrop(t) { $('crop-msg').textContent = t; }
  cscr.addEventListener('change', function (e) {
    var sel = e.target.closest('[data-crop]'); if (!sel) return; var i = +sel.dataset.crop, v = sel.value, send = v;
    if (v === '__custom') return;
    if (v === '__other') { send = (prompt('Which crop is planted in this zone?') || '').replace(/[^A-Za-z0-9 \-]/g, '').trim().slice(0, 24); if (!send) { paint(); return; } }
    jars()[i].sub = cropOf(send).name; persist();
    if (wired()) { var ok = window.sendTwinCmd && window.sendTwinCmd({ type: 'crop', zone: i, crop: send }); if (!ok) pending[i] = send; sayCrop(ok ? jars()[i].name + ' now grows ' + cropOf(send).name + '. Watering levels and the pH range changed to match.' : 'Saved here. It will be sent when the controller is connected.'); }
    else sayCrop(jars()[i].name + ' now grows ' + cropOf(send).name + '.');
    var cards = document.querySelectorAll('#jars-list .jar-sub'); if (cards[i]) cards[i].textContent = cropOf(send).name;
    paint();
  });

  function amend(i, kind, delta) {
    var z = zdata(i), pa = phAdvice(z.crop, z.ph); if (!kind || !(delta > 0)) return;
    var ok = window.sendTwinCmd && window.sendTwinCmd({ type: 'amend', zone: i, kind: kind, delta: delta });
    say(ok ? 'Applied ' + (kind === 'lime' ? 'lime' : 'sulfur') + ' to ' + jars()[i].name + ' (about ' + pa.amount + ' g/m\u00B2). The pH will move toward ' + pa.crop.phText + '. ' + pa.note : 'Not connected to the controller, nothing was applied.');
  }

  /* ---- AI: the farm assistant explains using the zone's real numbers ---- */
  function ask(q, done) {
    var f = farms[curFarm];
    fetch('/.netlify/functions/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', text: q.slice(0, 950) }], lang: typeof currentLang !== 'undefined' ? currentLang : 'en',
        context: { farm: f.name, crops: f.jars.map(function (j) { return j.name + ': ' + j.sub + ', soil pH ' + j.ph + ', moisture ' + j.fill + '%'; }).join('; '), weather: tw ? Math.round(tw.temp) + '\u00B0C, rain today ' + tw.rp0 + '%' : 'unknown' } }) })
      .then(function (r) { if (!r.ok) throw new Error('AI unavailable'); return r.json(); }).then(function (j) { done(null, String(j.reply || '').slice(0, 900)); }).catch(function (e) { done(e); });
  }
  function zoneQuestion(i) {
    var z = zdata(i), c = cropOf(z.crop), pa = phAdvice(z.crop, z.ph), t = wired() && tw && live ? 'It is ' + hhmm(tw.clock) + ' and the farmer irrigates in the ' + tw.sched + '.' : '';
    return jars()[i].name + ' grows ' + c.name + '. Soil moisture ' + Math.round(z.m) + '%, soil pH ' + z.ph.toFixed(1) + ' (this crop likes ' + pa.crop.phText + '). ' + t +
      ' In 4 short sentences for a Kenyan smallholder: how much water does this crop need and when should watering stop, should I irrigate now, and what should I do about the pH? Be specific.';
  }
  function askZone(i, btn) {
    var box = $('c' + i + '-ai'); box.style.display = 'block'; box.textContent = 'Thinking\u2026'; btn.disabled = true;
    ask(zoneQuestion(i), function (err, txt) { btn.disabled = false; box.textContent = err ? 'The AI assistant is not available right now (check your internet connection). The advice above comes from the built-in crop rules.' : txt; });
  }

  /* ---- the irrigate warning: explains, per plant, why watering now may be wrong ---- */
  window.careGuard = function (i, go) {
    var z = zdata(i), ctx = { m: z.m }, d = wired() && tw;
    if (d && live) { ctx.clock = d.clock; ctx.sched = d.sched; ctx.win = d.win; ctx.rp0 = d.rp0; ctx.rain = d.rain; }
    var a = irrigationAdvice(z.crop, ctx);
    if (a.level === 'ok') { go(); return; }
    var wrap = document.createElement('div'); wrap.setAttribute('role', 'dialog');
    wrap.style.cssText = 'position:fixed;inset:0;z-index:100000;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;padding:16px;';
    var warn = a.level === 'warn';
    wrap.innerHTML = '<div style="background:#fff;color:#1b2b21;border-radius:18px;border-left:6px solid ' + (warn ? '#D98E04' : '#C1440E') + ';width:min(100%,380px);padding:16px;box-shadow:0 12px 34px rgba(0,0,0,.4);max-height:90vh;overflow:auto;">' +
      '<b style="font-size:15px;display:block;margin-bottom:6px;">\u26A0 ' + esc(a.title) + '</b>' + a.why.map(function (t) { return '<p style="margin:0 0 8px;font-size:13px;line-height:1.4;">' + esc(t) + '</p>'; }).join('') +
      '<div id="cg-ai" style="display:none;font-size:12px;line-height:1.4;padding:8px;border-radius:10px;background:#eef3e4;margin-bottom:8px;"></div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:6px;"><button class="btn ghost" id="cg-no">' + (warn ? 'Cancel' : 'OK') + '</button><button class="btn ghost" id="cg-ai-b">\u2728 Ask AI why</button>' + (warn ? '<button class="btn" id="cg-yes">Irrigate anyway</button>' : '') + '</div></div>';
    document.body.appendChild(wrap);
    function close() { wrap.remove(); }
    wrap.querySelector('#cg-no').onclick = close;
    if (warn) wrap.querySelector('#cg-yes').onclick = function () { close(); go(); };
    wrap.querySelector('#cg-ai-b').onclick = function () {
      var box = wrap.querySelector('#cg-ai'), b = this; box.style.display = 'block'; box.textContent = 'Thinking\u2026'; b.disabled = true;
      ask('The farmer wants to irrigate right now but the app warned: ' + a.why.join(' ') + ' ' + zoneQuestion(i), function (err, txt) { b.disabled = false; box.textContent = err ? 'The AI assistant is not available right now. The explanation above comes from the built-in crop rules.' : txt; });
    };
  };

  /* ---- keep in sync with the controller ---- */
  window.addEventListener('twin', function (e) {
    tw = e.detail.d; live = !!e.detail.live;
    if (live && wired()) Object.keys(pending).forEach(function (i) { if (window.sendTwinCmd({ type: 'crop', zone: +i, crop: pending[i] })) delete pending[i]; });   // crops chosen while offline
    paint();
  });
  var _sf = selectFarm; selectFarm = function () { _sf.apply(this, arguments); build(); paint(); };
  build(); paint();
})();
