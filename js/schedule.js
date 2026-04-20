// ── Schedule (Weekly Calendar) ──

const HOUR_H       = 56; // px per hour
const SCHED_COLORS = ['#DA7756','#58A6FF','#3FB950','#BC8CFF','#FF7B72','#E3B341','#7D8590'];

let _schedWeekOffset = 0;
let _schedPopupState = null;
let _schedNowTimer   = null;
let _schedPopupGenId = 0;

// ── Schedule settings ─────────────────────────────────────────────────────────
// Read from the in-memory cache kept by db.js (_schedSettingsCache).
// Writes go through dbSaveSchedSettings() which persists to Firebase.

function getSchedSettings()  { return _schedSettingsCache;                          }
function getSchedStartHour() { return _schedSettingsCache.startHour    ?? 6;        }
function getSchedEndHour()   { return _schedSettingsCache.endHour      ?? 23;       }
function getSchedRepeat()    { return _schedSettingsCache.repeatWeekly ?? true;     }

function saveSchedSettings(patch) {
  _schedSettingsCache = { ..._schedSettingsCache, ...patch };
  dbSaveSchedSettings(_schedSettingsCache);
}

// ── Storage ───────────────────────────────────────────────────────────────────
// Reads from in-memory caches (_schedCache / _schedTemplateCache) populated by
// the Firebase listeners in db.js.  Writes call the Firebase save helpers.

function getScheduleData() {
  if (getSchedRepeat()) {
    // Map day-of-week template → this week's date keys
    const days   = schedWeekDays(_schedWeekOffset);
    const result = {};
    days.forEach((d, i) => {
      const blocks = _schedTemplateCache[String(i)];
      if (blocks && blocks.length) result[schedDayKey(d)] = blocks;
    });
    return result;
  }
  return { ..._schedCache };
}

function saveScheduleData(data) {
  if (getSchedRepeat()) {
    const template = { ..._schedTemplateCache };
    const days     = schedWeekDays(_schedWeekOffset);
    days.forEach((d, i) => {
      const dk  = schedDayKey(d);
      const key = String(i);
      if (data[dk] !== undefined) {
        if (data[dk].length) template[key] = data[dk];
        else                 delete template[key];
      }
    });
    // Update local cache immediately so the UI feels instant, then persist.
    _schedTemplateCache = template;
    dbSaveScheduleTemplate(template);
  } else {
    _schedCache = { ...data };
    dbSaveScheduleData(data);
  }
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

function schedDayKey(date) {
  const y  = date.getFullYear();
  const m  = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function schedTodayKey() { return schedDayKey(new Date()); }

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
      setTimeout(schedScrollToStart, 120);
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

function schedScrollToStart() {
  const body = document.getElementById('shGridBody');
  if (!body) return;
  const startHour = getSchedStartHour();
  const nowHour   = new Date().getHours();
  const endHour   = getSchedEndHour();
  body.scrollTop  = (nowHour >= startHour && nowHour <= endHour)
    ? Math.max(0, (nowHour - startHour - 1) * HOUR_H)
    : 0;
}

// ── Slot click (create) ───────────────────────────────────────────────────────

function onSchedSlotClick(e, dKey, hour) {
  e.stopPropagation();
  if (_schedPopupState) { closeSchedPopup(); return; }
  _schedPopupState = {
    mode: 'create', dayKey: dKey,
    startH: hour, endH: Math.min(hour + 1, getSchedEndHour()),
    color: SCHED_COLORS[0], blockId: null,
  };
  renderSchedPopup();
}

// ── Block click (edit) ────────────────────────────────────────────────────────

function onSchedBlockClick(e, dKey, blockId) {
  e.stopPropagation();
  const alreadyOpen = _schedPopupState?.blockId === blockId;
  closeSchedPopup();
  if (alreadyOpen) return;

  const b = (getScheduleData()[dKey] || []).find(b => b.id === blockId);
  if (!b) return;
  _schedPopupState = {
    mode: 'edit', dayKey: dKey,
    startH: b.startH, endH: b.endH,
    color: b.color || SCHED_COLORS[0], blockId,
  };
  renderSchedPopup();
}

// ── Block note tooltip ────────────────────────────────────────────────────────

function _showSchedTooltip(e) {
  const note = e.currentTarget.dataset.note;
  if (!note) return;
  let tip = document.getElementById('shTooltip');
  if (!tip) {
    tip = document.createElement('div');
    tip.id        = 'shTooltip';
    tip.className = 'sh-tooltip';
    document.body.appendChild(tip);
  }
  tip.textContent   = note;
  tip.style.display = 'block';
  _moveSchedTooltip(e, tip);
  e.currentTarget.addEventListener('mousemove', _onSchedTooltipMove);
}

function _onSchedTooltipMove(e) {
  const tip = document.getElementById('shTooltip');
  if (tip) _moveSchedTooltip(e, tip);
}

function _moveSchedTooltip(e, tip) {
  const x = e.clientX + 14;
  const y = e.clientY - 10;
  tip.style.left = Math.min(x, window.innerWidth - tip.offsetWidth - 10) + 'px';
  tip.style.top  = Math.max(8, y) + 'px';
}

function _hideSchedTooltip(e) {
  e.currentTarget.removeEventListener('mousemove', _onSchedTooltipMove);
  const tip = document.getElementById('shTooltip');
  if (tip) tip.style.display = 'none';
}

// ── Popup ─────────────────────────────────────────────────────────────────────

function renderSchedPopup() {
  _removeSchedPopupNow();
  if (!_schedPopupState) return;

  const genId  = ++_schedPopupGenId;
  const { mode, startH, endH, color, blockId, dayKey } = _schedPopupState;
  const isEdit = mode === 'edit';
  const block  = isEdit ? (getScheduleData()[dayKey] || []).find(b => b.id === blockId) : null;
  const s      = getSchedStartHour();
  const eH     = getSchedEndHour();

  const hourOpts = sel => Array.from({ length: eH - s + 1 }, (_, i) => {
    const h = s + i;
    return `<option value="${h}"${h === sel ? ' selected' : ''}>${String(h).padStart(2,'0')}:00</option>`;
  }).join('');

  const swatches = SCHED_COLORS.map(c =>
    `<div class="sh-swatch${color === c ? ' active' : ''}" data-color="${c}"
      style="background:${c}" onclick="setSchedPopupColor('${c}')"></div>`
  ).join('');

  const bd = document.createElement('div');
  bd.id        = 'shPopupBackdrop';
  bd.className = 'sh-popup-backdrop';
  bd.addEventListener('click', ev => ev.stopPropagation());

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
      <textarea
        class="task-input sh-popup-notes"
        id="shPopupNotes"
        placeholder="notes (optional)..."
        maxlength="200"
        rows="2"
        onkeydown="if(event.key==='Escape')closeSchedPopup()"
      >${isEdit ? escHtml(block?.notes || '') : ''}</textarea>
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

  setTimeout(() => {
    if (_schedPopupGenId !== genId) return;
    document.addEventListener('click', _onSchedOutside);
  }, 0);

  requestAnimationFrame(() => requestAnimationFrame(() => {
    bd.classList.add('open');
    document.getElementById('shPopupLabel')?.focus();
  }));
}

function _onSchedOutside(e) {
  const popup = document.getElementById('shPopup');
  if (popup && popup.contains(e.target)) return;
  document.removeEventListener('click', _onSchedOutside);
  closeSchedPopup();
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
  const notes  = document.getElementById('shPopupNotes')?.value.trim() || '';

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
    if (idx !== -1) data[dKey][idx] = { ...data[dKey][idx], label, startH, endH, color: _schedPopupState.color, notes };
  } else {
    data[dKey].push({ id: Date.now(), label, startH, endH, color: _schedPopupState.color, notes });
  }

  saveScheduleData(data);
  closeSchedPopup();
  renderScheduleBlocks();
}

function deleteSchedBlock() {
  if (!_schedPopupState?.blockId) return;
  const data = getScheduleData();
  const dKey = _schedPopupState.dayKey;

  // Keep as [] (not deleted) so saveScheduleData can see the key and clear the template entry.
  data[dKey] = (data[dKey] || []).filter(b => b.id !== _schedPopupState.blockId);

  saveScheduleData(data);
  closeSchedPopup();
  renderScheduleBlocks();
}

function closeSchedPopup() {
  document.removeEventListener('click', _onSchedOutside);
  _schedPopupState = null;
  const bd = document.getElementById('shPopupBackdrop');
  if (!bd) return;
  const captured = bd;
  captured.classList.remove('open');
  setTimeout(() => captured.remove(), 160);
}

function _removeSchedPopupNow() {
  document.removeEventListener('click', _onSchedOutside);
  document.getElementById('shPopupBackdrop')?.remove();
}

// ── Render full calendar ──────────────────────────────────────────────────────

function renderSchedule() {
  const el = document.getElementById('scheduleView');
  if (!el) return;

  const days      = schedWeekDays(_schedWeekOffset);
  const weekLabel = `${schedFmtDate(days[0])} – ${schedFmtDate(days[6])}`;
  const startHour = getSchedStartHour();
  const endHour   = getSchedEndHour();
  const numHours  = endHour - startHour + 1;
  const repeat    = getSchedRepeat();

  el.innerHTML = `
    <div class="sched-page">
      <div class="sched-header">
        <div class="stats-page-title"># schedule<span class="stats-comment"> // ${repeat ? 'repeating weekly' : 'your week'}</span></div>
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
          <div class="sh-grid-inner" style="min-height:${numHours * HOUR_H}px">
            <div class="sh-time-col">
              ${Array.from({ length: numHours }, (_, i) => {
                const h = startHour + i;
                return `<div class="sh-time-cell">${String(h).padStart(2,'0')}:00</div>`;
              }).join('')}
            </div>
            <div class="sh-days-wrap" id="shDaysWrap">
              ${days.map(d => {
                const dk      = schedDayKey(d);
                const isToday = dk === schedTodayKey();
                return `<div class="sh-day-col${isToday ? ' sh-day-col-today' : ''}" data-day="${dk}">
                  ${Array.from({ length: numHours }, (_, i) => {
                    const h = startHour + i;
                    return `<div class="sh-slot" onclick="onSchedSlotClick(event,'${dk}',${h})"></div>`;
                  }).join('')}
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
  const data      = getScheduleData();
  const days      = schedWeekDays(_schedWeekOffset);
  const now       = new Date();
  const startHour = getSchedStartHour();
  const endHour   = getSchedEndHour();

  days.forEach(d => {
    const dk  = schedDayKey(d);
    const col = document.querySelector(`.sh-day-col[data-day="${dk}"]`);
    if (!col) return;

    col.querySelectorAll('.sh-block, .sh-now-line, .sh-now-dot').forEach(el => el.remove());

    // "now" line
    if (dk === schedTodayKey()) {
      const nowH = now.getHours();
      if (nowH >= startHour && nowH <= endHour) {
        const topPx = (nowH - startHour + now.getMinutes() / 60) * HOUR_H;
        const line  = document.createElement('div');
        line.className = 'sh-now-line';
        line.style.top = topPx + 'px';
        const dot      = document.createElement('div');
        dot.className  = 'sh-now-dot';
        dot.style.top  = (topPx - 4) + 'px';
        col.appendChild(line);
        col.appendChild(dot);
      }
    }

    (data[dk] || []).forEach(b => {
      if (b.endH <= startHour || b.startH > endHour) return;

      const clampedStart = Math.max(b.startH, startHour);
      const clampedEnd   = Math.min(b.endH, endHour + 1);
      const topPx        = (clampedStart - startHour) * HOUR_H + 2;
      const heightPx     = Math.max((clampedEnd - clampedStart) * HOUR_H - 4, 22);

      const block = document.createElement('div');
      block.className = 'sh-block';
      block.style.cssText = `
        top:${topPx}px;
        height:${heightPx}px;
        background:${hexAlpha(b.color, 0.15)};
        border-left:3px solid ${b.color};
        color:${b.color};
      `;
      block.innerHTML = `
        <div class="sh-block-label">${escHtml(b.label)}</div>
        <div class="sh-block-time">${String(b.startH).padStart(2,'0')}:00 – ${String(b.endH).padStart(2,'0')}:00</div>
        ${b.notes ? `<div class="sh-block-note-dot"></div>` : ''}`;
      block.onclick = e => onSchedBlockClick(e, dk, b.id);
      if (b.notes) {
        block.dataset.note = b.notes;
        block.addEventListener('mouseenter', _showSchedTooltip);
        block.addEventListener('mouseleave', _hideSchedTooltip);
      }
      col.appendChild(block);
    });
  });
}

// ── Navigation ────────────────────────────────────────────────────────────────

function schedNavWeek(dir) {
  _schedWeekOffset += dir;
  closeSchedPopup();
  renderSchedule();
  if (_schedWeekOffset === 0) setTimeout(schedScrollToStart, 80);
}

function schedGoToday() {
  _schedWeekOffset = 0;
  closeSchedPopup();
  renderSchedule();
  setTimeout(schedScrollToStart, 80);
}

// ── Settings tab helpers (called by settings.js) ──────────────────────────────

function renderScheduleSettingsTab() {
  const startEl  = document.getElementById('schedStartHour');
  const endEl    = document.getElementById('schedEndHour');
  const repeatEl = document.getElementById('schedRepeatToggle');
  if (!startEl || !endEl || !repeatEl) return;

  if (!startEl.options.length) {
    const opts = Array.from({ length: 24 }, (_, h) =>
      `<option value="${h}">${String(h).padStart(2,'0')}:00</option>`
    ).join('');
    startEl.innerHTML = opts;
    endEl.innerHTML   = opts;
  }

  startEl.value    = getSchedStartHour();
  endEl.value      = getSchedEndHour();
  repeatEl.checked = getSchedRepeat();
}

function onSchedSettingChange() {
  const startEl  = document.getElementById('schedStartHour');
  const endEl    = document.getElementById('schedEndHour');
  const repeatEl = document.getElementById('schedRepeatToggle');
  if (!startEl || !endEl || !repeatEl) return;

  const startHour    = parseInt(startEl.value);
  const endHour      = parseInt(endEl.value);
  const repeatWeekly = repeatEl.checked;

  if (endHour <= startHour) {
    endEl.style.borderColor = 'var(--red,#FF7B72)';
    setTimeout(() => endEl.style.borderColor = '', 800);
    return;
  }

  saveSchedSettings({ startHour, endHour, repeatWeekly });

  if (_isScheduleVisible()) {
    renderSchedule();
    setTimeout(schedScrollToStart, 80);
  }
}