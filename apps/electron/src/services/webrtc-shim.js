/**
 * WebRTC Shim for Electron Main Process
 * Makes WebRTC APIs available globally in main process for SimplePeer
 */

let BrowserWindow, app;
try {
  ({ BrowserWindow, app } = require('electron'));
} catch (error) {
  console.warn('⚠️ Electron not available, WebRTC shim disabled');
}

class WebRTCShim {
  constructor() {
    this.hiddenWindow = null;
    this.initialized = false;
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
    await this.hiddenWindow.loadURL('data:text/html,<html><body></body></html>');
    
    // Get WebRTC classes from renderer and make them globally available
    const webrtcClasses = await this.hiddenWindow.webContents.executeJavaScript(`
      ({
        RTCPeerConnection: window.RTCPeerConnection ? window.RTCPeerConnection.toString() : null,
        RTCSessionDescription: window.RTCSessionDescription ? window.RTCSessionDescription.toString() : null,
        RTCIceCandidate: window.RTCIceCandidate ? window.RTCIceCandidate.toString() : null,
        available: !!window.RTCPeerConnection
      })
    `);

    if (webrtcClasses.available) {
      console.log('✅ WebRTC classes available in renderer');
      
      // Make WebRTC APIs available globally in main process
      this.makeWebRTCGlobal();
      
      this.initialized = true;
      console.log('✅ WebRTC shim initialized and APIs made global');
    } else {
      throw new Error('WebRTC not available in renderer process');
    }
  }

  makeWebRTCGlobal() {
    const webContents = this.hiddenWindow.webContents;

    // Make RTCPeerConnection globally available
    global.RTCPeerConnection = class RTCPeerConnection {
      constructor(config) {
        this._webContents = webContents;
        this._id = Math.random().toString(36).substr(2, 9);
        this._localDescription = null;
        this._remoteDescription = null;
        
        // Create peer in renderer (sync not async since it's in constructor)
        webContents.executeJavaScript(`
          window.peers = window.peers || {};
          window.peers['${this._id}'] = new RTCPeerConnection(${JSON.stringify(config)});
          true;
        `);
      }

      createOffer(options = {}) {
        return this._webContents.executeJavaScript(`
          window.peers['${this._id}'].createOffer(${JSON.stringify(options)})
        `);
      }

      createAnswer(options = {}) {
        return this._webContents.executeJavaScript(`
          window.peers['${this._id}'].createAnswer(${JSON.stringify(options)})
        `);
      }

      setLocalDescription(description) {
        this._localDescription = description;
        return this._webContents.executeJavaScript(`
          window.peers['${this._id}'].setLocalDescription(${JSON.stringify(description)})
        `);
      }

      setRemoteDescription(description) {
        this._remoteDescription = description;
        return this._webContents.executeJavaScript(`
          window.peers['${this._id}'].setRemoteDescription(${JSON.stringify(description)})
        `);
      }

      addIceCandidate(candidate) {
        return this._webContents.executeJavaScript(`
          window.peers['${this._id}'].addIceCandidate(${JSON.stringify(candidate)})
        `);
      }

      createDataChannel(label, options = {}) {
        const channelId = Math.random().toString(36).substr(2, 9);
        this._webContents.executeJavaScript(`
          window.dataChannels = window.dataChannels || {};
          window.dataChannels['${channelId}'] = window.peers['${this._id}'].createDataChannel('${label}', ${JSON.stringify(options)});
          true;
        `);
        return new DataChannelShim(channelId, this._webContents);
      }

      addEventListener(event, handler) {
        // Implement event forwarding if needed
      }

      removeEventListener(event, handler) {
        // Implement event removal if needed
      }

      close() {
        this._webContents.executeJavaScript(`
          if (window.peers['${this._id}']) {
            window.peers['${this._id}'].close();
            delete window.peers['${this._id}'];
          }
          true;
        `);
      }

      get localDescription() {
        return this._localDescription;
      }

      get remoteDescription() {
        return this._remoteDescription;
      }
    };

    // Make RTCSessionDescription globally available
    global.RTCSessionDescription = class RTCSessionDescription {
      constructor(init) {
        this.type = init?.type;
        this.sdp = init?.sdp;
      }
    };

    // Make RTCIceCandidate globally available
    global.RTCIceCandidate = class RTCIceCandidate {
      constructor(init) {
        this.candidate = init?.candidate;
        this.sdpMLineIndex = init?.sdpMLineIndex;
        this.sdpMid = init?.sdpMid;
      }
    };

    console.log('✅ WebRTC APIs made globally available');
  }

  destroy() {
    if (this.hiddenWindow) {
      this.hiddenWindow.close();
      this.hiddenWindow = null;
    }
    this.initialized = false;
  }
}

class DataChannelShim {
  constructor(channelId, webContents) {
    this.channelId = channelId;
    this.webContents = webContents;
    this._listeners = {};
  }

  send(data) {
    this.webContents.executeJavaScript(`
      if (window.dataChannels['${this.channelId}']) {
        window.dataChannels['${this.channelId}'].send(${JSON.stringify(data)});
      }
    `);
  }

  addEventListener(event, listener) {
    if (!this._listeners[event]) {
      this._listeners[event] = [];
    }
    this._listeners[event].push(listener);
  }

  removeEventListener(event, listener) {
    if (this._listeners[event]) {
      const index = this._listeners[event].indexOf(listener);
      if (index > -1) {
        this._listeners[event].splice(index, 1);
      }
    }
  }

  close() {
    this.webContents.executeJavaScript(`
      if (window.dataChannels['${this.channelId}']) {
        window.dataChannels['${this.channelId}'].close();
        delete window.dataChannels['${this.channelId}'];
      }
    `);
  }
}

// Singleton instance
let shimInstance = null;

async function getWebRTCShim() {
  if (!shimInstance) {
    shimInstance = new WebRTCShim();
    await shimInstance.initialize();
  }
  return shimInstance;
}

module.exports = {
  WebRTCShim,
  getWebRTCShim
};