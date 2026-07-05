window.Aura = window.Aura || {};

(() => {
  const defaults = {
    is24Hour: Aura.config.clock.format === "24h",
    isCelsius: true,
    showWeather: true,
    showScratchpad: true,
    searchEngine: Aura.config.search.defaultEngine
  };
  const preferences = { ...defaults, ...Aura.storage.get("preferences", {}) };
  const savePreferences = () => {
    Aura.storage.set("preferences", preferences);
    syncSettings();
  };

  function resolveViewName(name) {
    return ["home", "productivity", "atmosphere", "library"].includes(name) ? name : "home";
  }
  function isEditableTarget(target) {
    return ["INPUT", "TEXTAREA", "SELECT"].includes(target?.tagName) || Boolean(target?.isContentEditable);
  }
  function showView(name) {
    const selected = resolveViewName(name);
    document.querySelectorAll("[data-view]").forEach(view => { view.hidden = view.dataset.view !== selected; });
    document.querySelectorAll("[data-view-target]").forEach(button => {
      button.classList.toggle("active", button.dataset.viewTarget === selected);
      if (button.classList.contains("active")) button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
    });
    const nextHash = `#${selected}`;
    if (location.hash !== nextHash) history.replaceState(null, "", nextHash);
  }
  function showHashView() { showView(location.hash.slice(1) || "home"); }
  document.querySelectorAll("[data-view-target]").forEach(button =>
    button.addEventListener("click", () => showView(button.dataset.viewTarget))
  );
  showView(location.hash.slice(1) || "home");
  addEventListener("hashchange", showHashView);

  const dialog = document.getElementById("settings-dialog");
  function openSettings() { dialog.showModal(); }
  document.querySelectorAll("[data-open-settings]").forEach(button => button.addEventListener("click", openSettings));
  Aura.shortcuts.init();
  Aura.productivity.init();

  const controls = {
    clock: document.getElementById("setting-clock"),
    temp: document.getElementById("setting-temp"),
    engine: document.getElementById("setting-engine"),
    weather: document.getElementById("setting-weather"),
    scratchpad: document.getElementById("setting-scratchpad")
  };
  function syncSettings() {
    controls.clock.checked = preferences.is24Hour;
    controls.temp.checked = preferences.isCelsius;
    controls.engine.value = preferences.searchEngine;
    controls.weather.checked = preferences.showWeather;
    controls.scratchpad.checked = preferences.showScratchpad;
  }
  Object.values(controls).forEach(control => control.addEventListener("change", () => {
    preferences.is24Hour = controls.clock.checked;
    preferences.isCelsius = controls.temp.checked;
    preferences.searchEngine = controls.engine.value;
    preferences.showWeather = controls.weather.checked;
    preferences.showScratchpad = controls.scratchpad.checked;
    savePreferences();
    Aura.widgets.updateClock();
    Aura.widgets.renderWeather();
    Aura.widgets.applyVisibility();
  }));

  document.getElementById("clock-toggle").addEventListener("click", () => Aura.widgets.toggleClock());
  document.getElementById("weather").addEventListener("click", () => Aura.widgets.toggleTemperature());
  document.getElementById("deep-work").addEventListener("click", () => {
    showView("productivity");
    Aura.productivity.start();
  });
  document.getElementById("reset-data").addEventListener("click", () => {
    if (confirm("Reset Aura notes and preferences?")) {
      Aura.storage.clear();
      location.reload();
    }
  });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && dialog.open) dialog.close();
    if (event.key === "/" && resolveViewName(location.hash.slice(1)) === "home" && !isEditableTarget(event.target)) {
      event.preventDefault();
      document.getElementById("search-input").focus();
    }
  });

  syncSettings();
  Aura.search.init(preferences);
  Aura.widgets.init(preferences, savePreferences);
  Aura.atmosphere.init(preferences);
})();
