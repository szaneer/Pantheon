const { app, BrowserWindow, Tray, Menu, ipcMain, shell, dialog, nativeImage, protocol, powerSaveBlocker, powerMonitor } = require('electron');
const path = require('path');
const { readFile } = require('fs').promises;
const { URL } = require('url');
const loggingService = require('../src/services/loggingService');
const autoUpdaterService = require('./services/autoUpdater');

// Initialize logging service
loggingService.initialize();

// Only load dotenv in development
const isDev = process.env.NODE_ENV === 'development';
console.log('Environment:', { isDev, NODE_ENV: process.env.NODE_ENV });

if (isDev) {
  try {
    require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
    console.log('✅ Environment variables loaded from .env');
  } catch (error) {
    console.log('⚠️ Could not load .env file:', error.message);
  }
} else {
  console.log('📦 Running in production mode');
}
let Store;
try {
  Store = require('electron-store');
  console.log('✅ electron-store loaded successfully');
} catch (error) {
  console.warn('⚠️ electron-store not available, using memory store:', error.message);
  Store = class MemoryStore {
    constructor() {
      this.data = {};
    }
    get(key) {
      return this.data[key];
    }
    set(key, value) {
      this.data[key] = value;
    }
  };
}

const { v4: uuidv4 } = require('uuid');
const os = require('os');
const { HTTPServer } = require('../src/services/httpServer.js');
const p2pService = require('../src/services/p2pServiceV2.js');
const appleFoundationModels = require('../src/services/appleFoundationModels.js');
const macOSMLModels = require('../src/services/macOSMLModels.js');
const ollamaManager = require('./services/ollamaManager.js');
const httpServerHandler = require('./services/httpServerHandler.js');
const appleModelsBridge = require('./services/appleModelsBridgeSafe.js');
const { logCompatibilityReport } = require('../src/services/checkX86Compatibility.js');

// Device service not needed in P2P-only mode

const store = new Store();

// Auto-updater configuration
function setupAutoUpdater() {
  // Skip auto-updater if running in development or if no publish config
  if (isDev) {
    console.log('🔄 Skipping auto-updater in development mode');
    return;
  }
  
  console.log('🔄 Setting up auto-updater...');
  
  // Configure auto-updater
  autoUpdater.autoDownload = false; // Don't auto-download, ask user first
  autoUpdater.autoInstallOnAppQuit = true;
  
  // Auto-updater events
  autoUpdater.on('checking-for-update', () => {
    console.log('🔍 Checking for updates...');
  });
  
  autoUpdater.on('update-available', (info) => {
    console.log('✅ Update available:', info.version);
    
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Update Available',
      message: `A new version ${info.version} is available. Would you like to download it now?`,
      detail: 'The update will be installed automatically when you restart the app.',
      buttons: ['Download', 'Later'],
      defaultId: 0
    }).then((result) => {
      if (result.response === 0) {
        autoUpdater.downloadUpdate();
      }
    });
  });
  
  autoUpdater.on('update-not-available', () => {
    console.log('ℹ️ No updates available');
  });
  
  autoUpdater.on('error', (error) => {
    console.error('❌ Auto-updater error:', error);
  });
  
  autoUpdater.on('download-progress', (progressObj) => {
    let log_message = "Download speed: " + progressObj.bytesPerSecond;
    log_message = log_message + ' - Downloaded ' + progressObj.percent + '%';
    log_message = log_message + ' (' + progressObj.transferred + "/" + progressObj.total + ')';
    console.log(log_message);
    
    // Send progress to renderer
    if (mainWindow) {
      mainWindow.webContents.send('download-progress', progressObj);
    }
  });
  
  autoUpdater.on('update-downloaded', (info) => {
    console.log('✅ Update downloaded:', info.version);
    
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Update Ready',
      message: 'Update downloaded. The application will restart to apply the update.',
      buttons: ['Restart Now', 'Later'],
      defaultId: 0
    }).then((result) => {
      if (result.response === 0) {
        autoUpdater.quitAndInstall();
      }
    });
  });
  
  // Check for updates with error handling
  setTimeout(() => {
    try {
      autoUpdater.checkForUpdates().catch(err => {
        console.log('Auto-updater check failed:', err.message);
      });
    } catch (error) {
      console.log('Auto-updater not configured:', error.message);
    }
  }, 5000); // Delay initial check
}

let mainWindow;
let httpServer;
let tray;
let powerSaveId = null; // Track power save blocker ID

// Generate unique device ID if not exists
if (!store.get('deviceId')) {
  store.set('deviceId', uuidv4());
}

function createWindow() {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
      allowRunningInsecureContent: false
    },
    icon: path.join(__dirname, '../assets/icon.png'),
    show: false
  });

  // Load the app from built files
  
  // Add custom protocol handler for the app
  protocol.registerFileProtocol('file', (request, callback) => {
    const pathname = decodeURI(request.url.replace('file:///', ''));
    callback(pathname);
  });
  
  // Create application menu with reload support and standard shortcuts
  const isMac = process.platform === 'darwin';
  
  const menuTemplate = [
    // macOS app menu
    ...(isMac ? [{
      label: app.getName(),
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        {
          label: 'Check for Updates...',
          click: () => {
            if (!isDev) {
              autoUpdater.checkForUpdates();
            } else {
              dialog.showMessageBox(mainWindow, {
                type: 'info',
                title: 'Development Mode',
                message: 'Auto-updates are disabled in development mode.',
                buttons: ['OK']
              });
            }
          }
        },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideothers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    }] : []),
    
    // File menu
    {
      label: 'File',
      submenu: [
        {
          label: 'New Chat',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            mainWindow.webContents.executeJavaScript(`
              // Clear chat messages if there's a way to do it
              console.log('New chat requested');
            `);
          }
        },
        { type: 'separator' },
        ...(isMac ? [] : [{ role: 'quit' }])
      ]
    },
    
    // Edit menu with copy/paste
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectall' },
        { type: 'separator' },
        {
          label: 'Find',
          accelerator: 'CmdOrCtrl+F',
          click: () => {
            mainWindow.webContents.executeJavaScript(`
              // Focus search or show find dialog
              console.log('Find requested');
            `);
          }
        }
      ]
    },
    
    // View menu
    {
      label: 'View',
      submenu: [
        {
          label: 'Reload',
          accelerator: 'CmdOrCtrl+R',
          click: () => {
            console.log('🔄 Manual reload triggered');
            if (isDev) {
              // In development, reload the dev server URL explicitly
              mainWindow.loadURL('http://127.0.0.1:3000').catch((error) => {
                console.log('❌ Failed to reload dev server:', error.message);
                loadDevServer();
              });
            } else {
              // In production, reload the correct index file
              const indexPath = path.join(__dirname, '..', 'index-electron.html');
              mainWindow.loadFile(indexPath).catch((error) => {
                console.error('❌ Failed to reload:', error);
                mainWindow.webContents.reload();
              });
            }
          }
        },
        {
          label: 'Force Reload',
          accelerator: 'CmdOrCtrl+Shift+R',
          click: () => {
            console.log('🔄 Force reload triggered');
            if (isDev) {
              // In development, force reload the dev server URL
              mainWindow.webContents.session.clearCache().then(() => {
                mainWindow.loadURL('http://127.0.0.1:3000').catch((error) => {
                  console.log('❌ Failed to force reload dev server:', error.message);
                  loadDevServer();
                });
              });
            } else {
              // In production, clear cache and reload the correct index file
              mainWindow.webContents.session.clearCache().then(() => {
                const indexPath = path.join(__dirname, '..', 'index-electron.html');
                mainWindow.loadFile(indexPath).catch((error) => {
                  console.error('❌ Failed to force reload:', error);
                  mainWindow.webContents.reload();
                });
              });
            }
          }
        },
        { type: 'separator' },
        { role: 'resetzoom' },
        { role: 'zoomin' },
        { role: 'zoomout' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        { type: 'separator' },
        {
          label: 'Toggle DevTools',
          accelerator: 'F12',
          click: () => {
            mainWindow.webContents.toggleDevTools();
          }
        }
      ]
    },
    
    // Window menu
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'close' },
        ...(isMac ? [
          { type: 'separator' },
          { role: 'front' },
          { type: 'separator' },
          { role: 'window' }
        ] : [])
      ]
    },
    
    // Help menu
    {
      label: 'Help',
      submenu: [
        {
          label: 'Check for Updates...',
          click: () => {
            autoUpdaterService.checkForUpdatesManually();
          }
        },
        { type: 'separator' },
        {
          label: 'About Pantheon',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'About Pantheon',
              message: 'Pantheon',
              detail: `Version: ${app.getVersion()}\nElectron: ${process.versions.electron}\nNode: ${process.versions.node}`,
              buttons: ['OK']
            });
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(menuTemplate);
  Menu.setApplicationMenu(menu);

  async function loadDevServer() {
    const maxRetries = 10;
    let retries = 0;
    
    while (retries < maxRetries) {
      try {
        console.log(`🔌 Attempting to connect to dev server (attempt ${retries + 1}/${maxRetries})`);
        await mainWindow.loadURL('http://127.0.0.1:3000');
        console.log('✅ Successfully connected to dev server');
        return;
      } catch (error) {
        console.log(`❌ Failed to connect to dev server: ${error.message}`);
        retries++;
        
        if (retries < maxRetries) {
          console.log('⏱️ Waiting 1 second before retry...');
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }
    
    console.log('❌ Failed to connect to dev server after all retries');
    console.log('📋 Make sure the dev server is running: npm run dev');
    
    // Load a fallback error page
    const errorHtml = `
      <html>
        <head><title>Dev Server Connection Error</title></head>
        <body style="font-family: Arial, sans-serif; padding: 40px; text-align: center; background: #1a1a1a; color: white;">
          <h1>Development Server Not Available</h1>
          <p>Could not connect to the development server at http://127.0.0.1:3000</p>
          <p>Please make sure the development server is running:</p>
          <code style="background: #333; padding: 10px; display: block; margin: 20px;">npm run dev</code>
          <p>Then reload this window (Ctrl+R / Cmd+R)</p>
        </body>
      </html>
    `;
    mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(errorHtml)}`);
  }

  if (isDev) {
    console.log('🔧 Development mode - loading from dev server');
    loadDevServer();
  } else {
    console.log('🏭 Production mode - loading from built files');
    // In production, load from the app root (where postbuild copies files)
    const indexPath = path.join(__dirname, '..', 'index-electron.html');
    console.log('📁 Loading index-electron.html from:', indexPath);
    
    mainWindow.loadFile(indexPath).catch((error) => {
      console.error('❌ Failed to load from fallback path:', error);
      
      // Show detailed error in window
      const errorHtml = `
        <html>
          <head>
            <style>
              body { font-family: system-ui; padding: 40px; background: #1a1a1a; color: white; }
              pre { background: #333; padding: 10px; overflow: auto; border-radius: 4px; }
              code { background: #444; padding: 2px 4px; border-radius: 2px; }
            </style>
          </head>
          <body>
            <h1>Failed to load application</h1>
            <p><strong>Error:</strong> ${error.message}</p>
            <h2>Debug Information:</h2>
            <pre>
App Path: ${app.getAppPath()}
__dirname: ${__dirname}
Index Path: ${indexPath}
Platform: ${process.platform}
Node Version: ${process.version}
            </pre>
            <p>The app bundle may be corrupted. Try rebuilding with:</p>
            <code>npm run build && npm run dist</code>
          </body>
        </html>
      `;
      mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(errorHtml)}`);
    });
  }

  // Intercept file requests to debug
  mainWindow.webContents.session.webRequest.onBeforeRequest((details, callback) => {
    if (details.url.includes('main.tsx')) {
      console.log('🔍 Request for main.tsx:', details.url);
      console.log('🔍 Referrer:', details.referrer);
    }
    callback({});
  });

  // Log console messages from the renderer
  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    console.log(`[Renderer] ${message}`);
    if (sourceId) {
      console.log(`  Source: ${sourceId}:${line}`);
    }
  });

  // Log any crashed events
  mainWindow.webContents.on('render-process-gone', (event, details) => {
    console.error('❌ Renderer process crashed:', details);
  });

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    
    // Auto-open DevTools only in development
    if (isDev) {
      mainWindow.webContents.openDevTools();
    }
  });

  // Handle window closed
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Handle external links
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Add context menu support for copy/paste
  mainWindow.webContents.on('context-menu', (event, params) => {
    const { selectionText, isEditable } = params;
    
    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Cut',
        role: 'cut',
        enabled: isEditable && selectionText.length > 0
      },
      {
        label: 'Copy',
        role: 'copy',
        enabled: selectionText.length > 0
      },
      {
        label: 'Paste',
        role: 'paste',
        enabled: isEditable
      },
      { type: 'separator' },
      {
        label: 'Select All',
        role: 'selectall'
      }
    ]);
    
    contextMenu.popup({ window: mainWindow });
  });

  // Prevent navigation to external sites
  mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
    const parsedUrl = new URL(navigationUrl);
    
    // Allow navigation to dev server and local files
    if (parsedUrl.origin !== 'http://127.0.0.1:3000' && 
        parsedUrl.protocol !== 'file:' && 
        parsedUrl.protocol !== 'data:') {
      event.preventDefault();
      shell.openExternal(navigationUrl);
    }
  });
}

function createTray() {
  // Create tray icon
  const iconPath = path.join(__dirname, '../assets/tray-icon.png');
  const fallbackIconPath = path.join(__dirname, '../assets/icon.png');
  
  let trayIcon;
  try {
    trayIcon = nativeImage.createFromPath(iconPath);
    if (trayIcon.isEmpty()) {
      trayIcon = nativeImage.createFromPath(fallbackIconPath);
    }
  } catch (error) {
    console.log('⚠️ Could not load tray icon, using fallback');
    trayIcon = nativeImage.createFromPath(fallbackIconPath);
  }
  
  // Resize icon for tray
  if (!trayIcon.isEmpty()) {
    trayIcon = trayIcon.resize({ width: 16, height: 16 });
  }

  tray = new Tray(trayIcon);
  tray.setToolTip('Pantheon');

  // Create context menu
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show App',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      }
    },
    {
      label: 'Hide App',
      click: () => {
        if (mainWindow) {
          mainWindow.hide();
        }
      }
    },
    {
      label: 'Chat',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
          mainWindow.webContents.executeJavaScript(`
            window.location.href = '/';
          `);
        }
      }
    },
    {
      label: 'Settings',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
          mainWindow.webContents.executeJavaScript(`
            window.location.href = '/settings';
          `);
        }
      }
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.quit();
      }
    }
  ]);

  tray.setContextMenu(contextMenu);

  // Handle tray click
  tray.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    }
  });
}

// Set memory limits to prevent OOM crashes
app.commandLine.appendSwitch('js-flags', '--max-old-space-size=2048');
app.commandLine.appendSwitch('disable-gpu-sandbox');

// App event handlers
app.whenReady().then(async () => {
  console.log('🚀 Pantheon app ready');
  
  // Run x86 compatibility check
  if (process.arch === 'x64' || process.arch === 'ia32') {
    logCompatibilityReport();
  }
  
  // Set development mode flag
  if (process.env.NODE_ENV === 'development') {
    console.log('🔧 Running in development mode');
  } else {
    console.log('🏭 Running in production mode');
    
    // Register protocol for serving local files in production
    protocol.registerFileProtocol('app', (request, callback) => {
      const url = request.url.substr(6); // Remove 'app://'
      const normalizedPath = path.normalize(path.join(__dirname, '..', url));
      callback({ path: normalizedPath });
    });
    
    // Intercept file protocol to ensure proper MIME types
    protocol.interceptFileProtocol('file', (request, callback) => {
      const url = request.url.substr(7); // Remove 'file://'
      const decodedUrl = decodeURIComponent(url);
      callback({ path: decodedUrl });
    });
  }
  
  createWindow();
  createTray();
  
  // Setup auto-updater
  if (!isDev && process.platform !== 'linux') {
    // Check for updates after a short delay
    setTimeout(() => {
      console.log('🔄 Checking for updates...');
      autoUpdaterService.checkForUpdates();
    }, 3000);
    
    // Check for updates every 4 hours
    setInterval(() => {
      autoUpdaterService.checkForUpdates();
    }, 4 * 60 * 60 * 1000);
  }
  
  // Start HTTP server for incoming requests (P2P mode)
  try {
    console.log('🚀 Starting local HTTP server for P2P hosting...');
    httpServer = new HTTPServer();
    await httpServer.start();
    console.log(`✅ HTTP server started on port ${httpServer.getPort()}`);
    
    // Test that HTTP server is responding with models
    const axios = require('axios');
    try {
      const testResponse = await axios.get(`http://127.0.0.1:${httpServer.getPort()}/v1/models`);
      console.log(`✅ HTTP server /v1/models test successful, found ${testResponse.data?.data?.length || 0} models`);
      if (testResponse.data?.data) {
        testResponse.data.data.forEach(model => {
          console.log(`  - ${model.id} (${model.provider || model.owned_by})`);
        });
      }
    } catch (testError) {
      console.error('❌ HTTP server /v1/models test failed:', testError.message);
    }
  } catch (error) {
    console.error('❌ Failed to start HTTP server:', error);
  }
  
  // P2P service will be initialized when user credentials are received via IPC
  console.log('🌐 P2P coordination service ready, waiting for user authentication...');
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Handle app quit
app.on('quit', async () => {
  console.log('🛑 App shutting down...');
  
  // Stop preventing system sleep
  if (powerSaveId !== null) {
    powerSaveBlocker.stop(powerSaveId);
    console.log('🔋 Power save blocker stopped on quit, ID:', powerSaveId);
    powerSaveId = null;
  }
  
  // Cleanup Ollama if running
  try {
    await ollamaManager.cleanup();
    console.log('✅ Ollama manager cleaned up');
  } catch (error) {
    console.error('Failed to cleanup Ollama:', error);
  }
  
  // WebSocket client cleanup is handled by router service
  
  // Stop HTTP server
  try {
    if (httpServer) {
      await httpServer.stop();
    }
  } catch (error) {
    console.error('❌ Error stopping HTTP server:', error);
  }
  
  // Shutdown P2P service
  try {
    await p2pService.shutdown();
  } catch (error) {
    console.error('❌ Error shutting down P2P service:', error);
  }
  
  if (tray) {
    tray.destroy();
  }
});

// IPC handlers
ipcMain.handle('get-device-id', () => {
  return store.get('deviceId');
});

ipcMain.handle('get-store-value', (event, key) => {
  return store.get(key);
});

ipcMain.handle('set-store-value', (event, key, value) => {
  store.set(key, value);
  return true;
});

ipcMain.handle('get-platform', () => {
  return process.platform;
});

// Store handlers
ipcMain.handle('store-get', (event, key) => {
  return store.get(key);
});

ipcMain.handle('store-set', (event, key, value) => {
  store.set(key, value);
  return true;
});

ipcMain.handle('store-get-device-id', () => {
  let deviceId = store.get('deviceId');
  if (!deviceId) {
    deviceId = uuidv4();
    store.set('deviceId', deviceId);
  }
  return deviceId;
});

// Crypto utilities for bridge API keys
ipcMain.handle('crypto-generate-secure-id', (event, length = 32) => {
  const crypto = require('crypto');
  return crypto.randomBytes(length).toString('hex');
});

// Handle app visibility
ipcMain.handle('is-window-visible', () => {
  return mainWindow.isVisible();
});

ipcMain.handle('show-window', () => {
  mainWindow.show();
  mainWindow.focus();
  return true;
});

ipcMain.handle('hide-window', () => {
  mainWindow.hide();
  return true;
});

// P2P service IPC handlers
ipcMain.handle('p2p-get-status', () => {
  return p2pService.getStatus();
});

// Set up P2P request listener to handle chat and get_models requests
p2pService.on('request', async (requestData) => {
  const { type, data, fromUserId, requestId } = requestData;
  console.log(`🔍 P2P request received: ${type} from ${fromUserId}`);
  
  try {
    if (type === 'get_models') {
      // Handle get_models request
      console.log('📋 Processing get_models request...');
      const models = await httpServerHandler.getModels();
      console.log('📋 Get models result:', { modelCount: models?.length, models: models?.slice(0, 3) });
      
      const response = {
        models: models.map(model => ({
          name: model.name || model.id,
          id: model.id,
          provider: model.provider || 'Unknown'
        })),
        batteryState: null // TODO: Add battery state if needed
      };
      console.log('✅ Returning models response:', response);
      return response;
    } else if (type === 'chat') {
      // Handle chat request
      console.log('💬 Processing chat request...');
      console.log('💬 Chat data:', JSON.stringify(data, null, 2));
      
      const response = await httpServerHandler.createChatCompletion(data);
      console.log('💬 Chat response:', { hasId: !!response.id, hasChoices: !!response.choices, choiceCount: response.choices?.length });
      
      console.log('✅ Returning chat response');
      return response;
    } else {
      const error = `Unknown request type: ${type}`;
      console.error('❌ Unknown request type:', error);
      throw new Error(error);
    }
  } catch (error) {
    const errorMessage = error?.message || error?.toString() || 'Unknown error occurred';
    console.error(`❌ Failed to handle P2P ${type} request:`, errorMessage);
    console.error('❌ Error details:', error);
    
    // Re-throw with a clear message
    throw new Error(`P2P ${type} request failed: ${errorMessage}`);
  }
});

ipcMain.handle('p2p-connect', async () => {
  // Connection is handled by initialize now
  return true;
});

ipcMain.handle('p2p-disconnect', async () => {
  await p2pService.disableHosting();
  return true;
});

ipcMain.handle('p2p-set-user-id', async (event, userId, authToken) => {
  console.log('🔧 IPC: p2p-set-user-id called');
  console.log('👤 Received userId:', userId);
  console.log('🔑 Received authToken:', authToken ? '***present***' : 'missing');
  console.log('🔑 AuthToken length:', authToken ? authToken.length : 0);
  
  if (userId) {
    try {
      await p2pService.initialize(userId, authToken);
    } catch (error) {
      console.error('Failed to initialize P2P service:', error);
    }
  } else {
    // User signed out
    await p2pService.disableHosting();
  }
  return true;
});

ipcMain.handle('p2p-set-auth-token', async (event, token) => {
  // This is handled by the initialize method now
  return true;
});

ipcMain.handle('p2p-add-status-listener', (event) => {
  const listener = (status) => {
    if (!event.sender.isDestroyed()) {
      event.sender.send('p2p-status-changed', status);
    }
  };
  
  p2pService.on('status', listener);
  
  // Cleanup when webContents is destroyed
  event.sender.once('destroyed', () => {
    p2pService.off('status', listener);
  });
  
  return true;
});

ipcMain.handle('p2p-enable-hosting', async () => {
  try {
    console.log('🟢 IPC: Enabling P2P hosting...');
    
    // Check if P2P service is initialized
    const status = p2pService.getStatus();
    console.log('📊 P2P Status before enabling:', status);
    
    if (!status.currentUserId) {
      console.error('❌ P2P service not initialized - no user ID');
      throw new Error('P2P service not initialized. Please sign in first.');
    }
    
    // Get available models first (including Apple Foundation models)
    const httpServerHandler = require('./services/httpServerHandler.js');
    const models = await httpServerHandler.getModels();
    console.log('📦 Available models for hosting:', models.map(m => m.id));
    await p2pService.setHostingEnabled(true, models);
    
    // Prevent system sleep while hosting
    if (powerSaveId === null) {
      powerSaveId = powerSaveBlocker.start('prevent-app-suspension');
      console.log('🔋 Power save blocker started, ID:', powerSaveId);
    }
    
    console.log('✅ IPC: P2P hosting enabled successfully');
    return true;
  } catch (error) {
    console.error('❌ IPC: Failed to enable hosting:', error);
    throw error;
  }
});

ipcMain.handle('p2p-disable-hosting', async () => {
  try {
    console.log('🔴 IPC: Disabling P2P hosting...');
    
    // Check if P2P service is initialized
    const status = p2pService.getStatus();
    console.log('📊 P2P Status before disabling:', status);
    
    await p2pService.setHostingEnabled(false);
    
    // Stop preventing system sleep
    if (powerSaveId !== null) {
      powerSaveBlocker.stop(powerSaveId);
      console.log('🔋 Power save blocker stopped, ID:', powerSaveId);
      powerSaveId = null;
    }
    
    console.log('✅ IPC: P2P hosting disabled successfully');
    return true;
  } catch (error) {
    console.error('❌ IPC: Failed to disable hosting:', error);
    throw error;
  }
});

ipcMain.handle('p2p-add-hosting-listener', (event) => {
  const listener = (hostingData) => {
    if (!event.sender.isDestroyed()) {
      event.sender.send('p2p-hosting-changed', hostingData);
    }
  };
  
  p2pService.on('hosting', listener);
  
  // Cleanup when webContents is destroyed
  event.sender.once('destroyed', () => {
    p2pService.off('hosting', listener);
  });
  
  return true;
});

ipcMain.handle('p2p-add-peer-listener', (event) => {
  const listener = (peerData) => {
    if (!event.sender.isDestroyed()) {
      event.sender.send('p2p-peer-changed', peerData);
    }
  };
  
  p2pService.on('peer', listener);
  
  // Cleanup when webContents is destroyed
  event.sender.once('destroyed', () => {
    p2pService.off('peer', listener);
  });
  
  return true;
});

ipcMain.handle('p2p-get-peers', async () => {
  try {
    // Get connected peers from P2P service
    const status = p2pService.getStatus();
    const peers = [];
    
    // Get peer info if available
    if (status.connected && p2pService.getAllPeers) {
      const allPeers = p2pService.getAllPeers();
      for (const [peerId, peerInfo] of Object.entries(allPeers)) {
        peers.push({
          peer_id: peerId,
          models: peerInfo.models || [],
          deviceInfo: peerInfo.deviceInfo || {}
        });
      }
    }
    
    return peers;
  } catch (error) {
    console.error('Failed to get P2P peers:', error);
    return [];
  }
});

// Network interface detection
ipcMain.handle('get-network-interfaces', () => {
  try {
    return os.networkInterfaces();
  } catch (error) {
    console.error('Failed to get network interfaces:', error);
    return null;
  }
});

// LLM IPC handlers
ipcMain.handle('llm-list-local-models', async () => {
  try {
    // Get models from HTTP server
    if (httpServer) {
      const port = httpServer.getPort();
      const response = await fetch(`http://127.0.0.1:${port}/v1/models`);
      if (response.ok) {
        const data = await response.json();
        return data.data || [];
      }
    }
  } catch (error) {
    console.error('Failed to list local models:', error);
  }
  return [];
});

// Logging IPC handlers
ipcMain.handle('logging-get-logs', (event, level, limit) => {
  return loggingService.getLogs(level, limit);
});

ipcMain.handle('logging-get-log-file', () => {
  return loggingService.getLogFile();
});

ipcMain.handle('logging-get-logs-directory', () => {
  return loggingService.getLogsDirectory();
});

ipcMain.handle('logging-clear-logs', () => {
  loggingService.clearLogs();
  return true;
});

ipcMain.handle('logging-set-level', (event, level) => {
  loggingService.setLogLevel(level);
  return true;
});

ipcMain.handle('logging-open-logs-folder', () => {
  const logsDir = loggingService.getLogsDirectory();
  shell.openPath(logsDir);
  return true;
});

// Apple Foundation Models IPC handlers
ipcMain.handle('apple-models-supported', async () => {
  try {
    // Use the safe bridge that includes OS version checks
    const available = await appleModelsBridge.initialize();
    if (available) {
      console.log('✅ Apple Foundation Models available');
      return true;
    } else {
      const reason = appleModelsBridge.getUnsupportedReason();
      console.log(`⚠️ Apple Foundation Models not available: ${reason}`);
      return false;
    }
  } catch (error) {
    console.log('Failed to check Apple Foundation Models support:', error.message);
    return false;
  }
});

ipcMain.handle('apple-models-initialize', async () => {
  try {
    await appleFoundationModels.initialize();
    return { success: true };
  } catch (error) {
    console.error('Failed to initialize Apple Foundation Models:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('apple-models-get-models', async () => {
  try {
    // Check if supported first
    const isSupported = await appleModelsBridge.initialize();
    if (!isSupported) {
      const reason = appleModelsBridge.getUnsupportedReason();
      return { 
        success: false, 
        error: `Apple Foundation Models not available: ${reason}`,
        models: [],
        unsupportedReason: reason
      };
    }
    
    // Get models from bridge
    const models = await appleModelsBridge.getModels();
    return { success: true, models };
  } catch (error) {
    console.error('Failed to get Apple models:', error);
    return { 
      success: false, 
      error: error.message, 
      models: [],
      unsupportedReason: appleModelsBridge.getUnsupportedReason()
    };
  }
});

ipcMain.handle('apple-models-chat', async (event, request) => {
  try {
    // Check if supported first
    const isSupported = await appleModelsBridge.initialize();
    if (!isSupported) {
      const reason = appleModelsBridge.getUnsupportedReason();
      return { 
        success: false, 
        error: `Apple Foundation Models not available: ${reason}`,
        unsupportedReason: reason
      };
    }
    
    const response = await appleModelsBridge.createChatCompletion(request);
    return { success: true, response };
  } catch (error) {
    console.error('Failed to create chat completion:', error);
    return { 
      success: false, 
      error: error.message,
      unsupportedReason: appleModelsBridge.getUnsupportedReason()
    };
  }
});

ipcMain.handle('apple-models-get-requirements', async () => {
  return await appleModelsBridge.getSystemRequirements();
});

// macOS ML Models IPC handlers
ipcMain.handle('macos-ml-get-models', async () => {
  try {
    const models = await macOSMLModels.getAvailableModels();
    const systemInfo = macOSMLModels.getSystemInfo();
    return { success: true, models, systemInfo };
  } catch (error) {
    console.error('Failed to get macOS ML models:', error);
    return { success: false, error: error.message, models: [], systemInfo: null };
  }
});

ipcMain.handle('macos-ml-test', async (event, request) => {
  try {
    const result = await macOSMLModels.analyzeText(request.text, request.type);
    return { success: true, data: result };
  } catch (error) {
    console.error('Failed to test macOS ML:', error);
    return { success: false, error: error.message };
  }
});

// Battery state IPC handler
ipcMain.handle('get-battery-state', async () => {
  try {
    const batteryState = {
      isCharging: powerMonitor.isOnBatteryPower() === false,
      percentage: null, // Electron doesn't provide battery percentage directly
      isOnBatteryPower: powerMonitor.isOnBatteryPower()
    };
    
    // Try to get more detailed battery info if available (macOS specific)
    if (process.platform === 'darwin') {
      try {
        const { exec } = require('child_process');
        const { promisify } = require('util');
        const execAsync = promisify(exec);
        
        const { stdout } = await execAsync('pmset -g batt');
        const match = stdout.match(/(\d+)%/);
        if (match) {
          batteryState.percentage = parseInt(match[1]);
        }
        
        batteryState.isCharging = stdout.includes('AC Power') || stdout.includes('charging');
      } catch (error) {
        console.error('Failed to get detailed battery info:', error);
      }
    }
    
    return batteryState;
  } catch (error) {
    console.error('Failed to get battery state:', error);
    return null;
  }
});

// HTTP Server IPC handlers for P2P model sharing
ipcMain.handle('http-server-get-models', async () => {
  try {
    const models = await httpServerHandler.getModels();
    return { success: true, models };
  } catch (error) {
    console.error('Failed to get models for HTTP server:', error);
    return { success: false, error: error.message, models: [] };
  }
});

ipcMain.handle('http-server-chat', async (event, request) => {
  try {
    const response = await httpServerHandler.createChatCompletion(request);
    return { success: true, response };
  } catch (error) {
    console.error('Failed to create chat completion for HTTP server:', error);
    return { success: false, error: error.message };
  }
});

// Ollama Manager IPC handlers
ipcMain.handle('ollama-check-installation', async () => {
  try {
    // First check if Ollama is installed
    const isInstalled = await ollamaManager.checkOllamaInstalled();
    if (!isInstalled) {
      return false;
    }
    
    // Then check if it's running
    const isRunning = await ollamaManager.checkOllamaRunning();
    return isRunning;
  } catch (error) {
    console.error('Failed to check Ollama installation:', error);
    return false;
  }
});

ipcMain.handle('ollama-open-download-page', async () => {
  try {
    await shell.openExternal('https://ollama.ai/download');
    return { success: true };
  } catch (error) {
    console.error('Failed to open Ollama download page:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('ollama-initialize', async () => {
  try {
    const status = await ollamaManager.initialize();
    return { success: true, ...status };
  } catch (error) {
    console.error('Failed to initialize Ollama:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('ollama-download', async (event) => {
  try {
    const result = await ollamaManager.downloadOllama((progress) => {
      event.sender.send('ollama-download-progress', progress);
    });
    return { success: true, path: result };
  } catch (error) {
    console.error('Failed to download Ollama:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('ollama-start', async () => {
  try {
    await ollamaManager.startOllama();
    return { success: true };
  } catch (error) {
    console.error('Failed to start Ollama:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('ollama-stop', async () => {
  try {
    await ollamaManager.stopOllama();
    return { success: true };
  } catch (error) {
    console.error('Failed to stop Ollama:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('ollama-is-running', async () => {
  try {
    const isRunning = await ollamaManager.checkOllamaRunning();
    return { success: true, running: isRunning };
  } catch (error) {
    return { success: false, error: error.message, running: false };
  }
});

ipcMain.handle('ollama-list-models', async () => {
  try {
    const models = await ollamaManager.listModels();
    // Return full model objects with size information
    return models;
  } catch (error) {
    console.error('Failed to list Ollama models:', error);
    return [];
  }
});

ipcMain.handle('ollama-pull-model', async (event, modelName) => {
  try {
    await ollamaManager.pullModel(modelName, (progress) => {
      event.sender.send('ollama-pull-progress', { modelName, ...progress });
    });
    return { success: true };
  } catch (error) {
    console.error('Failed to pull model:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('ollama-delete-model', async (event, modelName) => {
  try {
    await ollamaManager.deleteModel(modelName);
    return { success: true };
  } catch (error) {
    console.error('Failed to delete model:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('ollama-get-model-info', async (event, modelName) => {
  try {
    const info = await ollamaManager.getModelInfo(modelName);
    return { success: true, info };
  } catch (error) {
    console.error('Failed to get model info:', error);
    return { success: false, error: error.message };
  }
});

