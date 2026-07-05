window.Aura = window.Aura || {};

Aura.syncConfig = Aura.syncConfig || {
  url: "https://bwcuqgchaskkrblpmkmd.supabase.co",
  anonKey: ["sb_publishable_e1FKf4_ZZmIViuEQrqQXCw", "_lMc54T-P"].join("")
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
  channel: null,
  status: "Sync not configured",
  lastError: null,

  isConfigured() {
    const { url, anonKey } = Aura.syncConfig || {};
    return Boolean(url && anonKey && !url.includes("YOUR_SUPABASE") && !anonKey.includes("YOUR_SUPABASE"));
  },

  getUser() { return this.user; },
  getStatus() { return this.status; },

  onChange(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  },

  notify() {
    this.listeners.forEach(listener => listener(this.getState()));
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
        if (this.user) {
          this.pull().catch(error => this.setStatus("Cloud sync failed", error));
          this.subscribeLive().catch(error => this.setStatus("Live sync failed", error));
        } else {
          this.unsubscribeLive();
        }
      });

      if (this.user) {
        this.setStatus(`Signed in as ${this.user.email}`);
        await this.pull({ skipInit: true });
        await this.subscribeLive({ skipInit: true });
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
      script.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
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
      await this.pull({ skipInit: true });
      await this.subscribeLive({ skipInit: true });
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
    await this.pull({ skipInit: true });
    await this.subscribeLive({ skipInit: true });
    return data;
  },

  async signOut() {
    await this.init();
    if (!this.client) return;

    await this.unsubscribeLive();
    const { error } = await this.client.auth.signOut();
    if (error) throw error;

    this.session = null;
    this.user = null;
    this.cloudKeys.clear();
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

    const { error } = await this.client
      .from(this.table)
      .upsert({
        user_id: this.user.id,
        key,
        value: value === undefined ? null : value,
        updated_at: new Date().toISOString()
      }, { onConflict: "user_id,key" });

    if (error) throw error;
    this.cloudKeys.add(key);
    this.setStatus(`Synced as ${this.user.email}`);
  },

  async subscribeLive({ skipInit = false } = {}) {
    if (!skipInit) await this.init();
    if (!this.client || !this.user || this.channel) return;

    this.channel = this.client
      .channel(`aura-live-${this.user.id}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: this.table,
        filter: `user_id=eq.${this.user.id}`
      }, payload => this.applyRemoteChange(payload))
      .subscribe(status => {
        if (status === "SUBSCRIBED") this.setStatus(`Live sync on as ${this.user.email}`);
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") this.setStatus("Live sync unavailable", new Error(status));
      });
  },

  async unsubscribeLive() {
    if (!this.channel || !this.client) return;
    const channel = this.channel;
    this.channel = null;
    await this.client.removeChannel(channel);
  },

  valuesMatch(a, b) {
    try { return JSON.stringify(a) === JSON.stringify(b); }
    catch { return a === b; }
  },

  applyRemoteChange(payload) {
    const row = payload.new || payload.old || {};
    const key = row.key;
    if (!this.keys.includes(key)) return;

    const value = payload.eventType === "DELETE" ? null : row.value;
    const current = Aura.storage.get(key, null);
    if (this.valuesMatch(current, value)) return;

    if (value === null) Aura.storage.removeLocalOnly(key);
    else Aura.storage.setLocalOnly(key, value);

    this.cloudKeys.add(key);
    this.setStatus(`Live synced as ${this.user.email}`);

    if (key === "scratchpad") {
      const scratchpad = document.getElementById("scratchpad");
      if (scratchpad) scratchpad.value = value || "";
      const saveStatus = document.getElementById("save-status");
      if (saveStatus) saveStatus.textContent = "Live synced";
      return;
    }

    setTimeout(() => location.reload(), 150);
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
