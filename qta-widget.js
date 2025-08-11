(() => {
  if (window.__qtaWidgetLoaded) return; window.__qtaWidgetLoaded = true;

  const CONFIG = {
    OPENAI_PROXY_URL: 'https://qta-openai.lucky-limit-b037.workers.dev/', // <-- set your Worker URL
    model: 'gpt-4o-mini',
    triggerScrollThresholdVH: 0.7,
    enableVoice: true,
    defaultVolume: 0.9,
    driftWhenIdle: true,      // subtle micro-movement only when idle
    driftRadius: 8,           // px around anchor
    driftEveryMs: 1800,
    introMaxSentences: 2,     // 1–3 lines; we clamp by words below
    introMaxWords: 45,        // guardrail (< ~18s at ~150-180 wpm)
    systemPrompt:
      'You are a concise, friendly sales agent for Quantackle. The site offers AI automation audits and implementation. ' +
      'Write a VERY SHORT pitch (1–3 lines, under ~20s aloud). Focus on identifying 2–3 tasks that unlock 30–40% efficiency/savings ' +
      '(e.g., lead triage, weekly reporting, invoice follow-ups). Avoid fluff. Use confident, helpful tone.',
    fallbackPitch:
      'Quick tip: An AI Automation Audit often surfaces 2–3 high-impact tasks—lead triage, weekly reporting, invoice follow-ups—\n' +
      'that deliver **30–40% time savings** within weeks. Want examples?'
  };

  // ---------------- Styles ----------------
  const css = `
  :root { --qta-primary:#111827; --qta-accent:#6366f1; --qta-glass:rgba(255,255,255,.5); --qta-shadow:0 10px 30px rgba(0,0,0,.15); }
  .qta-hidden{display:none!important}
  #qta-widget{position:fixed;right:18px;bottom:18px;z-index:2147483647;font-family:ui-sans-serif,system-ui,Segoe UI,Roboto,Inter,Arial,sans-serif;color:var(--qta-primary)}
  #qta-launcher{width:68px;height:68px;border-radius:16px;background:var(--qta-glass);backdrop-filter:blur(8px);box-shadow:var(--qta-shadow);display:grid;place-items:center;cursor:pointer;transition:transform .2s;position:relative;contain:layout}
  #qta-launcher:hover{transform:translateY(-1px)}
  #qta-bot{width:44px;height:44px;display:block}
  .qta-eye{transform-origin:center;animation:qta-blink 6s infinite}
  @keyframes qta-blink{0%,97%,100%{transform:scaleY(1)}98%,99%{transform:scaleY(.1)}}
  #qta-bubble{position:fixed;max-width:360px;background:var(--qta-glass);backdrop-filter:blur(8px);border:1px solid rgba(0,0,0,.06);border-radius:14px;padding:12px 14px 10px;box-shadow:var(--qta-shadow)}
  #qta-bubble-arrow{position:absolute;width:0;height:0}
  #qta-bubble-header{display:flex;align-items:center;gap:8px;margin-bottom:6px;font-weight:650;letter-spacing:.2px}
  #qta-close-session{margin-left:auto;background:transparent;border:none;font-size:18px;cursor:pointer;line-height:1}
  #qta-typing{line-height:1.45;word-wrap:break-word}
  #qta-caret{display:inline-block;width:8px;height:16px;margin-left:1px;background:#9ca3af;vertical-align:-2px;animation:qta-blink-c 1s steps(2, jump-none) infinite}
  @keyframes qta-blink-c{0%,49%{opacity:1}50%,100%{opacity:0}}
  #qta-actions{display:flex;gap:8px;margin-top:10px;align-items:center;flex-wrap:wrap}
  .qta-btn{border:none;border-radius:10px;padding:8px 10px;cursor:pointer;font-weight:600;font-size:12.5px;box-shadow:0 2px 10px rgba(0,0,0,.05)}
  .qta-btn-ghost{background:rgba(243,244,246,.8);color:#111827}
  .qta-btn-primary{background:var(--qta-accent);color:#fff}
  .qta-vol{appearance:none;height:4px;border-radius:999px;background:#e5e7eb;outline:none;width:90px}
  .qta-vol::-webkit-slider-thumb{appearance:none;width:14px;height:14px;border-radius:50%;background:var(--qta-accent)}
  #qta-panel{position:fixed;right:18px;bottom:96px;width:380px;max-width:86vw;background:var(--qta-glass);backdrop-filter:blur(8px);border-radius:16px;box-shadow:var(--qta-shadow);border:1px solid rgba(0,0,0,.06);overflow:hidden;display:none}
  #qta-panel header{display:flex;align-items:center;justify-content:space-between;padding:10px 12px;background:rgba(248,250,252,.7);border-bottom:1px solid rgba(0,0,0,.06);font-weight:650}
  #qta-panel main{padding:12px}
  @media (max-width: 640px){
    #qta-launcher{width:56px;height:56px;border-radius:14px}
    #qta-bot{width:34px;height:34px}
    #qta-bubble{max-width:78vw;padding:10px}
    #qta-typing{font-size:14px}
    #qta-panel{right:12px;bottom:80px;width:92vw}
  }
  `;
  const style = document.createElement('style'); style.textContent = css; document.head.appendChild(style);

  if (sessionStorage.getItem('qta_closed_session') === '1') return;

  // ---------------- DOM ----------------
  const root = document.createElement('div'); root.id = 'qta-widget';
  root.innerHTML = `
    <div id="qta-panel" role="dialog" aria-label="Quantackle Sales Assistant">
      <header>
        <span style="display:flex;align-items:center;gap:8px">🔎 Quantackle Assistant</span>
        <button id="qta-panel-close" aria-label="Close panel" class="qta-btn qta-btn-ghost">Close</button>
      </header>
      <main id="qta-panel-content"></main>
    </div>

    <div id="qta-launcher" aria-label="Open assistant" title="Ask Quantackle">
      <svg id="qta-bot" viewBox="0 0 64 64" aria-hidden="true">
        <rect x="10" y="14" width="44" height="36" rx="12" fill="#111827"/>
        <circle class="qta-eye" cx="26" cy="32" r="4" fill="#22d3ee"/>
        <circle class="qta-eye" cx="38" cy="32" r="4" fill="#22d3ee"/>
        <path class="qta-mouth" d="M 22 39 Q 32 42 42 39" stroke="#e5e7eb" stroke-width="2" fill="none"/>
        <rect x="29" y="8" width="6" height="8" rx="3" fill="#111827"/>
      </svg>

      <div id="qta-bubble" class="qta-hidden" role="status">
        <div id="qta-bubble-header">
          <span>🤖 Quantackle Assistant</span>
          <button id="qta-close-session" title="Close for this session">✕</button>
        </div>
        <div id="qta-typing" aria-live="polite"></div>
        <div id="qta-actions">
          <input id="qta-volume" class="qta-vol" type="range" min="0" max="1" step="0.05" />
          <button id="qta-examples" class="qta-btn qta-btn-ghost">Show Examples</button>
          <button id="qta-more" class="qta-btn qta-btn-primary">Hear More</button>
          <button id="qta-mute" class="qta-btn qta-btn-ghost">Mute</button>
        </div>
        <div id="qta-bubble-arrow"></div>
      </div>
    </div>
  `;
  document.body.appendChild(root);

  const bubble = root.querySelector('#qta-bubble');
  const bubbleArrow = root.querySelector('#qta-bubble-arrow');
  const typingEl = root.querySelector('#qta-typing');
  const panel = root.querySelector('#qta-panel');
  const panelContent = root.querySelector('#qta-panel-content');
  const panelClose = root.querySelector('#qta-panel-close');
  const launcher = root.querySelector('#qta-launcher');
  const mouth = root.querySelector('.qta-mouth');
  const closeSessionBtn = root.querySelector('#qta-close-session');
  const examplesBtn = root.querySelector('#qta-examples');
  const moreBtn = root.querySelector('#qta-more');
  const muteBtn = root.querySelector('#qta-mute');
  const volumeSlider = root.querySelector('#qta-volume');

  const initialMouthD = mouth.getAttribute('d');

  // State
  let isMuted = localStorage.getItem('qta_muted') === '1';
  let volume = parseFloat(localStorage.getItem('qta_volume') || CONFIG.defaultVolume);
  let isSpeaking = false;
  let driftTimer = null;

  volumeSlider.value = String(volume);
  updateMuteUI();

  panelClose.addEventListener('click', () => panel.style.display = 'none');
  launcher.addEventListener('click', () => { panel.style.display = (panel.style.display === 'block') ? 'none' : 'block'; });
  examplesBtn.addEventListener('click', () => { openPanel(); panelContent.innerHTML = renderExamples(); });
  moreBtn.addEventListener('click', async () => { await say(await fetchPitch({ more:true })); });
  closeSessionBtn.addEventListener('click', () => { sessionStorage.setItem('qta_closed_session','1'); cleanupSpeech(); hideAll(); });
  muteBtn.addEventListener('click', toggleMute);
  volumeSlider.addEventListener('input', () => { volume = parseFloat(volumeSlider.value); localStorage.setItem('qta_volume', String(volume)); });

  function toggleMute(){ isMuted = !isMuted; localStorage.setItem('qta_muted', isMuted ? '1' : '0'); updateMuteUI(); if (isMuted) cleanupSpeech(); }
  function updateMuteUI(){ muteBtn.textContent = isMuted ? 'Unmute' : 'Mute'; }
  function openPanel(){ panel.style.display = 'block'; }
  function hideAll(){ bubble.classList.add('qta-hidden'); panel.style.display='none'; }

  // ------- Subtle drift (idle only) -------
  const anchor = { x: 0, y: 0 };
  function startDrift(){ if (!CONFIG.driftWhenIdle || driftTimer) return; driftTimer = setInterval(()=>{ if (isSpeaking) return; const dx=(Math.random()*2-1)*CONFIG.driftRadius; const dy=(Math.random()*2-1)*CONFIG.driftRadius; anchor.x = Math.max(-12, Math.min(12, anchor.x+dx)); anchor.y = Math.max(-12, Math.min(12, anchor.y+dy)); launcher.style.transform = `translate(${anchor.x}px, ${anchor.y}px)`; ensureBubbleInView(); }, CONFIG.driftEveryMs); }
  function stopDrift(){ if (driftTimer){ clearInterval(driftTimer); driftTimer=null; } }

  // ------- Fetch pitch (intro or more) -------
  async function fetchPitch(opts={}){
    const context = (document.querySelector('main')?.innerText || document.body.innerText || '').slice(0, 1600);
    const modePrompt = opts.more ? 'Give one short follow-up (1–2 sentences) with concrete examples tailored to the context. Keep it brief.' : CONFIG.systemPrompt;
    try {
      const res = await fetch(CONFIG.OPENAI_PROXY_URL, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ model: CONFIG.model, messages:[ {role:'system', content: modePrompt}, {role:'user', content:`Use this page context if helpful. Be brief.\n\n${context}`} ], max_tokens: opts.more ? 90 : 110 })
      });
      const data = await res.json();
      const raw = (data && data.content) || CONFIG.fallbackPitch;
      return opts.more ? raw : clipIntro(raw);
    } catch(e){ return opts.more ? 'For example: lead triage, reporting, invoice nudges. Want a 10-min audit call?' : CONFIG.fallbackPitch; }
  }

  function clipIntro(text){
    text = String(text || '').replace(/\s+/g,' ').trim();
    const sentences = text.match(/[^.!?]+[.!?]?/g) || [text];
    let out = sentences.slice(0, CONFIG.introMaxSentences).join(' ').trim();
    const words = out.split(' ');
    if (words.length > CONFIG.introMaxWords) out = words.slice(0, CONFIG.introMaxWords).join(' ') + '…';
    return out;
  }

  // ------- Speak & Type (synced) -------
  async function say(text){
    bubble.classList.remove('qta-hidden');
    ensureBubbleInView();
    typingEl.textContent = '';
    stopDrift();
    setSpeaking(true);

    const caret = document.createElement('span'); caret.id='qta-caret'; typingEl.appendChild(caret);
    let typedLen = 0; let boundarySeen = false; let fallbackTimer = null; let mouthTimer = null;

    function typeTo(idx){ if (idx<=typedLen) return; typingEl.textContent = text.slice(0, idx); typingEl.appendChild(caret); typedLen = idx; ensureBubbleInView(); }
    function pulseMouth(){
      mouth.setAttribute('d', 'M 22 39 Q 32 45 42 39');
      setTimeout(()=> mouth.setAttribute('d', 'M 22 39 Q 32 42 42 39'), 120);
    }

    if (!CONFIG.enableVoice || isMuted || !('speechSynthesis' in window)){
      await typeOnly(text); finish(); return;
    }
    try {
      const u = new SpeechSynthesisUtterance(text.replace(/[*_`]/g,''));
      u.rate = 1.05; u.pitch = 1; u.lang = 'en-US'; u.volume = Math.max(0, Math.min(1, volume));

      const hasBoundary = 'onboundary' in SpeechSynthesisUtterance.prototype;
      if (hasBoundary){
        u.onboundary = (e)=>{ boundarySeen=true; const idx = e.charIndex || 0; typeTo(idx); pulseMouth(); };
      }
      u.onstart = ()=>{
        fallbackTimer = setTimeout(()=>{ if (!boundarySeen){ timedFallbackType(text, typeTo); } }, 300);
        mouthTimer = setInterval(pulseMouth, 400);
      };
      u.onend = ()=>{ if (fallbackTimer) clearInterval(fallbackTimer); if (mouthTimer) clearInterval(mouthTimer); finish(); };

      speechSynthesis.cancel(); speechSynthesis.speak(u);
    } catch{
      await typeOnly(text); finish();
    }

    function finish(){ typingEl.textContent = text; caret.remove(); setSpeaking(false); startDrift(); mouth.setAttribute('d', initialMouthD); }
  }

  function timedFallbackType(text, typeTo){
    const chunk = 3; let i = 0; const ms = Math.max(14, Math.floor(7000 / Math.max(40, text.length)));
    const t = setInterval(()=>{ i = Math.min(text.length, i+chunk); typeTo(i); if (i>=text.length) clearInterval(t); }, ms);
    return t;
  }

  async function typeOnly(text){ const chunk=3; for(let i=0;i<text.length;i+=chunk){ typingEl.textContent += text.slice(i,i+chunk); await sleep(18); ensureBubbleInView(); } }
  function sleep(ms){ return new Promise(r=>setTimeout(r,ms)); }

  function setSpeaking(v){ isSpeaking = !!v; if (v) stopDrift(); }
  function cleanupSpeech(){ if ('speechSynthesis' in window){ try{ speechSynthesis.cancel(); }catch{} } setSpeaking(false); mouth.setAttribute('d', initialMouthD); }

  // ------- Bubble positioning (always in viewport) -------
  function ensureBubbleInView(){
    const lRect = launcher.getBoundingClientRect();
    const bRect = bubble.getBoundingClientRect();
    const vw = window.innerWidth, vh = window.innerHeight;
    let sideRight = true;
    if (lRect.right + 16 + bRect.width > vw) sideRight = false;
    let top = lRect.top + lRect.height/2 - bRect.height/2;
    if (top + bRect.height > vh - 10) top = vh - bRect.height - 10;
    if (top < 10) top = 10;
    const left = sideRight ? (lRect.right + 12) : (lRect.left - bRect.width - 12);
    bubble.style.top = `${Math.max(10, top)}px`;
    bubble.style.left = `${Math.max(10, Math.min(vw - bRect.width - 10, left))}px`;
    bubbleArrow.style.border = '6px solid transparent';
    bubbleArrow.style.position = 'absolute';
    if (sideRight){
      bubbleArrow.style.borderRightColor = 'rgba(255,255,255,.5)';
      bubbleArrow.style.left = '-12px';
      bubbleArrow.style.top = `${(bRect.height/2)-6}px`;
    } else {
      bubbleArrow.style.borderLeftColor = 'rgba(255,255,255,.5)';
      bubbleArrow.style.left = `${bRect.width}px`;
      bubbleArrow.style.top = `${(bRect.height/2)-6}px`;
    }
  }
  window.addEventListener('resize', ensureBubbleInView, { passive:true });
  window.addEventListener('scroll', ensureBubbleInView, { passive:true });

  // ------- Trigger after hero -------
  let hasTriggered = false;
  function shouldTrigger(){ return scrollY > innerHeight * CONFIG.triggerScrollThresholdVH; }
  async function maybeTrigger(){ if (hasTriggered) return; if (!shouldTrigger()) return; hasTriggered = true; const msg = await fetchPitch(); await say(msg); }
  addEventListener('scroll', maybeTrigger, { passive:true });
  addEventListener('load', () => setTimeout(maybeTrigger, 1200));

  window.QTA = {
    force: async () => { const msg = await fetchPitch(); await say(msg); },
    say: async (t) => say(t),
    mute: () => { if (!isMuted){ toggleMute(); } },
    unmute: () => { if (isMuted){ toggleMute(); } }
  };

  function renderExamples(){
    return `
      <div style="display:flex;flex-direction:column;gap:8px;font-size:14px;line-height:1.45">
        <div><strong>High-impact tasks we automate</strong></div>
        <ul style="margin:0 0 8px 18px;padding:0">
          <li>Lead triage & enrichment → instant routing, fewer misses</li>
          <li>Monthly reporting → auto-built decks from your data</li>
          <li>Invoice & follow-ups → scheduled nudges, faster cash cycle</li>
        </ul>
        <div style="background:rgba(248,250,252,.7);border:1px solid #e5e7eb;border-radius:10px;padding:8px 10px">
          Typical outcome: <strong>30–40% time saved</strong> for ops/sales within 4–6 weeks.
        </div>
      </div>`;
  }

  startDrift();
})();
