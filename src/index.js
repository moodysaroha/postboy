const { app, BrowserWindow, Menu, ipcMain } = require('electron');
const path = require('node:path');

if (require('electron-squirrel-startup')) {
  app.quit();
}

let loadingWindow = null;
let mainWindow = null;
let appUpdater = null;

const createLoadingWindow = () => {
  loadingWindow = new BrowserWindow({
    width: 400,
    height: 500,
    frame: false,
    resizable: false,
    transparent: false,
    backgroundColor: '#2c2f33',
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, 'assets', 'icons', 'win', 'icon.ico'),
  });

  loadingWindow.loadFile(path.join(__dirname, 'loading.html'));
  
  loadingWindow.once('ready-to-show', () => {
    loadingWindow.show();
  });
};

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    show: false,
    backgroundColor: '#1a1a1a',
    paintWhenInitiallyHidden: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      webSecurity: true,
      backgroundThrottling: false,
      offscreen: false
    },
    icon: path.join(__dirname, 'assets', 'icons', 'win', 'icon.ico'),
  });

  const template = [
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
              { role: 'paste' },
      { role: 'selectall' }
    ]
  },
  {
    label: 'Help',
    submenu: [
      {
        label: 'Check for Updates...',
        click: () => {
          if (appUpdater) {
            appUpdater.checkForUpdatesManual();
          }
        }
      },
      { type: 'separator' },
      {
        label: 'About PostBoy',
        click: () => {
          const { dialog } = require('electron');
          dialog.showMessageBox({
            type: 'info',
            title: 'About PostBoy',
            message: 'PostBoy',
            detail: `Version: ${app.getVersion()}\nElectron: ${process.versions.electron}\nNode: ${process.versions.node}`,
            buttons: ['OK']
          });
        }
      }
    ]
  }
];

const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);

  // Enable context menu (right-click)
  mainWindow.webContents.on('context-menu', (event, params) => {
    const contextMenu = Menu.buildFromTemplate([
      { role: 'cut' },
      { role: 'copy' },
      { role: 'paste' },
      { type: 'separator' },
      { role: 'selectall' },
      { type: 'separator' },
      { 
        label: 'Inspect Element',
        click: () => {
          mainWindow.webContents.inspectElement(params.x, params.y);
        }
      }
    ]);
    contextMenu.popup();
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  // Wait for the main window to be ready
  mainWindow.once('ready-to-show', () => {
    if (loadingWindow && !loadingWindow.isDestroyed()) {
      loadingWindow.webContents.send('app-ready');
    }
    
    // Transition from loading to main window
    setTimeout(() => {
      if (loadingWindow && !loadingWindow.isDestroyed()) {
        // Show main window
        mainWindow.maximize();
        mainWindow.show();
        
        // Close loading window after main window is visible
        setTimeout(() => {
          if (loadingWindow && !loadingWindow.isDestroyed()) {
            loadingWindow.close();
            loadingWindow = null;
          }
        }, 300);
      } else {
        mainWindow.maximize();
        mainWindow.show();
      }
    }, 800); // Give loading screen time to show "Ready!" status
  });
};

app.whenReady().then(() => {
  // Ensure Windows uses a stable AppUserModelID so taskbar/Start icons map to our resources
  try {
    const desiredAppId = 'com.moodysaroha.postboy';
    if (process.platform === 'win32') {
      const currentId = app.getAppUserModelId && app.getAppUserModelId();
      if (!currentId || currentId !== desiredAppId) {
        app.setAppUserModelId(desiredAppId);
      }
    }
  } catch (e) {
    // no-op if API not available on this platform
  }

  // Initialize auto-updater
  const AppUpdater = require('./updater');
  appUpdater = new AppUpdater();
  
  // IPC Handlers
  ipcMain.handle('get-version', () => {
    return app.getVersion();
  });
  
  // First create and show loading window
  createLoadingWindow();
  
  // Then create main window in background
  setTimeout(() => {
    createWindow();
    // Set main window for updater after it's created
    if (appUpdater && mainWindow) {
      appUpdater.setMainWindow(mainWindow);
    }
  }, 100);

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
