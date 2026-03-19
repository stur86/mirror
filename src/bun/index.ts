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
  frame: { x: 0, y: 0, width: 1200, height: 800 },
  titleBarStyle: "hiddenInset",
  rpc,
  url: isDev ? "http://localhost:5173" : "file://./dist/index.html",
  // TODO: verify the production file path. Electrobun may provide a helper like
  // `Electrobun.getAppPath()` to get the correct absolute path — check the
  // "File Paths" section of the Bun APIs documentation.
});

// Track last known fullscreen state to detect changes
let lastFullscreen = win.isFullScreen();

// Use resize event as a proxy for fullscreen changes (no dedicated fullscreen event in v1).
// The resize event handler receives an ElectrobunEvent with .data containing { id, x, y, width, height }.
win.on("resize", () => {
  const isFullscreen = win.isFullScreen();
  if (isFullscreen !== lastFullscreen) {
    lastFullscreen = isFullscreen;
    win.webview.rpc.send.fullscreenChanged({ isFullscreen });
  }
});

// Intercept close when there are unsaved changes.
// NOTE: Electrobun v1's close event does not support event.preventDefault() —
// the event type is ElectrobunEvent<{ id }, {}> with no response mechanism.
// We notify the renderer so it can show the Save/Discard dialog, but the window
// will still close unless the user cancels via confirmClose (which sets isForceClose).
// Track this as a known limitation to address in a follow-up if Electrobun adds
// preventDefault support in a future version.
win.on("close", () => {
  if (!isForceClose && isDirty) {
    win.webview.rpc.send.closeRequested({});
    // If Electrobun supports prevent: try `event.preventDefault()` here
  }
  isForceClose = false;
});
