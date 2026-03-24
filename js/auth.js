// ── Auth & User Menu ──

function toggleUserMenu() {
  const pill = document.getElementById('userPillBtn');
  const dd   = document.getElementById('userDropdown');
  const open = dd.classList.toggle('open');
  pill.classList.toggle('open', open);
}

function openSettings() { closeUserMenu(); openSettingsPanel(); }

function closeUserMenu() {
  document.getElementById('userDropdown')?.classList.remove('open');
  document.getElementById('userPillBtn')?.classList.remove('open');
}

// Close dropdown on outside click
document.addEventListener('click', e => {
  if (!document.getElementById('userPill')?.contains(e.target)) closeUserMenu();
});

function signOut() {
  closeUserMenu();
  dbDetachAll(); // tears down tasks + schedule + settings listeners
  tasks = [];
  _auth.signOut().then(() => { window.location.href = 'login.html'; });
}

// ── Auth State Observer ──
_auth.onAuthStateChanged(user => {
  if (user) {
    // Point to user root so db.js can attach child paths for tasks, schedule, etc.
    _userRef = _db.ref('users/' + user.uid);

    // ── Show & populate user pill ──
    const pill           = document.getElementById('userPill');
    const avatar         = document.getElementById('userAvatar');
    const nameEl         = document.getElementById('userName');
    const dropEmail      = document.getElementById('dropdownEmail');
    const settingsAvatar = document.getElementById('settingsAvatar');
    const settingsName   = document.getElementById('settingsName');
    const settingsEmail  = document.getElementById('settingsEmail');

    const displayName = user.displayName || user.email?.split('@')[0] || 'user';
    const initials    = displayName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

    nameEl.textContent         = displayName.split(' ')[0];
    avatar.textContent         = initials;
    dropEmail.textContent      = '// ' + (user.email || 'user');
    settingsName.textContent   = displayName;
    settingsEmail.textContent  = user.email || '';
    settingsAvatar.textContent = initials;

    pill.style.display = 'flex';

    // ── Welcome email for new users ──
    const isNewUser = user.metadata.creationTime === user.metadata.lastSignInTime;
    if (isNewUser && user.email) {
      emailjs.send(CONFIG.emailjs_service_id, CONFIG.emailjs_template_id, {
        to_email: user.email,
        to_name:  user.displayName?.split(' ')[0] || 'there',
      }).catch(err => console.warn('welcome email failed:', err));
    }

    // ── Start schedule + settings Firebase listeners ──
    initScheduleSync();

    init();
  } else {
    window.location.href = 'login.html';
  }
});