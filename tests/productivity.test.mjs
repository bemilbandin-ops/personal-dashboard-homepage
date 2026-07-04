import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

process.env.TZ = "Europe/Berlin";

const source = await readFile(new URL("../src/productivity.js", import.meta.url), "utf8");
const context = { window: {}, crypto: { randomUUID: () => "task-1" } };
context.window.Aura = {};
context.Aura = context.window.Aura;
vm.runInNewContext(source, context);
const productivity = context.Aura.productivity;
const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
const appSource = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
const styles = await readFile(new URL("../src/styles.css", import.meta.url), "utf8");

test("restores a running timer from its end timestamp", () => {
  assert.equal(productivity.remaining({ running: true, remainingMs: 1500000, endsAt: 1600000 }, 100000), 1500000);
});

test("expired timers return zero", () => {
  assert.equal(productivity.remaining({ running: true, endsAt: 1000 }, 2000), 0);
});

test("paused timers retain their remaining time", () => {
  assert.equal(productivity.remaining({ running: false, remainingMs: 1200 }, 5000), 1200);
});

test("expired restored timers complete at their saved deadline", () => {
  const timer = { running: true, endsAt: 1_000 };
  assert.equal(productivity.completionTime(timer, 86_401_000), 1_000);
});

test("completion timestamps never point into the future", () => {
  const timer = { running: true, endsAt: 2_000 };
  assert.equal(productivity.completionTime(timer, 1_000), 1_000);
});

test("addDays follows local calendar days across daylight-saving changes", () => {
  const spring = new Date(2026, 2, 29, 0, 0, 0, 0).getTime();
  const autumn = new Date(2026, 9, 25, 0, 0, 0, 0).getTime();
  assert.equal(new Date(productivity.addDays(spring, 1)).getHours(), 0);
  assert.equal(new Date(productivity.addDays(autumn, 1)).getHours(), 0);
});

test("blank tasks are rejected", () => {
  assert.equal(productivity.addTask([], "   "), null);
});

test("tasks can be added, toggled, and removed", () => {
  const added = productivity.addTask([], "  Ship Task 4  ");
  assert.equal(JSON.stringify(added), JSON.stringify([{ id: "task-1", title: "Ship Task 4", completed: false }]));
  assert.equal(productivity.toggleTask(added, "task-1")[0].completed, true);
  assert.equal(productivity.removeTask(added, "task-1").length, 0);
});

test("the dashboard loads and wires the productivity UI", () => {
  assert.match(html, /src="src\/productivity\.js"/);
  assert.ok(html.indexOf("src/productivity.js") < html.indexOf("src/app.js"));
  assert.match(appSource, /Aura\.productivity\.init\(\)/);
  assert.match(appSource, /showView\("productivity"\)/);
  assert.match(appSource, /Aura\.productivity\.start\(\)/);
  assert.match(styles, /\.focus-timer/);
  assert.match(styles, /\.task-list/);
});
