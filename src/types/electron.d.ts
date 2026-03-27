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
      // File dialogs (Electrobun only — not available in pure-web build)
      saveProjectAs: (suggestedName: string, content: string) => Promise<string | null>;
      saveProjectToPath: (path: string, content: string) => Promise<void>;
      listDirectory: (path: string) => Promise<{ entries: Array<{ name: string; isDirectory: boolean }> } | { error: string }>;
      getStandardPaths: () => Promise<{ home: string; desktop: string; documents: string; downloads: string }>;
      createDirectory: (path: string) => Promise<{ ok: boolean }>;
      readFile: (path: string) => Promise<{ base64: string } | { error: string }>;
    };
  }
}

export {};
