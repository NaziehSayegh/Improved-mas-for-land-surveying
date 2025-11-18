import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn, exec } from 'child_process';
import http from 'http';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow;
let pythonProcess;

// Start Python backend
function startPythonBackend() {
  const pythonScript = path.join(__dirname, '../backend/app.py');
  pythonProcess = spawn('python', [pythonScript]);

  pythonProcess.stdout.on('data', (data) => {
    console.log(`Python: ${data}`);
  });

  pythonProcess.stderr.on('data', (data) => {
    console.error(`Python Error: ${data}`);
  });
}

function createWindow() {
  // Resolve preload script path - use absolute path for reliability
  // Use .cjs extension to explicitly use CommonJS (package.json has "type": "module")
  const preloadPath = path.resolve(__dirname, 'preload.cjs');
  console.log('[Main] Preload script path:', preloadPath);
  console.log('[Main] __dirname:', __dirname);
  
  // Verify preload file exists
  if (fs.existsSync(preloadPath)) {
    console.log('[Main] ✅ Preload script file exists');
    const stats = fs.statSync(preloadPath);
    console.log('[Main] Preload file size:', stats.size, 'bytes');
  } else {
    console.error('[Main] ❌ Preload script file NOT FOUND at:', preloadPath);
    console.error('[Main] Current __dirname:', __dirname);
    console.error('[Main] Files in electron directory:', fs.readdirSync(__dirname).join(', '));
  }
  
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    backgroundColor: '#0d1117',
    show: false, // Don't show until ready
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: preloadPath,
      // In dev mode, we need to disable webSecurity for localhost to work
      // These warnings are expected in dev and won't appear in production builds
      webSecurity: !process.env.NODE_ENV || process.env.NODE_ENV === 'development' ? false : true,
      allowRunningInsecureContent: false,
      // Suppress security warnings in dev console (they're expected)
      sandbox: false
    },
    frame: true,
    titleBarStyle: 'default',
    autoHideMenuBar: true,
    icon: path.join(__dirname, '../public/icon.png')
  });

  // Debug: Check if preload loaded
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.executeJavaScript(`
      console.log('[Renderer] Page loaded - checking electronAPI...');
      console.log('[Renderer] window.electronAPI exists:', typeof window !== 'undefined' && !!window.electronAPI);
      console.log('[Renderer] window.electronAPI type:', typeof window.electronAPI);
      if (window.electronAPI) {
        console.log('[Renderer] window.electronAPI.showSaveDialog type:', typeof window.electronAPI.showSaveDialog);
      }
    `).catch(console.error);
  });

  // Show window when ready to prevent blank screen
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
  });

  // Load app
  if (!app.isPackaged) {
    // Development mode - try multiple ports
    const tryPorts = () => {
      const ports = [5173, 5174, 5175, 5176];
      let currentPortIndex = 0;

      const checkAndLoadPort = (port) => {
        return new Promise((resolve) => {
          const req = http.request({
            hostname: 'localhost',
            port: port,
            path: '/',
            method: 'HEAD',
            timeout: 1000
          }, (res) => {
            resolve(true);
          });

          req.on('error', () => resolve(false));
          req.on('timeout', () => {
            req.destroy();
            resolve(false);
          });
          req.end();
        });
      };

      const tryNextPort = async () => {
        if (currentPortIndex >= ports.length) {
          console.error('Could not connect to Vite dev server on any port');
          mainWindow.show();
          mainWindow.webContents.loadHTML(`
            <html>
              <body style="background: #0d1117; color: white; padding: 40px; font-family: monospace;">
                <h1>⚠️ Cannot connect to Vite dev server</h1>
                <p>Please make sure the dev server is running on one of these ports: ${ports.join(', ')}</p>
                <p>Check the terminal for errors.</p>
              </body>
            </html>
          `);
          return;
        }

        const port = ports[currentPortIndex];
        const isAvailable = await checkAndLoadPort(port);

        if (isAvailable) {
          const url = `http://localhost:${port}`;
          console.log(`Trying to load from: ${url}`);
          mainWindow.loadURL(url).then(() => {
            console.log(`✓ Successfully loaded from port ${port}`);
            mainWindow.webContents.openDevTools();
          }).catch((err) => {
            console.log(`✗ Failed to load from port ${port}:`, err);
            currentPortIndex++;
            setTimeout(tryNextPort, 500);
          });
        } else {
          console.log(`✗ Port ${port} not available, trying next...`);
          currentPortIndex++;
          setTimeout(tryNextPort, 500);
        }
      };

      // Start trying ports after a short delay
      setTimeout(tryNextPort, 1000);
    };

    tryPorts();
  } else {
    // Production mode
    // Use app.getAppPath() which works correctly with both ASAR and unpacked apps
    const appPath = app.getAppPath();
    const indexPath = path.join(appPath, 'dist', 'index.html');
    
    console.log('[Production] App path:', appPath);
    console.log('[Production] Loading from:', indexPath);
    console.log('[Production] __dirname:', __dirname);
    console.log('[Production] process.resourcesPath:', process.resourcesPath);
    
    mainWindow.loadFile(indexPath)
      .then(() => {
        console.log('[Production] Successfully loaded app');
      })
      .catch(err => {
        console.error('[Production] Error loading file:', err);
        console.error('[Production] Attempted path:', indexPath);
        
        // Try alternative path
        const altPath = path.join(__dirname, '..', 'dist', 'index.html');
        console.log('[Production] Trying alternative path:', altPath);
        
        mainWindow.loadFile(altPath).catch(err2 => {
          console.error('[Production] Alternative path also failed:', err2);
          
          mainWindow.show();
          mainWindow.webContents.loadHTML(`
            <html>
              <body style="background: #0d1117; color: white; padding: 40px; font-family: monospace;">
                <h1>⚠️ Error loading application</h1>
                <p>Could not load the application interface.</p>
                <p style="margin-top: 20px; font-size: 12px; color: #888;">
                  Tried paths:<br/>
                  1. ${indexPath}<br/>
                  2. ${altPath}<br/>
                  <br/>
                  App path: ${appPath}<br/>
                  __dirname: ${__dirname}<br/>
                </p>
                <p style="margin-top: 20px;">Please reinstall the application.</p>
              </body>
            </html>
          `);
        });
      });
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Store file path to open on startup
let fileToOpen = null;

// Handle file open on Windows/Linux (when app is not running)
if (process.platform === 'win32' && process.argv.length >= 2) {
  // On Windows, the file path is passed as a command line argument
  const filePath = process.argv.find(arg => arg.endsWith('.prcl'));
  if (filePath) {
    fileToOpen = filePath;
    console.log('[Main] File to open on startup:', fileToOpen);
  }
}

// Handle file open on macOS (when app is already running or not)
app.on('open-file', (event, filePath) => {
  event.preventDefault();
  console.log('[Main] open-file event:', filePath);
  
  if (filePath.endsWith('.prcl')) {
    fileToOpen = filePath;
    
    // If window is already created, send the file path to it
    if (mainWindow && mainWindow.webContents) {
      console.log('[Main] Sending file to existing window');
      mainWindow.webContents.send('load-project-file', filePath);
    }
  }
});

app.whenReady().then(() => {
  // Set file associations for .prcl files
  if (process.platform === 'win32') {
    app.setAsDefaultProtocolClient('prcl');
  }
  
  startPythonBackend();
  createWindow();
  
  // If there's a file to open, send it to the window after it's ready
  if (fileToOpen && mainWindow) {
    console.log('[Main] Sending initial file to window:', fileToOpen);
    // Wait a bit for the window to fully load
    setTimeout(() => {
      if (mainWindow && mainWindow.webContents) {
        mainWindow.webContents.send('load-project-file', fileToOpen);
      }
    }, 2000);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (pythonProcess) {
    pythonProcess.kill();
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('quit', () => {
  if (pythonProcess) {
    pythonProcess.kill();
  }
});

// IPC handlers
ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

// Save file dialog
ipcMain.handle('show-save-dialog', async (event, options) => {
  console.log('[Main] show-save-dialog called with options:', options);
  
  // Use the window that sent the message if mainWindow is not available
  const windowToUse = BrowserWindow.fromWebContents(event.sender) || mainWindow;
  
  if (!windowToUse) {
    console.error('[Main] No window available for dialog');
    return { canceled: true, error: 'No window available' };
  }
  
  try {
    const dialogOptions = {
      title: options.title || 'Save As',
      defaultPath: options.defaultPath || 'MyProject.prcl',
      filters: options.filters || [
        { name: 'Project Files', extensions: ['prcl'] },
        { name: 'All Files', extensions: ['*'] }
      ],
      properties: ['createDirectory', 'showOverwriteConfirmation']
    };
    
    console.log('[Main] Showing save dialog with options:', dialogOptions);
    
    const result = await dialog.showSaveDialog(windowToUse, dialogOptions);
    
    console.log('[Main] Dialog result:', result);
    
    if (result.canceled) {
      return { canceled: true };
    }
    
    if (result.filePath) {
      return {
        canceled: false,
        filePath: result.filePath
      };
    }
    
    return { canceled: true, error: 'No file path returned' };
  } catch (error) {
    console.error('[Main] Dialog error:', error);
    return { canceled: true, error: error.message };
  }
});

// Save PDF and open it
ipcMain.handle('save-and-open-pdf', async (event, pdfData, fileName) => {
  try {
    console.log('[Main] save-and-open-pdf called, fileName:', fileName);
    
    if (!pdfData) {
      console.error('[Main] No PDF data provided');
      return { success: false, error: 'No PDF data provided' };
    }
    
    const windowToUse = BrowserWindow.fromWebContents(event.sender) || mainWindow;
    
    if (!windowToUse) {
      console.error('[Main] No window available');
      return { success: false, error: 'No window available' };
    }
    
    // Show save dialog for PDF
    const dialogOptions = {
      title: 'Save PDF As',
      defaultPath: fileName || 'parcels_export.pdf',
      filters: [
        { name: 'PDF Files', extensions: ['pdf'] },
        { name: 'All Files', extensions: ['*'] }
      ],
      properties: ['createDirectory', 'showOverwriteConfirmation']
    };
    
    console.log('[Main] Showing save dialog...');
    const result = await dialog.showSaveDialog(windowToUse, dialogOptions);
    
    if (result.canceled) {
      console.log('[Main] User canceled save dialog');
      return { success: false, canceled: true };
    }
    
    if (!result.filePath) {
      console.error('[Main] No file path selected');
      return { success: false, error: 'No file path selected' };
    }
    
    // Ensure file path has .pdf extension
    let filePath = result.filePath;
    if (!filePath.toLowerCase().endsWith('.pdf')) {
      filePath += '.pdf';
    }
    
    console.log('[Main] Saving PDF to:', filePath);
    
    // Convert base64 to buffer and write file
    const pdfBuffer = Buffer.from(pdfData, 'base64');
    fs.writeFileSync(filePath, pdfBuffer);
    
    console.log('[Main] PDF saved successfully, file size:', pdfBuffer.length, 'bytes');
    
    // Verify file exists before opening
    if (!fs.existsSync(filePath)) {
      console.error('[Main] File was not created:', filePath);
      return { success: false, error: 'File was not created' };
    }
    
    console.log('[Main] Opening PDF with shell.openPath...');
    
    // Open the PDF file
    // shell.openPath returns a promise that resolves with an error string if it fails
    const openError = await shell.openPath(filePath);
    
    if (openError) {
      console.error('[Main] shell.openPath returned error:', openError);
      // Try alternative method on Windows
      if (process.platform === 'win32') {
        try {
          console.log('[Main] Trying Windows exec method...');
          
          // Use Windows start command to open PDF
          exec(`start "" "${filePath}"`, (error, stdout, stderr) => {
            if (error) {
              console.error('[Main] Error with exec start:', error);
            } else {
              console.log('[Main] PDF opened with exec start successfully');
            }
          });
          
          // Give it a moment to execute
          await new Promise(resolve => setTimeout(resolve, 500));
          console.log('[Main] PDF should be opening with exec method');
        } catch (execError) {
          console.error('[Main] Error with exec:', execError);
          return { success: false, error: `Failed to open PDF: ${openError}` };
        }
      } else {
        return { success: false, error: `Failed to open PDF: ${openError}` };
      }
    } else {
      console.log('[Main] PDF opened successfully with shell.openPath');
    }
    
    return { success: true, filePath: filePath };
  } catch (error) {
    console.error('[Main] Error saving/opening PDF:', error);
    console.error('[Main] Error stack:', error.stack);
    return { success: false, error: error.message || 'Unknown error' };
  }
});


