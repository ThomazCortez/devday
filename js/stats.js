// ── Stats & Streak ──

// All streak + history reads/writes now go through Firebase caches defined in db.js:
//   _streakCache   — live-synced from _userRef/streakData
//   _historyCache  — live-synced from _userRef/completedHistory

function getStreakData() {
  return _streakCache;
}

function saveStreakData(data) {
  _streakCache = data;
  dbSaveStreakData(data);
}

function updateStreak() {
  const data = { ...getStreakData() };
  const today = todayStr();
  if (data.lastCompletedDate === today) return;

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yStr = yesterday.toISOString().slice(0, 10);

  data.currentStreak     = data.lastCompletedDate === yStr ? data.currentStreak + 1 : 1;
  data.longestStreak     = Math.max(data.longestStreak, data.currentStreak);
  data.lastCompletedDate = today;

  if (!data.completedDates.includes(today)) {
    data.completedDates = [...data.completedDates, today].slice(-365);
  }

  saveStreakData(data);
}

function checkStreakIntegrity() {
  const data = { ...getStreakData() };
  if (!data.lastCompletedDate) return;

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yStr = yesterday.toISOString().slice(0, 10);

  if (data.lastCompletedDate !== todayStr() && data.lastCompletedDate !== yStr) {
    data.currentStreak = 0;
    saveStreakData(data);
  }
}

// ── Archive a deleted completed task into history ─────────────────────────────
// Called from tasks.js deleteTask() instead of writing to localStorage.

function archiveCompletedTask(task) {
  const updated = [..._historyCache, { completedAt: task.completedAt, tag: task.tag }].slice(-1000);
  _historyCache = updated;
  dbSaveHistory(updated);
}

function unarchiveCompletedTask(completedAt) {
  const updated = _historyCache.filter(h => h.completedAt !== completedAt);
  _historyCache = updated;
  dbSaveHistory(updated);
}

// ── Stats computation ─────────────────────────────────────────────────────────

function computeStats() {
  const all     = typeof tasks !== 'undefined' ? tasks : [];
  const today   = todayStr();
  const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);

  // Current done tasks (still in the task list)
  const currentDone = all.filter(t => t.done);

  // All-time done = current done + archived history (deleted tasks)
  // De-dupe by completedAt to prevent double-counting if a task is in both
  const allDoneMap = new Map();
  currentDone.forEach(t => { if (t.completedAt) allDoneMap.set(t.completedAt, t); });
  _historyCache.forEach(h => { if (h.completedAt && !allDoneMap.has(h.completedAt)) allDoneMap.set(h.completedAt, h); });
  const allDone = [...allDoneMap.values()];

  // Completion rate — based only on current tasks (can never exceed 100%)
  const rate = all.length ? Math.round((currentDone.length / all.length) * 100) : 0;

  const todayDone = allDone.filter(t => t.completedAt?.slice(0, 10) === today);
  const weekDone  = allDone.filter(t => t.completedAt && new Date(t.completedAt) >= weekAgo);

  // Tag breakdown
  const tagCount = {};
  all.forEach(t => { if (t.tag) tagCount[t.tag] = (tagCount[t.tag] || 0) + 1; });
  const tagDone = {};
  allDone.forEach(t => { if (t.tag) tagDone[t.tag] = (tagDone[t.tag] || 0) + 1; });
  const topTag = Object.entries(tagCount).sort((a, b) => b[1] - a[1])[0];

  // Day of week breakdown (last 90 days)
  const dayCount  = { Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0, Sat: 0, Sun: 0 };
  const ninetyAgo = new Date(); ninetyAgo.setDate(ninetyAgo.getDate() - 90);
  allDone.forEach(t => {
    if (t.completedAt && new Date(t.completedAt) >= ninetyAgo) {
      const keys = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
      const d = keys[new Date(t.completedAt).getDay()];
      dayCount[d] = (dayCount[d] || 0) + 1;
    }
  });
  const topDay = Object.entries(dayCount).sort((a, b) => b[1] - a[1])[0];

  // Last 7 days daily counts
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i));
    const str   = d.toISOString().slice(0, 10);
    const label = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getDay()];
    const count = allDone.filter(t => t.completedAt?.slice(0, 10) === str).length;
    return { label, count, str };
  });

  // Last 28 days for heatmap
  const last28 = Array.from({ length: 28 }, (_, i) => {
    const d     = new Date(); d.setDate(d.getDate() - (27 - i));
    const str   = d.toISOString().slice(0, 10);
    const count = allDone.filter(t => t.completedAt?.slice(0, 10) === str).length;
    return { date: str, count };
  });

  const streak = getStreakData();
  return {
    total: allDone.length,
    today: todayDone.length,
    week:  weekDone.length,
    rate,
    topTag:        topTag?.[0]  ?? null,
    topDay:        topDay?.[0]  ?? null,
    currentStreak: streak.currentStreak,
    longestStreak: streak.longestStreak,
    completedDates: streak.completedDates,
    last28, last7, dayCount, tagCount, tagDone,
  };
}

// ── Line Chart ────────────────────────────────────────────────────────────────

function buildLinePath(pts) {
  if (pts.length < 2) return '';
  let d = `M${pts[0].x.toFixed(2)},${pts[0].y.toFixed(2)}`;
  for (let i = 1; i < pts.length; i++) {
    const prev = pts[i - 1];
    const curr = pts[i];
    const cpx  = (prev.x + curr.x) / 2;
    d += ` C${cpx.toFixed(2)},${prev.y.toFixed(2)} ${cpx.toFixed(2)},${curr.y.toFixed(2)} ${curr.x.toFixed(2)},${curr.y.toFixed(2)}`;
  }
  return d;
}

function renderLineChart(data, opts = {}) {
  const {
    color     = 'var(--claude)',
    uid       = 'lc_' + Math.random().toString(36).slice(2, 7),
    showToday = false
  } = opts;

  const W = 540, H = 100;
  const PAD_L = 8, PAD_R = 8, PAD_T = 22, PAD_B = 2;
  const chartW = W - PAD_L - PAD_R;
  const chartH = H - PAD_T - PAD_B;
  const max    = Math.max(...data.map(d => d.count), 1);

  const pts = data.map((d, i) => ({
    x: PAD_L + (i / (data.length - 1)) * chartW,
    y: PAD_T + (1 - d.count / max) * chartH,
    ...d,
    idx: i
  }));

  const linePath = buildLinePath(pts);
  const areaPath = linePath
    + ` L${pts[pts.length - 1].x.toFixed(2)},${H.toFixed(2)}`
    + ` L${pts[0].x.toFixed(2)},${H.toFixed(2)} Z`;

  const gradId = `grad_${uid}`;
  const clipId = `clip_${uid}`;

  const dots = pts.map(p => {
    const isToday = showToday && p.idx === pts.length - 1;
    return `
      <circle
        class="lc-dot${isToday ? ' lc-dot-today' : ''}"
        cx="${p.x.toFixed(2)}" cy="${p.y.toFixed(2)}"
        r="${isToday ? 5 : 3.5}"
        fill="${isToday ? color : 'var(--bg)'}"
        stroke="${color}"
        stroke-width="${isToday ? 0 : 2}"
        style="opacity:0;transition:opacity 0.25s ease"
        data-uid="${uid}"
      />
      ${p.count > 0 ? `<text
        class="lc-label"
        x="${p.x.toFixed(2)}"
        y="${(p.y - 10).toFixed(2)}"
        text-anchor="middle"
        style="opacity:0;transition:opacity 0.25s ease"
        data-uid="${uid}"
      >${p.count}</text>` : ''}`;
  }).join('');

  const axisLabels = pts.map((p, i) => {
    const isToday = showToday && i === pts.length - 1;
    return `<text
      class="lc-axis${isToday ? ' lc-axis-today' : ''}"
      x="${p.x.toFixed(2)}"
      y="${(H + 16).toFixed(2)}"
      text-anchor="middle"
    >${p.label}</text>`;
  }).join('');

  const gridLines = [0.25, 0.5, 0.75, 1].map(f => {
    const y = (PAD_T + (1 - f) * chartH).toFixed(2);
    return `<line class="lc-grid" x1="${PAD_L}" y1="${y}" x2="${W - PAD_R}" y2="${y}" />`;
  }).join('');

  return `
    <div class="lc-wrap" data-uid="${uid}">
      <svg viewBox="0 0 ${W} ${H + 20}" class="lc-svg" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="${gradId}" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stop-color="${color}" stop-opacity="0.18"/>
            <stop offset="100%" stop-color="${color}" stop-opacity="0.01"/>
          </linearGradient>
          <clipPath id="${clipId}">
            <rect x="${PAD_L}" y="0" width="${chartW}" height="${H}" />
          </clipPath>
        </defs>
        ${gridLines}
        <path class="lc-area" d="${areaPath}" fill="url(#${gradId})" clip-path="url(#${clipId})" style="opacity:0;transition:opacity 0.6s ease 0.4s" data-uid="${uid}" />
        <path class="lc-line" d="${linePath}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" clip-path="url(#${clipId})" data-uid="${uid}" />
        ${dots}
        ${axisLabels}
      </svg>
    </div>`;
}

function animateLineChart(container, uid) {
  const line = container.querySelector(`.lc-line[data-uid="${uid}"]`);
  if (!line) return;

  const len = line.getTotalLength();
  line.style.strokeDasharray  = len;
  line.style.strokeDashoffset = len;
  line.style.transition = 'none';

  requestAnimationFrame(() => requestAnimationFrame(() => {
    line.style.transition       = 'stroke-dashoffset 1s cubic-bezier(0.4,0,0.2,1)';
    line.style.strokeDashoffset = '0';
  }));

  const area = container.querySelector(`.lc-area[data-uid="${uid}"]`);
  if (area) requestAnimationFrame(() => requestAnimationFrame(() => { area.style.opacity = '1'; }));

  const dots   = [...container.querySelectorAll(`.lc-dot[data-uid="${uid}"]`)];
  const labels = [...container.querySelectorAll(`.lc-label[data-uid="${uid}"]`)];
  [...dots, ...labels].forEach((el, i) => {
    setTimeout(() => { el.style.opacity = '1'; }, 1000 + i * 55);
  });
}

// ── Tag bars ──────────────────────────────────────────────────────────────────

function renderTagBars(tagCount, tagDone) {
  const entries = Object.entries(tagCount).sort((a, b) => b[1] - a[1]);
  if (!entries.length) return `<div class="no-data">// no tagged tasks yet</div>`;
  const max = entries[0][1];
  const tagColors = { work: 'var(--blue)', personal: 'var(--purple)', health: 'var(--green)' };
  return entries.map(([tag, total]) => {
    const pct   = Math.round((total / max) * 100);
    const color = tagColors[tag] || 'var(--claude)';
    const done  = tagDone[tag] || 0;
    return `
      <div class="tag-bar-row">
        <div class="tag-bar-label" style="color:${color}">#${tag}</div>
        <div class="tag-bar-track">
          <div class="tag-bar-fill" style="width:0%;background:${color}" data-pct="${pct}"></div>
        </div>
        <div class="tag-bar-count">${done}/${total}</div>
      </div>`;
  }).join('');
}

// ── Main render ───────────────────────────────────────────────────────────────

function renderStats() {
  const s  = computeStats();
  const el = document.getElementById('statsView');
  if (!el) return;

  const heatMax = Math.max(...s.last28.map(d => d.count), 1);
  const heatmap = s.last28.map(({ date, count }) => {
    const isToday   = date === todayStr();
    const intensity = count === 0 ? 0 : count === 1 ? 1 : count <= 3 ? 2 : count <= Math.ceil(heatMax * 0.6) ? 3 : 4;
    return `<div class="heat-cell lvl-${intensity} ${isToday ? 'is-today' : ''}" title="${date}: ${count} task${count !== 1 ? 's' : ''}"></div>`;
  }).join('');

  const streakFire = s.currentStreak >= 7 ? '🔥' : s.currentStreak >= 3 ? '⚡' : s.currentStreak > 0 ? '✦' : '○';
  const streakMsg  = s.currentStreak === 0 ? '// start your streak today'
    : s.currentStreak === 1 ? '// great start — keep going'
    : s.currentStreak >= 7  ? `// on fire — ${s.currentStreak} days`
    : `// ${s.currentStreak} days and counting`;

  const dayData = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d => ({
    label: d,
    count: s.dayCount[d] || 0
  }));

  const last7Chart = renderLineChart(s.last7,  { color: 'var(--claude)', uid: 'last7',  showToday: true });
  const dayChart   = renderLineChart(dayData,   { color: 'var(--blue)',   uid: 'byday'  });

  el.innerHTML = `
    <div class="stats-page">
      <div class="stats-header">
        <div class="stats-page-title"># stats<span class="stats-comment"> // your progress</span></div>
      </div>

      <div class="stats-row">
        <div class="streak-block">
          <div class="streak-top">
            <span class="streak-fire-icon">${streakFire}</span>
            <span class="streak-kw">current_streak</span>
          </div>
          <div class="streak-num">${s.currentStreak}<span class="streak-unit">d</span></div>
          <div class="streak-msg">${streakMsg}</div>
          <div class="streak-divider"></div>
          <div class="streak-best">
            <span class="streak-best-key">longest</span>
            <span class="streak-best-val">${s.longestStreak}d</span>
          </div>
        </div>
        <div class="heatmap-block">
          <div class="stats-block-title">// 28-day activity</div>
          <div class="heat-grid">${heatmap}</div>
          <div class="heat-legend">
            <span>less</span>
            <div class="heat-cell lvl-0"></div>
            <div class="heat-cell lvl-1"></div>
            <div class="heat-cell lvl-2"></div>
            <div class="heat-cell lvl-3"></div>
            <div class="heat-cell lvl-4"></div>
            <span>more</span>
          </div>
        </div>
      </div>

      <div class="stat-cards">
        <div class="stat-card">
          <div class="stat-card-icon">◎</div>
          <div class="stat-card-val" data-target="${s.today}">0</div>
          <div class="stat-card-key">today</div>
        </div>
        <div class="stat-card">
          <div class="stat-card-icon">◑</div>
          <div class="stat-card-val" data-target="${s.week}">0</div>
          <div class="stat-card-key">this week</div>
        </div>
        <div class="stat-card">
          <div class="stat-card-icon">◉</div>
          <div class="stat-card-val" data-target="${s.total}">0</div>
          <div class="stat-card-key">all time</div>
        </div>
        <div class="stat-card accent">
          <div class="stat-card-icon" style="color:var(--claude)">◈</div>
          <div class="stat-card-val" data-target="${s.rate}" data-suffix="%">0</div>
          <div class="stat-card-key">completion</div>
        </div>
      </div>

      <div class="stats-block">
        <div class="stats-block-title">// tasks completed — last 7 days</div>
        ${last7Chart}
      </div>

      <div class="stats-row bottom-row">
        <div class="stats-block half">
          <div class="stats-block-title">// by day of week</div>
          ${dayChart}
        </div>
        <div class="stats-block half">
          <div class="stats-block-title">// by tag</div>
          <div class="tag-bars">${renderTagBars(s.tagCount, s.tagDone)}</div>
        </div>
      </div>
    </div>`;

  // Counter animation
  el.querySelectorAll('.stat-card-val[data-target]').forEach(valEl => {
    const target = +valEl.dataset.target;
    const suffix = valEl.dataset.suffix || '';
    if (target === 0) { valEl.textContent = '0' + suffix; return; }
    let start = null;
    const dur  = 600;
    const step = ts => {
      if (!start) start = ts;
      const p = Math.min((ts - start) / dur, 1);
      valEl.textContent = Math.round(p * target) + suffix;
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });

  setTimeout(() => { animateLineChart(el, 'last7'); animateLineChart(el, 'byday'); }, 60);

  setTimeout(() => {
    el.querySelectorAll('.tag-bar-fill').forEach(b => {
      b.style.transition = 'width 0.6s cubic-bezier(0.4,0,0.2,1)';
      b.style.width = b.dataset.pct + '%';
    });
  }, 200);
}

// ── CSS injection ─────────────────────────────────────────────────────────────

(function injectLineChartStyles() {
  if (document.getElementById('lc-styles')) return;
  const style = document.createElement('style');
  style.id = 'lc-styles';
  style.textContent = `
    .lc-wrap { width:100%; padding:4px 0 0; }
    .lc-svg  { width:100%; height:auto; display:block; overflow:visible; }
    .lc-grid { stroke:var(--border,rgba(255,255,255,0.06)); stroke-width:1; stroke-dasharray:3 4; }
    .lc-axis { fill:var(--comment,#555); font-size:11px; font-family:var(--font-mono,monospace); }
    .lc-axis-today { fill:var(--claude,#e5a84b); font-weight:600; }
    .lc-label { fill:var(--fg,#ccc); font-size:10px; font-family:var(--font-mono,monospace); }
    .heat-cell.lvl-0 { background:var(--surface2,rgba(255,255,255,0.04)); }
    .heat-cell.lvl-1 { background:var(--claude,#e5a84b); opacity:0.25; }
    .heat-cell.lvl-2 { background:var(--claude,#e5a84b); opacity:0.50; }
    .heat-cell.lvl-3 { background:var(--claude,#e5a84b); opacity:0.75; }
    .heat-cell.lvl-4 { background:var(--claude,#e5a84b); opacity:1.00; }
    .streak-block { display:flex; flex-direction:column; justify-content:space-between; }
  `;
  document.head.appendChild(style);
})();

// ── Streak Alert ──────────────────────────────────────────────────────────────

(function injectStreakAlertStyles() {
  if (document.getElementById('streak-alert-styles')) return;
  const style = document.createElement('style');
  style.id = 'streak-alert-styles';
  style.textContent = `
    #streak-alert {
      position:fixed; bottom:32px; right:32px; z-index:9999; width:300px;
      background:var(--surface,#161b22); border:1px solid var(--claude,#e5a84b);
      border-radius:6px; padding:18px 20px 16px;
      box-shadow:0 0 0 1px rgba(229,168,75,0.08),0 8px 32px rgba(0,0,0,0.5);
      font-family:var(--font-mono,monospace);
      transform:translateY(20px); opacity:0;
      transition:transform 0.4s cubic-bezier(0.16,1,0.3,1),opacity 0.4s ease;
      pointer-events:none;
    }
    #streak-alert.sa-visible { transform:translateY(0); opacity:1; pointer-events:auto; }
    #streak-alert.sa-hide    { transform:translateY(12px); opacity:0; }
    .sa-eyebrow {
      font-size:10px; color:var(--claude,#e5a84b); letter-spacing:0.08em;
      text-transform:uppercase; margin-bottom:10px;
      display:flex; align-items:center; gap:6px;
    }
    .sa-eyebrow::before {
      content:''; display:inline-block; width:6px; height:6px;
      border-radius:50%; background:var(--claude,#e5a84b);
      animation:sa-pulse 1.6s ease-in-out infinite;
    }
    @keyframes sa-pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.4;transform:scale(0.7)} }
    .sa-streak-row { display:flex; align-items:baseline; gap:8px; margin-bottom:8px; }
    .sa-num  { font-size:52px; font-weight:700; line-height:1; color:var(--claude,#e5a84b); letter-spacing:-2px; }
    .sa-unit { font-size:18px; color:var(--comment,#666); }
    .sa-msg  {
      font-size:11px; color:var(--comment,#666); line-height:1.5;
      border-top:1px solid var(--border,rgba(255,255,255,0.07));
      padding-top:10px; margin-top:4px;
    }
    .sa-msg span { color:var(--fg,#ccc); }
    .sa-close {
      position:absolute; top:10px; right:12px;
      background:none; border:none; color:var(--comment,#555);
      font-size:14px; cursor:pointer; line-height:1; padding:2px 4px;
      transition:color 0.15s;
    }
    .sa-close:hover { color:var(--fg,#ccc); }
    .sa-progress {
      position:absolute; bottom:0; left:0; height:2px;
      background:var(--claude,#e5a84b); border-radius:0 0 0 6px;
      width:100%; transform-origin:left;
      animation:sa-drain 4s linear forwards;
    }
    @keyframes sa-drain { from{transform:scaleX(1)} to{transform:scaleX(0)} }
  `;
  document.head.appendChild(style);
})();

const STREAK_MESSAGES = [
  ['streak started',  'first task done. <span>keep showing up.</span>'],
  ['day 2',           'two in a row. <span>momentum is building.</span>'],
  ['3-day streak',    'three days straight. <span>you\'re making it a habit.</span>'],
  ['keep it going',   'consistency beats intensity. <span>see you tomorrow.</span>'],
  ['on a roll',       'every day counts. <span>don\'t break the chain.</span>'],
  ['fire streak 🔥',  'you\'re in the zone. <span>keep the engine running.</span>'],
  ['legendary',       'this is what discipline looks like. <span>respect.</span>'],
];

function getStreakAlertMsg(streak) {
  if (streak <= 1) return STREAK_MESSAGES[0];
  if (streak === 2) return STREAK_MESSAGES[1];
  if (streak === 3) return STREAK_MESSAGES[2];
  if (streak <= 5)  return STREAK_MESSAGES[3];
  if (streak <= 9)  return STREAK_MESSAGES[4];
  if (streak <= 20) return STREAK_MESSAGES[5];
  return STREAK_MESSAGES[6];
}

let _streakAlertTimer = null;

function showStreakAlert() {
  const today = todayStr();
  const data  = getStreakData();

  // lastAlertDate is stored in Firebase streakData so it syncs across devices
  if (data.lastAlertDate === today) return;

  updateStreak();
  const updatedData = getStreakData();
  saveStreakData({ ...updatedData, lastAlertDate: today });

  const { currentStreak } = updatedData;
  const [eyebrow, msg]    = getStreakAlertMsg(currentStreak);

  document.getElementById('streak-alert')?.remove();
  clearTimeout(_streakAlertTimer);

  const el = document.createElement('div');
  el.id = 'streak-alert';
  el.innerHTML = `
    <button class="sa-close" onclick="dismissStreakAlert()">✕</button>
    <div class="sa-eyebrow">streak alert</div>
    <div class="sa-streak-row">
      <div class="sa-num" id="sa-num">0</div>
      <div class="sa-unit">day${currentStreak !== 1 ? 's' : ''}</div>
    </div>
    <div class="sa-msg">// ${eyebrow} — ${msg}</div>
    <div class="sa-progress"></div>
  `;
  document.body.appendChild(el);

  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('sa-visible')));

  const numEl = document.getElementById('sa-num');
  let start = null;
  const dur = 700;
  (function tick(ts) {
    if (!start) start = ts;
    const p    = Math.min((ts - start) / dur, 1);
    const ease = 1 - Math.pow(1 - p, 3);
    numEl.textContent = Math.round(ease * currentStreak);
    if (p < 1) requestAnimationFrame(tick);
  })(performance.now());

  _streakAlertTimer = setTimeout(() => dismissStreakAlert(), 4500);
}

function dismissStreakAlert() {
  const el = document.getElementById('streak-alert');
  if (!el) return;
  clearTimeout(_streakAlertTimer);
  el.classList.add('sa-hide');
  setTimeout(() => el.remove(), 400);
}

// ── Show / Hide ───────────────────────────────────────────────────────────────

function showStats() {
  hideScheduleIfVisible();
  const mainEls   = ['listView','kanbanView','inputArea'].map(id => document.getElementById(id));
  const statsView = document.getElementById('statsView');

  mainEls.forEach(el => { if (el) el.classList.add('fading'); });
  setTimeout(() => {
    mainEls.forEach(el => { if (el) { el.style.display = 'none'; el.classList.remove('fading'); } });
    statsView.style.display = 'block';
    renderStats();
    requestAnimationFrame(() => requestAnimationFrame(() => statsView.classList.add('stats-visible')));
  }, 180);

  document.querySelectorAll('.sidebar-item').forEach(b => b.classList.remove('active'));
  document.getElementById('sidebarStatsBtn')?.classList.add('active');
}

function hideStatsIfVisible() {
  const statsView = document.getElementById('statsView');
  if (!statsView || statsView.style.display === 'none') return;
  statsView.classList.remove('stats-visible');
  setTimeout(() => { statsView.style.display = 'none'; }, 180);

  ['listView','inputArea'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = '';
  });
  const kv = document.getElementById('kanbanView');
  if (kv) kv.style.display = currentView === 'kanban' ? 'flex' : 'none';
}