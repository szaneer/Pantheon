/**
 * Simple WebRTC Shim for Electron Main Process
 * Uses direct evaluation in renderer process for WebRTC operations
 */

let BrowserWindow, app;
try {
  ({ BrowserWindow, app } = require('electron'));
} catch (error) {
  console.warn('⚠️ Electron not available, WebRTC shim disabled');
}

class SimpleWebRTCShim {
  constructor() {
    this.hiddenWindow = null;
    this.initialized = false;
    this.peerConnections = new Map();
  }

  async initialize() {
    if (this.initialized) return;
    
    if (!BrowserWindow || !app) {
      throw new Error('Electron BrowserWindow or app not available');
    }

    // Wait for app to be ready
    if (!app.isReady()) {
      console.log('⏳ Waiting for Electron app to be ready...');
      await app.whenReady();
      console.log('✅ Electron app ready, proceeding with WebRTC shim');
    }

    // Create a hidden renderer process for WebRTC operations
    this.hiddenWindow = new BrowserWindow({
      show: false,
      width: 1,
      height: 1,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
        webSecurity: false
      }
    });

    // Load a minimal HTML page
    await this.hiddenWindow.loadURL('data:text/html,<html><body><script>window.peers = {};</script></body></html>');
    
    this.initialized = true;
    console.log('✅ WebRTC shim initialized with hidden renderer');
  }

  // Create a WebRTC-compatible object for SimplePeer
  createWebRTCImplementation() {
    if (!this.initialized) {
      throw new Error('WebRTC shim not initialized');
    }

    const webContents = this.hiddenWindow.webContents;
    
    // Return the actual WebRTC classes from the renderer
    return webContents.executeJavaScript(`
      ({
        RTCPeerConnection: window.RTCPeerConnection,
        RTCSessionDescription: window.RTCSessionDescription,
        RTCIceCandidate: window.RTCIceCandidate
      })
    `);
  }

  destroy() {
    if (this.hiddenWindow) {
      this.hiddenWindow.close();
      this.hiddenWindow = null;
    }
    this.initialized = false;
  }
}

// Singleton instance
let shimInstance = null;

async function getSimpleWebRTCShim() {
  if (!shimInstance) {
    shimInstance = new SimpleWebRTCShim();
    await shimInstance.initialize();
  }
  return shimInstance;
}

module.exports = {
  SimpleWebRTCShim,
  getSimpleWebRTCShim
};