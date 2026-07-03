# Plan: Aura / Ether Focus Personal Dashboard Startpage

## Goal

Turn the existing ZIP design into a functional personal startpage for Chrome and Brave while preserving its current visual direction.

The startpage should feel like the uploaded design:

- Deep charcoal background
- Large centered clock
- Wide rounded search bar
- Left Focus Mode sidebar
- Glass-style shortcut cards
- Right-side utility widgets
- Soft purple / blue accents
- Minimal, calm, premium dashboard layout

The build should not become a generic startpage. It should stay close to the current **Sanctuary Dashboard / Ether Focus** design.

## Existing design direction

The ZIP already includes a strong base design:

```text
stitch_duplicate_of_aura_personal_dashboard.zip
  code.html
  screen.png
  DESIGN.md
```

Use this as the design source instead of starting from a blank layout.

### Keep these design elements

- The **Focus Mode** sidebar on the left
- The large centered clock and date
- The rounded search input
- The **Spaces** shortcut grid
- The weather widget area
- The scratchpad widget
- The floating settings button
- The dark glassmorphism look
- The soft purple / blue accent colors
- The WebGL / animated atmospheric background

### Avoid changing the style into

- Neon cyberpunk
- Hacker terminal
- Anime / futuristic theme
- Bright colorful widgets
- Dense productivity dashboard
- Public SaaS-style app layout

This should remain a quiet personal dashboard, not a full productivity app.

## Recommended approach

Use the current ZIP design as the visual shell, then refactor it into a cleaner local startpage project.

The best setup is:

> Local static dashboard + config-based shortcuts + optional unpacked browser extension.

This keeps it offline, free, editable, and usable in both Chrome and Brave.

## Updated folder structure

Use this structure instead of keeping everything inside one large `code.html` file:

```text
aura-startpage/
  index.html
  manifest.json
  src/
    styles.css
    app.js
    config.js
    storage.js
    search.js
    widgets.js
  assets/
    icons/
    background/
  design/
    DESIGN.md
    screen.png
  launcher-helper/        optional later
    launcher.js or launcher.py
    apps.json
```

### Purpose of each file

| File | Purpose |
|---|---|
| `index.html` | Keeps the dashboard markup and layout. |
| `styles.css` | Holds the glassmorphism, spacing, background, responsive layout, and animations. |
| `config.js` | Stores shortcuts, search settings, widget settings, and sidebar labels. |
| `app.js` | Initializes the page and connects modules. |
| `search.js` | Handles search engine logic and command prefixes. |
| `widgets.js` | Handles clock, weather placeholder, scratchpad, and settings toggles. |
| `storage.js` | Saves notes and preferences in `localStorage`. |
| `manifest.json` | Lets Chrome/Brave use the page as a New Tab replacement. |

## Visual system to follow

Use the design tokens from `DESIGN.md` as the source of truth.

### Colors

Use the existing dark palette:

```text
Background:        #131313
Lowest surface:    #0e0e0e
Card surface:      transparent / glass
Surface border:    rgba(255,255,255,0.10)
Primary accent:    #c2c1ff
Secondary accent:  #e9b3ff
Main text:         #e5e2e1
Muted text:        #c7c4d7
```

### Typography

Use the existing font direction:

- `Inter` for clock, headings, body text, and shortcut labels
- `Geist` for small labels, metadata, and technical-looking UI text

### Shape and spacing

Keep the current rounded, spacious look:

- Main cards: `24px` radius
- Buttons and inputs: `12px` to `9999px`, depending on shape
- Card padding: `24px`
- Page padding: `40px` on desktop
- Base spacing rhythm: `8px`

### Depth

Use depth through subtle borders and blur, not solid panels:

```css
background: rgba(255, 255, 255, 0.03);
border: 1px solid rgba(255, 255, 255, 0.10);
backdrop-filter: blur(20px);
box-shadow: 0 20px 40px rgba(0, 0, 0, 0.25);
```

Do not make cards opaque black unless the background becomes unreadable.

## Core layout

The current screen layout should stay mostly the same.

```text
Left sidebar:
  Focus Mode
  Active session indicator
  Home
  Productivity
  Atmosphere
  Library
  Deep Work button
  Support / Sign Out placeholders

Center top:
  Large clock
  Date
  Search bar

Center lower:
  Spaces shortcut grid
  Add New card

Right column:
  Weather card
  Scratchpad card

Bottom right:
  Floating settings button
```

## Core features

### 1. Clock and date

Keep the current large centered clock.

Recommended behavior:

- Default to 24-hour format only if preferred in `config.js`.
- Clicking the clock can toggle 12h / 24h.
- Save the selected format to `localStorage`.
- Keep the date uppercase, matching the design.

Example config:

```js
clock: {
  format: "24h",
  showDate: true
}
```

### 2. Search bar

Keep the search input exactly where it is in the design.

Recommended behavior:

- Pressing Enter searches the configured search engine.
- Direct URLs open directly.
- Command prefixes should be added in version 2.

Example behavior:

```text
github.com        opens https://github.com
cats              searches the default search engine
yt lofi music     searches YouTube
r windows         searches Reddit
gh startpage      searches GitHub
```

Example config:

```js
search: {
  defaultEngine: "brave",
  engines: {
    google: "https://www.google.com/search?q=",
    brave: "https://search.brave.com/search?q=",
    duckduckgo: "https://duckduckgo.com/?q="
  },
  commands: {
    yt: "https://www.youtube.com/results?search_query=",
    r: "https://www.reddit.com/search/?q=",
    gh: "https://github.com/search?q="
  }
}
```

### 3. Spaces shortcut grid

Use the existing **Spaces** card grid as the main shortcut system.

Do not rename it to “Bookmarks” or “Links.” The current label fits the design better.

Example config:

```js
spaces: [
  {
    title: "GitHub",
    url: "https://github.com",
    icon: "code",
    color: "default"
  },
  {
    title: "YouTube",
    url: "https://youtube.com",
    icon: "play_arrow",
    color: "red"
  },
  {
    title: "Spotify",
    url: "spotify:",
    icon: "headphones",
    color: "green"
  },
  {
    title: "Mail",
    url: "https://mail.google.com",
    icon: "mail",
    color: "blue"
  },
  {
    title: "Figma",
    url: "https://figma.com",
    icon: "design_services",
    color: "purple"
  }
]
```

### 4. Add New card

Keep the dashed **Add New** card.

Version 1 behavior:

- Open settings or show a simple edit modal.
- Manual config editing is acceptable for the first build.

Version 2 behavior:

- Add shortcut from the UI.
- Save new shortcuts to `localStorage`.
- Support editing and deleting cards.

### 5. Sidebar

Keep the sidebar visually, but keep features simple.

Recommended version 1 behavior:

| Sidebar item | Version 1 behavior |
|---|---|
| Home | Scroll or switch to the main dashboard. |
| Productivity | Optional placeholder. |
| Atmosphere | Optional background/settings placeholder. |
| Library | Optional placeholder for grouped shortcuts. |
| Deep Work | Toggle focus mode styling or start a simple timer later. |
| Support | Remove or repurpose for help/settings. |
| Sign Out | Remove unless there is a real account system. |

Because this is a local startpage, **Sign Out** should not exist in version 1 unless it is renamed to something useful like **Reset Layout** or **Clear Data**.

### 6. Scratchpad

Keep the scratchpad. It fits the dashboard design well.

Version 1 behavior:

- Save text in `localStorage`.
- Show “Saving…” while typing.
- Show “Saved” after a short delay.

Example storage key:

```js
localStorage.setItem("aura:scratchpad", value);
```

### 7. Weather widget

The current design includes weather, so keep the widget visually.

Version 1 behavior:

- Use static placeholder data from `config.js`.
- Allow Celsius / Fahrenheit toggle.

Do not add live weather in version 1. Live weather requires API setup and adds unnecessary complexity.

Example config:

```js
weather: {
  enabled: true,
  mode: "static",
  location: "San Francisco",
  condition: "Sunny",
  tempC: 22
}
```

Version 2 behavior:

- Add optional free weather API support only if needed.
- Keep the widget removable from settings.

### 8. Settings modal

Keep the existing settings modal and make it useful.

Version 1 settings:

- Clock format: 12h / 24h
- Temperature unit: °C / °F
- Show/hide weather
- Show/hide scratchpad
- Background intensity: low / medium / high
- Search engine: Brave / Google / DuckDuckGo

Settings should save to `localStorage`.

## App/program shortcuts

### Start with web links and URI links

The dashboard can open websites and supported app URI schemes.

Examples:

```js
{ title: "Spotify", url: "spotify:", icon: "headphones" }
{ title: "Steam", url: "steam:", icon: "sports_esports" }
{ title: "Discord", url: "discord:", icon: "forum" }
```

This fits the search placeholder already shown in the design:

```text
Search the web or local apps...
```

### Do not launch `.exe` files directly from the page

A normal browser page should not directly open arbitrary Windows programs. Browsers block that for security.

For normal Windows program launching, add a local helper only later.

Optional later design:

```text
Dashboard button
  ↓
http://127.0.0.1:3199/open/spotify
  ↓
Local helper checks apps.json allowlist
  ↓
Helper launches the approved app
```

Security rule:

- Only bind to `127.0.0.1`.
- Only launch apps from an allowlist.
- Never accept arbitrary file paths from the browser.

## Version 1 build plan

### Phase 1: Convert the ZIP into a project

Tasks:

1. Rename `code.html` to `index.html`.
2. Move the design tokens and custom CSS into `src/styles.css`.
3. Move scripts into `src/app.js`, `src/widgets.js`, and `src/search.js`.
4. Keep `DESIGN.md` and `screen.png` inside a `design/` folder.
5. Confirm the page still looks like the screenshot.

Success condition:

- The dashboard opens locally and visually matches the ZIP screenshot.

### Phase 2: Add config-based shortcuts

Tasks:

1. Create `src/config.js`.
2. Move Spaces shortcut data into the config.
3. Render shortcut cards from config instead of hardcoded HTML.
4. Keep the same card styling and icons.
5. Keep the dashed Add New card as the final grid item.

Success condition:

- Shortcuts can be changed by editing `config.js`.
- The visual layout does not change.

### Phase 3: Make search functional

Tasks:

1. Detect Enter in the search bar.
2. Open URLs directly.
3. Search the default engine when text is not a URL.
4. Add configurable search engines.
5. Add command prefixes in version 2.

Success condition:

- Search works from the central input.
- Direct URLs work.
- Search engine can be changed from config.

### Phase 4: Make widgets persistent

Tasks:

1. Save scratchpad content to `localStorage`.
2. Save clock format setting.
3. Save temperature unit setting.
4. Save widget visibility settings.
5. Restore saved settings on page load.

Success condition:

- Refreshing the page does not erase notes or preferences.

### Phase 5: Add browser New Tab support

Create `manifest.json`:

```json
{
  "manifest_version": 3,
  "name": "Aura Startpage",
  "version": "1.0.0",
  "chrome_url_overrides": {
    "newtab": "index.html"
  }
}
```

Load it as an unpacked extension in Chrome or Brave.

Success condition:

- Opening a new tab shows the Aura / Ether Focus dashboard.

## Version roadmap

### Version 1

Build only the essentials:

- Existing ZIP design preserved
- Clock/date
- Search bar
- Config-based Spaces shortcuts
- Scratchpad with local save
- Static weather widget
- Settings modal
- New Tab extension support

### Version 2

Add quality-of-life features:

- Search prefixes
- Keyboard shortcut `/` to focus search
- Number keys `1–9` to open Spaces shortcuts
- Better shortcut editing UI
- Import/export config
- Widget visibility controls

### Version 3

Add editing and personalization:

- Add shortcut modal
- Edit/delete shortcuts
- Drag-and-drop ordering
- LocalStorage shortcut saving
- Background intensity controls
- Atmosphere presets

### Version 4

Add optional Windows app launching:

- Local launcher helper
- App allowlist
- `127.0.0.1` only
- Start helper with Windows
- Dashboard buttons for approved apps only

## Features to skip for now

Skip these unless the dashboard starts feeling too limited:

- News feed
- RSS
- Calendar
- Account/login system
- Public hosting
- Music controls
- System stats
- Heavy 3D graphics
- Large weather API setup
- Complex productivity/task system

The current design is strongest when it stays sparse.

## Implementation priorities

Build in this order:

1. Preserve the design exactly.
2. Make the search bar work.
3. Move shortcuts into config.
4. Save scratchpad and settings.
5. Add New Tab extension support.
6. Add shortcut editing later.
7. Add local app launcher last, only if needed.

## Final recommendation

Build this as:

> An offline Aura / Ether Focus startpage using the existing ZIP design, with config-driven Spaces shortcuts, a functional search bar, persistent scratchpad/settings, and optional Chrome/Brave New Tab support.

Do not rebuild the visual design from scratch. Refactor the current ZIP into a maintainable local project, then add functionality without cluttering the interface.
