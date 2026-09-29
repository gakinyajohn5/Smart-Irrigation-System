/* ---- tour.js: Interactive App Tutorial & Walkthrough ---- */

(function() {
  // Inject CSS styles for the tour overlay
  const style = document.createElement('style');
  style.innerHTML = `
    #tour-overlay {
      position: fixed; inset: 0; background: rgba(36,28,19,0.85); z-index: 99999;
      display: none; align-items: center; justify-content: center; padding: 20px;
      animation: fadeIn 0.3s ease;
    }
    #tour-overlay.active { display: flex; }
    .tour-card {
      background: var(--paper, #FBF8F1); color: var(--ink, #241A10); border-radius: 20px; padding: 22px;
      width: 100%; max-width: 330px; box-shadow: 0 20px 40px rgba(0,0,0,0.5);
      border: 2px solid var(--line, #5A4938); position: relative; font-family: 'Work Sans', sans-serif;
    }
    .tour-card h3 { font-family: 'Fraunces', serif; margin: 0 0 8px; font-size: 18px; color: var(--soil, #2B2118); }
    .tour-card p { font-size: 13px; line-height: 1.5; margin: 0 0 20px; color: var(--line, #5A4938); }
    .tour-footer { display: flex; justify-content: space-between; align-items: center; }
    .tour-steps { font-size: 11px; font-weight: 600; color: var(--muted, #B9AA92); }
    .tour-btns { display: flex; gap: 8px; }
    .tour-btns button { padding: 8px 14px; font-size: 12px; border-radius: 16px; font-weight: 600; cursor: pointer; font-family: 'Work Sans'; border: none; }
    .tour-btn-back { background: #EDE6D6; color: var(--ink, #241A10); }
    .tour-btn-next { background: var(--leaf, #7CB518); color: var(--soil, #2B2118); }
    @keyframes fadeIn { from{opacity:0;} to{opacity:1;} }
  `;
  document.head.appendChild(style);

  // Inject HTML structure into the body
  const container = document.createElement('div');
  container.innerHTML = `
    <div id="tour-overlay">
      <div class="tour-card">
        <span id="tour-step-badge" style="display:inline-block; background:var(--marigold,#D98E04); color:var(--soil,#2B2118); font-size:10px; font-weight:700; border-radius:12px; padding:2px 10px; margin-bottom:8px;">Step 1 of 6</span>
        <h3 id="tour-title">Welcome to Smart Irrigation</h3>
        <p id="tour-desc">Let's walk you through managing your farms, zones, weather tracking, and AI features.</p>
        <div class="tour-footer">
          <span class="tour-steps" id="tour-counter">1 / 6</span>
          <div class="tour-btns">
            <button class="tour-btn-back" id="tour-back-btn" onclick="window.tourPrev()" style="display:none;">Back</button>
            <button class="tour-btn-next" id="tour-next-btn" onclick="window.tourNext()">Next →</button>
          </div>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(container);

  // Tour Steps definition explaining all features thoroughly
  const tourSteps = [
    {
      screen: 'home',
      title: '1. Farms & Per-Location Weather',
      desc: 'Tap your farm name at the top (e.g., Kiambu Plot) to switch between different farms (like Nakuru or Machakos). The weather card updates instantly with live temperature and precipitation forecasts specific to that location.'
    },
    {
      screen: 'home',
      title: '2. Zones & Crop Monitoring',
      desc: 'Your fields are broken down into individual zones (Zone A, B, C) growing specific crops like tomatoes, cabbage, or maize. Each jar indicator shows live soil pH levels and moisture volume.'
    },
    {
      screen: 'zone',
      title: '3. Zone Details & Manual Readings',
      desc: 'Tap any zone jar to open this detailed view. Here you can track individual plant age, inspect precise soil metrics, trigger manual sensor reads, or force an instant irrigation cycle.'
    },
    {
      screen: 'scan',
      title: '4. AI Leaf Doctor',
      desc: 'Tap the center camera button in the navigation bar to snap or upload a photo of a sick leaf. The AI analyses matching patterns (like early blight) and gives immediate organic or chemical treatments.'
    },
    {
      screen: 'alerts',
      title: '5. Smart Alerts & Audio',
      desc: 'Monitor critical notifications like low water tanks, pump failures, or disease outbreaks nearby. You can tap "Read alerts aloud" to hear summaries read via cloud text-to-speech.'
    },
    {
      screen: 'ledger',
      title: '6. Cost Calculators & Reports',
      desc: 'Manage local input prices (such as agricultural lime), track harvest timelines, calculate profits and losses, and download formatted CSV reports or print PDF summaries.'
    }
  ];

  let currentTourIdx = 0;

  window.startTour = function() {
    currentTourIdx = 0;
    document.getElementById('tour-overlay').classList.add('active');
    renderTourStep();
  };

  window.tourNext = function() {
    currentTourIdx++;
    if(currentTourIdx >= tourSteps.length) {
      document.getElementById('tour-overlay').classList.remove('active');
      if(typeof store !== 'undefined') store.set('tourCompleted', true);
    } else {
      renderTourStep();
    }
  };

  window.tourPrev = function() {
    if(currentTourIdx > 0) {
      currentTourIdx--;
      renderTourStep();
    }
  };

  function renderTourStep() {
    const step = tourSteps[currentTourIdx];
    if(typeof go === 'function') go(step.screen); // Switches app view dynamically
    
    document.getElementById('tour-step-badge').textContent = `Step ${currentTourIdx + 1} of ${tourSteps.length}`;
    document.getElementById('tour-title').textContent = step.title;
    document.getElementById('tour-desc').textContent = step.desc;
    document.getElementById('tour-counter').textContent = `${currentTourIdx + 1} / ${tourSteps.length}`;
    
    document.getElementById('tour-back-btn').style.display = currentTourIdx === 0 ? 'none' : 'block';
    document.getElementById('tour-next-btn').textContent = currentTourIdx === tourSteps.length - 1 ? 'Finish ✓' : 'Next →';
  }

  // Auto-start on first visit
  setTimeout(() => {
    if(typeof store !== 'undefined' && !store.get('tourCompleted', false)) {
      startTour();
    }
  }, 1200);
})();
