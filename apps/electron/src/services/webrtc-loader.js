/**
 * WebRTC Module Loader
 * Intelligently loads the appropriate WebRTC implementation based on platform and availability
 */

const os = require('os');
const path = require('path');
const { existsSync } = require('fs');

let wrtc = null;
let loadError = null;

// Determine architecture
const isX86 = process.arch === 'x64' || process.arch === 'ia32';
const isARM = process.arch === 'arm64';
const isMac = os.platform() === 'darwin';
const isProduction = process.env.NODE_ENV === 'production';

// Only log in development
const log = (...args) => {
  if (!isProduction) {
    console.log(...args);
  }
};

log(`🔍 WebRTC Loader: Platform: ${os.platform()}, Arch: ${process.arch}`);

// Try loading implementations in order of preference
const implementations = [
  {
    name: '@roamhq/wrtc',
    condition: () => true,
    loader: () => require('@roamhq/wrtc'),
    fallback: false
  },
  {
    name: 'wrtc',
    condition: () => true,
    loader: () => require('wrtc'),
    fallback: false
  }
];

// Try each implementation
for (const impl of implementations) {
  if (!impl.condition()) {
    log(`⏭️  Skipping ${impl.name} (condition not met)`);
    continue;
  }

  try {
    log(`🔄 Attempting to load ${impl.name}...`);
    wrtc = impl.loader();
    
    // Verify the module has required exports
    if (wrtc && wrtc.RTCPeerConnection) {
      log(`✅ Successfully loaded ${impl.name}`);
      
      // Add metadata
      wrtc._implementation = impl.name;
      wrtc._isFallback = impl.fallback;
      
      break;
    } else {
      log(`⚠️  ${impl.name} loaded but missing required exports`);
    }
  } catch (error) {
    log(`❌ Failed to load ${impl.name}:`, error.message);
    loadError = error;
  }
}

// If no implementation loaded, use JavaScript fallback
if (!wrtc) {
  log('⚠️  No native WebRTC implementation available, using JavaScript fallback');
  
  // Always use the fallback implementation from webrtc-wrapper
  // This provides a working WebRTC implementation even when native modules fail
  try {
    // Try different paths for different environments
    let wrapper;
    try {
      // Development path
      wrapper = require('../../native-bindings/webrtc-wrapper');
    } catch (e1) {
      try {
        // Production path (from services directory)
        wrapper = require('../native-bindings/webrtc-wrapper');
      } catch (e2) {
        // Alternative production path
        wrapper = require('./native-bindings/webrtc-wrapper');
      }
    }
    
    wrtc = wrapper;
    wrtc._implementation = 'JavaScript WebRTC Fallback';
    wrtc._isFallback = true;
    log('✅ Successfully loaded JavaScript WebRTC fallback');
  } catch (error) {
    log('❌ Failed to load JavaScript fallback:', error.message);
    // Last resort: provide a mock that explains the issue
    wrtc = {
      RTCPeerConnection: class MockRTCPeerConnection {
        constructor() {
          throw new Error(
            'No WebRTC implementation available. ' +
            'This should not happen - please report this issue.'
          );
        }
      },
      RTCDataChannel: class MockRTCDataChannel {},
      RTCSessionDescription: class MockRTCSessionDescription {
        constructor(init) {
          this.type = init?.type;
          this.sdp = init?.sdp;
        }
      },
      RTCIceCandidate: class MockRTCIceCandidate {
        constructor(init) {
          this.candidate = init?.candidate;
          this.sdpMLineIndex = init?.sdpMLineIndex;
          this.sdpMid = init?.sdpMid;
        }
      },
      _implementation: 'mock',
      _isFallback: true,
      _error: loadError
    };
  }
}

// Export information about the loaded implementation
wrtc.getImplementationInfo = function() {
  return {
    name: this._implementation,
    isFallback: this._isFallback,
    platform: os.platform(),
    arch: process.arch,
    error: this._error?.message
  };
};

// Log implementation info only in development
log('📊 WebRTC Implementation:', wrtc.getImplementationInfo());

module.exports = wrtc;