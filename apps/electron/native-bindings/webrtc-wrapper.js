/**
 * WebRTC Native Wrapper
 * Provides a wrtc-compatible interface using the custom WebRTC framework
 */

const path = require('path');
const { existsSync } = require('fs');

// Try to load the native binding
let nativeBinding = null;
const bindingPath = path.join(__dirname, '..', 'build', 'Release', 'webrtc_node.node');

if (existsSync(bindingPath)) {
  try {
    nativeBinding = require(bindingPath);
    console.log('✅ Loaded native WebRTC binding');
  } catch (error) {
    console.error('❌ Failed to load native WebRTC binding:', error.message);
  }
}

// Fallback implementation for development
class RTCPeerConnectionFallback {
  constructor(configuration) {
    this.configuration = configuration || {};
    this.localDescription = null;
    this.remoteDescription = null;
    this.signalingState = 'stable';
    this.iceConnectionState = 'new';
    this.iceGatheringState = 'new';
    this.connectionState = 'new';
    this._events = new Map();
    this._iceCandidates = [];
    this._dataChannels = new Map();
  }

  async createOffer(options) {
    const offer = {
      type: 'offer',
      sdp: this._generateSDP('offer')
    };
    return offer;
  }

  async createAnswer(options) {
    if (!this.remoteDescription) {
      throw new Error('Cannot create answer without remote description');
    }
    const answer = {
      type: 'answer',
      sdp: this._generateSDP('answer')
    };
    return answer;
  }

  async setLocalDescription(description) {
    this.localDescription = description;
    this.signalingState = description.type === 'offer' ? 'have-local-offer' : 'stable';
    this._emit('signalingstatechange');
    
    // Simulate ICE gathering
    setTimeout(() => {
      this.iceGatheringState = 'gathering';
      this._emit('icegatheringstatechange');
      
      // Generate some fake ICE candidates
      const candidates = this._generateICECandidates();
      candidates.forEach(candidate => {
        this._emit('icecandidate', { candidate });
      });
      
      setTimeout(() => {
        this.iceGatheringState = 'complete';
        this._emit('icegatheringstatechange');
        this._emit('icecandidate', { candidate: null });
      }, 100);
    }, 50);
  }

  async setRemoteDescription(description) {
    this.remoteDescription = description;
    this.signalingState = description.type === 'offer' ? 'have-remote-offer' : 'stable';
    this._emit('signalingstatechange');
  }

  async addIceCandidate(candidate) {
    if (candidate && candidate.candidate) {
      this._iceCandidates.push(candidate);
    }
  }

  createDataChannel(label, options) {
    const channel = new RTCDataChannelFallback(this, label, options);
    this._dataChannels.set(label, channel);
    return channel;
  }

  close() {
    this.connectionState = 'closed';
    this.iceConnectionState = 'closed';
    this._dataChannels.forEach(channel => channel.close());
    this._emit('connectionstatechange');
    this._emit('iceconnectionstatechange');
  }

  addEventListener(event, handler) {
    if (!this._events.has(event)) {
      this._events.set(event, new Set());
    }
    this._events.get(event).add(handler);
  }

  removeEventListener(event, handler) {
    if (this._events.has(event)) {
      this._events.get(event).delete(handler);
    }
  }

  _emit(event, data) {
    if (this._events.has(event)) {
      this._events.get(event).forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          console.error(`Error in ${event} handler:`, error);
        }
      });
    }
    
    // Also trigger property handlers
    const onHandler = this['on' + event];
    if (typeof onHandler === 'function') {
      try {
        onHandler(data);
      } catch (error) {
        console.error(`Error in on${event} handler:`, error);
      }
    }
  }

  _generateSDP(type) {
    const sessionId = Math.floor(Math.random() * 1000000000);
    return `v=0\r\n` +
           `o=- ${sessionId} 2 IN IP4 127.0.0.1\r\n` +
           `s=-\r\n` +
           `t=0 0\r\n` +
           `a=group:BUNDLE 0\r\n` +
           `a=extmap-allow-mixed\r\n` +
           `a=msid-semantic: WMS\r\n` +
           `m=application 9 UDP/DTLS/SCTP webrtc-datachannel\r\n` +
           `c=IN IP4 0.0.0.0\r\n` +
           `a=ice-ufrag:${this._generateIceUfrag()}\r\n` +
           `a=ice-pwd:${this._generateIcePwd()}\r\n` +
           `a=ice-options:trickle\r\n` +
           `a=fingerprint:sha-256 ${this._generateFingerprint()}\r\n` +
           `a=setup:${type === 'offer' ? 'actpass' : 'active'}\r\n` +
           `a=mid:0\r\n` +
           `a=sctp-port:5000\r\n` +
           `a=max-message-size:262144\r\n`;
  }

  _generateICECandidates() {
    return [
      {
        candidate: 'candidate:1 1 UDP 2122260223 192.168.1.100 54321 typ host',
        sdpMLineIndex: 0,
        sdpMid: '0'
      }
    ];
  }

  _generateIceUfrag() {
    // ICE ufrag should be at least 4 characters
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    let result = '';
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  _generateIcePwd() {
    // ICE pwd must be between 22 and 256 characters
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    let result = '';
    for (let i = 0; i < 24; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  _generateFingerprint() {
    const bytes = [];
    for (let i = 0; i < 32; i++) {
      bytes.push(Math.floor(Math.random() * 256).toString(16).padStart(2, '0'));
    }
    return bytes.join(':').toUpperCase();
  }
}

class RTCDataChannelFallback {
  constructor(peerConnection, label, options) {
    this.label = label;
    this.ordered = options?.ordered !== false;
    this.maxPacketLifeTime = options?.maxPacketLifeTime;
    this.maxRetransmits = options?.maxRetransmits;
    this.protocol = options?.protocol || '';
    this.negotiated = options?.negotiated || false;
    this.id = options?.id ?? Math.floor(Math.random() * 65535);
    this.readyState = 'connecting';
    this.bufferedAmount = 0;
    this.bufferedAmountLowThreshold = 0;
    this.binaryType = 'arraybuffer';
    this._events = new Map();
    this._peerConnection = peerConnection;
    
    // Simulate connection
    setTimeout(() => {
      this.readyState = 'open';
      this._emit('open');
    }, 100);
  }

  send(data) {
    if (this.readyState !== 'open') {
      throw new Error('Failed to execute send on RTCDataChannel: RTCDataChannel is not open');
    }
    
    // In real implementation, this would send through the native channel
    this.bufferedAmount += data.length || data.byteLength || 0;
    
    // Simulate bufferedamountlow event
    if (this.bufferedAmount <= this.bufferedAmountLowThreshold) {
      setTimeout(() => this._emit('bufferedamountlow'), 0);
    }
    
    // Reset buffered amount (simulating successful send)
    setTimeout(() => {
      this.bufferedAmount = 0;
    }, 10);
  }

  close() {
    if (this.readyState === 'closed' || this.readyState === 'closing') {
      return;
    }
    
    this.readyState = 'closing';
    setTimeout(() => {
      this.readyState = 'closed';
      this._emit('close');
    }, 0);
  }

  addEventListener(event, handler) {
    if (!this._events.has(event)) {
      this._events.set(event, new Set());
    }
    this._events.get(event).add(handler);
  }

  removeEventListener(event, handler) {
    if (this._events.has(event)) {
      this._events.get(event).delete(handler);
    }
  }

  _emit(event, data) {
    if (this._events.has(event)) {
      this._events.get(event).forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          console.error(`Error in ${event} handler:`, error);
        }
      });
    }
    
    const onHandler = this['on' + event];
    if (typeof onHandler === 'function') {
      try {
        onHandler(data);
      } catch (error) {
        console.error(`Error in on${event} handler:`, error);
      }
    }
  }
}

// Use native binding if available, otherwise use fallback
const RTCPeerConnection = nativeBinding?.RTCPeerConnection || RTCPeerConnectionFallback;
const RTCDataChannel = nativeBinding?.RTCDataChannel || RTCDataChannelFallback;

// Simple implementations for other classes
class RTCSessionDescription {
  constructor(init) {
    if (init) {
      this.type = init.type;
      this.sdp = init.sdp;
    }
  }
  
  toJSON() {
    return {
      type: this.type,
      sdp: this.sdp
    };
  }
}

class RTCIceCandidate {
  constructor(init) {
    if (init) {
      this.candidate = init.candidate;
      this.sdpMLineIndex = init.sdpMLineIndex;
      this.sdpMid = init.sdpMid;
      this.usernameFragment = init.usernameFragment;
    }
  }
  
  toJSON() {
    return {
      candidate: this.candidate,
      sdpMLineIndex: this.sdpMLineIndex,
      sdpMid: this.sdpMid,
      usernameFragment: this.usernameFragment
    };
  }
}

// Export wrtc-compatible interface
module.exports = {
  RTCPeerConnection,
  RTCDataChannel,
  RTCSessionDescription,
  RTCIceCandidate,
  
  // Additional exports for compatibility
  RTCRtpSender: class RTCRtpSender {},
  RTCRtpReceiver: class RTCRtpReceiver {},
  RTCDtlsTransport: class RTCDtlsTransport {},
  RTCIceTransport: class RTCIceTransport {},
  RTCSctpTransport: class RTCSctpTransport {},
  
  // Media stream classes (stubs for data channel only usage)
  MediaStream: class MediaStream {
    constructor() {
      this.id = Math.random().toString(36).substring(7);
      this.active = false;
    }
    getTracks() { return []; }
    getAudioTracks() { return []; }
    getVideoTracks() { return []; }
  },
  MediaStreamTrack: class MediaStreamTrack {},
  
  // Utility functions
  getUserMedia: async () => { throw new Error('getUserMedia not supported in data channel only mode'); },
  
  // Version info
  version: nativeBinding?.version || '1.0.0-fallback',
  isNativeImplementation: !!nativeBinding
};