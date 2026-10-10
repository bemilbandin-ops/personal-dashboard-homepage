import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const source = readFileSync(new URL("../src/sync.js", import.meta.url), "utf8");
const appSource = readFileSync(new URL("../src/app.js", import.meta.url), "utf8");

function loadSync({ rows = [], local = {}, owner = null, userId = "user-1" } = {}) {
  const values = new Map(Object.entries(local).map(([key, value]) => [`aura:${key}`, JSON.stringify(value)]));
  if (owner) values.set("aura:_sync-user", owner);
  const writes = [];
  const localStorage = {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key)
  };
  const Aura = {
    storage: {
      _fullKey: key => `aura:${key}`,
      has: key => values.has(`aura:${key}`),
      get(key, fallback) {
        try { return JSON.parse(values.get(`aura:${key}`) ?? "null") ?? fallback; }
        catch { return fallback; }
      },
      setLocalOnly(key, value) {
        values.set(`aura:${key}`, JSON.stringify(value));
        return true;
      },
      removeLocalOnly: key => values.delete(`aura:${key}`)
    }
  };
  const context = { Aura, window: { Aura }, localStorage };
  vm.runInNewContext(source, context);
  Aura.sync.user = { id: userId, email: "user@example.com" };
  Aura.sync.client = {
    from() {
      return {
        select() { return this; },
        in(_column, keys) { return Promise.resolve({ data: rows.filter(row => keys.includes(row.key)), error: null }); },
        upsert(row) { writes.push(row); return Promise.resolve({ error: null }); }
      };
    }
  };
  return { sync: Aura.sync, values, writes };
}

test("startup waits for cloud pull before reading preferences and initializing modules", () => {
  const ready = appSource.indexOf("await Aura.storage.ready()");
  assert.ok(ready >= 0);
  assert.ok(ready < appSource.indexOf('Aura.storage.get("preferences"'));
  assert.ok(ready < appSource.indexOf("Aura.shortcuts.init()"));
});

test("first sync loads cloud preferences and keeps local shortcuts alongside cloud shortcuts", async () => {
  const localShortcut = { id: "local", title: "Local", target: "https://local.example" };
  const cloudShortcut = { id: "cloud", title: "Cloud", target: "https://cloud.example" };
  const { sync, values, writes } = loadSync({
    local: { shortcuts: [localShortcut], preferences: { isCelsius: true } },
    rows: [
      { key: "preferences", value: { isCelsius: false }, updated_at: "2026-10-10T12:00:00.000Z" },
      { key: "shortcuts", value: [cloudShortcut], updated_at: "2026-10-10T12:00:00.000Z" }
    ]
  });

  await sync.pull({ skipInit: true });

  assert.deepEqual(JSON.parse(values.get("aura:preferences")), { isCelsius: false });
  assert.deepEqual(JSON.parse(values.get("aura:shortcuts")).map(item => item.id), ["cloud", "local"]);
  assert.deepEqual(writes.map(row => row.key), ["shortcuts"]);
  assert.equal(values.get("aura:_sync-user"), "user-1");
});

test("switching accounts replaces local data and does not upload the previous account's values", async () => {
  const { sync, values, writes } = loadSync({
    owner: "user-a",
    local: { preferences: { theme: "private" }, scratchpad: "private note" },
    userId: "user-b",
    rows: [{ key: "preferences", value: { theme: "cloud" }, updated_at: "2026-10-10T12:00:00.000Z" }]
  });

  await sync.pull({ skipInit: true });

  assert.deepEqual(JSON.parse(values.get("aura:preferences")), { theme: "cloud" });
  assert.equal(values.has("aura:scratchpad"), false);
  assert.equal(writes.length, 0);
  assert.equal(values.get("aura:_sync-user"), "user-b");
});
