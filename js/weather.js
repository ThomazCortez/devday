// ── Weather Widget ──

const DOT_ICONS = {
  // ☀️ Clean sun: solid center + 4 straight rays + 4 diagonal rays
  clear: [
    [0,0,0,0,1,0,0,0,0],
    [0,1,0,0,1,0,0,1,0],
    [0,0,0,0,0,0,0,0,0],
    [0,0,0,1,1,1,0,0,0],
    [1,1,0,1,1,1,0,1,1],
    [0,0,0,1,1,1,0,0,0],
    [0,0,0,0,0,0,0,0,0],
    [0,1,0,0,1,0,0,1,0],
    [0,0,0,0,1,0,0,0,0],
  ],

  // ⛅ Sun peeking behind a cloud — sun top-right, cloud bottom-left
  partly_cloudy: [
    [0,0,0,0,0,1,0,1,0],
    [0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,1,1,1,0],
    [0,0,1,1,0,0,1,0,1],
    [0,1,1,1,1,1,0,0,0],
    [1,1,1,1,1,1,1,0,0],
    [0,1,1,1,1,1,1,1,0],
    [0,0,1,1,1,1,1,0,0],
    [0,0,0,0,0,0,0,0,0],
  ],

  // ☁️ Puffy cloud centered
  cloudy: [
    [0,0,0,0,0,0,0,0,0],
    [0,0,0,1,1,0,0,0,0],
    [0,0,1,1,1,1,1,0,0],
    [0,1,1,1,1,1,1,1,0],
    [0,1,1,1,1,1,1,1,0],
    [1,1,1,1,1,1,1,1,1],
    [0,1,1,1,1,1,1,1,0],
    [0,0,1,1,1,1,1,0,0],
    [0,0,0,0,0,0,0,0,0],
  ],

  // 🌧️ Cloud top, vertical rain drops below
  rain: [
    [0,0,1,1,1,1,0,0,0],
    [0,1,1,1,1,1,1,0,0],
    [1,1,1,1,1,1,1,1,0],
    [0,1,1,1,1,1,1,1,0],
    [0,0,0,0,0,0,0,0,0],
    [0,1,0,0,1,0,0,1,0],
    [0,1,0,0,1,0,0,1,0],
    [0,0,0,0,0,0,0,0,0],
    [0,0,1,0,0,1,0,0,1],
  ],

  // ❄️ Snowflake: clear 6-point star shape
  snow: [
    [0,0,0,0,1,0,0,0,0],
    [0,1,0,0,1,0,0,1,0],
    [0,0,1,0,1,0,1,0,0],
    [0,0,0,0,0,0,0,0,0],
    [1,1,1,0,0,0,1,1,1],
    [0,0,0,0,0,0,0,0,0],
    [0,0,1,0,1,0,1,0,0],
    [0,1,0,0,1,0,0,1,0],
    [0,0,0,0,1,0,0,0,0],
  ],

  // ⛈️ Cloud + lightning bolt
  storm: [
    [0,0,1,1,1,1,0,0,0],
    [0,1,1,1,1,1,1,0,0],
    [1,1,1,1,1,1,1,1,0],
    [0,1,1,1,1,1,1,1,0],
    [0,0,0,1,1,0,0,0,0],
    [0,0,1,1,0,0,0,0,0],
    [0,0,1,1,1,1,0,0,0],
    [0,0,0,0,1,0,0,0,0],
    [0,0,0,0,1,0,0,0,0],
  ],

  // 🌫️ Three clean horizontal lines
  fog: [
    [0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0],
    [1,1,1,1,1,1,1,1,1],
    [0,0,0,0,0,0,0,0,0],
    [0,1,1,1,1,1,1,1,0],
    [0,0,0,0,0,0,0,0,0],
    [0,0,1,1,1,1,1,0,0],
    [0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0],
  ],
};

function drawWeatherDots(canvasEl, iconKey) {
  canvasEl.dataset.icon = iconKey;
  const grid = DOT_ICONS[iconKey] || DOT_ICONS.clear;
  const ctx  = canvasEl.getContext('2d');
  const size = canvasEl.width;
  const pad  = size * 0.06;
  const cW   = (size - pad * 2) / 9;
  const cH   = (size - pad * 2) / 9;
  const r    = cW * 0.38;
  const accent = getComputedStyle(document.documentElement).getPropertyValue('--claude').trim();

  ctx.clearRect(0, 0, size, size);
  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      const on = grid[row][col] === 1;
      ctx.beginPath();
      ctx.arc(pad + col * cW + cW / 2, pad + row * cH + cH / 2, r, 0, Math.PI * 2);
      if (on) {
        ctx.fillStyle  = accent;
        ctx.shadowColor = accent;
        ctx.shadowBlur  = size > 50 ? 7 : 4;
      } else {
        ctx.fillStyle  = document.body.classList.contains('theme-light') ? '#D8DCE0' : '#21262D';
        ctx.shadowBlur  = 0;
      }
      ctx.fill();
    }
  }
}

function codeToIcon(c) {
  if (c === 0)        return 'clear';
  if (c <= 2)         return 'partly_cloudy';
  if (c === 3)        return 'cloudy';
  if (c <= 48)        return 'fog';
  if (c <= 67 || c <= 82) return 'rain';
  if (c <= 77)        return 'snow';
  return 'storm';
}

const WX_DESC = {
  0:'clear_sky', 1:'mainly_clear', 2:'partly_cloudy', 3:'overcast', 45:'fog', 48:'rime_fog',
  51:'drizzle_light', 53:'drizzle', 55:'drizzle_heavy', 61:'rain_light', 63:'rain', 65:'rain_heavy',
  71:'snow_light', 73:'snow', 75:'snow_heavy', 80:'showers_light', 81:'showers',
  82:'showers_violent', 95:'thunderstorm', 96:'thunderstorm_hail', 99:'thunderstorm_hail',
};

async function fetchWeather() {
  try {
    const coords = await new Promise(res => {
      if (!navigator.geolocation) return res({ lat: 38.7169, lon: -9.1399 });
      navigator.geolocation.getCurrentPosition(
        p  => res({ lat: p.coords.latitude, lon: p.coords.longitude }),
        () => res({ lat: 38.7169, lon: -9.1399 }),
        { timeout: 4000 }
      );
    });

    const url = `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lon}` +
      `&current=temperature_2m,weather_code,wind_speed_10m,relative_humidity_2m,precipitation` +
      `&daily=temperature_2m_max,temperature_2m_min,weather_code,precipitation_probability_max` +
      `&timezone=auto&forecast_days=4&wind_speed_unit=kmh&temperature_unit=celsius`;
    const data = await (await fetch(url)).json();

    try {
      const gd   = await (await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${coords.lat}&lon=${coords.lon}&format=json`)).json();
      const city = gd.address?.city || gd.address?.town || gd.address?.village || gd.address?.county || '';
      const cc   = gd.address?.country_code?.toUpperCase() || '';
      if (city) document.getElementById('weatherLocation').textContent = `${city}, ${cc}`;
    } catch (_) {}

    const cur   = data.current;
    const daily = data.daily;
    const code  = cur.weather_code;

    drawWeatherDots(document.getElementById('weatherCanvas'), codeToIcon(code));
    document.getElementById('wTemp').textContent = `${Math.round(cur.temperature_2m)}°`;
    document.getElementById('wDesc').textContent = (WX_DESC[code] || 'unknown').replace(/_/g, ' ');

    // wBadges
    document.getElementById('wBadges').innerHTML = `
      <div class="wx-stat">
        <span class="wx-stat-val">${cur.relative_humidity_2m}%</span>
        <span class="wx-stat-key">Humid</span>
      </div>
      <div class="wx-stat">
        <span class="wx-stat-val">${Math.round(cur.wind_speed_10m)}</span>
        <span class="wx-stat-key">km/h</span>
      </div>
      <div class="wx-stat">
        <span class="wx-stat-val ${(cur.precipitation ?? 0) > 0 ? 'rain-active' : ''}">${cur.precipitation ?? 0}mm</span>
        <span class="wx-stat-key">Rain</span>
      </div>`;

    document.getElementById('wForecast').innerHTML = `
      <div class="wx-tomorrow">
        <span class="wx-tmr-label">TMR</span>
        <canvas id="fc-0" width="28" height="28" style="image-rendering:pixelated;flex-shrink:0"></canvas>
        <span class="wx-tmr-desc">${(WX_DESC[daily.weather_code[1]] || 'unknown').replace(/_/g,' ')}</span>
        <span class="wx-tmr-temps"><b>${Math.round(daily.temperature_2m_max[1])}°</b> / ${Math.round(daily.temperature_2m_min[1])}°</span>
      </div>`;

    setTimeout(() => {
      const el = document.getElementById('fc-0');
      if (el) drawWeatherDots(el, codeToIcon(daily.weather_code[1]));
    }, 50);

    document.getElementById('weatherLoading').style.display = 'none';
    document.getElementById('weatherWidget').style.display  = 'block';
  } catch (e) {
    document.getElementById('weatherLoading').textContent = '// fetch failed';
  }
}