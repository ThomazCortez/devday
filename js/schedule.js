// ── Schedule (Weekly Calendar) ──

const SCHEDULE_KEY  = 'devday_schedule_v2';
const HOUR_H        = 56; // px per hour
const SCHED_COLORS  = ['#DA7756','#58A6FF','#3FB950','#BC8CFF','#FF7B72','#E3B341','#7D8590'];

let _schedWeekOffset  = 0;
let _schedPopupState  = null;
let _schedNowTimer    = null;

// ── Storage ───────────────────────────────────────────────────────────────────

function getScheduleData() {
  try { return JSON.parse(localStorage.getItem(SCHEDULE_KEY)) || {}; }
  catch { return {}; }
}
function saveScheduleData(data) {
  localStorage.setItem(SCHEDULE_KEY, JSON.stringify(data));
}

// ── Week helpers ──────────────────────────────────────────────────────────────

function schedWeekMonday(offset) {
  const d   = new Date();
  const dow = d.getDay();
  d.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1) + (offset || 0) * 7);
  d.setHours(0, 0, 0, 0);
  return d;
}

function schedWeekDays(offset) {
  const mon = schedWeekMonday(offset);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(mon);
    d.setDate(mon.getDate() + i);
    return d;
  });
}

function schedDayKey(date) { return date.toISOString().slice(0, 10); }
function schedTodayKey()   { return new Date().toISOString().slice(0, 10); }

function schedFmtDate(date) {
  return date.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' });
}

function schedDayName(date) {
  return ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'][date.getDay()];
}

// ── Show / Hide ───────────────────────────────────────────────────────────────

function showSchedule() {
  const ids     = ['listView','kanbanView','inputArea','statsView'];
  const mainEls = ids.map(id => document.getElementById(id));
  const sv      = document.getElementById('scheduleView');

  mainEls.forEach(el => { if (el) el.classList.add('fading'); });

  setTimeout(() => {
    mainEls.forEach(el => {
      if (!el) return;
      el.style.display = 'none';
      el.classList.remove('fading');
      el.classList.remove('stats-visible');
    });
    sv.style.display = 'block';
    _schedWeekOffset = 0;
    closeSchedPopup();
    renderSchedule();
    requestAnimationFrame(() => requestAnimationFrame(() => {
      sv.classList.add('schedule-visible');
      setTimeout(schedScrollToNow, 120);
    }));

    clearInterval(_schedNowTimer);
    _schedNowTimer = setInterval(renderScheduleBlocks, 60000);
  }, 180);

  document.querySelectorAll('.sidebar-item').forEach(b => b.classList.remove('active'));
  document.getElementById('sidebarScheduleBtn')?.classList.add('active');
}

function hideScheduleIfVisible() {
  const sv = document.getElementById('scheduleView');
  if (!sv || sv.style.display === 'none') return;
  sv.classList.remove('schedule-visible');
  closeSchedPopup();
  clearInterval(_schedNowTimer);
  setTimeout(() => { sv.style.display = 'none'; }, 180);
}

function schedScrollToNow() {
  const body = document.getElementById('shGridBody');
  if (!body) return;
  body.scrollTop = Math.max(0, (new Date().getHours() - 1) * HOUR_H);
}

// ── Slot click (create) ───────────────────────────────────────────────────────

function onSchedSlotClick(dKey, hour) {
  closeSchedPopup();
  _schedPopupState = {
    mode: 'create', dayKey: dKey,
    startH: hour, endH: Math.min(hour + 1, 23),
    color: SCHED_COLORS[0], blockId: null,
  };
  renderSchedPopup();
}

// ── Block click (edit) ────────────────────────────────────────────────────────

function onSchedBlockClick(e, dKey, blockId) {
  e.stopPropagation();
  closeSchedPopup();
  const b = (getScheduleData()[dKey] || []).find(b => b.id === blockId);
  if (!b) return;
  _schedPopupState = {
    mode: 'edit', dayKey: dKey,
    startH: b.startH, endH: b.endH,
    color: b.color || SCHED_COLORS[0], blockId,
  };
  renderSchedPopup();
}

// ── Popup ─────────────────────────────────────────────────────────────────────

function renderSchedPopup() {
  document.getElementById('shPopupBackdrop')?.remove();
  if (!_schedPopupState) return;

  const { mode, startH, endH, color, blockId, dayKey } = _schedPopupState;
  const isEdit = mode === 'edit';
  const block  = isEdit ? (getScheduleData()[dayKey] || []).find(b => b.id === blockId) : null;

  const hourOpts = sel => Array.from({ length: 24 }, (_, h) =>
    `<option value="${h}"${h === sel ? ' selected' : ''}>${String(h).padStart(2,'0')}:00</option>`
  ).join('');

  const swatches = SCHED_COLORS.map(c =>
    `<div class="sh-swatch${color === c ? ' active' : ''}" data-color="${c}"
      style="background:${c}" onclick="setSchedPopupColor('${c}')"></div>`
  ).join('');

  const bd = document.createElement('div');
  bd.id = 'shPopupBackdrop';
  bd.className = 'sh-popup-backdrop';
  bd.onclick = e => { if (e.target === bd) closeSchedPopup(); };

  bd.innerHTML = `
    <div class="sh-popup" id="shPopup">
      <div class="sh-popup-header">
        <span class="sh-popup-title">${isEdit ? '// edit block' : '// new block'}</span>
        <button class="sh-popup-close" onclick="closeSchedPopup()">✕</button>
      </div>
      <input
        class="task-input sh-popup-label"
        id="shPopupLabel"
        placeholder="block label..."
        maxlength="60"
        value="${isEdit ? escHtml(block?.label || '') : ''}"
        onkeydown="if(event.key==='Enter')saveSchedPopup();else if(event.key==='Escape')closeSchedPopup()"
      />
      <div class="sh-popup-times">
        <select class="sched-time-select" id="shPopupStart">${hourOpts(startH)}</select>
        <span class="sched-time-sep">→</span>
        <select class="sched-time-select" id="shPopupEnd">${hourOpts(endH)}</select>
      </div>
      <div class="sh-swatches sh-popup-swatches">${swatches}</div>
      <div class="sh-popup-actions">
        <button class="add-btn" onclick="saveSchedPopup()">${isEdit ? '✓ save' : '+ add'}</button>
        <button class="due-btn" onclick="closeSchedPopup()">cancel</button>
        ${isEdit ? `<button class="due-btn sh-del-btn" onclick="deleteSchedBlock()">✕ delete</button>` : ''}
      </div>
    </div>`;

  document.body.appendChild(bd);
  requestAnimationFrame(() => requestAnimationFrame(() => {
    bd.classList.add('open');
    document.getElementById('shPopupLabel')?.focus();
  }));
}

function setSchedPopupColor(c) {
  if (!_schedPopupState) return;
  _schedPopupState.color = c;
  document.querySelectorAll('#shPopup .sh-swatch').forEach(s =>
    s.classList.toggle('active', s.dataset.color === c)
  );
}

function saveSchedPopup() {
  if (!_schedPopupState) return;
  const label  = document.getElementById('shPopupLabel')?.value.trim();
  const startH = parseInt(document.getElementById('shPopupStart')?.value);
  const endH   = parseInt(document.getElementById('shPopupEnd')?.value);

  if (!label) { document.getElementById('shPopupLabel')?.focus(); return; }
  if (endH <= startH) {
    const sel = document.getElementById('shPopupEnd');
    if (sel) { sel.style.borderColor = 'var(--red,#FF7B72)'; setTimeout(() => sel.style.borderColor = '', 700); }
    return;
  }

  const data = getScheduleData();
  const dKey = _schedPopupState.dayKey;
  if (!data[dKey]) data[dKey] = [];

  if (_schedPopupState.mode === 'edit') {
    const idx = data[dKey].findIndex(b => b.id === _schedPopupState.blockId);
    if (idx !== -1) data[dKey][idx] = { ...data[dKey][idx], label, startH, endH, color: _schedPopupState.color };
  } else {
    data[dKey].push({ id: Date.now(), label, startH, endH, color: _schedPopupState.color });
  }

  saveScheduleData(data);
  closeSchedPopup();
  renderScheduleBlocks();
}

function deleteSchedBlock() {
  if (!_schedPopupState?.blockId) return;
  const data = getScheduleData();
  const dKey = _schedPopupState.dayKey;
  data[dKey] = (data[dKey] || []).filter(b => b.id !== _schedPopupState.blockId);
  if (!data[dKey].length) delete data[dKey];
  saveScheduleData(data);
  closeSchedPopup();
  renderScheduleBlocks();
}

function closeSchedPopup() {
  _schedPopupState = null;
  const bd = document.getElementById('shPopupBackdrop');
  if (!bd) return;
  bd.classList.remove('open');
  setTimeout(() => bd.remove(), 160);
}

// ── Render full calendar ──────────────────────────────────────────────────────

function renderSchedule() {
  const el = document.getElementById('scheduleView');
  if (!el) return;

  const days      = schedWeekDays(_schedWeekOffset);
  const weekLabel = `${schedFmtDate(days[0])} – ${schedFmtDate(days[6])}`;

  el.innerHTML = `
    <div class="sched-page">
      <div class="sched-header">
        <div class="stats-page-title"># schedule<span class="stats-comment"> // your week</span></div>
        <div class="sched-week-nav">
          <button class="due-btn sched-nav-btn" onclick="schedNavWeek(-1)">‹</button>
          <span class="sched-week-label">${weekLabel}</span>
          <button class="due-btn sched-nav-btn" onclick="schedNavWeek(1)">›</button>
          ${_schedWeekOffset !== 0
            ? `<button class="due-btn" style="font-size:10px;padding:3px 9px" onclick="schedGoToday()">today</button>`
            : ''}
        </div>
      </div>

      <div class="sh-calendar">
        <div class="sh-col-headers">
          <div class="sh-gutter-head"></div>
          ${days.map(d => {
            const isToday = schedDayKey(d) === schedTodayKey();
            return `<div class="sh-col-head${isToday ? ' sh-col-head-today' : ''}">
              <span class="sh-col-dayname">${schedDayName(d)}</span>
              <span class="sh-col-daynum${isToday ? ' sh-col-daynum-today' : ''}">${d.getDate()}</span>
            </div>`;
          }).join('')}
        </div>

        <div class="sh-grid-body" id="shGridBody">
          <div class="sh-grid-inner">
            <div class="sh-time-col">
              ${Array.from({ length: 24 }, (_, h) =>
                `<div class="sh-time-cell">${String(h).padStart(2,'0')}:00</div>`
              ).join('')}
            </div>
            <div class="sh-days-wrap" id="shDaysWrap">
              ${days.map(d => {
                const dk      = schedDayKey(d);
                const isToday = dk === schedTodayKey();
                return `<div class="sh-day-col${isToday ? ' sh-day-col-today' : ''}" data-day="${dk}">
                  ${Array.from({ length: 24 }, (_, h) =>
                    `<div class="sh-slot" onclick="onSchedSlotClick('${dk}',${h})"></div>`
                  ).join('')}
                </div>`;
              }).join('')}
            </div>
          </div>
        </div>
      </div>
    </div>`;

  renderScheduleBlocks();
}

// ── Render blocks only ────────────────────────────────────────────────────────

function renderScheduleBlocks() {
  const data = getScheduleData();
  const days = schedWeekDays(_schedWeekOffset);
  const now  = new Date();

  days.forEach(d => {
    const dk  = schedDayKey(d);
    const col = document.querySelector(`.sh-day-col[data-day="${dk}"]`);
    if (!col) return;

    col.querySelectorAll('.sh-block, .sh-now-line, .sh-now-dot').forEach(el => el.remove());

    // "now" line
    if (dk === schedTodayKey()) {
      const pct = (now.getHours() * 60 + now.getMinutes()) / (24 * 60);
      const top = pct * 24 * HOUR_H;
      const line = document.createElement('div');
      line.className = 'sh-now-line';
      line.style.top = top + 'px';
      const dot = document.createElement('div');
      dot.className = 'sh-now-dot';
      dot.style.top = (top - 4) + 'px';
      col.appendChild(line);
      col.appendChild(dot);
    }

    (data[dk] || []).forEach(b => {
      const block = document.createElement('div');
      block.className = 'sh-block';
      block.style.cssText = `
        top: ${b.startH * HOUR_H + 2}px;
        height: ${Math.max((b.endH - b.startH) * HOUR_H - 4, 22)}px;
        background: ${hexAlpha(b.color, 0.15)};
        border-left: 3px solid ${b.color};
        color: ${b.color};
      `;
      block.innerHTML = `
        <div class="sh-block-label">${escHtml(b.label)}</div>
        <div class="sh-block-time">${String(b.startH).padStart(2,'0')}:00 – ${String(b.endH).padStart(2,'0')}:00</div>`;
      block.onclick = e => onSchedBlockClick(e, dk, b.id);
      col.appendChild(block);
    });
  });
}

// ── Navigation ────────────────────────────────────────────────────────────────

function schedNavWeek(dir) {
  _schedWeekOffset += dir;
  closeSchedPopup();
  renderSchedule();
  if (_schedWeekOffset === 0) setTimeout(schedScrollToNow, 80);
}

function schedGoToday() {
  _schedWeekOffset = 0;
  closeSchedPopup();
  renderSchedule();
  setTimeout(schedScrollToNow, 80);
}