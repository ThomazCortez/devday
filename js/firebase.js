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

// ── Utility ────────────────────────────────────────────────────────────────────

// Firebase stores arrays as objects with integer keys when they contain gaps
// or after certain operations. Always normalise back to a plain array.
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

// ── Schedule data (stored at _userRef/scheduleData and _userRef/scheduleTemplate) ──

// In-memory caches — kept in sync by Firebase listeners.
let _schedCache         = {};  // { 'yyyy-mm-dd': [blocks…] }   (non-repeat mode)
let _schedTemplateCache = {};  // { '0': [blocks…], … }          (repeat mode, Mon=0…Sun=6)

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

  // Non-repeat schedule data
  if (_schedDataListener) _userRef.child('scheduleData').off('value', _schedDataListener);
  _schedDataListener = _userRef.child('scheduleData').on('value', snap => {
    const raw = snap.val() || {};
    // Normalise any Firebase-ified arrays back to plain arrays
    _schedCache = {};
    Object.entries(raw).forEach(([k, v]) => { _schedCache[k] = _fbToArray(v); });
    if (_isScheduleVisible()) renderScheduleBlocks();
  });

  // Repeat template
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

// ── Schedule settings (stored at _userRef/scheduleSettings) ───────────────────

let _schedSettingsCache = {};  // { startHour, endHour, repeatWeekly }

let _schedSettingsListener = null;

function dbSaveSchedSettings(settings) {
  if (_userRef) _userRef.child('scheduleSettings').set(settings);
}

function dbListenSchedSettings() {
  if (!_userRef) return;
  if (_schedSettingsListener) _userRef.child('scheduleSettings').off('value', _schedSettingsListener);
  _schedSettingsListener = _userRef.child('scheduleSettings').on('value', snap => {
    _schedSettingsCache = snap.val() || {};
    renderScheduleSettingsTab();            // keep settings UI in sync on all tabs/devices
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

// ── Start all schedule listeners (call this right after _userRef is set) ──────

function initScheduleSync() {
  dbListenSchedule();
  dbListenSchedSettings();
}

// ── Tear down everything (call on sign-out) ────────────────────────────────────

function dbDetachAll() {
  dbDetach();
  dbDetachSchedule();
  dbDetachSchedSettings();
}

// ── Helper used by schedule.js ────────────────────────────────────────────────

function _isScheduleVisible() {
  const sv = document.getElementById('scheduleView');
  return sv && sv.style.display !== 'none';
}