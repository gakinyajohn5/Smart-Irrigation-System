/* ===== Smart Irrigation add-ons ===== */
const LITRES_PER_SKIP = 40, KSH_PER_LITRE = 0.5; // edit to match your real water/pump cost
let curFarm = 'kiambu', lastScan = null, chatHist = [];
const $ = id => document.getElementById(id);
const phone = document.querySelector('.phone');
const store = {
  get:(k,d)=>{ try{ return JSON.parse(localStorage.getItem(k)) ?? d; }catch(e){ return d; } },
  set:(k,v)=>{ try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} }
};

/* ---- 1. Swahili for every screen (text swap + observer for new alerts) ---- */
const SW = {
'Field':'Shamba','Ledger':'Daftari','Alerts':'Tahadhari','Reports':'Ripoti','← Field':'← Shamba',
'Manage zones →':'Simamia maeneo →','MOISTURE':'UNYEVU','Solar battery':'Betri ya jua',
'Zone A':'Eneo A','Zone B':'Eneo B','Zone C':'Eneo C','Tomatoes':'Nyanya','Cabbage':'Kabichi','Maize':'Mahindi','Beans':'Maharagwe','Potatoes':'Viazi','Sorghum':'Mtama',
'Zone B soil is acidic':'Udongo wa Eneo B una asidi','Open cost calculator':'Fungua kikokotoo cha gharama',
'Leaf doctor':'Daktari wa majani','Point your camera at an affected leaf, in daylight.':'Elekeza kamera kwenye jani lililoathirika, mchana.',
'Hold 15cm away, avoid shadows':'Shikilia umbali wa sm 15, epuka vivuli','Take photo':'Piga picha','Upload photo':'Pakia picha','Notify nearby farmers':'Arifu wakulima wa karibu',
'My farms':'Mashamba yangu','Viewing':'Unatazama','+ Add another farm':'+ Ongeza shamba lingine',
'Zone B — Cabbage':'Eneo B — Kabichi','↻ Read now':'↻ Soma sasa','SOIL pH':'pH YA UDONGO','TEMP':'JOTO','Water tank':'Tanki la maji','Irrigate now':'Nyunyizia sasa','History':'Historia',
'Cost calculator':'Kikokotoo cha gharama','Amendment':'Kiboreshaji','Local price (KSh per kg)':'Bei ya eneo (KSh kwa kg)','Amount needed (kg)':'Kiasi kinachohitajika (kg)','Estimated cost':'Gharama inayokadiriwa',
'Harvest tracker — Zone C maize':'Ufuatiliaji wa mavuno — Mahindi Eneo C','Planted':'Imepandwa','Growing':'Inakua','Harvest':'Mavuno',
'Include in report':'Jumuisha kwenye ripoti','Preview':'Hakiki','Soil pH':'pH ya udongo','Rainfall':'Mvua','Irrigation':'Umwagiliaji','Disease scans':'Skani za magonjwa','Finances':'Fedha',
'Profit & loss':'Faida na hasara','Net profit':'Faida halisi','Print / Save PDF':'Chapisha / Hifadhi PDF','Download CSV':'Pakua CSV',
'Log out':'Toka','Farmer details':'Maelezo ya mkulima','Notifications':'Arifa','Farms':'Mashamba','Preferred language':'Lugha unayopendelea',
'Pump running, moisture not rising':'Pampu inafanya kazi, unyevu haupandi','Late blight found 3km away':'Ugonjwa wa late blight umepatikana km 3 kutoka hapa',
'Irrigation skipped — rain forecast':'Kunyunyizia kumeahirishwa — mvua inatarajiwa','Moisture low — irrigation started':'Unyevu mdogo — kunyunyizia kumeanza',
'Irrigation complete — Zone A':'Kunyunyizia kumekamilika — Eneo A','Water tank low — top up needed':'Tanki la maji liko chini — jaza',
'Water saved':'Maji yaliyookolewa','Money saved':'Pesa zilizookolewa','Ask the farm assistant':'Muulize msaidizi wa shamba','Read alerts aloud':'Soma tahadhari kwa sauti',
'Scan history':'Historia ya skani','Farm assistant':'Msaidizi wa shamba','Send':'Tuma','This season':'Msimu huu'
};
const orig = new WeakMap();
function tr(root, to){
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); let n;
  while(n = w.nextNode()){
    const t = n.nodeValue.trim(); if(!t) continue;
    if(to==='sw'){ const s = SW[t]; if(s){ orig.set(n, n.nodeValue); n.nodeValue = n.nodeValue.replace(t, s); } }
    else if(orig.has(n)){ n.nodeValue = orig.get(n); orig.delete(n); }
  }
}
const _setLang = setLang;
setLang = function(l, b){ if(l==='en') tr(phone,'en'); _setLang(l,b); if(l==='sw') tr(phone,'sw'); };
new MutationObserver(ms=>{ if(currentLang==='sw') ms.forEach(m=>tr(m.target,'sw')); })
  .observe(phone,{childList:true,subtree:true});
const _selectFarm = selectFarm;
selectFarm = function(id){ curFarm = id; _selectFarm(id); if(currentLang==='sw') tr(phone,'sw'); };

/* ---- 2. Live cost calculator ---- */
function calcUpdate(){
  const c = Math.round((+$('calc-price').value||0) * (+$('calc-kg').value||0));
  $('calc-total').textContent = 'KSh ' + c.toLocaleString();
  $('home-cost').textContent = c.toLocaleString();
}

/* ---- 3. Water and money saved ---- */
let impact = store.get('impact', {skips:0}), lastSkip = 0;
function renderImpact(){
  $('imp-l').textContent = (impact.skips*LITRES_PER_SKIP).toLocaleString() + ' L';
  $('imp-k').textContent = 'KSh ' + Math.round(impact.skips*LITRES_PER_SKIP*KSH_PER_LITRE).toLocaleString();
}
function recordSkip(){
  if(Date.now()-lastSkip < 30000) return; // count at most one skip per 30s
  lastSkip = Date.now(); impact.skips++; store.set('impact', impact); renderImpact();
  pushAlert('info','✓','Irrigation skipped — rain forecast','Saved ~'+LITRES_PER_SKIP+'L water');
}

/* ---- 4. Voice readout (Swahili when SW is on) ---- */
function readAlerts(){
  if(!('speechSynthesis' in window)){ $('voice-note').textContent = 'Voice not supported on this browser.'; return; }
  speechSynthesis.cancel();
  const text = [...document.querySelectorAll('#alerts-list .alert')].slice(0,5).map(a=>{
    const b = a.querySelector('b').textContent.replace('SMS','').trim();
    const s = [...a.querySelectorAll('span')].find(x=>!x.classList.contains('sms-tag') && !x.closest('b'));
    return b + '. ' + (s ? s.textContent : '');
  }).join(' ');
  const sw = currentLang==='sw';
  const u = new SpeechSynthesisUtterance(text);
  const v = speechSynthesis.getVoices().find(v=>v.lang.toLowerCase().startsWith(sw?'sw':'en'));
  if(v){ u.voice = v; u.lang = v.lang; } else u.lang = sw ? 'sw-KE' : 'en-KE';
  $('voice-note').textContent = (sw && !v) ? 'No Swahili voice on this phone; install one in phone settings > text-to-speech.' : '';
  speechSynthesis.speak(u);
}

/* ---- 5. CSV download ---- */
function downloadCSV(){
  const rows = [['Item','Value']];
  document.querySelectorAll('#screen-reports .report-row').forEach(r=>{
    if(r.style.display!=='none') rows.push([...r.querySelectorAll('span')].map(s=>s.textContent));
  });
  document.querySelectorAll('#pl-card .row, #pl-card .total').forEach(r=>rows.push([...r.querySelectorAll('span')].map(s=>s.textContent)));
  const csv = '\ufeff' + rows.map(r=>r.map(c=>'"'+c.replace(/"/g,'""')+'"').join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv],{type:'text/csv'}));
  a.download = 'farm-report.csv'; a.click();
}

/* ---- 6. Scan history + WhatsApp share ---- */
function saveScan(d){
  lastScan = d;
  const h = store.get('scans', []);
  h.unshift({t:Date.now(), crop:d.crop, problem:d.problem, conf:d.confidence, farm:farms[curFarm].name});
  store.set('scans', h.slice(0,20)); renderHistory();
}
function renderHistory(){
  const h = store.get('scans', []);
  $('scan-history-list').innerHTML = h.length ? h.map(s=>`<div class="report-row"><span>${s.problem} · ${s.crop}<br><small style="opacity:.7">${s.farm} · ${new Date(s.t).toLocaleDateString()}</small></span><span class="v">${s.conf}%</span></div>`).join('')
    : '<div style="font-size:12px;color:var(--line)">No scans yet.</div>';
}
function shareScan(){
  const d = lastScan; if(!d){ alert('Take a photo first.'); return; }
  const msg = `🍃 Leaf doctor alert from ${farms[curFarm].name}: ${d.problem} on ${d.crop} (${d.confidence}% match). Treatment: ${d.treatment}`;
  window.open('https://wa.me/?text=' + encodeURIComponent(msg), '_blank');
}

/* ---- 7. AI farm assistant ---- */
function bubble(role, text){
  const d = document.createElement('div');
  d.style.cssText = `max-width:85%;padding:9px 12px;border-radius:14px;font-size:12.5px;line-height:1.5;margin-bottom:8px;white-space:pre-wrap;${role==='user'?'margin-left:auto;background:var(--leaf);color:var(--soil);':'background:#EDE6D6;'}`;
  d.textContent = text; $('chat-log').append(d); $('chat-log').scrollTop = 1e6; return d;
}
async function sendChat(text){
  text = (text || $('chat-input').value).trim(); if(!text) return;
  $('chat-input').value = ''; bubble('user', text);
  chatHist.push({role:'user', text});
  const wait = bubble('ai', '…');
  const f = farms[curFarm];
  try{
    const res = await fetch('/.netlify/functions/chat', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ messages: chatHist.slice(-10), lang: currentLang, context:{
        farm: f.name, crops: f.jars.map(j=>`${j.name}: ${j.sub}, soil pH ${j.ph}, moisture ${j.fill}%`).join('; '),
        weather: weather ? `${weather.temp}°C, ` + (weather.hoursAway===-1 ? 'no rain in 6h' : `rain in ~${weather.hoursAway}h`) : 'unknown',
        date: new Date().toDateString(), lat: f.lat, lon: f.lon } })
    });
    if(!res.ok) throw 0;
    const { reply } = await res.json();
    wait.textContent = reply; chatHist.push({role:'model', text:reply});
  }catch(e){ wait.textContent = 'Could not reach the assistant. Check your connection and try again.'; }
}

/* ---- Build the extra UI ---- */
(function build(){
  // Impact card + assistant button on Home
  const anchor = $('lbl-rec');
  anchor.insertAdjacentHTML('beforebegin', `
    <h2 class="section">This season</h2>
    <div style="display:flex;gap:10px;margin-bottom:16px;">
      <div class="gauge"><b id="imp-l">0 L</b><span>Water saved</span></div>
      <div class="gauge"><b id="imp-k">KSh 0</b><span>Money saved</span></div>
    </div>
    <button class="btn block" style="margin-bottom:18px;" onclick="go('chat')">💬 Ask the farm assistant</button>`);
  // Voice button on Alerts
  document.querySelector('#screen-alerts h1').insertAdjacentHTML('afterend',
    `<button class="btn ghost" style="font-size:12px;padding:8px 14px;margin-bottom:4px;" onclick="readAlerts()">🔊 Read alerts aloud</button><div id="voice-note" style="font-size:10.5px;color:var(--rust);margin-bottom:8px;"></div>`);
  // History on Scan
  $('screen-scan').insertAdjacentHTML('beforeend', `<h2 class="section" style="margin-top:18px;">Scan history</h2><div id="scan-history-list"></div>`);
  // Chat screen
  const chat = document.createElement('div');
  chat.className = 'screen'; chat.id = 'screen-chat';
  chat.innerHTML = `
    <button class="back" onclick="go('home')">← Field</button>
    <h1 class="serif" style="margin:0 0 10px;font-size:20px;">Farm assistant</h1>
    <div class="chips">
      <button class="chip" onclick="sendChat('When should I plant maize here?')">When to plant?</button>
      <button class="chip" onclick="sendChat('How do I fix acidic soil in my zones?')">Fix acidic soil</button>
      <button class="chip" onclick="sendChat('Give me a planting calendar for the next 3 months for this farm.')">Planting calendar</button>
      <button class="chip" onclick="sendChat('What are typical market prices for my crops in Kenya right now? Say clearly they are estimates.')">Market prices</button>
    </div>
    <div id="chat-log" style="height:260px;overflow-y:auto;margin-bottom:10px;"></div>
    <div style="display:flex;gap:8px;margin-bottom:10px;">
      <input id="chat-input" style="flex:1;border:1px solid var(--line);background:var(--paper);border-radius:20px;padding:9px 14px;font-size:13px;font-family:'Work Sans';" placeholder="Ask about your farm…">
      <button class="btn" onclick="sendChat()">Send</button>
    </div>`;
  document.querySelector('nav').before(chat);
  $('chat-input').addEventListener('keydown', e=>{ if(e.key==='Enter') sendChat(); });
  $('calc-price').addEventListener('input', calcUpdate);
  $('calc-kg').addEventListener('input', calcUpdate);
  renderImpact(); renderHistory();
  if('speechSynthesis' in window) speechSynthesis.getVoices();
})();
