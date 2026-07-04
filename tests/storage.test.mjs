import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const source = name => readFileSync(new URL(`../src/${name}.js`, import.meta.url), "utf8");

function loadStorage(localStorage, alert = () => {}) {
  const context = { localStorage, alert };
  context.window = context;
  vm.runInNewContext(source("storage"), context);
  return context.Aura.storage;
}

function classList() {
  const values = new Set();
  return {
    add: value => values.add(value),
    remove: value => values.delete(value),
    contains: value => values.has(value)
  };
}

function loadNotes(setResult) {
  const callbacks = [];
  const context = {
    Aura: { storage: { get: (_key, fallback) => fallback, set: () => setResult } },
    clearTimeout() {},
    crypto: { randomUUID: () => "note-id" },
    Date,
    Math,
    prompt: (_message, fallback) => fallback,
    setTimeout: fn => { callbacks.push(fn); return callbacks.length; }
  };
  context.window = context;
  vm.runInNewContext(source("notes"), context);
  return { notes: context.Aura.notes, callbacks };
}

test("storage set returns true and stores JSON", () => {
  let write;
  const storage = loadStorage({ setItem: (key, value) => { write = [key, value]; } });

  assert.equal(storage.set("example", { saved: true }), true);
  assert.deepEqual(write, ["aura:example", '{"saved":true}']);
});

test("storage set returns false without alerting when a write fails", () => {
  let alerted = false;
  const storage = loadStorage({ setItem: () => { throw new Error("full"); } }, () => { alerted = true; });

  assert.equal(storage.set("example", "value"), false);
  assert.equal(alerted, false);
});

test("scratchpad queueSave reports a failed write", () => {
  let callback;
  const context = {
    Aura: { storage: { set: () => false } },
    clearTimeout() {},
    setTimeout: fn => { callback = fn; }
  };
  context.window = context;
  vm.runInNewContext(source("widgets"), context);
  const widgets = context.Aura.widgets;
  widgets.notes = { value: "draft" };
  widgets.status = { textContent: "", classList: classList() };

  widgets.queueSave();
  callback();

  assert.equal(widgets.status.textContent, "Not saved");
  assert.equal(widgets.status.classList.contains("saving"), false);
});

test("failed note saves stay Not saved after delayed status callbacks", () => {
  const { notes, callbacks } = loadNotes(false);
  notes.textarea = { value: "Keep this note" };
  notes.status = { textContent: "", classList: classList() };
  notes.render = () => {};

  assert.equal(notes.saveAll(), false);
  notes.saveCurrent();
  callbacks.forEach(callback => callback());

  assert.equal(notes.status.textContent, "Not saved");
});

test("empty note status is not replaced by Saved", () => {
  const { notes, callbacks } = loadNotes(true);
  notes.textarea = { value: "  " };
  notes.status = { textContent: "", classList: classList() };

  notes.saveCurrent();
  callbacks.forEach(callback => callback());

  assert.equal(notes.status.textContent, "Nothing to save");
});
