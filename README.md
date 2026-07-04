# Aura Startpage

Aura is a quiet, responsive start page built with plain HTML, CSS, and JavaScript. It has no backend, package installation, or build step. Browser-owned data is stored locally with `localStorage`.

Use Aura as:

- A locally hosted homepage.
- A static site on GitHub Pages or Vercel.
- A Chrome new-tab extension.

## Features

- **Four views:** Home, Productivity, Atmosphere, and Library switch inside one document.
- **Editable shortcuts:** Add, edit, delete, filter, and persist web links or Windows application paths.
- **Custom Home:** Choose which shortcuts appear on Home, with a maximum of six.
- **Productivity:** Persistent focus timer and task list with add, complete, and delete actions.
- **Atmosphere:** WebGL animated background with enabled state, intensity, speed, and color presets.
- **Widgets:** Clock, static Fristad weather, temperature-unit toggle, and auto-saving scratchpad.
- **Preferences:** Persist clock, temperature, search engine, widget visibility, shortcuts, tasks, and atmosphere settings.
- **Responsive layout:** Desktop and mobile layouts without horizontal overflow.
- **Chrome new tab:** The included Manifest V3 file replaces Chrome's new-tab page.
- **Optional Windows launcher:** Open existing `.exe` and `.lnk` targets through a secure, one-shot local protocol handler.

## Requirements

- A modern browser.
- Python 3 for the local web server.
- Windows and `pythonw.exe` only if you want native Windows shortcuts.
- Node.js 18 or newer only if you want to run the JavaScript tests.

## Run locally

```powershell
git clone https://github.com/bemilbandin-ops/personal-dashboard-homepage.git
cd personal-dashboard-homepage
python -m http.server 8000 --bind 127.0.0.1
```

Open [http://127.0.0.1:8000](http://127.0.0.1:8000). Stop the server with `Ctrl+C`.

There is no dependency installation or build command.

## Optional Windows launcher

Hosted web pages cannot directly open Windows applications. Aura's optional `aura-launch:` protocol handler provides that bridge without leaving a server running.

From PowerShell in the repository root:

```powershell
powershell -ExecutionPolicy Bypass -File .\launcher-helper\install.ps1
```

The installer:

- Generates a 32-byte local token.
- Registers `aura-launch:` for the current user under `HKCU`—administrator access is not required.
- Uses `pythonw.exe` to handle one request and then exit.
- Accepts only existing absolute paths ending in `.exe` or `.lnk`.

After installation, reload the page or reload the unpacked Chrome extension before adding Windows shortcuts.

### Security

The tracked `src/launcher-config.js` always contains an empty token. The installer generates both local credential files, which are ignored by Git:

- `launcher-helper/secret.txt`
- `src/launcher-config.local.js`

Any token previously committed to the repository is compromised and must be rotated. Run the installer again to generate a new token before using Windows shortcuts.

To remove the protocol registration, local config, and secret:

```powershell
powershell -ExecutionPolicy Bypass -File .\launcher-helper\uninstall.ps1
```

## Install as a Chrome new-tab extension

1. Clone or download the repository.
2. Open `chrome://extensions` in Chrome.
3. Enable **Developer mode**.
4. Select **Load unpacked**.
5. Select the repository directory containing `manifest.json`.
6. Open a new tab.

After changing the source or installing the Windows launcher, return to `chrome://extensions` and reload Aura. See Chrome's official [unpacked extension guide](https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world#load-unpacked).

## Deploy

Aura is a static site. Deploy the repository root directly; there is nothing to compile.

### GitHub Pages

1. Push or merge the site into the branch you want to publish, normally `main`.
2. Open the repository on GitHub.
3. Go to **Settings → Pages**.
4. Under **Build and deployment**, select **Deploy from a branch**.
5. Select `main` and `/(root)`.
6. Select **Save**.

Future pushes to that branch redeploy the site. See GitHub's official [publishing-source documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).

### Vercel

1. In Vercel, create a new project and import the GitHub repository.
2. Choose **Other** as the framework preset.
3. Keep the root directory as `.`.
4. Leave the build command and output directory empty.
5. Select **Deploy**.

Connected branch pushes create new deployments; changes merged into the production branch create production deployments. See Vercel's official [Git deployment documentation](https://vercel.com/docs/git).

### Hosted-site limitation

GitHub Pages and Vercel support Aura's browser features and web shortcuts. They cannot launch Windows applications because the generated token and `aura-launch:` registration remain on the local Windows machine. Use the unpacked Chrome extension or a local server when Windows shortcuts are required.

## Tests

Run every JavaScript test from PowerShell:

```powershell
node --test tests\navigation.test.mjs tests\shortcuts.test.mjs tests\productivity.test.mjs tests\atmosphere.test.mjs
```

Run the launcher security tests without opening an application:

```powershell
python -m unittest discover -s tests -p "test_launcher.py" -v
```

## Project structure

| Path | Purpose |
| --- | --- |
| `index.html` | Single HTML document, view shells, widgets, and Preferences dialog. |
| `src/` | Styling, configuration, persistence, routing, shortcuts, Productivity, Atmosphere, search, and widgets. |
| `launcher-helper/` | Windows protocol installer, uninstaller, parser, validation, and one-shot launcher. |
| `tests/` | Node model/integration tests and Python launcher security tests. |
| `manifest.json` | Chrome Manifest V3 new-tab override. |
