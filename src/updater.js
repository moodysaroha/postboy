const { app, dialog, BrowserWindow } = require('electron');
const { autoUpdater } = require('electron-updater');

class AppUpdater {
  constructor() {
    this.isManualCheck = false;
    this.updateCheckTimeout = null;
    this.mainWindow = null;
    this.setupUpdater();
  }
  
  setMainWindow(window) {
    this.mainWindow = window;
  }
  
  sendToRenderer(data) {
    return new Promise((resolve) => {
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        // Send notification to renderer
        this.mainWindow.webContents.send('update-notification', data);
        
        // For messages that don't need a response, resolve immediately
        if (data.type === 'checking' || data.type === 'not-available' || 
            data.type === 'error' || data.type === 'timeout') {
          resolve(null);
        } else {
          // For messages that need a response, wait for it
          const { ipcMain } = require('electron');
          
          // Set up one-time listener for response
          const responseHandler = (event, response) => {
            if (event.sender === this.mainWindow.webContents) {
              ipcMain.removeListener('update-response', responseHandler);
              resolve(response);
            }
          };
          
          ipcMain.on('update-response', responseHandler);
          
          // Timeout after 60 seconds if no response
          setTimeout(() => {
            ipcMain.removeListener('update-response', responseHandler);
            resolve(null);
          }, 60000);
        }
      } else {
        // Fallback to native dialog if no window available
        this.showNativeDialog(data).then(resolve);
      }
    });
  }
  
  async showNativeDialog(data) {
    // Fallback to native dialogs if renderer is not available
    switch (data.type) {
      case 'available':
        const availableResult = await dialog.showMessageBox({
          type: 'info',
          title: 'Update Available',
          message: `A new version (${data.data.version}) of PostBoy is available.`,
          detail: 'Would you like to download it now?',
          buttons: ['Later', 'Download Now'],
          defaultId: 1
        });
        return availableResult;
      
      case 'not-available':
        await dialog.showMessageBox({
          type: 'info',
          title: 'No Updates Available',
          message: 'PostBoy is up to date!',
          detail: `You are running the latest version (${data.data.version}).`,
          buttons: ['OK']
        });
        return null;
      
      case 'downloaded':
        const downloadedResult = await dialog.showMessageBox({
          type: 'info',
          title: 'Update Ready',
          message: `Version ${data.data.version} has been downloaded.`,
          detail: 'The update will be applied when you restart the application. Would you like to restart now?',
          buttons: ['Later', 'Restart Now'],
          defaultId: 1
        });
        return downloadedResult;
      
      case 'error':
        dialog.showErrorBox('Update Error', 
          `An error occurred while checking for updates: ${data.data.message}`);
        return null;
      
      case 'timeout':
        await dialog.showMessageBox({
          type: 'warning',
          title: 'Update Check Timeout',
          message: 'Update check is taking longer than expected.',
          detail: 'The update server may be unreachable. Please check your internet connection and try again later.',
          buttons: ['OK']
        });
        return null;
      
      case 'checking':
        // Can't really show a non-blocking dialog with native dialogs
        console.log('Checking for updates...');
        return null;
      
      default:
        return null;
    }
  }

  setupUpdater() {
    // Configure electron-updater for GitHub releases
    autoUpdater.autoDownload = false; // Don't auto-download, let user choose
    autoUpdater.autoInstallOnAppQuit = true;

    // Enable debug logging for electron-updater
    try {
      const log = require('electron-log');
      log.transports.file.level = 'debug';
      autoUpdater.logger = log;
      log.info('Updater logging enabled');
    } catch (e) {
      console.warn('electron-log not available; updater logs limited');
    }
    
    // Set the feed URL manually for better control
    const { app } = require('electron');
    const path = require('path');
    
    // Try to find app-update.yml in different locations
    const possiblePaths = [
      path.join(process.resourcesPath, 'app-update.yml'),
      path.join(app.getAppPath(), 'app-update.yml'),
      path.join(process.resourcesPath, '..', 'app-update.yml')
    ];
    
    console.log('Looking for app-update.yml in:', possiblePaths);
    
    // For now, set the feed URL manually to avoid file path issues
    autoUpdater.setFeedURL({
      provider: 'github',
      owner: 'moodysaroha',
      repo: 'postboy',
      private: false,
      vPrefixedTagName: true
    });
    
    console.log('Using manual GitHub configuration for updates');

    this.setupEventHandlers();
    
    setTimeout(() => {
      this.checkForUpdates();
    }, 10000); // Check after 10 seconds

    // Check for updates every hour
    setInterval(() => {
      this.checkForUpdates();
    }, 3600000);
  }

  setupEventHandlers() {
    autoUpdater.on('checking-for-update', () => {
      console.log('Checking for updates...');
    });

    autoUpdater.on('update-available', (info) => {
      console.log('Update available!', info);
      // Reset manual check flag and clear timeout when update is found
      this.isManualCheck = false;
      if (this.updateCheckTimeout) {
        clearTimeout(this.updateCheckTimeout);
        this.updateCheckTimeout = null;
      }
      
      // Send to renderer process
      console.log('Sending update notification to renderer...');
      this.sendToRenderer({
        type: 'available',
        data: { version: info.version }
      }).then((result) => {
        console.log('User response received:', result);
        if (result && result.response === 1) { // "Download Now" is button index 1
          console.log('User chose to download update');
          // Notify that download is starting
          this.sendToRenderer({
            type: 'download-started',
            data: { version: info.version }
          });
          
          // Start the download with error handling
          console.log('Starting download...');
          autoUpdater.downloadUpdate()
            .then(() => {
              console.log('Download started successfully');
            })
            .catch((error) => {
              console.error('Failed to start download:', error);
              this.sendToRenderer({
                type: 'error',
                data: { message: `Failed to download update: ${error.message}` }
              });
            });
        } else {
          console.log('User chose to skip update');
        }
      });
    });

    autoUpdater.on('update-not-available', () => {
      console.log('App is up to date.');
      // Clear timeout if set
      if (this.updateCheckTimeout) {
        clearTimeout(this.updateCheckTimeout);
        this.updateCheckTimeout = null;
      }
      // Only show dialog if this was a manual check
      if (this.isManualCheck) {
        this.sendToRenderer({
          type: 'not-available',
          data: { version: app.getVersion() }
        });
        this.isManualCheck = false;
      }
    });

    autoUpdater.on('download-progress', (progressObj) => {
      let message = `Download speed: ${Math.round(progressObj.bytesPerSecond / 1024)} KB/s`;
      message += ` - Downloaded ${Math.round(progressObj.percent)}%`;
      message += ` (${Math.round(progressObj.transferred / 1024 / 1024)} MB of ${Math.round(progressObj.total / 1024 / 1024)} MB)`;
      console.log('[DOWNLOAD PROGRESS]', message);
      
      // Send progress to renderer to show download status
      this.sendToRenderer({
        type: 'download-progress',
        data: { 
          percent: Math.round(progressObj.percent),
          bytesPerSecond: progressObj.bytesPerSecond,
          transferred: progressObj.transferred,
          total: progressObj.total
        }
      });
    });

    autoUpdater.on('update-downloaded', (info) => {
      console.log('Update downloaded');
      
      this.sendToRenderer({
        type: 'downloaded',
        data: { version: info.version }
      }).then((result) => {
        if (result && result.response === 1) { // "Restart Now" is button index 1
          autoUpdater.quitAndInstall();
        }
      });
    });

    autoUpdater.on('error', (error) => {
      console.error('Auto-updater error:', error);
      // Clear timeout if set
      if (this.updateCheckTimeout) {
        clearTimeout(this.updateCheckTimeout);
        this.updateCheckTimeout = null;
      }
      
      // Parse the error message for better user feedback
      let userMessage = error.message;
      if (error.message.includes('404') || error.message.includes('Not Found')) {
        userMessage = 'Cannot access the update server.' + error.message;
      } else if (error.message.includes('ENOTFOUND') || error.message.includes('ETIMEDOUT')) {
        userMessage = 'Cannot reach the update server. Please check your internet connection and try again.';
      }
      
      // Only show error dialog if this was a manual check
      if (this.isManualCheck) {
        this.sendToRenderer({
          type: 'error',
          data: { message: userMessage }
        });
        this.isManualCheck = false;
      }
    });
  }

  checkForUpdates() {
    try {
      autoUpdater.checkForUpdates();
    } catch (error) {
      console.error('Error checking for updates:', error);
    }
  }

  checkForUpdatesManual() {
    // Set flag to indicate this is a manual check
    this.isManualCheck = true;
    
    // Set a timeout to ensure user gets feedback
    const timeoutId = setTimeout(() => {
      if (this.isManualCheck) {
        this.isManualCheck = false;
        this.sendToRenderer({
          type: 'timeout',
          data: {}
        });
      }
    }, 120000); // 120 second timeout for slow networks
    
    // Store timeout ID to clear it if we get a response
    this.updateCheckTimeout = timeoutId;
    
    // Show checking notification
    try {
      console.log('[Updater] Manual check started. Current version:', app.getVersion());
    } catch (_) {}
    this.sendToRenderer({
      type: 'checking',
      data: {}
    });
    
    autoUpdater.checkForUpdates();
  }
}

module.exports = AppUpdater;
