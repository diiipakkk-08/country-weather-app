 # Country & Capital Weather (Vanilla JS)

A single-page web app where you search a **country** and see its **details** + **current weather in the capital city**. Built with **HTML, CSS, and vanilla JavaScript** — no frameworks.

## ✨ Features
- Search by country name (REST Countries v3)
- Display: flag, country name, capital, population
- Weather in the **capital city** (OpenWeatherMap): temperature °C, description, icon
- Robust async flow with `async/await`, `AbortController`, and timeouts
- Clean error states, loading indicators, and accessible live announcements
- **Dark mode** (toggle, persisted)
- **Responsive** layout (mobile-first)
- **Geolocation** (optional): Detect your country and show its capital weather
- **API key security**: `config.js` (gitignored), instructions below

## 🚀 Quick Start
1. **Clone** this repo (https://github.com/diiipakkk-08/country-weather-app.git).
2. Create a file at the project root named **`config.js`** with:
   ```js
   export const OWM_API_KEY = "YOUR_OWM_API_KEY_HERE";
