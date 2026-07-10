# Ordolith Launcher

Ordolith is an open-source cross-platform launcher for Minecraft: Java Edition, 
written with a focus on transparency and user control over their data.

## Features
- 🔑 Microsoft login (official OAuth2-flow) and offline mode with optional custom avatars
- 📦 Automatic download of versions, libraries, assets from official Mojang manifest
- 🧩 Support for modloaders: Fabric, Forge, Quilt, NeoForge
- 🎨 Mod browser with Modrinth + optional CurseForge (API key), install/update/disable mods, resource packs, shaders with dependency resolution
- 🗂️ Multiple isolated instances with independent settings, mods, custom directories, and icons
- ☕ Java runtime discovery + automatic Temurin download from Adoptium for any Minecraft version
- 📤 Instance import/export (safe ZIP archives with version metadata)
- 🌐 Server list with live status ping and favicon display
- 🎮 Launch options: fullscreen, window size, JVM tuning presets, custom JVM flags, custom game directory
- 🌍 Localization: RU, EN, ES, ZH with built-in changelogs for 1.21+ updates
- 🖼️ "Liquid Glass" design system: dark translucent UI, spring-motion animations, custom frameless window, system tray, boot splash
- ⚡ Minimal resource consumption, no built-in browser, single-process lock

## Tech stack
Desktop app built with **Electron 34** + **electron-vite** + **React 19** + **TypeScript 5.7**.

- **Main process** (`src/main`) — window lifecycle, IPC handlers, single-instance lock, tray, and all privileged services (`src/main/modules`):
  - Mojang version manifest parsing
  - File downloader with SHA-1 verification (client, libraries, OS-aware natives, asset objects)
  - Java detection + Temurin download from Adoptium with extraction and validation
  - Launch pipeline: classpath assembly, JVM/game arg resolution (modern + legacy), JVM spawn, log streaming, stop
  - Microsoft OAuth chain (MS → Xbox Live → XSTS → Minecraft) + offline UUID generation
  - Refresh token encryption with Electron's OS-backed `safeStorage`
  - Modrinth + optional CurseForge content search, installation with dependency walking, enable/disable/remove, update detection
  - Instance ZIP import/export with validation
  - Server-list ping (SLP protocol) + favicon extraction
- **Preload bridge** (`src/preload`) — the only, explicitly typed surface exposed to the renderer (`window.ordolith`), guarded by `contextIsolation`.
- **Renderer** (`src/renderer`) — the React UI (the "Liquid Glass" design system), Zustand store, Framer Motion animations, i18n with RU/EN/ES/ZH support.
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
