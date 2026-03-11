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

    const pill     = document.getElementById('userPill');
    const nameEl   = document.getElementById('userName');
    const avatarEl = document.getElementById('userAvatar');
    const emailEl  = document.getElementById('dropdownEmail');

    pill.style.display = 'block';
    nameEl.textContent = user.displayName?.split(' ')[0] || 'user';
    if (emailEl) emailEl.textContent = user.email || user.displayName || 'guest';

    if (user.photoURL) {
      avatarEl.innerHTML = `<img src="${user.photoURL}" alt="avatar"/>`;
    } else {
      avatarEl.textContent = (user.displayName || 'U')[0].toUpperCase();
    }

    init();
  } else {
    window.location.href = 'login.html';
  }
});