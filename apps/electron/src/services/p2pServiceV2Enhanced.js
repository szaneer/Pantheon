/**
 * Enhanced P2P Service V2 for Electron with improved TURN handling
 * This version includes better mobile network support and debugging
 */

const io = require('socket.io-client');
const SimplePeer = require('simple-peer');
const wrtc = require('./webrtc-loader');
const config = require('../../config.js');
const turnService = require('./turnService.js');

class P2PServiceV2Enhanced {
  constructor() {
    this.socket = null;
    this.peers = new Map(); // userId -> SimplePeer instance
    this.connectingPeers = new Set(); // Track peers being connected to avoid duplicates
    this.pendingSignals = new Map(); // Queue signals while connecting
    this.isHosting = false;
    this.hostingEnabled = false;
    this.currentUserId = null;
    this.authToken = null;
    this.status = 'disconnected';
    this.modelCache = null;
    this.modelCacheTime = 0;
    this.connectionStats = new Map(); // Track connection statistics
    this.listeners = {
      status: new Set(),
      hosting: new Set(),
      peer: new Set(),
      request: new Set()
    };
  }

  /**
   * Initialize P2P service with user credentials
   */
  async initialize(userId, authToken) {
    console.log('🔧 P2P Service Enhanced: initialize() called');
    console.log('👤 Setting userId:', userId);
    console.log('🔑 Setting authToken:', authToken ? '***present***' : 'missing');
    
    this.currentUserId = userId;
    this.authToken = authToken;
    
    // Always connect to signaling server to discover peers and their models
    console.log('🌐 Connecting to P2P network to discover peers...');
    await this.connectToSignalingServer();
    
    console.log('🔍 Current hosting state:', this.hostingEnabled);
    if (this.hostingEnabled) {
      console.log('🚀 Hosting enabled, starting hosting...');
      await this.startHosting();
    } else {
      console.log('📴 Hosting not enabled, but connected to discover other peers');
    }
  }

  /**
   * Enable one-click model hosting
   */
  async enableHosting() {
    console.log('🟢 P2P Service Enhanced: enableHosting() called');
    console.log('🔍 Current state:', {
      hostingEnabled: this.hostingEnabled,
      currentUserId: this.currentUserId,
      authToken: this.authToken ? '***present***' : 'missing',
      status: this.status
    });
    
    if (this.hostingEnabled) {
      console.log('⚠️ Hosting already enabled');
      return;
    }
    
    this.hostingEnabled = true;
    this.notifyListeners('hosting', { enabled: true });
    
    if (this.currentUserId) {
      console.log('🚀 Starting hosting with userId:', this.currentUserId);
      await this.startHosting();
    } else {
      console.log('⚠️ No currentUserId set, hosting will start when user signs in');
    }
  }

  /**
   * Disable model hosting
   */
  async disableHosting() {
    this.hostingEnabled = false;
    this.notifyListeners('hosting', { enabled: false });
    
    if (this.isHosting) {
      await this.stopHosting();
    }
  }

  /**
   * Start hosting models
   */
  async startHosting() {
    console.log('🚀 P2P Service Enhanced: startHosting() called');
    
    if (this.isHosting) {
      console.log('⚠️ Already hosting');
      return;
    }
    
    try {
      console.log('📡 Updating status to connecting...');
      this.updateStatus('connecting', 'Starting model hosting...');
      
      // Connect to signaling server if not already connected
      if (!this.socket || !this.socket.connected) {
        console.log('🔗 Attempting to connect to signaling server...');
        await this.connectToSignalingServer();
        console.log('✅ Successfully connected to signaling server');
      } else {
        console.log('✅ Already connected to signaling server');
      }
      
      console.log('🤖 Checking available models...');
      // Verify Ollama is running
      const models = await this.getAvailableModels();
      console.log(`📋 Found ${models.length} models:`, models.map(m => m.name || m));
      
      if (models.length === 0) {
        throw new Error('No models available. Please ensure Ollama is running.');
      }
      
      this.isHosting = true;
      console.log('📡 Updating status to hosting...');
      this.updateStatus('hosting', `Hosting ${models.length} models`);
      this.notifyListeners('hosting', { 
        enabled: true, 
        active: true, 
        models 
      });
      
      console.log(`✅ Model hosting started with ${models.length} models`);
      
      // Connect to any existing peers in the room
      console.log('🔍 Checking for existing peers to connect to...');
      this.socket?.emit('request-peer-list');
      
    } catch (error) {
      console.error('❌ Failed to start hosting:', error);
      this.updateStatus('error', error.message);
      throw error;
    }
  }

  /**
   * Stop hosting models
   */
  async stopHosting() {
    this.isHosting = false;
    
    // Disconnect from signaling server
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    
    // Close all peer connections
    this.peers.forEach(peer => peer.destroy());
    this.peers.clear();
    
    this.updateStatus('disconnected', 'Model hosting stopped');
    this.notifyListeners('hosting', { 
      enabled: this.hostingEnabled, 
      active: false 
    });
  }

  /**
   * Connect to the Socket.io signaling server
   */
  async connectToSignalingServer() {
    return new Promise((resolve, reject) => {
      const serverUrl = config.p2p?.signalingServerUrl || 'http://localhost:3001';
      console.log('🌐 Connecting to signaling server:', serverUrl);
      console.log('🔑 Auth token present:', this.authToken ? 'yes' : 'no');
      console.log('👤 Current user ID:', this.currentUserId);
      console.log('🆔 Device ID will be:', this.currentUserId + '_electron');
      
      if (!this.authToken) {
        const error = new Error('No auth token available for signaling server');
        console.error('❌', error.message);
        reject(error);
        return;
      }
      
      this.socket = io(serverUrl, {
        auth: { 
          token: this.authToken,
          clientType: 'electron',
          deviceId: this.currentUserId + '_electron'
        },
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 2000,
        // Add ngrok header for now - remove this when not using ngrok
        extraHeaders: {
          'ngrok-skip-browser-warning': 'true'
        },
        // Try polling transport first for debugging
        transports: ['polling', 'websocket']
      });
      
      console.log('📡 Socket.io connection initiated...');
      
      this.socket.on('connect', () => {
        console.log('✅ Connected to signaling server, socket ID:', this.socket.id);
        console.log('🏠 Emitting join-account event...');
        this.socket.emit('join-account');
        
        // Update status to connected (but not necessarily hosting)
        this.updateStatus('connected', 'Connected to P2P network');
        resolve();
      });
      
      this.socket.on('connect_error', (error) => {
        console.error('❌ Connection error:', error);
        reject(error);
      });
      
      // Add timeout to detect if connection is hanging
      const timeout = setTimeout(() => {
        console.error('❌ Connection timeout after 10 seconds');
        reject(new Error('Connection timeout'));
      }, 10000);
      
      this.socket.on('connect', () => {
        clearTimeout(timeout);
      });
      
      this.setupSocketHandlers();
    });
  }

  /**
   * Setup Socket.io event handlers
   */
  setupSocketHandlers() {
    // Handle new peer joining
    this.socket.on('peer-joined', (peerInfo) => {
      console.log('👤 New peer joined:', peerInfo.userId);
      this.notifyListeners('peer', { type: 'joined', peer: peerInfo });
      
      // As a host, initiate WebRTC connection to new peer
      console.log(`🔍 Checking if should connect: isHosting=${this.isHosting}, peerId=${peerInfo.userId}, currentUserId=${this.currentUserId}`);
      if (this.isHosting && peerInfo.userId !== this.currentUserId) {
        // Check if we already have a connection or are connecting
        if (!this.peers.has(peerInfo.userId) && !this.connectingPeers.has(peerInfo.userId)) {
          console.log('🔗 Initiating WebRTC connection to new peer:', peerInfo.userId);
          this.connectingPeers.add(peerInfo.userId);
          this.createPeerConnection(peerInfo.userId, true)
            .then(() => {
              this.connectingPeers.delete(peerInfo.userId);
            })
            .catch(error => {
              console.error(`❌ Failed to create peer connection to ${peerInfo.userId}:`, error);
              this.connectingPeers.delete(peerInfo.userId);
            });
        } else {
          console.log(`⏭️ Skipping connection: already connected or connecting to ${peerInfo.userId}`);
        }
      } else {
        console.log(`⏭️ Not initiating connection: isHosting=${this.isHosting}, isSelf=${peerInfo.userId === this.currentUserId}`);
      }
    });
    
    // Handle existing peers
    this.socket.on('existing-peers', (peers) => {
      console.log(`👥 ${peers.length} existing peers in room`);
      peers.forEach(peer => {
        this.notifyListeners('peer', { type: 'existing', peer });
        
        // As a host, initiate WebRTC connection to existing peers
        console.log(`🔍 Checking if should connect to existing peer: isHosting=${this.isHosting}, peerId=${peer.userId}, currentUserId=${this.currentUserId}`);
        if (this.isHosting && peer.userId !== this.currentUserId) {
          // Check if we already have a connection or are connecting
          if (!this.peers.has(peer.userId) && !this.connectingPeers.has(peer.userId)) {
            console.log('🔗 Initiating WebRTC connection to existing peer:', peer.userId);
            this.connectingPeers.add(peer.userId);
            this.createPeerConnection(peer.userId, true)
              .then(() => {
                this.connectingPeers.delete(peer.userId);
              })
              .catch(error => {
                console.error(`❌ Failed to create peer connection to ${peer.userId}:`, error);
                this.connectingPeers.delete(peer.userId);
              });
          }
        }
      });
    });
    
    // Handle WebRTC signals
    this.socket.on('webrtc-signal', async (data) => {
      await this.handleWebRTCSignal(data);
    });
    
    // Handle peer leaving
    this.socket.on('peer-left', (peerInfo) => {
      console.log('👤 Peer left:', peerInfo.userId);
      this.closePeerConnection(peerInfo.userId);
      this.notifyListeners('peer', { type: 'left', peer: peerInfo });
    });
    
    // Handle disconnection
    this.socket.on('disconnect', (reason) => {
      console.log('🔌 Disconnected from signaling server:', reason);
      console.log('🔧 Will attempt to reconnect to maintain P2P discovery...');
      
      // Always try to reconnect to maintain peer discovery, not just when hosting
      if (reason !== 'io client disconnect') {
        this.updateStatus('reconnecting', 'Connection lost, reconnecting...');
      } else {
        this.updateStatus('disconnected', 'Manually disconnected');
      }
    });
    
    // Handle reconnection
    this.socket.on('reconnect', () => {
      console.log('🔄 Reconnected to signaling server');
      // Rejoin the account room
      this.socket.emit('join-account');
      
      if (this.isHosting) {
        this.updateStatus('hosting', 'Model hosting resumed');
      } else {
        this.updateStatus('connected', 'Reconnected to P2P network');
      }
    });
    
    // Handle peer discovery requests
    this.socket.on('request-peer-list', () => {
      console.log('📋 Received request-peer-list event');
      // The signaling server should handle this, but we can log it
    });
  }

  /**
   * Handle incoming WebRTC signal with better queueing
   */
  async handleWebRTCSignal(data) {
    const { fromUserId, signal } = data;
    console.log(`📡 Received WebRTC signal from ${fromUserId}, type: ${signal.type || 'ice-candidate'}`);
    
    let peer = this.peers.get(fromUserId);
    
    if (!peer || peer.destroyed) {
      // Check if we're already connecting to this peer
      if (this.connectingPeers.has(fromUserId)) {
        console.log(`⏳ Already connecting to ${fromUserId}, queueing signal...`);
        
        // Queue the signal
        if (!this.pendingSignals.has(fromUserId)) {
          this.pendingSignals.set(fromUserId, []);
        }
        this.pendingSignals.get(fromUserId).push(signal);
        return;
      }
      
      if (!peer || peer.destroyed) {
        // Only create new peer if we don't have one or it's destroyed
        console.log(`🔗 Creating peer connection for incoming signal from ${fromUserId}`);
        this.connectingPeers.add(fromUserId);
        try {
          peer = await this.createPeerConnection(fromUserId, false);
          this.connectingPeers.delete(fromUserId);
          
          // Process any pending signals
          const pendingSignals = this.pendingSignals.get(fromUserId);
          if (pendingSignals && pendingSignals.length > 0) {
            console.log(`📥 Processing ${pendingSignals.length} pending signals for ${fromUserId}`);
            for (const pendingSignal of pendingSignals) {
              try {
                peer.signal(pendingSignal);
              } catch (error) {
                console.error(`Failed to process pending signal for ${fromUserId}:`, error);
              }
            }
            this.pendingSignals.delete(fromUserId);
          }
        } catch (error) {
          console.error(`❌ Failed to create peer connection for ${fromUserId}:`, error);
          this.connectingPeers.delete(fromUserId);
          return;
        }
      }
    }
    
    if (peer && !peer.destroyed) {
      console.log(`📡 Processing WebRTC signal from ${fromUserId}`);
      try {
        peer.signal(signal);
      } catch (error) {
        console.error(`❌ Error processing signal from ${fromUserId}:`, error);
      }
    } else {
      console.warn(`⚠️ Cannot process signal - peer destroyed or unavailable for ${fromUserId}`);
    }
  }

  /**
   * Create a WebRTC peer connection with enhanced TURN support
   */
  async createPeerConnection(userId, initiator) {
    console.log(`🔗 Creating enhanced peer connection to ${userId}, initiator: ${initiator}`);
    
    let iceServers;
    let usingTwilio = false;
    
    try {
      // Try to get Twilio TURN servers first
      console.log('🔑 Fetching TURN credentials...');
      iceServers = await turnService.getTurnServers(this.authToken);
      console.log('✅ Got TURN servers');
      
      // Check if we got Twilio servers
      if (iceServers.some(server => server.urls && server.urls.toString().includes('twilio'))) {
        usingTwilio = true;
        console.log('✅ Using Twilio TURN servers');
      }
      
      // Log detailed ICE configuration
      console.log('🔍 ICE servers configuration:');
      iceServers.forEach((server, index) => {
        const urls = Array.isArray(server.urls) ? server.urls : [server.urls];
        console.log(`  Server ${index + 1}:`);
        urls.forEach(url => {
          console.log(`    - URL: ${url}`);
          if (url.includes('turn:') || url.includes('turns:')) {
            console.log(`    - Username: ${server.username ? '✅ Present' : '❌ Missing'}`);
            console.log(`    - Credential: ${server.credential ? '✅ Present' : '❌ Missing'}`);
          }
        });
      });
      
    } catch (error) {
      console.warn('⚠️ Failed to get Twilio TURN servers, using fallback:', error);
      iceServers = turnService.getFallbackTurnServers();
      console.log('🔍 Using fallback ICE servers');
    }
    
    // Ensure we have proper TURN servers for mobile networks
    const hasTurnWithCredentials = iceServers.some(server => {
      const urls = Array.isArray(server.urls) ? server.urls : [server.urls];
      return urls.some(url => (url.includes('turn:') || url.includes('turns:')) && server.username && server.credential);
    });
    
    if (!hasTurnWithCredentials) {
      console.error('❌ No TURN servers with credentials found!');
      console.error('TURN servers must be configured on the signaling server.');
      console.error('P2P connections may fail behind strict NATs without TURN servers.');
    }
    
    const peerConfig = {
      initiator,
      trickle: true, // Enable trickle ICE for better NAT traversal
      config: {
        iceServers,
        iceCandidatePoolSize: 10,
        iceTransportPolicy: 'all', // Use all available ICE candidates including TURN
        bundlePolicy: 'max-bundle',
        rtcpMuxPolicy: 'require',
        // Add more aggressive ICE settings for mobile networks
        sdpSemantics: 'unified-plan',
        continualGatheringPolicy: 'gather_continually'
      },
      // Increase timeout for mobile networks
      offerOptions: {
        offerToReceiveAudio: false,
        offerToReceiveVideo: false
      },
      channelConfig: {
        ordered: true,
        maxRetransmits: 10
      }
    };
    
    // Add wrtc if available
    if (wrtc) {
      peerConfig.wrtc = wrtc;
    }
    
    const peer = new SimplePeer(peerConfig);
    
    // Initialize connection stats
    this.connectionStats.set(userId, {
      startTime: Date.now(),
      iceGatheringComplete: false,
      candidateTypes: { host: 0, srflx: 0, relay: 0, prflx: 0 },
      selectedCandidatePair: null,
      usingTwilio
    });
    
    // Monitor the underlying RTCPeerConnection
    const pc = peer._pc;
    if (pc) {
      console.log('🔍 RTCPeerConnection created, monitoring state...');
      
      // Monitor ICE gathering state
      pc.addEventListener('icegatheringstatechange', () => {
        console.log(`🧊 ICE gathering state for ${userId}: ${pc.iceGatheringState}`);
        
        if (pc.iceGatheringState === 'complete') {
          const stats = this.connectionStats.get(userId);
          if (stats) {
            stats.iceGatheringComplete = true;
          }
          
          // Check gathered candidates
          pc.getStats().then(statsReport => {
            const stats = this.connectionStats.get(userId);
            if (!stats) return;
            
            statsReport.forEach(stat => {
              if (stat.type === 'local-candidate') {
                stats.candidateTypes[stat.candidateType] = (stats.candidateTypes[stat.candidateType] || 0) + 1;
              }
            });
            
            console.log(`📊 ICE candidates gathered for ${userId}:`, stats.candidateTypes);
            
            if (stats.candidateTypes.relay === 0) {
              console.error(`❌ WARNING: No TURN relay candidates generated for ${userId}!`);
              console.error('This will cause connection failures on restrictive networks (T-Mobile, etc.)');
              console.log('Possible causes:');
              console.log('1. TURN credentials are invalid');
              console.log('2. TURN servers are unreachable');
              console.log('3. Network firewall blocking TURN');
            }
          });
        }
      });
      
      // Monitor ICE connection state
      pc.addEventListener('iceconnectionstatechange', () => {
        console.log(`🔗 ICE connection state for ${userId}: ${pc.iceConnectionState}`);
        
        if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
          // Log successful connection details
          pc.getStats().then(statsReport => {
            statsReport.forEach(stat => {
              if (stat.type === 'candidate-pair' && stat.state === 'succeeded') {
                const stats = this.connectionStats.get(userId);
                if (stats) {
                  stats.selectedCandidatePair = {
                    local: stat.localCandidateId,
                    remote: stat.remoteCandidateId,
                    state: stat.state
                  };
                }
                
                // Get candidate details
                const localCandidate = statsReport.get(stat.localCandidateId);
                const remoteCandidate = statsReport.get(stat.remoteCandidateId);
                
                console.log(`✅ Connection established with ${userId} using:`);
                console.log(`  Local: ${localCandidate?.candidateType || 'unknown'} (${localCandidate?.address || 'unknown'})`);
                console.log(`  Remote: ${remoteCandidate?.candidateType || 'unknown'} (${remoteCandidate?.address || 'unknown'})`);
                
                if (localCandidate?.candidateType === 'relay' || remoteCandidate?.candidateType === 'relay') {
                  console.log('📡 Using TURN relay - good for restrictive networks!');
                }
              }
            });
          });
        } else if (pc.iceConnectionState === 'failed') {
          // Log failure details
          const stats = this.connectionStats.get(userId);
          console.error(`❌ ICE connection failed with ${userId}`);
          console.error('Connection stats:', stats);
          
          pc.getStats().then(statsReport => {
            console.log('📊 Failed connection diagnostics:');
            let hasValidCandidates = false;
            
            statsReport.forEach(stat => {
              if (stat.type === 'candidate-pair') {
                console.log(`  Candidate pair: ${stat.state} (nominated: ${stat.nominated})`);
                if (stat.state === 'succeeded') {
                  hasValidCandidates = true;
                }
              }
            });
            
            if (!hasValidCandidates) {
              console.error('❌ No valid candidate pairs found - complete NAT traversal failure');
            }
          });
        }
      });
      
      // Monitor connection state
      pc.addEventListener('connectionstatechange', () => {
        console.log(`📶 Connection state for ${userId}: ${pc.connectionState}`);
      });
    }
    
    // Store peer
    this.peers.set(userId, peer);
    
    // Set a timeout for connection establishment (longer for mobile networks)
    const connectionTimeout = setTimeout(() => {
      if (!peer.connected && !peer.destroyed) {
        const stats = this.connectionStats.get(userId);
        console.error(`⏱️ Connection timeout for ${userId} after 60 seconds`);
        console.log('Timeout stats:', stats);
        
        if (stats && stats.candidateTypes.relay === 0) {
          console.error('❌ Timeout likely due to missing TURN relay candidates');
        }
        
        this.closePeerConnection(userId);
      }
    }, 60000); // 60 seconds for mobile networks
    
    // Handle signaling
    peer.on('signal', (signal) => {
      if (signal.candidate) {
        const candidate = signal.candidate;
        console.log(`🧊 Sending ICE candidate to ${userId}:`, candidate.candidate);
        
        // Analyze candidate type
        const candidateString = candidate.candidate;
        let candidateType = 'unknown';
        if (candidateString.includes('typ host')) {
          candidateType = 'host (local)';
        } else if (candidateString.includes('typ srflx')) {
          candidateType = 'srflx (STUN reflexive)';
        } else if (candidateString.includes('typ relay')) {
          candidateType = 'relay (TURN)';
        }
        console.log(`  Type: ${candidateType}`);
      } else if (signal.type) {
        console.log(`📡 Sending ${signal.type} to ${userId}`);
      }
      
      this.socket.emit('webrtc-signal', {
        targetUserId: userId,
        signal
      });
    });
    
    // Handle connection established
    peer.on('connect', () => {
      console.log(`✅ P2P connection established with ${userId}`);
      clearTimeout(connectionTimeout); // Clear the timeout
      
      const stats = this.connectionStats.get(userId);
      if (stats) {
        stats.connectionTime = Date.now() - stats.startTime;
        console.log(`⏱️ Connection took ${stats.connectionTime}ms`);
      }
      
      this.notifyListeners('peer', { type: 'connected', userId });
      
      // Automatically send models to newly connected peer
      this.sendModelsToNewPeer(userId);
    });
    
    // Handle incoming data
    peer.on('data', (data) => {
      try {
        const message = JSON.parse(data.toString());
        this.handlePeerMessage(userId, message);
      } catch (error) {
        console.error('Failed to parse peer message:', error);
      }
    });
    
    // Handle errors
    peer.on('error', (error) => {
      console.error(`❌ P2P error with ${userId}:`, error);
      console.error(`Error details:`, {
        message: error.message,
        code: error.code,
        type: error.type
      });
      
      const stats = this.connectionStats.get(userId);
      if (stats) {
        console.error('Connection stats at error:', stats);
      }
      
      // For ICE connection failures, log more details
      if (error.code === 'ERR_ICE_CONNECTION_FAILURE') {
        console.log(`🔄 ICE connection failed with ${userId}`);
        if (stats && stats.candidateTypes.relay === 0) {
          console.error('❌ Failure likely due to missing TURN relay candidates');
        }
      }
      
      this.closePeerConnection(userId);
    });
    
    // Handle close
    peer.on('close', () => {
      console.log(`🔌 P2P connection closed with ${userId}`);
      this.peers.delete(userId);
      this.connectionStats.delete(userId);
    });
    
    return peer;
  }

  /**
   * Close peer connection
   */
  closePeerConnection(userId) {
    const peer = this.peers.get(userId);
    if (peer) {
      peer.destroy();
      this.peers.delete(userId);
    }
    this.connectionStats.delete(userId);
    this.pendingSignals.delete(userId);
  }

  /**
   * Handle incoming peer message
   */
  async handlePeerMessage(fromUserId, message) {
    console.log(`📨 Message from ${fromUserId}:`, message.type);
    
    try {
      let response;
      
      switch (message.type) {
        case 'get_models':
          response = await this.handleGetModels();
          break;
          
        case 'chat':
          response = await this.handleChatRequest(message.data);
          break;
          
        case 'ping':
          response = { type: 'pong', timestamp: Date.now() };
          break;
          
        default:
          // Notify listeners for custom handling
          this.notifyListeners('request', {
            fromUserId,
            message,
            respond: (data) => this.sendToPeer(fromUserId, data)
          });
          return;
      }
      
      // Send response
      if (response) {
        await this.sendToPeer(fromUserId, {
          type: 'response',
          requestId: message.requestId,
          data: response
        });
      }
      
    } catch (error) {
      console.error('❌ Error handling peer message:', error);
      await this.sendToPeer(fromUserId, {
        type: 'error',
        requestId: message.requestId,
        error: error.message
      });
    }
  }

  /**
   * Send message to peer
   */
  async sendToPeer(userId, message) {
    const peer = this.peers.get(userId);
    if (peer && peer.connected) {
      peer.send(JSON.stringify(message));
    } else {
      throw new Error(`Not connected to peer ${userId}`);
    }
  }

  /**
   * Send models to newly connected peer
   */
  async sendModelsToNewPeer(userId) {
    try {
      console.log(`📤 Sending models to new peer: ${userId}`);
      const models = await this.getAvailableModels();
      
      // Include hosting URL if configured
      const hostingUrl = config.device?.hostingUrl || `http://localhost:${config.device?.httpPort || 3002}`;
      
      await this.sendToPeer(userId, {
        type: 'models_available',
        models: models,
        hostingUrl: hostingUrl
      });
      
      console.log(`✅ Sent ${models.length} models to peer ${userId} with hosting URL: ${hostingUrl}`);
    } catch (error) {
      console.error(`❌ Failed to send models to peer ${userId}:`, error);
    }
  }

  /**
   * Handle get models request
   */
  async handleGetModels() {
    const models = await this.getAvailableModels();
    const hostingUrl = config.device?.hostingUrl || `http://localhost:${config.device?.httpPort || 3002}`;
    return { 
      models,
      hostingUrl 
    };
  }

  /**
   * Handle chat request
   */
  async handleChatRequest(request) {
    const axios = require('axios');
    const ollamaUrl = config.ollama.baseUrl;
    
    console.log(`🤖 Processing chat request for model: ${request.model}`);
    
    const response = await axios.post(`${ollamaUrl}/api/chat`, {
      model: request.model,
      messages: request.messages,
      stream: false,
      options: {
        temperature: request.temperature || 0.7,
        max_tokens: request.max_tokens || 2048
      }
    });
    
    if (response.status !== 200) {
      throw new Error(`Ollama request failed: ${response.status}`);
    }
    
    const result = response.data;
    
    // Convert to OpenAI-compatible format
    return {
      id: `chatcmpl-${Date.now()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: request.model,
      choices: [{
        index: 0,
        message: {
          role: 'assistant',
          content: result.message?.content || ''
        },
        finish_reason: 'stop'
      }],
      usage: {
        prompt_tokens: result.prompt_eval_count || 0,
        completion_tokens: result.eval_count || 0,
        total_tokens: (result.prompt_eval_count || 0) + (result.eval_count || 0)
      }
    };
  }

  /**
   * Get available models from Ollama with caching
   */
  async getAvailableModels() {
    // Cache models for 30 seconds
    const cacheExpiry = 30000;
    if (this.modelCache && Date.now() - this.modelCacheTime < cacheExpiry) {
      return this.modelCache;
    }
    
    try {
      // Use axios instead of node-fetch for better compatibility
      const axios = require('axios');
      const ollamaUrl = `${config.ollama.baseUrl}/api/tags`;
      console.log('🔍 Fetching models from Ollama:', ollamaUrl);
      
      const response = await axios.get(ollamaUrl, {
        timeout: 5000
      });
      
      if (response.status === 200 && response.data) {
        const data = response.data;
        console.log('✅ Ollama response:', JSON.stringify(data, null, 2));
        this.modelCache = data.models?.map(model => ({
          name: model.name,
          size: model.size,
          modified: model.modified_at
        })) || [];
        this.modelCacheTime = Date.now();
        console.log(`📋 Found ${this.modelCache.length} models`);
        return this.modelCache;
      } else {
        console.error('❌ Ollama response not ok:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('❌ Could not fetch Ollama models:', error);
      console.error('Error details:', error.stack);
    }
    
    // Return empty array if Ollama is not available
    return [];
  }

  /**
   * Get all available models from connected peers
   */
  async getAllPeerModels() {
    const peerModels = {};
    
    for (const [userId, peer] of this.peers.entries()) {
      if (peer.connected) {
        try {
          const response = await this.sendRequestToPeer(userId, 'get_models');
          if (response && response.models) {
            peerModels[userId] = response.models;
          }
        } catch (error) {
          console.error(`Failed to get models from peer ${userId}:`, error);
        }
      }
    }
    
    return peerModels;
  }

  /**
   * Send request to peer and wait for response
   */
  async sendRequestToPeer(userId, messageType, data = {}, timeout = 120000) {
    const peer = this.peers.get(userId);
    if (!peer || !peer.connected) {
      throw new Error(`Not connected to peer ${userId}`);
    }
    
    const requestId = Date.now().toString() + Math.random().toString(36).substring(2);
    
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error('Request timeout'));
      }, timeout);
      
      const responseHandler = (message) => {
        if (message.type === 'response' && message.requestId === requestId) {
          clearTimeout(timeoutId);
          peer.off('data', responseHandler);
          resolve(message.data);
        } else if (message.type === 'error' && message.requestId === requestId) {
          clearTimeout(timeoutId);
          peer.off('data', responseHandler);
          reject(new Error(message.error));
        }
      };
      
      peer.on('data', responseHandler);
      
      peer.send(JSON.stringify({
        type: messageType,
        requestId,
        data
      }));
    });
  }

  /**
   * Get hosting status with connection statistics
   */
  getStatus() {
    const connectedPeers = Array.from(this.peers.entries())
      .filter(([_, peer]) => peer.connected)
      .map(([userId, _]) => userId);
    
    const connectionDetails = {};
    this.connectionStats.forEach((stats, userId) => {
      connectionDetails[userId] = {
        connected: this.peers.get(userId)?.connected || false,
        usingTwilio: stats.usingTwilio,
        hasRelayCandidates: stats.candidateTypes.relay > 0,
        candidateTypes: stats.candidateTypes,
        connectionTime: stats.connectionTime
      };
    });
    
    return {
      status: this.status,
      isHosting: this.isHosting,
      hostingEnabled: this.hostingEnabled,
      connectedPeers: connectedPeers.length,
      connectedPeerIds: connectedPeers,
      connectionDetails,
      userId: this.currentUserId
    };
  }

  /**
   * Update status
   */
  updateStatus(status, message = '') {
    this.status = status;
    this.notifyListeners('status', { status, message });
  }

  /**
   * Add event listener
   */
  on(event, listener) {
    if (this.listeners[event]) {
      this.listeners[event].add(listener);
      return () => this.listeners[event].delete(listener);
    }
    throw new Error(`Unknown event: ${event}`);
  }

  /**
   * Notify listeners
   */
  notifyListeners(event, data) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(listener => {
        try {
          listener(data);
        } catch (error) {
          console.error(`Error in ${event} listener:`, error);
        }
      });
    }
  }

  /**
   * Shutdown service
   */
  async shutdown() {
    await this.stopHosting();
    this.listeners = {
      status: new Set(),
      hosting: new Set(),
      peer: new Set(),
      request: new Set()
    };
  }
}

const p2pServiceV2Enhanced = new P2PServiceV2Enhanced();

module.exports = p2pServiceV2Enhanced;