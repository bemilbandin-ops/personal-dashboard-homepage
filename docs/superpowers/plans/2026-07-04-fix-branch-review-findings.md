# Branch Review Findings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the `implementations` branch safe to merge by removing the exposed launcher credential and fixing every confirmed persistence, timer, weather, and test-suite defect.

**Architecture:** Keep the existing plain HTML/CSS/JavaScript structure. Fix behavior at the shared storage, timer, and weather boundaries; add only focused Node tests; preserve the Python launcher validator and existing UI.

**Tech Stack:** Browser JavaScript, Node.js built-in test runner, Python `unittest`, PowerShell, Web Storage, Fetch API.

---

## File Map

- Modify `.gitignore` to exclude the generated local launcher-token script.
- Modify `index.html` to load the empty tracked launcher configuration before the optional generated local configuration.
- Modify `launcher-helper/install.ps1` and `launcher-helper/uninstall.ps1` to write/remove only the ignored local configuration.
- Modify `src/launcher-config.js` so the tracked file contains no credential.
- Modify `README.md` to document rotation, generated files, live weather, and verification commands accurately.
- Create `tests/launcher-config.test.mjs` to prevent another committed launcher token.
- Modify `src/storage.js`, `src/widgets.js`, `src/notes.js`, and `src/shortcuts.js` to propagate persistence failures without blocking alerts or false success states.
- Create `tests/storage.test.mjs` for the storage success/failure contract and scratchpad status.
- Modify `src/productivity.js` and `tests/productivity.test.mjs` for correct completion timestamps and calendar-day arithmetic.
- Modify `src/weather.js` and `src/app.js` for coordinate validation, truthful status, and latest-request-wins behavior.
- Create `tests/weather.test.mjs` for validation and request ordering.

### Task 1: Remove and rotate the exposed launcher credential

**Files:**
- Modify: `.gitignore`
- Modify: `index.html:12`
- Modify: `launcher-helper/install.ps1:4-20`
- Modify: `launcher-helper/uninstall.ps1:3-11`
- Modify: `src/launcher-config.js:1-2`
- Modify: `README.md:43-75`
- Create: `tests/launcher-config.test.mjs`

- [ ] **Step 1: Write the failing repository-safety test**

Create `tests/launcher-config.test.mjs`:

```js
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = path => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("tracked launcher configuration never contains a generated token", async () => {
  const config = await read("src/launcher-config.js");
  assert.match(config, /Aura\.launcherToken = ["']{2}/);
  assert.doesNotMatch(config, /[a-f\d]{64}/i);
});

test("installer writes the token only to an ignored local file", async () => {
  const [ignore, install, uninstall] = await Promise.all([
    read(".gitignore"),
    read("launcher-helper/install.ps1"),
    read("launcher-helper/uninstall.ps1")
  ]);
  assert.match(ignore, /^src\/launcher-config\.local\.js$/m);
  assert.match(install, /launcher-config\.local\.js/);
  assert.match(uninstall, /launcher-config\.local\.js/);
  assert.doesNotMatch(install, /src\\launcher-config\.js/);
});
```

- [ ] **Step 2: Run the test and verify the credential leak is caught**

Run:

```powershell
node --test tests\launcher-config.test.mjs
```

Expected: FAIL because `src/launcher-config.js` contains a 64-character token and the generated local file is not ignored.

- [ ] **Step 3: Separate tracked defaults from the generated local token**

Set `src/launcher-config.js` to:

```js
window.Aura = window.Aura || {};
Aura.launcherToken = "";
```

Append this exact line to `.gitignore`:

```gitignore
src/launcher-config.local.js
```

Add the optional local script immediately after `src/launcher-config.js` in `index.html`:

```html
<script defer src="src/launcher-config.js"></script>
<script defer src="src/launcher-config.local.js"></script>
```

Change both PowerShell scripts to use:

```powershell
$configPath = Join-Path $repoRoot "src\launcher-config.local.js"
```

The installer keeps writing:

```powershell
[System.IO.File]::WriteAllText($configPath, "window.Aura = window.Aura || {};`nAura.launcherToken = '$token';`n", $utf8)
```

The uninstaller removes the generated script instead of rewriting a tracked file:

```powershell
Remove-Item -LiteralPath $configPath -Force -ErrorAction SilentlyContinue
```

- [ ] **Step 4: Update launcher documentation and rotate the local credential**

Update `README.md` to state that:

```markdown
- `src/launcher-config.js` is a tracked empty default.
- `src/launcher-config.local.js` and `launcher-helper/secret.txt` are generated locally and ignored.
- A token previously committed to git must be treated as compromised.
```

After the code change, rotate the installed token on any machine that ran the old installer:

```powershell
powershell -ExecutionPolicy Bypass -File .\launcher-helper\uninstall.ps1
powershell -ExecutionPolicy Bypass -File .\launcher-helper\install.ps1
```

Expected: a new ignored token file and secret are generated; `git status --short` does not list either generated file.

- [ ] **Step 5: Verify the security invariant**

Run:

```powershell
node --test tests\launcher-config.test.mjs
rg -n "[a-f0-9]{64}" src launcher-helper README.md --glob "!src/launcher-config.local.js" --glob "!launcher-helper/secret.txt"
git status --short --ignored
```

Expected: tests PASS; `rg` finds no credential in tracked source or documentation; generated files appear only as ignored after installation.

- [ ] **Step 6: Commit the launcher fix**

```powershell
git add .gitignore index.html launcher-helper/install.ps1 launcher-helper/uninstall.ps1 src/launcher-config.js README.md tests/launcher-config.test.mjs
git commit -m "fix: keep launcher token out of git"
```

The old token remains visible in already-published commits but is harmless after rotation. Rewrite branch history only if repository policy requires removing the dead value entirely.

### Task 2: Make storage failures truthful and non-blocking

**Files:**
- Modify: `src/storage.js:14-22`
- Modify: `src/widgets.js:116-124`
- Modify: `src/notes.js:20-41`
- Modify: `src/shortcuts.js:27-50`
- Create: `tests/storage.test.mjs`

- [ ] **Step 1: Write failing storage contract tests**

Create `tests/storage.test.mjs`:

```js
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const storageSource = await readFile(new URL("../src/storage.js", import.meta.url), "utf8");
const widgetsSource = await readFile(new URL("../src/widgets.js", import.meta.url), "utf8");

function loadStorage(localStorage) {
  const context = { window: {}, localStorage, alert: () => { throw new Error("alert called"); } };
  context.Aura = context.window.Aura = {};
  vm.runInNewContext(storageSource, context);
  return context.Aura.storage;
}

test("set returns true after a successful write", () => {
  const values = new Map();
  const storage = loadStorage({
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key)
  });
  assert.equal(storage.set("note", "saved"), true);
  assert.equal(values.get("aura:note"), '"saved"');
});

test("set returns false without opening an alert when storage throws", () => {
  const storage = loadStorage({
    getItem: () => null,
    setItem: () => { throw new DOMException("full", "QuotaExceededError"); },
    removeItem() {}
  });
  assert.equal(storage.set("note", "lost"), false);
});

test("scratchpad reports a failed write instead of Saved", () => {
  const context = {
    window: {},
    Aura: { storage: { set: () => false } },
    setTimeout: callback => { callback(); return 1; },
    clearTimeout() {}
  };
  context.window.Aura = context.Aura;
  vm.runInNewContext(widgetsSource, context);
  const status = { textContent: "", classList: { add() {}, remove() {} } };
  Object.assign(context.Aura.widgets, { status, notes: { value: "draft" } });
  context.Aura.widgets.queueSave();
  assert.equal(status.textContent, "Not saved");
});
```

- [ ] **Step 2: Run the tests and verify they fail**

Run:

```powershell
node --test tests\storage.test.mjs
```

Expected: FAIL because `Aura.storage.set` calls `alert` and the scratchpad always displays `Saved`.

- [ ] **Step 3: Keep the shared storage boundary minimal**

Change `Aura.storage.set` to:

```js
set(key, value) {
  try {
    localStorage.setItem(this.prefix + key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
},
```

Do not add a notification system. The caller already owns the relevant status UI.

- [ ] **Step 4: Make success-reporting callers check the result**

Change the scratchpad callback in `src/widgets.js` to:

```js
const saved = Aura.storage.set("scratchpad", this.notes.value);
this.status.textContent = saved ? "Saved" : "Not saved";
this.status.classList.remove("saving");
```

Return the boolean from `src/notes.js`:

```js
saveAll() {
  return Aura.storage.set(this.key, this.items);
},
```

In `saveCurrent`, replace the unconditional success message with:

```js
const saved = this.saveAll();
this.render();
this.setStatus(saved ? "Saved to library" : "Not saved");
```

Return the boolean from `src/shortcuts.js`:

```js
save(items) {
  return Aura.storage.set("shortcuts", this.normalize(items));
},
```

In `upsert`, calculate `nextItems`, persist it first, and return `"Could not save shortcut."` without clearing the editor when `save(nextItems)` is false. Assign `this.items = nextItems` only after a successful write.

- [ ] **Step 5: Run focused and full JavaScript tests**

```powershell
node --test tests\storage.test.mjs
node --test tests
```

Expected after Task 2: storage tests PASS; the known stale productivity assertion remains the only full-suite failure until Task 5.

- [ ] **Step 6: Commit the persistence fix**

```powershell
git add src/storage.js src/widgets.js src/notes.js src/shortcuts.js tests/storage.test.mjs
git commit -m "fix: report local storage failures"
```

### Task 3: Correct focus completion times and local calendar math

**Files:**
- Modify: `src/productivity.js:10-210`
- Modify: `tests/productivity.test.mjs`

- [ ] **Step 1: Add failing completion and daylight-saving tests**

Add to `tests/productivity.test.mjs`:

```js
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
```

Set `process.env.TZ = "Europe/Berlin";` before creating the VM context so both DST transitions are deterministic.

- [ ] **Step 2: Run the tests and verify the missing helpers fail**

```powershell
node --test tests\productivity.test.mjs
```

Expected: FAIL because `completionTime` and `addDays` do not exist.

- [ ] **Step 3: Add the two small date helpers**

Add to `Aura.productivity`:

```js
completionTime(timer, now = Date.now()) {
  const endsAt = Number(timer?.endsAt);
  return Number.isFinite(endsAt) && endsAt > 0 ? Math.min(endsAt, now) : now;
},
addDays(value, amount) {
  const date = new Date(value);
  date.setDate(date.getDate() + amount);
  return date.getTime();
},
```

- [ ] **Step 4: Route completion and statistics through the helpers**

Change `completeSession` to derive `endedAt` with:

```js
const endedAt = this.completionTime(this.timer);
```

Replace every `start + this.dayMs`, `start + 7 * this.dayMs`, `cursor -= this.dayMs`, and `weekStart + index * this.dayMs` calendar boundary with `this.addDays(...)`. Remove `dayMs` after its final use disappears.

- [ ] **Step 5: Run the productivity tests**

```powershell
node --test tests\productivity.test.mjs
```

Expected: the new timestamp and DST tests PASS; the stale source-text navigation assertion still fails until Task 5.

- [ ] **Step 6: Commit the timer/statistics fix**

```powershell
git add src/productivity.js tests/productivity.test.mjs
git commit -m "fix: preserve focus completion dates"
```

### Task 4: Validate weather locations and ignore stale responses

**Files:**
- Modify: `src/weather.js:3-111`
- Modify: `src/app.js:80-91`
- Create: `tests/weather.test.mjs`

- [ ] **Step 1: Write failing coordinate-validation tests**

Create `tests/weather.test.mjs` with this complete harness and validation test:

```js
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
```

- [ ] **Step 2: Write a failing latest-request-wins test**

Use two deferred fetch promises:

```js
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
```

- [ ] **Step 3: Run the tests and verify both defects**

```powershell
node --test tests\weather.test.mjs
```

Expected: out-of-range coordinates resolve successfully and the late first response overwrites the second.

- [ ] **Step 4: Reject invalid numeric coordinates**

After parsing the two numbers in `resolveLocation`, add:

```js
const latitude = Number(coordinates[1]);
const longitude = Number(coordinates[2]);
if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
  throw new Error("Enter valid latitude and longitude coordinates.");
}
return { location: `${coordinates[1]}, ${coordinates[2]}`, latitude, longitude };
```

- [ ] **Step 5: Add a monotonic request identifier**

Add `requestId: 0` to `Aura.weather`. At the start of `refresh`:

```js
const requestId = ++this.requestId;
```

Before each `save` or `setCurrent` reached after an asynchronous fetch, add:

```js
if (requestId !== this.requestId) return this.getCurrent();
```

Apply the same guard in the `catch` path so an older failure cannot replace newer weather with an error state.

- [ ] **Step 6: Return truthful location-refresh status**

Change the end of `setLocation` to:

```js
const weather = await this.refresh(true);
return { location, refreshed: weather.status === "ready" };
```

Update `src/app.js`:

```js
const result = await Aura.weather.setLocation(controls.weatherLocation.value);
controls.weatherLocation.value = result.location.location;
if (status) status.textContent = result.refreshed
  ? `Weather set to ${result.location.location}.`
  : `Location saved, but live weather is unavailable.`;
```

- [ ] **Step 7: Run weather and full JavaScript tests**

```powershell
node --test tests\weather.test.mjs
node --test tests
```

Expected after Task 4: weather tests PASS; only the stale productivity assertion remains.

- [ ] **Step 8: Commit the weather fix**

```powershell
git add src/weather.js src/app.js tests/weather.test.mjs
git commit -m "fix: validate and order weather updates"
```

### Task 5: Remove the stale test and synchronize documentation

**Files:**
- Modify: `tests/productivity.test.mjs:39-47`
- Modify: `README.md:14-22,117-128`

- [ ] **Step 1: Delete the redundant source-text assertion**

Remove:

```js
assert.match(appSource, /showView\("productivity"\)/);
```

Do not replace it with another source-text assertion. `tests/navigation.test.mjs` already exercises hash-based view selection behavior.

- [ ] **Step 2: Correct README feature and test descriptions**

Replace “static Fristad weather” with configurable live weather plus cached fallback. Add the new test files to the documented Node command:

```powershell
node --test tests
```

Keep the Python command unchanged.

- [ ] **Step 3: Run all automated checks**

```powershell
node --test tests
python -m pytest -q
git diff --check
```

Expected:

```text
Node: all tests pass
Python: 4 passed, 2 subtests passed
git diff --check: no errors
```

- [ ] **Step 4: Commit test maintenance**

```powershell
git add tests/productivity.test.mjs README.md
git commit -m "test: align checks with branch behavior"
```

### Task 6: Browser regression verification

**Files:**
- No source changes expected.

- [ ] **Step 1: Start the local static server**

```powershell
python -m http.server 8000 --bind 127.0.0.1
```

Expected: Aura is available at `http://127.0.0.1:8000`.

- [ ] **Step 2: Verify desktop behavior**

At the default `1280x720` viewport, verify:

1. Home loads with no relevant console errors.
2. Productivity, Atmosphere, Library, and Home each become the only visible view.
3. Starting, pausing, and resetting the focus timer updates buttons and display.
4. Preferences and Time Tools dialogs open and close.
5. A successful scratchpad write displays `Saved`.
6. A simulated blocked-storage write displays `Not saved` without an alert loop.
7. `91, 13` displays the coordinate-validation error.
8. A network failure displays `Location saved, but live weather is unavailable.`

- [ ] **Step 3: Verify responsive behavior**

At `390x844`, verify the four navigation buttons remain usable, no horizontal overflow appears, cards do not overlap, and both dialogs remain scrollable with visible close controls.

- [ ] **Step 4: Verify launcher configuration behavior**

With `src/launcher-config.local.js` absent, Windows shortcuts display `Install launcher` and the page has no JavaScript exception. After running the installer and reloading the unpacked extension/local page, Windows shortcuts receive an `aura-launch:` URL without exposing the token in tracked files.

- [ ] **Step 5: Final repository check**

```powershell
git status --short
git log --oneline main..HEAD
```

Expected: only intentional plan/spec files remain uncommitted if they were not included in prior commits; generated launcher files are ignored; the fix commits are ordered security, storage, timer, weather, then tests.
