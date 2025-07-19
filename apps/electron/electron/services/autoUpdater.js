const { autoUpdater } = require('electron-updater');
const { dialog, BrowserWindow } = require('electron');
const log = require('electron-log');
const updateConfig = require('./updateConfig');

// Configure logging
log.transports.file.level = 'info';
autoUpdater.logger = log;

class AutoUpdaterService {
  constructor() {
    this.isUpdating = false;
    this.updateAvailable = false;
    this.downloadProgress = 0;
    
    // Configure auto-updater
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = true;
    
    // Configure GitHub releases URL
    autoUpdater.setFeedURL({
      provider: 'github',
      owner: 'yourusername',
      repo: 'Pantheon',
      private: false
    });
    
    this.setupEventListeners();
  }

  setupEventListeners() {
    autoUpdater.on('checking-for-update', () => {
      log.info('Checking for update...');
      this.sendStatusToWindow('Checking for update...');
    });

    autoUpdater.on('update-available', (info) => {
      log.info('Update available:', info);
      this.updateAvailable = true;
      
      // Show dialog to user
      dialog.showMessageBox(BrowserWindow.getFocusedWindow(), {
        type: 'info',
        title: 'Update Available',
        message: `A new version (${info.version}) is available!`,
        detail: 'Would you like to download and install it now?',
        buttons: ['Download', 'Later'],
        defaultId: 0,
        cancelId: 1
      }).then((result) => {
        if (result.response === 0) {
          autoUpdater.downloadUpdate();
        }
      });
    });

    autoUpdater.on('update-not-available', () => {
      log.info('Update not available');
      this.sendStatusToWindow('You have the latest version!');
    });

    autoUpdater.on('error', (err) => {
      log.error('Error in auto-updater:', err);
      this.sendStatusToWindow('Update error: ' + err);
      
      if (this.isUpdating) {
        dialog.showErrorBox('Update Error', 
          'An error occurred while updating. Please try again later or download manually from GitHub.');
      }
    });

    autoUpdater.on('download-progress', (progressObj) => {
      let progressMessage = `Download speed: ${Math.round(progressObj.bytesPerSecond / 1024)} KB/s`;
      progressMessage += ` - Downloaded ${Math.round(progressObj.percent)}%`;
      progressMessage += ` (${Math.round(progressObj.transferred / 1024 / 1024)}/${Math.round(progressObj.total / 1024 / 1024)} MB)`;
      
      log.info(progressMessage);
      this.downloadProgress = progressObj.percent;
      this.sendStatusToWindow(progressMessage);
      
      // Update any progress UI
      const mainWindow = BrowserWindow.getFocusedWindow();
      if (mainWindow) {
        mainWindow.setProgressBar(progressObj.percent / 100);
      }
    });

    autoUpdater.on('update-downloaded', (info) => {
      log.info('Update downloaded:', info);
      this.sendStatusToWindow('Update downloaded');
      
      // Reset progress bar
      const mainWindow = BrowserWindow.getFocusedWindow();
      if (mainWindow) {
        mainWindow.setProgressBar(-1);
      }
      
      // Prompt user to restart
      dialog.showMessageBox(BrowserWindow.getFocusedWindow(), {
        type: 'info',
        title: 'Update Ready',
        message: 'Update has been downloaded',
        detail: 'The application will restart to apply the update.',
        buttons: ['Restart Now', 'Later'],
        defaultId: 0,
        cancelId: 1
      }).then((result) => {
        if (result.response === 0) {
          autoUpdater.quitAndInstall();
        }
      });
    });
  }

  checkForUpdates() {
    if (this.isUpdating) {
      log.info('Update check already in progress');
      return;
    }
    
    this.isUpdating = true;
    autoUpdater.checkForUpdatesAndNotify()
      .catch((error) => {
        log.error('Update check failed:', error);
        this.isUpdating = false;
      })
      .finally(() => {
        this.isUpdating = false;
      });
  }

  checkForUpdatesManually() {
    const mainWindow = BrowserWindow.getFocusedWindow();
    
    if (this.isUpdating) {
      dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'Update Check',
        message: 'Update check is already in progress.',
        buttons: ['OK']
      });
      return;
    }
    
    this.isUpdating = true;
    
    // Show immediate feedback
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Checking for Updates',
      message: 'Checking for updates...',
      buttons: ['OK']
    });
    
    autoUpdater.checkForUpdates()
      .then((result) => {
        if (!this.updateAvailable) {
          dialog.showMessageBox(mainWindow, {
            type: 'info',
            title: 'No Updates',
            message: 'You are running the latest version!',
            buttons: ['OK']
          });
        }
      })
      .catch((error) => {
        log.error('Manual update check failed:', error);
        dialog.showErrorBox('Update Check Failed', 
          'Unable to check for updates. Please check your internet connection and try again.');
      })
      .finally(() => {
        this.isUpdating = false;
      });
  }

  sendStatusToWindow(text) {
    log.info('Update status:', text);
    
    // Send to all windows
    BrowserWindow.getAllWindows().forEach((window) => {
      window.webContents.send('update-status', text);
    });
  }

  getUpdateStatus() {
    return {
      isUpdating: this.isUpdating,
      updateAvailable: this.updateAvailable,
      downloadProgress: this.downloadProgress
    };
  }
}

module.exports = new AutoUpdaterService();