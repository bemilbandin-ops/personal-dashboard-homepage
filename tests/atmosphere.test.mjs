import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const source = await readFile(new URL("../src/atmosphere.js", import.meta.url), "utf8");
const context = { window: {}, Aura: {} };
context.window.Aura = context.Aura;
vm.runInNewContext(source, context);
const atmosphere = context.Aura.atmosphere;

test("normalizes persisted atmosphere controls", () => {
  assert.equal(JSON.stringify(atmosphere.normalize({
    enabled: false,
    intensity: "high",
    speed: 2,
    preset: "ocean"
  })), JSON.stringify({ enabled: false, intensity: "high", speed: 2, preset: "ocean" }));

  assert.equal(JSON.stringify(atmosphere.normalize({
    enabled: "yes",
    intensity: "loud",
    speed: 99,
    preset: "sunset"
  })), JSON.stringify({ enabled: true, intensity: "medium", speed: 2, preset: "ether" }));
});
