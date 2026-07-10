# Ordolith Launcher

Ordolith is an open-source cross-platform launcher for Minecraft: Java Edition, 
written with a focus on transparency and user control over their data.

## Features
- 🔑 Microsoft login (official OAuth2-flow) and offline mode
- 📦 Automatic download of versions, libraries, and assets from the official Mojang manifest
- 🧩 Support for modloaders (Fabric, Forge, Quilt)
- 🗂️ Multiple isolated instances with separate settings and mods
- ⚡ Minimal resource consumption, no built-in browser

## Tech stack
Desktop app built with **Electron** + **electron-vite** + **React** + **TypeScript**.

- **Main process** (`src/main`) — window lifecycle, IPC handlers, single-instance lock,
  and all privileged services (`src/main/modules`): the Mojang version manifest,
  file downloader with SHA-1 verification, Java detection, the launch pipeline,
  Microsoft OAuth + offline auth, and server-list ping.
- **Preload bridge** (`src/preload`) — the only, explicitly typed surface exposed to
  the renderer (`window.ordolith`), guarded by `contextIsolation`.
- **Renderer** (`src/renderer`) — the React UI (the "Liquid Glass" design system).
- **Shared** (`src/shared`) — IPC channel names and domain types shared across processes.

### Where data lives
Everything the launcher writes stays under a single per-user data directory
(`app.getPath("userData")/ordolith`): `instances/` (isolated game folders),
shared `assets/`, `libraries/`, `versions/`, and `accounts.json` / `servers.json`.
Microsoft refresh tokens are encrypted at rest with Electron's `safeStorage`.

## Development

Requires Node.js 20+.

```bash
npm install       # install dependencies
npm run dev       # start the launcher with HMR
npm run typecheck # type-check main + renderer
npm run build     # produce a production bundle in out/
```

> Note: the app must be run on a desktop machine — Electron needs a display and
> cannot be previewed in a browser-only environment.

## Building installers

Packaging is handled by [electron-builder](https://www.electron.build/) via
`electron-builder.yml`. Build on each target OS (or use CI) for best results:

```bash
npm run package   # unpacked app in release/<version>/ (quick local smoke test)
npm run dist      # full installers for the current platform
```

Targets produced by `npm run dist`:

| Platform | Artifacts                      |
| -------- | ------------------------------ |
| Windows  | NSIS installer (x64 + arm64)   |
| macOS    | DMG (x64 + arm64)              |
| Linux    | AppImage, `.deb`, `.tar.gz`    |

The app icon is generated from `build/icon.png`. macOS builds are ad-hoc signed
by default; provide a signing identity and notarization credentials in CI for
distributable macOS builds.

## Requirements to run the game
Ordolith launches the game with your system Java. Install a Java 17+ runtime
(or point an instance at a specific `java` binary in its settings) to play
modern Minecraft versions.
