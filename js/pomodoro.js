// ── Pomodoro Timer ──

const POMO_WORK_SECS  = 25 * 60;
const POMO_BREAK_SECS = 5  * 60;
const POMO_SESSIONS   = 4;
const RING_CIRC       = 2 * Math.PI * 66;

let pomoMode     = 'work';
let pomoRunning  = false;
let pomoSecsLeft = POMO_WORK_SECS;
let pomoInterval = null;
let pomoDone     = 0;

function initPomo() {
  const fill = document.getElementById('pomoRingFill');
  fill.style.strokeDasharray  = RING_CIRC;
  fill.style.strokeDashoffset = 0;
  updatePomoDisplay(); updatePomoRing(); updatePomoSessions();
}

function setPomoMode(mode) {
  pomoMode    = mode;
  pomoRunning = false;
  clearInterval(pomoInterval);
  pomoSecsLeft = mode === 'work' ? POMO_WORK_SECS : POMO_BREAK_SECS;
  document.getElementById('pomoBtnWork').classList.toggle('active',  mode === 'work');
  document.getElementById('pomoBtnBreak').classList.toggle('active', mode === 'break');
  document.getElementById('pomoRingFill').classList.toggle('break',  mode === 'break');
  document.getElementById('pomoPlayBtn').classList.toggle('active-break', mode === 'break');
  document.getElementById('pomoDisplay').classList.remove('running');
  updatePomoDisplay(); updatePomoRing(); setPomoLabel('ready'); setPlayIcon(false);
}

function togglePomo()  { pomoRunning ? pausePomo() : startPomo(); }

function startPomo() {
  pomoRunning = true; setPlayIcon(true);
  setPomoLabel(pomoMode === 'work' ? 'focus' : 'rest');
  document.getElementById('pomoDisplay').classList.add('running');
  pomoInterval = setInterval(() => {
    pomoSecsLeft--;
    updatePomoDisplay(); updatePomoRing();
    if (pomoSecsLeft <= 0) { clearInterval(pomoInterval); pomoRunning = false; onPomoComplete(); }
  }, 1000);
}

function pausePomo() {
  pomoRunning = false; clearInterval(pomoInterval); setPlayIcon(false);
  setPomoLabel('paused');
  document.getElementById('pomoDisplay').classList.remove('running');
}

function resetPomo() {
  pomoRunning = false; clearInterval(pomoInterval);
  pomoSecsLeft = pomoMode === 'work' ? POMO_WORK_SECS : POMO_BREAK_SECS;
  document.getElementById('pomoDisplay').classList.remove('running');
  updatePomoDisplay(); updatePomoRing(); setPomoLabel('ready'); setPlayIcon(false);
}

function skipPomo() {
  pomoRunning = false; clearInterval(pomoInterval);
  document.getElementById('pomoDisplay').classList.remove('running');
  onPomoComplete();
}

function onPomoComplete() {
  setPlayIcon(false);
  document.getElementById('pomoDisplay').classList.remove('running');
  if (pomoMode === 'work') {
    pomoDone = Math.min(pomoDone + 1, POMO_SESSIONS);
    updatePomoSessions();
    if (pomoDone >= POMO_SESSIONS) { pomoDone = 0; updatePomoSessions(); }
    setPomoLabel('done! take a break 🎉');
    setTimeout(() => setPomoMode('break'), 1200);
  } else {
    setPomoLabel('break over — back to it 💪');
    setTimeout(() => setPomoMode('work'), 1200);
  }
}

function updatePomoDisplay() {
  const mins = String(Math.floor(pomoSecsLeft / 60)).padStart(2, '0');
  const secs = String(pomoSecsLeft % 60).padStart(2, '0');
  document.getElementById('pomoDisplay').innerHTML =
    digitSVG(mins[0]) + digitSVG(mins[1]) +
    colonSVG(pomoRunning ? (pomoSecsLeft % 2 === 0) : true) +
    digitSVG(secs[0]) + digitSVG(secs[1]);
  document.getElementById('pomoMiniTime').textContent = `${mins}:${secs}`;
}

function updatePomoRing() {
  const total = pomoMode === 'work' ? POMO_WORK_SECS : POMO_BREAK_SECS;
  document.getElementById('pomoRingFill').style.strokeDashoffset = RING_CIRC * (1 - pomoSecsLeft / total);
}

function updatePomoSessions() {
  document.getElementById('pomoSessions').innerHTML =
    Array.from({ length: POMO_SESSIONS }, (_, i) =>
      `<div class="pomo-session-dot ${i < pomoDone ? 'done' : ''}"></div>`
    ).join('');
}

function setPomoLabel(text) {
  const el = document.getElementById('pomoLabel');
  el.textContent = text;
  el.className = 'pomodoro-label ' + (
    text === 'ready' || text === 'paused' ? 'idle' :
    pomoMode === 'break' ? 'break' : 'work'
  );
}

function setPlayIcon(playing) {
  document.getElementById('pomoPlayIcon').innerHTML = playing
    ? '<rect x="4" y="3" width="3" height="10" rx="1" fill="currentColor"/><rect x="9" y="3" width="3" height="10" rx="1" fill="currentColor"/>'
    : '<path d="M5 3l9 5-9 5V3z" fill="currentColor"/>';
}

function togglePomoFloat() {
  document.getElementById('pomoFloat').classList.toggle('collapsed');
  savePomoState();
}

function savePomoState() {
  const el = document.getElementById('pomoFloat');
  if (!el) return;
  const rect = el.getBoundingClientRect();
  localStorage.setItem(POMO_POS_KEY, JSON.stringify({
    top: rect.top, left: rect.left,
    collapsed: el.classList.contains('collapsed'),
  }));
}

function loadPomoState() {
  const data = localStorage.getItem(POMO_POS_KEY);
  if (!data) return;
  try {
    const state = JSON.parse(data);
    const el = document.getElementById('pomoFloat');
    if (!el) return;
    el.style.top    = state.top  + 'px';
    el.style.left   = state.left + 'px';
    el.style.bottom = 'auto';
    el.style.right  = 'auto';
    el.classList.toggle('collapsed', !!state.collapsed);
  } catch (e) {}
}

// ── Drag ──
(function initPomoFloat() {
  const el     = document.getElementById('pomoFloat');
  const header = el.querySelector('.pomo-float-header');
  let dragging = false, startX = 0, startY = 0, origLeft = 0, origTop = 0, moved = false;

  function ensureTopLeft() {
    const r = el.getBoundingClientRect();
    el.style.top  = r.top  + 'px'; el.style.left = r.left + 'px';
    el.style.bottom = 'auto'; el.style.right = 'auto';
  }

  function onDown(e) {
    if (e.target.closest('button')) return;
    e.preventDefault(); ensureTopLeft();
    const { x, y } = getXY(e);
    dragging = true; moved = false;
    startX = x; startY = y;
    origLeft = parseInt(el.style.left) || 0;
    origTop  = parseInt(el.style.top)  || 0;
    el.classList.add('dragging');
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup',   onUp);
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend',  onUp);
  }

  function onMove(e) {
    if (!dragging) return; e.preventDefault();
    const { x, y } = getXY(e);
    const dx = x - startX, dy = y - startY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) moved = true;
    el.style.left = Math.max(0, Math.min(window.innerWidth  - el.offsetWidth,  origLeft + dx)) + 'px';
    el.style.top  = Math.max(0, Math.min(window.innerHeight - el.offsetHeight, origTop  + dy)) + 'px';
  }

  function onUp() {
    if (!dragging) return;
    dragging = false; el.classList.remove('dragging');
    if (!moved) { togglePomoFloat(); } else { savePomoState(); }
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup',   onUp);
    document.removeEventListener('touchmove', onMove);
    document.removeEventListener('touchend',  onUp);
  }

  header.addEventListener('mousedown',  onDown);
  header.addEventListener('touchstart', onDown, { passive: false });
})();