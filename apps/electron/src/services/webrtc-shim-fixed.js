/**
 * Fixed WebRTC Shim for Electron Main Process
 * Uses simpler serialization approach to avoid cloning errors
 */

let BrowserWindow, app;
try {
  ({ BrowserWindow, app } = require('electron'));
} catch (error) {
  console.warn('⚠️ Electron not available, WebRTC shim disabled');
}

class FixedWebRTCShim {
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

    // Load a minimal HTML page with console forwarding
    await this.hiddenWindow.loadURL(`data:text/html,<html><body>
      <script>
        // Forward console messages to main process for debugging
        const originalLog = console.log;
        const originalError = console.error;
        console.log = (...args) => {
          originalLog.apply(console, ['[WebRTC Renderer]', ...args]);
        };
        console.error = (...args) => {
          originalError.apply(console, ['[WebRTC Renderer ERROR]', ...args]);
        };
        console.log('WebRTC renderer ready');
      </script>
    </body></html>`);

    // Enable dev tools for debugging if needed
    if (process.env.DEBUG_WEBRTC) {
      this.hiddenWindow.webContents.openDevTools({ mode: 'detach' });
    }
    
    // Test WebRTC availability
    const webrtcAvailable = await this.hiddenWindow.webContents.executeJavaScript(`
      !!window.RTCPeerConnection
    `);

    if (webrtcAvailable) {
      console.log('✅ WebRTC available in renderer process');
      this.makeWebRTCGlobal();
      this.initialized = true;
      console.log('✅ WebRTC shim initialized with fixed serialization');
    } else {
      throw new Error('WebRTC not available in renderer process');
    }
  }

  makeWebRTCGlobal() {
    const webContents = this.hiddenWindow.webContents;

    // Make RTCPeerConnection globally available with proper serialization
    global.RTCPeerConnection = class RTCPeerConnection {
      constructor(config) {
        this._webContents = webContents;
        this._id = Math.random().toString(36).substr(2, 9);
        this._localDescription = null;
        this._remoteDescription = null;
        
        // Create peer in renderer with safe serialization
        webContents.executeJavaScript(`
          (async () => {
            try {
              window.peers = window.peers || {};
              const config = ${JSON.stringify(config || {})};
              window.peers['${this._id}'] = new RTCPeerConnection(config);
              console.log('Peer connection created successfully');
              return true;
            } catch (e) {
              console.error('Peer creation failed:', e.message);
              return false;
            }
          })()
        `).catch(err => console.error('WebRTC peer creation error:', err));
      }

      async createOffer(options = {}) {
        try {
          const result = await this._webContents.executeJavaScript(`
            window.peers['${this._id}'].createOffer(${JSON.stringify(options)}).then(offer => ({
              type: offer.type,
              sdp: offer.sdp
            }))
          `);
          return new global.RTCSessionDescription(result);
        } catch (error) {
          console.error('createOffer error:', error);
          throw error;
        }
      }

      async createAnswer(options = {}) {
        try {
          const result = await this._webContents.executeJavaScript(`
            window.peers['${this._id}'].createAnswer(${JSON.stringify(options)}).then(answer => ({
              type: answer.type,
              sdp: answer.sdp
            }))
          `);
          return new global.RTCSessionDescription(result);
        } catch (error) {
          console.error('createAnswer error:', error);
          throw error;
        }
      }

      async setLocalDescription(description) {
        try {
          this._localDescription = description;
          const descObj = {
            type: description.type,
            sdp: description.sdp
          };
          await this._webContents.executeJavaScript(`
            (async () => {
              try {
                const peer = window.peers && window.peers['${this._id}'];
                if (!peer) {
                  throw new Error('Peer not found for setLocalDescription');
                }
                const desc = ${JSON.stringify(descObj)};
                await peer.setLocalDescription(new RTCSessionDescription(desc));
                console.log('Local description set successfully');
              } catch (e) {
                console.error('setLocalDescription failed:', e.message);
                throw e;
              }
            })()
          `);
        } catch (error) {
          console.error('setLocalDescription error:', error);
          throw error;
        }
      }

      async setRemoteDescription(description) {
        try {
          this._remoteDescription = description;
          const descObj = {
            type: description.type,
            sdp: description.sdp
          };
          await this._webContents.executeJavaScript(`
            (async () => {
              try {
                const peer = window.peers && window.peers['${this._id}'];
                if (!peer) {
                  throw new Error('Peer not found for setRemoteDescription');
                }
                const desc = ${JSON.stringify(descObj)};
                await peer.setRemoteDescription(new RTCSessionDescription(desc));
                console.log('Remote description set successfully');
              } catch (e) {
                console.error('setRemoteDescription failed:', e.message);
                throw e;
              }
            })()
          `);
        } catch (error) {
          console.error('setRemoteDescription error:', error);
          throw error;
        }
      }

      async addIceCandidate(candidate) {
        try {
          if (!candidate || !candidate.candidate) return;
          
          const candidateObj = {
            candidate: candidate.candidate,
            sdpMLineIndex: candidate.sdpMLineIndex,
            sdpMid: candidate.sdpMid
          };
          
          await this._webContents.executeJavaScript(`
            (async () => {
              try {
                const peer = window.peers && window.peers['${this._id}'];
                if (!peer) {
                  console.error('Peer not found for addIceCandidate');
                  return;
                }
                
                const candidateData = ${JSON.stringify(candidateObj)};
                if (candidateData && candidateData.candidate) {
                  await peer.addIceCandidate(new RTCIceCandidate(candidateData));
                  console.log('ICE candidate added successfully');
                }
              } catch (e) {
                console.error('addIceCandidate failed:', e.message);
              }
            })()
          `);
        } catch (error) {
          console.error('addIceCandidate error:', error);
          // Don't throw for ICE candidate errors, they're often non-fatal
        }
      }

      createDataChannel(label, options = {}) {
        const channelId = Math.random().toString(36).substr(2, 9);
        this._webContents.executeJavaScript(`
          window.dataChannels = window.dataChannels || {};
          window.dataChannels['${channelId}'] = window.peers['${this._id}'].createDataChannel('${label}', ${JSON.stringify(options)});
          true;
        `).catch(err => console.error('DataChannel creation error:', err));
        
        return new DataChannelShim(channelId, this._webContents);
      }

      addEventListener(event, handler) {
        // Simple event handling - SimplePeer typically doesn't rely heavily on these
      }

      removeEventListener(event, handler) {
        // Simple event handling
      }

      close() {
        this._webContents.executeJavaScript(`
          if (window.peers['${this._id}']) {
            window.peers['${this._id}'].close();
            delete window.peers['${this._id}'];
          }
          true;
        `).catch(err => console.error('Peer close error:', err));
      }

      get localDescription() {
        return this._localDescription;
      }

      get remoteDescription() {
        return this._remoteDescription;
      }
    };

    // Simple RTCSessionDescription implementation
    global.RTCSessionDescription = class RTCSessionDescription {
      constructor(init) {
        if (init) {
          this.type = init.type;
          this.sdp = init.sdp;
        }
      }
    };

    // Simple RTCIceCandidate implementation
    global.RTCIceCandidate = class RTCIceCandidate {
      constructor(init) {
        if (init) {
          this.candidate = init.candidate;
          this.sdpMLineIndex = init.sdpMLineIndex;
          this.sdpMid = init.sdpMid;
        }
      }
    };

    console.log('✅ Fixed WebRTC APIs made globally available');
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
  }

  send(data) {
    this.webContents.executeJavaScript(`
      if (window.dataChannels['${this.channelId}']) {
        window.dataChannels['${this.channelId}'].send(${JSON.stringify(data)});
      }
    `).catch(err => console.error('DataChannel send error:', err));
  }

  addEventListener(event, listener) {
    // Simple implementation
  }

  removeEventListener(event, listener) {
    // Simple implementation
  }

  close() {
    this.webContents.executeJavaScript(`
      if (window.dataChannels['${this.channelId}']) {
        window.dataChannels['${this.channelId}'].close();
        delete window.dataChannels['${this.channelId}'];
      }
    `).catch(err => console.error('DataChannel close error:', err));
  }
}

// Singleton instance
let shimInstance = null;

async function getFixedWebRTCShim() {
  if (!shimInstance) {
    shimInstance = new FixedWebRTCShim();
    await shimInstance.initialize();
  }
  return shimInstance;
}

module.exports = {
  FixedWebRTCShim,
  getFixedWebRTCShim
};