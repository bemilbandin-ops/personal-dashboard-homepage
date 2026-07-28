window.Aura = window.Aura || {};

Aura.syncConfig = Aura.syncConfig || {
  url: "https://bwcuqgchaskkrblpmkmd.supabase.co",
  anonKey: "sb_publishable_e1FKf4_ZZmIViuEQrqQXCw_lMc54T-P"
};

Aura.sync = {
  table: "user_settings",
  keys: [...(Aura.storage?.syncKeys || [])],
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
  pendingRemote: new Map(),
  realtimeChannel: null,
  notifyTimer: null,
  reloadTimer: null,
  reconnectBound: false,
  needsInitialReconcile: false,
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

  valuesEqual(left, right) {
    try {
      return JSON.stringify(left) === JSON.stringify(right);
    } catch {
      return left === right;
    }
  },

  timestamp(value) {
    const timestamp = new Date(value || 0).getTime();
    return Number.isFinite(timestamp) ? timestamp : 0;
  },

  schedulePageRefresh() {
    if (this.reloadTimer) return;
    this.reloadTimer = setTimeout(() => {
      this.reloadTimer = null;
      if (typeof location !== "undefined" && typeof location.reload === "function") location.reload();
    }, 250);
  },

  rememberPending(key, pending) {
    const current = this.pendingRemote.get(key);
    const currentTime = this.timestamp(current?.row?.updated_at);
    const nextTime = this.timestamp(pending?.row?.updated_at);
    if (!current || !currentTime || !nextTime || nextTime >= currentTime) {
      this.pendingRemote.set(key, pending);
    }
  },

  applyRemoteRow(row, { refresh = true } = {}) {
    const key = row?.key;
    if (!key || !this.keys.includes(key)) return false;

    const updatedAt = this.timestamp(row.updated_at) || Date.now();
    const knownUpdatedAt = this.cloudTimestamps.get(key) || 0;
    if (knownUpdatedAt && updatedAt < knownUpdatedAt) return false;

    if (Aura.storage.isDirty(key)) {
      this.rememberPending(key, { type: "upsert", row });
      return false;
    }

    const changed = !Aura.storage.has(key) || !this.valuesEqual(Aura.storage.get(key, null), row.value);
    Aura.storage.setFromSync(key, row.value, updatedAt);
    this.cloudKeys.add(key);
    this.cloudTimestamps.set(key, updatedAt);
    if (changed && refresh) this.schedulePageRefresh();
    this.scheduleNotify();
    return changed;
  },

  applyRemoteDelete(key, { refresh = true } = {}) {
    if (!key || !this.keys.includes(key)) return false;
    if (Aura.storage.isDirty(key)) {
      this.rememberPending(key, { type: "delete", key });
      return false;
    }

    const changed = Aura.storage.has(key);
    Aura.storage.removeFromSync(key);
    this.cloudKeys.delete(key);
    this.cloudTimestamps.delete(key);
    if (changed && refresh) this.schedulePageRefresh();
    this.scheduleNotify();
    return changed;
  },

  async reconcileRealtimeDelete(key) {
    if (!key || !this.keys.includes(key)) return;
    const current = await this.fetchKey(key);
    if (current) this.applyRemoteRow(current);
    else this.applyRemoteDelete(key);
  },

  setupRealtime() {
    if (!this.client || !this.user) return;
    if (this.realtimeChannel) this.client.removeChannel(this.realtimeChannel);

    this.realtimeChannel = this.client
      .channel(`user-settings-sync:${this.user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: this.table,
          filter: `user_id=eq.${this.user.id}`
        },
        payload => {
          if (payload.eventType === "DELETE") {
            this.reconcileRealtimeDelete(payload.old?.key)
              .catch(error => this.setStatus("Cloud sync failed", error));
            return;
          }
          if (payload.new?.key) this.applyRemoteRow(payload.new);
        }
      )
      .subscribe();
  },

  setupReconnect() {
    if (this.reconnectBound || typeof addEventListener !== "function") return;
    this.reconnectBound = true;
    addEventListener("online", () => {
      this.pushLocal().catch(error => this.setStatus("Cloud retry failed", error));
    });
  },

  async init() {
    if (this.readyPromise) return this.readyPromise;
    this.readyPromise = this._init();
    return this.readyPromise;
  },

  createStorageAdapter() {
    if (typeof chrome !== "undefined" && chrome.storage?.local) {
      const prefix = "sb-auth-";
      return {
        async getItem(key) {
          const result = await chrome.storage.local.get(prefix + key);
          return result[prefix + key] ?? null;
        },
        async setItem(key, value) {
          await chrome.storage.local.set({ [prefix + key]: value });
        },
        async removeItem(key) {
          await chrome.storage.local.remove(prefix + key);
        }
      };
    }
    return localStorage;
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
      this.client = window.supabase.createClient(url, anonKey, {
        auth: {
          storage: this.createStorageAdapter(),
          autoRefreshToken: true,
          persistSession: true
        }
      });

      const { data, error } = await this.client.auth.getSession();
      if (error) throw error;

      this.session = data.session;
      this.user = data.session?.user || null;
      this.client.auth.onAuthStateChange((_event, session) => {
        this.session = session;
        this.user = session?.user || null;
        if (this.user) {
          this.setupRealtime();
          this.setStatus(`Signed in as ${this.user.email}`);
        } else {
          this.teardownRealtime();
          this.setStatus("Not signed in");
        }
      });

      this.setupReconnect();
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
      this.needsInitialReconcile = true;
      this.setupRealtime();
      this.setStatus(`Signed in as ${this.user.email}`);
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
    this.needsInitialReconcile = true;
    this.setupRealtime();
    this.setStatus(`Signed in as ${this.user.email}`);
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
    this.pendingRemote.clear();
    this.needsInitialReconcile = false;
    this.teardownRealtime();
    this.setStatus("Not signed in");
  },

  teardownRealtime() {
    if (this.realtimeChannel && this.client) this.client.removeChannel(this.realtimeChannel);
    this.realtimeChannel = null;
  },

  requireClient() {
    if (!this.client) throw new Error("Add your Supabase Project URL and anon public key in src/sync.js first.");
  },

  async fetchCloudRows() {
    const { data, error } = await this.client
      .from(this.table)
      .select("key,value,updated_at")
      .eq("user_id", this.user.id)
      .in("key", this.keys);
    if (error) throw error;
    return data || [];
  },

  async pull({ skipInit = false } = {}) {
    if (!skipInit) await this.init();
    if (!this.client || !this.user) return;

    const rows = await this.fetchCloudRows();
    const byKey = new Map(rows.filter(row => this.keys.includes(row.key)).map(row => [row.key, row]));
    this.cloudKeys = new Set(byKey.keys());
    const keysToPush = [];

    for (const key of this.keys) {
      const row = byKey.get(key);
      if (!row) {
        if (Aura.storage.has(key)) {
          Aura.storage.markDirty(key, Aura.storage.getModifiedAt(key) || Date.now());
          keysToPush.push(key);
        }
        continue;
      }

      const cloudUpdatedAt = this.timestamp(row.updated_at);
      this.cloudTimestamps.set(key, cloudUpdatedAt);
      if (Aura.storage.isDirty(key)) {
        keysToPush.push(key);
        continue;
      }

      const localModifiedAt = Aura.storage.getModifiedAt(key);
      const syncedAt = Aura.storage.getSyncedAt(key);
      if (Aura.storage.has(key) && !syncedAt && localModifiedAt > cloudUpdatedAt) {
        Aura.storage.markDirty(key, localModifiedAt);
        keysToPush.push(key);
        continue;
      }

      this.applyRemoteRow(row);
    }

    await Promise.all(keysToPush.map(key => this.saveNow(key, Aura.storage.get(key, null), { skipInit: true })));
    this.needsInitialReconcile = false;
    this.setStatus(`Synced as ${this.user.email}`);
  },

  async pushLocal({ skipInit = false } = {}) {
    if (!skipInit) await this.init();
    if (!this.client || !this.user) return;
    if (this.needsInitialReconcile) return this.pull({ skipInit: true });

    await Promise.all(this.keys
      .filter(key => Aura.storage.has(key) && Aura.storage.isDirty(key))
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

  async fetchKey(key) {
    const { data, error } = await this.client
      .from(this.table)
      .select("key,value,updated_at")
      .eq("user_id", this.user.id)
      .eq("key", key)
      .maybeSingle();
    if (error) throw error;
    return data || null;
  },

  async saveNow(key, value, { skipInit = false } = {}) {
    if (!this.keys.includes(key)) return;
    if (!skipInit) await this.init();
    if (!this.client || !this.user || !Aura.storage.isDirty(key)) return;

    const { data, error } = await this.client
      .from(this.table)
      .upsert({
        user_id: this.user.id,
        key,
        value: value === undefined ? null : value
      }, { onConflict: "user_id,key" })
      .select("key,value,updated_at")
      .single();

    if (error) throw error;
    const updatedAt = this.timestamp(data?.updated_at) || Date.now();
    Aura.storage.markSynced(key, updatedAt);
    this.cloudKeys.add(key);
    this.cloudTimestamps.set(key, updatedAt);

    if (this.pendingRemote.has(key)) {
      this.pendingRemote.delete(key);
      const current = await this.fetchKey(key);
      if (current) this.applyRemoteRow(current);
      else this.applyRemoteDelete(key);
    }

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
    this.cloudTimestamps.clear();
    this.pendingRemote.clear();
    this.setStatus("Cloud data cleared");
  }
};
