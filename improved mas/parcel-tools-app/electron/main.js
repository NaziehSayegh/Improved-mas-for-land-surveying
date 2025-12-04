import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn, exec } from 'child_process';
import http from 'http';
import fs from 'fs';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { autoUpdater } = require('electron-updater');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow;
let pythonProcess;

function getBackendRoot() {
  if (app.isPackaged) {
    // backend files are unpacked to app.asar.unpacked/backend
    return path.join(process.resourcesPath, 'app.asar.unpacked', 'backend');
  }
  return path.join(__dirname, '../backend');
}

function getPythonExecutionConfig() {
  const backendRoot = getBackendRoot();
  const embeddedPath = path.join(backendRoot, 'python-embed', 'python.exe');

  if (fs.existsSync(embeddedPath)) {
    const pythonHome = path.dirname(embeddedPath);
    const sitePackages = path.join(pythonHome, 'Lib', 'site-packages');
    console.log('[Backend] Using embedded Python runtime:', embeddedPath);

    return {
      command: embeddedPath,
      env: {
        ...process.env,
        PYTHONHOME: pythonHome,
        PYTHONPATH: `${sitePackages}`,
        PYTHONUNBUFFERED: '1'
      }
    };
  }

  const fallback = process.platform === 'win32' ? 'python' : 'python3';
  console.log('[Backend] Embedded Python not found. Falling back to system interpreter:', fallback);
  return {
    command: fallback,
    env: { ...process.env, PYTHONUNBUFFERED: '1' }
  };
}

// Start Python backend
function startPythonBackend() {
  const backendRoot = getBackendRoot();
  const pythonScript = path.join(backendRoot, 'app.py');
  const { command, env } = getPythonExecutionConfig();

  // Set environment variable to tell backend it's running in packaged mode
  if (app.isPackaged) {
    env.PORTABLE_EXECUTABLE_DIR = '1';
  }

  pythonProcess = spawn(command, [pythonScript], {
    cwd: backendRoot,
    env,
    windowsHide: true
  });

  pythonProcess.stdout.on('data', (data) => {
    console.log(`[Python] ${data}`.trim());
  });

  pythonProcess.stderr.on('data', (data) => {
    console.error(`[Python Error] ${data}`.trim());
  });

  pythonProcess.on('error', (error) => {
    console.error('[Backend] Failed to start Python process:', error);
    dialog.showErrorBox(
      'Parcel Tools Backend Error',
      'Could not start the built-in Parcel Tools engine.\n\n' +
      'Please make sure Windows Defender or antivirus is not blocking the app and try again.'
    );
  });

  pythonProcess.on('exit', (code, signal) => {
    console.warn(`[Backend] Python process exited (code: ${code}, signal: ${signal})`);
  });
}

async function checkLicenseStatus(retries = 5, delay = 2000) {
  return new Promise((resolve) => {
    let attempts = 0;
    
    const tryCheck = () => {
      attempts++;
      console.log(`[License] Checking license status (attempt ${attempts}/${retries})...`);
      
      try {
        const request = http.get('http://127.0.0.1:5000/api/license/status', (res) => {
          let data = '';
          res.on('data', (chunk) => { data += chunk; });
          res.on('end', () => {
            try {
              const licenseInfo = JSON.parse(data);
              console.log('[License] Status received:', licenseInfo);
              resolve(licenseInfo);
            } catch (err) {
              console.error('[License] Failed to parse response:', err);
              // Backend not ready, retry
              if (attempts < retries) {
                console.log(`[License] Retrying in ${delay/1000}s...`);
                setTimeout(tryCheck, delay);
              } else {
                console.log('[License] Max retries reached, assuming valid');
                resolve({ is_valid: true, status: 'backend_timeout' });
              }
            }
          });
        });
        
        request.on('error', (err) => {
          console.error('[License] Connection error:', err.message);
          // Backend not ready, retry
          if (attempts < retries) {
            console.log(`[License] Retrying in ${delay/1000}s...`);
            setTimeout(tryCheck, delay);
          } else {
            console.log('[License] Max retries reached, assuming valid');
            resolve({ is_valid: true, status: 'backend_unreachable' });
          }
        });
        
        request.setTimeout(3000, () => {
          console.error('[License] Request timeout');
          request.destroy();
          // Timeout, retry
          if (attempts < retries) {
            console.log(`[License] Retrying in ${delay/1000}s...`);
            setTimeout(tryCheck, delay);
          } else {
            console.log('[License] Max retries reached, assuming valid');
            resolve({ is_valid: true, status: 'timeout' });
          }
        });
      } catch (err) {
        console.error('[License] Unexpected error:', err);
        // Unexpected error, retry
        if (attempts < retries) {
          console.log(`[License] Retrying in ${delay/1000}s...`);
          setTimeout(tryCheck, delay);
        } else {
          console.log('[License] Max retries reached, assuming valid');
          resolve({ is_valid: true, status: 'error' });
        }
      }
    };
    
    // Start first attempt after a delay
    setTimeout(tryCheck, delay);
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
    title: 'Parcel Tools - by Nazieh Sayegh',
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
    icon: path.join(__dirname, '../build/app-icon.png')
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
  mainWindow.once('ready-to-show', async () => {
    mainWindow.show();
    mainWindow.focus();
    
    // Check license status (with retries to wait for backend)
    checkLicenseStatus(5, 2000).then(async (licenseInfo) => {
      console.log('[License] Final status:', licenseInfo);
      
      // Only show dialog if we're SURE there's no license (not on timeout/error)
      if (licenseInfo && !licenseInfo.is_valid && licenseInfo.status === 'no_license') {
        console.log('[License] No valid license found, showing activation dialog');
        const options = {
          type: 'info',
          title: 'Parcel Tools License',
          message: 'License Required',
          detail: 'Parcel Tools requires a valid license to use.\n\nClick "Buy License" to purchase for $29.99\n\nAlready have a license? Click "Activate" to enter your key.',
          buttons: ['Buy License ($29.99)', 'Activate License', 'Later'],
          defaultId: 0
        };
        
        const response = await dialog.showMessageBox(mainWindow, options);
        
        if (response.response === 0 || response.response === 1) {
          // User wants to buy or activate - navigate to license page
          mainWindow.webContents.executeJavaScript(`
            if (window.location.hash !== '#/license') {
              window.location.hash = '#/license';
            }
          `).catch(err => console.error('Failed to navigate to license page:', err));
        }
      } else if (licenseInfo && licenseInfo.is_valid) {
        console.log('[License] ✅ Valid license found!');
      } else {
        console.log('[License] Could not verify license (backend issue), allowing access');
      }
    });
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

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// AUTO-UPDATE CONFIGURATION
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

if (app.isPackaged) {
  // Configure auto-updater (only in production)
  autoUpdater.logger = console;
  autoUpdater.autoDownload = false; // Don't auto-download, ask user first
  autoUpdater.autoInstallOnAppQuit = true;

  // Auto-updater event handlers
  autoUpdater.on('checking-for-update', () => {
    console.log('[Auto-Update] Checking for updates...');
  });

  autoUpdater.on('update-available', (info) => {
    console.log('[Auto-Update] Update available:', info.version);
    
    if (mainWindow) {
      dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'Update Available',
        message: `A new version (${info.version}) is available!`,
        detail: 'Would you like to download and install it now?\n\n' +
                'Current version: ' + app.getVersion() + '\n' +
                'New version: ' + info.version + '\n\n' +
                'The app will restart after the update is installed.',
        buttons: ['Download & Install', 'Later'],
        defaultId: 0,
        cancelId: 1
      }).then(result => {
        if (result.response === 0) {
          autoUpdater.downloadUpdate();
        }
      });
    }
  });

  autoUpdater.on('update-not-available', () => {
    console.log('[Auto-Update] No updates available');
  });

  autoUpdater.on('download-progress', (progressObj) => {
    const percent = Math.round(progressObj.percent);
    console.log(`[Auto-Update] Download progress: ${percent}%`);
  });

  autoUpdater.on('update-downloaded', () => {
    console.log('[Auto-Update] Update downloaded');
    
    if (mainWindow) {
      dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'Update Ready',
        message: 'Update downloaded successfully!',
        detail: 'The update will be installed when you quit the app.\n\n' +
                'Click "Restart Now" to install immediately, or\n' +
                'Click "Later" to install next time you start the app.',
        buttons: ['Restart Now', 'Later'],
        defaultId: 0,
        cancelId: 1
      }).then(result => {
        if (result.response === 0) {
          autoUpdater.quitAndInstall(false, true);
        }
      });
    }
  });

  autoUpdater.on('error', (err) => {
    console.error('[Auto-Update] Error:', err.message);
    // Silently fail - don't bother the user
  });
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

app.whenReady().then(() => {
  // Set file associations for .prcl files
  if (process.platform === 'win32') {
    app.setAsDefaultProtocolClient('prcl');
  }
  
  startPythonBackend();
  createWindow();
  
  // Check for updates (only in production, after 5 seconds)
  if (app.isPackaged) {
    setTimeout(() => {
      console.log('[Auto-Update] Checking for updates...');
      autoUpdater.checkForUpdates().catch(err => {
        console.log('[Auto-Update] Check skipped:', err.message);
      });
    }, 5000);
  }
  
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

// Open file dialog
ipcMain.handle('show-open-dialog', async (event, options) => {
  console.log('[Main] show-open-dialog called with options:', options);
  
  const windowToUse = BrowserWindow.fromWebContents(event.sender) || mainWindow;
  
  if (!windowToUse) {
    console.error('[Main] No window available for dialog');
    return { canceled: true, error: 'No window available' };
  }
  
  try {
    const dialogOptions = {
      title: options.title || 'Open File',
      filters: options.filters || [
        { name: 'Project Files', extensions: ['prcl'] },
        { name: 'All Files', extensions: ['*'] }
      ],
      properties: options.properties || ['openFile']
    };
    
    console.log('[Main] Showing open dialog with options:', dialogOptions);
    
    const result = await dialog.showOpenDialog(windowToUse, dialogOptions);
    
    console.log('[Main] Open dialog result:', result);
    
    if (result.canceled) {
      return { canceled: true };
    }
    
    if (result.filePaths && result.filePaths.length > 0) {
      return {
        canceled: false,
        filePaths: result.filePaths,
        filePath: result.filePaths[0]
      };
    }
    
    return { canceled: true, error: 'No file selected' };
  } catch (error) {
    console.error('[Main] Open dialog error:', error);
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


