# Design: Electrobun Migration

**Date:** 2026-03-19
**Branch:** electrobun-experimental
**Status:** Approved

## Goal

Replace Electron with Electrobun as the desktop shell for Mirror, while preserving the existing dual-build capability (Electrobun desktop + Vite pure-web).

## Approach

Option A: Vite stays as the UI bundler; Electrobun replaces only the Electron shell and IPC layer. The React frontend built by Vite is loaded by Electrobun's `BrowserWindow` — from `http://localhost:5173` in dev, from the `dist/` output in production. No changes to the Vite pipeline or the web build.

## Architecture

```
Vite (web)  ──► dist/        ← unchanged, still works as pure web
Electrobun  ──► bun runtime  ← replaces electron/
```

A new `electrobun/` directory replaces the existing `electron/` directory. The React frontend is untouched except for swapping `window.electronAPI` for Electrobun's typed RPC on the Electrobun-specific code paths.

## IPC → RPC Translation

All 5 current `electronAPI` methods are fire-and-forget messages (no responses needed), mapped as:

| Current (`window.electronAPI`) | Direction | Electrobun RPC |
|---|---|---|
| `setDirty(bool)` | webview → bun | `rpc.send.setDirty` |
| `onCloseRequested(cb)` | bun → webview | `rpc.send.closeRequested` |
| `confirmClose()` | webview → bun | `rpc.send.confirmClose` |
| `toggleFullscreen()` | webview → bun | `rpc.send.toggleFullscreen` |
| `onFullscreenChange(cb)` | bun → webview | `rpc.send.fullscreenChanged` |

A shared type file (`src/shared/rpc.types.ts`) defines the `RPCSchema` used by both the bun main process and the Electroview frontend instance.

The `isElectron` guard is replaced with a check for `window.__electrobun !== undefined`.

## File Changes

### New files
- `electrobun/main.ts` — main process (replaces `electron/main.ts`)
- `src/electrobun/view.ts` — Electroview init + RPC setup (renderer side)
- `src/shared/rpc.types.ts` — shared RPC type schema
- `electrobun.config.ts` — Electrobun app config

### Modified files
- `src/App.tsx` — swap `window.electronAPI.*` for Electroview RPC
- `src/components/MenuBar.tsx` — same
- `src/types/electron.d.ts` — remove Electron-specific declarations
- `package.json` — add `electrobun` dep, remove `electron`/`electron-builder`, update scripts

### Deleted files
- `electron/main.ts`
- `electron/preload.cts`
- `tsconfig.electron.json` (if present)

## Build Scripts

```json
"scripts": {
  "dev": "vite",
  "build": "vite build",
  "electrobun:dev": "bun run build:dev && electrobun dev",
  "build:dev": "bun install && electrobun build",
  "electrobun:build": "bun run build && electrobun build",
  "test": "bun test"
}
```

## Platform Targets

- **macOS** — primary target, fully supported by Electrobun v1
- **Linux (Ubuntu 22.04+)** — secondary target, officially supported (note: native app menus not yet available on Linux, but Mirror doesn't rely on these)
- **Windows** — deferred; not a priority for this experimental branch

## Out of Scope

- Migrating from Vite to Bun's bundler for the frontend
- Using Electrobun's `views://` custom scheme (can be explored later)
- Windows packaging
