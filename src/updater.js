const { app, dialog } = require('electron');
const { autoUpdater } = require('electron-updater');

class AppUpdater {
  constructor() {
    this.setupUpdater();
  }

  setupUpdater() {
    // Configure electron-updater for GitHub releases
    autoUpdater.autoDownload = false; // Don't auto-download, let user choose
    autoUpdater.autoInstallOnAppQuit = true;
    
    // For private repositories, electron-updater needs a GitHub token
    // The token can be provided via GH_TOKEN environment variable
    if (process.env.GH_TOKEN) {
      autoUpdater.requestHeaders = {
        'Authorization': `token ${process.env.GH_TOKEN}`
      };
      console.log('GitHub token configured for private repository access');
    } else {
      console.log('No GitHub token found - updates may fail for private repositories');
    }

    this.setupEventHandlers();
    
    // Check for updates after app is ready
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
      dialog.showMessageBox({
        type: 'info',
        title: 'Update Available',
        message: `A new version (${info.version}) of PostBoy is available.`,
        detail: 'Would you like to download it now?',
        buttons: ['Download Now', 'Later'],
        defaultId: 0
      }).then((result) => {
        if (result.response === 0) {
          autoUpdater.downloadUpdate();
        }
      });
    });

    autoUpdater.on('update-not-available', () => {
      console.log('App is up to date.');
    });

    autoUpdater.on('download-progress', (progressObj) => {
      let message = `Download speed: ${Math.round(progressObj.bytesPerSecond / 1024)} KB/s`;
      message += ` - Downloaded ${Math.round(progressObj.percent)}%`;
      message += ` (${Math.round(progressObj.transferred / 1024 / 1024)} MB of ${Math.round(progressObj.total / 1024 / 1024)} MB)`;
      console.log(message);
    });

    autoUpdater.on('update-downloaded', (info) => {
      console.log('Update downloaded');
      const dialogOpts = {
        type: 'info',
        buttons: ['Restart Now', 'Later'],
        title: 'Update Ready',
        message: `Version ${info.version} has been downloaded.`,
        detail: 'The update will be applied when you restart the application. Would you like to restart now?'
      };

      dialog.showMessageBox(dialogOpts).then((returnValue) => {
        if (returnValue.response === 0) {
          autoUpdater.quitAndInstall();
        }
      });
    });

    autoUpdater.on('error', (error) => {
      console.error('Auto-updater error:', error);
      dialog.showErrorBox('Update Error', 
        `An error occurred while checking for updates: ${error.message}`);
    });
  }

  checkForUpdates() {
    try {
      if (app.isPackaged) {
        autoUpdater.checkForUpdates();
      } else {
        console.log('Skipping update check in development mode');
      }
    } catch (error) {
      console.error('Error checking for updates:', error);
    }
  }

  checkForUpdatesManual() {
    if (!app.isPackaged) {
      dialog.showMessageBox({
        type: 'info',
        title: 'Development Mode',
        message: 'Updates are not available in development mode.',
        buttons: ['OK']
      });
      return;
    }

    dialog.showMessageBox({
      type: 'info',
      title: 'Checking for Updates',
      message: 'Checking for updates...',
      detail: 'You will be notified when the check is complete.',
      buttons: ['OK']
    });
    
    autoUpdater.checkForUpdates();
  }
}

module.exports = AppUpdater;
