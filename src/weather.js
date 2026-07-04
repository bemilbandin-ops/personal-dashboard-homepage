window.Aura = window.Aura || {};

Aura.weather = {
  cacheKey: "weather:current",
  locationKey: "weather:location",
  refreshMs: 25 * 60 * 1000,
  current: null,
  timer: null,
  listeners: new Set(),

  init(onChange) {
    if (typeof onChange === "function") this.subscribe(onChange);
    this.current = this.getCached() || this.getFallback("Loading weather…", "loading");
    this.notify();
    this.refresh();
    clearInterval(this.timer);
    this.timer = setInterval(() => this.refresh(), this.refreshMs);
  },

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  },

  getCurrent() {
    return this.current || this.getCached() || this.getFallback("Weather unavailable", "error");
  },

  getLocation() {
    const stored = Aura.storage?.get(this.locationKey, null);
    const fallback = Aura.config.weather;
    if (stored && Number.isFinite(Number(stored.latitude)) && Number.isFinite(Number(stored.longitude))) {
      return {
        location: stored.location || fallback.location,
        latitude: Number(stored.latitude),
        longitude: Number(stored.longitude)
      };
    }
    return fallback;
  },

  async setLocation(query) {
    const location = await this.resolveLocation(query);
    Aura.storage?.set(this.locationKey, location);
    Aura.storage?.set(this.cacheKey, null);
    this.current = this.getFallback("Loading weather…", "loading");
    this.notify();
    await this.refresh(true);
    return location;
  },

  async resolveLocation(query) {
    const value = String(query || "").trim();
    if (!value) throw new Error("Enter a city or coordinates.");

    const coordinates = value.match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
    if (coordinates) {
      return {
        location: `${coordinates[1]}, ${coordinates[2]}`,
        latitude: Number(coordinates[1]),
        longitude: Number(coordinates[2])
      };
    }

    const params = new URLSearchParams({ name: value, count: "1", language: "en", format: "json" });
    const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${params.toString()}`, { cache: "no-store" });
    if (!response.ok) throw new Error("Location lookup failed.");
    const data = await response.json();
    const result = data.results?.[0];
    if (!result) throw new Error("Location not found.");

    return {
      location: [result.name, result.admin1, result.country_code].filter(Boolean).join(", "),
      latitude: Number(result.latitude),
      longitude: Number(result.longitude)
    };
  },

  async refresh(force = false) {
    const cached = this.getCached();
    const lastUpdated = cached?.updatedAt ? new Date(cached.updatedAt).getTime() : 0;
    const cacheAge = Date.now() - lastUpdated;

    if (!force && cached && cacheAge < 5 * 60 * 1000) {
      this.setCurrent(cached);
      return cached;
    }

    this.setCurrent({ ...(cached || this.getCurrent()), status: "loading", error: null });

    try {
      const response = await fetch(this.buildUrl(), { cache: "no-store" });
      if (!response.ok) throw new Error(`Weather request failed: ${response.status}`);

      const data = await response.json();
      const weather = this.normalize(data);
      this.save(weather);
      this.setCurrent(weather);
      return weather;
    } catch (error) {
      const fallback = cached
        ? { ...cached, status: "cached", error: error.message }
        : this.getFallback("Weather unavailable", "error", error.message);
      this.setCurrent(fallback);
      return fallback;
    }
  },

  buildUrl() {
    const config = this.getLocation();
    const params = new URLSearchParams({
      latitude: config.latitude,
      longitude: config.longitude,
      current: "temperature_2m,weather_code,wind_speed_10m,precipitation,rain",
      daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum",
      timezone: "auto",
      forecast_days: "5"
    });
    return `https://api.open-meteo.com/v1/forecast?${params.toString()}`;
  },

  normalize(data) {
    const current = data.current || {};
    const daily = data.daily || {};
    const code = Number(current.weather_code);
    const location = this.getLocation();

    return {
      location: location.location,
      tempC: this.round(current.temperature_2m),
      condition: this.describe(code),
      weatherCode: code,
      icon: this.icon(code),
      windKph: this.round(current.wind_speed_10m),
      rainMm: this.round(current.rain ?? current.precipitation ?? 0, 1),
      updatedAt: new Date().toISOString(),
      observationTime: current.time || null,
      status: "ready",
      error: null,
      forecast: this.normalizeForecast(daily)
    };
  },

  normalizeForecast(daily) {
    if (!Array.isArray(daily.time)) return [];

    return daily.time.slice(1, 5).map((date, offset) => {
      const index = offset + 1;
      const code = Number(daily.weather_code?.[index]);
      return {
        date,
        label: this.formatForecastDay(date),
        condition: this.describe(code),
        icon: this.icon(code),
        highC: this.round(daily.temperature_2m_max?.[index]),
        lowC: this.round(daily.temperature_2m_min?.[index]),
        rainMm: this.round(daily.precipitation_sum?.[index] ?? 0, 1)
      };
    });
  },

  describe(code) {
    const descriptions = {
      0: "Clear sky",
      1: "Mainly clear",
      2: "Partly cloudy",
      3: "Overcast",
      45: "Fog",
      48: "Depositing rime fog",
      51: "Light drizzle",
      53: "Moderate drizzle",
      55: "Dense drizzle",
      56: "Freezing drizzle",
      57: "Freezing drizzle",
      61: "Slight rain",
      63: "Rain",
      65: "Heavy rain",
      66: "Freezing rain",
      67: "Freezing rain",
      71: "Slight snow",
      73: "Snow",
      75: "Heavy snow",
      77: "Snow grains",
      80: "Rain showers",
      81: "Rain showers",
      82: "Violent showers",
      85: "Snow showers",
      86: "Heavy snow showers",
      95: "Thunderstorm",
      96: "Thunderstorm with hail",
      99: "Thunderstorm with hail"
    };
    return descriptions[code] || "Weather unavailable";
  },

  icon(code) {
    if (code === 0 || code === 1) return "i-sun";
    return "i-cloud";
  },

  formatForecastDay(date) {
    return new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(new Date(date));
  },

  getFallback(condition, status, error = null) {
    const location = this.getLocation();
    return {
      location: location.location,
      tempC: null,
      condition,
      weatherCode: null,
      icon: "i-cloud",
      windKph: null,
      rainMm: null,
      updatedAt: null,
      observationTime: null,
      status,
      error,
      forecast: []
    };
  },

  getCached() {
    const cached = Aura.storage?.get(this.cacheKey, null);
    const location = this.getLocation();
    return cached ? { ...cached, location: cached.location || location.location, status: cached.status === "ready" ? "ready" : "cached" } : null;
  },

  save(weather) {
    try {
      Aura.storage?.set(this.cacheKey, weather);
    } catch {
      // Weather should still render even if localStorage is unavailable.
    }
  },

  setCurrent(weather) {
    this.current = weather;
    this.notify();
  },

  notify() {
    this.listeners.forEach(listener => listener(this.getCurrent()));
  },

  round(value, decimals = 0) {
    const number = Number(value);
    if (!Number.isFinite(number)) return null;
    const factor = 10 ** decimals;
    return Math.round(number * factor) / factor;
  }
};
