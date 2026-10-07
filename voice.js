/* Voice call mode for the farm assistant: listen -> send -> speak -> listen again. */
(function(){
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  let state = 'idle', rec = null, active = false, silences = 0, heard = false, token = 0;
  const audio = new Audio();           // created on the mic tap so phones allow later playback
  const $ = id => document.getElementById(id);
  const sw = () => (typeof currentLang !== 'undefined' && currentLang === 'sw');

  function setState(s){
    state = s;
    const mic = $('mic-btn'), st = $('voice-status'); if(!mic || !st) return;
    mic.style.background = s === 'listening' ? '#C0392B' : s === 'speaking' ? '#E0A030' : 'var(--paper)';
    mic.style.color = (s === 'listening' || s === 'speaking') ? '#fff' : 'var(--ink)';
    const t = { listening:'Listening…', thinking:'Thinking…', speaking:'Speaking…', idle:'' };
    st.textContent = t[s] || '';
  }

  function stopAll(msg){
    active = false; token++;
    try{ rec && rec.abort(); }catch(_){}
    try{ speechSynthesis.cancel(); }catch(_){}
    try{ audio.pause(); }catch(_){}
    setState('idle');
    const st = $('voice-status'); if(st && msg) st.textContent = msg;
  }

  function listen(){
    if(!active) return;
    const my = token; heard = false;
    rec = new SR(); rec.lang = sw() ? 'sw-KE' : 'en-KE';
    rec.interimResults = true; rec.continuous = false;
    let finalText = '', interim = '';
    rec.onresult = e => {
      let txt = ''; for(const r of e.results){ txt += r[0].transcript; if(r.isFinal) finalText = txt; }
      heard = true; interim = txt; $('chat-input').value = txt;
    };
    rec.onerror = e => {
      if(e.error === 'not-allowed' || e.error === 'service-not-allowed') stopAll('Allow the microphone to use voice.');
    };
    rec.onend = async () => {
      if(!active || my !== token) return;
      const text = (finalText || interim).trim();   // only what was heard this turn
      if(!text){ if(++silences >= 2) return stopAll('Stopped (no speech heard).'); return listen(); }
      silences = 0; setState('thinking');
      const reply = await sendChat(text);
      if(!active || my !== token) return;
      if(reply) await speak(reply, my);
      if(active && my === token) listen();
    };
    setState('listening');
    try{ rec.start(); }catch(_){ stopAll('Could not start the microphone.'); }
  }

  const clean = t => t.replace(/[*#_`>]/g,'').replace(/\s+/g,' ').trim();

  function speak(text, my){
    text = clean(text); setState('speaking');
    const lang = sw() ? 'sw' : 'en';
    const voices = (window.speechSynthesis && speechSynthesis.getVoices()) || [];
    const v = voices.find(x => x.lang.toLowerCase().startsWith(lang === 'sw' ? 'sw' : 'en-ke'))
           || (lang === 'en' ? voices.find(x => x.lang.toLowerCase().startsWith('en')) : null);
    if(v) return deviceSpeak(text, v, my);
    return cloudSpeak(text, lang, my).catch(() => deviceSpeak(text, null, my));
  }

  function deviceSpeak(text, voice, my){
    return new Promise(res => {
      if(!window.speechSynthesis) return res();
      speechSynthesis.cancel();
      const parts = text.match(/[^.!?]+[.!?]*/g) || [text];   // short chunks avoid Chrome cutting off long speech
      let i = 0;
      const next = () => {
        if(!active || my !== token || i >= parts.length) return res();
        const u = new SpeechSynthesisUtterance(parts[i++].trim());
        u.lang = voice ? voice.lang : (sw() ? 'sw-KE' : 'en-KE'); if(voice) u.voice = voice;
        u.onend = next; u.onerror = next; speechSynthesis.speak(u);
      };
      next();
    });
  }

  async function cloudSpeak(text, lang, my){
    const res = await fetch('/.netlify/functions/tts', { method:'POST',
      headers:{'Content-Type':'application/json'}, body: JSON.stringify({ text: text.slice(0, 800), lang }) });
    if(!res.ok) throw new Error('tts');
    const blob = await res.blob();
    if(!active || my !== token) return;
    audio.src = URL.createObjectURL(blob);
    await new Promise((ok, no) => { audio.onended = ok; audio.onerror = no; audio.play().catch(no); });
  }

  function toggle(){
    if(!SR){ const st = $('voice-status'); if(st) st.textContent = 'Voice needs Chrome, Edge or Safari.'; return; }
    if(active) return stopAll();
    audio.play().catch(()=>{});          // unlock audio on this tap
    if(window.speechSynthesis) speechSynthesis.getVoices();
    active = true; silences = 0; token++; listen();
  }

  window.toggleVoice = toggle;

  // Stop the call when leaving the assistant screen
  const origGo = window.go;
  if(typeof origGo === 'function') window.go = function(name){ if(name !== 'chat') stopAll(); return origGo.apply(this, arguments); };
})();
