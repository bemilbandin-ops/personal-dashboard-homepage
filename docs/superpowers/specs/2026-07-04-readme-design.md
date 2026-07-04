# Aura README Design

## Goal

Create a practical root `README.md` that explains what Aura is, what it can do, how to run it locally, and how to deploy or install it.

## Audience

- People who want to use Aura as a hosted homepage.
- Chrome users who want Aura as their new-tab page.
- Contributors running or testing the project locally.

## Structure

1. Short project overview.
2. Feature list covering navigation, shortcuts, Productivity, Atmosphere, weather, widgets, persistence, and responsive behavior.
3. Requirements and local startup using Python's standard-library HTTP server.
4. Optional Windows launcher installation, security model, uninstall command, and warning that generated tokens must never be committed.
5. Chrome unpacked-extension installation using the existing Manifest V3 file.
6. GitHub Pages deployment from the repository root.
7. Vercel deployment as a static site with no build command.
8. Test commands and a compact project structure reference.

## Deployment Boundaries

- Hosted deployments support web shortcuts and browser-owned features.
- Windows `.exe` and `.lnk` launching works only on a Windows machine where `launcher-helper/install.ps1` has registered the local `aura-launch:` handler.
- The launcher secret remains local in `launcher-helper/secret.txt` and the generated `src/launcher-config.js`; secrets must not be published.
- No Node package installation or build step is required.

## Acceptance Criteria

- Commands are copy-pasteable in PowerShell.
- GitHub Pages, Vercel, and Chrome extension setup are each documented separately.
- The README does not claim hosted sites can launch Windows applications without local installation.
- The README stays concise and reflects the current files and behavior.
