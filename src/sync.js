window.Aura = window.Aura || {};

Aura.syncConfig = Aura.syncConfig || {
  url: "https://bwcuqgchaskkrblpmkmd.supabase.co",
  anonKey: ""
};

Aura.sync = {
  table: "user_settings",
  keys: ["preferences", "scratchpad", "tasks", "focus-history"],
  client: null,
  user: null,
  session: null,
  initialized: false,
  readyPromise: null,
  sdkPromise: null,
  saveTimers: new Map(),
  listeners: new Set(),
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
  getState() {
    return {
      configured: this.isConfigured(),
      user: this.user,
      status: this.status,
      lastError: this.lastError
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
        await this.pull();
      } else {
        this.setStatus("Not signed in");
      }
    } catch (error) {
      this.setStatus("Cloud sync unavailable", error);
    } finally {
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
      await this.pull();
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
    await this.pull();
    return data;
  },
  async signOut() {
    await this.init();
    if (!this.client) return;

    const { error } = await this.client.auth.signOut();
    if (error) throw error;

    this.session = null;
    this.user = null;
    this.setStatus("Not signed in");
  },
  requireClient() {
    if (!this.client) throw new Error("Add your Supabase Project URL and anon public key in src/sync.js first.");
  },
  async pull() {
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

    await Promise.all(this.keys
      .filter(key => !seen.has(key) && Aura.storage.has(key))
      .map(key => this.saveNow(key, Aura.storage.get(key, null))));

    this.setStatus(`Signed in as ${this.user.email}`);
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
  async saveNow(key, value) {
    if (!this.keys.includes(key)) return;
    await this.init();
    if (!this.client || !this.user) return;

    const { error } = await this.client
      .from(this.table)
      .upsert({
        user_id: this.user.id,
        key,
        value,
        updated_at: new Date().toISOString()
      }, { onConflict: "user_id,key" });

    if (error) throw error;
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
    this.setStatus("Cloud data cleared");
  }
};
