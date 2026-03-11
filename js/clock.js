// ── Seven-Segment Clock ──

let SEG_ON   = '#DA7756';
let SEG_GLOW = 'drop-shadow(0 0 4px rgba(218,119,86,0.8))';

function getSegOff() {
  return document.body.classList.contains('theme-light') ? '#D8DCE0' : '#1C1009';
}

const SEG_MAP = {
  '0': [1,1,1,1,1,1,0], '1': [0,1,1,0,0,0,0], '2': [1,1,0,1,1,0,1],
  '3': [1,1,1,1,0,0,1], '4': [0,1,1,0,0,1,1], '5': [1,0,1,1,0,1,1],
  '6': [1,0,1,1,1,1,1], '7': [1,1,1,0,0,0,0], '8': [1,1,1,1,1,1,1], '9': [1,1,1,1,0,1,1],
};

function digitSVG(ch) {
  const s = SEG_MAP[ch] || [0,0,0,0,0,0,0];
  const c = i => s[i] ? SEG_ON : getSegOff();
  const f = s.some(x => x) ? `filter="${SEG_GLOW}"` : '';
  return `<svg width="26" height="44" viewBox="0 0 20 38" xmlns="http://www.w3.org/2000/svg" ${f}>
    <polygon points="3,1 17,1 15,4 5,4"     fill="${c(0)}"/>
    <polygon points="18,2 18,17 15,15 15,5"  fill="${c(1)}"/>
    <polygon points="18,21 18,36 15,33 15,23" fill="${c(2)}"/>
    <polygon points="3,37 17,37 15,34 5,34"  fill="${c(3)}"/>
    <polygon points="2,21 2,36 5,33 5,23"    fill="${c(4)}"/>
    <polygon points="2,2 2,17 5,15 5,5"      fill="${c(5)}"/>
    <polygon points="3,19 5,16 15,16 17,19 15,22 5,22" fill="${c(6)}"/>
  </svg>`;
}

function colonSVG(lit) {
  const col = lit ? SEG_ON : getSegOff();
  const f   = lit ? `filter="${SEG_GLOW}"` : '';
  return `<svg width="14" height="44" viewBox="0 0 10 38" xmlns="http://www.w3.org/2000/svg" ${f}>
    <circle cx="5" cy="12" r="2.8" fill="${col}"/>
    <circle cx="5" cy="26" r="2.8" fill="${col}"/>
  </svg>`;
}

function renderAsciiClock() {
  const now = new Date();
  const h = String(now.getHours()).padStart(2, '0');
  const m = String(now.getMinutes()).padStart(2, '0');
  document.getElementById('segClock').innerHTML =
    digitSVG(h[0]) + digitSVG(h[1]) + colonSVG(now.getSeconds() % 2 === 0) + digitSVG(m[0]) + digitSVG(m[1]);
  document.getElementById('statusTime').textContent = `${h}:${m}`;
}

function startClock() {
  renderAsciiClock();
  setInterval(renderAsciiClock, 1000);
}