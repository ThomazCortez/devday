// ── Floating Notepad ──

let _notepadTimer = null;
let _noteTabs     = [];
let _noteActiveId = null;

function _noteKey() {
  return _userRef
    ? 'notepad_tabs_' + firebase.auth().currentUser?.uid
    : 'notepad_tabs_guest';
}

function loadNoteTabs() {
  try {
    const raw = localStorage.getItem(_noteKey());
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length) {
        _noteTabs     = parsed;
        _noteActiveId = _noteTabs[0].id;
        renderNoteTabs(); renderNoteContent(); updateNotepadChars(); return;
      }
    }
  } catch (e) {}
  _noteTabs     = [{ id: Date.now(), name: 'scratch', content: '' }];
  _noteActiveId = _noteTabs[0].id;
  renderNoteTabs(); renderNoteContent();
}

function saveNoteTabs() {
  localStorage.setItem(_noteKey(), JSON.stringify(_noteTabs));
  const saved = document.getElementById('notepadSaved');
  if (saved) { saved.classList.add('show'); setTimeout(() => saved.classList.remove('show'), 1800); }
}

function renderNoteTabs() {
  const bar = document.getElementById('noteTabsBar');
  if (!bar) return;
  const html = _noteTabs.map(t => `
    <div class="note-tab ${t.id === _noteActiveId ? 'active' : ''}" data-tab-id="${t.id}" onclick="switchNoteTab(${t.id})">
      <span class="note-tab-label" ondblclick="startRenameTab(${t.id}, event)" title="double-click to rename">${escHtml(t.name)}</span>
      <button class="note-tab-close" onclick="deleteNoteTab(${t.id}, event)" title="close tab">×</button>
    </div>
  `).join('');
  bar.innerHTML = html + '<button class="note-tab-add" onclick="addNoteTab()" title="new tab">+</button>';
  const active = bar.querySelector('.note-tab.active');
  if (active) active.scrollIntoView({ inline: 'nearest', block: 'nearest' });
}

function renderNoteContent() {
  const ta  = document.getElementById('notepadTA');
  if (!ta) return;
  const tab = _noteTabs.find(t => t.id === _noteActiveId);
  ta.value = tab ? tab.content : '';
  ta.placeholder = `// ${tab?.name || 'scratch'}...`;
  updateNotepadChars();
}

function switchNoteTab(id) {
  _flushCurrentTab(); _noteActiveId = id;
  renderNoteTabs(); renderNoteContent();
}

function addNoteTab() {
  _flushCurrentTab();
  const id   = Date.now();
  const name = 'tab ' + (_noteTabs.length + 1);
  _noteTabs.push({ id, name, content: '' });
  _noteActiveId = id;
  saveNoteTabs(); renderNoteTabs(); renderNoteContent();
  setTimeout(() => startRenameTab(id), 60);
}

function deleteNoteTab(id, e) {
  e.stopPropagation();
  if (_noteTabs.length === 1) { _noteTabs[0].content = ''; renderNoteContent(); saveNoteTabs(); return; }
  const idx = _noteTabs.findIndex(t => t.id === id);
  _noteTabs = _noteTabs.filter(t => t.id !== id);
  if (_noteActiveId === id) _noteActiveId = _noteTabs[Math.max(0, idx - 1)].id;
  saveNoteTabs(); renderNoteTabs(); renderNoteContent();
}

function startRenameTab(id, e) {
  if (e) e.stopPropagation();
  const bar   = document.getElementById('noteTabsBar');
  const tabEl = bar?.querySelector(`[data-tab-id="${id}"] .note-tab-label`);
  if (!tabEl) return;
  const tab = _noteTabs.find(t => t.id === id);
  if (!tab) return;
  const input = document.createElement('input');
  input.className = 'note-tab-rename-input';
  input.value = tab.name; input.maxLength = 20;
  tabEl.replaceWith(input);
  input.focus(); input.select();
  const commit = () => { tab.name = input.value.trim() || tab.name; saveNoteTabs(); renderNoteTabs(); };
  input.addEventListener('blur', commit);
  input.addEventListener('keydown', ev => {
    if (ev.key === 'Enter')  input.blur();
    if (ev.key === 'Escape') renderNoteTabs();
    ev.stopPropagation();
  });
  input.addEventListener('click', ev => ev.stopPropagation());
}

function _flushCurrentTab() {
  const ta  = document.getElementById('notepadTA');
  const tab = _noteTabs.find(t => t.id === _noteActiveId);
  if (ta && tab) tab.content = ta.value;
}

function toggleNoteFloat() {
  const el = document.getElementById('noteFloat');
  if (!el) return;
  const isCollapsed = el.classList.contains('collapsed');
  if (isCollapsed) { el.classList.remove('collapsed'); el.style.height = (el._savedHeight || 310) + 'px'; }
  else             { el._savedHeight = el.offsetHeight; el.classList.add('collapsed'); }
  saveNoteState();
}

function onNotepadInput() {
  updateNotepadChars();
  clearTimeout(_notepadTimer);
  _notepadTimer = setTimeout(() => { _flushCurrentTab(); saveNoteTabs(); }, 1000);
  document.getElementById('notepadSaved')?.classList.remove('show');
}

function updateNotepadChars() {
  const ta = document.getElementById('notepadTA');
  const el = document.getElementById('notepadChars');
  if (!ta || !el) return;
  const len = ta.value.length;
  el.textContent = `${len} char${len !== 1 ? 's' : ''}`;
}

function saveNoteState() {
  const el = document.getElementById('noteFloat');
  if (!el) return;
  const rect = el.getBoundingClientRect();
  localStorage.setItem(NOTE_POS_KEY, JSON.stringify({
    top: rect.top, left: rect.left,
    width: el.offsetWidth, height: el.offsetHeight,
    collapsed: el.classList.contains('collapsed'),
  }));
}

function loadNoteState() {
  const data = localStorage.getItem(NOTE_POS_KEY);
  if (!data) return;
  try {
    const state = JSON.parse(data);
    const el = document.getElementById('noteFloat');
    if (!el) return;
    el.style.top    = state.top    + 'px';
    el.style.left   = state.left   + 'px';
    el.style.width  = state.width  + 'px';
    el.style.height = state.height + 'px';
    el.style.bottom = 'auto'; el.style.right = 'auto';
    if (state.collapsed) { el.classList.add('collapsed'); el._savedHeight = state.height; }
    else el.classList.remove('collapsed');
  } catch (e) {}
}

function initNotepad() { loadNoteTabs(); }

// ── Drag + Resize ──
(function initNoteFloat() {
  const el     = document.getElementById('noteFloat');
  const header = document.getElementById('noteFloatHeader');
  if (!el || !header) return;
  const MIN_W = 220, MAX_W = 560, MIN_H = 160;

  function ensureTopLeft() {
    const r = el.getBoundingClientRect();
    el.style.top  = r.top  + 'px'; el.style.left = r.left + 'px';
    el.style.bottom = 'auto'; el.style.right = 'auto';
  }

  let dragging = false, startX = 0, startY = 0, origLeft = 0, origTop = 0, moved = false;

  function onDragDown(e) {
    if (e.target.closest('button')) return;
    e.preventDefault(); ensureTopLeft();
    const { x, y } = getXY(e);
    dragging = true; moved = false;
    startX = x; startY = y;
    origLeft = parseInt(el.style.left) || 0;
    origTop  = parseInt(el.style.top)  || 0;
    el.classList.add('dragging');
    document.addEventListener('mousemove', onDragMove);
    document.addEventListener('mouseup',   onDragUp);
    document.addEventListener('touchmove', onDragMove, { passive: false });
    document.addEventListener('touchend',  onDragUp);
  }

  function onDragMove(e) {
    if (!dragging) return; e.preventDefault();
    const { x, y } = getXY(e);
    const dx = x - startX, dy = y - startY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) moved = true;
    el.style.left = Math.max(0, Math.min(window.innerWidth  - el.offsetWidth,  origLeft + dx)) + 'px';
    el.style.top  = Math.max(0, Math.min(window.innerHeight - el.offsetHeight, origTop  + dy)) + 'px';
  }

  function onDragUp() {
    if (!dragging) return;
    dragging = false; el.classList.remove('dragging');
    if (!moved) { toggleNoteFloat(); } else { saveNoteState(); }
    document.removeEventListener('mousemove', onDragMove);
    document.removeEventListener('mouseup',   onDragUp);
    document.removeEventListener('touchmove', onDragMove);
    document.removeEventListener('touchend',  onDragUp);
  }

  header.addEventListener('mousedown',  onDragDown);
  header.addEventListener('touchstart', onDragDown, { passive: false });
  el.style.height = '310px';

  // Resize handles
  let resizing = false, resizeDir = '', resX = 0, resY = 0;
  let resOrigW = 0, resOrigH = 0, resOrigL = 0, resOrigT = 0;

  el.querySelectorAll('.note-resize').forEach(handle => {
    function onResizeDown(e) {
      if (el.classList.contains('collapsed')) return;
      e.preventDefault(); e.stopPropagation(); ensureTopLeft();
      const { x, y } = getXY(e);
      resizing = true; resizeDir = handle.dataset.dir;
      resX = x; resY = y;
      resOrigW = el.offsetWidth; resOrigH = el.offsetHeight;
      resOrigL = parseInt(el.style.left) || 0;
      resOrigT = parseInt(el.style.top)  || 0;
      el.classList.add('resizing');
      document.body.style.cursor = getComputedStyle(handle).cursor;
      document.addEventListener('mousemove', onResizeMove);
      document.addEventListener('mouseup',   onResizeUp);
      document.addEventListener('touchmove', onResizeMove, { passive: false });
      document.addEventListener('touchend',  onResizeUp);
    }
    handle.addEventListener('mousedown',  onResizeDown);
    handle.addEventListener('touchstart', onResizeDown, { passive: false });
  });

  function onResizeMove(e) {
    if (!resizing) return; e.preventDefault();
    const { x, y } = getXY(e);
    const dx = x - resX, dy = y - resY;
    let w = resOrigW, h = resOrigH, l = resOrigL, t = resOrigT;
    if (resizeDir.includes('e')) w = Math.min(MAX_W, Math.max(MIN_W, resOrigW + dx));
    if (resizeDir.includes('s')) h = Math.max(MIN_H, resOrigH + dy);
    if (resizeDir.includes('w')) { const nw = Math.min(MAX_W, Math.max(MIN_W, resOrigW - dx)); l = resOrigL + (resOrigW - nw); w = nw; }
    if (resizeDir.includes('n')) { const nh = Math.max(MIN_H, resOrigH - dy); t = resOrigT + (resOrigH - nh); h = nh; }
    el.style.width = w + 'px'; el.style.height = h + 'px';
    el.style.left  = l + 'px'; el.style.top    = t + 'px';
  }

  function onResizeUp() {
    if (!resizing) return;
    resizing = false; el.classList.remove('resizing');
    document.body.style.cursor = '';
    document.removeEventListener('mousemove', onResizeMove);
    document.removeEventListener('mouseup',   onResizeUp);
    document.removeEventListener('touchmove', onResizeMove);
    document.removeEventListener('touchend',  onResizeUp);
    saveNoteState();
  }
})();