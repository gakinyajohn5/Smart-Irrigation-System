/* menu.js: hamburger menu (Profile, Today's note, Crop calendar, Do not irrigate, Reports, Log out),
   camera tab kept in the centre of the bottom bar, and live data in the report. Loads after every other script. */
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var phone = document.querySelector('.phone'), nav = document.querySelector('nav'), head = document.querySelector('.almanac');
  if (!phone || !nav || !head || typeof go !== 'function') return;

  /* ---- Bottom bar: Field, Ledger | camera | Alerts, Week (equal columns, camera in the middle) ---- */
  var week = nav.querySelector('[data-s="week"]'), alerts = nav.querySelector('[data-s="alerts"]');
  if (week && alerts) alerts.after(week);

  /* ---- Screens the menu opens. The existing cards are moved, not copied, so their scripts keep working ---- */
  function mk(id, title, hint) {
    var d = document.createElement('div'); d.className = 'screen'; d.id = 'screen-' + id;
    d.innerHTML = '<button class="back" onclick="go(\'home\')">\u2190 Field</button>' +
      '<h1 class="serif" style="margin:0 0 4px;font-size:20px;">' + title + '</h1>' +
      '<div style="font-size:11px;color:var(--line);margin-bottom:14px;">' + hint + '</div><div class="mn-body"></div>';
    nav.before(d); return d.querySelector('.mn-body');
  }
  var rec = $('lbl-rec'), note = rec && rec.nextElementSibling, cal = $('cal-card'), calH = cal && cal.previousElementSibling, pz = $('pz-card');
  if (rec && note) { var b1 = mk('note', "Today's note", 'What needs your attention on the farm today.'); rec.style.display = 'none'; b1.append(rec, note); }
  if (cal && calH) { var b2 = mk('calendar', 'Crop calendar', 'Weekly jobs for the crops on this farm.'); calH.style.display = 'none'; b2.append(calH, cal); }
  if (pz) { var b3 = mk('pause', 'Do not irrigate', 'Pause watering for a few hours or days, then resume any time.'); b3.append(pz); }

  /* ---- Drawer ---- */
  var ic = function (d) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + d + '</svg>'; };
  var ITEMS = [
    ['profile', 'Profile', ic('<circle cx="12" cy="8" r="3.6"/><path d="M5 20c.6-3.6 3.6-5.6 7-5.6s6.4 2 7 5.6"/>')],
    ['note', "Today's note", ic('<path d="M6 3h9l4 4v14H6z"/><path d="M9 12h7M9 16h5"/>')],
    ['calendar', 'Crop calendar', ic('<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>')],
    ['crops', 'Crops', ic('<path d="M12 21v-9"/><path d="M12 12c0-4 3-6 7-6 0 4-3 6-7 6z"/><path d="M12 15c0-3-2-5-6-5 0 3 2 5 6 5z"/>')],
    ['pause', 'Do not irrigate', ic('<path d="M12 3c3 4 6 7 6 11a6 6 0 01-12 0c0-4 3-7 6-11z"/><path d="M5 5l14 14"/>')],
    ['reports', 'Reports', ic('<path d="M6 3h9l5 5v13H6z"/><path d="M15 3v5h5M9 13h6M9 17h6"/>')]
  ];
  var dr = document.createElement('div'); dr.id = 'drawer';
  dr.innerHTML = '<div class="dr-scrim"></div><aside class="dr-panel" role="dialog" aria-label="Menu">' +
    '<div class="dr-head"><b>Menu</b><button class="dr-x" aria-label="Close menu">\u00D7</button></div>' +
    '<div class="dr-user">John Kamau \u00B7 +254 712 345 678</div>' +
    ITEMS.map(function (i) { return '<button class="dr-item" data-go="' + i[0] + '">' + i[2] + '<span>' + i[1] + '</span></button>'; }).join('') +
    '<button class="dr-item out" id="dr-out">' + ic('<path d="M10 4H5v16h5M15 8l4 4-4 4M19 12H9"/>') + '<span>Log out</span></button></aside>';
  phone.appendChild(dr);

  /* hamburger button next to the avatar in the header */
  var av = head.querySelector('.avatar');
  if (av) {
    var row = document.createElement('div'); row.className = 'menu-row'; av.before(row);
    var bg = document.createElement('button'); bg.className = 'burger'; bg.setAttribute('aria-label', 'Open menu'); bg.setAttribute('aria-expanded', 'false');
    bg.innerHTML = ic('<path d="M4 7h16M4 12h16M4 17h16"/>');
    row.append(av, bg);
    bg.onclick = function () { open(true); };
  }

  function open(on) { dr.classList.toggle('open', on); var b = head.querySelector('.burger'); if (b) b.setAttribute('aria-expanded', on); }
  dr.querySelector('.dr-scrim').onclick = dr.querySelector('.dr-x').onclick = function () { open(false); };
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') open(false); });
  dr.addEventListener('click', function (e) { var b = e.target.closest('[data-go]'); if (b) go(b.dataset.go); });
  $('dr-out').onclick = function () { open(false); alert('Signed out.'); };

  var _go = window.go;                                         // close the menu, mark the open page, start each page at the top
  window.go = function (s) {
    open(false); _go.apply(this, arguments);
    dr.querySelectorAll('.dr-item[data-go]').forEach(function (b) { b.classList.toggle('active', b.dataset.go === s); });
    var el = $('screen-' + s); if (el) el.scrollTop = 0;
    if (s === 'reports') fill();
  };

  /* ---- Report: real numbers for the selected farm ---- */
  function fill() {
    var f = farms[curFarm], r = $('screen-reports'); if (!f || !r) return;
    var sub = r.querySelector('h1').nextElementSibling; if (sub) sub.textContent = f.name + ' \u00B7 Last 30 days';
    var ph = f.jars.map(function (j) { return parseFloat(j.ph); }).filter(isFinite);
    var row = r.querySelector('.report-row[data-tag="ph"]');
    if (row && ph.length) { var sp = row.querySelectorAll('span'); sp[0].textContent = 'Avg. soil pH (' + ph.length + ' zone' + (ph.length > 1 ? 's' : '') + ')'; sp[1].textContent = (ph.reduce(function (a, b) { return a + b; }, 0) / ph.length).toFixed(1); }
    var z = $('rp-zones');
    if (!z) {
      var anchor = r.querySelector('#pl-card'); if (!anchor) return;
      anchor.insertAdjacentHTML('beforebegin', '<h2 class="section">Zones</h2><div class="rp-zones" id="rp-zones"></div>'); z = $('rp-zones');
    }
    var on = !(r.querySelector('.chip[data-tag="ph"]') || {}).classList || r.querySelector('.chip[data-tag="ph"]').classList.contains('active');
    z.innerHTML = f.jars.map(function (j) {
      return '<div class="report-row" data-tag="ph" style="' + (on ? '' : 'display:none;') + '"><span>' + j.name + ' \u00B7 ' + j.sub + '</span><span class="v">pH ' + j.ph + ' \u00B7 ' + j.fill + '% moist</span></div>';
    }).join('');
  }
  var _sf = window.selectFarm; if (_sf) window.selectFarm = function () { _sf.apply(this, arguments); fill(); };
  fill();

  /* Swahili labels for the new menu */
  if (typeof SW !== 'undefined') {
    SW['Profile'] = 'Wasifu'; SW["Today's note"] = 'Dokezo la leo'; SW['Do not irrigate'] = 'Usinyunyize'; SW['Menu'] = 'Menyu'; SW['Crops'] = 'Mazao'; SW['Zones'] = 'Maeneo';
  }
})();
