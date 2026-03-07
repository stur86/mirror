
import path from 'path';
import { fileURLToPath } from 'url';

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
