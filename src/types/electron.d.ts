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
