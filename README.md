# Mirror

Translation-focused text editor. Available as a Tauri desktop app, an Electron desktop app, or a pure web build.

## Prerequisites

### All platforms

- [Bun](https://bun.sh) — package manager and script runner
- [Rust](https://rustup.rs) — required for Tauri builds only

```bash
bun install
```

### Linux (Tauri only)

Tauri's webview (webkit2gtk) requires several system libraries:

```bash
sudo apt-get install -y \
  libwebkit2gtk-4.1-dev \
  libappindicator3-dev \
  librsvg2-dev \
  patchelf \
  gstreamer1.0-plugins-base \
  gstreamer1.0-plugins-good \
  gstreamer1.0-plugins-bad \
  gstreamer1.0-gl
```

> End users running the Linux AppImage on a minimal system will also need the GStreamer packages above. The webkit2gtk webview requires them at runtime even though Mirror itself has no audio or video features.

## Development

```bash
# Web (Vite dev server)
bun run dev

# Tauri (Vite dev server + native window)
bun run tauri:dev

# Electron
bun run electron:dev
```

## Building

```bash
# Web (outputs to dist/)
bun run build

# Tauri (outputs to src-tauri/target/release/bundle/)
bun run tauri:build

# Electron (outputs to release/)
bun run electron:build
```

## CI builds (Tauri)

Three GitHub Actions workflows are available under **Actions → Build Tauri**, each triggered manually via `workflow_dispatch`. They build and upload platform installers as artifacts:

| Workflow | Runner | Artifacts |
|---|---|---|
| Build Tauri (Linux) | ubuntu-22.04 | `.AppImage`, `.deb` |
| Build Tauri (macOS) | macos-latest | `.dmg`, `.app` |
| Build Tauri (Windows) | windows-latest | `.exe` (NSIS), `.msi` |

macOS builds are unsigned (for experimentation). Configure `APPLE_CERTIFICATE` secrets in the repository settings to enable codesigning for distribution.
