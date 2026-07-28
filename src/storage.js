window.Aura = window.Aura || {};

Aura.storage = {
  prefix: "aura:",
  syncKeys: new Set([
    "preferences",
    "shortcuts",
    "scratchpad",
    "notes-library",
    "tasks",
    "focus-timer",
    "focus-history",
    "atmosphere",
    "time-tools:alarms",
    "weather:location"
  ]),
  _readyPromise: null,
  _syncScriptPromise: null,

  _fullKey(key) {
    return this.prefix + key;
  },

  _stateKey(type, key) {
    return this._fullKey(`_${type}:${key}`);
  },

  has(key) {
    return localStorage.getItem(this._fullKey(key)) !== null;
  },

  get(key, fallback) {
    try {
      const value = localStorage.getItem(this._fullKey(key));
      return value === null ? fallback : JSON.parse(value);
    } catch {
      return fallback;
    }
  },

  getModifiedAt(key) {
    const value = Number(localStorage.getItem(this._stateKey("meta", key)));
    return Number.isFinite(value) ? value : 0;
  },

  getSyncedAt(key) {
    const value = Number(localStorage.getItem(this._stateKey("synced", key)));
    return Number.isFinite(value) ? value : 0;
  },

  isDirty(key) {
    return localStorage.getItem(this._stateKey("dirty", key)) === "1";
  },

  markDirty(key, modifiedAt = Date.now()) {
    if (!this.syncKeys.has(key)) return;
    localStorage.setItem(this._stateKey("meta", key), String(modifiedAt));
    localStorage.setItem(this._stateKey("dirty", key), "1");
  },

  markSynced(key, syncedAt = Date.now()) {
    if (!this.syncKeys.has(key)) return;
    const timestamp = Number.isFinite(Number(syncedAt)) ? Number(syncedAt) : Date.now();
    localStorage.setItem(this._stateKey("meta", key), String(timestamp));
    localStorage.setItem(this._stateKey("synced", key), String(timestamp));
    localStorage.removeItem(this._stateKey("dirty", key));
  },

  set(key, value) {
    const saved = this.setLocalOnly(key, value);
    if (!saved || !this.syncKeys.has(key)) return saved;

    this.markDirty(key);
    Aura.sync?.queueSave?.(key, value);
    return true;
  },

  setLocalOnly(key, value) {
    try {
      localStorage.setItem(this._fullKey(key), JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  },

  setFromSync(key, value, syncedAt) {
    const saved = this.setLocalOnly(key, value);
    if (saved) this.markSynced(key, syncedAt);
    return saved;
  },

  removeLocalOnly(key) {
    localStorage.removeItem(this._fullKey(key));
  },

  removeFromSync(key) {
    this.removeLocalOnly(key);
    localStorage.removeItem(this._stateKey("meta", key));
    localStorage.removeItem(this._stateKey("synced", key));
    localStorage.removeItem(this._stateKey("dirty", key));
  },

  clear() {
    Object.keys(localStorage)
      .filter(key => key.startsWith(this.prefix))
      .forEach(key => localStorage.removeItem(key));

    return Aura.sync?.clearCloud?.();
  },

  loadSyncScript() {
    if (Aura.sync) return Promise.resolve();
    if (this._syncScriptPromise) return this._syncScriptPromise;

    this._syncScriptPromise = new Promise(resolve => {
      const existing = document.querySelector('script[data-aura-sync="true"]');
      if (existing) {
        existing.addEventListener("load", () => resolve(), { once: true });
        existing.addEventListener("error", () => resolve(), { once: true });
        return;
      }

      const script = document.createElement("script");
      script.src = "src/sync.js?v=sync-20260728-1";
      script.defer = true;
      script.dataset.auraSync = "true";
      script.addEventListener("load", () => resolve(), { once: true });
      script.addEventListener("error", () => resolve(), { once: true });
      document.head.append(script);
    });

    return this._syncScriptPromise;
  },

  ready() {
    if (!this._readyPromise) {
      this._readyPromise = (async () => {
        await this.loadSyncScript();
        await Aura.sync?.init?.();
      })().catch(error => {
        console.warn("Aura sync could not initialize", error);
      });
    }

    return this._readyPromise;
  }
};

const startAuraSync = () => Aura.storage.ready();
if (typeof queueMicrotask === "function") queueMicrotask(startAuraSync);
else if (typeof setTimeout === "function") setTimeout(startAuraSync, 0);
