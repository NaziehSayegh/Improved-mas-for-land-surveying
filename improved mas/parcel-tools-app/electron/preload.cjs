// Preload script for Electron
const { contextBridge, ipcRenderer } = require('electron');

console.log('[Preload] Starting...');

// Create API object
const electronAPI = {
  showSaveDialog: (options) => {
    console.log('[Preload] showSaveDialog called with options:', options);
    return ipcRenderer.invoke('show-save-dialog', options);
  },
  saveAndOpenPDF: (pdfData, fileName) => {
    console.log('[Preload] saveAndOpenPDF called');
    return ipcRenderer.invoke('save-and-open-pdf', pdfData, fileName);
  },
  getAppVersion: () => {
    return ipcRenderer.invoke('get-app-version');
  },
  // Listen for project file to load (when double-clicked)
  onLoadProjectFile: (callback) => {
    console.log('[Preload] Setting up onLoadProjectFile listener');
    ipcRenderer.on('load-project-file', (event, filePath) => {
      console.log('[Preload] Received load-project-file event:', filePath);
      callback(filePath);
    });
  },
  // Remove listener when component unmounts
  removeLoadProjectFileListener: () => {
    ipcRenderer.removeAllListeners('load-project-file');
  }
};

// Expose to renderer
contextBridge.exposeInMainWorld('electronAPI', electronAPI);

console.log('[Preload] ✅ electronAPI exposed successfully');
console.log('[Preload] Available methods:', Object.keys(electronAPI));
