# Electrobun Migration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace Electron with Electrobun as the desktop shell, preserving the dual-build (Electrobun desktop + Vite pure-web).

**Architecture:** Vite continues building the React frontend to `dist/`. A new `src/bun/index.ts` replaces `electron/main.ts`, using Electrobun's `BrowserWindow`. A `src/electrobun/view.ts` file runs in the webview (bundled by Vite), sets up Electroview RPC, and populates a `window.electronAPI`-compatible facade so `App.tsx` and `MenuBar.tsx` need zero changes.

**Tech Stack:** Electrobun v1, Bun, Vite (unchanged), React (unchanged), TypeScript.

---

## Background Reading

Before starting, skim these to orient yourself:
- [Electrobun BrowserWindow API](https://blackboard.sh/electrobun/docs/apis/browser-window/)
- [Electrobun Electroview API](https://blackboard.sh/electrobun/docs/apis/browser/electroview-class/)
- [Electrobun BrowserView API](https://blackboard.sh/electrobun/docs/apis/browser-view/) — this is where `defineRPC` lives

The key concept: RPC replaces Electron's `contextBridge`/`ipcRenderer`. A shared type defines what messages flow in each direction; `BrowserView.defineRPC` sets up handlers in the bun process; `Electroview.defineRPC` + `new Electroview({ rpc })` sets up handlers in the webview.

---

## Task 1: Install Electrobun and Update package.json

**Files:**
- Modify: `package.json`

**Step 1: Install electrobun**

```bash
bun add electrobun
```

**Step 2: Remove Electron dependencies**

```bash
bun remove electron electron-builder concurrently wait-on
```

**Step 3: Update `package.json` scripts**

Replace the `scripts` section with:

```json
"scripts": {
  "dev": "vite",
  "build": "vite build",
  "preview": "vite preview",
  "electrobun:dev": "concurrently \"vite\" \"wait-on http://localhost:5173 && electrobun dev\"",
  "electrobun:build": "bun run build && electrobun build",
  "typecheck": "tsc --noEmit",
  "generate-icons": "bun run scripts/generate_icons.ts",
  "test": "bun test"
}
```

Note: `concurrently` and `wait-on` are needed for `electrobun:dev`, so re-add them:

```bash
bun add -d concurrently wait-on
```

**Step 4: Remove the `"build"` (electron-builder) section from package.json**

Delete the entire `"build": { ... }` key from `package.json` (this was the electron-builder config). The Electrobun equivalent moves to `electrobun.config.ts`.

**Step 5: Verify**

```bash
bun install
```

Expected: clean install, no errors about missing packages.

**Step 6: Commit**

```bash
git add package.json bun.lockb
git commit -m "chore: replace electron with electrobun dependency"
```

---

## Task 2: Create electrobun.config.ts

**Files:**
- Create: `electrobun.config.ts`

**Step 1: Create the file**

```typescript
// electrobun.config.ts
export default {
  app: {
    name: "Mirror",
    identifier: "com.mirror.app",
    version: "0.1.1-alpha.2",
  },
  build: {
    bun: {
      entrypoint: "src/bun/index.ts",
    },
  },
};
```

**Step 2: Verify the config is valid**

```bash
bun run electrobun build 2>&1 | head -20
```

Expected: it may fail because `src/bun/index.ts` doesn't exist yet — that's fine. The error should be about a missing file, not a config parse error.

**Step 3: Commit**

```bash
git add electrobun.config.ts
git commit -m "chore: add electrobun.config.ts"
```

---

## Task 3: Create Shared RPC Type

**Files:**
- Create: `src/shared/rpc.types.ts`

**Step 1: Create the file**

This file defines the message schema for both directions. All communication is one-way messages (no request/response). Import `RPCSchema` from `electrobun/bun` — if this import path causes Vite errors later, try `electrobun` directly.

```typescript
// src/shared/rpc.types.ts
// RPCSchema is a type helper from Electrobun. Import from electrobun/bun;
// if Vite complains about this import, wrap in `import type` or try `electrobun`.
import type { RPCSchema } from "electrobun/bun";

export type MirrorRPCType = {
  // Handlers that run in the bun (main) process
  bun: RPCSchema<{
    requests: Record<string, never>;
    messages: {
      // Renderer tells main: dirty state changed
      setDirty: { dirty: boolean };
      // Renderer confirms it's OK to close (after Save / Discard)
      confirmClose: Record<string, never>;
      // Renderer requests fullscreen toggle
      toggleFullscreen: Record<string, never>;
    };
  }>;
  // Handlers that run in the webview (renderer) process
  webview: RPCSchema<{
    requests: Record<string, never>;
    messages: {
      // Main tells renderer: user tried to close with unsaved changes
      closeRequested: Record<string, never>;
      // Main tells renderer: fullscreen state changed
      fullscreenChanged: { isFullscreen: boolean };
    };
  }>;
};
```

**Step 2: Check TypeScript is happy**

```bash
bun run typecheck 2>&1 | grep -i error | head -20
```

Expected: possibly errors in other files about `window.electronAPI` — ignore those for now. No errors in `src/shared/rpc.types.ts` itself.

**Step 3: Commit**

```bash
git add src/shared/rpc.types.ts
git commit -m "feat: add shared Electrobun RPC type definition"
```

---

## Task 4: Create the Electrobun Main Process

**Files:**
- Create: `src/bun/index.ts`

**Step 1: Create the file**

```typescript
// src/bun/index.ts
import { BrowserView, BrowserWindow } from "electrobun/bun";
import type { MirrorRPCType } from "../shared/rpc.types";

let isDirty = false;
let isForceClose = false;
// win is declared with `let` so the close handler can reference it after assignment
let win: InstanceType<typeof BrowserWindow>;

const rpc = BrowserView.defineRPC<MirrorRPCType>({
  maxRequestTime: 5000,
  handlers: {
    requests: {},
    messages: {
      setDirty: ({ dirty }) => {
        isDirty = dirty;
      },
      confirmClose: () => {
        isForceClose = true;
        win.close();
      },
      toggleFullscreen: () => {
        win.setFullScreen(!win.isFullScreen());
      },
    },
  },
});

// Detect dev mode. Electrobun sets ELECTROBUN_DEV=1 when running `electrobun dev`.
const isDev = process.env["ELECTROBUN_DEV"] === "1";

win = new BrowserWindow({
  title: "Mirror",
  frame: { width: 1200, height: 800 },
  titleBarStyle: "hiddenInset",
  rpc,
  url: isDev ? "http://localhost:5173" : "file://./dist/index.html",
  // TODO: verify the production file path. Electrobun may provide a helper like
  // `Electrobun.getAppPath()` to get the correct absolute path — check the
  // "File Paths" section of the Bun APIs documentation.
});

// Track last known fullscreen state to detect changes
let lastFullscreen = win.isFullScreen();

// Use resize event as a proxy for fullscreen changes (no dedicated fullscreen event in v1)
win.on("resize", () => {
  const isFullscreen = win.isFullScreen();
  if (isFullscreen !== lastFullscreen) {
    lastFullscreen = isFullscreen;
    win.webview.rpc.send.fullscreenChanged({ isFullscreen });
  }
});

// Intercept close when there are unsaved changes
// NOTE: Electrobun v1 may not support event.preventDefault() on the close event.
// If it does, add `event.preventDefault()` inside the if-block.
// If it doesn't, the window will close but the dialog will still have opened in the renderer.
// Track this as a known limitation to address in a follow-up.
win.on("close", () => {
  if (!isForceClose && isDirty) {
    win.webview.rpc.send.closeRequested({});
    // If Electrobun supports prevent: try `event.preventDefault()` here
  }
  isForceClose = false;
});
```

**Step 2: Try to build**

```bash
bun run electrobun build 2>&1
```

Expected: Electrobun compiles `src/bun/index.ts` successfully. TypeScript errors about `MirrorRPCType` are fine for now (task 3 should have solved those). If you see "cannot find module 'electrobun/bun'", run `bun install` first.

**Step 3: Commit**

```bash
git add src/bun/index.ts
git commit -m "feat: add Electrobun main process (replaces electron/main.ts)"
```

---

## Task 5: Create the Electroview Renderer Setup

**Files:**
- Create: `src/electrobun/view.ts`

This file runs in the webview (browser). It's imported by `src/main.tsx` and sets up the Electroview RPC. Crucially, it populates `window.electronAPI` with the same interface as before — so `App.tsx` and `MenuBar.tsx` need zero changes.

**Step 1: Create the file**

```typescript
// src/electrobun/view.ts
// This file is imported by main.tsx. It guards itself with a window.__electrobun check,
// so it's a no-op in the pure-web build.

// Only run when inside an Electrobun webview
if (typeof window !== "undefined" && (window as unknown as { __electrobun?: unknown }).__electrobun) {
  // Dynamic import to avoid Vite resolving electrobun/view at build time
  // when running as a pure web app.
  import("electrobun/view").then(({ Electroview }) => {
    // Callback storage — handlers are registered lazily by React components
    let closeRequestedCallback: (() => void) | null = null;
    let fullscreenChangeCallback: ((isFullscreen: boolean) => void) | null = null;

    const rpc = Electroview.defineRPC({
      handlers: {
        requests: {},
        messages: {
          closeRequested: () => {
            closeRequestedCallback?.();
          },
          fullscreenChanged: ({ isFullscreen }: { isFullscreen: boolean }) => {
            fullscreenChangeCallback?.(isFullscreen);
          },
        },
      },
    });

    const electroview = new Electroview({ rpc });

    // Populate window.electronAPI so App.tsx / MenuBar.tsx are unchanged
    (window as unknown as {
      electronAPI: {
        isElectron: boolean;
        setDirty: (isDirty: boolean) => void;
        onCloseRequested: (cb: () => void) => () => void;
        confirmClose: () => void;
        toggleFullscreen: () => void;
        onFullscreenChange: (cb: (isFullscreen: boolean) => void) => () => void;
      };
    }).electronAPI = {
      isElectron: true,

      setDirty: (isDirty: boolean) => {
        electroview.rpc.send.setDirty({ dirty: isDirty });
      },

      onCloseRequested: (cb: () => void) => {
        closeRequestedCallback = cb;
        return () => {
          closeRequestedCallback = null;
        };
      },

      confirmClose: () => {
        electroview.rpc.send.confirmClose({});
      },

      toggleFullscreen: () => {
        electroview.rpc.send.toggleFullscreen({});
      },

      onFullscreenChange: (cb: (isFullscreen: boolean) => void) => {
        fullscreenChangeCallback = cb;
        return () => {
          fullscreenChangeCallback = null;
        };
      },
    };
  });
}
```

**Step 2: Import it from main.tsx**

Open `src/main.tsx` and add this import at the top (before React renders):

```typescript
import "./electrobun/view";
```

This import is safe in the web build — the file guards itself with `window.__electrobun`.

**Step 3: Verify web build still works**

```bash
bun run build 2>&1
```

Expected: clean build. If Vite errors on `import("electrobun/view")`, add to `vite.config.ts`:
```typescript
// in defineConfig({ ... })
optimizeDeps: {
  exclude: ["electrobun"],
},
build: {
  rollupOptions: {
    external: [], // do NOT externalize — keep it bundled; the __electrobun guard handles it
  },
},
```

**Step 4: Commit**

```bash
git add src/electrobun/view.ts src/main.tsx
git commit -m "feat: add Electroview renderer setup, populates window.electronAPI facade"
```

---

## Task 6: Clean Up Electron Artifacts

**Files:**
- Delete: `electron/main.ts`
- Delete: `electron/preload.cts`
- Delete: `tsconfig.electron.json`
- Modify: `tsconfig.json`
- Modify: `src/types/electron.d.ts`

**Step 1: Delete the old electron files**

```bash
rm electron/main.ts electron/preload.cts tsconfig.electron.json
rmdir electron 2>/dev/null || true
```

**Step 2: Fix tsconfig.json**

The current `tsconfig.json` has `"include": ["electron/**/*"]` and `"exclude": ["src/**/*"]` — this is wrong for the frontend build. Update it:

Open `tsconfig.json` and change:
```json
"include": ["electron/**/*"],
"exclude": ["node_modules/bun-types/*", "**/*.test.ts", "src/**/*"]
```
to:
```json
"include": ["src/**/*"],
"exclude": ["node_modules/bun-types/*", "**/*.test.ts"]
```

Also remove `"outDir": "electron-dist"` from `compilerOptions` (it's unused with Vite/Electrobun).

**Step 3: Update src/types/electron.d.ts**

The type declaration is still valid (it declares `window.electronAPI` which we still populate). Just update the comment:

```typescript
// src/types/electron.d.ts
// window.electronAPI is populated by src/electrobun/view.ts when running inside Electrobun.
// It is undefined in the pure-web build.
declare global {
  interface Window {
    electronAPI?: {
      isElectron: boolean;
      setDirty: (isDirty: boolean) => void;
      onCloseRequested: (cb: () => void) => () => void;
      confirmClose: () => void;
      toggleFullscreen: () => void;
      onFullscreenChange: (cb: (isFullscreen: boolean) => void) => () => void;
    };
  }
}

export {};
```

**Step 4: Verify typecheck passes**

```bash
bun run typecheck 2>&1
```

Expected: no errors (or only pre-existing unrelated errors).

**Step 5: Verify web build still works**

```bash
bun run build 2>&1
```

Expected: clean build.

**Step 6: Commit**

```bash
git add -A
git commit -m "chore: remove electron/ folder and clean up tsconfig"
```

---

## Task 7: Smoke Test

**Step 1: Start Vite dev server first, then run Electrobun dev**

In one terminal:
```bash
bun run dev
```

Wait for `Local: http://localhost:5173/` to appear, then in another terminal:
```bash
electrobun dev
```

Or use the combined script:
```bash
bun run electrobun:dev
```

**Step 2: Manual verification checklist**

Check each of these:

- [ ] App window opens at 1200×800
- [ ] UI renders correctly (both panes, ruler bar, menu bar)
- [ ] Dark/light mode works
- [ ] Open a `.mirror.json` project file — editor populates
- [ ] Make a change → title bar should show unsaved state
- [ ] Try to close the window with unsaved changes → "Unsaved changes" dialog appears
- [ ] Click "Save" in dialog → project saves → window closes
- [ ] Click "Discard" in dialog → window closes without saving
- [ ] Full-screen toggle button in menu bar works
- [ ] Leaving full screen works

**Step 3: Verify web build works independently**

```bash
bun run build && bun run preview
```

Open `http://localhost:4173` in a browser. Confirm the app loads and works (no Electrobun-specific features, but no JS errors either).

**Step 4: If window close interception doesn't work**

If the window closes immediately without showing the dialog (because `event.preventDefault()` isn't supported), file this as a known limitation in the branch. Check the [Electrobun GitHub issues](https://github.com/blackboardsh/electrobun/issues) for `preventDefault` or window close interception. The workaround is to handle the "are you sure?" entirely in the webview with a custom close button and disable the native close via `styleMask` (remove `Closable`).

**Step 5: Commit any fixes found during smoke test, then commit the version bump**

```bash
bun pm version prerelease --preid=alpha
```

---

## Known Limitations / TODOs

1. **Window close interception**: Electrobun v1 may not support `event.preventDefault()` on the close event. Workaround: use `styleMask` to remove the native close button and handle close entirely via a custom button in the webview.

2. **Production file path**: `file://./dist/index.html` in the main process may need to be an absolute path. Check the Electrobun "File Paths" Bun API for `Electrobun.getAppPath()` or similar.

3. **Fullscreen change detection**: Using `resize` event as a proxy. If the `resize` event fires too often or not at all during fullscreen, check Electrobun issues for a dedicated fullscreen event or use polling.

4. **Linux app menu**: Electrobun v1 doesn't support native app menus on Linux. Mirror's menu bar is implemented in HTML/React, so this is not an issue.

5. **Windows**: Not targeted in this branch.
