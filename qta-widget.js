/*
  Quantackle AI Sales Widget (Production-ready)
  -------------------------------------------
  Paste the <script> tag below into Hostinger Website Builder (Settings → Integrations → Add custom code to all pages, or use an Embed/Custom HTML block in the footer).
  Requires a secure proxy endpoint that forwards requests to OpenAI (DO NOT expose keys in the browser).

  Minimal backend contract (POST JSON):
  POST { messages: ChatMessage[], model?: string, max_tokens?: number }
  → { content: string }

  Example Cloudflare Worker / tiny Node/Express / PHP endpoint is fine.
*/

(() => {
  if (window.__qtaWidgetLoaded) return; window.__qtaWidgetLoaded = true;

  const CONFIG = {
    // Set your secure proxy endpoint here (required for live AI responses)
    OPENAI_PROXY_URL: 'https://qta-openai.lucky-limit-b037.workers.dev/',

    // UX
    triggerScrollThresholdVH: 0.7, // trigger after ~70% of first viewport
    enableVoice: true,
    defaultVolume: 0.9,
    moveBot: true, // floating bot wanders around edges
    moveEveryMs: 4200,

    // AI generation
    model: 'gpt-4o-mini',
    systemPrompt: (
      'You are a concise, friendly sales agent for Quantackle. The site offers AI automation audits and implementation. ' +
      'Create a short, highly relevant pitch (2–3 sentences) timed for this page. Focus on identifying 2–3 tasks that unlock ' +
      '30–40% efficiency/savings (e.g., lead triage, weekly reporting, invoice follow-ups). Avoid fluff and be confident, not pushy.'
    ),
    fallbackPitch: 'Quick tip: Our AI Automation Audit usually surfaces 2–3 high‑impact tasks—like lead triage, weekly reporting, or invoice follow‑ups—\nthat deliver **30–40% time savings** within 4–6 weeks. Want a 10‑minute checklist to spot your wins?'
  };

  // ---------------- Styles ----------------
  const css = `
  :root { --qta-primary:#111827; --qta-accent:#6366f1; --qta-bg:#fff; --qta-shadow:0 10px 30px rgba(0,0,0,.15); }
  .qta-hidden{display:none!important}
  #qta-widget{position:fixed;inset:auto 18px 18px auto;z-index:2147483647;font-family:ui-sans-serif,system-ui,Segoe UI,Roboto,Inter,Arial,sans-serif;color:var(--qta-primary)}
  #qta-launcher{width:68px;height:68px;border-radius:50%;background:var(--qta-bg);box-shadow:var(--qta-shadow);display:grid;place-items:center;cursor:pointer;transition:transform .2s, box-shadow .2s;position:relative}
  #qta-launcher:hover{transform:translateY(-1px);box-shadow:0 14px 36px rgba(0,0,0,.22)}
  #qta-bot{width:44px;height:44px;display:block;animation:qta-bob 2.6s ease-in-out infinite}
  @keyframes qta-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}
  #qta-bubble{position:absolute;right:78px;bottom:6px;max-width:360px;background:var(--qta-bg);border:1px solid rgba(0,0,0,.06);border-radius:14px;padding:12px 14px 10px;box-shadow:var(--qta-shadow)}
  #qta-bubble:after{content:"";position:absolute;right:-8px;bottom:18px;border-left:8px solid var(--qta-bg);border-top:8px solid transparent;border-bottom:8px solid transparent;filter:drop-shadow(0 2px 2px rgba(0,0,0,.05))}
  #qta-bubble-header{display:flex;align-items:center;gap:8px;margin-bottom:6px;font-weight:650;letter-spacing:.2px}
  #qta-typing{line-height:1.45}
  #qta-caret{display:inline-block;width:8px;height:16px;margin-left:1px;background:#9ca3af;vertical-align:-2px;animation:qta-blink 1s steps(2, jump-none) infinite}
  @keyframes qta-blink{0%,49%{opacity:1}50%,100%{opacity:0}}
  #qta-actions{display:flex;gap:8px;margin-top:10px;align-items:center}
  .qta-btn{border:none;border-radius:10px;padding:8px 10px;cursor:pointer;font-weight:600;font-size:12.5px;box-shadow:0 2px 10px rgba(0,0,0,.05)}
  .qta-btn-ghost{background:#f3f4f6;color:#111827}
  .qta-btn-primary{background:var(--qta-accent);color:#fff}
  .qta-vol{appearance:none;height:4px;border-radius:999px;background:#e5e7eb;outline:none;width:90px}
  .qta-vol::-webkit-slider-thumb{appearance:none;width:14px;height:14px;border-radius:50%;background:var(--qta-accent)}
  #qta-panel{position:absolute;right:0;bottom:78px;width:380px;max-width:86vw;background:var(--qta-bg);border-radius:16px;box-shadow:var(--qta-shadow);border:1px solid rgba(0,0,0,.06);overflow:hidden;display:none}
  #qta-panel header{display:flex;align-items:center;justify-content:space-between;padding:10px 12px;background:#f8fafc;border-bottom:1px solid rgba(0,0,0,.06);font-weight:650}
  #qta-panel main{padding:12px}
  #qta-close{cursor:pointer;font-size:18px;line-height:1}
  #qta-minimize{position:absolute;top:-6px;right:-6px;background:#111827;color:#fff;border-radius:999px;width:22px;height:22px;display:grid;place-items:center;font-size:12px;cursor:pointer;box-shadow:var(--qta-shadow)}
  .qta-dot{width:6px;height:6px;border-radius:999px;background:#10b981;box-shadow:0 0 0 3px rgba(16,185,129,.15)}
  `;
  const style = document.createElement('style'); style.textContent = css; document.head.appendChild(style);

  // ---------------- DOM ----------------
  const root = document.createElement('div'); root.id = 'qta-widget';
  root.innerHTML = `
    <div id="qta-panel" role="dialog" aria-label="Quantackle Sales Assistant">
      <header>
        <span style="display:flex;align-items:center;gap:8px"><span class="qta-dot"></span> Quantackle Assistant</span>
        <span id="qta-close" aria-label="Close">✕</span>
      </header>
      <main id="qta-panel-content"></main>
    </div>

    <div id="qta-launcher" aria-label="Open assistant" title="Ask Quantackle">
      <div id="qta-minimize" class="qta-hidden" title="Minimize">–</div>
      <svg id="qta-bot" viewBox="0 0 64 64" aria-hidden="true">
        <defs><linearGradient id="qtaG" x1="0" x2="1"><stop offset="0%" stop-color="#6366f1"/><stop offset="100%" stop-color="#22d3ee"/></linearGradient></defs>
        <circle cx="32" cy="32" r="28" fill="url(#qtaG)" opacity=".12"/>
        <rect x="14" y="18" width="36" height="26" rx="12" fill="#111827"/>
        <circle cx="26" cy="31" r="4" fill="#22d3ee"/>
        <rect x="34" y="27" width="8" height="8" rx="2" fill="#e5e7eb"/>
        <rect x="28" y="46" width="8" height="4" rx="2" fill="#9ca3af"/>
        <rect x="29" y="12" width="6" height="8" rx="3" fill="#111827"/>
      </svg>
      <div id="qta-bubble" class="qta-hidden">
        <div id="qta-bubble-header" style="display:flex;align-items:center;gap:10px">
          <span>🤖 Quantackle Assistant</span>
          <button id="qta-mute" class="qta-btn qta-btn-ghost" style="margin-left:auto">Mute</button>
        </div>
        <div id="qta-typing" aria-live="polite"></div>
        <div id="qta-actions">
          <input id="qta-volume" class="qta-vol" type="range" min="0" max="1" step="0.05" />
          <button id="qta-examples" class="qta-btn qta-btn-ghost">Show examples</button>
          <button id="qta-talk" class="qta-btn qta-btn-primary">Let's talk</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(root);

  const bubble = root.querySelector('#qta-bubble');
  const typingEl = root.querySelector('#qta-typing');
  const panel = root.querySelector('#qta-panel');
  const panelContent = root.querySelector('#qta-panel-content');
  const closeBtn = root.querySelector('#qta-close');
  const minimizeBtn = root.querySelector('#qta-minimize');
  const launcher = root.querySelector('#qta-launcher');
  const muteBtn = root.querySelector('#qta-mute');
  const volumeSlider = root.querySelector('#qta-volume');
  const talkBtn = root.querySelector('#qta-talk');
  const examplesBtn = root.querySelector('#qta-examples');

  // ---------------- Controls ----------------
  closeBtn.addEventListener('click', () => { panel.style.display = 'none'; });
  minimizeBtn.addEventListener('click', () => { bubble.classList.add('qta-hidden'); minimizeBtn.classList.add('qta-hidden'); });
  launcher.addEventListener('click', () => { panel.style.display = (panel.style.display === 'block' ? 'none' : 'block'); minimizeBtn.classList.remove('qta-hidden'); });
  examplesBtn.addEventListener('click', () => { openPanel(); panelContent.innerHTML = renderExamples(); });
  talkBtn.addEventListener('click', () => { location.href = '/#contact'; });

  // Persisted audio state
  let isMuted = localStorage.getItem('qta_muted') === '1';
  let volume = parseFloat(localStorage.getItem('qta_volume') || CONFIG.defaultVolume);
  volumeSlider.value = String(volume);
  updateMuteUI();

  muteBtn.addEventListener('click', () => {
    isMuted = !isMuted; localStorage.setItem('qta_muted', isMuted ? '1' : '0'); updateMuteUI();
    if (isMuted && speechSynthesis) speechSynthesis.cancel();
  });
  volumeSlider.addEventListener('input', () => {
    volume = parseFloat(volumeSlider.value); localStorage.setItem('qta_volume', String(volume));
  });

  function updateMuteUI(){ muteBtn.textContent = isMuted ? 'Unmute' : 'Mute'; }
  function openPanel(){ panel.style.display = 'block'; minimizeBtn.classList.remove('qta-hidden'); }

  function renderExamples(){
    return `
      <div style="display:flex;flex-direction:column;gap:8px;font-size:14px;line-height:1.45">
        <div><strong>High‑impact tasks we automate</strong></div>
        <ul style="margin:0 0 8px 18px;padding:0">
          <li>Lead triage & enrichment → instant routing, fewer misses</li>
          <li>Monthly reporting → auto‑built decks from your data</li>
          <li>Invoice & follow‑ups → scheduled nudges, faster cash cycle</li>
        </ul>
        <div style="background:#f8fafc;border:1px solid #e5e7eb;border-radius:10px;padding:8px 10px">
          Typical outcome: <strong>30–40% time saved</strong> for ops/sales within 4–6 weeks.
        </div>
      </div>`;
  }

  // -------------- Floating bot movement --------------
  if (CONFIG.moveBot) {
    const positions = [
      {x: 18, y: 18}, // bottom-right (default)
      {x: window.innerWidth - 100, y: 18},
      {x: window.innerWidth - 100, y: window.innerHeight - 100},
      {x: 18, y: window.innerHeight - 100}
    ];
    let idx = 0;
    setInterval(() => {
      idx = (idx + 1) % positions.length;
      const p = positions[idx];
      launcher.style.transition = 'transform 1.2s ease-in-out';
      launcher.style.transform = `translate(${p.x}px, ${-p.y}px)`; // fixed container is bottom-right origin
    }, CONFIG.moveEveryMs);
    addEventListener('resize', () => { positions[1].x = innerWidth - 100; positions[2].x = innerWidth - 100; positions[2].y = innerHeight - 100; positions[3].y = innerHeight - 100; });
  }

  // -------------- AI pitch generation --------------
  async function fetchPitch(){
    const context = (document.querySelector('main')?.innerText || document.body.innerText || '').slice(0, 1600);
    try {
      const res = await fetch(CONFIG.OPENAI_PROXY_URL, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: CONFIG.model,
          messages: [
            { role: 'system', content: CONFIG.systemPrompt },
            { role: 'user', content: `Use this page context if helpful. Be brief.\n\n${context}` }
          ],
          max_tokens: 140
        })
      });
      const data = await res.json();
      return (data && data.content) || CONFIG.fallbackPitch;
    } catch(e){ return CONFIG.fallbackPitch; }
  }

  // -------------- Typing + Speech sync --------------
  async function speakAndType(text){
    bubble.classList.remove('qta-hidden'); minimizeBtn.classList.remove('qta-hidden');
    typingEl.innerHTML = '';

    // If speech synthesis supports boundary events, sync words exactly.
    const hasBoundary = ('speechSynthesis' in window) && 'onboundary' in SpeechSynthesisUtterance.prototype;

    if (!isMuted && 'speechSynthesis' in window){
      try {
        const u = new SpeechSynthesisUtterance(text.replace(/[*_`]/g, ''));
        u.rate = 1.08; u.pitch = 1; u.lang = 'en-US'; u.volume = Math.max(0, Math.min(1, volume));

        if (hasBoundary) {
          // Append words when we get boundary callbacks
          let acc = '';
          u.onboundary = (e) => {
            if (e.name === 'word' || e.charIndex !== undefined) {
              // Approx: find next chunk by char index
              const next = text.slice(0, e.charIndex);
              if (next.length > acc.length) {
                const add = text.slice(acc.length, next.length);
                acc = next; typingEl.textContent = acc; addCaret();
              }
            }
          };
          u.onend = () => { typingEl.textContent = text; removeCaret(); };
        } else {
          // Fallback: time-based typing while audio plays
          const chunk = 3; const ms = Math.max(14, Math.floor(8000 / text.length));
          let i = 0; const t = setInterval(() => {
            if (i >= text.length) { clearInterval(t); removeCaret(); return; }
            const slice = text.slice(i, i+chunk); i += chunk; typingEl.innerHTML += slice; addCaret();
          }, ms);
          u.onend = () => { clearInterval(t); typingEl.textContent = text; removeCaret(); };
        }
        speechSynthesis.cancel(); speechSynthesis.speak(u);
      } catch {
        // No audio—just fast type
        await typeOnly(text);
      }
    } else {
      await typeOnly(text);
    }
  }

  function addCaret(){ if (!typingEl.querySelector('#qta-caret')) { const c = document.createElement('span'); c.id = 'qta-caret'; typingEl.appendChild(c); } }
  function removeCaret(){ const c = typingEl.querySelector('#qta-caret'); if (c) c.remove(); }
  async function typeOnly(text){
    const chunk = 3; for (let i=0;i<text.length;i+=chunk){ typingEl.innerHTML += text.slice(i,i+chunk); addCaret(); await new Promise(r=>setTimeout(r,18)); } removeCaret();
  }

  // -------------- Triggering (after hero) --------------
  let hasTriggered = false;
  function shouldTrigger(){ return scrollY > innerHeight * CONFIG.triggerScrollThresholdVH; }
  async function maybeTrigger(){
    if (hasTriggered) return; if (!shouldTrigger()) return; hasTriggered = true;
    const msg = await fetchPitch(); speakAndType(msg);
  }
  addEventListener('scroll', maybeTrigger, { passive:true });
  addEventListener('load', () => setTimeout(maybeTrigger, 1200));

  // Tiny API
  window.QTA = {
    force: async () => { const msg = await fetchPitch(); speakAndType(msg); },
    say: (t) => speakAndType(t),
    mute: () => { isMuted = true; localStorage.setItem('qta_muted','1'); updateMuteUI(); if (speechSynthesis) speechSynthesis.cancel(); },
    unmute: () => { isMuted = false; localStorage.setItem('qta_muted','0'); updateMuteUI(); },
  };
})();
