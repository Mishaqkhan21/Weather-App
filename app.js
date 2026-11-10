
// ------------- API ---------------------------
const GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search";
const WEATHER_URL = "https://api.open-meteo.com/v1/forecast";

// ---------- 2. Page elements we need ----------
const searchForm = document.getElementById("searchForm");
const searchInput = document.getElementById("q");
const suggestBox = document.getElementById("suggest");
const statusText = document.getElementById("status");
const mainSection = document.getElementById("main");
const locateButton = document.getElementById("locate");
const unitButtons = document.querySelectorAll(".seg button");

// ---------- 3. App data (what the app remembers) ----------
let unit = "c";          // "c" for Celsius, "f" for Fahrenheit
let currentPlace = null; // the selected city
let weatherData = null;  // the last weather response
let suggestions = [];    // city results shown under the search box

// ---------- 4. Weather codes ----------
// Open-Meteo gives a number for the weather. This turns it into text.
function getDescription(code) {
  if (code === 0) return "Clear sky";
  if (code === 1) return "Mainly clear";
  if (code === 2) return "Partly cloudy";
  if (code === 3) return "Overcast";
  if (code === 45 || code === 48) return "Fog";
  if (code >= 51 && code <= 57) return "Drizzle";
  if (code >= 61 && code <= 67) return "Rain";
  if (code >= 71 && code <= 77) return "Snow";
  if (code >= 80 && code <= 82) return "Rain showers";
  if (code === 85 || code === 86) return "Snow showers";
  if (code >= 95) return "Thunderstorm";
  return "Unknown";
}

// Groups the many codes into 7 types. We use this for icons and backgrounds.
function getType(code) {
  if (code <= 1) return "clear";
  if (code === 2) return "partly";
  if (code === 3) return "cloud";
  if (code === 45 || code === 48) return "fog";
  if (code >= 51 && code <= 67) return "rain";
  if (code >= 80 && code <= 82) return "rain";
  if (code >= 71 && code <= 77) return "snow";
  if (code === 85 || code === 86) return "snow";
  if (code >= 95) return "storm";
  return "cloud";
}

// ---------- 5. Weather icons (small SVG drawings) ----------
const SUN = `
  <g class="spin" stroke="#FFD45E" stroke-width="3.5" stroke-linecap="round">
    <line x1="32" y1="9"  x2="32" y2="14"/>
    <line x1="32" y1="50" x2="32" y2="55"/>
    <line x1="9"  y1="32" x2="14" y2="32"/>
    <line x1="50" y1="32" x2="55" y2="32"/>
    <line x1="16" y1="16" x2="19" y2="19"/>
    <line x1="45" y1="45" x2="48" y2="48"/>
    <line x1="16" y1="48" x2="19" y2="45"/>
    <line x1="45" y1="19" x2="48" y2="16"/>
  </g>
  <circle cx="32" cy="32" r="11" fill="#FFD45E"/>`;

const MOON = `<path d="M40 10a21 21 0 1 0 14 32A17 17 0 0 1 40 10z" fill="#E8ECFF"/>`;

// A cloud shape. "color" and "moveY" let us reuse it in every icon.
function cloud(color, moveY) {
  return `<path class="drift" transform="translate(0 ${moveY})" fill="${color}"
    d="M18 48a11 11 0 0 1-1-22 15 15 0 0 1 29 3 9.5 9.5 0 0 1 1 19z"/>`;
}

function getIcon(code, isDay) {
  const type = getType(code);
  let shapes = "";

  if (type === "clear") {
    shapes = isDay ? SUN : MOON;
  } else if (type === "partly") {
    const small = isDay ? SUN : MOON;
    shapes = `<g transform="translate(-4 -6) scale(0.75)">${small}</g>` + cloud("#ffffff", 4);
  } else if (type === "cloud") {
    shapes = cloud("#e3e9f2", 2);
  } else if (type === "fog") {
    shapes = cloud("#dfe5ec", -6) +
      `<g stroke="#fff" stroke-width="3" stroke-linecap="round">
         <line x1="14" y1="48" x2="50" y2="48"/>
         <line x1="20" y1="55" x2="56" y2="55"/>
       </g>`;
  } else if (type === "rain") {
    shapes = cloud("#c5d0de", -6) +
      `<g stroke="#7fd0ff" stroke-width="3.5" stroke-linecap="round">
         <line class="fall" x1="22" y1="46" x2="19" y2="53"/>
         <line class="fall" x1="32" y1="46" x2="29" y2="53"/>
         <line class="fall" x1="42" y1="46" x2="39" y2="53"/>
       </g>`;
  } else if (type === "snow") {
    shapes = cloud("#dde6f0", -6) +
      `<g fill="#fff">
         <circle class="fall" cx="22" cy="50" r="2.6"/>
         <circle class="fall" cx="32" cy="50" r="2.6"/>
         <circle class="fall" cx="42" cy="50" r="2.6"/>
       </g>`;
  } else {
    // storm
    shapes = cloud("#9aa3bd", -8) +
      `<polygon class="flash" fill="#FFD45E" points="35,38 25,53 32,53 29,64 43,46 35,46"/>`;
  }

  return `<svg viewBox="0 0 64 64" role="img" aria-label="${getDescription(code)}">${shapes}</svg>`;
}

// ---------- 6. Small helper functions ----------
// Show a message under the search bar (isError makes it red).
function showStatus(message, isError) {
  statusText.textContent = message;
  statusText.className = isError ? "err" : "";
}

// Temperature: the API gives Celsius. Convert if the user chose Fahrenheit.
function formatTemp(celsius) {
  if (unit === "f") {
    return Math.round(celsius * 9 / 5 + 32);
  }
  return Math.round(celsius);
}

// Wind: the API gives km/h. Convert to mph if needed.
function formatWind(kmh) {
  if (unit === "f") {
    return Math.round(kmh * 0.621371) + " mph";
  }
  return Math.round(kmh) + " km/h";
}

// Turn wind degrees (0-360) into a letter like N, E, SW.
function getCompass(degrees) {
  const names = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  const index = Math.round(degrees / 45) % 8;
  return names[index];
}

// "2026-11-10T14:30" -> "14:30"
function getTime(isoText) {
  return isoText.slice(11, 16);
}

// Stop city names from breaking our HTML.
function escapeHTML(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// Fetch a URL and return the JSON data.
async function fetchJSON(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Request failed");
  }
  return response.json();
}

// ---------- 7. Talking to the API ----------
// Step 1: city name -> list of matching cities (with latitude/longitude)
async function searchCities(name) {
  const url = GEOCODING_URL + "?name=" + encodeURIComponent(name) +
    "&count=5&language=en&format=json";
  const data = await fetchJSON(url);
  return data.results || []; // "results" is missing when nothing is found
}

// Step 2: latitude/longitude -> weather
async function loadWeather(place) {
  mainSection.classList.add("loading");
  showStatus("Loading weather...", false);

  const url = WEATHER_URL +
    "?latitude=" + place.latitude +
    "&longitude=" + place.longitude +
    "&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,wind_speed_10m,wind_direction_10m,surface_pressure" +
    "&hourly=temperature_2m,weather_code,precipitation_probability,is_day" +
    "&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset" +
    "&timezone=auto&forecast_days=7";

  try {
    weatherData = await fetchJSON(url);
    currentPlace = place;
    localStorage.setItem("lastPlace", JSON.stringify(place)); // remember for next visit
    showWeather();
    showStatus("", false);
    mainSection.hidden = false;
  } catch (error) {
    showStatus("Could not load weather. Check your internet and try again.", true);
  }

  mainSection.classList.remove("loading");
}

// ---------- 8. Showing the weather on the page ----------
function showWeather() {
  const current = weatherData.current;
  const isDay = current.is_day === 1;
  const type = getType(current.weather_code);

  setBackground(type, isDay);
  fillCurrent(current, isDay);
  fillStats(current);
  fillHourly();
  fillDaily();
}

// Change the page colours to match the weather.
function setBackground(type, isDay) {
  if (type === "clear" || type === "partly") {
    document.body.dataset.sky = isDay ? "day" : "night";
  } else {
    document.body.dataset.sky = type;
  }
  // At night we add a dark layer on top.
  if (isDay) {
    document.body.removeAttribute("data-night");
  } else {
    document.body.setAttribute("data-night", "");
  }
}

// The big top part: city, temperature, icon, description.
function fillCurrent(current, isDay) {
  const daily = weatherData.daily;

  document.getElementById("city").textContent = currentPlace.name;
  document.getElementById("region").textContent =
    [currentPlace.admin1, currentPlace.country].filter(Boolean).join(", ");

  const localTime = new Date(current.time);
  document.getElementById("localtime").textContent = "Local time " +
    localTime.toLocaleString(undefined, { weekday: "long", hour: "numeric", minute: "2-digit" });

  document.getElementById("temp").textContent = formatTemp(current.temperature_2m);
  document.getElementById("unit").textContent = unit === "c" ? "°C" : "°F";
  document.getElementById("bigIcon").innerHTML = getIcon(current.weather_code, isDay);
  document.getElementById("cond").textContent = getDescription(current.weather_code);
  document.getElementById("hilo").textContent =
    "High " + formatTemp(daily.temperature_2m_max[0]) + "° · Low " + formatTemp(daily.temperature_2m_min[0]) + "°";

  document.title = formatTemp(current.temperature_2m) + "° " + currentPlace.name + " - Skyline Weather";
}

// The row of small facts: humidity, wind, etc.
function fillStats(current) {
  const daily = weatherData.daily;
  const rainChance = daily.precipitation_probability_max[0] || 0;

  const stats = [
    { label: "Feels like", value: formatTemp(current.apparent_temperature) + "°" },
    { label: "Humidity", value: current.relative_humidity_2m + "%" },
    { label: "Wind", value: formatWind(current.wind_speed_10m) + " " + getCompass(current.wind_direction_10m) },
    { label: "Pressure", value: Math.round(current.surface_pressure) + " hPa" },
    { label: "Chance of rain", value: rainChance + "%" },
    { label: "Sunrise / sunset", value: getTime(daily.sunrise[0]) + " / " + getTime(daily.sunset[0]) }
  ];

  let html = "";
  for (const stat of stats) {
    html += `<div class="stat"><span>${stat.label}</span><b>${stat.value}</b></div>`;
  }
  document.getElementById("stats").innerHTML = html;
}

// The scrolling list of the next 24 hours.
function fillHourly() {
  const hourly = weatherData.hourly;
  const nowHour = weatherData.current.time.slice(0, 13); // "2026-11-10T14"

  // Find where "now" is inside the hourly list.
  let start = 0;
  for (let i = 0; i < hourly.time.length; i++) {
    if (hourly.time[i].slice(0, 13) === nowHour) {
      start = i;
      break;
    }
  }

  let html = "";
  for (let i = start; i < start + 24; i++) {
    const label = i === start ? "Now" : getTime(hourly.time[i]);
    const rain = hourly.precipitation_probability[i];
    const rainText = rain >= 20 ? rain + "%" : "";

    html += `
      <div class="hr">
        <small>${label}</small>
        <div class="mini">${getIcon(hourly.weather_code[i], hourly.is_day[i] === 1)}</div>
        <b>${formatTemp(hourly.temperature_2m[i])}°</b>
        <em>${rainText}</em>
      </div>`;
  }
  document.getElementById("hourly").innerHTML = html;
}

// The 7-day list. Each day has a bar showing its low-to-high range.
function fillDaily() {
  const daily = weatherData.daily;
  const weekLow = Math.min(...daily.temperature_2m_min);
  const weekHigh = Math.max(...daily.temperature_2m_max);
  const range = weekHigh - weekLow || 1; // "|| 1" avoids dividing by zero

  let html = "";
  for (let i = 0; i < daily.time.length; i++) {
    let dayName = "Today";
    if (i > 0) {
      dayName = new Date(daily.time[i] + "T12:00").toLocaleDateString(undefined, { weekday: "short" });
    }

    const low = daily.temperature_2m_min[i];
    const high = daily.temperature_2m_max[i];
    const barStart = (low - weekLow) / range * 100;  // % from the left
    const barWidth = Math.max((high - low) / range * 100, 6); // % wide

    html += `
      <li class="day">
        <span>${dayName}</span>
        <div class="mini">${getIcon(daily.weather_code[i], true)}</div>
        <span class="rain">${daily.precipitation_probability_max[i] || 0}%</span>
        <span class="lo">${formatTemp(low)}°</span>
        <div class="bar"><i style="left:${barStart}%; width:${barWidth}%"></i></div>
        <span>${formatTemp(high)}°</span>
      </li>`;
  }
  document.getElementById("daily").innerHTML = html;
}

// ---------- 9. Search box ----------
let typingTimer; // we wait a moment after typing stops before searching

searchInput.addEventListener("input", function () {
  clearTimeout(typingTimer);
  const text = searchInput.value.trim();

  if (text.length < 2) {
    suggestBox.hidden = true;
    return;
  }

  typingTimer = setTimeout(async function () {
    try {
      suggestions = await searchCities(text);
      showSuggestions();
    } catch (error) {
      suggestBox.hidden = true;
    }
  }, 300);
});

// Draw the list of matching cities under the search box.
function showSuggestions() {
  if (suggestions.length === 0) {
    suggestBox.innerHTML = "<li>No city found. Check the spelling.</li>";
    suggestBox.hidden = false;
    return;
  }

  let html = "";
  for (let i = 0; i < suggestions.length; i++) {
    const city = suggestions[i];
    const where = [city.admin1, city.country].filter(Boolean).join(", ");
    html += `<li data-index="${i}"><span>${escapeHTML(city.name)}</span><small>${escapeHTML(where)}</small></li>`;
  }
  suggestBox.innerHTML = html;
  suggestBox.hidden = false;
}

// Use a chosen city.
function chooseCity(city) {
  searchInput.value = "";
  suggestBox.hidden = true;
  loadWeather(city);
}

// Clicking a suggestion.
suggestBox.addEventListener("mousedown", function (event) {
  const item = event.target.closest("li[data-index]");
  if (item) {
    event.preventDefault();
    chooseCity(suggestions[item.dataset.index]);
  }
});

// Pressing Enter: search and use the first match.
searchForm.addEventListener("submit", async function (event) {
  event.preventDefault();
  const text = searchInput.value.trim();
  if (text === "") return;

  showStatus("Searching...", false);
  try {
    const results = await searchCities(text);
    if (results.length === 0) {
      showStatus('No city found for "' + text + '". Check the spelling.', true);
    } else {
      chooseCity(results[0]);
    }
  } catch (error) {
    showStatus("Search failed. Check your internet and try again.", true);
  }
});

// Hide suggestions when clicking elsewhere.
document.addEventListener("click", function (event) {
  if (!event.target.closest(".search")) {
    suggestBox.hidden = true;
  }
});

// ---------- 10. "Use my location" button ----------
locateButton.addEventListener("click", function () {
  if (!navigator.geolocation) {
    showStatus("Your browser does not support location.", true);
    return;
  }
  showStatus("Finding your location...", false);
  navigator.geolocation.getCurrentPosition(
    function (position) {
      loadWeather({
        name: "My location",
        admin1: "",
        country: "",
        latitude: position.coords.latitude,
        longitude: position.coords.longitude
      });
    },
    function () {
      showStatus("Location blocked. Search for a city instead.", true);
    }
  );
});

// ---------- 11. °C / °F buttons ----------
for (const button of unitButtons) {
  button.addEventListener("click", function () {
    unit = button.dataset.u;
    localStorage.setItem("unit", unit);
    for (const b of unitButtons) {
      b.setAttribute("aria-pressed", b === button);
    }
    if (weatherData) showWeather(); // redraw with the new unit (no new request needed)
  });
}

// ---------- 12. Start the app ----------
function start() {
  // Restore the saved unit, if any.
  const savedUnit = localStorage.getItem("unit");
  if (savedUnit === "f") {
    unit = "f";
    unitButtons[0].setAttribute("aria-pressed", false);
    unitButtons[1].setAttribute("aria-pressed", true);
  }

  // Load the last city, or Karachi the first time.
  const saved = localStorage.getItem("lastPlace");
  if (saved) {
    loadWeather(JSON.parse(saved));
  } else {
    loadWeather({ name: "Karachi", admin1: "Sindh", country: "Pakistan", latitude: 24.86, longitude: 67.01 });
  }
}
start();
