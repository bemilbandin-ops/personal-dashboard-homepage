import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const source = await readFile(new URL("../src/weather.js", import.meta.url), "utf8");
const stored = new Map();
const context = {
  window: {},
  URLSearchParams,
  fetch: async () => { throw new Error("unexpected fetch"); }
};
context.Aura = context.window.Aura = {
  config: { weather: { location: "Fristad", latitude: 57.8248, longitude: 13.0109 } },
  storage: {
    get: (key, fallback) => stored.has(key) ? stored.get(key) : fallback,
    set: (key, value) => { stored.set(key, value); return true; }
  }
};
vm.runInNewContext(source, context);
const weather = context.Aura.weather;

function forecast(tempC) {
  return {
    current: {
      temperature_2m: tempC,
      weather_code: 0,
      wind_speed_10m: 0,
      precipitation: 0,
      rain: 0,
      time: "2026-07-04T12:00"
    },
    daily: {
      time: [],
      weather_code: [],
      temperature_2m_max: [],
      temperature_2m_min: [],
      precipitation_sum: []
    }
  };
}

test("coordinates stay inside geographic bounds", async () => {
  assert.deepEqual(
    JSON.parse(JSON.stringify(await weather.resolveLocation("57.82, 13.01"))),
    { location: "57.82, 13.01", latitude: 57.82, longitude: 13.01 }
  );
  await assert.rejects(() => weather.resolveLocation("91, 13"), /coordinates/i);
  await assert.rejects(() => weather.resolveLocation("57, 181"), /coordinates/i);
});

test("an older weather response cannot replace a newer response", async () => {
  const responses = [];
  context.fetch = () => new Promise(resolve => responses.push(resolve));

  const first = weather.refresh(true);
  await Promise.resolve();
  const second = weather.refresh(true);
  await Promise.resolve();

  responses[1]({ ok: true, json: async () => forecast(20) });
  await second;
  responses[0]({ ok: true, json: async () => forecast(10) });
  await first;

  assert.equal(weather.current.tempC, 20);
});
