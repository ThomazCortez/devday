// ── App Init ──

function setDate() {
  const now    = new Date();
  const days   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  document.getElementById('metaDate').textContent = `${months[now.getMonth()]} ${now.getDate()}, ${now.getFullYear()}`;
  document.getElementById('metaDay').textContent  = days[now.getDay()];
  document.getElementById('bcDate').textContent   = `${months[now.getMonth()]}-${String(now.getDate()).padStart(2, '0')}`;
}

function toggleSidebar() {
  document.querySelector('.sidebar').classList.toggle('open');
  document.getElementById('sidebarOverlay').classList.toggle('open');
}

function init() {
  setDate();
  startClock();
  fetchWeather();
  initPomo();
  initNotepad();
  loadPomoState();
  loadNoteState();

  // Apply default tag from settings
  const defaultTag = localStorage.getItem('settings_default_tag');
  if (defaultTag && isTagEnabled(defaultTag)) {
    selectedTag = defaultTag;
  } else {
    selectedTag = null;
  }
  renderTagButtons();
  renderSidebarLabels();

  document.getElementById('taskInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') addTask();
  });
  
  let _initialized = false;

  dbListen(remote => {
    if (_editingNote) return;
    if (_deletingIds.size > 0) return;
    tasks = normalizeTasks(remote);

    if (!_initialized) {
      _initialized = true;
      resetRecurringTasks(); // runs after tasks are actually loaded
    }

    renderTasks();
    if (currentView === 'kanban') renderKanban();
    updateCounts();
    renderSidebarLabels();

    // Keep stats view in sync whenever tasks change
    const _sv = document.getElementById('statsView');
    if (_sv && _sv.style.display !== 'none') renderStats();
  });
}