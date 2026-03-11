// ── Firebase Config & DB Helpers ──

const POMO_POS_KEY = 'devday_pomo_pos';
const NOTE_POS_KEY = 'devday_note_pos';

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

function dbSave(tasks) {
  if (_userRef) _userRef.set(tasks);
}

function dbListen(cb) {
  if (_activeListener && _userRef) _userRef.off('value', _activeListener);
  _activeListener = _userRef.on('value', snap => {
    const val = snap.val();
    cb(Array.isArray(val) ? val : val ? Object.values(val) : []);
  });
}

function dbDetach() {
  if (_activeListener && _userRef) {
    _userRef.off('value', _activeListener);
    _activeListener = null;
  }
  _userRef = null;
}