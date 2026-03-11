// ── Due Date Calendar ──

let calYear  = 0;
let calMonth = 0;

function setDue(iso) {
  selectedDue = iso || null;
  const btn = document.getElementById('dueBtnDisplay');
  const lbl = document.getElementById('dueBtnLabel');
  if (iso) { btn.classList.add('has-date'); lbl.textContent = fmtDate(iso); }
  else     { btn.classList.remove('has-date'); lbl.textContent = 'due date'; }
}

function clearDue() { setDue(null); closeCalendar(); }

function toggleCalendar() {
  const pop = document.getElementById('calPopup');
  if (pop.classList.contains('open')) { closeCalendar(); return; }

  const now = new Date();
  calYear  = now.getFullYear();
  calMonth = now.getMonth();
  if (selectedDue) {
    const [y, m] = selectedDue.split('-');
    calYear  = +y;
    calMonth = +m - 1;
  }
  renderCalendar();

  const btn  = document.getElementById('dueBtnDisplay');
  const rect = btn.getBoundingClientRect();
  pop.style.display = 'block';
  const popH = pop.offsetHeight;
  pop.style.display = '';
  pop.style.left = rect.left + 'px';
  pop.style.top  = (rect.top - popH - 6) + 'px';
  pop.classList.add('open');
  setTimeout(() => document.addEventListener('mousedown', calOutsideClick), 0);
}

function closeCalendar() {
  document.getElementById('calPopup').classList.remove('open');
  document.removeEventListener('mousedown', calOutsideClick);
}

function calOutsideClick(e) {
  const pop = document.getElementById('calPopup');
  const btn = document.getElementById('dueBtnDisplay');
  if (!pop.contains(e.target) && !btn.contains(e.target)) closeCalendar();
}

function calNav(dir) {
  calMonth += dir;
  if (calMonth > 11) { calMonth = 0;  calYear++; }
  if (calMonth <  0) { calMonth = 11; calYear--; }
  renderCalendar();
}

function renderCalendar() {
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  document.getElementById('calMonthLabel').textContent = `${months[calMonth]} ${calYear}`;

  const today       = todayStr();
  const firstDay    = new Date(calYear, calMonth, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  let html = '';

  for (let i = 0; i < firstDay; i++) html += `<div class="cal-day cal-empty"></div>`;
  for (let d = 1; d <= daysInMonth; d++) {
    const iso    = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const isPast = iso < today, isToday = iso === today, isSel = iso === selectedDue;
    const cls    = ['cal-day', isPast ? 'cal-past' : '', isToday ? 'cal-today' : '', isSel ? 'cal-selected' : ''].join(' ').trim();
    const click  = isPast ? '' : `onclick="pickDay('${iso}')"`;
    html += `<div class="${cls}" ${click}>${d}</div>`;
  }
  document.getElementById('calGrid').innerHTML = html;
}

function pickDay(iso) { setDue(iso); closeCalendar(); }