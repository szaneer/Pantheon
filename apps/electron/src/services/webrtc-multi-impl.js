/**
 * Multi-Implementation WebRTC Support
 * Tries different WebRTC approaches for maximum compatibility
 */

const isProduction = process.env.NODE_ENV === 'production';
const log = (...args) => {
  if (!isProduction) {
    console.log(...args);
  }
};
const warn = (...args) => {
  if (!isProduction) {
    console.warn(...args);
  }
};
const error = (...args) => {
  if (!isProduction) {
    console.error(...args);
  }
};

class WebRTCMultiImpl {
  constructor() {
    this.implementation = null;
    this.implementationType = null;
    this.available = false;
  }

  async initialize() {
    log('🔍 Detecting WebRTC implementation...');
    
    // Try implementations in order of preference
    const implementations = [
      () => this.tryNativeWRTC(),
      () => this.tryElectronWebRTC(),
      () => this.tryRendererWebRTC(),
      () => this.tryFallbackWebRTC()
    ];

    for (const impl of implementations) {
      try {
        const result = await impl();
        if (result) {
          this.implementation = result.impl;
          this.implementationType = result.type;
          this.available = true;
          log(`✅ WebRTC implementation found: ${result.type}`);
          return true;
        }
      } catch (err) {
        warn(`⚠️ WebRTC implementation failed: ${err.message}`);
      }
    }

    error('❌ No WebRTC implementation available');
    return false;
  }

  // Try native WebRTC packages
  tryNativeWRTC() {
    const packages = ['@roamhq/wrtc', 'wrtc'];
    
    for (const pkg of packages) {
      try {
        const wrtc = require(pkg);
        log(`✅ Native WebRTC package loaded: ${pkg}`);
        return {
          type: `native-${pkg}`,
          impl: wrtc
        };
      } catch (err) {
        warn(`⚠️ Native package ${pkg} not available:`, err.message);
      }
    }
    return null;
  }

  // Try electron-webrtc
  tryElectronWebRTC() {
    try {
      const electronWebRTC = require('electron-webrtc');
      const instance = electronWebRTC();
      
      // Test if it actually works
      if (instance && typeof instance.RTCPeerConnection === 'function') {
        log('✅ electron-webrtc loaded successfully');
        return {
          type: 'electron-webrtc',
          impl: instance
        };
      }
    } catch (err) {
      warn('⚠️ electron-webrtc not available:', err.message);
    }
    return null;
  }

  // Try using renderer process WebRTC
  tryRendererWebRTC() {
    try {
      // Check if we're in main process and can access renderer
      if (typeof window === 'undefined' && require) {
        const { BrowserWindow, app } = require('electron');
        
        if (app && app.isReady()) {
          // Try to get WebRTC from an existing window
          const windows = BrowserWindow.getAllWindows();
          if (windows.length > 0) {
            log('✅ Renderer WebRTC bridge available');
            return {
              type: 'renderer-bridge',
              impl: this.createRendererBridge(windows[0])
            };
          }
        }
      }
    } catch (error) {
      console.warn('⚠️ Renderer WebRTC not available:', error.message);
    }
    return null;
  }

  // Create a renderer bridge implementation
  createRendererBridge(window) {
    return {
      RTCPeerConnection: class RendererBridgePeerConnection {
        constructor(config) {
          this.config = config;
          this.window = window;
          this.peerId = Math.random().toString(36).substr(2, 9);
          this._localDescription = null;
          this._remoteDescription = null;
          
          // Initialize peer in renderer
          this.window.webContents.executeJavaScript(`
            window.webrtcPeers = window.webrtcPeers || {};
            window.webrtcPeers['${this.peerId}'] = new RTCPeerConnection(${JSON.stringify(config)});
            true;
          `);
        }

        async createOffer(options = {}) {
          const result = await this.window.webContents.executeJavaScript(`
            window.webrtcPeers['${this.peerId}'].createOffer(${JSON.stringify(options)})
              .then(offer => ({ type: offer.type, sdp: offer.sdp }))
          `);
          return { type: result.type, sdp: result.sdp };
        }

        async createAnswer(options = {}) {
          const result = await this.window.webContents.executeJavaScript(`
            window.webrtcPeers['${this.peerId}'].createAnswer(${JSON.stringify(options)})
              .then(answer => ({ type: answer.type, sdp: answer.sdp }))
          `);
          return { type: result.type, sdp: result.sdp };
        }

        async setLocalDescription(description) {
          this._localDescription = description;
          await this.window.webContents.executeJavaScript(`
            window.webrtcPeers['${this.peerId}'].setLocalDescription(${JSON.stringify(description)})
          `);
        }

        async setRemoteDescription(description) {
          this._remoteDescription = description;
          await this.window.webContents.executeJavaScript(`
            window.webrtcPeers['${this.peerId}'].setRemoteDescription(${JSON.stringify(description)})
          `);
        }

        async addIceCandidate(candidate) {
          if (!candidate || !candidate.candidate) return;
          await this.window.webContents.executeJavaScript(`
            window.webrtcPeers['${this.peerId}'].addIceCandidate(${JSON.stringify(candidate)})
          `);
        }

        close() {
          this.window.webContents.executeJavaScript(`
            if (window.webrtcPeers['${this.peerId}']) {
              window.webrtcPeers['${this.peerId}'].close();
              delete window.webrtcPeers['${this.peerId}'];
            }
          `);
        }

        addEventListener() {} // Simplified for this approach
        removeEventListener() {}

        get localDescription() { return this._localDescription; }
        get remoteDescription() { return this._remoteDescription; }
      },

      RTCSessionDescription: class {
        constructor(init) {
          this.type = init?.type;
          this.sdp = init?.sdp;
        }
      },

      RTCIceCandidate: class {
        constructor(init) {
          this.candidate = init?.candidate;
          this.sdpMLineIndex = init?.sdpMLineIndex;
          this.sdpMid = init?.sdpMid;
        }
      }
    };
  }

  // Fallback stub implementation that enables P2P but fails gracefully
  tryFallbackWebRTC() {
    console.log('⚠️ Using fallback WebRTC stubs (will enable P2P but connections will fail gracefully)');
    
    return {
      type: 'fallback-stubs',
      impl: {
        RTCPeerConnection: class FallbackPeerConnection {
          constructor() {
            setTimeout(() => {
              if (this.onerror) {
                this.onerror(new Error('WebRTC not available'));
              }
            }, 100);
          }
          
          createOffer() { return Promise.reject(new Error('WebRTC not available')); }
          createAnswer() { return Promise.reject(new Error('WebRTC not available')); }
          setLocalDescription() { return Promise.reject(new Error('WebRTC not available')); }
          setRemoteDescription() { return Promise.reject(new Error('WebRTC not available')); }
          addIceCandidate() { return Promise.reject(new Error('WebRTC not available')); }
          close() {}
          addEventListener() {}
          removeEventListener() {}
        },
        
        RTCSessionDescription: class {
          constructor(init) {
            this.type = init?.type;
            this.sdp = init?.sdp;
          }
        },
        
        RTCIceCandidate: class {
          constructor(init) {
            this.candidate = init?.candidate;
            this.sdpMLineIndex = init?.sdpMLineIndex;
            this.sdpMid = init?.sdpMid;
          }
        }
      }
    };
  }

  // Make WebRTC APIs globally available
  makeGlobal() {
    if (!this.available || !this.implementation) {
      console.warn('⚠️ No WebRTC implementation available to make global');
      return false;
    }

    global.RTCPeerConnection = this.implementation.RTCPeerConnection;
    global.RTCSessionDescription = this.implementation.RTCSessionDescription;
    global.RTCIceCandidate = this.implementation.RTCIceCandidate;

    console.log(`✅ WebRTC APIs made global using ${this.implementationType}`);
    return true;
  }

  getImplementationInfo() {
    return {
      available: this.available,
      type: this.implementationType,
      implementation: this.implementation ? 'loaded' : 'none'
    };
  }
}

module.exports = new WebRTCMultiImpl();