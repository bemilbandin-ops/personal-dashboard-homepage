window.Aura = window.Aura || {};

Aura.weather = {
  cacheKey: "weather:current",
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
    const config = Aura.config.weather;
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

    return {
      location: Aura.config.weather.location,
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
    return {
      location: Aura.config.weather.location,
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
    return cached ? { ...cached, status: cached.status === "ready" ? "ready" : "cached" } : null;
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
