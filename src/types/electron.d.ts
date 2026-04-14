// src/types/electron.d.ts
// window.electronAPI is injected by Electron's preload script via contextBridge.
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
      // File system operations (used by FileBrowserDialog — not available in pure-web build)
      saveProjectToPath: (path: string, content: string) => Promise<void>;
      listDirectory: (path: string) => Promise<{ entries: Array<{ name: string; isDirectory: boolean }> } | { error: string }>;
      getStandardPaths: () => Promise<{ home: string; desktop: string; documents: string; downloads: string }>;
      createDirectory: (path: string) => Promise<{ ok: boolean }>;
      readFile: (path: string) => Promise<{ base64: string } | { error: string }>;
    };
  }
}

export {};
