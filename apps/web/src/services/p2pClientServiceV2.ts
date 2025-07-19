/**
 * P2P Client Service V2 for Web Client
 * Socket.io + Simple-peer implementation for consuming hosted models
 */

import SimplePeer from 'simple-peer';
import io, { Socket } from 'socket.io-client';
import { p2pConfig } from '../config/p2p';
import { turnService } from './turnService';

export interface PeerInfo {
  userId: string;
  socketId: string;
  deviceInfo?: any;
  connectedAt?: string;
  models?: ModelInfo[];
  batteryState?: BatteryState;
}

export interface ModelInfo {
  name: string;
  size?: number;
  modified?: string;
  provider?: string;
}

export interface BatteryState {
  isCharging: boolean;
  percentage: number | null;
  isOnBatteryPower: boolean;
}

export interface ChatRequest {
  model: string;
  messages: Array<{
    role: string;
    content: string;
  }>;
  temperature?: number;
  max_tokens?: number;
}

export interface ChatResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface P2PStatus {
  status: 'disconnected' | 'connecting' | 'connected' | 'error';
  connected: boolean;
  userId?: string;
  error?: string;
  serverUrl?: string;
  peerId?: string;
}

type StatusListener = (status: P2PStatus) => void;
type PeerListener = (event: { type: string; peer?: PeerInfo; userId?: string }) => void;
type ModelListener = (models: Record<string, ModelInfo[]>) => void;

class P2PClientServiceV2 {
  private socket: Socket | null = null;
  private peers = new Map<string, SimplePeer.Instance>();
  private connectingPeers = new Set<string>(); // Track peers being connected
  private pendingRequests = new Map<string, { resolve: Function; reject: Function }>();
  private queuedSignals = new Map<string, any[]>(); // Queue signals while connecting
  private currentUserId: string | null = null;
  private authToken: string | null = null;
  private status: P2PStatus['status'] = 'disconnected';
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 2000;
  private forceRelay = false; // Force TURN relay for difficult NAT scenarios
  private testRelayOnly = false; // Test with relay-only mode
  
  private listeners = {
    status: new Set<StatusListener>(),
    peer: new Set<PeerListener>(),
    model: new Set<ModelListener>()
  };

  private peerModels = new Map<string, ModelInfo[]>();
  private peerBatteryStates = new Map<string, BatteryState>();
  private signalingServerUrl = localStorage.getItem('signalingServerUrl') || p2pConfig.signalingServerUrl;

  /**
   * Initialize the P2P client
   */
  async initialize(userId: string, authToken: string, options?: { signalingServerUrl?: string; forceRelay?: boolean }) {
    this.currentUserId = userId;
    this.authToken = authToken;
    
    if (options?.signalingServerUrl) {
      this.signalingServerUrl = options.signalingServerUrl;
    }
    
    if (options?.forceRelay !== undefined) {
      this.forceRelay = options.forceRelay;
      console.log(`🔄 Force relay mode: ${this.forceRelay}`);
    }
    
    await this.connect();
  }

  /**
   * Connect to the signaling server
   */
  async connect(): Promise<void> {
    if (this.socket?.connected) return;
    
    this.updateStatus('connecting');
    
    return new Promise((resolve, reject) => {
      this.socket = io(this.signalingServerUrl, {
        auth: { 
          token: this.authToken,
          clientType: 'web',
          deviceId: this.currentUserId + '_web'
        },
        reconnection: false, // We handle reconnection manually
        // Add ngrok header for now - remove this when not using ngrok
        extraHeaders: {
          'ngrok-skip-browser-warning': 'true'
        },
        // Use WebSocket transport only to avoid CORS issues with polling
        transports: ['websocket']
      });
      
      this.socket.on('connect', () => {
        console.log('✅ Connected to signaling server');
        this.reconnectAttempts = 0;
        this.updateStatus('connected');
        this.socket!.emit('join-account');
        
        // Request peer list after joining
        setTimeout(() => {
          console.log('🔍 Requesting peer list...');
          this.socket!.emit('request-peer-list');
        }, 500);
        
        resolve();
      });
      
      this.socket.on('connect_error', (error) => {
        console.error('❌ Connection error:', error);
        this.updateStatus('error', error.message);
        reject(error);
      });
      
      this.setupSocketHandlers();
    });
  }

  /**
   * Setup Socket.io event handlers
   */
  private setupSocketHandlers() {
    if (!this.socket) return;
    
    // Handle peers joining
    this.socket.on('peer-joined', (peerInfo: PeerInfo) => {
      console.log('👤 New peer joined:', peerInfo.userId);
      this.notifyListeners('peer', { type: 'joined', peer: peerInfo });
      
      // Don't automatically create connections - wait for explicit requests
    });
    
    // Handle existing peers
    this.socket.on('existing-peers', (peers: PeerInfo[]) => {
      console.log(`👥 Found ${peers.length} existing peers`);
      peers.forEach(peer => {
        console.log(`📋 Existing peer:`, peer);
        this.notifyListeners('peer', { type: 'existing', peer });
        
        // Check if peer already has models
        if (peer.models && peer.models.length > 0) {
          console.log(`📦 Peer ${peer.userId} has ${peer.models.length} models from server`);
          this.peerModels.set(peer.userId, peer.models);
          if (peer.batteryState) {
            this.peerBatteryStates.set(peer.userId, peer.batteryState);
          }
          this.notifyModelListeners();
        }
        
        // Also request models from each peer through signaling server
        this.socket?.emit('request-models', peer.userId);
      });
    });
    
    // Handle WebRTC signals
    this.socket.on('webrtc-signal', async (data: { fromUserId: string; signal: any }) => {
      await this.handleWebRTCSignal(data);
    });
    
    // Handle peers leaving
    this.socket.on('peer-left', (peerInfo: PeerInfo) => {
      console.log('👤 Peer left:', peerInfo.userId);
      this.closePeerConnection(peerInfo.userId);
      this.peerModels.delete(peerInfo.userId);
      this.peerBatteryStates.delete(peerInfo.userId);
      this.notifyListeners('peer', { type: 'left', peer: peerInfo });
      this.notifyModelListeners();
    });
    
    // Handle model updates from signaling server
    this.socket.on('peer-models-updated', (data: { userId: string; models: ModelInfo[]; batteryState?: BatteryState }) => {
      console.log(`📦 Models updated for peer ${data.userId}: ${data.models?.length || 0} models`);
      if (data.models && data.models.length > 0) {
        this.peerModels.set(data.userId, data.models);
        if (data.batteryState) {
          this.peerBatteryStates.set(data.userId, data.batteryState);
        }
        this.notifyModelListeners();
      }
    });
    
    // Handle disconnection
    this.socket.on('disconnect', (reason: string) => {
      console.log('🔌 Disconnected from signaling server:', reason);
      if (reason !== 'io client disconnect') {
        this.updateStatus('disconnected');
        this.scheduleReconnect();
      }
    });
  }

  /**
   * Handle incoming WebRTC signal
   */
  private async handleWebRTCSignal(data: { fromUserId: string; signal: any }) {
    const { fromUserId, signal } = data;
    console.log(`📡 Received WebRTC signal from ${fromUserId}, type: ${signal.type || 'ice-candidate'}`);
    
    let peer = this.peers.get(fromUserId);
    
    // Handle signaling collision - if we receive an offer but we're already initiating
    if (signal.type === 'offer' && peer && !peer.destroyed) {
      const pc = (peer as any)._pc;
      if (pc && pc.signalingState !== 'stable') {
        console.log(`⚠️ Signaling collision detected with ${fromUserId}, we're in state: ${pc.signalingState}`);
        
        // Use polite peer pattern - lower ID wins
        const weArePolite = this.currentUserId! < fromUserId;
        
        if (weArePolite) {
          console.log(`🤝 We're the polite peer, rolling back our offer`);
          // Destroy our peer and accept their offer
          peer.destroy();
          this.peers.delete(fromUserId);
          this.connectingPeers.delete(fromUserId);
          peer = null;
        } else {
          console.log(`💪 We're the impolite peer, ignoring their offer`);
          return; // Ignore their offer, they should accept ours
        }
      }
    }
    
    if (!peer || peer.destroyed) {
      // Clean up any destroyed peer first
      if (peer && peer.destroyed) {
        console.log(`🗑️ Cleaning up destroyed peer for ${fromUserId}`);
        this.peers.delete(fromUserId);
        this.connectingPeers.delete(fromUserId);
      }
      
      // Check if we're already connecting to this peer
      if (this.connectingPeers.has(fromUserId)) {
        console.log(`⏳ Already connecting to ${fromUserId}, queueing signal...`);
        
        // Queue the signal for later processing
        if (!this.queuedSignals.has(fromUserId)) {
          this.queuedSignals.set(fromUserId, []);
        }
        this.queuedSignals.get(fromUserId)!.push(signal);
        return; // Don't process this signal now
      }
      
      if (!peer || peer.destroyed) {
        // Only create a peer for offers, not for other signals
        if (signal.type !== 'offer') {
          console.log(`🚫 Ignoring ${signal.type || 'signal'} from ${fromUserId} - no peer connection exists`);
          return;
        }
        
        // Prevent multiple simultaneous connections
        if (this.connectingPeers.has(fromUserId)) {
          console.log(`🚫 Already creating connection for ${fromUserId}, skipping...`);
          return;
        }
        
        // Create peer connection for incoming signal
        console.log(`🔗 Creating peer connection for incoming offer from ${fromUserId}`);
        this.connectingPeers.add(fromUserId);
      
      let iceServers: RTCIceServer[];
      
      try {
        console.log('🔑 Fetching TURN credentials for incoming connection...');
        iceServers = await turnService.getTurnServers();
        console.log('✅ Got Twilio TURN servers for incoming connection');
        console.log('🔍 ICE servers configuration:', JSON.stringify(iceServers, null, 2));
        
        // Verify ICE servers format
        if (iceServers && iceServers.length > 0) {
          iceServers.forEach((server, index) => {
            console.log(`📍 ICE server ${index}:`, {
              urls: server.urls || (server as any).url,
              username: server.username ? '***present***' : 'missing',
              credential: server.credential ? '***present***' : 'missing'
            });
          });
        }
      } catch (error) {
        console.error('❌ Failed to get TURN servers from signaling server:', error);
        console.error('TURN servers must be configured on the signaling server.');
        console.error('P2P connections may fail behind strict NATs without TURN servers.');
        // Still need to provide at least STUN servers for basic connectivity
        iceServers = [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ];
      }
      
      peer = new SimplePeer({
        initiator: false,
        trickle: true,
        config: {
          iceServers,
          iceCandidatePoolSize: 10,
          iceTransportPolicy: 'all', // Allow both STUN and TURN - change to 'relay' to force TURN
          bundlePolicy: 'max-bundle',
          rtcpMuxPolicy: 'require',
          iceCandidateSelectionTimeout: 10000 // Give more time for TURN candidates
        }
      });
      
      // Monitor the underlying RTCPeerConnection
      const pc = (peer as any)._pc;
      if (pc) {
        console.log('🔍 RTCPeerConnection configuration:', pc.getConfiguration());
        
        // Monitor ICE gathering state
        pc.addEventListener('icegatheringstatechange', () => {
          console.log(`🧊 ICE gathering state for ${fromUserId}: ${pc.iceGatheringState}`);
        });
        
        // Monitor ICE connection state
        pc.addEventListener('iceconnectionstatechange', () => {
          console.log(`🔗 ICE connection state for ${fromUserId}: ${pc.iceConnectionState}`);
        });
      }
      
      // Store peer immediately so signals don't get lost
      this.peers.set(fromUserId, peer);
      this.connectingPeers.delete(fromUserId); // Connection created, remove from connecting set
      
      // Set up event handlers
      this.setupPeerEventHandlers(peer, fromUserId);
      
      console.log(`✅ Peer connection created for ${fromUserId}`);
      
      // Process any queued signals
      const queuedSignals = this.queuedSignals.get(fromUserId);
      if (queuedSignals && queuedSignals.length > 0) {
        console.log(`📥 Processing ${queuedSignals.length} queued signals for ${fromUserId}`);
        // Process signals with a small delay between each to avoid overwhelming
        for (const queuedSignal of queuedSignals) {
          try {
            peer.signal(queuedSignal);
            await new Promise(resolve => setTimeout(resolve, 10)); // Small delay
          } catch (error) {
            console.error(`Failed to process queued signal for ${fromUserId}:`, error);
          }
        }
        this.queuedSignals.delete(fromUserId);
      }
      }
    }
    
    if (peer && !peer.destroyed) {
      // Check signaling state before processing
      const pc = (peer as any)._pc;
      if (pc) {
        console.log(`📡 Processing WebRTC signal from ${fromUserId}, our state: ${pc.signalingState}`);
        
        // Don't process answers if we're in stable state
        if (signal.type === 'answer' && pc.signalingState === 'stable') {
          console.warn(`⚠️ Ignoring answer in stable state from ${fromUserId}`);
          return;
        }
      }
      
      try {
        peer.signal(signal);
      } catch (error) {
        console.error(`❌ Error processing signal from ${fromUserId}:`, error);
      }
    } else {
      console.warn(`⚠️ Cannot process signal from ${fromUserId}: peer not available or destroyed`);
    }
  }

  /**
   * Set up event handlers for a peer connection
   */
  private setupPeerEventHandlers(peer: SimplePeer.Instance, userId: string) {
    // Handle signaling
    peer.on('signal', (signal: any) => {
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
        console.log(`📊 Candidate type: ${candidateType}`);
      } else if (signal.type) {
        console.log(`📡 Sending ${signal.type} to ${userId}`);
      } else {
        console.log(`📡 Sending WebRTC signal to ${userId}`);
      }
      this.socket?.emit('webrtc-signal', {
        targetUserId: userId,
        signal
      });
    });
    
    // Handle connection established
    peer.on('connect', () => {
      console.log(`✅ P2P connection established with ${userId}`);
      this.notifyListeners('peer', { type: 'connected', userId });
      
      // Automatically request models from newly connected peer with delay for stability
      setTimeout(() => {
        this.requestModelsFromPeer(userId).catch(err => 
          console.error(`Failed to get models from ${userId}:`, err)
        );
      }, 1000);
    });
    
    // Monitor ICE connection state
    peer.on('iceStateChange', (state: any) => {
      console.log(`🧊 ICE state changed for ${userId}: ${state}`);
      if (state === 'failed') {
        console.error(`❌ ICE connection failed for ${userId}`);
      }
    });
    
    // Monitor signaling state
    peer.on('signalingStateChange', (state: any) => {
      console.log(`📶 Signaling state changed for ${userId}: ${state}`);
    });
    
    // Log when ICE gathering completes
    peer.on('iceComplete', () => {
      console.log(`✅ ICE gathering complete for ${userId}`);
    });
    
    // Handle incoming data
    peer.on('data', (data: any) => {
      try {
        const message = JSON.parse(data.toString());
        this.handlePeerMessage(userId, message);
      } catch (error) {
        console.error('Failed to parse peer message:', error);
      }
    });
    
    // Handle errors
    peer.on('error', (error: any) => {
      console.error(`❌ P2P error with ${userId}:`, error);
      console.error(`Error details:`, {
        message: error.message,
        code: (error as any).code,
        type: (error as any).type
      });
      this.closePeerConnection(userId);
    });
    
    // Handle close
    peer.on('close', () => {
      console.log(`🔌 P2P connection closed with ${userId}`);
      this.peers.delete(userId);
      // Don't delete peer models here - they might have been received from signaling server
      // Models should only be cleared when peer actually leaves the signaling server
    });
  }

  /**
   * Create a WebRTC peer connection
   */
  private async createPeerConnection(userId: string, initiator: boolean): Promise<SimplePeer.Instance> {
    console.log(`🔗 Creating peer connection to ${userId}, initiator: ${initiator}`);
    
    let iceServers: RTCIceServer[];
    
    try {
      // Try to get Twilio TURN servers first
      console.log('🔑 Fetching TURN credentials...');
      iceServers = await turnService.getTurnServers();
      console.log('✅ Got Twilio TURN servers');
      console.log('🔍 ICE servers configuration:', JSON.stringify(iceServers, null, 2));
      
      // Verify ICE servers format
      if (iceServers && iceServers.length > 0) {
        iceServers.forEach((server, index) => {
          console.log(`📍 ICE server ${index}:`, {
            urls: server.urls || (server as any).url,
            username: server.username ? '***present***' : 'missing',
            credential: server.credential ? '***present***' : 'missing'
          });
        });
      }
    } catch (error) {
      console.warn('⚠️ Failed to get Twilio TURN servers, using fallback:', error);
      iceServers = turnService.getFallbackTurnServers();
      console.log('🔍 Using fallback ICE servers:', JSON.stringify(iceServers, null, 2));
    }
    
    const peer = new SimplePeer({
      initiator,
      trickle: true, // Enable trickle ICE for better NAT traversal
      config: {
        iceServers,
        iceCandidatePoolSize: 10,
        iceTransportPolicy: 'all', // Use all available ICE candidates including TURN
        bundlePolicy: 'max-bundle',
        rtcpMuxPolicy: 'require',
        iceCandidateSelectionTimeout: 10000 // Give more time for TURN candidates
      }
    });
    
    // Monitor the underlying RTCPeerConnection
    const pc = (peer as any)._pc;
    if (pc) {
      console.log('🔍 RTCPeerConnection configuration:', pc.getConfiguration());
      
      // Monitor ICE gathering state
      pc.addEventListener('icegatheringstatechange', () => {
        console.log(`🧊 ICE gathering state for ${userId}: ${pc.iceGatheringState}`);
      });
      
      // Monitor ICE connection state
      pc.addEventListener('iceconnectionstatechange', () => {
        console.log(`🔗 ICE connection state for ${userId}: ${pc.iceConnectionState}`);
      });
    }
    
    // Store peer
    this.peers.set(userId, peer);
    
    // Handle signaling
    peer.on('signal', (signal: any) => {
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
        console.log(`📊 Candidate type: ${candidateType}`);
      } else if (signal.type) {
        console.log(`📡 Sending ${signal.type} to ${userId}`);
      } else {
        console.log(`📡 Sending WebRTC signal to ${userId}`);
      }
      this.socket?.emit('webrtc-signal', {
        targetUserId: userId,
        signal
      });
    });
    
    // Handle connection established
    peer.on('connect', () => {
      console.log(`✅ P2P connection established with ${userId}`);
      this.notifyListeners('peer', { type: 'connected', userId });
      
      // Automatically request models from newly connected peer with delay for stability
      setTimeout(() => {
        this.requestModelsFromPeer(userId).catch(err => 
          console.error(`Failed to get models from ${userId}:`, err)
        );
      }, 1000);
    });
    
    // Monitor ICE connection state
    peer.on('iceStateChange', (state: any) => {
      console.log(`🧊 ICE state changed for ${userId}: ${state}`);
      if (state === 'failed') {
        console.error(`❌ ICE connection failed for ${userId}`);
      }
    });
    
    // Monitor signaling state
    peer.on('signalingStateChange', (state: any) => {
      console.log(`📶 Signaling state changed for ${userId}: ${state}`);
    });
    
    // Log when ICE gathering completes
    peer.on('iceComplete', () => {
      console.log(`✅ ICE gathering complete for ${userId}`);
    });
    
    // Handle incoming data
    peer.on('data', (data: any) => {
      try {
        const message = JSON.parse(data.toString());
        this.handlePeerMessage(userId, message);
      } catch (error) {
        console.error('Failed to parse peer message:', error);
      }
    });
    
    // Handle errors
    peer.on('error', (error: any) => {
      console.error(`❌ P2P error with ${userId}:`, error);
      console.error(`Error details:`, {
        message: error.message,
        code: (error as any).code,
        type: (error as any).type
      });
      this.closePeerConnection(userId);
    });
    
    // Handle close
    peer.on('close', () => {
      console.log(`🔌 P2P connection closed with ${userId}`);
      this.peers.delete(userId);
      // Don't delete peer models here - they might have been received from signaling server
      // Models should only be cleared when peer actually leaves the signaling server
    });
    
    return peer;
  }

  /**
   * Close peer connection
   */
  private closePeerConnection(userId: string) {
    const peer = this.peers.get(userId);
    if (peer) {
      peer.destroy();
      this.peers.delete(userId);
    }
    this.connectingPeers.delete(userId);
    this.queuedSignals.delete(userId);
  }

  /**
   * Handle incoming peer message
   */
  private handlePeerMessage(fromUserId: string, message: any) {
    console.log(`📨 Message from ${fromUserId}:`, message.type);
    
    if (message.type === 'models_available') {
      // Handle proactive model announcements from peers
      const models = message.models || [];
      console.log(`📋 Received ${models.length} models from ${fromUserId}:`, models.map((m: any) => m.name || m));
      this.peerModels.set(fromUserId, models);
      
      // Store battery state if available
      if (message.batteryState) {
        console.log(`🔋 Battery state from ${fromUserId}:`, message.batteryState);
        this.peerBatteryStates.set(fromUserId, message.batteryState);
      }
      
      this.notifyModelListeners();
    } else if (message.type === 'response' && message.requestId) {
      const pending = this.pendingRequests.get(message.requestId);
      if (pending) {
        pending.resolve(message.data);
        this.pendingRequests.delete(message.requestId);
      }
    } else if (message.type === 'error' && message.requestId) {
      const pending = this.pendingRequests.get(message.requestId);
      if (pending) {
        pending.reject(new Error(message.error));
        this.pendingRequests.delete(message.requestId);
      }
    }
  }

  /**
   * Send message to peer and wait for response
   */
  private async sendRequestToPeer(userId: string, messageType: string, data?: any, timeout = 120000): Promise<any> {
    const peer = this.peers.get(userId);
    if (!peer || !peer.connected) {
      throw new Error(`Not connected to peer ${userId}`);
    }
    
    const requestId = Date.now().toString() + Math.random().toString(36).substring(2);
    
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new Error('Request timeout'));
      }, timeout);
      
      this.pendingRequests.set(requestId, {
        resolve: (data: any) => {
          clearTimeout(timeoutId);
          resolve(data);
        },
        reject: (error: any) => {
          clearTimeout(timeoutId);
          reject(error);
        }
      });
      
      peer.send(JSON.stringify({
        type: messageType,
        requestId,
        data
      }));
    });
  }

  /**
   * Connect to a specific peer (creates WebRTC connection)
   */
  async connectToPeer(userId: string): Promise<void> {
    // Check if already connected
    const existingPeer = this.peers.get(userId);
    if (existingPeer && !existingPeer.destroyed && existingPeer.connected) {
      console.log(`✅ Already connected to ${userId}`);
      return;
    }
    
    // Clean up any destroyed peer
    if (existingPeer && existingPeer.destroyed) {
      console.log(`🗑️ Cleaning up destroyed peer for ${userId}`);
      this.peers.delete(userId);
      this.connectingPeers.delete(userId);
    }
    
    return new Promise(async (resolve, reject) => {
      let peer: SimplePeer.Instance;
      let timeoutId: NodeJS.Timeout;
      
      try {
        peer = await this.createPeerConnection(userId, true);
      } catch (error) {
        reject(error);
        return;
      }
      
      const cleanup = () => {
        peer.off('connect', onConnect);
        peer.off('error', onError);
        peer.off('close', onClose);
        if (timeoutId) clearTimeout(timeoutId);
      };
      
      const onConnect = () => {
        cleanup();
        resolve();
      };
      
      const onError = (error: Error) => {
        cleanup();
        this.closePeerConnection(userId);
        reject(error);
      };
      
      const onClose = () => {
        cleanup();
        reject(new Error('Peer connection closed unexpectedly'));
      };
      
      peer.once('connect', onConnect);
      peer.once('error', onError);
      peer.once('close', onClose);
      
      // Set timeout
      timeoutId = setTimeout(() => {
        if (!peer.connected && !peer.destroyed) {
          cleanup();
          this.closePeerConnection(userId);
          reject(new Error('Connection timeout'));
        }
      }, 15000); // Increased timeout to 15 seconds
    });
  }

  /**
   * Request models from a specific peer
   */
  async requestModelsFromPeer(userId: string): Promise<ModelInfo[]> {
    try {
      const response = await this.sendRequestToPeer(userId, 'get_models');
      const models = response.models || [];
      this.peerModels.set(userId, models);
      
      // Store battery state if available
      if (response.batteryState) {
        console.log(`🔋 Battery state from ${userId}:`, response.batteryState);
        this.peerBatteryStates.set(userId, response.batteryState);
      }
      
      this.notifyModelListeners();
      return models;
    } catch (error) {
      console.error(`Failed to get models from ${userId}:`, error);
      return [];
    }
  }

  /**
   * Send chat request to a specific peer
   */
  async sendChatRequest(userId: string, request: ChatRequest): Promise<ChatResponse> {
    return this.sendRequestToPeer(userId, 'chat', request);
  }

  /**
   * Get all available models from all connected peers
   */
  getAllAvailableModels(): Record<string, ModelInfo[]> {
    const result: Record<string, ModelInfo[]> = {};
    this.peerModels.forEach((models, userId) => {
      result[userId] = models;
    });
    return result;
  }

  /**
   * Get battery states from all connected peers
   */
  getPeerBatteryStates(): Map<string, BatteryState> {
    return new Map(this.peerBatteryStates);
  }

  /**
   * Get battery state for a specific peer
   */
  getPeerBatteryState(userId: string): BatteryState | undefined {
    return this.peerBatteryStates.get(userId);
  }

  /**
   * Get connected peer IDs
   */
  getConnectedPeers(): string[] {
    return Array.from(this.peers.entries())
      .filter(([_, peer]) => peer.connected)
      .map(([userId, _]) => userId);
  }

  /**
   * Get cached peer information
   */
  getCachedPeers(): Array<{ peer_id: string; device_name?: string }> {
    return Array.from(this.peers.entries())
      .filter(([_, peer]) => peer.connected)
      .map(([userId, _]) => ({
        peer_id: userId,
        device_name: `Device ${userId.substring(0, 8)}`
      }));
  }

  /**
   * Discover and connect to all available peers
   */
  async discoverPeers(): Promise<void> {
    if (!this.socket?.connected) {
      await this.connect();
    }
    
    // Don't clear cached peer models - they might have been received from signaling server
    // Only clear them when peers actually leave the signaling server
    
    // Don't destroy existing active connections - just request updated peer list
    // Only clean up destroyed or failed connections
    this.peers.forEach((peer, userId) => {
      if (peer.destroyed) {
        console.log(`🗑️ Cleaning up destroyed peer: ${userId}`);
        this.peers.delete(userId);
        this.connectingPeers.delete(userId);
        this.queuedSignals.delete(userId);
      }
    });
    
    this.socket?.emit('request-peer-list');
    
    // Wait a bit for peers to respond
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  /**
   * Schedule reconnection
   */
  private scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      this.updateStatus('error', 'Max reconnection attempts reached');
      return;
    }
    
    this.reconnectAttempts++;
    const delay = this.reconnectDelay * this.reconnectAttempts;
    
    console.log(`Scheduling reconnection attempt ${this.reconnectAttempts} in ${delay}ms`);
    
    setTimeout(() => {
      if (this.status !== 'connected') {
        this.connect().catch(err => 
          console.error('Reconnection failed:', err)
        );
      }
    }, delay);
  }

  /**
   * Update status and notify listeners
   */
  private updateStatus(status: P2PStatus['status'], error?: string) {
    this.status = status;
    const statusObj: P2PStatus = {
      status,
      connected: status === 'connected',
      userId: this.currentUserId || undefined,
      error,
      serverUrl: this.signalingServerUrl,
      peerId: this.socket?.id
    };
    
    this.notifyListeners('status', statusObj);
  }

  /**
   * Notify model listeners
   */
  private notifyModelListeners() {
    const models = this.getAllAvailableModels();
    this.listeners.model.forEach(listener => {
      try {
        listener(models);
      } catch (error) {
        console.error('Error in model listener:', error);
      }
    });
  }

  /**
   * Add event listener
   */
  on<T extends keyof typeof this.listeners>(event: T, listener: any): () => void {
    this.listeners[event].add(listener);
    return () => this.listeners[event].delete(listener);
  }

  /**
   * Notify listeners
   */
  private notifyListeners<T extends keyof typeof this.listeners>(event: T, data: any) {
    this.listeners[event].forEach((listener: any) => {
      try {
        listener(data);
      } catch (error) {
        console.error(`Error in ${event} listener:`, error);
      }
    });
  }

  /**
   * Get current status
   */
  getStatus(): P2PStatus {
    return {
      status: this.status,
      connected: this.status === 'connected',
      userId: this.currentUserId || undefined,
      serverUrl: this.signalingServerUrl,
      peerId: this.socket?.id
    };
  }

  /**
   * Disconnect and cleanup
   */
  disconnect() {
    // Close all peer connections
    this.peers.forEach(peer => peer.destroy());
    this.peers.clear();
    this.peerModels.clear();
    
    // Close socket connection
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    
    this.updateStatus('disconnected');
  }
}

// Export singleton instance
export const p2pClientServiceV2 = new P2PClientServiceV2();
export default p2pClientServiceV2;