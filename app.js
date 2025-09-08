// app.js
// Vanilla JS single-page app that fetches REST Countries & OpenWeatherMap
// Author: HTML + CSS + Javascript (🔨🤖🔧)

const REST_COUNTRIES_BY_NAME = (name) =>
  `https://restcountries.com/v3.1/name/${encodeURIComponent(name)}?fields=name,capital,flags,population,cca2,latlng`;

const REST_COUNTRIES_BY_CODE = (code) =>
  `https://restcountries.com/v3.1/alpha/${encodeURIComponent(code)}?fields=name,capital,flags,population,cca2,latlng`;

const OWM_WEATHER_BY_CITY = (city, countryCode, key) =>
  `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)},${encodeURIComponent(countryCode)}&appid=${key}&units=metric`;

const OWM_WEATHER_BY_COORDS = (lat, lon, key) =>
  `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${key}&units=metric`;

// --- State ---
let aborter = null;

// --- Helpers ---
const qs  = (sel, el = document) => el.querySelector(sel);
const qsa = (sel, el = document) => [...el.querySelectorAll(sel)];
const $status = () => qs("#status");
const $results = () => qs("#results");

function setStatus(msg, kind = "") {
  const el = $status();
  el.className = `status ${kind}`;
  el.innerHTML = msg;
}

function showLoading(msg = "Loading…") {
  setStatus(
    `<span class="loader"><span class="spinner" role="progressbar" aria-label="Loading"></span>${msg}</span>`
  );
}
function clearStatus() { setStatus(""); }

async function getJSON(url, { signal, timeoutMs = 12000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error("Request timeout")), timeoutMs);
  const compositeSignal = mergeSignals(signal, controller.signal);

  const res = await fetch(url, { signal: compositeSignal, headers: { "Accept": "application/json" } });
  clearTimeout(timer);

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const err = new Error(`HTTP ${res.status} – ${res.statusText || "Error"}${text ? `: ${text}` : ""}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

function mergeSignals(a, b) {
  if (!a) return b;
  if (!b) return a;
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  a.addEventListener("abort", onAbort);
  b.addEventListener("abort", onAbort);
  return controller.signal;
}

function numberFmt(n) {
  try { return new Intl.NumberFormat().format(n); }
  catch { return String(n); }
}

function persistTheme(isDark) {
  localStorage.setItem("theme", isDark ? "dark" : "light");
  document.documentElement.setAttribute("data-theme", isDark ? "dark" : "light");
  qs("#themeToggle").checked = isDark;
}

function initTheme() {
  const saved = localStorage.getItem("theme");
  if (saved) return persistTheme(saved === "dark");
  // system preference
  const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  persistTheme(prefersDark);
}

// --- Rendering ---
function renderCard({ country, weather }) {
  const { name, capital, flags, population, cca2 } = country;
  const capitalName = capital?.[0] ?? "—";
  const flagSrc = flags?.svg || flags?.png || "";
  const countryName = name?.common || "Unknown";

  let weatherBlock = `<div class="kv"><div class="label">Weather</div><div class="value">Not available</div></div>`;

  if (weather) {
    const t = Math.round(weather.main?.temp);
    const d = weather.weather?.[0]?.description ?? "";
    const icon = weather.weather?.[0]?.icon ?? "";
    const iconUrl = icon ? `https://openweathermap.org/img/wn/${icon}@2x.png` : "";
    weatherBlock = `
      <div class="kv">
        <div class="label">Current Weather in ${escapeHtml(capitalName)}</div>
        <div class="weather">
          ${iconUrl ? `<img src="${iconUrl}" alt="${escapeHtml(d)} icon" loading="lazy" />` : ""}
          <div>
            <div class="value">${Number.isFinite(t) ? `${t}°C` : "—"}</div>
            <div class="meta" style="text-transform: capitalize">${escapeHtml(d)}</div>
          </div>
        </div>
      </div>`;
  }

  $results().innerHTML = `
    <article class="card" role="region" aria-label="${escapeHtml(countryName)}">
      <div class="card-header">
        <img class="flag" src="${flagSrc}" alt="Flag of ${escapeHtml(countryName)}" />
        <div class="title">
          <h2>${escapeHtml(countryName)} <span class="meta">(${escapeHtml(cca2 || "—")})</span></h2>
          <div class="meta">Capital: <strong>${escapeHtml(capitalName)}</strong> · Population: ${numberFmt(population || 0)}</div>
        </div>
      </div>
      <div class="card-body">
        <div class="kv">
          <div class="label">Country</div>
          <div class="value">${escapeHtml(countryName)}</div>
        </div>
        <div class="kv">
          <div class="label">Capital</div>
          <div class="value">${escapeHtml(capitalName)}</div>
        </div>
        <div class="kv">
          <div class="label">Population</div>
          <div class="value">${numberFmt(population || 0)}</div>
        </div>
        ${weatherBlock}
      </div>
    </article>
  `;
}

function escapeHtml(s = "") {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// --- Core flows ---
async function fetchCountryByName(name, signal) {
  const data = await getJSON(REST_COUNTRIES_BY_NAME(name), { signal });
  if (!Array.isArray(data) || data.length === 0) throw new Error("No results.");
  // Choose best match: exact common name (case-insensitive) else first
  const lower = name.trim().toLowerCase();
  const exact = data.find(d => d.name?.common?.toLowerCase() === lower);
  return exact || data[0];
}

async function fetchCountryByCode(code, signal) {
  const data = await getJSON(REST_COUNTRIES_BY_CODE(code), { signal });
  return data; // this endpoint returns a single object
}

async function fetchWeatherForCapital(country, apiKey, signal) {
  const capital = country.capital?.[0];
  const code = country.cca2;
  if (!capital || !code) return null;
  return getJSON(OWM_WEATHER_BY_CITY(capital, code, apiKey), { signal });
}

async function handleSearch(name, apiKey) {
  if (!name || !name.trim()) {
    setStatus("Please enter a country name.", "error");
    return;
  }
  cancelOngoing();

  try {
    showLoading("Looking up country…");
    const country = await fetchCountryByName(name.trim(), aborter.signal);

    setStatus(`<span class="loader"><span class="spinner"></span>Fetching weather for ${escapeHtml(country.capital?.[0] ?? "capital")}…</span>`);
    const weather = await fetchWeatherForCapital(country, apiKey, aborter.signal).catch(() => null);

    clearStatus();
    renderCard({ country, weather });
    setStatus("Loaded successfully ✔️", "success");
  } catch (err) {
    if (err.name === "AbortError") return;
    console.error(err);
    const msg =
      err.status === 404
        ? "Country not found. Check the spelling and try again."
        : `Something went wrong: ${err.message || err}`;
    setStatus(msg, "error");
    $results().innerHTML = "";
  }
}

function cancelOngoing() {
  if (aborter) aborter.abort();
  aborter = new AbortController();
}

// --- Geolocation flow (optional/advanced) ---
async function handleGeo(apiKey) {
  if (!("geolocation" in navigator)) {
    setStatus("Geolocation not supported by your browser.", "error");
    return;
  }
  cancelOngoing();
  showLoading("Finding your location…");

  try {
    const pos = await new Promise((res, rej) =>
      navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: false, timeout: 10000 })
    );
    const { latitude, longitude } = pos.coords;

    setStatus(`<span class="loader"><span class="spinner"></span>Detecting your country…</span>`);
    // Get weather at coords to learn ISO country code fast
    const hereWeather = await getJSON(OWM_WEATHER_BY_COORDS(latitude, longitude, apiKey), { signal: aborter.signal });
    const iso = hereWeather?.sys?.country;
    if (!iso) throw new Error("Could not determine country from location.");

    const country = await fetchCountryByCode(iso, aborter.signal);
    setStatus(`<span class="loader"><span class="spinner"></span>Fetching weather for ${escapeHtml(country.capital?.[0] ?? "capital")}…</span>`);
    const capitalWeather = await fetchWeatherForCapital(country, apiKey, aborter.signal).catch(() => null);

    clearStatus();
    renderCard({ country, weather: capitalWeather });
    setStatus(`Detected ${escapeHtml(country.name?.common || iso)} ✔️`, "success");
  } catch (err) {
    if (err.name === "AbortError") return;
    console.error(err);
    setStatus(`Geolocation failed: ${err.message || err}`, "error");
  }
}

// --- Wire up UI ---
export function startApp(OWM_API_KEY) {
  initTheme();

  const input = qs("#countryInput");
  const searchBtn = qs("#searchBtn");
  const geoBtn = qs("#geoBtn");
  const themeToggle = qs("#themeToggle");

  searchBtn.addEventListener("click", () => handleSearch(input.value, OWM_API_KEY));
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") handleSearch(input.value, OWM_API_KEY);
  });
  geoBtn.addEventListener("click", () => handleGeo(OWM_API_KEY));

  themeToggle.addEventListener("change", (e) => persistTheme(e.target.checked));

  // small UX sugar: prefill with a popular country on first load
  if (!localStorage.getItem("hasVisited")) {
    localStorage.setItem("hasVisited", "1");
    handleSearch("Japan", OWM_API_KEY);
  }
}
 