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

- **Main process** (`src/main`) — window lifecycle, IPC handlers, single-instance lock.
- **Preload bridge** (`src/preload`) — the only, explicitly typed surface exposed to
  the renderer (`window.ordolith`), guarded by `contextIsolation`.
- **Renderer** (`src/renderer`) — the React UI.
- **Shared** (`src/shared`) — IPC channel names and payload types shared across processes.

## Development

Requires Node.js 20+.

```bash
npm install       # install dependencies
npm run dev       # start the launcher with HMR
npm run typecheck # type-check main + renderer
npm run build     # produce a production bundle in out/
npm run dist      # build platform installers via electron-builder
```

> Note: the app must be run on a desktop machine — Electron needs a display and
> cannot be previewed in a browser-only environment.
