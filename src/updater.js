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
        if (data.type === 'checking' || data.type === 'dev-mode' || 
            data.type === 'not-available' || data.type === 'error' || 
            data.type === 'timeout') {
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
      
      case 'dev-mode':
        await dialog.showMessageBox({
          type: 'info',
          title: 'Development Mode',
          message: 'Updates are not available in development mode.',
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
    
    // For production builds, the token should be set during build time
    // For development, it can be set via environment variable
    let githubToken = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
    
    // In packaged app, try to use the build-time token if no env token is available
    // This allows end users to get updates without setting tokens
    if (app.isPackaged && !githubToken) {
      // The token will be embedded during the build process
      // This is set in the release script when building for distribution
      githubToken = process.env.BUILD_TIME_GH_TOKEN || '';
    }
    
    // Set the feed URL for GitHub releases
    autoUpdater.setFeedURL({
      provider: 'github',
      owner: 'moodysaroha',
      repo: 'postboy',
      private: true,
      token: githubToken
    });
    
    // Also set request headers for authentication
    if (githubToken) {
      autoUpdater.requestHeaders = {
        'Authorization': `token ${githubToken}`
      };
      if (!app.isPackaged) {
        // Only log token info in development
        console.log('GitHub token configured for private repository access');
        console.log('Token starts with:', githubToken.substring(0, 10) + '...');
      }
    } else if (!app.isPackaged) {
      // Only warn in development mode
      console.warn('WARNING: No GitHub token found!');
      console.warn('Set GH_TOKEN or GITHUB_TOKEN environment variable for private repository access');
      console.warn('Updates will fail for private repositories without a token');
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
          autoUpdater.downloadUpdate();
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
      console.log(message);
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
        const githubToken = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
        if (!githubToken) {
          userMessage = 'Cannot check for updates: GitHub authentication token is missing.\n\nFor private repositories, please set the GH_TOKEN environment variable with a valid GitHub Personal Access Token.';
        } else {
          userMessage = 'Cannot access the update server. This could be because:\n\n1. The repository is private and the token lacks proper permissions\n2. No releases have been published yet\n3. The repository URL is incorrect\n\nPlease verify your GitHub token has "repo" scope for private repositories.';
        }
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
      this.sendToRenderer({
        type: 'dev-mode',
        data: {}
      });
      return;
    }

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
    }, 30000); // 30 second timeout
    
    // Store timeout ID to clear it if we get a response
    this.updateCheckTimeout = timeoutId;
    
    // Show checking notification
    this.sendToRenderer({
      type: 'checking',
      data: {}
    });
    
    autoUpdater.checkForUpdates();
  }
}

module.exports = AppUpdater;
