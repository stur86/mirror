import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';

export interface NativeAPI {
  isNative: boolean;
  startDragging(): void;
  setDirty(isDirty: boolean): void;
  onCloseRequested(cb: () => void): () => void;
  confirmClose(): void;
  toggleFullscreen(): void;
  onFullscreenChange(cb: (isFullscreen: boolean) => void): () => void;
  close(): void;
  saveTextFileAt(path: string, content: string): Promise<void>;
  listDirectory(path: string): Promise<{ entries: Array<{ name: string; isDirectory: boolean }> } | { error: string }>;
  getStandardPaths(): Promise<{ home: string; desktop: string; documents: string; downloads: string }>;
  createDirectory(path: string): Promise<{ ok: boolean }>;
  readFile(path: string): Promise<{ base64: string } | { error: string }>;
}

function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

function createTauriAPI(): NativeAPI {
  return {
    isNative: true,

    startDragging() {
      void getCurrentWindow().startDragging();
    },

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

    async saveTextFileAt(path, content) {
      await invoke('save_text_file_at', { filePath: path, content });
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

export const nativeAPI: NativeAPI | null = isTauri() ? createTauriAPI() : null;
