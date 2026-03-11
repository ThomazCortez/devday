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

  tasks.unshift({ id: Date.now(), text, tag: tagToUse, due: selectedDue, done: false, status: 'todo' });
  save();
  input.value = '';
  currentPage = 1;
  setDue(null);
  renderTagButtons();
  renderTasks();
  if (currentView === 'kanban') renderKanban();
}

function toggleDone(id) {
  const t = tasks.find(t => t.id === id);
  if (t) {
    t.done   = !t.done;
    t.status = t.done ? 'done' : 'todo';
    save();
    renderTasks();
    if (t.done) showCelebration(t.text);
  }
}

function deleteTask(id) {
  const el = document.querySelector(`[data-id="${id}"]`);
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
  }
}

function toggleTag(btn) {
  const tag   = btn.dataset.tag;
  selectedTag = selectedTag === tag ? null : tag;
  renderTagButtons();
}

function setFilter(btn, filter) {
  document.querySelectorAll('.sidebar-item').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  currentFilter = filter;
  currentPage   = 1;
  renderTasks();
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
        <div class="task-text">${escHtml(t.text)}</div>
        ${(t.tag || dm) ? `<div class="task-meta">
          ${t.tag ? `<span class="task-tag" style="background:${hexAlpha(tagColor, 0.12)};color:${tagColor}">#${escHtml(t.tag)}</span>` : ''}
          ${dm && !t.done ? `<span class="due-badge ${dm.cls}">${dm.icon} ${dm.label}</span>` : ''}
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