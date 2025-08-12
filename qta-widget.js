(() => {
  if (window.__qtaWidgetLoaded) return; window.__qtaWidgetLoaded = true;

  const CONFIG = {
    OPENAI_PROXY_URL: 'https://qta-openai.lucky-limit-b037.workers.dev/',
    model: 'gpt-4o-mini',

    // ---- UI / behavior ----
    enableVoice: true,
    defaultVolume: 0.9,
    driftWhenIdle: true,
    driftRadius: 8,
    driftEveryMs: 1800,
    triggerScrollThresholdVH: 0.7,

    // Default position (center-right). Can be overridden by persisted position.
    initial: { top: 0.5, right: 18 },

    // Intro text limits
    introMaxSentences: 2,
    introMaxWords: 45,

    // Copy
    systemPrompt:
      'You are a concise, friendly sales agent for Quantackle. The site offers AI automation audits and implementation. ' +
      'Write a VERY SHORT pitch (1–3 lines, under ~20s aloud). Focus on identifying 2–3 tasks that unlock 30–40% efficiency/savings ' +
      '(e.g., lead triage, weekly reporting, invoice follow-ups). Avoid fluff. Use confident, helpful tone.',
    examplesPrompt:
      'Give 3 short, concrete example prompts a site visitor might click. Each 6–10 words. Start each line with a • bullet. No numbering.',
    fallbackPitch:
      'Quick tip: An AI Automation Audit often surfaces 2–3 high-impact tasks—lead triage, weekly reporting, invoice follow-ups—\n' +
      'that deliver **30–40% time savings** within weeks. Want examples?',

    // ---- TTS (ElevenLabs via proxy) ----
    ttsProvider: 'proxy-tts',
    // IMPORTANT: must end with /tts (Worker route).
    TTS_PROXY_URL: 'https://eleven-labs.lucky-limit-b037.workers.dev/tts',
    ttsVoice: 'cgSgspJ2msm6clMCkdW9', // Jessica
    eleven: {
      model: 'eleven_flash_v2',
      instruction: 'Deliver like an engaging human: light interjections (well, hmm, okay), subtle breath sounds, dynamic pauses, varied pace and pitch. Keep it professional, friendly, confident.'
    }
  };

  // ---------------- Styles ----------------
  const css = `
  :root { --qta-primary:#111827; --qta-accent:#6366f1; --qta-glass:rgba(255,255,255,.5); --qta-shadow:0 10px 30px rgba(0,0,0,.15); }
  .qta-hidden{display:none!important}
  #qta-widget{position:fixed;inset:0;pointer-events:none;z-index:2147483647;font-family:ui-sans-serif,system-ui,Segoe UI,Roboto,Inter,Arial,sans-serif;color:var(--qta-primary)}

  /* Launcher */
  #qta-launcher{position:fixed; width:68px;height:68px;border-radius:16px;background:var(--qta-glass);backdrop-filter:blur(8px);box-shadow:var(--qta-shadow);display:grid;place-items:center;cursor:grab;transition:box-shadow .2s;contain:layout; pointer-events:auto}
  #qta-launcher:active{cursor:grabbing}
  #qta-bot{width:44px;height:44px;display:block}
  .qta-eye{transform-origin:center;animation:qta-blink 6s infinite}
  @keyframes qta-blink{0%,97%,100%{transform:scaleY(1)}98%,99%{transform:scaleY(.1)}}

  /* Bubble (compact, semi-transparent) */
  #qta-bubble{position:fixed;z-index:2147483647;min-width:240px;max-width:min(520px,86vw);background:var(--qta-glass);backdrop-filter:blur(8px);border:1px solid rgba(0,0,0,.06);border-radius:14px;padding:8px 10px;box-shadow:var(--qta-shadow); pointer-events:auto}
  #qta-bubble *{font-size:11px}
  #qta-bubble-header{display:flex;align-items:center;gap:8px;margin-bottom:4px;font-weight:650;letter-spacing:.2px}
  #qta-close-session{margin-left:auto;background:transparent;border:none;font-size:14px;cursor:pointer;line-height:1}
  #qta-typing{line-height:1.3;word-wrap:break-word;word-break:break-word}
  #qta-caret{display:inline-block;width:6px;height:12px;margin-left:1px;background:#9ca3af;vertical-align:-1px;animation:qta-blink-c 1s steps(2, jump-none) infinite}
  @keyframes qta-blink-c{0%,49%{opacity:1}50%,100%{opacity:0}}
  #qta-actions{display:flex;gap:6px;margin-top:8px;align-items:center;flex-wrap:wrap}
  .qta-btn{border:none;border-radius:9px;padding:6px 8px;cursor:pointer;font-weight:600;font-size:11px;box-shadow:0 2px 10px rgba(0,0,0,.05)}
  .qta-btn-ghost{background:rgba(243,244,246,.85);color:#111827}
  .qta-btn-primary{background:var(--qta-accent);color:#fff}
  .qta-vol{appearance:none;height:3px;border-radius:999px;background:#e5e7eb;outline:none;width:90px}
  .qta-vol::-webkit-slider-thumb{appearance:none;width:12px;height:12px;border-radius:50%;background:var(--qta-accent)}

  #qta-panel{position:fixed;right:18px;bottom:96px;width:380px;max-width:86vw;background:var(--qta-glass);backdrop-filter:blur(8px);border-radius:16px;box-shadow:var(--qta-shadow);border:1px solid rgba(0,0,0,.06);overflow:hidden;display:none; pointer-events:auto; z-index:2147483647}
  #qta-panel header{display:flex;align-items:center;justify-content:space-between;padding:8px 10px;background:rgba(248,250,252,.7);border-bottom:1px solid rgba(0,0,0,.06);font-weight:650}
  .qta-panel-main{padding:10px}

  @media (max-width: 640px){
    #qta-launcher{width:56px;height:56px;border-radius:14px}
    #qta-bot{width:34px;height:34px}
    #qta-bubble{min-width:200px;max-width:86vw;padding:8px}
    #qta-bubble *{font-size:10px}
    #qta-typing{font-size:10px}
    #qta-panel{right:12px;bottom:80px;width:92vw}
  }
  `;
  const style = document.createElement('style'); style.textContent = css; document.head.appendChild(style);

  if (sessionStorage.getItem('qta_closed_session_v2') === '1') return;

  // ---------------- DOM ----------------
  const root = document.createElement('div'); root.id = 'qta-widget';
  root.innerHTML = `
    <div id="qta-panel" role="dialog" aria-label="Quantackle Sales Assistant">
      <header>
        <span style="display:flex;align-items:center;gap:8px">🔎 Quantackle Assistant</span>
        <button id="qta-panel-close" aria-label="Close panel" class="qta-btn qta-btn-ghost">Close</button>
      </header>
      <div id="qta-panel-content" class="qta-panel-main"></div>
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
      </div>
    </div>
  `;
  document.body.appendChild(root);

  const bubble = root.querySelector('#qta-bubble');
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

  // -------------- State --------------
  let isMuted = localStorage.getItem('qta_muted') === '1';
  let volume = parseFloat(localStorage.getItem('qta_volume') || CONFIG.defaultVolume);
  let isSpeaking = false;
  let driftTimer = null;
  let dragging = false;
  let dragOffset = { x: 0, y: 0 };
  let dragBubbleLock = null; // keeps bubble glued during drag

  volumeSlider.value = String(volume);
  updateMuteUI();

  // -------------- Positioning --------------
  const savedPos = JSON.parse(localStorage.getItem('qta_pos') || 'null');
  function applyInitialPosition(){
    let topPx, leftPx;
    if (savedPos) { topPx = savedPos.top; leftPx = savedPos.left; }
    else { const vh = window.innerHeight; const vw = window.innerWidth; topPx = Math.round(vh * CONFIG.initial.top - 34); leftPx = vw - CONFIG.initial.right - 68; }
    setLauncherPosition({ top: topPx, left: leftPx });
  }
  function setLauncherPosition({ top, left }){
    if (typeof top === 'number') launcher.style.top = `${Math.max(10, Math.min(window.innerHeight - launcher.offsetHeight - 10, top))}px`;
    if (typeof left === 'number') launcher.style.left = `${Math.max(10, Math.min(window.innerWidth - launcher.offsetWidth - 10, left))}px`;
    launcher.style.right = '';
    if (!dragging) ensureBubbleAnchor();
  }
  function persistPosition(){
    const styleTop = parseFloat(launcher.style.top || '0');
    const styleLeft = launcher.style.left ? parseFloat(launcher.style.left) : null;
    localStorage.setItem('qta_pos', JSON.stringify({ top: styleTop, left: styleLeft }));
  }

  // -------------- Events --------------
  panelClose.addEventListener('click', () => panel.style.display = 'none');
  launcher.addEventListener('click', (e) => { if (dragging) return; panel.style.display = (panel.style.display === 'block') ? 'none' : 'block'; });
  examplesBtn.addEventListener('click', handleExamplesClick);
  moreBtn.addEventListener('click', async () => { await say(await fetchPitch({ more:true })); });
  closeSessionBtn.addEventListener('click', () => { sessionStorage.setItem('qta_closed_session_v2','1'); cleanupSpeech(); hideAll(); });
  muteBtn.addEventListener('click', toggleMute);
  volumeSlider.addEventListener('input', () => { volume = parseFloat(volumeSlider.value); localStorage.setItem('qta_volume', String(volume)); });

  // Drag logic
  launcher.addEventListener('pointerdown', (e) => {
    dragging = true; stopDrift(); setSpeaking(false);
    launcher.setPointerCapture(e.pointerId);
    const rect = launcher.getBoundingClientRect();
    dragOffset.x = e.clientX - rect.left; dragOffset.y = e.clientY - rect.top;
    // lock bubble offset relative to launcher during drag
    if (!bubble.classList.contains('qta-hidden')) {
      const l = rect; const b = bubble.getBoundingClientRect();
      dragBubbleLock = { dx: b.left - l.right, dy: b.top - l.top };
    } else dragBubbleLock = null;
    ensureBubbleAnchor();
  });
  window.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const nx = Math.max(10, Math.min(window.innerWidth - launcher.offsetWidth - 10, e.clientX - dragOffset.x));
    const ny = Math.max(10, Math.min(window.innerHeight - launcher.offsetHeight - 10, e.clientY - dragOffset.y));
    launcher.style.left = `${nx}px`; launcher.style.top = `${ny}px`;
    if (dragBubbleLock) {
      const lRect = launcher.getBoundingClientRect();
      bubble.style.left = `${lRect.right + dragBubbleLock.dx}px`;
      bubble.style.top  = `${lRect.top   + dragBubbleLock.dy}px`;
    } else {
      ensureBubbleAnchor();
    }
  }, { passive: true });
  window.addEventListener('pointerup', (e) => {
    if (!dragging) return;
    dragging = false; launcher.releasePointerCapture?.(e.pointerId);
    dragBubbleLock = null; ensureBubbleAnchor();
    persistPosition(); startDrift();
  });

  function toggleMute(){ isMuted = !isMuted; localStorage.setItem('qta_muted', isMuted ? '1' : '0'); updateMuteUI(); if (isMuted) cleanupSpeech(); }
  function updateMuteUI(){ muteBtn.textContent = isMuted ? 'Unmute' : 'Mute'; }
  function openPanel(){ panel.style.display = 'block'; }
  function hideAll(){ bubble.classList.add('qta-hidden'); panel.style.display='none'; }

  // ------- Subtle drift -------
  function startDrift(){ if (!CONFIG.driftWhenIdle || driftTimer) return; driftTimer = setInterval(()=>{
    if (isSpeaking || dragging) return; const rect = launcher.getBoundingClientRect();
    const dx=(Math.random()*2-1)*CONFIG.driftRadius; const dy=(Math.random()*2-1)*CONFIG.driftRadius;
    setLauncherPosition({ top: rect.top + dy, left: rect.left + dx });
  }, CONFIG.driftEveryMs); }
  function stopDrift(){ if (driftTimer){ clearInterval(driftTimer); driftTimer=null; } }

  // ------- Fetch pitch / examples -------
  function pickContent(data){
    return data?.content || data?.message || data?.text || data?.choices?.[0]?.message?.content || '';
  }
  async function fetchPitch(opts={}){
    const context = (document.querySelector('main')?.innerText || document.body.innerText || '').slice(0, 1600);
    const modePrompt = opts.more ? 'Give one short follow-up (1–2 sentences) with concrete examples tailored to the context. Keep it brief.' : CONFIG.systemPrompt;
    try {
      const res = await fetch(CONFIG.OPENAI_PROXY_URL, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ model: CONFIG.model, messages:[ {role:'system', content: modePrompt}, {role:'user', content:`Use this page context if helpful. Be brief.\n\n${context}`} ], max_tokens: opts.more ? 90 : 110 }) });
      const data = await res.json();
      const raw = pickContent(data) || CONFIG.fallbackPitch;
      return opts.more ? raw : clipIntro(raw);
    } catch(e){ return opts.more ? 'For example: lead triage, reporting, invoice nudges. Want a 10-min audit call?' : CONFIG.fallbackPitch; }
  }
  async function fetchExamples(){
    const context = (document.querySelector('main')?.innerText || document.body.innerText || '').slice(0, 1600);
    try {
      const res = await fetch(CONFIG.OPENAI_PROXY_URL, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ model: CONFIG.model, messages:[ {role:'system', content: CONFIG.examplesPrompt}, {role:'user', content:`Tailor to this page context.\n\n${context}`} ], max_tokens: 120 }) });
      const data = await res.json();
      const txt = pickContent(data) || '• Show a 4-week automation plan\n• Estimate ROI from AI audit\n• What can you automate first?';
      return txt;
    } catch(e){ return '• Lead triage with enrichment\n• Auto-build monthly reports\n• Invoice reminders that work'; }
  }

  function renderExamples(list){
    const html = String(list).split(/\n+/).map(line => `<div>${line}</div>`).join('');
    return `<div style="display:flex;flex-direction:column;gap:6px;line-height:1.35">${html}</div>`;
  }
  async function handleExamplesClick(){
    openPanel(); panelContent.innerHTML = '<div style="opacity:.7">Generating examples…</div>';
    const list = await fetchExamples(); panelContent.innerHTML = renderExamples(list);
  }

  function clipIntro(text){
    text = String(text || '').replace(/\s+/g,' ').trim();
    const sentences = text.match(/[^.!?]+[.!?]?/g) || [text];
    let out = sentences.slice(0, CONFIG.introMaxSentences).join(' ').trim();
    const words = out.split(' ');
    if (words.length > CONFIG.introMaxWords) out = words.slice(0, CONFIG.introMaxWords).join(' ') + '…';
    return out;
  }

  // ------- TTS: ElevenLabs via proxy OR fallback to Web Speech -------
  async function speak(text){
    if (!CONFIG.enableVoice || isMuted) return null;
    if (CONFIG.ttsProvider === 'proxy-tts' && CONFIG.TTS_PROXY_URL) {
      try {
        const res = await fetch(CONFIG.TTS_PROXY_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, voice: CONFIG.ttsVoice, model: CONFIG.eleven.model, instruction: CONFIG.eleven.instruction }) });
        if (!res.ok) throw new Error('Bad TTS response');
        const type = res.headers.get('Content-Type') || 'audio/mpeg';
        const buf = await res.arrayBuffer();
        const blob = new Blob([buf], { type });
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url); audio.volume = Math.max(0, Math.min(1, volume)); await audio.play();
        return { stop: () => { try { audio.pause(); audio.currentTime = 1e9; } catch {} URL.revokeObjectURL(url); } };
      } catch (e) {
        // fall through to Web Speech
      }
    }

    if (!('speechSynthesis' in window)) return null;
    const u = new SpeechSynthesisUtterance(text.replace(/[*_`]/g,''));
    u.rate = 1.02; u.pitch = 1; u.lang = 'en-US'; u.volume = Math.max(0, Math.min(1, volume));
    speechSynthesis.cancel(); speechSynthesis.speak(u);
    return { stop: () => { try { speechSynthesis.cancel(); } catch {} } };
  }

  // ------- Speak & Type (synced) -------
  async function say(text){
    bubble.classList.remove('qta-hidden'); ensureBubbleAnchor();
    typingEl.textContent = ''; stopDrift(); setSpeaking(true);

    const caret = document.createElement('span'); caret.id='qta-caret'; typingEl.appendChild(caret);
    let typedLen = 0; let boundarySeen = false; let fallbackTimer = null; let mouthTimer = null; let speaker = null;

    function typeTo(idx){ if (idx<=typedLen) return; typingEl.textContent = text.slice(0, idx); typingEl.appendChild(caret); typedLen = idx; if(!dragging) ensureBubbleAnchor(); }
    function pulseMouth(){ mouth.setAttribute('d', 'M 22 39 Q 32 45 42 39'); setTimeout(()=> mouth.setAttribute('d', 'M 22 39 Q 32 42 42 39'), 120); }

    try {
      if ('speechSynthesis' in window && 'onboundary' in SpeechSynthesisUtterance.prototype && CONFIG.ttsProvider !== 'proxy-tts') {
        const u = new SpeechSynthesisUtterance(text.replace(/[*_`]/g,''));
        u.rate = 1.02; u.pitch = 1; u.lang = 'en-US'; u.volume = Math.max(0, Math.min(1, volume));
        u.onboundary = (e)=>{ boundarySeen=true; const idx = e.charIndex || 0; typeTo(idx); pulseMouth(); };
        u.onstart = ()=>{ fallbackTimer = setTimeout(()=>{ if (!boundarySeen){ timedFallbackType(text, typeTo); } }, 300); mouthTimer = setInterval(pulseMouth, 420); };
        u.onend = ()=>{ if (fallbackTimer) clearTimeout(fallbackTimer); if (mouthTimer) clearInterval(mouthTimer); finish(); };
        speechSynthesis.cancel(); speechSynthesis.speak(u);
      } else {
        speaker = await speak(text); fallbackTimer = timedFallbackType(text, typeTo); mouthTimer = setInterval(pulseMouth, 420);
        const estimatedMs = Math.max(3000, Math.min(15000, text.split(/\s+/).length * 350)); setTimeout(()=>{ clearInterval(mouthTimer); finish(); }, estimatedMs);
      }
    } catch { await typeOnly(text); finish(); }

    function finish(){ typingEl.textContent = text; try{ caret.remove(); }catch{} setSpeaking(false); startDrift(); mouth.setAttribute('d', initialMouthD); speaker?.stop?.(); }
  }

  function timedFallbackType(text, typeTo){ const chunk = 3; let i = 0; const ms = Math.max(12, Math.floor(6000 / Math.max(40, text.length))); const t = setInterval(()=>{ i = Math.min(text.length, i+chunk); typeTo(i); if (i>=text.length) clearInterval(t); }, ms); return t; }
  async function typeOnly(text){ const chunk=3; for(let i=0;i<text.length;i+=chunk){ typingEl.textContent += text.slice(i,i+chunk); await sleep(16); if(!dragging) ensureBubbleAnchor(); } }
  function sleep(ms){ return new Promise(r=>setTimeout(r,ms)); }

  function setSpeaking(v){ isSpeaking = !!v; if (v) stopDrift(); }
  function cleanupSpeech(){ try{ speechSynthesis.cancel(); }catch{} setSpeaking(false); mouth.setAttribute('d', initialMouthD); }

  // ------- Bubble anchoring to bot -------
  function ensureBubbleAnchor(){
    const lRect = launcher.getBoundingClientRect();
    const bRect = bubble.getBoundingClientRect();
    const vw = window.innerWidth, vh = window.innerHeight;
    let sideRight = lRect.right + 12 + bRect.width <= vw;
    let top = lRect.top + lRect.height/2 - bRect.height/2;
    if (top + bRect.height > vh - 10) top = vh - bRect.height - 10; if (top < 10) top = 10;
    const left = sideRight ? (lRect.right + 10) : (lRect.left - bRect.width - 10);
    bubble.style.top = `${Math.max(10, top)}px`; bubble.style.left = `${Math.max(10, Math.min(vw - bRect.width - 10, left))}px`;
  }
  window.addEventListener('resize', ensureBubbleAnchor, { passive:true });
  window.addEventListener('scroll', ensureBubbleAnchor, { passive:true });

  // ------- Trigger after hero -------
  let hasTriggered = false; function shouldTrigger(){ return scrollY > innerHeight * CONFIG.triggerScrollThresholdVH; }
  async function maybeTrigger(){ if (hasTriggered) return; if (!shouldTrigger()) return; hasTriggered = true; const msg = await fetchPitch(); await say(msg); }
  addEventListener('scroll', maybeTrigger, { passive:true });
  addEventListener('load', () => { applyInitialPosition(); setTimeout(maybeTrigger, 1200); startDrift(); });

  // Public API
  window.QTA = {
    force: async () => { const msg = await fetchPitch(); await say(msg); },
    say: async (t) => say(t),
    mute: () => { if (!isMuted){ toggleMute(); } },
    unmute: () => { if (isMuted){ toggleMute(); } },
    setPosition: (top, left) => { setLauncherPosition({ top, left }); persistPosition(); }
  };
})();

}
function cors(res){ res.headers.set('Access-Control-Allow-Origin', '*'); return res; }
