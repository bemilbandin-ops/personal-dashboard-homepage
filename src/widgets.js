window.Aura = window.Aura || {};

Aura.widgets = {
  timer: null,
  saveTimer: null,
  sessionStartedAt: Date.now(),
  forecastOpen: false,
  init(preferences, savePreferences) {
    this.preferences = preferences;
    this.savePreferences = savePreferences;
    this.clock = document.getElementById("clock");
    this.date = document.getElementById("date");
    this.notes = document.getElementById("scratchpad");
    this.status = document.getElementById("save-status");
    this.sessionLabel = document.getElementById("active-session");
    this.weatherCard = document.getElementById("weather");
    this.notes.value = Aura.storage.get("scratchpad", "Buy groceries");
    this.notes.addEventListener("input", () => this.queueSave());
    this.updateClock();
    this.updateActiveSession();
    this.timer = setInterval(() => {
      this.updateClock();
      this.updateActiveSession();
    }, 1000);
    if (Aura.weather?.init) Aura.weather.init(() => this.renderWeather());
    this.renderWeather();
    this.applyVisibility();
  },
  updateClock() {
    const now = new Date();
    this.clock.textContent = new Intl.DateTimeFormat(undefined, {
      hour: "2-digit", minute: "2-digit", hour12: !this.preferences.is24Hour
    }).format(now);
    this.date.textContent = new Intl.DateTimeFormat(undefined, {
      weekday: "long", month: "long", day: "numeric"
    }).format(now).toUpperCase();
  },
  updateActiveSession() {
    if (!this.sessionLabel) return;
    const elapsedMinutes = Math.floor((Date.now() - this.sessionStartedAt) / 60000);
    if (elapsedMinutes < 60) {
      this.sessionLabel.textContent = `Active session: ${elapsedMinutes}m`;
      return;
    }
    const hours = Math.floor(elapsedMinutes / 60);
    const minutes = elapsedMinutes % 60;
    this.sessionLabel.textContent = `Active session: ${hours}h ${minutes}m`;
  },
  renderWeather() {
    const weather = Aura.weather?.getCurrent ? Aura.weather.getCurrent() : Aura.config.weather;
    const celsius = this.preferences.isCelsius;
    const tempC = Number.isFinite(weather.tempC) ? weather.tempC : null;
    const temperature = tempC === null ? "--" : celsius ? Math.round(tempC) : Math.round(tempC * 9 / 5 + 32);
    const condition = weather.status === "loading" ? "Loading weather…" : weather.condition;

    document.getElementById("weather-location").textContent = weather.location || Aura.config.weather.location;
    document.getElementById("weather-condition").textContent = condition || "Weather unavailable";
    document.getElementById("temperature").textContent = temperature;
    document.getElementById("temperature-unit").textContent = tempC === null ? "" : celsius ? "°C" : "°F";
    document.getElementById("weather-detail").textContent = this.getWeatherDetail(weather);
    document.getElementById("weather-updated").textContent = this.getWeatherUpdatedLabel(weather);
    this.weatherCard?.setAttribute("aria-label", this.forecastOpen ? "Hide weather forecast" : "Show weather forecast");

    const iconUse = document.querySelector("#weather-icon use");
    if (iconUse) iconUse.setAttribute("href", `#${weather.icon || "i-cloud"}`);

    this.renderForecast(weather.forecast || []);
  },
  getWeatherDetail(weather) {
    const detail = [];
    if (weather.status === "cached") detail.push("Cached");
    if (Number.isFinite(weather.windKph)) detail.push(`Wind ${Math.round(weather.windKph)} km/h`);
    if (Number.isFinite(weather.rainMm)) detail.push(`Rain ${weather.rainMm} mm`);
    if (weather.status === "error") detail.push("Live update failed");
    return detail.join(" · ");
  },
  getWeatherUpdatedLabel(weather) {
    if (weather.status === "loading") return "Updating…";
    if (!weather.updatedAt) return "No live update yet";
    const time = new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" }).format(new Date(weather.updatedAt));
    return `Updated ${time}`;
  },
  renderForecast(forecast) {
    const list = document.getElementById("weather-forecast");
    if (!list) return;

    list.hidden = !this.forecastOpen || forecast.length === 0;
    list.replaceChildren();

    forecast.forEach(day => {
      const item = document.createElement("li");
      const label = document.createElement("span");
      const summary = document.createElement("b");
      const temp = document.createElement("small");
      const high = Number.isFinite(day.highC) ? Math.round(day.highC) : "--";
      const low = Number.isFinite(day.lowC) ? Math.round(day.lowC) : "--";
      const rain = Number.isFinite(day.rainMm) ? day.rainMm : "--";

      label.textContent = day.label;
      summary.textContent = day.condition;
      temp.textContent = `${high}° / ${low}° · ${rain} mm`;

      item.append(label, summary, temp);
      list.append(item);
    });
  },
  toggleForecast(event) {
    this.forecastOpen = !this.forecastOpen;
    this.weatherCard?.setAttribute("aria-expanded", String(this.forecastOpen));
    this.renderWeather();

    if (event?.metaKey || event?.ctrlKey || event?.shiftKey || event?.altKey) {
      Aura.weather?.refresh?.(true);
    }
  },
  queueSave() {
    this.status.textContent = "Saving…";
    this.status.classList.add("saving");
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      this.status.textContent = Aura.storage.set("scratchpad", this.notes.value) ? "Saved" : "Not saved";
      this.status.classList.remove("saving");
    }, 500);
  },
  applyVisibility() {
    document.getElementById("weather").hidden = !this.preferences.showWeather;
    document.getElementById("scratchpad-widget").hidden = !this.preferences.showScratchpad;
  }
};
