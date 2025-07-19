/**
 * WebRTC Renderer Bridge
 * Uses the main window's renderer process for WebRTC operations
 */

const { ipcMain, BrowserWindow } = require('electron');

class WebRTCRendererBridge {
  constructor() {
    this.mainWindow = null;
    this.initialized = false;
    this.setupIPC();
  }

  setMainWindow(window) {
    this.mainWindow = window;
    this.initialized = true;
    console.log('✅ WebRTC renderer bridge connected to main window');
  }

  setupIPC() {
    // Handle WebRTC operations via IPC
    ipcMain.handle('webrtc-create-peer', async (event, config) => {
      if (!this.mainWindow) throw new Error('Main window not available');
      
      return this.mainWindow.webContents.executeJavaScript(`
        window.webrtcBridge = window.webrtcBridge || {};
        const peerId = Math.random().toString(36).substr(2, 9);
        window.webrtcBridge[peerId] = new RTCPeerConnection(${JSON.stringify(config)});
        
        // Set up event forwarding
        const peer = window.webrtcBridge[peerId];
        peer.onicecandidate = (e) => {
          if (e.candidate) {
            window.electronAPI?.sendToMain('webrtc-icecandidate', { peerId, candidate: e.candidate });
          }
        };
        peer.ondatachannel = (e) => {
          window.electronAPI?.sendToMain('webrtc-datachannel', { peerId, channel: e.channel });
        };
        peer.onconnectionstatechange = () => {
          window.electronAPI?.sendToMain('webrtc-connectionstate', { 
            peerId, 
            state: peer.connectionState 
          });
        };
        
        peerId;
      `);
    });

    ipcMain.handle('webrtc-create-offer', async (event, peerId, options) => {
      if (!this.mainWindow) throw new Error('Main window not available');
      
      return this.mainWindow.webContents.executeJavaScript(`
        window.webrtcBridge['${peerId}'].createOffer(${JSON.stringify(options || {})})
          .then(offer => ({ type: offer.type, sdp: offer.sdp }))
      `);
    });

    ipcMain.handle('webrtc-create-answer', async (event, peerId, options) => {
      if (!this.mainWindow) throw new Error('Main window not available');
      
      return this.mainWindow.webContents.executeJavaScript(`
        window.webrtcBridge['${peerId}'].createAnswer(${JSON.stringify(options || {})})
          .then(answer => ({ type: answer.type, sdp: answer.sdp }))
      `);
    });

    ipcMain.handle('webrtc-set-local-description', async (event, peerId, description) => {
      if (!this.mainWindow) throw new Error('Main window not available');
      
      return this.mainWindow.webContents.executeJavaScript(`
        window.webrtcBridge['${peerId}'].setLocalDescription(${JSON.stringify(description)})
      `);
    });

    ipcMain.handle('webrtc-set-remote-description', async (event, peerId, description) => {
      if (!this.mainWindow) throw new Error('Main window not available');
      
      return this.mainWindow.webContents.executeJavaScript(`
        window.webrtcBridge['${peerId}'].setRemoteDescription(${JSON.stringify(description)})
      `);
    });

    ipcMain.handle('webrtc-add-ice-candidate', async (event, peerId, candidate) => {
      if (!this.mainWindow) throw new Error('Main window not available');
      
      return this.mainWindow.webContents.executeJavaScript(`
        window.webrtcBridge['${peerId}'].addIceCandidate(${JSON.stringify(candidate)})
      `);
    });

    ipcMain.handle('webrtc-close-peer', async (event, peerId) => {
      if (!this.mainWindow) throw new Error('Main window not available');
      
      return this.mainWindow.webContents.executeJavaScript(`
        if (window.webrtcBridge['${peerId}']) {
          window.webrtcBridge['${peerId}'].close();
          delete window.webrtcBridge['${peerId}'];
        }
      `);
    });

    // Forward WebRTC events from renderer to main
    ipcMain.on('webrtc-icecandidate', (event, data) => {
      this.emit('icecandidate', data);
    });

    ipcMain.on('webrtc-datachannel', (event, data) => {
      this.emit('datachannel', data);
    });

    ipcMain.on('webrtc-connectionstate', (event, data) => {
      this.emit('connectionstatechange', data);
    });
  }

  // Create a WebRTC implementation that uses the renderer bridge
  createWebRTCImplementation() {
    if (!this.initialized) {
      throw new Error('WebRTC renderer bridge not initialized');
    }

    const { ipcRenderer } = require('electron');

    return {
      RTCPeerConnection: class RendererRTCPeerConnection {
        constructor(config) {
          this.config = config;
          this.peerId = null;
          this._localDescription = null;
          this._remoteDescription = null;
          this._listeners = {};
          
          // Create peer in renderer
          ipcRenderer.invoke('webrtc-create-peer', config).then(peerId => {
            this.peerId = peerId;
          });
        }

        async createOffer(options) {
          const result = await ipcRenderer.invoke('webrtc-create-offer', this.peerId, options);
          return new global.RTCSessionDescription(result);
        }

        async createAnswer(options) {
          const result = await ipcRenderer.invoke('webrtc-create-answer', this.peerId, options);
          return new global.RTCSessionDescription(result);
        }

        async setLocalDescription(description) {
          this._localDescription = description;
          return ipcRenderer.invoke('webrtc-set-local-description', this.peerId, {
            type: description.type,
            sdp: description.sdp
          });
        }

        async setRemoteDescription(description) {
          this._remoteDescription = description;
          return ipcRenderer.invoke('webrtc-set-remote-description', this.peerId, {
            type: description.type,
            sdp: description.sdp
          });
        }

        async addIceCandidate(candidate) {
          return ipcRenderer.invoke('webrtc-add-ice-candidate', this.peerId, {
            candidate: candidate.candidate,
            sdpMLineIndex: candidate.sdpMLineIndex,
            sdpMid: candidate.sdpMid
          });
        }

        close() {
          if (this.peerId) {
            ipcRenderer.invoke('webrtc-close-peer', this.peerId);
          }
        }

        addEventListener(event, handler) {
          if (!this._listeners[event]) this._listeners[event] = [];
          this._listeners[event].push(handler);
        }

        removeEventListener(event, handler) {
          if (this._listeners[event]) {
            const index = this._listeners[event].indexOf(handler);
            if (index > -1) this._listeners[event].splice(index, 1);
          }
        }

        get localDescription() {
          return this._localDescription;
        }

        get remoteDescription() {
          return this._remoteDescription;
        }
      },

      RTCSessionDescription: class RendererRTCSessionDescription {
        constructor(init) {
          this.type = init?.type;
          this.sdp = init?.sdp;
        }
      },

      RTCIceCandidate: class RendererRTCIceCandidate {
        constructor(init) {
          this.candidate = init?.candidate;
          this.sdpMLineIndex = init?.sdpMLineIndex;
          this.sdpMid = init?.sdpMid;
        }
      }
    };
  }
}

// Event emitter functionality
const EventEmitter = require('events');
Object.setPrototypeOf(WebRTCRendererBridge.prototype, EventEmitter.prototype);

module.exports = new WebRTCRendererBridge();