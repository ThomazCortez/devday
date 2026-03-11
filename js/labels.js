// ── Labels / Tags ──

const LABELS_KEY = 'devday_labels';
const LABEL_DEFAULTS = [
  { id: 'work',     name: 'work',     color: '#58A6FF', enabled: true, isDefault: true },
  { id: 'personal', name: 'personal', color: '#BC8CFF', enabled: true, isDefault: true },
  { id: 'health',   name: 'health',   color: '#3FB950', enabled: true, isDefault: true },
];

function getLabels() {
  try {
    const saved = JSON.parse(localStorage.getItem(LABELS_KEY) || 'null');
    if (saved && Array.isArray(saved) && saved.length) return saved;
  } catch (e) {}
  return LABEL_DEFAULTS.map(l => ({ ...l }));
}

function saveLabels(labels) {
  localStorage.setItem(LABELS_KEY, JSON.stringify(labels));
}

function isTagEnabled(id) {
  if (!id) return false;
  const label = getLabels().find(l => l.id === id);
  return label ? label.enabled : false;
}

function renderTagButtons() {
  const container = document.getElementById('tagBtnsContainer');
  if (!container) return;
  const labels = getLabels().filter(l => l.enabled);
  container.innerHTML = labels.map(l =>
    `<button class="tag-btn${selectedTag === l.id ? ' active' : ''}"
      data-tag="${escHtml(l.id)}"
      style="--tag-active-bg:${hexAlpha(l.color, 0.12)};--tag-active-ink:${l.color}"
      onclick="toggleTag(this)">#${escHtml(l.name)}</button>`
  ).join('');
}

function renderSidebarLabels() {
  const el = document.getElementById('sidebarLabels');
  if (!el) return;
  el.innerHTML = getLabels().map(l => {
    const count = tasks.filter(t => t.tag === l.id).length;
    return `<button class="sidebar-item${currentFilter === l.id ? ' active' : ''}" onclick="setFilter(this,'${l.id}')">
      <svg width="10" height="10" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4" fill="${l.color}"/></svg>
      ${escHtml(l.name)} <span class="dot-count" id="count-${l.id}">${count}</span>
    </button>`;
  }).join('');
}

function renderLabelsManager() {
  const el = document.getElementById('labelsManager');
  if (!el) return;
  const labels = getLabels();
  if (!labels.length) {
    el.innerHTML = `<div style="font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--text-faint);font-style:italic">// no labels yet</div>`;
    return;
  }
  el.innerHTML = labels.map(l => `
    <div class="label-manager-row">
      <div style="display:flex;align-items:center;gap:10px;flex:1;min-width:0;">
        <div style="width:14px;height:14px;border-radius:50%;background:${l.color};flex-shrink:0;border:1px solid rgba(255,255,255,0.15)"></div>
        <span style="font-family:'JetBrains Mono',monospace;font-size:12px;color:var(--text);">#${escHtml(l.name)}</span>
        ${l.isDefault ? `<span style="font-family:'JetBrains Mono',monospace;font-size:9px;color:var(--text-faint);background:var(--bg-3);padding:1px 6px;border-radius:4px;border:1px solid var(--border-soft)">default</span>` : ''}
      </div>
      <div style="display:flex;align-items:center;gap:8px;flex-shrink:0;">
        ${!l.isDefault ? `<input type="color" value="${l.color}" onchange="updateLabelColor('${l.id}',this.value)"
          style="width:24px;height:24px;border:1px solid var(--border);border-radius:5px;background:var(--bg-3);cursor:pointer;padding:1px;" title="change color"/>` : ''}
        <label class="toggle" title="${l.enabled ? 'disable' : 'enable'} label">
          <input type="checkbox" ${l.enabled ? 'checked' : ''} onchange="toggleLabelEnabled('${l.id}',this.checked)"/>
          <div class="toggle-track"></div>
        </label>
        ${!l.isDefault ? `<button onclick="deleteLabel('${l.id}')"
          style="background:none;border:none;cursor:pointer;color:var(--text-faint);padding:2px 5px;border-radius:4px;font-size:13px;transition:color 0.15s"
          onmouseover="this.style.color='var(--red)'" onmouseout="this.style.color='var(--text-faint)'"
          title="delete">✕</button>` : ''}
      </div>
    </div>
  `).join('');
}

function addCustomLabel() {
  const nameInput  = document.getElementById('newLabelName');
  const colorInput = document.getElementById('newLabelColor');
  const name = nameInput.value.trim().toLowerCase().replace(/\s+/g, '-').slice(0, 16);
  if (!name) return;
  const labels = getLabels();
  if (labels.find(l => l.id === name)) {
    nameInput.style.borderColor = 'var(--red)';
    setTimeout(() => nameInput.style.borderColor = '', 1200);
    return;
  }
  labels.push({ id: name, name, color: colorInput.value, enabled: true, isDefault: false });
  saveLabels(labels);
  nameInput.value = '';
  colorInput.value = '#58A6FF';
  _refreshLabelsUI();
}

function toggleLabelEnabled(id, enabled) {
  const labels = getLabels();
  const l = labels.find(l => l.id === id);
  if (l) { l.enabled = enabled; saveLabels(labels); }
  if (selectedTag === id && !enabled) selectedTag = null;
  _refreshLabelsUI();
}

function updateLabelColor(id, color) {
  const labels = getLabels();
  const l = labels.find(l => l.id === id);
  if (l) { l.color = color; saveLabels(labels); }
  _refreshLabelsUI();
  renderTasks();
  if (currentView === 'kanban') renderKanban();
}

function deleteLabel(id) {
  saveLabels(getLabels().filter(l => l.id !== id));
  if (selectedTag === id) selectedTag = null;
  if (currentFilter === id) currentFilter = 'all';
  _refreshLabelsUI();
}

function _refreshLabelsUI() {
  renderLabelsManager();
  renderTagButtons();
  renderSidebarLabels();
}