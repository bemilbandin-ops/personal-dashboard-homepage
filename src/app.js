window.Aura = window.Aura || {};

(async () => {
  await Aura.storage.ready?.();

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
  Aura.timeTools.init();
  Aura.notes.init();

  function ensureAccountSyncUi() {
    if (!document.querySelector('link[data-aura-sync-css="true"]')) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "src/sync.css?v=sync";
      link.dataset.auraSyncCss = "true";
      document.head.append(link);
    }

    if (document.getElementById("account-sync-title")) return;

    const visibleWidgets = document.querySelector(".settings-panel fieldset");
    if (!visibleWidgets) return;

    visibleWidgets.insertAdjacentHTML("afterend", `
      <section class="account-panel" aria-labelledby="account-sync-title">
        <h3 id="account-sync-title">Account sync</h3>
        <small>Sync preferences, scratchpad, tasks and focus history across devices.</small>
        <small id="sync-build">Sync build: test-db diagnostic</small>
        <input id="login-email" name="email" type="email" autocomplete="email" placeholder="Email">
        <input id="login-password" name="password" type="password" autocomplete="current-password" placeholder="Password">
        <div class="account-actions">
          <button id="login-button" type="button">Log in</button>
          <button id="signup-button" type="button">Create account</button>
        </div>
        <p id="sync-status" role="status">Sync not configured</p>
        <button id="logout-button" type="button" hidden>Log out</button>
      </section>
    `);
  }

  ensureAccountSyncUi();

  const controls = {
    clock: document.getElementById("setting-clock"),
    temp: document.getElementById("setting-temp"),
    engine: document.getElementById("setting-engine"),
    weather: document.getElementById("setting-weather"),
    scratchpad: document.getElementById("setting-scratchpad"),
    weatherLocation: document.getElementById("weather-location-input"),
    weatherLocationSave: document.getElementById("weather-location-save"),
    weatherLocationStatus: document.getElementById("weather-location-status"),
    loginEmail: document.getElementById("login-email"),
    loginPassword: document.getElementById("login-password"),
    loginButton: document.getElementById("login-button"),
    signupButton: document.getElementById("signup-button"),
    logoutButton: document.getElementById("logout-button"),
    syncStatus: document.getElementById("sync-status")
  };
  const preferenceControls = [controls.clock, controls.temp, controls.engine, controls.weather, controls.scratchpad];

  function syncSettings() {
    controls.clock.checked = preferences.is24Hour;
    controls.temp.checked = preferences.isCelsius;
    controls.engine.value = preferences.searchEngine;
    controls.weather.checked = preferences.showWeather;
    controls.scratchpad.checked = preferences.showScratchpad;
    if (controls.weatherLocation) controls.weatherLocation.value = Aura.weather?.getLocation?.().location || Aura.config.weather.location;
  }

  function setSyncStatus(message) {
    if (controls.syncStatus) controls.syncStatus.textContent = message;
  }

  function describeSyncError(error) {
    if (!error) return "Unknown error";
    if (typeof error === "string") return error;

    const parts = [error.message, error.code, error.details, error.hint]
      .filter(Boolean)
      .map(part => String(part).trim())
      .filter(Boolean);

    return parts.length ? parts.join(" | ") : JSON.stringify(error);
  }

  function syncStateMessage() {
    const state = Aura.sync?.getState?.();
    if (!state?.configured) return "Sync not configured. This deployed branch does not contain the Supabase key.";
    if (state.lastError) return `${state.status}: ${describeSyncError(state.lastError)}`;
    return state.status || "Not signed in";
  }

  function refreshAccountUi() {
    const configured = Aura.sync?.isConfigured?.() === true;
    const user = Aura.sync?.getUser?.();
    const signedIn = Boolean(user);

    setSyncStatus(syncStateMessage());
    [controls.loginEmail, controls.loginPassword, controls.loginButton, controls.signupButton].forEach(control => {
      if (control) control.disabled = !configured || signedIn;
    });
    if (controls.logoutButton) controls.logoutButton.hidden = !signedIn;
  }

  function getCredentials() {
    return {
      email: controls.loginEmail?.value.trim() || "",
      password: controls.loginPassword?.value || ""
    };
  }

  async function handleAuth(action) {
    const { email, password } = getCredentials();
    if (!email || !password) {
      setSyncStatus("Enter email and password.");
      return;
    }

    try {
      setSyncStatus(action === "signUp" ? "Creating account…" : "Logging in…");
      await Aura.sync[action](email, password);
      setSyncStatus("Sync ready. Reloading…");
      location.reload();
    } catch (error) {
      setSyncStatus(describeSyncError(error) || "Auth failed.");
      refreshAccountUi();
    }
  }

  controls.loginButton?.addEventListener("click", () => handleAuth("signIn"));
  controls.signupButton?.addEventListener("click", () => handleAuth("signUp"));
  controls.loginPassword?.addEventListener("keydown", event => {
    if (event.key === "Enter") {
      event.preventDefault();
      handleAuth("signIn");
    }
  });
  controls.logoutButton?.addEventListener("click", async () => {
    try {
      setSyncStatus("Logging out…");
      await Aura.sync.signOut();
      refreshAccountUi();
    } catch (error) {
      setSyncStatus(describeSyncError(error) || "Logout failed.");
    }
  });
  Aura.sync?.onChange?.(() => refreshAccountUi());

  preferenceControls.forEach(control => control.addEventListener("change", () => {
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

  controls.weatherLocationSave?.addEventListener("click", async () => {
    const status = controls.weatherLocationStatus;
    try {
      if (status) status.textContent = "Updating location…";
      const location = await Aura.weather.setLocation(controls.weatherLocation.value);
      controls.weatherLocation.value = location.location;
      if (status) status.textContent = `Weather set to ${location.location}.`;
    } catch (error) {
      if (status) status.textContent = error.message || "Could not update weather location.";
    }
  });

  document.getElementById("clock-toggle").addEventListener("click", () => Aura.timeTools.open());
  document.getElementById("weather").addEventListener("click", event => Aura.widgets.toggleForecast(event));
  document.getElementById("reset-data").addEventListener("click", async () => {
    if (confirm("Reset all Aura notes, alarms, focus history and preferences?")) {
      try {
        await Aura.storage.clear();
      } finally {
        location.reload();
      }
    }
  });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      if (dialog.open) dialog.close();
      if (document.getElementById("time-tools-dialog")?.open) document.getElementById("time-tools-dialog").close();
    }
    if (event.key === "/" && resolveViewName(location.hash.slice(1)) === "home" && !isEditableTarget(event.target)) {
      event.preventDefault();
      document.getElementById("search-input").focus();
    }
  });

  syncSettings();
  refreshAccountUi();
  Aura.search.init(preferences);
  Aura.widgets.init(preferences, savePreferences);
  Aura.atmosphere.init(preferences);
})();
