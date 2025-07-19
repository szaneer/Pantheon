/**
 * Shared P2P Client Library
 * Cross-platform implementation for both Electron and Web clients
 * Based on Socket.io + Simple-peer architecture
 */

import SimplePeer from 'simple-peer';
import io from 'socket.io-client';

export class P2PClient {
  constructor(config) {
    this.config = {
      signalingServerUrl: 'http://localhost:3001',
      autoConnect: true,
      reconnectDelay: 2000,
      maxReconnectAttempts: 5,
      heartbeatInterval: 30000,
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ],
      ...config
    };
    
    this.socket = null;
    this.peers = new Map(); // userId -> SimplePeer instance
    this.pendingConnections = new Map(); // userId -> Promise
    this.messageHandlers = new Map(); // messageType -> handler function
    this.requestHandlers = new Map(); // requestType -> handler function
    
    this.currentUser = null;
    this.authToken = null;
    this.accountId = null;
    this.userId = null;
    this.isHost = false; // true for Electron (model host), false for Web (consumer)
    this.isInitialized = false;
    this.status = 'disconnected';
    this.reconnectAttempts = 0;
    
    this.listeners = {
      status: new Set(),
      peer: new Set(),
      message: new Set(),
      error: new Set()
    };
  }

  /**
   * Initialize the P2P client
   */
  async initialize(userId, authToken, options = {}) {
    if (this.isInitialized) return;
    
    this.userId = userId;
    this.authToken = authToken;
    this.accountId = options.accountId || userId;
    this.isHost = options.isHost || false;
    
    try {
      await this.connect();
      this.isInitialized = true;
      console.log('P2P Client initialized');
    } catch (error) {
      console.error('Failed to initialize P2P client:', error);
      throw error;
    }
  }

  /**
   * Connect to the signaling server
   */
  async connect() {
    if (this.socket?.connected) return;
    
    this.updateStatus('connecting');
    
    return new Promise((resolve, reject) => {
      this.socket = io(this.config.signalingServerUrl, {
        auth: { 
          authKey: this.authToken, // Now used as auth key
          deviceId: this.userId,
          clientType: this.isHost ? 'electron' : 'web'
        },
        reconnection: false // We'll handle reconnection manually
      });
      
      this.socket.on('connect', () => {
        console.log('Connected to signaling server');
        this.reconnectAttempts = 0;
        this.updateStatus('connected');
        this.socket.emit('join-account');
        resolve();
      });
      
      this.socket.on('connect_error', (error) => {
        console.error('Connection error:', error);
        this.updateStatus('error', error.message);
        reject(error);
      });
      
      this.setupSocketHandlers();
    });
  }

  /**
   * Setup Socket.io event handlers
   */
  setupSocketHandlers() {
    this.socket.on('peer-joined', (peerInfo) => {
      console.log('New peer joined:', peerInfo.userId);
      this.notifyListeners('peer', { type: 'joined', peer: peerInfo });
      
      if (this.isHost || this.shouldInitiateConnection(peerInfo.userId)) {
        this.createPeerConnection(peerInfo.userId, true);
      }
    });
    
    this.socket.on('existing-peers', (peers) => {
      console.log('Existing peers:', peers.length);
      peers.forEach(peer => {
        this.notifyListeners('peer', { type: 'existing', peer });
        
        if (!this.isHost && !this.shouldInitiateConnection(peer.userId)) {
          this.createPeerConnection(peer.userId, false);
        }
      });
    });
    
    this.socket.on('webrtc-signal', (data) => {
      this.handleWebRTCSignal(data);
    });
    
    this.socket.on('peer-left', (peerInfo) => {
      console.log('Peer left:', peerInfo.userId);
      this.closePeerConnection(peerInfo.userId);
      this.notifyListeners('peer', { type: 'left', peer: peerInfo });
    });
    
    this.socket.on('disconnect', () => {
      console.log('Disconnected from signaling server');
      this.updateStatus('disconnected');
      this.scheduleReconnect();
    });
    
    this.socket.on('error', (error) => {
      console.error('Socket error:', error);
      this.notifyListeners('error', error);
    });
  }

  /**
   * Create a WebRTC peer connection
   */
  createPeerConnection(userId, isInitiator) {
    if (this.peers.has(userId)) return;
    
    console.log(`Creating peer connection to ${userId}, initiator: ${isInitiator}`);
    
    const peer = new SimplePeer({
      initiator: isInitiator,
      trickle: false,
      config: {
        iceServers: this.config.iceServers
      }
    });
    
    // Store peer immediately
    this.peers.set(userId, peer);
    
    // Handle signaling
    peer.on('signal', (data) => {
      this.socket.emit('webrtc-signal', {
        targetUserId: userId,
        signal: data
      });
    });
    
    // Handle successful connection
    peer.on('connect', () => {
      console.log(`P2P connection established with ${userId}`);
      
      // Resolve pending connection promise
      const pending = this.pendingConnections.get(userId);
      if (pending) {
        pending.resolve(peer);
        this.pendingConnections.delete(userId);
      }
      
      this.notifyListeners('peer', { type: 'connected', userId });
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
      console.error(`P2P connection error with ${userId}:`, error);
      this.closePeerConnection(userId);
      
      // Reject pending connection promise
      const pending = this.pendingConnections.get(userId);
      if (pending) {
        pending.reject(error);
        this.pendingConnections.delete(userId);
      }
    });
    
    // Handle connection close
    peer.on('close', () => {
      console.log(`P2P connection closed with ${userId}`);
      this.peers.delete(userId);
    });
  }

  /**
   * Handle incoming WebRTC signal
   */
  handleWebRTCSignal(data) {
    const { fromUserId, signal } = data;
    let peer = this.peers.get(fromUserId);
    
    if (!peer) {
      // Create peer connection if it doesn't exist
      this.createPeerConnection(fromUserId, false);
      peer = this.peers.get(fromUserId);
    }
    
    if (peer && !peer.destroyed) {
      peer.signal(signal);
    }
  }

  /**
   * Close a peer connection
   */
  closePeerConnection(userId) {
    const peer = this.peers.get(userId);
    if (peer) {
      peer.destroy();
      this.peers.delete(userId);
    }
  }

  /**
   * Handle incoming peer message
   */
  handlePeerMessage(fromUserId, message) {
    console.log(`Message from ${fromUserId}:`, message.type);
    
    // Handle request-response pattern
    if (message.type === 'request') {
      this.handlePeerRequest(fromUserId, message);
    } else if (message.type === 'response') {
      this.handlePeerResponse(fromUserId, message);
    } else {
      // Handle other message types
      const handler = this.messageHandlers.get(message.type);
      if (handler) {
        handler(fromUserId, message.data);
      } else {
        this.notifyListeners('message', { fromUserId, message });
      }
    }
  }

  /**
   * Handle peer request
   */
  async handlePeerRequest(fromUserId, message) {
    const { requestId, requestType, data } = message;
    const handler = this.requestHandlers.get(requestType);
    
    try {
      if (handler) {
        const response = await handler(data, fromUserId);
        this.sendToPeer(fromUserId, {
          type: 'response',
          requestId,
          success: true,
          data: response
        });
      } else {
        throw new Error(`No handler for request type: ${requestType}`);
      }
    } catch (error) {
      this.sendToPeer(fromUserId, {
        type: 'response',
        requestId,
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Handle peer response
   */
  handlePeerResponse(fromUserId, message) {
    const { requestId } = message;
    const pending = this.pendingRequests?.get(requestId);
    
    if (pending) {
      if (message.success) {
        pending.resolve(message.data);
      } else {
        pending.reject(new Error(message.error));
      }
      this.pendingRequests.delete(requestId);
    }
  }

  /**
   * Send message to a peer
   */
  async sendToPeer(userId, message) {
    const peer = await this.ensurePeerConnection(userId);
    
    if (peer.connected) {
      peer.send(JSON.stringify(message));
    } else {
      throw new Error(`Not connected to peer ${userId}`);
    }
  }

  /**
   * Send request to a peer and wait for response
   */
  async requestFromPeer(userId, requestType, data, timeout = 30000) {
    const requestId = Date.now().toString() + Math.random().toString(36).substring(2);
    
    if (!this.pendingRequests) {
      this.pendingRequests = new Map();
    }
    
    return new Promise(async (resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new Error('Request timeout'));
      }, timeout);
      
      this.pendingRequests.set(requestId, {
        resolve: (data) => {
          clearTimeout(timeoutId);
          resolve(data);
        },
        reject: (error) => {
          clearTimeout(timeoutId);
          reject(error);
        }
      });
      
      try {
        await this.sendToPeer(userId, {
          type: 'request',
          requestId,
          requestType,
          data
        });
      } catch (error) {
        clearTimeout(timeoutId);
        this.pendingRequests.delete(requestId);
        reject(error);
      }
    });
  }

  /**
   * Ensure peer connection exists or wait for it
   */
  async ensurePeerConnection(userId, timeout = 10000) {
    const existingPeer = this.peers.get(userId);
    if (existingPeer && existingPeer.connected) {
      return existingPeer;
    }
    
    // Check if connection is already pending
    const pending = this.pendingConnections.get(userId);
    if (pending) {
      return pending.promise;
    }
    
    // Create new pending connection
    let resolveConnection, rejectConnection;
    const promise = new Promise((resolve, reject) => {
      resolveConnection = resolve;
      rejectConnection = reject;
    });
    
    this.pendingConnections.set(userId, {
      promise,
      resolve: resolveConnection,
      reject: rejectConnection
    });
    
    // Set timeout
    setTimeout(() => {
      const pending = this.pendingConnections.get(userId);
      if (pending) {
        pending.reject(new Error('Connection timeout'));
        this.pendingConnections.delete(userId);
      }
    }, timeout);
    
    // Initiate connection if needed
    if (!existingPeer) {
      this.createPeerConnection(userId, true);
    }
    
    return promise;
  }

  /**
   * Register a message handler
   */
  onMessage(messageType, handler) {
    this.messageHandlers.set(messageType, handler);
  }

  /**
   * Register a request handler (for hosts)
   */
  onRequest(requestType, handler) {
    this.requestHandlers.set(requestType, handler);
  }

  /**
   * Get list of connected peers
   */
  getConnectedPeers() {
    return Array.from(this.peers.entries())
      .filter(([_, peer]) => peer.connected)
      .map(([userId, _]) => userId);
  }

  /**
   * Broadcast message to all connected peers
   */
  async broadcast(message) {
    const connectedPeers = this.getConnectedPeers();
    const promises = connectedPeers.map(userId => 
      this.sendToPeer(userId, message).catch(err => 
        console.error(`Failed to send to ${userId}:`, err)
      )
    );
    await Promise.all(promises);
  }

  /**
   * Determine if we should initiate connection
   */
  shouldInitiateConnection(otherUserId) {
    // Use lexicographic comparison to ensure only one peer initiates
    return this.userId > otherUserId;
  }

  /**
   * Schedule reconnection attempt
   */
  scheduleReconnect() {
    if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      this.updateStatus('error', 'Max reconnection attempts reached');
      return;
    }
    
    this.reconnectAttempts++;
    const delay = this.config.reconnectDelay * this.reconnectAttempts;
    
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
   * Update connection status
   */
  updateStatus(status, error = null) {
    this.status = status;
    this.notifyListeners('status', { status, error });
  }

  /**
   * Add event listener
   */
  on(event, listener) {
    if (this.listeners[event]) {
      this.listeners[event].add(listener);
      return () => this.listeners[event].delete(listener);
    }
    throw new Error(`Unknown event type: ${event}`);
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
   * Disconnect and cleanup
   */
  disconnect() {
    // Close all peer connections
    this.peers.forEach((peer, userId) => {
      peer.destroy();
    });
    this.peers.clear();
    
    // Close socket connection
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    
    this.isInitialized = false;
    this.updateStatus('disconnected');
  }
}

export default P2PClient;