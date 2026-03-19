// src/electrobun/view.ts
// This file is imported by main.tsx. It guards itself with a window.__electrobun check,
// so it's a no-op in the pure-web build.

// Import type only — erased at build time, safe in the pure-web build.
import type { MirrorRPCType } from "../shared/rpc.types";

// Only run when inside an Electrobun webview
if (typeof window !== "undefined" && (window as unknown as { __electrobun?: unknown }).__electrobun) {
  // Dynamic import to avoid Vite resolving electrobun/view at build time
  // when running as a pure web app.
  import("electrobun/view").then(({ Electroview }) => {
    // Callback storage — handlers are registered lazily by React components
    let closeRequestedCallback: (() => void) | null = null;
    let fullscreenChangeCallback: ((isFullscreen: boolean) => void) | null = null;

    const rpc = Electroview.defineRPC<MirrorRPCType>({
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
        electroview.rpc!.send.setDirty({ dirty: isDirty });
      },

      onCloseRequested: (cb: () => void) => {
        closeRequestedCallback = cb;
        return () => {
          closeRequestedCallback = null;
        };
      },

      confirmClose: () => {
        electroview.rpc!.send.confirmClose({});
      },

      toggleFullscreen: () => {
        electroview.rpc!.send.toggleFullscreen({});
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
