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
  dbDetach();
  tasks = [];
  _auth.signOut().then(() => { window.location.href = 'login.html'; });
}

// ── Auth State Observer ──
_auth.onAuthStateChanged(user => {
  if (user) {
    _userRef = _db.ref('users/' + user.uid + '/tasks');

    const isNewUser = user.metadata.creationTime === user.metadata.lastSignInTime;
    if (isNewUser && user.email) {
      emailjs.send(CONFIG.emailjs_service_id, CONFIG.emailjs_template_id, {
        to_email: user.email,
        to_name:  user.displayName?.split(' ')[0] || 'there',
      }).catch(err => console.warn('welcome email failed:', err));
    }

    init();
  } else {
    window.location.href = 'login.html';
  }
});