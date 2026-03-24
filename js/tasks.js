// ── Tasks ──

const _openNotes   = new Set();
let _noteSaveTimer = null;
let _editingNote   = false;

function normalizeTasks(arr) {
  return arr.map(t => ({
    ...t,
    status: t.status || (t.done ? 'done' : 'todo'),
    notes:  t.notes  || '',
  }));
}

function save() { dbSave(tasks); }

// ── Notes ──
function toggleNotes(id) {
  if (_openNotes.has(id)) { _openNotes.delete(id); } else { _openNotes.add(id); }
  const area = document.getElementById(`notes-area-${id}`);
  const btn  = document.querySelector(`[data-id="${id}"] .notes-btn`);
  if (area) area.classList.toggle('open', _openNotes.has(id));
  if (btn)  btn.classList.toggle('open',  _openNotes.has(id));
  if (_openNotes.has(id)) {
    setTimeout(() => {
      const ta = document.getElementById(`notes-ta-${id}`);
      if (!ta) return;
      ta.addEventListener('focus', () => { _editingNote = true; });
      ta.addEventListener('blur',  () => { _editingNote = false; clearTimeout(_noteSaveTimer); saveNote(id); });
      ta.focus();
    }, 50);
  }
}

function scheduleNoteSave(id) {
  _editingNote = true;
  clearTimeout(_noteSaveTimer);
  _noteSaveTimer = setTimeout(() => saveNote(id), 1500);
}

function saveNote(id) {
  const ta = document.getElementById(`notes-ta-${id}`);
  if (!ta) return;
  const t = tasks.find(t => t.id === id);
  if (!t) return;
  const val = ta.value;
  if (t.notes === val) return;
  t.notes = val; save();
  const btn = document.querySelector(`[data-id="${id}"] .notes-btn`);
  if (btn) btn.classList.toggle('has-notes', val.trim().length > 0);
}

// ── Inline edit on double-click ──
function editTaskInline(id) {
  // Find the text element in whichever view is visible
  const textEl = document.querySelector(
    `[data-id="${id}"] .task-text, [data-id="${id}"] .kb-card-text`
  );
  if (!textEl) return;

  const t = tasks.find(t => t.id === id);
  if (!t) return;

  // Prevent triggering drag or other handlers while editing
  textEl.closest('[data-id]').classList.add('editing');

  const original = t.text;
  const input    = document.createElement('input');
  input.type      = 'text';
  input.value     = original;
  input.className = 'task-inline-input';
  input.maxLength = 200;

  textEl.replaceWith(input);
  input.focus();
  input.select();

  function commit() {
    const newText = input.value.trim();
    if (newText && newText !== original) {
      t.text = newText;
      save();
    }
    // Re-render whichever view is active
    if (currentView === 'kanban') renderKanban();
    else renderTasks();
  }

  function cancel() {
    if (currentView === 'kanban') renderKanban();
    else renderTasks();
  }

  input.addEventListener('keydown', e => {
    if (e.key === 'Enter')  { e.preventDefault(); commit(); }
    if (e.key === 'Escape') { e.preventDefault(); cancel(); }
    e.stopPropagation(); // prevent global keydown handlers firing
  });

  input.addEventListener('blur', commit);
}

// ── CRUD ──
function addTask() {
  const input = document.getElementById('taskInput');
  const text  = input.value.trim();
  if (!text) return;

  let tagToUse = selectedTag;
  if (!tagToUse) {
    const defaultTag = localStorage.getItem('settings_default_tag');
    if (defaultTag && isTagEnabled(defaultTag)) tagToUse = defaultTag;
  }

  tasks.unshift({ id: Date.now(), text, tag: tagToUse, due: selectedDue, recur: selectedRecur || null, done: false, status: 'todo' });
  save();
  input.value = '';
  currentPage = 1;
  setDue(null);
  setRecur(null);
  renderTagButtons();
  renderTasks();
  if (currentView === 'kanban') renderKanban();
}

function toggleDone(id) {
  const t = tasks.find(t => t.id === id);
  if (!t) return;

  if (t.recur && !t.done) {
    t.done        = true;
    t.status      = 'done';
    t.completedAt = new Date().toISOString();
    updateStreak();
    showStreakAlert();
    save();
    renderTasks();
    showCelebration(t.text);
  } else {
    t.done   = !t.done;
    t.status = t.done ? 'done' : 'todo';
    if (t.done) {
      t.completedAt = new Date().toISOString();
      updateStreak();
      showStreakAlert();
    } else {
      t.completedAt = null;
    }
    save();
    renderTasks();
    if (t.done) showCelebration(t.text);
  }
}

function resetRecurringTasks() {
  const today = todayStr();
  console.log('🔄 resetRecurringTasks fired, today =', today);
  console.log('tasks at reset time:', tasks.length, tasks);
  let changed = false;
  tasks.forEach(t => {
    if (t.recur && t.done && t.completedAt) {
      const completedDay = t.completedAt.slice(0, 10);
      console.log(`task "${t.text}": completedDay=${completedDay}, today=${today}, should reset=${completedDay < today}`);
      if (completedDay < today) {
        t.done        = false;
        t.status      = 'todo';
        t.completedAt = null;
        t.due         = nextDueDate(completedDay, t.recur);
        changed       = true;
        console.log('✅ reset!', t);
      }
    }
  });
  console.log('changed:', changed);
  if (changed) save();
}

let _undoTask      = null;
let _undoTimer     = null;
let _undoIndex     = null;
const UNDO_DELAY   = 4000;

function deleteTask(id) {
  const el  = document.querySelector(`[data-id="${id}"]`);
  const idx = tasks.findIndex(t => t.id === id);
  if (idx === -1) return;

  _undoTask  = { ...tasks[idx] };
  _undoIndex = idx;

  // Archive if done so stats preserve it
  if (tasks[idx].done && tasks[idx].completedAt) {
    const history = JSON.parse(localStorage.getItem('devday_completed_history') || '[]');
    history.push({ completedAt: tasks[idx].completedAt, tag: tasks[idx].tag });
    localStorage.setItem('devday_completed_history', JSON.stringify(history.slice(-1000)));
  }

  if (el) {
    _deletingIds.add(id);
    el.classList.add('removing');
    setTimeout(() => {
      tasks = tasks.filter(t => t.id !== id);
      save();
      _deletingIds.delete(id);
      renderTasks();
      if (currentView === 'kanban') renderKanban();
    }, 230);
  } else {
    tasks = tasks.filter(t => t.id !== id);
    save();
    renderTasks();
    if (currentView === 'kanban') renderKanban();
  }

  showUndoToast(_undoTask.text);
}

function showUndoToast(text) {
  clearTimeout(_undoTimer);
  const toast    = document.getElementById('undoToast');
  const label    = document.getElementById('undoTaskName');
  const progress = document.getElementById('undoProgress');

  label.textContent    = text;
  progress.style.transition = 'none';
  progress.style.width      = '100%';
  toast.classList.add('visible');

  requestAnimationFrame(() => requestAnimationFrame(() => {
    progress.style.transition = `width ${UNDO_DELAY}ms linear`;
    progress.style.width      = '0%';
  }));

  _undoTimer = setTimeout(dismissUndoToast, UNDO_DELAY);
}

function dismissUndoToast() {
  document.getElementById('undoToast').classList.remove('visible');
  _undoTask = null; _undoIndex = null;
}

function undoDelete() {
  if (!_undoTask) return;
  clearTimeout(_undoTimer);

  // Remove from history if it was archived
  if (_undoTask.done && _undoTask.completedAt) {
    let history = JSON.parse(localStorage.getItem('devday_completed_history') || '[]');
    history = history.filter(h => h.completedAt !== _undoTask.completedAt);
    localStorage.setItem('devday_completed_history', JSON.stringify(history));
  }

  tasks.splice(_undoIndex, 0, _undoTask);
  save();
  renderTasks();
  if (currentView === 'kanban') renderKanban();
  dismissUndoToast();
}

function toggleTag(btn) {
  const tag   = btn.dataset.tag;
  selectedTag = selectedTag === tag ? null : tag;
  renderTagButtons();
}

function setFilter(btn, filter) {
  hideStatsIfVisible();
  hideScheduleIfVisible();

  if (currentView === 'list') {
    document.getElementById('listView').style.display = '';
    document.getElementById('inputArea').style.display = '';
  } else if (currentView === 'kanban') {
    document.getElementById('listView').style.display = 'none'; // ← add this
    const kanbanEl = document.getElementById('kanbanView');
    kanbanEl.style.display = '';
    kanbanEl.classList.add('visible');
    document.getElementById('inputArea').style.display = '';
  }

  document.querySelectorAll('.sidebar-item').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  currentFilter = filter;
  currentPage   = 1;
  resetKbPages();

  if (currentView === 'kanban') {
    renderKanban();
  } else {
    renderTasks();
  }

  renderSidebarLabels();
  if (window.innerWidth <= 768) toggleSidebar();
}

function getFiltered() {
  return tasks.filter(t => {
    if (currentFilter === 'active')  return !t.done;
    if (currentFilter === 'done')    return t.done;
    if (currentFilter === 'overdue') return !t.done && t.due && t.due < todayStr();
    if (getLabels().some(l => l.id === currentFilter)) return t.tag === currentFilter;
    return true;
  });
}

// ── Render ──
function renderTasks() {
  const list   = document.getElementById('taskList');
  const empty  = document.getElementById('emptyState');
  const filtered = getFiltered();
  filtered.sort((a, b) => { if (a.done === b.done) return 0; return a.done ? 1 : -1; });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE_current));
  if (currentPage > totalPages) currentPage = totalPages;
  const start = (currentPage - 1) * PAGE_SIZE_current;
  const paged = filtered.slice(start, start + PAGE_SIZE_current);

  list.innerHTML = paged.map(t => {
    const dm        = dueMeta(t.due);
    const isOverdue = !t.done && dm?.cls === 'overdue';
    const hasNotes  = t.notes && t.notes.trim().length > 0;
    const isOpen    = _openNotes.has(t.id);
    const l         = getLabels().find(l => l.id === t.tag);
    const tagColor  = l ? l.color : '#7D8590';
    return `
    <div class="task-item ${t.done ? 'done' : ''} ${isOverdue ? 'overdue-task' : ''}" data-id="${t.id}">
      <span class="drag-handle" onmousedown="onListHandleDown(event,${t.id})" ontouchstart="onListHandleDown(event,${t.id})">
        <svg width="10" height="14" viewBox="0 0 10 14" fill="none">
          <circle cx="3" cy="3"  r="1.2" fill="currentColor"/>
          <circle cx="7" cy="3"  r="1.2" fill="currentColor"/>
          <circle cx="3" cy="7"  r="1.2" fill="currentColor"/>
          <circle cx="7" cy="7"  r="1.2" fill="currentColor"/>
          <circle cx="3" cy="11" r="1.2" fill="currentColor"/>
          <circle cx="7" cy="11" r="1.2" fill="currentColor"/>
        </svg>
      </span>
      <button class="check-btn" onclick="toggleDone(${t.id})">
        <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
          <path d="M1 3.5l2.5 2.5 5-5" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
      <div class="task-body">
        <div class="task-text" ondblclick="editTaskInline(${t.id})">${escHtml(t.text)}</div>
        ${(t.tag || dm || t.recur) ? `<div class="task-meta">
          ${t.tag ? `<span class="task-tag" style="background:${hexAlpha(tagColor, 0.12)};color:${tagColor}">#${escHtml(t.tag)}</span>` : ''}
          ${dm && !t.done ? `<span class="due-badge ${dm.cls}">${dm.icon} ${dm.label}</span>` : ''}
          ${t.recur ? `<span class="recur-badge">↻ ${recurLabel(t.recur)}</span>` : ''}
        </div>` : ''}
      </div>
      <div class="task-actions">
        <button class="notes-btn ${hasNotes ? 'has-notes' : ''} ${isOpen ? 'open' : ''}" onclick="toggleNotes(${t.id})" title="${hasNotes ? 'edit notes' : 'add notes'}">
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
            <path d="M2 3h10M2 6.5h7M2 10h5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
          </svg>
          <svg class="chevron" width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M2 3.5l3 3 3-3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
        <button class="delete-btn" onclick="deleteTask(${t.id})">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
        </button>
      </div>
      <div class="task-notes-area ${isOpen ? 'open' : ''}" id="notes-area-${t.id}">
        <div class="notes-row">
          <textarea class="notes-textarea" id="notes-ta-${t.id}"
            placeholder="// add notes, links, context..."
            oninput="scheduleNoteSave(${t.id})">${escHtml(t.notes || '')}</textarea>
        </div>
      </div>
    </div>`;
  }).join('');

  empty.classList.toggle('visible', tasks.length === 0);
  renderPagination(filtered.length, totalPages);
  updateCounts();
}

function renderPagination(total, totalPages) {
  const bar = document.getElementById('pagination');
  if (totalPages <= 1) { bar.classList.add('hidden'); return; }
  bar.classList.remove('hidden');
  document.getElementById('pageLabel').textContent      = currentPage;
  document.getElementById('pageTotalLabel').textContent = totalPages;

  const btns = document.getElementById('pageBtns');
  let html = `<button class="page-btn arrow" onclick="goToPage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}>‹</button>`;

  const range = [];
  for (let p = 1; p <= totalPages; p++) {
    if (p === 1 || p === totalPages || (p >= currentPage - 1 && p <= currentPage + 1)) range.push(p);
    else if (range[range.length - 1] !== '…') range.push('…');
  }
  range.forEach(p => {
    if (p === '…') html += `<span style="color:var(--text-faint);font-size:11px;padding:0 2px;font-family:'JetBrains Mono',monospace">…</span>`;
    else html += `<button class="page-btn ${p === currentPage ? 'active' : ''}" onclick="goToPage(${p})">${p}</button>`;
  });
  html += `<button class="page-btn arrow" onclick="goToPage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}>›</button>`;
  btns.innerHTML = html;
}

function goToPage(p) {
  const filtered   = getFiltered();
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE_current));
  currentPage      = Math.max(1, Math.min(totalPages, p));
  renderTasks();
}

// ── Recur Picker ──
function setRecur(val) {
  selectedRecur = val || null;
  renderRecurBtn();
  closeRecurPicker();
}

function renderRecurBtn() {
  const btn   = document.getElementById('recurBtnDisplay');
  const label = document.getElementById('recurBtnLabel');
  if (!btn || !label) return;
  label.textContent = selectedRecur ? recurLabel(selectedRecur) : 'repeat';
  btn.classList.toggle('active', !!selectedRecur);
  document.querySelectorAll('.recur-option').forEach(el => {
    el.classList.toggle('active', el.dataset.val === (selectedRecur || ''));
  });
}

function toggleRecurPicker() {
  const popup  = document.getElementById('recurPopup');
  const isOpen = popup.classList.contains('open');
  closeCalendar();
  popup.classList.toggle('open', !isOpen);
  if (!isOpen) setTimeout(() => document.addEventListener('click', _onRecurOutside, { once: true }), 0);
}

function _onRecurOutside(e) {
  if (!document.getElementById('recurPopup')?.contains(e.target)) closeRecurPicker();
}

function closeRecurPicker() {
  document.getElementById('recurPopup')?.classList.remove('open');
}

function updateCounts() {
  const all  = tasks.length;
  const done = tasks.filter(t => t.done).length;
  const pct  = all === 0 ? 0 : Math.round(done / all * 100);
  const today = todayStr();

  const safe = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  safe('count-all',     all);
  safe('count-active',  tasks.filter(t => !t.done).length);
  safe('count-done',    done);
  safe('count-overdue', tasks.filter(t => !t.done && t.due && t.due < today).length);
  getLabels().forEach(l => safe('count-' + l.id, tasks.filter(t => t.tag === l.id).length));

  const pf = document.getElementById('progressFill'); if (pf) pf.style.width = pct + '%';
  const pp = document.getElementById('progressPct');  if (pp) pp.textContent = pct + '%';
  const sc = document.getElementById('statusTaskCount'); if (sc) sc.textContent = `${all} task${all !== 1 ? 's' : ''}`;
}