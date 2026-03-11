// ── List View Drag Reorder ──

let _listDragId      = null;
let _listDragClone   = null;
let _listDragOffX    = 0;
let _listDragOffY    = 0;
let _listDropBeforeId = null;

function onListHandleDown(e, id) {
  if (e.touches && e.touches.length > 1) return;
  e.preventDefault(); e.stopPropagation();
  _listDragId = id;

  const { x, y } = getXY(e);
  const row  = e.currentTarget.closest('.task-item');
  const rect = row.getBoundingClientRect();
  _listDragOffX = x - rect.left;
  _listDragOffY = y - rect.top;

  _listDragClone = row.cloneNode(true);
  const cs  = getComputedStyle(document.body);
  const acc = cs.getPropertyValue('--claude').trim();
  const bg2 = cs.getPropertyValue('--bg-2').trim();
  Object.assign(_listDragClone.style, {
    position: 'fixed', top: rect.top + 'px', left: rect.left + 'px', width: rect.width + 'px',
    margin: '0', pointerEvents: 'none', zIndex: '9999', transition: 'none',
    background: bg2, border: `1px solid ${acc}70`,
    borderRadius: '6px', boxShadow: '0 8px 28px rgba(0,0,0,0.6)',
    transform: 'rotate(0.4deg) scale(1.01)', opacity: '1',
  });
  document.body.appendChild(_listDragClone);
  row.classList.add('list-ghost');

  document.addEventListener('mousemove', onListDragMove);
  document.addEventListener('mouseup',   onListDragUp);
  document.addEventListener('touchmove', onListDragMove, { passive: false });
  document.addEventListener('touchend',  onListDragUp);
}

function onListDragMove(e) {
  if (!_listDragClone) return;
  e.preventDefault();
  const { x, y } = getXY(e);
  _listDragClone.style.left = (x - _listDragOffX) + 'px';
  _listDragClone.style.top  = (y - _listDragOffY) + 'px';

  document.querySelectorAll('.list-drop-indicator').forEach(el => el.remove());
  const list = document.getElementById('taskList');
  const rows = [...list.querySelectorAll('.task-item')].filter(el => +el.dataset.id !== _listDragId);

  let insertBefore = null;
  for (const row of rows) {
    const mid = row.getBoundingClientRect().top + row.getBoundingClientRect().height / 2;
    if (y < mid) { insertBefore = row; break; }
  }
  _listDropBeforeId = insertBefore ? +insertBefore.dataset.id : null;

  const ind = document.createElement('div');
  ind.className = 'list-drop-indicator';
  if (insertBefore) list.insertBefore(ind, insertBefore);
  else              list.appendChild(ind);
}

function onListDragUp() {
  document.removeEventListener('mousemove', onListDragMove);
  document.removeEventListener('mouseup',   onListDragUp);
  document.removeEventListener('touchmove', onListDragMove);
  document.removeEventListener('touchend',  onListDragUp);
  document.querySelectorAll('.list-drop-indicator').forEach(el => el.remove());

  if (_listDragClone) { document.body.removeChild(_listDragClone); _listDragClone = null; }

  if (_listDragId !== null) {
    const fromIdx = tasks.findIndex(t => t.id === _listDragId);
    if (fromIdx !== -1) {
      const [task] = tasks.splice(fromIdx, 1);
      if (_listDropBeforeId !== null) {
        const toIdx = tasks.findIndex(t => t.id === _listDropBeforeId);
        tasks.splice(toIdx === -1 ? tasks.length : toIdx, 0, task);
      } else {
        tasks.push(task);
      }
      save();
    }
  }

  _listDragId = null; _listDropBeforeId = null;
  renderTasks();
}