// Dynamic P2P Service - loads WebRTC only when needed
const EventEmitter = require('events');

class P2PServiceDynamic extends EventEmitter {
  constructor() {
    super();
    this.wrtc = null;
    this.SimplePeer = null;
    this.isWebRTCLoaded = false;
    this.peers = new Map();
    this.userId = null;
    this.deviceId = null;
  }

  async loadWebRTC() {
    if (this.isWebRTCLoaded) return true;
    
    try {
      console.log('Loading WebRTC modules...');
      
      // Try to load native WebRTC
      try {
        this.wrtc = require('@roamhq/wrtc');
        console.log('Native WebRTC loaded successfully');
      } catch (e) {
        console.log('Native WebRTC not available, P2P features disabled');
        return false;
      }
      
      // Load SimplePeer
      this.SimplePeer = require('simple-peer');
      
      this.isWebRTCLoaded = true;
      console.log('WebRTC modules loaded successfully');
      return true;
    } catch (error) {
      console.error('Failed to load WebRTC:', error);
      return false;
    }
  }

  async initialize(userId, deviceId) {
    this.userId = userId;
    this.deviceId = deviceId;
    
    // Don't load WebRTC until explicitly needed
    console.log('P2P Service initialized (WebRTC not loaded yet)');
  }

  async enableHosting() {
    // Load WebRTC when hosting is enabled
    const loaded = await this.loadWebRTC();
    if (!loaded) {
      throw new Error('WebRTC not available - P2P features disabled');
    }
    
    // Continue with normal hosting logic
    console.log('P2P hosting enabled');
  }

  async connectToPeer(targetUserId) {
    // Load WebRTC when connecting
    const loaded = await this.loadWebRTC();
    if (!loaded) {
      throw new Error('WebRTC not available - cannot connect to peer');
    }
    
    // Continue with connection logic
    console.log('Connecting to peer:', targetUserId);
  }

  // Stub methods for when WebRTC is not loaded
  isHosting() {
    return false;
  }

  getConnectedPeers() {
    return [];
  }

  getStatus() {
    return {
      hosting: false,
      connected: false,
      webrtcAvailable: this.isWebRTCLoaded
    };
  }
}

module.exports = new P2PServiceDynamic();
