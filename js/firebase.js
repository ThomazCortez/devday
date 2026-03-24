// ── Firebase Config & DB Helpers ──

const POMO_POS_KEY = 'devday_pomo_pos';
const NOTE_POS_KEY = 'devday_note_pos';
emailjs.init(CONFIG.emailjs_public_key);

const _firebaseConfig = {
  apiKey:            'AIzaSyCha8LZ-7nbpF5IFwZj7SOxPe1H_l8ZAU0',
  authDomain:        'devdaydb.firebaseapp.com',
  databaseURL:       'https://devdaydb-default-rtdb.europe-west1.firebasedatabase.app',
  projectId:         'devdaydb',
  storageBucket:     'devdaydb.firebasestorage.app',
  messagingSenderId: '492517359800',
  appId:             '1:492517359800:web:6f06865884a39c416ef44d',
};

firebase.initializeApp(_firebaseConfig);
const _db   = firebase.database();
const _auth = firebase.auth();

let _userRef        = null;
let _activeListener = null;
const _deletingIds  = new Set();

// ── Utility ───────────────────────────────────────────────────────────────────

function _fbToArray(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val.filter(v => v != null);
  return Object.values(val);
}

// ── Tasks (stored at _userRef/tasks) ──────────────────────────────────────────

function dbSave(tasks) {
  if (_userRef) _userRef.child('tasks').set(tasks);
}

function dbListen(cb) {
  if (_activeListener && _userRef) {
    _userRef.child('tasks').off('value', _activeListener);
  }
  _activeListener = _userRef.child('tasks').on('value', snap => {
    cb(_fbToArray(snap.val()));
  });
}

function dbDetach() {
  if (_activeListener && _userRef) {
    _userRef.child('tasks').off('value', _activeListener);
    _activeListener = null;
  }
  _userRef = null;
}

// ── Schedule data ─────────────────────────────────────────────────────────────

let _schedCache            = {};
let _schedTemplateCache    = {};
let _schedDataListener     = null;
let _schedTemplateListener = null;

function dbSaveScheduleData(data) {
  if (_userRef) _userRef.child('scheduleData').set(data);
}

function dbSaveScheduleTemplate(template) {
  if (_userRef) _userRef.child('scheduleTemplate').set(template);
}

function dbListenSchedule() {
  if (!_userRef) return;

  if (_schedDataListener) _userRef.child('scheduleData').off('value', _schedDataListener);
  _schedDataListener = _userRef.child('scheduleData').on('value', snap => {
    const raw = snap.val() || {};
    _schedCache = {};
    Object.entries(raw).forEach(([k, v]) => { _schedCache[k] = _fbToArray(v); });
    if (_isScheduleVisible()) renderScheduleBlocks();
  });

  if (_schedTemplateListener) _userRef.child('scheduleTemplate').off('value', _schedTemplateListener);
  _schedTemplateListener = _userRef.child('scheduleTemplate').on('value', snap => {
    const raw = snap.val() || {};
    _schedTemplateCache = {};
    Object.entries(raw).forEach(([k, v]) => { _schedTemplateCache[k] = _fbToArray(v); });
    if (_isScheduleVisible()) renderScheduleBlocks();
  });
}

function dbDetachSchedule() {
  if (_schedDataListener && _userRef) {
    _userRef.child('scheduleData').off('value', _schedDataListener);
    _schedDataListener = null;
  }
  if (_schedTemplateListener && _userRef) {
    _userRef.child('scheduleTemplate').off('value', _schedTemplateListener);
    _schedTemplateListener = null;
  }
}

// ── Schedule settings ─────────────────────────────────────────────────────────

let _schedSettingsCache    = {};
let _schedSettingsListener = null;

function dbSaveSchedSettings(settings) {
  if (_userRef) _userRef.child('scheduleSettings').set(settings);
}

function dbListenSchedSettings() {
  if (!_userRef) return;
  if (_schedSettingsListener) _userRef.child('scheduleSettings').off('value', _schedSettingsListener);
  _schedSettingsListener = _userRef.child('scheduleSettings').on('value', snap => {
    _schedSettingsCache = snap.val() || {};
    renderScheduleSettingsTab();
    if (_isScheduleVisible()) {
      renderSchedule();
      setTimeout(schedScrollToStart, 80);
    }
  });
}

function dbDetachSchedSettings() {
  if (_schedSettingsListener && _userRef) {
    _userRef.child('scheduleSettings').off('value', _schedSettingsListener);
    _schedSettingsListener = null;
  }
}

// ── Streak data ───────────────────────────────────────────────────────────────

const _streakDefault = { currentStreak: 0, longestStreak: 0, lastCompletedDate: null, completedDates: [] };
let _streakCache        = { ..._streakDefault };
let _streakDataListener = null;

function dbSaveStreakData(data) {
  if (_userRef) _userRef.child('streakData').set(data);
}

function dbListenStreakData() {
  if (!_userRef) return;
  if (_streakDataListener) _userRef.child('streakData').off('value', _streakDataListener);
  _streakDataListener = _userRef.child('streakData').on('value', snap => {
    _streakCache = snap.val() || { ..._streakDefault };
    if (_streakCache.completedDates && !Array.isArray(_streakCache.completedDates)) {
      _streakCache.completedDates = Object.values(_streakCache.completedDates);
    }
    _streakCache.completedDates = _streakCache.completedDates || [];
  });
}

function dbDetachStreakData() {
  if (_streakDataListener && _userRef) {
    _userRef.child('streakData').off('value', _streakDataListener);
    _streakDataListener = null;
  }
}

// ── Completed history ─────────────────────────────────────────────────────────

let _historyCache    = [];
let _historyListener = null;

function dbSaveHistory(history) {
  if (_userRef) _userRef.child('completedHistory').set(history);
}

function dbListenHistory() {
  if (!_userRef) return;
  if (_historyListener) _userRef.child('completedHistory').off('value', _historyListener);
  _historyListener = _userRef.child('completedHistory').on('value', snap => {
    _historyCache = _fbToArray(snap.val());
    const sv = document.getElementById('statsView');
    if (sv && sv.style.display !== 'none') renderStats();
  });
}

function dbDetachHistory() {
  if (_historyListener && _userRef) {
    _userRef.child('completedHistory').off('value', _historyListener);
    _historyListener = null;
  }
}

// ── App settings (stored at _userRef/settings) ────────────────────────────────
// Covers: accent, theme, font size, density, default view, page size,
//         default tag, and widget visibility toggles.

const _settingsLocalKeys = [
  'settings_accent', 'settings_theme', 'settings_font_size',
  'settings_density', 'settings_default_view', 'settings_page_size',
  'settings_default_tag',
  'wd_clock', 'wd_weather', 'wd_pomo', 'wd_notepad',
];

let _settingsCache    = {};
let _settingsListener = null;

// Read a single setting — falls back to a default if not set
function getSetting(key, fallback = null) {
  return _settingsCache[key] !== undefined ? _settingsCache[key] : fallback;
}

// Write one or more settings and persist to Firebase
function saveSettings(patch) {
  _settingsCache = { ..._settingsCache, ...patch };
  if (_userRef) _userRef.child('settings').set(_settingsCache);
}

function dbListenSettings() {
  if (!_userRef) return;
  if (_settingsListener) _userRef.child('settings').off('value', _settingsListener);

  _settingsListener = _userRef.child('settings').on('value', snap => {
    const remote = snap.val();

    if (!remote) {
      // First sign-in on this account — migrate any existing localStorage prefs
      const migrated = {};
      _settingsLocalKeys.forEach(k => {
        const v = localStorage.getItem(k);
        if (v !== null) migrated[k] = v;
      });
      if (Object.keys(migrated).length) {
        // Save migrated values; listener will fire again with the saved data
        saveSettings(migrated);
        return;
      }
    }

    _settingsCache = remote || {};
    // Apply to UI immediately (covers other devices / tabs)
    applyAllSettings();
    syncSettingsUI();
  });
}

function dbDetachSettings() {
  if (_settingsListener && _userRef) {
    _userRef.child('settings').off('value', _settingsListener);
    _settingsListener = null;
  }
}

// ── Start all listeners ───────────────────────────────────────────────────────

function initScheduleSync() {
  dbListenSchedule();
  dbListenSchedSettings();
}

function initStatsSync() {
  dbListenStreakData();
  dbListenHistory();
}

function initSettingsSync() {
  dbListenSettings();
}

// ── Tear down everything on sign-out ─────────────────────────────────────────

function dbDetachAll() {
  dbDetach();
  dbDetachSchedule();
  dbDetachSchedSettings();
  dbDetachStreakData();
  dbDetachHistory();
  dbDetachSettings();
  // Reset caches so a re-login starts clean
  _settingsCache      = {};
  _schedSettingsCache = {};
  _streakCache        = { ..._streakDefault };
  _historyCache       = [];
  _schedCache         = {};
  _schedTemplateCache = {};
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function _isScheduleVisible() {
  const sv = document.getElementById('scheduleView');
  return sv && sv.style.display !== 'none';
}