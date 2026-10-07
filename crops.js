/* crops.js: shared crop knowledge for the app (index.html) and the digital twin (twin.html).
   Moisture numbers are % of the soil sensor scale, pH ranges are the usual comfortable range for the crop.
   They are sensible starting defaults, not lab values: adjust them to your soil and variety.
     low  = start watering below this      stop = stop watering at this (comfortable top)
     max  = hard limit, never irrigate above this      crit = dry enough to water even outside the chosen time */
(function () {
  var C = {
    tomatoes: { name: 'Tomatoes', need: 'medium', mm: '25-40', low: 40, stop: 65, max: 75, crit: 25, ph: [6.0, 6.8], blight: true,
      how: 'at the base of the plant, never on the leaves', over: 'cracked fruit, blossom-end rot and blight', under: 'flower drop and small, tough fruit' },
    cabbage:  { name: 'Cabbage', need: 'high', mm: '30-40', low: 45, stop: 70, max: 80, crit: 30, ph: [6.0, 7.5], blight: false,
      how: 'slowly at the base so the heads stay dry', over: 'root rot and split heads', under: 'small loose heads and tip burn' },
    maize:    { name: 'Maize', need: 'medium', mm: '25-50', low: 35, stop: 65, max: 75, crit: 22, ph: [5.8, 7.0], blight: false,
      how: 'along the rows, deeper and less often', over: 'yellow leaves and shallow roots', under: 'poor cobs, especially at tasselling' },
    beans:    { name: 'Beans', need: 'medium', mm: '20-30', low: 35, stop: 60, max: 70, crit: 22, ph: [6.0, 7.0], blight: true,
      how: 'lightly at the base, avoid wet leaves', over: 'root rot and fungal leaf spots', under: 'flower and pod drop' },
    potatoes: { name: 'Potatoes', need: 'medium', mm: '25-40', low: 40, stop: 65, max: 75, crit: 25, ph: [5.0, 6.5], blight: true,
      how: 'at the base, evenly, avoiding wet leaves', over: 'rot and late blight', under: 'small or misshapen tubers' },
    sorghum:  { name: 'Sorghum', need: 'low', mm: '15-25', low: 25, stop: 50, max: 60, crit: 15, ph: [5.5, 7.5], blight: false,
      how: 'deeply but rarely', over: 'waterlogging and stunted roots', under: 'only at flowering, when it matters most' },
    kale:     { name: 'Kale (sukuma wiki)', need: 'high', mm: '25-40', low: 45, stop: 70, max: 80, crit: 30, ph: [6.0, 7.5], blight: false,
      how: 'at the base, little and often', over: 'root rot and soft leaves', under: 'tough, bitter leaves' },
    onions:   { name: 'Onions', need: 'medium', mm: '20-30', low: 35, stop: 60, max: 70, crit: 22, ph: [6.0, 7.0], blight: true,
      how: 'lightly and often while bulbs form, then ease off', over: 'bulb rot and downy mildew', under: 'small bulbs' },
    carrots:  { name: 'Carrots', need: 'medium', mm: '25-30', low: 40, stop: 65, max: 75, crit: 25, ph: [6.0, 6.8], blight: false,
      how: 'evenly, never letting the soil swing from dry to soaked', over: 'forked roots and rot', under: 'cracked, woody roots' },
    spinach:  { name: 'Spinach', need: 'high', mm: '25-35', low: 45, stop: 70, max: 80, crit: 30, ph: [6.0, 7.5], blight: false,
      how: 'little and often at the base', over: 'damping-off and yellow leaves', under: 'bolting and bitter leaves' }
  };
  var GENERIC = { name: 'Unknown crop', generic: true, need: 'medium', mm: '25-35', low: 30, stop: 50, max: 80, crit: 20, ph: [6.0, 7.0], blight: false,
    how: 'at the base, evenly', over: 'root rot', under: 'wilting' };
  var ALIAS = { tomato: 'tomatoes', nyanya: 'tomatoes', cabbages: 'cabbage', kabichi: 'cabbage', mahindi: 'maize', corn: 'maize', bean: 'beans', maharagwe: 'beans',
    potato: 'potatoes', viazi: 'potatoes', mtama: 'sorghum', sukuma: 'kale', 'sukuma wiki': 'kale', kales: 'kale', onion: 'onions', vitunguu: 'onions',
    carrot: 'carrots', karoti: 'carrots', spinachi: 'spinach' };

  function norm(s) { return String(s == null ? '' : s).toLowerCase().replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim(); }
  function keyOf(s) {
    var n = norm(s); if (!n) return null;
    if (C[n]) return n; if (ALIAS[n]) return ALIAS[n];
    var words = n.split(' '), k;
    for (var i = 0; i < words.length; i++) { if (C[words[i]]) return words[i]; if (ALIAS[words[i]]) return ALIAS[words[i]]; }
    return null;
  }
  function pretty(s) { s = String(s == null ? '' : s).trim().slice(0, 24); return s ? s.charAt(0).toUpperCase() + s.slice(1) : 'Unknown crop'; }

  window.CROPS = C;
  window.cropKey = keyOf;
  window.cropOf = function (s) {                         // always returns a usable profile
    var k = keyOf(s), o = {}, src = k ? C[k] : GENERIC, p;
    for (p in src) o[p] = src[p];
    o.key = k; if (!k) o.name = pretty(s); o.phText = o.ph[0].toFixed(1) + '-' + o.ph[1].toFixed(1);
    return o;
  };

  /* ---- Should the farmer irrigate now? ctx = { m: moisture %, clock: hour (0-24), sched: 'morning'|'evening', win: [from, to], rp0: rain today %, rain: bool } ----
     level 'ok' = go ahead, 'warn' = explain and ask to confirm, 'block' = refuse. */
  window.irrigationAdvice = function (cropName, ctx) {
    var c = window.cropOf(cropName), m = Math.round(ctx.m), why = [], level = 'ok', title = '';
    function up(l) { if (l === 'block' || (l === 'warn' && level === 'ok')) level = l; }
    if (ctx.rain) { up('block'); title = 'It is raining'; why.push('Rain is already watering the field, so irrigating now would only waste water.'); }
    if (m >= c.max) { up('block'); title = title || 'Soil is already too wet for ' + c.name; why.push(c.name + ' soil is at ' + m + '%. Above ' + c.max + '% the roots run short of air, which causes ' + c.over + '.'); }
    else if (m >= c.stop) { up('warn'); title = title || c.name + ' does not need water'; why.push(c.name + ' soil is at ' + m + '%, already above the ' + c.stop + '% where it stops. More water risks ' + c.over + '.'); }
    if (ctx.win && ctx.clock != null && !ctx.rain) {
      var inW = ctx.clock >= ctx.win[0] && ctx.clock < ctx.win[1], nm = ctx.sched === 'evening' ? 'evening' : 'morning';
      if (!inW && m >= c.crit) {
        up('warn'); title = title || 'Outside your ' + nm + ' irrigation time';
        why.push('You chose ' + nm + ' irrigation (' + hh(ctx.win[0]) + '-' + hh(ctx.win[1]) + ') and the soil is not dry enough to be urgent (' + m + '%, urgent below ' + c.crit + '%). Watering now loses more water to the air' + (c.blight ? ', and wet leaves invite blight on ' + c.name.toLowerCase() : '') + '.');
      }
    }
    if (ctx.rp0 > 75 && !ctx.rain && m >= c.crit) { up('warn'); title = title || 'Heavy rain is likely today'; why.push('The forecast says ' + ctx.rp0 + '% chance of rain today. Waiting saves water and your tank.'); }
    if (level === 'ok') why.push(c.name + ' soil is at ' + m + '%. It will be watered up to about ' + c.stop + '% and then stop. Best method: ' + c.how + '.');
    return { level: level, title: title || 'Ready to irrigate ' + c.name, why: why, crop: c };
  };

  /* ---- pH instruction for the crop: what to apply and roughly how much (rule of thumb for loam; confirm with a soil test) ---- */
  window.phAdvice = function (cropName, ph) {
    var c = window.cropOf(cropName), a = c.ph[0], b = c.ph[1], mid = (a + b) / 2, r = { crop: c, range: [a, b], ph: ph };
    function r1(x) { return Math.round(x * 10) / 10; }
    if (ph < a) {
      var d = Math.min(0.6, Math.max(0.1, r1(mid - ph)));                 // aim for the middle, but never more than 0.6 per application
      r.state = 'low'; r.kind = 'lime'; r.delta = d; r.amount = Math.round(d / 0.5 * 150);
      r.text = 'Soil is too acidic for ' + c.name + ' (needs ' + c.phText + '). Spread agricultural lime, about ' + r.amount + ' g per m2 (roughly ' + Math.round(r.amount / 10) + ' kg per 100 m2), then water it in lightly.' +
        (mid - ph > 0.6 ? ' This soil needs a big change: apply half now and half in 4-6 weeks, then re-test.' : ' Re-test after 4-6 weeks.');
    } else if (ph > b) {
      var d2 = Math.min(0.5, Math.max(0.1, r1(ph - mid)));
      r.state = 'high'; r.kind = 'sulfur'; r.delta = d2; r.amount = Math.round(d2 / 0.5 * 40);
      r.text = 'Soil is too alkaline for ' + c.name + ' (needs ' + c.phText + '). Work in elemental sulfur, about ' + r.amount + ' g per m2 (roughly ' + Math.round(r.amount / 10) + ' kg per 100 m2), plus compost. Never use lime here. Re-test after 4-6 weeks.';
    } else {
      r.state = 'ok'; r.kind = null; r.delta = 0; r.amount = 0;
      r.text = 'Soil pH ' + ph.toFixed(1) + ' is right for ' + c.name + ' (' + c.phText + '). Do not add lime or sulfur.';
    }
    r.note = 'Amounts are a rule of thumb for loam: clay needs more, sandy soil less. A soil test gives the exact figure. Real soil changes over weeks; the dashboard shows it fast.';
    return r;
  };
  function hh(n) { return ('0' + n).slice(-2) + ':00'; }
})();
