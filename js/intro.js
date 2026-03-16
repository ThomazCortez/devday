// ── Boot Intro Animation ──

const INTRO_COOLDOWN_MS = 30 * 60 * 1000;

function shouldShowIntro() {
  const last = localStorage.getItem('devday-last-visit');
  const now  = Date.now();
  localStorage.setItem('devday-last-visit', now);
  return !last || (now - parseInt(last)) > INTRO_COOLDOWN_MS;
}

const INTRO_LINES = [
  { text: `<span class="kw">import</span> { focus, clarity, flow } <span class="kw">from</span> <span class="str">'devday'</span>`, delay: 0 },
  { text: ``, delay: 180 },
  { text: `<span class="cmt">// initializing your productivity environment...</span>`, delay: 240 },
  { text: `<span class="kw">const</span> day <span class="op">=</span> <span class="kw">new</span> <span class="cls">Day</span><span class="op">(</span>{ mode: <span class="str">'focused'</span>, distractions: <span class="num">0</span> }<span class="op">)</span>`, delay: 460 },
  { text: ``, delay: 640 },
  { text: `<span class="fn">day</span><span class="op">.</span><span class="fn">tasks</span><span class="op">.</span><span class="fn">load</span><span class="op">()</span>        <span class="cmt">// ✓ synced from firebase</span>`, delay: 720 },
  { text: `<span class="fn">day</span><span class="op">.</span><span class="fn">weather</span><span class="op">.</span><span class="fn">fetch</span><span class="op">()</span>      <span class="cmt">// ✓ connected to open-meteo</span>`, delay: 940 },
  { text: `<span class="fn">day</span><span class="op">.</span><span class="fn">clock</span><span class="op">.</span><span class="fn">start</span><span class="op">()</span>        <span class="cmt">// ✓ ticking</span>`, delay: 1160 },
  { text: ``, delay: 1340 },
  { text: `<span class="kw">export default</span> <span class="acc">devday</span>   <span class="cmt">// ready. let's get it.</span>`, delay: 1420 },
];

const TAGLINES = [
  'ship more. stress less.',
  'your day, version controlled.',
  'commit to your goals.',
  'focus mode: engaged.',
  'build the day you want.',
];

const INTRO_LINES_MOBILE = [
  { text: `<span class="kw">import</span> { focus, flow } <span class="kw">from</span> <span class="str">'devday'</span>`, delay: 0 },
  { text: ``, delay: 180 },
  { text: `<span class="cmt">// booting your day...</span>`, delay: 240 },
  { text: `<span class="fn">tasks</span><span class="op">.</span><span class="fn">load</span><span class="op">()</span>    <span class="cmt">// ✓ firebase</span>`, delay: 460 },
  { text: `<span class="fn">weather</span><span class="op">.</span><span class="fn">fetch</span><span class="op">()</span>  <span class="cmt">// ✓ live</span>`, delay: 660 },
  { text: `<span class="fn">clock</span><span class="op">.</span><span class="fn">start</span><span class="op">()</span>   <span class="cmt">// ✓ ticking</span>`, delay: 860 },
  { text: ``, delay: 1000 },
  { text: `<span class="acc">devday</span> <span class="cmt">// ready. let's get it.</span><span class="intro-cursor"></span>`, delay: 1080 },
];

function runIntro() {
  const container = document.getElementById('introCode');
  const loader    = document.getElementById('introLoader');
  const tagline   = document.getElementById('introTagline');
  const screen    = document.getElementById('introScreen');

  const isMobile = window.innerWidth <= 480;
  const lines    = isMobile ? INTRO_LINES_MOBILE : INTRO_LINES;

  tagline.textContent = TAGLINES[Math.floor(Math.random() * TAGLINES.length)];

  lines.forEach((l, i) => {
    const row = document.createElement('div');
    row.className = 'intro-line';
    const content = isMobile
      ? `<span>${l.text}</span>`
      : `<span class="intro-lnum">${l.text ? i + 1 : ''}</span><span>${l.text}${i === lines.length - 1 ? '<span class="intro-cursor"></span>' : ''}</span>`;
    row.innerHTML = content;
    container.appendChild(row);
  });

  lines.forEach((l, i) =>
    setTimeout(() => container.children[i].classList.add('visible'), 300 + l.delay)
  );

  const lastDelay = lines[lines.length - 1].delay;
  setTimeout(() => { loader.style.opacity = '1'; tagline.style.opacity = '1'; }, 300 + lastDelay + 200);
  setTimeout(() => {
    screen.classList.add('fade-out');
    document.getElementById('appWrapper').classList.add('visible');
    setTimeout(() => screen.remove(), 800);
  }, 300 + lastDelay + 1100);
}

if (shouldShowIntro()) {
  runIntro();
} else {
  document.getElementById('introScreen').remove();
  document.getElementById('appWrapper').classList.add('visible');
}