/**
 * Simple WebRTC Polyfill for Electron Main Process
 * Minimal implementation that just makes WebRTC APIs available globally
 */

let BrowserWindow, app;
try {
  ({ BrowserWindow, app } = require('electron'));
} catch (error) {
  console.warn('⚠️ Electron not available, WebRTC polyfill disabled');
}

class SimpleWebRTCPolyfill {
  constructor() {
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
      console.log('✅ Electron app ready, proceeding with WebRTC polyfill');
    }

    // Simple approach: Just tell SimplePeer we have WebRTC support
    // and let it fail gracefully if it doesn't work
    this.makeBasicWebRTCGlobal();
    
    this.initialized = true;
    console.log('✅ Basic WebRTC polyfill initialized');
  }

  makeBasicWebRTCGlobal() {
    // Provide minimal WebRTC stubs that will cause SimplePeer to fail fast
    // rather than hang indefinitely
    
    global.RTCPeerConnection = class RTCPeerConnection {
      constructor(config) {
        // Immediately throw an error so SimplePeer knows WebRTC isn't available
        setTimeout(() => {
          if (this.onerror) {
            this.onerror(new Error('WebRTC not available in main process'));
          }
        }, 100);
      }
      
      createOffer() {
        return Promise.reject(new Error('WebRTC not available in main process'));
      }
      
      createAnswer() {
        return Promise.reject(new Error('WebRTC not available in main process'));
      }
      
      setLocalDescription() {
        return Promise.reject(new Error('WebRTC not available in main process'));
      }
      
      setRemoteDescription() {
        return Promise.reject(new Error('WebRTC not available in main process'));
      }
      
      addIceCandidate() {
        return Promise.reject(new Error('WebRTC not available in main process'));
      }
      
      close() {
        // No-op
      }
      
      addEventListener() {
        // No-op
      }
      
      removeEventListener() {
        // No-op
      }
    };

    global.RTCSessionDescription = class RTCSessionDescription {
      constructor(init) {
        if (init) {
          this.type = init.type;
          this.sdp = init.sdp;
        }
      }
    };

    global.RTCIceCandidate = class RTCIceCandidate {
      constructor(init) {
        if (init) {
          this.candidate = init.candidate;
          this.sdpMLineIndex = init.sdpMLineIndex;
          this.sdpMid = init.sdpMid;
        }
      }
    };

    console.log('✅ Basic WebRTC stubs made globally available');
  }

  destroy() {
    this.initialized = false;
  }
}

// Singleton instance
let polyfillInstance = null;

async function getSimpleWebRTCPolyfill() {
  if (!polyfillInstance) {
    polyfillInstance = new SimpleWebRTCPolyfill();
    await polyfillInstance.initialize();
  }
  return polyfillInstance;
}

module.exports = {
  SimpleWebRTCPolyfill,
  getSimpleWebRTCPolyfill
};