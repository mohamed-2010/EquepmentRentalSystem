const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electron', {
  // App info
  getAppInfo: () => ipcRenderer.invoke('get-app-info'),
  
  // Online status
  getOnlineStatus: () => ipcRenderer.invoke('get-online-status'),
  
  // Window controls
  onWindowMaximized: (callback) => ipcRenderer.on('window-maximized', callback),
  onWindowUnmaximized: (callback) => ipcRenderer.on('window-unmaximized', callback),
  
  // Platform info
  platform: process.platform,
  isElectron: true,
});

console.log('Preload script loaded');
