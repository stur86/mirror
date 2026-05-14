import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

export interface NativeAPI {
  isNative: boolean;
  setDirty(isDirty: boolean): void;
  onCloseRequested(cb: () => void): () => void;
  confirmClose(): void;
  toggleFullscreen(): void;
  onFullscreenChange(cb: (isFullscreen: boolean) => void): () => void;
  close(): void;
  saveProjectToPath(path: string, content: string): Promise<void>;
  listDirectory(path: string): Promise<{ entries: Array<{ name: string; isDirectory: boolean }> } | { error: string }>;
  getStandardPaths(): Promise<{ home: string; desktop: string; documents: string; downloads: string }>;
  createDirectory(path: string): Promise<{ ok: boolean }>;
  readFile(path: string): Promise<{ base64: string } | { error: string }>;
}

function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

function isElectron(): boolean {
  return typeof window !== 'undefined' && !!window.electronAPI?.isElectron;
}

function createTauriAPI(): NativeAPI {
  return {
    isNative: true,

    setDirty(isDirty) {
      void invoke('set_dirty', { isDirty });
    },

    onCloseRequested(cb) {
      let unsub: (() => void) | null = null;
      void listen('mirror:close-requested', () => cb()).then(fn => { unsub = fn; });
      return () => { unsub?.(); };
    },

    confirmClose() {
      void invoke('confirm_close');
    },

    toggleFullscreen() {
      void invoke('toggle_fullscreen');
    },

    onFullscreenChange(cb) {
      let unsub: (() => void) | null = null;
      void listen<boolean>('mirror:fullscreen-changed', (e) => cb(e.payload)).then(fn => { unsub = fn; });
      return () => { unsub?.(); };
    },

    close() {
      void invoke('close_window');
    },

    async saveProjectToPath(path, content) {
      await invoke('save_to_path', { filePath: path, content });
    },

    listDirectory(path) {
      return invoke('list_directory', { dirPath: path });
    },

    getStandardPaths() {
      return invoke('get_standard_paths');
    },

    createDirectory(path) {
      return invoke('create_directory', { dirPath: path });
    },

    readFile(path) {
      return invoke('read_file', { filePath: path });
    },
  };
}

function createElectronAPI(): NativeAPI {
  const e = window.electronAPI!;
  return {
    isNative: true,
    setDirty: (isDirty) => e.setDirty(isDirty),
    onCloseRequested: (cb) => e.onCloseRequested(cb),
    confirmClose: () => e.confirmClose(),
    toggleFullscreen: () => e.toggleFullscreen(),
    onFullscreenChange: (cb) => e.onFullscreenChange(cb),
    close: () => window.close(),
    saveProjectToPath: (path, content) => e.saveProjectToPath(path, content),
    listDirectory: (path) => e.listDirectory(path),
    getStandardPaths: () => e.getStandardPaths(),
    createDirectory: (path) => e.createDirectory(path),
    readFile: (path) => e.readFile(path),
  };
}

export const nativeAPI: NativeAPI | null = isTauri()
  ? createTauriAPI()
  : isElectron()
  ? createElectronAPI()
  : null;
