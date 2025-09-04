const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Update notifications
  onUpdateNotification: (callback) => {
    ipcRenderer.on('update-notification', (event, data) => callback(data));
  },
  
  // Remove listener
  removeUpdateListener: () => {
    ipcRenderer.removeAllListeners('update-notification');
  },

  // Generic modal request (for future use)
  showModal: (options) => {
    return ipcRenderer.invoke('show-modal', options);
  }
});