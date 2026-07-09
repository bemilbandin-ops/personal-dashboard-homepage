window.Aura = window.Aura || {};

Aura.syncConfig = Aura.syncConfig || {
  url: "https://bwcuqgchaskkrblpmkmd.supabase.co",
  anonKey: "sb_publishable_e1FKf4_ZZmIViuEQrqQXCw_lMc54T-P"
};

Aura.sync = {
  table: "user_settings",
  keys: ["preferences", "scratchpad", "tasks", "focus-history"],
  client: null,
  user: null,
  session: null,
  initialized: false,
  initializing: false,
  readyPromise: null,
  sdkPromise: null,
  saveTimers: new Map(),
  listeners: new Set(),
  cloudKeys: new Set(),
  cloudTimestamps: new Map(),
  lastPushedTimestamps: new Map(),
  realtimeChannel: null,
  notifyTimer: null,
  status: "Sync not configured",
  lastError: null,

  isConfigured() {
    const { url, anonKey } = Aura.syncConfig || {};
    return Boolean(
      url &&
      anonKey &&
      !url.includes("YOUR_SUPABASE") &&
      !anonKey.includes("YOUR_SUPABASE")
    );
  },

  getUser() {
    return this.user;
  },

  getStatus() {
    return this.status;
  },

  onChange(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  },

  notify() {
    this.listeners.forEach(listener => listener(this.getState()));
  },

  scheduleNotify() {
    if (this.notifyTimer) return;
    this.notifyTimer = setTimeout(() => {
      this.notifyTimer = null;
      this.notify();
    }, 100);
  },

  setupRealtime() {
    if (!this.client || !this.user) return;
    if (this.realtimeChannel) {
      this.client.removeChannel(this.realtimeChannel);
    }
    this.realtimeChannel = this.client
      .channel('user-settings-sync')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'user_settings',
          filter: `user_id=eq.${this.user.id}` },
        (payload) => {
          if (!payload.new || !payload.new.key) return;
          const key = payload.new.key;
          const incomingTs = new Date(payload.new.updated_at).getTime();

          // Ignore echoes of our own writes
          const lastPushed = this.lastPushedTimestamps.get(key);
          if (lastPushed && Math.abs(incomingTs - lastPushed) < 2000) return;

          Aura.storage.setLocalOnly(key, payload.new.value);
          this.cloudTimestamps.set(key, incomingTs);
          this.scheduleNotify();
        })
      .subscribe();
  },

  getState() {
    return {
      configured: this.isConfigured(),
      user: this.user,
      status: this.status,
      lastError: this.lastError,
      cloudKeys: [...this.cloudKeys]
    };
  },

  setStatus(status, error = null) {
    this.status = status;
    this.lastError = error;
    this.notify();
  },

  async init() {
    if (this.readyPromise) return this.readyPromise;
    this.readyPromise = this._init();
    return this.readyPromise;
  },

  async _init() {
    if (!this.isConfigured()) {
      this.setStatus("Sync not configured");
      this.initialized = true;
      return;
    }

    this.initializing = true;

    try {
      await this.loadSupabaseSdk();
      const { url, anonKey } = Aura.syncConfig;
      this.client = window.supabase.createClient(url, anonKey);

      const { data, error } = await this.client.auth.getSession();
      if (error) throw error;

      this.session = data.session;
      this.user = data.session?.user || null;

      this.client.auth.onAuthStateChange((_event, session) => {
        this.session = session;
        this.user = session?.user || null;
        this.setStatus(this.user ? `Signed in as ${this.user.email}` : "Not signed in");
        if (this.user) this.pull().catch(error => this.setStatus("Cloud sync failed", error));
      });

      if (this.user) {
        this.setStatus(`Signed in as ${this.user.email}`);
        this.setupRealtime();
        await this.pull({ skipInit: true });
      } else {
        this.setStatus("Not signed in");
      }
    } catch (error) {
      this.setStatus("Cloud sync unavailable", error);
    } finally {
      this.initializing = false;
      this.initialized = true;
    }
  },

  loadSupabaseSdk() {
    if (window.supabase?.createClient) return Promise.resolve();
    if (this.sdkPromise) return this.sdkPromise;

    this.sdkPromise = new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-supabase-js="true"]');
      if (existing) {
        existing.addEventListener("load", () => resolve(), { once: true });
        existing.addEventListener("error", () => reject(new Error("Supabase SDK unavailable")), { once: true });
        return;
      }

      const script = document.createElement("script");
      script.src = "src/supabase.js";
      script.defer = true;
      script.dataset.supabaseJs = "true";
      script.addEventListener("load", () => resolve(), { once: true });
      script.addEventListener("error", () => reject(new Error("Supabase SDK unavailable")), { once: true });
      document.head.append(script);
    });

    return this.sdkPromise;
  },

  async signUp(email, password) {
    await this.init();
    this.requireClient();

    const { data, error } = await this.client.auth.signUp({ email, password });
    if (error) throw error;

    this.session = data.session;
    this.user = data.session?.user || null;

    if (this.user) {
      this.setStatus(`Signed in as ${this.user.email}`);
      this.setupRealtime();
      await this.pull({ skipInit: true });
      await this.pushLocal({ skipInit: true });
    } else {
      this.setStatus("Account created. Check your email to confirm before logging in.");
    }

    return data;
  },

  async signIn(email, password) {
    await this.init();
    this.requireClient();

    const { data, error } = await this.client.auth.signInWithPassword({ email, password });
    if (error) throw error;

    this.session = data.session;
    this.user = data.user;
    this.setStatus(`Signed in as ${this.user.email}`);
    this.setupRealtime();
    await this.pull({ skipInit: true });
    await this.pushLocal({ skipInit: true });
    return data;
  },

  async signOut() {
    await this.init();
    if (!this.client) return;

    const { error } = await this.client.auth.signOut();
    if (error) throw error;

    this.session = null;
    this.user = null;
    this.cloudKeys.clear();
    this.cloudTimestamps.clear();
    if (this.realtimeChannel) {
      this.client.removeChannel(this.realtimeChannel);
      this.realtimeChannel = null;
    }
    this.setStatus("Not signed in");
  },

  requireClient() {
    if (!this.client) throw new Error("Add your Supabase Project URL and anon public key in src/sync.js first.");
  },

  async pull({ skipInit = false } = {}) {
    if (!skipInit) await this.init();
    if (!this.client || !this.user) return;

    const { data, error } = await this.client
      .from(this.table)
      .select("key,value,updated_at")
      .in("key", this.keys);

    if (error) throw error;

    const seen = new Set();
    (data || []).forEach(row => {
      if (!this.keys.includes(row.key)) return;
      Aura.storage.setLocalOnly(row.key, row.value);
      this.cloudTimestamps.set(row.key, new Date(row.updated_at).getTime());
      seen.add(row.key);
    });
    this.cloudKeys = seen;

    await Promise.all(this.keys
      .filter(key => !seen.has(key) && Aura.storage.has(key))
      .map(key => this.saveNow(key, Aura.storage.get(key, null), { skipInit: true })));

    this.setStatus(`Signed in as ${this.user.email}`);
  },

  async pushLocal({ skipInit = false } = {}) {
    if (!skipInit) await this.init();
    if (!this.client || !this.user) return;

    await Promise.all(this.keys
      .filter(key => Aura.storage.has(key))
      .map(key => this.saveNow(key, Aura.storage.get(key, null), { skipInit: true })));
  },

  queueSave(key, value) {
    if (!this.keys.includes(key)) return;

    clearTimeout(this.saveTimers.get(key));
    const timer = setTimeout(() => {
      this.saveTimers.delete(key);
      this.saveNow(key, value).catch(error => this.setStatus("Cloud save failed", error));
    }, 600);
    this.saveTimers.set(key, timer);
  },

  async saveNow(key, value, { skipInit = false } = {}) {
    if (!this.keys.includes(key)) return;
    if (!skipInit) await this.init();
    if (!this.client || !this.user) return;

    const localModifiedStr = localStorage.getItem(Aura.storage._fullKey('_meta:' + key));
    const localModifiedAt = localModifiedStr ? parseInt(localModifiedStr, 10) : 0;
    const cloudUpdatedAt = this.cloudTimestamps.get(key);

    if (cloudUpdatedAt && localModifiedAt <= cloudUpdatedAt) {
      return; // Skip upload (cloud is newer or same)
    }

    const now = new Date();
    const { error } = await this.client
      .from(this.table)
      .upsert({
        user_id: this.user.id,
        key,
        value: value === undefined ? null : value,
        updated_at: now.toISOString()
      }, { onConflict: "user_id,key" });

    if (error) throw error;
    this.cloudKeys.add(key);
    this.lastPushedTimestamps.set(key, now.getTime());
    this.setStatus(`Synced as ${this.user.email}`);
  },

  async clearCloud() {
    await this.init();
    if (!this.client || !this.user) return;

    const { error } = await this.client
      .from(this.table)
      .delete()
      .eq("user_id", this.user.id)
      .in("key", this.keys);

    if (error) throw error;
    this.cloudKeys.clear();
    this.setStatus("Cloud data cleared");
  }
};
