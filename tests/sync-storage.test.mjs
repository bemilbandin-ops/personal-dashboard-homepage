import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const storageSource = readFileSync(new URL("../src/storage.js", import.meta.url), "utf8");
const syncSource = readFileSync(new URL("../src/sync.js", import.meta.url), "utf8");

function memoryStorage() {
  const data = new Map();
  return {
    getItem: key => data.has(key) ? data.get(key) : null,
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: key => data.delete(key),
    key: index => [...data.keys()][index] ?? null,
    get length() { return data.size; }
  };
}

function loadStorage() {
  const queued = [];
  const context = {
    localStorage: memoryStorage(),
    setTimeout() {},
    Aura: { sync: { queueSave: (key, value) => queued.push([key, value]) } }
  };
  context.window = context;
  vm.runInNewContext(storageSource, context);
  return { context, storage: context.Aura.storage, queued };
}

test("shortcut changes are dirty and queued for sync", () => {
  const { storage, queued } = loadStorage();
  const value = [{ id: "one", title: "One" }];
  assert.equal(storage.set("shortcuts", value), true);
  assert.equal(storage.isDirty("shortcuts"), true);
  assert.deepEqual(queued, [["shortcuts", value]]);
});

test("remote snapshots clear dirty state", () => {
  const { storage } = loadStorage();
  storage.set("preferences", { iconset: "radix" });
  assert.equal(storage.isDirty("preferences"), true);
  storage.setFromSync("preferences", { iconset: "default" }, 1234);
  assert.equal(storage.isDirty("preferences"), false);
  assert.equal(storage.getSyncedAt("preferences"), 1234);
  assert.equal(storage.get("preferences", null).iconset, "default");
});

test("sync covers semantic settings but excludes caches and viewport layout", () => {
  const { context, storage } = loadStorage();
  context.Aura.storage = storage;
  vm.runInNewContext(syncSource, context);
  const keys = new Set(context.Aura.sync.keys);
  for (const key of ["shortcuts", "weather:location", "notes-library", "focus-timer", "atmosphere", "time-tools:alarms"]) {
    assert.equal(keys.has(key), true, `${key} should sync`);
  }
  assert.equal(keys.has("weather:current"), false);
  assert.equal(keys.has("widgets-layout"), false);
});
