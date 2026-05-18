const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,

  // Unsaved changes: tell main whether the project is dirty
  setDirty: (isDirty: boolean) => {
    ipcRenderer.send('app:set-dirty', isDirty);
  },

  // Register a callback for when main requests a close (unsaved changes present)
  // Returns an unsubscribe function
  onCloseRequested: (cb: () => void) => {
    const handler = () => cb();
    ipcRenderer.on('app:close-requested', handler);
    return () => ipcRenderer.removeListener('app:close-requested', handler);
  },

  // Renderer confirms it's safe to close after Save / Discard
  confirmClose: () => {
    ipcRenderer.send('app:close-confirmed');
  },

  // Fullscreen
  toggleFullscreen: () => {
    ipcRenderer.send('app:toggle-fullscreen');
  },

  // Register a callback for fullscreen state changes
  // Returns an unsubscribe function
  onFullscreenChange: (cb: (isFullscreen: boolean) => void) => {
    const handler = (_: unknown, value: boolean) => cb(value);
    ipcRenderer.on('app:fullscreen-changed', handler);
    return () => ipcRenderer.removeListener('app:fullscreen-changed', handler);
  },

  // File system operations (used by FileBrowserDialog)
  listDirectory: (dirPath: string) =>
    ipcRenderer.invoke('fs:list-directory', dirPath),

  getStandardPaths: () =>
    ipcRenderer.invoke('fs:get-standard-paths'),

  createDirectory: (dirPath: string) =>
    ipcRenderer.invoke('fs:create-directory', dirPath),

  readFile: (filePath: string) =>
    ipcRenderer.invoke('fs:read-file', filePath),

  saveProjectToPath: async (filePath: string, content: string) => {
    const result = await ipcRenderer.invoke('fs:save-to-path', filePath, content);
    if (result && 'error' in result) throw new Error(result.error);
  },
});
