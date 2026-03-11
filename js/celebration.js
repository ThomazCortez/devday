// ── Celebration Overlay ──

const CELEBRATIONS = [
  { ascii: " \\o/\n  |\n / \\",        title: "Task <span>crushed!</span>",  msg: "You're on fire 🔥\nTake a deep breath and enjoy\nthe moment — you earned it." },
  { ascii: "(^_^)\n /||\\\n  /\\",    title: "That's a <span>W!</span>",    msg: "Seriously, great work.\nMaybe grab a coffee ☕\nor stretch for 2 minutes?" },
  { ascii: " ★ ★ ★\n\\(•‿•)/\n _|_|_", title: "<span>Ship</span>ped!",     msg: "One step closer to done.\nYou're building momentum —\nkeep that energy going 💪" },
  { ascii: "d(^_^)b\n  ||||\n  d  b",  title: "<span>Boom.</span> Done.",   msg: "Locked in and delivering.\nGo hydrate 💧 — your brain\ndeserves it after that focus." },
  { ascii: "\\(^o^)/\n  _|_\n  / \\",  title: "Level <span>up!</span>",     msg: "Every task done is progress.\nTreat yourself — even 5 mins\nof something you love counts 🎮" },
  { ascii: " .+*+.\n(>‿<)\n /|\\",    title: "<span>Clean</span> commit!", msg: "git commit -m 'nailed it'\nTake a little break, breathe,\nyou're doing amazing 🌟" },
];

function showCelebration(taskText) {
  const c           = CELEBRATIONS[Math.floor(Math.random() * CELEBRATIONS.length)];
  const cleanedAscii = c.ascii.split('\n').map(line => line.replace(/\s+$/, '')).join('\n');
  document.getElementById('celebrateAscii').textContent  = cleanedAscii;
  document.getElementById('celebrateTitle').innerHTML    = c.title;
  document.getElementById('celebrateMsg').innerHTML      = c.msg.replace(/\n/g, '<br>');
  document.getElementById('celebrateTask').innerHTML     = `✓ <span>"${escHtml(taskText)}"</span>`;
  document.getElementById('celebrateOverlay').classList.add('show');

  const card   = document.getElementById('celebrateCard');
  const colors = ['#DA7756', '#3FB950', '#58A6FF', '#BC8CFF', '#E3B341'];
  for (let i = 0; i < 12; i++) {
    const dot = document.createElement('div');
    dot.className = 'confetti-dot';
    dot.style.cssText = `left:${20 + Math.random() * 60}%;top:${10 + Math.random() * 30}%;` +
      `background:${colors[i % colors.length]};` +
      `animation-delay:${Math.random() * 0.4}s;` +
      `animation-duration:${0.7 + Math.random() * 0.5}s;`;
    card.appendChild(dot);
    setTimeout(() => dot.remove(), 1500);
  }
}

function closeCelebration(e) {
  if (e && e.target !== document.getElementById('celebrateOverlay')) return;
  document.getElementById('celebrateOverlay').classList.remove('show');
}