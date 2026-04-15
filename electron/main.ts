import path from 'path';
import { fileURLToPath } from 'url';
import { readdirSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { homedir } from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const { app, BrowserWindow, ipcMain } = await import('electron');

  let isDirty = false;
  let isForceClose = false;
  let mainWindow: InstanceType<typeof BrowserWindow> | null = null;

  // IPC: renderer tells us whether there are unsaved changes
  ipcMain.on('app:set-dirty', (_event, dirty: boolean) => {
    isDirty = dirty;
  });

  // IPC: renderer confirmed it's OK to close (after Save or Discard)
  ipcMain.on('app:close-confirmed', () => {
    isForceClose = true;
    mainWindow?.close();
  });

  // IPC: renderer requests fullscreen toggle
  ipcMain.on('app:toggle-fullscreen', () => {
    if (mainWindow) {
      mainWindow.setFullScreen(!mainWindow.isFullScreen());
    }
  });

  // IPC: list directory contents (for FileBrowserDialog)
  ipcMain.handle('fs:list-directory', (_event, dirPath: string) => {
    try {
      const raw = readdirSync(dirPath, { withFileTypes: true });
      const entries = raw
        .filter((e) => !e.name.startsWith('.'))
        .map((e) => ({ name: e.name, isDirectory: e.isDirectory() }))
        .sort((a, b) => {
          if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
          return a.name.localeCompare(b.name);
        });
      return { entries };
    } catch (e) {
      return { error: String(e) };
    }
  });

  // IPC: get standard OS paths (for FileBrowserDialog initial navigation)
  ipcMain.handle('fs:get-standard-paths', () => {
    const home = homedir();
    return {
      home,
      desktop: path.join(home, 'Desktop'),
      documents: path.join(home, 'Documents'),
      downloads: path.join(home, 'Downloads'),
    };
  });

  // IPC: create a directory
  ipcMain.handle('fs:create-directory', (_event, dirPath: string) => {
    try {
      mkdirSync(dirPath, { recursive: true });
      return { ok: true };
    } catch {
      return { ok: false };
    }
  });

  // IPC: read a file as base64 (for FileBrowserDialog open mode)
  ipcMain.handle('fs:read-file', (_event, filePath: string) => {
    try {
      const buf = readFileSync(filePath);
      return { base64: buf.toString('base64') };
    } catch (e) {
      return { error: String(e) };
    }
  });

  // IPC: write content to a known path (save without dialog)
  ipcMain.handle('fs:save-to-path', (_event, filePath: string, content: string) => {
    try {
      writeFileSync(filePath, content, 'utf-8');
      return { ok: true };
    } catch (e) {
      return { error: String(e) };
    }
  });

  function createWindow() {
    mainWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      webPreferences: {
        preload: path.join(__dirname, 'preload.cjs'),
        contextIsolation: true,
        nodeIntegration: false,
      },
      titleBarStyle: 'hidden',
      // Hide macOS traffic lights (minimize / maximize / close)
      ...(process.platform === 'darwin' ? { trafficLightPosition: { x: -100, y: -100 } } : {}),
    });

    const isDev = !app.isPackaged;

    if (isDev) {
      mainWindow.loadURL('http://localhost:5173');
      mainWindow.webContents.openDevTools();
    } else {
      mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    }

    // Notify renderer when fullscreen state changes
    mainWindow.on('enter-full-screen', () => {
      mainWindow?.webContents.send('app:fullscreen-changed', true);
    });
    mainWindow.on('leave-full-screen', () => {
      mainWindow?.webContents.send('app:fullscreen-changed', false);
    });

    // Intercept close when there are unsaved changes
    mainWindow.on('close', (e) => {
      if (!isForceClose && isDirty) {
        e.preventDefault();
        mainWindow?.webContents.send('app:close-requested');
      }
    });

    // Reset force-close flag when window is fully closed
    mainWindow.on('closed', () => {
      isForceClose = false;
      mainWindow = null;
    });
  }

  // On Linux, skip libsecret/keyring initialisation. Chromium's Safe Storage
  // tries to create a "Chromium Keys" item in the system keyring on every
  // launch when none exists, which blocks the main process for 15-20 s on
  // Cinnamon even when the keyring daemon is running and unlocked.
  if (process.platform === 'linux') {
    app.commandLine.appendSwitch('password-store', 'basic');
  }

  app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });
}

main();
