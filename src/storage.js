window.Aura = window.Aura || {};

Aura.storage = {
  prefix: "aura:",
  syncKeys: new Set(["preferences", "scratchpad", "tasks", "focus-history"]),
  _readyPromise: null,
  _syncScriptPromise: null,
  _fullKey(key) {
    return this.prefix + key;
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

  set(key, value) {
    const saved = this.setLocalOnly(key, value);
    if (saved) {
      localStorage.setItem(this._fullKey('_meta:' + key), Date.now().toString());
      if (this.syncKeys.has(key)) Aura.sync?.queueSave?.(key, value);
    }
    return saved;
  },
  setLocalOnly(key, value) {
    try {
      localStorage.setItem(this._fullKey(key), JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  },
  removeLocalOnly(key) {
    localStorage.removeItem(this._fullKey(key));
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
      script.src = "src/sync.js?v=sync-20260705-2";
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
