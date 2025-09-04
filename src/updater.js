const { app, autoUpdater, dialog } = require('electron');
const path = require('path');

class AppUpdater {
  constructor() {
    // Replace 'yourusername' with your actual GitHub username
    this.feedURL = 'https://github.com/yourusername/postboy/releases/latest/download/';
    this.setupUpdater();
  }

  setupUpdater() {
    if (process.platform !== 'win32') return;
    
    try {
      // Configure the update feed URL
      // The URL should point to a directory containing RELEASES file and .nupkg files
      autoUpdater.setFeedURL({
        url: this.feedURL,
        headers: {
          'User-Agent': `${app.getName()}/${app.getVersion()}`
        }
      });

      this.setupEventHandlers();
      setTimeout(() => {
        this.checkForUpdates();
      }, 10000); // Check after 10 seconds

      // Check for updates every hour
      setInterval(() => {
        this.checkForUpdates();
      }, 3600000);

    } catch (error) {
      console.error('Error setting up auto-updater:', error);
    }
  }

  setupEventHandlers() {
    autoUpdater.on('checking-for-update', () => {
      console.log('Checking for updates...');
    });

    autoUpdater.on('update-available', () => {
      console.log('Update available!');
      dialog.showMessageBox({
        type: 'info',
        title: 'Update Available',
        message: 'A new version of PostBoy is available.',
        detail: 'It will be downloaded in the background.',
        buttons: ['OK']
      });
    });

    autoUpdater.on('update-not-available', () => {
      console.log('App is up to date.');
    });

    autoUpdater.on('download-progress', (progressObj) => {
      let message = `Download speed: ${progressObj.bytesPerSecond}`;
      message += ` - Downloaded ${progressObj.percent}%`;
      message += ` (${progressObj.transferred}/${progressObj.total})`;
      console.log(message);
    });

    autoUpdater.on('update-downloaded', (event, releaseNotes, releaseName) => {
      const dialogOpts = {
        type: 'info',
        buttons: ['Restart Now', 'Later'],
        title: 'Update Ready',
        message: process.platform === 'win32' ? releaseNotes : releaseName,
        detail: 'A new version of PostBoy has been downloaded. Restart the application to apply the update.'
      };

      dialog.showMessageBox(dialogOpts).then((returnValue) => {
        if (returnValue.response === 0) {
          autoUpdater.quitAndInstall();
        }
      });
    });

    autoUpdater.on('error', (error) => {
      console.error('Auto-updater error:', error);
      if (process.env.NODE_ENV === 'production') {
        dialog.showErrorBox('Update Error', 
          'An error occurred while checking for updates. Please try again later.');
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
    autoUpdater.checkForUpdates();
    
    dialog.showMessageBox({
      type: 'info',
      title: 'Checking for Updates',
      message: 'Checking for updates...',
      detail: 'You will be notified when the check is complete.',
      buttons: ['OK']
    });
  }
}

module.exports = AppUpdater;
