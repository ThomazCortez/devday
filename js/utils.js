// ── Shared Utilities ──

function escHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function hexAlpha(hex, a) {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

function getXY(e) {
  const src = e.touches ? e.touches[0] : e;
  return { x: src.clientX, y: src.clientY };
}

const DEBUG_DATE = null;

function todayStr() {
  const d = DEBUG_DATE ? new Date(DEBUG_DATE) : new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function fmtDate(iso) {
  const [, m, d] = iso.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[parseInt(m) - 1]} ${parseInt(d)}`;
}

function nextDueDate(due, recur) {
  const base = due ? new Date(due + 'T00:00:00') : new Date();
  const d = new Date(base);
  if      (recur === 'daily')    { d.setDate(d.getDate() + 1); }
  else if (recur === 'weekdays') { do { d.setDate(d.getDate() + 1); } while (d.getDay() === 0 || d.getDay() === 6); }
  else if (recur === 'weekly')   { d.setDate(d.getDate() + 7); }
  else if (recur === 'monthly')  { d.setMonth(d.getMonth() + 1); }
  return d.toISOString().slice(0, 10);
}

function recurLabel(recur) {
  return { daily: 'daily', weekdays: 'weekdays', weekly: 'weekly', monthly: 'monthly' }[recur] || '';
}

function dueMeta(due) {
  if (!due) return null;
  const today = todayStr();
  const diff = Math.round((new Date(due + 'T00:00:00') - new Date(today + 'T00:00:00')) / 86400000);
  if (diff < 0)   return { cls: 'overdue',  label: `overdue ${Math.abs(diff)}d`, icon: '⚠' };
  if (diff === 0) return { cls: 'today',    label: 'today',                       icon: '◈' };
  if (diff === 1) return { cls: 'soon',     label: 'tomorrow',                    icon: '◷' };
  if (diff <= 6)  return { cls: 'soon',     label: `in ${diff}d`,                 icon: '◷' };
  return { cls: 'upcoming', label: fmtDate(due), icon: '◈' };
}