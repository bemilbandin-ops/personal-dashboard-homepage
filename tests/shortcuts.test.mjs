import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

function loadShortcuts(Aura = {
  config: { spaces: [] },
  storage: { get: (_key, fallback) => fallback, set() {} }
}) {
  const context = {
    crypto: { randomUUID: () => "generated-id" },
    Aura
  };
  context.window = context;
  vm.runInNewContext(readFileSync(new URL("../src/shortcuts.js", import.meta.url), "utf8"), context);
  return context.Aura.shortcuts;
}

function loadLauncher(token = "") {
  const context = { Aura: { launcherToken: token }, TextEncoder, btoa };
  context.window = context;
  vm.runInNewContext(readFileSync(new URL("../src/shortcuts.js", import.meta.url), "utf8"), context);
  return context.Aura.launcher;
}

test("validate accepts full registered-scheme web targets", () => {
  const shortcuts = loadShortcuts();
  assert.equal(shortcuts.validate({ title: "Site", type: "web", target: "https://example.com" }), true);
  assert.equal(shortcuts.validate({ title: "Music", type: "web", target: "spotify:" }), true);
  assert.equal(shortcuts.validate({ title: "Relative", type: "web", target: "example.com" }), false);
  assert.equal(shortcuts.validate({ title: "Script", type: "web", target: "javascript:alert(1)" }), false);
  assert.equal(shortcuts.validate({ title: "Data", type: "web", target: "data:text/html,<h1>unsafe</h1>" }), false);
  assert.equal(shortcuts.validate({ title: "Legacy script", type: "web", target: "VbScRiPt:msgbox(1)" }), false);
});

test("validate only accepts absolute executable or shortcut Windows targets", () => {
  const shortcuts = loadShortcuts();
  assert.equal(shortcuts.validate({ title: "Editor", type: "windows", target: "C:\\Apps\\Editor.exe" }), true);
  assert.equal(shortcuts.validate({ title: "Editor", type: "windows", target: "C:/Apps/Editor.LNK" }), true);
  assert.equal(shortcuts.validate({ title: "Relative", type: "windows", target: "Apps\\Editor.exe" }), false);
  assert.equal(shortcuts.validate({ title: "Script", type: "windows", target: "C:\\Apps\\run.cmd" }), false);
  assert.equal(shortcuts.validate({ title: "Remote", type: "windows", target: "https://example.com/app.exe" }), false);
  assert.equal(shortcuts.validate({ title: "Missing", type: "windows", target: "" }), false);
});

test("normalize trims records, supplies defaults and removes empty entries", () => {
  const shortcuts = loadShortcuts();
  const result = shortcuts.normalize([
    { id: " saved ", title: " Docs ", type: "web", target: " https://example.com ", showOnHome: false },
    { title: " Music ", target: " spotify: " },
    { title: "   ", target: "https://empty-title.example" },
    { title: "Empty target", target: "   " }
  ]);

  assert.equal(JSON.stringify(result), JSON.stringify([
    { id: "saved", title: "Docs", type: "web", target: "https://example.com", showOnHome: false },
    { id: "generated-id", title: "Music", type: "web", target: "spotify:", showOnHome: true }
  ]));
});

test("load reads stored shortcuts and falls back to configured spaces", () => {
  const spaces = [
    { id: " fallback ", title: " Fallback ", target: " https://fallback.example " },
    { title: "", target: "https://discard.example" }
  ];
  let stored;
  const shortcuts = loadShortcuts({
    config: { spaces },
    storage: {
      get(key, fallback) {
        assert.equal(key, "shortcuts");
        assert.equal(fallback, spaces);
        return stored ?? fallback;
      },
      set() {}
    }
  });

  assert.equal(JSON.stringify(shortcuts.load()), JSON.stringify([
    { id: "fallback", title: "Fallback", type: "web", target: "https://fallback.example", showOnHome: true }
  ]));
  stored = [{ title: " Stored ", type: "windows", target: " C:\\Apps\\Stored.exe ", showOnHome: false }];
  assert.equal(JSON.stringify(shortcuts.load()), JSON.stringify([
    { id: "generated-id", title: "Stored", type: "windows", target: "C:\\Apps\\Stored.exe", showOnHome: false }
  ]));
});

test("save normalizes shortcuts before writing them", () => {
  let write;
  const shortcuts = loadShortcuts({
    config: { spaces: [] },
    storage: {
      get: (_key, fallback) => fallback,
      set(key, value) { write = [key, value]; }
    }
  });

  shortcuts.save([{ title: " Docs ", target: " https://example.com " }, { title: "", target: "spotify:" }]);
  assert.equal(JSON.stringify(write), JSON.stringify(["shortcuts", [
    { id: "generated-id", title: "Docs", type: "web", target: "https://example.com", showOnHome: true }
  ]]));
});

test("upsert replaces the record being edited", () => {
  const shortcuts = loadShortcuts();
  shortcuts.items = [
    { id: "keep", title: "Keep", type: "web", target: "https://keep.example", showOnHome: true },
    { id: "edit", title: "Old", type: "web", target: "https://old.example", showOnHome: true }
  ];
  shortcuts.editingId = "edit";
  shortcuts.save = () => {};
  shortcuts.renderAll = () => {};

  assert.equal(shortcuts.upsert({ title: "New", type: "web", target: "https://new.example", showOnHome: false }), "");
  assert.equal(JSON.stringify(shortcuts.items), JSON.stringify([
    { id: "keep", title: "Keep", type: "web", target: "https://keep.example", showOnHome: true },
    { id: "edit", title: "New", type: "web", target: "https://new.example", showOnHome: false }
  ]));
});

test("remove deletes one record", () => {
  const shortcuts = loadShortcuts();
  shortcuts.items = [{ id: "keep" }, { id: "remove" }];
  shortcuts.save = () => {};
  shortcuts.renderAll = () => {};

  shortcuts.remove("remove");

  assert.equal(JSON.stringify(shortcuts.items), JSON.stringify([{ id: "keep" }]));
});

test("homeItems returns at most six selected records", () => {
  const shortcuts = loadShortcuts();
  shortcuts.items = Array.from({ length: 10 }, (_, index) => ({ id: String(index), showOnHome: index !== 1 }));

  assert.equal(shortcuts.homeItems().length, 6);
  assert.equal(shortcuts.homeItems().some(item => item.id === "1"), false);
});

test("the home renderer uses the seeded shortcut target field", () => {
  const source = readFileSync(new URL("../src/shortcuts.js", import.meta.url), "utf8");
  assert.match(source, /return item\.target/);
});

test("launcher URLs require a token and encode the target", () => {
  assert.equal(loadLauncher().urlFor("C:\\Apps\\Editor.exe"), "");
  assert.equal(
    loadLauncher("secret").urlFor("C:\\Apps\\Editor.exe"),
    "aura-launch://open?token=secret&target=QzpcQXBwc1xFZGl0b3IuZXhl"
  );
});

test("preferences can close while required shortcut fields are blank", () => {
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  assert.match(html, /<button(?=[^>]*aria-label="Close preferences")(?=[^>]*formnovalidate)[^>]*>/);
});
