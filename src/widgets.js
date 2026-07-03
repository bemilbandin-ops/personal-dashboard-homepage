window.Aura = window.Aura || {};

Aura.widgets = {
  timer: null,
  saveTimer: null,
  init(preferences, savePreferences) {
    this.preferences = preferences;
    this.savePreferences = savePreferences;
    this.clock = document.getElementById("clock");
    this.date = document.getElementById("date");
    this.notes = document.getElementById("scratchpad");
    this.status = document.getElementById("save-status");
    this.notes.value = Aura.storage.get("scratchpad", "Buy groceries");
    this.notes.addEventListener("input", () => this.queueSave());
    this.updateClock();
    this.timer = setInterval(() => this.updateClock(), 1000);
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
  toggleClock() {
    this.preferences.is24Hour = !this.preferences.is24Hour;
    this.savePreferences();
    this.updateClock();
  },
  renderWeather() {
    const weather = Aura.config.weather;
    const celsius = this.preferences.isCelsius;
    document.getElementById("weather-location").textContent = weather.location;
    document.getElementById("weather-condition").textContent = weather.condition;
    document.getElementById("temperature").textContent = celsius ? weather.tempC : Math.round(weather.tempC * 9 / 5 + 32);
    document.getElementById("temperature-unit").textContent = celsius ? "°C" : "°F";
  },
  toggleTemperature() {
    this.preferences.isCelsius = !this.preferences.isCelsius;
    this.savePreferences();
    this.renderWeather();
  },
  queueSave() {
    this.status.textContent = "Saving…";
    this.status.classList.add("saving");
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      Aura.storage.set("scratchpad", this.notes.value);
      this.status.textContent = "Saved";
      this.status.classList.remove("saving");
    }, 500);
  },
  applyVisibility() {
    document.getElementById("weather").hidden = !this.preferences.showWeather;
    document.getElementById("scratchpad-widget").hidden = !this.preferences.showScratchpad;
  }
};
