# Aura Pages and Shortcut Management Design

## Scope

Extend the existing offline Aura start page without adding another HTML file. Keep `index.html` as the only document and preserve the current compact, transparent visual system and animated WebGL background.

The work adds:

- Editable web and Windows app shortcuts.
- A zero-idle Windows protocol launcher.
- Productivity, Atmosphere, and Library views.
- Fristad as the static weather location.

## Architecture

`index.html` contains four view sections: Home, Productivity, Atmosphere, and Library. Sidebar controls switch the visible section in place and update the active state. The background, sidebar, preferences dialog, and settings button remain mounted so view changes do not reload the page or restart the shader.

Existing files remain focused:

- `src/app.js`: application initialization, navigation, and shared coordination.
- `src/storage.js`: namespaced `localStorage` reads and writes.
- `src/widgets.js`: clock, weather, scratchpad, focus timer, and task behavior.
- `src/shortcuts.js`: shortcut validation, rendering, filtering, and CRUD.
- `src/atmosphere.js`: shader preferences and preset uniforms.
- `src/styles.css`: all view, form, task, library, and responsive styling.
- `launcher-helper/launcher.py`: one-shot `aura-launch:` protocol handler.
- `launcher-helper/install.ps1`: per-user protocol installation and secret generation.
- `launcher-helper/uninstall.ps1`: removes the per-user protocol registration.

No framework or dependency is added.

## Navigation and Views

Sidebar controls use `data-view-target` values. Selecting one:

1. Hides the current `[data-view]` section.
2. Shows the selected section.
3. Updates the active sidebar state and URL hash.
4. Preserves all local UI state.

The floating gear and Preferences sidebar control open the preferences dialog. Other view controls never open that dialog.

### Home

Keep the existing clock, search, Spaces grid, Fristad weather, and scratchpad. Home shows up to six shortcuts marked `showOnHome`. Additional shortcuts remain available in Library.

Weather remains static and offline:

- Location: Fristad
- Condition and temperature: configured in `src/config.js`
- Celsius/Fahrenheit toggle: unchanged

### Productivity

Provide a compact focus timer and persistent task list.

Timer behavior:

- Default duration: 25 minutes.
- Start, pause, and reset controls.
- Store running state and end timestamp so refreshes restore the correct remaining time.
- Completing a session returns the timer to 25:00 and shows a short completion state.

Task behavior:

- Add a non-empty task.
- Mark tasks complete/incomplete.
- Delete tasks.
- Persist tasks in `localStorage`.

### Atmosphere

Provide:

- Animation on/off.
- Low, medium, and high intensity.
- Speed control.
- Ether, Ocean, and Violet presets.

These controls update shader uniforms and body state immediately and persist in `localStorage`. Turning animation off stops further animation frames while keeping a static background frame. `prefers-reduced-motion` still overrides automatic motion.

### Library

Render every saved shortcut in two groups:

- Web
- Windows apps

One search field filters both groups by name or target. Each entry has Edit and Delete actions. Edit opens Preferences with that shortcut loaded in the form. Empty groups show a short empty-state message.

## Shortcut Data and Preferences

Store shortcuts in `localStorage` under `aura:shortcuts`. On first use, seed from `Aura.config.spaces`.

Each shortcut contains:

```js
{
  id: "generated-id",
  title: "Spotify",
  type: "web" | "windows",
  target: "https://..." | "spotify:" | "C:\\Path\\App.exe",
  showOnHome: true
}
```

Preferences gains a Shortcuts section with:

- Existing shortcut list.
- Add/Edit form.
- Name.
- Type: Web or Windows app.
- URL, registered URI, `.exe`, or `.lnk` target.
- Show on Home checkbox.
- Save, Cancel, and Delete actions.

Validation:

- Names and targets are required.
- Web targets accept `http:`, `https:`, and registered URI schemes.
- Windows targets must be absolute paths ending in `.exe` or `.lnk`.
- Invalid entries show an inline error and are not saved.
- Home renders at most six `showOnHome` entries to preserve the no-scroll 1280×720 layout.

## Zero-Idle Windows Launcher

The helper is not a server and does not run at startup. `install.ps1` performs a one-time per-user registration of the `aura-launch:` URI protocol under `HKCU`, which requires no administrator privileges.

Installation also creates a random secret in `launcher-helper/secret.txt` and writes the matching local dashboard configuration. Windows app links contain an encoded target and the secret. On click, Windows starts `launcher.py`; it validates the request, opens the app, and exits.

Security rules:

- Compare the supplied secret using `hmac.compare_digest`.
- Accept only the `open` action.
- Decode one absolute Windows path.
- Require an existing `.exe` or `.lnk` file.
- Reject command arguments, directories, relative paths, and other extensions.
- Launch with `os.startfile`; never use `shell=True` or execute arbitrary command strings.
- Bind no port and run no persistent process.

Uninstall removes only the `aura-launch:` registration created for the current user.

## Error Handling

- Malformed stored shortcut/task/preferences data falls back to safe defaults.
- A missing launcher installation shows a concise instruction near Windows shortcuts.
- Invalid helper requests exit without launching anything.
- UI errors stay inline; no alert loop is used.
- Deleting a shortcut requires confirmation.

## Verification

- Shortcut add/edit/delete persists after reload.
- Home displays no more than six selected shortcuts.
- Library search and Web/Windows grouping work.
- Productivity tasks and timer restore correctly after reload.
- Atmosphere on/off, intensity, speed, and all three presets visibly update the shader.
- Navigation changes views without opening Preferences.
- Fristad renders in the weather card.
- Launcher parser rejects bad secrets, relative paths, arguments, missing files, and unsupported extensions.
- Launcher accepts a valid allowlisted-style `.exe` or `.lnk` path in a non-launching test mode.
- Desktop 1280×720 has no page scroll; mobile remains usable and scrollable.
- Browser console has no relevant errors or warnings.

## Explicit Non-goals

- Live weather API.
- Shortcut folders beyond Web and Windows apps.
- Drag-and-drop ordering.
- Cross-device synchronization.
- Always-running localhost service.
- Additional HTML documents.
