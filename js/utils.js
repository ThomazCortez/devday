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

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function fmtDate(iso) {
  const [, m, d] = iso.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[parseInt(m) - 1]} ${parseInt(d)}`;
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