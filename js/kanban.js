// ── Kanban View ──

// Per-column page state — reset whenever the filter changes or kanban is re-entered
let _kbPage = { todo: 1, doing: 1, done: 1 };

function resetKbPages() { _kbPage = { todo: 1, doing: 1, done: 1 }; }

function renderKanban() {
  ['todo', 'doing', 'done'].forEach(status => {
    const col   = document.getElementById(`kb-${status}`);
    const count = document.getElementById(`kb-count-${status}`);
    const items = getFiltered().filter(t => t.status === status);
    if (count) count.textContent = items.length;

    if (!items.length) {
      col.innerHTML = `<div class="kb-col-empty">// empty</div>`;
      return;
    }

    const next = { todo: 'doing', doing: 'done',  done: null };
    const prev = { todo: null,    doing: 'todo',  done: 'doing' };

    // ── Pagination ──
    const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE_current));
    if (_kbPage[status] > totalPages) _kbPage[status] = totalPages;
    const start  = (_kbPage[status] - 1) * PAGE_SIZE_current;
    const paged  = items.slice(start, start + PAGE_SIZE_current);

    col.innerHTML = paged.map(t => {
      const dm        = dueMeta(t.due);
      const isOverdue = !t.done && dm?.cls === 'overdue';
      const l         = getLabels().find(l => l.id === t.tag);
      const tagColor  = l ? l.color : '#7D8590';
      return `
      <div class="kb-card ${isOverdue ? 'overdue-card' : ''}" data-id="${t.id}"
        onmousedown="onCardMouseDown(event,${t.id})"
        ontouchstart="onCardMouseDown(event,${t.id})">
        <div class="kb-card-text">${escHtml(t.text)}</div>
        ${t.notes && t.notes.trim()
          ? `<div class="kb-notes-preview">${escHtml(t.notes.trim().slice(0, 120))}${t.notes.trim().length > 120 ? '…' : ''}</div>`
          : ''}
        ${dm && !t.done ? `<div style="margin:5px 0 2px"><span class="due-badge ${dm.cls}">${dm.icon} ${dm.label}</span></div>` : ''}
        <div class="kb-card-footer">
          <span>${t.tag ? `<span class="kb-card-tag" style="background:${hexAlpha(tagColor, 0.12)};color:${tagColor}">#${escHtml(t.tag)}</span>` : ''}</span>
          <div class="kb-card-actions">
            ${prev[status] ? `<button class="kb-action-btn move-btn" onclick="moveCard(${t.id},'${prev[status]}')">← back</button>` : ''}
            ${next[status] ? `<button class="kb-action-btn move-btn" onclick="moveCard(${t.id},'${next[status]}')">next →</button>` : ''}
            <button class="kb-action-btn del-btn" onclick="deleteKbCard(${t.id})">✕</button>
          </div>
        </div>
      </div>`;
    }).join('');

    // ── Pagination bar (only if more than one page) ──
    if (totalPages > 1) {
      const bar = document.createElement('div');
      bar.className = 'kb-pagination';

      let html = `<button class="page-btn arrow" onclick="goToKbPage('${status}',${_kbPage[status] - 1})" ${_kbPage[status] === 1 ? 'disabled' : ''}>‹</button>`;

      const range = [];
      for (let p = 1; p <= totalPages; p++) {
        if (p === 1 || p === totalPages || (p >= _kbPage[status] - 1 && p <= _kbPage[status] + 1)) range.push(p);
        else if (range[range.length - 1] !== '…') range.push('…');
      }
      range.forEach(p => {
        if (p === '…') html += `<span class="kb-page-ellipsis">…</span>`;
        else html += `<button class="page-btn ${p === _kbPage[status] ? 'active' : ''}" onclick="goToKbPage('${status}',${p})">${p}</button>`;
      });

      html += `<button class="page-btn arrow" onclick="goToKbPage('${status}',${_kbPage[status] + 1})" ${_kbPage[status] === totalPages ? 'disabled' : ''}>›</button>`;
      bar.innerHTML = html;
      col.appendChild(bar);
    }
  });

  updateCounts();
}

function goToKbPage(status, p) {
  const items      = getFiltered().filter(t => t.status === status);
  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE_current));
  _kbPage[status]  = Math.max(1, Math.min(totalPages, p));
  renderKanban();
}

function moveCard(id, newStatus) {
  const t = tasks.find(t => t.id === id); if (!t) return;
  const wasDone = t.status === 'done';
  t.status = newStatus;
  t.done   = newStatus === 'done';
  if (newStatus === 'done' && !wasDone) {
    t.completedAt = new Date().toISOString();
    updateStreak();
    showStreakAlert();
  } else if (newStatus !== 'done') {
    t.completedAt = null;
  }
  save();
  renderKanban();
  if (newStatus === 'done' && !wasDone) showCelebration(t.text);
}

function deleteKbCard(id) {
  deleteTask(id);
}

function switchView(view) {
  hideScheduleIfVisible();
  if (currentView === view) return;
  const listEl   = document.getElementById('listView');
  const kanbanEl = document.getElementById('kanbanView');
  const inputEl  = document.getElementById('inputArea');

  document.getElementById('btnList').classList.toggle('active',   view === 'list');
  document.getElementById('btnKanban').classList.toggle('active', view === 'kanban');

  listEl.classList.add('fading'); kanbanEl.classList.add('fading'); inputEl.classList.add('fading');
  setTimeout(() => {
    currentView = view;
    if (view === 'list') {
      listEl.style.display = '';
      inputEl.style.display = '';
      kanbanEl.classList.remove('visible'); kanbanEl.style.display = 'none';
      renderTasks();
    } else {
      listEl.style.display = 'none';
      inputEl.style.display = '';
      kanbanEl.style.display = ''; kanbanEl.classList.add('visible');
      resetKbPages();
      renderKanban();
    }
    listEl.classList.remove('fading'); kanbanEl.classList.remove('fading'); inputEl.classList.remove('fading');
  }, 180);
}

// ── Kanban Drag & Drop ──
let _dragClone      = null;
let _dragOffsetX    = 0;
let _dragOffsetY    = 0;
let _dragOverCol    = null;
let _dragOverCardId = null;

function onCardMouseDown(e, id) {
  if (e.target.closest('button')) return;
  if (e.touches && e.touches.length > 1) return;
  e.preventDefault();
  dragId = id;

  const { x, y } = getXY(e);
  const card = e.currentTarget;
  const rect = card.getBoundingClientRect();
  _dragOffsetX = x - rect.left;
  _dragOffsetY = y - rect.top;

  _dragClone = card.cloneNode(true);
  const cs  = getComputedStyle(document.body);
  const acc = cs.getPropertyValue('--claude').trim();
  const bg2 = cs.getPropertyValue('--bg-2').trim();
  const txt = cs.getPropertyValue('--text').trim();
  Object.assign(_dragClone.style, {
    position: 'fixed', top: rect.top + 'px', left: rect.left + 'px', width: rect.width + 'px',
    margin: '0', opacity: '1', pointerEvents: 'none', zIndex: '9999',
    background: bg2, border: `1px solid ${acc}80`, borderLeft: `3px solid ${acc}`,
    borderRadius: '8px', padding: '11px 13px',
    boxShadow: `0 12px 36px rgba(0,0,0,0.7),0 0 0 1px ${acc}40`,
    color: txt, transition: 'none', transform: 'rotate(1.5deg) scale(1.03)',
  });
  document.body.appendChild(_dragClone);
  card.classList.add('dragging');

  document.addEventListener('mousemove', onDragMouseMove);
  document.addEventListener('mouseup',   onDragMouseUp);
  document.addEventListener('touchmove', onDragMouseMove, { passive: false });
  document.addEventListener('touchend',  onDragMouseUp);
}

function onDragMouseMove(e) {
  if (!_dragClone) return;
  e.preventDefault();
  const { x, y } = getXY(e);
  _dragClone.style.left = (x - _dragOffsetX) + 'px';
  _dragClone.style.top  = (y - _dragOffsetY) + 'px';

  document.querySelectorAll('.kb-cards').forEach(c => c.classList.remove('drag-over'));
  document.querySelectorAll('.kb-drop-indicator').forEach(el => el.remove());

  const col = document.elementFromPoint(x, y)?.closest('.kb-col');
  if (col) {
    _dragOverCol = col.dataset.status;
    col.querySelector('.kb-cards')?.classList.add('drag-over');
    const cards = [...col.querySelectorAll('.kb-card')].filter(c => +c.dataset.id !== dragId);
    let insertBefore = null;
    for (const c of cards) {
      const mid = c.getBoundingClientRect().top + c.getBoundingClientRect().height / 2;
      if (y < mid) { insertBefore = c; break; }
    }
    _dragOverCardId = insertBefore ? +insertBefore.dataset.id : null;
    const ind = document.createElement('div');
    ind.className = 'kb-drop-indicator';
    const colCards = col.querySelector('.kb-cards');
    if (insertBefore) colCards.insertBefore(ind, insertBefore);
    else              colCards.appendChild(ind);
  } else {
    _dragOverCol = null; _dragOverCardId = null;
  }
}

function onDragMouseUp() {
  document.removeEventListener('mousemove', onDragMouseMove);
  document.removeEventListener('mouseup',   onDragMouseUp);
  document.removeEventListener('touchmove', onDragMouseMove);
  document.removeEventListener('touchend',  onDragMouseUp);
  document.querySelectorAll('.kb-drop-indicator').forEach(el => el.remove());

  if (_dragOverCol && dragId !== null) {
    const t = tasks.find(t => t.id === dragId);
    if (t) {
      const wasDone = t.status === 'done';
      t.status = _dragOverCol;
      t.done   = _dragOverCol === 'done';
      if (_dragOverCol === 'done' && !wasDone) {
        t.completedAt = new Date().toISOString();
        updateStreak();
        showStreakAlert();
      } else if (_dragOverCol !== 'done') {
        t.completedAt = null;
      }
      const fromIdx = tasks.findIndex(t => t.id === dragId);
      tasks.splice(fromIdx, 1);
      if (_dragOverCardId !== null) {
        const toIdx = tasks.findIndex(t => t.id === _dragOverCardId);
        tasks.splice(toIdx === -1 ? tasks.length : toIdx, 0, t);
      } else {
        const lastIdx = tasks.reduce((acc, cur, i) => cur.status === _dragOverCol ? i : acc, -1);
        tasks.splice(lastIdx + 1, 0, t);
      }
      save();
      if (_dragOverCol === 'done' && !wasDone) showCelebration(t.text);
    }
  }

  if (_dragClone) { document.body.removeChild(_dragClone); _dragClone = null; }
  document.querySelectorAll('.kb-card').forEach(el => el.classList.remove('dragging'));
  document.querySelectorAll('.kb-cards').forEach(el => el.classList.remove('drag-over'));
  dragId = null; _dragOverCol = null; _dragOverCardId = null;
  renderKanban();
}