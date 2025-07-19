/**
 * Production-safe P2P Service V2 with x86 optimizations
 * This version handles both development and production environments
 */

const io = require('socket.io-client');
const SimplePeer = require('simple-peer');
const webrtcMultiImpl = require('./webrtc-multi-impl');

// Architecture detection
const isX86Architecture = () => {
  const arch = process.arch;
  return arch === 'x64' || arch === 'ia32';
};

// x86-optimized timeouts
const TIMEOUTS = isX86Architecture() ? {
  CONNECTION_TIMEOUT: 120000,     // 2 minutes for x86
  ICE_GATHERING_TIMEOUT: 30000,   // 30 seconds
  REQUEST_TIMEOUT: 60000,          // 60 seconds
  KEEP_ALIVE_INTERVAL: 10000,      // 10 seconds
  RECONNECT_DELAY: 5000,           // 5 seconds
  SIGNAL_QUEUE_DELAY: 50,          // 50ms between signals
  ICE_CANDIDATE_TIMEOUT: 20000     // 20 seconds
} : {
  CONNECTION_TIMEOUT: 60000,       // 1 minute for ARM
  ICE_GATHERING_TIMEOUT: 15000,    // 15 seconds
  REQUEST_TIMEOUT: 30000,          // 30 seconds
  KEEP_ALIVE_INTERVAL: 5000,       // 5 seconds
  RECONNECT_DELAY: 2000,           // 2 seconds
  SIGNAL_QUEUE_DELAY: 10,          // 10ms between signals
  ICE_CANDIDATE_TIMEOUT: 10000     // 10 seconds
};

// Safe WebRTC module loading using the unified loader
let wrtc;
let webrtcAvailable = false;

try {
  // Use the unified WebRTC loader
  wrtc = require('./webrtc-loader');
  if (wrtc && wrtc.RTCPeerConnection) {
    webrtcAvailable = true;
    const implInfo = wrtc.getImplementationInfo ? wrtc.getImplementationInfo() : { name: 'Unknown' };
    if (process.env.NODE_ENV !== 'production') {
      console.log(`✅ WebRTC loaded: ${implInfo.name}`);
    }
  }
} catch (error) {
  if (process.env.NODE_ENV !== 'production') {
    console.warn(`⚠️ Failed to load WebRTC:`, error.message);
  }
}

// Reference to P2P service instance for updating availability
let p2pServiceInstance = null;

// Try multi-implementation WebRTC approach (only for x86 or when native not available)
const tryMultiImplWebRTC = async () => {
  // Skip multi-implementation for ARM64 if native WebRTC is available
  if (webrtcAvailable && !isX86Architecture()) {
    console.log('✅ Native WebRTC available, skipping multi-implementation approach');
    return;
  }
  
  if (!webrtcAvailable) {
    console.log('🔧 Trying multi-implementation WebRTC approach...');
    
    try {
      const success = await webrtcMultiImpl.initialize();
      if (success) {
        webrtcMultiImpl.makeGlobal();
        webrtcAvailable = true;
        const info = webrtcMultiImpl.getImplementationInfo();
        console.log(`✅ WebRTC available via ${info.type}`);
        
        // Update P2P service availability
        if (p2pServiceInstance) {
          p2pServiceInstance.p2pAvailable = true;
          console.log('✅ P2P service updated with WebRTC availability');
        }
        
        // For x86 builds, log success
        if (isX86Architecture()) {
          console.log(`🎉 x86 WebRTC support enabled via ${info.type}`);
        }
      } else {
        console.log('⚠️ Multi-implementation WebRTC initialization failed');
        webrtcAvailable = false;
      }
    } catch (error) {
      console.error('❌ Multi-implementation WebRTC error:', error.message);
      webrtcAvailable = false;
    }
  }
  
  if (!webrtcAvailable) {
    // For production builds without any WebRTC, disable P2P features
    console.log('⚠️ No WebRTC implementation available in this build');
    console.log('💡 P2P features will be disabled for better stability');
    
    // For x86 builds, log additional info
    if (isX86Architecture()) {
      console.log(`💡 Running on x86 - WebRTC available: ${webrtcAvailable}`);
      console.error('❌ x86 build: No working WebRTC implementation found');
      console.error('💡 Consider using the ARM64 build for full P2P support');
    }
  }
};

// Initialize WebRTC async only if needed
if (!webrtcAvailable || isX86Architecture()) {
  tryMultiImplWebRTC().catch(console.error);
}

// Log architecture info (only in development)
if (process.env.NODE_ENV !== 'production') {
  console.log(`🏗️ Running on ${process.arch} architecture`);
  if (isX86Architecture()) {
    console.log('⚙️ x86 optimizations enabled');
    console.log('⏱️ Timeouts:', {
      connection: `${TIMEOUTS.CONNECTION_TIMEOUT / 1000}s`,
      iceGathering: `${TIMEOUTS.ICE_GATHERING_TIMEOUT / 1000}s`,
      request: `${TIMEOUTS.REQUEST_TIMEOUT / 1000}s`
    });
  }
}

// Default config
const defaultConfig = {
  p2p: {
    signalingServerUrl: 'http://localhost:3001'
  },
  webrtc: {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ]
  }
};

// Load config dynamically
const configService = require('./configService');
let config = defaultConfig;

// Config will be loaded dynamically when needed

if (process.env.NODE_ENV !== 'production') {
  console.log('📋 Using config:', { 
    signalingServerUrl: config.p2p?.signalingServerUrl || defaultConfig.p2p.signalingServerUrl,
    iceServers: config.webrtc?.iceServers?.length || defaultConfig.webrtc.iceServers.length
  });
}

let turnService;
try {
  turnService = require('./turnService.js');
  // Clear TURN cache on service load
  if (turnService && turnService.clearCache) {
    turnService.clearCache();
  }
} catch (error) {
  console.warn('⚠️ Failed to load turnService:', error.message);
  // Create a mock turnService
  turnService = {
    getTurnCredentials: async () => null,
    clearCache: () => {}
  };
}

class P2PServiceV2 {
  constructor() {
    this.socket = null;
    this.peers = new Map(); // userId -> SimplePeer instance
    this.connectingPeers = new Set(); // Track peers being connected
    this.pendingSignals = new Map(); // Queue signals while connecting
    this.isHosting = false;
    this.hostingEnabled = false;
    this.currentUserId = null;
    this.authToken = null;
    this.status = 'disconnected';
    this.modelCache = null;
    this.modelCacheTime = 0;
    this.availableModels = []; // Store models for hosting
    this.connectionStats = new Map(); // Track connection statistics
    this._statusDebounceTimer = null; // For debouncing status notifications
    this.p2pAvailable = false; // Will be updated async after WebRTC detection
    this.listeners = {
      status: new Set(),
      hosting: new Set(),
      peer: new Set(),
      request: new Set()
    };
  }

  /**
   * Check if P2P features are available
   */
  isP2PAvailable() {
    return this.p2pAvailable;
  }

  /**
   * Get P2P status with availability check
   */
  getStatus() {
    if (!this.p2pAvailable) {
      return {
        status: 'disabled',
        isHosting: false,
        hostingEnabled: false,
        connectedPeers: 0,
        reason: 'WebRTC not available in this build'
      };
    }
    
    return {
      status: this.status,
      isHosting: this.isHosting,
      hostingEnabled: this.hostingEnabled,
      connectedPeers: this.peers.size
    };
  }

  /**
   * Announce models to signaling server
   */
  _announceModels() {
    if (!this.socket || !this.socket.connected) {
      console.warn('⚠️ Cannot announce models - not connected to signaling server');
      return;
    }
    
    if (!this.hostingEnabled || !this.availableModels.length) {
      console.log('📢 Not announcing models - hosting disabled or no models available');
      return;
    }
    
    console.log(`📢 Announcing ${this.availableModels.length} models to signaling server`);
    
    // Announce models (matching development service format)
    this.socket.emit('announce-models', {
      models: this.availableModels.map(m => ({
        name: typeof m === 'string' ? m : (m.name || m.id),
        displayName: typeof m === 'string' ? m : (m.name || m.id),
        provider: typeof m === 'string' ? 'Ollama' : (m.provider || 'Unknown')
      })),
      batteryState: null,
      deviceInfo: {
        platform: process.platform,
        arch: process.arch,
        type: 'electron',
        nodeVersion: process.versions.node,
        electronVersion: process.versions.electron
      }
    });
    
    // Also emit hosting-status for compatibility
    this.socket.emit('hosting-status', {
      isHosting: true,
      models: this.availableModels,
      deviceInfo: {
        platform: process.platform,
        arch: process.arch,
        type: 'electron'
      }
    });
  }

  /**
   * Get optimized ICE configuration for x86
   */
  getIceConfig(iceServers) {
    const baseConfig = {
      iceServers,
      iceCandidatePoolSize: isX86Architecture() ? 5 : 10,
      iceTransportPolicy: 'all',
      bundlePolicy: 'max-bundle',
      rtcpMuxPolicy: 'require'
    };

    if (isX86Architecture()) {
      // Additional x86 optimizations
      baseConfig.continualGatheringPolicy = 'gather_once';
      baseConfig.candidateSelectionTimeout = TIMEOUTS.ICE_CANDIDATE_TIMEOUT;
    }

    return baseConfig;
  }

  /**
   * Initialize P2P service with user credentials
   */
  async initialize(userId, authToken) {
    console.log('🚀 Initializing P2P service...');
    
    // Check if P2P features are available (webrtcAvailable includes fallback stubs)
    if (!webrtcAvailable) {
      console.log('⚠️ P2P features not available - no WebRTC implementation found');
      this.status = 'disabled';
      this._notifyListeners('status', this.status);
      return Promise.resolve(); // Return success but don't connect
    }
    
    // Update instance availability based on global state
    this.p2pAvailable = webrtcAvailable;
    
    if (this.socket) {
      console.log('♻️ Reinitializing P2P service...');
      await this.disconnect();
    }

    this.currentUserId = userId;
    this.authToken = authToken;
    this.status = 'connecting';
    this._notifyListeners('status', this.status);

    if (!this.currentUserId) {
      console.error('❌ No user ID provided');
      this.status = 'error';
      this._notifyListeners('status', this.status);
      throw new Error('User ID is required');
    }
    
    console.log('👤 Current user ID:', this.currentUserId);

    return this._connectToSignalingServer();
  }

  /**
   * Connect to signaling server
   */
  async _connectToSignalingServer() {
    return new Promise(async (resolve, reject) => {
      // Get dynamic config
      const dynamicConfig = await configService.getConfig();
      const signalingUrl = dynamicConfig.p2p.signalingServerUrl;
      
      if (!signalingUrl) {
        const error = new Error('No signaling server URL configured');
        console.error('❌ Config error:', config);
        reject(error);
        return;
      }
      
      console.log('🔌 Connecting to signaling server:', signalingUrl);
      console.log('🔑 Using auth token:', this.authToken ? `${this.authToken.substring(0, 20)}...` : 'NO TOKEN');
      console.log('👤 Current user ID:', this.currentUserId);
      console.log('🆔 Device ID will be:', this.currentUserId + '_electron');

      this.socket = io(signalingUrl, {
        auth: { 
          token: this.authToken,
          userId: this.currentUserId,
          clientType: 'electron',
          deviceId: this.currentUserId + '_electron'
        },
        transports: ['websocket'],
        reconnection: true,
        reconnectionDelay: TIMEOUTS.RECONNECT_DELAY,
        reconnectionAttempts: 5,
        timeout: 20000
      });

      // Add error event handler
      this.socket.on('error', (error) => {
        console.error('❌ Socket error:', error);
      });

      // Add reconnect handlers
      this.socket.on('reconnect', (attemptNumber) => {
        console.log(`♻️ Reconnected to signaling server after ${attemptNumber} attempts`);
      });

      this.socket.on('reconnect_error', (error) => {
        console.error('❌ Reconnection error:', error.message);
      });

      const connectTimeout = setTimeout(() => {
        console.error('❌ Connection timeout');
        this.socket.disconnect();
        this.status = 'error';
        this._notifyListeners('status', this.status);
        reject(new Error('Connection timeout'));
      }, 30000);

      this.socket.on('connect', () => {
        clearTimeout(connectTimeout);
        console.log('✅ Connected to signaling server');
        console.log('🆔 Socket ID:', this.socket.id);
        this.status = 'connected';
        this._notifyListeners('status', this.status);
        
        // Register user with the server
        this.socket.emit('register', {
          userId: this.currentUserId,
          isHosting: this.hostingEnabled && this.availableModels.length > 0,
          models: this.hostingEnabled ? this.availableModels : [],
          deviceInfo: {
            platform: process.platform,
            arch: process.arch,
            type: 'electron',
            nodeVersion: process.versions.node,
            electronVersion: process.versions.electron
          }
        });
        
        // Also join the account room for this user
        this.socket.emit('join-account');
        
        // If we're hosting, announce it after joining
        if (this.hostingEnabled && this.availableModels.length > 0) {
          setTimeout(() => {
            console.log('📤 Announcing hosting status after connect');
            this._announceModels();
          }, 1000);
        }
        
        // Update hosting status after registering
        if (this.hostingEnabled) {
          setTimeout(() => {
            this._updateHostingStatus(true);
          }, 100);
        }
        
        resolve();
      });

      this.socket.on('connect_error', (error) => {
        console.error('❌ Connection error:', error.message);
        clearTimeout(connectTimeout);
        this.status = 'error';
        this._notifyListeners('status', this.status);
        reject(error);
      });

      this.socket.on('disconnect', (reason) => {
        console.log('🔌 Disconnected from signaling server:', reason);
        this.status = 'disconnected';
        this._notifyListeners('status', this.status);
        
        // Clean up all peer connections
        this.peers.forEach((peer, userId) => {
          console.log(`🧹 Cleaning up peer connection to ${userId}`);
          peer.destroy();
        });
        this.peers.clear();
        this.connectingPeers.clear();
        this.pendingSignals.clear();
      });

      // P2P signaling handlers
      this._setupSignalingHandlers();
      
      // Debug: Log all events from server
      this.socket.onAny((eventName, ...args) => {
        console.log('📨 Received event:', eventName, args.length > 0 ? 'with data' : 'no data');
      });
      
      // Handle models-requested event
      this.socket.on('models-requested', (data) => {
        console.log(`📋 Models requested by ${data?.fromUserId || 'unknown'}`);
        
        if (this.hostingEnabled && this.availableModels.length > 0) {
          console.log('📤 Announcing models to signaling server:', this.availableModels.length);
          
          // Announce models to signaling server (same as development)
          this.socket.emit('announce-models', {
            models: this.availableModels.map(m => ({
              name: typeof m === 'string' ? m : m.name,
              provider: typeof m === 'string' ? 'Ollama' : (m.provider || 'Unknown')
            })),
            batteryState: null, // TODO: Implement battery state if needed
            deviceInfo: {
              platform: process.platform,
              arch: process.arch,
              type: 'electron',
              nodeVersion: process.versions.node,
              electronVersion: process.versions.electron
            }
          });
        }
      });
      
      // Handle existing-peers event (when we join)
      this.socket.on('existing-peers', (peers) => {
        console.log(`👥 Existing peers in room: ${peers?.length || 0}`);
        // This is informational - we don't need to do anything with it
      });
      
      // Handle peer-joined event
      this.socket.on('peer-joined', (peerInfo) => {
        console.log(`👤 New peer joined: ${peerInfo?.userId || 'unknown'}`);
        
        // If we're hosting and a new peer joins, announce our models
        if (this.hostingEnabled && this.availableModels.length > 0) {
          setTimeout(() => {
            console.log('📤 Announcing models to new peer');
            this._announceModels();
          }, 500);
        }
      });
      
      // Handle peer-left event
      this.socket.on('peer-left', (peerInfo) => {
        console.log(`👤 Peer left: ${peerInfo?.userId || 'unknown'}`);
      });
    });
  }

  /**
   * Create peer connection with optimized settings
   */
  async _createPeer(userId, isInitiator) {
    console.log(`🔗 Creating ${isInitiator ? 'outgoing' : 'incoming'} peer connection to ${userId}`);
    
    // Check if WebRTC is available
    if (!webrtcAvailable) {
      const error = new Error('WebRTC not available on this system. P2P connections require WebRTC support. Please ensure your Electron build includes WebRTC support or install a WebRTC package.');
      console.error('❌ Cannot create peer connection:', error.message);
      console.error('💡 For x86 builds, try: npm install @roamhq/wrtc');
      console.error('💡 Or ensure Electron is built with WebRTC support');
      throw error;
    }

    // No WebRTC shim - fail fast if WebRTC is not available
    
    // Mark as connecting to avoid duplicates
    this.connectingPeers.add(userId);
    
    try {
      // Get TURN servers with caching
      let iceServers = [...config.webrtc.iceServers];
      
      try {
        const turnServers = await turnService.getTurnServers(this.authToken);
        if (turnServers && turnServers.length > 0) {
          iceServers = [...iceServers, ...turnServers];
          console.log('🔐 Using TURN servers:', turnServers.length);
        }
      } catch (error) {
        console.warn('⚠️ Failed to get TURN servers, using STUN only:', error.message);
      }

      // Create peer configuration
      const peerConfig = {
        initiator: isInitiator,
        trickle: true,
        config: this.getIceConfig(iceServers),
        offerOptions: {
          offerToReceiveAudio: false,
          offerToReceiveVideo: false
        },
        answerOptions: {
          offerToReceiveAudio: false,
          offerToReceiveVideo: false
        },
        // Always include wrtc from the loader (includes fallback)
        wrtc
      };

      // Additional x86 optimizations
      if (isX86Architecture()) {
        peerConfig.reconnectTimer = TIMEOUTS.RECONNECT_DELAY;
        peerConfig.iceCompleteTimeout = TIMEOUTS.ICE_GATHERING_TIMEOUT;
        peerConfig.channelConfig = {
          ordered: true,
          maxRetransmits: 15  // More retransmits for reliability
        };
      }

      const peer = new SimplePeer(peerConfig);
      
      // Set up peer event handlers
      this._setupPeerHandlers(peer, userId);
      
      // Store peer connection
      this.peers.set(userId, peer);
      
      // Process any queued signals
      const queuedSignals = this.pendingSignals.get(userId);
      if (queuedSignals && queuedSignals.length > 0) {
        console.log(`📬 Processing ${queuedSignals.length} queued signals for ${userId}`);
        
        // Process signals with delay for x86
        const signalDelay = TIMEOUTS.SIGNAL_QUEUE_DELAY;
        for (const signal of queuedSignals) {
          await new Promise(resolve => setTimeout(resolve, signalDelay));
          try {
            peer.signal(signal);
          } catch (error) {
            console.error(`❌ Error processing queued signal:`, error);
          }
        }
        this.pendingSignals.delete(userId);
      }
      
      // Set connection timeout
      const timeoutId = setTimeout(() => {
        if (!peer.connected && !peer.destroyed) {
          console.error(`❌ Connection timeout for ${userId}`);
          this._handlePeerError(userId, new Error('Connection timeout'));
        }
      }, TIMEOUTS.CONNECTION_TIMEOUT);
      
      // Clear timeout on successful connection
      peer.once('connect', () => clearTimeout(timeoutId));
      
      return peer;
    } catch (error) {
      console.error(`❌ Failed to create peer for ${userId}:`, error);
      this.connectingPeers.delete(userId);
      this.peers.delete(userId);
      throw error;
    }
  }

  /**
   * Setup peer event handlers
   */
  _setupPeerHandlers(peer, userId) {
    let keepAliveInterval;
    let iceGatheringTimeout;

    // Track ICE gathering state
    let iceGatheringComplete = false;
    
    peer.on('signal', (data) => {
      console.log(`📤 Sending signal to ${userId}: ${data.type || 'candidate'}`);
      // Use webrtc-signal format for compatibility with web clients
      this.socket.emit('webrtc-signal', { 
        targetUserId: userId, 
        signal: data 
      });
    });

    peer.on('connect', () => {
      console.log(`✅ Connected to peer ${userId}`);
      this.connectingPeers.delete(userId);
      
      // Clear ICE gathering timeout
      if (iceGatheringTimeout) {
        clearTimeout(iceGatheringTimeout);
      }
      
      // Update connection stats
      this.connectionStats.set(userId, {
        connectedAt: Date.now(),
        messagesReceived: 0,
        lastActivity: Date.now()
      });
      
      // Notify listeners
      this._notifyListeners('peer', { action: 'connected', userId });
      
      // Set up keep-alive with x86-optimized interval
      keepAliveInterval = setInterval(() => {
        if (peer.connected) {
          try {
            peer.send(JSON.stringify({ type: 'ping' }));
          } catch (error) {
            console.error(`❌ Keep-alive failed for ${userId}:`, error);
          }
        }
      }, TIMEOUTS.KEEP_ALIVE_INTERVAL);
    });

    // Set ICE gathering timeout for x86
    if (isX86Architecture()) {
      iceGatheringTimeout = setTimeout(() => {
        if (!iceGatheringComplete && !peer.connected) {
          console.warn(`⚠️ ICE gathering timeout for ${userId}`);
          // Don't destroy, just log warning
        }
      }, TIMEOUTS.ICE_GATHERING_TIMEOUT);
    }

    peer.on('iceStateChange', (state) => {
      console.log(`🧊 ICE state changed for ${userId}: ${state}`);
      if (state === 'completed' || state === 'connected') {
        iceGatheringComplete = true;
        if (iceGatheringTimeout) {
          clearTimeout(iceGatheringTimeout);
        }
      }
    });

    peer.on('data', async (data) => {
      try {
        const message = JSON.parse(data);
        
        // Update stats
        const stats = this.connectionStats.get(userId);
        if (stats) {
          stats.messagesReceived++;
          stats.lastActivity = Date.now();
        }
        
        // Handle different message types
        if (message.type === 'ping') {
          peer.send(JSON.stringify({ type: 'pong' }));
        } else if (message.type === 'pong') {
          // Keep-alive response received
        } else {
          // Handle request/response messages
          console.log(`📥 Received ${message.type} from ${userId}`);
          
          try {
            const response = await this._handlePeerMessage(message, userId);
            
            // Send response immediately
            if (response && message.requestId) {
              try {
                await this.sendToPeer(userId, {
                  type: 'response',
                  requestId: message.requestId,
                  data: response
                });
                console.log(`✅ Sent response to ${userId} for ${message.type}`);
              } catch (error) {
                console.error(`❌ Failed to send response to ${userId}:`, error);
              }
            }
          } catch (error) {
            // Send error response back to peer
            console.error(`❌ Error handling ${message.type} from ${userId}:`, error);
            if (message.requestId) {
              try {
                await this.sendToPeer(userId, {
                  type: 'error',
                  requestId: message.requestId,
                  error: error.message || error.toString()
                });
                console.log(`📤 Sent error response to ${userId} for ${message.type}`);
              } catch (sendError) {
                console.error(`❌ Failed to send error response to ${userId}:`, sendError);
              }
            }
          }
        }
      } catch (error) {
        console.error(`❌ Error handling peer data from ${userId}:`, error);
      }
    });

    peer.on('error', (error) => {
      console.error(`❌ Peer error for ${userId}:`, error.message);
      if (keepAliveInterval) clearInterval(keepAliveInterval);
      if (iceGatheringTimeout) clearTimeout(iceGatheringTimeout);
      this._handlePeerError(userId, error);
    });

    peer.on('close', () => {
      console.log(`🔌 Peer connection closed for ${userId}`);
      if (keepAliveInterval) clearInterval(keepAliveInterval);
      if (iceGatheringTimeout) clearTimeout(iceGatheringTimeout);
      this._handlePeerClose(userId);
    });
  }

  /**
   * Handle WebRTC signal from any source
   */
  async _handleWebRTCSignal(fromUserId, signal) {
    try {
      let peer = this.peers.get(fromUserId);
      
      if (!peer) {
        if (signal.type === 'offer') {
          // Create new peer for incoming connection
          console.log(`📞 Incoming connection from ${fromUserId}`);
          peer = await this._createPeer(fromUserId, false);
        } else {
          // Queue signal if peer doesn't exist yet
          console.log(`📬 Queueing signal for ${fromUserId}`);
          if (!this.pendingSignals.has(fromUserId)) {
            this.pendingSignals.set(fromUserId, []);
          }
          this.pendingSignals.get(fromUserId).push(signal);
          return;
        }
      }
      
      // Process signal
      if (!peer.destroyed) {
        peer.signal(signal);
      }
    } catch (error) {
      console.error(`❌ Error handling WebRTC signal from ${fromUserId}:`, error);
    }
  }

  /**
   * Setup signaling handlers
   */
  _setupSignalingHandlers() {
    // Handle incoming signals (both legacy 'signal' and new 'webrtc-signal' events)
    this.socket.on('signal', async ({ from, signal }) => {
      console.log(`📥 Received legacy signal from ${from}: ${signal.type || 'candidate'}`);
      await this._handleWebRTCSignal(from, signal);
    });

    // Handle WebRTC signals (new format from web clients)
    this.socket.on('webrtc-signal', async (data) => {
      const { fromUserId, signal } = data;
      console.log(`📥 Received webrtc-signal from ${fromUserId}: ${signal.type || 'candidate'}`);
      await this._handleWebRTCSignal(fromUserId, signal);
    });

    // Handle peer updates
    this.socket.on('peers', (peers) => {
      console.log(`👥 Received peer list:`, peers.map(p => p.userId));
      
      // Update hosting status based on peer list
      const myPeer = peers.find(p => p.userId === this.currentUserId);
      if (myPeer) {
        this.isHosting = myPeer.isHosting;
        this._notifyListeners('hosting', { 
          enabled: this.hostingEnabled, 
          active: this.isHosting,
          models: myPeer.models || []
        });
      }
      
      // Store peers list
      this._notifyListeners('peer', { action: 'list', peers });
    });
    
    // Handle request for peer list (from web clients)
    this.socket.on('request-peer-list', (requesterId) => {
      console.log('📋 Received request for peer list from:', requesterId || 'server');
      
      // The server should handle aggregating peers, but we'll emit our status
      if (this.hostingEnabled && this.availableModels.length > 0) {
        console.log('📤 Broadcasting our hosting status with models:', this.availableModels.length);
        
        // Emit our hosting status so server can include us in the peer list
        this.socket.emit('hosting-status', {
          isHosting: true,
          models: this.availableModels || [],
          deviceInfo: {
            platform: process.platform,
            arch: process.arch,
            type: 'electron'
          }
        });
      }
    });
    
    // Handle join-account from web clients
    this.socket.on('join-account', () => {
      console.log('📋 Web client joined account room');
      
      // Send our hosting status if we're hosting
      if (this.hostingEnabled && this.availableModels.length > 0) {
        setTimeout(() => {
          console.log('📤 Sending hosting status to new web client');
          this.socket.emit('hosting-status', {
            isHosting: true,
            models: this.availableModels || [],
            deviceInfo: {
              platform: process.platform,
              arch: process.arch,
              type: 'electron'
            }
          });
        }, 100);
      }
    });

    // Handle hosting status updates
    this.socket.on('hostingStatus', ({ userId, isHosting, models }) => {
      console.log(`🏠 Hosting status update for ${userId}: ${isHosting}`);
      
      if (userId === this.currentUserId) {
        this.isHosting = isHosting;
        this._notifyListeners('hosting', { 
          enabled: this.hostingEnabled, 
          active: this.isHosting,
          models: models || []
        });
      }
    });
  }

  /**
   * Send message to peer with timeout
   */
  async sendToPeer(userId, message) {
    const peer = this.peers.get(userId);
    
    if (!peer || !peer.connected) {
      throw new Error(`Not connected to peer ${userId}`);
    }
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Send timeout'));
      }, 5000);
      
      try {
        peer.send(JSON.stringify(message));
        clearTimeout(timeout);
        resolve();
      } catch (error) {
        clearTimeout(timeout);
        reject(error);
      }
    });
  }

  /**
   * Request data from peer with x86-optimized timeout
   */
  async requestFromPeer(userId, type, data = {}) {
    const requestId = Math.random().toString(36).substring(7);
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.socket.off(`response:${requestId}`);
        reject(new Error(`Request timeout for ${type}`));
      }, TIMEOUTS.REQUEST_TIMEOUT);
      
      // Listen for response
      this.socket.once(`response:${requestId}`, (response) => {
        clearTimeout(timeout);
        resolve(response);
      });
      
      // Send request
      this.sendToPeer(userId, {
        type,
        requestId,
        data
      }).catch((error) => {
        clearTimeout(timeout);
        this.socket.off(`response:${requestId}`);
        reject(error);
      });
    });
  }

  /**
   * Handle incoming peer messages
   */
  async _handlePeerMessage(message, fromUserId) {
    console.log(`🔍 Handling ${message.type} from ${fromUserId}`);
    
    // Notify listeners about the request
    const result = await this._notifyListenersAsync('request', {
      type: message.type,
      data: message.data,
      fromUserId,
      requestId: message.requestId
    });
    
    return result;
  }

  /**
   * Handle peer errors
   */
  _handlePeerError(userId, error) {
    console.error(`❌ Peer error for ${userId}:`, error.message);
    
    const peer = this.peers.get(userId);
    if (peer && !peer.destroyed) {
      peer.destroy();
    }
    
    this.peers.delete(userId);
    this.connectingPeers.delete(userId);
    this.connectionStats.delete(userId);
    
    this._notifyListeners('peer', { action: 'error', userId, error: error.message });
  }

  /**
   * Handle peer close
   */
  _handlePeerClose(userId) {
    this.peers.delete(userId);
    this.connectingPeers.delete(userId);
    this.connectionStats.delete(userId);
    
    this._notifyListeners('peer', { action: 'disconnected', userId });
  }

  /**
   * Connect to a specific peer
   */
  async connectToPeer(userId) {
    console.log(`🔗 Connecting to peer ${userId}...`);
    
    // Check if already connected or connecting
    if (this.peers.has(userId)) {
      const peer = this.peers.get(userId);
      if (peer.connected) {
        console.log(`✅ Already connected to ${userId}`);
        return;
      }
      if (!peer.destroyed) {
        console.log(`⏳ Already connecting to ${userId}`);
        return;
      }
    }
    
    if (this.connectingPeers.has(userId)) {
      console.log(`⏳ Already connecting to ${userId}`);
      return;
    }
    
    try {
      await this._createPeer(userId, true);
    } catch (error) {
      console.error(`❌ Failed to connect to ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Disconnect from a specific peer
   */
  disconnectFromPeer(userId) {
    const peer = this.peers.get(userId);
    if (peer) {
      console.log(`🔌 Disconnecting from peer ${userId}`);
      peer.destroy();
      this.peers.delete(userId);
      this.connectingPeers.delete(userId);
      this.connectionStats.delete(userId);
    }
  }

  /**
   * Update hosting status
   */
  async setHostingEnabled(enabled, models = []) {
    console.log(`🏠 Setting hosting enabled: ${enabled}`);
    console.log(`📊 Socket status: ${this.socket ? (this.socket.connected ? 'connected' : 'disconnected') : 'not initialized'}`);
    console.log(`📊 Service status: ${this.status}`);
    
    // Check if WebRTC is available for P2P hosting
    if (enabled && !webrtcAvailable) {
      console.warn('⚠️ Cannot enable P2P hosting: WebRTC not available');
      console.warn('💡 P2P hosting requires WebRTC support for peer connections');
      // Don't throw error, just warn and continue with hosting disabled
      enabled = false;
    }
    
    this.hostingEnabled = enabled;
    this.isHosting = enabled; // Update local state immediately
    this.availableModels = models || []; // Store models
    
    // Immediately notify listeners of the state change
    this._notifyListeners('hosting', { 
      enabled: enabled, 
      active: enabled,
      models: enabled ? models : []
    });
    
    // Update server state in background (don't await)
    if (this.socket && this.socket.connected) {
      this._updateHostingStatus(enabled, models).catch(error => {
        console.error('❌ Failed to update hosting status on server:', error);
        // Server update failed, but local state is already updated
      });
      
      // Also announce models if enabling
      if (enabled && models.length > 0) {
        setTimeout(() => {
          this._announceModels();
        }, 100);
      }
    } else {
      console.log('⚠️ Not connected to signaling server, local state updated only');
    }
    
    // Return immediately for instant UI response
    return Promise.resolve();
  }

  /**
   * Update hosting status on server
   */
  async _updateHostingStatus(enabled, models = []) {
    if (!this.socket || !this.socket.connected) {
      console.warn('⚠️ Cannot update hosting status: not connected to signaling server');
      // State already updated in setHostingEnabled
      return;
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        console.warn('⚠️ Update hosting timeout - no response from server after 5s');
        // Don't update local state here - it's already updated in setHostingEnabled
        resolve(); // Resolve to complete the background operation
      }, 5000); // Reduced timeout to 5 seconds
      
      console.log('📤 Emitting updateHosting event:', { isHosting: enabled, models: models?.length || 0 });
      
      // Send without expecting response callback
      this.socket.emit('updateHosting', {
        isHosting: enabled,
        models: enabled ? models : []
      });
      
      // Also emit hosting-status for compatibility
      this.socket.emit('hosting-status', {
        isHosting: enabled,
        models: enabled ? models : [],
        deviceInfo: {
          platform: process.platform,
          arch: process.arch,
          type: 'electron'
        }
      });
      
      // Resolve immediately since we don't wait for server response
      clearTimeout(timeout);
      console.log(`✅ Hosting status sent: ${enabled}`);
      resolve();
    });
  }

  /**
   * Get connected peers
   */
  getConnectedPeers() {
    const connected = [];
    this.peers.forEach((peer, userId) => {
      if (peer.connected) {
        connected.push(userId);
      }
    });
    return connected;
  }

  /**
   * Get current P2P service status
   */
  getStatus() {
    const connectedPeersList = this.getConnectedPeers();
    return {
      status: this.status,
      isHosting: this.isHosting,
      hostingEnabled: this.hostingEnabled,
      currentUserId: this.currentUserId,
      connectedPeers: connectedPeersList.length,
      connectedPeersList: connectedPeersList,
      peersCount: this.peers.size
    };
  }

  /**
   * Disconnect from signaling server
   */
  async disconnect() {
    console.log('🔌 Disconnecting P2P service...');
    
    // Clean up all peer connections
    this.peers.forEach((peer, userId) => {
      console.log(`🧹 Cleaning up peer connection to ${userId}`);
      peer.destroy();
    });
    this.peers.clear();
    this.connectingPeers.clear();
    this.pendingSignals.clear();
    this.connectionStats.clear();
    
    // Disconnect from signaling server
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    
    this.status = 'disconnected';
    this.isHosting = false;
    this._notifyListeners('status', this.status);
    this._notifyListeners('hosting', { 
      enabled: false, 
      active: false,
      models: []
    });
  }

  /**
   * Add event listener
   */
  on(event, callback) {
    if (this.listeners[event]) {
      this.listeners[event].add(callback);
    }
  }

  /**
   * Remove event listener
   */
  off(event, callback) {
    if (this.listeners[event]) {
      this.listeners[event].delete(callback);
    }
  }

  /**
   * Notify listeners with debouncing for status events
   */
  _notifyListeners(event, data) {
    if (this.listeners[event]) {
      // Debounce status notifications to prevent loops
      if (event === 'status') {
        if (this._statusDebounceTimer) {
          clearTimeout(this._statusDebounceTimer);
        }
        this._statusDebounceTimer = setTimeout(() => {
          this.listeners[event].forEach(callback => {
            try {
              callback(data);
            } catch (error) {
              console.error(`Error in ${event} listener:`, error);
            }
          });
        }, 100); // 100ms debounce
      } else {
        this.listeners[event].forEach(callback => {
          try {
            callback(data);
          } catch (error) {
            console.error(`Error in ${event} listener:`, error);
          }
        });
      }
    }
  }

  /**
   * Notify listeners async
   */
  async _notifyListenersAsync(event, data) {
    if (this.listeners[event]) {
      for (const callback of this.listeners[event]) {
        try {
          const result = await callback(data);
          if (result !== undefined) {
            return result;
          }
        } catch (error) {
          console.error(`Error in ${event} listener:`, error);
          // Re-throw the error so it can be handled by the peer communication
          throw error;
        }
      }
    }
    return null;
  }

  /**
   * Shutdown P2P service (alias for disconnect)
   */
  async shutdown() {
    console.log('🔌 Shutting down P2P service...');
    return this.disconnect();
  }

  /**
   * Disable hosting (alias for setHostingEnabled(false))
   */
  async disableHosting() {
    console.log('🔴 Disabling hosting via legacy method...');
    return this.setHostingEnabled(false);
  }

  /**
   * Enable hosting (alias for setHostingEnabled(true))
   */
  async enableHosting() {
    console.log('🟢 Enabling hosting via legacy method...');
    return this.setHostingEnabled(true);
  }
}

// Create singleton instance
const p2pService = new P2PServiceV2();

// Set reference for async WebRTC updates
p2pServiceInstance = p2pService;

module.exports = p2pService;