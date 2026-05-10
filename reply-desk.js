// Reply Desk - lightweight AI assistant client
const features = {
  answerEmail: {
    title: 'Answer an email',
    template: 'You are a helpful assistant. Draft a polite, concise reply to the following email:\n\n"{{input}}"\n\nInclude subject suggestions and 3 bullet points for follow-up.'
  },
  generateReport: {
    title: 'Generate a report',
    template: 'You are an analyst. Generate a short report with overview, key metrics, and 3 recommendations given the following notes:\n\n{{input}}'
  },
  summarizeMeeting: {
    title: 'Summarize a meeting',
    template: 'Summarize the meeting notes below into 5 concise bullet points and action items:\n\n{{input}}'
  },
  manageSchedule: {
    title: 'Manage schedules',
    template: 'Given the calendar notes and constraints below, propose a schedule and suggest best time slots:\n\n{{input}}'
  },
  createContent: {
    title: 'Create content',
    template: 'Create a short piece of content (blog intro, social post, or email) based on the brief:\n\n{{input}}\n\nDeliverables: title, 2-sentence intro, 3 hashtags.'
  },
  analyzeDocument: {
    title: 'Analyze a document',
    template: 'Analyze the document below. Provide summary, key claims, and a short critique:\n\n{{input}}'
  },
  automateSupport: {
    title: 'Automate customer support',
    template: 'Given these support conversation logs and product info, suggest canned responses, routing rules, and an escalation plan:\n\n{{input}}'
  },
  manageLeads: {
    title: 'Manage sales leads',
    template: 'You are a sales assistant. Given lead notes, suggest qualification questions, scoring, and next outreach steps:\n\n{{input}}'
  }
};

// Optional: hard-code your deployed proxy URL here (helpful for local Reply Desk proxy)
const DEFAULT_PROXY = 'http://localhost:3000';

const els = {};

// Known/supported model names for client-side validation
const SUPPORTED_MODELS = [
  'gpt-3.5-turbo',
  'gpt-4',
  'gpt-4o',
  'gpt-4o-mini'
];

function validateModel(model){
  if(!model) return 'gpt-3.5-turbo';
  const m = model.trim();
  const lower = m.toLowerCase();
  if(SUPPORTED_MODELS.includes(lower)) return lower;
  if(lower.includes('3.5')) return 'gpt-3.5-turbo';
  if(lower.includes('4')) return 'gpt-4';
  return 'gpt-3.5-turbo';
}

async function runDiagnostics(){
  appendMessage('ai', 'Running diagnostics...');
  const apiKey = els.apiKey ? els.apiKey.value.trim() : '';
  // check user proxy if configured
  if(els.useProxy && els.useProxy.checked && els.proxyUrl && els.proxyUrl.value.trim()){
    const url = els.proxyUrl.value.trim().replace(/\/$/, '');
    try{
      const h = await fetch(url + '/health');
      appendMessage('ai', `Proxy health: ${h.ok ? 'OK' : 'NOT OK'} (${h.status})`);
    }catch(e){
      appendMessage('ai', `Proxy check failed: ${e.message}`);
    }
  } else {
    appendMessage('ai', 'No user proxy configured (skipping proxy check).');
  }

  // check OpenAI auth / models endpoint
  if(!apiKey){
    appendMessage('ai', 'No API key provided — cannot check OpenAI endpoint.');
    return;
  }
  try{
    const r = await fetch('https://api.openai.com/v1/models', { headers: { 'Authorization': 'Bearer ' + apiKey }});
    if(r.status === 401) {
      appendMessage('ai', 'OpenAI auth: Unauthorized (401). Check API key.');
      return;
    }
    if(r.status === 404){
      appendMessage('ai', 'OpenAI endpoint returned 404 — this may indicate an invalid base URL or proxy interference.');
      return;
    }
    if(!r.ok){
      appendMessage('ai', `OpenAI returned ${r.status} ${r.statusText}`);
      return;
    }
    const j = await r.json();
    const count = Array.isArray(j.data) ? j.data.length : (j.model ? 1 : 0);
    appendMessage('ai', `OpenAI auth OK. Models visible: ${count}`);
  }catch(e){
    appendMessage('ai', 'OpenAI models check failed: ' + e.message);
  }
}

function ensureDiagnosticsButton(){
  if(document.getElementById('diagnoseBtn')) return;
  const btn = document.createElement('button');
  btn.id = 'diagnoseBtn';
  btn.textContent = 'Run Diagnostics';
  btn.style.position = 'fixed';
  btn.style.right = '18px';
  btn.style.bottom = '18px';
  btn.style.zIndex = 9999;
  btn.className = 'ripple';
  btn.addEventListener('click', ()=>{ btn.classList.add('pulse'); runDiagnostics().finally(()=> setTimeout(()=> btn.classList.remove('pulse'), 360)); });
  document.body.appendChild(btn);
}

function ensureTestButton(){
  if(document.getElementById('testBtn')) return;
  const btn = document.createElement('button');
  btn.id = 'testBtn';
  btn.textContent = 'Send Test';
  btn.style.position = 'fixed';
  btn.style.right = '18px';
  btn.style.bottom = '64px';
  btn.style.zIndex = 9999;
  btn.className = 'ripple';
  btn.addEventListener('click', ()=>{ btn.classList.add('pulse'); runTestRequest().finally(()=> setTimeout(()=> btn.classList.remove('pulse'), 360)); });
  document.body.appendChild(btn);
}

async function runTestRequest(){
  appendMessage('ai', 'Running test request...');
  const apiKey = els.apiKey ? els.apiKey.value.trim() : '';
  const rawModel = document.getElementById('modelSelect')?.value || 'gpt-3.5-turbo';
  const model = validateModel(rawModel);
  const samplePrompt = 'Connectivity test — please reply with \"pong\".';
  const body = { model, messages: [{ role: 'user', content: samplePrompt }], max_tokens: 50, temperature: 0 };

  const userProxy = (els.useProxy && els.useProxy.checked && els.proxyUrl && els.proxyUrl.value.trim()) ? els.proxyUrl.value.trim().replace(/\/$/, '') : null;
  try{
    if(userProxy){
      appendMessage('ai', `Sending test to proxy at ${userProxy}/api/chat`);
      const r = await fetch(userProxy + '/api/chat', {
        method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body)
      });
      const text = await r.text();
      appendMessage('ai', `Proxy response: ${r.status} ${r.statusText}\n${text.slice(0,1200)}`);
      return;
    }

    if (window.__aiProxyAvailable) {
      appendMessage('ai', 'Sending test to local /server API');
      const r = await fetch('/server/api/chat', {
        method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body)
      });
      const text = await r.text();
      appendMessage('ai', `/server response: ${r.status} ${r.statusText}\n${text.slice(0,1200)}`);
      return;
    }

    if(!apiKey){
      appendMessage('ai', 'No API key provided — using local stubbed response.');
      appendMessage('ai', 'Stubbed reply: pong');
      return;
    }

    appendMessage('ai', 'Sending test to OpenAI (https://api.openai.com/v1/chat/completions)');
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST', headers: { 'Authorization': 'Bearer ' + apiKey, 'Content-Type':'application/json' }, body: JSON.stringify(body)
    });
    const txt = await r.text();
    if(!r.ok){
      appendMessage('ai', `OpenAI returned ${r.status} ${r.statusText}: ${txt.slice(0,1200)}`);
    } else {
      appendMessage('ai', `OpenAI OK (${r.status}) — response (truncated):\n${txt.slice(0,1200)}`);
    }
  }catch(e){
    appendMessage('ai', 'Test request failed: ' + e.message);
  }
}

function ensureAutoReplyToggle(){
  if(document.getElementById('autoReplyToggle')) return;
  const key = 'replyDesk:autoReply';
  const current = localStorage.getItem(key);
  // default to always-on as requested
  const enabled = current === null ? true : (current === '1');

  const btn = document.createElement('button');
  btn.id = 'autoReplyToggle';
  function render(){
    btn.textContent = enabledState() ? 'Auto-Reply: ON' : 'Auto-Reply: OFF';
    btn.style.background = enabledState() ? '#0b8' : '#ddd';
    btn.style.color = enabledState() ? '#002' : '#000';
  }
  function enabledState(){ return btn.dataset.enabled === '1'; }

  btn.dataset.enabled = enabled ? '1' : '0';
  btn.style.position = 'fixed';
  btn.style.right = '18px';
  btn.style.bottom = '110px';
  btn.style.zIndex = 9999;
  btn.className = 'ripple';
  btn.addEventListener('click', ()=>{
    const now = enabledState() ? '0' : '1';
    btn.dataset.enabled = now;
    localStorage.setItem(key, now === '1' ? '1' : '0');
    render();
  });
  render();
  document.body.appendChild(btn);
}

// Programmatic API for incoming messages (could be called from host integration)
window.replyDesk = window.replyDesk || {};
window.replyDesk.receiveCustomerMessage = async function(text, options={}){
  // options: { feature: 'answerEmail' }
  appendMessage('user', text);
  const key = 'replyDesk:autoReply';
  const enabled = localStorage.getItem(key) === null ? true : localStorage.getItem(key) === '1';
  if(!enabled) return;
  const feature = options.feature || 'answerEmail';
  // Determine auto-reply mode: 'immediate' or 'queue'
  const mode = localStorage.getItem('replyDesk:auto:mode') || 'immediate';
  if(mode === 'immediate'){
    try{
      await runFeature(feature, text);
      return { sent: true };
    }catch(e){
      appendMessage('ai', 'Auto-reply failed: ' + (e && e.message ? e.message : String(e)));
      return { sent: false, error: (e && e.message) ? e.message : String(e) };
    }
  } else {
    // queue for review
    addToQueue(text, feature, options && options.ackTarget ? options.ackTarget : null, options && options.msgId ? options.msgId : null);
    return { queued: true };
  }
};

async function ackPost(ackTarget, msgId){
  if(!ackTarget || !msgId) return;
  // Retry/backoff logic: try up to 3 times with exponential backoff
  const maxTries = 3;
  let attempt = 0;
  let lastErr = null;
  while(attempt < maxTries){
    attempt++;
    try{
      let url = ackTarget.trim();
      // determine configured ack path (default '/ack')
      let cfg = (localStorage.getItem('replyDesk:ack:path') || '/ack').trim() || '/ack';
      if(!cfg.startsWith('/')) cfg = '/' + cfg;
      // if ackTarget doesn't already include the configured path, append it
      const esc = cfg.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&');
      const re = new RegExp(esc + '(\/|$)');
      if(!re.test(url)){
        url = url.replace(/\/$/, '') + cfg;
      }
      const resp = await fetch(url, {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ id: msgId })
      });
      if(!resp.ok) throw new Error('ACK returned ' + resp.status);
      appendMessage('ai', `ACK sent for ${msgId} -> ${url}`);
      return;
    }catch(e){
      lastErr = e;
      appendMessage('ai', `ACK attempt ${attempt} failed for ${msgId}: ${e.message}`);
      // exponential backoff
      const wait = Math.pow(2, attempt) * 300;
      await new Promise(r => setTimeout(r, wait));
    }
  }
  appendMessage('ai', `ACK failed after ${maxTries} attempts for ${msgId}: ${lastErr && lastErr.message}`);
}

// Queue UI for pending auto-replies
function ensureQueuePanel(){
  if(document.getElementById('replyQueue')) return;
  const panel = document.createElement('div');
  panel.id = 'replyQueue';
  panel.style.position = 'fixed';
  panel.style.right = '18px';
  panel.style.bottom = '150px';
  panel.style.width = '320px';
  panel.style.maxHeight = '40vh';
  panel.style.overflow = 'auto';
  panel.style.background = 'rgba(255,255,255,0.98)';
  panel.style.border = '1px solid #ddd';
  panel.style.borderRadius = '8px';
  panel.style.padding = '8px';
  panel.style.zIndex = 9999;
  const title = document.createElement('div');
  title.textContent = 'Pending Auto-Replies';
  title.style.fontWeight = '600';
  title.style.marginBottom = '6px';
  panel.appendChild(title);
  const list = document.createElement('div');
  list.id = 'replyQueueList';
  panel.appendChild(list);
  document.body.appendChild(panel);
}

function addToQueue(text, feature, ackTarget, msgId){
  // ackTarget and msgId may be stored on the item when queued from polling
  ensureQueuePanel();
  const id = 'q_' + Date.now() + '_' + Math.random().toString(36).slice(2,8);
  const list = document.getElementById('replyQueueList');
  const item = document.createElement('div');
  item.className = 'queueItem';
  item.dataset.qid = id;
  if(ackTarget) item.dataset.ackTarget = ackTarget;
  if(msgId) item.dataset.msgId = msgId;
  item.style.borderTop = '1px solid #eee';
  item.style.padding = '8px 0';
  const txt = document.createElement('div'); txt.textContent = text; txt.style.marginBottom = '6px';
  const meta = document.createElement('div'); meta.style.display = 'flex'; meta.style.gap = '8px';
  const feat = document.createElement('div'); feat.textContent = features[feature]?.title || feature; feat.style.flex = '1'; feat.style.fontSize = '12px'; feat.style.opacity = '.8';
  const sendBtn = document.createElement('button'); sendBtn.textContent = 'Send'; sendBtn.className='ripple';
  const discardBtn = document.createElement('button'); discardBtn.textContent = 'Discard'; discardBtn.className='ripple';
  meta.appendChild(feat); meta.appendChild(sendBtn); meta.appendChild(discardBtn);
  item.appendChild(txt); item.appendChild(meta);
  list.appendChild(item);

  sendBtn.addEventListener('click', async ()=>{
    sendBtn.disabled = true; sendBtn.textContent = 'Sending...';
    try{
      await runFeature(feature, text);
      // if ack target attached, send ACK
      const ackTarget = item.dataset.ackTarget || null;
      const msgId = item.dataset.msgId || null;
      if(ackTarget && msgId){
        await ackPost(ackTarget, msgId);
      }
      item.remove();
    }catch(e){
      appendMessage('ai', 'Queued send failed: ' + (e && e.message ? e.message : String(e)));
      sendBtn.disabled = false; sendBtn.textContent = 'Send';
    }
  });
  discardBtn.addEventListener('click', ()=>{ item.remove(); });
}

// --- Simple polling example -------------------------------------------------
function ensurePollingControls(){
  if(document.getElementById('pollPanel')) return;
  const panel = document.createElement('div');
  panel.id = 'pollPanel';
  panel.style.position = 'fixed';
  panel.style.left = '18px';
  panel.style.bottom = '18px';
  panel.style.padding = '10px';
  panel.style.background = 'rgba(255,255,255,0.95)';
  panel.style.border = '1px solid #ddd';
  panel.style.borderRadius = '8px';
  panel.style.zIndex = 9999;

  const urlIn = document.createElement('input');
  urlIn.id = 'pollUrl';
  urlIn.placeholder = 'Polling URL (GET)';
  urlIn.style.width = '240px';
  urlIn.value = localStorage.getItem('replyDesk:poll:url') || '';

  const intervalIn = document.createElement('input');
  intervalIn.id = 'pollInterval';
  intervalIn.type = 'number';
  intervalIn.min = '1000';
  intervalIn.style.width = '80px';
  intervalIn.value = localStorage.getItem('replyDesk:poll:interval') || '5000';

  // feature selector for auto-reply (persisted)
  const featureSelect = document.createElement('select');
  featureSelect.id = 'pollFeature';
  featureSelect.style.marginLeft = '8px';
  const savedFeature = localStorage.getItem('replyDesk:poll:feature') || 'automateSupport';
  Object.keys(features).forEach(k => {
    const o = document.createElement('option');
    o.value = k;
    o.textContent = features[k].title || k;
    if(k === savedFeature) o.selected = true;
    featureSelect.appendChild(o);
  });
  featureSelect.addEventListener('change', ()=> localStorage.setItem('replyDesk:poll:feature', featureSelect.value));

  // auto-reply mode select: immediate | queue
  const modeSelect = document.createElement('select');
  modeSelect.id = 'pollMode';
  modeSelect.style.marginLeft = '8px';
  const savedMode = localStorage.getItem('replyDesk:auto:mode') || 'immediate';
  const opt1 = document.createElement('option'); opt1.value='immediate'; opt1.textContent='Immediate';
  const opt2 = document.createElement('option'); opt2.value='queue'; opt2.textContent='Queue';
  modeSelect.appendChild(opt1); modeSelect.appendChild(opt2);
  modeSelect.value = savedMode;
  modeSelect.addEventListener('change', ()=> localStorage.setItem('replyDesk:auto:mode', modeSelect.value));

  const ackPathIn = document.createElement('input');
  ackPathIn.id = 'ackPath';
  ackPathIn.placeholder = '/ack';
  ackPathIn.style.width = '120px';
  ackPathIn.style.marginLeft = '8px';
  ackPathIn.value = localStorage.getItem('replyDesk:ack:path') || '/ack';
  ackPathIn.addEventListener('change', ()=> localStorage.setItem('replyDesk:ack:path', ackPathIn.value.trim()));

  const btn = document.createElement('button');
  btn.id = 'pollToggle';
  btn.textContent = 'Start Polling';
  btn.className = 'ripple';

  // small helper buttons: Send All (queue), Clear Seen
  const sendAllBtn = document.createElement('button');
  sendAllBtn.textContent = 'Send All';
  sendAllBtn.className = 'ripple';
  sendAllBtn.style.marginLeft = '6px';
  sendAllBtn.addEventListener('click', ()=>{
    const items = Array.from(document.querySelectorAll('#replyQueueList .queueItem'));
    items.forEach(it => {
      const send = it.querySelector('button');
      if(send) send.click();
    });
  });

  const clearSeenBtn = document.createElement('button');
  clearSeenBtn.textContent = 'Clear Seen';
  clearSeenBtn.className = 'ripple';
  clearSeenBtn.style.marginLeft = '6px';
  clearSeenBtn.addEventListener('click', ()=>{ localStorage.removeItem('replyDesk:poll:seen'); seen.clear(); appendMessage('ai','Seen list cleared.'); });

  panel.appendChild(urlIn);
  panel.appendChild(document.createElement('br'));
  panel.appendChild(intervalIn);
  panel.appendChild(document.createTextNode(' Feature: '));
  panel.appendChild(featureSelect);
  panel.appendChild(document.createTextNode(' Mode: '));
  panel.appendChild(modeSelect);
  panel.appendChild(document.createTextNode(' ACK: '));
  panel.appendChild(ackPathIn);
  panel.appendChild(btn);
  panel.appendChild(sendAllBtn);
  panel.appendChild(clearSeenBtn);
  document.body.appendChild(panel);

  let pollTimer = null;
  const seen = new Set(JSON.parse(localStorage.getItem('replyDesk:poll:seen') || '[]'));

  async function doPoll(){
    const url = urlIn.value.trim();
    if(!url) return;
    try{
      const r = await fetch(url, {cache:'no-store'});
      if(!r.ok){ appendMessage('ai', `Polling error ${r.status} ${r.statusText}`); return; }
      const j = await r.json();
      // Expect { messages: [ { id, text } ] }
      const msgs = Array.isArray(j.messages) ? j.messages : (Array.isArray(j) ? j : []);
      for(const m of msgs){
        if(!m || !m.id) continue;
        if(seen.has(m.id)) continue;
        seen.add(m.id);
        try{ localStorage.setItem('replyDesk:poll:seen', JSON.stringify(Array.from(seen))); }catch(e){}
        // feed into auto-reply using selected feature
        const feature = (document.getElementById('pollFeature') && document.getElementById('pollFeature').value) || savedFeature || 'automateSupport';
        // provide ackTarget and msgId so receiveCustomerMessage / queue can ack later
        const ackTarget = m.ack_url || url;
        const msgId = m.id;
        const res = await window.replyDesk.receiveCustomerMessage(m.text || m.body || m.content || '', { feature, ackTarget, msgId });
        // If processing was immediate and succeeded, ack now
        if(res && res.sent){
          // try acking: prefer message ack_url, otherwise poll base URL
          await ackPost(m.ack_url || url, m.id);
        }
      }
    }catch(e){ appendMessage('ai', 'Polling failed: ' + e.message); }
  }

  function start(){
    const interval = Math.max(1000, parseInt(intervalIn.value, 10) || 5000);
    localStorage.setItem('replyDesk:poll:url', urlIn.value.trim());
    localStorage.setItem('replyDesk:poll:interval', String(interval));
    // persist selected feature
    localStorage.setItem('replyDesk:poll:feature', (featureSelect && featureSelect.value) || savedFeature);
    // persist ack path
    localStorage.setItem('replyDesk:ack:path', (ackPathIn && ackPathIn.value.trim()) || '/ack');
    if(pollTimer) clearInterval(pollTimer);
    pollTimer = setInterval(doPoll, interval);
    btn.textContent = 'Stop Polling';
    btn.dataset.running = '1';
    appendMessage('ai', 'Polling started.');
    // run immediately once
    doPoll();
  }

  function stop(){
    if(pollTimer) clearInterval(pollTimer);
    pollTimer = null;
    btn.textContent = 'Start Polling';
    btn.dataset.running = '0';
    appendMessage('ai', 'Polling stopped.');
  }

  btn.addEventListener('click', ()=>{
    const running = btn.dataset.running === '1';
    if(running) stop(); else start();
  });

  // auto-start if a URL is stored and user opted-in
  const auto = localStorage.getItem('replyDesk:poll:auto') === '1';
  if(urlIn.value && auto) start();
}

function injectStyles(){
  if(document.getElementById('reply-desk-styles')) return;
  const s = document.createElement('style');
  s.id = 'reply-desk-styles';
  s.textContent = `
  /* Message animations */
  .msg{opacity:0; transform:translateY(8px); transition:opacity .26s ease, transform .26s ease; margin:8px 0;}
  .msg.visible{opacity:1; transform:translateY(0)}
  .msg.ai{background:rgba(240,240,255,0.9); padding:10px; border-radius:8px;}
  .msg.user{background:rgba(230,255,230,0.95); padding:10px; border-radius:8px; align-self:flex-end}
  .msg.ai.typing .dots{display:flex; gap:6px}
  .dots{display:flex; align-items:center}
  .dot{width:8px;height:8px;background:#666;border-radius:50%;opacity:.3;animation:blink 1s infinite}
  .dot:nth-child(2){animation-delay:.12s}
  .dot:nth-child(3){animation-delay:.24s}
  @keyframes blink{0%{opacity:.15;transform:translateY(0)}50%{opacity:1;transform:translateY(-3px)}100%{opacity:.15;transform:translateY(0)}}
  /* ripple */
  .ripple{position:relative;overflow:hidden}
  .ripple-circle{position:absolute;border-radius:50%;background:rgba(0,0,0,0.12);transform:scale(0);animation:ripple .6s linear}
  @keyframes ripple{to{transform:scale(1);opacity:0}}
  .pulse{animation:pop .36s ease}
  @keyframes pop{0%{transform:scale(1)}50%{transform:scale(1.06)}100%{transform:scale(1)}}
  /* Panel styles */
  #pollPanel input, #pollPanel select{padding:6px;border:1px solid #ccc;border-radius:6px;margin:4px 6px 4px 0}
  #pollPanel button{margin-left:6px;padding:6px 8px;border-radius:6px;border:none;background:#0366d6;color:#fff}
  #replyQueue{box-shadow:0 8px 30px rgba(0,0,0,0.08)}
  #replyQueue .queueItem{background:#fff;padding:8px;border-radius:6px;margin-bottom:6px}
  #replyQueue button{padding:6px 8px;border-radius:6px;border:1px solid #ccc;background:#f5f5f5}
  #diagnoseBtn,#testBtn,#autoReplyToggle,#testBtn,#diagnoseBtn{background:#0b8;color:#002;border:none;padding:8px 10px;border-radius:8px}
  #diagnoseBtn{background:#ffb74d;color:#222}
  #testBtn{background:#4db6ac;color:#022}
  #autoReplyToggle{background:#7cc576}
  /* small helpers */
  #pollPanel label{font-size:12px;color:#444;margin-right:6px}
  `;
  document.head.appendChild(s);
}

function appendMessage(role, text) {
  const container = document.getElementById('messages');
  const wrapper = document.createElement('div');
  wrapper.className = 'msg ' + (role === 'user' ? 'user' : 'ai');

  const meta = document.createElement('div');
  meta.className = 'meta';
  const avatar = document.createElement('div');
  avatar.className = 'avatar ' + (role === 'user' ? 'user' : 'ai');
  avatar.textContent = role === 'user' ? 'U' : 'AI';
  const time = document.createElement('div');
  const now = new Date();
  time.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  meta.appendChild(avatar);
  meta.appendChild(time);

  const body = document.createElement('div');
  body.className = 'body';
  body.textContent = text;

  wrapper.appendChild(meta);
  wrapper.appendChild(body);
  // append hidden, then trigger entrance animation
  container.appendChild(wrapper);
  // force a reflow then add visible class to animate
  requestAnimationFrame(() => {
    wrapper.classList.add('visible');
    container.scrollTop = container.scrollHeight;
  });
}

function createTypingIndicator(){
  const container = document.getElementById('messages');
  const wrapper = document.createElement('div');
  wrapper.className = 'msg ai typing';

  const meta = document.createElement('div');
  meta.className = 'meta';
  const avatar = document.createElement('div');
  avatar.className = 'avatar ai';
  avatar.textContent = 'AI';
  meta.appendChild(avatar);

  const body = document.createElement('div');
  body.className = 'body';
  const dots = document.createElement('div');
  dots.className = 'dots';
  for(let i=0;i<3;i++){ const d = document.createElement('div'); d.className='dot'; dots.appendChild(d);} 
  body.appendChild(dots);

  wrapper.appendChild(meta);
  wrapper.appendChild(body);
  container.appendChild(wrapper);
  requestAnimationFrame(()=> wrapper.classList.add('visible'));
  container.scrollTop = container.scrollHeight;
  return wrapper;
}

function removeTypingIndicator(el){
  try{ if(el && el.parentNode) el.parentNode.removeChild(el);}catch(e){}
}

async function callOpenAI(prompt, apiKey, model='gpt-3.5-turbo'){
  if(!apiKey) {
    // Stubbed response for offline/demo use
    await new Promise(r=>setTimeout(r,400));
    return 'Stubbed AI response:\n' + prompt.slice(0,100) + (prompt.length>100? '...':'' );
  }

  const body = {
    model,
    messages: [{role:'user', content: prompt}],
    max_tokens: 800,
    temperature: 0.2
  };

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if(!res.ok){
    const txt = await res.text();
    if (res.status === 404) {
      const hint = 'Resource not found. Check the endpoint URL, proxy, or model name used by `modelSelect`.';
      throw new Error('OpenAI error: ' + res.status + ' ' + txt + ' Hint: ' + hint);
    }
    throw new Error('OpenAI error: ' + res.status + ' ' + txt);
  }

  const j = await res.json();
  return j.choices?.[0]?.message?.content || '';
}

function renderFeaturePrompt(key, inputSample=''){
  const f = features[key];
  if(!f) return;
  const prompt = f.template.replace('{{input}}', inputSample || '[paste content here]');
  document.getElementById('featurePrompt').textContent = prompt;
}

async function runFeature(key, inputText){
  const feature = features[key];
  if(!feature) return;
  const apiKey = document.getElementById('apiKey').value.trim();
  const rawModel = document.getElementById('modelSelect').value || 'gpt-3.5-turbo';
  const model = validateModel(rawModel);
    if(model !== rawModel) appendMessage('ai', `Model adjusted to ${model} for compatibility.`);
  const prompt = feature.template.replace('{{input}}', inputText || '');

  appendMessage('user', `${feature.title}: ${inputText || ''}`);
  // show typing indicator while we fetch
  const typingEl = createTypingIndicator();
  try{
    // Preference order:
    // 1) explicit proxy URL provided by user and enabled
    // 2) local server at /server
    // 3) direct OpenAI call using API key (or stub)
    let respText = '';
    const userProxy = (els.useProxy && els.useProxy.checked && els.proxyUrl && els.proxyUrl.value.trim()) ? els.proxyUrl.value.trim().replace(/\/$/, '') : null;

    if (userProxy) {
      try {
        const h = await fetch(userProxy + '/health');
        if (h.ok) {
          const r = await fetch(userProxy + '/api/chat', {
            method: 'POST',
            headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ messages: [{role:'user', content: prompt}], model })
          });
          if (!r.ok) throw new Error('Proxy error '+r.status);
          const j = await r.json();
          respText = j.choices?.[0]?.message?.content || JSON.stringify(j);
        }
      } catch (e) {
        console.warn('User proxy failed:', e.message);
      }
    }

    if (!respText) {
      if (window.__aiProxyAvailable === undefined) {
        try{ const h = await fetch('/server/health'); window.__aiProxyAvailable = h.ok; }catch(e){ window.__aiProxyAvailable = false; }
      }
      if (window.__aiProxyAvailable) {
        const r = await fetch('/server/api/chat', {
          method: 'POST',
          headers: {'Content-Type':'application/json'},
          body: JSON.stringify({ messages: [{role:'user', content: prompt}], model })
        });
        if (!r.ok) throw new Error('Proxy error '+r.status);
        const j = await r.json();
        respText = j.choices?.[0]?.message?.content || JSON.stringify(j);
      }
    }

    if (!respText) {
      respText = await callOpenAI(prompt, apiKey, model);
    }

    removeTypingIndicator(typingEl);
    document.getElementById('lastResponse').textContent = respText;
    appendMessage('ai', respText);
  } catch(err) {
    removeTypingIndicator(typingEl);
    const msg = 'Error: ' + err.message;
    document.getElementById('lastResponse').textContent = msg;
    appendMessage('ai', msg);
  }
}

function init(){
  els.apiKey = document.getElementById('apiKey');
  els.clearKey = document.getElementById('clearKey');
  els.sendMessage = document.getElementById('sendMessage');
  els.clearChat = document.getElementById('clearChat');
  els.userInput = document.getElementById('userInput');
  els.lastResponse = document.getElementById('lastResponse');
  els.proxyUrl = document.getElementById('proxyUrl');
  els.useProxy = document.getElementById('useProxy');

  injectStyles();

  // prefill proxy input if DEFAULT_PROXY is set
  if (typeof DEFAULT_PROXY === 'string' && DEFAULT_PROXY.trim()) {
    els.proxyUrl.value = DEFAULT_PROXY.trim().replace(/\/$/, '');
    els.useProxy.checked = true;
  }

  // Feature buttons: click to load template, dblclick to quick-run
  document.querySelectorAll('.feature-btn').forEach(btn => {
    const key = btn.dataset.feature;
    btn.addEventListener('click', ()=>{
      renderFeaturePrompt(key);
      els.userInput.value = '';
    });
    btn.addEventListener('dblclick', ()=>{
      const sample = '[Paste the email, notes, or document here]';
      runFeature(key, els.userInput.value || sample);
    });
  });

  // Add ripple to all buttons once
  function addRipple(b){
    b.classList.add('ripple');
    b.addEventListener('pointerdown', function(e){
      const rect = b.getBoundingClientRect();
      const circle = document.createElement('div');
      circle.className = 'ripple-circle';
      const size = Math.max(rect.width, rect.height);
      circle.style.width = circle.style.height = size + 'px';
      circle.style.left = (e.clientX - rect.left - size/2) + 'px';
      circle.style.top = (e.clientY - rect.top - size/2) + 'px';
      b.appendChild(circle);
      circle.addEventListener('animationend', ()=> circle.remove());
    });
  }
  document.querySelectorAll('button').forEach(b => addRipple(b));

  // send button pulse (visual only)
  els.sendMessage.addEventListener('click', ()=>{
    els.sendMessage.classList.add('pulse');
    els.sendMessage.addEventListener('animationend', function t(){ els.sendMessage.classList.remove('pulse'); els.sendMessage.removeEventListener('animationend', t); });
  });

  // ensure diagnostics button exists for quick checks
  ensureDiagnosticsButton();
  ensureTestButton();
  ensureQueuePanel();
  ensurePollingControls();
  // auto-run diagnostics and a quick test once on load
  if(!window.__replyDeskAutoRan){
    window.__replyDeskAutoRan = true;
    setTimeout(async ()=>{
      try{
        await runDiagnostics();
        await runTestRequest();
      }catch(e){
        console.warn('Reply Desk auto-run failed:', e);
      }
    }, 600);
  }

  // keyboard shortcut (Ctrl/Cmd+Enter)
  document.addEventListener('keydown', (e)=>{
    if((e.ctrlKey || e.metaKey) && e.key === 'Enter'){
      e.preventDefault();
      els.sendMessage.click();
    }
  });

  els.clearKey.addEventListener('click', ()=>{els.apiKey.value='';});
  els.clearChat.addEventListener('click', ()=>{document.getElementById('messages').innerHTML=''; els.lastResponse.textContent='No response yet.'});

  // Send on Enter (press Enter to send, Shift+Enter for newline)
  els.userInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      els.sendMessage.click();
    }
  });

  els.sendMessage.addEventListener('click', async ()=>{
    const text = els.userInput.value.trim();
    if(!text) return;
    // If the user has loaded a feature template in the preview, detect and run that feature automatically
    const featureText = document.getElementById('featurePrompt').textContent || '';
    const matched = Object.keys(features).find(k => features[k].template === featureText || featureText.startsWith(features[k].template.split('{{input}}')[0]));
    if(matched){
      await runFeature(matched, text);
    } else {
      appendMessage('user', text);
      const typingEl = createTypingIndicator();
      const apiKey = els.apiKey.value.trim();
      const rawModel = document.getElementById('modelSelect').value || 'gpt-3.5-turbo';
      const model = validateModel(rawModel);
      if(model !== rawModel) appendMessage('ai', `Model adjusted to "+${model}+" for compatibility.`);
      try{
        const resp = await callOpenAI(text, apiKey, model);
        removeTypingIndicator(typingEl);
        els.lastResponse.textContent = resp;
        appendMessage('ai', resp);
      }catch(err){
        removeTypingIndicator(typingEl);
        const msg = err && err.message ? err.message : String(err);
        appendMessage('ai', 'Error: '+msg);
      }
    }
    els.userInput.value='';
  });

}

window.addEventListener('DOMContentLoaded', init);
