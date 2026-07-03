# Aura Pages and Shortcuts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add editable web/Windows shortcuts, three functional single-document views, Fristad weather, and a secure zero-idle Windows launcher.

**Architecture:** Keep `index.html` as the only document and switch `[data-view]` sections in place. Persist browser-owned state in `localStorage`; use a registered one-shot `aura-launch:` protocol handler for `.exe`/`.lnk` targets so no server remains running.

**Tech Stack:** Static HTML/CSS, classic browser JavaScript, WebGL, Python 3 standard library, PowerShell, Node built-in test runner, Python `unittest`.

**Repository note:** `D:\Codexcode\homepage` is not a Git repository. Replace commit steps with verification checkpoints; do not initialize Git unless the user separately asks.

---

## File Map

- Modify `index.html`: single-document views, navigation controls, Preferences shortcut editor, script loading.
- Modify `src/config.js`: Fristad weather and seeded shortcut records.
- Modify `src/app.js`: initialization and view routing only; remove shortcut and shader implementation from this file.
- Modify `src/storage.js`: retain safe namespaced persistence.
- Modify `src/widgets.js`: existing clock/weather/scratchpad integration.
- Modify `src/styles.css`: view, productivity, library, editor, and responsive styles.
- Create `src/shortcuts.js`: shortcut validation, persistence, rendering, filtering, CRUD, and launch URL generation.
- Create `src/productivity.js`: timer state and task CRUD.
- Create `src/atmosphere.js`: shader startup and persisted controls/presets.
- Create `src/launcher-config.js`: generated launcher token; empty before installation.
- Create `launcher-helper/launcher.py`: protocol parser, validation, and one-shot launch.
- Create `launcher-helper/install.ps1`: per-user protocol registration and token generation.
- Create `launcher-helper/uninstall.ps1`: per-user protocol removal.
- Create `tests/shortcuts.test.mjs`: browser-model regression tests.
- Create `tests/productivity.test.mjs`: timer/task state tests.
- Create `tests/test_launcher.py`: launcher security tests.

### Task 1: Shortcut data model and validation

**Files:**
- Create: `src/shortcuts.js`
- Create: `tests/shortcuts.test.mjs`
- Modify: `src/config.js`
- Modify: `index.html`

- [ ] **Step 1: Write the failing shortcut model tests**

Create `tests/shortcuts.test.mjs` using a VM context so the classic browser script can be tested without a framework:

```js
import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/shortcuts.js", import.meta.url), "utf8");
const context = { window: {}, crypto: { randomUUID: () => "id-1" } };
context.window.Aura = {};
context.Aura = context.window.Aura;
vm.runInNewContext(source, context);
const model = context.Aura.shortcuts;

test("accepts web and registered protocol targets", () => {
  assert.equal(model.validate({ title: "Site", type: "web", target: "https://example.com" }), "");
  assert.equal(model.validate({ title: "Steam", type: "web", target: "steam://open/main" }), "");
});

test("rejects unsafe Windows targets", () => {
  assert.match(model.validate({ title: "Bad", type: "windows", target: "calc.exe /x" }), /absolute/);
  assert.match(model.validate({ title: "Bad", type: "windows", target: "C:\\Temp\\note.txt" }), /exe or .lnk/);
});

test("normalizes stored records", () => {
  assert.equal(
    JSON.stringify(model.normalize([{ id: "a", title: " GitHub ", type: "web", target: "https://github.com", showOnHome: true }])[0]),
    JSON.stringify({ id: "a", title: "GitHub", type: "web", target: "https://github.com", showOnHome: true })
  );
});
```

- [ ] **Step 2: Run the tests and verify RED**

Run: `node --test tests/shortcuts.test.mjs`

Expected: FAIL because `src/shortcuts.js` does not exist.

- [ ] **Step 3: Implement the minimal pure model**

Create `src/shortcuts.js` with these public functions:

```js
window.Aura = window.Aura || {};

Aura.shortcuts = {
  normalize(items) {
    return Array.isArray(items) ? items.map(item => ({
      id: String(item.id || crypto.randomUUID()),
      title: String(item.title || "").trim(),
      type: item.type === "windows" ? "windows" : "web",
      target: String(item.target || "").trim(),
      showOnHome: item.showOnHome !== false
    })).filter(item => item.title && item.target) : [];
  },
  validate(item) {
    if (!item.title?.trim() || !item.target?.trim()) return "Name and target are required.";
    if (item.type === "windows") {
      if (!/^[a-z]:\\\\/i.test(item.target)) return "Windows targets must use an absolute path.";
      if (!/\.(exe|lnk)$/i.test(item.target)) return "Windows targets must end in .exe or .lnk.";
      return "";
    }
    return /^[a-z][a-z\d+.-]*:/i.test(item.target) ? "" : "Enter a full URL or registered app link.";
  },
  load() {
    return this.normalize(Aura.storage.get("shortcuts", Aura.config.spaces));
  },
  save(items) {
    Aura.storage.set("shortcuts", this.normalize(items));
  }
};
```

Update `Aura.config.spaces` records to use `id`, `type`, `target`, and `showOnHome`. Add `<script defer src="src/shortcuts.js"></script>` after `storage.js` and before `app.js` in `index.html`.

- [ ] **Step 4: Run the shortcut tests and verify GREEN**

Run: `node --test tests/shortcuts.test.mjs`

Expected: 3 tests pass, 0 fail.

### Task 2: Single-document navigation and view shells

**Files:**
- Modify: `index.html`
- Modify: `src/app.js`
- Modify: `src/styles.css`

- [ ] **Step 1: Add four explicit views to the only HTML document**

Wrap the current hero/dashboard in `<section data-view="home">`. Add sibling sections:

```html
<section class="app-view" data-view="productivity" hidden>
  <header class="view-header"><h2>Productivity</h2><p>One task at a time.</p></header>
  <div id="productivity-root"></div>
</section>
<section class="app-view" data-view="atmosphere" hidden>
  <header class="view-header"><h2>Atmosphere</h2><p>Tune the room.</p></header>
  <div id="atmosphere-controls"></div>
</section>
<section class="app-view" data-view="library" hidden>
  <header class="view-header"><h2>Library</h2><p>Everything you saved.</p></header>
  <input id="library-search" type="search" placeholder="Filter shortcuts…">
  <div id="library-web"></div><div id="library-windows"></div>
</section>
```

Replace disabled sidebar controls with buttons containing `data-view-target="productivity"`, `data-view-target="atmosphere"`, and `data-view-target="library"`. Give Home `data-view-target="home"`. Keep Preferences and the floating gear as the only `data-open-settings` controls.

- [ ] **Step 2: Implement navigation in `src/app.js`**

```js
function showView(name) {
  const selected = document.querySelector(`[data-view="${name}"]`) ? name : "home";
  document.querySelectorAll("[data-view]").forEach(view => { view.hidden = view.dataset.view !== selected; });
  document.querySelectorAll("[data-view-target]").forEach(button => {
    button.classList.toggle("active", button.dataset.viewTarget === selected);
  });
  history.replaceState(null, "", `#${selected}`);
}

document.querySelectorAll("[data-view-target]").forEach(button =>
  button.addEventListener("click", () => showView(button.dataset.viewTarget))
);
showView(location.hash.slice(1) || "home");
```

- [ ] **Step 3: Add compact shared view styling**

Add `.app-view`, `.view-header`, and `[data-view][hidden]` rules. At 1280×720, views use the existing main content area without introducing body overflow; mobile views use normal vertical scrolling.

- [ ] **Step 4: Verify navigation manually**

Open `index.html` through the temporary local server. Click all four view controls.

Expected: exactly one view is visible; active sidebar state follows it; Preferences stays closed; the URL hash updates.

### Task 3: Shortcut Preferences CRUD and Library rendering

**Files:**
- Modify: `index.html`
- Modify: `src/shortcuts.js`
- Modify: `src/app.js`
- Modify: `src/styles.css`

- [ ] **Step 1: Add the shortcut editor markup**

Append this section inside the existing Preferences form:

```html
<section class="shortcut-settings">
  <h3>Shortcuts</h3>
  <div id="shortcut-settings-list"></div>
  <input id="shortcut-title" placeholder="Name" required>
  <select id="shortcut-type"><option value="web">Web</option><option value="windows">Windows app</option></select>
  <input id="shortcut-target" placeholder="https://… or C:\\Path\\App.exe" required>
  <label><input id="shortcut-home" type="checkbox" checked> Show on Home</label>
  <p id="shortcut-error" role="alert"></p>
  <div class="form-actions"><button id="shortcut-save" type="button">Save</button><button id="shortcut-cancel" type="button">Cancel</button></div>
</section>
```

- [ ] **Step 2: Implement CRUD and rendering**

Add state and methods to `Aura.shortcuts`:

```js
items: [],
editingId: null,
upsert(input) {
  const error = this.validate(input);
  if (error) return error;
  const record = { ...input, id: this.editingId || crypto.randomUUID() };
  this.items = this.editingId ? this.items.map(item => item.id === this.editingId ? record : item) : [...this.items, record];
  this.editingId = null;
  this.save(this.items);
  this.renderAll();
  return "";
},
remove(id) {
  this.items = this.items.filter(item => item.id !== id);
  this.save(this.items);
  this.renderAll();
},
homeItems() { return this.items.filter(item => item.showOnHome).slice(0, 6); }
```

`renderAll()` renders Home Spaces, both Library groups, and the Preferences list from the same `items` array. Use DOM creation and `textContent`; never interpolate user-controlled values into `innerHTML`. Web shortcuts use their target directly. Windows shortcuts use `Aura.launcher.urlFor(target)`.

- [ ] **Step 3: Wire form and Library search events**

Save calls `upsert()`, displays its returned error inline, and clears the form only on success. Edit populates the form and sets `editingId`. Delete requires `confirm("Delete this shortcut?")`. Library search compares a lowercase query against `title` and `target`.

- [ ] **Step 4: Extend shortcut tests**

Add tests proving `upsert` replaces the editing record, `remove` deletes one record, and `homeItems()` returns no more than six selected records. Run `node --test tests/shortcuts.test.mjs`; expect all tests to pass.

### Task 4: Productivity timer and persistent tasks

**Files:**
- Create: `src/productivity.js`
- Create: `tests/productivity.test.mjs`
- Modify: `index.html`
- Modify: `src/app.js`
- Modify: `src/styles.css`

- [ ] **Step 1: Write failing pure timer tests**

Test `remaining(timer, now)` and task transitions:

```js
test("restores a running timer from its end timestamp", () => {
  assert.equal(productivity.remaining({ running: true, remainingMs: 1500000, endsAt: 1600000 }, 100000), 1500000);
});
test("expired timers return zero", () => {
  assert.equal(productivity.remaining({ running: true, endsAt: 1000 }, 2000), 0);
});
test("blank tasks are rejected", () => {
  assert.equal(productivity.addTask([], "   "), null);
});
```

Run: `node --test tests/productivity.test.mjs`

Expected: FAIL because `src/productivity.js` does not exist.

- [ ] **Step 2: Implement the pure state functions**

```js
remaining(timer, now = Date.now()) {
  return timer.running ? Math.max(0, timer.endsAt - now) : Math.max(0, timer.remainingMs);
},
addTask(tasks, title) {
  const clean = title.trim();
  return clean ? [...tasks, { id: crypto.randomUUID(), title: clean, completed: false }] : null;
},
toggleTask(tasks, id) {
  return tasks.map(task => task.id === id ? { ...task, completed: !task.completed } : task);
},
removeTask(tasks, id) { return tasks.filter(task => task.id !== id); }
```

- [ ] **Step 3: Render and persist Productivity UI**

Render `25:00`, Start/Pause/Reset buttons, task input, and task list into `#productivity-root`. Save timer under `aura:focus-timer` and tasks under `aura:tasks`. One interval updates the display while running and stops itself when paused, reset, or completed.

Wire the sidebar Deep Work button to navigate to Productivity and start the timer only when it is not already running.

Load `<script defer src="src/productivity.js"></script>` before `app.js`.

- [ ] **Step 4: Verify tests and browser behavior**

Run: `node --test tests/productivity.test.mjs`

Expected: all tests pass. In the browser, add/toggle/delete a task, start/pause/reset the timer, reload, and confirm state restoration.

### Task 5: Atmosphere controls and presets

**Files:**
- Create: `src/atmosphere.js`
- Modify: `src/app.js`
- Modify: `index.html`
- Modify: `src/styles.css`

- [ ] **Step 1: Move the existing shader unchanged into `src/atmosphere.js`**

Expose `Aura.atmosphere.init(preferences)` and remove `startAtmosphere()` from `src/app.js`. Preserve the current flower-of-life shader and portable ring calculation.

Load `<script defer src="src/atmosphere.js"></script>` before `app.js`.

- [ ] **Step 2: Add persisted atmosphere state**

Use this normalized state, persisted under `aura:atmosphere`:

```js
const defaults = { enabled: true, intensity: "medium", speed: 1, preset: "ether" };
const presets = {
  ether: [[0, 1, .8], [.8, 0, 1]],
  ocean: [[0, .65, 1], [0, 1, .72]],
  violet: [[.35, .15, 1], [1, .1, .75]]
};
```

Add `colorA`, `colorB`, and `speed` uniforms. Multiply shader time by speed. `apply(next)` validates preset/intensity/speed, persists state, updates controls, and starts or stops requestAnimationFrame. Keep a single animation loop guard so repeated changes never create duplicate loops.

- [ ] **Step 3: Render Atmosphere controls**

Add one enabled switch, intensity select, range input from `0.25` to `2` with step `0.25`, and three preset buttons. Changes apply immediately.

- [ ] **Step 4: Verify all states visually**

Check enabled/disabled, three intensity levels, minimum/maximum speed, and all presets. Reload after each control class once to confirm persistence. Console must remain free of WebGL errors.

### Task 6: Zero-idle `aura-launch:` Windows helper

**Files:**
- Create: `src/launcher-config.js`
- Create: `launcher-helper/launcher.py`
- Create: `launcher-helper/install.ps1`
- Create: `launcher-helper/uninstall.ps1`
- Create: `tests/test_launcher.py`
- Modify: `index.html`
- Modify: `src/shortcuts.js`

- [ ] **Step 1: Write failing launcher parser tests**

Create temporary `.exe` and `.lnk` files and test:

```python
import importlib.util
from pathlib import Path

MODULE_PATH = Path(__file__).parents[1] / "launcher-helper" / "launcher.py"
SPEC = importlib.util.spec_from_file_location("aura_launcher", MODULE_PATH)
launcher = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(launcher)
parse_request, validate_target = launcher.parse_request, launcher.validate_target

def test_rejects_wrong_secret(self):
    with self.assertRaises(ValueError):
        parse_request(make_uri("wrong", self.exe), "correct")

def test_rejects_relative_and_unsupported_paths(self):
    for target in ("calc.exe", str(self.root / "note.txt")):
        with self.subTest(target=target), self.assertRaises(ValueError):
            validate_target(target)

def test_accepts_existing_exe(self):
    self.assertEqual(validate_target(str(self.exe)), self.exe.resolve())
```

Run: `python -m unittest discover -s tests -p "test_launcher.py" -v`

Expected: FAIL because `launcher-helper/launcher.py` does not exist.

- [ ] **Step 2: Implement strict parsing and launch**

`launcher.py` must define:

```python
def parse_request(uri: str, secret: str) -> Path:
    parsed = urlparse(uri)
    if parsed.scheme != "aura-launch" or parsed.netloc != "open": raise ValueError("bad action")
    query = parse_qs(parsed.query)
    if not compare_digest(query.get("token", [""])[0], secret): raise ValueError("bad token")
    raw = urlsafe_b64decode(query.get("target", [""])[0] + "===").decode("utf-8")
    return validate_target(raw)

def validate_target(raw: str) -> Path:
    path = Path(raw)
    if not path.is_absolute() or path.suffix.lower() not in {".exe", ".lnk"} or not path.is_file():
        raise ValueError("invalid target")
    return path.resolve()
```

`main()` reads `secret.txt`, parses `sys.argv[1]`, then calls `os.startfile(path)`. It catches parsing/validation errors and exits nonzero without launching.

- [ ] **Step 3: Implement per-user installation**

Create the default `src/launcher-config.js` as `window.Aura = window.Aura || {}; Aura.launcherToken = "";`.

`install.ps1` generates a 32-byte random hex token, writes it to `secret.txt`, writes `window.Aura = window.Aura || {}; Aura.launcherToken = '<token>';` to `src/launcher-config.js`, discovers `pythonw.exe`, and creates:

`HKCU:\Software\Classes\aura-launch` with `URL Protocol`, plus `shell\open\command` set to `"<pythonw>" "<launcher.py>" "%1"`.

`uninstall.ps1` removes only `HKCU:\Software\Classes\aura-launch` and clears the generated token file/config value.

- [ ] **Step 4: Generate launcher URLs in the dashboard**

Load `launcher-config.js` before `shortcuts.js`. Add:

```js
Aura.launcher = {
  urlFor(target) {
    if (!Aura.launcherToken) return "";
    const bytes = new TextEncoder().encode(target);
    const encoded = btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    return `aura-launch://open?token=${encodeURIComponent(Aura.launcherToken)}&target=${encoded}`;
  }
};
```

If the token is empty, Windows entries show “Install launcher” instead of an active launch link.

- [ ] **Step 5: Run launcher tests without launching a real app**

Run: `python -m unittest discover -s tests -p "test_launcher.py" -v`

Expected: all parser/validation tests pass. Do not invoke `os.startfile` in automated tests.

### Task 7: Fristad weather, integration, and final verification

**Files:**
- Modify: `src/config.js`
- Modify: `index.html`
- Modify: `manifest.json` only if new local scripts are not already covered by the default extension CSP
- Test: all test files

- [ ] **Step 1: Change static weather configuration**

Set:

```js
weather: { location: "Fristad", condition: "Partly cloudy", tempC: 18 }
```

Keep the existing Celsius/Fahrenheit behavior.

- [ ] **Step 2: Run all automated checks**

Run:

```powershell
node --test tests/*.test.mjs
python -m unittest discover -s tests -p "test_launcher.py" -v
```

Expected: every JS and Python test passes with zero failures.

- [ ] **Step 3: Run desktop browser QA at 1280×720**

Verify:

- Home fits without horizontal or main-area vertical scrolling.
- Fristad appears in weather.
- All four views navigate and only Preferences/gear open the dialog.
- Shortcut CRUD updates Home and Library immediately and survives reload.
- Home never renders more than six shortcuts.
- Tasks/timer and atmosphere controls survive reload.
- Settings dialog remains usable with the larger shortcut editor.
- No relevant console errors or warnings.

- [ ] **Step 4: Run mobile QA at 390×844**

Verify normal vertical scrolling, no horizontal overflow, readable forms, usable task controls, both Library groups, and accessible dialog close/save controls.

- [ ] **Step 5: Install and test the protocol manually only after user approval**

Run `launcher-helper\install.ps1`, add a harmless existing Windows shortcut through Preferences, click it once, and confirm the intended application opens. Then verify no `launcher.py`/`pythonw.exe` process remains after launch. Installation mutates the current user registry and therefore requires explicit approval at execution time.
