/**
 * x86 Architecture Fixes for P2P Service
 * 
 * Known issues on x86 Macs:
 * 1. @roamhq/wrtc may not have proper x86 binaries
 * 2. ICE gathering takes longer on older hardware
 * 3. Connection establishment needs more time
 * 4. Different network stack behavior on Intel Macs
 */

// Detection helper for x86 architecture
function isX86Architecture() {
  const arch = process.arch;
  return arch === 'x64' || arch === 'ia32';
}

// Get optimized timeouts for x86
function getX86Timeouts() {
  if (isX86Architecture()) {
    return {
      CONNECTION_TIMEOUT: 120000,     // 2 minutes (doubled from 60s)
      ICE_GATHERING_TIMEOUT: 30000,   // 30 seconds
      REQUEST_TIMEOUT: 60000,          // 60 seconds
      KEEP_ALIVE_INTERVAL: 10000,      // 10 seconds (doubled from 5s)
      RECONNECT_DELAY: 5000,           // 5 seconds
      SIGNAL_QUEUE_DELAY: 50,          // 50ms between signals
      ICE_CANDIDATE_TIMEOUT: 20000     // 20 seconds for candidate selection
    };
  }
  return {
    CONNECTION_TIMEOUT: 60000,
    ICE_GATHERING_TIMEOUT: 15000,
    REQUEST_TIMEOUT: 30000,
    KEEP_ALIVE_INTERVAL: 5000,
    RECONNECT_DELAY: 2000,
    SIGNAL_QUEUE_DELAY: 10,
    ICE_CANDIDATE_TIMEOUT: 10000
  };
}

// Get optimized ICE configuration for x86
function getX86IceConfig(iceServers) {
  const baseConfig = {
    iceServers,
    iceCandidatePoolSize: isX86Architecture() ? 5 : 10, // Reduced pool for x86
    iceTransportPolicy: 'all',
    bundlePolicy: 'max-bundle',
    rtcpMuxPolicy: 'require',
    iceCandidateSelectionTimeout: isX86Architecture() ? 20000 : 10000
  };

  if (isX86Architecture()) {
    // Additional x86 optimizations
    baseConfig.sdpSemantics = 'unified-plan';
    baseConfig.continualGatheringPolicy = 'gather_once'; // Don't continually gather on x86
    baseConfig.candidateNetworkPolicy = 'all'; // Allow all network types
  }

  return baseConfig;
}

// Fallback WebRTC implementation for x86 when native module fails
class FallbackWebRTC {
  constructor() {
    console.warn('⚠️ Using fallback WebRTC implementation for x86');
    this.supported = false;
  }
}

// Enhanced module loading with x86 fallback
function loadWebRTCModule() {
  let wrtc;
  const arch = process.arch;
  
  try {
    wrtc = require('@roamhq/wrtc');
    console.log(`✅ Native WebRTC module loaded successfully for ${arch}`);
    return wrtc;
  } catch (error) {
    console.warn(`⚠️ Native WebRTC module not available for ${arch}:`, error.message);
    
    if (isX86Architecture()) {
      console.log('🔧 Attempting x86-specific fixes...');
      
      // Try alternative module paths
      const alternativePaths = [
        '@roamhq/wrtc-darwin-x64',
        'wrtc',
        'node-webrtc'
      ];
      
      for (const modulePath of alternativePaths) {
        try {
          wrtc = require(modulePath);
          console.log(`✅ Loaded alternative WebRTC module: ${modulePath}`);
          return wrtc;
        } catch (e) {
          // Continue trying
        }
      }
    }
    
    console.error('❌ No WebRTC module available for P2P connections');
    return undefined;
  }
}

// Export fixes
module.exports = {
  isX86Architecture,
  getX86Timeouts,
  getX86IceConfig,
  loadWebRTCModule,
  FallbackWebRTC
};