// ── Settings Panel ──

const ACCENT_COLORS = [
  { hex: '#DA7756', name: 'orange' },
  { hex: '#58A6FF', name: 'blue'   },
  { hex: '#3FB950', name: 'green'  },
  { hex: '#BC8CFF', name: 'purple' },
  { hex: '#FF7B72', name: 'red'    },
  { hex: '#E3B341', name: 'yellow' },
];

const WIDGET_KEYS = {
  clock:   'wd_clock',
  weather: 'wd_weather',
  pomo:    'wd_pomo',
  notepad: 'wd_notepad',
};

let _settingsActiveTab = 'profile';

// ── Widgets ──
function loadWidgetPrefs() {
  const clock   = localStorage.getItem(WIDGET_KEYS.clock)   !== 'false';
  const weather = localStorage.getItem(WIDGET_KEYS.weather) !== 'false';
  const pomo    = localStorage.getItem(WIDGET_KEYS.pomo)    === 'true';
  const notepad = localStorage.getItem(WIDGET_KEYS.notepad) === 'true';
  document.getElementById('toggleClock').checked   = clock;
  document.getElementById('toggleWeather').checked = weather;
  document.getElementById('togglePomo').checked    = pomo;
  document.getElementById('toggleNotepad').checked = notepad;
  setWidgetVisible('clockWrap',   clock);
  setWidgetVisible('weatherWrap', weather);
  setWidgetVisible('pomoFloat',   pomo);
  setWidgetVisible('noteFloat',   notepad);
}

function applyWidgets() {
  const clock   = document.getElementById('toggleClock').checked;
  const weather = document.getElementById('toggleWeather').checked;
  const pomo    = document.getElementById('togglePomo').checked;
  const notepad = document.getElementById('toggleNotepad').checked;
  localStorage.setItem(WIDGET_KEYS.clock,   clock);
  localStorage.setItem(WIDGET_KEYS.weather, weather);
  localStorage.setItem(WIDGET_KEYS.pomo,    pomo);
  localStorage.setItem(WIDGET_KEYS.notepad, notepad);
  setWidgetVisible('clockWrap',   clock);
  setWidgetVisible('weatherWrap', weather);
  setWidgetVisible('pomoFloat',   pomo);
  setWidgetVisible('noteFloat',   notepad);
}

function setWidgetVisible(id, visible) {
  const el = document.getElementById(id);
  if (!el) return;
  el.style.transition    = 'opacity 0.2s ease';
  el.style.opacity       = visible ? '1' : '0';
  el.style.pointerEvents = visible ? '' : 'none';
  setTimeout(() => { if (!visible) el.style.display = 'none'; else el.style.display = ''; }, visible ? 0 : 200);
}

// ── Panel open/close ──
function openSettingsPanel(tab) {
  tab = tab || 'profile';
  switchSettingsTab(tab);

  const user = firebase.auth().currentUser;
  if (user) {
    document.getElementById('settingsName').textContent  = user.displayName || 'user';
    document.getElementById('settingsEmail').textContent = user.email || '';
    document.getElementById('settingsDisplayName').value = user.displayName || '';
    const prov = user.providerData?.[0]?.providerId || 'anonymous';
    document.getElementById('settingsProvider').textContent =
      prov === 'google.com' ? 'google' : prov === 'password' ? 'email' : 'guest';
    const avatarEl = document.getElementById('settingsAvatar');
    if (user.photoURL) {
      avatarEl.innerHTML = `<img src="${user.photoURL}" alt="avatar"/>`;
    } else {
      avatarEl.style.background = getComputedStyle(document.documentElement).getPropertyValue('--claude').trim();
      avatarEl.textContent = (user.displayName || 'U')[0].toUpperCase();
    }
  }
  syncSettingsUI();
  document.getElementById('settingsBackdrop').classList.add('open');
}

function closeSettings() {
  document.getElementById('settingsBackdrop').classList.remove('open');
}

function handleSettingsBackdrop(e) {
  if (e.target === document.getElementById('settingsBackdrop')) closeSettings();
}

function switchSettingsTab(tab) {
  _settingsActiveTab = tab;
  document.querySelectorAll('.settings-nav-item').forEach(el =>
    el.classList.toggle('active', el.id === 'snav-' + tab)
  );
  document.querySelectorAll('.settings-section').forEach(el =>
    el.classList.toggle('active', el.id === 'stab-' + tab)
  );
}

function openWidgets() { closeUserMenu(); openSettingsPanel('widgets'); }

function renderScheduleSettingsTab() {
  const startHour = getSchedStartHour();
  const endHour   = getSchedEndHour();
  const repeat    = getSchedRepeat();
 
  const startEl  = document.getElementById('schedStartHour');
  const endEl    = document.getElementById('schedEndHour');
  const repeatEl = document.getElementById('schedRepeatToggle');
  if (!startEl || !endEl || !repeatEl) return;
 
  // Build hour options (0–23)
  const opts = Array.from({ length: 24 }, (_, h) =>
    `<option value="${h}">${String(h).padStart(2,'0')}:00</option>`
  ).join('');
 
  if (!startEl.options.length) startEl.innerHTML = opts;
  if (!endEl.options.length)   endEl.innerHTML   = opts;
 
  startEl.value    = startHour;
  endEl.value      = endHour;
  repeatEl.checked = repeat;
}
 
function onSchedSettingChange() {
  const startEl  = document.getElementById('schedStartHour');
  const endEl    = document.getElementById('schedEndHour');
  const repeatEl = document.getElementById('schedRepeatToggle');
  if (!startEl || !endEl || !repeatEl) return;
 
  const startHour    = parseInt(startEl.value);
  const endHour      = parseInt(endEl.value);
  const repeatWeekly = repeatEl.checked;
 
  // Validate range — end must be at least 1 hour after start
  if (endHour <= startHour) {
    endEl.style.borderColor = 'var(--red, #FF7B72)';
    setTimeout(() => endEl.style.borderColor = '', 800);
    return;
  }
 
  saveSchedSettings({ startHour, endHour, repeatWeekly });
 
  // Live-update the schedule if it's currently open
  const sv = document.getElementById('scheduleView');
  if (sv && sv.style.display !== 'none') {
    renderSchedule();
    setTimeout(schedScrollToStart, 80);
  }
}

// ── Sync UI to stored prefs ──
function syncSettingsUI() {
  const theme = localStorage.getItem('settings_theme') || 'dark';
  document.querySelectorAll('.theme-card').forEach(c => c.classList.remove('active'));
  document.getElementById('theme-card-' + theme)?.classList.add('active');

  const currentAccent = localStorage.getItem('settings_accent') || '#DA7756';
  document.getElementById('accentSwatches').innerHTML = ACCENT_COLORS.map(c => `
    <div class="color-swatch ${c.hex === currentAccent ? 'active' : ''}"
      style="background:${c.hex}" onclick="setAccentColor('${c.hex}')" title="${c.name}"></div>
  `).join('');

  const fs = localStorage.getItem('settings_font_size') || 'md';
  ['sm', 'md', 'lg'].forEach(s => document.getElementById('fs-' + s)?.classList.toggle('active', s === fs));

  const den = localStorage.getItem('settings_density') || 'comfortable';
  ['compact', 'comfortable'].forEach(d => document.getElementById('density-' + d)?.classList.toggle('active', d === den));

  const dv = localStorage.getItem('settings_default_view') || 'list';
  ['list', 'kanban'].forEach(v => document.getElementById('dv-' + v)?.classList.toggle('active', v === dv));

  const ps = parseInt(localStorage.getItem('settings_page_size') || '8');
  [4, 8, 12, 16].forEach(n => document.getElementById('ps-' + n)?.classList.toggle('active', n === ps));

  const dt = localStorage.getItem('settings_default_tag') || '';
  ['', 'work', 'personal', 'health'].forEach(t =>
    document.getElementById('dt-' + (t || 'none'))?.classList.toggle('active', t === dt)
  );

  renderScheduleSettingsTab()
  renderLabelsManager();
}

// ── Appearance ──
function setAccentColor(hex) { localStorage.setItem('settings_accent', hex); applyAccentColor(hex); syncSettingsUI(); }

function applyAccentColor(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  document.documentElement.style.setProperty('--claude',        hex);
  document.documentElement.style.setProperty('--claude-dim',    `rgba(${r},${g},${b},0.15)`);
  document.documentElement.style.setProperty('--claude-border', `rgba(${r},${g},${b},0.45)`);
  document.documentElement.style.setProperty('--claude-glow',   `rgba(${r},${g},${b},0.18)`);
  document.documentElement.style.setProperty('--claude-glow2',  `rgba(${r},${g},${b},0.13)`);
  SEG_ON   = hex;
  SEG_GLOW = `drop-shadow(0 0 4px rgba(${r},${g},${b},0.8))`;
  renderAsciiClock();
  updatePomoDisplay();
  document.querySelectorAll('canvas[data-icon]').forEach(c => drawWeatherDots(c, c.dataset.icon));
  document.querySelectorAll('.pomo-session-dot.done').forEach(dot => {
    dot.style.boxShadow = `0 0 6px rgba(${r},${g},${b},0.55)`;
  });
}

function setTheme(theme) { localStorage.setItem('settings_theme', theme); applyTheme(theme); syncSettingsUI(); }

function applyTheme(theme) {
  document.body.classList.remove('theme-light', 'theme-dark');
  if (theme === 'light') document.body.classList.add('theme-light');
  renderAsciiClock();
  updatePomoDisplay();
  document.querySelectorAll('canvas[data-icon]').forEach(c => drawWeatherDots(c, c.dataset.icon));
}

function setFontSize(size)  { localStorage.setItem('settings_font_size', size);  applyFontSize(size);  syncSettingsUI(); }
function applyFontSize(size) { document.body.classList.remove('font-sm', 'font-md', 'font-lg'); document.body.classList.add('font-' + size); }

function setDensity(den)    { localStorage.setItem('settings_density', den);     applyDensity(den);    syncSettingsUI(); }
function applyDensity(den)  { document.body.classList.remove('density-compact', 'density-comfortable'); document.body.classList.add('density-' + den); }

function setDefaultView(view)  { localStorage.setItem('settings_default_view', view); syncSettingsUI(); }

function setPageSize(n) {
  localStorage.setItem('settings_page_size', n);
  PAGE_SIZE_current = n; currentPage = 1;
  renderTasks(); syncSettingsUI();
}

function setDefaultTag(tag) {
  localStorage.setItem('settings_default_tag', tag);
  selectedTag = (tag && isTagEnabled(tag)) ? tag : null;
  renderTagButtons(); syncSettingsUI();
}

function saveDisplayName() {
  const val  = document.getElementById('settingsDisplayName').value.trim();
  if (!val) return;
  const user = firebase.auth().currentUser;
  if (!user) return;
  user.updateProfile({ displayName: val }).then(() => {
    document.getElementById('settingsName').textContent = val;
    document.getElementById('userName').textContent     = val.split(' ')[0];
  });
}

// ── Load & apply all settings on boot ──
function loadAndApplySettings() {
  const accent = localStorage.getItem('settings_accent');
  if (accent) applyAccentColor(accent);
  applyFontSize(localStorage.getItem('settings_font_size') || 'md');
  applyDensity(localStorage.getItem('settings_density')    || 'comfortable');
  applyTheme(localStorage.getItem('settings_theme')        || 'dark');
  const dv = localStorage.getItem('settings_default_view');
  if (dv && dv !== currentView) switchView(dv);
  PAGE_SIZE_current = parseInt(localStorage.getItem('settings_page_size') || '8');
}

document.addEventListener('DOMContentLoaded', () => { loadWidgetPrefs(); loadAndApplySettings(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeSettings(); });